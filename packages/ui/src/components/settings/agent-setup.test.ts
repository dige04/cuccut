import { describe, expect, it } from 'vitest';
import type { AgentSetupRun, DriverInfo, DriverModel } from '@cuccut/protocol';
import {
  AGENT_DEFAULT_MODEL_KEY,
  MODEL_DEFAULT_EFFORT_KEY,
  STATE_PRIORITY,
  agentBadge,
  agentOverview,
  agentProblem,
  compareVersions,
  configModelGate,
  defaultModelLabel,
  diagnose,
  diagnosisVerdict,
  diagnosticsText,
  effortChoices,
  hasUpdate,
  installKindOf,
  installPlan,
  isBlocked,
  latestSetupRun,
  loginCommandOf,
  modelChoices,
  groupDrivers,
  moreSummary,
  orderDrivers,
  rulesView,
  selectedEffortKey,
  selectedModelKey,
  setupDoneToast,
  setupLog,
} from './agent-setup.ts';

const CODEX_INSTALL: DriverInfo['install'] = [
  { kind: 'brew', label: 'Homebrew', needs: 'Homebrew', command: 'brew install codex', upgrade: 'brew upgrade codex' },
  { kind: 'npm', label: 'npm', needs: 'Node.js', command: 'npm install -g @openai/codex', upgrade: 'npm install -g @openai/codex@latest' },
];

function driver(patch: Partial<DriverInfo> = {}): DriverInfo {
  return {
    id: 'codex',
    name: 'Codex CLI',
    command: 'codex',
    state: 'ready',
    status: 'available',
    version: '0.130.0',
    minVersion: '0.120.0',
    latestVersion: null,
    unavailableReason: null,
    detail: null,
    executable: '/opt/homebrew/bin/codex',
    realExecutable: '/opt/homebrew/Caskroom/codex/0.130.0/codex',
    account: 'Logged in using ChatGPT',
    plan: 'ChatGPT Plus 或 Pro 订阅',
    loginCommand: 'codex login',
    install: CODEX_INSTALL,
    models: [],
    configModel: null,
    configModelKnown: null,
    checkedAt: '2026-10-03T00:00:00.000Z',
    verified: true,
    tested: true,
    capabilities: { steer: true, approvals: true, resume: true, images: true },
    enabled: true,
    source: 'builtin',
    custom: null,
    isDefault: true,
    defaultModel: null,
    defaultEffort: null,
    executableOverride: null,
    ...patch,
  };
}

const model = (id: string, patch: Partial<DriverModel> = {}): DriverModel => ({
  id,
  label: id.toUpperCase(),
  description: null,
  tier: null,
  isDefault: false,
  efforts: [],
  defaultEffort: null,
  ...patch,
});

