import type { DocumentRecord, FontFaceQuery, Sequence } from '@cuccut/protocol';
import { expect, test, vi } from 'vitest';
import type { LoadedFace, LocalFont } from '../../render/local-fonts.ts';
import type { CaptionHit, RenderPlanner } from '../../render/render-planner.ts';
import { PreviewEngine, videoKey, type PreviewStatus } from './preview-engine.ts';

// The engine runs in the browser; here we only exercise the part that does not touch media elements, adding the animation frame function and ImageData that Node lacks (just enough to hold pixels).
vi.stubGlobal('requestAnimationFrame', () => 0);
vi.stubGlobal('cancelAnimationFrame', () => {});
vi.stubGlobal('ImageData', function (data: Uint8ClampedArray, width: number, height: number) {
  return { data, width, height };
});

const sequence = {
  id: 'seq',
  name: '主序列',
  fps: { num: 30, den: 1 },
  canvas: { width: 1920, height: 1080 },
  tracks: [],
  items: [],
} as unknown as Sequence;

function fakePlanner(): RenderPlanner {
  return { onRecovered: null, setVideo: () => {}, planAt: () => ({ layers: [], voices: [] }) } as unknown as RenderPlanner;
}

test('停用之后接回来的引擎照常出计划：开发模式下效果会多跑一轮清理与建立', async () => {
  const planner = Promise.resolve(fakePlanner());
  const engine = new PreviewEngine({ onTime: () => {}, onEnded: () => {} }, () => planner);
  // StrictMode order: create → clean up (dispose) → create again (resume); the planner only finishes loading after this.
  engine.dispose();
  engine.resume();
  const seen: PreviewStatus[] = [];
  engine.onStatus((status) => seen.push(status));
  engine.setVideo(sequence, {});
  await planner;
  await Promise.resolve();
  expect(seen.at(-1)).toEqual({ kind: 'ready' });
  engine.dispose();
});

test('停用了的引擎不再接计划器', async () => {
  const planner = Promise.resolve(fakePlanner());
  const engine = new PreviewEngine({ onTime: () => {}, onEnded: () => {} }, () => planner);
  engine.setVideo(sequence, {});
  engine.dispose();
  const seen: PreviewStatus[] = [];
  engine.onStatus((status) => seen.push(status));
  await planner;
  await Promise.resolve();
  expect(seen).toEqual([{ kind: 'loading' }]);
});

test('画面由帧计划器画：还在取的文档不报，跳过的层与内核的提示报出来', async () => {
  const layers = [
    { kind: 'caption', itemId: 'cap', matrix: [1, 0, 0, 1, 0, 0], opacity: 1, content: { documentId: 'doc_caption', sequenceSeconds: 0 } },
    { kind: 'shape', itemId: 'badge', matrix: [1, 0, 0, 1, 0, 0], opacity: 1, content: { shape: { shape: 'vendor-star' } } },
  ];
  const plan = { canvas: { width: 1920, height: 1080, background: '#000000', backgroundAlpha: 1 }, layers, voices: [] };
  const sentDocuments: unknown[] = [];
  const renders: number[][] = [];
  const planner = {
    onRecovered: null,
    setVideo: () => {},
    planAt: () => plan,
    setDocuments: (documents: unknown) => sentDocuments.push(documents),
    clearPictures: () => {},
    render: (_: number, width: number, height: number) => {
      renders.push([width, height]);
      return {
        plan,
        warnings: [{ code: 'EXPORT_RENDER_NOTE', detail: 'badge：字体换成了回退字体' }],
        skipped: [
          {
            itemId: 'cap',
            scope: 'layer',
            layerKind: 'caption',
            reason: 'caption-document-missing',
            message: '字幕文档 doc_caption 不在了',
          },
          { itemId: 'badge', scope: 'layer', layerKind: 'shape', reason: 'preset-unknown', message: '形状「vendor-star」不在目录里' },
        ],
        spectra: [],
      };
    },
    frame: () => new Uint8ClampedArray(960 * 540 * 4),
  } as unknown as RenderPlanner;
  const loads: string[] = [];
  const documents = { peek: () => undefined, load: (id: string) => loads.push(id), subscribe: () => () => {} };
  const engine = new PreviewEngine({ onTime: () => {}, onEnded: () => {} }, () => Promise.resolve(planner), documents);
  const puts: unknown[] = [];
  const canvas = { width: 0, height: 0, getContext: () => context };
  const context = { canvas, putImageData: (image: unknown) => puts.push(image) };
  engine.attachCanvas(canvas as unknown as HTMLCanvasElement, 0.5);
  const seen: PreviewStatus[] = [];
  engine.onStatus((status) => seen.push(status));
  engine.setVideo(sequence, {}, { doc_caption: { id: 'doc_caption', kind: 'caption', currentRevision: 'r1' } as never });
  await new Promise((resolve) => setTimeout(resolve, 10));

  expect(renders.at(-1)).toEqual([960, 540]);
  expect([canvas.width, canvas.height]).toEqual([960, 540]);
  expect(puts.length).toBeGreaterThan(0);
  expect(loads).toContain('doc_caption');
  expect(sentDocuments[0]).toEqual([{ documentId: 'doc_caption', kind: 'caption', lineKind: 'original', body: null }]);
  expect(seen.at(-1)).toEqual({ kind: 'ready', problems: ['形状「vendor-star」不在目录里', 'badge：字体换成了回退字体'] });
  engine.dispose();
});

