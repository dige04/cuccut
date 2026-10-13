import type { RcReviewMessages } from './rc-review.ts';

const s = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const ja: RcReviewMessages = {
  blocked: (p: { count: number }) =>
    `この動画はまだあなたの基準を満たしていません: ${p.count}件の${s(p.count, '指摘', '指摘')}がこの書き出しを止めています`,
  blockedRemedy: '一覧の項目を修正して書き出し直すか、レビューを開いて理由を添えて指摘を容認してください。',
  findingLine: (p: { metric: string; value: string; limit: string; fix: string }) =>
    `${p.metric}は${p.value}ですが、基準では${p.limit}が求められています。${p.fix ? ` ${p.fix}` : ''}`,
  limitAtLeast: (p: { min: number }) => `${p.min}以上`,
  limitAtMost: (p: { max: number }) => `${p.max}以下`,
  limitBetween: (p: { min: number; max: number }) => `${p.min}〜${p.max}`,
  limitYes: 'はい',
  limitNo: 'いいえ',
  limitAny: '任意',
  valueYes: 'はい',
  valueNo: 'いいえ',

  /** Errors (error codes REVIEW_REASON_REQUIRED, REVIEW_UNKNOWN_FINDING, REVIEW_CRITERIA_INVALID, REVIEW_CRITERIA_CONFLICT). */
  reasonRequired: '理由を入力してください: 指摘を容認すること、またはその重要度を下げることには理由が必要です',
  reasonTooLong: (p: { limit: number }) => `理由は${p.limit}文字未満にしてください`,
  unknownFinding: (p: { id: string }) => `この動画の基準に「${p.id}」という名前のチェックや質問はありません`,
  criteriaInvalid: '基準に保存前に修正が必要な問題があります',
  criteriaConflict: '基準が別の場所で変更されました。読み直してから再試行してください',
  answersInvalid: '回答が想定の形式ではありません: 質問ごとに1件、判定と根拠を含めてください',

  /** The per-video decisions document (kind review-plan) and the edits that write it. */
  documentName: 'レビューの判断',
  waiveLabel: (p: { id: string }) => `「${p.id}」を容認する`,
  unwaiveLabel: (p: { id: string }) => `「${p.id}」を再び基準で確認する`,
  severityLabel: (p: { id: string }) => `「${p.id}」の重要度を変更する`,

  /** Why a video is held to this standard. */
  reasonBuiltin: 'まだ基準を設定していないため、組み込みのチェックを使用しています。',
  reasonUser: 'あなたの基準で確認しています（設定 › レビュー）。',

  /** Notes on judged answers. `kind` is the evidence kind the question declares. */
  notReached: 'レビューはこの質問まで到達しませんでした。',
  evidenceMissing: '「満たしている」と回答されましたが、確認できるものがありません。',
  evidenceInvalid: (p: { kind: string }): string => {
    switch (p.kind) {
      case 'timestamp':
        return '「満たしている」と回答されましたが、根拠が動画内の時刻ではありません。';
      case 'frame':
        return '「満たしている」と回答されましたが、根拠がこの動画から取られたフレームではありません。';
      case 'field':
        return '「満たしている」と回答されましたが、根拠がこの動画の内容を示していません。';
      case 'quote':
        return '「満たしている」と回答されましたが、引用がこの動画の文字起こしや字幕にありません。';
      default:
        return '「満たしている」と回答されましたが、根拠を確認できません。';
    }
  },

  /** What to do about the built-in checks (`REVIEW_BUILTIN_CHECKS`). */
  builtinFixPlaceholders: '納品の前にプレースホルダーの枠を埋めるか削除してください。',
  builtinFixBlank: '画面に何もない空白部分を覆うか、埋めてください。',
  builtinFixTextEdge: 'テキストを移動するか幅を狭めて、フレーム内に収めてください。',
};
