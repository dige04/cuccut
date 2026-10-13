# Conventions

<!-- surface: cli -->
On success stdout is `{ ok: true, result, next? }`; `next` is the suggested next command.
<!-- /surface -->

## What to do after an error code

<!-- generated: error-codes -->
<!-- surface: cli -->
| Error code | Exit code | Next step |
| --- | --- | --- |
| `CAPABILITY_NOT_CONFIGURED` `DUB_SEPARATION_NOT_CONFIGURED` `MODELS_DIR_MISSING` `CREDENTIAL_UNAVAILABLE` `AUTHENTICATION_REQUIRED` `OFFLINE_STRICT` `GRANT_REQUIRED` `GRANT_REVOKED` `BUDGET_EXCEEDED` `BUDGET_UNVERIFIABLE` `TASK_BUDGET_EXCEEDED` `TASK_BUDGET_UNVERIFIABLE` `TOOL_UNAVAILABLE` `TOOL_CONSENT_REQUIRED` `TOOL_UPDATE_CONFIRM_REQUIRED` `TOOL_UPDATE_MANUAL` `MEDIA_TOOL_UNAVAILABLE` `EXPORT_TOOL_MISSING` `LINK_LOGIN_REQUIRED` `LINK_COOKIES_UNAVAILABLE` `LINK_TOOL_UPDATE_REQUIRED` `VOICE_CONSENT_REQUIRED` `VOICE_CLONE_REQUIRED` | 2 | The user has to do something first: configure a capability, grant access or budget, agree to or install an external tool, sign in, authorize a voice. Pass `remedy` on to the user as is, and retry as `next` says once they are done; do not work around it with scripts, other providers or hand-edited configuration |
| `RUNTIME_UNAVAILABLE` `RUNTIME_START_FAILED` `PROTOCOL_MISMATCH` `INTERFACE_VERSION_MISMATCH` `CATALOG_UNAVAILABLE` | 3 | The Runtime is unavailable or a different version. Run `cuccut runtime ensure` first; when the interface version differs, ask the user to update CucCut or the CLI, and do not work around it |
| `INVALID_ARGUMENTS` `UNKNOWN_COMMAND` `UNKNOWN_TOOL` `CONFIRMATION_REQUIRED` | 4 | Wrong arguments: fix them against `cuccut help <command>` or `cuccut spec <name>`; when `--yes` is missing, ask the user first and add it only once they agree |
| `RUNTIME_NOT_OWNED` `RUNTIME_IN_USE` | 1 | The Runtime is not this CLI's to stop, or someone is still using it: do not stop it, leave it running |
| `AGENT_SKILL_NOT_FOUND` `AGENT_SKILL_INVALID` | 1 | The agent guide cannot be installed: the CucCut installation is incomplete or the guide is broken. Pass `message` on to the user as is and ask them to reinstall or update CucCut; do not assemble the guide yourself |
| Other error codes | 1 | Failed or cancelled. Look at `retryability`: `after-refresh` - read again before submitting (on a revision conflict, `PROJECT_REVISION_CONFLICT`, run {{tool:videos_inspect}} again); `after-user-action` - pass it on to the user; `never` - change approach. On a wait timeout (`WAIT_TIMEOUT`) the job is still running: keep waiting with {{tool:jobs_wait}} |
<!-- /surface -->
<!-- surface: agent -->
| Error code | Next step |
| --- | --- |
| `CAPABILITY_NOT_CONFIGURED` `DUB_SEPARATION_NOT_CONFIGURED` `MODELS_DIR_MISSING` `CREDENTIAL_UNAVAILABLE` `AUTHENTICATION_REQUIRED` `OFFLINE_STRICT` `GRANT_REQUIRED` `GRANT_REVOKED` `BUDGET_EXCEEDED` `BUDGET_UNVERIFIABLE` `TASK_BUDGET_EXCEEDED` `TASK_BUDGET_UNVERIFIABLE` `TOOL_UNAVAILABLE` `TOOL_CONSENT_REQUIRED` `TOOL_UPDATE_CONFIRM_REQUIRED` `TOOL_UPDATE_MANUAL` `MEDIA_TOOL_UNAVAILABLE` `EXPORT_TOOL_MISSING` `LINK_LOGIN_REQUIRED` `LINK_COOKIES_UNAVAILABLE` `LINK_TOOL_UPDATE_REQUIRED` `VOICE_CONSENT_REQUIRED` `VOICE_CLONE_REQUIRED` | The user has to do something first: configure a capability, grant access or budget, agree to or install an external tool, sign in, authorize a voice. Pass `remedy` on to the user as is, and retry as `next` says once they are done; do not work around it |
| `INVALID_ARGUMENTS` `UNKNOWN_TOOL` | Wrong arguments or tool name: fix them against the tool's schema; get the operation fields of `edits_apply` from {{tool:edits_ops}} |
| Other error codes | Failed or cancelled. Look at `retryability`: `after-refresh` - read again before submitting (on a revision conflict, `PROJECT_REVISION_CONFLICT`, run {{tool:videos_inspect}} again); `after-user-action` - pass it on to the user; `never` - change approach |
<!-- /surface -->
<!-- /generated -->
