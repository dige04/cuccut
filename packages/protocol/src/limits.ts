/** Tool output keeps only this many trailing characters. The full output is not put into the session record. The Runtime and the client truncate with the same rule. */
export const OUTPUT_LIMIT = 32_000;

export function clampOutput(output: string): string {
  return output.length > OUTPUT_LIMIT ? `…\n${output.slice(-OUTPUT_LIMIT)}` : output;
}

/** Message attachments (product design §3.2.4): the per-image limit, the maximum number of images per message, and the accepted formats. The client checks first, and the Runtime validates again. */
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_MESSAGE = 8;
export const ATTACHMENT_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;
export type AttachmentMimeType = (typeof ATTACHMENT_MIME_TYPES)[number];

/** Maximum number of items `projects.files.list` returns at once. */
export const MAX_PROJECT_FILES_LIMIT = 1000;

/** Uploaded documents are opaque files; the Runtime classifies their content when previewing. */
export const FILE_ATTACHMENT_MIME_TYPES = ['application/octet-stream','application/pdf','text/plain','text/html','text/csv','text/tab-separated-values','application/json','audio/mpeg','audio/wav','audio/mp4','video/mp4','video/webm'] as const;
export const ATTACHMENT_UPLOAD_MIME_TYPES = [...ATTACHMENT_MIME_TYPES, ...FILE_ATTACHMENT_MIME_TYPES] as const;
export function attachmentUploadMime(type:string):string {return (ATTACHMENT_UPLOAD_MIME_TYPES as readonly string[]).includes(type)?type:'application/octet-stream';}

/**
 * `playable` for `media.playback` (architecture design §4.5): the WebM codecs the client can decode natively, named like ffprobe's `codec_name`.
 * When a source file's first frame and its audio are both in those codecs, the Runtime hands out the original handle directly, without making a compatibility copy.
 */
export const PLAYBACK_CODECS = ['vp8', 'vp9', 'av1', 'opus', 'vorbis'] as const;
export type PlaybackCodec = (typeof PLAYBACK_CODECS)[number];
