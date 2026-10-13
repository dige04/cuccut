import { statSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fieldFlagName } from '@cuccut/protocol';
import { M } from '../cli-copy.ts';
import { CliError, isRecord } from '../envelope.ts';
import type { CatalogCommand } from './command-tree.ts';

/**
 * Command line → tool arguments (agent-surface design §5.3). Flags are derived from the JSON Schema of the catalog entry, not written by hand:
 *
 * - Field names `camelCase` → `--kebab-case` (`documentId` → `--document-id`); both `--flag=value` and `--flag value` work.
 * - Booleans are switches; `--no-x` gives false. A field whose name itself starts with `no` (`noVideo`) is matched directly as `--no-video` by its field name, not treated as a negation.
 *   Those that can be boolean or something else (`export.bilingual`, `loudness`) are also switches; other values are written as `--x=<value>`.
 * - Numbers are parsed as decimal; enums and fixed values (`sampleRate`) are checked on the spot.
 * - Arrays may be given repeatedly (`--glossary a --glossary b`), or as one JSON array; elements that are enums or have a fixed format (`kinds`, `at`) may also be comma-separated.
 * - Objects and arrays of objects take a JSON literal, `@file`, or `-` (stdin); a `{start, end}` range can be written `a:b`, and a `{num, den}` frame rate can be written
 *   `30000/1001` or `30`.
 * - Text fields without a fixed format (`speak --text`, large text other than `documents put`) accept `@file` and `-`; to pass a literal starting with `@`, write `@@`.
 * - There is only one positional argument, specified by the catalog entry's `positional`; it is mutually exclusive with the flag of the same name. When `positional` is an array (`files` of `transcode`), all positional arguments are accepted.
 * - The catalog entry's `cliSwitches` are shortcut switches: `transcribe --replace` equals `--target replace`, and is mutually exclusive with the flag for that field.
 *
 * The CLI's reserved flags are in `GLOBAL_FLAGS`; flags derived from catalog fields must not share their names (`dryRun` and `project` are intentional, see below).
 */

export interface GlobalFlags {
  /** `--json` / `--no-json`; if not given, it depends on whether stdout is a TTY. */
  json: boolean | undefined;
  /** `--project <directory or id>`. */
  project: string | undefined;
  yes: boolean;
  /** `--wait` / `--no-wait`; if not given, commands that return a task wait by default. */
  wait: boolean | undefined;
  /** `--timeout <seconds>`: upper limit on waiting. */
  timeout: number | undefined;
  /** `--progress jsonl|text`。 */
  progress: 'jsonl' | 'text' | undefined;
  maxBytes: number;
  /** `--result-file <file>`: the full result is written to this file (§5.5). `--out` is not the CLI's; it is left for the tool's own `out` field. */
  resultFile: string | undefined;
  noStart: boolean;
  dryRun: boolean;
  help: boolean;
}

/** Default result budget (§5.5): when exceeded, the result is written to a file and stdout gets only a summary. */
export const DEFAULT_MAX_BYTES = 64 * 1024;

/**
 * CLI-reserved flags. `--dry-run` maps to tools that have a `dryRun` field (`edits apply`), and `--project` applies both to the project of `catalog.call` and to tools that have a `project` field; other flags derived from fields must not share these names (checked by `catalog-snapshot.test.ts`).
 */
export const GLOBAL_FLAGS = [
  'json',
  'no-json',
  'project',
  'yes',
  'wait',
  'no-wait',
  'timeout',
  'progress',
  'max-bytes',
  'result-file',
  'no-start',
  'dry-run',
  'help',
] as const;

const VALUE_FLAGS = new Set(['project', 'timeout', 'progress', 'max-bytes', 'result-file']);

export function defaultGlobals(): GlobalFlags {
  return {
    json: undefined,
    project: undefined,
    yes: false,
    wait: undefined,
    timeout: undefined,
    progress: undefined,
    maxBytes: DEFAULT_MAX_BYTES,
    resultFile: undefined,
    noStart: false,
    dryRun: false,
    help: false,
  };
}

