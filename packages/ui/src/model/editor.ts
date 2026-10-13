import {
  defineMessages,
  framesToSeconds,
  itemRangeSeconds,
  sequenceDurationFrames,
  type AssetRecord,
  type DocumentRecord,
  type Id,
  type VideoSnapshot,
  type Rate,
  type Sequence,
  type SequenceItem,
  type Track,
  type VersionRef,
} from '@cuccut/protocol';
import { transitionReach } from './transitions.ts';
import { zhHans } from './editor.zh-Hans.ts';
import { zhHant } from './editor.zh-Hant.ts';
import { ja } from './editor.ja.ts';
import { ko } from './editor.ko.ts';
import { es } from './editor.es.ts';
import { fr } from './editor.fr.ts';
import { de } from './editor.de.ts';
import { nl } from './editor.nl.ts';
import { ptBR } from './editor.pt-BR.ts';
import { it } from './editor.it.ts';
import { ru } from './editor.ru.ts';
import { pl } from './editor.pl.ts';
import { tr } from './editor.tr.ts';
import { vi } from './editor.vi.ts';

type ElementName = 'sticker' | 'placeholder' | 'whiteboard' | 'progress' | 'visualizer' | 'confetti' | 'draw';

/** Editor model copy (English is the source of keys and types; translations are in `editor.zh-Hans.ts`). */
const en = {
  trackKind: { visual: 'Visual', audio: 'Audio', subtitle: 'Subtitles' } as Record<Track['kind'], string>,
  counter: 'Counter',
  text: 'Text',
  shape: 'Shape',
  composition: 'Composition',
  caption: 'Subtitles',
  asset: 'Asset',
  elements: {
    sticker: 'Sticker',
    placeholder: 'Placeholder',
    whiteboard: 'Whiteboard',
    progress: 'Progress bar',
    visualizer: 'Waveform',
    confetti: 'Confetti',
    draw: 'Drawing',
  } as Record<ElementName, string>,
  seconds: (value: string) => `${value} sec`,
};
export type EditorMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * The editor's pure model: timeline geometry, hit testing and snapping. What the preview draws at a given moment is decided by the Rust frame plan (`render/`).
 * Seconds here are used only for display and hit testing; times sent to the engine are frames (dragging, splitting) or decimal second strings (input boxes), see product design §5.8.
 */

export interface TrackRow {
  track: Track;
  /** Row header label: the category (visual, audio, subtitles). A named track appends “ · name”. Unnamed tracks of the same category, when there is more than one, are numbered in order. */
  label: string;
}


/** Codes the video engine gives default tracks, such as “V1” and “A1”, do not count as names; the row header shows only the category. */
const TRACK_CODE = /^[VAS]\d+$/;

function labelled(tracks: Track[]): TrackRow[] {
  return tracks.map((track, i) => {
    const kind = M.trackKind[track.kind];
    const name = track.name && !TRACK_CODE.test(track.name) ? track.name : null;
    const label = name ? `${kind} · ${name}` : tracks.length > 1 ? `${kind} ${i + 1}` : kind;
    return { track, label };
  });
}

/** Stacking group: visual and subtitle tracks share one stack (rendering sorts them uniformly by `order`); audio forms its own stack. */
export type StackingGroup = 'picture' | 'sound';

export function stackingGroup(kind: Track['kind']): StackingGroup {
  return kind === 'audio' ? 'sound' : 'picture';
}

/**
 * Track rows on the timeline: visual and subtitle tracks share one stack, sorted by `order` from high to low (rows above cover rows below, matching the visual stacking;
 * subtitles are not automatically placed on top). Audio tracks come below. Numbering is counted separately for each kind.
 */
export function trackRows(sequence: Sequence): TrackRow[] {
  const byOrder = [...sequence.tracks].sort((a, b) => a.order - b.order);
  const subtitle = labelled(byOrder.filter((t) => t.kind === 'subtitle'));
  const visual = labelled(byOrder.filter((t) => t.kind === 'visual'));
  const audio = labelled(byOrder.filter((t) => t.kind === 'audio'));
  const picture = [...subtitle, ...visual].sort((a, b) => b.track.order - a.track.order);
  return [...picture, ...audio];
}

/**
 * Rows drawn on the timeline: a video carries its own sound, so its original audio is drawn in the video row. The audio track the engine creates by default for each video stays empty until audio is placed into it, so it gets no separate row.
 * An audio track with no name (or only a code such as A1) and no instances is not drawn; a named one is drawn (created by the user or for dubbing). Audio dropped in still lands on it
 * (`placeAsset`; when dropped onto another row, the engine picks the first audio track), and the row appears once something is placed in it. Row header names are the same as `trackRows`.
 */
