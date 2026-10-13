import { describe, expect, it } from 'vitest';
import {
  AUTO_DEFAULT,
  bundleCategory,
  bundleChips,
  bundleFacts,
  canReenable,
  componentDesc,
  componentLabel,
  componentSource,
  downloadBytes,
  hasOwnFiles,
  isBundleInstalled,
  licenseLines,
  licenseLineText,
  localDefaultChoice,
  localDefaultPicker,
  localGroups,
  missingParts,
  needBytes,
  sharedAction,
  sharedComponents,
  sharedRepair,
  sharedUsage,
} from './models-local.ts';
import type { ModelComponentStatus, ModelLicense } from '@cuccut/protocol';
import { bundleActions } from './models-install.ts';
import { bundle, fixtureView } from './models-test-fixtures.ts';

const QWEN = 'qwen3-asr-0.6b@mlx-4bit';

describe('localGroups', () => {
  it('transcription and alignment both count as speech recognition; complete files count as installed, not-installed ones are in downloadable', () => {
    const bundles = [
      bundle(QWEN, { state: 'ready' }),
      bundle('aligner@mlx', { capability: 'align', state: 'not-installed', reason: 'missing-manifest' }),
      bundle('broken@mlx', { state: 'error', reason: 'resource' }),
    ];
    expect(bundleCategory(bundles[1]!)).toBe('asr');
    const groups = localGroups(bundles, 'asr');
    expect(groups.installed.map((b) => b.bundleId)).toEqual(['broken@mlx', QWEN]);
    expect(groups.available.map((b) => b.bundleId)).toEqual(['aligner@mlx']);
  });

  it('separated model packs belong to audio separation, not speech recognition', () => {
    const bundles = [bundle(QWEN, { state: 'ready' }), bundle('htdemucs-ft@mlx', { capability: 'separate', state: 'installed' })];
    expect(bundleCategory(bundles[1]!)).toBe('sep');
    expect(localGroups(bundles, 'sep').installed.map((b) => b.bundleId)).toEqual(['htdemucs-ft@mlx']);
    expect(localGroups(bundles, 'asr').installed.map((b) => b.bundleId)).toEqual([QWEN]);
    expect(bundleFacts(bundles[1]!)).toMatch(/^分离 · MLX/);
  });

  it('missing optional components do not affect installed; weights not downloaded and with only optional components still in downloadable', () => {
    const component = (name: string, state: 'installed' | 'missing', optional = false) => ({
      component: name,
      repo: `test/${name}`,
      revision: 'r1',
      state,
      bytes: state === 'installed' ? 1 : null,
      sharedWith: [],
      ...(optional ? { optional } : {}),
    });
    const withOptional = bundle('moss@mlx', { components: [component('asr', 'installed'), component('aligner', 'missing', true)] });
    const missingRequired = bundle('whisper@coreml', {
      backend: 'coreml',
      state: 'not-installed',
      components: [component('asr', 'missing'), component('aligner', 'installed', true)],
    });
    expect(isBundleInstalled(withOptional)).toBe(true);
    expect(isBundleInstalled(missingRequired)).toBe(false);
    expect(localGroups([withOptional, missingRequired], 'asr').available.map((b) => b.bundleId)).toEqual(['whisper@coreml']);
    expect(localGroups([missingRequired], 'asr').available.map((b) => b.bundleId)).toEqual(['whisper@coreml']);
    expect(bundleFacts(missingRequired)).toBe('转写 · Core ML · metal');
  });

  it('other categories do not yet have local model packs', () => {
    expect(localGroups([bundle(QWEN)], 'tts')).toEqual({ installed: [], available: [] });
  });
});

