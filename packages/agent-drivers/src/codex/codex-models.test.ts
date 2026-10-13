import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { codexHome, parseTopLevelModel, readCodexConfigModel } from './codex-config.ts';
import { inferTier, toCatalog, toDriverModel } from './codex-models.ts';
import type { CodexModel } from './codex-protocol.ts';

const model = (id: string, patch: Partial<CodexModel> = {}): CodexModel => ({
  id,
  model: id,
  displayName: id,
  description: '',
  hidden: false,
  isDefault: false,
  supportedReasoningEfforts: [],
  defaultReasoningEffort: 'medium',
  ...patch,
});

describe('Codex model table', () => {
  it('toDriverModel: display name, description, default, efforts and default effort are passed through as is', () => {
    expect(
      toDriverModel(
        model('gpt-6.1-sol', {
          displayName: 'GPT-6.1 Sol',
          description: 'Our workhorse model. ',
          isDefault: true,
          supportedReasoningEfforts: [
            { reasoningEffort: 'low', description: 'Fast' },
            { reasoningEffort: 'xhigh', description: 'Extra' },
          ],
          defaultReasoningEffort: 'xhigh',
        }),
      ),
    ).toEqual({
      id: 'gpt-6.1-sol',
      label: 'GPT-6.1 Sol',
      description: 'Our workhorse model.',
      tier: 'balanced',
      isDefault: true,
      efforts: [
        { id: 'low', label: 'low' },
        { id: 'xhigh', label: 'xhigh' },
      ],
      defaultEffort: 'xhigh',
    });
  });

  it('toDriverModel: falls back to id and null when fields are missing', () => {
    const raw = { id: 'weird', hidden: false } as unknown as CodexModel;
    expect(toDriverModel(raw)).toEqual({
      id: 'weird',
      label: 'weird',
      description: null,
      tier: null,
      isDefault: false,
      efforts: [],
      defaultEffort: null,
    });
  });

  it('inferTier: family suffix first, then the description, null when it cannot be inferred', () => {
    expect(inferTier('gpt-6-astra', null)).toBe('max');
    expect(inferTier('gpt-6-sol', null)).toBe('balanced');
    expect(inferTier('gpt-5.6-luna', null)).toBe('fast');
    expect(inferTier('gpt-5-mini', null)).toBe('fast');
    expect(inferTier('gpt-5.5', 'Frontier model for the most demanding work.')).toBe('max');
    expect(inferTier('gpt-x', 'Fastest option for quick edits.')).toBe('fast');
    expect(inferTier('gpt-x', 'An everyday model.')).toBe('balanced');
    expect(inferTier('gpt-5.5', 'Older model.')).toBeNull();
    expect(inferTier('gpt-5.6-terra', null)).toBeNull();
  });

  it('toCatalog: hidden models are not in models but are in all; entries without an id are dropped', () => {
    const catalog = toCatalog([model('a'), model('secret', { hidden: true }), { hidden: false } as unknown as CodexModel]);
    expect(catalog.models.map((m) => m.id)).toEqual(['a']);
    expect(catalog.all).toEqual(['a', 'secret']);
  });
});

describe('models in Codex config', () => {
  it('parseTopLevelModel: only recognizes model before the first table header', () => {
    expect(parseTopLevelModel('model = "gpt-6.1-sol"\n')).toBe('gpt-6.1-sol');
    expect(parseTopLevelModel(`# comment\napproval_policy = "untrusted"\nmodel='gpt-5.5'  # 注释\n`)).toBe('gpt-5.5');
    expect(parseTopLevelModel('model_reasoning_effort = "high"\nmodel = "x"\n')).toBe('x');
    expect(parseTopLevelModel('[profiles.fast]\nmodel = "gpt-5.6-luna"\n')).toBeNull();
    expect(parseTopLevelModel('model = ""\n')).toBeNull();
    expect(parseTopLevelModel('model = "a\\"b"')).toBe('a"b');
    expect(parseTopLevelModel('')).toBeNull();
    expect(parseTopLevelModel('model = gpt-5\n')).toBeNull();
  });

  it('readCodexConfigModel: reads config.toml under CODEX_HOME; null when there is no file', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-codex-config-'));
    try {
      const env = { CODEX_HOME: dir };
      expect(codexHome(env)).toBe(dir);
      expect(await readCodexConfigModel(env)).toBeNull();
      await fs.writeFile(path.join(dir, 'config.toml'), 'model = "gpt-6-sol"\n[mcp_servers.x]\nmodel = "nope"\n');
      expect(await readCodexConfigModel(env)).toBe('gpt-6-sol');
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
