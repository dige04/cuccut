import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EditorWasmError,
  SENTENCE_DERIVATION,
  applySpeakers,
  editorWasmAvailable,
  locateEditorWasm,
  sourceChapters,
  speakerProposal,
  speechSentences,
} from './node.ts';

const built = editorWasmAvailable();
if (!built) console.warn('编辑语义的 WASM 还没有构建（npm run build:wasm），跳过');

const speech = {
  schema: 'cuccut.speech/1',
  timescale: 1000,
  words: [
    { id: 'w0', start: 0, end: 400, text: 'Hello', speaker: 'a' },
    { id: 'w1', start: 500, end: 900, text: ' there;', speaker: 'a' },
    { id: 'w2', start: 1000, end: 1300, text: ' friend.', speaker: 'a' },
    { id: 'w3', start: 1400, end: 1600, text: ' Hidden', speaker: 'a', hidden: true },
    { id: 'w4', start: 3500, end: 3700, text: ' Next', speaker: 'a' },
  ],
};

describe.skipIf(!built)('editor-wasm (Node)', () => {
  it('sentence splitting and fingerprints come from the subtitle and translation core', () => {
    const result = speechSentences(speech);
    expect(result.derivation).toBe(SENTENCE_DERIVATION);
    expect(result.timescale).toBe(1000);
    expect(result.editViewHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(result.sentences.map((s) => s.id)).toEqual(['s-w0', 's-w4']);
    expect(result.sentences[0]).toMatchObject({
      wordIds: ['w0', 'w1', 'w2'],
      text: 'Hello there; friend.',
      speaker: 'a',
      start: 0,
      end: 1300,
    });
    expect(result.sentences[0]!.fingerprint).toMatch(/^3:w0:w2:[0-9a-z]+$/);
    // Hidden words are not part of sentences, and do not count as pause starts beyond the starting word.
    expect(result.sentences[1]!.wordIds).toEqual(['w4']);
  });

  it('the same text gives the same result; changing one character changes the fingerprint', () => {
    const again = speechSentences(structuredClone(speech));
    expect(again).toEqual(speechSentences(speech));
    const edited = structuredClone(speech);
    edited.words[2]!.text = ' friends.';
    const changed = speechSentences(edited);
    expect(changed.sentences[0]!.fingerprint).not.toBe(again.sentences[0]!.fingerprint);
    expect(changed.sentences[1]!.fingerprint).toBe(again.sentences[1]!.fingerprint);
    expect(changed.editViewHash).not.toBe(again.editViewHash);
    // The full-text fingerprint covers all words (including hidden ones); changing one character changes it.
    expect(again.contentFingerprint).toMatch(/^5:w0:w4:[0-9a-z]+$/);
    expect(changed.contentFingerprint).not.toBe(again.contentFingerprint);
  });

  it('unreadable text throws INVALID_SPEECH', () => {
    expect(() => speechSentences({ schema: 'cuccut.speech/1', words: [{ id: 'w0', text: 'x' }] })).toThrow(EditorWasmError);
    try {
      speechSentences({ schema: 'cuccut.caption/1', words: [] });
    } catch (error) {
      expect((error as EditorWasmError).code).toBe('INVALID_SPEECH');
    }
  });
});

describe.skipIf(!built)('editor-wasm: speaker recognition (Node)', () => {
  const words = ['Hello', ' there,', ' how', ' are', ' you?'].map((text, i) => ({
    id: `w${i}`,
    start: i * 500,
    end: i * 500 + 400,
    text,
    speaker: 'a',
  }));
  const body = { schema: 'cuccut.speech/1', timescale: 1000, speakers: [{ id: 'a', name: '说话人 1' }], words };

  it('a proposal reuses the existing speaker with the most overlap, and a new cluster creates a new speaker; applying changes words according to the proposal', () => {
    const proposal = speakerProposal(body, [], ['A', 'A', 'A', 'B', 'B']);
    expect(proposal.speakers.map((s) => [s.id, s.name, s.isNew, s.sentences])).toEqual([
      ['a', '说话人 1', false, 1],
      ['spk-2', '说话人 2', true, 1],
    ]);
    expect(proposal.wordSpeakers).toEqual({ w3: 'spk-2', w4: 'spk-2' });
    const applied = applySpeakers(body, [], proposal.wordSpeakers, [{ id: 'spk-2', name: '嘉宾' }]);
    expect((applied.speech.words as Array<{ speaker: string }>).map((w) => w.speaker)).toEqual(['a', 'a', 'a', 'spk-2', 'spk-2']);
    expect(applied.speech.speakers).toEqual([
      { id: 'a', name: '说话人 1' },
      { id: 'spk-2', name: '嘉宾' },
    ]);
    expect(applied.translations).toEqual([]);
  });

  it('labels whose count does not match the word count throw INVALID_PROPOSAL', () => {
    expect(() => speakerProposal(body, [], ['A'])).toThrow(expect.objectContaining({ code: 'INVALID_PROPOSAL' }));
  });
});

describe.skipIf(!built)('editor-wasm: source has its own chapters (Node)', () => {
  const body = {
    schema: 'cuccut.speech/1',
    timescale: 1000,
    speakers: [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ],
    words: [
      { id: 'w0', start: 0, end: 400, text: 'Hello.', speaker: 'a' },
      { id: 'w1', start: 60_000, end: 60_400, text: 'Next.', speaker: 'b' },
    ],
    sentences: null,
  };

  it('timestamp outline in the description snaps to paragraph starts; without snapping the original times are kept', () => {
    const source = { description: 'Chapters:\n0:00 Intro\n0:59 Next part' };
    const snapped = sourceChapters({ speech: body, source, durationSeconds: 90 });
    expect(snapped.rows).toEqual([
      { title: 'Intro', start: 0, end: 60, status: 'matched' },
      { title: 'Next part', start: 60, end: 90, status: 'matched' },
    ]);
    expect(snapped.entries[1]!.anchor).toMatchObject({ tier: 'paragraph', id: 'p-w1', time: 60 });
    const parsed = sourceChapters({ source, durationSeconds: 90, snap: false });
    expect(parsed.entries.map((e) => [e.status, e.at])).toEqual([
      ['unanchored', 0],
      ['unanchored', 59],
    ]);
  });

  it('returns an empty result when the source has no chapters', () => {
    expect(sourceChapters({ source: { title: 'x' }, durationSeconds: 10 }).sourceChapters).toEqual([]);
  });
});

it('finds the shipped WASM from a shared chunk outside the repository', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cuccut-editor-chunk-'));
  try {
    const main = path.join(root, 'out', 'main');
    fs.mkdirSync(path.join(main, 'chunks'), { recursive: true });
    fs.mkdirSync(path.join(main, 'generated'));
    const file = path.join(main, 'generated', 'editor.wasm');
    fs.writeFileSync(file, new Uint8Array());
    expect(locateEditorWasm(path.join(main, 'chunks'))).toBe(file);
    expect(locateEditorWasm(main)).toBe(file);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
