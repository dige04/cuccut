import {
  intlLocale,
  live,
  localizeText,
  modelCheckCode,
  modelCheckRepair,
  RpcError,
  type JobRecord,
  type ModelBundleStatus,
  type ModelInstallPlan,
  type ModelRemoveResult,
  type ModelsDirInfo,
  type ModelsDirInspection,
  type ModelsDirMode,
  type Money,
  type ProviderAccountStatus,
  type ProviderAccountView,
  type UsagePeriod,
  type UsageReport,
  type UsageRow,
  type UsageUnits,
} from '@cuccut/protocol';
import { remedyText } from '../localized-text.ts';
import { M } from './models-copy.ts';

/**
 * Output and arguments of the `cuccut models` admin commands (repair / cancel / remove / dir / accounts / usage) (Architecture design §6.3). Listing, installing and
 * checking are derived commands (`models list|install|test`). When the size is unknown, no percentage is shown.
 */

/** Byte counts for people to read: B, KB, MB, GB, with one decimal place. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

/** Received / total. When the total is unknown, only the bytes received are shown, with no percentage. */
export function formatByteProgress(done: number, total: number | null): string {
  if (total === null || total <= 0) return M.byteProgressUnknown(formatBytes(done));
  const percent = Math.min(100, Math.floor((done / total) * 100));
  return M.byteProgress(formatBytes(done), formatBytes(total), percent);
}

/** Install or repair (`models install` / `models repair`). */
export type InstallVerb = 'install' | 'repair';

/** A few lines for one model package: status, components, install progress and the most recent check. */
export function formatBundleLines(bundle: ModelBundleStatus): string[] {
  const state = M.bundleState(M.bundleStates[bundle.state], bundle.state, bundle.reason);
  const lines = [
    `${bundle.bundleId}  ${state}  ${bundle.capability} ${bundle.backend}/${bundle.device}${bundle.detail ? ` — ${localizeText(bundle.detail, bundle.detailRef)}` : ''}`,
  ];
  for (const c of bundle.components ?? []) {
    const size = c.bytes !== null ? `  ${formatBytes(c.bytes)}` : '';
    const shared = c.sharedWith.length > 0 ? M.sharedWith(c.sharedWith) : '';
    const installed = c.state === 'installed' ? M.componentInstalled : M.componentMissing;
    lines.push(`  ${c.component}  ${c.repo}@${c.revision.slice(0, 7)}  ${installed}${size}${shared}`);
  }
  if (bundle.install) {
    const job = bundle.install.jobId ? M.installTask(bundle.install.jobId) : '';
    const hint = bundle.install.state === 'paused' ? M.resumeHint(bundle.bundleId) : '';
    const progress = formatByteProgress(bundle.install.receivedBytes, bundle.install.totalBytes);
    lines.push(M.installLine(M.installStates[bundle.install.state], progress, job, hint));
  }
  if (bundle.selfTest) {
    const { state, at, detail, detailRef, code } = bundle.selfTest;
    const result = state === 'passed' ? M.checkPassed : M.checkFailed(code);
    lines.push(M.checkLine(result, at, localizeText(detail, detailRef)));
    if (state === 'failed') lines.push(...checkRemedyLines(bundle.bundleId, code));
  }
  return lines;
}

function checkRemedyLines(bundleId: string, code: string | undefined | null): string[] {
  if (code === 'APP_FILE_MISSING') return [M.remedyAppFileMissing];
  const repair = modelCheckRepair(code);
  if (repair === 'yes') return [M.remedyRepair(bundleId)];
  if (repair === 'maybe') return [M.remedyMaybeRepair(bundleId)];
  if (modelCheckCode(code) === 'MODEL_OUT_OF_MEMORY') return [M.remedyOutOfMemory];
  return [];
}

