//! Surface-level cache (design §6.6). Key = surface content fingerprint.
//!
//! Both a frame-count and a byte **dual limit**: one 1080p frame is 8.3 MB and one 4K frame is 33 MB, so limiting only by frame count would keep several hundred MB resident at high resolution. Hit counts are surfaced to `RenderStats.reused_surfaces`.

use std::collections::VecDeque;
use std::sync::Arc;
use std::sync::Mutex;
use std::sync::atomic::{AtomicUsize, Ordering};
use tiny_skia::Pixmap;

/// Default byte limit: 128 MB (about 15 at 1080p, about 3 at 4K).
pub const DEFAULT_SURFACE_CACHE_BYTES: usize = 128 << 20;

pub struct SurfaceCache {
    entries: Mutex<VecDeque<(u64, Arc<Pixmap>)>>,
    frame_cap: usize,
    byte_cap: usize,
    hits: AtomicUsize,
}

impl SurfaceCache {
    pub fn new(frame_cap: usize, byte_cap: usize) -> Self {
        SurfaceCache {
            entries: Mutex::new(VecDeque::new()),
            frame_cap: frame_cap.max(1),
            byte_cap: byte_cap.max(1),
            hits: AtomicUsize::new(0),
        }
    }

    /// Typical capacity for the intermediate products on both sides of a transition and in an effect chain.
    pub fn with_frame_cap(frame_cap: usize) -> Self {
        SurfaceCache::new(frame_cap, DEFAULT_SURFACE_CACHE_BYTES)
    }

    pub fn get(&self, key: u64) -> Option<Arc<Pixmap>> {
        let entries = self.entries.lock().unwrap();
        let hit = entries
            .iter()
            .find(|(k, _)| *k == key)
            .map(|(_, value)| value.clone());
        if hit.is_some() {
            self.hits.fetch_add(1, Ordering::Relaxed);
        }
        hit
    }

    pub fn put(&self, key: u64, value: Arc<Pixmap>) {
        let bytes = pixmap_bytes(&value);
        let mut entries = self.entries.lock().unwrap();
        if entries.iter().any(|(k, _)| *k == key) {
            return;
        }
        if bytes > self.byte_cap {
            return; // A single entry exceeds the budget: do not cache it, and do not evict all existing entries either
        }
        entries.push_back((key, value));
        let mut total: usize = entries.iter().map(|(_, v)| pixmap_bytes(v)).sum();
        while entries.len() > self.frame_cap || (total > self.byte_cap && entries.len() > 1) {
            if let Some((_, dropped)) = entries.pop_front() {
                total -= pixmap_bytes(&dropped);
            } else {
                break;
            }
        }
    }

    pub fn hits(&self) -> usize {
        self.hits.load(Ordering::Relaxed)
    }

    pub fn len(&self) -> usize {
        self.entries.lock().unwrap().len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn bytes(&self) -> usize {
        self.entries
            .lock()
            .unwrap()
            .iter()
            .map(|(_, value)| pixmap_bytes(value))
            .sum()
    }
}

fn pixmap_bytes(pixmap: &Pixmap) -> usize {
    pixmap.width() as usize * pixmap.height() as usize * 4
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pixmap(size: u32) -> Arc<Pixmap> {
        Arc::new(Pixmap::new(size, size).unwrap())
    }

    #[test]
    fn frame_cap_evicts_oldest() {
        let cache = SurfaceCache::new(2, DEFAULT_SURFACE_CACHE_BYTES);
        cache.put(1, pixmap(4));
        cache.put(2, pixmap(4));
        cache.put(3, pixmap(4));
        assert_eq!(cache.len(), 2);
        assert!(cache.get(1).is_none());
        assert!(cache.get(3).is_some());
        assert_eq!(cache.hits(), 1);
    }

    #[test]
    fn byte_cap_evicts_before_frame_cap() {
        // Each 8×8 is 256 bytes; limit 600 bytes ⇒ at most 2 entries.
        let cache = SurfaceCache::new(64, 600);
        cache.put(1, pixmap(8));
        cache.put(2, pixmap(8));
        cache.put(3, pixmap(8));
        assert_eq!(cache.len(), 2);
        assert!(cache.bytes() <= 600);
    }

    #[test]
    fn oversized_entry_is_not_cached_and_does_not_evict() {
        let cache = SurfaceCache::new(4, 600);
        cache.put(1, pixmap(8));
        cache.put(2, pixmap(64)); // 16KB > 600
        assert_eq!(cache.len(), 1);
        assert!(cache.get(1).is_some());
    }
}
