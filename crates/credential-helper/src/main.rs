//! Entry point of the credential helper process (architecture design §6.8). Reads the first request line from stdin, writes one response line to stdout, then exits.
//!
//! Does not read any secret from command-line arguments or environment variables; does not write request or response content to stderr.

use std::io::{self, BufRead, Read, Write};

use credential_helper::keychain::SystemKeychain;
use credential_helper::{MAX_REQUEST_BYTES, handle_line};

fn main() {
    let stdin = io::stdin();
    // Read one extra byte: a request over the limit is answered as invalid by the protocol layer.
    let mut reader = stdin.lock().take(MAX_REQUEST_BYTES as u64 + 1);
    let mut line = String::new();
    let response = match reader.read_line(&mut line) {
        Ok(_) => handle_line(line.trim_end_matches(['\r', '\n']), &SystemKeychain),
        Err(_) => r#"{"ok":false,"error":"internal","message":"Could not read the request"}"#.to_owned(),
    };
    let mut out = io::stdout().lock();
    let written = out.write_all(response.as_bytes()).is_ok() && out.write_all(b"\n").is_ok() && out.flush().is_ok();
    std::process::exit(if written { 0 } else { 1 });
}
