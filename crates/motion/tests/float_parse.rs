//! Built-in presets and decimal numbers in documents must be read as correctly rounded doubles.
//!
//! serde_json's default fast path may misread a 17-significant-digit number by 1 ULP, so `core/Cargo.toml` enables `float_roundtrip` at the workspace level. Features are merged by the build graph: other crates in `cargo test --workspace` also pull it in, so whether the declaration was dropped cannot be seen there. The build graph of `cargo test -p motion` contains only this crate and `ccut-core`, so if the declaration is dropped, this test goes red here. The real wasm32 artifact is guarded by `apps/web/tests/unit/render/wasm-float-parse.test.ts`.

use std::path::{Path, PathBuf};

use serde_json::Value;

/// Reads a number literal by the preset registry's reading method (`from_str` → `Value` → `as_f64`).
fn serde_f64(literal: &str) -> f64 {
    serde_json::from_str::<Value>(literal)
        .ok()
        .and_then(|value| value.as_f64())
        .unwrap_or_else(|| panic!("{literal} is not a JSON number"))
}

fn assert_correctly_rounded(literal: &str, context: &str) {
    let exact: f64 = literal.parse().expect("decimal that std can read");
    assert_eq!(
        serde_f64(literal).to_bits(),
        exact.to_bits(),
        "{context}: serde_json read {literal} as {}, the correctly rounded value is {exact:?}. \
         Check whether serde_json in core/Cargo.toml still enables float_roundtrip",
        serde_f64(literal)
    );
}

/// Frame-aligned second values `k / fps` that the fast path is measured to misread (shortest round-trip decimal; JS `JSON.stringify` and ryu output exactly this string). An element's active window is `start <= t < end`, and t is passed from JS to wasm as an exact double. If the start or end moment is read 1 ULP high, the element is absent on its own first frame and draws one extra frame at its end frame.
#[test]
fn frame_snapped_seconds_read_as_correctly_rounded_doubles() {
    for (literal, frame) in [
        ("0.23333333333333334", "30fps frame 7"),
        ("0.11666666666666667", "60fps frame 7"),
        ("0.20833333333333334", "24fps frame 5"),
        ("0.10010000000000001", "29.97fps frame 3"),
        ("0.37537499999999996", "23.976fps frame 9"),
    ] {
        assert_correctly_rounded(literal, frame);
    }
}

#[test]
fn every_builtin_preset_float_reads_as_the_correctly_rounded_double() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("presets/builtin");
    let mut files = Vec::new();
    json_files(&root, &mut files);
    let mut floats = 0;
    for file in &files {
        let text = std::fs::read_to_string(file).expect("read preset");
        for (line, literal) in number_literals(&text) {
            if literal.contains(['.', 'e', 'E']) {
                floats += 1;
                let context = format!("{}:{line}", file.display());
                assert_correctly_rounded(literal, &context);
            }
        }
    }
    // The `0.9659258262890683` of `timeline.loop.elSway3d` is the only built-in constant the fast path misreads.
    assert!(
        files.len() > 300 && floats > 3000,
        "only scanned {} files and {floats} float literals, wrong directory?",
        files.len()
    );
}

fn json_files(dir: &Path, out: &mut Vec<PathBuf>) {
    for entry in std::fs::read_dir(dir).expect("preset directory") {
        let path = entry.expect("directory entry").path();
        if path.is_dir() {
            json_files(&path, out);
        } else if path.extension().is_some_and(|ext| ext == "json") {
            out.push(path);
        }
    }
}

/// Extracts the number literals outside string literals, in document order, with line numbers.
fn number_literals(text: &str) -> Vec<(usize, &str)> {
    let bytes = text.as_bytes();
    let (mut out, mut i, mut line) = (Vec::new(), 0, 1);
    while i < bytes.len() {
        match bytes[i] {
            b'\n' => line += 1,
            b'"' => {
                i += 1;
                while i < bytes.len() && bytes[i] != b'"' {
                    i += if bytes[i] == b'\\' { 2 } else { 1 };
                }
            }
            b'-' | b'0'..=b'9' => {
                let start = i;
                while i < bytes.len()
                    && matches!(bytes[i], b'-' | b'+' | b'.' | b'e' | b'E' | b'0'..=b'9')
                {
                    i += 1;
                }
                out.push((line, &text[start..i]));
                continue;
            }
            _ => {}
        }
        i += 1;
    }
    out
}
