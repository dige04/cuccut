import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { TopicLog, type Logger } from '@cuccut/harness';
import {
  INTERVIEW_QUESTIONS,
  PROFILE_LIMITS,
  RpcError,
  clipProfileText,
  remainingInterviewQuestions,
  type Id,
  type InterviewAnswers,
  type InterviewState,
  type ProfileEvent,
  type ProfileRule,
  type ProfileRuleInput,
  type ProfileRulePutResult,
  type ProfileSnapshot,
  type ProfileWriteResult,
  type ProfileWriteState,
  type Project,
  type ProjectProfile,
  type RuleStage,
} from '@cuccut/protocol';
import {
  ProfileReadOnlyError,
  ProfileStore,
  ProjectProfileFiles,
  ProjectProfileUnavailableError,
  type RuntimeHome,
  type StoredProfile,
} from '@cuccut/runtime-storage';
import { RcProfile } from '@cuccut/protocol/messages/runtime-core';
import { PROFILE_BLOCK_NAMES, interviewNudge, joinBlocks, profileBlock } from './profile-brief.ts';
import { namesToSpell, syncInterviewNames, type InterviewName, type NamesLibrary } from './profile-names.ts';
import { effectiveRules, ruleInvalidError, rulesForStage, validateRule } from './profile-rules.ts';
import { ProfileWriter, type ProfileWriterOptions } from './profile-writer.ts';

/**
 * The user's profile on the Runtime side (docs/cuccut/m2-profile-rules.md §4): the interview, preferences and rules at the workspace level
 * (`<home>/store/profile.json`) and at each project's level (`<project>/.ccut/profile.json`), the `profile` topic, and the block every new native
 * session reads (`sessionBlock`).
 *
 * Status semantics: saving answers never changes the status; skipping keeps the answers; reopening sets `pending` and turns the reminder back on;
 * "Not now" turns the reminder off; a write from the answers sets `done`.
 *
 * Every change is one write and one topic event: `profile.updated` with the whole snapshot for the workspace level, `profile.projectUpdated` for a project.
 */

export interface ProfileServiceOptions {
  home: Pick<RuntimeHome, 'profileFile'>;
  /** The user library: interview names go into one of its glossaries, and the session block lists the names to spell. */
  library: NamesLibrary;
  /** Registered projects (read when needed: the Harness opens after this service). */
  projects: () => readonly Project[];
  /** The installed template ids, for the "not installed" warning on a rule. Without it no warning is given. */
  installedTemplates?: () => Promise<ReadonlySet<string>>;
  log?: Logger;
  /** 8 hex characters for new rule ids (tests fix it). */
  randomHex?: () => string;
  /**
   * Writing preferences from the answers (`writeFromAnswers`): the agent to run and its scratch directory. Without it every write keeps the answers as
   * typed (`fallbackReason: 'no-agent'`).
   */
  writer?: Omit<ProfileWriterOptions, 'log'>;
}

/** What a write from the answers produced, applied by `completeWrite`. */
export interface ProfileWriteOutcome {
  /** The interview's section of the preferences. */
  preferences: string;
  names: readonly InterviewName[];
  /** An agent wrote the section (false: the answers were kept as typed). */
  usedAgent: boolean;
}

export class ProfileService {
  readonly topic: TopicLog<ProfileSnapshot, ProfileEvent>;
  readonly #store: ProfileStore;
  readonly #projectFiles: ProjectProfileFiles;
  readonly #options: ProfileServiceOptions;
  readonly #writer: ProfileWriter;
  #writing: ProfileWriteState | null = null;

