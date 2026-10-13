import type { Conversation, Id } from '@cuccut/protocol';
import { ArrowLeft, PanelLeft } from 'lucide-react';
import { cn } from 'cn';
import { untitled } from '../../copy.ts';
import { CHROME_COPY } from '../../cc/components/chrome-copy.ts';
import { SessionSlot } from '../../cc/components/session-slots.tsx';
import { buttonVariants } from '../../cc/ui/button.tsx';
import { Glass } from '../../cc/ui/glass.tsx';
import { shortenPath } from '../../model/format.ts';
import { sessionStatus } from '../../model/sidebar.ts';
import { itemKey, type WorkspaceItem } from '../../model/workspace.ts';
import { useProject } from '../../state/directory-store.ts';
import { HOME, useShell } from '../../state/shell-store.ts';
import { SessionMenu, STATUS_WORD } from '../conversation-header.tsx';
import { WorkspaceTabs } from '../workspace/workspace-tabs.tsx';
import { WorkspaceViewControls } from '../workspace/workspace-view-controls.tsx';
import { HeaderButton } from './header-button.tsx';
import { SESSION_COPY } from './session-copy.ts';
import { SESSIONS_DRAWER_ID } from './sessions-drawer.tsx';

/**
 * The session header (agentcut editor header): one thick glass bar across the window — a capsule on wide windows,
 * a panel that wraps on narrow ones. Left to right: back home, the sessions drawer toggle, the session title with
 * its project or folder underneath, the open tabs as pills, the view controls, whatever the open pane puts in the
 * `header-actions` slot (undo, redo, saved, Render), and the session's ⋯ menu.
 */
export function SessionHeader({
  conversation,
  projectId,
  tabs,
  pane,
  single,
  visible,
}: {
  conversation: Conversation | null;
  projectId: Id | null;
  tabs: WorkspaceItem[];
  pane: WorkspaceItem | null;
  /** One strip (narrow window or full view): the session is the strip's first tab. */
  single: boolean;
  /** The open tab is on screen. */
  visible: boolean;
}) {
  const go = useShell((s) => s.go);
  const drawerOpen = useShell((s) => !s.sidebarHidden);
  const toggleSidebar = useShell((s) => s.toggleSidebar);
  const project = useProject(conversation?.projectId ?? projectId);
  const title = conversation?.title || untitled();
  const status = conversation ? sessionStatus(conversation) : null;
  const word = status === 'running' || status === 'waiting' ? STATUS_WORD[status] : null;
  const where = project ? project.name : conversation ? shortenPath(conversation.cwd) : SESSION_COPY.noProject;
  // In a single strip, showing no tab means the session tab is the one selected.
  const conversationSelected = single && !visible;

  // The draft page has its own heading (StartPage); the session title is the page heading only for a real session.
  const Title = conversation ? 'h1' : 'p';

  return (
    <header data-cc className="cc-drag relative z-20 shrink-0 px-4 pt-4">
      <Glass shape="panel" thickness="thick" className="flex min-h-14 flex-wrap items-center gap-x-2 gap-y-1.5 px-3 py-2 lg:flex-nowrap lg:rounded-full">
        <button
          type="button"
          aria-label={CHROME_COPY.backHome}
          title={CHROME_COPY.backHome}
          onClick={() => go(HOME)}
          className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
          <ArrowLeft className="size-4" />
        </button>
        <HeaderButton
          label={drawerOpen ? SESSION_COPY.hideSessions : SESSION_COPY.showSessions}
          active={drawerOpen}
          aria-expanded={drawerOpen}
          aria-controls={drawerOpen ? SESSIONS_DRAWER_ID : undefined}
          data-sessions-toggle=""
          onClick={toggleSidebar}>
          <PanelLeft />
        </HeaderButton>
        <div className={cn('flex min-w-0 flex-1 flex-col pl-1 lg:min-w-28 lg:flex-initial', tabs.length || single ? 'lg:max-w-48 xl:max-w-64 2xl:max-w-80' : 'lg:max-w-xl')}>
          <Title className="truncate text-sm leading-snug font-medium text-foreground" title={title}>
            {title}
          </Title>
          <p className="truncate text-xs leading-snug text-muted-foreground" title={project?.path ?? conversation?.cwd}>
            {where}
            {word ? (
              <span role="status">
                <span aria-hidden> · </span>
                <span className={status === 'waiting' ? 'text-accent' : 'text-foreground/80'}>{word}</span>
              </span>
            ) : null}
          </p>
        </div>
        {/* The open pane's own title line (e.g. the video's length and size): secondary, after a hairline, and only on
            very wide windows, where it does not take the room the tab pills need. */}
        <SessionSlot
          name="header-title"
          className={cn(
            'flex min-w-0 shrink items-center gap-2 border-l border-white/10 pl-3 text-xs text-muted-foreground empty:hidden max-2xl:hidden',
            !visible && 'hidden',
          )}
        />
        <div
          className={cn(
            'order-last w-full min-w-0 items-center lg:order-none lg:flex lg:w-auto lg:flex-1',
            // A narrow window with nothing open has no second row: the strip would hold only "+".
            tabs.length || single ? 'flex lg:min-w-60 lg:border-l lg:border-white/10 lg:pl-2' : 'hidden',
          )}>
          <WorkspaceTabs
            tabs={tabs}
            active={pane && !conversationSelected ? itemKey(pane) : null}
            conversation={
              single
                ? { title, status: status === 'running' || status === 'waiting' ? status : null, selected: conversationSelected }
                : undefined
            }
          />
        </div>
        {/* View controls, the pane's actions and the session menu; on a phone-width window they wrap inside the glass. */}
        <div className="ml-auto flex max-w-full min-w-0 flex-wrap items-center justify-end gap-1.5">
          <WorkspaceViewControls conversation={conversation} />
          <SessionSlot
            name="header-actions"
            // The pane's row of actions may wrap too, so none of it ends up outside the glass on a narrow window.
            className={cn(
              'cc-no-drag flex min-w-0 flex-wrap items-center justify-end gap-1.5 empty:hidden [&>*]:max-w-full [&>*]:min-w-0 [&>*]:shrink [&>*]:flex-wrap [&>*]:justify-end',
              !visible && 'hidden',
            )}
          />
          {conversation ? (
            <>
              {/* Sets the session's menu apart from the pane's own actions (the editor has a ⋯ of its own). */}
              <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-white/10" />
              <SessionMenu conversation={conversation} />
            </>
          ) : null}
        </div>
      </Glass>
    </header>
  );
}
