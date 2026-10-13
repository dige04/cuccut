//! The gate "subtitle layout may have only one implementation" (main plan D2 / D6).
//!
//! The whole value chain of App v2 rests on this one: CLI burn-in and App preview must be the same kernel, "same input, same pixels, any difference is a bug" (M1-R3). Moving code only relocates it. It cannot stop someone three months from now from writing a "quick simplified layout to plug the gap" inside `apps/cuccut`. That copy would quietly fork from the kernel while every test stays green.
//!
//! So this scans source text. The kernel's entry-point names, the style projection function, the shared ratio constants, and the construction of the spectrum cache path may appear only in this crate. Hosts may call them freely, but may not write their own copy.
//!
//! The scan is text-level and deliberately coarse. It catches "someone reproduced an implementation with the same name", and does not aim for semantic precision. The right way to handle a false positive is to register it in [`ALLOWED`] with a stated reason, not to slip the needle past by renaming it.
//!
//! The only exception is **identifier prefixes**: the needle `enum LineKind` would also catch `enum LineKindName`. That is another type with another name, not a copy. So matching is confined to word boundaries (see [`needle_hits`]), instead of adding path entries to [`ALLOWED`]. Adding a path would also exempt a real future `enum LineKind` definition in the same file.

use std::fs;
use std::path::{Path, PathBuf};

/// The scanned host source tree. Crates outside the kernel likewise may not duplicate the implementation.
///
/// v3: v2 scanned `apps/cli/src`, `apps/cuccut/src` and `core/crates`. v3's Rust lives in `crates/` and `bindings/` (`apps/` is TypeScript).
const SCANNED: &[&str] = &["crates", "bindings"];

/// Known and deliberately retained hits: `(path suffix, needle, reason)`.
///
/// Only two kinds of entry qualify: **the single definition site of that symbol**, and **a host shell whose function body is a one-line forward**. A new entry must state which kind it is. "Leave it here for now" is not a reason, and renaming the needle to slip past is even less acceptable.
const ALLOWED: &[(&str, &str, &str)] = &[
    (
        "timeline/src/effects.rs",
        "const REFERENCE_SHORT_EDGE",
        "参考短边的唯一定义处；本 crate 与 timeline-render / render-raster 都从这里取。",
    ),
    // v2 also had `fn media_fingerprint` in `ccut-serve/src/endpoints/media.rs` (a one-line forwarding host shell). `ccut-serve` is not ported (architecture design §13.6), so the entry is removed with it. Otherwise the self-check below would report it as stale.
];

fn repo_root() -> PathBuf {
    let mut dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    // `exists()` rather than `is_dir()`: in a git worktree, `.git` is a **file** (content `gitdir: …`). Tightening to `is_dir()` would make this gate walk up to the filesystem root and panic in every worktree, and agents do their work precisely in worktrees.
    while !dir.join(".git").exists() {
        dir = dir
            .parent()
            .expect("从 crate 目录向上找不到仓库根（.git）")
            .to_path_buf();
    }
    dir
}

fn collect(dir: &Path, out: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name.starts_with('.') || name == "target" || name == "node_modules" {
            continue;
        }
        if path.is_dir() {
            // The kernel is itself the single implementation and does not take part in the scan.
            if path.ends_with("subtitle-render") {
                continue;
            }
            collect(&path, out);
        } else if path.extension().is_some_and(|ext| ext == "rs") {
            out.push(path);
        }
    }
}

/// Word-boundary matching: a hit followed by a letter, digit or underscore does not count.
///
/// The `enum LineKindName` in `ccut-wasm-editor` is a wire-name enum for JS, with two `From` impls converting to and from `ccut_editor_core::selection::LineKind`. It carries no second copy of the logic. But substring matching would treat it as a copy of `enum LineKind`.
///
/// Only the **trailing** side is tightened. Needles such as `": &str = \".spectrum.bin\""` already begin with punctuation, and adding a boundary to their prefix would break them completely. The cost is that `enum LineKindV2`, which writes another copy under a different suffix, is no longer caught. The gate exists only to block same-name copies, and the module docs already state that renaming to slip past is not an acceptable practice.
fn needle_hits(line: &str, needle: &str) -> bool {
    line.match_indices(needle).any(|(at, _)| {
        line[at + needle.len()..]
            .chars()
            .next()
            .is_none_or(|ch| !ch.is_alphanumeric() && ch != '_')
    })
}

