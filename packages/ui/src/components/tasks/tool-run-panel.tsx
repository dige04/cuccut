import type { JobRecord } from '@cuccut/protocol';
import { Button, Content, Heading, InlineAlert } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { jobRemedy } from '../../model/task-facts.ts';
import { videoTargetOf } from '../../model/space.ts';
import type { VideoToolId } from '../../model/tool-catalog.ts';
import { ambiguousAssets, opensMovie, phase, runInput, runOpts } from '../../model/tool-runs.ts';
import { useShell } from '../../state/shell-store.ts';
import { GrantCard, ToolSteps, useRunTitle, useRunView } from '../tools/tool-run-view.tsx';
import { RUN_COPY, TASK_RUN_COPY } from '../tools/tools-copy.ts';
import { useRunRetry, useVideoTools } from '../tools/use-video-tools.ts';

/*
 * Video tool runs in the background task details (design draft tool-run-view.jsx `ToolTaskPanel`, page-tasks.jsx): shows progress by the steps the Runtime provides; when it stops, it says at which step, and can retry from that step (a permission denied on the spot is confirmed here); when complete, “Open in editor”; “View result / Back to tool” opens this run on the tool page.
 */

const panel = style({ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16, maxWidth: 560 });
const buttons = style({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 });

export function ToolRunPanel({ job, tool }: { job: JobRecord; tool: VideoToolId }) {
  const go = useShell((s) => s.go);
  const openVideo = useShell((s) => s.openVideo);
  const setView = useVideoTools((s) => s.setView);
  const retry = useRunRetry(job.jobId);
  const { meta, entry } = useRunTitle(job);
  const run = useRunView(job);
  if (!run) return null;
  const done = run.status === 'done';
  const failed = run.status === 'failed';
  const stopped = failed || run.status === 'cancelled';
  // When transcription stops at “the main track has several assets”, the asset has to be chosen again on the tool page to restart, so no retry is offered here.
  const assets = ambiguousAssets(job);
  const remedy = failed ? jobRemedy(job) : null;
  const keepsVideo = run.steps.some((s) => s.name === 'create' && s.status === 'done');
  const input = meta?.input ?? runInput(job);
  const opts = meta?.target ? { target: meta.target, transcribe: meta.transcribe } : runOpts(job);
  const canOpen = done && !!entry && opensMovie(tool, input, opts);

  const toTool = () => {
    setView(tool, job.jobId);
    go({ tab: 'tools', tool });
  };
  const openEntry = () => entry && openVideo(videoTargetOf(entry), { conversationId: null, projectId: entry.source.projectId });

  return (
    <div className={panel}>
      {run.steps.length ? <ToolSteps list={run.steps} /> : null}
      {failed ? (
        <InlineAlert variant="negative">
          <Heading>{run.steps.length ? phase(run) : TASK_RUN_COPY.stopped}</Heading>
          <Content>
            {assets ? RUN_COPY.ambiguousBody : RUN_COPY.failedBody(run.error ?? RUN_COPY.unknown, keepsVideo)}
            {remedy ? ` ${remedy.hint}` : ''}
          </Content>
        </InlineAlert>
      ) : null}
      {stopped && !assets && retry.asking ? <GrantCard items={retry.asking} onAgree={retry.agree} busy={retry.busy} /> : null}
      <div className={buttons}>
        {stopped && !assets ? (
          <Button
            variant={retry.asking ? 'secondary' : 'accent'}
            size="S"
            isPending={retry.busy && !retry.asking}
            isDisabled={!!retry.asking}
            onPress={retry.retry}>
            {RUN_COPY.retry}
          </Button>
        ) : null}
        {remedy ? (
          <Button variant="secondary" size="S" onPress={() => go(remedy.target)}>
            {remedy.label}
          </Button>
        ) : null}
        {canOpen ? (
          <Button variant="accent" size="S" onPress={openEntry}>
            {RUN_COPY.open}
          </Button>
        ) : null}
        <Button variant="secondary" size="S" onPress={toTool}>
          {done ? TASK_RUN_COPY.viewResult : TASK_RUN_COPY.backToTool}
        </Button>
      </div>
    </div>
  );
}
