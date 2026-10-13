import { SKILL_ID_PATTERN, SKILL_LIMITS, type SkillSendRef, type SkillSummary } from '@cuccut/protocol';
import { M } from './skills-copy.ts';

/**
 * Arguments and output of the `cuccut skills` admin command (architecture design §3.8, §12.9). Listing and viewing are derived commands (`skills list|read`).
 */

function sourceText(skill: SkillSummary): string | null {
  const source = skill.source;
  if (!source) return null;
  if (source.kind === 'local') return M.localSource(source.path, source.addedAt);
  if (source.kind === 'pack') return M.packSource(source.packName, source.packVersion, source.installedAt);
  return M.remoteSource(source.url, source.ref, source.commit.slice(0, 12), source.importedAt);
}

/** One-line receipt after adding, importing and toggling; `verb` is the action in the copy catalog (`M.added` etc.). */
export function formatSkillChanged(verb: string, skill: SkillSummary): string {
  const source = sourceText(skill);
  return M.changed(verb, skill.id, skill.name, skill.enabled, skill.path, source);
}

/** `--skill <id>` and `--id <id>`: the CLI checks the shape of the id locally; whether it exists is decided by the Runtime (`SKILL_NOT_FOUND`). */
export function parseSkillId(value: string | undefined, flag: string): string | undefined {
  if (value === undefined) return undefined;
  const id = value.trim();
  if (id.length > SKILL_LIMITS.id || !SKILL_ID_PATTERN.test(id)) throw new Error(M.idFormat(flag, value));
  return id;
}

/** `cuccut chat --skill <id>`: pick one skill to send. */
export function parseChatSkill(value: string | undefined): SkillSendRef | undefined {
  const id = parseSkillId(value, '--skill');
  return id === undefined ? undefined : { id };
}
