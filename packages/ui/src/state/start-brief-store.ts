import { create } from 'zustand';
import { EMPTY_HOME_BRIEF, type HomeBriefState } from '../model/home-brief.ts';

/**
 * Templates and local materials on the start page that have not been sent yet, keyed by the new conversation's draft key (same as the input box's draft).
 * Kept only in this window, not persisted: materials are local paths and, like attached images, follow the window.
 * The start page is remounted per project (when the project changes), so it is kept in the store, and the whole thing is moved over when the project changes.
 */
interface StartBriefStore {
  briefs: Record<string, HomeBriefState>;
  patch(draftKey: string, patch: Partial<HomeBriefState>): void;
  /** Sent: the template and materials have already been written into that message. */
  clear(draftKey: string): void;
  /** Change project: moved to that project's start page along with the input box's text. */
  move(from: string, to: string): void;
}

export const useStartBrief = create<StartBriefStore>()((set) => ({
  briefs: {},
  patch: (draftKey, patch) =>
    set((s) => ({ briefs: { ...s.briefs, [draftKey]: { ...(s.briefs[draftKey] ?? EMPTY_HOME_BRIEF), ...patch } } })),
  clear: (draftKey) =>
    set((s) => {
      if (!(draftKey in s.briefs)) return {};
      const briefs = { ...s.briefs };
      delete briefs[draftKey];
      return { briefs };
    }),
  move: (from, to) =>
    set((s) => {
      const brief = s.briefs[from];
      if (!brief || from === to) return {};
      const briefs = { ...s.briefs, [to]: brief };
      delete briefs[from];
      return { briefs };
    }),
}));

export function useStartBriefOf(draftKey: string): HomeBriefState {
  return useStartBrief((s) => s.briefs[draftKey] ?? EMPTY_HOME_BRIEF);
}
