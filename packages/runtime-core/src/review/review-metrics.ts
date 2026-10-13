import {
  framesToSeconds,
  isVisualItem,
  itemRangeSeconds,
  sequenceDurationFrames,
  type CaptionItem,
  type Id,
  type JobRecord,
  type MetricBag,
  type Sequence,
  type TextItem,
  type Track,
  type VideoSnapshot,
} from '@cuccut/protocol';

/**
 * What a video measures (docs/cuccut/m2-review-gate.md §3.2). Pure, so the half of a review that runs on every export
 * needs no render and can be tested without an engine.
 *
 * A metric that cannot be read on this video (no captions, no hook, an unreadable caption body) is left out of the
 * bag rather than given a zero: a check against it is skipped with a reason, which is a different sentence from a
 * check that failed.
 */

/** Document kind of the derivation source of a child video (`cuccut.derivation/1`). */
export const DERIVATION_DOCUMENT_KIND = 'derivation';
const CAPTION_SCHEMA = 'cuccut.caption/1';
/** A text item starting this early counts as the hook when there is no derivation hook. */
const HOOK_WINDOW_SEC = 2;
/** Default text box centre and width (percent of the canvas), as the engine places them (`timeline::geometry`). */
const DEFAULT_X = 50;
const DEFAULT_W = 20;

/** Document bodies fetched before measuring: the drawn caption documents and the derivation document, by id. */
export type ReviewBodies = ReadonlyMap<Id, unknown> | Readonly<Record<Id, unknown>>;

function bodyOf(bodies: ReviewBodies, id: Id): unknown {
  return bodies instanceof Map ? bodies.get(id) : (bodies as Readonly<Record<Id, unknown>>)[id];
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** The visual tracks that are drawn: visible, and when a visual solo is on, only the soloed ones. */
function drawnTracks(sequence: Sequence, kind: Track['kind']): Track[] {
  const solo = sequence.tracks.some((t) => t.solo.enabled && t.solo.group === 'visual');
  return sequence.tracks.filter((t) => t.kind === kind && t.visible && (!solo || (t.solo.enabled && t.solo.group === 'visual')));
}

/** The caption items whose caption is drawn into the picture (the rule of `burnedCaptionLanguages`). */
export function drawnCaptionItems(sequence: Sequence): CaptionItem[] {
  const tracks = new Set(drawnTracks(sequence, 'subtitle').map((t) => t.id));
  return sequence.items.filter((i): i is CaptionItem => i.type === 'caption' && i.enabled && tracks.has(i.trackId));
}

/** The derivation document of a child video, if any. */
export function derivationDocumentId(snapshot: VideoSnapshot): Id | null {
  return Object.values(snapshot.documents).find((d) => d.kind === DERIVATION_DOCUMENT_KIND)?.id ?? null;
}

/** The documents `projectMetrics` needs bodies for. */
export function metricDocumentIds(snapshot: VideoSnapshot, sequenceId: Id): Id[] {
  const sequence = snapshot.sequences[sequenceId];
  const ids = new Set<Id>();
  if (sequence) for (const item of drawnCaptionItems(sequence)) ids.add(item.documentId);
  const derivation = derivationDocumentId(snapshot);
  if (derivation) ids.add(derivation);
  return [...ids].filter((id) => snapshot.documents[id]);
}

/**
 * Words in a line of text. Scripts written without spaces (CJK, kana, Thai) count a character as a word; everything
 * else counts runs between spaces.
 */
export function countWords(text: string): number {
  let count = 0;
  for (const token of text.split(/\s+/)) {
    if (!token) continue;
    const dense = token.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}]/gu)?.length ?? 0;
    const rest = token.replace(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}]/gu, ' ');
    count += dense + rest.split(/\s+/).filter((part) => /[\p{L}\p{N}]/u.test(part)).length;
  }
  return count;
}

interface CaptionCue {
  start: number;
  end: number;
  text: string;
}

/** A `cuccut.caption/1` body as cues in seconds on the document's clock; null when it is not one. */
function readCaptionBody(body: unknown): { clock: 'sequence' | 'source'; cues: CaptionCue[] } | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as { schema?: unknown; timescale?: unknown; clock?: unknown; cues?: unknown };
  if (record.schema !== CAPTION_SCHEMA || !Array.isArray(record.cues)) return null;
  const timescale = typeof record.timescale === 'number' && record.timescale > 0 ? record.timescale : 1_000_000;
  const cues: CaptionCue[] = [];
  for (const raw of record.cues) {
    if (!raw || typeof raw !== 'object') continue;
    const cue = raw as { start?: unknown; end?: unknown; text?: unknown };
    const text = typeof cue.text === 'string' ? cue.text : '';
    if (!text.trim()) continue;
    const start = (typeof cue.start === 'number' ? cue.start : 0) / timescale;
    const end = Math.max(start, (typeof cue.end === 'number' ? cue.end : 0) / timescale);
    cues.push({ start, end, text });
  }
  return { clock: record.clock === 'sequence' ? 'sequence' : 'source', cues };
}

