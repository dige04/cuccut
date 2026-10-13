import {
  live,
  localizeText,
  refOf,
  RpcError,
  type CapabilityNotConfiguredDetails,
  type Localized,
  type CapabilityNotConfiguredReason,
  type ModelInfoBase,
  type ModelInfoByCapability,
  type ModelRef,
  type ModelServiceCapability,
  type ProviderCapability,
  type ProviderKind,
  type ProviderUnavailableReason,
  type ProviderView,
  type TranscribeModelInfo,
} from '@cuccut/protocol';
import { ModelsModelSelection as M } from '@cuccut/protocol/messages/models/model-selection.ts';
import type { ModelText } from './model-text.ts';

/**
 * Selection of provider and model (architecture design §6.2), pure functions: input is each provider's description (as obtained by `select`) and the user's defaults.
 *
 * Order; take the first that gives a result:
 * 1. Explicit `provider` / `model`. When only the provider is given: if the user default points to it, use the default's model; otherwise use its default model.
 *    When only the model is given: use the provider of the user default (or factory default) if it has this model; otherwise `local` if it has it; otherwise the single provider that lists it. If no provider lists it, it is `not-found`; if several do, `invalid-request`.
 * 2. The default the user set for this capability;
 * 3. Factory default: only `transcribe` has one. When the machine has a usable model package, use the default model package of `local`. `synthesizeSpeech`, `generateImage` and `generateText` have no factory default (even if `local` offers these capabilities in future); the user must specify them explicitly or set a default.
 * 4. Neither: `CAPABILITY_NOT_CONFIGURED`, `reason: 'no-default'`.
 *
 * When the selected provider or model is unavailable, reject directly with `CAPABILITY_NOT_CONFIGURED`; do not fall through to the next item, and do not switch provider. An unrecognized provider or model (explicitly given) is `not-found`: the identifier is wrong, not unconfigured.
 *
 * A node's model packages are checked by the node itself (node protocol spec §9): an explicitly given model that is not in the node's description is still let through, leaving it to the pre-attempt check.
 */

export type SelectionSource = 'explicit' | 'user-default' | 'factory-default';

export interface ModelChoice<C extends ModelServiceCapability = ModelServiceCapability> {
  capability: C;
  providerId: string;
  modelId: string;
  kind: ProviderKind;
  label: string;
  source: SelectionSource;
  model: ModelInfoByCapability[C];
}

export interface SelectionInput<C extends ModelServiceCapability> {
  capability: C;
  /** The already-normalized `providerId` (node aliases have been replaced with `node:<nodeId>`). */
  provider?: string;
  model?: string;
  userDefault: ModelRef | null;
  providers: ProviderView[];
}

const CAPABILITY_LABEL_BUILDERS: Record<ModelServiceCapability, () => Localized> = {
  transcribe: M.capTranscribe,
  synthesizeSpeech: M.capSynthesizeSpeech,
  generateImage: M.capGenerateImage,
  generateText: M.capGenerateText,
  separateAudio: M.capSeparateAudio,
  generateMusic: M.capGenerateMusic,
};

/** Capability name (for people): when embedded in a sentence, use it with quotes. */
export function capabilityLabel(capability: ModelServiceCapability): Localized {
  return CAPABILITY_LABEL_BUILDERS[capability]();
}

/** Capability name (text in the current language): generated fresh in the current language on each read. */
export const CAPABILITY_LABELS: Record<ModelServiceCapability, string> = live(() => ({
  transcribe: M.capTranscribe().text,
  synthesizeSpeech: M.capSynthesizeSpeech().text,
  generateImage: M.capGenerateImage().text,
  generateText: M.capGenerateText().text,
  separateAudio: M.capSeparateAudio().text,
  generateMusic: M.capGenerateMusic().text,
}));

const FACTORY_PROVIDER = 'local';
/** Capabilities with a factory default: all are local model packages. */
const FACTORY_CAPABILITIES: ReadonlySet<ModelServiceCapability> = new Set(['transcribe', 'separateAudio']);

/** Whether this capability has a factory default (item 3 of §6.2): `transcribe` and `separateAudio` do. */
export function hasFactoryDefault(capability: ModelServiceCapability): boolean {
  return FACTORY_CAPABILITIES.has(capability);
}

