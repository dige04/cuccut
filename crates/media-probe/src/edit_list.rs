//! The start of the ISO-BMFF audio track edit list (`elst`): how many encoder priming frames to discard after decoding.
//!
//! ## Why read it ourselves
//!
//! The AAC encoder pads the start of the bitstream with priming frames (ffmpeg's `aac` encoder uses 1024 frames, AVFoundation uses 2112). MP4 / M4A / MOV use the track's edit list to keep them outside the presentation timeline: the `media_time` of the first edit in `elst` is the moment in the media timeline that presentation time 0 corresponds to. ffmpeg and all the players drop the prefix according to it. **Symphonia 0.6's isomp4 demuxer reads `elst` but does not apply it** (its `demuxer.rs` states "edits are not currently supported"), and the AAC decoder does not trim per packet either. So the priming frames are mixed into the PCM as is, and the whole audio decoded by the pure Rust path is `media_time` frames later than ffmpeg's (1024 frames at 44.1 kHz ≈ 23.2 ms). Symphonia's `ElstAtom` fields are private, so it has to be read separately here.
//!
//! ## Conventions (consistent with ffmpeg decoding to an f32le pipe)
//!
//! - It only answers **how much of the prefix to drop**: it takes the `media_time` of the first non-empty edit of the selected audio track.
//! - It does not trim the tail according to `segment_duration`: the ffmpeg CLI decode also keeps the trailing padding (on `core/fixtures/native-export/source.mp4`, both sides decode 48128 frames).
//! - Leading empty edits (`media_time = -1`, presentation delay) are not padded with silence. For multiple non-empty edits, only the start of the first one is taken. `media_rate ≠ 1` is ignored. These three cases are rare in material and are known boundaries.
//!
//! ## Cost
//!
//! Only the box headers and the three small boxes `tkhd` / `mdhd` / `elst` are read. `stbl` and `mdat` are always skipped by seeking. Even a several-hour file needs only dozens of small reads, which is not worth caching for each lookup made before decoding.

use std::io::{self, Read, Seek, SeekFrom};
use std::path::Path;

/// The whitelist of top-level box types. If the first box is not in it, the file is not ISO-BMFF and no lookup is done. Old-style MOV files do not always start with `ftyp`; ones starting with `wide`, `mdat` or `moov` have been seen.
const TOP_LEVEL_TYPES: &[&[u8; 4]] = &[
    b"ftyp", b"moov", b"mdat", b"free", b"skip", b"wide", b"pnot", b"uuid", b"styp",
];

/// The size limit for boxes that must be read into memory whole: `tkhd` / `mdhd` are a few dozen bytes, and each `elst` entry is 12 or 20 bytes. Anything bigger must be a bad file, and is treated as "no edit list".
const MAX_SMALL_BOX: u64 = 1 << 20;

/// The start of the track's first non-empty edit, in the track's `mdhd` media timescale.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EditStart {
    /// `elst`'s `media_time` (in media timescale ticks), always greater than 0.
    pub media_time: u64,
    /// The track's `mdhd` timescale (ticks per second), always greater than 0.
    pub timescale: u32,
}

impl EditStart {
    /// Converts to the number of decoded frames to drop at `sample_rate` (rounded).
    ///
    /// The track's media timescale is usually the sample rate (exact frame for frame in that case), but the spec does not require the two to be equal.
    pub fn frames(&self, sample_rate: u32) -> u64 {
        let timescale = u128::from(self.timescale);
        let scaled = u128::from(self.media_time) * u128::from(sample_rate);
        u64::try_from((scaled + timescale / 2) / timescale).unwrap_or(u64::MAX)
    }
}

/// Looks up the edit-list start for the track `track_id` in `path` (`tkhd.track_ID`, which is Symphonia's `Track::id`).
///
/// Cases that return `None`: not ISO-BMFF, unreadable, the track is not found, there is no `elst`, or the first non-empty edit starts at 0. All of these are equivalent to "no prefix to drop", and the caller simply decodes as usual.
pub fn audio_edit_start(path: &Path, track_id: u32) -> Option<EditStart> {
    let file = std::fs::File::open(path).ok()?;
    let len = file.metadata().ok()?.len();
    edit_start_in(&mut io::BufReader::new(file), len, track_id)
        .ok()
        .flatten()
}

