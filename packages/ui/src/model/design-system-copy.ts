import { defineMessages, intlLocale } from '@cuccut/protocol';
import { zhHans } from './design-system-copy.zh-Hans.ts';
import { zhHant } from './design-system-copy.zh-Hant.ts';
import { ja } from './design-system-copy.ja.ts';
import { ko } from './design-system-copy.ko.ts';
import { es } from './design-system-copy.es.ts';
import { fr } from './design-system-copy.fr.ts';
import { de } from './design-system-copy.de.ts';
import { nl } from './design-system-copy.nl.ts';
import { ptBR } from './design-system-copy.pt-BR.ts';
import { it } from './design-system-copy.it.ts';
import { ru } from './design-system-copy.ru.ts';
import { pl } from './design-system-copy.pl.ts';
import { tr } from './design-system-copy.tr.ts';
import { vi } from './design-system-copy.vi.ts';

const list = (labels: readonly string[]) => new Intl.ListFormat(intlLocale('en'), { type: 'conjunction' }).format(labels);

/**
 * 设计系统的界面文案（docs/design/canvas §10.6）：功能区的设计系统标签、文件标签与 Space 里的打开入口。
 * 界面上叫设计系统（Design system），不写 Style guide、UI kit（docs/glossary.md）。
 * 标签与标注的键名与设计稿的 `DESIGN` 对齐（编辑器标签 `EditorPane` 共用一套）；`where` 是设计系统另有的：位置标签前加上是哪套设计系统。
 */
const en = {
  paneLabel: (name: string) => `Design system “${name}”`,
  /** 编辑器 iframe 的读屏名称。 */
  frameTitle: (name: string) => `Design system editor: ${name}`,
  opening: 'Opening design system…',
  /** 这台机器没有构建编辑器（`designSystem.open` 的 `editorAvailable` 为 false）。 */
  unavailableTitle: 'Design system editor unavailable',
  unavailableBody: 'This build of CucCut doesn’t include the design system editor. The design system files are still in their folder.',
  /** Web 端的页面不在 127.0.0.1 或 localhost 上，换不到另一个回环主机名（§10.4）。 */
  hostBlockedTitle: 'Design system editor unavailable at this address',
  hostBlockedBody: 'Open CucCut Web at 127.0.0.1 or localhost to edit design systems. The design system files are still in their folder.',
  openFailed: (reason: string) => `Couldn’t open the design system: ${reason}`,
  /** Space 的条目菜单与查看框里的按钮。 */
  open: 'Open design system',
  /** 文件标签里打开 `design-system.json` 时，头部的动作。 */
  openInEditor: 'Open in Design System Editor',
  // 标注（§10.6）
  /** 设计系统标签头部的标注开关。 */
  annotate: 'Annotate',
  /** 批注框：输入框的读屏名称与占位、两个按钮。 */
  noteLabel: 'Annotation',
  notePlaceholder: 'What should change?',
  addToChat: 'Add to chat',
  cancel: 'Cancel',
  /** 位置标签前面加上是哪套设计系统（编辑器给的是「章节 › 种类 “名字”」）。 */
  where: (name: string, label: string) => `Design system “${name}” › ${label}`,
  /** composer 上方与已发送消息里的那一行。 */
  token: (n: number) => (n === 1 ? 'Design system annotations · 1' : `Design system annotations · ${n}`),
  added: (token: string) => `Added to chat · ${token}`,
  removeAll: 'Remove all design system annotations',
  removeOne: (n: number) => `Remove annotation ${n}`,
  /** 列表里一条的读屏名称。 */
  item: (n: number, label: string, text: string) => `Annotation ${n}, ${label}: ${text}`,
  empty: 'Write an annotation first, then add it to the chat',
  tooLong: (max: number) => `An annotation can be at most ${max} characters`,
  tooMany: (max: number) => `A message can carry at most ${max} design system annotations. Send these first.`,
  /** 设计系统标签所在的位置还没有会话。 */
  noConversation: 'This tab isn’t part of a session yet. Send a message to start one, then add annotations.',
  /** 只带标注、没写话时发给智能体的那句。 */
  message: 'Please revise the design system according to these annotations.',
  /** 发送前编辑器里有改动没保存成（产品设计 §3.2.4 写出具体对象）：`names` 是这几套设计系统的名字。 */
  flushFailed: (names: readonly string[]) =>
    `Changes to ${names.length === 1 ? 'the design system' : 'the design systems'} ${list(names.map((n) => `“${n}”`))} haven’t finished saving, so the message wasn’t sent. Try again, or remove the design system annotations first.`,
};
export type DesignSystemMessages = typeof en;
export const DESIGN_SYSTEM = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
