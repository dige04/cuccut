import type { AssetRecord, AudioItem, DocumentRecord, EditOperation, Id, Rate, Sequence, SequenceItem } from '@cuccut/protocol';
import { itemRangeSeconds, mediaTimeToSeconds } from '@cuccut/protocol';
import { DUB_EXTENSION } from './dub-undo.ts';
import { speechSpeakers } from './dub-setup.ts';
import { rateFromSpeed, speedOf } from './property-values.ts';
import { speechSentences } from './translation-doc.ts';

/**
 * Dub blocks on the timeline (design mockup timeline-dub.jsx, product design §12.6 / §15.6): instances of a dub group are drawn on the track as “faded” blocks —
 * a speaker color strip on the left edge, and the translation of the sentence written on the block; only a few states stand out: speaking rate faster than 1.35× turns the whole block yellow (too fast), muted blocks are dimmed with a strikethrough,
 * and blocks stretched by hand are noted in the tooltip. This part only computes: which instances are dub blocks, each block's speaker and hue, translation, actual speaking rate, the new rate when dragging the right edge to change the rate,
 * and the actions the menu should send. It does not touch React.
 *
 * Where the data comes from (none of it needs anything beyond the body text):
 * - the instance's `extensions['cuccut.dub']`: `{ groupId, language, unitId }`; a separated background carries `stem` and is not a dub block;
 * - the source of the synthesized audio (`provenance.source.tempo`): the speed applied with atempo during pipeline alignment; the instance's own speed change multiplied on top is the speaking rate actually heard;
 * - the dubbing plan document (`dubbing-plan`; in the current version `summary.groupId` identifies the group): the unit's translation and original sentence;
 * - the transcript containing the original sentence (the plan unit's `targetAnchor.speechRef`): the speaker of the sentence's first non-hidden word.
 * When the plan or transcript has not been fetched, it degrades: blocks are still drawn, the hue uses the first tier, and the text uses the clip name.
 */

/** A speaking rate faster than this is marked “Too fast” (design mockup model-tts.js `MAX_RATE`: comfort ceiling). */
export const DUB_FAST_RATE = 1.35;
/** The rate range accepted by the contract's `setSpeed`. */
export const DUB_SPEED_MIN = 0.1;
export const DUB_SPEED_MAX = 10;

/** Speaker → hue, cycling by the speaker's order in the transcript (design mockup model-tts.js `SPEAKER_HUES`). */
export const SPEAKER_HUES = ['blue', 'green', 'orange', 'purple', 'magenta', 'indigo'] as const;
export type SpeakerHue = (typeof SPEAKER_HUES)[number];

export function speakerHue(index: number): SpeakerHue {
  const n = SPEAKER_HUES.length;
  return SPEAKER_HUES[((Math.trunc(index) % n) + n) % n]!;
}

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

// ---- Identifying blocks and groups ----

export interface DubMark {
  groupId: string;
  language: string | null;
  unitId: string | null;
}

/** Whether this instance is a dub block: it is audio, carries `cuccut.dub.groupId`, and is not a separated background (`stem`). */
export function dubMark(item: SequenceItem): DubMark | null {
  if (item.type !== 'audio') return null;
  const own = item.extensions?.[DUB_EXTENSION];
  if (!isObject(own) || own.stem !== undefined) return null;
  const groupId = text(own.groupId);
  return groupId ? { groupId, language: text(own.language), unitId: text(own.unitId) } : null;
}

export interface DubGroup {
  groupId: string;
  language: string | null;
  /** The blocks of this group, in time order. */
  itemIds: Id[];
  trackIds: Id[];
}

/** The dub groups in the sequence (in order of first appearance); each group's blocks are in time order. */
export function dubGroups(sequence: Sequence): DubGroup[] {
  const groups = new Map<string, { group: DubGroup; starts: Map<Id, number> }>();
  for (const item of sequence.items) {
    const mark = dubMark(item);
    if (!mark) continue;
    let entry = groups.get(mark.groupId);
    if (!entry) {
      entry = { group: { groupId: mark.groupId, language: mark.language, itemIds: [], trackIds: [] }, starts: new Map() };
      groups.set(mark.groupId, entry);
    }
    entry.group.itemIds.push(item.id);
    entry.starts.set(item.id, itemRangeSeconds(item, sequence.fps).start);
    if (!entry.group.trackIds.includes(item.trackId)) entry.group.trackIds.push(item.trackId);
    entry.group.language ??= mark.language;
  }
  return [...groups.values()].map(({ group, starts }) => ({
    ...group,
    itemIds: [...group.itemIds].sort((a, b) => starts.get(a)! - starts.get(b)!),
  }));
}

