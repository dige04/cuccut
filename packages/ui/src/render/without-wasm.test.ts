import { EditorWasmUnavailable } from '@cuccut/editor-wasm';
import { describe, expect, it, vi } from 'vitest';

/**
 * When the WASM for editing semantics has not been built (on a machine without Rust installed), the UI still loads. Loading a module does not touch WASM; only where it is used does it report `EditorWasmUnavailable`. This test makes every WASM function throw as soon as it is called, then loads every module in the UI bundle.
 */
vi.mock('@cuccut/editor-wasm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cuccut/editor-wasm')>();
  const unavailable = () => {
    throw new actual.EditorWasmUnavailable('测试里当作没有构建');
  };
  return {
    ...actual,
    editorSemantics: unavailable,
    speechSentences: unavailable,
    stageBox: unavailable,
    stagePlace: unavailable,
    placeDefault: unavailable,
    engineRanges: unavailable,
    elementPresets: unavailable,
    speakerProposal: unavailable,
    applySpeakers: unavailable,
  };
});

const MODULES = import.meta.glob(['../**/*.ts', '!../**/*.test.ts', '!../**/*.d.ts']);

describe('没有编辑语义的 WASM', () => {
  it.for(Object.keys(MODULES))('载入 %s 不碰 WASM', async (file, context) => {
    try {
      await MODULES[file]!();
    } catch (error) {
      // A module that reaches Spectrum components through .tsx brings in CSS, which node cannot load; verified on the full page in Electron.
      if ((error as { code?: string }).code === 'ERR_UNKNOWN_FILE_EXTENSION') return context.skip('引到带 .css 的组件');
      throw error;
    }
  });

  it('读到由 WASM 算出的常量时才报不可用', async () => {
    const { CONFETTI_STYLES, CONFETTI_RANGES } = await import('./confetti.ts');
    const { ELEMENT_TILES } = await import('../model/element-catalog.ts');
    expect(() => CONFETTI_STYLES.length).toThrow(EditorWasmUnavailable);
    expect(() => CONFETTI_RANGES.size).toThrow(EditorWasmUnavailable);
    expect(() => ELEMENT_TILES.map((tile) => tile.key)).toThrow(EditorWasmUnavailable);
  });
});
