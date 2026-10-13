import { getLocale } from '@cuccut/protocol';
import { defineNoun } from './context.ts';
import { M } from './templates-copy.ts';
import { formatTemplateDetail, formatTemplateList } from './templates-output.ts';

/**
 * `cuccut templates`: the creative template catalog (template package spec §6). Templates are briefs for the CucCut agent; external agents use the skill.
 * Asks for the template's language version according to the CLI output language (spec §3.6).
 */
export const templates = defineNoun({
  name: 'templates',
  get usage() {
    return M.help;
  },
  options: {},
  async run(ctx) {
    const [sub, id, ...extra] = ctx.args;
    if (sub === undefined || (sub === 'list' && id === undefined)) {
      const result = await ctx.client.request('templates.list', { language: getLocale() });
      return ctx.done(result, formatTemplateList(result));
    }
    if (sub === 'show' && id && extra.length === 0) {
      const result = await ctx.client.request('templates.get', { id, language: getLocale() });
      return ctx.done(result, formatTemplateDetail(result));
    }
    throw ctx.usageError();
  },
});
