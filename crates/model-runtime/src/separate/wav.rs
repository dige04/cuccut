//! Minimal WAV reading and writing (writes stereo 16-bit PCM; reads mono or stereo 16-bit PCM and 32-bit float).
//!
//! Separation outputs are written to disk through here, to avoid adding hound; for decoding arbitrary media (mp4, etc.), use ffmpeg.

use super::types::StereoAudio;
use anyhow::{Context, Result, bail};
use std::io::Write;
use std::path::Path;

/// Writes stereo f32 PCM as a 16-bit PCM WAV. Samples outside [-1, 1] are clipped.
pub fn write_wav_stereo_pcm16(path: &Path, audio: &StereoAudio) -> Result<()> {
    let bytes = encode_wav_stereo_pcm16(audio)?;
    let mut file = std::fs::File::create(path).with_context(|| format!("cannot create WAV: {}", path.display()))?;
    file.write_all(&bytes)?;
    file.flush()?;
    Ok(())
}

/// Encodes stereo 16-bit PCM WAV in memory.
pub fn encode_wav_stereo_pcm16(audio: &StereoAudio) -> Result<Vec<u8>> {
    if audio.left.len() != audio.right.len() {
        bail!("left and right channels have different lengths: {} / {}", audio.left.len(), audio.right.len());
    }
    Ok(encode_wav_stereo_i16(audio.sample_rate, &interleave_pcm16(audio)))
}

/// Quantization rule for writing stem tracks to disk: clip to [-1, 1], multiply by 32767, and round. The local `ccut separate` writes WAV, and the node separation that returns FLAC stems (remote compute J2) uses this same rule,
/// so the i16 values the client decodes back are sample-for-sample identical to the local output.
pub fn pcm16(sample: f32) -> i16 {
    (sample.clamp(-1.0, 1.0) * 32767.0).round() as i16
}

/// Stereo f32 → interleaved 16-bit PCM (quantized by [`pcm16`]). If left and right differ in length, truncates to the shorter.
pub fn interleave_pcm16(audio: &StereoAudio) -> Vec<i16> {
    let mut out = Vec::with_capacity(audio.left.len() * 2);
    for (l, r) in audio.left.iter().zip(&audio.right) {
        out.push(pcm16(*l));
        out.push(pcm16(*r));
    }
    out
}

/// Encodes interleaved stereo 16-bit PCM as WAV (same file header as [`encode_wav_stereo_pcm16`]).
pub fn encode_wav_stereo_i16(sample_rate: u32, interleaved: &[i16]) -> Vec<u8> {
    let frames = interleaved.len() / 2;
    let channels = 2u16;
    let block_align = channels * 2;
    let data_len = (frames * block_align as usize) as u32;
    let mut out = Vec::with_capacity(44 + data_len as usize);
    out.extend_from_slice(b"RIFF");
    out.extend_from_slice(&(36 + data_len).to_le_bytes());
    out.extend_from_slice(b"WAVE");
    out.extend_from_slice(b"fmt ");
    out.extend_from_slice(&16u32.to_le_bytes());
    out.extend_from_slice(&1u16.to_le_bytes()); // PCM
    out.extend_from_slice(&channels.to_le_bytes());
    out.extend_from_slice(&sample_rate.to_le_bytes());
    out.extend_from_slice(&(sample_rate * u32::from(block_align)).to_le_bytes());
    out.extend_from_slice(&block_align.to_le_bytes());
    out.extend_from_slice(&16u16.to_le_bytes());
    out.extend_from_slice(b"data");
    out.extend_from_slice(&data_len.to_le_bytes());
    for value in &interleaved[..frames * 2] {
        out.extend_from_slice(&value.to_le_bytes());
    }
    out
}

/// Writes the output of [`encode_wav_stereo_i16`] to a file.
pub fn write_wav_stereo_i16(path: &Path, sample_rate: u32, interleaved: &[i16]) -> Result<()> {
    let bytes = encode_wav_stereo_i16(sample_rate, interleaved);
    let mut file = std::fs::File::create(path).with_context(|| format!("cannot create WAV: {}", path.display()))?;
    file.write_all(&bytes)?;
    file.flush()?;
    Ok(())
}

/// Reads WAV (16-bit PCM or 32-bit float, 1 or 2 channels); mono is duplicated into left and right.
pub fn read_wav(path: &Path) -> Result<StereoAudio> {
    let bytes = std::fs::read(path).with_context(|| format!("cannot read WAV: {}", path.display()))?;
    decode_wav(&bytes)
}

