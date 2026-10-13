import { defineNoun } from './context.ts';
import { M } from './grants-copy.ts';
import { formatGrants, formatRevoke, formatUsage, parseGrantsArgs, type GrantOptions } from './grants-output.ts';

/** Grant-related flags (shared by `grants` and `approvals allow --persist`). */
export const GRANT_OPTIONS = {
  recipient: { type: 'string' },
  data: { type: 'string' },
  video: { type: 'string' },
  purpose: { type: 'string' },
  'max-calls': { type: 'string' },
  budget: { type: 'string' },
  currency: { type: 'string' },
  expires: { type: 'string' },
  scope: { type: 'string' },
  persist: { type: 'boolean' },
  'include-ended': { type: 'boolean' },
} as const;

export function grantOptions(values: Record<string, unknown>): GrantOptions {
  const str = (key: string) => (typeof values[key] === 'string' ? (values[key] as string) : undefined);
  return {
    recipient: str('recipient'),
    data: str('data'),
    video: str('video'),
    purpose: str('purpose'),
    maxCalls: str('max-calls'),
    budget: str('budget'),
    currency: str('currency'),
    expires: str('expires'),
    scope: str('scope'),
    persist: values.persist === true,
    includeEnded: values['include-ended'] === true,
  };
}

/** `cuccut grants`: grants and budgets for data sent out (Architecture design §12.5, §7.8). */
export const grants = defineNoun({
  name: 'grants',
  get usage() {
    return M.help;
  },
  options: GRANT_OPTIONS,
  async run(ctx) {
    const command = ctx.parse(() => parseGrantsArgs(ctx.args, grantOptions(ctx.values)));
    switch (command.kind) {
      case 'list': {
        const result = await ctx.client.request('grants.list', command.params);
        return ctx.done(result, formatGrants(result.grants));
      }
      case 'create': {
        const result = await ctx.client.request('grants.create', command.params);
        return ctx.done(result, formatGrants([result.grant]));
      }
      case 'update': {
        const result = await ctx.client.request('grants.update', command.params);
        return ctx.done(result, formatGrants([result.grant]));
      }
      case 'revoke': {
        const result = await ctx.client.request('grants.revoke', { grantId: command.grantId });
        return ctx.done(result, formatRevoke(result));
      }
      case 'usage': {
        const result = await ctx.client.request('grants.usage', { grantId: command.grantId });
        return ctx.done(result, formatUsage(result));
      }
    }
  },
});
