import { describe, expect, it } from 'vitest';
import { hrefFor, parseHref } from '../state/shell-store.ts';
import { modelsNavTargets, resolveModelsRoute } from './models-route.ts';

describe('resolveModelsRoute', () => {
  it('if a page belonging to this category is given, use it', () => {
    expect(resolveModelsRoute('tts', 'voices', { tts: 'cloud' })).toEqual({ category: 'tts', page: 'voices' });
  });

  it('when no page is given, use the last-stopped page; if none, use the first page', () => {
    expect(resolveModelsRoute('asr', undefined, { asr: 'cloud' })).toEqual({ category: 'asr', page: 'cloud' });
    expect(resolveModelsRoute('asr', undefined, {})).toEqual({ category: 'asr', page: 'local' });
  });

  it('a given page that does not belong to this category (deep link models/llm/local) falls back to this category\'s page', () => {
    expect(resolveModelsRoute('llm', 'local', {})).toEqual({ category: 'llm', page: 'cloud' });
    expect(resolveModelsRoute('sep', 'cloud', { sep: 'voices' })).toEqual({ category: 'sep', page: 'local' });
  });
});

describe('modelsNavTargets', () => {
  it('current category uses the resolved page, others use the last-stopped page', () => {
    const targets = modelsNavTargets({ category: 'asr', page: 'cloud' }, { asr: 'local', tts: 'voices' });
    expect(targets.map((t) => `${t.category}/${t.page}`)).toEqual(['asr/cloud', 'tts/voices', 'llm/cloud', 'image/local', 'music/local', 'sep/local', 'vision/local']);
  });
});

describe('models page deep link', () => {
  it('model URL in settings converts back and forth; old links are mapped to the same config page', () => {
    for (const target of modelsNavTargets({ category: 'image', page: 'cloud' }, {})) {
      const route = { tab: 'models' as const, ...target };
      expect(hrefFor(route)).toBe(`/settings/models/${target.category}/${target.page}`);
      expect(parseHref(hrefFor(route))).toEqual(route);
      expect(parseHref(`/models/${target.category}/${target.page}`)).toEqual(route);
    }
  });
});
