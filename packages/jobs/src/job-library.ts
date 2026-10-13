import {
  RpcError,
  type FrozenLibraryEntry,
  type FrozenSpeechReference,
  type JobLibraryUse,
  type JobSubmitter,
  type Localized,
  type TranscriptionGlossary,
} from '@cuccut/protocol';
import {
  composeTranscribeHint,
  parseLibraryVoice,
  resolveVoiceClone,
  type LibraryStore,
} from '@cuccut/runtime-storage/library';
import { JobsLibrary as J } from '@cuccut/protocol/messages/jobs/job-library.ts';

/**
 * The user library used by tasks (architecture design §5.9): at submission, entries are read and their versions and digests are frozen. During the task these versions are pinned, and they are released when it ends.
 * The library is accessed only through these methods.
 *
 * Resolution lives in the JobManager, so the gateway, the agent tools and external services all take the same path. Clients of external services (MCP, the model interface service, `submitter.kind === 'service'`) cannot reference the user library: the library is the local user's data, and under minimal exposure it is not open to external programs. They are rejected with `invalid-request` + `LIBRARY_ENTRY_NOT_APPLICABLE`, and no task is created.
 */
export type JobLibrary = Pick<LibraryStore, 'get' | 'pin' | 'unpin' | 'filePath'>;

function assertLibraryOpenTo(submitter: JobSubmitter, message: () => Localized): void {
  if (submitter.kind !== 'service') return;
  // Same shape as `libraryError` (`details.code` + reason), with the text carrying a message ref.
  throw new RpcError('invalid-request', message(), { code: 'LIBRARY_ENTRY_NOT_APPLICABLE', reason: 'service-client' });
}

/**
 * The glossary for recognition goes into the transcription prompt. If the model accepts the prompt, the canonical spellings are appended after the user's prompt (total not over 1200 characters).
 * If it does not accept it, the glossary is ignored and explained in `glossaryHint.status`. The translation glossary cannot be used for recognition.
 */
export function transcribeGlossaries(
  library: JobLibrary | undefined,
  refs: { id: string; version?: number }[],
  userHint: string | null,
  acceptsHint: boolean,
  submitter: JobSubmitter,
): { hint: string | null; use: JobLibraryUse } {
  assertLibraryOpenTo(submitter, J.serviceNoGlossaries);
  if (!library) throw new RpcError('invalid-request', J.noLibraryForGlossaries());
  const entries: FrozenLibraryEntry[] = [];
  const glossaries: TranscriptionGlossary[] = [];
  for (const ref of refs) {
    const entry = library.get({ library: 'glossaries', id: ref.id, ...(ref.version !== undefined ? { version: ref.version } : {}) });
    if (entry.content.kind !== 'transcription') {
      throw new RpcError('invalid-request', J.translationGlossary({ name: entry.content.name }), {
        code: 'LIBRARY_ENTRY_NOT_APPLICABLE',
        library: 'glossaries',
        id: entry.id,
      });
    }
    entries.push({ library: 'glossaries', id: entry.id, version: entry.version, contentHash: entry.contentHash });
    glossaries.push(entry.content);
  }
  if (!acceptsHint) {
    const total = new Set(glossaries.flatMap((g) => g.terms.map((t) => t.canonical))).size;
    return { hint: userHint, use: { entries, glossaryHint: { status: 'unsupported', terms: 0, dropped: total } } };
  }
  const composed = composeTranscribeHint(userHint ?? undefined, glossaries);
  return {
    hint: composed.hint ?? null,
    use: { entries, glossaryHint: { status: 'sent', terms: composed.terms, dropped: composed.dropped } },
  };
}

/** The clone of a `library:<id>` voice on the chosen Provider; null if the voice is not in the library. Throws `VOICE_CLONE_REQUIRED` when there is no valid clone. */
export function libraryVoice(
  library: JobLibrary | undefined,
  voice: string | undefined,
  providerId: string,
  submitter: JobSubmitter,
): { voiceId: string; use: JobLibraryUse } | null {
  const id = parseLibraryVoice(voice);
  if (id === null) return null;
  assertLibraryOpenTo(submitter, J.serviceNoVoices);
  if (!library) throw new RpcError('invalid-request', J.noLibraryForVoices());
  const resolved = resolveVoiceClone(library.get({ library: 'voices', id }), providerId);
  return { voiceId: resolved.voiceId, use: { entries: [resolved.entry] } };
}

/**
 * Local synthesis uses the reference recording of the library voice entry directly (not uploaded, needs no clone, and needs no outbound authorization). The frozen entry's version and the recording's digest are recorded; at execution the local Provider checks the digest again. When `withTranscript` is false (the model does not read the original text), the original text is not included.
 */
export function localLibraryVoice(
  library: JobLibrary | undefined,
  id: string,
  withTranscript: boolean,
  submitter: JobSubmitter,
): { reference: FrozenSpeechReference; use: JobLibraryUse } {
  assertLibraryOpenTo(submitter, J.serviceNoVoices);
  if (!library) throw new RpcError('invalid-request', J.noLibraryForVoices());
  const voice = library.get({ library: 'voices', id });
  const file = voice.content.reference;
  const transcript = withTranscript && voice.content.transcript.trim() ? voice.content.transcript.trim() : null;
  return {
    reference: { source: 'library', path: library.filePath(voice, file), sha256: file.sha256, byteLength: file.byteLength, transcript },
    use: { entries: [{ library: 'voices', id: voice.id, version: voice.version, contentHash: voice.contentHash }] },
  };
}
