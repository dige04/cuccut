import { describe, expect, it } from 'vitest';
import type { AsrResult } from '@cuccut/models';
import { speechWords } from './speech-document.ts';

function result(segments: AsrResult['segments']): AsrResult {
  return { segments } as AsrResult;
}

describe('speechWords', () => {
  it('speaker diarization: words use their own speaker when tagged, untagged words take the segment\'s speaker, and nothing is written when there is no speaker', () => {
    const words = speechWords(
      result([
        {
          id: 'seg-1',
          start: 0,
          end: 2_000_000,
          text: 'hello 你好',
          speakerId: 'spk-1',
          words: [
            { text: 'hello', start: 0, end: 900_000, confidence: null, timingQuality: 'aligned', speakerId: 'spk-1' },
            { text: '你好', start: 1_000_000, end: 2_000_000, confidence: null, timingQuality: 'aligned', speakerId: 'spk-2' },
          ],
        },
        {
          id: 'seg-2',
          start: 2_500_000,
          end: 3_000_000,
          text: 'ok',
          speakerId: 'spk-2',
          words: [{ text: 'ok', start: 2_500_000, end: 3_000_000, confidence: null, timingQuality: 'aligned' }],
        },
        {
          id: 'seg-3',
          start: 3_500_000,
          end: 4_000_000,
          text: 'bye',
          speakerId: null,
          words: [{ text: 'bye', start: 3_500_000, end: 4_000_000, confidence: null, timingQuality: 'aligned' }],
        },
      ]),
    );
    expect(words.map((w) => [w.text, w.speaker])).toEqual([
      ['hello', 'spk-1'],
      ['你好', 'spk-2'],
      ['ok', 'spk-2'],
      ['bye', undefined],
    ]);
    expect('speaker' in words[3]!).toBe(false);
  });
});
