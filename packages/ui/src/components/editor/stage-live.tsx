import { useEffect, useMemo } from 'react';
import type { DocumentRecord, Id, Sequence } from '@cuccut/protocol';
import { liveCaptionCues } from '../../model/live-caption.ts';
import { placeSegments } from '../../model/live-transcript.ts';
import { useJobs, useLiveSegments } from '../../state/jobs-store.ts';
import { useEditorActions } from './editor-context.tsx';
import { useLiveRows } from './timeline-live.tsx';

/**
 * Temporary captions on the picture while transcribing (prototype stage.jsx, round 220; product design §5.7). It uses the same gate as the temporary caption row on the timeline (`useLiveRows`: first transcription, the timeline has taken this asset, and there is no caption track for it yet). Recognized segments are projected onto the sequence and handed to the preview engine: when the playhead falls within a segment, that segment appears on the picture, and parts not yet transcribed draw nothing.
 * When the caption track appears (or the process ends), this layer is removed and real captions take over. It draws no DOM; it only sends to the engine.
 */
export function StageLiveCaptions({
  videoId,
  sequence,
  documents,
}: {
  videoId: Id | null;
  sequence: Sequence;
  documents: Record<Id, DocumentRecord>;
}) {
  const jobIds = useLiveRows(videoId, sequence, documents);
  return (
    <>
      {jobIds.map((jobId) => (
        <StageLiveCaption key={jobId} jobId={jobId} sequence={sequence} />
      ))}
    </>
  );
}

/** Temporary captions for one transcription: re-projected each time a segment arrives; removed from the engine on unmount. */
function StageLiveCaption({ jobId, sequence }: { jobId: Id; sequence: Sequence }) {
  const { engine } = useEditorActions();
  const assetId = useJobs((s) => s.jobs.find((j) => j.jobId === jobId)?.assetId ?? null);
  const segments = useLiveSegments(jobId);
  const cues = useMemo(() => (assetId ? liveCaptionCues(placeSegments(sequence, assetId, segments)) : []), [sequence, assetId, segments]);
  useEffect(() => engine.setLiveCaption(jobId, cues), [engine, jobId, cues]);
  useEffect(() => () => engine.setLiveCaption(jobId, null), [engine, jobId]);
  return null;
}
