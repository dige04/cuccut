import { useMemo, type PointerEvent as ReactPointerEvent } from 'react';
import type { AssetRecord, DocumentRecord, Id, Sequence } from '@cuccut/protocol';
import CloseCaptions from '@react-spectrum/s2/icons/CloseCaptions';
import TranscriptIcon from '@react-spectrum/s2/icons/Transcript';
import { iconStyle, style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { formatClock } from '../../model/format.ts';
import {
  assetCaptioned,
  liveAt,
  livePending,
  liveRowShown,
  liveTranscriptions,
  placePending,
  placeSegments,
  placeTranscript,
  transcribedBefore,
  transcriptRows,
  type TranscriptRowSource,
} from '../../model/live-transcript.ts';
import { projectableItems } from '../../model/speech-cues.ts';
import { jobLive, jobPercent } from '../../model/task-list.ts';
import { assetDuration } from '../../model/transcript-cut.ts';
import { useJobs, useLiveSegments } from '../../state/jobs-store.ts';
import { SUBTITLE_COPY as C } from './subtitle-copy.ts';
import { useDocumentBody } from './use-document-body.ts';

const icon = iconStyle({ size: 'XS' });
const label = style({ flexGrow: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
/** Breathing dot in the track header (prototype `.thd__live`): this row is still growing. The percentage is not written in the header; it goes into the tooltip. */
const dot = style({ flexShrink: 0, width: 6, height: 6, marginEnd: 8, borderRadius: 'full', backgroundColor: 'purple-900' });
/** Recognized paragraphs: same look as the sentence blocks in the subtitle clip (timeline-cues.tsx), read-only; clicking jumps there. */
const cue = style({
  position: 'absolute',
  top: 4,
  bottom: 4,
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  paddingX: 4,
  borderRadius: 'sm',
  backgroundColor: 'purple-300',
  font: 'ui-xs',
  color: 'purple-1100',
  overflow: 'hidden',
  cursor: 'pointer',
});
const cueText = style({ truncate: true, minWidth: 0 });
/** Sentence blocks on the read-only transcript row (prototype ui.css `.ttx`): neutral gray fill with dark text, kept distinct from subtitle colors, since it doesn't go on screen and isn't exported; no selected state. */
const transcriptCue = style({
  position: 'absolute',
  top: 4,
  bottom: 4,
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  paddingX: 4,
  borderRadius: 'sm',
  backgroundColor: { default: 'gray-200', ':hover': 'gray-300' },
  font: 'ui-xs',
  color: 'gray-800',
  overflow: 'hidden',
  cursor: 'pointer',
});
/** Cursor at the end of the last paragraph (prototype `.tcue__cur`): this is still growing. */
const caret = style({ flexShrink: 0, width: 1, height: 10, marginStart: 2, backgroundColor: 'purple-1100' });
/** The segment not yet transcribed (prototype `.tpend`): diagonal stripes, low contrast, a solid line on the leading edge. It is not a block; clicking it just moves the playhead there. */
const band = style({
  position: 'absolute',
  top: 4,
  bottom: 4,
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  gap: '[6px]',
  paddingStart: '[10px]',
  paddingEnd: 8,
  borderRadius: 'sm',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  font: 'ui-xs',
  color: 'gray-700',
  userSelect: 'none',
  '--cc-live-bg': { type: 'backgroundColor', value: 'gray-100' },
  '--cc-live-stripe': { type: 'backgroundColor', value: 'gray-200' },
  '--cc-live-edge': { type: 'backgroundColor', value: 'purple-900' },
});
const bandDot = style({ flexShrink: 0, width: 6, height: 6, borderRadius: 'full', backgroundColor: 'purple-900' });
const bandText = style({ overflow: 'hidden', textOverflow: 'ellipsis' });

/** Sentence blocks narrower than this width don't show text (same as timeline-cues.tsx). */
const LABEL_MIN_PX = 45;
/** Gap left between adjacent sentences. */
const GAP_PX = 2;

/**
 * Transcribe Jobs (`jobId`) that should draw a temporary transcript row on the timeline: the first transcription, the timeline has used this asset, and it has no subtitles yet (`liveRowShown`).
 * The selection is a string of IDs, so progress and paragraph events don't redraw the whole timeline; `LiveCaptionRow`, which draws the content, subscribes to its own updates.
 */
export function useLiveRows(videoId: Id | null, sequence: Sequence, documents: Record<Id, DocumentRecord>): Id[] {
  const key = useJobs((s) =>
    liveTranscriptions(s.jobs, videoId)
      .filter(
        (t) =>
          projectableItems(sequence, t.assetId).length > 0 &&
          liveRowShown({
            running: t.running,
            segments: (s.liveSegments[t.step.jobId] ?? s.heldSegments[t.step.jobId] ?? []).length,
            captioned: assetCaptioned(sequence, documents, t.assetId),
            transcribedBefore: transcribedBefore(documents, t.assetId, t.step.createdAt),
          }),
      )
      .map((t) => t.step.jobId)
      .join(' '),
  );
  return useMemo(() => (key ? key.split(' ') : []), [key]);
}

/**
 * Temporary subtitle row during transcription (prototype timeline-rows.jsx `SubsRow`, round 220). During the first transcription there is no subtitle track yet (it is created as the last step of the transcription flow), so this row belongs to no track and takes the place of the subtitle row: each recognized paragraph is one block, and the last one has a cursor at its end; from the transcription position to the end of the asset is a “转录中” pending band (“transcribing”).
 * Paragraphs are on the asset clock and are projected onto the timeline through the instances that use this asset (`placeSegments`), so instances that are trimmed or offset still land in the right place. Read-only: not selectable and can't be dragged; clicking a block or the band only moves the playhead. The header has only an icon, a name, and a breathing dot, with no toggle (it isn't a track yet).
 */
export function LiveCaptionRow({
  jobId,
  sequence,
  assets,
  height,
  rowClass,
  headerClass,
  laneClass,
  laneWidth,
  pps,
  xOf,
  view,
  onSeek,
}: {
  jobId: Id;
  sequence: Sequence;
  assets: Record<Id, AssetRecord>;
  height: number;
  rowClass: string;
  headerClass: string;
  laneClass: string;
  laneWidth: number;
  pps: number;
  /** Sequence time (seconds) → x coordinate in the track content. */
  xOf(seconds: number): number;
  /** Visible horizontal range (track content coordinates). */
  view: { left: number; right: number };
  onSeek(seconds: number): void;
}) {
  const step = useJobs((s) => s.jobs.find((j) => j.jobId === jobId) ?? null);
  const segments = useLiveSegments(jobId);
  const assetId = step?.assetId ?? null;
  const running = !!step && jobLive(step);
  const progress = step?.progress ?? null;
  const duration = (assetId && assetDuration(assets, assetId)) || (progress?.unit === 'seconds' ? progress.total : null);
  const at = liveAt(segments, progress, duration, !running);
  const pending = livePending(at, duration, !running);
  const placed = useMemo(() => (assetId ? placeSegments(sequence, assetId, segments) : []), [sequence, assetId, segments]);
  const pendingStart = pending?.start ?? null;
  const pendingEnd = pending?.end ?? null;
  const bands = useMemo(
    () =>
      assetId && pendingStart !== null && pendingEnd !== null
        ? placePending(sequence, assetId, { start: pendingStart, end: pendingEnd })
        : [],
    [sequence, assetId, pendingStart, pendingEnd],
  );
  if (!step || !assetId) return null;

  const pct = running ? jobPercent(step) : null;
  const remain = pending && duration ? formatClock(duration - at) : null;
  const tip = C.liveTip(pct, formatClock(at), remain);
  const last = placed.length ? placed[placed.length - 1]! : null;
  // Don't let a marquee selection that starts on blank space begin on this row: there is nothing selectable on it.
  const hold = (event: ReactPointerEvent) => event.stopPropagation();

  return (
    <div className={rowClass} style={{ height }}>
      <div className={headerClass} onPointerDown={hold}>
        <CloseCaptions styles={icon} data-cc-icons="own" />
        <span className={label} title={tip}>
          {C.trackName}
        </span>
        {running ? <span className={`${dot} cc-live-dot`} title={tip} /> : null}
      </div>
      <div className={laneClass} style={{ width: laneWidth }} onPointerDown={hold}>
        {placed.map((p) => {
          const x0 = xOf(p.start);
          const x1 = xOf(p.end);
          if (x1 < view.left || x0 > view.right) return null;
          const width = Math.max(2, x1 - x0 - GAP_PX);
          const tail = running && p === last;
          return (
            <span key={p.key} className={cue} style={{ left: x0, width }} title={p.text} onClick={() => onSeek(p.start)}>
              {width >= LABEL_MIN_PX ? <span className={cueText}>{p.text}</span> : null}
              {tail ? <span className={`${caret} cc-live-caret`} /> : null}
            </span>
          );
        })}
        {bands.map((b) => {
          const x0 = xOf(b.start);
          const x1 = xOf(b.end);
          if (x1 < view.left || x0 > view.right) return null;
          const width = Math.max(2, x1 - x0);
          return (
            <div
              key={b.start}
              className={`${band} cc-live-pending`}
              style={{ left: x0, width }}
              title={tip}
              onClick={(event) => {
                // When you click the band, the playhead lands where you clicked: it is ordinary ground on the timeline, not a selectable block.
                const rect = event.currentTarget.getBoundingClientRect();
                onSeek(Math.max(b.start, Math.min(b.end, b.start + (event.clientX - rect.left) / pps)));
              }}>
              <span className={`${bandDot} cc-live-dot`} />
              {width >= 150 ? (
                <span className={bandText}>{remain ? C.pendingLeft(remain) : C.liveTitle}</span>
              ) : width >= 60 ? (
                <span className={bandText}>{C.liveTitle}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Assets that should draw the read-only transcript row on the timeline (`transcriptRows`): the asset has no subtitle track at all, and it has been transcribed. Assets that are currently drawing a temporary transcript row (`liveRows`) are excluded, so that when the transcription lands but the subtitle layer isn't built yet, the same speech isn't drawn in two rows.
 */
export function useTranscriptRows(sequence: Sequence, documents: Record<Id, DocumentRecord>, liveRows: readonly Id[]): TranscriptRowSource[] {
  const live = useJobs((s) => liveRows.map((jobId) => s.jobs.find((j) => j.jobId === jobId)?.assetId ?? '').join(' '));
  return useMemo(() => transcriptRows(sequence, documents, new Set(live.split(' ').filter(Boolean))), [sequence, documents, live]);
}

/**
 * Read-only “transcript” row (prototype timeline-rows.jsx `TranscriptRow`): when the video has been transcribed but has no subtitle track yet, the transcript is laid out one sentence per block in the subtitle row's position, so you can see where speech happens. It isn't a track: the header has only an icon and a name, with no toggle. Blocks can't be selected or trimmed; clicking a sentence only moves the playhead to its start.
 */
export function TranscriptRow({
  source,
  sequence,
  height,
  rowClass,
  headerClass,
  laneClass,
  laneWidth,
  xOf,
  view,
  onSeek,
}: {
  source: TranscriptRowSource;
  sequence: Sequence;
  height: number;
  rowClass: string;
  headerClass: string;
  laneClass: string;
  laneWidth: number;
  /** Sequence time (seconds) → x coordinate in the track content. */
  xOf(seconds: number): number;
  /** Visible horizontal range (track content coordinates). */
  view: { left: number; right: number };
  onSeek(seconds: number): void;
}) {
  const body = useDocumentBody(source.speech);
  const placed = useMemo(() => placeTranscript(sequence, source.assetId, body), [sequence, source.assetId, body]);
  // Don't let a marquee selection that starts on blank space begin on this row: there is nothing selectable on it.
  const hold = (event: ReactPointerEvent) => event.stopPropagation();
  return (
    <div className={rowClass} style={{ height }}>
      <div className={headerClass} onPointerDown={hold}>
        <TranscriptIcon styles={icon} data-cc-icons="own" />
        <span className={label} title={C.transcriptRowTip}>
          {C.transcriptRow}
        </span>
      </div>
      <div className={laneClass} style={{ width: laneWidth }} onPointerDown={hold}>
        {placed.map((p) => {
          const x0 = xOf(p.start);
          const x1 = xOf(p.end);
          if (x1 < view.left || x0 > view.right) return null;
          const width = Math.max(2, x1 - x0 - GAP_PX);
          return (
            <span
              key={p.key}
              className={transcriptCue}
              style={{ left: x0, width }}
              title={`${p.text} · ${C.transcriptRowTip}`}
              onClick={() => onSeek(p.start)}>
              {width >= LABEL_MIN_PX ? <span className={cueText}>{p.text}</span> : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}
