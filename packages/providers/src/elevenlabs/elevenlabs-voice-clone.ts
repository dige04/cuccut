// ElevenLabs Instant Voice Cloning (architecture design §5.9). Written from the public documentation on 2026-10-03, and not checked item by item offline:
//   https://elevenlabs.io/docs/api-reference/voices/ivc/create
//   https://elevenlabs.io/docs/api-reference/voices/delete
// As written in the docs: `POST {base}/voices/add`, with the request header `xi-api-key`, multipart/form-data: `name` (required), `files` (one or more audio files, required), `description` (optional), `remove_background_noise` (optional, default false, not sent). A 200 response body is `{ voice_id, requires_verification }`.
// `DELETE {base}/voices/{voice_id}`, with a 200 response body of `{ status: 'ok' }`.
// Not confirmed, and listed in architecture design §14 for review: the status code returned when deleting a voice that no longer exists (treated as 404, meaning “already gone on the remote side”). Whether a clone can be used for synthesis immediately when `requires_verification` is true (it is recorded as valid as usual, and a synthesis failure is reported honestly). The limits on a single file and on total upload size (the reference recording itself does not exceed the library's limit).
import fs from 'node:fs/promises';
import { ProviderFailure } from '@cuccut/models';
import { voiceCloneTimeoutMs, type VoiceCloneAdapter, type VoiceCloneDeleteRequest, type VoiceCloneRequest } from '../adapter.ts';
import { providerFetch } from '../http/provider-fetch.ts';
import { ELEVENLABS_LABEL, authOf, classifyElevenLabs, httpOptions } from './elevenlabs-adapter.ts';
import { ProvidersHttp as PH } from '@cuccut/protocol/messages/providers';

export class ElevenLabsVoiceCloneAdapter implements VoiceCloneAdapter {
  readonly version = 'cuccut-providers/elevenlabs-ivc@1';

  async createVoiceClone(request: VoiceCloneRequest): Promise<{ voiceId: string }> {
    const { config } = request;
    const bytes = await fs.readFile(request.file);
    const response = await providerFetch(
      // The upload is sent only once. Resending after a 5xx may create an extra clone on the provider's side.
      httpOptions(config, { ...request.http, attempts: 1 }),
      {
        method: 'POST',
        url: `${config.baseUrl}/voices/add`,
        auth: authOf(config),
        body: () => {
          const form = new FormData();
          form.append('name', request.name);
          if (request.description) form.append('description', request.description);
          form.append('files', new Blob([new Uint8Array(bytes)], { type: request.mediaType }), request.fileName);
          return form;
        },
        timeoutMs: voiceCloneTimeoutMs(request.http),
        signal: request.signal,
        classify: classifyElevenLabs,
      },
    );
    let body: { voice_id?: unknown } | null = null;
    try {
      body = response.json<{ voice_id?: unknown }>();
    } catch {
      body = null;
    }
    if (!body || typeof body.voice_id !== 'string' || !body.voice_id) {
      throw new ProviderFailure('protocol', PH.cloneNoVoiceId({ label: ELEVENLABS_LABEL }).text);
    }
    return { voiceId: body.voice_id };
  }

  async deleteVoiceClone(request: VoiceCloneDeleteRequest): Promise<'deleted' | 'not-found'> {
    const { config } = request;
    try {
      await providerFetch(httpOptions(config, request.http), {
        method: 'DELETE',
        url: `${config.baseUrl}/voices/${encodeURIComponent(request.voiceId)}`,
        auth: authOf(config),
        timeoutMs: request.http.timeoutMs ?? 30_000,
        signal: request.signal,
        classify: classifyElevenLabs,
      });
      return 'deleted';
    } catch (error) {
      if (error instanceof ProviderFailure && error.details.status === 404) return 'not-found';
      throw error;
    }
  }
}