/**
 * The words a caption item draws: its cues placed on the sequence and kept inside the item's span (the placement of
 * `ui/model/caption-cues.ts`: through each scope item's time map, the first scope item to cover a stretch takes it).
 */
function captionWords(item: CaptionItem, sequence: Sequence, body: { clock: 'sequence' | 'source'; cues: CaptionCue[] }): number {
  const spanStart = framesToSeconds(item.span.fromFrame, sequence.fps);
  const spanEnd = framesToSeconds(item.span.fromFrame + item.span.durationFrames, sequence.fps);
  let words = 0;
  const count = (start: number, end: number, text: string, from: number, to: number) => {
    if (Math.min(end, to) > Math.max(start, from) || (start === end && start >= from && start < to)) words += countWords(text);
  };
  const scope = item.scopeItemIds ?? [];
  if (scope.length === 0) {
    for (const cue of body.cues) count(cue.start, cue.end, cue.text, spanStart, spanEnd);
    return words;
  }
  const byId = new Map(sequence.items.map((i) => [i.id, i]));
  const taken: Array<[number, number]> = [];
  for (const id of scope) {
    const other = byId.get(id);
    if (!other || (other.type !== 'video' && other.type !== 'audio' && other.type !== 'composition')) continue;
    if (other.timeMap.kind !== 'linear') continue;
    const range = itemRangeSeconds(other, sequence.fps);
    const sourceIn = Number(other.timeMap.sourceIn.ticks) / other.timeMap.sourceIn.timescale;
    const rate = other.timeMap.rate.num / other.timeMap.rate.den;
    if (!(rate > 0)) continue;
    const from = Math.max(range.start, spanStart);
    const to = Math.min(range.end, spanEnd);
    if (!(to > from)) continue;
    for (const [a, b] of subtract([from, to], taken)) {
      for (const cue of body.cues) {
        if (body.clock === 'sequence') count(cue.start, cue.end, cue.text, a, b);
        else count(range.start + (cue.start - sourceIn) / rate, range.start + (cue.end - sourceIn) / rate, cue.text, a, b);
      }
    }
    taken.push([from, to]);
  }
  return words;
}

function subtract(interval: [number, number], taken: ReadonlyArray<[number, number]>): Array<[number, number]> {
  let parts = [interval];
  for (const [a, b] of taken) {
    const next: Array<[number, number]> = [];
    for (const [x, y] of parts) {
      if (b <= x || a >= y) {
        next.push([x, y]);
        continue;
      }
      if (a > x) next.push([x, a]);
      if (b < y) next.push([b, y]);
    }
    parts = next;
  }
  return parts;
}

/** The hook line: the derivation document's `hook`, else the text of a text item starting in the first 2 seconds. */
function hookText(snapshot: VideoSnapshot, sequence: Sequence, bodies: ReviewBodies, drawn: ReadonlySet<Id>): string {
  const derivation = derivationDocumentId(snapshot);
  if (derivation) {
    const body = bodyOf(bodies, derivation) as { hook?: unknown } | undefined;
    if (body && typeof body.hook === 'string' && body.hook.trim()) return body.hook.trim();
  }
  const early = sequence.items
    .filter((i): i is TextItem => i.type === 'text' && i.enabled && drawn.has(i.trackId) && !!i.text?.trim())
    .filter((i) => framesToSeconds(i.span.fromFrame, sequence.fps) < HOOK_WINDOW_SEC)
    .sort((a, b) => a.span.fromFrame - b.span.fromFrame);
  return early[0]?.text?.trim() ?? '';
}

/**
 * The project tier (§3.2) of one sequence. `bodies` holds the bodies of `metricDocumentIds` (fetched beforehand); a
 * caption body that is missing or unreadable leaves `captions.wordsPerSec` out.
 */
