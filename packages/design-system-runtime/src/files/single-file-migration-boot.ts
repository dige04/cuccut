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
export function installFilesSingleFileMigrationBoot(
  runtime: RuntimeBindings,
): () => void {
  var SINGLE_FILE_MOVE_NOTE_PREFIX: string;
  var singleFileMigrationBootHeld: boolean;
  var mayMigrateLegacyDesignSystem: (
    state: Boot.RawEnvelope,
    proceeding?: boolean,
  ) => Promise<boolean>;
  var MIGRATION_REOPEN_UNAVAILABLE_MESSAGE: string;
  var MIGRATION_STOPPED_RELOAD_MESSAGE: string;
  var MIGRATION_STOPPED_REOPEN_MESSAGE: string;
  var MIGRATION_UNCHANGED_MESSAGE: string;
  var MIGRATION_OTHER_TAB_TIMEOUT_MESSAGE: string;
  var SINGLE_FILE_REOPEN_WATCHDOG_MS: number;
  var MIGRATION_NOTICE_STORAGE_PREFIX: string;
  var migrationEditingHold: Boot.EditingHold | undefined;
  var holdEditingForMigration: (input: string) => void;
  var releaseMigrationEditingHold: () => void;
  var MIGRATION_SIZE_NOTICE_STORAGE_PREFIX: string;
  var MIGRATION_RUNNING_STORAGE_PREFIX: string;
  var MIGRATION_INTERRUPTED_MESSAGE: string;
  var singleFileMigrationBootExit: Boot.MigrationBootExit;
  var browserIsAutomated: () => boolean;
  var mayStartEmptyFilesSystem: () => Promise<boolean>;
  var designSystemMigrationTimers: Model.FilesTimers;
  var FILES_DOCUMENT_FETCH_TIMEOUT_MS: number;
  var readMigrationArtifactBlob: (
    input: string,
  ) => Promise<FilesCore.FileData | null>;
  var MIGRATION_SKIP_STORAGE_PREFIX: string;
  var migrationSkippedInMemory: boolean;
  var MIGRATION_STOPPED_STORAGE_PREFIX: string;
  var MIGRATION_STOPPED_TTL_MS: number;
  var TERMINAL_MIGRATION_ERROR_CODES: Set<string>;
  var MIGRATION_UNREADABLE_FILE_MESSAGE: string;
  function consumeSingleFileMoveNote(): null | number | undefined {
    try {
      let value = sessionStorage.getItem(
        SINGLE_FILE_MOVE_NOTE_PREFIX + location.host,
      );
      sessionStorage.removeItem(SINGLE_FILE_MOVE_NOTE_PREFIX + location.host);
      if (value === null) {
        return null;
      } else {
        return Number(value);
      }
    } catch {
      return null;
    }
  }
  function consumeMigrationNotice(): string | null {
    try {
      let value = sessionStorage.getItem(
        MIGRATION_NOTICE_STORAGE_PREFIX + location.host,
      );
      sessionStorage.removeItem(
        MIGRATION_NOTICE_STORAGE_PREFIX + location.host,
      );
      return (0, runtime.readRecentMigrationNotice)(value, Date.now());
    } catch {
      return null;
    }
  }
  function shouldAnnounceMigrationTooLarge(): boolean {
    try {
      let value: number = Number(
        localStorage.getItem(
          MIGRATION_SIZE_NOTICE_STORAGE_PREFIX + location.host,
        ),
      );
      if (
        Number.isFinite(value) &&
        Date.now() - value < MIGRATION_STOPPED_TTL_MS
      ) {
        return false;
      }
      localStorage.setItem(
        MIGRATION_SIZE_NOTICE_STORAGE_PREFIX + location.host,
        String(Date.now()),
      );
    } catch {}
    return true;
  }
  async function prepareSingleFileMigrationReopen(
    state: Boot.RawEnvelope,
  ): Promise<void> {
    if (
      !(await mayMigrateLegacyDesignSystem(state)) ||
      migrationStoppedForChange("file:any")
    ) {
      return;
    }
    let files = (0, runtime.createBrowserFilesPort)({
        canWrite: true,
      }),
      singleFile: Model.FileTextRead;
    try {
      singleFile = await files.readText(runtime.DESIGN_SYSTEM_ENVELOPE_PATH);
    } catch {
      return;
    }
    if (migrationStoppedForChange("file:" + singleFile.sha256)) {
      return;
    }
    let preflight = await (0, runtime.preflightSingleFileMigration)({
      files: files,
      text: singleFile.text,
    });
    if (preflight !== null) {
      if (preflight === "not_single_file" || preflight === "not_now") {
        return;
      }
      skipMigrationForTab();
      recordMigrationStoppedForChange("file:" + singleFile.sha256);
      if (preflight !== "too_large" || shouldAnnounceMigrationTooLarge()) {
        (0, runtime.showEditorPromiseNotification)(
          preflight === "too_large"
            ? runtime.MIGRATION_TOO_LARGE_MESSAGE
            : preflight === "moved_before"
              ? runtime.OLDER_SINGLE_FILE_COPY_MESSAGE
              : unpublishableMigrationFilesMessage(
                  preflight.unpublishable.map(
                    (input: { path: string }) => input.path,
                  ),
                ),
          null,
        );
      }
      return;
    }
    let document2 = runtime.legacyDesignSystemDocument;
    if (document2 === undefined) {
      return;
    }
    (0, runtime.installDesignSystemTypingListener)();
    let clean = () =>
        !(0, runtime.legacyDesignSystemIsBusy)() &&
        !document2.dirty() &&
        document2.saveState().status !== "error" &&
        document2.saveState().status !== "saving" &&
        document2.commentSync().status === "idle",
      leaveMoveNote = (): boolean | undefined => {
        try {
          let value: string = String(Date.now());
          sessionStorage.setItem(
            SINGLE_FILE_MOVE_NOTE_PREFIX + location.host,
            value,
          );
          return (
            sessionStorage.getItem(
              SINGLE_FILE_MOVE_NOTE_PREFIX + location.host,
            ) === value
          );
        } catch {
          return false;
        }
      };
    for (let index: number = 0; index < 10; index++) {
      (0, runtime.flushMarkdownCommitQueues)();
      if (document2.dirty() && !(0, runtime.legacyDesignSystemIsBusy)()) {
        await document2.save().catch((): void => {
          return;
        });
      }
      if (
        Date.now() - runtime.lastDesignSystemTypingAt >= 2000 &&
        (0, runtime.holdCleanSingleFileForMigration)({
          clean: clean,
          leaveNote: leaveMoveNote,
          hold: () =>
            holdEditingForMigration(runtime.MIGRATION_STARTING_REOPEN_MESSAGE),
        })
      ) {
        try {
          sessionStorage.setItem(
            runtime.ARTIFACT_REOPENED_STORAGE_KEY,
            JSON.stringify({
              why: "about_to_move",
              at: Date.now(),
              focus: location.hash.replace(/^#/, ""),
            }),
          );
        } catch {}
        await new Promise<void>((input) => setTimeout(input, 2500));
        if (!clean()) {
          await document2.save().catch((): void => {
            return;
          });
          if (!clean()) {
            releaseMigrationEditingHold();
            try {
              sessionStorage.removeItem(
                SINGLE_FILE_MOVE_NOTE_PREFIX + location.host,
              );
              sessionStorage.removeItem(runtime.ARTIFACT_REOPENED_STORAGE_KEY);
            } catch {}
            return;
          }
        }
        (0, runtime.restartWithReloadFallback)({
          restart: (0, runtime.designSystemRestartFunction)(),
          note: "design system: a single-file system is about to be moved",
          watchdogMs: SINGLE_FILE_REOPEN_WATCHDOG_MS,
          setTimeout: (input: () => void, options: number) =>
            setTimeout(input, options),
          ask: (): void => {
            releaseMigrationEditingHold();
            skipMigrationForTab();
            try {
              sessionStorage.removeItem(
                SINGLE_FILE_MOVE_NOTE_PREFIX + location.host,
              );
              sessionStorage.removeItem(runtime.ARTIFACT_REOPENED_STORAGE_KEY);
            } catch {}
            (0, runtime.showEditorPromiseNotification)(
              MIGRATION_REOPEN_UNAVAILABLE_MESSAGE,
              null,
            );
            (0, runtime.announceLiveMessage)(MIGRATION_UNCHANGED_MESSAGE);
          },
        });
        return;
      }
      await new Promise<void>((input) => setTimeout(input, 3000));
    }
  }
  function consumeMigrationRunningNote(): null | number | undefined {
    try {
      let value = sessionStorage.getItem(
        MIGRATION_RUNNING_STORAGE_PREFIX + location.host,
      );
      sessionStorage.removeItem(
        MIGRATION_RUNNING_STORAGE_PREFIX + location.host,
      );
      if (value === null) {
        return null;
      } else {
        return Number(value);
      }
    } catch {
      return null;
    }
  }
  function singleFileMigrationHolder(): string {
    try {
      let value = sessionStorage.getItem("ds-move-holder/" + location.host);
      if (value !== null && value !== "") {
        return value;
      }
      let value2 = (0, runtime.migrationTabHolder)();
      sessionStorage.setItem("ds-move-holder/" + location.host, value2);
      return value2;
    } catch {
      return (0, runtime.migrationTabHolder)();
    }
  }
  async function runSingleFileMigrationBoot(
    storeHandle: Boot.NativeLegacyDatabase,
    state: Boot.RawEnvelope,
  ): Promise<void> {
    runtime.singleFileMigrationRunning = true;
    try {
      sessionStorage.setItem(
        MIGRATION_RUNNING_STORAGE_PREFIX + location.host,
        String(Date.now()),
      );
    } catch {}
    try {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        await new Promise<void>((input) =>
          document.addEventListener("visibilitychange", function value(): void {
            if (document.visibilityState !== "hidden") {
              document.removeEventListener("visibilitychange", value);
              input();
            }
          }),
        );
      }
      if (await mayMigrateLegacyDesignSystem(state, true)) {
        await (0, runtime.runDesignSystemFilesMigration)(
          storeHandle,
          "",
          "file",
        );
      }
    } finally {
      runtime.singleFileMigrationRunning = false;
      try {
        sessionStorage.removeItem(
          MIGRATION_RUNNING_STORAGE_PREFIX + location.host,
        );
      } catch {}
      (0, runtime.completeSingleFileMigrationBoot)({
        end: runtime.designSystemReopenPending
          ? "landed"
          : singleFileMigrationBootExit.end,
        ...(singleFileMigrationBootExit.notice !== undefined
          ? {
              notice: singleFileMigrationBootExit.notice,
            }
          : {}),
        carryNotice: (input: string): void => {
          try {
            sessionStorage.setItem(
              MIGRATION_NOTICE_STORAGE_PREFIX + location.host,
              JSON.stringify({
                at: Date.now(),
                words: input,
              }),
            );
          } catch {
            (0, runtime.showEditorPromiseNotification)(input, null);
          }
        },
        skip: skipMigrationForTab,
        waitForTheirs: (): void => {
          let value: number = Date.now(),
            value2 = setInterval(
              () =>
                void (0, runtime.readAuthoritativeStoreMeta)({
                  port: (0, runtime.createDatabaseAdapter)(storeHandle),
                  handle: storeHandle,
                }).then((input: Boot.MetaOutcome) => {
                  let value3 = (0, runtime.migrationOtherTabWaitOutcome)({
                    movedTo:
                      (0, runtime.readMovedToMarker)(input.meta) !== null,
                    waitedMs: Date.now() - value,
                  });
                  if (value3 === "wait") {
                    return;
                  }
                  clearInterval(value2);
                  if (value3 === "landed") {
                    return (0, runtime.reopenAfterFilesMigration)(
                      "moved_by_someone",
                    );
                  }
                  skipMigrationForTab();
                  (0, runtime.reopenAfterFilesMigration)(
                    "move_stopped",
                    true,
                    MIGRATION_OTHER_TAB_TIMEOUT_MESSAGE,
                    MIGRATION_STOPPED_RELOAD_MESSAGE,
                  );
                }),
              5000,
            );
        },
        restart: () =>
          (0, runtime.reopenAfterFilesMigration)(
            "move_stopped",
            true,
            MIGRATION_STOPPED_REOPEN_MESSAGE,
            MIGRATION_STOPPED_RELOAD_MESSAGE,
          ),
        reload: () =>
          (0, runtime.reopenAfterFilesMigration)(
            "move_stopped",
            false,
            MIGRATION_STOPPED_REOPEN_MESSAGE,
          ),
      });
    }
  }
  async function startEmptyFilesDesignSystem(
    storeHandle: Boot.NativeLegacyDatabase,
  ): Promise<"created" | "unsure" | "exists" | "store" | "no"> {
    let files = (0, runtime.createBrowserFilesPort)({
        canWrite: true,
      }),
      storeUntouched = async (): Promise<boolean> =>
        (
          await (0, runtime.readAuthoritativeStoreMeta)({
            port: (0, runtime.createDatabaseAdapter)(storeHandle),
            handle: storeHandle,
          })
        ).state === "absent",
      mark = {
        type: "design_system",
        store: (0, runtime.createLegacyDatabasePort)(storeHandle),
        metaPath: runtime.SYSTEM_META_DOCUMENT_PATH,
        artifactId: location.host,
      },
      rootHoldsContent = (input: unknown) =>
        typeof input === "object" &&
        input !== null &&
        typeof (input as { content?: unknown }).content === "object" &&
        (input as { content?: unknown }).content !== null,
      otherHome = async (): Promise<"absent" | "unreadable" | "content"> => {
        let value = await (0, runtime.readJsonFileState)(
          files,
          runtime.DESIGN_SYSTEM_ENVELOPE_PATH,
        );
        if (value.state === "absent") {
          return "absent";
        } else {
          if (value.state === "unreadable") {
            return "unreadable";
          } else {
            return "content";
          }
        }
      },
      outcome = await (0, runtime.initializeEmptyFilesStore)({
        files: files,
        indexPath: runtime.FILES_INDEX_PATH,
        emptyIndex: runtime.createEmptyFilesIndex,
        serializeIndex: (input: Model.FilesIndex) =>
          (0, runtime.serializeIndexDocument)(input),
        at: new Date().toISOString(),
        storeUntouched: storeUntouched,
        mark: mark,
        rootHoldsContent: rootHoldsContent,
        otherHome: otherHome,
      });
    if (outcome.result === "created") {
      return "created";
    }
    console.info(
      "[design-system] not started on files: " +
        (outcome.result === "skipped" ? outcome.reason : outcome.code),
    );
    if (outcome.result === "failed") {
      return "unsure";
    }
    if (outcome.reason === "already_files") {
      return "exists";
    } else {
      if (outcome.reason === "store_has_content") {
        return "store";
      } else {
        if (outcome.reason === "index_unreadable") {
          return "unsure";
        } else {
          return "no";
        }
      }
    }
  }
  function migrationIsSkipped(): boolean {
    try {
      return (
        migrationSkippedInMemory ||
        sessionStorage.getItem(
          MIGRATION_SKIP_STORAGE_PREFIX + location.host,
        ) !== null
      );
    } catch {
      return migrationSkippedInMemory;
    }
  }
  function skipMigrationForTab(): void {
    migrationSkippedInMemory = true;
    try {
      sessionStorage.setItem(
        MIGRATION_SKIP_STORAGE_PREFIX + location.host,
        "1",
      );
    } catch {}
  }
  function migrationStoppedForChange(changeKey: string): boolean {
    try {
      let value = JSON.parse(
        localStorage.getItem(
          MIGRATION_STOPPED_STORAGE_PREFIX + location.host,
        ) ?? "null",
      ) as { at?: unknown; changedAt?: unknown } | null;
      return (
        typeof value?.at === "number" &&
        Date.now() - value.at < MIGRATION_STOPPED_TTL_MS &&
        value.changedAt === changeKey
      );
    } catch {
      return false;
    }
  }
  function recordMigrationStoppedForChange(changeKey: string): void {
    try {
      localStorage.setItem(
        MIGRATION_STOPPED_STORAGE_PREFIX + location.host,
        JSON.stringify({
          at: Date.now(),
          changedAt: changeKey,
        }),
      );
    } catch {}
  }
  function unpublishableMigrationFilesMessage(
    paths: readonly string[],
  ): string {
    return (
      "This design system was going to be moved to a newer way of saving, but " +
      (paths.length === 0
        ? "one of its files"
        : paths
            .slice(0, 3)
            .map((input): string => '"' + input + '"')
            .join(", ") +
          (paths.length > 3
            ? " and " + String(paths.length - 3) + " more"
            : "")) +
      " cannot be saved that way: a file name may not hold % ; : ? # or a backslash, and a few kinds of file (such as .mov or .heic) are not kept; a Word, PowerPoint, Excel, zip or .fig file is kept only if it opens as one. Nothing was changed. Rename or remove " +
      (paths.length === 1 ? "it" : "them") +
      " and the design system moves the next time it is opened."
    );
  }
  function temporarilyUnsavableMigrationFilesMessage(
    paths: readonly string[],
  ): string {
    return (
      "This design system was going to be moved to a newer way of saving, but " +
      (paths
        .slice(0, 3)
        .map((input): string => '"' + input + '"')
        .join(", ") +
        (paths.length > 3
          ? " and " + String(paths.length - 3) + " more"
          : "")) +
      " cannot be saved that way just now. Nothing was changed and nothing is needed from you; the move is tried again the next time the design system is opened in a new tab."
    );
  }
  bindRuntimeValue(
    runtime,
    "SINGLE_FILE_MOVE_NOTE_PREFIX",
    () => SINGLE_FILE_MOVE_NOTE_PREFIX,
    (value) => {
      SINGLE_FILE_MOVE_NOTE_PREFIX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "singleFileMigrationBootHeld",
    () => singleFileMigrationBootHeld,
    (value) => {
      singleFileMigrationBootHeld = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "consumeSingleFileMoveNote",
    () => consumeSingleFileMoveNote,
  );
  bindRuntimeValue(
    runtime,
    "mayMigrateLegacyDesignSystem",
    () => mayMigrateLegacyDesignSystem,
    (value) => {
      mayMigrateLegacyDesignSystem = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_REOPEN_UNAVAILABLE_MESSAGE",
    () => MIGRATION_REOPEN_UNAVAILABLE_MESSAGE,
    (value) => {
      MIGRATION_REOPEN_UNAVAILABLE_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_STOPPED_RELOAD_MESSAGE",
    () => MIGRATION_STOPPED_RELOAD_MESSAGE,
    (value) => {
      MIGRATION_STOPPED_RELOAD_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_STOPPED_REOPEN_MESSAGE",
    () => MIGRATION_STOPPED_REOPEN_MESSAGE,
    (value) => {
      MIGRATION_STOPPED_REOPEN_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_UNCHANGED_MESSAGE",
    () => MIGRATION_UNCHANGED_MESSAGE,
    (value) => {
      MIGRATION_UNCHANGED_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_OTHER_TAB_TIMEOUT_MESSAGE",
    () => MIGRATION_OTHER_TAB_TIMEOUT_MESSAGE,
    (value) => {
      MIGRATION_OTHER_TAB_TIMEOUT_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SINGLE_FILE_REOPEN_WATCHDOG_MS",
    () => SINGLE_FILE_REOPEN_WATCHDOG_MS,
    (value) => {
      SINGLE_FILE_REOPEN_WATCHDOG_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_NOTICE_STORAGE_PREFIX",
    () => MIGRATION_NOTICE_STORAGE_PREFIX,
    (value) => {
      MIGRATION_NOTICE_STORAGE_PREFIX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "consumeMigrationNotice",
    () => consumeMigrationNotice,
  );
  bindRuntimeValue(
    runtime,
    "migrationEditingHold",
    () => migrationEditingHold,
    (value) => {
      migrationEditingHold = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "holdEditingForMigration",
    () => holdEditingForMigration,
    (value) => {
      holdEditingForMigration = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "releaseMigrationEditingHold",
    () => releaseMigrationEditingHold,
    (value) => {
      releaseMigrationEditingHold = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_SIZE_NOTICE_STORAGE_PREFIX",
    () => MIGRATION_SIZE_NOTICE_STORAGE_PREFIX,
    (value) => {
      MIGRATION_SIZE_NOTICE_STORAGE_PREFIX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shouldAnnounceMigrationTooLarge",
    () => shouldAnnounceMigrationTooLarge,
  );
  bindRuntimeValue(
    runtime,
    "prepareSingleFileMigrationReopen",
    () => prepareSingleFileMigrationReopen,
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_RUNNING_STORAGE_PREFIX",
    () => MIGRATION_RUNNING_STORAGE_PREFIX,
    (value) => {
      MIGRATION_RUNNING_STORAGE_PREFIX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_INTERRUPTED_MESSAGE",
    () => MIGRATION_INTERRUPTED_MESSAGE,
    (value) => {
      MIGRATION_INTERRUPTED_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "consumeMigrationRunningNote",
    () => consumeMigrationRunningNote,
  );
  bindRuntimeValue(
    runtime,
    "singleFileMigrationHolder",
    () => singleFileMigrationHolder,
  );
  bindRuntimeValue(
    runtime,
    "singleFileMigrationBootExit",
    () => singleFileMigrationBootExit,
    (value) => {
      singleFileMigrationBootExit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "runSingleFileMigrationBoot",
    () => runSingleFileMigrationBoot,
  );
  bindRuntimeValue(
    runtime,
    "browserIsAutomated",
    () => browserIsAutomated,
    (value) => {
      browserIsAutomated = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "mayStartEmptyFilesSystem",
    () => mayStartEmptyFilesSystem,
    (value) => {
      mayStartEmptyFilesSystem = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "designSystemMigrationTimers",
    () => designSystemMigrationTimers,
    (value) => {
      designSystemMigrationTimers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILES_DOCUMENT_FETCH_TIMEOUT_MS",
    () => FILES_DOCUMENT_FETCH_TIMEOUT_MS,
    (value) => {
      FILES_DOCUMENT_FETCH_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "readMigrationArtifactBlob",
    () => readMigrationArtifactBlob,
    (value) => {
      readMigrationArtifactBlob = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "startEmptyFilesDesignSystem",
    () => startEmptyFilesDesignSystem,
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_SKIP_STORAGE_PREFIX",
    () => MIGRATION_SKIP_STORAGE_PREFIX,
    (value) => {
      MIGRATION_SKIP_STORAGE_PREFIX = value;
    },
  );
  bindRuntimeValue(runtime, "migrationIsSkipped", () => migrationIsSkipped);
  bindRuntimeValue(runtime, "skipMigrationForTab", () => skipMigrationForTab);
  bindRuntimeValue(
    runtime,
    "migrationSkippedInMemory",
    () => migrationSkippedInMemory,
    (value) => {
      migrationSkippedInMemory = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_STOPPED_STORAGE_PREFIX",
    () => MIGRATION_STOPPED_STORAGE_PREFIX,
    (value) => {
      MIGRATION_STOPPED_STORAGE_PREFIX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_STOPPED_TTL_MS",
    () => MIGRATION_STOPPED_TTL_MS,
    (value) => {
      MIGRATION_STOPPED_TTL_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "migrationStoppedForChange",
    () => migrationStoppedForChange,
  );
  bindRuntimeValue(
    runtime,
    "recordMigrationStoppedForChange",
    () => recordMigrationStoppedForChange,
  );
  bindRuntimeValue(
    runtime,
    "TERMINAL_MIGRATION_ERROR_CODES",
    () => TERMINAL_MIGRATION_ERROR_CODES,
    (value) => {
      TERMINAL_MIGRATION_ERROR_CODES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_UNREADABLE_FILE_MESSAGE",
    () => MIGRATION_UNREADABLE_FILE_MESSAGE,
    (value) => {
      MIGRATION_UNREADABLE_FILE_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "unpublishableMigrationFilesMessage",
    () => unpublishableMigrationFilesMessage,
  );
  bindRuntimeValue(
    runtime,
    "temporarilyUnsavableMigrationFilesMessage",
    () => temporarilyUnsavableMigrationFilesMessage,
  );
  return () => {
    SINGLE_FILE_MOVE_NOTE_PREFIX = "ds-move-single/";
    singleFileMigrationBootHeld = false;
    mayMigrateLegacyDesignSystem = (input, options = false) => {
      let value = ((input.content as { files?: Model.FileTable } | undefined)
          ?.files ?? {})["manifest.json"],
        value2: unknown;
      try {
        value2 =
          typeof value === "string" ? JSON.parse(value).lastChange : undefined;
      } catch {
        value2 = undefined;
      }
      return (0, runtime.mayMigrateDesignSystem)({
        typeHost: runtime.isDesignSystemTypeHost,
        pipeline: (0, runtime.isMigrationExemptHost)(location.hostname),
        lastChange: value2,
        automation: browserIsAutomated(),
        skipped: migrationIsSkipped(),
        canReopen: (0, runtime.canRestartArtifact)(),
        switchOn: async (): Promise<boolean> => false,
        canWrite: async () => {
          let value3 = await (0, runtime.probeLegacyDesignSystemWriteAccess)();
          return (
            value3 === true ||
            (options &&
              value3 === null &&
              (await (0, runtime.probeLegacyDesignSystemWriteAccess)()) !==
                false)
          );
        },
      });
    };
    MIGRATION_REOPEN_UNAVAILABLE_MESSAGE =
      "This design system was going to be moved to a newer way of saving, but the page could not be reopened for it. Nothing was changed, and you can go on editing.";
    MIGRATION_STOPPED_RELOAD_MESSAGE =
      "This design system was not moved after all. Reload the page to go on editing it.";
    MIGRATION_STOPPED_REOPEN_MESSAGE =
      "This design system was not moved after all. The page reopens in a moment so you can edit again.";
    MIGRATION_UNCHANGED_MESSAGE =
      "This design system was not moved. Nothing was changed, and you can go on editing.";
    MIGRATION_OTHER_TAB_TIMEOUT_MESSAGE =
      "The move of this design system did not finish while this page waited. The page reopens in a moment.";
    SINGLE_FILE_REOPEN_WATCHDOG_MS = 20000;
    MIGRATION_NOTICE_STORAGE_PREFIX = "ds-move-notice/";
    migrationEditingHold =
      typeof window === "undefined"
        ? undefined
        : (0, runtime.createMigrationEditingHold)(window);
    holdEditingForMigration = (input) => migrationEditingHold?.hold(input);
    releaseMigrationEditingHold = () => migrationEditingHold?.release();
    MIGRATION_SIZE_NOTICE_STORAGE_PREFIX = "ds-too-large-said/";
    MIGRATION_RUNNING_STORAGE_PREFIX = "ds-move-running/";
    MIGRATION_INTERRUPTED_MESSAGE =
      "This design system was not moved after all: the page was reopened before the move was done. You can go on editing.";
    singleFileMigrationBootExit = {
      end: "reload",
    };
    browserIsAutomated = () =>
      typeof navigator !== "undefined" && navigator.webdriver === true;
    mayStartEmptyFilesSystem = () =>
      (0, runtime.mayInitializeEmptyFilesStore)({
        canReopen: (0, runtime.canRestartArtifact)(),
        automation: browserIsAutomated(),
        pipeline: (0, runtime.isMigrationExemptHost)(location.hostname),
        switchOn: async (): Promise<boolean> => false,
        canWrite: async () =>
          (await (0, runtime.determineSlidesWriteAccess)()).canWrite,
      });
    designSystemMigrationTimers = {
      setTimeout: (input: () => void, options: number) =>
        setTimeout(input, options),
      clearTimeout: (input: ReturnType<typeof setTimeout> | undefined) =>
        clearTimeout(input),
      now: (): number => Date.now(),
      random: (): number => Math.random(),
    };
    FILES_DOCUMENT_FETCH_TIMEOUT_MS = 300000;
    readMigrationArtifactBlob = async (input) => {
      try {
        let value = await fetch(
          (0, runtime.blobRelativeUrlModelFilePolicy)(input),
          {
            credentials: "same-origin",
            signal: AbortSignal.timeout(60000),
          },
        );
        if (value.ok) {
          return {
            bytes: new Uint8Array(await value.arrayBuffer()),
            type: (value.headers.get("content-type") ?? "")
              .split(";")[0]
              .trim(),
          };
        } else {
          return null;
        }
      } catch {
        return null;
      }
    };
    MIGRATION_SKIP_STORAGE_PREFIX = "ds-move-skip/";
    migrationSkippedInMemory = false;
    MIGRATION_STOPPED_STORAGE_PREFIX = "ds-move-stopped/";
    MIGRATION_STOPPED_TTL_MS = 86400000;
    TERMINAL_MIGRATION_ERROR_CODES = new Set([
      "collection_too_large",
      "blob_unreadable",
      "index_too_large",
      "unpublishable_file",
      "bad_config",
      "invalid_content",
      "bad_namespace",
      "bad_prefix",
      "bad_path",
      "escapes_prefix",
      "duplicate",
      "too_large",
      "files_unavailable",
      "shared_externally",
      "embeds_artifacts",
      "capability_disabled",
      "not_declared",
      "read_only_path",
      "internal",
    ]);
    MIGRATION_UNREADABLE_FILE_MESSAGE =
      "This design system was going to be moved to a newer way of saving, but one of its files could not be read, so it stays as it is. Nothing was changed, and nothing is needed from you.";
  };
}
