//! Frame-plan behavior on the fixture video, and the golden output shared with the WASM preview.
//!
//! Each line of the golden file `fixtures/plan-golden.txt` is `seconds\tplan JSON`. The UI's vitest compares the same file byte for byte against the WASM build: the preview and export come from the same implementation, so the output must match on both targets. After changing the plan rules, regenerate it with `UPDATE_GOLDEN=1 cargo test`.

use std::path::PathBuf;

use editor_semantics::{MediaTime, TimeMap};
use render_graph::ducking::DuckingEnvelope;
use render_graph::{FramePlan, LayerContent, LayerKind, TransitionRole, VideoView, VisualLayer, VoiceSource, plan_interactive};
use video_model::{Fit, SoloGroup, TimelineItem, VideoSnapshot, VisualMode};

/// Sample times covering clip boundaries, sub-frame audio starts and ends, freeze frames, and floating-point frame boundaries.
const SAMPLE_SECONDS: &[f64] = &[
    0.0,
    1.0 / 30.0,
    0.5,
    0.50002,
    0.50003,
    1.0,
    1.4999,
    1.5,
    2.0,
    2.999,
    3.0,
    3.50002,
    3.50003,
    4.0,
    4.999,
    5.0,
    5.5,
    6.0,
    7.0,
    8.0,
    8.5,
    8.9,
    9.5,
    9.8,
    10.5,
    100.0,
];

fn fixture_path(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures").join(name)
}

fn fixture() -> VideoSnapshot {
    let text = std::fs::read_to_string(fixture_path("video.json")).expect("read video fixture");
    serde_json::from_str(&text).expect("fixture is a complete video snapshot")
}

fn plan(video: &VideoSnapshot, seconds: f64) -> FramePlan {
    plan_interactive(VideoView::from(video), "seq_main", seconds).expect("compute plan")
}

fn layer_ids(plan: &FramePlan) -> Vec<&str> {
    plan.layers.iter().map(|layer| layer.item_id.as_str()).collect()
}

fn layer<'a>(plan: &'a FramePlan, item_id: &str) -> &'a VisualLayer {
    plan.layers
        .iter()
        .find(|layer| layer.item_id == item_id)
        .unwrap_or_else(|| panic!("{item_id} is on screen"))
}

/// Linear multiplier converted to dB, using the same formula as the planner; results are bit-identical.
fn db(volume: f64) -> f64 {
    20.0 * volume.log10()
}

fn voice_ids(plan: &FramePlan) -> Vec<&str> {
    plan.voices.iter().map(|voice| voice.item_id.as_str()).collect()
}

#[test]
fn hidden_tracks_still_sound_and_disabled_items_are_skipped() {
    let video = fixture();
    let start = plan(&video, 0.0);
    assert_eq!(start.frame, 0);
    assert_eq!(layer_ids(&start), ["item_land_a"]);
    assert_eq!(voice_ids(&start), ["item_land_a", "item_hidden"]);
    assert_eq!(start.voices[1].source, VoiceSource::Embedded);
    // The volume is the linear multiplier 0.5; the plan converts it to dB.
    assert_eq!(start.voices[1].gain_db, db(0.5));
    assert_eq!(start.canvas.background, "#101820");
}

#[test]
fn layers_stack_by_track_order_then_paint_order() {
    let video = fixture();
    let middle = plan(&video, 1.5);
    assert_eq!(middle.frame, 45);
    // V1 (order 0) is below, V2 (order 1) is above; in V2 the one with the smaller paintOrder draws first. The video source time follows the time mapping: sourceIn 1 s + 1.5 s.
    assert_eq!(layer_ids(&middle), ["item_land_a", "item_port", "item_logo"]);
    assert_eq!(middle.layers[0].source_seconds, Some(2.5));
    assert_eq!(middle.layers[0].source_rate, Some(1.0));
    assert_eq!(middle.layers[2].kind, LayerKind::Image);
    assert_eq!(middle.layers[2].source_seconds, None);
}

