import fs from 'node:fs/promises';
import { newId, type Id, type ProfileRule, type ProfileRuleInput } from '@cuccut/protocol';
import { defineNoun, readStdin, type AdminRun, type AdminValues } from './context.ts';
import { M } from './profile-copy.ts';
import { formatAnswerSaved, formatProfile, formatRules, formatWriteResult, movedOrder, parseQuestionId, type ProfileShow } from './profile-output.ts';

/**
 * Admin bucket `cuccut profile …` (docs/cuccut/m2-profile-rules.md): the user's interview, preferences and rules from the terminal. The desktop
 * screens (Settings → You, Settings → Rules, the project dialog) and the agent tools go through the same `profile.*` methods.
 *
 * - `show` reads what the `profile_show` tool gives agents, so `--json` is the same shape on every surface.
 * - `--project <id>` works on that project's level; `show` without it uses the project of the current folder, like other catalog commands.
 * - `interview write` waits for the agent's run (up to four minutes).
 */

/** How long `interview write` waits: the agent's run has 3 minutes, plus writing the glossary. */
const WRITE_TIMEOUT_MS = 240_000;

const options = {
  project: { type: 'string' },
  file: { type: 'string' },
} as const;

type Ctx = AdminRun<AdminValues<typeof options>>;

export const profile = defineNoun({
  name: 'profile',
  partial: true,
  verbs: ['show', 'answers', 'interview', 'preferences', 'rules'],
  get usage() {
    return M.help;
  },
  options,
  async run(ctx) {
    const [sub, ...rest] = ctx.args;
    if (ctx.values.file !== undefined && sub !== 'preferences') throw ctx.usageError();
    switch (sub) {
      case 'show':
        if (rest.length > 0) throw ctx.usageError();
        return show(ctx);
      case 'answers':
        return answers(ctx, rest);
      case 'interview':
        return interview(ctx, rest);
      case 'preferences':
        if (rest.length > 0) throw ctx.usageError();
        return preferences(ctx);
      case 'rules':
        return rules(ctx, rest);
      default:
        throw ctx.usageError();
    }
  },
});

async function show(ctx: Ctx) {
  const projectId = ctx.values.project;
  let project: string | undefined;
  if (projectId !== undefined) {
    const { projects } = await ctx.client.request('projects.list', {});
    const found = projects.find((p) => p.id === projectId);
    if (!found) throw ctx.usageError(M.projectMissing(projectId));
    project = found.path;
  }
  const outcome = await ctx.client.request('catalog.call', { name: 'profile_show', args: {}, cwd: ctx.cwd, ...(project ? { project } : {}) });
  if (!outcome.ok) return ctx.fail(outcome.error);
  const { readOnly } = await ctx.client.request('profile.get', {});
  return ctx.done(outcome.result, formatProfile(outcome.result as ProfileShow, readOnly));
}

async function answers(ctx: Ctx, args: string[]) {
  const [verb, question, ...words] = args;
  if (verb !== 'set' || question === undefined || ctx.values.project !== undefined) throw ctx.usageError();
  const id = ctx.parse(() => parseQuestionId(question));
  const text = words.join(' ');
  const result = await ctx.client.request('profile.saveAnswers', { answers: { [id]: text }, commandId: newId('cmd') });
  return ctx.done(result, [formatAnswerSaved(id, text)]);
}

async function interview(ctx: Ctx, args: string[]) {
  const [verb, ...extra] = args;
  if (extra.length > 0 || ctx.values.project !== undefined) throw ctx.usageError();
  if (verb === 'skip') {
    const result = await ctx.client.request('profile.skipInterview', {});
    return ctx.done(result, [M.interviewSkipped]);
  }
  if (verb === 'reopen') {
    const result = await ctx.client.request('profile.reopenInterview', {});
    return ctx.done(result, [M.interviewReopened]);
  }
  if (verb === 'write') {
    ctx.log(M.writing);
    const result = await ctx.client.request('profile.writeFromAnswers', {}, { timeoutMs: WRITE_TIMEOUT_MS });
    return ctx.done(result, formatWriteResult(result));
  }
  throw ctx.usageError();
}

async function preferences(ctx: Ctx) {
  const file = ctx.values.file;
  if (file === undefined || file === '') throw ctx.usageError(M.needFile);
  const text = file === '-' ? await readStdin(M.stdinPrompt) : await fs.readFile(ctx.resolve(file), 'utf8');
  const projectId = ctx.values.project;
  if (projectId !== undefined) {
    const result = await ctx.client.request('profile.setPreferences', { projectId, own: text });
    const name = await projectName(ctx, projectId);
    return ctx.done(result, [M.projectPreferencesSaved(name, text.trim().length), M.takesEffect]);
  }
  const result = await ctx.client.request('profile.setPreferences', { own: text });
  return ctx.done(result, [M.preferencesSaved(text.trim().length), M.takesEffect]);
}

async function rules(ctx: Ctx, args: string[]) {
  const [verb, id, where, ...extra] = args;
  const projectId = ctx.values.project;
  const level = projectId === undefined ? {} : { projectId };
  if (extra.length > 0) throw ctx.usageError();
  if (verb === 'list') {
    if (id !== undefined) throw ctx.usageError();
    const list = await levelRules(ctx, projectId);
    return ctx.done({ rules: list }, formatRules(list));
  }
  if (id === undefined) throw ctx.usageError();
  if (verb === 'enable' || verb === 'disable') {
    if (where !== undefined) throw ctx.usageError();
    const found = await findRule(ctx, projectId, id);
    const result = await ctx.client.request('profile.putRule', { rule: { ...ruleInput(found), enabled: verb === 'enable' }, ...level });
    return ctx.done(result, [verb === 'enable' ? M.ruleEnabled(found.name) : M.ruleDisabled(found.name), M.takesEffect]);
  }
  if (verb === 'remove') {
    if (where !== undefined) throw ctx.usageError();
    const result = await ctx.client.request('profile.removeRule', { id, ...level });
    return ctx.done(result, [M.ruleRemoved(result.removed.name, result.removed.id), M.takesEffect]);
  }
  if (verb === 'move') {
    if (where === undefined) throw ctx.usageError();
    const list = await levelRules(ctx, projectId);
    const ids = ctx.parse(() => movedOrder(list.map((r) => r.id), id, where));
    const result = await ctx.client.request('profile.reorderRules', { ids, ...level });
    const moved = result.rules.find((r) => r.id === id)!;
    return ctx.done(result, [M.ruleMoved(moved.name, ids.indexOf(id) + 1, ids.length), M.takesEffect]);
  }
  throw ctx.usageError();
}

async function levelRules(ctx: Ctx, projectId: Id | undefined): Promise<ProfileRule[]> {
  return projectId === undefined ? (await ctx.client.request('profile.get', {})).rules : (await ctx.client.request('profile.getProject', { projectId })).rules;
}

async function findRule(ctx: Ctx, projectId: Id | undefined, id: string): Promise<ProfileRule> {
  const found = (await levelRules(ctx, projectId)).find((r) => r.id === id);
  if (!found) throw ctx.usageError(M.ruleMissing(id));
  return found;
}

async function projectName(ctx: Ctx, projectId: Id): Promise<string> {
  const { projects } = await ctx.client.request('projects.list', {});
  return projects.find((p) => p.id === projectId)?.name ?? projectId;
}

/** A saved rule as `profile.putRule` takes it back (everything but the reserved source). */
function ruleInput(rule: ProfileRule): ProfileRuleInput {
  const { source: _source, ...input } = rule;
  return input;
}
