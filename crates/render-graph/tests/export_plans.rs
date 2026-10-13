//! Interval plans for export: the audio interval plan and the text timeline projection (cuts, speed changes, mute, range, repeated use, sentence level and word level).

use std::path::PathBuf;

use editor_semantics::Ratio;
use render_graph::audio_plan::{
    AudioFade, AudioPlan, CrossfadeRole, envelope_at, plan_audio, plan_audio_with_speech, speaker_activity, speech_activity,
};
use render_graph::text_plan::plan_text;
use render_graph::{VideoView, plan_frame_with_speech};
use serde_json::{Value, json};
use video_model::{DocumentRecord, VideoSnapshot};

/// The fixture video replaced by its own tracks and instances: 30 fps. `asset_a` and `asset_b` are assets with audio; `asset_mute` has no audio stream.
fn video(items: Value) -> VideoSnapshot {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/video.json");
    let mut value: Value = serde_json::from_str(&std::fs::read_to_string(path).expect("读夹具")).expect("JSON");
    let asset = |id: &str, audio: bool| {
        let mut revision = json!({
            "revision": "r1", "contentHash": format!("sha256:{id}"), "byteLength": 10, "mediaType": "video/mp4",
            "storage": { "mode": "managed" }, "provenance": { "origin": "import" },
        });
        if audio {
            revision["audio"] = json!({ "sampleRate": 48000, "channels": 2 });
        }
        json!({ "id": id, "kind": "video", "name": id, "currentRevision": "r1", "revisions": { "r1": revision } })
    };
    value["assets"] =
        json!({ "asset_a": asset("asset_a", true), "asset_b": asset("asset_b", true), "asset_mute": asset("asset_mute", false) });
    let track = |id: &str, order: i64, kind: &str, muted: bool| {
        json!({ "id": id, "order": order, "kind": kind, "locked": false, "visible": true, "muted": muted,
                "solo": { "enabled": false, "group": if kind == "audio" { "audio" } else { "visual" } } })
    };
    let sequence = &mut value["sequences"]["seq_main"];
    sequence["tracks"] = json!([
        track("v1", 0, "visual", false),
        track("v2", 1, "visual", false),
        track("a1", 0, "audio", false),
        track("a2", 1, "audio", true),
        track("s1", 0, "subtitle", false),
    ]);
    sequence["items"] = items;
    serde_json::from_value(value).expect("视频快照")
}

fn base(id: &str, track: &str) -> Value {
    json!({ "id": id, "trackId": track, "enabled": true, "locked": false, "paintOrder": 0, "followPolicy": { "kind": "sequence-fixed" } })
}

fn merge(mut a: Value, b: Value) -> Value {
    for (k, v) in b.as_object().expect("对象") {
        a[k] = v.clone();
    }
    a
}

/// Linear multiplier converted to dB, with the same formula as the planner.
fn db(volume: f64) -> f64 {
    20.0 * volume.log10()
}

/// Video instance: `[from, from + frames)`, fills the canvas, starts at `source_in` seconds in the source, speed `num/den`.
fn clip(id: &str, track: &str, asset: &str, from: i64, frames: i64, source_in: i64, rate: (i64, i64)) -> Value {
    merge(
        base(id, track),
        json!({
            "type": "video", "span": { "fromFrame": from, "durationFrames": frames },
            "place": {}, "mode": "fullscreen", "fit": "contain",
            "assetRef": { "id": asset, "revision": "r1" },
            "timeMap": { "kind": "linear", "sourceIn": { "ticks": source_in.to_string(), "timescale": 1 }, "rate": { "num": rate.0, "den": rate.1 } },
            "embeddedAudio": { "enabled": true, "volume": 1 },
        }),
    )
}

fn near(actual: f64, expected: f64) {
    assert!((actual - expected).abs() < 1e-9, "{actual} ≠ {expected}");
}

fn seconds(n: i128) -> Ratio {
    Ratio::from_int(n).expect("整数")
}

