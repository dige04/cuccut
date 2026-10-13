import {
  AGENT_PROVIDER_PREFIX,
  defineMessages,
  live,
  localizeText,
  ONLINE_CAPABILITIES,
  type ConfigureProviderRequest,
  type DeclaredModel,
  type ImageModelInfo,
  type ModelCapabilitiesView,
  type ModelInfoBase,
  type ModelRef,
  type ModelServiceCapability,
  type OnlineCapability,
  type ProviderCapabilityView,
  type ProviderConfigView,
  type ProviderRefreshStatus,
  type ProviderUnavailableReason,
  type SpeechModelInfo,
  type TextModelInfo,
  type TranscribeModelInfo,
} from '@cuccut/protocol';
import type { ModelCategory } from './settings-nav.ts';
import { zhHans } from './models-cloud.zh-Hans.ts';
import { zhHant } from './models-cloud.zh-Hant.ts';
import { ja } from './models-cloud.ja.ts';
import { ko } from './models-cloud.ko.ts';
import { es } from './models-cloud.es.ts';
import { fr } from './models-cloud.fr.ts';
import { de } from './models-cloud.de.ts';
import { nl } from './models-cloud.nl.ts';
import { ptBR } from './models-cloud.pt-BR.ts';
import { it } from './models-cloud.it.ts';
import { ru } from './models-cloud.ru.ts';
import { pl } from './models-cloud.pl.ts';
import { tr } from './models-cloud.tr.ts';
import { vi } from './models-cloud.vi.ts';

/**
 * Models › Cloud models (design settings-cloud.jsx): folds the capability view of the `models` topic into what this page draws.
 * The provider list is not hard-coded; it all comes from the view: built-in ones (OpenAI, Google Gemini, ElevenLabs) appear only in the tiers where they have that capability;
 * custom ones (`custom:<slug>`, OpenAI-compatible) appear in every tier — when a tier has no declared model, one is added in place and the same key is reused.
 */

export const CUSTOM_PROVIDER_PREFIX = 'custom:';
/** Slug of the custom providers recognized by the Runtime (providers/online-source.ts). */
const CUSTOM_SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;

/** Capability category → model service capability. Source separation and visual understanding have no matching capability in the Runtime yet, so they are null. */
const CATEGORY_CAPABILITY: Partial<Record<ModelCategory, OnlineCapability>> = {
  asr: 'transcribe',
  tts: 'synthesizeSpeech',
  llm: 'generateText',
  image: 'generateImage',
};

export function categoryCapability(category: ModelCategory): OnlineCapability | null {
  return CATEGORY_CAPABILITY[category] ?? null;
}

/** Model service capability → the capability category it belongs to (after a model with another purpose is added, it jumps to that category). */
export function capabilityCategory(capability: ModelServiceCapability): ModelCategory {
  switch (capability) {
    case 'transcribe':
      return 'asr';
    case 'synthesizeSpeech':
      return 'tts';
    case 'generateImage':
      return 'image';
    case 'generateText':
      return 'llm';
    case 'separateAudio':
      return 'sep';
    case 'generateMusic':
      return 'music';
  }
}

/** Copy for this page (the English is the source of the keys and types; translations are in `models-cloud.<locale>.ts`). */
const en = {
  /** Short names of capabilities (key descriptions, the purpose segments when adding a model). */
  capabilityShort: {
    transcribe: 'Speech recognition',
    synthesizeSpeech: 'Speech synthesis',
    generateImage: 'Image generation',
    generateText: 'Text generation',
  } as Record<OnlineCapability, string>,
  /** The custom provider has not declared a model for this tier. */
  noModels: 'No models declared',
  /** An unavailable item in the default menu: “不可用” (unavailable) is written after the name (`unavailable` is supplied by the caller). */
  unavailableItem: (label: string, unavailable: string) => `${label} (${unavailable})`,
};

export type ModelsCloudMessages = typeof en;

const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/** Short names of capabilities (key descriptions, the purpose segments when adding a model). */
export const CAPABILITY_SHORT: Record<OnlineCapability, string> = live(() => M.capabilityShort);

