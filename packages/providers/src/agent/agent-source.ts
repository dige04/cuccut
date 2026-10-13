import type { AgentDriver } from '@cuccut/harness';
import type {
  DescribeMode,
  GenerationCapability,
  GenerationProvider,
  ModelServiceStore,
  ProviderQueue,
  ProviderSource,
  TranscribeProvider,
  UsageLedger,
} from '@cuccut/models';
import {
  AGENT_PROVIDER_PREFIX,
  refOf,
  RpcError,
  type ConfigureProviderRequest,
  type DriverId,
  type DriverProbe,
  type ImageModelInfo,
  type Localized,
  type MessageRef,
  type ProviderCapability,
  type ProviderConfigView,
  type ProviderUnavailableReason,
  type ProviderView,
} from '@cuccut/protocol';
import { usageErrorOf } from '../usage-reporter.ts';
import { AgentImageGenerator, type AgentReadiness } from './agent-image-generator.ts';
import { ProvidersAgent as PA, ProvidersConfig as PC } from '@cuccut/protocol/messages/providers';

/** Config view of the agent provider: only the switch and the enable time, no key (`credential: 'none'`), no account (§6.8). */
function agentConfigView(view: ProviderConfigView): ProviderConfigView {
  const { accounts: _accounts, ...rest } = view;
  return { ...rest, credential: 'none' };
}

/** The part of the Driver registry (`DriverRegistry`) that the agent provider uses. */
export interface AgentDrivers {
  /**
   * The status of one Driver: a result within `maxAgeMs` in the registry is used directly. Otherwise only this one Driver is probed again and awaited (the result is written back to the registry's cache).
   * It does not wait for other Drivers' probes. null if it is not registered.
   */
  current(id: DriverId, maxAgeMs: number): Promise<DriverProbe | null>;
  /** Throws if it is not registered. */
  get(id: DriverId): AgentDriver;
  /** Executable file the user specified manually. null if none was specified (the Driver finds it itself). */
  executable(id: DriverId): string | null;
}

export interface AgentSourceOptions {
  store: ModelServiceStore;
  drivers: AgentDrivers;
  /** Deadline (milliseconds, default 10 seconds) for reusing the most recent Driver probe. */
  probeMaxAgeMs?: number;
  /** Deadline for one generation (milliseconds, default 10 minutes). */
  turnTimeoutMs?: number;
  /** Usage ledger (§6.10): calls from the agent provider are recorded too. `accountId` is null, and the cost is unknown. */
  usage?: UsageLedger;
}

/** The definition of one agent provider. The first version only has `generateImage` for `agent:codex`. */
interface AgentProviderDefinition {
  driverId: DriverId;
  label: string;
  /** Versions below this are unavailable (`outdated`). The protocol is checked against this version (`codex-protocol.ts`). */
  minVersion: string;
  upgradeHint: Localized;
  model: ImageModelInfo;
  instructions: string;
  turnText: (prompt: string) => string;
  outputName: string;
}

const CODEX_OUTPUT = 'output.png';

const CODEX: AgentProviderDefinition = {
  driverId: 'codex',
  label: 'Codex',
  minVersion: '0.158.0',
  get upgradeHint() {
    return PA.codexUpgradeHint();
  },
  model: {
    modelId: 'image-gen',
    get label() {
      return PA.codexImageModel().text;
    },
    default: true,
    sizes: [],
    aspectRatios: [],
    defaultSize: null,
    maxCount: 1,
    maxPromptChars: 4000,
    formats: ['png'],
    defaultFormat: 'png',
    referenceImages: null,
    acceptsSeed: false,
    cost: 'subscription',
    get notes() {
      return PA.codexImageNotes().text;
    },
  },
  instructions: [
    'You are running as a non-interactive image generation backend. Nobody reads your reply and nobody can approve anything.',
    'Task: generate exactly one image for the prompt in the user message, using your built-in image generation tool.',
    'Do not draw the image with code, do not download images from the internet, and do not ask questions.',
    `Save the generated image as a PNG file named ${CODEX_OUTPUT} in the current working directory. If the tool saved it elsewhere, copy it to ./${CODEX_OUTPUT}.`,
    'Do not create, modify or delete any other file, and do not touch anything outside the current working directory.',
    `If you cannot generate the image, do not write ${CODEX_OUTPUT}; reply with one sentence saying why.`,
  ].join('\n'),
  turnText: (prompt) => `Image prompt (use it as given):\n${prompt}`,
  outputName: CODEX_OUTPUT,
};

const DEFINITIONS: Record<string, AgentProviderDefinition> = { [`${AGENT_PROVIDER_PREFIX}codex`]: CODEX };

