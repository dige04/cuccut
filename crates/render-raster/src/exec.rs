//! Lookup of the external binaries (ffmpeg / ffprobe) and `Command` construction. Only `media` uses this.
//!
//! v2 provided this through `ccut-exec`, which handled the search directory table, PATH capture from the login shell, hard-coded directories such as Homebrew and MacPorts, and the `CCUT_REAL_EXE` hard-link identity. The architecture design §13.6 decided not to port it, and process and tool discovery belongs to the Runtime. Only the three items `media` actually uses are kept here: [`command`], [`find_executable`], and [`current_exe`]. Their names and shapes match v2, but the lookup rules follow v3:
//!
//! 1. ffmpeg / ffprobe first check the environment variables `CUCCUT_FFMPEG` / `CUCCUT_FFPROBE`. These are the same variables used by `media-core`, `model-runtime`, and the Runtime's external tool resolution. An absolute path is used as it is. A bare name is searched for in `PATH`. If a value is given but cannot be found, no other source is substituted. This matches the Runtime: an explicitly specified value is never silently replaced.
//! 2. Otherwise, search the `PATH` of the current process. When the Runtime starts a Worker, it passes the login shell's PATH. Here no guessed directories are added, and the child process's `PATH` is not rewritten.
//!
//! Paths the user set in Settings, and managed copies, exist only in the Runtime's registry. ffmpeg has no managed copy. The Rust side cannot see them. At wiring time, the caller passes in the resolved path (the same as `media-core::Tools`).

use std::ffi::{OsStr, OsString};
use std::path::{Path, PathBuf};
use std::process::Command;

/// The environment variable that overrides the ffmpeg executable (same name as `model-runtime::audio::FFMPEG_ENV`).
pub const FFMPEG_ENV: &str = "CUCCUT_FFMPEG";
/// The environment variable that overrides the ffprobe executable.
pub const FFPROBE_ENV: &str = "CUCCUT_FFPROBE";

/// Builds a `Command` that launches `program`. The path is resolved by the rules of [`find_executable`] before launch. If resolution fails, spawn is left to fail as usual, and the caller falls back or reports the error. If an override variable is set, the variable's value is used to launch, and the code does not fall back to a same-named program on `PATH`. Only when no override is set is the original name used. On Windows, the child process's console window is hidden.
pub fn command(program: impl AsRef<OsStr>) -> Command {
    let program = program.as_ref();
    let resolved = match program.to_str() {
        Some(name) => {
            let overridden = override_env(name).and_then(std::env::var_os);
            resolve_program(
                name,
                overridden.as_deref(),
                std::env::var_os("PATH").as_deref(),
            )
        }
        None => program.to_os_string(),
    };
    let mut command = Command::new(resolved);
    hide_console(&mut command);
    command
}

/// The program actually launched by [`command`]. If the lookup finds it, this is the found path. If not, it is the override variable's value (if set), otherwise the original name.
fn resolve_program(name: &str, overridden: Option<&OsStr>, path: Option<&OsStr>) -> OsString {
    if let Some(found) = find_executable_in(name, overridden, path) {
        return found.into_os_string();
    }
    match overridden.filter(|value| !value.is_empty()) {
        Some(value) => value.to_os_string(),
        None => name.into(),
    }
}

/// Finds an external binary. Only a bare command name is accepted (it must not contain path separators). See the module docs for the rules.
pub fn find_executable(name: &str) -> Option<PathBuf> {
    let overridden = override_env(name).and_then(std::env::var_os);
    find_executable_in(
        name,
        overridden.as_deref(),
        std::env::var_os("PATH").as_deref(),
    )
}

/// Lookup entry point with an injectable environment, so unit tests can pin the rules. `overridden` is the value of the matching environment variable.
fn find_executable_in(
    name: &str,
    overridden: Option<&OsStr>,
    path: Option<&OsStr>,
) -> Option<PathBuf> {
    if name.is_empty() || Path::new(name).components().count() != 1 {
        return None;
    }
    if let Some(value) = overridden.filter(|value| !value.is_empty()) {
        let given = Path::new(value);
        if given.is_absolute() {
            return is_executable_file(given).then(|| given.to_path_buf());
        }
        return given
            .to_str()
            .filter(|bare| Path::new(bare).components().count() == 1)
            .and_then(|bare| search_path(bare, path));
    }
    search_path(name, path)
}