describe('bundleChips', () => {
  it('default first, then write Worker status', () => {
    expect(bundleChips(bundle(QWEN, { state: 'ready' }), true)).toEqual([
      { label: '默认', tone: 'accent' },
      { label: '已加载', tone: 'positive' },
    ]);
    expect(bundleChips(bundle(QWEN), false)).toEqual([]);
  });

  it('unavailable: write the reason; never-installed gets no label; installed but files wrong gets a hint', () => {
    expect(bundleChips(bundle(QWEN, { state: 'error', reason: 'resource' }), false)).toEqual([{ label: '已停用', tone: 'negative' }]);
    expect(bundleChips(bundle(QWEN, { state: 'not-installed', reason: 'missing-manifest' }), false)).toEqual([]);
    expect(bundleChips(bundle(QWEN, { state: 'not-installed', reason: 'size-mismatch' }), false)).toEqual([
      { label: '文件大小不符', tone: 'notice' },
    ]);
  });

  it('installed with missing optional components: write which ones are missing; required missing and cannot run: not written', () => {
    const part = (component: string, patch: Partial<ModelComponentStatus> = {}): ModelComponentStatus => ({
      component,
      repo: `r/${component}`,
      revision: 'r',
      state: 'installed',
      bytes: 1,
      sharedWith: [],
      ...patch,
    });
    const missing = { optional: true, state: 'missing' as const, bytes: null };
    const half = bundle(QWEN, { state: 'ready', components: [part('asr'), part('aligner', missing), part('speaker', missing)] });
    expect(missingParts(half).map((c) => c.component)).toEqual(['aligner', 'speaker']);
    expect(bundleChips(half, false)).toEqual([
      { label: '已加载', tone: 'positive' },
      { label: '缺 Forced aligner、声纹嵌入', tone: 'notice' },
    ]);
    const required = bundle(QWEN, { state: 'not-installed', components: [part('asr', { state: 'missing' }), part('aligner', missing)] });
    expect(missingParts(required)).toEqual([]);
    expect(missingParts({ ...half, state: 'error', reason: 'unsupported' })).toEqual([]);
  });
});

describe('bundleFacts / canReenable', () => {
  it('facts: purpose · backend · device · note', () => {
    expect(bundleFacts(bundle(QWEN))).toBe('转写 · MLX · metal');
    expect(bundleFacts(bundle(QWEN, { capability: 'align', backend: 'candle', device: 'cpu', detail: '缺少 model.safetensors' }))).toBe(
      '对齐 · Candle · cpu · 缺少 model.safetensors',
    );
  });

  it('only disabled and failed-to-load can be re-enabled', () => {
    expect(canReenable({ state: 'error', reason: 'resource' })).toBe(true);
    expect(canReenable({ state: 'error', reason: 'load-failed' })).toBe(true);
    expect(canReenable({ state: 'error', reason: 'unsupported' })).toBe(false);
    expect(canReenable({ state: 'installed' })).toBe(false);
  });
});

