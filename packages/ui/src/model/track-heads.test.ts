import { describe, expect, it } from 'vitest';
import { captionItem, documentRecord, sequence, track, videoItem } from '../testing/sequence-records.ts';
import { headTags, languageTag, subtitleTrackLanguage } from './track-heads.ts';

describe('track header language label', () => {
  it('trims whitespace, replaces underscores with hyphens, uppercases; no language is an empty string', () => {
    expect(languageTag(' zh-Hans ')).toBe('ZH-HANS');
    expect(languageTag('pt_BR')).toBe('PT-BR');
    expect(languageTag(null)).toBe('');
  });

  it('same kind and label are numbered in order; subtitles and dubbing are counted separately; no-language ones are not written', () => {
    const tags = headTags([
      { trackId: 's1', group: 'subtitle', language: 'en' },
      { trackId: 's2', group: 'subtitle', language: 'zh-Hans' },
      { trackId: 's3', group: 'subtitle', language: 'EN' },
      { trackId: 'd1', group: 'dub', language: 'en' },
      { trackId: 's4', group: 'subtitle', language: null },
    ]);
    expect([...tags]).toEqual([
      ['s1', 'EN 1'],
      ['s2', 'ZH-HANS'],
      ['s3', 'EN 2'],
      ['d1', 'EN'],
    ]);
  });
});

describe('subtitle row language', () => {
  const documents = {
    tr: documentRecord('tr', 'transcript', '转写', { language: 'zh-Hans' }),
    tl: documentRecord('tl', 'translation', '英文译文', { language: 'en' }),
    capO: documentRecord('capO', 'captions', '原文字幕', { sourceDocumentId: 'tr' }),
    capT: documentRecord('capT', 'captions', '英文字幕', { sourceDocumentId: 'tl', language: 'en' }),
  };
  const s1 = track('s1', 'subtitle', 2);
  const s2 = track('s2', 'subtitle', 3);
  const s3 = track('s3', 'subtitle', 4);
  const seq = sequence(
    [track('v1', 'visual', 1), s1, s2, s3],
    [videoItem('v', 'v1', 0, 300), captionItem('c2', 's1', 'capO', 150, 150), captionItem('c1', 's1', 'capO', 0, 150), captionItem('c3', 's2', 'capT')],
  );

  it('when original subtitles have no language, uses the transcription language; translation is judged from the derived translation', () => {
    expect(subtitleTrackLanguage(seq, s1, documents)).toEqual({ language: 'zh-Hans', kind: 'original' });
    expect(subtitleTrackLanguage(seq, s2, documents)).toEqual({ language: 'en', kind: 'translation' });
  });

  it('none when there is no subtitle instance on the track', () => {
    expect(subtitleTrackLanguage(seq, s3, documents)).toBeNull();
  });
});
