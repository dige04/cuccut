import { z } from 'zod';
import {
  INTERVIEW_QUESTIONS,
  INTERVIEW_QUESTION_TEXT,
  PROFILE_LIMITS,
  REQUIRED_INTERVIEW_QUESTIONS,
  RULE_STAGES,
  RpcError,
  type Id,
  type InterviewAnswers,
  type InterviewQuestionId,
  type ProfileRule,
  type Project,
} from '@cuccut/protocol';
import { RcProfile } from '@cuccut/protocol/messages/runtime-core';
import type { ProfileService } from '../profile/profile-service.ts';
import { PROFILE_BLOCK_NAMES } from '../profile/profile-brief.ts';
import { ToolError, type ToolInfo, type ToolSet } from './tool-catalog.ts';
import { approvalField, confirmSummary, type ToolPrincipal, type ToolScope } from './tool-scope.ts';

/**
 * The user's profile as agent tools (docs/cuccut/m2-profile-rules.md §6): what the user said about themselves, their preferences and their standing
 * rules, read with `profile_show` and changed with the rest. The same service backs the You and Rules screens, the project dialog and `cuccut profile`.
 *
 * - Reading is `read` and is open to external services too (MCP). Writes are on the agent and CLI surfaces only.
 * - Interview answers are the user's own words given in the conversation, so saving them is `edit`. Preferences and rules land outside the project
 *   directory and change every later session, so their writes are `high`: the user sees each one (never "always allowed").
 * - `level: 'project'` is the session's project (on the CLI, the project of `--project` or the current directory). Without one: `PROFILE_NO_PROJECT`.
 * - The rule's "note to yourself" is never shown to agents.
 */

export interface ProfileToolsDeps {
  profile: ProfileService;
  scope: ToolScope;
  /** The project a call works on at the project level: the session's project for an agent, the terminal's project for the CLI; null otherwise. */
  projectOf: (principal: ToolPrincipal) => Project | null;
}

/** Characters of the user's text quoted in an approval summary. */
const SUMMARY_TEXT = 160;

const levelArg = z
  .enum(['workspace', 'project'])
  .describe("workspace: the user's general level, read in every project. project: the current project only (refused with PROFILE_NO_PROJECT outside a project)");

const answerArg = (id: InterviewQuestionId) =>
  z
    .string()
    .max(PROFILE_LIMITS.answer)
    .optional()
    .describe(`${INTERVIEW_QUESTION_TEXT[id]}${REQUIRED_INTERVIEW_QUESTIONS.includes(id) ? ' (the one answer worth giving)' : ''}. Blank clears it`);

const schemas = {
  profile_show: z.strictObject({}),
  profile_answer: z.strictObject({
    answers: z
      .strictObject(Object.fromEntries(INTERVIEW_QUESTIONS.map((id) => [id, answerArg(id)])) as Record<InterviewQuestionId, ReturnType<typeof answerArg>>)
      .describe('The answers to save, by question id (who, record, platforms, annoys, names), in the user\'s own words. Questions left out keep their answers'),
  }),
  profile_skip: z.strictObject({}),
  profile_write: z.strictObject({}),
  profile_preferences_set: z.strictObject({
    level: levelArg,
    text: z.string().max(PROFILE_LIMITS.preferences).describe('Markdown, one preference a line. Written in the user\'s words, not as instructions to yourself'),
    mode: z
      .enum(['append', 'replace'])
      .describe('append: add the lines after the current text (the usual way to remember one more preference). replace: the text becomes exactly this (empty clears it)'),
  }),
  profile_rules_save: z.strictObject({
    level: levelArg,
    rule: z
      .strictObject({
        id: z.string().min(1).max(64).optional().describe('Optional. The id of a rule to replace (from profile_show); without it a new rule is created'),
        name: z.string().max(PROFILE_LIMITS.name).describe('A short name the user will recognise'),
        when: z.string().max(PROFILE_LIMITS.when).describe('The condition in plain language, as the user said it'),
        instruction: z.string().max(PROFILE_LIMITS.instruction).optional().describe('What to do when the condition holds. Required unless templateId is given'),
        templateId: z.string().max(64).nullable().optional().describe('Optional. A creation template to use when the rule applies (templates/<id>); null removes it'),
        stage: z.enum(RULE_STAGES).optional().describe('Optional. any (default), clip (choosing clips) or edit (editing)'),
        order: z.number().int().min(-1_000_000).max(1_000_000).optional().describe('Optional. Lower numbers are read first; a new rule goes after the last one'),
        enabled: z.boolean().optional().describe('Optional. Default true'),
      })
      .describe('The rule. When replacing one, fields left out keep their current values'),
  }),
  profile_rules_remove: z.strictObject({
    level: levelArg,
    id: z.string().min(1).max(64).describe('The rule id, from profile_show'),
  }),
};

