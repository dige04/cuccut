import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import type { TimelineItem } from '@cuccut/protocol';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { OUTPUT_COPY } from '../../copy.ts';
import { conversationOutputs, outputsByMessage, type ConversationOutput } from '../../model/conversation-outputs.ts';
import { gapBetween, rowKind, showFooter, turns, type RowKind, type Turn } from '../../model/agent-turn.ts';
import { buildThread, type ThreadBlock } from '../../model/thread.ts';
import { threadCards, type ThreadCard } from '../../model/video-cards.ts';
import { useConversationMeta } from '../../state/directory-store.ts';
import { useSpace } from '../../state/space-store.ts';
import { ApprovalCard } from './approval-card.tsx';
import {
  beginScrollbarDrag,
  endScrollbarDrag,
  initialFollowState,
  isUpwardKey,
  nextFollowState,
  recordUpwardIntent,
  REFOLLOW_PX,
  shouldPin,
  upwardIntentRemaining,
  type FollowState,
} from './follow-bottom.ts';
import { AgentMessage, NoticeLine, UserMessage } from './messages.tsx';
import { OutputCard } from './output-card.tsx';
import { StepsGroup } from './steps-group.tsx';
import { TaskFooter } from './task-footer.tsx';
import { DownloadCard, useJobsForPlacement } from './video-card-rows.tsx';

const scroller = style({ flexGrow: 1, minHeight: 0, overflowY: 'auto' });
export const column = style({
  display: 'flex',
  flexDirection: 'column',
  width: 'full',
  maxWidth: '[760px]',
  marginX: 'auto',
  paddingX: 24,
  paddingY: 24,
  boxSizing: 'border-box',
});

/** Colours used in the thread for the reply body, step rows and footer (agent-thread.css reads these variables). */
const threadVars = style({
  '--cc-at-text': { type: 'color', value: 'gray-800' },
  '--cc-at-heading': { type: 'color', value: 'gray-900' },
  '--cc-at-muted': { type: 'color', value: 'gray-600' },
  '--cc-at-faint': { type: 'color', value: 'gray-500' },
  '--cc-at-link': { type: 'color', value: 'blue-900' },
  '--cc-at-link-hover': { type: 'color', value: 'blue-1000' },
  '--cc-at-hunk': { type: 'color', value: 'blue-900' },
  '--cc-at-shimmer': { type: 'color', value: 'gray-700' },
  '--cc-at-shimmer-hi': { type: 'color', value: 'gray-300' },
  '--cc-at-err-text': { type: 'color', value: 'red-900' },
  '--cc-at-err-strong': { type: 'color', value: 'red-1000' },
  '--cc-at-add-text': { type: 'color', value: 'green-1100' },
  '--cc-at-del-text': { type: 'color', value: 'red-1100' },
  '--cc-at-code-bg': { type: 'backgroundColor', value: 'gray-100' },
  '--cc-at-row-hover': { type: 'backgroundColor', value: 'gray-75' },
  '--cc-at-err-bg': { type: 'backgroundColor', value: 'red-100' },
  '--cc-at-add-bg': { type: 'backgroundColor', value: 'green-100' },
  '--cc-at-del-bg': { type: 'backgroundColor', value: 'red-100' },
  '--cc-at-line': { type: 'borderColor', value: 'gray-200' },
  '--cc-at-quote': { type: 'borderColor', value: 'gray-300' },
  '--cc-at-err-line': { type: 'borderColor', value: 'red-300' },
  '--cc-at-focus': { type: 'outlineColor', value: 'focus-ring' },
});

/** One row: when artifacts hang below a reply, the gap between them is 8. */
const row = style({ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 });

/** Outputs under a reply (prototype apprail.css `.chat-outputs` :126): stacked, aligned with the reply's start edge. */
const messageOutputs = style({ display: 'flex', flexDirection: 'column', gap: 8 });