/** The plan for an install or repair: what is downloaded, how large, from where, and whether the disk has enough room. */
export function formatInstallPlan(plan: ModelInstallPlan, verb: InstallVerb): string[] {
  const repair = verb === 'repair';
  if (plan.upToDate) return [M.upToDate(repair, plan.bundleId)];
  const lines = [M.planHeader(repair, plan.bundleId, plan.source)];
  for (const c of plan.components) {
    if (c.action === 'keep') lines.push(M.planKeep(c.component, c.repo));
    else {
      const size = c.bytes === null ? M.sizeUnknown : formatBytes(c.bytes);
      lines.push(M.planDownload(c.component, c.repo, c.files.length, size));
    }
  }
  lines.push(
    plan.downloadBytes === null ? M.toDownloadEstimate(formatBytes(plan.estimatedBytes)) : M.toDownload(formatBytes(plan.downloadBytes)),
  );
  if (plan.resumedBytes > 0) lines.push(M.resumed(formatBytes(plan.resumedBytes)));
  if (plan.availableBytes !== null) lines.push(M.freeSpace(formatBytes(plan.availableBytes), plan.availableBytes < plan.confirmBytes));
  return lines;
}

/** A confirmation prompt. */
export function installPrompt(plan: ModelInstallPlan, verb: InstallVerb): string {
  const size = plan.downloadBytes === null ? M.sizeAbout(formatBytes(plan.estimatedBytes)) : formatBytes(plan.downloadBytes);
  return M.installPrompt(verb === 'repair', size);
}

/** The install or repair task failed: a remedy note. For insufficient disk space with byte counts, first say how much this time needs and how much is left. */
export function installFailureLines(error: JobRecord['error']): string[] {
  const details = (error?.details ?? {}) as { remedy?: unknown; requiredBytes?: unknown; availableBytes?: unknown };
  const lines: string[] = [];
  const { requiredBytes: need, availableBytes: have } = details;
  if (error?.code === 'MODEL_DOWNLOAD_NO_SPACE' && typeof need === 'number' && typeof have === 'number') {
    lines.push(M.noSpace(formatBytes(need), formatBytes(have)));
  }
  const remedy = remedyText(details);
  if (remedy !== null) lines.push(M.remedy(remedy));
  return lines;
}

/**
 * `cuccut models remove <id>`: IDs starting with `custom:`, and the online providers in the directory (`onlineProviders`, taken from the capability view), are providers
 * (§6.8: removing a directory provider deactivates it and deletes all its accounts and credentials). The rest are local model packages.
 */
export function removeTarget(id: string, onlineProviders: readonly string[] = []): 'provider' | 'bundle' {
  return id.startsWith('custom:') || onlineProviders.includes(id) ? 'provider' : 'bundle';
}

export function formatRemoveResult(result: ModelRemoveResult): string[] {
  const lines = [result.removed.length > 0 ? M.removed(result.removed) : M.nothingRemoved];
  for (const kept of result.kept) {
    lines.push(kept.usedBy.length > 0 ? M.keptInUse(kept.repo, kept.usedBy) : M.keptOtherVersion(kept.repo));
  }
  lines.push(...formatBundleLines(result.bundle));
  return lines;
}

/** `cuccut models dir`: the current model directory, its source, and its usage. */
export function formatModelsDir(info: ModelsDirInfo): string[] {
  const lines = [info.path, M.dirSource(M.dirSources[info.source])];
  if (!info.exists) lines.push(M.dirMissing);
  else if (!info.writable) lines.push(M.dirNotWritable);
  const free = info.freeBytes === null ? null : formatBytes(info.freeBytes);
  lines.push(M.dirUsage(formatBytes(info.usedBytes), free, info.modelCount));
  if (info.source !== 'default') lines.push(M.dirDefault(info.defaultPath));
  if (info.moveJobId) lines.push(M.dirMoving(info.moveTo, info.moveJobId));
  return lines;
}

/**
 * First step of changing the model directory: check the source of the current directory. If an environment variable sets it, fail at once with `MODELS_DIR_ENV_LOCKED` (the same refusal as `models.setDir`),
 * without looking at the new location or printing an explanation. Otherwise, only read the new location (`null` is the default directory).
 */
export async function inspectDirChange(
  api: { getDir: () => Promise<ModelsDirInfo>; inspectDir: (path: string | null) => Promise<ModelsDirInspection> },
  target: string | null,
): Promise<ModelsDirInspection> {
  const current = await api.getDir();
  if (current.source === 'env') {
    throw new RpcError('conflict', M.dirEnvLocked, {
      code: 'MODELS_DIR_ENV_LOCKED',
      path: current.path,
    });
  }
  return api.inspectDir(target);
}

