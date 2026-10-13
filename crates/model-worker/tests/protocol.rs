//! Protocol layer: needs no model files and runs on any platform.

mod support;

use std::time::{Duration, Instant};

use serde_json::{Value, json};
use support::{WorkerProcess, error_code, result};

const TIMEOUT: Duration = Duration::from_secs(10);

/// All families of the main synthesis model (the tts ones in `ModelFamily` in `packages/models`).
const SYNTHESIS_FAMILIES: [&str; 6] = ["qwen3-tts", "indextts2", "indextts2.5", "gpt-sovits", "voxcpm2", "omnivoice"];

/// All families of the main recognition model (the asr ones in `ModelFamily` in `packages/models`).
const TRANSCRIPTION_FAMILIES: [&str; 5] = [
    "qwen3-asr",
    "whisper-mlx",
    "whisper-coreml",
    "whisper-ggml",
    "moss-transcribe-diarize",
];

/// All families for text-to-image (the image ones in `ModelFamily` in `packages/models`).
const IMAGE_FAMILIES: [&str; 1] = ["qwen-image"];

#[test]
fn hello_reports_version_backends_and_capabilities() {
    let mut worker = WorkerProcess::spawn();
    let (events, response) = worker.call("worker.hello", json!({ "contractVersion": 1 }), TIMEOUT);
    assert!(events.is_empty());
    let hello = result(&response);
    assert_eq!(hello["contractVersion"], 1);
    assert_eq!(hello["workerVersion"], env!("CARGO_PKG_VERSION"));
    assert!(hello["pid"].as_u64().is_some_and(|pid| pid > 0));
    // Synthesis is declared per family. The loadable families are listed in synthesizeFamilies, and having any one of them declares the synthesize capability.
    let families: Vec<&str> = hello["synthesizeFamilies"]
        .as_array()
        .expect("synthesizeFamilies is always present")
        .iter()
        .map(|family| family.as_str().unwrap())
        .collect();
    assert!(families.iter().all(|family| SYNTHESIS_FAMILIES.contains(family)), "{families:?}");
    // Recognition is also declared per family (the families of the `asr` component).
    let transcribe: Vec<&str> = hello["transcribeFamilies"]
        .as_array()
        .expect("transcribeFamilies is always present")
        .iter()
        .map(|family| family.as_str().unwrap())
        .collect();
    assert!(
        transcribe.iter().all(|family| TRANSCRIPTION_FAMILIES.contains(family)),
        "{transcribe:?}"
    );
    let mut expected = Vec::new();
    if !transcribe.is_empty() {
        expected.push("transcribe");
    }
    // The aligner is wired onto MLX and candle. Apple Silicon builds and builds with candle declare `align`.
    if cfg!(any(
        all(target_os = "macos", target_arch = "aarch64", feature = "backend-mlx"),
        feature = "backend-candle"
    )) {
        expected.push("align");
        // Speaker diarization (Pyannote + WeSpeaker) is likewise wired onto MLX and candle.
        expected.push("diarize");
    }
    if !families.is_empty() {
        expected.push("synthesize");
    }
    // Separation is also declared per family (the families of the `separator` component). Both the MLX and candle builds have HTDemucs-FT wired up.
    let separate: Vec<&str> = hello["separateFamilies"]
        .as_array()
        .expect("separateFamilies is always present")
        .iter()
        .map(|family| family.as_str().unwrap())
        .collect();
    if cfg!(any(
        all(target_os = "macos", target_arch = "aarch64", feature = "backend-mlx"),
        feature = "backend-candle"
    )) {
        assert_eq!(separate, ["htdemucs-ft"]);
    } else {
        assert!(separate.is_empty(), "{separate:?}");
    }
    if !separate.is_empty() {
        expected.push("separate");
    }
    // Text-to-image is also declared per family (the families of the `image` component).
    let image: Vec<&str> = hello["imageFamilies"]
        .as_array()
        .expect("imageFamilies is always present")
        .iter()
        .map(|family| family.as_str().unwrap())
        .collect();
    assert!(image.iter().all(|family| IMAGE_FAMILIES.contains(family)), "{image:?}");
    if !image.is_empty() {
        expected.push("image");
    }
    assert_eq!(hello["capabilities"], json!(expected));
    #[cfg(all(target_os = "macos", target_arch = "aarch64", feature = "backend-mlx"))]
    {
        for family in ["qwen3-tts", "voxcpm2", "omnivoice", "gpt-sovits"] {
            assert!(families.contains(&family), "{family} is wired on Apple Silicon: {families:?}");
        }
        let mut wired = vec!["qwen3-asr", "whisper-mlx"];
        if cfg!(feature = "backend-coreml") {
            wired.push("whisper-coreml");
        }
        if cfg!(feature = "whisper-ggml") {
            wired.push("whisper-ggml");
        }
        wired.push("moss-transcribe-diarize");
        assert_eq!(transcribe, wired);
        assert_eq!(image, ["qwen-image"]);
    }
    // When candle is compiled in, Qwen3-ASR, MOSS and Qwen-Image load on every platform, including macOS. The Runtime decides whether candle bundles are registered.
    #[cfg(feature = "backend-candle")]
    {
        let mut wired = vec!["qwen3-asr"];
        if cfg!(all(target_os = "macos", target_arch = "aarch64", feature = "backend-mlx")) {
            wired.push("whisper-mlx");
        }
        if cfg!(all(target_os = "macos", target_arch = "aarch64", feature = "backend-coreml")) {
            wired.push("whisper-coreml");
        }
        if cfg!(feature = "whisper-ggml") {
            wired.push("whisper-ggml");
        }
        wired.push("moss-transcribe-diarize");
        assert_eq!(transcribe, wired);
        assert_eq!(image, ["qwen-image"]);
    }
    let backends = hello["backends"].as_array().unwrap();
    let ids: Vec<&str> = backends.iter().map(|backend| backend["id"].as_str().unwrap()).collect();
    assert_eq!(ids, ["mlx", "coreml", "candle", "ggml"]);
    for backend in backends {
        assert!(backend["devices"].is_array());
        if backend["available"] == false {
            assert!(backend["reason"].is_string(), "unavailable backends carry a reason: {backend}");
        }
    }
    // When CoreML is compiled in, Metal is checked the same way as with MLX (VAD runs on MLX). When available, the device is `ane`.
    if cfg!(all(target_os = "macos", target_arch = "aarch64", feature = "backend-coreml")) {
        assert_eq!(backends[1]["available"], backends[0]["available"]);
        if backends[1]["available"] == true {
            assert_eq!(backends[1]["devices"], json!(["ane"]));
        }
    } else {
        assert_eq!(backends[1]["reason"], "not-compiled");
    }
    if cfg!(feature = "backend-candle") {
        // candle does not depend on the machine: it is always available, and CPU is always last in the device list (CUDA, when present, comes before it).
        assert_eq!(backends[2]["available"], true);
        assert_eq!(backends[2]["devices"].as_array().unwrap().last(), Some(&json!("cpu")));
    } else {
        assert_eq!(backends[2]["reason"], "not-compiled");
    }
    if cfg!(feature = "whisper-ggml") {
        // ggml likewise does not depend on the machine: CPU is always last, with at most one GPU before it (`cuda`, `vulkan` or `metal`).
        assert_eq!(backends[3]["available"], true);
        let devices = backends[3]["devices"].as_array().unwrap();
        assert_eq!(devices.last(), Some(&json!("cpu")));
        assert!(devices.len() <= 2, "{devices:?}");
        assert!(
            devices
                .iter()
                .all(|device| device == "cpu" || device == "cuda" || device == "vulkan" || device == "metal"),
            "{devices:?}"
        );
    } else {
        assert_eq!(backends[3]["reason"], "not-compiled");
    }
}