describe('localDefaultPicker', () => {
  const bundles = [bundle(QWEN), bundle('other@mlx', { state: 'not-installed' }), bundle('aligner@mlx', { capability: 'align' })];

  it('no default set: check "auto select" and say which one it currently resolves to; menu lists only installed transcription model packs', () => {
    const picker = localDefaultPicker(fixtureView(), bundles);
    expect(picker).toMatchObject({ selectedKey: AUTO_DEFAULT, other: null, autoUses: QWEN });
    expect(picker.items.map((i) => i.key)).toEqual([AUTO_DEFAULT, QWEN]);
  });

  it('default is a local model pack: check it; not-installed ones are still listed', () => {
    const view = fixtureView();
    view.transcribe.default = { providerId: 'local', modelId: QWEN };
    expect(localDefaultPicker(view, bundles).selectedKey).toBe(QWEN);
    view.transcribe.default = { providerId: 'local', modelId: 'other@mlx' };
    const picker = localDefaultPicker(view, bundles);
    expect(picker.selectedKey).toBe('other@mlx');
    expect(picker.items.at(-1)).toEqual({ key: 'other@mlx', label: 'other@mlx（未安装）' });
  });

  it('default is a cloud model: check no item here, state honestly which one it is', () => {
    const view = fixtureView();
    view.transcribe.default = { providerId: 'openai', modelId: 'whisper-1' };
    view.transcribe.effective = { providerId: 'openai', modelId: 'whisper-1', source: 'user-default' };
    expect(localDefaultPicker(view, bundles)).toMatchObject({ selectedKey: null, other: 'OpenAI · whisper-1', autoUses: null });
  });

  it('option → setDefault parameter', () => {
    expect(localDefaultChoice(AUTO_DEFAULT)).toEqual({ providerId: null });
    expect(localDefaultChoice(QWEN)).toEqual({ providerId: 'local', modelId: QWEN });
  });

  it('can be drawn even before the view arrives', () => {
    expect(localDefaultPicker(null, []).selectedKey).toBe(AUTO_DEFAULT);
  });

  it('audio separation also has "auto select": factory default resolves to an installed separation model pack; menu lists only separation model packs, and checks it when set as default', () => {
    const SEP = 'htdemucs-ft@mlx';
    const all = [...bundles, bundle(SEP, { capability: 'separate', label: 'HTDemucs-FT' })];
    const view = fixtureView();
    view.separateAudio.effective = { providerId: 'local', modelId: SEP, source: 'factory-default' };
    const picker = localDefaultPicker(view, all, 'separate');
    expect(picker).toMatchObject({ selectedKey: AUTO_DEFAULT, hasAuto: true, autoUses: SEP, other: null });
    expect(picker.items).toEqual([
      { key: AUTO_DEFAULT, label: '自动选择' },
      { key: SEP, label: 'HTDemucs-FT' },
    ]);
    view.separateAudio.default = { providerId: 'local', modelId: SEP };
    expect(localDefaultPicker(view, all, 'separate').selectedKey).toBe(SEP);
    // Voice recognition menus are unaffected.
    expect(localDefaultPicker(view, all).items.map((i) => i.key)).toEqual([AUTO_DEFAULT, QWEN]);
  });
});

describe('local models for image generation', () => {
  const IMAGE = 'qwen-image-2.1@mlx-4bit';
  const image = (patch: Parameters<typeof bundle>[1] = {}) => bundle(IMAGE, { capability: 'image', label: 'Qwen-Image-2.1', ...patch });

  it('text-to-image model packs are in the image generation category; facts write "image generation"', () => {
    expect(bundleCategory(image())).toBe('image');
    expect(localGroups([bundle(QWEN), image()], 'image').installed.map((b) => b.bundleId)).toEqual([IMAGE]);
    expect(bundleFacts(image())).toBe('生图 · MLX · metal');
  });

  it('default menu has no "auto select": when unset nothing is checked, only installed ones are listed; when a local one is set, check it; when the set one is unselectable, treated as unset', () => {
    const bundles = [image(), bundle('half@mlx', { capability: 'image', state: 'not-installed' }), bundle(QWEN)];
    const view = fixtureView();
    const unset = localDefaultPicker(view, bundles, 'image');
    expect(unset).toMatchObject({ selectedKey: null, hasAuto: false, other: null });
    expect(unset.items).toEqual([{ key: IMAGE, label: 'Qwen-Image-2.1' }]);
    view.generateImage.default = { providerId: 'local', modelId: IMAGE };
    expect(localDefaultPicker(view, bundles, 'image').selectedKey).toBe(IMAGE);
    view.generateImage.default = { providerId: 'local', modelId: 'half@mlx' };
    expect(localDefaultPicker(view, bundles, 'image').selectedKey).toBeNull();
  });
});

