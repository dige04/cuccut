import { engineRanges, lazyArray, lazyObject } from '@cuccut/editor-wasm';
import { defineMessages, type EditOperation, type Fx, type Id, type SequenceItem } from '@cuccut/protocol';
import { zhHans } from './effects-panel.zh-Hans.ts';
import { zhHant } from './effects-panel.zh-Hant.ts';
import { ja } from './effects-panel.ja.ts';
import { ko } from './effects-panel.ko.ts';
import { es } from './effects-panel.es.ts';
import { fr } from './effects-panel.fr.ts';
import { de } from './effects-panel.de.ts';
import { nl } from './effects-panel.nl.ts';
import { ptBR } from './effects-panel.pt-BR.ts';
import { it } from './effects-panel.it.ts';
import { ru } from './effects-panel.ru.ts';
import { pl } from './effects-panel.pl.ts';
import { tr } from './effects-panel.tr.ts';
import { vi } from './effects-panel.vi.ts';

type ColorKey = 'brightness' | 'contrast' | 'saturation' | 'temperature' | 'hue';
type OtherKey = 'filterPreset' | 'effectPreset' | 'grayscale' | 'exposure' | 'sharpen' | 'noise' | 'vignette';

/** Field names for the “Effects” section (English is the source of keys and types; translations are in `effects-panel.zh-Hans.ts`). */
const en = {
  color: {
    brightness: 'Brightness',
    contrast: 'Contrast',
    saturation: 'Saturation',
    temperature: 'Temperature',
    hue: 'Hue',
  } as Record<ColorKey, string>,
  other: {
    filterPreset: 'Filter preset',
    effectPreset: 'Effect preset',
    grayscale: 'Grayscale',
    exposure: 'Exposure',
    sharpen: 'Sharpen',
    noise: 'Noise',
    vignette: 'Vignette',
  } as Record<OtherKey, string>,
};
export type EffectsPanelMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * Pure logic for the “Effects” section of the inspector (`fx` in video format spec §3.8; the `setEffects` command replaces it as a whole).
 *
 * `fx` has fixed fields, and each card on the page manages a few of them: color correction manages five color-grading fields, blur manages `blur`, shadow manages `shadow`, and stroke manages `stroke`.
 * While a card is open, those fields are written in `fx`; closing it removes them (`fx` has no separate on/off switch). Fields with no control on the page (filter presets, grayscale, exposure, ...)
 * are kept as they are and sent back on submit. Lengths are pixels at a 540 short edge.
 */

/** The four cards on the page, in page order. */
export type EffectKind = 'color-adjust' | 'gaussian-blur' | 'drop-shadow' | 'stroke';
export const EFFECT_KINDS: readonly EffectKind[] = ['color-adjust', 'gaussian-blur', 'drop-shadow', 'stroke'];

const FX = lazyObject(() => engineRanges().fx);

/**
 * The five color correction items: `scale` is the ratio between the slider reading and the field (percent ÷ 100; hue is in degrees, the field is in [-1, 1] and multiplying by 180 gives degrees). The reading's range is the engine's
 * field interval (the value range in `editor-wasm`) multiplied by `scale`.
 */
export const COLOR_FIELDS: readonly {
  key: ColorKey;
  label: string;
  min: number;
  max: number;
  scale: number;
  unit: string;
}[] = lazyArray(() =>
  (
    [
      { key: 'brightness', range: FX.adjust, scale: 100, unit: '%' },
      { key: 'contrast', range: FX.adjust, scale: 100, unit: '%' },
      { key: 'saturation', range: FX.adjust, scale: 100, unit: '%' },
      { key: 'temperature', range: FX.temperature, scale: 100, unit: '%' },
      { key: 'hue', range: FX.adjust, scale: 180, unit: '°' },
    ] as const
  ).map(({ range, ...field }) => ({
    ...field,
    get label() {
      return M.color[field.key];
    },
    min: range[0] * field.scale,
    max: range[1] * field.scale,
  })),
);

/** Maximum a number box accepts (the engine's value range; the slider's usual range is written separately on the page): blur radius, shadow blur, shadow opacity, stroke width. */
export const FX_LIMITS = lazyObject(
  () =>
    ({
      blur: FX.blur[1],
      shadowBlur: FX.shadowBlur[1],
      shadowOpacity: FX.shadowOpacity[1],
      strokeWidth: FX.strokeWidthMax,
    }) as const,
);

type Shadow = NonNullable<Fx['shadow']>;
type Stroke = NonNullable<Fx['stroke']>;

/** Initial values when a card is opened. */
export const EFFECT_DEFAULTS = {
  blur: 8,
  shadow: { offsetX: 0, offsetY: 8, blur: 12, color: '#000000', opacity: 0.5 } satisfies Shadow,
  stroke: { width: 4, color: '#FFFFFF' } satisfies Stroke,
} as const;

/** Clips that have `fx`: visual media (video, image, sticker, placeholder box, whiteboard) and compositions. */
export type EffectItem = Extract<SequenceItem, { fx?: Fx }>;

export function hasEffects(item: SequenceItem): item is EffectItem {
  switch (item.type) {
    case 'video':
    case 'image':
    case 'sticker':
    case 'placeholder':
    case 'whiteboard':
    case 'composition':
      return true;
    default:
      return false;
  }
}

