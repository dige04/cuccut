import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { YtDlpTool } from '../pipelines/yt-dlp.ts';

/** Absolute path of the fake yt-dlp script (`fake-yt-dlp.ts`). */
export const FAKE_YT_DLP = fileURLToPath(new URL('./fake-yt-dlp.ts', import.meta.url));

export interface FakeYtDlp {
  /** The executable wrapper (`<dir>/yt-dlp`). */
  command: string;
  /** Runs directly with the current Node, for cross-platform process tests (Windows cannot launch the sh wrapper directly). */
  nodeTool: YtDlpTool;
  /** Appends one `{ argv }` line on each call. */
  log: string;
  /** Reads back the recorded calls. */
  calls(): Promise<Array<{ argv?: string[]; resumedFrom?: number }>>;
}

/**
 * Writes an executable wrapper named `yt-dlp` in `dir`: it runs the fake script with the current Node, with logs written in `dir`.
 * The wrapper uses absolute paths and does not depend on PATH, so tests can set PATH to only this directory (or an empty directory), and a real yt-dlp on the system will not be used.
 */
export async function writeFakeYtDlp(dir: string, options: { version?: string; name?: string } = {}): Promise<FakeYtDlp> {
  await fs.mkdir(dir, { recursive: true });
  const command = path.join(dir, options.name ?? 'yt-dlp');
  const log = path.join(dir, 'argv.log');
  const quote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
  const lines = [
    '#!/bin/sh',
    `export FAKE_YTDLP_LOG=${quote(log)}`,
    ...(options.version ? [`export FAKE_YTDLP_VERSION=${quote(options.version)}`] : []),
    `exec ${quote(process.execPath)} ${quote(FAKE_YT_DLP)} "$@"`,
    '',
  ];
  await fs.writeFile(command, lines.join('\n'), { mode: 0o755 });
  return {
    command,
    nodeTool: {
      command: process.execPath,
      args: [FAKE_YT_DLP],
      env: { FAKE_YTDLP_LOG: log, ...(options.version ? { FAKE_YTDLP_VERSION: options.version } : {}) },
    },
    log,
    async calls() {
      const text = await fs.readFile(log, 'utf8').catch(() => '');
      return text
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as { argv?: string[]; resumedFrom?: number });
    },
  };
}
