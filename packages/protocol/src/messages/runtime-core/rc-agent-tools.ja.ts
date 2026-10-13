import type { RcAgentToolsMessages } from './rc-agent-tools.ts';

function exportKindLabel(kind: string): string {
  switch (kind) {
    case 'subtitles':
      return '字幕';
    case 'transcript':
      return '文字起こし';
    case 'audio':
      return '音声';
    case 'video':
      return '動画ファイル';
    case 'portable':
      return 'ポータブルパッケージ';
    case 'project':
      return 'プロジェクトファイル';
    default:
      return kind;
  }
}

function linkImportAfter(p: { target: string; name: string | null; transcribe: boolean; language: string | null; provider: string | null; model: string | null; captions: boolean }): string {
  const recognition = `${p.language ? `、言語 ${p.language}` : ''}${p.provider ? `（${p.provider}${p.model ? ` ${p.model}` : ''}）` : ''}`;
  if (p.target === 'create') {
    return `、動画${p.name ? `「${p.name}」` : '（名前はページタイトル）'}を作成してタイムラインに追加${p.transcribe ? `してから文字起こし${recognition}${p.captions ? 'と字幕レイヤーの作成' : ''}` : ''}`;
  }
  if (p.target === 'video') return `、動画に読み込み${p.transcribe ? 'して文字起こし' : ''}`;
  if (p.target === 'project') return `、プロジェクトの downloads/ に保存${p.transcribe ? 'して TXT と SRT に文字起こし' : ''}`;
  if (p.target === 'download') return `、ダウンロードフォルダに保存${p.transcribe ? 'して TXT と SRT に文字起こし' : ''}`;
  return '';
}

