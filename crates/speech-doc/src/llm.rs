//! LLM call abstraction (mirrors the error classification and parsing discipline of voice-ink `LLMJson.swift`).
//!
//! The engine depends only on the [`LlmJson`] trait. The host provides either a direct provider connection or an agent response loop as its executor. Constraints are layered: json_object (the host's responsibility), fence-strip parsing, and engine-side deterministic semantic validation. Failures go through one unified retry path.

use serde::de::DeserializeOwned;

/// The `--llm` argument: `agent` or `provider:<vendor>/<model>`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LlmMode {
    Agent,
    Provider { vendor: String, model: String },
}

impl LlmMode {
    pub fn parse(text: &str) -> Result<Self, String> {
        // Previously the App wrote UI decoration labels ("… · → 简体中文", i.e. “… · → Simplified Chinese”) together with the model name into llm.default. Model IDs contain no whitespace, so truncating at the first whitespace yields the machine token.
        let text = text.trim();
        let text = text.split_whitespace().next().unwrap_or(text);
        if text == "agent" {
            return Ok(Self::Agent);
        }
        if let Some(rest) = text.strip_prefix("provider:") {
            let (vendor, model) = rest.split_once('/').ok_or_else(|| {
                format!("--llm provider must look like provider:<vendor>/<model>: {text}")
            })?;
            if vendor.is_empty() || model.is_empty() {
                return Err(format!(
                    "--llm provider must look like provider:<vendor>/<model>: {text}"
                ));
            }
            return Ok(Self::Provider {
                vendor: vendor.to_owned(),
                model: model.to_owned(),
            });
        }
        Err(format!(
            "Unknown --llm mode: {text} (agent | provider:<vendor>/<model>)"
        ))
    }
}

/// `--llm-effort`: the provider's reasoning intensity. `auto` defers to the provider's own default.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReasoningEffort {
    Auto,
    Low,
    Medium,
    High,
}

impl ReasoningEffort {
    pub fn parse(value: &str) -> Result<Self, String> {
        match value.trim().to_ascii_lowercase().as_str() {
            "auto" => Ok(Self::Auto),
            "low" => Ok(Self::Low),
            "medium" => Ok(Self::Medium),
            "high" => Ok(Self::High),
            other => Err(format!(
                "Unknown --llm-effort {other} (available: auto|low|medium|high)"
            )),
        }
    }
}

/// One JSON-mode call request.
#[derive(Debug, Clone)]
pub struct LlmRequest {
    /// "analysis" | "polish" | "polish-retry" | "segment-repair" | "seam-repair" | "punct-repair"
    /// | "speaker-repair" | "speaker-names"
    /// | "segment" | "segment-index" | "repunct" | "chapters" | "brief"
    /// | "translate-brief" | "translate" | "align" | "cleanup" | "broll"
    pub kind: &'static str,
    pub system: String,
    pub user: String,
    pub temperature: f32,
    /// One-based attempt number. Hosts use it for retry telemetry while the
    /// retry reason remains reserved for semantic prompt feedback.
    pub attempt: u32,
    /// The structured reason injected when a retry follows a semantic validation failure (the host passes it on to the provider prompt, or to the agent problems).
    pub retry_reason: Option<String>,
}

#[derive(Debug)]
pub enum LlmError {
    /// status=0 means a transport failure with no HTTP response, such as DNS, connection, TLS or timeout. Like 408/429/5xx, it is retryable. 401/403/404 and other 4xx terminate.
    Http {
        status: u16,
        message: String,
    },
    /// An unusable response (no JSON, decoding failure, semantic validation failure) is retryable.
    Malformed(String),
    /// A terminal provider error (authentication failure, model not found, etc.) leaves the pipeline directly. Never mask a configuration problem with a degraded result.
    Terminal(String),
    Cancelled,
}

impl std::fmt::Display for LlmError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Http { status, message } => write!(f, "HTTP {status}: {message}"),
            Self::Malformed(detail) => {
                write!(f, "The model returned unusable JSON — {detail}")
            }
            Self::Terminal(detail) => write!(f, "terminal: {detail}"),
            Self::Cancelled => write!(f, "cancelled"),
        }
    }
}

impl std::error::Error for LlmError {}

