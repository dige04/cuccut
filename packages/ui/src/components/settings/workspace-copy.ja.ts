import type { WorkspaceMessages } from './workspace-copy.ts';

export const ja: WorkspaceMessages = {
  aside: 'ここでの設定はすべてのプロジェクトに適用されます',
  generalBlurb: 'CucCut の見た目と言語、ダウンロードの保存先、インターネットから取得してよいもの。',
  shortcutsBlurb: 'CucCut のどこでも使えるキー。エディタのショートカットはヘルプ（F1）にあります。',
  shortcutsPanel: 'CucCut のどこでも',
  fontsBlurb: '字幕とタイトルのフォント：どこから取得するか、そしてこのコンピュータにすでにあるもの。',
  privacyBlurb: 'このコンピュータに残るもの、クラウドのプロバイダに送ってよいもの、Agent が確認なしにできること。',
  diagnosticsBlurb: 'ローカルの Runtime とそのログ、バックグラウンドジョブがこのコンピュータをどれだけ使えるか。',
  aboutBlurb: 'アプリ、インターフェース、Runtime のバージョンと、CucCut の更新方法。',
  checking: '確認中…',
  noAgent: '使える Agent がありません',
  shortcutCount: (n) => `ショートカット ${n} 件`,
  skillCount: (n) => (n === 0 ? 'まだありません' : `Skill ${n} 件`),
  glossaryCount: (n) => (n === 0 ? 'まだありません' : `用語集 ${n} 件`),
  grantCount: (n) => (n === 0 ? '有効な許可はありません' : `有効な許可 ${n} 件`),
  runtimeOn: 'Runtime に接続済み',
  runtimeOff: 'Runtime に未接続',
  installed: (n) => (n === 0 ? '未インストール' : `${n} 件インストール済み`),
  noDefault: 'デフォルト未設定',
  version: (version) => `バージョン ${version}`,
  desktopOnly: 'デスクトップ版のみ',
  notYet: 'まだ利用できません',
  loadFailed: '読み込めませんでした',
  fontsSummary: '字幕とタイトル用',
  preferencesSummary: (written, answers) =>
    written
      ? answers === 0
        ? 'Preferences written'
        : `Preferences written, ${answers === 1 ? '1 answer' : `${answers} answers`}`
      : answers === 0
        ? 'No preferences yet'
        : answers === 1
          ? '1 answer'
          : `${answers} answers`,
  ruleCount: (n, off) => (n === 0 ? 'None yet' : `${n === 1 ? '1 rule' : `${n} rules`}${off ? `, ${off} off` : ''}`),
};