export function selectModel<C extends ModelServiceCapability>(input: SelectionInput<C>): ModelChoice<C> {
  const { capability } = input;
  const byId = new Map(input.providers.map((p) => [p.providerId, p]));

  if (input.provider !== undefined) {
    const view = byId.get(input.provider);
    if (!view) throw new RpcError('not-found', M.noSuchProvider({ provider: input.provider }));
    const modelId =
      input.model ??
      (input.userDefault?.providerId === input.provider
        ? input.userDefault.modelId
        : defaultModelOf(capabilityOf(view, capability))?.modelId);
    return check(input, view, modelId, 'explicit');
  }

  if (input.model !== undefined) {
    const model = input.model;
    const lists = (view: ProviderView | undefined) => !!view && !!capabilityOf(view, capability)?.models.some((m) => m.modelId === model);
    const preferred = effectiveProviderId(input);
    if (preferred && lists(byId.get(preferred))) return check(input, byId.get(preferred)!, model, 'explicit');
    if (lists(byId.get(FACTORY_PROVIDER))) return check(input, byId.get(FACTORY_PROVIDER)!, model, 'explicit');
    const candidates = input.providers.filter((view) => lists(view));
    if (candidates.length === 0) throw new RpcError('not-found', M.noProviderForModel({ model }));
    if (candidates.length > 1) {
      throw new RpcError('invalid-request', M.ambiguousModel({ model }), {
        providers: candidates.map((c) => c.providerId),
      });
    }
    return check(input, candidates[0]!, model, 'explicit');
  }

  if (input.userDefault) {
    const view = byId.get(input.userDefault.providerId);
    if (!view) throw missingDefaultProvider(capability, input.userDefault.providerId);
    return check(input, view, input.userDefault.modelId, 'user-default');
  }

  const local = FACTORY_CAPABILITIES.has(capability) ? byId.get(FACTORY_PROVIDER) : undefined;
  const localCapability = local ? capabilityOf(local, capability) : undefined;
  const localModel = localCapability?.available ? defaultModelOf(localCapability) : undefined;
  if (local && localModel && localModel.available !== false) return check(input, local, localModel.modelId, 'factory-default');
  throw noDefault(input);
}

/** The one used when none is specified explicitly (the view's `effective`): the user default or the factory default; null if unavailable or absent. */
export function effectiveChoice<C extends ModelServiceCapability>(
  input: Omit<SelectionInput<C>, 'provider' | 'model'>,
): (ModelRef & { source: 'user-default' | 'factory-default' }) | null {
  try {
    const choice = selectModel(input);
    return { providerId: choice.providerId, modelId: choice.modelId, source: choice.source as 'user-default' | 'factory-default' };
  } catch {
    return null;
  }
}

/**
 * Whether a transcription request is compatible with the model's features (checked at submission, not failing midway through execution). The recognition hint is not gated here: when the model does not accept hints, the hint is ignored, and
 * the task is recorded as `hint-ignored` as a notice (handled by JobManager at submission), not rejected.
 */
export function checkTranscribeOptions(choice: ModelChoice<'transcribe'>, options: { assertedLanguage: string | null }): void {
  const model: TranscribeModelInfo = choice.model;
  if (options.assertedLanguage && model.languages !== 'any') {
    const primary = options.assertedLanguage.toLowerCase().split('-')[0]!;
    if (!model.languages.some((tag) => tag.toLowerCase() === primary || tag.toLowerCase() === options.assertedLanguage!.toLowerCase())) {
      throw new RpcError('invalid-request', M.languageUnsupported({ modelId: choice.modelId, language: options.assertedLanguage }), {
        providerId: choice.providerId,
        languages: model.languages,
      });
    }
  }
}

// ---- internal ----

function capabilityOf<C extends ModelServiceCapability>(
  view: ProviderView,
  capability: C,
): ProviderCapability<ModelInfoByCapability[C]> | undefined {
  return view.capabilities[capability] as ProviderCapability<ModelInfoByCapability[C]> | undefined;
}

function defaultModelOf<M extends ModelInfoBase>(capability: ProviderCapability<M> | undefined): M | undefined {
  if (!capability) return undefined;
  return capability.models.find((m) => m.default) ?? capability.models[0];
}

/** Provider when none is specified: the user's default, or the factory default (when `local` is available). */
function effectiveProviderId(input: SelectionInput<ModelServiceCapability>): string | null {
  if (input.userDefault) return input.userDefault.providerId;
  if (!FACTORY_CAPABILITIES.has(input.capability)) return null;
  const local = input.providers.find((p) => p.providerId === FACTORY_PROVIDER);
  return local && capabilityOf(local, input.capability)?.available ? FACTORY_PROVIDER : null;
}

