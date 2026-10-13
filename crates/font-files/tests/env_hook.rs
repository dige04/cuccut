//! Test hook: when `CUCCUT_FONT_DIRS` is set, the local font library scans only the directories it lists. Environment variables are process-wide, so this file holds only this one test.

use font_files::{FONT_DIRS_ENV, FaceQuery, FontLibrary, Missing};

#[test]
fn the_font_dirs_variable_replaces_system_scanning() {
    let dir = tempfile::tempdir().unwrap();
    let source = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../render-raster/assets/fonts/PermanentMarker-Regular.ttf");
    std::fs::copy(source, dir.path().join("marker.ttf")).unwrap();
    let empty = tempfile::tempdir().unwrap();
    let dirs = std::env::join_paths([empty.path(), dir.path()]).unwrap();
    // SAFETY: this test binary contains only this one test, so no other thread reads the environment while the variable is set.
    unsafe { std::env::set_var(FONT_DIRS_ENV, dirs) };
    let library = FontLibrary::system();
    let face = |family: &str| {
        library.resolve_face(&FaceQuery {
            family: family.into(),
            weight: 400,
            italic: false,
        })
    };
    assert_eq!(face("Permanent Marker").unwrap().path, dir.path().join("marker.ttf"));
    // Scan none of the fonts installed on this machine.
    assert_eq!(face("Helvetica"), Err(Missing::NotFound));
    assert_eq!(face("Arial"), Err(Missing::NotFound));
}
