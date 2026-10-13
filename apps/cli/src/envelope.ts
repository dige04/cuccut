import { isMessageRef, localizeText, type CatalogToolError } from '@cuccut/protocol';
import { M } from './cli-copy.ts';
import { remedyHintText, remedyText } from './localized-text.ts';

/**
 * CLI output envelope and exit codes (agent-surface design §5.1, §5.2; command and protocol spec §11.7). Shared by derived commands, meta commands and admin buckets:
 *
 * - Success `{ ok: true, result, next?, runtime? }`: `result` is the tool's result object (same JSON as an MCP tool result); `next` is the suggested next command (the `next` in the tool result, already rendered in CLI form); `runtime: { started: true }` means the Runtime was started automatically this time.
 *   Failure `{ ok: false, error, runtime? }`: `error` is the same as the error object of `catalog.call` (`ToolCatalog.errorBody`); problems discovered by the CLI itself
 *   (arguments, missing `--yes`, Runtime unavailable) use the same shape.
 * - `--json` (the default when stdout is not a TTY) writes the envelope to stdout as-is; otherwise successful results are written to stdout indented, and failures to stderr.
 */

export type Envelope =
  | { ok: true; result: unknown; next?: string; runtime?: { started: true } }
  | { ok: false; error: CatalogToolError; runtime?: { started: true } };

