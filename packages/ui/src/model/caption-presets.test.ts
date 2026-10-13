import { describe, expect, it } from 'vitest';
import type { CaptionItem, DocumentRecord, Sequence, Track } from '@cuccut/protocol';
import { mergedLineStyle, type Json } from '../render/text-style.ts';
import {
  CAPTION_PRESETS,
  CLASSIC_WORD_ANIMATION,
  PAINT_KEYS,
  WORD_KEYS,
  applyPreset,
  captionStyleOperations,
  currentPreset,
  editWordStyle,
  fontFamilyOf,
  galleryTarget,
  lookStyle,
  presetGroups,
  presetBadge,
  presetModified,
  presetOn,
  presetStyle,
  thumbScene,
  type DesignLook,
} from './caption-presets.ts';
import type { CaptionChip } from './caption-tracks.ts';
import { DEFAULT_CAPTION_STYLE } from './property-values.ts';
import { parseStudioStyle, type CaptionStyleBody } from './caption-style-body.ts';

const preset = (id: string) => CAPTION_PRESETS.find((p) => p.id === id)!;
const STUDIO = 'cuccut.legacy-studio-style/0.1';

const look = (patch: Partial<DesignLook> = {}): DesignLook => ({
  font: 'Poppins SemiBold',
  weight: 600,
  bold: false,
  italic: false,
  color: '#ffffff',
  align: 'center',
  lh: 120,
  spacing: 0,
  upper: '',
  bg: '#000000',
  opacity: 0,
  corners: 0,
  pad: 20,
  plate: 'line',
  outline: false,
  outlineColor: '#000000',
  outlineW: 0,
  shadow: false,
  shDist: 12,
  shAngle: 90,
  shBlur: 24,
  shColor: '#000000cc',
  ...patch,
});

describe('sections and order', () => {
  it('six sections grouped by character: basic 3, social 20, business 6, retro 6, motion 7, kinetic typography 1', () => {
    const groups = presetGroups();
    expect(groups.map((g) => [g.key, g.label, g.presets.length])).toEqual([
      ['basic', '基础', 3],
      ['social', '社交', 20],
      ['business', '商务', 6],
      ['retro', '复古', 6],
      ['motion', '动效', 7],
      ['kinetic', '动态排版', 1],
    ]);
    expect(groups[0]!.presets.map((p) => p.id)).toEqual(['classic', 'shorts', 'simple']);
    expect(groups[5]!.presets.map((p) => [p.id, p.name])).toEqual([['daoyazi', '倒鸭子']]);
    expect(new Set(CAPTION_PRESETS.map((p) => p.id)).size).toBe(43);
  });

  it('each card\'s finish is complete: only finish keys, shadow and glow slots both given values, no font size', () => {
    for (const p of CAPTION_PRESETS) {
      expect(Object.keys(p.style).filter((key) => !PAINT_KEYS.includes(key))).toEqual([]);
      for (const key of ['fontFamily', 'fontWeight', 'fontColor', 'textAlign', 'textTransform', 'background', 'textOutline', 'dropShadow', 'glow']) {
        expect(p.style[key], `${p.id}.${key}`).toBeDefined();
      }
      expect(p.style.fontSize).toBeUndefined();
    }
  });

  it('each card explicitly writes the current word; when applied, only finish keys and word-level keys are written', () => {
    for (const p of CAPTION_PRESETS) {
      expect(p.body.activeWord.mode, p.id).toBeDefined();
      expect(p.body.preset).toEqual({ id: p.id, revision: 1 });
      expect(Object.keys(presetStyle(p)).filter((key) => !PAINT_KEYS.includes(key) && !WORD_KEYS.includes(key)), p.id).toEqual([]);
    }
    expect(preset('classic').body.activeWord).toMatchObject({ mode: 'color', color: '#18E1D6' });
    expect(preset('studio-ktv').body.activeWord).toMatchObject({ mode: 'sweep', sweep: { unit: 'grapheme', guide: true, nextLine: true } });
    expect(preset('daoyazi').body.layout.mode).toBe('sequence');
  });
});

