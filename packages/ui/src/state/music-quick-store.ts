import { create } from 'zustand';
import type { MusicQuickPick } from '../model/tools-music.ts';

/** 一次提交的音乐试听：任务 ID、提交时的设置身份与选择（结果行按它写）。 */
export interface MusicQuickRun {
  jobId: string;
  key: string;
  pick: MusicQuickPick;
}

/** 一行模型的试听草稿：选择、最近一次提交、上一段做成了的（最近一次没做成时仍放它）。 */
export interface MusicQuickDraft {
  pick: MusicQuickPick;
  run: MusicQuickRun | null;
  last: MusicQuickRun | null;
}

/**
 * 设置 › 模型 › 音乐生成 › 本地模型的「试听」（同 state/tts-quick-store.ts）：哪几行展开着、每只模型的选择与最近的结果。
 * 按模型包 ID 记，只在这次运行里有效，不落盘；任务本身在 `jobs` 主题里，这里只记 ID。
 */
export interface MusicQuickStore {
  open: string[];
  drafts: Record<string, MusicQuickDraft>;
  setOpen(bundleId: string, open: boolean): void;
  setDraft(bundleId: string, draft: MusicQuickDraft): void;
}

export const useMusicQuick = create<MusicQuickStore>()((set) => ({
  open: [],
  drafts: {},
  setOpen: (bundleId, open) =>
    set((s) => ({ open: open ? (s.open.includes(bundleId) ? s.open : [...s.open, bundleId]) : s.open.filter((id) => id !== bundleId) })),
  setDraft: (bundleId, draft) => set((s) => ({ drafts: { ...s.drafts, [bundleId]: draft } })),
}));
