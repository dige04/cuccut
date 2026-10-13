import type { Id } from '@cuccut/protocol';

/**
 * The result of the engine's `exports.plan` (`crates/engine-host/src/exports.rs`): one request, a plan for the same video version.
 * Times are in seconds, relative to the start of each segment's range; timeline conversion (cuts, speed changes, which instances apply) is all done in the engine and is not recomputed here.
 */

export interface PlanRange {
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
}

export interface AudioFade {
  start: number;
  end: number;
}

/** Sound cross-fade of a transition (equal power): the outgoing side is multiplied by cos(p·π/2) and the incoming side by sin(p·π/2), with p moving linearly 0→1 across `[start, end)`. */
export interface AudioCrossfade {
  transitionId: Id;
  role: 'outgoing' | 'incoming';
  start: number;
  end: number;
}

export interface AudioSegment {
  itemId: Id;
  source: 'embedded' | 'audio';
  asset: { id: Id; revision: string };
  trackOrder: number;
  start: number;
  end: number;
  sourceStart: number;
  sourceRate: number;
  /** The instance's fixed gain (without fades). When there is a volume envelope this is 0: the volume is in `envelope`. */
  gainDb: number;
  /**
   * Breakpoints `[seconds, linear multiplier]` baked from the volume envelope (video format spec §3.9): linear between breakpoints, the first value holds before the first breakpoint, and
   * the last value holds after the last. This is the same polyline as the preview's per-frame plan. Omitted when there is no envelope.
   */
  envelope?: Array<[number, number]>;
  fadeIn?: AudioFade;
  fadeOut?: AudioFade;
  /** The transition cross-fade this segment belongs to. */
  crossfades?: AudioCrossfade[];
  /**
   * Breakpoints `[seconds, dB]` for duck attenuation: linear between breakpoints, 0 before the first, and the last value holds after the last; two breakpoints at the same time form a step
   * (at that moment take the later one). The attenuation is subtracted from the gain.
   */
  ducking?: Array<[number, number]>;
  /** During a cross-fade, takes the handles portion outside the instance's own interval (the instance's fades do not apply). */
  handle?: boolean;
}

export interface AudioPlan {
  sequenceId: Id;
  sequenceRevision: string;
  range: PlanRange;
  segments: AudioSegment[];
  /** Plan items that were not carried out, or differ from the preview: `DUCK_NO_SPEECH`, `HOLD_IS_SILENT`, `ASSET_HAS_NO_AUDIO`, `CROSSFADE_HANDLE_SHORT`. */
  notes: Array<{ code: string; itemId: Id }>;
}

export interface TextEntry {
  /** `<acting instance>:<id>`; when the same word is cut into several segments, the later ones get `#n`. */
  key: string;
  id: string;
  scopeItemId?: Id;
  start: number;
  end: number;
  text: string;
  speaker?: string;
  sentenceId?: string;
  paragraphStart?: boolean;
  /** Word timing is trustworthy (aligned, or provided by the vendor); false for caption cues, interpolated words, and missing words. */
  wordTiming: boolean;
  clipped?: boolean;
}

export interface TextPlan {
  sequenceId: Id;
  documentId: Id;
  /** `caption`: one entry is one subtitle; `speech`: one entry is one word. */
  unit: 'caption' | 'speech';
  clock: string;
  scope: { basis: string; captionItemIds: Id[]; scopeItemIds: Id[] };
  range: PlanRange;
  entries: TextEntry[];
  sourceCount: number;
  omittedCount: number;
}

export interface PlannedAsset {
  assetId: Id;
  revision: string;
  name: string;
  path: string;
  storage: 'managed' | 'linked';
  mediaType: string;
  contentHash: string;
  byteLength: number;
  modifiedAt: string | null;
  audio: { sampleRate: number; channels: number; layout?: string } | null;
}

export interface PlannedDocument {
  documentId: Id;
  kind: string;
  name: string;
  language: string | null;
  revision: string;
  sourceAssetId: Id | null;
  sourceDocumentId: Id | null;
  schema: string;
  /** Body text of the translation and transcript (sentence members, speaker names, translated sentences); null for subtitles. */
  body: unknown;
}

interface PlanCommon {
  videoId: Id;
  videoName: string;
  videoRevision: string;
  sequenceId: Id;
  sequenceRevision: string;
  fps: { num: number; den: number };
  canvas: { width: number; height: number };
}

export interface AudioPlanResult extends PlanCommon {
  parts: Array<{ audio: AudioPlan }>;
  assets: PlannedAsset[];
}

export interface TextPlanResult extends PlanCommon {
  documents: PlannedDocument[];
  /** One per range segment; `plans[i]` corresponds to `documents[i]`; translation is null. */
  parts: Array<{ plans: Array<TextPlan | null> }>;
  style: { documentId: Id; revision: string; body: unknown } | null;
}
