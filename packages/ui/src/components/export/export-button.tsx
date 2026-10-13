import { useEffect, useRef, useState } from 'react';
import type { Id, Sequence } from '@cuccut/protocol';
import { Button, DialogTrigger, Popover, Text, ToastQueue } from '@react-spectrum/s2';
import ExportIcon from '@react-spectrum/s2/icons/Export';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { assetFilePath } from '../../model/editor-ops.ts';
import { exportButtonLabel, exportDir, exportOutputs, exportTitle, latestLiveExport, videoExports } from '../../model/export-job.ts';
import { exportSourceDir } from '../../model/export-settings.ts';
import { jobLive } from '../../model/task-list.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useEditor } from '../../state/editor-store.ts';
import { useJobs } from '../../state/jobs-store.ts';
import type { OpenVideo } from '../../state/video-store.ts';
import { mediaCandidates } from '../editor/transcribe-run.ts';
import { EXPORT_COPY } from './export-copy.ts';
import { clearExportRequest, useExportRequest } from './export-request.ts';
import { Note } from './export-parts.tsx';
import { ExportPanel } from './export-popover.tsx';
import type { ExportEnv } from './use-export-submit.ts';

/**
 * The "Export" button in the video bar (design mockup export.jsx, product design §17.1): click to open the right-aligned export popover.
 * While an export of this video is running (no matter who submitted it), the button reads "Exporting · NN%"; closing the popover does not stop the export.
 * When an export finishes while the popover is closed: success gives a notice that can reveal the file in its folder directly; failure or interruption gives a notice, and "View" opens the popover to show the reason.
 * Other places can ask it to open the popover (`requestExport`).
 */

const tabular = { fontVariantNumeric: 'tabular-nums' } as const;
const empty = style({ width: 368, padding: 24, boxSizing: 'border-box' });

export function ExportButton({ video, sequence }: { video: OpenVideo; sequence: Sequence | null }) {
  const videoId = video.videoId;
  const jobs = useJobs((s) => s.jobs);
  const live = videoId ? latestLiveExport(jobs, videoId) : null;
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState<Id | null>(null);
  useEndNotices(videoId, open, (jobId) => {
    setFocus(jobId);
    setOpen(true);
  });
  // Other places ask to open the export popover (the "Export all…" on the short-video result page): opens only once the video has been read.
  const requested = useExportRequest((s) => !!videoId && s.videoId === videoId);
  const ready = !!sequence;
  useEffect(() => {
    if (!requested || !ready || !videoId) return;
    clearExportRequest(videoId);
    setOpen(true);
  }, [requested, ready, videoId]);
  if (!videoId) return null;
  const label = exportButtonLabel(live);

  return (
    <DialogTrigger
      isOpen={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setFocus(null);
      }}>
      <Button variant="accent" aria-label={live ? `${label} · ${EXPORT_COPY.buttonBusyTitle}` : EXPORT_COPY.button}>
        <ExportIcon />
        <Text>
          <span style={tabular}>{label}</span>
        </Text>
      </Button>
      <Popover placement="bottom end" padding="none" aria-label={EXPORT_COPY.title}>
        <PanelHost video={video} videoId={videoId} sequence={sequence} initialJobId={focus} onClose={() => setOpen(false)} />
      </Popover>
    </DialogTrigger>
  );
}

/** The video facts at the moment the popover opens; playhead and selection are taken at open time (the editor does not move while the popover is open). */
function PanelHost({ video, videoId, sequence, initialJobId, onClose }: { video: OpenVideo; videoId: Id; sequence: Sequence | null; initialJobId: Id | null; onClose: () => void }) {
  const web = useRuntime().host.platform === 'web';
  const [{ playhead, selection }] = useState(() => {
    const s = useEditor.getState();
    return { playhead: s.playhead, selection: s.selection };
  });
  const snapshot = video.state?.video ?? null;
  if (!snapshot || !sequence) {
    return (
      <div className={empty}>
        <Note>{EXPORT_COPY.notOpen}</Note>
      </div>
    );
  }
  // When the output has no chosen location, export to the folder of the main source (the earliest video or audio segment on the timeline). On web the Runtime only writes into the project's exports/ folder, so this is not given.
  const main = web ? undefined : mediaCandidates(sequence, snapshot.assets, snapshot.documents)[0]?.asset;
  const videoDir = video.ref?.path ?? null;
  const env: ExportEnv = {
    videoId,
    videoName: snapshot.name,
    sequence,
    documents: snapshot.documents,
    assets: snapshot.assets,
    playhead,
    selection,
    ready: video.status === 'ready',
    sourceDir: main ? exportSourceDir(assetFilePath(main, videoDir), videoDir) : null,
  };
  return <ExportPanel env={env} initialJobId={initialJobId} onClose={onClose} />;
}

/**
 * While the popover is closed, one export of this video changes from "running" to finished: completed, failed, or interrupted each give a notice (cancellation is the user's own action, so no notice).
 * Only exports this window actually saw running are considered; history loaded on first connection does not notify.
 */
function useEndNotices(videoId: Id | null, open: boolean, onView: (jobId: Id) => void) {
  const runtime = useRuntime();
  const jobs = useJobs((s) => s.jobs);
  const seen = useRef<Map<Id, boolean> | null>(null);
  const view = useRef(onView);
  useEffect(() => {
    view.current = onView;
  });

  useEffect(() => {
    const mine = videoId ? videoExports(jobs, videoId) : [];
    const before = seen.current;
    seen.current = new Map(mine.map((j) => [j.jobId, jobLive(j)]));
    if (!before || open) return;
    for (const job of mine) {
      if (before.get(job.jobId) !== true || jobLive(job)) continue;
      const title = job.export ? exportTitle(job.export.settings) : EXPORT_COPY.title;
      if (job.state === 'completed') {
        const target = exportOutputs(job)[0]?.path ?? exportDir(job);
        const name = exportOutputs(job)[0]?.name ?? title;
        ToastQueue.positive(EXPORT_COPY.exportedToast(name), {
          timeout: 8000,
          ...(target ? { actionLabel: EXPORT_COPY.reveal, onAction: () => void runtime.host.revealPath(target), shouldCloseOnAction: true } : {}),
        });
      } else if (job.state === 'failed' || job.state === 'interrupted') {
        const text = job.state === 'failed' ? EXPORT_COPY.failedToast(title) : EXPORT_COPY.interruptedToast(title);
        ToastQueue.negative(text, { timeout: 10000, actionLabel: EXPORT_COPY.view, onAction: () => view.current(job.jobId), shouldCloseOnAction: true });
      }
    }
  }, [jobs, videoId, open, runtime]);
}
