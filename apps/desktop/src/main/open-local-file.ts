import path from 'node:path';
import { stat } from 'node:fs/promises';

/** Only hands documents and media to the system to open. Never launches programs, scripts or shortcuts from a model reply. */
const DOCUMENT_EXTENSIONS = new Set(('pdf txt md markdown csv tsv json xml yaml yml toml log rtf doc docx odt xls xlsx ods ppt pptx odp html htm ' +
  'png jpg jpeg gif webp svg bmp avif heic tif tiff mp4 mov m4v webm mkv avi mp3 wav m4a aac flac ogg opus srt vtt ass ssa').split(' '));

export function localDocumentPath(value: unknown): string | null {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/.test(value) || !path.isAbsolute(value)) return null;
  return DOCUMENT_EXTENSIONS.has(path.extname(value).slice(1).toLowerCase()) ? path.normalize(value) : null;
}

/** null means unsupported, an empty string means success, and anything else is the error reported by the OS. */
export async function openLocalFile(value: unknown, open: (file: string) => Promise<string>): Promise<string | null> {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/.test(value) || !path.isAbsolute(value)) return null;
  const file = path.normalize(value);
  try {
    if (!(await stat(file)).isFile() || !localDocumentPath(file)) return null;
    return await open(file);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
