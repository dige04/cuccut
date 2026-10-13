//! Decoding and encoding through the local ffmpeg. Skipped when there is no ffmpeg (CI, and machines without ffmpeg installed).

use std::path::{Path, PathBuf};
use std::process::Command;

use media_core::decode::{VideoDecoder, decode_still};
use media_core::encode::{AudioTrack, Container, EncodeSettings, Encoder, Quality, QueuedEncoder, VideoCodec};
use media_core::probe::{encoders, probe_picture};
use media_core::{Picture, Tools};
use serde_json::Value;

fn tools() -> Option<Tools> {
    let ffmpeg = std::env::var_os("CUCCUT_FFMPEG").map_or_else(|| PathBuf::from("ffmpeg"), PathBuf::from);
    let ffprobe = std::env::var_os("CUCCUT_FFPROBE").map_or_else(|| PathBuf::from("ffprobe"), PathBuf::from);
    let ok = |tool: &Path| Command::new(tool).arg("-version").output().is_ok_and(|o| o.status.success());
    if ok(&ffmpeg) && ok(&ffprobe) {
        Some(Tools { ffmpeg, ffprobe })
    } else {
        eprintln!("没有 ffmpeg / ffprobe，跳过");
        None
    }
}

fn ffmpeg(tools: &Tools, args: &[&str]) {
    let status = Command::new(&tools.ffmpeg)
        .args(["-hide_banner", "-loglevel", "error", "-y"])
        .args(args)
        .status()
        .expect("ffmpeg");
    assert!(status.success(), "ffmpeg {args:?}");
}

/// 2 s, 10 fps: red for the first second, then blue; a keyframe every 5 frames.
fn red_then_blue(tools: &Tools, dir: &Path) -> PathBuf {
    let path = dir.join("rb.mp4");
    ffmpeg(
        tools,
        &[
            "-f",
            "lavfi",
            "-i",
            "color=c=black:s=64x36:r=10:d=2",
            "-vf",
            "geq=r='if(lt(T,1),255,0)':g=0:b='if(lt(T,1),0,255)',format=yuv420p",
            "-c:v",
            "libx264",
            "-g",
            "5",
            path.to_str().unwrap(),
        ],
    );
    path
}

fn center(picture: &Picture) -> [u8; 4] {
    let i = ((picture.height / 2 * picture.width + picture.width / 2) * 4) as usize;
    picture.data[i..i + 4].try_into().unwrap()
}

fn is_red(px: [u8; 4]) -> bool {
    px[0] > 200 && px[2] < 60
}

fn is_blue(px: [u8; 4]) -> bool {
    px[2] > 200 && px[0] < 60
}

#[test]
fn decoder_walks_forward_and_restarts_on_backward_jumps() {
    let Some(tools) = tools() else { return };
    let dir = tempfile::tempdir().unwrap();
    let path = red_then_blue(&tools, dir.path());
    let info = probe_picture(&tools, &path).unwrap().expect("有画面");
    assert_eq!((info.width, info.height, info.alpha), (64, 36, false));
    let mut decoder = VideoDecoder::new(&tools, &path, 0.0, 32, 18);
    assert!(is_red(center(decoder.frame_at(0.0).unwrap())));
    assert!(is_red(center(decoder.frame_at(0.95).unwrap())));
    // The timestamp of frame 10 is exactly 1 second, so an exact time picks it up.
    assert!(is_blue(center(decoder.frame_at(1.0).unwrap())));
    assert!(is_blue(center(decoder.frame_at(1.55).unwrap())));
    assert_eq!(decoder.restarts(), 0);
    assert_eq!(decoder.frame_at(1.55).unwrap().width, 32);
    // After reading to the end, stay on the last frame.
    assert!(is_blue(center(decoder.frame_at(3.0).unwrap())));
    // Reopen on rewind.
    assert!(is_red(center(decoder.frame_at(0.3).unwrap())));
    assert_eq!(decoder.restarts(), 1);
    // A long forward jump also reopens (starting from the keyframe before the target) rather than decoding all the way through.
    assert!(is_blue(center(decoder.frame_at(9.0).unwrap())));
    assert_eq!(decoder.restarts(), 2);
    // Used again after being idle and shut down: reopening the decode stream also counts as one.
    decoder.close();
    assert!(is_blue(center(decoder.frame_at(1.2).unwrap())));
    assert_eq!(decoder.restarts(), 3);
    assert!(is_blue(center(decoder.frame_at(1.3).unwrap())));
    assert_eq!(decoder.restarts(), 3);
}

