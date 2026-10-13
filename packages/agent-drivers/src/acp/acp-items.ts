/*
 * Some mechanisms are ported from paseo (Apache-2.0, Copyright (c) 2025-present Mohamed Boudra), modified:
 * mergeToolSnapshot / coalesceDefined (incremental merging of tool calls), mapToolStatus, extractToolText / contentBlockToText, buildShellCommand, mapPermissionRequest / selectPermissionOption (approval options), deriveModesFromACP / deriveModelDefinitionsFromACP / findSelectConfigOption / flattenSelectOptions (mode and model tables), normalizeMcpServers (keeps only Streamable HTTP), mapPlanToTimeline, all in packages/server/src/server/agent/providers/acp-agent.ts.
 * Changed to CucCut's AgentItem / ApprovalRequest / DriverModel; the approval kinds, the classification key for "allow for this session", and the conversion of `diff` content blocks to unified diff are new.
 */
import type { ApprovalRequest, DriverModel, ToolCallKind, ToolCallStatus } from '@cuccut/protocol';
import type { AgentItem, McpServerSpec } from '@cuccut/harness';
import type {
  ContentBlock,
  McpServer,
  PermissionOption,
  Plan,
  SessionConfigOption,
  SessionConfigSelectOption,
  SessionModeState,
  ToolCall,
  ToolCallContent,
  ToolCallLocation,
  ToolCallUpdate,
  ToolKind,
  ToolCallStatus as AcpToolStatus,
} from '@agentclientprotocol/sdk';
import { commandRule } from '../approval-rule.ts';
import { diffPath, textDiff } from '../unified-diff.ts';

/** The state of one tool call so far: `tool_call` merged with the subsequent `tool_call_update`. */
export interface ToolSnapshot {
  toolCallId: string;
  title: string;
  kind: ToolKind | null;
  status: AcpToolStatus | null;
  content: ToolCallContent[] | null;
  locations: ToolCallLocation[] | null;
  rawInput: unknown;
  rawOutput: unknown;
}

export function mergeToolSnapshot(toolCallId: string, update: ToolCall | ToolCallUpdate, previous?: ToolSnapshot): ToolSnapshot {
  return {
    toolCallId,
    title: update.title ?? previous?.title ?? toolCallId,
    kind: update.kind ?? previous?.kind ?? null,
    status: update.status ?? previous?.status ?? null,
    content: update.content !== undefined ? (update.content ?? null) : (previous?.content ?? null),
    locations: update.locations !== undefined ? (update.locations ?? null) : (previous?.locations ?? null),
    rawInput: update.rawInput !== undefined ? update.rawInput : previous?.rawInput,
    rawOutput: update.rawOutput !== undefined ? update.rawOutput : previous?.rawOutput,
  };
}

export function mapToolStatus(status: AcpToolStatus | null | undefined): ToolCallStatus {
  switch (status) {
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    default:
      return 'running';
  }
}

/** ACP tool kind → CucCut step kind. Reading, searching, thinking and similar have no dedicated icon, so they map to `other`. */
export function toolCallKind(kind: ToolKind | null): ToolCallKind {
  switch (kind) {
    case 'execute':
      return 'command';
    case 'edit':
    case 'delete':
    case 'move':
      return 'file-change';
    case 'fetch':
      return 'web-search';
    default:
      return 'other';
  }
}

/**
 * A step on the timeline. If `status` is given, it is used (a step still without a terminal state when the turn ends is recorded as `interrupted`, and a rejected one as `declined`).
 * When a file-modifying step succeeds, `output` is a unified diff (architecture design §3.1): generated from ACP's `diff` content block (`oldText` → `newText`), with the file header paths relative to `cwd`; without a `diff` block it falls back to the text content.
 */
export function toolItem(
  snapshot: ToolSnapshot,
  status?: ToolCallStatus,
  cwd: string | null = null,
): Extract<AgentItem, { kind: 'tool-call' }> {
  const raw = record(snapshot.rawInput);
  const out = record(snapshot.rawOutput);
  const command = snapshot.kind === 'execute' ? shellCommand(snapshot) : null;
  const exit = out?.exitCode ?? out?.exit_code;
  const tool = toolCallKind(snapshot.kind);
  const finalStatus = status ?? mapToolStatus(snapshot.status);
  const diff = tool === 'file-change' && finalStatus === 'completed' ? toolDiff(snapshot.content, cwd) : null;
  return {
    kind: 'tool-call',
    id: snapshot.toolCallId,
    tool,
    title: snapshot.title,
    detail: command ?? snapshot.locations?.[0]?.path ?? readString(raw, ['path', 'file_path', 'url', 'query']) ?? null,
    output: diff ?? toolText(snapshot.content) ?? (typeof snapshot.rawOutput === 'string' ? snapshot.rawOutput : null),
    status: finalStatus,
    exitCode: typeof exit === 'number' ? exit : null,
    durationMs: null,
  };
}

