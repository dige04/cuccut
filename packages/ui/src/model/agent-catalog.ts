import { defineMessages, DRIVER_ID_PATTERN, isBuiltinDriverId, RpcError, type DriverId, type DriverInfo } from '@cuccut/protocol';
import type { AcpCatalogEntry } from './acp-catalog.ts';
import { zhHans } from './agent-catalog.zh-Hans.ts';
import { zhHant } from './agent-catalog.zh-Hant.ts';
import { ja } from './agent-catalog.ja.ts';
import { ko } from './agent-catalog.ko.ts';
import { es } from './agent-catalog.es.ts';
import { fr } from './agent-catalog.fr.ts';
import { de } from './agent-catalog.de.ts';
import { nl } from './agent-catalog.nl.ts';
import { ptBR } from './agent-catalog.pt-BR.ts';
import { it } from './agent-catalog.it.ts';
import { ru } from './agent-catalog.ru.ts';
import { pl } from './agent-catalog.pl.ts';
import { tr } from './agent-catalog.tr.ts';
import { vi } from './agent-catalog.vi.ts';

/** Copy for custom agent form validation (the English is the source of keys and types; translations are in `agent-catalog.zh-Hans.ts`). */
const en = {
  idEmpty: 'Enter an id, for example my-agent',
  idPattern: 'The id must start with a lowercase letter and use only lowercase letters, digits, and hyphens',
  idTooLong: 'The id can be at most 63 characters',
  idBuiltin: (id: string, who: string | null) => `“${id}” is the id of a built-in CucCut agent${who ? ` (${who})` : ''}. Choose another id`,
  idTaken: (id: string, who: string | null) => `An agent${who ? ` (${who})` : ''} already uses “${id}”. Choose another id`,
  nameEmpty: 'Enter a name to show in the list',
  nameTooLong: (max: number) => `The name can be at most ${max} characters`,
  commandEmpty: 'Enter the command that starts it, for example my-agent --acp',
  commandShell: 'Enter a single command: CucCut starts it directly, not through a shell, so pipes, redirects, and && don’t work',
  tooManyArgs: (max: number) => `Too many arguments: up to ${max}`,
  envLine: (line: number) => `Line ${line} must be KEY=VALUE, with KEY starting with a letter or underscore`,
};
export type AgentCatalogMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * Pure layer for Settings › Agent “Add more agents” (prototype designs/cuccut/app/model-agent-catalog.js, product design §7.6): catalog search, splitting custom commands, parsing and validating environment variables, displaying the launch command, and grouping built-in agents (always in the main list / collapsed under “More”).
 * The view only composes; adding and removing goes through `agents.addProvider` / `agents.removeProvider`, and the UI does not store added agents locally.
 */

/** Of the nine built-in agents, the four connected via ACP that are collapsed into the “More” section; the other five always appear in the main list, even when not installed. */
export const MORE_BUILTIN_IDS: readonly DriverId[] = ['gemini', 'cursor', 'grok', 'kimi'];

/** Added by the user (`agents.addProvider`); can be removed. Built-in ones can only be disabled. */
export function isCustomDriver(driver: Pick<DriverInfo, 'source'>): boolean {
  return driver.source === 'custom';
}

/**
 * Agent picker for sessions and tools (prototype model-agent.js `listed`): all detected agents are included. Undetected ones are included only if they are built-in agents in the always-visible main list (with an install hint). The four in “More” and user-added agents are left out when not detected, since a row of “not installed” entries would bury the one that works.
 */
export function listedInPicker(driver: Pick<DriverInfo, 'id' | 'state' | 'source'>): boolean {
  if (driver.state !== 'not-installed') return true;
  return driver.source !== 'custom' && !MORE_BUILTIN_IDS.includes(driver.id);
}

// ---- Catalog ----

export interface CatalogRow extends AcpCatalogEntry {
  /** Already added: the row shows “Added” instead. */
  added: boolean;
}

const norm = (text: unknown) => String(text ?? '').toLowerCase();

/**
 * Catalog search: split the query on whitespace; each term must appear in the name, id, description, or command (case-insensitive). An empty query returns everything, in catalog order.
 * Entries whose ids are in `addedIds` are marked `added`.
 */
export function searchCatalog(catalog: readonly AcpCatalogEntry[], query: string, addedIds: Iterable<DriverId>): CatalogRow[] {
  const taken = new Set(addedIds);
  const words = norm(query).split(/\s+/).filter(Boolean);
  return catalog
    .filter((e) => {
      const hay = norm([e.name, e.id, e.description, e.command.join(' ')].join(' '));
      return words.every((w) => hay.includes(w));
    })
    .map((e) => ({ ...e, added: taken.has(e.id) }));
}

// ---- Custom command ----

/** The command line is split on whitespace into an array; a segment wrapped in double or single quotes counts as one argument (the quotes themselves are removed). */
export function splitCommand(line: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  for (let m = re.exec(line); m; m = re.exec(line)) out.push(m[1] ?? m[2] ?? m[3] ?? '');
  return out;
}

/** Environment variable name: matches the protocol (starts with a letter or underscore; letters, digits, and underscores; at most 128 characters). */
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

/** Environment variables: one KEY=VALUE per line; blank lines are ignored. `bad` is the line number (counting from 1) of the first malformed line; null if there is none. */
export function parseEnv(text: string): { env: Record<string, string>; bad: number | null } {
  const env: Record<string, string> = {};
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!.trim();
    if (!line) continue;
    const at = line.indexOf('=');
    const key = at > 0 ? line.slice(0, at).trim() : '';
    if (!ENV_NAME.test(key)) return { env, bad: i + 1 };
    env[key] = line.slice(at + 1).trim();
  }
  return { env, bad: null };
}

