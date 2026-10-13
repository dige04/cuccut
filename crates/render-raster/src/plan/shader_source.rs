//! Registration and assembly of WGSL sources (element plan §8.6).
//!
//! The reference implementation assembles sources with its own preprocessor directive, `#include "wgpu/<group>/<file>.wgsl"`. CucCut does not copy that mechanism and does not add a shader preprocessor dependency. Source files are embedded in the binary with `include_str!`, and assembly is simply **string prefix concatenation**:
//!
//! ```text
//! common.wgsl  ‖  <domain>/_prelude.wgsl  ‖  <style>.wgsl
//! ```
//!
//! `common.wgsl` is pure functions with no bindings. `_prelude.wgsl` is the §8.1 / §8.2 binding surface and vertex shader of that domain. A style file contains only its fragment and its own `@group(3)` recipe struct.
//!
//! **This module is not gated behind the `gpu` feature**: builds without a GPU must also be able to run the source-consistency checks (which styles have a shader, and whether the manifest's `shader` field matches), while the naga static validation and the actual compilation do need the feature.
//!
//! ## One source per family
//!
//! `SHADER_SOURCES` is registered **by algorithm family**, not by style. The two `bar-v1` variants differ entirely in the `@group(3)` recipe uniform, and their source is identical word for word. The 14 progress styles therefore have only 4 files, and the manifest's `shader` field points to the file of the family each belongs to.
//!
//! **Visualizer has no source registry entry.** Since the 2026-09 redesign, all 10 visualizer styles are CPU vector recipes (manifest `shader: null`), so `shader_for(Visualizer, ·)` is always `None`, and the host uses the vector layer. `ShaderDomain::Visualizer` and its `_prelude.wgsl` are kept as the frozen contract of §8.1 / §8.2.
//!
//! `tests/shader_wgsl.rs` iterates over the whole table for naga validation and GLSL ES 300 transpilation. Another assertion requires that "every progress style in the registry can be looked up here", so adding a style and forgetting its row turns red immediately.

use std::fmt;

/// The domain of a shader. The `@group(1)` layouts of the two domains differ (§8.2: 8 items vs 9), so there are two preludes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum ShaderDomain {
    Visualizer,
    Progress,
}

impl ShaderDomain {
    pub fn as_str(self) -> &'static str {
        match self {
            ShaderDomain::Visualizer => "visualizer",
            ShaderDomain::Progress => "progress",
        }
    }

    /// The binding surface and vertex shader source of this domain (where §8.1 / §8.2 land). Public so that contract tests can cross-check it line by line against the Rust-side uniform table.
    pub fn prelude(self) -> &'static str {
        match self {
            ShaderDomain::Visualizer => VISUALIZER_PRELUDE,
            ShaderDomain::Progress => PROGRESS_PRELUDE,
        }
    }
}

impl fmt::Display for ShaderDomain {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Vertex entry point name (shared by both preludes).
pub const VERTEX_ENTRY: &str = "vertexMain";
/// Fragment entry point name (shared by every style source).
pub const FRAGMENT_ENTRY: &str = "fragmentMain";

/// Common pieces with no bindings.
pub const COMMON_WGSL: &str = include_str!("../../shaders/common.wgsl");
const VISUALIZER_PRELUDE: &str = include_str!("../../shaders/visualizer/_prelude.wgsl");
const PROGRESS_PRELUDE: &str = include_str!("../../shaders/progress/_prelude.wgsl");

/// One style shader source.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ShaderSource {
    pub domain: ShaderDomain,
    /// File name, identical word for word to the manifest's `shader` field.
    pub file: &'static str,
    /// The style id this source serves (the face-value id in the directory, e.g. `normal`).
    pub styles: &'static [&'static str],
    body: &'static str,
}

impl ShaderSource {
    /// `common ‖ prelude ‖ body`. A newline is added between segments, so the source files themselves do not need to end with one.
    pub fn assemble(&self) -> String {
        let mut out = String::with_capacity(
            COMMON_WGSL.len() + self.domain.prelude().len() + self.body.len(),
        );
        for part in [COMMON_WGSL, self.domain.prelude(), self.body] {
            out.push_str(part);
            if !part.ends_with('\n') {
                out.push('\n');
            }
        }
        out
    }

    /// A stable label for diagnostics, also the case name in the naga validation tests.
    pub fn label(&self) -> String {
        format!("{}/{}", self.domain.as_str(), self.file)
    }
}

macro_rules! shader {
    ($domain:expr, $dir:literal, $file:literal, [$($style:literal),+ $(,)?]) => {
        ShaderSource {
            domain: $domain,
            file: $file,
            styles: &[$($style),+],
            body: include_str!(concat!("../../shaders/", $dir, "/", $file)),
        }
    };
}

/// The shaders of the 14 progress styles, grouped by algorithm family into 4 source files.
pub const SHADER_SOURCES: &[ShaderSource] = &[
    // ── progress: 4 algorithm families, 14 styles.
    shader!(
        ShaderDomain::Progress,
        "progress",
        "normal.wgsl",
        ["normal", "rounded"]
    ),
    shader!(
        ShaderDomain::Progress,
        "progress",
        "border.wgsl",
        [
            "border",
            "reverse_border",
            "rainbow_border",
            "reverse_rainbow_border",
            "strobe_border",
            "reverse_strobe_border",
        ]
    ),
    shader!(
        ShaderDomain::Progress,
        "progress",
        "circle.wgsl",
        ["circle", "donut"]
    ),
    shader!(
        ShaderDomain::Progress,
        "progress",
        "snake.wgsl",
        ["snake", "snake_spin", "snake_rainbow", "snake_spin_rainbow"]
    ),
];

