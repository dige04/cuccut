import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { AgentSetupAction, AgentSetupRun, DriverInfo } from '@cuccut/protocol';
import { ActionButton, AlertDialog, Button, ProgressCircle, TextField, ToastQueue } from '@react-spectrum/s2';
import AlertTriangle from '@react-spectrum/s2/icons/AlertTriangle';
import CheckmarkCircle from '@react-spectrum/s2/icons/CheckmarkCircle';
import Copy from '@react-spectrum/s2/icons/Copy';
import Play from '@react-spectrum/s2/icons/Play';
import StopProcessing from '@react-spectrum/s2/icons/StopProcessing';
import { iconStyle, style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { configureAgent } from '../../runtime/agent-commands.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { AGENT_COPY } from './agent-copy.ts';
import { setupLog } from './agent-setup.ts';

const C = () => AGENT_COPY.command;

/** Copies to the clipboard. If clipboard permission is unavailable, asks the user to select and copy manually (both commands and paths are selectable). */
export async function copyText(value: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    ToastQueue.positive(C().copied(label), { timeout: 3000 });
  } catch {
    ToastQueue.neutral(C().copyFailed, { timeout: 5000 });
  }
}

const block = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
  paddingStart: { default: 12, isRunnable: 4 },
  paddingEnd: 4,
  paddingY: 4,
  borderRadius: 'lg',
  backgroundColor: 'gray-100',
});
const code = style({ flexGrow: 1, minWidth: 0, font: 'code-sm', color: 'gray-900', overflowWrap: 'anywhere', userSelect: 'text' });
// Log box (settings-agent.css:43-46, agset-run): monospace, selectable, fixed height with scrolling.
const log = style({
  boxSizing: 'border-box',
  margin: 0,
  height: 144,
  overflow: 'auto',
  paddingX: 12,
  paddingY: 8,
  borderRadius: 'lg',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  backgroundColor: 'gray-75',
  font: 'code-xs',
  color: 'gray-900',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  userSelect: 'text',
});
const runStatus = style({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, font: 'ui-sm', color: 'gray-800' });
const okIcon = iconStyle({ size: 'S', color: 'positive' });
const failIcon = iconStyle({ size: 'S', color: 'negative' });
const stopIcon = iconStyle({ size: 'S', color: 'neutral' });
const runText = style({ flexGrow: 1, flexBasis: 0, minWidth: 200 });

/**
 * The ▶ to the left of a command (design mock settings-agent-provider.jsx:24-76, useCmdRun / CmdRun). Run state lives in the Runtime (`agent-setup` topic). The card passes in this command's most recent run;
 * the confirmation before starting, stop, and running in a terminal are all handled by the card.
 */
export interface CommandRunner {
  /** The most recent run of this command (null if there is none, or it is no longer shown). */
  run: AgentSetupRun | null;
  /** Another command of the same Agent is running, or not yet connected to the Runtime: ▶ is not clickable. */
  isDisabled: boolean;
  /** Clicking ▶: the card first shows a confirmation (with the full command); it runs only after confirming. */
  onRun: () => void;
  onStop: () => void;
  /** After a failure, “Run in terminal”: hands off to the system terminal (anything that needs a password cannot run here). */
  onTerminal: () => void;
}

/**
 * One command or path: shown as-is, with a copy button on the right.
 *
 * When a `runner` is given (only for install and upgrade commands such as brew or npm), a ▶ appears on the left. After user confirmation, the Runtime runs it inside the app. Output is shown as-is in the log box under the command (and also recorded in the Runtime log). While running, ▶ becomes ■ and can be stopped. On failure, “Run in terminal” is offered.
 * Official scripts such as `curl … | bash`, and login commands, get no ▶; they are only copied or handed to the system terminal (architecture design §12.9).
 * `note` sits between the command and the log box (for prerequisites and the like; order as in the design mock's CmdRun).
 */
export function CommandBlock({ value, copyLabel, runner, note }: { value: string; copyLabel: string; runner?: CommandRunner; note?: ReactNode }) {
  const running = runner?.run?.state === 'running';
  return (
    <>
      <div className={block({ isRunnable: !!runner })}>
        {runner ? (
          <ActionButton
            isQuiet
            size="S"
            aria-label={running ? C().stop : C().run}
            isDisabled={!running && runner.isDisabled}
            onPress={running ? runner.onStop : runner.onRun}>
            {running ? <StopProcessing /> : <Play />}
          </ActionButton>
        ) : null}
        <code className={code}>{value}</code>
        <ActionButton isQuiet size="S" aria-label={C().copy(copyLabel)} onPress={() => void copyText(value, copyLabel)}>
          <Copy />
        </ActionButton>
      </div>
      {note}
      {runner?.run ? <RunOutput run={runner.run} onTerminal={runner.onTerminal} /> : null}
    </>
  );
}

