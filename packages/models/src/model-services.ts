import {
  DEFAULT_TEXT_CONCURRENCY,
  MODEL_SERVICE_CAPABILITIES,
  RpcError,
  type AddProviderAccountRequest,
  type ArrangeProviderAccountsRequest,
  type CapabilityView,
  type ConfigureProviderRequest,
  type ModelCapabilitiesView,
  type ModelRef,
  type ModelServiceCapability,
  type ProviderCapabilityView,
  type ProviderRefreshStatus,
  type ProviderView,
  type SetCapabilityParametersRequest,
  type TextCapabilityParameters,
  type UpdateProviderAccountRequest,
  type UsageReport,
  type UsageRequest,
} from '@cuccut/protocol';
import { ModelsModelServices as M } from '@cuccut/protocol/messages/models/model-services.ts';
import type { GenerationCapability, GenerationProvider } from './generation-provider.ts';
import type { ModelServiceStore } from './model-service-store.ts';
import { capabilityNotConfiguredError, effectiveChoice, hasFactoryDefault, selectModel, type ModelChoice } from './model-selection.ts';
import type { DescribeMode, ProviderQueue, ProviderSource } from './provider-source.ts';
import {
  createTextGenerator,
  TextJobGenerator,
  TextRunner,
  type TextCallStats,
  type TextGenerator,
  type TextSelection,
} from './text-generation.ts';
import type { TranscribeProvider } from './transcribe-provider.ts';
import type { UsageLedger } from './usage-ledger.ts';
import { buildUsageReport } from './usage-report.ts';

/**
 * Model services (architecture design §6.1, §6.2, §6.8): the entry point for the provider registry, configuration and selection.
 *
 * - `capabilities()` is the view for `models.capabilities` (it probes nodes); `view()` is the most recently computed view, which the `models` topic snapshot uses;
 * - After configuration or default changes, recompute the view (no network), and notify `onChange` if it differs from the last one;
 * - `selectTranscribe()` / `selectGeneration()` determine the provider and model at submission (the `select` method, no network), and hand over the executor and queue;
 * - The `generateText` task and in-process calls (`textGenerator()`) share one `TextRunner`: each provider's concurrency cap is taken from the capability parameter `concurrency`, and the task queue is ordered by it (queue key `<providerId>:generateText`, which does not compete for slots with speech or image tasks of the same provider).
 */

export interface ModelServicesOptions {
  store: ModelServiceStore;
  sources: ProviderSource[];
  /** Usage ledger (§6.10): `models.usage` reads it; when not given, it reports empty. */
  usage?: UsageLedger;
}

/** Target forms for `models.transcribe`: the new `provider` / `model` and the old `node` / `bundleId`. */
export interface TranscribeTarget {
  provider?: string;
  model?: string;
  node?: string;
  bundleId?: string;
}

export interface TranscribeSelection extends ModelChoice<'transcribe'> {
  /** Local and node model packages; null for online. */
  bundleId: string | null;
  transcriber: TranscribeProvider;
  queue: ProviderQueue;
}

/** Target forms for `models.synthesizeSpeech` / `models.generateImage`. */
export interface GenerationTarget {
  provider?: string;
  model?: string;
}

export interface GenerationSelection<C extends GenerationCapability = GenerationCapability> extends ModelChoice<C> {
  generator: GenerationProvider;
  queue: ProviderQueue;
  /** `generateText`: parameter default used at submission (reasoning effort). */
  textDefaults?: TextCapabilityParameters;
}

export class ModelServices {
  readonly store: ModelServiceStore;
  readonly #sources: ProviderSource[];
  readonly #usage: UsageLedger | null;
  readonly #listeners = new Set<(view: ModelCapabilitiesView) => void>();
  #view: ModelCapabilitiesView;
  #viewKey = '';
  readonly #textRunner: TextRunner;
  readonly #textJobs = new Map<string, TextJobGenerator>();
  #textGenerator: TextGenerator | null = null;

