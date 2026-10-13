import type {
  ImageModelInfo,
  MessageRef,
  ModelBundleStatus,
  MusicModelInfo,
  ProviderCapability,
  ProviderUnavailableReason,
  ProviderView,
  SeparateModelInfo,
  SpeechModelInfo,
  TranscribeModelInfo,
} from '@cuccut/protocol';
import { ModelsLocalSource as M } from '@cuccut/protocol/messages/models/local-source.ts';
import { transcribeLanguages } from './asr-languages.ts';
import type { BundleDefinition } from './bundle-registry.ts';
import type { GenerationCapability, GenerationProvider } from './generation-provider.ts';
import { localImageModelInfo } from './local-image.ts';
import { localMusicModelInfo } from './local-music.ts';
import { localSpeechModelInfo } from './local-speech.ts';
import { bundleUsable, type ModelCatalog } from './model-catalog.ts';
import type { DescribeMode, ProviderQueue, ProviderSource } from './provider-source.ts';
import type { TranscribeProvider } from './transcribe-provider.ts';

/**
 * Local provider (`local`): the machine's Model Worker and model catalog (architecture design §6.3, §6.5). Models are model packs; `modelId` is the `bundleId`. Each model pack has one queue, running only one task at a time (shared with tasks executed for other nodes).
 *
 * `transcribe` comes from speech-recognition model packs, `synthesizeSpeech` from speech-synthesis model packs (`capability: 'synthesize'`), `generateImage` from text-to-image model packs (`capability: 'image'`), and `separateAudio` from separation model packs (`capability: 'separate'`, used for dubbing; the Runtime hands it directly to the Model Worker, bypassing the executor here). Synthesis and image generation have no factory default (§6.2): a model's `default` only decides which model is used when `provider: 'local'` is set without a model; separation and recognition have factory defaults, and `default` is that one. Model packs are filtered by platform (`platformBundles`); model packs not listed on this machine never become the default.
 */
export class LocalProviderSource implements ProviderSource {
  readonly kind = 'local' as const;
  readonly #catalog: ModelCatalog;
  readonly #transcriber: TranscribeProvider | null;
  readonly #speech: GenerationProvider | null;
  readonly #image: GenerationProvider | null;
  readonly #music: GenerationProvider | null;

  constructor(options: {
    catalog: ModelCatalog;
    transcriber: TranscribeProvider | null;
    speech?: GenerationProvider | null;
    image?: GenerationProvider | null;
    /** Executor for music generation. The engine (audio.cpp) is a required component of the model pack; its executable is given by the directory's `engineExecutable`. */
    music?: GenerationProvider | null;
  }) {
    this.#catalog = options.catalog;
    this.#transcriber = options.transcriber;
    this.#speech = options.speech ?? null;
    this.#image = options.image ?? null;
    this.#music = options.music ?? null;
  }

  owns(providerId: string): boolean {
    return providerId === 'local';
  }

  resolve(providerId: string): string | null {
    return providerId === 'local' ? 'local' : null;
  }

