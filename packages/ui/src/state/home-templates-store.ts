import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { shelfAfterPick, type HomeTemplate } from '../model/home-templates.ts';

/**
 * Which templates the start page's template grid shows (prototype prefs.homeTemplates.recent): the ids of recently used templates, recorded on this computer.
 * When read back, the template catalog has not been fetched yet, so only strings are kept here and they are not filtered by the catalog. When shown, `templateShelf(catalog, recent)` filters and fills in.
 * When one is picked, the list is recomputed against the catalog at that time. Keys saved by old versions (`tips`, `anim` and so on) are cleared the first time a template is picked.
 */
interface HomeTemplatesStore {
  recent: string[];
  /** A template was picked: one not in the grid moves to the front. */
  pick(id: string, catalog: readonly HomeTemplate[]): void;
}

/** Only a string array read back counts. Anything else is treated as empty. */
export function recentOf(persisted: unknown): string[] {
  const recent = (persisted as { recent?: unknown } | null)?.recent;
  return Array.isArray(recent) ? recent.filter((k): k is string => typeof k === 'string' && k.length > 0) : [];
}

export const useHomeTemplates = create<HomeTemplatesStore>()(
  persist(
    (set) => ({
      recent: [],
      pick: (id, catalog) => set((s) => ({ recent: shelfAfterPick(catalog, s.recent, id) })),
    }),
    {
      name: 'cuccut.homeTemplates',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ recent: s.recent }),
      merge: (persisted, current) => ({ ...current, recent: recentOf(persisted) }),
    },
  ),
);
