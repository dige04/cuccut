import type { Id } from '@cuccut/protocol';
import { JobsTranslationDocument as J } from '@cuccut/protocol/messages/jobs/translation-document.ts';
import { TRANSLATION_SCHEMA, translationShapeProblems, type SourceSentence, type TranslationBody, type TranslationUnit } from './translation-document.ts';

/**
 * Refreshes a translation in place (`translate` given a `translationId`, architecture design §7.9): picks the sentences to retranslate and the units to remove, and merges the sentences the Speech Worker retranslated back into the original translation.
 *
 * A sentence's translation state uses the same test as the editor (`unitState` in `packages/ui/src/model/translation-doc.ts`): a unit marked stale (`status: 'stale'`), whose source content fingerprint differs from the one at translation time, or whose translation is empty, must be retranslated. Sentences that are in the transcript but have no unit in the translation yet are also translated. Units whose source sentence is no longer in the transcript (words deleted, the first word hidden so the sentence ID changed, or a second unit for the same sentence) are removed. When no sentences are named, all of them are removed; when sentences are named, only those that share source words with the named sentences are removed.
 */

/** Work to do: the sentences to retranslate (in transcript order) and the units to remove. */
export interface RefreshPlan {
  sentences: Id[];
  removeUnitIds: Id[];
}

/** A translation body that can be read and refreshed in place (`cuccut.translation/2`, with units that have at least an ID, a sentence ID and text); otherwise null. */
export function refreshableTranslation(body: unknown): TranslationBody | null {
  const t = body as Partial<TranslationBody> | null;
  if (!t || typeof t !== 'object' || t.schema !== TRANSLATION_SCHEMA || typeof t.language !== 'string' || !Array.isArray(t.units)) return null;
  const ok = t.units.every(
    (u) => u && typeof u === 'object' && typeof u.id === 'string' && typeof u.sourceSentenceId === 'string' && typeof u.naturalText === 'string',
  );
  return ok ? (t as TranslationBody) : null;
}

const unitText = (unit: TranslationUnit) => (unit.displayRewrite?.text || unit.naturalText).trim();

/**
 * Picks the sentences to retranslate and the units to remove. `explicit` holds the sentences named in the call (retranslated even when their translation is current). Returns `{ unknown }` when a named sentence is not in the transcript.
 */
export function refreshPlan(
  translation: TranslationBody,
  sentences: readonly SourceSentence[],
  explicit: readonly Id[] | undefined,
): RefreshPlan | { unknown: Id } {
  const known = new Map(sentences.map((s) => [s.id, s]));
  const first = new Map<Id, TranslationUnit>();
  for (const unit of translation.units) if (!first.has(unit.sourceSentenceId)) first.set(unit.sourceSentenceId, unit);
  // Units whose source sentence is gone, and a second unit for the same sentence.
  const orphans = translation.units.filter((unit) => !known.has(unit.sourceSentenceId) || first.get(unit.sourceSentenceId) !== unit);

  if (explicit) {
    const unknown = explicit.find((id) => !known.has(id));
    if (unknown !== undefined) return { unknown };
    const picked = new Set(explicit);
    const words = new Set(sentences.filter((s) => picked.has(s.id)).flatMap((s) => s.wordIds));
    const removeUnitIds = orphans
      .filter((unit) => picked.has(unit.sourceSentenceId) || (unit.alignment?.sourceWordIds ?? []).some((id) => words.has(id.replace(/~\d+$/, ''))))
      .map((unit) => unit.id);
    return { sentences: sentences.filter((s) => picked.has(s.id)).map((s) => s.id), removeUnitIds };
  }
  const stale = sentences.filter((sentence) => {
    const unit = first.get(sentence.id);
    return !unit || unit.status === 'stale' || unit.sourceFingerprint !== sentence.fingerprint || unitText(unit) === '';
  });
  return { sentences: stale.map((s) => s.id), removeUnitIds: orphans.map((unit) => unit.id) };
}

/**
 * Merges the Worker's retranslated sentences back into the original translation. Original units are kept as they were, in their original order. Retranslated sentences are replaced with the Worker's units (unit IDs unchanged). Removed units are dropped. Sentences that had no unit before are inserted after the unit of the nearest preceding sentence that already has a translation (the same position where the editor's `editUnit` creates a new unit). `sourceBasis` is replaced with this run's source version; `glossaryRef` and the other units are left alone.
 *
 * Only the retranslated sentences are checked: the Worker returned them, their sentence IDs and fingerprints match the frozen sentence, they have a translation, and `textHash` matches. Returns `{ problems }` when there are problems.
 */
export function mergeRefresh(
  base: TranslationBody,
  worker: TranslationBody,
  sentences: readonly SourceSentence[],
  plan: RefreshPlan,
  speechRef: { id: Id; revision: string },
): { body: TranslationBody; changedUnitIds: Id[] } | { problems: string[] } {
  const targets = new Set(plan.sentences);
  const problems = translationShapeProblems(worker, speechRef, targets);
  const fresh = new Map<Id, TranslationUnit>();
  for (const unit of worker.units) if (targets.has(unit.sourceSentenceId) && !fresh.has(unit.sourceSentenceId)) fresh.set(unit.sourceSentenceId, unit);
  const order = new Map(sentences.map((s, i) => [s.id, i]));
  for (const id of plan.sentences) {
    const unit = fresh.get(id);
    const sentence = sentences[order.get(id) ?? -1];
    if (!unit || !sentence || unit.sourceFingerprint !== sentence.fingerprint) {
      problems.push(J.unitSentenceMismatch({ n: (order.get(id) ?? -1) + 1 }).text);
    }
  }
  if (problems.length > 0) return { problems };

  const removed = new Set(plan.removeUnitIds);
  const replaced = new Set<Id>();
  const changedUnitIds: Id[] = [];
  const units: TranslationUnit[] = [];
  for (const unit of base.units) {
    if (removed.has(unit.id)) continue;
    const next = targets.has(unit.sourceSentenceId) && !replaced.has(unit.sourceSentenceId) ? fresh.get(unit.sourceSentenceId) : undefined;
    if (next) {
      replaced.add(unit.sourceSentenceId);
      changedUnitIds.push(unit.id);
      units.push({ ...next, id: unit.id });
    } else {
      units.push(unit);
    }
  }
  const ids = new Set(units.map((u) => u.id));
  for (const id of plan.sentences) {
    if (replaced.has(id)) continue;
    const unit = { ...fresh.get(id)! };
    for (let n = 2; ids.has(unit.id); n++) unit.id = `t-${id}-${n}`;
    ids.add(unit.id);
    changedUnitIds.push(unit.id);
    // Inserted after the unit of the nearest preceding sentence that already has a translation. If there is none before it, placed first.
    let at = 0;
    for (let i = (order.get(id) ?? 0) - 1; i >= 0; i--) {
      const found = units.findIndex((u) => u.sourceSentenceId === sentences[i]!.id);
      if (found >= 0) {
        at = found + 1;
        break;
      }
    }
    units.splice(at, 0, unit);
  }
  return { body: { ...base, sourceBasis: worker.sourceBasis, units }, changedUnitIds };
}