#[test]
fn contract_mismatch_is_rejected() {
    let mut worker = WorkerProcess::spawn();
    let (_, response) = worker.call("worker.hello", json!({ "contractVersion": 2 }), TIMEOUT);
    assert_eq!(error_code(&response), "CONTRACT_MISMATCH");
    assert_eq!(response["error"]["retryable"], false);
}

#[test]
fn unknown_methods_and_bad_params_are_protocol_errors() {
    let mut worker = WorkerProcess::spawn();
    let (_, response) = worker.call("worker.dance", json!({}), TIMEOUT);
    assert_eq!(error_code(&response), "UNKNOWN_METHOD");

    let (_, response) = worker.call("worker.hello", json!({ "contractVersion": "one" }), TIMEOUT);
    assert_eq!(error_code(&response), "INVALID_PARAMS");
    let (_, response) = worker.call("worker.hello", json!({ "contractVersion": 1, "extra": true }), TIMEOUT);
    assert_eq!(error_code(&response), "INVALID_PARAMS");
    let (_, response) = worker.call("job.cancel", json!({}), TIMEOUT);
    assert_eq!(error_code(&response), "INVALID_PARAMS");

    // A line that cannot be parsed has no id to reply to. Log it, skip it, and keep working as usual.
    worker.send_raw("{not json");
    let (_, response) = worker.call("worker.status", json!({}), TIMEOUT);
    assert_eq!(result(&response)["state"], "empty");
}

#[test]
fn job_run_before_load_is_a_state_error() {
    let mut worker = WorkerProcess::spawn();
    let staging = tempfile::tempdir().unwrap();
    let params = json!({
        "jobId": "job-1",
        "runGeneration": 1,
        "capability": "transcribe",
        "input": { "file": support::fixture("test-sample.wav").to_string_lossy(), "contentHash": "sha256:00", "track": 0 },
        "options": { "language": { "mode": "prefer", "tag": null }, "diarize": false, "timescale": 1_000_000 },
        "staging": staging.path().to_string_lossy(),
        "outputContract": "cuccut.asr-result/v1",
    });
    let (events, response) = worker.call("job.run", params, TIMEOUT);
    assert!(events.is_empty());
    assert_eq!(error_code(&response), "WORKER_BUSY");
    assert_eq!(response["error"]["details"]["state"], "empty");

    let (_, response) = worker.call("job.cancel", json!({ "jobId": "job-1" }), TIMEOUT);
    assert_eq!(error_code(&response), "NOT_FOUND");
    let (_, response) = worker.call("model.unload", json!({}), TIMEOUT);
    assert_eq!(result(&response)["unloaded"], true);

    let (_, response) = worker.call("worker.status", json!({}), TIMEOUT);
    assert_eq!(
        result(&response),
        &json!({ "state": "empty", "bundleId": null, "job": null, "memory": null })
    );
}

