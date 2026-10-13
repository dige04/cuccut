import { describe, expect, it } from 'vitest';
import type { AssetRecord, AudioItem, ImageItem, MissingAsset, Sequence, VideoItem } from '@cuccut/protocol';
import {
  STAGE_MEDIA_COPY as C,
  assetsFingerprint,
  fileName,
  notePlayback,
  primaryMedia,
  recoveredAssets,
  stageMediaNotice,
  unplayableRefs,
  type PlaybackLog,
  type StageMediaInput,
} from './stage-media.ts';

const fps = { num: 30, den: 1 };

function video(id: string, asset: string, fromFrame: number, extra: Partial<VideoItem> = {}): VideoItem {
  return {
    id,
    trackId: 'v1',
    type: 'video',
    enabled: true,
    locked: false,
    paintOrder: 0,
    followPolicy: { kind: 'sequence-fixed' },
    span: { fromFrame, durationFrames: 90 },
    place: {},
    mode: 'fullscreen',
    assetRef: { id: asset, revision: '1' },
    timeMap: { kind: 'linear', sourceIn: { ticks: '0', timescale: 30 }, rate: { num: 1, den: 1 } },
    fit: 'contain',
    embeddedAudio: { enabled: true, volume: 1 },
    ...extra,
  };
}

function audio(id: string, asset: string, fromFrame: number): AudioItem {
  return {
    id,
    trackId: 'a1',
    type: 'audio',
    enabled: true,
    locked: false,
    paintOrder: 0,
    followPolicy: { kind: 'sequence-fixed' },
    assetRef: { id: asset, revision: '1' },
    fromFrame,
    subframeOffset: { ticks: '0', timescale: 48000 },
    playDuration: { ticks: String(2 * 48000), timescale: 48000 },
    timeMap: { kind: 'linear', sourceIn: { ticks: '0', timescale: 48000 }, rate: { num: 1, den: 1 } },
    mix: { volume: 1 },
  };
}

function image(id: string, asset: string): ImageItem {
  return {
    id,
    trackId: 'v2',
    type: 'image',
    enabled: true,
    locked: false,
    paintOrder: 1,
    followPolicy: { kind: 'sequence-fixed' },
    span: { fromFrame: 0, durationFrames: 30 },
    place: { w: 5.2 },
    mode: 'pip',
    assetRef: { id: asset, revision: '1' },
    fit: 'contain',
  };
}

function sequence(items: Sequence['items']): Sequence {
  return {
    id: 'seq',
    revision: '1',
    name: '主序列',
    fps,
    canvas: { width: 1920, height: 1080, workingSpace: 'srgb', background: '#000000' },
    durationPolicy: { kind: 'derived' },
    tracks: [],
    items,
    animationBindings: [],
    transitions: [],
    markers: [],
    ducking: [],
  };
}

function linked(id: string, path: string, currentRevision = '1'): AssetRecord {
  return {
    id,
    kind: 'video',
    name: `${id}-name`,
    currentRevision,
    revisions: {
      '1': {
        revision: '1',
        contentHash: 'h',
        byteLength: 1,
        mediaType: 'video/mp4',
        storage: { mode: 'linked', locator: { path }, frozen: false },
        provenance: { origin: 'import' },
      },
    },
  };
}

function managed(id: string): AssetRecord {
  const record = linked(id, '');
  record.revisions['1']!.storage = { mode: 'managed' };
  return record;
}

const assets: Record<string, AssetRecord> = {
  a: linked('a', '/Volumes/素材盘/interview-feb.mp4'),
  b: linked('b', '../media/b-roll.mov'),
  m: linked('m', 'music.wav'),
  p: linked('p', 'logo.png'),
  z: managed('z'),
};

function lost(assetId: string, reason: MissingAsset['reason'] = 'missing', extra: Partial<MissingAsset> = {}): MissingAsset {
  const path = assets[assetId]?.revisions['1']?.storage;
  return {
    assetId,
    revision: '1',
    reason,
    ...(path?.mode === 'linked' ? { path: path.locator.path } : {}),
    ...extra,
  };
}

function input(seq: Sequence, missing: MissingAsset[] | null, extra: Partial<StageMediaInput> = {}): StageMediaInput {
  return { sequence: seq, assets, missing, unplayable: new Map(), canPick: true, ...extra };
}

