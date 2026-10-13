//! Lottie corpus gate (environment-gated).
//!
//! The corpus is **not in the repository** (third-party assets, varied licences, tens of megabytes of art resources). The test points to the local corpus directory via `CCUT_LOTTIE_CORPUS`; if it is unset or the directory does not exist, the whole test is skipped rather than failing — CI and other people's machines simply do not have these assets.
//!
//! For the collection procedure and the census results of 2026-08-20, see `core/fixtures/lottie/README.md`. Only two goldens are checked into the repository:
//!
//! * `golden-frames.json`: **DrawOp fingerprints** of the 12 golden assets at a fixed set of frames.
//!   Pinning fingerprints rather than pixels: the fingerprint covers the vector instructions themselves, is unaffected across machines by rasterization differences or missing external images, and is also the very key that the still-frame cache actually uses.
//! * `corpus-coverage.json`: the **classification results** for the whole corpus under the refined subset boundary — which assets render completely, which are blocked by `lottie-unsupported-feature`, and the reason for each block.
//!   If the subset boundary changes, this table goes red.
//!
//! To regenerate: `CCUT_UPDATE_GOLDEN=1 CCUT_LOTTIE_CORPUS=~/lottie-corpus cargo test -p ccut-render --test lottie_corpus`

use render_raster::drawop::{self, FrameBuilder};
use render_raster::source::lottie::Lottie;
use render_raster::source::{MediaTime, PrepareCtx, VisualSource};
use serde_json::{Value, json};
use std::path::{Path, PathBuf};

const GOLDEN_FRAMES: &str = "tests/fixtures/lottie/golden-frames.json";
const GOLDEN_COVERAGE: &str = "tests/fixtures/lottie/corpus-coverage.json";
const GOLDEN_LIST: &str = "tests/fixtures/lottie/golden-corpus.json";

fn corpus_dir() -> Option<PathBuf> {
    let raw = std::env::var("CCUT_LOTTIE_CORPUS").ok()?;
    let expanded = match raw.strip_prefix("~/") {
        Some(rest) => PathBuf::from(std::env::var("HOME").ok()?).join(rest),
        None => PathBuf::from(raw),
    };
    expanded.is_dir().then_some(expanded)
}

fn fixture(path: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join(path)
}

fn read_json(path: &Path) -> Value {
    serde_json::from_slice(&std::fs::read(path).unwrap_or_else(|e| panic!("read {path:?}: {e}")))
        .unwrap_or_else(|e| panic!("parse {path:?}: {e}"))
}

fn updating() -> bool {
    std::env::var("CCUT_UPDATE_GOLDEN").is_ok_and(|v| v != "0")
}

/// Writing goldens to disk: stable key order (`serde_json`'s `preserve_order` is not enabled ⇒ objects are sorted by `BTreeMap`), two-space indentation, and a trailing newline, so output is byte-comparable.
fn write_golden(path: &Path, value: &Value) {
    let mut text = serde_json::to_string_pretty(value).expect("serialize golden");
    text.push('\n');
    std::fs::write(path, text).unwrap_or_else(|e| panic!("write {path:?}: {e}"));
}

fn assert_or_update(path: &Path, actual: Value) {
    if updating() {
        write_golden(path, &actual);
        return;
    }
    let expected = read_json(path);
    if expected != actual {
        // Reporting differences item by item is much easier to read than a whole-JSON diff
        let (a, b) = (
            serde_json::to_string_pretty(&expected).unwrap(),
            serde_json::to_string_pretty(&actual).unwrap(),
        );
        panic!(
            "{path:?} does not match the current implementation.\nExpected:\n{a}\nActual:\n{b}\n\
             If this is an intended semantic change, regenerate with CCUT_UPDATE_GOLDEN=1 and explain it in the commit."
        );
    }
}

/// All `.json` files in the corpus except the manifest (`manifest.json` is the source list, not a
/// Lottie document).
fn corpus_files(dir: &Path) -> Vec<PathBuf> {
    let mut files: Vec<PathBuf> = std::fs::read_dir(dir)
        .expect("read corpus directory")
        .filter_map(|entry| entry.ok().map(|e| e.path()))
        .filter(|path| {
            path.extension().and_then(|e| e.to_str()) == Some("json")
                && path.file_name().and_then(|n| n.to_str()) != Some("manifest.json")
        })
        .collect();
    files.sort();
    files
}