describe('prototype look conversion', () => {
  it('font: commercial fonts replaced with substitutes, weight suffix removed', () => {
    expect(fontFamilyOf('Poppins SemiBold')).toBe('Poppins');
    expect(fontFamilyOf('Poppins Extrabold')).toBe('Poppins');
    expect(fontFamilyOf('The Bold Font')).toBe('Poppins');
    expect(fontFamilyOf('Komika Axis')).toBe('Bangers');
    expect(fontFamilyOf('Playfair Display')).toBe('Playfair Display');
  });

  it('letter spacing ×0.3, stroke ×1.25, corner radius 30×c/55, padding 30×1.4×p/80, line height ÷100', () => {
    const style = lookStyle(look({ spacing: -2, outline: true, outlineW: 11, corners: 30, pad: 20, lh: 115, upper: 'upper' }));
    expect(style.letterSpacing).toBe(-0.6);
    expect(style.textOutline).toEqual({ on: true, color: '#000000', width: 13.75 });
    expect(style.outline).toBe(true);
    expect(style.borderRadius).toBe(16.3636);
    expect(style.backgroundPadding).toBe(10.5);
    expect(style.lineHeight).toBe(1.15);
    expect(style.textTransform).toBe('uppercase');
  });

  it('backdrop: opacity goes into the color\'s alpha, 0 turns it off; whole block / per line', () => {
    expect(lookStyle(look({ bg: '#B6FF60', opacity: 100, plate: 'block' }))).toMatchObject({
      background: true,
      backgroundColor: '#B6FF60FF',
      backgroundStyle: 'block',
    });
    expect(lookStyle(look({ opacity: 0 }))).toMatchObject({ background: false, backgroundColor: '#00000000', backgroundStyle: 'wrap' });
  });

  it('with shadow: distance 0 is glow, otherwise drop shadow (distance and blur ÷100, alpha goes into opacity)', () => {
    expect(lookStyle(look({ shadow: true, shDist: 0, shBlur: 45, shColor: '#FF25CE80' }))).toMatchObject({
      glow: { on: true, color: '#FF25CE', intensity: 50.2, range: 50 },
      dropShadow: { on: false },
    });
    expect(lookStyle(look({ shadow: true, shDist: 5, shAngle: 90, shBlur: 10, shColor: '#000000ff' }))).toMatchObject({
      dropShadow: { on: true, distance: 0.05, rotation: 90, blur: 0.1, color: '#000000', opacity: 1 },
      glow: { on: false },
    });
  });

  it('look cards in the gallery: Lime\'s substitute font, Vegas\'s pink stroke', () => {
    expect(preset('lime').style).toMatchObject({ fontFamily: 'Poppins', fontWeight: 900, fontColor: '#232323', backgroundColor: '#B6FF60FF' });
    expect(preset('vegas').style).toMatchObject({
      textOutline: { on: true, color: '#ff98e9', width: 3.75 },
      dropShadow: { on: true, color: '#FF25CE', opacity: 1 },
    });
  });

  it('classic and Shorts remain as classic_look / shorts_look, no font size', () => {
    expect(preset('classic').style).toMatchObject({
      fontFamily: 'system',
      bold: true,
      fontColor: '#FFFFFF',
      background: false,
      textOutline: { on: true, color: '#000000', width: 14 },
      dropShadow: { on: true, blur: 0.12, distance: 0.08, rotation: 45, color: '#000000', opacity: 0.9 },
    });
    expect(preset('shorts').style).toMatchObject({
      fontWeight: 800,
      lineHeight: 1.1,
      textOutline: { width: 17.5 },
      dropShadow: { rotation: 90, distance: 0.06, blur: 0.1 },
    });
  });
});

