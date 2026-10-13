import { describe, expect, it } from 'vitest';
import { validateAsrResult } from '@cuccut/models';
import { parseGeneralInteraction, parseTranscribeInteraction, offsetSec } from './google/google-adapter.ts';
import { languageTagOf, parseOpenAiTranscription } from './openai/openai-transcription.ts';
import { buildAsrResult, groupWords, joinWords, noAudioResult, type ResultContext } from './transcript.ts';

const context = (overrides: Partial<ResultContext> = {}): ResultContext => ({
  providerId: 'openai',
  modelId: 'whisper-1',
  workerVersion: 'test@1',
  contentHash: 'sha256:abc',
  runGeneration: 1,
  timescale: 1000,
  language: { mode: 'prefer', tag: null },
  offsetSec: 0,
  ...overrides,
});

describe('buildAsrResult', () => {
  it('provider word timings are tagged provider; segments without words are interpolated by character length and tagged estimated; times map back to integer ticks on the media clock', () => {
    const result = buildAsrResult({
      context: context({ offsetSec: 10 }),
      decodedSec: 20,
      chunks: [
        {
          startSec: 0,
          endSec: 8,
          transcript: {
            text: 'hello world',
            segments: [{ start: 1, end: 2.5, text: ' hello world' }],
            words: [
              { start: 1, end: 1.5, text: 'hello' },
              { start: 1.6, end: 2.4, text: 'world' },
            ],
            language: 'english',
            usage: { seconds: 8 },
          },
        },
        {
          startSec: 8,
          endSec: 20,
          transcript: { text: '第二段', segments: [{ start: 0.5, end: 2, text: '第二段' }], usage: { seconds: 12 } },
        },
      ],
    });
    expect(validateAsrResult(result, { runGeneration: 1 })).toMatchObject({ ok: true });
    expect(result).toMatchObject({ outcome: 'transcribed', duration: 30_000, coverage: [{ start: 10_000, end: 30_000 }], warnings: [] });
    expect(result.segments.map((s) => [s.id, s.start, s.end, s.text])).toEqual([
      ['seg-0001', 11_000, 12_500, 'hello world'],
      ['seg-0002', 18_500, 20_000, '第二段'],
    ]);
    expect(result.segments[0]!.words).toEqual([
      { start: 11_000, end: 11_500, text: 'hello', confidence: null, timingQuality: 'provider' },
      { start: 11_600, end: 12_400, text: 'world', confidence: null, timingQuality: 'provider' },
    ]);
    expect(result.segments[1]!.words.length).toBeGreaterThan(0);
    expect(result.segments[1]!.words.every((w) => w.timingQuality === 'estimated')).toBe(true);
    expect(result.segments[1]!.words[0]!.start).toBe(18_500);
    expect(result.segments[1]!.words.at(-1)!.end).toBe(20_000);
    expect(result.language).toEqual({ tag: 'english', source: 'detected', confidence: null });
    expect(result.provenance).toMatchObject({
      provider: 'openai',
      bundleId: null,
      backend: 'online',
      device: 'remote',
      inputHash: 'sha256:abc',
      cost: { status: 'reported', usage: [{ seconds: 8 }, { seconds: 12 }] },
    });
  });

  it('words beyond the segment, or a segment overlapping the previous one: corrected and recorded as timing-adjusted; segments with no length after conversion are dropped and recorded as segment-degenerate', () => {
    const result = buildAsrResult({
      context: context(),
      decodedSec: 10,
      chunks: [
        {
          startSec: 0,
          endSec: 10,
          transcript: {
            text: '',
            segments: [
              { start: 0, end: 3, text: 'one two' },
              { start: 2.5, end: 5, text: 'three' },
              { start: 6, end: 6.0001, text: 'blip' },
            ],
            words: [
              { start: 0.2, end: 1, text: 'one' },
              { start: 0.9, end: 3.4, text: 'two' },
              { start: 2.6, end: 4, text: 'three' },
            ],
          },
        },
      ],
    });
    expect(validateAsrResult(result, { runGeneration: 1 })).toMatchObject({ ok: true });
    expect(result.segments.map((s) => [s.start, s.end])).toEqual([
      [0, 3000],
      [3000, 5000],
    ]);
    expect(result.warnings.map((w) => w.code).sort()).toEqual(['segment-degenerate', 'timing-adjusted', 'timing-adjusted']);
    expect(result.segments[1]!.words[0]).toMatchObject({ start: 3000, end: 4000, timingQuality: 'provider' });
  });

  it('words only: split by pauses and sentence-final punctuation; text only: one block as one segment; nothing: no-speech', () => {
    const words = buildAsrResult({
      context: context(),
      decodedSec: 10,
      chunks: [
        {
          startSec: 0,
          endSec: 10,
          transcript: {
            text: '',
            words: [
              { start: 0.1, end: 0.4, text: 'Hi' },
              { start: 0.5, end: 0.9, text: 'there.' },
              { start: 1.0, end: 1.3, text: 'New' },
              { start: 1.4, end: 1.8, text: 'one' },
              { start: 4.0, end: 4.5, text: 'later' },
            ],
          },
        },
      ],
    });
    expect(words.segments.map((s) => s.text)).toEqual(['Hi there.', 'New one', 'later']);
    const text = buildAsrResult({
      context: context(),
      decodedSec: 4,
      chunks: [{ startSec: 0, endSec: 4, transcript: { text: '  整块文本 ' } }],
    });
    expect(text.segments).toMatchObject([{ start: 0, end: 4000, text: '整块文本' }]);
    expect(text.provenance.cost).toEqual({ status: 'unknown' });
    const empty = buildAsrResult({ context: context(), decodedSec: 4, chunks: [{ startSec: 0, endSec: 4, transcript: { text: '' } }] });
    expect(empty).toMatchObject({ outcome: 'no-speech', segments: [], coverage: [{ start: 0, end: 4000 }] });
    expect(validateAsrResult(empty)).toMatchObject({ ok: true });
  });

  it('the asserted language is written back as is; without an audio track duration is 0 and coverage is empty', () => {
    const asserted = buildAsrResult({
      context: context({ language: { mode: 'assert', tag: 'zh-Hans' } }),
      decodedSec: 2,
      chunks: [{ startSec: 0, endSec: 2, transcript: { text: '你好', language: 'en' } }],
    });
    expect(asserted.language).toEqual({ tag: 'zh-Hans', source: 'asserted', confidence: null });
    expect(validateAsrResult(asserted, { assertedLanguage: 'zh-Hans' })).toMatchObject({ ok: true });
    const none = noAudioResult(context({ language: { mode: 'prefer', tag: 'ja' } }));
    expect(none).toMatchObject({ outcome: 'no-audio-track', duration: 0, coverage: [], language: { tag: 'ja', source: 'unknown' } });
    expect(validateAsrResult(none)).toMatchObject({ ok: true });
  });

  it('word joining: no spaces between CJK text or before punctuation', () => {
    expect(joinWords(['Hello', ',', 'world', '!'])).toBe('Hello, world!');
    expect(joinWords(['你好', '世界', 'CucCut'])).toBe('你好世界CucCut');
    expect(
      groupWords([
        { start: 0, end: 31, text: 'long', confidence: null },
        { start: 31, end: 32, text: 'next', confidence: null },
      ]),
    ).toHaveLength(2);
  });
});

