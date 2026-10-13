import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  MAX_SUBTITLE_BYTES,
  SubtitleFileError,
  TRANSCODE_PIPELINE,
  TRANSCRIBE_PIPELINE,
  TRANSLATE_SUBTITLES_PIPELINE,
  decodeSubtitleBytes,
  subtitleFormatOf,
  subtitleText,
} from '@cuccut/jobs';
import {
  RpcError,
  type GenerateTextRequest,
  type Id,
  type Localized,
  type SpaceEntry,
  type SpaceEntryKind,
  type SynthesizeSpeechRequest,
} from '@cuccut/protocol';
import { methodParamSchemas } from '@cuccut/protocol/schemas';
import { RcSpace } from '@cuccut/protocol/messages/runtime-core';

/**
 * Space entries as tool inputs (architecture design §7.9, "Space entries as inputs"). `{ entryId }` is replaced at the method layer with the entry's file or text, looked up in the Space catalog. Workflows and jobs see only paths and text, and the frozen parameters contain no entry id. Rejections of an entry (not found, in the trash, wrong kind, no file) are given by `SpaceCatalog.resolveFile`, all at submission time, without creating a job.
 */
export interface SpaceFileResolver {
  resolveFile(entryId: Id, kinds: readonly SpaceEntryKind[]): { entry: SpaceEntry; file: string };
}

/** Inputs that need a media file (`file` of transcription, `inputs` of transcoding): video files, rendered cuts and audio. */
export const MEDIA_ENTRY_KINDS: readonly SpaceEntryKind[] = ['video-file', 'export', 'audio'];
/** The `input` of subtitle file translation. */
export const SUBTITLE_ENTRY_KINDS: readonly SpaceEntryKind[] = ['subtitle'];
/** Material for speech synthesis and text generation: documents and subtitles. */
export const MATERIAL_ENTRY_KINDS: readonly SpaceEntryKind[] = ['document', 'subtitle'];

/** Document extensions read as text. Other documents (PDF, Word, etc.) are not plain text and are not accepted. */
const TEXT_DOCUMENT_EXTENSIONS = new Set(['txt', 'md', 'markdown']);

function entryIdOf(value: unknown): Id | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const entryId = (value as { entryId?: unknown }).entryId;
  return typeof entryId === 'string' && Object.keys(value).length === 1 ? entryId : null;
}

/**
 * Replaces Space entries in the parameters of `pipelines.start`: `file` of `transcribe`, `inputs[]` of `transcode`, and `input` of `translate-subtitles`. Other workflows and other fields are returned unchanged. Values that are not `{ entryId }` are left to the workflow's own parameter checks.
 */
export function resolvePipelineEntryInputs(
  space: SpaceFileResolver,
  pipeline: string,
  params: Record<string, unknown>,
): Record<string, unknown> {
  const file = (value: unknown, kinds: readonly SpaceEntryKind[]) => {
    const entryId = entryIdOf(value);
    return entryId === null ? value : space.resolveFile(entryId, kinds).file;
  };
  switch (pipeline) {
    case TRANSCRIBE_PIPELINE:
      return 'file' in params ? { ...params, file: file(params.file, MEDIA_ENTRY_KINDS) } : params;
    case TRANSCODE_PIPELINE:
      return Array.isArray(params.inputs) ? { ...params, inputs: params.inputs.map((input) => file(input, MEDIA_ENTRY_KINDS)) } : params;
    case TRANSLATE_SUBTITLES_PIPELINE:
      return 'input' in params ? { ...params, input: file(params.input, SUBTITLE_ENTRY_KINDS) } : params;
    default:
      return params;
  }
}

/**
 * Text of a material entry: documents (.txt, .md) are decoded as text; subtitles (.srt, .vtt) have timecodes and markup stripped, one line per cue. Other formats (PDF, ASS, etc.) give `SPACE_ENTRY_UNSUPPORTED`. Over 4 MiB, or subtitles that cannot be parsed reliably, give `invalid-request` (subtitles carry their own error code).
 */
export async function materialText(space: SpaceFileResolver, entryId: Id): Promise<{ text: string; fileName: string }> {
  const { entry, file } = space.resolveFile(entryId, MATERIAL_ENTRY_KINDS);
  const fileName = entry.fileName || path.basename(file);
  const unsupported = (reason: Localized, extra: Record<string, unknown> = {}) =>
    new RpcError('invalid-request', reason, { code: 'SPACE_ENTRY_UNSUPPORTED', entryId, kind: entry.kind, ...extra });
  const subtitle = entry.kind === 'subtitle' ? subtitleFormatOf(file) : null;
  const extension = path.extname(file).slice(1).toLowerCase();
  if (entry.kind === 'subtitle' ? !subtitle : !TEXT_DOCUMENT_EXTENSIONS.has(extension)) {
    throw unsupported(RcSpace.materialTextOnly({ fileName }), { accepted: ['txt', 'md', 'markdown', 'srt', 'vtt'] });
  }
  const stat = await fsp.stat(file).catch(() => null);
  if (!stat?.isFile()) throw new RpcError('conflict', RcSpace.noReadableFile(), { code: 'SPACE_ENTRY_NO_FILE', entryId });
  if (stat.size > MAX_SUBTITLE_BYTES) {
    throw unsupported(RcSpace.materialTooLarge({ fileName, bytes: stat.size, limit: MAX_SUBTITLE_BYTES }), { bytes: stat.size, limit: MAX_SUBTITLE_BYTES });
  }
  const bytes = await fsp.readFile(file);
  if (!subtitle) return { text: decodeSubtitleBytes(bytes).replace(/^﻿/, ''), fileName };
  try {
    return { text: subtitleText(bytes, subtitle), fileName };
  } catch (error) {
    if (error instanceof SubtitleFileError) {
      throw new RpcError('invalid-request', error.message, { code: error.code, entryId, file, ...error.details });
    }
    throw error;
  }
}

/** Re-checks the request after the material is filled in, per the method's parameter rules (length limit, must not be empty). `invalid-request` if it does not comply. */
function recheck<T>(method: 'models.synthesizeSpeech' | 'models.generateText', request: T): T {
  const parsed = methodParamSchemas[method].safeParse(request);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new RpcError('invalid-request', RcSpace.afterMaterial({ reason: issue?.message ?? RcSpace.invalidParams() }), { path: issue?.path ?? [] });
  }
  return request;
}

/** Material for `models.synthesizeSpeech`: the entry's text is used as `text`. Returned unchanged if no material is given. */
export async function withSpeechMaterial(space: SpaceFileResolver, request: SynthesizeSpeechRequest): Promise<SynthesizeSpeechRequest> {
  if (!request.material) return request;
  const { material, ...rest } = request;
  const { text } = await materialText(space, material.entryId);
  return recheck('models.synthesizeSpeech', { ...rest, text: text.trim() });
}

/** Material for `models.generateText`: the entry's text is appended after the last user message (a blank line first, then the file name). Returned unchanged if no material is given. */
export async function withTextMaterial(space: SpaceFileResolver, request: GenerateTextRequest): Promise<GenerateTextRequest> {
  if (!request.material) return request;
  const { material, ...rest } = request;
  const { text, fileName } = await materialText(space, material.entryId);
  const messages = [...rest.messages];
  const last = messages.findLastIndex((m) => m.role === 'user');
  const block = `${fileName}\n\n${text.trim()}`;
  if (last === -1) messages.push({ role: 'user', content: block });
  else messages[last] = { ...messages[last]!, content: `${messages[last]!.content.trimEnd()}\n\n${block}` };
  return recheck('models.generateText', { ...rest, messages });
}