export function isCustomProvider(providerId: string): boolean {
  return providerId.startsWith(CUSTOM_PROVIDER_PREFIX);
}

export function isAgentProvider(providerId: string): boolean {
  return providerId.startsWith(AGENT_PROVIDER_PREFIX);
}

/**
 * “已连接” (connected): built-in ones must be enabled and have a key; custom ones must be enabled and have an address (a key is optional; local or intranet services often do not need one).
 * Different from “可用” (available): a custom one may be connected, but if this tier has no declared model, the tier is still unavailable.
 */
export function providerConnected(providerId: string, config: ProviderConfigView | null): boolean {
  if (!config?.enabled) return false;
  return isCustomProvider(providerId) ? !!config.endpoint : config.credential === 'set';
}

/** One provider card. */
export interface CloudProviderCard {
  providerId: string;
  label: string;
  custom: boolean;
  connected: boolean;
  /** The address of a custom provider (built-in ones also have one when their base URL has been rewritten). */
  endpoint: string | null;
  /** Models under this tier; empty for a custom provider that has not declared this tier. */
  models: ModelInfoBase[];
  /** The capabilities this provider offers in each tier (the key dialog says “这把密钥给哪几类用” (which categories this key is used for)). For custom providers, only tiers with declared models count. */
  capabilities: OnlineCapability[];
  /** Whether this tier is usable right now, and why. */
  available: boolean;
  unavailableReason?: ProviderUnavailableReason;
  /** The reason it cannot be used, already generated in the UI's current language (the Runtime's `detail` / `detailRef`). */
  detail?: string;
  /** Result of the latest “刷新” (refresh) (`models.refreshProvider`); absent if never refreshed. */
  refreshed?: ProviderRefreshStatus;
}

function onlineProviders(view: ModelCapabilitiesView, capability: OnlineCapability): ProviderCapabilityView[] {
  return view[capability].providers.filter((p) => p.kind === 'online');
}

/** Capabilities this provider offers in each tier. */
function capabilitiesOf(view: ModelCapabilitiesView, providerId: string): OnlineCapability[] {
  const custom = isCustomProvider(providerId);
  return ONLINE_CAPABILITIES.filter((capability) => {
    const entry = view[capability].providers.find((p) => p.providerId === providerId);
    return !!entry && (!custom || entry.models.length > 0);
  });
}

/**
 * Provider cards for this tier: built-in ones in view order, custom ones after them (by ID); connected ones come first.
 * Custom ones are looked up in each of the three capability views and then merged — a custom provider appears only in capabilities where it declares models (if it declares none, it appears only under speech recognition).
 */
export function cloudProviders(view: ModelCapabilitiesView, capability: OnlineCapability): CloudProviderCard[] {
  const here = onlineProviders(view, capability);
  const builtins = here.filter((p) => !isCustomProvider(p.providerId));
  const customs = new Map<string, ProviderCapabilityView>();
  for (const cap of ONLINE_CAPABILITIES) {
    for (const p of onlineProviders(view, cap)) {
      if (isCustomProvider(p.providerId) && !customs.has(p.providerId)) customs.set(p.providerId, p);
    }
  }
  const cards = [
    ...builtins,
    ...[...customs.values()].sort((a, b) => a.providerId.localeCompare(b.providerId)),
  ].map((p): CloudProviderCard => {
    const entry = here.find((x) => x.providerId === p.providerId);
    const card: CloudProviderCard = {
      providerId: p.providerId,
      label: p.label,
      custom: isCustomProvider(p.providerId),
      connected: providerConnected(p.providerId, p.config),
      endpoint: p.config?.endpoint ?? null,
      models: entry?.models ?? [],
      capabilities: capabilitiesOf(view, p.providerId),
      available: entry?.available ?? false,
    };
    const reason = entry ? entry.unavailableReason : 'not-configured';
    const detail = entry ? localizeText(entry.detail, entry.detailRef) : M.noModels;
    if (!card.available && reason) card.unavailableReason = reason;
    if (!card.available && detail) card.detail = detail;
    if (p.config?.refreshed) card.refreshed = p.config.refreshed;
    return card;
  });
  return [...cards.filter((c) => c.connected), ...cards.filter((c) => !c.connected)];
}

