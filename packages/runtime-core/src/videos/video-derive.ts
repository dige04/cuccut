import fs from 'node:fs/promises';
import path from 'node:path';
import {
  RpcError,
  type DocumentRecord,
  type EditOperation,
  type Id,
  type TransactionReceipt,
  type VideoCreated,
  type VideoDeriveParams,
  type VideoDeriveResult,
  type VideoOpenResult,
  type VideoSnapshot,
} from '@cuccut/protocol';
import { CAPTION_DOCUMENT_REF, PipelineStepError, existingCaptionLayer, planCaptionLayer, type CaptionSource } from '@cuccut/jobs';
import { RcAgentTools } from '@cuccut/protocol/messages/runtime-core';
import type { TrustedPrincipal } from '../gateway.ts';
import {
  DERIVATION_KIND,
  DeriveError,
  alignCrops,
  alignRange,
  assetFileKey,
  clockLabel,
  cuesInRange,
  derivationKey,
  derivationNeeds,
  pickFields,
  planDerivation,
  planDerivationTrim,
  timelineWords,
  type DerivePick,
  type DeriveSettings,
} from '../agent-tools/derive-plan.ts';
import { videoPlace } from './pipeline-targets.ts';
import { hasVideoDb, videoDirName, type EngineProtection, type VideoLocation, type VideoService } from './video-service.ts';

/**
 * Derived sub-video (`videos.derive`, tool `videos_derive`, architecture design §3.5 “Deriving a sub-video”): copies the parent video, cuts away everything outside the range, and builds it beside the parent (same source directory, same directory level), with a directory name ending in the idempotency key. Planning is in `derive-plan.ts`.
 *
 * Idempotent: the same parent video version, with the same range and settings, gives the same key. The key is recognized at three levels: a sub-video in the Space index that records this key (`findDerived`); a directory at the same level, ending in `-<key>`, that has a database; and receipts persisted in the sub-video by command ID (one each for copy, finishing and the subtitle layer, resumed from where it was interrupted).
 */

export interface DeriveDeps {
  videos: VideoService;
  /** A sub-video in the Space index derived from this parent with the same key (absolute path of the video directory); null if none. */
  findDerived?: (parentVideoId: Id, key: string) => Promise<string | null> | string | null;
}

/** Finds sub-videos by the video facts in the Space index (`origin`). */
export function spaceDerivedFinder(space: {
  videos(): { dir: string }[];
  readonly index: { at(dir: string): { facts: { origin?: { parentVideoId: Id; key: string } | null } } | null } | null;
}): NonNullable<DeriveDeps['findDerived']> {
  return (parentVideoId, key) => {
    for (const video of space.videos()) {
      const origin = space.index?.at(video.dir)?.facts.origin;
      if (origin?.parentVideoId === parentVideoId && origin.key === key) return video.dir;
    }
    return null;
  };
}

export interface DeriveOptions {
  taskId?: Id;
  /** The protection scope of the task this call belongs to (meaningful only for the parent video; sub-videos are newly created). */
  protections?: (videoId: Id) => EngineProtection[];
}

/** Default sub-video name: “parent video name · mm:ss–mm:ss”. */
export function defaultDerivedName(parentName: string, range: { start: number; end: number }): string {
  return `${parentName} · ${clockLabel(range.start)}–${clockLabel(range.end)}`;
}

/**
 * Parses the arguments: fills in the settings, reads the transcript and translations to copy, aligns the range (the boundaries stay in the pauses between sentences, `alignRange`), and computes the idempotency key. Callers use this before confirmation to get the name and times for the summary; `videos.derive` then plans with the same result.
 */
export async function prepareDerive(videos: Pick<VideoService, 'document'>, snapshot: VideoSnapshot, params: Omit<VideoDeriveParams, 'videoId'>) {
  const sequence = snapshot.sequences[snapshot.rootSequenceId]!;
  const settings: DeriveSettings = {
    width: params.width ?? sequence.canvas.width,
    height: params.height ?? sequence.canvas.height,
    fit: params.fit ?? null,
    crop: params.crop ?? null,
    captions: params.captions ?? true,
    translations: params.translations ?? true,
    chapters: params.chapters ?? true,
  };
  const needs = deriveCall(() => derivationNeeds(snapshot, settings));
  const documents = new Map<Id, unknown>();
  for (const id of needs.documentIds) documents.set(id, (await videos.document(snapshot.id, id)).body);
  const range = deriveCall(() => alignRange(sequence, params.start, params.end, timelineWords(snapshot, documents)));
  // Segment framing is snapped to frames and cut to the range before the settings are taken (the idempotency key is computed after alignment). When not given, the field is left out, so the keys of old calls do not change.
  const aligned = params.crops?.length ? alignCrops(sequence, range, params.crops) : null;
  if (aligned) settings.crops = aligned.crops;
  const key = derivationKey({ parentVideoId: snapshot.id, parentRevision: snapshot.revision, range, settings });
  const name = params.name?.trim() || defaultDerivedName(snapshot.name, range);
  return { sequence, range, settings, key, name, needs, documents, cropsAdjusted: aligned?.adjusted ?? 0 };
}

