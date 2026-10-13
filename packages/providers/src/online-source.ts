import {
  CREDENTIAL_UNAVAILABLE,
  modelDetail,
  ProviderFailure,
  type DescribeMode,
  type GenerationCapability,
  type GenerationProvider,
  type ModelServiceStore,
  type DiscoveredList,
  type ProviderQueue,
  type ProviderSource,
  type StoredAccount,
  type TextProvider,
  type TranscribeProvider,
  type UsageLedger,
} from '@cuccut/models';
import {
  RpcError,
  type AddProviderAccountRequest,
  type ArrangeProviderAccountsRequest,
  type ConfigureProviderRequest,
  type Localized,
  type ModelInfoBase,
  type ModelServiceCapability,
  type ProviderCapabilities,
  type ProviderCapability,
  type ProviderRefreshStatus,
  type ProviderUnavailableReason,
  type ProviderView,
  type ProviderVendorInfo,
  type SpeechModelInfo,
  type UpdateProviderAccountRequest,
  type UsageRecord,
} from '@cuccut/protocol';
import type {
  AdapterConfig,
  AdapterHttp,
  ImageAdapter,
  ModelLister,
  SpeechAdapter,
  TextAdapter,
  TranscribeAdapter,
  VoiceCloneAdapter,
} from './adapter.ts';
import { ANTHROPIC_DEFAULT_BASE_URL, AnthropicTextAdapter } from './anthropic/anthropic-text.ts';
import type { FfmpegResolver } from './audio/audio-prep.ts';
import { ELEVENLABS_DEFAULT_BASE_URL, ElevenLabsAdapter } from './elevenlabs/elevenlabs-adapter.ts';
import { ElevenLabsVoiceCloneAdapter } from './elevenlabs/elevenlabs-voice-clone.ts';
import { GOOGLE_DEFAULT_BASE_URL, GoogleAdapter } from './google/google-adapter.ts';
import { GoogleImageAdapter } from './google/google-image.ts';
import { GoogleTextAdapter } from './google/google-text.ts';
import { redact } from './http/provider-fetch.ts';
import { OnlineGenerator } from './online-generator.ts';
import { OnlineTextProvider } from './online-text.ts';
import { OnlineTranscriber } from './online-transcriber.ts';
import { CompatibleAdapter, declaredOf } from './openai-compatible/compatible-adapter.ts';
import { CompatibleImageAdapter, CompatibleSpeechAdapter } from './openai-compatible/compatible-media.ts';
import { CompatibleTextAdapter } from './openai-compatible/compatible-text.ts';
import { VendorTextAdapter } from './openai-compatible/vendor-text.ts';
import { OPENAI_DEFAULT_BASE_URL, OpenAiAdapter } from './openai/openai-adapter.ts';
import { OpenAiImageAdapter, OpenAiSpeechAdapter } from './openai/openai-media-adapters.ts';
import { OpenAiTextAdapter } from './openai/openai-text.ts';
import { accountStatusOf, usageErrorOf, type CallReporter } from './usage-reporter.ts';
import { COMPAT_VENDOR_IDS, COMPAT_VENDORS, type CompatVendorId } from './vendor-catalog.ts';
import { ProvidersConfig as PC, ProvidersHttp as PH } from '@cuccut/protocol/messages/providers';

/**
 * Online provider sources (architecture design §6.4): the built-in providers from the provider catalog, and the OpenAI-compatible endpoints `custom:<slug>` that users add.
 *
 * - Capabilities: `openai` has transcribe, synthesizeSpeech, generateImage and generateText; `google` has transcribe, generateImage and
 *   generateText; `elevenlabs` has only synthesizeSpeech; `anthropic` (the native Messages adapter) and the compatible text providers in the catalog
 *   (`vendor-catalog.ts`) have only generateText (capabilities the catalog marks P1 are not reported). Custom endpoints provide the capability declared by each model's `capability`
 *   (if no model is declared, only transcribe is listed).
 * - Accounts (§6.8): a call uses the first enabled account that has a key; an account failure does not switch accounts. At the end of a call, one usage entry is written (§6.10) and that
 *   account's status is recorded according to the result. Base URL: the account's override takes precedence, then the provider's endpoint, and finally the catalog preset (for providers with international and China base URLs, chosen by the account's `region`).
 * - `refresh()` (`models.refreshProvider`) fetches the model (and voice) list from the provider and records it in the configuration. The fetched list is used only to annotate built-in models:
 *   models not on the list are reported as unavailable (`unsupported`), and voices on the account are added to speech models without preset voices; if the fetch fails, the built-in list is used as before and this is noted.
 * - Available = the user has enabled it (enabling is a standing authorization, §6.2) and it has a key; the key is optional for custom endpoints, but that capability must declare a model.
 * - Configuration and keys live in `ModelServiceStore`. The view here reports only whether a key exists and never echoes it. Keys are fetched from the credential store only at execution time;
 *   when the credential store is unavailable, the provider reports as unavailable (`missing-credential`, with the reason in `detail`) and does not fall back to other storage.
 * - One queue per provider (shared across capabilities), running 2 tasks at a time by default; `generateText` has its own concurrency limit (a capability parameter, §6.8).
 * - Neither selection nor execution touches the network; only `models.configure` with `verify: true` and `models.refreshProvider` send read-only requests to the provider.
 */

