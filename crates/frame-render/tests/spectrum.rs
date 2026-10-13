//! The waveform listens to the asset's sound (format spec §3.7). Asset spectra are mapped onto sequence time by the sound plan, `project` mixes by gain, a missing asset spectrum is reported, and asset spectra are computed from sound files. The asset spectra here are all synthetic and do not read real media.

mod common;

use common::*;
use std::sync::Arc;

use frame_render::SpeakerActivity;
use frame_render::renderer::RENDER_NOTE;
use frame_render::spectrum::analyze_file;
use serde_json::{Value, json};
use video_model::{VersionRef, VideoSnapshot};

/// Asset `a_tone`'s spectrum: silent before source second 1, then low frequencies loud and high frequencies quiet (60 frames per second, 5 seconds total).
fn tone() -> Vec<u8> {
    spectrum_by_frame(300, |frame, bin| match (frame >= 60, bin < 128) {
        (false, _) => 0,
        (true, true) => 220,
        (true, false) => 40,
    })
}

/// A sound instance plays `a_tone`'s source [0, 3) seconds from sequence second 3, at volume `volume`. The waveform instance fills [0, 6) seconds and listens to `audio`.
fn scene(audio: &str, volume: f64) -> VideoSnapshot {
    let music = json!({
        "id": "music", "trackId": "trk_a1", "enabled": true, "locked": false, "paintOrder": 0,
        "followPolicy": { "kind": "sequence-fixed" },
        "type": "audio", "assetRef": { "id": "a_tone", "revision": "rev_1" }, "fromFrame": 90, "subframeOffset": { "ticks": "0", "timescale": 1 },
        "playDuration": { "ticks": "3", "timescale": 1 },
        "timeMap": { "kind": "linear", "sourceIn": { "ticks": "0", "timescale": 1 }, "rate": { "num": 1, "den": 1 } },
        "mix": { "volume": volume }
    });
    let viz = item(
        "g",
        0,
        180,
        json!({ "type": "visualizer", "place": { "w": 60 },
                "visualizer": { "style": "bars", "mainColor": "#FFFFFF", "audio": audio, "smoothing": 0 } }),
    );
    video(vec![viz, music], vec![audio_asset("a_tone")], json!({ "tracks": tracks() }))
}

fn tracks() -> Value {
    json!([
        { "id": "trk_v1", "order": 0, "kind": "visual", "locked": false, "visible": true, "muted": false,
          "solo": { "enabled": false, "group": "visual" } },
        { "id": "trk_a1", "order": 0, "kind": "audio", "locked": false, "visible": true, "muted": false,
          "solo": { "enabled": false, "group": "audio" } }
    ])
}

fn media() -> Media {
    let mut media = Media::default();
    media.audio_spectra.insert("a_tone@rev_1".into(), tone());
    media
}

/// Draws frame `seconds` with a new renderer, and confirms there is no hint and no missing asset spectrum.
fn shot(video: &VideoSnapshot, seconds: f64, media: &mut Media) -> Vec<u8> {
    let mut renderer = renderer(false, frame_render::Documents::default());
    let frame = render_with(&mut renderer, video, seconds, media);
    assert!(renderer.warnings().is_empty(), "{:?}", renderer.warnings());
    assert!(renderer.missing_spectra().is_empty());
    frame
}

#[test]
fn the_asset_is_heard_at_its_source_time() {
    for audio in ["a_tone", "project"] {
        let video = scene(audio, 1.0);
        // The asset is loud only from its second 1, and the instance starts at sequence second 3, so it is loud from sequence second 4.
        let before = shot(&video, 2.0, &mut media());
        let quiet = shot(&video, 3.5, &mut media());
        let loud = shot(&video, 4.5, &mut media());
        assert_eq!(painted(&before), painted(&quiet), "{audio}");
        assert!(
            painted(&loud) > painted(&quiet) + 50,
            "{audio}：{} {}",
            painted(&quiet),
            painted(&loud)
        );
    }
}

#[test]
fn the_project_mix_follows_volume_but_a_single_asset_does_not() {
    let loud = shot(&scene("project", 1.0), 4.5, &mut media());
    let soft = shot(&scene("project", 0.1), 4.5, &mut media());
    assert!(painted(&soft) < painted(&loud), "{} {}", painted(&soft), painted(&loud));
    assert_eq!(
        shot(&scene("a_tone", 1.0), 4.5, &mut media()),
        shot(&scene("a_tone", 0.1), 4.5, &mut media()),
        "只听一个素材时不乘增益"
    );
}

