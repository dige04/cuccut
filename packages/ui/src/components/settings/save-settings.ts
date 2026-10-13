import { useCallback } from 'react';
import type { SettingInputValues, SettingKey } from '@cuccut/protocol';
import { ToastQueue } from '@react-spectrum/s2';
import { useRuntime } from '../../runtime/context.tsx';
import { useConnection } from '../../state/connection-store.ts';
import { useSettings } from '../../state/settings-store.ts';
import { M } from './general-settings-copy.ts';

/* Shared across the settings page for writing settings and deciding whether something can be changed. General, Fonts and the local model download source all use them. */

export type SettingsPatch = { [K in SettingKey]?: SettingInputValues[K] | null };

/** Writes a setting: on failure, shows the reason; returns whether it was written. */
export function useSaveSettings(): (values: SettingsPatch, done?: string) => Promise<boolean> {
  const runtime = useRuntime();
  return useCallback(
    async (values: SettingsPatch, done?: string) => {
      try {
        await runtime.client.request('settings.set', { values });
        if (done) ToastQueue.positive(done, { timeout: 3000 });
        return true;
      } catch (error) {
        ToastQueue.negative(M.saveFailed((error as Error).message), { timeout: 5000 });
        return false;
      }
    },
    [runtime],
  );
}

/** Connected to the Runtime and the settings mirror has arrived: can be changed. */
export function useSettingsReady(): boolean {
  const connected = useConnection((s) => s.state.status === 'connected');
  const loaded = useSettings((s) => s.snapshot !== null);
  return connected && loaded;
}
