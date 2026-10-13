import {
  formatRef,
  live,
  LOCALES,
  type ModelApiAlias,
  type ModelApiRouting,
  type ModelCapabilitiesView,
  type OnlineCapability,
  type ProviderCapabilityView,
  type ProviderKind,
} from '@cuccut/protocol';
import { M, type ServicesApiMessages } from './services-api-copy.ts';

/**
 * Pure model for the model API service page (prototype designs/cuccut/app/page-services-api.jsx and page-services-api-map.jsx; architecture design §4.8): the endpoint catalog, routing switches, the models each capability can currently route to, the description and validation of the alias table, and the target options when adding an alias.
 * Routing rules follow Runtime's model-api-routing.ts: the local machine (`local`) is always on; online, node and agent providers each need their routing switch turned on separately; only the available ones count.
 */

export const CAPABILITY_LABEL: Readonly<Record<OnlineCapability, string>> = live(() => M.capabilities);

export const API_CAPABILITIES: readonly OnlineCapability[] = ['transcribe', 'synthesizeSpeech', 'generateImage', 'generateText'];

export interface ApiEndpoint {
  method: 'GET' | 'POST';
  path: string;
  title: string;
  /** Which capability this endpoint uses; null for query endpoints. */
  capability: OnlineCapability | null;
}

/** Endpoints (the routing table in Runtime's model-api-service.ts): paths are the same as OpenAI's, plus CucCut's own info endpoints. */
const ENDPOINT_ROWS: readonly (readonly [ApiEndpoint['method'], string, keyof ServicesApiMessages['endpoints'], OnlineCapability | null])[] = [
  ['GET', '/models', 'models', null],
  ['GET', '/models/{model}', 'model', null],
  ['GET', '/cuccut/info', 'info', null],
  ['POST', '/audio/transcriptions', 'transcriptions', 'transcribe'],
  ['POST', '/audio/speech', 'speech', 'synthesizeSpeech'],
  ['POST', '/images/generations', 'images', 'generateImage'],
  ['POST', '/chat/completions', 'chat', 'generateText'],
];

export const API_ENDPOINTS: readonly ApiEndpoint[] = ENDPOINT_ROWS.map(([method, path, title, capability]) => ({
  method,
  path,
  get title() {
    return M.endpoints[title];
  },
  capability,
}));

export const ROUTING_ROWS: readonly { key: keyof ModelApiRouting; label: string; desc: string }[] = (['online', 'nodes', 'agent'] as const).map((key) => ({
  key,
  get label() {
    return M.routing[key].label;
  },
  get desc() {
    return M.routing[key].desc;
  },
}));

export function routable(kind: ProviderKind, routing: ModelApiRouting): boolean {
  if (kind === 'local') return true;
  if (kind === 'online') return routing.online;
  if (kind === 'node') return routing.nodes;
  return routing.agent;
}

function providers(view: ModelCapabilitiesView, capability: OnlineCapability): ProviderCapabilityView[] {
  return view[capability].providers as ProviderCapabilityView[];
}

/** The number of models this capability can currently route to (the `<providerId>/<modelId>` entries that will be listed by `/v1/models`). */
export function routableModelCount(view: ModelCapabilitiesView, capability: OnlineCapability, routing: ModelApiRouting): number {
  let n = 0;
  for (const p of providers(view, capability)) {
    if (!p.available || !routable(p.kind, routing)) continue;
    n += p.models.filter((m) => m.available !== false).length;
  }
  return n;
}

/** One sentence per capability: “3 个模型可用”（3 models available), or why not (none available, or the available ones have routing switched off). */
export function capabilityLine(view: ModelCapabilitiesView, capability: OnlineCapability, routing: ModelApiRouting): string {
  const n = routableModelCount(view, capability, routing);
  if (n) return M.modelsAvailable(n);
  const usable = providers(view, capability).some((p) => p.available && p.models.some((m) => m.available !== false));
  return usable ? M.notRouted : M.noModels;
}

export interface AliasView {
  alias: string;
  capability: string;
  target: string;
  /** Whether an external program can use this name right now; when it cannot, `why` gives the reason (Runtime does not check, so the request is answered with 404 or 503). */
  usable: boolean;
  why: string | null;
}

