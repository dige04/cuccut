import type { RcProfileMessages } from './rc-profile.ts';

export const ja: RcProfileMessages = {
  readOnly: 'このプロフィールは新しいバージョンの CucCut で保存されたため、ここでは表示のみで変更できません',
  projectNotFound: 'プロジェクトが見つかりません',
  projectUnavailable: 'プロジェクトのフォルダーが見つからないか書き込めないため、そのルールと設定を保存できません',
  projectTextOnly: 'プロジェクトには、自分用に設定された設定テキストが 1 つだけあります。インタビューの項目はワークスペースの階層にだけ存在します',
  noAnswers: '質問に 1 つ以上答えるか、スキップしてください。',
  /** The name of the glossary in the user library that the interview's names go into. */
  namesGlossaryName: 'インタビューの名前',

  // Rules (profile-rules)
  ruleInvalid: (p: { problems: string }) => `ルールは保存されませんでした: ${p.problems}`,
  ruleNotFound: (p: { id: string }) => `ルールが見つかりません: ${p.id}`,
  ruleOrder: '新しい順序には、この階層のすべてのルールを 1 回ずつ含める必要があります',
  ruleLimit: (p: { limit: number }) => `1 つの階層に置けるルールは最大 ${p.limit} 件です`,
  templateMissing: (p: { id: string }) => `テンプレート「${p.id}」はインストールされていません。ルールは保存されました。インストールされるまで、エージェントはこのテンプレートを使いません`,
  problemSeparator: '; ',
  /** One readable problem: "Field: problem". */
  fieldProblem: (p: { field: string; problem: string }) => `${p.field}: ${p.problem}`,
  fieldId: 'ID',
  fieldName: 'ルール名',
  fieldWhen: '条件',
  fieldInstruction: '指示',
  fieldTemplate: 'テンプレート',
  fieldNote: 'メモ',
  fieldOrder: '順序',
  required: '必須',
  tooLong: (p: { limit: number }) => `${p.limit} 文字を超えています`,
  badId: '小文字、数字、ハイフンを使い、先頭は文字または数字にして、64 文字以内にしてください',
  badTemplateId: 'テンプレート ID として正しくありません（小文字と数字を、ハイフン 1 つで区切ったもの）',
  badOrder: '整数で入力してください',
  needInstructionOrTemplate: '指示を入力するか、テンプレートを選んでください',

  // A write from the answers (profile-writer)
  writeBusy: '回答から設定を書き込んでいます。その処理が終わるまで待ってください',
  writeStopped: 'CucCut を終了しているため、設定は書き込まれませんでした。回答は保存されています',

  // Agent tools (profile-tools): the project level and the one-line approval summaries
  noProject: 'このセッションはプロジェクトに属していないため、プロジェクトの階層はありません。階層に workspace を指定するか、プロジェクト内でセッションを開いてください',
  levelWorkspace: 'すべてのプロジェクトに',
  levelProject: (p: { name: string }) => `プロジェクト ${p.name} に`,
  toolAnswerSummary: (p: { questions: string }) => `インタビューの回答を保存: ${p.questions}`,
  toolSkipSummary: 'インタビューをスキップ（回答は保持されます）',
  toolWriteSummary: 'インタビューの回答から設定を書き込む',
  toolPreferencesAppend: (p: { where: string; text: string }) => `設定${p.where}に追加: ${p.text}`,
  toolPreferencesReplace: (p: { where: string; text: string }) => `設定${p.where}を次で置き換え: ${p.text}`,
  toolRuleSave: (p: { where: string; name: string; when: string; action: string }) => `ルール「${p.name}」を${p.where}保存: ${p.when}のとき、${p.action}`,
  toolRuleTemplate: (p: { id: string }) => `テンプレート ${p.id} を使う`,
  toolRuleRemove: (p: { where: string; name: string }) => `ルール「${p.name}」を${p.where}削除`,
};
