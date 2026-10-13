import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MANIFEST_FILE, ModelCatalog, ProviderFailure, type BundleDefinition } from '@cuccut/models';
import { FAKE_MODEL_WORKER } from './index.ts';
import { LocalTranscribeProvider } from './local-provider.ts';
import { localDubSeparator } from './pipelines/dub-separator.ts';
import { stemProblems } from './pipelines/dub.ts';
import { probeMedia } from './pipelines/ffmpeg.ts';
import { PipelineStepError } from './pipelines/pipeline.ts';

/**
 * Local vocal separation (architecture design §6.1 `separateAudio`, Model Worker protocol spec §2.5.4): the local Provider's `separate()` runs in a fake
 * Model Worker. The dub separation executor (`localDubSeparator`) pads the output to the container duration. The model package is a test candle package.
 */

const BUNDLE = 'sep@cpu';
const BUNDLES: BundleDefinition[] = [
  {
    bundleId: BUNDLE,
    capability: 'separate',
    backend: 'candle',
    device: 'cpu',
    label: 'Separator',
    components: { separator: { family: 'htdemucs-ft', repo: 'test/sep', revision: 'r-sep' } },
  },
];

const hasFfmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();
const ffmpeg = async () => ({ command: 'ffmpeg' });
const ffprobe = async () => ({ command: 'ffprobe' });

async function writeRepo(root: string, repo: string, revision: string): Promise<void> {
  const dir = path.join(root, ...repo.split('/'));
  await fs.mkdir(dir, { recursive: true });
  const content = `weights of ${repo}`;
  await fs.writeFile(path.join(dir, 'model.safetensors'), content);
  const sha256 = crypto.createHash('sha256').update(content).digest('hex');
  await fs.writeFile(
    path.join(dir, MANIFEST_FILE),
    JSON.stringify({ format_version: 1, repo, revision, files: [{ path: 'model.safetensors', size: content.length, sha256 }] }),
  );
}

