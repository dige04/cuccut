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
 * UI copy for slides (docs/design/slides §8): the slide tag in the feature bar, slide cards in the thread, the file tab, and the open entry in Space.
 * On screen a slide is only called Slides; the terms Deck and Presentation are not used (docs/glossary.md).
 */
const en = {
  /** Page count: in the tag header, the slide card in the thread, and the “duration or size” column in Space. */
  pages: (n: number) => (n === 1 ? '1 slide' : `${n} slides`),
  paneLabel: (name: string) => `Slides “${name}”`,
  /** Screen-reader name for the editor iframe. */
  frameTitle: (name: string) => `Slides editor: ${name}`,
  opening: 'Opening slides…',
  /** This machine has no editor build (`editorAvailable` from `slides.open` is false). */
  unavailableTitle: 'Slides editor unavailable',
  unavailableBody: 'This build of CucCut doesn’t include the slides editor. The slide files are still in their folder.',
  openFailed: (reason: string) => `Couldn’t open the slides: ${reason}`,
  /** Buttons in the Space item menu and the view box. */
  open: 'Open slides',
  openCard: (name: string) => `Open slides “${name}”`,
  /** Header actions when `deck.json` is opened in a file tab. */
  openInEditor: 'Open in Slides Editor',

  // Annotations (§8.2)
  /** The annotation toggle in the slide tag header. */
  annotate: 'Annotate',
  /** Annotation box: the input's screen-reader name and placeholder, and the two buttons. */
  noteLabel: 'Annotation',
  notePlaceholder: 'What should change?',
  addToChat: 'Add to chat',
  cancel: 'Cancel',
  /** The line above the composer and in sent messages. */
  token: (n: number) => (n === 1 ? 'Slide annotations · 1' : `Slide annotations · ${n}`),
  added: (token: string) => `Added to chat · ${token}`,
  removeAll: 'Remove all slide annotations',
  removeOne: (n: number) => `Remove annotation ${n}`,
  /** Screen-reader name for an item in the list. */
  item: (n: number, label: string, text: string) => `Annotation ${n}, ${label}: ${text}`,
  empty: 'Write an annotation first, then add it to the chat',
  tooLong: (max: number) => `An annotation can be at most ${max} characters`,
  tooMany: (max: number) => `A message can carry at most ${max} slide annotations. Send these first.`,
  /** The slide tag's location has no session yet. */
  noConversation: 'This tab isn’t part of a session yet. Send a message to start one, then add annotations.',
  /** The sentence sent to the agent when there are annotations but no written message. */
  message: 'Please revise the slides according to these annotations.',
  /** Before sending, the editor has unsaved changes (product design §3.2.4 names the specific objects): `names` are the names of these slides. */
  flushFailed: (names: readonly string[]) =>
    `Changes to the slides ${list(names.map((n) => `“${n}”`))} haven’t finished saving, so the message wasn’t sent. Try again, or remove the slide annotations first.`,
};
export type SlidesMessages = typeof en;
export const SLIDES = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
