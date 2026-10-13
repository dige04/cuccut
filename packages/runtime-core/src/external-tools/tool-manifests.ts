import { ffmpegMissingRemedyMessage } from '@cuccut/process-host';
import { refOf, type ExternalToolOffer, type Localized } from '@cuccut/protocol';
import type { ToolUpdateRecipe } from './tool-update-plan.ts';
import { RcExternalTools } from '@cuccut/protocol/messages/runtime-core';

/**
 * Registry of managed external tools (architecture design §12.9). Each tool has one manifest: its purpose, minimum version, and probing method. Tools that CucCut can download also carry a pinned release version, the files for each platform, size, sha256, and license.
 * The audio.cpp engine for music generation is not here: it is a component of the music model package and is installed with that package (`music-engine.ts` in `@cuccut/models`, architecture design §6.3).
 *
 * Digests are not made up. A sha256 or size that cannot be verified offline is left empty (null), and install is then refused with `TOOL_MANIFEST_INCOMPLETE` (the same rule as the model package's built-in manifest, `MODEL_MANIFEST_INCOMPLETE`). Filling in the digests is a pending review item (§14).
 */

/** A file to download for one platform. */
export interface ToolAsset {
  /** The file name in the release. */
  fileName: string;
  /** Size in bytes; null when unknown. */
  size: number | null;
  /** sha256 (lowercase hex); null when unknown, in which case it cannot be installed. */
  sha256: string | null;
  /**
   * The format when the release file is an archive: after verification, only the regular files at the archive root are extracted to `tools/<tool>/<version>/` (those in `skip` are not extracted). The executable is the `command` among them.
   * When absent, the release file itself is the executable.
   */
  archive?: { format: 'tar.gz' | 'zip'; skip: readonly string[] };
}

export interface ToolRelease {
  /** The pinned release version (the tag on the release page). */
  version: string;
  /** Picks the file by `process.platform-process.arch`, for example `darwin-arm64`. */
  assets: Readonly<Record<string, ToolAsset>>;
  /** The official release download address: `{version}` and `{file}` are replaced with the version and the file name. */
  officialUrl: string;
  /** An estimate to show people when the size is unknown. */
  estimatedBytes: number;
  license: string;
  homepage: string;
}

export interface ToolManifest {
  name: string;
  label: string;
  purpose: Localized;
  /** The executable's name (looked up on PATH). */
  command: string;
  /** Probe argument: print the version. */
  versionArgs: readonly string[];
  /** Extracts the version number from the probe output. */
  parseVersion(output: string): string | null;
  /** Below this, the tool is reported as needing an update; null means no check. */
  minVersion: string | null;
  /** Whether the user's consent is needed before use (required for tools that download third-party content over the network). */
  consentRequired: boolean;
  /** The release for a tool CucCut can download; null means only the user can install it (ffmpeg). */
  release: ToolRelease | null;
  /** A path given by an environment variable (ffmpeg's `CUCCUT_FFMPEG`); takes precedence over the other sources. */
  envVar?: string;
  /** The task kinds that use it: the managed copy is not deleted while these tasks have not finished (`TOOL_IN_USE`). */
  usedByJobKinds?: readonly string[];
  /** Updates the copy on the system in its original install method (`externalTools.update`); when absent, no update is offered. */
  update?: ToolUpdateRecipe;
  /** The remedy when the tool is missing (given for the platform the Runtime runs on). */
  missingRemedy: Localized;
}

export const YT_DLP = 'yt-dlp';
export const FFMPEG = 'ffmpeg';

/**
 * The yt-dlp release: the version is the stable release installed by Homebrew on this development machine (the Changelog and `yt_dlp/version.py` both say 2026.07.04). It was not checked against upstream. The file names follow the release file table in the README bundled with it. Size and sha256 were not checked offline, so they are left empty (§14).
 * Windows ARM64's `yt-dlp_arm64.exe` exists only from 2025.08.20 on, per the upstream release page (before that, ARM64 Windows could only run the x64 build).
 * License: the source is Unlicense. Per the upstream README, the PyInstaller-built standalone executable contains GPLv3+ code, so the whole is distributed under GPLv3+.
 */
const YT_DLP_RELEASE: ToolRelease = {
  version: '2026.07.04',
  assets: {
    'darwin-arm64': { fileName: 'yt-dlp_macos', size: null, sha256: null },
    'darwin-x64': { fileName: 'yt-dlp_macos', size: null, sha256: null },
    'linux-x64': { fileName: 'yt-dlp_linux', size: null, sha256: null },
    'linux-arm64': { fileName: 'yt-dlp_linux_aarch64', size: null, sha256: null },
    'win32-x64': { fileName: 'yt-dlp.exe', size: null, sha256: null },
    'win32-arm64': { fileName: 'yt-dlp_arm64.exe', size: null, sha256: null },
  },
  officialUrl: 'https://github.com/yt-dlp/yt-dlp/releases/download/{version}/{file}',
  estimatedBytes: 36 * 1024 * 1024,
  get license() {
    return RcExternalTools.ytDlpLicense().text;
  },
  homepage: 'https://github.com/yt-dlp/yt-dlp',
};

