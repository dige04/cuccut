import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '@cuccut/protocol';
import type {
  ModelBundleStatus,
  ModelInstallPlan,
  ModelSelfTestResult,
  ModelsDirInfo,
  ModelsDirInspection,
  ProviderAccountView,
  UsageReport,
} from '@cuccut/protocol';
import {
  accountOrderWithFirst,
  findAccount,
  formatAccountLines,
  formatMoney,
  formatUsageReport,
  USAGE_PERIOD_LABELS,
  dirMode,
  dirProblem,
  formatBundleLines,
  formatDirInspection,
  formatModelsDir,
  formatByteProgress,
  formatBytes,
  formatInstallPlan,
  formatRemoveResult,
  inspectDirChange,
  installFailureLines,
  installPrompt,
  removeTarget,
} from './models-output.ts';

const base: ModelBundleStatus = {
  bundleId: 'qwen3-asr-0.6b@mlx-4bit',
  capability: 'transcribe',
  backend: 'mlx',
  device: 'metal',
  state: 'installed',
};

const plan = (patch: Partial<ModelInstallPlan> = {}): ModelInstallPlan => ({
  bundleId: 'qwen3-asr-0.6b@mlx-4bit',
  components: [
    {
      component: 'asr',
      repo: 'o/asr',
      revision: 'a'.repeat(40),
      action: 'download',
      files: ['config.json', 'model.safetensors'],
      bytes: 700 * 1024 * 1024,
    },
    { component: 'vad', repo: 'o/vad', revision: 'b'.repeat(40), action: 'keep', files: [], bytes: 0 },
  ],
  downloadBytes: 700 * 1024 * 1024,
  estimatedBytes: 700 * 1024 * 1024,
  confirmBytes: 700 * 1024 * 1024,
  resumedBytes: 0,
  availableBytes: 50 * 1024 * 1024 * 1024,
  source: 'https://huggingface.co',
  upToDate: false,
  ...patch,
});

