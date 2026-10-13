import type { RcReviewMessages } from './rc-review.ts';

const s = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const zhHans: RcReviewMessages = {
  blocked: (p: { count: number }) => `此视频尚未符合你的标准：${p.count} 个发现会阻止此次导出`,
  blockedRemedy: '修正列出的问题后重新导出，或打开审阅并附上原因保留某个发现通过。',
  findingLine: (p: { metric: string; value: string; limit: string; fix: string }) =>
    `${p.metric} 为 ${p.value}，而标准要求 ${p.limit}。${p.fix ? ` ${p.fix}` : ''}`,
  limitAtLeast: (p: { min: number }) => `至少 ${p.min}`,
  limitAtMost: (p: { max: number }) => `至多 ${p.max}`,
  limitBetween: (p: { min: number; max: number }) => `${p.min} 到 ${p.max}`,
  limitYes: '是',
  limitNo: '否',
  limitAny: '任意',
  valueYes: '是',
  valueNo: '否',

  /** Errors (error codes REVIEW_REASON_REQUIRED, REVIEW_UNKNOWN_FINDING, REVIEW_CRITERIA_INVALID, REVIEW_CRITERIA_CONFLICT). */
  reasonRequired: '请写明原因：保留某个发现通过或降低其重要程度需要原因',
  reasonTooLong: (p: { limit: number }) => `原因请控制在 ${p.limit} 个字符以内`,
  unknownFinding: (p: { id: string }) => `此视频的标准中没有名为“${p.id}”的检查项或问题`,
  criteriaInvalid: '标准存在需要修正的问题，才能保存',
  criteriaConflict: '标准已在别处被修改；请重新读取后再试',
  answersInvalid: '回答格式不对：每个问题一条，需包含结论和证据',

  /** The per-video decisions document (kind review-plan) and the edits that write it. */
  documentName: '检查决定',
  waiveLabel: (p: { id: string }) => `保留通过“${p.id}”`,
  unwaiveLabel: (p: { id: string }) => `重新按标准检查“${p.id}”`,
  severityLabel: (p: { id: string }) => `更改“${p.id}”的重要程度`,

  /** Why a video is held to this standard. */
  reasonBuiltin: '你还没有设定标准，所以这里用的是内置检查。',
  reasonUser: '按你的标准检查（设置 › 审阅）。',

  /** Notes on judged answers. `kind` is the evidence kind the question declares. */
  notReached: '审阅未涉及此问题。',
  evidenceMissing: '回答“符合”，但没有可供查看的内容。',
  evidenceInvalid: (p: { kind: string }) => {
    switch (p.kind) {
      case 'timestamp':
        return '回答“符合”，但证据不是视频内的某个时间点。';
      case 'frame':
        return '回答“符合”，但证据不是取自此视频的画面。';
      case 'field':
        return '回答“符合”，但证据没有指明此视频中的任何内容。';
      case 'quote':
        return '回答“符合”，但引文不在此视频的台词或字幕中。';
      default:
        return '回答“符合”，但无法核实证据。';
    }
  },

  /** What to do about the built-in checks (`REVIEW_BUILTIN_CHECKS`). */
  builtinFixPlaceholders: '交付前请填满或移除占位框。',
  builtinFixBlank: '请遮盖或填补画面上空无一物的空白。',
  builtinFixTextEdge: '请移动或缩小文字，使其留在画面之内。',
};
