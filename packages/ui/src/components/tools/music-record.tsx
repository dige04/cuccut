import { useState } from 'react';
import type { JobRecord } from '@cuccut/protocol';
import { ActionButton, ActionMenu, Button, MenuItem, ProgressBar, Text, ToastQueue } from '@react-spectrum/s2';
import Copy from '@react-spectrum/s2/icons/Copy';
import Delete from '@react-spectrum/s2/icons/Delete';
import Download from '@react-spectrum/s2/icons/Download';
import OpenIn from '@react-spectrum/s2/icons/OpenIn';
import Revert from '@react-spectrum/s2/icons/Revert';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { cancellationCost } from '../../model/task-facts.ts';
import { jobPercent } from '../../model/task-list.ts';
import { aheadOf, didNotFinish, failureText, phaseLabel, queuedDetail, recordStatus, stateLabel } from '../../model/tools-records.ts';
import { audioOutput } from '../../model/tools-tts.ts';
import {
  etaText,
  musicFileName,
  musicGeneration,
  musicRecordMeta,
  musicRetryRequest,
  musicText,
  musicTitle,
  musicTruncated,
} from '../../model/tools-music.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useShell } from '../../state/shell-store.ts';
import { useTools } from '../../state/tools-store.ts';
import { detail, detailGrow, RecordCard, recordHead, recordIcon, recordRow, recordText, recordTitle } from './tool-parts.tsx';
import { MusicIcon } from '../music-icon.tsx';
import { ToolOutputRow, useJobOutputs } from './tool-outputs.tsx';
import { MUSIC_TOOL_COPY as COPY } from './music-tool-copy.ts';
import { RECORD_COPY } from './tools-copy.ts';
import { copyText, useArtifactUrl, useCancelJob, useDownloadArtifact, useRecordRetry } from './use-tool-records.ts';

/* 设计稿 tool-music.jsx `RecordCard`：风格、状态、歌词第一行、元数据、在跑的阶段与预计耗时，做好后播放、下载与产物行。 */

const audio = style({ width: 'full', height: 36 });
const progress = style({ width: 'full' });

/** 「再试一次 / 重新排队」：中断的就地重跑，其余照冻结的参数原样再提交（见 `useRecordRetry`）。 */
function useMusicRetry(job: JobRecord) {
  const runtime = useRuntime();
  return useRecordRetry(
    job,
    'generateMusic',
    (j) => {
      const request = musicRetryRequest(j);
      return request ? runtime.generateMusic(request) : null;
    },
    { submitted: COPY.submitted, failed: COPY.submitFailed },
  );
}

