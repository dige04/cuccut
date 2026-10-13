//! The **only** resolution implementation for project media paths and derived cache paths.
//!
//! The three pieces of content were moved from `core/crates/ccut-kernel/src/project_source_path.rs` (the whole file), `core/crates/ccut-kernel/src/services/waveform.rs` (`project_media_path` / `media_fingerprint`) and `core/crates/ccut-kernel/src/services/spectrum.rs` (`cache_path` / `CACHE_SUFFIX`).
//!
//! They must live in the same crate as the render kernel. `ccut spectrum`, `GET /__ccut/spectrum`, export and the App preview all look up BCS1 caches by the same path rules. With a different resolution, one would compute a different filename, and “the command just generated it but rendering says it cannot be found” is exactly how that happens. Injecting it would require every host to replicate the weak fingerprint and naming. That is the second implementation D2 forbids, and the scan test would not catch it. The CLI side's `waveform` / `spectrum` forward from here.
//!
//! The timeline contract stores relative source paths from the project root (`media/...`). CucCut Mac 1.0.7 briefly wrote image-watermark sources as media-directory-relative paths (`watermark/...`). Prefer the canonical path, but fall back to that legacy spelling so existing projects remain exportable.
//!
//! The timeline contract stores relative source paths from the project root (`media/...`). CucCut Mac 1.0.7 briefly wrote image-watermark sources as media-directory-relative paths (`watermark/...`). Prefer the canonical path, but fall back to that legacy spelling so existing projects remain exportable.

use anyhow::{Context, Result, bail};
use serde_json::Value;
use std::path::{Path, PathBuf};

pub fn resolve(project: &Path, raw: &str) -> PathBuf {
    let declared = PathBuf::from(raw);
    if declared.is_absolute() {
        return declared;
    }

    let canonical = project.join(&declared);
    if canonical.is_file() || declared.starts_with("media") {
        return canonical;
    }

    let legacy = project.join("media").join(&declared);
    if legacy.is_file() { legacy } else { canonical }
}

/// BCS1 type suffix of the cache filename (originally `spectrum::CACHE_SUFFIX`).
pub const SPECTRUM_CACHE_SUFFIX: &str = ".spectrum.bin";

/// Project media files: main comes from project.json, and additional sources come from the sources in timeline.json.
pub fn project_media_path(root: &Path, source_id: &str) -> Result<PathBuf> {
    let raw = if source_id == "main" {
        let manifest_path = root.join("project.json");
        let manifest: Value = serde_json::from_slice(
            &std::fs::read(&manifest_path)
                .with_context(|| format!("project is missing {}", manifest_path.display()))?,
        )
        .with_context(|| format!("parse {}", manifest_path.display()))?;
        manifest
            .pointer("/media/path")
            .and_then(Value::as_str)
            .filter(|path| !path.is_empty())
            .context("project.json is missing media.path")?
            .to_owned()
    } else {
        let timeline_path = root.join("timeline.json");
        let timeline: timeline::TimelineDocument = serde_json::from_slice(
            &std::fs::read(&timeline_path)
                .with_context(|| format!("project is missing {}", timeline_path.display()))?,
        )
        .with_context(|| format!("parse {}", timeline_path.display()))?;
        timeline
            .sources
            .get(source_id)
            .and_then(|source| source.path.clone())
            .filter(|path| !path.is_empty())
            .with_context(|| format!("source does not exist or has no media path: {source_id}"))?
    };
    let path = resolve(root, &raw);
    if !path.is_file() {
        bail!("media file for source {source_id} does not exist: {}", path.display());
    }
    Ok(path)
}

/// Fast media fingerprint made from path, size and mtime. Avoids computing a content hash for GB-scale media.
pub fn media_fingerprint(path: &Path) -> Result<String> {
    let metadata =
        std::fs::metadata(path).with_context(|| format!("read media metadata {}", path.display()))?;
    let modified = metadata
        .modified()
        .with_context(|| format!("read media modification time {}", path.display()))?
        .duration_since(std::time::UNIX_EPOCH)
        .with_context(|| format!("media modification time is before the Unix epoch: {}", path.display()))?
        .as_secs();
    let lossy = path.to_string_lossy();
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for part in [
        lossy.as_bytes(),
        &metadata.len().to_le_bytes()[..],
        &modified.to_le_bytes()[..],
    ] {
        for &byte in part {
            hash ^= u64::from(byte);
            hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
        }
    }
    Ok(format!("{hash:016x}"))
}

/// `<project>/cache/{media_stem}.{fingerprint}.spectrum.bin`.
///
/// The fingerprint is a weak fingerprint of path, size and mtime (same implementation as BCW1), **used only to select the file**. What goes into the render fingerprint is the content hash in the BCS1 header.
pub fn spectrum_cache_path(project: &Path, media: &Path) -> Result<PathBuf> {
    let fingerprint = media_fingerprint(media)?;
    let stem = media
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("media");
    Ok(project
        .join("cache")
        .join(format!("{stem}.{fingerprint}{SPECTRUM_CACHE_SUFFIX}")))
}

#[cfg(test)]
mod tests {
    use super::resolve;

    #[test]
    fn resolves_canonical_and_legacy_media_relative_sources() {
        let project = tempfile::tempdir().unwrap();
        let media = project.path().join("media/watermark");
        std::fs::create_dir_all(&media).unwrap();
        let logo = media.join("logo.png");
        std::fs::write(&logo, b"png").unwrap();

        assert_eq!(resolve(project.path(), "media/watermark/logo.png"), logo);
        assert_eq!(resolve(project.path(), "watermark/logo.png"), logo);
    }

    #[test]
    fn prefers_the_project_root_when_both_spellings_exist() {
        let project = tempfile::tempdir().unwrap();
        let canonical = project.path().join("overlay.png");
        let fallback = project.path().join("media/overlay.png");
        std::fs::create_dir_all(fallback.parent().unwrap()).unwrap();
        std::fs::write(&canonical, b"root").unwrap();
        std::fs::write(&fallback, b"media").unwrap();

        assert_eq!(resolve(project.path(), "overlay.png"), canonical);
    }

    #[test]
    fn keeps_the_declared_path_when_no_candidate_exists() {
        let project = tempfile::tempdir().unwrap();
        assert_eq!(
            resolve(project.path(), "missing/logo.png"),
            project.path().join("missing/logo.png")
        );
    }
}