function check<C extends ModelServiceCapability>(
  input: SelectionInput<C>,
  view: ProviderView,
  modelId: string | undefined,
  source: SelectionSource,
): ModelChoice<C> {
  const { capability } = input;
  const cap = capabilityOf(view, capability);
  if (!cap) throw capabilityNotConfigured(capability, 'unsupported', view, 'set-default');
  if (!cap.available) throw fromUnavailable(capability, view, cap.unavailableReason, modelId, localizeText(cap.detail, cap.detailRef));
  if (modelId === undefined) throw capabilityNotConfigured(capability, 'unsupported', view, 'set-default');
  let model = cap.models.find((m) => m.modelId === modelId);
  if (!model) {
    if (view.kind === 'node') model = nodeModel(modelId) as ModelInfoByCapability[C];
    else if (source === 'explicit') throw new RpcError('not-found', M.providerNoModel({ provider: view.label, modelId }));
    else
      throw capabilityNotConfigured(capability, 'unsupported', view, 'set-default', M.defaultModelGone({ modelId, provider: view.label }));
  }
  if (model.available === false) {
    throw fromUnavailable(capability, view, model.unavailableReason, modelId, localizeText(model.detail, model.detailRef));
  }
  return { capability, providerId: view.providerId, modelId, kind: view.kind, label: view.label, source, model };
}

/** Model packages not listed by the node: the node checks them itself, so an unrestricted description is given here. */
function nodeModel(modelId: string): TranscribeModelInfo {
  return {
    modelId,
    label: modelId,
    maxInputBytes: null,
    maxDurationSec: null,
    wordTimestamps: 'native',
    languages: 'any',
    acceptsHint: true,
    cost: 'free-local',
  };
}

function fromUnavailable(
  capability: ModelServiceCapability,
  view: ProviderView,
  reason: ProviderUnavailableReason | undefined,
  modelId: string | undefined,
  detail: string | null | undefined,
): RpcError {
  const name = view.label;
  const model = modelId ?? '';
  if (view.kind === 'agent') return fromAgentUnavailable(capability, view, reason, detail);
  switch (reason) {
    case 'missing-credential':
      return capabilityNotConfigured(
        capability,
        'missing-credential',
        view,
        'configure-provider',
        M.missingCredential({ name }),
      );
    case 'not-installed':
      return capabilityNotConfigured(
        capability,
        'not-installed',
        view,
        'install-model',
        M.localNotInstalled({ model }),
      );
    case 'not-paired':
      return capabilityNotConfigured(capability, 'not-paired', view, 'pair-node', M.nodeNotPaired({ name }));
    case 'not-connected':
      return capabilityNotConfigured(
        capability,
        'not-connected',
        view,
        'pair-node',
        M.nodeNotConnected({ name }),
      );
    case 'resource':
      return capabilityNotConfigured(
        capability,
        'disabled',
        view,
        'enable-provider',
        M.localDisabled({ model }),
      );
    case 'not-configured': {
      // Configured before (has a key) but only disabled: re-enable; never configured: go and configure it.
      const configured = view.config?.credential === 'set';
      return configured
        ? capabilityNotConfigured(capability, 'disabled', view, 'enable-provider', M.providerDisabled({ name }))
        : capabilityNotConfigured(capability, 'disabled', view, 'configure-provider', M.providerNotConfigured({ name }));
    }
    case 'signed-out':
    case 'outdated':
    case 'unsupported':
    case undefined:
      return capabilityNotConfigured(capability, 'unsupported', view, 'set-default');
  }
}

/**
 * Agent provider (§6.9): installation, login and upgrade are done in the agent runtime's own interface (`setup-agent`, `detail` explains how);
 * enabling it when not enabled means consenting to send prompts to this agent's account.
 */
