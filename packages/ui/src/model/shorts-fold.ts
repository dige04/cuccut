import type { EditOperation, Id, Sequence } from '@cuccut/protocol';
import { sentenceEnd } from './speech-cues.ts';
import { itemFrames } from './editor.ts';
import { paragraphText } from './transcript-text.ts';
import {
  assetRate,
  cutsWithin,
  decimalSeconds,
  mediaSpans,
  type MediaSpan,
  type RestorePlan,
  type SourceRange,
  type TrackedCut,
  type TranscriptParagraph,
  type TranscriptWord,
} from './transcript-cut.ts';

/**
 * 子视频文稿里片段外的话（产品设计 §5.10，原型 model-shorts-cut.js `foldRows` / `reclaimSpan`）：子视频复制了父视频的整份文稿，
 * 片段之外的部分是剪口剪掉的，在文稿里划掉。片段两端各留 `FOLD_NEAR` 句划掉的、点一下就从那一句到片段边缘放回这一支；
 * 再远的收成一行剪缝「前面 / 后面 X 已剪掉 · 展开」，一次铺出靠近片段的 `FOLD_STEP` 句。剪缝没有整条恢复：
 * 整条放回就等于把这一支变回整部原片，要放回哪句点哪句。只管两端；片段中间用户自己剪的口照普通剪口画。
 * 单位是句（按句末标点与段落切开），不是段：被切开的段只画露出来的那几句。
 */

export const FOLD_NEAR = 3;
export const FOLD_STEP = 10;

/** 一句：在 `words`（文稿次序）里的下标区间 `[from, to)` 与素材时钟上的起止。 */
interface Unit {
  from: number;
  to: number;
  start: number;
  end: number;
}

export type FoldSide = 'before' | 'after';

/** 一条剪缝：还收着几句（`count`）、多长（素材秒）、已经铺出几句、下一批铺几句。 */
export interface ShortsFold {
  side: FoldSide;
  /** 片段这一侧划掉的总句数（不含两端常露的 `FOLD_NEAR` 句）。 */
  total: number;
  /** 还收着的句数。 */
  count: number;
  /** 收着的那截在素材时钟上的长度（秒）；都铺开了时是整截的长度。 */
  seconds: number;
  /** 已经铺出的句数（展开过的）。 */
  shown: number;
  /** 下一批铺几句。 */
  next: number;
}

export interface FoldPlan {
  /** 收起来不画的词（`TranscriptWord.index`）。 */
  hidden: ReadonlySet<number>;
  before: ShortsFold | null;
  after: ShortsFold | null;
  /** 第一个、最后一个还在时间线上的词在 `words` 里的位置。 */
  firstKept: number;
  lastKept: number;
  /** 片段外每个词所在那一句（`words` 里的位置 → 句）。 */
  units: Unit[];
  unitOf: Int32Array;
}

/** 把词按句切开：段落边界与句末标点处断。 */
function sentenceUnits(paragraphs: readonly TranscriptParagraph[], position: ReadonlyMap<number, number>): Unit[] {
  const units: Unit[] = [];
  for (const paragraph of paragraphs) {
    let from = -1;
    for (const word of paragraph.words) {
      const at = position.get(word.index) ?? -1;
      if (at < 0) continue;
      if (from < 0) from = at;
      if (sentenceEnd(word.text.trim())) {
        units.push({ from, to: at + 1, start: 0, end: 0 });
        from = -1;
      }
    }
    const last = paragraph.words.at(-1);
    const lastAt = last ? (position.get(last.index) ?? -1) : -1;
    if (from >= 0 && lastAt >= from) units.push({ from, to: lastAt + 1, start: 0, end: 0 });
  }
  return units;
}

/**
 * 片段外的折叠：`shown` 是两侧已经铺出的句数。没有留在时间线上的词（整支都剪光了）时 null——那时不折，照普通剪口画。
 * `words` 是文稿的词（素材次序，与 `paragraphs` 里的同一批）。
 */
