import type { ToolCallKind, ToolCallStatus } from '@cuccut/protocol';
import type { AgentEvent, AgentItem } from '@cuccut/harness';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { DriversCommon } from '@cuccut/protocol/messages/agent-drivers';
import { diffBodyLines, diffPath } from '../unified-diff.ts';

/**
 * Maps Claude Agent SDK messages to driver-independent AgentItem / AgentEvent (architecture design §3.1).
 *
 * With `includePartialMessages` enabled, a reply first arrives character by character as `stream_event` (Messages API streaming events).
 * When each content block ends, the CLI sends one `assistant` message carrying the full text of that block (one API message is split into several messages, all with the same `message.id`).
 * The projector merges items by `${turnId}/${itemId}`, so streaming deltas and the completion event that follows must use the same itemId:
 * on `content_block_start`, an id is queued by block kind, and `assistant` messages claim blocks of the same kind in order.
 * Tool calls use the `tool_use` id directly; their result is in the `tool_result` block of a later `user` message, not a user utterance.
 *
 * Frames from sub-agents (non-empty `parent_tool_use_id`) do not enter the timeline: they live inside the single tool call (Task / Agent) of the parent.
 *
 * For file-changing tools (Edit / Write / MultiEdit), on success `output` is a unified diff: their tool_result is only a confirmation sentence.
 * When the SDK's structured result carries a patch, the diff is assembled from it (`structuredPatchLines`, with real line numbers and context); otherwise it is synthesized from the tool input (`fileChangeDiff`).
 * On failure, rejection and interruption, it remains the raw tool_result text.
 */

type Block = { type: string; [key: string]: unknown };
type PartialEvent = Extract<SDKMessage, { type: 'stream_event' }>['event'];

interface OpenTool {
  item: Extract<AgentItem, { kind: 'tool-call' }>;
  name: string;
  input: Record<string, unknown>;
  startedAt: number;
}

/** Mapping state within one turn. A new one is created for each turn. */
export class ClaudeItemMapper {
  readonly #turnId: string;
  readonly #now: () => number;
  /** Working directory of the session: paths in diff file headers are relative to it. */
  readonly #cwd: string | null;
  /** Id of the current streaming message (given by `message_start`). */
  #messageId: string | null = null;
  /** Ids of items started by streaming but not yet claimed by an `assistant` message: messageId → kind → queue of ids. */
  readonly #streamed = new Map<string, { text: string[]; thinking: string[] }>();
  /** Streaming block index → item id, used to look up deltas. */
  readonly #blockIds = new Map<number, { id: string; channel: 'text' | 'reasoning' }>();
  readonly #tools = new Map<string, OpenTool>();
  /** tool_use ids the user has rejected: their tool_result is recorded as declined, not failed. */
  readonly #declined = new Set<string>();
  /** The turn is being interrupted: tool results that error after this point are recorded as interrupted. */
  #interrupting = false;
  #seq = 0;

  constructor(turnId: string, now: () => number = Date.now, cwd: string | null = null) {
    this.#turnId = turnId;
    this.#now = now;
    this.#cwd = cwd;
  }

  declined(toolUseId: string): void {
    this.#declined.add(toolUseId);
  }

  interrupting(): void {
    this.#interrupting = true;
  }

