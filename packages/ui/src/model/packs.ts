import {
  expandQuickAction,
  isPackId,
  PACK_DEFAULT_VERSION,
  PACK_EXAMPLE_EXTENSIONS,
  PACK_ID_PATTERN,
  PACK_LIMITS,
  PACK_RESERVED_IDS,
  PACK_STYLE_MAX_CHARS,
  packScanReasonText,
  RpcError,
  slugPackId,
  type LibraryEntrySummary,
  type PackActiveStyle,
  type PackExample,
  type PackExampleView,
  type PackExportParams,
  type PackFileHit,
  type PackItemState,
  type PackPreview,
  type PackPreviewItemState,
  type PackQuickAction,
  type PackRef,
  type PackRemoveResult,
  type PackScanReason,
  type PackSource,
  type PackSummary,
  type PackWarning,
  type SkillSummary,
} from '@cuccut/protocol';
import { PACKS_COPY as P, type PackAction } from '../components/settings/packs-copy.ts';
import { fileSizeLabel } from './agent-skills.ts';
import type { HomeTemplate } from './home-templates.ts';
import { shortenPath } from './format.ts';

/**
 * View-models for packs (pack design §2, §6): the list's contents and origin lines, item states on the pack page, the
 * style guide's reason, plain sentences for `packs.*` error codes, quick-action text, and which view a
 * `/settings/packs/<sub>` address shows.
 */

