import os from 'node:os';
import path from 'node:path';

/**
 * Download directory (architecture design §7.9): the files downloaded when importing from a link with download-only, and results the agent hands to the user in a session that does not belong to a project (`downloads_save`), both go here. The setting `downloads.directory` takes priority; when it is not set, it is the host's Downloads folder.
 *
 * `CUCCUT_DOWNLOADS_DIR` is the host's Downloads folder: the desktop app passes the system's Downloads folder through it (the Windows known folder, the Linux XDG directory). Tests use it to point at a temp directory so they do not write into the real Downloads folder. A Runtime started any other way (the CLI) does not have it and uses Downloads under the home directory.
 */
export function resolveDownloadsDirectory(configured: string | null): string {
  if (configured) return configured;
  return process.env.CUCCUT_DOWNLOADS_DIR || path.join(os.homedir(), 'Downloads');
}

/**
 * Save location (architecture design §7.9 "Save location"): results from tools that have no video (file-to-file flows, transcription with no target, copies of a direct task's generated output) land here.
 * If the call gives a directory (the flow parameter `outDir`, the direct task's `saveDir`), use it; otherwise the same as the download directory: the setting `downloads.directory`, then the host's Downloads folder.
 * The host's decision lives in one place only: `resolveDownloadsDirectory`.
 */
export function resolveSaveDirectory(options: { override?: string | null | undefined; settings: string | null }): string {
  if (options.override) return options.override;
  return resolveDownloadsDirectory(options.settings);
}