#[test]
fn missing_model_files_are_not_installed() {
    let mut worker = WorkerProcess::spawn();
    let models = tempfile::tempdir().unwrap();
    std::fs::write(models.path().join("config.json"), b"{}").unwrap();
    let files = |list: &[(&str, u64)]| -> Value {
        list.iter()
            .map(|(path, size)| json!({ "path": path, "sha256": "0".repeat(64), "byteLength": size }))
            .collect()
    };
    let bundle = json!({
        "bundleId": "test@mlx",
        "backend": "mlx",
        "device": "metal",
        "components": {
            "asr": { "family": "qwen3-asr", "revision": "r1", "dir": models.path().to_string_lossy(),
                     "files": files(&[("config.json", 2), ("model.safetensors", 1024)]) },
            "vad": { "family": "silero-vad", "revision": "r1", "dir": models.path().to_string_lossy(),
                     "files": files(&[("config.json", 2)]) },
        },
        "threads": 2,
        "memoryBudgetBytes": null,
    });
    let (events, response) = worker.call("model.load", json!({ "bundle": bundle }), TIMEOUT);
    assert!(events.is_empty(), "no phases before the files are verified: {events:?}");
    assert_eq!(error_code(&response), "MODEL_NOT_INSTALLED");
    let details = &response["error"]["details"];
    assert_eq!(details["component"], "asr");
    assert_eq!(details["file"], "model.safetensors");
    assert_eq!(details["reason"], "missing");
    let message = response["error"]["message"].as_str().unwrap();
    assert!(
        !message.contains(&*models.path().to_string_lossy()),
        "messages never carry absolute paths: {message}"
    );

    // A failed load leaves no state behind.
    let (_, response) = worker.call("worker.status", json!({}), TIMEOUT);
    assert_eq!(result(&response)["state"], "empty");
}

/// Synthesis parameters are still checked first. A family not listed in `synthesizeFamilies` gives a structured `MODEL_UNSUPPORTED` (`not-wired`) on load. A listed family still has its files checked as usual (missing files are not `not-wired`). Failed loads leave no state behind.
#[test]
fn synthesis_is_checked_and_unlisted_families_are_not_wired() {
    let mut worker = WorkerProcess::spawn();
    let (_, response) = worker.call("worker.hello", json!({ "contractVersion": 1 }), TIMEOUT);
    let listed: Vec<String> = result(&response)["synthesizeFamilies"]
        .as_array()
        .unwrap()
        .iter()
        .map(|family| family.as_str().unwrap().to_owned())
        .collect();
    let staging = tempfile::tempdir().unwrap();
    let run = |voice: Value| {
        json!({
            "jobId": "job-tts",
            "runGeneration": 1,
            "capability": "synthesize",
            "input": null,
            "options": { "text": "hello", "language": null, "voice": voice, "instructions": null,
                         "speed": null, "cfg": null, "steps": null, "seed": null },
            "staging": staging.path().to_string_lossy(),
            "outputContract": "cuccut.speech-wav/v1",
        })
    };
    // clone has no reference recording: a parameter error, checked before the state check.
    let (_, response) = worker.call("job.run", run(json!({ "mode": "clone", "transcript": null })), TIMEOUT);
    assert_eq!(error_code(&response), "INVALID_PARAMS");
    let (_, response) = worker.call("job.run", run(json!({ "mode": "preset", "id": "a" })), TIMEOUT);
    assert_eq!(error_code(&response), "WORKER_BUSY");

    let models = tempfile::tempdir().unwrap();
    std::fs::write(models.path().join("model.safetensors"), b"1234").unwrap();
    let component = |family: &str| {
        json!({ "family": family, "revision": "r1", "dir": models.path().to_string_lossy(),
                "files": [{ "path": "model.safetensors", "sha256": "0".repeat(64), "byteLength": 4 }] })
    };
    let bundle = |family: &str| {
        let mut components = json!({ "tts": component(family) });
        if family == "qwen3-tts" {
            components["codec"] = component("qwen3-tts-tokenizer");
        }
        json!({ "bundle": {
            "bundleId": format!("{family}@test"),
            "backend": "mlx",
            "device": "metal",
            "components": components,
            "threads": 2,
            "memoryBudgetBytes": null,
        } })
    };
    for family in SYNTHESIS_FAMILIES {
        let (_, response) = worker.call("model.load", bundle(family), Duration::from_secs(60));
        assert!(
            response["error"].is_object(),
            "{family}: a four-byte weight file never loads: {response}"
        );
        assert_eq!(response["error"]["retryable"], false, "{family}: {response}");
        let reason = &response["error"]["details"]["reason"];
        if listed.iter().any(|listed| listed == family) {
            assert_ne!(reason, "not-wired", "{family} is listed in hello: {response}");
        } else {
            assert_eq!(error_code(&response), "MODEL_UNSUPPORTED");
            assert_eq!(
                response["error"]["details"],
                json!({ "capability": "synthesize", "reason": "not-wired", "family": family })
            );
        }
        let (_, response) = worker.call("worker.status", json!({}), TIMEOUT);
        assert_eq!(result(&response)["state"], "empty", "{family}");
    }
}

