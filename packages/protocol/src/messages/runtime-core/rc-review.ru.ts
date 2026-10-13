import type { RcReviewMessages } from './rc-review.ts';

const s = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const ru: RcReviewMessages = {
  blocked: (p: { count: number }) =>
    `This video doesn’t meet your standard yet: ${p.count} ${s(p.count, 'finding stops', 'findings stop')} this export`,
  blockedRemedy: 'Fix what’s listed and export again, or open the review and let a finding stand with a reason.',
  findingLine: (p: { metric: string; value: string; limit: string; fix: string }) =>
    `${p.metric} is ${p.value}, and the standard asks for ${p.limit}.${p.fix ? ` ${p.fix}` : ''}`,
  limitAtLeast: (p: { min: number }) => `at least ${p.min}`,
  limitAtMost: (p: { max: number }) => `at most ${p.max}`,
  limitBetween: (p: { min: number; max: number }) => `between ${p.min} and ${p.max}`,
  limitYes: 'yes',
  limitNo: 'no',
  limitAny: 'anything',
  valueYes: 'yes',
  valueNo: 'no',
  reasonRequired: 'Say why: letting a finding stand or lowering what it’s worth needs a reason',
  reasonTooLong: (p: { limit: number }) => `Keep the reason under ${p.limit} characters`,
  unknownFinding: (p: { id: string }) => `This video’s standard has no check or question called “${p.id}”`,
  criteriaInvalid: 'The standard has problems to fix before it can be saved',
  criteriaConflict: 'The standard was changed somewhere else; read it again and retry',
  answersInvalid: 'The answers aren’t in the expected shape: one entry per question, with a verdict and evidence',
  documentName: 'Review decisions',
  waiveLabel: (p: { id: string }) => `Let “${p.id}” stand`,
  unwaiveLabel: (p: { id: string }) => `Hold “${p.id}” to the standard again`,
  severityLabel: (p: { id: string }) => `Change what “${p.id}” is worth`,
  reasonBuiltin: 'You haven’t set a standard yet, so these are the built-in checks.',
  reasonUser: 'Held to your standard (Settings › Review).',
  notReached: 'The review didn’t reach this question.',
  evidenceMissing: 'Answered “holds” with nothing to look at.',
  evidenceInvalid: (p: { kind: string }) => {
    switch (p.kind) {
      case 'timestamp':
        return 'Answered “holds”, but the evidence isn’t a time inside the video.';
      case 'frame':
        return 'Answered “holds”, but the evidence isn’t a frame taken from this video.';
      case 'field':
        return 'Answered “holds”, but the evidence doesn’t name anything in this video.';
      case 'quote':
        return 'Answered “holds”, but the quote isn’t in this video’s transcript or captions.';
      default:
        return 'Answered “holds”, but the evidence can’t be checked.';
    }
  },
  builtinFixPlaceholders: 'Fill or remove the placeholder boxes before delivering.',
  builtinFixBlank: 'Cover or close the gap where nothing is on screen.',
  builtinFixTextEdge: 'Move or narrow the text so it stays inside the frame.',
};
