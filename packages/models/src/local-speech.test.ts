import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FrozenSpeechReference, ModelBundleStatus, SynthesizeSpeechRequest } from '@cuccut/protocol';
import { speechParameters } from './generation-options.ts';
import {
  builtinReferenceFile,
  freezeReferenceFile,
  frozenVoiceOf,
  localSpeechModelInfo,
  planLocalVoice,
  synthesizeRunOf,
  type LocalVoicePlan,
} from './local-speech.ts';
import type { ModelChoice } from './model-selection.ts';
import { SPEECH_BUNDLES } from './speech-bundles.ts';
import {
  inspectWav,
  SPEECH_SELF_TEST_LIMITS,
  SPEECH_SELF_TEST_SENTENCES,
  speechSelfTestRequest,
  speechSelfTestVerdict,
} from './speech-self-test.ts';
import { builtinVoice, builtinVoiceFile } from './speech-voices.ts';

/** Submission-time checks and freezing for local synthesis (architecture design §6.1, §6.6), and the self-test verdict (Model Worker protocol spec §4.3). */

const status = { detail: undefined } as unknown as ModelBundleStatus;
const def = (id: string) => SPEECH_BUNDLES.find((b) => b.bundleId === id)!;
const local = (id: string): ModelChoice<'synthesizeSpeech'> => ({
  capability: 'synthesizeSpeech',
  providerId: 'local',
  modelId: id,
  kind: 'local',
  label: 'local',
  source: 'explicit',
  model: localSpeechModelInfo(def(id), status, true),
});
const BASE = local('qwen3-tts-0.6b-base@mlx-8bit');
const CUSTOM = local('qwen3-tts-1.7b-customvoice@mlx-8bit');
const DESIGN = local('qwen3-tts-1.7b-voicedesign@mlx-8bit');
const INDEX = local('indextts2@mlx-fp16');
const VOX = local('voxcpm2@mlx-int8');
const OMNI = local('omnivoice@mlx-int8');

const invalid = (details?: Record<string, unknown>) =>
  expect.objectContaining({ code: 'invalid-request', ...(details ? { details: expect.objectContaining(details) } : {}) });

const plan = (choice: ModelChoice<'synthesizeSpeech'>, request: Partial<SynthesizeSpeechRequest>) =>
  planLocalVoice(choice, { text: '你好', ...request });

const REFERENCE: FrozenSpeechReference = {
  source: 'file',
  path: '/r.wav',
  sha256: `sha256:${'a'.repeat(64)}`,
  byteLength: 10,
  transcript: null,
};