#[test]
fn audio_plan_follows_cuts_speed_mute_gain_and_fades() {
    let music = merge(
        base("music", "a1"),
        json!({
            "type": "audio", "assetRef": { "id": "asset_b", "revision": "r1" }, "fromFrame": 15,
            "subframeOffset": { "ticks": "1", "timescale": 48000 }, "playDuration": { "ticks": "3", "timescale": 1 },
            "timeMap": { "kind": "linear", "sourceIn": { "ticks": "0", "timescale": 1 }, "rate": { "num": 1, "den": 1 } },
            "mix": { "volume": 0.5, "fadeIn": { "ticks": "1", "timescale": 2 }, "fadeOut": { "ticks": "1", "timescale": 1 },
                     "envelope": [{ "at": { "ticks": "0", "timescale": 1 }, "volume": 0.7 }] },
        }),
    );
    let muted_track = merge(music.clone(), json!({ "id": "on_muted_track", "trackId": "a2" }));
    let mut muted_mix = merge(music.clone(), json!({ "id": "muted_mix" }));
    muted_mix["mix"]["muted"] = json!(true);
    let mut hold = clip("hold", "v2", "asset_a", 120, 30, 0, (1, 1));
    hold["timeMap"] = json!({ "kind": "hold", "sourceAt": { "ticks": "1", "timescale": 1 } });
    let video = video(json!([
        clip("first", "v1", "asset_a", 0, 60, 0, (1, 1)),
        // Cut source [2, 4) seconds and rejoin: the second segment starts at source 4 seconds, at 2× speed.
        clip("second", "v1", "asset_a", 60, 60, 4, (2, 1)),
        clip("silent", "v2", "asset_mute", 0, 30, 0, (1, 1)),
        hold,
        music,
        muted_track,
        muted_mix,
    ]));
    let plan = plan_audio(VideoView::from(&video), "seq_main", None).expect("计划");

    // Whole sequence: the visual tail is 150 frames = 5 seconds; the music sounds for 3 seconds starting at 0.5 s + 1/48000, which is shorter than that.
    assert_eq!(plan.range.start_seconds, 0.0);
    assert_eq!(plan.range.end_seconds, 5.0);
    // Same order as the voices of the per-frame plan: track order, then instance ID.
    let ids: Vec<&str> = plan.segments.iter().map(|s| s.item_id.as_str()).collect();
    assert_eq!(ids, ["first", "music", "second"]);
    let second = &plan.segments[2];
    assert_eq!(
        (second.start, second.end, second.source_start, second.source_rate),
        (2.0, 4.0, 4.0, 2.0)
    );
    let music = &plan.segments[1];
    let start = 24001.0 / 48000.0;
    near(music.start, start);
    near(music.end, start + 3.0);
    // The envelope replaces `volume`: the single point 0.7 applies to the whole span; the static gain is recorded as 0 dB.
    assert_eq!(music.gain_db, 0.0);
    assert!(!music.envelope.is_empty() && music.envelope.iter().all(|k| k.1 == 0.7));
    near(music.gain_db_at(music.start + 1.0), db(0.7));
    let (fade_in, fade_out) = (music.fade_in.expect("淡入"), music.fade_out.expect("淡出"));
    for (fade, expected) in [(fade_in, (start, start + 0.5)), (fade_out, (start + 2.0, start + 3.0))] {
        let AudioFade { start, end } = fade;
        near(start, expected.0);
        near(end, expected.1);
    }
    let notes: Vec<(&str, &str)> = plan.notes.iter().map(|n| (n.code.as_str(), n.item_id.as_str())).collect();
    assert_eq!(notes, [("ASSET_HAS_NO_AUDIO", "silent"), ("HOLD_IS_SILENT", "hold")]);
}

#[test]
fn audio_plan_clips_to_the_range_and_rejects_empty_ranges() {
    let video = video(json!([
        clip("first", "v1", "asset_a", 0, 60, 10, (1, 1)),
        clip("second", "v1", "asset_a", 60, 60, 4, (2, 1))
    ]));
    let range = Some((Ratio::new(3, 2).unwrap(), Ratio::new(5, 2).unwrap()));
    let plan = plan_audio(VideoView::from(&video), "seq_main", range).expect("计划");
    assert_eq!(plan.range.duration_seconds, 1.0);
    let pieces: Vec<(f64, f64, f64)> = plan.segments.iter().map(|s| (s.start, s.end, s.source_start)).collect();
    // The first segment takes half a second from source 11.5 s; the second segment takes half a second from its start (source 4 s), at 2× speed.
    assert_eq!(pieces, [(0.0, 0.5, 11.5), (0.5, 1.0, 4.0)]);

    for empty in [(seconds(2), seconds(2)), (seconds(9), seconds(10)), (seconds(3), seconds(1))] {
        let error = plan_audio(VideoView::from(&video), "seq_main", Some(empty)).expect_err("空范围");
        assert_eq!(error.code, "EXPORT_RANGE_EMPTY");
    }
}

/// Frame-plan fixture (the transition `tr_land` with an audio crossfade, the ducking rule that lowers `item_hidden`). Adds an audio stream to `asset_land`, then modifies it per `edit`.
fn frame_fixture(edit: impl FnOnce(&mut Value)) -> VideoSnapshot {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/video.json");
    let mut value: Value = serde_json::from_str(&std::fs::read_to_string(path).expect("读夹具")).expect("JSON");
    value["assets"]["asset_land"]["revisions"]["rev_1"]["audio"] = json!({ "sampleRate": 48000, "channels": 2 });
    edit(&mut value);
    serde_json::from_value(value).expect("视频快照")
}

