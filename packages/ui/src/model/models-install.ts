import type { JobRecord, ModelBundleStatus, ModelInstallPlan, ModelInstallProgress } from '@cuccut/protocol';
import {
  bundleCategory,
  downloadBytes,
  hasOwnFiles,
  isBundleInstalled,
  LOCAL_PROVIDER,
  missingParts,
  sharedComponents,
} from './models-local.ts';
import { fmtSize } from './task-facts.ts';
import { M } from './models-install-copy.ts';
import { jobErrorText, remedyText } from './localized-text.ts';

/**
 * Installation management for local model packages (architecture design §6.3; design settings-local.jsx, model-local-models.js):
 * two-step confirmation for install and repair (first review the plan, then hand back `confirmBytes`), download progress, delete estimates, and the remedies shown to people for each kind of failure.
 * Status and wording for checks (`models.test`) are in model-check.ts.
 * All numbers come from the Runtime: when the total byte count is unknown, no percentage is fabricated, and estimates are labeled as estimates.
 */

// ---- Confirmation dialog ----

export interface PlanLine {
  key: string;
  /** `asr · Qwen/Qwen3-ASR-0.6B` */
  label: string;
  /** `412 MB`, `大小未知` (size unknown), `已装好，不动` (already installed, left alone) */
  value: string;
}

export interface InstallPlanView {
  /** Already complete; nothing to download. */
  upToDate: boolean;
  /** “need to download 1.2 GB”; when some file sizes are unknown, “约 1.2 GB（有文件大小未知，按登记的估计）” (about 1.2 GB (some file sizes unknown, using the registered estimate)). */
  size: string;
  /** The amount on the button: “1.2 GB” or “about 1.2 GB”. */
  amount: string;
  /** The part left over from last time and reused this time; null when there is none. */
  resumed: string | null;
  /** Free disk space; null when it cannot be determined. */
  space: string | null;
  /** Free space is clearly insufficient (not counting the part already received): clean up first, then download. */
  noSpace: string | null;
  source: string;
  lines: PlanLine[];
}

/** Plan → a few lines of text in the confirmation dialog. */
export function installPlanView(plan: ModelInstallPlan): InstallPlanView {
  const exact = plan.downloadBytes !== null;
  const size = exact ? M.planSize(fmtSize(plan.confirmBytes)) : M.planSizeEstimate(fmtSize(plan.confirmBytes));
  const noSpace =
    plan.availableBytes !== null && plan.availableBytes < plan.confirmBytes
      ? M.noSpace(fmtSize(plan.confirmBytes), fmtSize(plan.availableBytes))
      : null;
  return {
    upToDate: plan.upToDate,
    size,
    amount: exact ? fmtSize(plan.confirmBytes) : M.amountEstimate(fmtSize(plan.confirmBytes)),
    resumed: plan.resumedBytes > 0 ? M.resumed(fmtSize(plan.resumedBytes)) : null,
    space: plan.availableBytes !== null ? M.space(fmtSize(plan.availableBytes)) : null,
    noSpace,
    source: plan.source,
    lines: plan.components.map((c) => ({
      key: `${c.component}:${c.repo}`,
      label: `${c.component} · ${c.repo}`,
      value: c.action === 'keep' ? M.lineKeep : c.bytes !== null ? M.lineSize(fmtSize(c.bytes), c.files.length) : M.lineUnknown(c.files.length),
    })),
  };
}

// ---- Progress ----

export interface InstallProgressView {
  state: ModelInstallProgress['state'];
  /** “downloading 120 MB / 1.2 GB”, “paused · 300 MB kept” */
  label: string;
  /** 0–100; null when the total byte count is unknown, or when queued or verifying (the progress bar shows as indeterminate). */
  percent: number | null;
  /** A task is running (queued, downloading, verifying): it can be stopped. */
  running: boolean;
}

export function installProgressView(install: ModelInstallProgress): InstallProgressView {
  const { receivedBytes: got, totalBytes: total } = install;
  const amount = total !== null ? `${fmtSize(got)} / ${fmtSize(total)}` : fmtSize(got);
  const percent = total !== null && total > 0 ? Math.min(100, Math.floor((got / total) * 100)) : null;
  switch (install.state) {
    case 'queued':
      return { state: 'queued', label: M.queued, percent: null, running: true };
    case 'downloading':
      return { state: 'downloading', label: total !== null ? M.downloading(amount) : M.downloadingUnknown(amount), percent, running: true };
    case 'verifying':
      return { state: 'verifying', label: M.verifying, percent: null, running: true };
    case 'paused':
      return {
        state: 'paused',
        label: got > 0 ? M.pausedKept(amount) : M.paused,
        percent,
        running: false,
      };
  }
}

// ---- Download in place (design tool-tts.jsx, image-gen.jsx, panel-aitools.jsx, panel-dub-setup.jsx “download {size}”) ----

/** Whether this model package can be downloaded in place: not yet installed, and this computer can run it. Packages that are already installed, or that cannot run (`unsupported`, `worker-missing`), do not count. */
export function canDownload(bundle: Pick<ModelBundleStatus, 'state' | 'reason' | 'components'>): boolean {
  return !isBundleInstalled(bundle) && bundle.reason !== 'unsupported' && bundle.reason !== 'worker-missing';
}