impl LlmError {
    pub fn is_retryable(&self) -> bool {
        match self {
            Self::Http { status, .. } => {
                *status == 0 || *status == 408 || *status == 429 || *status >= 500
            }
            Self::Malformed(_) => true,
            Self::Terminal(_) | Self::Cancelled => false,
        }
    }
}

/// One JSON-mode call: system + user → raw response text. Parsing, fence-strip and semantic validation all happen on the engine side.
pub trait LlmJson {
    fn complete(&mut self, request: &LlmRequest) -> Result<String, LlmError>;

    /// A group of mutually independent calls. The default runs them serially, one by one. The agent executor overrides this to post all requests at once, so that multiple workers can claim them in parallel (each request is still an independent call/lease). Each result triggers the callback as soon as it is ready, with `index` corresponding to the subscript in `requests`. The default implementation keeps the one-by-one serial behaviour of provider / FakeLlm.
    fn complete_batch_with(
        &mut self,
        requests: &[LlmRequest],
        on_ready: &mut dyn FnMut(usize, Result<String, LlmError>),
    ) {
        for (index, request) in requests.iter().enumerate() {
            on_ready(index, self.complete(request));
        }
    }

    /// Compatibility for engines that need to consume results in request order. It still dispatches via [`LlmJson::complete_batch_with`], so agents can execute in parallel.
    fn complete_batch(&mut self, requests: &[LlmRequest]) -> Vec<Result<String, LlmError>> {
        let mut slots: Vec<Option<Result<String, LlmError>>> =
            (0..requests.len()).map(|_| None).collect();
        self.complete_batch_with(requests, &mut |index, result| {
            if let Some(slot) = slots.get_mut(index) {
                *slot = Some(result);
            }
        });
        slots
            .into_iter()
            .enumerate()
            .map(|(index, slot)| {
                slot.unwrap_or_else(|| {
                    Err(LlmError::Terminal(format!(
                        "batch executor omitted result at index {index}"
                    )))
                })
            })
            .collect()
    }
}

/// fence-strip parsing: take the outermost `{…}` in the response, tolerating markdown fences and surrounding chatter.
pub fn decode<T: DeserializeOwned>(raw: &str) -> Result<T, LlmError> {
    let left = raw
        .find('{')
        .ok_or_else(|| LlmError::Malformed("no JSON object in the response".to_owned()))?;
    let right = raw
        .rfind('}')
        .filter(|&right| right > left)
        .ok_or_else(|| LlmError::Malformed("no JSON object in the response".to_owned()))?;
    serde_json::from_str(&raw[left..=right]).map_err(|error| LlmError::Malformed(error.to_string()))
}

/// Retry decision: terminal and cancelled are never retried; the rest follow the classification. Semantic errors thrown by the engine (a mapping failure, i.e. a failed attempt) are retryable by default.
pub fn should_retry(error: &LlmError) -> bool {
    error.is_retryable()
}

pub const MAX_RETRIES: u32 = 3;
pub const RETRY_BACKOFF_SECONDS: f64 = 2.0;

/// The global retry policy (retry policy redesign §2.6): page-fatal allows only [`RetryPolicy::MAX_PAGE_ATTEMPTS`] whole-page retries. After that, each kind's own paginator **halves the window** ([`RetryPolicy::SPLIT_THEN`]) and tries each half once more. Unit-level catch-up waves run at most [`RetryPolicy::UNIT_ROUNDS`] rounds. The total call volume is of the same order as the old [`MAX_RETRIES`], but the fallback granularity is halved.
///
/// [`MAX_RETRIES`] is kept for call sites that have not yet migrated to this policy.
pub struct RetryPolicy;

impl RetryPolicy {
    /// The number of whole-page attempts for page-fatal (the 1st is the initial send; the 2nd resends with feedback).
    pub const MAX_PAGE_ATTEMPTS: u32 = 2;
    /// Whether, after the whole-page attempts are exhausted, to split the page in half and try each half once more.
    pub const SPLIT_THEN: bool = true;
    /// The upper limit on rounds of unit-level catch-up waves.
    pub const UNIT_ROUNDS: u32 = 2;
}

