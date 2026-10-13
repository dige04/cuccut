import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clientIdOfToken,
  codexSectionRange,
  hasMcpEntry,
  hostSkillsDir,
  jsonIndent,
  mcpHostConfig,
  parseAgentHost,
  readMcpEntryToken,
  writeMcpEntry,
} from './agent-hosts.ts';

/** One temporary HOME per case: every location is computed from this environment variable, so the real host config is never touched. */
let home: string;
let env: NodeJS.ProcessEnv;
beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'cuccut-agent-hosts-'));
  env = { HOME: home, PATH: '' };
});
afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
});

const entry = { name: 'cuccut', url: 'http://127.0.0.1:47620/mcp', token: 'bct_secret' };
const readJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, any>;

describe('host locations', () => {
  it('skills directory: defaults under HOME, CLAUDE_CONFIG_DIR and CODEX_HOME take effect', () => {
    expect(hostSkillsDir('claude-code', env)).toBe(path.join(home, '.claude', 'skills'));
    expect(hostSkillsDir('codex', env)).toBe(path.join(home, '.codex', 'skills'));
    expect(hostSkillsDir('cursor', env)).toBe(path.join(home, '.cursor', 'skills'));
    expect(hostSkillsDir('gemini', env)).toBe(path.join(home, '.gemini', 'skills'));
    const custom = { ...env, CLAUDE_CONFIG_DIR: path.join(home, 'cc'), CODEX_HOME: path.join(home, 'cx') };
    expect(hostSkillsDir('claude-code', custom)).toBe(path.join(home, 'cc', 'skills'));
    expect(hostSkillsDir('codex', custom)).toBe(path.join(home, 'cx', 'skills'));
    expect(mcpHostConfig('claude-code', custom).file).toBe(path.join(home, 'cc', '.claude.json'));
    expect(mcpHostConfig('codex', custom).file).toBe(path.join(home, 'cx', 'config.toml'));
  });

  it('--agent only accepts the four hosts', () => {
    expect(parseAgentHost('codex')).toBe('codex');
    expect(() => parseAgentHost(undefined)).toThrow(/缺少 --agent/);
    expect(() => parseAgentHost('vscode')).toThrow(/不认识的宿主「vscode」/);
  });
});

describe('writes MCP config', () => {
  it('Claude Code: token goes into the env of settings.json, .claude.json only writes a reference; other keys are kept as they are', () => {
    fs.writeFileSync(
      path.join(home, '.claude.json'),
      JSON.stringify({ theme: 'dark', mcpServers: { other: { type: 'stdio', command: 'x' } } }),
    );
    fs.mkdirSync(path.join(home, '.claude'));
    fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify({ model: 'opus', env: { FOO: '1' } }));
    expect(hasMcpEntry('claude-code', env)).toBe(false);

    const written = writeMcpEntry('claude-code', env, entry, { runClaude: null });
    expect(written.tokenStorage).toBe('env');

    const root = readJson(path.join(home, '.claude.json'));
    expect(root.theme).toBe('dark');
    expect(root.mcpServers.other).toEqual({ type: 'stdio', command: 'x' });
    expect(root.mcpServers.cuccut).toEqual({ type: 'http', url: entry.url, headers: { Authorization: 'Bearer ${CUCCUT_MCP_TOKEN}' } });
    expect(JSON.stringify(root)).not.toContain('bct_secret');
    const settings = readJson(path.join(home, '.claude', 'settings.json'));
    expect(settings).toEqual({ model: 'opus', env: { FOO: '1', CUCCUT_MCP_TOKEN: 'bct_secret' } });
    expect(hasMcpEntry('claude-code', env)).toBe(true);
  });

  it('Claude Code: hands off to claude when it is on PATH (existing entries are removed before adding)', () => {
    const calls: string[][] = [];
    writeMcpEntry('claude-code', env, entry, { runClaude: (args) => calls.push(args) });
    expect(calls).toEqual([
      [
        'mcp',
        'add',
        '--scope',
        'user',
        '--transport',
        'http',
        'cuccut',
        entry.url,
        '--header',
        'Authorization: Bearer ${CUCCUT_MCP_TOKEN}',
      ],
    ]);
    fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ mcpServers: { cuccut: {} } }));
    calls.length = 0;
    writeMcpEntry('claude-code', env, entry, { runClaude: (args) => calls.push(args) });
    expect(calls.map((args) => args[1])).toEqual(['remove', 'add']);
  });

  it('Cursor and Gemini CLI: plaintext request headers, new file readable and writable only by its owner', () => {
    expect(writeMcpEntry('cursor', env, entry).tokenStorage).toBe('plaintext');
    const cursorFile = path.join(home, '.cursor', 'mcp.json');
    expect(readJson(cursorFile).mcpServers.cuccut).toEqual({ url: entry.url, headers: { Authorization: 'Bearer bct_secret' } });
    if (process.platform !== 'win32') expect(fs.statSync(cursorFile).mode & 0o777).toBe(0o600);

    const geminiFile = path.join(home, '.gemini', 'settings.json');
    fs.mkdirSync(path.dirname(geminiFile));
    fs.writeFileSync(geminiFile, JSON.stringify({ general: { vimMode: true } }), { mode: 0o644 });
    writeMcpEntry('gemini', env, entry);
    const gemini = readJson(geminiFile);
    expect(gemini.general).toEqual({ vimMode: true });
    expect(gemini.mcpServers.cuccut).toEqual({ url: entry.url, type: 'http', headers: { Authorization: 'Bearer bct_secret' } });
    if (process.platform !== 'win32') expect(fs.statSync(geminiFile).mode & 0o777).toBe(0o644);
  });

  it('unreadable JSON reports an error and does not overwrite', () => {
    const file = path.join(home, '.cursor', 'mcp.json');
    fs.mkdirSync(path.dirname(file));
    fs.writeFileSync(file, '{ broken');
    expect(() => writeMcpEntry('cursor', env, entry)).toThrow(/不是合法的 JSON，没有改动/);
    expect(fs.readFileSync(file, 'utf8')).toBe('{ broken');
  });

  it('Codex: only replaces the [mcp_servers.cuccut] section (including sub-tables), the rest stays as it is', () => {
    const file = path.join(home, '.codex', 'config.toml');
    fs.mkdirSync(path.dirname(file));
    const before = [
      'model = "gpt-5"',
      '',
      '[mcp_servers.cuccut]',
      'url = "http://old"',
      '',
      '[mcp_servers.cuccut.env]',
      'X = "1"',
      '',
      '[mcp_servers.other]',
      'command = "x"',
      '',
    ].join('\n');
    fs.writeFileSync(file, before);
    expect(codexSectionRange(before, 'cuccut')).toEqual({ start: 2, end: 7 });
    expect(hasMcpEntry('codex', env)).toBe(true);

    expect(writeMcpEntry('codex', env, entry).tokenStorage).toBe('plaintext');
    expect(fs.readFileSync(file, 'utf8')).toBe(
      [
        'model = "gpt-5"',
        '',
        '[mcp_servers.cuccut]',
        `url = "${entry.url}"`,
        'http_headers = { Authorization = "Bearer bct_secret" }',
        '',
        '[mcp_servers.other]',
        'command = "x"',
        '',
      ].join('\n'),
    );
  });

  it('Codex: appends the section at the end when it is missing', () => {
    const file = path.join(home, '.codex', 'config.toml');
    fs.mkdirSync(path.dirname(file));
    fs.writeFileSync(file, 'model = "gpt-5"\n');
    expect(hasMcpEntry('codex', env)).toBe(false);
    writeMcpEntry('codex', env, entry);
    expect(fs.readFileSync(file, 'utf8')).toBe(
      `model = "gpt-5"\n\n[mcp_servers.cuccut]\nurl = "${entry.url}"\nhttp_headers = { Authorization = "Bearer bct_secret" }\n`,
    );
  });
});

