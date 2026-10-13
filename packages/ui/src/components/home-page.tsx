import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Id } from '@cuccut/protocol';
import { cn } from 'cn';
import { WORKSPACE_COPY } from '../copy.ts';
import { SessionSlot, SessionSlotsProvider } from '../cc/components/session-slots.tsx';
import {
  CONVERSATION_TAB,
  DEFAULT_VIEW,
  DOCK_DEFAULT,
  DOCK_MIN,
  EDITOR_MIN_WIDTH,
  PANE_MIN_WIDTH,
  dockFor,
  isNarrow,
  itemKey,
  workspaceKey,
  workspaceMode,
  type WorkspaceItem,
} from '../model/workspace.ts';
import { useConversationMeta } from '../state/directory-store.ts';
import { useShell } from '../state/shell-store.ts';
import { ConversationView } from './conversation-view.tsx';
import { HomeLanding } from './home-landing.tsx';
import { SESSION_COPY } from './session/session-copy.ts';
import { SessionHeader } from './session/session-header.tsx';
import { SessionsDrawer, useDrawerInline } from './session/sessions-drawer.tsx';
import { StartPage } from './start-page.tsx';
import { useWorkspaceOverlay } from './workspace/workspace-overlay.ts';
import { WorkspacePanes } from './workspace/workspace-panes.tsx';
import { workspacePanelId, workspaceTabId } from './workspace/workspace-tabs.tsx';

const NO_TABS: WorkspaceItem[] = [];

/** A solid content card (agentcut: content surfaces stay solid, 24px corners). */
const card = 'overflow-hidden rounded-3xl border border-border/60 bg-card';
/** The inspector's own column in a single strip (beside the open tab, when the window has room for both). */
const INSPECTOR_WIDTH = 340;

/**
 * Home: the landing page while nothing is open; otherwise the session layout (agentcut editor frame). A glass header
 * runs across the top; under it, 16px apart, an optional sessions drawer on the left, the open tab (video editor,
 * file, web page) in the centre, and on the right the conversation with the selection inspector under it.
 * With no tab on screen the conversation takes the centre at a reading width (agentcut /chat).
 * Narrow windows and full view keep one strip of tabs in the header (the session is its first tab) and show either the
 * session or one tab; the side not shown stays mounted (draft, scroll position, editor state).
 */
export function HomePage({ conversationId, projectId, pane }: {
  conversationId: Id | null;
  projectId: Id | null;
  pane: WorkspaceItem | null;
  /** Unused; AppShell still passes it. */
  platform?: string;
}) {
  const landingTabs = useShell((s) => s.workspaces[workspaceKey(null, null)]?.tabs.length ?? 0);
  // Nothing open yet: the landing page. A session, a project or an open tab gets the session layout.
  if (!conversationId && !projectId && !pane && landingTabs === 0) return <HomeLanding />;
  return (
    <SessionSlotsProvider>
      <HomeSession conversationId={conversationId} projectId={projectId} pane={pane} />
    </SessionSlotsProvider>
  );
}

