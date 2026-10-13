import { lazyArray, placeDefault } from '@cuccut/editor-wasm';
import type { ConfettiProps } from '@cuccut/protocol';
import { CONFETTI_STYLES, confettiDefaults, confettiStyle, randomSeed } from '../render/confetti.ts';
import { PROGRESS_STYLES } from '../render/progress.ts';
import { WAVE_STYLES } from '../render/visualizer.ts';
import { defineMessages, live } from '@cuccut/protocol';
import { placeBox, type VisualLayer } from './new-items.ts';
import { zhHans } from './element-catalog.zh-Hans.ts';
import { zhHant } from './element-catalog.zh-Hant.ts';
import { ja } from './element-catalog.ja.ts';
import { ko } from './element-catalog.ko.ts';
import { es } from './element-catalog.es.ts';
import { fr } from './element-catalog.fr.ts';
import { de } from './element-catalog.de.ts';
import { nl } from './element-catalog.nl.ts';
import { ptBR } from './element-catalog.pt-BR.ts';
import { it } from './element-catalog.it.ts';
import { ru } from './element-catalog.ru.ts';
import { pl } from './element-catalog.pl.ts';
import { tr } from './element-catalog.tr.ts';
import { vi } from './element-catalog.vi.ts';

/**
 * Tiles in the element panel (following the old ccut-editor-core `element_tiles` and `default_place_of`, and the prototype `model-elpanel.js`):
 * stickers, animated stickers (confetti), shapes, and visualizations (progress bars, timers, waveforms). Only the styles that can be drawn are included; each tile carries its own default look, length and placement.
 */

export type ElementGroup = 'sticker' | 'confetti' | 'shape' | 'progress' | 'counter' | 'wave';

export interface ElementTile {
  /** Globally unique (used to tell them apart when one shape takes two tiles). */
  key: string;
  group: ElementGroup;
  label: string;
  /** Default length when created: a number of seconds, or follows the whole film (`film`). */
  seconds: number | 'film';
  /** Spans two columns in the progress grid (the two bar styles; `isSquare` is false in the design draft). */
  wide?: boolean;
  /** Confetti style: the thumbnail computes one frame from it, not from the newly created layer (that layer gets a fresh seed each time). */
  confetti?: string;
  /** The newly created layer (the canvas determines the layout box). */
  layer(canvas: { width: number; height: number }): VisualLayer;
}

/** Canvas-independent placement: center and box width (percent of the frame). */
type At = { x: number; y: number; w?: number };

/** Palette slot (display names are in the catalog's `colors`). */
type ColorSlot =
  | 'bar'
  | 'track'
  | 'background'
  | 'color1'
  | 'color2'
  | 'foreground'
  | 'bars'
  | 'waveform'
  | 'fill'
  | 'line'
  | 'dots'
  | 'peak'
  | 'core'
  | 'rings'
  | 'ribbonA'
  | 'ribbonB';

