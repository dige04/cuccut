import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Conversation } from '@cuccut/protocol';
import { Popover } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { Columns2, ListChecks, Maximize2, Minimize2 } from 'lucide-react';
import { WORKSPACE_COPY, untitled } from '../../copy.ts';
import { conversationOutputs } from '../../model/conversation-outputs.ts';
import { sessionStatus } from '../../model/sidebar.ts';
import { conversationVideoJobs } from '../../model/video-cards.ts';
import { homeMode, useShell } from '../../state/shell-store.ts';
import { useSpace } from '../../state/space-store.ts';
import { useTimelineItems } from '../../state/timeline-store.ts';
import { STATUS_WORD } from '../conversation-header.tsx';
import { HeaderButton } from '../session/header-button.tsx';
import { S } from '../shell-copy.ts';
import { OutputCard } from '../thread/output-card.tsx';
import { useJobsForPlacement } from '../thread/video-card-rows.tsx';

/**
 * The view controls in the session header: the session summary, split view (the open tab beside the session, or the
 * session alone) and full view (one strip, the session as its first tab). The tabs themselves are pills in the same
 * header, so there is no separate tab list here; a new tab comes from the strip's "+". The toggles' labels say what a
 * press does next, so they carry no pressed state for assistive technology (the fill shows it visually).
 */
export function WorkspaceViewControls({ conversation }: { conversation: Conversation | null }) {
  const mode = useShell(useShallow(homeMode));
  const narrow = useShell((s) => s.workspaceNarrow);
  const { toggleWorkspace, toggleWorkspaceFull } = useShell.getState();
  if (!mode) return null;
  const hasTabs = mode.count > 0;
  // Split view toggles the open tab beside the session; it does not apply in a single strip (narrow or full).
  const split = hasTabs && !mode.single;
  const full = hasTabs && !narrow;
  if (!conversation && !split && !full) return null;
  return (
    <div className="cc-no-drag flex shrink-0 items-center gap-0.5" role="group" aria-label={WORKSPACE_COPY.viewGroup}>
      {conversation ? <SessionSummaryButton conversation={conversation} /> : null}
      {split ? (
        <HeaderButton label={mode.visible ? S.titleBar.hideTabs : S.titleBar.showTabs} active={mode.visible} onClick={toggleWorkspace}>
          <Columns2 />
        </HeaderButton>
      ) : null}
      {full ? (
        <HeaderButton label={mode.full ? S.titleBar.exitFull : S.titleBar.enterFull} active={mode.full} onClick={toggleWorkspaceFull}>
          {mode.full ? <Minimize2 /> : <Maximize2 />}
        </HeaderButton>
      ) : null}
    </div>
  );
}

const summary = style({ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 480, padding: 16, overflowY: 'auto', boxSizing: 'border-box' });
const summaryTitle = style({ margin: 0, font: 'title', color: 'gray-900', overflowWrap: 'anywhere' });
const summaryStatus = style({
  alignSelf: 'start',
  margin: 0,
  paddingX: 8,
  borderRadius: 'full',
  backgroundColor: { default: 'informative-subtle', isWaiting: 'notice-subtle' },
  font: 'ui-xs',
  color: 'gray-900',
  lineHeight: '[20px]',
});
const summarySection = style({ marginTop: 8, marginBottom: 0, font: 'ui-xs', fontWeight: 'bold', color: 'gray-600' });
const summaryEmpty = style({ margin: 0, font: 'ui-xs', color: 'gray-600' });

/**
 * The session summary: title, working / waiting for approval, and what the session produced (the same cards as in
 * the thread, thread/output-card.tsx).
 */
export function SessionSummaryButton({ conversation }: { conversation: Conversation }) {
  const items = useTimelineItems(conversation.id);
  const entries = useSpace((s) => s.entries);
  const jobs = useJobsForPlacement();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => setOpen(false), [conversation.id]);
  const outputs = conversationOutputs(conversation, items, entries, undefined, jobs);
  const status = sessionStatus(conversation);
  const word = status === 'running' || status === 'waiting' ? STATUS_WORD[status] : null;
  return (
    <>
      <HeaderButton
        ref={trigger}
        label={S.titleBar.summary}
        active={open}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}>
        <ListChecks />
      </HeaderButton>
      <Popover
        isOpen={open}
        onOpenChange={setOpen}
        triggerRef={trigger}
        placement="bottom end"
        hideArrow
        padding="none"
        UNSAFE_className="cc-no-drag"
        styles={style({ width: 360 })}>
        <section className={summary} aria-label={S.titleBar.summary}>
          <h2 className={summaryTitle}>{conversation.title || untitled()}</h2>
          {word ? (
            <p className={summaryStatus({ isWaiting: status === 'waiting' })} role="status">
              {word}
            </p>
          ) : null}
          <h3 className={summarySection}>{S.titleBar.summaryOutputs(outputs.length)}</h3>
          {outputs.map((output) => (
            <OutputCard
              key={output.id}
              output={output}
              conversationId={conversation.id}
              placement="popover"
              jobIds={output.kind === 'video' ? conversationVideoJobs(output.id, jobs, conversation.id) : undefined}
              onOpen={() => setOpen(false)}
            />
          ))}
          {!outputs.length ? <p className={summaryEmpty}>{S.titleBar.summaryEmpty}</p> : null}
        </section>
      </Popover>
    </>
  );
}
