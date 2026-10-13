import type { LibraryMessages } from './library-copy.ts';

export const ja: LibraryMessages = {
  blurb: 'すべてのプロジェクトの動画、素材、エージェントが作ったものをここにまとめています。',
  blurbProject: 'このプロジェクトの動画、素材、生成物です。',
  blurbFavorite: 'すべてのプロジェクトからお気に入りに入れた項目です。',
  blurbTrash: 'ゴミ箱に入れた項目は、復元するか完全に削除するまでここに残ります。',
  allItems: 'すべての項目',
  projects: 'プロジェクト',
  items: (n: number) => `${n} 件`,
  matching: (n: number, q: string) => `「${q}」に一致する ${n} 件`,
  kindFilter: '項目の種類',
  clearSearch: '検索をクリア',
  noMatchBody: '別の名前で探すか、種類を切り替えてください。',
  openHint: '開いてプレビュー · 動画はエディタで開きます',
  inProject: (name: string) => `「${name}」内`,
  clearProject: 'すべてのプロジェクトを表示',
  backToLibrary: 'ライブラリに戻る',
};
