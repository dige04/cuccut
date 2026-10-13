//! 8-bit RGBA → PNG (`cuccut.image-png/v1`). v2 encodes with the `image` crate inside its kernel; here only PNG is needed, so `png` is used directly.

use anyhow::{Result, ensure};

use super::RawImage;

/// Encodes to PNG bytes. A mismatch between the pixel count and width × height is an error.
pub fn encode_rgba(image: &RawImage) -> Result<Vec<u8>> {
    let expected = image.width as usize * image.height as usize * 4;
    ensure!(image.width > 0 && image.height > 0, "图片宽高为 0");
    ensure!(
        image.pixels.len() == expected,
        "RGBA 像素数 {} 与 {}x{} 不符",
        image.pixels.len(),
        image.width,
        image.height
    );
    let mut out = Vec::with_capacity(expected / 2);
    {
        let mut encoder = png::Encoder::new(&mut out, image.width, image.height);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header()?;
        writer.write_image_data(&image.pixels)?;
        writer.finish()?;
    }
    Ok(out)
}

#[cfg(test)]
pub(crate) fn decode_rgba(bytes: &[u8]) -> (u32, u32, Vec<u8>) {
    let decoder = png::Decoder::new(std::io::Cursor::new(bytes));
    let mut reader = decoder.read_info().unwrap();
    let mut pixels = vec![0; reader.output_buffer_size().unwrap()];
    let info = reader.next_frame(&mut pixels).unwrap();
    assert_eq!(info.color_type, png::ColorType::Rgba);
    assert_eq!(info.bit_depth, png::BitDepth::Eight);
    pixels.truncate(info.buffer_size());
    (info.width, info.height, pixels)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_rgba() {
        let pixels: Vec<u8> = (0..3 * 2 * 4).map(|i| (i * 7) as u8).collect();
        let image = RawImage {
            width: 3,
            height: 2,
            pixels: pixels.clone(),
        };
        let bytes = encode_rgba(&image).unwrap();
        assert_eq!(&bytes[..8], b"\x89PNG\r\n\x1a\n");
        assert_eq!(decode_rgba(&bytes), (3, 2, pixels));
    }

    #[test]
    fn rejects_a_pixel_count_that_does_not_match() {
        let image = RawImage {
            width: 2,
            height: 2,
            pixels: vec![0; 15],
        };
        assert!(encode_rgba(&image).is_err());
    }
}
