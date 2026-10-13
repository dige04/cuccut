// The "plan" for turning one old project into one video: list the assets first; once they are registered (IDs, sizes and durations known), produce the documents, tracks and items.
// A plan is pure data; video-writer.ts writes it into the video, and a dry run only computes without writing.

import type { Rate } from './exact-time.ts';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** Asset information recorded by the old format itself: stands in for the engine's probe results in a dry run. */
export interface MediaHint {
  kind: 'video' | 'audio' | 'image' | 'lottie' | 'bundle' | 'other';
  width?: number;
  height?: number;
  durationUs?: bigint;
  hasAudio?: boolean;
}

export interface AssetPlan {
  ref: string;
  path: string;
  name?: string;
  /** Directory assets (code bundles) include only these relative paths. */
  include?: string[];
  bundle?: Json;
  provenance?: { origin: string; source?: Json };
  /** The `sha256-…` recorded by the old format, used to detect files that changed after the old project was created. */
  legacyHash?: string;
  hint: MediaHint;
}

/** An asset after registration. Synthesized from `hint` in a dry run. */
export interface AssetInfo {
  id: string;
  revision: string;
  kind: string;
  width?: number;
  height?: number;
  durationUs?: bigint;
  hasAudio: boolean;
  contentHash?: string;
}

export interface DocumentPlan {
  ref: string;
  kind: string;
  name: string;
  language?: string;
  sourceAsset?: string;
  sourceDocument?: string;
  body: Json;
  summary?: Json;
}

export interface TrackPlan {
  key: string;
  kind: 'visual' | 'audio' | 'subtitle';
  name: string;
  /** Hidden, muted and locked state of the old track. Locking is applied only after everything is written, so it does not block later writes. */
  hidden?: boolean;
  muted?: boolean;
  locked?: boolean;
}

/** Placeholder in `followPolicy` pointing to the transcript document: replaced on write with the transcript document's `VersionRef` at that time. */
export const SPEECH_REF = { document: 'speech' };

export interface KeyframePlan {
  property: string;
  keyframes: Json[];
}

/** An old element's own single-sided transition: `in` lands at the item's start (`rightItemId`), `out` at its end (`leftItemId`). */
export interface TransitionPlan {
  side: 'in' | 'out';
  kind: string;
  /** Decimal seconds. */
  duration: string;
}

export interface ItemPlan {
  track: string;
  /** ID in the old project, written to `extensions["cuccut.import"].sourceId` and used to attach captions, keyframes, transitions, ducking and cut sets to the matching item. */
  sourceId: string;
  /** The item's fields, without `trackId`. A caption item's `documentId` etc. are resolved from the three fields below. */
  item: { [key: string]: Json };
  document?: string;
  styleDocument?: string;
  scopeSourceIds?: string[];
  keyframes?: KeyframePlan[];
  transitions?: TransitionPlan[];
}

/** One ducking rule: v2 writes it on the ducked element; here they are merged by (trigger, depth, attack/release) into rules on the sequence. */
export interface DuckingPlan {
  trigger: { kind: 'speech' } | { kind: 'tracks'; legacyTrack: string };
  depth?: number;
  attack?: string;
  release?: string;
  targetSourceIds: string[];
}

/** A cut set (video format spec §6.7): `scopeItemIds` in the body are replaced from `scopeSourceIds` with item IDs once the items are written. */
export interface CutSetPlan {
  ref: string;
  name: string;
  sourceAsset: string;
  body: { [key: string]: Json };
  scopeSourceIds: string[];
}

export interface VideoContent {
  documents: DocumentPlan[];
  tracks: TrackPlan[];
  items: ItemPlan[];
  /** Old track ID -> the new tracks it was split into (used when ducking triggers by track). */
  legacyTracks?: Record<string, string[]>;
  ducking?: DuckingPlan[];
  cutSets?: CutSetPlan[];
  template?: Json;
  /** Canvas background color `#RRGGBB`. */
  background?: string;
}

export interface ProjectPlan {
  /** Stable key: determines the video directory name and the transactions' commandId; unchanged on rerun. */
  key: string;
  name: string;
  dirName: string;
  fps: Rate;
  width: number;
  height: number;
  assets: AssetPlan[];
  build(assets: Map<string, AssetInfo>): VideoContent;
  report: ProjectReport;
}

