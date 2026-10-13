import { elementPresets, engineRanges, lazyArray, lazyObject, type ConfettiPreset, type Range } from '@cuccut/editor-wasm';
import { live } from '@cuccut/protocol';
import { R } from './render-copy.ts';
import { isObject, type Json } from './text-style.ts';

/**
 * Confetti (built-in generator `cuccut.confetti`, following the design file model-confetti.js): ten recipes are starting points; color, shape, particle motion, emission and seed are all parameters, and the duration follows the clip. Two hard constraints:
 * 1. Closed-form motion: each particle's position, rotation, size and opacity are explicit functions of its own age τ. Nothing is integrated and no previous frame is stored, so scrubbing the playhead, reverse playback and frame skipping do not drift.
 * 2. Random numbers come only from splitmix64(seed, i·16 + c): channel c of particle i is a pure function; `randomSeed()` is used once, only when a new element is created.
 * The order of styles, the palettes, the shapes and the default emission read the built-in recipes in `motion`, and the parameter ranges read the timeline's validation constants (both through the edit-semantics WASM). This is where parameters are filled in for creation and the property panel; style names and shape names (UI copy) are in `render-copy.ts`. Particle solving and drawing happen in the render kernel.
 */

const ranges = lazyObject(() => engineRanges().confetti);

/** Limits: number of palette colors, particles emitted per second in continuous emission, particles per burst, and seconds between bursts. */
export const CONFETTI_LIMITS = lazyObject(
  () =>
    ({
      colors: ranges.maxColors,
      rate: ranges.rate[1],
      count: ranges.count[1],
      interval: ranges.interval[1],
    }) as const,
);

/** Shape name (UI copy), taken in the current UI language when read. */
export const CONFETTI_SHAPE_NAMES = live(() => R.confetti.shapes);
export type ConfettiShape = keyof typeof CONFETTI_SHAPE_NAMES;

const isShape = (value: unknown): value is ConfettiShape => typeof value === 'string' && Object.hasOwn(CONFETTI_SHAPE_NAMES, value);

/** 12 unit shapes; the order is the property panel's order. */
export const CONFETTI_SHAPES: readonly ConfettiShape[] = lazyArray(() => ranges.shapes.filter(isShape));

export interface ConfettiEmit {
  mode: 'continuous' | 'burst';
  /** Continuous emission: particles born per second. */
  rate: number;
  /** Burst: particles per burst. */
  count: number;
  /** Burst: the b-th burst happens at b × interval seconds; 0 = fire once only. */
  interval: number;
  /** No particles are born during the last lifetime before the end of the clip (so they have all fallen by the end). */
  settle: boolean;
}

/** One confetti style: its recipe (palette, shapes, emitters and default emission), plus the style name shown in the UI and its source (which MIT-licensed source it is adapted from). */
export interface ConfettiStyle extends ConfettiPreset {
  key: string;
  name: string;
  from: string;
  shapes: readonly ConfettiShape[];
}

/** Ten recipes, in catalog order. A recipe is computed once and kept; the style name (UI copy) is a reader that takes the current UI language each time. */
export const CONFETTI_STYLES: readonly ConfettiStyle[] = lazyArray(() =>
  elementPresets().confetti.map((preset) => ({
    ...preset,
    key: preset.id,
    get name() {
      return R.confetti.styles[preset.id] ?? preset.id;
    },
    from: preset.sources[0]?.split('/')[0] ?? '',
    shapes: preset.shapes.filter(isShape),
  })),
);

export function confettiStyle(key: unknown): ConfettiStyle {
  return CONFETTI_STYLES.find((style) => style.key === key) ?? CONFETTI_STYLES[0]!;
}

/** Parameter ranges (scale, wind, opacity, emission and origin). */
export const CONFETTI_RANGES = lazyObject(
  () =>
    ({
      size: ranges.size,
      speed: ranges.speed,
      gravity: ranges.gravity,
      drift: ranges.drift,
      spin: ranges.spin,
      wind: ranges.wind,
      opacity: ranges.opacity,
      rate: ranges.rate,
      count: ranges.count,
      interval: ranges.interval,
      angle: ranges.angle,
      spread: ranges.spread,
      originX: ranges.origin,
      originY: ranges.origin,
    }) as const satisfies Record<string, Range>,
);

const within = (value: number, range: Range) => Math.min(range[1], Math.max(range[0], value));

/** A full set of confetti parameters. When `origin` / `angle` / `spread` are null, they follow the recipe's emitter. */
export interface ConfettiProps {
  style: string;
  seed: number;
  colors: string[];
  shapes: ConfettiShape[];
  size: number;
  speed: number;
  gravity: number;
  drift: number;
  spin: number;
  wind: number;
  opacity: number;
  emit: ConfettiEmit;
  origin: { x: number; y: number } | null;
  angle: number | null;
  spread: number | null;
}

