//! Import assets: probe media info, compute the digest, then handle the bytes according to the storage mode (video format spec §4.2).
//! - Managed: write to staging, atomically publish to `blobs/` (architecture design §5.2).
//! - Linked: the bytes stay where they are; only the location and fingerprint are recorded.
//!
//! When the caller does not specify, a file defaults to linked, and a directory (code bundle) defaults to being collected in (architecture design §5.1).
//!
//! This time-consuming work is done outside the transaction; inside the transaction only references are added. A crash may leave unreferenced blobs, which later GC cleans up; a database never points at unpublished bytes.

use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::process::Command;
use std::time::SystemTime;

use editor_semantics::{MediaTime, Rate, Ratio, parse_decimal_seconds};
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::error::{EngineResult, ErrorBody, Text, msg};
use crate::model::{AssetKind, AssetStorage, AudioInfo, FileLocator, FrameRateInfo, TreeInfo, VideoInfo};

/// Media type of a directory asset.
pub const DIRECTORY_MEDIA_TYPE: &str = "inode/directory";

/// Media type of a `.lottie` archive (zip). Only Lottie archives are recorded as this.
pub const LOTTIE_ARCHIVE_MEDIA_TYPE: &str = "application/zip";

/// Size limit for Lottie assets: beyond this it is no longer a sticker animation (same limit as the Runtime uses for allowing linked Lottie).
pub const LOTTIE_MAX_BYTES: u64 = 32 << 20;

/// How the bytes are stored on import. When the caller does not specify, [`prepare_import`] decides based on the source (video format spec §4.2).
#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StorageMode {
    /// Copied into the video directory's `blobs/`.
    Managed,
    /// Left where it is; only the location is recorded.
    Linked,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ProbeInfo {
    pub duration: Option<MediaTime>,
    pub timebase: Option<Rate>,
    pub video: Option<VideoInfo>,
    pub audio: Option<AudioInfo>,
}

/// Bytes that are already in place (published to `blobs/`, or confirmed readable where they are), together with their media info, waiting for a transaction to reference them.
#[derive(Clone, Debug, PartialEq)]
pub struct PreparedAsset {
    pub kind: AssetKind,
    pub content_hash: String,
    pub byte_length: u64,
    pub media_type: String,
    pub original_name: String,
    pub probe: ProbeInfo,
    pub storage: AssetStorage,
    pub tree: Option<TreeInfo>,
}

/// Media type is recognized by extension. Files that are not recognized are not imported, so that arbitrary files are not treated as video.
pub fn media_type_of(path: &Path) -> Option<(AssetKind, &'static str)> {
    let ext = path.extension()?.to_str()?.to_ascii_lowercase();
    Some(match ext.as_str() {
        "mp4" | "m4v" => (AssetKind::Video, "video/mp4"),
        "mov" => (AssetKind::Video, "video/quicktime"),
        "webm" => (AssetKind::Video, "video/webm"),
        "mkv" => (AssetKind::Video, "video/x-matroska"),
        "mp3" => (AssetKind::Audio, "audio/mpeg"),
        "m4a" | "aac" => (AssetKind::Audio, "audio/mp4"),
        "wav" => (AssetKind::Audio, "audio/wav"),
        "flac" => (AssetKind::Audio, "audio/flac"),
        "ogg" | "oga" | "opus" => (AssetKind::Audio, "audio/ogg"),
        "png" => (AssetKind::Image, "image/png"),
        "jpg" | "jpeg" => (AssetKind::Image, "image/jpeg"),
        "webp" => (AssetKind::Image, "image/webp"),
        "gif" => (AssetKind::Image, "image/gif"),
        "svg" => (AssetKind::Image, "image/svg+xml"),
        "ttf" => (AssetKind::Font, "font/ttf"),
        "otf" => (AssetKind::Font, "font/otf"),
        "woff2" => (AssetKind::Font, "font/woff2"),
        "srt" => (AssetKind::Caption, "application/x-subrip"),
        "vtt" => (AssetKind::Caption, "text/vtt"),
        "ass" => (AssetKind::Caption, "text/x-ass"),
        // A JSON that reads as a Lottie animation is recorded as `lottie` in [`prepare_import`]; other JSON remains `other`.
        "json" => (AssetKind::Other, "application/json"),
        "lottie" => (AssetKind::Lottie, LOTTIE_ARCHIVE_MEDIA_TYPE),
        _ => return None,
    })
}

/// The blob extension is determined by the media type, so the media channel can give the MIME type by extension.
pub fn blob_extension(media_type: &str) -> &'static str {
    match media_type {
        "video/mp4" => "mp4",
        "video/quicktime" => "mov",
        "video/webm" => "webm",
        "video/x-matroska" => "mkv",
        "audio/mpeg" => "mp3",
        "audio/mp4" => "m4a",
        "audio/wav" => "wav",
        "audio/flac" => "flac",
        "audio/ogg" => "ogg",
        "image/png" => "png",
        "image/jpeg" => "jpg",
        "image/webp" => "webp",
        "image/gif" => "gif",
        "image/svg+xml" => "svg",
        "font/ttf" => "ttf",
        "font/otf" => "otf",
        "font/woff2" => "woff2",
        "application/x-subrip" => "srt",
        "text/vtt" => "vtt",
        "text/x-ass" => "ass",
        "application/json" => "json",
        LOTTIE_ARCHIVE_MEDIA_TYPE => "lottie",
        _ => "bin",
    }
}

