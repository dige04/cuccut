import { defineCatalog } from '../../message-ref.ts';
import { zhHans } from './rc-review.zh-Hans.ts';
import { zhHant } from './rc-review.zh-Hant.ts';
import { ja } from './rc-review.ja.ts';
import { ko } from './rc-review.ko.ts';
import { es } from './rc-review.es.ts';
import { fr } from './rc-review.fr.ts';
import { de } from './rc-review.de.ts';
import { nl } from './rc-review.nl.ts';
import { ptBR } from './rc-review.pt-BR.ts';
import { it } from './rc-review.it.ts';
import { ru } from './rc-review.ru.ts';
import { pl } from './rc-review.pl.ts';
import { tr } from './rc-review.tr.ts';
import { vi } from './rc-review.vi.ts';

const s = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * Review gate before delivery (review/): the export refusal and its remedy, errors of `review.*`, the edit labels of
 * the per-video decisions, notes on judged answers, and the wording of built-in checks. English is the source of keys
 * and types; translations are in `rc-review.<language>.ts`.
 */
const en = {
  /** The `REVIEW_BLOCKED` refusal of `exports.create`. */
  blocked: (p: { count: number }) =>
    `This video doesn’t meet your standard yet: ${p.count} ${s(p.count, 'finding stops', 'findings stop')} this export`,
  blockedRemedy: 'Fix what’s listed and export again, or open the review and let a finding stand with a reason.',
  /** One finding as a line: what was measured, the limit, and what to do. `value` and `limit` are already worded. */
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

  /** Errors (error codes REVIEW_REASON_REQUIRED, REVIEW_UNKNOWN_FINDING, REVIEW_CRITERIA_INVALID, REVIEW_CRITERIA_CONFLICT). */
  reasonRequired: 'Say why: letting a finding stand or lowering what it’s worth needs a reason',
  reasonTooLong: (p: { limit: number }) => `Keep the reason under ${p.limit} characters`,
  unknownFinding: (p: { id: string }) => `This video’s standard has no check or question called “${p.id}”`,
  criteriaInvalid: 'The standard has problems to fix before it can be saved',
  criteriaConflict: 'The standard was changed somewhere else; read it again and retry',
  answersInvalid: 'The answers aren’t in the expected shape: one entry per question, with a verdict and evidence',

  /** The per-video decisions document (kind review-plan) and the edits that write it. */
  documentName: 'Review decisions',
  waiveLabel: (p: { id: string }) => `Let “${p.id}” stand`,
  unwaiveLabel: (p: { id: string }) => `Hold “${p.id}” to the standard again`,
  severityLabel: (p: { id: string }) => `Change what “${p.id}” is worth`,

  /** Why a video is held to this standard. */
  reasonBuiltin: 'You haven’t set a standard yet, so these are the built-in checks.',
  reasonUser: 'Held to your standard (Settings › Review).',

  /** Notes on judged answers. `kind` is the evidence kind the question declares. */
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

  /** What to do about the built-in checks (`REVIEW_BUILTIN_CHECKS`). */
  builtinFixPlaceholders: 'Fill or remove the placeholder boxes before delivering.',
  builtinFixBlank: 'Cover or close the gap where nothing is on screen.',
  builtinFixTextEdge: 'Move or narrow the text so it stays inside the frame.',
};

export type RcReviewMessages = typeof en;

export const RcReview = defineCatalog('rcReview', en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
