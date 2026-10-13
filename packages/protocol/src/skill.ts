/**
 * Agent skills (architecture design §3.8, §12.9; product design §6.9): a folder that teaches the built-in Agent to do things by a certain method. The root holds a `SKILL.md`
 * (`name` and `description` in the YAML front matter, optional `version`, followed by the body), and there may be reference files beside it.
 *
 * - Switch on (`enabled`): at session start the Agent gets its name and description, and when relevant it uses `skills_read` itself to fetch the body;
 * - Switch off: it is used only when the user picks it under “+ › Use Skill” in the input box (`conversations.send`'s `skill`).
 *
 * This file holds the types, limits and dependency-free id rules, and it ships with the main entry into the UI; inbound validation is in `skill-schemas.ts`.
 */

/** The file name of the skill body. A directory without it is not a skill. */
export const SKILL_FILE = 'SKILL.md';
/** CucCut's own record of where a skill came from (which folder it was added from, which GitHub address and commit it was imported from), stored in the skill directory. It starts with a dot, is not in the file list, and does not change the user's `SKILL.md`. */
export const SKILL_SOURCE_FILE = '.cuccut-skill.json';

/**
 * Where a skill comes from:
 * - `builtin`: shipped with the app; it can be turned off, but not removed;
 * - `personal`: added by the user from a local folder, or placed by them in `<Runtime Home>/skills/`;
 * - `third-party`: imported from GitHub.
 */
export const SKILL_ORIGINS = ['builtin', 'personal', 'third-party'] as const;
export type SkillOrigin = (typeof SKILL_ORIGINS)[number];

/** The default switch state for each source: built-in and self-added skills default to on; third-party skills default to off (used only when picked). Only changes the user has made are stored, as a delta. */
export const SKILL_DEFAULT_ENABLED: Readonly<Record<SkillOrigin, boolean>> = {
  builtin: true,
  personal: true,
  'third-party': false,
};

/** Limits. Character counts are in UTF-16 code units. */
export const SKILL_LIMITS = {
  id: 64,
  name: 100,
  description: 1024,
  version: 64,
  /** Limit for `SKILL.md` (bytes, UTF-8): the full text is handed to the agent when picked, so it cannot be unbounded. */
  skillFileBytes: 64 * 1024,
  /** Maximum number of files in one skill directory (including `SKILL.md`; dot-prefixed files are not counted). Applied when adding, importing and listing the directory. */
  files: 200,
  /** Limit on the total bytes of all files in one skill directory. Applied when adding and importing. */
  totalBytes: 8 * 1024 * 1024,
  /** Maximum size (bytes) of a text file that `skills.readFile` and `skills_read` can read at once. */
  readFileBytes: 256 * 1024,
  /** Length limit of a file's relative path inside the directory. */
  path: 300,
  /** Maximum number of skills that can be picked for one message (`skills` of `conversations.send`). */
  perMessage: 20,
} as const;

/**
 * Skill id: lowercase letters, digits and single hyphens (letters are not limited to the Latin alphabet), derived from the directory name (`normalizeSkillId`). It is also the directory name under `<Runtime Home>/skills/<id>/`.
 */
export const SKILL_ID_PATTERN = /^[\p{Ll}\p{Lo}\p{Lm}\p{M}\p{Nd}]+(?:-[\p{Ll}\p{Lo}\p{Lm}\p{M}\p{Nd}]+)*$/u;

/**
 * Directory name (or the last segment of a GitHub path) → skill id: Unicode NFC, lowercased, runs of characters other than letters and digits replaced with one hyphen, leading and trailing hyphens removed,
 * and truncated to the limit. Returns null when the result is empty after normalization (e.g. all punctuation). Different names may produce the same id; the caller rejects on conflict.
 */