describe('version and status', () => {
  it('versions are compared segment by segment as numbers', () => {
    expect(compareVersions('2.1.284', '2.2.0')).toBe(-1);
    expect(compareVersions('0.130.0', '0.99.9')).toBe(1);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions(null, '0.1')).toBe(-1);
  });

  it('only an installed agent that knows the latest version and is older locally counts as having a new version', () => {
    expect(hasUpdate(driver({ latestVersion: '0.131.0' }))).toBe(true);
    expect(hasUpdate(driver({ latestVersion: '0.130.0' }))).toBe(false);
    expect(hasUpdate(driver({ latestVersion: null }))).toBe(false);
    expect(hasUpdate(driver({ state: 'not-installed', version: null, latestVersion: '0.131.0' }))).toBe(false);
  });

  it('errors, a version that is too old, and not logged in block; disabled and not installed do not', () => {
    expect(STATE_PRIORITY).toEqual(['not-installed', 'error', 'outdated', 'signed-out', 'disabled', 'ready']);
    expect(['error', 'outdated', 'signed-out'].every((state) => isBlocked({ state: state as DriverInfo['state'] }))).toBe(true);
    expect(isBlocked({ state: 'disabled' })).toBe(false);
    expect(isBlocked({ state: 'not-installed' })).toBe(false);
  });

  it('status words and tones match the design', () => {
    expect(agentBadge(driver())).toEqual({ label: '可用', tone: 'positive' });
    expect(agentBadge(driver({ latestVersion: '0.131.0' }))).toEqual({ label: '可用 · 有新版本', tone: 'notice' });
    expect(agentBadge(driver({ state: 'not-installed' }))).toEqual({ label: '未安装', tone: 'neutral' });
    expect(agentBadge(driver({ state: 'error' }))).toEqual({ label: '无法运行', tone: 'negative' });
    expect(agentBadge(driver({ state: 'outdated' }))).toEqual({ label: '版本过旧', tone: 'negative' });
    expect(agentBadge(driver({ state: 'signed-out' }))).toEqual({ label: '需要登录', tone: 'notice' });
    expect(agentBadge(driver({ state: 'disabled' }))).toEqual({ label: '已停用', tone: 'neutral' });
  });

  it('default model in config not recognized by this version: hint only when usable, give an upgrade target only when a newer version exists', () => {
    const gated = driver({ configModel: 'gpt-6', configModelKnown: false });
    expect(configModelGate(gated)).toEqual({ model: 'gpt-6', version: '0.130.0', latest: null });
    expect(agentBadge(gated)).toEqual({ label: '可用 · 默认模型不可用', tone: 'notice' });
    const upgradable = driver({ configModel: 'gpt-6', configModelKnown: false, latestVersion: '0.140.0' });
    expect(configModelGate(upgradable)?.latest).toBe('0.140.0');
    expect(agentBadge(upgradable).label).toBe('可用 · 默认模型需升级');
    // Unknown (null) does not count as unrecognized. When unavailable, the problem bar speaks for it.
    expect(configModelGate(driver({ configModel: 'gpt-6', configModelKnown: null }))).toBeNull();
    expect(configModelGate(driver({ state: 'signed-out', configModel: 'gpt-6', configModelKnown: false }))).toBeNull();
  });

  it('installed ones come first, the rest keep their original order', () => {
    const list = [
      driver({ id: 'claude', state: 'not-installed' }),
      driver({ id: 'codex', state: 'signed-out' }),
    ];
    expect(orderDrivers(list).map((d) => d.id)).toEqual(['codex', 'claude']);
    expect(orderDrivers([driver({ id: 'claude' }), driver({ id: 'codex' })]).map((d) => d.id)).toEqual(['claude', 'codex']);
  });
});

describe('problem rows and troubleshooting', () => {
  it('each blocking status has one fix that can be done in the UI', () => {
    expect(agentProblem(driver())).toBeNull();
    expect(agentProblem(driver({ state: 'disabled' }))).toBeNull();
    expect(agentProblem(driver({ state: 'error', detail: 'codex --version 没有正常退出。' }))).toMatchObject({
      kind: 'error',
      action: 'diagnose',
      cta: '运行排查',
    });
    const outdated = agentProblem(driver({ state: 'outdated', version: '0.100.0' }));
    expect(outdated).toMatchObject({ action: 'upgrade', title: 'Codex CLI 0.100.0 太旧，CucCut 无法驱动' });
    expect(outdated?.body).toContain('至少需要 0.120.0');
    const signedOut = agentProblem(driver({ state: 'signed-out' }));
    expect(signedOut).toMatchObject({ action: 'login', cta: '打开终端登录', tone: 'notice' });
    expect(signedOut?.body).toBe('登录在 Codex CLI 自己的窗口里完成，CucCut 不经手你的账号和密码。登录后回到这里检查。');
    expect(outdated?.cta).toBe('升级到 0.120.0');
    expect(agentProblem(driver({ state: 'outdated', version: '0.100.0', latestVersion: '0.131.0' }))?.cta).toBe('升级到 0.131.0');
  });

  it('when the version is too old, use the Driver\'s note if given (OpenCode 1.x needs a different package installed)', () => {
    const detail = 'OpenCode 1.18.34 版本过低，请升级：npm install -g @opencode/cli';
    const outdated = agentProblem(driver({ state: 'outdated', version: '1.18.34', minVersion: '2.0.10', detail }));
    expect(outdated?.body).toBe(`${detail} 升级只更新这个命令行工具，不影响你的账号和它自己的设置。`);
  });

  it('user-added: login for npx / uvx fetch-on-run starts its own package, others start the program itself', () => {
    const custom = (command: string[]) =>
      driver({ id: 'auggie', command: command[0]!, loginCommand: null, source: 'custom', custom: { command, envKeys: [], addedAt: '' } });
    expect(loginCommandOf(custom(['npx', '-y', '@augmentcode/auggie@0.33.0', '--acp']))).toBe('npx -y @augmentcode/auggie@0.33.0');
    expect(loginCommandOf(custom(['goose', 'acp']))).toBe('goose');
  });

  it('launches the CLI directly when no login command is given', () => {
    expect(loginCommandOf(driver())).toBe('codex login');
    expect(loginCommandOf(driver({ loginCommand: null }))).toBe('codex');
  });

  it('troubleshooting only looks at the first failing item; later ones are marked \'check after the previous step passes\'', () => {
    const steps = diagnose(driver({ state: 'outdated', version: '0.100.0' }));
    expect(steps.map((s) => s.state)).toEqual(['ok', 'ok', 'fail', 'skip', 'skip']);
    expect(diagnosisVerdict(steps)).toEqual({ ok: false, text: '卡在「CucCut 支持这个版本」：当前 0.100.0，最低要求 0.120.0' });
    const missing = diagnose(driver({ state: 'not-installed', version: null, executable: null }));
    expect(missing.map((s) => s.state)).toEqual(['fail', 'skip', 'skip', 'skip', 'skip']);
    const ok = diagnose(driver());
    expect(ok.every((s) => s.state === 'ok')).toBe(true);
    expect(ok[4]?.detail).toBe('它没有报告模型列表，会话用 Agent 默认模型');
    expect(diagnosisVerdict(ok).ok).toBe(true);
  });
});

