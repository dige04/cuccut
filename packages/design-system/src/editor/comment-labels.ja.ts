import type { CommentLabelMessages } from './comment-labels.ts';

export const ja: CommentLabelMessages = {
  kinds: {
    token: 'トークン',
    cgroup: 'カラーグループ',
    tset: 'テキストスタイルセット',
    style: 'テキストスタイル',
    font: 'フォント',
    knob: 'スタイル設定',
    editor: 'スタイル編集',
    picker: 'カラーピッカー',
    prop: 'プロパティ',
    props: 'プロパティ一覧',
    cell: 'カラー値',
    agroup: '素材グループ',
    asset: '素材',
    comp: 'コンポーネント',
    doc: 'ドキュメント',
    dialog: 'ダイアログ',
    lightbox: '素材プレビュー',
    note: '使い方メモ',
    page: 'セクション見出し',
  },
  specials: {
    cover: '表紙',
    'font-files': 'フォントファイル',
  },
  element: '要素',
  quote: (name) => `「${name}」`,
};
