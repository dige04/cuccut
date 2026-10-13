import {
  newId,
  sortProfileRules,
  type Id,
  type InterviewAnswers,
  type InterviewState,
  type ProfileRule,
  type ProfileRuleInput,
  type ProfileRulePutResult,
  type ProfileSnapshot,
  type ProfileWriteResult,
  type ProjectProfile,
} from '@cuccut/protocol';
import { ruleInputOf } from '../model/profile.ts';
import { useProfile } from '../state/profile-store.ts';
import type { RuntimeSession } from './session.ts';

/**
 * The user's profile (`profile.*`, docs/cuccut/m2-profile-rules.md §4, §7): the interview, preferences and rules at the workspace and project levels.
 * The workspace level arrives through the `profile` topic (state/profile-store.ts); each command also writes its own result back, so a screen does
 * not wait for the event to see what it just saved. Kept in its own file so the session channel does not grow (same as skill-commands.ts).
 */

type Session = Pick<RuntimeSession, 'client'>;

/** A write from the answers runs an agent for up to three minutes; the request waits a little longer than the Runtime's own limit. */
export const PROFILE_WRITE_TIMEOUT_MS = 240_000;

/** What a delete hands back: the rule as it was, and how to put it back where it was (the toast's Undo). */
export interface RemovedRule {
  removed: ProfileRule;
  undo(): Promise<ProfileRulePutResult>;
}

// ---- Interview ----

/** Saves answers (merged into the saved ones; `''` clears one). Never changes the interview's status. */
export async function saveAnswers(session: Session, answers: InterviewAnswers): Promise<InterviewState> {
  const interview = await session.client.request('profile.saveAnswers', { answers, commandId: newId('cmd') });
  useProfile.getState().setInterview(interview);
  return interview;
}

/** "Skip for now" / "Not now": the answers stay. */
export async function skipInterview(session: Session): Promise<InterviewState> {
  const interview = await session.client.request('profile.skipInterview', {});
  useProfile.getState().setInterview(interview);
  return interview;
}

/** "Redo the interview": back to pending, and the home reminder shows again. */
export async function reopenInterview(session: Session): Promise<InterviewState> {
  const interview = await session.client.request('profile.reopenInterview', {});
  useProfile.getState().setInterview(interview);
  return interview;
}

/** "Not now" on the home reminder: hides the line until the interview is reopened. */
export async function dismissReminder(session: Session): Promise<InterviewState> {
  const interview = await session.client.request('profile.dismissReminder', {});
  useProfile.getState().setInterview(interview);
  return interview;
}

/**
 * Writes preferences from the answers (the saved ones with `answers` merged over them) with the default agent, or keeps them as typed. Progress
 * comes as `profile.writing` on the topic; the new snapshot follows as `profile.updated`.
 */
export function writeFromAnswers(session: Session, answers?: InterviewAnswers): Promise<ProfileWriteResult> {
  return session.client.request('profile.writeFromAnswers', answers ? { answers } : {}, { timeoutMs: PROFILE_WRITE_TIMEOUT_MS });
}

// ---- Preferences ----

/** The workspace preferences: the user's own text, the interview's section, or both. */
export async function setPreferences(session: Session, text: { own?: string; interview?: string }): Promise<ProfileSnapshot> {
  const snapshot = (await session.client.request('profile.setPreferences', text)) as ProfileSnapshot;
  useProfile.getState().replace(snapshot);
  return snapshot;
}

/** "Remove this section": clears what the interview wrote. Returns the Undo, which puts the same text back. */
export async function removeInterviewSection(session: Session): Promise<{ removed: string; undo(): Promise<ProfileSnapshot> }> {
  const removed = useProfile.getState().snapshot?.preferences.interview ?? '';
  await setPreferences(session, { interview: '' });
  return { removed, undo: () => setPreferences(session, { interview: removed }) };
}

/** A project's own preferences text. */
export async function setProjectPreferences(session: Session, projectId: Id, own: string): Promise<ProjectProfile> {
  const profile = (await session.client.request('profile.setPreferences', { projectId, own })) as ProjectProfile;
  useProfile.getState().projectLoaded(profile);
  return profile;
}

