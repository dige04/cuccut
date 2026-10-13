//! Parent-process watchdog (protocol spec §1): checks once at startup, then every 2 seconds checks that the parent process still exists and is still the one passed as `--parent-pid` at startup;
//! if not, it exits.
//!
//! On Unix, `getppid()` is compared: when the parent dies, this process is adopted by init/launchd and `getppid()` changes,
//! so reuse of the PID does not fool it.
//!
//! Windows has no adoption. At startup the parent is opened by PID and the handle is held for the whole run (the handle pins that one process object, so a reused PID is still recognized). At open time the creation time is also compared, since a process created later than this one cannot be the parent (the parent died before this process started and its PID was reused). After that, it watches whether the handle has become signaled (finished).
//! If it cannot be opened (process absent, wrong PID), the parent is treated as gone.
//!
//! Other platforms are not implemented; the watchdog has no effect there (stdin EOF still causes exit).

use std::time::Duration;

/// Check interval.
pub const CHECK_INTERVAL: Duration = Duration::from_secs(2);

/// The parent process is still the one from startup.
#[cfg(unix)]
pub fn parent_alive(parent_pid: u32) -> bool {
    // SAFETY: getppid takes no arguments and always succeeds.
    let actual = unsafe { libc::getppid() };
    i64::from(actual) == i64::from(parent_pid)
}

/// The parent process is still the one from startup: it can be opened, was not created after this process, and has not ended.
#[cfg(windows)]
pub fn parent_alive(parent_pid: u32) -> bool {
    windows_parent::Parent::open(parent_pid).is_some_and(|parent| parent.running() != Some(false))
}

#[cfg(not(any(unix, windows)))]
pub fn parent_alive(_parent_pid: u32) -> bool {
    true
}

/// Starts the watchdog thread. Calls `on_orphaned` when the parent is gone (it is responsible for making the process exit).
#[cfg(not(windows))]
pub fn spawn(parent_pid: u32, on_orphaned: impl FnOnce() + Send + 'static) -> std::io::Result<()> {
    std::thread::Builder::new().name("parent-watchdog".into()).spawn(move || {
        loop {
            if !parent_alive(parent_pid) {
                on_orphaned();
                return;
            }
            std::thread::sleep(CHECK_INTERVAL);
        }
    })?;
    Ok(())
}

/// Starts the watchdog thread. Calls `on_orphaned` when the parent is gone (it is responsible for making the process exit). The handle is held from startup until the thread ends.
#[cfg(windows)]
pub fn spawn(parent_pid: u32, on_orphaned: impl FnOnce() + Send + 'static) -> std::io::Result<()> {
    std::thread::Builder::new().name("parent-watchdog".into()).spawn(move || {
        if let Some(parent) = windows_parent::Parent::open(parent_pid) {
            // A failed wait (None) counts as unknown, so keep checking; only a confirmed exit leads to quitting.
            while parent.wait_for_exit(CHECK_INTERVAL) != Some(true) {}
        }
        on_orphaned();
    })?;
    Ok(())
}

#[cfg(windows)]
mod windows_parent {
    use std::ffi::c_void;
    use std::time::Duration;

    type Handle = *mut c_void;

    #[repr(C)]
    #[derive(Clone, Copy, Default)]
    struct FileTime {
        low: u32,
        high: u32,
    }

