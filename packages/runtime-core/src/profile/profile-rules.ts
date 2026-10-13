import {
  PROFILE_LIMITS,
  PROFILE_RULE_ID_PATTERN,
  RpcError,
  TEMPLATE_ID_PATTERN,
  TEMPLATE_LIMITS,
  profileRuleId,
  refOf,
  type Localized,
  type ProfileRule,
  type ProfileRuleInput,
  type ProfileWarning,
  type RuleStage,
} from '@cuccut/protocol';
import { RcProfile } from '@cuccut/protocol/messages/runtime-core';

/**
 * Rule validation (docs/cuccut/m2-profile-rules.md §4), pure: what `profile.putRule`, the agent tools and the CLI all go through before a rule is saved.
 *
 * - A name and a condition are required, and so is an instruction or a template.
 * - The id follows `PROFILE_RULE_ID_PATTERN`; without one it is generated from the name (`slug-<8 hex>`), unused at that level.
 * - A template id must look like one; a template that is not installed is a warning, not an error (the rule waits for it).
 * - Fields the input leaves out keep the rule's current values when it replaces one, and take the defaults when it is new.
 * - Problems are readable, one "Field: problem" each.
 */

export interface RuleCheckContext {
  /** The rules already at the level the rule goes to. */
  existing: readonly ProfileRule[];
  /** The installed template ids, or null when they are not known (no warning is given then). */
  installedTemplates: ReadonlySet<string> | null;
  /** 8 random hex characters for a generated id. */
  randomHex: () => string;
}

export type RuleCheck =
  | { ok: true; rule: ProfileRule; warnings: ProfileWarning[]; created: boolean }
  | { ok: false; problems: Localized[] };

const problem = (field: Localized, what: Localized): Localized => RcProfile.fieldProblem({ field, problem: what });

export function validateRule(input: ProfileRuleInput, context: RuleCheckContext): RuleCheck {
  const problems: Localized[] = [];
  const current = input.id === undefined ? undefined : context.existing.find((rule) => rule.id === input.id);

  const text = (value: string | undefined, fallback: string, field: Localized, limit: number, required: boolean): string => {
    const out = (value ?? fallback).trim();
    if (required && !out) problems.push(problem(field, RcProfile.required()));
    if (out.length > limit) problems.push(problem(field, RcProfile.tooLong({ limit })));
    return out;
  };
  const name = text(input.name, current?.name ?? '', RcProfile.fieldName(), PROFILE_LIMITS.name, true);
  const when = text(input.when, current?.when ?? '', RcProfile.fieldWhen(), PROFILE_LIMITS.when, true);
  const instruction = text(input.instruction, current?.instruction ?? '', RcProfile.fieldInstruction(), PROFILE_LIMITS.instruction, false);
  const note = text(input.note, current?.note ?? '', RcProfile.fieldNote(), PROFILE_LIMITS.note, false);

  const templateInput = input.templateId === undefined ? (current?.templateId ?? null) : input.templateId;
  const templateId = templateInput === null || templateInput.trim() === '' ? null : templateInput.trim();
  if (templateId !== null && (templateId.length > TEMPLATE_LIMITS.id || !TEMPLATE_ID_PATTERN.test(templateId))) {
    problems.push(problem(RcProfile.fieldTemplate(), RcProfile.badTemplateId()));
  }
  if (!instruction && templateId === null) problems.push(problem(RcProfile.fieldInstruction(), RcProfile.needInstructionOrTemplate()));

  if (input.id !== undefined && !PROFILE_RULE_ID_PATTERN.test(input.id)) problems.push(problem(RcProfile.fieldId(), RcProfile.badId()));
  if (input.order !== undefined && !Number.isInteger(input.order)) problems.push(problem(RcProfile.fieldOrder(), RcProfile.badOrder()));
  if (!current && context.existing.length >= PROFILE_LIMITS.rules) problems.push(RcProfile.ruleLimit({ limit: PROFILE_LIMITS.rules }));

  if (problems.length > 0) return { ok: false, problems };

  const id = input.id ?? newRuleId(name, context);
  const stage: RuleStage = input.stage ?? current?.stage ?? 'any';
  const order = input.order ?? current?.order ?? nextOrder(context.existing);
  const rule: ProfileRule = {
    id,
    name,
    when,
    instruction,
    templateId,
    stage,
    order,
    enabled: input.enabled ?? current?.enabled ?? true,
    note,
    source: null,
  };
  const warnings: ProfileWarning[] = [];
  if (templateId !== null && context.installedTemplates && !context.installedTemplates.has(templateId)) {
    const message = RcProfile.templateMissing({ id: templateId });
    warnings.push({ code: 'template-missing', message: message.text, messageRef: refOf(message) });
  }
  return { ok: true, rule, warnings, created: !current };
}

/** `invalid-request` with every problem, readable on one line and listed in `details.problems`. */
export function ruleInvalidError(problems: readonly Localized[]): RpcError {
  const joined = problems.map((p) => p.text).join(RcProfile.problemSeparator().text);
  return new RpcError('invalid-request', RcProfile.ruleInvalid({ problems: joined }), {
    code: 'PROFILE_RULE_INVALID',
    problems: problems.map((p) => p.text),
  });
}

/** A new rule goes after the last one. */
export function nextOrder(rules: readonly ProfileRule[]): number {
  return rules.length === 0 ? 10 : Math.max(...rules.map((r) => r.order)) + 10;
}

function newRuleId(name: string, context: RuleCheckContext): string {
  const taken = new Set(context.existing.map((r) => r.id));
  // Random first; a source that keeps repeating itself (a fixed one in tests) falls back to counting.
  for (let attempt = 0; ; attempt++) {
    const id = profileRuleId(name, attempt < 8 ? context.randomHex() : attempt.toString(16).padStart(8, '0'));
    if (!taken.has(id)) return id;
  }
}

/**
 * The rules that hold in a session: the workspace's, then the project's (read later, so they win a disagreement). A project rule with the same id as a
 * workspace rule shadows it. Disabled rules are left out.
 */
export function effectiveRules(workspace: readonly ProfileRule[], project: readonly ProfileRule[]): ProfileRule[] {
  const shadowed = new Set(project.map((r) => r.id));
  return [...workspace.filter((r) => !shadowed.has(r.id)), ...project].filter((r) => r.enabled);
}

/** The enabled rules for one stage: those of that stage and those for any stage. */
export function rulesForStage(rules: readonly ProfileRule[], stage: RuleStage): ProfileRule[] {
  return rules.filter((r) => r.enabled && (r.stage === 'any' || stage === 'any' || r.stage === stage));
}
