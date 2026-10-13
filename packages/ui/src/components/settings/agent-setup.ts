import { live, localizeText, type AgentSetupRun, type DriverInfo, type DriverInstallOption, type DriverState, type ModelTier } from '@cuccut/protocol';
import { customLoginCommand, MORE_BUILTIN_IDS } from '../../model/agent-catalog.ts';
import { effectiveDefaultModel, modelTierOf } from '../../model/agent-choice.ts';
import { M } from './agent-setup-copy.ts';

/**
 * The pure layer of Settings › Agent providers (design mockup designs/cuccut/app/model-agent-setup.js): what state an agent is in now,
 * which sentence and which button to show the user, how the troubleshooting checklist is laid out, what options the default model and effort have, and which command installs and upgrades it. Views only compose; they make no decisions in JSX.
 *
 * The state itself is computed by the Runtime using the design mockup’s priority order (`DriverState`: not installed > error > version too old > not logged in > disabled > available).
 * Here it is only turned into labels, tones and fixes, and not recomputed.
 */

export type AgentTone = 'positive' | 'notice' | 'negative' | 'neutral';

/** The design mockup’s status priority (model-agent-setup.js:13), from the most urgent to available. */
export const STATE_PRIORITY: readonly DriverState[] = ['not-installed', 'error', 'outdated', 'signed-out', 'disabled', 'ready'];

