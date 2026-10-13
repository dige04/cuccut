import type { RcPublishingMessages } from './rc-publishing.ts';

export const ja: RcPublishingMessages = {
  // Who may do what (design §4.2).
  ownerOnly: 'これは所有者だけが、このコンピューター上の CucCut アプリで行えます。',
  desktopOnly: '承認、送信、結果の記録、接続の管理は、このコンピューター上の CucCut アプリでのみ行えます。',
  settingsOwnerOnly: '公開スケジュールを変更できるのは所有者だけです。公開設定で変更するよう依頼してください。',
  transferNotAllowed: 'カレンダーの読み込みと書き出しは、CucCut アプリとコマンドラインで行えます。',
  authorizationRequired: 'エージェントが送信するには、所有者が CucCut でこの公開内容を正確に承認する必要があります。',
  // Publications.
  publicationArchived: 'この公開内容はアーカイブ済みです。変更する前に復元してください。',
  publicationLocked: '送信済みの宛先は共通のコンテンツを保持します。失敗した宛先を編集するか、新しいリリースを準備してください。',
  destinationLocked: 'このアカウントの配信はすでに開始されています。変更する前に取り下げるか、結果を記録してください。',
  destinationKept: '送信済みの宛先は公開内容に残ります。削除する前に取り下げるか、結果を記録してください。',
  destinationAccountFixed: '別のアカウントを使うには、この宛先を削除して、代わりにそのアカウントを追加してください。',
  destinationNotFound: 'このアカウントはもう公開内容に含まれていません。再読み込みしてから、もう一度お試しください。',
  duplicateAccount: 'アカウントはそれぞれ 1 回だけ選んでください。',
  duplicatePlacement: 'アカウントごとの時刻は 1 回だけ選んでください。',
  afterExpiry: 'この公開内容の期限より前の時刻を選んでください。',
  invalid: 'この公開内容はまだ準備ができていません。一覧の問題を修正してから、もう一度お試しください。',
  nothingToSend: 'この公開内容のすべてのアカウントは送信済みです。もう一度送信するには、新しいリリースを準備してください。',
  slotTaken: (p: { account: string }) =>
    `この時刻は、${p.account} の別の公開内容と競合しています。別の時刻を選ぶか、公開設定で投稿間の間隔を短くしてください。`,
  slotsHaveDestinationTimes: 'これらの公開内容の一部には、アカウントごとの個別の時刻があります。共通の時刻を予約する前に、それらの時刻を解除してください。',
  calendarRange: 'カレンダーの範囲は最大 93 日までとし、開始日を終了日より前にしてください。',
  archiveInFlight: 'この公開内容をアーカイブする前に、待機中の配信を取り下げるか、その結果を記録してください。',
  // Delivery.
  providerUnsupported: 'この版の CucCut は手動での公開のみに対応しています。この接続では「手動」を選んでください。',
  notWaiting: 'あなたの操作を待っているアカウントだけを取り下げられます。',
  cancelNotAllowed: '送信されていないアカウントだけをキャンセルできます。取り下げるか、先に結果を記録してください。',
  reconcileFinal: '公開済みまたはキャンセル済みの配信は履歴の一部です。変更せず、新しいリリースを準備してください。',
  reconcileSending: '結果を記録する前に、現在の配信が完了するまで待ってください。',
  reconcileFutureTime: 'この投稿についてネットワークに表示されている、未来の時刻を入力してください。',
  // Pinned exports.
  exportRequired: '先に動画をレンダリングして固定してください。',
  exportChanged: '承認した書き出しが変更されました。公開する前に、確認済みの書き出しを固定してください。',
  exportStale: '固定する前に現在のバージョンを書き出すか、「レンダリングして固定」を選んでください。',
  exportNotFinished: 'この書き出しはまだ完了していません。完了を待つか、別の書き出しを選んでください。',
  exportNotVideo: '動画全体の、完了した MP4 の書き出しを選んでください。',
  exportOtherVideo: 'この書き出しは別の動画またはシーケンスのものです。この動画の書き出しを選んでください。',
  exportFileMissing: '書き出したファイルはこのコンピューターにありません。動画を再度レンダリングして固定してください。',
  exportFileChanged: '書き出したファイルは、レンダリング後に変更されています。動画を再度レンダリングして固定してください。',
  pinLocked: '送信済みの宛先は固定した書き出しを保持します。別の書き出しを使うには、新しいリリースを準備してください。',
  renderFailed: 'この公開内容の書き出しが完了しませんでした。もう一度レンダリングして固定してください。',
  renderCancelled: 'この公開内容の書き出しはキャンセルされました。準備ができたら、もう一度レンダリングして固定してください。',
  videoNotFound: 'この動画はこのコンピューターにありません。プロジェクトを開いてから、もう一度お試しください。',
  // Settings, connections and accounts.
  accountNotFound: 'このアカウントはもう存在しません。公開設定を再読み込みして、もう一度お試しください。',
  connectionNotFound: 'この接続はもう存在しません。公開設定を再読み込みして、もう一度お試しください。',
  defaultAccountMissing: '既定のアカウントがもう存在しません。既定のアカウントを選び直してください。',
  connectionProviderFixed: '接続は、追加されたときの経路を保持します。別の方法で公開するには、新しい接続を追加してください。',
  accountIdentityFixed: 'アカウントは接続とネットワークを保持します。代わりに新しいアカウントを追加してください。',
  accountDuplicate: 'このアカウントはすでにこの接続に追加されています。',
  accountInUse: (p: { name: string }) =>
    `${p.name} には、待機中、予約済み、または未確認の投稿があります。アカウントを削除する前に、その結果を記録してください。`,
  linkInvalid: '同じネットワーク上の、リンクされていない別のアカウントを選んでください。',
  linkCanonical: 'ほかのアカウントがこのアカウントにリンクされています。代わりに、もう一方の経路をこのアカウントにリンクしてください。',
  // Copy proposals.
  proposalReason: '動画、その文字起こし、あなたの文章ガイドラインに基づく下書きです。適用する前に確認してください。',
  /** The name the publishing service opens a video under (shown as the video's opener). */
  principalName: 'CucCut の公開',
  // Calendar transfer and cleanup.
  backupFailed: '公開データのバックアップを書き込めなかったため、何も読み込まれませんでした。ディスクを確認して、もう一度お試しください。',
};