test('转写：按文稿触发的闪避、写了 speaker 的声波与字幕要时送进计划器（取到了的），都没有时不取也不送', async () => {
  const sentSpeech: unknown[] = [];
  const planner = { ...fakePlanner(), setSpeech: (transcripts: unknown) => sentSpeech.push(transcripts) } as unknown as RenderPlanner;
  const bodies: Record<string, unknown> = { doc_a: { schema: 'cuccut.speech/1', words: [] } };
  const loads: string[] = [];
  const documents = { peek: (id: string) => bodies[id], load: (id: string) => loads.push(id), subscribe: () => () => {} };
  const engine = new PreviewEngine({ onTime: () => {}, onEnded: () => {} }, () => Promise.resolve(planner), documents);
  const records = {
    doc_a: { id: 'doc_a', kind: 'speech', sourceAssetId: 'asset_a', currentRevision: 'r1' },
    doc_b: { id: 'doc_b', kind: 'speech', currentRevision: 'r1' },
    doc_c: { id: 'doc_c', kind: 'caption', currentRevision: 'r1' },
  } as never;
  engine.setVideo({ ...sequence, ducking: [] } as Sequence, {}, records);
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(sentSpeech).toEqual([]);
  expect(loads).toEqual([]);

  const rule = { id: 'duck', enabled: true, trigger: { kind: 'speech' }, target: { itemIds: ['music'] }, depth: 12 };
  const ducked = (rules: unknown[]) => ({ ...sequence, ducking: rules }) as unknown as Sequence;
  engine.setVideo(ducked([rule]), {}, records);
  expect(loads).toEqual(['doc_b']);
  expect(sentSpeech).toEqual([[{ documentId: 'doc_a', sourceAssetId: 'asset_a', body: bodies.doc_a }]]);
  // Body unchanged: not re-sent; re-sent once the other copy is fetched.
  engine.setVideo(ducked([rule]), {}, records);
  expect(sentSpeech).toHaveLength(1);
  bodies.doc_b = { schema: 'cuccut.speech/1', words: [] };
  engine.setVideo(ducked([rule]), {}, records);
  expect(sentSpeech.at(-1)).toEqual([
    { documentId: 'doc_a', sourceAssetId: 'asset_a', body: bodies.doc_a },
    { documentId: 'doc_b', body: bodies.doc_b },
  ]);
  // Rule disabled: send an empty one, and the planner stops ducking.
  engine.setVideo(ducked([{ ...rule, enabled: false }]), {}, records);
  expect(sentSpeech.at(-1)).toEqual([]);
  // Waveforms with `speaker` set also need transcripts (segments split by speaker); those without it do not.
  const visualizer = (speaker?: string) =>
    ({
      ...sequence,
      items: [{ id: 'viz', type: 'visualizer', visualizer: { style: 'bars', ...(speaker ? { speaker } : {}) } }],
    }) as unknown as Sequence;
  engine.setVideo(visualizer(), {}, records);
  expect(sentSpeech.at(-1)).toEqual([]);
  engine.setVideo(visualizer('spk_a'), {}, records);
  expect(sentSpeech.at(-1)).toHaveLength(2);
  // Subtitles need the transcript they are derived from (word-by-word animation advances by the words in the transcript), so only that one is sent; disabled subtitle instances are not.
  const captioned = (enabled: boolean) =>
    ({ ...sequence, items: [{ id: 'cap', type: 'caption', enabled, documentId: 'doc_d' }] }) as unknown as Sequence;
  const withCaption = { ...(records as object), doc_d: { id: 'doc_d', kind: 'caption', sourceDocumentId: 'doc_a', currentRevision: 'r1' } };
  engine.setVideo(captioned(true), {}, withCaption as never);
  expect(sentSpeech.at(-1)).toEqual([{ documentId: 'doc_a', sourceAssetId: 'asset_a', body: bodies.doc_a }]);
  engine.setVideo(captioned(false), {}, withCaption as never);
  expect(sentSpeech.at(-1)).toEqual([]);
  engine.dispose();
});

