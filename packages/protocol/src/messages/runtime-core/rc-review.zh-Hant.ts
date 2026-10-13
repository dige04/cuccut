import type { RcReviewMessages } from './rc-review.ts';

const s = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const zhHant: RcReviewMessages = {
  blocked: (p: { count: number }) =>
    `此影片尚未符合你的標準：${p.count} 項${s(p.count, '發現項', '發現項')}會阻止此次匯出`,
  blockedRemedy: '修正列出的項目後重新匯出，或開啟審核並附上理由保留某項發現。',
  findingLine: (p: { metric: string; value: string; limit: string; fix: string }) =>
    `${p.metric}為 ${p.value}，而標準要求 ${p.limit}。${p.fix ? ` ${p.fix}` : ''}`,
  limitAtLeast: (p: { min: number }) => `至少 ${p.min}`,
  limitAtMost: (p: { max: number }) => `至多 ${p.max}`,
  limitBetween: (p: { min: number; max: number }) => `介於 ${p.min} 與 ${p.max} 之間`,
  limitYes: '是',
  limitNo: '否',
  limitAny: '任意',
  valueYes: '是',
  valueNo: '否',

  /** Errors (error codes REVIEW_REASON_REQUIRED, REVIEW_UNKNOWN_FINDING, REVIEW_CRITERIA_INVALID, REVIEW_CRITERIA_CONFLICT). */
  reasonRequired: '請寫明原因：保留發現項或降低其重要程度需要理由',
  reasonTooLong: (p: { limit: number }) => `原因請保持在 ${p.limit} 個字元以內`,
  unknownFinding: (p: { id: string }) => `此影片的標準中沒有名為「${p.id}」的檢查或問題`,
  criteriaInvalid: '標準有問題需先修正才能儲存',
  criteriaConflict: '標準已在其他地方變更；請重新讀取後再試',
  answersInvalid: '回答格式不正確：每個問題應有一筆，包含判定與證據',

  /** The per-video decisions document (kind review-plan) and the edits that write it. */
  documentName: '審核決定',
  waiveLabel: (p: { id: string }) => `保留「${p.id}」`,
  unwaiveLabel: (p: { id: string }) => `重新依標準檢查「${p.id}」`,
  severityLabel: (p: { id: string }) => `變更「${p.id}」的重要程度`,

  /** Why a video is held to this standard. */
  reasonBuiltin: '你還沒有設定標準，因此套用的是內建檢查。',
  reasonUser: '依你的標準檢查（設定 › 審核）。',

  /** Notes on judged answers. `kind` is the evidence kind the question declares. */
  notReached: '審核未涵蓋此問題。',
  evidenceMissing: '回答「符合」，但沒有可供查看的內容。',
  evidenceInvalid: (p: { kind: string }): string => {
    switch (p.kind) {
      case 'timestamp':
        return '回答「符合」，但證據不是影片中的一個時間點。';
      case 'frame':
        return '回答「符合」，但證據不是取自此影片的畫格。';
      case 'field':
        return '回答「符合」，但證據沒有指出此影片中的任何內容。';
      case 'quote':
        return '回答「符合」，但引文不在此影片的逐字稿或字幕中。';
      default:
        return '回答「符合」，但無法檢查證據。';
    }
  },

  /** What to do about the built-in checks (`REVIEW_BUILTIN_CHECKS`). */
  builtinFixPlaceholders: '交付前請填滿或移除佔位框。',
  builtinFixBlank: '覆蓋或填補畫面上什麼都沒有的空白處。',
  builtinFixTextEdge: '移動或縮小文字，使其保留在畫面框內。',
};