/// The relative path of a blob in the video directory: a file is `blobs/<sha256>.<ext>`, a directory is `blobs/<sha256>/`.
pub fn blob_rel_path(content_hash: &str, media_type: &str) -> PathBuf {
    let hex = content_hash.strip_prefix("sha256:").unwrap_or(content_hash);
    if media_type == DIRECTORY_MEDIA_TYPE {
        return PathBuf::from("blobs").join(hex);
    }
    PathBuf::from("blobs").join(format!("{hex}.{}", blob_extension(media_type)))
}

fn hex(digest: impl AsRef<[u8]>) -> String {
    digest.as_ref().iter().map(|b| format!("{b:02x}")).collect()
}

fn rfc3339(time: SystemTime) -> Option<String> {
    let secs = time.duration_since(SystemTime::UNIX_EPOCH).ok()?;
    Some(crate::ids::rfc3339_from_unix(secs.as_secs(), secs.subsec_millis()))
}

/// The name of the volume where the path lies (`/Volumes/<name>/…` on macOS). For hints only.
fn volume_of(path: &Path) -> Option<String> {
    let mut parts = path.components().skip(1);
    match (parts.next()?.as_os_str().to_str()?, parts.next()) {
        ("Volumes", Some(name)) => name.as_os_str().to_str().map(str::to_string),
        _ => None,
    }
}

/// Project marker (architecture design §5.1). The engine only checks whether it exists; it does not parse its contents.
pub const PROJECT_MARKER: &str = ".ccut/project.json";

/// The project directory where the video lives: the nearest layer, going up the parent chain of the video directory, that carries a project marker; if there is none, the parent directory of the video directory
/// (video format spec §4.2). Searches upward level by level in the way `video_dir` is written, without resolving symbolic links.
pub fn project_dir_of(video_dir: &Path) -> PathBuf {
    let parent = video_dir.parent().unwrap_or(video_dir);
    parent
        .ancestors()
        .find(|dir| dir.join(PROJECT_MARKER).is_file())
        .unwrap_or(parent)
        .to_path_buf()
}

/// Literally normalizes a path: removes `.`, and `..` cancels the previous segment. Does not touch the file system and does not resolve symbolic links.
/// A `..` that goes past the root stays at the root (consistent with the operating system's behavior).
pub fn normalize(path: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for part in path.components() {
        match part {
            Component::CurDir => {}
            Component::ParentDir => match out.components().next_back() {
                Some(Component::Normal(_)) => {
                    out.pop();
                }
                Some(Component::RootDir | Component::Prefix(_)) => {}
                _ => out.push(".."),
            },
            other => out.push(other),
        }
    }
    out
}

/// The relative path from directory `from` to `to`, separated by `/` (both are normalized absolute paths).
fn relative_between(from: &Path, to: &Path) -> String {
    let from: Vec<_> = from.components().collect();
    let to: Vec<_> = to.components().collect();
    let common = from.iter().zip(&to).take_while(|(a, b)| a == b).count();
    let parts: Vec<String> = std::iter::repeat_n("..".to_string(), from.len() - common)
        .chain(to[common..].iter().map(|c| c.as_os_str().to_string_lossy().into_owned()))
        .collect();
    if parts.is_empty() { ".".into() } else { parts.join("/") }
}

/// If an absolute path (already normalized) lies inside the video's project directory, returns its form relative to the video directory.
fn project_relative(video_dir: &Path, target: &Path) -> Option<String> {
    let project = project_dir_of(video_dir);
    target.starts_with(&project).then(|| relative_between(video_dir, target))
}

/// The path recorded at link time (video format spec §4.2): the path given by the caller (absolute, or relative to the video directory) is literally normalized. If it is inside the project directory, it is recorded as a path relative to the video directory (it may contain `..`, but never escapes the project directory), so it stays valid after the whole project is moved or renamed. If it is outside the project directory, the absolute path is recorded. If the file itself is a symbolic link, it is not resolved: the link inside the project follows the project.
///
/// First compare using the caller's form. If that does not match, compare once more using the real paths of the two directories (for example `/var` and `/private/var`).
/// If neither is inside the project, record the absolute path in the caller's form. Returns the recorded path and the literally computed absolute path.
pub fn link_path(video_dir: &Path, given: &Path) -> (String, PathBuf) {
    let video_dir = normalize(video_dir);
    let absolute = normalize(&video_dir.join(given));
    if let Some(relative) = project_relative(&video_dir, &absolute) {
        return (relative, absolute);
    }
    let real_dir = fs::canonicalize(&video_dir).ok();
    let real_target = match (absolute.parent(), absolute.file_name()) {
        (Some(parent), Some(name)) => fs::canonicalize(parent).ok().map(|p| p.join(name)),
        _ => None,
    };
    if let (Some(dir), Some(target)) = (real_dir, real_target)
        && let Some(relative) = project_relative(&dir, &target)
    {
        return (relative, absolute);
    }
    (absolute.to_string_lossy().into_owned(), absolute)
}

