import type { ProfileMessages } from './profile-copy.ts';

export const zhHans: ProfileMessages = {
  help: `用法：
  cuccut profile show [--project <id>]
                                   CucCut 对你的了解：访谈、偏好、规则
                                   以及需要拼写正确的名字；指定项目（--project，或当前文件夹所属的项目）时，
                                   还会显示该项目的偏好和规则
  cuccut profile answers set <question> <text>
                                   保存一条访谈回答（who、record、platforms、annoys、names）；
                                   文本为空则清除该回答
  cuccut profile interview skip|reopen|write
                                   跳过访谈、重新打开访谈，或使用默认 Agent 根据回答撰写偏好
                                   （没有 Agent 时，回答按原样保留）
  cuccut profile preferences [--project <id>] --file <md>
                                   用一个 Markdown 文件替换你的偏好或项目偏好
                                   （--file - 读取标准输入）；访谈写下的部分保持不变
  cuccut profile rules list [--project <id>]
                                   按读取顺序列出你的规则（或项目规则）
  cuccut profile rules enable|disable|remove <rule-id> [--project <id>]
  cuccut profile rules move <rule-id> up|down|<position> [--project <id>]
                                   规则按顺序读取；两条规则冲突时，靠后的规则优先
Agent 在会话开始时读取档案；已打开的会话保留其原有的设置。`,

  // Arguments
  badQuestion: (value: string, ids: string) => `不是访谈问题：${value}（请使用以下之一：${ids}）`,
  needFile: '请以 Markdown 文件提供偏好：--file <md>，或使用 --file - 读取标准输入',
  badMove: (value: string) => `请将规则上移、下移或移至某个位置（1 为第一位）：${value}`,
  ruleMissing: (id: string) => `此层级中没有规则 ${id}（参见 cuccut profile rules list）`,
  projectMissing: (id: string) => `没有项目 ${id}（参见 cuccut projects list）`,
  stdinPrompt: '请输入或粘贴偏好，然后按 Ctrl-D：',

  // show
  questionWho: '你做什么内容？为谁而做？',
  questionRecord: '你通常录制什么？',
  questionPlatforms: '发布到哪里？时长应该多长？',
  questionAnnoys: '你现在对自己的视频有什么不满意？',
  questionNames: '必须拼写正确的名字',
  interviewLine: (status: string, answered: number, total: number) => `访谈：${status}，已回答 ${total} 题中的 ${answered} 题`,
  statusPending: '尚未进行',
  statusSkipped: '已跳过',
  statusDone: '已完成',
  answerLine: (question: string, answer: string) => `  ${question}：${answer}`,
  unanswered: '—',
  generalHeading: '你的偏好',
  interviewHeading: '访谈写下的内容',
  projectHeading: (name: string) => `${name} 的偏好`,
  noText: '  （无）',
  rulesHeading: '规则',
  projectRulesHeading: (name: string) => `${name} 的规则`,
  noRules: '  暂无规则',
  namesLine: (names: string) => `需要拼写正确的名字：${names}`,
  readOnly: '此档案由较新版本的 CucCut 保存：可以查看，但拒绝修改',

  // Rules
  ruleLine: (position: number, name: string, stage: string, off: boolean, id: string) => `${position}. ${name} [${stage}]${off ? '（已关闭）' : ''}  ${id}`,
  ruleWhen: (when: string) => `   当：${when}`,
  ruleDo: (instruction: string) => `   执行：${instruction}`,
  ruleTemplate: (id: string) => `   模板：${id}`,
  stageAny: '选择与编辑',
  stageClip: '选择片段',
  stageEdit: '编辑',
  ruleEnabled: (name: string) => `已开启：${name}`,
  ruleDisabled: (name: string) => `已关闭：${name}`,
  ruleRemoved: (name: string, id: string) => `已删除 ${name}（${id}）`,
  ruleMoved: (name: string, position: number, total: number) => `已将 ${name} 移至第 ${position} 位（共 ${total} 条）`,

  // Writes
  answerSaved: (question: string) => `已保存“${question}”的回答`,
  answerCleared: (question: string) => `已清除“${question}”的回答`,
  interviewSkipped: '已跳过访谈；回答已保留',
  interviewReopened: '访谈已重新打开，保留之前的回答',
  writing: '正在根据回答撰写偏好，请稍候…',
  writtenByAgent: '已根据你的回答撰写偏好：',
  keptAsTyped: (reason: string) => `你的回答已按原样保留（${reason}）：`,
  reasonNoAgent: '没有已安装并登录的 Agent',
  reasonAgentFailed: 'Agent 的运行未完成',
  reasonBadOutput: 'Agent 的输出无法使用',
  namesAdded: (names: string) => `已将名称添加到术语表：${names}`,
  preferencesSaved: (chars: number) => `已保存你的偏好（${chars} 个字符）`,
  projectPreferencesSaved: (name: string, chars: number) => `已保存 ${name} 的偏好（${chars} 个字符）`,
  takesEffect: 'Agent 在会话开始时读取这些内容；已打开的会话保留其原有的设置',
};