export interface ProjectReport {
  source: string;
  format: string;
  kind: string;
  name: string;
  videoDir?: string;
  fps: { legacy: number | null; rate: Rate; note?: string };
  canvas: { width: number; height: number; note?: string };
  assets: { planned: number; linked: number; missing: string[]; hashChanged: string[]; reused: number };
  documents: Record<string, number>;
  tracks: number;
  items: Record<string, number>;
  /** Fields the old format has but the new format has no place for: kept as is in `extensions["cuccut.import"]`, counted here. */
  unmapped: Record<string, number>;
  /** Behavior or mappings in the old format that do not apply in the new format (the key states why); not counted as lost. */
  notApplicable: Record<string, number>;
  /** Estimates made during import (canvas size, length of audio without an end, etc.). */
  estimated: Record<string, number>;
  /** Values outside the new format's range, clamped into it. */
  clamped: Record<string, number>;
  /** Fields or objects the new format rejects and that were not written (item-by-item explanations in `warnings`). */
  dropped: Record<string, number>;
  /** Objects written on the sequence: keyframe bindings, transitions, ducking rules, cut sets, etc. */
  written: Record<string, number>;
  /** Single-sided transitions whose effective length is shorter than written (the item is less than twice the transition length; from the engine's receipt). */
  shortenedTransitions: { sourceId: string; side: string; durationFrames: number; effectiveFrames: number }[];
  anchors: { resolved: number; unresolved: number };
  time: { maxSnapMs: number; clampedTails: number };
  notImported: string[];
  warnings: string[];
  failed: string[];
  durationFrames?: number;
  revision?: string;
}

export function newReport(source: string, format: string, kind: string, name: string, fps: Rate): ProjectReport {
  return {
    source,
    format,
    kind,
    name,
    fps: { legacy: null, rate: fps },
    canvas: { width: 0, height: 0 },
    assets: { planned: 0, linked: 0, missing: [], hashChanged: [], reused: 0 },
    documents: {},
    tracks: 0,
    items: {},
    unmapped: {},
    notApplicable: {},
    estimated: {},
    clamped: {},
    dropped: {},
    written: {},
    shortenedTransitions: [],
    anchors: { resolved: 0, unresolved: 0 },
    time: { maxSnapMs: 0, clampedTails: 0 },
    notImported: [],
    warnings: [],
    failed: [],
  };
}

export function count(table: Record<string, number>, key: string, by = 1): void {
  table[key] = (table[key] ?? 0) + by;
}

/** Clamps to `[lo, hi]`; clamped values are counted in the report's "clamped" tally. */
export function clampTo(report: ProjectReport, label: string, value: number, lo: number, hi: number): number {
  if (value >= lo && value <= hi) return value;
  count(report.clamped, label);
  return value < lo ? lo : hi;
}

/** Closed table of easing names (`motion::curve::EASE_NAMES`): shared by keyframes, volume envelopes and animation presets. */
export const EASE_NAMES = [
  'linear',
  'easeInQuad',
  'easeOutQuad',
  'easeInOutQuad',
  'easeInCubic',
  'easeOutCubic',
  'easeInOutCubic',
  'easeInQuart',
  'easeOutQuart',
  'easeInOutQuart',
  'easeInExpo',
  'easeOutExpo',
  'easeInOutExpo',
  'easeInSine',
  'easeOutSine',
  'easeInOutSine',
  'easeInBack',
  'easeOutBack',
  'easeInOutBack',
  'easeOutElastic',
];

/** Spreads mutually overlapping elements on the same old track over several new tracks (the new format forbids overlap within a track). Returns each element's lane. */
export function lanes(ranges: { start: number; end: number }[]): number[] {
  const order = ranges.map((_, i) => i).sort((a, b) => ranges[a]!.start - ranges[b]!.start || a - b);
  const ends: number[] = [];
  const lane = new Array<number>(ranges.length).fill(0);
  for (const i of order) {
    let n = ends.findIndex((end) => end <= ranges[i]!.start);
    if (n < 0) n = ends.push(0) - 1;
    ends[n] = ranges[i]!.end;
    lane[i] = n;
  }
  return lane;
}

/** Video directory name: strip path separators and control characters, keeping the original name readable. */
export function dirNameOf(name: string): string {
  const cleaned = name
    .replace(/[\\/:\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '');
  return (cleaned || 'untitled').slice(0, 80).trim();
}

/** Directory names must not collide, not even on case-insensitive file systems. */
export function uniqueName(name: string, taken: Set<string>): string {
  let candidate = name;
  for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = `${name} ${n}`;
  taken.add(candidate.toLowerCase());
  return candidate;
}
