import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { VideoSnapshot } from '@cuccut/protocol';
import { RcReview } from '@cuccut/protocol/messages/runtime-core';
import { checkEvidence, documentText, foldText, frameCandidates, framePathOf, parseTimestamp, snapshotIds } from './review-evidence.ts';

const root = path.resolve('/work/project');
const context = {
  sourceRoot: root,
  durationSec: 75,
  ids: new Set(['item_1', 'track_main', 'doc_speech']),
  texts: ['Hello there. Good  Morning, everyone', '字幕 第一行'],
  frames: new Set(['.cuccut-out/frames/v1/frame-4.0.jpg']),
};

describe('evidence of the declared kind', () => {
  it('reads timestamps in seconds and clock form, inside the video', () => {
    expect(parseTimestamp('4.2s')).toBe(4.2);
    expect(parseTimestamp('12 sec')).toBe(12);
    expect(parseTimestamp('01:05')).toBe(65);
    expect(parseTimestamp('1:02:03.5')).toBe(3723.5);
    expect(parseTimestamp('1:75')).toBeNull();
    expect(parseTimestamp('around the start')).toBeNull();
    expect(checkEvidence('timestamp', '4.2s', context)).toBe(true);
    expect(checkEvidence('timestamp', '00:10 – 00:20', context)).toBe(true);
    expect(checkEvidence('timestamp', '4s-6s', context)).toBe(true);
    expect(checkEvidence('timestamp', '02:00', context)).toBe(RcReview.evidenceInvalid({ kind: 'timestamp' }).text);
    expect(checkEvidence('timestamp', '00:20 to 00:10', context)).not.toBe(true);
    expect(checkEvidence('timestamp', 'early on', context)).not.toBe(true);
  });

  it('accepts a frame only inside .cuccut-out/frames of the source root, when it exists', () => {
    expect(framePathOf('.cuccut-out/frames/v1/frame-4.0.jpg', root)).toBe('.cuccut-out/frames/v1/frame-4.0.jpg');
    expect(framePathOf(path.join(root, '.cuccut-out', 'frames', 'v1', 'a.jpg'), root)).toBe('.cuccut-out/frames/v1/a.jpg');
    expect(framePathOf('.cuccut-out/frames/../secrets.txt', root)).toBeNull();
    expect(framePathOf('/etc/passwd', root)).toBeNull();
    expect(framePathOf('.cuccut-out/frames/', root)).toBeNull();
    expect(checkEvidence('frame', '".cuccut-out/frames/v1/frame-4.0.jpg"', context)).toBe(true);
    expect(checkEvidence('frame', '.cuccut-out/frames/v1/frame-9.0.jpg', context)).not.toBe(true);
    expect(
      frameCandidates(
        [{ id: 'q', ask: 'x', evidence: 'frame', severity: 'nitpick', fix: '' }],
        [
          { id: 'q', verdict: 'holds', evidence: '.cuccut-out/frames/v1/frame-9.0.jpg' },
          { id: 'other', verdict: 'holds', evidence: '.cuccut-out/frames/v1/x.jpg' },
        ],
        root,
      ),
    ).toEqual(['.cuccut-out/frames/v1/frame-9.0.jpg']);
  });

  it('accepts a field that names something in the video', () => {
    expect(checkEvidence('field', 'item_1', context)).toBe(true);
    expect(checkEvidence('field', 'the title (item_1)', context)).toBe(true);
    expect(checkEvidence('field', 'hook', context)).not.toBe(true);
  });

  it('finds quotes with case and whitespace folded', () => {
    expect(foldText('“Good Morning”')).toBe('goodmorning');
    expect(checkEvidence('quote', '"good morning, Everyone"', context)).toBe(true);
    expect(checkEvidence('quote', '第一行', context)).toBe(true);
    expect(checkEvidence('quote', 'good evening', context)).not.toBe(true);
    expect(checkEvidence('quote', 'g', context)).not.toBe(true);
  });

  it('collects ids and document text', () => {
    const snapshot = {
      id: 'v',
      documents: { d1: {} },
      sequences: { s: { id: 's', tracks: [{ id: 't' }], items: [{ id: 'i' }], markers: [{ id: 'm' }] } },
    } as unknown as VideoSnapshot;
    expect([...snapshotIds(snapshot)].sort()).toEqual(['d1', 'i', 'm', 's', 't', 'v']);
    expect(documentText({ schema: 'cuccut.speech/1', words: [{ text: 'Hello' }, { text: 'there.' }] })).toBe('Hello there.');
    expect(documentText({ schema: 'cuccut.caption/1', cues: [{ text: 'One' }, { text: 'Two' }] })).toBe('One\nTwo');
    expect(documentText({ schema: 'cuccut.translation/2' })).toBe('');
  });
});
