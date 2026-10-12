import { useCallback } from 'react';
import type { SettingInputValues, SettingKey } from '@cuccut/protocol';
import { ToastQueue } from '@react-spectrum/s2';
import { useRuntime } from '../../runtime/context.tsx';
import { useConnection } from '../../state/connection-store.ts';
import { useSettings } from '../../state/settings-store.ts';
import { M } from './general-settings-copy.ts';

/* 设置页各处共用的写设置与「能不能改」：通用、字体与本地模型的下载来源都用它们。 */

export type SettingsPatch = { [K in SettingKey]?: SettingInputValues[K] | null };

/** 写设置：失败时提示原因，返回是否写成。 */
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

/** 连上了 Runtime、设置镜像也到了：能改。 */
export function useSettingsReady(): boolean {
  const connected = useConnection((s) => s.state.status === 'connected');
  const loaded = useSettings((s) => s.snapshot !== null);
  return connected && loaded;
}