export function Thread({
  items,
  conversationId,
  running,
  empty,
}: {
  items: readonly TimelineItem[];
  conversationId: string;
  running: boolean;
  empty?: ReactNode;
}) {
  const blocks = useMemo(() => buildThread(items), [items]);
  const meta = useConversationMeta(conversationId);
  const entries = useSpace((s) => s.entries);
  const projectId = meta?.projectId ?? null;
  const cwd = meta?.cwd;
  // Files below each reply come from the same source as the session header's “产物” (Artifacts) (conversation-outputs.ts); each is grouped by task under the last reply of that task, without truncation.
  // Videos are not here: there is one video card per video per session, placed after the latest turn that holds the last reference or a still-running task (video-cards.ts).
  const outputs = useMemo(
    () =>
      outputsByMessage(
        items,
        conversationOutputs({ id: conversationId, projectId, cwd }, items, entries, Infinity).filter((output) => output.kind !== 'video'),
      ),
    [items, entries, conversationId, projectId, cwd],
  );
  const jobs = useJobsForPlacement();
  const cards = useMemo(
    () => threadCards({ blocks, items, jobs, conversationId, entries }),
    [blocks, items, jobs, conversationId, entries],
  );
  const showColumn = blocks.length > 0 || running;
  const { scrollerRef, columnRef } = useFollowBottom(conversationId, blocks, showColumn);

  // The “当前” (current) content block: while a step group is running, its summary line switches to the step that is running.
  const lastContent = blocks.findLast((block) => block.type !== 'task');
  const turnList = useMemo(() => turns(blocks), [blocks]);
  // The recovery area for a failure is attached only to the last task, and it appears only when the session is idle: if something else has run since, the old failure no longer offers a way forward.
  const lastTask = blocks.findLast((block) => block.type === 'task');
  const recoverable = !running && lastTask?.type === 'task' && lastTask.item.status === 'failed' ? lastTask.item : undefined;

  // Row gaps are set by adjacent kind (gapBetween); the footer hangs below the last row of each turn, and the task status row itself takes no row.
  const footerAfter = new Map(turnList.map((turn, i) => [turn.end, { turn, last: i === turnList.length - 1 }]));
  const rows: ReactNode[] = [];
  let prev: RowKind | null = null;
  let prevHasCards = false;
  blocks.forEach((block, i) => {
    if (block.type !== 'task') {
      const kind = rowKind(block);
      rows.push(
        <div key={block.id} className={row} style={{ marginTop: gapBetween(prev, kind, prevHasCards) }}>
          <Block
            block={block}
            conversationId={conversationId}
            cwd={cwd}
            live={running && block === lastContent}
            outputs={block.type === 'agent' ? outputs.get(block.id) : undefined}
          />
          {cards.has(block.id) ? <ThreadCards cards={cards.get(block.id)!} conversationId={conversationId} /> : null}
        </div>,
      );
      prev = kind;
      prevHasCards = !!cards.get(block.id)?.length || (block.type === 'agent' && !!outputs.get(block.id)?.length);
    }
    const foot = footerAfter.get(i);
    if (!foot) return;
    const live = turnLive(foot.turn, running && foot.last);
    if (!showFooter(foot.turn, live)) return;
    rows.push(
      <div key={`footer/${block.id}`} style={{ marginTop: gapBetween(prev, 'footer') }}>
        <TaskFooter
          turn={foot.turn}
          live={live}
          conversationId={conversationId}
          recover={!!recoverable && foot.turn.task?.id === recoverable.id}
        />
      </div>,
    );
    prev = 'footer';
    prevHasCards = false;
  });

  return (
    <div ref={scrollerRef} className={`${scroller} cc-scroll`}>
      {!showColumn ? (
        empty
      ) : (
        <div ref={columnRef} className={`${column} ${threadVars}`} role="log" aria-live="polite" aria-relevant="additions">
          {rows}
        </div>
      )}
    </div>
  );
}

