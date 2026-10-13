import { create } from 'zustand';

/**
 * Opening and closing the help center (prototype shell.jsx:210-231). It lives only in the shell. The title-bar question mark, F1, and "Help" in the settings left column all open it through here.
 * The focus before opening is recorded in `origin`. When an S2 popover closes, it returns focus by itself, so here it is only a fallback for when that did not happen (see help-center).
 *
 * The prototype also pauses the editor's playback and collapses the editor's popovers when opened. Pausing is not done here: the editor's pause exists only in VideoEditor's
 * EditorContext, which the shell cannot reach (`playing` in editor-store is display-only, and changing it does not stop the preview engine). While help is open,
 * the editor's keys are already blocked by `[role="dialog"]`, but the picture keeps playing. The editor's popovers are all dialogs or menus. While they are open, F1 does not respond and
 * the title-bar button cannot be clicked, so no separate handling is needed.
 */
export interface HelpStore {
  isOpen: boolean;
  /** Which opening this is. Each opening starts again from the quick start (the prototype unmounts it on close), and the help center changes its key with it. */
  session: number;
  origin: HTMLElement | null;
  open(origin?: Element | null): void;
  close(): void;
}

export const useHelp = create<HelpStore>()((set) => ({
  isOpen: false,
  session: 0,
  origin: null,
  open: (origin) => {
    const from = origin ?? (typeof document !== 'undefined' ? document.activeElement : null);
    set((s) => ({
      isOpen: true,
      session: s.isOpen ? s.session : s.session + 1,
      origin: typeof HTMLElement !== 'undefined' && from instanceof HTMLElement ? from : null,
    }));
  },
  close: () => set({ isOpen: false }),
}));
