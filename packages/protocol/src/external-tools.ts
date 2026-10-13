import type { Id } from './domain.ts';
import { localizeText, type MessageRef } from './message-ref.ts';
import type { LinkCookieBrowser } from './pipelines.ts';

/**
 * Managed external tools (architecture design §12.9): programs that CucCut uses but does not ship with the app. The only tool CucCut can download is the download tool `yt-dlp`. ffmpeg is still found from
 * `CUCCUT_FFMPEG` or PATH, except that its probe result is also in the same status view. The audio.cpp engine for music generation is not a managed external tool; it is the component `audiocpp-engine` of a music model pack, downloaded with the pack (`models.ts`, architecture design §6.3).
 *
 * Rules:
 * - The download tool is not packaged with the app, and it is installed or used only after the user has explicitly consented. Consent is recorded per tool (when, and by what means), and can be withdrawn. After withdrawal, every flow that uses it refuses to run. ffmpeg needs no consent (it only handles local files).
 * - The copy CucCut downloads itself is placed in the Runtime Home under `tools/<tool>/<version>/`. It is made executable and run only after its sha256 and size have been verified against the manifest.
 *   When the digest is unknown in the manifest, installation is refused (`TOOL_MANIFEST_INCOMPLETE`); no digest is made up.
 * - The probe only runs `<tool> --version` on this machine; it makes no network connection.
 * - The copy the user installed on the system is updated by its original install method (Homebrew, pipx, pip, the official standalone program; on Windows also winget, Scoop, Chocolatey).
 *   When probing, the method is determined from the executable's real location. Only after the user has reviewed the full command and confirmed does CucCut run it on this machine (`externalTools.update`).
 *   When administrator privileges are needed, only the command is given; no privilege escalation is performed.
 */

/** The tool's state now: installed (runs, version sufficient), not installed, needs update (version below the minimum), or unavailable (found but cannot run). */
export type ExternalToolState = 'installed' | 'missing' | 'outdated' | 'unavailable';

/**
 * Where the copy in use now comes from: the one on the system PATH, a path specified by the user, the managed copy CucCut downloaded, the one distributed with the app (`bin/`; no tool in the registry uses it at present,
 * kept as a general source), or one specified by an environment variable (such as `CUCCUT_FFMPEG`).
 */
export type ExternalToolSource = 'system' | 'user' | 'managed' | 'bundled' | 'env';

/** The means of consent: the desktop UI, the CLI, or the user approving the agent's request within a session. */
export type ExternalToolConsentVia = 'app' | 'cli' | 'agent-approval';

/** The user's consent to a tool: the most recent decision. After `revoked`, every flow that uses it refuses to run, until consent is given again. */
export interface ExternalToolConsent {
  state: 'granted' | 'revoked';
  /** Time of the decision (ISO 8601). */
  at: string;
  via: ExternalToolConsentVia;
}

/** What to tell the user before downloading a tool: source, version, size, and license. */
export interface ExternalToolOffer {
  version: string;
  /** The file to download for this machine's platform; null when there is no usable file for the platform. */
  fileName: string | null;
  /** Download address (default source or mirror); null when there is no usable file for the platform. */
  url: string | null;
  /** Byte count from the manifest; null when unknown. */
  sizeBytes: number | null;
  /** Estimated byte count (for display to people when the size is unknown). */
  estimatedBytes: number;
  /** sha256 from the manifest; null when unknown (in which case it cannot be downloaded). */
  sha256: string | null;
  license: string;
  homepage: string;
  /** Why it cannot be downloaded (incomplete manifest, unsupported platform); null when it can be downloaded. */
  blockedReason: string | null;
  blockedReasonRef?: MessageRef;
}

/**
 * Original install method: Homebrew, pipx, pip, the update built into the official standalone program (`yt-dlp -U`), and on Windows winget, Scoop, Chocolatey
 * (Chocolatey requires administrator privileges, so it is always command-only).
 */
export type ExternalToolUpdateMethod = 'homebrew' | 'pipx' | 'pip' | 'standalone' | 'winget' | 'scoop' | 'chocolatey';

/**
 * Update the copy in use now by its original install method (`externalTools.update`). Determined at probe time from the executable's real location, without network access. When it cannot be determined,
 * or when it is the managed copy CucCut downloaded (use `externalTools.install` to change version), the status is null.
 */
