import type { RpcHandlers } from '../handlers.ts';
import type { ReviewDecisionOptions, ReviewService } from './review-service.ts';

type ReviewMethod =
  | 'review.catalogue'
  | 'review.criteria.get'
  | 'review.criteria.set'
  | 'review.check'
  | 'review.run'
  | 'review.get'
  | 'review.waive'
  | 'review.unwaive'
  | 'review.severity';

/**
 * Handlers for `review.*` (docs/cuccut/m2-review-gate.md §4.5), merged into the method table by `handlers.ts`. They are
 * the same `ReviewService` calls the review agent tools make, so the UI, the CLI and the agent hold a video to the
 * standard the same way. Answers to the questions come only from the agent tool (`review_answer`); there is no method
 * for them. The Web service's allowlist leaves out `review.criteria.set` (the standard is the user's, like settings).
 */
export function reviewMethods(review: ReviewService): Pick<RpcHandlers['methods'], ReviewMethod> {
  const decision = (p: { expectedRevision?: string; commandId?: string }): ReviewDecisionOptions => ({
    ...(p.expectedRevision !== undefined ? { expectedRevision: p.expectedRevision } : {}),
    ...(p.commandId !== undefined ? { commandId: p.commandId } : {}),
  });
  return {
    'review.catalogue': () => ({ metrics: [...review.catalogue()] }),
    'review.criteria.get': (p) => review.criteria(p.videoId),
    'review.criteria.set': (p) => review.setCriteria(p.standard, p.expectedRevision),
    'review.check': (p) => review.check(p.videoId, p.sequenceId),
    'review.run': async (p) => ({
      result: await review.run(p.videoId, {
        ...(p.sequenceId !== undefined ? { sequenceId: p.sequenceId } : {}),
        ...(p.revision !== undefined ? { revision: p.revision } : {}),
      }),
    }),
    'review.get': async (p) => ({ result: await review.get(p.videoId) }),
    'review.waive': (p, principal) => review.waive(p.videoId, p.id, p.reason, principal, decision(p)),
    'review.unwaive': (p, principal) => review.unwaive(p.videoId, p.id, principal, decision(p)),
    'review.severity': (p, principal) => review.setSeverity(p.videoId, p.id, p.severity, p.reason, principal, decision(p)),
  };
}
