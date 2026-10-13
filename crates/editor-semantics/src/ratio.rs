//! Overflow-checked rational numbers (video format spec §2.3 “Arithmetic”).
//!
//! Numerator and denominator are `i128`, always reduced, with a positive denominator. If any step exceeds the limit, it returns `None`, and the caller reports
//! `TIME_ARITHMETIC_OVERFLOW`; it never falls back to floating point.

use std::cmp::Ordering;
use std::fmt;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct Ratio {
    num: i128,
    den: i128,
}

/// Upper bound for numerator and denominator. Cross-multiplying two valid values (for comparison or common denominators) will not exceed `i128`.
const LIMIT: u128 = 1 << 63;

fn gcd(a: u128, b: u128) -> u128 {
    let (mut a, mut b) = (a, b);
    while b != 0 {
        (a, b) = (b, a % b);
    }
    a
}

impl Ratio {
    pub const ZERO: Ratio = Ratio { num: 0, den: 1 };
    pub const ONE: Ratio = Ratio { num: 1, den: 1 };

    /// Reduces the fraction and puts the sign on the numerator. `None` if the denominator is zero or a limit is exceeded.
    pub fn new(num: i128, den: i128) -> Option<Ratio> {
        if den == 0 {
            return None;
        }
        let g = gcd(num.unsigned_abs(), den.unsigned_abs()) as i128;
        let g = if g == 0 { 1 } else { g };
        let (mut num, mut den) = (num / g, den / g);
        if den < 0 {
            num = num.checked_neg()?;
            den = den.checked_neg()?;
        }
        if num.unsigned_abs() > LIMIT || den.unsigned_abs() > LIMIT {
            return None;
        }
        Some(Ratio { num, den })
    }

    pub fn from_int(n: i128) -> Option<Ratio> {
        Ratio::new(n, 1)
    }

    pub fn num(self) -> i128 {
        self.num
    }

    pub fn den(self) -> i128 {
        self.den
    }

    pub fn is_integer(self) -> bool {
        self.den == 1
    }

    pub fn is_negative(self) -> bool {
        self.num < 0
    }

    pub fn checked_add(self, other: Ratio) -> Option<Ratio> {
        let g = gcd(self.den as u128, other.den as u128) as i128;
        let left = self.num.checked_mul(other.den / g)?;
        let right = other.num.checked_mul(self.den / g)?;
        Ratio::new(left.checked_add(right)?, (self.den / g).checked_mul(other.den)?)
    }

    pub fn checked_sub(self, other: Ratio) -> Option<Ratio> {
        self.checked_add(Ratio {
            num: other.num.checked_neg()?,
            den: other.den,
        })
    }

    /// Cross-reduces before multiplying, to keep intermediate values from overflowing where possible.
    pub fn checked_mul(self, other: Ratio) -> Option<Ratio> {
        let g1 = gcd(self.num.unsigned_abs(), other.den as u128).max(1) as i128;
        let g2 = gcd(other.num.unsigned_abs(), self.den as u128).max(1) as i128;
        let num = (self.num / g1).checked_mul(other.num / g2)?;
        let den = (self.den / g2).checked_mul(other.den / g1)?;
        Ratio::new(num, den)
    }

    pub fn checked_div(self, other: Ratio) -> Option<Ratio> {
        if other.num == 0 {
            return None;
        }
        self.checked_mul(Ratio::new(other.den, other.num)?)
    }

    /// The largest integer not greater than it (floor).
    pub fn floor(self) -> i128 {
        self.num.div_euclid(self.den)
    }

    /// The smallest integer not less than it (ceiling).
    pub fn ceil(self) -> i128 {
        let f = self.floor();
        if self.num.rem_euclid(self.den) == 0 { f } else { f + 1 }
    }

    /// Fractional part, in [0, 1).
    pub fn fract(self) -> Ratio {
        Ratio {
            num: self.num.rem_euclid(self.den),
            den: self.den,
        }
    }

    /// Canonical text form, used for cache keys and comparison: `num/den` after reduction.
    pub fn canonical(self) -> String {
        format!("{}/{}", self.num, self.den)
    }

    /// Approximate value at the host boundary. Used only where a native number is required, such as draw or media APIs (§2.13).
    pub fn to_f64(self) -> f64 {
        self.num as f64 / self.den as f64
    }
}

impl Ord for Ratio {
    fn cmp(&self, other: &Self) -> Ordering {
        // Denominators are positive, so compare by cross-multiplying; values are all within LIMIT, so products do not exceed 2^126.
        (self.num * other.den).cmp(&(other.num * self.den))
    }
}

impl PartialOrd for Ratio {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl fmt::Display for Ratio {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if self.den == 1 {
            write!(f, "{}", self.num)
        } else {
            write!(f, "{}/{}", self.num, self.den)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reduces_and_normalizes_sign() {
        assert_eq!(Ratio::new(1500, 1000), Ratio::new(3, 2));
        assert_eq!(Ratio::new(3, -6).unwrap(), Ratio::new(-1, 2).unwrap());
        assert_eq!(Ratio::new(0, 7).unwrap(), Ratio::ZERO);
        assert!(Ratio::new(1, 0).is_none());
    }

    #[test]
    fn floor_and_ceil_round_toward_infinities() {
        let r = Ratio::new(-3, 2).unwrap();
        assert_eq!(r.floor(), -2);
        assert_eq!(r.ceil(), -1);
        assert_eq!(Ratio::new(4, 2).unwrap().ceil(), 2);
        assert_eq!(Ratio::new(-3, 2).unwrap().fract(), Ratio::new(1, 2).unwrap());
    }

    #[test]
    fn overflow_is_reported_not_wrapped() {
        let big = Ratio::new(1 << 40, 1).unwrap();
        assert!(big.checked_mul(big).is_none());
        assert!(Ratio::new(1 << 64, 1).is_none());
    }
}
