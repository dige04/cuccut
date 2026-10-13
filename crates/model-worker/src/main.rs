//! Model Worker process entry point (architecture design §6.5, protocol spec docs/spec/model-worker-protocol-spec.md).
//!
//! `model-worker --parent-pid <pid>`. stdin takes one request per line, `{"id", "method", "params"}`; stdout writes one response per line, `{"id", "result"}` / `{"id", "error"}`, or an event `{"event", "params"}`. Events are always sent before the response of the owning `job.run`.
//! stdout carries only the protocol; logs go to stderr. The process exits when stdin closes, when stdout cannot be written, when the parent process is gone, or when a line exceeds 16 MiB.

mod worker;

use std::io::{self, BufRead, Read};

use model_runtime::protocol::MAX_LINE_BYTES;
use model_runtime::watchdog;

use worker::{Output, Worker, hard_exit};

fn main() {
    let parent_pid = match parse_parent_pid(std::env::args().skip(1)) {
        Ok(pid) => pid,
        Err(message) => {
            eprintln!("model-worker: {message}");
            eprintln!("usage: model-worker --parent-pid <pid>");
            std::process::exit(2);
        }
    };

    configure_intel_metal();

    let output = Output::stdout();
    let watchdog_output = output.clone();
    let watchdog = watchdog::spawn(parent_pid, move || {
        eprintln!("[model-worker] parent process {parent_pid} is gone; exiting");
        watchdog_output.flush();
        hard_exit(0);
    });
    if let Err(error) = watchdog {
        eprintln!("model-worker: cannot start the parent watchdog: {error}");
        std::process::exit(1);
    }

    let mut worker = match Worker::start(output) {
        Ok(worker) => worker,
        Err(error) => {
            eprintln!("model-worker: cannot start the inference thread: {error}");
            std::process::exit(1);
        }
    };

    let stdin = io::stdin();
    let mut reader = stdin.lock();
    let mut line = Vec::new();
    loop {
        match read_line(&mut reader, &mut line) {
            Ok(Line::Eof) => worker.shutdown(0),
            Ok(Line::TooLong) => {
                eprintln!("[model-worker] a request line exceeds {MAX_LINE_BYTES} bytes; exiting");
                worker.shutdown(1);
            }
            Ok(Line::Complete) => {
                if line.iter().all(u8::is_ascii_whitespace) {
                    continue;
                }
                worker.handle_line(&line);
            }
            Err(error) => {
                eprintln!("[model-worker] reading stdin failed: {error}");
                worker.shutdown(1);
            }
        }
    }
}

/// The pinned ggml concurrent dispatch path can produce corrupt results on discrete
/// AMD GPUs. Re-exec before starting threads to set its supported compatibility
/// switch without mutating the environment of a multithreaded process.
#[cfg(all(feature = "whisper-ggml-metal", target_os = "macos", target_arch = "x86_64"))]
fn configure_intel_metal() {
    use std::os::unix::process::CommandExt;

    const SWITCH: &str = "GGML_METAL_CONCURRENCY_DISABLE";
    if std::env::var_os(SWITCH).is_some() {
        return;
    }
    let executable = match std::env::current_exe() {
        Ok(path) => path,
        Err(error) => {
            eprintln!("model-worker: cannot locate executable for Metal configuration: {error}");
            std::process::exit(1);
        }
    };
    let error = std::process::Command::new(executable)
        .args(std::env::args_os().skip(1))
        .env(SWITCH, "1")
        .exec();
    eprintln!("model-worker: cannot apply Intel Metal configuration: {error}");
    std::process::exit(1);
}

#[cfg(not(all(feature = "whisper-ggml-metal", target_os = "macos", target_arch = "x86_64")))]
fn configure_intel_metal() {}

fn parse_parent_pid(mut args: impl Iterator<Item = String>) -> Result<u32, String> {
    let mut parent_pid = None;
    while let Some(arg) = args.next() {
        let value = match arg.strip_prefix("--parent-pid=") {
            Some(value) => value.to_owned(),
            None if arg == "--parent-pid" => args.next().ok_or("--parent-pid needs a value")?,
            None => return Err(format!("unknown argument: {arg}")),
        };
        let pid = value.parse::<u32>().map_err(|_| format!("invalid --parent-pid: {value}"))?;
        if pid == 0 {
            return Err("--parent-pid must be positive".into());
        }
        parent_pid = Some(pid);
    }
    parent_pid.ok_or_else(|| "--parent-pid is required".into())
}

enum Line {
    Complete,
    TooLong,
    Eof,
}

/// Reads one line (without the newline), up to [`MAX_LINE_BYTES`] bytes. It does not read an overlong line into memory in full first.
fn read_line(reader: &mut impl BufRead, line: &mut Vec<u8>) -> io::Result<Line> {
    line.clear();
    let limit = MAX_LINE_BYTES as u64 + 1;
    let read = reader.by_ref().take(limit).read_until(b'\n', line)?;
    if read == 0 {
        return Ok(Line::Eof);
    }
    if line.last() == Some(&b'\n') {
        line.pop();
        if line.last() == Some(&b'\r') {
            line.pop();
        }
        return Ok(Line::Complete);
    }
    if line.len() > MAX_LINE_BYTES {
        return Ok(Line::TooLong);
    }
    // If the last line reaches EOF without a newline, it is processed as usual; the next read hits EOF.
    Ok(Line::Complete)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(list: &[&str]) -> impl Iterator<Item = String> {
        list.iter().map(|arg| (*arg).to_owned()).collect::<Vec<_>>().into_iter()
    }

    #[test]
    fn parses_the_parent_pid() {
        assert_eq!(parse_parent_pid(args(&["--parent-pid", "42"])), Ok(42));
        assert_eq!(parse_parent_pid(args(&["--parent-pid=7"])), Ok(7));
        assert!(parse_parent_pid(args(&[])).is_err());
        assert!(parse_parent_pid(args(&["--parent-pid"])).is_err());
        assert!(parse_parent_pid(args(&["--parent-pid", "x"])).is_err());
        assert!(parse_parent_pid(args(&["--parent-pid", "0"])).is_err());
        assert!(parse_parent_pid(args(&["--verbose"])).is_err());
    }

    #[test]
    fn reads_bounded_lines() {
        let mut input: &[u8] = b"one\r\ntwo\nthree";
        let mut line = Vec::new();
        assert!(matches!(read_line(&mut input, &mut line).unwrap(), Line::Complete));
        assert_eq!(line, b"one");
        assert!(matches!(read_line(&mut input, &mut line).unwrap(), Line::Complete));
        assert_eq!(line, b"two");
        assert!(matches!(read_line(&mut input, &mut line).unwrap(), Line::Complete));
        assert_eq!(line, b"three");
        assert!(matches!(read_line(&mut input, &mut line).unwrap(), Line::Eof));

        let long = vec![b'x'; MAX_LINE_BYTES + 10];
        let mut input: &[u8] = &long;
        assert!(matches!(read_line(&mut input, &mut line).unwrap(), Line::TooLong));
        let mut exact = vec![b'y'; MAX_LINE_BYTES];
        exact.push(b'\n');
        let mut input: &[u8] = &exact;
        assert!(matches!(read_line(&mut input, &mut line).unwrap(), Line::Complete));
        assert_eq!(line.len(), MAX_LINE_BYTES);
    }
}