#[test]
fn a_missing_asset_spectrum_is_reported_until_it_arrives() {
    let video = scene("project", 1.0);
    let mut media = Media::default();
    let mut renderer = renderer(false, frame_render::Documents::default());
    let placeholder = render_with(&mut renderer, &video, 4.5, &mut media);
    let asset = VersionRef {
        id: "a_tone".into(),
        revision: "rev_1".into(),
    };
    assert_eq!(renderer.missing_spectra(), [("g".to_string(), asset.clone())]);
    assert!(
        renderer
            .warnings()
            .iter()
            .any(|w| w.code == RENDER_NOTE && w.detail.starts_with("g："))
    );
    // The missing-spectrum report still appears on a cache hit.
    renderer.clear_reports();
    render_with(&mut renderer, &video, 4.6, &mut media);
    assert_eq!(renderer.missing_spectra(), [("g".to_string(), asset)]);
    // The asset spectrum has arrived: the host clears the spectrum-track cache before drawing. It no longer reports missing, and it no longer shows the placeholder look.
    media.audio_spectra.insert("a_tone@rev_1".into(), tone());
    renderer.clear_spectra();
    renderer.clear_reports();
    let heard = render_with(&mut renderer, &video, 4.5, &mut media);
    assert!(renderer.missing_spectra().is_empty());
    assert!(renderer.warnings().is_empty(), "{:?}", renderer.warnings());
    assert_ne!(heard, placeholder);
}

#[test]
fn an_item_spectrum_overrides_the_asset() {
    let video = scene("project", 1.0);
    let mut silent = media();
    silent.spectra.insert("g".into(), spectrum(400, |_| 0));
    let overridden = shot(&video, 4.5, &mut silent);
    let heard = shot(&video, 4.5, &mut media());
    assert!(painted(&overridden) < painted(&heard));
}

/// The waveform instance is swapped for one with `speaker` and `alwaysShow` set (it listens to the whole sequence's sound).
fn speaker_scene(speaker: Option<&str>, always_show: bool) -> VideoSnapshot {
    let mut video = scene("project", 1.0);
    let sequence = video.sequences.values_mut().next().unwrap();
    for item in &mut sequence.items {
        if let video_model::TimelineItem::Visualizer(viz) = item {
            viz.visualizer.speaker = speaker.map(str::to_owned);
            viz.visualizer.always_show = Some(always_show);
        }
    }
    video
}

/// spk_a speaks at [4.0, 4.2) and [4.6, 4.8) (0.4 seconds apart, so merged into one segment), and spk_b at [5.0, 6.0).
fn speakers() -> Arc<SpeakerActivity> {
    let mut map = SpeakerActivity::new();
    map.insert("spk_a".into(), vec![(4.0, 4.2), (4.6, 4.8)]);
    map.insert("spk_b".into(), vec![(5.0, 6.0)]);
    Arc::new(map)
}

fn speaker_shot(video: &VideoSnapshot, seconds: f64, speakers: Option<Arc<SpeakerActivity>>) -> (Vec<u8>, Vec<String>) {
    let mut renderer = renderer(false, frame_render::Documents::default());
    renderer.set_speakers(speakers);
    let frame = render_with(&mut renderer, video, seconds, &mut media());
    let notes = renderer.warnings().iter().map(|w| w.detail.clone()).collect();
    (frame, notes)
}

#[test]
fn a_speaker_visualizer_only_moves_while_that_speaker_talks() {
    let all = speaker_scene(None, true);
    let quiet = shot(&all, 2.0, &mut media());
    let spk_a = speaker_scene(Some("spk_a"), true);
    // Within the speaking segment, it is the same as unfiltered. A pause shorter than 0.5 seconds between two words still counts as speaking.
    for t in [4.1, 4.4, 4.7] {
        let (frame, notes) = speaker_shot(&spk_a, t, Some(speakers()));
        assert_eq!(frame, shot(&all, t, &mut media()), "{t}");
        assert!(notes.is_empty(), "{notes:?}");
    }
    // Sound is still playing, but the speaker is spk_b, so it draws the still look.
    let (frame, _) = speaker_shot(&spk_a, 5.5, Some(speakers()));
    assert_eq!(frame, quiet);
    assert!(painted(&shot(&all, 5.5, &mut media())) > painted(&quiet) + 50);
    // No transcript, or the transcript has no such speaker: the whole track is silent, and a hint is reported.
    let (frame, notes) = speaker_shot(&spk_a, 4.1, None);
    assert_eq!(frame, quiet);
    assert!(notes.iter().any(|n| n.starts_with("g: ") && n.contains("has no transcript")), "{notes:?}");
    let (frame, notes) = speaker_shot(&speaker_scene(Some("spk_x"), true), 4.1, Some(speakers()));
    assert_eq!(frame, quiet);
    assert!(notes.iter().any(|n| n.contains("no speech by speaker spk_x")), "{notes:?}");
}

