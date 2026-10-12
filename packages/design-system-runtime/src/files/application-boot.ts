import type * as FilesCore from "../contracts/files-core";
import type * as Docs from "../contracts/design-system-document";
import type * as Boot from "../contracts/boot";
import type * as Model from "../contracts";
import type * as Storage from "../contracts/model-storage";
import type * as Dom from "../contracts/dom";
import type * as Host from "../contracts/platform-host";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installFilesApplicationBoot(
  runtime: RuntimeBindings,
): () => void {
  var jsxDesignSystemBootstrap: typeof import("react/jsx-runtime");
  var isDesignSystemTypeHost: boolean;
  var designSystemBootStartedAt: number;
  var designSystemFilesDebugger: FilesCore.FilesDebugger | undefined;
  var perFileDesignSystemBooted: boolean;
  var resolveDesignSystemFirstPaint: () => void;
  var designSystemFirstPaint: Promise<void>;
  var hasIgnoredLegacyRootFile: boolean;
  var IGNORED_LEGACY_ROOT_FILE_MESSAGE: string;
  var UNREAD_LEGACY_STORE_CHANGES_MESSAGE: string;
  var unreadDesignSystemFileHomes: () => Boot.FileHomes;
  var designSystemFileHomeDecision: Boot.FileHomeDecision;
  var designSystemFileHomes: Boot.FileHomes;
  var designSystemStateLayout: (input: Boot.RawEnvelope) => "tree" | "envelope";
  function configureLegacyDesignSystemBoot(
    outcome: Boot.LegacyInitialState,
    emptyWriteAccess: boolean | null = null,
    readOnlyReason?: string,
  ): void {
    let {
      boot: boot,
      opts: options,
      instance: instance,
    } = (0, runtime.documentOptionsForBootMode)(
      (0, runtime.chooseDesignSystemBootModeModelBoot)(
        outcome,
        emptyWriteAccess,
        isDesignSystemTypeHost,
      ),
      readOnlyReason,
    );
    if (outcome.error !== undefined && boot.mode !== "instance") {
      console.warn("design-system (files mode): " + outcome.error);
    }
    let title = (0, runtime.stateEnvelopeTitle)(boot.state);
    if (title !== undefined) {
      document.title = title;
    }
    (0, runtime.setDocumentBootOptions)(options, {
      instance: instance,
    });
  }
  async function probeLegacyDesignSystemWriteAccess(): Promise<boolean | null> {
    let writeDenied: boolean = false,
      probe = new Promise<boolean | null>((input): void => {
        let count: number = 2,
          callback = (input2: boolean | null | undefined) => {
            if (input2 === true) {
              return input(true);
            }
            if (input2 === false) {
              writeDenied = true;
            }
            if (--count === 0) {
              input(writeDenied ? false : null);
            }
          };
        (0, runtime.currentUserCanEdit)().then(callback);
        (0, runtime.getAssetsCapability)().then((input2) =>
          callback(input2 === null ? null : true),
        );
      }),
      timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        probe,
        new Promise<boolean | null>(
          (input) =>
            (timer = setTimeout(
              () => input(writeDenied ? false : null),
              runtime.capabilityLoadTimeoutMs,
            )),
        ),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  function failedLegacyStateOutcome(error: unknown): Boot.LegacyInitialState {
    return {
      state: {},
      origin: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
  function initializeDesignSystemFilesDebugger(): void {
    if (
      designSystemFilesDebugger !== undefined ||
      typeof document === "undefined" ||
      !(0, runtime.filesModeDebugEnabled)("files")
    ) {
      return;
    }
    let value = (0, runtime.createFilesDebugger)({
      product: "design-system",
      hot: (0, runtime.getHotCapability)(),
      bootStartedAt: designSystemBootStartedAt,
    });
    designSystemFilesDebugger = value;
    value.field("mode", "per-file (design-system.json is the index)");
    value.phase("index read");
    value.mount("files");
  }
  function readDesignSystemBootStateFile(
    text: string,
    path: string,
    homes: Boot.FileHomes,
  ): Boot.LegacyReadSuccess | string {
    let index =
        text.length > runtime.MAX_DESIGN_SYSTEM_INDEX_CHARS
          ? null
          : (0, runtime.parseFilesIndex)(text),
      marked = index !== null && (0, runtime.hasFilesMigrationMarker)(index);
    if (path === runtime.FILES_INDEX_PROJECT_PATH) {
      homes.project = marked ? "marked" : "other";
      homes.projectText = text;
      if (index === null || !marked) {
        return "not a marked index: under project/ nothing else is this system’s";
      }
      return {
        envelope: {
          title: index.title,
          content: {
            v: 2,
            files: {},
          },
          [runtime.TREE_INDEX_FIELD]: index,
        },
      };
    }
    if (index === null) {
      let value = (0, runtime.parseDesignSystemEnvelope)(text);
      if (path === runtime.FILES_INDEX_NAME) {
        homes.root = typeof value === "string" ? "other" : "envelope";
      }
      return value;
    }
    if (path === runtime.FILES_INDEX_NAME) {
      homes.root = marked ? "marked" : "unmarked";
      homes.rootText = text;
    }
    if (!marked) {
      return "an index without a files marker";
    }
    return {
      envelope: {
        title: index.title,
        content: {
          v: 2,
          files: {},
        },
        [runtime.TREE_INDEX_FIELD]: index,
      },
    };
  }
  function recordDesignSystemFileHomeDecision(
    outcome: Boot.LegacyInitialState,
    decision: Boot.FileHomeDecision,
  ): void {
    designSystemFileHomeDecision = decision;
    hasIgnoredLegacyRootFile =
      designSystemFileHomeDecision.strayRoot ||
      (designSystemFileHomeDecision.ignoredRoot &&
        !designSystemFileHomeDecision.ignoredSingleFile);
    if (
      outcome.origin === "instance" &&
      (0, runtime.readTreeIndex)(outcome.state) !== undefined
    ) {
      runtime.activeHotReloadSession?.armReady();
      if (!isDesignSystemTypeHost) {
        initializeDesignSystemFilesDebugger();
      }
    }
  }
  function applyFileHomeReadAnswers(
    homes: Boot.FileHomes,
    answers: Record<string, Boot.LegacyAnswerKind> | undefined,
  ): Boot.FileHomes {
    let answerState = (
      input: string,
      options: Boot.FileHomeKind,
    ): Boot.FileHomeKind =>
      answers?.[input] === "unread"
        ? "unread"
        : answers?.[input] === "missing"
          ? "absent"
          : options;
    return {
      ...homes,
      project: answerState(runtime.FILES_INDEX_PROJECT_PATH, homes.project),
      root: answerState(runtime.FILES_INDEX_NAME, homes.root),
    };
  }
  async function readDesignSystemInitialState(
    onOwn?: (
      state: Boot.RawEnvelope | "missing" | "unreadable",
      homes: Boot.FileHomeDecision,
    ) => void,
  ): Promise<Boot.LegacyInitialState> {
    try {
      let values = new Set<string>(),
        callback = async (input: string) => {
          let controller = new AbortController(),
            value3 = values.has(input);
          values.add(input);
          let value4 = setTimeout(
            () => controller.abort(),
            value3
              ? runtime.STORE_META_RETRY_MS
              : runtime.STORE_META_LOADING_NOTICE_MS,
          );
          try {
            return await fetch(input, {
              signal: controller.signal,
            });
          } finally {
            clearTimeout(value4);
          }
        },
        value = unreadDesignSystemFileHomes(),
        callback2 = (
          input: Record<string, Boot.LegacyAnswerKind> | undefined,
        ) => {
          let value3 = applyFileHomeReadAnswers(value, input);
          return (0, runtime.chooseDesignSystemFileHome)({
            ...value3,
            sameText:
              value3.projectText !== undefined &&
              value3.projectText === value3.rootText,
          });
        },
        callback3 = () =>
          (0, runtime.readLegacyDesignSystemState)({
            stateFiles: [runtime.FILES_INDEX_PROJECT_PATH],
            demoFile: runtime.DESIGN_SYSTEM_DEMO_PATH,
            fetch: callback,
            mayWrite: async () =>
              (await (0, runtime.determineSlidesWriteAccess)()).canWrite,
            refusedWaits: runtime.BOOT_FILE_READ_RETRY_DELAYS_MS,
            read: (input: string, options: string) =>
              readDesignSystemBootStateFile(input, options, value),
            ...(onOwn !== undefined
              ? {
                  onOwn: (
                    input: Boot.RawEnvelope | "missing" | "unreadable",
                    options: Record<string, Boot.LegacyAnswerKind>,
                  ) => onOwn(input, callback2(options)),
                }
              : {}),
          }),
        value2 = await callback3();
      if (
        value2.stateFileAnswers?.[runtime.FILES_INDEX_PROJECT_PATH] === "unread"
      ) {
        await new Promise<void>(
          (input) =>
            void setTimeout(input, runtime.STORE_MODE_DECISION_TIMEOUT_MS),
        );
        Object.assign(value, unreadDesignSystemFileHomes());
        value2 = await callback3();
      }
      designSystemFileHomes = applyFileHomeReadAnswers(
        value,
        value2.stateFileAnswers,
      );
      recordDesignSystemFileHomeDecision(
        value2,
        callback2(value2.stateFileAnswers),
      );
      return value2;
    } catch (value: unknown) {
      designSystemFileHomes = {
        project: "unread",
        root: "unread",
      };
      return failedLegacyStateOutcome(value);
    }
  }
  async function bootLegacyDesignSystemMode(
    readOnlyReason?: string,
    storeHandle: Boot.NativeLegacyDatabase | null = null,
    initialStatePromise?: Promise<Boot.LegacyInitialState>,
    renderReport?: Boot.HealthReport,
    storeFault?: string,
  ): Promise<void> {
    let recentMigration = (0, runtime.isRecentMigrationAttempt)({
        runningAt: (0, runtime.consumeMigrationRunningNote)(),
        now: Date.now(),
      }),
      carriedNotice = (0, runtime.consumeMigrationNotice)(),
      outcome = await (initialStatePromise ?? readDesignSystemInitialState()),
      report: Boot.HealthReport = (0, runtime.bootHealthOutcome)(
        outcome,
        isDesignSystemTypeHost,
      );
    runtime.artifactHealth.report(
      ...(renderReport !== undefined && report[1] === "success"
        ? renderReport
        : report),
    );
    let mode = await (0, runtime.chooseDesignSystemBootMode)({
      storeAbsent: storeHandle !== null && storeFault === undefined,
      forcedReadOnly: readOnlyReason !== undefined,
      typePage: isDesignSystemTypeHost,
      emulator: (0, runtime.isEmulatorPage)(),
      origin: outcome.origin,
      stateFileFound: outcome.stateFileFound,
      mayStartOnFiles: runtime.mayStartEmptyFilesSystem,
      ownLayout: designSystemStateLayout(outcome.state),
    });
    if (mode === "tree") {
      return (0, runtime.bootPerFileDesignSystem)(
        outcome,
        readOnlyReason ??
          ((0, runtime.isMigrationExemptHost)(location.hostname)
            ? runtime.PIPELINE_READONLY_MESSAGE
            : designSystemFileHomeDecision.twoIndexes
              ? runtime.DUPLICATE_FILE_INDEX_MESSAGE
              : undefined),
        storeHandle,
      );
    }
    if (mode === "start-tree") {
      let callback = (input: string): void => {
        configureLegacyDesignSystemBoot(outcome, null, input);
        if (runtime.BOOT_LIVE_NOTICE_MESSAGES.has(input)) {
          (0, runtime.waitForBootLiveAnnouncer)(input);
        }
        (0, runtime.prepareDesignSystemThumbnailCapture)();
      };
      if (
        (0, runtime.mountInitializedFilesOutcome)({
          started: await (0, runtime.startEmptyFilesDesignSystem)(storeHandle!),
          mount: callback,
          reopen: () =>
            (0, runtime.restartDesignSystemWithFallback)(
              runtime.REOPEN_FAILED_MESSAGE,
            ),
          reload: () => location.reload(),
        })
      ) {
        return;
      }
    }
    if (mode === "readonly-store") {
      configureLegacyDesignSystemBoot(
        outcome,
        null,
        readOnlyReason ?? runtime.CONTENT_SIGN_IN_REQUIRED_MESSAGE,
      );
      (0, runtime.prepareDesignSystemThumbnailCapture)();
      return;
    }
    let singleFileInstance =
        !isDesignSystemTypeHost &&
        outcome.origin === "instance" &&
        readOnlyReason === undefined &&
        storeHandle !== null &&
        storeFault === undefined &&
        designSystemStateLayout(outcome.state) === "envelope",
      moveInterrupted = singleFileInstance && recentMigration;
    if (moveInterrupted) {
      (0, runtime.skipMigrationForTab)();
    }
    let notice = singleFileInstance
      ? (carriedNotice ??
        (moveInterrupted ? runtime.MIGRATION_INTERRUPTED_MESSAGE : null))
      : null;
    if (notice !== null) {
      (0, runtime.afterTwoAnimationFrames)(() =>
        (0, runtime.showEditorPromiseNotification)(notice, null),
      );
    }
    let holdSingleFile = (runtime.singleFileMigrationBootHeld = (0,
    runtime.isRecentSingleFileMoveNote)({
      noteAt: singleFileInstance
        ? (0, runtime.consumeSingleFileMoveNote)()
        : null,
      now: Date.now(),
      canReopen: (0, runtime.canRestartArtifact)(),
      singleFileHere: singleFileInstance,
    }));
    configureLegacyDesignSystemBoot(
      outcome,
      !isDesignSystemTypeHost &&
        outcome.origin === "demo" &&
        outcome.stateFileFound === false
        ? await probeLegacyDesignSystemWriteAccess()
        : null,
      holdSingleFile ? runtime.MIGRATION_RUNNING_MESSAGE : readOnlyReason,
    );
    let liveMessage = holdSingleFile
      ? runtime.MIGRATION_RUNNING_MESSAGE
      : readOnlyReason;
    if (
      liveMessage !== undefined &&
      runtime.BOOT_LIVE_NOTICE_MESSAGES.has(liveMessage)
    ) {
      (0, runtime.installDesignSystemTypingListener)();
      (0, runtime.waitForBootLiveAnnouncer)(liveMessage);
    }
    if (outcome.origin === "instance") {
      (0, runtime.waitForThumbnailResources)();
    } else {
      (0, runtime.prepareDesignSystemThumbnailCapture)();
    }
    if (holdSingleFile) {
      (0, runtime.afterTwoAnimationFrames)(
        () =>
          void (0, runtime.runSingleFileMigrationBoot)(
            storeHandle!,
            outcome.state,
          ).catch((): void => {
            return;
          }),
      );
    } else if (singleFileInstance) {
      (0, runtime.afterTwoAnimationFrames)(() =>
        setTimeout(
          () =>
            void (0, runtime.prepareSingleFileMigrationReopen)(
              outcome.state,
            ).catch((): void => {
              return;
            }),
          1000,
        ),
      );
    }
  }
  bindRuntimeValue(
    runtime,
    "jsxDesignSystemBootstrap",
    () => jsxDesignSystemBootstrap,
    (value) => {
      jsxDesignSystemBootstrap = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isDesignSystemTypeHost",
    () => isDesignSystemTypeHost,
    (value) => {
      isDesignSystemTypeHost = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "configureLegacyDesignSystemBoot",
    () => configureLegacyDesignSystemBoot,
  );
  bindRuntimeValue(
    runtime,
    "probeLegacyDesignSystemWriteAccess",
    () => probeLegacyDesignSystemWriteAccess,
  );
  bindRuntimeValue(
    runtime,
    "failedLegacyStateOutcome",
    () => failedLegacyStateOutcome,
  );
  bindRuntimeValue(
    runtime,
    "designSystemBootStartedAt",
    () => designSystemBootStartedAt,
    (value) => {
      designSystemBootStartedAt = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "designSystemFilesDebugger",
    () => designSystemFilesDebugger,
    (value) => {
      designSystemFilesDebugger = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "perFileDesignSystemBooted",
    () => perFileDesignSystemBooted,
    (value) => {
      perFileDesignSystemBooted = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "resolveDesignSystemFirstPaint",
    () => resolveDesignSystemFirstPaint,
    (value) => {
      resolveDesignSystemFirstPaint = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "designSystemFirstPaint",
    () => designSystemFirstPaint,
    (value) => {
      designSystemFirstPaint = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeDesignSystemFilesDebugger",
    () => initializeDesignSystemFilesDebugger,
  );
  bindRuntimeValue(
    runtime,
    "hasIgnoredLegacyRootFile",
    () => hasIgnoredLegacyRootFile,
    (value) => {
      hasIgnoredLegacyRootFile = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "IGNORED_LEGACY_ROOT_FILE_MESSAGE",
    () => IGNORED_LEGACY_ROOT_FILE_MESSAGE,
    (value) => {
      IGNORED_LEGACY_ROOT_FILE_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "UNREAD_LEGACY_STORE_CHANGES_MESSAGE",
    () => UNREAD_LEGACY_STORE_CHANGES_MESSAGE,
    (value) => {
      UNREAD_LEGACY_STORE_CHANGES_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "unreadDesignSystemFileHomes",
    () => unreadDesignSystemFileHomes,
    (value) => {
      unreadDesignSystemFileHomes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "readDesignSystemBootStateFile",
    () => readDesignSystemBootStateFile,
  );
  bindRuntimeValue(
    runtime,
    "designSystemFileHomeDecision",
    () => designSystemFileHomeDecision,
    (value) => {
      designSystemFileHomeDecision = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "designSystemFileHomes",
    () => designSystemFileHomes,
    (value) => {
      designSystemFileHomes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "recordDesignSystemFileHomeDecision",
    () => recordDesignSystemFileHomeDecision,
  );
  bindRuntimeValue(
    runtime,
    "designSystemStateLayout",
    () => designSystemStateLayout,
    (value) => {
      designSystemStateLayout = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "applyFileHomeReadAnswers",
    () => applyFileHomeReadAnswers,
  );
  bindRuntimeValue(
    runtime,
    "readDesignSystemInitialState",
    () => readDesignSystemInitialState,
  );
  bindRuntimeValue(
    runtime,
    "bootLegacyDesignSystemMode",
    () => bootLegacyDesignSystemMode,
  );
  return () => {
    jsxDesignSystemBootstrap = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    (0, runtime.initializeDocumentColorMode)(document);
    isDesignSystemTypeHost = (0, runtime.isDesignSystemTypeHostModelBoot)(
      location.hostname,
    );
    designSystemBootStartedAt =
      typeof performance !== "undefined" ? performance.now() : 0;
    perFileDesignSystemBooted = false;
    resolveDesignSystemFirstPaint = (): void => {
      return;
    };
    designSystemFirstPaint = new Promise<void>((input): void => {
      resolveDesignSystemFirstPaint = input;
    });
    hasIgnoredLegacyRootFile = false;
    IGNORED_LEGACY_ROOT_FILE_MESSAGE =
      "This design system has an extra file named design-system.json that the page does not use. Nothing is wrong with what you see here; you can leave the file alone.";
    UNREAD_LEGACY_STORE_CHANGES_MESSAGE =
      // CucCut: user-facing copy calls the agent "the agent", not Claude.
      "Something was saved for this design system in a place this page no longer reads, after it was set up, so it is not shown here. If a change the agent made seems to be missing, ask the agent to make it again in this design system’s files.";
    unreadDesignSystemFileHomes = () => ({
      project: "unread",
      root: "unread",
    });
    designSystemFileHomeDecision = (0, runtime.chooseDesignSystemFileHome)({
      project: "absent",
      root: "absent",
    });
    designSystemFileHomes = {
      project: "unread",
      root: "unread",
    };
    designSystemStateLayout = (input: Boot.RawEnvelope): "tree" | "envelope" =>
      (0, runtime.readTreeIndex)(input) !== undefined ? "tree" : "envelope";
  };
}
