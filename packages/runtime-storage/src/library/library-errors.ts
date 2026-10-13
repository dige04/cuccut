import { RpcError } from '@cuccut/protocol';
import type { Localized } from '@cuccut/protocol';

/** User library error codes (command and protocol spec §11), placed in `RpcError.details.code`. */
export type LibraryErrorCode =
  | 'LIBRARY_FORMAT_INVALID'
  | 'LIBRARY_KIND_RESERVED'
  | 'LIBRARY_VERSION_CONFLICT'
  | 'LIBRARY_ENTRY_NOT_APPLICABLE'
  | 'VOICE_CONSENT_REQUIRED'
  | 'VOICE_CLONE_REQUIRED'
  | 'VOICE_CLONE_UNSUPPORTED'
  | 'VOICE_CLONE_EXISTS';

export function libraryError(
  code: LibraryErrorCode,
  rpc: 'invalid-request' | 'conflict',
  message: string | Localized,
  details: Record<string, unknown> = {},
): RpcError {
  return new RpcError(rpc, message, { code, ...details });
}

/** Content or exchange file that does not comply: `invalid-request`. */
export function formatInvalid(message: string | Localized, details: Record<string, unknown> = {}): RpcError {
  return libraryError('LIBRARY_FORMAT_INVALID', 'invalid-request', message, details);
}
