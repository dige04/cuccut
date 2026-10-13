import {
  GRANT_DATA_KIND_LABELS,
  intlLocale,
  live,
  localizeText,
  MCP_SERVICE_TOOL_NAMES,
  type GrantRequestItem,
  type Id,
  type McpServiceTool,
  type PendingApproval,
  type ServiceApproval,
  type ServiceLevel,
  type ServicePolicy,
  type ServiceRequestRecord,
  type SpaceEntry,
} from '@cuccut/protocol';
import { M } from './services-mcp-copy.ts';
import type { ServiceState } from './services.ts';

/**
 * Pure model for the MCP service page (prototype designs/cuccut/app/model-services.js, MCP part, and model-mcp-tools.js; architecture design §4.8, §12.8): three access levels, the one-line description of scope, the sub-line on the service card, the tool catalog and its destinations, the one-line description of a recent request, and the countdown for service approvals.
 */

/** The three tiers of allowed operations (prototype `MCP_ACCESS`); the Runtime levels have the same names: `read` / `ask` / `auto`. */
export const MCP_LEVELS: readonly { level: ServiceLevel; title: string; desc: string }[] = (['read', 'ask', 'auto'] as const).map((level) => ({
  level,
  get title() {
    return M.levels[level].title;
  },
  get desc() {
    return M.levels[level].desc;
  },
}));

export function levelTitle(level: ServiceLevel): string {
  return MCP_LEVELS.find((l) => l.level === level)?.title ?? level;
}

/** Videos that can be chosen in scope: videos in registered projects (the video entries of the Space, excluding the trash and anything not belonging to a project). The service's scope also recognizes only these (service-scope.ts). */
export interface ScopeVideo {
  videoId: Id;
  name: string;
}

export function scopeVideos(entries: readonly SpaceEntry[]): ScopeVideo[] {
  const seen = new Set<Id>();
  const out: ScopeVideo[] = [];
  for (const entry of entries) {
    if (entry.kind !== 'video' || entry.user.trashedAt || !entry.source.projectId) continue;
    const ref = entry.ref;
    if (!ref || !('videoId' in ref) || seen.has(ref.videoId)) continue;
    seen.add(ref.videoId);
    out.push({ videoId: ref.videoId, name: entry.user.displayName ?? entry.name });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, intlLocale()));
}

/** The one-line description of scope (prototype `mcpScope`): “all videos”, “「标题」”（one video, by title), “N videos included”. */
export function mcpScope(videos: ServicePolicy['videos'], total: number, nameOf: (id: Id) => string | undefined): string {
  if (videos === 'all') return M.scopeAll(total);
  const ids = videos.ids;
  if (ids.length === 0) return M.scopeNone;
  if (ids.length === 1) return M.scopeOne(nameOf(ids[0]!) ?? ids[0]!);
  return M.scopeSome(ids.length);
}

/**
 * The scope after ticking items in the “只开放勾选的视频” menu (prototype `mcpToggleProject`): ticking every item equals “All videos” (including ones created later); picking one from “All videos” leaves only that one. Unticking down to none leaves an empty list (no videos in scope): the prototype goes back to “All videos” here, but this does not quietly widen the scope.
 */
export function pickedScope(picked: Iterable<Id>, all: readonly Id[]): ServicePolicy['videos'] {
  const ids = [...new Set(picked)].filter((id) => all.includes(id));
  if (all.length > 0 && all.every((x) => ids.includes(x))) return 'all';
  return { ids };
}

/** Sub-line of a service card (prototype `mcpSub`): when off, it says what would be opened if it were turned on; when on, it says which videos are opened and with what permissions. Runtime always requires a token. */
export function mcpSub(state: ServiceState, scope: string, level: ServiceLevel): string {
  const access = M.access(levelTitle(level));
  if (state === 'on') return M.subOn(scope, access);
  if (state === 'starting' || state === 'stopping') return scope;
  return M.subOff(scope, access);
}

// ---- Tool catalog ----

export type McpToolGroup = 'read' | 'edit' | 'job' | 'generate';

export interface McpTool {
  name: string;
  title: string;
  group: McpToolGroup;
  /** `read` is in the catalog at every level; `write` appears only under `ask` and `auto`. */
  access: 'read' | 'write';
}

/** Tool groups (prototype model-mcp-tools.js `GROUPS`). */
export const MCP_TOOL_GROUPS: readonly { group: McpToolGroup; label: string; hint: string }[] = (['read', 'edit', 'job', 'generate'] as const).map(
  (group) => ({
    group,
    get label() {
      return M.groups[group].label;
    },
    get hint() {
      return M.groups[group].hint;
    },
  }),
);


/** The group for a catalog item's effect: querying is read; synthesizing speech and generating images are generate; other background tasks (including cancelling tasks) are tasks; other writes are edit. */
function toolGroup(tool: McpServiceTool): McpToolGroup {
  if (tool.effect === 'query') return 'read';
  if (tool.name === 'speak' || tool.name === 'image') return 'generate';
  if (tool.effect === 'job' || tool.name === 'jobs_cancel') return 'job';
  return 'edit';
}