// ---- Refresh model and voice catalogs ----

/** What “刷新” (refresh) refreshes: the text generation tier refreshes the model list; the speech synthesis tier refreshes the voice catalog. */
export type RefreshKind = 'models' | 'voices';

/**
 * Whether the “刷新” (refresh) button appears on the card header (design settings-cloud.jsx:318-321): the text generation tier refreshes models; the speech synthesis tier refreshes the voice catalog,
 * and OpenAI's voices are a fixed set, so it is not shown; speech recognition and image tiers have none. It is also shown when not connected (greyed out), so people know refreshing will be possible once connected.
 * One `models.refreshProvider` call fetches models and voices together; here we only decide what the button is called and how the description line is written.
 */
export function refreshKind(card: Pick<CloudProviderCard, 'providerId' | 'custom' | 'models'>, capability: OnlineCapability): RefreshKind | null {
  if (capability === 'generateText') return card.custom || card.models.length > 0 ? 'models' : null;
  if (capability === 'synthesizeSpeech') return card.providerId === 'openai' ? null : 'voices';
  return null;
}

/** The part of the card header description line related to refreshing (design `headDesc` / `modelsLine` / `voicesLine`). */
export type RefreshLine =
  | { state: 'refreshing'; kind: RefreshKind }
  | { state: 'failed'; kind: RefreshKind; error: string }
  | { state: 'builtin'; kind: RefreshKind; models: number; voices: number }
  | { state: 'fresh'; kind: RefreshKind; models: number; voices: number; unusable: number; at: string };

/** Voices that appear among this tier's models (deduplicated). */
export function voiceCount(models: readonly ModelInfoBase[]): number {
  const ids = new Set<string>();
  for (const model of models) for (const voice of (model as SpeechModelInfo).voices ?? []) ids.add(voice.voiceId);
  return ids.size;
}

/**
 * Description for a connected card in a tier that has refresh: currently refreshing; refresh failed (the reason contains no key; the Runtime has already fallen back to the built-in list); never refreshed (built-in list);
 * refreshed (how many models, how many voices, and how long ago; built-in models missing from the fetched list are marked unavailable by the Runtime, and are counted here). Otherwise returns null, and the model count is written as before.
 */
export function refreshLine(card: CloudProviderCard, capability: OnlineCapability, refreshing: boolean): RefreshLine | null {
  const kind = refreshKind(card, capability);
  if (!kind || !card.connected || !card.models.length) return null;
  if (refreshing) return { state: 'refreshing', kind };
  const refreshed = card.refreshed;
  if (refreshed && !refreshed.ok) return { state: 'failed', kind, error: refreshed.error ?? '' };
  const counts = { models: card.models.length, voices: voiceCount(card.models) };
  if (!refreshed) return { state: 'builtin', kind, ...counts };
  return { state: 'fresh', kind, ...counts, unusable: card.models.filter((m) => m.available === false).length, at: refreshed.at };
}

/** Providers refreshed once right after saving a key (design settings-cloud.jsx:394): custom ones, or ones that have a text generation model. */
export function refreshAfterKey(card: Pick<CloudProviderCard, 'custom' | 'capabilities'>): boolean {
  return card.custom || card.capabilities.includes('generateText');
}

// ---- Models declared by custom providers ----

function withLabel(info: ModelInfoBase): Pick<DeclaredModel, 'modelId' | 'label'> {
  return info.label && info.label !== info.modelId ? { modelId: info.modelId, label: info.label } : { modelId: info.modelId };
}

