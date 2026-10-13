import { describe, expect, it } from 'vitest';
import { formatVideoSelection, parseIdList, parseLibraryName, parseSpeakerVoice } from './library-output.ts';

describe('cuccut library arguments and output', () => {
  it('only three library names are accepted', () => {
    expect(parseLibraryName('voices')).toBe('voices');
    expect(() => parseLibraryName('fonts')).toThrow('没有这个库：fonts');
    expect(() => parseLibraryName(undefined)).toThrow('缺少');
  });
});

describe('library entries enabled in a video', () => {
  it('--speaker-voice: transcript:speaker=voice, provider voices carry @Provider', () => {
    expect(parseSpeakerVoice('doc_s:S1=library:voice_a')).toEqual({ documentId: 'doc_s', speakerId: 'S1', voice: 'library:voice_a' });
    expect(parseSpeakerVoice('doc_s:S2=pNInz6obpg@elevenlabs')).toEqual({
      documentId: 'doc_s',
      speakerId: 'S2',
      voice: 'pNInz6obpg',
      providerId: 'elevenlabs',
    });
    expect(() => parseSpeakerVoice('doc_s=voice')).toThrow(/格式/);
    expect(() => parseSpeakerVoice('doc_s:S1=')).toThrow(/格式/);
    expect(parseIdList('glo_1, glo_2,,')).toEqual(['glo_1', 'glo_2']);
    expect(parseIdList('')).toEqual([]);
  });

  it('display: glossary of each step and the speakers\' voices', () => {
    expect(
      formatVideoSelection({
        videoId: 'vid_1',
        documentId: 'doc_l',
        revision: 'r2',
        selection: {
          glossaries: { transcribe: [], translate: ['glo_1'] },
          speakerVoices: [{ documentId: 'doc_s', speakerId: 'S1', voice: 'v1', providerId: 'elevenlabs' }],
        },
      }),
    ).toEqual([
      '视频 vid_1（library-selection 文档 doc_l 版本 r2）',
      '转写用术语表：（无）',
      '翻译用术语表：glo_1',
      '说话人的音色：doc_s:S1 = v1（只在 elevenlabs 上）',
    ]);
  });
});
