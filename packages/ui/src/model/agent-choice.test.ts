import { describe, expect, it } from 'vitest';
import type { DriverInfo, DriverModel } from '@cuccut/protocol';
import { BUILTIN_DRIVER_IDS } from '@cuccut/protocol';
import {
  AGENT_ICON_FILES,
  agentIcon,
  applyAgentChange,
  compactHarnessLabel,
  compactModelLabel,
  draftSelection,
  effortLabel,
  effortRows,
  harnessLabel,
  modelChange,
  modelRows,
  parseAgentChoice,
  providerRows,
} from './agent-choice.ts';
import { AGENT_PICKER } from '../copy.ts';

const model = (id: string, extra: Partial<DriverModel> = {}): DriverModel => ({
  id,
  label: id.toUpperCase(),
  description: null,
  tier: null,
  isDefault: false,
  efforts: [
    { id: 'low', label: 'Low' },
    { id: 'medium', label: 'Medium' },
    { id: 'high', label: 'High' },
  ],
  defaultEffort: 'medium',
  ...extra,
});

const driver = (extra: Partial<DriverInfo> = {}): DriverInfo =>
  ({
    id: 'claude',
    name: 'Claude Code',
    command: 'claude',
    state: 'ready',
    status: 'available',
    version: '2.0.0',
    minVersion: '1.0.0',
    latestVersion: null,
    unavailableReason: null,
    detail: null,
    executable: null,
    realExecutable: null,
    account: 'Claude Pro 订阅 · 已登录',
    plan: 'Claude Pro 或 Max 订阅',
    loginCommand: 'claude /login',
    install: [],
    models: [model('opus', { tier: 'max' }), model('haiku', { tier: 'fast' }), model('sonnet', { tier: 'balanced', isDefault: true })],
    configModel: null,
    configModelKnown: null,
    checkedAt: '2026-10-03T00:00:00Z',
    capabilities: { steer: true, approvals: true, resume: true, images: true },
    enabled: true,
    isDefault: true,
    defaultModel: 'sonnet',
    defaultEffort: null,
    executableOverride: null,
    ...extra,
  }) as DriverInfo;

describe('reasoning effort labels', () => {
  it('native ids map to Chinese labels; medium is \'中\'', () => {
    expect(effortLabel('low')).toBe('低');
    expect(effortLabel('medium')).toBe('中');
    expect(effortLabel('high')).toBe('高');
  });

  it('unrecognized ones display as-is: the native label if present, otherwise the id', () => {
    expect(effortLabel('xhigh', 'Extra high')).toBe('Extra high');
    expect(effortLabel('minimal', '')).toBe('minimal');
    expect(effortLabel('minimal')).toBe('minimal');
  });

  it('secondary copy follows the prototype; \'default\' is tagged on the model\'s own default effort', () => {
    const rows = effortRows(model('m', { defaultEffort: 'high' }));
    expect(rows).toEqual([
      { id: 'low', label: '低', sub: '快，适合小改动' },
      { id: 'medium', label: '中', sub: null },
      { id: 'high', label: '高', sub: '慢，想得更久 · 默认' },
    ]);
    expect(effortRows(model('m'))[1]).toEqual({ id: 'medium', label: '中', sub: '默认' });
    expect(effortRows(undefined)).toEqual([]);
  });
});

describe('model table', () => {
  it('Agent default model comes first, the rest sorted by recommended, strongest, fastest; the agent\'s own default is marked', () => {
    const rows = modelRows(driver(), null);
    expect(rows.map((r) => [r.model, r.sub])).toEqual([
      [null, '按 CLI 配置选择'],
      ['sonnet', '推荐 · 默认'],
      ['opus', '最强'],
      ['haiku', '最快'],
    ]);
  });

  it('\'recommended\' tags only the recommended one; other balanced models are not tagged (order still follows the table\'s positioning)', () => {
    const models = [
      model('gpt-6-astra', { tier: 'max' }),
      model('gpt-6.1-sol', { tier: 'balanced' }),
      model('gpt-6-sol', { tier: 'balanced' }),
    ];
    const rows = modelRows(driver({ id: 'codex', models }), null);
    expect(rows.map((r) => [r.model, r.sub])).toEqual([
      [null, '按 CLI 配置选择'],
      ['gpt-6.1-sol', '推荐'],
      ['gpt-6-sol', null],
      ['gpt-6-astra', '最强'],
    ]);
  });

  it('when the model table is empty, only the Agent default model is shown', () => {
    expect(modelRows(driver({ models: [] }), null).map((r) => r.model)).toEqual([null]);
  });

  it('a selected model not in the list is still shown; when the CLI-configured default model is not recognized, says so directly', () => {
    const rows = modelRows(driver({ configModel: 'gpt-9', configModelKnown: false }), 'old-model');
    expect(rows[0]!.sub).toBe('按 CLI 配置选择 · gpt-9 需要升级 CLI');
    expect(rows[1]).toEqual({ model: 'old-model', label: 'old-model', sub: '当前列表未提供此模型' });
  });

  it('collapsed label: Agent · Model', () => {
    expect(harnessLabel(driver(), 'opus')).toBe('Claude Code · OPUS');
    expect(harnessLabel(driver(), null)).toBe('Claude Code · Agent 默认模型');
    expect(harnessLabel(null, null)).toBe('正在检测 Agent…');
  });

  it('changing model: keeps the current effort if the new model also has it, otherwise returns to the model\'s default', () => {
    const d = driver({ models: [model('a'), model('b', { efforts: [{ id: 'low', label: 'Low' }] })] });
    expect(modelChange(d, 'b', 'low')).toEqual({ driverId: 'claude', model: 'b', effort: 'low' });
    expect(modelChange(d, 'b', 'high')).toEqual({ driverId: 'claude', model: 'b', effort: null });
    expect(modelChange(d, 'nope', 'low')).toEqual({ driverId: 'claude', model: 'nope', effort: null });
  });
});

