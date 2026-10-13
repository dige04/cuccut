import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RpcError, type EditOperation, type SpeechModelInfo, type TranscribeModelInfo } from '@cuccut/protocol';
import {
  ModelCatalog,
  type GenerationAttempt,
  type GenerationCapability,
  type GenerationProvider,
  type GenerationRun,
  type GenerationSelection,
  type TranscribeAttempt,
  type TranscribeProvider,
  type TranscribeRun,
  type TranscribeSelection,
} from '@cuccut/models';
import { LibraryStore } from '@cuccut/runtime-storage/library';
import { JobManager, type JobVideos, type TranscribeRouter } from './job-manager.ts';

/**
 * The user library in tasks (architecture design §5.9): the transcription glossary goes into the prompt; the Job freezes entry versions and digests; versions are pinned for the duration of the task.
 * A synthesized `library:<id>` voice uses the valid clone on the chosen Provider. The Provider is a fake; the library is real (temp directory).
 */

const ASR: TranscribeModelInfo = {
  modelId: 'asr',
  label: 'asr',
  default: true,
  maxInputBytes: null,
  maxDurationSec: null,
  wordTimestamps: 'native',
  languages: 'any',
  acceptsHint: true,
  cost: 'unknown',
};
const TTS: SpeechModelInfo = {
  modelId: 'tts',
  label: 'tts',
  default: true,
  voices: [{ voiceId: 'alloy', label: 'Alloy' }],
  defaultVoice: 'alloy',
  voiceModes: ['preset', 'custom'],
  languages: 'any',
  maxInputChars: 100,
  formats: ['mp3'],
  defaultFormat: 'mp3',
  acceptsInstructions: false,
  speedRange: null,
  acceptsSeed: false,
  cost: 'unknown',
};
const WAV = Buffer.concat([Buffer.from('RIFF\0\0\0\0WAVEfmt ', 'latin1'), Buffer.alloc(64, 1)]);

/** Records each attempt, then waits until cancelled. */
class HoldingTranscriber implements TranscribeProvider {
  readonly id = 'fake';
  readonly runs: TranscribeRun[] = [];

  transcribe(run: TranscribeRun, _sink: unknown, signal: AbortSignal): Promise<TranscribeAttempt> {
    this.runs.push(run);
    return new Promise((resolve) => signal.addEventListener('abort', () => resolve({ outcome: 'cancelled', workerVersion: null })));
  }

  async close(): Promise<void> {}
}

class HoldingGenerator implements GenerationProvider {
  readonly id = 'fake';
  readonly runs: GenerationRun[] = [];

  generate(run: GenerationRun, _sink: unknown, signal: AbortSignal): Promise<GenerationAttempt> {
    this.runs.push(run);
    return new Promise((resolve) => signal.addEventListener('abort', () => resolve({ outcome: 'cancelled' } as GenerationAttempt)));
  }

  async close(): Promise<void> {}
}

class FakeVideos implements JobVideos {
  retain(): void {}
  release(): void {}
  async source(videoId: string, assetId: string) {
    if (videoId !== 'mov_1' || assetId !== 'ast_1') throw new RpcError('not-found', '没有素材');
    return { file: '/dev/null', revision: '1', contentHash: `sha256:${'a'.repeat(64)}`, mediaType: 'audio/wav' };
  }
  current() {
    return null;
  }
  videoRevision() {
    return null;
  }
  async apply(_videoId: string, _request: { operations: EditOperation[] }) {
    return { refs: {} };
  }
}

async function until<T>(read: () => T | undefined | null | false, timeoutMs = 5000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('等待超时');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function rejection(promise: Promise<unknown>): Promise<RpcError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RpcError) return error;
    throw error;
  }
  throw new Error('应该被拒绝');
}