describe('agent table grouping', () => {
  it('detected ones first; built-in ones not installed still in the main list; the four \'more\' agents collapse when not detected; added ones do not collapse when not detected', () => {
    const list = [
      driver({ id: 'claude', state: 'not-installed' }),
      driver({ id: 'codex', state: 'ready' }),
      driver({ id: 'gemini', state: 'not-installed' }),
      driver({ id: 'cursor', state: 'signed-out' }),
      driver({ id: 'grok', state: 'not-installed' }),
      driver({ id: 'kimi', state: 'not-installed' }),
      driver({ id: 'goose', state: 'not-installed', source: 'custom' }),
      driver({ id: 'auggie', state: 'ready', source: 'custom' }),
    ];
    const g = groupDrivers(list);
    expect(g.main.map((d) => d.id)).toEqual(['codex', 'cursor', 'auggie', 'claude', 'goose']);
    expect(g.more.map((d) => d.id)).toEqual(['gemini', 'grok', 'kimi']);
    expect([g.builtin, g.added, g.found]).toEqual([6, 2, 3]);
    expect(moreSummary(g.more.map((d) => ({ name: d.id })))).toBe('gemini、grok、kimi');
    expect(moreSummary(['a', 'b', 'c', 'd'].map((name) => ({ name })))).toBe('a、b、c 等');
  });

  it('an added agent not detected shows \'not detected yet\', a built-in one still shows \'not installed\'', () => {
    expect(agentBadge(driver({ state: 'not-installed', source: 'custom' }))).toEqual({ label: '还没检测', tone: 'neutral' });
    expect(agentBadge(driver({ state: 'not-installed' }))).toEqual({ label: '未安装', tone: 'neutral' });
    expect(agentBadge(driver({ state: 'signed-out', source: 'custom' })).label).toBe('需要登录');
  });
});

describe('top status card', () => {
  it('says ready when something usable exists, and names the default model', () => {
    const view = agentOverview([driver({ defaultModel: 'gpt-5', models: [model('gpt-5', { label: 'GPT-5' })] })]);
    expect(view).toMatchObject({ state: 'ready', driverId: 'codex', action: 'start' });
    expect(view.body).toContain('Codex CLI · GPT-5');
    expect(agentOverview([driver()]).body).toContain('Agent 默认模型');
  });

  it('names problem ones first, then disabled ones, and finally the not-installed ones', () => {
    expect(agentOverview([driver({ state: 'signed-out' })])).toMatchObject({ state: 'attention', action: 'open', cta: '查看问题' });
    expect(agentOverview([driver({ state: 'disabled', enabled: false })])).toMatchObject({ state: 'off', action: 'enable', cta: '启用 Codex CLI' });
    expect(agentOverview([driver({ state: 'not-installed' })])).toMatchObject({ state: 'missing', driverId: null, action: null });
    expect(agentOverview([])).toMatchObject({ state: 'missing' });
  });
});

