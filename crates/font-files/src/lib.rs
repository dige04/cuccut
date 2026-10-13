//! Finds local fonts by font family name (architecture design §9.1). Ported from the system font library of CucCut v2 `ccut-render`
//! (`system_font_db`, `system_font_files`, `FaceNames`).
//!
//! The unit is the face. When rendering, a run of text picks a font by “family name, weight, italic” (the same CSS matching as the layout engine, `fontdb::Database::query`), so this also picks that one face from the local fonts by those three (which file, and which index within the file); see [`FontLibrary::resolve_face`].
//! Export (native, reads the file directly) and preview (WASM cannot read local fonts, so the host sends the bytes according to the resolution done here) both load only the picked face. The system's CJK font collections (`.ttc`; PingFang is about 75 MB with 24 faces) take only the one face used ([`FaceLayout`], which extracts its tables and assembles a single standalone font). Both sides load identical bytes, and the face picked is the same. Only the faces used are looked up, with a size cap ([`MAX_FACE_BYTES`]); the whole font catalogue is not listed or sent.
//!
//! Test hook: when the environment variable [`FONT_DIRS_ENV`] is set, only the directories it lists are scanned (separated by the platform's path-list separator), and local fonts are not scanned. Setting it to an empty string means there are no fonts at all. Tests use this so they do not depend on what fonts happen to be installed on the machine.

use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use std::time::SystemTime;

/// Environment variable to scan only these directories and not the local fonts (for tests).
pub const FONT_DIRS_ENV: &str = "CUCCUT_FONT_DIRS";

/// Upper limit on an extracted face (one PingFang face is about 13 MB); anything larger is not sent.
pub const MAX_FACE_BYTES: u64 = 96 * 1024 * 1024;

/// Face to find: family name (or PostScript name), weight (100–900), and whether it is italic.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct FaceQuery {
    pub family: String,
    pub weight: u16,
    pub italic: bool,
}

/// The face picked: file, its index within the file (0 when not a collection), and the file's byte count.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FontFace {
    pub path: PathBuf,
    pub index: u32,
    pub file_len: u64,
}

/// Reason for not finding it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Missing {
    /// This family is not installed locally.
    NotFound,
    /// Present, but the extracted face exceeds the limit.
    TooLarge,
}

impl Missing {
    /// Reason code in the protocol.
    pub fn code(self) -> &'static str {
        match self {
            Missing::NotFound => "not-found",
            Missing::TooLarge => "too-large",
        }
    }
}

/// A font face's name: family name (in every language's spelling) and PostScript name.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FaceNames {
    pub families: Vec<String>,
    pub post_script_name: String,
}

impl FaceNames {
    /// Family name or PostScript name equals `name` (family name compared case-insensitively).
    pub fn matches(&self, name: &str) -> bool {
        self.post_script_name == name || self.families.iter().any(|family| family.eq_ignore_ascii_case(name))
    }
}

fn face_names(face: &fontdb::FaceInfo) -> FaceNames {
    FaceNames {
        families: face.families.iter().map(|(family, _)| family.clone()).collect(),
        post_script_name: face.post_script_name.clone(),
    }
}

/// Index of a batch of font files (only the name tables of each file are read; no bytes are kept).
pub struct FontLibrary {
    db: fontdb::Database,
    /// Modification times of each font directory at scan time ([`Self::changed`] uses them to tell whether new fonts have been installed).
    watched: Vec<(PathBuf, Option<SystemTime>)>,
}

static SYSTEM: OnceLock<FontLibrary> = OnceLock::new();

/// Looks up to a few levels up: system-downloaded fonts sit in `…/某个资源/AssetData/字体.ttc` (某个资源 = some resource), and a newly installed resource shows up as an extra entry two levels up.
const WATCH_ANCESTORS: usize = 3;

/// Root directories where local fonts live (matching what `fontdb` scans). The user font directory may be empty at first, and is still watched.
fn system_font_roots() -> Vec<PathBuf> {
    let home = std::env::var_os("HOME").map(PathBuf::from);
    let mut roots: Vec<PathBuf> = Vec::new();
    if cfg!(target_os = "macos") {
        roots.extend(
            [
                "/Library/Fonts",
                "/System/Library/Fonts",
                "/System/Library/AssetsV2",
                "/Network/Library/Fonts",
            ]
            .map(PathBuf::from),
        );
        roots.extend(home.iter().map(|home| home.join("Library/Fonts")));
    } else if cfg!(windows) {
        roots.extend(std::env::var_os("SYSTEMROOT").map(|root| PathBuf::from(root).join("Fonts")));
        roots.extend(std::env::var_os("LOCALAPPDATA").map(|root| PathBuf::from(root).join("Microsoft/Windows/Fonts")));
    } else {
        roots.extend(["/usr/share/fonts", "/usr/local/share/fonts"].map(PathBuf::from));
        roots.extend(home.iter().flat_map(|home| [home.join(".local/share/fonts"), home.join(".fonts")]));
    }
    roots
}

