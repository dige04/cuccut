import { create } from 'zustand';
import type { AppUpdateSnapshot } from '../host.ts';

/**
 * UI state for app auto-update (design draft settings-update.jsx `AppUpdateProvider`): a mirror of the snapshot pushed by the main process, plus UI-only
 * open and close state: the update window, the confirmation dialog for the stop barrier, and "install after tasks finish". The state machine lives in the main process and is not re-derived here. When the host has no `updates` surface,
 * `snapshot` stays null and no update-related UI appears at all.
 *
 * "Install after tasks finish" is recorded only here: refreshing the window or reopening the app cancels the wait. The downloaded package is still there, so clicking "Restart and update" tries again.
 */
export interface AppUpdateStore {
  snapshot: AppUpdateSnapshot | null;
  windowOpen: boolean;
  /** The element that opened the update window: focus returns to it after the window closes (the button on the rail). */
  origin: HTMLElement | null;
  barrierOpen: boolean;
  waiting: boolean;
  setSnapshot(snapshot: AppUpdateSnapshot): void;
  openWindow(origin?: Element | null): void;
  closeWindow(): void;
  openBarrier(): void;
  closeBarrier(): void;
  setWaiting(waiting: boolean): void;
}

export const useAppUpdate = create<AppUpdateStore>()((set, get) => ({
  snapshot: null,
  windowOpen: false,
  origin: null,
  barrierOpen: false,
  waiting: false,
  setSnapshot: (snapshot) => set({ snapshot }),
  openWindow: (origin) => set({ windowOpen: true, origin: typeof HTMLElement !== 'undefined' && origin instanceof HTMLElement ? origin : null }),
  closeWindow: () => {
    const origin = get().origin;
    set({ windowOpen: false, origin: null });
    if (origin?.isConnected) setTimeout(() => origin.focus(), 0);
  },
  openBarrier: () => set({ barrierOpen: true }),
  closeBarrier: () => set({ barrierOpen: false }),
  setWaiting: (waiting) => set({ waiting }),
}));
