import { useEffect, useRef, useState } from 'react';
import { cn } from 'cn';
import { hrefFor, useShell } from '../../state/shell-store.ts';
import { HomeSidebar } from '../home-sidebar.tsx';
import { useWorkspaceOverlay } from '../workspace/workspace-overlay.ts';

/** The drawer's element id (the header toggle points at it with aria-controls). */
export const SESSIONS_DRAWER_ID = 'cc-sessions-drawer';

/**
 * From this window width the drawer sits beside the session (pushing the layout) and the content still fits the open
 * tab beside the conversation column: 16px gutters, the 288px drawer and its 16px gap, plus `DOCK_MIN +
 * EDITOR_MIN_WIDTH` (model/workspace.ts `isNarrow`). Narrower windows show the drawer over the content instead.
 */
const INLINE_QUERY = '(min-width: 1360px)';

/** Whether the window is wide enough for the sessions drawer to sit inline. */
export function useDrawerInline(): boolean {
  const [inline, setInline] = useState(() => typeof window !== 'undefined' && window.matchMedia(INLINE_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia(INLINE_QUERY);
    const sync = () => setInline(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  return inline;
}

function closeDrawer() {
  const shell = useShell.getState();
  if (!shell.sidebarHidden) shell.toggleSidebar();
}

/**
 * The sessions drawer (agentcut ProjectList as a solid card), opened from the session header and remembered with the
 * sidebar flag. On wide windows it sits inline at the left of the session layout. On narrower ones it floats over
 * the content inside the gutters, behind it a scrim: a click on the scrim, Escape or opening another page closes it,
 * focus moves into it when it opens and back to the header toggle when it is dismissed. An overlay drawer is
 * transient, so one left open (or remembered open from a wider window) closes when the session layout opens.
 */
export function SessionsDrawer({ inline }: { inline: boolean }) {
  const open = useShell((s) => !s.sidebarHidden);
  const routeKey = useShell((s) => hrefFor(s.route));
  const overlay = open && !inline;
  const panel = useRef<HTMLDivElement>(null);
  // Electron's native web views draw above the DOM; while the drawer floats over a web tab they step aside.
  useWorkspaceOverlay(overlay);

  // Overlay mode: a new page (including the session layout opening) dismisses the drawer.
  useEffect(() => {
    if (!inline) closeDrawer();
  }, [inline, routeKey]);

  // Overlay mode: move focus into the drawer when it opens.
  useEffect(() => {
    if (!overlay) return;
    const frame = requestAnimationFrame(() => {
      const target = panel.current?.querySelector<HTMLElement>('[data-drawer-focus]') ?? panel.current;
      target?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [overlay]);

  if (!open) return null;

  const dismiss = () => {
    closeDrawer();
    document.querySelector<HTMLElement>('[data-sessions-toggle]')?.focus();
  };

  return (
    <>
      {overlay ? (
        <div aria-hidden className="absolute inset-0 z-20 bg-black/45 motion-safe:animate-in motion-safe:fade-in-0" onPointerDown={dismiss} />
      ) : null}
      <div
        ref={panel}
        id={SESSIONS_DRAWER_ID}
        tabIndex={-1}
        className={cn('flex min-h-0 shrink-0 outline-none', overlay && 'absolute inset-y-4 left-4 z-30 max-w-[calc(100%-2rem)] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-4')}
        onKeyDown={(event) => {
          // Menus and dialogs opened from the drawer handle their own Escape first.
          if (!overlay || event.key !== 'Escape' || event.defaultPrevented) return;
          event.preventDefault();
          dismiss();
        }}>
        <HomeSidebar className={cn(overlay && 'shadow-(--glass-shadow-raised)')} />
      </div>
    </>
  );
}
