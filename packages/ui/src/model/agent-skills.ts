import { defineMessages, live, RpcError, SKILL_LIMITS, type SkillOrigin, type SkillSource, type SkillSummary } from '@cuccut/protocol';
import { zhHans } from './agent-skills.zh-Hans.ts';
import { zhHant } from './agent-skills.zh-Hant.ts';
import { ja } from './agent-skills.ja.ts';
import { ko } from './agent-skills.ko.ts';
import { es } from './agent-skills.es.ts';
import { fr } from './agent-skills.fr.ts';
import { de } from './agent-skills.de.ts';
import { nl } from './agent-skills.nl.ts';
import { ptBR } from './agent-skills.pt-BR.ts';
import { it } from './agent-skills.it.ts';
import { ru } from './agent-skills.ru.ts';
import { pl } from './agent-skills.pl.ts';
import { tr } from './agent-skills.tr.ts';
import { vi } from './agent-skills.vi.ts';

/** Copy for Skills settings and errors (the English is the source of keys and types; translations are in `agent-skills.zh-Hans.ts`). */
const en = {
  origin: { builtin: 'Built-in', personal: 'Mine', 'third-party': 'Third-party' } as Record<SkillOrigin, string>,
  all: 'All',
  commit: (sha: string) => ` (${sha})`,
  bytes: (n: number) => (n === 1 ? '1 byte' : `${n} bytes`),
  action: {
    load: 'load skills',
    toggle: 'switch it',
    add: 'add it',
    import: 'import it',
    remove: 'remove it',
    read: 'open the file',
    send: 'send',
  } as Record<SkillAction, string>,
  exists: (id: string | null) =>
    `A skill named “${id ?? 'this'}” already exists and won’t be overwritten. Remove the old one first, or rename the folder and add it again.`,
  invalid: (issue: string) => `This isn’t a usable skill: ${issue}. The root folder needs a SKILL.md that starts with name and description.`,
  tooLarge: (files: number, total: string, skillFile: string) =>
    `This skill is too large: a skill can have at most ${files} files totaling ${total}, and SKILL.md itself can be at most ${skillFile}.`,
  githubNotFound: 'Couldn’t find this repository, branch, or folder on GitHub (it may be private). Check the address.',
  folderNotFound: 'Couldn’t find this folder. It may have been moved or deleted.',
  urlInvalid: 'The address wasn’t recognized. Use owner/repo, or https://github.com/owner/repo/tree/branch/folder.',
  network: 'Can’t reach GitHub. Check your network and try again.',
  rateLimited: 'GitHub’s anonymous access limit has been reached for now. Try importing again later.',
  offline: 'Strict offline mode is on, so you can’t import from GitHub.',
  builtinNotRemovable: 'Built-in skills can’t be removed, but you can turn them off.',
  notFound: 'This skill is gone; it may have just been removed.',
  fileNotFound: 'This file is gone.',
  fileTooLarge: 'This file is too large to show here. You can open it in its folder.',
  fileNotText: 'This isn’t a text file, so it isn’t shown here.',
  webNotAllowed: 'This can’t be done in the browser. Use the CucCut desktop app instead.',
  webReadOnly: 'This browser session is read-only, so nothing can be changed.',
  failed: (action: string, raw: string) => `Couldn’t ${action}: ${raw}`,
  sendFailed: (raw: string) => `Couldn’t send: ${raw}`,
};
export type AgentSkillsMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * The skills the built-in agents use themselves (product design §6.9, prototype model-agent-skills.js): search and source filtering with counts in Settings › Skills, the “+ › Use Skill” entries in the input box, and plain-language versions of the `skills.*` error codes. Names and descriptions are kept as they are, with no assumption about language.
 */

/** Filter tabs: all, or one source. */
export type SkillTab = 'all' | SkillOrigin;

export const SKILL_ORIGIN_LABEL: Readonly<Record<SkillOrigin, string>> = live(() => M.origin);

export const SKILL_TABS: readonly { key: SkillTab; label: string }[] = (['all', 'builtin', 'personal', 'third-party'] as const).map((key) => ({
  key,
  get label() {
    return key === 'all' ? M.all : M.origin[key];
  },
}));

const ORIGIN_ORDER: Readonly<Record<SkillOrigin, number>> = { builtin: 0, personal: 1, 'third-party': 2 };

/** The order from `skills.list` is not a contract: sort by source (built-in, mine, third-party), then by name; ties are broken by id. */
export function sortSkills(list: readonly SkillSummary[]): SkillSummary[] {
  return [...list].sort(
    (a, b) => ORIGIN_ORDER[a.origin] - ORIGIN_ORDER[b.origin] || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
}

/** Filter first by tab (source), then search by name, description, and id (case-insensitive); the order is unchanged. */
export function filterSkills(list: readonly SkillSummary[], query: string, tab: SkillTab): SkillSummary[] {
  const q = query.trim().toLocaleLowerCase();
  return list.filter(
    (s) => (tab === 'all' || s.origin === tab) && (!q || [s.name, s.description, s.id].some((v) => v.toLocaleLowerCase().includes(q))),
  );
}

/** Count for each tab; when a search term is given, it is the count after searching. */
export function countSkills(list: readonly SkillSummary[], query: string): Record<SkillTab, number> {
  const rows = filterSkills(list, query, 'all');
  return {
    all: rows.length,
    builtin: rows.filter((s) => s.origin === 'builtin').length,
    personal: rows.filter((s) => s.origin === 'personal').length,
    'third-party': rows.filter((s) => s.origin === 'third-party').length,
  };
}

/** A description that fits on one line: collapses line breaks and runs of whitespace, and truncates to `max` characters with an ellipsis when longer (truncation by code point, so emoji and supplementary characters are not split). */
export function clipLine(text: string, max = 60): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const chars = [...flat];
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : flat;
}