/// Where the recorded path points now: absolute paths are used as they are; relative paths are evaluated relative to the video directory, and rejected if the result escapes the project directory, so that a video taken from elsewhere cannot use `../../..` to read files outside the project (video format spec §4.2).
pub fn locate_linked(video_dir: &Path, asset_id: &str, path: &str) -> EngineResult<PathBuf> {
    let given = Path::new(path);
    if given.is_absolute() {
        return Ok(normalize(given));
    }
    let video_dir = normalize(video_dir);
    let resolved = normalize(&video_dir.join(given));
    if !resolved.starts_with(project_dir_of(&video_dir)) {
        return Err(
            ErrorBody::asset_missing(
                asset_id,
                msg!(
                    "engine.linkOutsideProject",
                    "The relative path of the linked asset goes outside the project directory, so it is not read"
                ),
            ).details(serde_json::json!({
                "path": path, "reason": "outside-project",
            })),
        );
    }
    Ok(resolved)
}

/// Location of a linked asset: the recorded path (see [`link_path`]), plus the modification time and volume name recorded from the actual file.
pub fn link_locator(video_dir: &Path, given: &Path) -> (FileLocator, PathBuf) {
    let (path, resolved) = link_path(video_dir, given);
    let locator = FileLocator {
        path,
        modified_at: fs::metadata(&resolved).and_then(|m| m.modified()).ok().and_then(rfc3339),
        volume: volume_of(&resolved),
    };
    (locator, resolved)
}

/// Does not copy; only computes a digest and length for a file.
pub fn hash_file(source: &Path) -> EngineResult<(String, u64)> {
    let mut input = File::open(source).map_err(|e| ErrorBody::asset_missing(
            "",
            msg!(
                "engine.fileUnreadable",
                "Cannot read file {path}: {error}",
                path = source.display().to_string(),
                error = e.to_string()
            ),
        ))?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 1 << 20];
    let mut total = 0u64;
    loop {
        let n = input.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
        total += n as u64;
    }
    Ok((format!("sha256:{}", hex(hasher.finalize())), total))
}

/// The files in a directory that belong to the asset, sorted by relative path. Skips hidden files and symbolic links; `include` restricts which files or subdirectories are collected.
pub fn tree_files(root: &Path, include: Option<&[String]>) -> EngineResult<Vec<(String, PathBuf)>> {
    fn walk(dir: &Path, prefix: &str, out: &mut Vec<(String, PathBuf)>) -> EngineResult<()> {
        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.starts_with('.') {
                continue;
            }
            let rel = if prefix.is_empty() { name } else { format!("{prefix}/{name}") };
            let kind = entry.file_type()?;
            if kind.is_dir() {
                walk(&entry.path(), &rel, out)?;
            } else if kind.is_file() {
                out.push((rel, entry.path()));
            }
        }
        Ok(())
    }
    let mut files = Vec::new();
    walk(root, "", &mut files)?;
    if let Some(include) = include {
        files.retain(|(rel, _)| {
            include.iter().any(|inc| {
                let inc = inc.trim_end_matches('/');
                rel == inc || rel.strip_prefix(inc).is_some_and(|rest| rest.starts_with('/'))
            })
        });
    }
    files.sort_by(|a, b| a.0.as_bytes().cmp(b.0.as_bytes()));
    Ok(files)
}

/// The digest of a directory: one line per file `<sha256> <length> <relative path>`, sorted by path, then the whole is hashed again with sha256 (video format spec §4.3).
pub fn hash_tree(root: &Path, include: Option<&[String]>) -> EngineResult<(String, u64, u32)> {
    let files = tree_files(root, include)?;
    if files.is_empty() {
        return Err(ErrorBody::invalid_operation(msg!("engine.directoryEmpty", "The directory has no files to import")));
    }
    let mut manifest = String::new();
    let mut total = 0u64;
    for (rel, path) in &files {
        let (hash, len) = hash_file(path)?;
        manifest.push_str(&format!("{} {len} {rel}\n", hash.trim_start_matches("sha256:")));
        total += len;
    }
    Ok((
        format!("sha256:{}", hex(Sha256::digest(manifest.as_bytes()))),
        total,
        files.len() as u32,
    ))
}

