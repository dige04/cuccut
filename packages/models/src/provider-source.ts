import type {
  AddProviderAccountRequest,
  ArrangeProviderAccountsRequest,
  ConfigureProviderRequest,
  ProviderKind,
  ProviderRefreshStatus,
  ProviderView,
  UpdateProviderAccountRequest,
} from '@cuccut/protocol';
import type { GenerationCapability, GenerationProvider } from './generation-provider.ts';
import type { TextProvider } from './text-generation.ts';
import type { TranscribeProvider } from './transcribe-provider.ts';

/**
 * Entry in the Provider registry (architecture design §6.1): one Provider source is responsible for one `providerId` (`local`, `openai`, `google`) or for a family (`node:*`, `custom:*`). The source gives the description (models, limits, whether it is available right now), and hands over the implementation that executes each capability.
 *
 * Capabilities are added the same way: the description declares the capabilities and models, and the source then hands over the executor for that capability (`transcriber`, `generator`). Selection, defaults and views need no changes.
 */

/**
 * How descriptions are obtained:
 * - `select`: for use at submission time. No network; it looks only at facts known locally (configuration, keys, model packages, whether paired).
 * - `view`: for views. No network; it may include the most recently probed remote status.
 * - `probe`: for `models.capabilities`. It may probe over the network (at most 2 seconds per node, in parallel), and updates the most recent status.
 */
export type DescribeMode = 'select' | 'view' | 'probe';

export interface ProviderQueue {
  /** Tasks with the same key share one queue. */
  key: string;
  /** Number of tasks this queue runs at the same time. */
  concurrency: number;
}

export interface ProviderSource {
  readonly kind: ProviderKind;
  /** The `providerId`s this source is responsible for (including ones that do not exist yet, e.g. a new `custom:<slug>`). */
  owns(providerId: string): boolean;
  /** Normalises the caller's spelling (node alias → `node:<nodeId>`); null if it belongs to this source but does not exist. */
  resolve(providerId: string): string | null;
  list(mode: DescribeMode): Promise<ProviderView[]>;
  describe(providerId: string, mode: DescribeMode): Promise<ProviderView | null>;
  /** The implementation that executes `transcribe`; null if this Provider does not provide it. */
  transcriber(providerId: string): TranscribeProvider | null;
  /** The implementation that executes `synthesizeSpeech` / `generateImage`; null if this Provider does not provide that capability. A source with no generation capability may leave these unimplemented. */
  generator?(providerId: string, capability: GenerationCapability): GenerationProvider | null;
  /** The implementation that executes `generateText` (shared by tasks and in-process calls); null if this Provider does not provide it. Implemented only by online sources. */
  textProvider?(providerId: string): TextProvider | null;
  queue(providerId: string, modelId: string): ProviderQueue;
  /** All transcription executors: closed on stop, and notified when a model package is re-enabled. */
  executors(): TranscribeProvider[];
  /** All generation executors: closed on stop. */
  generators?(): GenerationProvider[];
  /** Implemented only by online sources: modifies the configuration (including validation and optional verification). */
  configure?(request: ConfigureProviderRequest): Promise<void>;
  /** Implemented only by online sources: removes the provider (a custom endpoint deletes its configuration; a catalogue provider deletes the configuration and the credentials of all accounts). Returns false if it does not exist. */
  remove?(providerId: string): Promise<boolean>;
  /** Implemented only by online sources: accounts (§6.8). */
  addAccount?(request: AddProviderAccountRequest): Promise<void>;
  updateAccount?(request: UpdateProviderAccountRequest): Promise<void>;
  removeAccount?(providerId: string, accountId: string): Promise<void>;
  arrangeAccounts?(request: ArrangeProviderAccountsRequest): Promise<void>;
  /** Implemented only by online sources: fetches the list of models (and voices) from the provider and caches it. If it cannot be fetched, the built-in list is used as before and marked as such; it does not throw. */
  refresh?(providerId: string): Promise<ProviderRefreshStatus>;
}