describe('apply', () => {
  const body = {
    schema: STUDIO,
    style: {
      x: 50,
      y: 82,
      fontSize: 34,
      order: 'orig',
      fontFamily: 'Inter',
      fontStyle: 'italic',
      bgOn: true,
      origStyle: { fontSize: 28, fontColor: '#FF0000' },
      transStyle: { fontColor: '#00FF00' },
    },
    extra: 1,
  };

  it('all: the whole finish group is replaced; placement, font size, order and other body fields unchanged; finish in overrides is cleared', () => {
    const next = applyPreset(body, preset('karl'), 'all');
    const style = next.style as Json;
    expect(next.extra).toBe(1);
    expect(next.schema).toBe(STUDIO);
    expect(style).toMatchObject({ x: 50, y: 82, fontSize: 34, order: 'orig', fontFamily: 'Poppins', textTransform: 'uppercase' });
    expect(style.fontStyle).toBe('normal');
    expect(style.bgOn).toBeUndefined();
    expect(style.origStyle).toEqual({ fontSize: 28 });
    expect(style.transStyle).toBeUndefined();
    expect(presetOn(style, preset('karl'), ['original', 'translation'])).toBe(true);
    expect(currentPreset(style, ['original', 'translation'])?.id).toBe('karl');
  });

  it('one item changed: source card still lit, marked \'modified\'; old styles with no recorded source card are matched by finish', () => {
    const style = applyPreset(body, preset('karl'), 'all').style as Json;
    expect(presetModified(style, preset('karl'), ['original'])).toBe(false);
    const changed = { ...style, fontColor: '#123456' };
    expect(presetOn(changed, preset('karl'), ['original'])).toBe(true);
    expect(presetModified(changed, preset('karl'), ['original'])).toBe(true);
    const legacy = { ...changed, stylePreset: undefined };
    delete legacy.stylePreset;
    expect(currentPreset(legacy, ['original'])).toBeNull();
    expect(currentPreset({ ...preset('lime').style }, ['original'])?.id).toBe('lime');
  });

  it('applying a card replaces the current word and motion too: old anim / karaokeColor / textMotion cleared', () => {
    const old = { ...body, style: { ...body.style, anim: { name: 'Bounce' }, karaokeColor: '#FF0000', textMotion: { version: 1, in: { preset: 'pop' } } } };
    const style = applyPreset(old, preset('studio-ktv'), 'all').style as Json;
    expect(style.anim).toBeUndefined();
    expect(style.karaokeColor).toBeUndefined();
    expect(style.textMotion).toEqual({ version: 1, karaoke: { color: '#FF6A1A', guide: true, nextLine: true } });
    expect(style.stylePreset).toEqual({ id: 'studio-ktv', revision: 1 });
  });

  it('corner badge: current word mode; inverted-duck badge uses layout mode', () => {
    expect(presetBadge(preset('classic'))).toBe('color');
    expect(presetBadge(preset('studio-ktv'))).toBe('sweep');
    expect(presetBadge(preset('phantom'))).toBe('box');
    expect(presetBadge(preset('daoyazi'))).toBe('sequence');
  });

  it('translation only: written into transStyle, finish keys present at root but not on the card written as null, original untouched', () => {
    const next = applyPreset(body, preset('lime'), 'translation');
    const style = next.style as Json;
    expect(style.fontFamily).toBe('Inter');
    expect(style.origStyle).toEqual(body.style.origStyle);
    const trans = style.transStyle as Json;
    expect(trans.fontFamily).toBe('Poppins');
    expect(trans.bgOn).toBeNull();
    expect(mergedLineStyle(style, 'translation').fontStyle).toBe('normal');
    expect(presetOn(style, preset('lime'), ['translation'])).toBe(true);
    expect(presetOn(style, preset('lime'), ['original'])).toBe(false);
    expect(presetOn(style, preset('lime'), ['original', 'translation'])).toBe(false);
  });

  it('original only: font size in overrides is kept', () => {
    const style = applyPreset(body, preset('ali'), 'original').style as Json;
    expect((style.origStyle as Json).fontSize).toBe(28);
    expect(presetOn(style, preset('ali'), ['original'])).toBe(true);
  });

  it('default preset (spec §5.6) is the \'classic\' finish, comma and period drawn as in the original; the gallery lights \'classic\'', () => {
    const style = DEFAULT_CAPTION_STYLE.style as Json;
    expect(DEFAULT_CAPTION_STYLE.schema).toBe(STUDIO);
    expect(style).toEqual({ ...preset('classic').style, wordAnimation: CLASSIC_WORD_ANIMATION, punct: true });
    // Same literals as in the pipeline and the kernel (change all three together).
    expect(CLASSIC_WORD_ANIMATION).toEqual({
      animationId: 'magic-wbw',
      animationName: 'Color',
      catalogId: 'colourHighlight',
      spoken: {},
      active: { color: '#18E1D6' },
      unspoken: {},
    });
    expect(parseStudioStyle(style).activeWord).toMatchObject({ mode: 'color', color: '#18E1D6' });
    expect(style.textOutline).toEqual({ on: true, color: '#000000', width: 14 });
    expect(currentPreset(style, ['original', 'translation'])?.id).toBe('classic');
    expect(presetModified(style, preset('classic'), ['original', 'translation'])).toBe(false);
  });

  it('without a style document, apply from an empty style', () => {
    const next = applyPreset(undefined, preset('classic'), 'all');
    expect(next.schema).toBe(STUDIO);
    expect(presetOn(next.style as Json, preset('classic'), ['original'])).toBe(true);
  });
});

