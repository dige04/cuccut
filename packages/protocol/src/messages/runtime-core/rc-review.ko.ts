import type { RcReviewMessages } from './rc-review.ts';

const s = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const ko: RcReviewMessages = {
  blocked: (p: { count: number }) =>
    `이 영상은 아직 기준을 충족하지 않습니다: ${p.count}개의 ${s(p.count, '발견 사항', '발견 사항')}이 이 내보내기를 막고 있습니다`,
  blockedRemedy: '나열된 항목을 고친 뒤 다시 내보내거나, 검토를 열어 이유와 함께 발견 사항을 유지하세요.',
  findingLine: (p: { metric: string; value: string; limit: string; fix: string }) =>
    `${p.metric}은(는) ${p.value}인데, 기준은 ${p.limit}을(를) 요구합니다.${p.fix ? ` ${p.fix}` : ''}`,
  limitAtLeast: (p: { min: number }) => `${p.min} 이상`,
  limitAtMost: (p: { max: number }) => `${p.max} 이하`,
  limitBetween: (p: { min: number; max: number }) => `${p.min}~${p.max}`,
  limitYes: '예',
  limitNo: '아니요',
  limitAny: '무엇이든',
  valueYes: '예',
  valueNo: '아니요',

  /** Errors (error codes REVIEW_REASON_REQUIRED, REVIEW_UNKNOWN_FINDING, REVIEW_CRITERIA_INVALID, REVIEW_CRITERIA_CONFLICT). */
  reasonRequired: '이유를 적으세요: 발견 사항을 유지하거나 중요도를 낮추려면 이유가 필요합니다',
  reasonTooLong: (p: { limit: number }) => `이유는 ${p.limit}자 미만으로 적으세요`,
  unknownFinding: (p: { id: string }) => `이 영상의 기준에는 “${p.id}”라는 이름의 검사나 질문이 없습니다`,
  criteriaInvalid: '기준에 저장하기 전에 해결해야 할 문제가 있습니다',
  criteriaConflict: '기준이 다른 곳에서 변경되었습니다. 다시 읽고 재시도하세요',
  answersInvalid: '답변이 예상된 형식이 아닙니다: 질문마다 하나의 항목으로, 판정과 근거를 포함해야 합니다',

  /** The per-video decisions document (kind review-plan) and the edits that write it. */
  documentName: '검토 결정',
  waiveLabel: (p: { id: string }) => `“${p.id}” 유지`,
  unwaiveLabel: (p: { id: string }) => `“${p.id}”을(를) 다시 기준에 맞춰 검토`,
  severityLabel: (p: { id: string }) => `“${p.id}”의 중요도 변경`,

  /** Why a video is held to this standard. */
  reasonBuiltin: '아직 기준을 설정하지 않아 기본 제공 검사를 적용하고 있습니다.',
  reasonUser: '내 기준에 따라 검토합니다(설정 › 검토).',

  /** Notes on judged answers. `kind` is the evidence kind the question declares. */
  notReached: '검토가 이 질문까지 도달하지 못했습니다.',
  evidenceMissing: '“충족”으로 답했지만 확인할 것이 없습니다.',
  evidenceInvalid: (p: { kind: string }): string => {
    switch (p.kind) {
      case 'timestamp':
        return '“충족”으로 답했지만, 근거가 영상 안의 시간이 아닙니다.';
      case 'frame':
        return '“충족”으로 답했지만, 근거가 이 영상에서 가져온 프레임이 아닙니다.';
      case 'field':
        return '“충족”으로 답했지만, 근거가 이 영상의 무엇도 가리키지 않습니다.';
      case 'quote':
        return '“충족”으로 답했지만, 인용문이 이 영상의 대본이나 자막에 없습니다.';
      default:
        return '“충족”으로 답했지만, 근거를 확인할 수 없습니다.';
    }
  },

  /** What to do about the built-in checks (`REVIEW_BUILTIN_CHECKS`). */
  builtinFixPlaceholders: '납품 전에 자리표시자 상자를 채우거나 삭제하세요.',
  builtinFixBlank: '화면에 아무것도 없는 빈 공간을 가리거나 메우세요.',
  builtinFixTextEdge: '텍스트를 옮기거나 폭을 줄여 프레임 안에 들어오게 하세요.',
};
