import { describe, expect, it } from 'vitest';
import type { ModelCapabilitiesView, ProviderCapabilityView } from '@cuccut/protocol';
import { CODEX_IMAGE_PROVIDER, codexImageProvider, codexImageRow, codexImageToast } from './codex-image.ts';

function provider(patch: Partial<ProviderCapabilityView> = {}, enabled = false): ProviderCapabilityView {
  return {
    providerId: CODEX_IMAGE_PROVIDER,
    kind: 'agent',
    label: 'Codex',
    config: { enabled, enabledAt: enabled ? '2026-10-03T00:00:00.000Z' : null, credential: 'none' },
    models: [],
    available: false,
    unavailableReason: 'not-configured',
    detail: '没有启用',
    ...patch,
  };
}

const codex = { id: 'codex', state: 'ready' } as const;

describe('codexImageProvider', () => {
  it('gets agent:codex from the image-generation capability view, null when absent', () => {
    const view = { generateImage: { default: null, effective: null, providers: [provider()] } } as unknown as ModelCapabilitiesView;
    expect(codexImageProvider(view)?.providerId).toBe('agent:codex');
    expect(codexImageProvider({ generateImage: { default: null, effective: null, providers: [] } } as unknown as ModelCapabilitiesView)).toBeNull();
    expect(codexImageProvider(null)).toBeNull();
  });
});

describe('codexImageRow', () => {
  it('hidden when Codex is not installed, is not Codex, or the Runtime does not include this provider', () => {
    expect(codexImageRow(provider(), { id: 'codex', state: 'not-installed' }, 'done')).toBeNull();
    expect(codexImageRow(provider(), { id: 'claude', state: 'ready' }, 'done')).toBeNull();
    expect(codexImageRow(null, codex, 'done')).toBeNull();
  });

  it('not enabled and not probed: only knows \'not enabled\', and the toggle is not allowed yet', () => {
    expect(codexImageRow(provider(), codex, 'pending')).toEqual({ enabled: false, ready: false, canEnable: false, checking: true, why: null });
  });

  it('probed, only missing enablement: can be turned on', () => {
    expect(codexImageRow(provider(), codex, 'done')).toEqual({ enabled: false, ready: false, canEnable: true, checking: false, why: null });
  });

  it('probe failed: does not say it can be turned on, gives one line on what to do', () => {
    const row = codexImageRow(provider(), codex, 'failed');
    expect(row?.canEnable).toBe(false);
    expect(row?.checking).toBe(false);
    expect(row?.why).toContain('重新检测');
  });

  it('not logged in: cannot be turned on, says login is required', () => {
    const row = codexImageRow(provider({ unavailableReason: 'signed-out', detail: '没有登录' }), { id: 'codex', state: 'signed-out' }, 'done');
    expect(row).toMatchObject({ enabled: false, canEnable: false, checking: false });
    expect(row?.why).toContain('登录');
  });

  it('version too old: the reason sentence uses the provider\'s detail (the minimum version is in it, not hard-coded in the UI)', () => {
    const detail = 'Codex 的版本是 0.150.0，至少要 0.158.0：升级 Codex CLI（例如 npm install -g @openai/codex@latest），然后重新检查';
    const row = codexImageRow(provider({ unavailableReason: 'outdated', detail }), codex, 'done');
    expect(row?.canEnable).toBe(false);
    expect(row?.why).toBe(`${detail}。`);
  });

  it('other unavailable: includes the detail', () => {
    const row = codexImageRow(provider({ unavailableReason: 'unsupported', detail: '没有拿到 Codex 的状态' }), codex, 'done');
    expect(row?.why).toBe('Codex 现在画不了图 · 没有拿到 Codex 的状态。');
  });

  it('on and usable: shows opened', () => {
    const row = codexImageRow(provider({ available: true, unavailableReason: undefined, detail: undefined }, true), codex, 'pending');
    expect(row).toEqual({ enabled: true, ready: true, canEnable: true, checking: false, why: null });
  });

  it('usable but off: can be turned on, no \'opened\' label', () => {
    const row = codexImageRow(provider({ available: true, unavailableReason: undefined }, false), codex, 'pending');
    expect(row).toMatchObject({ enabled: false, ready: false, canEnable: true, why: null });
  });

  it('on but cannot render (logged out later): the reason is still shown, and the switch stays on so the user can turn it off', () => {
    const row = codexImageRow(provider({ unavailableReason: 'signed-out', detail: '没有登录' }, true), { id: 'codex', state: 'signed-out' }, 'pending');
    expect(row).toMatchObject({ enabled: true, ready: false, canEnable: false, checking: false });
    expect(row?.why).toContain('登录');
  });
});

describe('codexImageToast', () => {
  it('one sentence each for turning on and off', () => {
    expect(codexImageToast(true)).toContain('已打开 Codex 画图');
    expect(codexImageToast(false)).toBe('已关闭 Codex 画图');
  });
});
