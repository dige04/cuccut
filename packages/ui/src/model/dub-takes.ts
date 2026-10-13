import type {
  AssetRecord,
  AudioItem,
  DocumentRecord,
  DubOriginalAudio,
  DubPlanTake,
  EditOperation,
  Id,
  JobRecord,
  Sequence,
  SequenceItem,
} from '@cuccut/protocol';
import { DUB_EXTENSION, mutedItemsOf } from './dub-undo.ts';
import { isDubJob } from './dub-progress.ts';
import { jobLive } from './task-list.ts';
import { textHash, type TranslationBody } from './translation-doc.ts';
import { dubMark, type DubBlock } from './timeline-dub.ts';

/**
 * Sentence-level redubbing (design draft model-dub.js “块级管理” (block-level management) and “版” (takes); timeline-dub.jsx row headers and block menu): the multiple versions of each sentence's dub, which sentences are being redubbed, which sentences need regenerating, and the operations to send when switching versions or switching audio source. It does not touch React.
 *
 * Where the data comes from:
 * - The dub plan unit's `extensions['cuccut.dub']`: `take` (the current version), `seed`, and `takes[]` (`DubPlanTake`). For an old plan with no versions, the version already placed is filled in as version 1 in the view. The plan itself is not changed. This is the same convention the Runtime uses when it backfills on redub.
 * - The frozen `pipeline.params.regroup` (`FrozenDubRegroup`) of the running dub flow: which sentences of which group are being redubbed.
 * - The plan unit's `status`: a sentence that is `failed` (voice unavailable) or `needs-fit` (does not fit) and is not on the timeline counts as “没合成” (not synthesized).
 */

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

// ---- Versions ----

export interface UnitTakes {
  /** The translation unit (the `unitId` on an instance). */
  unitId: Id;
  /** The unit ID in the plan (`d-<unitId>`). */
  planUnitId: Id;
  status: string | null;
  /** The current version. null when there are no versions. */
  take: number | null;
  seed: number | null;
  /** Sorted by version number, ascending. */
  takes: DubPlanTake[];
  /** The seconds over the limit when it does not fit (`needs-fit`). */
  overflowSeconds: number | null;
  /** Not synthesized because the voice is unavailable (`failed`). */
  voiceUnavailable: boolean;
  /** The original sentence is not on the timeline (`draft`). */
  offTimeline: boolean;
}

function readTake(raw: unknown): DubPlanTake | null {
  if (!isObject(raw)) return null;
  const k = num(raw.k);
  if (k === null || k < 1) return null;
  const ref =
    isObject(raw.assetRef) && str(raw.assetRef.id) && str(raw.assetRef.revision)
      ? { id: raw.assetRef.id as Id, revision: raw.assetRef.revision as string }
      : undefined;
  const fit = raw.fit === 'fit' || raw.fit === 'tempo' || raw.fit === 'extended' ? raw.fit : null;
  const over = num(raw.overflowSeconds);
  return {
    k,
    seed: num(raw.seed),
    artifactId: str(raw.artifactId),
    ...(ref ? { assetRef: ref } : {}),
    samples: num(raw.samples),
    sampleRate: num(raw.sampleRate),
    fit,
    tempo: num(raw.tempo),
    ...(over !== null ? { overflowSeconds: over } : {}),
    text: typeof raw.text === 'string' ? raw.text : null,
    jobId: str(raw.jobId),
    at: str(raw.at),
  };
}

/** The translation unit ID of the plan unit (`translationUnitId`; older ones fall back to `d-<unitId>`). */
function unitIdOf(raw: Json): Id | null {
  const own = isObject(raw.extensions) ? raw.extensions[DUB_EXTENSION] : undefined;
  const id = str(raw.id);
  return (isObject(own) ? str(own.translationUnitId) : null) ?? (id?.startsWith('d-') ? id.slice(2) : null);
}