fn modified(dir: &Path) -> Option<SystemTime> {
    std::fs::metadata(dir).and_then(|m| m.modified()).ok()
}

impl FontLibrary {
    /// Local font library, scanned only once per process ([`Self::scan`]).
    pub fn system() -> &'static FontLibrary {
        SYSTEM.get_or_init(FontLibrary::scan)
    }

    /// Scans the local fonts once (about 0.1–0.6 seconds for the whole machine). When [`FONT_DIRS_ENV`] is set, only the directories it lists are scanned.
    pub fn scan() -> FontLibrary {
        match std::env::var_os(FONT_DIRS_ENV) {
            Some(dirs) => FontLibrary::from_dirs(&std::env::split_paths(&dirs).collect::<Vec<_>>()),
            None => {
                let mut db = fontdb::Database::new();
                db.load_system_fonts();
                FontLibrary::indexed(db, &system_font_roots())
            }
        }
    }

    /// Loads only the fonts in these directories (recursive; unreadable directories are skipped).
    pub fn from_dirs(dirs: &[PathBuf]) -> FontLibrary {
        let mut db = fontdb::Database::new();
        let dirs: Vec<PathBuf> = dirs.iter().filter(|dir| !dir.as_os_str().is_empty()).cloned().collect();
        for dir in &dirs {
            db.load_fonts_dir(dir);
        }
        FontLibrary::indexed(db, &dirs)
    }

    /// Records the directories to watch: the font roots, and for each font file, the directories up a few levels that are still inside some root. Directories outside the roots, such as the home directory, often change and are not watched. A file that is not inside any root watches only its own directory.
    fn indexed(db: fontdb::Database, roots: &[PathBuf]) -> FontLibrary {
        let mut dirs: std::collections::BTreeSet<PathBuf> = roots.iter().cloned().collect();
        for face in db.faces() {
            if let fontdb::Source::File(path) = &face.source {
                let mut inside = path
                    .ancestors()
                    .skip(1)
                    .take(WATCH_ANCESTORS)
                    .filter(|dir| roots.iter().any(|root| dir.starts_with(root)))
                    .peekable();
                if inside.peek().is_none() {
                    dirs.extend(path.parent().map(Path::to_path_buf));
                }
                dirs.extend(inside.map(Path::to_path_buf));
            }
        }
        let watched = dirs
            .into_iter()
            .map(|dir| {
                let at = modified(&dir);
                (dir, at)
            })
            .collect();
        FontLibrary { db, watched }
    }

    /// Whether the font directories have changed since the scan (fonts installed or removed). It looks only at each directory's own modification time, a few hundred `stat`s, without re-reading the fonts.
    pub fn changed(&self) -> bool {
        self.watched.iter().any(|(dir, at)| modified(dir) != *at)
    }

    /// All family names in this batch of fonts (each face takes its first family name, i.e. its English name; deduplicated and sorted by name). Names only, without file paths: the font picker uses this to mark families as “installed locally”.
    pub fn families(&self) -> Vec<String> {
        let names: std::collections::BTreeSet<String> = self
            .db
            .faces()
            .filter_map(|face| face.families.first().map(|(name, _)| name.trim().to_string()))
            .filter(|name| !name.is_empty() && !name.starts_with('.'))
            .collect();
        names.into_iter().collect()
    }

    /// Picks one face by family name, weight, and italic, using the same CSS matching as the layout engine (`fontdb::Database::query`, with family names compared as given), so when only this one face is loaded into the renderer, the one picked is that face. If the family name's case is wrong, it is picked by the correctly spelled family; if none is a family name, it is found by exact PostScript name. A face whose extraction exceeds [`MAX_FACE_BYTES`] is not returned. The same request always picks the same face.
    pub fn resolve_face(&self, query: &FaceQuery) -> Result<FontFace, Missing> {
        self.resolve_face_within(query, MAX_FACE_BYTES)
    }

    /// [`Self::resolve_face`] with a given limit.
    pub fn resolve_face_within(&self, query: &FaceQuery, max_bytes: u64) -> Result<FontFace, Missing> {
        let family = query.family.trim();
        if family.is_empty() {
            return Err(Missing::NotFound);
        }
        let by_family = |name: &str| {
            self.db.query(&fontdb::Query {
                families: &[fontdb::Family::Name(name)],
                weight: fontdb::Weight(query.weight),
                stretch: fontdb::Stretch::Normal,
                style: if query.italic {
                    fontdb::Style::Italic
                } else {
                    fontdb::Style::Normal
                },
            })
        };
        let id = by_family(family)
            .or_else(|| {
                let canonical = self
                    .db
                    .faces()
                    .flat_map(|face| face.families.iter().map(|(name, _)| name))
                    .find(|name| name.eq_ignore_ascii_case(family))?;
                by_family(canonical)
            })
            .or_else(|| {
                self.db
                    .faces()
                    .find(|face| face_names(face).post_script_name == family)
                    .map(|face| face.id)
            })
            .ok_or(Missing::NotFound)?;
        let face = self.db.face(id).ok_or(Missing::NotFound)?;
        // Local fonts are loaded per file (`load_system_fonts` / `load_fonts_dir` → `Source::File`).
        let fontdb::Source::File(path) = &face.source else {
            return Err(Missing::NotFound);
        };
        let file_len = std::fs::metadata(path)
            .ok()
            .filter(|m| m.is_file())
            .map(|m| m.len())
            .ok_or(Missing::NotFound)?;
        let layout = std::fs::File::open(path)
            .and_then(|mut file| FaceLayout::read(&mut file, file_len, face.index))
            .map_err(|_| Missing::NotFound)?;
        if u64::from(layout.size) > max_bytes {
            return Err(Missing::TooLarge);
        }
        Ok(FontFace {
            path: path.clone(),
            index: face.index,
            file_len,
        })
    }
}