/** A track holding only this dub group: its row header reads “Dubbing · language”. Empty tracks, or tracks mixed with other instances or other groups, do not count. */
export function dubTrackGroup(sequence: Sequence, trackId: Id): DubGroup | null {
  const items = sequence.items.filter((item) => item.trackId === trackId);
  if (items.length === 0) return null;
  const marks = items.map(dubMark);
  const first = marks[0];
  if (!first || marks.some((m) => !m || m.groupId !== first.groupId)) return null;
  return dubGroups(sequence).find((g) => g.groupId === first.groupId) ?? null;
}

export type DubStem = 'background' | 'vocals';

/** A split-track instance separated from dubbing (background sound or vocals): which kind and which group; other instances are null. */
export function dubStemOf(item: SequenceItem): { stem: DubStem; groupId: string } | null {
  const own = item.extensions?.[DUB_EXTENSION];
  return isObject(own) && (own.stem === 'background' || own.stem === 'vocals') && text(own.groupId)
    ? { stem: own.stem as DubStem, groupId: own.groupId as string }
    : null;
}

/**
 * A track holding only one kind of split track separated from one dub group (the “Background sound” row of design mockup model-timeline.js): which kind, which group, and the group's language.
 * Empty tracks, or tracks mixed with other split tracks or other groups, do not count.
 */
export function stemTrackOf(sequence: Sequence, trackId: Id): { stem: DubStem; groupId: string; language: string | null } | null {
  const items = sequence.items.filter((item) => item.trackId === trackId);
  if (items.length === 0) return null;
  const marks = items.map(dubStemOf);
  const first = marks[0];
  if (!first || marks.some((m) => !m || m.stem !== first.stem || m.groupId !== first.groupId)) return null;
  const language = dubGroups(sequence).find((g) => g.groupId === first.groupId)?.language ?? null;
  return { ...first, language };
}

// ---- Dubbing plan and transcript ----

/** The plan document for this dub group: `dubbing-plan`; the current version's summary records `groupId` (written when the pipeline writes it). */
export function planRecordOf(documents: Record<Id, DocumentRecord>, groupId: string): DocumentRecord | null {
  for (const record of Object.values(documents)) {
    if (record.kind !== 'dubbing-plan') continue;
    const summary = record.revisions[record.currentRevision]?.summary;
    if (isObject(summary) && summary.groupId === groupId) return record;
  }
  return null;
}

export interface PlanUnit {
  /** Translation unit (the `unitId` on the instance). */
  unitId: Id;
  /** The script to be read aloud (the translation). */
  text: string | null;
  /** The original sentence and the transcript it is in. */
  sentenceId: Id | null;
  speechId: Id | null;
  status: string | null;
}

/** Units in the dubbing plan body, identified by translation unit (`extensions['cuccut.dub'].translationUnitId`; older ones fall back to `d-<unitId>`). */
export function planUnits(body: unknown): Map<Id, PlanUnit> {
  const units = new Map<Id, PlanUnit>();
  if (!isObject(body) || !Array.isArray(body.units)) return units;
  for (const raw of body.units) {
    if (!isObject(raw)) continue;
    const own = isObject(raw.extensions) ? raw.extensions[DUB_EXTENSION] : undefined;
    const id = text(raw.id);
    const unitId = (isObject(own) ? text(own.translationUnitId) : null) ?? (id?.startsWith('d-') ? id.slice(2) : null);
    if (!unitId) continue;
    const anchor = isObject(raw.targetAnchor) ? raw.targetAnchor : null;
    const speechRef = anchor && isObject(anchor.speechRef) ? anchor.speechRef : null;
    const sentences = Array.isArray(raw.sourceSentenceIds) ? raw.sourceSentenceIds : [];
    units.set(unitId, {
      unitId,
      text: isObject(raw.script) ? text(raw.script.text) : null,
      sentenceId: text(sentences[0]) ?? (anchor ? text(anchor.sentenceId) : null),
      speechId: speechRef ? text(speechRef.id) : null,
      status: text(raw.status),
    });
  }
  return units;
}

/** The transcript referenced by the plan (the first one present): speakers come from it. */
export function planSpeechId(units: ReadonlyMap<Id, PlanUnit>): Id | null {
  for (const unit of units.values()) if (unit.speechId) return unit.speechId;
  return null;
}

export interface SpeakerIndex {
  /** The speaker's order in the transcript (determines the hue). */
  order: string[];
  names: Map<string, string>;
  /** Sentence → speaker: the speaker of the sentence's first non-hidden word (consistent with the Runtime). */
  bySentence: Map<Id, string>;
}