/// Checked moment by moment across the range: each sound in the per-frame plan (except frozen frames, which are silent) falls exactly within one segment of the interval plan, with the same source time and gain (amplitude). The interval plan has no extra sounds.
fn assert_matches_frame_plan(video: &VideoSnapshot, plan: &AudioPlan) {
    assert_matches_frame_plan_with_speech(video, plan, None);
}

/// Same as above. `speech` is the same effective word stream handed to both plans (the preview hands it to the per-frame plan).
fn assert_matches_frame_plan_with_speech(video: &VideoSnapshot, plan: &AudioPlan, speech: Option<&[(f64, f64)]>) {
    let (start, end) = (plan.range.start_seconds, plan.range.end_seconds);
    let (first, last) = ((start * 600.0).round() as i128, (end * 600.0).round() as i128);
    let mut compared = 0;
    for n in first..last {
        let t = Ratio::new(n, 600).expect("时刻");
        let rel = t.to_f64() - start;
        let frame = plan_frame_with_speech(VideoView::from(video), "seq_main", t, speech).expect("帧计划");
        let voices: Vec<_> = frame.voices.iter().filter(|v| v.source_rate != 0.0).collect();
        let covering: Vec<_> = plan
            .segments
            .iter()
            .filter(|s| s.start <= rel + 1e-12 && rel < s.end - 1e-12)
            .collect();
        assert_eq!(
            covering.len(),
            voices.len(),
            "t = {}：区间计划 {:?}，逐帧计划 {:?}",
            t.to_f64(),
            covering.iter().map(|s| &s.item_id).collect::<Vec<_>>(),
            voices.iter().map(|v| &v.item_id).collect::<Vec<_>>()
        );
        for voice in voices {
            let segment = covering
                .iter()
                .find(|s| s.item_id == voice.item_id && s.source == voice.source)
                .unwrap_or_else(|| panic!("t = {}：{} 不在区间计划里", t.to_f64(), voice.item_id));
            let source = segment.source_start + (rel - segment.start) * segment.source_rate;
            assert!(
                (source - voice.source_seconds).abs() < 1e-6,
                "t = {}：{} 源时刻 {source} ≠ {}",
                t.to_f64(),
                voice.item_id,
                voice.source_seconds
            );
            let amplitude = |db: f64| 10f64.powf(db / 20.0);
            let gain = segment.gain_db_at(rel);
            assert!(
                (amplitude(gain) - amplitude(voice.gain_db)).abs() < 1e-6,
                "t = {}：{} 增益 {gain} dB ≠ {} dB",
                t.to_f64(),
                voice.item_id,
                voice.gain_db
            );
            compared += 1;
        }
    }
    assert!(compared > 0);
}

