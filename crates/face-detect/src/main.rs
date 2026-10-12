//! `face-detect <model.onnx>`：stdio 的 JSON 行，与 Engine Host、Model Worker 同一套形状（`process-host` 的 `JsonLineWorker`）。
//!
//! - 载入模型后推送 `{"event":"ready","params":{"loadMs":…}}`；载入失败时在 stderr 写原因、以 1 退出（在途请求随之失败）。
//! - 请求 `{"id":1,"method":"detect","params":{"file":"<PNG 或 JPEG 的绝对路径>"}}`，
//!   响应 `{"id":1,"result":{"faces":[{x,y,w,h,score}],"width":…,"height":…,"ms":…}}`；
//!   读不了的图或推理失败是 `{"id":1,"error":{"code":"DETECT_FAILED","message":…}}`，不认识的方法 `UNKNOWN_METHOD`，形状不对 `INVALID_REQUEST`。
//! - stdin 关闭即退出。
//!
//! 错误说明是给 Runtime 日志看的开发者文字，不是给人看的界面文字。

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
    // stdout 关了（父进程走了）就没什么可做的了。
    if writeln!(out, "{value}").and_then(|()| out.flush()).is_err() {
        std::process::exit(0);
    }
}
