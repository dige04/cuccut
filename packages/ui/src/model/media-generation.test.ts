import { describe, expect, it } from 'vitest';
import type { ImageModelInfo } from '@cuccut/protocol';
import {
  canvasAspect,
  editorImageRequest,
  editorSpeechRequest,
  effectiveImageDraft,
  fittedAspect,
  outputAsset,
  speechAssetName,
  ttsStage,
  videoGenerationJobs,
  withVideo,
  type EditorImageDraft,
} from './media-generation.ts';
import { imageModel, speechModel } from './models-test-fixtures.ts';
import { aspectOptions, BLANK_IMAGE, retryRequest, type ImageOption } from './tools-image.ts';
import { AUDIO_OUT, imageJob, imageOut, toolJob } from './tools-test-fixtures.ts';
import { BLANK_TTS, type SpeechOption } from './tools-tts.ts';

const speech: SpeechOption = {
  key: 'openai/gpt-4o-mini-tts',
  providerId: 'openai',
  provider: 'OpenAI',
  modelId: 'gpt-4o-mini-tts',
  label: 'gpt-4o-mini-tts',
  connected: true,
  usable: true,
  why: null,
  info: speechModel('gpt-4o-mini-tts', ['alloy', 'echo']),
};

const ratios = imageModel('gpt-image-1', {
  aspectRatios: [
    { ratio: '1:1', size: '1024x1024' },
    { ratio: '3:2', size: '1536x1024' },
    { ratio: '2:3', size: '1024x1536' },
  ],
  sizes: ['1024x1024', '1536x1024', '1024x1536'],
  defaultSize: '1024x1024',
  maxCount: 4,
});

function imageOption(info: ImageModelInfo): ImageOption {
  return {
    key: `openai/${info.modelId}`,
    providerId: 'openai',
    provider: 'OpenAI',
    modelId: info.modelId,
    label: info.label,
    connected: true,
    usable: true,
    why: null,
    info,
  };
}

const LANDSCAPE = { width: 1920, height: 1080 };
const PORTRAIT = { width: 1080, height: 1920 };
const SQUARE = { width: 1080, height: 1080 };

describe('request carries the video', () => {
  it('voice: carries videoId and the media name (first 24 characters of the text)', () => {
    const req = editorSpeechRequest(
      { ...BLANK_TTS, text: '  欢迎使用 CucCut！\n转录、翻译、配音、剪辑，全都在你自己的电脑上完成。 ', voice: 'preset:echo' },
      speech,
      'v1',
    );
    expect(req).toMatchObject({ videoId: 'v1', provider: 'openai', model: 'gpt-4o-mini-tts', voice: 'echo' });
    expect(req.name).toBe('语音：欢迎使用 CucCut！ 转录、翻译、配音、剪辑…');
    expect(speechAssetName('你好')).toBe('语音：你好');
  });

  it('my voice is passed as-is per the contract: library:<id>', () => {
    expect(editorSpeechRequest({ ...BLANK_TTS, text: '你好', voice: 'library:v9' }, speech, 'v1').voice).toBe('library:v9');
  });

  it('image: carries videoId; "follow video canvas" picks the closest aspect ratio to the canvas', () => {
    const draft: EditorImageDraft = { ...BLANK_IMAGE, prompt: '一只纸鹤', size: '2:3', fit: true };
    expect(editorImageRequest(draft, imageOption(ratios), 'v1', LANDSCAPE)).toMatchObject({ videoId: 'v1', size: '3:2', prompt: '一只纸鹤' });
    expect(editorImageRequest({ ...draft, fit: false }, imageOption(ratios), 'v1', LANDSCAPE).size).toBe('2:3');
  });

  it('retry restores videoId; when parameters are incomplete, still null as before', () => {
    expect(withVideo(retryRequest(imageJob()), 'v1')).toMatchObject({ prompt: '水墨风格的山间小路', videoId: 'v1' });
    expect(withVideo(null, 'v1')).toBeNull();
  });
});