describe('license row', () => {
  const lic = (name: string, summary = name): ModelLicense => ({ name, url: `https://x.test/${name}`, commercialUse: true, summary });
  const comp = (component: string, license?: ModelLicense): ModelComponentStatus => ({
    component,
    repo: `o/${component}`,
    revision: 'r',
    state: 'installed',
    bytes: 1,
    sharedWith: [],
    ...(license ? { license } : {}),
  });
  const parts = (lines: ReturnType<typeof licenseLines>) => lines.map((l) => `${l.part}:${l.license.name}`);

  it('license of the weights, plus components that differ from it or require attribution', () => {
    const apache = lic('Apache-2.0');
    const moss = bundle('moss', { components: [comp('asr'), comp('aligner', lic('Apache-2.0')), comp('speaker', lic('CC-BY-4.0'))] });
    expect(parts(licenseLines(moss, apache))).toEqual(['模型权重:Apache-2.0', '声纹嵌入:CC-BY-4.0']);
    const whisper = bundle('whisper', { components: [comp('asr'), comp('aligner', lic('Apache-2.0'))] });
    expect(parts(licenseLines(whisper, lic('MIT')))).toEqual(['模型权重:MIT', 'Forced aligner:Apache-2.0']);
    const pack = bundle('speaker-diarization@mlx', {
      capability: 'diarize',
      components: [comp('segmentation'), comp('speaker', lic('CC-BY-4.0'))],
    });
    expect(parts(licenseLines(pack, lic('MIT')))).toEqual(['模型权重:MIT', '声纹嵌入:CC-BY-4.0']);
    // Without weight licenses, list the components; with none at all, an empty table.
    expect(parts(licenseLines(pack, null))).toEqual(['声纹嵌入:CC-BY-4.0']);
    expect(licenseLines(bundle('x', { components: [comp('asr')] }), null)).toEqual([]);
    expect(parts(licenseLines(bundle('y', { components: [comp('other', lic('BSD'))] }), null))).toEqual(['other:BSD']);
  });

  it('with only one weight license, do not write "model weights · "; with multiple licenses or components, write the names', () => {
    const one = licenseLines(bundle('a'), lic('MIT', '可商用'));
    expect(one.map((l) => licenseLineText(l, one.length))).toEqual(['MIT · 可商用']);
    const two = licenseLines(bundle('b', { components: [comp('speaker', lic('CC-BY-4.0', '须署名'))] }), lic('MIT', '可商用'));
    expect(two.map((l) => licenseLineText(l, two.length))).toEqual(['模型权重 · MIT · 可商用', '声纹嵌入 · CC-BY-4.0 · 须署名']);
    const onlyComp = licenseLines(bundle('c', { components: [comp('speaker', lic('CC-BY-4.0', '须署名'))] }), null);
    expect(onlyComp.map((l) => licenseLineText(l, onlyComp.length))).toEqual(['声纹嵌入 · CC-BY-4.0 · 须署名']);
  });
});

