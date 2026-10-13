//! The **generator** for `core/fixtures/animated/`: tiny programmatically synthesized GIF / APNG / animated WebP (all 8×8), with per-frame colour, per-frame duration, disposal and loop count all hard-coded.
//!
//! Why not use ffmpeg as `core/fixtures/gen.sh` does: that route cannot give precise control of per-frame disposal and loop count, and those two are exactly what §7 requires to be “preserved”. Generating with a crate has another benefit: the fixtures can be **recomputed on the spot** in tests, so `animated_fixtures_are_up_to_date` is a real gate, rather than “run a script and hope”.

use std::io::Cursor;

/// Colours of the four frames of stripes.gif (RGB)
pub const STRIPE_COLOURS: [[u8; 3]; 4] = [
    [0xe0, 0x20, 0x20],
    [0x20, 0xc0, 0x20],
    [0x20, 0x40, 0xe0],
    [0xf0, 0xd0, 0x00],
];
/// The four delays of stripes.gif (in GIF's 10 ms units) → 100 / 200 / 300 / 400 ms
pub const STRIPE_DELAYS_CS: [u16; 4] = [10, 20, 30, 40];

const W: u16 = 8;
const H: u16 = 8;

/// All fixtures (file name → bytes). The order is fixed; the key order of `expected.json` depends on it.
pub fn fixtures() -> Vec<(String, Vec<u8>)> {
    vec![
        (
            "stripes.gif".into(),
            stripes_gif(STRIPE_COLOURS, STRIPE_DELAYS_CS, gif::Repeat::Infinite),
        ),
        ("disposal.gif".into(), disposal_gif()),
        ("pulse.png".into(), pulse_apng()),
        ("wave.webp".into(), wave_webp()),
    ]
}

// ── GIF ─────────────────────────────────────────────────────────────

/// Four full-frame solid colours, each frame with a different delay, all `DisposalMethod::Any`.
pub fn stripes_gif(colours: [[u8; 3]; 4], delays_cs: [u16; 4], repeat: gif::Repeat) -> Vec<u8> {
    let palette: Vec<u8> = colours.iter().flatten().copied().collect();
    let mut out = Vec::new();
    {
        let mut enc = gif::Encoder::new(&mut out, W, H, &palette).expect("GIF 编码器");
        enc.set_repeat(repeat).expect("loop count");
        for (i, delay) in delays_cs.iter().enumerate() {
            let mut frame = gif::Frame {
                width: W,
                height: H,
                buffer: vec![i as u8; (W * H) as usize].into(),
                delay: *delay,
                dispose: gif::DisposalMethod::Any,
                ..Default::default()
            };
            frame.make_lzw_pre_encoded();
            enc.write_lzw_pre_encoded_frame(&frame).expect("写帧");
        }
    }
    out
}

/// Forensic fixture for disposal semantics, with a finite loop count (2 passes):
/// frame 0 is full-frame red, `Keep` → frame 1 has a 4×4 green block in the middle (red base shows through), `Background`
/// → frame 2 has a 4×4 blue block at top-left (the red has been cleared, canvas transparent).
pub fn disposal_gif() -> Vec<u8> {
    // Palette entry 3 is reserved as the transparent colour (GIF needs an index to carry “transparent”; this fixture does not use partial transparency, but keeping it makes the palette length a power of 4, avoiding encoder padding differences)
    let palette: Vec<u8> = vec![
        0xe0, 0x20, 0x20, // 0 red
        0x20, 0xc0, 0x20, // 1 green
        0x20, 0x40, 0xe0, // 2 blue
        0x00, 0x00, 0x00, // 3 placeholder
    ];
    let mut out = Vec::new();
    {
        let mut enc = gif::Encoder::new(&mut out, W, H, &palette).expect("GIF 编码器");
        enc.set_repeat(gif::Repeat::Finite(2)).expect("loop count");
        let mut push = |frame: gif::Frame<'static>| {
            let mut frame = frame;
            frame.make_lzw_pre_encoded();
            enc.write_lzw_pre_encoded_frame(&frame).expect("写帧");
        };
        push(gif::Frame {
            width: W,
            height: H,
            buffer: vec![0u8; (W * H) as usize].into(),
            delay: 10,
            dispose: gif::DisposalMethod::Keep,
            ..Default::default()
        });
        push(gif::Frame {
            left: 2,
            top: 2,
            width: 4,
            height: 4,
            buffer: vec![1u8; 16].into(),
            delay: 10,
            dispose: gif::DisposalMethod::Background,
            ..Default::default()
        });
        push(gif::Frame {
            left: 0,
            top: 0,
            width: 4,
            height: 4,
            buffer: vec![2u8; 16].into(),
            delay: 10,
            dispose: gif::DisposalMethod::Keep,
            ..Default::default()
        });
    }
    out
}

// ── APNG ────────────────────────────────────────────────────────────

