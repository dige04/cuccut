import { defineMessages, intlLocale } from '@cuccut/protocol';
import { zhHans } from './design-copy.zh-Hans.ts';
import { zhHant } from './design-copy.zh-Hant.ts';
import { ja } from './design-copy.ja.ts';
import { ko } from './design-copy.ko.ts';
import { es } from './design-copy.es.ts';
import { fr } from './design-copy.fr.ts';
import { de } from './design-copy.de.ts';
import { nl } from './design-copy.nl.ts';
import { ptBR } from './design-copy.pt-BR.ts';
import { it } from './design-copy.it.ts';
import { ru } from './design-copy.ru.ts';
import { pl } from './design-copy.pl.ts';
import { tr } from './design-copy.tr.ts';
import { vi } from './design-copy.vi.ts';

const list = (labels: readonly string[]) => new Intl.ListFormat(intlLocale('en'), { type: 'conjunction' }).format(labels);

/**
 * 设计稿的界面文案（docs/design/canvas §8）：功能区的设计稿标签、线程里的设计稿卡片、文件标签与 Space 里的打开入口。
 * 一份设计稿在界面上叫设计稿（Design），不写 Canvas、Mockup；画板叫 Artboard，不写 Frame、Board（docs/glossary.md）。
 * 键名与幻灯片的 `SLIDES` 对齐（编辑器标签 `EditorPane` 共用一套）。
 */
const en = {
  /** 画板数：标签头、线程卡片与 Space 的「时长或尺寸」一列。 */
  boards: (n: number) => (n === 1 ? '1 artboard' : `${n} artboards`),
  paneLabel: (name: string) => `Design “${name}”`,
  /** 编辑器 iframe 的读屏名称。 */
  frameTitle: (name: string) => `Design editor: ${name}`,
  opening: 'Opening design…',
  /** 这台机器没有构建编辑器（`design.open` 的 `editorAvailable` 为 false）。 */
  unavailableTitle: 'Design editor unavailable',
  unavailableBody: 'This build of CucCut doesn’t include the design editor. The design files are still in their folder.',
  /** Web 端的页面不在 127.0.0.1 或 localhost 上，换不到另一个回环主机名（§6.2）。 */
  hostBlockedTitle: 'Design editor unavailable at this address',
  hostBlockedBody: 'Open CucCut Web at 127.0.0.1 or localhost to edit designs. The design files are still in their folder.',
  openFailed: (reason: string) => `Couldn’t open the design: ${reason}`,
  /** Space 的条目菜单与查看框里的按钮。 */
  open: 'Open design',
  openCard: (name: string) => `Open design “${name}”`,
  /** 文件标签里打开 `canvas.json` 时，头部的动作。 */
  openInEditor: 'Open in Design Editor',

  // 标注（§8.2）
  /** 设计稿标签头部的标注开关。 */
  annotate: 'Annotate',
  /** 批注框：输入框的读屏名称与占位、两个按钮。 */
  noteLabel: 'Annotation',
  notePlaceholder: 'What should change?',
  addToChat: 'Add to chat',
  cancel: 'Cancel',
  /** composer 上方与已发送消息里的那一行。 */
  token: (n: number) => (n === 1 ? 'Design annotations · 1' : `Design annotations · ${n}`),
  added: (token: string) => `Added to chat · ${token}`,
  removeAll: 'Remove all design annotations',
  removeOne: (n: number) => `Remove annotation ${n}`,
  /** 列表里一条的读屏名称。 */
  item: (n: number, label: string, text: string) => `Annotation ${n}, ${label}: ${text}`,
  empty: 'Write an annotation first, then add it to the chat',
  tooLong: (max: number) => `An annotation can be at most ${max} characters`,
  tooMany: (max: number) => `A message can carry at most ${max} design annotations. Send these first.`,
  /** 设计稿标签所在的位置还没有会话。 */
  noConversation: 'This tab isn’t part of a session yet. Send a message to start one, then add annotations.',
  /** 只带标注、没写话时发给智能体的那句。 */
  message: 'Please revise the design according to these annotations.',
  /** 发送前编辑器里有改动没保存成（产品设计 §3.2.4 写出具体对象）：`names` 是这几份设计稿的名字。 */
  flushFailed: (names: readonly string[]) =>
    `Changes to ${names.length === 1 ? 'the design' : 'the designs'} ${list(names.map((n) => `“${n}”`))} haven’t finished saving, so the message wasn’t sent. Try again, or remove the design annotations first.`,

  // 导出（§8.3）
  /** 设计稿标签头部的导出菜单与三种格式。多个画板时编辑器里会再让人挑画板。 */
  exportMenu: 'Export',
  exportHtml: 'HTML (single file)',
  exportPdf: 'PDF',
  exportPng: 'PNG image',
  /** 桌面端存储对话框的标题与按钮。 */
  exportDialogTitle: 'Export design',
  exportDialogButton: 'Export',
  /** 桌面端存好了；Web 交给浏览器下载，不另外提示。 */
  exportSaved: (path: string) => `Saved to ${path}`,
  exportFailed: (reason: string) => `Couldn’t save the exported file: ${reason}`,
  /** 编辑器要存的文件类型不在允许的范围里。 */
  exportUnsupported: (name: string) => `CucCut can’t save “${name}”: this file type isn’t supported`,
};
export type DesignMessages = typeof en;
export const DESIGN = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