describe('models output', () => {
  it('bytes and progress: no percentage when the total is unknown', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(700 * 1024 * 1024)).toBe('700.0 MB');
    expect(formatBytes(3 * 1024 ** 3)).toBe('3.0 GB');
    expect(formatByteProgress(512 * 1024, 1024 * 1024)).toBe('512.0 KB / 1.0 MB（50%）');
    expect(formatByteProgress(512 * 1024, null)).toBe('已收到 512.0 KB（总大小未知）');
    expect(formatByteProgress(10, null)).not.toContain('%');
  });

  it('model pack: status, components (shared), install progress (hints at resuming when paused) and last check', () => {
    const lines = formatBundleLines({
      ...base,
      state: 'not-installed',
      reason: 'incomplete',
      detail: '缺少组件：asr',
      components: [
        { component: 'asr', repo: 'o/asr', revision: 'a'.repeat(40), state: 'missing', bytes: null, sharedWith: [] },
        { component: 'vad', repo: 'o/vad', revision: 'b'.repeat(40), state: 'installed', bytes: 2048, sharedWith: ['other@mlx'] },
      ],
      install: { jobId: null, state: 'paused', receivedBytes: 1024, totalBytes: null },
      selfTest: { state: 'failed', jobId: 'job_1', at: '2026-10-03T00:00:00Z', detail: '识别结果不对' },
    });
    expect(lines[0]).toBe('qwen3-asr-0.6b@mlx-4bit  未安装（not-installed / incomplete）  transcribe mlx/metal — 缺少组件：asr');
    expect(lines[1]).toBe('  asr  o/asr@aaaaaaa  缺失');
    expect(lines[2]).toBe('  vad  o/vad@bbbbbbb  已装  2.0 KB  与 other@mlx 共用');
    expect(lines[3]).toBe('  安装：已暂停  已收到 1.0 KB（总大小未知）；cuccut models install qwen3-asr-0.6b@mlx-4bit 续传');
    expect(lines[4]).toBe('  检查：没通过  2026-10-03T00:00:00Z  识别结果不对');

    const downloading = formatBundleLines({
      ...base,
      state: 'downloading',
      install: { jobId: 'job_2', state: 'downloading', receivedBytes: 512, totalBytes: 1024 },
    });
    expect(downloading[1]).toBe('  安装：下载中  512 B / 1.0 KB（50%）  任务 job_2');
    expect(formatBundleLines(base)).toHaveLength(1);
  });

  it('check failed: includes the code of the conclusion; a broken file hints at repair, insufficient memory hints at closing programs', () => {
    const failed = (code: string) =>
      formatBundleLines({
        ...base,
        selfTest: { state: 'failed', jobId: 'job_1', at: '2026-10-03T00:00:00Z', detail: 'x', code } as ModelSelfTestResult,
      });
    expect(failed('MODEL_FILES_DAMAGED').slice(1)).toEqual([
      '  检查：没通过（MODEL_FILES_DAMAGED）  2026-10-03T00:00:00Z  x',
      '补救：cuccut models repair qwen3-asr-0.6b@mlx-4bit 只重新下载坏掉的文件，修好后再检查',
    ]);
    expect(failed('MODEL_OUTPUT_WRONG')[2]).toContain('先试 cuccut models repair');
    expect(failed('MODEL_OUT_OF_MEMORY')[2]).toBe('补救：关掉别的占内存的程序，或换一个小一点的模型，再检查');
    expect(failed('MODEL_WORKER_FAILED')).toHaveLength(2);
    expect(failed('SOMETHING_NEW')).toHaveLength(2);
    const passed = formatBundleLines({ ...base, selfTest: { state: 'passed', jobId: 'job_2', at: '2026-10-03T00:00:00Z', detail: 'ok' } });
    expect(passed[1]).toBe('  检查：通过  2026-10-03T00:00:00Z  ok');
  });

  it('install plan: items to download, items kept, source, resume and available space; gives an estimate when the size is unknown', () => {
    expect(formatInstallPlan(plan({ resumedBytes: 1024 * 1024, availableBytes: 100 }), 'install')).toEqual([
      '安装 qwen3-asr-0.6b@mlx-4bit，来源 https://huggingface.co',
      '  asr  o/asr  下载 2 个文件，700.0 MB',
      '  vad  o/vad  已装好，保留',
      '要下载：700.0 MB',
      '续传：暂存区里已有 1.0 MB，不再下载',
      '可用空间：100 B（不够）',
    ]);
    const unknown = plan({ downloadBytes: null, estimatedBytes: 680 * 1024 * 1024, confirmBytes: 680 * 1024 * 1024, availableBytes: null });
    unknown.components[0]!.bytes = null;
    const lines = formatInstallPlan(unknown, 'repair');
    expect(lines[0]).toBe('修复 qwen3-asr-0.6b@mlx-4bit，来源 https://huggingface.co');
    expect(lines).toContain('  asr  o/asr  下载 2 个文件，大小未知');
    expect(lines).toContain('要下载：大小未知，估计约 680.0 MB');
    expect(lines.some((l) => l.startsWith('可用空间'))).toBe(false);
    expect(installPrompt(unknown, 'repair')).toBe('确认修复并下载 约 680.0 MB？[y/N] ');
    expect(installPrompt(plan(), 'install')).toBe('确认安装并下载 700.0 MB？[y/N] ');
    expect(formatInstallPlan(plan({ upToDate: true }), 'install')).toEqual(['qwen3-asr-0.6b@mlx-4bit 已经装好，不用下载']);
    expect(formatInstallPlan(plan({ upToDate: true }), 'repair')).toEqual(['qwen3-asr-0.6b@mlx-4bit 的文件都完好，不用修复']);
  });

  it('install failure: insufficient disk space; when byte counts are given, first states how much is needed and how much is left, then the Runtime remedy', () => {
    const remedy = '模型目录所在的磁盘空间不足：清理出足够的空间后再安装';
    const details = { requiredBytes: 2 * 1024 ** 3, availableBytes: 512 * 1024 ** 2, remedy };
    expect(installFailureLines({ code: 'MODEL_DOWNLOAD_NO_SPACE', message: '模型目录所在的磁盘空间不足', details })).toEqual([
      '磁盘空间：这次要 2.0 GB，只剩 512.0 MB',
      `补救：${remedy}`,
    ]);
    // Disk full on write: only the file name, no byte count.
    const midWrite = { code: 'MODEL_DOWNLOAD_NO_SPACE', message: '写入模型文件时磁盘满了', details: { file: 'a.bin', remedy } };
    expect(installFailureLines(midWrite)).toEqual([`补救：${remedy}`]);
    expect(installFailureLines({ code: 'MODEL_DOWNLOAD_NETWORK', message: '断了', details: { remedy: '检查网络' } })).toEqual([
      '补救：检查网络',
    ]);
    expect(installFailureLines(null)).toEqual([]);
  });

  it('remove distinguishes online services from model packs by ID', () => {
    expect(removeTarget('custom:my-llm')).toBe('provider');
    expect(removeTarget('qwen3-asr-0.6b@mlx-4bit')).toBe('bundle');
    // Online providers in the directory can also be removed (§6.8).
    expect(removeTarget('anthropic', ['openai', 'anthropic'])).toBe('provider');
    expect(removeTarget('qwen3-asr-0.6b@mlx-4bit', ['openai', 'anthropic'])).toBe('bundle');
  });

  it('delete result: what was deleted and why something was kept', () => {
    expect(
      formatRemoveResult({
        removed: ['o/asr'],
        kept: [
          { repo: 'o/vad', usedBy: ['other@mlx'] },
          { repo: 'o/old', usedBy: [] },
        ],
        bundle: { ...base, state: 'not-installed', reason: 'missing-manifest' },
      }),
    ).toEqual([
      '已删除：o/asr',
      '保留 o/vad：other@mlx 还在用',
      '保留 o/old：目录里是别的版本，不属于这个模型包',
      'qwen3-asr-0.6b@mlx-4bit  未安装（not-installed / missing-manifest）  transcribe mlx/metal',
    ]);
    expect(formatRemoveResult({ removed: [], kept: [], bundle: base })[0]).toBe('没有删除文件');
  });
});

