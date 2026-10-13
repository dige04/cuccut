import { defineMessages } from '@cuccut/protocol';
import { zhHans } from './library-copy.zh-Hans.ts';
import { zhHant } from './library-copy.zh-Hant.ts';
import { ja } from './library-copy.ja.ts';
import { ko } from './library-copy.ko.ts';
import { es } from './library-copy.es.ts';
import { fr } from './library-copy.fr.ts';
import { de } from './library-copy.de.ts';
import { nl } from './library-copy.nl.ts';
import { ptBR } from './library-copy.pt-BR.ts';
import { it } from './library-copy.it.ts';
import { ru } from './library-copy.ru.ts';
import { pl } from './library-copy.pl.ts';
import { tr } from './library-copy.tr.ts';
import { vi } from './library-copy.vi.ts';

const count = (n: number, one: string, other: string) => `${n} ${n === 1 ? one : other}`;

/**
 * Copy for the Library page layout (agentcut library view): the rail, the section header, the counted kind filters and
 * the gallery status line. Everything else on the page keeps `space-copy.ts`. Translations in `library-copy.<locale>.ts`.
 */
const en = {
  blurb: 'Videos, media and everything your agents made, across every project.',
  blurbProject: 'Videos, media and outputs in this project.',
  blurbFavorite: 'Everything you starred, from every project.',
  blurbTrash: 'Items moved to Trash wait here until you restore them or delete them for good.',
  allItems: 'All items',
  projects: 'Projects',
  items: (n: number) => count(n, 'item', 'items'),
  matching: (n: number, q: string) => `${count(n, 'item', 'items')} matching “${q}”`,
  kindFilter: 'Kind of item',
  clearSearch: 'Clear search',
  noMatchBody: 'Try another name, or switch to a different kind.',
  openHint: 'Open to preview · Videos open in the editor',
  inProject: (name: string) => `In ${name}`,
  clearProject: 'Show every project',
  backToLibrary: 'Back to Library',
};

export type LibraryMessages = typeof en;

export const LIBRARY_COPY = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
