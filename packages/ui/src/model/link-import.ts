import { LINK_COOKIE_BROWSERS, live, localizeToolStatus, type ExternalToolStatus, type JobError, type JobRecord, type LinkCookieBrowser, type LinkImportSummary } from '@cuccut/protocol';
import { shortenPath } from './format.ts';
import { M } from './link-import-copy.ts';
import { formatBytes } from './space.ts';
import { UPDATE_METHOD_LABEL } from './tool-update.ts';
import { jobErrorText, remedyText } from './localized-text.ts';

/**
 * Import from a link (design draft import-flow.jsx, import-panel.jsx, model-import.js; the Runtime's `link-import` flow, architecture design §7.9).
 * This is pure logic here: it recognizes flow tasks, reads frozen parameters and result summaries, the three-step progress, the failure wording and remedies, and the states of the download tool card.
 *
 * Differences from the design draft:
 * - An import started from the home page carries no `videoId`: the flow only parses, downloads, verifies and puts the file into the download directory. Creating the video and transcription are done by the home page's flow runner after the flow completes (components/start/flow-runner.ts), so half of the states of the “confirm media and create video” and “generate captions” steps come from there. That side carries the `linkProvenance` source when it imports the media, so the video details still show “source info”.
 * - The download tool is local only (there is no “which computer to download on”). For sites that need login, browsers are ticked in “website login” under downloading videos (model/link-cookies.ts), and the Runtime uses their cookies in the ticked order.
 * - Failure records cannot be deleted: the Runtime has no interface to delete tasks, so the records stay in the background tasks.
 */

export const LINK_IMPORT = 'link-import';
export const DOWNLOADER = 'yt-dlp';

/** The parent task of a link import, started from the home page or from elsewhere. */
export function isLinkImport(job: Pick<JobRecord, 'kind' | 'pipeline'> | null | undefined): boolean {
  return !!job && job.kind === 'pipeline' && job.pipeline?.name === LINK_IMPORT;
}

export interface LinkFrozen {
  /** The link after redaction. */
  url: string;
  host: string;
  audioOnly: boolean;
  /** The frozen download directory. */
  outDir: string | null;
  videoId: string | null;
}

const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