/// Copies a directory into `blobs/<sha256>/` by content address. If the same directory is already there, it is not copied again.
pub fn publish_tree(video_dir: &Path, root: &Path, include: Option<&[String]>, content_hash: &str) -> EngineResult<()> {
    let target = video_dir.join(blob_rel_path(content_hash, DIRECTORY_MEDIA_TYPE));
    if target.is_dir() {
        return Ok(());
    }
    let staging = video_dir.join("blobs").join(".staging").join(crate::ids::new_id("tree"));
    let result = (|| -> EngineResult<()> {
        for (rel, path) in tree_files(root, include)? {
            let to = staging.join(&rel);
            if let Some(parent) = to.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(&path, &to)?;
        }
        fs::rename(&staging, &target)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_dir_all(&staging);
    }
    result
}

/// Publishes a file into `blobs/` by content address, and checks that its digest matches what the asset version records (used when collecting a linked asset).
pub fn publish_verified(video_dir: &Path, source: &Path, media_type: &str, expected_hash: &str) -> EngineResult<()> {
    let (hash, _) = publish_blob(video_dir, source, media_type)?;
    if hash != expected_hash {
        let _ = fs::remove_file(video_dir.join(blob_rel_path(&hash, media_type)));
        return Err(
            ErrorBody::asset_missing(
                "",
                msg!("engine.linkedFileChanged", "The file at the original location no longer matches what was linked"),
            ).details(serde_json::json!({
                "path": source, "expected": expected_hash, "actual": hash,
            })),
        );
    }
    Ok(())
}

/// `given` is the path supplied by the caller: absolute, or (only for linking) relative to the video directory. The location recorded for a link is normalized by [`link_path`]:
/// inside the project directory, recorded as a path relative to the video directory; outside it, recorded as an absolute path.
///
/// When `mode` is not specified: the file stays where it is (`linked`); a directory is a code bundle, has no original file to point to, and is collected into the video (`managed`).
/// Collecting into the video (explicitly or by default) requires an absolute path. A relative path is only for linking, so it remains valid when the video and the assets are moved together.
pub fn prepare_import(
    video_dir: &Path,
    given: &Path,
    ffprobe: &Path,
    mode: Option<StorageMode>,
    include: Option<&[String]>,
) -> EngineResult<PreparedAsset> {
    let relative = !given.is_absolute();
    if relative && mode == Some(StorageMode::Managed) {
        return Err(ErrorBody::invalid_operation(msg!(
            "engine.managedPathRelative",
            "An import copied into the video (managed) needs an absolute path; relative paths are only for links"
        )));
    }
    // The literally normalized absolute path: reading the file and checking whether it is inside the project use the same form.
    let resolved = normalize(&video_dir.join(given));
    let source = resolved.as_path();
    let meta = fs::metadata(source).map_err(|e| ErrorBody::asset_missing(
        "",
        msg!("engine.importUnreadable", "Cannot read the file to import: {error}", error = e.to_string()),
    ))?;
    let original_name = source.file_name().and_then(|n| n.to_str()).unwrap_or("素材").to_string();
    let mode = mode.unwrap_or(if meta.is_dir() { StorageMode::Managed } else { StorageMode::Linked });
    if relative && mode == StorageMode::Managed {
        return Err(ErrorBody::invalid_operation(msg!(
            "engine.directoryPathRelative",
            "An imported directory is copied into the video by default, so its path must be absolute; to link the directory, pass storage: 'linked'"
        )));
    }
    if meta.is_dir() {
        let (content_hash, byte_length, file_count) = hash_tree(source, include)?;
        let storage = match mode {
            StorageMode::Managed => {
                publish_tree(video_dir, source, include, &content_hash)?;
                AssetStorage::Managed
            }
            StorageMode::Linked => AssetStorage::Linked {
                locator: link_locator(video_dir, given).0,
                frozen: false,
            },
        };
        return Ok(PreparedAsset {
            kind: AssetKind::Bundle,
            content_hash,
            byte_length,
            media_type: DIRECTORY_MEDIA_TYPE.to_string(),
            original_name,
            probe: ProbeInfo {
                duration: None,
                timebase: None,
                video: None,
                audio: None,
            },
            storage,
            tree: Some(TreeInfo {
                file_count,
                include: include.map(<[String]>::to_vec),
            }),
        });
    }
    if !meta.is_file() {
        return Err(ErrorBody::invalid_operation(msg!("engine.importNotFile", "Only files or directories can be imported")));
    }
    let (mut kind, media_type) = media_type_of(source).ok_or_else(|| ErrorBody::invalid_operation(msg!("engine.fileTypeUnsupported", "This kind of file is not supported")))?;
    // JSON that reads like a Lottie animation (has a version, frame rate, frame range and layers) is collected as Lottie.
    if kind == AssetKind::Other && media_type == "application/json" && meta.len() <= LOTTIE_MAX_BYTES && looks_like_lottie_json(source) {
        kind = AssetKind::Lottie;
    }
    // Only media that ffprobe recognizes is probed; vector images, fonts, subtitles and data files have no probeable streams. For Lottie, the kernel's reading is used to get the size and duration.
    let probe = if kind == AssetKind::Lottie {
        if meta.len() > LOTTIE_MAX_BYTES {
            return Err(ErrorBody::invalid_operation(msg!(
                "engine.lottieTooLarge",
                "The Lottie animation is over {size} MiB, too large for a sticker animation",
                size = LOTTIE_MAX_BYTES >> 20
            )));
        }
        probe_lottie(source, &original_name)?
    } else if matches!(kind, AssetKind::Video | AssetKind::Audio) || (kind == AssetKind::Image && media_type != "image/svg+xml") {
        probe(source, ffprobe, kind)?
    } else {
        ProbeInfo {
            duration: None,
            timebase: None,
            video: None,
            audio: None,
        }
    };
    // When a video container contains only sound, it is handled as audio.
    if kind == AssetKind::Video && probe.video.is_none() {
        if probe.audio.is_none() {
            return Err(ErrorBody::probe_failed(msg!("engine.noPictureOrSound", "The file has no usable picture or sound")));
        }
        kind = AssetKind::Audio;
    }
    if matches!(kind, AssetKind::Video | AssetKind::Audio) && probe.duration.is_none() {
        return Err(ErrorBody::probe_failed(msg!("engine.durationUnreadable", "Cannot read the duration of the asset")));
    }
    let ((content_hash, byte_length), storage) = match mode {
        StorageMode::Managed => (publish_blob(video_dir, source, media_type)?, AssetStorage::Managed),
        StorageMode::Linked => (
            hash_file(source)?,
            AssetStorage::Linked {
                locator: link_locator(video_dir, given).0,
                frozen: false,
            },
        ),
    };
    Ok(PreparedAsset {
        kind,
        content_hash,
        byte_length,
        media_type: media_type.to_string(),
        original_name,
        probe,
        storage,
        tree: None,
    })
}

/// Copies while computing the digest, writes to staging and flushes to disk, then renames to the content address. If the same blob already exists, this copy is discarded.
fn publish_blob(video_dir: &Path, source: &Path, media_type: &str) -> EngineResult<(String, u64)> {
    let staging_dir = video_dir.join("blobs").join(".staging");
    fs::create_dir_all(&staging_dir)?;
    let staging = staging_dir.join(crate::ids::new_id("import"));
    let result = (|| -> EngineResult<(String, u64)> {
        let mut input = File::open(source)?;
        let mut output = File::create(&staging)?;
        let mut hasher = Sha256::new();
        let mut buf = vec![0u8; 1 << 20];
        let mut total = 0u64;
        loop {
            let n = input.read(&mut buf)?;
            if n == 0 {
                break;
            }
            hasher.update(&buf[..n]);
            output.write_all(&buf[..n])?;
            total += n as u64;
        }
        output.sync_all()?;
        let hash = format!("sha256:{}", hex(hasher.finalize()));
        let target = video_dir.join(blob_rel_path(&hash, media_type));
        if target.exists() {
            fs::remove_file(&staging)?;
        } else {
            fs::rename(&staging, &target)?;
            if let Ok(dir) = File::open(video_dir.join("blobs")) {
                let _ = dir.sync_all();
            }
        }
        Ok((hash, total))
    })();
    if result.is_err() {
        let _ = fs::remove_file(&staging);
    }
    result
}

/// Whether a JSON file looks like a Lottie animation: at the top level, a version `v` (string or number), numeric `fr`/`ip`/`op`, and an array of layers (the same test the asset library uses to recognize Lottie stickers). Those that look like it are handed to the kernel to read; if it cannot be read, it is not collected. Anything that cannot be read or is not JSON counts as not Lottie, and is still collected as ordinary JSON.
fn looks_like_lottie_json(source: &Path) -> bool {
    let Ok(bytes) = fs::read(source) else {
        return false;
    };
    let Ok(Value::Object(doc)) = serde_json::from_slice::<Value>(&bytes) else {
        return false;
    };
    doc.get("v").is_some_and(|v| v.is_string() || v.is_number())
        && ["fr", "ip", "op"]
            .iter()
            .all(|key| doc.get(*key).and_then(Value::as_f64).is_some_and(f64::is_finite))
        && doc.get("layers").is_some_and(Value::is_array)
}

fn lottie_recovery() -> Text {
    msg!(
        "engine.lottieRecovery",
        "Make sure the file is a Lottie animation: JSON exported by bodymovin, or a .lottie archive"
    )
}

/// Size and duration of a Lottie asset: uses the same implementation the kernel uses to read Lottie ([`render_raster::source::Lottie::parse`], JSON or `.lottie` archive). The displayed size is the width and height the animation declares, the frame rate is the animation's frame rate, and the duration is the frame range divided by the frame rate (milliseconds rounded, consistent with how the kernel picks frames). There is no audio track.
/// Not collected if it cannot be read, uses features the kernel does not support, or has no duration.
fn probe_lottie(source: &Path, name: &str) -> EngineResult<ProbeInfo> {
    let bytes = fs::read(source).map_err(|e| ErrorBody::asset_missing(
        "",
        msg!("engine.importUnreadable", "Cannot read the file to import: {error}", error = e.to_string()),
    ))?;
    let lottie = render_raster::source::Lottie::parse(name, name, &bytes)
        .map_err(|e| ErrorBody::probe_failed(msg!(
            "engine.lottieUnreadable",
            "Not a readable Lottie animation: {error}",
            error = format!("{e:#}")
        ))
        .recovery(lottie_recovery()))?;
    let meta = lottie.metadata();
    let total_ms = meta.total_ms();
    if total_ms <= 0 {
        return Err(ErrorBody::probe_failed(msg!(
            "engine.lottieNoDuration",
            "The Lottie animation has no duration (its frame range is empty)"
        ))
        .recovery(lottie_recovery()));
    }
    let duration = Ratio::new(total_ms as i128, 1000)
        .and_then(|d| MediaTime::from_ratio(d, "duration").ok())
        .ok_or_else(|| ErrorBody::probe_failed(msg!("engine.lottieDurationRange", "The duration of the Lottie animation is out of range")))?;
    let fr = lottie.frame_rate();
    // The frame rate is taken as a rational to one thousandth and reduced (29.97 is recorded as 2997/100); integer frame rates are kept as is.
    let rate = Ratio::new((fr * 1000.0).round() as i128, 1000)
        .and_then(to_rate)
        .ok_or_else(|| ErrorBody::probe_failed(msg!("engine.lottieFrameRate", "The Lottie animation has an invalid frame rate: {rate}", rate = fr)))?;
    let video = VideoInfo {
        display_width: meta.width,
        display_height: meta.height,
        rotation: 0,
        pixel_aspect_ratio: Rate { num: 1, den: 1 },
        frame_rate: FrameRateInfo::Cfr { rate },
        pts_origin: MediaTime::zero(),
        has_alpha: true,
    };
    Ok(ProbeInfo {
        duration: Some(duration),
        timebase: None,
        video: Some(video),
        audio: None,
    })
}

/// Reads media info with ffprobe. Duration and PTS are converted exactly using the stream's integer timebase, not floating point.
pub fn probe(source: &Path, ffprobe: &Path, kind: AssetKind) -> EngineResult<ProbeInfo> {
    let output = Command::new(ffprobe)
        .args(["-v", "error", "-print_format", "json", "-show_format", "-show_streams"])
        .arg(source)
        .output()
        .map_err(|e| ErrorBody::probe_failed(msg!(
            "engine.ffprobeNotRunnable",
            "Cannot run ffprobe ({path}): {error}",
            path = ffprobe.display().to_string(),
            error = e.to_string()
        )))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(ErrorBody::probe_failed(msg!(
            "engine.ffprobeFailed",
            "ffprobe cannot read this file: {error}",
            error = stderr.trim()
        )));
    }
    let json: Value =
        serde_json::from_slice(&output.stdout).map_err(|e| ErrorBody::probe_failed(msg!(
            "engine.ffprobeOutputInvalid",
            "The output of ffprobe cannot be parsed: {error}",
            error = e.to_string()
        )))?;
    Ok(parse_probe(&json, kind))
}

