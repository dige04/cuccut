//! Pure functions in `check` reports that do not depend on project state.
//!
//! Ported from `flows/check.rs` in CucCut v2 `ccut-engine`. There, `check_verdict` reads `transcript.json`, `timeline.json` and `ai/*.json`, and writes `checks/check-*.json`. Its lint codes are string literals in its verdict branches, with no separate definition table. `cps_bad`, `read_polish_fallback_records` and the output envelope `run_check`, which are used only by it, are not in this crate. `place_out_of_canvas`, which depends on the timeline schema, lives in `check` in `subtitle-render`. Only [`align_metrics_summary_lines`], which summarizes the report JSON, is carried here. The per-stage answer lints (`lint_agent_answer_*`, [`crate::language_quality`], and the `Problem` / `Warning` codes of the carrier) already live in this crate.

use serde_json::Value;

pub fn align_metrics_summary_lines(report: &Value) -> Vec<String> {
    let Some(table) = report["alignMetrics"].as_object() else {
        return Vec::new();
    };
    let pct =
        |value: &Value| -> String { format!("{:.0}%", value.as_f64().unwrap_or(0.0) * 100.0) };
    table
        .iter()
        .filter(|(_, metrics)| metrics["aligned"].as_u64().unwrap_or(0) > 0)
        .map(|(lang, metrics)| {
            format!(
                "align {lang}: {}/{} 句已对齐 · 覆盖 源 {} / 译 {} · 安全边界 {} · 整句对应 {} · 改写 {} · 弱块 {} · 局部乱序 {} · 意思未核对",
                metrics["aligned"],
                metrics["sentences"],
                pct(&metrics["coverageSrc"]),
                pct(&metrics["coverageTgt"]),
                pct(&metrics["safeBoundaryRatio"]),
                pct(&metrics["sentenceDegradeRate"]),
                pct(&metrics["rewriteRate"]),
                pct(&metrics["weakBlockRate"]),
                pct(&metrics["crossingRate"]),
            )
        })
        .collect()
}
