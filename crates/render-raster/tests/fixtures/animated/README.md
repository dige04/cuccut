# `core/fixtures/animated/` — conformance fixtures for the `AnimatedImage` source

[`docs/design/bcf/ccut-motion-render-upgrade-design.md`](../../../docs/design/bcf/ccut-motion-render-upgrade-design.md)
§7 / §10 stage 6 output: one set of tiny assets for each of the three containers GIF / APNG / animated WebP, each pinning four things — per-frame duration, disposal, loop count, and canvas compositing — to one observable pixel.

**These files are not hand-written, and must not be edited by hand.**

```bash
cd core
cargo test -p ccut-render --test animated_source                  # verify (includes the up-to-date gate)
cargo test -p ccut-render --test animated_source -- --ignored     # regenerate, once the result has been confirmed
```

The generator is `crates/ccut-render/tests/fixture_gen/mod.rs` — not an ffmpeg script like `gen.sh`: per-frame disposal and loop count need precise control, which ffmpeg cannot provide. Keeping the generator inside the tests has another benefit: `animated_fixtures_are_up_to_date` is therefore a real gate (it recomputes on the spot and then compares byte by byte), rather than "run a script once and hope".

## Layout

| Path | Contents |
| --- | --- |
| `stripes.gif` | 8×8, 4 frames of solid full-canvas colour, delays 100 / 200 / 300 / 400 ms, infinite loop |
| `disposal.gif` | 8×8, 3 frames, `Keep` → `Background` → `Keep`, **finite** loop count (2 passes) |
| `pulse.png` | 8×8 APNG, 3 frames, fractional delays 1/25, 1/10, 3/50 s → 40 / 100 / 60 ms, `num_plays = 1` |
| `wave.webp` | 8×8 animated WebP, 3 frames, delays 50 / 100 / 150 ms, infinite loop |
| `<stem>/frame-<i>.png` | **byte-for-byte** golden for frame i of that asset (final pixels after decoding and canvas compositing) |
| `expected.json` | metadata, duration table, content fingerprint, per-frame digests, and a set of sample points (including out-of-range and negative times) |

## Three pinned semantics

1. **Per-frame duration table**: `frameStartsMs` holds the cumulative start points, N+1 entries, where the last entry is the total duration. **Any** instant that falls within a frame's window is quantized to that frame's start — the still-frame cache and frame fingerprints rely on this to hit.
2. **Disposal applies only to that frame's own frame rectangle**, not to the whole canvas. So frame 3 of `disposal.gif` contains three kinds of pixels at once: the blue block from this frame, the transparency that the previous frame's rectangle was disposed to, and the red background kept from frame 1 outside that rectangle.
3. **Loop count is probed metadata, not a rendering criterion.** The `2x` of `disposal.gif` appears in `ccut probe`, but whether the picture loops is decided by whether the document's `animatedImage` element sets `loop` (it defaults to this field). A document's playback behaviour should not depend on a container byte.

## Known container quirks

The golden colours of `wave.webp` are **1 lower** than the values the generator wrote (`0x20` → 31, `0xff` → 254). This is the offset from the round trip through the `image` / `image-webp` pair of lossless WebP codecs. It **happens on the fixture generation side** and is unrelated to the rendering path (the GIF and APNG paths are byte-exact in colour). Goldens are set from the measured values; the numbers are not changed just to look nicer.