/** Attaches a skill to the input box: appended after the existing ones; a skill already attached is not duplicated (product design §6.9 “pick”; prototype tool-prompt.jsx `addSkill`). */
export function appendSkillId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? [...ids] : [...ids, id];
}

export interface SkillMenuItem {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

/** The “+ › Use Skill” entries in the input box: all skills, enabled ones first, with the list order kept within each group; descriptions are cut to one line. */
export function skillMenuItems(list: readonly SkillSummary[]): SkillMenuItem[] {
  const rows = list.map((s) => ({ id: s.id, name: s.name, description: clipLine(s.description), enabled: s.enabled }));
  return [...rows.filter((s) => s.enabled), ...rows.filter((s) => !s.enabled)];
}

/** The one line at the bottom of a card: source · version. */
export function skillMetaLine(skill: Pick<SkillSummary, 'origin' | 'version'>): string {
  return [SKILL_ORIGIN_LABEL[skill.origin], skill.version ? `v${skill.version}` : null].filter(Boolean).join(' · ');
}

/** The source in details: a local folder path, or a GitHub address@ref (commit shortened to the first 7 characters). null for built-in skills and skills placed in the directory by the user. */
export function skillSourceLine(source: SkillSource | null): string | null {
  if (!source) return null;
  if (source.kind === 'local') return source.path;
  const commit = source.commit ? M.commit(source.commit.slice(0, 7)) : '';
  return `${source.url}@${source.ref}${commit}`;
}

/** Strips the front matter from the start of `SKILL.md` (name, description, and version are already shown at the top of details), keeping only the body. */
export function skillBody(content: string): string {
  const text = content.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const match = /^---\n[\s\S]*?\n---[ \t]*(?:\n|$)/.exec(text);
  return (match ? text.slice(match[0].length) : text).replace(/^\n+/, '');
}

/** File size: bytes, KB, MB. */
export function fileSizeLabel(bytes: number): string {
  if (bytes < 1024) return M.bytes(bytes);
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export type SkillAction = 'load' | 'toggle' | 'add' | 'import' | 'remove' | 'read' | 'send';

const ACTION_LABEL: Readonly<Record<SkillAction, string>> = live(() => M.action);

/** `RpcError.details.code` (the Runtime's detailed error code); null when there is none. */
export function skillErrorCode(error: unknown): string | null {
  if (!(error instanceof RpcError)) return null;
  const details = error.details;
  return details && typeof details === 'object' && typeof (details as { code?: unknown }).code === 'string'
    ? (details as { code: string }).code
    : null;
}

function detailsOf(error: unknown): Record<string, unknown> {
  const details = error instanceof RpcError ? error.details : null;
  return details && typeof details === 'object' ? (details as Record<string, unknown>) : {};
}

/**
 * Turns a `skills.*` error into one plain sentence (product design §6.9: exceeding limits, missing SKILL.md, a wrong address, and network or access-limit problems are all stated honestly).
 * Unrecognized error codes fall back to the Runtime's own description.
 */
export function skillErrorMessage(error: unknown, action: SkillAction): string {
  const code = skillErrorCode(error);
  const details = detailsOf(error);
  const issues = Array.isArray(details.issues) ? details.issues.filter((i): i is string => typeof i === 'string') : [];
  const id = typeof details.skillId === 'string' ? details.skillId : null;
  const raw = error instanceof Error ? error.message : String(error);
  switch (code) {
    case 'SKILL_EXISTS':
      return M.exists(id);
    case 'SKILL_INVALID':
      return M.invalid(issues[0] ?? raw);
    case 'SKILL_TOO_LARGE':
      return M.tooLarge(SKILL_LIMITS.files, fileSizeLabel(SKILL_LIMITS.totalBytes), fileSizeLabel(SKILL_LIMITS.skillFileBytes));
    case 'SKILL_SOURCE_NOT_FOUND':
      return action === 'import' ? M.githubNotFound : M.folderNotFound;
    case 'SKILL_GITHUB_URL_INVALID':
      return M.urlInvalid;
    case 'SKILL_GITHUB_NETWORK':
      return M.network;
    case 'SKILL_GITHUB_RATE_LIMITED':
      return M.rateLimited;
    case 'OFFLINE_STRICT':
      return M.offline;
    case 'SKILL_BUILTIN_NOT_REMOVABLE':
      return M.builtinNotRemovable;
    case 'SKILL_NOT_FOUND':
      return M.notFound;
    case 'SKILL_FILE_NOT_FOUND':
      return M.fileNotFound;
    case 'SKILL_FILE_TOO_LARGE':
      return M.fileTooLarge;
    case 'SKILL_FILE_NOT_TEXT':
      return M.fileNotText;
    case 'WEB_METHOD_NOT_ALLOWED':
      return M.webNotAllowed;
    case 'WEB_READ_ONLY':
      return M.webReadOnly;
    default:
      return M.failed(ACTION_LABEL[action], raw);
  }
}

/** The message when sending fails: if a picked skill caused the problem (for example, it was just removed), the message gives the skill's reason; otherwise the usual “Could not send: …” (没能发送：…). */
export function sendFailureMessage(error: unknown): string {
  return skillErrorCode(error)?.startsWith('SKILL_')
    ? skillErrorMessage(error, 'send')
    : M.sendFailed(error instanceof Error ? error.message : String(error));
}
