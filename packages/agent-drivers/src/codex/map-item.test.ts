import { describe, expect, it } from 'vitest';
import { mapCodexItem, unwrapShell } from './map-item.ts';

describe('unwrapShell', () => {
  it('strips the login shell wrapper', () => {
    expect(unwrapShell(`/bin/zsh -lc 'ls -la'`)).toBe('ls -la');
    expect(unwrapShell(`/bin/bash -lc 'echo '\\''hi'\\'''`)).toBe(`echo 'hi'`);
    expect(unwrapShell(`/bin/zsh -lc "echo \\"x\\""`)).toBe('echo "x"');
  });

  it('a command that is not wrapped as a whole is returned as is', () => {
    expect(unwrapShell('ls -la')).toBe('ls -la');
    expect(unwrapShell(`bash -c 'a' && 'b'`)).toBe(`bash -c 'a' && 'b'`);
  });
});

describe('mapCodexItem', () => {
  it('command title is the inner command; details keep the original text and directory', () => {
    const item = mapCodexItem({
      type: 'commandExecution',
      id: 'i1',
      command: `/bin/zsh -lc 'cat README.md'`,
      cwd: '/tmp/demo',
      status: 'completed',
      aggregatedOutput: '# Demo',
      exitCode: 0,
      durationMs: 12,
    } as never);
    expect(item).toMatchObject({
      kind: 'tool-call',
      tool: 'command',
      title: 'cat README.md',
      detail: `/bin/zsh -lc 'cat README.md'\ncwd: /tmp/demo`,
      status: 'completed',
      exitCode: 0,
    });
  });
});
