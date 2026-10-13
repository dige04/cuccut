//! System memory pressure probe (ported from v2's executor). It is asked once before MOSS inference ends and before a speaker model or aligner is loaded. If there is pressure, MOSS's weights are unloaded first, so three sets of weights do not coexist.
//! The output of this job is unchanged; the cost is that the next job has to reload (architecture design §6.6).

/// A value of `0` always reports `Normal` (an escape hatch for when the probe is untrustworthy on some machine). `warning` / `critical` force the corresponding level
/// (for diagnostics and end-to-end verification; the system is not read).
pub const PRESSURE_ENV: &str = "CUCCUT_MEMORY_PRESSURE";

/// System memory pressure level.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MemoryPressure {
    Normal,
    Warning,
    Critical,
}

/// The system's current memory pressure (macOS normal / warning / critical); always `Normal` on other platforms.
pub fn system_memory_pressure() -> MemoryPressure {
    match std::env::var(PRESSURE_ENV).as_deref() {
        Ok("0") => MemoryPressure::Normal,
        Ok("warning") => MemoryPressure::Warning,
        Ok("critical") => MemoryPressure::Critical,
        _ => read_system(),
    }
}

#[cfg(target_os = "macos")]
fn read_system() -> MemoryPressure {
    // 1 = normal，2 = warning，4 = critical。
    let mut level: libc::c_int = 0;
    let mut size = std::mem::size_of::<libc::c_int>();
    // SAFETY: the name is a NUL-terminated static string; `level` / `size` point to writable memory of matching size in this stack frame; no new value is written (newp is empty, newlen is 0).
    let status = unsafe {
        libc::sysctlbyname(
            c"kern.memorystatus_vm_pressure_level".as_ptr(),
            (&raw mut level).cast(),
            &raw mut size,
            std::ptr::null_mut(),
            0,
        )
    };
    match (status, level) {
        (0, 4..) => MemoryPressure::Critical,
        (0, 2..) => MemoryPressure::Warning,
        _ => MemoryPressure::Normal,
    }
}

/// Other platforms do not have a pressure signal yet (v2 also only had macOS). The Windows candidates are the system's own low-memory notification (`QueryMemoryResourceNotification`),
/// or thresholds set on the usage rate from `GlobalMemoryStatusEx`. Neither has been measured; see architecture design §14.
#[cfg(not(target_os = "macos"))]
fn read_system() -> MemoryPressure {
    MemoryPressure::Normal
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Without an override, reads the system: whatever it reads is one of the three levels, and it does not panic.
    #[test]
    fn reads_a_level_without_an_override() {
        if std::env::var_os(PRESSURE_ENV).is_none() {
            let level = system_memory_pressure();
            assert!(matches!(
                level,
                MemoryPressure::Normal | MemoryPressure::Warning | MemoryPressure::Critical
            ));
        }
    }
}
