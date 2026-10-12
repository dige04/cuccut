/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type {
  FilesDocumentOptions,
  FilesDocument,
  FileDocumentState,
  FileRetryError,
  CrashStashOffer,
  FilesRemoteAppliedRow,
} from "../contracts/files-core";
import type * as Files from "../contracts";
export function installFilesDocument(runtime: RuntimeBindings): () => void {
  function createFilesDocument<Index extends { v: number }, Content>(
    options: FilesDocumentOptions<Index, Content>,
  ): FilesDocument<Index, Content> {
    let { codec: codec, port: port } = options,
      timers = options.timers ?? {
        setTimeout: (input: () => void, options2: number) =>
          setTimeout(input, options2),
        clearTimeout: (input: ReturnType<typeof setTimeout>) =>
          clearTimeout(input),
        now: (): number => Date.now(),
        random: (): number => Math.random(),
      },
      codecWants =
        codec.wants ??
        ((input: Files.FileListingRow) =>
          input.path.startsWith(runtime.PROJECT_FILE_PREFIX) &&
          (0, runtime.isTextFileListingRow)(input)),
      wantsFile = (input: Files.FileListingRow) =>
        !isInternalPath(input.path) && codecWants(input),
      parseContent = (input: unknown, options2: Content) => {
        try {
          return options.parseContent(input);
        } catch {
          return options2;
        }
      },
      parseTitle = (input: unknown, options2: string) =>
        (0, runtime.normalizeArtifactTitle)(
          typeof input === "string" ? input.trim() : input,
        ) ?? options2,
      state: FileDocumentState<Content> = {
        title: parseTitle(options.defaultTitle, "Appifact"),
        content: options.initialContent,
        comments: [],
      },
      fileTexts: Map<string, string> = new Map(),
      fileBaseShas: Map<string, string | null> = new Map(),
      savedFileTexts: Map<string, string> = new Map(),
      fileChangedHere = (input: string) =>
        fileTexts.has(input) &&
        fileTexts.get(input) !== savedFileTexts.get(input),
      heldRemotePaths: Set<string> = new Set(),
      loadState: "loading" | "failed" | "live" = "loading",
      lastError: { code: string; message: string } | undefined,
      lastSyncedAt: number | undefined,
      commitTimer: ReturnType<typeof setTimeout> | undefined,
      disposed: boolean = false,
      personChanged: boolean = false,
      changeSubscribers: Set<(event?: { remote: boolean }) => void> = new Set(),
      saveSubscribers: Set<
        (state: import("../contracts/platform-host").SaveState) => void
      > = new Set(),
      loadSubscribers: Set<() => void> = new Set(),
      indexStore = (0, runtime.createIndexFileStore)({
        path: codec.indexPath,
        port: port,
        schema: codec.schema,
        empty: codec.emptyIndex,
        externalMembers: (input: string) =>
          codec.externalMembers?.(input, fileTexts),
      }),
      reloadIndex = indexStore.reloadAndMerge.bind(indexStore),
      reloadAndMergeIndex = async (input: boolean): Promise<string[]> => {
        let value = indexStore.dirty(),
          value2 = (0, runtime.cloneMergeValue)(indexStore.base()),
          value3 = (0, runtime.cloneMergeValue)(indexStore.get()),
          value4 = await reloadIndex(),
          value5: boolean = !(0, runtime.mergeValuesEqual)(
            indexStore.base(),
            value2,
          );
        if (value && value5) {
          try {
            options.onIndexMerged?.({
              conflicts: value4,
              base: value2,
              mine: value3,
              merged: indexStore.get(),
            });
          } catch {}
        }
        if (value5 && input) {
          composeState(true);
        }
        return value4;
      };
    indexStore.reloadAndMerge = () => reloadAndMergeIndex(true);
    let queue = (0, runtime.createFilesSaveQueue)({
        port: port,
        index: indexStore,
        timers: timers,
        ...(options.saveStash !== undefined
          ? {
              stash: options.saveStash,
            }
          : {}),
        ...(options.paced !== undefined
          ? {
              paced: options.paced,
            }
          : {}),
        ...(options.peers !== undefined
          ? {
              peers: options.peers,
            }
          : {}),
        onConflict(
          input: import("../contracts/files-core").FileSaveConflict,
        ): void {
          if (options.onConflict) {
            options.onConflict(input);
          } else {
            options.onNotice?.(
              "Someone else changed " +
                input.path.slice(input.path.lastIndexOf("/") + 1) +
                " while you were editing it. Your version was not saved over theirs.",
            );
          }
        },
        onState(
          input: import("../contracts/files-core").FileSaveQueueState,
        ): void {
          if (
            input.lastError === undefined &&
            input.dirty === 0 &&
            !input.inFlight
          ) {
            lastSyncedAt = timers.now();
            for (let [value, value2] of fileTexts) {
              if (
                !queue.conflicted().has(value) &&
                !queue.withdrawn().has(value) &&
                !queue.unsendable().has(value)
              ) {
                savedFileTexts.set(value, value2);
              }
            }
          }
          lastError =
            input.lastError !== undefined
              ? {
                  code: input.lastError,
                  message: input.lastError,
                }
              : undefined;
          notifySave();
        },
      }),
      notifyChange = (input?: boolean): void => {
        for (let value of [...changeSubscribers]) {
          try {
            value(
              input
                ? {
                    remote: true,
                  }
                : undefined,
            );
          } catch {}
        }
      },
      notifySave = (): void => {
        let value = saveState();
        for (let value2 of [...saveSubscribers]) {
          try {
            value2(value);
          } catch {}
        }
      },
      notifyLoad = (): void => {
        for (let value of [...loadSubscribers]) {
          try {
            value();
          } catch {}
        }
      },
      bootNarrowed: boolean = false,
      bootFailureCode: string | undefined,
      indexNeedsInitialWrite: boolean = false,
      readOnly = () => !port.canWrite || bootNarrowed;
    function saveState(): import("../contracts/platform-host").SaveState & {
      leftOut?: {
        id: string;
        cause: import("../contracts/files-core").UnsendableCause;
      }[];
    } {
      if (loadState === "loading") {
        return {
          status: "loading",
        };
      }
      if (readOnly()) {
        return {
          status: "readonly",
          ...(options.readOnlyReason !== undefined
            ? {
                message: options.readOnlyReason,
              }
            : (bootNarrowed || port.narrowed === true) &&
                port.mayWrite !== false
              ? {
                  message: runtime.FILE_LIST_UNAVAILABLE_MESSAGE,
                }
              : {}),
        };
      }
      let value = queue.state(),
        value2: boolean = value.unsendableStashed === true;
      if (value.stuck !== undefined) {
        return {
          status: "error",
          message:
            (0, runtime.describeStuckSave)(value.stuck, timers.now()) +
            (value.unsendable !== undefined
              ? " " +
                (0, runtime.formatUnsendableFilesMessage)(value.unsendable, {
                  restSaved: false,
                  stashed: value2,
                })
              : ""),
          code: value.stuck.code,
        };
      }
      if (value.inFlight) {
        return {
          status: "saving",
        };
      }
      if (value.lastError !== undefined && value.backoffUntil === undefined) {
        return {
          status: "error",
          message: value.lastError,
          code: value.lastError,
        };
      }
      if (value.dirty > 0) {
        return {
          status: "dirty",
        };
      }
      if (value.unsendable !== undefined) {
        return {
          status: "error",
          message: (0, runtime.formatUnsendableFilesMessage)(value.unsendable, {
            stashed: value2,
          }),
          code: "invalid_content",
          leftOut: value.unsendable.map(
            (input: {
              path: string;
              cause: import("../contracts/files-core").UnsendableCause;
            }) => ({
              id: input.path,
              cause: input.cause,
            }),
          ),
        };
      }
      return {
        status: "ready",
      };
    }
    function composeState(input: boolean): void {
      let value = codec.compose(indexStore.get(), fileTexts);
      state = {
        title: parseTitle(value.title, state.title),
        content: parseContent(value.content, state.content),
        comments: state.comments,
      };
      composedPaths.clear();
      try {
        for (let value2 of codec.filesOf(state).keys()) {
          composedPaths.add(value2);
        }
      } catch {}
      notifyChange(input);
    }
    function queueContentChanges(): void {
      let value = codec.filesOf(state);
      for (let [value3, value4] of value) {
        knownOwnedPaths.add(value3);
        composedPaths.add(value3);
        if (fileTexts.get(value3) === value4) {
          continue;
        }
        fileTexts.set(value3, value4);
        queue.markDirty(value3, () => value4, fileBaseShas.get(value3) ?? null);
      }
      for (let value3 of [...fileTexts.keys()]) {
        if (
          value.has(value3) ||
          isInternalPath(value3) ||
          !ownsComposedPath(value3)
        ) {
          continue;
        }
        fileTexts.delete(value3);
        queue.markDirty(
          value3,
          (): null => null,
          fileBaseShas.get(value3) ?? null,
        );
      }
      let value2 = codec.indexOf(state, indexStore.get());
      if (
        indexNeedsInitialWrite ||
        !(0, runtime.mergeValuesEqual)(value2, indexStore.get())
      ) {
        indexNeedsInitialWrite = false;
        indexStore.update((input) =>
          (0, runtime.removeMissingMergeProperties)(input, value2),
        );
      }
    }
    let knownOwnedPaths: Set<string> = new Set(),
      composedPaths: Set<string> = new Set(),
      ownsComposedPath = (input: string) =>
        knownOwnedPaths.has(input) && composedPaths.has(input),
      isInternalPath = (input: string) =>
        input === codec.indexPath ||
        (codec.type !== undefined
          ? (0, runtime.isReservedProjectFile)(codec.type, input)
          : input === runtime.MIGRATION_MANIFEST_PATH);
    function contentChanged(input?: boolean): void {
      if (readOnly() || disposed) {
        return;
      }
      personChanged = true;
      if (!input) {
        (0, runtime.recordArtifactEdit)();
      }
      queueContentChanges();
      notifyChange();
      notifySave();
      if (commitTimer !== undefined) {
        timers.clearTimeout(commitTimer);
      }
      commitTimer = timers.setTimeout((): void => {
        commitTimer = undefined;
        queue.commit();
      }, options.commitMs ?? 800);
    }
    let stashOffer: CrashStashOffer,
      restoreCount = 0,
      loadRetryTimer: ReturnType<typeof setTimeout> | undefined,
      loadRetryAt = 0,
      loadRetryAttempt = 0,
      loadPromise: Promise<void>,
      bootFailure: { error: unknown; at: number } | undefined;
    function scheduleLoadRetry(input: number, options2: boolean = false): void {
      if (disposed) {
        return;
      }
      if (loadRetryTimer !== undefined) {
        if (!options2 || timers.now() + input >= loadRetryAt) {
          return;
        }
        timers.clearTimeout(loadRetryTimer);
      }
      loadRetryAt = timers.now() + input;
      loadRetryTimer = timers.setTimeout((): void => {
        loadRetryTimer = undefined;
        retryLoad(false);
      }, input);
    }
    function retryLoad(input: boolean): void {
      if (loadState !== "failed" || disposed) {
        return;
      }
      if (loadRetryTimer !== undefined) {
        timers.clearTimeout(loadRetryTimer);
        loadRetryTimer = undefined;
      }
      loadState = "loading";
      notifyLoad();
      loadPromise = loadFiles(input);
    }
    let resolveWhenLive: () => void,
      whenLive: Promise<void> = new Promise<void>((input): void => {
        resolveWhenLive = input;
      });
    async function loadFiles(input: boolean = false): Promise<void> {
      let value = timers.now();
      try {
        bootNarrowed = false;
        bootFailureCode = undefined;
        let value2 = await (0, runtime.readFilesBootState)({
          port: port,
          indexPath: codec.indexPath,
          wants: wantsFile,
          timers: timers,
          mayWrite: port.mayWrite ?? port.canWrite,
          ...(options.early !== undefined
            ? {
                early: options.early,
              }
            : {}),
        });
        bootNarrowed = value2.narrowed === true;
        indexStore.loadText(value2.index.text, value2.index.sha256);
        for (let [value3, value4] of value2.files) {
          fileTexts.set(value3, value4.text);
          savedFileTexts.set(value3, value4.text);
          fileBaseShas.set(value3, value4.sha256);
          knownOwnedPaths.add(value3);
        }
        loadState = "live";
        lastSyncedAt = timers.now();
        loadRetryAttempt = 0;
        bootFailure = undefined;
        composeState(false);
        resolveWhenLive();
        if (options.saveStash !== undefined && !readOnly()) {
          let values = new Set(
            value2.listing.map((input2: Files.FileListingRow) => input2.path),
          );
          stashOffer = await (0, runtime.applyCrashStashEdits)(
            options.saveStash,
            (input2) =>
              input2 === codec.indexPath
                ? indexStore.serialize()
                : (value2.files.get(input2)?.text ??
                  (values.has(input2) ? undefined : null)),
          );
        }
      } catch (value2: unknown) {
        if (
          options.startWhenNoIndex !== undefined &&
          value2 instanceof runtime.BootReadError &&
          (value2 as Error & { code: string; narrowed?: boolean }).code ===
            "no_index" &&
          (value2 as Error & { code: string; narrowed?: boolean }).narrowed ===
            false
        ) {
          indexStore.init(options.startWhenNoIndex());
          queue.withdraw(codec.indexPath);
          indexNeedsInitialWrite = true;
          loadState = "live";
          lastSyncedAt = timers.now();
          loadRetryAttempt = 0;
          bootFailure = undefined;
          composeState(false);
          resolveWhenLive();
          if (options.saveStash !== undefined && !readOnly()) {
            stashOffer = await (0, runtime.applyCrashStashEdits)(
              options.saveStash,
              (input2) =>
                input2 === codec.indexPath ? indexStore.serialize() : null,
            );
          }
          notifyLoad();
          notifySave();
          return;
        }
        if (
          value2 instanceof runtime.BootReadError &&
          (value2 as Error & { code: string; narrowed?: boolean }).code ===
            "access_revoked"
        ) {
          await options.saveStash?.clearArtifact();
        }
        loadState = "failed";
        bootFailureCode =
          value2 instanceof runtime.BootReadError
            ? (value2 as Error & { code: string; narrowed?: boolean }).code
            : undefined;
        lastError = {
          code: "timeout",
          message:
            value2 instanceof Error
              ? value2.message
              : String((value2 as FileRetryError | null)?.message ?? value2),
        };
        bootFailure = {
          error: value2,
          at: value,
        };
        let value3 = (0, runtime.getBootstrapRetryDelay)(
          value2,
          loadRetryAttempt,
        );
        if (value3 !== undefined) {
          if (!input) {
            loadRetryAttempt += 1;
          }
          scheduleLoadRetry(value3);
        }
      }
      notifyLoad();
      notifySave();
    }
    function restoreStashEdits(input: NonNullable<CrashStashOffer>): void {
      for (let value2 of input.edits) {
        if (
          isInternalPath(value2.path) ||
          !value2.path.startsWith(runtime.PROJECT_FILE_PREFIX)
        ) {
          continue;
        }
        let text = value2.text;
        if (text === null) {
          fileTexts.delete(value2.path);
        } else {
          fileTexts.set(value2.path, text);
          knownOwnedPaths.add(value2.path);
        }
        if (value2.base === null) {
          fileBaseShas.delete(value2.path);
        } else {
          fileBaseShas.set(value2.path, value2.base);
        }
        queue.markDirty(value2.path, () => text, value2.base);
      }
      let value = input.edits.find(
        (input2): boolean => input2.path === codec.indexPath,
      );
      if (value !== undefined && value.text !== null) {
        let value2: Index | undefined;
        try {
          value2 = indexStore.parse(value.text);
        } catch {
          value2 = undefined;
        }
        if (value2 !== undefined) {
          let value3 = (0, runtime.mergeDocumentValues)(
            codec.emptyIndex(),
            value2,
            indexStore.get(),
            codec.schema,
            {
              externalMembers: (input2) =>
                codec.externalMembers?.(input2, fileTexts),
            },
          );
          if (!(0, runtime.mergeValuesEqual)(value3, indexStore.get())) {
            indexStore.update((input2) =>
              (0, runtime.removeMissingMergeProperties)(input2, value3),
            );
          }
        }
      }
      queue.stashRestored();
      personChanged = true;
      composeState(false);
      notifySave();
      if (commitTimer !== undefined) {
        timers.clearTimeout(commitTimer);
      }
      commitTimer = timers.setTimeout((): void => {
        commitTimer = undefined;
        queue.commit();
      }, options.commitMs ?? 800);
    }
    async function applyRemote(
      input: Files.FileRemoteChange,
      options2?: Map<string, Files.FileBytesRead>,
    ): Promise<void> {
      if (loadState === "failed") {
        let value2 =
          bootFailure === undefined
            ? 0
            : (0, runtime.filesBootRetryDelayForHotUpdate)(
                bootFailure.error,
                input,
                codec.indexPath,
                timers.now() - bootFailure.at,
              );
        if (value2 === 0) {
          retryLoad(false);
        } else if (value2 !== undefined) {
          scheduleLoadRetry(value2, true);
        }
      }
      for (let value2 = loadPromise; ; value2 = loadPromise) {
        if ((await value2, value2 === loadPromise)) {
          break;
        }
      }
      if (loadState !== "live") {
        return;
      }
      if (port.narrowed === true && port.mayWrite !== true) {
        bootNarrowed = true;
      }
      let flag: boolean = false,
        items: FilesRemoteAppliedRow[] = [],
        callback = (
          input2: Files.ChangedFileRow,
          options3: FilesRemoteAppliedRow["decision"],
        ): void => {
          items.push({
            path: input2.path,
            sha256: input2.sha256,
            decision: options3,
          });
        },
        value = (0, runtime.filesPortExtensions)(port),
        callback2 = (input2: string) => {
          let value2 = value.heldSha?.(input2);
          return (
            value.wroteSinceAdopt?.(input2) === true &&
            typeof value2 === "string" &&
            queue.isOwnEcho({
              path: input2,
              sha256: value2,
            })
          );
        };
      for (let value2 of input.changed) {
        if (value2.path === codec.indexPath) {
          flag = value2.sha256 !== null;
          callback(value2, "index");
          continue;
        }
        if (value2.sha256 === null) {
          if (value.wroteSinceAdopt?.(value2.path) === true) {
            callback(value2, "ignored");
            continue;
          }
          if (fileChangedHere(value2.path)) {
            heldRemotePaths.add(value2.path);
            callback(value2, "held");
            continue;
          }
          if (fileTexts.delete(value2.path)) {
            fileBaseShas.delete(value2.path);
            savedFileTexts.delete(value2.path);
            knownOwnedPaths.delete(value2.path);
            callback(value2, "removed");
          } else {
            callback(value2, "ignored");
          }
          continue;
        }
        if (
          !fileTexts.has(value2.path) &&
          !wantsFile({
            path: value2.path,
            sha256: value2.sha256,
            size: 0,
            contentType: options2?.get(value2.path)?.contentType ?? "text/html",
          })
        ) {
          callback(value2, "ignored");
          continue;
        }
        if (callback2(value2.path)) {
          callback(value2, "ignored");
          continue;
        }
        if (
          options.holdRemote?.(value2.path) === true ||
          fileChangedHere(value2.path)
        ) {
          heldRemotePaths.add(value2.path);
          callback(value2, "held");
          continue;
        }
        let value3 = await (0, runtime.retryFileRead)(
          () => port.readText(value2.path),
          timers,
        );
        fileTexts.set(value2.path, value3.text);
        savedFileTexts.set(value2.path, value3.text);
        fileBaseShas.set(value2.path, value3.sha256);
        knownOwnedPaths.add(value2.path);
        callback(value2, "theirs");
      }
      if (flag) {
        await (0, runtime.retryFileRead)(
          () => reloadAndMergeIndex(false),
          timers,
        );
      }
      composeState(true);
      if (items.length > 0) {
        try {
          options.onRemoteApplied?.(items, input);
        } catch {}
      }
    }
    loadPromise = loadFiles();
    let firstLoad = loadPromise,
      hotController = (0, runtime.createFilesHotUpdateController)({
        port: port,
        hot: options.hot,
        embedded: options.embedded,
        isBusy: options.isBusy,
        snapshot: options.snapshot,
        restore: options.restore,
        timers: timers,
        applyRemote: applyRemote,
        ...(options.early !== undefined
          ? {
              early: options.early,
            }
          : {}),
        ...(options.onHotEvent !== undefined
          ? {
              onEvent: options.onHotEvent,
            }
          : {}),
        ...(options.onBeforeRestart !== undefined
          ? {
              onBeforeRestart: options.onBeforeRestart,
            }
          : {}),
        ...(options.reveal !== undefined
          ? {
              reveal: options.reveal,
            }
          : {}),
      }),
      unsubscribeRemote = hotController.active
        ? (): void => {
            return;
          }
        : port.onRemoteChange(
            (input) =>
              void applyRemote(input).catch((): void => {
                return;
              }),
          ),
      document2: FilesDocument<Index, Content> = {
        saveMode: (): "auto" => "auto",
        state: () => state,
        content: () => state.content,
        title: () => state.title,
        setTitle(input: string): void {
          let value = (0, runtime.normalizeTitleInput)(input);
          if (value === state.title) {
            return;
          }
          state = {
            ...state,
            title: value,
          };
          contentChanged();
        },
        setContent(input: Content): void {
          state = {
            ...state,
            content: input,
          };
          contentChanged();
        },
        updateContent(
          input: (content: Content) => Content,
          options2?: { auto?: boolean },
        ): void {
          state = {
            ...state,
            content: input(state.content),
          };
          contentChanged(options2?.auto);
        },
        comments: () => state.comments,
        addComment(input) {
          let state2 = {
            ...input,
            id: "c" + String(timers.now()) + String(state.comments.length),
            at: timers.now(),
          };
          state = {
            ...state,
            comments: [
              ...state.comments,
              state2 as import("../contracts/platform-host").ArtifactComment,
            ],
          };
          notifyChange();
          return state2 as import("../contracts/platform-host").ArtifactComment;
        },
        removeComment(input): void {
          state = {
            ...state,
            comments: state.comments.filter(
              (input2): boolean => input2.id !== input,
            ),
          };
          notifyChange();
        },
        commentSync: () => ({
          status: "idle",
          pending: 0,
        }),
        pendingCommentIds: () => new Set(),
        retryCommentPublish: (): void => {
          return;
        },
        dirty: () => queue.pending(),
        readOnly: readOnly,
        saveState: saveState,
        documentBytes: () => {
          let length = indexStore.serialize().length;
          for (let value of fileTexts.values()) {
            length += value.length;
          }
          return length;
        },
        async save(): Promise<void> {
          if (loadState === "failed") {
            document2.retryLoad();
            return;
          }
          document2.flushNow();
          await queue.settle();
        },
        stashOffer: () =>
          stashOffer === undefined
            ? undefined
            : {
                at: stashOffer.at,
              },
        restoreStash() {
          let value = stashOffer;
          if (value === undefined || readOnly()) {
            return;
          }
          stashOffer = undefined;
          let value2 = state;
          restoreStashEdits(value);
          restoreCount += 1;
          notifyChange();
          return {
            label: "Restore unsaved edits",
            do: (): void => {
              restoreStashEdits(value);
              notifyChange();
            },
            undo: (): void => {
              state = value2;
              contentChanged();
            },
          };
        },
        discardStash(): void {
          stashOffer = undefined;
          options.saveStash?.clearOffered();
        },
        restoreCount: () => restoreCount,
        subscribe(input) {
          changeSubscribers.add(input);
          return () => void changeSubscribers.delete(input);
        },
        subscribeSave(input) {
          saveSubscribers.add(input);
          return () => void saveSubscribers.delete(input);
        },
        loadState: () => loadState,
        shown: (): boolean => loadState === "live",
        cachedSettled: (): boolean => false,
        subscribeLoad(input) {
          loadSubscribers.add(input);
          return () => void loadSubscribers.delete(input);
        },
        flushNow(): void {
          if (commitTimer !== undefined) {
            timers.clearTimeout(commitTimer);
            commitTimer = undefined;
          }
          queue.flushNow();
        },
        retryLoad(): void {
          retryLoad(true);
        },
        bootFailure: () =>
          loadState === "failed" ? bootFailureCode : undefined,
        storeUntouched: () =>
          loadState === "live" && !personChanged && fileTexts.size === 0,
        releaseHold(input): void {
          if (!heldRemotePaths.delete(input) && !fileChangedHere(input)) {
            return;
          }
          if (queue.unsendable().has(input)) {
            queue.withdraw(input);
          }
          if (
            (0, runtime.filesPortExtensions)(port).liveSha?.(input) === null
          ) {
            if (queue.conflicted().has(input)) {
              return;
            }
            if (fileTexts.delete(input)) {
              fileBaseShas.delete(input);
              savedFileTexts.delete(input);
              knownOwnedPaths.delete(input);
              composeState(true);
            }
            return;
          }
          (0, runtime.retryFileRead)(() => port.readText(input), timers).then(
            (input2): void => {
              if (queue.conflicted().has(input)) {
                return;
              }
              fileTexts.set(input, input2.text);
              savedFileTexts.set(input, input2.text);
              fileBaseShas.set(input, input2.sha256);
              knownOwnedPaths.add(input);
              composeState(true);
            },
            (): void => {
              return;
            },
          );
        },
        syncDetail: () => ({
          pending: queue.state().dirty,
          inflight: queue.state().inFlight ? codec.indexPath : null,
          flights: queue.state().inFlight ? 1 : 0,
          ...(lastSyncedAt !== undefined
            ? {
                lastSyncedAt: lastSyncedAt,
              }
            : {}),
          ...(lastError !== undefined
            ? {
                lastError: lastError,
              }
            : {}),
        }),
        dispose(): void {
          disposed = true;
          if (commitTimer !== undefined) {
            timers.clearTimeout(commitTimer);
          }
          if (loadRetryTimer !== undefined) {
            timers.clearTimeout(loadRetryTimer);
          }
          hotController.dispose();
          unsubscribeRemote();
          queue.dispose();
        },
        queue: () => queue,
        hot: () => hotController,
        index: () => indexStore,
        whenLoaded: () => firstLoad,
        whenLive: () => whenLive,
        held: () => heldRemotePaths,
        retrySave: () => queue.retryNow(),
        applyRemote: (input) => applyRemote(input),
      };
    return document2;
  }
  bindRuntimeValue(runtime, "createFilesDocument", () => createFilesDocument);
  return () => {};
}
