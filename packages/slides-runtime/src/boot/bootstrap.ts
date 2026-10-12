/** Restored application module; prepare first, initialize in original order. */
import type { ReactElement } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
} from "../bindings";
import type {
  DeckContent,
  Frame,
  SlideId,
  TextRole,
} from "../deck-contracts";
import type {
  BrowserFilesPort,
  BrowserFilesPortOptions,
} from "../files/browser-port";
import type {
  SlidesFilesDocument,
  StashedSlideOffer,
} from "../files/slides-document";
import type { UnsavedSlideStash } from "../files/unsaved-slides";
import type { SlidesWriteAccess } from "../documents/write-access";
import type { FileListing } from "../files/read-retries";
import type {
  LoadedStateOutcome,
  StateEnvelope,
} from "./state-file";

/** The empty deck the page boots into when it cannot show the real one. */
export type BootPresentation = Pick<
  DeckContent,
  "format" | "theme" | "order" | "slides"
>;

/** The one-slide notice shown when neither the presentation file nor the demo could be read. */
export interface BootErrorPresentation extends StateEnvelope {
  title: string;
  content: Pick<DeckContent, "order" | "slides">;
}

/** The files debugger the boot sequence reports to (the real panel or its no-op stand-in). */
export interface SlidesBootDebugger {
  reloadReason: string;
  phase(name: string): void;
  field(name: string, value: unknown): void;
  event(type: string, detail?: unknown): void;
  /** Shows what the open files and the save queue look like. */
  provide(sources: { files: () => unknown; queue: () => unknown }): void;
  /** The deck is on screen at this version. */
  visible(version: string, how: string): void;
  hotEvent(event: unknown): void;
  beforeRestart(reason: string): void;
  mount(kind: string): void;
  read(path: string, ms: number, status: number, fresh: boolean): void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    BootstrapJsx: JsxNamespace;
    slidesBootStartedAt: number;
    slidesBootDebugger: SlidesBootDebugger | undefined;
    getSlidesBootDebugger: () => SlidesBootDebugger;
    FILES_PRESENTATION_READ_ONLY_MESSAGE: string;
    FILES_PRESENTATION_LOAD_FAILURE_MESSAGE: string;
    EMPTY_BOOT_PRESENTATION: BootPresentation;
    SlidesRootApp: () => ReactElement;
    slidesWriteAccessPromise: Promise<SlidesWriteAccess> | undefined;
    getSlidesWriteAccess: () => Promise<SlidesWriteAccess>;
    filesBootPortOptions: BrowserFilesPortOptions;
    createSlidesBootFilesPort: () => Promise<BrowserFilesPort>;
    stashedSlideDisplayName: (
      document2: SlidesFilesDocument,
      slideId: SlideId,
    ) => string;
    bootAllowsExternalUpdates: () => boolean;
    syncFailureToastId: number | undefined;
    SLIDES_BOOT_LOADING_NOTICE_DELAY_MS: number;
    buildBootErrorPresentation: (diagnostic: string) => BootErrorPresentation;
    configureLoadedLegacyState: (outcome: LoadedStateOutcome) => void;
    failedLegacyStateOutcome: (error: unknown) => LoadedStateOutcome;
    bootLegacyFileState: () => Promise<void>;
    configureReadOnlyBoot: (reason?: string) => void;
    detachEarlyHotUpdatesForLegacyBoot: () => void;
    initializeSlidesBootDebugger: (port: BrowserFilesPort) => BrowserFilesPort;
    showStashedSlideRecovery: (
      document2: SlidesFilesDocument,
      offer: StashedSlideOffer,
    ) => void;
    configureFilesDocumentFactory: (
      port: BrowserFilesPort,
      stash: UnsavedSlideStash | undefined,
    ) => void;
    showSyncFailureToast: (document2: SlidesFilesDocument) => void;
    bootThumbnailFromEarlyFiles: () => Promise<boolean>;
    bootSlidesApplication: () => Promise<void>;
    bootSlidesFilesMode: () => Promise<void>;
  }
}