describe('models dir', () => {
  const info: ModelsDirInfo = {
    path: '/Volumes/Disk/models',
    source: 'setting',
    defaultPath: '/h/models',
    exists: true,
    writable: true,
    usedBytes: 2 * 1024 ** 3,
    freeBytes: 100 * 1024 ** 3,
    modelCount: 3,
    moveJobId: null,
    moveTo: null,
  };
  const inspection: ModelsDirInspection = {
    path: '/x',
    exists: true,
    writable: true,
    freeBytes: 1024 ** 3,
    problem: null,
    found: { repos: [], bundleIds: ['a', 'b'], bytes: 512 * 1024 ** 2 },
    current: { repos: [], bundleIds: ['c'], bytes: 2 * 1024 ** 3 },
    move: { requiredBytes: 2 * 1024 ** 3, sameVolume: false, fits: false },
  };

  it('current directory, source and usage', () => {
    expect(formatModelsDir(info)).toEqual([
      '/Volumes/Disk/models',
      '  来源：设置里选的文件夹',
      '  已用 2.0 GB · 所在磁盘可用 100.0 GB · 已识别 3 个模型',
      '  默认位置：/h/models',
    ]);
    expect(formatModelsDir({ ...info, source: 'env', exists: false, freeBytes: null, moveJobId: 'j1', moveTo: '/y' })).toEqual([
      '/Volumes/Disk/models',
      '  来源：环境变量 CUCCUT_MODELS_DIR（只读：要改请改环境变量并重启 CucCut）',
      '  这个文件夹不存在（外置盘没有接上时也会这样）',
      '  已用 2.0 GB · 已识别 3 个模型',
      '  默认位置：/h/models',
      '  正在移动到 /y（任务 j1）',
    ]);
  });

  it('notice and questions before a change', () => {
    expect(formatDirInspection(inspection)).toEqual([
      '发现 2 个已下载的模型（512.0 MB），可以直接使用',
      '所在磁盘可用 1.0 GB',
      '当前目录里有 2.0 GB 模型：要移动 2.0 GB，放不下',
    ]);
    expect(formatDirInspection({ ...inspection, move: { ...inspection.move, sameVolume: true, fits: true } })[2]).toContain('只改名');
    expect(dirProblem(inspection)).toBeNull();
    expect(dirProblem({ ...inspection, problem: 'missing' })).toContain('不存在');
  });

  it('directory set by environment variable: fails first with MODELS_DIR_ENV_LOCKED, does not check the new location', async () => {
    const calls: string[] = [];
    const api = (source: ModelsDirInfo['source']) => ({
      getDir: async () => (calls.push('getDir'), { ...info, source }),
      inspectDir: async (dir: string | null) => (calls.push(`inspectDir ${dir}`), inspection),
    });
    for (const target of ['/Volumes/Other/models', null]) {
      calls.length = 0;
      const locked = await inspectDirChange(api('env'), target).catch((e: unknown) => e);
      expect(locked).toMatchObject({ code: 'conflict', details: { code: 'MODELS_DIR_ENV_LOCKED', path: info.path } });
      expect(calls).toEqual(['getDir']);
    }
    calls.length = 0;
    expect(await inspectDirChange(api('setting'), '/Volumes/Other/models')).toBe(inspection);
    expect(calls).toEqual(['getDir', 'inspectDir /Volumes/Other/models']);
  });

  it('move or just switch: choose when the current directory has models', () => {
    expect(dirMode({}, inspection)).toBeNull();
    expect(dirMode({}, { ...inspection, current: { repos: [], bundleIds: [], bytes: 0 } })).toBe('switch');
    expect(dirMode({ move: true }, inspection)).toBe('move');
    expect(dirMode({ switch: true }, inspection)).toBe('switch');
    expect(() => dirMode({ move: true, switch: true }, inspection)).toThrow('只能选一个');
  });
});

