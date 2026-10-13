//! GC of `blobs/` in the video directory (architecture design §5.2, §5.5): deletes blobs that no record mentions according to the reference graph, and clears staging leftovers that are past the grace period.
//!
//! - The reference set comes from the video store ([`crate::store::Store::referenced_content_hashes`]): digests appearing in all versions of assets, code bundle versions, current entities and the undo records. Undo can bring back deleted assets, so historical versions also count as references.
//! - `blobs/<sha256>.<ext>` and `blobs/<sha256>/` are matched by digest; they are deleted only if the digest is not in the reference set. Entries whose names do not look like this are not managed by the video and are not touched.
//! - Entries in `blobs/.staging/` whose modification time is earlier than the grace period are deleted; those within the grace period are kept (they may be being written).
//! - Only called by the engine while it holds the write lock ([`crate::Video::gc_blobs`]): at the same time no other writer publishes new bytes to `blobs/`. This video's own imports are completed serially on the same `&mut Video`, so they do not interleave with GC.
//! - Frozen task leases, export and portable-package import are outside the engine: when to call is decided by the Runtime (and it does not call while a lease is held).
//!
//! A failed deletion (permissions, file in use) is logged and counted in the receipt's `failed`, and does not fail the whole GC.

use std::collections::HashSet;
use std::fs;
use std::path::Path;
use std::time::{Duration, SystemTime};

/// Default grace period for staging entries: anything newer than this may still be being written, so it is kept.
pub const STAGING_GRACE: Duration = Duration::from_secs(60 * 60);

const HASH_PREFIX: &str = "sha256:";
const HASH_HEX_LEN: usize = 64;

/// One entry deleted by a GC run. `path` is relative to the video directory, using `/` as separator.
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemovedEntry {
    pub path: String,
    pub bytes: u64,
}

/// An entry that could not be deleted, and the reason.
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GcFailure {
    pub path: String,
    pub error: String,
}

/// The receipt of one GC run.
#[derive(Clone, Debug, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlobGcReport {
    /// Unreferenced blobs that were deleted.
    pub removed: Vec<RemovedEntry>,
    /// Staging entries past the grace period that were deleted.
    pub staging_removed: Vec<RemovedEntry>,
    /// Total bytes freed by the two categories above.
    pub freed_bytes: u64,
    /// Number of blobs still referenced and kept.
    pub kept: u64,
    /// Number of staging entries kept because they are within the grace period.
    pub staging_kept: u64,
    /// Entries that do not look like a blob (not managed by the video); not touched.
    pub skipped: Vec<String>,
    pub failed: Vec<GcFailure>,
}

/// Collects all `sha256:<64 lowercase hex digits>` from a piece of text (JSON stored in the database or a digest column), recording only the hex part.
pub(crate) fn collect_hashes(text: &str, out: &mut HashSet<String>) {
    let mut rest = text;
    while let Some(at) = rest.find(HASH_PREFIX) {
        let tail = &rest[at + HASH_PREFIX.len()..];
        let hex: &str = tail.get(..HASH_HEX_LEN).unwrap_or("");
        if is_hash_hex(hex) && !tail[HASH_HEX_LEN..].starts_with(|c: char| c.is_ascii_hexdigit()) {
            out.insert(hex.to_string());
            rest = &tail[HASH_HEX_LEN..];
        } else {
            rest = tail;
        }
    }
}