/** Display names for the element catalog (English is the source of keys and types; translations are in `element-catalog.zh-Hans.ts`). The name of a newly created instance is written in the UI language at the moment it is created. */
const en = {
  stickers: {
    badge_check: 'Check badge',
    badge_cross: 'Cross badge',
    star_burst: 'Starburst',
    speech_bubble: 'Speech bubble',
    heart: 'Heart',
    bolt: 'Lightning bolt',
    pin: 'Pushpin',
    sparkle: 'Sparkle',
    arrow_curved: 'Curved arrow',
    crown: 'Crown',
  } as Record<string, string>,
  shapes: {
    rect: 'Rectangle',
    ellipse: 'Ellipse',
    triangle: 'Triangle',
    rombus: 'Rhombus',
    pentagon: 'Pentagon',
    hex: 'Hexagon',
    octagon: 'Octagon',
    squig: 'Scalloped circle',
    squig2: 'Block arrow',
    tick: 'Check mark',
    tick2: 'Cross',
    chevron: 'Chevron',
    chevron2: 'Zigzag band',
    cross2: 'Rounded plus',
    cross: 'Plus',
    love2: 'Rounded heart',
    love: 'Heart',
    diamond: 'Gem',
    star: 'Five-pointed star',
    sharp: 'Ten-pointed star',
    star2: 'Twelve-pointed star',
    sharp2: 'Speech bubble',
  } as Record<string, string>,
  progress: {
    normal: 'Square bar',
    rounded: 'Rounded bar',
    circle: 'Ring',
    donut: 'Donut',
    border: 'Border',
    reverse_border: 'Reverse border',
    rainbow_border: 'Rainbow border',
    reverse_rainbow_border: 'Reverse rainbow border',
    strobe_border: 'Strobe border',
    reverse_strobe_border: 'Reverse strobe border',
    snake: 'Snake',
    snake_spin: 'Spinning snake',
    snake_rainbow: 'Rainbow snake',
    snake_spin_rainbow: 'Spinning rainbow snake',
  } as Record<string, string>,
  waves: {
    bars: 'Bars',
    bars_rounded: 'Rounded bars',
    bars_bottom: 'Bottom-aligned bars',
    ring_bars: 'Ring bars',
    oscilloscope: 'Oscilloscope',
    ring_wave: 'Ring wave',
    spectrum_area: 'Spectrum area',
    dots: 'Dot matrix',
    pulse_rings: 'Pulse rings',
    ribbons: 'Ribbons',
  } as Record<string, string>,
  colors: {
    bar: 'Bar',
    track: 'Track',
    background: 'Background',
    color1: 'Color 1',
    color2: 'Color 2',
    foreground: 'Foreground',
    bars: 'Bars',
    waveform: 'Waveform',
    fill: 'Fill',
    line: 'Line',
    dots: 'Dots',
    peak: 'Peak',
    core: 'Core',
    rings: 'Rings',
    ribbonA: 'Ribbon A',
    ribbonB: 'Ribbon B',
  } as Record<ColorSlot, string>,
  roundedRect: 'Rounded rectangle',
  countdown: 'Countdown',
  countup: 'Count up',
  progressName: (label: string) => `Progress bar · ${label}`,
  waveName: (label: string) => `Waveform · ${label}`,
  confettiName: (label: string) => `Confetti · ${label}`,
  shapeName: (name: string) => `Shape · ${name}`,
  stickerName: (label: string) => `Sticker · ${label}`,
  sections: {
    sticker: { title: 'Stickers', note: '10 built-in + brand library' },
    dynamic: {
      title: 'Animated stickers',
      note: '10 confetti + Lottie from the brand library',
    },
    shape: { title: 'Shapes', note: '23 tiles · 5-color cycle' },
    visualizer: {
      title: 'Visualizers',
      note: '14 progress + 2 timers + 10 waveforms',
    },
  } as Record<ElementSection['key'], { title: string; note: string }>,
};
export type ElementCatalogMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/** Built-in stickers (the ten in `sticker-templates.ts`), 18% wide, square. */
const STICKERS: readonly string[] = Object.keys(en.stickers);

export const SHAPE_NAMES: Record<string, string> = live(() => M.shapes);

/** A five-color cycle (fill, stroke) indexed by tile index modulo 5: color is a property of the grid position, not of the shape. */
const COLOR_CYCLE: [string, string][] = [
  ['#FF4C45', '#E43A33'],
  ['#3CADFF', '#3598DF'],
  ['#FFD646', '#E2BE3C'],
  ['#A46CFF', '#8A5BD8'],
  ['#3CADFF', '#3598DF'],
];

/**
 * The 24 cells of the shape grid (`[shape, corner radius]`); the index is the color index. The second cell is a rounded rectangle (14.4 pixels at a 540 short edge);
 * the arrow in cell 11 is an endpoint-type shape and is not shown as a tile; it stays in the table only to hold its color index.
 */
