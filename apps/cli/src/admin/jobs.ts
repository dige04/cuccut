import { defineNoun } from './context.ts';
import { M } from './jobs-copy.ts';
import { formatReconcileResult, formatResources, parseJobsArgs } from './jobs-output.ts';

/**
 * Admin bucket `cuccut jobs resources|reconcile` (Architecture design §7.6, §7.7). Listing, inspecting, waiting on, cancelling and retrying tasks are on the Agent surface
 * (`jobs list|inspect|wait|cancel|retry`).
 */
export const jobs = defineNoun({
  name: 'jobs',
  partial: true,
  verbs: ['resources', 'reconcile'],
  get usage() {
    return M.help;
  },
  options: {},
  async run(ctx) {
    const command = ctx.parse(() => parseJobsArgs(ctx.args));
    if (command.kind === 'resources') {
      const result = await ctx.client.request('jobs.resources', {});
      return ctx.done(result, formatResources(result));
    }
    const job = await ctx.client.request('jobs.reconcile', { jobId: command.jobId, decision: command.decision });
    return ctx.done(job, formatReconcileResult(command.decision, job));
  },
});
