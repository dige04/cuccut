//! Top-level `events[]` of the document (spec §4.2): the event table from picture to audio.
//!
//! Events are moments for the score and sound effects; **rendering does not read them**. `ccut lint` validates them here (`t` parses, `id` is unique, `phase` expression is valid), and `ccut events` uses the same evaluation to export rows sorted by time.
//!
//! - `t` / `until` are TimeExpr, evaluated with [`Resolver::eval_t_exact`] after `resolve()`: not aligned to the frame grid, results rounded to milliseconds.
//! - `phase` is an expression string over `u` (seconds from `t`); only `+ - * / ( )`, numbers, and `sin` / `cos` / `pow` / `floor` (`libm`, bit-identical across targets) are allowed. Over `[t, until]` it is scanned in 1 ms steps; each time the phase **first crosses upward** `k + 0.25`, one row `id#k` is emitted.
//!
//! Pure functions, no I/O.

use serde_json::{Map, Value, json};

use crate::json::JsonExt;
use crate::lint::Severity;
use crate::resolve::Resolver;

/// Emits one row each time the phase crosses `k + PHASE_CROSSING` (the downstroke of a flapping wing is at the quarter point of the cycle).
pub const PHASE_CROSSING: f64 = 0.25;
/// Phase scan step (milliseconds).
pub const PHASE_STEP_MS: u64 = 1;
/// Upper bound on the span (seconds) of a single phase event `[t, until]`: 1 ms steps, so one hour is 3.6 million evaluations.
pub const PHASE_MAX_SPAN: f64 = 3600.0;
/// Maximum number of rows a single phase event may expand to.
pub const PHASE_MAX_ROWS: usize = 10_000;

/// Reserved event keys: other fields are carried through to the output row as-is.
const RESERVED: &[&str] = &["id", "t", "until", "phase"];

#[derive(Debug, Clone, PartialEq)]
pub struct EventIssue {
    pub rule: &'static str,
    pub severity: Severity,
    pub pointer: String,
    pub message: String,
}

/// The evaluated event table. `rows` is already sorted by `(t, id)`.
#[derive(Debug, Clone, Default)]
pub struct EventTable {
    pub rows: Vec<Value>,
    pub issues: Vec<EventIssue>,
}

impl EventTable {
    pub fn has_errors(&self) -> bool {
        self.issues
            .iter()
            .any(|issue| issue.severity == Severity::Error)
    }
}

/// Round to milliseconds.
pub fn round_ms(t: f64) -> f64 {
    (t * 1000.0).round() / 1000.0
}

/// Which scene a moment falls in: `[start, end)`; the final moment of the film belongs to the last scene.
pub fn scene_at(scenes: &[(String, f64, f64)], t: f64) -> Option<(&str, f64)> {
    const EPS: f64 = 1e-9;
    scenes
        .iter()
        .find(|(_, start, end)| t >= start - EPS && t < end - EPS)
        .or_else(|| {
            scenes
                .last()
                .filter(|(_, start, end)| t >= start - EPS && t <= end + EPS)
        })
        .map(|(id, start, _)| (id.as_str(), round_ms(t - start)))
}

/// Common shape of an event row: `t` / `id` / `scene` / `sceneT` plus free-form fields.
pub fn event_row(
    t: f64,
    id: &str,
    fields: &Map<String, Value>,
    scenes: &[(String, f64, f64)],
) -> Map<String, Value> {
    let mut row = Map::new();
    for (key, value) in fields {
        row.insert(key.clone(), value.clone());
    }
    let t = round_ms(t);
    row.insert("t".into(), json!(t));
    row.insert("id".into(), json!(id));
    match scene_at(scenes, t) {
        Some((scene, scene_t)) => {
            row.insert("scene".into(), json!(scene));
            row.insert("sceneT".into(), json!(scene_t));
        }
        None => {
            row.insert("scene".into(), Value::Null);
            row.insert("sceneT".into(), Value::Null);
        }
    }
    row
}