/** Speakers in the transcript and each sentence's speaker; null when the body is not a transcript; when there is no speaker information, all three tables are empty. */
export function sentenceSpeakers(body: unknown): SpeakerIndex | null {
  const sentences = speechSentences(body);
  if (!sentences || !isObject(body)) return null;
  const speakers = speechSpeakers(body);
  const words = new Map<Id, { speaker: string | null; hidden: boolean }>();
  for (const raw of Array.isArray(body.words) ? body.words : []) {
    if (isObject(raw) && typeof raw.id === 'string') words.set(raw.id, { speaker: text(raw.speaker), hidden: raw.hidden === true });
  }
  const bySentence = new Map<Id, string>();
  for (const sentence of sentences) {
    const speaker = sentence.wordIds.map((id) => words.get(id)).find((w) => w && !w.hidden)?.speaker;
    if (speaker) bySentence.set(sentence.id, speaker);
  }
  return { order: speakers.map((s) => s.speakerId), names: new Map(speakers.map((s) => [s.speakerId, s.name])), bySentence };
}

// ---- Speaking rate ----

/** The speed applied when the synthesized audio was aligned (`tempo` in the asset's source; 1 when absent). */
export function dubTempo(item: AudioItem, assets: Record<Id, AssetRecord>): number {
  const source = assets[item.assetRef.id]?.revisions[item.assetRef.revision]?.provenance.source;
  const tempo = isObject(source) ? source.tempo : undefined;
  return typeof tempo === 'number' && Number.isFinite(tempo) && tempo > 0 ? tempo : 1;
}

/** The instance's own speed change (the rate of the linear time mapping; 1 when held). */
export function itemSpeed(item: AudioItem): number {
  return item.timeMap.kind === 'linear' ? speedOf(item.timeMap.rate) : 1;
}

/** Whether to write the speed badge on the block: 1.0× is not written. */
export function showsRate(rate: number): boolean {
  return Math.abs(rate - 1) >= 0.005;
}

export interface DubBlock {
  itemId: Id;
  groupId: string;
  language: string | null;
  unitId: string | null;
  /** This sentence's index within the group (by time, starting from 1). */
  index: number;
  /** Translation; null when the plan has not been fetched yet (the clip name is drawn). */
  text: string | null;
  speakerId: string | null;
  speakerName: string | null;
  hue: SpeakerHue;
  /** Speed applied in alignment during synthesis × the instance's speed change = the speaking rate heard. */
  tempo: number;
  speed: number;
  rate: number;
  fast: boolean;
  muted: boolean;
  /** The instance's own speed was changed (its right edge was dragged by hand, or it was edited in the properties). */
  manual: boolean;
  /** This sentence is being re-dubbed (it appears in the `params.regroup` frozen by the running dubbing pipeline); the timeline overlay is applied, not computed here. */
  queued?: boolean;
  /** When this sentence has several versions, which version is current and the seed used (`versionTip` in model/dub-takes.ts); null when there is only one version. */
  version?: { k: number; seed: number | null } | null;
}

/** Bodies already fetched: group → dubbing plan body; transcript document ID → transcript body. */
export interface DubSources {
  assets: Record<Id, AssetRecord>;
  plans: ReadonlyMap<string, unknown>;
  speeches: ReadonlyMap<Id, unknown>;
}

/** All dub blocks in the sequence. */
export function dubBlocks(sequence: Sequence, sources: DubSources): Map<Id, DubBlock> {
  const blocks = new Map<Id, DubBlock>();
  const byId = new Map(sequence.items.map((item) => [item.id, item]));
  for (const group of dubGroups(sequence)) {
    const units = planUnits(sources.plans.get(group.groupId));
    const speechId = planSpeechId(units);
    const speakers = speechId ? sentenceSpeakers(sources.speeches.get(speechId)) : null;
    group.itemIds.forEach((itemId, i) => {
      const item = byId.get(itemId) as AudioItem;
      const mark = dubMark(item)!;
      const unit = mark.unitId ? units.get(mark.unitId) : undefined;
      const speakerId = (unit?.sentenceId && speakers?.bySentence.get(unit.sentenceId)) || null;
      const order = speakerId && speakers ? speakers.order.indexOf(speakerId) : -1;
      const tempo = dubTempo(item, sources.assets);
      const speed = itemSpeed(item);
      const rate = tempo * speed;
      blocks.set(itemId, {
        itemId,
        groupId: group.groupId,
        language: mark.language ?? group.language,
        unitId: mark.unitId,
        index: i + 1,
        text: unit?.text ?? null,
        speakerId,
        speakerName: speakerId ? (speakers?.names.get(speakerId) ?? speakerId) : null,
        hue: speakerHue(Math.max(0, order)),
        tempo,
        speed,
        rate,
        fast: rate > DUB_FAST_RATE + 1e-9,
        muted: !!item.mix.muted,
        manual: showsRate(speed),
      });
    });
  }
  return blocks;
}

// ---- Changing speed by dragging the right edge ----

