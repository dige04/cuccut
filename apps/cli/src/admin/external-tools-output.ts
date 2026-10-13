import type {
  ExternalToolOffer,
  ExternalToolStatus,
  ExternalToolUpdateMethod,
  ExternalToolUpdatePlan,
  JobCommandRun,
} from '@cuccut/protocol';
import { live, localizeText, localizeToolStatus } from '@cuccut/protocol';
import { formatBytes } from './models-output.ts';
import { M } from './external-tools-copy.ts';

/**
 * `cuccut external-tools …`: arguments and output (Architecture design §12.9; admin bucket, Agent-surface design §7).
 * Consent to download comes only from the user. `install` first prints the source, version, size and license, and asks once in the terminal. Only `--yes` skips the question. When not in a terminal and `--yes` is not given, it refuses and does not default to consent.
 * `update` likewise first prints the install method and the full command to be run, and runs it only after confirmation. Its output is printed line by line.
 */

export type ToolsCommand =
  | { kind: 'list' }
  | { kind: 'detect'; name?: string }
  | { kind: 'install'; name: string }
  | { kind: 'update'; name: string }
  | { kind: 'path'; name: string; file: string | null }
  | { kind: 'remove'; name: string }
  | { kind: 'consent'; name: string; grant: boolean };

/** `cuccut external-tools <subcommand> …`. The `path` file is resolved against the current directory to an absolute path. */
export function parseToolsArgs(
  args: string[],
  flags: { revoke?: boolean | undefined; clear?: boolean | undefined },
  resolve: (file: string) => string,
): ToolsCommand {
  const [action, name, file, ...extra] = args;
  const need = (value: string | undefined): string => {
    if (!value) throw new Error(M.usage);
    return value;
  };
  if (extra.length > 0) throw new Error(M.usage);
  switch (action) {
    case undefined:
    case 'list':
      if (name !== undefined) throw new Error(M.usage);
      return { kind: 'list' };
    case 'detect':
      if (file !== undefined) throw new Error(M.usage);
      return name ? { kind: 'detect', name } : { kind: 'detect' };
    case 'install':
    case 'update':
    case 'remove':
      if (file !== undefined) throw new Error(M.usage);
      return { kind: action, name: need(name) };
    case 'path':
      if (flags.clear) {
        if (file !== undefined) throw new Error(M.clearOrFile);
        return { kind: 'path', name: need(name), file: null };
      }
      return { kind: 'path', name: need(name), file: resolve(need(file)) };
    case 'consent':
      if (file !== undefined) throw new Error(M.usage);
      return { kind: 'consent', name: need(name), grant: !flags.revoke };
    default:
      throw new Error(M.usage);
  }
}

const STATE_LABELS: Readonly<Record<ExternalToolStatus['state'], string>> = live(() => M.stateLabels);

const SOURCE_LABELS: Readonly<Record<NonNullable<ExternalToolStatus['source']>, string>> = live(() => M.sourceLabels);

/** One tool in a few lines: status, version and source, path; the consent status; the reason it cannot be used, and the remedy. */
export function formatToolStatus(probed: ExternalToolStatus): string[] {
  const tool = localizeToolStatus(probed);
  const source = tool.source ? SOURCE_LABELS[tool.source] : null;
  const lines = [M.statusHead(tool.name, STATE_LABELS[tool.state], tool.version ?? null, source, tool.purpose)];
  if (tool.path) lines.push(M.pathLine(tool.path));
  if (tool.userPath && tool.userPath !== tool.path) lines.push(M.userPathLine(tool.userPath));
  if (tool.managed && tool.managed.path !== tool.path) lines.push(M.managedLine(tool.managed.version, tool.managed.path));
  if (tool.consentRequired) lines.push(M.consentLine(consentLabel(tool)));
  if (tool.installJobId) lines.push(M.installingLine(tool.installJobId));
  if (tool.updateJobId) lines.push(M.updatingLine(tool.updateJobId));
  else if (tool.update) {
    lines.push(M.updateLine(tool.update.command, UPDATE_METHOD_LABELS[tool.update.method], tool.update.runnable));
  }
  if (tool.reason && tool.state !== 'installed') lines.push(M.reasonLine(tool.reason));
  if (tool.remedy) lines.push(M.remedyLine(tool.remedy));
  return lines;
}

