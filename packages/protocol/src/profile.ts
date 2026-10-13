import type { Id } from './domain.ts';
import type { MessageRef } from './message-ref.ts';

/**
 * The user's profile (docs/cuccut/m2-profile-rules.md): who they are and how they like their videos done, said once and read by every new agent session.
 *
 * - The onboarding interview: five questions (`who` is the only required one), answered a step at a time, with a status of `pending | skipped | done`.
 * - Preferences: free text at two levels. The workspace level keeps the user's own text and the section the interview wrote apart; a project has one text.
 * - Rules: standing "when X, do Y" instructions at the same two levels. The agent judges the condition and follows the instruction.
 *
 * This file holds the types, limits and dependency-free helpers, and it ships with the main entry into the UI; inbound validation is in `profile-schemas.ts`.
 */

/** The interview questions, in the order they are asked. */
export const INTERVIEW_QUESTIONS = ['who', 'record', 'platforms', 'annoys', 'names'] as const;
export type InterviewQuestionId = (typeof INTERVIEW_QUESTIONS)[number];
/** The one answer worth giving: with no answer to it there is nothing to write. */
export const REQUIRED_INTERVIEW_QUESTIONS: readonly InterviewQuestionId[] = ['who'];

/**
 * The questions as the agent reads them (the session nudge, the profile tools and the writer's fallback lines). Agent-facing English, not product copy:
 * the UI labels are in `PROFILE_COPY`.
 */
export const INTERVIEW_QUESTION_TEXT: Readonly<Record<InterviewQuestionId, string>> = {
  who: 'What do you make, and who is it for?',
  record: 'What do you usually record?',
  platforms: 'Where does it go, and how long should it be?',
  annoys: 'What annoys you about your videos today?',
  names: 'Names that must be spelled right',
};

export const INTERVIEW_STATUSES = ['pending', 'skipped', 'done'] as const;
/** `pending`: not run to the end and not skipped. `skipped`: the user said not now (the answers stay). `done`: preferences were written from the answers. */
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export type InterviewAnswers = Partial<Record<InterviewQuestionId, string>>;

export interface InterviewState {
  status: InterviewStatus;
  /** Whether the home page still shows the reminder line ("Not now" turns it off; reopening turns it back on). */
  reminder: boolean;
  /** Answers so far: trimmed, blanks dropped. */
  answers: InterviewAnswers;
  /** Questions still unanswered, in order: the next one an agent should ask. Computed. */
  remaining: InterviewQuestionId[];
  /** When preferences were last written from the answers. */
  writtenAt: string | null;
  /** The last write: true when an agent wrote the section, false when the answers were kept as typed. null before the first write. */
  usedAgent: boolean | null;
  /** The user-library glossary the interview's names went into. */
  namesGlossaryId: Id | null;
}

/** Where a rule applies: choosing clips, editing, or both. */
export const RULE_STAGES = ['any', 'clip', 'edit'] as const;
export type RuleStage = (typeof RULE_STAGES)[number];

/** Rule id: lowercase ASCII letters, digits and hyphens, starting with a letter or digit, at most 64 characters. Generated as `slug(name) + '-' + 8 hex` when not given. */
export const PROFILE_RULE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export interface ProfileRule {
  id: string;
  name: string;
  /** The condition, in plain language. The agent judges it. */
  when: string;
  /** What the agent does when the condition holds. `''` only when `templateId` is set. */
  instruction: string;
  /** A creation template the agent uses when the rule applies (`templates/<id>`). Not checked against the installed ones: a missing template is a warning. */
  templateId: string | null;
  stage: RuleStage;
  /** Lower first; ties by id. Reordering renumbers 10, 20, 30… */
  order: number;
  enabled: boolean;
  /** "Note to yourself". Never sent to the agent. */
  note: string;
  /** Reserved for rules that come from a pack (`{ pack }`). Always null for now. */
  source: null;
}

