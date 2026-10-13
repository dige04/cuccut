import type { Logger } from '@cuccut/harness';
import { TaskFailure, canonicalJson, sha256Hex, type JobManager, type TaskRun } from '@cuccut/jobs';
import { ProviderFailure } from '@cuccut/models';
import {
  RpcError,
  refOf,
  type FrozenLibraryEntry,
  type GrantDataKind,
  type Id,
  type JobRecord,
  type JobSubmitter,
  type LibraryEntry,
  type VoiceCloneCreateParams,
  type VoiceCloneRemoveParams,
  type VoiceCloneRemoveResult,
} from '@cuccut/protocol';
import type { VoiceCloner } from '@cuccut/providers';
import { assertVoiceUploadAllowed, libraryError, type LibraryStore } from '@cuccut/runtime-storage/library';
import { outboundPurpose, type GrantService } from '../grants/grant-service.ts';
import { RcLibrary } from '@cuccut/protocol/messages/runtime-core';
import { localizedOf, taskFailure, withLocalized, withMessageRef } from '../localized.ts';

/** Data sent out for cloning: the reference recording. */
export const VOICE_CLONE_DATA_KINDS: GrantDataKind[] = ['audio'];

/** The “model” in a clone task record. Cloning is not a call to a model. */
const CLONE_MODEL_ID = 'voice-clone';

/** Deadline for deleting the remote clone. */
const REMOVE_TIMEOUT_MS = 60_000;

export interface VoiceCloneServiceOptions {
  store: LibraryStore;
  jobs: JobManager;
  grants: GrantService;
  /** A Provider's clone interface. null when there is no clone interface (or the Provider is not recognized). */
  cloner(providerId: string): VoiceCloner | null;
  log: Logger;
}

/**
 * Voice cloning (architecture design §5.9): `library.createVoiceClone` and `library.removeVoiceClone`.
 *
 * - Creation is an ordinary task (`kind: 'voiceClone'`). Progress, cancellation and failure all live in the task. At submission the checks run in order: the consent declaration (`VOICE_CONSENT_REQUIRED`), whether the Provider has a clone interface (`VOICE_CLONE_UNSUPPORTED`), whether it is enabled, an existing valid clone (`VOICE_CLONE_EXISTS`), and the outbound-data grant and quota (data kind `audio`, §12.5). If any check fails, no task is created.
 * - At execution, the version fixed at submission is used, the consent declaration is checked again, the upload is reserved against the grant, uploaded, and settled. Afterwards the clone is recorded in the entry's `clones[providerId]`, with the digest of the reference recording that was uploaded. If the reference recording changed during the upload, the clone is immediately `stale`. The old clone it replaced is then requested for remote deletion. If that deletion fails, a warning is left (with its `voiceId`), and the task does not fail.
 * - Deletion requests the remote side first, and clears the record only after success (or when the remote side no longer has it). If the remote call fails, the record is kept and the failure is reported with the Provider's error code.
 */
export class VoiceCloneService {
  readonly #options: VoiceCloneServiceOptions;

  constructor(options: VoiceCloneServiceOptions) {
    this.#options = options;
  }

