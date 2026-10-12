import { afterEach, describe, expect, it } from 'vitest';
import { LOCALES, MODELSCOPE_ENDPOINT, setLocale } from '@cuccut/protocol';
import { customEndpoint, modelSources, sourceEndpoint, sourceLabel, sourceNotes, sourceOf } from './model-source.ts';

afterEach(() => setLocale('en'));

describe('sourceOf', () => {
  it('reads an unset value or the public hub root as Hugging Face', () => {
    expect(sourceOf(null)).toBe('hf');
    expect(sourceOf(undefined)).toBe('hf');
    expect(sourceOf('  ')).toBe('hf');
    expect(sourceOf('https://huggingface.co')).toBe('hf');
    expect(sourceOf('https://huggingface.co/')).toBe('hf');
    expect(sourceOf('https://www.huggingface.co')).toBe('hf');
  });

  it('reads either ModelScope host as ModelScope', () => {
    expect(sourceOf(MODELSCOPE_ENDPOINT)).toBe('ms');
    expect(sourceOf('https://modelscope.cn/')).toBe('ms');
    expect(sourceOf('http://www.modelscope.cn')).toBe('ms');
  });

  it('reads anything else as a custom mirror', () => {
    expect(sourceOf('https://hf-mirror.com')).toBe('custom');
    expect(sourceOf('https://huggingface.co/prefix')).toBe('custom');
    expect(sourceOf('https://modelscope.example.com')).toBe('custom');
    expect(sourceOf('not a url')).toBe('custom');
  });
});

describe('sourceEndpoint', () => {
  it('stores null for Hugging Face and the ModelScope base for ModelScope', () => {
    expect(sourceEndpoint('hf')).toBeNull();
    expect(sourceEndpoint('ms')).toBe(MODELSCOPE_ENDPOINT);
    expect(sourceOf(sourceEndpoint('ms'))).toBe('ms');
  });
});

describe('sourceLabel', () => {
  it('names the two hubs and shows the host of a mirror', () => {
    expect(sourceLabel(null)).toBe('Hugging Face');
    expect(sourceLabel(MODELSCOPE_ENDPOINT)).toBe('ModelScope');
    expect(sourceLabel('https://hf-mirror.com/base')).toBe('hf-mirror.com');
    expect(sourceLabel('http://10.0.0.5:8080')).toBe('10.0.0.5:8080');
  });
});

describe('customEndpoint', () => {
  it('trims spaces and trailing slashes; empty is null', () => {
    expect(customEndpoint('  https://hf-mirror.com/  ')).toBe('https://hf-mirror.com');
    expect(customEndpoint('https://mirror.example/hf//')).toBe('https://mirror.example/hf');
    expect(customEndpoint('   ')).toBeNull();
  });
});

describe('sourceNotes', () => {
  it('adds the ModelScope fallback note only for ModelScope', () => {
    expect(sourceNotes('ms', MODELSCOPE_ENDPOINT)[0]).toMatch(/whisper\.cpp/);
    expect(sourceNotes('hf', null).some((n) => n.includes('whisper.cpp'))).toBe(false);
  });

  it('says where downloads still come from while a custom address is unsaved', () => {
    expect(sourceNotes('custom', MODELSCOPE_ENDPOINT)[0]).toContain('ModelScope');
    expect(sourceNotes('custom', 'https://hf-mirror.com')).toHaveLength(1);
  });

  it('always ends with the environment variable note', () => {
    for (const notes of [sourceNotes('hf', null), sourceNotes('ms', MODELSCOPE_ENDPOINT), sourceNotes('custom', null)]) {
      expect(notes.at(-1)).toContain('CUCCUT_MODELS_ENDPOINT');
    }
  });
});

describe('copy', () => {
  it('keeps the brand names and placeholders in every locale', () => {
    for (const locale of LOCALES) {
      setLocale(locale);
      const items = modelSources();
      expect(items.map((s) => s.id)).toEqual(['hf', 'ms', 'custom']);
      expect(items[0]!.name).toBe('Hugging Face');
      expect(items[1]!.name).toBe('ModelScope');
      expect(items[0]!.hint).toContain('huggingface.co');
      expect(items[1]!.hint).toContain('modelscope.cn');
      expect(sourceNotes('custom', null)[0]).toContain('Hugging Face');
      expect(sourceNotes('hf', null).at(-1)).toContain('CUCCUT_MODELS_ENDPOINT');
    }
  });
});
