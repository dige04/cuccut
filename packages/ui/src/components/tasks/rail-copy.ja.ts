import type { RailMessages } from './rail-copy.ts';

export const ja: RailMessages = {
  running: (n: number) => `${n} 件実行中`,
  finished: (n: number) => `${n} 件完了`,
  nothingYet: 'まだありません',
  tasksBlurb: '文字起こし、翻訳、書き出し、エージェントの作業をひとつの一覧にまとめています。開くと手順と結果を確認できます。',
  toolCount: (n: number) => `${n} 個のツール`,
  moreFinished: (n: number) => `ほか ${n} 件は「すべてのタスク」に`,
};