  async list(mode: DescribeMode): Promise<ProviderView[]> {
    return [await this.#describe(mode)];
  }

  async describe(providerId: string, mode: DescribeMode): Promise<ProviderView | null> {
    return providerId === 'local' ? this.#describe(mode) : null;
  }

  transcriber(providerId: string): TranscribeProvider | null {
    return providerId === 'local' ? this.#transcriber : null;
  }

  generator(providerId: string, capability: GenerationCapability): GenerationProvider | null {
    if (providerId !== 'local') return null;
    if (capability === 'synthesizeSpeech') return this.#speech;
    if (capability === 'generateImage') return this.#image;
    if (capability === 'generateMusic') return this.#music;
    return null;
  }

  generators(): GenerationProvider[] {
    return [this.#speech, this.#image, this.#music].filter((g): g is GenerationProvider => g !== null);
  }

  queue(_providerId: string, modelId: string): ProviderQueue {
    return { key: modelId, concurrency: 1 };
  }

  executors(): TranscribeProvider[] {
    return this.#transcriber ? [this.#transcriber] : [];
  }

  async #describe(_mode: DescribeMode): Promise<ProviderView> {
    const all = await this.#catalog.list();
    const statuses = all.filter((s) => s.capability === 'transcribe');
    const models = statuses.map((status) => this.#model(status, all));
    const usable = models.filter((m) => m.available);
    const fallback = this.#catalog.defaultTranscribeBundle();
    const preferred = usable.find((m) => m.modelId === fallback) ?? usable[0] ?? models.find((m) => m.modelId === fallback) ?? models[0];
    if (preferred) preferred.default = true;
    const available = usable.length > 0 && this.#transcriber !== null;
    const reason: ProviderUnavailableReason | undefined = available
      ? undefined
      : this.#transcriber === null
        ? 'unsupported'
        : (preferred?.unavailableReason ?? 'not-installed');
    return {
      providerId: 'local',
      kind: 'local',
      label: M.localLabel().text,
      config: null,
      capabilities: {
        transcribe: {
          models,
          available,
          ...(reason ? { unavailableReason: reason } : {}),
          ...(!available ? detailOf(preferred) : {}),
        },
        ...this.#speechCapability(all),
        ...this.#imageCapability(all),
        ...this.#musicCapability(all),
        ...this.#separateCapability(all),
      },
    };
  }

  /** Speech-synthesis model packs: the capability exists only if one is registered; when none is available, the whole capability is unavailable (the reason is taken from the first one). */
  #speechCapability(all: ModelBundleStatus[]): { synthesizeSpeech?: ProviderCapability<SpeechModelInfo> } {
    const models = all
      .filter((s) => s.capability === 'synthesize')
      .flatMap((status) => {
        const def = this.#catalog.definition(status.bundleId);
        if (!def?.speech) return [];
        const usable = bundleUsable(status);
        const info = localSpeechModelInfo(def, status, usable);
        return [usable ? info : { ...info, unavailableReason: unavailableReasonOf(status) }];
      });
    if (models.length === 0) return {};
    const usable = models.filter((m) => m.available);
    const preferred = usable[0] ?? models[0]!;
    preferred.default = true;
    const available = usable.length > 0 && this.#speech !== null;
    const reason: ProviderUnavailableReason | undefined = available
      ? undefined
      : this.#speech === null
        ? 'unsupported'
        : (preferred.unavailableReason ?? 'not-installed');
    return {
      synthesizeSpeech: {
        models,
        available,
        ...(reason ? { unavailableReason: reason } : {}),
        ...(!available ? detailOf(preferred) : {}),
      },
    };
  }

  /** Separation model packs: the capability exists only if one is registered; the default is the first available one sorted by ID (if none is available, the first one, with its reason). */
  #separateCapability(all: ModelBundleStatus[]): { separateAudio?: ProviderCapability<SeparateModelInfo> } {
    const models: SeparateModelInfo[] = all
      .filter((s) => s.capability === 'separate')
      .sort((a, b) => a.bundleId.localeCompare(b.bundleId))
      .map((status) => {
        const usable = bundleUsable(status);
        return {
          modelId: status.bundleId,
          label: status.label ?? status.bundleId,
          cost: 'free-local',
          available: usable,
          ...(usable ? {} : { unavailableReason: unavailableReasonOf(status) }),
          ...(!usable ? detailOf(status) : {}),
        };
      });
    if (models.length === 0) return {};
    const usable = models.filter((m) => m.available);
    const preferred = usable[0] ?? models[0]!;
    preferred.default = true;
    const available = usable.length > 0;
    return {
      separateAudio: {
        models,
        available,
        ...(available ? {} : { unavailableReason: preferred.unavailableReason ?? 'not-installed' }),
        ...(!available ? detailOf(preferred) : {}),
      },
    };
  }

