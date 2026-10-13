import type { CaptionItem, DocumentRecord, Id, Sequence, Track } from '@cuccut/protocol';
import { captionKind } from './caption-tracks.ts';

/**
 * Language tags for timeline row heads (prototype model-timeline.js `langTag` / `headTags`, 2026-10-08). A row head is only 144px wide, and full names such as 「字幕 · 简体中文」 (Subtitles · Simplified Chinese) are longer in other UI languages and do not fit, so subtitle and dub rows use short tags such as ZH, EN, PT-BR, which keep the same width in every UI language.
 * Source and translation are told apart by the row-head icon, and the full name and source / translation go in the hover tooltip. Rows without a language keep writing the full name as before.
 */

/** Language tag: trims surrounding whitespace, replaces underscores with hyphens, and uppercases (`pt_BR` → `PT-BR`). Empty string when there is no language. */
export function languageTag(language: string | null | undefined): string {
  return (language ?? '').trim().replace(/_/g, '-').toUpperCase();
}

/** A row's language: for subtitle or dub rows only; other rows get no tag. */
export interface HeadLanguage {
  trackId: Id;
  group: 'subtitle' | 'dub';
  language: string | null;
}

/** Tags for each row. When the same tag appears on more than one row of the same kind (subtitle / dub), rows are numbered in order (「EN 1」 「EN 2」). Rows without a language are not included. */
export function headTags(rows: readonly HeadLanguage[]): Map<Id, string> {
  const count = new Map<string, number>();
  for (const row of rows) {
    const tag = languageTag(row.language);
    if (tag) count.set(`${row.group}:${tag}`, (count.get(`${row.group}:${tag}`) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  const out = new Map<Id, string>();
  for (const row of rows) {
    const tag = languageTag(row.language);
    if (!tag) continue;
    const key = `${row.group}:${tag}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    out.set(row.trackId, (count.get(key) ?? 0) > 1 ? `${tag} ${n}` : tag);
  }
  return out;
}

/**
 * Which language a subtitle row is in, and whether it is source or translation: look at the subtitle document referenced by the earliest subtitle instance on this track (the same rule as the subtitle track bar and the preview). When the subtitle document has no language written,
 * use the language of the document it is derived from (transcript or translation). Null when the track has no subtitle instances.
 */
export function subtitleTrackLanguage(
  sequence: Sequence,
  track: Track,
  documents: Record<Id, DocumentRecord>,
): { language: string | null; kind: 'original' | 'translation' } | null {
  const first = sequence.items
    .filter((item): item is CaptionItem => item.trackId === track.id && item.type === 'caption')
    .sort((a, b) => a.span.fromFrame - b.span.fromFrame)[0];
  if (!first) return null;
  const record = documents[first.documentId];
  const parent = record?.sourceDocumentId ? documents[record.sourceDocumentId] : undefined;
  return { language: record?.language ?? parent?.language ?? null, kind: captionKind(first.documentId, documents) };
}
