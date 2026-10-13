import { AGENT_PROVIDER_PREFIX, localizeText, type DriverInfo, type ModelCapabilitiesView, type ProviderCapabilityView } from '@cuccut/protocol';
import { CODEX_IMAGE_COPY } from './agent-copy.ts';

/**
 * “Image generation with Codex” (CodexImageRow in the design mockup settings-agent-provider.jsx): one toggle row under the Codex card header.
 * The backend is the image-generation agent provider `agent:codex` (architecture design §6.9). The toggle goes through `models.configure`, and the state is read from the capability view of the `models` topic.
 * This only folds the view into what this row needs to show. The minimum version is not hard-coded in the UI; when the version is too old, the reason is taken from the provider’s own `detail`.
 */

export const CODEX_IMAGE_PROVIDER = `${AGENT_PROVIDER_PREFIX}codex`;

/** The image-generation `agent:codex` in the capability view; null when the Runtime has not registered it (this row is then not shown). */
export function codexImageProvider(view: ModelCapabilitiesView | null): ProviderCapabilityView | null {
  return view?.generateImage.providers.find((p) => p.providerId === CODEX_IMAGE_PROVIDER) ?? null;
}

/**
 * Whether this page has actively probed once (`models.capabilities`). When it is not enabled and has not been probed, the provider only reports “not enabled”,
 * which would hide “not logged in” and “version too old”. So until it has been probed, it does not claim the toggle can be opened.
 */
export type CodexImageProbe = 'pending' | 'done' | 'failed';

export interface CodexImageRowState {
  /** The toggle in the config (the user turned it on and has not turned it off). */
  enabled: boolean;
  /** On, and able to generate right now: shows “On” (已打开). */
  ready: boolean;
  /** Can be used once turned on: the toggle can be switched. Something already on can always be turned off; this item is not checked for that. */
  canEnable: boolean;
  /** Still waiting for the first probe: the toggle cannot be switched yet. */
  checking: boolean;
  /** One-sentence reason when it cannot be turned on (or is on but cannot generate); null when usable. */
  why: string | null;
}

/** This row appears only when Codex has been found and the Runtime also includes this provider; otherwise null. */
export function codexImageRow(
  provider: ProviderCapabilityView | null,
  driver: Pick<DriverInfo, 'id' | 'state'>,
  probe: CodexImageProbe,
): CodexImageRowState | null {
  if (driver.id !== 'codex' || driver.state === 'not-installed' || !provider) return null;
  const enabled = provider.config?.enabled ?? false;
  if (provider.available) return { enabled, ready: enabled, canEnable: true, checking: false, why: null };
  const reason = provider.unavailableReason ?? 'unsupported';
  // While it is on, the Runtime asks the Driver every time, so the reason is accurate. While it is off, the reason is accurate only after a probe.
  const known = enabled || probe === 'done';
  if (reason === 'not-configured') {
    if (known) return { enabled, ready: false, canEnable: true, checking: false, why: null };
    if (probe === 'pending') return { enabled, ready: false, canEnable: false, checking: true, why: null };
    return { enabled, ready: false, canEnable: false, checking: false, why: CODEX_IMAGE_COPY.probeFailed };
  }
  return { enabled, ready: false, canEnable: false, checking: false, why: codexImageWhy(reason, localizeText(provider.detail, provider.detailRef) ?? undefined) };
}

function sentence(text: string): string {
  const trimmed = text.trim();
  return /[。！？.!?]$/.test(trimmed) ? trimmed : `${trimmed}${CODEX_IMAGE_COPY.period}`;
}

/** The reason it cannot generate. The design mockup pattern is “原因 · 画图至少要 Codex X 并登录” (reason · image generation needs at least Codex X and a login). The minimum version appears only in the provider’s detail, and when the version is not enough, the whole sentence comes from it. */
function codexImageWhy(reason: NonNullable<ProviderCapabilityView['unavailableReason']>, detail: string | undefined): string {
  switch (reason) {
    case 'outdated':
      return sentence(detail ?? CODEX_IMAGE_COPY.outdated);
    case 'signed-out':
      return CODEX_IMAGE_COPY.signedOut;
    case 'not-installed':
      return CODEX_IMAGE_COPY.notInstalled;
    default:
      return CODEX_IMAGE_COPY.unavailable(detail ? sentence(detail) : null);
  }
}

/** The one-line message after the toggle is switched (the design mockup’s toast; the name shown in the model menu is the provider’s own “Codex”). */
export function codexImageToast(enabled: boolean): string {
  return enabled ? CODEX_IMAGE_COPY.turnedOn : CODEX_IMAGE_COPY.turnedOff;
}