/// Sorted by `(t, id)`; equal times are ordered by id so the output is stable.
pub fn sort_rows(rows: &mut [Value]) {
    rows.sort_by(|a, b| {
        let ta = a.get("t").and_then(Value::as_f64).unwrap_or(0.0);
        let tb = b.get("t").and_then(Value::as_f64).unwrap_or(0.0);
        ta.partial_cmp(&tb)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| {
                let ia = a.get("id").and_then(Value::as_str).unwrap_or("");
                let ib = b.get("id").and_then(Value::as_str).unwrap_or("");
                ia.cmp(ib)
            })
    });
}

/// Whether the document writes `events` (an empty array counts too: the author declares "events are defined by the document").
pub fn declares_events(doc: &Value) -> bool {
    doc.get_("events").is_some_and(|value| !value.is_null())
}

/// Evaluates the whole event table. `scenes` is the IR's `(id, start, end)`, `total` is the full duration.
/// Must be called after `resolver.resolve()` (`#clip` / `~word` need the window and transcript).
pub fn resolve_events(
    resolver: &Resolver,
    scenes: &[(String, f64, f64)],
    total: f64,
) -> EventTable {
    let mut table = EventTable::default();
    let mut issue = |rule, severity, pointer: String, message: String| {
        table.issues.push(EventIssue {
            rule,
            severity,
            pointer,
            message,
        })
    };
    let mut rows = Vec::new();
    let Some(events) = resolver.doc.get_("events").filter(|v| !v.is_null()) else {
        return table;
    };
    let Some(list) = events.as_array() else {
        issue(
            "schema",
            Severity::Error,
            "/events".into(),
            "`events` must be an array".into(),
        );
        return table;
    };
    let mut seen: Vec<&str> = Vec::new();
    for (index, event) in list.iter().enumerate() {
        let ptr = format!("/events/{index}");
        let Some(map) = event.as_object() else {
            issue(
                "event-id-missing",
                Severity::Error,
                ptr,
                "each event must be an object `{ id, t, … }`".into(),
            );
            continue;
        };
        let Some(id) = map
            .get("id")
            .and_then(Value::as_str)
            .filter(|id| !id.trim().is_empty())
        else {
            issue(
                "event-id-missing",
                Severity::Error,
                format!("{ptr}/id"),
                "event is missing `id` (non-empty string)".into(),
            );
            continue;
        };
        if seen.contains(&id) {
            issue(
                "event-id-duplicate",
                Severity::Error,
                format!("{ptr}/id"),
                format!("event id \"{id}\" is duplicated"),
            );
            continue;
        }
        seen.push(id);

        let eval = |key: &str| -> Result<f64, String> {
            let expr = map.get(key).unwrap_or(&Value::Null);
            if expr.is_null() {
                return Err(format!("missing `{key}`"));
            }
            match resolver.eval_t_exact(expr) {
                Ok(Some(t)) if t.is_finite() => Ok(t),
                Ok(Some(_)) => Err(format!("`{key}` = {expr} is not a finite time")),
                Ok(None) => Err(format!("`{key}` = {expr} refers to a window that did not resolve")),
                Err(error) => Err(format!("`{key}` = {expr}：{error}")),
            }
        };
        let t = match eval("t") {
            Ok(t) => round_ms(t),
            Err(message) => {
                issue(
                    "event-time-invalid",
                    Severity::Error,
                    format!("{ptr}/t"),
                    format!("event \"{id}\": {message}"),
                );
                continue;
            }
        };
        let until = match map.get("until").filter(|v| !v.is_null()) {
            None => None,
            Some(_) => match eval("until") {
                Ok(until) if round_ms(until) >= t => Some(round_ms(until)),
                Ok(until) => {
                    issue(
                        "event-time-invalid",
                        Severity::Error,
                        format!("{ptr}/until"),
                        format!(
                            "event \"{id}\": `until` = {:.3}s is earlier than `t` = {t:.3}s",
                            round_ms(until)
                        ),
                    );
                    continue;
                }
                Err(message) => {
                    issue(
                        "event-time-invalid",
                        Severity::Error,
                        format!("{ptr}/until"),
                        format!("event \"{id}\": {message}"),
                    );
                    continue;
                }
            },
        };
        let outside = |at: f64| at < -1e-9 || at > total + 1e-9;
        if outside(t) || until.is_some_and(outside) {
            issue(
                "event-outside-doc",
                Severity::Warn,
                ptr.clone(),
                format!("event \"{id}\" falls outside the whole film [0, {total:.3}s]"),
            );
        }

        let mut fields: Map<String, Value> = map
            .iter()
            .filter(|(key, _)| !RESERVED.contains(&key.as_str()))
            .map(|(key, value)| (key.clone(), value.clone()))
            .collect();

        match map.get("phase").filter(|v| !v.is_null()) {
            None => {
                if let Some(until) = until {
                    fields.insert("until".into(), json!(until));
                }
                rows.push(Value::Object(event_row(t, id, &fields, scenes)));
            }
            Some(phase) => {
                let pointer = format!("{ptr}/phase");
                let Some(text) = phase.as_str() else {
                    issue(
                        "event-phase-invalid",
                        Severity::Error,
                        pointer,
                        format!("event \"{id}\": `phase` must be an expression string in u"),
                    );
                    continue;
                };
                let Some(until) = until else {
                    issue(
                        "event-phase-invalid",
                        Severity::Error,
                        pointer,
                        format!("event \"{id}\": a `phase` requires `until` (where the scan stops)"),
                    );
                    continue;
                };
                let expr = match PhaseExpr::parse(text) {
                    Ok(expr) => expr,
                    Err(message) => {
                        issue(
                            "event-phase-invalid",
                            Severity::Error,
                            pointer,
                            format!("event \"{id}\": phase \"{text}\": {message}"),
                        );
                        continue;
                    }
                };
                match phase_crossings(&expr, until - t) {
                    Ok(crossings) => {
                        fields.insert("event".into(), json!(id));
                        for (u, k) in crossings {
                            let mut row_fields = fields.clone();
                            row_fields.insert("phaseIndex".into(), json!(k));
                            rows.push(Value::Object(event_row(
                                t + u,
                                &format!("{id}#{k}"),
                                &row_fields,
                                scenes,
                            )));
                        }
                    }
                    Err(message) => issue(
                        "event-phase-invalid",
                        Severity::Error,
                        pointer,
                        format!("event \"{id}\": phase \"{text}\": {message}"),
                    ),
                }
            }
        }
    }
    sort_rows(&mut rows);
    table.rows = rows;
    table
}

