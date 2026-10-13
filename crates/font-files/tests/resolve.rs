//! Family name, weight and italic → one face: the bundled fonts are copied into a temp directory (the collection is assembled from the bundled fonts on the spot), so it does not depend on what fonts this machine has installed.

use std::path::{Path, PathBuf};

use font_files::{FaceLayout, FaceQuery, FontFace, FontLibrary, MAX_FACE_BYTES, Missing, extract_face, read_face};

fn bundled(name: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../render-raster/assets/fonts")
        .join(name)
}

/// Temporary font directory: `files` are copied into it (they may go into subdirectories).
fn font_dir(files: &[(&str, &str)]) -> tempfile::TempDir {
    let dir = tempfile::tempdir().unwrap();
    for (name, at) in files {
        let target = dir.path().join(at);
        std::fs::create_dir_all(target.parent().unwrap()).unwrap();
        std::fs::copy(bundled(name), target).unwrap();
    }
    dir
}

fn query(family: &str, weight: u16, italic: bool) -> FaceQuery {
    FaceQuery {
        family: family.into(),
        weight,
        italic,
    }
}

fn be32(bytes: &[u8], at: usize) -> u32 {
    u32::from_be_bytes(bytes[at..at + 4].try_into().unwrap())
}

/// Combines several separate fonts into one font collection (`.ttc`, each face with its own tables), like the system's Chinese font collections.
fn collection(fonts: &[Vec<u8>]) -> Vec<u8> {
    let mut out = Vec::new();
    out.extend_from_slice(b"ttcf");
    out.extend_from_slice(&0x0001_0000u32.to_be_bytes());
    out.extend_from_slice(&(fonts.len() as u32).to_be_bytes());
    let directories_at = 12 + 4 * fonts.len();
    let sizes: Vec<usize> = fonts
        .iter()
        .map(|font| 12 + 16 * usize::from(u16::from_be_bytes([font[4], font[5]])))
        .collect();
    let mut at = directories_at;
    for size in &sizes {
        out.extend_from_slice(&(at as u32).to_be_bytes());
        at += size;
    }
    let mut data_at = at;
    let mut data = Vec::new();
    for font in fonts {
        let count = usize::from(u16::from_be_bytes([font[4], font[5]]));
        out.extend_from_slice(&font[0..12]);
        for record in font[12..12 + 16 * count].chunks_exact(16) {
            let (from, len) = (be32(record, 8) as usize, be32(record, 12) as usize);
            out.extend_from_slice(&record[0..8]);
            out.extend_from_slice(&(data_at as u32).to_be_bytes());
            out.extend_from_slice(&(len as u32).to_be_bytes());
            data.extend_from_slice(&font[from..from + len]);
            while data.len() % 4 != 0 {
                data.push(0);
            }
            data_at = at + data.len();
        }
    }
    out.extend_from_slice(&data);
    out
}

/// Loads a font library made of only these bytes, and reads out its family name, weight and PostScript name.
fn faces_of(bytes: Vec<u8>) -> Vec<(String, u16, String)> {
    let mut db = fontdb::Database::new();
    db.load_font_data(bytes);
    db.faces()
        .map(|face| (face.families[0].0.clone(), face.weight.0, face.post_script_name.clone()))
        .collect()
}

#[test]
fn faces_resolve_by_family_weight_and_style_like_the_text_engine() {
    let dir = font_dir(&[
        ("Poppins-Regular.ttf", "Poppins-Regular.ttf"),
        ("Poppins-SemiBold.ttf", "Poppins-SemiBold.ttf"),
        ("Poppins-ExtraBold.ttf", "nested/Poppins-ExtraBold.ttf"),
        ("PlayfairDisplay-Regular.ttf", "PlayfairDisplay-Regular.ttf"),
        ("PlayfairDisplay-Italic.ttf", "PlayfairDisplay-Italic.ttf"),
    ]);
    let library = FontLibrary::from_dirs(&[dir.path().to_path_buf()]);
    let file = |q: FaceQuery| {
        library
            .resolve_face(&q)
            .map(|f| f.path.strip_prefix(dir.path()).unwrap().to_path_buf())
    };
    // CSS weight matching: 700 searches heavier first (ExtraBold 800); 500 looks for 500 first, then lighter (Regular 400); 300 searches lighter, and only then heavier.
    assert_eq!(file(query("Poppins", 400, false)), Ok("Poppins-Regular.ttf".into()));
    assert_eq!(file(query("Poppins", 700, false)), Ok("nested/Poppins-ExtraBold.ttf".into()));
    assert_eq!(file(query("Poppins", 600, false)), Ok("Poppins-SemiBold.ttf".into()));
    assert_eq!(file(query("Poppins", 500, false)), Ok("Poppins-Regular.ttf".into()));
    assert_eq!(file(query("Poppins", 300, false)), Ok("Poppins-Regular.ttf".into()));
    // Pick italic if available, otherwise fall back to upright.
    assert_eq!(file(query("Playfair Display", 400, true)), Ok("PlayfairDisplay-Italic.ttf".into()));
    assert_eq!(
        file(query("Playfair Display", 400, false)),
        Ok("PlayfairDisplay-Regular.ttf".into())
    );
    assert_eq!(file(query("Poppins", 400, true)), Ok("Poppins-Regular.ttf".into()));
    // The family name is found even with wrong casing or when given as the PostScript name; the same request always picks the same face.
    assert_eq!(file(query("poppins", 700, false)), Ok("nested/Poppins-ExtraBold.ttf".into()));
    assert_eq!(file(query("Poppins-SemiBold", 400, false)), Ok("Poppins-SemiBold.ttf".into()));
    assert_eq!(
        library.resolve_face(&query("Poppins", 700, false)),
        library.resolve_face(&query("Poppins", 700, false))
    );
    let regular = library.resolve_face(&query("Poppins", 400, false)).unwrap();
    assert_eq!(regular.index, 0);
    assert_eq!(regular.file_len, std::fs::metadata(bundled("Poppins-Regular.ttf")).unwrap().len());
    assert_eq!(library.resolve_face(&query("Nowhere Sans", 400, false)), Err(Missing::NotFound));
    assert_eq!(library.resolve_face(&query("  ", 400, false)), Err(Missing::NotFound));
    // The size limit applies to the extracted face.
    assert_eq!(
        library.resolve_face_within(&query("Poppins", 400, false), 1024),
        Err(Missing::TooLarge)
    );
    assert_eq!(Missing::TooLarge.code(), "too-large");
    assert_eq!(Missing::NotFound.code(), "not-found");
}

