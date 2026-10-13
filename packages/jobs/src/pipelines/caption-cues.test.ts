import { describe, expect, it } from 'vitest';
import { captionBody, deriveCues, readSpeechWords } from './caption-cues.ts';

type W = [id: string, start: number, end: number, text: string, flags?: { hidden?: boolean; timingQuality?: string }];

/** Transcript body: seconds written as microsecond ticks (the ticks the local transcription flow writes). */
function speechBody(list: W[]) {
  return {
    schema: 'cuccut.speech/1',
    clock: 'source-asset',
    timescale: 1_000_000,
    speakers: [{ id: 'spk-1', name: '说话人 1' }],
    words: list.map(([id, start, end, text, flags]) => ({
      id,
      start: Math.round(start * 1_000_000),
      end: Math.round(end * 1_000_000),
      text,
      speaker: 'spk-1',
      ...(flags ?? {}),
    })),
    sentences: null,
  };
}

describe('reading transcription (same rule as the editor\'s speech-cues.ts)', () => {
  it('zero-duration words are not dropped: if a gap follows, they take a short slice (at most 0.08 seconds), the whole sentence goes into one subtitle cue', () => {
    // Real sample: the aligner resolved "ask—you" to the same cell, and there is a 0.24-second gap after it.
    const read = readSpeechWords(
      speechBody([
        ['w1', 14.716, 14.956, 'just'],
        ['w2', 14.956, 14.956, 'ask—you'],
        ['w3', 15.196, 15.436, 'know,'],
      ]),
    )!;
    expect(read.words.map((w) => [w.id, w.text])).toEqual([
      ['w1', 'just'],
      ['w2', 'ask—you'],
      ['w3', 'know,'],
    ]);
    expect(read.words[1]!.start).toBeCloseTo(14.956);
    expect(read.words[1]!.end).toBeCloseTo(15.036);
    const cues = deriveCues(read.words);
    expect(cues.map((cue) => [cue.text, cue.wordIds])).toEqual([['just ask—you know,', ['w1', 'w2', 'w3']]]);
    const body = captionBody(cues, read.speakers);
    expect(body.cues).toEqual([{ id: 'q-w1', start: 14716, end: 15436, text: 'just ask—you know,', words: { first: 'w1', last: 'w3' } }]);
  });

  it('a zero-duration word without a gap merges its text into the adjacent word (joins the previous word if there is one, otherwise the next); hidden words stay out of subtitles, but their timing still counts as gap boundaries', () => {
    const read = readSpeechWords(
      speechBody([
        ['w1', 1, 1, 'to'],
        ['w2', 1, 1.3, 'be'],
        ['w3', 1.3, 1.3, 'frank,'],
        ['w4', 1.3, 1.5, 'um', { hidden: true }],
        ['w5', 1.5, 1.8, 'yes.'],
        ['w6', 1.8, 1.8, 'Bye.'],
      ]),
    )!;
    expect(read.words.map((w) => [w.id, w.text, w.start, w.end])).toEqual([
      ['w2', 'to be frank,', 1, 1.3],
      ['w5', 'yes.', 1.5, 1.8],
      ['w6', 'Bye.', 1.8, 1.88],
    ]);
    expect(deriveCues(read.words).map((cue) => cue.text)).toEqual(['to be frank,', 'yes.', 'Bye.']);
  });

  it('hidden or blank words stay out of subtitles; if the transcription has no body, return null', () => {
    const read = readSpeechWords(
      speechBody([
        ['w1', 0, 0.5, 'Hello'],
        ['w2', 0.5, 0.7, ' ', {}],
        ['w3', 0.7, 1, 'world.', { hidden: true }],
      ]),
    )!;
    expect(read.words.map((w) => w.id)).toEqual(['w1']);
    expect(readSpeechWords({ schema: 'cuccut.caption/1', cues: [] })).toBeNull();
  });
});
