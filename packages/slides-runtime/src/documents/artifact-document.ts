/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { CompiledPageParts } from "../environment/compiled-page";
import type { ArtifactComment, CommentOperation } from "../model/comments";
import type { SelfPublishError } from "./self-publish";

/** A review comment attached to the artifact (optionally anchored to an element, optionally with pasted images). */
export type { ArtifactComment };

/** What a caller supplies for a new comment; the document assigns `id` and `at`. */
export interface NewArtifactComment {
  text: string;
  author?: string;
  userId?: string;
  elementKey?: string;
  elementLabel?: string;
  images?: string[];
}

/** A pending change to the published comment list. */
export type ArtifactCommentOperation = CommentOperation;

/** Title, content and comments of an artifact. */
export interface ArtifactState<Content> {
  title: string;
  content: Content;
  comments: ArtifactComment[];
}

/** The persisted form of an artifact: any field may be missing or malformed until parsed. */
export interface RawArtifactState {
  title?: unknown;
  content?: unknown;
  comments?: unknown;
}

export type ArtifactSaveStatus =
  | "loading"
  | "ready"
  | "dirty"
  | "saving"
  | "saved"
  | "error"
  | "readonly";

/** Why a file could not be sent when publishing. */
export type UnsendableFileCause =
  | "name"
  | "kind"
  | "unreadable"
  | "damaged_text"
  | "size"
  | "other";

/** Where the document stands with saving; shown in the toolbar. */
export interface ArtifactSaveState {
  status: ArtifactSaveStatus;
  message?: string;
  /** Read-only was already known when the page booted. */
  atBoot?: boolean;
  /** Publish error code behind a failed save. */
  code?: string;
  /** The saved version is about to replace this page. */
  reloading?: boolean;
  /** Files left out of the publish (file-backed documents). */
  leftOut?: { id: string; cause: UnsendableFileCause }[];
}

/** Whether comment operations have reached the published page. */
export interface ArtifactCommentSync {
  status: "idle" | "publishing" | "blocked" | "error";
  pending: number;
  message?: string;
}

/** Notification payload of `ArtifactDocument.subscribe`. */
export interface ArtifactChange {
  /** The change came from another writer. */
  remote?: boolean;
}

/** An undoable action returned by `restoreStash`. */
export interface ArtifactStashRestore {
  label: string;
  do(): void;
  undo(): void;
}

/** What an undo step touched in a file-backed document, as reported by `takeTouched()`. */
export interface ArtifactTouchedSummary {
  paths: string[];
  index: boolean;
  structural: boolean;
}

/** The document model the editor edits, whichever storage backs it: the members every document has. */
export interface ArtifactDocumentCore<Content> {
  saveMode(): "auto" | "manual";
  state(): ArtifactState<Content>;
  content(): Content;
  title(): string;
  comments(): ArtifactComment[];
  dirty(): boolean;
  readOnly(): boolean;
  saveState(): ArtifactSaveState;
  commentSync(): ArtifactCommentSync;
  pendingCommentIds(): Set<string>;
  retryCommentPublish(): void;
  setContent(content: Content): void;
  updateContent(
    update: (content: Content) => Content,
    options?: { auto?: boolean },
  ): void;
  /** Merges a remote version: receives the published and the local content. */
  adoptRemote?(
    merge: (
      published: Content,
      local: Content,
    ) => { base: Content; current: Content; dirty?: boolean },
  ): void;
  setTitle(title: string): void;
  addComment(comment: NewArtifactComment): ArtifactComment | undefined;
  removeComment(id: string): void;
  documentBytes(): number;
  save(): Promise<void>;
  /** Unsaved edits found at boot that can be offered back. */
  stashOffer(): { at: number } | undefined;
  restoreStash(): ArtifactStashRestore | undefined;
  discardStash(): void;
  restoreCount(): number;
  subscribe(listener: (change?: ArtifactChange) => void): () => void;
  subscribeSave(listener: (state: ArtifactSaveState) => void): () => void;
}

/**
 * The document kept in the page itself. The members only a file-backed
 * document has are declared `undefined`, so that checking one of them
 * (`typeof doc.slideRev === "function"`) narrows the union.
 */
export interface EmbeddedArtifactDocument<Content>
  extends ArtifactDocumentCore<Content> {
  loadState?: undefined;
  subscribeLoad?: undefined;
  commit?: undefined;
  slideRev?: undefined;
  clashLocal?: undefined;
  takeTouched?: undefined;
  structureRev?: undefined;
}

/** A document stored as files, which loads asynchronously and tracks per-slide revisions. */
export interface FileBackedArtifactDocument<Content>
  extends ArtifactDocumentCore<Content> {
  /** "live" once the content has finished loading. */
  loadState(): string;
  subscribeLoad(listener: () => void): () => void;
  /** Flush pending edits to storage. */
  commit(reason?: string): void;
  /** How many times the slide has been rewritten. */
  slideRev(slideId: string): number;
  /** The slide is in conflict with the stored version. */
  clashLocal(slideId: string): boolean;
  /** Takes what the steps since the last call touched. */
  takeTouched(): ArtifactTouchedSummary;
  /** How many times the slide order or sections have been rewritten. */
  structureRev(): number;
  /** Applies a remote version that was held back while the document at the path was being edited. */
  releaseHold(documentPath: string): void;
}

/** The document model the editor edits, whichever storage backs it. */
export type ArtifactDocument<Content> =
  | EmbeddedArtifactDocument<Content>
  | FileBackedArtifactDocument<Content>;

/** A single-value storage cell (session storage, or an in-memory stand-in). */
export interface StorageSlot<Value> {
  read(): Value | null;
  write(value: Value): boolean;
  clear(): void;
}

/** The static parts of the page around the embedded state (see compiled-page). */
export type ArtifactPageParts = CompiledPageParts;

/** How a document turns persisted content into the editor model and back. */
export interface ArtifactContentCodec<Content> {
  parseContent(input: unknown): Content;
  /** Content as stored; defaults to the model itself. */
  serializeContent?(content: Content, title: string): unknown;
  /** A reason the content must not be edited or saved, or undefined. */
  contentHold?(rawContent: unknown): string | undefined;
  initialContent: Content;
  defaultTitle?: string;
}

/** What the publish hook receives besides the page: the states being replaced. */
export interface ArtifactPublishDetails {
  published: ArtifactState<unknown>;
  base: ArtifactState<unknown>;
}

