import type { LibraryName, SpeakerVoiceBinding, VideoLibrarySelection } from '@cuccut/protocol';
import { M } from './library-copy.ts';

/**
 * Arguments and output of the `cuccut library` admin commands (Architecture design §5.9). Listing and viewing entries are derived commands (`library list|show`).
 */

/** Library names: `glossaries | voices | brand`. */
export function parseLibraryName(text: string | undefined): LibraryName {
  if (text === 'glossaries' || text === 'voices' || text === 'brand') return text;
  throw new Error(M.unknownLibrary(text));
}

export function libraryLabel(library: LibraryName): string {
  return M.libraryLabels[library];
}

/** `--speaker-voice <transcript id>:<speaker>=<voice>[@<Provider>]`: `library:` voices carry no Provider. */
export function parseSpeakerVoice(text: string): SpeakerVoiceBinding {
  const colon = text.indexOf(':');
  const equals = text.indexOf('=', colon + 1);
  if (colon <= 0 || equals <= colon + 1 || equals === text.length - 1) {
    throw new Error(M.speakerVoiceFormat(text));
  }
  const documentId = text.slice(0, colon);
  const speakerId = text.slice(colon + 1, equals);
  let voice = text.slice(equals + 1);
  const at = voice.lastIndexOf('@');
  const providerId = at > 0 ? voice.slice(at + 1) : '';
  if (at > 0) voice = voice.slice(0, at);
  return { documentId, speakerId, voice, ...(providerId ? { providerId } : {}) };
}

/** Comma-separated entry IDs. An empty string means clear. */
export function parseIdList(text: string): string[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

/** Output of `cuccut library video-selection`: for each step, the glossaries enabled and the voices of the speakers. */
export function formatVideoSelection(result: VideoLibrarySelection): string[] {
  const { selection } = result;
  const list = (ids: string[]) => (ids.length > 0 ? ids.join(M.listSep) : M.none);
  const lines = [
    M.selectionHead(result.videoId, result.documentId, result.revision),
    M.transcribeGlossaries(list(selection.glossaries.transcribe)),
    M.translateGlossaries(list(selection.glossaries.translate)),
  ];
  if (selection.speakerVoices.length === 0) lines.push(M.speakerVoicesNone);
  for (const b of selection.speakerVoices) {
    lines.push(M.speakerVoice(b.documentId, b.speakerId, b.voice, b.providerId ?? null));
  }
  return lines;
}