/** The order from `packs.list` is not a contract: by name, ties broken by id. */
export function sortPacks(list: readonly PackSummary[]): PackSummary[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

/** "1 template · 2 skills · 3 library items · a style guide · 3 quick actions", only the parts that are there; "Nothing of its own" when none is. */
export function packContents(pack: Pick<PackSummary, 'counts' | 'hasStyle'>): string {
  const { counts } = pack;
  const L = P.list;
  const parts = [
    counts.templates ? L.templates(counts.templates) : '',
    counts.skills ? L.skills(counts.skills) : '',
    counts.library ? L.library(counts.library) : '',
    pack.hasStyle ? L.styleGuide : '',
    counts.quickActions ? L.quickActions(counts.quickActions) : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : L.nothing;
}

/** `v1.0.0 · author`. */
export function packVersionLine(pack: Pick<PackSummary, 'version' | 'author'>): string {
  return P.list.versionLine(pack.version, pack.author);
}

export interface PackOrigin {
  kind: PackSource['kind'];
  /** What a person recognises: a `~`-shortened folder, `github.com/owner/repo/…`, or the host and path of a web address. */
  short: string;
  /** The source in full (a tooltip, the pack page). */
  full: string;
  /** What the origin icon stands for, for screen readers. */
  label: string;
}

/** Where an installed pack came from, shortened for the list. */
export function packOrigin(source: PackSource): PackOrigin {
  const label = P.list.origin[source.kind];
  if (source.kind === 'local') return { kind: 'local', short: shortenPath(source.path), full: source.path, label };
  if (source.kind === 'github') return { kind: 'github', short: source.url.replace(/^https?:\/\//, ''), full: source.url, label };
  let short = source.url;
  try {
    const url = new URL(source.url);
    short = url.host + url.pathname.replace(/\/+$/, '');
  } catch {
    // Not a parseable address: show it as recorded.
  }
  return { kind: 'url', short, full: source.url, label };
}

/** The note after an item on the pack page: nothing for a present item, "(changed since)" or "(deleted since)". */
export function packItemStateLabel(state: PackItemState): string {
  return state === 'changed' ? P.pack.changed : state === 'deleted' ? P.pack.deleted : '';
}

/** Why a style guide is (or isn't) active, as one sentence. */
export function styleReasonText(reason: PackActiveStyle['reason']): string {
  return P.style.reason[reason];
}

/** The caption under the Style guide choice: "Using X. <reason>" or "No style guide. <reason>". */
export function activeStyleCaption(active: PackActiveStyle): string {
  const reason = styleReasonText(active.reason);
  return active.pack ? P.style.using(active.pack.name, reason) : P.style.noneUsed(reason);
}

/** The value of the Style guide choice: `'auto'` (decide on its own), `'none'`, or a pack id. */
export type StyleChoiceKey = 'auto' | 'none' | string;

/** The options of the Style guide choice: decide on its own, none, then each installed pack with a guide (by name). */
export function styleChoiceOptions(packs: readonly PackSummary[]): { key: StyleChoiceKey; label: string }[] {
  return [
    { key: 'auto', label: P.style.auto },
    { key: 'none', label: P.style.none },
    ...sortPacks(packs.filter((p) => p.hasStyle)).map((p) => ({ key: p.id, label: p.name })),
  ];
}

/** A project's stored choice (`packs.choose`: id, `'none'` or null) ↔ the choice's key. */
export function styleChoiceKey(choice: string | null): StyleChoiceKey {
  return choice ?? 'auto';
}

export function styleChoiceOf(key: StyleChoiceKey): string | null {
  return key === 'auto' ? null : key;
}

/**
 * The Style guide choice as `packs.active` reports it: the chosen pack, `'none'`, `'auto'`, or `'missing'` when the project chose a pack that has since been deleted (it is
 * then offered as its own option, so the choice shown is the one stored).
 */
export function styleChoiceFromActive(active: PackActiveStyle): StyleChoiceKey {
  if (active.reason === 'chosen') return active.pack?.id ?? 'auto';
  if (active.reason === 'chosen-none') return 'none';
  if (active.reason === 'chosen-missing') return STYLE_CHOICE_MISSING;
  return 'auto';
}

/** The key of the "a pack that is no longer installed" option (a pack id never has a colon). */
export const STYLE_CHOICE_MISSING = ':missing';

/** The Video menu's Style guide options: `styleChoiceOptions`, plus the deleted pack the project still names, when it does. */
export function styleDialogOptions(packs: readonly PackSummary[], active: PackActiveStyle | null): { key: StyleChoiceKey; label: string }[] {
  const options = styleChoiceOptions(packs);
  return active?.reason === 'chosen-missing' ? [...options, { key: STYLE_CHOICE_MISSING, label: P.style.missingChoice }] : options;
}

/** One quick action offered above the composer, with the pack it belongs to. */
export interface PackQuickActionItem extends PackQuickAction {
  key: string;
  pack: PackRef;
}

/** Every installed pack's quick actions (pack design §9.4: all installed packs, as agentcut does), in list order. */
export function packQuickActions(packs: readonly PackSummary[]): PackQuickActionItem[] {
  return sortPacks(packs).flatMap((pack) =>
    pack.quickActions.map((action, i) => ({ ...action, key: `${pack.id}:${i}`, pack: { id: pack.id, name: pack.name } })),
  );
}

/** A quick action's message: `{selection}` becomes “<item name>” for a selected timeline item, otherwise "this video". */
export function quickActionMessage(text: string, selectionName: string | null): string {
  return expandQuickAction(text, selectionName ? P.quick.selection(selectionName) : P.quick.thisVideo);
}

/** The tooltip of a quick-action chip. */
export function quickActionTooltip(action: Pick<PackQuickActionItem, 'pack'>): string {
  return P.quick.from(action.pack.name);
}

// ---- Errors ----

/** `RpcError.details.code`; null when there is none. */
export function packErrorCode(error: unknown): string | null {
  const code = detailsOf(error).code;
  return typeof code === 'string' ? code : null;
}

function detailsOf(error: unknown): Record<string, unknown> {
  const details = error instanceof RpcError ? error.details : null;
  return details && typeof details === 'object' ? (details as Record<string, unknown>) : {};
}

const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/**
 * Turns a `packs.*` error into one plain sentence (pack design §4.4: one per `details.code`). The Runtime's own issue
 * text is kept where it says what exactly is wrong; unknown codes fall back to "Couldn't <action>: <the Runtime's words>".
 */
export function packErrorMessage(error: unknown, action: PackAction): string {
  const E = P.errors;
  const details = detailsOf(error);
  const raw = error instanceof Error ? error.message : String(error);
  const issues = Array.isArray(details.issues) ? details.issues.filter((i): i is string => typeof i === 'string') : [];
  const onPage = action === 'saveStyle' || action === 'addExample' || action === 'saveExample';
  switch (packErrorCode(error)) {
    case 'PACK_NOT_FOUND':
      return E.notFound(str(details.packId) ?? '');
    case 'PACK_SOURCE_NOT_FOUND':
      return action === 'addExample' ? E.exampleFileNotFound : E.sourceNotFound;
    case 'PACK_URL_INVALID':
      return E.urlInvalid;
    case 'PACK_INVALID':
      return E.invalid(issues[0] ?? raw);
    case 'PACK_UNSUPPORTED_SCHEMA':
      return E.unsupportedSchema;
    case 'PACK_FOREIGN_FORMAT':
      return E.foreignFormat;
    case 'PACK_UNSUPPORTED_FIELD':
      return E.unsupportedField(issues[0] ?? raw);
    case 'PACK_TOO_LARGE':
      return action === 'addExample' ? E.exampleTooLarge(fileSizeLabel(PACK_LIMITS.totalBytes)) : E.tooLarge(PACK_LIMITS.files, fileSizeLabel(PACK_LIMITS.totalBytes));
    case 'PACK_ID_RESERVED':
      return E.idReserved;
    case 'PACK_BLOCKED':
      return blockedMessage(details, onPage) ?? raw;
    case 'PACK_STYLE_TOO_LONG':
      return E.styleTooLong(num(details.length) ?? 0, num(details.limit) ?? PACK_LIMITS.styleChars);
    case 'PACK_PREVIEW_EXPIRED':
      return E.previewExpired;
    case 'PACK_RESTORE_CONFLICT':
      return action === 'restoreExample' ? E.exampleNameTaken : E.restoreConflict(str(details.id) ?? str(details.packId) ?? '');
    case 'PACK_TRASH_EXPIRED':
      return action === 'restoreExample' ? E.exampleTrashExpired : E.trashExpired;
    case 'PACK_EXAMPLE_NOT_FOUND':
      return E.exampleNotFound;
    case 'PACK_EXAMPLE_UNSUPPORTED':
      return E.exampleUnsupported(exampleExtensions().join(', '));
    case 'PACK_EXAMPLE_LIMIT':
      return E.exampleLimit(num(details.limit) ?? PACK_LIMITS.examples);
    case 'PACK_EXPORT_TARGET_NOT_EMPTY':
      return E.exportTargetNotEmpty;
    case 'PACK_STYLE_CHANGED':
      return E.styleChanged;
    case 'PACK_NETWORK':
      return E.network;
    case 'OFFLINE_STRICT':
      return E.offline;
    case 'PROJECT_NOT_FOUND':
      return E.projectNotFound;
    case 'WEB_METHOD_NOT_ALLOWED':
      return E.webNotAllowed;
    case 'WEB_READ_ONLY':
      return E.webReadOnly;
    default:
      return E.failed(E.action[action], raw);
  }
}

const SCAN_REASONS: ReadonlySet<string> = new Set<PackScanReason>([
  'too-long',
  'ignore-instructions',
  'change-identity',
  'reveal-secrets',
  'credential',
  'command',
  'delete-work',
  'send-url',
  'prompt-boundary',
]);

/** `PACK_BLOCKED` names the first flagged line: "line N tells the agent to … (“…”)", or the whole text for `too-long` (line 0). */
function blockedMessage(details: Record<string, unknown>, save = false): string | null {
  const hits = Array.isArray(details.hits) ? details.hits : [];
  const first = (hits[0] ?? details) as Record<string, unknown>;
  const why = str(first.why);
  if (!why || !SCAN_REASONS.has(why)) return null;
  return blockedSentence({ line: num(first.line) ?? 0, why: why as PackScanReason, text: str(first.text) ?? '' }, num(details.length) ?? 0, save);
}

/**
 * "This pack will not install: line N tells the agent to … (“…”)." for one flagged line; `length` is the text's length, for `too-long`. `save`: a change on the pack page
 * ("This can't be saved: …").
 */
export function blockedSentence(hit: Pick<PackFileHit, 'line' | 'why' | 'text'>, length = 0, save = false): string {
  const why = packScanReasonText(hit.why, length).text;
  if (save) return hit.line > 0 ? P.errors.blockedSave(hit.line, why, hit.text) : P.errors.blockedSaveWhole(why);
  return hit.line > 0 ? P.errors.blocked(hit.line, why, hit.text) : P.errors.blockedWhole(why);
}

// ---- Routes ----

/** What `/settings/packs[/<sub>]` shows. */
export type PacksView = { kind: 'list' } | { kind: 'import' } | { kind: 'export' } | { kind: 'pack'; id: string };

/** The view for a sub-address: `import`, `export`, a pack id, or the list (anything else). */
export function packsView(sub: string | undefined): PacksView {
  if (sub === 'import' || sub === 'export') return { kind: sub };
  if (sub && isPackId(sub)) return { kind: 'pack', id: sub };
  return { kind: 'list' };
}

/** The notice line after a flow returns to the list. */
export function packNoticeText(notice: { kind: 'installed'; name: string } | { kind: 'exported'; dir: string }): string {
  return notice.kind === 'installed' ? P.list.installed(notice.name) : P.list.exported(shortenPath(notice.dir));
}

// ---- Import (the preview) ----

/** "1 template · 2 skills · 3 library items · a style guide · 1 reference file · 3 quick actions" for a pack not installed yet. */
export function previewContents(preview: Pick<PackPreview, 'templates' | 'skills' | 'library' | 'style' | 'examples' | 'quickActions'>): string {
  const L = P.list;
  const parts = [
    preview.templates.length ? L.templates(preview.templates.length) : '',
    preview.skills.length ? L.skills(preview.skills.length) : '',
    preview.library.length ? L.library(preview.library.length) : '',
    preview.style ? L.styleGuide : '',
    preview.examples.length ? P.import.examples(preview.examples.length) : '',
    preview.quickActions.length ? L.quickActions(preview.quickActions.length) : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : L.nothing;
}

/** What happens to a previewed template or skill whose id is taken; nothing for a new one. */
export function previewStateNote(kind: 'template' | 'skill', state: PackPreviewItemState): string {
  const S = P.import.state;
  switch (state) {
    case 'update':
      return S.update;
    case 'changed':
      return S.changed;
    case 'exists':
      return S.exists(kind);
    case 'builtin':
      return S.builtin(kind);
    default:
      return '';
  }
}

/** A warning that does not stop the install: a flagged line in a template prompt or a `SKILL.md`, or a recommended skill that is missing. */
export function previewWarningText(warning: PackWarning): string {
  if (warning.kind === 'missing-skill') return `${warning.template}: ${P.import.missingSkill(warning.skill)}`;
  return P.import.warningScan(warning.file, warning.line, packScanReasonText(warning.why, 0).text);
}

/** Why Install is off: the first line that blocks the pack, or null when it can be installed. */
export function previewBlockedReason(preview: Pick<PackPreview, 'blocked' | 'style'>): string | null {
  const first = preview.blocked[0];
  return first ? blockedSentence(first, preview.style?.text.length ?? 0) : null;
}

/** A library item's kind in words ("Glossary", "Colour", …); an unknown kind as it is. */
export function libraryKindLabel(kind: string): string {
  return P.libraryKind[kind] ?? kind;
}

// ---- The pack page ----

/** "Version 1.0.0, by X. Installed 13 October 2026. Updates are manual: …". */
export function packOriginLine(pack: Pick<PackSummary, 'version' | 'author' | 'installedAt'>): string {
  const at = new Date(pack.installedAt);
  const installed = Number.isNaN(at.getTime()) ? pack.installedAt : P.pack.installedDate(at);
  return P.pack.originLine(pack.version, pack.author, installed);
}

/** The toast after a delete: what went with the pack, and how many changed items stayed. */
export function packDeletedText(result: Pick<PackRemoveResult, 'removed' | 'moved' | 'kept'>): string {
  const text = P.pack.deletedToast(result.removed.name, result.moved.templates, result.moved.skills);
  return result.kept.length ? `${text} ${P.pack.deletedKept(result.kept.length)}` : text;
}

/** The style editor's state: characters against the limit, and whether there is anything to save. */
export function styleEditorState(text: string, saved: string): { count: string; over: boolean; changed: boolean; reason: string | null } {
  const over = text.length > PACK_STYLE_MAX_CHARS;
  const changed = text !== saved;
  return {
    count: P.style.counter(text.length, PACK_STYLE_MAX_CHARS),
    over,
    changed,
    reason: !changed ? P.style.unchanged : over ? P.style.tooLong(text.length, PACK_STYLE_MAX_CHARS) : null,
  };
}

// ---- Reference files ----

/** The extensions a reference file may have (images, then videos), for the file picker and the refusal. */
export function exampleExtensions(): string[] {
  return [...PACK_EXAMPLE_EXTENSIONS.image, ...PACK_EXAMPLE_EXTENSIONS.video];
}

/** A reference file's name on the page: its title, else its file name. */
export function exampleLabel(example: Pick<PackExample, 'title' | 'file'>): string {
  return example.title || example.file.slice(example.file.lastIndexOf('/') + 1);
}

/** The file whose picture the page shows: an image itself, a video's still; null when there is none to show. */
export function exampleStillPath(example: Pick<PackExampleView, 'kind' | 'file' | 'still' | 'hasStill'>): string | null {
  if (!example.hasStill) return null;
  return example.kind === 'image' ? example.file : (example.still ?? null);
}

/** Why a reference has no picture: a video whose still ffmpeg could not take. null when it has one. */
export function exampleStillNote(example: Pick<PackExampleView, 'kind' | 'hasStill'>): string | null {
  return example.kind === 'video' && !example.hasStill ? P.style.noStill : null;
}

/** Why a title or note can't be sent as it is (too long); null when it can. Surrounding spaces are trimmed on save. */
function detailsProblem(title: string, note: string): string | null {
  const t = title.trim();
  const n = note.trim();
  if (t.length > PACK_LIMITS.exampleTitle) return P.style.titleTooLong(t.length, PACK_LIMITS.exampleTitle);
  if (n.length > PACK_LIMITS.exampleNote) return P.style.noteTooLong(n.length, PACK_LIMITS.exampleNote);
  return null;
}

/** A reference's title and note while they are edited: whether Save has anything to do, and why it is off. */
export function exampleEditState(example: Pick<PackExample, 'title' | 'note'>, title: string, note: string): { changed: boolean; reason: string | null } {
  const changed = title.trim() !== example.title || note.trim() !== example.note;
  return { changed, reason: !changed ? P.style.exampleUnchanged : detailsProblem(title, note) };
}

/** The add form: why "Add reference" is off (the pack is full, no file chosen, a field too long); null when it can be added. */
export function exampleAddReason(draft: { path: string; title: string; note: string }, count: number): string | null {
  if (count >= PACK_LIMITS.examples) return P.style.exampleLimit(PACK_LIMITS.examples);
  if (!draft.path.trim()) return P.style.needFile;
  return detailsProblem(draft.title, draft.note);
}

// ---- Export ----

/** What the export page holds while it is filled in. Ids of the chosen items; quick actions by `packQuickActions` key; `stylePack` '' for none. */
export interface PackExportDraft {
  name: string;
  id: string;
  /** The ID was typed: it no longer follows the name. */
  idEdited: boolean;
  version: string;
  author: string;
  description: string;
  dir: string;
  /** The folder was typed or chosen: it no longer follows the ID. */
  dirEdited: boolean;
  templates: string[];
  skills: string[];
  /** `glossaries:<id>` / `brand:<id>`. */
  library: string[];
  quickActions: string[];
  stylePack: string;
}

export function emptyExportDraft(): PackExportDraft {
  return {
    name: '',
    id: '',
    idEdited: false,
    version: PACK_DEFAULT_VERSION,
    author: '',
    description: '',
    dir: '',
    dirEdited: false,
    templates: [],
    skills: [],
    library: [],
    quickActions: [],
    stylePack: '',
  };
}

/** `<projectsDir>/Packs/<id>`, with the separator the folder already uses. Empty without both. */
export function defaultExportDir(projectsDir: string | null, id: string): string {
  if (!projectsDir || !id) return '';
  const sep = projectsDir.includes('\\') && !projectsDir.includes('/') ? '\\' : '/';
  return `${projectsDir.replace(/[\\/]+$/, '')}${sep}Packs${sep}${id}`;
}

/** A change to the draft: the ID follows the name and the folder follows the ID until either is typed. */
export function updateExportDraft(draft: PackExportDraft, patch: Partial<PackExportDraft>, projectsDir: string | null): PackExportDraft {
  const next = { ...draft, ...patch };
  if (patch.name !== undefined && !next.idEdited) next.id = slugPackId(next.name) ?? '';
  if ((patch.name !== undefined || patch.id !== undefined) && !next.dirEdited) next.dir = defaultExportDir(projectsDir, next.id);
  return next;
}

/** Why "Write the pack" is off, or null when it can be written. */
export function exportProblem(draft: Pick<PackExportDraft, 'name' | 'id' | 'dir'>): string | null {
  const E = P.export;
  if (!draft.name.trim()) return E.needName;
  if ((PACK_RESERVED_IDS as readonly string[]).includes(draft.id)) return E.reservedId;
  if (!draft.id || draft.id.length > PACK_LIMITS.id || !PACK_ID_PATTERN.test(draft.id)) return E.needId;
  if (!draft.dir.trim()) return E.needFolder;
  return null;
}

/** The draft as `packs.export` takes it. Unknown quick-action keys (a pack removed meanwhile) are dropped. */
export function exportRequest(draft: PackExportDraft, packs: readonly PackSummary[]): PackExportParams {
  const actions = new Map(packQuickActions(packs).map((a) => [a.key, a]));
  return {
    dir: draft.dir.trim(),
    manifest: {
      id: draft.id,
      name: draft.name.trim(),
      ...(draft.version.trim() ? { version: draft.version.trim() } : {}),
      ...(draft.author.trim() ? { author: draft.author.trim() } : {}),
      ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
    },
    templates: draft.templates,
    skills: draft.skills,
    library: draft.library.flatMap((key) => {
      const [library, id] = key.split(/:(.*)/s) as [string, string];
      return (library === 'glossaries' || library === 'brand') && id ? [{ library, id }] : [];
    }),
    quickActions: draft.quickActions.flatMap((key) => {
      const action = actions.get(key);
      return action ? [{ label: action.label, text: action.text }] : [];
    }),
    ...(draft.stylePack ? { stylePack: draft.stylePack } : {}),
  };
}

/** The templates that can travel: the user's own (built-in ones are everywhere already), by title. */
export function exportableTemplates(templates: readonly HomeTemplate[]): HomeTemplate[] {
  return templates.filter((t) => t.source !== 'builtin').sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}

/** The skills that can travel: personal and pack skills, and apart those imported from GitHub (third-party); never built-in ones. */
export function exportableSkills(skills: readonly SkillSummary[]): { own: SkillSummary[]; thirdParty: SkillSummary[] } {
  const byName = (a: SkillSummary, b: SkillSummary) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  return {
    own: skills.filter((s) => s.origin === 'personal' || s.origin === 'pack').sort(byName),
    thirdParty: skills.filter((s) => s.origin === 'third-party').sort(byName),
  };
}

/** Library entries that can travel, grouped: glossaries, colours and caption styles, then files (images, video, stickers, fonts). Voices never do. */
export function exportLibraryGroups(
  glossaries: readonly LibraryEntrySummary[],
  brand: readonly LibraryEntrySummary[],
): { key: 'glossaries' | 'colours' | 'media'; label: string; entries: LibraryEntrySummary[] }[] {
  const styled = new Set(['color', 'captionStyle']);
  return [
    { key: 'glossaries' as const, label: P.export.glossaries, entries: [...glossaries] },
    { key: 'colours' as const, label: P.export.colours, entries: brand.filter((e) => styled.has(e.kind)) },
    { key: 'media' as const, label: P.export.media, entries: brand.filter((e) => !styled.has(e.kind)) },
  ].filter((g) => g.entries.length);
}

/** The key of a library entry in `PackExportDraft.library`. */
export function libraryKey(entry: Pick<LibraryEntrySummary, 'library' | 'id'>): string {
  return `${entry.library}:${entry.id}`;
}
