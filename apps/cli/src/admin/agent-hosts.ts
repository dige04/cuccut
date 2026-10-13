import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { M } from './agent-hosts-copy.ts';

/**
 * External agent hosts (Agent-surface design §6.2, §8.6): where `cuccut skill install` and `cuccut mcp install` write, and how. Each host's location and format
 * were checked against that host's own CLI (noted beside each entry). All locations are computed from the environment variables of the current call (`HOME`, `CLAUDE_CONFIG_DIR`, `CODEX_HOME`),
 * and tests swap in temporary directories so the real config is never touched.
 *
 * Config writes always follow read, modify, atomically replace: only the CucCut entry is changed, and other keys are kept as they are. Config that cannot be read (broken JSON) throws an error instead of being overwritten.
 */

export const AGENT_HOSTS = ['claude-code', 'codex', 'cursor', 'gemini'] as const;
export type AgentHost = (typeof AGENT_HOSTS)[number];

export const HOST_LABELS: Record<AgentHost, string> = {
  'claude-code': 'Claude Code',
  codex: 'Codex',
  cursor: 'Cursor',
  gemini: 'Gemini CLI',
};

/** The name of CucCut's entry in the host's MCP config. */
export const MCP_ENTRY_NAME = 'cuccut';
/** Claude Code keeps the token in the `env` of its `settings.json`, and the MCP config's request headers reference it. */
export const MCP_TOKEN_ENV = 'CUCCUT_MCP_TOKEN';

export function parseAgentHost(value: string | undefined): AgentHost {
  if (!value) throw new Error(M.missingAgent(AGENT_HOSTS));
  if (!(AGENT_HOSTS as readonly string[]).includes(value)) throw new Error(M.unknownAgent(value, AGENT_HOSTS));
  return value as AgentHost;
}

/** User home directory: `HOME` (`USERPROFILE` on Windows), falling back to the system's when neither is set. */
export function userHome(env: NodeJS.ProcessEnv): string {
  return env.HOME || env.USERPROFILE || os.homedir();
}

/** Claude Code's config directory: `CLAUDE_CONFIG_DIR`, default `~/.claude`. */
function claudeConfigDir(env: NodeJS.ProcessEnv): string {
  return env.CLAUDE_CONFIG_DIR || path.join(userHome(env), '.claude');
}

/** Codex's directory: `CODEX_HOME`, default `~/.codex`. */
function codexHome(env: NodeJS.ProcessEnv): string {
  return env.CODEX_HOME || path.join(userHome(env), '.codex');
}

/**
 * The host's user-level skills directories (each skill is installed under it in `<id>/`):
 * Claude Code `~/.claude/skills` (`skills` under `CLAUDE_CONFIG_DIR`); Codex `~/.codex/skills` (`CODEX_HOME`); Cursor
 * `~/.cursor/skills`; Gemini CLI `~/.gemini/skills`.
 */
export function hostSkillsDir(host: AgentHost, env: NodeJS.ProcessEnv): string {
  switch (host) {
    case 'claude-code':
      return path.join(claudeConfigDir(env), 'skills');
    case 'codex':
      return path.join(codexHome(env), 'skills');
    case 'cursor':
      return path.join(userHome(env), '.cursor', 'skills');
    case 'gemini':
      return path.join(userHome(env), '.gemini', 'skills');
  }
}

// ---- MCP config ----

/** How the token is stored: `env` puts it in the host's environment-variable section and the config references it; `plaintext` writes it in clear text in the config file. */
export type TokenStorage = 'env' | 'plaintext';

export interface McpHostConfig {
  /** The file that CucCut's entry is written to. */
  file: string;
  tokenStorage: TokenStorage;
  /** For `env`: the file that holds the token, and the variable name. */
  envFile?: string;
  envVar?: string;
}