#[test]
fn audio_plan_matches_the_frame_plan_with_crossfades_and_ducking() {
    // Fixture as-is: the 30-frame centered tr_land crossfades within [2.5, 3.5); the music ducks item_hidden on a hidden track.
    let video = frame_fixture(|_| {});
    let plan = plan_audio(VideoView::from(&video), "seq_main", None).expect("计划");
    assert_matches_frame_plan(&video, &plan);
    let find = |item: &str, handle: bool| plan.segments.iter().find(|s| s.item_id == item && s.handle == handle).expect(item);
    // The outgoing side: its own segment has a cos curve; after the cut point it uses handles (from source 4 s, without a fade).
    let own = find("item_land_a", false);
    assert_eq!((own.start, own.end, own.crossfades[0].role), (0.0, 3.0, CrossfadeRole::Outgoing));
    let tail = find("item_land_a", true);
    assert_eq!((tail.start, tail.end, tail.source_start), (3.0, 3.5, 4.0));
    let head = find("item_land_b", true);
    assert_eq!(
        (head.start, head.end, head.source_start, head.crossfades[0].role),
        (2.5, 3.0, 3.5, CrossfadeRole::Incoming)
    );
    // Equal power: at the midpoint, both sides are −3.01 dB.
    near(own.crossfades[0].amplitude(3.0), std::f64::consts::FRAC_1_SQRT_2);
    // Ducking only applies to the instance being lowered, with breakpoints covering its whole span: it starts at 0 dB, returns to 0 dB, and the plateau is 12 dB. The ramp is linear in gain, baked into breakpoints no more than 0.02 seconds apart (attack 0.25 s, release 0.5 s).
    let hidden = find("item_hidden", false);
    let reductions: Vec<f64> = hidden.ducking.iter().map(|k| k.1).collect();
    assert_eq!((reductions.first(), reductions.last()), (Some(&0.0), Some(&0.0)));
    near(reductions.iter().cloned().fold(0.0, f64::max), 12.0);
    assert!(hidden.ducking.len() >= 2 + 13 + 25);
    assert!(
        plan.segments
            .iter()
            .filter(|s| s.item_id != "item_hidden")
            .all(|s| s.ducking.is_empty())
    );
    // A freeze frame makes no sound; it is still reported as before.
    assert!(plan.notes.iter().any(|n| n.code == "HOLD_IS_SILENT" && n.item_id == "item_hold"));

    // Ducking also lowers both sides of a crossfade (attack 0 is a step). The outgoing side has its own fade-out and gain. Only one segment of the range is exported.
    let video = frame_fixture(|v| {
        let sequence = &mut v["sequences"]["seq_main"];
        sequence["ducking"].as_array_mut().unwrap().push(json!({
            "id": "duck_land", "enabled": true, "trigger": { "kind": "items", "trackIds": ["trk_a1"] }, "target": { "trackIds": ["trk_v1"] },
            "depth": 6, "attack": { "ticks": "0", "timescale": 1 }, "release": { "ticks": "1", "timescale": 4 },
        }));
        for item in sequence["items"].as_array_mut().unwrap() {
            if item["id"] == "item_land_a" {
                item["embeddedAudio"] = json!({ "enabled": true, "volume": 0.8, "fadeOut": { "ticks": "1", "timescale": 2 } });
            }
        }
    });
    let plan = plan_audio(
        VideoView::from(&video),
        "seq_main",
        Some((Ratio::new(2, 1).unwrap(), Ratio::new(9, 2).unwrap())),
    )
    .expect("计划");
    assert_matches_frame_plan(&video, &plan);
    let tail = plan.segments.iter().find(|s| s.item_id == "item_land_a" && s.handle).unwrap();
    assert_eq!((tail.start, tail.end, tail.gain_db, tail.fade_out), (1.0, 1.5, db(0.8), None));
    assert!(!tail.ducking.is_empty());

    // When one side has its own sound turned off, that side is silent and the other side still fades out along its curve. When the transition does no sound crossfade, it is a hard cut.
    let video = frame_fixture(|v| {
        for item in v["sequences"]["seq_main"]["items"].as_array_mut().unwrap() {
            if item["id"] == "item_land_b" {
                item["embeddedAudio"]["enabled"] = json!(false);
            }
        }
    });
    let plan = plan_audio(VideoView::from(&video), "seq_main", None).expect("计划");
    assert_matches_frame_plan(&video, &plan);
    assert!(plan.segments.iter().all(|s| s.item_id != "item_land_b"));
    let video = frame_fixture(|v| {
        for tr in v["sequences"]["seq_main"]["transitions"].as_array_mut().unwrap() {
            tr["audioCrossfade"] = json!(false);
        }
    });
    let plan = plan_audio(VideoView::from(&video), "seq_main", None).expect("计划");
    assert_matches_frame_plan(&video, &plan);
    assert!(plan.segments.iter().all(|s| s.crossfades.is_empty() && !s.handle));
}

/// The envelope replaces `volume`. The per-frame plan (preview) and the interval plan (export) are identical point for point: linear segments, segments with easing, points past the end, percentage points, multiplication with fade-in and ducking, crossfade handles, and clipping to a range (v2 `export_gain_envelope_matches_the_preview_envelope_point_for_point`).
#[test]
fn volume_envelopes_replace_volume_in_both_plans() {
    let at = |s: i64| json!({ "ticks": s.to_string(), "timescale": 1 });
    let video = frame_fixture(|v| {
        for item in v["sequences"]["seq_main"]["items"].as_array_mut().unwrap() {
            // 3-second instance: 0.2 rises linearly to 1.0 at 1 s, then falls with easeInQuad to 0.5 at 2 s. The point at 10 s is past the end and has no effect.
            if item["id"] == "item_land_a" {
                item["embeddedAudio"] = json!({ "enabled": true, "volume": 0.8, "envelope": [
                    { "at": at(0), "volume": 0.2 }, { "at": at(1), "volume": 1.0 },
                    { "at": at(2), "volume": 0.5, "ease": "easeInQuad" }, { "at": at(10), "volume": 4.0 },
                ] });
            }
            // 5-second instance lowered by music: percentage point 0.5 → 1.0, then multiplied by a half-second fade-in.
            if item["id"] == "item_hidden" {
                item["embeddedAudio"] = json!({ "enabled": true, "volume": 0.5, "fadeIn": { "ticks": "1", "timescale": 2 }, "envelope": [
                    { "percent": 0, "volume": 0.5 }, { "percent": 100, "volume": 1.0 },
                ] });
            }
        }
    });
    let plan = plan_audio(VideoView::from(&video), "seq_main", None).expect("计划");
    assert_matches_frame_plan(&video, &plan);
    let find = |plan: &AudioPlan, item: &str, handle: bool| {
        plan.segments
            .iter()
            .find(|s| s.item_id == item && s.handle == handle)
            .cloned()
            .expect(item)
    };
    let close = |actual: f64, expected: f64| assert!((actual - expected).abs() < 1e-9, "{actual} ≠ {expected}");
    let own = find(&plan, "item_land_a", false);
    assert_eq!(own.gain_db, 0.0);
    close(envelope_at(&own.envelope, 0.5), 0.6);
    // The easing is on the later point: 1.5 s is halfway through the 1.0 → 0.5 segment, and easeInQuad covers 1/4 of it.
    close(envelope_at(&own.envelope, 1.5), 0.875);
    close(envelope_at(&own.envelope, 2.8), 0.5);
    // After the cut point, the handle stays on the last effective point.
    let tail = find(&plan, "item_land_a", true);
    close(envelope_at(&tail.envelope, 3.2), 0.5);
    let hidden = find(&plan, "item_hidden", false);
    close(envelope_at(&hidden.envelope, 2.5), 0.75);
    assert!(!hidden.ducking.is_empty() && hidden.fade_in.is_some());
    // A segment without an envelope has no breakpoints; its gain is still `volume`.
    assert!(
        plan.segments
            .iter()
            .filter(|s| s.item_id == "item_land_b")
            .all(|s| s.envelope.is_empty())
    );

    // Export only [1.5, 4.5): the breakpoints move to the range's clock. The first breakpoint is not later than the range start, and point by point they still match.
    let plan = plan_audio(
        VideoView::from(&video),
        "seq_main",
        Some((Ratio::new(3, 2).unwrap(), Ratio::new(9, 2).unwrap())),
    )
    .expect("计划");
    assert_matches_frame_plan(&video, &plan);
    let own = find(&plan, "item_land_a", false);
    assert!(own.envelope[0].0 <= own.start);
    close(envelope_at(&own.envelope, 0.0), 0.875);
    close(envelope_at(&find(&plan, "item_hidden", false).envelope, 1.0), 0.75);
}