/** The model package of this model on this machine when it can be downloaded in place; null for cloud, node, already installed, or ones this computer cannot run. */
export function downloadableBundle(
  bundles: readonly ModelBundleStatus[],
  ref: { providerId: string; modelId: string } | null,
): ModelBundleStatus | null {
  if (!ref || ref.providerId !== LOCAL_PROVIDER) return null;
  const bundle = bundles.find((b) => b.bundleId === ref.modelId);
  return bundle && canDownload(bundle) ? bundle : null;
}

/**
 * When dubbing needs background separation and there is no usable separation model on this machine, which one to download in place: the first downloadable one by ID (the Runtime also picks the separation default by ID).
 * null when none can be downloaded (this computer cannot run them).
 */
export function separationDownload(bundles: readonly ModelBundleStatus[]): ModelBundleStatus | null {
  return (
    bundles
      .filter((b) => b.capability === 'separate')
      .sort((a, b) => a.bundleId.localeCompare(b.bundleId))
      .find(canDownload) ?? null
  );
}

/**
 * Which kind of install the in-place download performs (same decision as the settings page, design settings-local.jsx `half`): when this model package's own files are already on disk (weights present with shared components missing,
 * or halfway through a download with the weights already landed), it is a fill-in — only the missing parts are downloaded, and the license is not asked again; otherwise it is a download. Shared components are counted per their category of model package (`hasOwnFiles`).
 */
export function inlineInstallMode(bundle: ModelBundleStatus, bundles: readonly ModelBundleStatus[]): 'install' | 'complete' {
  return hasOwnFiles(bundle, sharedComponents(bundles, bundleCategory(bundle))) ? 'complete' : 'install';
}

export interface DownloadView {
  /** `idle`: not started; `paused`: stopped halfway (can resume); `running`: downloading (queued, downloading, verifying). */
  state: 'idle' | 'paused' | 'running';
  /** How much to download: the total of the download task; when there is none, it is computed from the missing components (`downloadBytes`, the same figure as on the settings page); null when neither is known. */
  size: string | null;
  /** Percentage while downloading; null when the total is unknown, or when queued or verifying. */
  percent: number | null;
}

/** How the in-place download control looks right now: the button shows the size, and shows progress while downloading. */
export function downloadView(bundle: Pick<ModelBundleStatus, 'install' | 'estimatedBytes' | 'components'>): DownloadView {
  const install = bundle.install;
  const total = install?.totalBytes || downloadBytes(bundle);
  const size = total ? fmtSize(total) : null;
  if (!install) return { state: 'idle', size, percent: null };
  const progress = installProgressView(install);
  return progress.running ? { state: 'running', size, percent: progress.percent } : { state: 'paused', size, percent: null };
}

// ---- Failures and remedies ----

export interface Problem {
  /** The Runtime's own message. */
  message: string;
  /** What to do (“怎么办”); for unrecognized error codes, the Runtime's `remedy` is used; null when neither is available. */
  remedy: string | null;
}

