//! Media reading and writing (architecture design §9.13, §13.1): the final export decodes and encodes through ffmpeg / ffprobe child processes, without linking libav.
//!
//! - Decoding: one sequential decode stream per video instance ([`decode::VideoDecoder`]), with raw RGBA frames read out through a pipe. It moves forward by source time,
//!   without repositioning frame by frame, and reopens only on a rewind or a large jump. A still image decodes one frame ([`decode::decode_still`]); GIFs take the first frame.
//! - Encoding: raw RGBA frames are written to the encoder's stdin ([`encode::Encoder`]); the audio is an already mixed audio file, muxed in alongside.
//!
//! The caller supplies the tool locations (the Runtime resolves them from `CUCCUT_FFMPEG` / `CUCCUT_FFPROBE` and the PATH of the login shell).

pub mod decode;
pub mod encode;
pub mod probe;

use std::fmt;
use std::path::PathBuf;

/// The ffmpeg and ffprobe executables.
#[derive(Clone, Debug)]
pub struct Tools {
    pub ffmpeg: PathBuf,
    pub ffprobe: PathBuf,
}

/// One frame of picture: non-premultiplied RGBA, rows packed tightly.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Picture {
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>,
}

impl Picture {
    pub fn byte_len(width: u32, height: u32) -> usize {
        width as usize * height as usize * 4
    }
}

/// A media read/write failure. `code` is the error code from the protocol (`EXPORT_TOOL_MISSING`, `EXPORT_DECODE_FAILED`, `EXPORT_ENCODE_FAILED`, ...).
#[derive(Clone, Debug, PartialEq)]
pub struct MediaError {
    pub code: &'static str,
    pub message: String,
}

impl MediaError {
    pub fn new(code: &'static str, message: impl Into<String>) -> MediaError {
        MediaError {
            code,
            message: message.into(),
        }
    }

    pub(crate) fn spawn(tool: &std::path::Path, error: std::io::Error) -> MediaError {
        if error.kind() == std::io::ErrorKind::NotFound {
            MediaError::new("EXPORT_TOOL_MISSING", format!("cannot find {}", tool.display()))
        } else {
            MediaError::new("EXPORT_TOOL_MISSING", format!("failed to start {}: {error}", tool.display()))
        }
    }
}

impl fmt::Display for MediaError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}：{}", self.code, self.message)
    }
}

impl std::error::Error for MediaError {}

/// The last few lines of the child process's stderr: included in the message on error.
pub(crate) fn tail(text: &str, lines: usize) -> String {
    let all: Vec<&str> = text.lines().filter(|l| !l.trim().is_empty()).collect();
    all[all.len().saturating_sub(lines)..].join("\n")
}
