import { useEffect, useRef, useState, type ReactNode } from 'react';
import { localizeText, type AgentSetupAction, type DriverInfo, type DriverInstallOption } from '@cuccut/protocol';
import {
  ActionButton,
  AlertDialog,
  Badge,
  Button,
  DialogContainer,
  Disclosure,
  DisclosurePanel,
  DisclosureTitle,
  Picker,
  PickerItem,
  SegmentedControl,
  SegmentedControlItem,
  Switch,
  Text,
  ToastQueue,
} from '@react-spectrum/s2';
import AlertTriangle from '@react-spectrum/s2/icons/AlertTriangle';
import CheckmarkCircle from '@react-spectrum/s2/icons/CheckmarkCircle';
import ChevronDown from '@react-spectrum/s2/icons/ChevronDown';
import ChevronUp from '@react-spectrum/s2/icons/ChevronUp';
import Clock from '@react-spectrum/s2/icons/Clock';
import InfoCircle from '@react-spectrum/s2/icons/InfoCircle';
import OpenIn from '@react-spectrum/s2/icons/OpenIn';
import { iconStyle, style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { ACP_CATALOG } from '../../model/acp-catalog.ts';
import { isCustomDriver, launcherOf, launchLine, type Launcher } from '../../model/agent-catalog.ts';
import {
  cancelAgentSetup,
  configureAgent,
  detectAgents,
  openAgentTerminal,
  removeAgentProvider,
  runAgentSetup,
  setDefaultAgent,
} from '../../runtime/agent-commands.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useAgentSetup } from '../../state/agent-setup-store.ts';
import { AgentProviderIcon } from '../agent-provider-icon.tsx';
import { CommandBlock, ExecutableField, RunCommandDialog, copyText, type CommandRunner } from './agent-command-block.tsx';
import { SettingsRow } from './settings-ui.tsx';
import { CodexImageRow } from './codex-image-row.tsx';
import { CARD_COPY } from './agent-card-copy.ts';
import { AGENT_COPY, ADDED_COPY, UNTESTED } from './agent-copy.ts';
import {
  agentBadge,
  agentProblem,
  configModelGate,
  diagnose,
  diagnosisVerdict,
  effortChoices,
  hasUpdate,
  installPlan,
  isBlocked,
  isInstalled,
  latestSetupRun,
  loginCommandOf,
  modelChoices,
  selectedEffortKey,
  selectedModelKey,
  type InstallChoice,
  type InstallPlan,
  type ProblemAction,
} from './agent-setup.ts';

// The cards sit one after another inside the provider list’s padding-less card, with a divider line between them (.agset-provider in settings-agent.css).
const card = style({
  borderTopWidth: { default: 1, ':first-child': 0 },
  borderXWidth: 0,
  borderBottomWidth: 0,
  borderStyle: 'solid',
  borderColor: 'gray-200',
});
const head = style({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, padding: 20 });
const avatar = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  size: 40,
  borderRadius: '[12px]',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: { default: 'gray-200', isReady: 'green-200' },
  backgroundColor: { default: 'transparent', isReady: 'green-100' },
  // The avatar shows the agent’s own icon (AgentProviderIcon). “Ready” (能用) is shown only by the background and border; the monochrome icon is not tinted green (prototype .agset-avatar.is-ready).
  color: 'gray-700',
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});
const headText = style({ flexGrow: 1, flexBasis: 0, minWidth: 200 });
const nameRow = style({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 });
const name = style({ font: 'ui', fontWeight: 'bold', color: 'gray-900' });
const sub = style({ marginTop: 4, marginBottom: 0, font: 'ui-sm', color: 'gray-600', overflowWrap: 'anywhere' });
const headControls = style({ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginStart: 'auto' });
// The problem bar, the model-configuration hint and the new-version hint run full width directly under the card header, with a divider line above them (.agp-problem / .agp-update).
const problemStrip = style({
  display: 'flex',
  alignItems: 'start',
  flexWrap: 'wrap',
  gap: 12,
  paddingX: 20,
  paddingY: 12,
  borderTopWidth: 1,
  borderXWidth: 0,
  borderBottomWidth: 0,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  backgroundColor: { default: 'orange-100', isNegative: 'red-100' },
});
const problemIcon = style({
  display: 'flex',
  flexShrink: 0,
  marginTop: 2,
  color: { default: 'orange-1000', isNegative: 'red-1000' },
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});
const problemText = style({ flexGrow: 1, flexBasis: 0, minWidth: 200 });
const problemTitle = style({ font: 'ui-sm', fontWeight: 'bold', color: 'gray-900' });
const problemBody = style({ marginTop: 4, marginBottom: 0, font: 'ui-sm', color: 'gray-800', overflowWrap: 'anywhere' });
const problemAction = style({ flexShrink: 0, alignSelf: 'center' });
const strip = style({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 16,
  paddingX: 20,
  paddingY: 12,
  borderTopWidth: 1,
  borderXWidth: 0,
  borderBottomWidth: 0,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  backgroundColor: 'gray-50',
  font: 'ui-sm',
  color: 'gray-800',
});
const stripText = style({ flexGrow: 1, flexBasis: 0, minWidth: 200 });
const detail = style({
  padding: 20,
  borderTopWidth: 1,
  borderXWidth: 0,
  borderBottomWidth: 0,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  backgroundColor: 'gray-50',
  minWidth: 0,
});
const stack = style({ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 });
const hint = style({ margin: 0, font: 'ui-sm', color: 'gray-600' });
const steps = style({ display: 'flex', flexDirection: 'column', gap: 16, marginY: 12, paddingStart: 20, font: 'ui-sm', color: 'gray-700' });
const stepTitle = style({ display: 'block', font: 'ui', fontWeight: 'medium', color: 'gray-900', marginBottom: 4 });
const note = style({ marginY: 12, font: 'ui-sm', color: 'gray-700' });
const codeInline = style({ font: 'code-sm', color: 'gray-900', userSelect: 'text' });
const diag = style({
  marginTop: 20,
  paddingTop: 16,
  borderTopWidth: 1,
  borderXWidth: 0,
  borderBottomWidth: 0,
  borderStyle: 'solid',
  borderColor: 'gray-200',
});
const checks = style({ display: 'flex', flexDirection: 'column', gap: 8, marginY: 0, paddingStart: 0, listStyleType: 'none' });
const check = style({ display: 'flex', alignItems: 'start', gap: 8, font: 'ui-sm', color: 'gray-700' });
const checkIcon = style({ flexShrink: 0, color: { default: 'gray-500', isOk: 'positive-900', isFail: 'negative-900' } });
const checkLabel = style({ font: 'ui-sm', fontWeight: 'medium', color: 'gray-900' });
const checkDetail = style({ margin: 0, overflowWrap: 'anywhere', userSelect: 'text' });
const verdict = style({ marginTop: 12, marginBottom: 0, font: 'ui-sm', fontWeight: 'medium', color: { default: 'negative-900', isOk: 'positive-900' } });
const pickers = style({ display: 'flex', flexWrap: 'wrap', gap: 8 });
// The note bar at the top of the details (.agp-note): an icon plus a line of text. `isNotice` marks the kind that needs attention (full access only).
const noteBox = style({
  display: 'flex',
  alignItems: 'start',
  gap: 8,
  marginBottom: 12,
  padding: 12,
  borderRadius: 'default',
  backgroundColor: { default: 'gray-100', isNotice: 'orange-100' },
  font: 'ui-sm',
  color: 'gray-800',
});
const noteIcon = style({
  display: 'flex',
  flexShrink: 0,
  marginTop: 2,
  color: { default: 'gray-700', isNotice: 'orange-1000' },
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});
const docsLink = style({ marginTop: 8 });