    const SYNCHRONIZE: u32 = 0x0010_0000;
    const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;
    const WAIT_OBJECT_0: u32 = 0;
    const WAIT_TIMEOUT: u32 = 0x102;

    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn OpenProcess(access: u32, inherit_handle: i32, pid: u32) -> Handle;
        fn GetCurrentProcess() -> Handle;
        fn GetProcessTimes(
            process: Handle,
            creation: *mut FileTime,
            exit: *mut FileTime,
            kernel: *mut FileTime,
            user: *mut FileTime,
        ) -> i32;
        fn WaitForSingleObject(handle: Handle, milliseconds: u32) -> u32;
        fn CloseHandle(handle: Handle) -> i32;
    }

    /// The process's creation time (100-nanosecond units since 1601); None if it cannot be read.
    fn creation_time(process: Handle) -> Option<u64> {
        let mut creation = FileTime::default();
        let mut exit = FileTime::default();
        let mut kernel = FileTime::default();
        let mut user = FileTime::default();
        // SAFETY: `process` is a valid process handle (an opened one or the current process's pseudo-handle), and the four output pointers point to FILETIMEs on this stack frame.
        let ok = unsafe { GetProcessTimes(process, &mut creation, &mut exit, &mut kernel, &mut user) };
        (ok != 0).then(|| (u64::from(creation.high) << 32) | u64::from(creation.low))
    }

    /// Handle to the opened parent process.
    pub struct Parent(Handle);

    impl Parent {
        /// Opens the parent process by PID. Returns None if the process is absent, cannot be opened, or was created after this process (the PID has been reused).
        /// If the creation time cannot be read, no judgment is made from it (better to stay alive longer than to exit by mistake).
        pub fn open(pid: u32) -> Option<Self> {
            // SAFETY: An ordinary Win32 call; on failure it returns a null pointer.
            let handle = unsafe { OpenProcess(SYNCHRONIZE | PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
            if handle.is_null() {
                return None;
            }
            let parent = Parent(handle);
            // SAFETY: GetCurrentProcess returns a pseudo-handle that does not need to be closed.
            let ours = creation_time(unsafe { GetCurrentProcess() });
            match (creation_time(parent.0), ours) {
                (Some(theirs), Some(ours)) if theirs > ours => None,
                _ => Some(parent),
            }
        }

        /// Waits for it to finish, for at most `timeout`: `Some(true)` if it has finished, `Some(false)` if still running, None if the wait failed.
        pub fn wait_for_exit(&self, timeout: Duration) -> Option<bool> {
            let millis = u32::try_from(timeout.as_millis()).unwrap_or(u32::MAX - 1);
            // SAFETY: The handle is owned by this object and stays valid until Drop; it has SYNCHRONIZE access.
            match unsafe { WaitForSingleObject(self.0, millis) } {
                WAIT_OBJECT_0 => Some(true),
                WAIT_TIMEOUT => Some(false),
                _ => None,
            }
        }

        /// Still running: `Some(true)`; already finished: `Some(false)`; query failed: None.
        pub fn running(&self) -> Option<bool> {
            self.wait_for_exit(Duration::ZERO).map(|exited| !exited)
        }
    }

    impl Drop for Parent {
        fn drop(&mut self) {
            // SAFETY: The handle is exclusively owned by this object and is closed only once.
            unsafe { CloseHandle(self.0) };
        }
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    #[test]
    fn parent_is_the_process_that_spawned_us() {
        // SAFETY: Same as above.
        let parent = unsafe { libc::getppid() } as u32;
        assert!(parent_alive(parent));
        assert!(!parent_alive(parent.wrapping_add(1)));
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    fn a_process_created_after_us_is_never_the_parent() {
        // A process created after this one (simulating a reused PID after the parent died) does not count as the parent, even if it is still alive.
        let mut child = std::process::Command::new("cmd")
            .args(["/C", "ping", "-n", "5", "127.0.0.1"])
            .stdout(std::process::Stdio::null())
            .spawn()
            .unwrap();
        assert!(!parent_alive(child.id()));
        child.kill().unwrap();
        child.wait().unwrap();
    }

    #[test]
    fn an_exited_process_is_not_alive() {
        let mut child = std::process::Command::new("cmd").args(["/C", "exit", "0"]).spawn().unwrap();
        let pid = child.id();
        child.wait().unwrap();
        assert!(!parent_alive(pid));
    }

    #[test]
    fn a_running_older_process_is_alive() {
        // This process itself: same creation time, still running.
        assert!(parent_alive(std::process::id()));
    }
}
