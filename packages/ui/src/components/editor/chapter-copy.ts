import { defineMessages } from '@cuccut/protocol';
import type { AddChapterRefusal } from '../../model/chapters.ts';
import { zhHans } from './chapter-copy.zh-Hans.ts';
import { zhHant } from './chapter-copy.zh-Hant.ts';
import { ja } from './chapter-copy.ja.ts';
import { ko } from './chapter-copy.ko.ts';
import { es } from './chapter-copy.es.ts';
import { fr } from './chapter-copy.fr.ts';
import { de } from './chapter-copy.de.ts';
import { nl } from './chapter-copy.nl.ts';
import { ptBR } from './chapter-copy.pt-BR.ts';
import { it } from './chapter-copy.it.ts';
import { ru } from './chapter-copy.ru.ts';
import { pl } from './chapter-copy.pl.ts';
import { tr } from './chapter-copy.tr.ts';
import { vi } from './chapter-copy.vi.ts';

/** Chapter copy in the editor: the timeline chapter bar, the context menu, the add/rename popover, previous and next chapter while playing, and the transcript's chapter header line. Translations are in `chapter-copy.zh-Hans.ts`. */
const en = {
  band: 'Chapters',
  prev: 'Previous chapter',
  next: 'Next chapter',
  noChapters: 'No chapters yet',
  /** Gaps on the chapter bar that have no chapter (before the first chapter, between chapters). */
  gap: 'No chapter',
  beforeFirst: 'Before the first chapter',
  add: 'Add chapter at playhead',
  rename: 'Rename…',
  remove: 'Delete this chapter',
  menuLabel: (title: string) => `Chapter “${title}”`,
  gapMenuLabel: 'Chapter bar',
  /** Screen-reader name for a chapter segment on the chapter bar: the title plus start and end. */
  segmentLabel: (title: string, range: string) => `${title}, ${range}, click to jump to the start`,
  dragHint: 'Drag to move the start of this chapter',
  /** Add / rename popover. */
  addTitle: 'Add chapter',
  renameTitle: 'Rename chapter',
  titleLabel: 'Title',
  addAt: (time: string) => `Starts at ${time} and runs to the next chapter`,
  confirmAdd: 'Add',
  confirmRename: 'Rename',
  cancel: 'Cancel',
  refusal: {
    exists: 'There’s already a chapter at the playhead',
    beyond: 'The playhead is at the end; a chapter can’t be added here',
    blank: 'The title can’t be blank',
  } satisfies Record<AddChapterRefusal, string>,
  added: (title: string) => `Added chapter “${title}”`,
  renamed: (title: string) => `Renamed to “${title}”`,
  removed: (title: string) => `Deleted chapter “${title}”`,
  undo: 'Undo',
  /** The chapter header line in the transcript. */
  clickRename: 'Click to rename',
  jump: 'Jump to the start of this chapter',
  paragraphs: (n: number) => `${n} paragraph${n === 1 ? '' : 's'}`,
  empty: 'This chapter has no paragraphs yet',
};

export type ChapterMessages = typeof en;
export const CHAPTER_COPY = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