describe('install and upgrade commands', () => {
  it('recognized sources are judged by real location only', () => {
    expect(installKindOf('/opt/homebrew/bin/codex', '/opt/homebrew/Caskroom/codex/0.130.0/codex')).toBe('brew');
    expect(installKindOf('/opt/homebrew/bin/codex', '/opt/homebrew/lib/node_modules/@openai/codex/bin/codex.js')).toBe('npm');
    expect(installKindOf('/usr/local/bin/claude', '/usr/local/Cellar/claude-code/2.1.0/libexec/lib/node_modules/@anthropic-ai/claude-code/cli.js')).toBe('brew');
    expect(installKindOf('/Users/me/.local/bin/claude', '/Users/me/.local/share/claude/versions/2.1.284')).toBe('script');
    expect(installKindOf('/Users/me/.nvm/versions/node/v22.0.0/bin/codex', null)).toBe('npm');
    expect(installKindOf('C:\\Users\\me\\AppData\\Roaming\\npm\\codex.cmd', 'C:\\Users\\me\\AppData\\Roaming\\npm\\node_modules\\@openai\\codex\\bin\\codex.js')).toBe('npm');
  });

  it('version manager shims and installs from bun, pnpm, yarn, or volta are not recognized', () => {
    expect(installKindOf('/Users/me/.local/share/mise/shims/codex', '/Users/me/.local/share/mise/installs/node/22/lib/node_modules/@openai/codex/bin/codex.js')).toBeNull();
    expect(installKindOf('/Users/me/.bun/bin/codex', '/Users/me/.bun/install/global/node_modules/@openai/codex/bin/codex.js')).toBeNull();
    expect(installKindOf('/Users/me/Library/pnpm/codex', '/Users/me/Library/pnpm/global/5/node_modules/@openai/codex/bin/codex.js')).toBeNull();
    expect(installKindOf('/Users/me/.volta/bin/codex', null)).toBeNull();
    expect(installKindOf('/usr/bin/codex', '/usr/bin/codex')).toBeNull();
    expect(installKindOf(null, null)).toBeNull();
  });

  it('not installed gives the install command, defaulting to the first method', () => {
    const plan = installPlan(driver({ state: 'not-installed', executable: null, realExecutable: null }));
    expect(plan.upgrading).toBe(false);
    expect(plan.choices.map((c) => c.command)).toEqual(['brew install codex', 'npm install -g @openai/codex']);
    expect(plan.detected).toBeNull();
    expect(plan.initial).toBe('brew');
  });

  it('installed gives the upgrade command, defaulting to the recognized method', () => {
    const plan = installPlan(driver({ executable: '/opt/homebrew/bin/codex', realExecutable: '/opt/homebrew/lib/node_modules/@openai/codex/bin/codex.js' }));
    expect(plan.upgrading).toBe(true);
    expect(plan.choices.map((c) => c.command)).toEqual(['brew upgrade codex', 'npm install -g @openai/codex@latest']);
    expect(plan.detected).toBe('npm');
    expect(plan.initial).toBe('npm');
  });

  it('a recognized method not in the method table does not count as recognized; falls back to the first method', () => {
    const plan = installPlan(driver({ executable: '/Users/me/.local/bin/codex', realExecutable: '/Users/me/.local/share/claude/versions/1' }));
    expect(plan.detected).toBeNull();
    expect(plan.initial).toBe('brew');
  });

  it('commands that download a script from the network and pass it to a shell must be flagged', () => {
    const plan = installPlan(
      driver({
        state: 'not-installed',
        install: [{ kind: 'script', label: '官方脚本', needs: null, command: 'curl -fsSL https://claude.ai/install.sh | bash', upgrade: 'claude update' }],
      }),
    );
    expect(plan.choices[0]).toMatchObject({ downloadsScript: true, runnable: false });
    expect(installPlan(driver()).choices.every((c) => !c.downloadsScript && c.runnable)).toBe(true);
    // Upgrade commands of the official-script type do not download a script, but likewise do not run inside the app (the Runtime rejects them by category).
    const upgrade = installPlan(driver({ install: [{ kind: 'script', label: '官方脚本', needs: null, command: 'curl -fsSL https://claude.ai/install.sh | bash', upgrade: 'claude update' }] }));
    expect(upgrade.choices[0]).toMatchObject({ command: 'claude update', downloadsScript: false, runnable: false });
    expect(installPlan(driver({ install: [] }))).toMatchObject({ choices: [], initial: null });
  });
});