export interface OnlineSourceOptions {
  store: ModelServiceStore;
  ffmpeg: FfmpegResolver;
  /** Overrides the default base URL of built-in providers (tests point it at a local fake service). An endpoint the user overrides in configuration takes precedence. */
  baseUrls?: Partial<Record<BuiltinId, string>>;
  /** Number of tasks each provider runs at once (default 2). */
  concurrency?: number;
  /** Request tuning options (tests inject shorter backoffs). */
  http?: AdapterHttp;
  /** Usage ledger (§6.10); when not provided, no usage is recorded (account status is still recorded). */
  usage?: UsageLedger;
}

type BuiltinId = 'openai' | 'google' | 'elevenlabs' | 'anthropic' | CompatVendorId;

/** Voice cloning on a provider (`voiceCloner()`): the key is fetched at execution time and does not pass through the caller. */
export interface VoiceCloner {
  providerId: string;
  label: string;
  /** Adapter version (recorded in the task's warnings and logs). */
  version: string;
  /** Currently enabled and has a key. */
  available(): boolean;
  create(input: {
    name: string;
    file: string;
    fileName: string;
    mediaType: string;
    description: string | null;
    signal: AbortSignal;
  }): Promise<{ voiceId: string }>;
  remove(voiceId: string, signal: AbortSignal): Promise<'deleted' | 'not-found'>;
}

/** Sends one read-only request to the provider with this configuration (`models.configure` with `verify: true`). */
interface CredentialValidator {
  validateCredential(config: AdapterConfig, signal: AbortSignal, http: AdapterHttp): Promise<void>;
}

/** Adapters for a provider's capabilities; null when it lacks that capability. */
interface AdapterSet {
  transcribe: TranscribeAdapter | null;
  speech: SpeechAdapter | null;
  image: ImageAdapter | null;
  text: TextAdapter | null;
  validator: CredentialValidator;
  /** Used by `models.refreshProvider`: lists the provider's models (and voices). */
  lister: ModelLister;
  /** Voice cloning (§5.9): only providers that actually offer a cloning API have it. */
  clone?: VoiceCloneAdapter;
}

interface BuiltinEntry {
  label: string;
  /** Default base URL (for providers with regions, the first region's). */
  baseUrl: string;
  /** Region → base URL (only providers with international and China base URLs have this). */
  regions?: Record<string, string>;
  vendor: ProviderVendorInfo;
  adapters: () => AdapterSet;
}

function compatEntry(id: CompatVendorId): BuiltinEntry {
  const entry = COMPAT_VENDORS[id];
  const regions = Object.keys(entry.regions);
  return {
    // Taken at read time: the name follows the UI language.
    get label() {
      return entry.label;
    },
    baseUrl: entry.regions[regions[0]!]!,
    ...(regions.length > 1 ? { regions: { ...entry.regions } } : {}),
    vendor: { ...entry.vendor },
    adapters: () => {
      const text = new VendorTextAdapter(entry);
      return { transcribe: null, speech: null, image: null, text, validator: text, lister: text };
    },
  };
}