test('声波要的素材频谱：在算时不报占位提示，算好了送进计划器再画一次；太大的素材不分析，报出来', async () => {
  const layers = [
    { kind: 'generator', itemId: 'viz', matrix: [1, 0, 0, 1, 0, 0], opacity: 1, content: { generator: 'cuccut.audio-visualizer' } },
  ];
  const plan = { canvas: { width: 1920, height: 1080, background: '#000000', backgroundAlpha: 1 }, layers, voices: [] };
  const music = { id: 'asset_music', revision: 'r1' };
  const huge = { id: 'asset_huge', revision: 'r1' };
  const heard = new Map<string, Uint8Array>();
  let renders = 0;
  const planner = {
    ...fakePlanner(),
    planAt: () => plan,
    setDocuments: () => {},
    clearPictures: () => {},
    analyzeAudio: async () => new Uint8Array(0),
    setAudioSpectrum: (asset: { id: string }, bytes: Uint8Array) => {
      if (heard.get(asset.id) === bytes) return false;
      heard.set(asset.id, bytes);
      return true;
    },
    render: () => {
      renders++;
      const spectra = [music, huge].filter((asset) => !heard.has(asset.id)).map((asset) => ({ itemId: 'viz', asset }));
      const warnings = spectra.length ? [{ code: 'EXPORT_RENDER_NOTE', detail: 'viz: element viz has no injected spectrum track; drew a placeholder block' }] : [];
      return { plan, warnings, skipped: [], spectra };
    },
    frame: () => new Uint8ClampedArray(960 * 540 * 4),
  } as unknown as RenderPlanner;
  const spectrum = new Uint8Array([1, 2, 3]);
  let ready = false;
  const requested: { asset: string; decoder: string }[] = [];
  let notify = () => {};
  const assets = {
    get: (asset: { id: string }, decoder: { name: string }) => {
      requested.push({ asset: asset.id, decoder: decoder.name });
      return ready ? { state: 'ready', value: spectrum } : { state: 'loading' };
    },
    subscribe: (listener: () => void) => ((notify = listener), () => {}),
  };
  const engine = new PreviewEngine({ onTime: () => {}, onEnded: () => {} }, () => Promise.resolve(planner), null, assets as never);
  const canvas = { width: 0, height: 0, getContext: () => context };
  const context = { canvas, putImageData: () => {} };
  engine.attachCanvas(canvas as unknown as HTMLCanvasElement, 0.5);
  const seen: PreviewStatus[] = [];
  engine.onStatus((status) => seen.push(status));
  const record = (id: string, byteLength: number) => ({ id, revisions: { r1: { revision: 'r1', byteLength } } });
  engine.setVideo(sequence, { asset_music: record('asset_music', 1000), asset_huge: record('asset_huge', 2 ** 30) } as never);
  await new Promise((resolve) => setTimeout(resolve, 10));

  // Items that are too large are not fetched; an item still being computed does not report a placeholder hint.
  expect(requested).toEqual([{ asset: 'asset_music', decoder: 'spectrum' }]);
  const tooLarge = '声波 viz 听的素材 asset_huge 超过 512 MB，预览不分析它的声音；导出照常';
  expect(seen.at(-1)).toEqual({ kind: 'ready', problems: [tooLarge] });

  // Computed: pass it to the planner and draw again.
  ready = true;
  const before = renders;
  notify();
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(heard.get('asset_music')).toBe(spectrum);
  expect(renders).toBeGreaterThanOrEqual(before + 2);
  engine.dispose();
});

test('写了 speaker 的声波：转写还在取时不报「没有转写」，取到了（暂停中）这一帧就送上并按转写报', async () => {
  const layers = [
    { kind: 'generator', itemId: 'viz', matrix: [1, 0, 0, 1, 0, 0], opacity: 1, content: { generator: 'cuccut.audio-visualizer' } },
  ];
  const plan = { canvas: { width: 1920, height: 1080, background: '#000000', backgroundAlpha: 1 }, layers, voices: [] };
  let speech: unknown[] = [];
  const planner = {
    ...fakePlanner(),
    planAt: () => plan,
    setDocuments: () => {},
    clearPictures: () => {},
    setSpeech: (transcripts: unknown[]) => (speech = transcripts),
    // Kernel behavior: when there is no transcript at all, it is treated as the video having no transcript; when there is a transcript but this speaker is not in it, a different message is reported.
    render: () => {
      const detail =
        speech.length === 0
          ? "viz: the video has no transcript, so the speaker spk_a's speaking times are unknown; the audio visualizer is drawn as silent"
          : 'viz: the transcript has no speech by speaker spk_a on this sequence; the audio visualizer is drawn as silent';
      return { plan, warnings: [{ code: 'EXPORT_RENDER_NOTE', detail }], skipped: [], spectra: [] };
    },
    frame: () => new Uint8ClampedArray(960 * 540 * 4),
  } as unknown as RenderPlanner;
  const bodies: Record<string, unknown> = {};
  let notify = () => {};
  const documents = {
    peek: (id: string) => bodies[id],
    load: () => {},
    subscribe: (listener: () => void) => ((notify = listener), () => {}),
  };
  const engine = new PreviewEngine({ onTime: () => {}, onEnded: () => {} }, () => Promise.resolve(planner), documents);
  const canvas = { width: 0, height: 0, getContext: () => context };
  const context = { canvas, putImageData: () => {} };
  engine.attachCanvas(canvas as unknown as HTMLCanvasElement, 0.5);
  const seen: PreviewStatus[] = [];
  engine.onStatus((status) => seen.push(status));
  const video = {
    ...sequence,
    items: [{ id: 'viz', type: 'visualizer', visualizer: { style: 'bars', speaker: 'spk_a' } }],
  } as unknown as Sequence;
  engine.setVideo(video, {}, { doc_a: { id: 'doc_a', kind: 'speech', currentRevision: 'r1' } } as never);
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(seen.at(-1)).toEqual({ kind: 'ready' });

  bodies.doc_a = { schema: 'cuccut.speech/1', words: [] };
  notify();
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(speech).toEqual([{ documentId: 'doc_a', body: bodies.doc_a }]);
  expect(seen.at(-1)).toEqual({ kind: 'ready', problems: ['viz: the transcript has no speech by speaker spk_a on this sequence; the audio visualizer is drawn as silent'] });
  engine.dispose();
});

