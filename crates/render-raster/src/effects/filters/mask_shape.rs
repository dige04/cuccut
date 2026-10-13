//! SDF coverage mask for rounded rectangles and ellipses (`mask.shape@1`).
//!
//! **Moved line by line from** `core/crates/ccut-kernel/src/cmd/studio_export/raster.rs::apply_local_clip`.
//! Coverage is multiplied onto the **premultiplied four channels**, so the premultiplication invariant `rgb ≤ a` still holds.

/// Multiplies all four channels of a pixel by the coverage. Bit-exact source: `multiply_pixel_coverage`.
pub fn multiply_pixel_coverage(pixel: &mut [u8], coverage: f64) {
    let coverage = coverage.clamp(0.0, 1.0);
    for channel in pixel {
        *channel = (f64::from(*channel) * coverage).round() as u8;
    }
}

/// Multiplies the whole frame by one opacity. Bit-exact source: `multiply_premultiplied_alpha`.
pub fn multiply_premultiplied_alpha(data: &mut [u8], opacity: f64) {
    let opacity = opacity.clamp(0.0, 1.0);
    // `(v as f64 * 1.0).round() as u8 == v` holds for every u8, so full opacity is an identity transform. Skip the full-frame scan and write no bytes. This is the same convention as the identity short-circuit in `mask_shape`.
    if opacity >= 1.0 {
        return;
    }
    for channel in data {
        *channel = (f64::from(*channel) * opacity).round() as u8;
    }
}

/// When `radius <= 0 && !ellipse`, this is an identity transform. It matches the original implementation and writes no bytes.
pub fn mask_shape(
    data: &mut [u8],
    width: u32,
    height: u32,
    radius: f64,
    ellipse: bool,
    feather: f64,
) {
    mask_shape_corners(data, width, height, [radius; 4], ellipse, feather)
}

/// Rounded-rectangle mask with an independent radius for each corner. The radius order is top-left, top-right, bottom-right, bottom-left. The older single-value entry [`mask_shape`] copies the same value four times, so existing pixels do not change.
pub fn mask_shape_corners(
    data: &mut [u8],
    width: u32,
    height: u32,
    radii: [f64; 4],
    ellipse: bool,
    feather: f64,
) {
    if !ellipse && radii.iter().all(|radius| *radius <= 0.0) {
        return;
    }
    let pixmap_width = width as usize;
    let width = f64::from(width);
    let height_f = f64::from(height);
    let center_x = width / 2.0;
    let center_y = height_f / 2.0;
    let radii = radii.map(|radius| radius.max(0.0).min(width.min(height_f) / 2.0));
    let softness = (1.0 + feather).max(1.0);
    for y in 0..height as usize {
        for x in 0..pixmap_width {
            let px = x as f64 + 0.5;
            let py = y as f64 + 0.5;
            let signed_distance = if ellipse {
                let rx = (width / 2.0).max(0.5);
                let ry = (height_f / 2.0).max(0.5);
                ((((px - center_x) / rx).powi(2) + ((py - center_y) / ry).powi(2)).sqrt() - 1.0)
                    * rx.min(ry)
            } else {
                let radius = match (px < center_x, py < center_y) {
                    (true, true) => radii[0],
                    (false, true) => radii[1],
                    (false, false) => radii[2],
                    (true, false) => radii[3],
                };
                let qx = (px - center_x).abs() - (width / 2.0 - radius);
                let qy = (py - center_y).abs() - (height_f / 2.0 - radius);
                qx.max(0.0).hypot(qy.max(0.0)) + qx.max(qy).min(0.0) - radius
            };
            let coverage = (0.5 - signed_distance) / softness + 0.5 * (softness - 1.0) / softness;
            let offset = (y * pixmap_width + x) * 4;
            multiply_pixel_coverage(&mut data[offset..offset + 4], coverage);
        }
    }
}
