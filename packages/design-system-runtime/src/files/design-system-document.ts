import type * as Core from "../contracts";
import type * as M from "../contracts/design-system-document";
import type * as F from "../contracts/files-core";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installFilesDesignSystemDocument(
  runtime: RuntimeBindings,
): () => void {
  function createDesignSystemFilesDocument(
    options: M.DesignSystemFilesDocumentOptions,
  ): M.DesignSystemFilesDocument {
    (0, runtime.setHeldFileBaseUrl)(
      runtime.PROJECT_FILE_PREFIXEditorFilesIndex,
    );
    let lazy: F.LazyReadState | undefined =
      options.lazy === true &&
      (options.port.mayWrite ?? options.port.canWrite) === false
        ? {
            rows: new Map(),
          }
        : undefined;
    (0, runtime.setAllowAllBinaryFilePointers)(lazy !== undefined);
    let indexPath: string =
        options.indexPath ?? runtime.FILES_INDEX_PROJECT_PATH,
      flags: Map<string, M.DocumentFlag> = new Map(),
      flaggedPaths: Set<string> = new Set(),
      flagSubscribers: Set<() => void> = new Set(),
      saveSubscribers: Set<(state: M.DocumentSaveState) => void> = new Set(),
      timers: Core.FilesTimers = options.timers ?? {
        setTimeout: (input: () => void, options2: number) =>
          setTimeout(input, options2),
        clearTimeout: (input: ReturnType<typeof setTimeout>) =>
          clearTimeout(input),
        now: (): number => Date.now(),
        random: (): number => Math.random(),
      },
      storage =
        options.storage !== undefined
          ? options.storage
          : (0, runtime.safeSessionStorage)(),
      carryStorageKey =
        runtime.HOT_CARRY_STORAGE_PREFIX +
        (options.stashKey ?? (0, runtime.currentDesignSystemArtifactPath)()),
      events: M.DocumentEvent[] = [],
      emit = (input: string, options2?: unknown): void => {
        events.push({
          type: input,
          data: options2,
        });
        if (events.length > 200) {
          events.shift();
        }
        try {
          options.onEvent?.(input, options2);
        } catch {}
      },
      notice = (input: string): void => {
        try {
          options.onNotice?.(input);
        } catch {}
      },
      clashPolicy = options.clash ?? "mine",
      preparing = false,
      carrying: boolean = false,
      isBusy = () => {
        try {
          return (
            preparing ||
            carrying ||
            (options.isBusy ?? (() => (0, runtime.activeElementIsEditing)()))()
          );
        } catch {
          return preparing || carrying;
        }
      },
      noticedClashShas: Map<string, string | null | undefined> = new Map(),
      pathRevisions: Map<string, number> = new Map(),
      advancePathRevision = (input: string): void => {
        pathRevisions.set(input, (pathRevisions.get(input) ?? 0) + 1);
      },
      notifyFlags = (): void => {
        for (let value2 of [...flagSubscribers]) {
          try {
            value2();
          } catch {}
        }
        let value = enhancedDocument.saveState();
        for (let value2 of [...saveSubscribers]) {
          try {
            value2(value);
          } catch {}
        }
      },
      port = options.port,
      liveSha = (input: string): string | null | undefined =>
        port.liveSha?.((0, runtime.projectFilePath)(input)),
      readTexts: Map<string, string> = new Map(),
      readShas: Map<string, string> = new Map(),
      locallyHeldTexts: Map<string, string | undefined> = new Map(),
      heldText = (input: string, options2 = document2.content().files) =>
        Object.hasOwn(options2, input) ? options2[input] : undefined,
      textIsLocallyHeld = (input: string, options2: string) =>
        locallyHeldTexts.has(input) &&
        locallyHeldTexts.get(input) === heldText(options2),
      preReadBases: Map<string, M.PreReadBase> = new Map(),
      materializedFingerprints: Map<string, string> = new Map(),
      textFingerprint = (items: string): string =>
        String(items.length) + ":" + items.slice(-96),
      latestVersion: string | undefined,
      latestFrameVersion: string | undefined,
      frameVersionFromBaseUri = () => {
        try {
          return /^\/_f\/([^/]+)\//.exec(
            new URL(globalThis.document?.baseURI ?? "").pathname,
          )?.[1];
        } catch {
          return;
        }
      },
      recordVersion = (input: string): void => {
        latestFrameVersion = frameVersionFromBaseUri();
        if (input !== latestVersion) {
          latestVersion = input;
          (0, runtime.notifyAddressedFiles)();
        }
      },
      recentPublishes: Map<string, M.RecentPublish> = new Map(),
      recentHeals: Map<string, number> = new Map(),
      consumeRecentHeal = (input: string) => {
        let entry = recentHeals.get(input);
        recentHeals.delete(input);
        return entry !== undefined && timers.now() - entry <= 1e4;
      },
      recentHealTimes: Map<string, number[]> = new Map(),
      mergingTokenPaths: Set<string> = new Set(),
      encoder = new TextEncoder(),
      currentFileText = (input: string): string | null => {
        let value = document2.content().files[input];
        if (typeof value === "string") {
          return value;
        } else {
          return null;
        }
      },
      keepOutOfUndo = (input: string): void => {
        for (let value of undoCommands) {
          value.keepOut(new Set([input]));
        }
      },
      takeRemoteFile = (input: string): void => {
        let value: string = (0, runtime.projectFilePath)(input);
        document2.held().add(value);
        let value2: boolean = liveSha(input) === null;
        document2.releaseHold(value);
        if (value2) {
          readTexts.delete(value);
          readShas.delete(value);
          recentPublishes.delete(input);
        }
      },
      replaceFileText = (input: string, options2: string): void => {
        keepOutOfUndo(input);
        document2.updateContent(
          (input2) =>
            (0, runtime.refreshManifest)(
              {
                ...input2,
                files: Object.freeze({
                  ...input2.files,
                  [input]: options2,
                }),
              },
              document2.title(),
            ),
          {
            auto: true,
          },
        );
      };
    function readCarryStorage(): M.CarryStorageState {
      let state: M.CarryStorageState = {
          v: 1,
          files: {},
        },
        value: string | null = null;
      try {
        value = storage?.getItem(carryStorageKey) ?? null;
      } catch {
        return state;
      }
      if (value === null) {
        return state;
      }
      try {
        let value2 = JSON.parse(value) as M.CarryStorageWire,
          value3 = timers.now(),
          callback = (input: unknown): input is number =>
            typeof input === "number" &&
            value3 - input <= runtime.HOT_CARRY_MAX_AGE_MS;
        for (let [value6, value7] of Object.entries(value2.files ?? {})) {
          let value8 = (0, runtime.parseCarriedFileEdit)(value7),
            value9 = value7?.at;
          if (value8 !== undefined && callback(value9)) {
            state.files[value6] = {
              ...value8,
              at: value9,
            };
          }
        }
        let value4 = (0, runtime.readCarriedIndexEdit)(value2.index),
          value5 = value2.index?.at;
        if (value4 !== undefined && callback(value5)) {
          state.index = {
            ...value4,
            at: value5,
          };
        }
      } catch {}
      return state;
    }
    function writeCarryStorage(input: M.CarryStorageState): void {
      try {
        if (
          Object.keys(input.files).length === 0 &&
          input.index === undefined
        ) {
          storage?.removeItem(carryStorageKey);
        } else {
          storage?.setItem(carryStorageKey, JSON.stringify(input));
        }
      } catch {}
    }
    function stashOversizedCarry(
      input: Record<string, F.CarriedFileEdit>,
      options2?: F.CarriedIndexEdit,
    ): void {
      if (
        storage === null ||
        storage === undefined ||
        (Object.keys(input).length === 0 && options2 === undefined)
      ) {
        return;
      }
      let value = readCarryStorage(),
        value2 = timers.now(),
        callback = (input2: F.CarriedFileEdit) =>
          input2.text.length + (input2.baseText?.length ?? 0),
        value3 = Object.values(value.files).reduce(
          (input2, options3) => input2 + callback(options3),
          0,
        );
      for (let [value4, value5] of Object.entries(input)) {
        if (
          !(value4 in value.files) &&
          Object.keys(value.files).length >= runtime.HOT_CARRY_MAX_FILES
        ) {
          continue;
        }
        if (value3 + callback(value5) > runtime.HOT_CARRY_MAX_TOTAL_CHARS) {
          continue;
        }
        value.files[value4] = {
          ...value5,
          at: value2,
        };
        value3 += callback(value5);
      }
      if (options2 !== undefined) {
        value.index = {
          ...options2,
          at: value2,
        };
      }
      writeCarryStorage(value);
    }
    function consumeCarryStorage(
      input: readonly string[],
      options2?: boolean,
    ): { files: Map<string, F.CarriedFileEdit>; index?: F.CarriedIndexEdit } {
      let value = readCarryStorage(),
        entries = new Map<string, F.CarriedFileEdit>();
      for (let value3 of input) {
        let value4 = value.files[value3];
        if (value4 === undefined) {
          continue;
        }
        entries.set(value3, {
          text: value4.text,
          ...(value4.base !== undefined
            ? {
                base: value4.base,
              }
            : {}),
          ...(value4.baseText !== undefined
            ? {
                baseText: value4.baseText,
              }
            : {}),
        });
        delete value.files[value3];
      }
      let value2 =
        options2 && value.index !== undefined
          ? {
              base: value.index.base,
              mine: value.index.mine,
            }
          : undefined;
      if (options2) {
        delete value.index;
      }
      writeCarryStorage(value);
      return {
        files: entries,
        ...(value2 !== undefined
          ? {
              index: value2,
            }
          : {}),
      };
    }
    function clearCarriedFiles(input: readonly string[]): void {
      let value = readCarryStorage(),
        flag: boolean = false;
      for (let value2 of input) {
        if (value2 in value.files) {
          delete value.files[value2];
          flag = true;
        }
      }
      if (flag) {
        writeCarryStorage(value);
      }
    }
    function purgeCarryStorage(input: string): void {
      try {
        storage?.removeItem(carryStorageKey);
      } catch {}
      emit("carry-purged", {
        why: input,
      });
    }
    function flagClashingFile(
      input: string,
      options2: string,
      context: string | null | undefined,
      value?: string,
      extra?: string,
      detail = clashPolicy === "ask",
    ): void {
      if (options2 === "edit" && !detail && !flags.has(input)) {
        if (clashPolicy === "mine" && fileMatchesReadBase(input)) {
          queue.withdraw((0, runtime.projectFilePath)(input));
          refreshUnchangedLocalFile(
            input,
            (0, runtime.projectFilePath)(input),
            context !== undefined ? context : (liveSha(input) ?? null),
          );
          return;
        }
        if (fileMatchesCurrentPublish(input)) {
          queue.withdraw((0, runtime.projectFilePath)(input));
          keepOutOfUndo(input);
          takeRemoteFile(input);
          return;
        }
        if (clashPolicy === "mine") {
          keepMineAndRepublish(input, context);
          return;
        }
        if (!restoredStashPaths.has(input) && !fileSaveIsStuck(input)) {
          queue.withdraw((0, runtime.projectFilePath)(input));
          revertToTheirs(
            input,
            (0, runtime.projectFilePath)(input),
            context ?? null,
          );
          return;
        }
      }
      let entry = flags.get(input),
        value2 = extra ?? entry?.clash;
      flags.set(input, {
        path: input,
        why: entry?.why ?? options2,
        theirsSha: context,
        since: entry?.since ?? timers.now(),
        ...(value2 !== undefined
          ? {
              clash: value2,
            }
          : {}),
      });
      flaggedPaths.add(input);
      queue.withdraw((0, runtime.projectFilePath)(input));
      if (entry === undefined) {
        emit("flag", {
          path: (0, runtime.projectFilePath)(input),
          why: options2,
          theirs: context ?? null,
          ...(value2 !== undefined
            ? {
                clash: value2,
              }
            : {}),
        });
      }
      if (!noticedClashShas.has(input)) {
        noticedClashShas.set(input, context);
        notice(
          value ??
            (context === null
              ? "Someone else deleted " +
                (0, runtime.fileBaseName)(input) +
                " while you were editing it. Your version is kept here and was not saved." +
                runtime.FILE_CONFLICT_CHOICE_SUFFIX
              : "Someone else changed " +
                (0, runtime.fileBaseName)(input) +
                " while you were editing it. Your version is kept here and was not saved over theirs." +
                runtime.FILE_CONFLICT_CHOICE_SUFFIX),
        );
      }
      if (entry === undefined || entry.theirsSha !== context) {
        notifyFlags();
      }
    }
    function unflagFile(input: string): void {
      noticedClashShas.delete(input);
      clearCarriedFiles([input]);
      flaggedPaths.delete(input);
      if (flags.delete(input)) {
        notifyFlags();
      }
    }
    function keepMineAndRepublish(
      input: string,
      options2: string | null | undefined,
    ): void {
      let value: string = (0, runtime.projectFilePath)(input),
        value2 = options2 !== undefined ? options2 : liveSha(input);
      if (currentFileText(input) === null && value2 !== null) {
        queue.withdraw(value);
        keepOutOfUndo(input);
        takeRemoteFile(input);
        return;
      }
      document2.held().delete(value);
      for (let value3 of undoCommands) {
        value3.retoken(input);
      }
      markDirty(
        value,
        currentFileText(input) === null
          ? (): null => null
          : fileValueProvider(input),
        value2 ?? null,
      );
      emit("clash-mine", {
        path: value,
        theirs: value2 ?? null,
      });
      if (!isBusy()) {
        enhancedDocument.flushNow();
      }
    }
    let fileMatchesCurrentPublish = (input: string) => {
        let value = currentFileText(input);
        return (
          value !== null &&
          recentPublishes.get(input)?.text === value &&
          readTexts.get((0, runtime.projectFilePath)(input)) === value
        );
      },
      fileMatchesReadBase = (input: string) => {
        let value = currentFileText(input);
        return (
          value !== null &&
          readTexts.get((0, runtime.projectFilePath)(input)) === value
        );
      },
      restoredStashPaths: Set<string> = new Set(),
      fileSaveIsStuck = (input: string) =>
        queue
          .state()
          .stuck?.paths?.includes((0, runtime.projectFilePath)(input)) ===
          true || queue.unsendable().has((0, runtime.projectFilePath)(input)),
      remoteRevertPending: Set<string> = new Set(),
      remoteRevertTokens: Map<string, object> = new Map();
    function revertToTheirs(
      input: string,
      options2: string,
      context: string | null,
    ): void {
      if (remoteRevertPending.has(input)) {
        return;
      }
      remoteRevertPending.add(input);
      emit("conflict-reverted", {
        path: options2,
        theirs: context,
      });
      let callback = (): void => {
        if (document2.loadState() !== "live") {
          remoteRevertPending.delete(input);
          return;
        }
        if (isBusy()) {
          timers.setTimeout(callback, 500);
          return;
        }
        queue.withdraw(options2);
        let entry = readShas.get(options2);
        keepOutOfUndo(input);
        takeRemoteFile(input);
        let callback2 = (): boolean =>
            liveSha(input) === null
              ? currentFileText(input) === null
              : readShas.get(options2) !== entry,
          index: number = 0,
          callback3 = (): void => {
            if (!callback2() && index++ < 30) {
              timers.setTimeout(callback3, 100);
              return;
            }
            remoteRevertPending.delete(input);
            if (!callback2()) {
              advancePathRevision(input);
              flagClashingFile(
                input,
                "edit",
                context,
                undefined,
                undefined,
                true,
              );
              return;
            }
            advancePathRevision(input);
            if (flags.has(input)) {
              unflagFile(input);
            }
            pruneUndoPaths(new Set([input]), "took theirs", true);
            notice(
              (0, runtime.fileBaseName)(input) +
                (currentFileText(input) === null
                  ? " deleted remotely"
                  : " changed remotely"),
            );
          };
        callback3();
      };
      callback();
    }
    function refreshUnchangedLocalFile(
      input: string,
      options2: string,
      context: string | null,
    ): void {
      document2.held().delete(options2);
      if (!fileMatchesCurrentPublish(input)) {
        for (let value of undoCommands) {
          value.retoken(input);
        }
      }
      if (remoteRevertPending.has(input)) {
        return;
      }
      remoteRevertPending.add(input);
      emit("clash-nothing-mine", {
        path: options2,
        theirs: context,
      });
      let state = {};
      remoteRevertTokens.set(input, state);
      let callback = (): void => {
          if (remoteRevertTokens.get(input) === state) {
            remoteRevertTokens.delete(input);
            remoteRevertPending.delete(input);
          }
        },
        items = [1000, 3000, 1e4, 30000],
        index = 0,
        callback2 = async (): Promise<void> => {
          if (
            remoteRevertTokens.get(input) !== state ||
            disposed ||
            document2.loadState() !== "live" ||
            flags.has(input) ||
            !fileMatchesReadBase(input)
          ) {
            return callback();
          }
          if (isBusy()) {
            timers.setTimeout(() => void callback2(), 500);
            return;
          }
          if (readShas.get(options2) === liveSha(input)) {
            return callback();
          }
          let promise = new Promise<undefined>(
              (input2) => void timers.setTimeout(() => input2(undefined), 5000),
            ),
            value =
              liveSha(input) === null
                ? await null
                : await Promise.race([
                    (0, runtime.retryFileRead)(
                      () => options.port.readBytes(options2),
                      timers,
                    ).catch((): void => {
                      return;
                    }),
                    promise,
                  ]);
          if (
            remoteRevertTokens.get(input) !== state ||
            disposed ||
            document2.loadState() !== "live" ||
            flags.has(input) ||
            !fileMatchesReadBase(input)
          ) {
            return callback();
          }
          if (
            readShas.get(options2) === liveSha(input) ||
            (value !== undefined &&
              value !== null &&
              value.sha256 === readShas.get(options2))
          ) {
            return callback();
          }
          let value2 = liveSha(input),
            value3 =
              value !== undefined &&
              (value === null
                ? value2 !== null
                : value2 !== undefined && value2 !== value.sha256);
          if (value === undefined || value3) {
            let value4 = items[index];
            if (value4 === undefined) {
              return callback();
            }
            timers.setTimeout(() => void callback2(), value3 ? 0 : value4);
            index += 1;
            return;
          }
          if (isBusy()) {
            timers.setTimeout(() => void callback2(), 500);
            return;
          }
          callback();
          if (value !== null) {
            port.primeRead?.(options2, value);
          }
          keepOutOfUndo(input);
          takeRemoteFile(input);
          if (value === null) {
            readTexts.delete(options2);
            readShas.delete(options2);
            recentPublishes.delete(input);
          }
          advancePathRevision(input);
          pruneUndoPaths(new Set([input]), "took theirs");
        };
      callback2();
    }
    function resolveOrFlagClash(
      input: string,
      options2: string,
      context: string | null | undefined,
      value?: string,
    ): void {
      if (clashPolicy !== "mine" && restoredStashPaths.has(input)) {
        flagClashingFile(input, options2, context, value);
        return;
      }
      let entry = flags.get(input);
      if (
        !(0, runtime.isTokenFilePath)(input) ||
        context === null ||
        (entry !== undefined &&
          (entry.why !== "edit" || entry.clash !== undefined))
      ) {
        flagClashingFile(input, options2, context, value);
        return;
      }
      queue.withdraw((0, runtime.projectFilePath)(input));
      if (mergingTokenPaths.has(input)) {
        return;
      }
      mergingTokenPaths.add(input);
      notifyFlags();
      mergeClashingTokenFile(input, options2, context, value).catch(
        (): void => {
          mergingTokenPaths.delete(input);
          flagClashingFile(input, options2, context, value);
        },
      );
    }
    async function mergeClashingTokenFile(
      input: string,
      options2: string,
      context: string | null | undefined,
      value?: string,
    ): Promise<void> {
      let value2: string = (0, runtime.projectFilePath)(input),
        value3: Core.FileTextRead | undefined;
      try {
        value3 = await (0, runtime.retryFileRead)(
          () => options.port.readText(value2),
          timers,
        );
      } catch {
        value3 = undefined;
      }
      mergingTokenPaths.delete(input);
      let entry = readTexts.get(value2),
        entry2 = readShas.get(value2),
        value4 = currentFileText(input),
        entry3 = flags.get(input);
      if (
        value3 === undefined ||
        entry === undefined ||
        value4 === null ||
        (entry3 !== undefined &&
          (entry3.why !== "edit" || entry3.clash !== undefined))
      ) {
        flagClashingFile(input, options2, value3?.sha256 ?? context, value);
        return;
      }
      if (value3.sha256 === entry2) {
        if (context !== undefined && context !== value3.sha256) {
          flagClashingFile(input, options2, context, value);
          return;
        }
        if (flags.has(input)) {
          unflagFile(input);
        }
        markDirty(value2, fileValueProvider(input), value3.sha256);
        enhancedDocument.flushNow();
        notifyFlags();
        return;
      }
      let value5 = (0, runtime.mergeSupportedFileThreeWays)(
        input,
        entry,
        value4,
        value3.text,
      );
      if (
        clashPolicy === "mine" &&
        value5 !== null &&
        !value5.ok &&
        value5.why === "conflict"
      ) {
        let value6 = (0, runtime.mergeSupportedFileThreeWays)(
          input,
          entry,
          value3.text,
          value4,
          "theirs",
        );
        if (value6 !== null && value6.ok) {
          value5 = {
            ok: true,
            text: value6.text,
            kept: [],
          };
        }
      }
      if (value5 === null || !value5.ok) {
        let value6 =
          value5 !== null && value5.why === "conflict"
            ? (0, runtime.summarizeConflictNames)(value5.conflicts)
            : undefined;
        flagClashingFile(
          input,
          options2,
          value3.sha256,
          value6 !== undefined
            ? "You and someone else both changed " +
                value6 +
                " in " +
                (0, runtime.fileBaseName)(input) +
                ". Theirs was saved first; yours is kept here and was not saved over theirs." +
                runtime.FILE_CONFLICT_CHOICE_SUFFIX
            : value,
          value6,
        );
        return;
      }
      advancePathRevision(input);
      if (flags.has(input)) {
        unflagFile(input);
      }
      readTexts.set(value2, value3.text);
      readShas.set(value2, value3.sha256);
      if (
        (0, runtime.fileContentsSemanticallyEqual)(
          input,
          value5.text,
          value3.text,
        )
      ) {
        try {
          port.primeRead?.(value2, {
            bytes: encoder.encode(value3.text),
            sha256: value3.sha256,
            contentType:
              (0, runtime.publishableFileMimeType)(input, value3.text) ??
              "text/plain",
          });
        } catch {}
        queue.withdraw(value2);
        keepOutOfUndo(input);
        takeRemoteFile(input);
        emit("merged", {
          path: value2,
          theirs: value3.sha256,
          wrote: false,
          why: options2,
        });
        notifyFlags();
        return;
      }
      document2.held().delete(value2);
      replaceFileText(input, value5.text);
      markDirty(value2, fileValueProvider(input), value3.sha256);
      emit("merged", {
        path: value2,
        theirs: value3.sha256,
        wrote: true,
        why: options2,
      });
      enhancedDocument.flushNow();
      notifyFlags();
    }
    function healSimultaneousPublish(
      input: string,
      options2: string | null,
    ): void {
      let entry = recentPublishes.get(input);
      if (
        entry === undefined ||
        entry.healed === true ||
        options2 === null ||
        entry.sha === options2 ||
        timers.now() - entry.at > runtime.RECENT_PUBLISH_HEAL_WINDOW_MS ||
        entry.base === undefined
      ) {
        return;
      }
      let value = currentFileText(input);
      if (value === null || value === entry.text) {
        return;
      }
      recentPublishes.delete(input);
      if ((0, runtime.isTokenFilePath)(input)) {
        let value2 = (0, runtime.mergeSupportedFileThreeWays)(
          input,
          entry.base,
          entry.text,
          value,
          "theirs",
        );
        if (value2 === null || !value2.ok) {
          return;
        }
        let value3: boolean = !(0, runtime.fileContentsSemanticallyEqual)(
          input,
          value2.text,
          value,
        );
        if (value3) {
          let value4 = timers.now(),
            value5 = (recentHealTimes.get(input) ?? []).filter(
              (input2): boolean => value4 - input2 <= 60000,
            );
          if (value5.length >= 3) {
            value3 = false;
          } else {
            value5.push(value4);
            recentHealTimes.set(input, value5);
          }
        }
        if (value3) {
          emit("healed", {
            path: (0, runtime.projectFilePath)(input),
            theirs: options2,
            kept: value2.kept,
          });
          recentHeals.set(input, timers.now());
          replaceFileText(input, value2.text);
          enhancedDocument.flushNow();
        }
        if (
          clashPolicy !== "mine" &&
          value2.kept.length > 0 &&
          (value3 ||
            timers.now() - entry.at <= runtime.RECENT_PUBLISH_CLASH_NOTICE_MS)
        ) {
          notice(
            "Someone else saved " +
              (0, runtime.fileBaseName)(input) +
              " at the same moment as you. For " +
              (0, runtime.summarizeConflictNames)(value2.kept) +
              ", which you both changed, theirs is kept." +
              (value3 ? " Your other changes were put back." : ""),
          );
        }
        return;
      }
      if (
        clashPolicy === "mine" ||
        !(0, runtime.remoteTextLostLocalLines)(entry.base, entry.text, value)
      ) {
        return;
      }
      emit("overwritten", {
        path: (0, runtime.projectFilePath)(input),
        theirs: options2,
      });
      replaceFileText(input, entry.text);
      flagClashingFile(
        input,
        "overwritten",
        options2,
        "Someone else saved " +
          (0, runtime.fileBaseName)(input) +
          " at the same moment as you, and their version replaced yours. Yours is back here and is not saved." +
          runtime.FILE_CONFLICT_CHOICE_SUFFIX,
      );
    }
    let UNDO_INDEX_FIELDS: (keyof Core.FilesIndex)[] = [
        "libraries",
        "sections",
        "groups",
        "assetGroups",
        "blobs",
        "namespace",
      ],
      foreignIndexChanges: M.ForeignIndexChange[] = [],
      nextForeignChangeSeq: number = 0,
      pendingForeignIndexChanges: F.FileIndexDelta[] = [],
      lastIndexBase: Core.FilesIndex | undefined,
      publishingIndexBases: Core.FilesIndex[] = [];
    function recordForeignIndexChanges(input?: Core.FilesIndex): void {
      let value = document2.index().base();
      if (
        publishingIndexBases.some((input2) =>
          (0, runtime.mergeValuesEqual)(input2, value),
        )
      ) {
        lastIndexBase = (0, runtime.cloneMergeValue)(value);
        return;
      }
      if (input !== undefined) {
        let state: Partial<Core.FilesIndex> = {},
          state2: Partial<Core.FilesIndex> = {};
        for (let value2 of UNDO_INDEX_FIELDS) {
          if (!(0, runtime.mergeValuesEqual)(input[value2], value[value2])) {
            (
              state as Record<
                keyof Core.FilesIndex,
                Core.FilesIndex[keyof Core.FilesIndex]
              >
            )[value2] = (0, runtime.cloneMergeValue)(input[value2]);
            (
              state2 as Record<
                keyof Core.FilesIndex,
                Core.FilesIndex[keyof Core.FilesIndex]
              >
            )[value2] = (0, runtime.cloneMergeValue)(value[value2]);
          }
        }
        if (Object.keys(state2).length + Object.keys(state).length > 0) {
          pendingForeignIndexChanges.push({
            from: state,
            to: state2,
          });
        }
      }
      lastIndexBase = (0, runtime.cloneMergeValue)(value);
    }
    function flushForeignIndexChanges(): void {
      for (let value2 of pendingForeignIndexChanges.splice(0)) {
        foreignIndexChanges.push({
          ...value2,
          seq: nextForeignChangeSeq++,
        });
      }
      let value: number = foreignIndexChanges.length - 32;
      for (
        let index: number = 0;
        value > 0 && index < foreignIndexChanges.length;

      ) {
        let seq = foreignIndexChanges[index].seq;
        if (
          foreignIndexChanges.length <= 2000 &&
          undoCommands.some((input, options2) =>
            input.needsTheirs(seq, options2 === undoCommands.length - 1),
          )
        ) {
          index++;
          continue;
        }
        foreignIndexChanges.splice(index, 1);
        value--;
      }
    }
    let undoStack: F.FileMutationBatch | undefined,
      undoCommands: M.UndoCommand[] = [];
    function pruneUndoPaths(
      input: ReadonlySet<string>,
      options2: string,
      context = false,
    ): void {
      let index: number = 0,
        index2: number = 0;
      for (let value of undoCommands) {
        let value2 = value.dropPaths(input);
        if (value2 === "emptied") {
          index2++;
        } else if (value2 === "trimmed") {
          index++;
        }
      }
      if (index2 > 0) {
        undoStack?.prune(
          (input2) =>
            (0, runtime.supportsDroppedPaths)(input2 as M.UndoCommand) &&
            (input2 as M.UndoCommand).dropped,
        );
      }
      for (let value: number = undoCommands.length - 1; value >= 0; value--) {
        if (undoCommands[value].dropped) {
          undoCommands.splice(value, 1);
        }
      }
      if (index2 + index === 0) {
        return;
      }
      emit("undo-pruned", {
        paths: [...input].map(runtime.projectFilePath),
        why: options2,
        entriesDropped: index2,
        entriesTrimmed: index,
      });
      if (!context) {
        notice(
          "Someone else changed " +
            (0, runtime.summarizeFileNames)([...input]) +
            ", so your earlier edits to " +
            (input.size === 1 ? "it" : "them") +
            " can no longer be undone from here.",
        );
      }
    }
    function applyUndoDelta(
      input: F.FileMergeResult,
      options2: "undo" | "redo",
      context: string,
    ): void {
      let state = {
        label: context,
        files: input.files.map(runtime.projectFilePath),
        index: input.index,
        indexOnly: input.index && input.files.length === 0,
        localOnly: input.localOnly.map(runtime.projectFilePath),
        skipped: input.skipped.map(runtime.projectFilePath),
        indexKept: input.indexKept,
      };
      if (input.empty) {
        emit(options2, {
          ...state,
          nothing: true,
        });
        if (input.skipped.length + input.indexKept.length > 0) {
          notice(
            "Nothing to " +
              options2 +
              " there any more: " +
              [
                ...input.skipped.map(runtime.fileBaseName),
                ...(0, runtime.describeIndexConflicts)(
                  input.indexKept,
                  document2.index().get(),
                ),
              ].join(", ") +
              " changed since.",
          );
        }
        return;
      }
      let value = (0, runtime.refreshManifest)(
        {
          v: 2,
          files: (0, runtime.freezeSortedFileTable)(input.next),
        },
        document2.title(),
      );
      document2.setContent(value);
      for (let value2 of input.localOnly) {
        flagClashingFile(
          value2,
          "undo",
          liveSha(value2),
          "Someone else saved a newer " +
            (0, runtime.fileBaseName)(value2) +
            " since that step. Your " +
            options2 +
            " shows here but was not saved over theirs." +
            runtime.FILE_CONFLICT_CHOICE_SUFFIX,
        );
      }
      if (input.indexKept.length > 0) {
        notice(
          "Part of that " +
            options2 +
            " was left as it is because someone else changed it since: " +
            (0, runtime.describeIndexConflicts)(
              input.indexKept,
              document2.index().get(),
            ).join(", ") +
            ".",
        );
      }
      emit(options2, state);
      enhancedDocument.flushNow();
    }
    let mergeUndoTokenText = (
      input: string,
      options2: string,
      context: string,
      value: string,
    ) => {
      if (
        !(0, runtime.isTokenFilePath)(input) ||
        flags.has(input) ||
        document2.held().has((0, runtime.projectFilePath)(input))
      ) {
        return null;
      }
      let value2 = (0, runtime.mergeSupportedFileThreeWays)(
        input,
        options2,
        context,
        value,
      );
      if (value2 === null || !value2.ok) {
        return null;
      }
      if (
        (0, runtime.fileContentsSemanticallyEqual)(input, value2.text, value)
      ) {
        return value;
      } else {
        return value2.text;
      }
    };
    function createUndoCommand(
      input: string,
      options2: () => M.DocumentUndoPair,
      context: { applied?: boolean } = {},
    ) {
      let entries = new Map(pathRevisions),
        value: number = nextForeignChangeSeq,
        value2: number = nextForeignChangeSeq,
        value3: number = nextForeignChangeSeq,
        values = new Set<string>(),
        values2 = new Set<string>(),
        flag: boolean = false,
        value4: boolean = context.applied === true,
        callback = (input2: string) =>
          flags.has(input2) ||
          document2.held().has((0, runtime.projectFilePath)(input2)) ||
          (entries.get(input2) ?? 0) !== (pathRevisions.get(input2) ?? 0),
        callback2 = (input2: "undo" | "redo"): void => {
          let { before: value5, after: value6 } = options2(),
            value7 = input2 === "undo" ? value6 : value5,
            value8 = input2 === "undo" ? value5 : value6,
            value9 = foreignIndexChanges.filter(
              (input3) => input3.seq >= value && input3.seq < value2,
            ),
            value10 = foreignIndexChanges.filter(
              (input3) => input3.seq >= value2 && input3.seq < value3,
            ),
            callback3 = () =>
              value9.reduce(
                (input3: Core.FilesIndex, options3: F.FileIndexDelta) =>
                  (0, runtime.mergeFilesIndex)(
                    options3.from,
                    options3.to,
                    input3,
                  ).index,
                (0, runtime.buildFilesIndex)(document2.title(), value5.files),
              ),
            items = [
              ...value9,
              ...(value10.length > 0
                ? [
                    (0, runtime.indexUndoForeignChanges)(
                      value10,
                      values,
                      callback3(),
                    ),
                  ]
                : []),
            ];
          applyUndoDelta(
            (0, runtime.mergeDesignSystemFiles)(
              document2.content().files,
              document2.title(),
              value7.files,
              value8.files,
              {
                stale: callback,
                excluded: values2,
                merge: mergeUndoTokenText,
                theirIndex: items,
                earlierSide: input2 === "undo" ? "to" : "from",
              },
            ),
            input2,
            input,
          );
          entries = new Map(pathRevisions);
        },
        state: M.UndoCommand = {
          label: input,
          do(): void {
            if (!value4) {
              value4 = true;
              document2.setContent(options2().after);
              entries = new Map(pathRevisions);
              return;
            }
            callback2("redo");
          },
          undo(): void {
            callback2("undo");
          },
          touch(): void {
            entries = new Map(pathRevisions);
            value2 = nextForeignChangeSeq;
          },
          spanTheirs(input2, options3): void {
            if (flag) {
              return;
            }
            let { before: value5, after: value6 } = options2(),
              value7: Core.FilesIndex = (0, runtime.buildFilesIndex)(
                document2.title(),
                value6.files,
              ),
              value8: Core.FilesIndex = (0, runtime.buildFilesIndex)(
                document2.title(),
                value5.files,
              ),
              value9 = input2.filter((input3) => {
                let value10 = (0, runtime.indexPresentationField)(
                  options3,
                  input3,
                );
                return (
                  value10 !== undefined &&
                  (0, runtime.indexPresentationField)(value7, input3) ===
                    value10 &&
                  (0, runtime.indexPresentationField)(value8, input3) !==
                    value10
                );
              });
            if (value9.length > 0) {
              value3 = nextForeignChangeSeq;
              for (let value10 of value9) {
                values.add(value10);
              }
            }
          },
          needsTheirs: (input2, options3) =>
            !flag &&
            input2 >= value &&
            (options3 || input2 < Math.max(value2, value3)),
          retoken(input2): void {
            if (pathRevisions.has(input2)) {
              entries.set(input2, pathRevisions.get(input2)!);
            }
          },
          keepOut(input2): void {
            if (flag) {
              return;
            }
            let { before: value5, after: value6 } = options2();
            for (let value7 of input2) {
              if (value5.files[value7] === value6.files[value7]) {
                values2.add(value7);
              }
            }
          },
          dropPaths(input2): "untouched" | "emptied" | "trimmed" {
            if (flag) {
              return "untouched";
            }
            let { before: value5, after: value6 } = options2(),
              value7 = (0, runtime.changedProjectFilePaths)(
                value5.files,
                value6.files,
                document2.title(),
              ),
              flag2: boolean = false;
            for (let value8 of value7.files) {
              if (input2.has(value8) && !values2.has(value8)) {
                values2.add(value8);
                flag2 = true;
              }
            }
            if (!flag2) {
              return "untouched";
            }
            if (
              !value7.index &&
              value7.files.every((input3) => values2.has(input3))
            ) {
              flag = true;
              return "emptied";
            }
            return "trimmed";
          },
          get dropped(): boolean {
            return flag;
          },
          leavesAlone: (input2) => values2.has(input2),
        };
      undoCommands.push(state);
      if (undoCommands.length > 400) {
        undoCommands.splice(0, undoCommands.length - 400);
      }
      return state;
    }
    let lastGeneratedFiles: Core.FileTable | undefined,
      lastGeneratedTitle: string | undefined,
      generatedTexts: Map<string, string> = new Map(),
      damagedGeneratedPaths: Set<string> = new Set(),
      personChanged: boolean = false,
      generatedReadme: M.GeneratedReadme | undefined,
      generatedReadmeStopped: boolean = false,
      generatedReadmePending: boolean = false,
      generatedReadmeTexts: Set<string> = new Set(),
      generatedReadmeConflictCount = 0,
      recentGeneratedReadmeWrites: number[] = [],
      generatedReadmeTimer: ReturnType<typeof setTimeout> | undefined,
      scheduleReadmeRegeneration = (): void => {
        let value = timers.now();
        while (
          recentGeneratedReadmeWrites.length > 0 &&
          value - recentGeneratedReadmeWrites[0] > 60000
        ) {
          recentGeneratedReadmeWrites.shift();
        }
        if (
          recentGeneratedReadmeWrites.length >= 10 ||
          generatedReadmeTimer !== undefined
        ) {
          return;
        }
        recentGeneratedReadmeWrites.push(value);
        generatedReadmeTimer = timers.setTimeout((): void => {
          generatedReadmeTimer = undefined;
          lastGeneratedFiles = undefined;
          if (regenerate().length > 0) {
            queue.commit();
          }
        }, 1000);
      },
      readmeHeading = (): string =>
        "# " +
        (document2.title().replace(/\s+/g, " ").trim() || "Design system") +
        `
`;
    function ensureReactPreviewLibraries(): void {
      if (!(0, runtime.previewStaticNoticeSnapshot)()) {
        return;
      }
      let files = document2.content().files;
      if (files[runtime.DESIGN_SYSTEM_PATHS.bundleJs] === undefined) {
        return;
      }
      let value =
        (0, runtime.parseManifestBundleMetadata)(
          files[runtime.DESIGN_SYSTEM_PATHS.manifest] ?? "",
        ).libraries ?? [];
      if (
        value.some((input) =>
          runtime.REACT_LIBRARY_CATALOG.some(
            (input2): boolean => input2.name === input.name,
          ),
        )
      ) {
        return;
      }
      let value2 = (0, runtime.stringifyManifestWithinBudget)({
        ...(0, runtime.parseManifest)(
          files[runtime.DESIGN_SYSTEM_PATHS.manifest] ?? "",
        ),
        manifestVersion: runtime.DESIGN_SYSTEM_MANIFEST_VERSION,
        libraries: [
          ...runtime.REACT_LIBRARY_CATALOG.map((input) => ({
            name: input.name,
            version: "18",
          })),
          ...value,
        ],
      });
      document2.updateContent(
        (input) =>
          (0, runtime.refreshManifest)(
            {
              ...input,
              files: Object.freeze({
                ...input.files,
                [runtime.DESIGN_SYSTEM_PATHS.manifest]: value2,
              }),
            },
            document2.title(),
          ),
        {
          auto: true,
        },
      );
    }
    let generatedOwnership: Map<string, "ours" | "theirs" | number> = new Map(),
      foreignFileNoticePaths: Set<string> = new Set(),
      foreignFileNotices: M.ForeignFileNotice[] = [],
      ownershipProbeGeneration: number = 0,
      ownershipProbeChain: Promise<void> = Promise.resolve(),
      disposed: boolean = false,
      ownedFilesDiscovered: boolean = false,
      generatedRefreshOwed: boolean = false,
      ownershipRetryTimer: ReturnType<typeof setTimeout> | undefined,
      ownershipRetryAttempt: number = 0,
      ownershipProbeTimeoutMs: number = 1e4,
      ownershipRetryDelays: number[] = [2000, 5000, 15000, 30000, 60000, 60000],
      fileWasGeneratedByEditor = (input: string, options2: string) => {
        let value: string =
          (0, runtime.relativeProjectFilePath)(input) ?? input;
        if (value !== runtime.DESIGN_SYSTEM_PATHS.manifest) {
          return (0, runtime.hasGeneratedSystemHeader)(value, options2);
        }
        try {
          let value2: { manifestVersion?: unknown; files?: unknown } | null =
            JSON.parse(options2);
          return (
            value2 !== null &&
            typeof value2 === "object" &&
            !Array.isArray(value2) &&
            typeof value2.manifestVersion === "number" &&
            (value2.manifestVersion <= runtime.DESIGN_SYSTEM_MANIFEST_VERSION ||
              Array.isArray(value2.files))
          );
        } catch {
          return false;
        }
      },
      ownershipProbePending = () =>
        [...generatedOwnership.values()].some(
          (input): boolean => typeof input === "number",
        ),
      generatedWorkPending = () =>
        !disposed &&
        (ownershipProbePending() ||
          ownedFilesDiscovered ||
          generatedRefreshOwed ||
          ownershipRetryTimer !== undefined),
      generatedPendingNotified = false,
      notifyGeneratedPending = (): void => {
        let value = generatedWorkPending();
        if (value === generatedPendingNotified) {
          return;
        }
        generatedPendingNotified = value;
        let value2 = enhancedDocument.saveState();
        for (let value3 of [...saveSubscribers]) {
          try {
            value3(value2);
          } catch {}
        }
      },
      announceForeignFiles = (): void => {
        let value = foreignFileNotices;
        foreignFileNotices = [];
        for (let value2 of ["write", "remove"]) {
          let value3 = value
            .filter((input): boolean => input.wanted === value2)
            .map((input) => input.name);
          if (value3.length === 0) {
            continue;
          }
          (0, runtime.reportMigrationAnalytics)(
            runtime.MIGRATION_ANALYTICS_EVENTS.foreignFilesNoticed,
          );
          let value4: boolean = value3.length === 1;
          notice(
            (0, runtime.summarizeFileNames)(value3) +
              (value4
                ? " in this system was not made by this editor, so it is left as it is"
                : " in this system were not made by this editor, so they are left as they are") +
              (value2 === "write"
                ? value4
                  ? "; changes you make here are not written to it."
                  : "; changes you make here are not written to them."
                : "."),
          );
        }
      },
      finishOwnershipProbe = (): void => {
        if (disposed) {
          return;
        }
        if (!ownershipProbePending()) {
          if (foreignFileNotices.length > 0) {
            announceForeignFiles();
          }
          if (ownedFilesDiscovered) {
            ownedFilesDiscovered = false;
            generatedRefreshOwed = true;
            lastGeneratedFiles = undefined;
            scheduleGeneratedRetry();
          }
        }
        notifyGeneratedPending();
      },
      ownershipFailureNoticed: boolean = false,
      scheduleOwnershipRetry = (): void => {
        if (disposed || ownershipRetryTimer !== undefined) {
          return;
        }
        if (ownershipRetryAttempt >= ownershipRetryDelays.length) {
          if (!ownershipFailureNoticed) {
            ownershipFailureNoticed = true;
            notice(
              "The files this editor makes from your content (tokens.css, the cards under api/, manifest.json) could not all be checked against what is published, so some may not have been updated. The editor checks again the next time you change something.",
            );
          }
          return;
        }
        ownershipRetryTimer = timers.setTimeout((): void => {
          ownershipRetryTimer = undefined;
          lastGeneratedFiles = undefined;
          regenerate();
          if (queue.state().dirty > 0) {
            queue.commit();
          }
          finishOwnershipProbe();
        }, ownershipRetryDelays[ownershipRetryAttempt++]);
      },
      recordForeignFile = (input: string, options2: string): void => {
        generatedOwnership.set(input, "theirs");
        if (!foreignFileNoticePaths.has(input)) {
          foreignFileNoticePaths.add(input);
          foreignFileNotices.push({
            name: (0, runtime.relativeProjectFilePath)(input) ?? input,
            wanted: options2,
          });
        }
      },
      withOwnershipDeadline = <Value>(input: Promise<Value>): Promise<Value> =>
        new Promise<Value>((input2, options2): void => {
          let value = timers.setTimeout(
            () =>
              options2({
                code: "deadline",
              }),
            ownershipProbeTimeoutMs,
          );
          input.then(
            (input3): void => {
              timers.clearTimeout(value);
              input2(input3);
            },
            (input3: unknown): void => {
              timers.clearTimeout(value);
              options2(input3);
            },
          );
        });
    function canGenerateFile(
      input: string,
      options2: "write" | "remove",
    ): boolean {
      if (port.liveSha?.(input) === null) {
        return true;
      }
      let entry = generatedOwnership.get(input);
      if (entry !== undefined) {
        return entry === "ours";
      }
      let peekBytes = port.peekBytes;
      if (peekBytes === undefined) {
        recordForeignFile(input, options2);
        ownershipProbeChain.then(finishOwnershipProbe);
        return false;
      }
      let value = ++ownershipProbeGeneration;
      generatedOwnership.set(input, value);
      ownershipProbeChain = ownershipProbeChain
        .then(() =>
          withOwnershipDeadline(
            (0, runtime.retryFileRead)(() => peekBytes(input), timers),
          ),
        )
        .then(
          (input2): string =>
            fileWasGeneratedByEditor(
              input,
              new TextDecoder().decode(input2.bytes),
            )
              ? "ours"
              : "theirs",
          (input2: { code?: string } | undefined): string | undefined =>
            input2?.code === "not_found" &&
            typeof port.liveSha?.(input) !== "string"
              ? "ours"
              : undefined,
        )
        .then((input2) => {
          if (disposed || generatedOwnership.get(input) !== value) {
            return finishOwnershipProbe();
          }
          if (input2 === undefined) {
            generatedOwnership.delete(input);
            scheduleOwnershipRetry();
          } else if (((ownershipRetryAttempt = 0), input2 === "theirs")) {
            recordForeignFile(input, options2);
          } else {
            generatedOwnership.set(input, "ours");
            ownedFilesDiscovered = true;
          }
          finishOwnershipProbe();
        })
        .catch((): void => {
          if (generatedOwnership.get(input) === value) {
            generatedOwnership.delete(input);
            scheduleOwnershipRetry();
          }
          finishOwnershipProbe();
        });
      notifyGeneratedPending();
      return false;
    }
    let settleOwnershipProbes = async (): Promise<void> => {
      for (let index: number = 0; index < 4 && !disposed; index++) {
        await ownershipProbeChain;
        if (ownedFilesDiscovered || generatedRefreshOwed) {
          ownedFilesDiscovered = false;
          generatedRefreshOwed = false;
          if (generatedRetryTimer !== undefined) {
            timers.clearTimeout(generatedRetryTimer);
            generatedRetryTimer = undefined;
          }
          lastGeneratedFiles = undefined;
          regenerate();
          if (queue.state().dirty > 0) {
            queue.commit();
          }
        }
        notifyGeneratedPending();
        if (!ownershipProbePending()) {
          return;
        }
      }
    };
    function regenerate(): string[] {
      if (
        options.generated !== true ||
        !personChanged ||
        document2.readOnly() ||
        document2.loadState() !== "live" ||
        flags.size > 0
      ) {
        return [];
      }
      ensureReactPreviewLibraries();
      let files = document2.content().files;
      if (
        files === lastGeneratedFiles &&
        document2.title() === lastGeneratedTitle
      ) {
        return [];
      }
      lastGeneratedFiles = files;
      lastGeneratedTitle = document2.title();
      let items: string[] = [],
        value: Map<string, string> = (0, runtime.validDerivedProjectFiles)(
          files,
        );
      for (let [value4, value5] of value) {
        if (generatedTexts.get(value4) === value5) {
          continue;
        }
        if (port.liveSha?.(value4) === (0, runtime.sha256Sync)(value5)) {
          generatedTexts.set(value4, value5);
          continue;
        }
        if (!canGenerateFile(value4, "write")) {
          continue;
        }
        generatedTexts.set(value4, value5);
        queue.markDirty(value4, () => value5);
        items.push(value4);
      }
      let values = new Set<string>(
          (0, runtime.damagedDerivedProjectPaths)(files),
        ),
        value2 = [...values].filter(
          (input): boolean => !damagedGeneratedPaths.has(input),
        );
      for (let value4 of damagedGeneratedPaths) {
        if (!values.has(value4)) {
          damagedGeneratedPaths.delete(value4);
        }
      }
      for (let value4 of value2) {
        damagedGeneratedPaths.add(value4);
      }
      if (value2.length > 0) {
        let value4: boolean = value2.length === 1,
          value5 = value2.some(
            (input): boolean => typeof port.liveSha?.(input) === "string",
          );
        notice(
          (0, runtime.summarizeFileNames)(
            value2.map(
              (input) => (0, runtime.relativeProjectFilePath)(input) ?? input,
            ),
          ) +
            (value4 ? " is" : " are") +
            " not being updated. Find the " +
            runtime.DAMAGED_FILE_REPLACEMENT_CHARACTER +
            " in your tokens, names, notes or READMEs and type it again." +
            (value5 ? " What is published stays as it is until then." : ""),
        );
      }
      let value3 = port.knownListing?.();
      for (let value4 of new Set([
        ...generatedTexts.keys(),
        ...(value3 !== undefined
          ? [...value3.keys()].filter(runtime.isDerivedProjectPath)
          : []),
      ])) {
        if (value.has(value4) || values.has(value4)) {
          continue;
        }
        generatedTexts.delete(value4);
        if (port.liveSha?.(value4) === null) {
          continue;
        }
        if (!canGenerateFile(value4, "remove")) {
          continue;
        }
        queue.markDirty(value4, (): null => null);
        items.push(value4);
      }
      updateReadmeTail(files, items);
      generateMissingReadme(files, items);
      if (items.length > 0) {
        emit("generated", {
          paths: items,
        });
      }
      return items;
    }
    let projectReadmePath: string = (0, runtime.projectFilePath)(
        runtime.DESIGN_SYSTEM_PATHS.readme,
      ),
      CONSUMER_PROJECT_PATH_HINT: string =
        "Every path named below is under `project/` in this design system: read `project/api/tokens.md`, not `api/tokens.md`.",
      wireReadme = (input: string): string => {
        let value = (0, runtime.generatedReadmeTail)(
          (0, runtime.generatedConsumptionReadme)(
            Object.freeze({
              ...document2.content().files,
              [runtime.DESIGN_SYSTEM_PATHS.readme]: input,
            }),
            runtime.PROJECT_FILE_PREFIXEditorFilesIndex,
          ),
        );
        return (0, runtime.mergeReadmeWithGeneratedTail)(
          input,
          value.replace(
            /^(## Consuming this system[^\n]*\n)/,
            `$1
` +
              CONSUMER_PROJECT_PATH_HINT +
              `
`,
          ),
        );
      },
      lastWireReadme: string | undefined,
      readmeTailPending: boolean = false;
    function updateReadmeTail(input: Core.FileTable, items: string[]): void {
      let value = input[runtime.DESIGN_SYSTEM_PATHS.readme];
      if (
        items.length === 0 ||
        typeof value !== "string" ||
        flags.has(runtime.DESIGN_SYSTEM_PATHS.readme) ||
        mergingTokenPaths.has(runtime.DESIGN_SYSTEM_PATHS.readme) ||
        readTexts.get(projectReadmePath) !== value
      ) {
        return;
      }
      let value2 = wireReadme(value);
      if (value2 === lastWireReadme) {
        return;
      }
      let value3 = port.liveSha?.(projectReadmePath);
      if (
        typeof value3 === "string" &&
        value3 !== readShas.get(projectReadmePath)
      ) {
        return;
      }
      lastWireReadme = value2;
      if (
        value3 === undefined ||
        value3 === null ||
        value3 === (0, runtime.sha256Sync)(value2)
      ) {
        return;
      }
      readmeTailPending = true;
      queue.markDirty(
        projectReadmePath,
        fileValueProvider(runtime.DESIGN_SYSTEM_PATHS.readme),
      );
      items.push(projectReadmePath);
    }
    function generateMissingReadme(
      input: Core.FileTable,
      options2: string[],
    ): void {
      if (input[runtime.DESIGN_SYSTEM_PATHS.readme] !== undefined) {
        generatedReadme = undefined;
        return;
      }
      if (generatedReadmeStopped) {
        return;
      }
      let value = port.liveSha?.(projectReadmePath),
        value2 = readmeHeading(),
        value3 = wireReadme(value2),
        value4: boolean = value === null,
        value5 =
          value !== undefined ? value : port.heldSha?.(projectReadmePath),
        value6 =
          generatedReadme?.sha !== undefined &&
          value5 === generatedReadme.sha &&
          (value2 !== generatedReadme.text || value3 !== generatedReadme.wire);
      if (!value4 && !value6) {
        return;
      }
      let value7 = value4 ? null : generatedReadme!.sha;
      generatedReadme = {
        text: value2,
        wire: value3,
        ...(value4
          ? {}
          : {
              sha: value7,
            }),
      };
      generatedReadmeTexts.add(value2);
      generatedReadmePending = true;
      markDirty(projectReadmePath, () => value2, value7);
      options2.push(projectReadmePath);
    }
    async function writeReadmeTail(): Promise<boolean> {
      if (
        options.generated !== true ||
        document2.readOnly() ||
        document2.loadState() !== "live"
      ) {
        return false;
      }
      let value = document2.content().files[runtime.DESIGN_SYSTEM_PATHS.readme];
      if (
        typeof value !== "string" ||
        flags.has(runtime.DESIGN_SYSTEM_PATHS.readme) ||
        mergingTokenPaths.has(runtime.DESIGN_SYSTEM_PATHS.readme) ||
        readTexts.get(projectReadmePath) !== value
      ) {
        return false;
      }
      let value2 = wireReadme(value),
        value3 = port.liveSha?.(projectReadmePath);
      if (
        value3 === undefined ||
        value3 === null ||
        value3 === (0, runtime.sha256Sync)(value2) ||
        (0, runtime.fileContentContainsRuntimeMarkers)(value2)
      ) {
        return false;
      }
      let value4 = await options.port
        .readText(projectReadmePath)
        .catch((): null => null);
      if (
        value4 === null ||
        value4.text.includes("## Consuming this system") ||
        document2.readOnly() ||
        readTexts.get(projectReadmePath) !== value
      ) {
        return false;
      }
      lastWireReadme = value2;
      readmeTailPending = true;
      queue.markDirty(
        projectReadmePath,
        fileValueProvider(runtime.DESIGN_SYSTEM_PATHS.readme),
      );
      emit("generated", {
        paths: [projectReadmePath],
      });
      return true;
    }
    let regenerationTimer: ReturnType<typeof setTimeout> | undefined,
      generatedRetryTimer: ReturnType<typeof setTimeout> | undefined,
      generatedRetryTimes: number[] = [],
      scheduleGeneratedRetry = (): void => {
        if (generatedRetryTimer !== undefined) {
          return;
        }
        let callback = (): void => {
          generatedRetryTimer = undefined;
          let value = timers.now();
          while (
            generatedRetryTimes.length > 0 &&
            value - generatedRetryTimes[0] > 60000
          ) {
            generatedRetryTimes.shift();
          }
          if (generatedRetryTimes.length >= 3) {
            if (generatedRefreshOwed) {
              generatedRetryTimer = timers.setTimeout(
                callback,
                60000 - (value - generatedRetryTimes[0]) + 100,
              );
            }
            return;
          }
          generatedRefreshOwed = false;
          regenerate();
          if (queue.state().dirty > 0) {
            generatedRetryTimes.push(value);
            queue.commit();
          }
          notifyGeneratedPending();
        };
        generatedRetryTimer = timers.setTimeout(callback, 1000);
      },
      flaggedRestoreEdits: Map<string, F.CarriedFileEdit> = new Map(),
      restoreConsumed: boolean = false,
      lateRemovalNoticePaths: Set<string> = new Set(),
      tablePort: M.DesignSystemTablePort = (0,
      runtime.createDesignSystemFilesPort)(options.port, {
        ...(lazy !== undefined
          ? {
              lazy: lazy,
            }
          : {}),
        wireText: (input: string, options2: string) =>
          input === projectReadmePath && options.generated === true
            ? wireReadme(options2)
            : options2,
        tableText: (input: string, options2: string) =>
          input === projectReadmePath
            ? (0, runtime.stripGeneratedReadmeTail)(options2)
            : options2,
        onReadText(input: string, options2: string, context: string): void {
          let value: string | undefined = (0, runtime.relativeProjectFilePath)(
            input,
          );
          if (value === undefined) {
            return;
          }
          let entry = readTexts.get(input);
          if (
            document2.loadState() === "live" &&
            !preReadBases.has(input) &&
            readShas.get(input) !== context &&
            heldText(value) !== options2
          ) {
            preReadBases.set(input, {
              sha: readShas.get(input) ?? null,
              text: entry,
            });
          }
          readShas.set(input, context);
          if ((0, runtime.isHeldFilePointer)(value, options2)) {
            readTexts.delete(input);
          } else {
            readTexts.set(input, options2);
          }
          let value2 = heldText(value);
          if (
            document2.loadState() === "live" &&
            value2 !== options2 &&
            value2 === entry &&
            !locallyHeldTexts.has(input)
          ) {
            locallyHeldTexts.set(input, value2);
          }
        },
        onDownloadsRefused(): void {
          timers.setTimeout(
            () =>
              void document2.save().catch((): void => {
                return;
              }),
            0,
          );
        },
        onSend(input: Record<string, Core.FilePublishInput>): void {
          let value = input[indexPath];
          if (typeof value !== "string") {
            return;
          }
          publishingIndexFieldRevisions = new Map(localIndexFieldRevisions);
          try {
            publishingIndexBases.push(JSON.parse(value));
            if (publishingIndexBases.length > 4) {
              publishingIndexBases.shift();
            }
          } catch {}
        },
        onPublish(input: M.FilePublishReport): void {
          if (
            input.ok &&
            input.paths.length > 0 &&
            typeof input.version === "string" &&
            input.version !== "" &&
            options.port.version().version === input.version
          ) {
            recordVersion(input.version);
          }
          let value = input.texts?.[projectReadmePath],
            value2 =
              input.paths.includes(projectReadmePath) &&
              currentFileText(runtime.DESIGN_SYSTEM_PATHS.readme) === null &&
              generatedReadme !== undefined &&
              (value === undefined
                ? generatedReadmePending
                : typeof value === "string" && generatedReadmeTexts.has(value));
          if (
            input.paths.includes(projectReadmePath) &&
            (value === undefined ||
              generatedReadme === undefined ||
              value === generatedReadme.text)
          ) {
            generatedReadmePending = false;
          }
          if (input.ok && generatedReadme !== undefined && value2) {
            let value6 = input.texts?.[projectReadmePath],
              value7 = port.liveSha?.(projectReadmePath);
            if (typeof value6 === "string" && typeof value7 === "string") {
              generatedReadme = {
                text: value6,
                wire: wireReadme(value6),
                sha: value7,
              };
              if (value6 !== readmeHeading()) {
                scheduleReadmeRegeneration();
              }
            }
          }
          if (
            !input.ok &&
            input.code === "conflict" &&
            generatedReadme !== undefined &&
            value2
          ) {
            let value6: boolean = generatedReadme.sha !== undefined;
            generatedReadme = undefined;
            queue.withdraw(projectReadmePath);
            generatedReadmeConflictCount += 1;
            if (
              value6 ||
              port.liveSha?.(projectReadmePath) !== null ||
              generatedReadmeConflictCount >= 2
            ) {
              generatedReadmeStopped = true;
            }
          }
          if (input.ok && typeof input.texts?.[indexPath] === "string") {
            try {
              lastIndexBase = JSON.parse(input.texts[indexPath]);
            } catch {}
          }
          if (input.paths.includes(indexPath)) {
            publishingIndexBases.length = 0;
          }
          if (input.ok && input.paths.includes(indexPath)) {
            for (let [value6, value7] of publishingIndexFieldRevisions) {
              if (localIndexFieldRevisions.get(value6) === value7) {
                localIndexFieldRevisions.delete(value6);
              }
            }
          }
          if (input.ok && input.texts !== undefined) {
            for (let [value6, value7] of Object.entries(input.texts)) {
              let value8: string | undefined = (0,
              runtime.relativeProjectFilePath)(value6);
              if (
                value8 === undefined ||
                (0, runtime.isDerivedProjectPath)(value6)
              ) {
                continue;
              }
              if (value6 === projectReadmePath && value7 !== null && value2) {
                readTexts.delete(value6);
                readShas.delete(value6);
                recentPublishes.delete(value8);
                continue;
              }
              if (
                value6 === projectReadmePath &&
                value7 === null &&
                currentFileText(runtime.DESIGN_SYSTEM_PATHS.readme) === null
              ) {
                scheduleReadmeRegeneration();
              }
              let value9 = input.shas?.[value6];
              if (value6 === projectReadmePath) {
                readmeTailPending = false;
              }
              restoredStashPaths.delete(value8);
              preReadBases.delete(value6);
              if (value7 === null) {
                readTexts.delete(value6);
                readShas.delete(value6);
                recentPublishes.delete(value8);
                continue;
              }
              recentPublishes.set(value8, {
                at: timers.now(),
                text: value7,
                base: readTexts.get(value6),
                sha: value9,
                ...(consumeRecentHeal(value8)
                  ? {
                      healed: true,
                    }
                  : {}),
              });
              readTexts.set(value6, value7);
              if (value9 !== undefined) {
                readShas.set(value6, value9);
              } else {
                readShas.delete(value6);
              }
            }
          }
          if (input.ok) {
            for (let value6 of input.paths) {
              if ((0, runtime.isDerivedProjectPath)(value6)) {
                if (input.texts !== undefined && input.texts[value6] === null) {
                  generatedOwnership.delete(value6);
                } else {
                  generatedOwnership.set(value6, "ours");
                }
              }
            }
          }
          let value3 = input.paths.includes(indexPath),
            value4 = input.paths.filter(runtime.isDerivedProjectPath),
            value5 = input.paths.filter(
              (input2) =>
                input2 !== indexPath &&
                !(0, runtime.isDerivedProjectPath)(input2),
            );
          emit("save", {
            ok: input.ok,
            ...(input.code !== undefined
              ? {
                  code: input.code,
                }
              : {}),
            ...(input.version !== undefined
              ? {
                  version: input.version,
                }
              : {}),
            files: value5,
            generated: value4,
            index: value3,
            indexOnly: value3 && value5.length === 0 && value4.length === 0,
          });
        },
      }),
      document2: M.BaseFilesDocument = (0, runtime.createFilesDocument)({
        codec: (0, runtime.designSystemFilesCodec)(indexPath, lazy),
        ...(options.startWhenNoIndex !== undefined
          ? {
              startWhenNoIndex: options.startWhenNoIndex,
            }
          : {}),
        parseContent: options.parseContent,
        initialContent: options.initialContent,
        ...(options.defaultTitle !== undefined
          ? {
              defaultTitle: options.defaultTitle,
            }
          : {}),
        port: tablePort,
        ...(options.readOnlyReason !== undefined
          ? {
              readOnlyReason: options.readOnlyReason,
            }
          : {}),
        ...(options.onNotice !== undefined
          ? {
              onNotice: options.onNotice,
            }
          : {}),
        onConflict(input: F.FileSaveConflict): void {
          if ((0, runtime.isDerivedProjectPath)(input.path)) {
            generatedOwnership.delete(input.path);
            queue.withdraw(input.path);
            generatedTexts.delete(input.path);
            lastGeneratedFiles = undefined;
            emit("generated-behind", {
              path: input.path,
            });
            scheduleGeneratedRetry();
            return;
          }
          if (
            input.path === projectReadmePath &&
            readmeTailPending &&
            currentFileText(runtime.DESIGN_SYSTEM_PATHS.readme) ===
              readTexts.get(projectReadmePath)
          ) {
            readmeTailPending = false;
            lastWireReadme = undefined;
            queue.withdraw(input.path);
            lastGeneratedFiles = undefined;
            emit("generated-behind", {
              path: input.path,
            });
            if (clashPolicy === "mine") {
              refreshUnchangedLocalFile(
                runtime.DESIGN_SYSTEM_PATHS.readme,
                input.path,
                input.theirsSha,
              );
            }
            scheduleGeneratedRetry();
            return;
          }
          let value: string =
            (0, runtime.relativeProjectFilePath)(input.path) ?? input.path;
          advancePathRevision(value);
          resolveOrFlagClash(value, "edit", input.theirsSha);
        },
        onRemoteApplied(
          input: F.FilesRemoteAppliedRow[],
          options2: Core.FileRemoteChange,
        ): void {
          if (
            typeof options2.to.version === "string" &&
            options2.to.version !== ""
          ) {
            recordVersion(options2.to.version);
          }
          let value = [...lateRemovalNoticePaths].filter((input2) =>
            input.some(
              (input3) =>
                input3.decision === "removed" &&
                (0, runtime.relativeProjectFilePath)(input3.path) === input2,
            ),
          );
          lateRemovalNoticePaths.clear();
          if (value.length > 0) {
            emit("restore-landed-late", {
              paths: value.map(runtime.projectFilePath),
            });
            notice(
              "The page said a moment ago that your rename or removal of " +
                (0, runtime.summarizeFileNames)(value) +
                " did not go through. It did: it had already been sent when the page reloaded, and it has been saved now. There is nothing to do again.",
            );
          }
          let values = new Set<string>(),
            values2 = new Set<string>();
          for (let value2 of input) {
            emit("rebase", {
              path: value2.path,
              decision: value2.decision,
              sha: value2.sha256,
              from: options2.from.version,
              to: options2.to.version,
            });
            if (
              (0, runtime.isDerivedProjectPath)(value2.path) &&
              !(
                generatedOwnership.get(value2.path) === "ours" &&
                value2.sha256 !== null &&
                port.heldSha?.(value2.path) === value2.sha256
              )
            ) {
              generatedOwnership.delete(value2.path);
            }
            let value3: string | undefined = (0,
            runtime.relativeProjectFilePath)(value2.path);
            if (
              value3 === undefined ||
              value2.decision === "ignored" ||
              value2.decision === "index"
            ) {
              continue;
            }
            if (value2.path === projectReadmePath) {
              generatedReadme = undefined;
            }
            advancePathRevision(value3);
            values2.add(value3);
            if (value2.decision === "held") {
              resolveOrFlagClash(value3, "edit", value2.sha256);
              continue;
            }
            if (!(0, runtime.isTokenFilePath)(value3)) {
              values.add(value3);
            }
            if (flags.has(value3)) {
              unflagFile(value3);
            }
            if (value2.decision === "removed") {
              readTexts.delete(value2.path);
              readShas.delete(value2.path);
              recentPublishes.delete(value3);
            } else {
              healSimultaneousPublish(value3, value2.sha256);
            }
          }
          if (input.some((input2): boolean => input2.decision === "index")) {
            recordForeignIndexChanges(lastIndexBase);
          }
          flushForeignIndexChanges();
          if (values2.size > 0) {
            for (let value2 of undoCommands) {
              value2.keepOut(values2);
            }
          }
          if (values.size > 0) {
            pruneUndoPaths(values, "adopted");
          }
        },
        onIndexMerged(input: F.IndexMergeNotice): void {
          recordForeignIndexChanges(input.base);
          if (input.conflicts.length > 0) {
            flushForeignIndexChanges();
          }
          let value = (0, runtime.authoredIndexMergeConflicts)(input);
          emit("index-merged", {
            conflicts: input.conflicts,
            lost: value,
          });
          let value2 =
              clashPolicy === "mine" ? keepMineIndexPresentation(input) : [],
            value3 = value.filter(
              (input2): boolean => !value2.includes(input2),
            );
          if (value3.length > 0) {
            notice(
              "Someone else changed " +
                (0, runtime.describeIndexConflicts)(value3, input.merged).join(
                  ", ",
                ) +
                " at the same time as you. Theirs was saved first, so theirs was kept.",
            );
          }
          let value4 = document2.index(),
            value5 = (0, runtime.invalidAssetGroupOrders)(
              value4.get(),
              (input2) => {
                let value6: string = "assets/" + input2 + "/",
                  values = new Set<string>();
                for (let value7 of Object.keys(document2.content().files)) {
                  if (
                    value7.startsWith(value6) &&
                    !(document2.content().files[value7] ?? "").startsWith(
                      "blob:",
                    )
                  ) {
                    values.add(value7.slice(value6.length));
                  }
                }
                return values;
              },
            );
          if (Object.keys(value5).length > 0) {
            value4.update((input2): void => {
              for (let [value6, value7] of Object.entries(value5)) {
                let value8 = input2.assetGroups?.[value6];
                if (value8 !== undefined) {
                  value8.order = value7;
                }
              }
            });
            emit("index-orders", {
              groups: Object.keys(value5),
            });
          }
        },
        isBusy: isBusy,
        snapshot: (input) =>
          snapshotHotCarry(input as { handoff?: boolean } | undefined),
        restore: (input) =>
          restoreHotCarry(input as M.RawHotCarry | null | undefined),
        ...(options.hot !== undefined
          ? {
              hot: options.hot,
            }
          : {}),
        ...(options.timers !== undefined
          ? {
              timers: options.timers,
            }
          : {}),
        ...(options.commitMs !== undefined
          ? {
              commitMs: options.commitMs,
            }
          : {}),
        ...(options.early !== undefined
          ? {
              early: options.early,
            }
          : {}),
        ...(options.onHotEvent !== undefined
          ? {
              onHotEvent: options.onHotEvent,
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
        ...(options.saveStash !== undefined
          ? {
              saveStash: (0, runtime.prioritizeStashedTextEdits)(
                (0, runtime.stripEditingOffFromStashedIndex)(
                  options.saveStash,
                  indexPath,
                ),
              ),
            }
          : {}),
        ...(options.paced !== undefined
          ? {
              paced: options.paced,
            }
          : {}),
        peers: runtime.EMPTY_FILES_PEER_SOURCE,
      }) as M.BaseFilesDocument,
      localIndexFieldRevisions: Map<string, number> = new Map(),
      publishingIndexFieldRevisions: Map<string, number> = new Map(),
      indexFieldRevision: number = 0,
      indexFieldSnapshot: M.IndexFieldSnapshot | undefined,
      trackLocalIndexChanges = (input?: boolean): void => {
        let files = document2.content().files,
          value = document2.title(),
          value2 = files[runtime.DESIGN_SYSTEM_PATHS.manifest];
        if (
          indexFieldSnapshot !== undefined &&
          indexFieldSnapshot.title === value &&
          indexFieldSnapshot.manifest === value2
        ) {
          return;
        }
        let value3: Core.FilesIndex = (0, runtime.buildFilesIndex)(
          value,
          files,
        );
        if (!input && indexFieldSnapshot !== undefined) {
          let ix2 = indexFieldSnapshot.ix;
          if (ix2.title !== value3.title) {
            localIndexFieldRevisions.set("title", ++indexFieldRevision);
          }
          for (let value4 of new Set([
            ...Object.keys(ix2.sections ?? {}),
            ...Object.keys(value3.sections ?? {}),
          ])) {
            if (ix2.sections?.[value4] !== value3.sections?.[value4]) {
              localIndexFieldRevisions.set(
                "sections/" + value4,
                ++indexFieldRevision,
              );
            }
          }
          for (let value4 of new Set([
            ...Object.keys(ix2.assetGroups ?? {}),
            ...Object.keys(value3.assetGroups ?? {}),
          ])) {
            if (
              ix2.assetGroups?.[value4]?.tile !==
              value3.assetGroups?.[value4]?.tile
            ) {
              localIndexFieldRevisions.set(
                "assetGroups/" + value4 + "/tile",
                ++indexFieldRevision,
              );
            }
          }
        }
        indexFieldSnapshot = {
          title: value,
          manifest: value2,
          ix: value3,
        };
      };
    function keepMineIndexPresentation(input: F.IndexMergeNotice): string[] {
      let value: Core.FilesIndex = (0, runtime.buildFilesIndex)(
          document2.title(),
          document2.content().files,
          input.merged,
        ),
        items: string[] = [];
      document2.index().update((input2): void => {
        for (let value2 of input.conflicts) {
          if (!localIndexFieldRevisions.has(value2)) {
            continue;
          }
          if (value2 === "title") {
            input2.title = value.title;
            items.push(value2);
            continue;
          }
          if (value2.startsWith("sections/")) {
            let value6 = value2.slice(9),
              value7 = value.sections?.[value6];
            if (typeof value7 === "string") {
              input2.sections = {
                ...(input2.sections ?? {}),
                [value6]: value7,
              };
              items.push(value2);
            }
            continue;
          }
          let value3 = /^assetGroups\/([^/]+)\/tile$/.exec(value2),
            value4 =
              value3 !== null ? input2.assetGroups?.[value3[1]] : undefined,
            value5 =
              value3 !== null
                ? value.assetGroups?.[value3[1]]?.tile
                : undefined;
          if (value4 !== undefined && value5 !== undefined) {
            value4.tile = value5;
            items.push(value2);
          }
        }
        for (let [value2, value3] of Object.entries<string>(
          value.sections ?? {},
        )) {
          if (
            !localIndexFieldRevisions.has("sections/" + value2) ||
            Object.hasOwn(input2.sections ?? {}, value2) ||
            !Object.hasOwn(input.base.sections ?? {}, value2) ||
            input.base.sections?.[value2] === value3
          ) {
            continue;
          }
          input2.sections = {
            ...(input2.sections ?? {}),
            [value2]: value3,
          };
          items.push("sections/" + value2);
        }
      });
      if (items.length > 0) {
        flushForeignIndexChanges();
        for (let value2 of undoCommands) {
          value2.spanTheirs(items, value);
        }
        emit("index-mine-kept", {
          keys: items,
        });
        if (!isBusy()) {
          queue.flushNow();
        }
      }
      return items;
    }
    document2.subscribe((input) =>
      trackLocalIndexChanges(input?.remote === true),
    );
    document2.whenLive().then(
      () => trackLocalIndexChanges(true),
      (): void => {
        return;
      },
    );
    let queue = document2.queue();
    document2.whenLive().then(
      (): void => {
        if (lastIndexBase === undefined) {
          lastIndexBase = (0, runtime.cloneMergeValue)(
            document2.index().base(),
          );
        }
      },
      (): void => {
        return;
      },
    );
    let fileValueProvider = (input: string) => () => {
        let value = currentFileText(input);
        if (value === null) {
          throw Error(input + " is no longer in the table");
        }
        return value;
      },
      markDirty = (
        input: string,
        options2: () => Core.FilePublishInput,
        context: string | null | undefined,
      ) => queue.markDirty(input, options2, context),
      previousContentFiles = document2.content().files;
    document2.subscribe((input): void => {
      let files = document2.content().files;
      if (input?.remote === true && files !== previousContentFiles) {
        for (let value of new Set([
          ...Object.keys(files),
          ...Object.keys(previousContentFiles),
        ])) {
          if (
            value !== runtime.DESIGN_SYSTEM_PATHS.manifest &&
            files[value] !== previousContentFiles[value]
          ) {
            keepOutOfUndo(value);
          }
        }
      }
      if (input?.remote === true) {
        recordForeignIndexChanges(lastIndexBase);
        flushForeignIndexChanges();
      }
      for (let [value, value2] of locallyHeldTexts) {
        let value3: string = (0, runtime.relativeProjectFilePath)(value)!;
        if (value3 === undefined || heldText(value3, files) !== value2) {
          locallyHeldTexts.delete(value);
        }
      }
      for (let value of preReadBases.keys()) {
        let value2: string | undefined = (0, runtime.relativeProjectFilePath)(
          value,
        );
        if (
          value2 === undefined ||
          !readShas.has(value) ||
          (Object.hasOwn(files, value2) &&
            ((0, runtime.isHeldFilePointer)(value2, files[value2])
              ? !readTexts.has(value)
              : files[value2] === readTexts.get(value)))
        ) {
          preReadBases.delete(value);
        }
      }
      previousContentFiles = files;
    });
    let enhancedDocument: M.DesignSystemFilesDocument =
        document2 as M.DesignSystemFilesDocument,
      disposeDocument = document2.dispose.bind(document2);
    enhancedDocument.dispose = (): void => {
      disposed = true;
      if (ownershipRetryTimer !== undefined) {
        timers.clearTimeout(ownershipRetryTimer);
      }
      if (generatedReadmeTimer !== undefined) {
        timers.clearTimeout(generatedReadmeTimer);
      }
      if (generatedRetryTimer !== undefined) {
        timers.clearTimeout(generatedRetryTimer);
      }
      if (regenerationTimer !== undefined) {
        timers.clearTimeout(regenerationTimer);
      }
      disposeDocument();
    };
    let restoreStash = document2.restoreStash.bind(document2);
    enhancedDocument.restoreStash = () => {
      let files = document2.content().files,
        callback = (input: string | undefined): void => {
          let value2 =
            document2.content().files[runtime.DESIGN_SYSTEM_PATHS.readme];
          if (
            value2 === undefined ||
            value2 === input ||
            !/^# [^\n]*\n?$/.test(value2)
          ) {
            return;
          }
          document2.updateContent(
            (input2) => {
              let { [runtime.DESIGN_SYSTEM_PATHS.readme]: files2, ...files3 } =
                input2.files;
              return (0, runtime.refreshManifest)(
                {
                  ...input2,
                  files: Object.freeze(
                    input === undefined
                      ? files3
                      : {
                          ...files3,
                          [runtime.DESIGN_SYSTEM_PATHS.readme]: input,
                        },
                  ),
                },
                document2.title(),
              );
            },
            {
              auto: true,
            },
          );
          let entry = readShas.get(projectReadmePath);
          if (input === readTexts.get(projectReadmePath)) {
            queue.withdraw(projectReadmePath);
          } else if (typeof entry === "string") {
            markDirty(
              projectReadmePath,
              () => currentFileText(runtime.DESIGN_SYSTEM_PATHS.readme),
              entry,
            );
          } else if (input !== undefined) {
            markDirty(
              projectReadmePath,
              () => currentFileText(runtime.DESIGN_SYSTEM_PATHS.readme),
              null,
            );
          } else {
            queue.withdraw(projectReadmePath);
            keepOutOfUndo(runtime.DESIGN_SYSTEM_PATHS.readme);
            takeRemoteFile(runtime.DESIGN_SYSTEM_PATHS.readme);
          }
        },
        value = restoreStash();
      if (value !== undefined) {
        callback(files[runtime.DESIGN_SYSTEM_PATHS.readme]);
        let value2 = value.do.bind(value);
        value.do = (): void => {
          let value3 =
            document2.content().files[runtime.DESIGN_SYSTEM_PATHS.readme];
          value2();
          callback(value3);
        };
      }
      if (value !== undefined) {
        let files2 = document2.content().files;
        for (let value2 of new Set([
          ...Object.keys(files),
          ...Object.keys(files2),
        ])) {
          if (files[value2] !== files2[value2]) {
            restoredStashPaths.add(value2);
          }
        }
      }
      return value;
    };
    document2.subscribeLoad((): void => {
      if (
        document2.loadState() === "failed" &&
        document2.bootFailure() === "access_revoked"
      ) {
        purgeCarryStorage("access revoked");
      }
    });
    function unsavedTextPaths(): string[] {
      if (document2.loadState() !== "live" || document2.readOnly()) {
        return [];
      }
      let items = [];
      for (let [value, value2] of (0, runtime.projectFilesForSave)(
        document2.content().files,
      ) as Map<string, string>) {
        let value3: string = (0, runtime.relativeProjectFilePath)(value)!;
        if (
          flags.has(value3) ||
          !(0, runtime.isTextFilePath)(value3) ||
          readTexts.get(value) === value2 ||
          textIsLocallyHeld(value, value3) ||
          preReadBases.get(value)?.text === value2
        ) {
          continue;
        }
        items.push(value3);
      }
      return items;
    }
    function unsavedRemovedFiles(): Record<string, string | null> {
      let state: Record<string, string | null> = {};
      if (document2.loadState() !== "live" || document2.readOnly()) {
        return state;
      }
      let files = document2.content().files;
      for (let value of new Set([...readTexts.keys(), ...readShas.keys()])) {
        let value2: string | undefined = (0, runtime.relativeProjectFilePath)(
            value,
          ),
          entry = preReadBases.get(value);
        if (
          value2 !== undefined &&
          !Object.hasOwn(files, value2) &&
          !flags.has(value2) &&
          !textIsLocallyHeld(value, value2) &&
          entry?.sha !== null
        ) {
          state[value2] = entry?.sha ?? readShas.get(value) ?? null;
        }
      }
      return state;
    }
    function unsavedBinaryPaths(): string[] {
      let items: string[] = [];
      if (document2.loadState() !== "live" || document2.readOnly()) {
        return items;
      }
      for (let [value, value2] of (0, runtime.projectFilesForSave)(
        document2.content().files,
      ) as Map<string, string>) {
        let value3: string = (0, runtime.relativeProjectFilePath)(value)!;
        if (
          (0, runtime.isTextFilePath)(value3) ||
          flags.has(value3) ||
          textIsLocallyHeld(value, value3)
        ) {
          continue;
        }
        if (
          (0, runtime.isHeldFilePointer)(value3, value2)
            ? !readShas.has(value)
            : readTexts.get(value) !== value2
        ) {
          items.push(value3);
        }
      }
      return items;
    }
    function snapshotHotCarry(input?: {
      handoff?: boolean;
    }): M.HotCarrySnapshot {
      let value = (
          options.snapshotView ??
          ((input2) => (0, runtime.snapshotDesignSystemView)(input2))
        )(flaggedPaths),
        value2 = unsavedTextPaths(),
        value3 = unsavedRemovedFiles(),
        value4 = document2.index(),
        value5 = (0, runtime.indexWithoutTitleAndDocs)(value4.base()),
        value6 = (0, runtime.indexWithoutTitleAndDocs)(value4.get()),
        value7 =
          document2.loadState() === "live" &&
          !document2.readOnly() &&
          !(0, runtime.mergeValuesEqual)(value5, value6),
        value8 = unsavedBinaryPaths();
      if (
        flags.size === 0 &&
        value2.length === 0 &&
        !value7 &&
        Object.keys(value3).length === 0 &&
        value8.length === 0
      ) {
        return value;
      }
      let state: Record<string, F.CarriedFileEdit> = {},
        state2: Record<string, F.CarriedFileEdit> = {},
        state3: Record<string, F.CarriedFileEdit> = {},
        items = [],
        value9 = runtime.HOT_CARRY_MAX_INLINE_CHARS,
        files = document2.content().files,
        values = new Set(
          Object.keys(value3).map((input2) =>
            readTexts.get((0, runtime.projectFilePath)(input2)),
          ),
        ),
        values2 = new Set(
          Object.keys(value3).map((input2) =>
            materializedFingerprints.get((0, runtime.projectFilePath)(input2)),
          ),
        ),
        callback = (
          input2: string,
          options2: Record<string, F.CarriedFileEdit>,
          context: F.CarriedFileEdit,
        ): void => {
          let value13 = context.text.length + (context.baseText?.length ?? 0);
          if (value13 <= value9) {
            options2[input2] = context;
            value9 -= value13;
            return;
          }
          state3[input2] = context;
        };
      for (let value13 of flags.keys()) {
        let value14 = files[value13];
        if (typeof value14 === "string") {
          callback(value13, state, {
            text: value14,
            base: flags.get(value13)?.theirsSha ?? null,
          });
        }
      }
      for (let value13 of value2) {
        let value14: string = (0, runtime.projectFilePath)(value13);
        items.push(value13);
        let entry = preReadBases.get(value14),
          value15 = entry !== undefined ? entry.text : readTexts.get(value14);
        callback(value13, state2, {
          text: files[value13],
          base:
            entry !== undefined ? entry.sha : (readShas.get(value14) ?? null),
          ...((0, runtime.isTokenFilePath)(value13) && value15 !== undefined
            ? {
                baseText: value15,
              }
            : {}),
        });
      }
      let value10: F.CarriedIndexEdit | undefined,
        value11: F.CarriedIndexEdit | undefined;
      if (value7) {
        let state4 = {
            base: value5,
            mine: value6,
          },
          length = JSON.stringify(state4).length;
        if (length <= value9) {
          value10 = state4;
          value9 -= length;
        } else {
          value11 = state4;
        }
      }
      stashOversizedCarry(state3, value11);
      let value12 = document2.queue();
      if (
        input?.handoff !== false &&
        Object.keys(state3).length === 0 &&
        value11 === undefined &&
        value8.length === 0 &&
        value12.state().stuck === undefined &&
        value12.conflicted().size === 0 &&
        value12.unsendable().size === 0
      ) {
        value12.stashHandedOff();
      }
      return {
        ...value,
        [runtime.HOT_CARRY_PROTOCOL_FIELD]: 1,
        ...(flags.size > 0
          ? {
              mine: state,
            }
          : {}),
        ...(items.length > 0
          ? {
              unsaved: state2,
              unsavedNames: items,
            }
          : {}),
        ...(Object.keys(value3).length > 0
          ? {
              removed: value3,
            }
          : {}),
        ...(Object.keys(value3).length > 0 || value8.length > 0
          ? {
              binariesLeft: value8.slice(0, 200),
              binariesNew: value8
                .filter(
                  (input2) =>
                    !values.has(files[input2]) &&
                    !values2.has(textFingerprint(files[input2])),
                )
                .slice(0, 200),
            }
          : {}),
        ...(value7
          ? {
              indexUnsaved: true,
              ...(value10 !== undefined
                ? {
                    index: value10,
                  }
                : {}),
            }
          : {}),
      };
    }
    function restoreHotCarry(input: M.RawHotCarry | null | undefined) {
      if (input === undefined || input === null || restoreConsumed) {
        return;
      }
      restoreConsumed = true;
      let value = input,
        value2: boolean =
          (input as Record<string, unknown>)[
            runtime.HOT_CARRY_PROTOCOL_FIELD
          ] === 1,
        value3 = value2
          ? []
          : [
              ...new Set([
                ...(Array.isArray(value.unsavedNames)
                  ? (value.unsavedNames as unknown[]).filter(
                      (input2: unknown): input2 is string =>
                        typeof input2 === "string",
                    )
                  : [
                      ...(0, runtime.readCarriedFileEdits)(
                        input,
                        "unsaved",
                      ).keys(),
                    ]),
                ...(typeof value.removed === "object" && value.removed !== null
                  ? Object.keys(value.removed)
                  : []),
              ]),
            ].slice(0, 200);
      if (
        !value2 &&
        (value3.length > 0 ||
          value.indexUnsaved === true ||
          value.index !== undefined)
      ) {
        let {
          unsaved: value4,
          unsavedNames: value5,
          removed: value6,
          index: value7,
          indexUnsaved: value8,
          binariesLeft: value9,
          ...value10
        } = input;
        consumeCarryStorage(value3, true);
        emit("restore-lost", {
          paths: value3.map(runtime.projectFilePath),
          why: "the page that reloaded was an older build",
        });
        notice(
          "The page reloaded, and your unsaved changes" +
            (value3.length > 0
              ? " to " + (0, runtime.summarizeFileNames)(value3)
              : "") +
            " could not be carried across. What is saved is shown; those changes are gone.",
        );
        return void restoreHotCarryEdits(value10);
      }
      restoreHotCarryEdits(input);
    }
    function restoreHotCarryEdits(input: M.RawHotCarry): void {
      let value = input,
        value2 = (
          options.restoreView ??
          ((input2) => (0, runtime.restoreDesignSystemView)(input2))
        )(input),
        value3 = (0, runtime.readCarriedFileEdits)(input),
        value4 = (0, runtime.readCarriedFileEdits)(input, "unsaved"),
        value5 = Array.isArray(value.unsavedNames)
          ? (value.unsavedNames as unknown[])
              .filter(
                (input2: unknown): input2 is string =>
                  typeof input2 === "string",
              )
              .slice(0, 200)
          : [...value4.keys()],
        value6 = (0, runtime.readCarriedIndexEdit)(value.index),
        value7 = value.indexUnsaved === true || value6 !== undefined,
        value8 = consumeCarryStorage(
          [
            ...value2.filter((input2): boolean => !value3.has(input2)),
            ...value5.filter((input2): boolean => !value4.has(input2)),
          ],
          value7 && value6 === undefined,
        );
      for (let value16 of value2) {
        let value17 = value3.get(value16) ?? value8.files.get(value16);
        if (value17 !== undefined) {
          flaggedRestoreEdits.set(value16, value17);
        }
      }
      let entries = new Map<string, F.CarriedFileEdit>();
      for (let value16 of value5) {
        let value17 = value4.get(value16) ?? value8.files.get(value16);
        if (value17 !== undefined) {
          entries.set(value16, value17);
        }
      }
      let value9 = value6 ?? value8.index,
        items = [
          ...value2.filter(
            (input2): boolean => !flaggedRestoreEdits.has(input2),
          ),
          ...value5.filter((input2): boolean => !entries.has(input2)),
          ...(value7 && value9 === undefined ? [indexPath] : []),
        ];
      if (items.length > 0) {
        emit("restore-lost", {
          paths: items.map((input2) =>
            input2 === indexPath
              ? input2
              : (0, runtime.projectFilePath)(input2),
          ),
        });
        notice(
          "The page reloaded, and your unsaved changes to " +
            (0, runtime.summarizeFileNames)(items) +
            " could not be carried across. What is saved is shown; those changes are gone.",
        );
      }
      let entries2 = new Map<string, string | null>();
      if (typeof value.removed === "object" && value.removed !== null) {
        for (let [value16, value17] of Object.entries<unknown>(
          value.removed as Record<string, unknown>,
        ).slice(0, 200)) {
          if (typeof value17 === "string" || value17 === null) {
            entries2.set(value16, value17);
          }
        }
      }
      let value10 = Array.isArray(value.binariesLeft)
          ? (value.binariesLeft as unknown[]).filter(
              (input2: unknown): input2 is string => typeof input2 === "string",
            )
          : undefined,
        value11 =
          (Array.isArray(value.unsavedNames) &&
            value.unsavedNames.length > 200) ||
          (typeof value.removed === "object" &&
            value.removed !== null &&
            Object.keys(value.removed).length > 200),
        value12 = items.some(
          (input2) =>
            input2 !== indexPath && (0, runtime.isTextFilePath)(input2),
        ),
        value13 =
          value10 === undefined ||
          value10.length > 0 ||
          items.some(
            (input2) =>
              input2 !== indexPath && !(0, runtime.isTextFilePath)(input2),
          ),
        value14 = [...entries2.keys()].filter(
          (input2) =>
            value11 ||
            ((0, runtime.isTextFilePath)(input2) ? value12 : value13),
        );
      for (let value16 of value14) {
        entries2.delete(value16);
      }
      let value15 = Array.isArray(value.binariesNew)
        ? (value.binariesNew as unknown[]).filter(
            (input2: unknown): input2 is string => typeof input2 === "string",
          )
        : [];
      if (
        flaggedRestoreEdits.size === 0 &&
        entries.size === 0 &&
        value9 === undefined &&
        entries2.size === 0 &&
        value14.length === 0 &&
        value15.length === 0
      ) {
        return;
      }
      let callback = (): void => {
          let items2 = [],
            items3 = [],
            value16 = value14.filter((input2) =>
              Object.hasOwn(document2.content().files, input2),
            );
          if (value16.length > 0) {
            emit("restore-unremoved", {
              paths: value16.map(runtime.projectFilePath),
            });
            for (let value19 of value16) {
              lateRemovalNoticePaths.add(value19);
            }
            let value18: boolean = value16.length === 1;
            notice(
              "The page reloaded before your rename or removal of " +
                (0, runtime.summarizeFileNames)(value16) +
                " was saved, so it did not go through: " +
                (value18
                  ? (0, runtime.summarizeFileNames)(value16) + " is"
                  : "they are") +
                " still here. Do it again. If you had renamed " +
                (value18 ? "it" : "one") +
                " and " +
                (value18 ? "the" : "its") +
                " new name is here too, remove the one you do not want.",
            );
          }
          for (let [value18, value19] of entries) {
            let value20 = currentFileText(value18);
            if (
              value20 !== null &&
              (0, runtime.fileContentsSemanticallyEqual)(
                value18,
                value20,
                value19.text,
              )
            ) {
              continue;
            }
            let value21 = liveSha(value18),
              value22 =
                value21 !== undefined &&
                value19.base !== undefined &&
                value21 !== value19.base;
            if (value22 && value20 !== null && value19.baseText !== undefined) {
              let value23 = (0, runtime.mergeSupportedFileThreeWays)(
                value18,
                value19.baseText,
                value19.text,
                value20,
              );
              if (value23 !== null && value23.ok) {
                if (
                  !(0, runtime.fileContentsSemanticallyEqual)(
                    value18,
                    value23.text,
                    value20,
                  )
                ) {
                  replaceFileText(value18, value23.text);
                  items3.push(value18);
                }
                continue;
              }
            }
            replaceFileText(value18, value19.text);
            items3.push(value18);
            if (value22) {
              flagClashingFile(
                value18,
                "restored",
                value21,
                "Someone else changed " +
                  (0, runtime.fileBaseName)(value18) +
                  " while the page reloaded. Your unsaved version is back on screen and was not saved over theirs." +
                  runtime.FILE_CONFLICT_CHOICE_SUFFIX,
              );
            }
          }
          let items4 = [];
          for (let [value18, value19] of entries2) {
            if (
              currentFileText(value18) === null &&
              !Object.hasOwn(document2.content().files, value18)
            ) {
              continue;
            }
            let value20 = liveSha(value18);
            if (
              value20 !== undefined &&
              value19 !== null &&
              value20 !== value19
            ) {
              items4.push(value18);
              continue;
            }
            document2.updateContent(
              (input2) => {
                let { [value18]: files, ...files2 } = input2.files;
                return (0, runtime.refreshManifest)(
                  {
                    ...input2,
                    files: Object.freeze(files2),
                  },
                  document2.title(),
                );
              },
              {
                auto: true,
              },
            );
            items3.push(value18);
          }
          if (items4.length > 0) {
            notice(
              "You had removed " +
                (0, runtime.summarizeFileNames)(items4) +
                " just before the page reloaded, and someone else changed " +
                (items4.length === 1 ? "it" : "them") +
                " meanwhile, so " +
                (items4.length === 1 ? "it was" : "they were") +
                " left in place.",
            );
          }
          let items5: string[] = [],
            flag: boolean = false;
          if (value9 !== undefined) {
            let entry = document2.index().get(),
              value18 = (value10 ?? [])
                .map(runtime.encodeFileIndexKey as (path: string) => string)
                .filter(
                  (input2) =>
                    Object.hasOwn(value9.base.blobs ?? {}, input2) &&
                    !Object.hasOwn(value9.mine.blobs ?? {}, input2),
                ),
              value19 =
                value18.length === 0
                  ? value9.mine
                  : {
                      ...value9.mine,
                      blobs: {
                        ...value9.mine.blobs,
                        ...Object.fromEntries(
                          value18.map((input2) => [
                            input2,
                            value9.base.blobs[input2],
                          ]),
                        ),
                      },
                    },
              { index: value20, kept: value21 } = (0, runtime.mergeFilesIndex)(
                value9.base,
                value19,
                entry,
              );
            items5 = value21.filter(
              (input2) =>
                !input2.startsWith("docs") &&
                input2 !== "title" &&
                !(0, runtime.isGeneratedIndexField)(input2),
            );
            if (!(0, runtime.mergeValuesEqual)(value20, entry)) {
              let files: Core.FileTable = (0, runtime.restoreFilesFromIndex)(
                value20,
                (0, runtime.projectFilesForSave)(document2.content().files),
              ).content.files;
              document2.updateContent(
                () =>
                  (0, runtime.refreshManifest)(
                    {
                      v: 2,
                      files: Object.freeze({
                        ...files,
                      }),
                    },
                    document2.title(),
                  ),
                {
                  auto: true,
                },
              );
              flag = true;
            }
            if (items5.length > 0) {
              notice(
                "Part of your unsaved change was left as it is because someone else changed it while the page reloaded: " +
                  (0, runtime.describeIndexConflicts)(
                    items5,
                    document2.index().get(),
                  ).join(", ") +
                  ".",
              );
            }
          }
          let value17 = value15.filter(
            (input2): boolean =>
              !Object.hasOwn(document2.content().files, input2),
          );
          if (value17.length > 0) {
            emit("restore-lost", {
              paths: value17.map(runtime.projectFilePath),
            });
            notice(
              "The page reloaded before " +
                (0, runtime.summarizeFileNames)(value17) +
                " " +
                (value17.length === 1 ? "was" : "were") +
                " saved, so " +
                (value17.length === 1 ? "it is" : "they are") +
                " gone. Add " +
                (value17.length === 1 ? "it" : "them") +
                " again.",
            );
          }
          if (items3.length > 0 || flag) {
            emit("resumed", {
              paths: items3.map(runtime.projectFilePath),
              index: flag,
              indexKept: items5,
            });
            enhancedDocument.flushNow();
          }
          for (let [value18, value19] of flaggedRestoreEdits) {
            let value20 = currentFileText(value18);
            if (value20 !== null && value20 === value19.text) {
              continue;
            }
            replaceFileText(value18, value19.text);
            flags.set(value18, {
              path: value18,
              why: "restored",
              theirsSha: liveSha(value18),
              since: timers.now(),
            });
            flaggedPaths.add(value18);
            noticedClashShas.set(value18, liveSha(value18));
            queue.withdraw((0, runtime.projectFilePath)(value18));
            items2.push(value18);
          }
          flaggedRestoreEdits.clear();
          if (items2.length > 0) {
            emit("restored", {
              paths: items2.map(runtime.projectFilePath),
            });
            notifyFlags();
          }
        },
        callback2 = async (): Promise<void> => {
          let entries3 = new Map([...flaggedRestoreEdits, ...entries]);
          flaggedRestoreEdits.clear();
          let value16 = [...entries2.keys(), ...value14].filter((input2) =>
              Object.hasOwn(document2.content().files, input2),
            ),
            value17 =
              value9 !== undefined &&
              !(0, runtime.indexAuthoredFieldsEqual)(value9.base, value9.mine);
          if (entries3.size === 0 && !value17 && value16.length === 0) {
            return;
          }
          let values = new Set<string>();
          if (options.saveStash !== undefined && entries3.size > 0) {
            let value23 = await options.saveStash.put(
                [...entries3].map(([input2, input3]) => ({
                  path: (0, runtime.projectFilePath)(input2),
                  text: input3.text,
                  base: input3.base ?? null,
                })),
                options.port.version().version,
              ),
              value24 = value23
                ? []
                : ((await options.saveStash.read())?.edits ?? []);
            values = value23
              ? new Set(entries3.keys())
              : new Set(
                  value24.flatMap((input2) => {
                    let value25: string | undefined = (0,
                    runtime.relativeProjectFilePath)(input2.path);
                    if (
                      value25 !== undefined &&
                      entries3.get(value25)?.text === input2.text
                    ) {
                      return [value25];
                    } else {
                      return [];
                    }
                  }),
                );
          }
          let value18 = [...entries3.keys()].filter((input2) =>
              values.has(input2),
            ),
            value19 = value16.filter(
              (input2): boolean => !entries3.has(input2),
            ),
            items2 = [
              ...[...entries3.keys()].filter(
                (input2): boolean => !values.has(input2),
              ),
              ...(value17 ? [indexPath] : []),
            ],
            callback4 = (input2: readonly string[]) =>
              input2.map((input3) =>
                input3 === indexPath
                  ? input3
                  : (0, runtime.projectFilePath)(input3),
              );
          if (value18.length > 0) {
            emit("restore-kept", {
              paths: callback4(value18),
            });
          }
          if (items2.length + value19.length > 0) {
            emit("restore-lost", {
              paths: callback4([...items2, ...value19]),
            });
          }
          let text: string = "The page reloaded and opened read-only. ",
            value20: string =
              value18.length > 0
                ? "Your version of " +
                  (0, runtime.summarizeFileNames)(value18) +
                  " is kept on this device for " +
                  runtime.CRASH_STASH_RETENTION_LABEL +
                  ". Reload to try getting it back. "
                : "",
            value21: string =
              items2.length > 0
                ? "Your unsaved changes to " +
                  (0, runtime.summarizeFileNames)(items2) +
                  " could not be kept here and are gone. "
                : "",
            value22: string =
              value19.length > 0
                ? "You had removed " +
                  (0, runtime.summarizeFileNames)(value19) +
                  "; that was not kept, and " +
                  (value19.length === 1 ? "the file is" : "the files are") +
                  " still here."
                : "";
          notice((text + value20 + value21 + value22).trim());
        },
        callback3 = () => {
          let value16 = document2.loadState();
          if (value16 === "live" && !document2.readOnly()) {
            return callback();
          }
          if (value16 === "live" && options.port.mayWrite === true) {
            return void callback2();
          }
          if (
            value16 === "live" ||
            (value16 === "failed" &&
              document2.bootFailure() === "access_revoked")
          ) {
            flaggedRestoreEdits.clear();
            return;
          }
          let callback4 = (): void => {
            return;
          };
          callback4 = document2.subscribeLoad((): void => {
            if (document2.loadState() === "loading") {
              return;
            }
            callback4();
            callback3();
          });
        };
      Promise.resolve().then(callback3);
    }
    document2.subscribe((input): void => {
      if (input?.remote === true) {
        return;
      }
      if (!personChanged && queue.pending()) {
        personChanged = true;
      }
      ownershipRetryAttempt = 0;
      ownershipFailureNoticed = false;
      for (let value of flags.keys()) {
        queue.withdraw((0, runtime.projectFilePath)(value));
      }
      for (let value of mergingTokenPaths) {
        queue.withdraw((0, runtime.projectFilePath)(value));
      }
      if (options.generated === true) {
        if (regenerationTimer !== undefined) {
          timers.clearTimeout(regenerationTimer);
        }
        regenerationTimer = timers.setTimeout(
          (): void => {
            regenerationTimer = undefined;
            regenerate();
          },
          Math.min(300, Math.floor((options.commitMs ?? 800) / 2)),
        );
      }
    });
    let hasHeldConflicts = () => flags.size > 0 || mergingTokenPaths.size > 0,
      enhancedQueue: F.FilesSaveQueue = Object.create(queue);
    enhancedQueue.commit = (): void => {
      regenerate();
      queue.commit();
    };
    enhancedQueue.pending = () =>
      queue.pending() || hasHeldConflicts() || generatedWorkPending();
    enhancedDocument.queue = () => enhancedQueue;
    let originalSaveState = document2.saveState.bind(document2);
    enhancedDocument.saveState = () => {
      let value = originalSaveState();
      if (flags.size === 0) {
        if (
          (mergingTokenPaths.size > 0 || generatedWorkPending()) &&
          value.status === "ready"
        ) {
          return {
            status: "dirty",
          };
        } else {
          return value;
        }
      }
      let value2 = queue.state(),
        value3 =
          value.status === "error" &&
          value2.unsendable !== undefined &&
          value.message ===
            (0, runtime.formatUnsendableFilesMessage)(value2.unsendable, {
              stashed: value2.unsendableStashed === true,
            });
      if (value.status !== "ready" && value.status !== "dirty" && !value3) {
        return value;
      }
      return {
        status: "error",
        code: "conflict",
        message:
          (flags.size === 1
            ? (0, runtime.fileBaseName)([...flags.keys()][0]) + " has"
            : String(flags.size) + " files have") +
          " a newer version from someone else and yours is not saved. Choose theirs, yours, or yours as a copy.",
      };
    };
    let originalSubscribeSave = document2.subscribeSave.bind(document2),
      queueIsClean = () => {
        let value = queue.state();
        return (
          value.dirty === 0 && !value.inFlight && queue.conflicted().size === 0
        );
      };
    originalSubscribeSave((): void => {
      if (carrying && queueIsClean()) {
        carrying = false;
      }
    });
    enhancedDocument.subscribeSave = (input) => {
      saveSubscribers.add(input);
      let value = originalSubscribeSave(() =>
        input(enhancedDocument.saveState()),
      );
      return (): void => {
        saveSubscribers.delete(input);
        value();
      };
    };
    enhancedDocument.dirty = () =>
      queue.pending() || hasHeldConflicts() || generatedWorkPending();
    let originalFlushNow = document2.flushNow.bind(document2);
    enhancedDocument.flushNow = (): void => {
      regenerate();
      originalFlushNow();
    };
    enhancedDocument.save = async (): Promise<void> => {
      if (document2.loadState() === "failed") {
        document2.retryLoad();
        return;
      }
      enhancedDocument.flushNow();
      await settleOwnershipProbes();
      await queue.settle();
    };
    enhancedDocument.stuck = () => {
      let value = queue.state(),
        stuck = value.stuck,
        value2: string =
          value.unsendable !== undefined
            ? " " +
              (0, runtime.formatUnsendableFilesMessage)(value.unsendable, {
                restSaved: false,
                stashed: value.unsendableStashed === true,
              })
            : "";
      if (stuck === undefined) {
        return undefined;
      } else {
        return {
          code: stuck.code,
          since: stuck.since,
          retryable: stuck.retryable,
          message: (0, runtime.describeStuckSave)(stuck, timers.now()) + value2,
        };
      }
    };
    enhancedDocument.retryStuck = () => document2.retrySave();
    enhancedDocument.flagged = () => flaggedPaths;
    enhancedDocument.flags = () => flags;
    enhancedDocument.subscribeFlagged = (input) => {
      flagSubscribers.add(input);
      return () => void flagSubscribers.delete(input);
    };
    enhancedDocument.resolveFlagged = (input, options2): void => {
      if (!flags.has(input)) {
        return;
      }
      if (options2 === "mine" && remoteRevertTokens.delete(input)) {
        remoteRevertPending.delete(input);
      }
      let value: string = (0, runtime.projectFilePath)(input),
        value2 = currentFileText(input);
      if (options2 === "copy") {
        let files = document2.content().files,
          value4 =
            value2 === null
              ? null
              : (0, runtime.availableConflictCopyName)(input, (input2) => {
                  let value5 = port.liveSha?.(
                    (0, runtime.projectFilePath)(input2),
                  );
                  return (
                    !Object.hasOwn(files, input2) &&
                    (0, runtime.isProjectContentPath)(
                      (0, runtime.projectFilePath)(input2),
                    ) &&
                    (value5 === undefined || value5 === null)
                  );
                });
        if (value4 === null || value2 === null) {
          notice(
            "There is no free name beside " +
              (0, runtime.fileBaseName)(input) +
              " for a copy. Choose theirs or yours instead.",
          );
          return;
        }
        queue.withdraw(value);
        emit("flag-resolved", {
          path: value,
          choice: "copy",
          copy: (0, runtime.projectFilePath)(value4),
        });
        replaceFileText(value4, value2);
        advancePathRevision(input);
        unflagFile(input);
        pruneUndoPaths(new Set([input]), "kept as a copy");
        keepOutOfUndo(input);
        takeRemoteFile(input);
        notice(
          "Your version of " +
            (0, runtime.fileBaseName)(input) +
            " is kept as " +
            (0, runtime.fileBaseName)(value4) +
            "; " +
            (0, runtime.fileBaseName)(input) +
            " now has theirs.",
        );
        enhancedDocument.flushNow();
        return;
      }
      queue.withdraw(value);
      emit("flag-resolved", {
        path: value,
        choice: options2,
      });
      if (options2 === "theirs") {
        advancePathRevision(input);
        unflagFile(input);
        pruneUndoPaths(new Set([input]), "took theirs");
        keepOutOfUndo(input);
        takeRemoteFile(input);
        return;
      }
      let value3 = liveSha(input);
      document2.held().delete(value);
      unflagFile(input);
      for (let value4 of undoCommands) {
        value4.retoken(input);
      }
      markDirty(value, () => value2, value3 ?? null);
      enhancedDocument.flushNow();
    };
    enhancedDocument.flaggedSides = async (input) => {
      let value = currentFileText(input),
        value2: string | null = null;
      if (liveSha(input) !== null) {
        try {
          value2 = (
            await (0, runtime.createDesignSystemFilesPort)(
              options.port,
            ).readText((0, runtime.projectFilePath)(input))
          ).text;
        } catch {
          value2 = null;
        }
      }
      return {
        mine: value,
        theirs: value2,
      };
    };
    enhancedDocument.stepCommand = createUndoCommand;
    enhancedDocument.bindUndoStack = (input): void => {
      undoStack = input;
    };
    enhancedDocument.regenerate = regenerate;
    enhancedDocument.writeReadmeTail = writeReadmeTail;
    enhancedDocument.personChanged = (): boolean => personChanged;
    enhancedDocument.events = () => events;
    let entryProblem = (
      input: string,
      options2: string,
    ): M.EntryProblem | undefined => {
      let value: { reason: string } | undefined = (0,
      runtime.filesLeftOutOfMigration)({
        [input]: options2,
      })[0];
      if (value !== undefined) {
        return {
          why: value.reason,
          cause:
            (0, runtime.explainUnpublishableFile)(input, options2)?.cause ??
            (!(0, runtime.isTextFilePath)(input) &&
            (0, runtime.storagePointerForFile)(input, options2) === null
              ? "unreadable"
              : "other"),
        };
      }
      let value2: M.EntryProblem | undefined;
      try {
        value2 = tablePort.entryProblemDetail(
          (0, runtime.projectFilePath)(input),
          options2,
        );
      } catch {
        value2 = (0, runtime.filePublishRejection)(
          (0, runtime.projectFilePath)(input),
          options2,
        );
      }
      if (value2 !== undefined) {
        return value2;
      }
      let value3 = (0, runtime.filePublishSizeRejection)(options2);
      if (value3 === undefined) {
        return undefined;
      } else {
        return {
          why: value3,
          cause: "size",
        };
      }
    };
    enhancedDocument.neverSaves = entryProblem;
    enhancedDocument.editProblem = (input, options2): undefined | string => {
      let files = input.files,
        files2 = options2.files;
      if (files === files2) {
        return;
      }
      let value = Object.keys(files).filter(
          (input2): boolean => !Object.hasOwn(files2, input2),
        ),
        value2 =
          value.length === 0
            ? []
            : Object.keys(files2).filter(
                (input2): boolean => !Object.hasOwn(files, input2),
              );
      for (let value3 of value2.length === 0 ? [] : value) {
        let value4 = files[value3],
          value5 = value2.findIndex(
            (input2): boolean => files2[input2] === value4,
          );
        if (value5 < 0) {
          continue;
        }
        let value6 = value2.splice(value5, 1)[0],
          callback = (input2: string) => entryProblem(input2, value4)?.why;
        if (
          !(0, runtime.projectFilesForSave)({
            [value3]: value4,
          }).has((0, runtime.projectFilePath)(value3))
        ) {
          continue;
        }
        if (
          !(
            (0, runtime.isHeldFilePointer)(value3, value4) ||
            (0, runtime.isHeldFilePointer)(
              value3,
              document2.content().files[value3] ?? "",
            )
          ) &&
          !readShas.has((0, runtime.projectFilePath)(value3)) &&
          callback(value3) !== undefined
        ) {
          continue;
        }
        let value7 = callback(value6);
        if (value7 === undefined) {
          continue;
        }
        let value8: boolean =
            value7 === (0, runtime.filePublishSizeRejection)(value4),
          value9 =
            (0, runtime.fileBaseName)(value6) ===
            (0, runtime.fileBaseName)(value3)
              ? value6.replace(/^assets\//, "")
              : (0, runtime.fileBaseName)(value6),
          value10: string = !(0, runtime.isPublishableFilePathModelFileTable)(
            (0, runtime.projectFilePath)(value6),
          )
            ? /[%;:?#\\]/.test(value6)
              ? "Choose a name without % ; : ? # or a backslash."
              : new TextEncoder().encode((0, runtime.projectFilePath)(value6))
                    .length > 512
                ? "Choose a shorter name."
                : "Choose another name."
            : value8 && !(0, runtime.isTextFilePath)(value6)
              ? "It is too large for the page to save again (over " +
                String(
                  ((runtime.MAX_FILE_PUBLISH_ENCODED_BYTES / 4) * 3) / 1048576,
                ) +
                " MB): keep it where it is, or replace it with a smaller copy first."
              : value7.charAt(0).toUpperCase() +
                value7.slice(1) +
                (/[.!?]$/.test(value7) ? "" : "."),
          value11: string =
            'Nothing was changed: "' +
            value9 +
            '" cannot be saved, so "' +
            (0, runtime.fileBaseName)(value3) +
            '" would have been lost. ' +
            value10;
        notice(value11);
        return value11;
      }
      return;
    };
    enhancedDocument.heldGone = (input): boolean =>
      port.liveSha?.((0, runtime.projectFilePath)(input)) === null;
    enhancedDocument.heldShaOf = (input) =>
      readShas.get((0, runtime.projectFilePath)(input));
    (0, runtime.setFileVersionResolver)(enhancedDocument.heldShaOf);
    (0, runtime.setAddressedVersionResolver)(() =>
      frameVersionFromBaseUri() === latestFrameVersion
        ? latestVersion
        : undefined,
    );
    let readFreshHeldBytes: (url: string) => Promise<Uint8Array | null> =
      options.readAt ??
      (async (input: string): Promise<Uint8Array | null> => {
        try {
          let value = await fetch(input, {
            credentials: "same-origin",
            cache: "no-store",
          });
          if (value.ok && !value.redirected) {
            return new Uint8Array(await value.arrayBuffer());
          } else {
            return null;
          }
        } catch {
          return null;
        }
      });
    enhancedDocument.setPreparing = (input): void => {
      preparing = input;
    };
    enhancedDocument.carrying = (): void => {
      carrying = true;
      timers.setTimeout((): void => {
        if (carrying && queueIsClean()) {
          carrying = false;
        }
      }, 2000);
    };
    enhancedDocument.busy = () => isBusy();
    enhancedDocument.sendProblem = (input, options2) => {
      let value: string | undefined;
      try {
        value = tablePort.entryProblem?.(
          (0, runtime.projectFilePath)(input),
          options2,
        );
      } catch {
        value = undefined;
      }
      return value ?? (0, runtime.filePublishSizeRejection)(options2);
    };
    enhancedDocument.tell = (input) => notice(input);
    enhancedDocument.heldBytes = async (
      input,
    ): Promise<M.HeldBytesResult | null> => {
      if (document2.readOnly() || document2.loadState() !== "live") {
        return null;
      }
      let value = document2.content().files[input];
      if (
        value === undefined ||
        !(0, runtime.isHeldFilePointer)(input, value)
      ) {
        return null;
      }
      let value2: string = (0, runtime.projectFilePath)(input),
        value3 = pathRevisions.get(input) ?? 0,
        value4 = port.liveSha?.(value2);
      if (value4 === null) {
        return null;
      }
      let value5 = (0, runtime.addressedProjectFileUrl)(input),
        value6 = value5 === undefined ? null : await readFreshHeldBytes(value5),
        value7 =
          value6 === null ? undefined : await (0, runtime.sha256)(value6);
      if (
        value6 === null ||
        (typeof value4 === "string" && value4 !== value7)
      ) {
        try {
          value6 = (
            await (0, runtime.retryFileRead)(
              () => options.port.readBytes(value2),
              timers,
            )
          ).bytes;
        } catch {
          return null;
        }
        value7 = await (0, runtime.sha256)(value6);
      }
      if (
        value7 === undefined ||
        (typeof value4 === "string" && value4 !== value7)
      ) {
        return null;
      }
      if (
        document2.content().files[input] !== value ||
        (pathRevisions.get(input) ?? 0) !== value3
      ) {
        return null;
      }
      let value8 = (0, runtime.bytesToFileDataUri)(
        value6,
        (0, runtime.publishableFileMimeType)(input) ??
          "application/octet-stream",
      );
      materializedFingerprints.delete(value2);
      materializedFingerprints.set(value2, textFingerprint(value8));
      if (materializedFingerprints.size > 256) {
        materializedFingerprints.delete(
          materializedFingerprints.keys().next().value!,
        );
      }
      return {
        value: value8,
        witness: {
          rev: value3,
          sha: value7,
        },
      };
    };
    enhancedDocument.heldStillGood = (
      input,
      options2,
    ): "gone" | "changed" | "good" => {
      let value = port.liveSha?.((0, runtime.projectFilePath)(input));
      if (value === null) {
        return "gone";
      }
      if (
        (pathRevisions.get(input) ?? 0) !== options2.rev ||
        (typeof value === "string" && value !== options2.sha)
      ) {
        return "changed";
      } else {
        return "good";
      }
    };
    enhancedDocument.materializeOwed = async (
      input: (
        id: string,
      ) => Promise<{ bytes: Uint8Array } | null> = runtime.readOwedArtifactBlob,
    ) => {
      if (document2.readOnly() || document2.loadState() !== "live") {
        return [];
      }
      let items = [];
      for (let { path: value, id: value2 } of (0,
      runtime.blobFilesOwedToFileStorage)(
        document2.content().files,
        options.home ?? runtime.DEFAULT_FILE_STORAGE_POLICY,
      ) as { path: string; id: string }[]) {
        let value3 = await input(value2);
        if (value3 === null) {
          continue;
        }
        let value4 = (0, runtime.isTextFilePath)(value)
          ? new TextDecoder().decode(value3.bytes)
          : (0, runtime.bytesToFileDataUri)(
              value3.bytes,
              (0, runtime.publishableFileMimeType)(value) ??
                "application/octet-stream",
            );
        if (entryProblem(value, value4) !== undefined) {
          continue;
        }
        document2.updateContent(
          (input2) =>
            input2.files[value] === "blob:" + value2
              ? {
                  ...input2,
                  files: Object.freeze({
                    ...input2.files,
                    [value]: value4,
                  }),
                }
              : input2,
          {
            auto: true,
          },
        );
        keepOutOfUndo(value);
        items.push(value);
      }
      return items;
    };
    return enhancedDocument;
  }
  bindRuntimeValue(
    runtime,
    "createDesignSystemFilesDocument",
    () => createDesignSystemFilesDocument,
  );
  return () => {};
}
