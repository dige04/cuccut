//! SVG rasterization (`svg` feature): the one copy shared by the host (`media`) and the browser preview (`wasm-safe` + `svg`).
//!
//! Works on bytes only and does no I/O: embedded bitmaps are accepted only as data URIs, and `href` pointing at disk is never read. Without `media`, resvg is built without `text`, so `<text>` in an SVG is not drawn. With `media` on, text still is not drawn, because the font database in the parse options is empty (`Options::default()`). Both sides therefore produce the same result, pixel for pixel.

use anyhow::{Result, anyhow, bail};
use tiny_skia::Pixmap;

/// Parse options for SVG stickers (static and animated): embedded bitmaps are accepted only as data URIs, and `href` pointing at disk is never read. Rendering does no I/O, and relative paths should not depend on the process working directory.
pub fn svg_options() -> resvg::usvg::Options<'static> {
    let mut options = resvg::usvg::Options::default();
    options.image_href_resolver.resolve_string = Box::new(|_, _| None);
    options
}

/// Whether the bytes look like an SVG (after skipping a BOM and leading whitespace, the content starts with `<svg` or `<?xml`).
pub fn looks_like_svg(bytes: &[u8]) -> bool {
    let bytes = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(bytes);
    let start = bytes
        .iter()
        .position(|b| !b.is_ascii_whitespace())
        .unwrap_or(bytes.len());
    let head = &bytes[start..];
    head.starts_with(b"<svg") || head.starts_with(b"<?xml")
}

/// Rasterizes at the SVG's natural size (`width`/`height`, rounded up).
pub fn decode_svg_natural(bytes: &[u8]) -> Result<Pixmap> {
    let tree = resvg::usvg::Tree::from_data(bytes, &svg_options())?;
    let size = tree.size();
    let (w, h) = (size.width().ceil() as u32, size.height().ceil() as u32);
    let mut pm = Pixmap::new(w.max(1), h.max(1)).ok_or_else(|| anyhow!("空 SVG"))?;
    resvg::render(&tree, tiny_skia::Transform::identity(), &mut pm.as_mut());
    Ok(pm)
}

/// Rasterizes the SVG at the **target long edge**. The `width`/`height` of the vector source is not a cap on resolution.
///
/// [`decode_svg_natural`] uses resvg's natural size: a sticker source with `width="128"` is rasterized at only 128 px no matter how large it is displayed, so scaling it up looks blurry. Here a uniform `Transform` is added at render time instead of producing the natural size first and resampling. Uniform scaling: the long edge lands on `long_edge`, and the short edge is rounded from the original ratio (at least 1 px).
pub fn decode_svg_at_long_edge(bytes: &[u8], long_edge: u32) -> Result<Pixmap> {
    let tree = resvg::usvg::Tree::from_data(bytes, &svg_options())?;
    let size = tree.size();
    let (w, h) = (f64::from(size.width()), f64::from(size.height()));
    if w <= 0.0 || h <= 0.0 {
        bail!("空 SVG");
    }
    let scale = f64::from(long_edge.max(1)) / w.max(h);
    let out_w = (w * scale).round().max(1.0) as u32;
    let out_h = (h * scale).round().max(1.0) as u32;
    let mut pm = Pixmap::new(out_w, out_h).ok_or_else(|| anyhow!("空 SVG"))?;
    resvg::render(
        &tree,
        tiny_skia::Transform::from_scale(scale as f32, scale as f32),
        &mut pm.as_mut(),
    );
    Ok(pm)
}

#[cfg(test)]
mod tests {
    use super::*;

    const SQUARE: &str = r##"<svg xmlns="http://www.w3.org/2000/svg" width="10" height="20"><rect width="10" height="20" fill="#ff0000"/></svg>"##;

    #[test]
    fn long_edge_scales_both_sides() {
        let pm = decode_svg_at_long_edge(SQUARE.as_bytes(), 40).unwrap();
        assert_eq!((pm.width(), pm.height()), (20, 40));
        let px = pm.pixel(10, 20).unwrap();
        assert_eq!(
            (px.red(), px.green(), px.blue(), px.alpha()),
            (255, 0, 0, 255)
        );
    }

    #[test]
    fn natural_size_and_sniffing() {
        let pm = decode_svg_natural(SQUARE.as_bytes()).unwrap();
        assert_eq!((pm.width(), pm.height()), (10, 20));
        assert!(looks_like_svg(b"\xEF\xBB\xBF  <svg/>"));
        assert!(looks_like_svg(b"<?xml version=\"1.0\"?><svg/>"));
        assert!(!looks_like_svg(b"\x89PNG"));
    }
}
