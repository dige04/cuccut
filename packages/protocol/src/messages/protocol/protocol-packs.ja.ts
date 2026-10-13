import type { ProtocolPacksMessages } from './protocol-packs.ts';

export const ja: ProtocolPacksMessages = {
  // Manifest (pack.json)
  notObject: 'pack.json は 1 つの JSON オブジェクトでなければなりません',
  formatMissing: 'pack.json に "format": "cuccut.pack" がないため、CucCut のパックではありません',
  foreignFormat: 'これは agentcut のパックです: pack.json に "format" フィールドがありません。CucCut は cuccut.pack フォルダーのみ読み込みます',
  otherFormat: (p: { format: string }) => `pack.json の形式は "${p.format}" です。"cuccut.pack" ではありません`,
  unsupportedSchema: (p: { schema: string }) => `パックのスキーマ ${p.schema} はサポートされていません。この版の CucCut はスキーマ 1 を読み込みます`,
  unsupportedField: (p: { field: string }) => `"${p.field}" はサポートされていません: この版の CucCut のパックにはコードを含められません`,
  idChars: 'パック ID は小文字の英字、数字、単一のハイフンで構成され、英字で始まります',
  idReserved: (p: { id: string }) => `"${p.id}" は予約された名前のため、パック ID には使えません`,
  versionChars: 'バージョンは英字、数字、ドット、ハイフン、プラス記号で構成されます',
  templateIdChars: 'テンプレート ID は小文字の英字、数字、単一のハイフンで構成され、英字で始まります',
  ruleIdChars: 'ルール ID は小文字の英字、数字、単一のハイフンで構成されます',
  duplicateTemplates: '同じテンプレートが 2 回指定されています',
  duplicateSkills: '同じスキルが 2 回指定されています',
  duplicateLibrary: '同じライブラリファイルが 2 回指定されています',
  duplicateExamples: '同じ参照ファイルが 2 回指定されています',
  duplicateQuickActions: '同じラベルのクイックアクションが 2 つあります',
  duplicateRules: '同じルールが 2 回指定されています',
  duplicateFiles: 'files に同じファイルが 2 回記載されています',
  libraryDir: (p: { dir: string }) => `ライブラリファイルは ${p.dir}/ の下にあります`,
  libraryVoice: '音声はパックに含められません: 音声には所有者の同意が必要です',
  examplesDir: (p: { dir: string }) => `参照ファイルは ${p.dir}/ の下にあります`,
  exampleExtension: (p: { kind: string; extensions: string }) => `${p.kind}の参照は ${p.extensions} のいずれかである必要があります`,
  stillExtension: (p: { extensions: string }) => `静止画は画像である必要があります: ${p.extensions}`,
  styleFile: 'スタイルガイドはパックのルートにある Markdown ファイル (.md) です',
  reviewFile: 'レビュー基準はパックのルートにある JSON ファイルです',
  sha256Hex: 'sha256 は 64 桁の小文字の 16 進数です',

  // Paths inside a pack
  pathRelative: 'パスはパックフォルダーからの相対パスでなければなりません',
  pathHidden: 'パス内でドット（.）で始まる隠しファイルやフォルダーを指定することはできません',
  fileNotNamed: (p: { path: string }) => `${p.path} は pack.json で指定されていません`,

  // Reasons of the text scan (pack-scan.ts): what a line does that a style guide, a reference note or a quick action has no business doing
  whyTooLong: (p: { length: number; limit: number }) => `${p.length} 文字あります。スタイルガイドは最大 ${p.limit} 文字です`,
  whyIgnoreInstructions: 'エージェントに指示を無視するよう求めています',
  whyChangeIdentity: 'エージェントの正体を変えようとしています',
  whyRevealSecrets: '機密情報やプロンプトを求めています',
  whyCredential: '認証情報を含んでいます',
  whyCommand: '実行するコマンドを含んでいます',
  whyDeleteWork: 'エージェントに作業の削除を求めています',
  whySendUrl: 'エージェントに Web アドレスへ何かを送るよう求めています',
  whyPromptBoundary: 'プロンプトの境界を模倣しています',
};
