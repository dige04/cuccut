//! Fallback report for the GPU backend (element plan §8.7, last line / ADR-M05).
//!
//! There is only one rule: **the GPU is only an accelerator; if it cannot run, fall back to CPU**. There are five forms of failing to
//! run, and all of them become structured records here rather than a single `eprintln!`.
//!
//! ## Why it does not go into `PreflightReport` for now
//!
//! The `fallbacks[]` **envelope** of motion document §6.5 (the externally visible fields of `ccut render --json` and the serve task
//! envelope) does not exist yet, and the `rule` field of [`super::PreflightDiagnostic`] is by definition “a code from spec §16, in the
//! same table as `ccut lint`”. Adding a new code there would trigger the `LINT_RULES` in `ccut-core/src/lint.rs` and the registration
//! obligation in format-spec §16, and would also pull in `docs/design/cli/ccut-cli-server-reference.md`. P5a's scope does **not touch
//! the CLI contract surface**, so this module is a report structure **internal to the crate**:
//!
//! * For now: `GpuExecutor` fails to start / the style has no WGSL / compilation fails ⇒ record one entry; the caller proceeds on the
//!   CPU path as usual, and the picture is unaffected;
//! * When P5b or motion stage 4 merges: map [`GpuBackendReport::records`] to `PreflightReport.fallbacks[]` and the external
//!   `fallbacks[]`, **in the same task** register the diagnostic code and update the CLI reference doc, `serve/contract.rs` and the
//!   contract tests (a hard rule in CLAUDE.md).
//!
//! This module is not gated behind the `gpu` feature: even builds without the feature must be able to express “this render did not
//! use the GPU, because the backend was not compiled in”.

use std::fmt;

use super::shader_source::ShaderDomain;

/// The reason for one fallback.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GpuFallbackReason {
    /// The binary was not built with the `gpu` feature at all.
    FeatureDisabled,
    /// The feature is present, but no adapter / device is available on this machine.
    BackendUnavailable,
    /// The style has no WGSL implementation (all 10 visualizer styles are CPU vector recipes, so they always take this path).
    ShaderMissing,
    /// WGSL compilation or pipeline creation failed.
    ShaderCompile,
    /// Packing of recipe parameters has not landed yet (the algorithm arm belongs to P5b).
    RecipeUnsupported,
    /// Fails the conformance tolerance of §8.7.
    Conformance,
    /// Error at execution time (allocation, readback, device loss…).
    Execution,
}

impl GpuFallbackReason {
    /// Stable reason code. An **internal crate** identifier, not a §16 lint code, and it does not go into any external envelope — see
    /// the module docs.
    pub fn code(self) -> &'static str {
        match self {
            GpuFallbackReason::FeatureDisabled => "gpu-feature-disabled",
            GpuFallbackReason::BackendUnavailable => "gpu-backend-unavailable",
            GpuFallbackReason::ShaderMissing => "gpu-shader-missing",
            GpuFallbackReason::ShaderCompile => "gpu-shader-compile-failed",
            GpuFallbackReason::RecipeUnsupported => "gpu-recipe-unsupported",
            GpuFallbackReason::Conformance => "gpu-conformance-failed",
            GpuFallbackReason::Execution => "gpu-execution-failed",
        }
    }
}

impl fmt::Display for GpuFallbackReason {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.code())
    }
}

/// One fallback record. `target` of `None` = the whole backend is unavailable (not specific to a style).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GpuFallbackRecord {
    pub target: Option<(ShaderDomain, String)>,
    pub reason: GpuFallbackReason,
    pub detail: String,
}

impl fmt::Display for GpuFallbackRecord {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match &self.target {
            Some((domain, style)) => {
                write!(
                    f,
                    "{}: {domain}.{style} 回退 CPU（{}）",
                    self.reason, self.detail
                )
            }
            None => write!(f, "{}: GPU 后端不可用（{}）", self.reason, self.detail),
        }
    }
}

/// GPU backend report for one render.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct GpuBackendReport {
    /// Identifier of the backend actually obtained (`"metal"` / `"vulkan"` …); `None` = did not start.
    pub backend: Option<String>,
    pub records: Vec<GpuFallbackRecord>,
}

impl GpuBackendReport {
    /// Report for when the GPU backend was not compiled in.
    pub fn feature_disabled() -> GpuBackendReport {
        GpuBackendReport {
            backend: None,
            records: vec![GpuFallbackRecord {
                target: None,
                reason: GpuFallbackReason::FeatureDisabled,
                detail: "本二进制未启用 ccut-render 的 `gpu` feature".to_owned(),
            }],
        }
    }

    /// The backend started, and **no** style fell back.
    pub fn is_fully_accelerated(&self) -> bool {
        self.backend.is_some() && self.records.is_empty()
    }

    pub fn push(
        &mut self,
        target: Option<(ShaderDomain, String)>,
        reason: GpuFallbackReason,
        detail: impl Into<String>,
    ) {
        self.records.push(GpuFallbackRecord {
            target,
            reason,
            detail: detail.into(),
        });
    }

    /// One human-readable line per entry; for the host to log (**not** the external envelope).
    pub fn lines(&self) -> Vec<String> {
        self.records
            .iter()
            .map(GpuFallbackRecord::to_string)
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_disabled_feature_reports_one_backend_level_record() {
        let report = GpuBackendReport::feature_disabled();
        assert!(!report.is_fully_accelerated());
        assert_eq!(report.records.len(), 1);
        assert_eq!(report.records[0].target, None);
        assert_eq!(
            report.records[0].reason.code(),
            "gpu-feature-disabled",
            "原因码是稳定标识"
        );
    }

    #[test]
    fn a_style_level_fallback_names_its_target() {
        let mut report = GpuBackendReport {
            backend: Some("metal".to_owned()),
            records: Vec::new(),
        };
        assert!(report.is_fully_accelerated());
        report.push(
            Some((ShaderDomain::Visualizer, "bars".to_owned())),
            GpuFallbackReason::ShaderMissing,
            "P5b 才落地",
        );
        assert!(!report.is_fully_accelerated());
        let line = &report.lines()[0];
        assert!(line.contains("visualizer.bars"), "{line}");
        assert!(line.contains("回退 CPU"), "{line}");
    }
}