function HomeSession({ conversationId, projectId, pane }: {
  conversationId: Id | null;
  projectId: Id | null;
  pane: WorkspaceItem | null;
}) {
  const book = workspaceKey(conversationId, projectId);
  const tabs = useShell((s) => s.workspaces[book]?.tabs ?? NO_TABS);
  const view = useShell((s) => s.views[book] ?? DEFAULT_VIEW);
  const narrow = useShell((s) => s.workspaceNarrow);
  const dockWidth = useShell((s) => s.dockWidth);
  const drawerInline = useDrawerInline();
  const meta = useConversationMeta(conversationId) ?? null;
  const columnRef = useRef<HTMLDivElement | null>(null);
  const measured = useRef(false);
  const [contentWidth, setContentWidth] = useState(0);
  const [contentElement, setContentElement] = useState<HTMLDivElement | null>(null);
  const [inspectorElement, setInspectorElement] = useState<HTMLElement | null>(null);
  const inspectorFilled = useSlotHasContent(inspectorElement);

  const { visible, single } = workspaceMode({ active: pane ? itemKey(pane) : null, count: tabs.length, view, narrow });
  const docked = visible && !single;
  // In a single strip, a tab on screen means the session tab is not selected.
  const conversationHidden = visible && single;
  // Where the open pane's inspector goes: under the conversation beside the tab, or in a single strip in a column of
  // its own when the window still fits the editor beside it (full view on a wide window). Otherwise the layout offers
  // no inspector slot and the pane keeps its inspector in place (IntoSessionSlot's fallback).
  const inspectorSlot = docked || (conversationHidden && contentWidth >= EDITOR_MIN_WIDTH + INSPECTOR_WIDTH + 16);
  // The right column: beside the open tab (docked); alone in a single strip only when the inspector has something.
  const columnHidden = conversationHidden && !(inspectorSlot && inspectorFilled);

  // The content area is narrow when it cannot fit the narrowest session column beside the editor. The first measure
  // only records the mode (a deep link in a narrow window still shows its tab); later, switching from side by side to
  // one strip selects the session tab when focus is inside the conversation.
  useLayoutEffect(() => {
    if (!contentElement) return;
    const sync = () => {
      const initial = !measured.current;
      measured.current = true;
      const width = contentElement.getBoundingClientRect().width;
      setContentWidth(width);
      useShell.getState().setWorkspaceNarrow(isNarrow(width), {
        initial,
        focusInConversation: !!document.activeElement?.closest('[data-home-conversation]'),
      });
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(contentElement);
    return () => observer.disconnect();
  }, [contentElement]);

  const draft = !conversationId;
  const conversation = conversationId ? (
    <ConversationView key={conversationId} conversationId={conversationId} />
  ) : (
    <StartPage key={projectId ?? 'none'} projectId={projectId} />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SessionHeader conversation={meta} projectId={projectId} tabs={tabs} pane={pane} single={single} visible={visible} />
      <div className="relative flex min-h-0 flex-1 gap-4 p-4">
        <SessionsDrawer inline={drawerInline} />
        <div ref={setContentElement} className="relative flex min-h-0 min-w-0 flex-1 gap-4">
          <WorkspacePanes conversationId={conversationId} book={book} tabs={tabs} active={pane ? itemKey(pane) : null} visible={visible} />
          <DockSeam key={book} column={columnRef} width={dockWidth} contentWidth={contentWidth} enabled={docked} />
          <div
            ref={columnRef}
            className={cn(
              'flex min-h-0 flex-col gap-4',
              docked ? 'max-w-[calc(100%-20rem)] min-w-80 shrink-0' : conversationHidden ? 'w-[340px] shrink-0' : 'min-w-0 flex-1 items-center',
              columnHidden && 'hidden',
            )}
            style={docked ? { width: dockWidth } : undefined}>
            <section
              className={cn(
                'flex min-h-0 w-full flex-1 flex-col',
                docked ? cn(card, 'min-h-64') : draft ? 'cc-scroll overflow-y-auto' : 'max-w-3xl',
                docked && draft && 'cc-scroll overflow-y-auto',
                conversationHidden && 'hidden',
              )}
              data-home-conversation
              {...(single
                ? { id: workspacePanelId(CONVERSATION_TAB), role: 'tabpanel', 'aria-labelledby': workspaceTabId(CONVERSATION_TAB) }
                : { 'aria-label': WORKSPACE_COPY.conversation })}>
              {conversation}
            </section>
            {/* The open pane's selection inspector portals here (agentcut: the right column is about the selection); the
                pane brings its own cards. Empty, it takes no room. */}
            {inspectorSlot ? (
              <section
                ref={setInspectorElement}
                aria-label={SESSION_COPY.inspector}
                className={cn('flex min-h-0 w-full shrink-0 flex-col', conversationHidden ? 'max-h-full' : 'max-h-[40%]', !inspectorFilled && 'hidden')}>
                <SessionSlot name="inspector" className="cc-scroll flex max-h-full min-h-0 flex-col gap-3 overflow-y-auto empty:hidden" />
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Whether something is rendered into the session slot inside `container` (the slot element has children). Follows
 * the slot element being replaced and portals coming and going.
 */
function useSlotHasContent(container: HTMLElement | null): boolean {
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    if (!container) {
      setFilled(false);
      return;
    }
    let slot: Element | null = null;
    const check = () => setFilled(!!slot && slot.childElementCount > 0);
    const content = new MutationObserver(check);
    const find = () => {
      const next = container.querySelector('[data-session-slot]');
      if (next !== slot) {
        content.disconnect();
        slot = next;
        if (slot) content.observe(slot, { childList: true });
      }
      check();
    };
    const structure = new MutationObserver(find);
    structure.observe(container, { childList: true });
    find();
    return () => {
      structure.disconnect();
      content.disconnect();
    };
  }, [container]);
  return filled;
}

/**
 * The seam between the open tab and the conversation column: drag it (or use ←/→) to resize the column, which sits on
 * the right, so dragging left widens it; dragging far enough collapses the tab. It stays mounted until the gesture ends
 * so the same drag can bring the tab back; a double click restores the default width.
 */
function DockSeam({ column, width, contentWidth, enabled }: {
  column: { current: HTMLElement | null }; width: number; contentWidth: number; enabled: boolean;
}) {
  const start = useRef<{ x: number; width: number; pointerId: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  // While dragging, count as an overlay so Electron's native web views step aside instead of swallowing the drag.
  useWorkspaceOverlay(dragging);
  const resize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const from = start.current;
    if (from?.pointerId === event.pointerId) useShell.getState().resizeWorkspace(from.width - (event.clientX - from.x), contentWidth);
  };
  const end = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (start.current?.pointerId !== event.pointerId) return;
    start.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  if (!enabled && !dragging) return null;
  return <>
    <div
      className="group/seam relative -mx-4 w-4 shrink-0 cursor-col-resize touch-none self-stretch outline-none"
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={WORKSPACE_COPY.resize}
      aria-valuemin={DOCK_MIN}
      aria-valuemax={Math.max(DOCK_MIN, contentWidth - PANE_MIN_WIDTH)}
      aria-valuenow={dockFor(contentWidth, width)}
      onPointerDown={(event) => {
        if (event.button !== 0 || start.current) return;
        event.preventDefault();
        start.current = { x: event.clientX, width: column.current?.getBoundingClientRect().width ?? dockFor(contentWidth, width), pointerId: event.pointerId };
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (event.buttons === 0) end(event);
        else resize(event);
      }}
      onPointerUp={(event) => {
        // A fast drag can coalesce pointermove events; still apply the release position.
        resize(event);
        end(event);
      }}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        useShell.getState().resizeWorkspace(dockFor(contentWidth, width) + (event.key === 'ArrowLeft' ? 10 : -10), contentWidth);
      }}
      onDoubleClick={() => useShell.getState().setDockWidth(DOCK_DEFAULT)}>
      <div
        className={cn(
          'absolute inset-y-8 left-1/2 w-0.5 -translate-x-1/2 rounded-full transition-colors motion-reduce:transition-none',
          dragging ? 'bg-white/40' : 'bg-transparent group-hover/seam:bg-white/20 group-focus-visible/seam:bg-ring',
        )}
      />
    </div>
    {dragging ? createPortal(<div className="cc-no-drag fixed inset-0 z-[10000] cursor-col-resize select-none" aria-hidden="true" />, document.body) : null}
  </>;
}
