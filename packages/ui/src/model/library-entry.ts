import { defineMessages, type LibraryEntrySummary, type LibraryName } from '@cuccut/protocol';
import { zhHans } from './library-entry.zh-Hans.ts';
import { zhHant } from './library-entry.zh-Hant.ts';
import { ja } from './library-entry.ja.ts';
import { ko } from './library-entry.ko.ts';
import { es } from './library-entry.es.ts';
import { fr } from './library-entry.fr.ts';
import { de } from './library-entry.de.ts';
import { nl } from './library-entry.nl.ts';
import { ptBR } from './library-entry.pt-BR.ts';
import { it } from './library-entry.it.ts';
import { ru } from './library-entry.ru.ts';
import { pl } from './library-entry.pl.ts';
import { tr } from './library-entry.tr.ts';
import { vi } from './library-entry.vi.ts';

const en = {
  versionConflict: 'This entry was just changed somewhere else, so your edit wasn’t saved. The latest version has been reloaded. Please make your change again.',
  /** `action` is the action phrase given by the caller (in English, a lowercase verb phrase, e.g. `rename`). */
  failed: (action: string, message: string) => `Couldn’t ${action}: ${message}`,
};
export type LibraryEntryMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * Small operators for user library entries (architecture design §5.9): shared by the glossary and the brand library.
 */

/** The key of the entry in the cache: the content of one version never changes again. */
export function entryKey(entry: { library: LibraryName; id: string; version: number }): string {
  return `${entry.library}/${entry.id}@${entry.version}`;
}

function detailsCode(error: unknown): string | null {
  const details = (error as { details?: unknown } | null)?.details;
  return details && typeof details === 'object' && typeof (details as { code?: unknown }).code === 'string'
    ? (details as { code: string }).code
    : null;
}

/** Another place (another window, an agent, the CLI) changed this entry first: the `expectedVersion` sent with `library.put` is not the current version. */
export function isVersionConflict(error: unknown): boolean {
  return detailsCode(error) === 'LIBRARY_VERSION_CONFLICT';
}

/** The message given to the user on a version conflict: it says what happened and what the interface will do next. */
export const versionConflictText = (): string => M.versionConflict;

/** Failure hint: `没能<做什么>：<原因>` (Could not <do what>: <reason>); on a conflict, replaced by the sentence above. */
export function libraryErrorText(action: string, error: unknown): string {
  if (isVersionConflict(error)) return versionConflictText();
  const message = error instanceof Error ? error.message : String(error);
  return M.failed(action, message);
}

/** The summary is newer than the one we hold: the topic sent a newer version. */
export function isNewer(summary: Pick<LibraryEntrySummary, 'version'> | undefined, version: number): boolean {
  return !!summary && summary.version > version;
}
