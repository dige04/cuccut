import {
  expandQuickAction,
  isPackId,
  PACK_LIMITS,
  packScanReasonText,
  RpcError,
  type PackActiveStyle,
  type PackItemState,
  type PackQuickAction,
  type PackRef,
  type PackScanReason,
  type PackSource,
  type PackSummary,
} from '@cuccut/protocol';
import { PACKS_COPY as P, type PackAction } from '../components/settings/packs-copy.ts';
import { fileSizeLabel } from './agent-skills.ts';
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
  switch (packErrorCode(error)) {
    case 'PACK_NOT_FOUND':
      return E.notFound(str(details.packId) ?? '');
    case 'PACK_SOURCE_NOT_FOUND':
      return E.sourceNotFound;
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
      return E.tooLarge(PACK_LIMITS.files, fileSizeLabel(PACK_LIMITS.totalBytes));
    case 'PACK_ID_RESERVED':
      return E.idReserved;
    case 'PACK_BLOCKED':
      return blockedMessage(details) ?? raw;
    case 'PACK_STYLE_TOO_LONG':
      return E.styleTooLong(num(details.length) ?? 0, num(details.limit) ?? PACK_LIMITS.styleChars);
    case 'PACK_PREVIEW_EXPIRED':
      return E.previewExpired;
    case 'PACK_RESTORE_CONFLICT':
      return E.restoreConflict(str(details.id) ?? str(details.packId) ?? '');
    case 'PACK_TRASH_EXPIRED':
      return E.trashExpired;
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
function blockedMessage(details: Record<string, unknown>): string | null {
  const hits = Array.isArray(details.hits) ? details.hits : [];
  const first = (hits[0] ?? details) as Record<string, unknown>;
  const why = str(first.why);
  if (!why || !SCAN_REASONS.has(why)) return null;
  const line = num(first.line) ?? 0;
  const text = packScanReasonText(why as PackScanReason, num(details.length) ?? 0).text;
  return line > 0 ? P.errors.blocked(line, text, str(first.text) ?? '') : P.errors.blockedWhole(text);
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