#[test]
fn rotated_portrait_video_is_contained_in_its_box() {
    let video = fixture();
    let port = plan(&video, 1.0)
        .layers
        .into_iter()
        .find(|layer| layer.item_id == "item_port")
        .expect("portrait clip is on screen");
    // The picture-in-picture box's height follows the source aspect ratio: width 15% = 288, and the 1080×1920 source has height 512. The center is at (60%, 40%) = (1152, 432), rotated 90° clockwise.
    assert_eq!(port.matrix, [0.0, 288.0, -512.0, 0.0, 1408.0, 288.0]);
    assert_eq!(port.source_rect, Some([0.0, 0.0, 1.0, 1.0]));
    assert_eq!(port.opacity, 0.5);
    assert_eq!(port.source_seconds, Some(0.0));
}

#[test]
fn cover_crops_the_source_around_its_center() {
    // The PiP box keeps the source's proportions; fit only takes effect when filling the canvas, so the portrait clip is changed to fill.
    let mut video = fixture();
    for item in &mut video.sequences.get_mut("seq_main").unwrap().items {
        if let TimelineItem::Video(port) = item
            && port.base.id == "item_port"
        {
            port.media.mode = Some(VisualMode::Fullscreen);
            port.media.fit = Some(Fit::Cover);
        }
    }
    let port = plan(&video, 1.0)
        .layers
        .into_iter()
        .find(|layer| layer.item_id == "item_port")
        .expect("portrait clip is on screen");
    // 1080×1920 filling 1920×1080: width aligns, and the middle part is taken with height (1080/1920)².
    let [u0, v0, u1, v1] = port.source_rect.expect("视频有取源区域");
    let kept = (1080.0f64 / 1920.0).powi(2);
    assert_eq!((u0, u1), (0.0, 1.0));
    assert!((v0 - (1.0 - kept) / 2.0).abs() < 1e-12 && (v1 - (1.0 + kept) / 2.0).abs() < 1e-12);
}

#[test]
fn frame_boundaries_survive_float_seconds() {
    let video = fixture();
    assert_eq!(plan(&video, 1.0 / 30.0).frame, 1);
    assert_eq!(plan(&video, 89.0 / 30.0).frame, 89);
    assert_eq!(plan(&video, 2.999).frame, 89);
    assert_eq!(layer_ids(&plan(&video, 3.0)), ["item_land_b", "item_logo"]);
    assert_eq!(plan(&video, 3.0).layers[0].source_seconds, Some(4.0));
}

#[test]
fn audio_starts_and_ends_on_samples_not_frames() {
    let video = fixture();
    // Starts 1/48000 s later than frame 15 and sounds for 3 s.
    assert!(!voice_ids(&plan(&video, 0.50002)).contains(&"item_music"));
    let started = plan(&video, 0.50003);
    let music = started
        .voices
        .iter()
        .find(|voice| voice.item_id == "item_music")
        .expect("音乐已经开始");
    assert_eq!(music.source, VoiceSource::Audio);
    assert_eq!(music.gain_db, db(0.5));
    assert!((music.source_seconds - (0.50003 - 0.5 - 1.0 / 48000.0)).abs() < 1e-12);
    assert!(voice_ids(&plan(&video, 3.50002)).contains(&"item_music"));
    assert!(!voice_ids(&plan(&video, 3.50003)).contains(&"item_music"));
}

