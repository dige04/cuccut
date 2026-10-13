#![cfg(target_os = "windows")]

use std::collections::HashSet;
use std::path::PathBuf;
use std::time::{Duration, Instant};

use media_native::{DxgiPlaybackState, DxgiVideoFrame, open_dxgi_frame_server};

fn fixture() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/native-export/source.mp4")
}

fn assert_send_sync<T: Send + Sync>() {}

#[test]
fn gpu_frames_can_cross_the_decoder_and_renderer_thread_boundary() {
    assert_send_sync::<DxgiVideoFrame>();
}

#[test]
fn media_engine_publishes_shareable_gpu_frames_without_a_cpu_buffer() {
    let mut server = open_dxgi_frame_server(&fixture()).expect("open IMFMediaEngine frame-server");
    assert_eq!((server.width(), server.height()), (160, 90));
    assert!(server.duration_seconds() >= 0.9);
    assert_eq!(server.playback_state().unwrap(), DxgiPlaybackState::Paused);

    server.play().expect("start playback");
    let started = Instant::now();
    let frame = loop {
        if let Some(frame) = server.try_acquire_frame().expect("query GPU frame") {
            break frame;
        }
        assert!(
            started.elapsed() < Duration::from_secs(5),
            "Media Engine published no video frame within 5 seconds"
        );
        std::thread::sleep(Duration::from_millis(5));
    };

    assert_eq!((frame.width(), frame.height()), (160, 90));
    assert!(!frame.texture_handle().is_null());
    assert!(!frame.ready_fence_handle().is_null());
    assert!(frame.ready_fence_value() > 0);
    assert!(frame.timestamp_hns() >= 0);
    assert_eq!(frame.adapter_luid(), server.adapter_luid());
    assert!(frame.surface_id() > 0);
    assert!(frame.synchronization_id() > 0);
    assert!(matches!(
        server.playback_state().unwrap(),
        DxgiPlaybackState::Playing | DxgiPlaybackState::Buffering
    ));

    server.pause().expect("pause playback");
    assert_eq!(server.playback_state().unwrap(), DxgiPlaybackState::Paused);
    server.seek(0.5).expect("seek playback");
    assert!(matches!(
        server.playback_state().unwrap(),
        DxgiPlaybackState::Paused | DxgiPlaybackState::Buffering
    ));
}

#[test]
fn the_three_surface_pool_drops_instead_of_blocking_or_reading_back() {
    let mut server = open_dxgi_frame_server(&fixture()).expect("open IMFMediaEngine frame-server");
    server.play().expect("start playback");
    let started = Instant::now();
    let mut held = Vec::new();
    while held.len() < 3 && started.elapsed() < Duration::from_secs(5) {
        if let Some(frame) = server.try_acquire_frame().expect("query GPU frame") {
            held.push(frame);
        } else {
            std::thread::sleep(Duration::from_millis(5));
        }
    }
    assert_eq!(held.len(), 3, "should fill three independent shared surface slots");
    let handles = held
        .iter()
        .map(|frame| frame.texture_handle() as usize)
        .collect::<HashSet<_>>();
    assert_eq!(handles.len(), 3, "the three slots must hold three distinct NT handles");
    let surface_ids = held
        .iter()
        .map(DxgiVideoFrame::surface_id)
        .collect::<HashSet<_>>();
    assert_eq!(surface_ids.len(), 3, "the three slots must have three stable surface ids");
    let synchronization_ids = held
        .iter()
        .map(DxgiVideoFrame::synchronization_id)
        .collect::<HashSet<_>>();
    assert_eq!(
        synchronization_ids.len(),
        1,
        "the three slots of one frame-server share a single shared fence"
    );

    let before = Instant::now();
    while server.dropped_frame_count() == 0 && before.elapsed() < Duration::from_secs(1) {
        assert!(
            server
                .try_acquire_frame()
                .expect("query GPU frame while the pool is full")
                .is_none(),
            "textures still being consumed must not be overwritten while all three surfaces are held"
        );
        std::thread::sleep(Duration::from_millis(5));
    }
    assert!(
        server.dropped_frame_count() > 0,
        "a non-blocking frame drop should be observed when the pool is full, instead of stalling the decode thread"
    );
}