#[test]
fn speech_ducking_follows_the_effective_word_stream() {
    // Two picture segments use the same asset with audio: the first is source [0, 2) s; the second starts at source 4 s at 2× speed. The music on A1 sounds for 4 s and is lowered 10 dB per the script.
    let music = merge(
        base("music", "a1"),
        json!({
            "type": "audio", "assetRef": { "id": "asset_b", "revision": "r1" }, "fromFrame": 0,
            "subframeOffset": { "ticks": "0", "timescale": 1 }, "playDuration": { "ticks": "4", "timescale": 1 },
            "timeMap": { "kind": "linear", "sourceIn": { "ticks": "0", "timescale": 1 }, "rate": { "num": 1, "den": 1 } },
            "mix": { "volume": 1 },
        }),
    );
    let mut video = video(json!([
        clip("first", "v1", "asset_a", 0, 60, 0, (1, 1)),
        clip("second", "v1", "asset_a", 60, 60, 4, (2, 1)),
        music,
        // Captions show this transcript only in the first second; speech is still computed across the whole timeline.
        caption_item("cap", "doc_speech", 0, 30, &["first"])
    ]));
    let rule = json!({
        "id": "duck_speech", "enabled": true, "trigger": { "kind": "speech" }, "target": { "itemIds": ["music"] },
        "depth": 10, "attack": { "ticks": "1", "timescale": 10 }, "release": { "ticks": "1", "timescale": 10 },
    });
    video
        .sequences
        .get_mut("seq_main")
        .unwrap()
        .ducking
        .push(serde_json::from_value(rule).expect("闪避规则"));

    // Effective word stream: w3 is inside the cut source [2, 4); w4 at 2× speed lands at sequence [2.5, 3). Another document's asset is not on the timeline, so it is skipped. Caption documents do not count.
    let word = |id: &str, start: i64, end: i64| json!({ "id": id, "start": start, "end": end, "text": id });
    let speech = json!({ "schema": "cuccut.speech/1", "clock": "source-asset", "timescale": 1000,
        "words": [word("w1", 0, 400), word("w2", 400, 900), word("w3", 2500, 3000), word("w4", 5000, 6000)] });
    let elsewhere = json!({ "schema": "cuccut.speech/1", "clock": "source-asset", "timescale": 1000, "words": [word("x1", 0, 1000)] });
    let captions =
        json!({ "schema": "cuccut.caption/1", "clock": "source-asset", "timescale": 1000, "cues": [cue("c1", 1000, 1900, "字幕")] });
    let (doc, other, cap) = (
        record("doc_speech", "speech", Some("asset_a")),
        record("doc_other", "speech", Some("asset_mute")),
        record("doc_cap", "caption", Some("asset_a")),
    );
    let activity = speech_activity(
        VideoView::from(&video),
        "seq_main",
        &[(&doc, &speech), (&other, &elsewhere), (&cap, &captions)],
    )
    .expect("词流");
    assert_eq!(activity, [(0.0, 0.4), (0.4, 0.9), (2.5, 3.0)]);
    // Split by speaker: the same word stream, counting only words that have a `speaker`.
    let mut attributed = speech.clone();
    attributed["words"][0]["speaker"] = json!("spk_a");
    attributed["words"][1]["speaker"] = json!("spk_b");
    attributed["words"][3]["speaker"] = json!("spk_a");
    let speakers = speaker_activity(VideoView::from(&video), "seq_main", &[(&doc, &attributed), (&cap, &captions)]).expect("说话人");
    assert_eq!(speakers.len(), 2);
    assert_eq!(speakers["spk_a"], [(0.0, 0.4), (2.5, 3.0)]);
    assert_eq!(speakers["spk_b"], [(0.4, 0.9)]);

    // Applying the v2 curve: [0, 0.9] and [2.5, 3] are 1.6 s apart (> 0.5 s), so they are two segments. Only the target is lowered.
    let plan = plan_audio_with_speech(VideoView::from(&video), "seq_main", None, &activity).expect("计划");
    let ducked = plan.segments.iter().find(|s| s.item_id == "music").expect("音乐");
    near(ducked.gain_db_at(0.5), -10.0);
    near(ducked.gain_db_at(1.7), 0.0);
    near(ducked.gain_db_at(2.75), -10.0);
    near(ducked.gain_db_at(3.5), 0.0);
    assert!(plan.segments.iter().filter(|s| s.item_id != "music").all(|s| s.ducking.is_empty()));
    assert!(plan.notes.is_empty(), "{:?}", plan.notes);
    // The preview hands the same word stream to the per-frame plan: the gain at each moment (including on the ramp) is the same as in export.
    assert_matches_frame_plan_with_speech(&video, &plan, Some(&activity));

    // Empty word stream: no ducking, and it reports `DUCK_NO_SPEECH`; consistent with the per-frame plan.
    let plan = plan_audio(VideoView::from(&video), "seq_main", None).expect("计划");
    assert!(plan.segments.iter().all(|s| s.ducking.is_empty()));
    let codes: Vec<(&str, &str)> = plan.notes.iter().map(|n| (n.code.as_str(), n.item_id.as_str())).collect();
    assert_eq!(codes, [("DUCK_NO_SPEECH", "music")]);
    assert_matches_frame_plan(&video, &plan);
}

