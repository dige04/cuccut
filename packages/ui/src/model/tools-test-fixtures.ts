// i18n-ignore-file: test fixtures mimicking data sent by the Runtime; tests assert these sample values
import type { GeneratedOutput, JobRecord, TextJobResult } from '@cuccut/protocol';

/** Fake Job record shared by the tools page unit tests: shaped like `JobRecord`; by default a speech synthesis job submitted from the UI that belongs to no video. */

export const AUDIO_OUT: GeneratedOutput = {
  artifactId: 'sha256:aa',
  mediaType: 'audio/mpeg',
  byteLength: 48_000,
  assetId: null,
  media: { kind: 'audio', durationSec: 7.2, sampleRate: 24000, channels: 1 },
};

export function imageOut(artifactId: string, width = 1024, height = 1024): GeneratedOutput {
  return { artifactId, mediaType: 'image/png', byteLength: 120_000, assetId: null, media: { kind: 'image', width, height } };
}

export function toolJob(patch: Partial<JobRecord> = {}): JobRecord {
  return {
    jobId: 'job_1',
    kind: 'synthesizeSpeech',
    state: 'running',
    phase: 'generating',
    progress: null,
    videoId: null,
    assetId: null,
    assetRevision: null,
    contentHash: 'sha256:00',
    providerId: 'openai',
    modelId: 'gpt-4o-mini-tts',
    bundleId: null,
    inputHash: 'sha256:00',
    submitter: { kind: 'connection', id: 'c1' },
    attempt: 1,
    createdAt: '2026-10-03T00:00:00.000Z',
    updatedAt: '2026-10-03T00:00:02.000Z',
    startedAt: '2026-10-03T00:00:00.500Z',
    endedAt: null,
    error: null,
    result: null,
    warnings: [],
    generation: {
      capability: 'synthesizeSpeech',
      text: '欢迎使用 CucCut！',
      voice: 'alloy',
      language: 'zh',
      format: 'mp3',
      instructions: null,
      speed: null,
      seed: null,
    },
    ...patch,
  };
}

export function imageJob(patch: Partial<JobRecord> = {}): JobRecord {
  return toolJob({
    kind: 'generateImage',
    modelId: 'gpt-image-1',
    generation: { capability: 'generateImage', prompt: '水墨风格的山间小路', size: null, aspectRatio: '1:1', count: 2, format: 'png', seed: null },
    ...patch,
  });
}

/** Summary of a text generation result (`job.result.text`): by default a complete plain-text result. */
export function textResult(patch: Partial<TextJobResult> = {}): TextJobResult {
  return {
    mediaType: 'text/plain',
    byteLength: 60,
    length: 20,
    preview: '街道醒来，咖啡馆的门被推开。',
    previewTruncated: false,
    finishReason: 'stop',
    usage: { inputTokens: 30, outputTokens: 40 },
    modelVersion: null,
    notes: [],
    ...patch,
  };
}

export function textJob(patch: Partial<JobRecord> = {}): JobRecord {
  return toolJob({
    kind: 'generateText',
    modelId: 'gpt-5-mini',
    generation: {
      capability: 'generateText',
      messages: [{ role: 'user', content: '写一段城市漫游旁白' }],
      responseFormat: { type: 'text' },
      maxOutputTokens: 128_000,
      temperature: null,
      requestedEffort: null,
      effort: 'medium',
      seed: null,
    },
    ...patch,
  });
}
