//! Speech Worker (architecture design §7.9, §13.1): a separate process for the subtitle and translation core (`speech-doc`). One is started per step of a fixed flow;
//! it exits when it finishes. The protocol is in the command protocol spec §4.5.
//!
//! - stdin / stdout carry JSON lines: `hello`, `translate` (frozen input and the staging directory), `llm.reply`, `cancel`;
//!   the Worker pushes `llm.request`, `progress`, `checkpoint`, and `resumed` events, and a task ends with the result or error of `translate`.
//! - All model calls are handed back to the Runtime (`llm.request` → `llm.reply`). The Worker does no networking, holds no keys, and only writes to staging.
//! - When stdin closes (the Runtime exits or gives up on this process), the running task stops before the next model call or backoff, the checkpoint is kept, and the process exits.

mod checkpoint;
mod input;
mod llm;
mod protocol;
mod translate;

use std::cell::RefCell;
use std::path::PathBuf;
use std::process::ExitCode;
use std::rc::Rc;

use serde_json::{Value, json};

use protocol::{Control, Inbound, hello, respond, respond_error};

/// Failure: the protocol's error codes and descriptions.
#[derive(Debug)]
pub struct Failure {
    pub code: String,
    pub message: String,
    pub details: Value,
}

impl Failure {
    pub fn new(code: &str, message: impl Into<String>) -> Failure {
        Failure {
            code: code.into(),
            message: message.into(),
            details: Value::Null,
        }
    }

    pub fn with_details(code: &str, message: impl Into<String>, details: Value) -> Failure {
        Failure {
            code: code.into(),
            message: message.into(),
            details,
        }
    }
}

fn main() -> ExitCode {
    if std::env::args().len() > 1 {
        eprintln!("用法：speech-worker（stdin / stdout 上的 JSON 行，见命令协议规范 §4.5）");
        return ExitCode::from(2);
    }
    let control = Rc::new(RefCell::new(Control::new(protocol::spawn_reader())));
    loop {
        let message = control.borrow_mut().next();
        match message {
            Inbound::Closed => return ExitCode::SUCCESS,
            Inbound::Malformed { line } => eprintln!("speech-worker: 读不懂的一行输入（{} 字节）", line.len()),
            Inbound::Request { id, method, params } => match method.as_str() {
                "hello" => respond(&id, hello()),
                // Cancel while idle: there is no task to stop.
                "cancel" => {
                    if !id.is_null() {
                        respond(&id, json!({}));
                    }
                }
                "translate" => {
                    control.borrow_mut().reset();
                    match job_paths(&params) {
                        Ok((input, staging)) => match translate::run(&input, &staging, control.clone()) {
                            Ok(result) => respond(&id, result),
                            Err(failure) => respond_error(&id, &failure.code, &failure.message, failure.details),
                        },
                        Err(failure) => respond_error(&id, &failure.code, &failure.message, failure.details),
                    }
                    if control.borrow().closed() {
                        return ExitCode::SUCCESS;
                    }
                }
                "llm.reply" => respond_error(&id, "UNEXPECTED_REPLY", "没有在等模型调用的应答", Value::Null),
                other => respond_error(&id, "METHOD_NOT_FOUND", &format!("没有方法 {other}"), Value::Null),
            },
        }
    }
}

fn job_paths(params: &Value) -> Result<(PathBuf, PathBuf), Failure> {
    let path = |key: &str| {
        params
            .get(key)
            .and_then(Value::as_str)
            .filter(|value| !value.is_empty())
            .map(PathBuf::from)
            .ok_or_else(|| Failure::new("INVALID_PARAMS", format!("translate 缺少 {key}")))
    };
    Ok((path("input")?, path("staging")?))
}