/// Where a table moves: the `len` bytes starting at `from` in the original file go to `to` in the new font.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TableCopy {
    pub from: u64,
    pub len: u32,
    pub to: u32,
}

/// The way to extract a font file (or one face in a font collection) as a single standalone font: a new file header (version and table directory, with table offsets rewritten to the new positions), plus where each table moves from the original file. Table contents are copied as they are, laid out in 4-byte-aligned order after the table directory, with gaps zero-filled. Bounds are checked on read: every table lies within the file, and the table directory has no more than [`MAX_TABLES`] entries. Preview (reading by range through a read handle) and export (reading the file) assemble it the same way, so the resulting bytes are identical.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FaceLayout {
    pub header: Vec<u8>,
    pub tables: Vec<TableCopy>,
    /// Byte count after assembly.
    pub size: u32,
}

/// Maximum number of tables in one face (real fonts have twenty to thirty).
pub const MAX_TABLES: usize = 512;

fn invalid(message: &str) -> std::io::Error {
    std::io::Error::new(std::io::ErrorKind::InvalidData, format!("invalid font file: {message}"))
}

fn read_at<R: Read + Seek>(reader: &mut R, file_len: u64, at: u64, len: usize) -> std::io::Result<Vec<u8>> {
    if at.checked_add(len as u64).is_none_or(|end| end > file_len) {
        return Err(invalid("read past the end of the file"));
    }
    reader.seek(SeekFrom::Start(at))?;
    let mut bytes = vec![0; len];
    reader.read_exact(&mut bytes)?;
    Ok(bytes)
}

fn be32(bytes: &[u8], at: usize) -> u32 {
    u32::from_be_bytes([bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]])
}

fn be16(bytes: &[u8], at: usize) -> u16 {
    u16::from_be_bytes([bytes[at], bytes[at + 1]])
}

/// sfnt version: TrueType (`0x00010000`, `true`) and CFF (`OTTO`).
fn is_sfnt(version: u32) -> bool {
    matches!(version, 0x0001_0000 | 0x7472_7565 | 0x4F54_544F)
}