export const BUILTIN_TOOL_MANIFESTS: readonly ToolManifest[] = [
  {
    name: YT_DLP,
    label: 'yt-dlp',
    get purpose() {
      return RcExternalTools.ytDlpPurpose();
    },
    command: 'yt-dlp',
    versionArgs: ['--version'],
    parseVersion: (output) => /^\s*(\d{4}\.\d{2}\.\d{2}(?:\.\d+)?)/.exec(output)?.[1] ?? null,
    // Per the Changelog bundled with this Homebrew install, `--plugin-dirs` / `--no-plugin-dirs` exist only from 2024.10.22. The flow uses them to turn off the plugin directories.
    minVersion: '2024.10.22',
    consentRequired: true,
    release: YT_DLP_RELEASE,
    // Stable channel: `brew upgrade`, `pip install -U`, and `yt-dlp -U` each follow their own stable channel. A development Homebrew installed from source still takes the latest commit.
    update: {
      formula: 'yt-dlp',
      pipxPackage: 'yt-dlp',
      pipRequirement: 'yt-dlp[default]',
      module: 'yt_dlp',
      selfUpdateArgs: ['-U'],
      wingetId: 'yt-dlp.yt-dlp',
      scoopApp: 'yt-dlp',
      chocolateyPackage: 'yt-dlp',
    },
    get missingRemedy() {
      return RcExternalTools.ytDlpMissingRemedy();
    },
  },
  {
    name: FFMPEG,
    label: 'ffmpeg',
    get purpose() {
      return RcExternalTools.ffmpegPurpose();
    },
    command: 'ffmpeg',
    versionArgs: ['-hide_banner', '-version'],
    parseVersion: (output) => /ffmpeg version (\S+)/.exec(output)?.[1] ?? null,
    minVersion: null,
    consentRequired: false,
    release: null,
    envVar: 'CUCCUT_FFMPEG',
    get missingRemedy() {
      return ffmpegMissingRemedyMessage();
    },
  },
];

/** This machine's platform key. */
export function platformKey(platform: string = process.platform, arch: string = process.arch): string {
  return `${platform}-${arch}`;
}

/**
 * Download address: when a mirror is given (the setting `tools.downloadEndpoint` or the environment variable `CUCCUT_TOOLS_ENDPOINT`), it is `<base>/<tool>/<version>/<file name>`.
 * Otherwise it is the official release address.
 */
export function toolDownloadUrl(manifest: ToolManifest, release: ToolRelease, asset: ToolAsset, endpoint: string | null): string {
  if (endpoint) {
    const base = endpoint.replace(/\/+$/, '');
    return `${base}/${encodeURIComponent(manifest.name)}/${encodeURIComponent(release.version)}/${encodeURIComponent(asset.fileName)}`;
  }
  return release.officialUrl
    .replace('{version}', encodeURIComponent(release.version))
    .replace('{file}', encodeURIComponent(asset.fileName));
}

/** What to tell the user before a download; when a download is not possible, the reason. */
export function toolOffer(manifest: ToolManifest, endpoint: string | null, platform: string): ExternalToolOffer | null {
  const release = manifest.release;
  if (!release) return null;
  const asset = release.assets[platform] ?? null;
  const blockedReason = !asset ? RcExternalTools.noReleaseForPlatform({ platform }) : asset.sha256 === null ? RcExternalTools.noTrustedSha() : null;
  return {
    version: release.version,
    fileName: asset?.fileName ?? null,
    url: asset ? toolDownloadUrl(manifest, release, asset, endpoint) : null,
    sizeBytes: asset?.size ?? null,
    estimatedBytes: release.estimatedBytes,
    sha256: asset?.sha256 ?? null,
    license: release.license,
    homepage: release.homepage,
    blockedReason: blockedReason?.text ?? null,
    ...(blockedReason ? { blockedReasonRef: refOf(blockedReason) } : {}),
  };
}

/**
 * Compares two dot-separated numeric versions (yt-dlp's `2026.07.04`, nightly's `2026.07.04.123456`): negative when a < b. A segment that is not a number counts as 0.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((s) => Number.parseInt(s, 10) || 0);
  const pb = b.split('.').map((s) => Number.parseInt(s, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
