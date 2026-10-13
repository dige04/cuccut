//! `.lottie` archive (dotLottie): a zip containing `manifest.json`, `animations/<id>.json`, and sub-resources under `images/`.
//!
//! It reads only the central directory and ignores the lengths in local headers (data descriptors are always ignored):
//!
//! - Only "stored" (0) and "deflate" (8) compression are accepted. Encryption, ZIP64 and multi-disk archives are all rejected.
//! - Each entry is first capped by the size its central directory declares (per entry [`MAX_ENTRY_BYTES`], in total [`MAX_TOTAL_BYTES`], at most [`MAX_ENTRIES`] entries). On decompression it is truncated to the declared size, and the decompressed length and CRC-32 must both match.
//! - Only relative paths are accepted as names. An entry with `..`, an absolute path, a backslash, a drive letter or NUL invalidates the whole archive. Nothing is written to the file system, but an archive like that is not trustworthy in the first place.
//!
//! Choosing which animation: `activeAnimationId` in `manifest.json` (version 1) or `initial.animation` (version 2). If neither is present, take the first item in
//! `animations`. If there is none, take the animation file whose name sorts first. Animations live at `animations/<id>.json` (version 1) or
//! `a/<id>.json` (version 2). Image sub-resources are searched for in the archive in the order given by [`Archive::resolve`].

use anyhow::{Result, anyhow, bail};
use std::collections::BTreeMap;

/// At most this many entries in the archive.
pub const MAX_ENTRIES: usize = 4096;
/// After decompression, a single entry is at most this large.
pub const MAX_ENTRY_BYTES: u64 = 64 * 1024 * 1024;
/// After decompression, all entries together are at most this large.
pub const MAX_TOTAL_BYTES: u64 = 256 * 1024 * 1024;

const EOCD_SIGNATURE: u32 = 0x0605_4b50;
const ZIP64_LOCATOR_SIGNATURE: u32 = 0x0706_4b50;
const CENTRAL_SIGNATURE: u32 = 0x0201_4b50;
const LOCAL_SIGNATURE: u32 = 0x0403_4b50;
const EOCD_LEN: usize = 22;

/// Whether the bytes are a zip (the start of a local header, or of the end record of an empty archive).
pub fn looks_like_zip(bytes: &[u8]) -> bool {
    bytes.starts_with(b"PK\x03\x04") || bytes.starts_with(b"PK\x05\x06")
}

#[derive(Debug, Clone)]
struct Entry {
    method: u16,
    crc: u32,
    compressed: u64,
    size: u64,
    local_offset: u64,
}

/// A zip whose central directory has been read. Gets decompressed bytes by name.
#[derive(Debug)]
pub struct Archive<'a> {
    bytes: &'a [u8],
    entries: BTreeMap<String, Entry>,
}

fn u16_at(bytes: &[u8], at: usize) -> Result<u16> {
    bytes
        .get(at..at + 2)
        .map(|b| u16::from_le_bytes([b[0], b[1]]))
        .ok_or_else(|| anyhow!("zip is truncated (offset {at})"))
}

fn u32_at(bytes: &[u8], at: usize) -> Result<u32> {
    bytes
        .get(at..at + 4)
        .map(|b| u32::from_le_bytes([b[0], b[1], b[2], b[3]]))
        .ok_or_else(|| anyhow!("zip is truncated (offset {at})"))
}

/// Normalizes names in the archive to `a/b/c`: strips a leading `./`. Unsafe names raise an error.
fn normalise(name: &str) -> Result<String> {
    if name.is_empty()
        || name.contains('\\')
        || name.contains('\0')
        || name.starts_with('/')
        || name.contains(':')
    {
        bail!("zip contains an unsafe name {name:?}");
    }
    let mut parts = Vec::new();
    for part in name.split('/') {
        match part {
            "" | "." => {}
            ".." => bail!("zip contains an unsafe name {name:?}"),
            other => parts.push(other),
        }
    }
    Ok(parts.join("/"))
}