/** Exit codes (§5.2). */
export const EXIT = {
  ok: 0,
  /** Failure or cancellation: task terminal state `failed` / `cancelled`, or rejected by a tool or engine. */
  failed: 1,
  /** Needs user action before it can continue: configuring a capability, authorization, consent to external tools, etc. The output has `remedy` and `next`. */
  actionRequired: 2,
  /** Runtime unavailable or version incompatible. */
  runtimeUnavailable: 3,
  /** Wrong arguments, or an irreversible command missing `--yes`. */
  invalidArguments: 4,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

/**
 * The only table mapping error codes to exit codes. Any error code not listed is 1. For task failures, the lookup uses the task's error code, but never goes below 1.
 *
 * - 2: the user must do something first (configuration, authorization, consent, login, installation); the agent relays `remedy` / `next` to the user and does not work around it itself.
 * - 3: a Runtime problem determined by the CLI itself (cannot connect, cannot start, protocol or interface version differs).
 * - 4: arguments (including unknown flags and wrong types found in the CLI parsing stage) and missing `--yes`.
 *
 * The error-code table in the instructions file `conventions.md` is generated from this table by `tools/sync-agent-skill.ts`.
 */
export const EXIT_BY_CODE: Readonly<Record<string, ExitCode>> = {
  // Capabilities and models
  CAPABILITY_NOT_CONFIGURED: EXIT.actionRequired,
  DUB_SEPARATION_NOT_CONFIGURED: EXIT.actionRequired,
  MODELS_DIR_MISSING: EXIT.actionRequired,
  CREDENTIAL_UNAVAILABLE: EXIT.actionRequired,
  AUTHENTICATION_REQUIRED: EXIT.actionRequired,
  OFFLINE_STRICT: EXIT.actionRequired,
  // Authorization and budget
  GRANT_REQUIRED: EXIT.actionRequired,
  GRANT_REVOKED: EXIT.actionRequired,
  BUDGET_EXCEEDED: EXIT.actionRequired,
  BUDGET_UNVERIFIABLE: EXIT.actionRequired,
  TASK_BUDGET_EXCEEDED: EXIT.actionRequired,
  TASK_BUDGET_UNVERIFIABLE: EXIT.actionRequired,
  // External tools (yt-dlp, ffmpeg) and links
  TOOL_UNAVAILABLE: EXIT.actionRequired,
  TOOL_CONSENT_REQUIRED: EXIT.actionRequired,
  TOOL_UPDATE_CONFIRM_REQUIRED: EXIT.actionRequired,
  TOOL_UPDATE_MANUAL: EXIT.actionRequired,
  MEDIA_TOOL_UNAVAILABLE: EXIT.actionRequired,
  EXPORT_TOOL_MISSING: EXIT.actionRequired,
  LINK_LOGIN_REQUIRED: EXIT.actionRequired,
  LINK_COOKIES_UNAVAILABLE: EXIT.actionRequired,
  LINK_TOOL_UPDATE_REQUIRED: EXIT.actionRequired,
  // Voices
  VOICE_CONSENT_REQUIRED: EXIT.actionRequired,
  VOICE_CLONE_REQUIRED: EXIT.actionRequired,
  // Runtime
  RUNTIME_UNAVAILABLE: EXIT.runtimeUnavailable,
  RUNTIME_START_FAILED: EXIT.runtimeUnavailable,
  PROTOCOL_MISMATCH: EXIT.runtimeUnavailable,
  INTERFACE_VERSION_MISMATCH: EXIT.runtimeUnavailable,
  CATALOG_UNAVAILABLE: EXIT.runtimeUnavailable,
  // The Runtime is running but cannot be stopped: it was not started by the CLI, or someone is still using it. This is a failure, not Runtime unavailable.
  RUNTIME_NOT_OWNED: EXIT.failed,
  RUNTIME_IN_USE: EXIT.failed,
  // The instructions (`catalog.agentSkill`) are missing or wrong: a problem with the installation or the instructions themselves, not with the arguments, and not Runtime unavailability.
  AGENT_SKILL_NOT_FOUND: EXIT.failed,
  AGENT_SKILL_INVALID: EXIT.failed,
  // Arguments
  INVALID_ARGUMENTS: EXIT.invalidArguments,
  UNKNOWN_COMMAND: EXIT.invalidArguments,
  UNKNOWN_TOOL: EXIT.invalidArguments,
  CONFIRMATION_REQUIRED: EXIT.invalidArguments,
};

export function exitCodeFor(code: string): ExitCode {
  return EXIT_BY_CODE[code] ?? EXIT.failed;
}

/** The task ends in failure or cancellation: the table is looked up by the task's error code, but the result is at least 1 (a task's error code is never 3 or 4, which are reserved for argument or Runtime problems). */
export function exitCodeForJob(code: string | null | undefined): ExitCode {
  const mapped = code ? exitCodeFor(code) : EXIT.failed;
  return mapped === EXIT.actionRequired ? mapped : EXIT.failed;
}

/** Problems discovered by the CLI itself: they carry an error code, and finally `main` wraps them as a failure envelope. */
export class CliError extends Error {
  readonly code: string;
  readonly extra: Record<string, unknown>;

  constructor(code: string, message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.name = 'CliError';
    this.code = code;
    this.extra = extra;
  }

  body(): CatalogToolError {
    return { code: this.code, message: this.message, ...this.extra };
  }
}

export interface OutputOptions {
  /** JSON for writing the envelope; if not given, it depends on whether stdout is a TTY. */
  json?: boolean | undefined;
  stdout?: NodeJS.WritableStream & { isTTY?: boolean };
  stderr?: NodeJS.WritableStream & { isTTY?: boolean };
}

/** Output of one command: where the envelope is written and in what form. */
export class Output {
  readonly json: boolean;
  readonly stdout: NodeJS.WritableStream & { isTTY?: boolean };
  readonly stderr: NodeJS.WritableStream & { isTTY?: boolean };
  /** The Runtime was started automatically this time: written into the envelope. */
  runtimeStarted = false;

  constructor(options: OutputOptions = {}) {
    this.stdout = options.stdout ?? process.stdout;
    this.stderr = options.stderr ?? process.stderr;
    this.json = options.json ?? !this.stdout.isTTY;
  }

  /** Writes a successful envelope and returns exit code 0. If `next` is not given, takes the top-level `next` of the result; `next` appears only once, at the envelope's top level, and is removed from the result. */
  success(result: unknown, next?: string | null): ExitCode {
    const hint = next ?? nextOf(result);
    const body = withoutNext(result);
    const envelope: Envelope = { ok: true, result: body, ...(hint ? { next: hint } : {}), ...this.#runtime() };
    if (this.json) this.stdout.write(`${JSON.stringify(envelope)}\n`);
    else {
      const text = renderHuman(body);
      if (text) this.stdout.write(`${text}\n`);
      if (hint) this.stdout.write(`${M.nextLabel}: ${hint}\n`);
      if (this.runtimeStarted) this.stderr.write(`${M.runtimeStartedNote}\n`);
    }
    return EXIT.ok;
  }

  /**
   * Admin-bucket success: with `--json` it is the same as `success` (the result is the protocol method's raw result); for human reading, it prints the handwritten few lines, without the generic layout.
   */
  report(result: unknown, lines: readonly string[], next?: string | null): ExitCode {
    if (this.json) return this.success(result, next ?? null);
    for (const line of lines) this.stdout.write(`${line}\n`);
    if (next) this.stdout.write(`${M.nextLabel}: ${next}\n`);
    if (this.runtimeStarted) this.stderr.write(`${M.runtimeStartedNote}\n`);
    return EXIT.ok;
  }

  /** Writes a failure envelope and returns the exit code looked up from the error code (or the one passed by the caller). */
  failure(error: CatalogToolError, exitCode: ExitCode = exitCodeFor(error.code)): ExitCode {
    const envelope: Envelope = { ok: false, error, ...this.#runtime() };
    if (this.json) this.stdout.write(`${JSON.stringify(envelope)}\n`);
    else this.stderr.write(`${renderError(error)}\n`);
    return exitCode;
  }

  /** Bare JSON (`spec`, `version`): no envelope; even for human reading it is indented JSON. */
  raw(value: unknown): ExitCode {
    this.stdout.write(`${this.json ? JSON.stringify(value) : JSON.stringify(value, null, 2)}\n`);
    return EXIT.ok;
  }

  /** Plain text (`--help`, `help <command>`). */
  text(text: string): ExitCode {
    this.stdout.write(text.endsWith('\n') ? text : `${text}\n`);
    return EXIT.ok;
  }

  #runtime(): { runtime?: { started: true } } {
    return this.runtimeStarted ? { runtime: { started: true } } : {};
  }
}

function nextOf(result: unknown): string | null {
  return isRecord(result) && typeof result.next === 'string' ? result.next : null;
}

function withoutNext(result: unknown): unknown {
  if (!isRecord(result) || !('next' in result)) return result;
  const { next: _next, ...rest } = result;
  return rest;
}

/** How a failure looks to a human: one line with the error code and description, followed by remedy and next steps. */
export function renderError(error: CatalogToolError): string {
  const message = localizeText(error.message, isMessageRef(error.messageRef) ? error.messageRef : null);
  const lines = [`${M.errorLabel} ${error.code}: ${message}`];
  const remedy = error.remedy;
  if (typeof remedy === 'string') lines.push(`  ${remedyText(error)}`);
  else if (isRecord(remedy)) {
    const hint = remedyHintText(remedy);
    if (hint !== null) lines.push(`  ${hint}`);
    if (Array.isArray(remedy.commands)) for (const command of remedy.commands) lines.push(`    ${String(command)}`);
  }
  // Engine errors carry message references: rewrite the description and remedy in the CLI's interface language.
  if (typeof error.recovery === 'string')
    lines.push(`  ${localizeText(error.recovery, isMessageRef(error.recoveryRef) ? error.recoveryRef : null)}`);
  const rest = Object.fromEntries(
    Object.entries(error).filter(
      ([key]) => !['code', 'message', 'messageRef', 'remedy', 'remedyRef', 'recovery', 'recoveryRef', 'next'].includes(key),
    ),
  );
  const detail = renderHuman(rest);
  if (detail) lines.push(indent(detail, '  '));
  if (typeof error.next === 'string') lines.push(`${M.nextLabel}: ${error.next}`);
  return lines.join('\n');
}

/**
 * Human-readable format: another layout of JSON (indented “key: value”), without a separate renderer for each tool. Scalars on one line; short scalar arrays on one line;
 * multi-line strings are indented as blocks.
 */
export function renderHuman(value: unknown): string {
  return lines(value, '').join('\n');
}

function lines(value: unknown, pad: string): string[] {
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${pad}[]`];
    if (value.every(isScalar) && value.map(scalar).join(', ').length <= 100) return [`${pad}${value.map(scalar).join(', ')}`];
    const out: string[] = [];
    for (const item of value) {
      const inner = lines(item, `${pad}  `);
      out.push(`${pad}- ${inner[0]!.slice(pad.length + 2)}`, ...inner.slice(1));
    }
    return out;
  }
  if (isRecord(value)) {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return pad ? [`${pad}{}`] : [];
    const out: string[] = [];
    for (const [key, item] of entries) {
      if (isScalar(item) && !(typeof item === 'string' && item.includes('\n'))) out.push(`${pad}${key}: ${scalar(item)}`);
      else if (typeof item === 'string') out.push(`${pad}${key}: |`, ...item.split('\n').map((line) => `${pad}  ${line}`));
      else if ((Array.isArray(item) && item.length === 0) || (isRecord(item) && Object.keys(item).length === 0)) {
        out.push(`${pad}${key}: ${Array.isArray(item) ? '[]' : '{}'}`);
      } else if (Array.isArray(item) && item.every(isScalar) && item.map(scalar).join(', ').length <= 100) {
        out.push(`${pad}${key}: ${item.map(scalar).join(', ')}`);
      } else out.push(`${pad}${key}:`, ...lines(item, `${pad}  `));
    }
    return out;
  }
  return [`${pad}${scalar(value)}`];
}

function isScalar(value: unknown): value is string | number | boolean | null {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function scalar(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function indent(text: string, pad: string): string {
  return text
    .split('\n')
    .map((line) => `${pad}${line}`)
    .join('\n');
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