  async create(params: VoiceCloneCreateParams, submitter: JobSubmitter): Promise<{ jobId: Id }> {
    const { store, jobs, grants } = this.#options;
    if (submitter.kind === 'service') {
      throw withLocalized(
        libraryError('LIBRARY_ENTRY_NOT_APPLICABLE', 'invalid-request', '', { reason: 'service-client' }),
        RcLibrary.serviceClientNoLibraryVoice(),
      );
    }
    const entry = store.get({ library: 'voices', id: params.id });
    assertVoiceUploadAllowed(entry, params.providerId);
    const cloner = this.#cloner(params.providerId);
    if (!cloner.available()) {
      throw new RpcError('conflict', RcLibrary.clonerNotConfigured({ label: cloner.label }), {
        code: 'CAPABILITY_NOT_CONFIGURED',
        providerId: params.providerId,
      });
    }
    const existing = entry.clones?.[params.providerId];
    if (existing?.state === 'valid' && existing.referenceHash === entry.content.reference.sha256) {
      throw withLocalized(
        libraryError('VOICE_CLONE_EXISTS', 'conflict', '', { library: 'voices', id: entry.id, providerId: params.providerId }),
        RcLibrary.cloneExists({ name: entry.content.name, label: cloner.label }),
      );
    }
    const taskId = submitter.kind === 'agent' ? submitter.taskId : null;
    // Checks before submission: with no grant covering it, or insufficient quota, no task is created. Approvals exist only in sessions and external services, so here the request is rejected directly (consistent with `models.*`).
    const plan = grants.plan({
      capability: 'synthesizeSpeech',
      providerId: params.providerId,
      videoId: null,
      taskId,
      dataKinds: VOICE_CLONE_DATA_KINDS,
      ...outboundPurpose(RcLibrary.clonePurpose({ name: entry.content.name })),
    });
    if (plan.status === 'approval') {
      grants.assertCovered(
        { recipient: plan.item.recipient, dataKinds: VOICE_CLONE_DATA_KINDS, videoId: null, taskId, estimate: plan.item.estimate },
        cloner.label,
      );
    }
    const frozen: FrozenLibraryEntry = { library: 'voices', id: entry.id, version: entry.version, contentHash: entry.contentHash };
    const spec = { task: 'voiceClone' as const, ...frozen, library: 'voices' as const, providerId: params.providerId };
    const inputHash = `sha256:${sha256Hex(canonicalJson(spec))}`;
    // If a clone of the same voice, same Provider and same version is queued or in progress, return that task.
    const active = jobs
      .list()
      .find((job) => job.kind === 'voiceClone' && job.inputHash === inputHash && (job.state === 'queued' || job.state === 'running'));
    if (active) return { jobId: active.jobId };
    const name = params.name ?? entry.content.name;
    return jobs.submitTask(
      {
        kind: 'voiceClone',
        spec,
        videoId: null,
        contentHash: entry.content.reference.sha256,
        inputHash,
        providerId: params.providerId,
        modelId: CLONE_MODEL_ID,
        extra: { library: { entries: [frozen] } },
        ...(params.commandId ? { commandId: params.commandId } : {}),
        queue: { key: `voice-clone:${params.providerId}`, concurrency: 1 },
        run: (run) => this.#run(run, frozen, params.providerId, name, taskId),
      },
      submitter,
    );
  }

  async remove(params: VoiceCloneRemoveParams): Promise<VoiceCloneRemoveResult> {
    const { store, log } = this.#options;
    const { clone } = store.cloneOf(params.id, params.providerId);
    if (!clone) throw new RpcError('not-found', RcLibrary.noClone());
    let remote: VoiceCloneRemoveResult['remote'] = 'skipped';
    if (!params.localOnly) {
      const cloner = this.#cloner(params.providerId);
      try {
        remote = await cloner.remove(clone.voiceId, AbortSignal.timeout(REMOVE_TIMEOUT_MS));
      } catch (error) {
        const failure = providerError(error, params.providerId);
        log.warn('Deleting the remote clone failed', { id: params.id, providerId: params.providerId, code: failure.code });
        throw new RpcError('conflict', RcLibrary.remoteCloneNotDeleted({ label: cloner.label, reason: localizedOf(failure) }), {
          ...failure.details,
          code: failure.code,
          id: params.id,
        });
      }
    }
    await store.removeClone(params.id, params.providerId);
    log.info('Voice clone deleted', { id: params.id, providerId: params.providerId, remote });
    return { removed: true, remote };
  }

