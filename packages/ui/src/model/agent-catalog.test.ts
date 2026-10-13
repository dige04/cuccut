import { describe, expect, it } from 'vitest';
import { BUILTIN_DRIVER_IDS, DRIVER_ID_PATTERN, isBuiltinDriverId, RpcError } from '@cuccut/protocol';
import { ACP_CATALOG, type AcpCatalogEntry } from './acp-catalog.ts';
import {
  catalogRequest,
  customLoginCommand,
  customRequest,
  hasErrors,
  isCustomDriver,
  isProviderExists,
  launcherOf,
  launchLine,
  listedInPicker,
  MORE_BUILTIN_IDS,
  parseEnv,
  searchCatalog,
  splitCommand,
  validateCustom,
} from './agent-catalog.ts';

const catalog: AcpCatalogEntry[] = [
  {
    id: 'goose',
    name: 'goose',
    version: '1.33.1',
    description: '开源、可扩展的本地智能体。',
    command: ['goose', 'acp'],
    docs: 'https://example.test/goose',
  },
  {
    id: 'auggie',
    name: 'Auggie CLI',
    version: '0.33.0',
    description: '长于在大型代码库里检索上下文。',
    command: ['npx', '-y', '@augmentcode/auggie@0.33.0', '--acp'],
    env: { AUGMENT_DISABLE_AUTO_UPDATE: '1' },
    docs: 'https://example.test/auggie',
  },
  {
    id: 'fast-agent',
    name: 'fast-agent',
    version: '0.9.22',
    description: '可接多家模型服务。',
    command: ['uvx', '--from', 'fast-agent-acp==0.9.22', 'fast-agent-acp', '-x'],
    docs: 'https://example.test/fast-agent',
  },
];

describe('catalog search', () => {
  it('each word must appear in the name, id, description or command, case-insensitive; added ones are tagged', () => {
    expect(searchCatalog(catalog, '', []).map((e) => e.id)).toEqual(['goose', 'auggie', 'fast-agent']);
    expect(searchCatalog(catalog, 'AUGGIE', []).map((e) => e.id)).toEqual(['auggie']);
    expect(searchCatalog(catalog, '代码库', []).map((e) => e.id)).toEqual(['auggie']);
    expect(searchCatalog(catalog, 'uvx', []).map((e) => e.id)).toEqual(['fast-agent']);
    expect(searchCatalog(catalog, 'npx acp', []).map((e) => e.id)).toEqual(['auggie']);
    expect(searchCatalog(catalog, 'goose 不存在', [])).toEqual([]);
    expect(searchCatalog(catalog, '  ', ['goose']).map((e) => e.added)).toEqual([true, false, false]);
  });
});

