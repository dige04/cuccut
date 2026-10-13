import { useEffect, useState, type ReactNode } from 'react';
import { live, type JobRecord } from '@cuccut/protocol';
import { ActionButton, Badge, Button, ProgressBar, Text, ToastQueue } from '@react-spectrum/s2';
import AlertTriangle from '@react-spectrum/s2/icons/AlertTriangle';
import Checkmark from '@react-spectrum/s2/icons/Checkmark';
import InfoCircle from '@react-spectrum/s2/icons/InfoCircle';
import Link from '@react-spectrum/s2/icons/Link';
import Play from '@react-spectrum/s2/icons/Play';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { formatClock, shortenPath } from '../../model/format.ts';
import { usedCookieText } from '../../model/link-cookies.ts';
import {
  downloadProgress,
  linkFrozen,
  linkHeading,
  linkIssue,
  linkMeta,
  linkPhaseText,
  linkStages,
  linkSummary,
  TOOL_SOURCE_LABEL,
  type LinkAction,
  type LinkIssue,
  type StageState,
} from '../../model/link-import.ts';
import { taskFacts } from '../../model/task-facts.ts';
import { starterOf } from '../../model/home-starters.ts';
import type { TaskRow } from '../../model/task-list.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { isJobLive, useJobs } from '../../state/jobs-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { changeDownloadDir, DownloaderCard, useDownloaderTool } from '../start/downloader-card.tsx';
import { adoptDownload, bindFlowRunner, flowToast, followOf, useFlowRuns, type FlowRun } from '../start/flow-runner.ts';
import { openHome } from '../start/open-home.ts';
import { useVideoTools } from '../tools/use-video-tools.ts';
import { useNow } from '../use-now.ts';
import { UtilityShell } from '../utility-sidebar.tsx';
import { TaskFacts } from './task-sections.tsx';
import { TK } from './tasks-copy.ts';

/*
 * Task detail for a link import (design draft import-panel.jsx `ImportTask`, import-flow.css): large title with one sentence of explanation, three steps (download the video · confirm the media and create the video · generate subtitles), the media card, current status and progress, the failure message and remedies (the download-tool card is handled in place), the action row, and the download location and tools.
 * The last two steps are partly driven by the flow executor (flow-runner.ts): it only knows about them during this run. After an app restart, the option “用下载的文件新建视频” (create video from the downloaded file) is offered instead.
 *
 * Differences from the design draft: there is no “删除记录” (delete record), because the Runtime has no interface for deleting tasks; there is no full takeover for the blocked Homebrew state and no install options (the Runtime has only one kind of install: a separate copy that CucCut manages itself); download speed is not shown (subtasks only report byte counts).
 */