const SHAPE_ORDER: [string, number | null][] = [
  ['rect', null],
  ['rect', 14.4],
  ['ellipse', null],
  ['triangle', null],
  ['rombus', null],
  ['pentagon', null],
  ['hex', null],
  ['octagon', null],
  ['squig', null],
  ['squig2', null],
  ['arrow', null],
  ['tick', null],
  ['tick2', null],
  ['chevron', null],
  ['chevron2', null],
  ['cross2', null],
  ['cross', null],
  ['love2', null],
  ['love', null],
  ['diamond', null],
  ['star', null],
  ['sharp', null],
  ['star2', null],
  ['sharp2', null],
];

/** The UI name of a visualization style and the names of each of its palettes (the PROGRESS / WAVES tables in the design draft's `model-elements.js`); styles with an empty palette have no color control. */
export interface StyleKind {
  key: string;
  label: string;
  colors: readonly string[];
}

const styleKinds = (rows: readonly [string, readonly ColorSlot[]][], labels: () => Record<string, string>): readonly StyleKind[] =>
  rows.map(([key, slots]) => ({
    key,
    get label() {
      return labels()[key] ?? key;
    },
    get colors() {
      return slots.map((slot) => M.colors[slot]);
    },
  }));

/** 14 progress bar styles; the order is the core's `order` (the inspector's style catalog is sorted by it). */
export const PROGRESS_KINDS: readonly StyleKind[] = styleKinds(
  [
    ['normal', ['bar', 'track']],
    ['rounded', ['bar', 'track']],
    ['circle', ['bar', 'track']],
    ['donut', ['bar', 'track']],
    ['border', ['bar', 'background']],
    ['reverse_border', ['bar', 'background']],
    ['rainbow_border', []],
    ['reverse_rainbow_border', []],
    ['strobe_border', ['color1', 'color2']],
    ['reverse_strobe_border', ['color1', 'color2']],
    ['snake', ['foreground', 'background']],
    ['snake_spin', ['foreground', 'background']],
    ['snake_rainbow', ['background']],
    ['snake_spin_rainbow', ['background']],
  ],
  () => M.progress,
);

/** 10 waveform styles; the order is the core's `order`. */
export const WAVE_KINDS: readonly StyleKind[] = styleKinds(
  [
    ['bars', ['bars']],
    ['bars_rounded', ['bars']],
    ['bars_bottom', ['bars']],
    ['ring_bars', ['bars']],
    ['oscilloscope', ['waveform']],
    ['ring_wave', ['waveform']],
    ['spectrum_area', ['fill', 'line']],
    ['dots', ['dots', 'peak']],
    ['pulse_rings', ['core', 'rings']],
    ['ribbons', ['ribbonA', 'ribbonB']],
  ],
  () => M.waves,
);

/** Order of the progress grid (the fixed grid order with the two timer tiles removed); the two timer tiles are inserted after cell 11 (`snake`). */
const PROGRESS_GRID = [
  'rounded',
  'normal',
  'border',
  'reverse_border',
  'donut',
  'rainbow_border',
  'reverse_rainbow_border',
  'circle',
  'strobe_border',
  'reverse_strobe_border',
  'snake',
  'snake_spin',
  'snake_rainbow',
  'snake_spin_rainbow',
];
const COUNTER_AT = 11;

/**
 * Default placement for progress bars and waveforms: the kind's default box (`place_defaults` in `render-graph`, via `editor-wasm`). Progress bars are 80% wide and 5% of frame height;
 * waveforms sit flush at the bottom, spanning the full width, at 20% of frame height. The frame plan sets the box by kind and ignores the style's aspect ratio; square and bordered styles also fit in this box.
 */
function kindPlace(type: 'progress' | 'visualizer'): At {
  const { x, y, w } = placeDefault(type);
  return { x, y, w };
}

const labelOf = (kinds: readonly StyleKind[], key: string) => kinds.find((kind) => kind.key === key)?.label ?? key;