impl FaceLayout {
    /// Reads the file header and table directory, and works out how the `index`-th face is assembled (`file_len` is the file's byte count). A file that is not a collection has only face 0.
    pub fn read<R: Read + Seek>(reader: &mut R, file_len: u64, index: u32) -> std::io::Result<FaceLayout> {
        let head = read_at(reader, file_len, 0, 12)?;
        let offset = if &head[0..4] == b"ttcf" {
            let count = be32(&head, 8);
            if index >= count {
                return Err(invalid("the collection has no such face"));
            }
            let entry = read_at(reader, file_len, 12 + u64::from(index) * 4, 4)?;
            u64::from(be32(&entry, 0))
        } else if index == 0 {
            0
        } else {
            return Err(invalid("not a font collection; only face 0 exists"));
        };
        let directory = read_at(reader, file_len, offset, 12)?;
        let version = be32(&directory, 0);
        if !is_sfnt(version) {
            return Err(invalid("unrecognized font format"));
        }
        let count = usize::from(be16(&directory, 4));
        if count == 0 || count > MAX_TABLES {
            return Err(invalid("wrong number of entries in the table directory"));
        }
        let records = read_at(reader, file_len, offset + 12, count * 16)?;
        let mut header = Vec::with_capacity(12 + count * 16);
        header.extend_from_slice(&version.to_be_bytes());
        header.extend_from_slice(&(count as u16).to_be_bytes());
        // searchRange, entrySelector, and rangeShift are recomputed per the OpenType definitions.
        let selector = (count as u32).ilog2();
        let range = (1u32 << selector) * 16;
        header.extend_from_slice(&(range as u16).to_be_bytes());
        header.extend_from_slice(&(selector as u16).to_be_bytes());
        header.extend_from_slice(&((count as u32 * 16 - range) as u16).to_be_bytes());
        let mut tables = Vec::with_capacity(count);
        let mut at: u64 = 12 + count as u64 * 16;
        for record in records.chunks_exact(16) {
            let from = u64::from(be32(record, 8));
            let len = be32(record, 12);
            if from.checked_add(u64::from(len)).is_none_or(|end| end > file_len) {
                return Err(invalid("table lies outside the file"));
            }
            let to = u32::try_from(at).map_err(|_| invalid("extracted font is too large"))?;
            header.extend_from_slice(&record[0..8]);
            header.extend_from_slice(&to.to_be_bytes());
            header.extend_from_slice(&len.to_be_bytes());
            tables.push(TableCopy { from, len, to });
            at += u64::from(len).next_multiple_of(4);
        }
        let size = u32::try_from(at).map_err(|_| invalid("extracted font is too large"))?;
        Ok(FaceLayout { header, tables, size })
    }

    /// Assembles a standalone font from `reader` (the original file) by this method.
    pub fn assemble<R: Read + Seek>(&self, reader: &mut R, file_len: u64) -> std::io::Result<Vec<u8>> {
        let mut out = vec![0u8; self.size as usize];
        out[..self.header.len()].copy_from_slice(&self.header);
        for table in &self.tables {
            let bytes = read_at(reader, file_len, table.from, table.len as usize)?;
            let to = table.to as usize;
            out[to..to + bytes.len()].copy_from_slice(&bytes);
        }
        Ok(out)
    }
}

/// What one face in a font file is: its index, name, weight, and whether it is italic.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FaceSummary {
    pub index: u32,
    pub names: FaceNames,
    pub weight: u16,
    pub italic: bool,
}

/// Checks a font file (for example, one just downloaded): no larger than `max_bytes`, readable as faces by the same parsing used for rendering (`fontdb`), and every face's tables lie within the file ([`FaceLayout`]). Gives each face's name, weight, and italic; a file with no readable face is a bad file. Reads only the name table and the table directory, and executes nothing in the file.
pub fn inspect_file(path: &Path, max_bytes: u64) -> std::io::Result<Vec<FaceSummary>> {
    let len = file_len(path)?;
    if len > max_bytes {
        return Err(invalid(&format!("file is {len} bytes, over the {max_bytes} byte limit")));
    }
    let bytes = std::fs::read(path)?;
    let mut db = fontdb::Database::new();
    db.load_font_data(bytes.clone());
    let mut faces = Vec::new();
    for face in db.faces() {
        FaceLayout::read(&mut std::io::Cursor::new(&bytes), len, face.index)?;
        faces.push(FaceSummary {
            index: face.index,
            names: face_names(face),
            weight: face.weight.0,
            italic: face.style != fontdb::Style::Normal,
        });
    }
    if faces.is_empty() {
        return Err(invalid("no readable font in file"));
    }
    faces.sort_by_key(|face| face.index);
    Ok(faces)
}

/// Extracts the `index`-th face from a font file's bytes ([`FaceLayout`]).
pub fn extract_face(file: &[u8], index: u32) -> std::io::Result<Vec<u8>> {
    let mut reader = std::io::Cursor::new(file);
    let layout = FaceLayout::read(&mut reader, file.len() as u64, index)?;
    layout.assemble(&mut reader, file.len() as u64)
}

/// Reads out a picked face (export loads it directly into the renderer).
pub fn read_face(face: &FontFace) -> std::io::Result<Vec<u8>> {
    let mut file = std::fs::File::open(&face.path)?;
    let len = file_len(&face.path)?;
    let layout = FaceLayout::read(&mut file, len, face.index)?;
    layout.assemble(&mut file, len)
}

fn file_len(path: &Path) -> std::io::Result<u64> {
    Ok(std::fs::metadata(path)?.len())
}
