//! Minimal WAV writing / reading (16-bit PCM). Synthesis output and bundled recordings go through here. Mono is the norm;
//! for multichannel see [`write_wav_pcm16_channels`].

use anyhow::{Context, Result, bail};
use std::io::Write;
use std::path::Path;

/// Writes f32 mono PCM as a 16-bit PCM WAV. Samples outside [-1, 1] are clipped.
pub fn write_wav_pcm16(path: &Path, samples: &[f32], sample_rate: u32) -> Result<()> {
    let bytes = encode_wav_pcm16(samples, sample_rate);
    let mut file = std::fs::File::create(path).with_context(|| format!("无法创建 WAV：{}", path.display()))?;
    file.write_all(&bytes)?;
    file.flush()?;
    Ok(())
}

/// Encodes in memory, for reuse by tests and streaming output.
pub fn encode_wav_pcm16(samples: &[f32], sample_rate: u32) -> Vec<u8> {
    encode_wav_pcm16_channels(std::slice::from_ref(&samples), sample_rate)
}

/// Writes a multichannel 16-bit PCM WAV from per-channel planes (interleaved on disk). If channel lengths differ, they are truncated to the shortest.
pub fn write_wav_pcm16_channels<S: AsRef<[f32]>>(path: &Path, channels: &[S], sample_rate: u32) -> Result<()> {
    let bytes = encode_wav_pcm16_channels(channels, sample_rate);
    let mut file = std::fs::File::create(path).with_context(|| format!("无法创建 WAV：{}", path.display()))?;
    file.write_all(&bytes)?;
    file.flush()?;
    Ok(())
}

/// In-memory version of [`write_wav_pcm16_channels`]; for mono, the output is byte-identical to [`encode_wav_pcm16`].
pub fn encode_wav_pcm16_channels<S: AsRef<[f32]>>(channels: &[S], sample_rate: u32) -> Vec<u8> {
    let count = channels.len().max(1) as u16;
    let frames = channels.iter().map(|channel| channel.as_ref().len()).min().unwrap_or(0);
    let block = 2 * u32::from(count);
    let data_len = frames as u32 * block;
    let mut out = Vec::with_capacity(44 + data_len as usize);
    out.extend_from_slice(b"RIFF");
    out.extend_from_slice(&(36 + data_len).to_le_bytes());
    out.extend_from_slice(b"WAVE");
    out.extend_from_slice(b"fmt ");
    out.extend_from_slice(&16u32.to_le_bytes());
    out.extend_from_slice(&1u16.to_le_bytes()); // PCM
    out.extend_from_slice(&count.to_le_bytes());
    out.extend_from_slice(&sample_rate.to_le_bytes());
    out.extend_from_slice(&(sample_rate * block).to_le_bytes());
    out.extend_from_slice(&(block as u16).to_le_bytes());
    out.extend_from_slice(&16u16.to_le_bytes());
    out.extend_from_slice(b"data");
    out.extend_from_slice(&data_len.to_le_bytes());
    for frame in 0..frames {
        for channel in channels {
            let clipped = channel.as_ref()[frame].clamp(-1.0, 1.0);
            let value = (clipped * 32767.0).round() as i16;
            out.extend_from_slice(&value.to_le_bytes());
        }
    }
    out
}

/// Reads a 16-bit PCM mono WAV written by this crate (for tests and self-checks; for arbitrary media use
/// [`crate::audio::decode_mono`]).
pub fn read_wav_pcm16(path: &Path) -> Result<(Vec<f32>, u32)> {
    let bytes = std::fs::read(path).with_context(|| format!("无法读取 WAV：{}", path.display()))?;
    decode_wav_pcm16(&bytes)
}

