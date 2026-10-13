//! Wire shapes carried over from v2 `ccut-protocol`.
//!
//! v2's `ccut-timeline` depends on the whole protocol crate, but actually uses only three parts: the shape and validation of the template layer document ([`template`]), the brand types that watermark conversion reads ([`brand`]), and the version constants of `timeline.json` ([`versions`]). This crate does not port `ccut-protocol`; these three parts are taken over as internal modules as-is, with paths kept one-to-one: `protocol::<module>::<name>` corresponds to v2's `ccut_protocol::<module>::<name>`.

pub mod brand;
pub mod template;
pub mod versions;