#[test]
fn crossfade_handles_past_the_source_are_reported() {
    // item_land_b starts at source 0.25 s: the incoming side needs source handles [−0.25, 0.25), and nothing exists before 0 s, so the segment starts at 2.75 s.
    let video = frame_fixture(|v| {
        let sequence = &mut v["sequences"]["seq_main"];
        for item in sequence["items"].as_array_mut().unwrap() {
            if item["id"] == "item_land_b" {
                item["timeMap"]["sourceIn"] = json!({ "ticks": "1", "timescale": 4 });
            }
        }
        v["assets"]["asset_land"]["revisions"]["rev_1"]["duration"] = json!({ "ticks": "4", "timescale": 1 });
    });
    let plan = plan_audio(VideoView::from(&video), "seq_main", None).expect("计划");
    let head = plan.segments.iter().find(|s| s.item_id == "item_land_b" && s.handle).unwrap();
    assert_eq!((head.start, head.end, head.source_start), (2.75, 3.0, 0.0));
    let codes: Vec<_> = plan
        .notes
        .iter()
        .filter(|n| n.code == "CROSSFADE_HANDLE_SHORT")
        .map(|n| n.item_id.as_str())
        .collect();
    // The outgoing side needs source [4, 4.5), but the asset is only 4 seconds long.
    assert!(codes.contains(&"item_land_a") && codes.contains(&"item_land_b"), "{codes:?}");
    let json = serde_json::to_value(&plan).unwrap();
    let segment = json["segments"]
        .as_array()
        .unwrap()
        .iter()
        .find(|s| s["itemId"] == "item_land_a" && s["handle"] == true)
        .unwrap();
    assert_eq!(segment["crossfades"][0]["role"], "outgoing");
}

fn record(id: &str, kind: &str, source_asset: Option<&str>) -> DocumentRecord {
    serde_json::from_value(json!({
        "id": id, "kind": kind, "name": id, "currentRevision": "d1", "revisions": {},
        "sourceAssetId": source_asset,
    }))
    .expect("文档头")
}

fn caption_item(id: &str, document: &str, from: i64, frames: i64, scopes: &[&str]) -> Value {
    merge(
        base(id, "s1"),
        json!({ "type": "caption", "span": { "fromFrame": from, "durationFrames": frames }, "documentId": document, "scopeItemIds": scopes }),
    )
}

fn cue(id: &str, start_ms: i64, end_ms: i64, text: &str) -> Value {
    json!({ "id": id, "start": start_ms, "end": end_ms, "text": text })
}