  /** Text-to-image model packs: the capability exists only if one is registered; when none is available, the whole capability is unavailable (the reason is taken from the first one). */
  #imageCapability(all: ModelBundleStatus[]): { generateImage?: ProviderCapability<ImageModelInfo> } {
    const models = all
      .filter((s) => s.capability === 'image')
      .flatMap((status) => {
        const def = this.#catalog.definition(status.bundleId);
        if (!def?.image) return [];
        const usable = bundleUsable(status);
        const info = localImageModelInfo(def, status, usable);
        return [usable ? info : { ...info, unavailableReason: unavailableReasonOf(status) }];
      });
    if (models.length === 0) return {};
    const usable = models.filter((m) => m.available);
    const preferred = usable[0] ?? models[0]!;
    preferred.default = true;
    const available = usable.length > 0 && this.#image !== null;
    const reason: ProviderUnavailableReason | undefined = available
      ? undefined
      : this.#image === null
        ? 'unsupported'
        : (preferred.unavailableReason ?? 'not-installed');
    return {
      generateImage: {
        models,
        available,
        ...(reason ? { unavailableReason: reason } : {}),
        ...(!available ? detailOf(preferred) : {}),
      },
    };
  }

  /**
   * Music generation model packs: the capability exists only if one is registered. The engine (audio.cpp) is a required component of the model pack, downloaded together with the model. When the engine is not installed, the model pack is `not-installed` / `incomplete`, with reason `not-installed` (downloading or repairing the model pack is enough). Only when this platform has no engine pack is the model pack `error` / `unsupported`, and only then is the reason `unsupported`.
   */
  #musicCapability(all: ModelBundleStatus[]): { generateMusic?: ProviderCapability<MusicModelInfo> } {
    const models = all
      .filter((s) => s.capability === 'music')
      .flatMap((status) => {
        const def = this.#catalog.definition(status.bundleId);
        if (!def?.music) return [];
        const engine = this.#music === null ? null : this.#catalog.engineExecutable(def.bundleId);
        const usable = bundleUsable(status);
        const info = localMusicModelInfo(def, status, usable, engine);
        if (info.available) return [info];
        return [{ ...info, unavailableReason: usable ? ('not-installed' as const) : unavailableReasonOf(status) }];
      });
    if (models.length === 0) return {};
    const usable = models.filter((m) => m.available);
    const preferred = usable[0] ?? models[0]!;
    preferred.default = true;
    const available = usable.length > 0;
    const reason: ProviderUnavailableReason | undefined = available
      ? undefined
      : this.#music === null
        ? 'unsupported'
        : (preferred.unavailableReason ?? 'not-installed');
    return {
      generateMusic: {
        models,
        available,
        ...(reason ? { unavailableReason: reason } : {}),
        ...(!available ? detailOf(preferred) : {}),
      },
    };
  }

  #model(status: ModelBundleStatus, all: readonly ModelBundleStatus[]): TranscribeModelInfo {
    const def = this.#catalog.definition(status.bundleId);
    const usable = bundleUsable(status);
    const reason = usable ? undefined : unavailableReasonOf(status);
    const selfSegmenting = def?.components.asr?.family === 'moss-transcribe-diarize';
    // The required components of the speaker-diarization model pack are all installed, so after transcription speakers can be told apart (§6.6). MOSS distinguishes speakers itself.
    const pack = def?.diarization ? all.find((s) => s.bundleId === def.diarization) : undefined;
    const packInstalled = pack?.components?.filter((c) => !c.optional).every((c) => c.state === 'installed') ?? false;
    return {
      modelId: status.bundleId,
      label: status.label ?? status.bundleId,
      maxInputBytes: null,
      maxDurationSec: null,
      // The aligner is an optional component: when installed, word timings are aligned; when absent, words are interpolated by character length and marked `estimated` (§6.6 step 5). Models that segment on their own (MOSS) align only lines longer than 5 seconds; other lines remain estimated and do not count as native word timings.
      wordTimestamps:
        !selfSegmenting && status.components?.some((c) => c.component === 'aligner' && c.state === 'installed') ? 'native' : 'none',
      // The language assertion is gated by the `asr` model family (same table as the Worker); unrecognized model families are not restricted.
      languages: asrLanguagesOf(def),
      // MOSS has no channel for recognition hints: hints are not accepted (the Worker would only report `hint-ignored` if it received one).
      acceptsHint: !selfSegmenting,
      speakers: selfSegmenting ? 'native' : packInstalled ? 'pack' : 'none',
      ...(!selfSegmenting && def?.diarization ? { diarizationPack: def.diarization } : {}),
      cost: 'free-local',
      available: usable,
      ...(reason ? { unavailableReason: reason } : {}),
      ...(!usable ? detailOf(status) : {}),
    };
  }
}

function asrLanguagesOf(def: BundleDefinition | null): 'any' | string[] {
  const family = def?.components.asr?.family;
  const languages = family ? transcribeLanguages(family) : null;
  return languages ? [...languages] : 'any';
}

/** Model pack status → reason for unavailability. */
export function unavailableReasonOf(status: ModelBundleStatus): ProviderUnavailableReason {
  if (status.state === 'not-installed' || status.state === 'downloading') return 'not-installed';
  switch (status.reason) {
    case 'unsupported':
      return 'unsupported';
    case 'resource':
    case 'load-failed':
      return 'resource';
    case 'worker-missing':
      return 'not-installed';
    default:
      return 'not-installed';
  }
}

/** The unavailability reason is carried together with its message reference (the UI regenerates it in its own language). */
function detailOf(from: { detail?: string; detailRef?: MessageRef } | undefined): { detail?: string; detailRef?: MessageRef } {
  if (!from?.detail) return {};
  return from.detailRef ? { detail: from.detail, detailRef: from.detailRef } : { detail: from.detail };
}