function progressTile(style: string): ElementTile {
  const preset = PROGRESS_STYLES[style]!;
  return {
    key: `progress.${style}`,
    group: 'progress',
    get label() {
      return labelOf(PROGRESS_KINDS, style);
    },
    seconds: 'film',
    wide: preset.aspect === 'bar',
    layer: () => ({
      type: 'progress',
      name: M.progressName(labelOf(PROGRESS_KINDS, style)),
      place: placeBox(kindPlace('progress')),
      progress: {
        style,
        mainColor: preset.mainColor,
        secondaryColor: preset.secondaryColor,
      },
    }),
  };
}

function waveTile(style: string): ElementTile {
  const preset = WAVE_STYLES[style]!;
  return {
    key: `wave.${style}`,
    group: 'wave',
    get label() {
      return labelOf(WAVE_KINDS, style);
    },
    seconds: 'film',
    layer: () => ({
      type: 'visualizer',
      name: M.waveName(labelOf(WAVE_KINDS, style)),
      place: placeBox(kindPlace('visualizer')),
      // The dB window follows the style: the oscilloscope and the circular wave use the narrow −120 / −10 window.
      visualizer: {
        style,
        mainColor: preset.mainColor,
        secondaryColor: preset.secondaryColor,
        minDb: preset.minDb,
        maxDb: preset.maxDb,
      },
    }),
  };
}

/** Default length for new confetti (design draft `NEW_SPAN`): any duration; particles are computed from the clip duration. */
const CONFETTI_SECONDS = 5;

/**
 * Confetti (the confetti branch of `newElement` in the design draft): placed with that style's recipe defaults; the seed is written randomly at the moment of the click (and kept if the style is later changed);
 * it fills the frame: it is a particle field, not a sticker. The start point, direction and spread that follow the recipe are not written (the default is to follow the recipe).
 */
function confettiTile(styleKey: string): ElementTile {
  return {
    key: `confetti.${styleKey}`,
    group: 'confetti',
    get label() {
      return confettiStyle(styleKey).name;
    },
    seconds: CONFETTI_SECONDS,
    confetti: styleKey,
    layer: () => {
      const confetti = Object.fromEntries(Object.entries(confettiDefaults(styleKey, randomSeed())).filter(([, value]) => value !== null));
      return {
        type: 'confetti',
        name: M.confettiName(confettiStyle(styleKey).name),
        place: placeBox({ x: 50, y: 50, w: 100 }),
        confetti: confetti as unknown as ConfettiProps,
      };
    },
  };
}

/** Style of the timer digits (font size at a 540 short edge). */
const COUNTER_FONT = 48;
export const COUNTER_STYLE = {
  fontSize: COUNTER_FONT,
  fontWeight: 'bold',
  fontColor: '#FFFFFF',
  textAlign: 'center',
};

function shapeTiles(): ElementTile[] {
  return SHAPE_ORDER.flatMap(([kind, corner], index): ElementTile[] => {
    if (!SHAPE_NAMES[kind]) return [];
    const [fill, stroke] = COLOR_CYCLE[index % COLOR_CYCLE.length]!;
    const nameOf = () => (corner === null ? SHAPE_NAMES[kind]! : M.roundedRect);
    return [
      {
        key: `shape.${index}.${kind}`,
        group: 'shape',
        get label() {
          return nameOf();
        },
        seconds: 10,
        layer: () => ({
          type: 'shape',
          name: M.shapeName(nameOf()),
          place: placeBox({ x: 50, y: 50, w: 15 }),
          shape: {
            shape: kind,
            fill,
            stroke,
            strokeWidth: 3,
            ...(corner === null ? {} : { cornerRadius: [corner, corner, corner, corner] }),
          },
        }),
      },
    ];
  });
}

