import type { PublishingIssuesMessages } from './publishing-issues.ts';

export const ja: PublishingIssuesMessages = {
  // Validation (`validatePublication`).
  approvalRequired: '公開する前に、固定した書き出しを承認してください。',
  exportRequired: '動画をレンダリングして固定すると公開できます。',
  accountsRequired: 'アカウントを 1 つ以上選んでください。',
  timezoneInvalid: '有効なタイムゾーンを選んでください。',
  accountUnavailable: 'このアカウントは利用できなくなりました。再接続するか、別のアカウントを選んでください。',
  accountDuplicateRoute: '同じアカウントが 2 つの経路で選択されています。経路を 1 つ選んでください。',
  accountNotConnected: '送信する前に、公開設定でこのアカウントを接続してください。',
  formatMismatch: 'この形式はアカウントのネットワークに対応していません。別の形式を選んでください。',
  descriptionRequired: 'このアカウントの説明を入力してください。',
  titleLength: (p: { max: number }) => `YouTube のタイトルは 1 ～ ${p.max} 文字にしてください。`,
  audienceRequired: 'この YouTube 動画が子ども向けかどうかを選んでください。',
  tagsTooLong: (p: { max: number }) => `YouTube のタグは ${p.max} 文字以内にしてください。超えると YouTube で削除される場合があります。`,
  shortTooLong: 'YouTube Shorts は最長 3 分です。「YouTube 動画」を選ぶか、書き出しを短くしてください。',
  shortsClassification: 'YouTube では、3 分以内の正方形または縦向きの動画は Shorts として扱われます。この書き出しには「YouTube Short」を選んでください。',
  portraitRequired: 'この形式には縦向きまたは正方形の書き出しが必要です。縦向きのバージョンをレンダリングするか、別の形式を選んでください。',
  captionTooLong: (p: { length: number; max: number }) => `説明とハッシュタグは ${p.length} 文字です。このネットワークの上限は ${p.max} 文字です。短くしてください。`,
  timeInPast: 'この時刻は過ぎています。将来の時刻を選ぶか、クリアして今すぐ送信してください。',
  expiresBefore: 'この公開内容は、公開前に期限切れになります。より早い時刻を選ぶか、より遅い期限を設定してください。',
  deliveryUnsettled:
    'このアカウントへのこの動画の別のリリースが、まだ待機中か未確認です。再送する前に、その結果を記録してください。',
  // Route options (`routeOptionIssues`).
  optionUnlistedYoutubeOnly: '限定公開は YouTube でのみ利用できます。',
  optionTagsYoutubeOnly: 'タグは YouTube でのみ利用できます。代わりにハッシュタグを説明文に入れてください。',
  optionPhoneYoutubeTags: '電話の経路では YouTube のタグを設定できません。削除するか、別の経路を選んでください。',
  optionPostbridgeYoutubeAudience:
    'Postbridge では YouTube の対象や公開範囲を設定できません。Postbridge で設定された内容を受け入れるか、別の経路を選んでください。',
  optionPostgunSynthetic: 'Postgun では YouTube の合成メディアの開示を追加できません。別の経路を選んでください。',
  optionYoutubeApiInteractions: 'この経路では、選択した YouTube のインタラクションやパートナーシップのオプションを適用できません。',
  optionInstagramApi: 'この経路では、選択した Instagram の公開範囲、開示、インタラクションのオプションを適用できません。',
  // Local times and slots (`localInstant`, `planSlots`, `resolveTimeField`, `calendarPlacements`).
  timeInvalid: '有効な日付と時刻を入力してください。',
  timeRequired: '日付と時刻を選んでください。',
  timeGap: (p: { timezone: string }) => `時計の切り替えにより、${p.timezone} にはこの時刻が存在しません。別の時刻を選んでください。`,
  timeFold: (p: { timezone: string }) =>
    `時計の切り替えにより、${p.timezone} ではこの時刻が 2 回発生します。UTC オフセット付きの正確なタイムスタンプを入力してください。`,
  timestampInvalid: 'UTC オフセット付きのタイムスタンプを入力してください。例: 2026-10-01T18:00:00-06:00',
  noFreeSlot: '期限より前に収まる空き時間がありません。アカウント、毎週の時刻、間隔を確認してください。',
  destinationMissing: 'このアカウントは公開内容に含まれなくなりました。再読み込みしてから、もう一度お試しください。',
  // Calendar files (`parseCalendarArchive`, `inspectCalendarImport`).
  archiveInvalid: 'サポートされているバージョンで書き出された CucCut のカレンダーファイル（JSON）を選んでください。',
  archiveDuplicatePublications: 'カレンダーファイルに、同じ公開内容が 2 回記載されています。元のコンピューターで書き出し直してください。',
  archiveDuplicateAccounts: 'カレンダーファイルに、同じアカウントが 2 回記載されています。元のコンピューターで書き出し直してください。',
  archiveDuplicateConnections: 'カレンダーファイルに、同じ接続が 2 回記載されています。元のコンピューターで書き出し直してください。',
  archiveDuplicateDestinations: (p: { label: string }) =>
    `「${p.label}」では、カレンダーファイル内で同じアカウントが 2 回記載されています。元のコンピューターで書き出し直してください。`,
  archiveTimezone: (p: { timezone: string }) => `カレンダーファイルが不明なタイムゾーン（${p.timezone}）を使用しています。元のコンピューターで書き出し直してください。`,
  archiveMissingConnection: (p: { name: string }) => `カレンダーファイルに「${p.name}」の接続がありません。`,
  archiveLinkedAccount: (p: { name: string }) => `カレンダーファイル内の「${p.name}」のリンク先アカウントが無効です。`,
  archiveMissingAccount: (p: { label: string }) => `カレンダーファイルに「${p.label}」が使用しているアカウントがありません。`,
  archiveInvalidDate: (p: { label: string }) => `カレンダーファイルの「${p.label}」に無効な日付があります。`,
  importConnectionConflict: (p: { name: string }) =>
    `カレンダーファイルの接続「${p.name}」が、このコンピューターの接続と競合しています。`,
  importAccountConflict: (p: { name: string }) => `カレンダーファイルのアカウント「${p.name}」が、このコンピューターのアカウントと競合しています。`,
  importedInFlight: '配信中に読み込まれました。ネットワークのアプリで結果を確認し、再送する前に記録してください。',
};
