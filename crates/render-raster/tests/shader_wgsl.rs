//! Static validation of WGSL and contract cross-checking against §8 (the two acceptance points of element plan §10 P5).
//!
//! Three things:
//!
//! 1. **naga validation**: every existing assembled source in the repo passes `wgsl-in` parsing and `Validator`;
//! 2. **GLSL ES 300 translation**: the same module is lowered through naga's GLSL backend (the "automatic translation to WebGL2 via naga" of ADR-E06 becomes an executable assertion here, not just a promise);
//! 3. **§8.2 / §8.3 contract cross-check**: the declaration order of `@group(1)` in WGSL, the audio texture and sampler of `@group(2)`, and the row-semantics constants are compared line by line against the frozen table on the Rust side.
//!
//! `SHADER_SOURCES` currently holds only the 4 progress sources (14 styles). The 10 visualizer styles are CPU vector recipes with no WGSL, but their `VisualizerUniforms` / prelude contract is still cross-checked here. When GPU sound-wave recipes are added later, **only a row needs to be added to `SHADER_SOURCES`**: this file iterates the whole table, so new styles enter coverage automatically.
//!
//! ```bash
//! cd core
//! cargo test -p ccut-render --features gpu --test shader_wgsl
//! ```

#![cfg(feature = "gpu")]

use render_raster::naga;
use render_raster::plan::shader_quad::{ProgressUniforms, VisualizerUniforms};
use render_raster::plan::shader_source::{
    COMMON_WGSL, FRAGMENT_ENTRY, SHADER_SOURCES, ShaderDomain, VERTEX_ENTRY,
};
use render_raster::source::kernel::Easing;
use render_raster::source::visualizer::{AUDIO_TEXTURE_ROW_FREQ, AUDIO_TEXTURE_ROW_TIME};

/// Extract the triples `@group(g) @binding(b) var<uniform> name` from the prelude.
fn uniform_declarations(source: &str, group: u32) -> Vec<(u32, String)> {
    let needle = format!("@group({group}) @binding(");
    source
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            let rest = line.strip_prefix(&needle)?;
            let (binding, rest) = rest.split_once(')')?;
            let rest = rest.trim_start();
            let name = rest.strip_prefix("var<uniform>")?.trim_start();
            let name = name.split([' ', ':']).next()?;
            Some((binding.parse().ok()?, name.to_owned()))
        })
        .collect()
}

/// Every assembled source passes naga's parsing and full validation.
#[test]
fn every_registered_shader_passes_naga_validation() {
    assert!(
        !SHADER_SOURCES.is_empty(),
        "the registry is empty, so the include_str! path is broken"
    );
    for source in SHADER_SOURCES {
        let wgsl = source.assemble();
        if let Err(error) = render_raster::validate_wgsl(&wgsl) {
            panic!("{} failed naga validation: {error:#}", source.label());
        }
    }
}

/// The same module can be lowered to **GLSL ES 300** (the WebGL2 target).
///
/// If ADR-E06's "WGSL as single source, with naga responsible for translating to GLSL ES 300" were only a sentence, we would discover at P6, when hooking up WebGL2, that some built-in function cannot be lowered onto ES 300. This assertion moves that discovery forward to P5. Each of the two entry points is translated once, because the vertex and fragment stages expose different feature sets.
#[test]
fn every_registered_shader_translates_to_glsl_es_300() {
    for source in SHADER_SOURCES {
        let wgsl = source.assemble();
        let module = render_raster::validate_wgsl(&wgsl)
            .unwrap_or_else(|error| panic!("{}: {error:#}", source.label()));
        let info = naga::valid::Validator::new(
            naga::valid::ValidationFlags::all(),
            naga::valid::Capabilities::default(),
        )
        .validate(&module)
        .unwrap_or_else(|error| panic!("{}: {error:?}", source.label()));

        for (stage, entry) in [
            (naga::ShaderStage::Vertex, VERTEX_ENTRY),
            (naga::ShaderStage::Fragment, FRAGMENT_ENTRY),
        ] {
            let options = naga::back::glsl::Options {
                version: naga::back::glsl::Version::Embedded {
                    version: 300,
                    is_webgl: true,
                },
                ..Default::default()
            };
            let pipeline_options = naga::back::glsl::PipelineOptions {
                shader_stage: stage,
                entry_point: entry.to_owned(),
                multiview: None,
            };
            let mut out = String::new();
            let writer = naga::back::glsl::Writer::new(
                &mut out,
                &module,
                &info,
                &options,
                &pipeline_options,
                naga::proc::BoundsCheckPolicies::default(),
            );
            match writer {
                Ok(mut writer) => {
                    writer.write().unwrap_or_else(|error| {
                        panic!("{} {entry} cannot be lowered to GLSL ES 300: {error}", source.label())
                    });
                }
                Err(error) => panic!("{} {entry}: cannot create GLSL writer: {error}", source.label()),
            }
            assert!(
                out.contains("#version 300 es"),
                "{} {entry} did not lower to ES 300",
                source.label()
            );
        }
    }
}