/** The versions of one plan unit. In old plans (without `takes`), the version already placed is filled in as version 1. */
export function unitTakes(raw: unknown): UnitTakes | null {
  if (!isObject(raw)) return null;
  const unitId = unitIdOf(raw);
  const planUnitId = str(raw.id);
  if (!unitId || !planUnitId) return null;
  const own = isObject(raw.extensions) && isObject(raw.extensions[DUB_EXTENSION]) ? (raw.extensions[DUB_EXTENSION] as Json) : {};
  let takes: DubPlanTake[];
  let take = num(own.take);
  if (Array.isArray(own.takes)) {
    takes = own.takes.flatMap((t) => readTake(t) ?? []).sort((a, b) => a.k - b.k);
  } else if (str(own.artifactId)) {
    const samples = typeof raw.actualSamples === 'string' ? Number(raw.actualSamples) : null;
    const fit = own.fit === 'fit' || own.fit === 'tempo' || own.fit === 'extended' ? own.fit : null;
    takes = [
      {
        k: 1,
        seed: num(own.seed),
        artifactId: str(own.artifactId),
        samples: samples !== null && Number.isFinite(samples) ? samples : null,
        sampleRate: num(raw.sampleRate),
        fit,
        tempo: num(own.tempo),
        text: isObject(raw.script) && typeof raw.script.text === 'string' ? raw.script.text : null,
        jobId: null,
        at: null,
      },
    ];
    take = 1;
  } else {
    takes = [];
  }
  if (takes.length > 0 && (take === null || !takes.some((t) => t.k === take))) take = takes[takes.length - 1]!.k;
  if (takes.length === 0) take = null;
  return {
    unitId,
    planUnitId,
    status: str(raw.status),
    take,
    seed: take !== null ? (takes.find((t) => t.k === take)?.seed ?? null) : null,
    takes,
    overflowSeconds: num(own.overflowSeconds),
    voiceUnavailable: own.voiceUnavailable !== undefined,
    offTimeline: own.offTimeline === true,
  };
}

/** The versions for each sentence in the plan, in plan order. */
export function planTakes(body: unknown): Map<Id, UnitTakes> {
  const out = new Map<Id, UnitTakes>();
  if (!isObject(body) || !Array.isArray(body.units)) return out;
  for (const raw of body.units) {
    const unit = unitTakes(raw);
    if (unit && !out.has(unit.unitId)) out.set(unit.unitId, unit);
  }
  return out;
}

export function activeTake(unit: Pick<UnitTakes, 'take' | 'takes'> | null | undefined): DubPlanTake | null {
  if (!unit || unit.take === null) return null;
  return unit.takes.find((t) => t.k === unit.take) ?? null;
}

/** The versions other than the current one (archived). */
export function archivedTakes(unit: Pick<UnitTakes, 'take' | 'takes'> | null | undefined): DubPlanTake[] {
  if (!unit) return [];
  return unit.takes.filter((t) => t.k !== unit.take);
}

/** The length in seconds of this version when placed on the timeline. null when not placed (it did not fit). */
export function takeSeconds(take: Pick<DubPlanTake, 'samples' | 'sampleRate'>): number | null {
  return take.samples !== null && take.sampleRate !== null && take.sampleRate > 0 ? take.samples / take.sampleRate : null;
}

/** The version shown in the block hint. Omitted when there is only one version. The seed is omitted when there is none. */
export function versionTip(unit: Pick<UnitTakes, 'take' | 'takes'> | null | undefined): { k: number; seed: number | null } | null {
  if (!unit || unit.takes.length <= 1) return null;
  const take = activeTake(unit);
  return take ? { k: take.k, seed: take.seed } : null;
}

// ---- Which sentences are being redubbed ----

export interface RegroupJob {
  jobId: Id;
  groupId: string;
  units: Id[];
  seed: number | null;
}

