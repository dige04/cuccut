import {
  INTERVIEW_QUESTIONS,
  INTERVIEW_STATUSES,
  PROFILE_LIMITS,
  PROFILE_RULE_ID_PATTERN,
  RULE_STAGES,
  TEMPLATE_ID_PATTERN,
  TEMPLATE_LIMITS,
  clipProfileText,
  sortProfileRules,
  type Id,
  type InterviewAnswers,
  type InterviewStatus,
  type ProfilePreferences,
  type ProfileRule,
  type RuleStage,
} from '@cuccut/protocol';
import { JsonStoreFile, type StoreLog, type StoreOptions } from './store-file.ts';

/**
 * The user's profile at the workspace level (docs/cuccut/m2-profile-rules.md §3): `<home>/store/profile.json`.
 *
 * - The whole file is read into memory and written once per change; writes are serialised. `normalize` drops unknown keys, broken or duplicate rules
 *   (the first of an id is kept), clips over-long text and keeps at most `PROFILE_LIMITS.rules` rules. Normalising never blocks Runtime startup.
 * - Not JSON: renamed and kept, and the store starts from the defaults (`store-file.ts`).
 * - Written by a newer version (`schemaVersion` above ours): read where the shape is still understood, never rewritten, and every change is refused
 *   (`ProfileReadOnlyError`, `PROFILE_READ_ONLY` on the wire). The same holds when the file could not be read at all.
 * - The interview's section and the user's own text are separate fields, so neither can overwrite the other.
 */

export const PROFILE_SCHEMA_VERSION = 1;

/** The interview as stored. `remaining` is computed by the reader. */
export interface StoredInterview {
  status: InterviewStatus;
  reminder: boolean;
  answers: InterviewAnswers;
  writtenAt: string | null;
  usedAgent: boolean | null;
  namesGlossaryId: Id | null;
}

export interface StoredProfile {
  interview: StoredInterview;
  preferences: ProfilePreferences;
  rules: ProfileRule[];
}

/** A change was refused because the profile file was written by a newer version (or could not be read). */
export class ProfileReadOnlyError extends Error {
  readonly code = 'PROFILE_READ_ONLY';

  constructor(file: string) {
    super(`Profile file is read-only (newer version or unreadable): ${file}`);
    this.name = 'ProfileReadOnlyError';
  }
}

export function defaultProfile(): StoredProfile {
  return {
    interview: { status: 'pending', reminder: true, answers: {}, writtenAt: null, usedAgent: null, namesGlossaryId: null },
    preferences: { own: '', interview: '' },
    rules: [],
  };
}

export class ProfileStore {
  readonly #file: JsonStoreFile;
  readonly #log: StoreLog | undefined;
  #profile: StoredProfile = defaultProfile();
  #newer = false;
  #saving: Promise<void> = Promise.resolve();

  constructor(file: string, options: StoreOptions = {}) {
    this.#file = new JsonStoreFile(file, options.log);
    this.#log = options.log;
  }

  get file(): string {
    return this.#file.file;
  }

  /** The file is shown but not changed: written by a newer version, or unreadable. */
  get readOnly(): boolean {
    return this.#newer || this.#file.readOnly;
  }

  async load(): Promise<StoredProfile> {
    // The version is checked here rather than by `JsonStoreFile`, so that a newer file is still read where its shape is understood.
    const { value } = await this.#file.read({ version: null, recognize: (raw) => raw, tolerateReadErrors: true });
    const raw = value ?? {};
    const version = typeof raw.schemaVersion === 'number' && Number.isFinite(raw.schemaVersion) ? raw.schemaVersion : PROFILE_SCHEMA_VERSION;
    this.#newer = version > PROFILE_SCHEMA_VERSION;
    if (this.#newer) {
      this.#log?.warn('Profile file was written by a newer version; read only', { file: this.#file.file, version, known: PROFILE_SCHEMA_VERSION });
    }
    this.#profile = normalizeProfile(raw);
    return this.get();
  }