describe('default model and effort', () => {
  it('when the model table is empty, only the \'Agent default model\' item is shown', () => {
    const rows = modelChoices(driver());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key: AGENT_DEFAULT_MODEL_KEY, model: null, label: 'Agent 默认模型', description: '按 CLI 配置选择' });
    expect(selectedModelKey(driver())).toBe(AGENT_DEFAULT_MODEL_KEY);
  });

  it('names the model configured in the CLI; hints at an upgrade when this version does not recognize it', () => {
    expect(modelChoices(driver({ configModel: 'gpt-5' }))[0]?.description).toBe('按 CLI 配置选择 · gpt-5');
    expect(modelChoices(driver({ configModel: 'gpt-6', configModelKnown: false }))[0]?.description).toBe('按 CLI 配置选择 · gpt-6 需要升级 CLI');
  });

  it('models are listed in original order and tagged by position; a preferred model not in the table is shown as-is and cannot be selected', () => {
    const models = [model('a', { tier: 'balanced' }), model('b', { tier: 'max', description: '自己的说明' }), model('c')];
    const rows = modelChoices(driver({ models, defaultModel: 'gone' }));
    expect(rows.map((r) => r.key)).toEqual([AGENT_DEFAULT_MODEL_KEY, 'gone', 'a', 'b', 'c']);
    expect(rows[1]).toMatchObject({ missing: true, description: '当前模型列表里没有它，新会话会改用推荐模型' });
    expect(rows[2]).toMatchObject({ tag: '推荐', description: '转录、翻译、剪辑都够用，速度快，也更省订阅额度' });
    expect(rows[3]).toMatchObject({ tag: '最强', description: '自己的说明' });
    expect(rows[4]).toMatchObject({ tag: null, description: null });
    expect(selectedModelKey(driver({ defaultModel: 'a' }))).toBe('a');
  });

  it('\'recommended\' tags only the recommended one: other balanced models in the table are not tagged, and the strongest and fastest keep their existing labels', () => {
    const models = [
      model('gpt-6-astra', { tier: 'max' }),
      model('gpt-6.1-sol', { tier: 'balanced' }),
      model('gpt-6-sol', { tier: 'balanced' }),
      model('gpt-6-luna', { tier: 'fast' }),
    ];
    const rows = modelChoices(driver({ models, defaultModel: 'gpt-6.1-sol' }));
    expect(rows.filter((r) => r.tag === '推荐').map((r) => r.key)).toEqual(['gpt-6.1-sol']);
    expect(rows.find((r) => r.key === 'gpt-6-sol')).toMatchObject({ tag: null, description: null });
    expect(rows.find((r) => r.key === 'gpt-6-astra')?.tag).toBe('最强');
    expect(rows.find((r) => r.key === 'gpt-6-luna')?.tag).toBe('最快');
    // Claude Code recommends the first Sonnet, even if it is not tagged balanced.
    const claudeModels = [model('opus', { tier: 'balanced' }), model('sonnet')];
    const claude = modelChoices(driver({ id: 'claude', models: claudeModels, defaultModel: 'sonnet' }));
    expect(claude.filter((r) => r.tag === '推荐').map((r) => r.key)).toEqual(['sonnet']);
  });

  it('preferred model gone: selection and effort both follow the recommended model (what new sessions actually use), and the missing row is still shown', () => {
    const efforts = [{ id: 'low', label: 'Low' }, { id: 'high', label: 'High' }];
    const models = [model('gpt-6.1-sol', { tier: 'balanced', efforts, defaultEffort: 'low' }), model('gpt-6-luna', { tier: 'fast' })];
    const gone = driver({ models, defaultModel: 'gpt-5-sol' });
    expect(selectedModelKey(gone)).toBe('gpt-6.1-sol');
    expect(modelChoices(gone).find((r) => r.key === 'gpt-5-sol')).toMatchObject({ missing: true });
    expect(effortChoices(gone)?.map((r) => r.key)).toEqual([MODEL_DEFAULT_EFFORT_KEY, 'low', 'high']);
    expect(defaultModelLabel(gone)).toBe('GPT-6.1-SOL');
    expect(defaultModelLabel(driver({ models, defaultModel: null }))).toBe('Agent 默认模型');
    // An explicit choice of “Agent default model” is not affected. When the model list has not been detected yet there is no way to judge, so the choice is kept as is.
    expect(selectedModelKey(driver({ models, defaultModel: null }))).toBe(AGENT_DEFAULT_MODEL_KEY);
    expect(selectedModelKey(driver({ defaultModel: 'gpt-5-sol' }))).toBe('gpt-5-sol');
  });

  it('effort appears only for models with named effort levels; if the Chinese name is not recognized, the original label is used', () => {
    const efforts = [
      { id: 'low', label: 'Low' },
      { id: 'high', label: 'High' },
      { id: 'turbo', label: 'Turbo' },
    ];
    const models = [model('a', { efforts, defaultEffort: 'high' }), model('b')];
    expect(effortChoices(driver({ models, defaultModel: null }))).toBeNull();
    expect(effortChoices(driver({ models, defaultModel: 'b' }))).toBeNull();
    const rows = effortChoices(driver({ models, defaultModel: 'a' }))!;
    expect(rows.map((r) => r.label)).toEqual(['模型默认（高）', '低', '高', 'Turbo']);
    expect(rows[0]).toMatchObject({ key: MODEL_DEFAULT_EFFORT_KEY, effort: null });
    const stale = effortChoices(driver({ models, defaultModel: 'a', defaultEffort: 'xhigh' }))!;
    expect(stale[1]).toMatchObject({ key: 'xhigh', missing: true });
    expect(selectedEffortKey(driver())).toBe(MODEL_DEFAULT_EFFORT_KEY);
    expect(selectedEffortKey(driver({ defaultEffort: 'low' }))).toBe('low');
  });
});

