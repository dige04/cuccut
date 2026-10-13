import {
  INTERVIEW_QUESTIONS,
  PROFILE_LIMITS,
  REQUIRED_INTERVIEW_QUESTIONS,
  clipProfileText,
  profileRuleId,
  type DriverInfo,
  type InterviewAnswers,
  type InterviewQuestionId,
  type InterviewState,
  type InterviewStatus,
  type ProfileRule,
  type ProfileRuleInput,
  type ProfileSnapshot,
  type RuleStage,
} from '@cuccut/protocol';
import { PROFILE_COPY } from '../components/profile/profile-copy.ts';
import { RULES_COPY } from '../components/profile/rules-copy.ts';
import { W } from '../components/settings/workspace-copy.ts';

/**
 * The user's profile as the screens show it (docs/cuccut/m2-profile-rules.md §2, §7): pure, so the status lines, rail summaries, rule effects, rule
 * drafts and interview steps are tested without React. The data comes from the `profile` topic (state/profile-store.ts); writes go through
 * runtime/profile-commands.ts.
 */

// ---- Interview ----

/** The line under "About you": what the interview's status means for the fields below it. */
export function interviewLine(status: InterviewStatus, hasSection: boolean): string {
  const line = PROFILE_COPY.interview.line;
  if (status === 'done') return hasSection ? line.doneWithSection : line.doneRemoved;
  if (status === 'skipped') return line.skipped;
  return line.pending;
}

/** How many questions have an answer (blank text does not count). */
export function answerCount(answers: InterviewAnswers): number {
  return INTERVIEW_QUESTIONS.filter((id) => !!answers[id]?.trim()).length;
}

/** Whether the answers can be written into preferences: the required question has an answer. */
export function canWriteAnswers(answers: InterviewAnswers): boolean {
  return REQUIRED_INTERVIEW_QUESTIONS.every((id) => !!answers[id]?.trim());
}

/**
 * The next question the in-chat card asks: the first unanswered one the user has not put off in this session ("Ask me later"). null when every
 * question is answered or put off.
 */
export function nextQuestion(state: Pick<InterviewState, 'answers'>, skippedThisSession: readonly InterviewQuestionId[]): InterviewQuestionId | null {
  return INTERVIEW_QUESTIONS.find((id) => !state.answers[id]?.trim() && !skippedThisSession.includes(id)) ?? null;
}

/** The answers that differ from what is saved, as `profile.saveAnswers` takes them: a cleared answer is sent as `''` so the Runtime drops it. */
export function changedAnswers(draft: InterviewAnswers, saved: InterviewAnswers): InterviewAnswers {
  const changed: InterviewAnswers = {};
  for (const id of INTERVIEW_QUESTIONS) {
    const next = (draft[id] ?? '').trim();
    if (next !== (saved[id] ?? '').trim()) changed[id] = next;
  }
  return changed;
}

/**
 * Whether a write from the answers will find an agent: one that is enabled, ready and verified (the Runtime's `pickWriterAgent`). null while the
 * agent list has not arrived, so the page does not claim there is none.
 */
export function hasWriterAgent(drivers: readonly Pick<DriverInfo, 'enabled' | 'state' | 'verified'>[] | null): boolean | null {
  if (!drivers) return null;
  return drivers.some((d) => d.enabled && d.state === 'ready' && d.verified !== false);
}

/** Whether the question is the one worth answering (the others are marked "(optional)"). */
export function isRequiredQuestion(id: InterviewQuestionId): boolean {
  return REQUIRED_INTERVIEW_QUESTIONS.includes(id);
}

// ---- Where the interview is offered ----

/** Home shows the one-line reminder: nothing told yet, the reminder not dismissed, and the interview not done. */
export function showsReminder(snapshot: Pick<ProfileSnapshot, 'hasPreferences' | 'interview'> | null): boolean {
  return !!snapshot && !snapshot.hasPreferences && snapshot.interview.reminder && snapshot.interview.status !== 'done';
}

