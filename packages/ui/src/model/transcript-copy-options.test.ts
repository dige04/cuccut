import { describe, expect, it } from 'vitest';
import { COPY_DEFAULTS, copyAllSettings, copyEffective, copyIncludes, scopeIsPlain, type TranscriptCopyPrefs } from './transcript-copy-options.ts';

const all: TranscriptCopyPrefs = { format: 'md', frontmatter: true, chapters: true, timestamps: true, speakers: true, skipCut: false };
const bodyOnly: TranscriptCopyPrefs = { format: 'txt', frontmatter: false, chapters: false, timestamps: false, speakers: false, skipCut: true };

describe('combinations copied from the transcript panel', () => {
  it('default is Markdown with all five toggles on', () => {
    expect(COPY_DEFAULTS).toEqual({ format: 'md', frontmatter: true, chapters: true, timestamps: true, speakers: true, skipCut: true });
    const eff = copyEffective(COPY_DEFAULTS, { hasChapters: true, translationOnly: false });
    expect(copyIncludes(eff, 'all')).toEqual(['frontmatter', 'chapters', 'timestamps', 'speakers']);
    expect(scopeIsPlain(eff, 'para')).toBe(false);
  });

  it('for plain text with body only, the excerpt has a single \'copy text\' item', () => {
    const eff = copyEffective(bodyOnly, { hasChapters: true, translationOnly: false });
    expect(copyIncludes(eff, 'all')).toEqual([]);
    expect(scopeIsPlain(eff, 'chapter')).toBe(true);
    expect(scopeIsPlain(eff, 'para')).toBe(true);
    expect(scopeIsPlain({ ...eff, format: 'md' }, 'para')).toBe(false);
  });

  it('effective values: header only in Markdown, chapters require the video to have chapters; with translation only there is no header and cut segments are skipped', () => {
    expect(copyEffective({ ...all, format: 'txt' }, { hasChapters: true, translationOnly: false }).frontmatter).toBe(false);
    expect(copyEffective(all, { hasChapters: false, translationOnly: false }).chapters).toBe(false);
    const translationOnly = copyEffective(all, { hasChapters: true, translationOnly: true });
    expect([translationOnly.frontmatter, translationOnly.skipCut]).toEqual([false, true]);
  });

  it('items each range actually includes: excerpt has no header and does not list cut segments; this segment has no chapter heading', () => {
    expect(copyIncludes(all, 'all')).toEqual(['frontmatter', 'chapters', 'timestamps', 'speakers', 'keepCut']);
    expect(copyIncludes(all, 'chapter')).toEqual(['chapters', 'timestamps', 'speakers']);
    expect(copyIncludes(all, 'para')).toEqual(['timestamps', 'speakers']);
    // In this plain-text section only chapters are turned on: the output is the same as text only.
    expect(scopeIsPlain({ ...bodyOnly, chapters: true }, 'para')).toBe(true);
    expect(scopeIsPlain({ ...bodyOnly, chapters: true }, 'chapter')).toBe(false);
  });

  it('full-text settings passed to the Runtime: one per transcription, paired with its translation; the header is written only on the first one', () => {
    const settings = copyAllSettings(all, [
      { documentId: 'doc_a', translationId: 'doc_t' },
      { documentId: 'doc_b', translationId: null },
    ]);
    expect(settings).toEqual([
      {
        kind: 'transcript',
        format: 'md',
        documentId: 'doc_a',
        bilingual: { documentId: 'doc_t' },
        timestamps: true,
        frontmatter: true,
        chapters: true,
        skipCut: false,
      },
      { kind: 'transcript', format: 'md', documentId: 'doc_b', timestamps: true, chapters: true, skipCut: false },
    ]);
  });
});
