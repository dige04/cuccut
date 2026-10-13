import { useLayoutEffect, useRef, useState } from 'react';
import type { Sequence } from '@cuccut/protocol';
import { EditLabel } from '@cuccut/protocol/messages/ui';
import { ActionButton, ToastQueue, Tooltip, TooltipTrigger } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { STAGE_COPY } from '../../copy.ts';
import { applyFramingToAll, framingPieces, shotSeconds } from '../../model/stage-shots.ts';
import type { PannableVideo } from '../../model/stage-pose.ts';
import { useEditorActions } from './editor-context.tsx';
import type { FrameRect } from './stage-objects.tsx';

/**
 * The chip for framing by shot segment (prototype stage-objects.jsx `ShotChip`, product design §5.10 “edit a short”). When one segment is selected, it hangs just outside the bottom-left corner of the picture, reading “this segment · seconds X–Y”, in seconds on the child video's timeline, which makes clear that dragging only changes this segment. The secondary action “apply to whole clip” writes this segment's current crop to every segment of the same asset, as one transaction, which can be undone from the notice.
 * It sits outside the picture, because the video toolbar is above the picture and placing the chip inside would cover the subject being framed.
 * It carries `data-stage-editor`, so stage point selection and marquee selection do not take pointer input on it.
 */

const chip = style({
  position: 'absolute',
  zIndex: 4,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  paddingStart: 8,
  paddingEnd: 4,
  minHeight: 32,
  borderRadius: 'default',
  backgroundColor: 'gray-25',
  boxShadow: 'elevated',
  font: 'ui-sm',
  color: 'gray-800',
  whiteSpace: 'nowrap',
  userSelect: 'none',
});

/** How far the chip sits below the picture's bottom edge, and the minimum distance to leave from the stage's bottom edge (stage pixels). */
const GAP = 8;
const CHIP_H = 40;

/** The stage's height and the video toolbar's position (stage pixels; null when there is no toolbar). */
interface Room {
  h: number;
  bar: { top: number; h: number } | null;
}

/**
 * The chip's top edge is 8px outside the picture's bottom edge, or flush with the stage bottom if the stage has no room. When the video toolbar has also flipped below the picture and overlaps the chip, the chip moves above the toolbar (sitting on the picture's bottom edge is better than covering the toolbar).
 */
function chipTop(frame: FrameRect, room: Room | null): number {
  const below = frame.top + frame.height + GAP;
  if (!room) return below;
  const top = Math.max(0, Math.min(below, room.h - CHIP_H));
  const bar = room.bar;
  if (!bar || bar.top < frame.top + frame.height / 2) return top;
  const overlaps = top < bar.top + bar.h && bar.top < top + CHIP_H;
  return overlaps ? Math.max(0, bar.top - CHIP_H) : top;
}

export function StageShotChip({ item, sequence, frame }: { item: PannableVideo; sequence: Sequence; frame: FrameRect }) {
  const { apply, undo } = useEditorActions();
  const ref = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState<Room | null>(null);
  // Measure the stage height and the video toolbar's position: when the toolbar cannot fit at the top of the stage and flips below the picture too, the chip must make way for it.
  useLayoutEffect(() => {
    const node = ref.current;
    const area = node?.parentElement;
    if (!node || !area) return;
    const measure = () => {
      const bar = [...area.children].find((child): child is HTMLElement => child !== node && child.getAttribute('role') === 'toolbar');
      const next: Room = { h: area.clientHeight, bar: bar ? { top: bar.offsetTop, h: bar.offsetHeight } : null };
      setRoom((old) => (old && old.h === next.h && old.bar?.top === next.bar?.top && old.bar?.h === next.bar?.h ? old : next));
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(area);
    const moves = new MutationObserver(measure);
    // The toolbar only positions itself after measuring (it changes its style), so later-mounted ones must also be caught: watch additions, removals and style changes across the whole stage overlay, and do not re-render when nothing changed.
    moves.observe(area, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    return () => {
      resize.disconnect();
      moves.disconnect();
    };
  }, []);

  const pieces = framingPieces(sequence, item);
  const others = pieces.length - 1;
  const { from, to } = shotSeconds(item, sequence);
  const top = chipTop(frame, room);

  const applyAll = () => {
    const operations = applyFramingToAll(sequence.id, item, pieces);
    const done = () => ToastQueue.positive(STAGE_COPY.appliedAll(pieces.length), { timeout: 5000 });
    if (!operations.length) return done();
    void apply(operations, EditLabel.applyFramingToAll()).then((receipt) => {
      if (!receipt) return;
      ToastQueue.positive(STAGE_COPY.appliedAll(pieces.length), {
        timeout: 5000,
        actionLabel: STAGE_COPY.undo,
        onAction: () => void undo({ transaction: receipt.transactionId }),
        shouldCloseOnAction: true,
      });
    });
  };

  return (
    <div ref={ref} className={chip} style={{ left: frame.left, top }} data-stage-editor data-shot-chip={item.id}>
      <span>{STAGE_COPY.shotPiece(from, to)}</span>
      {others > 0 ? (
        <TooltipTrigger placement="top">
          <ActionButton size="S" isQuiet onPress={applyAll}>
            {STAGE_COPY.applyAll}
          </ActionButton>
          <Tooltip>{STAGE_COPY.applyAllTip}</Tooltip>
        </TooltipTrigger>
      ) : null}
    </div>
  );
}
