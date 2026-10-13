import { useMemo } from 'react';
import type { Id, Sequence } from '@cuccut/protocol';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { formatClock } from '../../model/format.ts';
import { placeSegments } from '../../model/live-transcript.ts';
import { jobLive } from '../../model/task-list.ts';
import { useJobs, useLiveSegments } from '../../state/jobs-store.ts';
import { useEditorActions } from './editor-context.tsx';
import { JumpToLatest, LiveSkeleton, useFollowLatest } from './live-follow.tsx';
import { TRANSCRIPT_COPY as T } from './transcript-copy.ts';

const frame = style({ position: 'relative', flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column' });
const body = style({ flexGrow: 1, minHeight: 0, overflowY: 'auto', paddingX: 12, paddingTop: 8, paddingBottom: 12 });
const list = style({ display: 'flex', flexDirection: 'column', gap: 8 });
/** One item (prototype `.sb.sb--live`): same shape as the sentence card in the subtitle list (`cueCard` in subtitle-panel.tsx); read-only, and clicking it jumps there. */
const card = style({
  position: 'relative',
  overflow: 'hidden',
  paddingY: '[9px]',
  paddingStart: '[12px]',
  paddingEnd: '[10px]',
  borderRadius: 'lg',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  backgroundColor: 'gray-25',
  cursor: 'pointer',
});
/** The style macro has no per-edge border colors: the colored bar on the left is drawn as its own block. No speaker yet, so it is greyed out. */
const accent = style({ position: 'absolute', top: 0, bottom: 0, insetStart: 0, width: '[3px]', backgroundColor: 'gray-300' });
const head = style({ display: 'flex', alignItems: 'center', gap: '[6px]', marginBottom: '[5px]', minHeight: 20 });
const number = style({ fontSize: '[10px]', color: 'gray-500', minWidth: 16 });
/** Speaker labels only exist once transcription finishes: on the longer item, write “Recognizing”, greyed out (prototype `.sbsp--unk`). */
const unknown = style({ font: 'ui-xs', fontWeight: 'bold', color: 'gray-500' });
const time = style({ font: 'ui-xs', color: 'gray-500' });
const text = style({
  font: 'body-sm',
  lineHeight: '[1.6]',
  color: { default: 'gray-800', isTail: 'gray-700' },
  whiteSpace: 'pre-wrap',
  overflowWrap: 'break-word',
});
/** The caret only follows the item that is still growing (prototype `.caret`). */
const caret = style({
  display: 'inline-block',
  width: 2,
  height: 14,
  marginStart: 2,
  verticalAlign: 'middle',
  backgroundColor: 'blue-900',
});

/**
 * Subtitle panel while transcribing (prototype panel-subtitle.jsx, round 220): on the first transcription, before there is any subtitle to proofread, the running header (progress, steps, cancel) is followed by the recognized segments in arrival
 * order, one read-only card per segment (index, time, text), and clicking one jumps there. Text cannot be edited and nothing enters undo, because these are not yet a subtitle document; the transcription flow switches to subtitles only at its last step.
 * Only segments that land on the timeline are listed (subtitles are only generated for the part on the timeline), and the time is where the segment first appears on the timeline. When nothing is listed yet, a skeleton is drawn; by default it follows the newest at the bottom, and if the user scrolls up it stops and a “Back to latest” button floats up. `jobId` is the transcription Job that runs recognition; it is null while still submitting.
 */
export function SubtitleLive({ jobId, sequence }: { jobId: Id | null; sequence: Sequence }) {
  const { seek } = useEditorActions();
  const step = useJobs((s) => (jobId ? (s.jobs.find((j) => j.jobId === jobId) ?? null) : null));
  const segments = useLiveSegments(jobId);
  const assetId = step?.assetId ?? null;
  const running = !!step && jobLive(step);
  // One card per segment: if a segment is cut into several pieces across edit points, use the start of the first piece; segments cut away entirely are not listed.
  const cards = useMemo(() => {
    if (!assetId) return [];
    const seen = new Set<number>();
    const out: Array<{ index: number; start: number; text: string }> = [];
    for (const p of placeSegments(sequence, assetId, segments)) {
      if (seen.has(p.index)) continue;
      seen.add(p.index);
      const text = segments[p.index]?.text.trim() ?? '';
      if (text) out.push({ index: p.index, start: p.start, text });
    }
    return out.sort((a, b) => a.index - b.index);
  }, [sequence, assetId, segments]);
  const { bodyRef, follow, onScroll, toLatest } = useFollowLatest(cards.length);

  return (
    <div className={frame}>
      <div ref={bodyRef} className={`${body} cc-scroll`} onScroll={onScroll} aria-live="polite">
        {cards.length ? (
          <div className={list}>
            {cards.map((c, i) => {
              const tail = running && i === cards.length - 1;
              return (
                <div key={c.index} className={card} onClick={() => seek(c.start)}>
                  <span className={accent} aria-hidden />
                  <div className={head}>
                    <span className={`${number} cc-tabular`}>{i + 1}</span>
                    {tail ? <span className={unknown}>{T.liveSpeaker}</span> : null}
                    <span className={`${time} cc-tabular`}>{formatClock(c.start)}</span>
                  </div>
                  <div className={text({ isTail: tail })}>
                    {c.text}
                    {tail ? <span className={`${caret} cc-live-caret`} /> : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <LiveSkeleton hint={T.liveWaiting} />
        )}
      </div>
      {follow ? null : <JumpToLatest label={T.liveJump} onPress={toLatest} />}
    </div>
  );
}