/** What a publish reports back; `reloads: false` means the page is not replaced. */
export interface ArtifactPublishOutcome {
  reloads?: boolean;
}

export type ArtifactPublisher = (
  page: string,
  details?: ArtifactPublishDetails,
) => Promise<ArtifactPublishOutcome | undefined>;

/** Environment-level options for `createArtifactDocument`; set once at boot. */
export interface ArtifactDocumentEnvironment {
  publish?: ArtifactPublisher;
  /** Publishing does not rewrite the page (the publisher stores the state itself). */
  publishesPage?: boolean;
  /** The publisher goes through the host frame, so live capability checks still apply. */
  publishWrapsFrame?: boolean;
  canPublish?: boolean;
  embeddedState?: RawArtifactState;
  pageParts?: ArtifactPageParts;
  stash?: StorageSlot<string>;
  /** Persists the read-only reason across reloads. */
  roFlag?: StorageSlot<string>;
}

export interface ArtifactDocumentOptions<Content>
  extends ArtifactContentCodec<Content>,
    ArtifactDocumentEnvironment {}

/** Save status reported by the `window.appifact` auto-saving runtime. */
export type AppifactSavingStatus = "idle" | "saving" | "error" | "readonly";

/** One change reported by `appifact.doc.observe`. */
export interface AppifactDocChange {
  origin?: string;
  key: string;
  value: unknown;
}

/** The `window.appifact` runtime: the host stores and syncs the document itself. */
export interface AppifactRuntime {
  saving: {
    mode: string;
    status: AppifactSavingStatus;
    pending: number;
    lastError?: { message?: string };
    onStatus(
      listener: (
        status: AppifactSavingStatus,
        detail?: { message?: string },
      ) => void,
    ): void;
    save(): Promise<unknown>;
  };
  doc: {
    observe(
      path: string,
      listener: (changes: AppifactDocChange[]) => void,
    ): void;
    set(key: string, value: unknown): Promise<unknown>;
    getAll(): Promise<RawArtifactState>;
  };
}

/** A probed auto-saving runtime with the document it had when probed. */
export interface AutoSavingArtifactRuntime {
  runtime: AppifactRuntime;
  snapshot: RawArtifactState;
}

/** Options for a document stored by the auto-saving runtime. */
export interface RuntimeArtifactDocumentOptions<Content>
  extends ArtifactContentCodec<Content>,
    AutoSavingArtifactRuntime {}

/** Unsaved state kept in the stash slot, as parsed from storage. */
export interface ParsedArtifactStash {
  at: number;
  state: unknown;
  ops: unknown;
  expectEmbed: string | undefined;
}

/** Stash entry as stored (versions 1 and 2). */
interface StoredArtifactStash {
  v?: unknown;
  at?: unknown;
  state?: unknown;
  ops?: unknown;
  expectEmbed?: unknown;
}

/** Unsaved state offered back to the user at boot. */
interface ArtifactStashOffer<Content> {
  at: number;
  state: ArtifactState<Content>;
}

declare module "../bindings" {
  interface RuntimeBindings {
    MAX_ARTIFACT_TITLE_CHARS: number;
    normalizeArtifactTitle: (title?: unknown) => string | undefined;
    normalizeTitleInput: (title: string) => string;
    createRuntimeArtifactDocument: <Content>(
      options: RuntimeArtifactDocumentOptions<Content>,
    ) => ArtifactDocument<Content>;
    autoSavingArtifactRuntime: AutoSavingArtifactRuntime | undefined;
    setAutoSavingArtifactRuntime: (
      input: AutoSavingArtifactRuntime | undefined,
    ) => void;
    getAutoSavingArtifactRuntime: () => AutoSavingArtifactRuntime | undefined;
    detectAutoSavingArtifactRuntime: () => Promise<void>;
    READ_ONLY_ARTIFACT_MESSAGE: string;
    ARTIFACT_STASH_PREFIX: string;
    ARTIFACT_READ_ONLY_PREFIX: string;
    artifactStashKey: (path: string) => string;
    createSessionStorageSlot: (key: string) => StorageSlot<string>;
    currentArtifactStash: () => StorageSlot<string>;
    readCurrentArtifactReadOnlyReason: () => string | null;
    currentArtifactReadOnlySlot: () => StorageSlot<string>;
    hashArtifactState: (text: string) => string;
    parseArtifactStash: (text: string | null) => ParsedArtifactStash | undefined;
    parseEmbeddedArtifactState: <Content>(
      state: unknown,
      options: ArtifactContentCodec<Content>,
    ) => ArtifactState<Content>;
    createArtifactDocument: <Content>(
      options: ArtifactDocumentOptions<Content>,
    ) => ArtifactDocument<Content>;
  }
}

