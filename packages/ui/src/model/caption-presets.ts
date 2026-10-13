import { defineMessages, formatRef, LOCALES, type CaptionItem, type DocumentRecord, type EditOperation, type Id, type Sequence } from '@cuccut/protocol';
import { STUDIO_STYLE, asObject, isObject, mergedLineStyle, type Json, type LineKind } from '../render/text-style.ts';
import type { CaptionChip } from './caption-tracks.ts';
import { LINE_STYLE_KEY, lineSize } from './caption-lines.ts';
import { CLASSIC_PAINT, LOOKS, PRESET_TABLE, SHORTS_PAINT, STUDIO_DESIGNS, completePaint, lookStyle, type PresetCategory } from './caption-preset-looks.ts';
import { DEFAULT_SEQUENCE } from './caption-sequence-style.ts';
import {
  CAPTION_STYLE_SCHEMA,
  PAINT_KEYS,
  PRESET_KEY,
  WORD_KEYS,
  compileCaptionStyle,
  keepOverrides,
  motionEffect,
  parseStudioStyle,
  sameKeys,
  type CaptionStyleBody,
  type CompileContext,
  type Motion,
  type MotionEffect,
  type MotionStage,
} from './caption-style-body.ts';
import { normalizeActive, type ActiveMode } from './caption-word-animation.ts';
import { zhHans } from './caption-presets.zh-Hans.ts';
import { zhHant } from './caption-presets.zh-Hant.ts';
import { ja } from './caption-presets.ja.ts';
import { ko } from './caption-presets.ko.ts';
import { es } from './caption-presets.es.ts';
import { fr } from './caption-presets.fr.ts';
import { de } from './caption-presets.de.ts';
import { nl } from './caption-presets.nl.ts';
import { ptBR } from './caption-presets.pt-BR.ts';
import { it } from './caption-presets.it.ts';
import { ru } from './caption-presets.ru.ts';
import { pl } from './caption-presets.pl.ts';
import { tr } from './caption-presets.tr.ts';
import { vi } from './caption-presets.vi.ts';

export { PAINT_KEYS, WORD_KEYS } from './caption-style-body.ts';
export { fontFamilyOf, lookStyle, type DesignLook, type PresetCategory } from './caption-preset-looks.ts';

/** Copy for the caption-style gallery (the English is the source of the keys and types; translations are in `caption-presets.zh-Hans.ts`). Cards that are proper names (Shorts, Ali……) are not in the catalogue. */
const en = {
  categories: {
    basic: 'Basic',
    social: 'Social',
    business: 'Business',
    retro: 'Retro',
    motion: 'Motion',
    kinetic: 'Kinetic type',
  } as Record<PresetCategory, string>,
  classic: 'Classic',
  simple: 'Simple',
  daoyazi: 'Kinetic Captions',
  studio: {
    'studio-focus': 'Spoken Emphasis',
    'studio-word-tiles': 'Word Tiles',
    'studio-word-drop': 'Word Drop',
    'studio-paper-typewriter': 'Typewriter',
    'studio-line-swipe': 'Line Swipe',
    'studio-soft-focus': 'Soft Focus',
    'studio-rise-settle': 'Rise & Settle',
    'studio-kinetic-wave': 'Kinetic Wave',
    'studio-ktv': 'Karaoke',
  } as Record<string, string>,
  styleDocument: 'Subtitle style',
};
export type CaptionPresetsMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/** The name of the default caption-style document created by the pipeline (`jobsCaptionLayer.styleName` in jobs): documents created in the UI carry the same name. */
const STYLE_NAME_REF = { key: 'jobsCaptionLayer.styleName' };

/** What a newly created caption-style document is called (in the current language). */
export function defaultStyleName(): string {
  return formatRef(STYLE_NAME_REF, M.styleDocument);
}

/** Whether this name is the default caption-style name: it is recognised whichever language it was created in (the document name is written into the video in the language used when it was created). */
export function isDefaultStyleName(name: string): boolean {
  return name === M.styleDocument || LOCALES.some((locale) => formatRef(STYLE_NAME_REF, '', locale) === name);
}


