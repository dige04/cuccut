import type { RuntimeStoragePublishingMessages } from './runtime-storage-publishing.ts';

export const ja: RuntimeStoragePublishingMessages = {
  unreadable: "公開データを読み込めませんでした。CucCut はファイルをそのままにし、変更しません。バックアップから復元するか、ファイルを移動して最初からやり直してください。",
  newerVersion: "公開データは、より新しいバージョンの CucCut によって保存されました。変更するには CucCut を更新してください。それまでは表示のみ可能です。",
  conflict: "この公開内容は別の場所で変更されました。変更を適用する前に、保存されたバージョンを再読み込みしてください。",
  settingsConflict: "公開設定は別の場所で変更されました。保存する前に再読み込みしてください。",
  notFound: "この公開内容はもう存在しません。",
  invalidRecord: "この変更により公開レコードが不完全になるため、保存されませんでした。値を確認して、もう一度お試しください。",
  writeFailed: "公開データをディスクに保存できませんでした。ディスクに空き容量があり、CucCut がそのフォルダーに書き込めることを確認してから、もう一度お試しください。",
};