describe('\'always allow\' rules', () => {
  it('empty list shows the design\'s empty state', () => {
    expect(rulesView([])).toEqual({
      rules: [],
      title: '总是允许的命令 · 0 条',
      body: '还没有保存的规则。在会话的允许卡上选择「总是允许」，会显示在这里。',
    });
    expect(rulesView(null).rules).toEqual([]);
  });

  it('dedupes and drops empty strings, keeps insertion order, does not change the original text (returned as-is on removal)', () => {
    const view = rulesView(['ccut info', '', 'ccut status ', 'ccut info', 'Bash(git status)']);
    expect(view.rules).toEqual(['ccut info', 'ccut status ', 'Bash(git status)']);
    expect(view.title).toBe('总是允许的命令 · 3 条');
    expect(view.body).toContain('移除后，该规则不再自动批准操作');
  });
});

describe('diagnostic info', () => {
  it('one line per agent: status, version and path; both the link and the real location are given when they differ', () => {
    const text = diagnosticsText([
      driver(),
      driver({ id: 'claude', name: 'Claude Code', state: 'not-installed', version: null, executable: null, realExecutable: null }),
    ]);
    expect(text).toBe(
      'Codex CLI: ready v0.130.0 /opt/homebrew/bin/codex → /opt/homebrew/Caskroom/codex/0.130.0/codex\nClaude Code: not-installed',
    );
  });
});

describe('in-app run', () => {
  const run = (patch: Partial<AgentSetupRun> = {}): AgentSetupRun => ({
    runId: 'setup_1',
    driverId: 'codex',
    action: 'upgrade',
    kind: 'brew',
    command: 'brew upgrade codex',
    state: 'completed',
    exitCode: 0,
    output: ['==> Upgrading codex'],
    droppedLines: 0,
    startedAt: '2026-10-03T00:00:00.000Z',
    endedAt: '2026-10-03T00:00:10.000Z',
    error: null,
    ...patch,
  });

  it('latest run is taken per agent; the first log line is the $ command; a note is shown first when lines were dropped', () => {
    const runs = [run({ runId: 'b', driverId: 'claude' }), run({ runId: 'a' }), run({ runId: 'old' })];
    expect(latestSetupRun(runs, 'codex')?.runId).toBe('a');
    expect(latestSetupRun([], 'codex')).toBeNull();
    expect(setupLog(run())).toBe('$ brew upgrade codex\n==> Upgrading codex');
    expect(setupLog(run({ droppedLines: 3 }))).toBe('$ brew upgrade codex\n…（前面 3 行已省略）\n==> Upgrading codex');
  });

  it('success toast follows the design; no toast on failure or stop', () => {
    expect(setupDoneToast(run(), driver({ version: '0.131.0' }))).toEqual({ tone: 'positive', text: 'Codex CLI 现在是 0.131.0 · 正在刷新它的模型列表' });
    expect(setupDoneToast(run({ action: 'install' }), driver({ state: 'signed-out' }))?.text).toBe('检测到 Codex CLI 0.130.0 · 还需要登录一次');
    expect(setupDoneToast(run({ action: 'install' }), driver())?.text).toBe('检测到 Codex CLI 0.130.0');
    expect(setupDoneToast(run({ action: 'install' }), driver({ state: 'not-installed' }))?.tone).toBe('neutral');
    expect(setupDoneToast(run({ state: 'failed', exitCode: 1 }), driver())).toBeNull();
    expect(setupDoneToast(run({ state: 'cancelled' }), driver())).toBeNull();
  });
});