describe('user library in tasks', () => {
  let dir: string;
  let library: LibraryStore;
  let transcriber: HoldingTranscriber;
  let generator: HoldingGenerator;
  let manager: JobManager;
  let acceptsHint: boolean;
  const submitter = { kind: 'connection' as const, id: 'conn_1' };

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-job-library-'));
    library = await LibraryStore.open({ dir: path.join(dir, 'library'), validateAudio: async () => {} });
    transcriber = new HoldingTranscriber();
    generator = new HoldingGenerator();
    acceptsHint = true;
    const router: TranscribeRouter = {
      selectTranscribe: async () =>
        ({
          capability: 'transcribe',
          providerId: 'fake',
          modelId: 'asr',
          kind: 'online',
          label: 'Fake',
          source: 'user-default',
          model: { ...ASR, acceptsHint },
          bundleId: null,
          transcriber,
          queue: { key: 'fake', concurrency: 1 },
        }) as unknown as TranscribeSelection,
      transcriber: () => transcriber,
      executors: () => [transcriber],
      selectGeneration: async <C extends GenerationCapability>(capability: C, target: { provider?: string }) =>
        ({
          capability,
          providerId: target.provider ?? 'openai',
          modelId: 'tts',
          kind: 'online',
          label: 'Fake',
          source: 'explicit',
          model: TTS,
          generator,
          queue: { key: 'fake', concurrency: 1 },
        }) as unknown as GenerationSelection<C>,
      generators: () => [generator],
    };
    manager = new JobManager({
      paths: {
        jobsFile: path.join(dir, 'store', 'jobs.jsonl'),
        stagingDir: path.join(dir, 'staging'),
        artifactsDir: path.join(dir, 'artifacts'),
        diagnosticsDir: path.join(dir, 'logs', 'diagnostics'),
      },
      catalog: new ModelCatalog({ root: path.join(dir, 'models'), bundles: [] }),
      router,
      videos: new FakeVideos(),
      library,
    });
    await manager.open();
  });

  afterEach(async () => {
    await manager.shutdown();
    await library.idle();
    await fs.rm(dir, { recursive: true, force: true });
  });

  const glossary = (name: string, canonical: string[]) =>
    library.put({
      library: 'glossaries',
      content: {
        name,
        kind: 'transcription',
        language: null,
        defaultEnabled: true,
        terms: canonical.map((c) => ({ canonical: c, misheard: ['x'] })),
      },
    });

  it('the glossary\'s canonical spelling enters the prompt; the version and digest of the Job\'s frozen entries are fixed during the task and released after it ends', async () => {
    const a = (await glossary('甲', ['CucCut', 'Rust'])).entry;
    const b = (await glossary('乙', ['Rust', 'Tauri'])).entry;
    const { jobId } = await manager.submitTranscribe(
      { videoId: 'mov_1', assetId: 'ast_1', hint: '技术访谈', glossaries: [{ id: a.id }, { id: b.id, version: 1 }] },
      submitter,
    );
    const run = await until(() => transcriber.runs[0]);
    expect(run.options.hint).toBe('技术访谈\nCucCut、Rust、Tauri');
    const record = manager.inspect(jobId);
    expect(record.library).toEqual({
      entries: [
        { library: 'glossaries', id: a.id, version: 1, contentHash: a.contentHash },
        { library: 'glossaries', id: b.id, version: 1, contentHash: b.contentHash },
      ],
      glossaryHint: { status: 'sent', terms: 3, dropped: 0 },
    });

    // The glossary was changed during the task: the old version is pinned and still readable.
    await library.put({ library: 'glossaries', id: a.id, content: { ...a.content, name: '甲改' } });
    expect(library.get({ library: 'glossaries', id: a.id, version: 1 }).contentHash).toBe(a.contentHash);

    await manager.cancel(jobId);
    await manager.settled(jobId);
    await until(() => library.pinCount({ library: 'glossaries', id: a.id, version: 1 }) === 0);
    await library.idle();
    expect(
      (() => {
        try {
          library.get({ library: 'glossaries', id: a.id, version: 1 });
          return 'kept';
        } catch {
          return 'pruned';
        }
      })(),
    ).toBe('pruned');
  });

  it('model does not accept prompts: the glossary and user prompt are ignored, noted and warned in the record, without an error', async () => {
    acceptsHint = false;
    const a = (await glossary('甲', ['CucCut', 'Rust'])).entry;
    const { jobId } = await manager.submitTranscribe(
      { videoId: 'mov_1', assetId: 'ast_1', hint: '人名：山田', glossaries: [{ id: a.id }] },
      submitter,
    );
    const run = await until(() => transcriber.runs[0]);
    expect(run.options.hint ?? null).toBeNull();
    const job = manager.inspect(jobId);
    expect(job.library).toMatchObject({ glossaryHint: { status: 'unsupported', terms: 0, dropped: 2 } });
    expect(job.warnings).toEqual([expect.objectContaining({ code: 'hint-ignored', detail: expect.stringContaining('asr') })]);
    await manager.cancel(jobId);
  });

  it('a translation glossary and nonexistent entries are rejected, and no task is created', async () => {
    const t = await library.put({
      library: 'glossaries',
      content: { name: '译', kind: 'translation', sourceLanguage: null, targetLanguage: 'en', defaultEnabled: false, terms: [] },
    });
    const wrong = await rejection(
      manager.submitTranscribe({ videoId: 'mov_1', assetId: 'ast_1', glossaries: [{ id: t.entry.id }] }, submitter),
    );
    expect(wrong.details).toMatchObject({ code: 'LIBRARY_ENTRY_NOT_APPLICABLE' });
    expect(
      (await rejection(manager.submitTranscribe({ videoId: 'mov_1', assetId: 'ast_1', glossaries: [{ id: 'gls_none' }] }, submitter))).code,
    ).toBe('not-found');
    expect(manager.list()).toEqual([]);
  });

  it('external service clients cannot reference the user library: the glossary and library voices are both rejected, and no task is created', async () => {
    const service = { kind: 'service' as const, id: 'model-api', clientId: 'cli_1' };
    const a = (await glossary('甲', ['CucCut'])).entry;
    const glossaryRefused = await rejection(
      manager.submitTranscribe({ videoId: 'mov_1', assetId: 'ast_1', glossaries: [{ id: a.id }] }, service),
    );
    expect(glossaryRefused.code).toBe('invalid-request');
    expect(glossaryRefused.details).toMatchObject({ code: 'LIBRARY_ENTRY_NOT_APPLICABLE', reason: 'service-client' });

    const ref = path.join(dir, 'ref.wav');
    await fs.writeFile(ref, WAV);
    const content = {
      name: '我',
      language: null,
      transcript: '你好',
      origin: 'recorded' as const,
      consent: { declared: true, statement: '本人' },
    };
    const voice = (await library.put({ library: 'voices', content, file: { path: ref } })).entry;
    await library.recordClone(voice.id, 'openai', 'clone-123');
    const voiceRefused = await rejection(
      manager.submitSynthesizeSpeech({ text: '你好', voice: `library:${voice.id}`, provider: 'openai' }, service),
    );
    expect(voiceRefused.details).toMatchObject({ code: 'LIBRARY_ENTRY_NOT_APPLICABLE', reason: 'service-client' });
    expect(manager.list()).toEqual([]);
  });

  it('library:<id> voice: valid clone, no clone, expired clone', async () => {
    const ref = path.join(dir, 'ref.wav');
    await fs.writeFile(ref, WAV);
    const content = {
      name: '我',
      language: null,
      transcript: '你好',
      origin: 'recorded' as const,
      consent: { declared: true, statement: '本人' },
    };
    const voice = (await library.put({ library: 'voices', content, file: { path: ref } })).entry;

    // no clone
    const missing = await rejection(
      manager.submitSynthesizeSpeech({ text: '你好', voice: `library:${voice.id}`, provider: 'openai' }, submitter),
    );
    expect(missing.code).toBe('conflict');
    expect(missing.details).toMatchObject({ code: 'VOICE_CLONE_REQUIRED', reason: 'missing', providerId: 'openai' });

    // valid clone: the executor receives the cloned voice ID, and the Job records the frozen voice entry.
    await library.recordClone(voice.id, 'openai', 'clone-123');
    const { jobId } = await manager.submitSynthesizeSpeech({ text: '你好', voice: `library:${voice.id}`, provider: 'openai' }, submitter);
    const run = await until(() => generator.runs[0]);
    expect(run.parameters).toMatchObject({ capability: 'synthesizeSpeech', voice: 'clone-123' });
    expect(manager.inspect(jobId).library).toEqual({
      entries: [{ library: 'voices', id: voice.id, version: 1, contentHash: voice.contentHash }],
    });
    // no clone on another Provider
    expect(
      (await rejection(manager.submitSynthesizeSpeech({ text: '你好', voice: `library:${voice.id}`, provider: 'google' }, submitter)))
        .details,
    ).toMatchObject({ code: 'VOICE_CLONE_REQUIRED', reason: 'missing' });
    await manager.cancel(jobId);

    // reference recording replaced: clone expired
    const ref2 = path.join(dir, 'ref2.wav');
    await fs.writeFile(ref2, Buffer.concat([WAV, Buffer.from('2')]));
    await library.put({ library: 'voices', id: voice.id, content, file: { path: ref2 } });
    expect(
      (await rejection(manager.submitSynthesizeSpeech({ text: '你好', voice: `library:${voice.id}`, provider: 'openai' }, submitter)))
        .details,
    ).toMatchObject({ code: 'VOICE_CLONE_REQUIRED', reason: 'stale' });
  });
});