const BUILTINS: Record<BuiltinId, BuiltinEntry> = {
  openai: {
    label: 'OpenAI',
    baseUrl: OPENAI_DEFAULT_BASE_URL,
    vendor: { kind: 'vendor', website: 'https://platform.openai.com', icon: 'openai' },
    adapters: () => {
      const transcribe = new OpenAiAdapter();
      const text = new OpenAiTextAdapter();
      return {
        transcribe,
        speech: new OpenAiSpeechAdapter(),
        image: new OpenAiImageAdapter(),
        text,
        validator: transcribe,
        lister: text,
      };
    },
  },
  google: {
    label: 'Google Gemini',
    baseUrl: GOOGLE_DEFAULT_BASE_URL,
    vendor: { kind: 'vendor', website: 'https://aistudio.google.com', icon: 'google' },
    adapters: () => {
      const transcribe = new GoogleAdapter();
      const text = new GoogleTextAdapter();
      return { transcribe, speech: null, image: new GoogleImageAdapter(), text, validator: transcribe, lister: text };
    },
  },
  elevenlabs: {
    label: 'ElevenLabs',
    baseUrl: ELEVENLABS_DEFAULT_BASE_URL,
    vendor: { kind: 'vendor', website: 'https://elevenlabs.io', icon: 'elevenlabs' },
    adapters: () => {
      const speech = new ElevenLabsAdapter();
      return {
        transcribe: null,
        speech,
        image: null,
        text: null,
        validator: speech,
        lister: speech,
        clone: new ElevenLabsVoiceCloneAdapter(),
      };
    },
  },
  anthropic: {
    label: 'Anthropic',
    baseUrl: ANTHROPIC_DEFAULT_BASE_URL,
    vendor: { kind: 'vendor', website: 'https://platform.claude.com', icon: 'anthropic' },
    adapters: () => {
      const text = new AnthropicTextAdapter();
      return { transcribe: null, speech: null, image: null, text, validator: text, lister: text };
    },
  },
  ...(Object.fromEntries(COMPAT_VENDOR_IDS.map((id) => [id, compatEntry(id)])) as Record<CompatVendorId, BuiltinEntry>),
};

export const CUSTOM_PREFIX = 'custom:';
export const CUSTOM_SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;
const VERIFY_TIMEOUT_MS = 20_000;
const REFRESH_TIMEOUT_MS = 30_000;

export class OnlineProviderSource implements ProviderSource {
  readonly kind = 'online' as const;
  readonly #options: OnlineSourceOptions;
  readonly #store: ModelServiceStore;
  readonly #adapters = new Map<string, AdapterSet>();
  readonly #transcribers = new Map<string, OnlineTranscriber>();
  readonly #generators = new Map<string, OnlineGenerator>();
  readonly #texts = new Map<string, OnlineTextProvider>();

  constructor(options: OnlineSourceOptions) {
    this.#options = options;
    this.#store = options.store;
  }

  owns(providerId: string): boolean {
    return isBuiltin(providerId) || providerId.startsWith(CUSTOM_PREFIX);
  }

  resolve(providerId: string): string | null {
    if (isBuiltin(providerId)) return providerId;
    return providerId.startsWith(CUSTOM_PREFIX) && this.#store.provider(providerId) ? providerId : null;
  }