/// Separation parameters are still checked first (shape → `INVALID_PARAMS`, no model → `WORKER_BUSY`). A separation bundle carries only `separator`. Missing files give `MODEL_NOT_INSTALLED`, and carrying other components gives `MODEL_UNSUPPORTED`. Failed loads leave no state behind.
#[test]
fn separation_is_checked_before_and_at_load() {
    let mut worker = WorkerProcess::spawn();
    let (_, response) = worker.call("worker.hello", json!({ "contractVersion": 1 }), TIMEOUT);
    let wired = !result(&response)["separateFamilies"].as_array().unwrap().is_empty();
    let staging = tempfile::tempdir().unwrap();
    let run = |options: Value| {
        json!({
            "jobId": "job-sep",
            "runGeneration": 1,
            "capability": "separate",
            "input": { "file": "/media/a.mp4", "contentHash": "sha256:ab", "track": 0 },
            "options": options,
            "staging": staging.path().to_string_lossy(),
            "outputContract": "cuccut.stems-wav/v1",
        })
    };
    let (_, response) = worker.call("job.run", run(json!({ "sampleRate": 1 })), TIMEOUT);
    assert_eq!(error_code(&response), "INVALID_PARAMS");
    let (_, response) = worker.call("job.run", run(json!({ "sampleRate": 48_000, "stems": 4 })), TIMEOUT);
    assert_eq!(error_code(&response), "INVALID_PARAMS");
    let (_, response) = worker.call("job.run", run(json!({ "sampleRate": 48_000 })), TIMEOUT);
    assert_eq!(error_code(&response), "WORKER_BUSY");

    let models = tempfile::tempdir().unwrap();
    std::fs::write(models.path().join("htdemucs_ft.safetensors"), b"1234").unwrap();
    let component =
        |family: &str, files: Value| json!({ "family": family, "revision": "r1", "dir": models.path().to_string_lossy(), "files": files });
    let weights = json!([{ "path": "htdemucs_ft.safetensors", "sha256": "0".repeat(64), "byteLength": 4 }]);
    // Compiled-in backends: on Apple Silicon with MLX, MLX is used. Otherwise, with candle, candle's CPU is used. If neither is present, the bundle is reported as `not-wired` against the MLX bundle.
    let (backend, device) = if cfg!(all(target_os = "macos", target_arch = "aarch64", feature = "backend-mlx")) {
        ("mlx", "metal")
    } else if cfg!(feature = "backend-candle") {
        ("candle", "cpu")
    } else {
        ("mlx", "metal")
    };
    let bundle = |components: Value| {
        json!({ "bundle": {
            "bundleId": "htdemucs-ft@test",
            "backend": backend,
            "device": device,
            "components": components,
            "threads": 2,
            "memoryBudgetBytes": null,
        } })
    };
    // A file that is in the manifest but missing from disk gives MODEL_NOT_INSTALLED during the validation stage, independent of the backend.
    let missing = json!([{ "path": "htdemucs_ft_config.json", "sha256": "0".repeat(64), "byteLength": 2158 }]);
    let (_, response) = worker.call(
        "model.load",
        bundle(json!({ "separator": component("htdemucs-ft", missing) })),
        Duration::from_secs(60),
    );
    assert_eq!(error_code(&response), "MODEL_NOT_INSTALLED", "{response}");

    // Recognition components present: a separation bundle does not accept them.
    let (_, response) = worker.call(
        "model.load",
        bundle(json!({ "separator": component("htdemucs-ft", weights.clone()), "vad": component("silero-vad", weights.clone()) })),
        Duration::from_secs(60),
    );
    assert_eq!(error_code(&response), "MODEL_UNSUPPORTED", "{response}");
    let expected_reason = if wired { "unexpected-component" } else { "not-wired" };
    assert_eq!(response["error"]["details"]["reason"], expected_reason, "{response}");

    // Files are present but the config is missing: the backend cannot read htdemucs_ft_config.json (it is not in the manifest). This is not `not-wired`.
    let (_, response) = worker.call(
        "model.load",
        bundle(json!({ "separator": component("htdemucs-ft", weights) })),
        Duration::from_secs(60),
    );
    assert!(response["error"].is_object(), "{response}");
    if wired {
        assert_eq!(error_code(&response), "MODEL_NOT_INSTALLED", "{response}");
    }
    let (_, response) = worker.call("worker.status", json!({}), TIMEOUT);
    assert_eq!(result(&response)["state"], "empty");
}

