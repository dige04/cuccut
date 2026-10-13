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
 * UI copy for design drafts (docs/design/canvas §8): the design tab in the feature area, the design card in the thread, the file tab and the open entry in Space.
 * In the UI a design draft is called 设计稿 (Design). Do not write Canvas or Mockup. The artboard is called 画板 (Artboard), not Frame or Board (docs/glossary.md).
 * Key names align with the `SLIDES` of slides (the editor tab `EditorPane` shares one set).
 */
const en = {
  /** Artboard count: the “时长或尺寸” (duration or size) column in the tab header, thread card and Space. */
  boards: (n: number) => (n === 1 ? '1 artboard' : `${n} artboards`),
  paneLabel: (name: string) => `Design “${name}”`,
  /** Screen-reader name of the editor iframe. */
  frameTitle: (name: string) => `Design editor: ${name}`,
  opening: 'Opening design…',
  /** This machine has no built editor (`editorAvailable` from `design.open` is false). */
  unavailableTitle: 'Design editor unavailable',
  unavailableBody: 'This build of CucCut doesn’t include the design editor. The design files are still in their folder.',
  /** On the web, the page is not on 127.0.0.1 or localhost, so there is no other loopback hostname to switch to (§6.2). */
  hostBlockedTitle: 'Design editor unavailable at this address',
  hostBlockedBody: 'Open CucCut Web at 127.0.0.1 or localhost to edit designs. The design files are still in their folder.',
  openFailed: (reason: string) => `Couldn’t open the design: ${reason}`,
  /** Buttons in the Space item menu and the viewer box. */
  open: 'Open design',
  openCard: (name: string) => `Open design “${name}”`,
  /** Header actions when `canvas.json` is opened in the file tab. */
  openInEditor: 'Open in Design Editor',

  // Annotations (§8.2)
  /** Annotation toggle in the design tab header. */
  annotate: 'Annotate',
  /** Comment box: screen-reader name and placeholder of the input, and the two buttons. */
  noteLabel: 'Annotation',
  notePlaceholder: 'What should change?',
  addToChat: 'Add to chat',
  cancel: 'Cancel',
  /** The row above the composer and in sent messages. */
  token: (n: number) => (n === 1 ? 'Design annotations · 1' : `Design annotations · ${n}`),
  added: (token: string) => `Added to chat · ${token}`,
  removeAll: 'Remove all design annotations',
  removeOne: (n: number) => `Remove annotation ${n}`,
  /** Screen-reader name of one item in the list. */
  item: (n: number, label: string, text: string) => `Annotation ${n}, ${label}: ${text}`,
  empty: 'Write an annotation first, then add it to the chat',
  tooLong: (max: number) => `An annotation can be at most ${max} characters`,
  tooMany: (max: number) => `A message can carry at most ${max} design annotations. Send these first.`,
  /** There is no session yet at the location of the design tab. */
  noConversation: 'This tab isn’t part of a session yet. Send a message to start one, then add annotations.',
  /** The sentence sent to the agent when there are only annotations and no message written. */
  message: 'Please revise the design according to these annotations.',
  /** Before sending, the editor has unsaved changes (product design §3.2.4 names the specific objects): `names` are the names of these design drafts. */
  flushFailed: (names: readonly string[]) =>
    `Changes to ${names.length === 1 ? 'the design' : 'the designs'} ${list(names.map((n) => `“${n}”`))} haven’t finished saving, so the message wasn’t sent. Try again, or remove the design annotations first.`,

  // Export (§8.3)
  /** Export menu in the design tab header and its three formats. With several artboards, the editor asks the user to pick one. */
  exportMenu: 'Export',
  exportHtml: 'HTML (single file)',
  exportPdf: 'PDF',
  exportPng: 'PNG image',
  /** Title and buttons of the desktop save dialog. */
  exportDialogTitle: 'Export design',
  exportDialogButton: 'Export',
  /** Saved on desktop. On the web the browser downloads it, with no extra notice. */
  exportSaved: (path: string) => `Saved to ${path}`,
  exportFailed: (reason: string) => `Couldn’t save the exported file: ${reason}`,
  /** The file type the editor wants to save is not in the allowed range. */
  exportUnsupported: (name: string) => `CucCut can’t save “${name}”: this file type isn’t supported`,
};
export type DesignMessages = typeof en;
export const DESIGN = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