describe('which style document to apply to', () => {
  const chip = (key: string, kind: CaptionChip['kind'], extra: Partial<CaptionChip> = {}): CaptionChip => ({
    key,
    documentId: key,
    trackId: 't',
    itemIds: [key],
    kind,
    label: kind,
    name: key,
    state: 'on',
    locked: false,
    ...extra,
  });

  it('the style of the selected line; if it has none, takes another one in use on screen; removed ones don\'t count', () => {
    const chips = [chip('a', 'original'), chip('b', 'translation', { styleDocumentId: 's' }), chip('c', 'original', { state: 'shelved', styleDocumentId: 'z' })];
    expect(galleryTarget(chips, 'a')).toEqual({ styleDocumentId: 's', kinds: ['original', 'translation'] });
    expect(galleryTarget([chip('a', 'original')], null)).toEqual({ styleDocumentId: null, kinds: ['original'] });
  });

  it('another line uses a different style: not counted in the lines this one manages', () => {
    const chips = [chip('a', 'original', { styleDocumentId: 's' }), chip('b', 'translation', { styleDocumentId: 'u' })];
    expect(galleryTarget(chips, 'a')).toEqual({ styleDocumentId: 's', kinds: ['original'] });
    expect(galleryTarget(chips, 'b')).toEqual({ styleDocumentId: 'u', kinds: ['translation'] });
  });
});

describe('transaction', () => {
  const base = { enabled: true, locked: false, paintOrder: 0, followPolicy: { kind: 'sequence-fixed' as const } };
  const track = (id: string, locked = false): Track => ({
    id,
    order: 1,
    kind: 'subtitle',
    locked,
    visible: true,
    muted: false,
    solo: { enabled: false, group: 'visual' },
  });
  const caption = (id: string, trackId: string, extra: Partial<CaptionItem> = {}): CaptionItem => ({
    ...base,
    id,
    trackId,
    type: 'caption',
    span: { fromFrame: 0, durationFrames: 30 },
    documentId: 'cap',
    ...extra,
  });
  const sequence = (tracks: Track[], items: Sequence['items']): Sequence => ({
    id: 'seq',
    revision: '1',
    name: '主序列',
    fps: { num: 30, den: 1 },
    canvas: { width: 1920, height: 1080, workingSpace: 'srgb', background: '#000000' },
    durationPolicy: { kind: 'derived' },
    tracks,
    items,
    animationBindings: [],
    transitions: [],
    markers: [],
    ducking: [],
  });
  const seq = sequence(
    [track('t1'), track('t2', true)],
    [caption('c1', 't1'), caption('c2', 't1', { locked: true }), caption('c3', 't2'), caption('c4', 't1', { styleDocumentId: 's' })],
  );

  it('no style document: create one, attached to captions without a style that are not locked', () => {
    expect(captionStyleOperations(seq, undefined, { schema: STUDIO, style: {} })).toEqual([
      { type: 'putDocument', ref: 'style', kind: 'caption-style', name: '字幕样式', body: { schema: STUDIO, style: {} } },
      { type: 'setCaptionStyle', sequenceId: 'seq', itemId: 'c1', styleDocument: { ref: 'style' } },
    ]);
  });

  it('style document exists: write a new version, attach to unstyled ones too', () => {
    const record: DocumentRecord = { id: 's', kind: 'caption-style', name: '字幕样式', currentRevision: '1', revisions: {} };
    expect(captionStyleOperations(seq, record, { schema: STUDIO, style: {} })).toEqual([
      { type: 'putDocument', documentId: 's', kind: 'caption-style', body: { schema: STUDIO, style: {} } },
      { type: 'setCaptionStyle', sequenceId: 'seq', itemId: 'c1', styleDocument: { documentId: 's' } },
    ]);
  });
});

