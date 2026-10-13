import type { PacksMessages } from './packs-copy.ts';

export const zhHant: PacksMessages = {
  packsHelp: `用法：
  cuccut packs inspect <source>    讀取一個套件並顯示其包含的全部內容，但不安裝。
                                   <source>：資料夾、GitHub 位址（owner/repo、儲存庫 URL 或
                                   …/tree/<branch>/<folder>），或提供 pack.json 的 https:// 位址
  cuccut packs install <source>    讀取一個套件，並安裝其中的範本、技能、素材庫項目、風格指南和快捷操作
    --replace                      用套件中的內容取代你自己的同 ID 範本和技能（它們會移到垃圾桶）；
                                   不加此選項則保留並略過
  cuccut packs remove <id>         刪除一個套件：它以及它帶來的範本和技能會移到垃圾桶，保留 24 小時；
                                   素材庫項目和你做過的修改會保留
  cuccut packs restore <trashId>   在 24 小時內復原刪除
  cuccut packs style <id> [<file>|-]
                                   輸出該套件的風格指南；若提供檔案（或 - 表示標準輸入），則將該檔案儲存為指南
                                   （空檔案會移除指南）
  cuccut packs export <folder> --name <name>
                                   根據你自己的範本、技能和素材庫項目，寫入一個套件資料夾，並附帶檔案索引，
                                   可原樣傳送、推送到 GitHub，或從任意靜態主機提供。資料夾必須為空，或是該套件之前的匯出
    --id <id>                      套件的 ID（預設：由名稱產生）
    --version <version>            預設 1.0.0
    --author <name>, --description <text>
    --template <id>                你自己的範本（可重複）
    --skill <id>                   非內建的技能（可重複）
    --library <glossaries|brand>:<entryId>
                                   一個素材庫項目（可重複）；聲音會保留在本地
    --quick-actions <packId>       已安裝套件的快捷操作（可重複）
    --style-from <packId>          已安裝套件的風格指南和參考檔案`,

  // Inspect
  title: (name: string, id: string, version: string, author: string) => `${name}（${id}）v${version}${author ? `，作者 ${author}` : ''}`,
  notInstalled: '未安裝：請先讀取。',
  installedVersion: (version: string) => `已安裝版本 ${version}。再次安裝會更新套件所擁有的內容，並保留你做過的修改。`,
  contents: (templates: number, skills: number, library: number, style: boolean, quickActions: number) => {
    const parts = [
      templates ? `${templates} 個範本` : '',
      skills ? `${skills} 項技能` : '',
      library ? `${library} 個素材庫項目` : '',
      style ? '一份風格指南' : '',
      quickActions ? `${quickActions} 個快捷操作` : '',
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : '沒有自帶內容';
  },
  sectionTemplates: '範本',
  sectionSkills: '技能',
  sectionLibrary: '素材庫',
  sectionStyle: '風格指南：智慧代理在選擇和編輯前會讀取',
  sectionExamples: '參考檔案',
  sectionQuick: '快捷操作：點擊一次即可傳送給智慧代理的訊息',
  sectionReserved: '規則與審核標準：隨套件保存；CucCut 目前尚未使用',
  sectionWarnings: '警告',
  agentReads: '智慧代理會遵循的文字，請閱讀。',
  stateNew: '新增',
  stateUpdate: '會更新此套件已安裝的副本',
  stateChanged: '你安裝後已修改：除非使用 --replace，否則保留',
  stateExists: '你已有同 ID 的內容：除非使用 --replace，否則保留你的版本',
  stateBuiltin: '已有同 ID 的內建項目，因此不會安裝此項',
  skillFiles: (files: number) => `${files} 個檔案`,
  duplicate: '已在你的素材庫中；不再重複新增',
  bytes: (bytes: number) => `${bytes} 位元組`,
  missingSkill: (template: string, skill: string) => `${template} 推薦了技能「${skill}」，但它既不在這台電腦上，也不在套件內`,
  scanHit: (file: string, line: number, why: string, text: string) => `${file}，第 ${line} 行：${why}${text ? `（「${text}」）` : ''}`,
  blocked: (file: string, line: number, why: string, text: string) =>
    `此套件無法安裝：${file} 的第 ${line} 行${why}${text ? `（「${text}」）` : ''}`,
  installHint: (source: string) => `使用以下指令安裝：cuccut packs install ${source}`,
  replaceHint: '如需取代你自己的同 ID 項目，請新增 --replace。',

  // Install, remove, restore
  installed: (name: string, version: string, contents: string) => `已安裝 ${name} v${version}：${contents}`,
  skipped: (kind: 'template' | 'skill' | 'library', id: string, reason: 'builtin' | 'exists' | 'changed') =>
    `已略過${kind === 'template' ? '範本' : kind === 'skill' ? '技能' : '素材庫項目'} ${id}：${
      reason === 'builtin'
        ? '已有同 ID 的內建項目'
        : reason === 'exists'
          ? '你已有同 ID 的自訂項目（新增 --replace）'
          : '你安裝後已修改（新增 --replace）'
    }`,
  removed: (name: string, templates: number, skills: number) =>
    `已刪除 ${name}：隨之移除了 ${templates} 個範本和 ${skills} 項技能。素材庫項目保留。`,
  kept: (count: number, ids: string) => `${count} 個你修改過的項目被保留：${ids}`,
  undo: (trashId: string) => `24 小時內可復原：cuccut packs restore ${trashId}`,
  restored: (name: string, version: string) => `已恢復 ${name} v${version}`,

  // Style guide
  noStyle: (name: string, id: string) => `${name} 沒有風格指南。可使用 cuccut packs style ${id} <file> 儲存一份`,
  styleSaved: (name: string, chars: number, limit: number) => `已儲存 ${name} 的風格指南（${chars} / ${limit} 個字元）`,
  styleRemoved: (name: string) => `已移除 ${name} 的風格指南`,
  takesEffect: '從下一次新的智慧代理工作階段起生效。',
  idFormat: (value: string) => `不是有效的套件 ID（小寫字母、數字和單個短橫線）：${value}`,

  // Export
  exportNeedsName: '請用 --name 為套件命名。',
  exportNoId: (name: string) => `無法由「${name}」產生 ID；請用 --id 指定。`,
  libraryFormat: (value: string) => `不是素材庫項目（glossaries:<entryId> 或 brand:<entryId>）：${value}`,
  exported: (dir: string, files: number, bytes: number) =>
    `已寫入 ${dir}：${files} 個檔案，${bytes} 位元組。可原樣傳送該資料夾、推送到 GitHub，或從任意靜態主機提供。`,
  exportedCheck: (dir: string) => `使用以下指令讀回：cuccut packs inspect ${dir}`,
  fileUnreadable: (file: string, reason: string) => `無法讀取 ${file}：${reason}`,
};
