//! Render Worker (architecture design §9.13): the standalone process for final export. The Runtime writes the frozen export input (a JSON file) and calls it in two steps:
//!
//! - `export-worker preflight <input.json>`: preflight; the result is one JSON object on stdout (frame count, items that cannot be drawn, warnings, missing encoders,
//!   and the local font faces to be used, which the Runtime uses to freeze fonts);
//! - `export-worker render <input.json>`: computes the plan frame by frame (`render-graph`), draws each frame (`frame-render`), and writes it into the encoder (`media-core`).
//!   stdout is JSON lines: `progress` (frames drawn and handed to the encode queue, and the total frame count), then a final line `done`, `error`, or `cancelled`;
//! - `export-worker census <input.json>`: lays out text once only, to tally the fonts the video uses (`fonts.usage`). stdout is one JSON object listing all named faces (`bundled` marks those shipped with the kernel) and the kernel's fallback families (`fallback`);
//! - `export-worker master <input.json>`: when loudness normalization is on, makes the mixed audio reach the target loudness ([`master`]). stdout is likewise JSON lines, with `mastered` as the final line.
//!
//! When stdin receives a `cancel` line or is closed (Runtime exits), it cancels: it stops the synthesis, kills the decode and encode child processes, and deletes the unfinished output.
//! Being a separate process keeps synthesis crashes and memory use from affecting the Runtime and the engine host. The engine host keeps handling edit requests as usual, and the export reads input frozen at startup.

mod delivery;
mod input;
mod master;
mod native;
mod preflight;
mod render;
mod sources;

use std::io::Write;
use std::path::PathBuf;
use std::process::ExitCode;

use serde_json::{Value, json};

/// Failure: the protocol's error code and description.
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
}

/// One line of JSON on stdout.
pub fn emit(value: &Value) {
    let mut out = std::io::stdout().lock();
    let _ = writeln!(out, "{value}");
    let _ = out.flush();
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let (command, path) = match args.as_slice() {
        [command, path] if matches!(command.as_str(), "preflight" | "census" | "render" | "master") => {
            (command.as_str(), PathBuf::from(path))
        }
        _ => {
            eprintln!("用法：export-worker preflight|census|render|master <input.json>");
            return ExitCode::from(2);
        }
    };
    let result = match command {
        "preflight" => preflight_command(&path),
        "census" => census_command(&path),
        "master" => master::run(&path),
        _ => render::run(&path),
    };
    match result {
        Ok(code) => code,
        Err(failure) => {
            emit(&json!({
                "event": "error",
                "code": failure.code,
                "message": failure.message,
                "details": failure.details,
            }));
            ExitCode::from(1)
        }
    }
}

fn census_command(path: &std::path::Path) -> Result<ExitCode, Failure> {
    let input = input::Input::load(path)?;
    let usage = preflight::font_usage(&input)?;
    let faces: Vec<Value> = usage
        .faces
        .iter()
        .map(|(family, weight, italic)| {
            json!({ "family": family, "weight": weight, "italic": italic, "bundled": !usage.missing.contains(family) })
        })
        .collect();
    emit(&json!({ "event": "census", "faces": faces, "fallback": frame_render::FALLBACK_FAMILY }));
    Ok(ExitCode::SUCCESS)
}

fn preflight_command(path: &std::path::Path) -> Result<ExitCode, Failure> {
    let input = input::Input::load(path)?;
    let tools = input.tools();
    let report = preflight::run(&input, &tools)?;
    let faces: Vec<Value> = preflight::font_faces(&input)?
        .into_iter()
        .map(|(family, weight, italic)| json!({ "family": family, "weight": weight, "italic": italic }))
        .collect();
    emit(&json!({
        "event": "preflight",
        "frames": report.frames,
        "items": report.items,
        "warnings": report.warnings,
        "missingEncoders": report.missing_encoders,
        "faces": faces,
    }));
    Ok(ExitCode::SUCCESS)
}
