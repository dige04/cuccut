import { create } from 'zustand';
import { applySettingsEvent } from '@cuccut/client';
import type { SettingValues, SettingsEvent, SettingsSnapshot } from '@cuccut/protocol';

/** Mirror of preferences (`settings` topic): effective values and defaults for all keys; null until connected. */
export interface SettingsStore {
  snapshot: SettingsSnapshot | null;
  replace(snapshot: SettingsSnapshot): void;
  apply(event: SettingsEvent): void;
}

export const useSettings = create<SettingsStore>()((set) => ({
  snapshot: null,
  replace: (snapshot) => set({ snapshot }),
  apply: (event) => set((s) => (s.snapshot ? { snapshot: applySettingsEvent(s.snapshot, event) } : s)),
}));

/** Effective value of one key; null when the snapshot has not arrived. */
export function useSetting<K extends keyof SettingValues>(key: K): SettingValues[K] | null {
  return useSettings((s) => s.snapshot?.settings[key] ?? null);
}
