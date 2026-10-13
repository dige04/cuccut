import { newId, type SkillChangeResult, type SkillDetail, type SkillFileContent, type SkillRemoveResult } from '@cuccut/protocol';
import { useSkills } from '../state/skills-store.ts';
import type { RuntimeSession } from './session.ts';

/**
 * Agent skills (`skills.*`, product design §6.9): the list goes into state/skills-store; the whole list returned by toggle, add, import and remove is written back directly.
 * Kept in its own file so the session channel does not grow (same as template-commands.ts).
 */

type Session = Pick<RuntimeSession, 'client'>;

let listing: Promise<void> | null = null;

/** Fetch the list once; do not send a duplicate while already fetching. The old list keeps displaying while the fetch is in progress. */
export function loadSkills(session: Session): Promise<void> {
  if (listing) return listing;
  useSkills.getState().begin();
  listing = session.client
    .request('skills.list', {})
    .then(
      (result) => useSkills.getState().succeed(result),
      (error: Error) => useSkills.getState().fail(error.message),
    )
    .finally(() => {
      listing = null;
    });
  return listing;
}

async function apply<T extends SkillChangeResult | SkillRemoveResult>(pending: Promise<T>): Promise<T> {
  const result = await pending;
  useSkills.getState().succeed(result);
  return result;
}

/** One skill's summary, the full `SKILL.md` text, and its file list. */
export function getSkill(session: Session, id: string): Promise<SkillDetail> {
  return session.client.request('skills.get', { id });
}

/** Read one text file in the skill directory (one whose `text` is true in the `skills.get` file list). */
export function readSkillFile(session: Session, id: string, path: string): Promise<SkillFileContent> {
  return session.client.request('skills.readFile', { id, path });
}

/** Toggle: takes effect from the next Agent session that starts. */
export function setSkillEnabled(session: Session, id: string, enabled: boolean): Promise<SkillChangeResult> {
  return apply(session.client.request('skills.setEnabled', { id, enabled }));
}

/** Add from a local folder (copied into the Runtime's skill directory, filed under “Mine”, on by default). */
export function addSkillFromFolder(session: Session, path: string): Promise<SkillChangeResult> {
  return apply(session.client.request('skills.add', { path, commandId: newId('cmd') }));
}

/** Import from GitHub (only downloads the files in that directory, does not run them; filed under “Third-party”, off by default). */
export function importSkillFromGithub(session: Session, url: string): Promise<SkillChangeResult> {
  return apply(session.client.request('skills.importGithub', { url: url.trim(), commandId: newId('cmd') }));
}

/** Remove a skill under “Mine” or “Third-party”: deletes its folder in the Runtime skill directory; this cannot be undone. */
export function removeSkill(session: Session, id: string): Promise<SkillRemoveResult> {
  return apply(session.client.request('skills.remove', { id }));
}

/** For tests: clear in-progress requests. */
export function resetSkillCommands(): void {
  listing = null;
}