export interface ExternalToolUpdatePlan {
  method: ExternalToolUpdateMethod;
  /** The program to run and its arguments: no shell is involved; they are passed to the program as-is. */
  argv: string[];
  /**
   * A line for people to read that can be copied into the Runtime host's terminal: on Windows, PowerShell quoting rules (when the first word is quoted, `&` is put in front); on other systems, POSIX shell. A standalone program that needs administrator privileges gets `sudo` in front on POSIX (CucCut does not run it).
   */
  command: string;
  /** Whether CucCut can run it on the user's behalf. When it cannot (needs administrator privileges, brew, pipx, winget or Scoop not found, interpreter gone), only the command is given, and `reason` explains why. */
  runnable: boolean;
  reason: string | null;
  reasonRef?: MessageRef;
}

/** One item from `externalTools.list`. */
export interface ExternalToolStatus {
  name: string;
  label: string;
  purpose: string;
  purposeRef?: MessageRef;
  state: ExternalToolState;
  /** The reason for `outdated`, `unavailable`, or `missing`; null when installed. */
  reason: string | null;
  reasonRef?: MessageRef;
  /** Absolute path of the copy that would be used now (null when `missing`). */
  path: string | null;
  version: string | null;
  source: ExternalToolSource | null;
  minVersion: string | null;
  /** Whether CucCut can download this tool on the user's behalf (a manifest exists); being downloadable does not mean the manifest is complete right now, see `offer.blockedReason`. */
  installable: boolean;
  /** Description of the download; null for a tool that cannot be downloaded. */
  offer: ExternalToolOffer | null;
  /** Whether the user's consent must be obtained before using it. */
  consentRequired: boolean;
  /** The most recent consent or withdrawal; null if never decided. */
  consent: ExternalToolConsent | null;
  /** Managed copies already downloaded (not necessarily the same one as the copy in use now). */
  managed: { version: string; path: string; installedAt: string } | null;
  /** The path the user specified with `externalTools.setPath`. */
  userPath: string | null;
  /** The installation task in progress (`kind: 'toolInstall'`). */
  installJobId: Id | null;
  /** The method for updating by the original install method; null when it cannot be determined, is a managed copy, or was not found. */
  update: ExternalToolUpdatePlan | null;
  /** The update task in progress (`kind: 'toolUpdate'`): the output is in the task record's `command`. */
  updateJobId: Id | null;
  /**
   * The platform of the host where the Runtime runs (values of `process.platform`: darwin, win32, linux, ...). The tool runs on that host; when the UI cannot determine the install method,
   * common commands are listed according to it.
   */
  platform: string;
  /** A remedy for when it cannot be used (a one-sentence message for people). */
  remedy: string | null;
  remedyRef?: MessageRef;
}

/** Result of `externalTools.install`: the submitted installation task (progress through the `jobs` topic), and the tool's status at submission. */
export interface ExternalToolInstallResult {
  tool: ExternalToolStatus;
  jobId: Id;
}

/** Result of `externalTools.update`: the submitted update task (output through the `jobs` topic), and the tool's status at submission. */
export interface ExternalToolUpdateResult {
  tool: ExternalToolStatus;
  jobId: Id;
}

/**
 * One item of `externalTools.cookieBrowsers`: a browser on this machine whose cookie store can be found. It only checks whether the file exists and when it was last modified, using the download tool's own lookup rules; it does not read cookie contents. The most recently used are listed first, and video downloads try them in this order, one by one.
 */
export interface CookieBrowserInfo {
  /** Values of `cookieBrowsers`. */
  id: LinkCookieBrowser;
  /** Name for display to people. */
  label: string;
  /** When the cookie store was last changed (ISO 8601); null when it cannot be read (for example, no permission), in which case it sorts last. */
  lastUsedAt: string | null;
}

/**
 * The few sentences of human-readable text in the external tool status (purpose, reason, remedy, reason it cannot be downloaded, reason it cannot be updated on its behalf) are regenerated in the reader's current language: the Runtime writes them in its own language, which may differ from the UI, or may have been read before the language was switched. The UI and CLI pass them through once more before display. */
export function localizeToolStatus(status: ExternalToolStatus): ExternalToolStatus {
  return {
    ...status,
    purpose: localizeText(status.purpose, status.purposeRef),
    reason: localizeText(status.reason, status.reasonRef) ?? null,
    remedy: localizeText(status.remedy, status.remedyRef) ?? null,
    offer: status.offer ? { ...status.offer, blockedReason: localizeText(status.offer.blockedReason, status.offer.blockedReasonRef) ?? null } : null,
    update: status.update ? { ...status.update, reason: localizeText(status.update.reason, status.update.reasonRef) ?? null } : null,
  };
}
