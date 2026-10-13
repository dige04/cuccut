import { defineMessages, type Place, type Rate, type ShapeProps } from '@cuccut/protocol';
import { placeBox, type VisualLayer } from './new-items.ts';
import { TEXT_PRESETS, type TextPreset, type TextPresetLayer } from './text-preset-data.ts';
import { zhHans } from './text-presets.zh-Hans.ts';
import { zhHant } from './text-presets.zh-Hant.ts';
import { ja } from './text-presets.ja.ts';
import { ko } from './text-presets.ko.ts';
import { es } from './text-presets.es.ts';
import { fr } from './text-presets.fr.ts';
import { de } from './text-presets.de.ts';
import { nl } from './text-presets.nl.ts';
import { ptBR } from './text-presets.pt-BR.ts';
import { it } from './text-presets.it.ts';
import { ru } from './text-presets.ru.ts';
import { pl } from './text-presets.pl.ts';
import { tr } from './text-presets.tr.ts';
import { vi } from './text-presets.vi.ts';

export { TEXT_PRESETS, type TextPreset, type TextPresetLayer };

/** Copy for the text panel (English is the source of the keys and types; translations are in `text-presets.<语言>.ts`). Sample characters in the presets are not translated; see text-preset-data.ts. */
const en = {
  catAll: 'All',
  catSimple: 'Simple',
  catTitle: 'Title',
  catLower: 'Lower third',
  catOther: 'Other',
  /** Placeholder text created by “Add text box”. */
  blankText: 'Type your text',
};
export type TextPresetsMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/** Categories of the text panel (prototype: All / Simple / Title / Lower third / Other). */
export const TEXT_CATEGORIES = [
  {
    key: 'all',
    get label() {
      return M.catAll;
    },
  },
  {
    key: 'simple',
    get label() {
      return M.catSimple;
    },
  },
  {
    key: 'title',
    get label() {
      return M.catTitle;
    },
  },
  {
    key: 'lower',
    get label() {
      return M.catLower;
    },
  },
  {
    key: 'other',
    get label() {
      return M.catOther;
    },
  },
] as const;
export type TextCategory = (typeof TEXT_CATEGORIES)[number]['key'];

/** In the “All” tier, each section shows only its first few cells; more go to “View all”. */
export const PEEK = 6;

export function presetsOf(category: Exclude<TextCategory, 'all'>): TextPreset[] {
  return TEXT_PRESETS.filter((preset) => preset.category === category);
}

/**
 * How large a box a laid-out piece of text needs (sequence pixels, including the backing padding): if `wrapWidth` is given, the text wraps to it; otherwise it does not wrap.
 * The UI measures it with a canvas; this layer does not touch the DOM.
 */
export type MeasureText = (text: string, style: Record<string, unknown>, wrapWidth: number | null) => { width: number; height: number };

/** “Add text box”: white-on-black title style (legacy `TEXT_TITLE`), 10 seconds at the playhead, placed slightly above the frame's vertical center. */
export const BLANK_TEXT_SECONDS = 10;
export const BLANK_TEXT = {
  get text() {
    return M.blankText;
  },
  style: {
    fontSize: 24,
    fontWeight: 'bold',
    fontColor: '#FFFFFF',
    lineHeight: 1.2,
    textAlign: 'center',
    backgroundColor: '#000000CC',
    backgroundStyle: 'wrap',
    backgroundPadding: 14,
    borderRadius: 12,
  },
};

/**
 * The `place` of one layer of a preset: for shapes, by `w` (the height is written in the shape's `h`); for text, if `w` is given the text wraps to its width, and if not, the box width is the measured text width
 * (in the element model the text box width is the wrap width, and the height is derived from the kind, so the measured height is no longer recorded).
 */
export function presetLayerBox(layer: TextPresetLayer, canvas: { width: number; height: number }, measure: MeasureText): Place {
  const { x, y, w, rot } = layer.place;
  if (layer.kind === 'shape') return placeBox({ x, y, w: w ?? 20, ...(rot === undefined ? {} : { rot }) });
  const width = w ?? (measure(layer.text ?? '', layer.style ?? {}, null).width / canvas.width) * 100;
  return placeBox({ x, y, w: width, ...(rot === undefined ? {} : { rot }) });
}

/** One preset → the several layers it creates (lower layers first); each layer is staggered by its own `delay`. */
export function presetLayers(
  preset: TextPreset,
  canvas: { width: number; height: number },
  fps: Rate,
  measure: MeasureText,
): VisualLayer[] {
  return preset.layers.map((layer): VisualLayer => {
    const place = presetLayerBox(layer, canvas, measure);
    const delayFrames = Math.round(((layer.delay ?? 0) * fps.num) / fps.den);
    const timing = delayFrames > 0 ? { delayFrames } : {};
    if (layer.kind === 'shape') {
      const shape: ShapeProps = { shape: 'rect', ...layer.shape, ...(layer.h === undefined ? {} : { h: layer.h }) };
      return { type: 'shape', place, shape, ...timing };
    }
    return { type: 'text', place, text: layer.text ?? '', style: layer.style ?? {}, ...timing };
  });
}

/** Which layer is selected after creation: the first text layer (legacy `preferred_member`), or the first layer if there is no text. */
export function preferredLayer(preset: TextPreset): number {
  return Math.max(
    0,
    preset.layers.findIndex((layer) => layer.kind === 'text'),
  );
}

/** The layer created by “Add text box”. */
export function blankTextLayer(canvas: { width: number; height: number }, measure: MeasureText): VisualLayer {
  const size = measure(BLANK_TEXT.text, BLANK_TEXT.style, null);
  const place = placeBox({ x: 50, y: 40, w: (size.width / canvas.width) * 100 });
  return { type: 'text', place, text: BLANK_TEXT.text, style: { ...BLANK_TEXT.style } };
}
