import type { PacksMessages } from './packs-copy.ts';

export const ja: PacksMessages = {
  packsHelp: `使い方:
  cuccut packs inspect <source>    パックを読み込み、含まれているすべての内容を、インストールせずに表示します。
                                   <source>: フォルダー、GitHub アドレス（owner/repo、リポジトリ URL、
                                   …/tree/<branch>/<folder>）、または pack.json を配信する https:// アドレス
  cuccut packs install <source>    パックを読み込み、テンプレート、スキル、ライブラリ項目、スタイルガイド、
                                   クイックアクションをインストールします
    --replace                      同じ ID を持つ自分のテンプレートとスキルを置き換えます（ゴミ箱へ移動）。
                                   指定しない場合は残され、スキップされます
  cuccut packs remove <id>         パックを削除します。パック本体と、それが持ち込んだテンプレートとスキルは
                                   24 時間ゴミ箱に入ります。ライブラリ項目と変更した内容は残ります
  cuccut packs restore <trashId>   削除を 24 時間以内に取り消します
  cuccut packs style <id> [<file>|-]
                                   パックのスタイルガイドを表示します。ファイル（または標準入力の -）を指定すると、
                                   そのファイルをガイドとして保存します（空のファイルはガイドを削除します）
  cuccut packs export <folder> --name <name>
                                   自分のテンプレート、スキル、ライブラリ項目からパックフォルダーを書き出します。
                                   ファイル一覧付きで、そのまま送るか、GitHub にプッシュするか、
                                   任意の静的ホストから配信できます。フォルダーは空であるか、このパックの以前の書き出し先である必要があります
    --id <id>                      パックの ID（省略時は名前から生成）
    --version <version>            既定値 1.0.0
    --author <name>, --description <text>
    --template <id>                自分のテンプレート（繰り返し指定可）
    --skill <id>                   組み込みではないスキル（繰り返し指定可）
    --library <glossaries|brand>:<entryId>
                                   ライブラリ項目（繰り返し指定可）。音声は含まれません
    --quick-actions <packId>       インストール済みパックのクイックアクション（繰り返し指定可）
    --style-from <packId>          インストール済みパックのスタイルガイドと参照ファイル`,

  // Inspect
  title: (name: string, id: string, version: string, author: string) => `${name}（${id}）v${version}${author ? `、作者 ${author}` : ''}`,
  notInstalled: '未インストール: 先に読み込んでください。',
  installedVersion: (version: string) =>
    `バージョン ${version} がインストールされています。再インストールすると、パックが所有する内容は更新され、変更した内容は残ります。`,
  contents: (templates: number, skills: number, library: number, style: boolean, quickActions: number) => {
    const parts = [
      templates ? `テンプレート ${templates} 件` : '',
      skills ? `スキル ${skills} 件` : '',
      library ? `ライブラリ項目 ${library} 件` : '',
      style ? 'スタイルガイド' : '',
      quickActions ? `クイックアクション ${quickActions} 件` : '',
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : '独自の内容はありません';
  },
  sectionTemplates: 'テンプレート',
  sectionSkills: 'スキル',
  sectionLibrary: 'ライブラリ',
  sectionStyle: 'スタイルガイド: エージェントは選択や編集の前にこれを読みます',
  sectionExamples: '参照ファイル',
  sectionQuick: 'クイックアクション: ワンクリックでエージェントに送られるメッセージ',
  sectionReserved: 'ルールとレビュー基準: パックと一緒に保管されます。CucCut はまだ使用しません',
  sectionWarnings: '警告',
  agentReads: 'エージェントが従うテキストです。目を通してください。',
  stateNew: '新規',
  stateUpdate: 'このパックがインストールした内容を更新します',
  stateChanged: 'インストール後に変更されています: --replace を指定しない限り残ります',
  stateExists: '同じ ID の項目がすでにあります: --replace を指定しない限り、あなたのものが残ります',
  stateBuiltin: '同じ ID の組み込み項目があるため、これはインストールされません',
  skillFiles: (files: number) => `${files} ファイル`,
  duplicate: 'ライブラリにすでにあるため、再度追加しません',
  bytes: (bytes: number) => `${bytes} バイト`,
  missingSkill: (template: string, skill: string) =>
    `${template} はスキル「${skill}」を推奨していますが、そのスキルはこのコンピュータにもパック内にもありません`,
  scanHit: (file: string, line: number, why: string, text: string) => `${file} の ${line} 行目: ${why}${text ? `（「${text}」）` : ''}`,
  blocked: (file: string, line: number, why: string, text: string) =>
    `このパックはインストールされません: ${file} の ${line} 行目が${why}${text ? `（「${text}」）` : ''}`,
  installHint: (source: string) => `次のコマンドでインストールします: cuccut packs install ${source}`,
  replaceHint: '同じ ID を持つ自分の項目を置き換えるには --replace を追加してください。',

  // Install, remove, restore
  installed: (name: string, version: string, contents: string) => `${name} v${version} をインストールしました: ${contents}`,
  skipped: (kind: 'template' | 'skill' | 'library', id: string, reason: 'builtin' | 'exists' | 'changed') =>
    `${kind === 'template' ? 'テンプレート' : kind === 'skill' ? 'スキル' : 'ライブラリ項目'} ${id} をスキップしました: ${
      reason === 'builtin'
        ? '同じ ID の組み込み項目があります'
        : reason === 'exists'
          ? '同じ ID の自分の項目があります（--replace を追加）'
          : 'インストール後に変更されています（--replace を追加）'
    }`,
  removed: (name: string, templates: number, skills: number) =>
    `${name} を削除しました。テンプレート ${templates} 件とスキル ${skills} 件も削除されました。ライブラリ項目は残ります。`,
  kept: (count: number, ids: string) => `変更した項目 ${count} 件は残ります: ${ids}`,
  undo: (trashId: string) => `24 時間以内に取り消せます: cuccut packs restore ${trashId}`,
  replacedUndo: (ids: string, trashId: string) => `Replaced your own ${ids}. Undo within 24 hours: cuccut packs restore ${trashId}`,
  restored: (name: string, version: string) => `${name} v${version} を元に戻しました`,

  // Style guide
  noStyle: (name: string, id: string) => `${name} にはスタイルガイドがありません。cuccut packs style ${id} <file> で保存してください`,
  styleSaved: (name: string, chars: number, limit: number) => `${name} のスタイルガイドを保存しました（${chars} / ${limit} 文字）`,
  styleRemoved: (name: string) => `${name} のスタイルガイドを削除しました`,
  takesEffect: '次に新しく開始するエージェントセッションから反映されます。',
  idFormat: (value: string) => `パック ID として無効です（小文字の英字、数字、単一のハイフン）: ${value}`,

  // Export
  exportNeedsName: '--name でパックの名前を指定してください。',
  exportNoId: (name: string) => `「${name}」から ID を作成できません。--id で指定してください。`,
  libraryFormat: (value: string) => `ライブラリ項目ではありません（glossaries:<entryId> または brand:<entryId>）: ${value}`,
  exported: (dir: string, files: number, bytes: number) =>
    `${dir} に書き出しました: ${files} ファイル、${bytes} バイト。フォルダーをそのまま送るか、GitHub にプッシュするか、任意の静的ホストから配信してください。`,
  exportedCheck: (dir: string) => `次のコマンドで読み戻せます: cuccut packs inspect ${dir}`,
  fileUnreadable: (file: string, reason: string) => `${file} を読み込めません: ${reason}`,
};