fn scan(needles: &[&str], guidance: &str) {
    let root = repo_root();
    let mut files = Vec::new();
    for scanned in SCANNED {
        collect(&root.join(scanned), &mut files);
    }
    assert!(
        files.len() > 200,
        "扫描只找到 {} 个 .rs 文件，路径大概错了：{SCANNED:?}",
        files.len()
    );

    let mut hits = Vec::new();
    for file in &files {
        let Ok(text) = fs::read_to_string(file) else {
            continue;
        };
        let relative = file.strip_prefix(&root).unwrap_or(file);
        let relative = relative.to_string_lossy().replace('\\', "/");
        for (index, line) in text.lines().enumerate() {
            // Mentioning the kernel's name in comments and docs is fine. It is not a copy.
            let code = line.trim_start();
            if code.starts_with("//") || code.starts_with("*") {
                continue;
            }
            for needle in needles {
                if !needle_hits(line, needle) {
                    continue;
                }
                if ALLOWED
                    .iter()
                    .any(|(path, allowed, _)| relative.ends_with(path) && allowed == needle)
                {
                    continue;
                }
                hits.push(format!("{relative}:{}: {}", index + 1, line.trim()));
            }
        }
    }

    assert!(
        hits.is_empty(),
        "字幕内核出现了第二份实现（主方案 D2）：\n{}\n\n{guidance}",
        hits.join("\n")
    );
}

/// A: the entry point of the overlay render plan may only come from `subtitle_render`.
#[test]
fn no_host_defines_its_own_overlay_render_plan() {
    scan(
        &[
            "struct OverlayRenderPlan",
            "enum OverlayRenderPlan",
            "impl OverlayRenderPlan",
            "struct OverlayFrame",
            "fn render_overlay_png",
            "fn compile_overlay_plan",
        ],
        "宿主要 overlay 帧就调 `subtitle_render::OverlayRenderPlan`；\
         缺什么接口就在内核里加，不要在宿主侧另起一份。",
    );
}

/// B: subtitle style projection (flat blob → line style) may exist in only one place.
#[test]
fn no_host_reimplements_the_subtitle_style_projection() {
    scan(
        &[
            "fn resolve_line_style",
            "fn merged_line_style",
            "fn apply_preview_overlays",
            "fn caption_recipe",
            // With `{`: the needle is meant to catch "another `LineKind` was declared", not any name that merely starts with it. Without this brace, the `enum LineKindName` in `ccut-wasm-editor` (a JSON wire-name shell `"orig" | "trans"` with two `From`s into the kernel LineKind) would be treated as a second implementation.
            "enum LineKind {",
            "struct LineStyle",
        ],
        "样式投影是 Mac / Web / CLI 三端字号与颜色的唯一真相（见 \
         `subtitle_render::resolve_line_style` 的文档）：另写一份 = 三端分叉。",
    );
}

/// C: shared cross-platform ratio constants must not each be written as their own literals.
#[test]
fn no_host_redeclares_the_shared_layout_ratios() {
    scan(
        &[
            "const REFERENCE_SHORT_EDGE",
            "const DEFAULT_BILINGUAL_ORIG_SCALE",
            "const DEFAULT_TRANSLATION_RATIO",
        ],
        "参考短边住在 `timeline::REFERENCE_SHORT_EDGE`，双语字号比例住在 \
         `subtitle_render`；复制字面量的那一端会在下次调参时独自跑偏。",
    );
}

/// D: the filename rule for the BCS1 spectrum cache may exist in only one place.
///
/// The symptom of a fork is misleading. Right after `ccut spectrum` has generated the file, rendering says "spectrum not found, please run ccut spectrum first", because the two sides compute different filenames.
#[test]
fn no_host_reconstructs_the_spectrum_cache_path() {
    scan(
        &[
            ": &str = \".spectrum.bin\"",
            "fn spectrum_cache_path",
            "fn media_fingerprint",
        ],
        "频谱缓存路径走 `subtitle_render::paths::spectrum_cache_path`；\
         CLI 的 `services::spectrum::cache_path` 已经是转发别名。",
    );
}