/// Scans `u ∈ (0, span]` in 1 ms steps, returning each `(u, k)` where the phase first crosses `k + 0.25` upward.
/// If several integers are crossed within the same millisecond, that many rows are emitted; after the phase falls back and rises again, nothing is repeated (only new highs count).
pub fn phase_crossings(expr: &PhaseExpr, span: f64) -> Result<Vec<(f64, i64)>, String> {
    if !(span >= 0.0) || span > PHASE_MAX_SPAN {
        return Err(format!("scan span {span:.3}s is outside 0–{PHASE_MAX_SPAN}s"));
    }
    let level = |u: f64| -> Result<i64, String> {
        let value = expr.eval(u);
        if !value.is_finite() {
            return Err(format!("phase at u = {u:.3} is not a finite number"));
        }
        Ok(libm::floor(value - PHASE_CROSSING) as i64)
    };
    let steps = libm::round(span * 1000.0) as u64 / PHASE_STEP_MS;
    let mut high = level(0.0)?;
    let mut out = Vec::new();
    for step in 1..=steps {
        let u = (step * PHASE_STEP_MS) as f64 / 1000.0;
        let k = level(u)?;
        while high < k {
            high += 1;
            out.push((u, high));
            if out.len() > PHASE_MAX_ROWS {
                return Err(format!("expansion exceeds {PHASE_MAX_ROWS} rows"));
            }
        }
    }
    Ok(out)
}