/** The problem with the chosen folder, or null when there is no problem. */
export function dirProblem(inspection: ModelsDirInspection): string | null {
  switch (inspection.problem) {
    case 'missing':
      return M.dirProblemMissing;
    case 'not-writable':
      return M.dirProblemNotWritable;
    case 'nested':
      return M.dirProblemNested;
    case 'same':
      return M.dirProblemSame;
    default:
      return null;
  }
}

/** Explanation before the change: models already in the new location, available space, and how much writing the move requires. */
export function formatDirInspection(inspection: ModelsDirInspection): string[] {
  const found = inspection.found.bundleIds.length;
  const lines = [
    found > 0 ? M.dirFound(found, formatBytes(inspection.found.bytes)) : M.dirEmpty,
  ];
  if (inspection.freeBytes !== null) lines.push(M.dirFree(formatBytes(inspection.freeBytes)));
  if (inspection.current.bytes > 0) {
    const move = inspection.move.sameVolume
      ? M.moveSameVolume
      : M.moveSize(formatBytes(inspection.move.requiredBytes), inspection.move.fits);
    lines.push(M.dirCurrentHas(formatBytes(inspection.current.bytes), move));
  }
  return lines;
}

/**
 * Which one to use when neither `--move` nor `--switch` is given: when there are no models in the current directory, only switch. When there are, the user chooses (returns null). Both given is an error.
 */
export function dirMode(flags: { move?: boolean; switch?: boolean }, inspection: ModelsDirInspection): ModelsDirMode | null {
  if (flags.move && flags.switch) throw new Error(M.moveOrSwitch);
  if (flags.move) return 'move';
  if (flags.switch) return 'switch';
  return inspection.current.bytes > 0 ? null : 'switch';
}

// ---- Provider accounts and usage (Architecture design §6.8, §6.10): `models accounts`, `models usage` ----

/** Account status for people to read. When rate-limited, includes the recovery time (local time). */
export function accountStateLabel(status: ProviderAccountStatus): string {
  const label = (M.accountStates as Record<string, string>)[status.state] ?? status.state;
  if (status.state === 'rate-limited' && status.until) {
    return M.rateLimitedUntil(label, new Date(status.until).toLocaleString(intlLocale()));
  }
  return label;
}

/**
 * A provider's accounts, one per line, in order. Calls use the first account that is enabled and has a key; on error they do not move on to the next. Only masks are shown, never the key.
 * `current` marks the one that will be used right now.
 */
export function formatAccountLines(accounts: readonly ProviderAccountView[], indent = '    '): string[] {
  if (accounts.length === 0) return [`${indent}${M.noAccounts}`];
  const current = accounts.find((a) => a.enabled && a.credential === 'set')?.accountId;
  return accounts.map((account, index) => {
    const parts = [`${index + 1}. ${account.accountId}`, account.label ?? account.masked];
    if (account.label) parts.push(account.masked);
    parts.push(account.enabled ? M.accountEnabled : M.accountDisabled);
    if (account.credential === 'missing') parts.push(M.accountKeyUnreadable);
    parts.push(accountStateLabel(account.status));
    if (account.region) parts.push(M.accountRegion(account.region));
    if (account.endpoint) parts.push(M.accountEndpoint(account.endpoint));
    if (account.lastUsedAt) parts.push(M.accountLastUsed(account.lastUsedAt));
    if (account.accountId === current) parts.push(M.accountCurrent);
    return `${indent}${parts.join('  ')}`;
  });
}

/** `accounts use <account>`: moves this account to the front and keeps the others in their original order. Accepts an accountId, or a name that is unique. */
export function accountOrderWithFirst(accounts: readonly ProviderAccountView[], ref: string): string[] {
  const account = findAccount(accounts, ref);
  return [account.accountId, ...accounts.filter((a) => a.accountId !== account.accountId).map((a) => a.accountId)];
}

