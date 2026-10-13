import type { ToolCallStatus } from '@cuccut/protocol';
import type { AgentItem } from '@cuccut/harness';
import type { CodexThreadItem } from './codex-protocol.ts';

/** Codex's ThreadItem → driver-independent AgentItem. Pure function. */
export function mapCodexItem(raw: CodexThreadItem): AgentItem {
  const item = raw as CodexThreadItem & Record<string, unknown>;
  switch (item.type) {
    case 'agentMessage':
    case 'plan':
      return { kind: 'agent-message', id: item.id, text: String(item.text ?? '') };
    case 'reasoning':
      return { kind: 'reasoning', id: item.id, text: ((item.summary as string[]) ?? []).join('\n\n') };
    case 'userMessage': {
      const content = (item.content as Array<{ type: string; text?: string }>) ?? [];
      return {
        kind: 'user-message',
        id: item.id,
        text: content.map((c) => (c.type === 'text' ? (c.text ?? '') : '')).join(''),
      };
    }
    case 'commandExecution': {
      const command = String(item.command ?? '');
      const title = unwrapShell(command);
      const cwd = (item.cwd as string | null) ?? null;
      return {
        kind: 'tool-call',
        id: item.id,
        tool: 'command',
        title,
        detail: [title !== command ? command : null, cwd ? `cwd: ${cwd}` : null].filter(Boolean).join('\n') || null,
        output: (item.aggregatedOutput as string | null) ?? null,
        status: mapStatus(item.status as string),
        exitCode: (item.exitCode as number | null) ?? null,
        durationMs: (item.durationMs as number | null) ?? null,
      };
    }
    case 'fileChange': {
      const changes = (item.changes as Array<{ path: string; kind: { type: string }; diff: string }>) ?? [];
      return {
        kind: 'tool-call',
        id: item.id,
        tool: 'file-change',
        title: changes.map((c) => c.path).join(', '),
        detail: changes.map((c) => `${c.kind.type} ${c.path}`).join('\n') || null,
        output: changes.map((c) => c.diff).join('\n') || null,
        status: mapStatus(item.status as string),
        exitCode: null,
        durationMs: null,
      };
    }
    case 'mcpToolCall': {
      const error = item.error as { message: string } | null;
      const result = item.result as { content: unknown[] } | null;
      return {
        kind: 'tool-call',
        id: item.id,
        tool: 'mcp',
        title: `${String(item.server)}.${String(item.tool)}`,
        detail: item.arguments === undefined ? null : JSON.stringify(item.arguments),
        output: error ? error.message : result ? JSON.stringify(result.content) : null,
        status: mapStatus(item.status as string),
        exitCode: null,
        durationMs: (item.durationMs as number | null) ?? null,
      };
    }
    case 'dynamicToolCall':
      return {
        kind: 'tool-call',
        id: item.id,
        tool: 'other',
        title: String(item.tool ?? ''),
        detail: null,
        output: null,
        status: mapStatus(item.status as string),
        exitCode: null,
        durationMs: (item.durationMs as number | null) ?? null,
      };
    case 'webSearch':
      return {
        kind: 'tool-call',
        id: item.id,
        tool: 'web-search',
        title: String(item.query ?? ''),
        detail: null,
        output: null,
        status: 'completed',
        exitCode: null,
        durationMs: null,
      };
    default:
      return { kind: 'other', id: item.id, label: item.type };
  }
}

/**
 * Codex wraps commands in a login shell (`/bin/zsh -lc 'ls -la'`). The title shows only the command inside; the full command goes in the details.
 * The approval card does not go through here: the user approves the original text of what Codex will actually run.
 */
export function unwrapShell(command: string): string {
  const match = /^(?:\/(?:usr\/)?bin\/)?(?:ba|z)?sh\s+-l?c\s+([\s\S]+)$/.exec(command.trim());
  if (!match) return command;
  const body = match[1]!;
  if (/^'[\s\S]*'$/.test(body)) {
    const inner = body.slice(1, -1);
    // Inside single quotes only the '\'' escape is allowed; any other single quote means it is not one whole string, so it is returned unchanged.
    return inner.replaceAll(`'\\''`, '').includes(`'`) ? command : inner.replaceAll(`'\\''`, `'`);
  }
  if (/^"[\s\S]*"$/.test(body)) return body.slice(1, -1).replace(/\\(["\\$`])/g, '$1');
  return body;
}

function mapStatus(status: string): ToolCallStatus {
  switch (status) {
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'declined':
      return 'declined';
    default:
      return 'running';
  }
}