export function timelineRows(sequence: Sequence): TrackRow[] {
  const used = new Set(sequence.items.map((item) => item.trackId));
  return trackRows(sequence).filter(
    ({ track }) => track.kind !== 'audio' || used.has(track.id) || (!!track.name && !TRACK_CODE.test(track.name)),
  );
}

export function rootSequence(video: VideoSnapshot): Sequence | null {
  return video.sequences[video.rootSequenceId] ?? null;
}

/** The instance's range on the sequence (in frames; audio may have a fractional part). */
export function itemFrames(item: SequenceItem, fps: Rate): { start: number; end: number } {
  if (item.type === 'audio') {
    const { start, end } = itemRangeSeconds(item, fps);
    return { start: (start * fps.num) / fps.den, end: (end * fps.num) / fps.den };
  }
  return { start: item.span.fromFrame, end: item.span.fromFrame + item.span.durationFrames };
}

export function durationSeconds(sequence: Sequence): number {
  return framesToSeconds(sequenceDurationFrames(sequence), sequence.fps);
}

/**
 * Three states of the transport play button: while playing it is pause; when stopped and the playhead has reached the end (within 0.05 seconds) it is replay; otherwise it is play (prototype model-player.js `playButtonState`).
 * An empty timeline (duration 0) has no end to speak of, so it shows play.
 */
export type PlayButtonState = 'play' | 'pause' | 'replay';

export function playButtonState(state: { playing: boolean; playhead: number; duration: number }): PlayButtonState {
  const { playing, playhead, duration } = state;
  if (playing) return 'pause';
  if (!(duration > 0)) return 'play';
  return playhead >= duration - 0.05 ? 'replay' : 'play';
}

/** The frame a second falls in (rounded down, the frame's start). */
export function frameAt(seconds: number, fps: Rate): number {
  return Math.max(0, Math.floor((seconds * fps.num) / fps.den + 1e-6));
}

export function nearestFrame(seconds: number, fps: Rate): number {
  return Math.max(0, Math.round((seconds * fps.num) / fps.den));
}

/**
 * How many elements the preview needs for each video asset: the maximum number of enabled instances that use it on the same frame.
 * When the same asset appears on two tracks, or is stacked, each one must seek to a different source time.
 * Besides video instances, composition instances with pre-rendered stand-ins also use video assets: the frame plan gives them as a video layer, and the asset is the stand-in.
 * Instances on both sides of a transition are also drawn outside their own range (when two split pieces cross-dissolve, the same asset needs two source times at once), so the range is widened to the transition window.
 */
export function videoSlots(sequence: Sequence): { asset: VersionRef; count: number }[] {
  const spans = new Map<string, { asset: VersionRef; edges: [number, number][] }>();
  const reach = transitionReach(sequence);
  for (const item of sequence.items) {
    if ((item.type !== 'video' && item.type !== 'composition') || !item.enabled) continue;
    const asset = item.type === 'video' ? item.assetRef : item.prerender;
    if (!asset) continue;
    const key = `${asset.id}:${asset.revision}`;
    const entry = spans.get(key) ?? { asset, edges: [] };
    const [from, to] = reach.get(item.id) ?? [item.span.fromFrame, item.span.fromFrame + item.span.durationFrames];
    entry.edges.push([from, 1], [to, -1]);
    spans.set(key, entry);
  }
  return [...spans.values()].map(({ asset, edges }) => {
    // On the same frame, the one that ends goes before the one that starts: two back-to-back segments share one element.
    edges.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    let open = 0;
    let count = 0;
    for (const [, delta] of edges) count = Math.max(count, (open += delta));
    return { asset, count };
  });
}

/** Snapping: finds the nearest target within the threshold (in frames). Returns the original value if none. */
export function snapFrame(frame: number, targets: readonly number[], threshold: number): { frame: number; snapped: number | null } {
  let best: number | null = null;
  for (const target of targets) {
    if (Math.abs(target - frame) <= threshold && (best === null || Math.abs(target - frame) < Math.abs(best - frame))) best = target;
  }
  return best === null ? { frame, snapped: null } : { frame: best, snapped: best };
}

/** Snap targets: the playhead, the sequence start, and both ends of every instance (except the one being dragged). */
export function snapTargets(sequence: Sequence, playheadFrame: number, exclude: ReadonlySet<string>): number[] {
  const targets = new Set<number>([0, playheadFrame]);
  for (const item of sequence.items) {
    if (exclude.has(item.id)) continue;
    const { start, end } = itemFrames(item, sequence.fps);
    targets.add(Math.round(start));
    targets.add(Math.round(end));
  }
  return [...targets];
}