// ---- Rules ----

function upsertRule(rules: readonly ProfileRule[], rule: ProfileRule): ProfileRule[] {
  return sortProfileRules([...rules.filter((r) => r.id !== rule.id), rule]);
}

/** Writes a level's new rule list into the mirror: the workspace snapshot, or the project's profile once fetched. */
function writeRules(projectId: Id | undefined, change: (rules: readonly ProfileRule[]) => ProfileRule[]): void {
  const store = useProfile.getState();
  if (projectId === undefined) {
    if (store.snapshot) store.setRules(change(store.snapshot.rules));
    return;
  }
  const profile = store.projects[projectId]?.profile;
  if (profile) store.projectLoaded({ ...profile, rules: change(profile.rules) });
}

/** Creates or replaces a rule (by id) at the workspace level, or in a project. `warnings` say what did not stop the save (a template not installed). */
export async function putRule(session: Session, rule: ProfileRuleInput, projectId?: Id): Promise<ProfileRulePutResult> {
  const result = await session.client.request('profile.putRule', projectId === undefined ? { rule } : { rule, projectId });
  writeRules(projectId, (rules) => upsertRule(rules, result.rule));
  return result;
}

/** Deletes a rule at once. The returned Undo puts the same rule back with the same order, so it lands where it was. */
export async function removeRule(session: Session, id: string, projectId?: Id): Promise<RemovedRule> {
  const { removed } = await session.client.request('profile.removeRule', projectId === undefined ? { id } : { id, projectId });
  writeRules(projectId, (rules) => rules.filter((r) => r.id !== id));
  return { removed, undo: () => putRule(session, ruleInputOf(removed), projectId) };
}

/** Puts a level's rules in this order (one write; the Runtime renumbers them 10, 20, 30…). */
export async function reorderRules(session: Session, ids: string[], projectId?: Id): Promise<ProfileRule[]> {
  const { rules } = await session.client.request('profile.reorderRules', projectId === undefined ? { ids } : { ids, projectId });
  writeRules(projectId, () => rules);
  return rules;
}

// ---- Project level ----

/** A fetch in flight for a project; `again`: the project changed after it was sent, so its answer may be old and it fetches once more. */
interface ProjectLoad {
  promise: Promise<void>;
  again: boolean;
}

const loading = new Map<Id, ProjectLoad>();

/**
 * Fetches a project's own level once; a second call while one is in flight shares it. With `fresh` (the project changed), a fetch in flight is
 * followed by another one and its answer is dropped, since the Runtime may have read the file before the change. The last profile keeps showing
 * while it loads.
 */
export function loadProjectProfile(session: Session, projectId: Id, options: { fresh?: boolean } = {}): Promise<void> {
  const pending = loading.get(projectId);
  if (pending) {
    if (options.fresh) pending.again = true;
    return pending.promise;
  }
  useProfile.getState().projectLoading(projectId);
  const load: ProjectLoad = { promise: Promise.resolve(), again: false };
  const run = async (): Promise<void> => {
    for (;;) {
      load.again = false;
      let profile: ProjectProfile;
      try {
        profile = await session.client.request('profile.getProject', { projectId });
      } catch (error) {
        if (load.again) continue;
        useProfile.getState().projectFailed(projectId, (error as Error).message);
        return;
      }
      if (load.again) continue;
      useProfile.getState().projectLoaded(profile);
      return;
    }
  };
  load.promise = run().finally(() => loading.delete(projectId));
  loading.set(projectId, load);
  return load.promise;
}

/** `profile.projectUpdated`: fetches the project again, but only one a screen has asked for. */
export function refreshProjectProfile(session: Session, projectId: Id): void {
  if (useProfile.getState().projects[projectId]) void loadProjectProfile(session, projectId, { fresh: true });
}

/** For tests: clear in-flight requests. */
export function resetProfileCommands(): void {
  loading.clear();
}
