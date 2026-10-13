import { memo } from 'react';
import { localizeText, type Id } from '@cuccut/protocol';
import { PixelLoader } from '@react-spectrum/ai/loader';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { clockLabel, footerLabel, type Turn } from '../../model/agent-turn.ts';
import { useNow } from '../use-now.ts';
import { loaderSequence } from './agent-loader-icons.ts';
import { CopyButton } from './copy-button.tsx';
import { T } from './thread-copy.ts';
import { TaskRecovery } from './task-recovery.tsx';
import './agent-thread.css';

const stack = style({ display: 'flex', flexDirection: 'column', gap: 8 });

/**
 * Turn footer (product design §3.2.2): a turn runs from one user message until the next; the footer hangs below the last row of that turn.
 * The status comes from task events, not from what the model said (architecture design §11.3). While in progress, “正在工作 · 0:42” (Working · 0:42) ticks every second, and only the timer widget re-renders itself. While waiting for approval, “等你允许 · 0:42” (Waiting for your approval · 0:42). When done, “已工作 1:03” (Worked 1:03); on hover it switches to the end time. On the right is a copy of this turn's reply body (Markdown source, excluding tools and thinking).
 * `recover`: this is the last task in the session, it failed, and the session is idle, so the recovery area is attached below.
 */
export const TaskFooter = memo(function TaskFooter({
  turn,
  live,
  conversationId,
  recover = false,
}: {
  turn: Turn;
  live: boolean;
  conversationId: Id;
  recover?: boolean;
}) {
  const task = turn.task;
  const failed = task?.status === 'failed';
  const line = (
    <div className={`cc-turn${failed ? ' cc-turn--failed' : ''}`}>
      {live ? <LiveClock turn={turn} /> : <DoneClock turn={turn} />}
      <span className="cc-turn__grow" />
      {!live && turn.text ? <CopyButton text={turn.text} label={T.copyReply} showLabel /> : null}
    </div>
  );
  if (!recover || !task) return line;
  return (
    <div className={stack}>
      {line}
      <TaskRecovery item={task} conversationId={conversationId} />
    </div>
  );
});

/**
 * The timer while in progress: it is the only thing that re-renders every second. In front of it is a pixel loader graphic from the generic sequence (aligned with the left edge of the body); it does not play while waiting for your approval.
 * The graphic is a sibling of the shimmering text (the shimmer sets the text colour to transparent, so if the graphic were placed inside, `currentColor` would be lost).
 */
function LiveClock({ turn }: { turn: Turn }) {
  const now = useNow(1000);
  const task = turn.task;
  const label = footerLabel({
    status: task?.status ?? null,
    startedAt: task ? Date.parse(task.startedAt) : null,
    now,
    waiting: turn.waiting,
  });
  return (
    <>
      {turn.waiting ? null : <PixelLoader icon={loaderSequence('thinking')} size={14} className="cc-turn__loader" />}
      <span className={`cc-turn__live${turn.waiting ? '' : ' cc-shimmer'}`}>{label}</span>
    </>
  );
}

/** The duration after finishing; on hover it switches to the end time. A hidden sizer reserves the width of the longer of the two labels, so the text does not jitter when it changes. On failure, only the reason is written. */
function DoneClock({ turn }: { turn: Turn }) {
  const task = turn.task;
  if (!task) return null;
  const endedAt = task.endedAt ? Date.parse(task.endedAt) : null;
  const label = footerLabel({ status: task.status, startedAt: Date.parse(task.startedAt), endedAt, now: Date.now(), error: localizeText(task.error, task.errorRef) });
  if (!label) return null;
  if (task.status === 'failed' || endedAt === null) return <span>{label}</span>;
  const at = clockLabel(endedAt);
  return (
    <span className="cc-turn__time">
      <span className="cc-turn__sizer" aria-hidden>
        {label.length >= at.length ? label : at}
      </span>
      <span className="cc-turn__spent">{label}</span>
      <span className="cc-turn__at" aria-hidden>
        {at}
      </span>
    </span>
  );
}
