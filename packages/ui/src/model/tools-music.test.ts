import { describe, expect, it } from 'vitest';
import { type ModelCapabilitiesView, type MusicModelInfo } from '@cuccut/protocol';
import { fixtureView } from './models-test-fixtures.ts';
import { toolJob } from './tools-test-fixtures.ts';
import {
  BLANK_MUSIC,
  clampDuration,
  soundtrackFor,
  etaText,
  maxOf,
  musicAgainDraft,
  musicFileName,
  musicModelOptions,
  musicProblems,
  musicRecordMeta,
  musicRequest,
  musicRetryRequest,
  musicStatus,
  musicText,
  musicTruncated,
  planningFor,
  planningsOf,
  quickKey,
  quickRequest,
  quickSummary,
  setTarget,
  switchMusicModel,
  tokens,
  type MusicDraft,
  type MusicOption,
} from './tools-music.ts';

// i18n-ignore-start: assertions on the Chinese UI copy
function yue(patch: Partial<MusicModelInfo> = {}): MusicModelInfo {
  return {
    modelId: 'yue2-3b@audio-cpp-q8',
    label: 'YuE2 3B',
    modes: ['song', 'instrumental'],
    maxStyleChars: 2000,
    maxLyricsChars: 4000,
    maxDurationSec: 300,
    defaultDurationSec: 120,
    formats: ['wav'],
    defaultFormat: 'wav',
    acceptsSeed: true,
    cost: 'free-local',
    local: {
      family: 'yue2',
      engine: { id: 'audio-cpp', executable: '/usr/local/bin/audiocpp_cli' },
      sampleRate: 44100,
      lyricLanguages: 'unverified',
      planning: { options: ['off', 'melody', 'full'], default: 'melody' },
      steps: { min: 1, max: 50, step: 1, default: 8 },
      slow: true,
      license: { name: 'CC-BY-NC-4.0', url: 'https://example.test/license', commercialUse: false, summary: 'non-commercial' },
    },
    ...patch,
  };
}

function option(info: MusicModelInfo = yue(), patch: Partial<MusicOption> = {}): MusicOption {
  return {
    key: `local/${info.modelId}`,
    providerId: 'local',
    provider: 'This computer',
    modelId: info.modelId,
    label: info.label,
    connected: true,
    usable: true,
    why: null,
    info,
    local: true,
    ...patch,
  };
}

const draft = (patch: Partial<MusicDraft> = {}): MusicDraft => ({ ...BLANK_MUSIC, model: 'local/yue2-3b@audio-cpp-q8', style: 'lo-fi', ...patch });

describe('request has the same name as GenerateMusicRequest', () => {
  it('instrumental has no lyrics; empty seed is omitted; the cap is 20% above the target', () => {
    expect(musicRequest(draft({ style: ' calm piano ' }), option())).toEqual({
      mode: 'instrumental',
      style: 'calm piano',
      targetDurationSec: 30,
      maxDurationSec: 36,
      planning: 'melody',
      provider: 'local',
      model: 'yue2-3b@audio-cpp-q8',
    });
  });

  it('vocal tracks include lyrics; the seed and hand-edited cap are filled in as given; videoId is given when there is a video', () => {
    const r = musicRequest(draft({ mode: 'song', lyrics: ' 一行歌词 ', seed: '7', maxDurationSec: 40 }), option(), 'vid_1');
    expect(r.lyrics).toBe('一行歌词');
    expect(r.seed).toBe(7);
    expect(r.maxDurationSec).toBe(40);
    expect(r.videoId).toBe('vid_1');
  });

  it('plan maps to a type the model recognizes', () => {
    const only = yue({ local: { ...yue().local!, planning: { options: ['off', 'full'], default: 'full' } } });
    expect(planningsOf(only)).toEqual(['full', 'off']);
    expect(planningFor({ planning: 'melody' }, only)).toBe('full');
    expect(musicRequest(draft(), option(only)).planning).toBe('full');
  });
});

describe('duration', () => {
  it('video duration rounds up to 5 seconds (music is never shorter than the video), clamped to range', () => {
    expect(clampDuration(206)).toBe(210);
    expect(clampDuration(205)).toBe(205);
    expect(clampDuration(3)).toBe(10);
    expect(clampDuration(4000)).toBe(300);
    expect(clampDuration(4000, 120)).toBe(120);
    expect(clampDuration(null)).toBe(30);
  });

  it('generated soundtrack: prefilled with the video length when within the single-run cap; when over, prefilled with the cap and looped (design spec soundtrackFor)', () => {
    expect(soundtrackFor(206)).toEqual({ targetDurationSec: 210, loop: false });
    expect(soundtrackFor(298).targetDurationSec).toBe(300);
    expect(soundtrackFor(300)).toEqual({ targetDurationSec: 300, loop: false });
    expect(soundtrackFor(742)).toEqual({ targetDurationSec: 300, loop: true });
    expect(soundtrackFor(742, 120)).toEqual({ targetDurationSec: 120, loop: true });
    expect(soundtrackFor(null).targetDurationSec).toBe(30);
  });

  it('25 tokens per second; the cap follows the target and does not exceed the model\'s cap', () => {
    expect(tokens(30)).toBe(750);
    expect(maxOf({ targetDurationSec: 30, maxDurationSec: null })).toBe(36);
    expect(maxOf({ targetDurationSec: 300, maxDurationSec: null })).toBe(300);
    expect(maxOf({ targetDurationSec: 30, maxDurationSec: 45 })).toBe(45);
    expect(setTarget({ maxDurationSec: 40 }, 60)).toEqual({ targetDurationSec: 60, maxDurationSec: null });
    expect(setTarget({ maxDurationSec: 80 }, 60)).toEqual({ targetDurationSec: 60, maxDurationSec: 80 });
  });

  it('switching models clamps duration to the new model\'s cap', () => {
    const short = yue({ maxDurationSec: 60 });
    expect(switchMusicModel(draft({ targetDurationSec: 120, maxDurationSec: 150 }), option(short))).toMatchObject({ targetDurationSec: 60, maxDurationSec: 60 });
  });
});

