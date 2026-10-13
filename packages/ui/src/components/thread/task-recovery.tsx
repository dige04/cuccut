import { useEffect, useRef, useState } from 'react';
import { messageSkills, type DriverId, type Id, type TimelineItem } from '@cuccut/protocol';
import { ActionButton, Button, Menu, MenuItem, MenuTrigger, Text, ToastQueue } from '@react-spectrum/s2';
import Refresh from '@react-spectrum/s2/icons/Refresh';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { RECOVERY_COPY } from '../../copy.ts';
import { modelChange, modelRows } from '../../model/agent-choice.ts';
import { detectAgents, openAgentTerminal } from '../../runtime/agent-commands.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useConnection } from '../../state/connection-store.ts';
import { useConversationMeta } from '../../state/directory-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { useTimelineItems } from '../../state/timeline-store.ts';

type Task = Extract<TimelineItem, { kind: 'task' }>;

const box = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 16,
  borderRadius: '[20px]',
  backgroundColor: 'gray-50',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  font: 'ui-sm',
  color: 'gray-800',
});
const title = style({ font: 'title-sm', margin: 0 });
const body = style({ margin: 0, color: 'gray-700' });
const acts = style({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 });
const retryRow = style({ display: 'flex' });
const menu = style({ width: 320, maxWidth: '[calc(100vw - 32px)]' });

/**
 * Recovery area after a task fails (prototype agent-thread.jsx `ErrorMsg`): offers a way forward based on the error code from the Runtime.
 * Login required: open the system terminal and run the detected login command (via the Runtime's `agents.openTerminal`; CucCut never handles account passwords). If the terminal cannot be opened, fall back to copying the command; when the window regains focus, detection runs again. Model unavailable: switch to another model and resend this turn as it was. Otherwise: retry, resending that turn's message as it was (without the editor state at the time, which is now out of date).
 */
