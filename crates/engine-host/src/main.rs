//! Engine Host process entry point (architecture design §2.3).
//!
//! stdin takes one request per line `{"id", "method", "params"}`; stdout writes one response per line `{"id", "result"}` / `{"id", "error"}`,
//! or one push `{"event": "video.event", "params": VideoEvent}`. A push is always written before the response that triggered it.
//! stdout carries only the protocol; logs go to stderr. The process exits when stdin closes (Runtime exits) or when stdout can no longer be written; the lock is released with the process.
//!
//! Requests are handled in arrival order, with one exception: `fonts.*` (parsing, listing family names, checking font files) is handed to the font thread ([`fonts::FontWorker`]). The first time, it scans the machine's installed fonts once; during that time other requests proceed as usual, and its responses are written later (the Runtime pairs responses by `id` and does not require order). When stdin closes, it waits for the font requests already received to finish before exiting.

#![allow(clippy::result_large_err)]

mod barrier;
mod content;
mod exports;
mod fonts;
mod host;
mod package;

use std::io::{self, BufRead, BufWriter, Write};
use std::panic::{AssertUnwindSafe, catch_unwind};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use message_ref::msg;
use serde_json::{Value, json};
use video_engine::{ErrorBody, Retryability};

/// stdout: shared by the main loop and the font thread; each line is written in full while holding the lock.
#[derive(Clone)]
pub struct Output(Arc<Mutex<Box<dyn Write + Send>>>);

impl Output {
    fn stdout() -> Output {
        Output::new(Box::new(BufWriter::new(io::stdout())))
    }

    pub fn new(writer: Box<dyn Write + Send>) -> Output {
        Output(Arc::new(Mutex::new(writer)))
    }

    /// Writes a line and flushes it. Exits when it cannot be written: the Runtime no longer reads, so no one can receive replies, and continuing to run would only hold the lock.
    pub fn write_line(&self, value: &Value) {
        let mut out = self.0.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        let ok = serde_json::to_writer(&mut **out, value).is_ok() && out.write_all(b"\n").is_ok() && out.flush().is_ok();
        if !ok {
            std::process::exit(0);
        }
    }
}

/// Reply for a crash while handling a request.
pub fn panic_response(id: Value, method: &str) -> Value {
    eprintln!("engine-host: crashed while handling {method}");
    let error = ErrorBody::new(
        "ENGINE_PANIC",
        msg!(
            "engineHost.enginePanic",
            "The engine failed while handling the request, and the change was not committed"
        ),
        Retryability::SameCommand,
    );
    json!({ "id": id, "error": error })
}

fn main() {
    let ffprobe = PathBuf::from(std::env::var("CUCCUT_FFPROBE").unwrap_or_else(|_| "ffprobe".into()));
    let mut host = host::Host::new(ffprobe);
    let out = Output::stdout();
    let mut fonts = fonts::FontWorker::new(out.clone());
    let stdin = io::stdin();

    for line in stdin.lock().lines() {
        let Ok(line) = line else { break };
        if line.trim().is_empty() {
            continue;
        }
        let request: Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(e) => {
                eprintln!("engine-host: cannot parse request: {e}");
                continue;
            }
        };
        let id = request.get("id").cloned().unwrap_or(Value::Null);
        let method = request.get("method").and_then(Value::as_str).unwrap_or("").to_string();
        let params = request.get("params").cloned().unwrap_or_else(|| json!({}));
        if method.starts_with("fonts.") {
            fonts.submit(id, &method, params);
            continue;
        }

        let mut events = Vec::new();
        let outcome = catch_unwind(AssertUnwindSafe(|| host.handle(&method, params, &mut |e| events.push(e.clone()))));
        for event in events {
            out.write_line(&json!({ "event": "video.event", "params": event }));
        }
        let response = match outcome {
            Ok(Ok(result)) => json!({ "id": id, "result": result }),
            Ok(Err(error)) => json!({ "id": id, "error": error }),
            Err(_) => panic_response(id, &method),
        };
        out.write_line(&response);
    }
    fonts.finish();
}
