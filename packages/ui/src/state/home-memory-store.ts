import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Id } from '@cuccut/protocol';

/**
 * The two choices the start page remembers (product design §3.2.1; prototype prefs.newProject's `dir` and `targetName`), recorded on this computer, as with the template grid:
 * - `project`: the project last chosen on the tray, or null for no project. It is recorded only when chosen on the tray. When the project comes from elsewhere (the sidebar's "create a session here"), it applies to that one time only.
 * - `target`: the target language last entered for "transcribe and translate" (the user's own words, not a language code). null if it was never entered.
 * Not put in the Runtime's settings. This is a convenience memory of the interface, and Web sessions cannot change settings either.
 */
interface HomeMemoryStore {
  project: Id | null;
  target: string | null;
  setProject(project: Id | null): void;
  setTarget(target: string): void;
}

/** Only a non-empty string read back counts. Anything else is treated as absent. */
export function memoryOf(persisted: unknown): { project: Id | null; target: string | null } {
  const value = (persisted ?? {}) as { project?: unknown; target?: unknown };
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return { project: text(value.project), target: text(value.target) };
}

export const useHomeMemory = create<HomeMemoryStore>()(
  persist(
    (set) => ({
      project: null,
      target: null,
      setProject: (project) => set({ project }),
      setTarget: (target) => set({ target: target.trim() || null }),
    }),
    {
      name: 'cuccut.homeMemory',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ project: s.project, target: s.target }),
      merge: (persisted, current) => ({ ...current, ...memoryOf(persisted) }),
    },
  ),
);
