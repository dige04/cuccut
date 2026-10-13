import { describe, expect, it } from 'vitest';
import { fixtureView, transcribeModel } from './models-test-fixtures.ts';
import {
  baseName,
  initialTranscribe,
  isTranscribable,
  switchMode,
  transcribeOptionLabel,
  transcribeOptions,
  transcribeStatus,
} from './tools-transcribe.ts';

describe('transcription tool', () => {
  it('recognizes video and audio files', () => {
    expect(isTranscribable('访谈.MP4')).toBe(true);
    expect(isTranscribable('podcast.m4a')).toBe(true);
    expect(isTranscribable('cover.png')).toBe(false);
    expect(isTranscribable('README')).toBe(false);
    expect(baseName('/Users/me/Movies/访谈.mp4')).toBe('访谈.mp4');
    expect(baseName('C:\\clips\\a.wav')).toBe('a.wav');
  });

  it('local lists installed model packs, cloud lists all models of online providers (unconnected ones marked not connected)', () => {
    const view = fixtureView();
    expect(transcribeOptions(view, 'local').map((o) => o.key)).toEqual(['local/qwen3-asr-0.6b@mlx-4bit']);
    const cloud = transcribeOptions(view, 'cloud');
    expect(cloud.map((o) => [o.key, o.usable])).toEqual([
      ['openai/gpt-4o-transcribe', true],
      ['openai/whisper-1', true],
      ['custom:asr-box/whisper-large', true],
      ['google/gemini-2.5-flash', false],
    ]);
    expect(transcribeOptionLabel(cloud[3]!, 'cloud')).toBe('Google Gemini · gemini-2.5-flash · 未连接');
    expect(transcribeOptionLabel(cloud[0]!, 'cloud')).toBe('OpenAI · gpt-4o-transcribe');
  });

  it('local models not properly installed are marked not installed', () => {
    const view = fixtureView();
    view.transcribe.providers[0]!.models.push(transcribeModel('whisper-large-v3@mlx', { available: false, unavailableReason: 'not-installed' }));
    const local = transcribeOptions(view, 'local');
    expect(transcribeOptionLabel(local[1]!, 'local')).toBe('whisper-large-v3@mlx · 未安装');
    expect(transcribeStatus(local[1]!, 'local')).toBe('模型尚未安装');
    expect(transcribeStatus(local[0]!, 'local')).toBe('已安装 · 在本机识别');
  });

  it('on page open lands on the side of the effective default; when switching mode, lands on the first usable option on that side, language reverts to auto', () => {
    const view = fixtureView();
    expect(initialTranscribe(view, null)).toEqual({ mode: 'local', model: 'local/qwen3-asr-0.6b@mlx-4bit' });
    view.transcribe.effective = { providerId: 'custom:asr-box', modelId: 'whisper-large', source: 'user-default' };
    expect(initialTranscribe(view, null)).toEqual({ mode: 'cloud', model: 'custom:asr-box/whisper-large' });
    expect(initialTranscribe(view, { mode: 'cloud', model: 'openai/whisper-1' })).toEqual({ mode: 'cloud', model: 'openai/whisper-1' });
    expect(switchMode(view, 'cloud')).toEqual({ mode: 'cloud', model: 'custom:asr-box/whisper-large', language: '' });
  });

  it('cloud status sentence', () => {
    const cloud = transcribeOptions(fixtureView(), 'cloud');
    expect(transcribeStatus(cloud[0]!, 'cloud')).toBe('已连接 · OpenAI · 联网转录');
    expect(transcribeStatus(cloud[3]!, 'cloud')).toBe('未连接 · Google Gemini · 联网转录');
    expect(transcribeStatus(null, 'cloud')).toBe('还没有云端语音识别服务');
  });
});
