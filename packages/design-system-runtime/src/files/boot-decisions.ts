import type * as Boot from "../contracts/boot";
import type * as Model from "../contracts";
import type * as Storage from "../contracts/model-storage";
import type * as Dom from "../contracts/dom";
import type * as Host from "../contracts/platform-host";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installFilesBootDecisions(
  runtime: RuntimeBindings,
): () => void {
  var STORE_META_READ_TIMEOUT_MS: number;
  var STORE_META_LOADING_NOTICE_MS: number;
  var STORE_META_RETRY_MS: number;
  var PIPELINE_READONLY_MESSAGE: string;
  var MIGRATED_READONLY_MESSAGE: string;
  var DESIGN_SYSTEM_CHANGED_MESSAGE: string;
  var DESIGN_SYSTEM_READONLY_MESSAGE: string;
  var storeMetaFaultCode: (input: unknown) => string;
  var presentStoreMeta: (input: unknown) => Boot.MetaOutcome;
  var STORE_MODE_DECISION_TIMEOUT_MS: number;
  var FILES_UNREADABLE_MESSAGE: string;
  var MOVED_RELOAD_MESSAGE: string;
  var PARTIAL_DESIGN_SYSTEM_MESSAGE: string;
  var DUPLICATE_FILE_INDEX_MESSAGE: string;
  var INVALID_PROJECT_INDEX_MESSAGE: string;
  var OLDER_COPY_READONLY_MESSAGE: string;
  var MIGRATION_OTHER_TAB_WAIT_MS: number;
  var MIGRATION_RUNNING_MESSAGE: string;
  var DESIGN_SYSTEM_SETUP_MESSAGE: string;
  var REOPEN_FAILED_MESSAGE: string;
  var BOOT_LIVE_NOTICE_MESSAGES: Set<string>;
  async function readAuthoritativeStoreMeta(
    options: Boot.MetaReadOptions,
    timeoutMs: number = STORE_META_READ_TIMEOUT_MS,
    timers: Boot.TimerPair = globalThis,
  ): Promise<Boot.MetaOutcome> {
    let getMeta = options.handle?.doc(runtime.SYSTEM_META_DOCUMENT_PATH).get;
    if (typeof getMeta !== "function") {
      return readStoreMetaThroughSubscription(options.port, timeoutMs, timers);
    }
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        getMeta
          .call(options.handle?.doc(runtime.SYSTEM_META_DOCUMENT_PATH))
          .then(
            (
              input: Boot.NativeLegacyDocumentSnapshot,
            ): Boot.MetaOutcome | Promise<Boot.MetaOutcome> =>
              input.exists
                ? presentStoreMeta(input.data?.())
                : input.metadata?.fromCache === true
                  ? readStoreMetaThroughSubscription(
                      options.port,
                      timeoutMs,
                      timers,
                    )
                  : {
                      state: "absent",
                    },
            (input: unknown): Boot.MetaOutcome => ({
              state: "unavailable",
              fault: storeMetaFaultCode(input),
            }),
          ),
        new Promise<Boot.MetaOutcome>(
          (input) =>
            (timeout = timers.setTimeout(
              () =>
                input({
                  state: "unavailable",
                  fault: "timeout",
                }),
              timeoutMs,
            )),
        ),
      ]);
    } finally {
      timers.clearTimeout(timeout);
    }
  }
  function readStoreMetaThroughSubscription(
    port: Storage.DatabasePort,
    timeoutMs: number,
    timers: Boot.TimerPair,
  ): Promise<Boot.MetaOutcome> {
    return new Promise<Boot.MetaOutcome>((input): void => {
      let flag: boolean = false,
        value: { data: unknown } | null = null,
        value2: (() => void) | undefined,
        callback = (input2: Boot.MetaOutcome): void => {
          if (flag) {
            return;
          }
          flag = true;
          timers.clearTimeout(value3);
          queueMicrotask(() => value2?.());
          input(input2);
        },
        value3 = timers.setTimeout(
          () =>
            callback({
              state: "unavailable",
              fault: "timeout",
            }),
          timeoutMs,
        );
      value2 = port.subscribe(
        runtime.SYSTEM_COLLECTION,
        (input2, options): void => {
          for (let value4 of input2) {
            if (value4.path === runtime.SYSTEM_META_DOCUMENT_PATH) {
              value =
                value4.type !== "removed"
                  ? {
                      data: value4.data,
                    }
                  : null;
            }
          }
          if (value !== null) {
            callback(presentStoreMeta(value.data));
          } else if (!options.fromCache) {
            callback({
              state: "absent",
            });
          }
        },
        (input2) =>
          callback({
            state: "unavailable",
            fault: input2.code,
          }),
      );
      if (flag) {
        value2!();
      }
    });
  }
  function lastChangeIsImported(lastChange: unknown): boolean {
    return (0, runtime.isCiLastChange)(
      (0, runtime.parseLastChange)(lastChange).value,
    );
  }
  function chooseDesignSystemFileHome(
    homes: Boot.FileHomes,
  ): Boot.FileHomeDecision {
    let defaults = {
      ignoredRoot: false,
      ignoredSingleFile: false,
      strayRoot: false,
      twoIndexes: false,
      unread: false,
      asGoodAsMissing: false,
    };
    if (homes.project === "unread" || homes.root === "unread") {
      return {
        at: "none",
        ...defaults,
        unread: true,
      };
    }
    let sameMarkedRoot = homes.root === "marked" && homes.sameText === true;
    if (homes.project === "marked") {
      return {
        at: "project",
        ...defaults,
        ignoredRoot: homes.root !== "absent" && !sameMarkedRoot,
        ignoredSingleFile: homes.root === "envelope",
        twoIndexes: homes.root === "marked" && !sameMarkedRoot,
      };
    }
    if (homes.root === "marked" || homes.root === "envelope") {
      return {
        at: "root",
        ...defaults,
      };
    }
    return {
      at: "none",
      ...defaults,
      strayRoot: homes.root === "unmarked",
      asGoodAsMissing: homes.root === "absent" || homes.root === "unmarked",
    };
  }
  async function chooseDesignSystemBootMode(
    options: Boot.BootModeOptions,
  ): Promise<"files" | "tree" | "start-tree" | "readonly-store"> {
    if (options.typePage) {
      return "files";
    }
    if (options.origin === "instance" && options.ownLayout === "tree") {
      return "tree";
    }
    let missingOwnState =
      options.origin === "demo" && options.stateFileFound === false;
    if (
      missingOwnState &&
      options.storeAbsent &&
      !options.forcedReadOnly &&
      (await options.mayStartOnFiles())
    ) {
      return "start-tree";
    }
    if (
      missingOwnState &&
      !options.emulator &&
      (!options.storeAbsent || options.forcedReadOnly)
    ) {
      return "readonly-store";
    }
    return "files";
  }
  function chooseTreeBootOutcome(
    options: Boot.TreeBootOptions,
  ): Boot.TreeBootOutcome {
    if (options.project === "unread") {
      return {
        boot: "readonly",
        reason: FILES_UNREADABLE_MESSAGE,
      };
    }
    if (options.origin === "instance" && options.tree) {
      return {
        boot: "tree",
        ...(options.pipeline
          ? {
              readOnly: PIPELINE_READONLY_MESSAGE,
            }
          : options.editingOff
            ? {
                readOnly: MIGRATED_READONLY_MESSAGE,
              }
            : {}),
      };
    }
    if (options.project === "marked") {
      return {
        boot: "failed",
      };
    }
    if (options.project !== "absent") {
      return {
        boot: "readonly",
        reason: INVALID_PROJECT_INDEX_MESSAGE,
      };
    }
    return {
      boot: "empty",
      ...(options.pipeline
        ? {
            readOnly: PIPELINE_READONLY_MESSAGE,
          }
        : {}),
    };
  }
  async function mayInitializeEmptyFilesStore(
    options: Boot.MayInitializeOptions,
  ): Promise<boolean> {
    if (!options.canReopen || options.automation || options.pipeline) {
      return false;
    }
    if (!(await options.switchOn())) {
      return false;
    }
    return options.canWrite();
  }
  function isRecentSingleFileMoveNote(options: {
    singleFileHere: boolean;
    canReopen: boolean;
    noteAt: number | null | undefined;
    now: number;
  }): boolean {
    return (
      options.singleFileHere &&
      options.canReopen &&
      options.noteAt !== null &&
      Number.isFinite(options.noteAt) &&
      options.now - (options.noteAt as number) >= 0 &&
      options.now - (options.noteAt as number) < 60000
    );
  }
  function holdCleanSingleFileForMigration(options: {
    clean(): boolean;
    leaveNote(): boolean | undefined;
    hold(): void;
  }): boolean {
    if (!options.clean() || !options.leaveNote()) {
      return false;
    }
    options.hold();
    return true;
  }
  function completeSingleFileMigrationBoot(
    options: Boot.CompleteMigrationOptions,
  ): void {
    if (options.end === "landed") {
      return;
    }
    if (options.end === "busy") {
      return options.waitForTheirs();
    }
    options.skip();
    if (options.notice !== undefined) {
      options.carryNotice(options.notice);
    }
    if (options.end === "restart") {
      options.restart();
    } else {
      options.reload();
    }
  }
  function singleFileMigrationExit(
    outcome: Boot.MigrationOutcome,
    indexState: string,
  ): Boot.MigrationExit {
    if (indexState === "marked") {
      return "landed";
    }
    if (outcome.result === "busy") {
      return "busy";
    }
    let publishedBeforeFailure =
        outcome.result === "aborted" &&
        (outcome.stage === "publish" ||
          outcome.stage === "recheck" ||
          outcome.stage === "sentinel" ||
          outcome.stage === "tombstone"),
      alreadyMoved =
        outcome.result === "skipped" &&
        (outcome.reason === "already_moved" ||
          outcome.reason === "already_files");
    if (
      outcome.result === "converted" ||
      indexState === "unreadable" ||
      publishedBeforeFailure ||
      alreadyMoved ||
      outcome.code === "conflict"
    ) {
      return "restart";
    } else {
      return "reload";
    }
  }
  function isRecentMigrationAttempt(options: {
    runningAt: number | null | undefined;
    now: number;
  }): boolean {
    return (
      options.runningAt !== null &&
      Number.isFinite(options.runningAt) &&
      options.now - (options.runningAt as number) >= 0 &&
      options.now - (options.runningAt as number) < 600000
    );
  }
  function migrationOtherTabWaitOutcome(options: {
    movedTo: boolean;
    waitedMs: number;
  }): "landed" | "wait" | "gave-up" {
    if (options.movedTo) {
      return "landed";
    } else {
      if (options.waitedMs < MIGRATION_OTHER_TAB_WAIT_MS) {
        return "wait";
      } else {
        return "gave-up";
      }
    }
  }
  function readRecentMigrationNotice(
    text: string | null,
    now: number,
  ): string | null {
    try {
      let value =
        text === null
          ? null
          : (JSON.parse(text) as { at?: unknown; words?: unknown } | null);
      if (
        typeof value?.at === "number" &&
        typeof value.words === "string" &&
        now - value.at >= 0 &&
        now - value.at < 300000
      ) {
        return value.words;
      } else {
        return null;
      }
    } catch {
      return null;
    }
  }
  async function mayMigrateDesignSystem(
    options: Boot.MayMigrateOptions,
  ): Promise<boolean> {
    if (
      options.typeHost ||
      options.pipeline ||
      lastChangeIsImported(options.lastChange) ||
      options.automation ||
      options.skipped ||
      !options.canReopen
    ) {
      return false;
    }
    if (!(await options.switchOn())) {
      return false;
    }
    return options.canWrite();
  }
  function mountInitializedFilesOutcome(options: {
    started: string;
    mount(message: string): void;
    reopen(): void;
    reload(): void;
  }): boolean {
    if (options.started === "no") {
      return false;
    }
    if (options.started === "exists" || options.started === "unsure") {
      options.mount(FILES_UNREADABLE_MESSAGE);
    } else if (
      (options.mount(DESIGN_SYSTEM_SETUP_MESSAGE),
      options.started === "created")
    ) {
      options.reopen();
    } else {
      options.reload();
    }
    return true;
  }
  function resolveMigratedReadonlyReason(
    reason: string | undefined,
    access: Host.WriteAccess | undefined,
  ): string | undefined {
    if (
      reason !== MIGRATED_READONLY_MESSAGE ||
      access === undefined ||
      access.canWrite
    ) {
      return reason;
    }
    return access.reason ?? DESIGN_SYSTEM_READONLY_MESSAGE;
  }
  function editingOffTransition(options: {
    offAtBoot: boolean;
    offNow: boolean;
    canWrite: boolean;
  }): "on" | "off" | null {
    if (options.offAtBoot) {
      if (options.offNow) {
        return null;
      } else {
        return "on";
      }
    }
    if (options.offNow && options.canWrite) {
      return "off";
    } else {
      return null;
    }
  }
  function restartWithReloadFallback(options: Boot.RestartFallback): void {
    if (options.restart === undefined) {
      return options.ask();
    }
    try {
      options.restart({
        note: options.note,
      });
    } catch {
      return options.ask();
    }
    options.setTimeout(options.ask, options.watchdogMs);
  }
  bindRuntimeValue(
    runtime,
    "STORE_META_READ_TIMEOUT_MS",
    () => STORE_META_READ_TIMEOUT_MS,
    (value) => {
      STORE_META_READ_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "STORE_META_LOADING_NOTICE_MS",
    () => STORE_META_LOADING_NOTICE_MS,
    (value) => {
      STORE_META_LOADING_NOTICE_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "STORE_META_RETRY_MS",
    () => STORE_META_RETRY_MS,
    (value) => {
      STORE_META_RETRY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PIPELINE_READONLY_MESSAGE",
    () => PIPELINE_READONLY_MESSAGE,
    (value) => {
      PIPELINE_READONLY_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIGRATED_READONLY_MESSAGE",
    () => MIGRATED_READONLY_MESSAGE,
    (value) => {
      MIGRATED_READONLY_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_CHANGED_MESSAGE",
    () => DESIGN_SYSTEM_CHANGED_MESSAGE,
    (value) => {
      DESIGN_SYSTEM_CHANGED_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_READONLY_MESSAGE",
    () => DESIGN_SYSTEM_READONLY_MESSAGE,
    (value) => {
      DESIGN_SYSTEM_READONLY_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "readAuthoritativeStoreMeta",
    () => readAuthoritativeStoreMeta,
  );
  bindRuntimeValue(
    runtime,
    "storeMetaFaultCode",
    () => storeMetaFaultCode,
    (value) => {
      storeMetaFaultCode = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "presentStoreMeta",
    () => presentStoreMeta,
    (value) => {
      presentStoreMeta = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "readStoreMetaThroughSubscription",
    () => readStoreMetaThroughSubscription,
  );
  bindRuntimeValue(runtime, "lastChangeIsImported", () => lastChangeIsImported);
  bindRuntimeValue(
    runtime,
    "STORE_MODE_DECISION_TIMEOUT_MS",
    () => STORE_MODE_DECISION_TIMEOUT_MS,
    (value) => {
      STORE_MODE_DECISION_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILES_UNREADABLE_MESSAGE",
    () => FILES_UNREADABLE_MESSAGE,
    (value) => {
      FILES_UNREADABLE_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MOVED_RELOAD_MESSAGE",
    () => MOVED_RELOAD_MESSAGE,
    (value) => {
      MOVED_RELOAD_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PARTIAL_DESIGN_SYSTEM_MESSAGE",
    () => PARTIAL_DESIGN_SYSTEM_MESSAGE,
    (value) => {
      PARTIAL_DESIGN_SYSTEM_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DUPLICATE_FILE_INDEX_MESSAGE",
    () => DUPLICATE_FILE_INDEX_MESSAGE,
    (value) => {
      DUPLICATE_FILE_INDEX_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "chooseDesignSystemFileHome",
    () => chooseDesignSystemFileHome,
  );
  bindRuntimeValue(
    runtime,
    "chooseDesignSystemBootMode",
    () => chooseDesignSystemBootMode,
  );
  bindRuntimeValue(
    runtime,
    "INVALID_PROJECT_INDEX_MESSAGE",
    () => INVALID_PROJECT_INDEX_MESSAGE,
    (value) => {
      INVALID_PROJECT_INDEX_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "chooseTreeBootOutcome",
    () => chooseTreeBootOutcome,
  );
  bindRuntimeValue(
    runtime,
    "mayInitializeEmptyFilesStore",
    () => mayInitializeEmptyFilesStore,
  );
  bindRuntimeValue(
    runtime,
    "isRecentSingleFileMoveNote",
    () => isRecentSingleFileMoveNote,
  );
  bindRuntimeValue(
    runtime,
    "OLDER_COPY_READONLY_MESSAGE",
    () => OLDER_COPY_READONLY_MESSAGE,
    (value) => {
      OLDER_COPY_READONLY_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "holdCleanSingleFileForMigration",
    () => holdCleanSingleFileForMigration,
  );
  bindRuntimeValue(
    runtime,
    "completeSingleFileMigrationBoot",
    () => completeSingleFileMigrationBoot,
  );
  bindRuntimeValue(
    runtime,
    "singleFileMigrationExit",
    () => singleFileMigrationExit,
  );
  bindRuntimeValue(
    runtime,
    "isRecentMigrationAttempt",
    () => isRecentMigrationAttempt,
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_OTHER_TAB_WAIT_MS",
    () => MIGRATION_OTHER_TAB_WAIT_MS,
    (value) => {
      MIGRATION_OTHER_TAB_WAIT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "migrationOtherTabWaitOutcome",
    () => migrationOtherTabWaitOutcome,
  );
  bindRuntimeValue(
    runtime,
    "readRecentMigrationNotice",
    () => readRecentMigrationNotice,
  );
  bindRuntimeValue(
    runtime,
    "mayMigrateDesignSystem",
    () => mayMigrateDesignSystem,
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_RUNNING_MESSAGE",
    () => MIGRATION_RUNNING_MESSAGE,
    (value) => {
      MIGRATION_RUNNING_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_SETUP_MESSAGE",
    () => DESIGN_SYSTEM_SETUP_MESSAGE,
    (value) => {
      DESIGN_SYSTEM_SETUP_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "REOPEN_FAILED_MESSAGE",
    () => REOPEN_FAILED_MESSAGE,
    (value) => {
      REOPEN_FAILED_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BOOT_LIVE_NOTICE_MESSAGES",
    () => BOOT_LIVE_NOTICE_MESSAGES,
    (value) => {
      BOOT_LIVE_NOTICE_MESSAGES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "mountInitializedFilesOutcome",
    () => mountInitializedFilesOutcome,
  );
  bindRuntimeValue(
    runtime,
    "resolveMigratedReadonlyReason",
    () => resolveMigratedReadonlyReason,
  );
  bindRuntimeValue(runtime, "editingOffTransition", () => editingOffTransition);
  bindRuntimeValue(
    runtime,
    "restartWithReloadFallback",
    () => restartWithReloadFallback,
  );
  return () => {
    STORE_META_READ_TIMEOUT_MS = 8000;
    STORE_META_LOADING_NOTICE_MS = 30000;
    STORE_META_RETRY_MS = 1e4;
    PIPELINE_READONLY_MESSAGE =
      "This design system is kept up to date automatically from the codebase, so it can’t be edited here.";
    MIGRATED_READONLY_MESSAGE =
      "Migrated from the standalone version. It can’t be edited here until it is cleaned up.";
    DESIGN_SYSTEM_CHANGED_MESSAGE =
      "This design system has changed. The page reopens in a moment.";
    DESIGN_SYSTEM_READONLY_MESSAGE = "This design system can’t be edited here.";
    storeMetaFaultCode = (input) => {
      let value = (input as { code?: unknown } | null | undefined)?.code;
      if (typeof value === "string") {
        return value;
      } else {
        return "error";
      }
    };
    presentStoreMeta = (input) =>
      typeof input === "object" &&
      input !== null &&
      Object.keys(input).length > 0
        ? {
            state: "present",
            meta: input,
          }
        : {
            state: "present",
          };
    STORE_MODE_DECISION_TIMEOUT_MS = 1500;
    FILES_UNREADABLE_MESSAGE =
      "Couldn’t read this design system’s files. Reload to try again.";
    MOVED_RELOAD_MESSAGE =
      "This design system now saves in a newer way. Reload the page to keep editing it.";
    // CucCut: user-facing copy calls the agent "the agent", not Claude.
    PARTIAL_DESIGN_SYSTEM_MESSAGE =
      "Part of this design system could not be found just now, so editing is off, and what is shown here may be out of date or incomplete. Reload to try again; if it stays like this, ask the agent to restore this design system’s design-system.json from its version history.";
    DUPLICATE_FILE_INDEX_MESSAGE =
      "This design system has two different lists of its files, so editing is off until one of them is removed. Ask the agent to compare project/design-system.json with design-system.json and remove the one that is out of date.";
    INVALID_PROJECT_INDEX_MESSAGE =
      "project/design-system.json isn’t a valid file list. Ask the agent to repair it.";
    OLDER_COPY_READONLY_MESSAGE =
      "An older copy of this design system was saved over the current one, so editing is off here. Ask the agent to compare the two and put back the one you want.";
    MIGRATION_OTHER_TAB_WAIT_MS = 150000;
    MIGRATION_RUNNING_MESSAGE =
      "This design system is being moved to a newer way of saving. The page reopens when that is done.";
    DESIGN_SYSTEM_SETUP_MESSAGE =
      "This design system is being set up. The page reopens in a few seconds; if it does not, reload the page.";
    REOPEN_FAILED_MESSAGE =
      "This design system did not reopen by itself. Reload the page to start editing it.";
    BOOT_LIVE_NOTICE_MESSAGES = new Set([
      MIGRATION_RUNNING_MESSAGE,
      PARTIAL_DESIGN_SYSTEM_MESSAGE,
      MOVED_RELOAD_MESSAGE,
      DESIGN_SYSTEM_SETUP_MESSAGE,
      OLDER_COPY_READONLY_MESSAGE,
    ]);
  };
}
