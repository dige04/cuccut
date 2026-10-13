import { describe, expect, it } from 'vitest';
import { majorVersion, parseOpenCodeVersion } from './opencode-binary.ts';
import { accountOf, driverModels, modelRef } from './opencode-models.ts';
import { approvalOf, editDiff, permissionRules, toolItem, type ToolState } from './opencode-items.ts';
import { parseFrame } from './opencode-server.ts';

/** Pure functions: version, model id, permission rules, mapping of permission requests and tool steps, SSE frames. Samples are taken from real OpenCode 2.0.24 output. */

const PATCH = 'Index: notes.txt\n===\n--- notes.txt\n+++ notes.txt\n@@ -1,3 +1,3 @@\n alpha\n-beta\n+BETA\n gamma\n';

describe('version', () => {
  it('recognizes `opencode v2.0.24` for 2.x and bare version numbers for 1.x', () => {
    expect(parseOpenCodeVersion('opencode v2.0.24\n')).toBe('2.0.24');
    expect(parseOpenCodeVersion('1.18.34\n')).toBe('1.18.34');
    expect(parseOpenCodeVersion('v2.1.0-beta.3')).toBe('2.1.0');
    expect(parseOpenCodeVersion('error: something')).toBeNull();
    expect(majorVersion('1.18.34')).toBe(1);
    expect(majorVersion('2.0.24')).toBe(2);
  });
});

describe('models', () => {
  it('id written as provider/model, split back at the first slash', () => {
    expect(modelRef('anthropic/claude-sonnet-5', null)).toEqual({ providerID: 'anthropic', id: 'claude-sonnet-5' });
    expect(modelRef('openrouter/meta/llama', 'high')).toEqual({ providerID: 'openrouter', id: 'meta/llama', variant: 'high' });
    expect(modelRef('no-slash', null)).toBeNull();
  });

  it('keeps only enabled models, variants are used as reasoning effort, default model is marked', () => {
    const models = driverModels(
      [
        { id: 'a', providerID: 'p', name: 'A', enabled: true, variants: [{ id: 'default' }, { id: 'low' }, { id: 'high' }] },
        { id: 'b', providerID: 'p', enabled: false },
      ],
      'p/a',
    );
    expect(models).toEqual([
      {
        id: 'p/a',
        label: 'A',
        description: null,
        tier: null,
        isDefault: true,
        efforts: [
          { id: 'low', label: 'low' },
          { id: 'high', label: 'high' },
        ],
        defaultEffort: null,
      },
    ]);
  });

  it('account: null when only the bundled OpenCode Zen is present', () => {
    expect(accountOf([{ id: 'opencode', name: 'OpenCode Zen', activation: 'enabled' }])).toBeNull();
    expect(accountOf([{ id: 'opencode' }, { id: 'anthropic', name: 'Anthropic', activation: 'enabled' }])).toBe('Anthropic');
  });
});

describe('access mode → permission rules', () => {
  const effect = (mode: Parameters<typeof permissionRules>[0], action: string) =>
    permissionRules(mode).find((r) => r.action === action)?.effect;

  it('plan rejects edits, asks about commands and out-of-directory access; ask through auto all ask, with the Harness looking up the table; fullAccess allows', () => {
    expect(effect('plan', 'edit')).toBe('deny');
    expect(effect('plan', 'shell')).toBe('ask');
    for (const mode of ['ask', 'autoAcceptEdits', 'auto'] as const) {
      expect(effect(mode, 'edit')).toBe('ask');
      expect(effect(mode, 'shell')).toBe('ask');
      expect(effect(mode, 'external_directory')).toBe('ask');
    }
    expect(effect('fullAccess', 'edit')).toBe('allow');
    expect(effect('fullAccess', 'shell')).toBe('allow');
  });

  it('every level rejects question (CucCut has no channel for answering forms)', () => {
    for (const mode of ['plan', 'ask', 'autoAcceptEdits', 'auto', 'fullAccess'] as const) expect(effect(mode, 'question')).toBe('deny');
  });
});

describe('permission request → approval', () => {
  const cwd = '/work';

  it('shell is a command; rules follow commandRule', () => {
    const out = approvalOf({ id: 'per_1', sessionID: 's', action: 'shell', resources: ['npm install left-pad'] }, cwd);
    expect(out.request).toEqual({ kind: 'command', command: 'npm install left-pad', cwd, reason: null, rule: 'npm install' });
    expect(out.grantKey).toBe('command:npm install');
    expect(out.escalation).toBe(false);
  });

  it('edit is a file change; the file is taken from the relative path in the metadata', () => {
    const out = approvalOf(
      {
        id: 'per_2',
        sessionID: 's',
        action: 'edit',
        resources: ['notes.txt'],
        metadata: { files: [{ file: 'notes.txt', patch: PATCH, status: 'modified' }] },
      },
      cwd,
    );
    expect(out.request).toEqual({ kind: 'file-change', reason: null, files: ['notes.txt'], rule: null });
    expect(out.grantKey).toBe('file-change');
  });

  it('external_directory counts as out of bounds', () => {
    const out = approvalOf({ id: 'per_3', sessionID: 's', action: 'external_directory', resources: ['/etc/*'] }, cwd);
    expect(out.request.kind).toBe('tool');
    expect(out.escalation).toBe(true);
  });
});

describe('tool steps', () => {
  const base: ToolState = {
    id: 'call_1',
    name: 'edit',
    input: { path: '/work/notes.txt', oldString: 'beta', newString: 'BETA' },
    status: 'completed',
    content: 'Edited notes.txt (1 replacement)',
    metadata: { files: [{ file: 'notes.txt', patch: PATCH, status: 'modified', additions: 1, deletions: 1 }] },
    error: null,
    startedAt: 1000,
    endedAt: 1250,
  };

  it('file change output is the unified diff from OpenCode', () => {
    expect(toolItem(base, '/work', [])).toEqual({
      kind: 'tool-call',
      id: 'call_1',
      tool: 'file-change',
      title: 'notes.txt',
      detail: 'modified notes.txt',
      output: PATCH,
      status: 'completed',
      exitCode: null,
      durationMs: 250,
    });
  });

  it('without metadata, the diff is built from oldString / newString', () => {
    const item = toolItem({ ...base, metadata: null }, '/work', []);
    expect(item.title).toBe('notes.txt');
    expect(item.output).toBe(editDiff('notes.txt', base.input));
    expect(item.output).toContain('-beta\n+BETA');
  });

  it('shell title is the command; MCP tools are recognized by the server name prefix', () => {
    expect(toolItem({ ...base, name: 'shell', input: { command: 'echo hi' }, metadata: null, content: 'hi' }, '/work', []).title).toBe(
      'echo hi',
    );
    expect(toolItem({ ...base, name: 'shell', input: { command: 'ls' }, metadata: null }, '/work', []).tool).toBe('command');
    expect(toolItem({ ...base, name: 'cuccut_project_read', input: {}, metadata: null }, '/work', ['cuccut']).tool).toBe('mcp');
    expect(toolItem({ ...base, name: 'glob', input: { pattern: '**/x' }, metadata: null }, '/work', []).title).toBe('glob **/x');
  });
});

describe('SSE frames', () => {
  it('parses data lines, ignores heartbeat comments', () => {
    expect(parseFrame(': heartbeat')).toBeNull();
    expect(parseFrame('data: {"id":"evt_1","type":"server.connected","data":{}}')).toEqual({
      id: 'evt_1',
      type: 'server.connected',
      data: {},
    });
    expect(parseFrame('data: not json')).toBeNull();
  });
});