const steps = style({ display: 'flex', gap: 16, listStyleType: 'none', margin: 0, padding: 0 });
const stepItem = style({
  flexGrow: 1,
  flexBasis: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  font: 'ui-sm',
  fontWeight: { default: 'normal', state: { current: 'bold', failed: 'bold' } },
  color: { default: 'gray-600', state: { current: 'blue-1000', done: 'green-1000', failed: 'red-1000' } },
});
const stepDot = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  size: 24,
  borderRadius: 'full',
  font: 'ui-xs',
  backgroundColor: { default: 'gray-200', state: { current: 'blue-200', done: 'green-200', failed: 'red-200' } },
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});
const main = style({ borderRadius: '[16px]', borderWidth: 1, borderStyle: 'solid', borderColor: 'gray-200', backgroundColor: 'layer-1', overflow: 'hidden' });
const media = style({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 16,
  padding: 24,
  borderBottomWidth: 1,
  borderTopWidth: 0,
  borderXWidth: 0,
  borderStyle: 'solid',
  borderColor: 'gray-200',
});
const mediaIcon = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  size: 64,
  borderRadius: '[16px]',
  color: 'blue-1000',
  backgroundColor: 'blue-100',
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});
const mediaText = style({ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1, minWidth: 0 });
const mediaTitle = style({ font: 'title-sm', color: 'gray-900', overflowWrap: 'anywhere' });
const mediaMeta = style({ font: 'ui-sm', color: 'gray-700' });
const mediaUrl = style({ font: 'ui-xs', color: 'gray-600', truncate: true });
const status = style({ display: 'flex', flexDirection: 'column', gap: 12, padding: 24 });
const statusHead = style({ display: 'flex', alignItems: 'center', gap: 8, '--iconPrimary': { type: 'fill', value: 'currentColor' } });
const statusTitle = style({ flexGrow: 1, minWidth: 0, font: 'ui', fontWeight: 'bold', color: 'gray-900' });
const statusPct = style({ font: 'code-sm', fontWeight: 'bold', color: 'gray-900' });
const statusBody = style({ margin: 0, font: 'ui-sm', color: 'gray-700' });
const recovery = style({
  marginX: 24,
  marginBottom: 24,
  padding: 20,
  borderRadius: '[16px]',
  backgroundColor: { default: 'red-100', isSetup: 'blue-100' },
  color: { default: 'red-1000', isSetup: 'blue-1000' },
});
const recoveryTitle = style({ font: 'title-sm', color: 'inherit', margin: 0 });
const recoveryBody = style({ font: 'ui-sm', color: 'inherit', marginTop: 8, marginBottom: 16 });
const diagBox = style({
  padding: 12,
  marginBottom: 8,
  borderRadius: 'default',
  backgroundColor: 'gray-25',
  font: 'code-xs',
  color: 'gray-800',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  userSelect: 'text',
});
const row = style({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 });
const copied = style({ font: 'ui-xs', color: 'gray-700' });
const actions = style({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 8,
  paddingY: 16,
  paddingX: 24,
  borderTopWidth: 1,
  borderBottomWidth: 0,
  borderXWidth: 0,
  borderStyle: 'solid',
  borderColor: 'gray-200',
});
const spacer = style({ flexGrow: 1 });
const actionsNote = style({ font: 'ui-xs', color: 'gray-600' });
const details = style({ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 4 });
const detailLine = style({ margin: 0, font: 'ui-xs', color: 'gray-700', overflowWrap: 'anywhere' });
const toolSlot = style({ marginBottom: 16 });

const STAGE_LABEL = live((): Record<StageState, string> => TK.link.stage);

const ACTION_LABEL = live((): Record<LinkAction, string> => TK.link.action);

/** To change the link and import again: go to “工具 › 从链接导入” (Tools › Import from link), where the link is already filled in (the start page no longer has a link entry point). */
function openLinkTool(url: string): void {
  const tools = useVideoTools.getState();
  tools.patch('link-import', { url });
  tools.setView('link-import', null);
  useShell.getState().go({ tab: 'tools', tool: 'link-import' });
}