type ToolName = keyof typeof schemas;
type Args<N extends ToolName> = z.infer<(typeof schemas)[N]>;

const DEFINITIONS: Record<ToolName, ToolInfo> = {
  profile_show: {
    title: "Show the user's profile",
    description: [
      "Shows the user's profile: interview answers, preferences and standing rules.",
      'interview: the status (pending, skipped or done), each question with whether it is answered, and the answers. preferences: general (the user\'s own text), interviewSection (what the interview wrote) and project (the current project\'s text, null outside a project).',
      'rules: workspace and project rules in the order they are read (a project rule with the same id replaces the workspace one); follow an enabled rule only when its condition holds. names: the names to spell exactly.',
      'New sessions already receive all of this when they start; call it to see changes made since, or the full text when the start-up summary was cut.',
    ].join('\n'),
    annotations: { readOnlyHint: true },
    effect: 'query',
    examples: [{ title: "Show the user's profile", args: {} }],
    surfaces: ['agent', 'mcp', 'cli'],
  },
  profile_answer: {
    title: 'Save interview answers',
    description: [
      'Saves the user\'s answers to interview questions.',
      'Use it when the user answers one of the questions the interview asks (see profile_show for the questions and which are answered). Save their words as they said them; a blank answer clears that question.',
      'Saving never changes the interview status. When three or more questions are answered, you may offer to write their preferences with profile_write.',
    ].join('\n'),
    annotations: { idempotentHint: true },
    effect: 'mutation',
    examples: [
      { title: 'Save what the user makes', args: { answers: { who: 'Coding tutorials for junior web developers' } } },
      { title: 'Save names to spell', args: { answers: { names: 'Deska, Next.js, @pasho' } } },
    ],
    surfaces: ['agent', 'cli'],
  },
  profile_skip: {
    title: 'Skip the interview',
    description: [
      'Marks the interview as skipped (the user does not want to answer now).',
      'The answers given so far are kept, and the user can take the interview later in Settings. Do not ask interview questions again after this.',
    ].join('\n'),
    annotations: { idempotentHint: true },
    effect: 'mutation',
    examples: [{ title: 'Skip the interview', args: {} }],
    surfaces: ['agent', 'cli'],
  },
  profile_write: {
    title: 'Write preferences from the answers',
    description: [
      'Writes the user\'s preferences from their interview answers.',
      'It also adds the names they gave to the transcription glossary. Use it only when the user agrees. It runs the user\'s default agent once, which can take a minute or two; with no agent available the answers are kept as typed (usedAgent false, fallbackReason says why). The interview becomes done.',
      'Fails with PROFILE_NO_ANSWERS when nothing is answered, and PROFILE_WRITE_BUSY while another write runs. The new preferences apply from the next session.',
    ].join('\n'),
    annotations: {},
    effect: 'mutation',
    examples: [{ title: 'Write the preferences', args: {} }],
    surfaces: ['agent', 'cli'],
  },
  profile_preferences_set: {
    title: 'Save a preference',
    description: [
      'Saves the user\'s preferences, in general or for the current project.',
      'Markdown, one preference a line. Use it when the user asks you to remember how they like something done. append adds lines; replace sets the whole text. It never touches the section the interview wrote.',
      'The user is asked to approve every save. Returns the new text; it applies from the next session.',
    ].join('\n'),
    annotations: {},
    effect: 'mutation',
    examples: [
      { title: 'Remember a preference', args: { level: 'workspace', text: '- Keep hooks under three seconds', mode: 'append' } },
      { title: "Set this project's preferences", args: { level: 'project', text: '- Vertical 9:16, captions on', mode: 'replace' } },
    ],
    surfaces: ['agent', 'cli'],
  },
  profile_rules_save: {
    title: 'Save a rule',
    description: [
      'Creates or replaces one of the user\'s standing rules.',
      'A rule says: when a condition holds, follow an instruction (and optionally use a template). Use it when the user asks you to always do something in a situation. Without rule.id a new rule is created; with the id of an existing rule it is replaced (fields left out keep their values).',
      'The user is asked to approve every save. Fails with PROFILE_RULE_INVALID (with readable problems) when the name, condition, or instruction or template is missing; warnings say when a template is not installed.',
    ].join('\n'),
    annotations: {},
    effect: 'mutation',
    examples: [
      {
        title: 'Save a rule',
        args: { level: 'workspace', rule: { name: 'Gameplay stays clear', when: 'the clip is gameplay', instruction: 'Never cover the game with pictures or stickers.', stage: 'edit' } },
      },
      { title: 'Turn a rule off', args: { level: 'project', rule: { id: 'gameplay-stays-clear-0a1b2c3d', name: 'Gameplay stays clear', when: 'the clip is gameplay', enabled: false } } },
    ],
    surfaces: ['agent', 'cli'],
  },
  profile_rules_remove: {
    title: 'Remove a rule',
    description: [
      'Removes one of the user\'s rules.',
      'Use it only when the user asks to drop the rule. The user is asked to approve; the removed rule is returned so it can be saved again with profile_rules_save. Fails with PROFILE_RULE_NOT_FOUND for an unknown id.',
    ].join('\n'),
    annotations: { destructiveHint: true },
    effect: 'destructive',
    examples: [{ title: 'Remove a rule', args: { level: 'workspace', id: 'gameplay-stays-clear-0a1b2c3d' } }],
    surfaces: ['agent', 'cli'],
    positional: 'id',
  },
};