/** The sentence-level redub running for this video (the frozen parameters contain `regroup`). */
export function regroupJobs(jobs: readonly JobRecord[], videoId: Id | null): RegroupJob[] {
  const out: RegroupJob[] = [];
  for (const job of jobs) {
    if (!isDubJob(job, videoId) || !jobLive(job)) continue;
    const regroup = job.pipeline?.params.regroup;
    if (!isObject(regroup) || !str(regroup.groupId) || !Array.isArray(regroup.units)) continue;
    out.push({
      jobId: job.jobId,
      groupId: regroup.groupId as string,
      units: regroup.units.filter((u): u is Id => typeof u === 'string' && u !== ''),
      seed: num(regroup.seed),
    });
  }
  return out;
}

/** The key for whether a sentence is being redubbed. */
export const queuedId = (groupId: string, unitId: Id) => `${groupId}\t${unitId}`;

/** The sentences being redubbed, sorted and joined into one string. Task progress events are frequent, and the UI uses it as the selector value so the timeline is not redrawn when the sentences have not changed. */
export function queuedKey(jobs: readonly JobRecord[], videoId: Id | null): string {
  const ids = new Set<string>();
  for (const job of regroupJobs(jobs, videoId)) for (const unitId of job.units) ids.add(queuedId(job.groupId, unitId));
  return [...ids].sort().join('\n');
}

export function queuedSet(key: string): ReadonlySet<string> {
  return new Set(key ? key.split('\n') : []);
}

/**
 * Overlays “在重配” (being redubbed) and the current version on the timeline's dub blocks. The blocks themselves are computed in model/timeline-dub.ts. These two come from the task and the plan's versions.
 * Unchanged blocks are returned as they are, without creating new objects.
 */
export function withRegen(blocks: ReadonlyMap<Id, DubBlock>, plans: ReadonlyMap<string, unknown>, queued: ReadonlySet<string>): ReadonlyMap<Id, DubBlock> {
  const byGroup = new Map<string, Map<Id, UnitTakes>>();
  const out = new Map<Id, DubBlock>();
  for (const [id, block] of blocks) {
    if (!block.unitId) {
      out.set(id, block);
      continue;
    }
    let takes = byGroup.get(block.groupId);
    if (!takes) {
      takes = planTakes(plans.get(block.groupId));
      byGroup.set(block.groupId, takes);
    }
    const version = versionTip(takes.get(block.unitId));
    const inQueue = queued.has(queuedId(block.groupId, block.unitId));
    out.set(id, version || inQueue ? { ...block, queued: inQueue, version } : block);
  }
  return out;
}

// ---- Sentences to regenerate ----

export interface FailedUnit {
  unitId: Id;
  /** `voice`: the voice is unavailable, so nothing was synthesized. `overlong`: it was synthesized but does not fit. */
  reason: 'voice' | 'overlong';
  overflowSeconds: number | null;
}

/** The sentences of this group on the timeline (the `unitId` on an instance). */
export function placedUnits(sequence: Sequence, groupId: string): Set<Id> {
  const out = new Set<Id>();
  for (const item of sequence.items) {
    const mark = dubMark(item);
    if (mark?.groupId === groupId && mark.unitId) out.add(mark.unitId);
  }
  return out;
}

/** Sentences that were not synthesized: `failed` (voice unavailable) or `needs-fit` (does not fit) in the plan, and not on the timeline. In plan order. */
export function failedUnits(planBody: unknown, placed: ReadonlySet<Id>): FailedUnit[] {
  const out: FailedUnit[] = [];
  for (const unit of planTakes(planBody).values()) {
    if (placed.has(unit.unitId)) continue;
    if (unit.status === 'failed') out.push({ unitId: unit.unitId, reason: 'voice', overflowSeconds: null });
    else if (unit.status === 'needs-fit') out.push({ unitId: unit.unitId, reason: 'overlong', overflowSeconds: unit.overflowSeconds });
  }
  return out;
}

/** Each sentence's sequence number in the plan (from 1; plan units follow the sentence order). When there is no translation to match, the dialog for changing a translation and redubbing uses it to write the sentence number. */
export function planUnitOrder(planBody: unknown): Map<Id, number> {
  const out = new Map<Id, number>();
  if (!isObject(planBody) || !Array.isArray(planBody.units)) return out;
  planBody.units.forEach((raw, i) => {
    const unitId = isObject(raw) ? unitIdOf(raw) : null;
    if (unitId && !out.has(unitId)) out.set(unitId, i + 1);
  });
  return out;
}