export function MusicRecord({
  job,
  all,
  modelName,
  now,
  onReuse,
}: {
  job: JobRecord;
  all: readonly JobRecord[];
  modelName: string;
  now: number;
  onReuse: (job: JobRecord) => void;
}) {
  const go = useShell((s) => s.go);
  const hide = useTools((s) => s.hide);
  const cancel = useCancelJob();
  const again = useMusicRetry(job);
  const title = musicTitle(job);
  const g = musicGeneration(job);
  const unsettled = job.state === 'needs-reconciliation';
  const cost = job.state === 'cancelled' && job.cancellation ? cancellationCost(job.cancellation) : null;
  const status = recordStatus(job);
  const live = status === 'queued' || status === 'running';
  const off = job.state === 'cancelled' || didNotFinish(job);
  const pct = jobPercent(job);
  const eta = g ? etaText(g.targetDurationSec ?? g.maxDurationSec, { planning: g.planning }) : '';

  const act = (key: string) => {
    if (key === 'reuse') onReuse(job);
    else if (key === 'copy') copyText(g?.style ?? '');
    else if (key === 'task') go({ tab: 'tasks', taskId: job.jobId });
    else if (key === 'remove') {
      hide(job.jobId);
      ToastQueue.neutral(RECORD_COPY.removed(title), { timeout: 4000 });
    }
  };

  return (
    <RecordCard running={status === 'running'} failed={didNotFinish(job)} label={title}>
      <div className={recordHead}>
        <span className={recordIcon} aria-hidden>
          <MusicIcon />
        </span>
        <h3 className={recordTitle} title={musicText(job)}>
          {title}
        </h3>
        <span className={detail}>{stateLabel(job, now)}</span>
        <ActionMenu aria-label={RECORD_COPY.more} isQuiet size="S" disabledKeys={live || unsettled ? ['remove'] : []} onAction={(key) => act(String(key))}>
          <MenuItem id="reuse" textValue={RECORD_COPY.reuse}>
            <Revert />
            <Text slot="label">{RECORD_COPY.reuse}</Text>
          </MenuItem>
          <MenuItem id="copy" textValue={COPY.copyStyle}>
            <Copy />
            <Text slot="label">{COPY.copyStyle}</Text>
          </MenuItem>
          <MenuItem id="task" textValue={RECORD_COPY.task}>
            <OpenIn />
            <Text slot="label">{RECORD_COPY.task}</Text>
          </MenuItem>
          <MenuItem id="remove" textValue={RECORD_COPY.remove}>
            <Delete />
            <Text slot="label">{RECORD_COPY.remove}</Text>
            <Text slot="description">{RECORD_COPY.removeNote}</Text>
          </MenuItem>
        </ActionMenu>
      </div>
      <p className={recordText({ isOff: off })}>{musicText(job)}</p>
      <span className={detail}>{musicRecordMeta(job, modelName)}</span>

      {status === 'running' ? (
        <>
          <div className={recordRow}>
            <span className={detailGrow}>{COPY.running(phaseLabel(job), eta)}</span>
            <ActionButton isQuiet size="S" onPress={() => cancel(job.jobId)}>
              <Text>{RECORD_COPY.cancel}</Text>
            </ActionButton>
          </div>
          <ProgressBar
            size="S"
            styles={progress}
            aria-label={RECORD_COPY.progressLabel(title, phaseLabel(job))}
            isIndeterminate={pct === null}
            value={pct ?? undefined}
          />
        </>
      ) : null}
      {job.state === 'queued' ? (
        <div className={recordRow}>
          <span className={detailGrow}>{queuedDetail(job) ?? RECORD_COPY.ahead(aheadOf(all, job))}</span>
          <ActionButton isQuiet size="S" onPress={() => cancel(job.jobId)}>
            <Text>{RECORD_COPY.cancel}</Text>
          </ActionButton>
        </div>
      ) : null}
      {job.state === 'cancelled' ? (
        <div className={recordRow}>
          <span className={detailGrow}>{cost ? `${RECORD_COPY.noFile} · ${cost}` : RECORD_COPY.noFile}</span>
          <RetryButton label={RECORD_COPY.requeue} again={again} />
        </div>
      ) : null}
      {didNotFinish(job) ? (
        <div className={recordRow}>
          <span className={detailGrow}>{unsettled ? RECORD_COPY.unsettled(failureText(job)) : failureText(job)}</span>
          {unsettled ? (
            <ActionButton size="S" onPress={() => go({ tab: 'tasks', taskId: job.jobId })}>
              <Text>{RECORD_COPY.reconcile}</Text>
            </ActionButton>
          ) : (
            <RetryButton label={RECORD_COPY.retry} again={again} />
          )}
        </div>
      ) : null}
      {job.state === 'completed' ? <MusicResult job={job} /> : null}
    </RecordCard>
  );
}

/** 重新提交过的不再给按钮，写「已重新提交」；在途时转圈。 */
function RetryButton({ label, again }: { label: string; again: ReturnType<typeof useMusicRetry> }) {
  if (again.done) return <span className={detail}>{RECORD_COPY.retried}</span>;
  return (
    <ActionButton size="S" isPending={again.pending} onPress={again.retry}>
      <Text>{label}</Text>
    </ActionButton>
  );
}

/** 做完的那一条：播放器、下载、写到上限的提醒，以及它在 Space 里的条目（产物行：在 Space 中查看、交给 Agent、以此新建视频）。 */
function MusicResult({ job }: { job: JobRecord }) {
  const out = audioOutput(job);
  const media = useArtifactUrl(out?.artifactId ?? null);
  const download = useDownloadArtifact();
  const [busy, setBusy] = useState(false);
  const entry = useJobOutputs([job.jobId])[0] ?? null;
  const g = musicGeneration(job);
  if (!out) return <span className={detail}>{RECORD_COPY.noFile}</span>;
  return (
    <>
      {media?.status === 'ready' ? (
        <audio className={audio} controls preload="metadata" src={media.url} aria-label={RECORD_COPY.play(musicTitle(job))} />
      ) : (
        <span className={detail}>{media?.status === 'failed' ? RECORD_COPY.openFailed(media.message) : RECORD_COPY.loadingMedia}</span>
      )}
      <div className={recordRow}>
        <Button
          variant="secondary"
          size="S"
          isPending={busy}
          onPress={() => {
            setBusy(true);
            download(out.artifactId, musicFileName(g?.style ?? ''))
              .catch((e: Error) => ToastQueue.negative(RECORD_COPY.downloadFailed(e.message), { timeout: 6000 }))
              .finally(() => setBusy(false));
          }}>
          <Download />
          <Text>{RECORD_COPY.download('WAV')}</Text>
        </Button>
      </div>
      {musicTruncated(job) && g ? <span className={detail}>{COPY.truncated(g.maxDurationSec)}</span> : null}
      {entry ? <ToolOutputRow entry={entry} fromTool="generate-music" compact /> : null}
    </>
  );
}