describe('shared components', () => {
  const part = (component: string, state: 'installed' | 'missing', patch: Partial<ModelComponentStatus> = {}): ModelComponentStatus => ({
    component,
    repo: `test/${component}`,
    revision: 'r1',
    state,
    bytes: state === 'installed' ? 10 : null,
    estimatedBytes: 10,
    sharedWith: [],
    ...patch,
  });
  // MOSS is installed but lacks the optional aligner and voiceprint; Whisper weights are present but the required tokenizer is missing (incomplete); Qwen only has a VAD installed by someone else;
  // the speaker-diarization pack has none of its own files.
  const moss = (patch: Partial<Parameters<typeof bundle>[1]> = {}) =>
    bundle('moss@mlx', {
      components: [
        part('asr', 'installed', { repo: 'test/moss' }),
        part('vad', 'installed', { bytes: 2 }),
        part('aligner', 'missing', { optional: true, estimatedBytes: 300 }),
        part('speaker', 'missing', { optional: true, estimatedBytes: 50 }),
      ],
      ...patch,
    });
  const whisper = (tokenizer: number | null = 5) =>
    bundle('whisper@coreml', {
      backend: 'coreml',
      state: 'not-installed',
      reason: 'incomplete',
      components: [
        part('asr', 'installed', { repo: 'test/whisper' }),
        part('vad', 'installed', { bytes: 2 }),
        part('aligner', 'missing', { optional: true, estimatedBytes: 300 }),
        part('tokenizer', 'missing', { estimatedBytes: tokenizer }),
      ],
    });
  const qwen = (patch: Partial<Parameters<typeof bundle>[1]> = {}) =>
    bundle('qwen@mlx', {
      state: 'not-installed',
      components: [
        part('asr', 'missing', { repo: 'test/qwen', estimatedBytes: 1000 }),
        part('vad', 'installed', { bytes: 2 }),
        part('aligner', 'missing', { optional: true, estimatedBytes: 300 }),
      ],
      ...patch,
    });
  const pack = bundle('speaker-diarization@mlx', {
    capability: 'diarize',
    state: 'not-installed',
    components: [part('segmentation', 'missing'), part('speaker', 'missing', { estimatedBytes: 50 })],
  });
  const byComponent = (shared: ReturnType<typeof sharedComponents>, name: string) => shared.find((c) => c.component === name)!;

  it('components declared by two or more in the same category count as shared, in the order VAD, aligner, speaker embedding; one used alone does not count', () => {
    const shared = sharedComponents([whisper(), pack, qwen(), moss()], 'asr');
    expect(shared.map((c) => c.component)).toEqual(['vad', 'aligner', 'speaker']);
    expect(byComponent(shared, 'aligner').users.map((b) => b.bundleId)).toEqual(['moss@mlx', 'qwen@mlx', 'whisper@coreml']);
    // How much the installed files take up, and how much the missing files still need to download.
    expect(byComponent(shared, 'vad')).toMatchObject({ installed: true, bytes: 2 });
    expect(byComponent(shared, 'aligner')).toMatchObject({ installed: false, bytes: 300 });
    // Other classes, and old snapshots without component info, have no common components.
    expect(sharedComponents([moss(), qwen()], 'tts')).toEqual([]);
    expect(sharedComponents([bundle('a'), bundle('b')], 'asr')).toEqual([]);
  });

  it('same repo with a different role or version does not count as the same component (IndexTTS2 weights and auxiliary files borrowed from IndexTTS 2.5)', () => {
    const v2 = bundle('index-tts2', { capability: 'synthesize', components: [part('tts', 'installed', { repo: 'IndexTeam/IndexTTS-2' })] });
    const v25 = bundle('index-tts2.5', {
      capability: 'synthesize',
      components: [part('tts', 'installed', { repo: 'IndexTeam/IndexTTS-2.5' }), part('aux', 'installed', { repo: 'IndexTeam/IndexTTS-2' })],
    });
    expect(sharedComponents([v2, v25], 'tts')).toEqual([]);
    const old = bundle('old', { components: [part('vad', 'installed', { revision: 'r0' })] });
    expect(sharedComponents([old, moss()], 'asr')).toEqual([]);
  });

  it('own files on disk: installed, or some installed component beyond the shared ones; shared components installed only by others do not count', () => {
    const shared = sharedComponents([moss(), whisper(), qwen()], 'asr');
    expect(hasOwnFiles(moss(), shared)).toBe(true);
    expect(hasOwnFiles(whisper(), shared)).toBe(true);
    expect(hasOwnFiles(qwen(), shared)).toBe(false);
  });

  it('grouped by own files: Whisper with weights present and a required tokenizer missing counts as installed; Qwen with VAD installed only by others and the speaker diarization pack are downloadable', () => {
    const groups = localGroups([moss(), whisper(), qwen(), pack], 'asr');
    expect(groups.installed.map((b) => b.bundleId)).toEqual(['moss@mlx', 'whisper@coreml']);
    expect(groups.available.map((b) => b.bundleId)).toEqual(['qwen@mlx', 'speaker-diarization@mlx']);
  });

  it('rows with weights present but missing components: completion covers all missing ones, attaching only one "missing …" label; rows being downloaded get none, and rows with none of their own get none', () => {
    expect(missingParts(whisper(), true).map((c) => c.component)).toEqual(['aligner', 'tokenizer']);
    expect(missingParts(whisper())).toEqual([]);
    expect(bundleChips(whisper(), false, true)).toEqual([{ label: '缺 Forced aligner、分词器', tone: 'notice' }]);
    const running = { jobId: 'job_1', state: 'downloading' as const, receivedBytes: 1, totalBytes: 10 };
    expect(bundleChips({ ...whisper(), install: running }, false, true)).toEqual([]);
    expect(bundleChips(qwen({ reason: 'incomplete' }), false, false)).toEqual([]);
  });

  it('remaining download to complete: sum of missing components, optional ones included; null when some size is unknown or there is no component info', () => {
    expect(needBytes(moss())).toBe(350);
    expect(needBytes(whisper())).toBe(305);
    expect(needBytes(whisper(null))).toBeNull();
    expect(needBytes(bundle('a'))).toBeNull();
    expect(needBytes(bundle('b', { components: [part('asr', 'installed')] }))).toBe(0);
  });

  it('missing components borrow a file on disk, complete with the models that use it, choosing the one with the least download; ties by ID, unknown sizes placed last', () => {
    const pick = (bundles: Parameters<typeof sharedComponents>[0], name: string) => {
      const shared = sharedComponents(bundles, 'asr');
      const action = sharedAction(byComponent(shared, name), shared);
      return action.kind === 'get' ? `get:${action.target.bundleId}` : action.kind === 'running' ? `running:${action.bundle.bundleId}` : action.kind;
    };
    expect(pick([moss(), whisper(), qwen()], 'vad')).toBe('installed');
    // Whisper with weights present but a missing required tokenizer can also borrow; it has less to download. Qwen with no files of its own does not borrow.
    expect(pick([moss(), whisper(), qwen()], 'aligner')).toBe('get:whisper@coreml');
    expect(pick([moss(), whisper(50), qwen()], 'aligner')).toBe('get:moss@mlx');
    expect(pick([moss(), whisper(null), qwen()], 'aligner')).toBe('get:moss@mlx');
    expect(pick([moss(), pack], 'speaker')).toBe('get:moss@mlx');
    // Anything that can't run is not borrowed; if nothing can be borrowed, it waits to download together with the model install.
    expect(pick([moss({ reason: 'unsupported' }), pack], 'speaker')).toBe('later');
    const bare = bundle('x@mlx', { state: 'not-installed', components: [part('vad', 'installed', { bytes: 2 }), part('aligner', 'missing')] });
    expect(pick([qwen(), bare], 'aligner')).toBe('later');
    // A model that uses it is downloading: show its progress; a half-finished one doesn't count.
    const downloading = { jobId: 'job_1', state: 'downloading' as const, receivedBytes: 1, totalBytes: 10 };
    expect(pick([moss(), whisper(), qwen({ install: downloading })], 'aligner')).toBe('running:qwen@mlx');
    expect(pick([moss(), whisper(), qwen({ install: { ...downloading, jobId: null, state: 'paused' } })], 'aligner')).toBe('get:whisper@coreml');
  });

  it('subtitle counts models with files on disk; with missing ones that need such a model, counts as pending completion', () => {
    const shared = sharedComponents([moss(), whisper(), qwen(), pack], 'asr');
    expect(sharedUsage(byComponent(shared, 'aligner'), shared)).toEqual({ live: 2, all: 3 });
    expect(sharedUsage(byComponent(shared, 'speaker'), shared)).toEqual({ live: 1, all: 2 });
    expect(sharedRepair(shared).map((c) => c.component)).toEqual(['aligner', 'speaker']);
    const fresh = sharedComponents([qwen(), pack, bundle('y@mlx', { state: 'not-installed', components: [part('speaker', 'missing')] })], 'asr');
    expect(sharedUsage(byComponent(fresh, 'speaker'), fresh)).toEqual({ live: 0, all: 2 });
    expect(sharedRepair(fresh)).toEqual([]);
  });

  it('component names and notes: when listed, give the translated name and one sentence note; when not listed, use the component name without a note', () => {
    expect(componentLabel('tokenizer')).toBe('分词器');
    expect(componentDesc('vad')).toBe('切出有人说话的段落');
    expect(componentLabel('mystery')).toBe('mystery');
    expect(componentDesc('mystery')).toBeNull();
  });
});