describe('thumbnail', () => {
  it('centered, fixed font size; bilingual gives samples in order: English on top, Chinese below', () => {
    const root = { x: 10, y: 90, width: 40, fontSize: 60, verticalAlign: 'bottom', scale: 2, transStyle: { fontSize: 50, fontColor: '#fff' } };
    const scene = thumbScene(root, ['original', 'translation'], { width: 160, height: 66 }, 13);
    expect(scene.root).toMatchObject({ x: 50, y: 50, verticalAlign: 'center', fontSize: 30 });
    // In bilingual mode the larger line is the translation: 30 × 20/30 × 32/20 = 32
    expect(scene.root.scale).toBeCloseTo((13 * 540) / (32 * 66));
    expect(thumbScene({}, ['original'], { width: 160, height: 66 }, 13).root.scale).toBeCloseTo((13 * 540) / (30 * 66));
    expect(scene.root.transStyle).toEqual({ fontColor: '#fff' });
    // A line dragged separately on screen (its placement in the line override) is stacked back into the stack in the thumbnail.
    const dragged = { ...root, origStyle: { x: 30, y: 12, verticalAlign: 'center', fontColor: '#ff0' } };
    expect(thumbScene(dragged, ['original', 'translation'], { width: 160, height: 66 }, 13).root.origStyle).toEqual({ fontColor: '#ff0' });
    expect(scene.bilingual).toBe(true);
    expect(scene.lines).toEqual([
      { kind: 'original', text: '词是真相' },
      { kind: 'translation', text: 'Words are truth' },
    ]);
    const swapped = thumbScene({ order: 'orig' }, ['original', 'translation'], { width: 160, height: 66 }, 13);
    expect(swapped.lines.find((l) => l.kind === 'original')?.text).toBe('Words are truth');
    expect(thumbScene({}, ['translation'], { width: 88, height: 48 }, 10).lines).toEqual([{ kind: 'translation', text: 'Words are truth' }]);
  });
});

describe('property page changes word-level dimension', () => {
  const sweep = (b: CaptionStyleBody): CaptionStyleBody => ({ ...b, activeWord: { ...b.activeWord, mode: 'sweep', color: '#FF0000' } });

  it('apply to all cards: write root style, change only word-level keys; source card kept, marked \'modified\'', () => {
    const style = applyPreset(undefined, preset('classic'), 'all').style as Json;
    const next = editWordStyle(style, 'original', true, sweep);
    for (const key of PAINT_KEYS) expect(next[key], key).toEqual(style[key]);
    expect(next.textMotion).toMatchObject({ karaoke: { color: '#FF0000' } });
    expect(next.origStyle).toBeUndefined();
    expect(presetOn(next, preset('classic'), ['original'])).toBe(true);
    expect(presetModified(next, preset('classic'), ['original'])).toBe(true);
  });

  it('card applied to original only: written into origStyle; bilingual translation written into transStyle, compiled by translation', () => {
    const style = applyPreset(applyPreset(undefined, preset('classic'), 'all'), preset('karl'), 'original').style as Json;
    const next = editWordStyle(style, 'original', true, sweep);
    expect((next.origStyle as Json).textMotion).toMatchObject({ karaoke: { color: '#FF0000' } });
    expect(next.textMotion).toEqual(style.textMotion);
    const motion = editWordStyle(style, 'translation', true, (b) => ({
      ...b,
      motion: { in: { preset: 'rise', unit: 'cue', trigger: 'spoken', durationSeconds: 0.36, intensity: 1, easing: 'easeOutQuad' } },
    }));
    const trans = motion.transStyle as Json;
    expect((trans.wordAnimation as Json).catalogId).toBe('none');
    expect((trans.textMotion as Json).in).toMatchObject({ preset: 'rise' });
    expect(motion.wordAnimation).toEqual(style.wordAnimation);
  });
});
