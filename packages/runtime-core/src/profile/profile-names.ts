import { RpcError, type Id, type LibraryEntry, type LibraryEntryRef, type LibraryEntrySummary, type TranscriptionGlossary } from '@cuccut/protocol';
import type { LibraryPutInput, LibraryPutOutcome } from '@cuccut/runtime-storage/library';

/**
 * Names from the interview (docs/cuccut/m2-profile-rules.md §4): they go into one transcription glossary in the user library, enabled by default, so
 * recognition spells them right and the session block lists them. There is no second glossary store.
 *
 * - The first sync creates the entry; later ones add only canonical spellings it does not have yet (case-insensitive). Terms the user edited in the
 *   library are never overwritten.
 * - An entry the user removed (or that is no longer a transcription glossary) is created again.
 * - The merge is put with the version it was made from, and retried once after a `LIBRARY_VERSION_CONFLICT`.
 */

/** The part of the user library the names need (`LibraryStore`). */
export interface NamesLibrary {
  list(library?: 'glossaries', kind?: string): LibraryEntrySummary[];
  get(ref: LibraryEntryRef & { library: 'glossaries' }): LibraryEntry<'glossaries'>;
  put(input: LibraryPutInput & { library: 'glossaries' }): Promise<LibraryPutOutcome<'glossaries'>>;
}

export interface InterviewName {
  term: string;
  misheard: string[];
}

export interface NamesSync {
  /** The glossary the names are in (null when there were none and there is no glossary). */
  glossaryId: Id | null;
  /** Canonical spellings that were added by this sync. */
  added: string[];
}

/** Library limits for one term (`library-content.ts`): a term has no line breaks, and a glossary entry at most 50 mishearings. */
const TERM_CHARS = 200;
const MISHEARD_PER_TERM = 50;

const cleanTerm = (value: string): string => value.replace(/\s+/g, ' ').trim().slice(0, TERM_CHARS).trim();

/** The names as the library takes them: trimmed, one per canonical spelling (case-insensitive, first kept), mishearings without the term itself. */
export function cleanNames(names: readonly InterviewName[]): { canonical: string; misheard: string[] }[] {
  const seen = new Set<string>();
  const out: { canonical: string; misheard: string[] }[] = [];
  for (const name of names) {
    const canonical = cleanTerm(name.term);
    const key = canonical.toLowerCase();
    if (!canonical || seen.has(key)) continue;
    seen.add(key);
    const misheard = [...new Set(name.misheard.map(cleanTerm).filter((m) => m && m !== canonical))].slice(0, MISHEARD_PER_TERM);
    out.push({ canonical, misheard });
  }
  return out;
}

export async function syncInterviewNames(
  library: NamesLibrary,
  options: { glossaryId: Id | null; names: readonly InterviewName[]; glossaryName: string },
): Promise<NamesSync> {
  const names = cleanNames(options.names);
  const current = options.glossaryId ? existing(library, options.glossaryId) : null;
  if (!current) {
    if (names.length === 0) return { glossaryId: null, added: [] };
    const content: TranscriptionGlossary = { name: options.glossaryName, kind: 'transcription', language: null, defaultEnabled: true, terms: names };
    const { entry } = await library.put({ library: 'glossaries', content });
    return { glossaryId: entry.id, added: names.map((n) => n.canonical) };
  }
  for (let attempt = 0; ; attempt++) {
    const entry = attempt === 0 ? current : existing(library, current.id);
    if (!entry) {
      // Removed between the read and the retry: start again with a new entry.
      return syncInterviewNames(library, { ...options, glossaryId: null });
    }
    const glossary = entry.content as TranscriptionGlossary;
    const have = new Set(glossary.terms.map((t) => t.canonical.toLowerCase()));
    const fresh = names.filter((n) => !have.has(n.canonical.toLowerCase()));
    if (fresh.length === 0) return { glossaryId: entry.id, added: [] };
    try {
      await library.put({
        library: 'glossaries',
        id: entry.id,
        expectedVersion: entry.version,
        content: { ...glossary, terms: [...glossary.terms, ...fresh] },
      });
      return { glossaryId: entry.id, added: fresh.map((n) => n.canonical) };
    } catch (error) {
      if (attempt === 0 && versionConflict(error)) continue;
      throw error;
    }
  }
}

/**
 * The names the session block asks the agent to spell exactly: the canonical spellings of every transcription glossary enabled by default, in library
 * order, without repeats (case-insensitive), at most `limit`.
 */
export function namesToSpell(library: Pick<NamesLibrary, 'list' | 'get'>, limit: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const summary of library.list('glossaries', 'transcription')) {
    if (!summary.defaultEnabled) continue;
    const entry = existing(library, summary.id);
    if (!entry || entry.content.kind !== 'transcription') continue;
    for (const term of entry.content.terms) {
      const key = term.canonical.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(term.canonical);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** The entry when it is still there and still a transcription glossary. */
function existing(library: Pick<NamesLibrary, 'get'>, id: Id): LibraryEntry<'glossaries'> | null {
  try {
    const entry = library.get({ library: 'glossaries', id });
    return entry.content.kind === 'transcription' ? entry : null;
  } catch (error) {
    if (error instanceof RpcError && error.code === 'not-found') return null;
    throw error;
  }
}

function versionConflict(error: unknown): boolean {
  return error instanceof RpcError && (error.details as { code?: string } | undefined)?.code === 'LIBRARY_VERSION_CONFLICT';
}
