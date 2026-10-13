/**
 * Words in the design system's annotation position labels (docs/design/canvas §10.6), following CucCut's UI language (the `?lang=` on the editor address).
 * `label` is for people (comment boxes, annotations on input fields, sent messages); `detail` is for the agent to locate, stays in English, and does not go through here (comment-targets.ts).
 *
 * The keys are the prefixes the design system runtime uses when marking targets (`commentTargetProps(prefix, name)` / `commentTargetId` in editor/comment-anchors.ts):
 * token, color group, text style group and text styles, fonts, style settings and style editing, color picker, components and their properties, asset groups and assets, documents, dialogs,
 * asset preview, usage notes, section titles. The `ds` prefix covers a few places in the whole design system (cover, font files), looked up by name in `specials`. Prefixes not in the table are written as `element`.
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
  /** Kind of target, by prefix. */
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
  /** The few places under the `ds` prefix, by name. */
  specials: {
    cover: 'Cover',
    'font-files': 'Font files',
  } as Readonly<Record<string, string>>,
  /** When the prefix is not recognized. */
  element: 'Element',
  /** The name of the target, referenced in the label. */
  quote: (name: string) => `“${name}”`,
};

export type CommentLabelMessages = typeof en;

const LABELS = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/** Words used by the annotation layer when assembling `label`. */
export interface DesignSystemCommentLabels {
  /** The kind for this prefix; `element` when not recognized. */
  kind(prefix: string): string;
  /** One of the places under the `ds` prefix; undefined when not recognized. */
  special(name: string): string | undefined;
  quote(name: string): string;
}

/** Gives the words in the UI language; `locale` null means English. There is only one editor on the page, so set the current language of the whole page directly (same as comment-labels.ts for slides). */
export function createCommentLabels(locale: Locale | null): DesignSystemCommentLabels {
  setLocale(locale ?? DEFAULT_LOCALE);
  return {
    kind: prefix => (Object.hasOwn(LABELS.kinds, prefix) ? LABELS.kinds[prefix]! : LABELS.element),
    special: name => (Object.hasOwn(LABELS.specials, name) ? LABELS.specials[name] : undefined),
    quote: name => LABELS.quote(name),
  };
}
