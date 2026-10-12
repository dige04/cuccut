/**
 * 标注位置标签里的词（docs/design/slides §8.2）：运行时拼 `label` 时向宿主要（`slidesHost.commentLabels`），跟随 CucCut 的界面语言。
 * `label` 给人看（批注框、输入框上的标注、发出的消息），`detail` 给智能体定位，保持运行时的英文，不经这里。
 *
 * 键对应运行时里的闭集：文字角色（model/deck.ts 的 textRoleLabels）、节点种类、形状变体（shapeVariantLabels）、
 * 区域方位（comments/area-geometry.ts 的 describeCommentBoxPart，用它返回的英文短语当键）。英文与运行时原文逐字一致，
 * 所以界面是英文时标签不变；表里没有的键运行时自己用英文。
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
  /** 标签开头的页号。 */
  slide: (n: number) => `Slide ${n}`,
  /** 文字角色。只在文字没套用幻灯片或设计系统自己命名的样式时用。 */
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
  /** 其他节点的种类。 */
  elements: {
    img: 'Image',
    icon: 'Icon',
    stack: 'Group',
    grid: 'Grid',
    overlay: 'Overlay',
    html: 'Web embed',
    spacer: 'Spacer',
  } as Readonly<Record<string, string>>,
  /** 形状按变体。 */
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
  /** 框选区域在元素或页面里的方位：键是运行时的英文短语，值含前面的空格与括号。 */
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
  /** 框选区域还盖住了几个元素，含前面的分隔符。 */
  covered: (n: number) => (n === 1 ? ' · 1 element' : ` · ${n} elements`),
};

export type CommentLabelMessages = typeof en;

const LABELS = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/** 从编辑器地址的查询参数取界面语言；没带或认不出时是 null（标签保持英文）。 */
export function localeFromSearch(search: string): Locale | null {
  const tag = new URLSearchParams(search).get(EDITOR_LOCALE_PARAM);
  return tag ? localeOfTag(tag) : null;
}

/** 按界面语言给运行时的标签词；`locale` 为 null 时用英文。页面里只有一个编辑器，直接设整页的当前语言。 */
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
