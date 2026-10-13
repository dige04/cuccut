import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { TOOL_CANDIDATES_MAX_LIMIT, type Id, type ToolCandidate, type ToolCandidatesResult } from '@cuccut/protocol';
import type { VideoToolId } from '../../model/tool-catalog.ts';
import { documentsByEntry, pickerRows, type PickerRow } from '../../model/tool-targets.ts';
import type { RuntimeSession } from '../../runtime/session.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useJobs } from '../../state/jobs-store.ts';
import { useSpace } from '../../state/space-store.ts';

/*
 * Candidate videos for the video tools (product design §2.7, “pick existing ones, no need to open first”): reads `tools.candidates` (the Space catalog and content index, without opening videos); shared between pages and re-read when the Space catalog changes and a job finishes. Filtering, sorting and the greyed-out reasons are in model/tool-targets.ts.
 */

export const PAGE = 100;

export interface CandidatePage {
  list: ToolCandidate[];
  nextCursor: string | null;
  total: number;
  complete: boolean;
  pendingVideos: number;
  scanning: boolean;
}

interface CandidateState {
  pages: Partial<Record<string, CandidatePage>>;
  errors: Partial<Record<string, string>>;
}

/** Candidates for each tool (shared between pages, so going back to the same page does not flicker). Transcription reads a second set of candidates with transcript rules (`docs:` prefix) to add annotations. */
const useCandidateStore = create<CandidateState>()(() => ({ pages: {}, errors: {} }));

function pageOf(result: ToolCandidatesResult, list: ToolCandidate[]): CandidatePage {
  return {
    list,
    nextCursor: result.nextCursor,
    total: result.total,
    complete: result.complete,
    pendingVideos: result.pendingVideos,
    scanning: result.scanning,
  };
}

/** Re-reads the first page (items already listed more than once are still listed, up to `TOOL_CANDIDATES_MAX_LIMIT`). */
function reload(session: RuntimeSession, key: string, toolId: string, limit: number): void {
  session.toolCandidates({ toolId, limit: Math.min(TOOL_CANDIDATES_MAX_LIMIT, Math.max(PAGE, limit)) }).then(
    (result) =>
      useCandidateStore.setState((s) => ({ pages: { ...s.pages, [key]: pageOf(result, result.candidates) }, errors: { ...s.errors, [key]: undefined } })),
    (e: Error) => useCandidateStore.setState((s) => ({ errors: { ...s.errors, [key]: e.message } })),
  );
}

export interface Candidates {
  /** The first read has not returned yet. */
  loading: boolean;
  error: string | null;
  page: CandidatePage | null;
  /** All rows without a search term (the page uses these to find the selected row and compute the pre-selection). */
  rows: PickerRow[];
  /** Rows with a search term. */
  rowsFor(query: string): PickerRow[];
  more(): void;
}

/**
 * Candidates for one video tool: read on mount; when the Space catalog changes, or a job finishes (a transcript may have been added), re-read after a short wait.
 * “transcribing / queued / last failed” are derived from `jobs`.
 */
export function useCandidates(tool: VideoToolId): Candidates {
  const session = useRuntime();
  const page = useCandidateStore((s) => s.pages[tool] ?? null);
  const docs = useCandidateStore((s) => (tool === 'transcribe' ? (s.pages[`docs:${tool}`] ?? null) : null));
  const error = useCandidateStore((s) => s.errors[tool] ?? null);
  const entries = useSpace((s) => s.entries);
  const jobs = useJobs((s) => s.jobs);
  const finished = useMemo(() => jobs.filter((j) => j.state === 'completed').length, [jobs]);
  const shown = page?.list.length ?? 0;

  useEffect(() => {
    const timer = setTimeout(
      () => {
        reload(session, tool, tool, shown);
        // The `videos` rule does not list transcripts: the candidates for translated subtitles (videos that have a transcript) supply the annotation and the “will not overwrite” hint.
        if (tool === 'transcribe') reload(session, `docs:${tool}`, 'translate-subtitles', TOOL_CANDIDATES_MAX_LIMIT);
      },
      useCandidateStore.getState().pages[tool] ? 400 : 0,
    );
    return () => clearTimeout(timer);
    // `shown` only decides how many rows to re-read; it does not trigger a re-read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, tool, entries, finished]);

  const extra = useMemo(() => (docs ? documentsByEntry(docs.list) : undefined), [docs]);
  const list = page?.list;
  const rows = useMemo(() => pickerRows(tool, list ?? [], jobs, '', extra), [tool, list, jobs, extra]);
  const rowsFor = (query: string) => (query.trim() ? pickerRows(tool, list ?? [], jobs, query, extra) : rows);
  const more = () => {
    const cursor = page?.nextCursor;
    if (!cursor) return;
    session.toolCandidates({ toolId: tool, cursor, limit: PAGE }).then(
      (result) =>
        useCandidateStore.setState((s) => {
          const prev = s.pages[tool]?.list ?? [];
          const seen = new Set(prev.map((c) => c.entryId));
          return { pages: { ...s.pages, [tool]: pageOf(result, [...prev, ...result.candidates.filter((c) => !seen.has(c.entryId))]) } };
        }),
      (e: Error) => useCandidateStore.setState((s) => ({ errors: { ...s.errors, [tool]: e.message } })),
    );
  };
  return { loading: !page && !error, error, page, rows, rowsFor, more };
}

/**
 * “transcribe… / re-transcribe…” in the Space video entry menu (product design §4.4): whether this video has a transcript. Reads candidates with the transcript rule (shared with the transcription tool page, `docs:transcribe`), and re-reads when the Space catalog changes and a job finishes. Returns null when it cannot be read: not yet read, no index built, or the list is incomplete and the entry is not in it.
 */
export function useTranscribedEntries(): (entryId: Id) => boolean | null {
  const session = useRuntime();
  const key = 'docs:transcribe';
  const docs = useCandidateStore((s) => s.pages[key] ?? null);
  const entries = useSpace((s) => s.entries);
  const finished = useJobs((s) => s.jobs.filter((j) => j.state === 'completed').length);
  useEffect(() => {
    const timer = setTimeout(
      () => reload(session, key, 'translate-subtitles', TOOL_CANDIDATES_MAX_LIMIT),
      useCandidateStore.getState().pages[key] ? 400 : 0,
    );
    return () => clearTimeout(timer);
  }, [session, entries, finished]);
  return useMemo(() => {
    if (!docs) return () => null;
    const byEntry = new Map(docs.list.map((c) => [c.entryId, c]));
    const whole = docs.complete && !docs.nextCursor;
    return (entryId: Id) => {
      const c = byEntry.get(entryId);
      if (c) return c.indexed || c.documents.length ? c.documents.length > 0 : null;
      return whole ? false : null;
    };
  }, [docs]);
}
