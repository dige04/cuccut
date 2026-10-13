//! Scheduling priority of the inference thread (architecture design §6.5, "Priority and resources"): the Worker runs at a lower priority than the foreground, so transcription does not compete with the UI.
//!
//! On macOS the calling thread's QoS is set to utility; on Windows the thread priority is lowered to `THREAD_PRIORITY_BELOW_NORMAL`; other platforms are not handled yet (a conservative implementation).
//! This only affects the calling thread, so it must be called from inside the inference thread itself.

/// Lowers the calling thread to background inference priority. Failures are only logged: priority is best-effort and does not affect whether the job can run.
#[cfg(target_os = "macos")]
pub fn lower_current_thread() {
    // SAFETY: only changes the calling thread's own QoS; the arguments are a valid class and relative priority 0.
    let code = unsafe { libc::pthread_set_qos_class_self_np(libc::qos_class_t::QOS_CLASS_UTILITY, 0) };
    if code != 0 {
        eprintln!("[model-worker] cannot set the inference thread QoS to utility (error {code})");
    }
}

#[cfg(windows)]
mod windows_thread {
    use std::ffi::c_void;

    pub const THREAD_PRIORITY_BELOW_NORMAL: i32 = -1;

    #[link(name = "kernel32")]
    unsafe extern "system" {
        pub fn GetCurrentThread() -> *mut c_void;
        pub fn SetThreadPriority(thread: *mut c_void, priority: i32) -> i32;
        #[cfg(test)]
        pub fn GetThreadPriority(thread: *mut c_void) -> i32;
    }
}

/// Lowers the calling thread to background inference priority. Failures are only logged: priority is best-effort and does not affect whether the job can run.
#[cfg(windows)]
pub fn lower_current_thread() {
    use windows_thread::{GetCurrentThread, SetThreadPriority, THREAD_PRIORITY_BELOW_NORMAL};
    // SAFETY: GetCurrentThread returns a pseudo-handle for the calling thread (no need to close it); only changes the calling thread's own priority.
    if unsafe { SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_BELOW_NORMAL) } == 0 {
        let error = std::io::Error::last_os_error();
        eprintln!("[model-worker] cannot lower the inference thread priority ({error})");
    }
}

#[cfg(not(any(target_os = "macos", windows)))]
pub fn lower_current_thread() {}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;

    /// The calling thread's current QoS class. Read as u32, since the return value is not necessarily one of the enum items.
    fn current_qos() -> u32 {
        let mut class: u32 = 0;
        let mut relative: libc::c_int = 0;
        // SAFETY: queries its own thread; `qos_class_t` is repr(u32), and the output pointer points to a valid u32.
        let code = unsafe {
            libc::pthread_get_qos_class_np(
                libc::pthread_self(),
                (&mut class as *mut u32).cast::<libc::qos_class_t>(),
                &mut relative,
            )
        };
        assert_eq!(code, 0);
        class
    }

    #[test]
    fn lowers_only_the_calling_thread_to_utility() {
        let before = current_qos();
        let inside = std::thread::spawn(|| {
            lower_current_thread();
            current_qos()
        })
        .join()
        .unwrap();
        assert_eq!(inside, libc::qos_class_t::QOS_CLASS_UTILITY as u32);
        assert_eq!(current_qos(), before);
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::windows_thread::{GetCurrentThread, GetThreadPriority, THREAD_PRIORITY_BELOW_NORMAL};
    use super::*;

    fn current_priority() -> i32 {
        // SAFETY: queries the calling thread's own priority.
        unsafe { GetThreadPriority(GetCurrentThread()) }
    }

    #[test]
    fn lowers_only_the_calling_thread_to_below_normal() {
        let before = current_priority();
        let inside = std::thread::spawn(|| {
            lower_current_thread();
            current_priority()
        })
        .join()
        .unwrap();
        assert_eq!(inside, THREAD_PRIORITY_BELOW_NORMAL);
        assert_eq!(current_priority(), before);
    }
}