/** Where the host's MCP config lives and how the token is stored. */
export function mcpHostConfig(host: AgentHost, env: NodeJS.ProcessEnv): McpHostConfig {
  switch (host) {
    // `claude mcp add --scope user` writes to `~/.claude.json` (or `.claude.json` in that directory when `CLAUDE_CONFIG_DIR` is set), under
    // `mcpServers`. `${VAR}` in request headers is expanded, and the `env` section of `settings.json` can supply it.
    case 'claude-code':
      return {
        file: env.CLAUDE_CONFIG_DIR ? path.join(env.CLAUDE_CONFIG_DIR, '.claude.json') : path.join(userHome(env), '.claude.json'),
        tokenStorage: 'env',
        envFile: path.join(claudeConfigDir(env), 'settings.json'),
        envVar: MCP_TOKEN_ENV,
      };
    // The `url` and `http_headers` of `[mcp_servers.<name>]`. Codex has no environment-variable section of its own (`bearer_token_env_var` has to be exported in the shell that launches Codex), so the token is plaintext.
    case 'codex':
      return { file: path.join(codexHome(env), 'config.toml'), tokenStorage: 'plaintext' };
    // The `url` and `headers` of `mcpServers.<name>`. There is no environment-variable section, so the token is plaintext.
    case 'cursor':
      return { file: path.join(userHome(env), '.cursor', 'mcp.json'), tokenStorage: 'plaintext' };
    // The `url`, `type: 'http'` and `headers` of `mcpServers.<name>`. Variables in request headers are taken only from the process environment or `.env`, and names that look like tokens are filtered out,
    // so the token is plaintext.
    case 'gemini':
      return { file: path.join(userHome(env), '.gemini', 'settings.json'), tokenStorage: 'plaintext' };
  }
}

/** Whether the host config has this entry (user level). Throws when the config cannot be read. */
export function hasMcpEntry(host: AgentHost, env: NodeJS.ProcessEnv, name: string = MCP_ENTRY_NAME): boolean {
  const { file } = mcpHostConfig(host, env);
  if (host === 'codex') return codexSectionRange(readText(file) ?? '', name) !== null;
  const servers = readJson(file).mcpServers;
  return isRecord(servers) && Object.hasOwn(servers, name);
}

/**
 * The token this entry currently uses in the host config (read before replacing, to recognize the old client). JSON hosts: read `mcpServers.<name>.headers.Authorization`,
 * and follow Claude Code's `${VAR}` reference into the `env` of `settings.json`. Codex: read `Authorization = "…"` in that section (including its sub-tables).
 * Returns null when there is no such entry, no headers, or the token is not recognized. Throws when the config cannot be read.
 */
export function readMcpEntryToken(host: AgentHost, env: NodeJS.ProcessEnv, name: string = MCP_ENTRY_NAME): string | null {
  const config = mcpHostConfig(host, env);
  let header: string | null = null;
  if (host === 'codex') {
    const text = readText(config.file) ?? '';
    const range = codexSectionRange(text, name);
    if (!range) return null;
    for (const line of text.split('\n').slice(range.start, range.end)) {
      const match = /(?:^|[{,\s])"?Authorization"?\s*=\s*("(?:[^"\\]|\\.)*"|'[^']*')/.exec(line);
      if (!match) continue;
      const quoted = match[1]!;
      try {
        header = quoted.startsWith('"') ? (JSON.parse(quoted) as string) : quoted.slice(1, -1);
      } catch {
        header = null;
      }
      break;
    }
  } else {
    const servers = readJson(config.file).mcpServers;
    const server = isRecord(servers) ? servers[name] : undefined;
    const headers = isRecord(server) ? server.headers : undefined;
    const value = isRecord(headers) ? headers.Authorization : undefined;
    header = typeof value === 'string' ? value : null;
  }
  if (!header) return null;
  const token = header.replace(/^\s*Bearer\s+/i, '').trim();
  const reference = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(token) ?? /^\$([A-Za-z_][A-Za-z0-9_]*)$/.exec(token);
  if (!reference) return token || null;
  if (host !== 'claude-code') return null;
  const settings = readJson(config.envFile!);
  const value = isRecord(settings.env) ? settings.env[reference[1]!] : undefined;
  return typeof value === 'string' && value ? value : null;
}