/// The §8.2 uniform order: the WGSL declarations and the frozen Rust table are **identical line by line**.
///
/// This is the seam where "§8 is a cross-document contract" meets across the two codebases. If either side changes the order, this goes red immediately.
#[test]
fn the_wgsl_group1_declarations_match_the_frozen_tables() {
    let visualizer = uniform_declarations(ShaderDomain::Visualizer.prelude(), 1);
    let expected: Vec<(u32, String)> = VisualizerUniforms::BINDINGS
        .iter()
        .map(|(binding, name)| (*binding, (*name).to_owned()))
        .collect();
    assert_eq!(visualizer, expected, "visualizer @group(1) order");

    let progress = uniform_declarations(ShaderDomain::Progress.prelude(), 1);
    let expected: Vec<(u32, String)> = ProgressUniforms::BINDINGS
        .iter()
        .map(|(binding, name)| (*binding, (*name).to_owned()))
        .collect();
    assert_eq!(progress, expected, "progress @group(1) order");
}

/// §8.1 `@group(0)`: two transform uniforms, visible to the vertex stage.
#[test]
fn both_preludes_declare_the_same_group0() {
    for domain in [ShaderDomain::Visualizer, ShaderDomain::Progress] {
        let group0 = uniform_declarations(domain.prelude(), 0);
        assert_eq!(
            group0,
            vec![
                (0, "u_transform".to_owned()),
                (1, "u_texTransform".to_owned())
            ],
            "{domain} @group(0)"
        );
    }
}

/// The row semantics of §8.3 are also **hard-coded** in WGSL: `AUDIO_ROW_TIME == 0` and `AUDIO_ROW_FREQ == 1`, with the same values as the two Rust-side constants.
///
/// The GLSL reference implementation enables `UNPACK_FLIP_Y_WEBGL`, so its row order is reversed. This assertion is the last gate against forgetting to flip back during porting (the other two are the byte assertions in `shader_quad` and the row probe on the GPU side).
#[test]
fn the_wgsl_audio_rows_agree_with_the_frozen_constants() {
    let prelude = ShaderDomain::Visualizer.prelude();
    assert!(
        prelude.contains(&format!(
            "const AUDIO_ROW_TIME : f32 = {}.0;",
            AUDIO_TEXTURE_ROW_TIME
        )),
        "time-domain row number does not match AUDIO_TEXTURE_ROW_TIME"
    );
    assert!(
        prelude.contains(&format!(
            "const AUDIO_ROW_FREQ : f32 = {}.0;",
            AUDIO_TEXTURE_ROW_FREQ
        )),
        "frequency-domain row number does not match AUDIO_TEXTURE_ROW_FREQ"
    );
    // The two sampling helpers each read their own row; they must not be swapped.
    assert!(prelude.contains("fn sampleTemporal") && prelude.contains("vec2f(x, AUDIO_ROW_TIME)"));
    assert!(prelude.contains("fn sampleFrequency") && prelude.contains("vec2f(x, AUDIO_ROW_FREQ)"));
    // progress has no audio texture.
    assert!(!ShaderDomain::Progress.prelude().contains("u_audio"));
}

/// The easing dispatch table in `common.wgsl` uses the same encoding as Rust's [`Easing::code`].
#[test]
fn the_easing_codes_agree_between_rust_and_wgsl() {
    assert_eq!(
        [
            Easing::None.code(),
            Easing::OutQuad.code(),
            Easing::OutSine.code(),
            Easing::OutCubic.code()
        ],
        [0, 1, 2, 3]
    );
    // The thresholds of `applyEasing` are 0.5 / 1.5 / 2.5, i.e. "code 0 / 1 / 2, anything else falls to outCubic".
    let dispatch = COMMON_WGSL
        .split("fn applyEasing")
        .nth(1)
        .expect("common.wgsl must define applyEasing");
    for (threshold, easing) in [
        ("code < 0.5", "return x;"),
        ("code < 1.5", "easeOutQuad"),
        ("code < 2.5", "easeOutSine"),
    ] {
        let head = dispatch.find(threshold).expect(threshold);
        let tail = dispatch[head..].find(easing);
        assert!(
            tail.is_some() && tail.unwrap() < 60,
            "the {threshold} dispatch arm is misaligned"
        );
    }
    assert!(dispatch.contains("return easeOutCubic(x);"), "fallback arm");
}

/// Does not use WGSL's built-in `smoothstep`: `edge0 > edge1` is undefined behavior in the spec, whereas `gapCurve` is exactly a falling ramp (the CPU reference is defined for both directions).
#[test]
fn the_shaders_use_the_explicit_ramp_instead_of_the_builtin_smoothstep() {
    assert!(
        COMMON_WGSL.contains("fn ramp(edge0"),
        "common.wgsl must include its own ramp"
    );
    for source in SHADER_SOURCES {
        // A `smoothstep(...)` appearing in a comment is explaining the reference implementation, not a call.
        let code: String = source
            .assemble()
            .lines()
            .map(|line| line.split("//").next().unwrap_or(""))
            .collect::<Vec<_>>()
            .join("\n");
        assert!(
            !code.contains("smoothstep("),
            "{} uses the built-in smoothstep; the falling ramp is undefined in the spec",
            source.label()
        );
    }
}
