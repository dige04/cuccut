import type {
  DeclaredModel,
  GeneratedOutput,
  ModelBundleStatus,
  ModelCapabilitiesView,
  ModelInfoBase,
  ModelServiceCapability,
  SpeechModelInfo,
} from '@cuccut/protocol';
import {
  addModelRequest,
  connectRequest,
  customProviderRequest,
  disconnectRequest,
  isCustomProvider,
  parseDefaultKey,
  type CustomProviderDraft,
} from '../../model/models-cloud.ts';
import { canReenable, localDefaultChoice, VIEW_CAPABILITY, type LocalDefaultCapability } from '../../model/models-local.ts';
import { imageProbeRequest, speechProbeRequest, textProbeRequest } from '../../model/models-probe.ts';
import { concurrencyRequest, effortRequest } from '../../model/models-text.ts';
import type { RuntimeSession } from '../../runtime/session.ts';
import { PROBE_COPY } from './models-copy.ts';

/**
 * Commands for the model page: each button's intent becomes one call on `RuntimeSession`. The new capability views are sent back by the `models` topic; this code does not change local state.
 * Failures are thrown as-is to the caller (the dialog stays open and writes the reason in it).
 */

type Session = Pick<
  RuntimeSession,
  | 'setModelDefault'
  | 'configureModelProvider'
  | 'removeModelProvider'
  | 'refreshModelProvider'
  | 'enableModelBundle'
  | 'synthesizeSpeech'
  | 'generateImage'
  | 'generateText'
  | 'setCapabilityParameters'
  | 'openArtifact'
>;

/** The default model menu on the cloud page selected an item. */
export async function chooseCloudDefault(session: Session, capability: ModelServiceCapability, key: string): Promise<void> {
  const ref = parseDefaultKey(key);
  await session.setModelDefault(capability, ref?.providerId ?? null, ref?.modelId);
}

/** The “Reasoning effort” segment for text generation selected an item (“Auto” = clear it and leave it to the model's own default). The new value is sent back through the `models` topic. */
export async function setTextEffort(session: Session, key: string): Promise<void> {
  await session.setCapabilityParameters(effortRequest(key));
}

/** The text generation “Concurrent requests” changed; not submitted when the value is not a number. */
export async function setTextConcurrency(session: Session, value: number): Promise<boolean> {
  const request = concurrencyRequest(value);
  if (!request) return false;
  await session.setCapabilityParameters(request);
  return true;
}

/** The default model menu on the local page selected an item. If the selected model package was disabled or failed to load before, it is re-enabled first (`models.enable` re-validates it, so it is only called at this point). */
export async function chooseLocalDefault(
  session: Session,
  key: string,
  bundles: readonly ModelBundleStatus[],
  kind: LocalDefaultCapability = 'transcribe',
): Promise<void> {
  const choice = localDefaultChoice(key);
  const target = bundles.find((b) => b.bundleId === choice.modelId);
  if (target && canReenable(target)) await session.enableModelBundle(target.bundleId);
  await session.setModelDefault(VIEW_CAPABILITY[kind], choice.providerId, choice.modelId);
}

/** The key dialog's “Save”: enable and verify; if verification fails, the Runtime rejects it and nothing is saved. */
export async function saveProviderKey(session: Session, providerId: string, key: string): Promise<void> {
  await session.configureModelProvider(connectRequest(providerId, key));
}

/** The card header's “Refresh”: fetches the model and voice lists from the provider. If they cannot be fetched (`ok: false`), it is not counted as a failure; the reason is recorded in its config and sent back by the `models` topic. */
export async function refreshProvider(session: Session, providerId: string): Promise<void> {
  await session.refreshModelProvider(providerId);
}

/** Built-in “Remove key” = clear and disable; custom “Delete provider” = delete together with its declared models. */
export async function disconnectProvider(session: Session, providerId: string): Promise<void> {
  if (isCustomProvider(providerId)) await session.removeModelProvider(providerId);
  else await session.configureModelProvider(disconnectRequest(providerId));
}

/** Adds a custom provider and returns its ID (then opens its key dialog). */
export async function addCustomProvider(session: Session, view: ModelCapabilitiesView, draft: CustomProviderDraft): Promise<string> {
  const request = customProviderRequest(view, draft);
  await session.configureModelProvider(request);
  return request.providerId;
}

/** Adds a model under a custom provider. */
export async function addProviderModel(
  session: Session,
  view: ModelCapabilitiesView,
  providerId: string,
  model: DeclaredModel,
): Promise<void> {
  await session.configureModelProvider(addModelRequest(view, providerId, model));
}

/** Starts a test (synthesizes one sentence, generates one image, or has a text model reply with one sentence) and returns the task ID. */
export async function startProbe(
  session: Session,
  capability: ModelServiceCapability,
  providerId: string,
  model: ModelInfoBase,
  voice = '',
): Promise<string> {
  if (capability === 'synthesizeSpeech') return session.synthesizeSpeech(speechProbeRequest(providerId, model as SpeechModelInfo, voice));
  if (capability === 'generateImage') return session.generateImage(imageProbeRequest(providerId, model));
  if (capability === 'generateText') return session.generateText(textProbeRequest(providerId, model));
  throw new Error(PROBE_COPY.asrUnsupported);
}

/** Restricted URL for test results (for `<audio>` / `<img>`). */
export async function probeMediaUrl(session: Session, output: GeneratedOutput): Promise<string> {
  const handle = await session.openArtifact(output.artifactId);
  return handle.url;
}
