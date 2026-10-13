import { useEffect } from 'react';
import { create } from 'zustand';
import type { ExternalToolStatus, ExternalToolUpdatePlan, Id, JobRecord } from '@cuccut/protocol';
import { ActionButton, Badge, Button, ProgressBar, Text, ToastQueue } from '@react-spectrum/s2';
import Download from '@react-spectrum/s2/icons/Download';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { DOWNLOADER, rejectionCode, toolCard, toolReady, type ToolCard, type ToolCardState } from '../../model/link-import.ts';
import { hasUpdateSection, updateBefore, updateSummary } from '../../model/tool-update.ts';
import { useRuntime } from '../../runtime/context.tsx';
import type { RuntimeSession } from '../../runtime/session.ts';
import { isJobLive, useJobs } from '../../state/jobs-store.ts';
import { useSettings } from '../../state/settings-store.ts';
import { DownloaderUpdateSection, type DownloaderUpdateRun } from './downloader-update.tsx';
import { ST } from './start-copy.ts';
import { jobErrorText } from '../../model/localized-text.ts';

/**
 * The download tool (yt-dlp) status and card (design draft import-panel.jsx `DownloaderSettings`, import-flow.jsx `downloader`).
 * The home page's link tier and the link import's task detail share one copy. Detection only runs `--version` locally (`externalTools.detect`), a look when entering.
 * Install (with consent), consent, and choosing a location all happen only after the user presses the button; install progress is read from the `toolInstall` task in the `jobs` topic.
 * The copy installed on the system is updated by its original install method (product design §2.7): only when the user presses Run next to the command is a `toolUpdate` task submitted, and its output is read from the task record's `command`.
 */

interface DownloaderState {
  status: ExternalToolStatus | null;
  checking: boolean;
  /** Checked once (success or failure). */
  checked: boolean;
  /** The user just pressed install and the task event has not arrived yet: show “Preparing” first. */
  installing: boolean;
  installJobId: Id | null;
  /** Detection itself failed (e.g. the Runtime is not connected). */
  error: string | null;
  /** Submitting consent / install / location. */
  busy: boolean;
  /** Submitting an update (Run was pressed, the Runtime has not replied yet). */
  updateBusy: boolean;
  /** The update in this card (started by the user pressing Run, or an in-progress one found during detection); null after “Close”. */
  update: DownloaderUpdateRun | null;
}

export const useDownloader = create<DownloaderState>()(() => ({
  status: null,
  checking: false,
  checked: false,
  installing: false,
  installJobId: null,
  error: null,
  busy: false,
  updateBusy: false,
  update: null,
}));

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

let detecting: Promise<void> | null = null;

/** Re-detect (only checks the version locally, no network). Only one runs at a time. */
export function detectDownloader(runtime: Pick<RuntimeSession, 'detectExternalTool'>): Promise<void> {
  if (detecting) return detecting;
  useDownloader.setState({ checking: true });
  detecting = runtime
    .detectExternalTool(DOWNLOADER)
    .then(
      (status) => useDownloader.setState({ status, checked: true, error: null }),
      (error: unknown) => useDownloader.setState({ checked: true, error: messageOf(error) }),
    )
    .finally(() => {
      useDownloader.setState({ checking: false });
      detecting = null;
    });
  return detecting;
}

/** The card's primary button: install when not installed, update when outdated, repair when broken (`consent: true` also records consent); when it is installed and only consent is missing, only consent is recorded. */
async function fixDownloader(runtime: RuntimeSession, state: ToolCardState): Promise<void> {
  useDownloader.setState({ busy: true });
  try {
    if (state === 'consent') {
      const status = await runtime.consentExternalTool(DOWNLOADER, true);
      useDownloader.setState({ status });
    } else {
      useDownloader.setState({ installing: true });
      const { tool, jobId } = await runtime.installExternalTool(DOWNLOADER);
      useDownloader.setState({ status: tool, installJobId: jobId });
    }
  } catch (error) {
    useDownloader.setState({ installing: false });
    ToastQueue.negative(state === 'consent' ? ST.downloader.consentFailed(messageOf(error)) : ST.downloader.installFailed(messageOf(error)), { timeout: 6000 });
  } finally {
    useDownloader.setState({ busy: false });
  }
}