impl<'a> Archive<'a> {
    /// Reads the end record and the central directory. Validates structure and limits only, and does not decompress.
    pub fn open(bytes: &'a [u8]) -> Result<Archive<'a>> {
        if bytes.len() < EOCD_LEN {
            bail!("not a zip: too short");
        }
        // The end record lies between the last 22 bytes and 22 + 65535 (comment) from the end. Search from back to front.
        let last = bytes.len() - EOCD_LEN;
        let first = last.saturating_sub(u16::MAX as usize);
        let eocd = (first..=last)
            .rev()
            .find(|&at| u32_at(bytes, at).ok() == Some(EOCD_SIGNATURE))
            .ok_or_else(|| anyhow!("not a zip: end of central directory record not found"))?;
        if eocd >= 20 && u32_at(bytes, eocd - 20)? == ZIP64_LOCATOR_SIGNATURE {
            bail!("ZIP64 zips are not supported");
        }
        let (disk, cd_disk) = (u16_at(bytes, eocd + 4)?, u16_at(bytes, eocd + 6)?);
        let (on_disk, count) = (u16_at(bytes, eocd + 8)?, u16_at(bytes, eocd + 10)?);
        let (cd_size, cd_offset) = (u32_at(bytes, eocd + 12)?, u32_at(bytes, eocd + 16)?);
        if count == u16::MAX || cd_size == u32::MAX || cd_offset == u32::MAX {
            bail!("ZIP64 zips are not supported");
        }
        if disk != 0 || cd_disk != 0 || on_disk != count {
            bail!("split zips are not supported");
        }
        if usize::from(count) > MAX_ENTRIES {
            bail!("zip has too many entries ({count}, at most {MAX_ENTRIES})");
        }
        let cd_start = cd_offset as usize;
        let cd_end = cd_start
            .checked_add(cd_size as usize)
            .filter(|&end| end <= eocd)
            .ok_or_else(|| anyhow!("zip central directory is out of bounds"))?;

        let mut entries = BTreeMap::new();
        let mut total = 0u64;
        let mut at = cd_start;
        for _ in 0..count {
            if at + 46 > cd_end || u32_at(bytes, at)? != CENTRAL_SIGNATURE {
                bail!("zip central directory is corrupt (offset {at})");
            }
            let flags = u16_at(bytes, at + 8)?;
            let method = u16_at(bytes, at + 10)?;
            let crc = u32_at(bytes, at + 16)?;
            let compressed = u32_at(bytes, at + 20)?;
            let size = u32_at(bytes, at + 24)?;
            let name_len = usize::from(u16_at(bytes, at + 28)?);
            let extra_len = usize::from(u16_at(bytes, at + 30)?);
            let comment_len = usize::from(u16_at(bytes, at + 32)?);
            let local_offset = u32_at(bytes, at + 42)?;
            let name_end = at + 46 + name_len;
            let next = name_end + extra_len + comment_len;
            if next > cd_end {
                bail!("zip central directory is corrupt (offset {at})");
            }
            let raw_name = std::str::from_utf8(&bytes[at + 46..name_end])
                .map_err(|_| anyhow!("zip contains a name that is not UTF-8"))?;
            at = next;
            if flags & 1 != 0 {
                bail!("encrypted zips are not supported ({raw_name})");
            }
            if compressed == u32::MAX || size == u32::MAX || local_offset == u32::MAX {
                bail!("ZIP64 zips are not supported");
            }
            let name = normalise(raw_name)?;
            if raw_name.ends_with('/') {
                continue; // Directory
            }
            if !matches!(method, 0 | 8) {
                bail!("{name} in the zip uses unsupported compression method {method} (only stored and deflate are accepted)");
            }
            if method == 0 && compressed != size {
                bail!("{name} in the zip is stored, but its compressed and uncompressed sizes differ");
            }
            if u64::from(size) > MAX_ENTRY_BYTES {
                bail!("{name} in the zip is too large once decompressed ({size} bytes, at most {MAX_ENTRY_BYTES})");
            }
            total += u64::from(size);
            if total > MAX_TOTAL_BYTES {
                bail!("zip is too large once decompressed in total (at most {MAX_TOTAL_BYTES} bytes)");
            }
            let entry = Entry {
                method,
                crc,
                compressed: u64::from(compressed),
                size: u64::from(size),
                local_offset: u64::from(local_offset),
            };
            if entries.insert(name.clone(), entry).is_some() {
                bail!("zip contains duplicate entry {name}");
            }
        }
        Ok(Archive { bytes, entries })
    }

    /// File names in the archive (normalized, sorted by name, directories excluded).
    pub fn names(&self) -> impl Iterator<Item = &str> {
        self.entries.keys().map(String::as_str)
    }

    /// Extracts one entry. Names are compared using the rules of [`normalise`]. If there is no such entry, returns `Ok(None)`.
    pub fn read(&self, name: &str) -> Result<Option<Vec<u8>>> {
        let Ok(name) = normalise(name) else {
            return Ok(None);
        };
        let Some(entry) = self.entries.get(&name) else {
            return Ok(None);
        };
        let at = usize::try_from(entry.local_offset).map_err(|_| anyhow!("zip entry {name} is out of bounds"))?;
        if u32_at(self.bytes, at)? != LOCAL_SIGNATURE {
            bail!("zip entry {name} has a corrupt local header");
        }
        let name_len = usize::from(u16_at(self.bytes, at + 26)?);
        let extra_len = usize::from(u16_at(self.bytes, at + 28)?);
        let start = at + 30 + name_len + extra_len;
        let end = start
            .checked_add(entry.compressed as usize)
            .filter(|&end| end <= self.bytes.len())
            .ok_or_else(|| anyhow!("zip entry {name} is out of bounds"))?;
        let data = &self.bytes[start..end];
        let out = match entry.method {
            0 => data.to_vec(),
            _ => miniz_oxide::inflate::decompress_to_vec_with_limit(data, entry.size as usize)
                .map_err(|e| anyhow!("failed to decompress zip entry {name}: {:?}", e.status))?,
        };
        if out.len() as u64 != entry.size {
            bail!("the decompressed size of zip entry {name} differs from the declared size");
        }
        if crc32(&out) != entry.crc {
            bail!("zip entry {name} has a bad checksum");
        }
        Ok(Some(out))
    }

    /// Selects one animation (see the module description). Returns its name in the archive and its JSON bytes.
    pub fn animation(&self) -> Result<(String, Vec<u8>)> {
        let manifest = self
            .read("manifest.json")?
            .and_then(|bytes| serde_json::from_slice::<serde_json::Value>(&bytes).ok());
        let wanted = manifest.as_ref().and_then(|m| {
            m.get("activeAnimationId")
                .and_then(serde_json::Value::as_str)
                .or_else(|| m.get("initial")?.get("animation")?.as_str())
                .or_else(|| {
                    m.get("animations")?
                        .as_array()?
                        .first()?
                        .get("id")?
                        .as_str()
                })
                .map(str::to_owned)
        });
        if let Some(id) = wanted {
            for name in [format!("animations/{id}.json"), format!("a/{id}.json")] {
                if let Some(bytes) = self.read(&name)? {
                    return Ok((name, bytes));
                }
            }
        }
        let first = self
            .names()
            .find(|name| {
                (name.starts_with("animations/") || name.starts_with("a/"))
                    && name.ends_with(".json")
            })
            .map(str::to_owned)
            .ok_or_else(|| anyhow!("the `.lottie` package has no animation (animations/*.json or a/*.json)"))?;
        let bytes = self.read(&first)?.expect("name comes from the directory");
        Ok((first, bytes))
    }

    /// Bytes of an image sub-resource in the archive (bodymovin's `u` + `p`). Tries, in turn: this path itself (with the leading `/` stripped, since packaging tools often write `/images/`), `images/<filename>`, `i/<filename>`, and `<filename>`.
    pub fn resolve(&self, path: &str) -> Result<Option<Vec<u8>>> {
        let file_name = path.rsplit('/').next().unwrap_or(path);
        let candidates = [
            path.trim_start_matches('/').to_owned(),
            format!("images/{file_name}"),
            format!("i/{file_name}"),
            file_name.to_owned(),
        ];
        for candidate in candidates {
            if let Some(bytes) = self.read(&candidate)? {
                return Ok(Some(bytes));
            }
        }
        Ok(None)
    }
}

/// CRC-32 (IEEE, the one zip uses).
pub fn crc32(bytes: &[u8]) -> u32 {
    static TABLE: std::sync::OnceLock<[u32; 256]> = std::sync::OnceLock::new();
    let table = TABLE.get_or_init(|| {
        let mut table = [0u32; 256];
        for (n, slot) in table.iter_mut().enumerate() {
            let mut c = n as u32;
            for _ in 0..8 {
                c = if c & 1 != 0 {
                    0xEDB8_8320 ^ (c >> 1)
                } else {
                    c >> 1
                };
            }
            *slot = c;
        }
        table
    });
    !bytes.iter().fold(!0u32, |c, &b| {
        table[((c ^ u32::from(b)) & 0xff) as usize] ^ (c >> 8)
    })
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;

    /// Hand-assembles a zip. Each entry is `(name, content, is_deflate)`.
    pub(crate) fn zip(files: &[(&str, &[u8], bool)]) -> Vec<u8> {
        let mut out = Vec::new();
        let mut central = Vec::new();
        for (name, data, deflate) in files {
            let packed = if *deflate {
                miniz_oxide::deflate::compress_to_vec(data, 6)
            } else {
                data.to_vec()
            };
            let method: u16 = if *deflate { 8 } else { 0 };
            let offset = out.len() as u32;
            let crc = crc32(data);
            out.extend(LOCAL_SIGNATURE.to_le_bytes());
            out.extend(20u16.to_le_bytes());
            out.extend(0u16.to_le_bytes());
            out.extend(method.to_le_bytes());
            out.extend([0u8; 4]);
            out.extend(crc.to_le_bytes());
            out.extend((packed.len() as u32).to_le_bytes());
            out.extend((data.len() as u32).to_le_bytes());
            out.extend((name.len() as u16).to_le_bytes());
            out.extend(0u16.to_le_bytes());
            out.extend(name.as_bytes());
            out.extend(&packed);

            central.extend(CENTRAL_SIGNATURE.to_le_bytes());
            central.extend(20u16.to_le_bytes());
            central.extend(20u16.to_le_bytes());
            central.extend(0u16.to_le_bytes());
            central.extend(method.to_le_bytes());
            central.extend([0u8; 4]);
            central.extend(crc.to_le_bytes());
            central.extend((packed.len() as u32).to_le_bytes());
            central.extend((data.len() as u32).to_le_bytes());
            central.extend((name.len() as u16).to_le_bytes());
            central.extend([0u8; 12]);
            central.extend(offset.to_le_bytes());
            central.extend(name.as_bytes());
        }
        let cd_offset = out.len() as u32;
        out.extend(&central);
        out.extend(EOCD_SIGNATURE.to_le_bytes());
        out.extend([0u8; 4]);
        out.extend((files.len() as u16).to_le_bytes());
        out.extend((files.len() as u16).to_le_bytes());
        out.extend((central.len() as u32).to_le_bytes());
        out.extend(cd_offset.to_le_bytes());
        out.extend(0u16.to_le_bytes());
        out
    }

    #[test]
    fn crc32_matches_the_reference_value() {
        assert_eq!(crc32(b"123456789"), 0xCBF4_3926);
    }

    #[test]
    fn stored_and_deflated_entries_read_back() {
        let big = b"lottie ".repeat(200);
        let bytes = zip(&[("a.txt", b"hello", false), ("dir/b.txt", &big, true)]);
        let archive = Archive::open(&bytes).unwrap();
        assert_eq!(archive.names().collect::<Vec<_>>(), ["a.txt", "dir/b.txt"]);
        assert_eq!(archive.read("a.txt").unwrap().unwrap(), b"hello");
        assert_eq!(archive.read("./dir/b.txt").unwrap().unwrap(), big);
        assert!(archive.read("missing").unwrap().is_none());
        assert!(archive.read("../a.txt").unwrap().is_none());
    }

    #[test]
    fn unsafe_names_and_broken_archives_are_refused() {
        for name in [
            "../evil.json",
            "/abs.json",
            "a\\b.json",
            "c:/x.json",
            "a/../../b",
        ] {
            let error = Archive::open(&zip(&[(name, b"x", false)]))
                .unwrap_err()
                .to_string();
            assert!(error.contains("unsafe"), "{name}: {error}");
        }
        assert!(Archive::open(b"PK\x03\x04rest").is_err());
        // Content altered: CRC mismatch.
        let mut bytes = zip(&[("a.txt", b"hello", false)]);
        let at = bytes.windows(5).position(|w| w == b"hello").unwrap();
        bytes[at] = b'j';
        let archive = Archive::open(&bytes).unwrap();
        assert!(
            archive
                .read("a.txt")
                .unwrap_err()
                .to_string()
                .contains("checksum")
        );
        // The size declared in the central directory is smaller than the actual size. Truncated to the declared size, so the sizes do not match.
        let mut bytes = zip(&[("b.txt", &b"x".repeat(1000), true)]);
        let cd = bytes
            .windows(4)
            .rposition(|w| w == CENTRAL_SIGNATURE.to_le_bytes())
            .unwrap();
        bytes[cd + 24..cd + 28].copy_from_slice(&10u32.to_le_bytes());
        let archive = Archive::open(&bytes).unwrap();
        assert!(archive.read("b.txt").is_err());
    }

    #[test]
    fn the_manifest_picks_the_animation() {
        let manifest = br#"{"animations":[{"id":"second"}],"activeAnimationId":"main"}"#;
        let bytes = zip(&[
            ("manifest.json", manifest, true),
            ("animations/first.json", b"{\"a\":1}", true),
            ("animations/main.json", b"{\"a\":2}", true),
        ]);
        let archive = Archive::open(&bytes).unwrap();
        assert_eq!(
            archive.animation().unwrap(),
            ("animations/main.json".into(), b"{\"a\":2}".to_vec())
        );
        // No manifest: take the first segment by name.
        let bytes = zip(&[
            ("animations/b.json", b"{}", false),
            ("animations/a.json", b"[]", false),
        ]);
        assert_eq!(
            Archive::open(&bytes).unwrap().animation().unwrap().0,
            "animations/a.json"
        );
        let bytes = zip(&[("images/x.png", b"", false)]);
        assert!(Archive::open(&bytes).unwrap().animation().is_err());
        // Version 2 layout.
        let bytes = zip(&[
            (
                "manifest.json",
                br#"{"initial":{"animation":"b"},"animations":[{"id":"a"},{"id":"b"}]}"#,
                false,
            ),
            ("a/a.json", b"1", false),
            ("a/b.json", b"2", false),
        ]);
        assert_eq!(
            Archive::open(&bytes).unwrap().animation().unwrap().0,
            "a/b.json"
        );
    }

    #[test]
    fn image_paths_resolve_inside_the_archive() {
        let bytes = zip(&[
            ("images/img_0.png", b"png", false),
            ("i/v2.png", b"two", false),
        ]);
        let archive = Archive::open(&bytes).unwrap();
        assert_eq!(
            archive.resolve("/images/img_0.png").unwrap().unwrap(),
            b"png"
        );
        assert_eq!(
            archive.resolve("images/img_0.png").unwrap().unwrap(),
            b"png"
        );
        assert_eq!(archive.resolve("img_0.png").unwrap().unwrap(), b"png");
        assert_eq!(archive.resolve("/i/v2.png").unwrap().unwrap(), b"two");
        assert!(archive.resolve("../images/nope.png").unwrap().is_none());
    }
}