describe('planLocalVoice', () => {
  it('no voice specified: a built-in voice is picked by the requested language (the first one when none matches); speaker models use the default speaker', () => {
    expect(plan(BASE, { language: 'ja-JP' })).toMatchObject({ mode: 'preset', voice: 'ja-female', builtin: { id: 'ja-female' } });
    expect(plan(BASE, { language: 'sw' })).toMatchObject({ mode: 'preset', voice: 'zh-female' });
    expect(plan(BASE, {})).toMatchObject({ mode: 'preset', voice: 'zh-female' });
    expect(plan(CUSTOM, {})).toEqual({ mode: 'preset', voice: 'Vivian', builtin: null });
    expect(plan(CUSTOM, { voice: 'Ryan' })).toEqual({ mode: 'preset', voice: 'Ryan', builtin: null });
    expect(plan(BASE, { voice: 'en-male' })).toMatchObject({ mode: 'preset', voice: 'en-male', builtin: { id: 'en-male' } });
  });

  it('cloning: a file or voice-library entry; the source text is given only to models that read source text', () => {
    expect(plan(BASE, { reference: { file: '/r.wav', transcript: '  原文 ' } })).toEqual({
      mode: 'clone',
      source: 'file',
      path: '/r.wav',
      transcript: '原文',
    });
    expect(plan(BASE, { reference: { file: '/r.wav', transcript: '   ' } })).toMatchObject({ transcript: null });
    expect(plan(BASE, { voice: 'library:vce_1' })).toEqual({ mode: 'clone', source: 'library', libraryId: 'vce_1' });
    expect(plan(INDEX, { reference: { file: '/r.wav' } })).toMatchObject({ mode: 'clone', transcript: null });
    expect(() => plan(INDEX, { reference: { file: '/r.wav', transcript: '原文' } })).toThrow(invalid());
  });

  it('description: free text or a closed vocabulary (at most one item per category, English is case-insensitive, and full-width commas also count as separators)', () => {
    expect(plan(DESIGN, { voiceDescription: ' a calm narrator ' })).toEqual({ mode: 'describe', description: 'a calm narrator' });
    expect(plan(OMNI, { voiceDescription: 'Female, low pitch，四川话' })).toMatchObject({ mode: 'describe' });
    expect(() => plan(OMNI, { voiceDescription: 'female, robot' })).toThrow(invalid({ term: 'robot' }));
    expect(() => plan(OMNI, { voiceDescription: 'female, male' })).toThrow(invalid({ category: 'gender' }));
    expect(() => plan(OMNI, { voiceDescription: ' , ' })).toThrow(invalid());
    expect(() => plan(DESIGN, { voiceDescription: '  ' })).toThrow(invalid());
  });

  it('a method the model cannot do and a voice that does not exist are both rejected without switching voice; only one of the three voice kinds may be given', () => {
    expect(() => plan(CUSTOM, { reference: { file: '/r.wav' } })).toThrow(invalid({ voiceMode: 'clone' }));
    expect(() => plan(CUSTOM, { voice: 'library:vce_1' })).toThrow(invalid({ voiceMode: 'clone' }));
    expect(() => plan(BASE, { voiceDescription: 'calm' })).toThrow(invalid({ voiceMode: 'describe' }));
    expect(() => plan(DESIGN, { reference: { file: '/r.wav' } })).toThrow(invalid({ voiceMode: 'clone' }));
    expect(() => plan(CUSTOM, { voice: 'alloy' })).toThrow(invalid({ voices: expect.arrayContaining(['Vivian']) }));
    expect(() => plan(BASE, { voice: 'Vivian' })).toThrow(invalid());
    expect(() => plan(BASE, { voice: 'zh-female', reference: { file: '/r.wav' } })).toThrow(invalid());
    expect(() => plan(OMNI, { reference: { file: '/r.wav' }, voiceDescription: 'female' })).toThrow(invalid());
  });

  it('built-in voices: clone models need their recording, describe models do not; the frozen voice records its source', () => {
    const preset = plan(BASE, { voice: 'en-female' });
    expect(builtinReferenceFile(BASE.model, preset)).toMatchObject({
      source: 'builtin',
      path: builtinVoiceFile(builtinVoice('en-female')!),
    });
    expect(builtinReferenceFile(DESIGN.model, plan(DESIGN, { voice: 'en-female' }))).toBeNull();
    expect(builtinReferenceFile(CUSTOM.model, plan(CUSTOM, {}))).toBeNull();
    const cases: Array<[LocalVoicePlan, string]> = [
      [preset, 'en-female'],
      [{ mode: 'clone', source: 'file', path: '/r.wav', transcript: null }, 'reference'],
      [{ mode: 'clone', source: 'library', libraryId: 'vce_1' }, 'library:vce_1'],
      [{ mode: 'describe', description: 'x' }, 'description'],
    ];
    for (const [p, voice] of cases) expect(frozenVoiceOf(p)).toBe(voice);
  });
});

