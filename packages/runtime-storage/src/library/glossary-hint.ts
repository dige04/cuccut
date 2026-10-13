import type { TranscriptionGlossary } from '@cuccut/protocol';

/** Upper limit for the recognition hint, same as `hint` of `models.transcribe`. */
export const TRANSCRIBE_HINT_MAX_CHARS = 1200;

/**
 * Appends the canonical forms of the recognition glossary after the user's hint (architecture design §5.9). Terms follow the glossary order, are de-duplicated, and are joined with 「、」(enumeration comma). The whole must not exceed the limit. Terms that do not fit are dropped and counted. The user's hint comes first, unchanged and never truncated.
 */
export function composeTranscribeHint(
  userHint: string | undefined,
  glossaries: readonly TranscriptionGlossary[],
  max = TRANSCRIBE_HINT_MAX_CHARS,
): { hint: string | undefined; terms: number; dropped: number } {
  const seen = new Set<string>();
  const canonical: string[] = [];
  for (const g of glossaries) {
    for (const t of g.terms) {
      if (seen.has(t.canonical)) continue;
      seen.add(t.canonical);
      canonical.push(t.canonical);
    }
  }
  const base = userHint?.trim() ?? '';
  let hint = base;
  let terms = 0;
  for (const term of canonical) {
    // i18n-ignore: prompt text for the transcription model, separated by the usual convention for the terms' source text, does not change with the UI language
    const next = hint ? (terms === 0 ? `${hint}\n${term}` : `${hint}、${term}`) : term;
    if ([...next].length > max) break;
    hint = next;
    terms++;
  }
  return { hint: hint || undefined, terms, dropped: canonical.length - terms };
}