#[test]
fn fades_ramp_the_gain_linearly_in_amplitude() {
    let mut video = fixture();
    let sequence = video.sequences.get_mut("seq_main").unwrap();
    for item in &mut sequence.items {
        if let TimelineItem::Audio(audio) = item {
            audio.mix.fade_in = Some(MediaTime {
                ticks: "1".into(),
                timescale: 1,
            });
            audio.mix.fade_out = Some(MediaTime {
                ticks: "1".into(),
                timescale: 2,
            });
        }
    }
    let gain = |seconds: f64| {
        plan(&video, seconds)
            .voices
            .iter()
            .find(|voice| voice.item_id == "item_music")
            .map(|voice| voice.gain_db)
            .expect("音乐在响")
    };
    // Music starts at 0.5 + 1/48000 s and sounds for 3 s. At half of the fade-in the amplitude is 0.5 (−6.02 dB); in the middle only the volume applies (0.5×); when 0.25 s of fade-out remains it is half again.
    // The interactive entry point uses microsecond approximations, so the comparison is only to the nearest thousandth of a dB.
    let start = 0.5 + 1.0 / 48000.0;
    let half = db(0.5);
    assert!((gain(start + 0.5) - (db(0.5) + half)).abs() < 1e-3);
    assert_eq!(gain(2.0), db(0.5));
    assert!((gain(start + 3.0 - 0.25) - (db(0.5) + half)).abs() < 1e-3);
    assert!(gain(start) <= -100.0);
}

#[test]
fn hold_maps_every_frame_to_one_source_moment() {
    let video = fixture();
    for seconds in [5.0, 5.5] {
        let held = plan(&video, seconds);
        assert_eq!(layer_ids(&held), ["item_hold"]);
        assert_eq!(held.layers[0].source_seconds, Some(2.5));
        assert_eq!(held.layers[0].source_rate, Some(0.0));
        assert_eq!(held.voices[0].source_rate, 0.0);
        assert_eq!(held.layers[0].matrix, [1920.0, 0.0, 0.0, 1080.0, 0.0, 0.0]);
    }
    let after = plan(&video, 6.0);
    assert!(after.layers.is_empty() && after.voices.is_empty());
}

#[test]
fn solo_groups_apply_separately() {
    let mut video = fixture();
    let sequence = video.sequences.get_mut("seq_main").unwrap();
    for track in &mut sequence.tracks {
        if track.id == "trk_v2" || track.id == "trk_a1" {
            track.solo.enabled = true;
            assert!(matches!(track.solo.group, SoloGroup::Visual | SoloGroup::Audio));
        }
    }
    let soloed = plan(&video, 1.5);
    assert_eq!(layer_ids(&soloed), ["item_port", "item_logo"]);
    // After the audio group is soloed, the video's own sound also stops; only the soloed track remains.
    assert_eq!(voice_ids(&soloed), ["item_music"]);
}

#[test]
fn muted_tracks_keep_their_picture() {
    let mut video = fixture();
    let sequence = video.sequences.get_mut("seq_main").unwrap();
    sequence.tracks.iter_mut().for_each(|track| track.muted = true);
    let muted = plan(&video, 1.5);
    assert_eq!(muted.layers.len(), 3);
    assert!(muted.voices.is_empty());
}

#[test]
fn errors_name_the_problem() {
    let video = fixture();
    let missing = plan_interactive(VideoView::from(&video), "seq_missing", 0.0).unwrap_err();
    assert_eq!(missing.code, "SEQUENCE_NOT_FOUND");
    let invalid = plan_interactive(VideoView::from(&video), "seq_main", f64::NAN).unwrap_err();
    assert_eq!(invalid.code, "INVALID_TIME");
}

#[test]
fn malformed_rates_are_errors_not_panics() {
    // A panic in WASM is a trap: the planner can only reload, and hitting the same video again would trap again.
    let mut video = fixture();
    video.sequences.get_mut("seq_main").unwrap().header.fps.num = 0;
    assert_eq!(
        plan_interactive(VideoView::from(&video), "seq_main", 1.0).unwrap_err().code,
        "INVALID_TIME_VALUE"
    );

    let mut video = fixture();
    for item in &mut video.sequences.get_mut("seq_main").unwrap().items {
        if let TimelineItem::Video(video_item) = item
            && let TimeMap::Linear { rate, .. } = &mut video_item.time_map
        {
            rate.den = 0;
        }
    }
    assert_eq!(
        plan_interactive(VideoView::from(&video), "seq_main", 0.0).unwrap_err().code,
        "INVALID_TIME_VALUE"
    );

    let mut video = fixture();
    let land = video.assets.get_mut("asset_land").unwrap().revisions.get_mut("rev_1").unwrap();
    land.video.as_mut().unwrap().pixel_aspect_ratio.den = 0;
    let plan = plan_interactive(VideoView::from(&video), "seq_main", 0.0).unwrap();
    assert_eq!(plan.layers[0].matrix, [1920.0, 0.0, 0.0, 1080.0, 0.0, 0.0]);
}