export class ProfileTools implements ToolSet {
  readonly schemas = schemas;
  readonly definitions = DEFINITIONS;
  readonly #deps: ProfileToolsDeps;

  constructor(deps: ProfileToolsDeps) {
    this.#deps = deps;
  }

  async dispatch(name: string, args: unknown, principal: ToolPrincipal): Promise<unknown> {
    try {
      switch (name as ToolName) {
        case 'profile_show':
          return await this.#show(principal);
        case 'profile_answer':
          return await this.#answer(args as Args<'profile_answer'>, principal);
        case 'profile_skip':
          return await this.#skip(principal);
        case 'profile_write':
          return await this.#write(principal);
        case 'profile_preferences_set':
          return await this.#preferences(args as Args<'profile_preferences_set'>, principal);
        case 'profile_rules_save':
          return await this.#saveRule(args as Args<'profile_rules_save'>, principal);
        case 'profile_rules_remove':
          return await this.#removeRule(args as Args<'profile_rules_remove'>, principal);
        default:
          throw new ToolError('UNKNOWN_TOOL', `No such tool: ${name}`);
      }
    } catch (error) {
      throw toolErrorOf(error);
    }
  }

  async #show(principal: ToolPrincipal) {
    const { profile, scope } = this.#deps;
    scope.authorize(principal, false);
    const snapshot = profile.snapshot();
    const project = this.#deps.projectOf(principal);
    const projectLevel = project ? await profile.project(project.id) : null;
    const { answers } = snapshot.interview;
    return {
      interview: {
        status: snapshot.interview.status,
        questions: INTERVIEW_QUESTIONS.map((id) => ({
          id,
          text: INTERVIEW_QUESTION_TEXT[id],
          required: REQUIRED_INTERVIEW_QUESTIONS.includes(id),
          answered: Boolean(answers[id]),
        })),
        answers,
      },
      preferences: {
        general: snapshot.preferences.own,
        interviewSection: snapshot.preferences.interview,
        project: projectLevel ? projectLevel.preferences : null,
      },
      rules: {
        workspace: snapshot.rules.map(agentRule),
        project: projectLevel ? projectLevel.rules.map(agentRule) : null,
      },
      names: profile.names(PROFILE_BLOCK_NAMES),
      project: project ? { projectId: project.id, name: project.name } : null,
    };
  }

  async #answer(args: Args<'profile_answer'>, principal: ToolPrincipal) {
    const { profile, scope } = this.#deps;
    const access = scope.authorize(principal, true);
    const given = Object.entries(args.answers).filter(([, value]) => value !== undefined) as [InterviewQuestionId, string][];
    if (given.length === 0) throw new ToolError('INVALID_ARGUMENTS', 'Give at least one answer, by question id (who, record, platforms, annoys, names)');
    profile.assertWritable();
    const approval = await scope.confirm(access, {
      tool: 'profile_answer',
      ...confirmSummary(RcProfile.toolAnswerSummary({ questions: given.map(([id, value]) => `${id}: ${clip(value) || '—'}`).join('; ') })),
      risk: 'edit',
    });
    const answers: InterviewAnswers = Object.fromEntries(given);
    const state = await profile.saveAnswers(answers);
    const answered = INTERVIEW_QUESTIONS.length - state.remaining.length;
    return {
      ...state,
      ...approvalField(approval),
      next:
        state.status === 'pending' && answered >= 3 && !profile.snapshot().hasPreferences
          ? 'Enough is answered: you may offer to write their preferences with profile_write. Ask at most one more question per reply.'
          : 'Saved. Ask at most one more question per reply, and never let it delay the work.',
    };
  }

  async #skip(principal: ToolPrincipal) {
    const { profile, scope } = this.#deps;
    const access = scope.authorize(principal, true);
    profile.assertWritable();
    const approval = await scope.confirm(access, { tool: 'profile_skip', ...confirmSummary(RcProfile.toolSkipSummary()), risk: 'edit' });
    return { ...(await profile.skip()), ...approvalField(approval), next: 'Skipped: do not ask interview questions again in this conversation.' };
  }

  async #write(principal: ToolPrincipal) {
    const { profile, scope } = this.#deps;
    const access = scope.authorize(principal, true);
    profile.assertWritable();
    // Fail before asking when there is nothing to write.
    profile.answersForWrite();
    const approval = await scope.confirm(access, { tool: 'profile_write', ...confirmSummary(RcProfile.toolWriteSummary()), risk: 'high' });
    const result = await profile.writeFromAnswers();
    return {
      ...result,
      ...approvalField(approval),
      next: 'The preferences are saved; the user can read and edit them in Settings, You. They apply from the next session.',
    };
  }

  async #preferences(args: Args<'profile_preferences_set'>, principal: ToolPrincipal) {
    const { profile, scope } = this.#deps;
    const access = scope.authorize(principal, true);
    const project = args.level === 'project' ? this.#project(principal) : null;
    const current = project ? (await profile.project(project.id)).preferences : profile.snapshot().preferences.own;
    const added = args.text.trim();
    const text = args.mode === 'append' ? [current.trimEnd(), added].filter(Boolean).join('\n') : added;
    if (text.length > PROFILE_LIMITS.preferences) {
      throw new ToolError(
        'PROFILE_TOO_LONG',
        `The preferences would be ${text.length} characters, over the ${PROFILE_LIMITS.preferences} limit: shorten them, or replace the text with a tighter version`,
      );
    }
    if (!project) profile.assertWritable();
    const where = project ? RcProfile.levelProject({ name: project.name }) : RcProfile.levelWorkspace();
    const summary =
      args.mode === 'append'
        ? RcProfile.toolPreferencesAppend({ where, text: clip(added) })
        : RcProfile.toolPreferencesReplace({ where, text: clip(added) || '—' });
    const approval = await scope.confirm(access, { tool: 'profile_preferences_set', ...confirmSummary(summary), risk: 'high' });
    const saved = project ? (await profile.setProjectPreferences(project.id, text)).preferences : (await profile.setPreferences({ own: text })).preferences.own;
    return { level: args.level, text: saved, ...approvalField(approval), next: 'Saved. It applies from the next session; follow it from now on in this one too.' };
  }

  async #saveRule(args: Args<'profile_rules_save'>, principal: ToolPrincipal) {
    const { profile, scope } = this.#deps;
    const access = scope.authorize(principal, true);
    const project = args.level === 'project' ? this.#project(principal) : null;
    const projectId = project?.id;
    if (!project) profile.assertWritable();
    // Check first, so the user is not asked to approve a rule that can't be saved.
    const { rule } = await profile.checkRule(args.rule, projectId);
    const where = project ? RcProfile.levelProject({ name: project.name }) : RcProfile.levelWorkspace();
    const action = rule.instruction ? clip(rule.instruction) : RcProfile.toolRuleTemplate({ id: rule.templateId ?? '' });
    const approval = await scope.confirm(access, {
      tool: 'profile_rules_save',
      ...confirmSummary(RcProfile.toolRuleSave({ where, name: rule.name, when: clip(rule.when), action })),
      risk: 'high',
    });
    const saved = await profile.putRule({ ...args.rule, id: rule.id }, projectId);
    return {
      level: args.level,
      rule: agentRule(saved.rule),
      warnings: saved.warnings.map((w) => ({ code: w.code, message: w.message })),
      ...approvalField(approval),
      next: 'Saved. It applies from the next session; follow it from now on in this one too.',
    };
  }

  async #removeRule(args: Args<'profile_rules_remove'>, principal: ToolPrincipal) {
    const { profile, scope } = this.#deps;
    const access = scope.authorize(principal, true);
    const project = args.level === 'project' ? this.#project(principal) : null;
    const rules = project ? (await profile.project(project.id)).rules : profile.snapshot().rules;
    const found = rules.find((r) => r.id === args.id);
    if (!found) throw new RpcError('not-found', RcProfile.ruleNotFound({ id: args.id }), { code: 'PROFILE_RULE_NOT_FOUND', ruleId: args.id });
    if (!project) profile.assertWritable();
    const where = project ? RcProfile.levelProject({ name: project.name }) : RcProfile.levelWorkspace();
    const approval = await scope.confirm(access, {
      tool: 'profile_rules_remove',
      ...confirmSummary(RcProfile.toolRuleRemove({ where, name: found.name })),
      risk: 'high',
    });
    const { removed } = await profile.removeRule(args.id, project?.id);
    return {
      level: args.level,
      removed: agentRule(removed),
      ...approvalField(approval),
      next: 'Removed. To bring it back, save the removed rule again with profile_rules_save.',
    };
  }

  #project(principal: ToolPrincipal): Project {
    const project = this.#deps.projectOf(principal);
    if (!project) throw new ToolError('PROFILE_NO_PROJECT', RcProfile.noProject().text);
    return project;
  }
}

