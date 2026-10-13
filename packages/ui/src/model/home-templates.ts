import {
  TEMPLATE_ASSET_TYPES,
  TEMPLATE_CATEGORIES,
  templateExampleText,
  type TemplateAsset,
  type TemplateAssetType,
  type TemplateField,
  type TemplateFigure,
  type TemplateKind,
  type TemplateRatio,
  type TemplateSummary,
  type TemplateTone,
} from '@cuccut/protocol';
import {
  TEMPLATE_ASSET_LABEL,
  TEMPLATE_CATEGORY_LABEL,
  TEMPLATE_KIND_LABEL,
  TEMPLATE_SOURCE_LABEL,
  TEMPLATE_SPEC_COPY,
  type TemplateSourceKey,
} from '../copy.ts';
import { lengthLabel } from './home-brief.ts';
import { slotLabels } from './prompt-slots.ts';

export type { TemplateSourceKey } from '../copy.ts';

/**
 * Home template library (product design §3.2.1; template pack spec docs/spec/template-spec.md; prototype designs/cuccut/app/model-home-templates.js).
 * Templates come from the Runtime's template catalogue (`templates.list`); this file holds only pure logic: converting the list into the shape the UI uses, filtering, searching, paging,
 * and the copy for the template grid shelf under the input box and for the cards. There are two kinds of template (spec §1.2):
 * - `scene` scene templates: attached to the input box; when sent, only the template identifier is passed, and the brief guidance and body are assembled by the Runtime (§5.2);
 * - `example` example works: the full prompt is put into the input box, and from then on it is the user's own words (§5.1).
 */

export interface HomeTemplate {
  id: string;
  version: string;
  /**
   * The language of the copy: the language version the Runtime picks according to the UI language (template pack spec §3.6); when there is no translation, it is the language of the original list text.
   * The prompt text and the send both use this, so they match the version shown on the card.
   */
  language: string;
  kind: TemplateKind;
  /** Category keys (spec §3.2); unrecognized keys are kept as they are, and the display name has a fallback. */
  category: string;
  /** Keys for the source filter: built-in catalogue and user catalogue; entries whose list says `community` count as community. */
  source: TemplateSourceKey;
  author: string;
  title: string;
  summary: string;
  description: string;
  /** “可以这样说” (You can say something like): the placeholders in `brief` are replaced with each item's example (the label is used when there is no example); empty string when there is no brief. */
  sample: string;
  /** The text filled into the input box when a scene template is chosen, with `{{label}}` placeholders (spec §5.5); example works have none, so it is an empty string. */
  brief: string;
  /** Unfilled slots: for scene, the placeholders in `brief`; for example, those in the prompt body. */
  fields: readonly TemplateField[];
  /** The craft guide to read first before making this kind of finished video. */
  skills: readonly string[];
  /** Default aspect ratio; null = automatic. */
  ratio: TemplateRatio | null;
  /** Default duration (seconds, the list's `durationSeconds`); null = automatic. */
  length: number | null;
  tags: readonly string[];
  tone: TemplateTone;
  figure: TemplateFigure;
  kicker: string;
  /** Scenes for the placeholder preview carousel; when the list gives none (and there is a preview video), the title fills one scene so the carousel is never empty. */
  beats: readonly string[];
  /** Cover image (the list's `cover.file`, and the Runtime says the file exists); when null, a placeholder cover is drawn. */
  cover: string | null;
  /** Preview video (the list's `preview.file`, and the Runtime says the file exists); when null, the carousel shows beats. */
  preview: string | null;
  assets: readonly TemplateAsset[];
}

/** How many items fit on one page of “全部模板” (All templates). */
export const TEMPLATES_PER_PAGE = 9;
/** Maximum number of cards in the start page template grid (four columns, two rows). */
export const SHELF_MAX = 8;
/** The grid's default eight: six scene templates plus two example works, with both kinds mixed, covering all seven categories (prototype `SHELF_DEFAULT`). */
export const SHELF_DEFAULT: readonly string[] = [
  'promo-ad',
  'knowledge-explainer',
  'data-story',
  'typography-motion',
  'launch-film',
  'vlog-edit',
  'story-short',
  'ai-news-take',
];

const SOURCE_ORDER: readonly TemplateSourceKey[] = ['builtin', 'user', 'community'];

/** Duration in seconds from the list; null (automatic) when not given or not a positive number. */
export function templateLength(seconds: number | null | undefined): number | null {
  return typeof seconds === 'number' && seconds > 0 ? seconds : null;
}