/** Whether this turn is running: if there is a task, look at the task's status; if there is no task yet, the last turn of a running session counts as running. */
function turnLive(turn: Turn, runningLast: boolean): boolean {
  if (turn.task) return turn.task.status === 'running' || turn.task.status === 'stopping';
  return runningLast;
}

/**
 * Follow to bottom: while following, any change in content or viewport size pins to the bottom (merged into one per frame). Only a smaller scrollTop that comes with upward-input evidence detaches; scrolling back to within 1px of the bottom re-follows. See follow-bottom.ts for the rules.
 */
function useFollowBottom(conversationId: string, blocks: unknown, showColumn: boolean) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const state = useRef<FollowState>(initialFollowState());
  const frame = useRef<number | null>(null);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedulePin = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const el = scrollerRef.current;
      const current = state.current;
      if (!el || !current.following) return;
      const now = performance.now();
      if (shouldPin(current, now)) pinToBottom(el, state);
      // Upward input is still within the time window: don't pin yet, and pin once after the window has passed; no pinning during scrollbar dragging, and it is scheduled on release.
      else if (retry.current === null && !current.scrollbarDrag)
        retry.current = setTimeout(
          () => {
            retry.current = null;
            schedulePin();
          },
          upwardIntentRemaining(current, now) + 1,
        );
    });
  }, []);

  // On session switch, reset to following the bottom; it is declared before the pin-to-bottom effect below, so within the same commit it resets first and then pins.
  useLayoutEffect(() => {
    state.current = { ...initialFollowState(), lastScrollTop: scrollerRef.current?.scrollTop ?? null };
  }, [conversationId]);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el || !state.current.following) return;
    if (shouldPin(state.current, performance.now())) pinToBottom(el, state);
    else schedulePin();
  }, [blocks, schedulePin]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const doc = el.ownerDocument;
    const win = doc.defaultView ?? window;
    const intent = () => {
      state.current = recordUpwardIntent(state.current, performance.now());
    };
    const endDrag = () => {
      if (!state.current.scrollbarDrag) return;
      state.current = endScrollbarDrag(state.current);
      if (state.current.following) schedulePin();
    };

    // Streamed text growing within the same message, images loading, blocks expanding, and the viewport getting shorter all bypass `blocks`, so the bottom is pinned via size changes.
    // One observer watches both the container and the content column, so all size changes in a frame arrive in one callback. The callback runs after layout and before paint, so pinning directly does not paint a frame that isn't at the bottom. When pinning can't happen yet (there is upward input), it is handed to schedulePin to catch up.
    const observer = new ResizeObserver(() => {
      const current = state.current;
      if (!current.following) return;
      if (shouldPin(current, performance.now())) pinToBottom(el, state);
      else schedulePin();
    });
    observer.observe(el);
    if (columnRef.current) observer.observe(columnRef.current);

    const onScroll = () => {
      state.current = nextFollowState(state.current, {
        scrollTop: el.scrollTop,
        distanceFromBottom: el.scrollHeight - el.scrollTop - el.clientHeight,
        now: performance.now(),
      });
    };
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY < 0 && !event.ctrlKey && !nestedCanScrollUp(event.target, el)) intent();
    };
    // When focus is on body, the browser hands keyboard scrolling to the scroll area that was most recently used, so listen on the document and only accept keys whose target is inside the container or on body.
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (!isUpwardKey(event) || isEditable(target)) return;
      if (target instanceof Node && (el.contains(target) || target === doc.body || target === doc.documentElement)) intent();
    };
    // A press on the scrollbar (classic scrollbars take up width; with overlay scrollbars clientWidth equals offsetWidth, so this cannot be detected).
    const onPointerDown = (event: PointerEvent) => {
      if (event.target === el && event.offsetX >= el.clientWidth) state.current = beginScrollbarDrag(state.current);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.buttons === 0) endDrag();
    };
    let touchY: number | null = null;
    const onTouchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? null;
    };
    // Finger moving down = content scrolling up.
    const onTouchMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY;
      if (y === undefined) return;
      if (touchY !== null && y > touchY) intent();
      touchY = y;
    };

    const passive = { passive: true } as const;
    el.addEventListener('scroll', onScroll, passive);
    el.addEventListener('wheel', onWheel, passive);
    el.addEventListener('pointerdown', onPointerDown, passive);
    el.addEventListener('touchstart', onTouchStart, passive);
    el.addEventListener('touchmove', onTouchMove, passive);
    doc.addEventListener('keydown', onKeyDown, passive);
    win.addEventListener('pointerup', endDrag, passive);
    win.addEventListener('pointercancel', endDrag, passive);
    win.addEventListener('pointermove', onPointerMove, passive);
    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      doc.removeEventListener('keydown', onKeyDown);
      win.removeEventListener('pointerup', endDrag);
      win.removeEventListener('pointercancel', endDrag);
      win.removeEventListener('pointermove', onPointerMove);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      if (retry.current !== null) clearTimeout(retry.current);
      frame.current = null;
      retry.current = null;
    };
  }, [conversationId, showColumn, schedulePin]);

  return { scrollerRef, columnRef };
}

