import {
  defineMessages,
  localizeText,
  type ExternalToolStatus,
  type ExternalToolUpdateMethod,
  type ExternalToolUpdatePlan,
  type JobCommandRun,
  type JobRecord,
} from '@cuccut/protocol';
import { zhHans } from './tool-update.zh-Hans.ts';
import { zhHant } from './tool-update.zh-Hant.ts';
import { ja } from './tool-update.ja.ts';
import { ko } from './tool-update.ko.ts';
import { es } from './tool-update.es.ts';
import { fr } from './tool-update.fr.ts';
import { de } from './tool-update.de.ts';
import { nl } from './tool-update.nl.ts';
import { ptBR } from './tool-update.pt-BR.ts';
import { it } from './tool-update.it.ts';
import { ru } from './tool-update.ru.ts';
import { pl } from './tool-update.pl.ts';
import { tr } from './tool-update.tr.ts';
import { vi } from './tool-update.vi.ts';

/** Copy for updating a downloaded tool (translations in `tool-update.<语言>.ts`). "Re-detect" is the name of the button on the card. */
const en = {
  standalone: 'Official standalone binary',
  updateInTerminal: 'Update in Terminal',
  unknownInstall: 'Can’t tell how this yt-dlp was installed. Run the command that matches how you installed it, then click “Check again”.',
  cannotRun: 'CucCut can’t run this command for you.',
  thenRecheck: 'Then click “Check again”.',
  runThenRecheck: 'Run this command in Terminal, then click “Check again”.',
  updateWith: (method: string) => `Update with ${method}`,
  stoppedTitle: 'Update stopped',
  stoppedBody: 'The command may have only partly run. Check the output below, then click “Check again” to confirm the current yt-dlp version.',
  failedTitle: (exitCode: string | null) => (exitCode === null ? 'Update didn’t finish' : `Update didn’t finish (exit code ${exitCode})`),
  failedBody: (error: string | null) =>
    `${error ? `${error.replace(/[。.]$/, '')}. ` : ''}Your existing yt-dlp is unaffected. The output is below; you can also copy the command, run it in Terminal, then click “Check again”.`,
  updatedTo: (version: string) => `Updated to ${version}`,
  upToDate: (version: string | null) => (version ? `Already up to date (${version})` : 'Already up to date'),
  logTruncated: '… (earlier output omitted; the full output is in the task record)\n',
  logStopped: '(Stopped)',
  logExitCode: (exitCode: string) => `(Exit code ${exitCode})`,
};
export type ToolUpdateMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * Update a downloaded tool using its original install method (product design §2.7 "Download video", architecture design §12.9; design mock model-tool-update.js).
 *
 * The card shows the exact command to run (a one-line code block, with run and copy on the right); clicking run is the confirmation, and that single command is what gets handed back.
 * When the install method can't be determined, or admin rights are needed, the command is not run on your behalf; only shown. When it can't be determined, the common commands listed follow the platform of the host running the Runtime
 * (the `platform` in the state), not the platform this UI runs on. After it finishes, the result is reported from the versions before and after.
 */

export const UPDATE_METHOD_LABEL: Record<ExternalToolUpdateMethod, string> = {
  homebrew: 'Homebrew',
  pipx: 'pipx',
  pip: 'pip',
  get standalone() {
    return M.standalone;
  },
  winget: 'winget',
  scoop: 'Scoop',
  chocolatey: 'Chocolatey',
};

type ManualCommand = { label: string; command: string };

const MANUAL_POSIX: readonly ManualCommand[] = [
  { label: 'Homebrew', command: 'brew upgrade yt-dlp' },
  { label: 'pip', command: 'python3 -m pip install -U "yt-dlp[default]"' },
  {
    get label() {
      return M.standalone;
    },
    command: 'yt-dlp -U',
  },
];

const MANUAL_WINDOWS: readonly ManualCommand[] = [
  { label: 'winget', command: 'winget upgrade yt-dlp.yt-dlp' },
  { label: 'Scoop', command: 'scoop update yt-dlp' },
  { label: 'pip', command: 'py -m pip install -U "yt-dlp[default]"' },
  {
    get label() {
      return M.standalone;
    },
    command: 'yt-dlp -U',
  },
];

/** Common approaches listed when the install method can't be determined, by Runtime host: on Windows, winget, Scoop, `py -m pip` and `-U`; on other systems, Homebrew, pip and `-U`. */
export function manualUpdateCommands(platform: string | null | undefined): readonly ManualCommand[] {
  return platform === 'win32' ? MANUAL_WINDOWS : MANUAL_POSIX;
}