/// Attach embedded sub-assets; external sub-assets are looked up in the corpus directory, and if not found, reported.
fn attach(lottie: &mut Lottie) -> Result<(), String> {
    let mut loaded = Vec::new();
    for requirement in lottie.image_requirements().to_vec() {
        let Some(bytes) = requirement.embedded.clone() else {
            return Err(format!(
                "外链子资源 {} 不在语料目录里",
                requirement.path.as_deref().unwrap_or("<无路径>")
            ));
        };
        let pixmap = tiny_skia::Pixmap::decode_png(&bytes)
            .or_else(|_| {
                image::load_from_memory(&bytes)
                    .map_err(|e| e.to_string())
                    .and_then(|img| {
                        let rgba = img.to_rgba8();
                        let (w, h) = (rgba.width(), rgba.height());
                        let mut raw = rgba.into_raw();
                        for px in raw.chunks_exact_mut(4) {
                            let pm = tiny_skia::ColorU8::from_rgba(px[0], px[1], px[2], px[3])
                                .premultiply();
                            px[0] = pm.red();
                            px[1] = pm.green();
                            px[2] = pm.blue();
                            px[3] = pm.alpha();
                        }
                        tiny_skia::Pixmap::from_vec(
                            raw,
                            tiny_skia::IntSize::from_wh(w, h).ok_or("零尺寸")?,
                        )
                        .ok_or_else(|| "构造 pixmap 失败".to_string())
                    })
            })
            .map_err(|e| format!("子资源 {} 解码失败：{e}", requirement.id))?;
        loaded.push((requirement.asset_name, bytes, std::sync::Arc::new(pixmap)));
    }
    lottie.attach_images(loaded);
    Ok(())
}

/// Five fixed sample points (first frame / quarter / midpoint / three-quarters / within the last frame).
fn sample_points(total_ms: i64) -> Vec<i64> {
    let last = (total_ms - 1).max(0);
    vec![0, last / 4, last / 2, last * 3 / 4, last]
}

fn record_fingerprint(lottie: &Lottie, ms: i64) -> Result<(u64, usize, usize, usize), String> {
    let mut builder = FrameBuilder::default();
    lottie
        .record(
            MediaTime::from_millis(ms),
            tiny_skia::Transform::identity(),
            &mut builder,
        )
        .map_err(|e| format!("{e:#}"))?;
    let frame = builder.finish();
    Ok((
        drawop::fingerprint(&frame),
        frame.ops.len(),
        frame.paths.len(),
        frame.paints.len(),
    ))
}

#[test]
fn the_refined_subset_classifies_the_whole_corpus_the_way_the_census_promised() {
    let Some(dir) = corpus_dir() else {
        eprintln!("skipped: CCUT_LOTTIE_CORPUS is not set (the corpus is not in the repository, see fixtures/lottie/README.md)");
        return;
    };
    let mut renderable = Vec::new();
    let mut blocked = Vec::new();
    let mut incomplete = Vec::new();
    for path in corpus_files(&dir) {
        let name = path.file_name().unwrap().to_string_lossy().to_string();
        let bytes = std::fs::read(&path).expect("read corpus file");
        match Lottie::parse("corpus", &name, &bytes) {
            Ok(mut lottie) => {
                if let Err(reason) = attach(&mut lottie) {
                    incomplete.push(json!({"file": name, "reason": reason}));
                    continue;
                }
                lottie.prepare(&PrepareCtx::default()).expect("prepare");
                let total = lottie.metadata().total_ms();
                let mut failure = None;
                for ms in sample_points(total) {
                    if let Err(error) = record_fingerprint(&lottie, ms) {
                        failure = Some(error);
                        break;
                    }
                }
                match failure {
                    Some(reason) => incomplete.push(json!({"file": name, "reason": reason})),
                    None => renderable.push(json!({
                        "file": name,
                        "warnings": lottie.diagnostics().len(),
                    })),
                }
            }
            Err(error) => {
                let message = format!("{error:#}");
                assert!(
                    message.contains("lottie-unsupported-feature")
                        || message.contains("lottie-parse"),
                    "a rejected file must give a classifiable diagnostic code; {name} reported: {message}"
                );
                blocked.push(json!({
                    "file": name,
                    "reason": classify(&message),
                }));
            }
        }
    }

    let total = renderable.len() + blocked.len() + incomplete.len();
    assert!(
        total >= 50,
        "corpus too small ({total} files); the census procedure requires 50–100"
    );
    assert_or_update(
        &fixture(GOLDEN_COVERAGE),
        json!({
            "note": "细化子集边界下的语料分类。renderable = parse + prepare + 五个取样点全部发出指令；\
                     blocked = lottie-unsupported-feature fail-fast；incomplete = 子集内但本机缺外链子资源。\
                     renderable + incomplete 就是普查（2026-08-20）说的「细化边界下 strict 覆盖 70/100」。",
            "total": total,
            "renderableCount": renderable.len(),
            "blockedCount": blocked.len(),
            "incompleteCount": incomplete.len(),
            "renderable": renderable,
            "blocked": blocked,
            "incomplete": incomplete,
        }),
    );
}