/** Rejections from planning are turned into RPC errors (`details.code` is `DERIVE_*`). */
function deriveCall<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    throw deriveRpcError(error);
  }
}

export function deriveRpcError(error: unknown): unknown {
  if (!(error instanceof DeriveError)) return error;
  const message =
    error.code === 'DERIVE_RANGE_EMPTY'
      ? RcAgentTools.deriveRangeEmpty()
      : error.code === 'DERIVE_UNSUPPORTED_ITEM'
        ? RcAgentTools.deriveUnsupportedItem({ kind: String(error.details.itemType ?? error.details.kind ?? '') })
        : RcAgentTools.deriveParentUnplaced();
  return new RpcError('invalid-request', message, { code: error.code, ...error.details });
}

const CAPTION_ATTEMPTS = 3;

export async function deriveVideo(
  deps: DeriveDeps,
  params: VideoDeriveParams,
  principal: TrustedPrincipal,
  options: DeriveOptions = {},
): Promise<{ result: VideoDeriveResult; opened: VideoOpenResult }> {
  const { videos } = deps;
  const parent = videos.mirror(params.videoId)?.video;
  if (!parent) throw new RpcError('not-found', RcAgentTools.deriveParentUnplaced(), { code: 'VIDEO_NOT_OPEN' });
  const { sequence, range, settings, key, name, needs, documents, cropsAdjusted } = await prepareDerive(videos, parent, params);

  const place = videoPlace(videos, parent.id) as { root: string; file: string; scope: VideoLocation['scope'] } | null;
  // The parent video is the source directory itself, or was not opened from a project or session: there is no place beside it for a sub-video.
  if (!place || place.file === '.' || place.file === '') throw deriveRpcError(new DeriveError('DERIVE_PARENT_UNPLACED'));
  const location = (file: string): VideoLocation => ({ root: place.root, file, scope: place.scope });

  // ---- Sub-video: recognize an existing one, or create a new one ----
  const siblingsRel = path.posix.dirname(place.file.split(path.sep).join('/'));
  const indexed = await deps.findDerived?.(parent.id, key);
  const indexedRel = indexed ? path.relative(place.root, indexed).split(path.sep).join('/') : null;
  const fromIndex = indexedRel && !indexedRel.startsWith('..') && !path.isAbsolute(indexedRel) && (await hasVideoDb(indexed!)) ? indexedRel : null;
  const existing = fromIndex ?? (await findSibling(path.join(place.root, siblingsRel), key, siblingsRel));
  let opened: VideoOpenResult;
  let reused = false;
  if (existing) {
    opened = await videos.open(location(existing), principal);
    reused = true;
  } else {
    const dirName = `${videoDirName(name).slice(0, 66).trim()}-${key}`;
    const rel = siblingsRel === '.' ? dirName : `${siblingsRel}/${dirName}`;
    const dir = path.join(place.root, rel);
    await fs.mkdir(dir).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'EEXIST') throw error;
    });
    if (await hasVideoDb(dir)) {
      opened = await videos.open(location(rel), principal);
      reused = true;
    } else {
      opened = await videos.create(
        { name, fps: sequence.fps, width: settings.width, height: settings.height, commandId: `derive:${key}:create` },
        place.root,
        place.scope,
        principal,
        rel,
      );
    }
  }
  const childId = opened.ref.videoId;
  const child = () => videos.mirror(childId)?.video ?? opened.snapshot.video;
  const label = RcAgentTools.deriveVideoLabel({ name: parent.name }).text;
  const guard = { ...(options.taskId ? { taskId: options.taskId } : {}), protections: options.protections?.(childId) ?? [] };

  // ---- Read the parent video's media files and plan (the document body was read in prepareDerive) ----
  const files = new Map<string, string>();
  for (const asset of needs.assets) {
    const found = await videos.assetFile(parent.id, asset.id, asset.revision).catch((error: unknown) => {
      // Linked assets that cannot be handed out through the media channel (directories, subtitle files, etc.) cannot be copied.
      if (error instanceof RpcError && error.code === 'forbidden') {
        throw deriveRpcError(new DeriveError('DERIVE_UNSUPPORTED_ITEM', { assetId: asset.id, kind: parent.assets[asset.id]?.kind ?? 'asset' }));
      }
      throw error;
    });
    files.set(assetFileKey(asset), path.resolve(found.root, found.file));
  }
  const childSequence = child().sequences[child().rootSequenceId]!;
  const plan = deriveCall(() =>
    planDerivation({
      snapshot: parent,
      range,
      settings,
      key,
      target: { sequenceId: childSequence.id, tracks: childSequence.tracks, background: childSequence.canvas.background },
      files,
      documents,
      labels: { derivationName: RcAgentTools.derivationDocumentName().text },
      cropsAdjusted,
      pick: { ...(params.hook !== undefined ? { hook: params.hook } : {}), ...(params.reason !== undefined ? { reason: params.reason } : {}), ...(params.notes ? { notes: params.notes } : {}) },
    }),
  );

  // ---- First receipt: copy ----
  const copyCommand = `derive:${key}:apply`;
  let copyReceipt: TransactionReceipt | null = await videos.receiptFor(childId, copyCommand);
  const alreadyCopied = Object.values(child().documents).some((d) => d.kind === DERIVATION_KIND);
  if (!copyReceipt && !alreadyCopied) {
    const result = await videos.apply(
      { videoId: childId, commandId: copyCommand, expectedRevision: child().revision, operations: plan.operations as never, label },
      principal,
      guard,
    );
    copyReceipt = result.receipt;
  }
  const refs = copyReceipt?.refs ?? {};

  // ---- Second receipt: finishing and cut points ----
  const trimCommand = `derive:${key}:trim`;
  let trimReceipt: TransactionReceipt | null = copyReceipt ? await videos.receiptFor(childId, trimCommand) : null;
  if (copyReceipt && !trimReceipt) {
    const now = child();
    const operations = planDerivationTrim(plan, { sequence: now.sequences[now.rootSequenceId]!, documents: now.documents }, refs);
    if (operations.length) {
      const result = await videos.apply(
        { videoId: childId, commandId: trimCommand, expectedRevision: now.revision, operations: operations as never, label },
        principal,
        guard,
      );
      trimReceipt = result.receipt;
    }
  }
  const trimRefs = trimReceipt?.refs ?? {};

  // ---- Subtitle layer: following the edited timeline, at most one layer per asset ----
  const warnings: VideoDeriveResult['warnings'] = [...plan.warnings];
  const captions: VideoDeriveResult['captions'] = [];
  if (settings.captions) {
    // Only subtitles still visible after cutting are counted: those inside the source range that plays within the range (subtitles are on the asset clock).
    const keptOf = (assetId: Id | undefined) => plan.kept.filter((k) => k.assetId === assetId);
    const reader = {
      document: async (v: Id, d: Id, revision?: string) => {
        const content = await videos.document(v, d, revision);
        return { revision: content.revision, body: content.body };
      },
    };
    for (const [n, speech] of captionSources(plan.speech, parent).entries()) {
      const documentId = refs[speech.ref];
      if (!documentId) continue;
      const source = { kind: 'speech' as const, documentId };
      const inRange = keptOf(speech.assetId);
      const made = await captionLayer(videos, reader, childId, source, `derive:${key}:captions:${n + 1}`, principal, guard, inRange);
      if (made === 'skipped') warnings.push({ code: 'captions-skipped', documentId });
      else captions.push({ documentId: made.documentId, sourceDocumentId: documentId, cueCount: made.cueCount });
    }
    // Translation: a translation of the subtitle layer in the parent video also gets a layer (matching the parent); when the parent's original subtitle layer is shown, it is bilingual.
    const parentSequence = parent.sequences[parent.rootSequenceId]!;
    for (const [n, t] of plan.trim.translations.entries()) {
      const documentId = trimRefs[`translation-${n + 1}`];
      if (!documentId || !existingCaptionLayer(parentSequence, parent.documents, t.from)) continue;
      const speechId = parent.documents[t.from]?.sourceDocumentId;
      const original = speechId ? existingCaptionLayer(parentSequence, parent.documents, speechId) : null;
      const bilingual = !!original && parentSequence.items.some((item) => original.itemIds.includes(item.id) && item.enabled);
      const source = { kind: 'translation' as const, documentId, bilingual, cues: 'sentence-alignment' as const };
      const inRange = keptOf(plan.speech.find((s) => s.ref === t.speechRef)?.assetId);
      const made = await captionLayer(videos, reader, childId, source, `derive:${key}:translation-captions:${n + 1}`, principal, guard, inRange);
      if (made === 'skipped') warnings.push({ code: 'captions-skipped', documentId });
      else captions.push({ documentId: made.documentId, sourceDocumentId: documentId, cueCount: made.cueCount });
    }
  }

  const final = child();
  const translations = Object.values(final.documents)
    .filter((d) => d.kind === 'translation' && d.sourceDocumentId && Object.values(refs).includes(d.sourceDocumentId))
    .map((d) => ({ documentId: d.id, sourceDocumentId: d.sourceDocumentId! }));
  const video: VideoCreated = {
    videoId: childId,
    videoName: final.name,
    target: { ...(place.scope), path: opened.ref.relPath },
    videoRevision: final.revision,
  };
  // The selection note is echoed according to the current state of the derived source document in the sub-video. When an existing sub-video is recognized, it is not rewritten: the echo is the original one, not the one passed this time.
  const derivationDocumentId = Object.values(final.documents).find((d) => d.kind === DERIVATION_KIND)?.id ?? null;
  const derivationBody = derivationDocumentId ? ((await videos.document(childId, derivationDocumentId)).body as DerivePick | null) : null;
  const pick = pickFields(derivationBody ?? undefined);
  const result: VideoDeriveResult = {
    video,
    reused,
    key,
    range: { start: range.start, end: range.end },
    primaryAssetId: plan.derivation.primaryAssetId,
    cuts: plan.cuts,
    itemCount: plan.itemCount,
    ...(settings.crops ? { framing: settings.crops } : {}),
    derivationDocumentId,
    ...pick,
    speech: plan.speech.flatMap((s) => (refs[s.ref] ? [{ documentId: refs[s.ref]!, sourceDocumentId: s.from, words: s.words }] : [])),
    translations,
    captions,
    warnings,
  };
  return { result, opened: { ...opened, snapshot: videos.mirror(childId) ?? opened.snapshot } };
}

