import { describe, expect, it } from 'vitest';
import type { Json } from '../render/text-style.ts';
import { CAPTION_PRESETS, PAINT_KEYS, WORD_KEYS, presetStyle } from './caption-presets.ts';
import { CELL_KEYS, fromCell, parseWordAnimation, toCell, wordAnimationOf } from './caption-word-animation.ts';
import { compileCaptionStyle, editCaptionStyle, parseStudioStyle, type CaptionStyleBody, type CompileContext } from './caption-style-body.ts';
import FIXTURE from './caption-style-body.fixture.json';

const SOURCE: CompileContext = { role: 'source', hasWordTiming: true };
const TRANSLATION: CompileContext = { role: 'translation', hasWordTiming: false };
const preset = (id: string) => CAPTION_PRESETS.find((p) => p.id === id)!;
const pick = (style: Json, keys: readonly string[]) => Object.fromEntries(keys.filter((k) => k in style).map((k) => [k, style[k]]));

/** Value ranges of the kernel's `textMotion` (`deny_unknown_fields`: one invalid item and the whole document is dropped). */
function expectValidTextMotion(tm: unknown, id: string) {
  if (tm === undefined) return;
  const t = tm as Json;
  expect(Object.keys(t).every((k) => ['version', 'in', 'out', 'loop', 'emphasis', 'karaoke'].includes(k)), id).toBe(true);
  expect(t.version).toBe(1);
  for (const stage of ['in', 'out', 'loop']) {
    const e = t[stage] as Json | undefined;
    if (!e) continue;
    expect(Object.keys(e).every((k) => ['preset', 'unit', 'durationSeconds', 'staggerSeconds', 'intensity', 'easing', 'order', 'seed'].includes(k)), id).toBe(true);
    expect(['cue', 'line', 'word', 'grapheme']).toContain(e.unit);
    expect(e.durationSeconds as number).toBeGreaterThanOrEqual(0.001);
    expect(e.intensity as number).toBeLessThanOrEqual(2);
  }
  const emphasis = t.emphasis as Json | undefined;
  if (emphasis) expect(emphasis.color).toMatch(/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/);
  const karaoke = t.karaoke as Json | undefined;
  if (karaoke) expect(karaoke.color).toMatch(/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/);
}

describe('current word ↔ word animation catalog', () => {
  it('19 cells round trip: cell → activeWord → wordAnimation → parsed back to the same cell and same payload', () => {
    expect(CELL_KEYS).toHaveLength(19);
    for (const cell of CELL_KEYS) {
      const { activeWord, entrance } = fromCell(cell);
      const payload = wordAnimationOf(activeWord, entrance);
      expect(payload.catalogId, cell).toBe(cell);
      const back = parseWordAnimation({ wordAnimation: payload });
      expect(toCell(back.activeWord, back.entrance), cell).toBe(cell);
      expect(wordAnimationOf(back.activeWord, back.entrance), cell).toEqual(payload);
    }
  });

  it('without wordAnimation follows the kernel: color change, color taken from karaokeColor, then falls back to #8CAAFF', () => {
    expect(parseWordAnimation({}).activeWord).toMatchObject({ mode: 'color', color: '#8CAAFF' });
    expect(parseWordAnimation({ karaokeColor: '#123456' }).activeWord).toMatchObject({ mode: 'color', color: '#123456' });
  });
});

describe('preset compilation', () => {
  it('all 43 compile, textMotion falls within the kernel\'s value range; each writes wordAnimation', () => {
    expect(CAPTION_PRESETS).toHaveLength(43);
    for (const p of CAPTION_PRESETS) {
      for (const ctx of [SOURCE, TRANSLATION]) {
        const style = compileCaptionStyle(p.body, ctx);
        expect(style.wordAnimation, p.id).toBeDefined();
        expectValidTextMotion(style.textMotion, p.id);
      }
    }
  });

  it('finishes of 42 match existing finishes key by key (31 look, 9 Studio, classic and Shorts)', () => {
    const fixture = FIXTURE as Record<string, Json>;
    expect(Object.keys(fixture)).toHaveLength(42);
    for (const [id, paint] of Object.entries(fixture)) expect(preset(id).style, id).toEqual(paint);
  });

  it('compile → parse → compile unchanged (keys written by applying a card)', () => {
    for (const p of CAPTION_PRESETS) {
      for (const kind of ['original', 'translation'] as const) {
        const style = presetStyle(p, kind);
        expect(compileCaptionStyle(parseStudioStyle(style), SOURCE), `${p.id}/${kind}`).toEqual(style);
      }
    }
  });

  it('old styles (unknown keys, old aliases) parsed and compiled again match the original values key by key', () => {
    const root = { x: 50, y: 82, fontSize: 34, order: 'orig', fontFamily: 'Inter', fontStyle: 'italic', bgOn: true, anim: { name: 'Bounce' }, karaokeColor: '#FF0000', origStyle: { fontSize: 28 } };
    expect(compileCaptionStyle(parseStudioStyle(root), SOURCE)).toEqual(root);
  });
});