describe('provider accounts (§6.8)', () => {
  const account = (patch: Partial<ProviderAccountView>): ProviderAccountView => ({
    accountId: 'main',
    label: null,
    masked: 'sk-…1234',
    enabled: true,
    addedAt: '2026-10-01T00:00:00.000Z',
    credential: 'set',
    status: { state: 'unknown' },
    ...patch,
  });
  const accounts = [
    account({ accountId: 'main', enabled: false, status: { state: 'invalid-key', at: '2026-10-05T00:00:00.000Z' } }),
    account({ accountId: 'a1b2c3d4', label: '工作', masked: 'sk-…9999', region: 'cn', status: { state: 'ok' } }),
    account({ accountId: 'e5f6a7b8', label: '工作', masked: 'sk-…7777' }),
  ];

  it('one account per line: order, name or mask, switch, status, region; marks the one in use; gives the add command when there are no accounts', () => {
    const lines = formatAccountLines(accounts, '');
    expect(lines[0]).toBe('1. main  sk-…1234  已停用  密钥无效');
    expect(lines[1]).toBe('2. a1b2c3d4  工作  sk-…9999  已启用  正常  地区 cn  当前使用');
    expect(lines[2]).not.toContain('当前使用');
    expect(formatAccountLines([])[0]).toContain('cuccut models accounts add');
  });

  it('finds an account by accountId or unique name; errors on duplicate or missing names; use moves it to the front', () => {
    expect(findAccount(accounts, 'e5f6a7b8').masked).toBe('sk-…7777');
    expect(() => findAccount(accounts, '工作')).toThrow(/2 个账号/);
    expect(() => findAccount(accounts, 'nope')).toThrow(/没有这个账号/);
    expect(accountOrderWithFirst(accounts, 'e5f6a7b8')).toEqual(['e5f6a7b8', 'main', 'a1b2c3d4']);
  });
});

