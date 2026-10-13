//! Drives a real `model-worker` process in tests: writes requests, reads events and responses with timeouts, and waits for it to exit.

#![allow(dead_code)]

use std::io::{BufRead, BufReader, Write};
use std::path::Path;
use std::process::{Child, ChildStdin, Command, ExitStatus, Stdio};
use std::sync::mpsc::{Receiver, RecvTimeoutError, channel};
use std::time::{Duration, Instant};

use serde_json::{Value, json};

pub const BINARY: &str = env!("CARGO_BIN_EXE_model-worker");

pub struct WorkerProcess {
    child: Child,
    stdin: Option<ChildStdin>,
    lines: Receiver<Value>,
    next_id: u64,
}

impl WorkerProcess {
    /// Start it with this test process as the parent.
    pub fn spawn() -> Self {
        Self::spawn_with_parent(std::process::id())
    }

    pub fn spawn_with_parent(parent_pid: u32) -> Self {
        let mut child = Command::new(BINARY)
            .arg("--parent-pid")
            .arg(parent_pid.to_string())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .expect("spawn model-worker");
        let stdout = child.stdout.take().expect("stdout");
        let (sender, lines) = channel();
        std::thread::spawn(move || {
            for line in BufReader::new(stdout).lines() {
                let Ok(line) = line else { break };
                let value: Value = serde_json::from_str(&line).unwrap_or_else(|error| panic!("stdout is not JSON ({error}): {line}"));
                if sender.send(value).is_err() {
                    break;
                }
            }
        });
        let stdin = child.stdin.take();
        Self {
            child,
            stdin,
            lines,
            next_id: 1,
        }
    }

    pub fn send_raw(&mut self, line: &str) {
        self.try_send_raw(line).expect("write to model-worker stdin");
    }

    /// Write one line. The worker may exit midway (the pipe breaks), and the caller decides whether that matters.
    pub fn try_send_raw(&mut self, line: &str) -> std::io::Result<()> {
        let stdin = self.stdin.as_mut().expect("stdin open");
        stdin.write_all(line.as_bytes())?;
        stdin.write_all(b"\n")?;
        stdin.flush()
    }

    /// Send one request and return its id.
    pub fn send(&mut self, method: &str, params: Value) -> u64 {
        let id = self.next_id;
        self.next_id += 1;
        self.send_raw(&json!({ "id": id, "method": method, "params": params }).to_string());
        id
    }

    /// The next line of output (an event or a response).
    pub fn next(&self, timeout: Duration) -> Value {
        match self.lines.recv_timeout(timeout) {
            Ok(value) => value,
            Err(RecvTimeoutError::Timeout) => panic!("no output from model-worker within {timeout:?}"),
            Err(RecvTimeoutError::Disconnected) => panic!("model-worker closed stdout"),
        }
    }