export function normalizeSkillId(name: string): string | null {
  const lowered = name.normalize('NFC').toLowerCase();
  const id = lowered
    .replace(/[^\p{Ll}\p{Lo}\p{Lm}\p{M}\p{Nd}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SKILL_LIMITS.id)
    .replace(/-+$/, '');
  return id && SKILL_ID_PATTERN.test(id) ? id : null;
}

/** How a skill was installed (recorded in `SKILL_SOURCE_FILE`). Built-in skills and ones the user placed in the directory themselves have none. */
export type SkillSource =
  | {
      kind: 'local';
      /** The folder chosen when adding (absolute path). Changing that folder later does not affect skills already copied in. */
      path: string;
      addedAt: string;
    }
  | {
      kind: 'github';
      /** The address given by the user, normalized to `https://github.com/<owner>/<repo>[/tree/<ref>/<path>]`. */
      url: string;
      owner: string;
      repo: string;
      /** Branch, tag or commit; if the address does not give one, it is the repository's default branch. */
      ref: string;
      /** The commit (full sha) that `ref` pointed to at import. */
      commit: string;
      /** The subdirectory in the repository; an empty string for the repository root. */
      path: string;
      importedAt: string;
    };

/** One skill in a list. */
export interface SkillSummary {
  id: string;
  /** The `name` from front matter, as is. */
  name: string;
  /** The `description` from front matter, as is. */
  description: string;
  /** The `version` from front matter; null if there is none. */
  version: string | null;
  origin: SkillOrigin;
  /** The current switch state. */
  enabled: boolean;
  /** The default switch state for this source (`SKILL_DEFAULT_ENABLED`). */
  defaultEnabled: boolean;
  /** Whether it can be removed: built-in skills cannot. */
  removable: boolean;
  /** Absolute path of the skill directory. */
  path: string;
  source: SkillSource | null;
  /** Number of files in the directory (including `SKILL.md`). */
  fileCount: number;
  /** Modification time of `SKILL.md`. */
  updatedAt: string;
}

/**
 * Reasons a skill directory is skipped:
 * - `invalid`: no `SKILL.md`, front matter missing `name` / `description`, over a limit, not UTF-8, or contains symlinks or special files;
 * - `duplicate-id`: two subdirectories in the same directory normalize to the same id, so both are skipped;
 * - `builtin-conflict`: a skill in `<Runtime Home>/skills/` has the same id as a built-in skill, so the user's copy is skipped.
 */
export const SKILL_DIAGNOSTIC_CODES = ['invalid', 'duplicate-id', 'builtin-conflict'] as const;
export type SkillDiagnosticCode = (typeof SKILL_DIAGNOSTIC_CODES)[number];

/** A skill directory that could not be loaded. `scope`: the built-in directory, or `<Runtime Home>/skills/`. */
export interface SkillDiagnostic {
  code: SkillDiagnosticCode;
  scope: 'builtin' | 'user';
  /** Directory name. */
  dir: string;
  /** Absolute path of the directory. */
  path: string;
  message: string;
  issues: string[];
}

export interface SkillListResult {
  skills: SkillSummary[];
  diagnostics: SkillDiagnostic[];
}

/** A file in a skill directory. `text`: UTF-8 text no larger than `SKILL_LIMITS.readFileBytes`, viewable through `skills.readFile`. */
export interface SkillFileEntry {
  /** Relative path inside the directory, `/`-separated. */
  path: string;
  size: number;
  text: boolean;
}

export interface SkillDetail {
  skill: SkillSummary;
  /** The full text of `SKILL.md` (including front matter). */
  content: string;
  /** All files in the directory (including `SKILL.md`), sorted by path. Dot-prefixed files and CucCut's source record are not included. */
  files: SkillFileEntry[];
}

export interface SkillFileContent {
  path: string;
  size: number;
  content: string;
}

/** After toggling, adding or importing: the skill that changed, and the full updated list. */
export interface SkillChangeResult extends SkillListResult {
  skill: SkillSummary;
}

/** After removal: the deleted directory, and the full updated list. */
export interface SkillRemoveResult extends SkillListResult {
  removed: { id: string; path: string };
}

/**
 * Skills picked when sending a message (each item of `skills` in `conversations.send`, or a single `skill`): both enabled and disabled skills can be picked.
 * One message can carry several; they are handed to the agent in the order attached, and duplicate ids count once.
 */
export interface SkillSendRef {
  id: string;
}

/** Skill marker on a user message: the session shows one "Skill: name" per skill, without the body. */
export interface SkillMessageRef {
  id: string;
  name: string;
  origin: SkillOrigin;
}

/**
 * Merges the skills picked in `conversations.send` into one ordered list: the single `skill` comes first, then `skills` in order; duplicate ids keep only the first occurrence.
 * The list is empty if neither is given.
 */
export function sendSkillRefs(params: { skill?: SkillSendRef; skills?: readonly SkillSendRef[] }): SkillSendRef[] {
  const seen = new Set<string>();
  const out: SkillSendRef[] = [];
  for (const ref of [...(params.skill ? [params.skill] : []), ...(params.skills ?? [])]) {
    if (seen.has(ref.id)) continue;
    seen.add(ref.id);
    out.push({ id: ref.id });
  }
  return out;
}

/** Skill markers on a user message, in the order attached; compatible with old records that only have a single `skill`. */
export function messageSkills(message: { skill?: SkillMessageRef; skills?: readonly SkillMessageRef[] }): SkillMessageRef[] {
  if (message.skills?.length) return [...message.skills];
  return message.skill ? [message.skill] : [];
}