describe('agent row', () => {
  it('unusable ones show the reason; after a session starts, other agents show the lock reason', () => {
    const codex = driver({ id: 'codex', name: 'Codex CLI', state: 'signed-out', account: null });
    const rows = providerRows([driver(), codex], 'claude', 'opus', null);
    expect(rows[0]).toMatchObject({ ready: true, selected: true, sub: 'OPUS · Claude Pro 订阅' });
    expect(rows[0]!.state).toBe('ready');
    expect(rows[1]).toMatchObject({ ready: false, locked: false, state: 'attention', sub: '需要登录 · 去设置排查' });
    const others = providerRows([driver({ state: 'not-installed' }), driver({ id: 'codex', state: 'disabled' })], null, null, null);
    expect(others.map((r) => r.state)).toEqual(['missing', 'off']);
    const locked = providerRows([driver(), driver({ id: 'codex', name: 'Codex CLI' })], 'claude', null, 'claude');
    expect(locked[1]).toMatchObject({ locked: true, sub: '这条会话已经开始，不能再换 Agent；要换请新建会话' });
    expect(locked[0]!.locked).toBe(false);
  });

  it('the four \'more\' agents and user-added ones are not listed when undetected; once detected they are listed like built-ins; a selected one is still listed', () => {
    const list = [
      driver(),
      driver({ id: 'gemini', name: 'Gemini CLI', state: 'not-installed' }),
      driver({ id: 'goose', name: 'goose', state: 'not-installed', source: 'custom' }),
      driver({ id: 'auggie', name: 'Auggie CLI', state: 'signed-out', source: 'custom' }),
      driver({ id: 'copilot', name: 'GitHub Copilot CLI', state: 'not-installed' }),
    ];
    expect(providerRows(list, 'claude', null, null).map((r) => r.id)).toEqual(['claude', 'auggie', 'copilot']);
    expect(providerRows(list, 'goose', null, null).map((r) => r.id)).toEqual(['claude', 'goose', 'auggie', 'copilot']);
  });
});