export interface Launcher {
  kind: 'npx' | 'uvx';
  /** Package name with version, e.g. `cline@3.0.46`, `fast-agent-acp==0.9.22`. */
  spec: string;
  /** What must already be on this computer. */
  needs: string;
}

const LAUNCHER_NEEDS = { npx: 'Node.js', uvx: 'uv' } as const;

/** Packages the package manager fetches and runs on demand (`npx -y pkg@version`, `uvx --from pkg==version …`) need no separate install; otherwise null. */
export function launcherOf(command: readonly string[]): Launcher | null {
  const [exe, ...rest] = command;
  if (exe !== 'npx' && exe !== 'uvx') return null;
  const from = rest.indexOf('--from');
  const spec = exe === 'uvx' && from >= 0 ? rest[from + 1] : rest.find((t) => !t.startsWith('-'));
  return spec ? { kind: exe, spec, needs: LAUNCHER_NEEDS[exe] } : null;
}

export interface CustomForm {
  id: string;
  name: string;
  command: string;
  env: string;
}

export type CustomErrors = Partial<Record<keyof CustomForm, string>>;

const NAME_MAX = 100;
const ARGS_MAX = 64;
const SHELL_OPERATOR = /^(\||\|\||&&|;|>|>>|<)$/;

/**
 * Validation for the custom command form (prototype `validateCustom`; the constraints match the protocol's `agents.addProvider`): errors are given per field, and fields without errors do not appear.
 * `takenIds` = the built-in, added, and catalog ids; a clash prompts the user to pick another, and `names` says which agent it clashes with.
 */
export function validateCustom(form: CustomForm, takenIds: Iterable<DriverId>, names: Readonly<Record<string, string>> = {}): CustomErrors {
  const err: CustomErrors = {};
  const id = form.id.trim();
  const taken = new Set(takenIds);
  const who = names[id] && names[id] !== id ? names[id]! : null;
  if (!id) err.id = M.idEmpty;
  else if (!/^[a-z][a-z0-9-]*$/.test(id)) err.id = M.idPattern;
  else if (!DRIVER_ID_PATTERN.test(id)) err.id = M.idTooLong;
  else if (isBuiltinDriverId(id)) err.id = M.idBuiltin(id, who);
  else if (taken.has(id)) err.id = M.idTaken(id, who);
  const name = form.name.trim();
  if (!name) err.name = M.nameEmpty;
  else if (name.length > NAME_MAX) err.name = M.nameTooLong(NAME_MAX);
  const cmd = splitCommand(form.command);
  if (!cmd.length) err.command = M.commandEmpty;
  else if (cmd.some((t) => SHELL_OPERATOR.test(t)) || /[|;&<>]/.test(cmd[0]!)) {
    err.command = M.commandShell;
  } else if (cmd.length > ARGS_MAX) err.command = M.tooManyArgs(ARGS_MAX);
  const env = parseEnv(form.env);
  if (env.bad) err.env = M.envLine(env.bad);
  return err;
}

export const hasErrors = (err: CustomErrors) => Object.keys(err).length > 0;

/** Form → `agents.addProvider` arguments (validated first). When no environment variables are entered, `env` is not passed. */
export function customRequest(form: CustomForm): { id: DriverId; name: string; command: string[]; env?: Record<string, string> } {
  const { env } = parseEnv(form.env);
  return {
    id: form.id.trim(),
    name: form.name.trim(),
    command: splitCommand(form.command),
    ...(Object.keys(env).length ? { env } : {}),
  };
}

/** Catalog entry → `agents.addProvider` arguments. */
export function catalogRequest(entry: AcpCatalogEntry): { id: DriverId; name: string; command: string[]; env?: Record<string, string> } {
  return { id: entry.id, name: entry.name, command: [...entry.command], ...(entry.env ? { env: { ...entry.env } } : {}) };
}

const quoteArg = (t: string) => (/\s/.test(t) || t === '' ? `"${t}"` : t);

/**
 * Display of the launch command: the full line, with environment variables first. When `env` has values (catalog entries), they are shown as written; after an agent is added, the Runtime only provides environment variable names (`DriverInfo.custom.envKeys`, since values may be secrets), so they are shown as `KEY=…`.
 */
export function launchLine(command: readonly string[], env?: Readonly<Record<string, string>> | readonly string[]): string {
  const vars = Array.isArray(env)
    ? (env as readonly string[]).map((k) => `${k}=…`)
    : Object.entries((env as Record<string, string> | undefined) ?? {}).map(([k, v]) => `${k}=${quoteArg(v)}`);
  return [...vars, ...command.map(quoteArg)].join(' ');
}

/** Command the added agent uses to log in from a terminal: npx / uvx fetch and run it on demand, so it starts the agent itself (without the ACP arguments); anything else starts its program directly (prototype `loginCmd`). */
export function customLoginCommand(command: readonly string[]): string {
  const launcher = launcherOf(command);
  if (launcher) {
    const at = command.indexOf(launcher.spec);
    if (at > 0) return command.slice(0, at + (launcher.kind === 'uvx' ? 2 : 1)).join(' ');
  }
  return command[0] ?? '';
}

/** `agents.addProvider` rejected because the id already exists (`conflict`, `details.code: 'AGENT_PROVIDER_EXISTS'`): the UI writes it back into the id field. */
export function isProviderExists(error: unknown): boolean {
  if (!(error instanceof RpcError) || error.code !== 'conflict') return false;
  const details = error.details as { code?: unknown } | null | undefined;
  return details?.code === 'AGENT_PROVIDER_EXISTS';
}