const TONE_BADGE = { positive: 'positive', notice: 'notice', negative: 'negative', neutral: 'neutral' } as const;

/**
 * One agent (design mockup settings-agent-provider.jsx): a single row answers whether it is installed, whether it can be used, and whether it is on. When there is a problem, the problem bar shows right under the row.
 * Expanded, it shows the things that change day to day: default model, version and upgrade, account, install location, troubleshooting. When it is not installed, the expanded view shows install instructions.
 *
 * Install, upgrade and login (architecture design §12.9, via the Runtime’s `agents.*` commands):
 * - Install and upgrade commands such as brew and npm have a ▶ on their left: a confirmation pops up first (showing the full command). After confirming, the Runtime runs it inside the app, the output appears below the command,
 *   and the Runtime re-detects automatically when it finishes. On failure, it offers “Run in terminal”. The “Upgrade to X” in the problem bar and the upgrade button in the model-configuration hint take the same path.
 * - Official scripts such as `curl … | bash` get no ▶, only copy.
 * - Login (“Log in in Terminal”, “Switch account…”) opens the system terminal and runs the login command. If that cannot be opened, it falls back to copy and explains. Detection runs once more when the user returns to the window.
 *
 * Run state lives in the Runtime (`agent-setup` topic, mirrored by `useAgentSetup`); the same agent runs only one command at a time.
 */