/** Takes the CLI's own flags out of the command line (they may appear anywhere; those after `--` do not count); the rest are left as they are. */
export function extractGlobals(argv: readonly string[]): { globals: GlobalFlags; rest: string[] } {
  const globals = defaultGlobals();
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (token === '--') {
      rest.push(...argv.slice(i));
      break;
    }
    if (token === '-h') {
      globals.help = true;
      continue;
    }
    if (!token.startsWith('--')) {
      rest.push(token);
      continue;
    }
    const eq = token.indexOf('=');
    const name = token.slice(2, eq < 0 ? undefined : eq);
    if (!(GLOBAL_FLAGS as readonly string[]).includes(name)) {
      rest.push(token);
      continue;
    }
    let value: string | undefined = eq < 0 ? undefined : token.slice(eq + 1);
    if (VALUE_FLAGS.has(name) && value === undefined) {
      value = argv[i + 1];
      if (value === undefined) throw invalid(M.missingValue(`--${name}`));
      i++;
    } else if (!VALUE_FLAGS.has(name) && value !== undefined) {
      throw invalid(M.noValueExpected(`--${name}`));
    }
    switch (name) {
      case 'json':
      case 'no-json':
        globals.json = name === 'json';
        break;
      case 'project':
        globals.project = value;
        break;
      case 'yes':
        globals.yes = true;
        break;
      case 'wait':
      case 'no-wait':
        globals.wait = name === 'wait';
        break;
      case 'timeout': {
        const seconds = Number(value);
        if (!value || !Number.isFinite(seconds) || seconds <= 0) throw invalid(M.badNumber('--timeout', value ?? ''));
        globals.timeout = seconds;
        break;
      }
      case 'progress':
        if (value !== 'jsonl' && value !== 'text') throw invalid(M.badChoice('--progress', value ?? '', ['jsonl', 'text']));
        globals.progress = value;
        break;
      case 'max-bytes': {
        const bytes = Number(value);
        if (!value || !Number.isInteger(bytes) || bytes <= 0) throw invalid(M.badInteger('--max-bytes', value ?? ''));
        globals.maxBytes = bytes;
        break;
      }
      case 'result-file':
        globals.resultFile = value;
        break;
      case 'no-start':
        globals.noStart = true;
        break;
      case 'dry-run':
        globals.dryRun = true;
        break;
      case 'help':
        globals.help = true;
        break;
    }
  }
  return { globals, rest };
}

/** Reads `@file` and `-` (stdin). Injected in tests. */
export interface InputSource {
  readFile(file: string): Promise<string>;
  readStdin(): Promise<string>;
  cwd: string;
}

export function processInput(cwd: string): InputSource {
  return {
    cwd,
    readFile: (file) => fs.readFile(path.resolve(cwd, file), 'utf8'),
    readStdin: async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
      return Buffer.concat(chunks).toString('utf8');
    },
  };
}

type Schema = Record<string, unknown>;

/** A flag derived from one field. */
export interface FlagSpec {
  field: string;
  flag: string;
  schema: Schema;
  required: boolean;
  /** Switch: takes no value (a boolean, or an anyOf containing a boolean branch). */
  switch: boolean;
  array: boolean;
}

/** `documentId` → `document-id`。 */
export function kebab(field: string): string {
  return fieldFlagName(field);
}

export function flagSpecs(schema: Schema): FlagSpec[] {
  const properties = (isRecord(schema.properties) ? schema.properties : {}) as Record<string, Schema>;
  const required = new Set(Array.isArray(schema.required) ? (schema.required as string[]) : []);
  return Object.entries(properties).map(([field, property]) => ({
    field,
    flag: kebab(field),
    schema: property,
    required: required.has(field),
    switch: hasBoolean(property),
    array: property.type === 'array',
  }));
}

function hasBoolean(schema: Schema): boolean {
  if (schema.type === 'boolean') return true;
  return Array.isArray(schema.anyOf) && (schema.anyOf as Schema[]).some((branch) => branch.type === 'boolean');
}