/** Candidates to regenerate: the not-synthesized sentences plus the too-fast blocks (design draft `regenCandidates`). No duplicates; not-synthesized ones come first. Sentences being redubbed are excluded. */
export function regenCandidates(
  failed: readonly FailedUnit[],
  blocks: Iterable<Pick<DubBlock, 'groupId' | 'unitId' | 'fast'>>,
  groupId: string,
  queued: ReadonlySet<string> = new Set(),
): Id[] {
  const out = new Set<Id>(failed.map((f) => f.unitId));
  for (const block of blocks) if (block.groupId === groupId && block.fast && block.unitId) out.add(block.unitId);
  return [...out].filter((unitId) => !queued.has(queuedId(groupId, unitId)));
}

export interface TrackCounts {
  /** The sentences on the timeline plus the not-synthesized sentences. */
  total: number;
  fast: number;
  muted: number;
  failed: number;
  queued: number;
}

/** The counts for one dub track (design draft `blockCounts`). Blocks queued for redub still count as too fast under the current version, since until the redub finishes, what was placed before is still this version. */
export function trackCounts(
  blocks: Iterable<Pick<DubBlock, 'fast' | 'muted' | 'groupId' | 'unitId'>>,
  failed: readonly FailedUnit[],
  queued: ReadonlySet<string>,
): TrackCounts {
  const counts = { total: failed.length, fast: 0, muted: 0, failed: failed.length, queued: 0 };
  for (const block of blocks) {
    counts.total++;
    const inQueue = !!block.unitId && queued.has(queuedId(block.groupId, block.unitId));
    if (inQueue) counts.queued++;
    if (block.fast) counts.fast++;
    if (block.muted) counts.muted++;
  }
  return counts;
}

// ---- Switching versions ----

/** Find this version's source by its artifact. The engine does not reclaim sources, and on import the source records `artifactId`. */
export function assetOfArtifact(assets: Record<Id, AssetRecord>, artifactId: string | null): { id: Id; revision: string } | null {
  if (!artifactId) return null;
  for (const asset of Object.values(assets)) {
    for (const [revision, value] of Object.entries(asset.revisions)) {
      const source = value?.provenance.source;
      if (isObject(source) && source.artifactId === artifactId) return { id: asset.id, revision };
    }
  }
  return null;
}

/** Whether this version can be put back on the timeline: it was placed before (it has a length), and its source can be found. */
export function takeRef(take: DubPlanTake, assets: Record<Id, AssetRecord>): { id: Id; revision: string } | null {
  if (takeSeconds(take) === null) return null;
  return take.assetRef ?? assetOfArtifact(assets, take.artifactId);
}

export interface SwitchTakeInput {
  sequence: Sequence;
  /** The current instance of this sentence (its position, volume and name follow it). */
  item: AudioItem;
  record: Pick<DocumentRecord, 'id' | 'revisions' | 'currentRevision'>;
  body: unknown;
  unitId: Id;
  k: number;
  assets: Record<Id, AssetRecord>;
}

/**
 * Switch to version k (one undoable edit): delete this sentence's instance in this group, put that version's source back in the same place (start, volume, mute and name stay as they are now; speed returns to 1), and write a new version of the dub plan (`take` becomes k; the version it replaces has its source recorded, so it can be switched back to later). Returns null when it is already the current version, when that version was never placed, or when its source cannot be found (the UI greys it out).
 */