function counterTile(mode: 'countdown' | 'countup'): ElementTile {
  return {
    key: `counter.${mode}`,
    group: 'counter',
    get label() {
      return M[mode];
    },
    seconds: 10,
    // A timer is a timing readout on a text instance: the box follows text sizing (28% wide; height derived from the kind).
    layer: () => ({
      type: 'text',
      name: M[mode],
      place: placeBox({ x: 50, y: 50, w: 28 }),
      counter: { mode },
      style: { ...COUNTER_STYLE },
    }),
  };
}

/** The progress grid (with the two timer tiles in between), then waveforms: the visualization sub-page is arranged in this order. */
const PROGRESS_TILES = lazyArray(() => PROGRESS_GRID.map(progressTile));
const COUNTER_TILES = (['countdown', 'countup'] as const).map(counterTile);

export const ELEMENT_TILES: readonly ElementTile[] = lazyArray(() => [
  ...STICKERS.map(
    (templateId): ElementTile => ({
      key: `sticker.${templateId}`,
      group: 'sticker',
      get label() {
        return M.stickers[templateId] ?? templateId;
      },
      seconds: 8,
      layer: () => ({
        type: 'sticker',
        name: M.stickerName(M.stickers[templateId] ?? templateId),
        place: placeBox({ x: 50, y: 50, w: 18 }),
        sticker: { source: 'template', templateId },
      }),
    }),
  ),
  ...CONFETTI_STYLES.map((style) => confettiTile(style.key)),
  ...shapeTiles(),
  ...PROGRESS_TILES.slice(0, COUNTER_AT),
  ...COUNTER_TILES,
  ...PROGRESS_TILES.slice(COUNTER_AT),
  ...WAVE_KINDS.map((kind) => waveTile(kind.key)),
]);

/** The four tiles of the visualization section on the catalog page (design draft `VIZ_PICK`, hand-picked): two progress styles, one waveform and one timer. */
export const VISUALIZER_PEEK: readonly string[] = ['progress.rainbow_border', 'progress.rounded', 'wave.ribbons', 'counter.countdown'];

export interface ElementSection {
  key: 'sticker' | 'dynamic' | 'shape' | 'visualizer';
  title: string;
  note: string;
  tiles: ElementTile[];
}

/**
 * Sections of the catalog page (prototype: stickers → animated stickers → shapes → visualizations); within visualizations, progress, timers and waveforms sit next to each other. During a search, a section with no matches is not shown,
 * except those listed in `keep` (brand-library stickers are not in this table; when they match, that section must stay).
 */
export function elementSections(query = '', keep: readonly ElementSection['key'][] = []): ElementSection[] {
  const q = query.trim().toLowerCase();
  const hit = (tile: ElementTile, title: string) => !q || tile.label.toLowerCase().includes(q) || `${title} ${GROUP_WORDS[tile.group]}`.includes(q);
  const pick = (groups: ElementGroup[], title: string) => ELEMENT_TILES.filter((tile) => groups.includes(tile.group) && hit(tile, title));
  const section = (key: ElementSection['key'], groups: ElementGroup[]): ElementSection => {
    const { title, note } = M.sections[key];
    return { key, title, note, tiles: pick(groups, title) };
  };
  return [
    section('sticker', ['sticker']),
    section('dynamic', ['confetti']),
    section('shape', ['shape']),
    section('visualizer', ['progress', 'counter', 'wave']),
  ].filter((section) => section.tiles.length > 0 || keep.includes(section.key));
}

// i18n-ignore-start: search keywords; both the Chinese and English terms are accepted, independent of the UI language
const GROUP_WORDS: Record<ElementGroup, string> = {
  sticker: 'sticker',
  confetti: '彩纸 confetti 粒子 particles',
  shape: 'shape',
  progress: '进度 progress',
  counter: '计时 counter',
  wave: '声波 wave',
};
// i18n-ignore-end

/** Options in the inspector's “Shape” dropdown: rectangle, ellipse and 20 outline styles (excluding endpoint shapes). */
export const SHAPE_CHOICES = Object.keys(en.shapes).map((key) => ({
  key,
  get label() {
    return SHAPE_NAMES[key]!;
  },
}));
