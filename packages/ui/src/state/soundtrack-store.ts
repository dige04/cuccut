import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Id } from '@cuccut/protocol';

/**
 * 「生成配乐」做好后自动铺进视频音乐轨的记录（产品设计 §2.7「生成配乐」）：铺过的任务号。只是界面的记号，跨会话记在本机：
 * 用户把铺好的音乐删掉之后再打开视频，不会又铺一遍。最多记最近几百条。
 */
interface SoundtrackStore {
  placed: Record<Id, true>;
  markPlaced(jobId: Id): void;
}

const KEEP = 500;

export const useSoundtrackStore = create<SoundtrackStore>()(
  persist(
    (set) => ({
      placed: {},
      markPlaced: (jobId) =>
        set((s) => {
          const entries = Object.entries(s.placed).filter(([k]) => k !== jobId);
          const trimmed = entries.length >= KEEP ? entries.slice(entries.length - KEEP + 1) : entries;
          return { placed: { ...Object.fromEntries(trimmed), [jobId]: true } };
        }),
    }),
    { name: 'cuccut.soundtrack-placed', version: 1, storage: createJSONStorage(() => localStorage), partialize: ({ placed }) => ({ placed }) },
  ),
);