/** The client id in a token: a token CucCut issues is `<clientId>.<secret>`; null when it does not have that shape. */
export function clientIdOfToken(token: string): string | null {
  return /^([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+$/.exec(token)?.[1] ?? null;
}

export interface McpEntry {
  name: string;
  url: string;
  token: string;
}

export interface WriteMcpOptions {
  /** The function that calls `claude`: when not given, it is looked up on `env.PATH`. If it is not found, or null is given, the config file is written directly. */
  runClaude?: ((args: string[]) => void) | null;
}

/** Writes (or replaces) this entry in the host config. Returns where it was written and how the token is stored. */
export function writeMcpEntry(host: AgentHost, env: NodeJS.ProcessEnv, entry: McpEntry, options: WriteMcpOptions = {}): McpHostConfig {
  const config = mcpHostConfig(host, env);
  const bearer = `Bearer ${entry.token}`;
  switch (host) {
    case 'claude-code': {
      // The token goes into the env of settings.json first, then the entry that references it is written. If that entry fails to write, the old value in env is put back (the old entry references the same variable).
      let previous: unknown;
      updateJson(config.envFile!, (settings) => {
        const envBlock = isRecord(settings.env) ? settings.env : {};
        previous = envBlock[config.envVar!];
        settings.env = { ...envBlock, [config.envVar!]: entry.token };
      });
      const header = `Authorization: Bearer \${${config.envVar}}`;
      const runClaude = options.runClaude === undefined ? claudeRunner(env) : options.runClaude;
      try {
        if (runClaude) {
          if (hasMcpEntry(host, env, entry.name)) runClaude(['mcp', 'remove', '--scope', 'user', entry.name]);
          runClaude(['mcp', 'add', '--scope', 'user', '--transport', 'http', entry.name, entry.url, '--header', header]);
        } else {
          updateJson(config.file, (root) => {
            const servers = isRecord(root.mcpServers) ? root.mcpServers : {};
            root.mcpServers = {
              ...servers,
              [entry.name]: { type: 'http', url: entry.url, headers: { Authorization: `Bearer \${${config.envVar}}` } },
            };
          });
        }
      } catch (error) {
        try {
          updateJson(config.envFile!, (settings) => {
            const envBlock: Record<string, unknown> = isRecord(settings.env) ? { ...settings.env } : {};
            if (previous === undefined) delete envBlock[config.envVar!];
            else envBlock[config.envVar!] = previous;
            settings.env = envBlock;
          });
        } catch {
          // If putting it back fails, never mind: the error reported is still the original one.
        }
        throw error;
      }
      return config;
    }
    case 'codex': {
      const text = readText(config.file) ?? '';
      const section = [
        `[mcp_servers.${entry.name}]`,
        `url = ${tomlString(entry.url)}`,
        `http_headers = { Authorization = ${tomlString(bearer)} }`,
      ];
      writeText(config.file, replaceCodexSection(text, entry.name, section.join('\n')));
      return config;
    }
    case 'cursor':
    case 'gemini': {
      updateJson(config.file, (root) => {
        const servers = isRecord(root.mcpServers) ? root.mcpServers : {};
        const value =
          host === 'gemini'
            ? { url: entry.url, type: 'http', headers: { Authorization: bearer } }
            : { url: entry.url, headers: { Authorization: bearer } };
        root.mcpServers = { ...servers, [entry.name]: value };
      });
      return config;
    }
  }
}

/** When `claude` is on PATH, returns the function that calls it, carrying this call's environment variables so that `CLAUDE_CONFIG_DIR` still applies. */
function claudeRunner(env: NodeJS.ProcessEnv): ((args: string[]) => void) | null {
  const command = findOnPath('claude', env);
  if (!command) return null;
  return (args) => {
    execFileSync(command, args, { env, stdio: ['ignore', 'ignore', 'pipe'], timeout: 30_000 });
  };
}

export function findOnPath(name: string, env: NodeJS.ProcessEnv): string | null {
  const dirs = (env.PATH ?? env.Path ?? '').split(path.delimiter).filter(Boolean);
  const exts = process.platform === 'win32' ? (env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';') : [''];
  for (const dir of dirs) {
    for (const ext of exts) {
      const file = path.join(dir, name + ext.toLowerCase());
      try {
        if (fs.statSync(file).isFile()) return file;
      } catch {
        // Next.
      }
    }
  }
  return null;
}

// ---- Codex TOML: recognizes only the `[mcp_servers.<name>]` section (and its sub-tables), without parsing the whole file ----

/** The lines occupied by `[mcp_servers.<name>]` and its sub-tables (`[mcp_servers.<name>.env]` etc.); null when there are none. */
export function codexSectionRange(text: string, name: string): { start: number; end: number } | null {
  const lines = text.split('\n');
  const own = (line: string) => {
    const header = /^\s*\[\s*([^\]]+?)\s*\]\s*(#.*)?$/.exec(line);
    if (!header || line.trimStart().startsWith('[[')) return null;
    const parts = header[1]!.split('.').map((part) => part.trim().replace(/^"(.*)"$/, '$1'));
    return parts[0] === 'mcp_servers' && parts[1] === name;
  };
  const start = lines.findIndex((line) => own(line) === true);
  if (start < 0) return null;
  let end = start + 1;
  while (end < lines.length) {
    const isHeader = /^\s*\[/.test(lines[end]!);
    if (isHeader && own(lines[end]!) !== true) break;
    end++;
  }
  // Blank lines after the section do not count as part of it.
  while (end > start + 1 && lines[end - 1]!.trim() === '') end--;
  return { start, end };
}

function replaceCodexSection(text: string, name: string, section: string): string {
  const range = codexSectionRange(text, name);
  if (!range) {
    const base = text.replace(/\s*$/, '');
    return `${base ? `${base}\n\n` : ''}${section}\n`;
  }
  const lines = text.split('\n');
  lines.splice(range.start, range.end - range.start, ...section.split('\n'));
  return lines.join('\n');
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

// ---- Files ----

function readText(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function readJson(file: string): Record<string, unknown> {
  const text = readText(file);
  if (text === null || text.trim() === '') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(M.invalidJson(file, error instanceof Error ? error.message : String(error)));
  }
  if (!isRecord(parsed)) throw new Error(M.notObject(file));
  return parsed;
}

/** Reads, modifies and writes back JSON. Keeps the file's original indentation (tabs, a few spaces, or the whole file on one line), its line endings, and whether it ends with a newline. New files use two spaces. */
function updateJson(file: string, change: (root: Record<string, unknown>) => void): void {
  const before = readText(file);
  const root = readJson(file);
  change(root);
  const blank = before === null || before.trim() === '';
  const eol = !blank && before.includes('\r\n') ? '\r\n' : '\n';
  const body = JSON.stringify(root, null, blank ? 2 : jsonIndent(before)).replace(/\n/g, eol);
  writeText(file, `${body}${blank || /\n$/.test(before) ? eol : ''}`);
}

/**
 * Indentation for JSON text: the leading whitespace (tab or a few spaces) of the first indented line. 0 when there is content but it is all on one line (still written as one line).
 * Two spaces for cases that cannot be told apart, such as an empty object.
 */
export function jsonIndent(text: string): string | number {
  const match = /\n([ \t]+)\S/.exec(text);
  if (match) return match[1]!.startsWith('\t') ? '\t' : match[1]!.length;
  return !text.trim().includes('\n') && text.includes(':') ? 0 : 2;
}

/** Atomic replace. When the config is a symlink, the file it points to is replaced. An existing file keeps its permissions; a new file is readable and writable by its owner only (it may hold a token). */
function writeText(link: string, text: string): void {
  const file = fs.existsSync(link) ? fs.realpathSync(link) : link;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let mode = 0o600;
  try {
    mode = fs.statSync(file).mode & 0o777;
  } catch {
    // New file.
  }
  const temp = `${file}.cuccut-${process.pid}-${Date.now()}.tmp`;
  try {
    fs.writeFileSync(temp, text, { mode });
    // Permissions of a new file are affected by the umask, so set them again to match the original file.
    if (process.platform !== 'win32') fs.chmodSync(temp, mode);
    fs.renameSync(temp, file);
  } catch (error) {
    fs.rmSync(temp, { force: true });
    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