fn parse_rational(text: &str) -> Option<Ratio> {
    let (n, d) = text.split_once('/').or_else(|| text.split_once(':'))?;
    let (n, d): (i128, i128) = (n.trim().parse().ok()?, d.trim().parse().ok()?);
    if n <= 0 || d <= 0 {
        return None;
    }
    Ratio::new(n, d)
}

fn to_rate(r: Ratio) -> Option<Rate> {
    Rate::new(i64::try_from(r.num()).ok()?, i64::try_from(r.den()).ok()?).ok()
}

/// The exact duration of one stream: `duration_ts × time_base`; falls back to the decimal `duration` when absent.
fn stream_duration(stream: &Value) -> Option<Ratio> {
    let time_base = stream.get("time_base").and_then(Value::as_str).and_then(parse_rational);
    if let (Some(tb), Some(ts)) = (time_base, stream.get("duration_ts").and_then(Value::as_i64))
        && ts > 0
    {
        return Ratio::from_int(ts as i128)?.checked_mul(tb);
    }
    decimal(stream.get("duration"))
}

fn decimal(value: Option<&Value>) -> Option<Ratio> {
    let text = value?.as_str()?;
    parse_decimal_seconds(text, "duration").ok().filter(|r| !r.is_negative())
}

pub fn parse_probe(json: &Value, kind: AssetKind) -> ProbeInfo {
    let streams = json.get("streams").and_then(Value::as_array).cloned().unwrap_or_default();
    let is = |s: &&Value, t: &str| s.get("codec_type").and_then(Value::as_str) == Some(t);
    let attached = |s: &&Value| s.get("disposition").and_then(|d| d.get("attached_pic")).and_then(Value::as_i64) == Some(1);
    let video_stream = streams
        .iter()
        .find(|s| is(s, "video") && (kind == AssetKind::Image || !attached(s)));
    let audio_stream = streams.iter().find(|s| is(s, "audio"));

    let video = video_stream.and_then(|s| {
        let width = s.get("width")?.as_u64()? as u32;
        let height = s.get("height")?.as_u64()? as u32;
        let rotation = rotation_of(s);
        let (display_width, display_height) = if rotation % 180 == 90 { (height, width) } else { (width, height) };
        let r = s.get("r_frame_rate").and_then(Value::as_str).and_then(parse_rational);
        let avg = s.get("avg_frame_rate").and_then(Value::as_str).and_then(parse_rational);
        let frame_rate = match (r.and_then(to_rate), avg) {
            (Some(rate), Some(avg)) if r == Some(avg) => FrameRateInfo::Cfr { rate },
            (nominal, _) => FrameRateInfo::Vfr { nominal },
        };
        let time_base = s.get("time_base").and_then(Value::as_str).and_then(parse_rational);
        let pts_origin = match (time_base, s.get("start_pts").and_then(Value::as_i64)) {
            (Some(tb), Some(pts)) => Ratio::from_int(pts as i128).and_then(|p| p.checked_mul(tb)),
            _ => None,
        }
        .unwrap_or(Ratio::ZERO);
        let pixel_aspect_ratio = s
            .get("sample_aspect_ratio")
            .and_then(Value::as_str)
            .and_then(parse_rational)
            .and_then(to_rate)
            .unwrap_or(Rate { num: 1, den: 1 });
        let pix_fmt = s.get("pix_fmt").and_then(Value::as_str).unwrap_or("");
        let has_alpha = pix_fmt.starts_with("yuva")
            || pix_fmt.contains("rgba")
            || pix_fmt.contains("argb")
            || pix_fmt.contains("bgra")
            || pix_fmt.starts_with("ya");
        Some(VideoInfo {
            display_width,
            display_height,
            rotation,
            pixel_aspect_ratio,
            frame_rate,
            pts_origin: MediaTime::from_ratio(pts_origin, "ptsOrigin").unwrap_or_else(|_| MediaTime::zero()),
            has_alpha,
        })
    });
    let audio = audio_stream.and_then(|s| {
        Some(AudioInfo {
            sample_rate: s.get("sample_rate")?.as_str()?.parse().ok()?,
            channels: s.get("channels")?.as_u64()? as u32,
            layout: s.get("channel_layout").and_then(Value::as_str).map(str::to_string),
        })
    });

    let main = if kind == AssetKind::Audio || video.is_none() {
        audio_stream
    } else {
        video_stream
    };
    let duration = if kind == AssetKind::Image {
        None
    } else {
        main.and_then(stream_duration)
            .or_else(|| decimal(json.get("format").and_then(|f| f.get("duration"))))
    };
    let timebase = main
        .and_then(|s| s.get("time_base"))
        .and_then(Value::as_str)
        .and_then(parse_rational)
        .and_then(to_rate);
    ProbeInfo {
        duration: duration.and_then(|d| MediaTime::from_ratio(d, "duration").ok()),
        timebase,
        video,
        audio,
    }
}