  private constructor(options: ProfileServiceOptions, store: ProfileStore, projectFiles: ProjectProfileFiles, log: Logger | undefined) {
    this.#options = options;
    this.#store = store;
    this.#projectFiles = projectFiles;
    this.topic = new TopicLog<ProfileSnapshot, ProfileEvent>(() => this.snapshot(), '0');
    this.#writer = new ProfileWriter(this, {
      agent: options.writer?.agent ?? (async () => null),
      stagingDir: options.writer?.stagingDir ?? '',
      ...(options.writer?.timeoutMs !== undefined ? { timeoutMs: options.writer.timeoutMs } : {}),
      ...(log ? { log } : {}),
    });
  }

  static async open(options: ProfileServiceOptions): Promise<ProfileService> {
    const log = options.log?.child('profile');
    const store = new ProfileStore(options.home.profileFile, log ? { log } : {});
    await store.load();
    // Scratch directories left by a run that did not finish (the Runtime was killed) are of no use.
    if (options.writer) await fs.rm(options.writer.stagingDir, { recursive: true, force: true }).catch(() => {});
    return new ProfileService(options, store, new ProjectProfileFiles(log ? { log } : {}), log);
  }

  snapshot(): ProfileSnapshot {
    return snapshotOf(this.#store.get(), this.#writing, this.#store.readOnly);
  }

  interview(): InterviewState {
    return interviewOf(this.#store.get());
  }

  // ---- Interview ----

  /** Merges answers over the saved ones: a given question replaces its answer, a blank one clears it. The status does not change. */
  async saveAnswers(answers: InterviewAnswers): Promise<InterviewState> {
    const next = await this.#update((profile) => {
      for (const id of INTERVIEW_QUESTIONS) {
        const value = answers[id];
        if (value === undefined) continue;
        const clean = clipProfileText(value.trim(), PROFILE_LIMITS.answer);
        if (clean) profile.interview.answers[id] = clean;
        else delete profile.interview.answers[id];
      }
    });
    return interviewOf(next);
  }

  async skip(): Promise<InterviewState> {
    return interviewOf(
      await this.#update((profile) => {
        profile.interview.status = 'skipped';
      }),
    );
  }

  async reopen(): Promise<InterviewState> {
    return interviewOf(
      await this.#update((profile) => {
        profile.interview.status = 'pending';
        profile.interview.reminder = true;
      }),
    );
  }

  async dismissReminder(): Promise<InterviewState> {
    return interviewOf(
      await this.#update((profile) => {
        profile.interview.reminder = false;
      }),
    );
  }

  /**
   * The answers a write from the interview works on: the saved ones with `given` merged over them (as `saveAnswers` would), in question order.
   * None at all: `invalid-request` (`PROFILE_NO_ANSWERS`).
   */
  answersForWrite(given: InterviewAnswers = {}): InterviewAnswers {
    const answers: InterviewAnswers = { ...this.#store.get().interview.answers };
    for (const id of INTERVIEW_QUESTIONS) {
      const value = given[id];
      if (value === undefined) continue;
      const clean = clipProfileText(value.trim(), PROFILE_LIMITS.answer);
      if (clean) answers[id] = clean;
      else delete answers[id];
    }
    const ordered: InterviewAnswers = {};
    for (const id of INTERVIEW_QUESTIONS) if (answers[id]) ordered[id] = answers[id];
    if (Object.keys(ordered).length === 0) throw new RpcError('invalid-request', RcProfile.noAnswers(), { code: 'PROFILE_NO_ANSWERS' });
    return ordered;
  }

  /**
   * Applies a finished write from the answers, in one write: the answers it used are saved, the interview's section is replaced, the status becomes
   * `done`, and the names are merged into the interview's glossary (created when there is none, or when the user removed it).
   */
  async completeWrite(answers: InterviewAnswers, outcome: ProfileWriteOutcome): Promise<{ snapshot: ProfileSnapshot; namesAdded: string[] }> {
    this.assertWritable();
    const names = await syncInterviewNames(this.#options.library, {
      glossaryId: this.#store.get().interview.namesGlossaryId,
      names: outcome.names,
      glossaryName: RcProfile.namesGlossaryName().text,
    });
    const next = await this.#update((profile) => {
      profile.interview.answers = { ...answers };
      profile.preferences.interview = clipProfileText(outcome.preferences.trim(), PROFILE_LIMITS.preferences);
      profile.interview.status = 'done';
      profile.interview.writtenAt = new Date().toISOString();
      profile.interview.usedAgent = outcome.usedAgent;
      profile.interview.namesGlossaryId = names.glossaryId;
    });
    return { snapshot: snapshotOf(next, this.#writing, this.#store.readOnly), namesAdded: names.added };
  }

  /**
   * Writes preferences from the answers (`profile.writeFromAnswers`, the `profile_write` tool): the saved answers with `given` merged over them go to a
   * confined agent run, or are kept as typed, and the interview becomes `done` (see `ProfileWriter`).
   */
  writeFromAnswers(given: InterviewAnswers = {}): Promise<ProfileWriteResult> {
    return this.#writer.write(given);
  }

  /** A profile file from a newer version can't be changed: `conflict` (`PROFILE_READ_ONLY`). */
  assertWritable(): void {
    if (this.#store.readOnly) throw readOnlyError();
  }

  /** Progress of a write from the answers (null when it ends), sent as `profile.writing`. */
  setWriting(writing: ProfileWriteState | null): void {
    this.#writing = writing;
    this.topic.publish({ type: 'profile.writing', writing });
  }

  // ---- Preferences ----

  /** The workspace level's texts. `interview` replaces the section the interview wrote (empty removes it). */
  async setPreferences(p: { own?: string; interview?: string }): Promise<ProfileSnapshot> {
    const next = await this.#update((profile) => {
      if (p.own !== undefined) profile.preferences.own = p.own;
      if (p.interview !== undefined) profile.preferences.interview = p.interview;
    });
    return snapshotOf(next, this.#writing, this.#store.readOnly);
  }

  /** A project's text. */
  async setProjectPreferences(projectId: Id, text: string): Promise<ProjectProfile> {
    return this.#updateProject(projectId, (draft) => {
      draft.preferences = text;
    });
  }

  // ---- Rules ----

  async putRule(input: ProfileRuleInput, projectId?: Id): Promise<ProfileRulePutResult> {
    if (projectId === undefined) this.assertWritable();
    const installed = this.#options.installedTemplates ? await this.#options.installedTemplates() : null;
    let result: ProfileRulePutResult | null = null;
    const apply = (rules: ProfileRule[]): ProfileRule[] => {
      const check = validateRule(input, { existing: rules, installedTemplates: installed, randomHex: this.#randomHex });
      if (!check.ok) throw ruleInvalidError(check.problems);
      result = { rule: check.rule, warnings: check.warnings };
      return check.created ? [...rules, check.rule] : rules.map((r) => (r.id === check.rule.id ? check.rule : r));
    };
    if (projectId === undefined) {
      await this.#update((profile) => {
        profile.rules = apply(profile.rules);
      });
    } else {
      await this.#updateProject(projectId, (draft) => {
        draft.rules = apply(draft.rules);
      });
    }
    return result!;
  }

  /**
   * Checks a rule as `putRule` would, without saving it: the rule as it would be saved, or `PROFILE_RULE_INVALID`. The agent tools check before they ask
   * the user, so nobody approves a rule that can't be saved.
   */
  async checkRule(input: ProfileRuleInput, projectId?: Id): Promise<{ rule: ProfileRule; created: boolean }> {
    const existing = projectId === undefined ? this.#store.get().rules : (await this.project(projectId)).rules;
    const check = validateRule(input, { existing, installedTemplates: null, randomHex: this.#randomHex });
    if (!check.ok) throw ruleInvalidError(check.problems);
    return { rule: check.rule, created: check.created };
  }

  async removeRule(id: string, projectId?: Id): Promise<{ removed: ProfileRule }> {
    let removed: ProfileRule | null = null;
    const apply = (rules: ProfileRule[]): ProfileRule[] => {
      const found = rules.find((r) => r.id === id);
      if (!found) throw new RpcError('not-found', RcProfile.ruleNotFound({ id }), { code: 'PROFILE_RULE_NOT_FOUND', ruleId: id });
      removed = found;
      return rules.filter((r) => r.id !== id);
    };
    if (projectId === undefined) {
      await this.#update((profile) => {
        profile.rules = apply(profile.rules);
      });
    } else {
      await this.#updateProject(projectId, (draft) => {
        draft.rules = apply(draft.rules);
      });
    }
    return { removed: removed! };
  }

  /** Puts the level's rules in the order of `ids` (each one exactly once), renumbered 10, 20, 30…, in one write. */
  async reorderRules(ids: readonly string[], projectId?: Id): Promise<{ rules: ProfileRule[] }> {
    const apply = (rules: ProfileRule[]): ProfileRule[] => {
      const byId = new Map(rules.map((r) => [r.id, r]));
      if (ids.length !== rules.length || new Set(ids).size !== ids.length || ids.some((id) => !byId.has(id))) {
        throw new RpcError('invalid-request', RcProfile.ruleOrder(), { code: 'PROFILE_RULE_ORDER' });
      }
      return ids.map((id, i) => ({ ...byId.get(id)!, order: (i + 1) * 10 }));
    };
    if (projectId === undefined) {
      const next = await this.#update((profile) => {
        profile.rules = apply(profile.rules);
      });
      return { rules: next.rules };
    }
    const project = await this.#updateProject(projectId, (draft) => {
      draft.rules = apply(draft.rules);
    });
    return { rules: project.rules };
  }

  // ---- Projects ----

  /** A project's level, read from disk. No such project: `not-found` (`PROFILE_PROJECT_NOT_FOUND`). */
  async project(projectId: Id): Promise<ProjectProfile> {
    const dir = this.#projectPath(projectId);
    const stored = await this.#projectFiles.read(dir);
    return { projectId, preferences: stored.preferences, rules: stored.rules, readOnly: stored.readOnly };
  }

  // ---- What agents read ----

  /**
   * The block appended to a new native session's instructions (§5): `<cuccut-profile>` with the general and project preferences, the rules that hold
   * and the names to spell, plus the interview nudge while the interview is pending and nothing is written. `''` when there is nothing to say.
   */
  async sessionBlock(projectPath: string | null): Promise<string> {
    const profile = this.#store.get();
    const project = projectPath ? await this.#projectFiles.read(projectPath) : null;
    const block = profileBlock({
      general: profile.preferences,
      project: project ? project.preferences : null,
      rules: effectiveRules(profile.rules, project?.rules ?? []),
      names: namesToSpell(this.#options.library, PROFILE_BLOCK_NAMES),
    });
    const nudge =
      profile.interview.status === 'pending' && !hasPreferences(profile) ? interviewNudge(remainingInterviewQuestions(profile.interview.answers)) : '';
    return joinBlocks([block, nudge]);
  }

  /** The enabled rules for one stage (and those for any stage): the workspace's, then the project's, a project rule shadowing a workspace one by id. */
  async rulesFor(stage: RuleStage, projectPath: string | null): Promise<ProfileRule[]> {
    const project = projectPath ? await this.#projectFiles.read(projectPath) : null;
    return rulesForStage(effectiveRules(this.#store.get().rules, project?.rules ?? []), stage);
  }

  /** The canonical names agents must spell (default-enabled transcription glossaries), at most `limit`. */
  names(limit: number = PROFILE_BLOCK_NAMES): string[] {
    return namesToSpell(this.#options.library, limit);
  }

  /** Waits for the writes in flight (Runtime stop). */
  flush(): Promise<void> {
    return this.#store.flush();
  }

  /** Runtime stop: cancels a write from the answers in flight, then waits for the store's writes. */
  async close(): Promise<void> {
    await this.#writer.close();
    await this.flush();
  }

  // ---- Internals ----

  readonly #randomHex = (): string => (this.#options.randomHex ? this.#options.randomHex() : crypto.randomBytes(4).toString('hex'));

  async #update(update: (profile: StoredProfile) => void): Promise<StoredProfile> {
    let next: StoredProfile;
    try {
      next = await this.#store.update(update);
    } catch (error) {
      throw mapStorageError(error);
    }
    this.topic.publish({ type: 'profile.updated', snapshot: snapshotOf(next, this.#writing, this.#store.readOnly) });
    return next;
  }

  async #updateProject(projectId: Id, update: (draft: { preferences: string; rules: ProfileRule[] }) => void): Promise<ProjectProfile> {
    const dir = this.#projectPath(projectId);
    let stored;
    try {
      stored = await this.#projectFiles.update(dir, update);
    } catch (error) {
      throw mapStorageError(error);
    }
    this.topic.publish({ type: 'profile.projectUpdated', projectId });
    return { projectId, preferences: stored.preferences, rules: stored.rules, readOnly: stored.readOnly };
  }

  #projectPath(projectId: Id): string {
    const project = this.#options.projects().find((p) => p.id === projectId);
    if (!project) throw new RpcError('not-found', RcProfile.projectNotFound(), { code: 'PROFILE_PROJECT_NOT_FOUND', projectId });
    return project.path;
  }
}

function hasPreferences(profile: StoredProfile): boolean {
  return profile.preferences.own.trim() !== '' || profile.preferences.interview.trim() !== '';
}

function interviewOf(profile: StoredProfile): InterviewState {
  const { interview } = profile;
  return { ...interview, answers: { ...interview.answers }, remaining: remainingInterviewQuestions(interview.answers) };
}

function snapshotOf(profile: StoredProfile, writing: ProfileWriteState | null, readOnly: boolean): ProfileSnapshot {
  return {
    interview: interviewOf(profile),
    preferences: { ...profile.preferences },
    hasPreferences: hasPreferences(profile),
    rules: profile.rules,
    writing,
    readOnly,
  };
}

function readOnlyError(): RpcError {
  return new RpcError('conflict', RcProfile.readOnly(), { code: 'PROFILE_READ_ONLY' });
}

function mapStorageError(error: unknown): unknown {
  if (error instanceof ProfileReadOnlyError) return readOnlyError();
  if (error instanceof ProjectProfileUnavailableError) {
    return new RpcError('conflict', RcProfile.projectUnavailable(), { code: 'PROFILE_PROJECT_UNAVAILABLE', path: error.dir });
  }
  return error;
}