/// Three full-frame solid colours with fractional delays (1/25, 1/10, 3/50 s → 40 / 100 / 60 ms),
/// `num_plays = 1` (finite loop).
pub fn pulse_apng() -> Vec<u8> {
    const COLOURS: [[u8; 4]; 3] = [
        [0x00, 0xc8, 0xd0, 0xff],
        [0xd0, 0x00, 0xa0, 0xff],
        [0xf4, 0xf4, 0xf0, 0xff],
    ];
    const DELAYS: [(u16, u16); 3] = [(1, 25), (1, 10), (3, 50)];
    let mut out = Vec::new();
    {
        let mut enc = png::Encoder::new(Cursor::new(&mut out), W as u32, H as u32);
        enc.set_color(png::ColorType::Rgba);
        enc.set_depth(png::BitDepth::Eight);
        enc.set_animated(COLOURS.len() as u32, 1).expect("acTL");
        let mut writer = enc.write_header().expect("PNG 头");
        for (colour, (num, den)) in COLOURS.iter().zip(DELAYS) {
            writer.set_frame_delay(num, den).expect("fcTL delay");
            writer
                .set_dispose_op(png::DisposeOp::None)
                .expect("dispose_op");
            writer.set_blend_op(png::BlendOp::Source).expect("blend_op");
            let data: Vec<u8> = colour
                .iter()
                .copied()
                .cycle()
                .take((W * H) as usize * 4)
                .collect();
            writer.write_image_data(&data).expect("写帧");
        }
        writer.finish().expect("收尾");
    }
    out
}

/// Static PNG (for the rejection path).
pub fn static_png() -> Vec<u8> {
    let mut out = Vec::new();
    {
        let mut enc = png::Encoder::new(Cursor::new(&mut out), W as u32, H as u32);
        enc.set_color(png::ColorType::Rgba);
        enc.set_depth(png::BitDepth::Eight);
        let mut writer = enc.write_header().expect("PNG 头");
        writer
            .write_image_data(&vec![0x80u8; (W * H) as usize * 4])
            .expect("写图");
        writer.finish().expect("收尾");
    }
    out
}

// ── Animated WebP ───────────────────────────────────────────────────────

/// Three full-frame solid colours, delays 50 / 100 / 150 ms, infinite loop.
///
/// `image` only has a **static** lossless WebP encoder, so here each frame is encoded as a separate lossless WebP, its `VP8L` sub-chunk is extracted, and then the `VP8X` + `ANIM` + `ANMF` container is assembled by hand per the RIFF spec. The assembly is a few dozen lines of plain byte concatenation, far cheaper than adding a C dependency.
pub fn wave_webp() -> Vec<u8> {
    const COLOURS: [[u8; 4]; 3] = [
        [0x20, 0x80, 0xff, 0xff],
        [0xff, 0xa0, 0x20, 0xff],
        [0x40, 0xe0, 0x80, 0xff],
    ];
    const DELAYS_MS: [u32; 3] = [50, 100, 150];

    let mut body = Vec::new();
    // VP8X: only the ANIMATION bit (0x02) is set; the canvas size is encoded as “minus one”
    let mut vp8x = vec![0x02u8, 0, 0, 0];
    vp8x.extend_from_slice(&u24(W as u32 - 1));
    vp8x.extend_from_slice(&u24(H as u32 - 1));
    body.extend_from_slice(&chunk(b"VP8X", &vp8x));
    // ANIM: background colour BGRA + loop_count (0 = infinite)
    let mut anim = vec![0u8, 0, 0, 0];
    anim.extend_from_slice(&0u16.to_le_bytes());
    body.extend_from_slice(&chunk(b"ANIM", &anim));

    for (colour, duration) in COLOURS.iter().zip(DELAYS_MS) {
        let rgba: Vec<u8> = colour
            .iter()
            .copied()
            .cycle()
            .take((W * H) as usize * 4)
            .collect();
        let mut still = Vec::new();
        image::codecs::webp::WebPEncoder::new_lossless(&mut still)
            .encode(&rgba, W as u32, H as u32, image::ExtendedColorType::Rgba8)
            .expect("无损 WebP 编码");
        // After "RIFF" + size + "WEBP" comes a single VP8L sub-chunk; the whole chunk is moved into ANMF
        let vp8l = &still[12..];
        assert_eq!(&vp8l[..4], b"VP8L", "静态 WebP 应当只有一个 VP8L 子块");

        let mut anmf = Vec::new();
        anmf.extend_from_slice(&u24(0)); // frame_x (in units of 2 pixels)
        anmf.extend_from_slice(&u24(0)); // frame_y
        anmf.extend_from_slice(&u24(W as u32 - 1));
        anmf.extend_from_slice(&u24(H as u32 - 1));
        anmf.extend_from_slice(&u24(duration));
        anmf.push(0); // blending = alpha blend，disposal = none
        anmf.extend_from_slice(vp8l);
        body.extend_from_slice(&chunk(b"ANMF", &anmf));
    }

    let mut out = Vec::with_capacity(body.len() + 12);
    out.extend_from_slice(b"RIFF");
    out.extend_from_slice(&((body.len() + 4) as u32).to_le_bytes());
    out.extend_from_slice(b"WEBP");
    out.extend_from_slice(&body);
    out
}

/// RIFF sub-chunk: fourcc + little-endian length + payload (odd lengths are padded with one 0 byte).
fn chunk(fourcc: &[u8; 4], payload: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(payload.len() + 9);
    out.extend_from_slice(fourcc);
    out.extend_from_slice(&(payload.len() as u32).to_le_bytes());
    out.extend_from_slice(payload);
    if payload.len() % 2 == 1 {
        out.push(0);
    }
    out
}

/// A 24-bit little-endian integer as used in WebP.
fn u24(v: u32) -> [u8; 3] {
    [v as u8, (v >> 8) as u8, (v >> 16) as u8]
}
