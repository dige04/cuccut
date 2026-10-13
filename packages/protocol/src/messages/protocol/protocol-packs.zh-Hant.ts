import type { ProtocolPacksMessages } from './protocol-packs.ts';

export const zhHant: ProtocolPacksMessages = {
  // Manifest (pack.json)
  notObject: 'pack.json 必須是一個 JSON 物件',
  formatMissing: 'pack.json 中沒有 "format": "cuccut.pack"，因此它不是 CucCut 套件',
  foreignFormat: '這是 agentcut 套件：其 pack.json 沒有 "format" 欄位。CucCut 只讀取 cuccut.pack 資料夾',
  otherFormat: (p: { format: string }) => `pack.json 宣告格式為 "${p.format}"，而不是 "cuccut.pack"`,
  unsupportedSchema: (p: { schema: string }) => `不支援套件結構 ${p.schema}；此版本的 CucCut 只讀取結構 1`,
  unsupportedField: (p: { field: string }) => `不支援 "${p.field}"：此版本的 CucCut 中的套件不攜帶程式碼`,
  idChars: '套件 ID 由小寫字母、數字和單個短橫線組成，並以字母開頭',
  idReserved: (p: { id: string }) => `「${p.id}」是保留名稱，不能用作套件 ID`,
  versionChars: '版本號由字母、數字、點、短橫線和加號組成',
  templateIdChars: '範本 ID 由小寫字母、數字和單個短橫線組成，並以字母開頭',
  ruleIdChars: '規則 ID 由小寫字母、數字和單個短橫線組成',
  duplicateTemplates: '同一範本被命名了兩次',
  duplicateSkills: '同一技能被命名了兩次',
  duplicateLibrary: '同一素材庫檔案被命名了兩次',
  duplicateExamples: '同一參考檔案被命名了兩次',
  duplicateQuickActions: '兩個快捷操作有相同的標籤',
  duplicateRules: '同一規則被命名了兩次',
  duplicateFiles: '同一檔案在 files 中被列出了兩次',
  libraryDir: (p: { dir: string }) => `素材庫檔案位於 ${p.dir}/ 下`,
  libraryVoice: '聲音不能隨套件攜帶：聲音需要其所有者的同意',
  examplesDir: (p: { dir: string }) => `參考檔案位於 ${p.dir}/ 下`,
  exampleExtension: (p: { kind: string; extensions: string }) => `${p.kind}參考必須是以下之一：${p.extensions}`,
  stillExtension: (p: { extensions: string }) => `靜態畫面必須是圖片：${p.extensions}`,
  styleFile: '風格指南是套件根目錄下的 Markdown 檔案（.md）',
  reviewFile: '審核標準是套件根目錄下的 JSON 檔案',
  sha256Hex: 'sha256 為 64 位小寫十六進位數字',

  // Paths inside a pack
  pathRelative: '路徑必須相對於套件資料夾',
  pathHidden: '套件內路徑不能指向隱藏的檔案或資料夾（以點開頭）',
  fileNotNamed: (p: { path: string }) => `${p.path} 未在 pack.json 中被命名`,

  // Reasons of the text scan (pack-scan.ts): what a line does that a style guide, a reference note or a quick action has no business doing
  whyTooLong: (p: { length: number; limit: number }) => `長度為 ${p.length} 個字元；風格指南最多只能有 ${p.limit} 個`,
  whyIgnoreInstructions: '要求智慧代理忽略其指令',
  whyChangeIdentity: '試圖改變智慧代理的身分',
  whyRevealSecrets: '索取機密或提示詞',
  whyCredential: '包含憑證',
  whyCommand: '包含要執行的指令',
  whyDeleteWork: '要求智慧代理刪除工作內容',
  whySendUrl: '要求智慧代理向某個網址傳送內容',
  whyPromptBoundary: '模仿提示詞邊界',
};
