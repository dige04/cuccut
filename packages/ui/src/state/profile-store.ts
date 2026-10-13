import { create } from 'zustand';
import { applyProfileEvent } from '@cuccut/client';
import type { Id, InterviewState, ProfileEvent, ProfileRule, ProfileSnapshot, ProfileWriteState, ProjectProfile } from '@cuccut/protocol';

/** One project's own level as last fetched (`profile.getProject`): the fetch state and the profile once it came. */
export interface ProjectProfileState {
  /** `loading`: fetching now (whether or not there was data before); `failed`: the latest fetch did not succeed. */
  status: 'loading' | 'ready' | 'failed';
  profile: ProjectProfile | null;
  error: string | null;
}

/**
 * Mirror of the user's profile (`profile` topic, docs/cuccut/m2-profile-rules.md §4, §7): the workspace level as one small snapshot, replaced whole
 * on every change, and the progress of a write from the answers. Fed from runtime/session.ts; writes go through runtime/profile-commands.ts.
 *
 * Projects have their own level, which the topic only announces (`profile.projectUpdated`): the ones a screen asked for are kept in `projects`
 * and fetched again when announced.
 */
export interface ProfileStore {
  /** The first snapshot has arrived. */
  ready: boolean;
  snapshot: ProfileSnapshot | null;
  /** A write from the answers in progress (the snapshot's `writing`, kept apart so a component can watch only it). */
  writing: ProfileWriteState | null;
  projects: Record<Id, ProjectProfileState>;
  replace(snapshot: ProfileSnapshot): void;
  apply(event: ProfileEvent): void;
  /** A method's result that holds the interview state (`profile.saveAnswers`, skip, reopen, dismiss). */
  setInterview(interview: InterviewState): void;
  /** A method's result that holds the workspace rules (`profile.reorderRules`, or one rule put or removed). */
  setRules(rules: ProfileRule[]): void;
  projectLoading(projectId: Id): void;
  projectLoaded(profile: ProjectProfile): void;
  projectFailed(projectId: Id, message: string): void;
}

/** The state before the first snapshot (also used to reset in tests). */
export function emptyProfile(): Pick<ProfileStore, 'ready' | 'snapshot' | 'writing' | 'projects'> {
  return { ready: false, snapshot: null, writing: null, projects: {} };
}

export const useProfile = create<ProfileStore>()((set) => ({
  ...emptyProfile(),
  replace: (snapshot) => set({ ready: true, snapshot, writing: snapshot.writing }),
  apply: (event) =>
    set((s) => {
      if (!s.snapshot) return event.type === 'profile.updated' ? { ready: true, snapshot: event.snapshot, writing: event.snapshot.writing } : s;
      const snapshot = applyProfileEvent(s.snapshot, event);
      return snapshot === s.snapshot ? s : { snapshot, writing: snapshot.writing };
    }),
  setInterview: (interview) => set((s) => (s.snapshot ? { snapshot: { ...s.snapshot, interview } } : s)),
  setRules: (rules) => set((s) => (s.snapshot ? { snapshot: { ...s.snapshot, rules } } : s)),
  projectLoading: (projectId) =>
    set((s) => ({ projects: { ...s.projects, [projectId]: { status: 'loading', profile: s.projects[projectId]?.profile ?? null, error: null } } })),
  projectLoaded: (profile) => set((s) => ({ projects: { ...s.projects, [profile.projectId]: { status: 'ready', profile, error: null } } })),
  projectFailed: (projectId, message) =>
    set((s) => ({ projects: { ...s.projects, [projectId]: { status: 'failed', profile: s.projects[projectId]?.profile ?? null, error: message } } })),
}));
