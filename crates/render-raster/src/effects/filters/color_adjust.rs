//! CPU reference implementation of color filters.
//!
//! [`color_adjust`] and [`brightness_only`] are **moved line by line from** `apply_media_effects` (the color section) and `adjust_brightness` in `core/crates/ccut-kernel/src/cmd/studio_export/raster.rs`. The rest (contrast / saturation / sepia / hueRotate) is new in this change and follows the same conventions: **un-premultiply to f64 → operate in the 0..255 domain → clamp → multiply back by alpha and `round()`**. The alpha channel is never changed.
//!
//! Why `color_adjust` is one recipe rather than `grayscale ∘ brightness`: the original implementation, **in the same loop**, first interpolated toward gray and then added the brightness offset, clamping once and rounding once. Splitting it into two chained filters would add an extra u8 round-trip, which produces different pixels.

/// Rec.709 luma weights.
pub const LUMA: [f64; 3] = [0.2126, 0.7152, 0.0722];

fn luma(r: f64, g: f64, b: f64) -> f64 {
    r * LUMA[0] + g * LUMA[1] + b * LUMA[2]
}

/// Un-premultiply → `f(r, g, b)` → clamp → re-premultiply and round. Alpha is unchanged.
fn map_unpremultiplied(data: &mut [u8], mut f: impl FnMut(f64, f64, f64) -> (f64, f64, f64)) {
    for pixel in data.chunks_exact_mut(4) {
        let alpha = f64::from(pixel[3]) / 255.0;
        if alpha <= 0.0 {
            continue;
        }
        let red = f64::from(pixel[0]) / alpha;
        let green = f64::from(pixel[1]) / alpha;
        let blue = f64::from(pixel[2]) / alpha;
        let (red, green, blue) = f(red, green, blue);
        pixel[0] = (red.clamp(0.0, 255.0) * alpha).round() as u8;
        pixel[1] = (green.clamp(0.0, 255.0) * alpha).round() as u8;
        pixel[2] = (blue.clamp(0.0, 255.0) * alpha).round() as u8;
    }
}

/// Timeline 0.1's `fx {grayscale, brightness}` (`filter.colorAdjust@1`). Bit-exact source: the color section of `studio_export/raster.rs::apply_media_effects`.
pub fn color_adjust(data: &mut [u8], grayscale: f64, brightness: f64) {
    let grayscale = grayscale.clamp(0.0, 1.0);
    let brightness = brightness.clamp(-1.0, 1.0);
    if grayscale <= 0.0 && brightness == 0.0 {
        return;
    }
    for pixel in data.chunks_exact_mut(4) {
        let alpha = f64::from(pixel[3]) / 255.0;
        if alpha <= 0.0 {
            continue;
        }
        let mut red = f64::from(pixel[0]) / alpha;
        let mut green = f64::from(pixel[1]) / alpha;
        let mut blue = f64::from(pixel[2]) / alpha;
        let gray = red * LUMA[0] + green * LUMA[1] + blue * LUMA[2];
        red = red + (gray - red) * grayscale + brightness * 255.0;
        green = green + (gray - green) * grayscale + brightness * 255.0;
        blue = blue + (gray - blue) * grayscale + brightness * 255.0;
        pixel[0] = (red.clamp(0.0, 255.0) * alpha).round() as u8;
        pixel[1] = (green.clamp(0.0, 255.0) * alpha).round() as u8;
        pixel[2] = (blue.clamp(0.0, 255.0) * alpha).round() as u8;
    }
}

/// Brightness only (`filter.brightness@1`). Bit-exact source: `adjust_brightness`.
pub fn brightness_only(data: &mut [u8], amount: f64) {
    for pixel in data.chunks_exact_mut(4) {
        let alpha = f64::from(pixel[3]) / 255.0;
        if alpha <= 0.0 {
            continue;
        }
        for channel in &mut pixel[..3] {
            let raw = f64::from(*channel) / alpha + amount * 255.0;
            *channel = (raw.clamp(0.0, 255.0) * alpha).round() as u8;
        }
    }
}

/// Interpolates toward Rec.709 luma (`filter.grayscale@1`).
pub fn grayscale(data: &mut [u8], amount: f64) {
    let amount = amount.clamp(0.0, 1.0);
    map_unpremultiplied(data, |r, g, b| {
        let gray = luma(r, g, b);
        (
            r + (gray - r) * amount,
            g + (gray - g) * amount,
            b + (gray - b) * amount,
        )
    });
}

/// Scales around 127.5 (`filter.contrast@1`).
pub fn contrast(data: &mut [u8], amount: f64) {
    let factor = 1.0 + amount.clamp(-1.0, 1.0);
    map_unpremultiplied(data, |r, g, b| {
        (
            (r - 127.5) * factor + 127.5,
            (g - 127.5) * factor + 127.5,
            (b - 127.5) * factor + 127.5,
        )
    });
}

/// Linear interpolation anchored on luminance (`filter.saturation@1`). `amount = 1` is the identity.
pub fn saturation(data: &mut [u8], amount: f64) {
    map_unpremultiplied(data, |r, g, b| {
        let gray = luma(r, g, b);
        (
            gray + (r - gray) * amount,
            gray + (g - gray) * amount,
            gray + (b - gray) * amount,
        )
    });
}

/// 3×3 color matrix (row-major, operating in the 0..255 domain), interpolated with the identity matrix by `amount`.
fn apply_matrix(data: &mut [u8], matrix: [f64; 9], amount: f64) {
    let identity = [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0];
    let mut m = [0.0f64; 9];
    for index in 0..9 {
        m[index] = identity[index] + (matrix[index] - identity[index]) * amount;
    }
    map_unpremultiplied(data, |r, g, b| {
        (
            m[0] * r + m[1] * g + m[2] * b,
            m[3] * r + m[4] * g + m[5] * b,
            m[6] * r + m[7] * g + m[8] * b,
        )
    });
}

/// W3C filter-effects sepia matrix (`filter.sepia@1`).
pub fn sepia(data: &mut [u8], amount: f64) {
    apply_matrix(
        data,
        [
            0.393, 0.769, 0.189, //
            0.349, 0.686, 0.168, //
            0.272, 0.534, 0.131,
        ],
        amount.clamp(0.0, 1.0),
    );
}

/// W3C filter-effects hue-rotate matrix (`filter.hueRotate@1`).
pub fn hue_rotate(data: &mut [u8], degrees: f64) {
    let radians = degrees.to_radians();
    let (sin, cos) = radians.sin_cos();
    let matrix = [
        0.213 + cos * 0.787 - sin * 0.213,
        0.715 - cos * 0.715 - sin * 0.715,
        0.072 - cos * 0.072 + sin * 0.928,
        0.213 - cos * 0.213 + sin * 0.143,
        0.715 + cos * 0.285 + sin * 0.140,
        0.072 - cos * 0.072 - sin * 0.283,
        0.213 - cos * 0.213 - sin * 0.787,
        0.715 - cos * 0.715 + sin * 0.715,
        0.072 + cos * 0.928 + sin * 0.072,
    ];
    apply_matrix(data, matrix, 1.0);
}

/// Invert, interpolated with the identity color by `amount`. Computed in the un-premultiplied color domain; alpha is unchanged.
pub fn invert(data: &mut [u8], amount: f64) {
    let amount = amount.clamp(0.0, 1.0);
    map_unpremultiplied(data, |r, g, b| {
        (
            r + (255.0 - 2.0 * r) * amount,
            g + (255.0 - 2.0 * g) * amount,
            b + (255.0 - 2.0 * b) * amount,
        )
    });
}