function num(details: unknown, key: string): number | null {
  const v = (details as Record<string, unknown> | null | undefined)?.[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function str(details: unknown, key: string): string | null {
  const v = (details as Record<string, unknown> | null | undefined)?.[key];
  return typeof v === 'string' && v ? v : null;
}

/** Spells out what to do for each error code (installing, repairing, and deleting model packages). */
export function modelProblem(code: string | null, message: string, details: unknown): Problem {
  switch (code) {
    case 'MODEL_DOWNLOAD_NO_SPACE': {
      const need = num(details, 'requiredBytes');
      const have = num(details, 'availableBytes');
      const known = need !== null && have !== null;
      return { message, remedy: M.remedyNoSpace(known ? fmtSize(need) : null, known ? fmtSize(have) : null) };
    }
    case 'MODEL_DOWNLOAD_NETWORK':
      return { message, remedy: M.remedyNetwork };
    case 'MODEL_DOWNLOAD_INTEGRITY':
      return { message, remedy: M.remedyIntegrity };
    case 'MODEL_DOWNLOAD_SOURCE':
      return { message, remedy: M.remedySource };
    case 'MODEL_MANIFEST_INCOMPLETE':
      return { message, remedy: M.remedyManifest };
    case 'OFFLINE_STRICT':
      return { message, remedy: M.remedyOffline };
    case 'MODEL_INSTALL_SIZE_CHANGED':
      return { message, remedy: M.remedySizeChanged };
    case 'MODEL_IN_USE':
      return { message, remedy: M.remedyInUse };
    case 'MODEL_UNAVAILABLE':
      return { message, remedy: M.remedyUnavailable };
    case 'MODEL_INSTALL_FAILED':
      return { message, remedy: M.remedyInstallFailed };
    default:
      return { message, remedy: remedyText(details) };
  }
}

/** RPC rejected (`RpcError`; the error code is in `details.code`). */
export function rpcProblem(error: unknown): Problem {
  const message = error instanceof Error ? error.message : String(error);
  const details = (error as { details?: unknown } | null)?.details;
  return modelProblem(str(details, 'code'), message, details);
}

/** A failed task. */
export function jobProblem(job: Pick<JobRecord, 'error'>): Problem | null {
  if (!job.error) return null;
  return modelProblem(job.error.code, jobErrorText(job.error), job.error.details);
}

export function problemText(problem: Problem): string {
  return problem.remedy ? M.problemText(problem.message, problem.remedy) : problem.message;
}

// ---- Install task for each row ----

/** The most recent task of a given kind for this model package (by creation time). */
export function latestBundleJob(jobs: readonly JobRecord[], bundleId: string, kind: 'modelInstall' | 'modelTest'): JobRecord | null {
  let latest: JobRecord | null = null;
  for (const job of jobs) {
    if (job.kind !== kind || job.bundleId !== bundleId) continue;
    if (!latest || job.createdAt > latest.createdAt) latest = job;
  }
  return latest;
}

/** Install: when the most recent install or repair task has failed and nothing is being installed now, the reason for the failure and the remedy (cancelled or interrupted tasks do not count as failures). */
export function installFailure(bundle: ModelBundleStatus, jobs: readonly JobRecord[]): Problem | null {
  if (bundle.install && bundle.install.state !== 'paused') return null;
  const job = latestBundleJob(jobs, bundle.bundleId, 'modelInstall');
  if (!job || job.state !== 'failed') return null;
  return jobProblem(job);
}

// ---- Delete ----

export interface RemovalEstimate {
  /** Bytes that will be freed (counts only components of installed packages that no other installed model package uses); null when components are not known. */
  frees: number | null;
  /** Components still used by other installed model packages, which will be kept. */
  kept: { repo: string; usedBy: string[] }[];
}

/** Estimate before deletion: consistent with the Runtime's rules — components that other installed model packages also use are kept. */
export function removalEstimate(bundle: ModelBundleStatus, bundles: readonly ModelBundleStatus[]): RemovalEstimate {
  if (!bundle.components?.length) return { frees: null, kept: [] };
  const installed = new Set(bundles.filter((b) => b.bundleId !== bundle.bundleId && b.state !== 'not-installed').map((b) => b.bundleId));
  let frees = 0;
  const kept: RemovalEstimate['kept'] = [];
  for (const c of bundle.components) {
    const usedBy = c.sharedWith.filter((id) => installed.has(id));
    if (usedBy.length) kept.push({ repo: c.repo, usedBy });
    else if (c.state === 'installed' && c.bytes !== null) frees += c.bytes;
  }
  return { frees, kept };
}

/** Body of the delete confirmation. */
export function removalBody(estimate: RemovalEstimate): string {
  const frees = estimate.frees !== null && estimate.frees > 0 ? fmtSize(estimate.frees) : null;
  return M.removalBody(estimate.frees === null, frees, estimate.kept);
}

/** Message after deletion: what the Runtime actually deleted and what it kept. */
export function removedToast(bundleId: string, result: { removed: string[]; kept: { repo: string; usedBy: string[] }[] }): string {
  const kept = result.kept.filter((k) => k.usedBy.length > 0);
  return kept.length ? M.removedKept(bundleId, kept.map((k) => k.repo)) : M.removed(bundleId);
}

// ---- What each row can do ----

export interface BundleActions {
  /** Download (its own files are not on disk, and it is not being installed or paused). */
  install: boolean;
  /** Continue download (paused). */
  resume: boolean;
  /** Stop (a task is running). */
  stop: boolean;
  /** Discard the part already downloaded (paused). */
  discard: boolean;
  /** Fill in: its own files are on disk but components are still missing (`missingParts`); only the missing items are downloaded (not being installed, not paused). */
  complete: boolean;
  /** Repair: verifies each file on disk and re-downloads only the corrupt and missing ones. Whether it can be checked: see `checkRoute` in model-check.ts. */
  repair: boolean;
  /** Delete: its own files are on disk and it is not being installed. */
  remove: boolean;
}

/**
 * What a model package row can do (design settings-local.jsx). `ownFiles`: whether the model package's own files are on disk (models-local.ts `hasOwnFiles`; it needs the whole category's
 * shared components to be computed; by default, it counts as not installed). Items on disk with components still missing (`half`) get “fill in” rather than “download”, and can still be repaired and deleted.
 */
export function bundleActions(bundle: ModelBundleStatus, ownFiles = isBundleInstalled(bundle)): BundleActions {
  const installing = !!bundle.install && bundle.install.state !== 'paused';
  const paused = bundle.install?.state === 'paused';
  const cannotRun = bundle.reason === 'unsupported' || bundle.reason === 'worker-missing';
  return {
    install: !ownFiles && !bundle.install && bundle.reason !== 'unsupported',
    complete: !bundle.install && missingParts(bundle, ownFiles).length > 0,
    resume: paused && bundle.reason !== 'unsupported',
    stop: installing,
    discard: paused,
    repair: ownFiles && !installing && !cannotRun,
    remove: ownFiles && !installing,
  };
}