/// The settlement of [`complete_batch_retry_report`]: **every** request that still fails after the rounds are exhausted.
///
/// An empty `failed` means all succeeded. Non-retryable errors (Terminal/Cancelled/protocol violations) never reach here; they still propagate immediately as `Err`.
#[derive(Debug, Default)]
pub struct BatchOutcome {
    /// `(requests` index, last failure reason)`, in ascending index order.
    pub failed: Vec<(usize, LlmError)>,
}

impl BatchOutcome {
    /// Whether all requests succeeded.
    pub fn is_complete(&self) -> bool {
        self.failed.is_empty()
    }
}

/// Dispatches a group of independent requests in a batch, retrying each page independently. A successful item is handed to `on_ready` as soon as its underlying result is ready. A failed item enters the next round, and each round backs off once. A completion error does not rewrite the request; only an engine semantic validation failure injects a retry reason via `validation_retry_reason`. A request's own `retry_reason` (the caller's explanation, in a catch-up wave, of "why ask again") is sent unchanged in every round, until a validation reason replaces it.
///
/// The only difference from [`complete_batch_retry_with`] is the settlement: when the rounds are exhausted, **every** failed page is returned to the caller together with its reason ([`BatchOutcome`]), rather than only the first. The caller can therefore narrow retries, or deterministically finalize only the failed pages, while the others are stored as usual.
pub fn complete_batch_retry_report<T>(
    llm: &mut dyn LlmJson,
    requests: &[LlmRequest],
    attempts: u32,
    sleep: &mut dyn FnMut(f64),
    validate: &mut dyn FnMut(usize, &str) -> Result<T, LlmError>,
    validation_retry_reason: &mut dyn FnMut(usize, &LlmError) -> String,
    on_ready: &mut dyn FnMut(usize, T),
) -> Result<BatchOutcome, LlmError> {
    let attempts = attempts.max(1);
    let mut pending = (0..requests.len()).collect::<Vec<_>>();
    let mut retry_reasons = vec![None; requests.len()];

    for round in 0..attempts {
        if pending.is_empty() {
            return Ok(BatchOutcome::default());
        }
        if round > 0 {
            sleep(RETRY_BACKOFF_SECONDS);
        }
        let round_requests = pending
            .iter()
            .map(|&index| {
                let mut request = requests[index].clone();
                request.attempt = round + 1;
                request.retry_reason = retry_reasons[index]
                    .take()
                    .or_else(|| requests[index].retry_reason.clone());
                request
            })
            .collect::<Vec<_>>();
        let mut seen = vec![false; round_requests.len()];
        let mut failures: Vec<(usize, LlmError)> = Vec::new();
        let mut protocol_error = None;
        llm.complete_batch_with(&round_requests, &mut |slot, result| {
            let Some(&index) = pending.get(slot) else {
                protocol_error = Some(LlmError::Terminal(format!(
                    "batch executor returned out-of-range index {slot}"
                )));
                return;
            };
            if seen[slot] {
                protocol_error = Some(LlmError::Terminal(format!(
                    "batch executor returned index {slot} more than once"
                )));
                return;
            }
            seen[slot] = true;
            match result {
                Ok(raw) => match validate(index, &raw) {
                    Ok(value) => on_ready(index, value),
                    Err(error) => {
                        retry_reasons[index] = Some(validation_retry_reason(index, &error));
                        failures.push((index, error));
                    }
                },
                Err(error) => failures.push((index, error)),
            }
        });
        if let Some(error) = protocol_error {
            return Err(error);
        }
        for (slot, was_seen) in seen.into_iter().enumerate() {
            if !was_seen {
                failures.push((
                    pending[slot],
                    LlmError::Terminal(format!("batch executor omitted result at index {slot}")),
                ));
            }
        }
        failures.sort_by_key(|(index, _)| *index);
        if failures.is_empty() {
            return Ok(BatchOutcome::default());
        }
        if let Some(position) = failures.iter().position(|(_, error)| !should_retry(error)) {
            return Err(failures.remove(position).1);
        }
        if round + 1 == attempts {
            return Ok(BatchOutcome { failed: failures });
        }
        pending = failures.into_iter().map(|(index, _)| index).collect();
    }
    Ok(BatchOutcome::default())
}