describe('dimensions don\'t affect each other', () => {
  const root = presetStyle(preset('studio-focus'));

  it('changing the current word doesn\'t change finish keys', () => {
    const next = editCaptionStyle(root, (b) => ({ ...b, activeWord: { ...b.activeWord, mode: 'box', box: { color: '#00FF00', radius: 0.2, padding: [0.2, 0.08] } } }));
    expect(pick(next, PAINT_KEYS)).toEqual(pick(root, PAINT_KEYS));
    expect(next.wordAnimation).not.toEqual(root.wordAnimation);
  });

  it('changing finish doesn\'t change word-level keys', () => {
    const next = editCaptionStyle(root, (b) => ({ ...b, surface: { ...b.surface, color: '#00FF00' } }));
    expect(next.fontColor).toBe('#00FF00');
    expect(pick(next, WORD_KEYS)).toEqual(pick(root, WORD_KEYS));
  });

  it('changing motion doesn\'t change finish or current word', () => {
    const next = editCaptionStyle(root, (b): CaptionStyleBody => ({
      ...b,
      motion: { in: { preset: 'pop', unit: 'word', trigger: 'enter', durationSeconds: 0.24, staggerSeconds: 0.05, intensity: 1, easing: 'easeOutQuad' } },
    }));
    expect(pick(next, PAINT_KEYS)).toEqual(pick(root, PAINT_KEYS));
    expect(next.wordAnimation).toEqual(root.wordAnimation);
    expect((next.textMotion as Json).in).toMatchObject({ preset: 'pop', unit: 'word' });
  });
});

describe('translation', () => {
  it('current word always none, no color sweep, entrance when spoken dropped; the appear motion kept', () => {
    for (const id of ['studio-ktv', 'karl', 'phantom', 'studio-focus']) {
      const style = compileCaptionStyle(preset(id).body, TRANSLATION);
      expect((style.wordAnimation as Json).catalogId, id).toBe('none');
      expect((style.textMotion as Json | undefined)?.karaoke, id).toBeUndefined();
      expect((style.textMotion as Json | undefined)?.emphasis, id).toBeUndefined();
    }
    expect((compileCaptionStyle(preset('studio-word-drop').body, TRANSLATION).textMotion as Json).in).toMatchObject({ preset: 'cascade' });
  });

  it('original without word-level timing same as translation', () => {
    const style = compileCaptionStyle(preset('studio-ktv').body, { role: 'source', hasWordTiming: false });
    expect((style.wordAnimation as Json).catalogId).toBe('none');
  });
});

describe('inverted-duck envelope', () => {
  it('caption hangs under wordAnimation, no catalogId; takeover requires content orig and style.version 1', () => {
    const style = compileCaptionStyle(preset('daoyazi').body, SOURCE);
    const wa = style.wordAnimation as Json;
    expect(wa.catalogId).toBeUndefined();
    expect(style.anim).toBeUndefined();
    expect(wa.caption).toMatchObject({ content: 'orig', style: { id: 'caption-daoyazi', version: 1 }, intensity: 60, speed: 1 });
    const options = (wa.caption as Json).options as Json[];
    expect(options[0]).toMatchObject({ key: 'daoyazi' });
    expect(typeof options[0]!.value).toBe('object');
  });

  it('emphasis word appearance scale clamped to 0.8–1.6', () => {
    const body = { ...preset('classic').body, emphasis: { scale: 3 } };
    expect((compileCaptionStyle(body, SOURCE).emphasisLook as Json).scale).toBe(1.6);
  });
});