export function AgentProviderCard({
  driver,
  open,
  onToggle,
  connected,
}: {
  driver: DriverInfo;
  open: boolean;
  onToggle: (open: boolean) => void;
  connected: boolean;
}) {
  const runtime = useRuntime();
  const web = runtime.host.platform === 'web';
  const [busy, setBusy] = useState<null | Busy>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const installed = isInstalled(driver);
  // User-added (product design §7.6): CucCut has no install command for it, only knows how to launch it. Agents run on demand via npx / uvx need no separate install.
  const added = isCustomDriver(driver);
  const launch = added ? (driver.custom?.command ?? [driver.command]) : null;
  const launcher = launch ? launcherOf(launch) : null;
  const blocked = isBlocked(driver);
  const badge = agentBadge(driver);
  const problem = agentProblem(driver);
  const gate = configModelGate(driver);
  const update = hasUpdate(driver);
  // In the browser you can only view and copy. Start/stop, detect, default, install and run, terminal and location all need `agents.*` commands outside the web allowlist.
  const disabled = web || !connected || busy !== null;

  // ---- Install and upgrade: the method is remembered by the card (the “Upgrade to X” in the problem bar follows whichever option is selected in the segmented control); run state comes from the Runtime ----
  const plan = installPlan(driver);
  const [picked, setPicked] = useState<InstallKind | null>(null);
  const choice = plan.choices.find((c) => c.kind === (picked ?? plan.initial)) ?? plan.choices[0] ?? null;
  const setupAction: AgentSetupAction = plan.upgrading ? 'upgrade' : 'install';
  const latest = useAgentSetup((s) => latestSetupRun(s.runs, driver.id));
  const shown = useAgentSetup((s) => s.shown);
  const setupRunning = latest?.state === 'running';
  const visibleRun = latest && (setupRunning || shown.has(latest.runId)) ? latest : null;
  const [confirm, setConfirm] = useState<InstallChoice | null>(null);

  const askRun = () => {
    if (choice?.runnable && !setupRunning) setConfirm(choice);
  };
  const startRun = async (c: InstallChoice) => {
    try {
      await runAgentSetup(runtime, driver.id, setupAction, c.kind);
    } catch (error) {
      ToastQueue.negative(CARD_COPY.runFailed((error as Error).message), { timeout: 5000 });
    }
  };
  const stopRun = async () => {
    if (!latest || latest.state !== 'running') return;
    try {
      await cancelAgentSetup(runtime, latest.runId);
    } catch (error) {
      ToastQueue.negative(CARD_COPY.stopFailed((error as Error).message), { timeout: 5000 });
    }
  };

  // ---- System terminal: for login, and for running in the terminal after a failure. When the user returns to this window after opening it, detection runs once more ----
  const stopWatchingReturn = useRef<(() => void) | null>(null);
  useEffect(() => () => stopWatchingReturn.current?.(), []);
  const recheckOnReturn = () => {
    stopWatchingReturn.current?.();
    const onFocus = () => {
      stopWatchingReturn.current?.();
      void detectAgents(runtime, driver.id).catch(() => {});
    };
    window.addEventListener('focus', onFocus);
    stopWatchingReturn.current = () => {
      window.removeEventListener('focus', onFocus);
      stopWatchingReturn.current = null;
    };
  };
  const inTerminal = async (action: 'login' | AgentSetupAction, kind?: InstallKind) => {
    const label = action === 'login' ? CARD_COPY.loginCommand : action === 'install' ? CARD_COPY.installCommand : CARD_COPY.upgradeCommand;
    // When the detection result has no login command, the Runtime does not supply one and the user is simply asked to copy it (loginCommandOf falls back to launching the CLI directly).
    if (action === 'login' && !driver.loginCommand) return void copyText(loginCommandOf(driver), label);
    try {
      const result = await openAgentTerminal(runtime, driver.id, action, kind);
      if (result.status === 'opened') {
        ToastQueue.neutral(action === 'login' ? CARD_COPY.terminalLogin(result.command) : CARD_COPY.terminalRun(result.command), {
          timeout: 5000,
        });
        recheckOnReturn();
        return;
      }
      // If no terminal can be opened on this computer (or the OS is not recognized), fall back to copy.
      try {
        await navigator.clipboard.writeText(result.command);
        ToastQueue.neutral(CARD_COPY.terminalCopied(label), { timeout: 5000 });
      } catch {
        ToastQueue.neutral(CARD_COPY.terminalManual(result.command), { timeout: 8000 });
      }
    } catch (error) {
      ToastQueue.negative(CARD_COPY.terminalFailed((error as Error).message), { timeout: 5000 });
    }
  };

  // The browser shows no ▶ (`agents.runSetup` is not on the web allowlist). Commands are copy-only, and the instructions are written for copying too.
  const runnerFor = (c: InstallChoice): CommandRunner | undefined =>
    c.runnable && !web
      ? {
          run: visibleRun && visibleRun.command === c.command && visibleRun.kind === c.kind ? visibleRun : null,
          isDisabled: !connected || setupRunning,
          onRun: () => setConfirm(c),
          onStop: () => void stopRun(),
          onTerminal: () => void inTerminal(setupAction, c.kind),
        }
      : undefined;
  const setup: SetupControls = { plan, choice, pick: setPicked, runnerFor, running: setupRunning };

  const run = async (kind: Busy, task: () => Promise<unknown>, failure: (message: string) => string) => {
    setBusy(kind);
    try {
      await task();
      return true;
    } catch (error) {
      ToastQueue.negative(failure((error as Error).message), { timeout: 5000 });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const setEnabled = (enabled: boolean) =>
    void run('enable', () => configureAgent(runtime, driver.id, { enabled }), enabled ? CARD_COPY.enableFailed : CARD_COPY.disableFailed).then(
      (ok) => ok && ToastQueue.neutral(enabled ? CARD_COPY.enabled(driver.name) : CARD_COPY.disabled(driver.name), { timeout: 3000 }),
    );

  const recheck = () =>
    void run('detect', () => detectAgents(runtime, driver.id), CARD_COPY.recheckFailed).then((ok) => {
      if (ok) setDiagnosing(true);
    });

  const remove = async () => {
    try {
      await removeAgentProvider(runtime, driver.id);
      ToastQueue.neutral(ADDED_COPY.removed(driver.name), { timeout: 3000 });
    } catch (error) {
      ToastQueue.negative(ADDED_COPY.removeFailed((error as Error).message), { timeout: 5000 });
    }
  };

  const act = (action: ProblemAction) => {
    if (action === 'login') return void inTerminal('login');
    onToggle(true);
    if (action === 'diagnose') recheck();
    // If it can run inside the app, a confirmation pops up directly. Official-script types only expand the details, so the user sees the copy entry (design mockup runPlan).
    else if (action === 'upgrade') askRun();
  };

  return (
    <div className={card}>
      <div className={head}>
        <span className={avatar({ isReady: driver.state === 'ready' })} data-cc-icons="primary" aria-hidden>
          <AgentProviderIcon driver={driver} />
        </span>
        <div className={headText}>
          <div className={nameRow}>
            <span className={name}>{driver.name}</span>
            {driver.isDefault ? (
              <Badge variant="accent" size="S" fillStyle="subtle">
                {CARD_COPY.defaultBadge}
              </Badge>
            ) : null}
            <Badge variant={TONE_BADGE[badge.tone]} size="S" fillStyle="subtle">
              {badge.label}
            </Badge>
            {added ? (
              <Badge variant="neutral" size="S" fillStyle="outline">
                {ADDED_COPY.chip}
              </Badge>
            ) : null}
            {driver.tested ? null : (
              <Badge variant="notice" size="S" fillStyle="outline">
                {UNTESTED.badge}
              </Badge>
            )}
          </div>
          <p className={sub}>
            {added
              ? installed
                ? ADDED_COPY.subFound(driver.version)
                : launcher
                  ? ADDED_COPY.subLauncher(launcher.kind, launcher.needs)
                  : ADDED_COPY.subMissing(launch?.[0] ?? driver.command)
              : installed
                ? CARD_COPY.subInstalled(driver.version ?? null, localizeText(driver.account, driver.accountRef) ?? null)
                : CARD_COPY.subMissing(driver.command, localizeText(driver.plan, driver.planRef))}
          </p>
        </div>
        <div className={headControls}>
          {installed ? (
            <Switch
              aria-label={CARD_COPY.enable(driver.name)}
              size="S"
              isSelected={driver.enabled && !blocked}
              isDisabled={blocked || disabled}
              onChange={setEnabled}
            />
          ) : null}
          <ActionButton isQuiet={installed} size="S" aria-expanded={open} onPress={() => onToggle(!open)}>
            <Text>{installed ? CARD_COPY.details : added ? ADDED_COPY.detect : CARD_COPY.install}</Text>
            {open ? <ChevronUp /> : <ChevronDown />}
          </ActionButton>
          {/* Removal is offered only for user-added agents, and not shown in the browser (`agents.removeProvider` is not on the web allowlist). */}
          {added && !web ? (
            <ActionButton isQuiet size="S" isDisabled={!connected} onPress={() => setRemoving(true)}>
              {ADDED_COPY.remove}
            </ActionButton>
          ) : null}
        </div>
      </div>

      {/* Image generation with Codex (settings-agent-provider.jsx:200-203): appears only when Codex has been found, placed under the card header and before the problem bar. */}
      {driver.id === 'codex' && installed ? <CodexImageRow driver={driver} connected={connected} /> : null}

      {problem ? (
        <div className={problemStrip({ isNegative: problem.tone === 'negative' })} role="alert">
          <span className={problemIcon({ isNegative: problem.tone === 'negative' })} aria-hidden>
            <AlertTriangle styles={iconStyle({ size: 'S' })} />
          </span>
          <div className={problemText}>
            <div className={problemTitle}>{problem.title}</div>
            <p className={problemBody}>{problem.body}</p>
          </div>
          {/* Every provider card can carry a problem: the strip's action stays neutral, the page's one yellow is the overview. */}
          <Button
            variant="secondary"
            size="S"
            styles={problemAction}
            isDisabled={web || (problem.action !== 'login' && disabled) || (problem.action === 'upgrade' && setupRunning)}
            onPress={() => act(problem.action)}>
            {busy === 'detect' && problem.action === 'diagnose' ? CARD_COPY.checking : problem.cta}
          </Button>
        </div>
      ) : gate ? (
        <div className={problemStrip({ isNegative: false })} role="status">
          <span className={problemIcon({ isNegative: false })} aria-hidden>
            <AlertTriangle styles={iconStyle({ size: 'S' })} />
          </span>
          <div className={problemText}>
            <div className={problemTitle}>{CARD_COPY.gateTitle(driver.name, gate.model)}</div>
            <p className={problemBody}>
              {CARD_COPY.gateBody(gate.version ?? '—', gate.model)}
              {gate.latest ? CARD_COPY.gateUpgrade : CARD_COPY.gateNoUpgrade}
            </p>
          </div>
          {gate.latest ? (
            <Button variant="secondary" size="S" styles={problemAction} isDisabled={disabled || setupRunning} onPress={() => act('upgrade')}>
              {CARD_COPY.upgradeTo(gate.latest)}
            </Button>
          ) : null}
        </div>
      ) : update && !open ? (
        <div className={strip}>
          <span className={stripText}>
            {CARD_COPY.updateStrip(driver.latestVersion ?? '', driver.version ?? '')}
          </span>
          <Button variant="secondary" size="S" onPress={() => onToggle(true)}>
            {CARD_COPY.viewUpgrade}
          </Button>
        </div>
      ) : null}

      {open ? (
        <div className={detail} id={`agent-detail-${driver.id}`}>
          {installed ? (
            <InstalledDetail
              launch={launch}
              launcher={launcher}
              driver={driver}
              disabled={disabled}
              busy={busy}
              run={run}
              onRecheck={recheck}
              setup={setup}
              onLogin={() => void inTerminal('login')}
              canLogin={connected && !web}
            />
          ) : launch ? (
            <AddedInstallPanel
              driver={driver}
              launch={launch}
              launcher={launcher}
              disabled={disabled}
              busy={busy === 'detect'}
              onDetect={recheck}
            />
          ) : (
            <InstallPanel driver={driver} disabled={disabled} busy={busy === 'detect'} onRecheck={recheck} setup={setup} />
          )}
          {diagnosing ? <Diagnosis driver={driver} /> : null}
        </div>
      ) : null}

      <DialogContainer onDismiss={() => setConfirm(null)}>
        {confirm ? <RunCommandDialog action={setupAction} name={driver.name} command={confirm.command} onRun={() => void startRun(confirm)} /> : null}
      </DialogContainer>
      {/* Removal asks for confirmation first. There is no undo: the Runtime returns only the environment variable names, so an undo cannot restore the values. Tasks that were using it have also already ended. */}
      <DialogContainer onDismiss={() => setRemoving(false)}>
        {removing ? (
          <AlertDialog
            title={ADDED_COPY.removeTitle(driver.name)}
            variant="destructive"
            primaryActionLabel={ADDED_COPY.remove}
            cancelLabel={CARD_COPY.cancel}
            onPrimaryAction={() => void remove()}>
            {ADDED_COPY.removeBody(driver.name)}
          </AlertDialog>
        ) : null}
      </DialogContainer>
    </div>
  );
}

type InstallKind = DriverInstallOption['kind'];

/** Passed to the install/upgrade section of the card: the methods, the selected one, and the ▶ for each command. */
interface SetupControls {
  plan: InstallPlan;
  choice: InstallChoice | null;
  pick: (kind: InstallKind) => void;
  runnerFor: (choice: InstallChoice) => CommandRunner | undefined;
  /** A command is running for this agent, so the segmented control cannot be switched. */
  running: boolean;
}

/** The card runs only one thing at a time. Refreshing models has its own slot and does not share the “Run diagnostics” wording, and it does not expand the diagnostic results. */
type Busy = 'enable' | 'detect' | 'models' | 'default' | 'model';
type Run = (kind: Busy, task: () => Promise<unknown>, failure: (message: string) => string) => Promise<boolean>;

function InstalledDetail({
  launch,
  launcher,
  driver,
  disabled,
  busy,
  run,
  onRecheck,
  setup,
  onLogin,
  canLogin,
}: {
  /** The launch command of the user-added agent; null for built-in ones. */
  launch: readonly string[] | null;
  launcher: Launcher | null;
  driver: DriverInfo;
  disabled: boolean;
  busy: string | null;
  run: Run;
  onRecheck: () => void;
  setup: SetupControls;
  onLogin: () => void;
  canLogin: boolean;
}) {
  const runtime = useRuntime();
  const models = modelChoices(driver);
  const efforts = effortChoices(driver);
  const plan = setup.plan;
  const update = hasUpdate(driver);
  const signedOut = driver.state === 'signed-out';

  const setModel = (key: string) => {
    const choice = models.find((m) => m.key === key);
    if (!choice || choice.missing || choice.model === driver.defaultModel) return;
    void run('model', () => configureAgent(runtime, driver.id, { defaultModel: choice.model }), CARD_COPY.saveModelFailed);
  };
  const setEffort = (key: string) => {
    const choice = efforts?.find((e) => e.key === key);
    if (!choice || choice.missing || choice.effort === driver.defaultEffort) return;
    // Pass only the effort: the Runtime changes only the effort and leaves the saved model alone (a model never set still follows the recommended model). Including `driver.defaultModel` would pin the recommended model as if the user had set it.
    void run('model', () => configureAgent(runtime, driver.id, { defaultEffort: choice.effort }), CARD_COPY.saveEffortFailed);
  };
  // The protocol has no separate “refresh models” call. The model list updates together with detection, so this also goes through agents.detect.
  const refreshModels = () =>
    void run('models', () => detectAgents(runtime, driver.id), CARD_COPY.refreshFailed).then(
      (ok) => ok && ToastQueue.neutral(CARD_COPY.refreshed(driver.name), { timeout: 3000 }),
    );
  const setDefault = () =>
    void run('default', () => setDefaultAgent(runtime, driver.id), CARD_COPY.setDefaultFailed).then(
      (ok) => ok && ToastQueue.positive(CARD_COPY.nowDefault(driver.name), { timeout: 3000 }),
    );

  return (
    <>
      {driver.capabilities.approvals ? null : <Note notice>{AGENT_COPY.fullAccessOnly}</Note>}
      {driver.tested ? null : <Note>{UNTESTED.body}</Note>}
      <SettingsRow label={CARD_COPY.defaultModel} desc={CARD_COPY.defaultModelDesc}>
        <div className={pickers}>
          <Picker
            aria-label={CARD_COPY.defaultModelOf(driver.name)}
            size="S"
            align="end"
            selectedKey={selectedModelKey(driver)}
            disabledKeys={models.filter((m) => m.missing).map((m) => m.key)}
            isDisabled={disabled}
            onSelectionChange={(key) => setModel(String(key))}
            styles={style({ width: 200 })}>
            {models.map((m) => (
              <PickerItem key={m.key} id={m.key} textValue={m.label}>
                <Text slot="label">{m.tag ? `${m.label} · ${m.tag}` : m.label}</Text>
                {m.description ? <Text slot="description">{m.description}</Text> : null}
              </PickerItem>
            ))}
          </Picker>
          {efforts ? (
            <Picker
              aria-label={CARD_COPY.defaultEffortOf(driver.name)}
              size="S"
              align="end"
              selectedKey={selectedEffortKey(driver)}
              disabledKeys={efforts.filter((e) => e.missing).map((e) => e.key)}
              isDisabled={disabled}
              onSelectionChange={(key) => setEffort(String(key))}
              styles={style({ width: 140 })}>
              {efforts.map((e) => (
                <PickerItem key={e.key} id={e.key} textValue={e.label}>
                  {e.label}
                </PickerItem>
              ))}
            </Picker>
          ) : null}
        </div>
      </SettingsRow>
      <SettingsRow
        label={CARD_COPY.modelsOf(driver.name, driver.models.length)}
        desc={
          driver.models.length
            ? CARD_COPY.modelsList(driver.models.map((m) => m.label).join(' / '))
            : CARD_COPY.modelsNone
        }>
        <Button variant="secondary" size="S" isDisabled={disabled || isBlocked(driver)} onPress={refreshModels}>
          {busy === 'models' ? CARD_COPY.refreshing : CARD_COPY.refreshModels}
        </Button>
      </SettingsRow>
      {launch ? (
        <SettingsRow
          label={CARD_COPY.version(driver.version ?? null)}
          desc={launcher ? ADDED_COPY.versionPinned(launcher.spec) : ADDED_COPY.versionOwn}
        />
      ) : (
        <SettingsRow
          label={CARD_COPY.version(driver.version ?? null)}
          desc={CARD_COPY.versionDesc(update ? String(driver.latestVersion) : null, driver.minVersion || null, upgradeSource(plan))}
          below={plan.choices.length ? <InstallCommands setup={setup} copyLabel={CARD_COPY.upgradeCommand} /> : null}
        />
      )}
      <SettingsRow
        label={CARD_COPY.account}
        desc={
          launch
            ? ADDED_COPY.account(driver.name, signedOut)
            : CARD_COPY.accountDesc(signedOut, localizeText(driver.account, driver.accountRef) ?? null, localizeText(driver.plan, driver.planRef))
        }>
        <Button variant="secondary" size="S" isDisabled={!canLogin} onPress={onLogin}>
          {signedOut ? CARD_COPY.loginInTerminal : CARD_COPY.switchAccount}
        </Button>
      </SettingsRow>
      <SettingsRow
        label={CARD_COPY.location}
        desc={CARD_COPY.locationDesc}
        below={
          <div className={stack}>
            {driver.executable ? <CommandBlock value={driver.executable} copyLabel={AGENT_COPY.pathLabel} /> : null}
            {driver.realExecutable && driver.realExecutable !== driver.executable ? (
              <p className={hint}>
                {CARD_COPY.realLocation} <span className={codeInline}>{driver.realExecutable}</span>
              </p>
            ) : null}
            <Disclosure size="S" isQuiet defaultExpanded={!!driver.executableOverride}>
              <DisclosureTitle>{CARD_COPY.setLocation}</DisclosureTitle>
              <DisclosurePanel>
                <ExecutableField driver={driver} isDisabled={disabled} />
              </DisclosurePanel>
            </Disclosure>
          </div>
        }
      />
      {launch ? (
        <SettingsRow
          label={ADDED_COPY.launchRow}
          desc={ADDED_COPY.launchRowHint}
          below={<CommandBlock value={launchLine(launch, driver.custom?.envKeys ?? [])} copyLabel={ADDED_COPY.launchCopy} />}
        />
      ) : null}
      <SettingsRow label={CARD_COPY.troubleshoot} desc={CARD_COPY.troubleshootDesc}>
        {!driver.isDefault && driver.state === 'ready' ? (
          <Button variant="secondary" size="S" isDisabled={disabled} onPress={setDefault}>
            {CARD_COPY.setDefault}
          </Button>
        ) : null}
        <Button variant="secondary" size="S" isDisabled={disabled} onPress={onRecheck}>
          {busy === 'detect' ? CARD_COPY.checking : CARD_COPY.runChecks}
        </Button>
      </SettingsRow>
    </>
  );
}

/** The last sentence of the upgrade note: if the install source was recognized, name it; otherwise ask the user to use the same method as originally. */
function upgradeSource(plan: InstallPlan): string {
  const via = plan.choices.find((c) => c.kind === plan.detected);
  return via ? CARD_COPY.sourceKnown(via.label) : CARD_COPY.sourceUnknown;
}

/**
 * The install or upgrade methods (a segmented switch when there is more than one; cannot be changed while running) and their commands. The method recognized at startup is selected first.
 * Copy follows the design mockup (settings-agent-provider.jsx:89-94, 259-266): when installing, first say what ▶ does; for commands that cannot run inside the app, give one line of copy instructions.
 */
function InstallCommands({ setup, copyLabel }: { setup: SetupControls; copyLabel: string }) {
  const { plan, choice } = setup;
  if (!choice) return null;
  const installing = !plan.upgrading;
  const runnable = !!setup.runnerFor(choice);
  const scriptHint = runnable
    ? null
    : choice.downloadsScript
      ? installing
        ? CARD_COPY.scriptInstall
        : CARD_COPY.scriptUpgrade
      : // Upgrade commands that come with an official script (for example claude update): no script is downloaded, but they likewise do not run inside the app. The design mockup has no such type.
        installing
        ? null
        : CARD_COPY.copyUpgrade;
  return (
    <div className={stack}>
      {installing ? (
        <p className={hint}>
          {runnable ? CARD_COPY.runnableHint : CARD_COPY.copyHint}
        </p>
      ) : null}
      {plan.choices.length > 1 ? (
        <SegmentedControl
          aria-label={installing ? CARD_COPY.installMethod : CARD_COPY.upgradeMethod}
          selectedKey={choice.kind}
          isDisabled={setup.running}
          onSelectionChange={(key) => setup.pick(String(key) as InstallKind)}>
          {plan.choices.map((c) => (
            <SegmentedControlItem key={c.kind} id={c.kind}>
              {c.label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      ) : null}
      <CommandBlock
        value={choice.command}
        copyLabel={copyLabel}
        runner={setup.runnerFor(choice)}
        note={choice.needs ? <p className={hint}>{CARD_COPY.needs(choice.needs)}</p> : null}
      />
      {scriptHint ? <p className={hint}>{scriptHint}</p> : null}
    </div>
  );
}

/** A note at the top of the details (.agp-note). */
function Note({ notice = false, children }: { notice?: boolean; children: ReactNode }) {
  return (
    <div className={noteBox({ isNotice: notice })} role="note">
      <span className={noteIcon({ isNotice: notice })} aria-hidden>
        {notice ? <AlertTriangle styles={iconStyle({ size: 'S' })} /> : <InfoCircle styles={iconStyle({ size: 'S' })} />}
      </span>
      <span>{children}</span>
    </div>
  );
}

/**
 * A user-added agent that has not been detected yet (prototype `AddedInstallPanel`, product design §7.6): CucCut has no install command for it, only knows how to launch it.
 * Agents fetched on demand by npx / uvx need no separate install. The rest are installed following their own instructions (the directory entries give “Open official instructions”), then come back and click detect.
 */
function AddedInstallPanel({
  driver,
  launch,
  launcher,
  disabled,
  busy,
  onDetect,
}: {
  driver: DriverInfo;
  launch: readonly string[];
  launcher: Launcher | null;
  disabled: boolean;
  busy: boolean;
  onDetect: () => void;
}) {
  const runtime = useRuntime();
  const docs = ACP_CATALOG.find((e) => e.id === driver.id)?.docs ?? null;
  const envKeys = driver.custom?.envKeys ?? [];
  const openDocs = () => {
    if (!docs) return;
    const open = runtime.host.openExternal;
    if (open) return void open(docs).catch((error: Error) => ToastQueue.negative(CARD_COPY.openFailed(error.message), { timeout: 5000 }));
    if (!window.open(docs, '_blank', 'noopener,noreferrer')) copyText(docs, CARD_COPY.linkLabel);
  };
  return (
    <>
      <Note>{ADDED_COPY.note(driver.name)}</Note>
      <ol className={steps}>
        <li>
          {launcher ? (
            <>
              <span className={stepTitle}>{ADDED_COPY.noInstall}</span>
              {ADDED_COPY.noInstallBody(launcher.kind, launcher.spec, launcher.needs)}
            </>
          ) : (
            <>
              <span className={stepTitle}>{ADDED_COPY.install}</span>
              {ADDED_COPY.installBody(launch[0] ?? driver.command)}
              {docs ? (
                <div className={docsLink}>
                  <Button variant="secondary" size="S" onPress={openDocs}>
                    <OpenIn />
                    <Text>{ADDED_COPY.docs}</Text>
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </li>
        <li>
          <span className={stepTitle}>{ADDED_COPY.launch}</span>
          <div className={stack}>
            <CommandBlock value={launchLine(launch, envKeys)} copyLabel={ADDED_COPY.launchCopy} />
            {envKeys.length ? <p className={hint}>{ADDED_COPY.envNote(envKeys)}</p> : null}
          </div>
        </li>
        <li>
          <span className={stepTitle}>{ADDED_COPY.login}</span>
          {ADDED_COPY.loginBody}
        </li>
        <li>
          <span className={stepTitle}>{ADDED_COPY.detectStep}</span>
          <div className={stack}>
            <span>{ADDED_COPY.detectBody}</span>
            <div>
              <Button variant="secondary" size="S" isDisabled={disabled} onPress={onDetect}>
                {busy ? ADDED_COPY.detecting : ADDED_COPY.detect}
              </Button>
            </div>
          </div>
        </li>
      </ol>
    </>
  );
}

function InstallPanel({
  driver,
  disabled,
  busy,
  onRecheck,
  setup,
}: {
  driver: DriverInfo;
  disabled: boolean;
  busy: boolean;
  onRecheck: () => void;
  setup: SetupControls;
}) {
  const plan = setup.plan;
  return (
    <>
      <p className={note}>{CARD_COPY.installIntro(driver.name, localizeText(driver.plan, driver.planRef))}</p>
      <ol className={steps}>
        <li>
          {plan.choices.length ? (
            <>
              <span className={stepTitle}>{CARD_COPY.stepInstall}</span>
              <InstallCommands setup={setup} copyLabel={CARD_COPY.installCommand} />
            </>
          ) : (
            <>
              <span className={stepTitle}>{CARD_COPY.stepInstallOfficial}</span>
              {CARD_COPY.installOfficialBody(<span className={codeInline}>{driver.command}</span>)}
            </>
          )}
        </li>
        <li>
          <span className={stepTitle}>{CARD_COPY.stepLogin}</span>
          <div className={stack}>
            <span>{CARD_COPY.stepLoginBody}</span>
            <CommandBlock value={loginCommandOf(driver)} copyLabel={CARD_COPY.loginCommand} />
          </div>
        </li>
        <li>
          <span className={stepTitle}>{CARD_COPY.stepBack}</span>
          <div className={stack}>
            <span>{CARD_COPY.stepBackBody}</span>
            <div>
              <Button variant="secondary" size="S" isDisabled={disabled} onPress={onRecheck}>
                {busy ? CARD_COPY.detecting : CARD_COPY.recheck}
              </Button>
            </div>
          </div>
        </li>
      </ol>
      <Disclosure size="S" isQuiet defaultExpanded={!!driver.executableOverride}>
        <DisclosureTitle>{CARD_COPY.notDetected}</DisclosureTitle>
        <DisclosurePanel>
          <div className={stack}>
            <p className={hint}>{CARD_COPY.notDetectedBody}</p>
            <ExecutableField driver={driver} isDisabled={disabled} />
          </div>
        </DisclosurePanel>
      </Disclosure>
    </>
  );
}

const STEP_ICON: Record<'ok' | 'fail' | 'skip', ReactNode> = {
  ok: <CheckmarkCircle />,
  fail: <AlertTriangle />,
  skip: <Clock />,
};

/** Troubleshooting checklist: five steps in dependency order. If a step fails, the later steps are marked “Check after the previous step passes”, with a one-sentence conclusion. */
function Diagnosis({ driver }: { driver: DriverInfo }) {
  const list = diagnose(driver);
  const result = diagnosisVerdict(list);
  return (
    <div className={diag}>
      <ol className={checks} aria-label={CARD_COPY.diagnosisOf(driver.name)}>
        {list.map((s) => (
          <li key={s.key} className={check}>
            <span className={checkIcon({ isOk: s.state === 'ok', isFail: s.state === 'fail' })}>{STEP_ICON[s.state]}</span>
            <div>
              <div className={checkLabel}>{s.label}</div>
              <p className={checkDetail}>{s.detail}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className={verdict({ isOk: result.ok })} role="status">
        {result.text}
      </p>
    </div>
  );
}