  #cloner(providerId: string): VoiceCloner {
    const cloner = this.#options.cloner(providerId);
    if (cloner) return cloner;
    throw withLocalized(
      libraryError('VOICE_CLONE_UNSUPPORTED', 'invalid-request', '', { providerId }),
      RcLibrary.cloneUnsupported({ providerId }),
    );
  }

  async #run(
    run: TaskRun,
    frozen: FrozenLibraryEntry,
    providerId: string,
    name: string,
    taskId: Id | null,
  ): Promise<NonNullable<JobRecord['result']>> {
    const { store, grants, jobs, log } = this.#options;
    run.phase('starting');
    // The version is fixed at submission. If the entry is changed or deleted while queued, the upload still uses the version from submission. JobManager releases it when the task ends.
    let entry: LibraryEntry<'voices'>;
    try {
      store.pin(run.jobId, [frozen]);
      entry = store.get({ library: 'voices', id: frozen.id, version: frozen.version });
    } catch {
      throw taskFailure('LIBRARY_ENTRY_GONE', RcLibrary.cloneVersionGone(), { library: 'voices', id: frozen.id });
    }
    // Consent declaration withdrawn while queued: do not upload.
    try {
      assertVoiceUploadAllowed(this.#currentOrFrozen(entry), providerId);
    } catch (error) {
      if (error instanceof RpcError) throw withMessageRef(new TaskFailure('VOICE_CONSENT_REQUIRED', error.message, error.details), error);
      throw error;
    }
    const cloner = this.#cloner(providerId);
    let settle: Awaited<ReturnType<GrantService['begin']>>;
    try {
      grants.ensureDefault(providerId, cloner.label, 'synthesizeSpeech');
      settle = await grants.begin({
        recipient: providerId,
        dataKinds: VOICE_CLONE_DATA_KINDS,
        videoId: null,
        taskId,
        estimate: null,
        label: cloner.label,
        jobId: run.jobId,
      });
    } catch (error) {
      if (error instanceof RpcError) {
        const details = (error.details ?? {}) as Record<string, unknown>;
        throw withMessageRef(new TaskFailure(typeof details.code === 'string' ? details.code : 'GRANT_REQUIRED', error.message, details), error);
      }
      throw error;
    }
    const reference = entry.content.reference;
    const previous = store.cloneOf(frozen.id, providerId).clone;
    run.phase('generating');
    let voiceId: string;
    try {
      ({ voiceId } = await cloner.create({
        name,
        file: store.filePath(entry, reference),
        fileName: reference.fileName,
        mediaType: reference.mediaType,
        description: entry.content.language ? `CucCut voice (${entry.content.language})` : null,
        signal: run.signal,
      }));
      settle({ state: 'completed' });
    } catch (error) {
      settle({ state: 'failed' });
      if (run.signal.aborted) throw error;
      const failure = providerError(error, providerId);
      throw new TaskFailure(failure.code, failure.message, failure.details);
    }
    run.phase('publishing');
    await store.recordClone(frozen.id, providerId, voiceId, reference.sha256);
    log.info('Voice clone created', { id: frozen.id, providerId, jobId: run.jobId });
    // The replaced old clone is requested for remote deletion. If deletion fails, only warn (the new clone is already recorded, and the old voiceId is in the warning).
    if (previous && previous.voiceId !== voiceId) {
      try {
        await cloner.remove(previous.voiceId, AbortSignal.any([run.signal, AbortSignal.timeout(REMOVE_TIMEOUT_MS)]));
      } catch (error) {
        const failure = providerError(error, providerId);
        const detail = RcLibrary.oldCloneNotDeleted({ voiceId: previous.voiceId, label: cloner.label, reason: localizedOf(failure) });
        run.warn({ code: 'VOICE_CLONE_OLD_NOT_DELETED', detail: detail.text, detailRef: refOf(detail) });
      }
    }
    const receipt = {
      schema: 'cuccut.voice-clone/1',
      voice: frozen,
      providerId,
      voiceId,
      referenceHash: reference.sha256,
      adapter: cloner.version,
    };
    const { artifactId } = await jobs.artifacts.put(Buffer.from(canonicalJson(receipt), 'utf8'));
    return { documentId: null, artifactId };
  }

  /** The consent declaration follows the entry's current version (withdrawing it is a new version). When the entry has been deleted, the fixed version is used. */
  #currentOrFrozen(frozen: LibraryEntry<'voices'>): LibraryEntry<'voices'> {
    try {
      return this.#options.store.get({ library: 'voices', id: frozen.id });
    } catch {
      return frozen;
    }
  }
}

/** Turns a Provider failure into a task error: the error code, a description (keys already removed), and details without request headers or addresses. */
function providerError(error: unknown, providerId: string): { code: string; message: string; details: Record<string, unknown> } {
  if (error instanceof ProviderFailure) {
    const { code, status, reason } = error.details;
    const fallback =
      error.kind === 'unavailable-remote'
        ? 'PROVIDER_UNAVAILABLE'
        : error.kind === 'protocol'
          ? 'MODEL_OUTPUT_INVALID'
          : 'PROVIDER_REJECTED';
    return {
      code: typeof code === 'string' ? code : fallback,
      message: error.message,
      details: {
        providerId,
        ...(typeof status === 'number' ? { status } : {}),
        ...(typeof reason === 'string' ? { reason } : {}),
      },
    };
  }
  if (error instanceof RpcError) {
    const details = (error.details ?? {}) as Record<string, unknown>;
    return { code: typeof details.code === 'string' ? details.code : 'PROVIDER_REJECTED', message: error.message, details: { providerId } };
  }
  return { code: 'INTERNAL', message: error instanceof Error ? error.message : String(error), details: { providerId } };
}
