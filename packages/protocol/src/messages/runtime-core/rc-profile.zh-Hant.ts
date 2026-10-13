import type { RcProfileMessages } from './rc-profile.ts';

export const zhHant: RcProfileMessages = {
  readOnly: '此設定檔由較新版本的 CucCut 儲存，因此在此僅供檢視，不會變更',
  projectNotFound: '找不到專案',
  projectUnavailable: '專案資料夾遺失或無法寫入，因此無法儲存其規則和偏好設定',
  projectTextOnly: '一個專案只有一段偏好設定文字，已設為自有。訪談部分只存在於工作區層級',
  noAnswers: '請至少回答一個問題，或略過。',
  /** The name of the glossary in the user library that the interview's names go into. */
  namesGlossaryName: '訪談中的名稱',

  // Rules (profile-rules)
  ruleInvalid: (p: { problems: string }) => `規則未儲存：${p.problems}`,
  ruleNotFound: (p: { id: string }) => `找不到規則：${p.id}`,
  ruleOrder: '新的順序必須恰好列出此層級的每條規則一次',
  ruleLimit: (p: { limit: number }) => `每個層級最多 ${p.limit} 條規則`,
  templateMissing: (p: { id: string }) => `範本「${p.id}」未安裝。規則已儲存；在安裝之前，Agent 會略過該範本`,
  problemSeparator: '；',
  /** One readable problem: "Field: problem". */
  fieldProblem: (p: { field: string; problem: string }) => `${p.field}：${p.problem}`,
  fieldId: 'ID',
  fieldName: '規則名稱',
  fieldWhen: '觸發條件',
  fieldInstruction: '指令',
  fieldTemplate: '範本',
  fieldNote: '備註',
  fieldOrder: '順序',
  required: '必填',
  tooLong: (p: { limit: number }) => `超過 ${p.limit} 個字元`,
  badId: '請使用小寫字母、數字和連字號，以字母或數字開頭，最多 64 個字元',
  badTemplateId: '不是有效的範本 ID（小寫字母和數字，之間以單個連字號連接）',
  badOrder: '必須是整數',
  needInstructionOrTemplate: '請填寫指令，或選擇一個範本',

  // A write from the answers (profile-writer)
  writeBusy: '偏好設定正在根據回答寫入。請等待該次寫入完成',
  writeStopped: 'CucCut 正在關閉，因此偏好設定未寫入。你的回答已儲存',

  // Agent tools (profile-tools): the project level and the one-line approval summaries
  noProject: '此工作階段不屬於任何專案，因此沒有專案層級。請使用 workspace 層級，或在專案中開啟工作階段',
  levelWorkspace: '適用於每個專案',
  levelProject: (p: { name: string }) => `適用於專案 ${p.name}`,
  toolAnswerSummary: (p: { questions: string }) => `儲存訪談回答：${p.questions}`,
  toolSkipSummary: '略過訪談（回答會保留）',
  toolWriteSummary: '根據訪談回答寫入你的偏好設定',
  toolPreferencesAppend: (p: { where: string; text: string }) => `加入你的偏好設定${p.where}：${p.text}`,
  toolPreferencesReplace: (p: { where: string; text: string }) => `將你的偏好設定${p.where}替換為：${p.text}`,
  toolRuleSave: (p: { where: string; name: string; when: string; action: string }) => `儲存規則「${p.name}」${p.where}：當${p.when}時，${p.action}`,
  toolRuleTemplate: (p: { id: string }) => `使用範本 ${p.id}`,
  toolRuleRemove: (p: { where: string; name: string }) => `刪除規則「${p.name}」${p.where}`,
};