test.each([
  ['SVG', 'image/svg+xml'],
  ['GIF', 'image/gif'],
])('%s 图片层：送素材字节、不读图片元素的像素；字节还在取时先留着上一帧', async (_label, mediaType) => {
  const svg = { id: 'asset_svg', revision: 'r1' };
  const layers = [{ kind: 'image', itemId: 'sticker', asset: svg, matrix: [1, 0, 0, 1, 0, 0], opacity: 1 }];
  const plan = { canvas: { width: 1920, height: 1080, background: '#000000', backgroundAlpha: 1 }, layers, voices: [] };
  const sentAssets: { asset: unknown; bytes: Uint8Array }[] = [];
  const pictures: string[] = [];
  let renders = 0;
  const planner = {
    ...fakePlanner(),
    planAt: () => plan,
    setDocuments: () => {},
    clearPictures: () => {},
    setPicture: (itemId: string) => pictures.push(itemId),
    setAsset: (asset: unknown, bytes: Uint8Array) => sentAssets.push({ asset, bytes }),
    render: () => (renders++, { plan, warnings: [], skipped: [], spectra: [] }),
    frame: () => new Uint8ClampedArray(960 * 540 * 4),
  } as unknown as RenderPlanner;
  const bytes = new TextEncoder().encode('<svg/>');
  let ready = false;
  let notify = () => {};
  const requested: string[] = [];
  const assets = {
    get: (asset: { id: string }, decoder: { name: string }) => {
      requested.push(`${asset.id}:${decoder.name}`);
      return ready ? { state: 'ready', value: bytes } : { state: 'loading' };
    },
    subscribe: (listener: () => void) => ((notify = listener), () => {}),
  };
  const engine = new PreviewEngine({ onTime: () => {}, onEnded: () => {} }, () => Promise.resolve(planner), null, assets as never);
  const canvas = { width: 0, height: 0, getContext: () => context };
  const context = { canvas, putImageData: () => {} };
  engine.attachCanvas(canvas as unknown as HTMLCanvasElement, 0.5);
  const record = { id: 'asset_svg', revisions: { r1: { revision: 'r1', mediaType, byteLength: 6 } } };
  engine.setVideo(sequence, { asset_svg: record } as never);
  await new Promise((resolve) => setTimeout(resolve, 10));

  // Still fetching: don't draw yet (wait for the bytes, for a limited time), and don't look for the image element either.
  expect(requested).toContain('asset_svg:bytes');
  expect(renders).toBe(0);

  ready = true;
  notify();
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(renders).toBeGreaterThan(0);
  expect(sentAssets.at(-1)).toEqual({ asset: svg, bytes });
  expect(pictures).toEqual([]);
  engine.dispose();
});

test('本机字体：报缺的族里排字点了名的 face 向宿主要一次，到了注入计划器再画；取的时候不报缺字体，取不到的照报', async () => {
  const layers = [{ kind: 'text', itemId: 'title', matrix: [1, 0, 0, 1, 0, 0], opacity: 1, content: {} }];
  const plan = { canvas: { width: 1920, height: 1080, background: '#000000', backgroundAlpha: 1 }, layers, voices: [] };
  const note = (family: string) => ({
    code: 'EXPORT_RENDER_NOTE',
    detail: `title: font "${family}" is not available in the current font library; falling back to Noto Sans SC`,
  });
  const face = (family: string, weight = 400) => ({ family, weight, italic: false });
  const injected: string[] = [];
  let renders = 0;
  let bold = false;
  const planner = {
    ...fakePlanner(),
    planAt: () => plan,
    setDocuments: () => {},
    clearPictures: () => {},
    addLocalFont: (font: LocalFont) => injected.push(font.key),
    render: () => {
      renders++;
      const missing = injected.length > 0 ? ['Nowhere'] : ['Climate Crisis', 'Nowhere'];
      // Built-in families and families already present are also named; a bold weight that shows up later, whose family is no longer missing, must still be requested.
      const faces = [face('Climate Crisis'), face('Nowhere'), face('Permanent Marker'), ...(bold ? [face('Climate Crisis', 700)] : [])];
      return { plan, warnings: missing.map(note), skipped: [], spectra: [], fonts: missing, faces };
    },
    frame: () => new Uint8ClampedArray(960 * 540 * 4),
  } as unknown as RenderPlanner;
  const asked: FontFaceQuery[][] = [];
  let deliver: (faces: LoadedFace[]) => void = () => {};
  const fonts = {
    load: (faces: readonly FontFaceQuery[]) => (asked.push([...faces]), new Promise<LoadedFace[]>((resolve) => (deliver = resolve))),
  };
  const engine = new PreviewEngine({ onTime: () => {}, onEnded: () => {} }, () => Promise.resolve(planner), null, null, fonts);
  const canvas = { width: 0, height: 0, getContext: () => context };
  const context = { canvas, putImageData: () => {} };
  engine.attachCanvas(canvas as unknown as HTMLCanvasElement, 0.5);
  const seen: PreviewStatus[] = [];
  engine.onStatus((status) => seen.push(status));
  engine.setVideo(sequence, {});
  await new Promise((resolve) => setTimeout(resolve, 10));

  // Fetching: the faces of the two missing families are requested together in one go (built-in families are not requested); the hint is not reported yet.
  expect(asked).toEqual([[face('Climate Crisis'), face('Nowhere')]]);
  expect(seen.at(-1)).toEqual({ kind: 'ready' });
  const before = renders;
  const loaded = (query: FontFaceQuery): LoadedFace => ({
    query,
    font: { key: `${query.family}/${query.weight}`, load: async () => new Uint8Array() },
    bytes: new Uint8Array([7]),
  });
  deliver([loaded(face('Climate Crisis'))]);
  await new Promise((resolve) => setTimeout(resolve, 10));
  // Arrived: inject it and draw again; families that cannot be found are still reported, and are not asked for again.
  expect(injected).toEqual(['Climate Crisis/400']);
  expect(renders).toBeGreaterThan(before);
  expect(asked).toHaveLength(1);
  expect(seen.at(-1)).toEqual({ kind: 'ready', problems: [note('Nowhere').detail] });
  // A bold weight of the same family is queued later: still request it.
  bold = true;
  engine.seek(0.1);
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(asked.at(-1)).toEqual([face('Climate Crisis', 700)]);
  deliver([]);
  await new Promise((resolve) => setTimeout(resolve, 10));
  // A family reported missing has since been downloaded (via “Download” in the font bar, or downloaded during export): forget what was asked, and request again on redraw. Other families are left alone.
  const count = asked.length;
  engine.retryFonts(['Permanent Marker']);
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(asked).toHaveLength(count);
  engine.retryFonts(['nowhere']);
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(asked.at(-1)).toEqual([face('Nowhere')]);
  engine.dispose();
});