/** A model in the view → declaration (`models` in `models.configure` replaces the whole list, so adding one means passing the existing ones through unchanged). */
export function declaredFromInfo(capability: OnlineCapability, info: ModelInfoBase): DeclaredModel {
  switch (capability) {
    case 'transcribe': {
      const m = info as TranscribeModelInfo;
      return {
        ...withLabel(m),
        capability,
        ...(m.maxInputBytes !== null ? { maxInputBytes: m.maxInputBytes } : {}),
        maxDurationSec: m.maxDurationSec,
        wordTimestamps: m.wordTimestamps,
        acceptsHint: m.acceptsHint,
      };
    }
    case 'synthesizeSpeech': {
      const m = info as SpeechModelInfo;
      return {
        ...withLabel(m),
        capability,
        voices: m.voices.map((v) => v.voiceId),
        maxInputChars: m.maxInputChars,
        formats: [...m.formats],
      };
    }
    case 'generateImage': {
      const m = info as ImageModelInfo;
      return { ...withLabel(m), capability, sizes: [...m.sizes], maxCount: m.maxCount, maxPromptChars: m.maxPromptChars };
    }
    case 'generateText': {
      const m = info as TextModelInfo;
      return {
        ...withLabel(m),
        capability,
        contextTokens: m.contextTokens,
        maxOutputTokens: m.maxOutputTokens,
        efforts: [...m.efforts],
        structuredOutput: m.structuredOutput,
      };
    }
  }
}

/** All models a custom provider currently declares (the three capabilities combined). */
export function declaredModels(view: ModelCapabilitiesView, providerId: string): DeclaredModel[] {
  const out: DeclaredModel[] = [];
  for (const capability of ONLINE_CAPABILITIES) {
    const entry = view[capability].providers.find((p) => p.providerId === providerId);
    for (const info of entry?.models ?? []) out.push(declaredFromInfo(capability, info));
  }
  return out;
}

/** Voice IDs separated by commas, enumeration commas, or whitespace. */
export function parseVoiceIds(text: string): string[] {
  return [...new Set(text.split(/[,，、\s]+/).map((s) => s.trim()).filter(Boolean))];
}

/** A newly declared model: only its ID, purpose, and (for speech synthesis) voice are given; the rest take conservative defaults from the Runtime. */
export function newDeclaredModel(modelId: string, capability: OnlineCapability, voiceIds = ''): DeclaredModel {
  const voices = capability === 'synthesizeSpeech' ? parseVoiceIds(voiceIds) : [];
  return { modelId: modelId.trim(), capability, ...(voices.length ? { voices } : {}) };
}

/** The model ID has already been declared by this provider (the Runtime rejects a duplicate modelId regardless of purpose). */
export function modelIdTaken(view: ModelCapabilitiesView, providerId: string, modelId: string): boolean {
  const id = modelId.trim();
  return declaredModels(view, providerId).some((m) => m.modelId === id);
}

/** Adds a model under a custom provider: existing declarations are passed through unchanged, and this one is added. */
export function addModelRequest(
  view: ModelCapabilitiesView,
  providerId: string,
  model: DeclaredModel,
): ConfigureProviderRequest {
  return { providerId, models: [...declaredModels(view, providerId), model] };
}

// ---- Add custom provider ----

/** For checking duplicate service addresses: trims leading and trailing whitespace and the trailing slash, case-insensitive (design normUrl). */
export function normalizeEndpoint(url: string): string {
  return url.trim().replace(/\/+$/, '').toLowerCase();
}

/** Looks like an http(s) address. */
export function isEndpointUrl(url: string): boolean {
  const text = url.trim();
  if (!/^https?:\/\/[^\s/]+/i.test(text)) return false;
  try {
    new URL(text);
    return true;
  } catch {
    return false;
  }
}

