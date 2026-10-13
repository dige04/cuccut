import path from 'node:path';
import { PipelineStepError, libraryVoice, type DubSpeech, type DubVoice, type JobLibrary, type PipelineDefinition } from '@cuccut/jobs';
import { ProviderFailure, speechParameters, type GenerationSelection, type ModelServices } from '@cuccut/models';
import { RpcError, estimateCallCost, refOf, type Localized, type GrantDataKind, type JobSubmitter, type SpeechFormat } from '@cuccut/protocol';
import type { GrantService } from '../grants/grant-service.ts';
import { RcModels } from '@cuccut/protocol/messages/runtime-core';
import { localizedOf } from '../localized.ts';

/**
 * Sentence-by-sentence synthesis for dubbing (architecture design §7.9). The flow calls the speech synthesis Provider in-process rather than submitting through JobManager, so selection, parameter checks, library voice resolution and authorization all live here:
 *
 * - The Provider and model are chosen at start (§6.2); the voice, language and format are checked against the model (same `speechParameters` as `models.synthesizeSpeech`);
 *   WAV is preferred for the format (alignment is counted in samples, so it is unaffected by MP3 encoder delay);
 * - `library:<id>` is resolved to a valid clone on this Provider on every call (a clone may expire or be deleted between calls);
 * - Each call (including retries) reserves one authorization and budget and settles when it ends; what is sent out is the translation (`transcript`). Local and node Providers do not go through authorization;
 * - Provider failures are mapped to the task's error codes (same as generation tasks).
 */

/** Data sent out for dubbing: the translated text to synthesize. */
export const DUB_DATA_KINDS: GrantDataKind[] = ['transcript'];

const FORMAT_PREFERENCE: SpeechFormat[] = ['wav', 'flac', 'mp3'];
/** Library voices are only for users on this machine (same as session submission for `models.synthesizeSpeech`). */
const PIPELINE_SUBMITTER: JobSubmitter = { kind: 'pipeline', id: 'dub' };

export function dubSpeech(options: { services: ModelServices; grants: GrantService; library: JobLibrary | undefined }): DubSpeech {
  const { services, grants, library } = options;
  const select = (provider?: string, model?: string) =>
    services.selectGeneration('synthesizeSpeech', {
      ...(provider !== undefined ? { provider } : {}),
      ...(model !== undefined ? { model } : {}),
    });
  /** Freezes the parameters of one call; `library:<id>` is replaced with the cloned voiceId. */
  const parameters = (
    selection: GenerationSelection<'synthesizeSpeech'>,
    voice: DubVoice | null,
    request: { text: string; voice?: string; language: string; format?: SpeechFormat; seed?: number },
  ) => {
    const resolved = voiceFromLibrary(library, request.voice, selection.providerId);
    return speechParameters(selection, {
      text: request.text,
      language: request.language,
      ...(resolved ? { voice: resolved.voiceId } : request.voice !== undefined ? { voice: request.voice } : {}),
      ...(voice ? { format: voice.format } : request.format ? { format: request.format } : {}),
      ...(request.seed !== undefined ? { seed: request.seed } : {}),
    });
  };

  return {
    async prepare(target) {
      const selection = await select(target.provider, target.model);
      const model = selection.model;
      const format = FORMAT_PREFERENCE.find((f) => model.formats.includes(f));
      if (!format) throw new RpcError('invalid-request', RcModels.noAlignableFormat({ modelId: selection.modelId }), { formats: model.formats });
      // Check the voice, language and format with a placeholder sentence (the text itself is checked sentence by sentence).
      const checked = parameters(selection, null, {
        text: '.',
        language: target.language,
        format,
        ...(target.voice !== undefined ? { voice: target.voice } : {}),
      });
      return {
        providerId: selection.providerId,
        modelId: selection.modelId,
        voice: target.voice ?? checked.voice,
        format,
        maxInputChars: model.maxInputChars,
        acceptsSeed: model.acceptsSeed,
      };
    },

    async synthesize(request) {
      const { voice } = request;
      let selection: GenerationSelection<'synthesizeSpeech'>;
      let frozen;
      try {
        selection = await select(voice.providerId, voice.modelId);
        // Seed (per-sentence re-dub): already checked against the model when frozen; not passed if the model later stops accepting it (`speechParameters` would reject it).
        const seed = request.seed !== undefined && selection.model.acceptsSeed ? { seed: request.seed } : {};
        frozen = parameters(selection, voice, { text: request.text, voice: voice.voice, language: request.language, ...seed });
      } catch (error) {
        throw stepError(error, voice.providerId);
      }
      let settle: ((outcome: { state: 'completed' | 'failed' }) => void) | null = null;
      if (selection.kind !== 'local' && selection.kind !== 'node') {
        grants.ensureDefault(selection.providerId, selection.label, 'synthesizeSpeech');
        try {
          settle = await grants.begin({
            recipient: selection.providerId,
            dataKinds: DUB_DATA_KINDS,
            videoId: request.videoId,
            taskId: null,
            estimate: estimateCallCost(selection.model.price, { chars: [...request.text].length }),
            label: selection.label,
            jobId: request.jobId,
          });
        } catch (error) {
          throw stepError(error, voice.providerId);
        }
      }
      try {
        const attempt = await selection.generator.generate(
          {
            jobId: request.jobId,
            attempt: 1,
            providerId: selection.providerId,
            modelId: selection.modelId,
            parameters: frozen,
            staging: request.staging,
          },
          { generating: () => {}, progress: () => {} },
          request.signal,
        );
        if (attempt.outcome === 'cancelled') throw request.signal.reason ?? new DOMException('aborted', 'AbortError');
        const output = attempt.outputs[0];
        if (attempt.outputs.length !== 1 || !output) {
          throw localizedStepError('MODEL_OUTPUT_INVALID', RcModels.synthOutputCount({ count: attempt.outputs.length }));
        }
        const file = path.resolve(request.staging, output.path);
        const relative = path.relative(request.staging, file);
        if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
          throw localizedStepError('MODEL_OUTPUT_INVALID', RcModels.synthOutputOutsideStaging());
        }
        settle?.({ state: 'completed' });
        return { file };
      } catch (error) {
        settle?.({ state: 'failed' });
        if (request.signal.aborted) throw error;
        throw stepError(error, voice.providerId);
      }
    },
  };
}