export function TaskRecovery({ item, conversationId }: { item: Task; conversationId: Id }) {
  const runtime = useRuntime();
  const meta = useConversationMeta(conversationId);
  const driver = useConnection((s) => s.drivers?.find((d) => d.id === meta?.driverId) ?? null);
  const items = useTimelineItems(conversationId);
  const go = useShell((s) => s.go);
  const [pending, setPending] = useState(false);
  const stopWatchingReturn = useRef<(() => void) | null>(null);
  useEffect(() => () => stopWatchingReturn.current?.(), []);
  const taskId = item.taskId ?? item.id;
  const message = items.find((i): i is Extract<TimelineItem, { kind: 'user-message' }> => i.kind === 'user-message' && i.taskId === taskId);
  const name = driver?.name ?? 'Agent';

  const resend = async (before?: () => Promise<void>) => {
    if (!message) {
      ToastQueue.negative(RECOVERY_COPY.nothingToResend, { timeout: 5000 });
      return;
    }
    setPending(true);
    try {
      await before?.();
      // The skills selected in that turn are also resent together in their original order (carrying only the id; the Runtime reads its current SKILL.md); slide, design-draft and design-system annotations are resent as they were.
      await runtime.send(
        conversationId,
        message.text,
        undefined,
        message.attachments?.map((a) => a.id),
        undefined,
        messageSkills(message).map((s) => ({ id: s.id })),
        message.slideAnnotations,
        message.designAnnotations,
        message.designSystemAnnotations,
      );
    } catch (error) {
      ToastQueue.negative(RECOVERY_COPY.resendFailed((error as Error).message), { timeout: 5000 });
    } finally {
      setPending(false);
    }
  };
  // When you finish logging in in the terminal and return to this window, detection runs again, so the agent's login status is updated accordingly.
  const recheckOnReturn = (driverId: DriverId) => {
    stopWatchingReturn.current?.();
    const onFocus = () => {
      stopWatchingReturn.current?.();
      void detectAgents(runtime, driverId).catch(() => {});
    };
    window.addEventListener('focus', onFocus);
    stopWatchingReturn.current = () => {
      window.removeEventListener('focus', onFocus);
      stopWatchingReturn.current = null;
    };
  };
  const copyLogin = async (command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      ToastQueue.neutral(RECOVERY_COPY.loginCopied, { timeout: 5000 });
    } catch {
      ToastQueue.neutral(RECOVERY_COPY.loginManual(command), { timeout: 8000 });
    }
  };
  const openLogin = async () => {
    if (!driver) return;
    // When the detection result has no login command, the Runtime does not accept it; fall back to copying the command that launches the CLI directly (same as Settings › Agent).
    if (!driver.loginCommand) return void copyLogin(driver.command);
    try {
      const result = await openAgentTerminal(runtime, driver.id, 'login');
      if (result.status === 'opened') {
        ToastQueue.neutral(RECOVERY_COPY.loginOpened(result.command), { timeout: 5000 });
        recheckOnReturn(driver.id);
        return;
      }
      await copyLogin(result.command);
    } catch {
      await copyLogin(driver.loginCommand);
    }
  };
  const settings = (
    <ActionButton size="S" isQuiet onPress={() => go({ tab: 'settings', section: 'agent' })}>
      <Text>{RECOVERY_COPY.agentSettings}</Text>
    </ActionButton>
  );

  // The recovery actions stay neutral: the composer's Send below is the thread's one yellow.
  if (item.errorCode === 'AGENT_AUTH_REQUIRED') {
    return (
      <div className={box} role="group" aria-label={RECOVERY_COPY.authTitle(name)}>
        <h3 className={title}>{RECOVERY_COPY.authTitle(name)}</h3>
        <p className={body}>{RECOVERY_COPY.authBody(name)}</p>
        <div className={acts}>
          {driver ? (
            <Button variant="secondary" size="S" onPress={() => void openLogin()}>
              {RECOVERY_COPY.openLogin}
            </Button>
          ) : null}
          <Button variant="secondary" size="S" isPending={pending} onPress={() => void resend()}>
            {RECOVERY_COPY.resend}
          </Button>
          {settings}
        </div>
      </div>
    );
  }

  if (item.errorCode === 'AGENT_MODEL_UNAVAILABLE' && driver) {
    const rows = modelRows(driver, meta?.model ?? null).filter((row) => row.model !== (meta?.model ?? null));
    return (
      <div className={box} role="group" aria-label={RECOVERY_COPY.modelTitle(meta?.model ?? null)}>
        <h3 className={title}>{RECOVERY_COPY.modelTitle(meta?.model ?? null)}</h3>
        <p className={body}>{RECOVERY_COPY.modelBody}</p>
        <div className={acts}>
          <MenuTrigger>
            <Button variant="secondary" size="S" isPending={pending}>
              {RECOVERY_COPY.pickModel}
            </Button>
            <Menu
              aria-label={RECOVERY_COPY.pickModel}
              size="M"
              styles={menu}
              onAction={(key) => {
                const model = String(key).slice('model:'.length) || null;
                const change = modelChange(driver, model, meta?.effort ?? null);
                void resend(() => runtime.updateConversation(conversationId, { model: change.model, effort: change.effort }));
              }}>
              {rows.map((row) => (
                <MenuItem key={row.model ?? ''} id={`model:${row.model ?? ''}`} textValue={row.label}>
                  <Text slot="label">{row.label}</Text>
                  {row.sub ? <Text slot="description">{row.sub}</Text> : null}
                </MenuItem>
              ))}
            </Menu>
          </MenuTrigger>
          {settings}
        </div>
      </div>
    );
  }

  return (
    <div className={retryRow}>
      <Button variant="secondary" size="S" isPending={pending} onPress={() => void resend()}>
        <Refresh />
        <Text>{RECOVERY_COPY.retry}</Text>
      </Button>
    </div>
  );
}
