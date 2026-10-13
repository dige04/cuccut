import type { PacksMessages } from './packs-copy.ts';

export const zhHans: PacksMessages = {
  packsHelp: `用法：
  cuccut packs inspect <source>    读取一个包并显示其包含的全部内容，但不安装。
                                   <source>：文件夹、GitHub 地址（owner/repo、仓库 URL 或
                                   …/tree/<branch>/<folder>），或提供 pack.json 的 https:// 地址
  cuccut packs install <source>    读取一个包，并安装其中的模板、技能、素材库条目、风格指南和快捷操作
    --replace                      用包中的内容替换你自己的同 ID 模板和技能（它们会移到回收站）；
                                   不加此选项则保留并跳过
  cuccut packs remove <id>         删除一个包：它以及它带来的模板和技能会移到回收站，保留 24 小时；
                                   素材库条目和你做过的修改会保留
  cuccut packs restore <trashId>   在 24 小时内撤销删除
  cuccut packs style <id> [<file>|-]
                                   输出该包的风格指南；若提供文件（或 - 表示标准输入），则将该文件保存为指南
                                   （空文件会删除指南）
  cuccut packs export <folder> --name <name>
                                   根据你自己的模板、技能和素材库条目，写入一个包文件夹，并附带文件索引，
                                   可原样发送、推送到 GitHub，或从任意静态主机提供。文件夹必须为空，或是该包之前的导出
    --id <id>                      包的 ID（默认：由名称生成）
    --version <version>            默认 1.0.0
    --author <name>, --description <text>
    --template <id>                你自己的模板（可重复）
    --skill <id>                   非内置的技能（可重复）
    --library <glossaries|brand>:<entryId>
                                   一个素材库条目（可重复）；声音会保留在本地
    --quick-actions <packId>       已安装包的快捷操作（可重复）
    --style-from <packId>          已安装包的风格指南和参考文件`,

  // Inspect
  title: (name: string, id: string, version: string, author: string) => `${name}（${id}）v${version}${author ? `，作者 ${author}` : ''}`,
  notInstalled: '未安装：请先读取。',
  installedVersion: (version: string) => `已安装版本 ${version}。再次安装会更新包所拥有的内容，并保留你做过的修改。`,
  contents: (templates: number, skills: number, library: number, style: boolean, quickActions: number) => {
    const parts = [
      templates ? `${templates} 个模板` : '',
      skills ? `${skills} 项技能` : '',
      library ? `${library} 个素材库条目` : '',
      style ? '一份风格指南' : '',
      quickActions ? `${quickActions} 个快捷操作` : '',
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : '没有自带内容';
  },
  sectionTemplates: '模板',
  sectionSkills: '技能',
  sectionLibrary: '素材库',
  sectionStyle: '风格指南：智能体在选择和编辑前会读取',
  sectionExamples: '参考文件',
  sectionQuick: '快捷操作：点击一次即可发送给智能体的消息',
  sectionReserved: '规则与审核标准：随包保存；CucCut 目前尚未使用',
  sectionWarnings: '警告',
  agentReads: '智能体会遵循的文本，请阅读。',
  stateNew: '新增',
  stateUpdate: '会更新此包已安装的副本',
  stateChanged: '你安装后已修改：除非使用 --replace，否则保留',
  stateExists: '你已有同 ID 的内容：除非使用 --replace，否则保留你的版本',
  stateBuiltin: '已有同 ID 的内置项，因此不会安装此项',
  skillFiles: (files: number) => `${files} 个文件`,
  duplicate: '已在你的素材库中；不再重复添加',
  bytes: (bytes: number) => `${bytes} 字节`,
  missingSkill: (template: string, skill: string) => `${template} 推荐了技能“${skill}”，但它既不在这台电脑上，也不在包内`,
  scanHit: (file: string, line: number, why: string, text: string) => `${file}，第 ${line} 行：${why}${text ? `（“${text}”）` : ''}`,
  blocked: (file: string, line: number, why: string, text: string) =>
    `此包无法安装：${file} 的第 ${line} 行${why}${text ? `（“${text}”）` : ''}`,
  installHint: (source: string) => `使用以下命令安装：cuccut packs install ${source}`,
  replaceHint: '如需替换你自己的同 ID 内容，请添加 --replace。',

  // Install, remove, restore
  installed: (name: string, version: string, contents: string) => `已安装 ${name} v${version}：${contents}`,
  skipped: (kind: 'template' | 'skill' | 'library', id: string, reason: 'builtin' | 'exists' | 'changed') =>
    `已跳过${kind === 'template' ? '模板' : kind === 'skill' ? '技能' : '素材库条目'} ${id}：${
      reason === 'builtin'
        ? '已有同 ID 的内置项'
        : reason === 'exists'
          ? '你已有同 ID 的自定义内容（添加 --replace）'
          : '你安装后已修改（添加 --replace）'
    }`,
  removed: (name: string, templates: number, skills: number) =>
    `已删除 ${name}：随之移除了 ${templates} 个模板和 ${skills} 项技能。素材库条目保留。`,
  kept: (count: number, ids: string) => `${count} 个你修改过的项目被保留：${ids}`,
  undo: (trashId: string) => `24 小时内可撤销：cuccut packs restore ${trashId}`,
  replacedUndo: (ids: string, trashId: string) => `Replaced your own ${ids}. Undo within 24 hours: cuccut packs restore ${trashId}`,
  restored: (name: string, version: string) => `已恢复 ${name} v${version}`,

  // Style guide
  noStyle: (name: string, id: string) => `${name} 没有风格指南。可使用 cuccut packs style ${id} <file> 保存一份`,
  styleSaved: (name: string, chars: number, limit: number) => `已保存 ${name} 的风格指南（${chars} / ${limit} 个字符）`,
  styleRemoved: (name: string) => `已移除 ${name} 的风格指南`,
  takesEffect: '从下一次新的智能体会话起生效。',
  idFormat: (value: string) => `不是有效的包 ID（小写字母、数字和单个短横线）：${value}`,

  // Export
  exportNeedsName: '请用 --name 为包命名。',
  exportNoId: (name: string) => `无法由“${name}”生成 ID；请用 --id 指定。`,
  libraryFormat: (value: string) => `不是素材库条目（glossaries:<entryId> 或 brand:<entryId>）：${value}`,
  exported: (dir: string, files: number, bytes: number) =>
    `已写入 ${dir}：${files} 个文件，${bytes} 字节。可原样发送该文件夹、推送到 GitHub，或从任意静态主机提供。`,
  exportedCheck: (dir: string) => `使用以下命令读回：cuccut packs inspect ${dir}`,
  fileUnreadable: (file: string, reason: string) => `无法读取 ${file}：${reason}`,
};
