import { describe, expect, it } from 'vitest';
import { burnedCaptionLanguages, DEFAULT_LOUDNESS_TARGET, transcriptStamp } from './exports.ts';
import { methodParamSchemas } from './schemas.ts';

describe('export settings', () => {
  it('purpose applies to every export, omitting it keeps delivery semantics, unknown purposes rejected', () => {
    const create = methodParamSchemas['exports.create'];
    for (const [kind, format] of [['video', 'mp4'], ['audio', 'wav'], ['subtitles', 'srt'], ['transcript', 'txt'], ['portable', 'cuccut'], ['project', 'xmeml']]) {
      for (const purpose of [undefined, 'deliverable', 'preview']) {
        const parsed = create.parse({ videoId: 'v', settings: { kind, format, ...(purpose ? { purpose } : {}) } });
        expect(parsed.settings.purpose).toBe(purpose);
      }
      expect(create.safeParse({ videoId: 'v', settings: { kind, format, purpose: 'hidden' } }).success).toBe(false);
    }
  });

  it('exports.renderText only accepts subtitle and transcript settings, with the same parameters as the same kind of setting in exports.create', () => {
    const render = methodParamSchemas['exports.renderText'];
    expect(
      render.safeParse({
        videoId: 'v',
        settings: { kind: 'transcript', format: 'md', documentId: 'd', bilingual: { documentId: 't' }, timestamps: true },
      }).success,
    ).toBe(true);
    expect(render.safeParse({ videoId: 'v', settings: { kind: 'subtitles', format: 'srt', ranges: [{ start: 0, end: 1 }] } }).success).toBe(
      true,
    );
    for (const settings of [
      { kind: 'audio', format: 'wav' },
      { kind: 'video', format: 'mp4' },
      { kind: 'portable' },
      { kind: 'project', format: 'xmeml' },
    ]) {
      expect(render.safeParse({ videoId: 'v', settings }).success).toBe(false);
    }
    expect(render.safeParse({ videoId: 'v', settings: { kind: 'transcript', format: 'md' }, destination: { dir: '/tmp' } }).success).toBe(
      false,
    );
    expect(
      render.safeParse({
        videoId: 'v',
        settings: { kind: 'transcript', format: 'md', range: { start: 0, end: 1 }, ranges: [{ start: 0, end: 1 }] },
      }).success,
    ).toBe(false);
  });

  it('transcript options (heading, chapters, speakers, skipping cut parts) belong only to transcripts, subtitles don\'t accept them', () => {
    const create = methodParamSchemas['exports.create'];
    const options = { frontmatter: true, chapters: true, speakers: false, skipCut: false };
    expect(create.safeParse({ videoId: 'v', settings: { kind: 'transcript', format: 'md', ...options } }).success).toBe(true);
    expect(
      methodParamSchemas['exports.renderText'].safeParse({ videoId: 'v', settings: { kind: 'transcript', format: 'txt', ...options } })
        .success,
    ).toBe(true);
    expect(create.safeParse({ videoId: 'v', settings: { kind: 'transcript', format: 'md', chapters: 'yes' } }).success).toBe(false);
    for (const [key, value] of Object.entries(options)) {
      expect(create.safeParse({ videoId: 'v', settings: { kind: 'subtitles', format: 'srt', [key]: value } }).success).toBe(false);
    }
  });

  it('transcript timestamps: under one hour mm:ss, one hour or more hh:mm:ss (two-digit hours), rounded down, negative and non-numeric are 00:00', () => {
    expect([0, 59.9, 65.9, 3599.99, 3600, 3725.2, 36000, 360000, -2, Number.NaN].map(transcriptStamp)).toEqual([
      '00:00',
      '00:59',
      '01:05',
      '59:59',
      '01:00:00',
      '01:02:05',
      '10:00:00',
      '100:00:00',
      '00:00',
      '00:00',
    ]);
  });

  it('loudness target: default value matches the schema; integrated loudness -70 to 0 LUFS, true peak -20 to 0 dBTP, other fields not accepted', () => {
    const create = methodParamSchemas['exports.create'];
    const audio = (loudness: unknown) => create.safeParse({ videoId: 'v', settings: { kind: 'audio', format: 'wav', loudness } }).success;
    expect(audio(DEFAULT_LOUDNESS_TARGET)).toBe(true);
    expect(audio({ integratedLufs: 0, truePeakDb: -20 })).toBe(true);
    expect(audio({ integratedLufs: -70, truePeakDb: 0 })).toBe(true);
    expect(audio({ integratedLufs: 0.5, truePeakDb: -1 })).toBe(false);
    expect(audio({ integratedLufs: -16, truePeakDb: -20.5 })).toBe(false);
    expect(audio({ integratedLufs: -16, truePeakDb: -1, lra: 11 })).toBe(false);
    expect(audio(null)).toBe(true);
  });

  it('subtitle languages of the finished video: burned-in subtitle tracks top to bottom, deduplicated; hidden tracks, tracks shown separately, disabled instances and documents without a language don\'t count', () => {
    const track = (id: string, order: number, extra: Record<string, unknown> = {}) => ({
      id,
      order,
      kind: 'subtitle' as const,
      locked: false,
      visible: true,
      muted: false,
      solo: { enabled: false, group: 'visual' as const },
      ...extra,
    });
    const caption = (id: string, trackId: string, documentId: string, enabled = true) =>
      ({ id, trackId, type: 'caption', enabled, documentId, span: { fromFrame: 0, durationFrames: 30 } }) as never;
    const documents = { zh: { language: 'zh-Hans' }, en: { language: 'en' }, en2: { language: 'en' }, none: {}, ja: { language: 'ja' } };
    const sequence = {
      tracks: [track('low', 1), track('high', 3), track('hidden', 5, { visible: false }), track('off', 4)],
      items: [
        caption('a', 'low', 'zh'),
        caption('b', 'high', 'en'),
        caption('c', 'high', 'en2'),
        caption('d', 'hidden', 'ja'),
        caption('e', 'off', 'ja', false),
        caption('f', 'low', 'none'),
      ],
    };
    expect(burnedCaptionLanguages(sequence, documents)).toEqual(['en', 'zh-Hans']);
    const solo = { ...sequence, tracks: sequence.tracks.map((t) => (t.id === 'low' ? { ...t, solo: { enabled: true, group: 'visual' as const } } : t)) };
    expect(burnedCaptionLanguages(solo, documents)).toEqual(['zh-Hans']);
    expect(burnedCaptionLanguages({ tracks: [], items: [] }, documents)).toEqual([]);
  });
});