/** A plan (`plan`) is written as a checklist text and shown as one agent message. */
export function planText(plan: Plan): string {
  return plan.entries.map((entry) => `${entry.status === 'completed' ? '- [x]' : '- [ ]'} ${entry.content}`).join('\n');
}

export function contentText(block: ContentBlock): string {
  switch (block.type) {
    case 'text':
      return block.text;
    case 'resource_link':
      return block.uri;
    case 'resource':
      return 'text' in block.resource ? block.resource.text : '';
    default:
      return '';
  }
}

/** The `diff` blocks in the content, one unified diff per file, joined together. null when there are none (or none changed). */
function toolDiff(content: ToolCallContent[] | null, cwd: string | null): string | null {
  const parts: string[] = [];
  for (const item of content ?? []) {
    if (item.type !== 'diff') continue;
    const diff = textDiff(diffPath(item.path, cwd), item.oldText ?? null, item.newText);
    if (diff) parts.push(diff);
  }
  return parts.length > 0 ? parts.join('\n') : null;
}

function toolText(content: ToolCallContent[] | null): string | null {
  if (!content) return null;
  const parts: string[] = [];
  for (const item of content) {
    if (item.type === 'content') {
      const text = contentText(item.content);
      if (text) parts.push(text);
    }
  }
  return parts.length > 0 ? parts.join('\n') : null;
}

function shellCommand(snapshot: ToolSnapshot): string | null {
  const raw = record(snapshot.rawInput);
  const command = raw?.command;
  if (Array.isArray(command)) {
    const parts = command.filter((p): p is string => typeof p === 'string');
    if (parts.length > 0) return parts.join(' ');
  }
  if (typeof command === 'string' && command) {
    const args = Array.isArray(raw?.args) ? (raw.args as unknown[]).filter((a): a is string => typeof a === 'string') : [];
    return args.length > 0 ? `${command} ${args.join(' ')}` : command;
  }
  return null;
}

/**
 * One `session/request_permission` → CucCut's approval content, plus the classification key used for "allow for this session": commands by `commandRule` (`ccut <subcommand>` or the first word); file modifications as one category; other tools by kind or title.
 */
export function approvalOf(snapshot: ToolSnapshot, cwd: string): { request: ApprovalRequest; grantKey: string } {
  const raw = record(snapshot.rawInput);
  const files = [
    ...(snapshot.locations ?? []).map((l) => l.path),
    ...['path', 'file_path', 'filePath'].map((k) => raw?.[k]).filter((v): v is string => typeof v === 'string'),
  ].filter((v, i, all) => all.indexOf(v) === i);
  switch (snapshot.kind) {
    case 'execute': {
      const command = shellCommand(snapshot) ?? snapshot.title;
      const rule = commandRule(command);
      return {
        request: { kind: 'command', command, cwd: readString(raw, ['cwd', 'dir_path', 'directory']) ?? cwd, reason: null, rule },
        grantKey: `command:${rule ?? command}`,
      };
    }
    case 'edit':
    case 'delete':
    case 'move':
      // File modifications are allowed according to the access mode, so no rule is stored.
      return { request: { kind: 'file-change', reason: snapshot.title, files, rule: null }, grantKey: 'file-change' };
    default: {
      const title = snapshot.title || snapshot.kind || 'tool';
      // For read, search and fetch-web kinds, the titles often carry parameters ("Fetching https://…"), so rules are recorded by kind to be stable; for others (MCP tools) the title is the tool name.
      const rule = snapshot.kind && STABLE_KINDS.has(snapshot.kind) ? snapshot.kind : title;
      const mcp = mcpToolOf(title);
      return {
        request: { kind: 'tool', tool: mcp?.tool ?? title, reason: summarizeInput(raw), files, server: mcp?.server ?? null, rule },
        grantKey: `tool:${rule}`,
      };
    }
  }
}

const STABLE_KINDS = new Set<ToolKind>(['read', 'search', 'fetch', 'think', 'switch_mode']);

/**
 * An MCP tool recognized from the title: `mcp__<service>__<tool>` (claude-code-acp and others follow Claude Code's naming), or `<tool> (<service> MCP Server)` (Gemini CLI's display name; unverified: inferred from the Gemini CLI 0.46.0 source, not checked against a real turn). null when it is not recognized.
 */
export function mcpToolOf(title: string): { server: string; tool: string } | null {
  const claude = /^mcp__([^_]+(?:_[^_]+)*?)__(.+)$/.exec(title);
  if (claude) return { server: claude[1]!, tool: claude[2]! };
  const gemini = /^(.+) \((.+) MCP Server\)$/.exec(title);
  if (gemini) return { server: gemini[2]!, tool: gemini[1]! };
  return null;
}