/**
 * The project a call works on at the project level: an agent's session project; the terminal's project (`--project`, or found from the current
 * directory) when it is registered; none for external services.
 */
export function profileProjectOf(projects: { conversationOf(id: Id): { projectId: Id | null } | undefined; listProjects(): Project[] }, principal: ToolPrincipal): Project | null {
  const projectId =
    principal.kind === 'agent'
      ? (projects.conversationOf(principal.conversationId)?.projectId ?? null)
      : principal.kind === 'local' && principal.projectDir
        ? (projects.listProjects().find((p) => p.path === principal.projectDir)?.id ?? null)
        : null;
  return (projectId && projects.listProjects().find((p) => p.id === projectId)) || null;
}

/** A rule as agents see it: without the user's note to themselves (and the reserved source). */
function agentRule(rule: ProfileRule) {
  const { note: _note, source: _source, ...shown } = rule;
  return shown;
}

function clip(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim();
  const chars = [...line];
  return chars.length > SUMMARY_TEXT ? `${chars.slice(0, SUMMARY_TEXT - 1).join('')}…` : line;
}

/** Profile rejections (`PROFILE_RULE_INVALID`, `PROFILE_READ_ONLY`, ...) become tool error codes, with their details. */
function toolErrorOf(error: unknown): unknown {
  if (error instanceof RpcError && typeof error.details === 'object' && error.details !== null) {
    const { code, ...rest } = error.details as Record<string, unknown>;
    if (typeof code === 'string') return new ToolError(code, error.message, rest);
  }
  return error;
}