/**
 * Next step when dubbing is rejected on authorization (architecture design §12.5, §14 settled): the default authorization a Provider gets when enabled does not include transcripts (`transcript`), but dubbing has to send out the translation (or the original text when there is no translation), so the first dub is rejected with `GRANT_REQUIRED`. The authorization is not loosened here; only the remedy is made clear: which authorization to issue (`remedy.commands` is already that `cuccut grants create …`), and to run again after it is issued. Only the hint changes; the error code and other details stay the same.
 */
export function withDubGrantGuidance<P, R>(definition: PipelineDefinition<P, R>): PipelineDefinition<P, R> {
  return {
    ...definition,
    async prepare(params, options) {
      try {
        return await definition.prepare(params, options);
      } catch (error) {
        throw dubGrantError(error);
      }
    },
  };
}

export function dubGrantError(error: unknown): unknown {
  if (!(error instanceof RpcError)) return error;
  const details = error.details as
    { code?: unknown; recipient?: unknown; dataKinds?: unknown; remedy?: { hint?: unknown; commands?: unknown } } | undefined;
  if (
    details?.code !== 'GRANT_REQUIRED' ||
    !details.remedy ||
    !Array.isArray(details.dataKinds) ||
    !details.dataKinds.includes('transcript')
  ) {
    return error;
  }
  const hint = RcModels.dubGrantHint({ recipient: String(details.recipient) });
  return new RpcError(
    error.code,
    error.message,
    { ...details, remedy: { ...details.remedy, hint: hint.text, hintRef: refOf(hint) } },
    error.messageRef,
  );
}

/** Step error with a message reference (`PipelineStepError` only takes strings, so the reference is attached separately on `messageRef`). */
function localizedStepError(code: string, message: Localized): PipelineStepError {
  return Object.assign(new PipelineStepError(code, message.text), { messageRef: refOf(message) });
}

/** Replaces `library:<id>` with the clone; a voice deleted from the library reports `VOICE_NOT_FOUND` (kept separate from other failures when dubbing reports per speaker, sentence by sentence). */
function voiceFromLibrary(library: JobLibrary | undefined, voice: string | undefined, providerId: string) {
  try {
    return libraryVoice(library, voice, providerId, PIPELINE_SUBMITTER);
  } catch (error) {
    if (error instanceof RpcError && error.code === 'not-found') {
      throw new RpcError('not-found', RcModels.voiceRemoved({ reason: localizedOf(error), voice: String(voice) }), { code: 'VOICE_NOT_FOUND', library: 'voices', reason: 'removed' });
    }
    throw error;
  }
}

/** Provider failures and rejections at submission are mapped to step errors (same error codes as generation tasks). */
function stepError(error: unknown, providerId: string): unknown {
  if (error instanceof PipelineStepError) return error;
  if (error instanceof ProviderFailure) {
    const { code, ...details } = error.details;
    switch (error.kind) {
      case 'rejected':
        return new PipelineStepError(typeof code === 'string' ? code : 'PROVIDER_REJECTED', error.message, { ...details, providerId });
      case 'unavailable-remote':
        return new PipelineStepError('PROVIDER_UNAVAILABLE', error.message, { ...details, providerId });
      case 'protocol':
        return new PipelineStepError('MODEL_OUTPUT_INVALID', error.message, { ...details, providerId });
      case 'output-unwritable':
        return new PipelineStepError('STAGING_WRITE_FAILED', error.message, { ...details, providerId });
      case 'unavailable':
      case 'load-failed':
        return new PipelineStepError(typeof code === 'string' ? code : 'MODEL_LOAD_FAILED', error.message, { ...details, providerId });
      default:
        return new PipelineStepError('INTERNAL', error.message, { ...details, providerId });
    }
  }
  if (error instanceof RpcError) {
    const details = (error.details ?? {}) as Record<string, unknown>;
    const code = typeof details.code === 'string' ? details.code : error.code === 'invalid-request' ? 'PROVIDER_REJECTED' : 'INTERNAL';
    return new PipelineStepError(code, error.message, details);
  }
  return error;
}
