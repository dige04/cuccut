/*
 * Parts of the mechanism are ported from paseo (Apache-2.0, Copyright (c) 2025-present Mohamed Boudra). Modified:
 * the tool name classification in packages/server/src/server/agent/providers/opencode/tool-call-detail-parser.ts and tool-call-mapper.ts
 * (shell / bash, edit / write / patch, websearch / webfetch; edit's path / filePath, oldString / newString),
 * the permission rule format in v2/configuration.ts (`{ action, resource, effect }`), and the permission request shape in v2/permissions.ts.
 * Changed to CucCut's AgentItem / ApprovalRequest. File-edit output uses the unified diff that OpenCode provides in its metadata directly.
 * The mapping from access mode to permission rules, and the classification key for "allow for this session", are newly added.
 */
import path from 'node:path';
import { normalizeAgentMode, type AgentMode, type ApprovalRequest, type ToolCallKind, type ToolCallStatus } from '@cuccut/protocol';
import { DriversOpencode } from '@cuccut/protocol/messages/agent-drivers';
import type { AgentItem } from '@cuccut/harness';
import { commandRule } from '../approval-rule.ts';

/** One native permission rule. Later rules override earlier ones (session rules come after the agent's built-in rules). */
export interface PermissionRule {
  action: string;
  resource: string;
  effect: 'allow' | 'deny' | 'ask';
}

/**
 * Access mode → session permission rules (take the stricter of the two sides, architecture design §3.12). Actions asked about natively are answered by the Harness per risk and mode
 * (`decideApproval`), so except for fullAccess, everything that can be intercepted is set to `ask`:
 *
 * | CucCut mode | edit (including write, patch) | shell | external_directory |
 * | --- | --- | --- | --- |
 * | plan | deny | ask | ask |
 * | ask / autoAcceptEdits / auto | ask | ask | ask |
 * | fullAccess | allow | allow | allow |
 *
 * Every tier denies `question` (a form sent to the user): CucCut has no channel for answering forms, so the turn would wait forever.
 * CucCut's own MCP tools get no rule: OpenCode's build agent allows them by default (`* * allow`), and their write operations are guarded by the Runtime.
 * Reading files, searching, and fetching web pages are also allowed by default per the build agent (reading `.env` still asks).
 */
export function permissionRules(mode: AgentMode): PermissionRule[] {
  const normalized = normalizeAgentMode(mode);
  const rule = (action: string, effect: PermissionRule['effect']): PermissionRule => ({ action, resource: '*', effect });
  const question = rule('question', 'deny');
  switch (normalized) {
    case 'plan':
      return [rule('edit', 'deny'), rule('shell', 'ask'), rule('external_directory', 'ask'), question];
    case 'fullAccess':
      return [rule('edit', 'allow'), rule('shell', 'allow'), rule('external_directory', 'allow'), question];
    default:
      return [rule('edit', 'ask'), rule('shell', 'ask'), rule('external_directory', 'ask'), question];
  }
}

/** A permission request (the data of `permission.asked`, or an item from `GET /api/session/{id}/permission`). */
export interface PermissionRequest {
  id: string;
  sessionID: string;
  action: string;
  resources?: string[];
  metadata?: Record<string, unknown>;
  source?: { type?: string; messageID?: string; id?: string };
  message?: string;
}

/**
 * Permission request → CucCut approval content, plus the classification key used for "allow for this session" and whether it is out-of-bounds:
 * `shell` is a command (rules are matched by `commandRule`); `edit` is a file edit (files use paths relative to the working directory, which the Harness uses to decide whether they are inside the directory);
 * `external_directory` (touching anything outside the working directory) counts as out-of-bounds, and the Harness records it as `high`; others are classified by tool.
 */
export function approvalOf(request: PermissionRequest, cwd: string): { request: ApprovalRequest; grantKey: string; escalation: boolean } {
  const resources = (request.resources ?? []).filter((r): r is string => typeof r === 'string');
  const reason = request.message ?? null;
  switch (request.action) {
    case 'shell':
    case 'bash': {
      const command = resources.join('\n') || 'shell';
      const rule = commandRule(command);
      return { request: { kind: 'command', command, cwd, reason, rule }, grantKey: `command:${rule ?? command}`, escalation: false };
    }
    case 'edit': {
      const files = metadataFiles(request.metadata).map((f) => f.file);
      return {
        request: { kind: 'file-change', reason, files: files.length > 0 ? files : resources, rule: null },
        grantKey: 'file-change',
        escalation: false,
      };
    }
    case 'external_directory':
      return {
        request: {
          kind: 'tool',
          tool: 'external_directory',
          reason: reason ?? String(DriversOpencode.externalDirectory()),
          files: resources,
          server: null,
          rule: null,
        },
        grantKey: `external:${resources.join('\n')}`,
        escalation: true,
      };
    default:
      return {
        request: { kind: 'tool', tool: request.action, reason, files: resources, server: null, rule: request.action },
        grantKey: `tool:${request.action}`,
        escalation: false,
      };
  }
}

/** Changes that OpenCode attaches to an edit permission request and to tool results: `{ file, patch, status }`, where patch is a unified diff. */
export function metadataFiles(metadata: unknown): Array<{ file: string; patch: string | null; status: string | null }> {
  const files = record(metadata)?.files;
  if (!Array.isArray(files)) return [];
  return files.flatMap((f) => {
    const entry = record(f);
    if (typeof entry?.file !== 'string') return [];
    return [
      {
        file: entry.file,
        patch: typeof entry.patch === 'string' ? entry.patch : null,
        status: typeof entry.status === 'string' ? entry.status : null,
      },
    ];
  });
}