/// Override variables for ffmpeg and ffprobe. The other commands have none. The Windows `.exe` suffix is also accepted.
fn override_env(name: &str) -> Option<&'static str> {
    let stem = name
        .strip_suffix(".exe")
        .or_else(|| name.strip_suffix(".EXE"))
        .unwrap_or(name);
    match stem {
        "ffmpeg" => Some(FFMPEG_ENV),
        "ffprobe" => Some(FFPROBE_ENV),
        _ => None,
    }
}

/// Finds the first file that is executable in the platform's sense, in `PATH` order.
fn search_path(name: &str, path: Option<&OsStr>) -> Option<PathBuf> {
    let candidates = candidate_names(name);
    std::env::split_paths(path.unwrap_or_default())
        .filter(|directory| !directory.as_os_str().is_empty())
        .find_map(|directory| {
            candidates
                .iter()
                .map(|candidate| directory.join(candidate))
                .find(|path| is_executable_file(path))
        })
}

/// On Windows, tries `.exe`, then `.cmd`, then `.bat`. Files without an extension are not accepted (same as v2 `ccut-exec`).
#[cfg(windows)]
fn candidate_names(name: &str) -> Vec<OsString> {
    let lower = name.to_ascii_lowercase();
    if [".exe", ".cmd", ".bat"]
        .iter()
        .any(|suffix| lower.ends_with(suffix))
    {
        vec![name.into()]
    } else {
        ["exe", "cmd", "bat"]
            .iter()
            .map(|extension| format!("{name}.{extension}").into())
            .collect()
    }
}

#[cfg(not(windows))]
fn candidate_names(name: &str) -> Vec<OsString> {
    vec![name.into()]
}

/// On Windows, stops the child process from opening a console window. No-op on other platforms.
fn hide_console(command: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(windows))]
    let _ = command;
}

#[cfg(unix)]
fn is_executable_file(path: &Path) -> bool {
    use std::os::unix::fs::PermissionsExt;
    std::fs::metadata(path)
        .map(|metadata| metadata.is_file() && metadata.permissions().mode() & 0o111 != 0)
        .unwrap_or(false)
}

#[cfg(not(unix))]
fn is_executable_file(path: &Path) -> bool {
    path.is_file()
}