/** Specify the copy you installed yourself (the Runtime first runs `--version` to verify it). This item is greyed out when the host has no open dialog. */
async function pickDownloader(runtime: RuntimeSession): Promise<void> {
  const pick = runtime.host.pickFiles;
  if (!pick) return;
  const [path] = await pick({ title: ST.downloader.pickTitle, buttonLabel: ST.downloader.pickButton, multiple: false });
  if (!path) return;
  useDownloader.setState({ busy: true });
  try {
    const status = await runtime.setExternalToolPath(DOWNLOADER, path);
    useDownloader.setState({ status });
  } catch (error) {
    ToastQueue.negative(ST.downloader.pickFailed(messageOf(error)), { timeout: 6000 });
  } finally {
    useDownloader.setState({ busy: false });
  }
}

/**
 * Pressing Run next to the command hands back the command shown on screen (that is the user's confirmation). When the Runtime says the method has changed (`TOOL_UPDATE_CONFIRM_REQUIRED`)
 * or that it cannot run the command on the user's behalf now (`TOOL_UPDATE_MANUAL`), it does not run; it swaps in the current command so the user can look again.
 */
async function runUpdate(runtime: RuntimeSession, plan: ExternalToolUpdatePlan): Promise<void> {
  const before = useDownloader.getState().status?.version ?? null;
  useDownloader.setState({ updateBusy: true });
  try {
    const { tool, jobId } = await runtime.updateExternalTool(DOWNLOADER, plan.command);
    useDownloader.setState({ status: tool, update: { jobId, before, open: true, settled: false, after: null } });
  } catch (error) {
    const code = rejectionCode(error);
    const details = (error as { details?: { update?: ExternalToolUpdatePlan } } | null)?.details;
    const status = useDownloader.getState().status;
    if ((code === 'TOOL_UPDATE_CONFIRM_REQUIRED' || code === 'TOOL_UPDATE_MANUAL') && details?.update && status) {
      useDownloader.setState({ status: { ...status, update: details.update } });
      ToastQueue.neutral(code === 'TOOL_UPDATE_MANUAL' ? ST.downloader.manualUpdate : ST.downloader.commandChanged, {
        timeout: 6000,
      });
    } else {
      if (code === 'TOOL_UPDATE_UNSUPPORTED') void detectDownloader(runtime);
      ToastQueue.negative(ST.downloader.updateFailed(messageOf(error)), { timeout: 6000 });
    }
  } finally {
    useDownloader.setState({ updateBusy: false });
  }
}

async function stopUpdate(runtime: RuntimeSession, jobId: Id): Promise<void> {
  try {
    await runtime.cancelJob(jobId);
  } catch (error) {
    ToastQueue.negative(ST.downloader.stopFailed(messageOf(error)), { timeout: 5000 });
  }
}

const settling = new Set<Id>();

/**
 * The update task has finished: re-detect to get the new version, then report the result (when the card is mounted in several places, this happens only once). On success the output collapses; on failure or stop it stays visible.
 */
async function settleUpdate(runtime: RuntimeSession, job: JobRecord): Promise<void> {
  const run = useDownloader.getState().update;
  if (!run || run.jobId !== job.jobId || run.settled || settling.has(job.jobId)) return;
  settling.add(job.jobId);
  try {
    await detectDownloader(runtime);
    const after = useDownloader.getState().status?.version ?? null;
    const before = updateBefore(run.before, job);
    useDownloader.setState((s) =>
      s.update?.jobId === job.jobId ? { update: { ...s.update, before, after, settled: true, open: job.state !== 'completed' } } : {},
    );
    const sum = updateSummary({ state: job.state, exitCode: job.command?.exitCode ?? null, error: jobErrorText(job.error) ?? null, before, after });
    const toast = sum.tone === 'positive' ? ToastQueue.positive : sum.tone === 'negative' ? ToastQueue.negative : ToastQueue.neutral;
    toast(sum.title, { timeout: 5000 });
  } finally {
    settling.delete(job.jobId);
  }
}