export function installDocumentsArtifactDocument(
  runtime: RuntimeBindings,
): () => void {
  var MAX_ARTIFACT_TITLE_CHARS: number;
  var autoSavingArtifactRuntime: AutoSavingArtifactRuntime | undefined;
  var READ_ONLY_ARTIFACT_MESSAGE: string;
  var ARTIFACT_STASH_PREFIX: string;
  var ARTIFACT_READ_ONLY_PREFIX: string;
  function normalizeArtifactTitle(title?: unknown): string | undefined {
    if (typeof title === "string" && title.length > 0) {
      return (0, runtime.truncateUtf16Safely)(title, MAX_ARTIFACT_TITLE_CHARS);
    } else {
      return undefined;
    }
  }
  function normalizeTitleInput(title: string): string {
    return (0, runtime.truncateUtf16Safely)(
      title.trim(),
      MAX_ARTIFACT_TITLE_CHARS,
    );
  }
  function createRuntimeArtifactDocument<Content>(
    options: RuntimeArtifactDocumentOptions<Content>,
  ): ArtifactDocument<Content> {
    let runtime2 = options.runtime;
    function parseContent(input: unknown): Content {
      try {
        return options.parseContent(input);
      } catch {
        return options.initialContent;
      }
    }
    let defaultTitle = options.defaultTitle ?? "Untitled",
      snapshot: ArtifactState<Content> = {
        title: normalizeArtifactTitle(options.snapshot.title) ?? defaultTitle,
        content: parseContent(options.snapshot.content),
        comments: (0, runtime.normalizeComments)(options.snapshot.comments),
      },
      readOnly = runtime2.saving.status === "readonly",
      contentHoldReason: string | undefined = options.contentHold?.(
        options.snapshot.content,
      ),
      saveError: string | undefined =
        runtime2.saving.status === "error"
          ? (runtime2.saving.lastError?.message ??
            "Autosave failed — retrying.")
          : undefined,
      saving = runtime2.saving.status === "saving",
      pendingCommentIds = new Set<string>(),
      documentSubscribers = new Set<(change?: ArtifactChange) => void>(),
      saveSubscribers = new Set<(state: ArtifactSaveState) => void>();
    function getSaveState(): ArtifactSaveState {
      if (contentHoldReason !== undefined) {
        return {
          status: "readonly",
          message: contentHoldReason,
        };
      }
      if (readOnly) {
        return {
          status: "readonly",
          message: "This view cannot edit the document.",
        };
      }
      if (saveError !== undefined) {
        return {
          status: "error",
          message: saveError,
        };
      }
      if (saving || runtime2.saving.pending > 0) {
        return {
          status: "saving",
        };
      }
      return {
        status: "ready",
      };
    }
    function notifySubscribers2(): void {
      for (let value2 of [...documentSubscribers]) value2();
      let value = getSaveState();
      for (let value2 of [...saveSubscribers]) value2(value);
    }
    runtime2.saving.onStatus((input, options2) => {
      saving = input === "saving";
      if (input === "readonly") {
        readOnly = true;
      }
      if (input === "error") {
        saveError = options2?.message ?? "Autosave failed — retrying.";
      } else if (input === "idle" || input === "readonly") {
        saveError = undefined;
      }
      if (input === "idle") {
        pendingCommentIds.clear();
      }
      notifySubscribers2();
    });
    runtime2.doc.observe("", (input) => {
      let flag = false;
      for (let value of input) {
        if (value.origin === "local") {
          continue;
        }
        if (value.key === "title") {
          snapshot.title = normalizeArtifactTitle(value.value) ?? defaultTitle;
          flag = true;
        } else if (value.key === "content") {
          snapshot.content = parseContent(value.value);
          contentHoldReason = options.contentHold?.(value.value);
          flag = true;
        } else if (value.key === "comments") {
          snapshot.comments = (0, runtime.normalizeComments)(value.value);
          flag = true;
        }
      }
      if (flag) {
        notifySubscribers2();
      }
    });
    let serializeContent = (input: Content): unknown =>
      options.serializeContent !== undefined
        ? options.serializeContent(input, snapshot.title)
        : input;
    function setRuntimeField(input: string, options2: unknown): void {
      runtime2.doc.set(input, options2).catch(() => {
        saveError = "Autosave failed — the change may not be stored.";
        notifySubscribers2();
      });
    }
    return {
      saveMode: () => "auto",
      title: () => snapshot.title,
      setTitle: (input) => {
        if (contentHoldReason !== undefined) {
          return;
        }
        let value = normalizeTitleInput(input);
        if (value.length === 0 || value === snapshot.title) {
          return;
        }
        snapshot.title = value;
        setRuntimeField("title", value);
        if (options.serializeContent !== undefined) {
          setRuntimeField("content", serializeContent(snapshot.content));
        }
        (0, runtime.recordArtifactEdit)();
        notifySubscribers2();
      },
      content: () => snapshot.content,
      setContent: (input) => {
        if (contentHoldReason !== undefined || input === snapshot.content) {
          return;
        }
        snapshot.content = input;
        setRuntimeField("content", serializeContent(input));
        (0, runtime.recordArtifactEdit)();
        notifySubscribers2();
      },
      updateContent: (input, options2) => {
        if (contentHoldReason !== undefined) {
          return;
        }
        let value = input(snapshot.content);
        if (value === snapshot.content) {
          return;
        }
        snapshot.content = value;
        setRuntimeField("content", serializeContent(value));
        if (options2?.auto !== true) {
          (0, runtime.recordArtifactEdit)();
        }
        notifySubscribers2();
      },
      state: () => snapshot,
      comments: () => snapshot.comments,
      addComment: (input) => {
        if (snapshot.comments.length >= runtime.MAX_ARTIFACT_COMMENTS) {
          return;
        }
        let value: ArtifactComment | undefined = (0, runtime.normalizeComments)(
          [
            {
              ...input,
              id: crypto.randomUUID().slice(0, 8),
              at: Date.now(),
            },
          ],
        )[0];
        if (!value) {
          return;
        }
        snapshot.comments = [...snapshot.comments, value];
        pendingCommentIds.add(value.id);
        setRuntimeField("comments", snapshot.comments);
        notifySubscribers2();
        return value;
      },
      removeComment: (input) => {
        let value = snapshot.comments.filter((input2) => input2.id !== input);
        if (value.length === snapshot.comments.length) {
          return;
        }
        snapshot.comments = value;
        pendingCommentIds.delete(input);
        setRuntimeField("comments", snapshot.comments);
        notifySubscribers2();
      },
      commentSync: () => {
        let size = pendingCommentIds.size;
        if (readOnly && size > 0) {
          return {
            status: "blocked",
            pending: size,
            message: "This view cannot edit the document.",
          };
        }
        if (saveError !== undefined && size > 0) {
          return {
            status: "error",
            pending: size,
            message: saveError,
          };
        }
        if (size > 0) {
          return {
            status: "publishing",
            pending: size,
          };
        }
        return {
          status: "idle",
          pending: 0,
        };
      },
      pendingCommentIds: () => new Set(pendingCommentIds),
      retryCommentPublish: () => {
        runtime2.saving.save().catch(() => {});
      },
      dirty: () => false,
      readOnly: () => readOnly || contentHoldReason !== undefined,
      saveState: getSaveState,
      documentBytes: () =>
        new TextEncoder().encode(JSON.stringify(snapshot)).length,
      save: async () => {
        if (readOnly) {
          return;
        }
        await runtime2.saving.save().catch(() => {});
        notifySubscribers2();
      },
      stashOffer: (): undefined => {
        return;
      },
      restoreStash: (): undefined => {
        return;
      },
      discardStash: () => {
        return;
      },
      restoreCount: () => 0,
      subscribe: (input) => {
        documentSubscribers.add(input);
        return () => documentSubscribers.delete(input);
      },
      subscribeSave: (input) => {
        saveSubscribers.add(input);
        return () => saveSubscribers.delete(input);
      },
    };
  }
  function setAutoSavingArtifactRuntime(
    input: AutoSavingArtifactRuntime | undefined,
  ): void {
    autoSavingArtifactRuntime = input;
  }
  function getAutoSavingArtifactRuntime(): AutoSavingArtifactRuntime | undefined {
    return autoSavingArtifactRuntime;
  }
  async function detectAutoSavingArtifactRuntime(): Promise<void> {
    if (typeof window === "undefined") {
      return;
    }
    let value: Window & { appifact?: { ready(): Promise<AppifactRuntime> } } =
      window;
    if (value.appifact === undefined) {
      return;
    }
    try {
      let value2 = await value.appifact.ready();
      if (value2.saving.mode !== "auto") {
        return;
      }
      let value3 = await value2.doc.getAll();
      setAutoSavingArtifactRuntime({
        runtime: value2,
        snapshot: value3,
      });
    } catch (value2: unknown) {
      console.error(
        "appifact runtime probe failed — booting the frame model",
        value2,
      );
    }
  }
  function artifactStashKey(input: string): string {
    return (
      ARTIFACT_STASH_PREFIX + (0, runtime.normalizeArtifactSessionPath)(input)
    );
  }
  function createSessionStorageSlot(key: string): StorageSlot<string> {
    return {
      read(): string | null {
        try {
          return sessionStorage.getItem(key);
        } catch {
          return null;
        }
      },
      write(input: string): boolean {
        try {
          sessionStorage.setItem(key, input);
          return true;
        } catch {
          return false;
        }
      },
      clear(): void {
        try {
          sessionStorage.removeItem(key);
        } catch {}
      },
    };
  }
  function currentArtifactStash(): StorageSlot<string> {
    return createSessionStorageSlot(artifactStashKey(location.pathname));
  }
  function readCurrentArtifactReadOnlyReason(): string | null {
    let value = currentArtifactReadOnlySlot().read();
    if (value !== null && value.length > 0) {
      return value;
    } else {
      return null;
    }
  }
  function currentArtifactReadOnlySlot(): StorageSlot<string> {
    if (typeof location === "undefined") {
      return {
        read: () => null,
        write: () => false,
        clear: () => {
          return;
        },
      };
    }
    return createSessionStorageSlot(
      ARTIFACT_READ_ONLY_PREFIX +
        artifactStashKey(location.pathname).slice(ARTIFACT_STASH_PREFIX.length),
    );
  }
  function hashArtifactState(text: string): string {
    let firstHash = 3735928559,
      secondHash = 1103547991;
    for (let index = 0; index < text.length; index++) {
      let value = text.charCodeAt(index);
      firstHash = Math.imul(firstHash ^ value, 2654435761);
      secondHash = Math.imul(secondHash ^ value, 1597334677);
    }
    firstHash =
      Math.imul(firstHash ^ (firstHash >>> 16), 2246822507) ^
      Math.imul(secondHash ^ (secondHash >>> 13), 3266489909);
    secondHash =
      Math.imul(secondHash ^ (secondHash >>> 16), 2246822507) ^
      Math.imul(firstHash ^ (firstHash >>> 13), 3266489909);
    return (
      (secondHash >>> 0).toString(16).padStart(8, "0") +
      (firstHash >>> 0).toString(16).padStart(8, "0")
    );
  }
  function parseArtifactStash(
    text: string | null,
  ): ParsedArtifactStash | undefined {
    if (text === null) {
      return;
    }
    try {
      let value: StoredArtifactStash | null = JSON.parse(text);
      if (
        typeof value === "object" &&
        value !== null &&
        (value.v === 2 || value.v === 1) &&
        typeof value.at === "number" &&
        "state" in value
      ) {
        let value2 = value as StoredArtifactStash & { at: number };
        return {
          at: value2.at,
          state: value2.state,
          ops: value2.ops,
          expectEmbed:
            typeof value2.expectEmbed === "string"
              ? value2.expectEmbed
              : undefined,
        };
      }
    } catch {}
    return;
  }
  function parseEmbeddedArtifactState<Content>(
    state: unknown,
    options: ArtifactContentCodec<Content>,
  ): ArtifactState<Content> {
    let record: RawArtifactState =
        typeof state === "object" && state !== null ? state : {},
      content: Content;
    try {
      content = options.parseContent(record.content);
    } catch {
      content = options.initialContent;
    }
    return {
      title:
        normalizeArtifactTitle(record.title) ??
        options.defaultTitle ??
        "Appifact",
      content: content,
      comments: (0, runtime.normalizeComments)(record.comments),
    };
  }
  function createArtifactDocument<Content>(
    options: ArtifactDocumentOptions<Content>,
  ): ArtifactDocument<Content> {
    let autoSaveRuntime = getAutoSavingArtifactRuntime();
    if (
      autoSaveRuntime !== undefined &&
      options.publish === undefined &&
      options.canPublish === undefined &&
      options.embeddedState === undefined &&
      options.pageParts === undefined
    ) {
      return createRuntimeArtifactDocument({
        runtime: autoSaveRuntime.runtime,
        snapshot: autoSaveRuntime.snapshot,
        parseContent: options.parseContent,
        ...(options.serializeContent !== undefined
          ? {
              serializeContent: options.serializeContent,
            }
          : {}),
        ...(options.contentHold !== undefined
          ? {
              contentHold: options.contentHold,
            }
          : {}),
        initialContent: options.initialContent,
        ...(options.defaultTitle !== undefined
          ? {
              defaultTitle: options.defaultTitle,
            }
          : {}),
      });
    }
    let pageParts: ArtifactPageParts =
        options.pageParts ??
        (0, runtime.readCompiledPageAnatomy)(globalThis.document),
      embeddedState: RawArtifactState | undefined =
        options.embeddedState !== undefined
          ? options.embeddedState
          : (0, runtime.readCompiledPageDocument)(globalThis.document) as
              | RawArtifactState
              | undefined,
      stash = options.stash ?? currentArtifactStash(),
      readOnlyFlag = options.roFlag ?? currentArtifactReadOnlySlot(),
      canPublish = options.canPublish ?? (0, runtime.selfPublishAvailable)(),
      publishedState = parseEmbeddedArtifactState(embeddedState, options),
      embeddedStateHash = hashArtifactState(
        (0, runtime.stringifyInlineJson)(serializeEnvelope(publishedState)),
      ),
      localState = publishedState,
      pendingCommentOperations: ArtifactCommentOperation[] = [],
      dirty = false,
      restoreCount = 0,
      saving = false,
      saveError: string | undefined,
      saveErrorCode: string | undefined,
      hasSaved = false,
      reloading = false,
      contentHoldReason: string | undefined = options.contentHold?.(
        embeddedState?.content,
      ),
      readOnly = contentHoldReason !== undefined || !canPublish,
      readOnlyAtBoot = false,
      readOnlyReason: string | undefined =
        contentHoldReason ??
        (canPublish
          ? undefined
          : "This view’s runtime does not offer self-publish (window." +
            "slidesHost.self is absent) — content can be viewed but not saved " +
            "from here.");
    if (!readOnly) {
      let value = readOnlyFlag.read();
      if (value !== null && value.length > 0) {
        readOnly = true;
        readOnlyReason = value;
      }
    }
    let publishingComments = false,
      commentPublishError: string | undefined,
      flag = false,
      documentSubscribers = new Set<(change?: ArtifactChange) => void>(),
      saveSubscribers = new Set<(state: ArtifactSaveState) => void>();
    function getSaveState(): ArtifactSaveState {
      if (readOnly) {
        if (readOnlyAtBoot) {
          return {
            status: "readonly",
            message: readOnlyReason,
            atBoot: true,
          };
        } else {
          return {
            status: "readonly",
            message: readOnlyReason,
          };
        }
      }
      let value: ArtifactSaveState = saving
        ? {
            status: "saving",
          }
        : saveError !== undefined
          ? {
              status: "error",
              message: saveError,
              ...(saveErrorCode !== undefined
                ? {
                    code: saveErrorCode,
                  }
                : {}),
            }
          : {
              status: dirty ? "dirty" : hasSaved ? "saved" : "ready",
            };
      if (reloading) {
        return {
          ...value,
          reloading: true,
        };
      } else {
        return value;
      }
    }
    function getCommentSyncState(): ArtifactCommentSync {
      let length = (0, runtime.applicableCommentOperations)(
        publishedState.comments,
        pendingCommentOperations,
      ).length;
      if (readOnly && length > 0) {
        return {
          status: "blocked",
          pending: length,
          message: readOnlyReason,
        };
      }
      if (commentPublishError !== undefined) {
        return {
          status: "error",
          pending: length,
          message: commentPublishError,
        };
      }
      if (publishingComments || length > 0) {
        return {
          status: "publishing",
          pending: length,
        };
      }
      return {
        status: "idle",
        pending: 0,
      };
    }
    let notificationOwed = false;
    function flushOwedNotification(): void {
      if (!notificationOwed) {
        return;
      }
      notificationOwed = false;
      queueMicrotask(() => notifyDocumentSubscribers());
    }
    function notifyDocumentSubscribers(input?: ArtifactChange): void {
      if (documentSubscribers.size === 0) {
        notificationOwed = true;
      }
      for (let value of documentSubscribers) value(input);
      notifySaveSubscribers();
    }
    function notifySaveSubscribers(): void {
      if (saveSubscribers.size === 0) {
        notificationOwed = true;
      }
      let value = getSaveState();
      for (let value2 of saveSubscribers) value2(value);
    }
    let stashWriteSucceeded = true,
      stashOffer: ArtifactStashOffer<Content> | undefined,
      expectedEmbeddedStateHash: string | undefined;
    function writeStash(): boolean {
      let value = pendingCommentOperations,
        value2 = stashOffer ? stashOffer.state : localState;
      stashWriteSucceeded = stash.write(
        JSON.stringify({
          v: 2,
          at: stashOffer ? stashOffer.at : Date.now(),
          state: value2,
          ...(value.length > 0
            ? {
                ops: value,
              }
            : {}),
          ...(expectedEmbeddedStateHash !== undefined && !stashOffer
            ? {
                expectEmbed: expectedEmbeddedStateHash,
              }
            : {}),
        }),
      );
      return stashWriteSucceeded;
    }
    {
      let value = parseArtifactStash(stash.read());
      if (value) {
        let value2 = parseEmbeddedArtifactState(value.state, options),
          callback = (input: ArtifactState<Content>): unknown =>
            options.serializeContent !== undefined
              ? options.serializeContent(input.content, input.title)
              : input.content,
          value3: ArtifactCommentOperation[] = (
            0,
            runtime.applicableCommentOperations
          )(
            publishedState.comments,
            (0, runtime.normalizeCommentOperations)(value.ops),
          );
        if (value3.length === 0 && value.ops === undefined) {
          let values = new Set(
            publishedState.comments.map((input) => input.id),
          );
          value3 = value2.comments
            .filter((input) => !values.has(input.id))
            .map(
              (input): ArtifactCommentOperation => ({
                op: "add",
                comment: input,
              }),
            );
        }
        let value4 =
          JSON.stringify({
            t: value2.title,
            c: callback(value2),
          }) ===
          JSON.stringify({
            t: publishedState.title,
            c: callback(publishedState),
          });
        pendingCommentOperations = value3;
        if (pendingCommentOperations.length > 0) {
          localState = {
            ...localState,
            comments: (0, runtime.applyCommentOperations)(
              publishedState.comments,
              pendingCommentOperations,
            ),
          };
        }
        if (value4) {
          if (pendingCommentOperations.length === 0) {
            stash.clear();
          } else {
            writeStash();
          }
        } else if (value.expectEmbed === embeddedStateHash) {
          localState = {
            title: value2.title,
            content: value2.content,
            comments: (0, runtime.applyCommentOperations)(
              publishedState.comments,
              pendingCommentOperations,
            ),
          };
          dirty = true;
          writeStash();
        } else {
          stashOffer = {
            at: value.at,
            state: value2,
          };
        }
      }
    }
    function markReadOnlyFromError(input: SelfPublishError): void {
      readOnly = true;
      readOnlyReason =
        input.code === "not_writer"
          ? READ_ONLY_ARTIFACT_MESSAGE
          : input.code === "consent_required"
            ? "Saving needs the self-publish permission this view declined (or has not answered). Reload and accept the prompt to edit."
            : "This view cannot save: " +
              input.message +
              " (" +
              input.code +
              ")";
      if (
        input.code === "not_writer" ||
        input.code === "not_declared" ||
        input.code === "capability_disabled" ||
        input.code === "capability_removed"
      ) {
        readOnlyFlag.write(readOnlyReason);
      }
    }
    function updateLocalState(
      input: ArtifactState<Content>,
      options2: boolean = false,
    ): void {
      localState = input;
      dirty = true;
      hasSaved = false;
      saveError = undefined;
      saveErrorCode = undefined;
      if (!options2) {
        stashOffer = undefined;
        (0, runtime.recordArtifactEdit)();
      }
      writeStash();
      notifyDocumentSubscribers();
    }
    function recomposeComments(): void {
      localState = {
        ...localState,
        comments: (0, runtime.applyCommentOperations)(
          publishedState.comments,
          pendingCommentOperations,
        ),
      };
      writeStash();
      notifyDocumentSubscribers();
    }
    function serializeEnvelope(
      input: ArtifactState<Content>,
    ): ArtifactState<unknown> {
      if (options.serializeContent !== undefined) {
        return {
          ...input,
          content: options.serializeContent(input.content, input.title),
        };
      } else {
        return input;
      }
    }
    function buildPublishedPage(input: ArtifactState<Content>): string {
      return (0, runtime.assembleCompiledPage)(
        {
          ...pageParts,
          title: input.title,
        },
        (0, runtime.stringifyInlineJson)(serializeEnvelope(input)),
      );
    }
    async function publishPage(
      input: string,
      options2?: ArtifactPublishDetails,
    ): Promise<ArtifactPublishOutcome | undefined> {
      return (options.publish ?? (0, runtime.createSelfPublisher)())(
        input,
        options2,
      );
    }
    let publishChain = Promise.resolve();
    function serializePublish(input: () => Promise<void>): Promise<void> {
      let value = publishChain.then(input, input);
      publishChain = value.then(
        () => {
          return;
        },
        () => {
          return;
        },
      );
      return value;
    }
    function publishPendingComments(): void {
      if (readOnly || publishingComments) {
        return;
      }
      if (
        (0, runtime.applicableCommentOperations)(
          publishedState.comments,
          pendingCommentOperations,
        ).length === 0
      ) {
        return;
      }
      publishingComments = true;
      commentPublishError = undefined;
      notifyDocumentSubscribers();
      let flag2 = false;
      serializePublish(async () => {
        try {
          let value: ArtifactCommentOperation[] = (
            0,
            runtime.applicableCommentOperations
          )(publishedState.comments, pendingCommentOperations);
          if (value.length === 0) {
            return;
          }
          let state: ArtifactState<Content> = {
            title: publishedState.title,
            content: publishedState.content,
            comments: (0, runtime.applyCommentOperations)(
              publishedState.comments,
              value,
            ),
          };
          if (
            JSON.stringify(state.comments) ===
            JSON.stringify(publishedState.comments)
          ) {
            let values = new Set(value);
            pendingCommentOperations = pendingCommentOperations.filter(
              (input) => !values.has(input),
            );
            localState = {
              ...localState,
              comments: (0, runtime.applyCommentOperations)(
                publishedState.comments,
                pendingCommentOperations,
              ),
            };
            writeStash();
            return;
          }
          let value2 = buildPublishedPage(state);
          if (
            new TextEncoder().encode(value2).length >
            runtime.compiledPageMaxBytes
          ) {
            commentPublishError =
              "The document is over the 16 MiB limit — the comment is " +
              "kept locally but cannot publish until content shrinks.";
            return;
          }
          expectedEmbeddedStateHash = hashArtifactState(
            (0, runtime.stringifyInlineJson)(
              serializeEnvelope(
                parseEmbeddedArtifactState(
                  JSON.parse(JSON.stringify(state)),
                  options,
                ),
              ),
            ),
          );
          writeStash();
          if (dirty && !stashWriteSucceeded) {
            expectedEmbeddedStateHash = undefined;
            commentPublishError =
              "Comment held: you have unsaved edits that could NOT be kept locally (this document is too large to stash), and posting the comment reloads the page. Save your edits first, then retry.";
            return;
          }
          try {
            await publishPage(value2);
          } catch (value3: unknown) {
            if (
              (0, runtime.normalizeSelfPublishError)(value3).code !==
              "upstream_error"
            ) {
              throw value3;
            }
            await new Promise((input) =>
              setTimeout(input, 400 + Math.random() * 1200),
            );
            await publishPage(value2);
          }
          publishedState = state;
          pendingCommentOperations = (0, runtime.applicableCommentOperations)(
            publishedState.comments,
            pendingCommentOperations,
          );
          localState = {
            ...localState,
            comments: (0, runtime.applyCommentOperations)(
              publishedState.comments,
              pendingCommentOperations,
            ),
          };
          writeStash();
        } catch (value: unknown) {
          expectedEmbeddedStateHash = undefined;
          let value2 = (0, runtime.normalizeSelfPublishError)(value);
          if (value2.code === "conflict") {
            flag2 = true;
          } else if (
            runtime.SELF_PUBLISH_PERMISSION_ERROR_CODES.includes(value2.code)
          ) {
            markReadOnlyFromError(value2);
          } else if (value2.code === "rate_limited") {
            commentPublishError =
              "Commenting too frequently — will retry in a moment.";
            setTimeout(
              () => {
                commentPublishError = undefined;
                publishPendingComments();
              },
              4000 + Math.random() * 3000,
            );
          } else {
            commentPublishError =
              "Comment not published (" +
              value2.message +
              ") — it is kept here; use retry to try again.";
          }
          writeStash();
        } finally {
          publishingComments = false;
          notifyDocumentSubscribers();
          if (!flag2 && commentPublishError === undefined && !readOnly) {
            publishPendingComments();
          }
        }
      });
    }
    async function save(): Promise<void> {
      if (readOnly || saving || !dirty) {
        return;
      }
      saving = true;
      saveError = undefined;
      saveErrorCode = undefined;
      notifySaveSubscribers();
      let { title: value, content: value2 } = localState;
      await serializePublish(async () => {
        try {
          writeStash();
          let value3: ArtifactCommentOperation[] = (
              0,
              runtime.applicableCommentOperations
            )(publishedState.comments, pendingCommentOperations),
            state: ArtifactState<Content> = {
              title: value,
              content: value2,
              comments: (0, runtime.applyCommentOperations)(
                publishedState.comments,
                value3,
              ),
            },
            value4 =
              options.publishesPage === false && options.publish !== undefined
                ? ""
                : buildPublishedPage(state),
            length = new TextEncoder().encode(value4).length;
          if (length > runtime.compiledPageMaxBytes) {
            saveError =
              "The document is " +
              String(Math.round(length / 1024 / 1024)) +
              " MiB — over the 16 MiB limit. Remove or shrink images " +
              "(the usual culprit) and save again.";
            return;
          }
          let value5: ArtifactPublishDetails | undefined =
              options.publish !== undefined
                ? {
                    published: serializeEnvelope(state),
                    base: serializeEnvelope(publishedState),
                  }
                : undefined,
            value6: ArtifactPublishOutcome | undefined;
          try {
            value6 = await publishPage(value4, value5);
          } catch (value7: unknown) {
            if (
              (0, runtime.normalizeSelfPublishError)(value7).code !==
              "upstream_error"
            ) {
              throw value7;
            }
            await new Promise((input) =>
              setTimeout(input, 400 + Math.random() * 1200),
            );
            value6 = await publishPage(value4, value5);
          }
          publishedState = state;
          pendingCommentOperations = (0, runtime.applicableCommentOperations)(
            publishedState.comments,
            pendingCommentOperations,
          );
          localState = {
            ...localState,
            comments: (0, runtime.applyCommentOperations)(
              publishedState.comments,
              pendingCommentOperations,
            ),
          };
          if (value6?.reloads !== false) {
            reloading = true;
          }
          if (localState.title === value && localState.content === value2) {
            dirty = false;
            hasSaved = value6?.reloads !== false;
            if (pendingCommentOperations.length === 0) {
              commentPublishError = undefined;
            }
            if (hasSaved || stashOffer || pendingCommentOperations.length > 0) {
              writeStash();
            } else {
              stash.clear();
            }
            if (!hasSaved) {
              publishPendingComments();
            }
          } else if (!stashWriteSucceeded && value6?.reloads !== false) {
            saveError =
              "Saved — but you kept typing during the save, and those newer " +
              "changes could NOT be kept locally (this document is too large to stash). Copy anything important now: the page is about to reload to the version without them.";
          }
        } catch (value3: unknown) {
          let value4 = (0, runtime.normalizeSelfPublishError)(value3);
          saveErrorCode = value4.code;
          if (value4.code === "conflict") {
            saveError = stashWriteSucceeded
              ? "Someone saved a newer version first — loading it now. Your " +
                "changes are kept and will be offered for restore."
              : "Someone saved a newer version first — loading it now. Your " +
                "changes could NOT be kept locally (this document is too large to stash), so copy anything important before the reload.";
          } else if (
            runtime.SELF_PUBLISH_PERMISSION_ERROR_CODES.includes(value4.code)
          ) {
            markReadOnlyFromError(value4);
          } else if (value4.say !== undefined) {
            saveError = value4.say;
          } else if (value4.code === "rate_limited") {
            saveError =
              "Not saved (" +
              value4.message +
              "). Your changes are kept; give it a moment, then save again.";
          } else if (
            value4.code === "invalid_content" ||
            value4.code === "transform_error"
          ) {
            saveError =
              "The store refused the document (" +
              value4.code +
              ": " +
              value4.message +
              "). This is usually a content problem — most often a pasted " +
              "replacement character (U+FFFD, the question-mark-in-a-box glyph), which the platform rejects; find and remove the odd character, then save again. If the content looks clean, this is an appifact bug.";
          } else if (value4.code === "too_large") {
            saveError =
              "The store refused the document as too large (16 MiB limit). Remove or shrink images and save again.";
          } else {
            saveError =
              "Saving failed (" +
              value4.message +
              "). Your changes are kept — " +
              "try again.";
          }
        } finally {
          saving = false;
          notifyDocumentSubscribers();
        }
      });
    }
    let canCheckLiveState =
        options.canPublish === undefined &&
        (options.publish === undefined || options.publishWrapsFrame === true),
      selfCapabilityReady: Promise<void> =
        !readOnly && canCheckLiveState && !(0, runtime.selfPublishInstalled)()
          ? (0, runtime.getSelfPublishCapability)().then((input) => {
              if (input !== null || readOnly) {
                return;
              }
              readOnly = true;
              readOnlyAtBoot = !dirty;
              readOnlyReason =
                "This view can't save: no publish path is available here.";
              notifyDocumentSubscribers();
            })
          : Promise.resolve();
    if (!readOnly && canCheckLiveState) {
      selfCapabilityReady
        .then(() =>
          readOnly
            ? null
            : Promise.all([
                (0, runtime.currentUserCanEditAsync)(),
                (0, runtime.getAssetsCapability)(),
              ]),
        )
        .then((input) => {
          if (
            input === null ||
            input[0] !== false ||
            input[1] !== null ||
            readOnly
          ) {
            return;
          }
          readOnly = true;
          readOnlyAtBoot = !dirty;
          readOnlyReason = READ_ONLY_ARTIFACT_MESSAGE;
          notifyDocumentSubscribers();
        });
    }
    if (!readOnly) {
      queueMicrotask(() => publishPendingComments());
    }
    return {
      saveMode: () => "manual",
      state: () => localState,
      content: () => localState.content,
      title: () => localState.title,
      comments: () => localState.comments,
      dirty: () => dirty,
      readOnly: () => readOnly,
      saveState: getSaveState,
      commentSync: getCommentSyncState,
      setContent(input) {
        if (input === localState.content) {
          return;
        }
        updateLocalState({
          ...localState,
          content: input,
        });
      },
      updateContent(input, options2) {
        let value = input(localState.content);
        if (value === localState.content) {
          return;
        }
        updateLocalState(
          {
            ...localState,
            content: value,
          },
          options2?.auto === true,
        );
      },
      adoptRemote(input) {
        let value = input(publishedState.content, localState.content);
        if (
          value.base === publishedState.content &&
          value.current === localState.content
        ) {
          return;
        }
        publishedState = {
          ...publishedState,
          content: value.base,
        };
        localState = {
          ...localState,
          content: value.current,
        };
        if (
          dirty &&
          !value.dirty &&
          localState.title === publishedState.title
        ) {
          dirty = false;
          if (!stashOffer && pendingCommentOperations.length === 0) {
            stash.clear();
          }
        }
        if (dirty) {
          writeStash();
        }
        notifyDocumentSubscribers({
          remote: true,
        });
      },
      setTitle(input) {
        let value = normalizeTitleInput(input);
        if (value.length === 0 || value === localState.title) {
          return;
        }
        updateLocalState({
          ...localState,
          title: value,
        });
      },
      addComment(input) {
        if (localState.comments.length >= runtime.MAX_ARTIFACT_COMMENTS) {
          return;
        }
        let value: ArtifactComment | undefined = (0, runtime.normalizeComments)(
          [
            {
              ...input,
              id: crypto.randomUUID().slice(0, 8),
              at: Date.now(),
            },
          ],
        )[0];
        if (!value) {
          return;
        }
        pendingCommentOperations = [
          ...pendingCommentOperations,
          {
            op: "add",
            comment: value,
          },
        ];
        recomposeComments();
        publishPendingComments();
        return value;
      },
      removeComment(input) {
        if (
          !pendingCommentOperations.some(
            (input2) => input2.op === "add" && input2.comment.id === input,
          ) &&
          !publishedState.comments.some((input2) => input2.id === input)
        ) {
          return;
        }
        pendingCommentOperations = [
          ...pendingCommentOperations.filter(
            (input2) => !(input2.op === "add" && input2.comment.id === input),
          ),
          {
            op: "remove",
            id: input,
          },
        ];
        recomposeComments();
        publishPendingComments();
      },
      pendingCommentIds() {
        let values = new Set<string>();
        for (let value of (0, runtime.applicableCommentOperations)(
          publishedState.comments,
          pendingCommentOperations,
        ) as ArtifactCommentOperation[])
          if (value.op === "add") {
            values.add(value.comment.id);
          }
        return values;
      },
      retryCommentPublish() {
        if (commentPublishError === undefined) {
          return;
        }
        commentPublishError = undefined;
        publishPendingComments();
      },
      documentBytes() {
        return new TextEncoder().encode(buildPublishedPage(localState)).length;
      },
      save: save,
      stashOffer: () =>
        stashOffer
          ? {
              at: stashOffer.at,
            }
          : undefined,
      restoreStash() {
        if (!stashOffer) {
          return;
        }
        let value = stashOffer,
          state = {
            title: localState.title,
            content: localState.content,
          };
        stashOffer = undefined;
        restoreCount += 1;
        updateLocalState({
          title: value.state.title,
          content: value.state.content,
          comments: (0, runtime.applyCommentOperations)(
            publishedState.comments,
            pendingCommentOperations,
          ),
        });
        return {
          label: "Restore unsaved changes",
          do() {
            stashOffer = undefined;
            updateLocalState({
              title: value.state.title,
              content: value.state.content,
              comments: (0, runtime.applyCommentOperations)(
                publishedState.comments,
                pendingCommentOperations,
              ),
            });
          },
          undo() {
            stashOffer = value;
            updateLocalState(
              {
                title: state.title,
                content: state.content,
                comments: (0, runtime.applyCommentOperations)(
                  publishedState.comments,
                  pendingCommentOperations,
                ),
              },
              true,
            );
            (0, runtime.recordArtifactEdit)();
          },
        };
      },
      restoreCount: () => restoreCount,
      discardStash() {
        if (!stashOffer) {
          return;
        }
        stashOffer = undefined;
        if (pendingCommentOperations.length === 0) {
          stash.clear();
        } else {
          writeStash();
        }
        notifyDocumentSubscribers();
      },
      subscribe(input) {
        documentSubscribers.add(input);
        flushOwedNotification();
        return () => documentSubscribers.delete(input);
      },
      subscribeSave(input) {
        saveSubscribers.add(input);
        flushOwedNotification();
        return () => saveSubscribers.delete(input);
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "MAX_ARTIFACT_TITLE_CHARS",
    () => MAX_ARTIFACT_TITLE_CHARS,
    (value) => {
      MAX_ARTIFACT_TITLE_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeArtifactTitle",
    () => normalizeArtifactTitle,
  );
  bindRuntimeValue(runtime, "normalizeTitleInput", () => normalizeTitleInput);
  bindRuntimeValue(
    runtime,
    "createRuntimeArtifactDocument",
    () => createRuntimeArtifactDocument,
  );
  bindRuntimeValue(
    runtime,
    "autoSavingArtifactRuntime",
    () => autoSavingArtifactRuntime,
    (value) => {
      autoSavingArtifactRuntime = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setAutoSavingArtifactRuntime",
    () => setAutoSavingArtifactRuntime,
  );
  bindRuntimeValue(
    runtime,
    "getAutoSavingArtifactRuntime",
    () => getAutoSavingArtifactRuntime,
  );
  bindRuntimeValue(
    runtime,
    "detectAutoSavingArtifactRuntime",
    () => detectAutoSavingArtifactRuntime,
  );
  bindRuntimeValue(
    runtime,
    "READ_ONLY_ARTIFACT_MESSAGE",
    () => READ_ONLY_ARTIFACT_MESSAGE,
    (value) => {
      READ_ONLY_ARTIFACT_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ARTIFACT_STASH_PREFIX",
    () => ARTIFACT_STASH_PREFIX,
    (value) => {
      ARTIFACT_STASH_PREFIX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ARTIFACT_READ_ONLY_PREFIX",
    () => ARTIFACT_READ_ONLY_PREFIX,
    (value) => {
      ARTIFACT_READ_ONLY_PREFIX = value;
    },
  );
  bindRuntimeValue(runtime, "artifactStashKey", () => artifactStashKey);
  bindRuntimeValue(
    runtime,
    "createSessionStorageSlot",
    () => createSessionStorageSlot,
  );
  bindRuntimeValue(runtime, "currentArtifactStash", () => currentArtifactStash);
  bindRuntimeValue(
    runtime,
    "readCurrentArtifactReadOnlyReason",
    () => readCurrentArtifactReadOnlyReason,
  );
  bindRuntimeValue(
    runtime,
    "currentArtifactReadOnlySlot",
    () => currentArtifactReadOnlySlot,
  );
  bindRuntimeValue(runtime, "hashArtifactState", () => hashArtifactState);
  bindRuntimeValue(runtime, "parseArtifactStash", () => parseArtifactStash);
  bindRuntimeValue(
    runtime,
    "parseEmbeddedArtifactState",
    () => parseEmbeddedArtifactState,
  );
  bindRuntimeValue(
    runtime,
    "createArtifactDocument",
    () => createArtifactDocument,
  );
  return () => {
    (0, runtime.initializeCompiledPage)();
    (0, runtime.initializeAssetStorage)();
    MAX_ARTIFACT_TITLE_CHARS = 200;
    READ_ONLY_ARTIFACT_MESSAGE =
      "You can view this artifact but not edit it. Saving needs write access from an owner.";
    ARTIFACT_STASH_PREFIX = "appifact-stash/";
    ARTIFACT_READ_ONLY_PREFIX = "appifact-ro/";
  };
}
