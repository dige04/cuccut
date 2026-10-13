//! Transcendental functions used for animation sampling go only through the `libm` crate, not the same-named std methods.
//!
//! Functions such as `f64::sin` / `cos` / `exp` / `powf` call the system libm on native macOS, and on wasm32 they call the copy bundled in compiler-builtins; the last bit differs. In this crate, the easing, spring and cyclic waveform are the sampling core shared by the web preview (wasm32), export and `MotionProgram` baking (native). A 1 ULP difference would make the poses on the two sides differ, violating the byte-level determinism of animation sampling promised in spec §14.1 and §15.1. `libm` is a pure-Rust port of musl, so every target runs the same algorithm.
//!
//! For powers of base 2, write `libm::exp2(x)`, **not** `libm::pow(2.0, x)`: LLVM already rewrote std's `2f64.powf(x)` into `exp2`, so writing `exp2` leaves wasm32 bit-identical; switching to `pow` would make 9.7% of the points on the easing exponent interval `[-10, 0]` differ by 1 ULP.
//!
//! The scan is text-level: comment lines are skipped, and the needles are `x.sin(` and the path form `f64::sin`. Four arithmetic operations, `sqrt`, `floor` / `round`, `abs`, `to_radians` and `mul_add` are IEEE correctly rounded basic operations; `powi` is only used with powers 2 and 3, which both targets compute as the same-order multiplications. None of these are in the needles. The actual wasm32 build output is cross-checked by `apps/web/tests/unit/render/wasm-motion-parity.test.ts` (`core/fixtures/motion/wasm-parity.json`).

use std::fs;
use std::path::{Path, PathBuf};

/// The `f32` / `f64` methods that std dispatches to the platform math library.
const TRANSCENDENTAL: &[&str] = &[
    "sin", "cos", "tan", "sin_cos", "asin", "acos", "atan", "atan2", "sinh", "cosh", "tanh",
    "asinh", "acosh", "atanh", "exp", "exp2", "exp_m1", "ln", "ln_1p", "log", "log2", "log10",
    "powf", "hypot", "cbrt", "gamma", "ln_gamma",
];

const HINT: &str = "改调 libm：同名的直接换（`x.sin()` → `libm::sin(x)`），`ln` → `log`，\
                    `ln_1p` → `log1p`，`exp_m1` → `expm1`，`sin_cos` → `sin` + `cos`，\
                    `powf` → `pow`，底数为 2 的写 `exp2`";

/// A std transcendental function called on a line: a method call `x.sin(`, or the path `f64::sin` (called, or passed as a function value).
fn std_calls(line: &str) -> Vec<&'static str> {
    TRANSCENDENTAL
        .iter()
        .copied()
        .filter(|name| {
            line.contains(&format!(".{name}("))
                || ["f64::", "f32::"].iter().any(|ty| {
                    let path = format!("{ty}{name}");
                    line.match_indices(&path).any(|(at, _)| {
                        !line[at + path.len()..]
                            .starts_with(|c: char| c.is_alphanumeric() || c == '_')
                    })
                })
        })
        .collect()
}

fn rust_files(dir: &Path, out: &mut Vec<PathBuf>) {
    for entry in fs::read_dir(dir).expect("source directory") {
        let path = entry.expect("directory entry").path();
        if path.is_dir() {
            rust_files(&path, out);
        } else if path.extension().is_some_and(|ext| ext == "rs") {
            out.push(path);
        }
    }
}

#[test]
fn the_scanner_sees_both_call_forms_and_ignores_libm() {
    assert_eq!(std_calls("let y = (t * PI / 2.0).sin();"), ["sin"]);
    assert_eq!(
        std_calls("let (s, c) = a.to_radians().sin_cos();"),
        ["sin_cos"]
    );
    assert_eq!(std_calls("f64::exp2(x) + 2f64.powf(x)"), ["exp2", "powf"]);
    assert_eq!(std_calls("xs.iter().copied().map(f64::cos)"), ["cos"]);
    assert!(std_calls("libm::exp2(-10.0 * t) * libm::sin(x)").is_empty());
    assert!(std_calls("f64::sinh_table + x.sine(1)").is_empty());
}

#[test]
fn motion_sampling_calls_transcendental_functions_through_libm_only() {
    let src = Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    let mut files = Vec::new();
    rust_files(&src, &mut files);
    files.sort();
    let mut hits = Vec::new();
    let mut libm_calls = 0;
    for file in &files {
        let text = fs::read_to_string(file).expect("read source");
        for (index, line) in text.lines().enumerate() {
            if line.trim_start().starts_with("//") {
                continue;
            }
            libm_calls += line.matches("libm::").count();
            for name in std_calls(line) {
                hits.push(format!("{}:{}: {name}", file.display(), index + 1));
            }
        }
    }
    assert!(
        files.len() > 20 && libm_calls >= 10,
        "只扫到 {} 个文件、{libm_calls} 处 libm 调用，目录找错了？",
        files.len()
    );
    assert!(
        hits.is_empty(),
        "取样核调了 std 的超越函数，native 与 wasm32 末位会不同。{HINT}：\n{}",
        hits.join("\n")
    );
}
