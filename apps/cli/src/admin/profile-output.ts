import {
  INTERVIEW_QUESTIONS,
  type InterviewQuestionId,
  type InterviewStatus,
  type ProfileRule,
  type ProfileWriteFallbackReason,
  type ProfileWriteResult,
  type RuleStage,
} from '@cuccut/protocol';
import { M } from './profile-copy.ts';

/**
 * Arguments and output of the `cuccut profile` admin command (docs/cuccut/m2-profile-rules.md). `show` reads the same view the `profile_show` tool
 * gives agents (through `catalog.call`), so the JSON is the same on every surface; the rest call `profile.*` methods.
 */

/** A rule as `profile_show` gives it (without the user's note). */
export type ShownRule = Omit<ProfileRule, 'note' | 'source'>;

/** The result of `profile_show`. */
export interface ProfileShow {
  interview: {
    status: InterviewStatus;
    questions: { id: InterviewQuestionId; text: string; required: boolean; answered: boolean }[];
    answers: Partial<Record<InterviewQuestionId, string>>;
  };
  preferences: { general: string; interviewSection: string; project: string | null };
  rules: { workspace: ShownRule[]; project: ShownRule[] | null };
  names: string[];
  project: { projectId: string; name: string } | null;
}

/** `answers set <question>`: one of the interview's question ids. */
export function parseQuestionId(value: string): InterviewQuestionId {
  const id = value.trim().toLowerCase();
  if (!(INTERVIEW_QUESTIONS as readonly string[]).includes(id)) throw new Error(M.badQuestion(value, INTERVIEW_QUESTIONS.join(', ')));
  return id as InterviewQuestionId;
}

/**
 * `rules move <id> up|down|<position>`: the level's ids in their new order (positions start at 1; past the end means last). Unknown rule or bad
 * position: a usage error.
 */
export function movedOrder(ids: readonly string[], id: string, where: string): string[] {
  const from = ids.indexOf(id);
  if (from < 0) throw new Error(M.ruleMissing(id));
  let to: number;
  if (where === 'up') to = Math.max(0, from - 1);
  else if (where === 'down') to = Math.min(ids.length - 1, from + 1);
  else if (/^\d+$/.test(where) && Number(where) >= 1) to = Math.min(ids.length, Number(where)) - 1;
  else throw new Error(M.badMove(where));
  const next = ids.filter((other) => other !== id);
  next.splice(to, 0, id);
  return next;
}

export function stageLabel(stage: RuleStage): string {
  return stage === 'clip' ? M.stageClip : stage === 'edit' ? M.stageEdit : M.stageAny;
}

/** An interview question as people read it. */
export function questionLabel(id: InterviewQuestionId): string {
  switch (id) {
    case 'who':
      return M.questionWho;
    case 'record':
      return M.questionRecord;
    case 'platforms':
      return M.questionPlatforms;
    case 'annoys':
      return M.questionAnnoys;
    case 'names':
      return M.questionNames;
  }
}

function statusLabel(status: InterviewStatus): string {
  return status === 'done' ? M.statusDone : status === 'skipped' ? M.statusSkipped : M.statusPending;
}

/** Rules in reading order, numbered from 1. */
export function formatRules(rules: readonly ShownRule[]): string[] {
  if (rules.length === 0) return [M.noRules];
  return rules.flatMap((rule, i) => [
    M.ruleLine(i + 1, rule.name, stageLabel(rule.stage), !rule.enabled, rule.id),
    M.ruleWhen(rule.when),
    ...(rule.instruction ? [M.ruleDo(rule.instruction)] : []),
    ...(rule.templateId ? [M.ruleTemplate(rule.templateId)] : []),
  ]);
}

function textBlock(text: string): string[] {
  const trimmed = text.trim();
  return trimmed ? trimmed.split('\n').map((line) => `  ${line}`) : [M.noText];
}

/** `profile show` for people. */
export function formatProfile(shown: ProfileShow, readOnly = false): string[] {
  const { interview, preferences, rules, names, project } = shown;
  const answered = interview.questions.filter((q) => q.answered).length;
  const lines = [M.interviewLine(statusLabel(interview.status), answered, interview.questions.length)];
  for (const question of interview.questions) lines.push(M.answerLine(questionLabel(question.id), interview.answers[question.id] ?? M.unanswered));
  lines.push('', M.generalHeading, ...textBlock(preferences.general));
  if (preferences.interviewSection.trim()) lines.push('', M.interviewHeading, ...textBlock(preferences.interviewSection));
  if (project) lines.push('', M.projectHeading(project.name), ...textBlock(preferences.project ?? ''));
  lines.push('', M.rulesHeading, ...formatRules(rules.workspace));
  if (project) lines.push('', M.projectRulesHeading(project.name), ...formatRules(rules.project ?? []));
  if (names.length > 0) lines.push('', M.namesLine(names.join(', ')));
  if (readOnly) lines.push('', M.readOnly);
  return lines;
}

function reasonLabel(reason: ProfileWriteFallbackReason): string {
  return reason === 'no-agent' ? M.reasonNoAgent : reason === 'bad-output' ? M.reasonBadOutput : M.reasonAgentFailed;
}

/** `interview write`: the section that was written, how, and the names added. */
export function formatWriteResult(result: ProfileWriteResult): string[] {
  const lines = [result.usedAgent ? M.writtenByAgent : M.keptAsTyped(reasonLabel(result.fallbackReason ?? 'agent-failed')), ...textBlock(result.preferences)];
  if (result.names.length > 0) lines.push(M.namesAdded(result.names.join(', ')));
  lines.push(M.takesEffect);
  return lines;
}

/** `answers set`: saved or cleared. */
export function formatAnswerSaved(id: InterviewQuestionId, text: string): string {
  const question = questionLabel(id);
  return text.trim() ? M.answerSaved(question) : M.answerCleared(question);
}
