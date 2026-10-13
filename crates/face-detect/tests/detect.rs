//! The YuNet model shipped with the app (`packages/models/assets/face-detection/`) really loads and runs; also the process's JSON-line protocol (`src/main.rs`).
//! Samples with faces are not checked in (frames from user videos are not committed). "Finds a face" is tested only when `CUCCUT_FACE_FIXTURE` is given (a PNG or JPEG with a face); otherwise it is skipped.

use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use face_detect::FaceDetector;
use image::{DynamicImage, Rgb, RgbImage};

fn model() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../packages/models/assets/face-detection/yunet-2023mar.onnx")
}

#[test]
fn a_plain_frame_has_no_faces() {
    let detector = FaceDetector::load(&model()).expect("load model");
    for (w, h) in [(640, 360), (360, 640), (1280, 720), (64, 64)] {
        let image = DynamicImage::ImageRgb8(RgbImage::from_pixel(w, h, Rgb([128, 128, 128])));
        assert!(detector.detect(&image).unwrap().is_empty(), "{w}x{h}");
    }
}

#[test]
fn a_real_face_is_found_when_a_fixture_is_given() {
    let Some(fixture) = std::env::var_os("CUCCUT_FACE_FIXTURE") else {
        eprintln!("skipped: set CUCCUT_FACE_FIXTURE to an image with a face");
        return;
    };
    let detector = FaceDetector::load(&model()).expect("load model");
    let (faces, width, height) = detector.detect_file(Path::new(&fixture)).expect("detect");
    eprintln!("{width}x{height}: {faces:?}");
    assert!(!faces.is_empty());
    for face in faces {
        assert!(face.x >= 0.0 && face.y >= 0.0 && face.x + face.w <= 1.0 + 1e-6 && face.y + face.h <= 1.0 + 1e-6);
        assert!(face.score >= f64::from(face_detect::SCORE_THRESHOLD) - 1e-3 && face.score <= 1.0);
    }
}

#[test]
fn the_process_speaks_json_lines() {
    let dir = std::env::temp_dir().join(format!("face-detect-test-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let blank = dir.join("blank.png");
    RgbImage::from_pixel(320, 180, Rgb([20, 20, 20])).save(&blank).unwrap();

    let mut child = Command::new(env!("CARGO_BIN_EXE_face-detect"))
        .arg(model())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();
    let mut stdin = child.stdin.take().unwrap();
    let requests = [
        serde_json::json!({ "id": 1, "method": "detect", "params": { "file": blank } }),
        serde_json::json!({ "id": 2, "method": "detect", "params": { "file": dir.join("missing.png") } }),
        serde_json::json!({ "id": 3, "method": "detect", "params": {} }),
        serde_json::json!({ "id": 4, "method": "nope" }),
    ];
    for request in &requests {
        writeln!(stdin, "{request}").unwrap();
    }
    writeln!(stdin, "not json").unwrap();
    drop(stdin);
    let output = child.wait_with_output().unwrap();
    std::fs::remove_dir_all(&dir).ok();
    assert!(output.status.success());
    let lines: Vec<serde_json::Value> = String::from_utf8(output.stdout)
        .unwrap()
        .lines()
        .map(|line| serde_json::from_str(line).unwrap())
        .collect();
    assert_eq!(lines.len(), 5, "{lines:?}");
    assert_eq!(lines[0]["event"], "ready");
    assert!(lines[0]["params"]["loadMs"].is_u64());
    assert_eq!(lines[1]["id"], 1);
    assert_eq!(lines[1]["result"]["faces"], serde_json::json!([]));
    assert_eq!(
        (lines[1]["result"]["width"].as_u64(), lines[1]["result"]["height"].as_u64()),
        (Some(320), Some(180))
    );
    assert_eq!(
        (lines[2]["id"].clone(), lines[2]["error"]["code"].clone()),
        (2.into(), "DETECT_FAILED".into())
    );
    assert_eq!(
        (lines[3]["id"].clone(), lines[3]["error"]["code"].clone()),
        (3.into(), "INVALID_REQUEST".into())
    );
    assert_eq!(
        (lines[4]["id"].clone(), lines[4]["error"]["code"].clone()),
        (4.into(), "UNKNOWN_METHOD".into())
    );
}

#[test]
fn a_missing_model_exits_with_1_before_answering() {
    let output = Command::new(env!("CARGO_BIN_EXE_face-detect"))
        .arg("/definitely/not/a/model.onnx")
        .output()
        .unwrap();
    assert_eq!(output.status.code(), Some(1));
    assert!(output.stdout.is_empty());
    assert!(!output.stderr.is_empty());
}