describe('custom command', () => {
  it('command is split on whitespace; a quoted segment counts as one argument', () => {
    expect(splitCommand('  my-agent   --acp ')).toEqual(['my-agent', '--acp']);
    expect(splitCommand(`agent --config "~/My Agents/a.toml" 'x y'`)).toEqual(['agent', '--config', '~/My Agents/a.toml', 'x y']);
    expect(splitCommand('')).toEqual([]);
  });

  it('environment variables are KEY=VALUE per line, blank lines are ignored, and a malformed line reports its first line number', () => {
    expect(parseEnv('A=1\n\n B_2 = two words \nC=')).toEqual({ env: { A: '1', B_2: 'two words', C: '' }, bad: null });
    expect(parseEnv('A=1\nnot-a-pair').bad).toBe(2);
    expect(parseEnv('=1').bad).toBe(1);
    expect(parseEnv('1A=x').bad).toBe(1);
    expect(parseEnv(`${'A'.repeat(129)}=x`).bad).toBe(1);
  });

  const ok = { id: 'my-agent', name: '我的 Agent', command: 'my-agent --acp', env: '' };

  it('no error when filled in correctly', () => {
    expect(validateCustom(ok, ['claude'])).toEqual({});
    expect(hasErrors(validateCustom(ok, []))).toBe(false);
  });

  it('id, name and command are required', () => {
    expect(Object.keys(validateCustom({ id: '', name: '', command: '', env: '' }, [])).sort()).toEqual(['command', 'id', 'name']);
    expect(validateCustom({ ...ok, name: '   ' }, []).name).toMatch(/名字/);
    expect(validateCustom({ ...ok, name: '名'.repeat(101) }, []).name).toMatch(/最长 100/);
  });

  it('id starts with a lowercase letter and uses only a-z0-9-, max length matches the protocol (63)', () => {
    for (const id of ['1agent', 'My-agent', 'my_agent', '-a', 'agent!'])
      expect(validateCustom({ ...ok, id }, []).id, id).toMatch(/小写字母开头/);
    expect(validateCustom({ ...ok, id: 'a'.repeat(63) }, []).id).toBeUndefined();
    expect(validateCustom({ ...ok, id: 'a'.repeat(64) }, []).id).toMatch(/最长 63/);
  });

  it('does not collide with built-in ids (even when this version lacks its Driver), added ids, or catalog ids', () => {
    expect(validateCustom({ ...ok, id: 'copilot' }, []).id).toMatch(/「copilot」是 CucCut 内置 Agent 的 id/);
    expect(validateCustom({ ...ok, id: 'claude' }, ['claude'], { claude: 'Claude Code' }).id).toMatch(
      /「claude」是 CucCut 内置 Agent 的 id（Claude Code）/,
    );
    expect(validateCustom({ ...ok, id: 'goose' }, ['goose'], { goose: 'goose' }).id).toMatch(/已经有一个 Agent 用了「goose」，/);
    expect(validateCustom({ ...ok, id: 'my-x' }, ['my-x'], { 'my-x': 'X' }).id).toMatch(/「my-x」（X）/);
  });

  it('accepts one command only: pipes, redirects and && do not work; at most 64 arguments', () => {
    expect(validateCustom({ ...ok, command: 'my-agent --acp | tee log' }, []).command).toMatch(/只填一条命令/);
    expect(validateCustom({ ...ok, command: 'a && b' }, []).command).toMatch(/只填一条命令/);
    expect(validateCustom({ ...ok, command: 'a > out' }, []).command).toMatch(/只填一条命令/);
    expect(validateCustom({ ...ok, command: Array.from({ length: 65 }, (_, i) => `a${i}`).join(' ') }, []).command).toMatch(/最多 64/);
  });

  it('a rejection by the Runtime with AGENT_PROVIDER_EXISTS is recognized; other conflicts do not count', () => {
    expect(isProviderExists(new RpcError('conflict', 'x', { code: 'AGENT_PROVIDER_EXISTS', driverId: 'goose' }))).toBe(true);
    expect(isProviderExists(new RpcError('conflict', 'x', { code: 'OTHER' }))).toBe(false);
    expect(isProviderExists(new RpcError('invalid-request', 'x', { code: 'AGENT_PROVIDER_EXISTS' }))).toBe(false);
    expect(isProviderExists(new Error('x'))).toBe(false);
  });

  it('reports the line number when an environment variable is malformed', () => {
    expect(validateCustom({ ...ok, env: 'OK=1\nbad line' }, []).env).toMatch(/第 2 行/);
  });

  it('the form becomes agents.addProvider\'s arguments: trims surrounding whitespace, and omits env when there are no environment variables', () => {
    expect(customRequest({ id: ' my-agent ', name: ' 我的 Agent ', command: 'my-agent --acp', env: '' })).toEqual({
      id: 'my-agent',
      name: '我的 Agent',
      command: ['my-agent', '--acp'],
    });
    expect(customRequest({ ...ok, env: 'TOKEN_FILE=~/a b' }).env).toEqual({ TOKEN_FILE: '~/a b' });
    expect(catalogRequest(catalog[1]!)).toEqual({
      id: 'auggie',
      name: 'Auggie CLI',
      command: ['npx', '-y', '@augmentcode/auggie@0.33.0', '--acp'],
      env: { AUGMENT_DISABLE_AUTO_UPDATE: '1' },
    });
    expect('env' in catalogRequest(catalog[0]!)).toBe(false);
  });
});

