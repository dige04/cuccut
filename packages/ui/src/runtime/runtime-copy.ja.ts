import type { RuntimeMessages } from './runtime-copy.ts';

export const ja: RuntimeMessages = {
  missingContext: 'RuntimeContext がありません',
  mediaStatus: (status) => `メディアサービスが ${status} を返しました`,
  noRootSequence: '新しい動画にメインシーケンスがありません',
  waveformName: '波形',
  noDuration: '動画にまだ長さがないため、波形を追加しませんでした',
  noOpenVideo: '開いている動画がありません',
  notCaughtUp: '動画がまだ最新の状態に追いついていないため、今は変更できません',
};