pub fn decode_wav(bytes: &[u8]) -> Result<StereoAudio> {
    if bytes.len() < 12 || &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"WAVE" {
        bail!("not a RIFF/WAVE file");
    }
    let mut cursor = 12;
    let mut format = 0u16;
    let mut channels = 0u16;
    let mut sample_rate = 0u32;
    let mut bits = 0u16;
    let mut data: Option<&[u8]> = None;
    while cursor + 8 <= bytes.len() {
        let id = &bytes[cursor..cursor + 4];
        let size = u32::from_le_bytes(bytes[cursor + 4..cursor + 8].try_into()?) as usize;
        let body_start = cursor + 8;
        let body_end = (body_start + size).min(bytes.len());
        let body = &bytes[body_start..body_end];
        match id {
            b"fmt " => {
                if body.len() < 16 {
                    bail!("fmt chunk is too short");
                }
                format = u16::from_le_bytes(body[0..2].try_into()?);
                channels = u16::from_le_bytes(body[2..4].try_into()?);
                sample_rate = u32::from_le_bytes(body[4..8].try_into()?);
                bits = u16::from_le_bytes(body[14..16].try_into()?);
                // WAVE_FORMAT_EXTENSIBLE: the real format is in the first two bytes of SubFormat.
                if format == 0xFFFE && body.len() >= 26 {
                    format = u16::from_le_bytes(body[24..26].try_into()?);
                }
            }
            b"data" => {
                data = Some(body);
                break;
            }
            _ => {}
        }
        cursor = body_start + size + (size & 1);
    }
    let data = data.context("WAV is missing the data chunk")?;
    if !(channels == 1 || channels == 2) {
        bail!("only 1- or 2-channel WAV is supported, found {channels}");
    }
    if sample_rate == 0 {
        bail!("WAV sample rate is 0");
    }
    let interleaved: Vec<f32> = match (format, bits) {
        (1, 16) => data
            .chunks_exact(2)
            .map(|c| f32::from(i16::from_le_bytes([c[0], c[1]])) / 32768.0)
            .collect(),
        (3, 32) => data.chunks_exact(4).map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]])).collect(),
        _ => bail!("only 16-bit PCM or 32-bit float WAV is supported, found format {format} / {bits} bit"),
    };
    let (left, right) = if channels == 1 {
        (interleaved.clone(), interleaved)
    } else {
        let left = interleaved.iter().step_by(2).copied().collect();
        let right = interleaved.iter().skip(1).step_by(2).copied().collect();
        (left, right)
    };
    Ok(StereoAudio { left, right, sample_rate })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stereo_pcm16_roundtrip() {
        let audio = StereoAudio {
            left: vec![0.0, 0.5, -0.5, 1.0, -1.0, 2.0],
            right: vec![0.25, -0.25, 0.75, -0.75, 0.0, -2.0],
            sample_rate: 44_100,
        };
        let bytes = encode_wav_stereo_pcm16(&audio).unwrap();
        assert_eq!(bytes.len(), 44 + 6 * 4);
        let decoded = decode_wav(&bytes).unwrap();
        assert_eq!(decoded.sample_rate, 44_100);
        assert_eq!(decoded.len(), 6);
        for (a, b) in decoded.left.iter().zip(&audio.left) {
            assert!((a - b.clamp(-1.0, 1.0)).abs() < 1e-4);
        }
        for (a, b) in decoded.right.iter().zip(&audio.right) {
            assert!((a - b.clamp(-1.0, 1.0)).abs() < 1e-4);
        }
    }

    #[test]
    fn pcm16_is_the_single_quantization_rule() {
        assert_eq!(pcm16(1.0), 32_767);
        assert_eq!(pcm16(-2.0), -32_767);
        assert_eq!(pcm16(0.5), 16_384);
        let audio = StereoAudio {
            left: vec![0.1, -0.3],
            right: vec![0.7, 0.0],
            sample_rate: 48_000,
        };
        assert_eq!(
            encode_wav_stereo_pcm16(&audio).unwrap(),
            encode_wav_stereo_i16(48_000, &interleave_pcm16(&audio)),
            "f32 and i16 encodings should produce the same bytes"
        );
    }

    #[test]
    fn decodes_mono_float32() {
        let samples = [0.1f32, -0.2, 0.3];
        let mut bytes = Vec::new();
        bytes.extend_from_slice(b"RIFF");
        bytes.extend_from_slice(&(36 + 12u32).to_le_bytes());
        bytes.extend_from_slice(b"WAVE");
        bytes.extend_from_slice(b"fmt ");
        bytes.extend_from_slice(&16u32.to_le_bytes());
        bytes.extend_from_slice(&3u16.to_le_bytes());
        bytes.extend_from_slice(&1u16.to_le_bytes());
        bytes.extend_from_slice(&16_000u32.to_le_bytes());
        bytes.extend_from_slice(&64_000u32.to_le_bytes());
        bytes.extend_from_slice(&4u16.to_le_bytes());
        bytes.extend_from_slice(&32u16.to_le_bytes());
        bytes.extend_from_slice(b"data");
        bytes.extend_from_slice(&12u32.to_le_bytes());
        for s in samples {
            bytes.extend_from_slice(&s.to_le_bytes());
        }
        let decoded = decode_wav(&bytes).unwrap();
        assert_eq!(decoded.sample_rate, 16_000);
        assert_eq!(decoded.left, samples.to_vec());
        assert_eq!(decoded.right, samples.to_vec());
    }

    #[test]
    fn rejects_mismatched_channels() {
        let audio = StereoAudio {
            left: vec![0.0; 3],
            right: vec![0.0; 2],
            sample_rate: 44_100,
        };
        assert!(encode_wav_stereo_pcm16(&audio).is_err());
        assert!(decode_wav(b"not a wav").is_err());
    }
}