describe('response parsing', () => {
  it('OpenAI: segments, words and language name from verbose_json; json has only text and usage', () => {
    expect(
      parseOpenAiTranscription(
        {
          text: 'hi',
          language: 'japanese',
          segments: [{ start: 0, end: 1, text: 'hi' }, { bogus: true }],
          words: [{ word: 'hi', start: 0, end: 0.5 }],
          usage: { type: 'duration', seconds: 1 },
        },
        'OpenAI',
      ),
    ).toEqual({
      text: 'hi',
      segments: [{ start: 0, end: 1, text: 'hi' }],
      words: [{ start: 0, end: 0.5, text: 'hi' }],
      language: 'ja',
      usage: { type: 'duration', seconds: 1 },
    });
    expect(parseOpenAiTranscription({ text: 'x', usage: { type: 'tokens' } }, 'OpenAI')).toEqual({ text: 'x', usage: { type: 'tokens' } });
    expect(() => parseOpenAiTranscription({ nope: 1 }, 'OpenAI')).toThrow();
    expect(languageTagOf('en')).toBe('en');
    expect(languageTagOf('Klingon')).toBeNull();
  });

  it('Gemini: offsets from word_info; structured segments; falls back to a single segment when JSON cannot be read; a failed status is rejected', () => {
    expect(offsetSec('1.250s')).toBe(1.25);
    expect(offsetSec('x')).toBeNull();
    const words = parseTranscribeInteraction({
      status: 'completed',
      steps: [
        {
          content: [
            {
              type: 'text',
              text: 'a b',
              annotations: [
                { type: 'word_info', text: 'a', start_offset: '0.1s', end_offset: '0.2s' },
                { type: 'word_info', text: 'b', start_offset: '0.3s', end_offset: 'bad' },
                { type: 'citation' },
              ],
            },
          ],
        },
      ],
    });
    expect(words).toEqual({ text: 'a b', words: [{ start: 0.1, end: 0.2, text: 'a' }] });
    expect(
      parseGeneralInteraction({ output_text: JSON.stringify({ language: 'fr', segments: [{ start: 0, end: 1, text: 'salut' }] }) }),
    ).toEqual({
      text: 'salut',
      segments: [{ start: 0, end: 1, text: 'salut' }],
      language: 'fr',
    });
    expect(parseGeneralInteraction({ output_text: 'plain transcript', usage: { n: 1 } })).toEqual({
      text: 'plain transcript',
      usage: { n: 1 },
    });
    expect(() => parseGeneralInteraction({ status: 'failed', steps: [] })).toThrow(expect.objectContaining({ kind: 'rejected' }));
    expect(() => parseTranscribeInteraction({ id: 'x' })).toThrow(expect.objectContaining({ kind: 'protocol' }));
  });
});