/**
 * Tools exposed by the MCP service: derived from the protocol constant `MCP_SERVICE_TOOL_NAMES` (Runtime derives the same list from the catalog's surfaces, and a test keeps the two in agreement; architecture design §4.8). Names and parameters are a public contract; changing them requires bumping `MCP_INTERFACE_VERSION`. Titles are in services-mcp-copy.ts; new tools with no entry there use the protocol's title.
 */
export const MCP_TOOLS: readonly McpTool[] = MCP_SERVICE_TOOL_NAMES.map((tool) => ({
  name: tool.name,
  get title() {
    return (M.tools as Partial<Record<string, string>>)[tool.name] ?? tool.title;
  },
  group: toolGroup(tool),
  access: tool.effect === 'query' ? 'read' : 'write',
}));

export function mcpToolTitle(name: string): string {
  return MCP_TOOLS.find((t) => t.name === name)?.title ?? name;
}

/** Destination of a tool (prototype `gate`; there is no per-tool switch, so no `off`): reply directly / execute directly / ask before calling / not offered under read-only permission. */
export type McpToolGate = 'answer' | 'auto' | 'ask' | 'hidden';

export function toolGate(tool: McpTool, level: ServiceLevel): McpToolGate {
  if (tool.access === 'read') return 'answer';
  if (level === 'read') return 'hidden';
  return level === 'auto' ? 'auto' : 'ask';
}

export const GATE_LABEL: Readonly<Record<McpToolGate, string>> = live(() => M.gates);

/** One sentence beside the tool section heading (prototype `summary`): “offering N of N tools · M ask before calling”. */
export function toolsSummary(level: ServiceLevel): string {
  const exposed = MCP_TOOLS.filter((t) => toolGate(t, level) !== 'hidden');
  const ask = exposed.filter((t) => toolGate(t, level) === 'ask').length;
  const writes = exposed.filter((t) => t.access === 'write').length;
  return M.toolsSummary(exposed.length, MCP_TOOLS.length, ask, writes);
}

// ---- Recent requests and approvals ----

/** Result wording: `ok` means success; the others are error codes, with the common ones spelled out in plain words. */
export function outcomeLabel(outcome: string): string {
  if (outcome === 'ok') return M.outcomes.ok;
  if (outcome === 'SERVICE_APPROVAL_DENIED') return M.outcomes.denied;
  if (outcome === 'VIDEO_NOT_FOUND') return M.outcomes.videoNotFound;
  if (outcome === 'UNKNOWN_TOOL') return M.outcomes.unknownTool;
  return outcome;
}

/** One line for a recent request: the tool (its display name) and the target video; if the video is not in the list, the ID is written. */
export function requestLine(record: ServiceRequestRecord, nameOf: (id: Id) => string | undefined): string {
  const tool = record.tool;
  if (!record.videoId) return tool;
  return M.requestLine(tool, nameOf(record.videoId) ?? record.videoId);
}

/** Seconds left on an approval (the service approval has a 50-second time limit); 0 once it has passed. */
export function approvalSecondsLeft(approval: Pick<ServiceApproval, 'expiresAt'>, now: number): number {
  const at = Date.parse(approval.expiresAt);
  if (Number.isNaN(at)) return 0;
  return Math.max(0, Math.ceil((at - now) / 1000));
}

/** Only the approvals for one service that have not yet timed out, oldest first. */
export function liveApprovals(approvals: readonly ServiceApproval[], serviceId: ServiceApproval['serviceId'], now: number): ServiceApproval[] {
  return approvals.filter((a) => a.serviceId === serviceId && approvalSecondsLeft(a, now) > 0);
}

/** The number of unexpired approvals across all services (the rail badge). */
export function liveApprovalCount(approvals: readonly ServiceApproval[], now: number): number {
  return approvals.filter((a) => approvalSecondsLeft(a, now) > 0).length;
}

/**
 * Data a service approval would send outside that is not yet covered by an authorization: approvals in the `services` topic carry no `grants`; the same approval appears in the unified list of the `tasks` topic (`PendingApproval.grants`), looked up by `approvalId`.
 */
export function approvalGrants(pending: readonly PendingApproval[], approvalId: Id): GrantRequestItem[] {
  return pending.find((a) => a.approvalId === approvalId)?.grants ?? [];
}

/** One line for outbound authorization: “要把音频发给 openai（转录）· 约 0.02 USD”（send the audio to openai (transcription) · about 0.02 USD). */
export function grantLine(item: GrantRequestItem): string {
  const kinds = M.joinKinds(item.dataKinds.map((k) => GRANT_DATA_KIND_LABELS[k]));
  return M.grantLine(kinds, item.recipient, localizeText(item.purpose, item.purposeRef), item.estimate);
}
