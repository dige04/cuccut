import type { DocumentRecord, Id } from '@cuccut/protocol';
import { derivedFrom, readSpeechWords, retextCaption, translationCues, type CueTranslationUnit } from '@cuccut/jobs';

/**
 * 智能体改了一份已有译文之后，从它生成的字幕层跟着换字幕条（架构设计 §10.3，与编辑器就地改一句译文同一个规矩）。
 *
 * `documents_put` / `edits_apply` 给已有的译文（`putDocument` 带 `documentId`、`cuccut.translation/2`）写新版本时，这里拿它与
 * 当前版本逐个单元比：译文、显示改写、状态或原句的词变了的单元，与这次去掉的单元，在每份从这份译文生成的字幕文档里
 * （`derivedFrom`）换掉这几句的字幕条（`retextCaption`，按句级对齐切条，与编辑器、`captions_create` 同一套切法；标了过期的与
 * 空的单元没有字幕条），别的条不动。字幕文档的新版本加进同一笔编辑：撤销一次两边一起回去。同一笔里已经写了的字幕文档
 * 不动；转写读不了时不跟（照原样交给引擎）。
 */

/** 读一份文档的正文：给了版本时读那一版。读不到时抛出。 */
export type DocumentBodyReader = (documentId: Id, revision?: string) => Promise<unknown>;

type Json = Record<string, unknown>;

const TRANSLATION_V2 = 'cuccut.translation/2';

/** 在 `operations` 末尾加上要跟着换的字幕文档；返回跟着换了几份。 */
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

/** 译文正文里切字幕要用的单元；不是 `/2` 的译文时 null。 */
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

/** 决定字幕条的那几项：画面上的文字、是否出字幕、时间取自哪些词。 */
function cueKey(unit: CueTranslationUnit): string {
  const text = (unit.displayRewrite?.text || unit.naturalText).trim();
  return JSON.stringify([text, unit.status === 'stale', unit.alignment?.sourceWordIds ?? null]);
}
