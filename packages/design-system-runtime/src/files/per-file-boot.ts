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
export function installFilesPerFileBoot(runtime: RuntimeBindings): () => void {
  var EXTERNAL_CHANGES_FOLDED_MESSAGE: string;
  var designSystemTypeReadonlyReason: () => string;
  var MARKED_INDEX_STORAGE_PREFIX: string;
  async function bootPerFileDesignSystem(
    outcome: Boot.LegacyInitialState,
    readOnlyReason?: string,
    storeHandle: Boot.NativeLegacyDatabase | null = null,
    emptyIndex?: Model.FilesIndex,
  ): Promise<void> {
    if ((0, runtime.isFrameCaptureMode)()) {
      return (0, runtime.captureDesignSystemAndHoldBoot)();
    }
    runtime.perFileDesignSystemBooted = true;
    (0, runtime.enablePreviewRunner)(
      window,
      (0, runtime.getHotCapability)()?.signal,
      runtime.BOOT_FILE_READ_RETRY_DELAYS_MS,
    );
    let indexPath = runtime.FILES_INDEX_PROJECT_PATH;
    (0, runtime.installDesignSystemTypingListener)();
    (0, runtime.waitForBootLiveAnnouncer)(readOnlyReason);
    let title = (0, runtime.stateEnvelopeTitle)(outcome.state);
    if (title !== undefined) {
      document.title = title;
    }
    if (!runtime.isDesignSystemTypeHost) {
      (0, runtime.initializeDesignSystemFilesDebugger)();
    }
    let access =
        readOnlyReason === undefined && !runtime.isDesignSystemTypeHost
          ? await (0, runtime.determineSlidesWriteAccess)()
          : {
              canWrite: false,
              reason: readOnlyReason ?? designSystemTypeReadonlyReason(),
            },
      stash = access.canWrite
        ? await (0, runtime.createCurrentArtifactCrashStash)("design-system")
        : null,
      viewerId = await (0, runtime.currentUserId)();
    try {
      (0, runtime.purgeOtherViewerCarryEntries)(sessionStorage, viewerId);
    } catch {}
    let files = (0, runtime.createBrowserFilesPort)({
        canWrite: access.canWrite,
        fetch: (input) =>
          fetch(input, {
            credentials: "same-origin",
            signal: AbortSignal.timeout(
              runtime.FILES_DOCUMENT_FETCH_TIMEOUT_MS,
            ),
          }),
        fetchFresh: (input) =>
          fetch(input, {
            credentials: "same-origin",
            cache: "no-store",
            signal: AbortSignal.timeout(
              runtime.FILES_DOCUMENT_FETCH_TIMEOUT_MS,
            ),
          }),
        onRead: (input, options, context, value) =>
          runtime.designSystemFilesDebugger?.read(
            input,
            options,
            context,
            value,
          ),
        onPublishError: (input) =>
          runtime.designSystemFilesDebugger?.event("publish-raw-error", input),
      }),
      instrumentedFiles =
        runtime.designSystemFilesDebugger !== undefined
          ? (0, runtime.instrumentFilesPort)(
              files,
              runtime.designSystemFilesDebugger,
            )
          : files;
    runtime.designSystemFilesDebugger?.field(
      "can write",
      String(access.canWrite),
    );
    (0, runtime.setFileSystemDocumentFactory)(
      (options: Host.ArtifactParser<Model.DesignSystemContent>) => {
        let value: Docs.DesignSystemFilesDocument = (0,
        runtime.createDesignSystemFilesDocument)({
          port: instrumentedFiles,
          indexPath: indexPath,
          ...(emptyIndex !== undefined
            ? {
                startWhenNoIndex: () => emptyIndex,
              }
            : {}),
          parseContent: options.parseContent,
          initialContent: options.initialContent,
          defaultTitle: document.title || options.defaultTitle,
          ...(readOnlyReason !== undefined
            ? {
                readOnlyReason: readOnlyReason,
              }
            : access.reason !== undefined
              ? {
                  readOnlyReason: access.reason,
                }
              : {}),
          lazy: !access.canWrite,
          onNotice: (input: string): void => {
            runtime.designSystemFilesDebugger?.event("notice", {
              text: input,
            });
            (0, runtime.showEditorPromiseNotification)(input, null);
          },
          generated: true,
          onEvent: (input: string, options2: unknown) =>
            runtime.designSystemFilesDebugger?.event("ds-" + input, options2),
          reveal: runtime.designSystemFirstPaint,
          ...(stash !== null
            ? {
                saveStash: stash,
              }
            : {}),
          stashKey: (0, runtime.designSystemCarryKey)(viewerId),
          paced: true,
          onHotEvent: (input: FilesCore.FilesHotEvent): void => {
            runtime.designSystemFilesDebugger?.hotEvent(input);
            if (input.type === "applied") {
              afterTwoAnimationFrames(() =>
                runtime.designSystemFilesDebugger?.visible(
                  input.to!,
                  "adopted",
                ),
              );
            }
          },
          onBeforeRestart: (input: string) =>
            runtime.designSystemFilesDebugger?.beforeRestart(input),
        });
        (0, runtime.installFilesSaveLifecycle)(value.queue());
        (0, runtime.monitorSyncLoadHealth)(value, (input: Boot.HealthReport) =>
          runtime.artifactHealth.report(...input),
        );
        (0, runtime.monitorSyncSaveHealth)(value, (input: Boot.HealthReport) =>
          runtime.artifactHealth.report(...input),
        );
        (0, runtime.observeDocumentThumbnailReadiness)(value);
        provideDesignSystemFilesDebugState(value, files, indexPath);
        let values = new Set<string>();
        value.subscribe((): void => {
          if (value.loadState() !== "live" || value.readOnly()) {
            return;
          }
          let files2 = value.content().files,
            value2 = (0, runtime.filesLeftOutOfMigration)(files2).filter(
              (input: { path: string }) =>
                !values.has(input.path) &&
                !(0, runtime.isRepairableDamagedText)(
                  input.path,
                  files2[input.path] ?? "",
                ) &&
                !(0, runtime.isUnsupportedBinaryFile)(
                  input.path,
                  files2[input.path] ?? "",
                ) &&
                !(0, runtime.isHeldFilePointer)(
                  input.path,
                  files2[input.path] ?? "",
                ),
            );
          for (let value3 of value2) {
            values.add(value3.path);
          }
          if (value2.length > 0) {
            (0, runtime.showEditorPromiseNotification)(
              (value2.length === 1
                ? '"' + value2[0].path + '"'
                : String(value2.length) + " files") +
                " can’t be saved here. Give " +
                (value2.length === 1 ? "it another name" : "them other names") +
                " without % ; : ? or #, or add " +
                (value2.length === 1 ? "it" : "them") +
                " again.",
              null,
            );
          }
        });
        let callback = (): void => {
          if (value.loadState() !== "live") {
            return;
          }
          let entry = value.index().get();
          (0, runtime.updateStoredSystemMigrationFlags)(entry);
          let value2 = (0, runtime.editingOffTransition)({
            offAtBoot: readOnlyReason === runtime.MIGRATED_READONLY_MESSAGE,
            canWrite: access.canWrite,
            offNow: (0, runtime.isSystemEditingDisabled)(entry),
          });
          if (value2 === "on") {
            (0, runtime.reportMigrationAnalytics)(
              runtime.MIGRATION_ANALYTICS_EVENTS.editingCameOn,
            );
          }
          if (value2 !== null) {
            (0, runtime.reopenForEditingTransition)(value2);
          }
        };
        value.subscribe(callback);
        value.whenLoaded().then((): void => {
          runtime.designSystemFilesDebugger?.phase("files read");
          runtime.designSystemFilesDebugger?.field(
            "on version",
            files.version().version,
          );
          afterTwoAnimationFrames((): void => {
            runtime.designSystemFilesDebugger?.phase("first paint");
            (0, runtime.resolveDesignSystemFirstPaint)();
            if (
              runtime.designSystemFilesDebugger !== undefined &&
              runtime.designSystemFilesDebugger.reloadReason.startsWith(
                "hot restart",
              )
            ) {
              runtime.designSystemFilesDebugger.visible(
                files.version().version,
                "restarted",
              );
            }
          });
        });
        value
          .whenLive()
          .then((): void => {
            callback();
            let value2 = value.subscribe((): void => {
              if (value.personChanged()) {
                value2();
                value.materializeOwed().catch((): void => {
                  return;
                });
              }
            });
          })
          .then((): void => {
            let value2: boolean =
                (0, runtime.readTreeIndex)(outcome.state)?.convertedFrom
                  ?.home === "file",
              value3 = access.canWrite && !value.readOnly();
            if (storeHandle !== null && value3 && !value2) {
              watchLegacyStoreChanges(
                storeHandle,
                files,
                value,
                (0, runtime.readTreeIndex)(outcome.state),
                indexPath,
              );
            }
            if (storeHandle !== null && access.canWrite && value2) {
              (0, runtime.createLegacyDatabasePort)(storeHandle)
                .get(runtime.SYSTEM_META_DOCUMENT_PATH)
                .then(
                  (input: Model.FilesMigrationStoreDocument | null): void => {
                    if (
                      legacyStoreChangedAfterMigration(
                        input?.data,
                        (0, runtime.readTreeIndex)(outcome.state),
                      )
                    ) {
                      (0, runtime.showEditorPromiseNotification)(
                        runtime.UNREAD_LEGACY_STORE_CHANGES_MESSAGE,
                        null,
                      );
                    }
                  },
                )
                .catch((): void => {
                  return;
                });
            }
          })
          .catch((): void => {
            return;
          });
        runtime.activeDesignSystemDocument = value;
        return value;
      },
    );
  }
  function legacyStoreChangedAfterMigration(
    meta: unknown,
    index: Model.FilesIndex | undefined,
  ): boolean {
    let marker = (0, runtime.readFileMigrationMarker)(index)?.marker,
      storeChangedAt = (0, runtime.parseStoredSystemMetadata)(meta)?.lastChange
        ?.at,
      storeTime = Date.parse(
        typeof storeChangedAt === "string" ? storeChangedAt : "",
      ),
      migrationTime = (Date.parse as (value: unknown) => number)(
        marker?.at ?? "",
      );
    return (
      Number.isFinite(storeTime) &&
      Number.isFinite(migrationTime) &&
      storeTime > migrationTime
    );
  }
  function watchLegacyStoreChanges(
    storeHandle: Boot.NativeLegacyDatabase,
    files: Model.BrowserFilesPort,
    document2: Docs.DesignSystemFilesDocument,
    bootIndex: Model.FilesIndex | undefined,
    indexPath: string = runtime.FILES_INDEX_PROJECT_PATH,
  ): void {
    let warned: boolean = false,
      store = (0, runtime.createLegacyDatabasePort)(storeHandle),
      adapter = (0, runtime.createDesignSystemMigrationAdapter)(
        runtime.readMigrationArtifactBlob,
        indexPath,
      );
    (0, runtime.createStoreToFilesFoldController)({
      adapter: adapter,
      files: files,
      store: store,
      holder: (0, runtime.migrationTabHolder)(),
      timers: runtime.designSystemMigrationTimers,
      artifactId: location.host,
      onFolded: (input: Model.FileRemoteChange) =>
        void document2.applyRemote(input).catch((): void => {
          return;
        }),
      onOutcome: (input: Boot.MigrationOutcome): void => {
        (0, runtime.reportMigrationFailure)(input);
        if (input.result === "folded") {
          let value = (0, runtime.takeStoreFoldSummary)(),
            items = [
              ...(value.came ? [EXTERNAL_CHANGES_FOLDED_MESSAGE] : []),
              ...(value.kept.length > 0
                ? [storeFoldKeptFilesMessage(value.kept)]
                : []),
            ];
          if (items.length > 0) {
            (0, runtime.showEditorPromiseNotification)(items.join(" "), null);
          }
          if (value.came) {
            setTimeout((): void => {
              document2.regenerate();
              document2.flushNow();
            }, 2000);
          }
        }
        if (
          input.result === "skipped" &&
          input.reason === "no_record" &&
          !warned
        ) {
          store
            .get(runtime.SYSTEM_META_DOCUMENT_PATH)
            .then((input2: Model.FilesMigrationStoreDocument | null): void => {
              if (
                legacyStoreChangedAfterMigration(input2?.data, bootIndex) &&
                !warned
              ) {
                warned = true;
                (0, runtime.showEditorPromiseNotification)(
                  runtime.UNREAD_LEGACY_STORE_CHANGES_MESSAGE,
                  null,
                );
              }
            })
            .catch((): void => {
              return;
            });
        }
      },
    }).watch();
  }
  function storeFoldKeptFilesMessage(
    kept: readonly Boot.FoldKeptFile[],
  ): string {
    let describeFiles = (items: readonly Boot.FoldKeptFile[]) =>
        items.length === 1 ? items[0].path : String(items.length) + " files",
      changed = kept.filter((input): boolean => input.why === "changed"),
      gone = kept.filter((input): boolean => input.why === "gone"),
      cannot = kept.filter((input): boolean => input.why === "cannot");
    return [
      ...(changed.length > 0
        ? [
            "A change made outside this page to " +
              describeFiles(changed) +
              " was not put over what is here, because " +
              (changed.length === 1 ? "it was" : "they were") +
              ' changed here too or could not be compared. Where it is text or tokens, the other version was saved beside it with "(other version)" in its name.',
          ]
        : []),
      ...(gone.length > 0
        ? [
            "A change made outside this page to " +
              describeFiles(gone) +
              " was left out, because " +
              (gone.length === 1 ? "that file was" : "those files were") +
              " removed here.",
          ]
        : []),
      ...(cannot.length > 0
        ? [
            "Something saved outside this page as " +
              describeFiles(cannot) +
              " was left out: " +
              (cannot.length === 1 ? "it is" : "they are") +
              " of a kind, or named in a way, that cannot be saved here.",
          ]
        : []),
    ].join(" ");
  }
  function afterTwoAnimationFrames(callback: () => void): void {
    if (typeof requestAnimationFrame !== "function") {
      setTimeout(callback, 32);
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(callback));
  }
  function provideDesignSystemFilesDebugState(
    document2: Docs.DesignSystemFilesDocument,
    files: Model.BrowserFilesPort,
    indexPath: string = runtime.FILES_INDEX_PROJECT_PATH,
  ): void {
    if (runtime.designSystemFilesDebugger === undefined) {
      return;
    }
    let extensions = (0, runtime.filesPortExtensions)(files);
    runtime.designSystemFilesDebugger.provide({
      files: () => {
        let items = [],
          files2 = document2.content().files,
          value: Map<string, string> =
            extensions.knownListing?.() ?? new Map<string, string>(),
          value2 = document2.flagged(),
          value3 = document2.held();
        items.push({
          path: indexPath,
          sha: document2.index().baseSha(),
          liveSha: extensions.liveSha?.(indexPath) ?? null,
          state: document2.index().dirty() ? "changed here" : "",
        });
        for (let value4 of Object.keys(files2).sort()) {
          let value5 = (0, runtime.projectFilePath)(value4);
          if (!value.has(value5) && !value2.has(value4)) {
            continue;
          }
          items.push({
            path: value5,
            sha: extensions.heldSha?.(value5) ?? null,
            liveSha: extensions.liveSha?.(value5) ?? null,
            size: files2[value4].length,
            state: [
              value2.has(value4)
                ? "FLAGGED (" + (document2.flags().get(value4)?.why ?? "") + ")"
                : "",
              value3.has(value5) ? "theirs held" : "",
            ]
              .filter(Boolean)
              .join(" "),
          });
        }
        for (let [value4, value5] of value) {
          if ((0, runtime.isDerivedProjectPath)(value4)) {
            items.push({
              path: value4,
              sha: value5,
              liveSha: extensions.liveSha?.(value4) ?? null,
              state: "generated",
            });
          }
        }
        return items;
      },
      queue: () => {
        let value = document2.queue(),
          value2 = value.state();
        return {
          dirty: value2.dirty > 0 ? [String(value2.dirty) + " path(s)"] : [],
          inFlight: value2.inFlight,
          ...(value2.lastError !== undefined
            ? {
                lastError: value2.lastError,
              }
            : {}),
          conflicted: [...document2.flagged()].map(runtime.projectFilePath),
          note:
            "a flagged file is kept out of the queue until the person chooses; withdrawn: " +
            ([...value.withdrawn()].join(", ") || "none"),
        };
      },
    });
  }
  function releaseEarlyHotUpdatesForLegacyMode(): void {
    if (
      runtime.activeHotReloadSession === undefined ||
      !runtime.activeHotReloadSession.active
    ) {
      return;
    }
    let value: boolean = runtime.activeHotReloadSession.queued.length > 0;
    runtime.activeHotReloadSession.detach();
    if (!value) {
      return;
    }
    runtime.activeHotReloadSession.queued.splice(0);
    try {
      (0, runtime.getHotCapability)()?.restart?.({
        note: "adopted during boot; not the per-file mode",
      });
    } catch {}
  }
  async function bootDesignSystemFilesMode(): Promise<void> {
    let initialState = (0, runtime.readDesignSystemInitialState)();
    if (runtime.isDesignSystemTypeHost) {
      return (0, runtime.bootLegacyDesignSystemMode)(
        undefined,
        null,
        initialState,
      );
    }
    let outcome = await initialState,
      tree = (0, runtime.readTreeIndex)(outcome.state),
      decision = (0, runtime.chooseTreeBootOutcome)({
        origin: outcome.origin,
        tree: tree !== undefined,
        project: runtime.designSystemFileHomes.project,
        pipeline: (0, runtime.isMigrationExemptHost)(location.hostname),
        editingOff:
          tree !== undefined && (0, runtime.isSystemEditingDisabled)(tree),
      });
    runtime.artifactHealth.report(
      ...((decision.boot === "empty"
        ? (["render", "success"] as const)
        : (0, runtime.bootHealthOutcome)(
            outcome,
            runtime.isDesignSystemTypeHost,
          )) as Boot.HealthReport),
    );
    if (decision.boot === "tree") {
      return bootPerFileDesignSystem(
        outcome,
        (0, runtime.resolveMigratedReadonlyReason)(
          decision.readOnly,
          decision.readOnly === runtime.MIGRATED_READONLY_MESSAGE
            ? await (0, runtime.determineSlidesWriteAccess)()
            : undefined,
        ),
      );
    }
    if (decision.boot === "empty") {
      if (!(await (0, runtime.determineSlidesWriteAccess)()).canWrite) {
        (0, runtime.configureLegacyDesignSystemBoot)(
          {
            state: {},
            origin: "demo",
            stateFileFound: false,
          },
          null,
          decision.readOnly ?? runtime.EMPTY_SYSTEM_READONLY_REASON,
        );
        (0, runtime.prepareDesignSystemThumbnailCapture)();
        return;
      }
      runtime.activeHotReloadSession?.armReady();
      let state = {
        ...(0, runtime.createEmptyFilesIndex)(),
        createdOnFiles: {
          ...(0, runtime.createdOnFilesMarker)({
            at: new Date().toISOString(),
          }),
        },
      };
      return bootPerFileDesignSystem(
        {
          state: {
            title: "",
            content: {
              v: 2,
              files: {},
            },
            [runtime.TREE_INDEX_FIELD]: state,
          },
          origin: "instance",
          stateFileAt: runtime.FILES_INDEX_PATH,
        },
        decision.readOnly,
        null,
        state,
      );
    }
    if (decision.boot === "readonly") {
      (0, runtime.configureLegacyDesignSystemBoot)(
        {
          state: {},
          origin: "demo",
          stateFileFound: false,
        },
        null,
        decision.reason,
      );
      (0, runtime.prepareDesignSystemThumbnailCapture)();
      return;
    }
    (0, runtime.configureLegacyDesignSystemBoot)(
      outcome.origin === "failed"
        ? outcome
        : (0, runtime.failedLegacyStateOutcome)(
            Error("this design system’s list of its files could not be opened"),
          ),
    );
    (0, runtime.prepareDesignSystemThumbnailCapture)();
  }
  function markedIndexSeenBefore(): boolean | undefined {
    try {
      if (
        sessionStorage.getItem(MARKED_INDEX_STORAGE_PREFIX + location.host) !==
        null
      ) {
        return true;
      }
    } catch {}
    try {
      return history.state?.dsMarkedIndex === true;
    } catch {
      return false;
    }
  }
  function recordMarkedIndexSeen(): boolean | undefined {
    try {
      sessionStorage.setItem(MARKED_INDEX_STORAGE_PREFIX + location.host, "1");
      return true;
    } catch {}
    try {
      history.replaceState(
        {
          ...history.state,
          dsMarkedIndex: true,
        },
        "",
      );
      return true;
    } catch {
      return false;
    }
  }
  bindRuntimeValue(
    runtime,
    "bootPerFileDesignSystem",
    () => bootPerFileDesignSystem,
  );
  bindRuntimeValue(
    runtime,
    "legacyStoreChangedAfterMigration",
    () => legacyStoreChangedAfterMigration,
  );
  bindRuntimeValue(
    runtime,
    "watchLegacyStoreChanges",
    () => watchLegacyStoreChanges,
  );
  bindRuntimeValue(
    runtime,
    "EXTERNAL_CHANGES_FOLDED_MESSAGE",
    () => EXTERNAL_CHANGES_FOLDED_MESSAGE,
    (value) => {
      EXTERNAL_CHANGES_FOLDED_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "storeFoldKeptFilesMessage",
    () => storeFoldKeptFilesMessage,
  );
  bindRuntimeValue(
    runtime,
    "afterTwoAnimationFrames",
    () => afterTwoAnimationFrames,
  );
  bindRuntimeValue(
    runtime,
    "provideDesignSystemFilesDebugState",
    () => provideDesignSystemFilesDebugState,
  );
  bindRuntimeValue(
    runtime,
    "designSystemTypeReadonlyReason",
    () => designSystemTypeReadonlyReason,
    (value) => {
      designSystemTypeReadonlyReason = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "releaseEarlyHotUpdatesForLegacyMode",
    () => releaseEarlyHotUpdatesForLegacyMode,
  );
  bindRuntimeValue(
    runtime,
    "bootDesignSystemFilesMode",
    () => bootDesignSystemFilesMode,
  );
  bindRuntimeValue(
    runtime,
    "MARKED_INDEX_STORAGE_PREFIX",
    () => MARKED_INDEX_STORAGE_PREFIX,
    (value) => {
      MARKED_INDEX_STORAGE_PREFIX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "markedIndexSeenBefore",
    () => markedIndexSeenBefore,
  );
  bindRuntimeValue(
    runtime,
    "recordMarkedIndexSeen",
    () => recordMarkedIndexSeen,
  );
  return () => {
    EXTERNAL_CHANGES_FOLDED_MESSAGE =
      "Changes made to this design system outside this page were brought in.";
    designSystemTypeReadonlyReason = (): string =>
      "This is the Design System type itself, not a design system.";
    MARKED_INDEX_STORAGE_PREFIX = "ds-marked-index/";
  };
}
