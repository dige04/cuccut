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
 * 按镜头分段取景的小牌（原型 stage-objects.jsx 的 `ShotChip`，产品设计 §5.10「改一支短视频」）：选中其中一段时挂在画面左下角
 * 的外面，写「这一段 · 第 X–Y 秒」（子视频时间线上的秒），说清楚拖动只改这一段；次要操作「套到整支」把这一段现在的裁剪写到
 * 同一素材的每一段，一笔事务，提示里可以撤销。挂在画面外面：画面上方是视频工具条，画面里面会挡住要对的人。
 * 带 `data-stage-editor`，舞台的点选与框选不接它上面的指针。
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

/** 小牌离画面下沿多远、离舞台下沿至少留多少（舞台像素）。 */
const GAP = 8;
const CHIP_H = 40;

/** 舞台的高与视频工具条（舞台像素；没有工具条时 null）。 */
interface Room {
  h: number;
  bar: { top: number; h: number } | null;
}

/**
 * 小牌的上沿：画面下沿外 8px，舞台放不下时贴着舞台底；视频工具条也翻到了画面下方、和小牌叠在一起时，小牌挪到工具条上面
 * （压在画面下沿上，总比把工具条盖住好）。
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
  // 量舞台高与视频工具条的位置：工具条贴着舞台顶放不下时也翻到画面下方，小牌要让开它。
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
    // 工具条量完自己才落位（改 style），后挂上来的也要接住：看整个舞台叠加层的增删与 style 变化，没变就不重渲染。
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