function sourceKey(summary: TemplateSummary): TemplateSourceKey {
  if (summary.manifest.source === 'community') return 'community';
  return summary.origin === 'builtin' ? 'builtin' : 'user';
}

/** One entry of `templates.list` → shape used by the UI. */
export function homeTemplateOf(summary: TemplateSummary): HomeTemplate {
  const m = summary.manifest;
  const beats = m.preview.beats?.length ? m.preview.beats : [m.title];
  return {
    id: m.id,
    version: m.version,
    language: m.language,
    kind: m.kind,
    category: m.category,
    source: sourceKey(summary),
    author: m.author,
    title: m.title,
    summary: m.summary,
    description: m.description,
    sample: m.brief ? templateExampleText(m.brief, m.fields) : '',
    brief: m.brief ?? '',
    fields: m.fields ?? [],
    skills: m.skills ?? [],
    ratio: m.ratio ?? null,
    length: templateLength(m.durationSeconds),
    tags: m.tags,
    tone: m.cover.tone ?? 'blue',
    figure: m.cover.figure ?? 'bars',
    kicker: m.cover.kicker ?? '',
    beats,
    cover: summary.files.cover && m.cover.file ? m.cover.file : null,
    preview: summary.files.preview && m.preview.file ? m.preview.file : null,
    assets: m.assets ?? [],
  };
}