describe('token and config format of old entries', () => {
  it('recognizes the token used by each host\'s old entry and its client id', () => {
    expect(readMcpEntryToken('cursor', env)).toBeNull();
    writeMcpEntry('cursor', env, { ...entry, token: 'mcl_a.c2VjcmV0' });
    expect(readMcpEntryToken('cursor', env)).toBe('mcl_a.c2VjcmV0');
    writeMcpEntry('gemini', env, { ...entry, token: 'mcl_b.c2VjcmV0' });
    expect(readMcpEntryToken('gemini', env)).toBe('mcl_b.c2VjcmV0');
    writeMcpEntry('codex', env, { ...entry, token: 'mcl_c.c2VjcmV0' });
    expect(readMcpEntryToken('codex', env)).toBe('mcl_c.c2VjcmV0');
    writeMcpEntry('claude-code', env, { ...entry, token: 'mcl_d.c2VjcmV0' }, { runClaude: null });
    expect(readMcpEntryToken('claude-code', env)).toBe('mcl_d.c2VjcmV0');

    // Codex's sub-table form is also accepted.
    const codex = path.join(home, '.codex', 'config.toml');
    fs.writeFileSync(
      codex,
      '[mcp_servers.cuccut]\nurl = "x"\n\n[mcp_servers.cuccut.http_headers]\nAuthorization = "Bearer mcl_e.c2VjcmV0"\n',
    );
    expect(readMcpEntryToken('codex', env)).toBe('mcl_e.c2VjcmV0');

    expect(clientIdOfToken('mcl_abc123.c2VjcmV0')).toBe('mcl_abc123');
    expect(clientIdOfToken('手写的令牌')).toBeNull();
    expect(clientIdOfToken('no-dot')).toBeNull();
  });

  it('JSON keeps the original indentation, line endings and trailing newline', () => {
    const file = path.join(home, '.cursor', 'mcp.json');
    fs.mkdirSync(path.dirname(file));
    fs.writeFileSync(file, '{\n    "mcpServers": {\n        "other": { "url": "y" }\n    }\n}');
    writeMcpEntry('cursor', env, entry);
    const text = fs.readFileSync(file, 'utf8');
    expect(text).toMatch(/^\{\n {4}"mcpServers": \{\n {8}"other": \{/);
    expect(text.endsWith('}')).toBe(true);

    fs.writeFileSync(file, '{\r\n\t"mcpServers": {}\r\n}\r\n');
    writeMcpEntry('cursor', env, entry);
    expect(fs.readFileSync(file, 'utf8')).toMatch(/^\{\r\n\t"mcpServers": \{\r\n\t\t"cuccut"[\s\S]*\}\r\n$/);

    expect(jsonIndent('{"a":1}')).toBe(0);
    expect(jsonIndent('{}')).toBe(2);
    expect(jsonIndent('{\n  "a": 1\n}')).toBe(2);
  });

  it('Claude Code: when writing the entry fails, restores the old token in settings.json', () => {
    fs.mkdirSync(path.join(home, '.claude'));
    const settingsFile = path.join(home, '.claude', 'settings.json');
    fs.writeFileSync(settingsFile, JSON.stringify({ env: { CUCCUT_MCP_TOKEN: 'mcl_old.c2VjcmV0' } }, null, 2));
    expect(() =>
      writeMcpEntry('claude-code', env, entry, {
        runClaude: () => {
          throw new Error('claude 不在了');
        },
      }),
    ).toThrow('claude 不在了');
    expect(readJson(settingsFile).env).toEqual({ CUCCUT_MCP_TOKEN: 'mcl_old.c2VjcmV0' });
  });
});
