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
 * UI copy for design systems (docs/design/canvas §10.6): the design-system tab in the feature area, the file tab and the open entry in Space.
 * The UI calls it 设计系统 (Design system). Do not write Style guide or UI kit (docs/glossary.md).
 * The tab and annotation key names align with the `DESIGN` of design drafts (the editor tab `EditorPane` shares one set). `where` is specific to design systems: it adds which design system it is in front of the location label.
 */
const en = {
  paneLabel: (name: string) => `Design system “${name}”`,
  /** Screen-reader name of the editor iframe. */
  frameTitle: (name: string) => `Design system editor: ${name}`,
  opening: 'Opening design system…',
  /** This machine has no built editor (`editorAvailable` from `designSystem.open` is false). */
  unavailableTitle: 'Design system editor unavailable',
  unavailableBody: 'This build of CucCut doesn’t include the design system editor. The design system files are still in their folder.',
  /** On the web, the page is not on 127.0.0.1 or localhost, so there is no other loopback hostname to switch to (§10.4). */
  hostBlockedTitle: 'Design system editor unavailable at this address',
  hostBlockedBody: 'Open CucCut Web at 127.0.0.1 or localhost to edit design systems. The design system files are still in their folder.',
  openFailed: (reason: string) => `Couldn’t open the design system: ${reason}`,
  /** Buttons in the Space item menu and the viewer box. */
  open: 'Open design system',
  /** Header actions when `design-system.json` is opened in the file tab. */
  openInEditor: 'Open in Design System Editor',
  // Annotations (§10.6)
  /** Annotation toggle in the design-system tab header. */
  annotate: 'Annotate',
  /** Comment box: screen-reader name and placeholder of the input, and the two buttons. */
  noteLabel: 'Annotation',
  notePlaceholder: 'What should change?',
  addToChat: 'Add to chat',
  cancel: 'Cancel',
  /** Put which design system it is in front of the location label (the editor gives “章节 › 种类 “名字”” (section › kind “name”)). */
  where: (name: string, label: string) => `Design system “${name}” › ${label}`,
  /** The row above the composer and in sent messages. */
  token: (n: number) => (n === 1 ? 'Design system annotations · 1' : `Design system annotations · ${n}`),
  added: (token: string) => `Added to chat · ${token}`,
  removeAll: 'Remove all design system annotations',
  removeOne: (n: number) => `Remove annotation ${n}`,
  /** Screen-reader name of one item in the list. */
  item: (n: number, label: string, text: string) => `Annotation ${n}, ${label}: ${text}`,
  empty: 'Write an annotation first, then add it to the chat',
  tooLong: (max: number) => `An annotation can be at most ${max} characters`,
  tooMany: (max: number) => `A message can carry at most ${max} design system annotations. Send these first.`,
  /** There is no session yet at the location of the design-system tab. */
  noConversation: 'This tab isn’t part of a session yet. Send a message to start one, then add annotations.',
  /** The sentence sent to the agent when there are only annotations and no message written. */
  message: 'Please revise the design system according to these annotations.',
  /** Before sending, the editor has unsaved changes (product design §3.2.4 names the specific objects): `names` are the names of these design systems. */
  flushFailed: (names: readonly string[]) =>
    `Changes to ${names.length === 1 ? 'the design system' : 'the design systems'} ${list(names.map((n) => `“${n}”`))} haven’t finished saving, so the message wasn’t sent. Try again, or remove the design system annotations first.`,
};
export type DesignSystemMessages = typeof en;
export const DESIGN_SYSTEM = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