export function switchTakeOperations(input: SwitchTakeInput): EditOperation[] | null {
  const { sequence, item, record, unitId, k, assets } = input;
  const mark = dubMark(item);
  if (!mark || mark.unitId !== unitId || !isObject(input.body) || !Array.isArray(input.body.units)) return null;
  const body = structuredClone(input.body) as Json & { units: unknown[] };
  const index = body.units.findIndex((raw) => isObject(raw) && unitIdOf(raw) === unitId);
  const raw = body.units[index] as Json | undefined;
  const view = unitTakes(raw);
  if (!raw || !view || view.take === k) return null;
  const target = view.takes.find((t) => t.k === k);
  const ref = target ? takeRef(target, assets) : null;
  if (!target || !ref) return null;
  const takes = view.takes.map((t) => ({ ...t }));
  const current = takes.find((t) => t.k === view.take);
  if (current && !current.assetRef) current.assetRef = { id: item.assetRef.id, revision: item.assetRef.revision };
  const chosen = takes.find((t) => t.k === k)!;
  chosen.assetRef = ref;
  const own = { ...(isObject(raw.extensions) && isObject(raw.extensions[DUB_EXTENSION]) ? (raw.extensions[DUB_EXTENSION] as Json) : {}) };
  own.takes = takes;
  own.take = k;
  if (target.seed !== null) own.seed = target.seed;
  else delete own.seed;
  if (target.fit !== null) own.fit = target.fit;
  if (target.tempo !== null) own.tempo = target.tempo;
  if (target.artifactId !== null) own.artifactId = target.artifactId;
  delete own.overflowSeconds;
  delete own.offTimeline;
  delete own.voiceUnavailable;
  raw.extensions = { ...(isObject(raw.extensions) ? raw.extensions : {}), [DUB_EXTENSION]: own };
  raw.status = 'ready';
  raw.actualSamples = String(target.samples);
  raw.sampleRate = target.sampleRate;
  if (target.text !== null) raw.script = { ...(isObject(raw.script) ? raw.script : {}), text: target.text };

  const olds = sequence.items.filter((other) => {
    const m = dubMark(other);
    return m?.groupId === mark.groupId && m.unitId === unitId;
  });
  const previous = record.revisions[record.currentRevision]?.summary;
  return [
    { type: 'deleteItems', sequenceId: sequence.id, itemIds: olds.map((o) => o.id) },
    {
      type: 'insertItems',
      sequenceId: sequence.id,
      items: [
        {
          type: 'audio',
          trackId: item.trackId,
          assetRef: ref,
          fromFrame: item.fromFrame,
          subframeOffset: item.subframeOffset,
          playDuration: { ticks: String(target.samples), timescale: target.sampleRate! },
          timeMap: { kind: 'linear', sourceIn: { ticks: '0', timescale: 1 }, rate: { num: 1, den: 1 } },
          mix: { volume: item.mix.volume, ...(item.mix.muted ? { muted: true } : {}) },
          ...(item.name !== undefined ? { name: item.name } : {}),
          role: item.role ?? 'dub',
          extensions: {
            ...(item.extensions ?? {}),
            [DUB_EXTENSION]: { groupId: mark.groupId, language: mark.language, unitId, take: k, ...(target.seed !== null ? { seed: target.seed } : {}) },
          },
        },
      ],
    },
    {
      type: 'putDocument',
      documentId: record.id,
      kind: 'dubbing-plan',
      body,
      summary: { ...(isObject(previous) ? previous : {}), groupId: mark.groupId },
    },
  ];
}

// ---- Listen to dub / Listen to original / Listen to both ----

export type DubSource = 'dub' | 'original' | 'both' | 'none';

/** The source-related parts of one dub group: the dub blocks, the background and vocals it separated itself, how the original is handled, and the original instances recorded. */
export interface SourceGroup {
  groupId: string;
  policy: DubOriginalAudio | null;
  /** The original instances of this group that are muted (for `mute`, or for `duck` after separation, which swaps in two track instances; recorded in the plan). */
  mutedItemIds: Id[];
}

/** How the original is handled, read from the dub plan body. */
export function sourceGroup(groupId: string, planBody: unknown): SourceGroup {
  const policy = isObject(planBody) ? planBody.originalDialoguePolicy : undefined;
  return {
    groupId,
    policy: policy === 'duck' || policy === 'mute' || policy === 'keep' ? policy : null,
    mutedItemIds: mutedItemsOf(planBody),
  };
}

