import type { Id } from '@cuccut/protocol';
import { JobsTranslationDocument as J } from '@cuccut/protocol/messages/jobs/translation-document.ts';
import { TRANSLATION_SCHEMA, translationShapeProblems, type SourceSentence, type TranslationBody, type TranslationUnit } from './translation-document.ts';

/**
 * 就地刷新一份译文（`translate` 给了 `translationId`，架构设计 §7.9）：挑出要重译的句子与要去掉的单元，把 Speech Worker
 * 重译的那几句并回原来的译文。
 *
 * 一句译文的状态与编辑器（`packages/ui/src/model/translation-doc.ts` 的 `unitState`）同一个判法：标了过期（`status: 'stale'`）、
 * 原句的内容指纹与翻译时的不同、译文是空的，都要重译；转写里有、译文里还没有单元的句子也要译。原句已经不在转写里的单元
 * （删了词、首词被隐藏而换了句子 ID、同一句的第二个单元）去掉：不点名时全部去掉；点名时只去掉与点名句子共用原文词的。
 */

/** 要做的事：重译的句子（按转写的句序）与去掉的单元。 */
export interface RefreshPlan {
  sentences: Id[];
  removeUnitIds: Id[];
}

/** 读得出、能就地刷新的译文正文（`cuccut.translation/2`，单元至少有 ID、句子 ID 与文本）；否则 null。 */
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
 * 挑出要重译的句子与要去掉的单元。`explicit` 是调用时点名的句子（译文新鲜的也重译）；点名了转写里没有的句子时返回
 * `{ unknown }`。
 */
export function refreshPlan(
  translation: TranslationBody,
  sentences: readonly SourceSentence[],
  explicit: readonly Id[] | undefined,
): RefreshPlan | { unknown: Id } {
  const known = new Map(sentences.map((s) => [s.id, s]));
  const first = new Map<Id, TranslationUnit>();
  for (const unit of translation.units) if (!first.has(unit.sourceSentenceId)) first.set(unit.sourceSentenceId, unit);
  // 原句不在了的单元，与同一句的第二个单元。
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
 * 把 Worker 重译的句子并回原来的译文：原来的单元按原样、原顺序保留；重译的句子换成 Worker 的单元（单元 ID 照旧）；
 * 去掉的单元拿掉；原来没有单元的句子插在前面最近一句已有译文的单元后面（与编辑器 `editUnit` 新建单元的位置相同）。
 * `sourceBasis` 换成这次的原文版本，`glossaryRef` 与别的单元不动。
 *
 * 只核对重译的那几句：Worker 交回了、句子 ID 与指纹是冻结的那一句的、有译文、`textHash` 对得上。有问题时返回 `{ problems }`。
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
    // 插在前面最近一句已有译文的单元后面；前面都没有时放在最前。
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