describe('validation', () => {
  it('model first, then style; vocals require lyrics; duration, cap and seed each have one sentence', () => {
    expect(musicProblems(draft(), null)).toEqual(['先选一只音乐模型']);
    expect(musicProblems(draft({ style: ' ' }), option())).toEqual(['先写一句风格']);
    expect(musicProblems(draft(), option())).toEqual([]);
    expect(musicProblems(draft({ mode: 'song' }), option())[0]).toMatch(/歌词/);
    expect(musicProblems(draft({ targetDurationSec: 5 }), option())[0]).toMatch(/10–300/);
    expect(musicProblems(draft({ maxDurationSec: 20 }), option())[0]).toMatch(/上限/);
    expect(musicProblems(draft({ seed: 'abc' }), option())[0]).toMatch(/数字/);
  });

  it('beside the primary button: when not downloaded, says to download first; no nudge about style before any submission; normally shows budget and time', () => {
    expect(musicStatus(draft(), option(yue(), { usable: false, why: '还没下载' }), false).bad).toBe(true);
    expect(musicStatus(draft({ style: '' }), option(), false)).toEqual({ text: '900 个语义 token · 本机大约 3 分钟', bad: false });
    expect(musicStatus(draft({ style: '' }), option(), true)).toEqual({ text: '先写一句风格', bad: true });
  });

  it('estimated time', () => {
    expect(etaText(30)).toBe('本机大约 3 分钟');
    expect(etaText(10)).toBe('本机大约 60 秒');
    expect(etaText(30, { cpu: true })).toBe('CPU 生成，本机大约 10 分钟');
  });
});

function musicJob(patch: Partial<Parameters<typeof toolJob>[0]> = {}) {
  return toolJob({
    kind: 'generateMusic',
    providerId: 'local',
    modelId: 'yue2-3b@audio-cpp-q8',
    generation: {
      capability: 'generateMusic',
      mode: 'song',
      style: 'calm piano',
      lyrics: '\n第一行\n第二行',
      targetDurationSec: 30,
      maxDurationSec: 36,
      planning: 'melody',
      format: 'wav',
      seed: 7,
    },
    ...patch,
  });
}

describe('records', () => {
  it('one row gives form, duration, plan, model and seed; the body includes the first line of lyrics', () => {
    expect(musicRecordMeta(musicJob(), 'YuE2 3B')).toBe('带唱的歌 · 30 秒 · 先定旋律 · YuE2 3B · 种子 7');
    expect(musicText(musicJob())).toBe('calm piano — 第一行…');
  });

  it('truncation shows the output-truncated warning', () => {
    expect(musicTruncated(musicJob())).toBe(false);
    expect(musicTruncated(musicJob({ warnings: [{ code: 'output-truncated' }] }))).toBe(true);
  });

  it('carry back to form: seed left empty; the cap following the target returns to null', () => {
    expect(musicAgainDraft(musicJob())).toEqual({
      mode: 'song',
      style: 'calm piano',
      lyrics: '\n第一行\n第二行',
      targetDurationSec: 30,
      maxDurationSec: null,
      planning: 'melody',
      seed: '',
      model: 'local/yue2-3b@audio-cpp-q8',
    });
  });

  it('retry uses the frozen parameters; instrumental has no lyrics', () => {
    const r = musicRetryRequest(musicJob({ generation: { ...musicJob().generation!, mode: 'instrumental', lyrics: null } as never }));
    expect(r).toMatchObject({ mode: 'instrumental', seed: 7, maxDurationSec: 36, provider: 'local', model: 'yue2-3b@audio-cpp-q8' });
    expect(r && 'lyrics' in r).toBe(false);
  });

  it('file name uses the start of the style', () => {
    expect(musicFileName('calm solo piano, slow tempo')).toBe('calm solo piano slow tempo.wav');
    expect(musicFileName('')).toBe('music.wav');
  });
});

describe('preview', () => {
  it('fixed 10 seconds, direct generation, 8 steps; changing style changes the key', () => {
    const r = quickRequest({ style: 'lofi', mode: 'instrumental' }, 'yue2-3b@audio-cpp-q8', yue());
    expect(r).toMatchObject({ mode: 'instrumental', targetDurationSec: 10, maxDurationSec: 10, planning: 'off', steps: 8, provider: 'local' });
    expect('lyrics' in r).toBe(false);
    expect(quickRequest({ style: 'lofi', mode: 'song' }, 'b', yue()).lyrics).toBeTruthy();
    expect(quickKey({ style: 'lofi', mode: 'instrumental' }, 'b')).not.toBe(quickKey({ style: 'epic', mode: 'instrumental' }, 'b'));
    expect(quickSummary({ style: 'lofi', mode: 'instrumental' }, 8, 42)).toBe('Lo-fi 节拍 · 10 秒 · 8 步 · 用了 42 秒');
  });
});

describe('model menu', () => {
  it('lists only local music models', () => {
    const base = fixtureView();
    const view: ModelCapabilitiesView = {
      ...base,
      generateMusic: {
        default: null,
        effective: null,
        providers: [{ providerId: 'local', kind: 'local', label: 'This computer', connected: true, available: true, models: [yue()] } as never],
      },
    };
    expect(musicModelOptions(view).map((o) => o.key)).toEqual(['local/yue2-3b@audio-cpp-q8']);
  });
});
// i18n-ignore-end