/** Parses the arguments of one derived command (the part after the command name; the CLI's own flags have already been removed). */
export async function parseToolArgs(
  command: CatalogCommand,
  argv: readonly string[],
  globals: GlobalFlags,
  input: InputSource,
): Promise<Record<string, unknown>> {
  const { tool } = command;
  const specs = flagSpecs(tool.inputSchema);
  const byFlag = new Map(specs.map((spec) => [spec.flag, spec]));
  const reader = new Reader(input);
  const args: Record<string, unknown> = {};
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (token === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (!token.startsWith('--') || token.length === 2) {
      positionals.push(token);
      continue;
    }
    const eq = token.indexOf('=');
    const name = token.slice(2, eq < 0 ? undefined : eq);
    const inline = eq < 0 ? undefined : token.slice(eq + 1);
    let spec = byFlag.get(name);
    const shortcut = spec ? undefined : tool.cliSwitches?.find((entry) => entry.flag === name);
    if (shortcut) {
      if (inline !== undefined) throw invalid(M.noValueExpected(`--${name}`));
      const target = specs.find((entry) => entry.field === shortcut.field);
      if (!target) throw invalid(M.unknownFlag(`--${name}`, command.display), { flag: `--${name}` });
      setOnce(args, target, shortcut.value);
      continue;
    }
    let negated = false;
    if (!spec && name.startsWith('no-')) {
      const base = byFlag.get(name.slice(3));
      if (base?.switch) {
        spec = base;
        negated = true;
      }
    }
    if (!spec) throw invalid(M.unknownFlag(`--${name}`, command.display), { flag: `--${name}` });
    if (negated) {
      if (inline !== undefined) throw invalid(M.noValueExpected(`--${name}`));
      setOnce(args, spec, false);
      continue;
    }
    if (spec.switch) {
      setOnce(args, spec, inline === undefined ? true : await coerce(spec.schema, inline, `--${spec.flag}`, reader));
      continue;
    }
    let raw = inline;
    if (raw === undefined) {
      raw = argv[i + 1];
      if (raw === undefined || (raw.startsWith('--') && raw.length > 2)) throw invalid(M.missingValue(`--${spec.flag}`));
      i++;
    }
    if (spec.array) {
      const items = await arrayItems(spec.schema, raw, `--${spec.flag}`, reader);
      args[spec.field] = [...((args[spec.field] as unknown[] | undefined) ?? []), ...items];
    } else {
      setOnce(args, spec, await coerce(spec.schema, raw, `--${spec.flag}`, reader));
    }
  }

  // Positional argument: only the field specified by `positional`; mutually exclusive with the flag of the same name.
  if (positionals.length > 0) {
    const spec = tool.positional ? specs.find((s) => s.field === tool.positional) : undefined;
    if (!spec) throw invalid(M.noPositional(command.display, positionals[0]!));
    if (args[spec.field] !== undefined) throw invalid(M.positionalAndFlag(spec.field, `--${spec.flag}`));
    if (spec.array) {
      const items: unknown[] = [];
      for (const raw of positionals) items.push(...(await arrayItems(spec.schema, raw, `<${spec.field}>`, reader)));
      args[spec.field] = items;
    } else {
      if (positionals.length > 1) throw invalid(M.tooManyPositionals(command.display, positionals.slice(1).join(' ')));
      args[spec.field] = await coerce(spec.schema, positionals[0]!, `<${spec.field}>`, reader);
    }
  }

  if (globals.dryRun) {
    if (!specs.some((spec) => spec.field === 'dryRun')) throw invalid(M.dryRunUnsupported(command.display));
    args.dryRun = true;
  }
  if (globals.project !== undefined && specs.some((spec) => spec.field === 'project') && args.project === undefined) {
    args.project = projectArgument(globals.project, input.cwd);
  }

  const missing = specs.filter((spec) => spec.required && args[spec.field] === undefined);
  if (missing.length > 0) {
    const names = missing.map((spec) => (spec.field === tool.positional ? `<${spec.field}> / --${spec.flag}` : `--${spec.flag}`));
    throw invalid(M.missingRequired(names.join(', '), command.display), { missing: missing.map((spec) => `--${spec.flag}`) });
  }
  return args;
}

/** `--project` gives the tool its `project` field: when it is a directory, the absolute path (the tool recognizes paths of registered project directories); otherwise the value is used as-is as the project id. */
function projectArgument(value: string, cwd: string): string {
  return projectDirectory(value, cwd) ?? value;
}

/** `--project` is resolved against cwd into an existing directory (absolute path); null when it is not a directory (it may be a project id). */
export function projectDirectory(value: string, cwd: string): string | null {
  const dir = path.resolve(cwd, value);
  try {
    return statSync(dir).isDirectory() ? dir : null;
  } catch {
    return null;
  }
}

function setOnce(args: Record<string, unknown>, spec: FlagSpec, value: unknown): void {
  if (args[spec.field] !== undefined) throw invalid(M.duplicateFlag(`--${spec.flag}`));
  args[spec.field] = value;
}

/** Source of `@file` and `-`; stdin can only be read once. */
class Reader {
  readonly #input: InputSource;
  #stdinUsed = false;

  constructor(input: InputSource) {
    this.#input = input;
  }