#[test]
fn text_shape_and_generators_fill_their_box() {
    let video = fixture();
    let plan = plan(&video, 8.0);
    assert_eq!(plan.frame, 240);
    // The generator track (order 3) is above the video, and the caption track (order 4) is above that.
    assert_eq!(
        layer_ids(&plan),
        ["item_talk_a", "item_title", "item_badge", "item_meter", "item_caption"]
    );

    let title = layer(&plan, "item_title");
    assert_eq!(title.kind, LayerKind::Text);
    // The text box is square (v2 element geometry): width 50% = 960, center at (50%, 20%) = (960, 216).
    assert_eq!(title.matrix, [960.0, 0.0, 0.0, 960.0, 480.0, -264.0]);
    assert_eq!((title.asset.as_ref(), title.source_rect), (None, None));
    let Some(LayerContent::Text { text, style }) = &title.content else {
        panic!("文字层带文字");
    };
    assert_eq!(text, "标题");
    assert_eq!(style["fontSize"], 96);

    let badge = layer(&plan, "item_badge");
    assert_eq!(badge.kind, LayerKind::Shape);
    assert_eq!(badge.opacity, 0.8);
    // Width 10% = 192, height 10% = 108, center at (192, 216), rotated 90° clockwise around the center.
    assert_eq!(badge.matrix, [0.0, 192.0, -108.0, 0.0, 246.0, 120.0]);
    let Some(LayerContent::Shape { shape }) = &badge.content else {
        panic!("图形层带图形");
    };
    assert_eq!((shape["shape"].as_str(), shape["fill"].as_str()), (Some("rect"), Some("#FF0000")));

    let meter = layer(&plan, "item_meter");
    assert_eq!(meter.kind, LayerKind::Generator);
    let Some(LayerContent::Generator {
        generator,
        elapsed_seconds,
        duration_seconds,
        ..
    }) = &meter.content
    else {
        panic!("生成器层带生成器");
    };
    assert_eq!(generator, "cuccut.progress");
    assert!((elapsed_seconds - 10.0 / 30.0).abs() < 1e-12);
    assert_eq!(*duration_seconds, 3.0);
    // The progress bar has no time mapping: local time is the time elapsed in the instance, at speed 1.
    assert!((meter.source_seconds.unwrap() - 10.0 / 30.0).abs() < 1e-12);
    assert_eq!(meter.source_rate, Some(1.0));
}

#[test]
fn bundles_without_prerender_are_reported_not_blank() {
    let video = fixture();
    let plan = plan(&video, 8.5);
    let bundle = layer(&plan, "item_bundle");
    assert_eq!(bundle.kind, LayerKind::Unsupported);
    assert_eq!(bundle.asset.as_ref().map(|a| a.id.as_str()), Some("asset_logo"));
    assert_eq!(
        bundle.content,
        Some(LayerContent::Unsupported {
            reason: "bundle-without-prerender".into()
        })
    );
    assert!(plan.voices.iter().all(|voice| voice.item_id != "item_bundle"));
}

#[test]
fn flips_mirror_the_content_in_place() {
    let video = fixture();
    let mirror = plan(&video, 8.9)
        .layers
        .into_iter()
        .find(|l| l.item_id == "item_mirror")
        .expect("镜像图片在画面上");
    // Width 20% = 384; with a 640×360 source the height is 216. The center is at (576, 540), and u runs from right to left.
    assert_eq!(mirror.matrix, [-384.0, 0.0, 0.0, 216.0, 768.0, 432.0]);
}