/** Finds an account by accountId or by a unique name. Errors when it is not found or the name is duplicated (lists the options). */
export function findAccount(accounts: readonly ProviderAccountView[], ref: string): ProviderAccountView {
  const byId = accounts.find((a) => a.accountId === ref);
  if (byId) return byId;
  const byLabel = accounts.filter((a) => a.label === ref);
  if (byLabel.length === 1) return byLabel[0]!;
  const choices = accounts.map((a) => (a.label ? M.accountChoice(a.accountId, a.label) : a.accountId)).join(M.listSep) || M.noAccountChoices;
  if (byLabel.length > 1) throw new Error(M.accountAmbiguous(byLabel.length, ref, choices));
  throw new Error(M.accountNotFound(ref, choices));
}

export const USAGE_PERIOD_LABELS: Record<UsagePeriod, string> = live(() => M.usagePeriods);

/** Amounts: one item per currency, not converted. null when empty. */
export function formatMoney(list: readonly Money[]): string | null {
  if (list.length === 0) return null;
  return list.map((m) => (m.currency === 'USD' ? `$${m.amount}` : `${m.amount} ${m.currency}`)).join(' + ');
}

/** Usage for people to read: lists only the items that exist. */
export function formatUnits(units: UsageUnits): string {
  const count = (n: number) => n.toLocaleString(intlLocale());
  const parts: string[] = [];
  if (units.inputTokens !== undefined || units.outputTokens !== undefined) {
    parts.push(M.unitTokens(count(units.inputTokens ?? 0), count(units.outputTokens ?? 0)));
    if (units.cachedTokens) parts.push(M.unitCached(count(units.cachedTokens)));
  }
  if (units.audioSeconds !== undefined) parts.push(M.unitAudio((units.audioSeconds / 60).toFixed(1)));
  if (units.chars !== undefined) parts.push(M.unitChars(count(units.chars)));
  if (units.images !== undefined) parts.push(M.unitImages(units.images));
  return parts.join(M.clauseSep);
}

function formatRow(row: UsageRow, total: number): string {
  const share = total > 0 ? `${Math.round((row.calls / total) * 100)}%` : '—';
  const money = formatMoney(row.cost);
  const cost = money ? M.costApprox(money, M.costKinds[row.costKind]) : M.costKinds[row.costKind];
  const units = formatUnits(row.units);
  return `  ${row.label}  ${M.rowCalls(row.calls, row.failed)}  ${share}${units ? `  ${units}` : ''}  ${cost}`;
}

/**
 * Output of `cuccut models usage` (§6.10): the three kinds of amount are written separately and never merged into one number. Estimates are marked “≈”, reported amounts are written as reported, and where the cost is unknown only the count is reported.
 * Different currencies are listed separately. Then comes the breakdown by provider, capability, model and account. When there are no calls, a one-sentence note.
 */
export function formatUsageReport(report: UsageReport, period: UsagePeriod, providerId?: string): string[] {
  const lines = [M.usageHeader(providerId, M.usagePeriods[period], report.period.from, report.period.to)];
  const { totals } = report;
  if (totals.calls === 0) {
    lines.push(M.noCalls);
    return lines;
  }
  lines.push(M.totalCalls(totals.calls, totals.failed));
  const units = formatUnits(totals.units);
  if (units) lines.push(M.usageUnits(units));
  const estimated = formatMoney(totals.cost.estimated);
  const reported = formatMoney(totals.cost.reported);
  if (estimated) lines.push(M.spentEstimated(estimated));
  if (reported) lines.push(M.spentReported(reported));
  if (totals.cost.unknownCalls > 0) lines.push(M.unknownCostCalls(totals.cost.unknownCalls));
  if (!estimated && !reported && totals.cost.unknownCalls === 0) lines.push(M.noBilledCalls);
  const sections: Array<[string, UsageRow[]]> = [
    [M.byProvider, report.byProvider],
    [M.byCapability, report.byCapability],
    [M.byModel, report.byModel],
    [M.byAccount, report.byAccount],
  ];
  for (const [title, rows] of sections) {
    if (rows.length === 0) continue;
    lines.push(title);
    for (const row of rows) lines.push(formatRow(row, totals.calls));
  }
  return lines;
}
