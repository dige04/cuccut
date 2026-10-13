//! The sampling and geometry of the procedural source `proc` (spec §6.12) use only `libm`. The reasoning and the scanner are the same as in `confetti_libm_only.rs`: the whole point of closed-form evaluation is that any machine and any target (native / wasm32) produces the same bytes for the same `(t, seed)`.
//! Here the whole `src/source/proc/*.rs` directory is scanned, and no std transcendental function may appear (`sqrt` / `floor` / `round` are bit-exact under IEEE 754 and are not on the list).

use std::fs;
use std::path::Path;

const TRANSCENDENTAL: &[&str] = &[
    "sin", "cos", "tan", "sin_cos", "asin", "acos", "atan", "atan2", "sinh", "cosh", "tanh",
    "asinh", "acosh", "atanh", "exp", "exp2", "exp_m1", "ln", "ln_1p", "log", "log2", "log10",
    "powf", "powi", "hypot", "cbrt", "gamma", "ln_gamma",
];

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

#[test]
fn proc_sources_call_transcendental_functions_through_libm_only() {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("src/source/proc");
    let mut files: Vec<_> = fs::read_dir(&dir)
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .filter(|path| path.extension().is_some_and(|ext| ext == "rs"))
        .collect();
    files.sort();
    assert!(files.len() >= 5, "扫描目标还对吗？{files:?}");
    let mut libm_calls = 0;
    let mut hits = Vec::new();
    for path in &files {
        let text = fs::read_to_string(path).unwrap();
        for (index, line) in text.lines().enumerate() {
            if line.trim_start().starts_with("//") {
                continue;
            }
            libm_calls += line.matches("libm::").count();
            for name in std_calls(line) {
                hits.push((path.file_name().unwrap().to_owned(), index + 1, name));
            }
        }
    }
    assert!(libm_calls > 0);
    assert!(
        hits.is_empty(),
        "proc 源调了 std 的数学函数（文件, 行号, 函数名）{hits:?}；改调 libm（`x.sin()` → `libm::sin(x)`）"
    );
}
