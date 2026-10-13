/**
 * Words in annotation position labels (docs/design/slides §8.2). When the runtime builds `label`, it asks the host for them (`slidesHost.commentLabels`), following CucCut's UI language.
 * `label` is for people (the comment box, the annotation on the input box, sent messages); `detail` is for the agent to locate, stays in the runtime's English, and does not go through here.
 *
 * The keys correspond to closed sets in the runtime: text roles (textRoleLabels in model/deck.ts), node kinds, shape variants (shapeVariantLabels), and region positions (describeCommentBoxPart in comments/area-geometry.ts, using the English phrase it returns as the key). The English matches the runtime's original text word for word, so the labels are unchanged when the UI is in English. Keys not in the table are shown in English by the runtime itself.
 */
import { DEFAULT_LOCALE, defineMessages, localeOfTag, setLocale, type Locale } from '@cuccut/protocol/i18n';
import { EDITOR_LOCALE_PARAM } from '../editor-messages.ts';
import type { HostCommentLabels } from './slides-host.ts';
import { zhHans } from './comment-labels.zh-Hans.ts';
import { zhHant } from './comment-labels.zh-Hant.ts';
import { ja } from './comment-labels.ja.ts';
import { ko } from './comment-labels.ko.ts';
import { es } from './comment-labels.es.ts';
import { fr } from './comment-labels.fr.ts';
import { de } from './comment-labels.de.ts';
import { nl } from './comment-labels.nl.ts';
import { ptBR } from './comment-labels.pt-BR.ts';
import { it } from './comment-labels.it.ts';
import { ru } from './comment-labels.ru.ts';
import { pl } from './comment-labels.pl.ts';
import { tr } from './comment-labels.tr.ts';
import { vi } from './comment-labels.vi.ts';

const en = {
  /** The page number at the start of a label. */
  slide: (n: number) => `Slide ${n}`,
  /** Text role. Only used when the text does not apply a style that a slide or design system names itself. */
  textRoles: {
    display: 'Display',
    h1: 'Heading 1',
    h2: 'Heading 2',
    h3: 'Heading 3',
    lead: 'Lead',
    eyebrow: 'Eyebrow',
    body: 'Body',
    caption: 'Caption',
  } as Readonly<Record<string, string>>,
  /** Kinds of other nodes. */
  elements: {
    img: 'Image',
    icon: 'Icon',
    stack: 'Group',
    grid: 'Grid',
    overlay: 'Overlay',
    html: 'Web embed',
    spacer: 'Spacer',
  } as Readonly<Record<string, string>>,
  /** Shapes, by variant. */
  shapes: {
    rect: 'Rectangle',
    rounded: 'Rounded rectangle',
    ellipse: 'Ellipse',
    diamond: 'Diamond (decision)',
    'arrow-right': 'Arrow right',
    'arrow-left': 'Arrow left',
    'arrow-up': 'Arrow up',
    'arrow-down': 'Arrow down',
    line: 'Line',
    connector: 'Connector',
  } as Readonly<Record<string, string>>,
  table: (rows: number, cols: number) => `Table ${rows}×${cols}`,
  /** Position of a box-selected region within an element or the page. Keys are the runtime's English phrases; values include the leading space and the parentheses. */
  areaParts: {
    'left edge': ' (left edge)',
    'right edge': ' (right edge)',
    'top edge': ' (top edge)',
    'bottom edge': ' (bottom edge)',
    'top half': ' (top half)',
    'bottom half': ' (bottom half)',
    'left side': ' (left side)',
    'right side': ' (right side)',
    'top left': ' (top left)',
    'top centre': ' (top centre)',
    'top right': ' (top right)',
    'middle left': ' (middle left)',
    'middle centre': ' (middle centre)',
    'middle right': ' (middle right)',
    'bottom left': ' (bottom left)',
    'bottom centre': ' (bottom centre)',
    'bottom right': ' (bottom right)',
    middle: ' (middle)',
    centre: ' (centre)',
    part: ' (part)',
  } as Readonly<Record<string, string>>,
  /** How many other elements the box-selected region also covers, including the leading separator. */
  covered: (n: number) => (n === 1 ? ' · 1 element' : ` · ${n} elements`),
};

export type CommentLabelMessages = typeof en;

const LABELS = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/** Reads the UI language from the editor address's query parameter; null when it is absent or not recognized (labels stay in English). */
export function localeFromSearch(search: string): Locale | null {
  const tag = new URLSearchParams(search).get(EDITOR_LOCALE_PARAM);
  return tag ? localeOfTag(tag) : null;
}

/** Gives the runtime's label words in the UI language; English is used when `locale` is null. There is only one editor on the page, so it sets the current language for the whole page directly. */
export function createCommentLabels(locale: Locale | null): HostCommentLabels {
  setLocale(locale ?? DEFAULT_LOCALE);
  return {
    slide: n => LABELS.slide(n),
    textRole: role => LABELS.textRoles[role],
    element: node => {
      if (node.kind === 'shape') return node.shape === undefined ? undefined : LABELS.shapes[node.shape];
      if (node.kind === 'table') return node.rows === undefined || node.cols === undefined ? undefined : LABELS.table(node.rows, node.cols);
      return LABELS.elements[node.kind];
    },
    areaPart: part => LABELS.areaParts[part],
    covered: n => LABELS.covered(n),
  };
}