/** The failure message and the remedy button; when `tools` is the primary remedy, the download-tool card is shown directly (retry after it is installed or agreed to). */
function Recovery({ job, issue, run }: { job: JobRecord; issue: LinkIssue; run: FlowRun | null }) {
  const runtime = useRuntime();
  const toolsFirst = issue.actions[0] === 'tools';
  const [toolsOpen, setToolsOpen] = useState(false);
  const showTools = toolsFirst || toolsOpen;
  const downloader = useDownloaderTool(issue.actions.includes('tools'));
  const [retrying, setRetrying] = useState(false);
  const frozen = linkFrozen(job);
  const projectId = typeof job.pipeline?.params.projectId === 'string' ? job.pipeline.params.projectId : null;
  const flow = run?.flow ?? (frozen.audioOnly ? 'a2v' : 'sub');
  const url = frozen.url.startsWith('http') ? frozen.url : '';

  // When the download tool is the primary remedy, the retry must still follow after installing it; if the list has no retry, add one.
  const buttons: LinkAction[] = toolsFirst
    ? [...issue.actions.filter((a) => a !== 'tools'), ...(issue.actions.includes('retry') ? [] : ['retry' as const])]
    : issue.actions;
  const retry = () => {
    setRetrying(true);
    runtime
      .retryPipeline(job.jobId)
      .catch((e: Error) => ToastQueue.negative(TK.link.retryFailed(e.message), { timeout: 6000 }))
      .finally(() => setRetrying(false));
  };
  const act = (action: LinkAction) => {
    if (action === 'retry') retry();
    else if (action === 'change-link' || action === 'restart') openLinkTool(url);
    // To use a local file instead: go to this project's start page; when the input box is empty, fill in the matching quick start (add subtitles; for audio-only it is audio-to-video). Add the file with “+” or drag and drop.
    else if (action === 'use-file') openHome(projectId, { prompt: starterOf(flow === 'a2v' ? 'a2v' : 'sub').prompt });
    else if (action === 'tools') setToolsOpen((v) => !v);
    else void changeDownloadDir(runtime);
  };
  const label = (action: LinkAction) =>
    action === 'retry'
      ? issue.code === 'LINK_DOWNLOAD_UNREADABLE'
        ? TK.link.redownload
        : issue.code === 'INTERRUPTED'
          ? TK.link.finish
          : toolsFirst
            ? TK.link.retryImport
            : ACTION_LABEL.retry
      : action === 'tools' && toolsOpen
        ? TK.link.hideTools
        : ACTION_LABEL[action];

  return (
    <div className={recovery({ isSetup: toolsFirst })} role="alert">
      <h3 className={recoveryTitle}>{issue.title}</h3>
      <p className={recoveryBody}>{issue.body}</p>
      {issue.diag ? <Diagnostic text={issue.diag} /> : null}
      {showTools ? (
        <div className={toolSlot}>
          <DownloaderCard view={downloader} />
        </div>
      ) : null}
      <div className={row}>
        {/* One yellow: the first remedy, unless the downloader card is showing and still needs its own fix. */}
        {buttons.map((action, i) => (
          <Button
            key={action}
            variant={i === 0 && !(showTools && !downloader.ready) ? 'accent' : 'secondary'}
            size="M"
            isPending={action === 'retry' && retrying}
            isDisabled={(action === 'retry' && toolsFirst && !downloader.ready) || downloader.installing}
            aria-expanded={action === 'tools' ? toolsOpen : undefined}
            onPress={() => act(action)}>
            {label(action)}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** The download tool's original wording: can be selected and copied, and a copy button is also provided. */
function Diagnostic({ text }: { text: string }) {
  const [note, setNote] = useState('');
  useEffect(() => setNote(''), [text]);
  const copy = () => {
    void navigator.clipboard
      .writeText(text)
      .then(() => setNote(TK.link.copied))
      .catch(() => setNote(TK.link.copyFailed));
  };
  return (
    <div>
      <div className={diagBox} tabIndex={0}>
        {text}
      </div>
      <div className={row}>
        <ActionButton isQuiet size="S" onPress={copy}>
          <Text>{TK.link.copyError}</Text>
        </ActionButton>
        {note ? (
          <span role="status" className={copied}>
            {note}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function StageDot({ state, n }: { state: StageState; n: number }) {
  if (state === 'done') return <Checkmark aria-hidden />;
  if (state === 'failed') return <AlertTriangle aria-hidden />;
  return <>{n}</>;
}

/** One line of supplement in the status area: download bytes, file checks, how far follow-up got, and what was left behind after stopping. */
function statusDetail(job: JobRecord, run: FlowRun | null, download: { text: string } | null, hasVideo: boolean): string {
  if (job.state === 'queued') return TK.link.queued;
  if (isJobLive(job)) {
    if (download) return download.text;
    if (job.phase === 'probing') return TK.link.probing;
    if (job.phase === 'validating') return TK.link.validating;
    return TK.link.kept;
  }
  if (job.state === 'cancelled') return TK.link.cancelledNote;
  if (job.state !== 'completed') return TK.link.keptNoVideo;
  if (!run) return hasVideo ? TK.link.imported : TK.link.inDownloads;
  if (run.failedAt) return run.error ?? TK.link.followFailed;
  if (run.stage === 'creating') return TK.link.creating;
  if (run.stage === 'transcribing') return TK.link.transcribing;
  if (run.stage === 'translating') return TK.link.translating;
  return TK.link.ready;
}

export function LinkImportDetail({ row: taskRow, job, backButton }: { row: TaskRow; job: JobRecord; backButton: ReactNode }) {
  const runtime = useRuntime();
  const go = useShell((s) => s.go);
  const openVideo = useShell((s) => s.openVideo);
  const jobs = useJobs((s) => s.jobs);
  const run = useFlowRuns((s) => s.runs[job.jobId] ?? null);
  const now = useNow(1000, taskRow.live);
  const [adopting, setAdopting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // The start page's executor must also be mounted here: when the app starts from task details (or the start page was never opened), the follow-up after the download still connects.
  useEffect(() => bindFlowRunner({ runtime, toast: flowToast }), [runtime]);

  const follow = followOf(run);
  const frozen = linkFrozen(job);
  const meta = linkMeta(job);
  const summary = linkSummary(job);
  const stages = linkStages(job, follow);
  const live = isJobLive(job);
  const issue = job.state === 'failed' || job.state === 'interrupted' ? linkIssue(job.error, job.state) : null;
  const download = live ? downloadProgress(job, jobs) : null;
  const projectId = typeof job.pipeline?.params.projectId === 'string' ? job.pipeline.params.projectId : null;
  const ownVideo = !!summary?.videoId;
  const saved = (follow?.video === 'done' && !!run?.target) || ownVideo;
  const canAdopt = job.state === 'completed' && !ownVideo && (!run || run.failedAt === 'video');
  const title = meta.title ?? (frozen.host || TK.link.untitled);
  const metaText = [
    meta.platform ?? frozen.host,
    meta.durationSec ? formatClock(meta.durationSec, { hours: meta.durationSec >= 3600 }) : null,
    frozen.audioOnly ? TK.link.audioOnly : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const followBusy = !!run && !run.failedAt && run.stage !== 'done' && run.stage !== 'downloading';
  const busy = live || followBusy;

  const cancel = () => {
    setCancelling(true);
    runtime
      .cancelJob(job.jobId)
      .catch((e: Error) => ToastQueue.negative(TK.link.cancelFailed(e.message), { timeout: 6000 }))
      .finally(() => setCancelling(false));
  };
  const adopt = () => {
    setAdopting(true);
    void adoptDownload(job).then((result) => {
      setAdopting(false);
      if (!result.ok) ToastQueue.negative(TK.link.adoptFailed(result.error), { timeout: 6000 });
    });
  };
  const home = () => go({ tab: 'home', conversationId: null, projectId });
  const target = run?.target ?? null;

  const headline = live
    ? linkPhaseText(job)
    : job.state === 'completed'
      ? run?.failedAt
        ? run.failedAt === 'video'
          ? TK.link.videoFailed
          : run.failedAt === 'subs'
            ? TK.link.subsFailed
            : TK.link.translateFailed
        : followBusy
          ? run!.stage === 'creating'
            ? TK.link.stepCreate
            : run!.stage === 'transcribing'
              ? TK.link.stepSubs
              : TK.link.stepTranslate
          : TK.link.downloaded
      : job.state === 'cancelled'
        ? TK.link.stopped
        : TK.link.unfinished;
  const icon = busy ? null : issue || run?.failedAt ? (
    <AlertTriangle aria-hidden />
  ) : job.state === 'cancelled' ? (
    <InfoCircle aria-hidden />
  ) : (
    <Checkmark aria-hidden />
  );

  return (
    <UtilityShell kind="tasks" before={backButton} title={linkHeading(job, follow)} blurb={saved ? TK.link.savedLead : TK.link.pendingLead}>
      <ol className={steps} aria-label={TK.link.steps}>
        {stages.map((s, i) => (
          <li key={s.key} className={stepItem({ state: s.state === 'skipped' ? 'pending' : s.state })} aria-label={TK.link.stepState(s.label, STAGE_LABEL[s.state])}>
            <span className={stepDot({ state: s.state === 'skipped' ? 'pending' : s.state })}>
              <StageDot state={s.state} n={i + 1} />
            </span>
            {s.label}
            {s.state === 'skipped' ? TK.link.skippedMark : ''}
          </li>
        ))}
      </ol>

      <div className={main}>
        <div className={media}>
          <span className={mediaIcon} aria-hidden>
            <Link />
          </span>
          <span className={mediaText}>
            <span className={mediaTitle}>{title}</span>
            {metaText ? <span className={mediaMeta}>{metaText}</span> : null}
            <span className={mediaUrl} title={frozen.url}>
              {frozen.url}
            </span>
          </span>
          <Badge variant={saved ? 'positive' : 'neutral'} fillStyle="subtle" size="S">
            {saved ? TK.link.saved : TK.link.notSaved}
          </Badge>
        </div>

        <div className={status} aria-live="polite">
          <div className={statusHead}>
            {icon}
            <span className={statusTitle}>{headline}</span>
            {download?.pct != null ? <span className={statusPct}>{download.pct}%</span> : null}
          </div>
          {busy ? <ProgressBar size="S" aria-label={headline} isIndeterminate={download?.pct == null} value={download?.pct ?? undefined} /> : null}
          <p className={statusBody}>{statusDetail(job, run, download, ownVideo)}</p>
        </div>

        {issue ? <Recovery job={job} issue={issue} run={run} /> : null}

        <div className={actions}>
          {target && (follow?.video === 'done' || run?.stage === 'done') ? (
            <Button variant="accent" onPress={() => openVideo(target, { conversationId: null, projectId: run!.projectId })}>
              <Play />
              <Text>{TK.link.openVideo}</Text>
            </Button>
          ) : null}
          {canAdopt ? (
            <Button variant="accent" isPending={adopting} onPress={adopt}>
              {TK.link.adopt}
            </Button>
          ) : null}
          {live ? (
            <>
              <Button variant={issue ? 'secondary' : 'accent'} onPress={home}>
                {TK.link.later}
              </Button>
              <Button variant="secondary" fillStyle="outline" isPending={cancelling} onPress={cancel}>
                {TK.link.cancel}
              </Button>
            </>
          ) : job.state === 'cancelled' ? (
            <Button variant="secondary" onPress={() => openLinkTool(frozen.url.startsWith('http') ? frozen.url : '')}>
              {TK.link.reimport}
            </Button>
          ) : issue ? (
            <Button variant="secondary" fillStyle="outline" onPress={home}>
              {TK.link.later}
            </Button>
          ) : null}
          <span className={spacer} />
          <span className={actionsNote}>{busy ? TK.link.noteBusy : issue ? TK.link.noteIssue : TK.link.noteDone}</span>
        </div>
      </div>

      <div className={details}>
        <p className={detailLine}>
          {summary ? TK.link.downloadTo(shortenPath(summary.files.media)) : frozen.outDir ? TK.link.downloadTo(shortenPath(frozen.outDir)) : TK.link.downloadToDefault}
        </p>
        {summary?.tool.version ? (
          <p className={detailLine}>
            {TK.link.tool(summary.tool.name, summary.tool.version)}
            {summary.tool.source in TOOL_SOURCE_LABEL ? ` · ${TOOL_SOURCE_LABEL[summary.tool.source as keyof typeof TOOL_SOURCE_LABEL]}` : ''}
          </p>
        ) : null}
        {summary?.cookieBrowser ? <p className={detailLine}>{usedCookieText(summary.cookieBrowser)}</p> : null}
      </div>

      <TaskFacts rows={taskFacts(taskRow, { job }, now)} />
    </UtilityShell>
  );
}