describe('usage (§6.10)', () => {
  const report = (patch: Partial<UsageReport> = {}): UsageReport => ({
    period: { from: '2026-09-07T00:00:00.000Z', to: '2026-10-06T12:00:00.000Z' },
    totals: { calls: 0, failed: 0, units: {}, cost: { estimated: [], reported: [], unknownCalls: 0 } },
    byDay: [],
    byProvider: [],
    byCapability: [],
    byModel: [],
    byAccount: [],
    ...patch,
  });

  it('amounts: one entry per currency, no conversion', () => {
    expect(formatMoney([])).toBeNull();
    expect(
      formatMoney([
        { amount: '2.649', currency: 'USD' },
        { amount: '2.40', currency: 'CNY' },
      ]),
    ).toBe('$2.649 + 2.40 CNY');
  });

  it('one-sentence note when there are no calls', () => {
    expect(formatUsageReport(report(), '30d')).toEqual([
      '用量（最近 30 天：2026-09-07T00:00:00.000Z 至 2026-10-06T12:00:00.000Z）',
      '  还没有调用',
    ]);
  });

  it('estimates, reports and unknowns are written separately; split by provider with shares and amount sources', () => {
    const lines = formatUsageReport(
      report({
        totals: {
          calls: 4,
          failed: 1,
          units: { inputTokens: 1200, outputTokens: 300, images: 1 },
          cost: { estimated: [{ amount: '0.01', currency: 'USD' }], reported: [{ amount: '0.50', currency: 'USD' }], unknownCalls: 1 },
        },
        byProvider: [
          {
            key: 'anthropic',
            label: 'Anthropic',
            calls: 3,
            failed: 1,
            units: { inputTokens: 1200, outputTokens: 300 },
            cost: [{ amount: '0.51', currency: 'USD' }],
            costKind: 'mixed',
          },
          { key: 'agent:codex', label: 'Codex', calls: 1, failed: 0, units: { images: 1 }, cost: [], costKind: 'unknown' },
        ],
      }),
      '7d',
      'anthropic',
    );
    expect(lines[0]).toContain('anthropic，最近 7 天');
    expect(lines).toContain('  调用 4 次（失败 1）');
    expect(lines).toContain('  用量：输入 1,200 / 输出 300 token，1 张图');
    expect(lines).toContain('  花费 ≈ $0.01（按标价估算）');
    expect(lines).toContain('  花费 $0.50（服务商报告）');
    expect(lines).toContain('  另有 1 次调用费用未知');
    expect(lines).toContain('按服务商');
    expect(lines).toContain('  Anthropic  3 次（失败 1）  75%  输入 1,200 / 输出 300 token  ≈ $0.51（报告与估算）');
    expect(lines).toContain('  Codex  1 次  25%  1 张图  费用未知');
    expect(lines).not.toContain('按能力');
  });
});

describe('English', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    setLocale('zh-Hans');
  });

  it('install plan, questions and usage period are in English', () => {
    vi.stubEnv('CUCCUT_LOCALE', 'en');
    setLocale('en');
    expect(installPrompt(plan(), 'repair')).toBe('Repair and download 700.0 MB? [y/N] ');
    expect(formatInstallPlan(plan({ upToDate: true }), 'install')).toEqual(['qwen3-asr-0.6b@mlx-4bit is already installed; nothing to download']);
    expect(formatByteProgress(512, null)).toBe('512 B received (total size unknown)');
    expect(USAGE_PERIOD_LABELS['7d']).toBe('Last 7 days');
  });
});
