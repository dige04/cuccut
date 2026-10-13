//! Backend capability profile and preflight (design §6.5).
//!
//! Preflight runs to completion **before the formal frame-by-frame rendering**. Insufficient capabilities, nonexistent effects, and unmet determinism levels all become visible diagnostics or fallback records here, rather than blowing up at frame 900.

use crate::drawop;
use anyhow::{Result, bail};
use motion::effect::{Determinism, EffectRef, lookup};
use scene_primitives::resolve::Ir;
use std::collections::BTreeSet;

/// Name and version of the CPU reference backend. The version goes into the capability fingerprint, so upgrading tiny-skia changes the frame fingerprint values wholesale, which is exactly what we want (rasterization results may change).
pub const CPU_BACKEND: &str = "cpu-tiny-skia";
pub const CPU_BACKEND_VERSION: &str = "0.11";

/// Upper bound on the side length of a single surface. Comfortably covers 4K, and guards against pathological values in hand-written JSON.
pub const DEFAULT_MAX_SURFACE: u32 = 16384;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CapabilityProfile {
    pub backend: String,
    pub backend_version: String,
    /// Capability names the backend declares support for (the `capabilities` of an effect manifest are intersected with these).
    pub features: BTreeSet<String>,
    pub max_surface: u32,
    /// Minimum determinism level allowed into formal export.
    pub determinism_floor: Determinism,
}

impl CapabilityProfile {
    /// tiny-skia CPU reference: strict-only, no extension capabilities.
    pub fn cpu_reference() -> Self {
        CapabilityProfile {
            backend: CPU_BACKEND.to_owned(),
            backend_version: CPU_BACKEND_VERSION.to_owned(),
            features: BTreeSet::new(),
            max_surface: DEFAULT_MAX_SURFACE,
            determinism_floor: Determinism::Strict,
        }
    }

    pub fn supports(&self, feature: &str) -> bool {
        self.features.contains(feature)
    }

    /// Capability profile fingerprint. It goes into the FramePlan and every surface's fingerprint, so switching backends necessarily changes the frame fingerprints.
    pub fn fingerprint(&self) -> u64 {
        let mut bytes = Vec::with_capacity(64);
        bytes.extend_from_slice(&(self.backend.len() as u32).to_le_bytes());
        bytes.extend_from_slice(self.backend.as_bytes());
        bytes.extend_from_slice(&(self.backend_version.len() as u32).to_le_bytes());
        bytes.extend_from_slice(self.backend_version.as_bytes());
        bytes.extend_from_slice(&(self.features.len() as u32).to_le_bytes());
        for feature in &self.features {
            bytes.extend_from_slice(&(feature.len() as u32).to_le_bytes());
            bytes.extend_from_slice(feature.as_bytes());
        }
        bytes.extend_from_slice(&self.max_surface.to_le_bytes());
        bytes.push(self.determinism_floor.code());
        drawop::fnv1a64(&bytes)
    }
}

/// A downgrade that was applied (or rejected).
#[derive(Debug, Clone, PartialEq)]
pub struct FallbackRecord {
    pub effect: EffectRef,
    /// Reason code that triggered the downgrade (`effect-capability-unsupported` / `effect-unknown`…).
    pub reason: String,
    /// The effect actually substituted; `None` = no effect-level downgrade.
    pub applied: Option<EffectRef>,
    /// Specific to Surface Transition: the name of the **Motion Transition** recipe the downgrade lands on (spec §9). A transition's downgrade target is the property tracks of both clips, not another effect, so it cannot be put into `applied`.
    pub applied_preset: Option<String>,
    pub determinism: Determinism,
}