#[test]
fn decoder_hands_over_frames_and_tells_when_the_frame_changes() {
    let Some(tools) = tools() else { return };
    let dir = tempfile::tempdir().unwrap();
    let path = red_then_blue(&tools, dir.path());
    let mut decoder = VideoDecoder::new(&tools, &path, 0.0, 32, 18);
    let first = decoder.advance(0.0).unwrap();
    let picture = decoder.swap_current(Vec::new()).unwrap();
    assert_eq!((picture.width, picture.height, picture.data.len()), (32, 18, 32 * 18 * 4));
    assert!(is_red(center(&picture)));
    // Not yet at the next frame (10 fps): the generation is unchanged, and the caller keeps using the pixels it swapped out.
    assert_eq!(decoder.advance(0.05).unwrap(), first);
    // A new frame is swapped in: the generation changes, and the swapped-out pixels are the new ones; the buffers returned are recycled later.
    let second = decoder.advance(1.0).unwrap();
    assert_ne!(second, first);
    let picture = decoder.swap_current(picture.data).unwrap();
    assert!(is_blue(center(&picture)));
    assert_eq!(picture.data.len(), 32 * 18 * 4);
    // After reopening, the generation keeps counting and does not return to a value already used.
    assert!(decoder.advance(0.2).unwrap() > second);
    assert!(is_red(center(&decoder.swap_current(Vec::new()).unwrap())));
}

#[test]
fn still_decodes_first_frame_and_probe_reports_missing_video() {
    let Some(tools) = tools() else { return };
    let dir = tempfile::tempdir().unwrap();
    let png = dir.path().join("still.png");
    ffmpeg(
        &tools,
        &[
            "-f",
            "lavfi",
            "-i",
            "color=c=0x00ff00:s=8x4",
            "-frames:v",
            "1",
            png.to_str().unwrap(),
        ],
    );
    assert!(!probe_picture(&tools, &png).unwrap().unwrap().alpha);
    let picture = decode_still(&tools, &png, 8, 4).unwrap();
    assert_eq!(picture.data.len(), 8 * 4 * 4);
    let px = &picture.data[0..4];
    assert!(px[0] < 3 && px[1] > 250 && px[2] < 3 && px[3] == 255, "{px:?}");
    let wav = dir.path().join("tone.wav");
    ffmpeg(
        &tools,
        &["-f", "lavfi", "-i", "sine=frequency=440:duration=0.2", wav.to_str().unwrap()],
    );
    assert_eq!(probe_picture(&tools, &wav).unwrap(), None);
    // A pixel format with alpha, and a VP9 WebM whose pixel format says no alpha but whose container flags alpha_mode, both count as possibly transparent.
    let rgba = dir.path().join("rgba.png");
    ffmpeg(
        &tools,
        &[
            "-f",
            "lavfi",
            "-i",
            "color=c=red@0.5:s=8x4,format=rgba",
            "-frames:v",
            "1",
            rgba.to_str().unwrap(),
        ],
    );
    assert!(probe_picture(&tools, &rgba).unwrap().unwrap().alpha);
    if encoders(&tools).unwrap().contains("libvpx-vp9") {
        let webm = dir.path().join("alpha.webm");
        ffmpeg(
            &tools,
            &[
                "-f",
                "lavfi",
                "-i",
                "color=c=red@0.5:s=16x16:d=0.2,format=yuva420p",
                "-c:v",
                "libvpx-vp9",
                webm.to_str().unwrap(),
            ],
        );
        assert!(probe_picture(&tools, &webm).unwrap().unwrap().alpha);
    }
    assert!(probe_picture(&tools, &dir.path().join("missing.png")).is_err());
}