describe('audio.cpp engine component of the music model pack', () => {
  const MUSIC = 'yue2-3b@audio-cpp-q8';
  const APACHE: ModelLicense = { name: 'Apache-2.0', url: 'https://github.com/0xShug0/audio.cpp/blob/main/LICENSE', commercialUse: true, summary: '可商用' };
  const NC: ModelLicense = { name: 'CC-BY-NC-4.0', url: 'https://example.test/nc', commercialUse: false, summary: '只许非商业用途' };
  const weights = (state: 'installed' | 'missing'): ModelComponentStatus => ({
    component: 'music',
    repo: 'audio-cpp/Yue2-3B-GGUF',
    revision: 'cca74d8980c00f30ab8d52248a367c01ad633ec2',
    state,
    bytes: state === 'installed' ? 4_600_000_000 : null,
    estimatedBytes: 4_600_000_000,
    sharedWith: [],
  });
  const engine = (state: 'installed' | 'missing'): ModelComponentStatus => ({
    component: 'audiocpp-engine',
    repo: '0xShug0/audio.cpp',
    revision: 'v0.9.1',
    origin: 'github-release',
    state,
    bytes: state === 'installed' ? 32_000_000 : null,
    estimatedBytes: 32_000_000,
    license: APACHE,
    sharedWith: [],
  });
  const music = (w: 'installed' | 'missing', e: 'installed' | 'missing') =>
    bundle(MUSIC, {
      capability: 'music',
      backend: 'audio-cpp',
      device: 'auto',
      state: w === 'installed' && e === 'installed' ? 'installed' : 'not-installed',
      ...(w === 'installed' && e === 'installed' ? {} : { reason: 'incomplete' as const }),
      license: NC,
      components: [weights(w), engine(e)],
    });

  it('source: release page written as "GitHub release repo tag", tag not truncated; model repo written as repo@first 7 characters of the commit', () => {
    expect(componentSource(engine('missing'))).toBe('GitHub 发布 0xShug0/audio.cpp v0.9.1');
    expect(componentSource(weights('installed'))).toBe('audio-cpp/Yue2-3B-GGUF@cca74d8');
    expect(componentLabel('audiocpp-engine')).toBe('audio.cpp 引擎');
    expect(componentDesc('audiocpp-engine')).toMatch(/Vulkan/);
  });

  it('only this one model uses the engine: not in the shared components area, follows the model\'s row', () => {
    expect(sharedComponents([music('installed', 'missing')], 'music')).toEqual([]);
  });

  it('weights present, engine missing: installed, attach "missing audio.cpp engine", completion downloads only the engine; the download button size is the engine\'s', () => {
    const half = music('installed', 'missing');
    expect(localGroups([half], 'music').installed).toEqual([half]);
    expect(missingParts(half, hasOwnFiles(half, [])).map((c) => c.component)).toEqual(['audiocpp-engine']);
    expect(bundleChips(half, false, true).map((c) => c.label)).toEqual(['缺 audio.cpp 引擎']);
    expect(needBytes(half)).toBe(32_000_000);
    expect(downloadBytes(half)).toBe(32_000_000);
    expect(bundleActions(half, true)).toMatchObject({ install: false, complete: true, repair: true, remove: true });
  });

  it('nothing installed: download size includes the engine; engine only (release page component or self-built engine) does not count as own files on disk', () => {
    const fresh = music('missing', 'missing');
    expect(needBytes(fresh)).toBe(4_632_000_000);
    expect(bundleActions(fresh, hasOwnFiles(fresh, []))).toMatchObject({ install: true, complete: false });
    const engineOnly = music('missing', 'installed');
    expect(hasOwnFiles(engineOnly, [])).toBe(false);
    expect(localGroups([engineOnly], 'music').available).toEqual([engineOnly]);
    expect(needBytes(engineOnly)).toBe(4_600_000_000);
  });

  it('license: that of the weights, plus the engine\'s Apache-2.0', () => {
    const lines = licenseLines(music('installed', 'installed'), NC);
    expect(lines.map((l) => [l.part, l.license.name])).toEqual([
      ['模型权重', 'CC-BY-NC-4.0'],
      ['audio.cpp 引擎', 'Apache-2.0'],
    ]);
  });
});