/** A directory at the same level, ending in `-<key>`, that has a database (relative to the source directory). */
async function findSibling(dir: string, key: string, rel: string): Promise<string | null> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.endsWith(`-${key}`)) continue;
    if (await hasVideoDb(path.join(dir, entry.name))) return rel === '.' ? entry.name : `${rel}/${entry.name}`;
  }
  return null;
}

/** At most one subtitle layer per asset: the transcript from the parent video that already has a subtitle layer takes priority; otherwise the last one. */
function captionSources<S extends { from: Id; assetId: Id }>(speech: S[], parent: VideoSnapshot): S[] {
  const sequence = parent.sequences[parent.rootSequenceId]!;
  const byAsset = new Map<Id, S>();
  for (const s of speech) {
    const current = byAsset.get(s.assetId);
    const layered = existingCaptionLayer(sequence, parent.documents, s.from) !== null;
    const currentLayered = current ? existingCaptionLayer(sequence, parent.documents, current.from) !== null : false;
    if (!current || layered || !currentLayered) byAsset.set(s.assetId, s);
  }
  return [...byAsset.values()];
}

async function captionLayer(
  videos: VideoService,
  reader: Parameters<typeof planCaptionLayer>[0],
  videoId: Id,
  source: CaptionSource,
  command: string,
  principal: TrustedPrincipal,
  guard: { taskId?: Id; protections: EngineProtection[] },
  kept: readonly { from: number; to: number }[],
): Promise<{ documentId: Id; cueCount: number | null } | 'skipped'> {
  for (let attempt = 1; ; attempt++) {
    const commandId = attempt === 1 ? command : `${command}:${attempt}`;
    const done = await videos.receiptFor(videoId, commandId);
    const video = videos.mirror(videoId)!.video;
    const sequence = video.sequences[video.rootSequenceId]!;
    const layer = existingCaptionLayer(sequence, video.documents, source.documentId);
    if (done || layer) return { documentId: layer?.documentId ?? done?.refs?.caption ?? source.documentId, cueCount: null };
    let plan: Awaited<ReturnType<typeof planCaptionLayer>>;
    try {
      plan = await planCaptionLayer(reader, {
        videoId,
        sequence,
        documents: video.documents as Record<Id, DocumentRecord>,
        source,
        pairOriginal: source.kind === 'speech',
      });
    } catch (error) {
      if (error instanceof PipelineStepError) return 'skipped';
      throw error;
    }
    if ('reason' in plan) return 'skipped';
    try {
      const result = await videos.apply(
        {
          videoId,
          commandId,
          expectedRevision: video.revision,
          operations: plan.operations as EditOperation[] as never,
          label: RcAgentTools.captionsLabel().text,
        },
        principal,
        guard,
      );
      const document = plan.operations.find((o) => o.type === 'putDocument' && o.ref === CAPTION_DOCUMENT_REF) as { body?: unknown } | undefined;
      return { documentId: result.receipt.refs?.caption ?? source.documentId, cueCount: cuesInRange(document?.body, kept) ?? plan.cueCount };
    } catch (error) {
      const code = error instanceof RpcError ? (error.details as { code?: unknown } | null)?.code : undefined;
      const conflict = error instanceof RpcError && (error.code === 'conflict' || code === 'PROJECT_REVISION_CONFLICT');
      if (conflict && attempt < CAPTION_ATTEMPTS) continue;
      throw error;
    }
  }
}