/** Pin to the bottom, and record the pinned position as the baseline for the next comparison: the scroll event from pinning may have been dispatched before the listener was attached. */
function pinToBottom(el: HTMLElement, state: { current: FollowState }) {
  const max = el.scrollHeight - el.clientHeight;
  // During elastic overscroll (scrollTop beyond the maximum), do nothing and let it bounce back on its own.
  if (el.scrollTop > max + REFOLLOW_PX) return;
  if (el.scrollTop < max) el.scrollTop = max;
  state.current = { ...state.current, lastScrollTop: el.scrollTop };
}

/** When the wheel lands in a nested scroll area that can still scroll up, that area consumes the scroll and it is not passed on to the thread. */
function nestedCanScrollUp(target: EventTarget | null, container: HTMLElement): boolean {
  for (let node = target instanceof Element ? target : null; node && node !== container; node = node.parentElement) {
    if (node.scrollTop <= 0 || node.scrollHeight <= node.clientHeight) continue;
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') return true;
  }
  return false;
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}

/** Video cards and download cards hung after a block (product design §3.2.2): aligned with the reply body, stacked vertically. */
function ThreadCards({ cards, conversationId }: { cards: readonly ThreadCard[]; conversationId: string }) {
  return (
    <div className={messageOutputs} role="group" aria-label={OUTPUT_COPY.messageOutputs}>
      {cards.map((card) =>
        card.kind === 'video' ? (
          <OutputCard key={card.key} output={card.video} conversationId={conversationId} jobIds={card.jobIds} />
        ) : (
          <DownloadCard key={card.key} jobId={card.jobId} />
        ),
      )}
    </div>
  );
}

function Block({
  block,
  conversationId,
  cwd,
  live,
  outputs,
}: {
  block: Exclude<ThreadBlock, { type: 'task' }>;
  conversationId: string;
  cwd?: string | null;
  live: boolean;
  outputs?: ConversationOutput[];
}) {
  switch (block.type) {
    case 'user':
      return <UserMessage item={block.item} conversationId={conversationId} />;
    case 'agent':
      return (
        <>
          <AgentMessage item={block.item} conversationId={conversationId} cwd={cwd} />
          {outputs?.length ? (
            <div className={messageOutputs} role="group" aria-label={OUTPUT_COPY.messageOutputs}>
              {outputs.map((output) => (
                <OutputCard key={output.id} output={output} conversationId={conversationId} />
              ))}
            </div>
          ) : null}
        </>
      );
    case 'steps':
      return <StepsGroup items={block.items} undone={block.undone} live={live} conversationId={conversationId} cwd={cwd} />;
    case 'approval':
      return <ApprovalCard item={block.item} conversationId={conversationId} />;
    case 'notice':
      return <NoticeLine item={block.item} />;
  }
}
