import type { RcProfileMessages } from './rc-profile.ts';

export const zhHans: RcProfileMessages = {
  readOnly: '该档案由更新版本的 CucCut 保存，因此在此仅供查看，不会更改',
  projectNotFound: '未找到项目',
  projectUnavailable: '项目文件夹缺失或无法写入，因此无法保存其规则和偏好',
  projectTextOnly: '一个项目只有一段偏好文本，已设为自有。访谈部分仅存在于工作区层级',
  noAnswers: '请至少回答一个问题，或跳过。',
  /** The name of the glossary in the user library that the interview's names go into. */
  namesGlossaryName: '访谈中的名称',

  // Rules (profile-rules)
  ruleInvalid: (p: { problems: string }) => `规则未保存：${p.problems}`,
  ruleNotFound: (p: { id: string }) => `未找到规则：${p.id}`,
  ruleOrder: '新的顺序必须恰好列出此层级的每条规则一次',
  ruleLimit: (p: { limit: number }) => `每个层级最多 ${p.limit} 条规则`,
  templateMissing: (p: { id: string }) => `模板“${p.id}”未安装。规则已保存；在安装之前，Agent 会跳过该模板`,
  problemSeparator: '；',
  /** One readable problem: "Field: problem". */
  fieldProblem: (p: { field: string; problem: string }) => `${p.field}：${p.problem}`,
  fieldId: 'ID',
  fieldName: '规则名称',
  fieldWhen: '触发条件',
  fieldInstruction: '指令',
  fieldTemplate: '模板',
  fieldNote: '备注',
  fieldOrder: '顺序',
  required: '必填',
  tooLong: (p: { limit: number }) => `超过 ${p.limit} 个字符`,
  badId: '请使用小写字母、数字和连字符，以字母或数字开头，最多 64 个字符',
  badTemplateId: '不是有效的模板 ID（小写字母和数字，之间用单个连字符连接）',
  badOrder: '必须是整数',
  needInstructionOrTemplate: '请填写指令，或选择一个模板',

  // A write from the answers (profile-writer)
  writeBusy: '偏好正在根据回答写入。请等待该次写入完成',
  writeStopped: 'CucCut 正在关闭，因此偏好未写入。你的回答已保存',

  // Agent tools (profile-tools): the project level and the one-line approval summaries
  noProject: '此会话不属于任何项目，因此没有项目层级。请使用 workspace 层级，或在项目中打开会话',
  levelWorkspace: '适用于每个项目',
  levelProject: (p: { name: string }) => `适用于项目 ${p.name}`,
  toolAnswerSummary: (p: { questions: string }) => `保存访谈回答：${p.questions}`,
  toolSkipSummary: '跳过访谈（回答会保留）',
  toolWriteSummary: '根据访谈回答写入你的偏好',
  toolPreferencesAppend: (p: { where: string; text: string }) => `添加到你的偏好${p.where}：${p.text}`,
  toolPreferencesReplace: (p: { where: string; text: string }) => `将你的偏好${p.where}替换为：${p.text}`,
  toolRuleSave: (p: { where: string; name: string; when: string; action: string }) => `保存规则“${p.name}”${p.where}：当${p.when}时，${p.action}`,
  toolRuleTemplate: (p: { id: string }) => `使用模板 ${p.id}`,
  toolRuleRemove: (p: { where: string; name: string }) => `删除规则“${p.name}”${p.where}`,
};
