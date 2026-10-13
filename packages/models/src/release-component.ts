import fs from 'node:fs/promises';
import path from 'node:path';
import type { ComponentRelease, ComponentReleaseAsset } from './bundle-registry.ts';
import { removeEmptyParents } from './model-staging.ts';

/**
 * The location and address of a component from a GitHub release page (`BundleComponentSource.release`; currently only the audio.cpp engine of music model packages; architecture design §6.3).
 *
 * - Component directory: `<toolsDir>/<name>/<version>/` (the Runtime Home's `tools/`, not in the model directory; it does not move with the model directory). Beside the unpacked files, a `.ccut-manifest.json` is written (the size and sha256 of each file). Whether it is properly installed, and verification and repair, are still judged against the manifest.
 * - Staging area: `<toolsDir>/.ccut-staging/<name>@<version>/`, on the same volume as the component directory (publishing is a rename). Inside are the archive (an unfinished one is `<filename>.part`) and the `unpacked/` directory being unpacked.
 * - Download address: when a tool download mirror is given (setting `tools.downloadEndpoint` or `CUCCUT_TOOLS_ENDPOINT`), it is `<base>/<name>/<version>/<filename>`; otherwise, the registered official address template (the same rules as managed external tools).
 */

export const TOOLS_STAGING_DIR = '.ccut-staging';
/** Name of the directory being unpacked in the staging area. */
export const UNPACK_DIR = 'unpacked';

/** The host's platform key: `<process.platform>-<process.arch>`, e.g. `darwin-arm64`, `win32-x64`. */
export function hostPlatformKey(platform: string = process.platform, arch: string = process.arch): string {
  return `${platform}-${arch}`;
}

/** The archive for this platform; null if there is none (platform not supported). */
export function releaseAsset(release: ComponentRelease, platformKey: string): ComponentReleaseAsset | null {
  return release.assets[platformKey] ?? null;
}

/** Component directory: `<toolsDir>/<name>/<version>/`. */
export function releaseDir(toolsDir: string, release: ComponentRelease): string {
  return path.join(toolsDir, release.name, release.version);
}

/** Staging directory: `<toolsDir>/.ccut-staging/<name>@<version>/`. */
export function releaseStagingDir(toolsDir: string, release: ComponentRelease): string {
  return path.join(toolsDir, TOOLS_STAGING_DIR, `${release.name}@${release.version}`);
}

/** Archive download address: with a mirror, `<base>/<name>/<version>/<filename>`; without one, the official address template. */
export function releaseUrl(release: ComponentRelease, asset: ComponentReleaseAsset, toolsEndpoint: string | null | undefined): string {
  if (toolsEndpoint) {
    const base = toolsEndpoint.replace(/\/+$/, '');
    return `${base}/${encodeURIComponent(release.name)}/${encodeURIComponent(release.version)}/${encodeURIComponent(asset.fileName)}`;
  }
  return release.urlTemplate.replace('{version}', encodeURIComponent(release.version)).replace('{file}', encodeURIComponent(asset.fileName));
}

/** The source in the install plan (without credentials): the mirror's base, or, for the official address template, the part before the file (the release page). */
export function releaseSource(release: ComponentRelease, toolsEndpoint: string | null | undefined): string {
  if (toolsEndpoint) return toolsEndpoint.replace(/\/+$/, '');
  const template = release.urlTemplate.replace('{version}', release.version);
  const cut = template.indexOf('/download/');
  return cut > 0 ? template.slice(0, cut) : template.slice(0, template.lastIndexOf('/'));
}

/** Archive bytes already received in the staging area (a fully verified copy, or an unfinished `.part`); 0 when there are none. */
export async function releaseStagedBytes(toolsDir: string, release: ComponentRelease, asset: ComponentReleaseAsset): Promise<number> {
  const stage = releaseStagingDir(toolsDir, release);
  for (const name of [asset.fileName, `${asset.fileName}.part`]) {
    const stat = await fs.stat(path.join(stage, name)).catch(() => null);
    if (stat?.isFile()) return stat.size;
  }
  return 0;
}

/** Deletes the staging directory of a release-page component (along with the staging area itself if it is left empty). */
export async function discardReleaseStaging(toolsDir: string, release: ComponentRelease): Promise<void> {
  const stage = releaseStagingDir(toolsDir, release);
  await fs.rm(stage, { recursive: true, force: true });
  await removeEmptyParents(path.dirname(stage), path.join(toolsDir, TOOLS_STAGING_DIR));
}