#[test]
fn captions_project_through_the_covering_scope_item() {
    let video = fixture();
    let first = plan(&video, 7.0);
    let caption = layer(&first, "item_caption");
    assert_eq!(caption.kind, LayerKind::Caption);
    assert_eq!(caption.matrix, [1920.0, 0.0, 0.0, 1080.0, 0.0, 0.0]);
    let Some(LayerContent::Caption {
        document_id,
        style_document_id,
        sequence_seconds,
        scope: Some(scope),
    }) = &caption.content
    else {
        panic!("字幕层带作用实例");
    };
    assert_eq!(
        (document_id.as_str(), style_document_id.as_deref()),
        ("doc_caption", Some("doc_caption_style"))
    );
    assert_eq!(*sequence_seconds, 7.0);
    // Frame 210 is in item_talk_a: the source starts at 10 s, and 10 frames have passed.
    assert_eq!(scope.item_id, "item_talk_a");
    assert!((scope.source_seconds - (10.0 + 10.0 / 30.0)).abs() < 1e-12);

    // In the gap between the two segments no active instance covers, so no caption appears.
    assert!(plan(&video, 8.9).layers.iter().all(|l| l.item_id != "item_caption"));

    let later = plan(&video, 9.5);
    let Some(LayerContent::Caption { scope: Some(scope), .. }) = &layer(&later, "item_caption").content else {
        panic!("字幕层带作用实例");
    };
    assert_eq!(scope.item_id, "item_talk_b");
    assert!((scope.source_seconds - (20.0 + 10.0 / 30.0)).abs() < 1e-12);

    // Captions with no active instance follow sequence time and appear only within their own span.
    let note = plan(&video, 9.8);
    let Some(LayerContent::Caption { scope, .. }) = &layer(&note, "item_note").content else {
        panic!("字幕层");
    };
    assert!(scope.is_none());
    assert!(plan(&video, 9.5).layers.iter().all(|l| l.item_id != "item_note"));
}

#[test]
fn transitions_carry_both_sides_at_the_midpoint() {
    let video = fixture();
    // The 30-frame centered dissolve within [75, 105): frame 90 (3 s) is exactly halfway.
    let mid = plan(&video, 3.0);
    // The layer list itself is still the hard-cut result: a backend that does not recognize `transition` still draws the incoming side as before.
    assert_eq!(layer_ids(&mid), ["item_land_b", "item_logo"]);
    let tr = mid.layers[0].transition.as_ref().expect("在转场里");
    assert_eq!(
        (tr.id.as_str(), tr.kind.as_str(), tr.role),
        ("tr_land", "dissolve", TransitionRole::Incoming)
    );
    assert_eq!((tr.progress, tr.eased), (0.5, 0.5));
    let partner = tr.partner.as_ref().expect("另一侧");
    assert_eq!(partner.item_id, "item_land_a");
    // The outgoing side keeps taking source after its own end: sourceIn 1 s + 3 s.
    assert_eq!(partner.source_seconds, Some(4.0));
    assert!(partner.transition.is_none());

    // In the frame before, the outgoing side is in the slot and the other side is the incoming side.
    let before = plan(&video, 2.999);
    let tr = before.layers[0].transition.as_ref().unwrap();
    assert_eq!(
        (before.layers[0].item_id.as_str(), tr.role),
        ("item_land_a", TransitionRole::Outgoing)
    );
    assert!((tr.progress - 0.499).abs() < 1e-9);
    assert_eq!(tr.partner.as_ref().unwrap().source_seconds, Some(3.999));

    // Audio equal-power crossfade: at the midpoint both sides are −3.01 dB, with the same transition ID.
    let voices: Vec<_> = mid
        .voices
        .iter()
        .filter(|v| v.transition_id.as_deref() == Some("tr_land"))
        .collect();
    assert_eq!(
        voices.iter().map(|v| v.item_id.as_str()).collect::<Vec<_>>(),
        ["item_land_a", "item_land_b"]
    );
    for v in voices {
        assert!((v.gain_db - 20.0 * std::f64::consts::FRAC_1_SQRT_2.log10()).abs() < 1e-9);
    }

    // No transition outside the window.
    assert!(plan(&video, 3.5).layers[0].transition.is_none());
    assert!(plan(&video, 2.0).voices.iter().all(|v| v.transition_id.is_none()));
}