/** A rule as a client sends it to `profile.putRule`: without `id` it is created; with one it is created or replaced. Missing fields take their defaults (`stage: 'any'`, `enabled: true`, order after the last). */
export interface ProfileRuleInput {
  id?: string;
  name: string;
  when: string;
  instruction?: string;
  templateId?: string | null;
  stage?: RuleStage;
  order?: number;
  enabled?: boolean;
  note?: string;
}

export interface ProfilePreferences {
  /** The user's own text ("In your words"). */
  own: string;
  /** The section the interview wrote. Stored apart from `own`, so neither can overwrite the other. */
  interview: string;
}

/** A write from the answers in progress: when it started and the agent's last progress lines (at most 3, each at most 400 characters). */
export interface ProfileWriteState {
  startedAt: string;
  lines: string[];
}

/** The `profile` topic's snapshot and the result of `profile.get`: the workspace level. */
export interface ProfileSnapshot {
  interview: InterviewState;
  preferences: ProfilePreferences;
  /** `own` or `interview` has text. */
  hasPreferences: boolean;
  /** Workspace rules, sorted. */
  rules: ProfileRule[];
  writing: ProfileWriteState | null;
  /** The profile file was written by a newer CucCut (or could not be read): it is shown but not changed (`PROFILE_READ_ONLY`). */
  readOnly: boolean;
}

/** A project's own level (`<project>/.ccut/profile.json`). It applies on top of the workspace level in the project's new sessions. */
export interface ProjectProfile {
  projectId: Id;
  preferences: string;
  rules: ProfileRule[];
  readOnly: boolean;
}

/** A note on a saved rule that did not stop the save, such as a template that is not installed. Text with its message reference, as elsewhere on the wire. */
export interface ProfileWarning {
  code: 'template-missing';
  message: string;
  messageRef?: MessageRef;
}

export interface ProfileRulePutResult {
  rule: ProfileRule;
  warnings: ProfileWarning[];
}

/** Limits, in UTF-16 code units (`rules` is a count per level, `block` the size of the session block). */
export const PROFILE_LIMITS = {
  answer: 2000,
  preferences: 8000,
  name: 120,
  when: 500,
  instruction: 2000,
  note: 500,
  rules: 200,
  block: 6000,
} as const;

/**
 * Events of the `profile` topic:
 * - `profile.updated`: the workspace level changed; carries the whole snapshot, which is small.
 * - `profile.writing`: progress of a write from the answers (null when it ends).
 * - `profile.projectUpdated`: a project's level changed; subscribers that show it refetch with `profile.getProject`.
 */
export type ProfileEvent =
  | { type: 'profile.updated'; snapshot: ProfileSnapshot }
  | { type: 'profile.writing'; writing: ProfileWriteState | null }
  | { type: 'profile.projectUpdated'; projectId: Id };

/** The questions not answered yet, in order. */
export function remainingInterviewQuestions(answers: InterviewAnswers): InterviewQuestionId[] {
  return INTERVIEW_QUESTIONS.filter((id) => !answers[id]?.trim());
}

/** Rules in the order they are read: `order` ascending, ties by id. Returns a new array. */
export function sortProfileRules<R extends Pick<ProfileRule, 'id' | 'order'>>(rules: readonly R[]): R[] {
  return [...rules].sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The part of a rule id taken from its name: ASCII-folded, lowercased, runs of other characters made one hyphen, at most 55 characters. `rule` when nothing is left. */
export function profileRuleSlug(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, 55)
    .replace(/-+$/, '');
  return slug || 'rule';
}

/** A new rule id from its name and 8 random hex characters (the caller supplies them, so this file stays free of platform APIs). */
export function profileRuleId(name: string, hex8: string): string {
  return `${profileRuleSlug(name)}-${hex8.toLowerCase().replace(/[^0-9a-f]/g, '0').padEnd(8, '0').slice(0, 8)}`;
}

/** Cuts text to at most `limit` UTF-16 code units without splitting a surrogate pair. */
export function clipProfileText(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const last = cut.charCodeAt(cut.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}
