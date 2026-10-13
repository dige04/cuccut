import { useEffect } from 'react';
import { ToastQueue } from '@react-spectrum/s2';
import type { AppUpdateNotice } from '../../host.ts';
import { availableToast, dialog, NOTES_LANG, readyToast, sideButton } from '../../model/app-update.ts';
import { useRuntime } from '../../runtime/context.tsx';
import type { RuntimeSession } from '../../runtime/session.ts';
import { useAppUpdate } from '../../state/app-update-store.ts';
import { useSetting } from '../../state/settings-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { InstallBarrier } from './install-barrier.tsx';
import { UpdateWindow } from './update-window.tsx';
import { installNow, requestRestart } from './use-update-actions.ts';
import { useWaitingCount } from './use-waiting-count.ts';

/*
 * Host for app updates (design settings-update.jsx `AppUpdateProvider`): mounted on the shell root, so the main process's status is still received and toasts still appear after leaving the settings page.
 * It puts the snapshots pushed from the main process into `useAppUpdate`, pushes the `updates.autoCheck` / `updates.autoDownload` held by the Runtime to the main process,
 * opens and closes the update window and the stop barrier, and when “等任务结束后安装” (install after tasks finish) is selected, counts the tasks and installs once the count reaches zero. When the host has no `updates` surface (the web), it does nothing.
 */

const TOAST_TIMEOUT = 10_000;

/** Toast “查看” (view): opens the update window if it can in this state; if it cannot (the state has already changed), goes to 设置 › 关于 (Settings › About). */
function openUpdate(): void {
  const state = useAppUpdate.getState().snapshot?.state;
  if (state && sideButton(state).visible) useAppUpdate.getState().openWindow();
  else useShell.getState().go({ tab: 'settings', section: 'about' });
}

function showNotice(runtime: RuntimeSession, notice: AppUpdateNotice): void {
  if (notice.kind === 'ready') {
    const t = readyToast(notice.info);
    ToastQueue.positive(t.text, { timeout: TOAST_TIMEOUT, actionLabel: t.action, onAction: () => requestRestart(runtime), shouldCloseOnAction: true });
  } else {
    const t = availableToast(notice.info);
    ToastQueue.info(t.text, { timeout: TOAST_TIMEOUT, actionLabel: t.action, onAction: openUpdate, shouldCloseOnAction: true });
  }
}

export function AppUpdateHost() {
  const runtime = useRuntime();
  const updates = runtime.host.updates;
  const setSnapshot = useAppUpdate((s) => s.setSnapshot);

  // State mirror and reminders. Subscribe first, then fetch once: if a new state was already pushed before the fetch returns, the fetched copy is discarded.
  useEffect(() => {
    if (!updates) return;
    let alive = true;
    let pushed = false;
    const offState = updates.onState((snapshot) => {
      pushed = true;
      setSnapshot(snapshot);
    });
    const offNotice = updates.onNotice((notice) => showNotice(runtime, notice));
    updates.get().then(
      (snapshot) => {
        if (alive && !pushed) setSnapshot(snapshot);
      },
      () => {},
    );
    return () => {
      alive = false;
      offState();
      offNotice();
    };
  }, [runtime, updates, setSnapshot]);

  // Preferences live in the Runtime: they are pushed only once the settings mirror has arrived; the main process does not check automatically until it receives them.
  const autoCheck = useSetting('updates.autoCheck');
  const autoDownload = useSetting('updates.autoDownload');
  useEffect(() => {
    if (!updates || autoCheck === null || autoDownload === null) return;
    updates.configure({ autoCheck, autoDownload });
  }, [updates, autoCheck, autoDownload]);

  const snapshot = useAppUpdate((s) => s.snapshot);
  const windowOpen = useAppUpdate((s) => s.windowOpen);
  const closeWindow = useAppUpdate((s) => s.closeWindow);
  const waitingFor = useWaitingCount();
  const view = snapshot ? dialog(snapshot.state, { lang: NOTES_LANG, current: snapshot.current, waiting: waitingFor }) : null;

  // The window stays open only in the states where the rail button should show: when it changes to states such as installing, idle or check failed, it closes itself.
  const viewable = view !== null;
  useEffect(() => {
    if (windowOpen && !viewable) closeWindow();
  }, [windowOpen, viewable, closeWindow]);

  // “等任务结束后安装” (install after tasks finish): while the package is still there, wait; when the task count reaches zero, install. If the package is gone (canceled, errored, or rechecked), stop waiting.
  const stateKind = snapshot?.state.k ?? null;
  useEffect(() => {
    if (waitingFor === null) return;
    if (stateKind !== 'ready' && stateKind !== 'installing') useAppUpdate.getState().setWaiting(false);
    else if (stateKind === 'ready' && waitingFor === 0) installNow(runtime);
  }, [runtime, stateKind, waitingFor]);

  if (!updates) return null;
  return (
    <>
      <UpdateWindow open={windowOpen} view={view} onClose={closeWindow} />
      <InstallBarrier />
    </>
  );
}
