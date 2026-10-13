//! Easing vocabulary (spec Appendix A, closed enum), formula-for-formula consistent with the JS / Swift prototypes.
//!
//! The implementation has moved into [`motion::curve`] (stage 1, design §10): `ccut-core` and `ccut-timeline` share the same table and the same function bodies, and only a compatibility re-export is kept here. **Do not** write a local copy back into this crate.

pub use motion::curve::{EASE_NAMES, apply_ease};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn endpoints() {
        for name in EASE_NAMES {
            let e0 = apply_ease(Some(name), 0.0);
            let e1 = apply_ease(Some(name), 1.0);
            assert!(e0.abs() < 1e-9, "{name}(0) = {e0}");
            assert!((e1 - 1.0).abs() < 1e-9, "{name}(1) = {e1}");
        }
    }

    #[test]
    fn known_values() {
        assert!((apply_ease(Some("easeOutCubic"), 0.5) - 0.875).abs() < 1e-12);
        assert!((apply_ease(Some("easeInOutQuad"), 0.5) - 0.5).abs() < 1e-12);
        // easeOutBack overshoots 1
        assert!(apply_ease(Some("easeOutBack"), 0.7) > 1.0);
    }

    #[test]
    fn unknown_names_still_fall_back_to_identity() {
        // The GPUI / Mac kernel falls back to easeOutCubic; the core side keeps identity (plan §4.5).
        assert_eq!(apply_ease(Some("magic-spring"), 0.37), 0.37);
        assert_eq!(apply_ease(None, 0.37), 0.37);
    }
}
