import type { DocumentRecord, Id } from '@cuccut/protocol';
import { derivedFrom, readSpeechWords, retextCaption, translationCues, type CueTranslationUnit } from '@cuccut/jobs';

/**
 * After an agent changes an existing translation, the caption layers generated from it update their cues to match
 * (architecture design §10.3; the same rule as editing one translated sentence in place in the editor).
 *
 * When `documents_put` / `edits_apply` writes a new revision of an existing translation (`putDocument` with `documentId`,
 * `cuccut.translation/2`), this compares it unit by unit with the current revision: for units whose translation, display
 * rewrite, status or source-sentence words changed, and units removed this time, the cues for those sentences are
 * replaced in every caption document generated from this translation (`derivedFrom`) (`retextCaption`, cutting cues by
 * sentence-level alignment, the same cutting as the editor and `captions_create`; stale and empty units have no cues);
 * other cues are untouched. The caption documents' new revisions join the same edit: one undo reverts both. Caption
 * documents already written in the same edit are left alone; when the transcript cannot be read nothing follows (the
 * operations go to the engine as is).
 */

/** Reads a document body: that revision when one is given. Throws when it cannot be read. */
export type DocumentBodyReader = (documentId: Id, revision?: string) => Promise<unknown>;

type Json = Record<string, unknown>;

const TRANSLATION_V2 = 'cuccut.translation/2';

/** Appends the caption documents that must follow to the end of `operations`; returns how many followed. */
export async function syncTranslationCaptions(
  operations: Record<string, unknown>[],
  documents: Readonly<Record<Id, DocumentRecord>>,
  readBody: DocumentBodyReader,
): Promise<number> {
  const written = new Set(operations.filter((op) => op.type === 'putDocument' && typeof op.documentId === 'string').map((op) => op.documentId));
  const added: Record<string, unknown>[] = [];
  for (const op of operations) {
    if (op.type !== 'putDocument' || op.kind !== 'translation' || typeof op.documentId !== 'string') continue;
    const record = documents[op.documentId];
    const next = unitsOf(op.body);
    if (!record || !next) continue;
    const captions = Object.values(documents).filter((d) => derivedFrom(d, record.id) && !written.has(d.id));
    if (captions.length === 0 || !record.sourceDocumentId) continue;
    const previous = unitsOf(await readBody(record.id, record.currentRevision).catch(() => null));
    if (!previous) continue;
    const before = new Map(previous.map((u) => [u.id, u]));
    const after = new Map(next.map((u) => [u.id, u]));
    const changed = next.filter((u) => !before.has(u.id) || cueKey(before.get(u.id)!) !== cueKey(u));
    const removed = previous.filter((u) => !after.has(u.id)).map((u) => u.id);
    if (changed.length === 0 && removed.length === 0) continue;
    const speechRecord = documents[record.sourceDocumentId];
    const speech = speechRecord
      ? readSpeechWords(await readBody(speechRecord.id, speechRecord.currentRevision).catch(() => null))
      : null;
    if (!speech) continue;
    for (const caption of captions) {
      const body = await readBody(caption.id, caption.currentRevision).catch(() => null);
      if (typeof body !== 'object' || body === null || Array.isArray(body)) continue;
      let cues = body as Json;
      for (const unit of changed) cues = retextCaption(cues, unit.id, translationCues(speech, [unit]), speech.speakers);
      for (const unitId of removed) cues = retextCaption(cues, unitId, [], speech.speakers);
      const summary = caption.revisions[caption.currentRevision]?.summary;
      added.push({
        type: 'putDocument',
        documentId: caption.id,
        kind: caption.kind,
        body: cues,
        summary: { ...(summary && typeof summary === 'object' ? summary : {}), cueCount: Array.isArray(cues.cues) ? cues.cues.length : 0 },
      });
      written.add(caption.id);
    }
  }
  operations.push(...added);
  return added.length;
}

/** The units of a translation body needed to cut captions; null when it is not a `/2` translation. */
function unitsOf(body: unknown): CueTranslationUnit[] | null {
  const b = body as Json | null;
  if (!b || typeof b !== 'object' || b.schema !== TRANSLATION_V2 || !Array.isArray(b.units)) return null;
  return b.units.flatMap((raw): CueTranslationUnit[] => {
    if (typeof raw !== 'object' || raw === null) return [];
    const unit = raw as Json;
    if (typeof unit.id !== 'string') return [];
    const rewrite = unit.displayRewrite as { text?: unknown } | undefined;
    const alignment = unit.alignment as { sourceWordIds?: unknown } | null | undefined;
    const ids = alignment && Array.isArray(alignment.sourceWordIds) ? alignment.sourceWordIds.filter((id) => typeof id === 'string') : null;
    return [
      {
        id: unit.id,
        naturalText: typeof unit.naturalText === 'string' ? unit.naturalText : '',
        ...(rewrite && typeof rewrite.text === 'string' ? { displayRewrite: { text: rewrite.text } } : {}),
        alignment: ids ? { sourceWordIds: ids } : null,
        status: typeof unit.status === 'string' ? unit.status : 'draft',
      },
    ];
  });
}

/** The fields that determine the cues: on-screen text, whether a caption is shown, and which words the timing comes from. */
function cueKey(unit: CueTranslationUnit): string {
  const text = (unit.displayRewrite?.text || unit.naturalText).trim();
  return JSON.stringify([text, unit.status === 'stale', unit.alignment?.sourceWordIds ?? null]);
}
