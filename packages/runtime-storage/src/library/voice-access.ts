import type { FrozenLibraryEntry, Id, LibraryEntry } from '@cuccut/protocol';
import { libraryError } from './library-errors.ts';
import { RuntimeStorageLibrary as SL } from '@cuccut/protocol/messages/runtime-storage';

/** The syntax in a synthesis request that points to the voice library: `library:<entry ID>`. */
export const LIBRARY_VOICE_PREFIX = 'library:';

export function parseLibraryVoice(voice: string | undefined): Id | null {
  return voice?.startsWith(LIBRARY_VOICE_PREFIX) ? voice.slice(LIBRARY_VOICE_PREFIX.length) : null;
}

/**
 * Outbound authorization (architecture design §5.9, §12.5): must be called before this voice audio is uploaded to a vendor (cloning). Rejected when there is no consent statement:
 * `conflict` + `VOICE_CONSENT_REQUIRED`. The user must add the statement to the voice and retry, not work around it another way.
 */
export function assertVoiceUploadAllowed(voice: LibraryEntry<'voices'>, providerId: string): void {
  const { consent } = voice.content;
  if (consent.declared && consent.declaredAt) return;
  throw libraryError(
    'VOICE_CONSENT_REQUIRED',
    'conflict',
    SL.voiceConsentRequired({ name: voice.content.name, provider: providerId }),
    { library: 'voices', id: voice.id, providerId },
  );
}

/**
 * A voice `library:<id>` on a Provider uses its valid clone. Rejected when there is no clone, or the clone has expired (the reference recording changed, or the entry was deleted):
 * `conflict` + `VOICE_CLONE_REQUIRED` (`details.reason`: `missing`, `stale`). Create the clone before synthesizing.
 */
export function resolveVoiceClone(voice: LibraryEntry<'voices'>, providerId: string): { voiceId: string; entry: FrozenLibraryEntry } {
  // A voice whose consent statement was withdrawn: its existing clones are no longer used either.
  assertVoiceUploadAllowed(voice, providerId);
  const clone = voice.clones?.[providerId];
  const entry: FrozenLibraryEntry = { library: 'voices', id: voice.id, version: voice.version, contentHash: voice.contentHash };
  if (clone && clone.state === 'valid' && clone.referenceHash === voice.content.reference.sha256) return { voiceId: clone.voiceId, entry };
  const reason = clone ? 'stale' : 'missing';
  throw libraryError(
    'VOICE_CLONE_REQUIRED',
    'conflict',
    clone
      ? SL.voiceCloneStale({ name: voice.content.name, provider: providerId })
      : SL.voiceCloneMissing({ name: voice.content.name, provider: providerId }),
    { library: 'voices', id: voice.id, providerId, reason },
  );
}