#[test]
fn transitions_fall_back_to_a_hard_cut() {
    let mut video = fixture();
    let sequence = video.sequences.get_mut("seq_main").unwrap();
    for item in &mut sequence.items {
        if item.base().id == "item_land_a" {
            item.base_mut().enabled = false;
        }
    }
    // The other side cannot be drawn: no transition, and no audio crossfade.
    let mid = plan(&video, 3.0);
    assert!(mid.layers[0].transition.is_none());
    assert!(
        mid.voices.iter().all(|v| v.transition_id.is_none() && v.item_id != "item_land_a"),
        "{:?}",
        mid.voices
    );

    // The two sides no longer touch (the fixture was corrupted by another writer): also a hard cut.
    let mut video = fixture();
    let sequence = video.sequences.get_mut("seq_main").unwrap();
    for item in &mut sequence.items {
        if item.base().id == "item_land_b" {
            item.span_mut().unwrap().from_frame = 91;
        }
    }
    assert!(plan(&video, 2.9).layers[0].transition.is_none());

    // Unrecognized kind: marked unsupported with no other side. The backend hard-cuts it and reports it.
    let video = fixture();
    let out = plan(&video, 9.8);
    let tr = layer(&out, "item_talk_b").transition.as_ref().unwrap();
    assert_eq!(
        (tr.kind.as_str(), tr.unsupported.as_deref(), tr.role),
        ("vendor.spin", Some("unknown-kind"), TransitionRole::Outgoing)
    );
    assert!(tr.partner.is_none());
}

#[test]
fn layers_list_fx_steps_in_spec_order() {
    let video = fixture();
    let held = plan(&video, 5.5);
    let effects = &held.layers[0].effects;
    // Each step of `fx` is listed separately in the order of format spec §3.9 (saturation, color temperature, vignette), and each has a way to draw it.
    assert_eq!(
        effects.iter().map(|e| e.id.as_str()).collect::<Vec<_>>(),
        ["fx.saturation", "fx.temperature", "fx.vignette"]
    );
    assert_eq!(effects[0].params["amount"], -0.5);
    assert_eq!(effects[1].params["amount"], 0.3);
    assert!(effects.iter().all(|e| e.unsupported.is_none()));
    // Layers without effects do not write this field.
    let json = serde_json::to_value(plan(&video, 1.5)).unwrap();
    assert!(json["layers"][0].get("effects").is_none());
}

#[test]
fn crop_is_folded_into_the_source_rect() {
    let video = fixture();
    let land_b = plan(&video, 4.0).layers.into_iter().find(|l| l.item_id == "item_land_b").unwrap();
    // Cropping 10% from each side leaves 1536×1080, contained in a 1920×1080 frame with 192 left on each side.
    assert_eq!(land_b.source_rect, Some([0.1, 0.0, 0.9, 1.0]));
    assert_eq!(land_b.matrix, [1536.0, 0.0, 0.0, 1080.0, 192.0, 0.0]);
}

