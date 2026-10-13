import { describe, expect, it } from 'vitest';
import type { JobRecord, LibraryEntrySummary } from '@cuccut/protocol';
import { fixtureView } from './models-test-fixtures.ts';
import {
  cloneProviders,
  cloneRows,
  createVoiceRequest,
  deleteBody,
  editVoiceRequest,
  errorText,
  formForFile,
  formFromEntry,
  isVoiceAudioPath,
  rpcErrorText,
  validateVoiceForm,
  voiceChips,
  voiceLanguageOptions,
  voiceMeta,
  voicePackageName,
  voiceConsentStatement,
  type CloneProvider,
  type VoiceEntry,
} from './voices-library.ts';

const ELEVEN: CloneProvider = { providerId: 'elevenlabs', label: 'ElevenLabs', available: true, detail: null };

function summary(patch: Partial<LibraryEntrySummary> = {}): LibraryEntrySummary {
  return {
    library: 'voices',
    id: 'voc_1',
    version: 3,
    contentHash: 'sha256:c',
    name: '主播',
    kind: 'voice',
    updatedAt: '2026-10-03T08:00:00.000Z',
    consentDeclared: true,
    clones: [],
    ...patch,
  };
}

function entry(patch: Partial<VoiceEntry['content']> = {}): VoiceEntry {
  return {
    library: 'voices',
    id: 'voc_1',
    version: 3,
    contentHash: 'sha256:c',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-03T08:00:00.000Z',
    content: {
      name: '主播',
      language: 'zh-CN',
      transcript: '大家好，欢迎收看。',
      origin: 'imported',
      consent: { declared: true, declaredAt: '2026-10-01T00:00:00.000Z', statement: '我本人的声音（旧的说法）' },
      reference: { sha256: 'sha256:r', byteLength: 240 * 1024, mediaType: 'audio/wav', fileName: 'ref.wav' },
      ...patch,
    },
  };
}

function cloneJob(patch: Partial<JobRecord>): JobRecord {
  return {
    jobId: 'job_1',
    kind: 'voiceClone',
    state: 'running',
    providerId: 'elevenlabs',
    library: { entries: [{ library: 'voices', id: 'voc_1', version: 3, contentHash: 'sha256:c' }] },
    createdAt: '2026-10-03T08:00:00.000Z',
    error: null,
    ...patch,
  } as JobRecord;
}

describe('cloneable providers', () => {
  it('lists only registered, cloneable ones; when unavailable, includes the Runtime\'s explanation', () => {
    expect(cloneProviders(fixtureView())).toEqual([{ providerId: 'elevenlabs', label: 'ElevenLabs', available: false, detail: '没有启用' }]);
    expect(cloneProviders(null)).toEqual([]);
  });
});

describe('a voice\'s clones across providers', () => {
  it('no clone, declared, provider available: can upload', () => {
    const [row] = cloneRows(summary(), [ELEVEN], []);
    expect(row).toMatchObject({ providerId: 'elevenlabs', state: 'none', running: false, failure: null, create: { enabled: true, why: null }, removable: false });
  });

  it('no self-declaration: cannot upload, explains why', () => {
    const [row] = cloneRows(summary({ consentDeclared: false }), [ELEVEN], []);
    expect(row!.create).toMatchObject({ enabled: false });
    expect(row!.create!.why).toContain('不上传到第三方');
  });

  it('provider not enabled: cannot upload, with the Runtime\'s explanation', () => {
    const [row] = cloneRows(summary(), [{ ...ELEVEN, available: false, detail: '没有设置密钥' }], []);
    expect(row!.create!.enabled).toBe(false);
    expect(row!.create!.why).toContain('没有设置密钥');
  });

  it('a valid clone no longer offers upload; an expired one can be re-uploaded or deleted', () => {
    const [valid] = cloneRows(summary({ clones: [{ providerId: 'elevenlabs', state: 'valid' }] }), [ELEVEN], []);
    expect(valid).toMatchObject({ state: 'valid', create: null, removable: true });
    const [stale] = cloneRows(summary({ clones: [{ providerId: 'elevenlabs', state: 'stale' }] }), [ELEVEN], []);
    expect(stale).toMatchObject({ state: 'stale', create: { enabled: true }, removable: true });
  });

  it('running clone job: cannot upload or delete; only counts jobs for this voice and this provider', () => {
    const other = cloneJob({ jobId: 'job_x', library: { entries: [{ library: 'voices', id: 'voc_2', version: 1, contentHash: 'sha256:x' }] } });
    expect(cloneRows(summary(), [ELEVEN], [other])[0]!.running).toBe(false);
    const [row] = cloneRows(summary({ clones: [{ providerId: 'elevenlabs', state: 'stale' }] }), [ELEVEN], [cloneJob({})]);
    expect(row).toMatchObject({ running: true, removable: false, create: { enabled: false } });
  });

  it('last attempt failed and no clone was created afterward: gives the reason and a remedy', () => {
    const failed = cloneJob({
      state: 'failed',
      error: { code: 'GRANT_REQUIRED', message: '把音频交给 ElevenLabs 需要用户授权', details: { remedy: { hint: '请在设置里发放授权' } } },
    } as Partial<JobRecord>);
    expect(cloneRows(summary(), [ELEVEN], [failed])[0]!.failure).toBe('把音频交给 ElevenLabs 需要用户授权。请在设置里发放授权');
    // When a valid clone already exists, do not show an old failure.
    expect(cloneRows(summary({ clones: [{ providerId: 'elevenlabs', state: 'valid' }] }), [ELEVEN], [failed])[0]!.failure).toBeNull();
  });

  it('providers recorded in the entry but not registered by this Runtime are also listed, so they can be deleted', () => {
    const rows = cloneRows(summary({ clones: [{ providerId: 'minimax', state: 'valid' }] }), [ELEVEN], []);
    expect(rows.map((r) => r.providerId)).toEqual(['elevenlabs', 'minimax']);
    expect(rows[1]).toMatchObject({ label: 'minimax', removable: true, create: null });
  });
});

