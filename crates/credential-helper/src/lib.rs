//! Protocol of the credential helper (architecture design §6.8): one process handles one request.
//!
//! One line of JSON on stdin is the request `{"op": "get" | "set" | "delete" | "has", "key": string, "secret"?: string}`.
//! One line of JSON on stdout is the response: success is `{"ok": true}`, `get` also carries `"secret"`, and `has` also carries `"exists"`;
//! failure is `{"ok": false, "error": <error code>, "message": string}`, where the error code comes from a closed set (see [`ErrorCode`]).
//!
//! Read-only operations used only for upgrades: `legacy-accounts` only enumerates the account attributes of CucCut / VoiceInk;
//! `legacy-get` only reads the Windows v2 ccut service entries by provider;
//! `legacy-read` silently reads the named accounts of macOS CucCut / VoiceInk / ccut, and does not delete or rewrite old credentials.
//!
//! Secrets pass only through stdin and stdout: they never go into command-line arguments, environment variables, stderr, or error messages.

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

pub mod keychain;

/// Keychain item service; the account is the key in the request (e.g. `provider:openai`, `node:<nodeId>`).
pub const SERVICE: &str = "com.cuccut.runtime";

/// Size limit for one request line: keys and secrets are both short, so anything longer is treated as invalid.
pub const MAX_REQUEST_BYTES: usize = 256 * 1024;
const MAX_KEY_BYTES: usize = 512;

/// Kinds of failure (a closed set).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ErrorCode {
    /// The item does not exist (`get` and `delete`).
    NotFound,
    /// The user or the system denied access (authorization prompt cancelled, authentication failed, interaction not allowed).
    Denied,
    /// The keychain is unavailable right now (locked and cannot be unlocked, no default keychain, missing entitlement).
    Unavailable,
    /// Not implemented on this platform.
    Unsupported,
    /// Other errors, including invalid requests.
    Internal,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HelperError {
    pub code: ErrorCode,
    pub message: String,
}

impl HelperError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

/// Where secrets are stored. On macOS it is the Keychain, on Windows Credential Manager ([`keychain::SystemKeychain`]); in tests it is in memory.
pub trait SecretBackend {
    fn get(&self, key: &str) -> Result<String, HelperError>;
    fn set(&self, key: &str, secret: &str) -> Result<(), HelperError>;
    fn delete(&self, key: &str) -> Result<(), HelperError>;
    fn has(&self, key: &str) -> Result<bool, HelperError>;
    /// Read one v2 Windows provider from its original ccut service, without deleting it.
    fn legacy_get(&self, _provider: &str) -> Result<String, HelperError> {
        Err(HelperError::new(ErrorCode::Unsupported, "Legacy provider access is unavailable"))
    }
    /// Background macOS migration must never request keychain authorization.
    fn legacy_read(&self, _service: &str, _account: &str) -> Result<String, HelperError> {
        Err(HelperError::new(ErrorCode::Unsupported, "Legacy credential access is unavailable"))
    }
    /// Only historical CucCut services; returns account names, never secret values.
    fn legacy_accounts(&self, _service: &str) -> Result<Vec<String>, HelperError> {
        Err(HelperError::new(ErrorCode::Unsupported, "Legacy account discovery is unavailable"))
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Request {
    op: String,
    key: String,
    #[serde(default)]
    secret: Option<String>,
    #[serde(default)]
    service: Option<String>,
}

/// Handles one request line and returns one response line (without the newline). A secret is included only when a password read succeeds.
pub fn handle_line(line: &str, backend: &dyn SecretBackend) -> String {
    let response = match parse(line) {
        Ok(request) => dispatch(&request, backend),
        Err(error) => Err(error),
    };
    let value = match response {
        Ok(value) => value,
        Err(error) => json!({ "ok": false, "error": error.code, "message": error.message }),
    };
    value.to_string()
}

fn parse(line: &str) -> Result<Request, HelperError> {
    if line.len() > MAX_REQUEST_BYTES {
        return Err(HelperError::new(ErrorCode::Internal, "请求过长"));
    }
    // Parse error details may quote fragments of the request (which may contain a secret), so they are kept out of the response.
    let request: Request = serde_json::from_str(line).map_err(|_| HelperError::new(ErrorCode::Internal, "请求不是合规的 JSON"))?;
    if request.key.is_empty() || request.key.len() > MAX_KEY_BYTES || request.key.chars().any(char::is_control) {
        return Err(HelperError::new(ErrorCode::Internal, "key 不合规"));
    }
    Ok(request)
}

fn dispatch(request: &Request, backend: &dyn SecretBackend) -> Result<Value, HelperError> {
    let key = request.key.as_str();
    if request.op == "legacy-read" {
        return match (request.service.as_deref(), request.secret.as_deref()) {
            (Some(service @ ("CucCut" | "VoiceInk" | "ccut")), None) => backend
                .legacy_read(service, key)
                .map(|secret| json!({ "ok": true, "secret": secret })),
            _ => Err(HelperError::new(ErrorCode::Internal, "Invalid legacy credential request")),
        };
    }
    if request.service.is_some() {
        return Err(HelperError::new(ErrorCode::Internal, "Only legacy-read accepts service"));
    }
    match (request.op.as_str(), request.secret.as_deref()) {
        ("legacy-accounts", None) if matches!(key, "CucCut" | "VoiceInk") => backend
            .legacy_accounts(key)
            .map(|accounts| json!({ "ok": true, "accounts": accounts })),
        ("legacy-get", None) if key.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-') => {
            backend.legacy_get(key).map(|secret| json!({ "ok": true, "secret": secret }))
        }
        ("get", None) => backend.get(key).map(|secret| json!({ "ok": true, "secret": secret })),
        ("set", Some(secret)) if !secret.is_empty() => backend.set(key, secret).map(|()| json!({ "ok": true })),
        ("set", _) => Err(HelperError::new(ErrorCode::Internal, "set 要给出非空的 secret")),
        ("delete", None) => backend.delete(key).map(|()| json!({ "ok": true })),
        ("has", None) => backend.has(key).map(|exists| json!({ "ok": true, "exists": exists })),
        ("get" | "delete" | "has", Some(_)) => Err(HelperError::new(ErrorCode::Internal, "只有 set 带 secret")),
        _ => Err(HelperError::new(ErrorCode::Internal, "不认识的操作")),
    }
}
