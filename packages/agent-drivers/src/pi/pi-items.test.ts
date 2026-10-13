import { describe, expect, it } from 'vitest';
import { fileChangeDiff, PiItemMapper, piToolItem, toolResult } from './pi-items.ts';

/** Parsing of pi tool results: the shapes come from pi 1.0.4's real output, with fallbacks for older field names. */
describe('pi tool entries', () => {
  it('bash: structuredContent takes precedence; when absent, the exit code line is stripped from the text', () => {
    expect(
      toolResult(
        'bash',
        {
          content: [{ type: 'text', text: 'one\n\n\nCommand exited with code 3' }],
          structuredContent: { output: 'one\n', exit_code: 3 },
        },
        true,
      ),
    ).toEqual({ output: 'one\n', exitCode: 3 });
    expect(toolResult('bash', { content: [{ type: 'text', text: 'x\n\n\nCommand exited with code 2' }] }, true)).toEqual({
      output: 'x',
      exitCode: 2,
    });
    expect(toolResult('bash', { content: [{ type: 'text', text: 'ok' }] }, false)).toEqual({ output: 'ok', exitCode: 0 });
    expect(toolResult('bash', { stdout: 'legacy', code: 1 }, true)).toEqual({ output: 'legacy', exitCode: 1 });
    expect(toolResult('read', { content: [{ type: 'text', text: 'a' }, { type: 'image' }] }, false)).toEqual({
      output: 'a\n[图片]',
      exitCode: null,
    });
  });

  it('edit: without details.patch, synthesized from edits or legacy old_string / new_string; absolute paths within the working directory are written as relative paths', () => {
    expect(fileChangeDiff('edit', { path: '/w/src/a.ts', edits: [{ oldText: 'a\nb', newText: 'c' }] }, { content: [] }, '/w')).toBe(
      '--- a/src/a.ts\n+++ b/src/a.ts\n@@ -0,0 +0,0 @@\n-a\n-b\n+c',
    );
    expect(fileChangeDiff('edit', { path: 'a.ts', old_string: 'x', new_string: 'y' }, null, '/w')).toBe(
      '--- a/a.ts\n+++ b/a.ts\n@@ -0,0 +0,0 @@\n-x\n+y',
    );
    expect(fileChangeDiff('write', { path: '/elsewhere/n.txt', content: '' }, null, '/w')).toBe('+++ /elsewhere/n.txt\n@@ -0,0 +1,0 @@');
  });

  it('titles: read, search and similar carry the tool name; unknown tools use the first string argument', () => {
    expect(piToolItem('1', 'grep', { pattern: 'foo', path: 'src' }, null).title).toBe('grep foo · src');
    expect(piToolItem('1', 'ls', {}, null).title).toBe('ls');
    expect(piToolItem('1', 'subagent', { task: 'look around\nmore' }, null)).toMatchObject({
      tool: 'other',
      title: 'subagent look around',
    });
  });

  it('turn ends before the tool finishes: the tool is recorded as interrupted, open text is closed with its existing content', () => {
    const mapper = new PiItemMapper('t', null, () => 0);
    mapper.map({ type: 'message_start', message: { role: 'assistant' } });
    mapper.map({ type: 'message_update', assistantMessageEvent: { type: 'text_delta', contentIndex: 0, delta: 'hal' } });
    mapper.map({ type: 'tool_execution_start', toolCallId: 'c', toolName: 'bash', args: { command: 'sleep 1' } });
    const events = mapper.finish();
    expect(
      events.map((e) =>
        e.type === 'item.completed' ? [e.item.kind, 'status' in e.item ? e.item.status : (e.item as { text: string }).text] : null,
      ),
    ).toEqual([
      ['agent-message', 'hal'],
      ['tool-call', 'interrupted'],
    ]);
  });
});
