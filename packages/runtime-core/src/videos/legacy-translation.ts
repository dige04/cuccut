import type { Id } from '@cuccut/protocol';
import { EditorWasmUnavailable, TRANSLATION_SCHEMA, sha256Hex, sourceSentences, type SourceSentence } from '@cuccut/jobs';

/**
 * 旧项目导入的译文 `cuccut.translation/1` 换成 `cuccut.translation/2`（视频格式规范 §5.3）。`/1` 的单元按旧项目的句子 ID
 * 记译文（`{ id, text, display?, source?, alignment? }`），旧的指纹与对齐块不能换算；这里只取译句本身，按转写现在的句子
 * （字幕与翻译核心的规则，经 editor-wasm，与翻译流程、`documents_read` 的 `translationBasis` 同一套）重新挂上去，
 * 对齐写成句级（`correspondence: 'sentence'`），与「源文稿换版本时的结转」降级的写法相同。
 *
 * - 旧句的词：转写正文里存下的同 ID 句子（`first`/`last` 或 `wordIds`），没有时取单元的 `source.first`/`source.last`，
 *   再没有时取规则句子里同 ID 的那一句。都没有的单元换不过去。
 * - 配对按词：旧句与新句共有的词不少于两者中较短那句的一半才算候选，先配共有词最多的一对，一旧句只配一新句（与结转按时间
 *   重叠贪心配对同一个办法，这里同一份转写、词 ID 不变，直接按词比）。
 * - 词完全相同的：`draft`（译文照用）；配上但词不同的：译文留着给人参考，`status: 'stale'`；没配上的旧句不带过去，新句没有
 *   旧译文的不写单元。`display`（字幕显示用的改写）不带：旧项目没有记下改写依据的自然译句指纹，带过去也按过期处理。
 *
 * 派生子视频（`videos.derive`）用它把父视频的旧译文复制成子视频能建字幕层的译文；别处要升级旧译文时同样用它。
 */

export interface LegacyTranslationUpgrade {
  body: {
    schema: typeof TRANSLATION_SCHEMA;
    language: string;
    sourceBasis: { speechRef: { id: Id; revision: string }; sequenceId: Id; scopeLineage: Id[]; editViewHash: string };
    units: Record<string, unknown>[];
  };
  /** 词完全对上、照用的单元。 */
  kept: number;
  /** 配上了但句子的词变了、标为过期的单元。 */
  stale: number;
  /** 找不到对应句子、没带过去的旧单元。 */
  dropped: number;
}

export const LEGACY_TRANSLATION_SCHEMA = 'cuccut.translation/1';

type Json = Record<string, unknown>;

export function isLegacyTranslation(body: unknown): boolean {
  const b = body as Json | null;
  return !!b && typeof b === 'object' && b.schema === LEGACY_TRANSLATION_SCHEMA && Array.isArray(b.units);
}

/**
 * 换算一份 `/1` 译文。`speech` 是它译自的转写正文；`language` 是译文的语言（文档记录的 `language`）；`basis` 是新正文
 * `sourceBasis` 的转写版本与序列。换不了（不是 `/1`、没有语言、转写读不出句子、editor-wasm 没有构建、一个单元都挂不上）时 null。
 */
