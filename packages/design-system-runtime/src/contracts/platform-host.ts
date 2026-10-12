import type * as React from "react";
export interface ArtifactComment {
  id: string;
  text: string;
  at: number;
  author: string;
  userId?: string;
  elementKey?: string;
  elementLabel?: string;
  images?: string[];
}
export type CommentOperation =
  | { op: "add"; comment: ArtifactComment }
  | { op: "remove"; id: string };
export interface SaveState {
  status:
    | "ready"
    | "saved"
    | "dirty"
    | "saving"
    | "error"
    | "readonly"
    | "loading"
    | "cached";
  message?: string;
  code?: string;
  reloading?: boolean;
  atBoot?: boolean;
}
export interface CommentSync {
  status: "idle" | "blocked" | "error" | "publishing";
  pending: number;
  message?: string;
}
export interface StorageSlot {
  read(): string | null;
  write(value: string): boolean;
  clear(): void;
}
export interface ArtifactEnvelope<Content> {
  title: string;
  content: Content;
  comments: ArtifactComment[];
}
export interface ArtifactParser<Content> {
  parseContent(value: unknown): Content;
  initialContent: Content;
  defaultTitle?: string;
  serializeContent?(content: Content, title: string): unknown;
  contentHold?(value: unknown): string | undefined;
}
export interface UndoAction {
  label: string;
  do(): void;
  undo(): void;
}
export interface ArtifactDocument<Content> {
  saveMode(): "auto" | "manual";
  title(): string;
  setTitle(title: string): void;
  content(): Content;
  setContent(content: Content): void;
  updateContent(
    update: (content: Content) => Content,
    options?: { auto?: boolean },
  ): void;
  state(): ArtifactEnvelope<Content>;
  comments(): ArtifactComment[];
  addComment(comment: Partial<ArtifactComment>): ArtifactComment | undefined;
  removeComment(id: string): void;
  commentSync(): CommentSync;
  pendingCommentIds(): Set<string>;
  retryCommentPublish(): void;
  dirty(): boolean;
  readOnly(): boolean;
  saveState(): SaveState;
  documentBytes(): number;
  save(): Promise<void>;
  stashOffer(): { at: number } | undefined;
  restoreStash(): UndoAction | undefined;
  discardStash(): void;
  restoreCount(): number;
  subscribe(listener: (event?: { remote: boolean }) => void): () => void;
  subscribeSave(listener: (state: SaveState) => void): () => void;
  adoptRemote?(
    update: (
      base: Content,
      current: Content,
    ) => { base: Content; current: Content; dirty: boolean },
  ): void;
}
export interface ParsedStash {
  at: number;
  state: unknown;
  ops?: unknown;
  expectEmbed?: string;
}
export interface CompiledPage {
  title: string;
  readme: string;
  readmeMeta: string;
  css: string;
  js: string;
  capabilities?: string;
  emulator?: boolean;
  emulatorShim?: string;
  colorMode?: "light" | "dark";
}
export interface PublishResult {
  reloads?: boolean;
}
export interface PublishError {
  code: string;
  message: string;
  live?: string;
  say?: string;
}
export type Publisher = (
  page: string,
  context?: {
    published: ArtifactEnvelope<unknown>;
    base: ArtifactEnvelope<unknown>;
  },
) => Promise<PublishResult | undefined>;
export interface DocumentOptions<Content> extends ArtifactParser<Content> {
  embeddedState?: Record<string, unknown>;
  pageParts?: CompiledPage;
  stash?: StorageSlot;
  roFlag?: StorageSlot;
  canPublish?: boolean;
  publish?: Publisher;
  publishesPage?: boolean;
  publishWrapsFrame?: boolean;
}
export interface RuntimeSavePort {
  mode: string;
  status: "readonly" | "error" | "saving" | "idle";
  pending: number;
  lastError?: { message?: string };
  save(): Promise<void>;
  onStatus(
    listener: (
      status: RuntimeSavePort["status"],
      error?: { message?: string },
    ) => void,
  ): void;
}
export interface RuntimeDocPort {
  getAll(): Promise<Record<string, unknown>>;
  observe(
    path: string,
    listener: (
      changes: { origin: string; key: string; value: unknown }[],
    ) => void,
  ): void;
  set(key: string, value: unknown): Promise<void>;
}
export interface AutoSavingRuntime {
  saving: RuntimeSavePort;
  doc: RuntimeDocPort;
}
export interface RuntimeDocumentOptions<Content>
  extends ArtifactParser<Content> {
  runtime: AutoSavingRuntime;
  snapshot: Record<string, unknown>;
}
export interface ActiveArtifactRuntime {
  runtime: AutoSavingRuntime;
  snapshot: Record<string, unknown>;
}
export interface TimerPort {
  setTimeout(
    callback: () => void,
    delay: number,
  ): ReturnType<typeof setTimeout>;
  clearTimeout(timer: ReturnType<typeof setTimeout> | undefined): void;
  now(): number;
}
export interface AutosaveOptions {
  offFlag?: StorageSlot;
  timers?: TimerPort;
  idleMs?: number;
  maxWaitMs?: number;
  hold?(): boolean;
}
export interface UserCapability {
  id(): unknown;
  name(): unknown;
  isOwner(): unknown;
  canEdit(): unknown;
  can(capability: string): unknown;
}
export interface SelfCapability {
  publish(
    page: string | import("../contracts").FilePublishEntries,
    context?: {
      published: ArtifactEnvelope<unknown>;
      base: ArtifactEnvelope<unknown>;
    },
  ): Promise<PublishResult | undefined>;
}
export interface AssetsCapability {
  upload(
    blob: Blob,
    options?: { type?: string; name?: string },
  ): Promise<unknown>;
}
export interface ClaudeBridge {
  use?(name: string): Promise<unknown>;
  user?: Partial<UserCapability>;
  self?: SelfCapability;
  assets?: AssetsCapability;
  hot?: HotCapability;
  [capability: string]: unknown;
}
export interface ProtocolGlobal extends Window {
  // CucCut: the host is globalThis.designSystemHost (packages/design-system/src/editor/design-system-host.ts), not globalThis.claude.
  designSystemHost?: ClaudeBridge;
  appifact?: { ready(): Promise<AutoSavingRuntime> };
  __appifact_health?: HealthReporter;
  __FRAME_PREAMBLE?: { origins?: unknown };
}
export interface HealthReporter {
  report(name: string, value?: unknown, context?: unknown): void;
  track<Value>(
    name: string,
    action: () => Value | PromiseLike<Value>,
    context?: unknown,
  ): Promise<Value>;
}
export interface WriteAccess {
  canWrite: boolean;
  reason?: string;
}
export interface HostDestination {
  id: string;
  disabled?: boolean;
}
export interface HostExport {
  format: string;
  disabled?: boolean;
  interactive?: boolean;
  bundle?: boolean;
  handoff?: boolean;
  variants?: HostDestination[];
}
export interface HostFoot {
  footInset?: number;
  ground?: string;
}
export interface HostSnapshot extends HostFoot {
  v: number;
  saved?: string | null;
  actions?: { id: string }[];
  leaveLosesWork?: boolean;
  exports?: HostExport[];
  handoffs?: HostExport[];
  destinations?: HostDestination[];
}
export interface HostIncomingData {
  __frame_chrome_poke?: unknown;
  __frame_chrome_cmd?: unknown;
  rows?: unknown;
  words?: unknown;
  cmd?: unknown;
  id?: unknown;
  format?: unknown;
  request?: unknown;
  interactive?: unknown;
  variant?: unknown;
  bundle?: unknown;
  windowMs?: unknown;
  sender?: unknown;
}
export interface HostFrameOptions {
  ownWindow: Pick<Window, "addEventListener" | "removeEventListener">;
  parentWindow: Pick<Window, "postMessage"> | null;
  origins: readonly string[];
}
export type HostExportHandler = (
  format: string,
  request: string,
  interactive: boolean,
  variant?: string,
  bundle?: boolean,
  windowMs?: number,
  sender?: "viewer" | "claude",
) => void;
export interface HostFrameBridge {
  report(saved: string | null | undefined, saveNow?: boolean): void;
  setSaveNowHandler(handler: (() => void) | null): void;
  setDestinations(destinations: readonly HostDestination[] | null): void;
  setDestinationHandler(handler: ((id: string) => void) | null): void;
  setFoot(foot: { inset?: number; ground?: string } | null): void;
  setExports(formats: readonly HostExport[] | null): void;
  setExportHandler(handler: HostExportHandler | null): void;
  setFind(enabled: boolean, handler: (() => void) | null): void;
  declineExport(request: string, cancelled?: boolean): void;
  holdLeaveLosesWork(): () => void;
  witnessed(): boolean;
  hostDrawsSave(): boolean;
  hostDrawsReadOnly(): boolean;
  hostDrawsClaudeTips(): boolean;
  hostTakesRetry(): boolean;
  subscribeHostDrawsSave(listener: () => void): () => void;
  dispose(): void;
}
export interface HotVersion {
  ver: string;
  seq?: number;
}
export interface HotFileChange {
  path: string;
  kind: string;
}
export interface HotUpdate {
  from: HotVersion;
  to: HotVersion;
  changed: HotFileChange[] | null;
  required: string;
  adopt?(): void;
  defer?(): void;
  restart?(): void;
}
export interface HotCapability {
  signal?: AbortSignal;
  accept(
    callback: (
      update: HotUpdate,
    ) => void | "restart" | "deferred" | "applied" | Promise<"applied">,
  ): void;
  ready?(callback: (carried: unknown) => Promise<void> | undefined): void;
  snapshot?(callback: (context: unknown) => unknown): void;
  restart?(options: { note: string }): void;
}
export interface HotQueuedUpdate {
  from: { version: string; seq?: number };
  to: { version: string; seq?: number };
  changed: HotFileChange[] | null;
  at: number;
}
export interface HotOwedUpdate {
  reason: string;
  from: { version: string; seq?: number };
  to: { version: string; seq?: number };
  at: number;
}
export interface HotEvent {
  type: string;
  from?: string;
  to?: string;
  reason?: string;
  decision?: string;
  why?: string;
  heldMs?: number;
  timedOut?: boolean;
  carried?: boolean;
  fromSeq?: number;
  toSeq?: number;
  required?: string;
  shape?: string;
  changed?: { path: string; kind: string; klass: string }[] | null;
  busy?: boolean;
  early?: boolean;
}
export interface HotAttachment {
  onEvent?(event: HotEvent): void;
  reveal?: PromiseLike<unknown>;
  restore?(carried: unknown): void;
  snapshot?(context: unknown): unknown;
  onBeforeRestart?(reason: string): void;
}
export interface HotReloadBridge {
  active: boolean;
  queued: HotQueuedUpdate[];
  restarted: boolean;
  carried: unknown;
  events: HotEvent[];
  owed(): HotOwedUpdate | undefined;
  takeOwed(): HotOwedUpdate | undefined;
  attach(attachment: HotAttachment): void;
  release(): void;
  detach(): void;
  armReady(): void;
  live?(): boolean;
}
export interface HotReloadOptions {
  hot?: HotCapability | null;
  embedded?: boolean;
  isCode?(path: string): boolean;
  now?(): number;
  timers?: Pick<TimerPort, "setTimeout" | "clearTimeout">;
  revealHoldMs?: number;
  ready?: "now" | "later";
}
export interface ActiveHotReloadBridge extends HotReloadBridge {
  active: true;
  live(): boolean;
}

export type HandoffTarget = "cowork" | "code" | "coworker";
export type ClaudeSendKind =
  | "staged"
  | "waiting"
  | "unanswered"
  | "sent"
  | "started"
  | "copied"
  | "failed";

export interface ClaudeSendMessage {
  (kind: ClaudeSendKind, suffix?: string): string;
  (kind: string, suffix?: string): string | undefined;
}