fn rotation_of(stream: &Value) -> u32 {
    let from_matrix = stream
        .get("side_data_list")
        .and_then(Value::as_array)
        .and_then(|list| list.iter().find_map(|d| d.get("rotation").and_then(Value::as_f64)));
    let from_tag = stream
        .get("tags")
        .and_then(|t| t.get("rotate"))
        .and_then(Value::as_str)
        .and_then(|r| r.parse::<f64>().ok());
    let degrees = from_matrix.or(from_tag).unwrap_or(0.0).round() as i64;
    (degrees.rem_euclid(360) / 90 * 90) as u32
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn probe_uses_exact_stream_timebase() {
        let json = json!({
            "streams": [
                { "codec_type": "video", "width": 1920, "height": 1080, "r_frame_rate": "30000/1001", "avg_frame_rate": "30000/1001",
                  "time_base": "1/30000", "duration_ts": 300300, "start_pts": 0, "pix_fmt": "yuv420p",
                  "side_data_list": [{ "rotation": -90 }] },
                { "codec_type": "audio", "sample_rate": "48000", "channels": 2, "channel_layout": "stereo", "time_base": "1/48000" }
            ],
            "format": { "duration": "10.010000" }
        });
        let info = parse_probe(&json, AssetKind::Video);
        assert_eq!(
            info.duration,
            Some(MediaTime {
                ticks: "1001".into(),
                timescale: 100
            })
        );
        let video = info.video.unwrap();
        assert_eq!((video.display_width, video.display_height, video.rotation), (1080, 1920, 270));
        assert_eq!(
            video.frame_rate,
            FrameRateInfo::Cfr {
                rate: Rate { num: 30000, den: 1001 }
            }
        );
        assert_eq!(info.audio.unwrap().sample_rate, 48000);
    }

    #[test]
    fn variable_frame_rate_keeps_only_a_nominal_rate() {
        let json = json!({ "streams": [{ "codec_type": "video", "width": 720, "height": 1280,
            "r_frame_rate": "30/1", "avg_frame_rate": "2997/100", "time_base": "1/600", "duration_ts": 6000 }] });
        let info = parse_probe(&json, AssetKind::Video);
        assert_eq!(
            info.video.unwrap().frame_rate,
            FrameRateInfo::Vfr {
                nominal: Some(Rate { num: 30, den: 1 })
            }
        );
        assert_eq!(
            info.duration,
            Some(MediaTime {
                ticks: "10".into(),
                timescale: 1
            })
        );
    }

    /// A minimal Lottie: 64×48, 25 frames per second, frame range 0–50 (2 seconds), one solid-color layer.
    fn lottie_json() -> Vec<u8> {
        serde_json::to_vec(&json!({
            "v": "5.7.4", "fr": 25, "ip": 0, "op": 50, "w": 64, "h": 48,
            "layers": [{ "ty": 1, "ind": 1, "ip": 0, "op": 50, "st": 0, "sw": 64, "sh": 48, "sc": "#ff0000",
                "ks": { "a": { "a": 0, "k": [0, 0] }, "o": { "a": 0, "k": 100 }, "p": { "a": 0, "k": [0, 0] },
                        "r": { "a": 0, "k": 0 }, "s": { "a": 0, "k": [100, 100] } } }]
        }))
        .unwrap()
    }

    /// Hand-assembles a zip that uses only the “store” method (`(name, content)`).
    fn stored_zip(files: &[(&str, &[u8])]) -> Vec<u8> {
        let crc32 = render_raster::source::lottie::archive::crc32;
        let (mut out, mut central) = (Vec::new(), Vec::new());
        for (name, data) in files {
            let (offset, crc, len) = (out.len() as u32, crc32(data), data.len() as u32);
            out.extend(0x0403_4b50u32.to_le_bytes());
            out.extend([20, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
            out.extend(crc.to_le_bytes());
            out.extend(len.to_le_bytes());
            out.extend(len.to_le_bytes());
            out.extend((name.len() as u16).to_le_bytes());
            out.extend([0, 0]);
            out.extend(name.as_bytes());
            out.extend(*data);
            central.extend(0x0201_4b50u32.to_le_bytes());
            central.extend([20, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
            central.extend(crc.to_le_bytes());
            central.extend(len.to_le_bytes());
            central.extend(len.to_le_bytes());
            central.extend((name.len() as u16).to_le_bytes());
            central.extend([0u8; 12]);
            central.extend(offset.to_le_bytes());
            central.extend(name.as_bytes());
        }
        let (start, size) = (out.len() as u32, central.len() as u32);
        out.extend(central);
        out.extend(0x0605_4b50u32.to_le_bytes());
        out.extend([0, 0, 0, 0]);
        out.extend((files.len() as u16).to_le_bytes());
        out.extend((files.len() as u16).to_le_bytes());
        out.extend(size.to_le_bytes());
        out.extend(start.to_le_bytes());
        out.extend([0, 0]);
        out
    }

    fn import(dir: &Path, name: &str, bytes: &[u8]) -> EngineResult<PreparedAsset> {
        let file = dir.join(name);
        fs::write(&file, bytes).unwrap();
        prepare_import(dir, &file, Path::new("/nonexistent/ffprobe"), Some(StorageMode::Linked), None)
    }

    fn assert_lottie_probe(prepared: &PreparedAsset) {
        assert_eq!(prepared.kind, AssetKind::Lottie);
        assert_eq!(
            prepared.probe.duration,
            Some(MediaTime {
                ticks: "2".into(),
                timescale: 1
            })
        );
        let video = prepared.probe.video.as_ref().unwrap();
        assert_eq!((video.display_width, video.display_height), (64, 48));
        assert_eq!(
            video.frame_rate,
            FrameRateInfo::Cfr {
                rate: Rate { num: 25, den: 1 }
            }
        );
        assert!(prepared.probe.audio.is_none());
    }

    #[test]
    fn a_lottie_json_imports_as_lottie_with_size_and_duration_from_the_kernel_reader() {
        let dir = tempfile::tempdir().unwrap();
        let prepared = import(dir.path(), "wave.json", &lottie_json()).unwrap();
        assert_lottie_probe(&prepared);
        assert_eq!(prepared.media_type, "application/json");
    }

    #[test]
    fn a_dotlottie_archive_imports_as_lottie() {
        let dir = tempfile::tempdir().unwrap();
        let manifest = br#"{"version":"1","animations":[{"id":"wave"}]}"#;
        let archive = stored_zip(&[("manifest.json", manifest), ("animations/wave.json", &lottie_json())]);
        let prepared = import(dir.path(), "wave.lottie", &archive).unwrap();
        assert_lottie_probe(&prepared);
        assert_eq!(prepared.media_type, LOTTIE_ARCHIVE_MEDIA_TYPE);
        assert_eq!(blob_rel_path("sha256:ab", &prepared.media_type), PathBuf::from("blobs/ab.lottie"));
    }

    #[test]
    fn other_json_stays_other_and_unreadable_lottie_is_refused() {
        let dir = tempfile::tempdir().unwrap();
        let other = import(dir.path(), "data.json", br#"{"name":"not an animation"}"#).unwrap();
        assert_eq!(other.kind, AssetKind::Other);
        assert!(other.probe.video.is_none());

        let broken = import(dir.path(), "broken.lottie", b"PK\x03\x04 not really a zip").unwrap_err();
        assert_eq!(broken.code, "MEDIA_PROBE_FAILED", "{broken:?}");
        let empty = import(dir.path(), "empty.lottie", &stored_zip(&[("manifest.json", b"{}")])).unwrap_err();
        assert_eq!(empty.code, "MEDIA_PROBE_FAILED", "{empty:?}");

        let mut shaped: Value = serde_json::from_slice(&lottie_json()).unwrap();
        shaped["op"] = json!(0);
        let no_duration = import(dir.path(), "still.json", &serde_json::to_vec(&shaped).unwrap()).unwrap_err();
        assert_eq!(no_duration.code, "MEDIA_PROBE_FAILED", "{no_duration:?}");
    }
}
