import { useEffect } from 'react';
import { ToastQueue } from '@react-spectrum/s2';
import { QUEUE_COPY } from '../copy.ts';
import { useRuntime } from '../runtime/context.tsx';
import { startQueueRunner } from '../runtime/message-queue-runner.ts';
import { shellShortcut } from '../model/shell-shortcuts.ts';
import { isVideoReferenced, targetKey } from '../model/workspace.ts';
import { useHelp } from '../state/help-store.ts';
import { HOME, hasSidebar, routeVideo, useShell } from '../state/shell-store.ts';
import { useVideo } from '../state/video-store.ts';
import { AppUpdateHost } from './app-update/app-update-host.tsx';
import { CalendarPage } from './publishing/calendar-page.tsx';
import { PublishingDialogsHost, PublishingDueHost } from './publishing/publishing-hosts.tsx';
import { LegacyImportHost } from './legacy-import/legacy-import-host.tsx';
import { ConnectionBanner } from './connection-banner.tsx';
import { HelpCenter } from './help/help-center.tsx';
import { HomePage } from './home-page.tsx';
import { ServicesPage } from './services-page.tsx';
import { SettingsPage } from './settings-page.tsx';
import { SpacePage } from './space/space-page.tsx';
import { TasksPage } from './tasks-page.tsx';
import { ToolsPage } from './tools-page.tsx';
import { Ambient } from '../cc/components/ambient.tsx';
import { WindowStrip } from '../cc/components/page-chrome.tsx';

export function AppShell({ platform }: { platform: string }) {
  const runtime = useRuntime();
  const route = useShell((s) => s.route);
  const video = routeVideo(route);

  // The open video follows the route: switching between Home and Space does not reopen the same video; when the route changes to a different video, opening it first closes the old one.
  // When the route has no video (switching to a file tab, switching session, collapsing the right panel, or going to another entry), it is not closed as long as any session's panel tab still references it——
  // the editor keeps its selection, playhead and undo stack, so switching back does not reopen it; it is closed only once all video tabs are closed, and the Runtime releases it after it has no opener.
  const videoKey = video ? JSON.stringify(video) : null;
  const openKey = useVideo((s) => (s.video ? targetKey(s.video.target) : null));
  const referenced = useShell((s) => openKey !== null && isVideoReferenced(s.workspaces, openKey));
  useEffect(() => {
    if (video) runtime.videos.open(video);
    else if (!referenced) runtime.videos.close();
  }, [runtime, videoKey, referenced]);

  // Messages queued while busy: when a session's task finishes, its first queued message is sent, regardless of which page is currently shown.
  useEffect(() => startQueueRunner(runtime, (message) => ToastQueue.negative(QUEUE_COPY.failed(message), { timeout: 5000 })), [runtime]);

  // Global shortcuts (prototype main.jsx): ⌘[ / ⌘] go back and forward (Alt+←/→ on Windows and Linux), ⌘N new session, ⇧⌘H Space,
  // ⇧⌘B background tasks, ⌘, settings, ⌃⌘S toggles the sidebar. On Windows and Linux, ⌘ becomes Ctrl.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const action = shellShortcut(event, platform === 'darwin');
      if (!action) return;
      event.preventDefault();
      const shell = useShell.getState();
      if (action === 'back') shell.goBack();
      else if (action === 'forward') shell.goForward();
      else if (action === 'new') shell.go(HOME);
      else if (action === 'space') shell.goTab('space');
      else if (action === 'tasks') shell.goTab('tasks');
      else if (action === 'settings') shell.goTab('settings');
      else if (action === 'sidebar' && hasSidebar(shell.route)) shell.toggleSidebar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [platform]);

  // F1 opens the help center (prototype shell.jsx): it does nothing while a dialog, menu or dropdown is already open (help is itself a dialog, so pressing F1 while it is open does not open it again).
  // Toasts also carry alertdialog, but they sit in the notification region, so they do not count as a dialog blocking F1.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'F1' || event.defaultPrevented) return;
      if (document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]') || hasAlertDialog()) return;
      event.preventDefault();
      useHelp.getState().open();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      {/* The frame (agentcut layout): ambient light behind everything, the macOS window strip, then one page. Each page
          draws its own glass header — the navigation bar on the landing page, a back header everywhere else. */}
      <div className="relative isolate flex h-full flex-col font-sans text-foreground">
        <Ambient />
        <WindowStrip platform={platform} />
        <ConnectionBanner />
        <main className="relative flex min-h-0 flex-1 flex-col">
          {route.tab === 'home' ? (
            <HomePage conversationId={route.conversationId} projectId={route.projectId} pane={route.pane ?? null} platform={platform} />
          ) : route.tab === 'space' ? (
            <SpacePage category={route.category} projectId={route.projectId} video={route.video ?? null} from={route.from ?? null} />
          ) : route.tab === 'calendar' ? (
            <CalendarPage route={route} />
          ) : route.tab === 'tasks' ? (
            <TasksPage taskId={route.taskId} />
          ) : route.tab === 'services' ? (
            <ServicesPage service={route.service} />
          ) : route.tab === 'settings' ? (
            <SettingsPage section={route.section} platform={platform} />
          ) : route.tab === 'models' ? (
            <SettingsPage model={route} platform={platform} />
          ) : (
            <ToolsPage tool={route.tool} />
          )}
        </main>
        <HelpCenter platform={platform} />
        {/* App updates: the main process's status is still received and toasts still appear after leaving the settings page; the update window and stop barrier are also mounted here. */}
        <AppUpdateHost />
        {/* Publishing: reminders for by-hand posts (toasts with Open) and the publication and batch dialogs opened from the editor, the library and the shorts result page. */}
        <PublishingDueHost />
        <PublishingDialogsHost />
        {/* Startup prompt to import legacy projects: asked once when the Runtime finds legacy projects that have not been imported and no decision has been recorded (the web does not ask). */}
        <LegacyImportHost />
      </div>
    </>
  );
}

/** A confirmation dialog that is actually open (S2 AlertDialog); Toasts in the notification region are also alertdialogs, but they do not count. */
function hasAlertDialog(): boolean {
  return Array.from(document.querySelectorAll('[role="alertdialog"]')).some((el) => !el.closest('[role="region"]'));
}
