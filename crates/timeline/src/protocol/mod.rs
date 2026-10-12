//! 从 v2 `ccut-protocol` 收进来的线上形状。
//!
//! v2 的 `ccut-timeline` 依赖整个协议 crate，实际只用到三块：模板层文档的形状与校验
//! （[`template`]）、水印换算要读的品牌类型（[`brand`]）与 `timeline.json` 的版本常量
//! （[`versions`]）。本 crate 不移植 `ccut-protocol`，这三块原样收成内部模块，路径保持
//! `protocol::<模块>::<名字>` 与 v2 的 `ccut_protocol::<模块>::<名字>` 一一对应。

pub mod brand;
pub mod template;
pub mod versions;
