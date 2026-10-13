import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Staging area for model downloads (architecture design §6.3): `<models-root>/.ccut-staging/<owner>/<repo>@<revision>/`. A file that has not finished downloading is `<path>.part`; a file whose sha256 has been verified is `<path>`. The downloader writes it, and the model directory uses it to report how many bytes a paused install has received.
 */

export const STAGING_DIR = '.ccut-staging';

/** Staging directory for one repository revision. */
export function stagingDirOf(root: string, repo: string, revision: string): string {
  const [owner = '', name = ''] = repo.split('/');
  return path.join(root, STAGING_DIR, owner, `${name}@${revision}`);
}

/** Number of bytes already received in the staging area for one repository revision (both verified and unfinished files count); 0 when there is no staging directory. */
export async function stagedBytes(root: string, repo: string, revision: string): Promise<number> {
  return dirBytes(stagingDirOf(root, repo, revision));
}

/** Deletes the staging directory for one repository revision. */
export async function discardStaging(root: string, repo: string, revision: string): Promise<void> {
  await fs.rm(stagingDirOf(root, repo, revision), { recursive: true, force: true });
  await removeEmptyParents(path.dirname(stagingDirOf(root, repo, revision)), path.join(root, STAGING_DIR));
}

async function dirBytes(dir: string): Promise<number> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  let total = 0;
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += await dirBytes(full);
    else if (entry.isFile()) total += (await fs.stat(full).catch(() => null))?.size ?? 0;
  }
  return total;
}

/** Removes empty directories upward from `dir`, up to and including `stop`. */
export async function removeEmptyParents(dir: string, stop: string): Promise<void> {
  let current = dir;
  while (current.startsWith(stop)) {
    const entries = await fs.readdir(current).catch(() => null);
    if (!entries || entries.length > 0) return;
    await fs.rmdir(current).catch(() => {});
    if (current === stop) return;
    current = path.dirname(current);
  }
}
