import { constants as fsConstants } from 'node:fs';
import fs from 'node:fs/promises';
import { RpcError } from '@cuccut/protocol';
import { JobsSaveLocation } from '@cuccut/protocol/messages/jobs/save-location.ts';
import { PipelineStepError } from './pipeline.ts';
import { sanitizeFileName } from './yt-dlp.ts';

/**
 * Save location (architecture design §7.9, “Save location”): results without a video land in a directory. The directory is chosen at submission and frozen; it is created if it does not exist. If it cannot be written, the error is `OUTPUT_DESTINATION_UNAVAILABLE`. How the directory is chosen (given by the call, from settings, or the host's downloads folder) is decided by the Runtime. This code only handles “create it and confirm it is writable”, along with readable file names.
 */

export const OUTPUT_DESTINATION_UNAVAILABLE = 'OUTPUT_DESTINATION_UNAVAILABLE';

/** Creates the directory and confirms it is writable. Returns the reason if it is not; otherwise null. */
export async function writableDirectoryProblem(dir: string): Promise<string | null> {
  try {
    await fs.mkdir(dir, { recursive: true });
    const stat = await fs.stat(dir);
    if (!stat.isDirectory()) return JobsSaveLocation.notDirectory().text;
    await fs.access(dir, fsConstants.W_OK);
    return null;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code ?? (error instanceof Error ? error.message : String(error));
  }
}

/** At submission (`prepare`, and the submission of direct tasks): if the directory cannot be created or written, it is rejected with `conflict` and no task is created. */
export async function ensureSaveDirectory(dir: string): Promise<void> {
  const problem = await writableDirectoryProblem(dir);
  if (problem !== null) {
    throw new RpcError('conflict', JobsSaveLocation.unwritable({ dir, problem }), { code: OUTPUT_DESTINATION_UNAVAILABLE, dir, reason: problem });
  }
}

/** At publish time (a step of the pipeline): if the directory was moved or its permissions changed after submission, this step fails with `OUTPUT_DESTINATION_UNAVAILABLE` and can be retried. */
export async function ensureSaveDirectoryForStep(dir: string): Promise<void> {
  const problem = await writableDirectoryProblem(dir);
  if (problem !== null) throw new PipelineStepError(OUTPUT_DESTINATION_UNAVAILABLE, JobsSaveLocation.unwritable({ dir, problem }), { dir, reason: problem });
}

/** The upper limit on characters taken from a prompt or from the start of a text: enough to tell which one it is, without making a long string. */
const TITLE_CHARS = 40;

/**
 * A readable file name (without the extension): takes the opening part of the text (runs of whitespace become one space) and cleans it with the same rules used for downloaded files (`sanitizeFileName`).
 * When the text is empty, `fallback` is used.
 */
export function readableStem(text: string, fallback: string): string {
  const head = [...text.replace(/\s+/g, ' ').trim()].slice(0, TITLE_CHARS).join('');
  return sanitizeFileName(head || fallback);
}
