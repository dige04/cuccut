import { STUDIO_STYLE, asObject, isObject, mergedLineStyle, num, type Json, type LineKind } from '../render/text-style.ts';

/**
 * The 「原文 | 译文」 (Original | Translation) split in the caption properties page (prototype panel-subprops.jsx per-track properties, model-substyle.js ratio chain): original and translation share one Studio caption style
 * (the preview stacks the two lines as a group according to the style document), and their differences are written in the `origStyle` / `transStyle` overrides. The rendering kernel
 * (`merged_line_style` in `crates/subtitle-render`) and `mergedLineStyle` in render/text-style.ts, which measures the box here, both layer the overrides over the root style,
 * and a null in an override counts as unset.
 *
 * Font size follows a scale chain (same algorithm as `resolveLineStyle`): the root size is on the 30-point basis; in bilingual mode the original = root size × bilingual compression
 * (`bilingualOrigScale`, default 20/30), and the translation = root size × bilingual compression × `transScale` (default 32/20). A line whose override sets `fontSize` uses that value and does not follow the ratio.
 */

/** Same default values as in render/text-style.ts (that file does not export them). */
export const ROOT_FONT_SIZE = 30;
export const BILINGUAL_ORIG_SCALE = 20 / 30;
export const TRANSLATION_RATIO = 32 / 20;

export const LINE_STYLE_KEY: Record<LineKind, 'origStyle' | 'transStyle'> = { original: 'origStyle', translation: 'transStyle' };

const round = (value: number) => Math.round(value * 1e4) / 1e4;

/** Other body fields are kept as they are; the root `style` object is replaced as a whole (`patchCaptionStyle` is a shallow patch and cannot delete keys). */
export function withCaptionStyle(body: unknown, style: Json): Json {
  return { ...asObject(body), schema: STUDIO_STYLE, style };
}

export interface LineSize {
  /** The font size this line is drawn at (30-point basis). */
  size: number;
  /** The font size is set separately in the override, so it does not follow the ratio. */
  explicit: boolean;
  /** Root font size, bilingual compression, translation ratio. */
  root: number;
  bi: number;
  k: number;
  /** Effective font size of the original line (the middle link of the ratio chain). */
  orig: number;
}

/** Effective font size of a line. `compact` means the original and translation are stacked as one group (the original is shrunk by bilingual compression). */
export function lineSize(root: Json, kind: LineKind, compact: boolean): LineSize {
  const base = Math.max(1, num(root.fontSize, ROOT_FONT_SIZE));
  const bi = Math.max(0.1, num(root.bilingualOrigScale, BILINGUAL_ORIG_SCALE));
  const k = Math.max(0.1, num(root.transScale, TRANSLATION_RATIO));
  const partial = root[LINE_STYLE_KEY[kind]];
  const explicit = isObject(partial) && typeof partial.fontSize === 'number';
  const orig = compact ? base * bi : base;
  const computed = kind === 'translation' ? base * bi * k : orig;
  return { size: explicit ? Math.max(1, partial.fontSize as number) : computed, explicit, root: base, bi, k, orig };
}

/** The line as shown on the properties page: root style with its overrides layered on top, and the font size replaced by this line's effective font size. */
export function lineView(root: Json, kind: LineKind, compact: boolean): Json {
  return { ...mergedLineStyle(root, kind), fontSize: Math.round(lineSize(root, kind, compact).size * 10) / 10 };
}

/**
 * The root object that results after a 「文字样式」 (Text style) edit (a root-object patch given by `TextStyleEditor`) is applied to the style.
 * - `own` (when the original or translation is selected in bilingual mode): written into that line's overrides. If no font size was set separately, it falls back along the ratio chain: changing the original's root size (÷ bilingual compression; the translation scales with it),
 *   and changing `transScale` for the translation.
 * - Not `own` (this style governs only one kind of line): written to the root style, and the same-named keys are removed from that line's overrides (otherwise the change would be invisible); the font size is likewise converted back to the root size.
 * If a font size was set separately in an override, the change sets that individual value.
 */
export function editLine(root: Json, patch: Json, kind: LineKind, own: boolean, compact: boolean): Json {
  const key = LINE_STYLE_KEY[kind];
  const { fontSize, ...rest } = patch;
  const size = lineSize(root, kind, compact);
  const next: Json = { ...root };
  const partial = isObject(root[key]) ? { ...root[key] } : null;
  if (own) {
    next[key] = { ...(partial ?? {}), ...rest };
  } else {
    Object.assign(next, rest);
    if (partial) {
      for (const name of Object.keys(rest)) delete partial[name];
      if (Object.keys(partial).length) next[key] = partial;
      else delete next[key];
    }
  }
  if (typeof fontSize === 'number') {
    if (size.explicit) next[key] = { ...asObject(next[key]), fontSize };
    else if (kind === 'translation' && own) next.transScale = round(fontSize / (size.root * size.bi));
    else if (kind === 'translation') next.fontSize = round(fontSize / (size.bi * size.k));
    else next.fontSize = round(compact ? fontSize / size.bi : fontSize);
  }
  return next;
}

/**
 * When both lines of a bilingual pair are selected together (the original and translation sharing the same style, selected by box-select on stage or ⇧-click), a change is written to the root style, and the same-named keys are removed from both lines' overrides
 * (otherwise the change would be invisible on that line). The font size is computed from the original line (the one displayed is the original line's effective font size): converted back to the root size, the separately set sizes in both overrides are removed, and the translation follows the ratio.
 */
export function editBlock(root: Json, patch: Json): Json {
  const { fontSize, ...rest } = patch;
  const next: Json = { ...root, ...rest };
  const keys = typeof fontSize === 'number' ? [...Object.keys(rest), 'fontSize'] : Object.keys(rest);
  for (const key of Object.values(LINE_STYLE_KEY)) {
    if (!isObject(root[key])) continue;
    const partial = { ...root[key] };
    for (const name of keys) delete partial[name];
    if (Object.keys(partial).length) next[key] = partial;
    else delete next[key];
  }
  if (typeof fontSize === 'number') next.fontSize = round(fontSize / lineSize(root, 'original', true).bi);
  return next;
}

/** How many items are set separately in this line's overrides (null counts too, as a value that overrides the root style). */
export function lineOverrides(root: Json, kind: LineKind): number {
  const partial = root[LINE_STYLE_KEY[kind]];
  return isObject(partial) ? Object.keys(partial).length : 0;
}

/** This line follows the shared style entirely: remove its overrides. */
export function followShared(root: Json, kind: LineKind): Json {
  const next = { ...root };
  delete next[LINE_STYLE_KEY[kind]];
  return next;
}

/** Set this line's font size back to follow the ratio: remove `fontSize` from its overrides. */
export function followRatio(root: Json, kind: LineKind): Json {
  const key = LINE_STYLE_KEY[kind];
  const partial = isObject(root[key]) ? { ...root[key] } : null;
  if (!partial) return root;
  delete partial.fontSize;
  const next = { ...root };
  if (Object.keys(partial).length) next[key] = partial;
  else delete next[key];
  return next;
}