describe('main media', () => {
  it('enabled videos and audio in the root sequence, sorted by start; videos that start at the same time come first; the same version counts once', () => {
    const seq = sequence([audio('x', 'm', 0), video('y', 'b', 60), video('w', 'a', 0), video('dup', 'a', 120), image('i', 'p')]);
    expect(primaryMedia(seq).map((m) => [m.ref.id, m.kind])).toEqual([
      ['a', 'video'],
      ['m', 'audio'],
      ['b', 'video'],
    ]);
  });

  it('disabled instances do not count: they do not play, and missing ones do not affect the picture', () => {
    expect(primaryMedia(sequence([video('v', 'a', 0, { enabled: false })]))).toEqual([]);
  });
});

describe('stage hints', () => {
  it('no card is shown when all main media is present, there is no main media, or the check has not finished', () => {
    expect(stageMediaNotice(input(sequence([video('v', 'a', 0)]), []))).toBeNull();
    expect(stageMediaNotice(input(sequence([image('i', 'p')]), [lost('p')])), '只缺图片不出卡').toBeNull();
    expect(stageMediaNotice(input(sequence([]), [lost('a')])), '空白视频不出卡').toBeNull();
    expect(stageMediaNotice(input(sequence([video('v', 'a', 0)]), null))).toBeNull();
  });

  it('source file not found: names the file, not the full path; when a drive is registered, prompts to reconnect it', () => {
    const n = stageMediaNotice(input(sequence([video('v', 'a', 0)]), [lost('a', 'missing', { volume: '素材盘' })]))!;
    expect(n.kind).toBe('missing');
    expect(n.title).toBe('找不到源文件');
    expect(n.name).toBe('interview-feb.mp4');
    expect(n.body).toContain('字幕照常可以播放');
    expect(n.body).toContain('没有画面和原声');
    expect(n.volume).toBe(C.volume('素材盘'));
    expect(n.more).toBeNull();
    expect(n.relink).toEqual({ assetId: 'a', name: 'interview-feb.mp4' });
    expect(n.hint).toBe(C.relinkHint);
  });

  it('file changed or moved outside the project folder: each states its reason and can be relinked; the drive hint appears only when not found', () => {
    const seq = sequence([video('v', 'b', 0)]);
    const changed = stageMediaNotice(input(seq, [lost('b', 'changed', { volume: '素材盘' })]))!;
    expect(changed.title).toBe('源文件变了');
    expect(changed.body).toMatch(/已经不是导入时的那一个/);
    expect(changed.volume).toBeNull();
    expect(changed.relink).not.toBeNull();
    const outside = stageMediaNotice(input(seq, [lost('b', 'outside-project')]))!;
    expect(outside.title).toBe('源文件在项目目录之外');
    expect(outside.body).toMatch(/项目目录之外/);
    expect(outside.name).toBe('b-roll.mov');
  });

  it('several main media unreadable: the card names the first on the timeline and says how many others there are', () => {
    const seq = sequence([video('late', 'b', 90), video('early', 'a', 0), audio('m', 'm', 30)]);
    const n = stageMediaNotice(input(seq, [lost('b'), lost('a'), lost('m', 'changed')]))!;
    expect(n.name).toBe('interview-feb.mp4');
    expect(n.more).toBe(C.more(2));
  });

  it('missing audio: says this sound cannot be heard, not that there is no picture', () => {
    const n = stageMediaNotice(input(sequence([audio('m', 'm', 0)]), [lost('m')]))!;
    expect(n.body).toContain('听不到这段声音');
    expect(n.body).not.toContain('画面');
  });

  it('only the version the instance references counts: no card when a different version is missing', () => {
    const seq = sequence([video('v', 'a', 0)]);
    expect(stageMediaNotice(input(seq, [{ ...lost('a'), revision: '2' }]))).toBeNull();
  });

  it('web host has no file picker: no button, explains to recover it in the desktop app', () => {
    const n = stageMediaNotice(input(sequence([video('v', 'a', 0)]), [lost('a')], { canPick: false }))!;
    expect(n.relink).toBeNull();
    expect(n.hint).toBe(C.desktopOnly);
    expect(n.hint).not.toContain('影片');
  });

  it('media stored in the video folder and old versions: cannot be relinked, with the reason stated', () => {
    const managedOne = stageMediaNotice(input(sequence([video('v', 'z', 0)]), [lost('z')]))!;
    expect(managedOne.name).toBe('z-name');
    expect(managedOne.relink).toBeNull();
    expect(managedOne.hint).toBe(C.managed);

    const moved = { ...assets, a: linked('a', '/Volumes/素材盘/interview-feb.mp4', '2') };
    const old = stageMediaNotice({ ...input(sequence([video('v', 'a', 0)]), [lost('a')]), assets: moved })!;
    expect(old.relink).toBeNull();
    expect(old.hint).toBe(C.oldRevision);
  });

  it('file exists but the player cannot open it: attaches the player\'s own message and offers no relink; unreadable ones listed before it are mentioned first', () => {
    const seq = sequence([video('v', 'a', 0), video('w', 'b', 90)]);
    const unplayable = new Map([['a@1', 'DEMUXER_ERROR_NO_SUPPORTED_STREAMS']]);
    const bad = stageMediaNotice(input(seq, [], { unplayable }))!;
    expect(bad.kind).toBe('unplayable');
    expect(bad.title).toBe('源文件无法播放');
    expect(bad.body).toContain('播放器打不开这个文件：DEMUXER_ERROR_NO_SUPPORTED_STREAMS。');
    expect(bad.body).toContain('字幕照常可以播放');
    expect(bad.hint).toBeNull();
    expect(bad.relink).toBeNull();

    const both = stageMediaNotice(input(seq, [lost('b')], { unplayable }))!;
    expect(both.kind).toBe('unplayable');
    expect(both.more).toBe(C.more(1));
  });

  it('all copy uses "video" per the glossary', () => {
    const texts = [...Object.values(C.titles), ...Object.values(C.causes), C.relinkHint, C.desktopOnly, C.managed, C.oldRevision];
    for (const text of texts) expect(text).not.toContain('影片');
  });
});

