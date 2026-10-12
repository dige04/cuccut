import { defineMessages, intlLocale } from '@cuccut/protocol';
import { zhHans } from './slides-copy.zh-Hans.ts';
import { zhHant } from './slides-copy.zh-Hant.ts';
import { ja } from './slides-copy.ja.ts';
import { ko } from './slides-copy.ko.ts';
import { es } from './slides-copy.es.ts';
import { fr } from './slides-copy.fr.ts';
import { de } from './slides-copy.de.ts';
import { nl } from './slides-copy.nl.ts';
import { ptBR } from './slides-copy.pt-BR.ts';
import { it } from './slides-copy.it.ts';
import { ru } from './slides-copy.ru.ts';
import { pl } from './slides-copy.pl.ts';
import { tr } from './slides-copy.tr.ts';
import { vi } from './slides-copy.vi.ts';

const list = (labels: readonly string[]) => new Intl.ListFormat(intlLocale('en'), { type: 'conjunction' }).format(labels);

/**
 * 幻灯片的界面文案（docs/design/slides §8）：功能区的幻灯片标签、线程里的幻灯片卡片、文件标签与 Space 里的打开入口。
 * 一份幻灯片在界面上只叫幻灯片（Slides），不写 Deck、Presentation（docs/glossary.md）。
 */
const en = {
  /** 页数：标签头、线程卡片与 Space 的「时长或尺寸」一列。 */
  pages: (n: number) => (n === 1 ? '1 slide' : `${n} slides`),
  paneLabel: (name: string) => `Slides “${name}”`,
  /** 编辑器 iframe 的读屏名称。 */
  frameTitle: (name: string) => `Slides editor: ${name}`,
  opening: 'Opening slides…',
  /** 这台机器没有构建编辑器（`slides.open` 的 `editorAvailable` 为 false）。 */
  unavailableTitle: 'Slides editor unavailable',
  unavailableBody: 'This build of CucCut doesn’t include the slides editor. The slide files are still in their folder.',
  openFailed: (reason: string) => `Couldn’t open the slides: ${reason}`,
  /** Space 的条目菜单与查看框里的按钮。 */
  open: 'Open slides',
  openCard: (name: string) => `Open slides “${name}”`,
  /** 文件标签里打开 `deck.json` 时，头部的动作。 */
  openInEditor: 'Open in Slides Editor',

  // 标注（§8.2）
  /** 幻灯片标签头部的标注开关。 */
  annotate: 'Annotate',
  /** 批注框：输入框的读屏名称与占位、两个按钮。 */
  noteLabel: 'Annotation',
  notePlaceholder: 'What should change?',
  addToChat: 'Add to chat',
  cancel: 'Cancel',
  /** composer 上方与已发送消息里的那一行。 */
  token: (n: number) => (n === 1 ? 'Slide annotations · 1' : `Slide annotations · ${n}`),
  added: (token: string) => `Added to chat · ${token}`,
  removeAll: 'Remove all slide annotations',
  removeOne: (n: number) => `Remove annotation ${n}`,
  /** 列表里一条的读屏名称。 */
  item: (n: number, label: string, text: string) => `Annotation ${n}, ${label}: ${text}`,
  empty: 'Write an annotation first, then add it to the chat',
  tooLong: (max: number) => `An annotation can be at most ${max} characters`,
  tooMany: (max: number) => `A message can carry at most ${max} slide annotations. Send these first.`,
  /** 幻灯片标签所在的位置还没有会话。 */
  noConversation: 'This tab isn’t part of a session yet. Send a message to start one, then add annotations.',
  /** 只带标注、没写话时发给智能体的那句。 */
  message: 'Please revise the slides according to these annotations.',
  /** 发送前编辑器里有改动没保存成（产品设计 §3.2.4 写出具体对象）：`names` 是这几份幻灯片的名字。 */
  flushFailed: (names: readonly string[]) =>
    `Changes to the slides ${list(names.map((n) => `“${n}”`))} haven’t finished saving, so the message wasn’t sent. Try again, or remove the slide annotations first.`,
};
export type SlidesMessages = typeof en;
export const SLIDES = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
