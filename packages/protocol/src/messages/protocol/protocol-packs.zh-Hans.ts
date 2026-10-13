import type { ProtocolPacksMessages } from './protocol-packs.ts';

export const zhHans: ProtocolPacksMessages = {
  // Manifest (pack.json)
  notObject: 'pack.json 必须是一个 JSON 对象',
  formatMissing: 'pack.json 中没有 "format": "cuccut.pack"，因此它不是 CucCut 包',
  foreignFormat: '这是 agentcut 包：其 pack.json 没有 "format" 字段。CucCut 只读取 cuccut.pack 文件夹',
  otherFormat: (p: { format: string }) => `pack.json 声明格式为 "${p.format}"，而不是 "cuccut.pack"`,
  unsupportedSchema: (p: { schema: string }) => `不支持包结构 ${p.schema}；此版本的 CucCut 只读取结构 1`,
  unsupportedField: (p: { field: string }) => `不支持 "${p.field}"：此版本的 CucCut 中的包不携带代码`,
  idChars: '包 ID 由小写字母、数字和单个短横线组成，并以字母开头',
  idReserved: (p: { id: string }) => `“${p.id}”是保留名称，不能用作包 ID`,
  versionChars: '版本号由字母、数字、点、短横线和加号组成',
  templateIdChars: '模板 ID 由小写字母、数字和单个短横线组成，并以字母开头',
  ruleIdChars: '规则 ID 由小写字母、数字和单个短横线组成',
  duplicateTemplates: '同一模板被命名了两次',
  duplicateSkills: '同一技能被命名了两次',
  duplicateLibrary: '同一素材库文件被命名了两次',
  duplicateExamples: '同一参考文件被命名了两次',
  duplicateQuickActions: '两个快捷操作有相同的标签',
  duplicateRules: '同一规则被命名了两次',
  duplicateFiles: '同一文件在 files 中被列出了两次',
  libraryDir: (p: { dir: string }) => `素材库文件位于 ${p.dir}/ 下`,
  libraryVoice: '声音不能随包携带：声音需要其所有者的同意',
  examplesDir: (p: { dir: string }) => `参考文件位于 ${p.dir}/ 下`,
  exampleExtension: (p: { kind: string; extensions: string }) => `${p.kind}参考必须是以下之一：${p.extensions}`,
  stillExtension: (p: { extensions: string }) => `静帧必须是图片：${p.extensions}`,
  styleFile: '风格指南是包根目录下的 Markdown 文件（.md）',
  reviewFile: '审核标准是包根目录下的 JSON 文件',
  sha256Hex: 'sha256 为 64 位小写十六进制数字',

  // Paths inside a pack
  pathRelative: '路径必须相对于包文件夹',
  pathHidden: '包内路径不能指向隐藏的文件或文件夹（以点开头）',
  fileNotNamed: (p: { path: string }) => `${p.path} 未在 pack.json 中被命名`,

  // Reasons of the text scan (pack-scan.ts): what a line does that a style guide, a reference note or a quick action has no business doing
  whyTooLong: (p: { length: number; limit: number }) => `长度为 ${p.length} 个字符；风格指南最多只能有 ${p.limit} 个`,
  whyIgnoreInstructions: '要求智能体忽略其指令',
  whyChangeIdentity: '试图改变智能体的身份',
  whyRevealSecrets: '索取机密或提示词',
  whyCredential: '包含凭据',
  whyCommand: '包含要运行的命令',
  whyDeleteWork: '要求智能体删除工作内容',
  whySendUrl: '要求智能体向某个网址发送内容',
  whyPromptBoundary: '模仿提示词边界',
};