describe('speechParameters (local models)', () => {
  const freeze = (choice: ModelChoice<'synthesizeSpeech'>, request: SynthesizeSpeechRequest, reference: FrozenSpeechReference | null) =>
    speechParameters(choice, request, { plan: planLocalVoice(choice, request), reference });

  it('cloning: the reference recording is frozen into the parameters; text is kept as-is (pronunciation markup is handled by the engine)', () => {
    const text = '重(chong2)新开始';
    const parameters = freeze(BASE, { text, reference: { file: '/r.wav' } }, REFERENCE);
    expect(parameters).toEqual({
      capability: 'synthesizeSpeech',
      text,
      voice: 'reference',
      language: null,
      format: 'wav',
      instructions: null,
      speed: null,
      seed: null,
      voiceMode: 'clone',
      reference: REFERENCE,
    });
  });

  it('a reference recording needed but not frozen: a programming error', () => {
    expect(() => freeze(BASE, { text: 'x', voice: 'en-female' }, null)).toThrow(/was not frozen/);
    expect(() => freeze(BASE, { text: 'x', reference: { file: '/r.wav' } }, null)).toThrow(/was not frozen/);
  });

  it('VoiceDesign built-in voices are frozen to their description; speaker models carry no reference recording', () => {
    expect(freeze(DESIGN, { text: 'x', voice: 'en-male' }, null)).toMatchObject({
      voice: 'en-male',
      voiceMode: 'preset',
      voiceDescription: builtinVoice('en-male')!.description,
    });
    const custom = freeze(CUSTOM, { text: 'x', voice: 'Eric', instructions: ' 慢一点 ' }, null);
    expect(custom).toMatchObject({ voice: 'Eric', voiceMode: 'preset', instructions: '慢一点' });
    expect(custom).not.toHaveProperty('reference');
  });

  it('knobs are checked against the model\'s range; knobs the model does not have are rejected', () => {
    const omni = freeze(OMNI, { text: 'x', voiceDescription: 'male', speed: 1.2, cfg: 3, steps: 16, seed: 9 }, null);
    expect(omni).toMatchObject({ voiceMode: 'describe', voiceDescription: 'male', speed: 1.2, cfg: 3, steps: 16, seed: 9 });
    expect(() => freeze(OMNI, { text: 'x', voiceDescription: 'male', steps: 100 }, null)).toThrow(invalid());
    expect(() => freeze(VOX, { text: 'x', voice: 'en-female', speed: 1 }, REFERENCE)).toThrow(invalid());
    expect(() => freeze(BASE, { text: 'x', voice: 'en-female', cfg: 2 }, REFERENCE)).toThrow(invalid());
    expect(() => freeze(BASE, { text: 'x', voice: 'en-female', instructions: '慢' }, REFERENCE)).toThrow(invalid());
    expect(() => freeze(BASE, { text: 'x', voice: 'en-female', format: 'mp3' }, REFERENCE)).toThrow(invalid());
    expect(() => freeze(BASE, { text: 'x', voice: 'en-female', language: 'sw' }, REFERENCE)).toThrow(invalid());
    expect(() => freeze(BASE, { text: 'x'.repeat(2001), voice: 'en-female' }, REFERENCE)).toThrow(invalid({ limit: 2000 }));
  });

  it('online models do not accept fields that exist only for local models', () => {
    const online: ModelChoice<'synthesizeSpeech'> = {
      ...BASE,
      providerId: 'openai',
      kind: 'online',
      model: { ...BASE.model, local: undefined, voices: [{ voiceId: 'alloy', label: 'Alloy' }], defaultVoice: 'alloy' },
    };
    expect(() => speechParameters(online, { text: 'x', reference: { file: '/r.wav' } })).toThrow(invalid());
    expect(() => speechParameters(online, { text: 'x', voiceDescription: 'calm' })).toThrow(invalid());
    expect(() => speechParameters(online, { text: 'x', cfg: 1 })).toThrow(invalid());
    expect(() => speechParameters(online, { text: 'x', steps: 4 })).toThrow(invalid());
  });
});

describe('synthesizeRunOf', () => {
  const common = { text: 't', language: 'en', instructions: null, speed: null, seed: 3 };
  it('a reference recording is clone (built-in voices too), a description is describe, and everything else is preset', () => {
    expect(synthesizeRunOf({ ...common, voice: 'en-female', reference: { ...REFERENCE, source: 'builtin', transcript: '原文' } })).toEqual({
      input: { file: '/r.wav', contentHash: REFERENCE.sha256, track: 0 },
      options: {
        text: 't',
        language: 'en',
        voice: { mode: 'clone', transcript: '原文' },
        instructions: null,
        speed: null,
        cfg: null,
        steps: null,
        seed: 3,
      },
    });
    expect(synthesizeRunOf({ ...common, voice: 'description', voiceDescription: 'calm', cfg: 2, steps: 8 })).toMatchObject({
      input: null,
      options: { voice: { mode: 'describe', description: 'calm' }, cfg: 2, steps: 8 },
    });
    expect(synthesizeRunOf({ ...common, voice: 'Vivian' })).toMatchObject({
      input: null,
      options: { voice: { mode: 'preset', id: 'Vivian' } },
    });
  });
});

