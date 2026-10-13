import { describe, expect, it } from 'vitest';
import { cleanOutputLine, runShellCommand } from './shell-command.ts';

/** Runs small commands with `/bin/sh`: does not touch brew, npm, or the network. */

function collect(command: string, extra: { killGraceMs?: number } = {}) {
  const lines: string[] = [];
  const run = runShellCommand({ command, onLines: (batch) => lines.push(...batch), env: { PATH: process.env.PATH }, ...extra });
  return { run, lines };
}

describe('runShellCommand', () => {
  it('merges stdout and stderr, emits by line, returns the exit code', async () => {
    const { run, lines } = collect(`printf 'a\\nb\\n'; printf 'err\\n' >&2; printf 'tail'; exit 3`);
    expect(await run.exited).toEqual({ code: 3, signal: null, cancelled: false, error: null });
    expect([...lines].sort()).toEqual(['a', 'b', 'err', 'tail']);
  });

  it('stdin is closed: reading input immediately gets EOF', async () => {
    const { run, lines } = collect(`if read line; then echo got; else echo eof; fi`);
    expect((await run.exited).code).toBe(0);
    expect(lines).toEqual(['eof']);
  });

  it('no controlling terminal: opening /dev/tty fails (password-prompting commands like sudo fail outright)', async () => {
    const { run, lines } = collect(`if (exec </dev/tty) 2>/dev/null; then echo tty; else echo no-tty; fi`);
    await run.exited;
    expect(lines).toEqual(['no-tty']);
  });

  it('cancel ends the whole process group', async () => {
    const { run, lines } = collect(`echo start; sleep 30 & wait`, { killGraceMs: 500 });
    for (let i = 0; i < 100 && lines.length === 0; i++) await new Promise((resolve) => setTimeout(resolve, 20));
    expect(lines).toEqual(['start']);
    const started = Date.now();
    run.cancel();
    const exit = await run.exited;
    expect(exit.cancelled).toBe(true);
    expect(exit.code === null || exit.code !== 0).toBe(true);
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it('UTF-8 across chunks and \\r progress bars', async () => {
    const { run, lines } = collect(`printf '下载 10%%\\r下载 100%%\\r\\n完成\\n'`);
    await run.exited;
    expect(lines).toEqual(['下载 100%', '完成']);
  });
});

describe('cleanOutputLine', () => {
  it('strips color and cursor control, \\r keeps only the last segment', () => {
    expect(cleanOutputLine('\x1b[1;32m==>\x1b[0m Pouring codex')).toBe('==> Pouring codex');
    expect(cleanOutputLine('10%\r50%\r100%')).toBe('100%');
    expect(cleanOutputLine('done\r')).toBe('done');
    expect(cleanOutputLine('\x1b]0;title\x07ok')).toBe('ok');
    expect(cleanOutputLine('x'.repeat(10), 4)).toBe('xxxx…');
  });
});
