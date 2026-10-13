import { defineMessages, type SpaceEntryKind, type SpaceEntryStatus } from '@cuccut/protocol';
import { zhHans } from './space-copy.zh-Hans.ts';
import { zhHant } from './space-copy.zh-Hant.ts';
import { ja } from './space-copy.ja.ts';
import { ko } from './space-copy.ko.ts';
import { es } from './space-copy.es.ts';
import { fr } from './space-copy.fr.ts';
import { de } from './space-copy.de.ts';
import { nl } from './space-copy.nl.ts';
import { ptBR } from './space-copy.pt-BR.ts';
import { it } from './space-copy.it.ts';
import { ru } from './space-copy.ru.ts';
import { pl } from './space-copy.pl.ts';
import { tr } from './space-copy.tr.ts';
import { vi } from './space-copy.vi.ts';

/** Copy for the Space list area (model/space.ts; translations are in `space-copy.<locale>.ts`). */
const en = {
  kind: {
    video: 'Video',
    export: 'Export',
    'video-file': 'Video asset',
    image: 'Image',
    audio: 'Audio',
    subtitle: 'Subtitles',
    document: 'Document',
    slides: 'Slides',
    design: 'Design',
    'design-system': 'Design system',
    package: 'Video package',
    template: 'Template',
  } satisfies Record<SpaceEntryKind, string>,
  categoryAll: 'All',
  favorite: 'Favorites',
  trash: 'Trash',
  sort: { created: 'Date created', updated: 'Date updated', recent: 'Recent activity', name: 'Name', kind: 'Type' },
  status: {
    generating: 'Generating',
    candidate: 'Candidate',
    applied: 'Applied',
    published: 'Published',
    'source-changed': 'Source changed',
    missing: 'Missing',
    failed: 'Failed',
  } satisfies Record<SpaceEntryStatus, string>,
  statusAny: 'All statuses',
  statusNone: 'No status',
  noProject: 'Not in a project',
  removedProject: 'Removed project',
  conversation: (title: string) => `Session “${title}”`,
  /** In the “Source” column, the parent video of a derived sub-video. */
  derivedFrom: (name: string) => `From “${name}”`,
  /** One item in the details of a card's “N files”: the type and the count. */
  kindCount: (kind: string, n: number) => `${kind} ${n}`,
  /** When a search or filter matches only through the files under a video, write which file: `n` is the number of matching files. */
  foundFiles: (name: string, n: number) => (n === 1 ? `Found: ${name}` : `Found: ${name} and ${n - 1} more`),
  /** When the video has no status of its own, it speaks for its files: one file writes its type and status; several files write the count and status. */
  fileStatus: (kind: string, status: string) => `${kind}: ${status}`,
  filesStatus: (n: number, status: string) => `${n} ${n === 1 ? 'file' : 'files'}: ${status}`,
};
export type SpaceMessages = typeof en;
export const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
