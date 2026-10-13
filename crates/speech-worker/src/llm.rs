//! The core's `LlmJson` runs over stdio: one call = one `llm.request` event + a blocking wait for the Runtime's `llm.reply`.
//!
//! The Worker does no networking and holds no keys. After receiving a request, the Runtime sends it through the flow's existing `generateText` path (provider selection, authorization, task budget,
//! ledger, and stop barrier all live there), and hands back the text or a classified failure. Retry, half-page, and per-unit repair are still the core's own semantics (`RetryPolicy`).
//!
//! Request shaping is ported verbatim from v2 `ccut-engine/src/llm_exec.rs`: the kind from the file contract wraps the carrier in an inline input envelope and scales the output cap to the input,
//! and the retry reason is attached outside the envelope. These are part of the prompt and belong to the Worker (architecture design §13.6). The Runtime only strips temperature and clamps the output cap according to model capability.

use std::cell::RefCell;
use std::rc::Rc;

use serde_json::{Value, json};
use speech_doc::filepipe::common::{max_output_chars, uses_file_contract};
use speech_doc::llm::{LlmError, LlmJson, LlmRequest};

use crate::protocol::{Control, ErrorClass, Reply, ReplyError, Waited, event};

/// Model call over stdio.
pub struct StdioLlm {
    control: Rc<RefCell<Control>>,
    next_id: u64,
    /// Number of calls sent (including the core's own retries).
    pub calls: u64,
    /// The first terminal failure (budget, authorization, stop barrier, ...). The task's error is reported from it.
    pub terminal: Option<ReplyError>,
}

impl StdioLlm {
    pub fn new(control: Rc<RefCell<Control>>) -> StdioLlm {
        StdioLlm {
            control,
            next_id: 1,
            calls: 0,
            terminal: None,
        }
    }
}

impl LlmJson for StdioLlm {
    fn complete(&mut self, request: &LlmRequest) -> Result<String, LlmError> {
        let mut control = self.control.borrow_mut();
        control.poll();
        if control.stopped() {
            return Err(LlmError::Cancelled);
        }
        let request_id = self.next_id;
        self.next_id += 1;
        self.calls += 1;
        event("llm.request", request_params(request_id, request));
        match control.wait_reply(request_id) {
            Waited::Stopped => Err(LlmError::Cancelled),
            Waited::Reply(Reply::Text(text)) => Ok(text),
            Waited::Reply(Reply::Error(error)) => {
                let mapped = match error.class {
                    ErrorClass::Retryable => LlmError::Http {
                        status: error.status.unwrap_or(0),
                        message: format!("{}: {}", error.code, error.message),
                    },
                    ErrorClass::Malformed => LlmError::Malformed(format!("{}: {}", error.code, error.message)),
                    ErrorClass::Terminal => LlmError::Terminal(format!("{}: {}", error.code, error.message)),
                    ErrorClass::Cancelled => LlmError::Cancelled,
                };
                if matches!(error.class, ErrorClass::Terminal | ErrorClass::Cancelled) && self.terminal.is_none() {
                    self.terminal = Some(error);
                }
                Err(mapped)
            }
        }
    }
}

/// Parameters of the `llm.request` event.
pub fn request_params(request_id: u64, request: &LlmRequest) -> Value {
    let file_contract = uses_file_contract(request.kind);
    json!({
        "requestId": request_id,
        "kind": request.kind,
        "attempt": request.attempt,
        "system": request.system,
        "user": request_user_content(request, file_contract),
        "temperature": request.temperature,
        "maxOutputTokens": file_contract.then(|| file_contract_max_output_tokens(&request.user)),
    })
}

/// The carrier for this kind under the file contract: `(logical filename suffix, media-type)` (v2 `file_carrier_format_opt`).
pub fn file_carrier_format(kind: &str) -> (&'static str, &'static str) {
    match kind {
        "translate" => ("html", "text/html"),
        "translate-lines" => ("txt", "text/plain"),
        "polish" | "segment-repair" | "seam-repair" | "punct-repair" | "speaker-repair" | "speaker-names" => ("txt", "text/plain"),
        "align" | "align-edges" | "align-rewrite" => ("html", "text/html"),
        "chapters" | "chapters-outline" => ("html", "text/html"),
        "analysis" | "translate-brief" | "brief" => ("md", "text/markdown"),
        _ => ("txt", "text/plain"),
    }
}

/// Logical filename of the inline input envelope: a stem that is stable per kind, so the same page keeps its name across repair rounds (so the prompt cache is not broken).
fn inline_input_name(kind: &str) -> String {
    format!("{kind}.src.{}", file_carrier_format(kind).0)
}

const FILE_CONTRACT_OUTPUT_CHARS_PER_TOKEN: usize = 2;
const FILE_CONTRACT_MIN_OUTPUT_TOKENS: u64 = 4_096;
const FILE_CONTRACT_MAX_OUTPUT_TOKENS: u64 = 16_384;

/// Output cap (tokens) scaled to the input under the file contract. The Runtime then clamps it to the model's limit.
pub fn file_contract_max_output_tokens(input: &str) -> u64 {
    let tokens = max_output_chars(input.chars().count()).div_ceil(FILE_CONTRACT_OUTPUT_CHARS_PER_TOKEN);
    (tokens as u64).clamp(FILE_CONTRACT_MIN_OUTPUT_TOKENS, FILE_CONTRACT_MAX_OUTPUT_TOKENS)
}

/// User message body. Under the file contract it is wrapped in the inline input envelope; the retry context stays outside the envelope, because it is an instruction, not document content.
pub fn request_user_content(request: &LlmRequest, file_contract: bool) -> String {
    let body = if file_contract {
        let (_, media_type) = file_carrier_format(request.kind);
        format!(
            "<BEGIN INPUT name=\"{}\" media-type=\"{media_type}\">\n{}\n<END INPUT>",
            inline_input_name(request.kind),
            request.user
        )
    } else {
        request.user.clone()
    };
    match request.retry_reason.as_deref() {
        Some(reason) => format!("{body}\n\n[retry context — the previous answer failed validation: {reason}]"),
        None => body,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(kind: &'static str, retry: Option<&str>) -> LlmRequest {
        LlmRequest {
            kind,
            system: "sys".into(),
            user: "<article></article>".into(),
            temperature: 0.2,
            attempt: 1,
            retry_reason: retry.map(str::to_owned),
        }
    }

    #[test]
    fn file_contracts_are_wrapped_and_retry_context_stays_outside() {
        let content = request_user_content(&request("translate", Some("missing p")), true);
        assert_eq!(
            content,
            "<BEGIN INPUT name=\"translate.src.html\" media-type=\"text/html\">\n<article></article>\n<END INPUT>\n\n[retry context — the previous answer failed validation: missing p]"
        );
        assert_eq!(request_user_content(&request("brief", None), false), "<article></article>");
    }

    #[test]
    fn output_limit_is_clamped() {
        assert_eq!(file_contract_max_output_tokens("short"), 4_096);
        assert_eq!(file_contract_max_output_tokens(&"x".repeat(100_000)), 16_384);
    }

    #[test]
    fn request_params_carry_no_limit_for_json_kinds() {
        let params = request_params(7, &request("brief", None));
        assert_eq!(params["requestId"], 7);
        assert!(params["maxOutputTokens"].is_null());
        let params = request_params(8, &request("align-edges", None));
        assert_eq!(params["maxOutputTokens"], 4_096);
    }
}
