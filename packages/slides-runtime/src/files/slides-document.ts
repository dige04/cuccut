/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type {
  DeckContent,
  DeckIndex,
  FileSha,
  Slide,
  SlideId,
} from "../deck-contracts";
import type {
  ArtifactChange,
  ArtifactComment,
  ArtifactCommentSync,
  ArtifactSaveState,
  ArtifactState,
  ArtifactTouchedSummary,
  FileBackedArtifactDocument,
} from "../documents/artifact-document";
import type { SlideDocumentCodec } from "../documents/slide-codec";
import type { FilesBootEvent, EarlyHotSource } from "./boot-reader";
import type { FilesBootFailureKind } from "./boot-recovery";
import type { IndexFileStore } from "./index-store";
import type { FilePublishEntries } from "./publish-inputs";
import type { FileListing, FileTextRead } from "./read-retries";
import type {
  FilesSaveQueue,
  FilesSaveStuckState,
  FilesSaveTimers,
  FilesSaveUnsendable,
  SaveQueuePort,
  SaveQueuePublishResult,
  SaveQueueRemoteChange,
  SaveQueueRemoteFile,
} from "./save-queue";
import type { SlideOrderMergeResult } from "./slide-order-merge";
import type {
  DecomposedFilesEnvelope,
  SlideCodecCarry,
  SlidesFileCodec,
} from "./slide-codec";
import type { UnloadFlushPending } from "./unload-flush";
import type {
  KeptSlideReason,
  UnsavedSlide,
  UnsavedSlideStash,
} from "./unsaved-slides";

/** Which side wins when the deck's slide files changed under a local edit. */
export type LocalSlideRecoveryOrigin = "mine" | "theirs";

/** "loading" until the deck's files were read, "live" afterwards, "failed" when they could not be. */
export type SlidesFilesLoadState = "loading" | "live" | "failed";

/** A file's bytes as read from the files port. */
export interface SlidesFilesBytes {
  bytes: Uint8Array;
  sha256: string;
  contentType: string;
}

/** The files port the deck document reads and publishes through. */
export interface SlidesFilesPort extends SaveQueuePort {
  /** This tab may write and the listing is not narrowed. */
  readonly canWrite: boolean;
  readText(path: string): Promise<FileTextRead>;
  readBytes(path: string): Promise<SlidesFilesBytes>;
}

/** Where speaker notes are kept when they are not inside the slide files. */
export interface SlidesFilesNotesState {
  /** Slides whose notes have not been saved yet. */
  unsaved: number;
  /** `no_store`: there is nowhere to save them. */
  fault?: string;
}

export interface SlidesFilesNotesStore {
  state?(): SlidesFilesNotesState;
  /** The store has answered at least once. */
  heard?(): boolean;
  set(slideId: SlideId, notes: string | undefined): void;
  load(): Promise<Record<SlideId, string> | undefined>;
  onChange?(
    listener: (slideId: SlideId, notes: string | undefined) => void,
  ): void;
  onState?(listener: () => void): void;
  retry?(): void;
}

/** Paints one slide before the whole deck is read. */
export interface SlidesFilesFirstSlide {
  /** The slide to paint first, given the stored slide order. */
  landing(order: readonly SlideId[]): SlideId | null | undefined;
  parse(content: unknown): DeckContent;
  allowed?(): boolean;
  painted?(): Promise<unknown>;
}

/** The slide painted before the deck finished loading. */
export interface SlidesFilesEarlySlide {
  id: SlideId;
  content: DeckContent;
}

/** A slide edit left by an earlier session, offered back. */
export interface StashedSlideOffer {
  slideId: SlideId;
  slideNo: number;
  at: number;
  /** The published slide changed since the edit was stashed. */
  moved: boolean;
}

/** A version of a slide that was set aside (replaced, lost a conflict, or kept from an earlier session). */
export interface KeptSlideOffer {
  slideId: SlideId;
  slideNo: number;
  why: KeptSlideReason;
  at: number;
  earlier: boolean;
}

/** A save made at the same moment replaced this tab's version of a slide (or the loss was undone). */
export interface OverwrittenSlideNotice {
  path: string;
  slideId: SlideId | undefined;
  slideNo: number;
  settled: boolean;
}

export interface SlidesFilesDocumentOptions {
  port: SlidesFilesPort;
  parseContent(input: unknown): DeckContent;
  initialContent: DeckContent;
  defaultTitle?: string;
  timers?: FilesSaveTimers;
  codec?: SlideDocumentCodec;
  /** Speaker notes stored outside the slide files. */
  notes?: SlidesFilesNotesStore;
  stash?: UnsavedSlideStash;
  /** Remote changes to the slide at this document path wait while it is true. */
  holdRemote?(documentPath: string): boolean;
  /** The slide at this document path is being edited right now. */
  inSlide?(documentPath: string): boolean;
  /** Start from an empty deck when the deck has no index file yet. */
  startEmpty?: boolean;
  paced?: boolean;
  early?: EarlyHotSource;
  firstSlide?: SlidesFilesFirstSlide;
  readOnlyReason?: string;
  newSlideId?(): SlideId;
  onNotice?(text: string): void;
  onStashOffer?(offer: StashedSlideOffer): void;
  onKept?(offer: KeptSlideOffer): void;
  onOverwritten?(notice: OverwrittenSlideNotice): void;
  /** Trace of what the document does; the detail depends on the event. */
  onEvent?(type: string, detail?: unknown): void;
}

/** Why a slide file is in conflict with the stored version. */
export type SlideConflictKind = "deleted" | "edited" | "undo" | "landed-over";

/** A slide file edited here while the stored version moved on. */
export interface SlideConflict {
  path: string;
  slideId: SlideId;
  /** Sha of the stored version (`null`: deleted there). */
  theirsSha: string | null;
  kind: SlideConflictKind;
}

/** How a conflicting slide is settled: keep this tab's version, the stored one, or both. */
export type SlideConflictChoice = "mine" | "theirs" | "copy";

/** A slide file as the deck currently holds it. */
export interface LiveSlideFile {
  text: string;
  sha: string;
}

export interface SlidesFilesDebugFile {
  path: string;
  sha: string | null;
  liveSha: string | null;
  size: number;
  state: string;
}

export interface SlidesFilesDebugQueue {
  dirty: string[];
  inFlight: boolean;
  lastError?: string;
  conflicted: string[];
  note: string;
}

/** The deck document backed by the project's slide files. */
export interface SlidesFilesDocument
  extends FileBackedArtifactDocument<DeckContent> {
  loadState(): SlidesFilesLoadState;
  shown(): boolean;
  cachedSettled(): boolean;
  flushNow(): void;
  retryLoad(): void;
  storeUntouched(): boolean;
  syncDetail(): {
    pending: number;
    inflight: string | null;
    flights: number;
    lastSyncedAt?: number;
  };
  dispose(): void;
  flushForUnload(why?: string): UnloadFlushPending;
  settle(): Promise<void>;
  ready(): Promise<void>;
  applyRemote(change: SaveQueueRemoteChange, attempt?: number): Promise<void>;
  conflicts(): SlideConflict[];
  resolveConflict(path: string, choice: SlideConflictChoice): void;
  stashOffers(): StashedSlideOffer[];
  restoreStashed(slideId: SlideId): void;
  discardStashed(slideId: SlideId): void;
  putBack(path: string): void;
  keptVersions(): KeptSlideOffer[];
  restoreKeptAsCopy(slideId: SlideId): SlideId | undefined;
  dismissKept(slideId: SlideId): void;
  knownShas(): Map<string, string>;
  debugFiles(): SlidesFilesDebugFile[];
  debugQueue(): SlidesFilesDebugQueue;
  queue: FilesSaveQueue;
  index: IndexFileStore<DeckIndex>;
  earlySlide(): SlidesFilesEarlySlide | undefined;
  subscribeEarly(listener: () => void): () => void;
}

/** A slide's set-aside version, as the document remembers it. */
interface KeptSlideVersion {
  html: string;
  why: KeptSlideReason;
  at: number;
  earlier: boolean;
}

/** Slide text that was published a moment ago. */
interface RecentPublish {
  text: string;
  at: number;
}

/** What the boot reader (or its fallback) found of the deck's files. */
interface LoadedBootState {
  narrowed?: boolean;
  /** `null`: the deck has no index file yet. */
  index: FileTextRead | null;
  files: Map<string, FileTextRead>;
  /** Slide files the listing showed (only when the index file is missing). */
  slidesListed?: number;
}

/** The record a section is stored as in the deck index. */
interface IndexSectionRecord {
  start?: unknown;
}

/** A slide carrying the local revision it was last written at. */
type GenerationTagged = Slide & { [generation: symbol]: number | undefined };

/** What each event the document traces carries. */
interface SlidesFilesEventMap {
  "landed-with-theirs-seen": { path: string };
  landed: { paths: string[]; version: string };
  "read-retry": { path: string; attempt: number; status: number | undefined };
  "order-merged": {
    base: string[];
    mine: string[];
    theirs: string[];
    merged: string[];
    replayed: string[];
    lost: string[];
  };
  "save-trouble": string | undefined;
  "save-recovered": undefined;
  "save-stuck": FilesSaveStuckState;
  "save-left-out": { files: FilesSaveUnsendable[]; message: string };
  "stale-write-dropped": {
    slide: SlideId;
    from: number | undefined;
    now: number;
  };
  "max-wait-flush": {
    paths: string[];
    index: boolean;
    afterMs: number;
    publishesLastMinute: number;
    why: string;
  };
  "commit-owed": { why: string; waitingOn: string };
  commit: { why: string; paths: string[]; index: boolean };
  "unload-flush": UnloadFlushPending & {
    why: string | undefined;
    inFlight: string[];
    stashed: boolean;
  };
  "stash-write-failed": { slide: SlideId; bytes: number };
  "stash-write": {
    slide: SlideId;
    bytes: number;
    writes: number;
    where: string;
  };
  "stash-clear": { slide: SlideId; why: string };
  "stash-offer": StashedSlideOffer;
  "stash-restore": { slide: SlideId; moved: boolean; bytes: number };
  "stash-discard": { slide: SlideId };
  kept: { slide: SlideId; why: KeptSlideReason; bytes: number; where: string };
  "kept-dropped": { slide: SlideId; why: string };
  "kept-restored": { slide: SlideId; as: SlideId; why: KeptSlideReason };
  "kept-offer": KeptSlideOffer;
  "stash-purged": { why: string; entries: number };
  clash: SlideConflict;
  resolve: {
    path: string;
    keep: SlideConflictChoice;
    landedOverTheirs?: true;
    copy?: string;
  };
  "clash-decision": {
    path?: string;
    slide?: SlideId;
    kind?: string;
    chose?: string;
    mineIsNowSlide?: string;
    what?: string;
    slides?: string[];
  };
  "remote-skipped": { to: string; why: string };
  "remote-reread": { paths: string[]; inMs: number | undefined };
  "remote-applied": {
    paths: string[];
    index: boolean;
    to: string;
    structureRev?: number;
  };
  "load-retry": { why: string };
  "started-empty": { why: string; slideFiles: number };
  "load-failed": {
    error: string | undefined;
    kind: FilesBootFailureKind;
    retryInMs: number | null;
  };
  "boot-retry": Extract<FilesBootEvent, { type: "boot-retry" }>;
  "boot-removed": Extract<FilesBootEvent, { type: "boot-removed" }>;
  "boot-took-redirected": Extract<
    FilesBootEvent,
    { type: "boot-took-redirected" }
  >;
  "boot-moved": Extract<FilesBootEvent, { type: "boot-moved" }>;
}

type SlidesFilesEventName = keyof SlidesFilesEventMap;

type EmitSlidesFilesEvent = <Name extends SlidesFilesEventName>(
  type: Name,
  detail?: SlidesFilesEventMap[Name],
) => void;

declare module "../bindings" {
  interface RuntimeBindings {
    /** Real timers and clock; what a document uses unless a test passes fakes. */
    slidesFilesTimers: FilesSaveTimers;
    /** Quiet time after an edit before the slide files are saved. */
    SLIDES_FILES_SAVE_DEBOUNCE_MS: number;
    SLIDES_FILES_SHARED_MAX_WAIT_MS: number;
    SLIDES_FILES_SOLO_MAX_WAIT_MS: number;
    SLIDES_FILES_MAX_PARALLEL_READS: number;
    SLIDES_FILES_BOOT_REFRESH_MS: number;
    SLIDES_FILES_RECONNECT_TIMEOUT_MS: number;
    SLIDES_FILES_STALE_SYNC_TIMEOUT_MS: number;
    SLIDES_FILES_ERROR_NOTIFY_MS: number;
    SLIDES_FILES_MAX_RECOVERY_ATTEMPTS: number;
    LOCAL_SLIDE_RECOVERY_ORIGIN: LocalSlideRecoveryOrigin;
    SLIDES_FILES_PENDING_NOTE_TIMEOUT_MS: number;
    /** Document path of a slide file, or undefined for a path that is not a slide. */
    slideDocumentPathForFile: (path: string) => string | undefined;
    createSlidesFilesDocument: (
      options: SlidesFilesDocumentOptions,
    ) => SlidesFilesDocument;
  }
}

