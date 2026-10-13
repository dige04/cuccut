import { useMemo } from 'react';
import type { AssetRecord, DocumentRecord, Id, JobLiveSegment, Sequence } from '@cuccut/protocol';
import { ActionButton, Tooltip, TooltipTrigger } from '@react-spectrum/s2';
import Copy from '@react-spectrum/s2/icons/Copy';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { formatClock } from '../../model/format.ts';
import { liveTranscriptions, liveTranscriptShown, placeSegments } from '../../model/live-transcript.ts';
import { jobLive } from '../../model/task-list.ts';
import { useJobs, useLiveSegments } from '../../state/jobs-store.ts';
import { useEditorActions } from './editor-context.tsx';
import { JumpToLatest, LiveSkeleton, useFollowLatest } from './live-follow.tsx';
import { PanelHead } from './panel-head.tsx';
import { copyToClipboard } from './transcript-actions.ts';
import { TRANSCRIPT_COPY as C } from './transcript-copy.ts';
import { TranscribeProgress } from './transcribe-progress.tsx';
import type { TranscribeRun } from './transcribe-run.ts';

const frame = style({ position: 'relative', flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column' });
const body = style({ flexGrow: 1, minHeight: 0, overflowY: 'auto', paddingX: 12, paddingTop: 12, paddingBottom: 12 });
const list = style({ display: 'flex', flexDirection: 'column', gap: 8 });
/** Live paragraph (prototype `.para--live`): same shape as a transcript paragraph card, read-only. There are no words to click and no menu; clicking the whole paragraph jumps there. */
const row = style({
  paddingX: 8,
  paddingY: 8,
  borderRadius: 'lg',
  backgroundColor: 'gray-25',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  cursor: { default: 'default', isPlaced: 'pointer' },
});
const rowHead = style({ display: 'flex', alignItems: 'center', gap: 8, height: 20, marginBottom: 2 });
/** Speakers are only known once transcription finishes. On the paragraph still growing, show “识别中” (identifying) in faded grey. */
const unknown = style({ font: 'ui-xs', fontWeight: 'bold', color: 'gray-500' });
const time = style({ font: 'ui-xs', color: 'gray-500' });
const text = style({
  font: 'body-sm',
  lineHeight: '[1.8]',
  color: { default: 'gray-800', isTail: 'gray-700' },
  overflowWrap: 'break-word',
});
/** The caret only follows the paragraph still growing (prototype `.caret`). */
const caret = style({
  display: 'inline-block',
  width: 2,
  height: 14,
  marginStart: 2,
  verticalAlign: 'middle',
  backgroundColor: 'blue-900',
});
const EMPTY: readonly JobLiveSegment[] = [];

/**
 * The transcription job (its `jobId`) that the transcript panel switches to live mode for: if one of the assets on the timeline that can be projected is being transcribed, the panel switches (re-transcribing counts too). After transcription finishes, it switches back once the transcript document has landed in the video (`liveTranscriptShown`). What is selected is the ID, so each progress event does not re-render the whole panel.
 */
export function useLiveTranscriptJob(videoId: Id | null, assetIds: readonly Id[], documents: Record<Id, DocumentRecord>): Id | null {
  return useJobs((s) => {
    const found = liveTranscriptions(s.jobs, videoId);
    for (const assetId of assetIds) {
      const t = found.find((each) => each.assetId === assetId);
      if (!t) continue;
      const landed = t.step.result?.documentId ? !!documents[t.step.result.documentId] : false;
      const segments = (s.liveSegments[t.step.jobId] ?? s.heldSegments[t.step.jobId] ?? EMPTY).length;
      if (liveTranscriptShown({ running: t.running, segments, documentLanded: landed })) return t.step.jobId;
    }
    return null;
  });
}

/**
 * Live transcript (prototype panels.jsx `LiveTranscript`): a projection of the task event stream. The whole panel is read-only: text cannot be edited, nothing can be cut, and nothing enters the undo stack. The header keeps only “Copy transcribed part”, since polishing, chapters, and speakers all need the full transcript. Below it are the run-state header (progress, stage steps, cancel) and the paragraphs streaming in. When no paragraph exists yet (just started, or the service does not stream), show a skeleton with one hint line rather than fake data. By default it follows the newest paragraph down; scrolling up stops it and shows “Back to latest.”
 */
export function LiveTranscript({ jobId, sequence, assets }: { jobId: Id; sequence: Sequence; assets: Record<Id, AssetRecord> }) {
  const { seek } = useEditorActions();
  const step = useJobs((s) => s.jobs.find((j) => j.jobId === jobId) ?? null);
  const parentId = step?.submitter.kind === 'pipeline' ? step.submitter.id : null;
  const parent = useJobs((s) => (parentId ? (s.jobs.find((j) => j.jobId === parentId) ?? null) : null));
  const segments = useLiveSegments(jobId);
  const assetId = step?.assetId ?? null;
  const running = !!step && jobLive(step);
  // Recognition is done and the flow is still writing the result into the video (creating the caption layer): the header stops at the “Save” stage and no longer offers cancel recognition.
  const writing = useMemo<TranscribeRun | null>(
    () =>
      step && !running && step.videoId && assetId
        ? { videoId: step.videoId, assetId, assetName: assets[assetId]?.name ?? '', jobId: step.jobId, status: 'writing' }
        : null,
    [step, running, assetId, assets],
  );
  // The first place on the timeline where the paragraph appears: clicking jumps there. A paragraph that was entirely cut has none.
  const starts = useMemo(() => {
    const map = new Map<number, number>();
    if (assetId) for (const p of placeSegments(sequence, assetId, segments)) if (!map.has(p.index)) map.set(p.index, p.start);
    return map;
  }, [sequence, assetId, segments]);

  const { bodyRef, follow, onScroll, toLatest } = useFollowLatest(segments.length);

  return (
    <>
      <PanelHead title={C.title}>
        <TooltipTrigger>
          <ActionButton
            isQuiet
            size="S"
            aria-label={C.liveCopy}
            isDisabled={!segments.length}
            onPress={() =>
              void copyToClipboard(
                segments
                  .map((s) => s.text.trim())
                  .filter(Boolean)
                  .join('\n'),
                C.liveCopied,
              )
            }>
            <Copy />
          </ActionButton>
          <Tooltip>{C.liveCopy}</Tooltip>
        </TooltipTrigger>
      </PanelHead>
      <TranscribeProgress
        run={writing}
        job={step}
        cancelJobId={parent?.jobId ?? null}
        assetName={assetId ? (assets[assetId]?.name ?? null) : null}
        note={C.liveNote}
        heading={C.liveSaving}
      />
      <div className={frame}>
        <div ref={bodyRef} className={`${body} cc-scroll`} onScroll={onScroll} aria-label={C.title} aria-live="polite">
          {segments.length ? (
            <div className={list}>
              {segments.map((segment, index) => {
                const tail = running && index === segments.length - 1;
                const at = starts.get(index);
                return (
                  <div key={index} className={row({ isPlaced: at !== undefined })} onClick={at === undefined ? undefined : () => seek(at)}>
                    <div className={rowHead}>
                      {tail ? <span className={unknown}>{C.liveSpeaker}</span> : null}
                      <span className={`${time} cc-tabular`}>{formatClock(segment.start)}</span>
                    </div>
                    <div className={text({ isTail: tail })}>
                      {segment.text.trim()}
                      {tail ? <span className={`${caret} cc-live-caret`} /> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <LiveSkeleton hint={C.liveWaiting} />
          )}
        </div>
        {follow ? null : <JumpToLatest label={C.liveJump} onPress={toLatest} />}
      </div>
    </>
  );
}