function fromAgentUnavailable(
  capability: ModelServiceCapability,
  view: ProviderView,
  reason: ProviderUnavailableReason | undefined,
  detail: string | null | undefined,
): RpcError {
  const name = view.label;
  switch (reason) {
    case 'not-installed':
      return capabilityNotConfigured(
        capability,
        'not-installed',
        view,
        'setup-agent',
        detail ? M.agentNotInstalledWith({ name, detail }) : M.agentNotInstalled({ name }),
      );
    case 'signed-out':
      return capabilityNotConfigured(
        capability,
        'signed-out',
        view,
        'setup-agent',
        detail ? M.agentSignedOutWith({ name, detail }) : M.agentSignedOut({ name }),
      );
    case 'outdated':
      return capabilityNotConfigured(
        capability,
        'outdated',
        view,
        'setup-agent',
        detail ? M.agentOutdatedWith({ name, detail }) : M.agentOutdated({ name }),
      );
    case 'not-configured':
      return capabilityNotConfigured(
        capability,
        'disabled',
        view,
        'enable-provider',
        M.agentNotEnabled({ name }),
      );
    default:
      return capabilityNotConfigured(
        capability,
        'unsupported',
        view,
        'setup-agent',
        detail ? M.agentUnavailableWith({ name, detail }) : M.agentUnavailable({ name }),
      );
  }
}

function missingDefaultProvider(capability: ModelServiceCapability, providerId: string): RpcError {
  const isNode = providerId.startsWith('node:');
  return capabilityNotConfiguredError(
    capability,
    isNode ? 'not-paired' : 'disabled',
    providerId,
    isNode ? 'pair-node' : 'configure-provider',
    isNode
      ? M.defaultNodeUnpaired({ node: providerId.slice(5), capability: capabilityLabel(capability) })
      : M.defaultProviderRemoved({ provider: providerId, capability: capabilityLabel(capability) }),
  );
}

function noDefault(input: SelectionInput<ModelServiceCapability>): RpcError {
  const { capability } = input;
  const label = capabilityLabel(capability);
  const usable = input.providers.find((p) => capabilityOf(p, capability)?.available);
  if (usable) {
    return capabilityNotConfiguredError(
      capability,
      'no-default',
      undefined,
      'set-default',
      M.setUsableAsDefault({ provider: usable.label, capability: label }),
      usable.providerId,
    );
  }
  // A local image-generation model package is not a fallback when there is no default: the UI on opening a page falls back only to connected cloud models (design mockup `model-cloud-image.js` `preferred`),
  // so for local image generation the user must choose it or set it as default themselves.
  const local = capability === 'generateImage' ? undefined : input.providers.find((p) => p.providerId === FACTORY_PROVIDER);
  const localNotInstalled = local && capabilityOf(local, capability)?.models.some((m) => m.unavailableReason === 'not-installed');
  if (localNotInstalled) {
    return capabilityNotConfiguredError(
      capability,
      'no-default',
      undefined,
      'install-model',
      capability === 'separateAudio'
        ? M.noModelInstallSeparator({ capability: label })
        : M.noModelInstallLocal({ capability: label }),
      FACTORY_PROVIDER,
    );
  }
  return capabilityNotConfiguredError(
    capability,
    'no-default',
    undefined,
    capability === 'separateAudio' ? 'install-model' : 'configure-provider',
    capability === 'separateAudio'
      ? M.noModelInstallSeparator({ capability: label })
      : M.noModelConfigure({ capability: label }),
  );
}

function capabilityNotConfigured(
  capability: ModelServiceCapability,
  reason: CapabilityNotConfiguredReason,
  view: ProviderView,
  action: CapabilityNotConfiguredDetails['remedy']['action'],
  hint?: ModelText,
): RpcError {
  return capabilityNotConfiguredError(
    capability,
    reason,
    view.providerId,
    action,
    hint ?? M.cannotUseFor({ provider: view.label, capability: capabilityLabel(capability) }),
    view.providerId,
  );
}

/**
 * Build `CAPABILITY_NOT_CONFIGURED` (`RpcError` with `code` `conflict`). `hint` can be directory text: `details.remedy.hint` stores the text,
 * `hintRef` stores the reference, and the error's `messageRef` also goes over the wire with its reference.
 */
export function capabilityNotConfiguredError(
  capability: ModelServiceCapability,
  reason: CapabilityNotConfiguredReason,
  providerId: string | undefined,
  action: CapabilityNotConfiguredDetails['remedy']['action'],
  hint: ModelText,
  remedyProvider: string | undefined = providerId,
): RpcError {
  const details: CapabilityNotConfiguredDetails = {
    code: 'CAPABILITY_NOT_CONFIGURED',
    capability,
    reason,
    ...(providerId ? { providerId } : {}),
    remedy: {
      action,
      ...(remedyProvider ? { providerId: remedyProvider } : {}),
      capability,
      hint: String(hint),
      ...(typeof hint === 'string' ? {} : { hintRef: refOf(hint) }),
    },
  };
  return new RpcError('conflict', hint, details);
}