const MULTIPLIERS = ['size', 'speed', 'gravity', 'drift', 'spin', 'wind', 'opacity'] as const;

/** Seed: a non-negative integer within 53 bits (both sides' JSON can carry it exactly); anything else is treated as 0. */
export function confettiSeed(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(Math.abs(n)));
}

/** Full parameters for one style (the caller supplies the seed: `randomSeed()` when creating, kept when switching styles). */
export function confettiDefaults(styleKey?: unknown, seed?: unknown): ConfettiProps {
  const style = confettiStyle(styleKey);
  return {
    style: style.key,
    seed: confettiSeed(seed),
    colors: style.colors.slice(0, CONFETTI_LIMITS.colors),
    shapes: style.shapes.slice(),
    size: 1,
    speed: 1,
    gravity: 1,
    drift: 1,
    spin: 1,
    wind: 0,
    opacity: 1,
    emit: { ...style.emit, settle: false },
    origin: null,
    angle: null,
    spread: null,
  };
}

/** Fills in a possibly incomplete set of parameters (old documents, hand-written JSON); out-of-range values are clamped back into range. */
export function normalizeConfetti(value: unknown): ConfettiProps {
  const raw: Json = isObject(value) ? value : {};
  const base = confettiDefaults(raw.style, raw.seed);
  const colors = Array.isArray(raw.colors) ? raw.colors.filter((c): c is string => typeof c === 'string' && c.length > 0) : [];
  const shapes = Array.isArray(raw.shapes) ? raw.shapes.filter((k): k is ConfettiShape => (CONFETTI_SHAPES as readonly unknown[]).includes(k)) : [];
  const out: ConfettiProps = {
    ...base,
    colors: (colors.length ? colors : base.colors).slice(0, CONFETTI_LIMITS.colors),
    shapes: shapes.length ? shapes : base.shapes,
  };
  for (const key of MULTIPLIERS) {
    const n = raw[key];
    out[key] = within(typeof n === 'number' && Number.isFinite(n) ? n : base[key], CONFETTI_RANGES[key]);
  }
  const emit: Json = isObject(raw.emit) ? raw.emit : {};
  const positive = (n: unknown, fallback: number) => (typeof n === 'number' && Number.isFinite(n) && n !== 0 ? n : fallback);
  out.emit = {
    mode: (emit.mode ?? base.emit.mode) === 'burst' ? 'burst' : 'continuous',
    rate: Math.round(within(positive(emit.rate, base.emit.rate), CONFETTI_RANGES.rate)),
    count: Math.round(within(positive(emit.count, base.emit.count), CONFETTI_RANGES.count)),
    interval: within(typeof emit.interval === 'number' && Number.isFinite(emit.interval) ? emit.interval : base.emit.interval, CONFETTI_RANGES.interval),
    settle: emit.settle === true,
  };
  const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
  out.angle = finite(raw.angle) ? within(raw.angle, CONFETTI_RANGES.angle) : null;
  out.spread = finite(raw.spread) ? within(raw.spread, CONFETTI_RANGES.spread) : null;
  const origin = isObject(raw.origin) ? raw.origin : null;
  out.origin =
    origin && finite(origin.x) && finite(origin.y) ? { x: within(origin.x, CONFETTI_RANGES.originX), y: within(origin.y, CONFETTI_RANGES.originY) } : null;
  return out;
}

/** Switching style: parameters return to that style's defaults; only the seed carries over (switching style is re-picking, not editing). */
export function switchConfettiStyle(props: unknown, styleKey: string): ConfettiProps {
  return confettiDefaults(styleKey, isObject(props) ? props.seed : undefined);
}

/** Random seed written when a new element is created: a non-zero safe integer within 53 bits. */
export function randomSeed(): number {
  const hi = Math.floor(Math.random() * 0x200000); // 21 bits
  const lo = Math.floor(Math.random() * 0x100000000); // 32 bits
  return hi * 0x100000000 + lo || 1;
}

/** Emission parameters shown in the panel: when not customized, they fall back to the recipe's first emitter; a style with several emitters is marked `multi`. */
export function effectiveEmit(props: ConfettiProps): { x: number; y: number; angle: number; spread: number; multi: boolean } {
  const recipe = confettiStyle(props.style);
  const emitter = recipe.emitters[0]!;
  return {
    x: props.origin ? props.origin.x : emitter.x,
    y: props.origin ? props.origin.y : emitter.y,
    angle: props.angle ?? emitter.angle ?? recipe.angle,
    spread: props.spread ?? recipe.spread,
    multi: !props.origin && recipe.emitters.length > 1,
  };
}
