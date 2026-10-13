import { spawn } from 'node:child_process';
import { ffmpegMissingRemedy } from '@cuccut/process-host';
import { JobsFfmpeg } from '@cuccut/protocol/messages/jobs/ffmpeg.ts';
import type { ProbeToolResolver } from '../media-probe.ts';
import { PipelineStepError } from './pipeline.ts';

/**
 * The ffmpeg and ffprobe used for file transcoding (from PATH, or `CUCCUT_FFMPEG` / `CUCCUT_FFPROBE`, same as media analysis).
 * On abort, SIGTERM is sent first, then SIGKILL after a grace period, and the result is reported only after the process has actually exited, so it does not keep writing files in the background.
 */

export type MediaToolResolver = ProbeToolResolver;

/** The facts about one file, as read by ffprobe. */
export interface ProbedMedia {
  durationSec: number;
  formatName: string;
  video: { codec: string; width: number; height: number; pixFmt: string; frameRate: string } | null;
  audio: { codec: string; sampleRate: number; channels: number } | null;
}

const KILL_GRACE_MS = 2000;
const STDERR_TAIL = 4000;

interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

/** Runs one tool; `onStdout` receives stdout chunk by chunk. On abort, kills the process, waits for it to exit, then throws `AbortError`. */
async function runTool(
  tool: { command: string; env?: NodeJS.ProcessEnv },
  args: string[],
  options: { signal?: AbortSignal; onStdout?: (chunk: string) => void; keepStdout?: boolean } = {},
): Promise<RunResult> {
  const { signal } = options;
  signal?.throwIfAborted();
  return await new Promise<RunResult>((resolve, reject) => {
    const child = spawn(tool.command, args, { env: tool.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let killTimer: NodeJS.Timeout | null = null;
    const onAbort = () => {
      child.kill('SIGTERM');
      killTimer = setTimeout(() => child.kill('SIGKILL'), KILL_GRACE_MS);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      if (options.keepStdout !== false) stdout += chunk;
      options.onStdout?.(chunk);
    });
    child.stderr.on('data', (chunk: string) => {
      stderr = (stderr + chunk).slice(-STDERR_TAIL);
    });
    child.on('error', (error: NodeJS.ErrnoException) => {
      signal?.removeEventListener('abort', onAbort);
      if (error.code === 'ENOENT') {
        const remedy = ffmpegMissingRemedy({ ffprobe: true });
        reject(new PipelineStepError('MEDIA_TOOL_UNAVAILABLE', JobsFfmpeg.notFound({ command: tool.command, remedy }), { remedy }));
      } else reject(error);
    });
    child.on('close', (code) => {
      signal?.removeEventListener('abort', onAbort);
      if (killTimer) clearTimeout(killTimer);
      if (signal?.aborted) reject(signal.reason ?? new DOMException('aborted', 'AbortError'));
      else resolve({ code, stdout, stderr });
    });
  });
}

/** The ffmpeg version (the version number on the first line of `ffmpeg -version`). Throws `MEDIA_TOOL_UNAVAILABLE` when not found. */
export async function ffmpegVersion(resolve: MediaToolResolver): Promise<string> {
  const run = await runTool(await resolve(), ['-hide_banner', '-version']);
  const match = /ffmpeg version (\S+)/.exec(run.stdout);
  if (run.code !== 0 || !match) throw new PipelineStepError('MEDIA_TOOL_UNAVAILABLE', JobsFfmpeg.ffmpegBroken());
  return match[1]!;
}

/** Reads one file with ffprobe. Throws `INPUT_UNREADABLE` when it cannot be read. */
export async function probeMedia(resolve: MediaToolResolver, file: string, signal?: AbortSignal): Promise<ProbedMedia> {
  const args = [
    '-v',
    'error',
    '-show_entries',
    'format=duration,format_name:stream=index,codec_type,codec_name,width,height,pix_fmt,r_frame_rate,sample_rate,channels',
    '-of',
    'json',
    `file:${file}`,
  ];
  const run = await runTool(await resolve(), args, signal ? { signal } : {});
  let data: { format?: { duration?: string; format_name?: string }; streams?: Array<Record<string, unknown>> };
  try {
    data = JSON.parse(run.stdout) as typeof data;
  } catch {
    data = {};
  }
  if (run.code !== 0 || !data.format) {
    throw new PipelineStepError('INPUT_UNREADABLE', JobsFfmpeg.probeFailed({ file }), { file, stderr: run.stderr.trim().slice(-500) });
  }
  const streams = data.streams ?? [];
  const v = streams.find((s) => s.codec_type === 'video');
  const a = streams.find((s) => s.codec_type === 'audio');
  const duration = Number(data.format.duration);
  return {
    durationSec: Number.isFinite(duration) ? duration : 0,
    formatName: String(data.format.format_name ?? ''),
    video: v
      ? {
          codec: String(v.codec_name ?? ''),
          width: Number(v.width ?? 0),
          height: Number(v.height ?? 0),
          pixFmt: String(v.pix_fmt ?? ''),
          frameRate: String(v.r_frame_rate ?? ''),
        }
      : null,
    audio: a ? { codec: String(a.codec_name ?? ''), sampleRate: Number(a.sample_rate ?? 0), channels: Number(a.channels ?? 0) } : null,
  };
}

/**
 * Runs one ffmpeg (the arguments already include `-progress pipe:1 -nostats`): reports how far it has written, in seconds, from `out_time_us`.
 * On non-zero exit, throws `TRANSCODE_FAILED` with the tail of stderr.
 */
export async function runFfmpeg(
  resolve: MediaToolResolver,
  args: string[],
  options: { signal: AbortSignal; onTime?: (seconds: number) => void },
): Promise<void> {
  let pending = '';
  const run = await runTool(await resolve(), args, {
    signal: options.signal,
    keepStdout: false,
    onStdout: (chunk) => {
      pending += chunk;
      const lines = pending.split('\n');
      pending = lines.pop() ?? '';
      for (const line of lines) {
        const match = /^out_time_us=(\d+)/.exec(line.trim());
        if (match) options.onTime?.(Number(match[1]) / 1e6);
      }
    },
  });
  if (run.code !== 0) {
    throw new PipelineStepError('TRANSCODE_FAILED', JobsFfmpeg.exited({ code: run.code }), {
      exitCode: run.code,
      stderr: run.stderr.trim().slice(-1000),
    });
  }
}