/**
 * Presets for the caption-style gallery (caption style model design §7, prototype `BC_CS.presets()`).
 *
 * A preset is a new body (`CaptionStyleBody`) with one value for each of seven dimensions, plus a category: font and paint, the current word (`activeWord`, written out explicitly for every preset), motion (`motion`), and layout mode (upside-down duck is `layout.mode: 'sequence'`). Applying one = compiling it into a Studio style (`compileCaptionStyle`), written into the paint keys (`PAINT_KEYS`) and word-level keys (`WORD_KEYS`: `wordAnimation` / `textMotion` / `wordBackground` / `emphasisLook`
 * and the source card `stylePreset`); position, font size, display timing, bilingual order and spacing are left unchanged.
 *
 * 43 presets: basic 3 (Classic, Shorts, Simple), social 20, business 6, retro 6, motion 7, dynamic typography 1 (upside-down duck). The paint data and current-word values are in `caption-preset-looks.ts`.
 */

export interface CaptionPreset {
  id: string;
  name: string;
  category: PresetCategory;
  /** The new body for this preset (`preset` records the preset itself). */
  body: CaptionStyleBody;
  /** The compiled paint (every paint key gets a value). */
  style: Json;
}

/** Gallery sections (§7, grouped only by mood). */
export const PRESET_GROUPS: readonly { key: PresetCategory; label: string }[] = (['basic', 'social', 'business', 'retro', 'motion', 'kinetic'] as const).map(
  (key) => ({
    key,
    get label() {
      return M.categories[key];
    },
  }),
);

/** The Classic paint: used by the default preset (`DEFAULT_CAPTION_STYLE`). */
export const CLASSIC: Json = CLASSIC_PAINT;

const LAYOUT_BASE = { mode: 'line', anchor: 'bottom', y: 0.86, width: 0.8, maxLines: 2 } as const;
const SOURCE: CompileContext = { role: 'source', hasWordTiming: true };
const TRANSLATION: CompileContext = { role: 'translation', hasWordTiming: false };
const roleOf = (kind: LineKind): CompileContext => (kind === 'translation' ? TRANSLATION : SOURCE);

function pick(style: Json, keys: readonly string[]): Json {
  const out: Json = {};
  for (const key of keys) if (key in style) out[key] = style[key];
  return out;
}

type PresetRow = (typeof PRESET_TABLE)[number];

/** Entrance when spoken only has the preset name written, filled in from the motion catalogue defaults; triggers on appearance are kept as they are. */
function presetMotion(row: PresetRow): Motion | undefined {
  if (!row.motion) return undefined;
  const out: Motion = {};
  for (const [stage, value] of Object.entries(row.motion) as [MotionStage, Partial<MotionEffect> & { preset: string }][]) {
    const spoken = Object.keys(value).length === 1;
    const effect = spoken ? motionEffect(stage, value.preset, { trigger: 'spoken', unit: 'word' }) : motionEffect(stage, value.preset, { ...value, trigger: 'enter' });
    if (effect) out[stage] = effect;
  }
  return out;
}

function presetPaint(id: string): { paint: Json; wordBox?: CaptionStyleBody['surface']['wordBox'] } {
  if (id === 'classic') return { paint: CLASSIC_PAINT };
  if (id === 'shorts') return { paint: SHORTS_PAINT };
  const design = STUDIO_DESIGNS.find((d) => d.id === id);
  if (design) return { paint: completePaint(design.style), wordBox: design.wordBox };
  // The upside-down duck preset (倒鸭子) borrows Casper's paint (prototype `dz.look = 'casper'`).
  const look = LOOKS.find((l) => l.id === (id === 'daoyazi' ? 'casper' : id))!;
  return { paint: lookStyle(look.look) };
}

function presetName(id: string): string {
  if (id === 'classic') return M.classic;
  if (id === 'simple') return M.simple;
  if (id === 'daoyazi') return M.daoyazi;
  if (id === 'shorts') return 'Shorts';
  return M.studio[id] ?? LOOKS.find((l) => l.id === id)?.name ?? id;
}

function buildPreset(row: PresetRow): CaptionPreset {
  const { paint, wordBox } = presetPaint(row.id);
  // Paint is parsed from the old data: paint keys whose compiled value does not match the original are recorded in legacy, so applying the preset matches the old paint key for key; the current word, motion and placement come from the preset.
  const parsed = keepOverrides(parseStudioStyle(paint), PAINT_KEYS);
  const body: CaptionStyleBody = {
    schema: CAPTION_STYLE_SCHEMA,
    typography: parsed.typography,
    surface: wordBox ? { ...parsed.surface, wordBox } : parsed.surface,
    layout:
      row.id === 'daoyazi'
        ? { ...LAYOUT_BASE, mode: 'sequence', sequence: DEFAULT_SEQUENCE }
        : row.id === 'shorts'
          ? { ...LAYOUT_BASE, y: 0.72, width: 0.6 }
          : { ...LAYOUT_BASE },
    activeWord: normalizeActive(row.activeWord),
    preset: { id: row.id, revision: 1 },
  };
  if (parsed.legacy) body.legacy = parsed.legacy;
  const motion = presetMotion(row);
  if (motion) body.motion = motion;
  let style: Json | null = null;
  return {
    id: row.id,
    get name() {
      return presetName(row.id);
    },
    category: row.category,
    body,
    get style() {
      return (style ??= pick(compileCaptionStyle(body, SOURCE), PAINT_KEYS));
    },
  };
}

