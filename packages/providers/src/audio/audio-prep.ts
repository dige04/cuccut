import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ProviderFailure } from '@cuccut/models';
import { ProviderAborted } from '../http/provider-fetch.ts';
import { parseSilences, type Silence } from './chunk-plan.ts';
import { ProvidersHttp as PH } from '@cuccut/protocol/messages/providers';

/**
 * Audio preparation for online providers (architecture design §6.4): ffmpeg decodes one audio track of the asset into a mono 16 kHz WAV (the master, in staging). Silence is found on the master, and then each chunk is encoded into a format the provider accepts, according to the chunk plan. The asset file is read only by ffmpeg, streamed, and never read entirely into memory.
 *
 * The security rules are the same as the Model Worker's decoding (`crates/model-runtime/src/audio.rs`): no shell, only local files may be read, and only demuxers on the allowlist are used. ffmpeg's output contains paths, and the error messages do not include them.
 */

/** The same demuxer allowlist as the Model Worker. The asset's media type is not necessarily saved with the task, so one list is used for everything. */
export const DEMUXER_ALLOWLIST = 'mov,mp4,m4a,3gp,3g2,mj2,matroska,webm,aac,mp3,wav,flac,ogg';
export const SAMPLE_RATE = 16_000;
/** The master: 16-bit mono, bytes per second. */
export const MASTER_BYTES_PER_SEC = SAMPLE_RATE * 2;

export interface FfmpegTool {
  command: string;
  env: NodeJS.ProcessEnv;
}
export type FfmpegResolver = () => Promise<FfmpegTool>;

/** Chunk encoding. `bytesPerSec` is the most bytes per second this encoding can produce (used to compute the chunk cap). `overheadBytes` is the container's fixed overhead. */
export type ChunkFormat = 'wav' | 'flac' | 'm4a';
export const CHUNK_FORMATS: Record<
  ChunkFormat,
  { extension: string; mimeType: string; bytesPerSec: number; overheadBytes: number; args: readonly string[] }
> = {
  wav: {
    extension: 'wav',
    mimeType: 'audio/wav',
    bytesPerSec: MASTER_BYTES_PER_SEC,
    overheadBytes: 1024,
    args: ['-c:a', 'pcm_s16le', '-f', 'wav'],
  },
  // FLAC is not much larger than raw PCM. It is computed as PCM, with a margin.
  flac: {
    extension: 'flac',
    mimeType: 'audio/flac',
    bytesPerSec: MASTER_BYTES_PER_SEC,
    overheadBytes: 8192,
    args: ['-c:a', 'flac', '-f', 'flac'],
  },
  // AAC 64 kbit/s is about 8000 bytes per second, computed here as 9000.
  m4a: {
    extension: 'm4a',
    mimeType: 'audio/mp4',
    bytesPerSec: 9000,
    overheadBytes: 64 * 1024,
    args: ['-c:a', 'aac', '-b:a', '64k', '-f', 'mp4', '-movflags', '+faststart'],
  },
};

const STDERR_LIMIT = 1024 * 1024;
const EXTRACT_TIMEOUT_MS = 60 * 60_000;
const SILENCE_TIMEOUT_MS = 30 * 60_000;
const ENCODE_TIMEOUT_MS = 10 * 60_000;
/** If the decoded audio is shorter than the requested range by this many seconds or more, report `range-clamped` (same as the Model Worker). */
export const RANGE_CLAMP_TOLERANCE_SEC = 0.05;

export interface ExtractRequest {
  ffmpeg: FfmpegResolver;
  /** Asset file (absolute path). */
  file: string;
  /** Which audio track (`0:a:<track>`). */
  track: number;
  /** Decode only this segment (seconds). When `durationSec` is null, decode to the end. */
  range?: { startSec: number; durationSec: number | null };
  /** The master is written here. */
  out: string;
  signal: AbortSignal;
}

/** Decodes the master. Returns `no-audio-track` if the asset has no such track. */
export async function extractAudio(request: ExtractRequest): Promise<{ durationSec: number } | 'no-audio-track'> {
  const before: string[] = [];
  if (request.range && request.range.startSec > 0) before.push('-ss', request.range.startSec.toFixed(6));
  if (request.range && request.range.durationSec !== null) before.push('-t', request.range.durationSec.toFixed(6));
  await fs.mkdir(path.dirname(request.out), { recursive: true });
  const args = [
    ...COMMON_ARGS,
    '-v',
    'error',
    '-format_whitelist',
    DEMUXER_ALLOWLIST,
    ...before,
    '-i',
    `file:${request.file}`,
    '-map',
    `0:a:${request.track}`,
    '-vn',
    '-sn',
    '-dn',
    '-ac',
    '1',
    '-ar',
    String(SAMPLE_RATE),
    '-c:a',
    'pcm_s16le',
    '-f',
    'wav',
    '-y',
    `file:${request.out}`,
  ];
  const run = await runFfmpeg(request.ffmpeg, args, request.signal, EXTRACT_TIMEOUT_MS);
  if (run.code !== 0) {
    if (run.stderr.includes('matches no streams')) return 'no-audio-track';
    throw new ProviderFailure('input-unreadable', PH.audioUnreadable().text);
  }
  return { durationSec: await wavDurationSec(request.out) };
}