/// Text-to-image parameters are still checked first. A family listed in `imageFamilies` has its files checked on load as usual (a missing file gives `MODEL_NOT_INSTALLED`). An unlisted family gives `not-wired`. A bundle may not mix in other components. Failed loads leave no state behind.
#[test]
fn image_is_checked_and_unlisted_families_are_not_wired() {
    let mut worker = WorkerProcess::spawn();
    let (_, response) = worker.call("worker.hello", json!({ "contractVersion": 1 }), TIMEOUT);
    let listed = result(&response)["imageFamilies"]
        .as_array()
        .unwrap()
        .iter()
        .any(|family| family == "qwen-image");
    let staging = tempfile::tempdir().unwrap();
    let run = |prompt: &str, width: u32| {
        json!({
            "jobId": "job-image",
            "runGeneration": 1,
            "capability": "image",
            "options": { "prompt": prompt, "width": width, "height": 256, "steps": null, "seed": 7 },
            "staging": staging.path().to_string_lossy(),
            "outputContract": "cuccut.image-png/v1",
        })
    };
    // Empty prompt and zero-width: a parameter error, checked before the state check.
    let (_, response) = worker.call("job.run", run("", 256), TIMEOUT);
    assert_eq!(error_code(&response), "INVALID_PARAMS");
    let (_, response) = worker.call("job.run", run("a cat", 0), TIMEOUT);
    assert_eq!(error_code(&response), "INVALID_PARAMS");
    let mut wrong_contract = run("a cat", 256);
    wrong_contract["outputContract"] = json!("cuccut.speech-wav/v1");
    let (_, response) = worker.call("job.run", wrong_contract, TIMEOUT);
    assert_eq!(error_code(&response), "INVALID_PARAMS");
    let (_, response) = worker.call("job.run", run("a cat", 256), TIMEOUT);
    assert_eq!(error_code(&response), "WORKER_BUSY");

    let models = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(models.path().join("processor")).unwrap();
    std::fs::write(models.path().join("processor/tokenizer.json"), b"{}").unwrap();
    let component = |family: &str| {
        json!({ "family": family, "revision": "r1", "dir": models.path().to_string_lossy(),
                "files": [{ "path": "processor/tokenizer.json", "sha256": "0".repeat(64), "byteLength": 2 }] })
    };
    // Each compiled-in backend checks its own files (MLX only on Apple Silicon; candle on any platform). If neither is present, the bundle is reported as `not-wired` against the MLX bundle.
    let mut backends: Vec<(&str, &str)> = Vec::new();
    if cfg!(all(target_os = "macos", target_arch = "aarch64", feature = "backend-mlx")) {
        backends.push(("mlx", "metal"));
    }
    if cfg!(feature = "backend-candle") {
        backends.push(("candle", "cpu"));
    }
    let (backend, device) = backends.first().copied().unwrap_or(("mlx", "metal"));
    let load_on = |components: Value, backend: &str, device: &str| {
        json!({ "bundle": {
            "bundleId": "qwen-image@test",
            "backend": backend,
            "device": device,
            "components": components,
            "threads": 2,
            "memoryBudgetBytes": 1,
        } })
    };
    let load = |components: Value| load_on(components, backend, device);
    // Unrecognized family.
    let (_, response) = worker.call("model.load", load(json!({ "image": component("stable-diffusion") })), TIMEOUT);
    assert_eq!(error_code(&response), "MODEL_UNSUPPORTED");
    assert_eq!(response["error"]["details"]["reason"], "unknown-family", "{response}");
    // Recognition components mixed in.
    if listed {
        let (_, response) = worker.call(
            "model.load",
            load(json!({ "image": component("qwen-image"), "vad": component("silero-vad") })),
            TIMEOUT,
        );
        assert_eq!(error_code(&response), "MODEL_UNSUPPORTED");
        assert_eq!(response["error"]["details"]["reason"], "unexpected-component", "{response}");
    }
    // Only the tokenizer is listed. A missing scheduler config gives MODEL_NOT_INSTALLED (the total weight size is not checked against memoryBudgetBytes, see §4.2). Not wired up gives not-wired.
    assert_eq!(listed, !backends.is_empty(), "{backends:?}");
    for (backend, device) in &backends {
        let (_, response) = worker.call(
            "model.load",
            load_on(json!({ "image": component("qwen-image") }), backend, device),
            Duration::from_secs(60),
        );
        assert_eq!(error_code(&response), "MODEL_NOT_INSTALLED", "{backend}: {response}");
    }
    if backends.is_empty() {
        let (_, response) = worker.call(
            "model.load",
            load(json!({ "image": component("qwen-image") })),
            Duration::from_secs(60),
        );
        assert!(!listed);
        assert_eq!(error_code(&response), "MODEL_UNSUPPORTED");
        assert_eq!(
            response["error"]["details"],
            json!({ "capability": "image", "reason": "not-wired", "family": "qwen-image" })
        );
    }
    let (_, response) = worker.call("worker.status", json!({}), TIMEOUT);
    assert_eq!(result(&response)["state"], "empty");
}

#[test]
fn stdin_eof_exits_promptly() {
    let mut worker = WorkerProcess::spawn();
    let _ = worker.call("worker.hello", json!({ "contractVersion": 1 }), TIMEOUT);
    worker.close_stdin();
    let status = worker.wait_exit(Duration::from_secs(2)).expect("exits within 2 s of stdin EOF");
    assert!(status.success(), "{status:?}");
}

#[test]
fn a_dead_parent_makes_the_worker_exit() {
    // The PID of a process that has already exited. It is not the worker's parent process, so the watchdog thread finds this on its first check.
    let mut short_lived = std::process::Command::new(if cfg!(windows) { "cmd" } else { "true" });
    if cfg!(windows) {
        short_lived.args(["/C", "exit"]);
    }
    let mut child = short_lived.spawn().unwrap();
    let dead_pid = child.id();
    child.wait().unwrap();

    let started = Instant::now();
    let mut worker = WorkerProcess::spawn_with_parent(dead_pid);
    // stdin is kept open: the exit can only come from the watchdog.
    let status = worker.wait_exit(Duration::from_secs(6));
    if cfg!(unix) {
        let status = status.expect("exits once the parent is gone");
        assert!(status.success(), "{status:?}");
        assert!(started.elapsed() < Duration::from_secs(5), "took {:?}", started.elapsed());
    }
}

#[test]
fn oversized_lines_are_a_fatal_protocol_error() {
    let mut worker = WorkerProcess::spawn();
    let huge = format!(
        "{{\"id\":1,\"method\":\"worker.hello\",\"params\":{{\"pad\":\"{}\"}}}}",
        "x".repeat(16 * 1024 * 1024 + 16)
    );
    // The worker exits once it hits the read limit, and the remaining writes may hit a broken pipe.
    let _ = worker.try_send_raw(&huge);
    let status = worker.wait_exit(Duration::from_secs(5)).expect("exits on an oversized line");
    assert!(!status.success());
}