/** Gallery cards, in display order. */
export const CAPTION_PRESETS: readonly CaptionPreset[] = PRESET_TABLE.map(buildPreset);

/** The keys this card writes into the style (paint + word-level). `kind` is which kind of line it lands on: a translation's current word is always none, and entrance when spoken is not included. */
export function presetStyle(preset: CaptionPreset, kind: LineKind = 'original'): Json {
  return pick(compileCaptionStyle(preset.body, roleOf(kind)), [...PAINT_KEYS, ...WORD_KEYS]);
}

/**
 * The current word of the “Classic” card (colour change #18E1D6): the default preset (`DEFAULT_CAPTION_STYLE`, spec §5.6) carries it, so new captions that don't apply a card still match the Classic card that is highlighted in the gallery. The pipeline (`packages/jobs/src/pipelines/caption-layer.ts`)
 * and the kernel (`video_model::caption_style::default_studio_style`) each keep a copy of the same literal; change all three together.
 */
export const CLASSIC_WORD_ANIMATION: Json = presetStyle(CAPTION_PRESETS.find((p) => p.id === 'classic')!).wordAnimation as Json;

/** Section display: in the order of `PRESET_GROUPS`; empty sections are not shown. */
export function presetGroups(): { key: PresetCategory; label: string; presets: CaptionPreset[] }[] {
  return PRESET_GROUPS.map((g) => ({ key: g.key, label: g.label, presets: CAPTION_PRESETS.filter((p) => p.category === g.key) })).filter(
    (g) => g.presets.length > 0,
  );
}

/** Where it applies: `all` is every line that uses this style; `original` / `translation` only apply to that line (written into `origStyle` / `transStyle`). */
export type PresetScope = 'all' | LineKind;

const REPLACED: readonly string[] = [...PAINT_KEYS, ...WORD_KEYS];

function withoutReplaced(style: Json): Json {
  const out: Json = {};
  for (const [key, value] of Object.entries(style)) if (!REPLACED.includes(key)) out[key] = value;
  return out;
}

/**
 * The style document body after applying a card (same as `patchCaptionStyle`: other body fields are kept as they are).
 * - `all`: the root style's paint keys and word-level keys are replaced as a group with what this card compiles to; the same two groups are cleared from `origStyle` / `transStyle` (overrides such as font size are kept), and the override is removed if it ends up empty.
 * - One line: compiled according to that line's role (a translation's current word is always none) and written into that line's overrides. Keys present in the root style but not in this card are written as `null` in the override
 *   (both renderers treat null as unset), so the root style's old values do not show through from underneath. The other line is left alone.
 */
export function applyPreset(body: unknown, preset: CaptionPreset, scope: PresetScope): Json {
  const doc = asObject(body);
  const root = asObject(doc.style);
  let next: Json;
  if (scope === 'all') {
    next = { ...withoutReplaced(root), ...presetStyle(preset, 'original') };
    for (const key of Object.values(LINE_STYLE_KEY)) {
      if (!(key in root)) continue;
      const rest = withoutReplaced(asObject(root[key]));
      if (Object.keys(rest).length) next[key] = rest;
      else delete next[key];
    }
  } else {
    const key = LINE_STYLE_KEY[scope];
    const style = presetStyle(preset, scope);
    const masked: Json = {};
    for (const name of REPLACED) if (name in root && !(name in style)) masked[name] = null;
    next = { ...root, [key]: { ...withoutReplaced(asObject(root[key])), ...masked, ...style } };
  }
  return { ...doc, schema: STUDIO_STYLE, style: next };
}

/** The style of one line after layering the overrides; null (masking a value on the root) counts as absent. */
function lineStyle(root: Json, kind: LineKind): Json {
  const out: Json = {};
  for (const [key, value] of Object.entries(mergedLineStyle(root, kind))) if (value !== null) out[key] = value;
  return out;
}

/** The source card recorded for this line (`stylePreset.id`); null if none is recorded. */
export function presetIdOf(root: Json, kind: LineKind): string | null {
  const id = asObject(lineStyle(root, kind)[PRESET_KEY]).id;
  return typeof id === 'string' ? id : null;
}

