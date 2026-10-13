import type { RailMessages } from './rail-copy.ts';

export const zhHans: RailMessages = {
  running: (n: number) => `${n} 个进行中`,
  finished: (n: number) => `${n} 个已完成`,
  nothingYet: '暂无任务',
  tasksBlurb: '转录、翻译、导出与智能体的工作都在这一张表里。打开一项查看步骤与结果。',
  toolCount: (n: number) => `${n} 个工具`,
  moreFinished: (n: number) => `另有 ${n} 个在“全部任务”里`,
};
