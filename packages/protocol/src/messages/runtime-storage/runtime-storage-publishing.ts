import { defineCatalog } from '../../message-ref.ts';
import { zhHans } from './runtime-storage-publishing.zh-Hans.ts';
import { zhHant } from './runtime-storage-publishing.zh-Hant.ts';
import { ja } from './runtime-storage-publishing.ja.ts';
import { ko } from './runtime-storage-publishing.ko.ts';
import { es } from './runtime-storage-publishing.es.ts';
import { fr } from './runtime-storage-publishing.fr.ts';
import { de } from './runtime-storage-publishing.de.ts';
import { nl } from './runtime-storage-publishing.nl.ts';
import { ptBR } from './runtime-storage-publishing.pt-BR.ts';
import { it } from './runtime-storage-publishing.it.ts';
import { ru } from './runtime-storage-publishing.ru.ts';
import { pl } from './runtime-storage-publishing.pl.ts';
import { tr } from './runtime-storage-publishing.tr.ts';
import { vi } from './runtime-storage-publishing.vi.ts';

/** Errors and states of the publishing store (`packages/runtime-storage`: PublishingStore). */
const en = {
  unreadable:
    "Publishing data couldn't be read. CucCut left the file as it is and won't change it. Restore it from a backup, or move it aside to start over.",
  newerVersion: 'Publishing data was saved by a newer version of CucCut. Update CucCut to change it; until then you can only view it.',
  conflict: 'This publication changed elsewhere. Reload the saved version before applying your changes.',
  settingsConflict: 'Publishing settings changed elsewhere. Reload them before saving.',
  notFound: 'This publication no longer exists.',
  invalidRecord: "This change would leave a publishing record incomplete, so it wasn't saved. Check the values and try again.",
  writeFailed: "Publishing data couldn't be saved to disk. Check that the disk has space and CucCut can write to its folder, then try again.",
};

export type RuntimeStoragePublishingMessages = typeof en;

export const RuntimeStoragePublishing = defineCatalog('runtimeStoragePublishing', en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