/// Looks up the source by `(domain, style id)`. Styles not yet implemented return `None`, and the host falls back to CPU on that basis.
pub fn shader_for(domain: ShaderDomain, style: &str) -> Option<&'static ShaderSource> {
    SHADER_SOURCES
        .iter()
        .find(|source| source.domain == domain && source.styles.contains(&style))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The assembled source must not contain leftover `#include` from the reference implementation. That is its preprocessor directive; CucCut uses string concatenation (§8.6).
    #[test]
    fn the_assembled_sources_carry_no_preprocessor_directives() {
        for source in SHADER_SOURCES {
            let text = source.assemble();
            // Mentioning `#include` in a comment is explaining why we don't use it; it is not a leftover.
            let code: String = text
                .lines()
                .map(|line| line.split("//").next().unwrap_or(""))
                .collect::<Vec<_>>()
                .join("\n");
            assert!(
                !code.contains("#include"),
                "{} 残留了 #include",
                source.label()
            );
            assert!(
                text.contains(&format!("fn {FRAGMENT_ENTRY}")),
                "{} 缺 fragment 入口",
                source.label()
            );
            assert!(
                text.contains(&format!("fn {VERTEX_ENTRY}")),
                "{} 缺 vertex 入口",
                source.label()
            );
        }
    }

    /// Every one of the **14 progress styles in the registry** must be findable with its source, and each source is registered only once. **None of the 10 visualizer styles can be found** (they are CPU vector recipes).
    ///
    /// This is the reverse of the next test: that one checks that a registered style really exists and the manifest points to it correctly, while this one checks that an existing style really got registered. Without this one, a new style forgotten in the table would silently fall back to CPU (`shader_for` returns `None`, which means fallback), and no test would turn red.
    #[test]
    fn every_catalogue_style_has_a_shader() {
        let mut seen: Vec<String> = Vec::new();
        for recipe in motion::preset_registry::timeline_visualizers() {
            assert!(
                shader_for(ShaderDomain::Visualizer, &recipe.id).is_none(),
                "visualizer/{} 是 CPU 矢量配方，不该有 WGSL 源",
                recipe.id
            );
        }
        for recipe in motion::preset_registry::timeline_progresses() {
            let source = shader_for(ShaderDomain::Progress, &recipe.id)
                .unwrap_or_else(|| panic!("progress/{} 没有登记 WGSL 源", recipe.id));
            seen.push(source.label());
        }
        assert_eq!(seen.len(), 14, "14 种 progress");
        seen.sort();
        seen.dedup();
        assert_eq!(
            seen.len(),
            SHADER_SOURCES.len(),
            "每份源码都至少服务一个样式"
        );

        // The same style id must not be registered in two source files.
        let mut styles: Vec<(ShaderDomain, &str)> = SHADER_SOURCES
            .iter()
            .flat_map(|source| {
                source
                    .styles
                    .iter()
                    .map(move |style| (source.domain, *style))
            })
            .collect();
        let total = styles.len();
        styles.sort();
        styles.dedup();
        assert_eq!(styles.len(), total, "样式 id 在登记表里重复了");
        assert_eq!(total, 14);
    }

    /// Every style served by each source is in the registry, and the manifest's `shader` field matches the file name word for word. This catches "the file was added but the manifest does not point to it".
    #[test]
    fn every_registered_style_matches_its_manifest_shader_field() {
        for source in SHADER_SOURCES {
            for style in source.styles {
                let declared = match source.domain {
                    // The `shader` of visualizer recipes is always `null`, so the registry should not contain them either.
                    ShaderDomain::Visualizer => None,
                    ShaderDomain::Progress => motion::preset_registry::timeline_progress(style)
                        .and_then(|recipe| recipe.progress())
                        .map(|body| body.shader.clone()),
                };
                assert_eq!(
                    declared.as_deref(),
                    Some(source.file),
                    "{}/{style} 的 manifest `shader` 字段与源文件名不一致",
                    source.domain
                );
            }
        }
    }

    #[test]
    fn the_lookup_is_keyed_by_domain_and_style() {
        // A family shares one source: both `bar-v1` variants look up the same file.
        let normal = shader_for(ShaderDomain::Progress, "normal").unwrap();
        let rounded = shader_for(ShaderDomain::Progress, "rounded").unwrap();
        assert_eq!(normal.file, rounded.file);
        assert_eq!(normal.file, "normal.wgsl");
        // Domains must not cross: progress's `normal` is not a visualizer style.
        assert!(shader_for(ShaderDomain::Visualizer, "normal").is_none());
        // Visualizer styles have no WGSL, so the host uses the vector layer for them.
        assert!(shader_for(ShaderDomain::Visualizer, "bars").is_none());
        assert!(shader_for(ShaderDomain::Progress, "bars").is_none());
        // A nonexistent style returns `None`, and the host falls back to CPU on that basis instead of getting an empty shell.
        assert!(shader_for(ShaderDomain::Progress, "zz_not_a_style").is_none());
    }
}