describe('freezeReferenceFile', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-local-speech-'));
  });
  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('reads the summary and length; when unreadable (missing, or a directory) it is invalid-request', async () => {
    const file = path.join(dir, 'ref.wav');
    await fs.writeFile(file, 'reference bytes');
    expect(await freezeReferenceFile({ source: 'file', path: file, transcript: '原文' })).toEqual({
      source: 'file',
      path: file,
      sha256: `sha256:${crypto.createHash('sha256').update('reference bytes').digest('hex')}`,
      byteLength: 15,
      transcript: '原文',
    });
    const missing = path.join(dir, 'missing.wav');
    await expect(freezeReferenceFile({ source: 'file', path: missing, transcript: null })).rejects.toMatchObject({
      code: 'invalid-request',
      message: expect.stringContaining('参考录音「missing.wav」读不出来'),
      details: { code: 'INPUT_UNREADABLE', reference: 'file', file: missing },
    });
    await expect(freezeReferenceFile({ source: 'file', path: dir, transcript: null })).rejects.toMatchObject({
      code: 'invalid-request',
      details: { code: 'INPUT_UNREADABLE', file: dir },
    });
  });

  it('an unreadable built-in voice recording means an incomplete installation (APP_FILE_MISSING), and the message contains no path', async () => {
    const voice = builtinVoice('en-male')!;
    const builtin = { source: 'builtin' as const, voiceId: voice.id, asset: voice.asset, transcript: null };
    const gone = path.join(dir, 'gone', 'en-male.wav');
    for (const file of [gone, null]) {
      const error = await freezeReferenceFile({ ...builtin, path: file }).catch((e: unknown) => e);
      expect(error).toMatchObject({
        code: 'conflict',
        message: expect.stringContaining('重新安装 CucCut'),
        details: { code: 'APP_FILE_MISSING', asset: 'tts-voices/en-male.wav', file },
      });
      expect((error as Error).message).not.toContain(dir);
    }
  });

  it('all built-in voice recordings shipped with the app are present', async () => {
    const voice = builtinVoice('zh-female')!;
    const frozen = await freezeReferenceFile({
      source: 'builtin',
      voiceId: voice.id,
      asset: voice.asset,
      path: builtinVoiceFile(voice),
      transcript: voice.transcript,
    });
    expect(frozen.byteLength).toBeGreaterThan(1000);
    expect(speechSelfTestVerdict(await fs.readFile(builtinVoiceFile(voice)!))).toMatchObject({ passed: true });
  });
});

