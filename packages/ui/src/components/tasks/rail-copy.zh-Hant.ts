import type { RailMessages } from './rail-copy.ts';

export const zhHant: RailMessages = {
  running: (n: number) => `${n} 個進行中`,
  finished: (n: number) => `${n} 個已完成`,
  nothingYet: '暫無任務',
  tasksBlurb: '轉錄、翻譯、匯出與智慧代理的工作都在這一張表裡。打開一項查看步驟與結果。',
  toolCount: (n: number) => `${n} 個工具`,
  moreFinished: (n: number) => `另有 ${n} 個在「全部任務」裡`,
};
