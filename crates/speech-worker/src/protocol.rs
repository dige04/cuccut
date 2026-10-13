//! JSON lines over stdio (Speech Worker protocol, command protocol spec §4.5).
//!
//! The shape is the same as Model Worker and Engine Host: the Runtime sends `{id, method, params}`, the Worker replies `{id, result}` / `{id, error}`,
//! and the Worker pushes `{event, params}` on its own. A reader thread reads stdin, parses it line by line and puts it on a channel. The main thread takes from the channel while waiting for a model reply, during backoff, and between two pages.
//! Closing stdin (the Runtime exits or gives up on this process) is `Closed`: a running task is treated as cancelled, and the process exits once it has finished handling.

use std::collections::VecDeque;
use std::io::{BufRead, Write};
use std::sync::mpsc::{Receiver, RecvTimeoutError, channel};
use std::time::{Duration, Instant};

use serde_json::{Value, json};

/// The protocol's name and version, given in the result of `hello`. If the Runtime does not recognize it, it does not use this Worker.
pub const PROTOCOL: &str = "speech-worker/1";

/// One input handed over by the reader thread.
#[derive(Debug)]
pub enum Inbound {
    Request {
        id: Value,
        method: String,
        params: Value,
    },
    /// A line that is not a JSON object, or is missing `method`.
    Malformed {
        line: String,
    },
    Closed,
}

/// One line of JSON on stdout. A write failure (the Runtime is already gone) is not reported as an error: the reader thread will then see stdin close.
pub fn emit(value: &Value) {
    let mut out = std::io::stdout().lock();
    let _ = writeln!(out, "{value}");
    let _ = out.flush();
}

pub fn event(name: &str, params: Value) {
    emit(&json!({ "event": name, "params": params }));
}

pub fn respond(id: &Value, result: Value) {
    emit(&json!({ "id": id, "result": result }));
}

pub fn respond_error(id: &Value, code: &str, message: &str, details: Value) {
    let mut error = json!({ "code": code, "message": message });
    if !details.is_null() {
        error["details"] = details;
    }
    emit(&json!({ "id": id, "error": error }));
}

/// Starts the reader thread: one line per message. When reading finishes or fails, it hands over a `Closed`.
pub fn spawn_reader() -> Receiver<Inbound> {
    let (tx, rx) = channel();
    std::thread::spawn(move || {
        let stdin = std::io::stdin();
        for line in stdin.lock().lines() {
            let Ok(line) = line else { break };
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            // Like export-worker, it also recognizes a bare `cancel` line.
            let message = if trimmed == "cancel" {
                Inbound::Request {
                    id: Value::Null,
                    method: "cancel".into(),
                    params: Value::Null,
                }
            } else {
                match serde_json::from_str::<Value>(trimmed) {
                    Ok(Value::Object(mut object)) => match object.remove("method") {
                        Some(Value::String(method)) => Inbound::Request {
                            id: object.remove("id").unwrap_or(Value::Null),
                            method,
                            params: object.remove("params").unwrap_or(Value::Null),
                        },
                        _ => Inbound::Malformed { line: trimmed.to_owned() },
                    },
                    _ => Inbound::Malformed { line: trimmed.to_owned() },
                }
            };
            if tx.send(message).is_err() {
                return;
            }
        }
        let _ = tx.send(Inbound::Closed);
    });
    rx
}

/// The reply to one model call (the parameters of `llm.reply`).
#[derive(Debug, Clone, PartialEq)]
pub enum Reply {
    Text(String),
    Error(ReplyError),
}

/// A failure given by the Runtime. `class` decides how the core handles it (retryable, answer unusable, terminal, cancelled).
#[derive(Debug, Clone, PartialEq)]
pub struct ReplyError {
    pub code: String,
    pub message: String,
    pub class: ErrorClass,
    /// The HTTP status carried by a retryable failure. When there is none, it counts as a transport failure (0).
    pub status: Option<u16>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorClass {
    Retryable,
    Malformed,
    Terminal,
    Cancelled,
}

impl ErrorClass {
    fn parse(value: &str) -> Option<ErrorClass> {
        match value {
            "retryable" => Some(ErrorClass::Retryable),
            "malformed" => Some(ErrorClass::Malformed),
            "terminal" => Some(ErrorClass::Terminal),
            "cancelled" => Some(ErrorClass::Cancelled),
            _ => None,
        }
    }
}

/// Outcome of waiting for a reply.
#[derive(Debug)]
pub enum Waited {
    Reply(Reply),
    /// A `cancel` was received, or stdin closed.
    Stopped,
}

/// The channel for a running task: the cancel and close state, waiting for replies, and backoff that can be cancelled.
pub struct Control {
    rx: Receiver<Inbound>,
    /// Requests that arrive while waiting for a reply and are unrelated to that wait (for example, the next `translate`). They are handled by the main loop after the task ends.
    deferred: VecDeque<Inbound>,
    cancelled: bool,
    closed: bool,
}

impl Control {
    pub fn new(rx: Receiver<Inbound>) -> Control {
        Control {
            rx,
            deferred: VecDeque::new(),
            cancelled: false,
            closed: false,
        }
    }