/** A conversation shows the interview card: the interview is pending and there are no preferences yet. */
export function showsInterviewCard(snapshot: Pick<ProfileSnapshot, 'hasPreferences' | 'interview'> | null): boolean {
  return !!snapshot && !snapshot.hasPreferences && snapshot.interview.status === 'pending';
}

/** One step of the full-screen interview: which question, where it sits, and whether "Continue" is held back (the required one, unanswered). */
export interface WelcomeStep {
  question: InterviewQuestionId;
  /** 0-based. */
  index: number;
  total: number;
  last: boolean;
  required: boolean;
  blocked: boolean;
}

/** The step at `index` (clamped to the questions) with the answers as typed so far. */
export function welcomeStep(answers: InterviewAnswers, index: number): WelcomeStep {
  const total = INTERVIEW_QUESTIONS.length;
  const at = Math.min(Math.max(0, Math.trunc(index)), total - 1);
  const question = INTERVIEW_QUESTIONS[at]!;
  const required = isRequiredQuestion(question);
  return { question, index: at, total, last: at === total - 1, required, blocked: required && !answers[question]?.trim() };
}

/** What the in-chat card shows: the next question to ask, or (none left) how many were answered and the way to write them, or "no rush". */
export type InterviewCardView =
  | { kind: 'ask'; question: InterviewQuestionId }
  | { kind: 'finish'; answered: number; canWrite: boolean }
  | { kind: 'noRush' };

export function interviewCardView(answers: InterviewAnswers, passed: readonly InterviewQuestionId[]): InterviewCardView {
  const question = nextQuestion({ answers }, passed);
  if (question) return { kind: 'ask', question };
  const answered = answerCount(answers);
  return answered ? { kind: 'finish', answered, canWrite: canWriteAnswers(answers) } : { kind: 'noRush' };
}

// ---- Rail ----

/** What Settings › You and Settings › Rules hold, written under their names in the rail; null before the `profile` snapshot arrives. */
export function railSummary(snapshot: Pick<ProfileSnapshot, 'hasPreferences' | 'interview' | 'rules'> | null): { you: string; rules: string } | null {
  if (!snapshot) return null;
  const off = snapshot.rules.filter((rule) => !rule.enabled).length;
  return {
    you: W.preferencesSummary(snapshot.hasPreferences, answerCount(snapshot.interview.answers)),
    rules: W.ruleCount(snapshot.rules.length, off),
  };
}

// ---- Rules ----

/** A template the rule form offers: its id and the name it is shown with. */
export interface RuleTemplateOption {
  id: string;
  title: string;
}

/** One line of what a rule does, for the bullets under a rule and in the form's review card. */
export interface RuleEffect {
  kind: 'template' | 'instruction';
  text: string;
  /** A template the rule names that is not installed. */
  missing?: boolean;
}

export function stageLabel(stage: RuleStage): string {
  return RULES_COPY.stage[stage];
}

/** What a rule does: the template it uses (with "(not installed)" when it is not in the catalog) and the agent instruction. */
export function ruleEffects(rule: Pick<ProfileRule, 'templateId' | 'instruction'>, templates: readonly RuleTemplateOption[]): RuleEffect[] {
  const effects: RuleEffect[] = [];
  const templateId = rule.templateId?.trim();
  if (templateId) {
    const template = templates.find((t) => t.id === templateId);
    effects.push(
      template
        ? { kind: 'template', text: RULES_COPY.effect.template(template.title) }
        : { kind: 'template', text: `${RULES_COPY.effect.template(templateId)} ${RULES_COPY.effect.templateMissing}`, missing: true },
    );
  }
  const instruction = rule.instruction.trim();
  if (instruction) effects.push({ kind: 'instruction', text: RULES_COPY.effect.instruction(instruction) });
  return effects;
}

/** The orders a reorder gives: 10, 20, 30… in the given order (the Runtime renumbers the same way). */
export function renumber(ids: readonly string[]): { id: string; order: number }[] {
  return ids.map((id, index) => ({ id, order: (index + 1) * 10 }));
}

