//! `face-detect <model.onnx>`: JSON lines over stdio, the same shape as Engine Host and Model Worker (`JsonLineWorker` of `process-host`).
//!
//! - After loading the model, pushes `{"event":"ready","params":{"loadMs":…}}`. On load failure, it writes the reason to stderr and exits with 1 (in-flight requests then fail).
//! - Request `{"id":1,"method":"detect","params":{"file":"<absolute path of a PNG or JPEG>"}}`,
//!   response `{"id":1,"result":{"faces":[{x,y,w,h,score}],"width":…,"height":…,"ms":…}}`. An unreadable image or an inference failure is `{"id":1,"error":{"code":"DETECT_FAILED","message":…}}`, an unknown method is `UNKNOWN_METHOD`, and a malformed shape is `INVALID_REQUEST`.
//! - Exits when stdin closes.
//!
//! Error descriptions are developer text for the Runtime log, not UI text shown to people.

use std::io::{self, BufRead, Write};
use std::path::PathBuf;
use std::time::Instant;

use face_detect::FaceDetector;
use serde::Deserialize;
use serde_json::{Value, json};

#[derive(Deserialize)]
struct Request {
    id: Value,
    method: String,
    #[serde(default)]
    params: Value,
}

#[derive(Deserialize)]
struct DetectParams {
    file: PathBuf,
}

fn main() {
    let Some(model) = std::env::args_os().nth(1).map(PathBuf::from) else {
        eprintln!("usage: face-detect <model.onnx>");
        std::process::exit(2);
    };
    let started = Instant::now();
    let detector = match FaceDetector::load(&model) {
        Ok(detector) => detector,
        Err(error) => {
            eprintln!("cannot load model {}: {error:#}", model.display());
            std::process::exit(1);
        }
    };
    let stdout = io::stdout();
    let mut out = stdout.lock();
    emit(
        &mut out,
        json!({ "event": "ready", "params": { "loadMs": started.elapsed().as_millis() as u64 } }),
    );
    for line in io::stdin().lock().lines() {
        let Ok(line) = line else { break };
        if line.trim().is_empty() {
            continue;
        }
        let request = match serde_json::from_str::<Request>(&line) {
            Ok(request) => request,
            Err(error) => {
                eprintln!("bad request line: {error}");
                continue;
            }
        };
        let reply = match handle(&detector, &request) {
            Ok(result) => json!({ "id": request.id, "result": result }),
            Err((code, message)) => json!({ "id": request.id, "error": { "code": code, "message": message } }),
        };
        emit(&mut out, reply);
    }
}

fn handle(detector: &FaceDetector, request: &Request) -> Result<Value, (&'static str, String)> {
    if request.method != "detect" {
        return Err(("UNKNOWN_METHOD", format!("unknown method {}", request.method)));
    }
    let params: DetectParams = serde_json::from_value(request.params.clone()).map_err(|error| ("INVALID_REQUEST", error.to_string()))?;
    let started = Instant::now();
    let (faces, width, height) = detector
        .detect_file(&params.file)
        .map_err(|error| ("DETECT_FAILED", format!("{error:#}")))?;
    Ok(json!({
        "faces": faces,
        "width": width,
        "height": height,
        "ms": started.elapsed().as_millis() as u64,
    }))
}

fn emit(out: &mut impl Write, value: Value) {
    // Once stdout is closed (the parent has gone), there is nothing left to do.
    if writeln!(out, "{value}").and_then(|()| out.flush()).is_err() {
        std::process::exit(0);
    }
}