/** Animation frames and clock that advance one step at a time: `tick(ms)` sets the clock to `ms` and then runs the queued callbacks. */
function manualFrames() {
  let callbacks: FrameRequestCallback[] = [];
  let now = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => callbacks.push(callback));
  const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
  return {
    tick(ms: number) {
      now = ms;
      const due = callbacks;
      callbacks = [];
      for (const callback of due) callback(now);
    },
    restore() {
      clock.mockRestore();
      vi.stubGlobal('requestAnimationFrame', () => 0);
    },
  };
}

/** Planner for playback: plan frame numbers are derived from the time at 30 fps, and the time and size of each draw are recorded. */
function playablePlanner() {
  const renders: { seconds: number; width: number; height: number }[] = [];
  const planAt = (seconds: number) => ({
    sequenceId: 'seq',
    sequenceRevision: 'r1',
    frame: Math.floor(seconds * 30 + 1e-6),
    canvas: { width: 1920, height: 1080, background: '#000000', backgroundAlpha: 1 },
    layers: [{ kind: 'text', itemId: 'title', matrix: [1, 0, 0, 1, 0, 0], opacity: 1, content: {} }],
    voices: [],
  });
  const planner = {
    ...fakePlanner(),
    planAt,
    setDocuments: () => {},
    clearPictures: () => {},
    render: (seconds: number, width: number, height: number) => {
      renders.push({ seconds, width, height });
      return { plan: planAt(seconds), warnings: [], skipped: [], spectra: [], fonts: [] };
    },
    frame: () => new Uint8ClampedArray(4),
  } as unknown as RenderPlanner;
  return { planner, renders };
}

const playable = {
  ...sequence,
  items: [{ id: 'title', type: 'text', enabled: true, trackId: 't', span: { fromFrame: 0, durationFrames: 300 } }],
} as unknown as Sequence;

test('播放中同一个视频帧只画一次；有东西变了（文档、素材、字体、尺寸）的那一帧照画', async () => {
  const frames = manualFrames();
  const { planner, renders } = playablePlanner();
  let notify = () => {};
  const documents = { peek: () => undefined, load: () => {}, subscribe: (listener: () => void) => ((notify = listener), () => {}) };
  const engine = new PreviewEngine({ onTime: () => {}, onEnded: () => {} }, () => Promise.resolve(planner), documents);
  const canvas = { width: 0, height: 0, getContext: () => ({ canvas, putImageData: () => {} }) };
  engine.attachCanvas(canvas as unknown as HTMLCanvasElement, 0.5);
  engine.setVideo(playable, {});
  await new Promise((resolve) => setTimeout(resolve, 10));
  renders.length = 0;

  engine.play();
  // 60 Hz refresh playing 30 fps video: 6 ticks in 0.1 s, spanning 3 video frames (frame 0 was already drawn when paused).
  for (let i = 1; i <= 6; i++) frames.tick(i * (1000 / 60));
  expect(renders.map((render) => Math.floor(render.seconds * 30 + 1e-6))).toEqual([1, 2, 3]);
  expect(engine.stats.repeated).toBe(3);
  expect(engine.stats.presented).toBe(3);

  // Body arrived: redraw even the same frame.
  notify();
  frames.tick(6.5 * (1000 / 60));
  expect(renders).toHaveLength(4);
  engine.pause();
  frames.restore();
  engine.dispose();
});

test('播放中按像素预算降分辨率画；停下来画回原尺寸的那一帧', async () => {
  const frames = manualFrames();
  const { planner, renders } = playablePlanner();
  const engine = new PreviewEngine({ onTime: () => {}, onEnded: () => {} }, () => Promise.resolve(planner));
  const canvas = { width: 0, height: 0, getContext: () => ({ canvas, putImageData: () => {} }) };
  engine.attachCanvas(canvas as unknown as HTMLCanvasElement, 1);
  engine.setVideo(playable, {});
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(renders.at(-1)).toMatchObject({ width: 1920, height: 1080 });
  expect(canvas).toMatchObject({ width: 1920, height: 1080 });
  renders.length = 0;

  engine.play();
  for (let i = 1; i <= 4; i++) frames.tick(i * (1000 / 30));
  expect(renders.map(({ width, height }) => `${width}×${height}`)).toEqual(Array(4).fill('960×540'));
  expect(canvas).toMatchObject({ width: 960, height: 540 });
  expect(engine.stats.size).toEqual({ width: 960, height: 540 });

  // Stopped: the paused frame is redrawn at its original size (the same frame as export), at the moment it stopped.
  engine.pause();
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(renders).toHaveLength(5);
  expect(renders[4]).toEqual({ seconds: renders[3]!.seconds, width: 1920, height: 1080 });
  expect(canvas).toMatchObject({ width: 1920, height: 1080 });
  frames.restore();
  engine.dispose();
});