describe('row display', () => {
  it('label: whether self is unspecified, each provider\'s clone status', () => {
    expect(voiceChips(summary({ consentDeclared: false, clones: [{ providerId: 'elevenlabs', state: 'stale' }] }), [ELEVEN])).toEqual([
      { label: '未说明是否本人', tone: 'neutral' },
      { label: 'ElevenLabs 克隆已过期', tone: 'notice' },
    ]);
    expect(voiceChips(summary({ clones: [{ providerId: 'elevenlabs', state: 'valid' }] }), [ELEVEN])).toEqual([{ label: 'ElevenLabs 已克隆', tone: 'positive' }]);
  });

  it('description line: language, format and size, source, when last changed', () => {
    const now = Date.parse('2026-10-03T08:05:00.000Z');
    expect(voiceMeta(entry(), now)).toBe('中文（中国） · WAV 240 KB · 从文件导入 · 5 分钟前改过');
    expect(voiceMeta(entry({ language: null, origin: 'recorded' }), now)).toMatch(/^语言未注明 · WAV 240 KB · 在应用里录的/);
  });
});

describe('create and edit', () => {
  it('create from file: name first uses the file name; the declaration is unchecked by default', () => {
    expect(formForFile('/Users/me/录音/主播 参考.wav')).toEqual({ name: '主播 参考', language: '', transcript: '', consent: false });
  });

  it('validation: name required, at most 200 characters; transcript at most 10000 characters', () => {
    expect(validateVoiceForm({ name: '  ', language: '', transcript: '', consent: false }).name).toBe('给音色起个名字');
    expect(validateVoiceForm({ name: '名'.repeat(201), language: '', transcript: '', consent: false }).name).toContain('200');
    expect(validateVoiceForm({ name: '好', language: '', transcript: '字'.repeat(10_001), consent: false }).transcript).toContain('10000');
    expect(validateVoiceForm({ name: '好', language: '', transcript: '', consent: true })).toEqual({ name: null, transcript: null });
  });

  it('create request: includes the file path, source imported; with the declaration checked it uses a fixed sentence; language is null when unknown', () => {
    expect(createVoiceRequest({ name: ' 主播 ', language: '', transcript: ' 你好 ', consent: true }, '/a/ref.wav')).toEqual({
      library: 'voices',
      content: { name: '主播', language: null, transcript: '你好', origin: 'imported', consent: { declared: true, statement: voiceConsentStatement() } },
      source: { path: '/a/ref.wav' },
    });
  });

  it('edit request: no file, includes the version number; when the declaration is still checked, the original wording is kept (the Runtime then keeps the original declaration time)', () => {
    const e = entry();
    const request = editVoiceRequest({ ...formFromEntry(e), name: '新名字' }, e);
    expect(request).toEqual({
      library: 'voices',
      id: 'voc_1',
      expectedVersion: 3,
      content: {
        name: '新名字',
        language: 'zh-CN',
        transcript: '大家好，欢迎收看。',
        origin: 'imported',
        consent: { declared: true, statement: '我本人的声音（旧的说法）' },
      },
    });
    expect(request).not.toHaveProperty('source');
    expect(editVoiceRequest({ ...formFromEntry(e), consent: false }, e).content).toMatchObject({ consent: { declared: false, statement: null } });
  });

  it('language dropdown: unknown + common; a language in the entry that is not among the common ones is also listed', () => {
    const keys = voiceLanguageOptions('').map((o) => o.key);
    expect(keys[0]).toBe('');
    expect(keys).toContain('zh');
    expect(voiceLanguageOptions('zh-CN').map((o) => o.key)).toContain('zh-CN');
  });

  it('rough file filter when choosing and the default export file name', () => {
    expect(isVoiceAudioPath('/a/b.WAV')).toBe(true);
    expect(isVoiceAudioPath('/a/b.m4a')).toBe(false);
    expect(voicePackageName('主播/旁白: 第 1 版')).toBe('主播 旁白 第 1 版.bcvoice');
    expect(voicePackageName('...')).toBe('voice.bcvoice');
  });
});

describe('deletion and errors', () => {
  it('delete confirmation: when there are clones, says the clones are deleted first; if they cannot be deleted, the voice is not deleted', () => {
    expect(deleteBody(summary(), [ELEVEN])).toBe('用了它的视频下次生成时会退回默认音色；已经生成的配音不受影响。');
    expect(deleteBody(summary({ clones: [{ providerId: 'elevenlabs', state: 'stale' }] }), [ELEVEN])).toContain('会先删掉 ElevenLabs 上的克隆');
  });

  it('error codes get a line on what to do; unrecognized ones use the Runtime\'s remedy', () => {
    expect(errorText('VOICE_CONSENT_REQUIRED', '音色没有授权声明', null)).toContain('勾上声明');
    expect(errorText('CAPABILITY_NOT_CONFIGURED', 'ElevenLabs 没有启用', null)).toContain('云端模型');
    expect(errorText('SOMETHING', '出错了', { remedy: '换一个文件' })).toBe('出错了。换一个文件');
    expect(rpcErrorText(Object.assign(new Error('版本对不上'), { details: { code: 'LIBRARY_VERSION_CONFLICT' } }))).toContain('换成最新的内容');
  });
});