/** One row of the alias table: name → capability · provider and model; explains when the target is unavailable or routing is off. */
export function aliasView(alias: ModelApiAlias, view: ModelCapabilitiesView | null, routing: ModelApiRouting): AliasView {
  const capability = CAPABILITY_LABEL[alias.capability];
  const provider = view ? providers(view, alias.capability).find((p) => p.providerId === alias.providerId) : undefined;
  const model = provider && alias.modelId !== null ? provider.models.find((m) => m.modelId === alias.modelId) : undefined;
  const providerName = provider?.label ?? alias.providerId;
  const modelName = alias.modelId === null ? M.defaultModel : (model?.label ?? alias.modelId);
  const target = M.target(providerName, modelName);
  if (!view) return { alias: alias.alias, capability, target, usable: true, why: null };
  if (!provider) return { alias: alias.alias, capability, target, usable: false, why: M.aliasProviderMissing };
  if (!routable(provider.kind, routing)) return { alias: alias.alias, capability, target, usable: false, why: M.aliasNotRouted };
  if (!provider.available) return { alias: alias.alias, capability, target, usable: false, why: M.aliasProviderUnavailable };
  const ok = alias.modelId === null ? provider.models.some((m) => m.available !== false) : !!model && model.available !== false;
  return { alias: alias.alias, capability, target, usable: ok, why: ok ? null : M.aliasModelUnavailable };
}

export interface AliasTargetOption {
  /** `<providerId>\u0000<modelId or empty>`: the key of the option. */
  key: string;
  providerId: string;
  modelId: string | null;
  label: string;
  /** Explanation when it cannot be routed right now (it can be selected, but the request will fail). */
  note: string | null;
}

/** Target options when adding an alias: one “默认模型”（default model) item per provider, followed by each of its models. Lists only the providers under this capability. */
export function aliasTargets(view: ModelCapabilitiesView, capability: OnlineCapability, routing: ModelApiRouting): AliasTargetOption[] {
  const out: AliasTargetOption[] = [];
  for (const p of providers(view, capability)) {
    const note = !routable(p.kind, routing) ? M.targetNotRouted : !p.available ? M.targetUnavailable : null;
    out.push({ key: targetKey(p.providerId, null), providerId: p.providerId, modelId: null, label: M.target(p.label, M.defaultModel), note });
    for (const m of p.models) {
      out.push({
        key: targetKey(p.providerId, m.modelId),
        providerId: p.providerId,
        modelId: m.modelId,
        label: M.target(p.label, m.label),
        note: note ?? (m.available === false ? M.targetUnavailable : null),
      });
    }
  }
  return out;
}

export function targetKey(providerId: string, modelId: string | null): string {
  return `${providerId}\u0000${modelId ?? ''}`;
}

/** Alias name validation (same rules as the protocol's `modelApiAlias`): starts with a letter or digit, contains only letters, digits and `. _ : -`, and is at most 100 characters. */
export function aliasNameError(name: string, existing: readonly ModelApiAlias[]): string | null {
  const t = name.trim();
  if (!t) return M.aliasNameEmpty;
  if (t.includes('/')) return M.aliasNameSlash;
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(t)) return M.aliasNameChars;
  if (existing.some((a) => a.alias === t)) return M.aliasNameTaken(t);
  return null;
}

/**
 * Token placeholder used by connectionInfo when there is no client (`rcServices.tokenPlaceholderGeneric`). Runtime writes it in its own language, which may differ from the UI language (browser clients), so every shipped language's form is recognized.
 */
export function tokenPlaceholders(): string[] {
  const ref = { key: 'rcServices.tokenPlaceholderGeneric' };
  return [...new Set(LOCALES.map((locale) => formatRef(ref, '', locale)).filter(Boolean))];
}

/**
 * In the connection-info snippet (the version obtained without a `clientId`), the placeholder is replaced with the plaintext token: only at the moment the client is created, and only into the clipboard. Placeholders that carry the client name (`<名字 的令牌>`, i.e. “<name>'s token”) may contain any characters in the name, so they are not guessed at; the version without a client is used instead.
 */
export function withToken(snippet: string, token: string): string {
  return tokenPlaceholders().reduce((text, placeholder) => text.split(placeholder).join(token), snippet);
}

/** Byte count → “256 MB”. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024 * 1024))} GB`;
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