fn edit_start_in<R: Read + Seek>(
    reader: &mut R,
    len: u64,
    track_id: u32,
) -> io::Result<Option<EditStart>> {
    // Check the type first, then the size. Reading a WAV / FLAC's first 4 bytes as a box size necessarily overruns, and that is not a "bad MP4", just a different container.
    let mut magic = [0u8; 8];
    if reader.read_exact(&mut magic).is_err() {
        return Ok(None);
    }
    if !TOP_LEVEL_TYPES.contains(&&[magic[4], magic[5], magic[6], magic[7]]) {
        return Ok(None);
    }
    let mut pos = 0;
    while let Some(header) = next_box(reader, pos, len)? {
        if &header.kind == b"moov" {
            return find_in_moov(reader, &header, track_id);
        }
        pos = header.end;
    }
    Ok(None)
}

fn find_in_moov<R: Read + Seek>(
    reader: &mut R,
    moov: &BoxHeader,
    track_id: u32,
) -> io::Result<Option<EditStart>> {
    let mut pos = moov.body;
    while let Some(child) = next_box(reader, pos, moov.end)? {
        if &child.kind == b"trak" {
            let trak = read_trak(reader, &child)?;
            if trak.track_id != Some(track_id) {
                pos = child.end;
                continue;
            }
            return Ok(match (trak.media_time, trak.timescale) {
                (Some(media_time), Some(timescale)) if media_time > 0 && timescale > 0 => {
                    Some(EditStart {
                        media_time,
                        timescale,
                    })
                }
                _ => None,
            });
        }
        pos = child.end;
    }
    Ok(None)
}

#[derive(Default)]
struct Trak {
    track_id: Option<u32>,
    timescale: Option<u32>,
    media_time: Option<u64>,
}

fn read_trak<R: Read + Seek>(reader: &mut R, trak: &BoxHeader) -> io::Result<Trak> {
    let mut out = Trak::default();
    let mut pos = trak.body;
    while let Some(child) = next_box(reader, pos, trak.end)? {
        match &child.kind {
            b"tkhd" => out.track_id = read_small(reader, &child)?.and_then(|b| parse_tkhd(&b)),
            b"edts" => {
                let mut inner = child.body;
                while let Some(grandchild) = next_box(reader, inner, child.end)? {
                    if &grandchild.kind == b"elst" {
                        out.media_time =
                            read_small(reader, &grandchild)?.and_then(|b| parse_elst(&b));
                    }
                    inner = grandchild.end;
                }
            }
            b"mdia" => {
                let mut inner = child.body;
                while let Some(grandchild) = next_box(reader, inner, child.end)? {
                    if &grandchild.kind == b"mdhd" {
                        out.timescale =
                            read_small(reader, &grandchild)?.and_then(|b| parse_mdhd(&b));
                    }
                    inner = grandchild.end;
                }
            }
            _ => {}
        }
        pos = child.end;
    }
    Ok(out)
}

struct BoxHeader {
    kind: [u8; 4],
    /// The payload start (skips the size/type and the possible 64-bit largesize).
    body: u64,
    /// The end of this box (open interval).
    end: u64,
}

/// Reads the box header at `pos`. Returns `None` when the remaining container is not big enough for a header. A size that overruns counts as a bad file.
fn next_box<R: Read + Seek>(reader: &mut R, pos: u64, end: u64) -> io::Result<Option<BoxHeader>> {
    if pos.saturating_add(8) > end {
        return Ok(None);
    }
    reader.seek(SeekFrom::Start(pos))?;
    let mut head = [0u8; 8];
    reader.read_exact(&mut head)?;
    let kind = [head[4], head[5], head[6], head[7]];
    let (header_len, size) = match u32::from_be_bytes([head[0], head[1], head[2], head[3]]) {
        // 64-bit largesize (common for large mdat).
        1 => {
            let mut large = [0u8; 8];
            reader.read_exact(&mut large)?;
            (16, u64::from_be_bytes(large))
        }
        // Extends to the end of the container.
        0 => (8, end - pos),
        size => (8, u64::from(size)),
    };
    if size < header_len || pos.saturating_add(size) > end {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "box 尺寸越界"));
    }
    Ok(Some(BoxHeader {
        kind,
        body: pos + header_len,
        end: pos + size,
    }))
}

fn read_small<R: Read + Seek>(reader: &mut R, header: &BoxHeader) -> io::Result<Option<Vec<u8>>> {
    let len = header.end - header.body;
    if len > MAX_SMALL_BOX {
        return Ok(None);
    }
    reader.seek(SeekFrom::Start(header.body))?;
    let mut bytes = vec![0u8; len as usize];
    reader.read_exact(&mut bytes)?;
    Ok(Some(bytes))
}

