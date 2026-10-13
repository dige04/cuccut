import { M } from './approvals-copy.ts';
import { formatApprovals, parseApprovalsArgs } from './approvals-output.ts';
import { defineNoun } from './context.ts';
import { GRANT_OPTIONS, grantOptions } from './grants.ts';
import { formatApprovalGrants, parseApprovalGrantChoice } from './grants-output.ts';

/** `cuccut approvals`: pending approvals (session ones and those of the external service), and handling them (Architecture design §3.12). */
export const approvals = defineNoun({
  name: 'approvals',
  get usage() {
    return M.help;
  },
  options: GRANT_OPTIONS,
  async run(ctx) {
    const command = ctx.parse(() => parseApprovalsArgs(ctx.args));
    if (command.kind === 'list') {
      const result = await ctx.client.request('approvals.list', {});
      const lines = formatApprovals(result.approvals);
      // Approvals that send data out: the data to be authorized is listed below (§12.5).
      const out =
        result.approvals.length === 0 ? lines : result.approvals.flatMap((approval, i) => [lines[i]!, ...formatApprovalGrants(approval)]);
      return ctx.done(result, out);
    }
    const grant = ctx.parse(() => parseApprovalGrantChoice(grantOptions(ctx.values)));
    if (grant && command.decision !== 'allow') throw ctx.usageError(M.persistNeedsAllow);
    const result = await ctx.client.request('approvals.respond', {
      approvalId: command.approvalId,
      decision: command.decision,
      ...(grant ? { grant } : {}),
    });
    if (result.status === 'already-resolved') {
      return ctx.fail({
        code: 'APPROVAL_ALREADY_RESOLVED',
        message: M.alreadyResolved(command.approvalId),
        approvalId: command.approvalId,
      });
    }
    return ctx.done(result, [result.status === 'allowed' ? M.allowed(command.approvalId) : M.denied(command.approvalId)]);
  },
});