/// A thin wrapper over [`complete_batch_retry_report`]: when exhausted, it propagates only the **first** failure reason.
///
/// Call sites that have not yet moved to "reject means narrow" keep using it. New code should use the report variant, so that each failed unit can be narrowed or finalized separately.
pub fn complete_batch_retry_with<T>(
    llm: &mut dyn LlmJson,
    requests: &[LlmRequest],
    attempts: u32,
    sleep: &mut dyn FnMut(f64),
    validate: &mut dyn FnMut(usize, &str) -> Result<T, LlmError>,
    validation_retry_reason: &mut dyn FnMut(usize, &LlmError) -> String,
    on_ready: &mut dyn FnMut(usize, T),
) -> Result<(), LlmError> {
    let outcome = complete_batch_retry_report(
        llm,
        requests,
        attempts,
        sleep,
        validate,
        validation_retry_reason,
        on_ready,
    )?;
    match outcome.failed.into_iter().next() {
        Some((_, error)) => Err(error),
        None => Ok(()),
    }
}

/// Runs one attempt closure with retry. The backoff sleep is injected by the host (core has zero I/O and no clock).
pub fn with_retry<T>(
    attempts: u32,
    mut sleep: impl FnMut(f64),
    mut attempt: impl FnMut(u32) -> Result<T, LlmError>,
) -> Result<T, LlmError> {
    let mut last = None;
    for index in 0..attempts.max(1) {
        if index > 0 {
            sleep(RETRY_BACKOFF_SECONDS);
        }
        match attempt(index) {
            Ok(value) => return Ok(value),
            Err(error) => {
                if !should_retry(&error) {
                    return Err(error);
                }
                last = Some(error);
            }
        }
    }
    Err(last.unwrap_or_else(|| LlmError::Malformed("no attempts executed".to_owned())))
}

/// A scripted fake implementation (mirrors voice-ink `FakeLLMJSON`), for testing all engine logic offline.
pub struct FakeLlm {
    script: std::collections::VecDeque<Result<String, LlmError>>,
    /// Records each call's (kind, system, user, retry_reason).
    pub calls: Vec<(String, String, String, Option<String>)>,
    pub attempts: Vec<u32>,
}

impl FakeLlm {
    pub fn new<I: IntoIterator<Item = Result<String, LlmError>>>(script: I) -> Self {
        Self {
            script: script.into_iter().collect(),
            calls: Vec::new(),
            attempts: Vec::new(),
        }
    }

    pub fn ok<I: IntoIterator<Item = &'static str>>(script: I) -> Self {
        Self::new(script.into_iter().map(|raw| Ok(raw.to_owned())))
    }
}