/// The real path of this process's executable: `std::env::current_exe()`, then canonicalized (symbolic links resolved). If resolution fails, the original value is returned. v2 also recognized `CCUT_REAL_EXE` (a `ccut` started through a hard link named after a role). v3 has no such way of starting.
pub fn current_exe() -> std::io::Result<PathBuf> {
    let raw = std::env::current_exe()?;
    Ok(std::fs::canonicalize(&raw).unwrap_or(raw))
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Scratch(PathBuf);

    impl Scratch {
        fn new(tag: &str) -> Scratch {
            let root = std::env::temp_dir().join(format!(
                "render-raster-exec-{tag}-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
            std::fs::create_dir_all(&root).unwrap();
            Scratch(root)
        }

        fn tool(&self, directory: &str, name: &str, executable: bool) -> PathBuf {
            let directory = self.0.join(directory);
            std::fs::create_dir_all(&directory).unwrap();
            #[cfg(windows)]
            let name = format!("{name}.exe");
            let file = directory.join(name);
            std::fs::write(&file, "#!/bin/sh\n").unwrap();
            #[cfg(unix)]
            if executable {
                use std::os::unix::fs::PermissionsExt;
                std::fs::set_permissions(&file, std::fs::Permissions::from_mode(0o755)).unwrap();
            }
            #[cfg(not(unix))]
            let _ = executable;
            file
        }

        fn path(&self, directories: &[&str]) -> OsString {
            std::env::join_paths(directories.iter().map(|directory| self.0.join(directory)))
                .unwrap()
        }
    }

    impl Drop for Scratch {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn the_path_is_searched_in_order_and_names_with_separators_are_rejected() {
        let scratch = Scratch::new("order");
        scratch.tool("a", "ffmpeg", false);
        let second = scratch.tool("b", "ffmpeg", true);
        scratch.tool("c", "ffmpeg", true);
        let path = scratch.path(&["a", "b", "c"]);

        assert_eq!(
            find_executable_in("ffmpeg", None, Some(&path)),
            Some(second)
        );
        assert_eq!(find_executable_in("nested/ffmpeg", None, Some(&path)), None);
        assert_eq!(find_executable_in("", None, Some(&path)), None);
        assert_eq!(find_executable_in("ffmpeg", None, None), None);
    }

    #[test]
    fn an_absolute_override_wins_and_is_not_replaced_when_unusable() {
        let scratch = Scratch::new("absolute");
        let on_path = scratch.tool("bin", "ffmpeg", true);
        let pinned = scratch.tool("pinned", "ffmpeg", true);
        let inert = scratch.tool("inert", "ffmpeg", false);
        let path = scratch.path(&["bin"]);

        assert_eq!(
            find_executable_in("ffmpeg", Some(pinned.as_os_str()), Some(&path)),
            Some(pinned)
        );
        #[cfg(unix)]
        assert_eq!(
            find_executable_in("ffmpeg", Some(inert.as_os_str()), Some(&path)),
            None,
            "显式指定的不可用时不悄悄换成 PATH 里的 {}",
            on_path.display()
        );
        #[cfg(not(unix))]
        let _ = (inert, on_path);
    }

    #[test]
    fn a_bare_override_is_searched_on_the_path() {
        let scratch = Scratch::new("bare");
        scratch.tool("bin", "ffmpeg", true);
        let custom = scratch.tool("bin", "ffmpeg-7", true);
        let path = scratch.path(&["bin"]);

        assert_eq!(
            find_executable_in("ffmpeg", Some(OsStr::new("ffmpeg-7")), Some(&path)),
            Some(custom)
        );
        assert_eq!(
            find_executable_in("ffmpeg", Some(OsStr::new("missing-ffmpeg")), Some(&path)),
            None
        );
    }

    #[test]
    fn a_command_never_falls_back_from_an_unusable_override_to_the_path() {
        let scratch = Scratch::new("command");
        let on_path = scratch.tool("bin", "ffmpeg", true);
        let path = scratch.path(&["bin"]);
        let missing = scratch.0.join("missing/ffmpeg");

        assert_eq!(
            resolve_program("ffmpeg", Some(missing.as_os_str()), Some(&path)),
            missing.into_os_string()
        );
        assert_eq!(
            resolve_program("ffmpeg", Some(OsStr::new("missing-ffmpeg")), Some(&path)),
            OsString::from("missing-ffmpeg")
        );
        assert_eq!(
            resolve_program("ffmpeg", None, Some(&path)),
            on_path.into_os_string()
        );
        assert_eq!(
            resolve_program("ffmpeg", None, None),
            OsString::from("ffmpeg")
        );
    }

    #[test]
    fn only_ffmpeg_and_ffprobe_have_override_variables() {
        assert_eq!(override_env("ffmpeg"), Some(FFMPEG_ENV));
        assert_eq!(override_env("ffprobe"), Some(FFPROBE_ENV));
        assert_eq!(override_env("ffmpeg.exe"), Some(FFMPEG_ENV));
        assert_eq!(override_env("yt-dlp"), None);
    }

    #[test]
    fn an_unresolvable_command_keeps_its_name_and_fails_to_spawn() {
        let command = command("render-raster-exec-no-such-tool");
        assert_eq!(command.get_program(), "render-raster-exec-no-such-tool");
        let mut command = command;
        let error = command.output().unwrap_err();
        assert_eq!(error.kind(), std::io::ErrorKind::NotFound);
    }
}
