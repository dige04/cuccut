import path from 'node:path';
import { RpcError, type Id, type PipelineCreateScope, type PipelineCreateTarget, type PipelineVideoTarget } from '@cuccut/protocol';
import type { VideoPlace } from '../application-ledger.ts';
import { JobsParams } from '@cuccut/protocol/messages/jobs/params.ts';
import { JobsVideoTarget } from '@cuccut/protocol/messages/jobs/video-target.ts';
import { invalid } from './params.ts';
import type { PipelineStep } from './pipeline.ts';

/**
 * Targets for video tools (architecture design §7.9): `{ videoId }`, `{ entryId }` or `{ create }`. On submit, `PipelineRunner` resolves `entryId` to a video and opens it under a Runtime lease (released when the pipeline ends, is cancelled, or fails), and records it as the pipeline's first step `target`. Later steps recognize only `videoId`.
 * `create` is made by the step of the pipeline that accepts it, in the project or in the session's source directory (link import creates it after the download, named from the page title; transcription with `media` given creates it and imports that file).
 */

/** Name of the target-resolving step: pipelines that accept `target` put `targetStep()` first. */
export const TARGET_STEP = 'target';

/** A video lease held by a pipeline: the video, its location (used to reopen it on retry), and the release of the lease. */
export interface VideoLease {
  videoId: Id;
  place: VideoPlace;
  release(): void;
}

/** Video target the Runtime gives a pipeline: finds the location of a Space entry, opens it under a lease, and creates one in a project or session. */
export interface PipelineTargets {
  /**
   * Locates a video entry in the Space without opening the video. A missing entry gives `not-found`. An entry in the trash gives `conflict` (`SPACE_ENTRY_TRASHED`). An entry that is not a video gives `invalid-request` (`SPACE_ENTRY_NOT_VIDEO`).
   */
  entry(entryId: Id): Promise<VideoPlace>;
  /**
   * Opens the video at this location under a Runtime lease (the same path as recovery after a restart). If another connection already has it open, that instance is used directly. When another process holds the lock, throws `conflict` (`VIDEO_LOCKED`). If it no longer exists, `not-found`.
   */
  lease(place: VideoPlace): Promise<VideoLease>;
  /**
   * Reserves a directory for a new video in the project directory (or the session's source directory: the project directory when the session belongs to a project, otherwise the session's working directory). As with `videos.create`, it picks a name whose directory does not exist yet and creates it as an empty directory first. Once reserved, other creations skip it, so any video that later appears at this location can only be one created by this reservation. The pipeline records the location before creating, and on retry uses it to adopt a video that was already created (`video-create.ts`).
   */
  reserve(request: PipelineCreateScope & { name: string }): Promise<VideoPlace>;
  /**
   * Creates a video in the project or session's source directory and holds its lease (the same path as `videos.create` and the agent's `videos_create`; the video is registered in the same scope). The same `commandId` creates only once per run. When `place` is given (reserved by `reserve`), the video is created there. If a video is already there (interrupted after creation and before the output was recorded), it is adopted and not created again.
   */
  create(request: PipelineCreateScope & { name: string; commandId: Id; place?: VideoPlace }): Promise<VideoLease>;
}

/** Declares which targets a pipeline accepts. When `create` is false, `{ create }` is rejected with `PIPELINE_TARGET_UNSUPPORTED`. */
export interface PipelineTargetSupport {
  create: false | { media: boolean };
}

/** Validated target (`videoId` and `target` combined). null when neither is given. */
export type ResolvedTargetParam = { videoId: Id } | { entryId: Id } | { create: PipelineCreateTarget };

/**
 * Reads `target` and the top-level `videoId` from the `pipelines.start` parameters. A bad shape gives `invalid-request`. When both are given and refer to different videos, `invalid-request` (`entryId` is known only after resolution, so the caller compares again). When the pipeline does not accept creation, `PIPELINE_TARGET_UNSUPPORTED`.
 */
export function readVideoTarget(raw: Record<string, unknown>, support: PipelineTargetSupport): ResolvedTargetParam | null {
  const videoId = raw.videoId;
  if (raw.target === undefined) return typeof videoId === 'string' && videoId.trim() !== '' ? { videoId } : null;
  const target = checkTarget(raw.target, support);
  if (videoId !== undefined) {
    if ('create' in target) throw invalid('target', JobsParams.createExcludesVideoId());
    if ('videoId' in target && target.videoId !== videoId) throw invalid('target', JobsVideoTarget.notSameVideo());
  }
  return target;
}

