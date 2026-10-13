import { useMemo, type ReactNode, type RefObject } from 'react';
import type { CaptionItem, DocumentRecord, Sequence } from '@cuccut/protocol';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { placedCues } from '../../model/caption-cues.ts';
import { readCaptions } from '../../render/captions.ts';
import { useDocumentBody } from './use-document-body.ts';
import { useVisibleLane } from './use-visible-lane.ts';

const cueLayer = style({ position: 'absolute', inset: 0, pointerEvents: 'none' });
const cueBlock = style({
  position: 'absolute',
  top: 4,
  bottom: 4,
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  paddingX: 4,
  borderRadius: 'sm',
  backgroundColor: { default: 'purple-300', isSelected: 'purple-400' },
  font: 'ui-xs',
  color: 'purple-1100',
  overflow: 'hidden',
});
const cueText = style({ truncate: true, minWidth: 0 });

/** Sentence blocks narrower than this width do not show text (same as the old web timeline). */
const LABEL_MIN_PX = 45;
/** Gap left between adjacent cues. */
const GAP_PX = 2;

/**
 * Cues inside a subtitle clip (following the old web timeline): one block per cue, with the cue's text written inside; when narrow, only the colored block is kept. Only the visible part is drawn;
 * when the document has not been fetched yet or has no cues, `fallback` (the clip name) is drawn.
 */
export function CaptionCues({
  item,
  sequence,
  record,
  clipLeft,
  xOf,
  scrollRef,
  head,
  selected,
  fallback,
}: {
  item: CaptionItem;
  sequence: Sequence;
  record: DocumentRecord | undefined;
  /** The clip's left edge position within the track content. */
  clipLeft: number;
  /** Sequence time (seconds) → horizontal coordinate within the track content. */
  xOf(seconds: number): number;
  scrollRef: RefObject<HTMLDivElement | null>;
  head: number;
  selected: boolean;
  fallback: ReactNode;
}) {
  const body = useDocumentBody(record);
  const placed = useMemo(() => {
    const track = readCaptions(body);
    return track ? placedCues(item, sequence, track) : [];
  }, [body, item, sequence]);
  const visible = useVisibleLane(scrollRef, head);
  if (placed.length === 0) return <>{fallback}</>;

  return (
    <div className={cueLayer}>
      {placed.map((cue) => {
        const x0 = xOf(cue.start);
        const x1 = xOf(cue.end);
        if (x1 < visible.left || x0 > visible.right) return null;
        const width = Math.max(2, x1 - x0 - GAP_PX);
        return (
          <span key={cue.key} className={cueBlock({ isSelected: selected })} style={{ left: x0 - clipLeft, width }}>
            {width >= LABEL_MIN_PX ? <span className={cueText}>{cue.text}</span> : null}
          </span>
        );
      })}
    </div>
  );
}