/** A fake media element (Node has none): seeking only lands after `land()` is called, and the picture read out records where the element was when it was read. */
function fakeMedia() {
  class FakeMedia {
    static HAVE_METADATA = 1;
    static HAVE_CURRENT_DATA = 2;
    readyState = 4;
    seeking = false;
    error = null;
    paused = true;
    duration = 60;
    muted = false;
    volume = 1;
    playbackRate = 1;
    #time = 0;
    #listeners: (() => void)[] = [];
    get currentTime() {
      return this.#time;
    }
    set currentTime(seconds: number) {
      this.#time = seconds;
      this.seeking = true;
    }
    /** Seek lands: fires `seeked`. */
    land() {
      this.seeking = false;
      for (const listener of this.#listeners) listener();
    }
    pause() {
      this.paused = true;
    }
    play() {
      this.paused = false;
      return Promise.resolve();
    }
    addEventListener(type: string, listener: () => void) {
      if (type === 'seeked') this.#listeners.push(listener);
    }
    removeEventListener() {}
  }
  class FakeVideo extends FakeMedia {
    videoWidth = 1920;
    videoHeight = 1080;
  }
  class FakeImage {}
  vi.stubGlobal('HTMLMediaElement', FakeMedia);
  vi.stubGlobal('HTMLVideoElement', FakeVideo);
  vi.stubGlobal('HTMLImageElement', FakeImage);
  let drawn: FakeVideo | null = null;
  const scratch = {
    canvas: { width: 0, height: 0 },
    clearRect: () => {},
    drawImage: (element: FakeVideo) => (drawn = element),
    getImageData: (_x: number, _y: number, width: number, height: number) => ({ data: { at: drawn!.currentTime }, width, height }),
  };
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => scratch }) });
  return { video: new FakeVideo() };
}

test('停着定位：视频还在定位时先用它上一张画面马上画，落地了画精确的那一帧；拖动中降分辨率，停下画回原尺寸', async () => {
  const { video } = fakeMedia();
  const asset = { id: 'asset_v', revision: 'r1' };
  const renders: { seconds: number; width: number; picture: number | null }[] = [];
  let picture: number | null = null;
  const planAt = (seconds: number) => ({
    sequenceId: 'seq',
    sequenceRevision: 'r1',
    frame: Math.floor(seconds * 30 + 1e-6),
    canvas: { width: 1920, height: 1080, background: '#000000', backgroundAlpha: 1 },
    layers: [{ kind: 'video', itemId: 'clip', asset, sourceSeconds: seconds, sourceRate: 1, matrix: [1, 0, 0, 1, 0, 0], opacity: 1 }],
    voices: [],
  });
  const planner = {
    ...fakePlanner(),
    planAt,
    setDocuments: () => {},
    clearPictures: () => (picture = null),
    setPicture: (_: string, data: { at: number }) => (picture = data.at),
    render: (seconds: number, width: number) => {
      renders.push({ seconds, width, picture });
      return { plan: planAt(seconds), warnings: [], skipped: [], spectra: [], fonts: [] };
    },
    frame: () => new Uint8ClampedArray(4),
  } as unknown as RenderPlanner;
  const engine = new PreviewEngine({ onTime: () => {}, onEnded: () => {} }, () => Promise.resolve(planner));
  const canvas = { width: 0, height: 0, getContext: () => ({ canvas, putImageData: () => {} }) };
  engine.attachCanvas(canvas as unknown as HTMLCanvasElement, 1);
  engine.register(videoKey(asset, 0), video as unknown as HTMLVideoElement);
  engine.setVideo(sequence, {});
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(renders.at(-1)).toEqual({ seconds: 0, width: 1920, picture: 0 });
  expect(engine.exact).toBe(true);

  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  try {
    // Single tap: the element is still seeking, so don't wait; draw the previous picture at the playback resolution.
    renders.length = 0;
    engine.seek(2);
    await vi.advanceTimersByTimeAsync(0);
    expect(renders).toEqual([{ seconds: 2, width: 960, picture: 0 }]);
    expect(engine.exact).toBe(false);
    // Landed: draw the exact frame; if already paused on it, don't draw again.
    video.land();
    await vi.advanceTimersByTimeAsync(0);
    expect(renders.at(-1)).toEqual({ seconds: 2, width: 1920, picture: 2 });
    expect(engine.exact).toBe(true);
    await vi.advanceTimersByTimeAsync(300);
    expect(renders).toHaveLength(2);

    // Dragging: each seek is drawn immediately at reduced resolution (landed ones too).
    renders.length = 0;
    for (const seconds of [3, 4, 5]) {
      engine.seek(seconds);
      await vi.advanceTimersByTimeAsync(0);
      video.land();
      await vi.advanceTimersByTimeAsync(50);
    }
    expect(renders.map(({ seconds, width }) => `${seconds}@${width}`)).toEqual(['3@960', '3@1920', '4@960', '4@960', '5@960', '5@960']);
    expect(engine.exact).toBe(false);
    // Stopped: draw the paused frame at original size, the same frame as export.
    await vi.advanceTimersByTimeAsync(300);
    expect(renders.at(-1)).toEqual({ seconds: 5, width: 1920, picture: 5 });
    expect(engine.exact).toBe(true);

    // Stopped before it landed: wait for it to land, then draw the exact frame.
    renders.length = 0;
    engine.seek(9);
    await vi.advanceTimersByTimeAsync(300);
    expect(renders).toEqual([{ seconds: 9, width: 960, picture: 5 }]);
    expect(engine.exact).toBe(false);
    video.land();
    await vi.advanceTimersByTimeAsync(0);
    expect(renders.at(-1)).toEqual({ seconds: 9, width: 1920, picture: 9 });
    expect(engine.exact).toBe(true);
  } finally {
    vi.useRealTimers();
    engine.dispose();
    vi.unstubAllGlobals();
    vi.stubGlobal('requestAnimationFrame', () => 0);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.stubGlobal('ImageData', function (data: Uint8ClampedArray, width: number, height: number) {
      return { data, width, height };
    });
  }
});

