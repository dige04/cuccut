import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCALES, setLocale } from '@cuccut/protocol/i18n';
import { compilerAvailable, loadSlidesCompiler } from '../slides-compiler.ts';
import { createCommentLabels, localeFromSearch } from './comment-labels.ts';
import type { HostCommentLabels } from './slides-host.ts';

/** 标注位置标签的词表（docs/design/slides §8.2）：跟随 CucCut 的界面语言，英文与运行时原文逐字一致。 */

const ROLES = ['display', 'h1', 'h2', 'h3', 'lead', 'eyebrow', 'body', 'caption'];
const ELEMENTS = ['img', 'icon', 'stack', 'grid', 'overlay', 'html', 'spacer'];
const SHAPES = ['rect', 'rounded', 'ellipse', 'diamond', 'arrow-right', 'arrow-left', 'arrow-up', 'arrow-down', 'line', 'connector'];
const PARTS = [
  'left edge', 'right edge', 'top edge', 'bottom edge', 'top half', 'bottom half', 'left side', 'right side',
  'top left', 'top centre', 'top right', 'middle left', 'middle centre', 'middle right',
  'bottom left', 'bottom centre', 'bottom right', 'middle', 'centre', 'part',
];

beforeEach(() => {
  // 测试进程钉在简体中文（vitest.config.ts 的 CUCCUT_LOCALE）；这里要按参数换语言
  vi.stubEnv('CUCCUT_LOCALE', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  setLocale('zh-Hans');
});

describe('localeFromSearch', () => {
  it('取地址上的 lang，认不出或没带时为 null', () => {
    expect(localeFromSearch('?lang=zh-Hans')).toBe('zh-Hans');
    expect(localeFromSearch('?foo=1&lang=pt-BR')).toBe('pt-BR');
    expect(localeFromSearch('?lang=xx')).toBeNull();
    expect(localeFromSearch('')).toBeNull();
  });
});

describe('createCommentLabels', () => {
  it('按界面语言给词，表里没有的返回 undefined（运行时用英文）', () => {
    const labels = createCommentLabels('zh-Hans');
    expect(labels.slide(3)).toBe('第 3 页');
    expect(labels.textRole('h1')).toBe('一级标题');
    expect(labels.element({ kind: 'shape', shape: 'rect' })).toBe('矩形');
    expect(labels.element({ kind: 'table', rows: 2, cols: 3 })).toBe('表格 2×3');
    expect(labels.areaPart('top left')).toBe('（左上）');
    expect(labels.covered(2)).toBe(' · 2 个元素');
    expect(labels.textRole('unknown')).toBeUndefined();
    expect(labels.element({ kind: 'unknown' })).toBeUndefined();
    expect(labels.element({ kind: 'shape', shape: 'star' })).toBeUndefined();
    expect(labels.areaPart('somewhere')).toBeUndefined();
  });

  it('没有语言时用英文', () => {
    const labels = createCommentLabels(null);
    expect(labels.slide(1)).toBe('Slide 1');
    expect(labels.covered(1)).toBe(' · 1 element');
    expect(labels.covered(2)).toBe(' · 2 elements');
  });

  it.each(LOCALES)('%s 的每个词都有译文', (locale) => {
    const labels = createCommentLabels(locale);
    const words = [
      labels.slide(12),
      ...ROLES.map((role) => labels.textRole(role)),
      ...ELEMENTS.map((kind) => labels.element({ kind })),
      ...SHAPES.map((shape) => labels.element({ kind: 'shape', shape })),
      labels.element({ kind: 'table', rows: 2, cols: 3 }),
      ...PARTS.map((part) => labels.areaPart(part)),
      labels.covered(1),
      labels.covered(5),
    ];
    for (const word of words) expect(word, locale).toMatch(/\S/);
    expect(labels.slide(12)).toContain('12');
    expect(labels.covered(5)).toContain('5');
  });
});

/** 运行时拼标签时用这些词：要先构建编辑器（`npm run build:slides-editor`）。 */
describe.skipIf(!compilerAvailable())('运行时的标注位置标签', () => {
  type Labels = { label: string; detail: string };
  type Runtime = Record<string, unknown> & {
    textRoleLabels: Record<string, string>;
    shapeVariantLabels: Record<string, string>;
    describeCommentBoxPart(box: { x0: number; x1: number; y0: number; y1: number }, coverage: number): string;
    describeFrameCommentAnchor(slideNumber: number, slide: unknown, anchor: unknown): Labels;
    describeAreaCommentAnchor(slideNumber: number, slide: unknown, area: unknown): string;
  };
  const rt = () => loadSlidesCompiler() as unknown as Runtime;
  const slide = {
    id: 's1',
    frames: [
      {
        id: 'f1',
        node: {
          kind: 'stack',
          children: [
            { kind: 'text', role: 'h1', text: 'Hello world' },
            { kind: 'img', alt: 'A cat', src: 'x.png' },
            { kind: 'shape', shape: 'rect' },
            { kind: 'table', rows: [['a', 'b'], ['c', 'd']], cols: 2 },
          ],
        },
      },
    ],
  };
  const area = { within: { frameId: 'f1', path: [] }, part: 'top left', covered: [{ frameId: 'f1', path: [0] }, { frameId: 'f1', path: [1] }] };
  const labelsWith = (labels: HostCommentLabels | null) => {
    globalThis.slidesHost = labels ? ({ commentLabels: labels } as unknown as typeof globalThis.slidesHost) : undefined;
    try {
      return {
        nodes: [[], [0], [1], [2], [3]].map((path) => rt().describeFrameCommentAnchor(3, slide, { kind: 'node', frameId: 'f1', path })),
        slide: rt().describeFrameCommentAnchor(3, slide, { kind: 'slide' }),
        area: rt().describeAreaCommentAnchor(3, slide, area),
      };
    } finally {
      globalThis.slidesHost = undefined;
    }
  };

  it('英文词表与运行时原文逐字一致', () => {
    const labels = createCommentLabels('en');
    for (const [role, text] of Object.entries(rt().textRoleLabels)) expect(labels.textRole(role)).toBe(text);
    for (const [shape, text] of Object.entries(rt().shapeVariantLabels)) expect(labels.element({ kind: 'shape', shape })).toBe(text);
    expect(labelsWith(labels)).toEqual(labelsWith(null));
  });

  it('区域方位的键覆盖运行时会给的全部短语', () => {
    const parts = new Set<string>();
    for (let x0 = 0; x0 < 1; x0 += 0.05)
      for (let x1 = x0 + 0.05; x1 <= 1.0001; x1 += 0.05)
        for (let y0 = 0; y0 < 1; y0 += 0.05)
          for (let y1 = y0 + 0.05; y1 <= 1.0001; y1 += 0.05) parts.add(rt().describeCommentBoxPart({ x0, x1, y0, y1 }, (x1 - x0) * (y1 - y0)));
    parts.delete('');
    expect([...parts].sort()).toEqual([...PARTS].sort());
  });

  it('换成界面语言的只有 label，detail 保持英文', () => {
    const english = labelsWith(null);
    const chinese = labelsWith(createCommentLabels('zh-Hans'));
    expect(chinese.nodes.map((n) => n.label)).toEqual([
      '第 3 页 › 组 "Hello world"',
      '第 3 页 › 一级标题 "Hello world"',
      '第 3 页 › 图片 "A cat"',
      '第 3 页 › 矩形',
      '第 3 页 › 表格 2×2',
    ]);
    expect(chinese.slide.label).toBe('第 3 页 "Hello world"');
    expect(chinese.area).toBe('第 3 页 › 组 "Hello world"（左上） · 2 个元素');
    expect(chinese.nodes.map((n) => n.detail)).toEqual(english.nodes.map((n) => n.detail));
    expect(chinese.slide.detail).toBe(english.slide.detail);
  });
});