/** Whether an instance can go on this track (consistent with the engine): audio goes only on audio tracks, subtitles only on subtitle tracks, and everything else (video, image, text, graphics, composition) only on visual tracks. */
export function trackAccepts(track: Track, item: { type: SequenceItem['type'] }): boolean {
  if (item.type === 'audio') return track.kind === 'audio';
  if (item.type === 'caption') return track.kind === 'subtitle';
  return track.kind === 'visual';
}

/** The name an instance shows in the timeline and inspector: its own name first; otherwise it is derived from its content (text, asset name, generator name, subtitle document name). */
export function itemLabel(item: SequenceItem, assets: Record<Id, AssetRecord>, documents: Record<Id, DocumentRecord>): string {
  if (item.name) return item.name;
  switch (item.type) {
    case 'text':
      if (item.counter) return M.counter;
      return (item.text ?? '').replace(/\s+/g, ' ').trim() || M.text;
    case 'shape':
      return M.shape;
    case 'composition':
      return assets[item.source.assetRef.id]?.name ?? M.composition;
    case 'caption':
      return documents[item.documentId]?.name ?? M.caption;
    case 'sticker':
    case 'placeholder':
    case 'whiteboard':
      return (item.assetRef && assets[item.assetRef.id]?.name) || M.elements[item.type];
    case 'progress':
    case 'visualizer':
    case 'confetti':
    case 'draw':
      return M.elements[item.type];
    default:
      return assets[item.assetRef.id]?.name ?? M.asset;
  }
}

/** How timeline blocks are colored and which icon they get (same as `elementHue` / `elementIcon` in the old web timeline): text with a timing readout counts as a counter. */
export type ClipKind = SequenceItem['type'] | 'counter';

export function clipKind(item: SequenceItem): ClipKind {
  if (item.type === 'text' && item.counter) return 'counter';
  return item.type;
}

/** Interval in seconds between timeline ticks: ensures at least `minPx` pixels between adjacent labels. */
export function rulerStep(pxPerSecond: number, minPx = 72): { major: number; minor: number } {
  const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];
  const major = steps.find((s) => s * pxPerSecond >= minPx) ?? 3600;
  const minor = major >= 60 ? major / 6 : major >= 1 ? major / 5 : major / 2;
  return { major, minor };
}

/** Tick labels: “0:05”, “1:30”; intervals under one second get one decimal place. */
export function rulerLabel(seconds: number, step: number): string {
  const whole = Math.floor(seconds + 1e-6);
  const m = Math.floor(whole / 60);
  const s = String(whole % 60).padStart(2, '0');
  if (step < 1) return `${m}:${s}.${Math.round((seconds - whole) * 10) % 10}`;
  return `${m}:${s}`;
}

/** Editor timecode: “00:00:05:12” (hours:minutes:seconds:frames). The frame number follows the sequence's frame rate, rounded down. */
export function formatTimecode(seconds: number, fps: Rate): string {
  const perSecond = Math.max(1, Math.round(fps.num / fps.den));
  const frame = frameAt(seconds, fps);
  const totalSeconds = Math.floor((frame * fps.den) / fps.num + 1e-9);
  const ff = frame - Math.round((totalSeconds * fps.num) / fps.den);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(h)}:${two(m)}:${two(s)}:${two(Math.min(Math.max(ff, 0), perSecond - 1))}`;
}

/** Seconds shown to the millisecond: “10.010 秒” (10.010 seconds). Display only; submissions use the exact value. */
export function formatSeconds(seconds: number): string {
  return M.seconds(seconds.toFixed(3));
}

/** Frame rate display: “30 fps”, “29.97 fps”. */
export function formatFps(fps: Rate): string {
  const value = fps.num / fps.den;
  return `${Number.isInteger(value) ? value : value.toFixed(2)} fps`;
}

/** Parses seconds typed by the user: “10”, “10.5”, “1:05.2”. Returns null if invalid. Returns a decimal string, to be quantized by the engine. */
export function parseSecondsInput(text: string): string | null {
  const trimmed = text.trim().replace(/秒$/, '').trim();
  const clock = /^(\d+):(\d{1,2}(?:\.\d+)?)$/.exec(trimmed);
  if (clock) {
    const seconds = Number(clock[1]) * 60 + Number(clock[2]);
    return Number.isFinite(seconds) ? trimDecimal(seconds) : null;
  }
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  return trimmed.replace(/^0+(?=\d)/, '');
}

function trimDecimal(value: number): string {
  return value.toFixed(6).replace(/\.?0+$/, '');
}
