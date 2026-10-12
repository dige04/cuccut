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
export function installFilesApplicationMigration(
  runtime: RuntimeBindings,
): () => void {
  async function runDesignSystemFilesMigration(
    storeHandle: Boot.NativeLegacyDatabase,
    changeKey: string,
    home: "store" | "file" = "store",
  ): Promise<void> {
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
    let files = (0, runtime.createBrowserFilesPort)({
        canWrite: true,
      }),
      store = (0, runtime.createLegacyDatabasePort)(storeHandle),
      blobReadable: boolean = true,
      stop = (input: string | undefined, options: boolean = true): void => {
        (0, runtime.skipMigrationForTab)();
        if (options) {
          (0, runtime.recordMigrationStoppedForChange)(
            home === "file" &&
              runtime.singleFileMigrationBootHeld &&
              !blobReadable
              ? "file:any"
              : changeKey,
          );
        }
        if (home === "file" && runtime.singleFileMigrationBootHeld) {
          runtime.singleFileMigrationBootExit = {
            end: runtime.singleFileMigrationBootExit.end,
            ...(input !== undefined
              ? {
                  notice: input,
                }
              : {}),
          };
          return;
        }
        if (input !== undefined) {
          (0, runtime.showEditorPromiseNotification)(input, null);
        }
      },
      singleFile: Model.FileTextRead | undefined;
    if (home === "file") {
      try {
        singleFile = await files.readText(runtime.DESIGN_SYSTEM_ENVELOPE_PATH);
      } catch {
        return;
      }
      changeKey = "file:" + singleFile.sha256;
      if ((0, runtime.migrationStoppedForChange)(changeKey)) {
        return;
      }
    }
    let preflight =
      singleFile !== undefined
        ? await (0, runtime.preflightSingleFileMigration)({
            files: files,
            text: singleFile.text,
          })
        : await (0, runtime.preflightLegacyStoreMigration)({
            files: files,
            store: store,
          });
    if (preflight === "not_single_file" || preflight === "not_now") {
      return;
    }
    if (preflight === "moved_before") {
      return stop(runtime.OLDER_SINGLE_FILE_COPY_MESSAGE, true);
    }
    if (preflight !== null) {
      if (preflight !== "too_large") {
        (0, runtime.reportMigrationFailure)({
          result: "aborted",
          stage: "preflight",
          code: "unpublishable_file",
          ms: 0,
        });
      }
      return stop(
        preflight === "too_large"
          ? runtime.MIGRATION_TOO_LARGE_MESSAGE
          : (0, runtime.unpublishableMigrationFilesMessage)(
              preflight.unpublishable.map(
                (input: { path: string }) => input.path,
              ),
            ),
        true,
      );
    }
    (0, runtime.takeUnpublishableMigrationPaths)();
    let trackedFiles = (0, runtime.trackMigrationDownloadFailures)(files),
      outcome = await (
        home === "file"
          ? runtime.migrateSingleFileDesignSystem
          : runtime.migrateDesignSystemStoreToFiles
      )({
        files: trackedFiles.files,
        store: store,
        holder:
          home === "file"
            ? (0, runtime.singleFileMigrationHolder)()
            : (0, runtime.migrationTabHolder)(),
        by: (await (0, runtime.currentUserId)()) ?? "someone",
        timers: runtime.designSystemMigrationTimers,
        fetchBlob: runtime.readMigrationArtifactBlob,
        artifactId: location.host,
        onStage: (input: string) =>
          console.info("[design-system] move to files: " + input),
      });
    (0, runtime.reportMigrationFailure)(outcome);
    let nextAction = (0, runtime.designSystemMigrationNextAction)(outcome);
    console.info("[design-system] move to files ended: " + nextAction.why);
    if (home === "file" && outcome.result === "busy") {
      runtime.singleFileMigrationBootExit = {
        end: "busy",
      };
    }
    if (nextAction.next === "wait") {
      return;
    }
    let indexRead = await (0, runtime.readJsonFileState)(
        files,
        runtime.FILES_INDEX_PROJECT_PATH,
      ),
      marked =
        indexRead.state === "read" &&
        (0, runtime.hasFilesMigrationMarker)(
          (0, runtime.parseFilesIndex)(indexRead.text),
        );
    if (home === "file") {
      runtime.singleFileMigrationBootExit = {
        end: (0, runtime.singleFileMigrationExit)(
          outcome,
          marked
            ? "marked"
            : indexRead.state === "unreadable"
              ? "unreadable"
              : "unmarked",
        ),
      };
      if (marked) {
        (0, runtime.recordMarkedIndexSeen)();
        return (0, runtime.reopenAfterFilesMigration)("moved_to_files");
      }
    }
    if (marked) {
      if ((0, runtime.markedIndexSeenBefore)()) {
        return stop(undefined, false);
      }
      if ((0, runtime.recordMarkedIndexSeen)()) {
        return (0, runtime.reopenAfterFilesMigration)("moved_to_files");
      }
    }
    if (nextAction.again === true) {
      return;
    }
    let code =
        outcome.result === "aborted"
          ? outcome.code
          : outcome.result === "skipped"
            ? outcome.reason
            : "",
      failedBeforePublish =
        home === "file" &&
        outcome.result === "aborted" &&
        outcome.stage === "lease";
    blobReadable = code !== "blob_unreadable";
    if (
      code === "invalid_content" &&
      trackedFiles.downloadsRefused().length > 0
    ) {
      return stop(
        (0, runtime.temporarilyUnsavableMigrationFilesMessage)(
          trackedFiles.downloadsRefused(),
        ),
        false,
      );
    }
    stop(
      nextAction.notice ??
        (code === "blob_unreadable"
          ? runtime.MIGRATION_UNREADABLE_FILE_MESSAGE
          : code === "unpublishable_file"
            ? (0, runtime.unpublishableMigrationFilesMessage)(
                (0, runtime.takeUnpublishableMigrationPaths)(),
              )
            : undefined),
      runtime.TERMINAL_MIGRATION_ERROR_CODES.has(code) && !failedBeforePublish,
    );
  }
  bindRuntimeValue(
    runtime,
    "runDesignSystemFilesMigration",
    () => runDesignSystemFilesMigration,
  );
  return () => {};
}
