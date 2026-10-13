//! A pure-function layer for CucCut's audio-derived data: **bytes in, bytes out, no I/O at all**.
//!
//! The two cache formats each handle one thing and do not affect each other:
//!
//! - [`bcw1`]: peak envelope (50 bins/s, single-byte amplitude). It only feeds the audio-track graphic in the timeline UI and **does not drive pixels**, so it is not in the render fingerprint. The format logic was migrated from the waveform service in `apps/cli`; the byte layout is unchanged bit for bit.
//! - [`bcs1`]: spectrum (fixed-length frames of time-domain rows plus frequency-domain rows). It drives the pixels of the visualizer element, so its header carries the content hash and it goes into the render fingerprint.
//!
//! Decoding is done by the caller (the host): `ccut_speech::audio::decode_mono_48k` gives 48 kHz mono f32 PCM. This crate only handles PCM → bytes and bytes → view.
//!
//! [`remap`] is the remapping and smoothing of element-level parameters (`minDb` / `maxDb` / `smoothing` / `gain`). **It is not cached**: one canonical-window BCS1 serves any combination of parameters.

pub mod bcs1;
pub mod bcw1;
/// Mono PCM → beats / bars / sections (the algorithm layer of `ccut beats`). Like [`dsp`], it is controlled by the `dsp` feature, since both need the real FFT.
#[cfg(feature = "dsp")]
pub mod beats;
/// STFT from PCM to BCS1. On by default. Consumers that only read BCS1 can turn it off with `default-features = false`, and realfft then drops out of the dependency graph.
#[cfg(feature = "dsp")]
pub mod dsp;
pub mod remap;

pub use bcs1::{Bcs1Header, Bcs1View, SpectrumBackend};
pub use bcw1::Bcw1Info;
pub use remap::Remapper;

/// FNV-1a 64-bit. BCW1's file-name fingerprint and BCS1's content hash share the same implementation.
#[derive(Debug, Clone, Copy)]
pub struct Fnv1a64(u64);

impl Default for Fnv1a64 {
    fn default() -> Self {
        Self::new()
    }
}

impl Fnv1a64 {
    pub const OFFSET_BASIS: u64 = 0xcbf2_9ce4_8422_2325;
    pub const PRIME: u64 = 0x0000_0100_0000_01b3;

    pub fn new() -> Self {
        Self(Self::OFFSET_BASIS)
    }

    pub fn write(&mut self, bytes: &[u8]) {
        for &byte in bytes {
            self.0 ^= u64::from(byte);
            self.0 = self.0.wrapping_mul(Self::PRIME);
        }
    }

    pub fn finish(self) -> u64 {
        self.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fnv1a64_matches_the_reference_vectors() {
        let mut hash = Fnv1a64::new();
        assert_eq!(hash.finish(), 0xcbf2_9ce4_8422_2325);
        hash.write(b"a");
        assert_eq!(hash.finish(), 0xaf63_dc4c_8601_ec8c);
        let mut split = Fnv1a64::new();
        split.write(b"foo");
        split.write(b"bar");
        let mut whole = Fnv1a64::new();
        whole.write(b"foobar");
        assert_eq!(split.finish(), whole.finish());
    }
}
