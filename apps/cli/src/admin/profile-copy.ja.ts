import type { ProfileMessages } from './profile-copy.ts';

export const ja: ProfileMessages = {
  help: `使い方:
  cuccut profile show [--project <id>]
                                   CucCut があなたについて知っていること: インタビュー、設定、ルール、
                                   正しく綴る名前。プロジェクト（--project、または現在のフォルダーのプロジェクト）を
                                   指定すると、そのプロジェクトの設定とルールも表示
  cuccut profile answers set <question> <text>
                                   インタビューの回答を 1 つ保存（who、record、platforms、annoys、names）。
                                   空のテキストで回答を消去
  cuccut profile interview skip|reopen|write
                                   インタビューをスキップ、再度開く、または回答から既定のエージェントで設定を書き込む
                                   （エージェントがない場合、回答は入力どおりに保持）
  cuccut profile preferences [--project <id>] --file <md>
                                   自分の設定、またはプロジェクトの設定を Markdown ファイルで置き換える
                                   （--file - は標準入力を読む）。インタビューが書いたセクションは残る
  cuccut profile rules list [--project <id>]
                                   自分のルール（またはプロジェクトのルール）を読み込まれる順に表示
  cuccut profile rules enable|disable|remove <rule-id> [--project <id>]
  cuccut profile rules move <rule-id> up|down|<position> [--project <id>]
                                   ルールは順番に読まれ、2 つが矛盾する場合は後のルールが優先される
エージェントはセッション開始時にプロフィールを読みます。すでに開いているセッションは、それまでの内容を保持します。`,

  // Arguments
  badQuestion: (value: string, ids: string) => `インタビューの質問ではありません: ${value}（次のいずれかを使用: ${ids}）`,
  needFile: '設定は Markdown ファイルで指定してください: --file <md>、または標準入力の場合は --file -',
  badMove: (value: string) => `ルールを上、下、または位置（1 が先頭）に移動してください: ${value}`,
  ruleMissing: (id: string) => `この階層にルール ${id} はありません（cuccut profile rules list を参照）`,
  projectMissing: (id: string) => `プロジェクト ${id} はありません（cuccut projects list を参照）`,
  stdinPrompt: '設定を入力または貼り付けてから、Ctrl-D を押してください:',

  // show
  questionWho: '何を作り、誰に向けていますか？',
  questionRecord: '普段は何を録画しますか？',
  questionPlatforms: 'どこに投稿し、長さはどれくらいがよいですか？',
  questionAnnoys: '今の動画で気になっていることは何ですか？',
  questionNames: '正しく綴る必要がある名前',
  interviewLine: (status: string, answered: number, total: number) => `インタビュー: ${status}、${total} 問中 ${answered} 問に回答`,
  statusPending: 'まだ受けていません',
  statusSkipped: 'スキップ済み',
  statusDone: '完了',
  answerLine: (question: string, answer: string) => `  ${question}: ${answer}`,
  unanswered: '—',
  generalHeading: 'あなたの設定',
  interviewHeading: 'インタビューが書いた内容',
  projectHeading: (name: string) => `${name} の設定`,
  noText: '  （なし）',
  rulesHeading: 'ルール',
  projectRulesHeading: (name: string) => `${name} のルール`,
  noRules: '  ルールはまだありません',
  namesLine: (names: string) => `正しく綴る名前: ${names}`,
  readOnly: 'このプロフィールは新しいバージョンの CucCut で保存されたため、表示のみできます。変更は拒否されます',

  // Rules
  ruleLine: (position: number, name: string, stage: string, off: boolean, id: string) => `${position}. ${name} [${stage}]${off ? ' (オフ)' : ''}  ${id}`,
  ruleWhen: (when: string) => `   条件: ${when}`,
  ruleDo: (instruction: string) => `   指示: ${instruction}`,
  ruleTemplate: (id: string) => `   テンプレート: ${id}`,
  stageAny: '選択と編集',
  stageClip: 'クリップの選択',
  stageEdit: '編集',
  ruleEnabled: (name: string) => `オンにしました: ${name}`,
  ruleDisabled: (name: string) => `オフにしました: ${name}`,
  ruleRemoved: (name: string, id: string) => `${name} を削除しました（${id}）`,
  ruleMoved: (name: string, position: number, total: number) => `${name} を ${total} 件中 ${position} 番目に移動しました`,

  // Writes
  answerSaved: (question: string) => `「${question}」への回答を保存しました`,
  answerCleared: (question: string) => `「${question}」への回答を消去しました`,
  interviewSkipped: 'インタビューをスキップしました。回答は保持されます',
  interviewReopened: 'インタビューを前回の回答とともに再度開きました',
  writing: '回答から設定を書き込んでいます。少し時間がかかります…',
  writtenByAgent: '回答から設定を書き込みました:',
  keptAsTyped: (reason: string) => `回答は入力どおりに保持されました（${reason}）:`,
  reasonNoAgent: 'インストールされ、サインインしたエージェントがありません',
  reasonAgentFailed: 'エージェントの実行が完了しませんでした',
  reasonBadOutput: 'エージェントの出力を使用できませんでした',
  namesAdded: (names: string) => `用語集に名前を追加しました: ${names}`,
  preferencesSaved: (chars: number) => `設定を保存しました（${chars} 文字）`,
  projectPreferencesSaved: (name: string, chars: number) => `${name} の設定を保存しました（${chars} 文字）`,
  takesEffect: 'エージェントはセッション開始時にこれを読みます。すでに開いているセッションは、それまでの内容を保持します',
};