/** Synthesize a WAV: `sample(i)` is the sample in -1..1. */
function wav(options: {
  seconds: number;
  rate?: number;
  channels?: number;
  bits?: 16 | 24 | 32;
  float?: boolean;
  sample?: (i: number) => number;
}) {
  const { seconds, rate = 24_000, channels = 1, bits = 16, float = false, sample = (i) => Math.sin(i / 10) * 0.25 } = options;
  const frames = Math.round(seconds * rate);
  const width = bits / 8;
  const data = Buffer.alloc(frames * channels * width);
  for (let i = 0; i < frames * channels; i++) {
    const value = sample(i);
    if (float) data.writeFloatLE(value, i * width);
    else if (bits === 16) data.writeInt16LE(Math.round(value * 32_767), i * width);
    else if (bits === 24) data.writeIntLE(Math.round(value * 8_388_607), i * width, 3);
    else data.writeInt32LE(Math.round(value * 2_147_483_647), i * width);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(float ? 3 : 1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * channels * width, 28);
  header.writeUInt16LE(channels * width, 32);
  header.writeUInt16LE(bits, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

describe('self-check verdicts', () => {
  it('passes only if it decodes, has a reasonable duration, and contains sound', () => {
    expect(speechSelfTestVerdict(wav({ seconds: 1 }))).toMatchObject({
      passed: true,
      wav: { sampleRate: 24_000, channels: 1, bitsPerSample: 16, encoding: 'pcm', durationSec: 1 },
    });
    expect(speechSelfTestVerdict(wav({ seconds: 1.5, rate: 48_000, channels: 2, float: true, bits: 32 }))).toMatchObject({
      passed: true,
      wav: { encoding: 'float', channels: 2, durationSec: 1.5 },
    });
    expect(speechSelfTestVerdict(wav({ seconds: 0.5, rate: 22_050, bits: 24 }))).toMatchObject({ passed: true });
    expect(speechSelfTestVerdict(wav({ seconds: 0.5, bits: 32 }))).toMatchObject({ passed: true });
  });

  it('silent, too short, too long, or not a WAV fails', () => {
    expect(speechSelfTestVerdict(wav({ seconds: 1, sample: () => 0 }))).toMatchObject({ passed: false, problem: '输出是静音' });
    // -70 dBFS also counts as silence.
    expect(speechSelfTestVerdict(wav({ seconds: 1, sample: (i) => (i % 2 ? 1 : -1) * 10 ** (-70 / 20) }))).toMatchObject({ passed: false });
    expect(speechSelfTestVerdict(wav({ seconds: SPEECH_SELF_TEST_LIMITS.minDurationSec / 2 }))).toMatchObject({
      passed: false,
      problem: expect.stringMatching(/时长/),
    });
    expect(speechSelfTestVerdict(wav({ seconds: 31, rate: 8_000 }))).toMatchObject({
      passed: false,
      problem: expect.stringMatching(/时长/),
    });
    expect(speechSelfTestVerdict(Buffer.from('ID3 not a wav'))).toMatchObject({
      passed: false,
      problem: expect.stringMatching(/不能解码/),
    });
  });

  it('clipping: fails when samples at full scale exceed 0.1%; a peak near full scale that does not clip at the top passes as usual', () => {
    const square = speechSelfTestVerdict(wav({ seconds: 1, sample: (i) => (i % 2 ? 1 : -1) * 0.6 }));
    expect(square).toMatchObject({ passed: true, wav: { clippedRatio: 0 } });
    // 24 samples at full scale in one second (0.1%) still passes; more than that is clipping.
    const edge = (count: number) => wav({ seconds: 1, sample: (i) => (i < count ? 1 : Math.sin(i / 10) * 0.25) });
    expect(speechSelfTestVerdict(edge(24))).toMatchObject({ passed: true, wav: { peak: expect.closeTo(1, 3) } });
    expect(speechSelfTestVerdict(edge(25))).toMatchObject({ passed: false, problem: expect.stringMatching(/^输出削波：/) });
    const hot = speechSelfTestVerdict(wav({ seconds: 1, sample: (i) => Math.max(-1, Math.min(1, Math.sin(i / 10) * 1.5)) }));
    expect(hot).toMatchObject({ passed: false, problem: expect.stringMatching(/削波/), wav: { clippedRatio: expect.any(Number) } });
    expect(hot.wav!.clippedRatio).toBeGreaterThan(0.3);
    expect(speechSelfTestVerdict(wav({ seconds: 1, sample: (i) => Math.sin(i / 10) * 0.95, float: true, bits: 32 }))).toMatchObject({
      passed: true,
      wav: { clippedRatio: 0 },
    });
  });

  it('inspectWav recognises bad headers: missing data chunk, unsupported encoding and channel count', () => {
    const good = wav({ seconds: 0.1 });
    expect(inspectWav(good.subarray(0, 36))).toEqual({ ok: false, problem: '缺少 data 块' });
    const alaw = Buffer.from(good);
    alaw.writeUInt16LE(6, 20);
    expect(inspectWav(alaw)).toMatchObject({ ok: false, problem: expect.stringMatching(/编码/) });
    const many = Buffer.from(good);
    many.writeUInt16LE(6, 22);
    expect(inspectWav(many)).toMatchObject({ ok: false, problem: expect.stringMatching(/声道/) });
    const bits = Buffer.from(good);
    bits.writeUInt16LE(8, 34);
    expect(inspectWav(bits)).toMatchObject({ ok: false, problem: expect.stringMatching(/位深/) });
  });

  it('self-check sentence: the first language with a sentence that the model lists; English when any language is accepted', () => {
    expect(speechSelfTestRequest(def('qwen3-tts-0.6b-base@mlx-8bit'))).toEqual({ text: SPEECH_SELF_TEST_SENTENCES.zh, language: 'zh' });
    expect(speechSelfTestRequest(def('omnivoice@mlx-int8'))).toEqual({ text: SPEECH_SELF_TEST_SENTENCES.en, language: 'en' });
    const swahili = { ...def('gpt-sovits-v2@mlx-fp16'), speech: { ...def('gpt-sovits-v2@mlx-fp16').speech!, languages: ['sw', 'ar'] } };
    expect(speechSelfTestRequest(swahili)).toEqual({ text: SPEECH_SELF_TEST_SENTENCES.ar, language: 'ar' });
    const none = { ...swahili, speech: { ...swahili.speech, languages: ['sw'] } };
    expect(speechSelfTestRequest(none)).toEqual({ text: SPEECH_SELF_TEST_SENTENCES.en, language: 'en' });
  });
});