/** The log box and a result line. New output scrolls to the bottom; it does not fight the scrollbar when the user is scrolling up to read. */
function RunOutput({ run, onTerminal }: { run: AgentSetupRun; onTerminal: () => void }) {
  const ref = useRef<HTMLPreElement>(null);
  const stick = useRef(true);
  const text = setupLog(run);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [text]);
  return (
    <>
      <pre
        ref={ref}
        className={log}
        role="log"
        aria-live="polite"
        aria-label={C().output}
        tabIndex={0}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
        }}>
        {text}
      </pre>
      <div className={runStatus} role="status">
        {run.state === 'running' ? (
          <>
            <ProgressCircle size="S" isIndeterminate aria-label={C().running} />
            <span>{C().runningText}</span>
          </>
        ) : run.state === 'completed' ? (
          <>
            <CheckmarkCircle styles={okIcon} />
            <span>{C().done}</span>
          </>
        ) : run.state === 'cancelled' ? (
          <>
            <StopProcessing styles={stopIcon} />
            <span>{C().stopped}</span>
          </>
        ) : (
          <>
            <AlertTriangle styles={failIcon} />
            <span className={runText}>{C().failed(failureReason(run))}</span>
            <Button variant="secondary" size="S" onPress={onTerminal}>
              {C().runInTerminal}
            </Button>
          </>
        )}
      </div>
    </>
  );
}

/** What goes in the parentheses of the failure sentence: if there is an exit code, write the exit code (as in the original design mock). The design mock has nothing for a command that could not start or was ended by a signal, so state the facts. */
function failureReason(run: Pick<AgentSetupRun, 'exitCode' | 'error'>): string {
  if (run.exitCode !== null) return C().exitCode(run.exitCode);
  if (run.error) return C().startFailed(run.error);
  return C().killed;
}

const dialogCode = style({ display: 'block', marginY: 12, padding: 12, borderRadius: 'lg', backgroundColor: 'gray-100', font: 'code-sm', color: 'gray-900', overflowWrap: 'anywhere', userSelect: 'text' });

/**
 * Confirmation before running (architecture design §12.9: the user confirms each time, and the full command is shown when confirming). The design mock starts immediately on ▶ with no such step. The button uses the verb “Run”.
 * Placed in the caller's `DialogContainer`.
 */
export function RunCommandDialog({ action, name, command, onRun }: { action: AgentSetupAction; name: string; command: string; onRun: () => void }) {
  return (
    <AlertDialog variant="confirmation" title={action === 'install' ? C().confirmInstall(name) : C().confirmUpgrade(name)}
      primaryActionLabel={C().confirmRun}
      cancelLabel={C().cancel}
      onPrimaryAction={onRun}>
      {C().confirmBefore}
      <code className={dialogCode}>{command}</code>
      {C().confirmAfter}
    </AlertDialog>
  );
}

const field = style({ display: 'flex', alignItems: 'end', flexWrap: 'wrap', gap: 8 });
const input = style({ flexGrow: 1, minWidth: 220 });

/**
 * Manually specify the executable: enter the full path and save. Clearing and saving, or clicking “Restore automatic lookup”, returns to automatic lookup.
 * After saving, the Runtime re-detects at the new location and returns the new result, so there is no need to click re-check.
 */
export function ExecutableField({ driver, label, isDisabled }: { driver: DriverInfo; label?: string; isDisabled?: boolean }) {
  const runtime = useRuntime();
  const saved = driver.executableOverride ?? '';
  const [value, setValue] = useState(saved);
  const [busy, setBusy] = useState(false);
  useEffect(() => setValue(saved), [saved]);
  const next = value.trim();
  const save = async (executable: string | null) => {
    setBusy(true);
    try {
      const view = await configureAgent(runtime, driver.id, { executable });
      const now = view.drivers.find((d) => d.id === driver.id);
      if (!executable) ToastQueue.neutral(C().restored(driver.name), { timeout: 3000 });
      else if (now && now.state !== 'not-installed') ToastQueue.positive(C().switched(executable), { timeout: 3000 });
      else ToastQueue.negative(C().notFoundAt(executable, driver.command), { timeout: 5000 });
    } catch (error) {
      ToastQueue.negative(C().saveFailed((error as Error).message), { timeout: 5000 });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={field}>
      <TextField
        label={label ?? C().locationLabel(driver.name)}
        size="S"
        value={value}
        onChange={setValue}
        placeholder={driver.executable ?? C().locationPlaceholder(driver.command)}
        description={saved ? C().locationSaved : C().locationAuto}
        isDisabled={isDisabled || busy}
        styles={input}
      />
      <Button variant="secondary" size="S" isDisabled={isDisabled || busy || next === saved} onPress={() => void save(next || null)}>
        {C().save}
      </Button>
      {saved ? (
        <Button variant="secondary" size="S" isDisabled={isDisabled || busy} onPress={() => void save(null)}>
          {C().restoreAuto}
        </Button>
      ) : null}
    </div>
  );
}
