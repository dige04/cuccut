/**
 * 设计系统标注位置标签里的词（docs/design/canvas §10.6），跟随 CucCut 的界面语言（编辑器地址上的 `?lang=`）。
 * `label` 给人看（批注框、输入框上的标注、发出的消息），`detail` 给智能体定位，保持英文，不经这里（comment-targets.ts）。
 *
 * 键是设计系统运行时标目标用的前缀（editor/comment-anchors.ts 的 `commentTargetProps(prefix, name)` / `commentTargetId`）：
 * token、颜色组、文字样式组与文字样式、字体、样式设置与样式编辑、取色器、组件与它的属性、素材组与素材、文档、对话框、
 * 素材预览、用法说明、章节标题；`ds` 前缀是整套设计系统的几处（封面、字体文件），按名字取 `specials`。表里没有的前缀写 `element`。
 */
import { DEFAULT_LOCALE, defineMessages, setLocale, type Locale } from '@cuccut/protocol/i18n';
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
  /** 目标的种类，按前缀。 */
  kinds: {
    token: 'Token',
    cgroup: 'Color group',
    tset: 'Type set',
    style: 'Text style',
    font: 'Font',
    knob: 'Style setting',
    editor: 'Style editor',
    picker: 'Color picker',
    prop: 'Prop',
    props: 'Props',
    cell: 'Color value',
    agroup: 'Asset group',
    asset: 'Asset',
    comp: 'Component',
    doc: 'Document',
    dialog: 'Dialog',
    lightbox: 'Asset preview',
    note: 'Usage note',
    page: 'Section title',
  } as Readonly<Record<string, string>>,
  /** `ds` 前缀的几处，按名字。 */
  specials: {
    cover: 'Cover',
    'font-files': 'Font files',
  } as Readonly<Record<string, string>>,
  /** 前缀认不出时。 */
  element: 'Element',
  /** 标签里引用目标的名字。 */
  quote: (name: string) => `“${name}”`,
};

export type CommentLabelMessages = typeof en;

const LABELS = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/** 标注层拼 `label` 时用的词。 */
export interface DesignSystemCommentLabels {
  /** 这个前缀的种类；认不出时是 `element`。 */
  kind(prefix: string): string;
  /** `ds` 前缀的一处；认不出时 undefined。 */
  special(name: string): string | undefined;
  quote(name: string): string;
}

/** 按界面语言给词；`locale` 为 null 时用英文。页面里只有一个编辑器，直接设整页的当前语言（同幻灯片的 comment-labels.ts）。 */
export function createCommentLabels(locale: Locale | null): DesignSystemCommentLabels {
  setLocale(locale ?? DEFAULT_LOCALE);
  return {
    kind: prefix => (Object.hasOwn(LABELS.kinds, prefix) ? LABELS.kinds[prefix]! : LABELS.element),
    special: name => (Object.hasOwn(LABELS.specials, name) ? LABELS.specials[name] : undefined),
    quote: name => LABELS.quote(name),
  };
}