  /** Tool calls that have not yet received a result. */
  openTools(): Array<Extract<AgentItem, { kind: 'tool-call' }>> {
    return [...this.#tools.values()].map((t) => t.item);
  }

  map(message: SDKMessage): AgentEvent[] {
    switch (message.type) {
      case 'stream_event':
        return message.parent_tool_use_id ? [] : this.#onStream(message.event);
      case 'assistant':
        // The “API Error …” message in a failed turn is synthesized by the CLI; the original error text comes with turn.completed, so it is not repeated here as a reply.
        if (message.parent_tool_use_id || message.error) return [];
        return this.#onAssistant(message.message.id, message.message.content as unknown as Block[]);
      case 'user':
        if (message.parent_tool_use_id) return [];
        return this.#onUser(message.message.content as unknown, message.tool_use_result);
      default:
        return [];
    }
  }

  #onStream(event: PartialEvent): AgentEvent[] {
    const e = event as unknown as { type: string; index?: number; message?: { id?: string }; content_block?: Block; delta?: Block };
    switch (e.type) {
      case 'message_start':
        this.#messageId = e.message?.id ?? null;
        this.#blockIds.clear();
        return [];
      case 'content_block_start': {
        const type = e.content_block?.type;
        if ((type !== 'text' && type !== 'thinking') || e.index === undefined) return [];
        const id = this.#nextId();
        this.#queue(this.#messageId ?? '', type).push(id);
        this.#blockIds.set(e.index, { id, channel: type === 'text' ? 'text' : 'reasoning' });
        return [];
      }
      case 'content_block_delta': {
        const block = e.index === undefined ? undefined : this.#blockIds.get(e.index);
        if (!block || !e.delta) return [];
        const delta = e.delta.type === 'text_delta' ? e.delta.text : e.delta.type === 'thinking_delta' ? e.delta.thinking : null;
        if (typeof delta !== 'string' || delta === '') return [];
        return [{ type: 'item.delta', turnId: this.#turnId, itemId: block.id, channel: block.channel, delta }];
      }
      default:
        return [];
    }
  }

  #onAssistant(messageId: string, content: Block[]): AgentEvent[] {
    const events: AgentEvent[] = [];
    for (const block of content) {
      switch (block.type) {
        case 'text': {
          const id = this.#claim(messageId, 'text');
          const text = String(block.text ?? '');
          if (id.streamed || text) events.push(this.#completed({ kind: 'agent-message', id: id.id, text }));
          break;
        }
        case 'thinking': {
          // Thinking content may be omitted (signature only): when streaming produced no text and the full text is empty, do not leave an empty “thinking” entry.
          const id = this.#claim(messageId, 'thinking');
          const text = String(block.thinking ?? '');
          if (id.streamed || text) events.push(this.#completed({ kind: 'reasoning', id: id.id, text }));
          break;
        }
        case 'tool_use': {
          const id = String(block.id ?? this.#nextId());
          const name = String(block.name ?? '');
          const input = (block.input ?? {}) as Record<string, unknown>;
          const item = toolCallItem(id, name, input);
          this.#tools.set(id, { item, name, input, startedAt: this.#now() });
          events.push({ type: 'item.started', turnId: this.#turnId, item });
          break;
        }
        default:
          // redacted_thinking, server tool blocks, etc. do not enter the timeline.
          break;
      }
    }
    return events;
  }

  /** `toolUseResult`: the structured tool output the SDK attaches to this message (only useful when one message answers exactly one tool). */
  #onUser(content: unknown, toolUseResult: unknown): AgentEvent[] {
    if (!Array.isArray(content)) return [];
    const events: AgentEvent[] = [];
    const results = (content as Block[]).filter((block) => block.type === 'tool_result');
    for (const block of results) {
      const toolUseId = String(block.tool_use_id ?? '');
      const open = this.#tools.get(toolUseId);
      if (!open) continue;
      this.#tools.delete(toolUseId);
      const output = toolResultText(block.content);
      const isError = block.is_error === true;
      const status: ToolCallStatus = this.#declined.has(toolUseId)
        ? 'declined'
        : isError
          ? this.#interrupting
            ? 'interrupted'
            : 'failed'
          : 'completed';
      const diff =
        status === 'completed' && open.item.tool === 'file-change'
          ? this.#fileChangeDiff(open, output, results.length === 1 ? toolUseResult : undefined)
          : null;
      events.push(
        this.#completed({
          ...open.item,
          output: diff ?? (output || null),
          status,
          exitCode: open.item.tool === 'command' && (status === 'completed' || status === 'failed') ? bashExitCode(isError, output) : null,
          durationMs: Math.max(0, this.#now() - open.startedAt),
        }),
      );
    }
    return events;
  }

  #fileChangeDiff(open: OpenTool, resultText: string, toolUseResult: unknown): string | null {
    const file = str(open.input.file_path);
    if (!file) return null;
    const shown = diffPath(file, this.#cwd);
    const created = open.name === 'Write' && writeCreated(toolUseResult, resultText);
    const patch = structuredPatchLines(toolUseResult, file);
    if (patch) return [created ? '--- /dev/null' : `--- ${shown.a}`, `+++ ${shown.b}`, ...patch].join('\n');
    if (open.name === 'Edit') return fileChangeDiff(shown, [editHunk(open.input)]);
    if (open.name === 'MultiEdit') {
      const edits = Array.isArray(open.input.edits) ? (open.input.edits as Array<Record<string, unknown> | null>) : [];
      const hunks = edits.map((edit) => editHunk(edit ?? {}));
      return hunks.length ? fileChangeDiff(shown, hunks) : null;
    }
    if (open.name === 'Write') {
      const content = typeof open.input.content === 'string' ? open.input.content : '';
      return fileChangeDiff(shown, [{ removed: [], added: diffBodyLines(content) }], created ? 'created' : 'overwritten');
    }
    return null;
  }

  #completed(item: AgentItem): AgentEvent {
    return { type: 'item.completed', turnId: this.#turnId, item };
  }

  #queue(messageId: string, kind: 'text' | 'thinking'): string[] {
    let entry = this.#streamed.get(messageId);
    if (!entry) {
      entry = { text: [], thinking: [] };
      this.#streamed.set(messageId, entry);
    }
    return entry[kind];
  }

  #claim(messageId: string, kind: 'text' | 'thinking'): { id: string; streamed: boolean } {
    const id = this.#streamed.get(messageId)?.[kind].shift();
    return id ? { id, streamed: true } : { id: this.#nextId(), streamed: false };
  }

  #nextId(): string {
    this.#seq += 1;
    return `claude-${this.#seq}`;
  }
}

/** Tool name → tool kind on the timeline. */
export function claudeToolKind(name: string): ToolCallKind {
  if (name === 'Bash') return 'command';
  if (FILE_TOOLS.has(name)) return 'file-change';
  if (name.startsWith('mcp__')) return 'mcp';
  if (name === 'WebSearch' || name === 'WebFetch') return 'web-search';
  return 'other';
}

/** Built-in file-editing tools: approval is `file-change`; the “auto-accept edits” level is passed through by the native acceptEdits mode. */
export const FILE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

/** `mcp__server__tool` → `{ server, tool }`. Null when it is not an MCP tool. */
export function splitMcpTool(name: string): { server: string; tool: string } | null {
  const match = /^mcp__(.+?)__(.+)$/.exec(name);
  return match ? { server: match[1]!, tool: match[2]! } : null;
}

/** File the tool is going to change. */
export function toolFiles(input: Record<string, unknown>): string[] {
  const file = str(input.file_path) ?? str(input.notebook_path) ?? str(input.path);
  return file ? [file] : [];
}

/** One-line summary of the tool input: shared by the approval card and the timeline title. */
export function summarizeToolInput(name: string, input: Record<string, unknown>): string {
  return inputSummary(name, input) || name;
}

function inputSummary(name: string, input: Record<string, unknown>): string {
  const mcp = splitMcpTool(name);
  if (mcp) return `${mcp.server}.${mcp.tool}`;
  switch (name) {
    case 'Bash':
      return str(input.command) ?? '';
    case 'Read':
    case 'Edit':
    case 'Write':
    case 'MultiEdit':
    case 'NotebookEdit':
      return toolFiles(input)[0] ?? '';
    case 'Grep':
    case 'Glob':
      return [str(input.pattern), str(input.path)].filter(Boolean).join(' · ');
    case 'WebSearch':
      return str(input.query) ?? '';
    case 'WebFetch':
      return str(input.url) ?? '';
    case 'Task':
    case 'Agent':
      return str(input.description) ?? '';
    case 'AskUserQuestion': {
      const first = askedQuestions(input)[0];
      return first ? `${name} ${oneLine(first.question)}` : name;
    }
    default: {
      const first = Object.values(input).find((v): v is string => typeof v === 'string' && v.trim() !== '');
      return first ? `${name} ${oneLine(first)}` : name;
    }
  }
}

function toolCallItem(id: string, name: string, input: Record<string, unknown>): Extract<AgentItem, { kind: 'tool-call' }> {
  const tool = claudeToolKind(name);
  return {
    kind: 'tool-call',
    id,
    tool,
    // Titles for read and search tools include the tool name, so that a bare path does not leave it unclear what was done.
    title: READ_TOOLS.has(name) ? `${name} ${inputSummary(name, input)}`.trim() : summarizeToolInput(name, input),
    detail: toolDetail(name, input),
    output: null,
    status: 'running',
    exitCode: null,
    durationMs: null,
  };
}

const READ_TOOLS = new Set(['Read', 'Grep', 'Glob']);

function toolDetail(name: string, input: Record<string, unknown>): string | null {
  if (name === 'Bash') return str(input.description);
  if (FILE_TOOLS.has(name)) return `${name} ${toolFiles(input)[0] ?? ''}`.trim();
  if (name === 'WebFetch') return str(input.prompt);
  if (name.startsWith('mcp__')) return JSON.stringify(input);
  // Full plan text: a title only fits the first line, and the user needs to read the complete plan on the timeline before deciding whether to approve it.
  if (name === 'ExitPlanMode') return str(input.plan)?.trim() ?? null;
  // The question and options Claude wanted to ask (this tool is rejected, see ASK_USER_QUESTION in claude-session.ts) are kept so the user can see them.
  if (name === 'AskUserQuestion') {
    const lines = askedQuestions(input).flatMap((q) => [q.question, ...q.options.map((o) => `  - ${o}`)]);
    return lines.length ? lines.join('\n') : null;
  }
  return null;
}

/**
 * Input of AskUserQuestion: `{ questions: [{ question, header?, options: [{ label, description? }], multiSelect? }] }`
 * (AskUserQuestionInput in the SDK's sdk-tools.d.ts). An option may also be a string.
 */
function askedQuestions(input: Record<string, unknown>): Array<{ question: string; options: string[] }> {
  if (!Array.isArray(input.questions)) return [];
  return input.questions.flatMap((item) => {
    const q = item as { question?: unknown; options?: unknown } | null;
    const question = str(q?.question);
    if (!question) return [];
    const options = (Array.isArray(q?.options) ? q.options : []).flatMap((option) => {
      if (typeof option === 'string') return option.trim() ? [option.trim()] : [];
      const o = option as { label?: unknown; description?: unknown } | null;
      const label = str(o?.label);
      if (!label) return [];
      const description = str(o?.description);
      return [description ? `${label} — ${description}` : label];
    });
    return [{ question, options }];
  });
}

interface Hunk {
  removed: string[];
  added: string[];
}

/**
 * Patch in the SDK's structured result (`structuredPatch`: per hunk `oldStart` / `oldLines` / `newStart` / `newLines` and prefixed `lines`)
 * → hunk header plus the body lines, with real line numbers and context. Null when it is missing, empty, points to another file, or has the wrong shape; the diff is then synthesized from the tool input instead.
 */
function structuredPatchLines(toolUseResult: unknown, file: string): string[] | null {
  const result = toolUseResult as { filePath?: unknown; structuredPatch?: unknown } | null | undefined;
  if (!result || typeof result !== 'object') return null;
  if (typeof result.filePath === 'string' && result.filePath !== file) return null;
  const hunks = result.structuredPatch;
  if (!Array.isArray(hunks) || hunks.length === 0) return null;
  const out: string[] = [];
  for (const raw of hunks) {
    const hunk = raw as { oldStart?: unknown; oldLines?: unknown; newStart?: unknown; newLines?: unknown; lines?: unknown } | null;
    const numbers = [hunk?.oldStart, hunk?.oldLines, hunk?.newStart, hunk?.newLines];
    if (!numbers.every((n) => typeof n === 'number' && Number.isInteger(n) && n >= 0)) return null;
    const lines = hunk!.lines;
    if (!Array.isArray(lines) || !lines.every((line) => typeof line === 'string' && /^[ +\-\\]/.test(line))) return null;
    out.push(`@@ -${numbers[0]},${numbers[1]} +${numbers[2]},${numbers[3]} @@`, ...(lines as string[]));
  }
  return out;
}

/**
 * Unified diff synthesized from the tool input: `--- a/<path>` and `+++ b/<path>` file headers, one hunk per change.
 * The input has no line numbers: Edit / MultiEdit hunk headers are written as `@@ -0,0 +0,0 @@`, and the context is only the two replaced segments themselves;
 * Write is all added lines, with hunk header `@@ -0,0 +1,N @@`. For a newly created file the old side is `/dev/null`; when overwriting an existing file the old content is unavailable, so only the `+++` header is written.
 */
function fileChangeDiff(file: { a: string; b: string }, hunks: Hunk[], write?: 'created' | 'overwritten'): string {
  const lines: string[] = [];
  if (write === 'created') lines.push('--- /dev/null');
  else if (!write) lines.push(`--- ${file.a}`);
  lines.push(`+++ ${file.b}`);
  for (const hunk of hunks) {
    lines.push(write ? `@@ -0,0 +1,${hunk.added.length} @@` : '@@ -0,0 +0,0 @@');
    for (const line of hunk.removed) lines.push(`-${line}`);
    for (const line of hunk.added) lines.push(`+${line}`);
  }
  return lines.join('\n');
}

function editHunk(edit: Record<string, unknown>): Hunk {
  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  return { removed: diffBodyLines(text(edit.old_string)), added: diffBodyLines(text(edit.new_string)) };
}

/**
 * Whether Write created a new file: first check the SDK's structured result (`type: 'create' | 'update'`); if absent, check the confirmation text
 * (unverified: “File created successfully” is inferred from Claude Code's output habits, not checked against a real turn).
 * If neither is present, treat it as an overwrite: only the `---` header is missing, and the diff still holds.
 */
function writeCreated(toolUseResult: unknown, resultText: string): boolean {
  const type = (toolUseResult as { type?: unknown } | null | undefined)?.type;
  if (type === 'create' || type === 'update') return type === 'create';
  return /^File created successfully/i.test(resultText.trim());
}

/** `tool_result.content`: a string, or an array of text / image blocks. Images are recorded as placeholders. */
function toolResultText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return (content as Block[])
    .map((c) => (c.type === 'text' ? String(c.text ?? '') : c.type === 'image' ? String(DriversCommon.imagePlaceholder()) : ''))
    .filter(Boolean)
    .join('\n');
}

/**
 * Bash exit code. Claude Code's tool_result has no structured exit code: on success record 0; on failure, if the content starts with “Exit code N”, take N
 * (unverified: inferred from Claude Code's output habits, not checked against a real turn).
 */
function bashExitCode(isError: boolean, output: string): number | null {
  if (!isError) return 0;
  const match = /^Exit code (\d+)/.exec(output.trim());
  return match ? Number(match[1]) : null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function oneLine(text: string): string {
  const line = text.trim().split('\n')[0] ?? '';
  return line.length > 80 ? `${line.slice(0, 79)}…` : line;
}