describe('local vocal separation (fake Model Worker)', () => {
  let dir: string;
  let controlFile: string;
  let recordFile: string;
  let catalog: ModelCatalog;
  let provider: LocalTranscribeProvider;

  const control = (value: Record<string, unknown>) => fs.writeFile(controlFile, JSON.stringify({ record: recordFile, ...value }));
  const recorded = async (): Promise<Array<Record<string, unknown>>> =>
    (await fs.readFile(recordFile, 'utf8').catch(() => ''))
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  const staging = async (name: string) => {
    const at = path.join(dir, 'staging', name);
    await fs.mkdir(at, { recursive: true });
    return at;
  };

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-local-separate-'));
    controlFile = path.join(dir, 'control.json');
    recordFile = path.join(dir, 'runs.jsonl');
    await control({ capabilities: ['separate'] });
    const models = path.join(dir, 'models');
    await writeRepo(models, 'test/sep', 'r-sep');
    catalog = new ModelCatalog({ root: models, bundles: BUNDLES });
    provider = new LocalTranscribeProvider({
      catalog,
      command: () => ({ command: process.execPath, args: [FAKE_MODEL_WORKER, '--control', controlFile] }),
      env: async () => process.env,
      idleMs: 60_000,
      cancelGraceMs: 5_000,
    });
  });

  afterEach(async () => {
    await provider.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('job.run (separate): the requested sample rate is handed to the Worker, the output is vocals.wav and background.wav in staging, progress by step', async () => {
    const input = path.join(dir, 'input.wav');
    await fs.writeFile(input, 'not really audio');
    const out = await staging('a');
    const progress: Array<[number, number]> = [];
    const outcome = await provider.separate(
      { bundleId: BUNDLE, jobId: 'job_1', input: { file: input, contentHash: 'sha256:00', track: 0 }, sampleRate: 48_000, staging: out },
      new AbortController().signal,
      (done, total) => progress.push([done, total]),
    );
    expect(outcome).toMatchObject({
      outcome: 'completed',
      vocals: path.join(out, 'vocals.wav'),
      background: path.join(out, 'background.wav'),
      result: { audio: { sampleRate: 48_000, channels: 2, durationSec: 1 } },
      workerVersion: '0.0.0-fake',
    });
    expect(progress.at(-1)).toEqual([4, 4]);
    const [run] = await recorded();
    expect(run).toMatchObject({
      capability: 'separate',
      input: { file: input, track: 0 },
      options: { sampleRate: 48_000 },
      staging: out,
      outputContract: 'cuccut.stems-wav/v1',
    });
    expect(run).not.toHaveProperty('input.range');
  });

  it('Worker does not declare separate: load-failed (capability-missing), no model.load is sent, the model pack is not disabled', async () => {
    await control({ capabilities: ['transcribe'] });
    const out = await staging('b');
    const error = await provider
      .separate(
        {
          bundleId: BUNDLE,
          jobId: 'job_2',
          input: { file: path.join(dir, 'x.wav'), contentHash: 'sha256:00', track: 0 },
          sampleRate: null,
          staging: out,
        },
        new AbortController().signal,
      )
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderFailure);
    expect(error).toMatchObject({
      kind: 'load-failed',
      details: { detail: 'capability-missing', family: 'htdemucs-ft', separateFamilies: [] },
    });
    expect(catalog.blocked(BUNDLE)).toBe(false);
  });

  it('input unreadable: input-unreadable, the message includes the file', async () => {
    const out = await staging('c');
    const missing = path.join(dir, 'missing.wav');
    const error = await provider
      .separate(
        { bundleId: BUNDLE, jobId: 'job_3', input: { file: missing, contentHash: 'sha256:00', track: 0 }, sampleRate: null, staging: out },
        new AbortController().signal,
      )
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ kind: 'input-unreadable', details: { file: missing, workerCode: 'INPUT_UNREADABLE' } });
  });

  it('output cannot be written to staging: output-unwritable, not counted as a crash, never disables the model pack no matter how many times; the separation step is STAGING_WRITE_FAILED', async () => {
    await control({ capabilities: ['separate'], faults: ['run-error:OUTPUT_WRITE_FAILED'] });
    const input = path.join(dir, 'input.wav');
    await fs.writeFile(input, 'not really audio');
    for (let i = 0; i < 4; i++) {
      const error = await provider
        .separate(
          {
            bundleId: BUNDLE,
            jobId: `job_w${i}`,
            input: { file: input, contentHash: 'sha256:00', track: 0 },
            sampleRate: null,
            staging: await staging(`w${i}`),
          },
          new AbortController().signal,
        )
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ProviderFailure);
      expect(error).toMatchObject({ kind: 'output-unwritable', details: { workerCode: 'OUTPUT_WRITE_FAILED' } });
    }
    expect(catalog.blocked(BUNDLE)).toBe(false);
  });

  it('cancel: after job.cancel the Worker returns cancelled and writes no output', async () => {
    await control({ capabilities: ['separate'], faults: ['slow'] });
    const input = path.join(dir, 'input.wav');
    await fs.writeFile(input, 'x');
    const out = await staging('d');
    const abort = new AbortController();
    const outcome = await provider.separate(
      { bundleId: BUNDLE, jobId: 'job_4', input: { file: input, contentHash: 'sha256:00', track: 0 }, sampleRate: null, staging: out },
      abort.signal,
      (done) => {
        if (done === 1) abort.abort();
      },
    );
    expect(outcome).toEqual({ outcome: 'cancelled' });
    await expect(fs.stat(path.join(out, 'vocals.wav'))).rejects.toThrow();
  });

  describe.skipIf(!hasFfmpeg)('dub separation executor (real ffmpeg)', () => {
    const makeInput = (file: string, seconds: number, rate: number) =>
      execFileSync('ffmpeg', [
        '-v',
        'error',
        '-y',
        '-f',
        'lavfi',
        '-i',
        `sine=frequency=220:duration=${seconds}`,
        '-ar',
        String(rate),
        '-ac',
        '2',
        file,
      ]);

    it('sample rate taken from the input track; when the Worker\'s output is the same length as the container it is returned as is, matching the output contract', async () => {
      const input = path.join(dir, 'clip.wav');
      makeInput(input, 1, 32_000);
      const separator = localDubSeparator({ provider, bundleId: BUNDLE, ffmpeg, ffprobe });
      expect(separator.providerId).toBe('local');
      const out = await staging('e');
      const stems = await separator.separate({
        file: input,
        staging: out,
        videoId: 'vid_1',
        jobId: 'job_5',
        signal: new AbortController().signal,
      });
      expect(stems).toEqual({ vocals: path.join(out, 'vocals.wav'), background: path.join(out, 'background.wav') });
      const [run] = await recorded();
      expect(run).toMatchObject({
        options: { sampleRate: 32_000 },
        input: { contentHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/) },
      });
      const signal = new AbortController().signal;
      const probed = await Promise.all([input, stems.vocals, stems.background].map((f) => probeMedia(ffprobe, f, signal)));
      expect(stemProblems(probed[0]!, { vocals: probed[1]!, background: probed[2]! })).toEqual([]);
    });

    it('container longer than what the Worker wrote: both tracks are padded with silence to the container duration, sample rate unchanged', async () => {
      await control({ capabilities: ['separate'], separateSeconds: 1.2 });
      const input = path.join(dir, 'longer.wav');
      makeInput(input, 1.5, 48_000);
      const separator = localDubSeparator({ provider, bundleId: BUNDLE, ffmpeg, ffprobe });
      const out = await staging('f');
      const stems = await separator.separate({
        file: input,
        staging: out,
        videoId: 'vid_1',
        jobId: 'job_6',
        signal: new AbortController().signal,
      });
      expect(stems).toEqual({ vocals: path.join(out, 'vocals.fit.wav'), background: path.join(out, 'background.fit.wav') });
      const signal = new AbortController().signal;
      const probed = await Promise.all([input, stems.vocals, stems.background].map((f) => probeMedia(ffprobe, f, signal)));
      expect(stemProblems(probed[0]!, { vocals: probed[1]!, background: probed[2]! })).toEqual([]);
      expect(probed[1]!.audio).toMatchObject({ sampleRate: 48_000, channels: 2 });
    });

    it('Provider failure is mapped to this step\'s error code: Worker does not support it is MODEL_LOAD_FAILED', async () => {
      await control({ capabilities: ['transcribe'] });
      const input = path.join(dir, 'clip.wav');
      makeInput(input, 0.5, 44_100);
      const separator = localDubSeparator({ provider, bundleId: BUNDLE, ffmpeg, ffprobe });
      const error = await separator
        .separate({ file: input, staging: await staging('g'), videoId: 'vid_1', jobId: 'job_7', signal: new AbortController().signal })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(PipelineStepError);
      expect(error).toMatchObject({ code: 'MODEL_LOAD_FAILED', details: { providerId: 'local', detail: 'capability-missing' } });
    });

    it('output cannot be written to staging is STAGING_WRITE_FAILED; the executor carries the model pack and the weight estimate', async () => {
      await control({ capabilities: ['separate'], faults: ['run-error:OUTPUT_WRITE_FAILED'] });
      const input = path.join(dir, 'clip.wav');
      makeInput(input, 0.5, 44_100);
      const separator = localDubSeparator({ provider, bundleId: BUNDLE, workerWeightBytes: 123, ffmpeg, ffprobe });
      expect(separator).toMatchObject({ providerId: 'local', modelId: BUNDLE, workerWeightBytes: 123 });
      const error = await separator
        .separate({ file: input, staging: await staging('h'), videoId: 'vid_1', jobId: 'job_8', signal: new AbortController().signal })
        .catch((e: unknown) => e);
      expect(error).toMatchObject({ code: 'STAGING_WRITE_FAILED', details: { providerId: 'local', workerCode: 'OUTPUT_WRITE_FAILED' } });
    });
  });
});