/** Whether the source card is recorded on the root (for all lines) or in that line's override (for one line only) decides which role it is compared by. */
function appliedKind(root: Json, kind: LineKind): LineKind {
  const own = root[LINE_STYLE_KEY[kind]];
  return isObject(own) && PRESET_KEY in own ? kind : 'original';
}

/**
 * Whether this card is the source card for these lines: judged by the recorded `stylePreset.id` (it still counts if other dimensions were changed; a “Modified” label is shown beside it);
 * an old style with no recorded source card is matched key by key against its paint.
 */
export function presetOn(root: Json, preset: CaptionPreset, kinds: readonly LineKind[]): boolean {
  if (kinds.length === 0) return false;
  return kinds.every((kind) => {
    const id = presetIdOf(root, kind);
    if (id !== null) return id === preset.id;
    return sameKeys(lineStyle(root, kind), preset.style, Object.keys(preset.style));
  });
}

/**
 * The source card is lit, but these lines no longer match what it compiles to (prototype “Modified · Revert”). Only lines that record this card are checked; old styles with no recorded source card
 * (such as the default style) are recognised by their paint, and they never had word-level keys written, so they do not count as modified.
 */
export function presetModified(root: Json, preset: CaptionPreset, kinds: readonly LineKind[]): boolean {
  return kinds.some((kind) => presetIdOf(root, kind) === preset.id && !sameKeys(lineStyle(root, kind), presetStyle(preset, appliedKind(root, kind)), REPLACED));
}

/** Card badge: this card's current-word mode (upside-down duck is a layout mode). */
export function presetBadge(preset: CaptionPreset): ActiveMode | 'sequence' {
  return preset.body.layout.mode === 'sequence' ? 'sequence' : preset.body.activeWord.mode;
}

/** The card currently applied to these lines; null when mixed or absent. */
export function currentPreset(root: Json, kinds: readonly LineKind[]): CaptionPreset | null {
  return CAPTION_PRESETS.find((preset) => presetOn(root, preset, kinds)) ?? null;
}

/**
 * In the properties page, changing the word-level dimensions “Current word”, “Motion” or “Upside-down duck”: the style for this line, after layering its overrides, is parsed into a body, changed, and compiled again according to this line's role,
 * and only the word-level keys (`WORD_KEYS`) are written back; no paint or placement keys change. Where it is written:
 * - Original: if this card was applied only to the original (the source card is recorded in `origStyle`), it is written into `origStyle`; otherwise it is written to the root style;
 * - Translation: when stacked with the original as a bilingual pair, it is written into `transStyle` (the root style is shared by both lines); when only the translation is present, it is written to the root style.
 * When writing into an override, word-level keys present on the root but absent from the compiled result are written as null to mask them.
 */
export function editWordStyle(root: Json, kind: LineKind, paired: boolean, edit: (body: CaptionStyleBody) => CaptionStyleBody): Json {
  const next = pick(compileCaptionStyle(edit(parseStudioStyle(lineStyle(root, kind))), roleOf(kind)), WORD_KEYS);
  const key = LINE_STYLE_KEY[kind];
  const own = asObject(root[key]);
  const intoLine = kind === 'translation' ? paired : PRESET_KEY in own;
  if (!intoLine) {
    const out = withoutWord(root);
    return { ...out, ...next };
  }
  const line: Json = withoutWord(own);
  for (const name of WORD_KEYS) {
    if (name in next) line[name] = next[name];
    else if (name in root) line[name] = null;
  }
  return { ...root, [key]: line };
}

/** The current body of this line (the properties page reads the values for current word, motion and upside-down duck from it). */
export function lineBody(root: Json, kind: LineKind): CaptionStyleBody {
  return parseStudioStyle(lineStyle(root, kind));
}

function withoutWord(style: Json): Json {
  const out: Json = {};
  for (const [key, value] of Object.entries(style)) if (!WORD_KEYS.includes(key)) out[key] = value;
  return out;
}

/**
 * The style document the gallery applies to: the one used by the track selected in the strip; if it has no style yet, the one used by other captions on screen; null if neither (created when applying).
 * `kinds` is which kinds of line this style governs after applying: those using it on screen, plus those without a style yet that get attached along with it.
 */
