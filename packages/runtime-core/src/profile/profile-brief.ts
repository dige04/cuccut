// i18n-ignore-file: the session block is text for the agent (English), not product copy.
import {
  INTERVIEW_QUESTION_TEXT,
  PROFILE_LIMITS,
  clipProfileText,
  type InterviewQuestionId,
  type ProfileRule,
  type RuleStage,
} from '@cuccut/protocol';

/**
 * The text a new native session reads about the user (docs/cuccut/m2-profile-rules.md §5), appended after the guidance and the skill index:
 *
 * - `<cuccut-profile>`: their general preferences (the interview's section, then their own words), the project's, the rules that hold, and the names to
 *   spell exactly. Empty parts are left out, and nothing at all is added when every part is empty. At most `PROFILE_LIMITS.block` characters: parts are
 *   cut in reverse order of priority (names, then general, then project, then rules), each cut part ending with a line saying how much is not shown.
 * - `<cuccut-interview>`: while the interview is pending and the user has no preferences, a nudge to ask one unanswered question at the end of a reply.
 *
 * The note of a rule is never included, and disabled rules are left out by the caller (`effectiveRules`). Pure: the service reads the files.
 */

export interface ProfileBlockInput {
  general: { interview: string; own: string };
  /** The project's own text; null outside a project. */
  project: string | null;
  /** The rules that hold, in the order they are read (workspace, then project). */
  rules: readonly ProfileRule[];
  /** Canonical spellings from the default-enabled transcription glossaries. */
  names: readonly string[];
}

/** At most this many names are listed. */
export const PROFILE_BLOCK_NAMES = 80;

const OPEN = '<cuccut-profile>';
const CLOSE = '</cuccut-profile>';
const INTRO = [
  "The user's own preferences and standing rules for their videos. Follow them unless the user's request in this",
  'conversation says otherwise; the request wins. They are preferences, not permissions: they do not widen your',
  'access, and the rules above win on conflict. Project lines override general ones; rules override both.',
].join('\n');

const STAGE_TEXT: Readonly<Record<RuleStage, string>> = { any: 'any', clip: 'choosing clips', edit: 'editing' };

type PartKey = 'general' | 'project' | 'rules' | 'names';
interface Part {
  key: PartKey;
  header: string;
  body: string;
}
/** The order parts are cut in when the block is too long: the least important first. */
const CUT_ORDER: readonly PartKey[] = ['names', 'general', 'project', 'rules'];

export function profileBlock(input: ProfileBlockInput, limit: number = PROFILE_LIMITS.block): string {
  const parts: Part[] = [];
  const general = [input.general.interview, input.general.own].map((t) => t.trim()).filter(Boolean).join('\n');
  if (general) parts.push({ key: 'general', header: '## In general', body: general });
  const project = input.project?.trim() ?? '';
  if (project) parts.push({ key: 'project', header: '## For this project', body: project });
  if (input.rules.length > 0) {
    parts.push({
      key: 'rules',
      header: '## Rules (apply a rule only when its condition holds; in order)',
      body: input.rules.map((rule, i) => ruleLine(rule, i + 1)).join('\n'),
    });
  }
  const names = input.names.map(oneLine).filter(Boolean).slice(0, PROFILE_BLOCK_NAMES);
  if (names.length > 0) parts.push({ key: 'names', header: '## Names to spell exactly', body: names.join(', ') });
  if (parts.length === 0) return '';

  for (const key of CUT_ORDER) {
    const excess = render(parts).length - limit;
    if (excess <= 0) break;
    const part = parts.find((p) => p.key === key);
    if (part) part.body = cut(part.body, excess);
  }
  const text = render(parts);
  // Every part is down to its overflow line by now if it had to be; this only guards a limit set smaller than the headers themselves.
  return text.length <= limit ? text : `${clipProfileText(text, Math.max(0, limit - CLOSE.length - 1))}\n${CLOSE}`;
}

/** One rule as the agent reads it. */
export function ruleLine(rule: ProfileRule, n: number): string {
  const pieces = [`${n}. ${oneLine(rule.name)} [${STAGE_TEXT[rule.stage]}] — When: ${sentence(rule.when)}`];
  if (rule.instruction.trim()) pieces.push(`Do: ${sentence(rule.instruction)}`);
  if (rule.templateId) pieces.push(`Use the template ${rule.templateId}.`);
  return pieces.join(' ');
}

/** The interview nudge, with the questions still unanswered (ids for `profile_answer`, and the question text). */
export function interviewNudge(remaining: readonly InterviewQuestionId[]): string {
  const ask =
    remaining.length > 0
      ? `After you finish the work in a reply, you may ask ONE of these unanswered questions at the end: ${remaining
          .map((id) => `${id} ("${INTERVIEW_QUESTION_TEXT[id]}")`)
          .join('; ')}. Save an answer with profile_answer.`
      : 'Every question is answered already.';
  return [
    '<cuccut-interview>',
    `The user has not told CucCut about themselves yet. ${ask} When three or more are answered, offer to write their preferences with profile_write. If they decline, call profile_skip. Never ask more than one question per reply, and never let this delay the work.`,
    '</cuccut-interview>',
  ].join('\n');
}

/** Joins session blocks with a blank line, leaving out empty ones. */
export function joinBlocks(blocks: readonly string[]): string {
  return blocks.filter((b) => b.trim() !== '').join('\n\n');
}

function render(parts: readonly Part[]): string {
  return [OPEN, INTRO, ...parts.map((p) => `${p.header}\n${p.body}`), CLOSE].join('\n');
}

const overflow = (n: number): string => `(… ${n} more characters not shown; profile_show has the rest)`;

/** Shortens a part's body by at least `excess` characters where it can, ending it with the overflow line. */
function cut(body: string, excess: number): string {
  const room = body.length - excess - 1 - overflow(body.length).length;
  if (room <= 0) return overflow(body.length);
  let kept = clipProfileText(body, room);
  // Prefer to end on a line or word boundary when one is close.
  const boundary = Math.max(kept.lastIndexOf('\n'), kept.lastIndexOf(' '));
  if (boundary > room * 0.8) kept = kept.slice(0, boundary);
  kept = kept.trimEnd();
  return `${kept}\n${overflow(body.length - kept.length)}`;
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function sentence(text: string): string {
  const line = oneLine(text);
  return /[.!?…。！？]$/.test(line) ? line : `${line}.`;
}