export function installBootstrap(runtime: RuntimeBindings): () => void {
  var BootstrapJsx: JsxNamespace;
  var slidesBootStartedAt: number;
  var slidesBootDebugger: SlidesBootDebugger | undefined;
  var getSlidesBootDebugger: () => SlidesBootDebugger;
  var FILES_PRESENTATION_READ_ONLY_MESSAGE: string;
  var FILES_PRESENTATION_LOAD_FAILURE_MESSAGE: string;
  var EMPTY_BOOT_PRESENTATION: BootPresentation;
  var SlidesRootApp: () => ReactElement;
  var slidesWriteAccessPromise: Promise<SlidesWriteAccess> | undefined;
  var getSlidesWriteAccess: () => Promise<SlidesWriteAccess>;
  var filesBootPortOptions: BrowserFilesPortOptions;
  var createSlidesBootFilesPort: () => Promise<BrowserFilesPort>;
  var stashedSlideDisplayName: (
    document2: SlidesFilesDocument,
    slideId: SlideId,
  ) => string;
  var bootAllowsExternalUpdates: () => boolean;
  var syncFailureToastId: number | undefined;
  var SLIDES_BOOT_LOADING_NOTICE_DELAY_MS: number;
  function buildBootErrorPresentation(
    diagnostic: string,
  ): BootErrorPresentation {
    let makeTextFrame = (
      input: string,
      options: number,
      context: TextRole,
      value: string,
    ): Frame => ({
      id: input,
      x: {
        anchor: "leading",
        margin: 128,
        offset: 0,
        size: 1600,
      },
      y: {
        anchor: "leading",
        margin: options,
        offset: 0,
      },
      node: {
        kind: "text",
        role: context,
        text: value,
      },
    });
    return {
      title: "Couldn’t load this presentation",
      content: {
        order: ["notice"],
        slides: {
          notice: {
            v: 1,
            id: "notice",
            bg: "ivory-warm",
            frames: [
              makeTextFrame(
                "t",
                320,
                "display",
                "Couldn’t load this presentation",
              ),
              makeTextFrame(
                "d",
                520,
                "lead",
                "Neither " +
                  runtime.LEGACY_SLIDES_HTML_PATH +
                  " nor the demo could be read (" +
                  diagnostic +
                  ").",
              ),
            ],
          },
        },
      },
    };
  }
  function configureLoadedLegacyState(outcome: LoadedStateOutcome) {
    if (outcome.error !== undefined) {
      console.warn("slides (files mode): " + outcome.error);
    }
    let state =
        outcome.origin === "failed"
          ? buildBootErrorPresentation(outcome.error ?? "")
          : outcome.state,
      readOnlyReason =
        (outcome.origin === "failed"
          ? "This presentation couldn’t be loaded."
          : outcome.origin === "demo"
            ? FILES_PRESENTATION_READ_ONLY_MESSAGE +
              (outcome.stateFileFound === true
                ? " This is the Slides demo: this page’s own presentation file couldn’t be used (" +
                  (outcome.error ?? "") +
                  ")."
                : " No " +
                  runtime.LEGACY_SLIDES_HTML_PATH +
                  " is published beside this page yet, so the Slides demo is shown.")
            : FILES_PRESENTATION_READ_ONLY_MESSAGE) +
        (outcome.note === undefined ? "" : " " + outcome.note);
    (0, runtime.configureArtifactDocument)({
      embeddedState: state,
      pageParts: runtime.EMPTY_FILE_STATE_PAGE_PARTS,
      roFlag: (0, runtime.readableStateStorageSlot)(readOnlyReason),
      stash: runtime.unavailableStateStorageSlot,
      canPublish: true,
    });
    let value = (0, runtime.stateEnvelopeTitle)(state);
    if (value !== undefined) {
      document.title = value;
    }
  }
  function failedLegacyStateOutcome(error: unknown): LoadedStateOutcome {
    return {
      state: {},
      origin: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
  async function bootLegacyFileState(): Promise<void> {
    let value: LoadedStateOutcome;
    try {
      value = await (0, runtime.loadInstanceOrDemoState)({
        stateFile: runtime.LEGACY_SLIDES_HTML_PATH,
        demoFile: runtime.LEGACY_SLIDES_DEMO_PATH,
        read: runtime.parseLegacySlidesHtml,
      });
    } catch (value2) {
      value = failedLegacyStateOutcome(value2);
    }
    configureLoadedLegacyState(value);
  }
  function configureReadOnlyBoot(reason?: string) {
    (0, runtime.configureArtifactDocumentFactory)(undefined);
    (0, runtime.configureArtifactDocument)(
      (0, runtime.readOnlyEmbeddedDocumentOptions)(
        EMPTY_BOOT_PRESENTATION,
        reason,
      ),
    );
    (0, runtime.prepareSlidesThumbnailCapture)();
  }
  function detachEarlyHotUpdatesForLegacyBoot() {
    let value = runtime.hotReloadBridge.owed() !== undefined,
      length = runtime.hotReloadBridge.queued.length;
    runtime.hotReloadBridge.detach();
    if (!value && length > 0) {
      try {
        (0, runtime.getHotCapability)()?.restart?.({
          note: "content changed during a non-files boot",
        });
      } catch {}
    }
  }
  function initializeSlidesBootDebugger(
    port: BrowserFilesPort,
  ): BrowserFilesPort {
    let debug = getSlidesBootDebugger();
    debug.phase("listing read");
    debug.field(
      "slidesHost.hot handler",
      runtime.hotReloadBridge.active
        ? "registered at module start (registerEarlyHot, first import)"
        : "absent",
    );
    (0, runtime.setArtifactFeedbackHandler)(
      (input, options) => debug.event(input, options),
    );
    let unloadReport = (0, runtime.readLastUnloadFlushReport)();
    if (unloadReport !== undefined) {
      debug.event("unload-flush-previous-load", unloadReport);
    }
    return (0, runtime.instrumentFilesPort)(port, debug);
  }
  function showStashedSlideRecovery(
    document2: SlidesFilesDocument,
    offer: StashedSlideOffer,
  ) {
    let chooseAction =
        (input: boolean) =>
        () => {
          (0, runtime.closeToast)(value);
          if (input) {
            document2.restoreStashed(offer.slideId);
          } else {
            document2.discardStashed(offer.slideId);
          }
        },
      confirmation = (0, runtime.stashedSlideRestoreConfirmation)({
        slide: stashedSlideDisplayName(document2, offer.slideId),
        gone: document2.content().slides[offer.slideId] === undefined,
        moved: offer.moved,
      }),
      value = (0, runtime.showActionToast)(
        confirmation.message,
        BootstrapJsx.jsxs("span", {
          style: {
            display: "inline-flex",
            gap: 8,
          },
          children: [
            BootstrapJsx.jsx(runtime.Button, {
              size: "sm",
              variant: "secondary",
              onClick: chooseAction(true),
              children: "Restore",
            }),
            BootstrapJsx.jsx(runtime.Button, {
              size: "sm",
              variant: "secondary",
              onClick: chooseAction(false),
              children: confirmation.discardLabel,
            }),
          ],
        }),
      );
  }
  function configureFilesDocumentFactory(
    port: BrowserFilesPort,
    stash: UnsavedSlideStash | undefined,
  ) {
    slidesBootDebugger?.field("crash stash", stash?.kind ?? "none");
    (0, runtime.configureArtifactDocumentFactory)(
      (options) => {
        let value = (0, runtime.createDelayedSyncErrorNotifier)({
            show: () => showSyncFailureToast(value2),
            hide: () => {
              if (syncFailureToastId !== undefined) {
                (0, runtime.closeToast)(syncFailureToastId);
                syncFailureToastId = undefined;
              }
            },
          }),
          value2 = (0, runtime.createSlidesFilesDocument)({
            port: port,
            parseContent: options.parseContent,
            initialContent: options.initialContent,
            defaultTitle: document.title || options.defaultTitle,
            holdRemote: (input) =>
              input === (0, runtime.protectedSlideDocumentPath)(),
            inSlide: (input) =>
              input === (0, runtime.activeEditingDocumentPath)(),
            startEmpty: true,
            paced: true,
            early: runtime.hotReloadBridge,
            firstSlide: {
              landing: (input) =>
                (0, runtime.initialCurrentSlideId)(
                  input,
                  (0, runtime.resolvePagePlaceLink)(),
                ),
              parse: (0, runtime.createSlidesArtifactDocumentOptions)()
                .parseContent,
              allowed: bootAllowsExternalUpdates,
              painted: runtime.waitForEarlySlidePaint,
            },
            onNotice: (input) => {
              slidesBootDebugger?.event("notice", {
                text: input,
              });
              (0, runtime.showToast)(input);
            },
            onStashOffer: (input) =>
              showStashedSlideRecovery(value2, input),
            ...(stash !== undefined
              ? {
                  stash: stash,
                }
              : {}),
            onEvent: (input, options2: { message: string }) => {
              slidesBootDebugger?.event("doc-" + input, options2);
              value(input);
              if (input === "save-left-out") {
                (0, runtime.showToast)(options2.message, 12000);
              }
            },
          });
        (0, runtime.installUnloadSaveFlush)(value2, {
          report: (input) =>
            slidesBootDebugger?.event("unload-flush-" + input.result, input),
        });
        slidesBootDebugger?.provide({
          files: () => value2.debugFiles(),
          queue: () => value2.debugQueue(),
        });
        value2.ready().then(() => {
          slidesBootDebugger?.phase("deck on screen");
          if (
            slidesBootDebugger !== undefined &&
            slidesBootDebugger.reloadReason.startsWith("hot restart")
          ) {
            slidesBootDebugger.visible(port.version().version, "restarted");
          }
        });
        let value3 = (0, runtime.createFilesHotUpdateController)({
          port: port,
          isBusy: runtime.editorViewStateBusy,
          contentWhileBusy: true,
          snapshot: runtime.captureEditorViewState,
          restore: runtime.restoreEditorViewState,
          applyRemote: (input) => value2.applyRemote(input),
          onEvent: (input) => {
            slidesBootDebugger?.hotEvent(input);
            if (input.type === "applied") {
              slidesBootDebugger?.visible(input.to, "adopted");
            }
          },
          onBeforeRestart: (input) =>
            slidesBootDebugger?.beforeRestart(input),
        });
        slidesBootDebugger?.field(
          "slidesHost.hot",
          value3.active ? "present" : "absent (plain reloads)",
        );
        slidesBootDebugger?.mount("files");
        return value2;
      },
    );
  }
  function showSyncFailureToast(document2: SlidesFilesDocument) {
    let saveState = document2.saveState();
    if (saveState.status !== "error" || saveState.message === undefined) {
      return;
    }
    if (syncFailureToastId !== undefined) {
      (0, runtime.closeToast)(syncFailureToastId);
    }
    let message = saveState.message.replace(
        /[;.] ?[Cc]lick to (try now|retry|try again)\.?$/,
        ".",
      ),
      toast = (0, runtime.showActionToast)(
        message,
        BootstrapJsx.jsx(runtime.Button, {
          size: "sm",
          variant: "secondary",
          onClick: () => {
            (0, runtime.closeToast)(toast);
            syncFailureToastId = undefined;
            document2.save();
          },
          children: "Try now",
        }),
      );
    syncFailureToastId = toast;
  }
  async function bootThumbnailFromEarlyFiles(): Promise<boolean> {
    let value = await (0, runtime.readEarlySlidesFilesEnvelope)(
      async (input) => {
        try {
          let value3 = await fetch(input);
          if (value3.ok) {
            return await value3.text();
          } else {
            return null;
          }
        } catch {
          return null;
        }
      },
    ).catch(() => null);
    if (value === null) {
      return false;
    }
    let value2 = runtime.defaultSlidesFileCodec.compose(
      {
        files: value.files,
        index: value.index,
      },
      undefined,
    );
    (0, runtime.configureArtifactDocument)({
      embeddedState: {
        title: value2.title,
        content: value2.content,
      },
      pageParts: runtime.EMPTY_FILE_STATE_PAGE_PARTS,
      roFlag: (0, runtime.readableStateStorageSlot)(""),
      stash: runtime.unavailableStateStorageSlot,
      canPublish: true,
    });
    (0, runtime.waitForThumbnailResources)();
    return true;
  }
  async function bootSlidesApplication(): Promise<void> {
    if (
      (0, runtime.isFrameCaptureMode)() &&
      (await bootThumbnailFromEarlyFiles())
    ) {
      return;
    }
    if ((0, runtime.detectCompiledPageStorageMode)(document) !== "db") {
      detachEarlyHotUpdatesForLegacyBoot();
      return bootLegacyFileState().catch(
        (input) => configureLoadedLegacyState(failedLegacyStateOutcome(input)),
      );
    }
    if ((0, runtime.isFrameCaptureMode)() || runtime.isEmbeddedArtifact) {
      return configureReadOnlyBoot();
    }
    await bootSlidesFilesMode().catch((input) => {
      console.error("slides (files): boot failed", input);
      configureReadOnlyBoot(FILES_PRESENTATION_LOAD_FAILURE_MESSAGE);
    });
  }
  async function bootSlidesFilesMode(): Promise<void> {
    runtime.hotReloadBridge.armReady();
    let value = initializeSlidesBootDebugger(
        await createSlidesBootFilesPort(),
      ),
      value2: FileListing | undefined,
      value3 = (0, runtime.retryMissingFileListing)(
        () =>
          (0, runtime.retryFileRead)(
            () =>
              (0, runtime.mapMissingFileListingError)(
                (0, runtime.listWritableFiles)(value),
              ),
            undefined,
            undefined,
            runtime.BOOT_FILE_READ_RETRY_DELAYS_MS,
          ),
      ),
      value4 =
        value.mayWrite === false
          ? {
              did: "nothing",
              why: "cannot-publish",
            }
          : await (0, runtime.restoreLegacyStoreToFiles)({
              files: {
                get canWrite() {
                  return value.canWrite;
                },
                list: () =>
                  value3().then((input) => (value2 = input)),
                publish: (input, options) => value.publish(input, options),
              },
              store: async () => {
                let value8 = await (0,
                runtime.getLegacyDatabasePort)();
                if (value8 === null) {
                  return null;
                } else {
                  return {
                    get: (input) => value8.get(input),
                    list: (input) => value8.list(input),
                  };
                }
              },
            }),
      value5 = (0, runtime.legacyStoreRestorePolicy)(value4);
    if (value5.say !== undefined) {
      (value5.say.level === "warn" ? console.warn : console.info)(
        value5.say.text,
      );
    }
    if (value5.then === "seal") {
      throw Error(
        "slides: this deck may still have slides in the store that could not be brought over; not opening it for editing",
      );
    }
    let value6 =
        value4.did !== "nothing" || value2 === undefined
          ? value
          : (0, runtime.seedFilesPortListing)(value, value2),
      value7 = value.canWrite
        ? await Promise.race([
            (0, runtime.createPersistentUnsavedSlideStash)({
              version: () => value.version().version,
            }).catch((): undefined => {
              return;
            }),
            new Promise<undefined>(
              (input) =>
                setTimeout(
                  () => input(undefined),
                  SLIDES_BOOT_LOADING_NOTICE_DELAY_MS,
                ),
            ),
          ])
        : undefined;
    configureFilesDocumentFactory(value6, value7);
  }
  bindRuntimeValue(
    runtime,
    "BootstrapJsx",
    () => BootstrapJsx,
    (value) => {
      BootstrapJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slidesBootStartedAt",
    () => slidesBootStartedAt,
    (value) => {
      slidesBootStartedAt = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slidesBootDebugger",
    () => slidesBootDebugger,
    (value) => {
      slidesBootDebugger = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getSlidesBootDebugger",
    () => getSlidesBootDebugger,
    (value) => {
      getSlidesBootDebugger = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILES_PRESENTATION_READ_ONLY_MESSAGE",
    () => FILES_PRESENTATION_READ_ONLY_MESSAGE,
    (value) => {
      FILES_PRESENTATION_READ_ONLY_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILES_PRESENTATION_LOAD_FAILURE_MESSAGE",
    () => FILES_PRESENTATION_LOAD_FAILURE_MESSAGE,
    (value) => {
      FILES_PRESENTATION_LOAD_FAILURE_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buildBootErrorPresentation",
    () => buildBootErrorPresentation,
  );
  bindRuntimeValue(
    runtime,
    "configureLoadedLegacyState",
    () => configureLoadedLegacyState,
  );
  bindRuntimeValue(
    runtime,
    "failedLegacyStateOutcome",
    () => failedLegacyStateOutcome,
  );
  bindRuntimeValue(runtime, "bootLegacyFileState", () => bootLegacyFileState);
  bindRuntimeValue(
    runtime,
    "EMPTY_BOOT_PRESENTATION",
    () => EMPTY_BOOT_PRESENTATION,
    (value) => {
      EMPTY_BOOT_PRESENTATION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SlidesRootApp",
    () => SlidesRootApp,
    (value) => {
      SlidesRootApp = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "configureReadOnlyBoot",
    () => configureReadOnlyBoot,
  );
  bindRuntimeValue(
    runtime,
    "slidesWriteAccessPromise",
    () => slidesWriteAccessPromise,
    (value) => {
      slidesWriteAccessPromise = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getSlidesWriteAccess",
    () => getSlidesWriteAccess,
    (value) => {
      getSlidesWriteAccess = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "detachEarlyHotUpdatesForLegacyBoot",
    () => detachEarlyHotUpdatesForLegacyBoot,
  );
  bindRuntimeValue(
    runtime,
    "filesBootPortOptions",
    () => filesBootPortOptions,
    (value) => {
      filesBootPortOptions = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createSlidesBootFilesPort",
    () => createSlidesBootFilesPort,
    (value) => {
      createSlidesBootFilesPort = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSlidesBootDebugger",
    () => initializeSlidesBootDebugger,
  );
  bindRuntimeValue(
    runtime,
    "stashedSlideDisplayName",
    () => stashedSlideDisplayName,
    (value) => {
      stashedSlideDisplayName = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "showStashedSlideRecovery",
    () => showStashedSlideRecovery,
  );
  bindRuntimeValue(
    runtime,
    "bootAllowsExternalUpdates",
    () => bootAllowsExternalUpdates,
    (value) => {
      bootAllowsExternalUpdates = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "configureFilesDocumentFactory",
    () => configureFilesDocumentFactory,
  );
  bindRuntimeValue(
    runtime,
    "syncFailureToastId",
    () => syncFailureToastId,
    (value) => {
      syncFailureToastId = value;
    },
  );
  bindRuntimeValue(runtime, "showSyncFailureToast", () => showSyncFailureToast);
  bindRuntimeValue(
    runtime,
    "bootThumbnailFromEarlyFiles",
    () => bootThumbnailFromEarlyFiles,
  );
  bindRuntimeValue(
    runtime,
    "SLIDES_BOOT_LOADING_NOTICE_DELAY_MS",
    () => SLIDES_BOOT_LOADING_NOTICE_DELAY_MS,
    (value) => {
      SLIDES_BOOT_LOADING_NOTICE_DELAY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "bootSlidesApplication",
    () => bootSlidesApplication,
  );
  bindRuntimeValue(runtime, "bootSlidesFilesMode", () => bootSlidesFilesMode);
  return () => {
    BootstrapJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    (0, runtime.initializeDocumentColorMode)(document);
    slidesBootStartedAt =
      typeof performance !== "undefined" ? performance.now() : 0;
    getSlidesBootDebugger = () =>
      (slidesBootDebugger ??= (0, runtime.createFilesDebugger)({
        product: "slides",
        hot: (0, runtime.getHotCapability)(),
        bootStartedAt: slidesBootStartedAt,
      }));
    FILES_PRESENTATION_READ_ONLY_MESSAGE =
      "This presentation is read-only here.";
    FILES_PRESENTATION_LOAD_FAILURE_MESSAGE =
      "Couldn’t load this presentation. Reload to try again.";
    EMPTY_BOOT_PRESENTATION = {
      format: "html",
      theme: "neutral",
      order: [],
      slides: {},
    };
    SlidesRootApp = (0, runtime.isFrameCaptureMode)()
      ? runtime.SlidesThumbnailApp
      : runtime.SlidesApp;
    getSlidesWriteAccess = () =>
      (slidesWriteAccessPromise ??= (0, runtime.determineSlidesWriteAccess)());
    filesBootPortOptions = {
      fetchFresh: (input) =>
        fetch(input, {
          cache: "no-store",
        }),
      onRead: (input, options, context, value) =>
        slidesBootDebugger?.read(input, options, context, value),
      onPublishError: (input) =>
        slidesBootDebugger?.event("publish-raw-error", input),
    };
    createSlidesBootFilesPort = async () =>
      (0, runtime.createBrowserFilesPort)({
        canWrite: (await getSlidesWriteAccess()).canWrite,
        ...filesBootPortOptions,
      });
    stashedSlideDisplayName = (document2, slideId) => {
      let slideNumber = document2.content().order.indexOf(slideId) + 1;
      if (slideNumber > 0) {
        return "slide " + String(slideNumber);
      } else {
        return "a slide that is no longer in the presentation";
      }
    };
    bootAllowsExternalUpdates = () =>
      !(0, runtime.wasCreationSequenceFlagRequested)() ||
      !(0, runtime.getFeatureFlag)(runtime.CREATION_SEQUENCE_FLAG, false) ||
      runtime.agentActivityStore.get() === "idle";
    SLIDES_BOOT_LOADING_NOTICE_DELAY_MS = 3000;
    try {
      if (
        (0, runtime.detectCompiledPageStorageMode)(document) === "db" &&
        !(0, runtime.isFrameCaptureMode)() &&
        !runtime.isEmbeddedArtifact
      ) {
        (0, runtime.requestCreationSequenceFlag)();
        runtime.agentActivityStore.subscribe(() => {});
      }
    } catch {}
    bootSlidesApplication()
      .then(runtime.detectAutoSavingArtifactRuntime)
      .then(() => {
        let value = document.getElementById("root");
        if (!value) {
          throw Error("missing #root");
        }
        runtime.reactDOMClientOT0
          .createRoot(value)
          .render(BootstrapJsx.jsx(SlidesRootApp, {}));
      });
  };
}
