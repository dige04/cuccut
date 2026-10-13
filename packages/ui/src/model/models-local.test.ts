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
  it('转写与对齐都算语音识别；文件齐全的算已安装，not-installed 的在可下载里', () => {
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

  it('分离的模型包归音源分离，不进语音识别', () => {
    const bundles = [bundle(QWEN, { state: 'ready' }), bundle('htdemucs-ft@mlx', { capability: 'separate', state: 'installed' })];
    expect(bundleCategory(bundles[1]!)).toBe('sep');
    expect(localGroups(bundles, 'sep').installed.map((b) => b.bundleId)).toEqual(['htdemucs-ft@mlx']);
    expect(localGroups(bundles, 'asr').installed.map((b) => b.bundleId)).toEqual([QWEN]);
    expect(bundleFacts(bundles[1]!)).toMatch(/^分离 · MLX/);
  });

  it('可选组件缺了不影响已安装；权重没下、只有可选组件的仍在可下载里', () => {
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

  it('其它类还没有本地模型包', () => {
    expect(localGroups([bundle(QWEN)], 'tts')).toEqual({ installed: [], available: [] });
  });
});

describe('bundleChips', () => {
  it('默认在前，再写 Worker 状态', () => {
    expect(bundleChips(bundle(QWEN, { state: 'ready' }), true)).toEqual([
      { label: '默认', tone: 'accent' },
      { label: '已加载', tone: 'positive' },
    ]);
    expect(bundleChips(bundle(QWEN), false)).toEqual([]);
  });

  it('不可用写原因；从没装过的不加标签，装过但文件不对的提示一下', () => {
    expect(bundleChips(bundle(QWEN, { state: 'error', reason: 'resource' }), false)).toEqual([{ label: '已停用', tone: 'negative' }]);
    expect(bundleChips(bundle(QWEN, { state: 'not-installed', reason: 'missing-manifest' }), false)).toEqual([]);
    expect(bundleChips(bundle(QWEN, { state: 'not-installed', reason: 'size-mismatch' }), false)).toEqual([
      { label: '文件大小不符', tone: 'notice' },
    ]);
  });

  it('装好了、缺可选组件：写缺哪几件；必需组件缺、跑不了的不写', () => {
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
  it('事实：用途 · 后端 · 设备 · 说明', () => {
    expect(bundleFacts(bundle(QWEN))).toBe('转写 · MLX · metal');
    expect(bundleFacts(bundle(QWEN, { capability: 'align', backend: 'candle', device: 'cpu', detail: '缺少 model.safetensors' }))).toBe(
      '对齐 · Candle · cpu · 缺少 model.safetensors',
    );
  });

  it('只有停用与加载失败的能重新启用', () => {
    expect(canReenable({ state: 'error', reason: 'resource' })).toBe(true);
    expect(canReenable({ state: 'error', reason: 'load-failed' })).toBe(true);
    expect(canReenable({ state: 'error', reason: 'unsupported' })).toBe(false);
    expect(canReenable({ state: 'installed' })).toBe(false);
  });
});

describe('localDefaultPicker', () => {
  const bundles = [bundle(QWEN), bundle('other@mlx', { state: 'not-installed' }), bundle('aligner@mlx', { capability: 'align' })];

  it('没设默认：勾「自动选择」，并说出它此刻落到哪只；菜单里只有装好的转写模型包', () => {
    const picker = localDefaultPicker(fixtureView(), bundles);
    expect(picker).toMatchObject({ selectedKey: AUTO_DEFAULT, other: null, autoUses: QWEN });
    expect(picker.items.map((i) => i.key)).toEqual([AUTO_DEFAULT, QWEN]);
  });

  it('默认是本机模型包：勾它；没装的照样列出来', () => {
    const view = fixtureView();
    view.transcribe.default = { providerId: 'local', modelId: QWEN };
    expect(localDefaultPicker(view, bundles).selectedKey).toBe(QWEN);
    view.transcribe.default = { providerId: 'local', modelId: 'other@mlx' };
    const picker = localDefaultPicker(view, bundles);
    expect(picker.selectedKey).toBe('other@mlx');
    expect(picker.items.at(-1)).toEqual({ key: 'other@mlx', label: 'other@mlx（未安装）' });
  });

  it('默认是云端模型：这里不勾任何一项，如实写出是哪只', () => {
    const view = fixtureView();
    view.transcribe.default = { providerId: 'openai', modelId: 'whisper-1' };
    view.transcribe.effective = { providerId: 'openai', modelId: 'whisper-1', source: 'user-default' };
    expect(localDefaultPicker(view, bundles)).toMatchObject({ selectedKey: null, other: 'OpenAI · whisper-1', autoUses: null });
  });

  it('选项 → setDefault 参数', () => {
    expect(localDefaultChoice(AUTO_DEFAULT)).toEqual({ providerId: null });
    expect(localDefaultChoice(QWEN)).toEqual({ providerId: 'local', modelId: QWEN });
  });

  it('视图还没到时也能画', () => {
    expect(localDefaultPicker(null, []).selectedKey).toBe(AUTO_DEFAULT);
  });

  it('音源分离也有「自动选择」：出厂默认落到装好的分离模型包；菜单只列分离的模型包，设了默认就勾它', () => {
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

describe('图像生成的本地模型', () => {
  const IMAGE = 'qwen-image-2.1@mlx-4bit';
  const image = (patch: Parameters<typeof bundle>[1] = {}) => bundle(IMAGE, { capability: 'image', label: 'Qwen-Image-2.1', ...patch });

  it('文生图的模型包在图像生成一类；事实写「生图」', () => {
    expect(bundleCategory(image())).toBe('image');
    expect(localGroups([bundle(QWEN), image()], 'image').installed.map((b) => b.bundleId)).toEqual([IMAGE]);
    expect(bundleFacts(image())).toBe('生图 · MLX · metal');
  });

  it('默认菜单没有「自动选择」：没设时什么都不勾，只列装好的；设了本地的就勾它；设的那只不可选时按未设置算', () => {
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

describe('许可行', () => {
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

  it('权重的许可，再加上与它不同或要署名的组件', () => {
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

  it('只有一条权重许可时不写「模型权重 · 」，多条或组件的写名字', () => {
    const one = licenseLines(bundle('a'), lic('MIT', '可商用'));
    expect(one.map((l) => licenseLineText(l, one.length))).toEqual(['MIT · 可商用']);
    const two = licenseLines(bundle('b', { components: [comp('speaker', lic('CC-BY-4.0', '须署名'))] }), lic('MIT', '可商用'));
    expect(two.map((l) => licenseLineText(l, two.length))).toEqual(['模型权重 · MIT · 可商用', '声纹嵌入 · CC-BY-4.0 · 须署名']);
    const onlyComp = licenseLines(bundle('c', { components: [comp('speaker', lic('CC-BY-4.0', '须署名'))] }), null);
    expect(onlyComp.map((l) => licenseLineText(l, onlyComp.length))).toEqual(['声纹嵌入 · CC-BY-4.0 · 须署名']);
  });
});

describe('公共组件', () => {
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

  it('同一类里两只及以上声明的组件才算公共，按 VAD、对齐器、声纹的顺序；只有一只用的不算', () => {
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

  it('同一个仓库换了角色或版本不算同一个组件（IndexTTS2 的权重与 IndexTTS 2.5 借来的辅助件）', () => {
    const v2 = bundle('index-tts2', { capability: 'synthesize', components: [part('tts', 'installed', { repo: 'IndexTeam/IndexTTS-2' })] });
    const v25 = bundle('index-tts2.5', {
      capability: 'synthesize',
      components: [part('tts', 'installed', { repo: 'IndexTeam/IndexTTS-2.5' }), part('aux', 'installed', { repo: 'IndexTeam/IndexTTS-2' })],
    });
    expect(sharedComponents([v2, v25], 'tts')).toEqual([]);
    const old = bundle('old', { components: [part('vad', 'installed', { revision: 'r0' })] });
    expect(sharedComponents([old, moss()], 'asr')).toEqual([]);
  });

  it('自己的文件在盘上：装好了，或者公共组件以外有装好的组件；只有别人装上的公共组件不算', () => {
    const shared = sharedComponents([moss(), whisper(), qwen()], 'asr');
    expect(hasOwnFiles(moss(), shared)).toBe(true);
    expect(hasOwnFiles(whisper(), shared)).toBe(true);
    expect(hasOwnFiles(qwen(), shared)).toBe(false);
  });

  it('分组看自己的文件：权重在、缺必需分词器的 Whisper 在已安装，只有别人装上 VAD 的 Qwen 与说话人区分包在可下载', () => {
    const groups = localGroups([moss(), whisper(), qwen(), pack], 'asr');
    expect(groups.installed.map((b) => b.bundleId)).toEqual(['moss@mlx', 'whisper@coreml']);
    expect(groups.available.map((b) => b.bundleId)).toEqual(['qwen@mlx', 'speaker-diarization@mlx']);
  });

  it('权重在、缺组件的行：补齐的是缺的全部，只挂一个「缺 …」标签；在下载的不挂，自己一件没有的不挂', () => {
    expect(missingParts(whisper(), true).map((c) => c.component)).toEqual(['aligner', 'tokenizer']);
    expect(missingParts(whisper())).toEqual([]);
    expect(bundleChips(whisper(), false, true)).toEqual([{ label: '缺 Forced aligner、分词器', tone: 'notice' }]);
    const running = { jobId: 'job_1', state: 'downloading' as const, receivedBytes: 1, totalBytes: 10 };
    expect(bundleChips({ ...whisper(), install: running }, false, true)).toEqual([]);
    expect(bundleChips(qwen({ reason: 'incomplete' }), false, false)).toEqual([]);
  });

  it('装齐还要下多少：缺的组件之和，可选的也算；有不知道大小的或没有组件信息时为 null', () => {
    expect(needBytes(moss())).toBe(350);
    expect(needBytes(whisper())).toBe(305);
    expect(needBytes(whisper(null))).toBeNull();
    expect(needBytes(bundle('a'))).toBeNull();
    expect(needBytes(bundle('b', { components: [part('asr', 'installed')] }))).toBe(0);
  });

  it('缺的组件借一只文件在盘上、用到它的模型补齐，挑要下得最少的；一样多按 ID，大小不知道的排后面', () => {
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

  it('副题数文件在盘上的模型；缺着又有这种模型要用的算待补全', () => {
    const shared = sharedComponents([moss(), whisper(), qwen(), pack], 'asr');
    expect(sharedUsage(byComponent(shared, 'aligner'), shared)).toEqual({ live: 2, all: 3 });
    expect(sharedUsage(byComponent(shared, 'speaker'), shared)).toEqual({ live: 1, all: 2 });
    expect(sharedRepair(shared).map((c) => c.component)).toEqual(['aligner', 'speaker']);
    const fresh = sharedComponents([qwen(), pack, bundle('y@mlx', { state: 'not-installed', components: [part('speaker', 'missing')] })], 'asr');
    expect(sharedUsage(byComponent(fresh, 'speaker'), fresh)).toEqual({ live: 0, all: 2 });
    expect(sharedRepair(fresh)).toEqual([]);
  });

  it('组件名与说明：列了的给译名与一句说明，没列的用组件名、不写说明', () => {
    expect(componentLabel('tokenizer')).toBe('分词器');
    expect(componentDesc('vad')).toBe('切出有人说话的段落');
    expect(componentLabel('mystery')).toBe('mystery');
    expect(componentDesc('mystery')).toBeNull();
  });
});

describe('音乐模型包的 audio.cpp 引擎组件', () => {
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

  it('来源：发布页的写「GitHub 发布 仓库 标签」，标签不截断；模型仓库的写 仓库@提交前 7 位', () => {
    expect(componentSource(engine('missing'))).toBe('GitHub 发布 0xShug0/audio.cpp v0.9.1');
    expect(componentSource(weights('installed'))).toBe('audio-cpp/Yue2-3B-GGUF@cca74d8');
    expect(componentLabel('audiocpp-engine')).toBe('audio.cpp 引擎');
    expect(componentDesc('audiocpp-engine')).toMatch(/Vulkan/);
  });

  it('只有这一只模型用引擎：不进公共组件区，跟着模型的行走', () => {
    expect(sharedComponents([music('installed', 'missing')], 'music')).toEqual([]);
  });

  it('权重在、缺引擎：在已安装，挂「缺 audio.cpp 引擎」，补齐只下引擎；下载按钮的体积就是引擎的', () => {
    const half = music('installed', 'missing');
    expect(localGroups([half], 'music').installed).toEqual([half]);
    expect(missingParts(half, hasOwnFiles(half, [])).map((c) => c.component)).toEqual(['audiocpp-engine']);
    expect(bundleChips(half, false, true).map((c) => c.label)).toEqual(['缺 audio.cpp 引擎']);
    expect(needBytes(half)).toBe(32_000_000);
    expect(downloadBytes(half)).toBe(32_000_000);
    expect(bundleActions(half, true)).toMatchObject({ install: false, complete: true, repair: true, remove: true });
  });

  it('都没装：下载的体积含引擎；只有引擎（发布页组件或自建引擎）不算自己的文件在盘上', () => {
    const fresh = music('missing', 'missing');
    expect(needBytes(fresh)).toBe(4_632_000_000);
    expect(bundleActions(fresh, hasOwnFiles(fresh, []))).toMatchObject({ install: true, complete: false });
    const engineOnly = music('missing', 'installed');
    expect(hasOwnFiles(engineOnly, [])).toBe(false);
    expect(localGroups([engineOnly], 'music').available).toEqual([engineOnly]);
    expect(needBytes(engineOnly)).toBe(4_600_000_000);
  });

  it('许可：权重的，再加上引擎的 Apache-2.0', () => {
    const lines = licenseLines(music('installed', 'installed'), NC);
    expect(lines.map((l) => [l.part, l.license.name])).toEqual([
      ['模型权重', 'CC-BY-NC-4.0'],
      ['audio.cpp 引擎', 'Apache-2.0'],
    ]);
  });
});