#[test]
fn ducking_lowers_the_target_and_keeps_the_unducked_gain() {
    let video = fixture();
    let hidden = |seconds: f64| {
        plan(&video, seconds)
            .voices
            .into_iter()
            .find(|v| v.item_id == "item_hidden")
            .expect("隐藏轨道照样发声")
    };
    // Music (A1) sounds from 0.5 + 1/48000 s to 3.5 + 1/48000 s. The rule lowers it 12 dB, with attack 0.25 s and release 0.5 s.
    // The ramp is linear in gain: the gain at the midpoint is the average of 1 and 10^(−12/20), about −4.07 dB (not half of the dB value, −6).
    let start = 0.5 + 1.0 / 48000.0;
    let base = db(0.5);
    let mid_db = 20.0 * ((1.0 + 10f64.powf(-12.0 / 20.0)) / 2.0).log10();
    assert_eq!((hidden(0.0).gain_db, hidden(0.0).unducked_gain_db), (base, None));
    let mid_attack = hidden(start - 0.125);
    assert!((mid_attack.gain_db - (base + mid_db)).abs() < 0.05, "{}", mid_attack.gain_db);
    assert_eq!((hidden(2.0).gain_db, hidden(2.0).unducked_gain_db), (base - 12.0, Some(base)));
    let mid_release = hidden(start + 3.0 + 0.25);
    assert!((mid_release.gain_db - (base + mid_db)).abs() < 0.05, "{}", mid_release.gain_db);
    assert_eq!(hidden(4.5).unducked_gain_db, None);
    // The triggering side is not itself lowered.
    let music = plan(&video, 2.0).voices.into_iter().find(|v| v.item_id == "item_music").unwrap();
    assert_eq!((music.gain_db, music.unducked_gain_db), (db(0.5), None));

    // Envelope breakpoints: rise, hold, fall. The ramp is baked into breakpoints no more than 0.02 s apart, matching the per-frame values.
    let sequence = &video.sequences["seq_main"];
    let item = sequence.items.iter().find(|i| i.base().id == "item_hidden").unwrap();
    let envelope = DuckingEnvelope::for_item(sequence, item, sequence.header.fps).unwrap();
    let knots = envelope.knots();
    let first = knots.first().unwrap();
    let last = knots.last().unwrap();
    assert!((first.0 - (start - 0.25)).abs() < 1e-12 && first.1 == 0.0);
    assert!((last.0 - (start + 3.5)).abs() < 1e-12 && last.1 == 0.0);
    let top = knots.iter().find(|k| (k.0 - start).abs() < 1e-12).expect("触发开始处有折点");
    assert!((top.1 - 12.0).abs() < 1e-9);
    assert!(knots.windows(2).all(|w| w[1].0 - w[0].0 <= 0.02 + 1e-9 || w[0].1 == w[1].1));
    for (t, db) in &knots {
        assert_eq!(envelope.reduction_db(*t), *db);
    }
}