  async list(_mode: DescribeMode): Promise<ProviderView[]> {
    const custom = this.#store
      .providerIds()
      .filter((id) => id.startsWith(CUSTOM_PREFIX))
      .sort();
    return [...Object.keys(BUILTINS), ...custom].map((id) => this.#describe(id)!);
  }

  async describe(providerId: string, _mode: DescribeMode): Promise<ProviderView | null> {
    return this.resolve(providerId) ? this.#describe(providerId) : null;
  }

  transcriber(providerId: string): TranscribeProvider | null {
    if (!this.resolve(providerId)) return null;
    const adapter = this.#adapterSet(providerId).transcribe;
    if (!adapter) return null;
    let transcriber = this.#transcribers.get(providerId);
    if (!transcriber) {
      transcriber = new OnlineTranscriber({
        providerId,
        label: this.#label(providerId),
        adapter,
        // Re-read the configuration at execution time: if it was disabled or its key deleted while queued, no request is sent.
        config: async () => (this.#availability(providerId, 'transcribe').available ? this.#config(providerId) : null),
        report: this.#reporter(providerId),
        ffmpeg: this.#options.ffmpeg,
        ...(this.#options.http ? { http: this.#options.http } : {}),
      });
      this.#transcribers.set(providerId, transcriber);
    }
    return transcriber;
  }

  textProvider(providerId: string): TextProvider | null {
    if (!this.resolve(providerId)) return null;
    const adapter = this.#adapterSet(providerId).text;
    if (!adapter) return null;
    let provider = this.#texts.get(providerId);
    if (!provider) {
      provider = new OnlineTextProvider({
        providerId,
        label: () => this.#label(providerId),
        adapter,
        // Re-read the configuration at execution time: if it was disabled or its key deleted while queued, no request is sent.
        config: async () => (this.#availability(providerId, 'generateText').available ? this.#config(providerId) : null),
        report: this.#reporter(providerId),
        ...(this.#options.http ? { http: this.#options.http } : {}),
      });
      this.#texts.set(providerId, provider);
    }
    return provider;
  }

  generator(providerId: string, capability: GenerationCapability): GenerationProvider | null {
    if (!this.resolve(providerId)) return null;
    // The text generation task executor is assembled by ModelServices with `textProvider()` (sharing the concurrency limit with in-process calls).
    if (capability === 'generateText') return null;
    const adapters = this.#adapterSet(providerId);
    if (!(capability === 'synthesizeSpeech' ? adapters.speech : adapters.image)) return null;
    let generator = this.#generators.get(providerId);
    if (!generator) {
      generator = new OnlineGenerator({
        providerId,
        label: () => this.#label(providerId),
        speech: adapters.speech,
        image: adapters.image,
        // Re-read the configuration at execution time: if it was disabled or its key deleted while queued, no request is sent.
        config: async () => (this.#availability(providerId).available ? this.#config(providerId) : null),
        report: this.#reporter(providerId),
        ...(this.#options.http ? { http: this.#options.http } : {}),
      });
      this.#generators.set(providerId, generator);
    }
    return generator;
  }

  /**
   * Voice cloning for a provider (§5.9): providers without a cloning API (`openai`, `google`, custom endpoints) return null.
   * Re-reads the configuration at execution time: if it is not enabled or has no key, it fails with `unavailable` and sends no request.
   */
  voiceCloner(providerId: string): VoiceCloner | null {
    if (!this.resolve(providerId)) return null;
    const adapter = this.#adapterSet(providerId).clone;
    if (!adapter) return null;
    const http = this.#options.http ?? {};
    const config = async () => {
      const availability = this.#availability(providerId);
      if (!availability.available) {
        throw new ProviderFailure('unavailable', PC.unavailableNow({ label: this.#label(providerId), detail: availability.detail ?? PC.notEnabled() }).text, {
          code: 'CAPABILITY_NOT_CONFIGURED',
          providerId,
        });
      }
      return this.#config(providerId);
    };
    return {
      providerId,
      label: this.#label(providerId),
      version: adapter.version,
      available: () => this.#availability(providerId).available,
      create: async (input) => adapter.createVoiceClone({ ...input, config: await config(), http }),
      remove: async (voiceId, signal) => adapter.deleteVoiceClone({ voiceId, signal, config: await config(), http }),
    };
  }

  generators(): GenerationProvider[] {
    return [...this.#generators.values()];
  }

  queue(providerId: string, _modelId: string): ProviderQueue {
    return { key: providerId, concurrency: this.#options.concurrency ?? 2 };
  }

  executors(): TranscribeProvider[] {
    return [...this.#transcribers.values()];
  }

  async configure(request: ConfigureProviderRequest): Promise<void> {
    const id = request.providerId;
    const custom = id.startsWith(CUSTOM_PREFIX);
    if (custom && !CUSTOM_SLUG.test(id.slice(CUSTOM_PREFIX.length))) {
      throw new RpcError('invalid-request', PC.customIdFormat());
    }
    if (!custom && !isBuiltin(id)) throw new RpcError('not-found', PC.providerNotFound({ id }));
    if (!custom && (request.models !== undefined || request.label !== undefined)) {
      throw new RpcError('invalid-request', PC.onlyCustomDeclares());
    }
    const stored = this.#store.provider(id);
    if (custom && !stored && !request.endpoint) throw new RpcError('invalid-request', PC.customNeedsEndpoint());
    if (custom && request.endpoint === null) throw new RpcError('invalid-request', PC.customEndpointRequired());
    if (request.models) {
      const ids = request.models.map((m) => m.modelId);
      if (new Set(ids).size !== ids.length) throw new RpcError('invalid-request', PC.duplicateModelIds());
    }

    if (request.verify) {
      // When no new key is given, the saved one is verified (the first enabled account with a key). A new key is not saved yet, so the account recorded for usage is null.
      const saved = request.credential === undefined ? await this.#storedCredential(id) : null;
      const credential = request.credential === undefined ? (saved?.secret ?? null) : request.credential;
      if (!custom && !credential) throw new RpcError('invalid-request', PC.noKeyToVerify());
      const endpoint = request.endpoint === undefined ? stored?.endpoint : (request.endpoint ?? undefined);
      const account = saved ? stored?.accounts.find((a) => a.accountId === saved.accountId) : (stored?.accounts[0] ?? undefined);
      await this.#verify(
        {
          providerId: id,
          baseUrl: this.#baseUrl(id, endpoint, account),
          credential: credential ?? null,
          accountId: saved?.accountId ?? null,
          declared: request.models ?? stored?.models ?? [],
        },
        Boolean(saved),
      );
    }

    await this.#store.updateProvider(id, {
      ...(request.enabled !== undefined ? { enabled: request.enabled } : {}),
      ...(request.credential !== undefined ? { credential: request.credential } : {}),
      ...(request.endpoint !== undefined ? { endpoint: request.endpoint } : {}),
      ...(request.label !== undefined ? { label: request.label } : {}),
      ...(request.models !== undefined ? { models: request.models } : {}),
    });
  }

  /** `models.addAccount` (§6.8): appends the account at the end; with `verify`, the new key is checked first, and nothing is saved if it fails. */
  async addAccount(request: AddProviderAccountRequest): Promise<void> {
    const id = this.#accountProvider(request.providerId);
    this.#checkRegion(id, request.region);
    const stored = this.#store.provider(id);
    if (request.verify) {
      await this.#verify(
        {
          providerId: id,
          baseUrl: this.#baseUrl(id, stored?.endpoint, request),
          credential: request.credential,
          accountId: null,
          declared: stored?.models ?? [],
        },
        false,
      );
    }
    const accountId = await this.#store.addAccount(id, {
      credential: request.credential,
      ...(request.label !== undefined ? { label: request.label } : {}),
      ...(request.region !== undefined ? { region: request.region } : {}),
      ...(request.endpoint !== undefined ? { endpoint: request.endpoint } : {}),
    });
    if (request.verify) {
      const at = new Date().toISOString();
      this.#store.recordAccountResult(id, accountId, at, { state: 'ok', at });
    }
  }

  /**
   * `models.updateAccount` (§6.8). With `verify`, verification happens first: if the key was changed, the new key is verified (not yet saved); if not, the account's saved key is verified. The updated region and endpoint are used. Nothing is saved if it fails.
   */
  async updateAccount(request: UpdateProviderAccountRequest): Promise<void> {
    const id = this.#accountProvider(request.providerId);
    const stored = this.#store.provider(id);
    const account = stored?.accounts.find((a) => a.accountId === request.accountId);
    if (!account) {
      throw new RpcError('not-found', PC.accountNotFound({ provider: id, account: request.accountId }), {
        code: 'ACCOUNT_NOT_FOUND',
        providerId: id,
        accountId: request.accountId,
      });
    }
    if (request.region !== undefined && request.region !== null) this.#checkRegion(id, request.region);
    if (request.verify) {
      const credential = request.credential ?? (await this.#accountSecret(id, account.accountId));
      if (!credential) throw new RpcError('invalid-request', PC.accountNoKeyToVerify());
      const next = {
        ...(request.region === undefined ? (account.region ? { region: account.region } : {}) : request.region ? { region: request.region } : {}),
        ...(request.endpoint === undefined
          ? account.endpoint
            ? { endpoint: account.endpoint }
            : {}
          : request.endpoint
            ? { endpoint: request.endpoint }
            : {}),
      };
      await this.#verify(
        {
          providerId: id,
          baseUrl: this.#baseUrl(id, stored?.endpoint, next),
          credential,
          accountId: account.accountId,
          declared: stored?.models ?? [],
        },
        request.credential === undefined,
      );
    }
    await this.#store.updateAccount(id, account.accountId, {
      ...(request.label !== undefined ? { label: request.label } : {}),
      ...(request.credential !== undefined ? { credential: request.credential } : {}),
      ...(request.enabled !== undefined ? { enabled: request.enabled } : {}),
      ...(request.region !== undefined ? { region: request.region } : {}),
      ...(request.endpoint !== undefined ? { endpoint: request.endpoint } : {}),
    });
    if (request.verify && request.credential !== undefined) {
      const at = new Date().toISOString();
      this.#store.recordAccountResult(id, account.accountId, at, { state: 'ok', at });
    }
  }

  async removeAccount(providerId: string, accountId: string): Promise<void> {
    await this.#store.removeAccount(this.#accountProvider(providerId), accountId);
  }

  async arrangeAccounts(request: ArrangeProviderAccountsRequest): Promise<void> {
    await this.#store.arrangeAccounts(this.#accountProvider(request.providerId), request.order);
  }

  async refresh(providerId: string): Promise<ProviderRefreshStatus> {
    const id = this.resolve(providerId);
    if (!id) throw new RpcError('not-found', PC.providerNotFound({ id: providerId }));
    const stored = this.#store.provider(id);
    if (id.startsWith(CUSTOM_PREFIX) && !stored?.endpoint) throw new RpcError('invalid-request', PC.customNoEndpoint());
    if (!id.startsWith(CUSTOM_PREFIX) && !this.#store.hasCredential(id) && !this.#store.credentialProblem(id)) {
      throw new RpcError('invalid-request', PC.noKeySet({ label: this.#label(id) }));
    }
    const at = new Date().toISOString();
    let discovered: DiscoveredList;
    let secret: string | null = null;
    try {
      const config = await this.#config(id);
      secret = config.credential;
      const http = this.#options.http ?? {};
      const listing = await this.#adapterSet(id).lister.listModels(config, AbortSignal.timeout(REFRESH_TIMEOUT_MS), http);
      discovered = { at, ok: true, models: listing.models, ...(listing.voices ? { voices: listing.voices } : {}) };
    } catch (error) {
      // The text of a `ProviderFailure` has already had keys removed; other errors get the same treatment.
      const message = error instanceof Error ? error.message : String(error);
      discovered = { at, ok: false, error: redact(message, secret ? [secret] : []).slice(0, 500) };
    }
    return this.#store.setDiscovered(id, discovered);
  }

  /**
   * Remove a provider (§6.8): for a custom endpoint, the whole configuration is deleted. For a provider from the catalog, its configuration is deleted (disabled) along with all account credentials, returning it to the not-added state. If it was never configured, nothing is done. Default values that point to it are kept.
   */
  async remove(providerId: string): Promise<boolean> {
    if (!this.owns(providerId)) return false;
    // Executors and adapters are kept: each time, they read the endpoint, key and name from the configuration. Once it is deleted, the configuration can no longer be read, and queued tasks stop sending requests.
    const removed = await this.#store.removeProvider(providerId);
    return removed || isBuiltin(providerId);
  }

  #describe(providerId: string): ProviderView {
    const config = this.#settings(providerId);
    const adapters = this.#adapterSet(providerId);
    const custom = providerId.startsWith(CUSTOM_PREFIX);
    const capabilities: ProviderCapabilities = {};
    const offer = <M extends ProviderCapability['models'][number]>(
      capability: ModelServiceCapability,
      models: M[],
    ): ProviderCapability<M> => {
      const { available, reason, detail } = this.#availability(providerId, capability);
      return { models, available, ...(reason ? { unavailableReason: reason } : {}), ...(detail ? modelDetail(detail) : {}) };
    };
    // Custom endpoints list only capabilities that have declared models; if no model is declared, transcribe is listed (awaiting a declaration).
    const declares = (capability: ModelServiceCapability) =>
      !custom || declaredOf(config, capability).length > 0 || (capability === 'transcribe' && config.declared.length === 0);
    if (adapters.transcribe && declares('transcribe')) capabilities.transcribe = offer('transcribe', adapters.transcribe.models(config));
    if (adapters.speech && declares('synthesizeSpeech')) {
      capabilities.synthesizeSpeech = offer('synthesizeSpeech', adapters.speech.models(config));
    }
    if (adapters.image && declares('generateImage')) capabilities.generateImage = offer('generateImage', adapters.image.models(config));
    if (adapters.text && declares('generateText')) capabilities.generateText = offer('generateText', adapters.text.models(config));
    const discovered = this.#store.provider(providerId)?.discovered;
    if (discovered?.ok) for (const cap of Object.values(capabilities)) annotate(cap.models, discovered);
    return {
      providerId,
      kind: 'online',
      label: this.#label(providerId),
      vendor: isBuiltin(providerId) ? structuredClone(BUILTINS[providerId].vendor) : { kind: 'custom' },
      config: this.#store.configView(providerId),
      capabilities,
    };
  }

  /** When no `capability` is given, only enabled state, endpoint and key are checked (used at execution time: whether a model is declared is checked by the executor against the frozen model). */
  #availability(
    providerId: string,
    capability?: ModelServiceCapability,
  ): { available: boolean; reason?: ProviderUnavailableReason; detail?: Localized } {
    const stored = this.#store.provider(providerId);
    if (!stored?.enabled) return { available: false, reason: 'not-configured', detail: PC.notEnabled() };
    const problem = this.#store.credentialProblem(providerId);
    if (problem) return { available: false, reason: 'missing-credential', detail: PC.credentialUnavailable({ problem }) };
    if (providerId.startsWith(CUSTOM_PREFIX)) {
      if (!stored.endpoint) return { available: false, reason: 'not-configured', detail: PC.noEndpointSet() };
      const declared = stored.models ?? [];
      const missing = capability ? !declared.some((m) => (m.capability ?? 'transcribe') === capability) : declared.length === 0;
      if (missing) return { available: false, reason: 'not-configured', detail: PC.noModelsDeclared() };
      return { available: true };
    }
    if (!this.#store.hasCredential(providerId)) return { available: false, reason: 'missing-credential', detail: PC.noKey() };
    return { available: true };
  }

  /** Configuration without the key, used for descriptions and model listing (the base URL follows the first enabled account that has a key). */
  #settings(providerId: string): AdapterConfig {
    const stored = this.#store.provider(providerId);
    return {
      providerId,
      baseUrl: this.#baseUrl(providerId, stored?.endpoint, this.#store.activeAccount(providerId) ?? undefined),
      credential: null,
      declared: stored?.models ?? [],
    };
  }

  /** Configuration for execution: uses the key of the first enabled account that has one (§6.8). If none can be obtained, it fails with `unavailable`, and the reason does not include the key. */
  async #config(providerId: string): Promise<AdapterConfig> {
    let resolved: { accountId: string; secret: string } | null;
    try {
      resolved = await this.#store.resolveCredential(providerId);
    } catch {
      const reason = this.#store.credentialProblem(providerId) ?? PC.keyUnreadable().text;
      throw new ProviderFailure('unavailable', PC.labelCredentialUnavailable({ label: this.#label(providerId), problem: reason }).text, { providerId });
    }
    const stored = this.#store.provider(providerId);
    const account = resolved ? stored?.accounts.find((a) => a.accountId === resolved.accountId) : undefined;
    return {
      providerId,
      baseUrl: this.#baseUrl(providerId, stored?.endpoint, account),
      credential: resolved?.secret ?? null,
      accountId: resolved?.accountId ?? null,
      declared: stored?.models ?? [],
    };
  }

  /** `verify` uses the saved key when no new key is given; if the credential store is unavailable, it is rejected with `conflict` (`CREDENTIAL_UNAVAILABLE`). */
  async #storedCredential(providerId: string): Promise<{ accountId: string; secret: string } | null> {
    try {
      return await this.#store.resolveCredential(providerId);
    } catch {
      const reason = this.#store.credentialProblem(providerId) ?? PC.keyUnreadable().text;
      throw new RpcError('conflict', PC.credentialUnavailable({ problem: reason }), { code: CREDENTIAL_UNAVAILABLE, providerId });
    }
  }

  /** An account's saved key (for verification); if the credential store is unavailable, it is rejected with `conflict` (`CREDENTIAL_UNAVAILABLE`). */
  async #accountSecret(providerId: string, accountId: string): Promise<string | null> {
    try {
      return await this.#store.accountCredential(providerId, accountId);
    } catch {
      const reason = this.#store.credentialProblem(providerId) ?? PC.keyUnreadable().text;
      throw new RpcError('conflict', PC.credentialUnavailable({ problem: reason }), { code: CREDENTIAL_UNAVAILABLE, providerId });
    }
  }

  /**
   * Connectivity test (§6.8): sends one read-only request (listing models) to the provider with this configuration. Writes one usage entry (`verify`, with empty usage and no cost). When verifying the saved key (`saved`), records the account's status according to the result. On failure, it is rejected with `conflict`, and `details.code` is `PROVIDER_*`.
   */
  async #verify(config: AdapterConfig, saved: boolean): Promise<void> {
    const startedAt = Date.now();
    let failure: unknown;
    try {
      await this.#adapterSet(config.providerId).validator.validateCredential(
        config,
        AbortSignal.timeout(VERIFY_TIMEOUT_MS),
        this.#options.http ?? {},
      );
    } catch (error) {
      failure = error;
    }
    const at = new Date().toISOString();
    this.#record({
      at,
      providerId: config.providerId,
      accountId: config.accountId ?? null,
      capability: null,
      modelId: null,
      source: 'verify',
      units: {},
      cost: { kind: 'unknown' },
      durationMs: Date.now() - startedAt,
      status: failure === undefined ? 'ok' : 'error',
      ...(failure !== undefined ? { error: usageErrorOf(failure) } : {}),
    });
    if (saved && config.accountId) this.#store.recordAccountResult(config.providerId, config.accountId, at, accountStatusOf(failure, at));
    if (failure === undefined) return;
    if (failure instanceof ProviderFailure) {
      const code = typeof failure.details.code === 'string' ? failure.details.code : 'PROVIDER_REJECTED';
      // The text of a `ProviderFailure` has already had keys removed.
      throw new RpcError('conflict', PC.verifyFailed({ message: failure.message }), { code, providerId: config.providerId });
    }
    throw new RpcError('conflict', PC.verifyFailed({ message: PH.requestIncomplete() }), { code: 'PROVIDER_UNAVAILABLE', providerId: config.providerId });
  }