export const ja: RcAgentToolsMessages = {

  instructionsNotSet: 'セッションの指示が設定されていません：Runtime の組み立て順序が正しくありません',
  listSeparator: '、',
  clauseSeparator: '、',

  createVideoSummary: (p) => `動画「${p.name}」を作成`,
  slidesImportAssetSummary: (p) => `「${p.file}」をスライド「${p.deck}」に取り込む`,
  designImportAssetSummary: (p) => `「${p.file}」をデザイン「${p.canvas}」に取り込む`,
  designSystemImportAssetSummary: (p) => `「${p.file}」をデザインシステム「${p.system}」に取り込む`,
  editsSummary: (p) => `${p.label}（${p.count} 件の操作：${p.types}）`,
  captionsSummary: (p) => `ドキュメント ${p.documentId} の${p.bilingual ? 'バイリンガル' : ''}字幕レイヤーを追加`,
  captionsLabel: '字幕レイヤーを追加',
  undoSummary: (p) => `編集 ${p.transactionId} を取り消し`,
  undoLatestSummary: '直前の編集を取り消し',
  deleteVideoSummary: (p) =>
    `動画「${p.name}」（${p.path}）を削除：ゴミ箱に移動し、${p.days} 日間はライブラリで復元できます。リンクした素材の元ファイルはそのまま残ります`,
  importPackageSummary: (p) => `ポータブルパッケージ ${p.file} を開く`,
  renameVideoLabel: '動画の名前を変更',
  putDocumentSummary: (p) => `ドキュメント ${p.documentId} の新しいバージョンを書き込み`,
  newDocumentSummary: (p) => `ドキュメントを作成（${p.kind}）`,
  updateDocumentLabel: (p) => `ドキュメント「${p.name}」を更新`,
  newDocumentLabel: (p) => `ドキュメント「${p.name}」を作成`,
  translationDocumentName: (p) => `${p.language} の翻訳`,
  importAssetSummary: (p) => `素材 ${p.name} を読み込み${p.place ? '、タイムラインに追加' : ''}`,
  importAssetLabel: (p) => `${p.name} を読み込み${p.place ? '、タイムラインに追加' : ''}`,
  replaceCompositionSummary: (p) => `${p.name} を読み込み、タイムライン上のクリップ ${p.clip} と置き換え`,
  replaceCompositionLabel: (p) => `モーショングラフィックを ${p.name} に置き換え`,
  pruneAssetsSummary: (p) => `使われていない素材を動画から削除（${p.count} 個）：${p.names}`,
  pruneAssetsLabel: (p) => `使われていない素材を整理（${p.count} 個）`,
  adoptChaptersSummary: (p) =>
    `${p.asset} の配信元のチャプターを採用（${p.count} 個）${p.existing ? `、既存のチャプター（${p.existing} 個）を置き換え` : ''}`,
  adoptChaptersLabel: '配信元のチャプターを採用',

  transcribePurpose: (p) => `素材 ${p.assetId} を文字起こし`,
  transcribeSummary: (p) =>
    `素材 ${p.assetId} を文字起こし${p.provider ? `（${p.provider}${p.model ? ` ${p.model}` : ''}）` : ''}`,
  speechPurpose: (p) => `音声合成（${p.chars} 文字）`,
  speechSummary: (p) =>
    `音声合成（${p.chars} 文字${p.provider ? `、${p.provider}` : ''}${p.voice ? `、声 ${p.voice}` : ''}）`,
  imagePurpose: (p) => `画像を生成：${p.prompt}`,
  musicPurpose: (p: { style: string }) => `音楽を生成: ${p.style}`,
  musicSummary: (p: { mode: string; seconds: number | null; provider: string | null; style: string }) => `${p.mode === 'song' ? '楽曲' : 'インスト'}を生成${p.seconds ? `（最長 ${p.seconds} 秒）` : ''}${p.provider ? `、${p.provider}` : ''}: ${p.style}`,
  imageSummary: (p) => `画像を生成（${p.count} 枚${p.size ? `、${p.size}` : ''}${p.provider ? `、${p.provider}` : ''}）：${p.prompt}`,
  cancelJobSummary: (p) => `タスク ${p.jobId} をキャンセル`,
  retryPipelineSummary: (p) =>
    `パイプライン ${p.jobId}（${p.pipeline}、${p.attempt} 回目）を失敗したステップから再実行`,
  saveArtifactSummary: (p) => `生成物 ${p.artifactId} を ${p.path} として保存`,
  overwriteArtifactSummary: (p) => `生成物 ${p.artifactId} で既存のファイル ${p.path} を上書き`,

  exportSummary: (p) => {
    const range = p.rangeStart !== null ? `、${p.rangeStart}–${p.rangeEnd} 秒` : p.rangeCount !== null ? `、${p.rangeCount} 区間` : '';
    const size =
      p.width !== null && p.height !== null
        ? `、${p.width}×${p.height}`
        : p.width !== null
          ? `、幅 ${p.width}`
          : p.height !== null
            ? `、高さ ${p.height}`
            : '';
    const source = p.originalOnly ? '、元の音声のみ' : p.dubGroupId ? `、吹き替え ${p.dubGroupId} のみ` : '';
    return `${exportKindLabel(p.kind)}を書き出し（${p.format}${range}${size}${source}）${p.fileName ? `、ファイル名 ${p.fileName}` : ''}${p.overwrite ? '、既存のファイルを上書き' : ''}`;
  },

  installToolSummary: (p) =>
    `リンクから動画をダウンロードするため、${p.url} から ${p.tool} ${p.version}（${p.estimated ? `約 ${p.size}` : p.size}、${p.license}）をインストール。${p.host} からのダウンロードに必要です`,
  linkImportSummary: (p) =>
    `${p.tool}${p.version ? ` ${p.version}` : ''} で ${p.host} からダウンロード：${p.url}${linkImportAfter(p)}`,
  linkImportConsentSummary: (p) =>
    `CucCut がこのコンピュータの ${p.tool}${p.version ? ` ${p.version}` : ''}${p.path ? `（${p.path}）` : ' '}を使って Web サイトから動画をダウンロードすることを許可し、${p.host} からダウンロード：${p.url}${linkImportAfter(p)}`,

  downloadSaveSummary: (p) =>
    `作業フォルダの ${p.source}（${p.size}）をダウンロードフォルダにコピー：${p.target}（同名のファイルがあれば番号を付け、上書きしません）`,

  grantSummary: (p) => `${p.recipients} にデータを送信：${p.items}`,
  grantSummaryItem: (p) => `${p.purpose}（${p.maxCalls === null ? '呼び出し回数の上限なし' : `最大 ${p.maxCalls} 回`}）`,

  testModelSummary: (p) => `ローカルモデルパッケージ ${p.bundleId} を確認：固定のサンプルで最初から最後まで実行`,
  installModelSummary: (p) =>
    `ローカルモデル ${p.bundleId} をダウンロード：${p.estimated ? `約 ${p.size}（サイズ不明のため推定）` : p.size}${p.resumed ? `、ダウンロード済みの ${p.resumed} から再開` : ''}、ダウンロード元 ${p.source}（${p.parts}）`,

  registerProjectSummary: (p) => `既存のフォルダ ${p.path} をプロジェクトとして登録${p.name ? `（${p.name}）` : ''}`,
  createProjectSummary: (p) => `プロジェクトフォルダ ${p.path} を作成${p.name ? `（${p.name}）` : ''}`,
  adoptSessionSummary: (p) => `プロジェクト${p.name ? `「${p.name}」` : '（最初の動画の名前）'}を作成し、このセッションの動画とファイルを移動`,
  deriveVideoSummary: (p) => `この動画の ${p.from}–${p.to} から子動画「${p.name}」を作成`,
  deriveVideoLabel: (p) => `「${p.name}」から派生`,
  derivationDocumentName: '派生元',
  deriveRangeEmpty: 'フレームに合わせると範囲が空になります',
  deriveUnsupportedItem: (p) => `範囲に子動画へコピーできないクリップがあります（${p.kind}）`,
  deriveParentUnplaced: 'この動画はプロジェクトやセッションのフォルダーにないため、隣に子動画を作成できません',
  shotsRangeEmpty: 'フレームに合わせると範囲が空になります',
  shotsRangeTooLong: (p) => `範囲が ${p.minutes} 分を超えています。短く分けてショットを検出してください`,
  reviewWaive: (p) => `指摘「${p.id}」をそのまま残す：${p.reason}`,
  reviewSeverity: (p) => `「${p.id}」の重要度を変更：${p.from} → ${p.to}`,
  reviewCriteriaSet: 'レビュー基準を置き換える',
  publicationsPrepareSummary: (p) => (p.repeat ? `${p.videos} の新しいリリースを公開用に準備` : `${p.videos} を公開用に準備`),
  publicationsUpdateSummary: (p) => `公開内容「${p.label}」を変更`,
  publicationsRestoreSummary: (p) => `アーカイブ済みの公開内容「${p.label}」を復元`,
  publicationsRescheduleSummary: (p) => `「${p.label}」の${p.count === 1 ? '1 件のアカウント' : `${p.count} 件のアカウント`}を新しい時刻に移動`,
  publicationsReserveSummary: (p) => `${p.count === 1 ? '1 件の公開内容' : `${p.count} 件の公開内容`}の公開時刻を予約`,
  publicationsPinSummary: (p) => (p.render ? `動画をレンダリングし、「${p.label}」に書き出しを固定` : `「${p.label}」に完了した書き出しを固定`),
  publicationsProposeCopySummary: (p) => `「${p.label}」のテキストを提案（使うかどうかはあなたが決めます）`,
  publicationsApproveSummary: (p) => `「${p.label}」の固定した書き出しを公開用に承認`,
  publicationsSendSummary: (p) => `「${p.label}」を ${p.accounts} に送信`,
  publicationsWithdrawSummary: (p) => `「${p.label}」を ${p.account} から取り下げ`,
  publicationsArchiveSummary: (p) => `公開内容「${p.label}」をアーカイブ`,
  publicationsImportSummary: (p) => `${p.file} から${p.count === 1 ? '1 件の公開内容' : `${p.count} 件の公開内容`}を読み込み`,
};