  get(): StoredProfile {
    return structuredClone(this.#profile);
  }

  /**
   * Changes the profile: `update` edits a copy (it may throw, and then nothing changes), the result is normalised, kept and written.
   * Refused with `ProfileReadOnlyError` when the file is read-only.
   */
  async update(update: (draft: StoredProfile) => void): Promise<StoredProfile> {
    if (this.readOnly) throw new ProfileReadOnlyError(this.#file.file);
    const draft = this.get();
    update(draft);
    this.#profile = normalizeProfile(draft);
    const snapshot = { schemaVersion: PROFILE_SCHEMA_VERSION, ...this.#profile };
    const write = this.#saving.catch(() => {}).then(() => this.#file.write(snapshot));
    this.#saving = write;
    await write;
    return this.get();
  }

  /** Waits for the writes in flight. */
  flush(): Promise<void> {
    return this.#saving.catch(() => {});
  }
}

type Raw = Record<string, unknown>;
const isObject = (value: unknown): value is Raw => !!value && typeof value === 'object' && !Array.isArray(value);
const str = (value: unknown, limit: number): string => (typeof value === 'string' ? clipProfileText(value, limit) : '');
const trimmed = (value: unknown, limit: number): string => (typeof value === 'string' ? clipProfileText(value.trim(), limit) : '');

/** Reads whatever shape the file has into a valid profile. Unknown keys go; missing ones take the defaults. */
export function normalizeProfile(raw: unknown): StoredProfile {
  const data = isObject(raw) ? raw : {};
  const interview = isObject(data.interview) ? data.interview : {};
  const preferences = isObject(data.preferences) ? data.preferences : {};
  return {
    interview: {
      status: (INTERVIEW_STATUSES as readonly unknown[]).includes(interview.status) ? (interview.status as InterviewStatus) : 'pending',
      reminder: typeof interview.reminder === 'boolean' ? interview.reminder : true,
      answers: normalizeAnswers(interview.answers),
      writtenAt: typeof interview.writtenAt === 'string' && !Number.isNaN(Date.parse(interview.writtenAt)) ? interview.writtenAt : null,
      usedAgent: typeof interview.usedAgent === 'boolean' ? interview.usedAgent : null,
      namesGlossaryId:
        typeof interview.namesGlossaryId === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(interview.namesGlossaryId) ? interview.namesGlossaryId : null,
    },
    preferences: { own: str(preferences.own, PROFILE_LIMITS.preferences), interview: str(preferences.interview, PROFILE_LIMITS.preferences) },
    rules: normalizeRules(data.rules),
  };
}

/** Answers to the known questions, trimmed and clipped; blanks dropped. */
export function normalizeAnswers(raw: unknown): InterviewAnswers {
  const out: InterviewAnswers = {};
  if (!isObject(raw)) return out;
  for (const id of INTERVIEW_QUESTIONS) {
    const value = trimmed(raw[id], PROFILE_LIMITS.answer);
    if (value) out[id] = value;
  }
  return out;
}

/** The rules of one level: broken ones dropped, the first of each id kept, at most `PROFILE_LIMITS.rules`, sorted. A rule without an order takes its place in the list. */
export function normalizeRules(raw: unknown): ProfileRule[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ProfileRule[] = [];
  raw.forEach((item, index) => {
    if (out.length >= PROFILE_LIMITS.rules) return;
    const rule = normalizeRule(item, (index + 1) * 10);
    if (!rule || seen.has(rule.id)) return;
    seen.add(rule.id);
    out.push(rule);
  });
  return sortProfileRules(out);
}

/** One rule, or null when it cannot be used: no valid id, no name, no condition, or neither an instruction nor a valid template. */
export function normalizeRule(raw: unknown, fallbackOrder = 0): ProfileRule | null {
  if (!isObject(raw)) return null;
  if (typeof raw.id !== 'string' || !PROFILE_RULE_ID_PATTERN.test(raw.id)) return null;
  const name = trimmed(raw.name, PROFILE_LIMITS.name);
  const when = trimmed(raw.when, PROFILE_LIMITS.when);
  const instruction = trimmed(raw.instruction, PROFILE_LIMITS.instruction);
  const templateId =
    typeof raw.templateId === 'string' && raw.templateId.length <= TEMPLATE_LIMITS.id && TEMPLATE_ID_PATTERN.test(raw.templateId) ? raw.templateId : null;
  if (!name || !when || (!instruction && !templateId)) return null;
  return {
    id: raw.id,
    name,
    when,
    instruction,
    templateId,
    stage: (RULE_STAGES as readonly unknown[]).includes(raw.stage) ? (raw.stage as RuleStage) : 'any',
    order: typeof raw.order === 'number' && Number.isFinite(raw.order) ? Math.round(raw.order) : fallbackOrder,
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
    note: trimmed(raw.note, PROFILE_LIMITS.note),
    source: null,
  };
}
