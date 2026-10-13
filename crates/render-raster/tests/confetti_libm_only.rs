//! The transcendental functions in the confetti sampling kernel go only through the `libm` crate (same reasoning as `ccut-motion/tests/libm_only.rs`).
//!
//! `confettiSample` in `ccut-wasm` serializes the f64 particle table from `confetti_particles` as-is for JS. On this path, a `sin` that differs by 1 ULP would make the coordinates the web thumbnail and catalog grid get differ from native. Before the fix, nine of the ten styles did not match (`apps/web/tests/unit/render/wasm-motion-parity.test.ts`).
//!
//! The sampling path is `kernel.rs` (the closed-form motion kernel) and `shapes.rs` (unit shapes; star vertices reach their boundary through `path_d`). Both files are scanned in full, and no std transcendental function is allowed anywhere in them. `confetti_frame` in `draw.rs` turns the particle rotation into an f32 affine (`sin_cos`), which belongs to the composition layer: spec §15.1 promises pixel-level determinism for DrawOp, and like `element_transform` in `ccut-timeline-render` it stays on std. Here it is pinned as the single place in `draw.rs`, so any new call added in `confetti_particles` will still fail the check.
//!
//! The scan is text-level and skips comment lines. The one occurrence in `draw.rs` is also a positive example for the scanner, which recognizes `sin_cos`. The `libm::sin(` calls in `kernel.rs` / `shapes.rs` are negative examples that it must not flag.

use std::fs;
use std::path::Path;

/// `f32` / `f64` methods that on std fall through to the platform math library.
const TRANSCENDENTAL: &[&str] = &[
    "sin", "cos", "tan", "sin_cos", "asin", "acos", "atan", "atan2", "sinh", "cosh", "tanh",
    "asinh", "acosh", "atanh", "exp", "exp2", "exp_m1", "ln", "ln_1p", "log", "log2", "log10",
    "powf", "hypot", "cbrt", "gamma", "ln_gamma",
];

const HINT: &str = "Call libm instead: same-named functions are swapped directly (`x.sin()` → `libm::sin(x)`), `ln` → `log`, \
                    `ln_1p` → `log1p`, `exp_m1` → `expm1`, `sin_cos` → `sin` + `cos`, \
                    `powf` → `pow`, for base 2 write `exp2`";

/// A std transcendental function called on a line: a method call `x.sin(`, or a path `f64::sin` (called or passed as a function value).
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

/// The `(line number, function name)` of std transcendental calls in `src/source/confetti/<file>`, and the number of occurrences of `libm::`.
fn scan(file: &str) -> (Vec<(usize, &'static str)>, usize) {
    let path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("src/source/confetti")
        .join(file);
    let text =
        fs::read_to_string(&path).unwrap_or_else(|err| panic!("read {}: {err}", path.display()));
    let mut hits = Vec::new();
    let mut libm_calls = 0;
    for (index, line) in text.lines().enumerate() {
        if line.trim_start().starts_with("//") {
            continue;
        }
        libm_calls += line.matches("libm::").count();
        for name in std_calls(line) {
            hits.push((index + 1, name));
        }
    }
    (hits, libm_calls)
}

#[test]
fn confetti_sampling_calls_transcendental_functions_through_libm_only() {
    for file in ["kernel.rs", "shapes.rs"] {
        let (hits, libm_calls) = scan(file);
        assert!(
            libm_calls > 0,
            "confetti/{file} has no libm calls at all; is the scan target still correct?"
        );
        assert!(
            hits.is_empty(),
            "confetti/{file} calls std transcendental functions (line, name) {hits:?}, \
             `confettiSample` differs in the last digit between native and wasm32. {HINT}"
        );
    }
}

#[test]
fn the_only_std_transcendental_in_confetti_draw_is_the_render_layer_rotation() {
    let (hits, _) = scan("draw.rs");
    let names: Vec<_> = hits.iter().map(|&(_, name)| name).collect();
    assert_eq!(
        names,
        ["sin_cos"],
        "std transcendental functions in confetti/draw.rs (line, name) {hits:?}: the sampling path\
         (`confetti_particles` and the helpers it calls) must avoid them. {HINT}; a new one added in the compositing layer must be registered here"
    );
}
