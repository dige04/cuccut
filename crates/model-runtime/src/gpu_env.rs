//! `CUCCUT_GPU` switch (ported from v2's `CCUT_GPU`): one environment variable constrains all non-Apple GPU inference paths (candle CUDA, and the ggml CUDA / Vulkan paths of Whisper).
//!
//! When a driver misbehaves, users need an escape hatch that forces CPU without changing the build. The GPU paths share one name, so the docs only need to explain it once.

/// Name of the environment variable that forces CPU.
pub const GPU_ENV: &str = "CUCCUT_GPU";

/// Whether `CUCCUT_GPU` explicitly turns off GPU inference (`off` / `0` / `false` / `cpu` / `no`, case-insensitive).
pub fn gpu_disabled_by_env() -> bool {
    gpu_disabled_by_value(std::env::var(GPU_ENV).ok().as_deref())
}

pub fn gpu_disabled_by_value(value: Option<&str>) -> bool {
    matches!(
        value.map(|v| v.trim().to_ascii_lowercase()).as_deref(),
        Some("off" | "0" | "false" | "cpu" | "no")
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gpu_env_values() {
        for value in ["off", "0", "false", "cpu", "no", " OFF "] {
            assert!(gpu_disabled_by_value(Some(value)), "{value}");
        }
        for value in ["on", "1", "auto", ""] {
            assert!(!gpu_disabled_by_value(Some(value)), "{value}");
        }
        assert!(!gpu_disabled_by_value(None));
    }
}