#[test]
fn new_element_kinds_are_generators_or_reported_never_blank() {
    // Hand-drawn, template stickers and waveforms are generators. The whiteboard is decoded from its image asset; the reveal is drawn by the backend from instance fields.
    let text = std::fs::read_to_string(fixture_path("video.json")).expect("read video fixture");
    let mut value: serde_json::Value = serde_json::from_str(&text).expect("JSON");
    let base = |id: &str, extra: serde_json::Value| {
        let mut item = serde_json::json!({
            "id": id, "trackId": "trk_g1", "enabled": true, "locked": false, "paintOrder": 10,
            "followPolicy": { "kind": "sequence-fixed" }, "span": { "fromFrame": 0, "durationFrames": 30 },
            "place": { "x": 50, "y": 50, "w": 20 },
        });
        for (k, v) in extra.as_object().unwrap() {
            item[k] = v.clone();
        }
        item
    };
    let items = value["sequences"]["seq_main"]["items"].as_array_mut().unwrap();
    items.push(base(
        "new_wave",
        serde_json::json!({ "type": "visualizer", "visualizer": { "style": "bars" } }),
    ));
    items.push(base(
        "new_draw",
        serde_json::json!({ "type": "draw", "draw": { "brush": "round", "color": "#FFFFFF", "size": 4 } }),
    ));
    items.push(base(
        "new_board",
        serde_json::json!({ "type": "whiteboard", "assetRef": { "id": "asset_logo", "revision": "rev_1" }, "whiteboard": {} }),
    ));
    items.push(base(
        "new_sticker",
        serde_json::json!({ "type": "sticker", "sticker": { "source": "template", "templateId": "star" } }),
    ));
    items.push(base(
        "new_slot",
        serde_json::json!({ "type": "placeholder", "placeholder": { "variant": "camera" } }),
    ));
    items.push(base(
        "new_slot_filled",
        serde_json::json!({ "type": "placeholder", "placeholder": { "variant": "media" },
            "assetRef": { "id": "asset_logo", "revision": "rev_1" } }),
    ));
    value["sequences"]["seq_main"]["template"] = serde_json::json!({
        "id": "tpl", "name": "条",
        "layers": [
            { "id": "tpl_bar", "box": { "x": 0, "y": 95, "w": 100, "h": 5 }, "kind": "progress", "accent": "#FF0000", "track": "#000000" },
            { "id": "tpl_off", "on": false, "box": { "x": 0, "y": 0, "w": 10, "h": 10 }, "kind": "text", "text": "x", "color": "#FFFFFF" },
        ],
    });
    let video: VideoSnapshot = serde_json::from_value(value).expect("视频快照");
    let plan = plan(&video, 0.5);
    let kind = |id: &str| {
        let l = layer(&plan, id);
        match &l.content {
            Some(LayerContent::Generator { generator, .. }) => (l.kind, generator.clone()),
            Some(LayerContent::Unsupported { reason }) => (l.kind, reason.clone()),
            other => panic!("{id}: {other:?}"),
        }
    };
    assert_eq!(kind("new_wave"), (LayerKind::Generator, "cuccut.audio-visualizer".into()));
    assert_eq!(kind("new_sticker"), (LayerKind::Generator, "cuccut.sticker".into()));
    assert_eq!(kind("new_draw"), (LayerKind::Generator, "cuccut.draw".into()));
    let board = layer(&plan, "new_board");
    assert_eq!(board.kind, LayerKind::Image);
    assert_eq!(board.asset.as_ref().map(|a| a.id.as_str()), Some("asset_logo"));
    // Placeholder frame: an empty frame shows the empty placeholder look; one with an image asset filled in is decoded from the image.
    assert_eq!(kind("new_slot"), (LayerKind::Generator, "cuccut.placeholder".into()));
    let filled = layer(&plan, "new_slot_filled");
    assert_eq!(
        (filled.kind, filled.asset.as_ref().map(|a| a.id.as_str())),
        (LayerKind::Image, Some("asset_logo"))
    );
    // Template layer: an open layer is a generator and sits on top; a closed layer has none.
    assert_eq!(kind("tpl_bar"), (LayerKind::Generator, "cuccut.template".into()));
    assert_eq!(plan.layers.last().map(|l| l.item_id.as_str()), Some("tpl_bar"));
    assert!(plan.layers.iter().all(|l| l.item_id != "tpl_off"));
}

#[test]
fn chapters_are_not_in_the_plan() {
    let video = fixture();
    assert!(!video.sequences["seq_main"].markers.is_empty());
    let json = serde_json::to_string(&plan(&video, 0.0)).unwrap();
    assert!(!json.contains("chap_intro"));
}

#[test]
fn golden_plans_match() {
    let video = fixture();
    let mut lines = String::new();
    for &seconds in SAMPLE_SECONDS {
        let json = serde_json::to_string(&plan(&video, seconds)).unwrap();
        lines.push_str(&format!("{seconds}\t{json}\n"));
    }
    let path = fixture_path("plan-golden.txt");
    if std::env::var_os("UPDATE_GOLDEN").is_some() {
        std::fs::write(&path, &lines).expect("写金标准");
        return;
    }
    let golden = std::fs::read_to_string(&path).expect("读金标准（第一次先用 UPDATE_GOLDEN=1 生成）");
    assert!(
        golden == lines,
        "计划与金标准不一致；规则确实改了就用 UPDATE_GOLDEN=1 重新生成并审阅差异"
    );
}