export function installFilesSlidesDocument(
  runtime: RuntimeBindings,
): () => void {
  var slidesFilesTimers: RuntimeBindings["slidesFilesTimers"];
  var SLIDES_FILES_SAVE_DEBOUNCE_MS: RuntimeBindings["SLIDES_FILES_SAVE_DEBOUNCE_MS"];
  var SLIDES_FILES_SHARED_MAX_WAIT_MS: RuntimeBindings["SLIDES_FILES_SHARED_MAX_WAIT_MS"];
  var SLIDES_FILES_SOLO_MAX_WAIT_MS: RuntimeBindings["SLIDES_FILES_SOLO_MAX_WAIT_MS"];
  var SLIDES_FILES_MAX_PARALLEL_READS: RuntimeBindings["SLIDES_FILES_MAX_PARALLEL_READS"];
  var SLIDES_FILES_BOOT_REFRESH_MS: RuntimeBindings["SLIDES_FILES_BOOT_REFRESH_MS"];
  var SLIDES_FILES_RECONNECT_TIMEOUT_MS: RuntimeBindings["SLIDES_FILES_RECONNECT_TIMEOUT_MS"];
  var SLIDES_FILES_STALE_SYNC_TIMEOUT_MS: RuntimeBindings["SLIDES_FILES_STALE_SYNC_TIMEOUT_MS"];
  var SLIDES_FILES_ERROR_NOTIFY_MS: RuntimeBindings["SLIDES_FILES_ERROR_NOTIFY_MS"];
  var SLIDES_FILES_MAX_RECOVERY_ATTEMPTS: RuntimeBindings["SLIDES_FILES_MAX_RECOVERY_ATTEMPTS"];
  var LOCAL_SLIDE_RECOVERY_ORIGIN: RuntimeBindings["LOCAL_SLIDE_RECOVERY_ORIGIN"];
  var SLIDES_FILES_PENDING_NOTE_TIMEOUT_MS: RuntimeBindings["SLIDES_FILES_PENDING_NOTE_TIMEOUT_MS"];
  var slideDocumentPathForFile: RuntimeBindings["slideDocumentPathForFile"];
  function createSlidesFilesDocument(
    options: SlidesFilesDocumentOptions,
  ): SlidesFilesDocument {
    let timers: FilesSaveTimers = options.timers ?? slidesFilesTimers,
      mayWrite: boolean = options.port.mayWrite ?? options.port.canWrite,
      canWrite: boolean = mayWrite,
      listingNarrowed: boolean = false,
      newDeckUsesCssLists: boolean = false,
      codecState: SlideDocumentCodec =
        options.codec ?? (0, runtime.createSlideDocumentCodec)(),
      notesStoredInFiles: boolean = options.notes === undefined,
      fileCodec: SlidesFileCodec = (0, runtime.createSlidesFileCodec)(
        codecState.codec,
        {
          notesInFiles: notesStoredInFiles,
        },
      ),
      liveSlideFiles: Map<string, LiveSlideFile> = new Map(),
      knownSlideShas: Map<string, string> = new Map(),
      localSlideOverrides: Map<string, string | null> = new Map(),
      heldRemoteSlideBases: Map<string, string | null> = new Map(),
      dirtySlidePaths: Set<string> = new Set(),
      inFlightSlidePaths: Set<string> = new Set(),
      slideConflicts: Map<string, SlideConflict> = new Map(),
      slideLocalRevisions: Map<string, number> = new Map(),
      deckLocalRevision: number = 0,
      getSlideLocalRevision = (input: SlideId): number =>
        deckLocalRevision * 1e6 + (slideLocalRevisions.get(input) ?? 0),
      reportedStaleSlideRevisions: Map<string, number> = new Map(),
      bumpSlideLocalRevision = (input: string): void => {
        let value = (0, runtime.slideIdFromFilePath)(input);
        if (value !== undefined) {
          slideLocalRevisions.set(
            value,
            (slideLocalRevisions.get(value) ?? 0) + 1,
          );
        }
      },
      remotePathRevisions: Map<string, number> = new Map(),
      remoteSeenWhilePublishing: Map<string, LiveSlideFile | null> = new Map(),
      deletionConflicts: Set<string> = new Set(),
      recentPublishedSlideText: Map<string, RecentPublish> = new Map(),
      overwrittenSlideText: Map<string, string> = new Map(),
      keptSlideVersions: Map<string, KeptSlideVersion> = new Map(),
      recentPublishTimes: number[] = [],
      structureRevision: number = 0,
      touchedSlidePaths: Set<string> = new Set(),
      indexTouched: boolean = false,
      structureTouched: boolean = false,
      stashedSlideOffers: Map<string, UnsavedSlide> = new Map(),
      offeredSlideIds: Set<string> = new Set(),
      stashOfferTimer: unknown,
      stashWriteCount: number = 0,
      localNotesChangedAt: Map<string, number> = new Map(),
      notesBySlide: Record<SlideId, string> = {},
      emitEvent: EmitSlidesFilesEvent = (input, options2): void => {
        try {
          options.onEvent?.(input, options2);
        } catch {}
      },
      unsavedStash: UnsavedSlideStash | undefined = options.stash,
      getSlideNumber = (input: SlideId): number =>
        envelope.content.order.indexOf(input) + 1,
      envelope: ArtifactState<DeckContent> = {
        title:
          (0, runtime.normalizeArtifactTitle)(options.defaultTitle) ??
          "Untitled",
        content: options.initialContent,
        comments: [],
      },
      decomposedEnvelope: DecomposedFilesEnvelope | undefined,
      codecCarry: SlideCodecCarry | undefined,
      loadState: SlidesFilesLoadState = "loading",
      loadFailureMessage: string | undefined,
      decompositionPending: boolean = false,
      idleCommitTimer: unknown,
      maxWaitCommitTimer: unknown,
      lastSyncedAt: number | undefined,
      lastSaveError: string | undefined,
      stuckSave: FilesSaveStuckState | undefined,
      unsendableFiles: FilesSaveUnsendable[] | undefined,
      unsendableNoticeShown: boolean = false,
      saveTrouble: boolean = false,
      gestureActive: boolean = false,
      commitOwed: boolean = false,
      disposed: boolean = false,
      documentSubscribers: Set<(change?: ArtifactChange) => void> = new Set(),
      saveSubscribers: Set<(state: ArtifactSaveState) => void> = new Set(),
      loadSubscribers: Set<() => void> = new Set(),
      listUnlessNarrowed: SlidesFilesPort["listUnlessNarrowed"] = options.port.listUnlessNarrowed,
      savePort: SlidesFilesPort = {
        get canWrite(): boolean {
          return options.port.canWrite;
        },
        get narrowed(): boolean {
          return options.port.narrowed === true;
        },
        get mayWrite(): boolean | undefined {
          return options.port.mayWrite;
        },
        ...(typeof listUnlessNarrowed === "function"
          ? {
              listUnlessNarrowed: (): Promise<FileListing> =>
                listUnlessNarrowed.call(options.port),
            }
          : {}),
        list: (): Promise<FileListing> => options.port.list(),
        readText: (input: string): Promise<FileTextRead> =>
          new Promise<FileTextRead>((input2, options2): void => {
            let value = timers.setTimeout(
              (): void =>
                options2(
                  Error(
                    input +
                      ": no answer after " +
                      String(SLIDES_FILES_PENDING_NOTE_TIMEOUT_MS / 1000) +
                      " s",
                  ),
                ),
              SLIDES_FILES_PENDING_NOTE_TIMEOUT_MS,
            );
            options.port.readText(input).then(
              (input3): void => {
                timers.clearTimeout(value);
                input2(input3);
              },
              (input3: unknown): void => {
                timers.clearTimeout(value);
                options2(input3);
              },
            );
          }),
        readBytes: (input: string): Promise<SlidesFilesBytes> =>
          options.port.readBytes(input),
        version: (): { version: string } => options.port.version(),
        onRemoteChange: (
          input: (change: SaveQueueRemoteChange) => void,
        ): (() => void) => options.port.onRemoteChange(input),
        async publish(
          input: FilePublishEntries,
          options2?: { ifMatch?: Record<string, FileSha> },
        ): Promise<SaveQueuePublishResult> {
          let entries: Map<string, string | null> = new Map();
          for (let [value2, value3] of Object.entries(input)) {
            if ((0, runtime.slideIdFromFilePath)(value2) === undefined) {
              continue;
            }
            let value4 = (0, runtime.fileInputText)(value3);
            if (value4 !== undefined) {
              entries.set(value2, value4);
            }
          }
          recentPublishTimes.push(timers.now());
          let value = await options.port.publish(input, options2);
          if (!value.ok) {
            return value;
          }
          for (let [value2, value3] of entries) {
            inFlightSlidePaths.delete(value2);
            rebasedSlideShas.delete(value2);
            if (value3 === null) {
              liveSlideFiles.delete(value2);
              knownSlideShas.delete(value2);
              if (
                localSlideOverrides.get(value2) === null &&
                !dirtySlidePaths.has(value2)
              ) {
                localSlideOverrides.delete(value2);
              }
            } else {
              let value4 =
                value.shas?.[value2] ?? (0, runtime.sha256Sync)(value3);
              liveSlideFiles.set(value2, {
                text: value3,
                sha: value4,
              });
              knownSlideShas.set(value2, value4);
              if (
                localSlideOverrides.get(value2) === value3 &&
                !dirtySlidePaths.has(value2)
              ) {
                localSlideOverrides.delete(value2);
              }
              recentPublishedSlideText.set(value2, {
                text: value3,
                at: timers.now(),
              });
            }
            if (!dirtySlidePaths.has(value2)) {
              clearStashedSlide(
                (0, runtime.slideIdFromFilePath)(value2)!,
                "published",
              );
            }
            if (overwrittenSlideText.delete(value2)) {
              options.onOverwritten?.({
                path: value2,
                slideId: (0, runtime.slideIdFromFilePath)(value2),
                slideNo: getSlideNumber(
                  (0, runtime.slideIdFromFilePath)(value2)!,
                ),
                settled: true,
              });
            }
            if (remoteSeenWhilePublishing.has(value2)) {
              let value4 = remoteSeenWhilePublishing.get(value2) === null;
              remoteSeenWhilePublishing.delete(value2);
              emitEvent("landed-with-theirs-seen", {
                path: value2,
              });
              if (
                slideConflicts.delete(value2) &&
                (!localSlideOverrides.has(value2) ||
                  localSlideOverrides.get(value2) === value3)
              ) {
                dirtySlidePaths.delete(value2);
                localSlideOverrides.delete(value2);
                dirtyButUnsendablePaths.delete(value2);
                clearStashedSlide(
                  (0, runtime.slideIdFromFilePath)(value2)!,
                  "published",
                );
              }
              if (
                value4 &&
                value3 !== null &&
                LOCAL_SLIDE_RECOVERY_ORIGIN === "mine"
              ) {
                restoreMissingIndexSlides([
                  (0, runtime.slideIdFromFilePath)(value2)!,
                ]);
                if (indexStore.dirty()) {
                  recomposeFromFiles(false);
                  scheduleIdleCommit();
                }
              }
              notifySaveSubscribers();
            } else if (
              slideConflicts.has(value2) &&
              localSlideOverrides.get(value2) === value3
            ) {
              slideConflicts.delete(value2);
              dirtySlidePaths.delete(value2);
              localSlideOverrides.delete(value2);
              dirtyButUnsendablePaths.delete(value2);
              rebasedSlideShas.delete(value2);
              clearStashedSlide(
                (0, runtime.slideIdFromFilePath)(value2)!,
                "published",
              );
              notifySaveSubscribers();
            }
          }
          lastSyncedAt = timers.now();
          emitEvent("landed", {
            paths: [...entries.keys()],
            version: value.version,
          });
          return value;
        },
      },
      readTextWithRetries = (input: string): Promise<FileTextRead> =>
        (0, runtime.retryFileRead)(
          (): Promise<FileTextRead> => savePort.readText(input),
          timers,
          (input2, options2): void =>
            emitEvent("read-retry", {
              path: input,
              attempt: input2,
              status: (options2 as { status?: number } | undefined)?.status,
            }),
          runtime.BOOT_FILE_READ_RETRY_DELAYS_MS,
        ),
      indexStore: IndexFileStore<DeckIndex> = (0, runtime.createIndexFileStore)({
        port: {
          readText: readTextWithRetries,
        },
        path: runtime.DECK_METADATA_PATH,
        schema: runtime.DECK_INDEX_MERGE_SCHEMA,
        empty: (): DeckIndex =>
          (0, runtime.normalizeDeckMetadata)((0, runtime.emptyDeckIndex)()),
      }),
      originalIndexMerge = indexStore.mergeFrom.bind(indexStore),
      designSystemTracker = (0,
      runtime.createInstalledDesignSystemTracker)(
        {
          list: (): Promise<FileListing> =>
            (0, runtime.listWritableFiles)(options.port),
          readText: readTextWithRetries,
        },
        (): string => savePort.version().version,
        (): void => {
          if (!disposed && loadState === "live") {
            recomposeFromFiles(true);
          }
        },
      );
    indexStore.mergeFrom = (input: DeckIndex): DeckIndex => {
      let items = [...indexStore.base().order],
        items2 = [...indexStore.get().order],
        value =
          indexStore.base().lists === undefined && input.lists === undefined,
        value2 = originalIndexMerge(input);
      if (value) {
        delete value2.lists;
      }
      if (
        !Array.isArray(input.order) ||
        !Array.isArray(value2.order) ||
        (0, runtime.stringArraysEqual)(items, items2)
      ) {
        return value2;
      }
      let value3 = (0, runtime.mergeSlideOrderWithReplay)(
        items,
        items2,
        input.order,
      );
      emitEvent("order-merged", {
        base: items,
        mine: items2,
        theirs: [...input.order],
        merged: value3.order,
        replayed: value3.replayed,
        lost: value3.lost,
      });
      value2.order.splice(0, value2.order.length, ...value3.order);
      replayMergedOrderChanges(items, items2, value3);
      return value2;
    };
    let saveQueue: FilesSaveQueue = (0, runtime.createFilesSaveQueue)({
        port: savePort,
        index: indexStore,
        ...(options.paced !== undefined
          ? {
              paced: options.paced,
            }
          : {}),
        onShared: (): void => {
          if (disposed || maxWaitCommitTimer === undefined) {
            return;
          }
          timers.clearTimeout(maxWaitCommitTimer);
          maxWaitCommitTimer = undefined;
          scheduleMaxWaitCommit();
        },
        timers: {
          setTimeout: (input, options2): unknown =>
            timers.setTimeout(input, options2),
          clearTimeout: (input): void => timers.clearTimeout(input),
          now: (): number => timers.now(),
          ...(timers.random !== undefined
            ? {
                random: (): number => timers.random!(),
              }
            : {}),
        },
        onConflict: (input): void => {
          dirtyButUnsendablePaths.delete(input.path);
          inFlightSlidePaths.delete(input.path);
          remoteSeenWhilePublishing.delete(input.path);
          markSlideDirtyAgainstBase(input.path, input.theirsSha);
        },
        onState: (input): void => {
          lastSaveError = input.lastError;
          if (
            (input.lastError !== undefined || input.stuck !== undefined) &&
            !saveTrouble
          ) {
            saveTrouble = true;
            emitEvent("save-trouble", input.lastError ?? input.stuck?.code);
          } else if (!input.inFlight && input.dirty === 0 && saveTrouble) {
            saveTrouble = false;
            emitEvent("save-recovered", undefined);
          }
          if (input.stuck !== undefined && stuckSave === undefined) {
            emitEvent("save-stuck", input.stuck);
            for (let value2 of slideConflicts.keys())
              timers.setTimeout((): void => retryDirtySlide(value2), 0);
          }
          stuckSave = input.stuck;
          unsendableFiles = input.unsendable;
          if (unsendableFiles === undefined) {
            unsendableNoticeShown = false;
          }
          let value = gestureActive;
          gestureActive = input.inFlight;
          if (value && !gestureActive && commitOwed) {
            commitChanges();
          }
          notifySaveSubscribers();
        },
      }),
      getNotesSyncState = (): SlidesFilesNotesState =>
        options.notes?.state?.() ?? {
          unsaved: 0,
        },
      pendingSaveCount = (): number =>
        dirtySlidePaths.size +
        inFlightSlidePaths.size +
        (indexStore.dirty() ? 1 : 0) +
        (decompositionPending ? 1 : 0) +
        getNotesSyncState().unsaved;
    function getSaveState(): ArtifactSaveState {
      if (loadState === "loading") {
        return {
          status: "loading",
          message: "Loading the latest content…",
        };
      }
      if (loadState === "failed") {
        return {
          status: "error",
          message:
            "The presentation failed to load" +
            (loadFailureMessage !== undefined
              ? " (" + loadFailureMessage + ")"
              : "") +
            ". Click to retry.",
        };
      }
      if (!canWrite) {
        return {
          status: "readonly",
          message: waitingForReadableListing
            ? "Nothing can be saved here."
            : listingNarrowed && mayWrite
              ? runtime.FILE_LIST_UNAVAILABLE_MESSAGE
              : (options.readOnlyReason ??
                "Read-only. You’re seeing live changes."),
        };
      }
      if (stuckSave !== undefined) {
        return {
          status: "error",
          message:
            "Your latest changes have not been saved yet. " +
            (unsavedStash?.durable() === true
              ? "They are kept in this browser for " +
                runtime.CRASH_STASH_RETENTION_LABEL +
                ", even if this tab closes. "
              : "They are kept only while this tab stays open. ") +
            (stuckSave.retryable
              ? stuckSave.nextRetryAt !== undefined
                ? "It keeps trying by itself; click to try now."
                : "Click to try now."
              : unsavedStash?.durable() === true
                ? "Trying again will not help here; reload the page."
                : "Trying again will not help here, and reloading would lose these changes: copy what you need first."),
        };
      }
      if (lastSaveError !== undefined || saveTrouble) {
        return {
          status: "error",
          message:
            "A change could not be saved yet. It keeps trying by itself; click to try now.",
        };
      }
      let value = [...slideConflicts.values()].find(
          (input): boolean => {
            let value7 = slideDocumentPathForFile(input.path);
            return (
              value7 !== undefined &&
              (options.holdRemote?.(value7) === true ||
                options.inSlide?.(value7) === true)
            );
          },
        ),
        value2 = value !== undefined,
        value3 =
          value === undefined
            ? ""
            : (getSlideNumber(value.slideId) > 0
                ? "Slide " + String(getSlideNumber(value.slideId))
                : "A slide") +
              (value.theirsSha === null
                ? " deleted remotely"
                : " changed remotely");
      if (
        LOCAL_SLIDE_RECOVERY_ORIGIN === "theirs" &&
        value2 &&
        unsendableFiles === undefined
      ) {
        return {
          status: "dirty",
          message: value3,
        };
      }
      let value4 = getNotesSyncState();
      if (value4.fault === "no_store") {
        return {
          status: "error",
          message:
            "Speaker notes can’t be saved in this view. They are kept on this screen only, so copy them before you close this tab.",
        };
      }
      if (value4.fault !== undefined) {
        return {
          status: "error",
          message:
            "Speaker notes for " +
            String(value4.unsaved) +
            " slide" +
            (value4.unsaved === 1 ? "" : "s") +
            " haven’t been saved yet. Click to try again.",
        };
      }
      let value5 = countBlockedFiles();
      if (
        inFlightSlidePaths.size > value5.slides ||
        (value4.unsaved > 0 &&
          dirtySlidePaths.size === 0 &&
          !indexStore.dirty())
      ) {
        return {
          status: "saving",
          message: "Saving…",
        };
      }
      let value6 = pendingSaveCount() - value5.slides - value5.index;
      if (value6 > 0) {
        return {
          status: "dirty",
          message:
            String(value6) +
            " change" +
            (value6 === 1 ? "" : "s") +
            " waiting to save.",
        };
      }
      if (unsendableFiles !== undefined) {
        return {
          status: "error",
          message: formatUnsendableMessage(unsendableFiles),
          leftOut: unsendableFiles.map((input) => ({
            id: input.path,
            cause: input.cause,
          })),
        };
      }
      return {
        status: "ready",
        message: lastSyncedAt !== undefined ? "All changes saved." : "Saved.",
      };
    }
    function countBlockedFiles(): { slides: number; index: number } {
      let value = unsendableFiles ?? [];
      return {
        slides: value.filter((input) => inFlightSlidePaths.has(input.path))
          .length,
        index:
          indexStore.dirty() &&
          value.some((input) => input.path === runtime.DECK_METADATA_PATH)
            ? 1
            : 0,
      };
    }
    function canReportUnsendable(): boolean {
      let value = countBlockedFiles();
      return (
        loadState === "live" &&
        slideConflicts.size === 0 &&
        stuckSave === undefined &&
        lastSaveError === undefined &&
        !saveTrouble &&
        dirtySlidePaths.size === 0 &&
        !decompositionPending &&
        inFlightSlidePaths.size === value.slides &&
        (!indexStore.dirty() || value.index === 1)
      );
    }
    function formatUnsendableMessage(input: FilesSaveUnsendable[]): string {
      let callback = (input2: string): number => {
          let value5 = (0, runtime.slideIdFromFilePath)(input2);
          if (value5 === undefined) {
            return 0;
          } else {
            return getSlideNumber(value5);
          }
        },
        callback2 = (input2: string): string | undefined =>
          input2 === runtime.DECK_METADATA_PATH
            ? "the presentation’s own record (its title, sections and slide order)"
            : callback(input2) > 0
              ? "slide " + String(callback(input2))
              : undefined,
        value = [...input].sort(
          (input2, options2): number =>
            callback(input2.path) - callback(options2.path),
        );
      if (value.some((input2) => callback2(input2.path) === undefined)) {
        return (0, runtime.formatLostSlideEditsMessage)(value);
      }
      let value2 =
          unsavedStash?.durable() === true &&
          value.every(
            (input2) =>
              typeof localSlideOverrides.get(input2.path) === "string" &&
              unsavedStash!.read(
                (0, runtime.slideIdFromFilePath)(input2.path) ?? "",
              )?.html === localSlideOverrides.get(input2.path),
          ),
        value3 = value.length === 1,
        value4 =
          String(value.length) +
          (value.every((input2) => callback(input2.path) > 0)
            ? " slides"
            : " parts of this presentation");
      return (
        "Everything else is saved, but " +
        (value3
          ? callback2(value[0]!.path) + " is not: "
          : value4 +
            " are not. The first, " +
            callback2(value[0]!.path) +
            ": ") +
        value[0]!.why +
        ". Until then " +
        (value3 ? "it is" : "they are") +
        " kept " +
        (value2
          ? "in this browser for " +
            runtime.CRASH_STASH_RETENTION_LABEL +
            ", even if this tab closes."
          : "only while this tab stays open.")
      );
    }
    let lastSaveAnnouncementKey: string = "";
    function notifySaveSubscribers(): void {
      let value = getSaveState();
      if (
        unsendableFiles !== undefined &&
        !unsendableNoticeShown &&
        canReportUnsendable()
      ) {
        unsendableNoticeShown = true;
        emitEvent("save-left-out", {
          files: unsendableFiles,
          message: formatUnsendableMessage(unsendableFiles),
        });
      }
      let value2 = value.status + "|" + (value.message ?? "");
      if (value2 === lastSaveAnnouncementKey) {
        return;
      }
      lastSaveAnnouncementKey = value2;
      for (let value3 of [...saveSubscribers]) value3(value);
    }
    function notifyDocumentSubscribers(input: boolean): void {
      for (let value of [...documentSubscribers])
        value(
          input
            ? {
                remote: true,
              }
            : undefined,
        );
      notifySaveSubscribers();
    }
    function setLoadState(input: SlidesFilesLoadState): void {
      if (loadState === input) {
        return;
      }
      loadState = input;
      for (let value of [...loadSubscribers]) value();
      notifySaveSubscribers();
    }
    function composeCurrentFiles(): Map<string, string> {
      let entries: Map<string, string> = new Map();
      for (let [value, value2] of liveSlideFiles)
        entries.set(value, value2.text);
      for (let [value, value2] of heldRemoteSlideBases)
        if (value2 === null) {
          entries.delete(value);
        } else {
          entries.set(value, value2);
        }
      for (let [value, value2] of localSlideOverrides)
        if (value2 === null) {
          entries.delete(value);
        } else {
          entries.set(value, value2);
        }
      return entries;
    }
    let unheardInlineNoteIds: Set<SlideId> = new Set(),
      locallyEditedNoteIds: Set<SlideId> = new Set();
    function mergeInlineNotesIntoContent(
      input: DeckContent,
      options2: readonly SlideId[],
    ): DeckContent {
      if (notesStoredInFiles) {
        return input;
      }
      let value = input;
      for (let value2 of options2) {
        let value3 = value.slides[value2];
        if (value3?.notes === undefined) {
          continue;
        }
        if (canWrite && options.notes !== undefined) {
          if (notesBySlide[value2] === undefined) {
            if (
              ((notesBySlide[value2] = value3.notes),
              options.notes.heard?.() === true)
            ) {
              options.notes.set(value2, value3.notes);
            } else {
              unheardInlineNoteIds.add(value2);
            }
          }
          continue;
        }
        let { notes: value4, ...value5 } = value3;
        value = {
          ...value,
          slides: {
            ...value.slides,
            [value2]: value5,
          },
        };
      }
      return value;
    }
    function recomposeFromFiles(input: boolean): void {
      if (decompositionPending) {
        flushPendingDecomposition();
      }
      let value: ReturnType<SlidesFileCodec["compose"]>;
      try {
        let value3 = (0, runtime.normalizeDeckMetadata)(indexStore.get());
        value = fileCodec.compose(
          {
            files: composeCurrentFiles(),
            index:
              newDeckUsesCssLists &&
              (0, runtime.readFileMigrationMarker)(value3) === null
                ? {
                    ...value3,
                    lists: "css",
                  }
                : value3,
            notes: notesBySlide,
            designSystems: designSystemTracker.current(),
          },
          codecCarry,
        );
      } catch (value3: unknown) {
        console.error(
          "slides (files): compose failed; keeping the current content",
          value3,
        );
        return;
      }
      codecCarry = value.carry;
      let content: DeckContent = envelope.content;
      try {
        content = options.parseContent(value.content);
      } catch {}
      content = mergeInlineNotesIntoContent(
        content,
        value.carry?.inlineNotes ?? [],
      );
      content = protectLocallyRevisedSlides(content);
      envelope = {
        title:
          (0, runtime.normalizeArtifactTitle)(
            typeof value.title === "string" ? value.title.trim() : value.title,
          ) ?? envelope.title,
        content: content,
        comments: [],
      };
      decomposedEnvelope = fileCodec.decompose(
        envelope,
        decomposedEnvelope,
        codecCarry,
      );
      designSystemTracker.refresh(indexStore.get());
      indexStore
        .get()
        .order.forEach((input2, options2, context) =>
          previousSlideById.set(
            input2,
            options2 === 0 ? null : context[options2 - 1]!,
          ),
        );
      let value2 = (
          Object.entries(indexStore.get().sections) as [
            string,
            IndexSectionRecord | null,
          ][]
        ).filter(
          (input2): input2 is [string, IndexSectionRecord] =>
            typeof input2[1] === "object" && input2[1] !== null,
        ),
        values = new Set(value2.map(([, input2]) => input2.start));
      for (let value3 of indexStore.get().order)
        if (!values.has(value3)) {
          sectionIdByStartSlide.delete(value3);
        }
      for (let [value3, value4] of value2)
        if (typeof value4.start === "string") {
          sectionIdByStartSlide.set(value4.start, value3);
        }
      notifyDocumentSubscribers(input);
    }
    function protectLocallyRevisedSlides(input: DeckContent): DeckContent {
      let slides = input.slides;
      for (let [value, value2] of Object.entries(input.slides)) {
        let value3 = getSlideLocalRevision(value),
          value4 = (value2 as GenerationTagged)[runtime.SLIDE_GENERATION_SYMBOL];
        if (value4 === value3) {
          continue;
        }
        if (value4 === undefined) {
          try {
            Object.defineProperty(value2, runtime.SLIDE_GENERATION_SYMBOL, {
              value: value3,
              enumerable: true,
              writable: false,
              configurable: false,
            });
            continue;
          } catch {}
        }
        if (slides === input.slides) {
          slides = {
            ...slides,
          };
        }
        slides[value] = {
          ...value2,
          [runtime.SLIDE_GENERATION_SYMBOL]: value3,
        };
      }
      if (slides === input.slides) {
        return input;
      } else {
        return {
          ...input,
          slides: slides,
        };
      }
    }
    function normalizeLocalEnvelope(
      input: ArtifactState<DeckContent>,
    ): ArtifactState<DeckContent> {
      let slides = envelope.content.slides,
        slides2 = input.content.slides,
        order = input.content.order;
      for (let [value, value2] of Object.entries(input.content.slides)) {
        let value3 = slides[value];
        if (value2 === value3) {
          continue;
        }
        let value4 = (value2 as GenerationTagged)[runtime.SLIDE_GENERATION_SYMBOL];
        if (
          value4 === undefined ||
          value4 === getSlideLocalRevision(value) ||
          (value3 === undefined && !slideLocalRevisions.has(value))
        ) {
          if (value4 !== getSlideLocalRevision(value)) {
            if (slides2 === input.content.slides) {
              slides2 = {
                ...slides2,
              };
            }
            slides2[value] = {
              ...value2,
              [runtime.SLIDE_GENERATION_SYMBOL]: getSlideLocalRevision(value),
            };
          }
          continue;
        }
        if (slides2 === input.content.slides) {
          slides2 = {
            ...slides2,
          };
        }
        if (value3 !== undefined) {
          slides2[value] = value3;
        } else {
          delete slides2[value];
          order = order.filter((input2) => input2 !== value);
        }
        emitEvent("stale-write-dropped", {
          slide: value,
          from: value4,
          now: getSlideLocalRevision(value),
        });
        if (
          LOCAL_SLIDE_RECOVERY_ORIGIN === "theirs" &&
          reportedStaleSlideRevisions.get(value) !==
            getSlideLocalRevision(value)
        ) {
          reportedStaleSlideRevisions.set(value, getSlideLocalRevision(value));
          let value5 = getSlideNumber(value);
          try {
            options.onNotice?.(
              (value5 > 0 ? "Slide " + String(value5) : "A slide") +
                " changed remotely",
            );
          } catch {}
        }
      }
      if (slides2 === input.content.slides) {
        return input;
      } else {
        return {
          ...input,
          content: {
            ...input.content,
            slides: slides2,
            order: order,
          },
        };
      }
    }
    function updateLocalEnvelope(input: ArtifactState<DeckContent>): void {
      envelope = normalizeLocalEnvelope(input);
      if (!decompositionPending) {
        decompositionPending = true;
        timers.setTimeout(flushPendingDecomposition, 16);
      }
      notifyDocumentSubscribers(false);
    }
    function flushPendingDecomposition(): void {
      if (!decompositionPending || disposed) {
        return;
      }
      decompositionPending = false;
      let value = fileCodec.decompose(envelope, decomposedEnvelope, codecCarry),
        value2 = decomposedEnvelope;
      decomposedEnvelope = value;
      if (!canWrite || loadState !== "live") {
        return void notifySaveSubscribers();
      }
      let flag: boolean = false,
        flag2: boolean = false;
      for (let [value3, value4] of value.files) {
        let value5 = value2?.files.get(value3);
        if (value5 === value4) {
          continue;
        }
        if (value5 === undefined) {
          flag = true;
        }
        localSlideOverrides.set(value3, value4);
        dirtySlidePaths.add(value3);
        touchedSlidePaths.add(value3);
        stashLocalSlideEdit(value3, value4);
        flag2 = true;
      }
      for (let value3 of value2?.files.keys() ?? []) {
        if (value.files.has(value3)) {
          continue;
        }
        if (slideConflicts.has(value3)) {
          slideConflicts.delete(value3);
        }
        localSlideOverrides.set(value3, null);
        dirtySlidePaths.add(value3);
        touchedSlidePaths.add(value3);
        clearStashedSlide(
          (0, runtime.slideIdFromFilePath)(value3)!,
          "deleted here",
        );
        flag = true;
        flag2 = true;
      }
      if (
        value2 === undefined ||
        JSON.stringify(value2.index) !== JSON.stringify(value.index)
      ) {
        if (
          value2 !== undefined &&
          JSON.stringify(value2.index.order) !==
            JSON.stringify(value.index.order)
        ) {
          flag = true;
        }
        indexStore.update((input) =>
          (0, runtime.patchDeckMetadata)(
            input,
            value2?.index as DeckIndex | undefined,
            value.index as DeckIndex,
          ),
        );
        if (indexStore.dirty()) {
          indexTouched = true;
        }
        flag2 = flag2 || indexStore.dirty();
      }
      for (let value3 of new Set([
        ...Object.keys(value.notes),
        ...Object.keys(value2?.notes ?? {}),
      ])) {
        if (value.notes[value3] === value2?.notes[value3]) {
          continue;
        }
        if (value.notes[value3] === undefined) {
          delete notesBySlide[value3];
        } else {
          notesBySlide[value3] = value.notes[value3];
        }
        localNotesChangedAt.set(value3, timers.now());
        options.notes?.set(value3, value.notes[value3]);
      }
      if (!flag2) {
        return void notifySaveSubscribers();
      }
      if (flag) {
        structureTouched = true;
        commitChanges("structural");
      } else {
        scheduleIdleCommit();
        scheduleMaxWaitCommit();
      }
      notifySaveSubscribers();
    }
    function scheduleIdleCommit(): void {
      timers.clearTimeout(idleCommitTimer);
      idleCommitTimer = timers.setTimeout((): void => {
        idleCommitTimer = undefined;
        commitChanges("idle");
      }, SLIDES_FILES_SAVE_DEBOUNCE_MS);
    }
    function getMaxCommitWait(): number {
      if (saveQueue.solo()) {
        return SLIDES_FILES_SOLO_MAX_WAIT_MS;
      }
      let value = timers.now();
      while (
        recentPublishTimes.length > 0 &&
        value - recentPublishTimes[0]! >= SLIDES_FILES_RECONNECT_TIMEOUT_MS
      )
        recentPublishTimes.shift();
      if (recentPublishTimes.length >= SLIDES_FILES_MAX_PARALLEL_READS) {
        return SLIDES_FILES_BOOT_REFRESH_MS;
      } else {
        return SLIDES_FILES_SHARED_MAX_WAIT_MS;
      }
    }
    function scheduleMaxWaitCommit(): void {
      if (maxWaitCommitTimer !== undefined) {
        return;
      }
      let value = getMaxCommitWait();
      maxWaitCommitTimer = timers.setTimeout((): void => {
        maxWaitCommitTimer = undefined;
        let value2 = [...dirtySlidePaths].filter(
          (input) => !slideConflicts.has(input),
        );
        if (value2.length === 0 && !indexStore.dirty()) {
          return;
        }
        emitEvent("max-wait-flush", {
          paths: value2,
          index: indexStore.dirty(),
          afterMs: value,
          publishesLastMinute: recentPublishTimes.length,
          why: "edits kept coming with no boundary and no pause",
        });
        commitChanges("max-wait");
      }, value);
    }
    function commitChanges(input: string = "boundary"): void {
      if (disposed || !canWrite || loadState !== "live") {
        return;
      }
      if (decompositionPending) {
        flushPendingDecomposition();
      }
      if (
        options.startEmpty === true &&
        (dirtySlidePaths.size > 0 || indexStore.dirty()) &&
        (0, runtime.readFileMigrationMarker)(indexStore.get()) === null
      ) {
        indexStore.update((input2) => {
          input2[runtime.CREATED_ON_FILES_MARKER_FIELD] = (0,
          runtime.createdOnFilesMarker)({
            at: new Date(timers.now()).toISOString(),
          });
          if (newDeckUsesCssLists) {
            input2.lists = "css";
          }
          if (input2.order.length === 0 && envelope.content.order.length > 0) {
            input2.order.push(...envelope.content.order);
          }
        });
      }
      timers.clearTimeout(idleCommitTimer);
      idleCommitTimer = undefined;
      timers.clearTimeout(maxWaitCommitTimer);
      maxWaitCommitTimer = undefined;
      if (gestureActive) {
        if (!commitOwed && (dirtySlidePaths.size > 0 || indexStore.dirty())) {
          emitEvent("commit-owed", {
            why: input,
            waitingOn: "the publish in flight",
          });
        }
        commitOwed = true;
        return;
      }
      commitOwed = false;
      let items: string[] = [];
      for (let value of [...dirtySlidePaths]) {
        if (slideConflicts.has(value)) {
          continue;
        }
        let value2 = knownSlideShas.has(value)
            ? (knownSlideShas.get(value) ?? null)
            : null,
          value3 = liveSlideFiles.get(value)?.sha ?? null;
        if (
          value3 !== value2 &&
          !inFlightSlidePaths.has(value) &&
          !(
            rebasedSlideShas.has(value) &&
            rebasedSlideShas.get(value) === value2
          )
        ) {
          markSlideDirtyAgainstBase(
            value,
            value3,
            value3 === null ? "deleted" : "edited",
          );
          continue;
        }
        if (!localSlideOverrides.has(value)) {
          dirtySlidePaths.delete(value);
          continue;
        }
        dirtySlidePaths.delete(value);
        inFlightSlidePaths.add(value);
        items.push(value);
        saveQueue.markDirty(
          value,
          (): string | null => {
            if (localSlideOverrides.has(value)) {
              return localSlideOverrides.get(value) ?? null;
            }
            throw (
              timers.setTimeout((): void => {
                if (disposed || localSlideOverrides.has(value)) {
                  return;
                }
                try {
                  saveQueue.withdraw(value);
                } catch {}
                inFlightSlidePaths.delete(value);
                dirtySlidePaths.delete(value);
                notifySaveSubscribers();
              }, 0),
              Error(value + ": nothing of this tab to send")
            );
          },
          value2,
        );
      }
      if (items.length > 0 || indexStore.dirty()) {
        emitEvent("commit", {
          why: input,
          paths: items,
          index: indexStore.dirty(),
        });
      }
      saveQueue.commit();
      notifySaveSubscribers();
    }
    function flushForUnload(input?: string): UnloadFlushPending {
      if (decompositionPending) {
        flushPendingDecomposition();
      }
      let state: UnloadFlushPending = {
        paths: [...dirtySlidePaths].filter(
          (input2) => !slideConflicts.has(input2),
        ),
        index: indexStore.dirty(),
        owed: gestureActive,
      };
      commitChanges(input);
      saveQueue.flushNow();
      emitEvent("unload-flush", {
        why: input,
        ...state,
        inFlight: [...inFlightSlidePaths],
        stashed: unsavedStash !== undefined,
      });
      return state;
    }
    function takeTouchedPaths(): ArtifactTouchedSummary {
      if (decompositionPending) {
        flushPendingDecomposition();
      }
      let state: ArtifactTouchedSummary = {
        paths: [...touchedSlidePaths],
        index: indexTouched,
        structural: structureTouched,
      };
      touchedSlidePaths.clear();
      indexTouched = false;
      structureTouched = false;
      return state;
    }
    function stashLocalSlideEdit(input: string, items: string): void {
      let value = (0, runtime.slideIdFromFilePath)(input);
      if (
        unsavedStash === undefined ||
        value === undefined ||
        stashedSlideOffers.has(value)
      ) {
        return;
      }
      let value2 = unsavedStash.write(
        value,
        knownSlideShas.has(input) ? (knownSlideShas.get(input) ?? null) : null,
        items,
      );
      stashWriteCount += 1;
      if (!value2) {
        emitEvent("stash-write-failed", {
          slide: value,
          bytes: items.length,
        });
      } else if (stashWriteCount === 1 || stashWriteCount % 20 === 0) {
        emitEvent("stash-write", {
          slide: value,
          bytes: items.length,
          writes: stashWriteCount,
          where: unsavedStash.kind,
        });
      }
    }
    function clearStashedSlide(input: SlideId, options2: string): void {
      if (unsavedStash === undefined || stashedSlideOffers.has(input)) {
        return;
      }
      if (unsavedStash.read(input) === undefined) {
        return;
      }
      unsavedStash.clear(input);
      emitEvent("stash-clear", {
        slide: input,
        why: options2,
      });
    }
    function offerStashedSlides(): void {
      if (unsavedStash === undefined || disposed || !canWrite) {
        return;
      }
      timers.clearTimeout(stashOfferTimer);
      stashOfferTimer = undefined;
      let value: number | undefined;
      for (let value2 of unsavedStash.all()) {
        if (offeredSlideIds.has(value2.slideId)) {
          continue;
        }
        let value3 = (0, runtime.slideFilePath)(value2.slideId);
        if (dirtySlidePaths.has(value3) || inFlightSlidePaths.has(value3)) {
          if (stashedSlideOffers.has(value2.slideId)) {
            value = Math.min(value ?? 1 / 0, 2000);
          }
          continue;
        }
        let entry = liveSlideFiles.get(value3);
        if (entry !== undefined && entry.text === value2.html) {
          unsavedStash.clear(value2.slideId);
          stashedSlideOffers.delete(value2.slideId);
          emitEvent("stash-clear", {
            slide: value2.slideId,
            why: "the published slide already holds it",
          });
          continue;
        }
        stashedSlideOffers.set(value2.slideId, value2);
        let value4 = timers.now() - value2.at;
        if (value4 < SLIDES_FILES_STALE_SYNC_TIMEOUT_MS) {
          value = Math.min(
            value ?? 1 / 0,
            SLIDES_FILES_STALE_SYNC_TIMEOUT_MS - value4 + 50,
          );
          continue;
        }
        offeredSlideIds.add(value2.slideId);
        let state: StashedSlideOffer = {
          slideId: value2.slideId,
          slideNo: getSlideNumber(value2.slideId),
          at: value2.at,
          moved: (entry?.sha ?? null) !== value2.base,
        };
        emitEvent("stash-offer", state);
        try {
          options.onStashOffer?.(state);
        } catch {}
      }
      for (let value2 of [...stashedSlideOffers.keys()])
        if (
          !offeredSlideIds.has(value2) &&
          unsavedStash.read(value2) === undefined
        ) {
          stashedSlideOffers.delete(value2);
        }
      if (value !== undefined) {
        stashOfferTimer = timers.setTimeout(offerStashedSlides, value);
      }
    }
    function getStashOffers(): StashedSlideOffer[] {
      return [...offeredSlideIds].flatMap((input): StashedSlideOffer[] => {
        let entry = stashedSlideOffers.get(input);
        if (entry === undefined) {
          return [];
        }
        let entry2 = liveSlideFiles.get((0, runtime.slideFilePath)(input));
        return [
          {
            slideId: input,
            slideNo: getSlideNumber(input),
            at: entry.at,
            moved: (entry2?.sha ?? null) !== entry.base,
          },
        ];
      });
    }
    function restoreStashedSlide(input: SlideId): void {
      let entry = stashedSlideOffers.get(input);
      if (entry === undefined) {
        return;
      }
      stashedSlideOffers.delete(input);
      offeredSlideIds.delete(input);
      let value = (0, runtime.slideFilePath)(input),
        entry2 = liveSlideFiles.get(value),
        value2 = (entry2?.sha ?? null) !== entry.base;
      emitEvent("stash-restore", {
        slide: input,
        moved: value2,
        bytes: entry.html.length,
      });
      localSlideOverrides.set(value, entry.html);
      dirtySlidePaths.add(value);
      if (entry2 !== undefined) {
        knownSlideShas.set(value, entry2.sha);
      } else {
        knownSlideShas.delete(value);
        restoreMissingIndexSlides([input]);
      }
      bumpSlideLocalRevision(value);
      recomposeFromFiles(true);
      commitChanges("stash-restore");
    }
    function discardStashedSlide(input: SlideId): void {
      if (!stashedSlideOffers.delete(input)) {
        return;
      }
      offeredSlideIds.delete(input);
      unsavedStash?.clear(input);
      emitEvent("stash-discard", {
        slide: input,
      });
    }
    function createRestoredSlideId(input: SlideId): SlideId {
      let value: SlideId =
        options.newSlideId?.() ??
        (0, runtime.sha256Sync)(
          input + ":" + String(timers.now()) + ":" + String(Math.random()),
        ).slice(0, 8);
      while (
        envelope.content.slides[value] !== undefined ||
        liveSlideFiles.has((0, runtime.slideFilePath)(value)) ||
        localSlideOverrides.has((0, runtime.slideFilePath)(value))
      )
        value = (0, runtime.sha256Sync)(value).slice(0, 8);
      return value;
    }
    function keepSlideVersion(
      input: SlideId,
      items: string | undefined,
      context: KeptSlideReason,
    ): void {
      if (typeof items !== "string" || !canWrite) {
        return;
      }
      let value = timers.now();
      keptSlideVersions.set(input, {
        html: items,
        why: context,
        at: value,
        earlier: false,
      });
      let value2 = unsavedStash?.keep(input, items, context) ?? false;
      emitEvent("kept", {
        slide: input,
        why: context,
        bytes: items.length,
        where: value2 ? unsavedStash!.kind : "this tab’s memory only",
      });
      if (context === "overwritten") {
        return;
      }
      try {
        options.onKept?.({
          slideId: input,
          slideNo: getSlideNumber(input),
          why: context,
          at: value,
          earlier: false,
        });
      } catch {}
    }
    function dropKeptSlideVersion(input: SlideId, options2: string): void {
      if (!keptSlideVersions.delete(input)) {
        return;
      }
      unsavedStash?.dropKept(input);
      emitEvent("kept-dropped", {
        slide: input,
        why: options2,
      });
    }
    function getKeptSlideVersions(): KeptSlideOffer[] {
      return [...keptSlideVersions].map(
        ([input, input2]): KeptSlideOffer => ({
          slideId: input,
          slideNo: getSlideNumber(input),
          why: input2.why,
          at: input2.at,
          earlier: input2.earlier,
        }),
      );
    }
    function restoreKeptSlideAsCopy(input: SlideId): SlideId | undefined {
      let entry = keptSlideVersions.get(input);
      if (entry === undefined || !canWrite || loadState !== "live") {
        return;
      }
      if (decompositionPending) {
        flushPendingDecomposition();
      }
      let value = createRestoredSlideId(input),
        value2 = (0, runtime.slideFilePath)(value);
      localSlideOverrides.set(value2, entry.html);
      indexStore.update((input2) => {
        let value4 = input2.order.indexOf(input);
        input2.order.splice(
          value4 < 0 ? input2.order.length : value4 + 1,
          0,
          value,
        );
      });
      recomposeFromFiles(true);
      let value3 = decomposedEnvelope?.files.get(value2);
      if (value3 !== undefined) {
        localSlideOverrides.set(value2, value3);
      }
      dirtySlidePaths.add(value2);
      keptSlideVersions.delete(input);
      unsavedStash?.dropKept(input);
      emitEvent("kept-restored", {
        slide: input,
        as: value,
        why: entry.why,
      });
      commitChanges("kept-restore");
      return value;
    }
    function loadKeptVersions(): void {
      if (unsavedStash === undefined || disposed || !canWrite) {
        return;
      }
      let values = new Set(
        [...liveSlideFiles.values()].map((input) => input.text),
      );
      for (let value of unsavedStash.kept()) {
        if (keptSlideVersions.has(value.slideId)) {
          continue;
        }
        if (values.has(value.html)) {
          unsavedStash.dropKept(value.slideId);
          emitEvent("kept-dropped", {
            slide: value.slideId,
            why: "the published deck already holds it",
          });
          continue;
        }
        keptSlideVersions.set(value.slideId, {
          html: value.html,
          why: value.why,
          at: value.at,
          earlier: true,
        });
        let state: KeptSlideOffer = {
          slideId: value.slideId,
          slideNo: getSlideNumber(value.slideId),
          why: value.why,
          at: value.at,
          earlier: true,
        };
        emitEvent("kept-offer", state);
        try {
          options.onKept?.(state);
        } catch {}
      }
    }
    function markReadAccessRevoked(input: string): void {
      let value = unsavedStash?.purge() ?? 0;
      stashedSlideOffers.clear();
      offeredSlideIds.clear();
      keptSlideVersions.clear();
      emitEvent("stash-purged", {
        why: input,
        entries: value,
      });
    }
    function markSlideDirtyAgainstBase(
      input: string,
      options2: string | null,
      context: SlideConflictKind = options2 === null ? "deleted" : "edited",
    ): void {
      let value = (0, runtime.slideIdFromFilePath)(input);
      if (value === undefined) {
        return;
      }
      let entry = slideConflicts.get(input),
        state: SlideConflict = {
          path: input,
          slideId: value,
          theirsSha: options2,
          kind: entry?.kind === "landed-over" ? "landed-over" : context,
        };
      slideConflicts.set(input, state);
      dirtySlidePaths.add(input);
      if (entry === undefined) {
        emitEvent("clash", state);
      }
      timers.setTimeout((): void => retryDirtySlide(input), 0);
      notifySaveSubscribers();
    }
    let dirtyButUnsendablePaths: Set<string> = new Set();
    function clearSlideConflict(input: string): void {
      let value = slideConflicts.delete(input);
      dirtyButUnsendablePaths.delete(input);
      remoteSeenWhilePublishing.delete(input);
      rebasedSlideShas.delete(input);
      if (value) {
        notifySaveSubscribers();
      }
    }
    let rebasedSlideShas: Map<string, string | null> = new Map();
    function retryDirtySlide(input: string): void {
      if (disposed || !slideConflicts.has(input)) {
        return;
      }
      if (decompositionPending) {
        flushPendingDecomposition();
      }
      let entry = slideConflicts.get(input);
      if (entry === undefined) {
        return;
      }
      let value = slideDocumentPathForFile(input);
      if (
        inFlightSlidePaths.has(input) &&
        !saveQueue.unsendable().has(input) &&
        !(stuckSave !== undefined && !stuckSave.retryable)
      ) {
        return;
      }
      if (LOCAL_SLIDE_RECOVERY_ORIGIN === "mine") {
        let value3: boolean =
          entry.theirsSha === null &&
          typeof localSlideOverrides.get(input) === "string";
        if (value3) {
          restoreMissingIndexSlides([entry.slideId]);
        }
        resolveSlideConflict(input, "mine", true);
        if (value3) {
          recomposeFromFiles(false);
        }
        return;
      }
      if (
        value !== undefined &&
        (options.holdRemote?.(value) === true ||
          options.inSlide?.(value) === true)
      ) {
        return;
      }
      let value2 = getSlideNumber(entry.slideId);
      remotePathRevisions.set(input, (remotePathRevisions.get(input) ?? 0) + 1);
      resolveSlideConflict(input, "theirs", true);
      options.onNotice?.(
        (value2 > 0 ? "Slide " + String(value2) : "A slide") +
          (entry.theirsSha === null
            ? " deleted remotely"
            : " changed remotely"),
      );
    }
    function clashLocalSlide(input: SlideId): boolean {
      let value = (0, runtime.slideFilePath)(input);
      if (decompositionPending) {
        flushPendingDecomposition();
      }
      timers.clearTimeout(idleCommitTimer);
      idleCommitTimer = undefined;
      if (!dirtySlidePaths.has(value) || inFlightSlidePaths.has(value)) {
        return slideConflicts.has(value);
      }
      markSlideDirtyAgainstBase(
        value,
        liveSlideFiles.get(value)?.sha ?? null,
        "undo",
      );
      return true;
    }
    function copyConflictingSlide(input: SlideId): SlideId | undefined {
      if (decompositionPending) {
        flushPendingDecomposition();
      }
      let value = envelope.content.slides[input];
      if (value === undefined) {
        return;
      }
      let value2 = createRestoredSlideId(input),
        items = [...envelope.content.order],
        value3 = items.indexOf(input);
      items.splice(value3 < 0 ? items.length : value3 + 1, 0, value2);
      updateLocalEnvelope({
        ...envelope,
        content: {
          ...envelope.content,
          order: items,
          slides: {
            ...envelope.content.slides,
            [value2]: {
              ...value,
              id: value2,
            },
          },
        },
      });
      flushPendingDecomposition();
      return value2;
    }
    function resolveSlideConflict(
      input: string,
      options2: SlideConflictChoice,
      context: boolean = false,
    ): void {
      let entry = slideConflicts.get(input);
      if (entry === undefined) {
        return;
      }
      let value: SlideId | undefined;
      if (options2 === "copy") {
        value = copyConflictingSlide(entry.slideId);
        if (value === undefined) {
          return;
        }
      }
      slideConflicts.delete(input);
      heldRemoteSlideBases.delete(input);
      let entry2 = liveSlideFiles.get(input),
        value2: boolean =
          deletionConflicts.has(input) && remoteSeenWhilePublishing.has(input),
        entry3 = remoteSeenWhilePublishing.get(input),
        value3 = value2
          ? entry2?.text
          : (localSlideOverrides.get(input) ?? undefined),
        value4 = value2 ? entry3?.text : entry2?.text;
      remoteSeenWhilePublishing.delete(input);
      deletionConflicts.delete(input);
      emitEvent("resolve", {
        path: input,
        keep: options2,
        ...(value2
          ? {
              landedOverTheirs: true,
            }
          : {}),
        ...(value !== undefined
          ? {
              copy: value,
            }
          : {}),
      });
      emitEvent("clash-decision", {
        path: input,
        slide: entry.slideId,
        kind: entry.kind,
        chose: options2,
        ...(value !== undefined
          ? {
              mineIsNowSlide: value,
            }
          : {}),
      });
      if (options2 === "theirs" || options2 === "copy") {
        bumpSlideLocalRevision(input);
        stashedSlideOffers.delete(entry.slideId);
        offeredSlideIds.delete(entry.slideId);
        if (!context) {
          clearStashedSlide(
            entry.slideId,
            options2 === "copy" ? "kept as a copy" : "theirs was chosen",
          );
        }
        if (options2 === "theirs" && !context) {
          keepSlideVersion(entry.slideId, value3, "theirs-chosen");
        }
        saveQueue.resolveConflict(input, "theirs");
        if (saveQueue.unsendable().has(input)) {
          saveQueue.withdraw(input);
          inFlightSlidePaths.delete(input);
        }
        if (value2) {
          localSlideOverrides.set(
            input,
            entry3 === null || entry3 === undefined ? null : entry3.text,
          );
          dirtySlidePaths.add(input);
          if (entry2 !== undefined) {
            knownSlideShas.set(input, entry2.sha);
          } else {
            knownSlideShas.delete(input);
          }
          recomposeFromFiles(true);
          commitChanges("clash-resolved");
          return;
        }
        localSlideOverrides.delete(input);
        dirtySlidePaths.delete(input);
        if (entry2 !== undefined) {
          knownSlideShas.set(input, entry2.sha);
        } else if (
          (knownSlideShas.delete(input),
          indexStore.get().order.includes(entry.slideId))
        ) {
          indexStore.update(
            (input2) =>
              void input2.order.splice(input2.order.indexOf(entry.slideId), 1),
          );
        }
        recomposeFromFiles(true);
        if (value !== undefined || indexStore.dirty()) {
          commitChanges("clash-resolved");
        }
        return;
      }
      if (context && !localSlideOverrides.has(input)) {
        dirtySlidePaths.delete(input);
        dirtyButUnsendablePaths.delete(input);
        rebasedSlideShas.delete(input);
        try {
          saveQueue.resolveConflict(input, "theirs");
        } catch {}
        notifySaveSubscribers();
        return;
      }
      if (!context) {
        keepSlideVersion(entry.slideId, value4, "mine-chosen");
      }
      let value5 =
        context && entry.theirsSha !== (entry2?.sha ?? null)
          ? entry.theirsSha
          : (entry2?.sha ?? null);
      if (value5 !== null) {
        knownSlideShas.set(input, value5);
      } else {
        knownSlideShas.delete(input);
      }
      if (value5 !== (entry2?.sha ?? null)) {
        rebasedSlideShas.set(input, value5);
      }
      if (
        value2 &&
        (localSlideOverrides.get(input) ?? null) === (entry2?.text ?? null)
      ) {
        dirtySlidePaths.delete(input);
        localSlideOverrides.delete(input);
        notifySaveSubscribers();
        return;
      }
      dirtySlidePaths.add(input);
      if (context && dirtyButUnsendablePaths.delete(input)) {
        scheduleIdleCommit();
        scheduleMaxWaitCommit();
        return notifySaveSubscribers();
      }
      dirtyButUnsendablePaths.delete(input);
      commitChanges("clash-resolved");
    }
    function putBackOverwrittenSlide(input: string): void {
      let entry = overwrittenSlideText.get(input),
        value = (0, runtime.slideIdFromFilePath)(input);
      if (entry === undefined || value === undefined) {
        return;
      }
      overwrittenSlideText.delete(input);
      if (keptSlideVersions.get(value)?.why === "overwritten") {
        dropKeptSlideVersion(value, "put back");
      }
      let entry2 = liveSlideFiles.get(input);
      emitEvent("clash-decision", {
        path: input,
        slide: value,
        kind: "overwritten-by-a-simultaneous-save",
        chose: "put mine back",
      });
      localSlideOverrides.set(input, entry);
      dirtySlidePaths.add(input);
      if (entry2 !== undefined) {
        knownSlideShas.set(input, entry2.sha);
      } else {
        knownSlideShas.delete(input);
      }
      recomposeFromFiles(true);
      commitChanges("put-back");
    }
    let remoteApplyChain: Promise<void> = Promise.resolve();
    function enqueueRemoteChange(
      input: SaveQueueRemoteChange,
      options2: number = 0,
    ): Promise<void> {
      let value = remoteApplyChain.then(
        (): Promise<void> => applyRemoteChange(input, options2),
      );
      remoteApplyChain = value.catch((): void => {
        return;
      });
      return value;
    }
    let remoteRereadDelays: number[] = [5000, 20000];
    async function applyRemoteChange(
      input: SaveQueueRemoteChange,
      options2: number,
    ): Promise<void> {
      if (disposed) {
        return;
      }
      while (loadState === "loading") {
        let value3 = readyPromise;
        await value3;
        if (value3 === readyPromise) {
          break;
        }
      }
      if (disposed) {
        return;
      }
      if (loadState !== "live") {
        return void emitEvent("remote-skipped", {
          to: input.to.version,
          why: "the load failed; its retry reads the newest version",
        });
      }
      let value = input.changed.filter(
        (input2) =>
          input2.path === runtime.DECK_METADATA_PATH ||
          (0, runtime.slideIdFromFilePath)(input2.path) !== undefined,
      );
      if (value.length === 0) {
        return;
      }
      let entries: Map<string, LiveSlideFile | null> = new Map(),
        items: SaveQueueRemoteFile[] = [],
        value2: boolean = value.some(
          (input2) =>
            input2.path === runtime.DECK_METADATA_PATH &&
            input2.sha256 !== null,
        );
      newDeckUsesCssLists = false;
      await readFilesConcurrently(
        value.filter((input2) => input2.path !== runtime.DECK_METADATA_PATH),
        async (input2): Promise<void> => {
          if (input2.sha256 === null) {
            return void (liveSlideFiles.has(input2.path) ||
            localSlideOverrides.has(input2.path)
              ? entries.set(input2.path, null)
              : undefined);
          }
          try {
            let value3 = await readTextWithRetries(input2.path);
            entries.set(input2.path, {
              text: value3.text,
              sha: options2 > 0 ? value3.sha256 : input2.sha256,
            });
          } catch (value3: unknown) {
            console.warn(
              "slides (files): could not read " +
                input2.path +
                " after a remote change",
              value3,
            );
            items.push(input2);
          }
        },
      );
      if (items.length > 0 && options2 < remoteRereadDelays.length) {
        emitEvent("remote-reread", {
          paths: items.map((input2) => input2.path),
          inMs: remoteRereadDelays[options2],
        });
        let entries2 = new Map(
          items.map((input2): [string, number] => [
            input2.path,
            remotePathRevisions.get(input2.path) ?? 0,
          ]),
        );
        timers.setTimeout((): void => {
          let value3 = items.filter(
            (input2) =>
              (remotePathRevisions.get(input2.path) ?? 0) ===
              entries2.get(input2.path),
          );
          if (!disposed && value3.length > 0) {
            enqueueRemoteChange(
              {
                ...input,
                changed: value3,
              },
              options2 + 1,
            );
          }
        }, remoteRereadDelays[options2]);
      }
      if (value2 && decompositionPending) {
        flushPendingDecomposition();
      }
      let flag: boolean = false;
      if (value2) {
        let items2 = [...indexStore.base().order];
        try {
          await indexStore.reloadAndMerge();
          flag = !(0, runtime.stringArraysEqual)(
            items2,
            indexStore.base().order,
          );
        } catch (value3: unknown) {
          console.warn(
            "slides (files): could not read " +
              runtime.DECK_METADATA_PATH +
              " after a remote change",
            value3,
          );
          if (options2 < remoteRereadDelays.length) {
            let value4 = value.find(
              (input2) => input2.path === runtime.DECK_METADATA_PATH,
            );
            emitEvent("remote-reread", {
              paths: [runtime.DECK_METADATA_PATH],
              inMs: remoteRereadDelays[options2],
            });
            timers.setTimeout((): void => {
              if (!disposed) {
                enqueueRemoteChange(
                  {
                    ...input,
                    changed: [value4!],
                  },
                  options2 + 1,
                );
              }
            }, remoteRereadDelays[options2]);
          }
        }
      }
      if (disposed) {
        return;
      }
      if (decompositionPending) {
        flushPendingDecomposition();
      }
      let flag2: boolean = false;
      for (let [value3, value4] of entries) {
        let entry = liveSlideFiles.get(value3);
        if (
          entry !== undefined &&
          value4 !== null &&
          entry.sha === value4.sha &&
          entry.text === value4.text
        ) {
          entries.delete(value3);
          continue;
        }
        if (value4 === null) {
          liveSlideFiles.delete(value3);
        } else {
          liveSlideFiles.set(value3, value4);
        }
        rebasedSlideShas.delete(value3);
        if (
          (entry === undefined && value4 !== null) ||
          (entry !== undefined && value4 === null)
        ) {
          flag2 = true;
        }
        remotePathRevisions.set(
          value3,
          (remotePathRevisions.get(value3) ?? 0) + 1,
        );
        let value5: boolean =
            dirtySlidePaths.has(value3) || inFlightSlidePaths.has(value3),
          entry2 = recentPublishedSlideText.get(value3);
        if (
          overwrittenSlideText.has(value3) &&
          (value4?.text ?? null) === overwrittenSlideText.get(value3)
        ) {
          overwrittenSlideText.delete(value3);
          let value8 = (0, runtime.slideIdFromFilePath)(value3)!;
          if (keptSlideVersions.get(value8)?.why === "overwritten") {
            dropKeptSlideVersion(value8, "mine came back");
          }
          options.onOverwritten?.({
            path: value3,
            slideId: value8,
            slideNo: getSlideNumber(value8),
            settled: true,
          });
        } else if (
          options.onOverwritten !== undefined &&
          !value5 &&
          entry2 !== undefined &&
          timers.now() - entry2.at <= SLIDES_FILES_ERROR_NOTIFY_MS &&
          (value4?.text ?? null) !== entry2.text &&
          entry?.text === entry2.text
        ) {
          let value8 = (0, runtime.slideIdFromFilePath)(value3)!;
          overwrittenSlideText.set(value3, entry2.text);
          keepSlideVersion(value8, entry2.text, "overwritten");
          emitEvent("clash-decision", {
            path: value3,
            slide: value8,
            what:
              "a save made at the same moment as mine replaced mine " +
              String(timers.now() - entry2.at) +
              ' ms after it landed; told, with "Put mine back"',
          });
          try {
            options.onOverwritten?.({
              path: value3,
              slideId: value8,
              slideNo: getSlideNumber(value8),
              settled: false,
            });
          } catch {}
        }
        recentPublishedSlideText.delete(value3);
        if (value5) {
          if (
            (localSlideOverrides.get(value3) ?? null) === (value4?.text ?? null)
          ) {
            dirtySlidePaths.delete(value3);
            localSlideOverrides.delete(value3);
            applyRemoteSlideFile(value3, value4);
            clearSlideConflict(value3);
            if (!inFlightSlidePaths.has(value3)) {
              clearStashedSlide(
                (0, runtime.slideIdFromFilePath)(value3)!,
                "published",
              );
            }
          } else {
            if (inFlightSlidePaths.has(value3)) {
              remoteSeenWhilePublishing.set(value3, value4);
            }
            if (!inFlightSlidePaths.has(value3)) {
              dirtyButUnsendablePaths.add(value3);
            }
            markSlideDirtyAgainstBase(
              value3,
              value4?.sha ?? null,
              value4 === null ? "deleted" : "edited",
            );
          }
          continue;
        }
        let value6 = slideDocumentPathForFile(value3);
        if (
          value6 !== undefined &&
          (options.holdRemote?.(value6) === true ||
            options.inSlide?.(value6) === true)
        ) {
          if (!heldRemoteSlideBases.has(value3)) {
            heldRemoteSlideBases.set(value3, entry?.text ?? null);
          }
          continue;
        }
        let value7 = heldRemoteSlideBases.has(value3)
          ? (heldRemoteSlideBases.get(value3) ?? null)
          : (entry?.text ?? null);
        heldRemoteSlideBases.delete(value3);
        applyRemoteSlideFile(value3, value4);
        if (value7 !== (value4?.text ?? null)) {
          bumpSlideLocalRevision(value3);
        }
      }
      if (entries.size === 0 && !value2) {
        return;
      }
      if (LOCAL_SLIDE_RECOVERY_ORIGIN === "mine") {
        let value3 = [...new Set([...dirtySlidePaths, ...inFlightSlidePaths])]
          .map((input2) =>
            typeof localSlideOverrides.get(input2) === "string"
              ? (0, runtime.slideIdFromFilePath)(input2)
              : undefined,
          )
          .filter(
            (input2): input2 is SlideId =>
              input2 !== undefined &&
              !indexStore.get().order.includes(input2) &&
              previousSlideById.has(input2),
          );
        if (value3.length > 0) {
          restoreMissingIndexSlides(value3);
          if (indexStore.dirty()) {
            scheduleIdleCommit();
          }
        }
      }
      if (flag || flag2) {
        structureRevision += 1;
      }
      emitEvent("remote-applied", {
        paths: [...entries.keys()],
        index: value2,
        to: input.to.version,
        ...(flag || flag2
          ? {
              structureRev: structureRevision,
            }
          : {}),
      });
      recomposeFromFiles(true);
    }
    function replayMergedOrderChanges(
      input: string[],
      options2: string[],
      context: SlideOrderMergeResult,
    ): void {
      let value = (0, runtime.longestCommonSubsequence)(input, options2);
      if (value.length === 0) {
        return;
      }
      let value2 = value.filter((input2) => !context.order.includes(input2));
      if (value2.length > 0) {
        let value5 = options2.indexOf(value2[0]!) + 1,
          value6 =
            (value2.length === 1
              ? "Slide " + String(value5) + " was"
              : String(value2.length) + " slides were") +
            " deleted by someone else while you were moving " +
            (value2.length === 1 ? "it" : "them") +
            ", so your move was dropped.";
        emitEvent("clash-decision", {
          what: "my move of a slide someone deleted was dropped (delete wins)",
          slides: value2,
        });
        options.onNotice?.(value6);
        return;
      }
      if (context.lost.length === 0) {
        return;
      }
      let value3: boolean = context.lost.length === 1,
        value4 = context.order.indexOf(context.lost[0]!) + 1;
      emitEvent("clash-decision", {
        what: "we both moved the same slide; theirs landed first and was kept, my move of it was not applied",
        slides: context.lost,
      });
      options.onNotice?.(
        (value3
          ? "Someone else moved slide " + String(value4)
          : "Someone else moved " +
            String(context.lost.length) +
            " of the slides you moved") +
          " at the same moment as you. Their move was kept, so yours was not applied. Move " +
          (value3 ? "it" : "them") +
          " again if you still want " +
          (value3 ? "it" : "them") +
          " there.",
      );
    }
    let previousSlideById: Map<SlideId, SlideId | null> = new Map(),
      sectionIdByStartSlide: Map<string, string> = new Map();
    function restoreMissingIndexSlides(input: SlideId[]): void {
      if (
        input.every((input2) => indexStore.get().order.includes(input2))
      ) {
        return;
      }
      indexStore.update((input2) => {
        for (let value of input) {
          if (input2.order.includes(value)) {
            continue;
          }
          let entry = previousSlideById.get(value);
          for (
            let index: number = 0;
            typeof entry === "string" &&
            !input2.order.includes(entry) &&
            index < 1e4;
            index++
          )
            entry = previousSlideById.get(entry);
          let value2 =
            entry === null
              ? 0
              : typeof entry === "string"
                ? input2.order.indexOf(entry) + 1
                : input2.order.length;
          input2.order.splice(value2, 0, value);
          let entry2 = sectionIdByStartSlide.get(value),
            value3 =
              entry2 === undefined
                ? undefined
                : (input2.sections[entry2] as IndexSectionRecord | null);
          if (
            typeof value3 === "object" &&
            value3 !== null &&
            value2 + 1 < input2.order.length &&
            value3.start === input2.order[value2 + 1]
          ) {
            value3.start = value;
          }
        }
      });
    }
    function applyRemoteSlideFile(
      input: string,
      options2: LiveSlideFile | null,
    ): void {
      if (options2 === null) {
        knownSlideShas.delete(input);
      } else {
        knownSlideShas.set(input, options2.sha);
      }
    }
    function releaseRemoteHold(input: string): void {
      if (decompositionPending) {
        flushPendingDecomposition();
      }
      let value = input.startsWith(runtime.SLIDE_STORE_COLLECTION + "/")
          ? input.slice(runtime.SLIDE_STORE_COLLECTION.length + 1)
          : undefined,
        value2 =
          value !== undefined ? (0, runtime.slideFilePath)(value) : undefined;
      if (
        value2 !== undefined &&
        heldRemoteSlideBases.has(value2) &&
        options.inSlide?.(input) !== true
      ) {
        let value3 = heldRemoteSlideBases.get(value2) ?? null;
        heldRemoteSlideBases.delete(value2);
        if (dirtySlidePaths.has(value2) || inFlightSlidePaths.has(value2)) {
          markSlideDirtyAgainstBase(
            value2,
            liveSlideFiles.get(value2)?.sha ?? null,
            liveSlideFiles.has(value2) ? "edited" : "deleted",
          );
        } else {
          applyRemoteSlideFile(value2, liveSlideFiles.get(value2) ?? null);
          if (value3 !== (liveSlideFiles.get(value2)?.text ?? null)) {
            bumpSlideLocalRevision(value2);
          }
          recomposeFromFiles(true);
        }
      }
      if (value2 !== undefined) {
        retryDirtySlide(value2);
      }
      commitChanges("hold-released");
    }
    let earlySlide: SlidesFilesEarlySlide | undefined,
      earlySlideSubscribers: Set<() => void> = new Set(),
      bootGeneration: number = 0;
    function setEarlySlide(input: SlidesFilesEarlySlide | undefined): void {
      if (earlySlide === input) {
        return;
      }
      earlySlide = input;
      for (let value of [...earlySlideSubscribers])
        try {
          value();
        } catch {}
    }
    function createEarlySlideReader(
      input: SlidesFilesFirstSlide,
      options2: number,
    ): (path: string, read: Promise<FileTextRead>) => Promise<FileTextRead> {
      let callback = <T>(input2: () => T, options3: T): T => {
          try {
            return input2();
          } catch {
            return options3;
          }
        },
        value: DeckIndex | undefined,
        value2: string | undefined,
        flag: boolean = false,
        entries: Map<string, string> = new Map(),
        callback2 = (input2: string, options3: string): void => {
          if (
            flag ||
            disposed ||
            options2 !== bootGeneration ||
            loadState !== "loading"
          ) {
            return;
          }
          if (input2 === runtime.DECK_METADATA_PATH) {
            if (value !== undefined) {
              return;
            }
            let value5 = callback((): SlideId | null | undefined => {
              let value6: { v?: unknown } = JSON.parse(options3);
              if (
                typeof value6.v !== "number" ||
                value6.v > runtime.DECK_METADATA_VERSION
              ) {
                return null;
              }
              value = (0, runtime.normalizeDeckMetadata)(value6);
              return input.landing(value.order);
            }, null);
            if (
              value5 === null ||
              (0, runtime.slideIdFromFilePath)(
                (0, runtime.slideFilePath)(value5!),
              ) === undefined
            ) {
              flag = true;
              return void entries.clear();
            }
            value2 = (0, runtime.slideFilePath)(value5!);
            for (let value6 of [...entries.keys()])
              if (value6 !== value2) {
                entries.delete(value6);
              }
          } else if (value2 === undefined || input2 === value2) {
            entries.set(input2, options3);
          }
          if (value === undefined || value2 === undefined) {
            return;
          }
          let entry = entries.get(value2);
          if (entry === undefined) {
            return;
          }
          flag = true;
          entries.clear();
          let value3 = (0, runtime.slideIdFromFilePath)(value2)!,
            value4 = callback((): DeckContent | undefined => {
              if (input.allowed?.() === false) {
                return;
              }
              let value5 = (0, runtime.createSlidesFileCodec)(
                (0, runtime.createSlideDocumentCodec)().codec,
                {
                  notesInFiles: notesStoredInFiles,
                },
              ).compose(
                {
                  files: new Map([[value2!, entry]]),
                  index: {
                    ...value!,
                    order: [value3],
                  },
                  designSystems: designSystemTracker.current(),
                },
                undefined,
              );
              return input.parse(value5.content);
            }, undefined);
          if (value4?.slides[value3] !== undefined) {
            setEarlySlide({
              id: value3,
              content: value4,
            });
          }
        };
      return (input2: string, options3: Promise<FileTextRead>) => {
        if (
          !flag &&
          (input2 === runtime.DECK_METADATA_PATH ||
            input2.startsWith(runtime.SLIDE_FILE_DIRECTORY))
        ) {
          options3.then(
            (input3): void => callback2(input2, input3.text),
            (): void => {
              return;
            },
          );
        }
        return options3;
      };
    }
    async function readFilesConcurrently<T>(
      items: T[],
      options2: (item: T) => Promise<void>,
    ): Promise<void> {
      let index: number = 0,
        callback = async (): Promise<void> => {
          while (index < items.length) await options2(items[index++]!);
        };
      await Promise.all(
        Array.from<unknown, Promise<void>>(
          {
            length: Math.min(SLIDES_FILES_MAX_RECOVERY_ATTEMPTS, items.length),
          },
          callback,
        ),
      );
    }
    let bootRetryDelays: number[] = [2000, 5000, 15000],
      bootRetryAttempt: number = 0,
      bootRetryTimer: unknown,
      bootRetryPending: boolean = false,
      bootFailure: unknown,
      bootFailureAt: number = timers.now(),
      waitingForReadableListing: boolean = false,
      canTreatMissingListingAsEmpty = (state: unknown): boolean =>
        state instanceof runtime.BootReadError &&
        state.status === 404 &&
        state.path === "_files.json",
      listingRetryDelays: number[] = [5000, 20000, 60000],
      listingRetryTimer: unknown,
      listingRetryPromise: Promise<boolean> | undefined;
    function retryReadableListing(): Promise<boolean> {
      listingRetryPromise ??= options.port
        .list()
        .then(
          (): boolean => true,
          (): boolean => false,
        )
        .then((input): boolean => {
          listingRetryPromise = undefined;
          if (!input || disposed || !waitingForReadableListing) {
            return false;
          }
          timers.clearTimeout(listingRetryTimer);
          listingRetryTimer = undefined;
          waitingForReadableListing = false;
          emitEvent("load-retry", {
            why: "a file listing appeared",
          });
          setLoadState("loading");
          readyPromise = loadDocument();
          return true;
        });
      return listingRetryPromise;
    }
    function retryMissingListingOnHotUpdate(): void {
      if (disposed || !waitingForReadableListing) {
        return;
      }
      retryReadableListing();
    }
    function scheduleListingRetry(input: number = 0): void {
      if (!waitingForReadableListing) {
        return;
      }
      timers.clearTimeout(listingRetryTimer);
      listingRetryTimer = timers.setTimeout(
        (): void => {
          listingRetryTimer = undefined;
          if (disposed || !waitingForReadableListing) {
            return;
          }
          retryReadableListing().then((input2): void => {
            if (!input2) {
              scheduleListingRetry(input + 1);
            }
          });
        },
        listingRetryDelays[Math.min(input, listingRetryDelays.length - 1)],
      );
    }
    async function readBootIndex(): Promise<LoadedBootState | null> {
      let value = await (0, runtime.retryFileRead)(
        (): Promise<FileListing> => options.port.list(),
        timers,
      ).catch((): null => null);
      if (
        value === null ||
        (0, runtime.fileListingIsNarrowed)(value, options.port) ||
        options.port.narrowed === true
      ) {
        return null;
      }
      let values = new Set(value.map((input) => input.path));
      if (!values.has("index.html") || values.has(runtime.DECK_METADATA_PATH)) {
        return null;
      }
      let entries: Map<string, FileTextRead> = new Map(),
        index: number = 0;
      for (let value2 of value) {
        if (
          !value2.path.startsWith(runtime.SLIDE_FILE_DIRECTORY) ||
          (0, runtime.slideIdFromFilePath)(value2.path) === undefined
        ) {
          continue;
        }
        index += 1;
        let value3 = await readTextWithRetries(value2.path).catch(
          (): null => null,
        );
        if (value3 !== null) {
          entries.set(value2.path, {
            text: value3.text,
            sha256: value2.sha256 ?? value3.sha256,
          });
        }
      }
      return {
        narrowed: false,
        index: null,
        files: entries,
        slidesListed: index,
      };
    }
    async function loadDocument(): Promise<void> {
      bootFailureAt = timers.now();
      let value = ++bootGeneration;
      setEarlySlide(undefined);
      try {
        let value2: FileListing | undefined,
          callback = (): Promise<boolean> =>
            options.port.list().then(
              (input): boolean => {
                value2 = input;
                return false;
              },
              (input: unknown): boolean =>
                (input as { status?: number } | undefined)?.status === 404,
            ),
          flag: boolean = false;
        if (options.startEmpty === true && (await callback())) {
          await new Promise<void>((input): void => {
            timers.setTimeout(input, 1500);
          });
          if (disposed) {
            return;
          }
          flag = await callback();
        }
        waitingForReadableListing = flag;
        let value3: FileListing | undefined = value2 as
            | FileListing
            | undefined,
          flag2: boolean = false,
          value4 =
            options.firstSlide !== undefined && !flag
              ? createEarlySlideReader(options.firstSlide, value)
              : undefined,
          value5: SlidesFilesPort =
            value3 === undefined && value4 === undefined
              ? options.port
              : new Proxy(options.port, {
                  get: (
                    input: SlidesFilesPort,
                    options2: string | symbol,
                    context: unknown,
                  ): unknown =>
                    options2 === "list" && value3 !== undefined
                      ? (): Promise<FileListing> =>
                          flag2
                            ? input.list()
                            : ((flag2 = true), Promise.resolve(value3))
                      : options2 === "readText" && value4 !== undefined
                        ? (input2: string): Promise<FileTextRead> =>
                            value4(input2, input.readText(input2))
                        : Reflect.get(input, options2, context),
                }),
          value6: LoadedBootState = flag
            ? {
                narrowed: true,
                index: null,
                files: new Map(),
              }
            : await (0, runtime.readFilesBootState)({
                port: value5,
                indexPath: runtime.DECK_METADATA_PATH,
                wants: (input) =>
                  input.path.startsWith(runtime.SLIDE_FILE_DIRECTORY) &&
                  (0, runtime.slideIdFromFilePath)(input.path) !== undefined,
                timers: timers,
                mayWrite: mayWrite,
                ...(options.early !== undefined
                  ? {
                      early: options.early,
                    }
                  : {}),
                onEvent: (input) => emitEvent(input.type, input),
              }).catch(async (input: unknown): Promise<LoadedBootState> => {
                if (
                  options.startEmpty === true &&
                  canTreatMissingListingAsEmpty(input)
                ) {
                  waitingForReadableListing = true;
                  return {
                    narrowed: true,
                    index: null,
                    files: new Map(),
                  };
                }
                if (
                  !(
                    options.startEmpty === true &&
                    input instanceof runtime.BootReadError &&
                    input.code === "no_index"
                  )
                ) {
                  throw input;
                }
                let value7 = await readBootIndex();
                if (value7 === null) {
                  throw new runtime.BootReadError(
                    "unreadable",
                    runtime.DECK_METADATA_PATH,
                    runtime.DECK_METADATA_PATH + " could not be read yet",
                  );
                }
                return value7;
              });
        if (
          earlySlide !== undefined &&
          options.firstSlide?.painted !== undefined
        ) {
          await options.firstSlide.painted().catch((): void => {
            return;
          });
          if (disposed || value !== bootGeneration) {
            return;
          }
        }
        listingNarrowed =
          value6.narrowed === true ||
          (mayWrite && options.port.narrowed === true);
        canWrite = options.port.canWrite && !listingNarrowed;
        newDeckUsesCssLists =
          value6.index === null &&
          "slidesListed" in value6 &&
          value6.slidesListed === 0 &&
          canWrite;
        if (waitingForReadableListing) {
          scheduleListingRetry();
        }
        if (value6.index === null) {
          emitEvent("started-empty", {
            why: waitingForReadableListing
              ? "this page has no file listing at all: read-only"
              : runtime.DECK_METADATA_PATH + " is not in this artifact",
            slideFiles: value6.files.size,
          });
        } else if (indexStore.loadText !== undefined) {
          indexStore.loadText(value6.index.text, value6.index.sha256);
        } else {
          await indexStore.load();
        }
        notesBySlide = (await options.notes?.load()) ?? {};
        if (disposed) {
          return;
        }
        liveSlideFiles.clear();
        knownSlideShas.clear();
        for (let [value7, value8] of value6.files) {
          liveSlideFiles.set(value7, {
            text: value8.text,
            sha: value8.sha256,
          });
          knownSlideShas.set(value7, value8.sha256);
        }
        bootRetryAttempt = 0;
        loadFailureMessage = undefined;
        bootFailure = undefined;
        deckLocalRevision += 1;
        loadState = "live";
        recomposeFromFiles(true);
        for (let value7 of [...loadSubscribers]) value7();
        notifySaveSubscribers();
        offerStashedSlides();
        loadKeptVersions();
      } catch (value2: unknown) {
        loadFailureMessage =
          value2 instanceof Error
            ? value2.message
            : String(
                (value2 as { message?: unknown } | null | undefined)?.message ??
                  value2,
              );
        bootFailure = value2;
        console.error("slides (files): load failed", value2);
        setEarlySlide(undefined);
        if (
          value2 instanceof runtime.BootReadError &&
          value2.code === "access_revoked"
        ) {
          markReadAccessRevoked(
            "the deck’s files were refused (HTTP " +
              String(value2.status) +
              ")",
          );
        }
        bootRetryPending =
          !disposed &&
          !(0, runtime.isPermanentFilesBootFailure)(value2) &&
          bootRetryAttempt < bootRetryDelays.length;
        setLoadState("failed");
        if (
          !disposed &&
          !(0, runtime.isPermanentFilesBootFailure)(value2) &&
          bootRetryAttempt < bootRetryDelays.length
        ) {
          let value3 = bootRetryDelays[bootRetryAttempt++]!;
          emitEvent("load-failed", {
            error: loadFailureMessage,
            kind: (0, runtime.classifyFilesBootFailure)(value2),
            retryInMs: value3,
          });
          timers.clearTimeout(bootRetryTimer);
          bootRetryTimer = timers.setTimeout((): void => {
            bootRetryTimer = undefined;
            retryLoad("auto");
          }, value3);
        } else {
          emitEvent("load-failed", {
            error: loadFailureMessage,
            kind: (0, runtime.classifyFilesBootFailure)(value2),
            retryInMs: null,
          });
        }
      }
    }
    function retryLoad(input: string): void {
      if (loadState !== "failed" || disposed) {
        return;
      }
      timers.clearTimeout(bootRetryTimer);
      bootRetryTimer = undefined;
      emitEvent("load-retry", {
        why: input,
      });
      bootRetryPending = false;
      setLoadState("loading");
      readyPromise = loadDocument();
    }
    let readyPromise: Promise<void> = loadDocument(),
      unsubscribeRemoteChange: () => void = options.port.onRemoteChange(
        (input): void => {
          if (waitingForReadableListing) {
            retryMissingListingOnHotUpdate();
          }
          let value =
            loadState === "failed"
              ? (0, runtime.filesBootRetryDelayForHotUpdate)(
                  bootFailure,
                  input,
                  runtime.DECK_METADATA_PATH,
                  timers.now() - bootFailureAt,
                )
              : undefined;
          if (value === 0) {
            retryLoad("another version arrived");
          } else if (value !== undefined && bootRetryTimer === undefined) {
            bootRetryTimer = timers.setTimeout((): void => {
              bootRetryTimer = undefined;
              retryLoad("another version arrived");
            }, value);
          }
          notifySaveSubscribers();
        },
      );
    options.notes?.onChange?.(
      (input, options2): void => {
        if (disposed || loadState !== "live") {
          return;
        }
        if (
          timers.now() - (localNotesChangedAt.get(input) ?? -1 / 0) < 5000 ||
          notesBySlide[input] === options2
        ) {
          return;
        }
        if (options2 === undefined) {
          delete notesBySlide[input];
        } else {
          notesBySlide[input] = options2;
          locallyEditedNoteIds.add(input);
        }
        recomposeFromFiles(true);
      },
    );
    let notesSyncHeard: boolean = options.notes?.heard?.() ?? true;
    options.notes?.onState?.((): void => {
      if (disposed) {
        return;
      }
      notifySaveSubscribers();
      if (!notesSyncHeard && options.notes?.heard?.() === true) {
        notesSyncHeard = true;
        for (let value of unheardInlineNoteIds)
          if (
            notesBySlide[value] !== undefined &&
            !locallyEditedNoteIds.has(value)
          ) {
            options.notes.set(value, notesBySlide[value]);
          }
        unheardInlineNoteIds.clear();
        if (loadState === "live") {
          recomposeFromFiles(false);
        }
      }
    });
    let emptyComments: ArtifactComment[] = [],
      emptyCommentSync: ArtifactCommentSync = {
        status: "idle",
        pending: 0,
      },
      documentAdapter: SlidesFilesDocument = {
        saveMode: (): "auto" => "auto",
        state: (): ArtifactState<DeckContent> => envelope,
        content: (): DeckContent => envelope.content,
        title: (): string => envelope.title,
        comments: (): ArtifactComment[] => emptyComments,
        dirty: (): boolean => pendingSaveCount() > 0,
        readOnly: (): boolean => !canWrite,
        saveState: getSaveState,
        commentSync: (): ArtifactCommentSync => emptyCommentSync,
        pendingCommentIds: (): Set<string> => new Set(),
        retryCommentPublish: (): void => {
          return;
        },
        setContent(input: DeckContent): void {
          if (input === envelope.content) {
            return;
          }
          updateLocalEnvelope({
            ...envelope,
            content: input,
          });
          (0, runtime.recordArtifactEdit)();
        },
        updateContent(
          input: (content: DeckContent) => DeckContent,
          options2?: { auto?: boolean },
        ): void {
          let value = input(envelope.content);
          if (value === envelope.content) {
            return;
          }
          updateLocalEnvelope({
            ...envelope,
            content: value,
          });
          if (options2?.auto !== true) {
            (0, runtime.recordArtifactEdit)();
          }
        },
        setTitle(input: string): void {
          let value = (0, runtime.normalizeTitleInput)(input);
          if (value.length === 0 || value === envelope.title) {
            return;
          }
          updateLocalEnvelope({
            ...envelope,
            title: value,
          });
          (0, runtime.recordArtifactEdit)();
          commitChanges("title");
        },
        addComment: (): undefined => {
          return;
        },
        removeComment: (): void => {
          return;
        },
        documentBytes(): number {
          let index: number = 0;
          for (let value of liveSlideFiles.values())
            index += value.text.length;
          return index;
        },
        async save(): Promise<void> {
          if (loadState === "failed") {
            return void retryLoad("save");
          }
          commitChanges("save");
          options.notes?.retry?.();
          saveQueue.flushNow();
          saveQueue.retryNow();
          await saveQueue.settle();
        },
        stashOffer: (): undefined => {
          return;
        },
        restoreStash: (): undefined => {
          return;
        },
        discardStash: (): void => {
          return;
        },
        restoreCount: (): number => 0,
        subscribe(input: (change?: ArtifactChange) => void): () => void {
          documentSubscribers.add(input);
          return (): boolean => documentSubscribers.delete(input);
        },
        subscribeSave(input: (state: ArtifactSaveState) => void): () => void {
          saveSubscribers.add(input);
          return (): boolean => saveSubscribers.delete(input);
        },
        loadState: (): SlidesFilesLoadState => loadState,
        shown: (): boolean => loadState === "live",
        cachedSettled: (): boolean => false,
        subscribeLoad(input: () => void): () => void {
          loadSubscribers.add(input);
          return (): boolean => loadSubscribers.delete(input);
        },
        flushNow: (): void => commitChanges("flush-now"),
        retryLoad: (): void => retryLoad("asked"),
        storeUntouched: (): boolean => false,
        releaseHold: releaseRemoteHold,
        syncDetail: () => ({
          pending: pendingSaveCount(),
          inflight: inFlightSlidePaths.values().next().value ?? null,
          flights: inFlightSlidePaths.size > 0 ? 1 : 0,
          ...(lastSyncedAt !== undefined
            ? {
                lastSyncedAt: lastSyncedAt,
              }
            : {}),
        }),
        dispose(): void {
          disposed = true;
          timers.clearTimeout(idleCommitTimer);
          timers.clearTimeout(maxWaitCommitTimer);
          timers.clearTimeout(stashOfferTimer);
          timers.clearTimeout(bootRetryTimer);
          timers.clearTimeout(listingRetryTimer);
          unsubscribeRemoteChange();
          saveQueue.dispose();
        },
        commit: commitChanges,
        flushForUnload: flushForUnload,
        settle: async (): Promise<void> => {
          if (decompositionPending) {
            flushPendingDecomposition();
          }
          await saveQueue.settle();
        },
        ready: (): Promise<void> => readyPromise,
        applyRemote: enqueueRemoteChange,
        conflicts: (): SlideConflict[] => [...slideConflicts.values()],
        resolveConflict: (input: string, options2: SlideConflictChoice): void =>
          resolveSlideConflict(input, options2),
        stashOffers: getStashOffers,
        restoreStashed: restoreStashedSlide,
        discardStashed: discardStashedSlide,
        putBack: putBackOverwrittenSlide,
        keptVersions: getKeptSlideVersions,
        restoreKeptAsCopy: restoreKeptSlideAsCopy,
        dismissKept: (input: SlideId): void =>
          dropKeptSlideVersion(input, "dismissed"),
        slideRev: (input: SlideId): number =>
          remotePathRevisions.get((0, runtime.slideFilePath)(input)) ?? 0,
        structureRev: (): number => structureRevision,
        takeTouched: takeTouchedPaths,
        clashLocal: clashLocalSlide,
        knownShas: (): Map<string, string> =>
          new Map([
            ...[...liveSlideFiles].map(([input, input2]): [string, string] => [
              input,
              input2.sha,
            ]),
          ]),
        debugFiles(): SlidesFilesDebugFile[] {
          return [
            ...new Set([
              ...liveSlideFiles.keys(),
              ...localSlideOverrides.keys(),
            ]),
          ]
            .sort()
            .map((input): SlidesFilesDebugFile => {
              let value = (0, runtime.slideIdFromFilePath)(input),
                value2 = [
                  dirtySlidePaths.has(input) ? "unsaved" : "",
                  inFlightSlidePaths.has(input) ? "sending" : "",
                  slideConflicts.has(input)
                    ? "clash (" + slideConflicts.get(input)!.kind + ")"
                    : "",
                  heldRemoteSlideBases.has(input)
                    ? "remote held under the caret"
                    : "",
                  localSlideOverrides.get(input) === null ? "deleted here" : "",
                  value !== undefined && unsavedStash?.read(value) !== undefined
                    ? stashedSlideOffers.has(value)
                      ? "stash from an earlier session"
                      : "stashed"
                    : "",
                  overwrittenSlideText.has(input)
                    ? "mine was replaced (kept)"
                    : "",
                  value !== undefined && keptSlideVersions.has(value)
                    ? "a version set aside (" +
                      keptSlideVersions.get(value)!.why +
                      ")"
                    : "",
                ].filter((input2) => input2 !== ""),
                value3 = localSlideOverrides.has(input)
                  ? localSlideOverrides.get(input)
                  : liveSlideFiles.get(input)?.text;
              return {
                path: input,
                sha: knownSlideShas.get(input) ?? null,
                liveSha: liveSlideFiles.get(input)?.sha ?? null,
                size: typeof value3 === "string" ? value3.length : 0,
                state:
                  value2.join(", ") +
                  (remotePathRevisions.has(input)
                    ? (value2.length > 0 ? " · " : "") +
                      "remote rev " +
                      String(remotePathRevisions.get(input))
                    : ""),
              };
            });
        },
        debugQueue: (): SlidesFilesDebugQueue => ({
          dirty: [
            ...dirtySlidePaths,
            ...(indexStore.dirty() ? [runtime.DECK_METADATA_PATH] : []),
          ],
          inFlight: gestureActive,
          ...(lastSaveError !== undefined
            ? {
                lastError: lastSaveError,
              }
            : {}),
          conflicted: [...slideConflicts.keys()],
          note:
            "sending: " +
            ([...inFlightSlidePaths].join(", ") || "nothing") +
            " · idle commit " +
            (idleCommitTimer !== undefined
              ? "armed (" + String(SLIDES_FILES_SAVE_DEBOUNCE_MS) + " ms)"
              : "off") +
            " · max-wait " +
            (maxWaitCommitTimer !== undefined
              ? "armed (" + String(SLIDES_FILES_SHARED_MAX_WAIT_MS) + " ms)"
              : "off") +
            " · commit owed: " +
            String(commitOwed) +
            " · stuck: " +
            (stuckSave !== undefined
              ? stuckSave.code + " x" + String(stuckSave.attempts)
              : "no") +
            " · publishes in the last minute " +
            String(recentPublishTimes.length) +
            " (max-wait now " +
            String(getMaxCommitWait()) +
            " ms) · structure rev " +
            String(structureRevision) +
            " · stash: " +
            (unsavedStash?.kind ?? "none"),
        }),
        queue: saveQueue,
        index: indexStore,
        earlySlide: (): SlidesFilesEarlySlide | undefined => earlySlide,
        subscribeEarly(input: () => void): () => void {
          earlySlideSubscribers.add(input);
          return (): void => {
            earlySlideSubscribers.delete(input);
            if (earlySlideSubscribers.size === 0 && loadState === "live") {
              earlySlide = undefined;
            }
          };
        },
      };
    (0, runtime.registerSlideDocumentCodec)(documentAdapter, codecState);
    return documentAdapter;
  }
  bindRuntimeValue(
    runtime,
    "slidesFilesTimers",
    () => slidesFilesTimers,
    (value) => {
      slidesFilesTimers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SLIDES_FILES_SAVE_DEBOUNCE_MS",
    () => SLIDES_FILES_SAVE_DEBOUNCE_MS,
    (value) => {
      SLIDES_FILES_SAVE_DEBOUNCE_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SLIDES_FILES_SHARED_MAX_WAIT_MS",
    () => SLIDES_FILES_SHARED_MAX_WAIT_MS,
    (value) => {
      SLIDES_FILES_SHARED_MAX_WAIT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SLIDES_FILES_SOLO_MAX_WAIT_MS",
    () => SLIDES_FILES_SOLO_MAX_WAIT_MS,
    (value) => {
      SLIDES_FILES_SOLO_MAX_WAIT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SLIDES_FILES_MAX_PARALLEL_READS",
    () => SLIDES_FILES_MAX_PARALLEL_READS,
    (value) => {
      SLIDES_FILES_MAX_PARALLEL_READS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SLIDES_FILES_BOOT_REFRESH_MS",
    () => SLIDES_FILES_BOOT_REFRESH_MS,
    (value) => {
      SLIDES_FILES_BOOT_REFRESH_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SLIDES_FILES_RECONNECT_TIMEOUT_MS",
    () => SLIDES_FILES_RECONNECT_TIMEOUT_MS,
    (value) => {
      SLIDES_FILES_RECONNECT_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SLIDES_FILES_STALE_SYNC_TIMEOUT_MS",
    () => SLIDES_FILES_STALE_SYNC_TIMEOUT_MS,
    (value) => {
      SLIDES_FILES_STALE_SYNC_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SLIDES_FILES_ERROR_NOTIFY_MS",
    () => SLIDES_FILES_ERROR_NOTIFY_MS,
    (value) => {
      SLIDES_FILES_ERROR_NOTIFY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SLIDES_FILES_MAX_RECOVERY_ATTEMPTS",
    () => SLIDES_FILES_MAX_RECOVERY_ATTEMPTS,
    (value) => {
      SLIDES_FILES_MAX_RECOVERY_ATTEMPTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LOCAL_SLIDE_RECOVERY_ORIGIN",
    () => LOCAL_SLIDE_RECOVERY_ORIGIN,
    (value) => {
      LOCAL_SLIDE_RECOVERY_ORIGIN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SLIDES_FILES_PENDING_NOTE_TIMEOUT_MS",
    () => SLIDES_FILES_PENDING_NOTE_TIMEOUT_MS,
    (value) => {
      SLIDES_FILES_PENDING_NOTE_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideDocumentPathForFile",
    () => slideDocumentPathForFile,
    (value) => {
      slideDocumentPathForFile = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createSlidesFilesDocument",
    () => createSlidesFilesDocument,
  );
  return () => {
    slidesFilesTimers = {
      setTimeout: (input: () => void, options?: number): unknown =>
        setTimeout(input, options),
      clearTimeout: (input: unknown): void =>
        clearTimeout(input as Parameters<typeof clearTimeout>[0]),
      now: (): number => Date.now(),
    };
    SLIDES_FILES_SAVE_DEBOUNCE_MS = 800;
    SLIDES_FILES_SHARED_MAX_WAIT_MS =
      runtime.FILE_SAVE_DEBOUNCE_POLICY.shared.maxWaitMs;
    SLIDES_FILES_SOLO_MAX_WAIT_MS =
      runtime.FILE_SAVE_DEBOUNCE_POLICY.solo.maxWaitMs;
    SLIDES_FILES_MAX_PARALLEL_READS = 6;
    SLIDES_FILES_BOOT_REFRESH_MS = 2500;
    SLIDES_FILES_RECONNECT_TIMEOUT_MS = 60000;
    SLIDES_FILES_STALE_SYNC_TIMEOUT_MS = 1e4;
    SLIDES_FILES_ERROR_NOTIFY_MS = 3000;
    SLIDES_FILES_MAX_RECOVERY_ATTEMPTS = 8;
    LOCAL_SLIDE_RECOVERY_ORIGIN = "mine";
    SLIDES_FILES_PENDING_NOTE_TIMEOUT_MS = 20000;
    slideDocumentPathForFile = (input: string): string | undefined => {
      let value = (0, runtime.slideIdFromFilePath)(input);
      if (value === undefined) {
        return undefined;
      } else {
        return runtime.SLIDE_STORE_COLLECTION + "/" + value;
      }
    };
  };
}