/// E: the style gallery may only describe "which style is wanted". It may not compute its own render geometry.
///
/// In round 62 the prototype used a 540px reference canvas, `displayPadding`, and a `fontPx * pad / 80` formula. A style card must hand the complete style blob to the shared kernel. Once these prototype-private formulas enter the host, the tile, stage and export each draw their own version.
///
/// The list follows the code. The `stylepane` / `tile_beat` families were moved down into `ccut-editor-core` in P2 batch four (`e8d2ee26`) and batch twelve (`bdce1fd6`), and the App-side files of the same names were deleted. So this checks both the **new home** and the half still in the App. A file on the list that is missing panics directly. That is exactly the alarm this gate is meant to raise: the next move must come back and update this list, rather than the scan silently finding nothing.
// v3: the named files were in v2's `ccut-editor-core` and `apps/cuccut`. v3 does not yet have a Rust implementation of the style gallery.
#[test]
#[ignore = "点名 v2 的 ccut-editor-core 与 apps/cuccut 的样式画廊源文件：待 ccut-editor-core 移植"]
fn subtitle_style_gallery_has_no_prototype_render_math() {
    let root = repo_root();
    // The files named here are the data-fetching surface of the App-side style gallery: the card catalog, the hover-to-preview overlay, and the mini-sample beat. `adapters/stylepane.rs` used to be here too, but `e8d2ee26` deleted it when it moved the stylepane cluster down into `ccut-editor-core`. Core's copy is covered by the full scan of A–D above, so it is no longer named by this entry.
    let mut files = vec![
        root.join("core/crates/ccut-editor-core/src/stylepane.rs"),
        root.join("core/crates/ccut-editor-core/src/style_library.rs"),
        root.join("core/crates/ccut-editor-core/src/style_peek.rs"),
        root.join("core/crates/ccut-editor-core/src/tile_beat.rs"),
        root.join("apps/cuccut/src/host/style_library.rs"),
    ];
    collect(
        &root.join("apps/cuccut/src/app/editor/stylepane"),
        &mut files,
    );
    assert!(
        files.len() > 4,
        "样式画廊名单只剩 {} 个文件：apps/cuccut/src/app/editor/stylepane 大概搬家了",
        files.len()
    );

    let forbidden = [
        "/ 540.0",
        "/540.0",
        "displayPadding",
        "leadIn",
        "fontPx * pad",
        "font_px * pad",
    ];
    let mut hits = Vec::new();
    for file in files {
        // When a named file is renamed or moved, this must fail loudly and say **which one and what to do**. The original `expect("style gallery source is readable")` left only a bare `NotFound`. After `adapters/stylepane.rs` was deleted, this gate stayed red for a long time and nobody could tell why.
        let text = fs::read_to_string(&file).unwrap_or_else(|err| {
            panic!(
                "读不到点名的样式画廊源文件 {}：{err}\n\
                 它被改名或搬走了就在本测试的 `files` 列表里同步——删掉这一行等于\
                 悄悄放弃这一份的覆盖，要删就在提交信息里写清去向。",
                file.strip_prefix(&root).unwrap_or(&file).display()
            )
        });
        for (index, line) in text.lines().enumerate() {
            let code = line.trim_start();
            if code.starts_with("//") || code.starts_with("*") {
                continue;
            }
            for needle in forbidden {
                if line.contains(needle) {
                    hits.push(format!(
                        "{}:{}: {}",
                        file.strip_prefix(&root).unwrap_or(&file).display(),
                        index + 1,
                        line.trim()
                    ));
                }
            }
        }
    }
    assert!(
        hits.is_empty(),
        "App 字幕样式画廊复制了原型渲染数学：\n{}\n\n把样式 blob 交给 \
         subtitle_render，让 tile/stage/export 继续共享同一份排版。",
        hits.join("\n")
    );
}

/// Entries in ALLOWED that no longer hit must be reported as errors.
///
/// This list is a register of "known and deliberately done, with reasons stated", not a permanent exemption. If the line that was exempted is deleted but the entry stays, the next time a real `fn media_fingerprint` copy appears in that same file the gate would let it through silently. `unused_allow` in `ccut-serve/src/thin_shell_gate.rs` is the same self-check.
///
/// The check here can be exact **down to the needle**. ALLOWED triples already carry the needle, so it asks directly whether this needle still hits in this file. It uses the same criteria as [`scan`]'s exemption check, word for word from the same source: the same [`needle_hits`] word boundary, and the same skipping of comment lines.
#[test]
fn the_allowlist_has_no_stale_entries() {
    let root = repo_root();
    let mut files = Vec::new();
    for scanned in SCANNED {
        collect(&root.join(scanned), &mut files);
    }

    let mut stale = Vec::new();
    for (path, needle, reason) in ALLOWED {
        let live = files.iter().any(|file| {
            let relative = file.strip_prefix(&root).unwrap_or(file);
            if !relative
                .to_string_lossy()
                .replace('\\', "/")
                .ends_with(path)
            {
                return false;
            }
            let Ok(text) = fs::read_to_string(file) else {
                return false;
            };
            text.lines().any(|line| {
                let code = line.trim_start();
                !code.starts_with("//") && !code.starts_with("*") && needle_hits(line, needle)
            })
        });
        if !live {
            stale.push(format!("{path} 的 `{needle}`（{reason}）"));
        }
    }
    assert!(
        stale.is_empty(),
        "ALLOWED 里这些条目已经不再命中（文件没了，或那一行已删/已改名），\n         请删掉条目：\n{}",
        stale.join("\n")
    );
}