describe('launch method', () => {
  it('npx / uvx fetch-on-run: records the versioned package name and prerequisites; others are null', () => {
    expect(launcherOf(catalog[0]!.command)).toBeNull();
    expect(launcherOf(catalog[1]!.command)).toEqual({ kind: 'npx', spec: '@augmentcode/auggie@0.33.0', needs: 'Node.js' });
    expect(launcherOf(catalog[2]!.command)).toEqual({ kind: 'uvx', spec: 'fast-agent-acp==0.9.22', needs: 'uv' });
    expect(launcherOf(['npx', '-y'])).toBeNull();
  });

  it('full launch command line: env vars first; with only a variable name, the value is written as …; arguments with spaces are quoted', () => {
    expect(launchLine(catalog[1]!.command, catalog[1]!.env)).toBe('AUGMENT_DISABLE_AUTO_UPDATE=1 npx -y @augmentcode/auggie@0.33.0 --acp');
    expect(launchLine(['a', 'b c'])).toBe('a "b c"');
    expect(launchLine(['my-agent', '--acp'], ['TOKEN', 'LOG'])).toBe('TOKEN=… LOG=… my-agent --acp');
  });

  it('login command: npx / uvx launches itself (without ACP arguments), others launch the program itself', () => {
    expect(customLoginCommand(catalog[1]!.command)).toBe('npx -y @augmentcode/auggie@0.33.0');
    expect(customLoginCommand(catalog[2]!.command)).toBe('uvx --from fast-agent-acp==0.9.22 fast-agent-acp');
    expect(customLoginCommand(catalog[0]!.command)).toBe('goose');
  });
});

describe('who is listed in the picker', () => {
  const d = (id: string, state: 'ready' | 'not-installed' | 'signed-out', source: 'builtin' | 'custom' = 'builtin') => ({
    id,
    state,
    source,
  });

  it('all detected ones are included; undetected ones include only the built-in core ones; the four \'more\' agents and added ones are not included', () => {
    expect(listedInPicker(d('claude', 'not-installed'))).toBe(true);
    expect(listedInPicker(d('copilot', 'not-installed'))).toBe(true);
    expect(listedInPicker(d('gemini', 'not-installed'))).toBe(false);
    expect(listedInPicker(d('gemini', 'ready'))).toBe(true);
    expect(listedInPicker(d('goose', 'not-installed', 'custom'))).toBe(false);
    expect(listedInPicker(d('goose', 'signed-out', 'custom'))).toBe(true);
    expect(isCustomDriver(d('goose', 'ready', 'custom'))).toBe(true);
    expect(isCustomDriver(d('claude', 'ready'))).toBe(false);
  });
});

describe('catalog data', () => {
  it('33 entries, ids are valid and unique and exclude built-ins; npx entries pin their version', () => {
    expect(ACP_CATALOG).toHaveLength(33);
    const ids = ACP_CATALOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of ACP_CATALOG) {
      expect(DRIVER_ID_PATTERN.test(e.id), e.id).toBe(true);
      expect(isBuiltinDriverId(e.id), e.id).toBe(false);
      expect(e.command.length, e.id).toBeGreaterThan(0);
      expect(e.description.length, e.id).toBeGreaterThan(0);
      expect(e.docs, e.id).toMatch(/^https:\/\//);
      const launcher = launcherOf(e.command);
      if (launcher?.kind === 'npx') expect(launcher.spec, e.id).toMatch(/.@\d/);
    }
    for (const id of MORE_BUILTIN_IDS) expect((BUILTIN_DRIVER_IDS as readonly string[]).includes(id)).toBe(true);
  });
});
