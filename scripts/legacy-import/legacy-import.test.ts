// Tests for old project import: the synthesized old projects are placed in a temp directory and never touch any real project.
//
//   CUCCUT_ENGINE_HOST=<engine-host> node --test scripts/legacy-import/legacy-import.test.ts
//
// Without an engine-host or ffmpeg, the group that goes through the engine is skipped; the group that only checks the plan runs as usual.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';

import { discoverFilm, planBcutProject } from './ccut-project.ts';
import { EngineHost } from './engine-host.ts';
import { decimal, decimalText, frameAt, linearOfDb } from './exact-time.ts';
import { planExternalProject } from './external-project.ts';
import type { ProjectReport, VideoContent } from './video-plan.ts';
import { dryAssets, planContent } from './video-writer.ts';

type Obj = { [key: string]: any };

const here = import.meta.dirname;
const which = (name: string): string | null => {
  try {
    return execFileSync('which', [name], { encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
};
const ffmpeg = process.env.CUCCUT_FFMPEG ?? which('ffmpeg');
const ffprobe = process.env.CUCCUT_FFPROBE ?? which('ffprobe');
const engine = process.env.CUCCUT_ENGINE_HOST;
const noMedia = !ffmpeg || !ffprobe ? '需要 ffmpeg 与 ffprobe' : false;
const noEngine = noMedia || (!engine || !existsSync(engine) ? '需要 CUCCUT_ENGINE_HOST 指向 engine-host' : false);

const root = mkdtempSync(path.join(tmpdir(), 'legacy-import-test-'));
const home = path.join(root, 'home');
const media = path.join(root, 'media');
const ccutRoot = path.join(root, 'ccut');
const externalRoot = path.join(root, 'external');
const codeRoot = path.join(root, 'code');
after(() => rmSync(root, { recursive: true, force: true }));

function makeMedia(): void {
  mkdirSync(media, { recursive: true });
  const run = (args: string[]): void => {
    execFileSync(ffmpeg as string, ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
  };
  run([
    '-f',
    'lavfi',
    '-i',
    'testsrc=size=320x180:rate=30:duration=2',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:duration=2',
    '-shortest',
    '-c:v',
    'mpeg4',
    '-c:a',
    'aac',
    path.join(media, 'clip.mp4'),
  ]);
  run(['-f', 'lavfi', '-i', 'sine=frequency=220:duration=2', path.join(media, 'tone.wav')]);
  run(['-f', 'lavfi', '-i', 'color=c=red:size=64x64', '-frames:v', '1', path.join(media, 'dot.png')]);
  writeFileSync(path.join(media, 'spin.json'), JSON.stringify({ v: '5.7.0', fr: 30, ip: 0, op: 30, w: 64, h: 64, layers: [] }));
}

const words = [
  { id: 'w1', t0: 0, t1: 0.3, text: '一' },
  { id: 'w2', t0: 0.35, t1: 0.6, text: '二' },
  { id: 'w3', t0: 0.8, t1: 1.0, text: '三' },
  { id: 'w4', t0: 1.2, t1: 1.5, text: '四' },
];

/** A timeline project: the main media has one cut point; one of each element type, plus transitions, ducking, keyframes, word anchors, hidden elements, Lottie stickers and template layers. */
function makeBcut(): string {
  const dir = path.join(ccutRoot, 'fixture.ccut');
  mkdirSync(dir, { recursive: true });
  const clip = path.join(media, 'clip.mp4');
  writeFileSync(
    path.join(dir, 'project.json'),
    JSON.stringify({ formatVersion: 3, title: '合成项目', media: { path: clip, fps: 30, width: 320, height: 180, duration: 2 } }),
  );
  const span = (start: number | string, end?: number | string): Obj => ({ start, ...(end != null ? { end } : {}) });
  const timeline = {
    version: '0.12',
    sources: {
      main: { cuts: [{ id: 'k1', t0: 0.5, t1: 0.7 }] },
      bed: { path: path.join(media, 'tone.wav'), kind: 'audio', duration: 2, cuts: [{ id: 'k2', t0: 1.2, t1: 1.5, ref: 'p1' }] },
      pic: { path: path.join(media, 'dot.png'), kind: 'image', naturalW: 64, naturalH: 64 },
      cam: { path: clip, kind: 'video', duration: 2, naturalW: 320, naturalH: 180, hasAudio: true },
      spin: { path: path.join(media, 'spin.json'), kind: 'lottie' },
    },
    clips: [{ id: 'c1', in: 0, out: 2 }],
    main: { place: { x: 50, y: 50, w: 100 }, background: '#112233' },
    template: { id: 'tpl_1', name: '片头条', layers: [] },
    tracks: [
      {
        id: 'overlay',
        kind: 'overlay',
        elements: [
          {
            id: 'i1',
            kind: 'image',
            ...span(0.1, 1.0),
            srcId: 'pic',
            place: { x: 30, y: 40, w: 20, radius: 8, opacity: 1.5 },
            fx: { blur: 4 },
            mask: { shape: 'ellipse' },
            animate: { enter: { preset: 'fade', dur: 0.3 } },
            keyframes: {
              x: [
                { t: 0, v: 30 },
                { t: 0.01, v: 31 },
                { t: 0.5, v: 60, ease: 'easeOutQuad' },
              ],
              opacity: [
                { t: '0%', v: 0 },
                { t: '100%', v: 2 },
              ],
              rot: [{ t: 0.2, v: 10, ease: 'bounceSomething' }],
            },
          },
          { id: 't1', kind: 'text', ...span('~main:w2', '~main:w3:end'), text: '你好', style: { fontSize: 40 }, verticalAlign: 'top' },
          { id: 't2', kind: 'text', start: 0.2, text: '隐藏的', hidden: true },
          { id: 't3', kind: 'text', ...span('~main:nope', 1), text: '求不出' },
          { id: 'n1', kind: 'text', ...span(1.0, 1.4), counter: { mode: 'countdown', format: 'mm:ss' } },
        ],
      },
      {
        id: 'gfx',
        kind: 'overlay',
        elements: [
          { id: 'sh1', kind: 'shape', ...span(0, 0.4), shape: { shape: 'rect', fill: '#FFD646' } },
          { id: 'st1', kind: 'sticker', ...span(0.4, 0.8), sticker: { source: 'template', templateId: 'star' } },
          {
            id: 'st2',
            kind: 'sticker',
            ...span(0.8, 1.2),
            srcId: 'spin',
            srcStart: 0.2,
            sticker: { source: 'asset', path: 'media/spin.json', loop: 'once', fillOverrides: { '#FF0000': '#00C853' } },
          },
          { id: 'vz1', kind: 'visualizer', ...span(1.2, 1.5), visualizer: { style: 'bars' } },
          { id: 'pg1', kind: 'progress', ...span(1.5, 1.8), place: { y: 95, w: 100 }, progress: { style: 'bar' } },
        ],
      },
      {
        id: 'more',
        kind: 'overlay',
        elements: [
          {
            id: 'd1',
            kind: 'draw',
            ...span(0, 0.3),
            draw: {
              brush: 'round',
              color: '#FF0000',
              size: 4,
              strokes: [
                {
                  points: [
                    [10, 10],
                    [50, 50],
                  ],
                },
              ],
            },
          },
          { id: 'ph1', kind: 'placeholder', ...span(0.3, 0.6), placeholder: { variant: 'camera' } },
          { id: 'cf1', kind: 'confetti', ...span(0.6, 0.9), confetti: { style: 'burst' } },
          { id: 'wb1', kind: 'whiteboard', ...span(0.9, 1.2), srcId: 'pic', whiteboard: {} },
        ],
      },
      {
        id: 'broll',
        kind: 'overlay',
        elements: [
          {
            id: 'v1',
            kind: 'video',
            ...span(0.2, 0.8),
            srcId: 'cam',
            srcStart: 0.5,
            role: 'broll',
            mode: 'pip',
            place: { x: 70, y: 30, w: 30 },
            volume: 0.5,
            transitions: { in: { k: 'dissolve', dur: 0.5 }, out: { k: 'iris', dur: 3 } },
          },
        ],
      },
      {
        id: 'bed1',
        kind: 'audio',
        elements: [
          {
            id: 'a1',
            kind: 'audio',
            ...span(0, 1.8),
            srcId: 'bed',
            volume: 0.8,
            audioFadeIn: 0.2,
            keyframes: {
              volume: [
                { t: 0, v: 1 },
                { t: 1, v: 0.5 },
              ],
            },
            duck: { under: 'speech', depth: 12, attack: 0.1, release: 0.3 },
          },
        ],
      },
      {
        id: 'dub1',
        kind: 'audio',
        elements: [{ id: 'a2', kind: 'audio', ...span(0.2, 1.0), srcId: 'bed', volume: 5, duck: { under: 'bed1', depth: 80 } }],
      },
    ],
  };
  writeFileSync(path.join(dir, 'timeline.json'), JSON.stringify(timeline));
  writeFileSync(
    path.join(dir, 'transcript.json'),
    JSON.stringify({
      lang: 'zh', engine: 'test', words, speakers: {},
      breaks: { w2: 'nobreak' },
      autoBreaks: { default: { w2: 'break' } },
      paraBreaks: { w3: true, w4: false },
      stages: { asr: 'fixture-fingerprint' },
    }),
  );
  return dir;
}

/** An external video project: one audio segment with volume keyframes (dB), and one code composition on the picture track (code package on disk, no render result). */
function makeExternal(): string {
  const dir = path.join(externalRoot, 'ext-project');
  const revision = path.join(dir, 'projects', 'p1', 'assets', 'hyperframes', 'scene', 'sha256-aa');
  mkdirSync(revision, { recursive: true });
  writeFileSync(path.join(revision, 'manifest.json'), JSON.stringify({ bundleId: 'scene', entryHtml: 'index.html' }));
  writeFileSync(path.join(revision, 'index.html'), '<!doctype html><title>scene</title>');
  mkdirSync(path.join(dir, 'runtime-media', 'm1'), { recursive: true });
  writeFileSync(
    path.join(dir, 'runtime-media', 'm1', 'metadata.json'),
    JSON.stringify({ relativePath: '../../media/tone.wav', kind: 'audio', duration: 2, displayName: 'tone' }),
  );
  writeFileSync(
    path.join(dir, 'project.json'),
    JSON.stringify({
      id: 'p1',
      name: '外部项目',
      schemaVersion: 9,
      metadata: { fps: 30, width: 320, height: 180 },
      timeline: {
        tracks: [
          { id: 'au', kind: 'audio', name: '音乐', order: 0, muted: true },
          { id: 'vid', kind: 'video', name: '画面', order: 1 },
        ],
        items: [
          { id: 'x1', type: 'audio', trackId: 'au', mediaId: 'm1', from: 3, durationInFrames: 30, volume: -6 },
          { id: 'h1', type: 'hyperframes', trackId: 'vid', bundleId: 'scene', bundleRevision: 'sha256-aa', from: 0, durationInFrames: 30 },
        ],
        keyframes: [
          {
            itemId: 'x1',
            properties: [
              {
                property: 'volume',
                keyframes: [
                  { frame: 0, value: 0, easing: 'easeInQuad' },
                  { frame: 15, value: -12, easing: 'ease-in-out' },
                  { frame: 24, value: -6, easing: 'hold' },
                ],
              },
            ],
          },
        ],
      },
    }),
  );
  return dir;
}

/**
 * A code project: entry, data and compiled output (composition ID `comp-a`); `films` are the videos placed in the project (relative to the project directory),
 * and `media` is the main media path recorded in `project.json`.
 */
function makeCode(name: string, films: string[], mediaPath?: string): string {
  const dir = path.join(codeRoot, `${name}.ccut`);
  mkdirSync(path.join(dir, 'out'), { recursive: true });
  writeFileSync(path.join(dir, 'main.ccut.tsx'), "import data from './data.json';\nexport default data;\n");
  writeFileSync(path.join(dir, 'data.json'), JSON.stringify({ ccutData: 1, storyboard: { brief: { duration: 2 } } }));
  writeFileSync(path.join(dir, 'out', 'doc.json'), JSON.stringify({ meta: { id: 'comp-a', fps: 30, width: 320, height: 180 } }));
  for (const film of films) copyFileSync(path.join(media, 'clip.mp4'), path.join(dir, film));
  writeFileSync(
    path.join(dir, 'project.json'),
    JSON.stringify({
      formatVersion: 3,
      title: name,
      entry: 'main.ccut.tsx',
      data: 'data.json',
      ...(mediaPath != null ? { media: { path: mediaPath, kind: 'video' } } : {}),
    }),
  );
  return dir;
}

describe('time conversion', () => {
  test('when landing exactly halfway between two frames, takes the earlier frame', () => {
    const fps = { num: 30, den: 1 };
    // 50 000 µs is exactly 1.5 frames.
    assert.equal(frameAt(50_000n, fps), 1);
    assert.equal(frameAt(50_001n, fps), 2);
    assert.equal(frameAt(16_666n, fps), 0);
  });
  test('decimal seconds are read as an exact decimal fraction in their shortest form', () => {
    assert.deepEqual(decimal(0.1), { num: 1n, den: 10n });
    assert.deepEqual(decimal(1.25), { num: 125n, den: 100n });
    assert.equal(decimalText(1e-7), '0.0000001');
    assert.equal(linearOfDb(-6), 0.501187);
    assert.equal(linearOfDb(0), 1);
  });
});

describe('legacy project metadata and subtitle projection are compatible', () => {
  test('titles over 200 Unicode characters are truncated for display; the report keeps the original title', () => {
    const dir = mkdtempSync(path.join(root, 'long-title-'));
    const title = '🎬'.repeat(199) + '影片';
    writeFileSync(path.join(dir, 'project.json'), JSON.stringify({ formatVersion: 3, title }));
    const plan = planBcutProject(dir, new Set());
    assert.ok(plan);
    assert.equal(plan.name, '🎬'.repeat(199) + '影');
    assert.equal([...plan.name].length, 200);
    assert.equal(plan.report.name, title);
    assert.equal(plan.report.clamped['video-name'], 1);
  });

  function project(sentences: Obj[], cues: Obj[]): { body: Obj; content: VideoContent; report: ProjectReport } {
    const dir = mkdtempSync(path.join(root, 'projection-'));
    mkdirSync(path.join(dir, 'studio'));
    writeFileSync(path.join(dir, 'project.json'), JSON.stringify({ formatVersion: 3 }));
    writeFileSync(
      path.join(dir, 'transcript.json'),
      JSON.stringify({
        lang: 'en',
        words: words.map((word, i) => ({ ...word, ...(i === 1 ? { glue: true } : {}) })),
        breaks: { w2: 'nobreak' },
        autoBreaks: { default: { w2: 'break' }, wide: { w3: 'nobreak' } },
        paraBreaks: { w3: true, w4: false },
        stages: { asr: 'fixture-fingerprint' },
      }),
    );
    writeFileSync(path.join(dir, 'studio', 'data.json'), JSON.stringify({ sentences, cues }));
    const plan = planBcutProject(dir, new Set());
    assert.ok(plan);
    const content = planContent(plan, dryAssets(plan));
    return { body: content.documents.find((d) => d.ref === 'speech')!.body as Obj, content, report: plan.report };
  }
  const cues = [
    { id: 'q1', start: 0, end: 0.6, words: [{ id: 'w1' }, { id: 'w2' }] },
    { id: 'q2', start: 0.8, end: 1.5, words: [{ id: 'w3' }, { id: 'w4' }] },
  ];

  test('sentences that store only cueIds restore the full word range and segments from subtitle lines', () => {
    const { body, report } = project([{ id: 's1', cueIds: ['q1', 'q2'], paraStart: true }], cues);
    assert.deepEqual(body.sentences, [{ id: 's1', first: 'w1', last: 'w4', paragraphStart: true }]);
    assert.ok(!report.warnings.some((w) => w.includes('投影过期')));
  });

  test('existing sourceWordIds take priority; non-contiguous members stay as an explicit list', () => {
    const { body } = project([{ id: 's1', sourceWordIds: ['w1', 'w3'], cueIds: ['q1', 'q2'] }], cues);
    assert.deepEqual(body.sentences, [{ id: 's1', wordIds: ['w1', 'w3'] }]);
  });

  test('out-of-order members cannot be rewritten into a contiguous range based only on first, last and count', () => {
    const { body } = project([{ id: 's1', sourceWordIds: ['w1', 'w3', 'w2', 'w4'] }], cues);
    assert.deepEqual(body.sentences, [{ id: 's1', wordIds: ['w1', 'w3', 'w2', 'w4'] }]);
  });

  test('missing subtitle lines, word references or invalid words abandon the sentence projection and report it; the source words are still kept', () => {
    for (const sentence of [{ id: 's1' }, { id: 's1', cueIds: ['q1', 'missing'] }, { id: 's1', sourceWordIds: ['gone'] }]) {
      const { body, content, report } = project([sentence], cues);
      assert.equal(body.sentences, null);
      assert.equal(body.words.length, 4);
      assert.ok(content.documents.some((d) => d.ref === 'caption:source'));
      assert.ok(report.warnings.some((w) => w.includes('投影过期')));
    }
  });

  test('subtitle lines with no words do not generate an empty range', () => {
    const { content } = project([], [{ id: 'empty', start: 0, end: 1 }]);
    assert.ok(!content.documents.some((d) => d.ref === 'caption:source'));
  });

  test('manual and automatic line breaks, enabled segments, stage fingerprints and pre-attached markers are written to formal fields', () => {
    const { body } = project([], []);
    assert.deepEqual(body.userBreaks, { w2: 'no-break' });
    assert.deepEqual(body.autoBreaks, { default: { w2: 'break' }, wide: { w3: 'no-break' } });
    assert.deepEqual(body.paragraphBreaks, ['w3']);
    assert.deepEqual(body.stages, { asr: 'fixture-fingerprint' });
    assert.equal(body.words[1].glue, true);
    assert.equal(body.legacy, undefined);
  });
});

describe('plan (bypassing the engine)', { skip: noMedia }, () => {
  let content: VideoContent;
  let report: ProjectReport;
  const byId = (id: string): Obj => {
    const found = content.items.find((i) => i.sourceId === id);
    assert.ok(found, `计划里没有 ${id}`);
    return found;
  };
  before(() => {
    makeMedia();
    const plan = planBcutProject(makeBcut(), new Set());
    assert.ok(plan);
    content = planContent(plan, dryAssets(plan));
    report = plan.report;
  });

  test('the main track is split at the cut into two a-roll segments, fills the canvas, contain, background color on the instance', () => {
    const pieces = ['c1#1', 'c1#2'].map((id) => byId(id).item);
    for (const piece of pieces) {
      assert.equal(piece.type, 'video');
      assert.equal(piece.role, 'a-roll');
      assert.deepEqual([piece.mode, piece.fit, piece.bg], ['fullscreen', 'contain', '#112233']);
      assert.deepEqual(piece.place, {});
    }
    assert.deepEqual(pieces[0].span, { fromFrame: 0, durationFrames: 15 });
    assert.deepEqual(pieces[1].span, { fromFrame: 15, durationFrames: 39 });
    assert.equal(content.background, undefined);
  });

  test('geometry, effects, masks and animation carry over as is; out-of-range values are clamped', () => {
    const image = byId('i1');
    assert.deepEqual(image.item.place, { x: 30, y: 40, w: 20, radius: 8, opacity: 1 });
    assert.deepEqual(image.item.fx, { blur: 4 });
    assert.deepEqual(image.item.mask, { shape: 'ellipse' });
    assert.deepEqual(image.item.animate, { enter: { preset: 'fade', dur: 0.3 } });
    assert.equal(image.item.followPolicy.kind, 'follow-cuts');
    assert.equal(report.clamped['place.opacity'], 1);
    assert.deepEqual(image.item.extensions, { 'cuccut.import': { sourceId: 'i1' } });
  });

  test('keyframes: seconds snap to frames (coincident ones keep only the earlier), percentages are kept, unknown easing is linear', () => {
    const keyframes = Object.fromEntries((byId('i1').keyframes as Obj[]).map((k) => [k.property, k.keyframes]));
    assert.deepEqual(keyframes.x, [
      { localFrame: 0, value: 30 },
      { localFrame: 15, value: 60, ease: 'easeOutQuad' },
    ]);
    assert.deepEqual(keyframes.opacity, [
      { percent: 0, value: 0 },
      { percent: 100, value: 1 },
    ]);
    assert.deepEqual(keyframes.rot, [{ localFrame: 6, value: 10 }]);
    assert.equal(report.dropped['关键帧（落到同一帧）'], 1);
    assert.equal(report.dropped['关键帧缓动'], 1);
  });

  test('word anchors are written as speech-anchor, the export time is computed across cuts; anchors that cannot be computed are not imported', () => {
    const text = byId('t1').item;
    assert.equal(text.followPolicy.kind, 'speech-anchor');
    assert.deepEqual(text.followPolicy.start, { kind: 'word', speechRef: { document: 'speech' }, wordId: 'w2', edge: 'start' });
    assert.equal(text.followPolicy.end.edge, 'end');
    // w2 head is at 0.35 s (10.5 frames, take the earlier one, frame 10); w3 tail is at source 1.0 s, and minus the 0.2 s cut point gives 0.8 s in the output (frame 24).
    assert.deepEqual(text.span, { fromFrame: 10, durationFrames: 14 });
    assert.equal(
      content.items.some((i) => i.sourceId === 't3'),
      false,
    );
    assert.deepEqual(report.anchors, { resolved: 1, unresolved: 1 });
  });

  test('hidden elements with no end point: disabled, run to the end of the sequence, do not follow cuts', () => {
    const hidden = byId('t2').item;
    assert.equal(hidden.enabled, false);
    assert.equal(hidden.untilSequenceEnd, true);
    assert.equal(hidden.followPolicy.kind, 'sequence-fixed');
  });

  test('every element type maps to the instance type of the same name', () => {
    const types = Object.fromEntries(content.items.map((i) => [i.sourceId, i.item.type]));
    assert.deepEqual(
      ['sh1', 'st1', 'vz1', 'pg1', 'd1', 'ph1', 'cf1', 'wb1', 'n1', 'v1', 'a1', 'a2'].map((id) => types[id]),
      ['shape', 'sticker', 'visualizer', 'progress', 'draw', 'placeholder', 'confetti', 'whiteboard', 'text', 'video', 'audio', 'audio'],
    );
    assert.deepEqual(byId('n1').item.counter, { mode: 'countdown', format: 'mm:ss' });
    assert.equal(byId('n1').item.text, undefined);
    assert.equal(byId('wb1').item.assetRef != null, true);
  });

  test('Lottie stickers: the media is registered as Lottie, `loop` and `fillOverrides` carry over as is, the source start point is reported', () => {
    const lottie = byId('st2').item;
    assert.equal(lottie.type, 'sticker');
    assert.ok(lottie.assetRef, 'Lottie 贴纸指向素材');
    assert.deepEqual(lottie.sticker, { source: 'asset', path: 'media/spin.json', loop: 'once', fillOverrides: { '#FF0000': '#00C853' } });
    assert.equal(report.dropped['贴纸的取源起点与速度'], 1);
    assert.equal(report.dropped['Lottie 素材'], undefined);
    assert.equal(report.dropped['Lottie 贴纸'], undefined);
  });

  test('audio: linear volume is clamped to [0, 4], volume keyframes become an envelope, mute and fade-in unchanged', () => {
    const bed = byId('a1').item;
    assert.equal(bed.mix.volume, 0.8);
    assert.deepEqual(bed.mix.fadeIn, { ticks: '1', timescale: 5 });
    assert.deepEqual(bed.mix.envelope, [
      { at: { ticks: '0', timescale: 1 }, volume: 1 },
      { at: { ticks: '1', timescale: 1 }, volume: 0.5 },
    ]);
    assert.equal(byId('a2').item.mix.volume, 4);
    assert.equal(report.clamped.volume, 1);
    assert.equal(byId('v1').item.embeddedAudio.volume, 0.5);
    assert.equal(byId('a2').item.role, 'dub');
  });

  test('transitions come only from video elements; length is clamped to [0.1, 2] seconds', () => {
    assert.deepEqual(byId('v1').transitions, [
      { side: 'in', kind: 'dissolve', duration: '0.5' },
      { side: 'out', kind: 'iris', duration: '2' },
    ]);
    assert.equal(report.clamped['转场长度'], 1);
  });

  test('ducking is merged by trigger, depth and attack/release; depth is clamped to [0, 60]', () => {
    assert.deepEqual(content.ducking, [
      { trigger: { kind: 'speech' }, depth: 12, attack: '0.1', release: '0.3', targetSourceIds: ['a1'] },
      { trigger: { kind: 'tracks', legacyTrack: 'bed1' }, depth: 60, targetSourceIds: ['a2'] },
    ]);
  });

  test('cut sets: one per source, exact scale, the target instances are the audio and video instances of that source', () => {
    const main = content.cutSets?.find((s) => s.ref === 'cut-set:main');
    assert.deepEqual(main?.body.cuts, [{ id: 'k1', t0: '5', t1: '7' }]);
    assert.equal(main?.body.timescale, 10);
    assert.deepEqual(main?.scopeSourceIds, ['c1#1', 'c1#2']);
    const bed = content.cutSets?.find((s) => s.ref === 'cut-set:bed');
    assert.deepEqual(bed?.body.cuts, [{ id: 'k2', t0: '12', t1: '15', ref: 'p1' }]);
    assert.deepEqual(bed?.scopeSourceIds, ['a1', 'a2']);
  });

  test('template layers carry over as is', () => {
    assert.deepEqual(content.template, { id: 'tpl_1', name: '片头条', layers: [] });
  });

  test('designed subtitle emphasis (captionEmphasis) carries over with the subtitle style as is; the keys are the word IDs in the transcription', () => {
    // Another copy with subtitles is placed separately (not in ccutRoot: the group that goes through the engine only imports two projects).
    const dir = path.join(root, 'captioned', 'fixture.ccut');
    cpSync(path.join(ccutRoot, 'fixture.ccut'), dir, { recursive: true });
    mkdirSync(path.join(dir, 'studio'), { recursive: true });
    const cue = (id: string, start: number, end: number, text: string, ids: string[]): Obj => ({
      id,
      start,
      end,
      text,
      words: ids.map((w) => ({ id: w })),
    });
    writeFileSync(
      path.join(dir, 'studio', 'data.json'),
      JSON.stringify({
        sentences: [
          { id: 's1', sourceWordIds: ['w1', 'w2'] },
          { id: 's2', sourceWordIds: ['w3', 'w4'] },
        ],
        cues: [cue('q1', 0, 0.6, '一二', ['w1', 'w2']), cue('q2', 0.8, 1.5, '三四', ['w3', 'w4'])],
      }),
    );
    const emphasis = { w3: { anchorText: '三', role: 'hero', color: '#FF00AA' } };
    writeFileSync(
      path.join(dir, 'studio', 'style.json'),
      JSON.stringify({
        mode: 'orig',
        wordAnimation: { caption: { schema: 1, style: { id: 'caption-highlight', version: 1 } } },
        captionEmphasis: emphasis,
      }),
    );
    const plan = planBcutProject(dir, new Set());
    assert.ok(plan);
    const captioned = planContent(plan, dryAssets(plan));
    const doc = (ref: string): Obj => {
      const found = captioned.documents.find((d) => d.ref === ref);
      assert.ok(found, `计划里没有 ${ref}`);
      return found.body as Obj;
    };
    const style = doc('caption-style').style;
    assert.deepEqual(style.captionEmphasis, emphasis);
    assert.deepEqual(style.wordAnimation.caption.style, { id: 'caption-highlight', version: 1 });
    const wordIds = new Set((doc('speech').words as Obj[]).map((w) => w.id));
    for (const id of Object.keys(style.captionEmphasis)) assert.ok(wordIds.has(id), `强调的键 ${id} 不是转写里的词`);
    // Subtitle lines point at these words; when rendered, emphasis lands on the words they point to.
    assert.deepEqual(
      (doc('caption:source').cues as Obj[]).map((c) => [c.id, c.words]),
      [
        ['q1', { first: 'w1', last: 'w2' }],
        ['q2', { first: 'w3', last: 'w4' }],
      ],
    );
  });

  test('external projects: dB is converted to linear multipliers, volume keyframes become an envelope (easing moves from a segment\'s start to its end), track mute carries over', () => {
    const plan = planExternalProject(makeExternal(), new Set());
    assert.ok(plan);
    const external = planContent(plan, dryAssets(plan));
    const audio = external.items[0].item as Obj;
    assert.equal(audio.mix.volume, 1);
    // The easeInQuad of the first frame governs the segment 0 → 15 frames, recorded at the second point; the ease-in-out of the second frame is not in the easing table, so the third point is linear;
    // the hold at the last frame governs no segment and is not reported.
    assert.deepEqual(audio.mix.envelope, [
      { at: { ticks: '0', timescale: 1 }, volume: 1 },
      { at: { ticks: '1', timescale: 2 }, volume: 0.251189, ease: 'easeInQuad' },
      { at: { ticks: '4', timescale: 5 }, volume: 0.501187 },
    ]);
    assert.equal(plan.report.dropped['关键帧缓动'], 1);
    assert.deepEqual(audio.extensions, { 'cuccut.import': { sourceId: 'x1', mediaId: 'm1' } });
    assert.equal(external.tracks[0].muted, true);
  });

  test('external project code compositions have no pre-rendered stand-in: not imported, the code package is not registered, tracks that only hold the composition are not created, reported as dropped', () => {
    const plan = planExternalProject(makeExternal(), new Set());
    assert.ok(plan);
    const external = planContent(plan, dryAssets(plan));
    assert.deepEqual(
      plan.assets.map((a) => a.ref),
      ['media:m1'],
    );
    assert.deepEqual(
      external.items.map((i) => (i.item as Obj).type),
      ['audio'],
    );
    assert.deepEqual(
      external.tracks.map((t) => t.key),
      ['au'],
    );
    assert.equal(plan.report.dropped['没有预渲染替身的代码合成'], 1);
    assert.ok(plan.report.warnings.some((w) => w.includes('代码合成 h1') && w.includes('没有预渲染替身')));
    assert.ok(plan.report.notImported.includes('1 个代码包版本：合成没有预渲染替身，代码包不登记'));
    assert.deepEqual(plan.report.notApplicable, {});
  });

  test('external project subtitle animation presets do not carry over: no animationPresetId in the style, reported as dropped, one warning per preset', () => {
    const dir = path.join(root, 'external-captions', 'ext-project');
    mkdirSync(dir, { recursive: true });
    const line = (id: string, from: number, text: string, preset: string): Obj => ({
      id,
      type: 'subtitle',
      trackId: 'st',
      from,
      durationInFrames: 30,
      fontSize: 40,
      color: '#FFFFFF',
      animationPresetId: preset,
      cues: [{ id: `c-${id}`, startSeconds: 0, endSeconds: 1, text }],
    });
    writeFileSync(
      path.join(dir, 'project.json'),
      JSON.stringify({
        id: 'p2',
        name: '带字幕的外部项目',
        schemaVersion: 18,
        metadata: { fps: 30, width: 320, height: 180 },
        timeline: {
          tracks: [{ id: 'st', kind: 'subtitle', name: '字幕', order: 0 }],
          items: [
            line('s1', 0, '编程 Agent 越来越多', 'reveal'),
            line('s2', 30, '一处切换', 'reveal'),
            line('s3', 60, '自动创建', 'typewriter'),
          ],
        },
      }),
    );
    const plan = planExternalProject(dir, new Set());
    assert.ok(plan);
    const content = planContent(plan, dryAssets(plan));
    const style = (content.documents.find((d) => d.ref === 'caption-style')?.body as Obj).style;
    assert.equal(style.animationPresetId, undefined);
    assert.equal(style.fontSize, 40);
    // A different preset does not count as a sentence's own style: the cue's extension holds only the source.
    for (const cue of (content.documents.find((d) => d.ref === 'caption')?.body as Obj).cues)
      assert.deepEqual(Object.keys(cue.extensions['cuccut.import']), ['sourceItemId']);
    const caption = content.items.find((i) => (i.item as Obj).type === 'caption')?.item as Obj;
    assert.deepEqual(caption.extensions, { 'cuccut.import': { sourceId: 'caption', itemCount: 3 } });
    assert.deepEqual(plan.report.unmapped, {});
    assert.deepEqual(plan.report.dropped, { '外部项目的字幕动画预设（成片里没有逐词效果）': 3 });
    assert.equal(plan.report.warnings.filter((w) => w.includes('字幕动画预设')).length, 2);
    assert.ok(plan.report.warnings.some((w) => w.includes('reveal（2 句）')));
    assert.ok(plan.report.warnings.some((w) => w.includes('typewriter（1 句）')));
  });
});

describe('written and verified through the engine', { skip: noEngine }, () => {
  const out = path.join(root, 'videos');
  const env = { ...process.env, CUCCUT_HOME: home, HOME: home };
  let report: { projects: ProjectReport[] };
  let verified: { status: number | null; output: string };
  let host: EngineHost;
  let videoId: string;
  let snapshot: Obj;
  let sequence: Obj;
  const item = (sourceId: string): Obj => {
    const found = sequence.items.find((i: Obj) => i.extensions?.['cuccut.import']?.sourceId === sourceId);
    assert.ok(found, `视频里没有 ${sourceId}`);
    return found;
  };

  before(async () => {
    mkdirSync(home, { recursive: true });
    if (!existsSync(path.join(media, 'clip.mp4'))) makeMedia();
    if (!existsSync(path.join(ccutRoot, 'fixture.ccut'))) makeBcut();
    const external = existsSync(path.join(externalRoot, 'ext-project')) ? path.join(externalRoot, 'ext-project') : makeExternal();
    const args = ['--ccut', ccutRoot, '--external', external, '--out', out, '--engine', engine as string, '--ffprobe', ffprobe as string];
    // Import three times: the second run repeats as-is (steps already written are skipped); the third run uses --replace to delete and rebuild.
    for (const extra of [[], [], ['--replace']]) {
      const run = spawnSync(process.execPath, [path.join(here, 'import.ts'), ...args, ...extra], { env, encoding: 'utf8' });
      assert.equal(run.status, 0, `导入失败：\n${run.stderr}\n${readReport()}`);
      const pass: { projects: ProjectReport[] } = JSON.parse(readFileSync(path.join(out, 'import-report.json'), 'utf8'));
      for (const r of pass.projects) assert.deepEqual(r.failed, [], `${extra.join(' ') || '重跑'}：${r.source}`);
    }
    report = JSON.parse(readFileSync(path.join(out, 'import-report.json'), 'utf8'));
    // The verification script must open the video exclusively; run it to completion first, then open it here.
    const check = spawnSync(
      process.execPath,
      [path.join(here, 'verify.ts'), out, '--engine', engine as string, '--ffprobe', ffprobe as string],
      {
        env,
        encoding: 'utf8',
      },
    );
    verified = { status: check.status, output: check.stdout + check.stderr };
    host = new EngineHost(engine as string, ffprobe as string);
    await host.request('host.hello', {});
    const timeline = report.projects.find((r) => r.kind === 'timeline');
    assert.ok(timeline?.videoDir, readReport());
    const opened = await host.request<{ videoId: string; snapshot: Obj }>('videos.open', { path: timeline.videoDir });
    videoId = opened.videoId;
    snapshot = opened.snapshot;
    sequence = snapshot.sequences[snapshot.rootSequenceId];
  });
  after(async () => {
    if (!host) return;
    try {
      if (videoId) await host.request('videos.close', { videoId });
    } finally {
      host.close();
    }
  });
  function readReport(): string {
    const file = path.join(out, 'import-report.md');
    return existsSync(file) ? readFileSync(file, 'utf8') : '';
  }

  test('both projects import with no failed items', () => {
    assert.equal(report.projects.length, 2);
    for (const r of report.projects) assert.deepEqual(r.failed, [], r.source);
    assert.equal(snapshot.schemaVersion, 3);
  });

  test('the engine rolls back no fields: what was dropped and clamped was decided at planning time', () => {
    const imported = report.projects.find((r) => r.kind === 'timeline') as ProjectReport;
    assert.deepEqual(imported.dropped, { 贴纸的取源起点与速度: 1, 关键帧缓动: 1, '关键帧（落到同一帧）': 1 });
    assert.deepEqual(imported.clamped, { 'place.opacity': 1, '关键帧 opacity': 1, 转场长度: 1, 闪避深度: 1, volume: 1 });
  });

  test('verification script passes', () => {
    assert.equal(verified.status, 0, verified.output);
    assert.match(verified.output, /视频 2 部/);
    assert.match(verified.output, /没有发现问题/);
  });

  test('verification must not report an unwritten video or media missing at import time as a success', () => {
    const empty = path.join(root, 'incomplete-import');
    mkdirSync(empty);
    writeFileSync(
      path.join(empty, 'import-report.json'),
      JSON.stringify({ projects: [{
        source: 'missing.ccut',
        videoDir: path.join(empty, 'missing'),
        assets: { missing: ['/missing/source.mp4'] },
        failed: ['fixture failure'],
      }] }),
    );
    const check = spawnSync(process.execPath, [path.join(here, 'verify.ts'), empty, '--engine', engine as string], {
      env, encoding: 'utf8',
    });
    assert.equal(check.status, 1, check.stdout + check.stderr);
    assert.match(check.stdout, /报告中的视频没有写出/);
    assert.match(check.stdout, /导入时缺失素材/);
    assert.match(check.stdout, /fixture failure/);
    assert.match(check.stdout, /没有找到任何视频/);
    assert.doesNotMatch(check.stdout, /没有发现问题/);
  });

  test('long titles and media file names over the label limit can be imported again; version and content are unchanged', () => {
    const source = path.join(root, 'long-metadata.ccut');
    mkdirSync(source);
    const file = path.join(media, 'a'.repeat(205) + '.mp4');
    copyFileSync(path.join(media, 'clip.mp4'), file);
    writeFileSync(path.join(source, 'project.json'), JSON.stringify({
      title: '🎬'.repeat(201),
      media: { path: file, fps: 30, width: 320, height: 180, duration: 2 },
    }));
    const destination = path.join(root, 'long-metadata-videos');
    let first: ProjectReport | undefined;
    for (let run = 0; run < 2; run++) {
      const result = spawnSync(process.execPath, [
        path.join(here, 'import.ts'), '--ccut', source, '--out', destination, '--engine', engine as string,
      ], { env, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      const report: ProjectReport = JSON.parse(readFileSync(path.join(destination, 'import-report.json'), 'utf8')).projects[0];
      assert.deepEqual(report.failed, []);
      assert.equal(report.name, '🎬'.repeat(201));
      assert.equal(report.clamped['video-name'], 1);
      assert.deepEqual(report.items, { video: 1 });
      if (first) assert.equal(report.revision, first.revision);
      first = report;
    }
  });

  test('instance fields are left as is after engine validation', () => {
    const image = item('i1');
    assert.deepEqual(image.place, { x: 30, y: 40, w: 20, radius: 8, opacity: 1 });
    assert.deepEqual(image.fx, { blur: 4 });
    assert.equal(image.followPolicy.kind, 'follow-cuts');
    const piece = item('c1#2');
    assert.deepEqual([piece.type, piece.mode, piece.fit, piece.bg, piece.role], ['video', 'fullscreen', 'contain', '#112233', 'a-roll']);
    assert.equal(item('t2').enabled, false);
    assert.equal(item('t2').untilSequenceEnd, true);
    assert.equal(item('t2').followPolicy.kind, 'sequence-fixed');
    for (const id of ['sh1', 'st1', 'vz1', 'pg1', 'd1', 'ph1', 'cf1', 'wb1', 'n1', 'v1', 'a1', 'a2']) item(id);
    // Lottie sticker: the engine registers the Lottie JSON as lottie; size and duration are read from the animation.
    const lottie = item('st2');
    assert.deepEqual(lottie.sticker, { source: 'asset', path: 'media/spin.json', loop: 'once', fillOverrides: { '#FF0000': '#00C853' } });
    const asset = snapshot.assets[lottie.assetRef.id];
    assert.equal(asset.kind, 'lottie');
    const revision = asset.revisions[asset.currentRevision];
    assert.deepEqual(
      [revision.video?.displayWidth, revision.video?.displayHeight, revision.duration],
      [64, 64, { ticks: '1', timescale: 1 }],
    );
  });

  test('word anchors point to the current version of the transcription document', () => {
    const speech = Object.values(snapshot.documents as Record<string, Obj>).find((d) => d.kind === 'speech');
    const policy = item('t1').followPolicy;
    assert.equal(policy.kind, 'speech-anchor');
    assert.deepEqual(policy.start.speechRef, { id: speech?.id, revision: speech?.currentRevision });
  });

  test('transcription read back through the engine keeps formal line breaks, segments and stage fields', async () => {
    const speech = Object.values(snapshot.documents as Record<string, Obj>).find((d) => d.kind === 'speech');
    assert.ok(speech);
    const { body } = await host.request<{ body: Obj }>('documents.read', { videoId, documentId: speech.id });
    assert.deepEqual(body.userBreaks, { w2: 'no-break' });
    assert.deepEqual(body.autoBreaks, { default: { w2: 'break' } });
    assert.deepEqual(body.paragraphBreaks, ['w3']);
    assert.deepEqual(body.stages, { asr: 'fixture-fingerprint' });
  });

  test('when no subtitle instance is enabled, subtitle export still finds the source media through subtitles, translations and transcription', async () => {
    const source = Object.values(snapshot.documents as Record<string, Obj>).find((d) => d.kind === 'speech');
    assert.ok(source?.sourceAssetId);
    const { snapshot: current } = await host.request<{ snapshot: Obj }>('videos.snapshot', { videoId });
    const result = await host.request<{ receipt: { refs: Record<string, string> } }>('edits.apply', {
      videoId, commandId: 'caption-source-chain', expectedRevision: current.revision,
      actor: { kind: 'system', id: 'legacy-import-test' },
      operations: [
        { type: 'putDocument', ref: 'translated', kind: 'translation', sourceDocument: { documentId: source.id },
          body: { schema: 'cuccut.translation/1', units: [] } },
        { type: 'putDocument', ref: 'captioned', kind: 'caption', sourceDocument: { ref: 'translated' },
          body: { schema: 'cuccut.caption/1', clock: 'source-asset', timescale: 1000,
            cues: [{ id: 'q', start: 0, end: 300, text: 'Hello' }] } },
      ],
    });
    const plan = await host.request<Obj>('exports.plan', {
      videoId, kind: 'text', documentIds: [result.receipt.refs.captioned],
    });
    assert.equal(plan.documents[0].sourceAssetId, source.sourceAssetId);
    assert.equal(plan.parts[0].plans[0].scope.basis, 'asset-items');
    assert.equal(plan.parts[0].plans[0].entries[0].text, 'Hello');
    assert.equal(plan.parts[0].plans[0].entries[0].start, 0);
    assert.equal(plan.parts[0].plans[0].entries[0].end, 0.3);
  });

  test('keyframes, transitions, ducking and template layers are written on the sequence', () => {
    const header = sequence.header ?? sequence;
    const bindings = (header.animationBindings as Obj[]).filter((b) => b.targetId === item('i1').id);
    assert.deepEqual(bindings.map((b) => b.propertyPath).sort(), ['opacity', 'rot', 'x']);
    assert.ok(header.template, '模板层');
    assert.equal(sequence.ducking.length, 2);
    const imported = report.projects.find((r) => r.kind === 'timeline') as ProjectReport;
    assert.equal(imported.written['单侧转场'], 2);
    assert.equal(imported.written['闪避规则'], 2);
    assert.equal(imported.written['关键帧绑定'], 3);
    // The instance is 0.6 s (18 frames); the transitions on each side take effect for at most 9 frames.
    assert.deepEqual(
      imported.shortenedTransitions.map((t) => [t.sourceId, t.side, t.effectiveFrames]),
      [
        ['v1', 'in', 9],
        ['v1', 'out', 9],
      ],
    );
  });

  test('cut set target instances are replaced with instance IDs', async () => {
    const sets = Object.values(snapshot.documents as Record<string, Obj>).filter((d) => d.kind === 'cut-set');
    assert.equal(sets.length, 2);
    for (const doc of sets) {
      const { body } = await host.request<{ body: Obj }>('documents.read', { videoId, documentId: doc.id });
      assert.ok(body.scopeItemIds.length > 0);
      for (const id of body.scopeItemIds) assert.ok(sequence.items.some((i: Obj) => i.id === id));
    }
  });
});

/** Adds dubbing to a code project: two dubbing segments claim the narration sentences in the composition (`bcfClip`), and one unclaimed music segment. */
function addNarration(dir: string): void {
  const tone = path.join(media, 'tone.wav');
  writeFileSync(
    path.join(dir, 'timeline.json'),
    JSON.stringify({
      version: '0.12',
      sources: { vo: { path: tone, kind: 'audio', duration: 2 } },
      tracks: [
        {
          id: 'dub:vo1',
          kind: 'audio',
          elements: [
            { id: 'd1', kind: 'audio', start: 0.1, end: 0.6, srcId: 'vo', srcStart: 0, bcfClip: 'vo-open-1' },
            { id: 'd2', kind: 'audio', start: 0.8, end: 1.4, srcId: 'vo', srcStart: 0.5, bcfClip: 'vo-open-2' },
          ],
        },
        { id: 'bed1', kind: 'audio', elements: [{ id: 'm1', kind: 'audio', start: 0, end: 2, srcId: 'vo' }] },
      ],
    }),
  );
}

describe('code projects: pre-rendered stand-in', { skip: noMedia }, () => {
  const plan = (dir: string): { content: VideoContent; report: ProjectReport; assets: string[] } => {
    const planned = planBcutProject(dir, new Set());
    assert.ok(planned);
    return { content: planContent(planned, dryAssets(planned)), report: planned.report, assets: planned.assets.map((a) => a.ref) };
  };
  before(() => {
    if (!existsSync(path.join(media, 'clip.mp4'))) makeMedia();
  });

  test('finding the rendered output: if there is only one video, that is it; if there are several, take the one whose file name equals the composition ID; if neither, it is not recognized', () => {
    const single = makeCode('single', ['single.mp4']);
    assert.equal(discoverFilm(single, 'comp-a'), path.join(single, 'single.mp4'));
    const named = makeCode('named', ['out/draft.mp4', 'out/comp-a.mp4', 'out/comp-a-v1.mp4']);
    assert.equal(discoverFilm(named, 'comp-a'), path.join(named, 'out', 'comp-a.mp4'));
    assert.equal(discoverFilm(named), null);
    const ambiguous = makeCode('ambiguous', ['out/draft.mp4', 'out/final.mp4']);
    assert.equal(discoverFilm(ambiguous, 'comp-a'), null);
    const hidden = makeCode('hidden', ['out/.comp-a.mp4']);
    assert.equal(discoverFilm(hidden, 'comp-a'), null);
  });

  test('when no render result was recorded, use the found output: the composition instance carries a pre-rendered stand-in, the output is registered as a render result', () => {
    const dir = makeCode('found', ['out/draft.mp4', 'out/comp-a.mp4']);
    const { content, report, assets } = plan(dir);
    assert.deepEqual(assets.sort(), ['bundle', 'main']);
    const composition = content.items.find((i) => i.item.type === 'composition');
    assert.ok(composition);
    assert.equal(composition.item.type, 'composition');
    assert.ok(composition.item.prerender, '预渲染替身');
    assert.deepEqual(report.dropped, {});
    assert.ok(report.warnings.some((w) => w.includes(path.join('out', 'comp-a.mp4'))));
  });

  test('compositions without a found output are not imported, the code package is not registered, and the report lists them by project and composition', () => {
    for (const [name, films, mediaPath] of [
      ['no-film', [], undefined],
      ['ambiguous-film', ['out/draft.mp4', 'out/final.mp4'], undefined],
      ['lost-film', [], 'out/gone.mp4'],
    ] as [string, string[], string | undefined][]) {
      const { content, report, assets } = plan(makeCode(name, films, mediaPath));
      assert.equal(content.items.length, 0, name);
      assert.ok(!assets.includes('bundle'), name);
      assert.deepEqual(report.dropped, { 没有预渲染替身的代码合成: 1 }, name);
      assert.ok(
        report.warnings.some((w) => w.includes(`项目「${name}」`) && w.includes('comp-a')),
        name,
      );
    }
  });

  test('a voiceover claimed by the composition\'s narration (bcfClip) and the composition are grouped into one audio-video linked group, and the stand-in\'s sound is turned off; unclaimed audio is not put in the group', () => {
    const dir = makeCode('narrated', ['out/comp-a.mp4']);
    addNarration(dir);
    const { content, report } = plan(dir);
    const bySource = (id: string): Obj => {
      const found = content.items.find((i) => (i.item.extensions as Obj)['cuccut.import'].sourceId === id);
      assert.ok(found, id);
      return found.item as Obj;
    };
    const composition = content.items.find((i) => i.item.type === 'composition')?.item as Obj;
    assert.ok(composition?.prerender, '带替身的合成');
    assert.equal(composition.linkGroupId, 'narration:comp-a');
    assert.equal(composition.audio.enabled, false);
    for (const [id, clip] of [
      ['d1', 'vo-open-1'],
      ['d2', 'vo-open-2'],
    ]) {
      assert.equal(bySource(id).linkGroupId, 'narration:comp-a', id);
      assert.equal(bySource(id).extensions['cuccut.import'].bcfClip, clip, `${id} 的认领留作来源说明`);
    }
    assert.equal(bySource('m1').linkGroupId, undefined);
    assert.deepEqual(report.unmapped, {});
    assert.deepEqual(report.notApplicable, {});
    assert.equal(report.written['音画联动组（合成与认领它口播的配音，bcfClip）'], 1);
    assert.equal(report.written['归进音画联动组的配音（bcfClip）'], 2);
  });

  test('when a claimed composition was not imported, the voiceover imports as ordinary audio, and the claim counts as \'not applicable\'', () => {
    const dir = makeCode('narrated-no-film', []);
    addNarration(dir);
    const { content, report } = plan(dir);
    assert.ok(content.items.every((i) => i.item.type === 'audio' && (i.item as Obj).linkGroupId === undefined));
    assert.deepEqual(report.unmapped, {});
    assert.deepEqual(report.notApplicable, { 'bcfClip（认领的代码合成没有导入，配音按普通音频导入）': 2 });
  });
});

describe('code projects go through the engine', { skip: noEngine }, () => {
  const out = path.join(root, 'code-videos');
  const env = { ...process.env, CUCCUT_HOME: home, HOME: home };
  let report: { projects: ProjectReport[] };
  let verified: { status: number | null; output: string };

  before(() => {
    mkdirSync(home, { recursive: true });
    if (!existsSync(path.join(media, 'clip.mp4'))) makeMedia();
    const source = path.join(root, 'code-engine');
    mkdirSync(source, { recursive: true });
    for (const [name, films] of [
      ['with-film', ['out/comp-a.mp4']],
      ['without-film', []],
      ['narrated-film', ['out/comp-a.mp4']],
    ] as [string, string[]][]) {
      const dir = makeCode(name, films);
      if (name.startsWith('narrated')) addNarration(dir);
      execFileSync('cp', ['-R', dir, source]);
    }
    const args = ['--ccut', source, '--out', out, '--engine', engine as string, '--ffprobe', ffprobe as string];
    const run = spawnSync(process.execPath, [path.join(here, 'import.ts'), ...args], { env, encoding: 'utf8' });
    assert.equal(run.status, 0, `导入失败：\n${run.stderr}`);
    report = JSON.parse(readFileSync(path.join(out, 'import-report.json'), 'utf8'));
    const check = spawnSync(
      process.execPath,
      [path.join(here, 'verify.ts'), out, '--engine', engine as string, '--ffprobe', ffprobe as string],
      {
        env,
        encoding: 'utf8',
      },
    );
    verified = { status: check.status, output: check.stdout + check.stderr };
  });

  test('compositions with a rendered output import as compositions with a stand-in; projects with only stand-in-less compositions import as an empty video', () => {
    const byName = (name: string): ProjectReport => {
      const found = report.projects.find((r) => r.name === name);
      assert.ok(found, name);
      assert.deepEqual(found.failed, [], name);
      return found;
    };
    const withFilm = byName('with-film');
    assert.deepEqual(withFilm.items, { composition: 1 });
    assert.equal(withFilm.assets.linked, 2);
    const withoutFilm = byName('without-film');
    assert.deepEqual(withoutFilm.items, {});
    assert.equal(withoutFilm.assets.linked, 0);
    assert.deepEqual(withoutFilm.dropped, { 没有预渲染替身的代码合成: 1 });
    assert.ok(withoutFilm.videoDir && existsSync(path.join(withoutFilm.videoDir, 'video.db')));
    // The engine accepts the audio-picture linked group: the composition and the two claimed dubbing segments are in the same group; the stand-in's sound is off.
    const narrated = byName('narrated-film');
    assert.deepEqual(narrated.items, { composition: 1, audio: 3 });
    assert.equal(narrated.written['归进音画联动组的配音（bcfClip）'], 2);
  });

  test('verification script passes', () => {
    assert.equal(verified.status, 0, verified.output);
    assert.match(verified.output, /视频 3 部/);
  });
});