/** Change the download location (setting `downloads.directory`): later imports download there. */
export async function changeDownloadDir(runtime: RuntimeSession): Promise<void> {
  const dir = await runtime.host.pickDirectory();
  if (!dir) return;
  try {
    const snapshot = await runtime.client.request('settings.set', { values: { 'downloads.directory': dir } });
    useSettings.getState().replace(snapshot);
  } catch (error) {
    ToastQueue.negative(ST.downloader.dirFailed(messageOf(error)), { timeout: 5000 });
  }
}

export interface DownloaderView extends DownloaderState {
  card: ToolCard;
  ready: boolean;
  /** The in-progress install task (when there is one). */
  job: JobRecord | null;
  /** The update task for this card (when there is one; null just after submission, before task events arrive). */
  updateJob: JobRecord | null;
  /** Updating (including the re-detect right after it finishes): downloads cannot start during this time. */
  updating: boolean;
}

/**
 * Reads the download tool's status: detected the first time it is used; re-detected after an install task finishes (on failure, the reason is shown).
 * When `enabled` is false, nothing is detected (the local-file tier does not need it).
 */
export function useDownloaderTool(enabled: boolean): DownloaderView {
  const runtime = useRuntime();
  const state = useDownloader();
  const jobId = state.installJobId ?? state.status?.installJobId ?? null;
  const job = useJobs((s) => (jobId ? (s.jobs.find((j) => j.jobId === jobId) ?? null) : null));
  const ended = !!job && !isJobLive(job);
  const updateJobId = state.update?.jobId ?? state.status?.updateJobId ?? null;
  const updateJob = useJobs((s) => (updateJobId ? (s.jobs.find((j) => j.jobId === updateJobId) ?? null) : null));
  const updateEnded = !!updateJob && !isJobLive(updateJob);

  useEffect(() => {
    if (enabled && !useDownloader.getState().checked) void detectDownloader(runtime);
  }, [enabled, runtime]);

  useEffect(() => {
    if (!ended || !job) return;
    useDownloader.setState({ installing: false, installJobId: null });
    if (job.state === 'failed') ToastQueue.negative(ST.downloader.notInstalled(jobErrorText(job.error) ?? ST.downloader.installFailedFallback), { timeout: 6000 });
    void detectDownloader(runtime);
    // Wrap up only at the moment this install task finishes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended, job?.jobId, runtime]);

  // Detection found an update in progress (started from the CLI or before a restart): attach to it; its output still shows in the card.
  const liveUpdateId = state.status?.updateJobId ?? null;
  useEffect(() => {
    if (liveUpdateId && useDownloader.getState().update?.jobId !== liveUpdateId)
      useDownloader.setState({ update: { jobId: liveUpdateId, before: null, open: true, settled: false, after: null } });
  }, [liveUpdateId]);

  useEffect(() => {
    if (updateEnded && updateJob) void settleUpdate(runtime, updateJob);
    // Wrap up only at the moment this update task finishes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateEnded, updateJob?.jobId, runtime]);

  const installing = state.installing || (!!job && !ended);
  const updating = (!!state.update && !state.update.settled) || !!liveUpdateId;
  return {
    ...state,
    installing,
    job,
    updateJob,
    updating,
    ready: toolReady(state.status) && !updating,
    card: toolCard(state.status, { checking: state.checking, installing, updating }),
  };
}

const card = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  marginTop: 12,
  padding: 16,
  borderRadius: 'lg',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-300',
  backgroundColor: { default: 'gray-25', tone: { setup: 'blue-100', problem: 'orange-100' } },
});
const head = style({ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 });
const headIcon = style({ display: 'flex', flexShrink: 0, color: 'gray-700', '--iconPrimary': { type: 'fill', value: 'currentColor' } });
const headTitle = style({ flexGrow: 1, minWidth: 0, font: 'ui', fontWeight: 'bold', color: 'gray-900' });
const bodyText = style({ margin: 0, font: 'ui-sm', color: 'gray-700' });
const factList = style({ margin: 0, padding: 0, listStyleType: 'none', display: 'flex', flexDirection: 'column', gap: 2 });
const fact = style({ font: 'ui-xs', color: 'gray-600', overflowWrap: 'anywhere' });
const actions = style({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 });

/** Color of the status badge; the text is read at render time from `ST.downloader.badge`. */
const BADGE: Record<ToolCardState, 'positive' | 'informative' | 'notice' | 'negative' | 'neutral'> = {
  checking: 'neutral',
  unknown: 'negative',
  installing: 'informative',
  updating: 'informative',
  install: 'informative',
  update: 'notice',
  broken: 'negative',
  blocked: 'notice',
  consent: 'informative',
  ready: 'positive',
};

/**
 * The download tool card (video download tool · yt-dlp): a one-sentence status, facts such as source and license, the primary button (“Agree and install” / “Agree and update” / “Agree to use”),
 * re-detect, and choose location. While installing, it shows the install task's progress. The copy on the system has an “Update” section at the bottom (command, run and copy, output).
 */
export function DownloaderCard({ view }: { view: DownloaderView }) {
  const runtime = useRuntime();
  const { card: c, busy, job, checking, error } = view;
  const tone =
    c.state === 'ready' || c.state === 'updating' ? undefined : c.state === 'install' || c.state === 'consent' || c.state === 'installing' ? 'setup' : 'problem';
  const progress = job?.progress;
  const pct = progress && progress.total ? Math.max(0, Math.min(100, Math.floor((progress.done / progress.total) * 100))) : null;
  const badge = { variant: BADGE[c.state], label: ST.downloader.badge[c.state] };
  const canPick = !!runtime.host.pickFiles;
  const updating = view.updating;
  return (
    <section className={card({ tone })} aria-label={ST.downloader.card}>
      <div className={head}>
        <span className={headIcon} aria-hidden>
          <Download />
        </span>
        <span className={headTitle}>{c.title}</span>
        <Badge variant={badge.variant} fillStyle="subtle" size="S">
          {badge.label}
        </Badge>
      </div>
      <p className={bodyText}>{error && !view.status ? ST.downloader.checkFailed(error) : c.body}</p>
      {c.facts.length ? (
        <ul className={factList}>
          {c.facts.map((f) => (
            <li key={f} className={fact}>
              {f}
            </li>
          ))}
        </ul>
      ) : null}
      {c.state === 'installing' ? <ProgressBar aria-label={ST.downloader.preparing} size="S" isIndeterminate={pct === null} value={pct ?? undefined} /> : null}
      <div className={actions}>
        {c.action ? (
          <Button variant="accent" size="S" isPending={busy} onPress={() => void fixDownloader(runtime, c.state)}>
            {c.action}
          </Button>
        ) : null}
        {c.state === 'installing' || c.state === 'checking' ? null : (
          <ActionButton size="S" isQuiet isPending={checking} isDisabled={updating} onPress={() => void detectDownloader(runtime)}>
            <Text>{ST.downloader.recheck}</Text>
          </ActionButton>
        )}
        {c.state === 'installing' || c.state === 'checking' || c.state === 'unknown' ? null : (
          <ActionButton size="S" isQuiet isDisabled={!canPick || busy || updating} onPress={() => void pickDownloader(runtime)}>
            <Text>{canPick ? ST.downloader.pick : ST.downloader.pickUnavailable}</Text>
          </ActionButton>
        )}
      </div>
      {view.status && (hasUpdateSection(view.status) || view.update) ? (
        <DownloaderUpdateSection
          plan={view.status.update}
          platform={view.status.platform ?? null}
          run={view.update}
          job={view.updateJob}
          busy={view.updateBusy}
          onRun={(plan) => void runUpdate(runtime, plan)}
          onStop={(jobId) => void stopUpdate(runtime, jobId)}
          onToggle={() => useDownloader.setState((s) => (s.update ? { update: { ...s.update, open: !s.update.open } } : {}))}
          onClose={() => useDownloader.setState({ update: null })}
        />
      ) : null}
    </section>
  );
}