const DEFAULT_PROBE_MAX_AGE_MS = 10_000;
const DEFAULT_TURN_TIMEOUT_MS = 10 * 60_000;

type Availability =
  | { available: true }
  | { available: false; reason: ProviderUnavailableReason; detail: string; detailRef?: MessageRef };

/** Unavailable. The Runtime's text carries its reference (the UI regenerates it in the current language). */
function unavailable(reason: ProviderUnavailableReason, detail: Localized): Availability {
  return { available: false, reason, detail: detail.text, detailRef: refOf(detail) };
}

/**
 * Agent provider source (architecture design §6.9): an agent runtime installed and signed in on this machine, used as an image provider through its Driver.
 * The first version only has `agent:codex` (`generateImage`), and it is listed only when the Codex Driver is registered.
 *
 * - Availability is checked in this order: the Driver is not installed (`not-installed`); not signed in (`signed-out`); otherwise unavailable (`unsupported`); version below the minimum (`outdated`); the user has not enabled it (`not-configured`). The explanations for the first three come from the Driver's probe.
 * - The configuration is only a switch. There is no key, endpoint or model declaration (it uses the agent runtime's own sign-in). Enabling it means consenting to send prompts and reference images to its account.
 * - Probing: `probe` always asks the Driver (the Driver registry has a short-term cache). `select` and `view` ask the Driver when the user has enabled it. When it is not enabled, they use the most recent result, and if it was never probed, they only report that it is not enabled. External commands are not started for providers that are not enabled.
 * - One queue per provider, running at most 1 task at a time.
 */
export class AgentProviderSource implements ProviderSource {
  readonly kind = 'agent' as const;
  readonly #options: AgentSourceOptions;
  readonly #generators = new Map<string, AgentImageGenerator>();
  /** The most recent Driver status that was probed. */
  readonly #lastInfo = new Map<DriverId, DriverProbe>();

  constructor(options: AgentSourceOptions) {
    this.#options = options;
  }

  owns(providerId: string): boolean {
    return providerId.startsWith(AGENT_PROVIDER_PREFIX);
  }

  resolve(providerId: string): string | null {
    const definition = DEFINITIONS[providerId];
    return definition && this.#driver(definition) ? providerId : null;
  }

  async list(mode: DescribeMode): Promise<ProviderView[]> {
    const views: ProviderView[] = [];
    for (const id of Object.keys(DEFINITIONS)) {
      const view = await this.describe(id, mode);
      if (view) views.push(view);
    }
    return views;
  }