export function galleryTarget(chips: readonly CaptionChip[], selected: string | null): { styleDocumentId: Id | null; kinds: LineKind[] } {
  const showing = chips.filter((chip) => chip.state !== 'shelved');
  const current = showing.find((chip) => chip.key === selected) ?? showing[0] ?? null;
  const styleDocumentId = current?.styleDocumentId ?? showing.find((chip) => chip.styleDocumentId)?.styleDocumentId ?? null;
  const present = new Set(showing.filter((chip) => !chip.styleDocumentId || chip.styleDocumentId === styleDocumentId).map((chip) => chip.kind));
  return { styleDocumentId, kinds: (['original', 'translation'] as const).filter((kind) => present.has(kind)) };
}

/** Captions on the sequence that have no style yet and can take one (the engine rejects locked instances and those on locked tracks, so they are skipped). */
function unstyledCaptions(sequence: Sequence): CaptionItem[] {
  const locked = new Set(sequence.tracks.filter((track) => track.locked).map((track) => track.id));
  return sequence.items.filter((item): item is CaptionItem => item.type === 'caption' && !item.styleDocumentId && !item.locked && !locked.has(item.trackId));
}

/**
 * A transaction that writes a caption style (one undo step): if a style document exists, write its new version; otherwise create a new one (ref `style`, same as inspector-caption).
 * In both cases, attach the style to captions that do not have one yet — the original and translation use one style so that they stack as a bilingual pair (the preview groups by style document).
 */
export function captionStyleOperations(sequence: Sequence, record: DocumentRecord | undefined, body: Json): EditOperation[] {
  const target = record ? { documentId: record.id } : { ref: 'style' };
  const attach = unstyledCaptions(sequence).map(
    (item): EditOperation => ({ type: 'setCaptionStyle', sequenceId: sequence.id, itemId: item.id, styleDocument: target }),
  );
  const put: EditOperation = record
    ? { type: 'putDocument', documentId: record.id, kind: record.kind, body }
    : { type: 'putDocument', ref: 'style', kind: 'caption-style', name: defaultStyleName(), body };
  return [put, ...attach];
}

/** The English–Chinese sample for gallery thumbnails (the thumb line of `subtitle.sample` in data.js; samples are assigned by position: English on the top line, Chinese on the bottom line). */
// i18n-ignore: bilingual sample; the line below is always Chinese, to demonstrate a two-line bilingual display, and does not follow the UI language
export const THUMB_SAMPLE = { main: 'Words are truth', sub: '词是真相' } as const;

/** The grey background of the thumbnail (prototype .sthumb's 135° gradient, top-left to bottom-right): data drawn on the canvas, which does not change with the UI theme (the prototype is also pinned to light). */
export const THUMB_BACKDROP = ['#CFD2D6', '#A8ACB3'] as const;

/**
 * The style and lines used for thumbnails: paint copied over, placement changed to “centred, full width, fixed font size”. The prototype thumbnails are drawn at a fixed font size (`SubThumb` fz 13),
 * not following the on-screen font size and position; bilingual ratio, order and spacing are kept, so the relative sizes of the two lines match the screen.
 * `px` is the pixel size of the larger line on the thumbnail (a size set separately in an override does not count; the ratio chain applies).
 * Placement in line overrides is also removed: a line dragged separately on screen (`x`, `y`, `verticalAlign` in `origStyle` / `transStyle`) is still stacked back into the two-line stack in the thumbnail.
 */
export function thumbScene(
  root: Json,
  kinds: readonly LineKind[],
  size: { width: number; height: number },
  px: number,
): { root: Json; lines: { kind: LineKind; text: string }[]; bilingual: boolean } {
  const sized = (style: unknown): Json => {
    const { fontSize: _size, fontSizeBasis: _basis, ...rest } = asObject(style);
    return rest;
  };
  const unplaced = (style: unknown): Json => {
    const { x: _x, y: _y, verticalAlign: _align, ...rest } = sized(style);
    return rest;
  };
  const out: Json = {
    ...sized(root),
    x: 50,
    y: 50,
    width: 94,
    verticalAlign: 'center',
    fontSize: 30,
  };
  for (const key of Object.values(LINE_STYLE_KEY)) if (isObject(root[key])) out[key] = unplaced(root[key]);
  const shown = kinds.length ? kinds : (['original'] as const);
  const bilingual = shown.length > 1;
  const largest = Math.max(...shown.map((kind) => lineSize(out, kind, bilingual).size));
  out.scale = (px * 540) / (largest * Math.max(1, Math.min(size.width, size.height)));
  const top: LineKind = bilingual && (root.order ?? 'trans') !== 'trans' ? 'original' : bilingual ? 'translation' : shown[0]!;
  return { root: out, bilingual, lines: shown.map((kind) => ({ kind, text: kind === top ? THUMB_SAMPLE.main : THUMB_SAMPLE.sub })) };
}