/** Version numbers are compared segment by segment as numbers: `2.1.284` < `2.2.0`. Non-numeric segments (`-rc.2`) are truncated by parseInt. */
export function compareVersions(a: string | null | undefined, b: string | null | undefined): number {
  const pa = String(a || '0').split('.');
  const pb = String(b || '0').split('.');
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (Number.parseInt(pa[i] ?? '', 10) || 0) - (Number.parseInt(pb[i] ?? '', 10) || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

type Probe = Pick<DriverInfo, 'state' | 'version' | 'latestVersion'>;

/** Installed, the upstream latest version is known, and it is newer than the local one. A newer version is not a problem; it only changes the status word. */
export function hasUpdate(driver: Probe): boolean {
  return driver.state !== 'not-installed' && !!driver.version && !!driver.latestVersion && compareVersions(driver.version, driver.latestVersion) < 0;
}

/** Installed but unusable (error, version too old, not logged in): the enable toggle is greyed out and new sessions skip it. */
export function isBlocked(driver: Pick<DriverInfo, 'state'>): boolean {
  return driver.state === 'error' || driver.state === 'outdated' || driver.state === 'signed-out';
}

export function isInstalled(driver: Pick<DriverInfo, 'state'>): boolean {
  return driver.state !== 'not-installed';
}

/**
 * The CLI works, but the default model in its config is not recognized by this version (`configModelKnown === false`, model-agent-setup.js:55-58).
 * It does not block sending. Only sessions that chose “Agent default model” run into it, so it gets its own hint. `latest`: given only when a newer version really exists.
 */
export function configModelGate(
  driver: Pick<DriverInfo, 'state' | 'version' | 'latestVersion' | 'configModel' | 'configModelKnown'>,
): { model: string; version: string | null; latest: string | null } | null {
  if (driver.state !== 'ready' || !driver.configModel || driver.configModelKnown !== false) return null;
  return { model: driver.configModel, version: driver.version, latest: hasUpdate(driver) ? driver.latestVersion : null };
}

const BADGE_TONE: Record<Exclude<DriverState, 'ready'>, AgentTone> = {
  'not-installed': 'neutral',
  error: 'negative',
  outdated: 'negative',
  'signed-out': 'notice',
  disabled: 'neutral',
};

/**
 * The status word in the card header (model-agent-setup.js:73-85). A CLI whose default model needs updating takes priority over “new version available”.
 * A user-added agent that has not been detected says “Not detected yet” (还没检测). An agent fetched on demand by npx has nothing to “install” (product design §7.6).
 */
export function agentBadge(driver: Parameters<typeof configModelGate>[0] & Partial<Pick<DriverInfo, 'source'>>): {
  label: string;
  tone: AgentTone;
} {
  if (driver.state === 'not-installed' && driver.source === 'custom') return { label: M.badgeNotChecked, tone: 'neutral' };
  if (driver.state !== 'ready') return { label: M.badge[driver.state], tone: BADGE_TONE[driver.state] };
  if (configModelGate(driver)) return { label: hasUpdate(driver) ? M.badgeModelUpgrade : M.badgeModelUnavailable, tone: 'notice' };
  return hasUpdate(driver) ? { label: M.badgeUpdate, tone: 'notice' } : { label: M.badgeReady, tone: 'positive' };
}

/**
 * The command that logs in from the terminal. If the Driver does not supply one, the CLI itself is launched, and it guides the user through login when not logged in (model-agent-setup.js:340-343).
 * For user-added agents fetched on demand by npx / uvx, it launches their own package (without the ACP arguments).
 */
export function loginCommandOf(driver: Pick<DriverInfo, 'loginCommand' | 'command'> & Partial<Pick<DriverInfo, 'custom'>>): string {
  if (driver.loginCommand) return driver.loginCommand;
  return driver.custom ? customLoginCommand(driver.custom.command) || driver.command : driver.command;
}

/**
 * The fixes for the problem bar (model-agent-setup.js:88-94): `diagnose` re-detects and lists the troubleshooting checklist. `upgrade` expands the details, and when the upgrade command can run inside the app (brew, npm) it pops up a run confirmation directly; otherwise it shows the command for the user to copy. `login` opens the system terminal and runs the login command.
 */
export type ProblemAction = 'diagnose' | 'upgrade' | 'login';

export interface AgentProblem {
  kind: 'error' | 'outdated' | 'signed-out';
  tone: 'negative' | 'notice';
  title: string;
  body: string;
  action: ProblemAction;
  cta: string;
}

/** The problem line under the card header: one sentence on what happened, one on what to do, and one primary button (model-agent-setup.js:88-94). Returns null when there is no problem. */
export function agentProblem(
  driver: Pick<DriverInfo, 'state' | 'name' | 'version' | 'minVersion' | 'latestVersion' | 'detail' | 'detailRef' | 'loginCommand' | 'command'>,
): AgentProblem | null {
  const { name } = driver;
  const detail = localizeText(driver.detail, driver.detailRef);
  if (driver.state === 'error') {
    return {
      kind: 'error',
      tone: 'negative',
      title: M.errorTitle(name),
      body: M.errorBody(detail || null),
      action: 'diagnose',
      cta: M.errorCta,
    };
  }
  if (driver.state === 'outdated') {
    return {
      kind: 'outdated',
      tone: 'negative',
      title: M.outdatedTitle(name, driver.version || null),
      // If the Driver provides an explanation, use it. (OpenCode 1.x switched its distribution package and must be reinstalled as @opencode/cli. The detection result has no separate field for this, so it only says so in detail.)
      body: M.outdatedBody(detail ? detail.trim() : null, driver.minVersion),
      action: 'upgrade',
      cta: M.outdatedCta(driver.latestVersion || driver.minVersion),
    };
  }
  if (driver.state === 'signed-out') {
    return {
      kind: 'signed-out',
      tone: 'notice',
      title: M.signedOutTitle(name),
      body: M.signedOutBody(name),
      action: 'login',
      cta: M.signedOutCta,
    };
  }
  return null;
}

// ---- Troubleshooting checklist ----

export type DiagnosisStepKey = 'find' | 'run' | 'version' | 'login' | 'models';

export interface DiagnosisStep {
  key: DiagnosisStepKey;
  label: string;
  state: 'ok' | 'fail' | 'skip';
  detail: string;
}

/**
 * Five steps in dependency order (model-agent-setup.js:96-117). If a step fails, the later ones cannot be tested, so they are marked skip rather than fail:
 * the user only needs to look at the first red one. Everything comes from the detection result; no extra commands are run.
 */
export function diagnose(
  driver: Pick<DriverInfo, 'state' | 'command' | 'executable' | 'version' | 'minVersion' | 'detail' | 'detailRef' | 'account' | 'accountRef' | 'models'>,
): DiagnosisStep[] {
  const found = driver.state !== 'not-installed';
  const runs = found && driver.state !== 'error';
  const versionOk = runs && driver.state !== 'outdated';
  const loggedIn = versionOk && driver.state !== 'signed-out';
  const step = (key: DiagnosisStepKey, label: string, pass: boolean, reachable: boolean, ok: string, fail: string): DiagnosisStep => ({
    key,
    label,
    state: !reachable ? 'skip' : pass ? 'ok' : 'fail',
    detail: !reachable ? M.stepSkipped : pass ? ok : fail,
  });
  const models = driver.models.length;
  return [
    step('find', M.stepFind, found, true, driver.executable ?? driver.command, M.stepFindFail(driver.command)),
    step('run', M.stepRun, runs, found, M.stepRunOk(driver.command, driver.version ?? '—'), localizeText(driver.detail, driver.detailRef) ?? M.stepRunFail),
    step(
      'version',
      M.stepVersion,
      versionOk,
      runs,
      M.stepVersionOk(driver.version ?? '—', driver.minVersion),
      M.stepVersionFail(driver.version ?? '—', driver.minVersion),
    ),
    step('login', M.stepLogin, loggedIn, versionOk, localizeText(driver.account, driver.accountRef) ?? M.stepLoginOk, M.stepLoginFail),
    step('models', M.stepModels, loggedIn, loggedIn, models ? M.stepModelsOk(models) : M.stepModelsNone, ''),
  ];
}

/** The troubleshooting result in one sentence: all passed, or where it got stuck. */
export function diagnosisVerdict(steps: readonly DiagnosisStep[]): { ok: boolean; text: string } {
  const bad = steps.find((s) => s.state === 'fail');
  return bad ? { ok: false, text: M.verdictFail(bad.label, bad.detail) } : { ok: true, text: M.verdictOk };
}

// ---- Top-of-page status card and card order ----

/** Installed agents come first; the rest keep the order the Runtime gives (the order of `DRIVER_IDS`, model-agent-setup.js:358-368). */
export function orderDrivers<T extends Pick<DriverInfo, 'state'>>(drivers: readonly T[]): T[] {
  return [...drivers.filter(isInstalled), ...drivers.filter((d) => !isInstalled(d))];
}

export interface DriverGroups<T> {
  /** Main list: detected agents (first), built-in agents that are always shown but not installed, and user-added agents (not collapsed even when undetected). */
  main: T[];
  /** The “More” collapsed section: the agents among the four tucked into “More” that are not detected. Once any of them is installed, it moves into the main list by itself. */
  more: T[];
  /** The number of built-in agents and the number of user-added agents. */
  builtin: number;
  added: number;
  /** The number of detected agents. */
  found: number;
}

/** Grouping of the full agent table (`groups` in model-agent-setup.js, product design §7.6). The order keeps what the Runtime gives. */
export function groupDrivers<T extends Pick<DriverInfo, 'id' | 'state' | 'source'>>(drivers: readonly T[]): DriverGroups<T> {
  const found = drivers.filter(isInstalled);
  const missing = drivers.filter((d) => !isInstalled(d));
  const folded = (d: T) => d.source !== 'custom' && MORE_BUILTIN_IDS.includes(d.id);
  return {
    main: [...found, ...missing.filter((d) => d.source !== 'custom' && !folded(d)), ...missing.filter((d) => d.source === 'custom')],
    more: missing.filter(folded),
    builtin: drivers.filter((d) => d.source !== 'custom').length,
    added: drivers.filter((d) => d.source === 'custom').length,
    found: found.length,
  };
}

/** The first three agents named in the title of the “More” section. */
export function moreSummary(more: readonly Pick<DriverInfo, 'name'>[]): string {
  return M.moreSummary(
    more.slice(0, 3).map((d) => d.name),
    more.length > 3,
  );
}

export interface AgentOverview {
  state: 'ready' | 'attention' | 'off' | 'missing';
  /** Which agent this sentence is about; null when no agent is detected. */
  driverId: DriverInfo['id'] | null;
  title: string;
  body: string;
  /** `start` goes to a new session, `enable` turns it on, `open` expands that card. */
  action: 'start' | 'enable' | 'open' | null;
  cta: string | null;
}

/** The wording for which model new sessions use by default: the model name if one was set, otherwise “Agent default model”. */
export function defaultModelLabel(driver: Pick<DriverInfo, 'id' | 'models' | 'defaultModel'>): string {
  // The model new sessions actually use: if the model in the preferences has disappeared, it falls back to the recommended model (see `effectiveDefaultModel`).
  const model = effectiveDefaultModel(driver);
  if (!model) return M.agentDefaultModel;
  return driver.models.find((m) => m.id === model)?.label ?? model;
}

/** Top-of-page status card (model-agent-setup.js:346-356): if any agent is usable, it says ready. Otherwise it names the agent with a problem first, then the disabled ones, and only last says none are installed. */
export function agentOverview(drivers: readonly DriverInfo[]): AgentOverview {
  const list = orderDrivers(drivers);
  const usable = list.filter((d) => d.state === 'ready');
  const current = usable.find((d) => d.isDefault) ?? usable[0];
  if (current) {
    return {
      state: 'ready',
      driverId: current.id,
      title: M.readyTitle,
      body: M.readyBody(current.name, defaultModelLabel(current), localizeText(current.plan, current.planRef)),
      action: 'start',
      cta: M.readyCta,
    };
  }
  const bad = list.find(isBlocked);
  const problem = bad ? agentProblem(bad) : null;
  if (bad && problem) {
    return {
      state: 'attention',
      driverId: bad.id,
      title: problem.title,
      body: M.attentionBody(bad.name),
      action: 'open',
      cta: M.attentionCta,
    };
  }
  const off = list.find((d) => d.state === 'disabled');
  if (off) {
    return {
      state: 'off',
      driverId: off.id,
      title: M.offTitle(off.name),
      body: M.offBody,
      action: 'enable',
      cta: M.offCta(off.name),
    };
  }
  return {
    state: 'missing',
    driverId: null,
    title: M.missingTitle,
    body: list.length > 1 ? M.missingBodyMany : M.missingBodyOne,
    action: null,
    cta: null,
  };
}

// ---- Install and upgrade ----

type InstallKind = DriverInstallOption['kind'];

const norm = (raw: string | null | undefined) => String(raw ?? '').replace(/\\/g, '/').toLowerCase();

/**
 * Which manager owns the installed copy: check the **real location** (the link resolved all the way), not the link itself (a simplified version of model-agent-setup.js:169-223).
 * Only the three kinds the Driver can give commands for (official script, Homebrew, npm) are recognized. A copy installed by a version manager’s shim, or by bun / pnpm / yarn / volta, that cannot be recognized is null, leaving the choice to the user. Offering an upgrade command that does not reach this copy would only install another one.
 */
export function installKindOf(executable: string | null, realExecutable: string | null): InstallKind | null {
  const link = norm(executable);
  const real = norm(realExecutable ?? executable);
  if (!link && !real) return null;
  const any = (needles: string[]) => needles.some((n) => link.includes(n) || real.includes(n));
  if (['/mise/shims/', '/.asdf/shims/', '/.nodenv/shims/'].some((n) => link.includes(n))) return null;
  if (any(['/.volta/', '/.bun/', '/.pnpm/', '/pnpm/global/', '/library/pnpm/', '/.local/share/pnpm/', '/.yarn/', '/.config/yarn/', '/yarn/data/global/'])) {
    return null;
  }
  if (real.includes('/cellar/') || real.includes('/caskroom/')) return 'brew';
  if (real.includes('/lib/node_modules/') || (/^[a-z]:\//.test(real) && real.includes('/node_modules/'))) return 'npm';
  if (link.includes('/.nvm/') || link.includes('/fnm/')) return 'npm';
  if (['/.local/share/claude/', '/.claude/'].some((n) => real.includes(n)) || link.includes('/.local/bin/')) return 'script';
  return null;
}

export interface InstallChoice {
  kind: InstallKind;
  label: string;
  /** A prerequisite, for example Homebrew or Node.js. */
  needs: string | null;
  /** The command shown as is: the install command when not installed, the upgrade command when installed. */
  command: string;
  /** Downloads a script from the network and hands it to the shell (`curl … | bash`): reminds the user to copy it and run it themselves. */
  downloadsScript: boolean;
  /**
   * Can run directly from the settings page (▶, `agents.runSetup`): only things like brew and npm. Official-script types (`script`) are never allowed.
   * Even its own `claude update` is copy-only. The Runtime rejects by category, and this matches it (the design mockup’s `S.runnable` only checks for `| bash`).
   */
  runnable: boolean;
}

export interface InstallPlan {
  /** If installed, it is an upgrade. */
  upgrading: boolean;
  choices: InstallChoice[];
  /** The install method recognized from the executable’s real location (given only when upgrading, and only when the method table includes it). */
  detected: InstallKind | null;
  /** The option the segmented control starts on: the recognized one, otherwise the first. */
  initial: InstallKind | null;
}

/** Which commands this install or upgrade section offers (model-agent-setup.js:260-278). Commands always use the Driver’s exact text; no new commands are derived. */
export function installPlan(driver: Pick<DriverInfo, 'state' | 'install' | 'executable' | 'realExecutable'>): InstallPlan {
  const upgrading = isInstalled(driver);
  const choices = driver.install.map((option) => {
    const command = upgrading ? option.upgrade : option.command;
    const downloadsScript = /\|\s*(ba|z)?sh\b/.test(command);
    return {
      kind: option.kind,
      label: localizeText(option.label, option.labelRef),
      needs: localizeText(option.needs, option.needsRef) ?? null,
      command,
      downloadsScript,
      runnable: option.kind !== 'script' && !downloadsScript,
    };
  });
  const kind = upgrading ? installKindOf(driver.executable, driver.realExecutable) : null;
  const detected = kind && choices.some((c) => c.kind === kind) ? kind : null;
  return { upgrading, choices, detected, initial: detected ?? choices[0]?.kind ?? null };
}

// ---- Run inside the app (agents.runSetup) ----

/** This agent’s most recent run (both the snapshot and the events list the newest first). */
export function latestSetupRun(runs: readonly AgentSetupRun[], driverId: DriverInfo['id']): AgentSetupRun | null {
  return runs.find((run) => run.driverId === driverId) ?? null;
}

/** Log box content: the first line is `$ command` (design mockup useCmdRun), followed by the output. If earlier lines were dropped, say so first. */
export function setupLog(run: Pick<AgentSetupRun, 'command' | 'output' | 'droppedLines'>): string {
  const head = [`$ ${run.command}`];
  if (run.droppedLines) head.push(M.logDropped(run.droppedLines));
  return [...head, ...run.output].join('\n');
}

/**
 * The toast message shown after a successful run and re-detection (settings-agent-provider.jsx:126-139). Failures and stops do not pop up a toast; the result stays in the log box.
 * When it is installed but still not detected (for example, it was installed into a directory that is not on PATH), the message prompts the user to set the location manually.
 */
export function setupDoneToast(
  run: Pick<AgentSetupRun, 'action' | 'state'>,
  driver: Pick<DriverInfo, 'name' | 'state' | 'version'>,
): { tone: 'positive' | 'neutral'; text: string } | null {
  if (run.state !== 'completed') return null;
  if (driver.state === 'not-installed') return { tone: 'neutral', text: M.doneNotDetected(driver.name) };
  const version = driver.version ?? '';
  if (run.action === 'install') {
    return { tone: 'positive', text: driver.state === 'signed-out' ? M.doneSignIn(driver.name, version) : M.doneInstalled(driver.name, version) };
  }
  return { tone: 'positive', text: M.doneUpgraded(driver.name, version) };
}

// ---- Default model and effort ----

/** Picker keys must be strings. “Agent default model” (no model passed) and “Default model effort” each use a sentinel that will not collide with a native id. */
export const AGENT_DEFAULT_MODEL_KEY = '__agent-default__';
export const MODEL_DEFAULT_EFFORT_KEY = '__model-default__';

/** How a model is positioned (model-agent-setup.js:122-126). */
export const TIER_COPY: Record<ModelTier, { label: string; description: string }> = live(() => M.tier);

export interface ModelChoice {
  key: string;
  /** The `defaultModel` passed to `agents.configure`; null means the Agent default model. */
  model: string | null;
  label: string;
  tag: string | null;
  description: string | null;
  /** The model in the preferences is no longer in the model list: it is shown as is, noted that new sessions will use the recommended model instead, and cannot be selected anymore. */
  missing: boolean;
}

/**
 * The default model dropdown starts with “Agent default model”, followed by the model list (same order as the model menu in sessions, design mockup model-agent.js:712-724).
 * A model in the preferences that has disappeared from the model list is still shown as is. When the model list is empty, there is only the “Agent default model” item.
 * Only the one that is recommended gets the “Recommended” tag (design mockup model-agent-setup.js `modelChoices`, see `modelTierOf`).
 */
export function modelChoices(
  driver: Pick<DriverInfo, 'id' | 'state' | 'version' | 'latestVersion' | 'models' | 'defaultModel' | 'configModel' | 'configModelKnown'>,
): ModelChoice[] {
  const gate = configModelGate(driver);
  const rows: ModelChoice[] = [
    {
      key: AGENT_DEFAULT_MODEL_KEY,
      model: null,
      label: M.agentDefaultModel,
      tag: null,
      description: gate ? M.cliConfigGate(gate.model) : driver.configModel ? M.cliConfigModel(driver.configModel) : M.cliConfig,
      missing: false,
    },
  ];
  if (driver.defaultModel && !driver.models.some((m) => m.id === driver.defaultModel)) {
    rows.push({ key: driver.defaultModel, model: driver.defaultModel, label: driver.defaultModel, tag: null, description: M.modelMissing, missing: true });
  }
  const tierOf = modelTierOf(driver);
  for (const m of driver.models) {
    const tierId = tierOf(m);
    const tier = tierId ? TIER_COPY[tierId] : null;
    rows.push({ key: m.id, model: m.id, label: m.label, tag: tier?.label ?? null, description: m.description ?? tier?.description ?? null, missing: false });
  }
  return rows;
}

/** The selected item is the model new sessions will actually use. If the preferred model has disappeared, it is the recommended model, and the disabled “No longer in the model list” entry is not selected. */
export function selectedModelKey(driver: Pick<DriverInfo, 'id' | 'models' | 'defaultModel'>): string {
  return effectiveDefaultModel(driver) ?? AGENT_DEFAULT_MODEL_KEY;
}

/** Names of reasoning effort levels; an unrecognized id uses the label the Driver provides. */
export const EFFORT_LABEL: Record<string, string> = live(() => M.effort);

export function effortLabel(effort: { id: string; label: string }): string {
  return EFFORT_LABEL[effort.id] ?? effort.label;
}

export interface EffortChoice {
  key: string;
  effort: string | null;
  label: string;
  missing: boolean;
}

/**
 * The default effort dropdown. It exists only when a model has been specified and that model has effort levels. Otherwise it returns null, and the UI does not show this item
 * (for the Agent default model, the CLI decides the effort itself).
 */
export function effortChoices(driver: Pick<DriverInfo, 'id' | 'models' | 'defaultModel' | 'defaultEffort'>): EffortChoice[] | null {
  const current = effectiveDefaultModel(driver);
  const model = driver.models.find((m) => m.id === current);
  if (!model || model.efforts.length === 0) return null;
  const fallback = model.efforts.find((e) => e.id === model.defaultEffort);
  const rows: EffortChoice[] = [
    { key: MODEL_DEFAULT_EFFORT_KEY, effort: null, label: fallback ? M.modelDefaultEffortOf(effortLabel(fallback)) : M.modelDefaultEffort, missing: false },
  ];
  if (driver.defaultEffort && !model.efforts.some((e) => e.id === driver.defaultEffort)) {
    rows.push({ key: driver.defaultEffort, effort: driver.defaultEffort, label: driver.defaultEffort, missing: true });
  }
  for (const e of model.efforts) rows.push({ key: e.id, effort: e.id, label: effortLabel(e), missing: false });
  return rows;
}

export function selectedEffortKey(driver: Pick<DriverInfo, 'defaultEffort'>): string {
  return driver.defaultEffort ?? MODEL_DEFAULT_EFFORT_KEY;
}

// ---- “Always allow” rules ----

export interface RulesView {
  /** Removes duplicates and empty strings, keeping the order they were added. When removed, the value is passed back unchanged to `agents.removeRule`. */
  rules: string[];
  title: string;
  body: string;
}

/** The rule list (page-settings-agent.jsx:162-166). */
export function rulesView(rules: readonly string[] | null | undefined): RulesView {
  const list = [...new Set((rules ?? []).filter((r) => r.length > 0))];
  return {
    rules: list,
    title: M.rulesTitle(list.length),
    body: list.length ? M.rulesBody : M.rulesEmpty,
  };
}

// ---- Advanced › Technical info ----

/** The text for “Copy diagnostic info”: one line per agent, with its status, version and path (page-settings-agent.jsx:174-176). */
export function diagnosticsText(drivers: readonly Pick<DriverInfo, 'name' | 'state' | 'version' | 'executable' | 'realExecutable'>[]): string {
  return drivers
    .map((d) => {
      const parts = [`${d.name}: ${d.state}`];
      if (d.version) parts.push(`v${d.version}`);
      if (d.executable) parts.push(d.executable);
      if (d.realExecutable && d.realExecutable !== d.executable) parts.push(`→ ${d.realExecutable}`);
      return parts.join(' ');
    })
    .join('\n');
}
