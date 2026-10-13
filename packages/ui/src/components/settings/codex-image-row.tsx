import { useEffect, useState } from 'react';
import type { DriverInfo } from '@cuccut/protocol';
import { Badge, Switch, ToastQueue } from '@react-spectrum/s2';
import ImageIcon from '@react-spectrum/s2/icons/Image';
import { iconStyle, style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { probeModelCapabilities, setAgentProviderEnabled } from '../../runtime/agent-commands.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useModels } from '../../state/models-store.ts';
import { CODEX_IMAGE_COPY } from './agent-copy.ts';
import { CODEX_IMAGE_PROVIDER, codexImageProvider, codexImageRow, codexImageToast, type CodexImageProbe } from './codex-image.ts';

const row = style({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  paddingX: 20,
  paddingY: 12,
  borderTopWidth: 1,
  borderXWidth: 0,
  borderBottomWidth: 0,
  borderStyle: 'solid',
  borderColor: 'gray-200',
});
const iconBox = style({
  display: 'flex',
  flexShrink: 0,
  color: { default: 'gray-600', isOn: 'blue-900' },
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});
const icon = iconStyle({ size: 'S' });
const text = style({ flexGrow: 1, minWidth: 0 });
const titleRow = style({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 });
const title = style({ font: 'ui-sm', fontWeight: 'bold', color: 'gray-900' });
const body = style({ marginTop: 2, marginBottom: 0, font: 'ui-sm', color: 'gray-700' });

/**
 * “Image generation with Codex” (設計稿 design mockup settings-agent-provider.jsx:103-119): placed under the Codex card header, shown only when Codex has been found.
 * The toggle is the image-generation agent provider `agent:codex` (`models.configure`). Whether it can be turned on is decided by the model service’s view.
 * It is probed once when this row appears (and probed again after Codex is re-detected, upgraded or logged in). Until it has been probed, the toggle cannot be switched.
 * Once turned on, it is not selected automatically (image generation has no factory default). To make it the default, set it under Models › 图像生成 (Image generation). In the browser the toggle is greyed out (`models.configure` is not on the web allowlist).
 */
export function CodexImageRow({ driver, connected }: { driver: DriverInfo; connected: boolean }) {
  const runtime = useRuntime();
  const web = runtime.host.platform === 'web';
  const provider = useModels((s) => codexImageProvider(s.capabilities));
  const [probe, setProbe] = useState<CodexImageProbe>('pending');
  const [busy, setBusy] = useState(false);
  const installed = driver.state !== 'not-installed';
  const probeKey = `${driver.state}|${driver.version ?? ''}|${driver.checkedAt ?? ''}`;

  useEffect(() => {
    if (!connected || !installed) return;
    let live = true;
    probeModelCapabilities(runtime).then(
      () => live && setProbe('done'),
      () => live && setProbe((old) => (old === 'done' ? old : 'failed')),
    );
    return () => {
      live = false;
    };
  }, [runtime, connected, installed, probeKey]);

  const state = codexImageRow(provider, driver, probe);
  if (!state) return null;

  const toggle = async (enabled: boolean) => {
    setBusy(true);
    try {
      await setAgentProviderEnabled(runtime, CODEX_IMAGE_PROVIDER, enabled);
      ToastQueue.neutral(codexImageToast(enabled), { timeout: 3000 });
    } catch (error) {
      ToastQueue.negative(CODEX_IMAGE_COPY.toggleFailed(enabled, (error as Error).message), { timeout: 5000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={row}>
      <span className={iconBox({ isOn: state.ready })} aria-hidden>
        <ImageIcon styles={icon} />
      </span>
      <div className={text}>
        <div className={titleRow}>
          <span className={title}>{CODEX_IMAGE_COPY.title}</span>
          {state.ready ? (
            <Badge variant="positive" size="S" fillStyle="subtle">
              {CODEX_IMAGE_COPY.on}
            </Badge>
          ) : null}
        </div>
        <p className={body}>{state.checking ? CODEX_IMAGE_COPY.checking : (state.why ?? CODEX_IMAGE_COPY.body)}</p>
      </div>
      <Switch
        aria-label={CODEX_IMAGE_COPY.title}
        size="S"
        isSelected={state.enabled}
        isDisabled={web || !connected || busy || (!state.enabled && !state.canEnable)}
        onChange={(enabled) => void toggle(enabled)}
      />
    </div>
  );
}