/// Recognition selects its loader by the `asr` family. A bundle whose shape is valid but whose family is not listed in `transcribeFamilies` gives a structured `MODEL_UNSUPPORTED` (`not-wired`) on load. A bundle with a bad shape (MOSS with VAD) reports the component as usual. Failed loads leave no state behind.
#[test]
fn unlisted_transcription_families_are_not_wired() {
    let mut worker = WorkerProcess::spawn();
    let (_, response) = worker.call("worker.hello", json!({ "contractVersion": 1 }), TIMEOUT);
    let listed = result(&response)["transcribeFamilies"].clone();
    let models = tempfile::tempdir().unwrap();
    std::fs::write(models.path().join("model.safetensors"), b"1234").unwrap();
    let component = |family: &str| {
        json!({ "family": family, "revision": "r1", "dir": models.path().to_string_lossy(),
                "files": [{ "path": "model.safetensors", "sha256": "0".repeat(64), "byteLength": 4 }] })
    };
    let load = |worker: &mut WorkerProcess, backend: &str, components: Value| {
        let bundle = json!({ "bundle": {
            "bundleId": "asr@test", "backend": backend, "device": "metal", "components": components,
            "threads": 2, "memoryBudgetBytes": null,
        } });
        let (_, response) = worker.call("model.load", bundle, TIMEOUT);
        let (_, status) = worker.call("worker.status", json!({}), TIMEOUT);
        assert_eq!(result(&status)["state"], "empty");
        assert_eq!(error_code(&response), "MODEL_UNSUPPORTED", "{response}");
        response["error"]["details"].clone()
    };
    let whisper = json!({
        "asr": component("whisper-coreml"), "vad": component("silero-vad"), "tokenizer": component("whisper-tokenizer"),
    });
    let whisper_mlx = json!({
        "asr": component("whisper-mlx"), "vad": component("silero-vad"), "tokenizer": component("whisper-tokenizer"),
    });
    let moss = json!({ "asr": component("moss-transcribe-diarize"), "speaker": component("wespeaker") });
    let ggml = json!({ "asr": component("whisper-ggml"), "vad": component("silero-vad") });
    for (family, backend, components) in [
        ("whisper-mlx", "mlx", whisper_mlx),
        ("whisper-coreml", "coreml", whisper),
        ("moss-transcribe-diarize", "mlx", moss),
        ("whisper-ggml", "ggml", ggml),
    ] {
        if listed.as_array().unwrap().iter().any(|listed| listed == family) {
            continue;
        }
        assert_eq!(
            load(&mut worker, backend, components),
            json!({ "capability": "transcribe", "reason": "not-wired", "family": family })
        );
    }
    let moss_with_vad = json!({ "asr": component("moss-transcribe-diarize"), "vad": component("silero-vad") });
    let details = load(&mut worker, "mlx", moss_with_vad);
    assert_eq!(
        (&details["component"], &details["reason"]),
        (&json!("vad"), &json!("unexpected-component"))
    );
}

/// The Whisper (CoreML) loader fetches files as listed in the manifest. `.mlmodelc` is a directory, and if it is not listed, that is `MODEL_NOT_INSTALLED`, naming the missing directory. A device other than `ane` is rejected first. All of this happens before any weights are read, and failed loads leave no state behind.
#[cfg(all(target_os = "macos", target_arch = "aarch64", feature = "backend-coreml"))]
#[test]
fn whisper_bundles_name_the_missing_model_directory() {
    let mut worker = WorkerProcess::spawn();
    let (_, response) = worker.call("worker.hello", json!({ "contractVersion": 1 }), TIMEOUT);
    if result(&response)["backends"][1]["available"] != true {
        eprintln!("skipped: no Metal device");
        return;
    }
    let models = tempfile::tempdir().unwrap();
    std::fs::write(models.path().join("model.safetensors"), b"1234").unwrap();
    std::fs::create_dir(models.path().join("AudioEncoder.mlmodelc")).unwrap();
    std::fs::write(models.path().join("AudioEncoder.mlmodelc/model.mil"), b"1234").unwrap();
    let component = |family: &str, path: &str| {
        json!({ "family": family, "revision": "r1", "dir": models.path().to_string_lossy(),
                "files": [{ "path": path, "sha256": "0".repeat(64), "byteLength": 4 }] })
    };
    let components = json!({
        "asr": component("whisper-coreml", "AudioEncoder.mlmodelc/model.mil"),
        "vad": component("silero-vad", "model.safetensors"),
        "tokenizer": component("whisper-tokenizer", "model.safetensors"),
    });
    let mut load = |device: &str| {
        let bundle = json!({ "bundle": {
            "bundleId": "whisper@test", "backend": "coreml", "device": device, "components": components,
            "threads": 2, "memoryBudgetBytes": null,
        } });
        let (_, response) = worker.call("model.load", bundle, TIMEOUT);
        let (_, status) = worker.call("worker.status", json!({}), TIMEOUT);
        assert_eq!(result(&status)["state"], "empty");
        response
    };
    let response = load("metal");
    assert_eq!(error_code(&response), "MODEL_UNSUPPORTED", "{response}");
    assert_eq!(response["error"]["details"]["reason"], "unsupported-device");
    let response = load("ane");
    assert_eq!(error_code(&response), "MODEL_NOT_INSTALLED", "{response}");
    assert_eq!(
        response["error"]["details"],
        json!({ "component": "asr", "file": "MelSpectrogram.mlmodelc/", "reason": "not-listed" })
    );
}

