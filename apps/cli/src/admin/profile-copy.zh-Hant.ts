import type { ProfileMessages } from './profile-copy.ts';

export const zhHant: ProfileMessages = {
  help: `用法：
  cuccut profile show [--project <id>]
                                   CucCut 對你的了解：訪談、偏好設定、規則
                                   以及需要拼寫正確的名字；指定專案（--project，或目前資料夾所屬的專案）時，
                                   也會顯示該專案的偏好設定和規則
  cuccut profile answers set <question> <text>
                                   儲存一則訪談回答（who、record、platforms、annoys、names）；
                                   文字為空則清除該回答
  cuccut profile interview skip|reopen|write
                                   略過訪談、重新開啟訪談，或使用預設 Agent 根據回答撰寫偏好設定
                                   （沒有 Agent 時，回答按原樣保留）
  cuccut profile preferences [--project <id>] --file <md>
                                   以一個 Markdown 檔案取代你的偏好設定或專案偏好設定
                                   （--file - 讀取標準輸入）；訪談寫下的部分保持不變
  cuccut profile rules list [--project <id>]
                                   依讀取順序列出你的規則（或專案規則）
  cuccut profile rules enable|disable|remove <rule-id> [--project <id>]
  cuccut profile rules move <rule-id> up|down|<position> [--project <id>]
                                   規則依序讀取；兩條規則衝突時，排在後面的優先
Agent 會在工作階段開始時讀取設定檔；已開啟的工作階段保留其原有的設定。`,

  // Arguments
  badQuestion: (value: string, ids: string) => `不是訪談問題：${value}（請使用以下之一：${ids}）`,
  needFile: '請以 Markdown 檔案提供偏好設定：--file <md>，或使用 --file - 讀取標準輸入',
  badMove: (value: string) => `請將規則上移、下移或移至某個位置（1 為第一位）：${value}`,
  ruleMissing: (id: string) => `此層級中沒有規則 ${id}（請參閱 cuccut profile rules list）`,
  projectMissing: (id: string) => `沒有專案 ${id}（請參閱 cuccut projects list）`,
  stdinPrompt: '請輸入或貼上偏好設定，然後按 Ctrl-D：',

  // show
  questionWho: '你做什麼內容？為誰而做？',
  questionRecord: '你通常錄製什麼？',
  questionPlatforms: '發布到哪裡？長度應該多長？',
  questionAnnoys: '你現在對自己的影片有什麼不滿？',
  questionNames: '必須拼寫正確的名字',
  interviewLine: (status: string, answered: number, total: number) => `訪談：${status}，已回答 ${total} 題中的 ${answered} 題`,
  statusPending: '尚未進行',
  statusSkipped: '已略過',
  statusDone: '已完成',
  answerLine: (question: string, answer: string) => `  ${question}：${answer}`,
  unanswered: '—',
  generalHeading: '你的偏好設定',
  interviewHeading: '訪談寫下的內容',
  projectHeading: (name: string) => `${name} 的偏好設定`,
  noText: '  （無）',
  rulesHeading: '規則',
  projectRulesHeading: (name: string) => `${name} 的規則`,
  noRules: '  尚無規則',
  namesLine: (names: string) => `需要拼寫正確的名字：${names}`,
  readOnly: '此設定檔由較新版本的 CucCut 儲存：可以檢視，但拒絕修改',

  // Rules
  ruleLine: (position: number, name: string, stage: string, off: boolean, id: string) => `${position}. ${name} [${stage}]${off ? '（已關閉）' : ''}  ${id}`,
  ruleWhen: (when: string) => `   當：${when}`,
  ruleDo: (instruction: string) => `   執行：${instruction}`,
  ruleTemplate: (id: string) => `   範本：${id}`,
  stageAny: '選擇與編輯',
  stageClip: '選擇片段',
  stageEdit: '編輯',
  ruleEnabled: (name: string) => `已開啟：${name}`,
  ruleDisabled: (name: string) => `已關閉：${name}`,
  ruleRemoved: (name: string, id: string) => `已刪除 ${name}（${id}）`,
  ruleMoved: (name: string, position: number, total: number) => `已將 ${name} 移至第 ${position} 位（共 ${total} 條）`,

  // Writes
  answerSaved: (question: string) => `已儲存「${question}」的回答`,
  answerCleared: (question: string) => `已清除「${question}」的回答`,
  interviewSkipped: '已略過訪談；回答已保留',
  interviewReopened: '訪談已重新開啟，保留之前的回答',
  writing: '正在根據回答撰寫偏好設定，請稍候…',
  writtenByAgent: '已根據你的回答撰寫偏好設定：',
  keptAsTyped: (reason: string) => `你的回答已按原樣保留（${reason}）：`,
  reasonNoAgent: '沒有已安裝並登入的 Agent',
  reasonAgentFailed: 'Agent 的執行未完成',
  reasonBadOutput: 'Agent 的輸出無法使用',
  namesAdded: (names: string) => `已將名稱加入術語表：${names}`,
  preferencesSaved: (chars: number) => `已儲存你的偏好設定（${chars} 個字元）`,
  projectPreferencesSaved: (name: string, chars: number) => `已儲存 ${name} 的偏好設定（${chars} 個字元）`,
  takesEffect: 'Agent 會在工作階段開始時讀取這些內容；已開啟的工作階段保留其原有的設定',
};
