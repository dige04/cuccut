import { z } from 'zod';
import { INTERVIEW_QUESTIONS, PROFILE_LIMITS, RULE_STAGES, type InterviewQuestionId } from './profile.ts';

/**
 * `profile.*`: inbound validation, merged into the method table by `schemas.ts`. Shapes, types and lengths are checked here; whether a rule is complete
 * (a name, a condition, an instruction or a template, the id pattern) is checked by the Runtime, which answers in readable "Field: problem" lines (`PROFILE_RULE_INVALID`).
 */

const id = z.string().min(1).max(200);
const projectId = id;
const ruleId = z.string().min(1).max(64);

/** Interview answers: only the known question ids. A blank answer clears that question. */
export const interviewAnswersSchema = z
  .object(
    Object.fromEntries(INTERVIEW_QUESTIONS.map((q) => [q, z.string().max(PROFILE_LIMITS.answer).optional()])) as Record<
      InterviewQuestionId,
      z.ZodOptional<z.ZodString>
    >,
  )
  .strict();

export const profileRuleInputSchema = z
  .object({
    id: ruleId.optional(),
    name: z.string().max(PROFILE_LIMITS.name),
    when: z.string().max(PROFILE_LIMITS.when),
    instruction: z.string().max(PROFILE_LIMITS.instruction).optional(),
    templateId: z.string().max(64).nullable().optional(),
    stage: z.enum(RULE_STAGES).optional(),
    order: z.number().int().min(-1_000_000).max(1_000_000).optional(),
    enabled: z.boolean().optional(),
    note: z.string().max(PROFILE_LIMITS.note).optional(),
  })
  .strict();

const preferencesText = z.string().max(PROFILE_LIMITS.preferences);

export const PROFILE_PARAM_SCHEMAS = {
  'profile.get': z.object({}).strict(),
  'profile.getProject': z.object({ projectId }).strict(),
  'profile.saveAnswers': z.object({ answers: interviewAnswersSchema, commandId: id.optional() }).strict(),
  'profile.skipInterview': z.object({}).strict(),
  'profile.reopenInterview': z.object({}).strict(),
  'profile.dismissReminder': z.object({}).strict(),
  'profile.writeFromAnswers': z.object({ answers: interviewAnswersSchema.optional() }).strict(),
  'profile.setPreferences': z.object({ projectId: projectId.optional(), own: preferencesText.optional(), interview: preferencesText.optional() }).strict(),
  'profile.putRule': z.object({ rule: profileRuleInputSchema, projectId: projectId.optional() }).strict(),
  'profile.removeRule': z.object({ id: ruleId, projectId: projectId.optional() }).strict(),
  'profile.reorderRules': z.object({ ids: z.array(ruleId).max(PROFILE_LIMITS.rules), projectId: projectId.optional() }).strict(),
} as const;