#[test]
fn always_show_false_hides_the_visualizer_after_half_a_second_of_silence() {
    let hidden = speaker_scene(None, false);
    // Sound starts only at sequence second 4: nothing is drawn before that, and it is drawn as soon as sound starts.
    assert_eq!(painted(&shot(&hidden, 2.0, &mut media())), 0);
    assert_eq!(
        shot(&hidden, 4.5, &mut media()),
        shot(&speaker_scene(None, true), 4.5, &mut media())
    );
    // Together with speaker: spk_a stops at 4.8 seconds, the silent look remains for another 0.5 seconds, and then nothing is drawn.
    let spk_a = speaker_scene(Some("spk_a"), false);
    let quiet = shot(&speaker_scene(None, true), 2.0, &mut media());
    assert!(painted(&speaker_shot(&spk_a, 4.5, Some(speakers())).0) > painted(&quiet));
    assert_eq!(speaker_shot(&spk_a, 5.2, Some(speakers())).0, quiet);
    assert_eq!(painted(&speaker_shot(&spk_a, 5.5, Some(speakers())).0), 0);
    // No transcript: no sound, so nothing is drawn (the hint is still reported).
    let (frame, notes) = speaker_shot(&spk_a, 4.5, None);
    assert_eq!(painted(&frame), 0);
    assert!(!notes.is_empty());
    // A different set of speaker intervals: the track is discarded and reassembled.
    let mut renderer = renderer(false, frame_render::Documents::default());
    renderer.set_speakers(None);
    assert_eq!(painted(&render_with(&mut renderer, &spk_a, 4.5, &mut media())), 0);
    renderer.set_speakers(Some(speakers()));
    assert!(painted(&render_with(&mut renderer, &spk_a, 4.5, &mut media())) > 0);
}

/// A 16-bit mono 48 kHz WAV: the first second is 440 Hz, the last second is 3000 Hz.
fn tone_wav() -> Vec<u8> {
    let samples: Vec<i16> = (0..96_000)
        .map(|i| {
            let hz = if i < 48_000 { 440.0 } else { 3000.0 };
            (0.5 * (std::f64::consts::TAU * hz * f64::from(i) / 48_000.0).sin() * f64::from(i16::MAX)) as i16
        })
        .collect();
    let data = (samples.len() * 2) as u32;
    let mut out = Vec::new();
    out.extend(b"RIFF");
    out.extend((36 + data).to_le_bytes());
    out.extend(b"WAVEfmt ");
    out.extend(16u32.to_le_bytes());
    out.extend(1u16.to_le_bytes());
    out.extend(1u16.to_le_bytes());
    out.extend(48_000u32.to_le_bytes());
    out.extend((48_000u32 * 2).to_le_bytes());
    out.extend(2u16.to_le_bytes());
    out.extend(16u16.to_le_bytes());
    out.extend(b"data");
    out.extend(data.to_le_bytes());
    for sample in samples {
        out.extend(sample.to_le_bytes());
    }
    out
}

#[test]
fn asset_files_are_analysed_deterministically() {
    let dir = std::env::temp_dir().join(format!("frame-render-spectrum-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("tone.wav");
    std::fs::write(&path, tone_wav()).unwrap();
    // Pure Rust can decode the WAV, so ffmpeg is not needed.
    let ffmpeg = dir.join("no-ffmpeg");
    let first = analyze_file(&path, &ffmpeg).unwrap();
    let second = analyze_file(&path, &ffmpeg).unwrap();
    std::fs::remove_dir_all(&dir).ok();
    assert_eq!(first, second);
    let view = waveform::bcs1::parse(&first).unwrap();
    assert_eq!(view.header().frame_count, 120);
    // Each bin is 46.875 Hz: 440 Hz falls in bin 9, and 3000 Hz falls in bin 64.
    let peak = |frame: usize| {
        let row = &view.frame(frame).unwrap()[128..];
        (0..row.len()).max_by_key(|&bin| row[bin]).unwrap()
    };
    assert!((8..=10).contains(&peak(30)), "{}", peak(30));
    assert!((63..=65).contains(&peak(90)), "{}", peak(90));
}

/// Preview keeps several renderers according to size. The new one takes the spectrum track that the previous one assembled, and no longer asks the host for asset spectra; it draws the same as one that assembled its own. When the speaker intervals differ, it does not take the track (the track was filtered by speaker).
#[test]
fn a_renderer_takes_the_spectrum_tracks_another_one_composed() {
    let video = scene("project", 1.0);
    let mut first = renderer(false, frame_render::Documents::default());
    render_with(&mut first, &video, 4.5, &mut media());
    let own = shot(&video, 4.5, &mut media());

    // The asset spectrum is not at hand: the track taken over still draws, with no missing report.
    let mut second = renderer(false, frame_render::Documents::default());
    second.share_spectra_from(&first);
    let shared = render_with(&mut second, &video, 4.5, &mut Media::default());
    assert!(second.missing_spectra().is_empty());
    assert!(second.warnings().is_empty(), "{:?}", second.warnings());
    assert_eq!(shared, own);

    // The speaker intervals don't match: don't take the track, and fetch the asset spectrum itself.
    let mut third = renderer(false, frame_render::Documents::default());
    third.set_speakers(Some(speakers()));
    third.share_spectra_from(&first);
    render_with(&mut third, &video, 4.5, &mut Media::default());
    assert_eq!(third.missing_spectra().len(), 1);
}