/** The whole catalogue: the order the Runtime gives is not part of the contract (spec §6), so here it is sorted by source (built-in, mine, community) and then by id. */
export function templateCatalogOf(list: readonly TemplateSummary[]): HomeTemplate[] {
  return list
    .map(homeTemplateOf)
    .sort((a, b) => SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function isExample(t: Pick<HomeTemplate, 'kind'> | null | undefined): boolean {
  return t?.kind === 'example';
}

export function templateOf(catalog: readonly HomeTemplate[], id: string | null | undefined): HomeTemplate | null {
  return (id && catalog.find((t) => t.id === id)) || null;
}

/** Which templates the grid below the input box shows: most recently used first, filled up to eight from the defaults when short; keys no longer in the catalogue are dropped (including keys saved by older versions). */
export function templateShelf(catalog: readonly HomeTemplate[], recent: readonly unknown[] | null | undefined): HomeTemplate[] {
  const keys = [...(Array.isArray(recent) ? recent : []), ...SHELF_DEFAULT].filter(
    (k, i, all): k is string => typeof k === 'string' && !!templateOf(catalog, k) && all.indexOf(k) === i,
  );
  return keys.slice(0, SHELF_MAX).map((k) => templateOf(catalog, k)!);
}

/** The grid keys after a template is picked: templates already in the grid stay in place (cards do not jump around), and a new template picked from the library goes to the front, pushing out the last one. */
export function shelfAfterPick(catalog: readonly HomeTemplate[], recent: readonly unknown[] | null | undefined, id: string): string[] {
  const keys = templateShelf(catalog, recent).map((t) => t.id);
  if (!templateOf(catalog, id) || keys.includes(id)) return keys;
  return [id, ...keys].slice(0, SHELF_MAX);
}

export interface TemplateFilter {
  kind?: TemplateKind | 'all';
  category?: string;
  source?: TemplateSourceKey | 'all';
}

/** Filters in the template library: type, category, source, plus a search term (matches the name, one-line description, tags or author). */
export function findTemplates(catalog: readonly HomeTemplate[], query: string, filter: TemplateFilter = {}): HomeTemplate[] {
  const q = query.trim().toLowerCase();
  const on = (value: string, want: string | undefined) => !want || want === 'all' || value === want;
  return catalog.filter(
    (t) =>
      on(t.kind, filter.kind) &&
      on(t.category, filter.category) &&
      on(t.source, filter.source) &&
      (!q || [t.title, t.summary, t.author, ...t.tags].some((x) => x.toLowerCase().includes(q))),
  );
}

/** Display names for categories; unrecognized keys (brought by a newer Runtime) are shown by their key name. */
export function categoryLabel(key: string): string {
  return (TEMPLATE_CATEGORY_LABEL as Record<string, string>)[key] ?? key;
}

/** Category buttons: all, the seven categories of the spec, plus any keys that appear in the catalogue but are not recognized. */
export function templateCategories(catalog: readonly HomeTemplate[]): { key: string; label: string }[] {
  const known: readonly string[] = TEMPLATE_CATEGORIES;
  const extra = [...new Set(catalog.map((t) => t.category).filter((c) => !known.includes(c)))].sort();
  return [{ key: 'all', label: TEMPLATE_CATEGORY_LABEL.all }, ...[...known, ...extra].map((key) => ({ key, label: categoryLabel(key) }))];
}

/** Type segments: all, scene templates, example works. */
export const TEMPLATE_KINDS_FILTER: readonly { key: TemplateKind | 'all'; label: string }[] = [
  { key: 'all', label: TEMPLATE_KIND_LABEL.all },
  { key: 'scene', label: TEMPLATE_KIND_LABEL.scene },
  { key: 'example', label: TEMPLATE_KIND_LABEL.example },
];

/** Source filter options: when the catalogue has only one source, no filter is needed, so it returns empty. */
export function templateSources(catalog: readonly HomeTemplate[]): { key: TemplateSourceKey | 'all'; label: string }[] {
  const present = SOURCE_ORDER.filter((s) => catalog.some((t) => t.source === s));
  return present.length > 1
    ? [{ key: 'all', label: TEMPLATE_SOURCE_LABEL.all }, ...present.map((key) => ({ key, label: TEMPLATE_SOURCE_LABEL[key] }))]
    : [];
}

/** Paging: page numbers start at 1, out-of-range values are clamped to the valid range; an empty list still counts as one page. */
export function pageOf<T>(
  list: readonly T[],
  page: number,
  per = TEMPLATES_PER_PAGE,
): { items: T[]; page: number; pages: number; total: number } {
  const pages = Math.max(1, Math.ceil(list.length / per));
  const p = Math.min(pages, Math.max(1, Math.round(page) || 1));
  return { items: list.slice((p - 1) * per, p * per), page: p, pages, total: list.length };
}

/** Aspect ratio and duration, a short line: “9:16 · 约 30 秒” (9:16 · about 30 seconds), “16:9 · 时长自动” (16:9 · duration automatic), “画幅与时长自动” (aspect ratio and duration automatic). */
export function templateSpec(t: Pick<HomeTemplate, 'ratio' | 'length'>): string {
  const length = lengthLabel(t.length);
  if (!t.ratio && !length) return TEMPLATE_SPEC_COPY.allAuto;
  return [t.ratio ?? TEMPLATE_SPEC_COPY.ratioAuto, length ?? TEMPLATE_SPEC_COPY.lengthAuto].join(' · ');
}

/** The row in the details: scene templates show “默认” (default); for example works that give no explanation, the Agent is left to explain. */
export function templateSpecLine(t: Pick<HomeTemplate, 'kind' | 'ratio' | 'length'>): string {
  if (!isExample(t)) return TEMPLATE_SPEC_COPY.sceneDefault(templateSpec(t));
  return t.ratio || t.length ? templateSpec(t) : TEMPLATE_SPEC_COPY.exampleAuto;
}

/** The small line on the card: “9:16 · 约 30 秒 · 内置” (9:16 · about 30 seconds · built-in), “画幅与时长自动 · 我的” (aspect ratio and duration automatic · mine). */
export function templateMeta(t: HomeTemplate): string {
  return [templateSpec(t), TEMPLATE_SOURCE_LABEL[t.source]].join(' · ');
}

/** Source shown in the details: “内置 · 场景模板 · 营销推广” (built-in · scene template · marketing), “我的 · 作者 · 作品示例 · 动效设计” (mine · author · example work · motion design). Built-in ones do not list an author (they are all CucCut). */
export function templateByline(t: HomeTemplate): string {
  return [TEMPLATE_SOURCE_LABEL[t.source], t.source === 'builtin' ? null : t.author, TEMPLATE_KIND_LABEL[t.kind], categoryLabel(t.category)]
    .filter(Boolean)
    .join(' · ');
}

/** Bundled material is counted by kind; kinds with none are not listed. */
export function templateAssets(t: Pick<HomeTemplate, 'assets'>): { kind: TemplateAssetType; label: string; count: number }[] {
  return TEMPLATE_ASSET_TYPES.map((kind) => ({
    kind,
    label: TEMPLATE_ASSET_LABEL[kind],
    count: t.assets.filter((a) => a.type === kind).length,
  })).filter((a) => a.count > 0);
}

/**
 * Details “需要你补充” (What you need to add) (spec §5.5; prototype `slotFields`): lists the unfilled slots in the order they first appear in the brief, with the description of the same-named item from the list attached;
 * labels not described in the list are listed by name only. Unfilled slots of example works are in the prompt body, so the details do not list them (returns empty).
 */
export function templateSlotFields(t: Pick<HomeTemplate, 'kind' | 'brief' | 'fields'>): TemplateField[] {
  if (isExample(t)) return [];
  return slotLabels(t.brief).map((label) => t.fields.find((f) => f.label === label) ?? { label });
}