#[test]
fn caption_cues_follow_cuts_speed_and_repeated_sources() {
    let body = json!({ "schema": "cuccut.caption/1", "clock": "source-asset", "timescale": 1000, "cues": [
        cue("c1", 500, 1500, "第一句"),
        cue("c2", 2500, 3500, "剪掉的话"),
        cue("c3", 1500, 4500, "跨过剪点"),
        cue("c4", 5000, 6000, "加速的话"),
        cue("c5", 7000, 7000, "零长"),
        cue("c6", 8000, 9000, "   "),
    ]});
    let video = video(json!([
        clip("first", "v1", "asset_a", 0, 60, 0, (1, 1)),
        clip("second", "v1", "asset_a", 60, 60, 4, (2, 1)),
        // The same source is used again (another track, not overlapping in time).
        clip("again", "v2", "asset_a", 150, 30, 0, (1, 1)),
        caption_item("cap", "doc_cap", 0, 180, &["first", "second", "again"]),
    ]));
    let plan = plan_text(
        VideoView::from(&video),
        "seq_main",
        &record("doc_cap", "caption", Some("asset_a")),
        &body,
        &[],
        None,
    )
    .expect("投影");
    assert_eq!(plan.scope.basis, "caption-items");
    let placed: Vec<(&str, f64, f64, bool)> = plan.entries.iter().map(|e| (e.key.as_str(), e.start, e.end, e.clipped)).collect();
    assert_eq!(
        placed,
        [
            ("first:c1", 0.5, 1.5, false),
            ("first:c3", 1.5, 2.0, true),
            ("second:c3", 2.0, 2.25, true),
            ("second:c4", 2.5, 3.0, false),
            ("again:c1", 5.5, 6.0, true),
        ]
    );
    // c2 is cut as a whole sentence; zero-length and blank sentences were never counted.
    assert_eq!((plan.source_count, plan.omitted_count), (4, 1));
    assert!(plan.entries.iter().all(|e| !e.word_timing));
}

#[test]
fn overlapping_scopes_project_once_like_the_frame_plan() {
    let body =
        json!({ "schema": "cuccut.caption/1", "clock": "source-asset", "timescale": 1000, "cues": [cue("c1", 0, 2000, "两层都覆盖")] });
    // The video and the audio split from it overlap at the same position: captions appear only once (the per-frame plan takes the first covering instance in the list; instances found by asset are sorted by start, then by ID, with audio first).
    let audio = merge(
        base("audio", "a1"),
        json!({
            "type": "audio", "assetRef": { "id": "asset_a", "revision": "r1" }, "fromFrame": 0,
            "subframeOffset": { "ticks": "0", "timescale": 1 }, "playDuration": { "ticks": "3", "timescale": 1 },
            "timeMap": { "kind": "linear", "sourceIn": { "ticks": "0", "timescale": 1 }, "rate": { "num": 1, "den": 1 } },
            "mix": { "volume": 1 },
        }),
    );
    let video = video(json!([clip("pic", "v1", "asset_a", 0, 30, 0, (1, 1)), audio]));
    let plan = plan_text(
        VideoView::from(&video),
        "seq_main",
        &record("doc", "caption", Some("asset_a")),
        &body,
        &[],
        None,
    )
    .expect("投影");
    assert_eq!(plan.scope.basis, "asset-items");
    let placed: Vec<(&str, f64, f64)> = plan.entries.iter().map(|e| (e.key.as_str(), e.start, e.end)).collect();
    assert_eq!(placed, [("audio:c1", 0.0, 2.0)]);
}