export function projectMetrics(snapshot: VideoSnapshot, sequenceId: Id, bodies: ReviewBodies): MetricBag {
  const sequence = snapshot.sequences[sequenceId];
  if (!sequence) return {};
  const fps = sequence.fps;
  const durationSec = framesToSeconds(sequenceDurationFrames(sequence), fps);
  const bag: MetricBag = {
    'video.durationSec': round(durationSec),
    'video.shortSidePx': Math.min(sequence.canvas.width, sequence.canvas.height),
  };

  // Main: the visual track with the lowest order. Its enabled video and image clips are the shots.
  const visualTracks = sequence.tracks.filter((t) => t.kind === 'visual').sort((a, b) => a.order - b.order);
  const main = visualTracks[0];
  const shots = main
    ? sequence.items
        .filter((i) => i.trackId === main.id && i.enabled && (i.type === 'video' || i.type === 'image'))
        .map((i) => itemRangeSeconds(i, fps))
        .sort((a, b) => a.start - b.start)
    : [];
  bag['video.shots'] = shots.length;
  if (durationSec > 0) bag['video.cutsPerMin'] = round(Math.max(0, shots.length - 1) / (durationSec / 60));
  if (shots.length) bag['video.longestShotSec'] = round(Math.max(...shots.map((s) => s.end - s.start)));

  // Blank: stretches of [0, duration] with no enabled item on a drawn visual track.
  const drawn = new Set(drawnTracks(sequence, 'visual').map((t) => t.id));
  const covered = sequence.items
    .filter((i) => isVisualItem(i) && i.enabled && drawn.has(i.trackId))
    .map((i) => itemRangeSeconds(i, fps))
    .sort((a, b) => a.start - b.start);
  let longestBlank = 0;
  let cursor = 0;
  for (const range of covered) {
    if (range.start > cursor) longestBlank = Math.max(longestBlank, range.start - cursor);
    cursor = Math.max(cursor, range.end);
  }
  if (durationSec > cursor) longestBlank = Math.max(longestBlank, durationSec - cursor);
  bag['video.longestBlankSec'] = round(longestBlank);

  // Captions drawn into the picture.
  const captions = drawnCaptionItems(sequence);
  bag['captions.on'] = captions.length > 0;
  if (captions.length && durationSec > 0) {
    let words = 0;
    let readable = true;
    for (const item of captions) {
      const body = readCaptionBody(bodyOf(bodies, item.documentId));
      if (!body) {
        readable = false;
        break;
      }
      words += captionWords(item, sequence, body);
    }
    if (readable) bag['captions.wordsPerSec'] = round(words / durationSec);
  }

  const hook = hookText(snapshot, sequence, bodies, drawn);
  bag['hook.present'] = hook.length > 0;
  if (hook) bag['hook.words'] = countWords(hook);

  bag['text.offCanvas'] = sequence.items.some((i) => {
    if (i.type !== 'text' || !i.enabled) return false;
    const x = i.place.x ?? DEFAULT_X;
    const half = ((i.place.w ?? DEFAULT_W) * (i.place.scale ?? 1)) / 2;
    return x - half < 0 || x + half > 100;
  });
  bag['items.placeholders'] = sequence.items.filter((i) => i.type === 'placeholder' && i.enabled && !i.assetRef).length;
  bag['transitions.count'] = sequence.transitions.length;
  const layered = new Set(sequence.items.filter((i) => isVisualItem(i) && i.enabled).map((i) => i.trackId));
  bag['layers.max'] = Math.max(0, visualTracks.filter((t) => layered.has(t.id)).length - 1);
  return bag;
}

/**
 * The newest completed finished-video export of a whole sequence, or null. A preview, or an export of a range or of
 * several ranges, describes a fragment, not the video that is delivered, so it is never read.
 */
export function latestVideoExport(jobs: readonly JobRecord[], videoId: Id, sequenceId: Id): JobRecord | null {
  let best: JobRecord | null = null;
  for (const job of jobs) {
    if (job.kind !== 'export' || job.state !== 'completed' || job.videoId !== videoId) continue;
    const settings = job.export?.settings;
    if (settings?.kind !== 'video' || job.export!.sequenceId !== sequenceId) continue;
    if (settings.purpose === 'preview' || settings.range || settings.ranges?.length) continue;
    if (!job.result?.outputs?.length) continue;
    const at = job.endedAt ?? job.updatedAt;
    if (!best || at > (best.endedAt ?? best.updatedAt)) best = job;
  }
  return best;
}

/** The export tier (§3.2): read from the first output of a finished-video export. Loudness is absent without normalisation. */
export function exportMetrics(job: JobRecord): MetricBag {
  const output = job.result?.outputs?.[0];
  const bag: MetricBag = {};
  if (!output) return bag;
  const media = output.media.kind === 'video' ? output.media : null;
  const validation = output.validation;
  const duration = media?.durationSec ?? validation?.durationSec;
  if (typeof duration === 'number' && Number.isFinite(duration)) bag['export.durationSec'] = round(duration);
  const width = validation?.video?.width ?? media?.width;
  const height = validation?.video?.height ?? media?.height;
  if (typeof width === 'number') bag['export.width'] = width;
  if (typeof height === 'number') bag['export.height'] = height;
  const loudness = validation?.loudness?.measured;
  if (loudness && Number.isFinite(loudness.integratedLufs)) bag['export.loudnessLufs'] = round(loudness.integratedLufs);
  if (loudness && Number.isFinite(loudness.truePeakDb)) bag['export.truePeakDb'] = round(loudness.truePeakDb);
  return bag;
}