fn is_hash_hex(text: &str) -> bool {
    text.len() == HASH_HEX_LEN && text.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

/// The digest corresponding to an entry name in `blobs/`: the file is `<hex>.<ext>`, the directory is `<hex>`. Returns `None` if the name is not in this form.
fn blob_hash(name: &str, is_dir: bool) -> Option<&str> {
    if is_dir {
        return is_hash_hex(name).then_some(name);
    }
    let (stem, ext) = name.split_once('.')?;
    (is_hash_hex(stem) && !ext.is_empty() && ext.bytes().all(|b| b.is_ascii_alphanumeric())).then_some(stem)
}

/// Bytes occupied by an entry: for a directory, the sum of its files. Does not follow symbolic links.
fn entry_size(path: &Path) -> u64 {
    let Ok(meta) = fs::symlink_metadata(path) else {
        return 0;
    };
    if !meta.is_dir() {
        return meta.len();
    }
    fs::read_dir(path)
        .map(|entries| entries.flatten().map(|e| entry_size(&e.path())).sum())
        .unwrap_or(0)
}

/// The most recent modification time within an entry: for a directory, the newest of itself and all its descendants (writing a file deep inside does not update the top-level directory's time).
fn newest_mtime(path: &Path) -> Option<SystemTime> {
    let meta = fs::symlink_metadata(path).ok()?;
    let mut newest = meta.modified().ok();
    if meta.is_dir()
        && let Ok(entries) = fs::read_dir(path)
    {
        for entry in entries.flatten() {
            if let Some(time) = newest_mtime(&entry.path()) {
                newest = Some(newest.map_or(time, |n| n.max(time)));
            }
        }
    }
    newest
}

fn remove_entry(path: &Path) -> std::io::Result<()> {
    let meta = fs::symlink_metadata(path)?;
    if meta.is_dir() {
        fs::remove_dir_all(path)
    } else {
        fs::remove_file(path)
    }
}

fn rel(video_dir: &Path, path: &Path) -> String {
    let rel = path.strip_prefix(video_dir).unwrap_or(path);
    rel.components()
        .map(|c| c.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/")
}

/// Deletes one entry and records the result in the receipt; on failure, only logs and `failed`.
fn sweep(video_dir: &Path, path: &Path, removed: &mut Vec<RemovedEntry>, report_freed: &mut u64, failed: &mut Vec<GcFailure>) {
    let bytes = entry_size(path);
    let shown = rel(video_dir, path);
    match remove_entry(path) {
        Ok(()) => {
            *report_freed += bytes;
            removed.push(RemovedEntry { path: shown, bytes });
        }
        Err(error) => {
            eprintln!("video-engine: GC 删不掉 {}：{error}", path.display());
            failed.push(GcFailure {
                path: shown,
                error: error.to_string(),
            });
        }
    }
}

/// Cleans `video_dir/blobs/` against the given reference set. `referenced` holds the hex part of digests (without `sha256:`).
///
/// The caller must hold the video's write lock (see the module description); usually called through [`crate::Video::gc_blobs`].
pub fn gc_blob_dir(video_dir: &Path, referenced: &HashSet<String>, staging_grace: Duration, now: SystemTime) -> BlobGcReport {
    let mut report = BlobGcReport::default();
    let blobs = video_dir.join("blobs");
    let entries = match fs::read_dir(&blobs) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return report,
        Err(error) => {
            eprintln!("video-engine: GC 读不了 {}：{error}", blobs.display());
            report.failed.push(GcFailure {
                path: "blobs".into(),
                error: error.to_string(),
            });
            return report;
        }
    };
    let mut doomed = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name();
        let Some(name) = name.to_str() else {
            report.skipped.push(rel(video_dir, &entry.path()));
            continue;
        };
        if name == ".staging" {
            continue;
        }
        let is_dir = entry.file_type().is_ok_and(|t| t.is_dir());
        match blob_hash(name, is_dir) {
            Some(hash) if referenced.contains(hash) => report.kept += 1,
            Some(_) => doomed.push(entry.path()),
            None => report.skipped.push(rel(video_dir, &entry.path())),
        }
    }
    doomed.sort();
    for path in doomed {
        sweep(video_dir, &path, &mut report.removed, &mut report.freed_bytes, &mut report.failed);
    }

    let staging = blobs.join(".staging");
    if let Ok(entries) = fs::read_dir(&staging) {
        let mut expired = Vec::new();
        for entry in entries.flatten() {
            let path = entry.path();
            // If the time cannot be read, treat it as just written; if the time is in the future, also treat it as just written. Better to keep it one more round.
            match newest_mtime(&path) {
                Some(time) if now.duration_since(time).unwrap_or(Duration::ZERO) >= staging_grace => expired.push(path),
                _ => report.staging_kept += 1,
            }
        }
        expired.sort();
        for path in expired {
            sweep(
                video_dir,
                &path,
                &mut report.staging_removed,
                &mut report.freed_bytes,
                &mut report.failed,
            );
        }
    }
    report.skipped.sort();
    report
}

#[cfg(test)]
mod tests {
    use super::*;

    const A: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    #[test]
    fn hashes_are_found_in_json_and_bare_columns() {
        let mut out = HashSet::new();
        collect_hashes(
            &format!(r#"{{"before":{{"contentHash":"sha256:{A}"}},"x":"sha256:abc","y":"sha256:{A}0"}}"#),
            &mut out,
        );
        assert_eq!(out, HashSet::from([A.to_string()]));
        let mut out = HashSet::new();
        collect_hashes(&format!("sha256:{}", A.to_uppercase()), &mut out);
        assert!(out.is_empty(), "大写的不是引擎写的摘要");
    }

    #[test]
    fn blob_names_are_recognised() {
        assert_eq!(blob_hash(&format!("{A}.png"), false), Some(A));
        assert_eq!(blob_hash(A, true), Some(A));
        assert_eq!(blob_hash(A, false), None, "没有扩展名的文件不是 blob");
        assert_eq!(blob_hash(&format!("{A}.png"), true), None);
        assert_eq!(blob_hash("notes.txt", false), None);
        assert_eq!(blob_hash(&format!("{A}.tar.gz"), false), None);
    }
}