describe('file name', () => {
  it('takes the last segment, Windows paths included; returns the input as is when there is no separator', () => {
    expect(fileName('/Volumes/素材盘/interview-feb.mp4')).toBe('interview-feb.mp4');
    expect(fileName('C:\\clips\\a.mov')).toBe('a.mov');
    expect(fileName('')).toBe('');
  });
});

describe('when to re-check', () => {
  it('the fingerprint changes when media\'s location, storage mode or current version changes; nothing else does', () => {
    const before = assetsFingerprint(assets);
    expect(assetsFingerprint({ ...assets })).toBe(before);
    expect(assetsFingerprint({ ...assets, a: linked('a', '/Users/me/interview-feb.mp4') })).not.toBe(before);
    expect(assetsFingerprint({ ...assets, a: managed('a') })).not.toBe(before);
    expect(assetsFingerprint({ ...assets, a: linked('a', '/Volumes/素材盘/interview-feb.mp4', '2') })).not.toBe(before);
    const { p: _, ...fewer } = assets;
    expect(assetsFingerprint(fewer)).not.toBe(before);
  });

  it('media unreadable last time but readable now is reloaded; the first check does not count as recovery', () => {
    expect(recoveredAssets([lost('a'), lost('b')], [lost('b')])).toEqual(['a']);
    expect(recoveredAssets(null, [])).toEqual([]);
    expect(recoveredAssets([lost('a')], [lost('a', 'changed')])).toEqual([]);
  });
});

describe('criteria for playback failure', () => {
  const ref = { id: 'a', revision: '1' };
  const decode = { kind: 'error', code: 3, message: 'PIPELINE_ERROR_DECODE' } as const;

  it('counts only when it still cannot be resolved after a new address: a first error may just be an expired handle', () => {
    let log: PlaybackLog = {};
    log = notePlayback(log, 'video:a@1#0', ref, decode);
    expect(unplayableRefs(log).size).toBe(0);
    log = notePlayback(log, 'video:a@1#0', ref, decode);
    expect(unplayableRefs(log).get('a@1')).toBe('PIPELINE_ERROR_DECODE');
  });

  it('resets to zero once loading succeeds after re-fetching', () => {
    let log: PlaybackLog = notePlayback({}, 'k', ref, decode);
    log = notePlayback(log, 'k', ref, { kind: 'loaded' });
    log = notePlayback(log, 'k', ref, decode);
    expect(unplayableRefs(log).size).toBe(0);
  });

  it('network interruption, abort, or failure to get the address do not count as playback failure', () => {
    let log: PlaybackLog = {};
    for (let i = 0; i < 3; i++) {
      log = notePlayback(log, 'k', ref, { kind: 'error', code: 2, message: 'network' });
      log = notePlayback(log, 'k', ref, { kind: 'unresolved' });
    }
    expect(log).toEqual({});
  });

  it('when the browser gives no message, says one line based on the error code', () => {
    let log: PlaybackLog = {};
    log = notePlayback(log, 'k', ref, { kind: 'error', code: 4, message: '' });
    log = notePlayback(log, 'k', ref, { kind: 'error', code: 4, message: ' ' });
    expect(unplayableRefs(log).get('a@1')).toBe('格式不受支持');
  });
});