  /** Report from the executor at the end of a call: writes one usage entry and records the status of the account used according to the result (recording only; does not switch accounts, §6.2). */
  #reporter(providerId: string): CallReporter {
    return (report) => {
      const at = new Date().toISOString();
      this.#record({
        at,
        providerId,
        accountId: report.accountId,
        capability: report.capability,
        modelId: report.modelId,
        source: report.source,
        ...(report.ref ? { ref: report.ref } : {}),
        units: report.units,
        cost: report.cost ?? { kind: 'unknown' },
        durationMs: Math.max(0, Date.now() - report.startedAt),
        status: report.error === undefined ? 'ok' : 'error',
        ...(report.error !== undefined ? { error: usageErrorOf(report.error) } : {}),
      });
      if (report.accountId) this.#store.recordAccountResult(providerId, report.accountId, at, accountStatusOf(report.error, at));
    };
  }

  #record(record: UsageRecord): void {
    void this.#options.usage?.append(record);
  }

  /** Providers that support account methods: catalog providers or existing custom endpoints. */
  #accountProvider(providerId: string): string {
    if (isBuiltin(providerId)) return providerId;
    if (providerId.startsWith(CUSTOM_PREFIX)) {
      if (this.#store.provider(providerId)) return providerId;
      throw new RpcError('not-found', PC.providerNotFound({ id: providerId }));
    }
    throw new RpcError('invalid-request', PC.noAccounts({ id: providerId }));
  }

  /** `region` must be one of this catalog provider's regions; providers without regions do not accept `region`. */
  #checkRegion(providerId: string, region: string | undefined): void {
    if (region === undefined) return;
    const regions = isBuiltin(providerId) ? BUILTINS[providerId].regions : undefined;
    if (!regions || !Object.hasOwn(regions, region)) {
      throw new RpcError('invalid-request', PC.noRegion({ label: this.#label(providerId), region }), {
        regions: regions ? Object.keys(regions) : [],
      });
    }
  }

  /**
   * Base URL (§6.4): the account's override takes precedence, then the provider's endpoint, and finally the catalog preset. For providers with regions, the account's `region` is used (tests override the presets via `baseUrls`).
   */
  #baseUrl(providerId: string, endpoint: string | undefined, account?: Pick<StoredAccount, 'region' | 'endpoint'>): string {
    let preset = '';
    if (isBuiltin(providerId)) {
      const entry = BUILTINS[providerId];
      const regional = account?.region ? entry.regions?.[account.region] : undefined;
      preset = this.#options.baseUrls?.[providerId] ?? regional ?? entry.baseUrl;
    }
    const base = account?.endpoint ?? endpoint ?? preset;
    return base.replace(/\/+$/, '');
  }

  #label(providerId: string): string {
    if (isBuiltin(providerId)) return BUILTINS[providerId].label;
    return this.#store.provider(providerId)?.label ?? providerId.slice(CUSTOM_PREFIX.length);
  }

  #adapterSet(providerId: string): AdapterSet {
    let adapters = this.#adapters.get(providerId);
    if (!adapters) {
      if (isBuiltin(providerId)) {
        adapters = BUILTINS[providerId].adapters();
      } else {
        const label = () => this.#label(providerId);
        const transcribe = new CompatibleAdapter(label);
        const text = new CompatibleTextAdapter(label);
        adapters = {
          transcribe,
          speech: new CompatibleSpeechAdapter(label),
          image: new CompatibleImageAdapter(label),
          text,
          validator: transcribe,
          lister: text,
        };
      }
      this.#adapters.set(providerId, adapters);
    }
    return adapters;
  }
}

/**
 * Annotates models using the fetched list (modifies in place): models not in the list are reported as unavailable, and voices on the account are added to speech models that have no preset voices and accept custom voices.
 * Models that appear only in the list are not added, since their limits and features are not known here.
 */
function annotate(models: ModelInfoBase[], discovered: DiscoveredList): void {
  const listed = new Set(discovered.models ?? []);
  for (const model of models) {
    if (discovered.models && !listed.has(model.modelId) && model.available !== false) {
      Object.assign(model, {
        available: false,
        unavailableReason: 'unsupported',
        ...modelDetail(PC.notInVendorList({ at: discovered.at })),
      });
    }
    const speech = model as Partial<SpeechModelInfo>;
    if (discovered.voices && speech.voices?.length === 0 && speech.voiceModes?.includes('custom')) {
      speech.voices = discovered.voices.map((v) => ({ ...v }));
    }
  }
}

function isBuiltin(providerId: string): providerId is BuiltinId {
  return Object.hasOwn(BUILTINS, providerId);
}