  constructor(options: ModelServicesOptions) {
    this.store = options.store;
    this.#sources = options.sources;
    this.#usage = options.usage ?? null;
    // When account state (the result of the most recent call) changes, recompute the view, delivered via `capabilities.updated` (§6.8).
    this.store.onAccountChange(() => void this.refresh().catch(() => {}));
    this.#view = emptyView();
    this.#viewKey = JSON.stringify(this.#view);
    this.#textRunner = new TextRunner({ concurrency: () => this.store.textParameters().concurrency });
  }

  /** `models.capabilities`: probes nodes (at most 2 seconds each, in parallel) and updates the cached view. */
  async capabilities(): Promise<ModelCapabilitiesView> {
    return this.#recompute('probe');
  }

  /** The most recently computed view (synchronous). */
  view(): ModelCapabilitiesView {
    return structuredClone(this.#view);
  }

  /** Recompute the view after a config, model package or node change (no network). */
  refresh(): Promise<ModelCapabilitiesView> {
    return this.#recompute('view');
  }

  onChange(listener: (view: ModelCapabilitiesView) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Full view of one provider; `not-found` if it does not exist. */
  async provider(providerId: string): Promise<ProviderView> {
    const { source, id } = this.#resolve(providerId);
    const view = await source.describe(id, 'view');
    if (!view) throw new RpcError('not-found', M.noSuchProvider({ provider: providerId }));
    return view;
  }

  async configure(request: ConfigureProviderRequest): Promise<ProviderView> {
    const source = this.#owner(request.providerId);
    if (!source) throw new RpcError('not-found', M.noSuchProvider({ provider: request.providerId }));
    if (!source.configure) throw new RpcError('invalid-request', M.noConfigureNeeded());
    await source.configure(request);
    await this.refresh();
    return this.provider(request.providerId);
  }

  async removeProvider(providerId: string): Promise<void> {
    const source = this.#owner(providerId);
    if (!source) throw new RpcError('not-found', M.noSuchProvider({ provider: providerId }));
    if (!source.remove) throw new RpcError('invalid-request', M.cannotRemove());
    if (!(await source.remove(providerId))) throw new RpcError('not-found', M.noSuchProvider({ provider: providerId }));
    await this.refresh();
  }

  /** `models.addAccount` (§6.8): returns this provider's view. Local, node and agent providers have no accounts: `invalid-request`. */
  async addAccount(request: AddProviderAccountRequest): Promise<ProviderView> {
    await this.#accountSource(request.providerId).addAccount!(request);
    await this.refresh();
    return this.provider(request.providerId);
  }

  async updateAccount(request: UpdateProviderAccountRequest): Promise<ProviderView> {
    await this.#accountSource(request.providerId).updateAccount!(request);
    await this.refresh();
    return this.provider(request.providerId);
  }

  async removeAccount(providerId: string, accountId: string): Promise<ProviderView> {
    await this.#accountSource(providerId).removeAccount!(providerId, accountId);
    await this.refresh();
    return this.provider(providerId);
  }

  async arrangeAccounts(request: ArrangeProviderAccountsRequest): Promise<ProviderView> {
    await this.#accountSource(request.providerId).arrangeAccounts!(request);
    await this.refresh();
    return this.provider(request.providerId);
  }

  /**
   * `models.usage` (§6.10): reads the ledger, aggregates by time period and vendor, and estimates prices at read time using the price table. If the ledger cannot be read, throw (do not treat it as empty);
   * an account's display name uses the current config (the name, or the mask if there is none), and accounts already deleted are listed by `accountId`.
   */
  async usage(request: UsageRequest, now: Date = new Date()): Promise<UsageReport> {
    const records = this.#usage ? await this.#usage.read() : [];
    const labels = new Map<string, string>();
    for (const provider of await this.#list('view')) labels.set(provider.providerId, provider.label);
    return buildUsageReport(records, {
      period: request.period,
      ...(request.providerId ? { providerId: request.providerId } : {}),
      now,
      providerLabel: (id) => labels.get(id) ?? id,
      accountLabel: (providerId, accountId) => {
        const account = this.store.provider(providerId)?.accounts.find((a) => a.accountId === accountId);
        return account ? (account.label ?? account.masked) : null;
      },
    });
  }

  #accountSource(providerId: string): ProviderSource {
    const source = this.#owner(providerId);
    if (!source) throw new RpcError('not-found', M.noSuchProvider({ provider: providerId }));
    if (!source.addAccount || !source.updateAccount || !source.removeAccount || !source.arrangeAccounts) {
      throw new RpcError('invalid-request', M.noAccounts());
    }
    return source;
  }

  /** Change the capability parameter defaults (only `generateText` for now), returning the filled-in values. Concurrency caps take effect immediately for calls queued afterward. */
  async setCapabilityParameters(request: SetCapabilityParametersRequest): Promise<TextCapabilityParameters> {
    if (request.capability !== 'generateText') throw new RpcError('invalid-request', M.noCapabilityParameters({ capability: request.capability }));
    const parameters = await this.store.setTextParameters({
      ...(request.effort !== undefined ? { effort: request.effort } : {}),
      ...(request.concurrency !== undefined ? { concurrency: request.concurrency } : {}),
    });
    await this.refresh();
    return parameters;
  }

  /** Fetch the model (and voice) list from an online provider (§6.8). If it cannot be fetched, the built-in list continues to be used, with `ok: false`. */
  async refreshProvider(providerId: string): Promise<{ provider: ProviderView; refreshed: ProviderRefreshStatus }> {
    const { source, id } = this.#resolve(providerId);
    if (!source.refresh) throw new RpcError('invalid-request', M.noRefresh());
    const refreshed = await source.refresh(id);
    await this.refresh();
    return { provider: await this.provider(id), refreshed };
  }

  /** In-process text generation entry (§6.1): shares selection, concurrency caps, counting and result checks with the `models.generateText` task. */
  textGenerator(): TextGenerator {
    this.#textGenerator ??= createTextGenerator({ select: (target) => this.selectText(target), runner: this.#textRunner });
    return this.#textGenerator;
  }

  /** Calls, retries and failure counts for `generateText`, per provider. */
  textStats(): Record<string, TextCallStats> {
    return this.#textRunner.stats();
  }

  /** Set or clear the default for one capability. The provider must exist and declare this capability; if no model is given, its default model is used. It does not need to be available right now. */
  async setDefault(capability: ModelServiceCapability, providerId: string | null, modelId?: string): Promise<ModelRef | null> {
    if (providerId === null) {
      if (modelId !== undefined) throw new RpcError('invalid-request', M.clearWithModel());
      await this.store.setDefault(capability, null);
      await this.refresh();
      return null;
    }
    const { source, id } = this.#resolve(providerId);
    const view = await source.describe(id, 'select');
    if (!view) throw new RpcError('not-found', M.noSuchProvider({ provider: providerId }));
    const cap = view.capabilities[capability];
    if (!cap) throw new RpcError('invalid-request', M.capabilityNotOffered({ provider: view.label, capability }));
    let model = modelId;
    if (model === undefined) {
      model = (cap.models.find((m) => m.default) ?? cap.models[0])?.modelId;
      if (model === undefined) throw new RpcError('invalid-request', M.noSelectableModel({ provider: view.label }));
    } else if (view.kind !== 'node' && !cap.models.some((m) => m.modelId === model)) {
      throw new RpcError('not-found', M.providerNoModel({ provider: view.label, model }));
    }
    const ref = { providerId: id, modelId: model };
    await this.store.setDefault(capability, ref);
    await this.refresh();
    return ref;
  }

  /**
   * After a local model package is deleted (`models.remove`, §6.8): defaults pointing to it are cleared for capabilities without a factory default, returning them to "unset"; `transcribe` has a factory
   * default, so a default pointing to it is kept and reported as unavailable. Returns which capabilities were cleared.
   */
  async clearLocalDefaults(bundleId: string): Promise<ModelServiceCapability[]> {
    const cleared = MODEL_SERVICE_CAPABILITIES.filter((capability) => {
      if (hasFactoryDefault(capability)) return false;
      const ref = this.store.getDefault(capability);
      return ref?.providerId === 'local' && ref.modelId === bundleId;
    });
    if (cleared.length === 0) return cleared;
    for (const capability of cleared) await this.store.setDefault(capability, null);
    await this.refresh();
    return cleared;
  }

  /** Choose the provider and model for `transcribe` at submission (§6.2). Throws `CAPABILITY_NOT_CONFIGURED` if unavailable. */
  async selectTranscribe(target: TranscribeTarget): Promise<TranscribeSelection> {
    let provider: string | undefined;
    if (target.provider !== undefined) provider = this.#resolve(target.provider).id;
    if (target.node !== undefined) {
      const fromNode = this.#resolve(`node:${target.node}`).id;
      if (provider !== undefined && provider !== fromNode) throw new RpcError('invalid-request', M.providerNodeConflict());
      provider = fromNode;
    }
    if (target.model !== undefined && target.bundleId !== undefined && target.model !== target.bundleId) {
      throw new RpcError('invalid-request', M.modelBundleMismatch());
    }
    const model = target.model ?? target.bundleId;
    const providers = await this.#list('select');
    const choice = selectModel({
      capability: 'transcribe',
      ...(provider !== undefined ? { provider } : {}),
      ...(model !== undefined ? { model } : {}),
      userDefault: this.store.getDefault('transcribe'),
      providers,
    });
    const source = this.#owner(choice.providerId)!;
    const transcriber = source.transcriber(choice.providerId);
    if (!transcriber) {
      throw capabilityNotConfiguredError(
        'transcribe',
        'unsupported',
        choice.providerId,
        'set-default',
        M.cannotTranscribe({ provider: choice.label }),
      );
    }
    return {
      ...choice,
      bundleId: choice.kind === 'online' ? null : choice.modelId,
      transcriber,
      queue: source.queue(choice.providerId, choice.modelId),
    };
  }

  /**
   * Choose the provider and model for generation capabilities at submission (§6.2). These two capabilities have no factory default: if none is specified explicitly and there is no user default,
   * throw `CAPABILITY_NOT_CONFIGURED` (`reason: 'no-default'`).
   */
  async selectGeneration<C extends GenerationCapability>(capability: C, target: GenerationTarget): Promise<GenerationSelection<C>> {
    const provider = target.provider !== undefined ? this.#resolve(target.provider).id : undefined;
    const providers = await this.#list('select');
    const choice = selectModel({
      capability,
      ...(provider !== undefined ? { provider } : {}),
      ...(target.model !== undefined ? { model: target.model } : {}),
      userDefault: this.store.getDefault(capability),
      providers,
    });
    const source = this.#owner(choice.providerId)!;
    if (capability === 'generateText') {
      const text = this.#textSelection(choice as ModelChoice<'generateText'>, source);
      let generator = this.#textJobs.get(choice.providerId);
      if (!generator) {
        generator = new TextJobGenerator(this.#textRunner, text.text);
        this.#textJobs.set(choice.providerId, generator);
      }
      return {
        ...choice,
        generator,
        queue: { key: `${choice.providerId}:generateText`, concurrency: text.defaults.concurrency },
        textDefaults: text.defaults,
      };
    }
    const generator = source.generator?.(choice.providerId, capability) ?? null;
    if (!generator) {
      throw capabilityNotConfiguredError(
        capability,
        'unsupported',
        choice.providerId,
        'set-default',
        M.cannotUseCapability({ provider: choice.label }),
      );
    }
    return { ...choice, generator, queue: source.queue(choice.providerId, choice.modelId) };
  }

  /**
   * Choose the provider and model for `separateAudio` (§6.2, has a factory default): there is only the local separation model package, and the caller (translation dubbing) hands it directly to
   * the Model Worker; this only decides the model. Throws `CAPABILITY_NOT_CONFIGURED` if unavailable.
   */
  async selectSeparate(target: GenerationTarget): Promise<ModelChoice<'separateAudio'>> {
    const provider = target.provider !== undefined ? this.#resolve(target.provider).id : undefined;
    return selectModel({
      capability: 'separateAudio',
      ...(provider !== undefined ? { provider } : {}),
      ...(target.model !== undefined ? { model: target.model } : {}),
      userDefault: this.store.getDefault('separateAudio'),
      providers: await this.#list('select'),
    });
  }

  /** Choose the provider and model for `generateText` (§6.2, no factory default), returning the text executor and the parameter defaults. */
  async selectText(target: GenerationTarget): Promise<TextSelection> {
    const provider = target.provider !== undefined ? this.#resolve(target.provider).id : undefined;
    const providers = await this.#list('select');
    const choice = selectModel({
      capability: 'generateText',
      ...(provider !== undefined ? { provider } : {}),
      ...(target.model !== undefined ? { model: target.model } : {}),
      userDefault: this.store.getDefault('generateText'),
      providers,
    });
    return this.#textSelection(choice, this.#owner(choice.providerId)!);
  }

  #textSelection(choice: ModelChoice<'generateText'>, source: ProviderSource): TextSelection {
    const text = source.textProvider?.(choice.providerId) ?? null;
    if (!text) {
      throw capabilityNotConfiguredError(
        'generateText',
        'unsupported',
        choice.providerId,
        'set-default',
        M.cannotGenerateText({ provider: choice.label }),
      );
    }
    return { ...choice, text, defaults: this.store.textParameters() };
  }

  /** The executor for a `providerId` (used by paths that skip selection, such as local file tasks). */
  transcriber(providerId: string): TranscribeProvider | null {
    return this.#owner(providerId)?.transcriber(providerId) ?? null;
  }

  /** All transcription executors (deduplicated). */
  executors(): TranscribeProvider[] {
    return [...new Set(this.#sources.flatMap((s) => s.executors()))];
  }

  /** All generation executors (deduplicated). */
  generators(): GenerationProvider[] {
    return [...new Set([...this.#sources.flatMap((s) => s.generators?.() ?? []), ...this.#textJobs.values()])];
  }

  // ---- internal ----

  #owner(providerId: string): ProviderSource | undefined {
    return this.#sources.find((s) => s.owns(providerId));
  }

  /** Normalize: alias → `node:<nodeId>`. `not-found` if unrecognized. */
  #resolve(providerId: string): { source: ProviderSource; id: string } {
    const source = this.#owner(providerId);
    const id = source?.resolve(providerId) ?? null;
    if (!source || !id) throw new RpcError('not-found', M.noSuchProvider({ provider: providerId }));
    return { source, id };
  }

  async #list(mode: DescribeMode): Promise<ProviderView[]> {
    return (await Promise.all(this.#sources.map((s) => s.list(mode)))).flat();
  }

  async #recompute(mode: DescribeMode): Promise<ModelCapabilitiesView> {
    const providers = await this.#list(mode);
    const view = {} as Record<ModelServiceCapability, CapabilityView>;
    for (const capability of MODEL_SERVICE_CAPABILITIES) {
      const userDefault = this.store.getDefault(capability);
      const entries: CapabilityView['providers'] = [];
      for (const p of providers) {
        const cap = p.capabilities[capability];
        if (!cap) continue;
        entries.push({ providerId: p.providerId, kind: p.kind, label: p.label, config: p.config, ...structuredClone(cap) });
      }
      // Local providers for image generation are ordered after online and agent ones (the design mockup's model menu: cloud, Codex, local).
      if (capability === 'generateImage') entries.sort((a, b) => Number(a.kind === 'local') - Number(b.kind === 'local'));
      view[capability] = { default: userDefault, effective: effectiveChoice({ capability, userDefault, providers }), providers: entries };
      if (capability === 'generateText') view[capability].parameters = this.store.textParameters();
    }
    const result = view as ModelCapabilitiesView;
    const key = JSON.stringify(result);
    this.#view = result;
    if (key !== this.#viewKey) {
      this.#viewKey = key;
      for (const listener of this.#listeners) listener(structuredClone(result));
    }
    return structuredClone(result);
  }
}

function emptyView(): ModelCapabilitiesView {
  const view = {} as Record<ModelServiceCapability, CapabilityView>;
  for (const capability of MODEL_SERVICE_CAPABILITIES) view[capability] = { default: null, effective: null, providers: [] };
  view.generateText.parameters = { effort: null, concurrency: DEFAULT_TEXT_CONCURRENCY };
  return view as ModelCapabilitiesView;
}