/// Header only: returns the (frame count, sample rate) of a 16-bit PCM WAV written by this crate, without decoding all samples.
/// To measure the duration of an existing output, use this: the duration follows **the WAV on disk**; no sidecar record is trusted.
pub fn probe_wav_pcm16(path: &Path) -> Result<(u64, u32)> {
    use std::io::Read;

    let mut file = std::fs::File::open(path).with_context(|| format!("无法读取 WAV：{}", path.display()))?;
    let file_len = file.metadata()?.len();
    let mut head = vec![0u8; 4096.min(file_len.max(44)) as usize];
    let read = file.read(&mut head)?;
    head.truncate(read);
    if head.len() < 44 || &head[0..4] != b"RIFF" || &head[8..12] != b"WAVE" {
        bail!("不是 RIFF/WAVE 文件");
    }
    let mut cursor = 12usize;
    let mut sample_rate = 0u32;
    let mut channels = 0u16;
    let mut data_bytes: Option<u64> = None;
    while cursor + 8 <= head.len() {
        let id = &head[cursor..cursor + 4];
        let size = u32::from_le_bytes(head[cursor + 4..cursor + 8].try_into()?) as u64;
        let body_start = cursor + 8;
        match id {
            b"fmt " => {
                let body_end = (body_start + size as usize).min(head.len());
                let body = &head[body_start..body_end];
                if body.len() < 16 {
                    bail!("fmt 块过短");
                }
                let format = u16::from_le_bytes([body[0], body[1]]);
                channels = u16::from_le_bytes([body[2], body[3]]);
                sample_rate = u32::from_le_bytes(body[4..8].try_into()?);
                let bits = u16::from_le_bytes([body[14], body[15]]);
                if format != 1 || bits != 16 {
                    bail!("只支持 16-bit PCM WAV（format {format}，bits {bits}）");
                }
            }
            b"data" => {
                // The declared data length may be larger than the actual file (a write that was interrupted partway). Use the file's real
                // remaining bytes; it is better to under-report than to over-report.
                data_bytes = Some(size.min(file_len.saturating_sub(body_start as u64)));
                break;
            }
            _ => {}
        }
        cursor = body_start + size as usize + (size & 1) as usize;
    }
    let data_bytes = data_bytes.context("WAV 缺少 data 块")?;
    if channels == 0 || sample_rate == 0 {
        bail!("WAV 缺少 fmt 块");
    }
    Ok((data_bytes / (2 * u64::from(channels)), sample_rate))
}

/// Reads and mixes down to mono (multichannel is averaged).
pub fn decode_wav_pcm16(bytes: &[u8]) -> Result<(Vec<f32>, u32)> {
    let (channels, rate) = decode_wav_pcm16_channels(bytes)?;
    let count = channels.len() as f32;
    let samples = match channels.as_slice() {
        [mono] => mono.clone(),
        many => (0..many[0].len())
            .map(|frame| many.iter().map(|channel| channel[frame]).sum::<f32>() / count)
            .collect(),
    };
    Ok((samples, rate))
}

/// Reads and returns per-channel planes (no downmix).
pub fn read_wav_pcm16_channels(path: &Path) -> Result<(Vec<Vec<f32>>, u32)> {
    let bytes = std::fs::read(path).with_context(|| format!("无法读取 WAV：{}", path.display()))?;
    decode_wav_pcm16_channels(&bytes)
}

/// In-memory version of [`read_wav_pcm16_channels`].
pub fn decode_wav_pcm16_channels(bytes: &[u8]) -> Result<(Vec<Vec<f32>>, u32)> {
    if bytes.len() < 44 || &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"WAVE" {
        bail!("不是 RIFF/WAVE 文件");
    }
    let mut cursor = 12;
    let mut sample_rate = 0u32;
    let mut channels = 0u16;
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
                    bail!("fmt 块过短");
                }
                let format = u16::from_le_bytes([body[0], body[1]]);
                channels = u16::from_le_bytes([body[2], body[3]]);
                sample_rate = u32::from_le_bytes(body[4..8].try_into()?);
                let bits = u16::from_le_bytes([body[14], body[15]]);
                if format != 1 || bits != 16 {
                    bail!("只支持 16-bit PCM WAV（format {format}，bits {bits}）");
                }
            }
            b"data" => data = Some(body),
            _ => {}
        }
        cursor = body_start + size + (size & 1);
    }
    let data = data.context("WAV 缺少 data 块")?;
    if channels == 0 || sample_rate == 0 {
        bail!("WAV 缺少 fmt 块");
    }
    let frames = data.len() / (2 * channels as usize);
    let mut planes = vec![Vec::with_capacity(frames); channels as usize];
    for frame in 0..frames {
        for (channel, plane) in planes.iter_mut().enumerate() {
            let offset = (frame * channels as usize + channel) * 2;
            let value = i16::from_le_bytes([data[offset], data[offset + 1]]);
            plane.push(f32::from(value) / 32768.0);
        }
    }
    Ok((planes, sample_rate))
}

