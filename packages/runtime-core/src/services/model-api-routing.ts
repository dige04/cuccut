import {
  ONLINE_CAPABILITIES,
  type ModelApiAlias,
  type ModelApiRouting,
  type ModelCapabilitiesView,
  type ModelServiceCapability,
  type ProviderCapabilityView,
  type ProviderKind,
  type Localized,
} from '@cuccut/protocol';
import { RcModelApi } from '@cuccut/protocol/messages/runtime-core';
import { ApiError } from './model-api-errors.ts';

/**
 * Routing of the model API service (architecture design §4.8): an OpenAI-shaped model name → a provider and model under one capability.
 *
 * - Three ways to write a name, tried in order: an alias in the alias table; the canonical form `<providerId>/<modelId>`; a model name in the capability view (when several providers have it,
 *   the first available one in the view's order is taken; local comes first).
 * - Routes only to allowed providers: `local` is always allowed; `online`, `node`, and `agent` each depend on their switch in the service config. A class that is not allowed
 *   does not exist for this service: it is not in `/v1/models`, and access by name is 404.
 * - When this capability has no routable, available model at the moment, answer 503 (`CAPABILITY_NOT_CONFIGURED`) and explain how to enable it;
 *   if there is one but the name is not one of them, 404 (`MODEL_NOT_FOUND`).
 */

export interface ModelApiTarget {
  providerId: string;
  /** null: this provider's default model (selection rules in §6.2). */
  modelId: string | null;
}

/** One entry of `/v1/models`. */
export interface ListedModel {
  id: string;
  capability: ModelServiceCapability;
  providerId: string;
  modelId: string | null;
  alias: boolean;
}

/** The name of the capability (embedded in error explanations). */
function capabilityText(capability: ModelServiceCapability): Localized {
  switch (capability) {
    case 'transcribe':
      return RcModelApi.capabilityTranscribe();
    case 'synthesizeSpeech':
      return RcModelApi.capabilitySynthesizeSpeech();
    case 'generateImage':
      return RcModelApi.capabilityGenerateImage();
    case 'generateText':
      return RcModelApi.capabilityGenerateText();
    case 'separateAudio':
      return RcModelApi.capabilitySeparateAudio();
    case 'generateMusic':
      return RcModelApi.capabilityGenerateMusic();
  }
}

export function routable(kind: ProviderKind, routing: ModelApiRouting): boolean {
  switch (kind) {
    case 'local':
      return true;
    case 'online':
      return routing.online;
    case 'node':
      return routing.nodes;
    case 'agent':
      return routing.agent;
  }
}

function usableProviders(
  view: ModelCapabilitiesView,
  capability: ModelServiceCapability,
  routing: ModelApiRouting,
): ProviderCapabilityView[] {
  return (view[capability].providers as ProviderCapabilityView[]).filter((p) => routable(p.kind, routing) && p.available);
}

function modelUsable(provider: ProviderCapabilityView, modelId: string | null): boolean {
  const models = provider.models;
  if (modelId === null) return models.some((m) => m.available !== false);
  return models.some((m) => m.modelId === modelId && m.available !== false);
}

/** The models this service can route to at the moment: aliases first, then `<providerId>/<modelId>`. Only available ones are listed. */
export function listModels(view: ModelCapabilitiesView, routing: ModelApiRouting, aliases: ModelApiAlias[]): ListedModel[] {
  const listed: ListedModel[] = [];
  // Human voice separation is local-only and has no corresponding interface, so it is not listed.
  const capabilities = ONLINE_CAPABILITIES;
  for (const alias of aliases) {
    const provider = usableProviders(view, alias.capability, routing).find((p) => p.providerId === alias.providerId);
    if (!provider || !modelUsable(provider, alias.modelId)) continue;
    listed.push({ id: alias.alias, capability: alias.capability, providerId: alias.providerId, modelId: alias.modelId, alias: true });
  }
  for (const capability of capabilities) {
    for (const provider of usableProviders(view, capability, routing)) {
      for (const model of provider.models) {
        if (model.available === false) continue;
        listed.push({
          id: `${provider.providerId}/${model.modelId}`,
          capability,
          providerId: provider.providerId,
          modelId: model.modelId,
          alias: false,
        });
      }
    }
  }
  return listed;
}

/** Model name in the request → provider and model. 404 when not found; 503 when the capability has no routable model. */
export function resolveModel(
  name: string,
  capability: ModelServiceCapability,
  view: ModelCapabilitiesView,
  routing: ModelApiRouting,
  aliases: ModelApiAlias[],
): ModelApiTarget {
  const providers = usableProviders(view, capability, routing);
  if (!providers.some((p) => modelUsable(p, null))) throw notConfigured(capability, routing);

  const notFound = () =>
    new ApiError(404, 'MODEL_NOT_FOUND', RcModelApi.modelNotFoundFor({ capability: capabilityText(capability), model: name }));
  const check = (target: ModelApiTarget): ModelApiTarget => {
    const provider = providers.find((p) => p.providerId === target.providerId);
    if (!provider || !modelUsable(provider, target.modelId)) throw notFound();
    return target;
  };

  const alias = aliases.find((a) => a.alias === name);
  if (alias) {
    if (alias.capability !== capability) throw notFound();
    return check({ providerId: alias.providerId, modelId: alias.modelId });
  }
  const slash = name.indexOf('/');
  if (slash > 0) return check({ providerId: name.slice(0, slash), modelId: name.slice(slash + 1) });
  const provider = providers.find((p) => p.models.some((m) => m.modelId === name && m.available !== false));
  if (!provider) throw notFound();
  return { providerId: provider.providerId, modelId: name };
}

function notConfigured(capability: ModelServiceCapability, routing: ModelApiRouting): ApiError {
  const what = capabilityText(capability);
  const hint = routing.online ? RcModelApi.hintEnableOnline({ capability: what }) : RcModelApi.hintNoLocalModel({ capability: what });
  return new ApiError(503, 'CAPABILITY_NOT_CONFIGURED', RcModelApi.capabilityUnavailable({ capability: what, hint }));
}
