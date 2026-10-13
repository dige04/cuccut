import { describe, expect, it } from 'vitest';
import type { LibraryEntrySummary, SpeechModelInfo } from '@cuccut/protocol';
import { speechModel } from './models-test-fixtures.ts';
import type { SpeechOption } from './tools-tts.ts';
import { CLONE_NEW, TEMP_REFERENCE, cloneVoiceKey, pickerSelection, voicePickerGroups, voiceValueLine } from './voice-picker.ts';

function option(info: SpeechModelInfo, providerId: string, provider: string): SpeechOption {
  return {
    key: `${providerId}/${info.modelId}`,
    providerId,
    provider,
    modelId: info.modelId,
    label: info.label,
    connected: true,
    usable: true,
    why: null,
    info,
  };
}

function voice(id: string, patch: Partial<LibraryEntrySummary> = {}): LibraryEntrySummary {
  return {
    library: 'voices',
    id,
    version: 1,
    name: `声音 ${id}`,
    contentHash: 'sha256:v',
    kind: 'voice',
    updatedAt: '2026-10-01T00:00:00.000Z',
    consentDeclared: true,
    clones: [],
    ...patch,
  };
}

const openai = option(speechModel('gpt-4o-mini-tts', ['alloy', 'echo']), 'openai', 'OpenAI');
const eleven = option(
  { ...speechModel('eleven_v3', []), voices: [{ voiceId: 'JBFqnCBsd6', label: 'George' }], defaultVoice: 'JBFqnCBsd6' },
  'elevenlabs',
  'ElevenLabs',
);
const cloned = voice('a', { name: '我的播客声', clones: [{ providerId: 'elevenlabs', state: 'valid' }] });
const fresh = voice('b', { name: '新录的' });

describe('grouping', () => {
  it('cloneable provider: default · my voice (greyed out per clone status) + clone new voice · this provider\'s voices · manual entry and one-off', () => {
    const groups = voicePickerGroups(eleven, [cloned, fresh]);
    expect(groups.map((g) => [g.id, g.title])).toEqual([
      ['default', null],
      ['mine', '我的声音'],
      ['presets', 'ElevenLabs 的音色'],
      ['other', '其他'],
    ]);
    expect(groups[0]!.items[0]).toMatchObject({ key: 'default', label: '默认音色', description: 'ElevenLabs 的 George' });
    expect(groups[1]!.items).toEqual([
      { key: 'library:a', label: '我的播客声', description: '已克隆到 ElevenLabs · 用这家的克隆合成', disabled: false },
      { key: 'library:b', label: '新录的', description: '还没在 ElevenLabs 上克隆 · 去我的声音里上传一次', disabled: true },
      { key: CLONE_NEW, label: '克隆新音色…', description: '去设置 › 模型 › 语音合成 › 我的声音录一段或从文件导入', disabled: false },
    ]);
    expect(groups[2]!.items[0]).toEqual({ key: 'preset:JBFqnCBsd6', label: 'George', description: 'JBFqnCBsd6', disabled: false });
    expect(groups[3]!.items.map((i) => [i.key, i.disabled])).toEqual([
      ['custom', false],
      [TEMP_REFERENCE, true],
    ]);
  });

  it('non-cloneable provider: all my voice entries are greyed out with the reason; there is no \'one-off clip\'', () => {
    const groups = voicePickerGroups(openai, [cloned]);
    expect(groups.find((g) => g.id === 'mine')!.items[0]).toMatchObject({ disabled: true, description: 'OpenAI 不能克隆 · 用它的预置音色' });
    expect(groups.find((g) => g.id === 'other')!.items.map((i) => i.key)).toEqual(['custom']);
  });

  it('my voices not yet loaded: that group says \'loading\', and clone new voice can still be clicked', () => {
    const mine = voicePickerGroups(eleven, null).find((g) => g.id === 'mine')!;
    expect(mine.items.map((i) => [i.key, i.disabled])).toEqual([
      ['mine-loading', true],
      [CLONE_NEW, false],
    ]);
  });

  it('model that only accepts preset voices and has no default voice: no default group and no manual entry', () => {
    const presetOnly = option(speechModel('tts-1', ['nova'], { voiceModes: ['preset'], defaultVoice: null }), 'openai', 'OpenAI');
    expect(voicePickerGroups(presetOnly, []).map((g) => g.id)).toEqual(['mine', 'presets']);
  });
});

describe('selection and description', () => {
  it('selected item: a deleted my voice is not selected (shows a placeholder)', () => {
    expect(pickerSelection({ voice: 'library:a' }, eleven, [cloned])).toBe('library:a');
    expect(pickerSelection({ voice: 'library:gone' }, eleven, [cloned])).toBeNull();
    expect(pickerSelection({ voice: 'preset:echo' }, openai, [])).toBe('preset:echo');
    expect(pickerSelection({ voice: 'default' }, openai, [])).toBe('default');
  });

  it('one sentence below the control', () => {
    expect(voiceValueLine({ voice: 'default' }, openai, [])).toBe('不选就用 OpenAI 的默认音色（alloy）');
    expect(voiceValueLine({ voice: 'preset:JBFqnCBsd6' }, eleven, [])).toBe('ElevenLabs 的音色 · JBFqnCBsd6');
    expect(voiceValueLine({ voice: 'library:a' }, eleven, [cloned])).toBe('已克隆到 ElevenLabs · 用这家的克隆合成');
    expect(voiceValueLine({ voice: 'library:b' }, eleven, [fresh])).toBe('还没在 ElevenLabs 上克隆 · 去我的声音里上传一次');
    expect(voiceValueLine({ voice: 'library:gone' }, eleven, [])).toBe('这只音色已经删了 · 换一只，或退回默认');
  });

  it('which voice \'clone voice\' selects first: keeps it if already my voice, otherwise the first voice this provider can use', () => {
    expect(cloneVoiceKey({ voice: 'library:b' }, eleven, [cloned, fresh])).toBe('library:b');
    expect(cloneVoiceKey({ voice: 'default' }, eleven, [fresh, cloned])).toBe('library:a');
    expect(cloneVoiceKey({ voice: 'default' }, openai, [fresh, cloned])).toBe('library:b');
    expect(cloneVoiceKey({ voice: 'default' }, eleven, [])).toBeNull();
  });
});
