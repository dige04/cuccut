import { isPackId, live, PACK_RESERVED_IDS, SKILL_ID_PATTERN, SKILL_LIMITS } from '@cuccut/protocol';
import { M } from './settings-nav-copy.ts';

/**
 * Settings section table (product design §2.1, §7.6): model configuration is merged into Settings and grouped into four sections: “Preferences / Agent / Models / App”. Models keep their own type and content routing; the URLs all live under /settings/models.
 * The preferences group opens with the user's profile (docs/cuccut/m2-profile-rules.md §2.1–2.2): You and Rules.
 */

export const SETTINGS_SECTIONS = ['you', 'rules', 'general', 'shortcuts', 'fonts', 'agent', 'skills', 'packs', 'publishing', 'glossary', 'review', 'privacy', 'diagnostics', 'about'] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const MODEL_CATEGORIES = ['asr', 'tts', 'llm', 'image', 'music', 'sep', 'vision'] as const;
export type ModelCategory = (typeof MODEL_CATEGORIES)[number];
export const MODEL_PAGES = ['local', 'cloud', 'voices'] as const;
export type ModelPage = (typeof MODEL_PAGES)[number];

export interface ModelCategoryInfo {
  key: ModelCategory;
  label: string;
  description: string;
  /** Which pages this category has, in tab order. */
  pages: readonly ModelPage[];
}

const categoryInfo = (key: ModelCategory, pages: readonly ModelPage[]): ModelCategoryInfo => ({
  key,
  get label() {
    return M.category[key].label;
  },
  get description() {
    return M.category[key].description;
  },
  pages,
});

export const MODEL_CATEGORY_INFO: readonly ModelCategoryInfo[] = [
  categoryInfo('asr', ['local', 'cloud']),
  categoryInfo('tts', ['local', 'cloud', 'voices']),
  categoryInfo('llm', ['cloud']),
  categoryInfo('image', ['local', 'cloud']),
  categoryInfo('music', ['local']),
  categoryInfo('sep', ['local']),
  categoryInfo('vision', ['local']),
];

export const MODEL_PAGE_LABEL: Record<ModelPage, string> = live(() => M.page);

/** A category with only one page states the reason at the top of the page. */
export const ONLY_PAGE_NOTE: Partial<Record<ModelPage, string>> = live(() => M.onlyPage);

export interface SettingsSectionInfo {
  key: SettingsSection;
  label: string;
}

export const SETTINGS_SECTION_INFO: readonly SettingsSectionInfo[] = SETTINGS_SECTIONS.map((key) => ({
  key,
  get label() {
    return M.section[key];
  },
}));

/**
 * Publishing (accounts, schedule, archive; design `docs/cuccut/m2-publishing.md` §2.5) opens the App group: it is a workspace preference like the
 * glossary, not a model or an agent setting.
 *
 * A group id must not be the same as an item key (S2 SideNav shares one id space between sections and items, and a name clash throws a RangeError), so the Agent group is named `agents`.
 * The model group's items are MODEL_CATEGORIES, which the settings page inserts itself between `agents` and `app`.
 */
type SettingsGroupId = 'preferences' | 'agents' | 'app';
const group = (id: SettingsGroupId, keys: readonly SettingsSection[]) => ({
  id,
  get label() {
    return M.group[id];
  },
  keys,
});
export const SETTINGS_GROUPS: readonly { id: SettingsGroupId; label: string; keys: readonly SettingsSection[] }[] = [
  group('preferences', ['you', 'rules', 'general', 'shortcuts', 'fonts']),
  group('agents', ['agent', 'skills', 'packs']),
  group('app', ['publishing', 'glossary', 'review', 'privacy', 'diagnostics', 'about']),
];

/** The old link `/settings/agent/<page>` (from when Agent & Skills still had tabs) now goes to its new place; pages that are not recognized fall back to the Agent provider. */
export function legacyAgentSection(page: string | undefined): SettingsSection {
  if (page === 'skills') return 'skills';
  if (page === 'permissions') return 'privacy';
  return 'agent';
}

export function modelCategory(key: ModelCategory): ModelCategoryInfo {
  return MODEL_CATEGORY_INFO.find((c) => c.key === key)!;
}

/** Which page a category should stop on: if the given page belongs to this category, use it; otherwise use the page it last stopped on; if that fails too, use the first page. */
export function modelPageFor(category: ModelCategory, page?: ModelPage | null, last?: ModelPage | null): ModelPage {
  const { pages } = modelCategory(category);
  return [page, last].find((p): p is ModelPage => !!p && pages.includes(p)) ?? pages[0]!;
}

/**
 * The page inside a section, for the sections that have pages (`/settings/<section>/<sub>`, pack design §2.1): Packs takes
 * `import`, `export` or a pack id; Skills takes a skill id, whose details it opens (the pack page links there). Anything
 * else, and every other section, has none (undefined).
 */
export function settingsSub(section: SettingsSection, sub: string | undefined): string | undefined {
  if (!sub) return undefined;
  if (section === 'packs') return (PACK_RESERVED_IDS as readonly string[]).includes(sub) || isPackId(sub) ? sub : undefined;
  if (section === 'skills') return sub.length <= SKILL_LIMITS.id && SKILL_ID_PATTERN.test(sub) ? sub : undefined;
  return undefined;
}

export function isSettingsSection(value: string | undefined): value is SettingsSection {
  return (SETTINGS_SECTIONS as readonly string[]).includes(value ?? '');
}

export function isModelCategory(value: string | undefined): value is ModelCategory {
  return (MODEL_CATEGORIES as readonly string[]).includes(value ?? '');
}

export function isModelPage(value: string | undefined): value is ModelPage {
  return (MODEL_PAGES as readonly string[]).includes(value ?? '');
}