describe('new session draft', () => {
  it('if never chosen, uses the preferred default; a chosen one (including explicitly choosing the Agent default model) is used as-is', () => {
    const d = driver({ defaultModel: 'sonnet', defaultEffort: 'high' });
    expect(draftSelection(d, undefined)).toEqual({ model: 'sonnet', effort: 'high' });
    expect(draftSelection(d, { model: null })).toEqual({ model: null, effort: 'high' });
    expect(draftSelection(d, { driverId: 'codex', model: 'gpt' })).toEqual({ model: 'sonnet', effort: 'high' });
  });

  it('preferred model gone: the draft uses the recommended model (the Runtime also swaps it this way when creating a session); when there is no model table yet, uses it as-is', () => {
    expect(draftSelection(driver({ defaultModel: 'sonnet-old' }), undefined).model).toBe('sonnet');
    expect(draftSelection(driver({ models: [], defaultModel: 'sonnet-old' }), undefined).model).toBe('sonnet-old');
    expect(draftSelection(driver({ defaultModel: null }), undefined).model).toBeNull();
  });

  it('switching agents drops the previous model and effort; the same agent is merged', () => {
    expect(applyAgentChange({ driverId: 'claude', model: 'opus', effort: 'high' }, 'claude', { driverId: 'codex', model: 'gpt' })).toEqual({
      driverId: 'codex',
      model: 'gpt',
    });
    expect(applyAgentChange({ model: 'opus' }, 'claude', { driverId: 'claude', effort: 'low' })).toEqual({
      driverId: 'claude',
      model: 'opus',
      effort: 'low',
    });
  });

  it('reading back the persisted selection: agents with malformed ids and fields of the wrong type are dropped', () => {
    expect(parseAgentChoice({ driverId: 'Not Valid', model: 3, effort: 'low' })).toEqual({ effort: 'low' });
    // The id is open: the built-in one (opencode) and user-added ones are both recognized.
    for (const driverId of ['opencode', 'my-agent']) expect(parseAgentChoice({ driverId })).toEqual({ driverId });
    expect(parseAgentChoice({ driverId: 'codex', model: null })).toEqual({ driverId: 'codex', model: null });
    // Agents connected via ACP are recognized too.
    for (const driverId of ['gemini', 'cursor', 'grok', 'kimi']) expect(parseAgentChoice({ driverId })).toEqual({ driverId });
    expect(parseAgentChoice({ driverId: 'X' })).toBeNull();
    expect(parseAgentChoice('claude')).toBeNull();
  });

  it('when narrow, the model keeps only the tier name: drops the version number, trailing annotation and leading vendor name', () => {
    const cases: Array<[string, string]> = [
      ['Sonnet 5.5', 'Sonnet'],
      ['Claude Opus 5.5', 'Opus'],
      ['Claude Sonnet 5', 'Sonnet'],
      ['GPT-5.6 Sol', 'Sol'],
      ['GPT-6.1 Sol', 'Sol'],
      ['GPT-6.1-Sol', 'Sol'],
      ['GPT-6-Astra', 'Astra'],
      ['GPT-5.5', 'GPT'],
      ['Claude Opus 4.8 (fast mode)', 'Opus'],
      ['GPT-5.6 Luna', 'Luna'],
      ['Fable 5.1 [1m]', 'Fable'],
      ['Opus 4.6 (1M context)', 'Opus'],
      ['Gemini 3 Flash', 'Flash'],
      ['Grok 4.5', 'Grok'],
      ['Kimi K3', 'Kimi'],
      // The reduced table used when the Driver cannot provide a model table only has tier names to begin with.
      ['Opus', 'Opus'],
      ['Sonnet', 'Sonnet'],
      ['Haiku', 'Haiku'],
      ['Auto', 'Auto'],
    ];
    for (const [label, short] of cases) expect(compactModelLabel(label), label).toBe(short);
  });

  it('unrecognized model names are returned as-is (truncated by styling)', () => {
    for (const label of [
      'gpt-6.1-sol',
      'claude-sonnet-5-20260101',
      'Use the default model (currently Opus 5.5)',
      'corp-sonnet-proxy',
      'A B C D E',
    ]) {
      expect(compactModelLabel(label), label).toBe(label);
    }
    expect(compactModelLabel('5.5')).toBe('5.5');
  });

  it('when narrow, the collapsed label for the Agent default model reads \'default\', and when not probed yet it still says detecting', () => {
    const d = driver({ models: [model('sonnet', { label: 'Sonnet 5.5' }), model('gpt-6.1-sol', { label: 'GPT-6.1 Sol' })] });
    expect(compactHarnessLabel(d, 'sonnet')).toBe('Sonnet');
    expect(compactHarnessLabel(d, 'gpt-6.1-sol')).toBe('Sol');
    expect(compactHarnessLabel(d, null)).toBe(AGENT_PICKER.defaultMark);
    // Models not in the model table: show the id; if the id cannot be mapped to a tier, show it as is.
    expect(compactHarnessLabel(d, 'corp-proxy-7')).toBe('corp-proxy-7');
    expect(compactHarnessLabel(null, null)).toBe(AGENT_PICKER.detecting);
  });

  it('agent icons: all nine built-ins have icon files; user-added ones use the first letter of the name', () => {
    expect(Object.keys(AGENT_ICON_FILES).sort()).toEqual([...BUILTIN_DRIVER_IDS].sort());
    expect(agentIcon({ id: 'claude', name: 'Claude Code' })).toEqual({ kind: 'vendor', file: 'anthropic', mono: true });
    expect(agentIcon({ id: 'codex', name: 'Codex' })).toEqual({ kind: 'vendor', file: 'codex', mono: false });
    expect(agentIcon({ id: 'gemini', name: 'Gemini CLI' })).toEqual({ kind: 'vendor', file: 'google', mono: false });
    expect(agentIcon({ id: 'my-agent', name: 'goose', source: 'custom' })).toEqual({ kind: 'letter', letter: 'G' });
    // A user-added agent does not borrow the built-in icon, even if its id looks similar to a built-in one.
    expect(agentIcon({ id: 'claude', name: 'claude fork', source: 'custom' })).toEqual({ kind: 'letter', letter: 'C' });
    expect(agentIcon({ id: 'x', name: '  ' })).toEqual({ kind: 'letter', letter: 'X' });
  });
});