impl LlmJson for FakeLlm {
    fn complete(&mut self, request: &LlmRequest) -> Result<String, LlmError> {
        self.attempts.push(request.attempt);
        self.calls.push((
            request.kind.to_owned(),
            request.system.clone(),
            request.user.clone(),
            request.retry_reason.clone(),
        ));
        self.script
            .pop_front()
            .unwrap_or_else(|| Err(LlmError::Terminal("FakeLlm: script exhausted".to_owned())))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    #[derive(Debug, Deserialize, PartialEq)]
    struct Shape {
        value: i32,
    }

    #[test]
    fn decode_strips_fences_and_prose() {
        let raw = "Sure! Here is the JSON:\n```json\n{\"value\": 42}\n```\nHope it helps.";
        assert_eq!(decode::<Shape>(raw).unwrap(), Shape { value: 42 });
        assert!(decode::<Shape>("no json here").is_err());
    }

    #[test]
    fn complete_batch_defaults_to_sequential_order() {
        let mut fake = FakeLlm::new([
            Ok("{\"value\": 1}".to_owned()),
            Err(LlmError::Malformed("bad".to_owned())),
            Ok("{\"value\": 3}".to_owned()),
        ]);
        let request = |kind| LlmRequest {
            kind,
            system: String::new(),
            user: String::new(),
            temperature: 0.1,
            attempt: 1,
            retry_reason: None,
        };
        let results = fake.complete_batch(&[request("align"), request("align"), request("align")]);
        assert_eq!(results.len(), 3);
        assert!(results[0].is_ok());
        assert!(results[1].is_err());
        assert_eq!(results[2].as_deref().unwrap(), "{\"value\": 3}");
        assert_eq!(fake.calls.len(), 3);
    }

    #[test]
    fn retry_classification_matches_voiceink() {
        assert!(
            LlmError::Http {
                status: 0,
                message: "connection reset".to_owned()
            }
            .is_retryable(),
            "a transient transport error with no HTTP response must enter bounded retry"
        );
        assert!(
            LlmError::Http {
                status: 429,
                message: String::new()
            }
            .is_retryable()
        );
        assert!(
            LlmError::Http {
                status: 503,
                message: String::new()
            }
            .is_retryable()
        );
        assert!(
            !LlmError::Http {
                status: 401,
                message: String::new()
            }
            .is_retryable()
        );
        assert!(
            !LlmError::Http {
                status: 404,
                message: String::new()
            }
            .is_retryable()
        );
        assert!(LlmError::Malformed("x".to_owned()).is_retryable());
        assert!(!LlmError::Terminal("x".to_owned()).is_retryable());
    }

    #[test]
    fn with_retry_stops_on_terminal_and_retries_malformed() {
        let mut sleeps = Vec::new();
        let mut fake = FakeLlm::new([
            Err(LlmError::Malformed("bad".to_owned())),
            Ok("{\"value\": 7}".to_owned()),
        ]);
        let request = LlmRequest {
            kind: "polish",
            system: String::new(),
            user: String::new(),
            temperature: 0.2,
            attempt: 1,
            retry_reason: None,
        };
        let value: Shape = with_retry(
            3,
            |s| sleeps.push(s),
            |_| {
                let raw = fake.complete(&request)?;
                decode(&raw)
            },
        )
        .unwrap();
        assert_eq!(value, Shape { value: 7 });
        assert_eq!(sleeps, vec![RETRY_BACKOFF_SECONDS]);

        let mut fake = FakeLlm::new([Err(LlmError::Terminal("401".to_owned()))]);
        let result: Result<Shape, _> = with_retry(
            3,
            |_| {},
            |_| {
                let raw = fake.complete(&request)?;
                decode(&raw)
            },
        );
        assert!(matches!(result, Err(LlmError::Terminal(_))));
        assert_eq!(fake.calls.len(), 1);
    }

    #[test]
    fn batch_retry_increments_attempt_even_without_validation_feedback() {
        let mut fake = FakeLlm::new([
            Err(LlmError::Http {
                status: 503,
                message: "busy".to_owned(),
            }),
            Ok("{\"value\": 9}".to_owned()),
        ]);
        let request = LlmRequest {
            kind: "translate",
            system: String::new(),
            user: String::new(),
            temperature: 0.2,
            attempt: 1,
            retry_reason: None,
        };
        let mut completed = Vec::new();
        complete_batch_retry_with(
            &mut fake,
            &[request],
            3,
            &mut |_| {},
            &mut |_, raw| decode::<Shape>(raw),
            &mut |_, error| error.to_string(),
            &mut |_, value| completed.push(value),
        )
        .unwrap();
        assert_eq!(fake.attempts, [1, 2]);
        assert_eq!(fake.calls[1].3, None);
        assert_eq!(completed, [Shape { value: 9 }]);
    }

    /// The settlement of the report variant: after exhaustion, every failed page is returned to the caller (the old variant reported only the first one). Successful pages are stored as usual and are not affected by failed pages.
    #[test]
    fn batch_retry_report_returns_every_exhausted_failure() {
        let request = |kind| LlmRequest {
            kind,
            system: String::new(),
            user: String::new(),
            temperature: 0.1,
            attempt: 1,
            retry_reason: None,
        };
        // 3 pages × 2 rounds: page 0 succeeds in the first round; pages 1 and 2 are bad in both rounds.
        let mut fake = FakeLlm::new([
            Ok("{\"value\": 1}".to_owned()),
            Err(LlmError::Malformed("p1".to_owned())),
            Err(LlmError::Malformed("p2".to_owned())),
            Err(LlmError::Malformed("p1 again".to_owned())),
            Err(LlmError::Malformed("p2 again".to_owned())),
        ]);
        let mut completed = Vec::new();
        let outcome = complete_batch_retry_report(
            &mut fake,
            &[request("polish"), request("polish"), request("polish")],
            2,
            &mut |_| {},
            &mut |_, raw| decode::<Shape>(raw),
            &mut |_, error| error.to_string(),
            &mut |index, value: Shape| completed.push((index, value)),
        )
        .expect("retryable failures must not abort the batch");
        assert_eq!(completed, [(0, Shape { value: 1 })]);
        assert_eq!(
            outcome
                .failed
                .iter()
                .map(|(index, _)| *index)
                .collect::<Vec<_>>(),
            [1, 2]
        );
        assert!(!outcome.is_complete());

        // The thin wrapper keeps the old semantics: it propagates only the first failure.
        let mut fake = FakeLlm::new([
            Err(LlmError::Malformed("a".to_owned())),
            Err(LlmError::Malformed("b".to_owned())),
        ]);
        let error = complete_batch_retry_with(
            &mut fake,
            &[request("polish")],
            2,
            &mut |_| {},
            &mut |_, raw| decode::<Shape>(raw),
            &mut |_, error| error.to_string(),
            &mut |_, _: Shape| {},
        )
        .expect_err("wrapper still surfaces the first failure");
        assert!(matches!(error, LlmError::Malformed(_)), "{error:?}");
    }

    /// A request's own retry reason goes out in the first round, and the next round after a transport failure still carries it. A reason from a validation failure replaces it.
    #[test]
    fn batch_retry_report_keeps_the_requests_own_retry_reason() {
        let request = LlmRequest {
            kind: "polish",
            system: String::new(),
            user: String::new(),
            temperature: 0.1,
            attempt: 1,
            retry_reason: Some("asked again".to_owned()),
        };
        let mut fake = FakeLlm::new([
            Err(LlmError::Http {
                status: 0,
                message: "timeout".to_owned(),
            }),
            Ok("not json".to_owned()),
            Ok("{\"value\": 3}".to_owned()),
        ]);
        let mut completed = Vec::new();
        let outcome = complete_batch_retry_report(
            &mut fake,
            &[request],
            3,
            &mut |_| {},
            &mut |_, raw| decode::<Shape>(raw),
            &mut |_, _| "bad shape".to_owned(),
            &mut |_, value: Shape| completed.push(value),
        )
        .expect("third round succeeds");
        assert!(outcome.is_complete());
        assert_eq!(completed, [Shape { value: 3 }]);
        let reasons = fake
            .calls
            .iter()
            .map(|call| call.3.as_deref())
            .collect::<Vec<_>>();
        assert_eq!(
            reasons,
            [Some("asked again"), Some("asked again"), Some("bad shape")]
        );
    }

    /// Terminal still propagates immediately and does not enter [`BatchOutcome::failed`].
    #[test]
    fn batch_retry_report_still_aborts_on_terminal() {
        let mut fake = FakeLlm::new([Err(LlmError::Terminal("401".to_owned()))]);
        let request = LlmRequest {
            kind: "polish",
            system: String::new(),
            user: String::new(),
            temperature: 0.1,
            attempt: 1,
            retry_reason: None,
        };
        let error = complete_batch_retry_report(
            &mut fake,
            &[request],
            RetryPolicy::MAX_PAGE_ATTEMPTS,
            &mut |_| {},
            &mut |_, raw| decode::<Shape>(raw),
            &mut |_, error| error.to_string(),
            &mut |_, _: Shape| {},
        )
        .expect_err("terminal aborts");
        assert!(matches!(error, LlmError::Terminal(_)), "{error:?}");
        assert_eq!(fake.calls.len(), 1);
    }

    #[test]
    fn llm_mode_parses_agent_and_provider() {
        assert_eq!(LlmMode::parse("agent").unwrap(), LlmMode::Agent);
        assert_eq!(
            LlmMode::parse("provider:anthropic/claude-sonnet-5").unwrap(),
            LlmMode::Provider {
                vendor: "anthropic".to_owned(),
                model: "claude-sonnet-5".to_owned()
            }
        );
        assert!(LlmMode::parse("provider:x").is_err());
        assert!(LlmMode::parse("magic").is_err());
    }
}