    /// Read until the response with `id` arrives, and return the events and responses seen along the way, plus the response itself.
    pub fn response(&self, id: u64, timeout: Duration) -> (Vec<Value>, Value) {
        let deadline = Instant::now() + timeout;
        let mut events = Vec::new();
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            let message = self.next(remaining.max(Duration::from_millis(1)));
            if message.get("id").and_then(Value::as_u64) == Some(id) {
                return (events, message);
            }
            events.push(message);
        }
    }

    /// Send a request and wait for its response.
    pub fn call(&mut self, method: &str, params: Value, timeout: Duration) -> (Vec<Value>, Value) {
        let id = self.send(method, params);
        self.response(id, timeout)
    }

    pub fn close_stdin(&mut self) {
        drop(self.stdin.take());
    }

    /// Wait for the process to exit. Returns `None` on timeout.
    pub fn wait_exit(&mut self, timeout: Duration) -> Option<ExitStatus> {
        let deadline = Instant::now() + timeout;
        loop {
            if let Some(status) = self.child.try_wait().unwrap() {
                return Some(status);
            }
            if Instant::now() >= deadline {
                return None;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
    }
}

impl Drop for WorkerProcess {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

pub fn error_code(response: &Value) -> &str {
    response
        .pointer("/error/code")
        .and_then(Value::as_str)
        .unwrap_or_else(|| panic!("expected an error response: {response}"))
}

pub fn result(response: &Value) -> &Value {
    response
        .get("result")
        .unwrap_or_else(|| panic!("expected a result response: {response}"))
}

/// Build the protocol's `ModelFiles` from `<models-root>/<repo>/.ccut-manifest.json`.
pub fn model_files(models_root: &Path, repo: &str, family: &str) -> Value {
    let dir = models_root.join(repo);
    let manifest: Value =
        serde_json::from_slice(&std::fs::read(dir.join(".ccut-manifest.json")).expect("read .ccut-manifest.json")).expect("manifest JSON");
    let files: Vec<Value> = manifest["files"]
        .as_array()
        .expect("manifest files")
        .iter()
        .map(|file| json!({ "path": file["path"], "sha256": file["sha256"], "byteLength": file["size"] }))
        .collect();
    json!({ "family": family, "revision": manifest["revision"], "dir": dir.to_string_lossy(), "files": files })
}

/// Same as [`model_files`], but takes only the files under `subdir/` in the repo. The component's directory is that subdirectory. This is the shape the Runtime passes to the Worker from the registered `subdir`: the large-v3 model of `argmaxinc/whisperkit-coreml` lives in `openai_whisper-large-v3_947MB/`.
pub fn model_files_in(models_root: &Path, repo: &str, subdir: &str, family: &str) -> Value {
    let mut files = model_files(models_root, repo, family);
    let prefix = format!("{subdir}/");
    let scoped: Vec<Value> = files["files"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|file| {
            let path = file["path"].as_str().unwrap().strip_prefix(&prefix)?;
            let mut file = file.clone();
            file["path"] = json!(path);
            Some(file)
        })
        .collect();
    files["dir"] = json!(models_root.join(repo).join(subdir).to_string_lossy());
    files["files"] = json!(scoped);
    files
}

/// The Whisper (CoreML) bundle: the bundle ID, the `asr` repo, and the subdirectory within the repo (`None` if there is none).
pub type WhisperBundle = (&'static str, &'static str, Option<&'static str>);
pub const WHISPER_LARGE_V3: WhisperBundle = (
    "whisper-large-v3@coreml",
    "argmaxinc/whisperkit-coreml",
    Some("openai_whisper-large-v3_947MB"),
);
pub const WHISPER_LARGE_V3_TURBO: WhisperBundle = ("whisper-large-v3-turbo@coreml", "aufklarer/Whisper-Large-v3-Turbo-CoreML", None);
/// The Whisper tokenizer repo, shared by large-v3 and turbo.
pub const WHISPER_TOKENIZER_REPO: &str = "openai/whisper-large-v3";

/// The locally installed Whisper (CoreML) + Silero + tokenizer bundle. The optional aligner is included if it is installed (same as the Runtime).
pub fn whisper_bundle(models_root: &Path, (bundle_id, asr_repo, subdir): WhisperBundle) -> Value {
    let asr = match subdir {
        Some(subdir) => model_files_in(models_root, asr_repo, subdir, "whisper-coreml"),
        None => model_files(models_root, asr_repo, "whisper-coreml"),
    };
    let mut bundle = json!({
        "bundleId": bundle_id,
        "backend": "coreml",
        "device": "ane",
        "components": {
            "asr": asr,
            "vad": model_files(models_root, "aufklarer/Silero-VAD-v6.2.1-MLX", "silero-vad"),
            "tokenizer": model_files(models_root, WHISPER_TOKENIZER_REPO, "whisper-tokenizer"),
        },
        "threads": 4,
        "memoryBudgetBytes": null,
    });
    if is_installed(models_root, QWEN3_FORCED_ALIGNER) {
        bundle["components"]["aligner"] = model_files(models_root, QWEN3_FORCED_ALIGNER, "qwen3-forced-aligner");
    }
    bundle
}

/// The Whisper (MLX) bundle: the bundle ID and the `asr` repo (mlx-community's fp16 conversion).
pub type WhisperMlxBundle = (&'static str, &'static str);
pub const WHISPER_LARGE_V3_MLX: WhisperMlxBundle = ("whisper-large-v3@mlx", "mlx-community/whisper-large-v3-fp16");
pub const WHISPER_LARGE_V3_TURBO_MLX: WhisperMlxBundle = ("whisper-large-v3-turbo@mlx", "mlx-community/whisper-large-v3-turbo-fp16");

/// The locally installed Whisper (MLX) + Silero + tokenizer bundle. The tokenizer component must include `generation_config.json`. The optional aligner is included if it is installed (same as the Runtime).
pub fn whisper_mlx_bundle(models_root: &Path, (bundle_id, asr_repo): WhisperMlxBundle) -> Value {
    let mut bundle = json!({
        "bundleId": bundle_id,
        "backend": "mlx",
        "device": "metal",
        "components": {
            "asr": model_files(models_root, asr_repo, "whisper-mlx"),
            "vad": model_files(models_root, "aufklarer/Silero-VAD-v6.2.1-MLX", "silero-vad"),
            "tokenizer": model_files(models_root, WHISPER_TOKENIZER_REPO, "whisper-tokenizer"),
        },
        "threads": 4,
        "memoryBudgetBytes": null,
    });
    if is_installed(models_root, QWEN3_FORCED_ALIGNER) {
        bundle["components"]["aligner"] = model_files(models_root, QWEN3_FORCED_ALIGNER, "qwen3-forced-aligner");
    }
    bundle
}

/// The default recognition bundle: the bundle ID and the repo of the `asr` component.
pub const QWEN3_ASR_0_6B: (&str, &str) = ("qwen3-asr-0.6b@mlx-4bit", "aufklarer/Qwen3-ASR-0.6B-MLX-4bit");
/// The larger Qwen3-ASR. It shares Silero VAD with the 0.6B model.
pub const QWEN3_ASR_1_7B: (&str, &str) = ("qwen3-asr-1.7b@mlx-8bit", "aufklarer/Qwen3-ASR-1.7B-MLX-8bit");

/// This repo is installed locally (it has `.ccut-manifest.json`).
pub fn is_installed(models_root: &Path, repo: &str) -> bool {
    models_root.join(repo).join(".ccut-manifest.json").is_file()
}

/// The optional aligner shared by the recognition bundles (Qwen3-ASR, Whisper).
pub const QWEN3_FORCED_ALIGNER: &str = "aufklarer/Qwen3-ForcedAligner-0.6B-4bit";

/// The locally installed Qwen3-ASR + Silero bundle: `(bundle ID, asr repo)`. The optional aligner is included if it is installed (same as the Runtime).
pub fn qwen3_asr_bundle(models_root: &Path, (bundle_id, asr_repo): (&str, &str)) -> Value {
    let mut bundle = json!({
        "bundleId": bundle_id,
        "backend": "mlx",
        "device": "metal",
        "components": {
            "asr": model_files(models_root, asr_repo, "qwen3-asr"),
            "vad": model_files(models_root, "aufklarer/Silero-VAD-v6.2.1-MLX", "silero-vad"),
        },
        "threads": 4,
        "memoryBudgetBytes": null,
    });
    if is_installed(models_root, QWEN3_FORCED_ALIGNER) {
        bundle["components"]["aligner"] = model_files(models_root, QWEN3_FORCED_ALIGNER, "qwen3-forced-aligner");
    }
    bundle
}

/// MOSS Transcribe Diarize: the bundle ID and the repo of the `asr` component.
pub const MOSS_TRANSCRIBE_DIARIZE: (&str, &str) = ("moss-transcribe-diarize@mlx-8bit", "OpenMOSS-Team/MOSS-Transcribe-Diarize");

/// The optional speaker model MOSS uses to merge speakers across chunks.
pub const WESPEAKER: &str = "aufklarer/WeSpeaker-ResNet34-LM-MLX";

/// The Pyannote segmentation model of the speaker-diarization bundle (together with [`WESPEAKER`], it gives speakers to Qwen3-ASR and Whisper).
pub const PYANNOTE: &str = "aufklarer/Pyannote-Segmentation-MLX";

/// A recognition bundle carries the two components of the speaker-diarization bundle (same as the Runtime: only once that bundle is installed). Returns `None` if it is not installed.
pub fn with_diarization(models_root: &Path, mut bundle: Value) -> Option<Value> {
    if !is_installed(models_root, PYANNOTE) || !is_installed(models_root, WESPEAKER) {
        return None;
    }
    bundle["components"]["segmentation"] = model_files(models_root, PYANNOTE, "pyannote-segmentation");
    bundle["components"]["speaker"] = model_files(models_root, WESPEAKER, "wespeaker");
    Some(bundle)
}

/// The locally installed MOSS bundle (no VAD). The optional aligner and speaker model are included if installed (same as the Runtime).
pub fn moss_bundle(models_root: &Path) -> Value {
    let (bundle_id, asr_repo) = MOSS_TRANSCRIBE_DIARIZE;
    let mut bundle = json!({
        "bundleId": bundle_id,
        "backend": "mlx",
        "device": "metal",
        "components": { "asr": model_files(models_root, asr_repo, "moss-transcribe-diarize") },
        "threads": 4,
        "memoryBudgetBytes": null,
    });
    if is_installed(models_root, QWEN3_FORCED_ALIGNER) {
        bundle["components"]["aligner"] = model_files(models_root, QWEN3_FORCED_ALIGNER, "qwen3-forced-aligner");
    }
    if is_installed(models_root, WESPEAKER) {
        bundle["components"]["speaker"] = model_files(models_root, WESPEAKER, "wespeaker");
    }
    bundle
}

/// The candle backend's bundle IDs: the same repos as MLX, with the same components.
pub const QWEN3_ASR_0_6B_CANDLE: &str = "qwen3-asr-0.6b@candle";
pub const QWEN3_ASR_1_7B_CANDLE: &str = "qwen3-asr-1.7b@candle";
pub const MOSS_TRANSCRIBE_DIARIZE_CANDLE: &str = "moss-transcribe-diarize@candle";

/// The same bundle, switched to candle's CPU backend. This is the shape the Runtime registers on Windows and Linux.
pub fn on_candle(mut bundle: Value, bundle_id: &str) -> Value {
    bundle["bundleId"] = json!(bundle_id);
    bundle["backend"] = json!("candle");
    bundle["device"] = json!("cpu");
    bundle
}

/// Drop the optional aligner. Word timing falls back to estimates based on character length.
pub fn without_aligner(mut bundle: Value) -> Value {
    bundle["components"].as_object_mut().expect("components").remove("aligner");
    bundle
}

/// The locally installed default recognition bundle (Qwen3-ASR 0.6B + Silero).
pub fn installed_bundle(models_root: &Path) -> Value {
    qwen3_asr_bundle(models_root, QWEN3_ASR_0_6B)
}

pub fn fixture(name: &str) -> std::path::PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../model-runtime/tests/fixtures")
        .join(name)
}