/// Header only: channel count.
pub fn probe_wav_channels(path: &Path) -> Result<u16> {
    let bytes = std::fs::read(path).with_context(|| format!("无法读取 WAV：{}", path.display()))?;
    let head = &bytes[..bytes.len().min(4096)];
    let mut cursor = 12usize;
    if head.len() < 44 || &head[0..4] != b"RIFF" || &head[8..12] != b"WAVE" {
        bail!("不是 RIFF/WAVE 文件");
    }
    while cursor + 8 <= head.len() {
        let size = u32::from_le_bytes(head[cursor + 4..cursor + 8].try_into()?) as usize;
        if &head[cursor..cursor + 4] == b"fmt " && cursor + 12 <= head.len() {
            return Ok(u16::from_le_bytes([head[cursor + 10], head[cursor + 11]]));
        }
        cursor += 8 + size + (size & 1);
    }
    bail!("WAV 缺少 fmt 块")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wav_round_trip_keeps_samples_and_rate() {
        let samples: Vec<f32> = (0..480).map(|i| ((i as f32) * 0.05).sin() * 0.5).collect();
        let bytes = encode_wav_pcm16(&samples, 24_000);
        assert_eq!(bytes.len(), 44 + 480 * 2);
        let (decoded, rate) = decode_wav_pcm16(&bytes).unwrap();
        assert_eq!(rate, 24_000);
        assert_eq!(decoded.len(), 480);
        for (a, b) in samples.iter().zip(&decoded) {
            assert!((a - b).abs() < 1.0 / 32000.0, "{a} vs {b}");
        }
    }

    #[test]
    fn probe_reads_frames_and_rate_without_decoding() {
        let dir = std::env::temp_dir().join(format!("ccut-wav-probe-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("probe.wav");
        let samples: Vec<f32> = (0..1_200).map(|i| (i as f32 * 0.01).sin() * 0.3).collect();
        write_wav_pcm16(&path, &samples, 24_000).unwrap();
        assert_eq!(probe_wav_pcm16(&path).unwrap(), (1_200, 24_000));
        // A truncated output reports only the frames actually written, not the length declared in the header.
        let mut bytes = std::fs::read(&path).unwrap();
        bytes.truncate(44 + 800 * 2);
        std::fs::write(&path, &bytes).unwrap();
        assert_eq!(probe_wav_pcm16(&path).unwrap(), (800, 24_000));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn stereo_round_trip_keeps_both_channels() {
        let left: Vec<f32> = (0..300).map(|i| (i as f32 * 0.03).sin() * 0.4).collect();
        let right: Vec<f32> = left.iter().map(|s| -s * 0.5).collect();
        let bytes = encode_wav_pcm16_channels(&[left.clone(), right.clone()], 48_000);
        assert_eq!(bytes.len(), 44 + 300 * 4);
        let (planes, rate) = decode_wav_pcm16_channels(&bytes).unwrap();
        assert_eq!((planes.len(), rate), (2, 48_000));
        for (a, b) in right.iter().zip(&planes[1]) {
            assert!((a - b).abs() < 1.0 / 32000.0);
        }
        // Downmixing on read averages the channels; mono encoding is byte-identical to the old function.
        let (mono, _) = decode_wav_pcm16(&bytes).unwrap();
        assert!((mono[10] - (left[10] + right[10]) / 2.0).abs() < 1.0 / 16000.0);
        assert_eq!(encode_wav_pcm16_channels(&[left.clone()], 48_000), encode_wav_pcm16(&left, 48_000));
        let dir = std::env::temp_dir().join(format!("ccut-wav-stereo-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("st.wav");
        write_wav_pcm16_channels(&path, &[left, right], 48_000).unwrap();
        assert_eq!(probe_wav_channels(&path).unwrap(), 2);
        assert_eq!(probe_wav_pcm16(&path).unwrap(), (300, 48_000));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn clips_out_of_range_samples() {
        let bytes = encode_wav_pcm16(&[2.0, -2.0], 16_000);
        let (decoded, _) = decode_wav_pcm16(&bytes).unwrap();
        assert!(decoded[0] > 0.99 && decoded[1] < -0.99);
    }
}
