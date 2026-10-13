import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TemplateSummary } from '@cuccut/protocol';
import { templateCatalogOf } from '../model/home-templates.ts';
import { recentOf, useHomeTemplates } from './home-templates-store.ts';

// Node has no usable localStorage: give persistence an in-memory version, loaded before the store module. Pre-load a memory saved by an old version.
vi.hoisted(() => {
  const data = new Map<string, string>([
    ['cuccut.homeTemplates', JSON.stringify({ state: { recent: ['tips', 7, 'vlog-edit'] }, version: 1 })],
  ]);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
    },
  });
});

// Record what was read before beforeEach resets it.
const hydrated = useHomeTemplates.getState().recent;

function summary(id: string): TemplateSummary {
  return {
    manifest: {
      schema: 1,
      id,
      version: '1.0.0',
      kind: 'scene',
      title: id,
      summary: '一句话',
      description: '一小段',
      language: 'zh-CN',
      category: 'marketing',
      ratio: '16:9',
      durationSeconds: 30,
      brief: '示例',
      author: 'CucCut',
      source: 'official',
      license: 'Apache-2.0',
      tags: [],
      cover: { tone: 'blue', figure: 'bars' },
      preview: { beats: ['一', '二', '三'] },
    },
    origin: 'builtin',
    languages: ['zh-CN'],
    files: { cover: false, preview: false, assets: 0 },
    pack: null,
  };
}

const catalog = templateCatalogOf(['promo-ad', 'knowledge-explainer', 'data-story', 'white-ui-launch', 'vlog-edit'].map(summary));

describe('useHomeTemplates', () => {
  beforeEach(() => useHomeTemplates.setState({ recent: [] }));

  it('remembered values read back are kept only as strings, not filtered by catalog (the catalog has not been fetched yet at that time)', () => {
    expect(hydrated).toEqual(['tips', 'vlog-edit']);
    expect(recentOf({ recent: ['tips', 3, '', 'vlog-edit', null] })).toEqual(['tips', 'vlog-edit']);
    expect(recentOf({ recent: 'tips' })).toEqual([]);
    expect(recentOf(null)).toEqual([]);
  });

  it('recomputed against the catalog at selection time: keys stored by an old version are cleared, filled in with defaults, new faces are sorted to the front', () => {
    useHomeTemplates.setState({ recent: ['tips', 'anim'] });
    useHomeTemplates.getState().pick('white-ui-launch', catalog);
    expect(useHomeTemplates.getState().recent).toEqual(['white-ui-launch', 'promo-ad', 'knowledge-explainer', 'data-story', 'vlog-edit']);
    useHomeTemplates.getState().pick('promo-ad', catalog);
    expect(useHomeTemplates.getState().recent).toEqual(['white-ui-launch', 'promo-ad', 'knowledge-explainer', 'data-story', 'vlog-edit']);
  });
});