/**
 * Whether this approval is one of CucCut's own tools (an MCP service handed to the agent through the tool channel; `servers` are the service names passed when the session was opened).
 * These tools are gated separately in the Runtime by access mode and risk (architecture design §3.12), so on the native side they are allowed directly: this avoids asking twice for the same action, and avoids asking about read-only ones (Claude's Driver likewise allows `mcp__cuccut__*` in canUseTool). Only kind other or unspecified matches: commands and file edits do not count.
 */
export function isOwnMcpTool(snapshot: ToolSnapshot, servers: ReadonlySet<string>): boolean {
  if (servers.size === 0 || (snapshot.kind !== null && snapshot.kind !== 'other')) return false;
  const mcp = mcpToolOf(snapshot.title);
  return mcp !== null && servers.has(mcp.server);
}

function summarizeInput(raw: Record<string, unknown> | null): string | null {
  if (!raw) return null;
  const text = JSON.stringify(raw);
  return text === '{}' ? null : text.length > 300 ? `${text.slice(0, 300)}…` : text;
}

/**
 * Picks the native option from CucCut's reply. Allow always picks "this time only": "this session" is recorded by the Driver itself, and "always allow" rules are stored by the Harness, so the native `allow_always` must not be chosen (it would write into the agent's own persistent settings). When there is no "this time only" option, it is null, and the request is handled as a cancel.
 */
export function selectPermissionOption(options: PermissionOption[], behavior: 'allow' | 'reject'): PermissionOption | null {
  if (behavior === 'allow') return options.find((o) => o.kind === 'allow_once') ?? null;
  return options.find((o) => o.kind === 'reject_once') ?? options.find((o) => o.kind === 'reject_always') ?? null;
}

/** The legacy session model state (`models` in the `session/new` response; Gemini CLI and others still use it; removed from the SDK types). */
export interface LegacyModelState {
  availableModels?: Array<{ modelId: string; name?: string | null; description?: string | null }> | null;
  currentModelId?: string | null;
}

/** The part of the session response related to modes and models. */
export interface AcpSessionState {
  modes?: SessionModeState | null;
  models?: LegacyModelState | null;
  configOptions?: SessionConfigOption[] | null;
}

export function findSelectOption(
  configOptions: SessionConfigOption[] | null | undefined,
  category: string,
): Extract<SessionConfigOption, { type: 'select' }> | null {
  const option = configOptions?.find((o) => o.type === 'select' && o.category === category);
  return (option as Extract<SessionConfigOption, { type: 'select' }> | undefined) ?? null;
}

export function flattenSelectOptions(option: Extract<SessionConfigOption, { type: 'select' }>): SessionConfigSelectOption[] {
  return option.options.flatMap((o) => ('group' in o ? o.options : [o]));
}

/** Model table: prefers the legacy `models`, otherwise takes the config options categorized as model. ACP has no unified term for reasoning effort, so `efforts` is always empty. */
export function deriveModels(state: AcpSessionState): DriverModel[] {
  const legacy = state.models;
  if (legacy?.availableModels?.length) {
    return legacy.availableModels.map((m) =>
      model(m.modelId, m.name ?? m.modelId, m.description ?? null, m.modelId === legacy.currentModelId),
    );
  }
  const option = findSelectOption(state.configOptions, 'model');
  if (!option) return [];
  return flattenSelectOptions(option).map((o) => model(o.value, o.name, o.description ?? null, o.value === option.currentValue));
}

function model(id: string, label: string, description: string | null, isDefault: boolean): DriverModel {
  return { id, label, description, tier: null, isDefault, efforts: [], defaultEffort: null };
}

/** Usable session mode ids: `modes` first, otherwise the config options categorized as mode. */
export function availableModes(state: AcpSessionState): { ids: string[]; via: 'modes' | 'config' | null; configId: string | null } {
  if (state.modes?.availableModes?.length) return { ids: state.modes.availableModes.map((m) => m.id), via: 'modes', configId: null };
  const option = findSelectOption(state.configOptions, 'mode');
  if (option) return { ids: flattenSelectOptions(option).map((o) => o.value), via: 'config', configId: option.id };
  return { ids: [], via: null, configId: null };
}

/** CucCut's MCP services → ACP's `mcpServers` (Streamable HTTP). */
export function acpMcpServers(servers: Record<string, McpServerSpec> | undefined): McpServer[] {
  return Object.entries(servers ?? {}).map(([name, spec]) => ({
    type: 'http' as const,
    name,
    url: spec.url,
    headers: Object.entries(spec.headers).map(([header, value]) => ({ name: header, value })),
  }));
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readString(raw: Record<string, unknown> | null, keys: string[]): string | null {
  for (const key of keys) {
    const value = raw?.[key];
    if (typeof value === 'string' && value) return value;
  }
  return null;
}