/**
 * Exit code for display: negative numbers, or ones above 0xFFFF (like Windows HRESULTs), are written as 8-digit hex. When winget has no version to upgrade to, it exits with
 * 0x8A15002B; the Runtime counts that as success (already up to date), and the last line of the output box still shows that exit code.
 */
export function exitCodeText(code: number): string {
  return code < 0 || code > 0xffff ? `0x${(code >>> 0).toString(16).toUpperCase().padStart(8, '0')}` : String(code);
}

/**
 * Whether the card has an "Update" section: found the copy in the system (or the one you specified, or the one given by an environment variable). The copy CucCut downloaded swaps versions with the card's primary button; a copy not installed, or one being installed, has nothing to update. It is always there while updating (the output is shown in this section).
 */
export function hasUpdateSection(status: ExternalToolStatus | null | undefined): boolean {
  if (!status) return false;
  if (status.updateJobId) return true;
  return !!status.path && status.source !== 'managed' && !status.installJobId && (!!status.update || !!status.version);
}

/** The Runtime's reason already lists the few cases that say "run this command in a terminal opened as administrator" (rcExternalTools catalog). */
const SAYS_HOW_TO_RUN = new Set(
  ['wingetMachineWide', 'scoopGlobal', 'chocolateyAdmin', 'pipAdminWin', 'standaloneAdminWin'].map((name) => `rcExternalTools.${name}`),
);

/** The "Update" section: the label above the command, and the note below the command when it can't be run on your behalf. */
export function updateSectionCopy(plan: ExternalToolUpdatePlan | null): { label: string; hint: string | null } {
  if (!plan) return { label: M.updateInTerminal, hint: M.unknownInstall };
  if (!plan.runnable) {
    const reason = localizeText(plan.reason, plan.reasonRef) ?? M.cannotRun;
    // When the Runtime's reason already says how to run it in a terminal (the few Windows cases needing admin rights), don't repeat it.
    const how = plan.reasonRef && SAYS_HOW_TO_RUN.has(plan.reasonRef.key) ? M.thenRecheck : M.runThenRecheck;
    return { label: M.updateInTerminal, hint: `${reason}${how}` };
  }
  return { label: M.updateWith(UPDATE_METHOD_LABEL[plan.method] ?? plan.method), hint: null };
}

/** Facts after an update finishes: the task's final state, the command's exit code and error, and the versions probed before and after. */
export interface UpdateOutcome {
  state: JobRecord['state'];
  exitCode: number | null;
  /** The task's error (useful for failures with no exit code, such as failing to start or timing out). */
  error: string | null;
  before: string | null;
  after: string | null;
}

export interface UpdateSummary {
  tone: 'positive' | 'neutral' | 'notice' | 'negative';
  title: string;
  body: string | null;
}

/**
 * The one-line result after finishing: if it was stopped, don't guess the outcome; tell the user to check the output and re-detect. On failure, give the exit code (or the task's error if there is no exit code);
 * on success, say which version it was updated to, based on the re-detected version, or that it is already up to date.
 */
export function updateSummary(o: UpdateOutcome): UpdateSummary {
  if (o.state === 'cancelled') return { tone: 'notice', title: M.stoppedTitle, body: M.stoppedBody };
  if (o.state !== 'completed') {
    return {
      tone: 'negative',
      title: M.failedTitle(o.exitCode === null ? null : exitCodeText(o.exitCode)),
      body: M.failedBody(o.exitCode === null && o.error ? o.error : null),
    };
  }
  if (o.after && o.after !== o.before) return { tone: 'positive', title: M.updatedTo(o.after), body: null };
  const version = o.after ?? o.before;
  return { tone: 'neutral', title: M.upToDate(version), body: null };
}

/** Text in the output box: the command's output (with a note first if the start was cut off), then a line with the exit code or "Stopped" once finished. */
export function updateLog(command: JobCommandRun | null | undefined, state: JobRecord['state'] | null, live: boolean): string {
  const output = (command?.output ?? '').replace(/\n+$/, '');
  const head = command?.truncated ? M.logTruncated : '';
  const tail = live || !state ? '' : state === 'cancelled' ? M.logStopped : command?.exitCode !== null && command?.exitCode !== undefined ? M.logExitCode(exitCodeText(command.exitCode)) : '';
  const text = `${head}${output}${output && tail ? '\n' : ''}${tail}`;
  return text || '…';
}

/** The version before the update: recorded when the user clicked run; for updates started elsewhere (CLI, before a restart) it comes from the task record (the Runtime stores it in `modelId`). */
export function updateBefore(recorded: string | null | undefined, job: Pick<JobRecord, 'modelId'> | null | undefined): string | null {
  if (recorded) return recorded;
  const fromJob = job?.modelId;
  return fromJob && fromJob !== 'unknown' ? fromJob : null;
}