/** Which custom provider this address has already been added as (adding a model under it reuses the same key). */
export function endpointOwner(view: ModelCapabilitiesView, url: string): { providerId: string; label: string } | null {
  const key = normalizeEndpoint(url);
  if (!key) return null;
  for (const capability of ONLINE_CAPABILITIES) {
    for (const p of view[capability].providers) {
      if (isCustomProvider(p.providerId) && p.config?.endpoint && normalizeEndpoint(p.config.endpoint) === key) {
        return { providerId: p.providerId, label: p.label };
      }
    }
  }
  return null;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** When no slug can be derived from the name (for example, all Chinese characters), the host name of the address is used: remove api. / www. and the top-level domain. */
function slugFromUrl(url: string): string {
  try {
    const { hostname, port } = new URL(url.trim());
    const labels = hostname.split('.').filter((l) => l && l !== 'api' && l !== 'www');
    const host = labels.length > 1 && !/^\d+$/.test(labels[labels.length - 1]!) ? labels.slice(0, -1) : labels;
    return slugify([...host, port].filter(Boolean).join('-'));
  } catch {
    return '';
  }
}

/** The custom provider ID `custom:<slug>`: uses the name first, and the address if no slug can be derived; if it collides with an existing one, -2, -3 is appended. */
export function customProviderId(name: string, url: string, taken: ReadonlySet<string>): string {
  const base = (slugify(name) || slugFromUrl(url) || 'provider').slice(0, 56).replace(/-+$/, '') || 'provider';
  const first = CUSTOM_SLUG.test(base) ? base : `p-${base}`.slice(0, 56);
  let slug = first;
  for (let n = 2; taken.has(`${CUSTOM_PROVIDER_PREFIX}${slug}`); n++) slug = `${first}-${n}`;
  return `${CUSTOM_PROVIDER_PREFIX}${slug}`;
}

/** All provider IDs that appear in the view. */
export function knownProviderIds(view: ModelCapabilitiesView): Set<string> {
  return new Set(ONLINE_CAPABILITIES.flatMap((c) => view[c].providers.map((p) => p.providerId)));
}

export interface CustomProviderDraft {
  name: string;
  url: string;
  modelId: string;
  capability: OnlineCapability;
  voiceIds: string;
}

/** Whether the add dialog can be submitted. */
export function customDraftReady(draft: CustomProviderDraft): boolean {
  return draft.name.trim() !== '' && draft.modelId.trim() !== '' && isEndpointUrl(draft.url);
}

/**
 * Add custom provider: only the name, address and first model are registered; it is not enabled — it is enabled only after connecting (entering a key or leaving it empty, and verifying),
 * consistent with the design's “添加后连接密钥并测试模型” (after adding, connect the key and test the model).
 */
export function customProviderRequest(view: ModelCapabilitiesView, draft: CustomProviderDraft): ConfigureProviderRequest {
  return {
    providerId: customProviderId(draft.name, draft.url, knownProviderIds(view)),
    label: draft.name.trim(),
    endpoint: draft.url.trim().replace(/\/+$/, ''),
    models: [newDeclaredModel(draft.modelId, draft.capability, draft.voiceIds)],
  };
}

// ---- Keys ----

/** Save key: enables and verifies once (a read-only request; if verification fails, nothing is saved). A custom provider may leave the key empty and only enable and verify the address. */
export function connectRequest(providerId: string, key: string): ConfigureProviderRequest {
  const credential = key.trim();
  return { providerId, enabled: true, verify: true, ...(credential ? { credential } : {}) };
}

/** Built-in provider “移除密钥” (remove key): clears the key and disables the provider. Defaults that point to it are kept by the Runtime and reported as unavailable. */
export function disconnectRequest(providerId: string): ConfigureProviderRequest {
  return { providerId, enabled: false, credential: null };
}

// ---- Default models ----

/** Picker key: `providerId/modelId` (providerId contains no `/`, while modelId may); defaults to `none` when there is none. */
export const NO_DEFAULT = 'none';

export function defaultKey(ref: ModelRef | null): string {
  return ref ? `${ref.providerId}/${ref.modelId}` : NO_DEFAULT;
}

export function parseDefaultKey(key: string): ModelRef | null {
  if (key === NO_DEFAULT) return null;
  const at = key.indexOf('/');
  return at > 0 ? { providerId: key.slice(0, at), modelId: key.slice(at + 1) } : null;
}

export interface DefaultOption {
  key: string;
  label: string;
  description?: string;
}

export interface DefaultSection {
  key: string;
  /** Group heading (provider name); the group “每次选择” (choose each time) has none. */
  title?: string;
  items: DefaultOption[];
}

export interface CodexDefaultState {
  /** `agent:codex` can draw right now. */
  ready: boolean;
  /** One-sentence reason when it cannot draw. */
  why: string | null;
}

export interface CloudDefaultPicker {
  selectedKey: string;
  sections: DefaultSection[];
  /** There are no cloud models to choose from (only “每次选择” (choose each time) is left). */
  empty: boolean;
}

/** Providers on this machine or on a LAN node (not in the cloud page's menu). When not found in the view (for example, a deleted custom provider), it is judged by ID. */
export function isLocalProvider(view: ModelCapabilitiesView, capability: OnlineCapability, providerId: string): boolean {
  const kind = view[capability].providers.find((p) => p.providerId === providerId)?.kind;
  return kind ? kind === 'local' || kind === 'node' : providerId === 'local' || providerId.startsWith('node:');
}

/** Display name of the current default: when the model can be found, use the provider name + model ID. */
function refLabel(view: ModelCapabilitiesView, capability: OnlineCapability, ref: ModelRef): string {
  const provider = view[capability].providers.find((p) => p.providerId === ref.providerId);
  return `${provider?.label ?? ref.providerId} · ${ref.modelId}`;
}

/**
 * Default model menu on the cloud page: the first item is “不设默认” (no default), then one group per usable online provider; the image tier adds one more item, “Codex CLI · 画图” (Codex CLI · draw images), when Codex can draw or it is already the default.
 * When the provider that the current default points to is unavailable, it is still listed, checked, and marked “不可用” (unavailable) — the Runtime keeps it, and it is not cleared for the user here.
 *
 * Each capability has only one default, shared by the local page and the cloud page. When the speech recognition default is a model on this machine or a node, the cloud page checks “用本地模型” (use local model), and choosing it does not change the default.
 * Other capabilities have no factory default: when the default is a model on this machine or a node, it is listed as its own item and checked (noting it was set on the local models page); only “每次选择” (choose each time) actually clears the default.
 */
export function cloudDefaultPicker(
  view: ModelCapabilitiesView,
  capability: OnlineCapability,
  codex: CodexDefaultState | null,
  copy: { none: string; noneDesc: string; codex: string; codexDesc: string; unavailable: string; localDesc?: string },
): CloudDefaultPicker {
  const current = view[capability].default;
  const local = !!current && isLocalProvider(view, capability, current.providerId);
  const selectedKey = current && (!local || capability !== 'transcribe') ? defaultKey(current) : NO_DEFAULT;
  // Groups and options live in the same collection, so a group's key must not equal any option's key (`none` once collided with NO_DEFAULT and the whole menu crashed).
  const sections: DefaultSection[] = [{ key: 'no-default', items: [{ key: NO_DEFAULT, label: copy.none, description: copy.noneDesc }] }];
  let listedCurrent = selectedKey === NO_DEFAULT;
  if (current && local && capability !== 'transcribe') {
    const provider = view[capability].providers.find((p) => p.providerId === current.providerId);
    const model = provider?.models.find((m) => m.modelId === current.modelId);
    const label = `${provider?.label ?? current.providerId} · ${model?.label ?? current.modelId}`;
    sections.push({ key: 'local-default', items: [{ key: selectedKey, label, ...(copy.localDesc ? { description: copy.localDesc } : {}) }] });
    listedCurrent = true;
  }
  for (const p of onlineProviders(view, capability)) {
    if (!p.available || !p.models.length) continue;
    const items = p.models.map((m) => ({ key: defaultKey({ providerId: p.providerId, modelId: m.modelId }), label: m.modelId }));
    if (items.some((i) => i.key === selectedKey)) listedCurrent = true;
    sections.push({ key: p.providerId, title: p.label, items });
  }
  const empty = sections.length === 1;
  if (capability === 'generateImage' && codex) {
    const codexKey = defaultKey({ providerId: `${AGENT_PROVIDER_PREFIX}codex`, modelId: 'image-gen' });
    const isDefault = selectedKey === codexKey;
    if (codex.ready || isDefault) {
      sections.push({
        key: 'codex',
        items: [
          {
            key: codexKey,
            label: codex.ready ? copy.codex : M.unavailableItem(copy.codex, copy.unavailable),
            description: codex.ready ? copy.codexDesc : (codex.why ?? undefined),
          },
        ],
      });
      if (isDefault) listedCurrent = true;
    }
  }
  if (!listedCurrent && current) {
    sections.push({ key: 'current', items: [{ key: selectedKey, label: M.unavailableItem(refLabel(view, capability, current), copy.unavailable) }] });
  }
  return { selectedKey, sections, empty: empty && !(capability === 'generateImage' && codex?.ready) };
}