test('字幕命中框随实际出帧通知；换帧先清空旧框，没有几何的帧不沿用旧字幕', async () => {
  const plan = { sequenceId: 'seq', sequenceRevision: 'r1', frame: 0, canvas: sequence.canvas, layers: [], voices: [] };
  const hits: CaptionHit[] = [{ layerId: 'cap', itemId: 'cap', documentId: 'doc', cueId: 'c1', cx: 960, cy: 900, w: 800, h: 50, rotation: 0 }];
  let captionHits: CaptionHit[] = hits;
  let frame = 0;
  const planner = {
    onRecovered: null,
    setVideo: () => {},
    setDocuments: () => {},
    clearPictures: () => {},
    planAt: () => ({ ...plan, frame }),
    render: () => ({ plan: { ...plan, frame }, captionHits, warnings: [], skipped: [], spectra: [] }),
    frame: () => new Uint8ClampedArray(960 * 540 * 4),
  } as unknown as RenderPlanner;
  const engine = new PreviewEngine({ onTime: () => {}, onEnded: () => {} }, () => Promise.resolve(planner));
  const context = { canvas: { width: 0, height: 0 }, putImageData: () => {} };
  engine.attachCanvas({ getContext: () => context } as unknown as HTMLCanvasElement, 0.5);
  const seen: (readonly CaptionHit[])[] = [];
  const stop = engine.onCaptionHits((hits) => seen.push(hits));
  engine.setVideo(sequence, {});
  await vi.waitFor(() => expect(engine.captionHits).toEqual(hits));
  // Output pixels have already been mapped back to sequence coordinates in the kernel, so the engine does not apply the preview scale again.
  expect(seen.at(-1)?.[0]?.cx).toBe(960);
  frame = 30;
  captionHits = [];
  engine.seek(1);
  expect(engine.captionHits).toEqual([]);
  await vi.waitFor(() => expect(seen.at(-1)).toEqual([]));
  stop();
  engine.dispose();
});

test('转录中的临时字幕：叠进送给计划器的序列，文档不向 Runtime 取，点选与提示都不算它，收起后照原样送', async () => {
  const live = {
    kind: 'caption',
    itemId: 'cc-live-caption',
    matrix: [1, 0, 0, 1, 0, 0],
    opacity: 1,
    content: { documentId: 'cc-live-caption-document', styleDocumentId: 'cc-live-caption-style', sequenceSeconds: 0 },
  };
  const plan = { canvas: { width: 1920, height: 1080, background: '#000000', backgroundAlpha: 1 }, layers: [live], voices: [] };
  const videos: Sequence[] = [];
  const sentDocuments: Array<Array<{ documentId: string; body: unknown }>> = [];
  const hit: CaptionHit = {
    layerId: 'cc-live-caption',
    itemId: 'cc-live-caption',
    documentId: 'cc-live-caption-document',
    cueId: 'live-0',
    cx: 1,
    cy: 1,
    w: 10,
    h: 10,
    rotation: 0,
  } as CaptionHit;
  const planner = {
    onRecovered: null,
    setVideo: ({ sequence: s }: { sequence: Sequence }) => videos.push(s),
    planAt: () => plan,
    setDocuments: (documents: Array<{ documentId: string; body: unknown }>) => sentDocuments.push(documents),
    setSpeech: () => {},
    clearPictures: () => {},
    render: () => ({
      plan,
      captionHits: [hit],
      warnings: [{ code: 'EXPORT_RENDER_NOTE', detail: 'cc-live-caption: font substituted with a fallback font' }],
      skipped: [],
      spectra: [],
    }),
    frame: () => new Uint8ClampedArray(960 * 540 * 4),
  } as unknown as RenderPlanner;
  const loads: string[] = [];
  const documents = { peek: () => undefined, load: (id: string) => loads.push(id), subscribe: () => () => {} };
  const engine = new PreviewEngine({ onTime: () => {}, onEnded: () => {} }, () => Promise.resolve(planner), documents);
  const canvas = { width: 0, height: 0, getContext: () => context };
  const context = { canvas, putImageData: () => {} };
  engine.attachCanvas(canvas as unknown as HTMLCanvasElement, 0.5);
  const seen: PreviewStatus[] = [];
  engine.onStatus((status) => seen.push(status));
  const timed = {
    ...sequence,
    revision: '3',
    items: [{ id: 'v', trackId: 't', type: 'video', span: { fromFrame: 0, durationFrames: 300 } }],
  } as unknown as Sequence;
  engine.setVideo(timed, {});
  await new Promise((resolve) => setTimeout(resolve, 10));
  engine.setLiveCaption('job_t', [{ key: 'a', start: 1, end: 3, text: '你好' }]);
  await new Promise((resolve) => setTimeout(resolve, 10));

  const sent = videos.at(-1)!;
  expect(sent.revision).toBe('3');
  expect(sent.items.map((item) => item.id)).toEqual(['v', 'cc-live-caption']);
  expect(loads).toEqual([]);
  const docs = sentDocuments.at(-1)!;
  expect(docs.map((d) => d.documentId)).toEqual(['cc-live-caption-document', 'cc-live-caption-style']);
  expect(docs[0]!.body).toMatchObject({ clock: 'sequence', cues: [{ start: 1000, end: 3000, text: '你好' }] });
  expect(engine.captionHits).toEqual([]);
  expect(seen.at(-1)).toEqual({ kind: 'ready' });

  // When the stage hides subtitles (`off`), temporary captions are not overlaid either; overlaying resumes when released.
  engine.setCaptionView('off');
  expect(videos.at(-1)!.items.map((item) => item.id)).toEqual(['v']);
  engine.setCaptionView(null);
  expect(videos.at(-1)!.items.map((item) => item.id)).toEqual(['v', 'cc-live-caption']);

  engine.setLiveCaption('job_t', null);
  expect(videos.at(-1)).toBe(timed);
  engine.dispose();
});