#[test]
fn encoder_muxes_frames_and_padded_audio_to_equal_length() {
    let Some(tools) = tools() else { return };
    if !encoders(&tools).unwrap().contains("libx264") {
        return;
    }
    let dir = tempfile::tempdir().unwrap();
    let wav = dir.path().join("tone.wav");
    ffmpeg(
        &tools,
        &[
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:duration=0.5",
            "-ar",
            "48000",
            wav.to_str().unwrap(),
        ],
    );
    let out = dir.path().join("out.mp4");
    let settings = EncodeSettings {
        width: 64,
        height: 36,
        fps_num: 10,
        fps_den: 1,
        codec: VideoCodec::H264,
        container: Container::Mp4,
        quality: Quality::Crf(20),
        audio: Some(AudioTrack {
            path: wav,
            bitrate_kbps: 128,
        }),
        duration_seconds: 1.0,
    };
    let mut encoder = Encoder::start(&tools, &settings, &out).unwrap();
    let frame: Vec<u8> = [0u8, 200, 0, 255].repeat(64 * 36);
    for _ in 0..10 {
        encoder.write(&frame).unwrap();
    }
    encoder.finish().unwrap();
    let probe = Command::new(&tools.ffprobe)
        .args(["-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json"])
        .arg(&out)
        .output()
        .unwrap();
    let value: Value = serde_json::from_slice(&probe.stdout).unwrap();
    let streams = value["streams"].as_array().unwrap();
    let video = streams.iter().find(|s| s["codec_type"] == "video").unwrap();
    let audio = streams.iter().find(|s| s["codec_type"] == "audio").unwrap();
    assert_eq!(video["nb_read_frames"], "10");
    assert_eq!(video["pix_fmt"], "yuv420p");
    assert_eq!(video["color_space"], "bt709");
    let audio_duration: f64 = audio["duration"].as_str().unwrap().parse().unwrap();
    assert!((audio_duration - 1.0).abs() < 0.05, "声音补到画面的长度：{audio_duration}");

    // Delete the output when abandoning.
    let aborted = dir.path().join("aborted.mp4");
    let mut encoder = Encoder::start(&tools, &EncodeSettings { audio: None, ..settings }, &aborted).unwrap();
    encoder.write(&frame).unwrap();
    encoder.abort();
    assert!(!aborted.exists());
}

#[test]
fn queued_encoder_writes_every_frame_and_reports_a_dead_encoder() {
    let Some(tools) = tools() else { return };
    if !encoders(&tools).unwrap().contains("libx264") {
        return;
    }
    let dir = tempfile::tempdir().unwrap();
    let settings = EncodeSettings {
        width: 64,
        height: 36,
        fps_num: 10,
        fps_den: 1,
        codec: VideoCodec::H264,
        container: Container::Mp4,
        quality: Quality::Crf(20),
        audio: None,
        duration_seconds: 1.2,
    };
    let count_frames = |path: &Path| {
        let probe = Command::new(&tools.ffprobe)
            .args(["-v", "error", "-count_frames", "-show_streams", "-of", "json"])
            .arg(path)
            .output()
            .unwrap();
        let value: Value = serde_json::from_slice(&probe.stdout).unwrap();
        value["streams"][0]["nb_read_frames"].as_str().unwrap().to_string()
    };

    // The buffers in the pool are filled with the colour and are one frame long; every frame handed in is written, and after wrapping up the file is complete.
    let out = dir.path().join("queued.mp4");
    let mut queued = QueuedEncoder::new(Encoder::start(&tools, &settings, &out).unwrap(), 2, [0, 0, 0, 255]);
    for i in 0..12u8 {
        let mut frame = queued.buffer().unwrap();
        assert_eq!(frame.len(), 64 * 36 * 4);
        if i == 0 {
            assert_eq!(&frame[..8], [0, 0, 0, 255, 0, 0, 0, 255]);
        }
        frame[..4].copy_from_slice(&[i * 20, 0, 0, 255]);
        queued.submit(frame).unwrap();
    }
    assert!(queued.submit(vec![0; 4]).is_err(), "尺寸不对的帧不收");
    queued.finish().unwrap();
    assert_eq!(count_frames(&out), "12");

    // Abandon: the queued frames are not written, and the output is deleted.
    let aborted = dir.path().join("queued-aborted.mp4");
    let mut queued = QueuedEncoder::new(Encoder::start(&tools, &settings, &aborted).unwrap(), 2, [0; 4]);
    let frame = queued.buffer().unwrap();
    queued.submit(frame).unwrap();
    queued.abort();
    assert!(!aborted.exists());

    // The encoder has died (the output cannot be written): the compositing thread soon gets the write thread's error when it takes a buffer or hands in a frame.
    let broken = dir.path().join("missing-dir").join("out.mp4");
    let mut queued = QueuedEncoder::new(Encoder::start(&tools, &settings, &broken).unwrap(), 2, [0; 4]);
    let error = (0..1000)
        .find_map(|_| queued.buffer().and_then(|frame| queued.submit(frame)).err())
        .expect("编码器失败要报出来");
    assert_eq!(error.code, "EXPORT_ENCODE_FAILED");
    queued.abort();
}