fn be_u32(bytes: &[u8], at: usize) -> Option<u32> {
    Some(u32::from_be_bytes(bytes.get(at..at + 4)?.try_into().ok()?))
}

fn be_u64(bytes: &[u8], at: usize) -> Option<u64> {
    Some(u64::from_be_bytes(bytes.get(at..at + 8)?.try_into().ok()?))
}

/// `tkhd` (FullBox): v0 = creation 4 + modification 4 + track_ID; v1 = 8 + 8 + track_ID.
fn parse_tkhd(body: &[u8]) -> Option<u32> {
    match body.first()? {
        0 => be_u32(body, 12),
        1 => be_u32(body, 20),
        _ => None,
    }
}

/// `mdhd` (FullBox): the timescale comes right after the creation / modification times.
fn parse_mdhd(body: &[u8]) -> Option<u32> {
    match body.first()? {
        0 => be_u32(body, 12),
        1 => be_u32(body, 20),
        _ => None,
    }
}

/// `elst` (FullBox): the `media_time` of the first non-empty edit. `-1` is an empty edit (presentation delay), and is skipped. Returns `None` when all edits are empty.
fn parse_elst(body: &[u8]) -> Option<u64> {
    let version = *body.first()?;
    let count = be_u32(body, 4)? as usize;
    let entry_len = match version {
        0 => 12,
        1 => 20,
        _ => return None,
    };
    (0..count).find_map(|index| {
        let at = 8 + index * entry_len;
        let media_time = if version == 1 {
            be_u64(body, at + 8)? as i64
        } else {
            i64::from(be_u32(body, at + 4)? as i32)
        };
        u64::try_from(media_time).ok()
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    fn bx(kind: &[u8; 4], payload: &[u8]) -> Vec<u8> {
        let mut out = ((payload.len() + 8) as u32).to_be_bytes().to_vec();
        out.extend_from_slice(kind);
        out.extend_from_slice(payload);
        out
    }

    fn full(version: u8, rest: &[u8]) -> Vec<u8> {
        let mut out = vec![version, 0, 0, 0];
        out.extend_from_slice(rest);
        out
    }

    fn tkhd(track_id: u32) -> Vec<u8> {
        let mut rest = vec![0u8; 8];
        rest.extend_from_slice(&track_id.to_be_bytes());
        rest.extend_from_slice(&[0u8; 68]);
        bx(b"tkhd", &full(0, &rest))
    }

    fn mdia(timescale: u32) -> Vec<u8> {
        let mut rest = vec![0u8; 8];
        rest.extend_from_slice(&timescale.to_be_bytes());
        rest.extend_from_slice(&[0u8; 8]);
        let mut stbl_padding = bx(b"hdlr", &full(0, b"\0\0\0\0soun"));
        stbl_padding.extend(bx(b"minf", &bx(b"stbl", &[0u8; 64])));
        let mut payload = bx(b"mdhd", &full(0, &rest));
        payload.extend(stbl_padding);
        bx(b"mdia", &payload)
    }

    /// v0 edit list: `(segment_duration, media_time)`, with the rate always 1.0.
    fn edts_v0(entries: &[(u32, i32)]) -> Vec<u8> {
        let mut rest = (entries.len() as u32).to_be_bytes().to_vec();
        for (duration, media_time) in entries {
            rest.extend_from_slice(&duration.to_be_bytes());
            rest.extend_from_slice(&media_time.to_be_bytes());
            rest.extend_from_slice(&[0, 1, 0, 0]);
        }
        bx(b"edts", &bx(b"elst", &full(0, &rest)))
    }

    fn trak(track_id: u32, timescale: u32, edts: Option<Vec<u8>>) -> Vec<u8> {
        let mut payload = tkhd(track_id);
        payload.extend(edts.unwrap_or_default());
        payload.extend(mdia(timescale));
        bx(b"trak", &payload)
    }

    fn file(traks: &[Vec<u8>]) -> Vec<u8> {
        let mut out = bx(b"ftyp", b"M4A \0\0\0\0M4A isom");
        out.extend(bx(b"mdat", &[0xAB; 32]));
        let mut moov = bx(b"mvhd", &full(0, &[0u8; 96]));
        for trak in traks {
            moov.extend_from_slice(trak);
        }
        out.extend(bx(b"moov", &moov));
        out
    }

    fn lookup(bytes: &[u8], track_id: u32) -> Option<EditStart> {
        edit_start_in(&mut Cursor::new(bytes), bytes.len() as u64, track_id).unwrap()
    }

    #[test]
    fn the_first_edit_gives_the_priming_to_drop() {
        // ffmpeg's aac encoder: 44.1 kHz, 1024 frames of priming.
        let bytes = file(&[trak(1, 44_100, Some(edts_v0(&[(264_600, 1024)])))]);
        let start = lookup(&bytes, 1).unwrap();
        assert_eq!(
            start,
            EditStart {
                media_time: 1024,
                timescale: 44_100
            }
        );
        assert_eq!(start.frames(44_100), 1024);
        // When the decoder reports frames at a different sample rate, scale proportionally: 1024 × 48000 / 44100 = 1114.6.
        assert_eq!(start.frames(48_000), 1115);
    }

    #[test]
    fn the_track_is_picked_by_tkhd_id() {
        let bytes = file(&[
            trak(1, 15_360, Some(edts_v0(&[(15_360, 40)]))),
            trak(2, 48_000, Some(edts_v0(&[(48_000, 2112)]))),
        ]);
        assert_eq!(lookup(&bytes, 2).unwrap().media_time, 2112);
        assert_eq!(lookup(&bytes, 1).unwrap().media_time, 40);
        assert_eq!(lookup(&bytes, 3), None);
    }

    #[test]
    fn empty_edits_are_skipped_and_a_zero_start_means_nothing_to_drop() {
        let delayed = file(&[trak(1, 48_000, Some(edts_v0(&[(500, -1), (48_000, 1024)])))]);
        assert_eq!(lookup(&delayed, 1).unwrap().media_time, 1024);
        let zero = file(&[trak(1, 48_000, Some(edts_v0(&[(48_000, 0)])))]);
        assert_eq!(lookup(&zero, 1), None);
        let only_empty = file(&[trak(1, 48_000, Some(edts_v0(&[(500, -1)])))]);
        assert_eq!(lookup(&only_empty, 1), None);
        let none = file(&[trak(1, 48_000, None)]);
        assert_eq!(lookup(&none, 1), None);
    }

    #[test]
    fn version_one_edit_lists_and_large_boxes_are_read() {
        let mut rest = 1u32.to_be_bytes().to_vec();
        rest.extend_from_slice(&48_000u64.to_be_bytes());
        rest.extend_from_slice(&2112i64.to_be_bytes());
        rest.extend_from_slice(&[0, 1, 0, 0]);
        let edts = bx(b"edts", &bx(b"elst", &full(1, &rest)));
        let mut bytes = bx(b"ftyp", b"qt  \0\0\0\0qt  ");
        // A 64-bit largesize mdat placed before moov.
        bytes.extend_from_slice(&1u32.to_be_bytes());
        bytes.extend_from_slice(b"mdat");
        bytes.extend_from_slice(&(16u64 + 8).to_be_bytes());
        bytes.extend_from_slice(&[0u8; 8]);
        bytes.extend(bx(b"moov", &trak(7, 48_000, Some(edts))));
        assert_eq!(lookup(&bytes, 7).unwrap().media_time, 2112);
    }

    #[test]
    fn non_iso_files_and_broken_boxes_are_ignored() {
        let mut wav = b"RIFF\x24\0\0\0WAVEfmt ".to_vec();
        wav.extend_from_slice(&[0u8; 64]);
        assert_eq!(lookup(&wav, 1), None);
        let mut broken = bx(b"ftyp", b"isom");
        broken.extend_from_slice(&0xFFFF_FFF0u32.to_be_bytes());
        broken.extend_from_slice(b"moov");
        assert!(edit_start_in(&mut Cursor::new(&broken), broken.len() as u64, 1).is_err());
        assert_eq!(
            audio_edit_start(Path::new("/definitely/not/here.m4a"), 1),
            None
        );
    }

    /// Checked-in fixture: a 48 kHz mono AAC encoded by ffmpeg, with the audio track (id 2) at `elst media_time 1024`.
    #[test]
    fn the_native_export_fixture_reports_ffmpeg_priming() {
        let fixture =
            Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/native-export/source.mp4");
        assert_eq!(
            audio_edit_start(&fixture, 2),
            Some(EditStart {
                media_time: 1024,
                timescale: 48_000
            })
        );
    }
}