/** A few items of the frozen parameters shown to people (the Runtime stores the redacted link). */
export function linkFrozen(job: Pick<JobRecord, 'pipeline'>): LinkFrozen {
  const p = job.pipeline?.params ?? {};
  const url = str(p.url) ?? '';
  return {
    url,
    host: str(p.host) ?? (/^https?:\/\/([^/?#]+)/i.exec(url)?.[1] ?? '').replace(/^www\./i, ''),
    audioOnly: p.audioOnly === true,
    outDir: str(p.outDir),
    videoId: str(p.videoId),
  };
}

/** The result summary when complete; null when the shape is wrong (or it has not completed). */
export function linkSummary(job: Pick<JobRecord, 'pipeline'>): LinkImportSummary | null {
  const s = job.pipeline?.summary as Partial<LinkImportSummary> | null | undefined;
  if (!s || typeof s !== 'object' || !s.files || typeof s.files.media !== 'string') return null;
  return {
    url: str(s.url) ?? '',
    title: str(s.title),
    platform: str(s.platform),
    uploader: str(s.uploader),
    durationSec: typeof s.durationSec === 'number' ? s.durationSec : null,
    files: { media: s.files.media, subtitles: Array.isArray(s.files.subtitles) ? s.files.subtitles.filter((f) => typeof f === 'string') : [] },
    tool: s.tool && typeof s.tool === 'object' ? s.tool : { name: DOWNLOADER, version: '', source: '' },
    cookieBrowser: LINK_COOKIE_BROWSERS.includes(s.cookieBrowser as LinkCookieBrowser) ? (s.cookieBrowser as LinkCookieBrowser) : null,
    downloadedAt: str(s.downloadedAt) ?? '',
    videoId: str(s.videoId),
    assetId: str(s.assetId),
    transcribeJobId: str(s.transcribeJobId),
  };
}

/** Metadata left by the parse step (title, platform): can be shown even before the flow completes. */
export function linkMeta(job: Pick<JobRecord, 'pipeline'>): { title: string | null; platform: string | null; durationSec: number | null } {
  const summary = linkSummary(job);
  if (summary) return { title: summary.title, platform: summary.platform, durationSec: summary.durationSec };
  const resolve = job.pipeline?.steps.find((s) => s.name === 'resolve')?.output ?? null;
  const meta = resolve?.metadata && typeof resolve.metadata === 'object' ? (resolve.metadata as Record<string, unknown>) : null;
  return {
    title: str(meta?.title),
    platform: str(meta?.platform),
    durationSec: typeof meta?.durationSec === 'number' ? (meta.durationSec as number) : null,
  };
}

/**
 * The source the media records when the video is created after an import started from the home page completes: the same shape that `importIntoVideo` records when the flow imports it itself (given a `videoId`)
 * (`origin: 'link-import'`, the redacted link, platform metadata, tool and version, download time, parent task). For the items not in the summary, the metadata from the parse step is used.
 * null when not complete.
 */
export function linkProvenance(job: Pick<JobRecord, 'jobId' | 'pipeline'>): { origin: string; source: Record<string, unknown> } | null {
  const summary = linkSummary(job);
  if (!summary) return null;
  const resolve = job.pipeline?.steps.find((s) => s.name === 'resolve')?.output ?? null;
  const meta = resolve?.metadata && typeof resolve.metadata === 'object' ? (resolve.metadata as Record<string, unknown>) : {};
  return {
    origin: LINK_IMPORT,
    source: {
      url: summary.url || linkFrozen(job).url,
      webpageUrl: str(meta.webpageUrl),
      platform: summary.platform ?? str(meta.platform),
      mediaId: str(meta.mediaId),
      title: summary.title ?? str(meta.title),
      uploader: summary.uploader ?? str(meta.uploader),
      uploadDate: str(meta.uploadDate),
      durationSec: summary.durationSec,
      tool: summary.tool,
      downloadedAt: summary.downloadedAt || null,
      jobId: job.jobId,
    },
  };
}

/** The title in the task list: “Import from link · title”; when the title is not known yet, the host name is written. */
export function linkTitle(job: Pick<JobRecord, 'pipeline'>): string {
  const meta = linkMeta(job);
  const name = meta.title ?? (linkFrozen(job).host || null);
  return M.title(name);
}

/** The kind shown in the task table and the capsule (`kind` is the generic `pipeline`). */
export function linkKindLabel(): string {
  return M.title(null);
}

/**
 * Stage of the parent task → one sentence (`phase` is reported by the steps of the flow). The caption-layer step also reports `applying`, the same name as importing the video;
 * it is described as “generate captions” according to the step that is actually running.
 */
export function linkPhaseText(job: Pick<JobRecord, 'phase' | 'pipeline'>): string {
  if (job.pipeline?.steps.find((s) => s.status === 'running')?.name === 'captions') return M.stageSubs;
  return M.phase[job.phase] ?? M.phaseFallback;
}

/** Byte progress of the download step (the `bytes` reported by the subtask): a percentage and “12 MB / 45 MB”. null when absent. */
export function downloadProgress(job: Pick<JobRecord, 'pipeline'>, jobs: readonly JobRecord[]): { pct: number | null; text: string } | null {
  const step = job.pipeline?.steps.find((s) => s.name === 'download');
  if (!step?.jobId || step.status !== 'running') return null;
  const child = jobs.find((j) => j.jobId === step.jobId);
  const p = child?.progress;
  if (!p || p.unit !== 'bytes') return null;
  if (!p.total) return { pct: null, text: M.downloaded(formatBytes(p.done)) };
  const pct = Math.max(0, Math.min(100, Math.floor((p.done / p.total) * 100)));
  return { pct, text: `${formatBytes(p.done)} / ${formatBytes(p.total)}` };
}

// ---- Three steps: download video · confirm media and create video · generate captions ----

export type StageState = 'pending' | 'current' | 'done' | 'failed' | 'skipped';

export interface LinkStage {
  key: 'download' | 'video' | 'subs';
  label: string;
  state: StageState;
}

/** How far the home page's executor half got after the flow completes; null when the import did not start from the home page (or the app was restarted). */
export interface FollowUp {
  video: 'pending' | 'running' | 'done' | 'failed';
  /** `skipped` when it is not transcribed (audio-to-video had captions turned off). */
  subs: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
}

const STOPPED = new Set(['failed', 'cancelled', 'interrupted']);

function stepsState(job: Pick<JobRecord, 'pipeline'>, names: readonly string[]): StageState {
  const steps = (job.pipeline?.steps ?? []).filter((s) => names.includes(s.name));
  if (!steps.length) return 'pending';
  if (steps.some((s) => STOPPED.has(s.status))) return 'failed';
  if (steps.every((s) => s.status === 'completed' || s.status === 'skipped')) return 'done';
  if (steps.some((s) => s.status === 'running' || s.status === 'completed')) return 'current';
  return 'pending';
}

export function linkStages(job: Pick<JobRecord, 'pipeline' | 'state'>, follow: FollowUp | null): LinkStage[] {
  const download = stepsState(job, ['resolve', 'download']);
  const fetched = stepsState(job, ['verify', 'publish']);
  // An import started with a videoId (elsewhere): the flow imports and transcribes it itself.
  const own = (job.pipeline?.steps ?? []).some((s) => s.name === 'import');
  let video: StageState;
  let subs: StageState;
  if (own) {
    const imported = stepsState(job, ['verify', 'publish', 'import']);
    video = imported;
    const transcribeStep = (job.pipeline?.steps ?? []).some((s) => s.name === 'transcribe');
    subs = transcribeStep ? stepsState(job, ['transcribe']) : 'skipped';
  } else {
    video =
      fetched === 'failed' || follow?.video === 'failed'
        ? 'failed'
        : fetched === 'done' && follow?.video === 'done'
          ? 'done'
          : fetched === 'current' || (fetched === 'done' && (follow?.video === 'running' || follow?.video === 'pending'))
            ? 'current'
            : fetched === 'done' && !follow
              ? 'current'
              : 'pending';
    subs = !follow ? 'pending' : follow.subs === 'running' ? 'current' : follow.subs === 'pending' ? 'pending' : follow.subs;
  }
  if (download === 'failed') video = 'pending';
  return [
    { key: 'download', label: M.stageDownload, state: download },
    { key: 'video', label: M.stageVideo, state: video },
    { key: 'subs', label: M.stageSubs, state: subs },
  ];
}

// ---- Failure wording and remedies ----

export type LinkAction = 'retry' | 'change-link' | 'use-file' | 'tools' | 'restart' | 'downloads';

export interface LinkIssue {
  code: string;
  title: string;
  body: string;
  /** Remedy buttons; the first one is the primary button. */
  actions: LinkAction[];
  /** The original text from the download tool (the end of standard error, link redacted); null when absent. */
  diag: string | null;
}

/** Recognized failure codes → remedy buttons (the first one is primary); titles and descriptions are in the `issue` of the copy catalog. */
const LINK_ISSUE_ACTIONS: Record<string, LinkAction[]> = {
  TOOL_NOT_INSTALLED: ['tools'],
  TOOL_CONSENT_REQUIRED: ['tools'],
  TOOL_UNAVAILABLE: ['tools'],
  TOOL_OUTDATED: ['tools', 'retry'],
  OFFLINE_STRICT: ['use-file'],
  LINK_UNSUPPORTED: ['change-link', 'use-file'],
  LINK_LOGIN_REQUIRED: ['use-file', 'change-link'],
  LINK_COOKIES_UNAVAILABLE: ['change-link', 'retry'],
  LINK_TOOL_UPDATE_REQUIRED: ['tools', 'retry'],
  LINK_UNAVAILABLE: ['change-link', 'use-file'],
  LINK_NETWORK_ERROR: ['retry', 'use-file'],
  LINK_DISK_FULL: ['retry', 'downloads'],
  LINK_DOWNLOAD_FAILED: ['retry', 'tools', 'use-file'],
  LINK_DOWNLOAD_UNREADABLE: ['retry', 'change-link', 'use-file'],
  LINK_DESTINATION_UNAVAILABLE: ['downloads', 'restart'],
  MEDIA_TOOL_UNAVAILABLE: ['retry'],
  LINK_SOURCE_EXPIRED: ['restart'],
  INTERRUPTED: ['retry'],
};

/** The error of the parent task (or the rejection from `pipelines.start`) → title, description and remedy buttons. Unrecognized codes are shown with the Runtime's original text. */
export function linkIssue(error: Pick<JobError, 'code' | 'message' | 'messageRef' | 'details'> | null, state?: JobRecord['state']): LinkIssue | null {
  if (!error && state !== 'interrupted') return null;
  const code = error?.code ?? 'INTERRUPTED';
  const details = (error?.details && typeof error.details === 'object' ? error.details : {}) as Record<string, unknown>;
  const stderr = str(details.stderr);
  const knownCode = LINK_ISSUE_ACTIONS[code] ? code : state === 'interrupted' ? 'INTERRUPTED' : null;
  const known = knownCode ? M.issue[knownCode] : undefined;
  if (knownCode && known) return { code, title: known.title, body: known.body, actions: [...LINK_ISSUE_ACTIONS[knownCode]!], diag: stderr };
  const remedy = remedyText(details);
  return {
    code,
    title: M.issueUnknownTitle,
    body: M.issueUnknownBody(jobErrorText(error) || null, remedy),
    actions: ['retry', 'use-file'],
    diag: stderr,
  };
}

/** When `pipelines.start` is rejected, the code in the error (`RpcError.details.code`). */
export function rejectionCode(error: unknown): string | null {
  const details = (error as { details?: unknown } | null)?.details;
  const code = details && typeof details === 'object' ? (details as { code?: unknown }).code : null;
  return typeof code === 'string' ? code : null;
}

/** The large title of the link import (the heading of `ImportTask` in the design draft). */
export function linkHeading(job: Pick<JobRecord, 'state'>, follow: FollowUp | null): string {
  if (job.state === 'cancelled') return M.headingStopped;
  if (job.state === 'failed' || job.state === 'interrupted' || job.state === 'needs-reconciliation') return M.headingFailed;
  if (job.state !== 'completed') return M.headingRunning;
  if (!follow) return M.headingDownloaded;
  if (follow.video === 'failed') return M.headingVideoFailed;
  if (follow.video !== 'done') return M.headingCreatingVideo;
  if (follow.subs === 'running' || follow.subs === 'pending') return M.headingTranscribing;
  if (follow.subs === 'failed') return M.headingTranscribeFailed;
  return follow.subs === 'skipped' ? M.headingReady : M.headingSubsReady;
}

// ---- Download tool card ----

export type ToolCardState = 'checking' | 'unknown' | 'installing' | 'updating' | 'install' | 'update' | 'broken' | 'blocked' | 'consent' | 'ready';

export interface ToolCard {
  state: ToolCardState;
  title: string;
  body: string;
  /** The primary button (agree and install / agree and update / agree to use); null when absent. */
  action: string | null;
  /** Facts such as source, version, size and license, one per line. */
  facts: string[];
}

export const TOOL_SOURCE_LABEL: Record<NonNullable<ExternalToolStatus['source']>, string> = live(() => M.toolSource);

/** Whether the download tool can be used directly: installed, version sufficient, consent given. */
export function toolReady(status: ExternalToolStatus | null | undefined): boolean {
  return !!status && status.state === 'installed' && (!status.consentRequired || status.consent?.state === 'granted');
}

function offerFacts(status: ExternalToolStatus): string[] {
  const o = status.offer;
  if (!o) return [];
  const size = o.sizeBytes ?? o.estimatedBytes;
  let from = '';
  try {
    from = o.url ? new URL(o.url).host : '';
  } catch {
    from = '';
  }
  return [
    M.factVersion(o.version, size ? formatBytes(size) : null),
    [from ? M.factFrom(from) : null, o.license ? M.factLicense(o.license) : null].filter(Boolean).join(' · '),
    M.factIsolated,
  ].filter(Boolean);
}

/** The one in use right now: version, source, install method (when it can be determined), and its path. */
function usedFacts(status: ExternalToolStatus): string[] {
  const where = [
    status.version ? `yt-dlp ${status.version}` : 'yt-dlp',
    status.source ? TOOL_SOURCE_LABEL[status.source] : null,
    status.update ? M.factInstalledWith(UPDATE_METHOD_LABEL[status.update.method] ?? status.update.method) : null,
  ].filter(Boolean).join(' · ');
  return [where, status.path ? shortenPath(status.path) : null].filter((f): f is string => !!f);
}

/**
 * The download tool card before the link section starts (design draft `DownloaderSettings` and `issues.missing/outdated`). It only reads the result of `externalTools.detect`;
 * installing and consenting both happen only when the user clicks (`externalTools.install` with `consent: true` also records the consent). The copy on the system is updated with its original install method (product design §2.7): the command and output are in the card's “Update” section, and while updating the card is `updating`.
 */
export function toolCard(probed: ExternalToolStatus | null | undefined, opts: { checking: boolean; installing: boolean; updating?: boolean }): ToolCard {
  const status = probed && localizeToolStatus(probed);
  if (opts.checking && !status) return { state: 'checking', title: M.cardChecking, body: M.cardCheckingBody, action: null, facts: [] };
  if (!status) return { state: 'unknown', title: M.cardUnknown, body: M.cardUnknownBody, action: null, facts: [] };
  if (opts.installing || status.installJobId)
    return {
      state: 'installing',
      title: M.cardInstalling,
      body: M.cardInstallingBody,
      action: null,
      facts: offerFacts(status),
    };
  if (opts.updating || status.updateJobId)
    return { state: 'updating', title: M.cardUpdating, body: M.cardUpdatingBody, action: null, facts: usedFacts(status) };
  const blocked = !status.installable || !status.offer || !!status.offer.blockedReason;
  const why = status.offer?.blockedReason ?? status.remedy ?? status.reason ?? M.cardBlockedWhy;
  if (status.state === 'missing') {
    if (blocked)
      return { state: 'blocked', title: M.cardMissing, body: M.cardMissingBody(why), action: null, facts: [] };
    return {
      state: 'install',
      title: M.cardInstall,
      body: M.cardInstallBody,
      action: M.cardInstallAction,
      facts: offerFacts(status),
    };
  }
  if (status.state === 'outdated') {
    const body = M.cardOutdatedReason(status.reason, status.version, status.minVersion);
    if (blocked || status.source === 'system' || status.source === 'env' || status.source === 'user')
      return {
        state: 'blocked',
        title: M.cardOutdated,
        body: M.cardOutdatedBlocked(
          body,
          status.source === 'managed' ? why : status.update?.runnable ? M.cardOutdatedRunnable : M.cardOutdatedManual,
        ),
        action: null,
        facts: [],
      };
    return { state: 'update', title: M.cardOutdated, body: M.cardOutdatedUpdate(body), action: M.cardUpdateAction, facts: offerFacts(status) };
  }
  if (status.state === 'unavailable') {
    const body = M.cardBrokenBody(status.reason, status.remedy);
    return blocked
      ? { state: 'blocked', title: M.cardBroken, body, action: null, facts: [] }
      : { state: 'broken', title: M.cardBroken, body, action: M.cardReinstallAction, facts: offerFacts(status) };
  }
  const facts = usedFacts(status);
  if (status.consentRequired && status.consent?.state !== 'granted')
    return {
      state: 'consent',
      title: status.consent?.state === 'revoked' ? M.cardConsentRevoked : M.cardConsent,
      body: M.cardConsentBody,
      action: M.cardConsentAction,
      facts,
    };
  return { state: 'ready', title: M.cardReady, body: M.cardReadyBody, action: null, facts };
}

/** The download location row (Runtime rule: if `downloads.directory` is set, it is always used there; otherwise the host's ~/Downloads). */
export function downloadDirLabel(setting: string | null, _projectPath: string | null): string {
  if (setting) return shortenPath(setting);
  return '~/Downloads';
}