/// Error text → stable classification keyword (the golden stores this rather than the whole Chinese sentence, so that changing one character does not turn everything red).
fn classify(message: &str) -> &'static str {
    for (needle, label) in [
        ("文字图层", "text-layer"),
        ("表达式", "expression"),
        ("布尔合并路径", "boolean-merge"),
        ("光栅效果", "raster-effect"),
        ("重复器", "repeater"),
        ("3D", "three-d"),
        ("自动定向", "auto-orient"),
        ("遮罩模式", "mask-mode"),
        ("遮罩羽化", "mask-feather"),
        ("混合模式", "blend-mode"),
        ("未知图层类型", "unknown-layer"),
        ("未知形状条目", "unknown-shape"),
        ("轨道遮罩类型", "unknown-matte"),
    ] {
        if message.contains(needle) {
            return label;
        }
    }
    "other"
}

#[test]
fn the_twelve_golden_files_keep_their_draw_op_fingerprints() {
    let Some(dir) = corpus_dir() else {
        eprintln!("skipped: CCUT_LOTTIE_CORPUS is not set");
        return;
    };
    let list = read_json(&fixture(GOLDEN_LIST));
    let entries = list.as_array().expect("golden-corpus.json is an array");
    let mut files = Vec::new();
    for entry in entries {
        let name = entry["file"].as_str().expect("golden entry is missing file");
        let path = dir.join(name);
        assert!(path.is_file(), "golden asset {name} is not in the corpus directory");
        let bytes = std::fs::read(&path).expect("read golden asset");
        let mut lottie = Lottie::parse("golden", name, &bytes)
            .unwrap_or_else(|e| panic!("golden asset {name} must fall within the subset: {e:#}"));
        // Missing external sub-assets do not affect the DrawOp fingerprint: images enter the instruction stream only by asset name
        let _ = attach(&mut lottie);
        let meta = lottie.metadata().clone();
        let samples: Vec<Value> = sample_points(meta.total_ms())
            .into_iter()
            .map(|ms| {
                let (fingerprint, ops, paths, paints) = record_fingerprint(&lottie, ms)
                    .unwrap_or_else(|e| panic!("golden asset {name} failed to record at {ms}ms: {e}"));
                json!({
                    "ms": ms,
                    "ops": ops,
                    "paths": paths,
                    "paints": paints,
                    "drawOpFingerprint": format!("{fingerprint:016x}"),
                })
            })
            .collect();
        files.push(json!({
            "file": name,
            "width": meta.width,
            "height": meta.height,
            "fps": lottie.frame_rate(),
            "frames": meta.frame_count(),
            "warnings": lottie.diagnostics().len(),
            "samples": samples,
        }));
    }
    assert_eq!(files.len(), entries.len());
    assert_or_update(
        &fixture(GOLDEN_FRAMES),
        json!({
            "note": "12 个 golden 素材的 DrawOp 指纹（BCOP v4）。素材不进仓库，\
                     测试经 CCUT_LOTTIE_CORPUS 指向本地语料目录。",
            "rendererTag": "ccut.source.lottie/v1",
            "files": files,
        }),
    );
}

#[test]
fn recording_a_golden_file_is_byte_stable_and_order_independent() {
    let Some(dir) = corpus_dir() else {
        eprintln!("skipped: CCUT_LOTTIE_CORPUS is not set");
        return;
    };
    let list = read_json(&fixture(GOLDEN_LIST));
    for entry in list.as_array().unwrap() {
        let name = entry["file"].as_str().unwrap();
        let path = dir.join(name);
        if !path.is_file() {
            continue;
        }
        let bytes = std::fs::read(&path).unwrap();
        let lottie = Lottie::parse("golden", name, &bytes).unwrap();
        let points = sample_points(lottie.metadata().total_ms());
        let forward: Vec<u64> = points
            .iter()
            .map(|ms| record_fingerprint(&lottie, *ms).unwrap().0)
            .collect();
        let backward: Vec<u64> = points
            .iter()
            .rev()
            .map(|ms| record_fingerprint(&lottie, *ms).unwrap().0)
            .collect();
        assert_eq!(
            forward,
            backward.into_iter().rev().collect::<Vec<_>>(),
            "{name}: out-of-order recording must match in-order recording bit for bit"
        );
    }
}