/** How much free space there is on the same track after this item (seconds, up to the start of the next item); null when nothing follows. If lengthening would cover a later instance, the engine rejects the whole edit. */
export function roomAfter(sequence: Sequence, item: SequenceItem): number | null {
  const own = itemRangeSeconds(item, sequence.fps);
  let next: number | null = null;
  for (const other of sequence.items) {
    if (other.id === item.id || other.trackId !== item.trackId) continue;
    const start = itemRangeSeconds(other, sequence.fps).start;
    if (start >= own.end - 1e-9 && (next === null || start < next)) next = start;
  }
  return next === null ? null : next - own.start;
}

export interface Stretch {
  /** The rate to submit (reduced, to two decimal places). */
  rate: Rate;
  speed: number;
  /** The block's length at this rate (seconds). */
  seconds: number;
  /** Clamped (by the contract range or by the next item). */
  clamped: boolean;
}

/**
 * Stretches the block to `wantSeconds`: the source range used is unchanged, and rate = original rate × original length / new length (design mockup “speaking rate = synthesized duration / new duration”,
 * the same convention as the engine's `setSpeed`, computed exactly with rationals). Clamped within the contract's 0.1–10; `room` is the length up to the start of the next item on the same track, and lengthening cannot exceed it
 * (the rate is rounded up one step, preferring a slightly shorter block over covering the next item; covering it makes the engine reject the whole edit).
 */
export function stretchSpeed(item: AudioItem, wantSeconds: number, room: number | null): Stretch {
  const seconds0 = mediaTimeToSeconds(item.playDuration);
  const speed0 = itemSpeed(item);
  const source = seconds0 * speed0;
  let lo = DUB_SPEED_MIN;
  // Round up: if floating point makes an exact fit come out a hair too long and step up one tier (a little shorter), it will not overlap instead.
  if (room !== null && room > 0) lo = Math.max(lo, Math.ceil((source / room) * 100) / 100);
  if (lo > DUB_SPEED_MAX) return { rate: rateFromSpeed(speed0), speed: speed0, seconds: seconds0, clamped: true };
  const rounded = Math.round((source / Math.max(1e-3, wantSeconds)) * 100) / 100;
  const speed = Math.min(DUB_SPEED_MAX, Math.max(lo, rounded));
  return { rate: rateFromSpeed(speed), speed, seconds: source / speed, clamped: speed !== rounded };
}

/** Whether to commit after dragging: the rate has actually changed. */
export function stretchChanged(item: AudioItem, stretch: Stretch): boolean {
  return Math.abs(stretch.speed - itemSpeed(item)) >= 0.005;
}

// ---- Actions the menu sends ----

/** Dub blocks in the selection (in selection order); other instances are ignored. */
export function selectedBlocks(selection: readonly Id[], blocks: ReadonlyMap<Id, DubBlock>): DubBlock[] {
  return selection.flatMap((id) => {
    const block = blocks.get(id);
    return block ? [block] : [];
  });
}

/** Whether this dub group has a separated background sound (“Remove this dub group” removes it along with the group). */
export function hasBackground(sequence: Sequence, groupId: string): boolean {
  return sequence.items.some((item) => {
    const own = item.extensions?.[DUB_EXTENSION];
    return isObject(own) && own.groupId === groupId && own.stem !== undefined;
  });
}

/** Mute or unmute these blocks: only send the ones whose state actually needs to change. */
export function muteOperations(sequence: Sequence, itemIds: readonly Id[], muted: boolean): EditOperation[] {
  const wanted = new Set(itemIds);
  return sequence.items
    .filter((item) => wanted.has(item.id) && item.type === 'audio' && !!item.mix.muted !== muted)
    .map((item) => ({ type: 'setAudioMix', sequenceId: sequence.id, itemId: item.id, muted }));
}

/** Whether any of these items are locked (the instance is locked, or its track is locked): the engine refuses to change them, and the menu greys out the corresponding entries. */
export function anyLocked(sequence: Sequence, itemIds: readonly Id[]): boolean {
  const lockedTracks = new Set(sequence.tracks.filter((track) => track.locked).map((track) => track.id));
  const wanted = new Set(itemIds);
  return sequence.items.some((item) => wanted.has(item.id) && (item.locked || lockedTracks.has(item.trackId)));
}

/** Whether any part of this dub group (together with its separated background) is locked: “Remove this dub group” is one transaction, so if any item is locked the whole transaction is rejected. */
export function groupLocked(sequence: Sequence, groupId: string): boolean {
  const ids = sequence.items
    .filter((item) => {
      const own = item.extensions?.[DUB_EXTENSION];
      return isObject(own) && own.groupId === groupId;
    })
    .map((item) => item.id);
  return anyLocked(sequence, ids);
}