/** One tool call's state so far (merged from `session.tool.*` events). */
export interface ToolState {
  id: string;
  name: string;
  input: Record<string, unknown> | null;
  status: ToolCallStatus;
  content: string | null;
  metadata: Record<string, unknown> | null;
  error: string | null;
  startedAt: number;
  endedAt: number | null;
}

const COMMAND_TOOLS = new Set(['shell', 'bash']);
const FILE_TOOLS = new Set(['edit', 'write', 'patch', 'apply_patch', 'multiedit']);
const WEB_TOOLS = new Set(['websearch', 'web_search', 'webfetch']);

/** Tool name → step kind. MCP tools are named `<service name>_<tool name>` in OpenCode. */
export function toolKind(name: string, mcpServers: Iterable<string>): ToolCallKind {
  if (COMMAND_TOOLS.has(name)) return 'command';
  if (FILE_TOOLS.has(name)) return 'file-change';
  if (WEB_TOOLS.has(name)) return 'web-search';
  for (const server of mcpServers) if (name.startsWith(`${server}_`)) return 'mcp';
  return 'other';
}

/** One step on the timeline. For file edits, `output` is a unified diff: OpenCode's is used when provided; otherwise one is built from oldString / newString. */
export function toolItem(state: ToolState, cwd: string, mcpServers: Iterable<string>): Extract<AgentItem, { kind: 'tool-call' }> {
  const kind = toolKind(state.name, mcpServers);
  const input = state.input;
  const file = readString(input, ['path', 'filePath', 'file_path']);
  const shown = file ? relativeTo(cwd, file) : null;
  let title = state.name;
  let detail: string | null = null;
  let output = state.error ?? state.content;
  switch (kind) {
    case 'command': {
      const command = readString(input, ['command']);
      if (command) title = command;
      const workdir = readString(input, ['workdir', 'cwd']);
      detail = workdir ? `cwd: ${workdir}` : null;
      break;
    }
    case 'file-change': {
      const files = metadataFiles(state.metadata);
      title = files.length > 0 ? files.map((f) => f.file).join(', ') : (shown ?? state.name);
      detail = files.length > 0 ? files.map((f) => `${f.status ?? 'modified'} ${f.file}`).join('\n') : shown;
      const diff =
        files
          .map((f) => f.patch)
          .filter((p): p is string => !!p)
          .join('\n') || editDiff(shown, input);
      if (diff) output = state.error ? `${state.error}\n${diff}` : diff;
      break;
    }
    case 'web-search':
      title = readString(input, ['query', 'url']) ?? state.name;
      break;
    case 'mcp':
      title = state.name;
      detail = input && Object.keys(input).length > 0 ? JSON.stringify(input) : null;
      break;
    default: {
      const hint = shown ?? readString(input, ['pattern', 'query', 'description']);
      title = hint ? `${state.name} ${hint}` : state.name;
      break;
    }
  }
  const meta = state.metadata;
  const exit = meta?.exit ?? meta?.exitCode;
  return {
    kind: 'tool-call',
    id: state.id,
    tool: kind,
    title,
    detail,
    output: output || null,
    status: state.status,
    exitCode: typeof exit === 'number' ? exit : null,
    durationMs: state.endedAt !== null ? state.endedAt - state.startedAt : null,
  };
}

/** Writes an edit's oldString → newString as a unified diff (fallback when OpenCode gives no metadata). */
export function editDiff(file: string | null, input: Record<string, unknown> | null): string | null {
  const before = readString(input, ['oldString', 'old_string']);
  const after = readString(input, ['newString', 'new_string']);
  if (before === null && after === null) {
    const content = readString(input, ['content']);
    if (content === null || !file) return null;
    const lines = content.replace(/\n$/, '').split('\n');
    return [`--- /dev/null`, `+++ ${file}`, `@@ -0,0 +1,${lines.length} @@`, ...lines.map((l) => `+${l}`)].join('\n') + '\n';
  }
  const oldLines = (before ?? '').split('\n');
  const newLines = (after ?? '').split('\n');
  const name = file ?? 'file';
  return (
    [
      `--- ${name}`,
      `+++ ${name}`,
      `@@ -1,${oldLines.length} +1,${newLines.length} @@`,
      ...oldLines.map((l) => `-${l}`),
      ...newLines.map((l) => `+${l}`),
    ].join('\n') + '\n'
  );
}

/** Flattens a tool result's content (`[{ type: 'text', text }, { type: 'file', uri }]`) into text. */
export function contentText(content: unknown): string | null {
  if (!Array.isArray(content)) return null;
  const parts = content.flatMap((c) => {
    const entry = record(c);
    if (entry?.type === 'text' && typeof entry.text === 'string') return [entry.text];
    if (entry?.type === 'file' && typeof entry.uri === 'string') return [typeof entry.name === 'string' ? entry.name : entry.uri];
    return [];
  });
  return parts.length > 0 ? parts.join('\n') : null;
}

function relativeTo(cwd: string, file: string): string {
  if (!path.isAbsolute(file)) return file;
  const relative = path.relative(cwd, file);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? relative : file;
}

export function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readString(raw: Record<string, unknown> | null, keys: string[]): string | null {
  for (const key of keys) {
    const value = raw?.[key];
    if (typeof value === 'string') return value;
  }
  return null;
}