/** Finds silence on the master (`silencedetect`). It is only used to find cut points for chunking. On failure it returns an empty table (falls back to hard cuts). */
export async function detectSilences(request: {
  ffmpeg: FfmpegResolver;
  master: string;
  durationSec: number;
  signal: AbortSignal;
  noiseDb?: number;
  minSilenceSec?: number;
}): Promise<Silence[]> {
  const filter = `silencedetect=noise=${request.noiseDb ?? -35}dB:d=${request.minSilenceSec ?? 0.4}`;
  const args = [
    ...COMMON_ARGS,
    '-nostats',
    '-v',
    'info',
    '-format_whitelist',
    'wav',
    '-i',
    `file:${request.master}`,
    '-af',
    filter,
    '-f',
    'null',
    '-',
  ];
  const run = await runFfmpeg(request.ffmpeg, args, request.signal, SILENCE_TIMEOUT_MS);
  if (run.code !== 0) return [];
  return parseSilences(run.stderr, request.durationSec);
}

/** Cuts [start, end) out of the master and encodes it as one chunk. */
export async function encodeChunk(request: {
  ffmpeg: FfmpegResolver;
  master: string;
  startSec: number;
  endSec: number;
  format: ChunkFormat;
  out: string;
  signal: AbortSignal;
}): Promise<{ path: string; byteLength: number }> {
  const format = CHUNK_FORMATS[request.format];
  const args = [
    ...COMMON_ARGS,
    '-v',
    'error',
    '-format_whitelist',
    'wav',
    '-ss',
    request.startSec.toFixed(6),
    '-t',
    Math.max(0.001, request.endSec - request.startSec).toFixed(6),
    '-i',
    `file:${request.master}`,
    '-map_metadata',
    '-1',
    ...format.args,
    '-y',
    `file:${request.out}`,
  ];
  const run = await runFfmpeg(request.ffmpeg, args, request.signal, ENCODE_TIMEOUT_MS);
  if (run.code !== 0) throw new ProviderFailure('crashed', PH.chunkEncodeFailed().text);
  const stat = await fs.stat(request.out);
  return { path: request.out, byteLength: stat.size };
}

/** Reads the `fmt ` and `data` blocks of the WAV to compute the duration. ffmpeg may put a `LIST` block in front, so the header cannot be assumed to be 44 bytes. */
export async function wavDurationSec(file: string): Promise<number> {
  const handle = await fs.open(file, 'r');
  try {
    const stat = await handle.stat();
    const head = Buffer.alloc(Math.min(64 * 1024, stat.size));
    await handle.read(head, 0, head.length, 0);
    if (head.length < 12 || head.toString('ascii', 0, 4) !== 'RIFF' || head.toString('ascii', 8, 12) !== 'WAVE') {
      throw new ProviderFailure('crashed', PH.notWav().text);
    }
    let byteRate = 0;
    let offset = 12;
    while (offset + 8 <= head.length) {
      const id = head.toString('ascii', offset, offset + 4);
      const size = head.readUInt32LE(offset + 4);
      const body = offset + 8;
      if (id === 'fmt ' && body + 12 <= head.length) byteRate = head.readUInt32LE(body + 8);
      if (id === 'data') {
        if (byteRate <= 0) break;
        // In a streamed WAV that cannot write its length, the data length is 0 or 0xFFFFFFFF. Compute it from the file's actual size.
        const bytes = size === 0 || size === 0xffffffff || body + size > stat.size ? stat.size - body : size;
        return bytes / byteRate;
      }
      offset = body + size + (size % 2);
    }
    throw new ProviderFailure('crashed', PH.wavMissingChunks().text);
  } finally {
    await handle.close();
  }
}

const COMMON_ARGS = ['-nostdin', '-hide_banner', '-protocol_whitelist', 'file'] as const;

/** Runs one ffmpeg: no shell. When `signal` aborts, it ends the process and throws `ProviderAborted`. */
function runFfmpeg(
  resolve: FfmpegResolver,
  args: string[],
  signal: AbortSignal,
  timeoutMs: number,
): Promise<{ code: number | null; stderr: string }> {
  if (signal.aborted) return Promise.reject(new ProviderAborted());
  return resolve().then(
    ({ command, env }) =>
      new Promise((done, reject) => {
        const child = spawn(command, args, { env, stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        let settled = false;
        let timedOut = false;
        const finish = (fn: () => void) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal.removeEventListener('abort', onAbort);
          fn();
        };
        const onAbort = () => {
          child.kill('SIGKILL');
          finish(() => reject(new ProviderAborted()));
        };
        const timer = setTimeout(() => {
          timedOut = true;
          child.kill('SIGKILL');
        }, timeoutMs);
        signal.addEventListener('abort', onAbort, { once: true });
        child.stderr.on('data', (chunk: Buffer) => {
          if (stderr.length < STDERR_LIMIT) stderr += chunk.toString('utf8');
        });
        child.on('error', (error: NodeJS.ErrnoException) =>
          finish(() =>
            reject(
              error.code === 'ENOENT'
                ? new ProviderFailure('unavailable', PH.ffmpegMissing().text)
                : new ProviderFailure('unavailable', PH.ffmpegRunFailed({ error: error.message }).text),
            ),
          ),
        );
        child.on('close', (code) =>
          finish(() => (timedOut ? reject(new ProviderFailure('crashed', PH.ffmpegTimeout().text)) : done({ code, stderr }))),
        );
      }),
  );
}