/// `phase` expression: an arithmetic expression in `u`, parsed once at compile time and evaluated repeatedly during the scan.
#[derive(Debug, Clone, PartialEq)]
pub enum PhaseExpr {
    Num(f64),
    U,
    Neg(Box<PhaseExpr>),
    Bin(char, Box<PhaseExpr>, Box<PhaseExpr>),
    Call(PhaseFn, Vec<PhaseExpr>),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PhaseFn {
    Sin,
    Cos,
    Pow,
    Floor,
}

impl PhaseFn {
    fn parse(name: &str) -> Option<(Self, usize)> {
        Some(match name {
            "sin" => (Self::Sin, 1),
            "cos" => (Self::Cos, 1),
            "floor" => (Self::Floor, 1),
            "pow" => (Self::Pow, 2),
            _ => return None,
        })
    }
}

impl PhaseExpr {
    pub fn parse(text: &str) -> Result<PhaseExpr, String> {
        let tokens = tokenize(text)?;
        let mut parser = Parser { tokens, pos: 0 };
        let expr = parser.expr()?;
        if parser.pos != parser.tokens.len() {
            return Err(format!("unexpected {:?}", parser.tokens[parser.pos]));
        }
        Ok(expr)
    }

    pub fn eval(&self, u: f64) -> f64 {
        match self {
            Self::Num(n) => *n,
            Self::U => u,
            Self::Neg(inner) => -inner.eval(u),
            Self::Bin(op, a, b) => {
                let (a, b) = (a.eval(u), b.eval(u));
                match op {
                    '+' => a + b,
                    '-' => a - b,
                    '*' => a * b,
                    _ => a / b,
                }
            }
            Self::Call(f, args) => match f {
                PhaseFn::Sin => libm::sin(args[0].eval(u)),
                PhaseFn::Cos => libm::cos(args[0].eval(u)),
                PhaseFn::Floor => libm::floor(args[0].eval(u)),
                PhaseFn::Pow => libm::pow(args[0].eval(u), args[1].eval(u)),
            },
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
enum Token {
    Num(f64),
    Ident(String),
    Sym(char),
}

fn tokenize(text: &str) -> Result<Vec<Token>, String> {
    let chars: Vec<char> = text.chars().collect();
    let mut out = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if c.is_whitespace() {
            i += 1;
        } else if c.is_ascii_digit() || c == '.' {
            let start = i;
            while i < chars.len() && (chars[i].is_ascii_digit() || chars[i] == '.') {
                i += 1;
            }
            let literal: String = chars[start..i].iter().collect();
            let value = literal
                .parse::<f64>()
                .map_err(|_| format!("malformed number \"{literal}\""))?;
            out.push(Token::Num(value));
        } else if c.is_ascii_alphabetic() {
            let start = i;
            while i < chars.len() && chars[i].is_ascii_alphanumeric() {
                i += 1;
            }
            out.push(Token::Ident(chars[start..i].iter().collect()));
        } else if "+-*/(),".contains(c) {
            out.push(Token::Sym(c));
            i += 1;
        } else {
            return Err(format!(
                "unknown character '{c}' (only + - * / ( ), numbers, u and sin / cos / pow / floor are allowed)"
            ));
        }
    }
    if out.is_empty() {
        return Err("expression is empty".into());
    }
    Ok(out)
}

struct Parser {
    tokens: Vec<Token>,
    pos: usize,
}

impl Parser {
    fn peek(&self) -> Option<&Token> {
        self.tokens.get(self.pos)
    }

    fn eat(&mut self, sym: char) -> bool {
        if self.peek() == Some(&Token::Sym(sym)) {
            self.pos += 1;
            true
        } else {
            false
        }
    }

    fn expr(&mut self) -> Result<PhaseExpr, String> {
        let mut left = self.term()?;
        loop {
            let op = if self.eat('+') {
                '+'
            } else if self.eat('-') {
                '-'
            } else {
                return Ok(left);
            };
            left = PhaseExpr::Bin(op, Box::new(left), Box::new(self.term()?));
        }
    }

    fn term(&mut self) -> Result<PhaseExpr, String> {
        let mut left = self.unary()?;
        loop {
            let op = if self.eat('*') {
                '*'
            } else if self.eat('/') {
                '/'
            } else {
                return Ok(left);
            };
            left = PhaseExpr::Bin(op, Box::new(left), Box::new(self.unary()?));
        }
    }

    fn unary(&mut self) -> Result<PhaseExpr, String> {
        if self.eat('-') {
            return Ok(PhaseExpr::Neg(Box::new(self.unary()?)));
        }
        if self.eat('+') {
            return self.unary();
        }
        self.primary()
    }

    fn primary(&mut self) -> Result<PhaseExpr, String> {
        let Some(token) = self.peek().cloned() else {
            return Err("expression is incomplete".into());
        };
        self.pos += 1;
        match token {
            Token::Num(n) => Ok(PhaseExpr::Num(n)),
            Token::Sym('(') => {
                let inner = self.expr()?;
                if !self.eat(')') {
                    return Err("missing closing parenthesis".into());
                }
                Ok(inner)
            }
            Token::Ident(name) if name == "u" => Ok(PhaseExpr::U),
            Token::Ident(name) => {
                let (f, arity) = PhaseFn::parse(&name).ok_or_else(|| {
                    format!("unknown name \"{name}\" (only u and sin / cos / pow / floor are allowed)")
                })?;
                if !self.eat('(') {
                    return Err(format!("{name} must be followed by parentheses"));
                }
                let mut args = vec![self.expr()?];
                while self.eat(',') {
                    args.push(self.expr()?);
                }
                if !self.eat(')') {
                    return Err(format!("{name}(…) is missing a closing parenthesis"));
                }
                if args.len() != arity {
                    return Err(format!("{name} takes {arity} argument(s), got {}", args.len()));
                }
                Ok(PhaseExpr::Call(f, args))
            }
            Token::Sym(c) => Err(format!("unexpected '{c}' here")),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn phase_expressions_parse_and_evaluate_with_precedence() {
        let expr = PhaseExpr::parse("u*2.6+0.2").unwrap();
        assert!((expr.eval(1.0) - 2.8).abs() < 1e-12);
        let expr = PhaseExpr::parse("-(u - 1) * 2 / 4 + pow(2, 3) + floor(1.7)").unwrap();
        assert!((expr.eval(3.0) - (-1.0 + 8.0 + 1.0)).abs() < 1e-12);
        let expr = PhaseExpr::parse("sin(u) + cos(0)").unwrap();
        assert!((expr.eval(0.0) - 1.0).abs() < 1e-12);
    }

    #[test]
    fn phase_expressions_reject_anything_outside_the_whitelist() {
        for bad in [
            "",
            "u +",
            "exp(u)",
            "u ** 2",
            "pow(u)",
            "sin u",
            "(u",
            "u; 1",
            "Math.sin(u)",
        ] {
            assert!(PhaseExpr::parse(bad).is_err(), "{bad}");
        }
    }

    /// Phase `u*2.6+0.2` crosses k+0.25 at u = (k + 0.05)/2.6: the scan picks up the first millisecond after that.
    #[test]
    fn crossings_are_found_on_the_millisecond_grid() {
        let expr = PhaseExpr::parse("u*2.6+0.2").unwrap();
        let crossings = phase_crossings(&expr, 2.6).unwrap();
        let expected: Vec<(f64, i64)> = (0..7)
            .map(|k| {
                let exact = (k as f64 + 0.05) / 2.6;
                (libm::ceil(exact * 1000.0 - 1e-9) / 1000.0, k)
            })
            .filter(|(u, _)| *u <= 2.6)
            .collect();
        assert_eq!(crossings.len(), expected.len());
        for ((u, k), (eu, ek)) in crossings.iter().zip(&expected) {
            assert_eq!(k, ek);
            assert!((u - eu).abs() < 1e-9, "{u} vs {eu}");
        }
        // After falling back and rising again, no repeated rows.
        let wobble = PhaseExpr::parse("sin(u*6.283185307179586)").unwrap();
        assert_eq!(phase_crossings(&wobble, 3.0).unwrap().len(), 1);
    }
}