#[test]
fn a_failing_native_source_falls_back_to_ffmpeg_from_the_same_time() {
    use media_core::decode::{FeedOpener, FrameFeed, NativeDecode};
    use std::sync::Arc;

    let Some(tools) = tools() else { return };
    let dir = tempfile::tempdir().unwrap();
    let path = red_then_blue(&tools, dir.path());
    let open: FeedOpener = Arc::new(|_: &Path, _: f64, _: u32, _: u32| -> Result<Box<dyn FrameFeed>, String> {
        Err("unsupported: 测试里的原生解码".into())
    });
    let native = NativeDecode {
        backend: "test-native",
        open,
    };
    let mut decoder = VideoDecoder::new(&tools, &path, 0.0, 32, 18).with_native(native);
    assert_eq!(decoder.backend(), "test-native");
    // From 1.2 s: native cannot open, so ffmpeg continues decoding from 1.2 s, and the picture is blue.
    assert!(is_blue(center(decoder.frame_at(1.2).unwrap())));
    assert_eq!(decoder.backend(), "ffmpeg");
    assert_eq!(decoder.fallback().map(|f| f.reason), Some("open-failed"));
    // The fallback does not count as a reopen; later rewinds reopen as usual (ffmpeg only).
    assert_eq!(decoder.restarts(), 0);
    assert!(is_red(center(decoder.frame_at(0.3).unwrap())));
    assert_eq!(decoder.restarts(), 1);
}

#[test]
fn queued_encoder_opens_its_sink_on_the_writer_thread_and_reports_open_failures() {
    use media_core::MediaError;
    use media_core::encode::FrameSink;
    use std::sync::{Arc, Mutex};

    #[derive(Default)]
    struct Log {
        frames: Vec<u8>,
        finished: bool,
        aborted: bool,
    }
    /// The accounting output: deliberately not `Send` (it holds an `Rc`), and constructed and used only on the write thread.
    struct Recording {
        log: Arc<Mutex<Log>>,
        _not_send: std::rc::Rc<()>,
    }
    impl FrameSink for Recording {
        fn write(&mut self, rgba: &[u8]) -> Result<(), MediaError> {
            self.log.lock().unwrap().frames.push(rgba[0]);
            Ok(())
        }
        fn finish(self: Box<Self>) -> Result<(), MediaError> {
            self.log.lock().unwrap().finished = true;
            Ok(())
        }
        fn abort(self: Box<Self>) {
            self.log.lock().unwrap().aborted = true;
        }
    }

    let opened = |log: &Arc<Mutex<Log>>| {
        let log = Arc::clone(log);
        QueuedEncoder::spawn(16, 2, [9, 9, 9, 255], move || {
            Ok(Box::new(Recording {
                log,
                _not_send: std::rc::Rc::new(()),
            }) as Box<dyn FrameSink>)
        })
        .unwrap()
    };

    let log = Arc::new(Mutex::new(Log::default()));
    let mut queued = opened(&log);
    for i in 0..5u8 {
        let mut frame = queued.buffer().unwrap();
        assert_eq!(frame.len(), 16);
        if i == 0 {
            assert_eq!(frame[..4], [9, 9, 9, 255], "缓冲铺好了底色");
        }
        frame[0] = i;
        queued.submit(frame).unwrap();
    }
    queued.finish().unwrap();
    {
        let done = log.lock().unwrap();
        assert_eq!(
            (done.frames.clone(), done.finished, done.aborted),
            (vec![0, 1, 2, 3, 4], true, false)
        );
    }

    let log = Arc::new(Mutex::new(Log::default()));
    opened(&log).abort();
    {
        let done = log.lock().unwrap();
        assert_eq!((done.finished, done.aborted), (false, true));
    }

    // Cannot open: the error is returned as is, and the caller may use a different output.
    let error = QueuedEncoder::spawn(16, 2, [0; 4], || Err(MediaError::new("EXPORT_ENCODE_FAILED", "原生写入器打不开")))
        .err()
        .expect("打开失败要报出来");
    assert!(error.message.contains("原生写入器打不开"));
}