/// The Whisper (MLX) loader fetches files as listed in the manifest. `generation_config.json` belongs in the tokenizer component (the mlx-community repo does not have it). If it is not listed, that is `MODEL_NOT_INSTALLED`, naming the component and file. A `config.json` whose shape is not Whisper large-v3 is `unsupported-config`. All of this happens before any weights are read, and failed loads leave no state behind.
#[cfg(all(target_os = "macos", target_arch = "aarch64", feature = "backend-mlx"))]
#[test]
fn whisper_mlx_bundles_name_the_missing_file() {
    let mut worker = WorkerProcess::spawn();
    let (_, response) = worker.call("worker.hello", json!({ "contractVersion": 1 }), TIMEOUT);
    if result(&response)["backends"][0]["available"] != true {
        eprintln!("skipped: no Metal device");
        return;
    }
    let models = tempfile::tempdir().unwrap();
    let config = json!({
        "n_mels": 128, "n_audio_ctx": 1500, "n_audio_state": 1280, "n_audio_head": 20, "n_audio_layer": 32,
        "n_vocab": 51866, "n_text_ctx": 448, "n_text_state": 1280, "n_text_head": 20, "n_text_layer": 4,
    });
    let file = |path: &str, bytes: &[u8]| {
        std::fs::write(models.path().join(path), bytes).unwrap();
        json!({ "path": path, "sha256": "0".repeat(64), "byteLength": bytes.len() })
    };
    let config_file = file("config.json", config.to_string().as_bytes());
    let weights = file("model.safetensors", b"1234");
    let tokenizer = file("tokenizer.json", b"{}");
    let component = |family: &str, files: Vec<&Value>| json!({ "family": family, "revision": "r1", "dir": models.path().to_string_lossy(), "files": files });
    let mut load = |asr_files: Vec<&Value>| {
        let bundle = json!({ "bundle": {
            "bundleId": "whisper@test", "backend": "mlx", "device": "metal",
            "components": {
                "asr": component("whisper-mlx", asr_files),
                "vad": component("silero-vad", vec![&weights]),
                "tokenizer": component("whisper-tokenizer", vec![&tokenizer]),
            },
            "threads": 2, "memoryBudgetBytes": null,
        } });
        let (_, response) = worker.call("model.load", bundle, TIMEOUT);
        let (_, status) = worker.call("worker.status", json!({}), TIMEOUT);
        assert_eq!(result(&status)["state"], "empty");
        response
    };
    let response = load(vec![&config_file, &weights]);
    assert_eq!(error_code(&response), "MODEL_NOT_INSTALLED", "{response}");
    assert_eq!(
        response["error"]["details"],
        json!({ "component": "tokenizer", "file": "generation_config.json", "reason": "not-listed" })
    );
    let response = load(vec![&weights]);
    assert_eq!(error_code(&response), "MODEL_NOT_INSTALLED", "{response}");
    assert_eq!(
        response["error"]["details"],
        json!({ "component": "asr", "file": "config.json", "reason": "not-listed" })
    );
    let wrong_config = file("config.json", br#"{"n_mels": 80}"#);
    let response = load(vec![&wrong_config, &weights]);
    assert_eq!(error_code(&response), "MODEL_UNSUPPORTED", "{response}");
    assert_eq!(response["error"]["details"]["reason"], "unsupported-config");
}

/// The MOSS loader fetches files as listed in the manifest. A missing file for the optional aligner or the speaker model is likewise `MODEL_NOT_INSTALLED`. It does not quietly fall back to estimated word timing or to unmerged speakers. All of this happens before any weights are read, and failed loads leave no state behind.
#[cfg(all(target_os = "macos", target_arch = "aarch64", feature = "backend-mlx"))]
#[test]
fn moss_bundles_name_the_missing_file() {
    let mut worker = WorkerProcess::spawn();
    let (_, response) = worker.call("worker.hello", json!({ "contractVersion": 1 }), TIMEOUT);
    if result(&response)["backends"][0]["available"] != true {
        eprintln!("skipped: no Metal device");
        return;
    }
    let models = tempfile::tempdir().unwrap();
    std::fs::write(models.path().join("model.safetensors"), b"1234").unwrap();
    let component = |family: &str| {
        json!({ "family": family, "revision": "r1", "dir": models.path().to_string_lossy(),
                "files": [{ "path": "model.safetensors", "sha256": "0".repeat(64), "byteLength": 4 }] })
    };
    let mut load = |components: Value| {
        let bundle = json!({ "bundle": {
            "bundleId": "moss@test", "backend": "mlx", "device": "metal", "components": components,
            "threads": 2, "memoryBudgetBytes": null,
        } });
        let (_, response) = worker.call("model.load", bundle, TIMEOUT);
        let (_, status) = worker.call("worker.status", json!({}), TIMEOUT);
        assert_eq!(result(&status)["state"], "empty");
        assert_eq!(error_code(&response), "MODEL_NOT_INSTALLED", "{response}");
        response["error"]["details"].clone()
    };
    let details = load(json!({
        "asr": component("moss-transcribe-diarize"), "aligner": component("qwen3-forced-aligner"),
        "speaker": component("wespeaker"),
    }));
    assert_eq!(
        details,
        json!({ "component": "aligner", "file": "vocab.json", "reason": "not-listed" })
    );
    let details = load(json!({ "asr": component("moss-transcribe-diarize"), "speaker": component("wespeaker") }));
    assert_eq!(
        details,
        json!({ "component": "asr", "file": "config.json", "reason": "not-listed" })
    );
}

/// The Whisper (GGML) loader: the device must be `cpu` or the GPU reported in the handshake (`cuda`, `vulkan` or `metal`, at most one). GGML weights carry their own vocabulary, so a tokenizer means the bundle was written wrongly. The weights are the single `.bin` in the `asr` component. If it is not listed, that is `MODEL_NOT_INSTALLED`. All of this happens before any weights are read, and failed loads leave no state behind.
#[cfg(feature = "whisper-ggml")]
#[test]
fn ggml_bundles_check_device_components_and_weights() {
    let mut worker = WorkerProcess::spawn();
    let (_, response) = worker.call("worker.hello", json!({ "contractVersion": 1 }), TIMEOUT);
    let preferred = result(&response)["backends"][3]["devices"][0].as_str().unwrap().to_owned();
    let models = tempfile::tempdir().unwrap();
    std::fs::write(models.path().join("model.safetensors"), b"1234").unwrap();
    let component = |family: &str| {
        json!({ "family": family, "revision": "r1", "dir": models.path().to_string_lossy(),
                "files": [{ "path": "model.safetensors", "sha256": "0".repeat(64), "byteLength": 4 }] })
    };
    let mut load = |device: &str, components: Value| {
        let bundle = json!({ "bundle": {
            "bundleId": "whisper@ggml", "backend": "ggml", "device": device, "components": components,
            "threads": 2, "memoryBudgetBytes": null,
        } });
        let (_, response) = worker.call("model.load", bundle, TIMEOUT);
        let (_, status) = worker.call("worker.status", json!({}), TIMEOUT);
        assert_eq!(result(&status)["state"], "empty");
        response
    };
    let bundle = json!({ "asr": component("whisper-ggml"), "vad": component("silero-vad") });

    let response = load("ane", bundle.clone());
    assert_eq!(error_code(&response), "MODEL_UNSUPPORTED", "{response}");
    assert_eq!(response["error"]["details"]["reason"], "unsupported-device");
    // Devices that are not the preferred GPU reported in the handshake are all rejected.
    for gpu in ["cuda", "vulkan", "metal"].into_iter().filter(|gpu| *gpu != preferred) {
        let response = load(gpu, bundle.clone());
        assert_eq!(error_code(&response), "MODEL_UNSUPPORTED", "{response}");
        assert_eq!(response["error"]["details"]["reason"], "unsupported-device");
    }

    let with_tokenizer = json!({
        "asr": component("whisper-ggml"), "vad": component("silero-vad"), "tokenizer": component("whisper-tokenizer"),
    });
    let response = load("cpu", with_tokenizer);
    assert_eq!(error_code(&response), "MODEL_UNSUPPORTED", "{response}");
    assert_eq!(
        (&response["error"]["details"]["component"], &response["error"]["details"]["reason"]),
        (&json!("tokenizer"), &json!("unexpected-component"))
    );
    let response = load("cpu", json!({ "asr": component("whisper-ggml") }));
    assert_eq!(error_code(&response), "MODEL_UNSUPPORTED", "{response}");
    assert_eq!(
        (&response["error"]["details"]["component"], &response["error"]["details"]["reason"]),
        (&json!("vad"), &json!("missing-component"))
    );

    let response = load("cpu", bundle);
    assert_eq!(error_code(&response), "MODEL_NOT_INSTALLED", "{response}");
    assert_eq!(
        response["error"]["details"],
        json!({ "component": "asr", "file": "*.bin", "reason": "not-listed" })
    );
}

/// Speaker-diarization parameters (protocol spec §2.5.5) are still checked first (shape → `INVALID_PARAMS`, no model → `WORKER_BUSY`). A speaker-diarization bundle carries only `segmentation` and `speaker`. A missing `speaker`, or other components present, gives `MODEL_UNSUPPORTED`. Failed loads leave no state behind.
#[test]
fn diarization_is_checked_before_and_at_load() {
    let mut worker = WorkerProcess::spawn();
    let (_, response) = worker.call("worker.hello", json!({ "contractVersion": 1 }), TIMEOUT);
    let wired = result(&response)["capabilities"].as_array().unwrap().contains(&json!("diarize"));
    let staging = tempfile::tempdir().unwrap();
    let run = |options: Value| {
        json!({
            "jobId": "job-spk",
            "runGeneration": 1,
            "capability": "diarize",
            "input": { "file": "/media/a.mp4", "contentHash": "sha256:ab", "track": 0 },
            "options": options,
            "staging": staging.path().to_string_lossy(),
            "outputContract": "cuccut.speakers/v1",
        })
    };
    let (_, response) = worker.call("job.run", run(json!({ "words": [[500, 100]] })), TIMEOUT);
    assert_eq!(error_code(&response), "INVALID_PARAMS");
    let (_, response) = worker.call("job.run", run(json!({ "words": [], "maxSpeakers": 2 })), TIMEOUT);
    assert_eq!(error_code(&response), "INVALID_PARAMS");
    let (_, response) = worker.call("job.run", run(json!({ "timescale": 1000, "words": [[0, 100]] })), TIMEOUT);
    assert_eq!(error_code(&response), "WORKER_BUSY");

    let models = tempfile::tempdir().unwrap();
    std::fs::write(models.path().join("model.safetensors"), b"1234").unwrap();
    let weights = json!([{ "path": "model.safetensors", "sha256": "0".repeat(64), "byteLength": 4 }]);
    let component = |family: &str| json!({ "family": family, "revision": "r1", "dir": models.path().to_string_lossy(), "files": weights });
    let (backend, device) = if cfg!(all(target_os = "macos", target_arch = "aarch64", feature = "backend-mlx")) {
        ("mlx", "metal")
    } else if cfg!(feature = "backend-candle") {
        ("candle", "cpu")
    } else {
        ("mlx", "metal")
    };
    let bundle = |components: Value| {
        json!({ "bundle": {
            "bundleId": "speaker-diarization@test",
            "backend": backend,
            "device": device,
            "components": components,
            "threads": 2,
            "memoryBudgetBytes": null,
        } })
    };
    let (_, response) = worker.call(
        "model.load",
        bundle(json!({ "segmentation": component("pyannote-segmentation") })),
        Duration::from_secs(60),
    );
    assert_eq!(error_code(&response), "MODEL_UNSUPPORTED", "{response}");
    assert_eq!(response["error"]["details"]["component"], "speaker", "{response}");
    let (_, response) = worker.call(
        "model.load",
        bundle(json!({
            "segmentation": component("pyannote-segmentation"),
            "speaker": component("wespeaker"),
            "vad": component("silero-vad"),
        })),
        Duration::from_secs(60),
    );
    assert_eq!(error_code(&response), "MODEL_UNSUPPORTED", "{response}");
    let expected_reason = if wired { "unexpected-component" } else { "not-wired" };
    assert_eq!(response["error"]["details"]["reason"], expected_reason, "{response}");
    let (_, response) = worker.call("worker.status", json!({}), TIMEOUT);
    assert_eq!(result(&response)["state"], "empty");
}