  async read(raw: string, flag: string): Promise<string> {
    if (raw === '-') {
      if (this.#stdinUsed) throw invalid(M.stdinTwice(flag));
      this.#stdinUsed = true;
      return this.#input.readStdin();
    }
    const file = raw.slice(1);
    try {
      return await this.#input.readFile(file);
    } catch (error) {
      throw invalid(M.readFileFailed(flag, file, error instanceof Error ? error.message : String(error)));
    }
  }

  async json(raw: string, flag: string): Promise<unknown> {
    const text = raw === '-' || raw.startsWith('@') ? await this.read(raw, flag) : raw;
    try {
      return JSON.parse(text) as unknown;
    } catch (error) {
      throw invalid(M.badJson(flag, error instanceof Error ? error.message : String(error)));
    }
  }
}

/** One occurrence of an array field: either the whole JSON array, or one element (enum and fixed-format elements may be comma-separated). */
async function arrayItems(schema: Schema, raw: string, flag: string, reader: Reader): Promise<unknown[]> {
  const items = (isRecord(schema.items) ? schema.items : {}) as Schema;
  if (raw.startsWith('[') || raw === '-' || (raw.startsWith('@') && items.type === 'object')) {
    const parsed = await reader.json(raw, flag);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  if (items.type === 'string' && (Array.isArray(items.enum) || typeof items.pattern === 'string') && raw.includes(',')) {
    const parts = raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    return Promise.all(parts.map((part) => coerce(items, part, flag, reader, false)));
  }
  return [await coerce(items, raw, flag, reader, false)];
}

/** Converts a value into a JSON value according to the schema. When `files` is false, the text does not read `@file` (array elements). */
async function coerce(schema: Schema, raw: string, flag: string, reader: Reader, files = true): Promise<unknown> {
  if (Array.isArray(schema.anyOf)) {
    const branches = schema.anyOf as Schema[];
    if ((raw.startsWith('{') || raw.startsWith('[') || raw === '-' || raw.startsWith('@')) && branches.some((b) => b.type === 'object')) {
      return reader.json(raw, flag);
    }
    for (const branch of branches) {
      try {
        return await coerce(branch, raw, flag, reader, false);
      } catch {
        // Next branch.
      }
    }
    throw invalid(M.badValue(flag, raw));
  }
  if (schema.const !== undefined) {
    const value = schema.type === 'number' || schema.type === 'integer' ? Number(raw) : schema.type === 'boolean' ? raw === 'true' : raw;
    if (value !== schema.const) throw invalid(M.badValue(flag, raw));
    return value;
  }
  switch (schema.type) {
    case 'string': {
      if (Array.isArray(schema.enum)) {
        if (!(schema.enum as unknown[]).includes(raw)) throw invalid(M.badChoice(flag, raw, schema.enum as string[]));
        return raw;
      }
      if (files && typeof schema.pattern !== 'string') {
        if (raw === '-' || (raw.startsWith('@') && !raw.startsWith('@@'))) return reader.read(raw, flag);
        if (raw.startsWith('@@')) return raw.slice(1);
      }
      return raw;
    }
    case 'number':
    case 'integer': {
      const value = Number(raw);
      if (raw.trim() === '' || !Number.isFinite(value)) throw invalid(M.badNumber(flag, raw));
      if (schema.type === 'integer' && !Number.isInteger(value)) throw invalid(M.badInteger(flag, raw));
      return value;
    }
    case 'boolean':
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      throw invalid(M.badBoolean(flag, raw));
    case 'null':
      if (raw === 'null') return null;
      throw invalid(M.badValue(flag, raw));
    case 'object':
      return objectValue(schema, raw, flag, reader);
    case 'array':
      return arrayItems(schema, raw, flag, reader);
    default:
      // No type (free JSON): if it looks like JSON, parse it as JSON; otherwise treat it as a string.
      return raw.startsWith('{') || raw.startsWith('[') || raw === '-' || raw.startsWith('@') ? reader.json(raw, flag) : raw;
  }
}

const RANGE = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/;
const RATIO = /^(\d+)(?:\/(\d+))?$/;

/** Object: an `a:b` range, an `n/d` fraction, or JSON (literal, `@file`, `-`). */
async function objectValue(schema: Schema, raw: string, flag: string, reader: Reader): Promise<unknown> {
  const properties = isRecord(schema.properties) ? schema.properties : {};
  if ('start' in properties && 'end' in properties) {
    const range = RANGE.exec(raw);
    if (range) return { start: Number(range[1]), end: Number(range[2]) };
  }
  if ('num' in properties && 'den' in properties) {
    const ratio = RATIO.exec(raw);
    if (ratio) return { num: Number(ratio[1]), den: Number(ratio[2] ?? 1) };
  }
  // An object with only one text field (for example `--replace <itemId>`): a value that does not look like JSON, @file or - is that field's value.
  const single = soleTextField(schema);
  if (single && !(raw.startsWith('{') || raw === '-' || raw.startsWith('@'))) return { [single]: raw };
  const value = await reader.json(raw, flag);
  if (!isRecord(value)) throw invalid(M.expectedObject(flag));
  return value;
}

/** When an object has only one field and it is text, the name of that field (the command line can write its value directly). */
export function soleTextField(schema: Schema): string | null {
  const properties = isRecord(schema.properties) ? schema.properties : {};
  const keys = Object.keys(properties);
  if (keys.length !== 1) return null;
  const field = properties[keys[0]!];
  return isRecord(field) && field.type === 'string' ? keys[0]! : null;
}

function invalid(message: string, extra: Record<string, unknown> = {}): CliError {
  return new CliError('INVALID_ARGUMENTS', message, extra);
}