export function foldOutside(
  words: readonly TranscriptWord[],
  paragraphs: readonly TranscriptParagraph[],
  shown: { before: number; after: number },
  options: { near?: number; step?: number } = {},
): FoldPlan | null {
  const near = options.near ?? FOLD_NEAR;
  const step = options.step ?? FOLD_STEP;
  let firstKept = -1;
  let lastKept = -1;
  words.forEach((w, i) => {
    if (w.state === 'cut') return;
    if (firstKept < 0) firstKept = i;
    lastKept = i;
  });
  if (firstKept < 0) return null;
  const position = new Map(words.map((w, i) => [w.index, i]));
  const units = sentenceUnits(paragraphs, position);
  for (const unit of units) {
    unit.start = words[unit.from]!.start;
    unit.end = words[unit.to - 1]!.end;
  }
  const unitOf = new Int32Array(words.length).fill(-1);
  units.forEach((unit, n) => {
    for (let i = unit.from; i < unit.to; i++) unitOf[i] = n;
  });
  // 两端片段外的句：整句都在第一个留下的词之前 / 最后一个之后。
  const head = units.filter((u) => u.to <= firstKept);
  const tail = units.filter((u) => u.from > lastKept);
  const hidden = new Set<number>();
  const side = (run: Unit[], which: FoldSide): ShortsFold | null => {
    // 靠近片段的在前：前面那截倒过来数。
    const near2far = which === 'before' ? [...run].reverse() : run;
    const far = near2far.slice(near);
    if (!far.length) return null;
    const open = Math.max(0, Math.min(shown[which], far.length));
    const rest = far.slice(open);
    for (const unit of rest) for (let i = unit.from; i < unit.to; i++) hidden.add(words[i]!.index);
    const span = rest.length ? rest : far;
    const lo = Math.min(...span.map((u) => u.start));
    const hi = Math.max(...span.map((u) => u.end));
    return { side: which, total: far.length, count: rest.length, seconds: Math.max(0, hi - lo), shown: open, next: Math.min(step, rest.length) };
  };
  const before = side(head, 'before');
  const after = side(tail, 'after');
  return { hidden, before, after, firstKept, lastKept, units, unitOf };
}

/**
 * 这一支开头那一句（剪成短视频结果页卡片上的「开头」，派生时没给 `hook` 时）：第一个留在时间线上的词所在的那一句里、
 * 从它起留下的词。整支剪光了时 null。
 */
export function openingSentence(words: readonly TranscriptWord[], paragraphs: readonly TranscriptParagraph[]): string | null {
  const plan = foldOutside(words, paragraphs, { before: 0, after: 0 });
  if (!plan) return null;
  const n = plan.unitOf[plan.firstKept] ?? -1;
  const unit = n >= 0 ? plan.units[n] : undefined;
  const text = paragraphText(words.slice(plan.firstKept, unit ? unit.to : plan.firstKept + 1)).text;
  return text || null;
}

/** 去掉收起来的词之后的段落：整段收起的不要，切开的段只留露出来的词（段首换成第一个露出来的词）。没有收起来的词时原样返回。 */
export function visibleParagraphs(paragraphs: readonly TranscriptParagraph[], hidden: ReadonlySet<number>): readonly TranscriptParagraph[] {
  if (!hidden.size) return paragraphs;
  const out: TranscriptParagraph[] = [];
  for (const paragraph of paragraphs) {
    if (!paragraph.words.some((w) => hidden.has(w.index))) {
      out.push(paragraph);
      continue;
    }
    const words = paragraph.words.filter((w) => !hidden.has(w.index));
    if (!words.length) continue;
    out.push({ ...paragraph, key: words[0]!.id, words });
  }
  return out;
}

/** 要放回的素材区间与它在片段的哪一侧。 */
export interface ReclaimRange extends SourceRange {
  side: FoldSide;
}

/**
 * 点了片段外划掉的一个词：要放回的素材区间——在片段前面是 `[那一句起, 第一个留下的词起)`，在后面是 `[最后一个留下的词止, 那一句止)`。
 * 靠片段那一头最终按剪口的边放（`reclaimOperations`），片段保持连着、不留洞。词不在两端片段外（片段中间用户剪的口）时 null。
 * `position` 是这个词在 `words` 里的位置。
 */