#[test]
fn speech_words_drop_cut_words_and_keep_timing_quality() {
    let word = |id: &str, start: i64, end: i64, text: &str| json!({ "id": id, "start": start, "end": end, "text": text });
    let mut estimated = word("w4", 4200, 4600, "guess");
    estimated["timingQuality"] = json!("estimated");
    let mut hidden = word("w5", 4600, 4800, "um");
    hidden["hidden"] = json!(true);
    let body = json!({
        "schema": "cuccut.speech/1", "clock": "source-asset", "timescale": 1000,
        "words": [
            word("w1", 0, 400, "hello"), word("w2", 400, 900, "world"), word("w3", 2500, 3000, "cut"),
            estimated, hidden, word("w6", 5000, 6000, "a whole segment"),
        ],
        "sentences": [{ "id": "s1", "first": "w1", "last": "w2", "paragraphStart": true }, { "id": "s2", "wordIds": ["w3", "w4"] }],
    });
    let video = video(json!([
        clip("first", "v1", "asset_a", 0, 60, 0, (1, 1)),
        clip("second", "v1", "asset_a", 60, 60, 4, (2, 1))
    ]));
    let plan = plan_text(
        VideoView::from(&video),
        "seq_main",
        &record("doc_speech", "speech", Some("asset_a")),
        &body,
        &[],
        None,
    )
    .expect("投影");
    assert_eq!(plan.unit, "speech");
    type Word<'a> = (&'a str, f64, f64, bool, Option<&'a str>, bool);
    let words: Vec<Word> = plan
        .entries
        .iter()
        .map(|e| {
            (
                e.id.as_str(),
                e.start,
                e.end,
                e.word_timing,
                e.sentence_id.as_deref(),
                e.paragraph_start,
            )
        })
        .collect();
    assert_eq!(
        words,
        [
            ("w1", 0.0, 0.4, true, Some("s1"), true),
            ("w2", 0.4, 0.9, true, Some("s1"), false),
            ("w4", 2.1, 2.3, false, Some("s2"), false),
            ("w6", 2.5, 3.0, false, None, false),
        ]
    );
    assert_eq!(plan.omitted_count, 1);

    // Range: time is relative to the range start; words outside the range do not appear.
    let range = Some((seconds(2), seconds(3)));
    let ranged = plan_text(
        VideoView::from(&video),
        "seq_main",
        &record("doc_speech", "speech", Some("asset_a")),
        &body,
        &[],
        range,
    )
    .expect("投影");
    let ids: Vec<(&str, f64)> = ranged.entries.iter().map(|e| (e.id.as_str(), e.start)).collect();
    assert_eq!(ids, [("w4", 0.1), ("w6", 0.5)]);
}

/// Real samples (qwen3-asr with forced alignment) contain words whose start and end collapse to one point: those with a gap after them take one slot; those right next to the next word are skipped.
#[test]
fn zero_duration_words_take_a_slot_from_the_following_gap() {
    let word = |id: &str, start: i64, end: i64, text: &str| json!({ "id": id, "start": start, "end": end, "text": text });
    let body = json!({
        "schema": "cuccut.speech/1", "clock": "source-asset", "timescale": 1000,
        "words": [
            word("w1", 716, 956, "just"), word("w2", 956, 956, "ask—you"), word("w3", 1196, 1436, "know,"),
            word("w4", 1436, 1436, "to"), word("w5", 1450, 1500, "be"), word("w6", 1500, 1500, "stuck"), word("w7", 1500, 1700, "end."),
        ],
    });
    let video = video(json!([clip("first", "v1", "asset_a", 0, 60, 0, (1, 1))]));
    let plan = plan_text(
        VideoView::from(&video),
        "seq_main",
        &record("doc_speech", "speech", Some("asset_a")),
        &body,
        &[],
        None,
    )
    .expect("投影");
    let words: Vec<(&str, f64, f64)> = plan.entries.iter().map(|e| (e.id.as_str(), e.start, e.end)).collect();
    assert_eq!(
        words,
        [
            ("w1", 0.716, 0.956),
            ("w2", 0.956, 1.036),
            ("w3", 1.196, 1.436),
            ("w4", 1.436, 1.45),
            ("w5", 1.45, 1.5),
            ("w7", 1.5, 1.7),
        ]
    );
}

#[test]
fn sequence_clock_and_missing_scope_are_explicit() {
    let body = json!({ "schema": "cuccut.caption/1", "clock": "sequence", "timescale": 1000, "cues": [cue("c1", 500, 1500, "标题"), cue("c2", 3000, 4000, "范围外")] });
    let video = video(json!([
        clip("first", "v1", "asset_a", 0, 60, 0, (1, 1)),
        caption_item("cap", "doc", 0, 60, &[])
    ]));
    let plan = plan_text(
        VideoView::from(&video),
        "seq_main",
        &record("doc", "caption", None),
        &body,
        &[],
        None,
    )
    .expect("投影");
    assert_eq!(plan.scope.basis, "sequence");
    let placed: Vec<(&str, f64, f64)> = plan.entries.iter().map(|e| (e.key.as_str(), e.start, e.end)).collect();
    assert_eq!(placed, [("c1", 0.5, 1.5)]);

    let source_body = json!({ "schema": "cuccut.caption/1", "clock": "source-asset", "timescale": 1000, "cues": [cue("c1", 0, 100, "x")] });
    let error = plan_text(
        VideoView::from(&video),
        "seq_main",
        &record("doc2", "caption", None),
        &source_body,
        &[],
        None,
    )
    .expect_err("没有作用实例");
    assert_eq!(error.code, "EXPORT_SOURCE_UNPLACED");
    let other = json!({ "schema": "cuccut.translation/1" });
    let error = plan_text(
        VideoView::from(&video),
        "seq_main",
        &record("doc3", "translation", None),
        &other,
        &[],
        None,
    )
    .expect_err("译文");
    assert_eq!(error.code, "EXPORT_SOURCE_UNSUPPORTED");
}