/// One preflight diagnostic. `rule` is the code from spec §16, from the same table as `ccut lint`.
#[derive(Debug, Clone, PartialEq)]
pub struct PreflightDiagnostic {
    pub rule: &'static str,
    pub message: String,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct PreflightReport {
    pub fallbacks: Vec<FallbackRecord>,
    /// Diagnostics (these enter the `diagnostics` of `ccut render --json` / `ccut ops`).
    pub diagnostics: Vec<PreflightDiagnostic>,
    /// The **actual** determinism level of this render: the weakest level among all effects.
    pub determinism: Determinism,
}

impl PreflightReport {
    /// A record with no usable downgrade.
    pub fn is_ok(&self) -> bool {
        self.fallbacks
            .iter()
            .all(|record| record.applied.is_some() || record.applied_preset.is_some())
    }
}

/// One-time check before frame-by-frame rendering (design §6.5).
///
/// Three layers: ① the canvas size falls within the backend's `max_surface`; ② every effect in the document can run on the **current backend** (version registered, capabilities complete, has a CPU implementation); if not, it is downgraded per the manifest's `fallback` and recorded, and with no fallback it is a hard error; ③ the local canvas size constraints of effect elements. **It must not discover halfway through rendering that the backend does not support something.**
pub fn preflight(ir: &Ir, caps: &CapabilityProfile) -> Result<PreflightReport> {
    let width = ir.w.round().max(0.0) as u64;
    let height = ir.h.round().max(0.0) as u64;
    if width == 0 || height == 0 {
        bail!("preflight: 画布尺寸非法 {width}x{height}");
    }
    if width > u64::from(caps.max_surface) || height > u64::from(caps.max_surface) {
        bail!(
            "effect-capability-unsupported: 画布 {width}x{height} 超出后端 {} 的 surface 上限 {}",
            caps.backend,
            caps.max_surface
        );
    }
    fn check_local(node: &scene_primitives::RNode, caps: &CapabilityProfile) -> Result<()> {
        if let Some(canvas) = &node.composition
            && (canvas.width > caps.max_surface as f64 || canvas.height > caps.max_surface as f64)
        {
            bail!(
                "effect-capability-unsupported: 子合成 {} 超出 surface 上限 {}",
                node.id,
                caps.max_surface
            );
        }
        for child in &node.children {
            check_local(child, caps)?;
        }
        Ok(())
    }
    for clip in &ir.visual_clips {
        check_local(&clip.tree, caps)?;
    }
    // v2 as-is; newer clippy makes `never_loop` deny, so this only allows it and the code is left unchanged.
    #[allow(clippy::never_loop)]
    for conflict in super::EffectTopology::conflicts(ir) {
        bail!("{conflict}");
    }
    let topology = super::EffectTopology::of(ir);
    let mut report = preflight_effects(&topology.effects, caps)?;
    preflight_transitions(ir, caps, &mut report);
    Ok(report)
}

/// Preflight for Surface Transitions (spec §9).
///
/// Unlike effects, a transition's downgrade target is the **property tracks of both clips** (`fallback_out` / `fallback_in`, computed at resolve time), so this never hard-errors: any transition that cannot run can fall back to its Motion version. It returns a **downgrade list** (keyed by the id of `from_clip`), and the recorder chooses its path according to it.
pub fn preflight_transitions(
    ir: &Ir,
    caps: &CapabilityProfile,
    report: &mut PreflightReport,
) -> BTreeSet<String> {
    let mut degraded = BTreeSet::new();
    for entry in &ir.surface_transitions {
        let (reason, determinism) = match lookup(&entry.effect.id, entry.effect.version) {
            Err(error) => (error.to_string(), Determinism::Strict),
            Ok(manifest) => {
                let missing: Vec<&str> = manifest
                    .capabilities
                    .iter()
                    .map(String::as_str)
                    .filter(|feature| !caps.supports(feature))
                    .collect();
                if !missing.is_empty() {
                    (
                        format!("后端 {} 缺能力 {missing:?}", caps.backend),
                        manifest.determinism,
                    )
                } else if !crate::effects::kernel_is_implemented(&manifest.kernel) {
                    (
                        format!("内核 {} 没有 CPU reference 实现", manifest.kernel),
                        manifest.determinism,
                    )
                } else if manifest.determinism > caps.determinism_floor {
                    (
                        format!(
                            "确定性等级 {} 低于本次导出的下限 {}",
                            manifest.determinism.as_str(),
                            caps.determinism_floor.as_str()
                        ),
                        manifest.determinism,
                    )
                } else {
                    report.determinism = report.determinism.max(manifest.determinism);
                    continue;
                }
            }
        };
        degraded.insert(entry.from_clip.clone());
        report.fallbacks.push(FallbackRecord {
            effect: entry.effect.clone(),
            reason: format!("transition-fallback-applied: {reason}"),
            applied: None,
            applied_preset: Some(entry.fallback.clone()),
            determinism,
        });
        report.diagnostics.push(PreflightDiagnostic {
            rule: "transition-fallback-applied",
            message: format!(
                "剪辑点 {} → {} 的 {} 已降级为 Motion Transition \"{}\"（{reason}，§9）",
                entry.from_clip,
                entry.to_clip,
                entry.effect.qualified(),
                entry.fallback
            ),
        });
    }
    degraded
}

/// Preflight for a group of effect references. BCF documents go through [`preflight`]; the Product Timeline's overlays pass the lowered references directly here, so both routes use the same set of checks.
pub fn preflight_effects(
    effects: &[EffectRef],
    caps: &CapabilityProfile,
) -> Result<PreflightReport> {
    let mut report = PreflightReport::default();
    for effect in effects {
        resolve_one(effect, caps, &mut report, 0)?;
    }
    Ok(report)
}

/// Availability check for a single effect. `depth` guards against `fallback` chains that form a cycle in the manifest.
fn resolve_one(
    effect: &EffectRef,
    caps: &CapabilityProfile,
    report: &mut PreflightReport,
    depth: usize,
) -> Result<()> {
    if depth > 4 {
        bail!(
            "effect-capability-unsupported: {} 的 fallback 链过深（疑似成环）",
            effect.qualified()
        );
    }
    let manifest = match lookup(&effect.id, effect.version) {
        Ok(manifest) => manifest,
        Err(error) => bail!("{error}"),
    };
    let missing: Vec<&str> = manifest
        .capabilities
        .iter()
        .map(String::as_str)
        .filter(|feature| !caps.supports(feature))
        .collect();
    let unimplemented = !crate::effects::kernel_is_implemented(&manifest.kernel);
    let too_loose = manifest.determinism > caps.determinism_floor;
    if missing.is_empty() && !unimplemented && !too_loose {
        report.determinism = report.determinism.max(manifest.determinism);
        if manifest.determinism != Determinism::Strict {
            report.diagnostics.push(PreflightDiagnostic {
                rule: "effect-determinism-visual",
                message: format!(
                    "{} 的确定性等级是 {}，成片不承诺逐位一致（§14.6）",
                    manifest.qualified(),
                    manifest.determinism.as_str()
                ),
            });
        }
        return Ok(());
    }
    let reason = if !missing.is_empty() {
        format!("后端 {} 缺能力 {missing:?}", caps.backend)
    } else if unimplemented {
        format!("内核 {} 没有 CPU reference 实现", manifest.kernel)
    } else {
        format!(
            "确定性等级 {} 低于本次导出的下限 {}",
            manifest.determinism.as_str(),
            caps.determinism_floor.as_str()
        )
    };
    let Some(fallback) = manifest.fallback.clone() else {
        report.fallbacks.push(FallbackRecord {
            effect: effect.clone(),
            reason: format!("effect-capability-unsupported: {reason}"),
            applied: None,
            applied_preset: None,
            determinism: manifest.determinism,
        });
        bail!(
            "effect-capability-unsupported: {} 无法在当前后端执行（{reason}），manifest 也没有 fallback（§6.6）",
            manifest.qualified()
        );
    };
    report.fallbacks.push(FallbackRecord {
        effect: effect.clone(),
        reason: format!("effect-fallback-applied: {reason}"),
        applied: Some(fallback.clone()),
        applied_preset: None,
        determinism: manifest.determinism,
    });
    report.diagnostics.push(PreflightDiagnostic {
        rule: "effect-fallback-applied",
        message: format!(
            "{} 已按 manifest 降级为 {}（{reason}，§14.6）",
            manifest.qualified(),
            fallback.qualified()
        ),
    });
    resolve_one(&fallback, caps, report, depth + 1)
}