function stemOf(item: SequenceItem): string | null {
  const own = item.extensions?.[DUB_EXTENSION];
  return isObject(own) && own.stem !== undefined ? str(own.groupId) : null;
}

/** This group's dub blocks and the two separated tracks (background and vocals). */
function groupItems(sequence: Sequence, groupId: string) {
  const dubs: SequenceItem[] = [];
  const beds: SequenceItem[] = [];
  for (const item of sequence.items) {
    if (dubMark(item)?.groupId === groupId) dubs.push(item);
    else if (stemOf(item) === groupId) beds.push(item);
  }
  return { dubs, beds };
}

const itemSilent = (item: SequenceItem) => (item.type === 'audio' ? item.mix.muted === true : item.type === 'video' ? !item.embeddedAudio.enabled : true);

/** Whether a batch of instances makes sound (the instance is not muted, and its track is not muted). */
function audible(sequence: Sequence, items: readonly SequenceItem[]): boolean {
  const muted = new Set(sequence.tracks.filter((t) => t.muted).map((t) => t.id));
  return items.some((item) => !itemSilent(item) && !muted.has(item.trackId));
}

/** The ducking rule triggered by this dub track group. */
function duckRules(sequence: Sequence, items: readonly SequenceItem[]) {
  const tracks = new Set(items.map((i) => i.trackId));
  return (sequence.ducking ?? []).filter((rule) => rule.trigger.kind === 'items' && rule.trigger.trackIds?.some((id) => tracks.has(id)));
}

/** What this group is currently playing (design draft model-tts.js `sourceOf`). */
export function sourceOf(sequence: Sequence, group: SourceGroup): DubSource {
  const { dubs } = groupItems(sequence, group.groupId);
  const dub = audible(sequence, dubs);
  const byId = new Map(sequence.items.map((i) => [i.id, i]));
  const rules = duckRules(sequence, dubs);
  let orig: boolean;
  // Muted originals (for `mute`, or for `duck` after separation, where the original instance was swapped for background and vocals tracks) check their own state.
  if (group.policy === 'mute' || group.mutedItemIds.length > 0) {
    const originals = group.mutedItemIds.flatMap((id) => byId.get(id) ?? []);
    orig = originals.length === 0 || audible(sequence, originals);
  } else if (group.policy === 'duck') {
    const targets = rules.flatMap((r) => r.target.itemIds ?? []).flatMap((id) => byId.get(id) ?? []);
    orig = targets.length === 0 || audible(sequence, targets);
  } else {
    orig = true;
  }
  const ducked = group.policy === 'duck' && rules.some((r) => r.enabled);
  if (dub && (!orig || ducked)) return 'dub';
  if (orig && !dub) return 'original';
  return orig && dub ? 'both' : 'none';
}

/** Whether “听配音” (listen to dub) can be done. For a `keep` group the original segments were not recorded, so listen-to-dub and listen-to-both are the same thing. */
export function canListenDub(group: SourceGroup): boolean {
  return group.policy === 'mute' || group.policy === 'duck';
}

/**
 * Turn a batch of instances on or off. If the whole track holds only these instances, change the track's mute (not each block's own mute). Otherwise change each instance's mute. Only send when the state actually changes.
 */
function sideOperations(sequence: Sequence, items: readonly SequenceItem[], on: boolean): EditOperation[] {
  const ops: EditOperation[] = [];
  const ids = new Set(items.map((i) => i.id));
  const trackIds = [...new Set(items.map((i) => i.trackId))];
  for (const trackId of trackIds) {
    const track = sequence.tracks.find((t) => t.id === trackId);
    if (!track) continue;
    const own = sequence.items.filter((i) => i.trackId === trackId);
    if (own.every((i) => ids.has(i.id))) {
      if (track.muted === on) ops.push({ type: 'updateTrack', sequenceId: sequence.id, trackId, muted: !on });
      continue;
    }
    for (const item of own) {
      if (!ids.has(item.id) || item.type !== 'audio') continue;
      if (!!item.mix.muted === on) ops.push({ type: 'setAudioMix', sequenceId: sequence.id, itemId: item.id, muted: !on });
    }
    if (on && track.muted) ops.push({ type: 'updateTrack', sequenceId: sequence.id, trackId, muted: false });
  }
  return ops;
}

