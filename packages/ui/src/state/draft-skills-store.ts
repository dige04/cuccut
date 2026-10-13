import { create } from 'zustand';
import { appendSkillId } from '../model/agent-skills.ts';

/**
 * Skills picked from the input box's "+ › Use Skill" (product design §3.2.3, §6.9), keyed by draft key (session ID, or the draft key of a new session). One message can attach several,
 * kept in the order attached. Picking one that is already attached does not add it again, and each can be removed individually.
 * Only in this window, not persisted (same as attached images and the templates on the start page). When the project changes, or a new session is created but not yet sent, they move with the input box.
 */
interface DraftSkillsStore {
  /** Draft key → skill ids, in the order attached. */
  skills: Record<string, string[]>;
  /** Attach one at the end. One that is already attached is left alone. */
  add(draftKey: string, id: string): void;
  /** Remove one. */
  remove(draftKey: string, id: string): void;
  /** Replace the whole group with `ids` (de-duplicated, order kept). Empty removes them all. */
  set(draftKey: string, ids: readonly string[]): void;
  move(from: string, to: string): void;
}

const EMPTY: readonly string[] = [];

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

export const useDraftSkills = create<DraftSkillsStore>()((set) => {
  const write = (draftKey: string, next: (ids: readonly string[]) => readonly string[]) =>
    set((s) => {
      const before = s.skills[draftKey] ?? EMPTY;
      const after = unique(next(before));
      if (after.length === before.length && after.every((id, i) => id === before[i])) return {};
      const skills = { ...s.skills };
      if (after.length) skills[draftKey] = after;
      else delete skills[draftKey];
      return { skills };
    });
  return {
    skills: {},
    add: (draftKey, id) => write(draftKey, (ids) => appendSkillId(ids, id)),
    remove: (draftKey, id) => write(draftKey, (ids) => ids.filter((x) => x !== id)),
    set: (draftKey, ids) => write(draftKey, () => ids),
    move: (from, to) =>
      set((s) => {
        const ids = s.skills[from];
        if (!ids?.length || from === to) return {};
        const skills = { ...s.skills, [to]: ids };
        delete skills[from];
        return { skills };
      }),
  };
});

/** The skills attached to this draft key, in the order attached. When there are none, the same empty array is returned (so subscribers don't churn). */
export function useDraftSkillIds(draftKey: string): readonly string[] {
  return useDraftSkills((s) => s.skills[draftKey] ?? EMPTY);
}
