//! Deterministic randomness (spec §7.3).
//!
//! **splitmix64 is the only PRNG for new recipes.** The published `timeline.loop.jitter@1` keeps using `loop_kernel::noise_hash` (murmur3-finalizer style, default seed 17). ADR-M08 says published recipes are frozen, and changing it would move pixels in old projects. New recipes and the `noise` op of `animate.flow` all use splitmix64, with default seed **0** (spec §7.3: when the seed is omitted, a compile-time fixed default is used, rather than taking a random source at runtime).
//!
//! This module has no hidden state: every entry point is a pure function of `(seed, index) → value`, so out-of-order and sequential sampling are bit-identical.

/// The splitmix64 of spec §7.3: a 64-bit state advancer that gives the same result on all platforms.
///
/// Reference implementation (Vigna, public domain): `state += GOLDEN; z = state;
/// z = (z ^ (z >> 30)) * C1; z = (z ^ (z >> 27)) * C2; return z ^ (z >> 31)`.
pub fn splitmix64(state: &mut u64) -> u64 {
    *state = state.wrapping_add(0x9E37_79B9_7F4A_7C15);
    let mut z = *state;
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    z ^ (z >> 31)
}

/// `(seed, index)` → `[0, 1)`. `index` is the lattice point index and may be negative.
pub fn splitmix64_unit(seed: u64, index: i64) -> f64 {
    let mut state = seed ^ (index as u64).wrapping_mul(0x9E37_79B9_7F4A_7C15);
    let bits = splitmix64(&mut state);
    // Take the high 53 bits → the double-precision mantissa width, mapped to [0, 1).
    (bits >> 11) as f64 / (1u64 << 53) as f64
}

/// `(seed, index)` → `[-1, 1)`。
pub fn splitmix64_signed(seed: u64, index: i64) -> f64 {
    splitmix64_unit(seed, index) * 2.0 - 1.0
}

/// Lattice noise vertex values (`splitmix64-v1`).
///
/// Two contracts shared with `lattice-murmur-v1` ([`crate::loop_kernel::noise_hash`]):
/// vertices are taken modulo `lattice` ⇒ one period joins end to end (seamless loop); **vertex 0 is pinned to 0** ⇒ the value at phase 0 is always 0, so when the noise track is used as an `add` channel it starts from the identity and does not jump at the moment of entry.
pub fn splitmix64_lattice(seed: u64, index: i64, lattice: i64) -> f64 {
    let index = index.rem_euclid(lattice.max(1));
    if index == 0 {
        return 0.0;
    }
    splitmix64_signed(seed, index)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The first 8 outputs of Vigna's reference implementation for seed 0 (ports in other languages are commonly cross-checked against it).
    #[test]
    fn splitmix64_matches_the_reference_vector_for_seed_zero() {
        let mut state = 0u64;
        let got: Vec<u64> = (0..8).map(|_| splitmix64(&mut state)).collect();
        assert_eq!(
            got,
            vec![
                0xE220_A839_7B1D_CDAF,
                0x6E78_9E6A_A1B9_65F4,
                0x06C4_5D18_8009_454F,
                0xF88B_B8A8_724C_81EC,
                0x1B39_896A_51A8_749B,
                0x53CB_9F0C_747E_A2EA,
                0x2C82_9ABE_1F45_32E1,
                0xC584_133A_C916_AB3C,
            ]
        );
    }

    #[test]
    fn unit_and_signed_stay_in_range_and_are_deterministic() {
        for index in -64..64 {
            let unit = splitmix64_unit(7, index);
            assert!((0.0..1.0).contains(&unit), "index={index} unit={unit}");
            let signed = splitmix64_signed(7, index);
            assert!((-1.0..1.0).contains(&signed), "index={index}");
            assert_eq!(signed, splitmix64_signed(7, index));
        }
    }

    #[test]
    fn lattice_wraps_and_pins_vertex_zero() {
        assert_eq!(splitmix64_lattice(0, 0, 8), 0.0);
        assert_eq!(splitmix64_lattice(0, 8, 8), 0.0);
        assert_eq!(splitmix64_lattice(0, -8, 8), 0.0);
        assert_eq!(splitmix64_lattice(3, 1, 8), splitmix64_lattice(3, 9, 8));
        assert_ne!(splitmix64_lattice(3, 1, 8), splitmix64_lattice(4, 1, 8));
    }

    /// Different seeds must give different sequences (otherwise "same seed, same output" would be an empty claim).
    #[test]
    fn different_seeds_give_different_sequences() {
        let a: Vec<f64> = (1..16).map(|i| splitmix64_signed(0, i)).collect();
        let b: Vec<f64> = (1..16).map(|i| splitmix64_signed(1, i)).collect();
        assert_ne!(a, b);
    }
}