/**
 * Switch the audio source (design draft model-tts.js `switchSource`):
 * - Listen to dub: this group's dub and tracks (background and vocals) are on. Other languages' dub and tracks are off. The recorded originals are muted (`mute` original-sentence instances, or the two-track instances after `duck` separation). For `duck`, ducking is turned on.
 * - Listen to original: all dub and tracks are off, and the originals are restored (originals muted by any group are unmuted, and ducking is off).
 * - Listen to both: this group's dub is on and the others are off. All tracks are off, since the original already contains background and vocals. The originals are restored, and ducking is off.
 * A `keep` group's originals are left alone. `groups` is all the dub groups on the sequence, including the `target` group.
 */
export function switchSourceOperations(
  sequence: Sequence,
  groups: readonly SourceGroup[],
  groupId: string,
  target: Exclude<DubSource, 'none'>,
): EditOperation[] {
  const ops: EditOperation[] = [];
  const self = groups.find((g) => g.groupId === groupId);
  if (!self) return ops;
  for (const group of groups) {
    const { dubs, beds } = groupItems(sequence, group.groupId);
    const mine = group.groupId === groupId;
    ops.push(...sideOperations(sequence, dubs, mine && target !== 'original'));
    ops.push(...sideOperations(sequence, beds, mine && target === 'dub'));
  }
  // Originals: only when listening to dub is this group's recorded segments muted (`mute` original-sentence instances, or the two-track instances after `duck` separation). In other cases, every group's muted originals are restored.
  const muteNow = new Set(target === 'dub' ? self.mutedItemIds : []);
  const touched = new Set<Id>();
  for (const group of groups) for (const id of group.mutedItemIds) touched.add(id);
  for (const id of muteNow) touched.add(id);
  for (const item of sequence.items) {
    if (!touched.has(item.id) || (item.type !== 'audio' && item.type !== 'video')) continue;
    const want = muteNow.has(item.id);
    if (itemSilent(item) !== want) ops.push({ type: 'setAudioMix', sequenceId: sequence.id, itemId: item.id, muted: want });
  }
  // Ducking: for this group, `duck` turns it on when listening to dub and off otherwise. Other groups' ducking is not touched (their dub is already off).
  if (self.policy === 'duck') {
    const { dubs } = groupItems(sequence, groupId);
    for (const rule of duckRules(sequence, dubs)) {
      const want = target === 'dub';
      if (rule.enabled !== want) ops.push({ type: 'setDucking', sequenceId: sequence.id, ruleId: rule.id, enabled: want });
    }
  }
  return ops;
}

// ---- Change the translation and redub ----

/**
 * Change the translation of several sentences (step one of “改译文并重配” (change translation and redub)). Synthesis reads the translation's `naturalText`, so that is what changes. For a unit whose subtitles show a rewrite, the rewrite is not touched and the subtitles stay as they are. The changed unit is marked `reviewed`, and its `textHash` is updated. Unchanged or empty text is not changed. Returns null when nothing changed.
 */
export async function retextTranslation(body: TranslationBody, texts: ReadonlyMap<Id, string>): Promise<{ body: TranslationBody; changed: Id[] } | null> {
  const changed: Id[] = [];
  const units = await Promise.all(
    body.units.map(async (unit) => {
      const wanted = texts.get(unit.id);
      const value = wanted?.trim() ?? '';
      if (value === '' || value === unit.naturalText.trim()) return unit;
      changed.push(unit.id);
      const alignment = unit.alignment && !unit.displayRewrite ? { ...unit.alignment, textHash: await textHash(value) } : unit.alignment;
      return { ...unit, naturalText: value, alignment, status: 'reviewed' as const };
    }),
  );
  return changed.length > 0 ? { body: { ...body, units }, changed } : null;
}
