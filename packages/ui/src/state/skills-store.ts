import { create } from 'zustand';
import type { SkillDiagnostic, SkillListResult, SkillSummary } from '@cuccut/protocol';
import { sortSkills } from '../model/agent-skills.ts';

/**
 * The UI copy of the Runtime's skill catalog (`skills.list`, product design §6.9): shared by Settings › Skills and the input box's "+ › Use Skill".
 * The Runtime does not push changes; the UI fetches it once each when the settings page and input box mount and when reconnecting (runtime/skill-commands.ts);
 * toggle, add, import and remove all return the whole list, which is written back whole. Once fetched, the old list keeps showing on later fetches, and a failed fetch does not clear it.
 */
export interface SkillsStore {
  /** `loading`: fetching now (whether or not there was data before); `failed`: the latest fetch did not succeed. */
  status: 'idle' | 'loading' | 'ready' | 'failed';
  /** Has been fetched at least once. */
  loaded: boolean;
  skills: SkillSummary[];
  diagnostics: SkillDiagnostic[];
  error: string | null;
  begin(): void;
  /** Result of list or mutation methods: written back as a whole. */
  succeed(result: SkillListResult): void;
  fail(message: string): void;
}

/** The state before any fetch (also used to reset in tests). */
export function emptySkills(): Pick<SkillsStore, 'status' | 'loaded' | 'skills' | 'diagnostics' | 'error'> {
  return { status: 'idle', loaded: false, skills: [], diagnostics: [], error: null };
}

export const useSkills = create<SkillsStore>()((set) => ({
  ...emptySkills(),
  begin: () => set({ status: 'loading' }),
  succeed: (result) =>
    set({ status: 'ready', loaded: true, skills: sortSkills(result.skills), diagnostics: result.diagnostics, error: null }),
  fail: (message) => set({ status: 'failed', error: message }),
}));