export function reclaimRange(words: readonly TranscriptWord[], plan: FoldPlan, position: number): ReclaimRange | null {
  const word = words[position];
  if (!word || word.state !== 'cut') return null;
  const unit = plan.units[plan.unitOf[position] ?? -1];
  if (position < plan.firstKept) {
    const from = unit ? unit.start : word.start;
    const to = words[plan.firstKept]!.start;
    return to > from ? { from, to, side: 'before' } : null;
  }
  if (position > plan.lastKept) {
    const from = words[plan.lastKept]!.end;
    const to = unit ? unit.end : word.end;
    return to > from ? { from, to, side: 'after' } : null;
  }
  return null;
}

/** 比这短的剩余不再剪回去（帧内的零头）。 */
const MIN_LEFT = 0.01;
const EPS = 1e-6;

/**
 * 剪口靠片段那一头接着的实例（同引擎 `insertions` 的判断：源时刻与剪口边界差不超过一帧）：片段后面是源终点对着剪口起点的，
 * 前面是源起点对着剪口终点的。同一轨道上另一边也接着实例（片段中间的剪口）的不算。
 */
function edgeSpans(sequence: Sequence, assetId: Id, cut: TrackedCut, side: FoldSide): MediaSpan[] {
  const frame = sequence.fps.den / sequence.fps.num;
  const near = (a: number, b: number, rate: number) => Math.abs(a - b) <= frame * rate + EPS;
  const spans = mediaSpans(sequence, assetId);
  const joined = (left: MediaSpan, right: MediaSpan) =>
    left.item.trackId === right.item.trackId &&
    Math.abs(right.start - left.end) <= EPS &&
    near(left.sourceOut, cut.from, left.rate) &&
    near(right.sourceIn, cut.to, right.rate);
  return side === 'after'
    ? spans.filter((s) => near(s.sourceOut, cut.from, s.rate) && !spans.some((r) => joined(s, r)))
    : spans.filter((s) => near(s.sourceIn, cut.to, s.rate) && !spans.some((l) => joined(l, s)));
}

/**
 * 放回之后字幕跟着接上（`addCuts` 剪掉时经过剪口的字幕缩短，这里是它的镜像）：经接缝那个实例投影、边正好在接缝上的字幕实例
 * 跨过放回的那段延长。引擎插回时只延长跨过插回点的实例，边正好落在片段首尾的会被推开（前面）或不动（后面），所以补 `trimItem`。
 * 某条字幕轨上没有字幕实例碰到接缝时，延长那条轨上离接缝最近的、经这个实例投影的字幕实例；有跨过接缝的交给引擎。
 * 返回各字幕实例要拉的边与帧：后面那一侧拉到放回之后、剪回之前的片段终点，紧跟着剪回远端时引擎把它和片段一起缩回
 * （`follow_removal` 把终点拉回剪口起点）；前面那一侧剪回之后片段起点不动，拉回片段起点。
 */
function captionTrims(
  sequence: Sequence,
  seam: MediaSpan,
  side: FoldSide,
  frames: number,
): Array<{ itemId: Id; edge: 'start' | 'end'; frame: number }> {
  const at = side === 'after' ? seam.end : seam.start;
  const byTrack = new Map<Id, Array<{ id: Id; start: number; end: number }>>();
  for (const item of sequence.items) {
    if (item.type !== 'caption' || !(item.scopeItemIds ?? []).includes(seam.item.id)) continue;
    const { start, end } = itemFrames(item, sequence.fps);
    const list = byTrack.get(item.trackId) ?? [];
    list.push({ id: item.id, start, end });
    byTrack.set(item.trackId, list);
  }
  const out: Array<{ itemId: Id; edge: 'start' | 'end'; frame: number }> = [];
  const edge = side === 'after' ? 'end' : 'start';
  const target = side === 'after' ? Math.round(at) + frames : Math.round(at);
  for (const captions of byTrack.values()) {
    const touching = captions.filter((c) => Math.abs((side === 'after' ? c.end : c.start) - at) < 0.5);
    if (touching.length) {
      for (const c of touching) out.push({ itemId: c.id, edge, frame: target });
      continue;
    }
    if (captions.some((c) => c.start < at - EPS && c.end > at + EPS)) continue;
    const nearest =
      side === 'after'
        ? captions.filter((c) => c.end <= at).sort((a, b) => b.end - a.end)[0]
        : captions.filter((c) => c.start >= at).sort((a, b) => a.start - b.start)[0];
    if (nearest) out.push({ itemId: nearest.id, edge, frame: target });
  }
  return out;
}