function consentLabel(tool: ExternalToolStatus): string {
  if (!tool.consent) return M.consentMissing(tool.name);
  const via = tool.consent.via === 'agent-approval' ? M.consentVia.agent : tool.consent.via === 'cli' ? M.consentVia.cli : M.consentVia.app;
  return tool.consent.state === 'granted' ? M.consentGranted(tool.consent.at, via) : M.consentRevoked(tool.consent.at);
}

export function formatToolList(tools: ExternalToolStatus[]): string[] {
  if (tools.length === 0) return [M.noTools];
  return tools.flatMap(formatToolStatus);
}

const UPDATE_METHOD_LABELS: Readonly<Record<ExternalToolUpdateMethod, string>> = live(() => M.updateMethodLabels);

/** Shown to the user before an update: the install method and the full command to be run. When it cannot be run on their behalf, explains why and leaves it to the user to run in the terminal. */
export function formatToolUpdatePlan(tool: ExternalToolStatus, plan: ExternalToolUpdatePlan): string[] {
  if (!plan.runnable) {
    return [
      M.cannotUpdate(tool.label, localizeText(plan.reason, plan.reasonRef) ?? ''),
      M.runInTerminal,
      `  ${plan.command}`,
      M.redetect(tool.name),
    ];
  }
  return [
    M.updatePlanHead(UPDATE_METHOD_LABELS[plan.method], tool.label, tool.version ?? null),
    M.pathLine(tool.path ?? ''),
    M.runLine(plan.command),
  ];
}

export function updateToolPrompt(label: string): string {
  return M.updatePrompt(label);
}

/**
 * Follows the command's output line by line (the task record's `command`). Returns the complete lines not yet printed. With `final`, the last unfinished line is included as well. Lines cut off from the front
 * that were never printed in time are replaced by a one-line note. `printed` is the number of lines already printed.
 */
export function newCommandLines(run: JobCommandRun, printed: number, final: boolean): { lines: string[]; printed: number } {
  const complete = run.output.split('\n');
  const partial = complete.pop() ?? '';
  const first = run.lines - complete.length;
  const lines = complete.slice(Math.max(printed - first, 0));
  if (first > printed) lines.unshift(M.omittedLines(first - printed));
  if (final && partial) lines.push(partial);
  return { lines, printed: Math.max(printed, run.lines) + (final && partial ? 1 : 0) };
}

/** One sentence after an update finishes: says which version it was updated to, comparing the versions before and after, or that it was already the latest. */
export function updateOutcomeLine(label: string, before: string | null, after: string | null): string {
  if (after && after !== before) return M.updated(label, before, after);
  return M.upToDate(label, after);
}

/** Shown to the user before a download: source, version, size, license. Explains the reason when it cannot download. */
export function formatToolOffer(label: string, offer: ExternalToolOffer): string[] {
  const size = offer.sizeBytes !== null ? formatBytes(offer.sizeBytes) : M.sizeEstimated(formatBytes(offer.estimatedBytes));
  const lines = [
    M.willDownload(label, offer.version),
    M.sourceLine(offer.url ?? null),
    M.sizeLine(size),
    M.licenseLine(offer.license),
    M.homepageLine(offer.homepage),
  ];
  if (offer.sha256) lines.push(M.sha256Line(offer.sha256));
  if (offer.blockedReason) lines.push(M.blockedLine(localizeText(offer.blockedReason, offer.blockedReasonRef)));
  return lines;
}

export function installToolPrompt(label: string, offer: ExternalToolOffer): string {
  const size = offer.sizeBytes !== null ? formatBytes(offer.sizeBytes) : M.sizeAbout(formatBytes(offer.estimatedBytes));
  return M.installPrompt(label, offer.version, size);
}
