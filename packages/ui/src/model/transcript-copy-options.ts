import type { Id, TextExportSettings } from '@cuccut/protocol';
import { transcriptSettings } from './export-settings.ts';

/**
 * The combination remembered by the transcript panel's copy (design mockup transcript-copy.jsx, preference `txCopy`): the format and the same five toggles as the export “Transcript” page.
 * When nothing has been saved, it defaults to Markdown with all five toggles on; the format and toggles are both remembered, so the next time it opens it shows the last choice. It is stored separately from the export page's “header metadata” preference.
 */
export interface TranscriptCopyPrefs {
  format: 'md' | 'txt';
  frontmatter: boolean;
  chapters: boolean;
  timestamps: boolean;
  speakers: boolean;
  skipCut: boolean;
}

export const COPY_DEFAULTS: TranscriptCopyPrefs = {
  format: 'md',
  frontmatter: true,
  chapters: true,
  timestamps: true,
  speakers: true,
  skipCut: true,
};

/** Copy scope: the full text, this chapter, or this paragraph. The section before the first chapter has no chapter title to write, so it is treated as `para`. */
export type CopyScope = 'all' | 'chapter' | 'para';

/** Items listed in the summary and receipt (the UI writes them out using the export page's wording); `keepCut` means “skip cut segments” is turned off. */
export type CopyInclude = 'frontmatter' | 'chapters' | 'timestamps' | 'speakers' | 'keepCut';

/**
 * The effective toggles: the front matter is written only for Markdown; chapters are written only when the video has chapters. When only the translation is shown, the full text is laid out by the panel (the Runtime's main document does not include translations),
 * so the front matter cannot be written, and the body only has the parts left on the timeline; so front matter is off and skip cut segments is on.
 */
export function copyEffective(prefs: TranscriptCopyPrefs, env: { hasChapters: boolean; translationOnly: boolean }): TranscriptCopyPrefs {
  return {
    ...prefs,
    frontmatter: prefs.frontmatter && prefs.format === 'md' && !env.translationOnly,
    chapters: prefs.chapters && env.hasChapters,
    skipCut: prefs.skipCut || env.translationOnly,
  };
}

/**
 * The items actually included for a given scope. Excerpts (this chapter, this paragraph) do not write front matter; the body is taken from the panel and is always only the parts left on the timeline, so “includes cut segments” is not listed;
 * this paragraph does not write a chapter title.
 */
export function copyIncludes(eff: TranscriptCopyPrefs, scope: CopyScope): CopyInclude[] {
  const out: CopyInclude[] = [];
  if (scope === 'all' && eff.frontmatter) out.push('frontmatter');
  if (scope !== 'para' && eff.chapters) out.push('chapters');
  if (eff.timestamps) out.push('timestamps');
  if (eff.speakers) out.push('speakers');
  if (scope === 'all' && !eff.skipCut) out.push('keepCut');
  return out;
}

/** An excerpt copied with the settings is written the same as “copy text only”: plain text, nothing extra. The menu keeps only one item, “Copy text”. */
export function scopeIsPlain(eff: TranscriptCopyPrefs, scope: Exclude<CopyScope, 'all'>): boolean {
  return eff.format === 'txt' && copyIncludes(eff, scope).length === 0;
}

/**
 * The settings handed to `exports.renderText` for copying the full text: one per transcript in the panel (with several, each is laid out in turn and joined in the panel's order, with the front matter written only on the first),
 * and for bilingual output, paired with the translation in the same language. Byte-for-byte identical to a file exported with the same settings.
 */
export function copyAllSettings(
  eff: TranscriptCopyPrefs,
  sources: readonly { documentId: Id; translationId: Id | null }[],
): TextExportSettings[] {
  return sources.map(
    (source, n) =>
      transcriptSettings(
        {
          documentId: source.documentId,
          translationId: source.translationId,
          format: eff.format,
          timestamps: eff.timestamps,
          frontmatter: eff.frontmatter && n === 0,
          chapters: eff.chapters,
          speakers: eff.speakers,
          skipCut: eff.skipCut,
        },
        source.documentId,
        {},
      ) as TextExportSettings,
  );
}
