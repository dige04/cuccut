import { useEffect, useState } from 'react';
import { ActionButton, Badge, Switch, ToastQueue } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import type { CodexDefaultState } from '../../model/models-cloud.ts';
import { probeModelCapabilities, setAgentProviderEnabled } from '../../runtime/agent-commands.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useConnection } from '../../state/connection-store.ts';
import { useModels } from '../../state/models-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { CODEX_IMAGE_COPY } from '../settings/agent-copy.ts';
import {
  CODEX_IMAGE_PROVIDER,
  codexImageProvider,
  codexImageRow,
  codexImageToast,
  type CodexImageProbe,
  type CodexImageRowState,
} from '../settings/codex-image.ts';
import { CODEX_CARD_COPY, CLOUD_COPY, MODELS_PAGE_COPY } from './models-copy.ts';
import { PANEL } from '../settings/settings-ui.tsx';

/**
 * Two places on the models page use “Draw with Codex”: the first card in the cloud provider list of the image generation page (design mock settings-cloud.jsx:278-298), and “Codex CLI · Draw” in the default model menu. The toggle, whether it can be opened, and the reason why all reuse the pure functions and commands of the 设置 › Agent (Settings › Agent) row (A2-e), rather than a separate copy. The page also probes once on entry (probes again after Codex is re-detected, upgraded or logged in).
 */
export function useCodexImage(active: boolean): { connected: boolean; state: CodexImageRowState | null; registered: boolean } {
  const runtime = useRuntime();
  const connected = useConnection((s) => s.state.status === 'connected');
  const driver = useConnection((s) => s.drivers?.find((d) => d.id === 'codex') ?? null);
  const provider = useModels((s) => codexImageProvider(s.capabilities));
  const [probe, setProbe] = useState<CodexImageProbe>('pending');
  const installed = !!driver && driver.state !== 'not-installed';
  const probeKey = driver ? `${driver.state}|${driver.version ?? ''}|${driver.checkedAt ?? ''}` : '';

  useEffect(() => {
    if (!active || !connected || !installed) return;
    let live = true;
    probeModelCapabilities(runtime).then(
      () => live && setProbe('done'),
      () => live && setProbe((old) => (old === 'done' ? old : 'failed')),
    );
    return () => {
      live = false;
    };
  }, [runtime, active, connected, installed, probeKey]);

  return { connected, state: driver ? codexImageRow(provider, driver, probe) : null, registered: !!provider };
}

/** Status of the Codex item in the default model menu; when the Runtime has not registered `agent:codex`, the item does not appear in the menu. */
export function codexDefaultState(codex: ReturnType<typeof useCodexImage>): CodexDefaultState | null {
  if (!codex.registered) return null;
  const { state } = codex;
  if (!state) return { ready: false, why: CODEX_CARD_COPY.missing };
  if (state.ready) return { ready: true, why: null };
  return { ready: false, why: state.why ?? (state.checking ? CODEX_IMAGE_COPY.checking : CODEX_CARD_COPY.off) };
}

const card = style({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 12,
  paddingX: 20,
  paddingY: 12,
  marginBottom: 8,
});
const text = style({ flexGrow: 1, flexBasis: 0, minWidth: 220, paddingStart: 24 });
const title = style({ font: 'ui', fontWeight: 'bold', color: 'gray-900' });
const body = style({ marginTop: 2, marginBottom: 0, font: 'ui-xs', color: 'gray-600' });
const controls = style({ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 });

/**
 * The first card in the cloud provider list of the image generation page: when it can be turned on, it shows a toggle; when it cannot (not installed, not logged in, too old), it shows “Go to Settings › Agent”. Turning the toggle off does not clear the default value.
 * In the browser the toggle is greyed out (`models.configure` is not on the Web allowlist); the note in the page header already gives the reason.
 */
export function CodexImageCard({ codex, isDefault }: { codex: ReturnType<typeof useCodexImage>; isDefault: boolean }) {
  const runtime = useRuntime();
  const web = runtime.host.platform === 'web';
  const go = useShell((s) => s.go);
  const [busy, setBusy] = useState(false);
  const { state, connected } = codex;
  if (!codex.registered) return null;

  const canSwitch = !!state && (state.enabled || state.canEnable || state.checking);
  const desc = !state
    ? CODEX_CARD_COPY.missing
    : state.ready
      ? CODEX_CARD_COPY.on
      : state.checking
        ? CODEX_IMAGE_COPY.checking
        : (state.why ?? CODEX_CARD_COPY.off);

  const toggle = async (enabled: boolean) => {
    setBusy(true);
    try {
      await setAgentProviderEnabled(runtime, CODEX_IMAGE_PROVIDER, enabled);
      ToastQueue.neutral(codexImageToast(enabled), { timeout: 3000 });
    } catch (error) {
      ToastQueue.negative(CODEX_CARD_COPY.toggleFailed(enabled, (error as Error).message), { timeout: 5000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`${card} ${PANEL}`} aria-label={CODEX_CARD_COPY.title}>
      <div className={text}>
        <div className={title}>{CODEX_CARD_COPY.title}</div>
        <p className={body}>{desc}</p>
      </div>
      <div className={controls}>
        {isDefault ? (
          <Badge variant="accent" size="S" fillStyle="subtle">
            {CLOUD_COPY.defaultChip}
          </Badge>
        ) : null}
        {canSwitch && state ? (
          <Switch
            aria-label={CODEX_CARD_COPY.switchLabel}
            size="S"
            isSelected={state.enabled}
            isDisabled={web || !connected || busy || state.checking || (!state.enabled && !state.canEnable)}
            onChange={(enabled) => void toggle(enabled)}
          />
        ) : (
          <ActionButton isQuiet size="S" onPress={() => go({ tab: 'settings', section: 'agent' })}>
            {MODELS_PAGE_COPY.goAgent}
          </ActionButton>
        )}
      </div>
    </section>
  );
}