/**
 * 放回素材区间 `range` → 一笔事务：盖住它的剪口整个放回（`restoreCut`），剪口超出 `range` 的远端再 `addCuts` 剪回去
 * （同拖剪口带改范围，model/cut-bands.ts `retimeOperations`；引擎按次序执行，后一步读到前一步写下的剪口集合）。
 * 靠片段那一头不剪回：从片段边一直放回到 `range` 的远端，中间的停顿与被剪口切开的半个词一起回来，放回的那段接在原来的
 * 实例上、还是一个实例。字幕跟着延长（`captionTrims`）。`range` 没给 `side` 时两头都按 `range` 剪回。
 * 没有剪口盖住时照实拒绝（`untracked`）。`seconds` 是放回多少秒（序列时间）。
 */
export function reclaimOperations(
  sequence: Sequence,
  assetId: Id,
  cuts: readonly TrackedCut[],
  range: SourceRange & { side?: FoldSide },
): RestorePlan {
  const found = cutsWithin(cuts, [range]);
  if (!found.length) return { ok: false, reason: 'untracked' };
  const rate = assetRate(sequence, assetId);
  const perSecond = sequence.fps.num / sequence.fps.den;
  const operations: EditOperation[] = found.map((cut) => ({ type: 'restoreCut', sequenceId: sequence.id, assetId, cutId: cut.id }));
  const again: Array<{ from: string; to: string }> = [];
  const tails: EditOperation[] = [];
  const heads: EditOperation[] = [];
  let seconds = 0;
  for (const cut of found) {
    // 片段那一头接到剪口的边：不在片段边与 `range` 之间留一截剪口。
    const from = range.side === 'after' ? Math.min(range.from, cut.from) : range.from;
    const to = range.side === 'before' ? Math.max(range.to, cut.to) : range.to;
    if (from - cut.from >= MIN_LEFT) again.push({ from: decimalSeconds(cut.from), to: decimalSeconds(from) });
    if (cut.to - to >= MIN_LEFT) again.push({ from: decimalSeconds(to), to: decimalSeconds(cut.to) });
    seconds += Math.max(0, Math.min(cut.to, to) - Math.max(cut.from, from)) / rate;
    if (!range.side) continue;
    for (const seam of edgeSpans(sequence, assetId, cut, range.side)) {
      // 引擎在接缝处放回的帧数（`insertions`：只有一边时按源区间除以速率向下取整）。
      const frames = Math.floor(((range.side === 'after' ? cut.to - seam.sourceOut : seam.sourceIn - cut.from) / seam.rate) * perSecond + EPS);
      if (frames <= 0) continue;
      for (const trim of captionTrims(sequence, seam, range.side, frames)) {
        if ([...tails, ...heads].some((op) => op.type === 'trimItem' && op.itemId === trim.itemId && op.edge === trim.edge)) continue;
        (range.side === 'after' ? tails : heads).push({
          type: 'trimItem',
          sequenceId: sequence.id,
          itemId: trim.itemId,
          edge: trim.edge,
          at: { unit: 'frames', value: trim.frame },
          alignment: 'exact-frame',
        });
      }
    }
  }
  // 后面那一侧：字幕先拉到放回之后的终点，再剪回远端时跟着落回片段终点；前面那一侧：剪回之后片段起点不动，字幕起点拉回去。
  operations.push(...tails);
  if (again.length) operations.push({ type: 'addCuts', sequenceId: sequence.id, assetId, cuts: again });
  operations.push(...heads);
  return { ok: true, operations, cutIds: found.map((cut) => cut.id), seconds };
}