  async describe(providerId: string, mode: DescribeMode): Promise<ProviderView | null> {
    const definition = DEFINITIONS[providerId];
    if (!definition || !this.#driver(definition)) return null;
    const availability = await this.#availability(providerId, definition, mode);
    const capability: ProviderCapability<ImageModelInfo> = {
      models: [{ ...definition.model }],
      available: availability.available,
      ...(availability.available
        ? {}
        : {
            unavailableReason: availability.reason,
            detail: availability.detail,
            ...(availability.detailRef ? { detailRef: availability.detailRef } : {}),
          }),
    };
    return {
      providerId,
      kind: 'agent',
      label: definition.label,
      vendor: { kind: 'agent', icon: 'codex' },
      config: agentConfigView(this.#options.store.configView(providerId)),
      capabilities: { generateImage: capability },
    };
  }

  transcriber(_providerId: string): TranscribeProvider | null {
    return null;
  }

  generator(providerId: string, capability: GenerationCapability): GenerationProvider | null {
    const definition = DEFINITIONS[providerId];
    if (!definition || capability !== 'generateImage' || !this.#driver(definition)) return null;
    let generator = this.#generators.get(providerId);
    if (!generator) {
      generator = new AgentImageGenerator({
        providerId,
        label: definition.label,
        // Checked again at execution time: anything disabled, signed out or uninstalled while queued does not open a session.
        ready: () => this.#readiness(providerId, definition),
        instructions: definition.instructions,
        turnText: definition.turnText,
        outputName: definition.outputName,
        turnTimeoutMs: this.#options.turnTimeoutMs ?? DEFAULT_TURN_TIMEOUT_MS,
        report: (report) => {
          void this.#options.usage?.append({
            at: new Date().toISOString(),
            providerId,
            accountId: null,
            capability: report.capability,
            modelId: report.modelId,
            source: report.source,
            ...(report.ref ? { ref: report.ref } : {}),
            units: report.units,
            cost: { kind: 'unknown' },
            durationMs: Math.max(0, Date.now() - report.startedAt),
            status: report.error === undefined ? 'ok' : 'error',
            ...(report.error !== undefined ? { error: usageErrorOf(report.error) } : {}),
          });
        },
      });
      this.#generators.set(providerId, generator);
    }
    return generator;
  }

  generators(): GenerationProvider[] {
    return [...this.#generators.values()];
  }

  /** An agent does one thing at a time: one queue per provider, running at most 1 task at a time. */
  queue(providerId: string, _modelId: string): ProviderQueue {
    return { key: providerId, concurrency: 1 };
  }

  executors(): TranscribeProvider[] {
    return [];
  }

  /** Accepts only the switch. Enabling it means consenting to send the prompt (and reference images) to the account this agent runtime is signed in to. */
  async configure(request: ConfigureProviderRequest): Promise<void> {
    const id = request.providerId;
    const definition = DEFINITIONS[id];
    if (!definition || !this.#driver(definition)) throw new RpcError('not-found', PC.providerNotFound({ id }));
    const extra = (['credential', 'endpoint', 'models', 'label', 'verify'] as const).filter((key) => request[key] !== undefined);
    if (extra.length > 0) {
      throw new RpcError('invalid-request', PC.toggleOnly({ label: definition.label, fields: extra.join(PC.listSeparator().text) }));
    }
    if (request.enabled === undefined) throw new RpcError('invalid-request', PC.giveEnabled({ label: definition.label }));
    await this.#options.store.updateProvider(id, { enabled: request.enabled });
  }

  // ---- Internal ----

  #driver(definition: AgentProviderDefinition): AgentDriver | null {
    try {
      return this.#options.drivers.get(definition.driverId);
    } catch {
      return null;
    }
  }

  async #info(definition: AgentProviderDefinition): Promise<DriverProbe | null> {
    const info = await this.#options.drivers
      .current(definition.driverId, this.#options.probeMaxAgeMs ?? DEFAULT_PROBE_MAX_AGE_MS)
      .catch(() => null);
    if (info) this.#lastInfo.set(definition.driverId, info);
    return info;
  }

  async #availability(providerId: string, definition: AgentProviderDefinition, mode: DescribeMode): Promise<Availability> {
    const enabled = this.#options.store.provider(providerId)?.enabled ?? false;
    const info = mode === 'probe' || enabled ? await this.#info(definition) : (this.#lastInfo.get(definition.driverId) ?? null);
    if (!info && !enabled) return unavailable('not-configured', PC.notEnabled());
    return evaluate(definition, info, enabled);
  }

  async #readiness(providerId: string, definition: AgentProviderDefinition): Promise<AgentReadiness> {
    const enabled = this.#options.store.provider(providerId)?.enabled ?? false;
    const driver = this.#driver(definition);
    const info = await this.#info(definition);
    const availability = evaluate(definition, info, enabled);
    if (!availability.available) return { ok: false, reason: availability.reason, message: availability.detail };
    if (!driver) return { ok: false, reason: 'not-installed', message: PC.driverNotRegistered().text };
    return { ok: true, driver, version: info!.version!, executable: this.#options.drivers.executable(definition.driverId) };
  }
}

/** Driver status + version + switch → availability (order as in the class comment). */
function evaluate(definition: AgentProviderDefinition, info: DriverProbe | null, enabled: boolean): Availability {
  const name = definition.label;
  if (!info) return unavailable('unsupported', PC.noStatus({ name }));
  // A “version too old” reported by the Driver itself takes the same path as this provider's minimum version. The remedy in both cases is an upgrade (architecture design §6.9).
  const outdated = info.state === 'outdated' || (info.status === 'available' && (!info.version || compareVersions(info.version, definition.minVersion) < 0));
  if (info.status !== 'available' && !outdated) {
    // The Driver probe's explanation carries its own reference (probe results are cached). When there is no explanation, the copy here is used.
    const fallback = PC.agentUnavailable({ name });
    const detail = info.detail
      ? { detail: info.detail, ...(info.detailRef ? { detailRef: info.detailRef } : {}) }
      : { detail: fallback.text, detailRef: refOf(fallback) };
    const reason: ProviderUnavailableReason = info.state === 'not-installed' || info.state === 'signed-out' ? info.state : 'unsupported';
    return { available: false, reason, ...detail };
  }
  if (outdated) {
    return unavailable(
      'outdated',
      PC.versionTooOld({
        name,
        version: info.version ?? PC.unknownVersion(),
        min: definition.minVersion,
        hint: definition.upgradeHint,
      }),
    );
  }
  if (!enabled) return unavailable('not-configured', PC.notEnabled());
  return { available: true };
}

/** Compares version numbers such as `0.160.0` and `0.160.0-alpha.2` segment by segment as numbers (a pre-release suffix counts as more segments). */
function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.-]/).map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(/[.-]/).map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
