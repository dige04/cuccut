import { defineMessages, intlLocale } from '@cuccut/protocol';
import { zhHans } from './models-dir-copy.zh-Hans.ts';
import { zhHant } from './models-dir-copy.zh-Hant.ts';
import { ja } from './models-dir-copy.ja.ts';
import { ko } from './models-dir-copy.ko.ts';
import { es } from './models-dir-copy.es.ts';
import { fr } from './models-dir-copy.fr.ts';
import { de } from './models-dir-copy.de.ts';
import { nl } from './models-dir-copy.nl.ts';
import { ptBR } from './models-dir-copy.pt-BR.ts';
import { it } from './models-dir-copy.it.ts';
import { ru } from './models-dir-copy.ru.ts';
import { pl } from './models-dir-copy.pl.ts';
import { tr } from './models-dir-copy.tr.ts';
import { vi } from './models-dir-copy.vi.ts';

/** Copy for Settings › Local models › Model directory (the English is the source of the keys and types; translations are in `models-dir-copy.<locale>.ts`). */

const and = (items: readonly string[]) => new Intl.ListFormat(intlLocale(), { type: 'conjunction' }).format(items);
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const models = (n: number) => `${n} ${n === 1 ? 'model' : 'models'}`;

const en = {
  /** Fixed wording used in cards and dialogs. */
  dir: {
    title: 'Models folder',
    defaultChip: 'Default',
    envChip: 'Environment variable',
    change: 'Change…',
    restore: 'Restore default',
    envNote: 'Set by the CUCCUT_MODELS_DIR environment variable. To change it, edit the environment variable and restart CucCut.',
    shareHint:
      "If other apps share this folder, deleting a model here deletes its files from the folder, and those apps won't find it either.",
    blockedPrefix: "Can't change right now:",
    viewTasks: 'View tasks',
    changeTitle: 'Change models folder',
    restoreTitle: 'Restore default location',
    restoreLead: 'Change the models folder back to',
    checking: 'Looking at this folder…',
    cancel: 'Cancel',
    howTo: 'What to do with existing models',
    moveOption: 'Move existing models there',
    switchOption: 'Only switch the location',
    confirmMove: 'Move and change',
    confirmSwitch: 'Change location',
    movingLabel: 'Moving models',
    stayOpen: "Don't quit CucCut in the meantime",
    missingDir:
      "This folder doesn't exist (this also happens when an external drive isn't connected). Models work again once it's connected, or you can choose another location.",
    notWritableDir: "CucCut doesn't have permission to write to this folder, so models can't be downloaded into it.",
    loading: 'Reading the models folder…',
    pickFailed: (message: string) => `Couldn't choose the folder: ${message}`,
    same: 'This is already the current models folder',
  },
  /** Card subtitle: used · free space on the disk · N models recognized (`free` is null when free space cannot be determined). */
  stats: (used: string, free: string | null, count: number) =>
    [`${used} used`, ...(free !== null ? [`${free} free on disk`] : []), `${models(count)} found`].join(' · '),
  /** Cannot be changed right now: names of models being downloaded or checked, and the number of tasks using local models. */
  blocker: (downloading: readonly string[], testing: readonly string[], tasks: number) => {
    const parts: string[] = [];
    if (downloading.length) parts.push(`downloading ${and(downloading)}`);
    if (testing.length) parts.push(`checking ${and(testing)}`);
    if (tasks) parts.push(`${tasks} ${tasks === 1 ? 'task is' : 'tasks are'} using local models`);
    return `${capitalize(parts.join('; '))}. Wait for them to finish before changing, or files would be moved while in use.`;
  },
  missingTitle: "Can't find this folder",
  missingText: "This folder doesn't exist. This also happens when an external drive isn't connected; connect it and choose again.",
  notWritableTitle: "This folder isn't writable",
  notWritableText:
    "CucCut doesn't have permission to write to this folder, so models can't be downloaded into it. Choose a writable location, or change its permissions first.",
  nestedTitle: "Can't put it here",
  nestedText:
    'The new location and the current models folder contain each other (one is inside the other). Choose a folder that is neither inside it nor contains it.',
  /** What is in the new location (`bytes` already formatted); `free` is the free space on the disk it is on, null when it cannot be determined. */
  found: (count: number, bytes: string, free: string | null) =>
    `${
      count
        ? `Found ${count} downloaded ${count === 1 ? 'model' : 'models'} (${bytes}), ready to use.`
        : 'There are no models in this folder yet. Models you download later will go here.'
    }${free !== null ? ` ${free} free on disk.` : ''}`,
  moveNoFit: (required: string, free: string, short: string) =>
    `Moving needs ${required}, but the target drive only has ${free} free (${short} short). It won't fit.`,
  moveSameVolume: (size: string) => `Moves ${size} on the same drive, so it's quick. The files won't be kept at the old location afterward.`,
  moveOther: (size: string) => `Moves ${size}. The files won't be kept at the old location afterward.`,
  /** Switch location only: how many models the new location already has (0 means the count is not stated). */
  switchDescription: (count: number) =>
    `Files at the old location are kept, not deleted. Only the ${count ? `${models(count)} ` : 'models '}already in the new location can be used; the rest show as not installed.`,
  appliedMoving: (where: string) => `Started moving models to ${where}`,
  appliedKept: (where: string) => `Models folder changed to ${where} · Files at the old location are kept`,
  applied: (where: string) => `Models folder changed to ${where}`,
  /** Move progress; `to` is the shortened target directory, and `amount` is “已移 / 总量” (moved / total). */
  moveWaiting: (to: string | null) => `Waiting to start moving${to ? ` to ${to}` : ''}…`,
  moveValidating: (amount: string | null) => `Verifying the copied files${amount ? ` (${amount})` : ''}…`,
  movePublishing: 'Finishing the move…',
  moving: (amount: string | null, to: string | null) => `Moving${amount ? ` ${amount}` : ''}${to ? ` to ${to}` : ''}…`,
};

export type ModelsDirMessages = typeof en;

export const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