#[test]
fn a_collection_gives_only_the_wanted_face_as_a_standalone_font() {
    let regular = std::fs::read(bundled("Poppins-Regular.ttf")).unwrap();
    let bold = std::fs::read(bundled("Poppins-ExtraBold.ttf")).unwrap();
    let ttc = collection(&[regular.clone(), bold.clone()]);
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("Poppins.ttc");
    std::fs::write(&path, &ttc).unwrap();
    let library = FontLibrary::from_dirs(&[dir.path().to_path_buf()]);

    let face = library.resolve_face(&query("Poppins", 700, false)).unwrap();
    assert_eq!(
        face,
        FontFace {
            path: path.clone(),
            index: 1,
            file_len: ttc.len() as u64
        }
    );
    // The extracted result is a single font: it has only this one face, with the name and weight unchanged, smaller than the whole collection, and about the size of a standalone file (tables are 4-byte aligned).
    let extracted = read_face(&face).unwrap();
    assert_eq!(faces_of(extracted.clone()), faces_of(bold.clone()));
    assert!(extracted.len() < ttc.len());
    assert!(extracted.len().abs_diff(bold.len()) < 64);
    assert_eq!(extract_face(&ttc, 1).unwrap(), extracted);
    assert_eq!(&extracted[0..4], &bold[0..4]);
    assert_eq!(faces_of(extract_face(&ttc, 0).unwrap()), faces_of(regular.clone()));
    // A standalone font is assembled the same way too (face 0 is itself).
    assert_eq!(faces_of(extract_face(&bold, 0).unwrap()), faces_of(bold.clone()));

    // Assembling by byte range (as preview fetches it through a read handle) gives the same result as reading the whole file and extracting.
    let layout = FaceLayout::read(&mut std::io::Cursor::new(&ttc), ttc.len() as u64, 1).unwrap();
    assert_eq!(layout.size as usize, extracted.len());
    let mut by_ranges = vec![0u8; layout.size as usize];
    by_ranges[..layout.header.len()].copy_from_slice(&layout.header);
    for table in &layout.tables {
        let from = table.from as usize;
        by_ranges[table.to as usize..table.to as usize + table.len as usize].copy_from_slice(&ttc[from..from + table.len as usize]);
    }
    assert_eq!(by_ranges, extracted);
}

#[test]
fn malformed_files_are_rejected_instead_of_read_out_of_bounds() {
    let regular = std::fs::read(bundled("Poppins-Regular.ttf")).unwrap();
    let ttc = collection(std::slice::from_ref(&regular));
    // Truncated: a table lies beyond the end of the file.
    assert!(extract_face(&regular[..regular.len() / 2], 0).is_err());
    assert!(extract_face(&ttc[..ttc.len() - 100], 0).is_err());
    // A face that is not in the collection, and index 1 of a standalone font.
    assert!(extract_face(&ttc, 1).is_err());
    assert!(extract_face(&regular, 1).is_err());
    // Unrecognized formats and files that are too short.
    assert!(extract_face(b"wOFF\0\0\0\0\0\0\0\0\0\0\0\0", 0).is_err());
    assert!(extract_face(b"tt", 0).is_err());
    assert!(extract_face(&[], 0).is_err());
    // A table offset is absurd (offset plus length overflows).
    let mut broken = regular.clone();
    broken[12 + 8..12 + 12].copy_from_slice(&u32::MAX.to_be_bytes());
    assert!(extract_face(&broken, 0).is_err());
    // A face's offset in the collection points outside the file.
    let mut broken = ttc.clone();
    broken[12..16].copy_from_slice(&u32::MAX.to_be_bytes());
    assert!(extract_face(&broken, 0).is_err());
    // The table directory has 0 entries.
    let mut broken = regular.clone();
    broken[4..6].copy_from_slice(&0u16.to_be_bytes());
    assert!(extract_face(&broken, 0).is_err());
}

#[test]
fn the_product_limit_admits_a_face_of_a_large_system_collection() {
    // One PingFang face is about 13 MB and the whole collection about 75 MB: the limit is per face, so it fits.
    const { assert!(MAX_FACE_BYTES >= 80 * 1024 * 1024) };
}

#[test]
fn unreadable_directories_are_skipped() {
    let library = FontLibrary::from_dirs(&[PathBuf::from("/nonexistent/cuccut-font-dir"), PathBuf::new()]);
    assert_eq!(library.resolve_face(&query("Permanent Marker", 400, false)), Err(Missing::NotFound));
}