test('倍速：播放中从换的那一刻起按新倍速走钟，媒体元素跟着乘上倍速', async () => {
  const { video } = fakeMedia();
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
  let now = 1000;
  const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
  const asset = { id: 'asset_v', revision: 'r1' };
  const planAt = (seconds: number) => ({
    sequenceId: 'seq',
    sequenceRevision: 'r1',
    frame: Math.floor(seconds * 30 + 1e-6),
    canvas: { width: 1920, height: 1080, background: '#000000', backgroundAlpha: 1 },
    layers: [{ kind: 'video', itemId: 'clip', asset, sourceSeconds: seconds, sourceRate: 1.5, matrix: [1, 0, 0, 1, 0, 0], opacity: 1 }],
    voices: [],
  });
  const planner = { ...fakePlanner(), planAt } as unknown as RenderPlanner;
  const times: number[] = [];
  const engine = new PreviewEngine({ onTime: (seconds) => times.push(seconds), onEnded: () => {} }, () => Promise.resolve(planner));
  engine.register(videoKey(asset, 0), video as unknown as HTMLVideoElement);
  const timed = {
    ...sequence,
    items: [{ id: 'clip', trackId: 't', type: 'video', assetRef: asset, span: { fromFrame: 0, durationFrames: 300 } }],
  } as unknown as Sequence;
  try {
    engine.setVideo(timed, {});
    await new Promise((resolve) => setTimeout(resolve, 10));
    engine.play();
    expect(video.playbackRate).toBe(1.5);
    now = 2000;
    engine.setRate(2);
    expect(engine.rate).toBe(2);
    expect(video.playbackRate).toBe(3);
    // One second was played before the speed change; the next second plays at 2x.
    now = 3000;
    frames.at(-1)!(now);
    expect(times.at(-1)).toBeCloseTo(3);
    engine.setRate(100);
    expect(engine.rate).toBe(16);
  } finally {
    engine.dispose();
    clock.mockRestore();
    vi.unstubAllGlobals();
    vi.stubGlobal('requestAnimationFrame', () => 0);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.stubGlobal('ImageData', function (data: Uint8ClampedArray, width: number, height: number) {
      return { data, width, height };
    });
  }
});

test('字幕档位：送给计划器的序列上停用不该露的字幕，换视频时照样停，收起后照原样送', async () => {
  const videos: Sequence[] = [];
  const planner = { ...fakePlanner(), setVideo: ({ sequence: s }: { sequence: Sequence }) => videos.push(s) } as unknown as RenderPlanner;
  const engine = new PreviewEngine({ onTime: () => {}, onEnded: () => {} }, () => Promise.resolve(planner));
  const documents = {
    speech: { id: 'speech', kind: 'speech' },
    trans: { id: 'trans', kind: 'translation' },
    orig: { id: 'orig', kind: 'caption', sourceDocumentId: 'speech' },
    en: { id: 'en', kind: 'caption', sourceDocumentId: 'trans' },
  } as unknown as Record<string, DocumentRecord>;
  const captioned = {
    ...sequence,
    items: [
      { id: 'a', trackId: 's', type: 'caption', enabled: true, documentId: 'orig', span: { fromFrame: 0, durationFrames: 30 } },
      { id: 'b', trackId: 's', type: 'caption', enabled: true, documentId: 'en', span: { fromFrame: 0, durationFrames: 30 } },
    ],
  } as unknown as Sequence;
  const enabled = (s: Sequence | undefined) => s?.items.map((item) => `${item.id}:${item.enabled}`);
  engine.setVideo(captioned, {}, documents);
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(videos.at(-1)).toBe(captioned);

  engine.setCaptionView('trans');
  expect(enabled(videos.at(-1))).toEqual(['a:false', 'b:true']);
  const edited = { ...captioned, revision: '2' } as Sequence;
  engine.setVideo(edited, {}, documents);
  expect(videos.at(-1)?.revision).toBe('2');
  expect(enabled(videos.at(-1))).toEqual(['a:false', 'b:true']);

  engine.setCaptionView(null);
  expect(videos.at(-1)).toBe(edited);
  engine.dispose();
});

test('监听音量变了时通知订阅者；订阅时先给一次当前的', () => {
  const engine = new PreviewEngine({ onTime: () => {}, onEnded: () => {} }, () => Promise.resolve(fakePlanner()));
  const seen: { volume: number; muted: boolean }[] = [];
  const stop = engine.onMonitor((monitor) => seen.push(monitor));
  engine.setMonitor({ volume: 0.4, muted: true });
  stop();
  engine.setMonitor({ volume: 1, muted: false });
  expect(seen).toEqual([
    { volume: 1, muted: false },
    { volume: 0.4, muted: true },
  ]);
  engine.dispose();
});