describe('follow video canvas', () => {
  it('landscape, portrait and square canvases each map to the closest tier', () => {
    const options = aspectOptions(ratios);
    expect(canvasAspect(LANDSCAPE, options)?.key).toBe('3:2');
    expect(canvasAspect(PORTRAIT, options)?.key).toBe('2:3');
    expect(canvasAspect(SQUARE, options)?.key).toBe('1:1');
  });

  it('16:9 / 9:16 are used as-is when available; models that only list sizes use the ratio of the size', () => {
    const wide = imageModel('w', { aspectRatios: ['16:9', '9:16', '1:1', '4:3'].map((ratio) => ({ ratio, size: '1024x1024' })) });
    expect(fittedAspect(wide, LANDSCAPE)?.key).toBe('16:9');
    expect(fittedAspect(wide, PORTRAIT)?.key).toBe('9:16');
    const sizes = imageModel('dall-e', { sizes: ['1024x1024', '1792x1024', '1024x1792'] });
    expect(fittedAspect(sizes, LANDSCAPE)?.key).toBe('1792x1024');
  });

  it('when the model does not allow choosing a size and the canvas has no size, this tier does not exist and the draft stays as is', () => {
    const fixed = imageModel('fixed', { sizes: [], aspectRatios: [] });
    expect(fittedAspect(fixed, LANDSCAPE)).toBeNull();
    expect(canvasAspect({ width: 0, height: 0 }, aspectOptions(ratios))).toBeNull();
    const draft: EditorImageDraft = { ...BLANK_IMAGE, size: null, fit: true };
    expect(effectiveImageDraft(draft, fixed, LANDSCAPE).size).toBeNull();
  });
});

describe('generation records in the video', () => {
  it('only this video and this kind, newest first, hidden ones not listed; not limited to submitter', () => {
    const jobs = [
      imageJob({ jobId: 'a', videoId: 'v1', createdAt: '2026-10-03T00:00:00.000Z' }),
      imageJob({ jobId: 'b', videoId: 'v1', createdAt: '2026-10-03T00:05:00.000Z', submitter: { kind: 'agent', id: 's1', taskId: 't1' } }),
      imageJob({ jobId: 'c', videoId: 'v2' }),
      imageJob({ jobId: 'd', videoId: null }),
      toolJob({ jobId: 'e', videoId: 'v1' }),
      imageJob({ jobId: 'f', videoId: 'v1' }),
    ];
    expect(videoGenerationJobs(jobs, 'v1', 'generateImage', ['f']).map((j) => j.jobId)).toEqual(['b', 'a']);
    expect(videoGenerationJobs(jobs, 'v1', 'synthesizeSpeech', []).map((j) => j.jobId)).toEqual(['e']);
  });

  it('media imported from results', () => {
    const job = imageJob({ state: 'completed', result: { outputs: [{ ...imageOut('sha256:1'), assetId: 'as_1' }, imageOut('sha256:2')] } as never });
    expect(outputAsset(job, 'sha256:1')).toBe('as_1');
    expect(outputAsset(job, 'sha256:2')).toBeNull();
    expect(outputAsset(job, 'sha256:x')).toBeNull();
  });

  it('stages of the generate-voice subpage', () => {
    expect(ttsStage(null, null)).toBe('setup');
    expect(ttsStage('job_1', null)).toBe('run');
    expect(ttsStage('job_1', toolJob({ state: 'queued' }))).toBe('run');
    expect(ttsStage('job_1', toolJob({ state: 'interrupted', endedAt: null }))).toBe('run');
    expect(ttsStage('job_1', toolJob({ state: 'completed', result: { outputs: [AUDIO_OUT] } as never }))).toBe('done');
    expect(ttsStage('job_1', toolJob({ state: 'failed', endedAt: '2026-10-03T00:00:03.000Z' }))).toBe('failed');
    expect(ttsStage('job_1', toolJob({ state: 'needs-reconciliation', endedAt: '2026-10-03T00:00:03.000Z' }))).toBe('failed');
    expect(ttsStage('job_1', toolJob({ state: 'cancelled', endedAt: '2026-10-03T00:00:03.000Z' }))).toBe('setup');
  });
});
