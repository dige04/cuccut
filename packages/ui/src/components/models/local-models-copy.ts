import { defineMessages, live } from '@cuccut/protocol';
import { zhHans } from './local-models-copy.zh-Hans.ts';
import { zhHant } from './local-models-copy.zh-Hant.ts';
import { ja } from './local-models-copy.ja.ts';
import { ko } from './local-models-copy.ko.ts';
import { es } from './local-models-copy.es.ts';
import { fr } from './local-models-copy.fr.ts';
import { de } from './local-models-copy.de.ts';
import { nl } from './local-models-copy.nl.ts';
import { ptBR } from './local-models-copy.pt-BR.ts';
import { it } from './local-models-copy.it.ts';
import { ru } from './local-models-copy.ru.ts';
import { pl } from './local-models-copy.pl.ts';
import { tr } from './local-models-copy.tr.ts';
import { vi } from './local-models-copy.vi.ts';

/**
 * Text used for the install management of local models (download, repair, stop, delete). The other text on the page is in `LOCAL_COPY` in models-copy.ts, and check wording is in model/model-check-copy.ts. English is the source of keys and types; translations are in `local-models-copy.<语言>.ts`.
 */
const en = {
  install: {
    /** In the browser (the Web allowlist does not include `models.install` and other install management, or `models.setDefault`): this sentence is shown at the top of the page and these buttons are greyed out. */
    webNote: 'A browser can’t download, check, repair or remove local models, or change the default model. Do this in the CucCut desktop app.',
    availableNote:
      'Before downloading, you’ll see how much will be downloaded and how much disk space is left. You can pause a download; what’s already downloaded is kept and resumes next time.',
    download: 'Download',
    complete: 'Complete',
    downloadSize: (size: string) => `Download ${size}`,
    completeSize: (size: string) => `Complete ${size}`,
    resume: 'Resume download',
    pause: 'Pause',
    cancelDownload: 'Cancel download',
    discard: 'Discard downloaded files',
    repair: 'Repair…',
    remove: 'Delete…',
    more: (id: string) => `More · ${id}`,
    details: 'Details',
    hideDetails: 'Hide details',
    componentLine: (state: 'installed' | 'missing', size: string | null) => (state === 'installed' ? `Installed${size ? ` · ${size}` : ''}` : `Missing${size ? ` · ${size}` : ''}`),
    sharedWith: (ids: string[]) => `Shared with ${ids.join(', ')}`,
    noComponents: 'This Runtime didn’t report component details.',
    // Confirmation dialog
    installTitle: (id: string) => `Download ${id}`,
    repairTitle: (id: string) => `Repair “${id}”?`,
    completeTitle: (id: string) => `Complete ${id}`,
    planning: 'Working out what to download…',
    verifying: 'Looking for damaged or missing files. This can take a while for large files…',
    planFailed: 'Couldn’t get the download plan',
    upToDate: 'All files are present and verified. Nothing to download.',
    completeNote: 'Only the missing components are downloaded; installed files are left alone.',
    repairUpToDate: 'All files are intact. Nothing to download again.',
    repairThenCheck: 'Only damaged or missing files are downloaded again; intact ones are left alone. It’s checked again automatically after the repair.',
    replanned: 'The download size just changed. Here’s the new plan; please confirm again.',
    source: (url: string) => `Download source: ${url}`,
    confirmInstall: (size: string) => `Download ${size}`,
    confirmRepair: 'Repair',
    cancel: 'Cancel',
    close: 'Close',
    started: (id: string) => `Downloading ${id} · progress shows in this row and in Background tasks`,
    // Stop and delete
    paused: (id: string) => `Paused ${id} · what’s already downloaded is kept`,
    discardTitle: (id: string) => `Discard the downloaded part of ${id}?`,
    discardBody: 'The next download starts from scratch. Files other model packages are downloading, and shared components, aren’t deleted.',
    discarded: (id: string) => `Discarded the downloaded part of ${id}`,
    removeTitle: (id: string) => `Delete ${id}?`,
    removeConfirm: 'Delete',
    stopFailed: (text: string) => `Couldn't stop: ${text}`,
    removeFailed: (text: string) => `Couldn't delete: ${text}`,
    installFailed: (text: string) => `The last download didn't finish: ${text}`,
  },
  shared: {
    title: 'Shared components',
    note: 'Several models in this category use these. Each is installed once and removed along with the last model that uses it.',
    /** Subtitle when collapsed: if there are some to complete, says how many are pending; otherwise says the total count. */
    summaryRepair: (n: number) => (n === 1 ? '1 component to complete' : `${n} components to complete`),
    summaryCount: (n: number) => (n === 1 ? '1 shared component' : `${n} shared components`),
    /** Subtitle of a row: how many models with their own files on disk are in use, out of how many are needed in total (at least 2). */
    usage: (live: number, all: number) => `${live === 1 ? '1 installed model uses it' : `${live} installed models use it`} · ${all} need it`,
    usageNone: (all: number) => `${all} models will use it · none installed yet`,
    /** No model available to borrow for completion: downloaded together when the model is installed. */
    withModel: (size: string | null) => `Downloads with the first model you install${size ? ` · ${size}` : ''}`,
    /** When completing a model from the shared components row, the sentence in the dialog that replaces `install.completeNote`. */
    completeNote: (name: string) => `Shared components download with a model that uses them. This only adds what ${name} is missing; installed files are left alone.`,
  },
};

export type LocalModelsMessages = typeof en;

const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

export const LOCAL_INSTALL_COPY = live(() => M.install);

/** The “shared components” section of the local models page (design mock settings-local.jsx `SharedCard`). */
export const LOCAL_SHARED_COPY = live(() => M.shared);
