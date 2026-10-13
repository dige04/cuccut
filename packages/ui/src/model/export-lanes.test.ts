import { describe, expect, it } from 'vitest';
import { audioItem, captionItem, documentRecord, sequence, track, videoItem } from '../testing/sequence-records.ts';
import { exportLanes, laneOn, soundLanes } from './export-lanes.ts';

const docs = { d1: documentRecord('d1', 'caption', '访谈字幕', { language: 'zh' }) };

describe('export list (read-only, follows the timeline)', () => {
  it('subtitles on top, then video, audio below; a video track with sound also counts as one audio track', () => {
    const seq = sequence(
      [track('v', 'visual', 0), track('a', 'audio', 0), track('s', 'subtitle', 0)],
      [videoItem('i1', 'v', 0, 300), videoItem('i2', 'v', 300, 300), audioItem('m', 'a', 0, 10), captionItem('c', 's', 'd1')],
    );
    const lanes = exportLanes(seq, docs);
    expect(lanes.map((l) => [l.kind, l.sub, l.picture, l.sound, l.reason])).toEqual([
      ['subtitle', '访谈字幕', true, null, null],
      ['visual', '2 个片段', true, true, null],
      ['audio', '1 段声音', null, true, null],
    ]);
    expect(soundLanes(lanes).map((l) => l.kind)).toEqual(['visual', 'audio']);
  });

  it('hide turns off only video, mute turns off only sound; solo video / solo audio turns other tracks off', () => {
    const seq = sequence(
      [
        track('v1', 'visual', 0, { muted: true }),
        track('v2', 'visual', 1, { solo: { enabled: true, group: 'visual' } }),
        track('a', 'audio', 0, { muted: true }),
        track('s', 'subtitle', 0, { visible: false }),
      ],
      [
        videoItem('i1', 'v1', 0, 300),
        videoItem('i2', 'v2', 0, 300, { embeddedAudio: { enabled: false, volume: 1 } }),
        audioItem('m', 'a', 0, 10),
        captionItem('c', 's', 'd1'),
      ],
    );
    const byTrack = Object.fromEntries(exportLanes(seq, docs).map((l) => [l.trackId, l]));
    expect(byTrack.v1).toMatchObject({ picture: false, sound: false, reason: '别的轨在独显' });
    expect(byTrack.v2).toMatchObject({ picture: true, sound: null, reason: null });
    expect(byTrack.a).toMatchObject({ sound: false, reason: '时间轴上静音' });
    expect(byTrack.s).toMatchObject({ picture: false, reason: '时间轴上隐藏' });
    expect(laneOn(byTrack.a!)).toBe(false);
  });

  it('video on, sound muted: the reason is stated for the sound half', () => {
    const seq = sequence([track('v', 'visual', 0, { muted: true })], [videoItem('i1', 'v', 0, 300)]);
    expect(exportLanes(seq, {})[0]).toMatchObject({ picture: true, sound: false, reason: '声音：时间轴上静音' });
  });

  it('tracks with no enabled instances are not listed', () => {
    const seq = sequence([track('v', 'visual', 0), track('a', 'audio', 0)], [videoItem('i1', 'v', 0, 300, { enabled: false })]);
    expect(exportLanes(seq, {})).toEqual([]);
  });
});
