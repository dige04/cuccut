import { create } from 'zustand';
import type { LegacyImportPrompt, LegacyImportRun } from '@cuccut/protocol';

/**
 * Legacy project import (`legacy-import` topic, architecture design §2.7): the startup prompt, and this launch's import progress and result. Only the LegacyImportHost at the shell root
 * subscribes to and writes here (a topic has only one handler). The tasks page, the strip at the top of Home and the rail read from here. Web is always empty.
 */
export interface LegacyImportStore {
  prompt: LegacyImportPrompt | null;
  run: LegacyImportRun | null;
  /** Which result the close button on the strip at the top of Home dismissed (`runId:finishedAt`). A new result (for example, a retry that finished) will show up again. */
  bannerClosed: string | null;
  set(state: { prompt: LegacyImportPrompt | null; run: LegacyImportRun | null }): void;
  closeBanner(key: string): void;
}

export const useLegacyImport = create<LegacyImportStore>()((set) => ({
  prompt: null,
  run: null,
  bannerClosed: null,
  set: ({ prompt, run }) => set({ prompt, run }),
  closeBanner: (key) => set({ bannerClosed: key }),
}));