/** Which cards this kind of clip has: all four for clips with `fx`, none for the rest (text and graphics do not take `fx`). */
export function effectKindsFor(item: SequenceItem): EffectKind[] {
  return hasEffects(item) ? [...EFFECT_KINDS] : [];
}

/** Whether this card is open (its fields are written in `fx`). */
export function effectOn(fx: Fx | undefined, kind: EffectKind): boolean {
  if (!fx) return false;
  switch (kind) {
    case 'color-adjust':
      return COLOR_FIELDS.some((field) => fx[field.key] !== undefined);
    case 'gaussian-blur':
      return fx.blur !== undefined;
    case 'drop-shadow':
      return !!fx.shadow;
    case 'stroke':
      return !!fx.stroke;
  }
}

const finite = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

/** The value of one item on a card: color correction uses the color-grading fields, blur is `radius` (that is, `blur`), and shadow and stroke use their own fields; the default value is used when absent. */
export function effectNumber(fx: Fx | undefined, kind: EffectKind, key: string): number {
  switch (kind) {
    case 'color-adjust':
      return finite(fx?.[key as (typeof COLOR_FIELDS)[number]['key']], 0);
    case 'gaussian-blur':
      return finite(fx?.blur, EFFECT_DEFAULTS.blur);
    case 'drop-shadow':
      return finite((fx?.shadow ?? EFFECT_DEFAULTS.shadow)[key as keyof Shadow], finite(EFFECT_DEFAULTS.shadow[key as keyof Shadow], 0));
    case 'stroke':
      return finite((fx?.stroke ?? EFFECT_DEFAULTS.stroke)[key as keyof Stroke], finite(EFFECT_DEFAULTS.stroke[key as keyof Stroke], 0));
  }
}

/** The shadow and stroke color. */
export function effectColor(fx: Fx | undefined, kind: 'drop-shadow' | 'stroke'): string | undefined {
  return kind === 'drop-shadow' ? fx?.shadow?.color : fx?.stroke?.color;
}

/** Edits a card (values are merged into the fields it manages); if the card is still closed, it is opened with default values. */
export function withEffect(fx: Fx | undefined, kind: EffectKind, change: Record<string, unknown>): Fx {
  const base: Fx = { ...fx };
  switch (kind) {
    case 'color-adjust': {
      for (const field of COLOR_FIELDS) {
        const value = change[field.key];
        if (typeof value === 'number') base[field.key] = value;
        else if (base[field.key] === undefined) base[field.key] = 0;
      }
      return base;
    }
    case 'gaussian-blur':
      return { ...base, blur: finite(change.radius, base.blur ?? EFFECT_DEFAULTS.blur) };
    case 'drop-shadow':
      return { ...base, shadow: { ...(base.shadow ?? EFFECT_DEFAULTS.shadow), ...change } as Shadow };
    case 'stroke':
      return { ...base, stroke: { ...(base.stroke ?? EFFECT_DEFAULTS.stroke), ...change } as Stroke };
  }
}

/** Closes a card: removes the fields it manages. */
export function withoutEffect(fx: Fx | undefined, kind: EffectKind): Fx {
  const next: Fx = { ...fx };
  switch (kind) {
    case 'color-adjust':
      for (const field of COLOR_FIELDS) delete next[field.key];
      break;
    case 'gaussian-blur':
      delete next.blur;
      break;
    case 'drop-shadow':
      delete next.shadow;
      break;
    case 'stroke':
      delete next.stroke;
      break;
  }
  return next;
}

/** Toggles a card: when opening, writes the default values (an already open card is left alone); when closing, removes them (reopening returns to the defaults). */
export function toggleEffect(fx: Fx | undefined, kind: EffectKind, on: boolean): Fx {
  if (!on) return withoutEffect(fx, kind);
  return effectOn(fx, kind) ? { ...fx } : withEffect(fx, kind, {});
}

/** Reset all: closes the four cards; fields with no control on the page are kept as they are. */
export function resetEffects(fx: Fx | undefined): Fx {
  return EFFECT_KINDS.reduce<Fx>((next, kind) => withoutEffect(next, kind), { ...fx });
}

/** Fields with no control on the page (omitted or identity values do not count) are kept as they are. */
const OTHER_FIELDS: readonly { key: OtherKey; label: string }[] = (
  ['filterPreset', 'effectPreset', 'grayscale', 'exposure', 'sharpen', 'noise', 'vignette'] as const
).map((key) => ({
  key,
  get label() {
    return M.other[key];
  },
}));

/** Names of the fields in `fx` that have no control on the page but are actually in effect. */
export function unknownKinds(fx: Fx | undefined): string[] {
  if (!fx) return [];
  return OTHER_FIELDS.filter(({ key }) => {
    const value = fx[key];
    if (value === undefined || value === 'none') return false;
    return typeof value !== 'number' || (Number.isFinite(value) && value !== 0);
  }).map((field) => field.label);
}

/** The complete `fx` for submission: removed (`null`) when there is nothing. */
export function setEffectsOperation(sequenceId: Id, itemId: Id, fx: Fx | undefined): EditOperation {
  return { type: 'setEffects', sequenceId, itemId, fx: fx && Object.keys(fx).length ? fx : null };
}

/** Whether any card on the page is open (used by the section header's “Reset all”). */
export function hasKnownEffects(fx: Fx | undefined): boolean {
  return EFFECT_KINDS.some((kind) => effectOn(fx, kind));
}