export function upgradeLegacyTranslation(
  body: unknown,
  speech: unknown,
  language: string | null | undefined,
  basis: { speechRef: { id: Id; revision: string }; sequenceId: Id },
): LegacyTranslationUpgrade | null {
  if (!isLegacyTranslation(body) || !language) return null;
  let read: ReturnType<typeof sourceSentences>;
  try {
    read = sourceSentences(speech);
  } catch (error) {
    if (error instanceof EditorWasmUnavailable) return null;
    throw error;
  }
  if ('problem' in read) return null;
  const sentences = read.sentences;
  const words = speechWordIds(speech);
  const position = new Map(words.map((id, i) => [id, i]));
  const stored = storedSentences(speech, words, position);
  const ruleById = new Map(sentences.map((s) => [s.id, s]));

  const legacy: { text: string; words: Set<string> }[] = [];
  let dropped = 0;
  for (const raw of (body as { units: unknown[] }).units) {
    const unit = raw as Json | null;
    const text = typeof unit?.text === 'string' ? unit.text.trim() : '';
    const id = typeof unit?.id === 'string' ? unit.id : '';
    const ids = text ? (stored.get(id) ?? sourceRange(unit?.source, words, position) ?? ruleById.get(id)?.wordIds ?? null) : null;
    if (!ids?.length) {
      dropped++;
      continue;
    }
    legacy.push({ text, words: new Set(ids) });
  }

  // 按共有的词贪心配对：一旧句只配一新句。
  const candidates: { i: number; j: number; shared: number }[] = [];
  const sentenceOf = new Map<string, number>();
  sentences.forEach((s, j) => s.wordIds.forEach((w) => sentenceOf.set(w, j)));
  legacy.forEach((old, i) => {
    const shared = new Map<number, number>();
    for (const w of old.words) {
      const j = sentenceOf.get(w);
      if (j !== undefined) shared.set(j, (shared.get(j) ?? 0) + 1);
    }
    for (const [j, n] of shared) {
      if (n * 2 >= Math.min(old.words.size, sentences[j]!.wordIds.length)) candidates.push({ i, j, shared: n });
    }
  });
  candidates.sort((x, y) => y.shared - x.shared || x.i - y.i || x.j - y.j);
  const pairs = new Map<number, number>();
  const usedOld = new Set<number>();
  for (const c of candidates) {
    if (usedOld.has(c.i) || pairs.has(c.j)) continue;
    usedOld.add(c.i);
    pairs.set(c.j, c.i);
  }
  dropped += legacy.length - usedOld.size;

  let kept = 0;
  let stale = 0;
  const units: Json[] = [];
  sentences.forEach((sentence: SourceSentence, j) => {
    const i = pairs.get(j);
    if (i === undefined) return;
    const old = legacy[i]!;
    const same = sameSentence(old.words, position, sentence);
    if (same) kept++;
    else stale++;
    units.push({
      id: `t-${sentence.id}`,
      sourceSentenceId: sentence.id,
      sourceFingerprint: sentence.fingerprint,
      naturalText: old.text,
      alignment: {
        basis: 'natural',
        correspondence: 'sentence',
        blocks: [],
        sourceWordIds: [...sentence.wordIds],
        textHash: `sha256:${sha256Hex(old.text)}`,
      },
      status: same ? 'draft' : 'stale',
    });
  });
  if (!units.length) return null;
  return {
    body: {
      schema: TRANSLATION_SCHEMA,
      language,
      sourceBasis: { speechRef: basis.speechRef, sequenceId: basis.sequenceId, scopeLineage: [], editViewHash: read.editViewHash },
      units,
    },
    kept,
    stale,
    dropped,
  };
}

/** 转写的词 ID，按词序。 */
function speechWordIds(speech: unknown): string[] {
  const list = (speech as { words?: unknown } | null)?.words;
  return Array.isArray(list) ? list.map((w) => String((w as { id?: unknown })?.id ?? '')) : [];
}

/** 正文里存下的句子：ID → 词（`first`/`last` 是词序上的闭区间，或直接给 `wordIds`）。 */
function storedSentences(speech: unknown, words: string[], position: ReadonlyMap<string, number>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const list = (speech as { sentences?: unknown } | null)?.sentences;
  if (!Array.isArray(list)) return out;
  for (const raw of list) {
    const s = raw as Json | null;
    if (!s || typeof s.id !== 'string') continue;
    const ids = Array.isArray(s.wordIds) ? s.wordIds.map(String) : sourceRange(s, words, position);
    if (ids?.length) out.set(s.id, ids);
  }
  return out;
}

/** `{ first, last }` → 词序上的那一段；找不到时 null。 */
function sourceRange(value: unknown, words: string[], position: ReadonlyMap<string, number>): string[] | null {
  const r = value as { first?: unknown; last?: unknown } | null;
  if (!r || typeof r.first !== 'string') return null;
  const a = position.get(r.first) ?? -1;
  const b = typeof r.last === 'string' ? (position.get(r.last) ?? -1) : a;
  return a >= 0 && b >= a ? words.slice(a, b + 1) : null;
}

/** 旧句与这一句是同一句：这一句的词旧句都有，旧句也没有落在这一句首词到末词之外的词（其间隐藏的词不算差别）。 */
function sameSentence(old: Set<string>, position: ReadonlyMap<string, number>, sentence: SourceSentence): boolean {
  if (!sentence.wordIds.every((w) => old.has(w))) return false;
  const first = position.get(sentence.wordIds[0]!) ?? -1;
  const last = position.get(sentence.wordIds[sentence.wordIds.length - 1]!) ?? -1;
  return [...old].every((id) => {
    const index = position.get(id) ?? -1;
    return index >= first && index <= last;
  });
}