function checkTarget(value: unknown, support: PipelineTargetSupport): PipelineVideoTarget {
  if (!isRecord(value)) throw invalid('target', JobsVideoTarget.targetShapeOneOf());
  const keys = Object.keys(value);
  if (keys.length !== 1) throw invalid('target', JobsVideoTarget.targetShapeOneOf());
  const [key] = keys;
  if (key === 'videoId' || key === 'entryId') {
    const id = value[key];
    if (typeof id !== 'string' || id.trim() === '' || id.length > 200) throw invalid(`target.${key}`, JobsParams.mustBeNonEmptyString());
    return key === 'videoId' ? { videoId: id } : { entryId: id };
  }
  if (key !== 'create') throw invalid('target', JobsVideoTarget.targetShapeOneOf());
  if (!support.create) {
    throw new RpcError('invalid-request', JobsVideoTarget.createUnsupported(), {
      code: 'PIPELINE_TARGET_UNSUPPORTED',
    });
  }
  return { create: readCreateTarget(value.create, support.create.media) };
}

/**
 * Shape of `target.create`: exactly one of `projectId` and `conversationId` is given (created in the project, or in the session's source directory). `name` is optional. `media` may be given only when the pipeline accepts it.
 */
export function readCreateTarget(value: unknown, media: boolean): PipelineCreateTarget {
  if (!isRecord(value)) throw invalid('target.create', JobsVideoTarget.createShape());
  for (const key of Object.keys(value)) {
    if (key === 'media' && !media) throw invalid('target.create.media', JobsVideoTarget.mediaNotAllowed());
    if (key !== 'projectId' && key !== 'conversationId' && key !== 'name' && key !== 'media') {
      throw invalid('target.create', JobsVideoTarget.unknownField({ key }));
    }
  }
  const { projectId, conversationId, name } = value;
  if (projectId !== undefined && conversationId !== undefined) throw invalid('target.create', JobsVideoTarget.scopeOnlyOne());
  if (projectId === undefined && conversationId === undefined) throw invalid('target.create', JobsVideoTarget.scopeRequired());
  const scopeKey = conversationId !== undefined ? 'conversationId' : 'projectId';
  const scopeId = value[scopeKey];
  if (typeof scopeId !== 'string' || scopeId.trim() === '' || scopeId.length > 200) {
    throw invalid(`target.create.${scopeKey}`, JobsParams.mustBeNonEmptyString());
  }
  if (name !== undefined && (typeof name !== 'string' || name.trim() === '' || name.length > 200)) {
    throw invalid('target.create.name', JobsVideoTarget.nameLength());
  }
  if (value.media !== undefined && (typeof value.media !== 'string' || !path.isAbsolute(value.media) || value.media.length > 4096)) {
    throw invalid('target.create.media', JobsVideoTarget.mediaPath());
  }
  return {
    ...createScope(scopeKey, scopeId),
    ...(typeof name === 'string' ? { name: name.trim() } : {}),
    ...(typeof value.media === 'string' ? { media: value.media } : {}),
  };
}

function createScope(key: 'projectId' | 'conversationId', id: Id): PipelineCreateScope {
  return key === 'projectId' ? { projectId: id } : { conversationId: id };
}

/** Where the new target goes (without the name and media). */
export function createScopeOf(create: PipelineCreateTarget): PipelineCreateScope {
  return create.projectId !== undefined ? { projectId: create.projectId } : { conversationId: create.conversationId };
}

/**
 * The target-resolving step: completed by `PipelineRunner` on submit (an `entryId` target is marked complete with output `{ entryId, videoId, place }`; others are marked skipped). It never reaches `run` when executed.
 */
export function targetStep<P>(): PipelineStep<P> {
  return {
    name: TARGET_STEP,
    label: () => JobsVideoTarget.stepLabel(),
    holdsVideo: true,
    run: () => Promise.reject(new Error('The target step is resolved by PipelineRunner at submission')),
  };
}

/**
 * JSON Schema of the `target` parameter (returned by `pipelines.list`). `create` is listed only when the pipeline accepts creation, and `media` only when it accepts media. For `create`, exactly one of `projectId` and `conversationId` is given.
 */
export function targetSchema(
  description: string,
  create: { projectId: string; conversationId: string; name: string; media?: string } | null,
): Record<string, unknown> {
  const one = (key: string, value: Record<string, unknown>) => ({
    type: 'object',
    properties: { [key]: value },
    required: [key],
    additionalProperties: false,
  });
  return {
    description,
    oneOf: [
      // i18n-ignore-start: parameter descriptions (JSON Schema for the agent)
      one('videoId', { type: 'string', description: 'Video that is open' }),
      one('entryId', { type: 'string', description: 'Video Space entry (does not need to be open)' }),
      // i18n-ignore-end
      ...(create
        ? [
            one('create', {
              type: 'object',
              properties: {
                projectId: { type: 'string', description: create.projectId },
                conversationId: { type: 'string', description: create.conversationId },
                name: { type: 'string', maxLength: 200, description: create.name },
                ...(create.media ? { media: { type: 'string', maxLength: 4096, description: create.media } } : {}),
              },
              oneOf: [{ required: ['projectId'] }, { required: ['conversationId'] }],
              additionalProperties: false,
            }),
          ]
        : []),
    ],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