    /// A `cancel` has been received, or stdin has already closed.
    pub fn stopped(&self) -> bool {
        self.cancelled || self.closed
    }

    pub fn closed(&self) -> bool {
        self.closed
    }

    /// A new task starts: clears the cancel left by the previous task.
    pub fn reset(&mut self) {
        self.cancelled = false;
    }

    /// The main loop takes the next input (taking those queued during the task first).
    pub fn next(&mut self) -> Inbound {
        if let Some(message) = self.deferred.pop_front() {
            return message;
        }
        self.rx.recv().unwrap_or(Inbound::Closed)
    }

    /// Handles the inputs that have already arrived, without blocking.
    pub fn poll(&mut self) {
        while let Ok(message) = self.rx.try_recv() {
            self.handle_busy(message, None);
        }
    }

    /// Blocks until the reply for `request_id`, a cancel, or stdin closing.
    pub fn wait_reply(&mut self, request_id: u64) -> Waited {
        loop {
            if self.stopped() {
                return Waited::Stopped;
            }
            let message = self.rx.recv().unwrap_or(Inbound::Closed);
            if let Some(reply) = self.handle_busy(message, Some(request_id)) {
                return Waited::Reply(reply);
            }
        }
    }

    /// Backoff: waits at most `seconds` seconds. Inputs are handled as usual in the meantime, and it returns immediately on cancel or close.
    pub fn sleep(&mut self, seconds: f64) {
        if seconds.is_nan() || seconds <= 0.0 {
            self.poll();
            return;
        }
        let deadline = Instant::now() + Duration::from_secs_f64(seconds.min(600.0));
        while !self.stopped() {
            let now = Instant::now();
            if now >= deadline {
                return;
            }
            match self.rx.recv_timeout(deadline - now) {
                Ok(message) => {
                    self.handle_busy(message, None);
                }
                Err(RecvTimeoutError::Timeout) => return,
                Err(RecvTimeoutError::Disconnected) => self.closed = true,
            }
        }
    }

    /// Handles one input received while a task is running. Returns the reply for the call being waited on.
    fn handle_busy(&mut self, message: Inbound, waiting: Option<u64>) -> Option<Reply> {
        match message {
            Inbound::Closed => {
                self.closed = true;
                None
            }
            Inbound::Malformed { line } => {
                eprintln!("speech-worker: 读不懂的一行输入（{} 字节）", line.len());
                None
            }
            Inbound::Request { id, method, params } => match method.as_str() {
                "cancel" => {
                    self.cancelled = true;
                    if !id.is_null() {
                        respond(&id, json!({}));
                    }
                    None
                }
                "hello" => {
                    respond(&id, hello());
                    None
                }
                "llm.reply" => match parse_reply(&params) {
                    Ok((request_id, reply)) if Some(request_id) == waiting => {
                        respond(&id, json!({}));
                        Some(reply)
                    }
                    Ok((request_id, _)) => {
                        respond_error(
                            &id,
                            "UNEXPECTED_REPLY",
                            "没有在等这次模型调用的应答",
                            json!({ "requestId": request_id }),
                        );
                        None
                    }
                    Err(problem) => {
                        respond_error(&id, "INVALID_PARAMS", &problem, Value::Null);
                        None
                    }
                },
                _ => {
                    // Only one task runs at a time: other requests wait until this task ends and are then handled by the main loop.
                    self.deferred.push_back(Inbound::Request { id, method, params });
                    None
                }
            },
        }
    }
}

/// Result of `hello`.
pub fn hello() -> Value {
    json!({
        "protocol": PROTOCOL,
        "version": env!("CARGO_PKG_VERSION"),
        "methods": ["translate"],
    })
}

fn parse_reply(params: &Value) -> Result<(u64, Reply), String> {
    let request_id = params.get("requestId").and_then(Value::as_u64).ok_or("llm.reply 缺少 requestId")?;
    if let Some(text) = params.get("text").and_then(Value::as_str) {
        return Ok((request_id, Reply::Text(text.to_owned())));
    }
    let error = params.get("error").ok_or("llm.reply 既没有 text 也没有 error")?;
    let class = error
        .get("class")
        .and_then(Value::as_str)
        .and_then(ErrorClass::parse)
        .ok_or("llm.reply 的 error.class 应为 retryable、malformed、terminal 或 cancelled")?;
    let text = |key: &str| error.get(key).and_then(Value::as_str).unwrap_or_default().to_owned();
    Ok((
        request_id,
        Reply::Error(ReplyError {
            code: text("code"),
            message: text("message"),
            class,
            status: error
                .get("status")
                .and_then(Value::as_u64)
                .and_then(|status| u16::try_from(status).ok()),
        }),
    ))
}