/** The ids after moving the rule at `index` one place earlier (-1) or later (1); null when it is already at that end. */
export function moveRule(ids: readonly string[], index: number, by: -1 | 1): string[] | null {
  const target = index + by;
  if (index < 0 || index >= ids.length || target < 0 || target >= ids.length) return null;
  const next = [...ids];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

/** Eight random hex characters for a new rule id. */
function randomHex8(): string {
  const bytes = new Uint8Array(4);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** A new rule id: the name's slug (at most 55 characters) and 8 random hex characters, as the Runtime makes them. */
export function newRuleId(name: string, hex8: string = randomHex8()): string {
  return profileRuleId(name, hex8);
}

/** The rule form's fields as typed. `order` is text so a half-typed number can sit in the field. */
export interface RuleDraft {
  /** Set when editing a saved rule; a new rule gets its id from its name when saved. */
  id: string | null;
  name: string;
  when: string;
  instruction: string;
  templateId: string;
  stage: RuleStage;
  order: string;
  enabled: boolean;
  note: string;
}

/** The form for a new rule (`null`) or a saved one. A new rule leaves its order empty: the Runtime puts it after the last one. */
export function ruleDraft(rule: ProfileRule | null): RuleDraft {
  if (!rule) return { id: null, name: '', when: '', instruction: '', templateId: '', stage: 'any', order: '', enabled: true, note: '' };
  return {
    id: rule.id,
    name: rule.name,
    when: rule.when,
    instruction: rule.instruction,
    templateId: rule.templateId ?? '',
    stage: rule.stage,
    order: String(rule.order),
    enabled: rule.enabled,
    note: rule.note,
  };
}

function orderOf(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (!/^-?\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Math.abs(value) <= 1_000_000 ? value : null;
}

/**
 * Why "Save rule" is off, or null when the draft can be saved: a name, a condition, and an instruction or a template. The Runtime checks the same
 * and more (`PROFILE_RULE_INVALID`); this only keeps the button honest.
 */
export function ruleDraftErrors(draft: RuleDraft): string | null {
  if (!draft.name.trim()) return RULES_COPY.form.needName;
  if (!draft.when.trim()) return RULES_COPY.form.needWhen;
  if (!draft.instruction.trim() && !draft.templateId.trim()) return RULES_COPY.form.needAction;
  if (orderOf(draft.order) === null) return RULES_COPY.form.badOrder;
  return null;
}

/** The draft as `profile.putRule` takes it: trimmed and clipped. A new rule gets a fresh id here so a retry after a lost reply replaces, not duplicates. */
export function ruleInputOfDraft(draft: RuleDraft, id: string = draft.id ?? newRuleId(draft.name)): ProfileRuleInput {
  const order = orderOf(draft.order);
  return {
    id,
    name: clipProfileText(draft.name.trim(), PROFILE_LIMITS.name),
    when: clipProfileText(draft.when.trim(), PROFILE_LIMITS.when),
    instruction: clipProfileText(draft.instruction.trim(), PROFILE_LIMITS.instruction),
    templateId: draft.templateId.trim() || null,
    stage: draft.stage,
    ...(typeof order === 'number' ? { order } : {}),
    enabled: draft.enabled,
    note: clipProfileText(draft.note.trim(), PROFILE_LIMITS.note),
  };
}

/** A saved rule as `profile.putRule` takes it back (Undo after a delete, the On/Off switch): everything but the reserved `source`. */
export function ruleInputOf(rule: ProfileRule, patch: Partial<Omit<ProfileRuleInput, 'id'>> = {}): ProfileRuleInput {
  return {
    id: rule.id,
    name: rule.name,
    when: rule.when,
    instruction: rule.instruction,
    templateId: rule.templateId,
    stage: rule.stage,
    order: rule.order,
    enabled: rule.enabled,
    note: rule.note,
    ...patch,
  };
}
