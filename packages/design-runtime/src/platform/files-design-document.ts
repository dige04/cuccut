import type { DataRecord } from "../contracts/storage";
/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installPlatformFilesDesignDocument(
  runtime: RuntimeBindings,
): () => void {
  var hasUnstashedUnsendableEdits: Dynamic;
  var filesDocumentTimers: Dynamic;
  var DESIGN_FILE_MIME_TYPES: Dynamic;
  var canSaveDesignFile: Dynamic;
  var describeUnsupportedDesignFile: Dynamic;
  var isMissingRequiredDesignFile: Dynamic;
  var describeReservedDesignFilename: Dynamic;
  var describeMissingDesignFile: Dynamic;
  var describeUnsavableDesignFile: Dynamic;
  var DESIGN_INDEX_FILE_PATH: Dynamic;
  var DESIGN_RESTART_MAX_ATTEMPTS: Dynamic;
  var DESIGN_RESTART_DELAY_MS: Dynamic;
  var DESIGN_BOOT_MAX_ATTEMPTS: Dynamic;
  var DESIGN_BOOT_MAX_WAIT_MS: Dynamic;
  var bytesToBase64: Dynamic;
  var base64ToBytes: Dynamic;
  var FILE_READ_MAX_RETRIES: Dynamic;
  var FILE_READ_TIMEOUT_MS: Dynamic;
  var FILES_ERROR_DATABASE_ALIASES: Dynamic;
  function getDesignFileContentType(path?: Dynamic): Dynamic {
    let extension: Dynamic = path
      .slice(path.lastIndexOf(".") + 1)
      .toLowerCase();
    return (
      (0, runtime.getMimeTypeForPath)(path) ??
      (Object.hasOwn(DESIGN_FILE_MIME_TYPES, extension)
        ? DESIGN_FILE_MIME_TYPES[extension]
        : null)
    );
  }
  function validateListedDesignFile(file?: Dynamic): Dynamic {
    let relativePath: Dynamic = (0, runtime.fromProjectContentPath)(
      file.path,
      "design",
    );
    return relativePath === undefined ||
      relativePath === runtime.canvasMetadataFile ||
      !(0, runtime.isSafeProjectPath)(relativePath) ||
      (!(0, runtime.isArtboardFile)(relativePath) &&
        !(0, runtime.isSupportedProjectAsset)(relativePath)) ||
      file.size > runtime.PlatformFileContentResolvedValue_11
      ? null
      : relativePath;
  }
  function encodeDesignPortFile(path?: Dynamic, text?: Dynamic): Dynamic {
    let contentType: Dynamic = getDesignFileContentType(path) ?? "text/plain";
    if (!runtime.PlatformFileContentWebpAvifPattern.test(path))
      return {
        content: text,
        contentType: contentType,
      };
    try {
      return {
        content: new Blob([base64ToBytes(text)], {
          type: contentType,
        }),
        contentType: contentType,
      };
    } catch {
      return {
        content: text,
        contentType: "text/plain",
      };
    }
  }
  function countPortContentBytes(files?: Dynamic): Dynamic {
    let bytes: Dynamic = 0;
    for (let value of Object.values(files) as Dynamic) {
      let value2: Dynamic =
        value !== null && typeof value == "object" && !(value instanceof Blob)
          ? value.content
          : value;
      typeof value2 == "string"
        ? (bytes += value2.length)
        : value2 != null &&
          typeof value2.size == "number" &&
          (bytes += value2.size);
    }
    return bytes;
  }
  function describeIndexMergeConflict(
    conflict?: Dynamic,
    details?: Dynamic,
  ): Dynamic {
    let properties: Dynamic = [
        ...new Set(details.map(runtime.describeMergeField)),
      ],
      valueSummary: Dynamic =
        details.length === 1 && details[0].kind !== "text"
          ? ": yours " +
            (details[0].to ?? "removed") +
            ", theirs " +
            (details[0].theirs ?? "removed")
          : "",
      propertySummary: Dynamic =
        properties.slice(0, 3).join(", ") +
        (properties.length > 3
          ? " and " + String(properties.length - 3) + " more"
          : "");
    return (
      "You and someone else changed the same thing on \u201C" +
      conflict.replace(/\.dc\.html$/, "") +
      "\u201D at the same moment (" +
      propertySummary +
      valueSummary +
      "). Yours was kept."
    );
  }
  function describeSamePropertyConflict(
    conflict?: Dynamic,
    details?: Dynamic,
  ): Dynamic {
    let properties: Dynamic = [
        ...new Set(details.map(runtime.describeMergeField)),
      ],
      propertySummary: Dynamic =
        properties.slice(0, 3).join(", ") +
        (properties.length > 3
          ? " and " + String(properties.length - 3) + " more"
          : "");
    return (
      "Someone else changed the same thing you just changed on \u201C" +
      conflict.replace(/\.dc\.html$/, "") +
      "\u201D (" +
      propertySummary +
      "). Theirs replaced yours."
    );
  }
  function createFilesDesignDocument(options?: Dynamic): Dynamic {
    let timers: Dynamic = options.timers ?? filesDocumentTimers,
      canWrite: Dynamic = (options.canWrite ?? true) && options.port.canWrite,
      hasLocalChanges: Dynamic = false,
      notice: Dynamic = (input?: Dynamic): Dynamic => options.onNotice?.(input),
      defaultTitle: Dynamic =
        (0, runtime.normalizeDocumentTitle)(options.defaultTitle) ?? "Design",
      state: Dynamic = {
        title: defaultTitle,
        content: {
          files: {},
        },
        comments: [],
      },
      loadState: Dynamic = "loading",
      disposed: Dynamic = false,
      lastSaveAt: Dynamic,
      lastSaveError: Dynamic,
      syncState: Dynamic = {
        dirty: 0,
        inFlight: false,
      },
      liveHashes: Dynamic = new Map(),
      publishedHashes: Dynamic = new Map(),
      loadedFiles: Dynamic = {},
      missingBoards: Dynamic = new Set(),
      heldRemoteFiles: Dynamic = new Set(),
      savedFiles: Dynamic = {},
      overwrittenEdits: Dynamic = new Map(),
      boardClashes: Dynamic = new Map(),
      ownChangedHashes: Dynamic = new Map(),
      resolvingClashes: Dynamic = new Set(),
      pendingReadVersions: Dynamic = new Map(),
      undoHistory: Dynamic = [],
      fileDirtyVersions: Dynamic = new Map(),
      keptNoteIds: Dynamic = new Set(),
      keptPageIds: Dynamic = new Set(),
      knownArtboardFiles: Dynamic = new Set(),
      rememberArtboards: Dynamic = (input?: Dynamic): Dynamic => {
        for (let value14 of Object.keys(input) as Dynamic)
          (0, runtime.isArtboardFile)(value14) &&
            knownArtboardFiles.add(value14);
      },
      removedNoteIds: Dynamic = new Set(),
      removedPageIds: Dynamic = new Set(),
      contentListeners: Dynamic = new Set(),
      saveListeners: Dynamic = new Set(),
      loadListeners: Dynamic = new Set(),
      notifyContent: Dynamic = (input?: Dynamic): Dynamic => {
        for (let value14 of [...contentListeners] as Dynamic)
          value14(
            input
              ? {
                  remote: true,
                }
              : undefined,
          );
      },
      notifySave: Dynamic = (): Dynamic => {
        let value14: Dynamic = getSaveState();
        for (let value15 of [...saveListeners] as Dynamic) value15(value14);
      },
      trackedPort: Dynamic = Object.create(options.port, {
        publish: {
          value: async (
            input?: Dynamic,
            options2?: Dynamic,
          ): Promise<Dynamic> => {
            let value14: Dynamic = options.debug?.saveStart(
                Object.keys(input),
                countPortContentBytes(input),
              ),
              value15: Dynamic,
              version: Dynamic = options.port.version().version;
            try {
              value15 = await options.port.publish(input, options2);
            } catch (value17: Dynamic) {
              throw (
                value14 !== undefined &&
                  options.debug?.saveEnd(value14, {
                    ok: false,
                    code: "threw",
                    raw:
                      value17 instanceof Error
                        ? value17.message
                        : String(value17),
                  }),
                value17
              );
            }
            let value16: Dynamic =
              value15.ok &&
              value15.unchanged !== true &&
              value15.version !== version &&
              options.port.version().version === value15.version &&
              (value15.changed === undefined
                ? value15.preconditionsChecked !== true
                : value15.changed.length === 0);
            value14 !== undefined &&
              options.debug?.saveEnd(
                value14,
                value15.ok
                  ? {
                      ok: true,
                      version: value15.version,
                      ...(value16
                        ? {
                            own: value16,
                          }
                        : {}),
                    }
                  : {
                      ok: false,
                      code: value15.code,
                      raw: value15,
                    },
              );
            if (value15.ok) {
              let value17: Dynamic =
                value15.shas === undefined
                  ? await (0, runtime.hashFileMap)(input)
                  : {};
              for (let [value18, value19] of Object.entries(input) as Dynamic) {
                if (value19 === null) {
                  liveHashes.delete(value18);
                  publishedHashes.set(value18, null);
                  let value23: Dynamic = (0, runtime.fromProjectContentPath)(
                    value18,
                    "design",
                  );
                  value23 !== undefined && overwrittenEdits.delete(value23);
                  continue;
                }
                let value20: Dynamic =
                  value15.shas?.[value18] ?? value17[value18];
                if (value20 === undefined) continue;
                liveHashes.set(value18, value20);
                publishedHashes.set(value18, value20);
                let value21: Dynamic =
                    value19 !== null &&
                    typeof value19 == "object" &&
                    !(value19 instanceof Blob)
                      ? value19.content
                      : value19,
                  value22: Dynamic = (0, runtime.fromProjectContentPath)(
                    value18,
                    "design",
                  );
                typeof value21 == "string" &&
                  value22 !== undefined &&
                  ((0, runtime.isArtboardFile)(value22) &&
                    savedFiles[value22] !== undefined &&
                    savedFiles[value22] !== value21 &&
                    options.sameBoardRule !== "last" &&
                    overwrittenEdits.set(value22, {
                      file: value22,
                      base: savedFiles[value22],
                      mine: value21,
                      at: timers.now(),
                    }),
                  (savedFiles[value22] = value21));
              }
              for (let [value18, value19] of Object.entries(input) as Dynamic)
                ownChangedHashes.set(
                  value18,
                  value19 === null ? null : (liveHashes.get(value18) ?? null),
                );
              lastSaveAt = timers.now();
              lastSaveError = undefined;
            }
            return value15;
          },
        },
      }),
      indexState: Dynamic = (0, runtime.createIndexFileState)({
        path: DESIGN_INDEX_FILE_PATH,
        port: trackedPort,
        schema: runtime.FILES_INDEX_MERGE_POLICY,
        empty: (): Dynamic => (0, runtime.createEmptyDesignIndex)(),
      }),
      serializeIndex: Dynamic = indexState.serialize.bind(indexState);
    indexState.serialize = (): Dynamic => (
      indexState.baseSha() === null &&
        (0, runtime.getStorageMigrationMarker)(indexState.get()) === null &&
        (indexState.get()[runtime.CreatedOnFilesValue] = (0,
        runtime.migrationTimestampMarker)({
          at: new Date().toISOString(),
        })),
      serializeIndex()
    );
    let mergeIndex: Dynamic = indexState.mergeFrom.bind(indexState),
      pagesOverlap: Dynamic = false;
    indexState.mergeFrom = (input?: Dynamic): Dynamic => {
      let value14: Dynamic = indexState.base(),
        entry: Dynamic = indexState.get();
      trackMergedDeletions(value14, entry, input);
      let value15: Dynamic = (0, runtime.mergeDesignPages)(
        callback(value14.pages),
        callback(entry.pages),
        callback(input.pages),
      );
      pagesOverlap = value15.overlap;
      let value16: Dynamic = mergeIndex(input);
      Array.isArray(value16.pages)
        ? value16.pages.splice(0, value16.pages.length, ...value15.pages)
        : (value16.pages = value15.pages);
      return value16;
    };
    let callback: Dynamic = (input?: Dynamic): Dynamic =>
        Array.isArray(input)
          ? input.filter(
              (input2?: Dynamic): Dynamic =>
                typeof input2 == "object" &&
                input2 !== null &&
                typeof input2.id == "string",
            )
          : [],
      callback2: Dynamic = (input?: Dynamic): Dynamic =>
        typeof input == "object" && input !== null && !Array.isArray(input)
          ? Object.keys(input)
          : [];
    function trackMergedDeletions(
      input?: Dynamic,
      options2?: Dynamic,
      context?: Dynamic,
    ): Dynamic {
      let values5: Dynamic = new Set(callback2(context.boards)),
        values6: Dynamic = new Set(callback2(context.notes)),
        values7: Dynamic = new Set(
          callback(context.pages).map((input2?: Dynamic): Dynamic => input2.id),
        ),
        values8: Dynamic = new Set(callback2(input.boards)),
        values9: Dynamic = new Set(callback2(input.notes)),
        values10: Dynamic = new Set(
          callback(input.pages).map((input2?: Dynamic): Dynamic => input2.id),
        );
      for (let value14 of values8 as Dynamic)
        !values5.has(value14) &&
          !fileDirtyVersions.has(value14) &&
          fileDirtyVersions.set(
            value14,
            (0, runtime.cloneIndexValue)(
              options2.boards?.[value14] ?? input.boards[value14],
            ),
          );
      for (let value14 of values9 as Dynamic)
        values6.has(value14) ||
          (keptNoteIds.add(value14), removedNoteIds.delete(value14));
      for (let value14 of values10 as Dynamic)
        values7.has(value14) ||
          (keptPageIds.add(value14), removedPageIds.delete(value14));
      for (let value14 of values5 as Dynamic)
        values8.has(value14) || fileDirtyVersions.delete(value14);
      for (let value14 of values6 as Dynamic)
        values9.has(value14) || keptNoteIds.delete(value14);
      for (let value14 of values7 as Dynamic)
        values10.has(value14) || keptPageIds.delete(value14);
    }
    let callback3: Dynamic = (input?: Dynamic): Dynamic => {
        if (options.sameBoardRule === "last") return;
        let value14: Dynamic = input.filter(
          (input2?: Dynamic): Dynamic =>
            (input2 !== "pages" || pagesOverlap) &&
            !input2.startsWith(runtime.CreatedOnFilesValue + "/"),
        );
        value14.length > 0 &&
          notice(
            "Someone else changed " +
              describeIndexConflictTarget(value14) +
              " at the same moment; their change was kept.",
          );
      },
      value: Dynamic = (0, runtime.createFilesPublisher)({
        port: trackedPort,
        index: indexState,
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
        onConflict: (input?: Dynamic): Dynamic => {
          handleBoardClash(input.path, input.theirsSha, "save-refused");
        },
        onIndexMerged: callback3,
        onState(input: Dynamic): Dynamic {
          syncState = input;
          input.lastError !== undefined &&
            (lastSaveError = {
              code: "refused",
              message: input.lastError,
            });
          input.stuck === undefined && (flag = false);
          let value14: Dynamic =
            input.dirty === 0 && !input.inFlight && input.stuck === undefined;
          if (value14)
            for (let value15 of values as Dynamic)
              (input.unsendable ?? []).some(
                (input2?: Dynamic): Dynamic => input2.path === value15,
              ) || values.delete(value15);
          ((input.stuck !== undefined && !flag) ||
            (callback4(input) && (value14 || input.stuck !== undefined))) &&
            scheduleSaveStatusUpdate();
          notifySave();
        },
      }),
      flag: Dynamic = false,
      values: Dynamic = new Set(),
      callback4: Dynamic = (input?: Dynamic): Dynamic =>
        (input.unsendable ?? []).some(
          (input2?: Dynamic): Dynamic => !values.has(input2.path),
        ),
      callback5: Dynamic = (input?: Dynamic): Dynamic =>
        (0, runtime.describeUnsendableEdits)(syncState.unsendable ?? [], {
          restSaved: input,
          stashed: syncState.unsendableStashed === true,
        }),
      callback6: Dynamic = (input?: Dynamic): Dynamic =>
        (0, runtime.describeStuckSave)(input, timers.now()) +
        (syncState.unsendable !== undefined ? " " + callback5(false) : ""),
      value2: Dynamic;
    function scheduleSaveStatusUpdate(): Dynamic {
      value2 === undefined &&
        (value2 = timers.setTimeout((): Dynamic => {
          value2 = undefined;
          let value14: Dynamic = syncState;
          if (
            !(
              disposed ||
              (value14.stuck === undefined &&
                (value14.dirty > 0 || value14.inFlight))
            )
          ) {
            if (value14.stuck !== undefined && !flag)
              notice(callback6(value14.stuck));
            else if (callback4(value14))
              notice(callback5(value14.stuck === undefined));
            else return;
            value14.stuck !== undefined && (flag = true);
            for (let value15 of (value14.unsendable ?? []) as Dynamic)
              values.add(value15.path);
          }
        }, 1e3));
    }
    function describeIndexConflictTarget(input?: Dynamic): Dynamic {
      let value14: Dynamic = input[0] ?? "",
        value15: Dynamic = /^boards\/(.+)\/[^/]+$/.exec(value14);
      return value15
        ? "\u201C" + value15[1].replace(/\.dc\.html$/, "") + "\u201D"
        : "the canvas layout";
    }
    function getSaveState(): Dynamic {
      return loadState === "loading"
        ? {
            status: "loading",
          }
        : canWrite
          ? syncState.stuck !== undefined
            ? {
                status: "error",
                message: callback6(syncState.stuck),
              }
            : syncState.lastError !== undefined && syncState.dirty > 0
              ? {
                  status: "error",
                  message: "Changes are waiting to save.",
                }
              : syncState.inFlight ||
                  syncState.dirty > 0 ||
                  value8 !== undefined
                ? {
                    status: "saving",
                  }
                : syncState.unsendable !== undefined
                  ? {
                      status: "error",
                      message: callback5(true),
                      leftOut: syncState.unsendable.map(
                        (input?: Dynamic): Dynamic => ({
                          id: input.path,
                          cause: input.cause,
                        }),
                      ),
                    }
                  : {
                      status: "ready",
                    }
          : {
              status: "readonly",
              message:
                hasLocalChanges && (options.canWrite ?? true)
                  ? runtime.CANVAS_READ_ERROR_REASON
                  : (options.readOnlyReason ??
                    "You can view this canvas but not edit it."),
              atBoot: true,
            };
    }
    function readWithRetry(input?: Dynamic): Dynamic {
      return (0, runtime.retryAccessFailure)(
        input,
        timers,
        undefined,
        runtime.PlatformFilesHotReloadItems,
      );
    }
    async function readFile(input?: Dynamic): Promise<Dynamic> {
      let value14: Dynamic = (0, runtime.toProjectContentPath)(input);
      if (runtime.PlatformFileContentWebpAvifPattern.test(input)) {
        let value15: Dynamic = await readWithRetry(
          (): Dynamic => trackedPort.readBytes(value14),
        );
        return bytesToBase64(value15.bytes);
      }
      return (await readWithRetry((): Dynamic => trackedPort.readText(value14)))
        .text;
    }
    async function readFiles(items2?: Dynamic): Promise<Dynamic> {
      let state2: Dynamic = {},
        index5: Dynamic = 0,
        callback19: Dynamic = async (): Promise<Dynamic> => {
          for (; index5 < items2.length; ) {
            let value14: Dynamic = items2[index5++];
            try {
              state2[value14] = await readFile(value14);
            } catch (value15: Dynamic) {
              console.warn(
                "design (files): could not read " +
                  (0, runtime.toProjectContentPath)(value14) +
                  " \u2014 " +
                  (value15 instanceof Error
                    ? value15.message
                    : String(value15)),
              );
            }
          }
        };
      await Promise.all(
        Array.from(
          {
            length: Math.min(DESIGN_RESTART_MAX_ATTEMPTS, items2.length),
          },
          callback19,
        ),
      );
      return state2;
    }
    function composeFromFiles(input?: Dynamic): Dynamic {
      let value14: Dynamic = (0, runtime.normalizeDesignIndex)(
        indexState.get(),
      );
      (0, runtime.setDesignSystems)(
        (0, runtime.refreshDesignSystemFileOverlay)(
          value14,
          input,
          value14[runtime.INDEX_DESIGN_SYSTEM_TOKENS_KEY],
        ),
      );
      (0, runtime.updateDesignSourceFile)(value14[runtime.INDEX_SOURCE_KEY]);
      missingBoards.clear();
      for (let value18 of Object.keys(value14.boards) as Dynamic)
        input[value18] === undefined && missingBoards.add(value18);
      rememberArtboards(input);
      let { [runtime.canvasMetadataFile]: value15, ...value16 }: Dynamic =
          input,
        value17: Dynamic = value14;
      for (let [value18, value19] of fileDirtyVersions as Dynamic)
        value16[value18] === undefined ||
          value18 in value14.boards ||
          value19 === undefined ||
          (value17 === value14 &&
            (value17 = {
              ...value14,
              boards: {
                ...value14.boards,
              },
              order: [...value14.order],
            }),
          (value17.boards[value18] = value19),
          value17.order.push(value18));
      value3 = (0, runtime.buildDesignDocumentFromIndex)(value17, value16);
      return {
        files: {
          ...value16,
          [runtime.canvasMetadataFile]: value3,
        },
      };
    }
    let value3: Dynamic,
      index: Dynamic = 0,
      value4: Dynamic,
      value5: Dynamic,
      value6: Dynamic,
      index2: Dynamic = 0;
    function scheduleLoadRetry(input?: Dynamic): Dynamic {
      if (!disposed) {
        if (value4 !== undefined) {
          if (timers.now() + input >= index2) return;
          timers.clearTimeout(value4);
        }
        index2 = timers.now() + input;
        options.debug?.event("load-retry", {
          inMs: input,
          attempt: index,
          error: lastSaveError?.message,
        });
        value4 = timers.setTimeout((): Dynamic => {
          value4 = undefined;
          retryFailedLoad();
        }, input);
      }
    }
    let value7: Dynamic,
      index3: Dynamic = 0;
    async function loadFiles(input: Dynamic = false): Promise<Dynamic> {
      let value14: Dynamic = timers.now();
      try {
        let value15: Dynamic = await (0, runtime.readBootFiles)({
          port: trackedPort,
          indexPath: DESIGN_INDEX_FILE_PATH,
          timers: timers,
          wants: (input2?: Dynamic): Dynamic => {
            let value22: Dynamic = validateListedDesignFile(input2);
            return (
              value22 !== null &&
              !runtime.PlatformFileContentWebpAvifPattern.test(value22)
            );
          },
          mayWrite: options.canWrite ?? true,
          onEvent: (input2?: Dynamic): Dynamic =>
            options.debug?.event(input2.type, input2),
        }).catch(async (input2?: Dynamic): Promise<Dynamic> => {
          if ((0, runtime.classifyBootstrapFailure)(input2) !== "no_index")
            throw input2;
          let value22: Dynamic = await trackedPort.list(),
            value23: Dynamic =
              input2.narrowed ??
              (0, runtime.isNarrowedFileContext)(value22, trackedPort);
          if (value23 && (options.canWrite ?? true))
            throw Object.assign(
              new Error(
                "this canvas\u2019s file list is still partial, so whether it has an index cannot be told yet",
              ),
              {
                cause: input2,
                narrowed: true,
              },
            );
          let entries: Dynamic = new Map();
          await Promise.all(
            value22
              .filter((input3?: Dynamic): Dynamic => {
                let value24: Dynamic = validateListedDesignFile(input3);
                return (
                  value24 !== null &&
                  !runtime.PlatformFileContentWebpAvifPattern.test(value24)
                );
              })
              .slice(0, runtime.PlatformFileContentFilesValue - 1)
              .map(async (input3?: Dynamic): Promise<Dynamic> => {
                try {
                  entries.set(
                    input3.path,
                    await readWithRetry(
                      (): Dynamic => trackedPort.readText(input3.path),
                    ),
                  );
                } catch {}
              }),
          );
          for (let value24 of value22 as Dynamic) {
            let value25: Dynamic = validateListedDesignFile(value24);
            value25 === null ||
              !(0, runtime.isArtboardFile)(value25) ||
              (0, runtime.isDesignSystemFile)(value25) ||
              entries.has(value24.path) ||
              value25 in indexState.get().boards ||
              ((indexState.get().boards[value25] = {
                x: 0,
                y: 0,
                w: 1280,
                h: 720,
              }),
              indexState.get().order.push(value25));
          }
          return {
            listing: value22,
            index: undefined,
            files: entries,
            narrowed: value23,
          };
        });
        hasLocalChanges = value15.narrowed === true;
        canWrite =
          (options.canWrite ?? true) &&
          options.port.canWrite &&
          !hasLocalChanges;
        for (let value22 of value15.listing as Dynamic)
          publishedHashes.set(value22.path, value22.sha256);
        value15.index !== undefined &&
          (indexState.loadText !== undefined
            ? indexState.loadText(value15.index.text, value15.index.sha256)
            : await indexState.load(),
          liveHashes.set(DESIGN_INDEX_FILE_PATH, value15.index.sha256));
        let value16: Dynamic = value15.listing
            .map(
              (input2?: Dynamic): Dynamic => [
                input2,
                validateListedDesignFile(input2),
              ],
            )
            .filter((input2?: Dynamic): Dynamic => input2[1] !== null)
            .slice(0, runtime.PlatformFileContentFilesValue - 1),
          state2: Dynamic = {};
        for (let [value22, value23] of value16 as Dynamic) {
          let entry: Dynamic = value15.files.get(value22.path);
          entry !== undefined &&
            ((state2[value23] = entry.text),
            liveHashes.set(value22.path, entry.sha256));
        }
        let value17: Dynamic = value16.filter(
            ([, input2]: Dynamic): Dynamic =>
              runtime.PlatformFileContentWebpAvifPattern.test(input2),
          ),
          value18: Dynamic = await readFiles(
            value17.map(([, input2]: Dynamic): Dynamic => input2),
          );
        for (let [value22, value23] of value17 as Dynamic)
          value18[value23] !== undefined &&
            ((state2[value23] = value18[value23]),
            liveHashes.set(value22.path, value22.sha256));
        if (disposed) return;
        let value19: Dynamic = composeFromFiles(state2);
        rememberManifestDeletions(
          (0, runtime.parseCanvasMetadata)(
            value19.files[runtime.canvasMetadataFile],
            value19.files,
          ),
        );
        let value20: Dynamic = indexState.get()[runtime.INDEX_LEFT_OUT_KEY],
          callback19: Dynamic = (input2?: Dynamic): Dynamic =>
            Object.entries(value19.files).some(
              ([input3, input4]: Dynamic): Dynamic =>
                (0, runtime.isArtboardFile)(input3) &&
                input4.includes(input2.slice(input2.lastIndexOf("/") + 1)),
            );
        if (canWrite && Array.isArray(value20))
          for (let value22 of value20.slice(0, 3) as Dynamic)
            typeof value22 == "string" &&
              !values3.has(value22) &&
              callback19(value22) &&
              (values3.add(value22),
              options.onNotice?.(describeUnsavableDesignFile(value22)));
        loadedFiles = {
          ...value19.files,
        };
        savedFiles = {
          ...state2,
        };
        let value21: Dynamic =
          (0, runtime.normalizeDocumentTitle)(indexState.get().title.trim()) ??
          state.title;
        state = {
          ...state,
          title: value21,
          content: value19,
        };
        loadState = "live";
        index = 0;
        value6 = undefined;
        value5 = undefined;
        if (options.saveStash !== undefined && canWrite) {
          let values5: Dynamic = new Set(
            value15.listing.map((input2?: Dynamic): Dynamic => input2.path),
          );
          value7 = await (0, runtime.applyCrashStashEdits)(
            options.saveStash,
            (input2?: Dynamic): Dynamic =>
              input2 === DESIGN_INDEX_FILE_PATH
                ? indexState.serialize()
                : (value15.files.get(input2)?.text ??
                  (values5.has(input2) ? undefined : null)),
          );
          let value22: Dynamic = value7?.edits.find(
              (input2?: Dynamic): Dynamic =>
                input2.path === DESIGN_INDEX_FILE_PATH,
            ),
            flag2: Dynamic = false;
          try {
            flag2 =
              value22 !== undefined &&
              value22.text ===
                serializeDocumentIndex(
                  parseCurrentManifest(value19.files, true),
                  value21,
                );
          } catch {}
          if (value7 !== undefined && value22 !== undefined && flag2) {
            let value23: Dynamic = value7.edits.filter(
              (input2?: Dynamic): Dynamic => input2 !== value22,
            );
            value23.length === 0
              ? ((value7 = undefined), await options.saveStash.clearOffered())
              : (value7 = {
                  ...value7,
                  edits: value23,
                });
          }
        }
      } catch (value15: Dynamic) {
        (0, runtime.classifyBootstrapFailure)(value15) === "access_revoked" &&
          options.saveStash?.clearArtifact();
        value6 ??= timers.now();
        let value16: Dynamic = (0, runtime.getBootstrapRetryDelay)(
          value15,
          index,
        );
        console.error(
          "design (files): this canvas\u2019s files could not be loaded" +
            (value16 === undefined ? "" : " (it will be tried again)"),
          value15,
        );
        loadState = "failed";
        value5 = {
          error: value15,
          at: value14,
        };
        lastSaveError = {
          code: "timeout",
          message:
            value15 instanceof Error
              ? value15.message
              : String(value15?.message ?? value15),
        };
        value16 !== undefined && (input || index++, scheduleLoadRetry(value16));
      }
      for (let value15 of [...loadListeners] as Dynamic) value15();
      notifyContent(true);
      notifySave();
      value7 !== undefined && loadState === "live" && offerCrashStash();
    }
    let value8: Dynamic;
    function scheduleLocalSave(): Dynamic {
      value8 !== undefined ||
        !canWrite ||
        loadState !== "live" ||
        ((value8 = timers.setTimeout((): Dynamic => {
          value8 = undefined;
          publishLocalChanges();
        }, 0)),
        notifySave());
    }
    let callback7: Dynamic = (input?: Dynamic): Dynamic =>
      publishedHashes.has(input) &&
      (publishedHashes.get(input) ?? undefined) !== liveHashes.get(input) &&
      liveHashes.has(input);
    function parseCurrentManifest(
      input?: Dynamic,
      options2: Dynamic = false,
    ): Dynamic {
      let value14: Dynamic = input[runtime.canvasMetadataFile],
        value15: Dynamic = (0, runtime.parseCanvasMetadata)(value14, input),
        value16: Dynamic = (0, runtime.parseIndexDeletionSets)(value14),
        entry: Dynamic = indexState.get();
      if (value14 !== value3 && !options2) {
        for (let value24 of value16.notes as Dynamic)
          keptNoteIds.has(value24) || removedNoteIds.add(value24);
        for (let value24 of value16.pages as Dynamic)
          keptPageIds.has(value24) || removedPageIds.add(value24);
      }
      let values5: Dynamic = new Set(missingBoards),
        values6: Dynamic = new Set(),
        values7: Dynamic = new Set(),
        flag2: Dynamic = false;
      for (let value24 of Object.keys(entry.boards) as Dynamic)
        !value16.boards.has(value24) &&
          !values2.has(value24) &&
          (values5.add(value24),
          !missingBoards.has(value24) &&
            !(0, runtime.isDesignSystemFile)(value24) &&
            (flag2 = true));
      for (let value24 of Object.keys(entry.notes) as Dynamic)
        !value16.notes.has(value24) &&
          !removedNoteIds.has(value24) &&
          (values6.add(value24), (flag2 = true));
      for (let value24 of callback(entry.pages) as Dynamic)
        !value16.pages.has(value24.id) &&
          !removedPageIds.has(value24.id) &&
          (values7.add(value24.id), (flag2 = true));
      let value17: Dynamic = [...values5]
        .filter(
          (input2?: Dynamic): Dynamic =>
            !missingBoards.has(input2) &&
            !(0, runtime.isDesignSystemFile)(input2),
        )
        .concat([...values6], [...values7])
        .sort().join(`
`);
      options2 ||
        (flag2 && value17 !== text && scheduleFileSave(), (text = value17));
      let items2: Dynamic = [],
        value18: Dynamic = value15.artboards.filter(
          (input2?: Dynamic): Dynamic =>
            fileDirtyVersions.has(input2.file)
              ? (value16.boards.has(input2.file) &&
                  !boardClashes.has(input2.file) &&
                  !heldRemoteFiles.has(input2.file) &&
                  !resolvingClashes.has(input2.file) &&
                  !callback8(input2.file) &&
                  items2.push(input2.file),
                false)
              : !(values5.has(input2.file) && !value16.boards.has(input2.file)),
        ),
        value19: Dynamic = value15.annotations?.filter(
          (input2?: Dynamic): Dynamic =>
            keptNoteIds.has(input2.id)
              ? (value16.notes.has(input2.id) &&
                  items2.push("note " + input2.id),
                false)
              : true,
        ),
        value20: Dynamic = value15.pages?.filter(
          (input2?: Dynamic): Dynamic =>
            keptPageIds.has(input2.id)
              ? (value16.pages.has(input2.id) &&
                  items2.push("page " + input2.id),
                false)
              : true,
        );
      items2.length > 0 &&
        !options2 &&
        (options.debug?.event("delete-wins", {
          notWrittenBack: items2,
        }),
        scheduleFileSave());
      let {
        annotations: value21,
        pages: value22,
        ...value23
      }: Dynamic = value15;
      return {
        manifest: {
          ...value23,
          artboards: value18,
          ...(value19 !== undefined && value19.length > 0
            ? {
                annotations: value19,
              }
            : {}),
          ...(value20 !== undefined && value20.length > 0
            ? {
                pages: value20,
              }
            : {}),
        },
        keepBoards: values5,
        keepNotes: values6,
        keepPages: values7,
      };
    }
    function serializeDocumentIndex(
      input?: Dynamic,
      options2?: Dynamic,
    ): Dynamic {
      let value14: Dynamic = (0, runtime.cloneIndexValue)(indexState.get());
      (0, runtime.updateDesignIndexFromDocument)(
        value14,
        input.manifest,
        options2,
        input.keepBoards,
        input.keepNotes,
        input.keepPages,
      );
      return (0, runtime.stringifyCanonicalIndex)(value14);
    }
    let values2: Dynamic = new Set();
    function rememberManifestDeletions(input?: Dynamic): Dynamic {
      for (let value14 of (input.annotations ?? []) as Dynamic)
        keptNoteIds.has(value14.id) || removedNoteIds.add(value14.id);
      for (let value14 of (input.pages ?? []) as Dynamic)
        keptPageIds.has(value14.id) || removedPageIds.add(value14.id);
    }
    let text: Dynamic = "",
      values3: Dynamic = new Set(),
      values4: Dynamic = new Set(),
      value9: Dynamic;
    function scheduleFileSave(): Dynamic {
      value9 !== undefined ||
        disposed ||
        (value9 = timers.setTimeout((): Dynamic => {
          value9 = undefined;
          !(disposed || loadState !== "live") &&
            (value8 !== undefined &&
              (timers.clearTimeout(value8),
              (value8 = undefined),
              publishLocalChanges()),
            adoptRemoteFiles({
              ...state.content.files,
            }));
        }, 0));
    }
    function publishLocalChanges(): Dynamic {
      if (disposed || !canWrite) return;
      let files: Dynamic = state.content.files,
        flag2: Dynamic = false;
      for (let [value20, value21] of Object.entries(files) as Dynamic) {
        if (
          value20 === runtime.canvasMetadataFile ||
          loadedFiles[value20] === value21
        )
          continue;
        if (isMissingRequiredDesignFile(value20)) {
          loadedFiles[value20] = value21;
          values4.has(value20) ||
            (values4.add(value20),
            options.onNotice?.(describeReservedDesignFilename(value20)));
          continue;
        }
        let value22: Dynamic = (0, runtime.toProjectContentPath)(value20);
        if (!resolvingClashes.has(value20)) {
          if (fileDirtyVersions.has(value20) && !boardClashes.has(value20)) {
            if (callback8(value20)) {
              heldRemoteFiles.add(value20);
              scheduleHeldRemoteCheck();
              continue;
            }
            handleBoardClash(value22, null, "remote-while-editing");
            continue;
          }
          if (boardClashes.has(value20)) {
            let entry2: Dynamic = boardClashes.get(value20);
            entry2.ask !== undefined &&
              entry2.askedAt !== undefined &&
              timers.now() - entry2.askedAt > 2e4 &&
              ((entry2.askedAt = timers.now()), entry2.ask());
            continue;
          }
          if (callback7(value22)) {
            if (callback8(value20)) {
              heldRemoteFiles.add(value20);
              scheduleHeldRemoteCheck();
              continue;
            }
            handleBoardClash(
              value22,
              publishedHashes.get(value22) ?? null,
              "remote-while-editing",
            );
            continue;
          }
          loadedFiles[value20] = value21;
          missingBoards.delete(value20);
          if (!canSaveDesignFile(value20)) {
            values3.has(value20) ||
              (values3.add(value20),
              options.onNotice?.(describeUnsupportedDesignFile(value20)));
            continue;
          }
          value.markDirty(
            value22,
            (): Dynamic =>
              encodeDesignPortFile(
                value20,
                state.content.files[value20] ?? value21,
              ),
            liveHashes.get(value22) ?? null,
          );
          flag2 = true;
        }
      }
      for (let value20 of Object.keys(loadedFiles) as Dynamic) {
        if (value20 === runtime.canvasMetadataFile || value20 in files)
          continue;
        delete loadedFiles[value20];
        let value21: Dynamic = (0, runtime.toProjectContentPath)(value20);
        !canSaveDesignFile(value20) ||
          isMissingRequiredDesignFile(value20) ||
          (value.markDirty(
            value21,
            (): Dynamic => null,
            liveHashes.get(value21) ?? null,
          ),
          (0, runtime.isArtboardFile)(value20) && values2.add(value20),
          (flag2 = true));
      }
      for (let value20 of [...values2] as Dynamic)
        value20 in files && values2.delete(value20);
      let value14: Dynamic = parseCurrentManifest(files),
        {
          manifest: value15,
          keepBoards: value16,
          keepNotes: value17,
          keepPages: value18,
        }: Dynamic = value14,
        value19: Dynamic = indexState.serialize(),
        callback19: Dynamic = (input?: Dynamic): Dynamic =>
          serializeDocumentIndex(value14, input) !== value19;
      !(
        indexState.baseSha() === null &&
        state.title === defaultTitle &&
        !callback19(indexState.get().title)
      ) &&
        callback19(state.title) &&
        (indexState.update(
          (input?: Dynamic): Dynamic =>
            (0, runtime.updateDesignIndexFromDocument)(
              input,
              value15,
              state.title,
              value16,
              value17,
              value18,
            ),
        ),
        (flag2 = true));
      let entry: Dynamic = indexState.get();
      for (let value20 of [...removedNoteIds] as Dynamic)
        value20 in entry.notes || removedNoteIds.delete(value20);
      for (let value20 of [...removedPageIds] as Dynamic)
        callback(entry.pages).some(
          (input?: Dynamic): Dynamic => input.id === value20,
        ) || removedPageIds.delete(value20);
      for (let value20 of [...values2] as Dynamic)
        value20 in entry.boards || values2.delete(value20);
      loadedFiles[runtime.canvasMetadataFile] =
        files[runtime.canvasMetadataFile] ??
        loadedFiles[runtime.canvasMetadataFile] ??
        "";
      flag2 && value.commit();
      notifySave();
    }
    function replaceDocument(input?: Dynamic): Dynamic {
      state = input;
      rememberArtboards(input.content.files);
      notifyContent(false);
      scheduleLocalSave();
    }
    let callback8: Dynamic = (input?: Dynamic): Dynamic =>
        options.holdRemote?.(input) === true,
      callback9: Dynamic = (input?: Dynamic): Dynamic =>
        state.content.files[input] !== loadedFiles[input];
    function adoptRemoteFiles(input?: Dynamic): Dynamic {
      for (let value16 of [...value.unsendable().keys()] as Dynamic) {
        let value17: Dynamic = (0, runtime.fromProjectContentPath)(
          value16,
          "design",
        );
        value17 !== undefined &&
          (input[value17] === undefined ||
            input[value17] === savedFiles[value17]) &&
          value.withdraw(value16);
      }
      let value14: Dynamic = composeFromFiles(input);
      loadedFiles = {
        ...loadedFiles,
        [runtime.canvasMetadataFile]: value14.files[runtime.canvasMetadataFile],
      };
      let value15: Dynamic =
        (0, runtime.normalizeDocumentTitle)(indexState.get().title.trim()) ??
        state.title;
      state = {
        ...state,
        title: value15,
        content: value14,
      };
      notifyContent(true);
    }
    async function handleRemoteUpdate(input?: Dynamic): Promise<Dynamic> {
      if (loadState === "failed") {
        let value22: Dynamic =
          value5 === undefined
            ? 0
            : (0, runtime.getRestartDelay)(
                value5.error,
                input,
                DESIGN_INDEX_FILE_PATH,
                timers.now() - value5.at,
              );
        value22 === 0
          ? retryFailedLoad()
          : value22 !== undefined && scheduleLoadRetry(value22);
      }
      loadState === "loading" &&
        (await (value11 ?? value13).catch((): Dynamic => {}));
      if (disposed || loadState !== "live") return;
      let value14: Dynamic = timers.now(),
        callback19: Dynamic = (): Dynamic => {
          value8 !== undefined &&
            (timers.clearTimeout(value8),
            (value8 = undefined),
            publishLocalChanges());
        };
      callback19();
      let values5: Dynamic = new Set(),
        value15: Dynamic = input.changed.filter(
          (input2?: Dynamic): Dynamic =>
            input2.sha256 === null
              ? liveHashes.has(input2.path) ||
                (publishedHashes.get(input2.path) ?? null) !== null
              : liveHashes.get(input2.path) !== input2.sha256,
        ),
        value16: Dynamic = value15.filter(
          (input2?: Dynamic): Dynamic =>
            input2.path !== DESIGN_INDEX_FILE_PATH &&
            ownChangedHashes.has(input2.path) &&
            ownChangedHashes.get(input2.path) ===
              (liveHashes.get(input2.path) ?? null) &&
            input2.sha256 !== ownChangedHashes.get(input2.path),
        );
      if (value16.length > 0) {
        let liveSha: Dynamic = options.port.liveSha,
          wroteSinceAdopt: Dynamic = options.port.wroteSinceAdopt,
          value22: Dynamic =
            typeof wroteSinceAdopt != "function"
              ? undefined
              : {
                  call: (input2?: Dynamic, options2?: Dynamic): Dynamic => {
                    try {
                      return (
                        wroteSinceAdopt.call(options.port, options2) === true
                      );
                    } catch {
                      return false;
                    }
                  },
                },
          callback20: Dynamic = (input2?: Dynamic): Dynamic =>
            value22 !== undefined && value22.call(options.port, input2) === true
              ? liveSha?.call(options.port, input2)
              : undefined,
          value23: Dynamic;
        value22 !== undefined &&
          value16.some(
            (input2?: Dynamic): Dynamic =>
              value22.call(options.port, input2.path) === true &&
              liveSha?.call(options.port, input2.path) === undefined,
          ) &&
          (value23 = await trackedPort.list().then(
            (input2?: Dynamic): Dynamic =>
              new Map(
                input2.map(
                  (input3?: Dynamic): Dynamic => [input3.path, input3.sha256],
                ),
              ),
            (): Dynamic => {},
          ));
        if (disposed) return;
        let state3: Dynamic = {
          get: (input2?: Dynamic): Dynamic => {
            if (
              value22 === undefined ||
              value22.call(options.port, input2) !== true
            )
              return;
            let value24: Dynamic = callback20(input2);
            return value24 !== undefined
              ? value24
              : value23 === undefined
                ? undefined
                : (value23.get(input2) ?? null);
          },
        };
        {
          let value24: Dynamic = value16.filter(
            (input2?: Dynamic): Dynamic =>
              state3.get(input2.path) !== undefined &&
              (state3.get(input2.path) ?? null) ===
                ownChangedHashes.get(input2.path),
          );
          value15 = value15.filter(
            (input2?: Dynamic): Dynamic => !value24.includes(input2),
          );
          for (let value25 of value24 as Dynamic) {
            let value26: Dynamic = (0, runtime.fromProjectContentPath)(
              value25.path,
              "design",
            );
            value25.sha256 === null &&
              value26 !== undefined &&
              (0, runtime.isArtboardFile)(value26) &&
              values5.add(value26);
          }
        }
      }
      for (let value22 of value15 as Dynamic)
        publishedHashes.set(value22.path, value22.sha256);
      let values6: Dynamic = new Set(),
        items2: Dynamic = [],
        items3: Dynamic = [];
      for (let value22 of value15 as Dynamic) {
        if (value22.path === DESIGN_INDEX_FILE_PATH) continue;
        let value23: Dynamic = (0, runtime.fromProjectContentPath)(
          value22.path,
          "design",
        );
        if (value23 !== undefined) {
          if (value22.sha256 === null) {
            (0, runtime.isArtboardFile)(value23) &&
              !fileDirtyVersions.has(value23) &&
              fileDirtyVersions.set(
                value23,
                (0, runtime.cloneIndexValue)(indexState.get().boards[value23]),
              );
            if (value23 in state.content.files) {
              if (boardClashes.has(value23)) {
                boardClashes.set(value23, {
                  ...boardClashes.get(value23),
                  theirsSha: null,
                });
                continue;
              }
              if (callback8(value23)) {
                heldRemoteFiles.add(value23);
                scheduleHeldRemoteCheck();
                continue;
              }
              if ((0, runtime.isArtboardFile)(value23) && callback10(value23)) {
                items3.push(value23);
                continue;
              }
            }
            values6.add(value23);
            liveHashes.delete(value22.path);
            heldRemoteFiles.delete(value23);
            continue;
          }
          fileDirtyVersions.delete(value23);
          if (
            validateListedDesignFile({
              path: value22.path,
              size: 0,
            }) !== null &&
            liveHashes.get(value22.path) !== value22.sha256
          ) {
            if (boardClashes.has(value23)) {
              boardClashes.set(value23, {
                ...boardClashes.get(value23),
                theirsSha: value22.sha256,
              });
              continue;
            }
            if (callback8(value23)) {
              heldRemoteFiles.add(value23);
              scheduleHeldRemoteCheck();
              continue;
            }
            if (callback10(value23)) {
              items3.push(value23);
              continue;
            }
            items2.push(value23);
          }
        }
      }
      let value17: Dynamic = await readFiles(items2),
        value18: Dynamic = value15.find(
          (input2?: Dynamic): Dynamic => input2.path === DESIGN_INDEX_FILE_PATH,
        ),
        flag2: Dynamic = false;
      if (
        value18 !== undefined &&
        value18.sha256 !== null &&
        liveHashes.get(DESIGN_INDEX_FILE_PATH) !== value18.sha256
      )
        try {
          callback19();
          callback3(await indexState.reloadAndMerge());
          liveHashes.set(DESIGN_INDEX_FILE_PATH, value18.sha256);
          flag2 = true;
        } catch (value22: Dynamic) {
          console.warn(
            "design (files): canvas.json changed but could not be read \u2014 " +
              (value22 instanceof Error ? value22.message : String(value22)),
          );
        }
      let value19: Dynamic = flag2
          ? Object.keys(indexState.get().boards)
              .filter(
                (input2?: Dynamic): Dynamic =>
                  !(input2 in state.content.files) &&
                  !items2.includes(input2) &&
                  !values6.has(input2) &&
                  (publishedHashes.get(
                    (0, runtime.toProjectContentPath)(input2),
                  ) ?? null) !== null &&
                  validateListedDesignFile({
                    path: (0, runtime.toProjectContentPath)(input2),
                    size: 0,
                  }) !== null,
              )
              .slice(
                0,
                Math.max(
                  0,
                  runtime.PlatformFileContentFilesValue -
                    1 -
                    Object.keys(state.content.files).length,
                ),
              )
          : [],
        value20: Dynamic = await readFiles(value19);
      if (disposed) return;
      callback19();
      let state2: Dynamic = {
          ...state.content.files,
        },
        value21: Dynamic = flag2;
      for (let value22 of value19 as Dynamic)
        value20[value22] === undefined ||
          value22 in state2 ||
          ((state2[value22] = value20[value22]),
          (loadedFiles[value22] = value20[value22]),
          (savedFiles[value22] = value20[value22]),
          liveHashes.set(
            (0, runtime.toProjectContentPath)(value22),
            publishedHashes.get((0, runtime.toProjectContentPath)(value22)),
          ));
      let items4: Dynamic = [];
      for (let value22 of values6 as Dynamic)
        value22 in state2 &&
          (delete state2[value22],
          delete loadedFiles[value22],
          delete savedFiles[value22],
          overwrittenEdits.delete(value22),
          (value21 = true));
      for (let value22 of items2 as Dynamic) {
        if (value17[value22] === undefined) continue;
        if (
          callback9(value22) ||
          (state2[value22] !== undefined &&
            savedFiles[value22] !== undefined &&
            state2[value22] !== savedFiles[value22] &&
            state2[value22] !== value17[value22])
        ) {
          items3.push(value22);
          continue;
        }
        let value23: Dynamic = reapplyOverwrittenEdit(
          value22,
          value17[value22],
        );
        value23 !== undefined && items4.push(value23);
        state2[value22] = value17[value22];
        loadedFiles[value22] = value17[value22];
        savedFiles[value22] = value17[value22];
        liveHashes.set(
          (0, runtime.toProjectContentPath)(value22),
          publishedHashes.get((0, runtime.toProjectContentPath)(value22)) ??
            liveHashes.get((0, runtime.toProjectContentPath)(value22)),
        );
        value21 = true;
      }
      value21 && adoptRemoteFiles(state2);
      for (let value22 of values5 as Dynamic) {
        fileDirtyVersions.delete(value22);
        delete loadedFiles[runtime.canvasMetadataFile];
      }
      for (let value22 of items4 as Dynamic)
        offerOverwrittenEditNotice(value22);
      for (let value22 of items3 as Dynamic)
        await handleBoardClash(
          (0, runtime.toProjectContentPath)(value22),
          publishedHashes.get((0, runtime.toProjectContentPath)(value22)) ??
            null,
          "remote-while-editing",
        );
      options.debug?.event("apply", {
        to: input.to.version,
        rows: input.changed.map((input2?: Dynamic): Dynamic => input2.path),
        alreadyTrue: input.changed.length - value15.length,
        boardsReread: items2.filter(
          (input2?: Dynamic): Dynamic => value17[input2] !== undefined,
        ),
        removed: [...values6],
        held: [...heldRemoteFiles],
        folded: items3,
        indexMerged: value18 !== undefined,
        recomposed: value21,
        ms: timers.now() - value14,
      });
    }
    async function applyClashResolution(
      input?: Dynamic,
      options2: Dynamic = false,
      context?: Dynamic,
    ): Promise<Dynamic> {
      let value14: Dynamic = (0, runtime.fromProjectContentPath)(
        input.path,
        "design",
      );
      if (value14 === undefined) return false;
      let value15: Dynamic =
        input.theirsSha === null
          ? undefined
          : (await readFiles([value14]))[value14];
      if (
        disposed ||
        (input.theirsSha !== null && value15 === undefined) ||
        (context !== undefined && !context())
      )
        return false;
      let value16: Dynamic = value14.replace(/\.dc\.html$/, "");
      !options2 && options.sameBoardRule === "first"
        ? notice(
            value16 +
              (input.theirsSha === null
                ? " deleted remotely"
                : " changed remotely"),
          )
        : !options2 &&
          options.sameBoardRule !== "last" &&
          notice(
            "\u201C" +
              value16 +
              "\u201D was changed by someone else while you were editing it. Their version was loaded; your last change to it was not saved.",
          );
      heldRemoteFiles.delete(value14);
      overwrittenEdits.delete(value14);
      let state2: Dynamic = {
        ...state.content.files,
      };
      value15 === undefined
        ? (delete state2[value14],
          delete loadedFiles[value14],
          delete savedFiles[value14],
          liveHashes.delete(input.path))
        : ((state2[value14] = value15),
          (loadedFiles[value14] = value15),
          (savedFiles[value14] = value15),
          liveHashes.set(input.path, input.theirsSha));
      adoptRemoteFiles(state2);
      return true;
    }
    let callback10: Dynamic = (input?: Dynamic): Dynamic =>
        callback9(input) ||
        callback11(input) ||
        (savedFiles[input] !== undefined &&
          state.content.files[input] !== undefined &&
          state.content.files[input] !== savedFiles[input]),
      callback11: Dynamic = (input?: Dynamic): Dynamic =>
        state.content.files[input] !== undefined &&
        savedFiles[input] === undefined &&
        !liveHashes.has((0, runtime.toProjectContentPath)(input)),
      callback12: Dynamic = (input?: Dynamic): Dynamic =>
        input in state.content.files ||
        fileDirtyVersions.has(input) ||
        liveHashes.has((0, runtime.toProjectContentPath)(input)) ||
        (publishedHashes.get((0, runtime.toProjectContentPath)(input)) ??
          null) !== null;
    function nextDuplicateFilename(input?: Dynamic): Dynamic {
      let value14: Dynamic = input.replace(/\.dc\.html$/, ""),
        value15: Dynamic = /^(.*) (\d+)$/.exec(value14),
        value16: Dynamic = value15 ? value15[1] : value14;
      for (
        let value17: Dynamic = value15 ? Number(value15[2]) + 1 : 2;
        ;
        value17++
      ) {
        let value18: Dynamic = value16 + " " + String(value17) + ".dc.html";
        if (!callback12(value18)) return value18;
      }
    }
    let value10: Dynamic;
    function scheduleHeldRemoteCheck(): Dynamic {
      value10 !== undefined ||
        disposed ||
        (value10 = timers.setTimeout((): Dynamic => {
          value10 = undefined;
          for (let value14 of [...heldRemoteFiles] as Dynamic)
            callback8(value14) || releaseHeldFile(value14);
          heldRemoteFiles.size > 0 && scheduleHeldRemoteCheck();
        }, options.heldCheckMs ?? 400));
    }
    function releaseHeldFile(input?: Dynamic): Dynamic {
      heldRemoteFiles.delete(input);
      let value14: Dynamic = (0, runtime.toProjectContentPath)(input);
      callback10(input)
        ? handleBoardClash(
            value14,
            publishedHashes.get(value14) ?? null,
            "remote-while-editing",
          )
        : handleRemoteUpdate({
            from: trackedPort.version(),
            to: trackedPort.version(),
            changed: [
              {
                path: value14,
                sha256: publishedHashes.get(value14) ?? null,
              },
            ],
          });
    }
    async function handleBoardClash(
      input?: Dynamic,
      options2?: Dynamic,
      context?: Dynamic,
    ): Promise<Dynamic> {
      let value14: Dynamic = (0, runtime.fromProjectContentPath)(
        input,
        "design",
      );
      if (value14 === undefined || disposed || resolvingClashes.has(value14))
        return;
      if (boardClashes.has(value14)) {
        boardClashes.set(value14, {
          ...boardClashes.get(value14),
          theirsSha: options2,
        });
        return;
      }
      let value15: Dynamic = state.content.files[value14];
      if (
        value15 === undefined ||
        (!(0, runtime.isArtboardFile)(value14) &&
          options.sameBoardRule !== "last")
      )
        return void (await applyClashResolution({
          path: input,
          base: liveHashes.get(input) ?? null,
          mine: value15 ?? null,
          theirsSha: options2,
        }));
      if (
        options2 !== null &&
        (0, runtime.isArtboardFile)(value14) &&
        callback11(value14)
      )
        return adoptIdenticalBoard(value14, value15, options2);
      if (options.sameBoardRule === "last") {
        if (
          !callback10(value14) &&
          options2 !== (liveHashes.get(input) ?? null)
        ) {
          value.withdraw(input);
          return void handleRemoteUpdate({
            from: trackedPort.version(),
            to: trackedPort.version(),
            changed: [
              {
                path: input,
                sha256: options2,
              },
            ],
          });
        }
        publishedHashes.set(input, options2);
        options2 === null
          ? (liveHashes.delete(input), fileDirtyVersions.delete(value14))
          : liveHashes.set(input, options2);
        delete loadedFiles[value14];
        heldRemoteFiles.delete(value14);
        scheduleLocalSave();
        return;
      }
      if (options2 !== null && liveHashes.get(input) === options2) {
        options.sameBoardRule === "first" &&
          value.resolveConflict(input, "theirs");
        savedFiles[value14] !== undefined &&
          (loadedFiles[value14] = savedFiles[value14]);
        scheduleLocalSave();
        return;
      }
      if (options.sameBoardRule === "first") {
        if (callback8(value14)) {
          heldRemoteFiles.add(value14);
          publishedHashes.set(input, options2);
          scheduleHeldRemoteCheck();
          return;
        }
        resolvingClashes.add(value14);
        try {
          let flag2: Dynamic = false;
          if (
            (await applyClashResolution(
              {
                path: input,
                base: liveHashes.get(input) ?? null,
                mine: value15,
                theirsSha: options2,
              },
              false,
              (): Dynamic => (
                (flag2 = callback8(value14)),
                flag2
                  ? false
                  : (value.withdraw(input),
                    (0, runtime.ModelHistoryRebaseSet)(value14),
                    true)
              ),
            )) ||
            disposed
          )
            return void pendingReadVersions.delete(value14);
          publishedHashes.set(input, options2);
          if (flag2) {
            heldRemoteFiles.add(value14);
            scheduleHeldRemoteCheck();
            return;
          }
          let value17: Dynamic = pendingReadVersions.get(value14) ?? {
            tries: 0,
          };
          if (value17.timer !== undefined) return;
          if (value17.tries >= DESIGN_BOOT_MAX_ATTEMPTS) {
            pendingReadVersions.delete(value14);
            notice(
              value14.replace(/\.dc\.html$/, "") +
                " changed remotely; reload to load it",
            );
            return;
          }
          value17.tries += 1;
          value17.timer = timers.setTimeout(
            (): Dynamic => {
              value17.timer = undefined;
              disposed || releaseHeldFile(value14);
            },
            Math.min(6e4, DESIGN_RESTART_DELAY_MS * 2 ** (value17.tries - 1)),
          );
          pendingReadVersions.set(value14, value17);
        } finally {
          resolvingClashes.delete(value14);
        }
        return;
      }
      resolvingClashes.add(value14);
      let value16: Dynamic = timers.now();
      try {
        let value17: Dynamic = savedFiles[value14],
          value18: Dynamic;
        options2 !== null && (value18 = (await readFiles([value14]))[value14]);
        if (disposed) return;
        let value19: Dynamic = state.content.files[value14] ?? value15,
          value20: Dynamic,
          value21: Dynamic;
        options2 === null
          ? (value21 = "the board was deleted by someone else")
          : value18 === undefined
            ? (value21 = "their version could not be read")
            : value17 === undefined
              ? (value21 = "this tab does not know what its edits started from")
              : ((value20 = (0, runtime.mergeDcDocuments)(
                  value17,
                  value19,
                  value18,
                )),
                value20.ok || (value21 = value20.why));
        let state2: Dynamic = {
          file: value14,
          trigger: context,
          ok: value20?.ok === true,
          ...(value21 !== undefined
            ? {
                why: value21,
              }
            : {}),
          ...(value20 !== undefined
            ? {
                regions: value20.regions,
                guard: value20.guard,
              }
            : {}),
          applied: value20?.applied.length ?? 0,
          overlaps: value20?.overlaps.length ?? 0,
          ms: timers.now() - value16,
        };
        undoHistory.push(state2);
        undoHistory.length > 100 && undoHistory.shift();
        options.debug?.event("reconcile", {
          ...state2,
          ...(value20 !== undefined
            ? {
                appliedList: value20.applied.slice(0, 24),
                overlapList: value20.overlaps.slice(0, 24),
              }
            : {}),
        });
        if (
          value20?.ok === true &&
          value20.merged !== undefined &&
          value18 !== undefined &&
          options2 !== null
        ) {
          let state3: Dynamic = {
            ...state.content.files,
            [value14]: value20.merged,
          };
          savedFiles[value14] = value18;
          loadedFiles[value14] = value18;
          liveHashes.set(input, options2);
          publishedHashes.set(input, options2);
          heldRemoteFiles.delete(value14);
          let value22: Dynamic = reapplyOverwrittenEdit(value14, value18);
          adoptRemoteFiles(state3);
          value20.merged !== value18 && scheduleLocalSave();
          value20.overlaps.length > 0 &&
            notice(describeIndexMergeConflict(value14, value20.overlaps));
          value22 !== undefined && offerOverwrittenEditNotice(value22);
          return;
        }
        offerBoardClashNotice(
          value14,
          input,
          options2,
          value18,
          value21 ?? "the two versions could not be folded together",
        );
      } finally {
        resolvingClashes.delete(value14);
      }
    }
    async function adoptIdenticalBoard(
      input?: Dynamic,
      options2?: Dynamic,
      context?: Dynamic,
    ): Promise<Dynamic> {
      resolvingClashes.add(input);
      try {
        if (
          (0, runtime.sha256Fallback)(
            (0, runtime.PlatformSha256Encode)(options2),
          ) === context
        ) {
          loadedFiles[input] = options2;
          savedFiles[input] = options2;
          liveHashes.set((0, runtime.toProjectContentPath)(input), context);
          value.resolveConflict(
            (0, runtime.toProjectContentPath)(input),
            "theirs",
          );
          return;
        }
        let value14: Dynamic = nextDuplicateFilename(input);
        knownArtboardFiles.add(value14);
        let value15: Dynamic = (0, runtime.cloneIndexValue)(
          indexState.get().boards[input],
        );
        indexState.update((input2?: Dynamic): Dynamic => {
          input2.boards[value14] = value15 ?? {
            x: 0,
            y: 0,
            w: 1280,
            h: 720,
          };
          let value17: Dynamic = input2.order.indexOf(input);
          input2.order.splice(
            value17 < 0 ? input2.order.length : value17 + 1,
            0,
            value14,
          );
        });
        let value16: Dynamic = (await readFiles([input]))[input];
        if (disposed) return;
        let state2: Dynamic = {
          ...state.content.files,
          [value14]: state.content.files[input] ?? options2,
        };
        delete loadedFiles[input];
        value16 === undefined
          ? delete state2[input]
          : ((state2[input] = value16),
            (loadedFiles[input] = value16),
            (savedFiles[input] = value16),
            liveHashes.set((0, runtime.toProjectContentPath)(input), context));
        value.resolveConflict(
          (0, runtime.toProjectContentPath)(input),
          "theirs",
        );
        options.debug?.event("moved-aside", {
          file: input,
          as: value14,
        });
        adoptRemoteFiles(state2);
        scheduleLocalSave();
      } finally {
        resolvingClashes.delete(input);
      }
    }
    function reapplyOverwrittenEdit(
      input?: Dynamic,
      options2?: Dynamic,
    ): Dynamic {
      let entry: Dynamic = overwrittenEdits.get(input);
      if (
        entry === undefined ||
        (overwrittenEdits.delete(input), options2 === entry.mine)
      )
        return;
      let value14: Dynamic = (0, runtime.mergeDcDocuments)(
        entry.base,
        entry.mine,
        options2,
      );
      if (
        !value14.ok ||
        value14.merged === undefined ||
        value14.merged === options2
      )
        return;
      value14.overlaps.length > 0 &&
        timers.now() - entry.at < DESIGN_BOOT_MAX_WAIT_MS &&
        notice(describeSamePropertyConflict(input, value14.overlaps));
      let callback19: Dynamic = (source?: Dynamic): Dynamic =>
        value14.overlaps.some(
          (source2?: Dynamic): Dynamic =>
            source2.tid === source.tid &&
            source2.kind === source.kind &&
            source2.name === source.name,
        );
      return value14.regions.template === "mine" ||
        value14.regions.script === "mine" ||
        value14.regions.outer === "mine" ||
        value14.applied.some((input2?: Dynamic): Dynamic => !callback19(input2))
        ? entry
        : undefined;
    }
    function offerOverwrittenEditNotice(input?: Dynamic): Dynamic {
      options.debug?.event("save-dropped", {
        file: input.file,
      });
      let flag2: Dynamic = false,
        callback19: Dynamic = (): Dynamic => {
          if (flag2 || disposed) return;
          flag2 = true;
          let value14: Dynamic = state.content.files[input.file];
          if (value14 === undefined) return;
          let value15: Dynamic = (0, runtime.mergeDcDocuments)(
            input.base,
            input.mine,
            value14,
          );
          if (
            !value15.ok ||
            value15.merged === undefined ||
            value15.merged === value14
          ) {
            notice(
              "Your change to \u201C" +
                input.file.replace(/\.dc\.html$/, "") +
                "\u201D could not be put back on top of the newer version (" +
                (value15.why ?? "nothing to put back") +
                ").",
            );
            return;
          }
          adoptRemoteFiles({
            ...state.content.files,
            [input.file]: value15.merged,
          });
          scheduleLocalSave();
        };
      if (options.onSaveDropped !== undefined) {
        try {
          options.onSaveDropped({
            file: input.file,
            putBack: callback19,
          });
        } catch {}
        return;
      }
      notice(
        "\u201C" +
          input.file.replace(/\.dc\.html$/, "") +
          "\u201D was saved over by a version that leaves out a change you had saved.",
      );
    }
    function createMyCopy(
      input?: Dynamic,
      options2?: Dynamic,
      context: Dynamic = false,
    ): Dynamic {
      let files: Dynamic = state.content.files,
        value14: Dynamic = input.replace(/\.dc\.html$/, ""),
        value15: Dynamic = value14 + " my copy.dc.html",
        value16: Dynamic = context
          ? nextDuplicateFilename(input)
          : callback12(value15)
            ? nextDuplicateFilename(value15)
            : value15,
        value17: Dynamic = (0, runtime.parseCanvasMetadata)(
          files[runtime.canvasMetadataFile],
          files,
        ),
        value18: Dynamic = value17.artboards.find(
          (input2?: Dynamic): Dynamic => input2.file === input,
        ),
        state2: Dynamic = {
          ...value17,
          artboards: [
            ...value17.artboards,
            {
              ...(value18 ?? {
                x: 0,
                y: 0,
                w: 1280,
                h: 720,
              }),
              file: value16,
              x: (value18?.x ?? 0) + (value18?.w ?? 1280) + 80,
              ...(context
                ? {}
                : {
                    title: (value18?.title ?? value14) + " (my copy)",
                  }),
            },
          ],
        },
        state3: Dynamic = {
          ...files,
          [value16]: options2,
        };
      replaceDocument({
        ...state,
        content: {
          files: {
            ...state3,
            [runtime.canvasMetadataFile]: (0, runtime.serializeCanvasMetadata)(
              (0, runtime.parseCanvasMetadata)(
                (0, runtime.serializeCanvasMetadata)(state2),
                state3,
              ),
            ),
          },
        },
      });
      return value16;
    }
    function offerBoardClashNotice(
      input?: Dynamic,
      options2?: Dynamic,
      context?: Dynamic,
      value14?: Dynamic,
      extra?: Dynamic,
    ): Dynamic {
      let value15: Dynamic = state.content.files[input];
      if (options.onBoardClash === undefined || value15 === undefined) {
        applyClashResolution({
          path: options2,
          base: liveHashes.get(options2) ?? null,
          mine: value15 ?? null,
          theirsSha: context,
        });
        return;
      }
      boardClashes.set(input, {
        theirsSha: context,
      });
      let flag2: Dynamic = false,
        value16: Dynamic = context,
        callback19: Dynamic = (): Dynamic =>
          publishedHashes.has(options2)
            ? (publishedHashes.get(options2) ?? null)
            : value16,
        callback20: Dynamic =
          (input2?: Dynamic, options3?: Dynamic): Dynamic =>
          (): Dynamic => {
            if (flag2 || disposed) return;
            flag2 = true;
            let entry: Dynamic = boardClashes.get(input);
            value16 = entry !== undefined ? entry.theirsSha : context;
            boardClashes.delete(input);
            resolvingClashes.add(input);
            options.debug?.event("reconcile-choice", {
              file: input,
              choice: input2,
            });
            Promise.resolve(
              options3(state.content.files[input] ?? value15),
            ).finally((): Dynamic => {
              resolvingClashes.delete(input);
              scheduleLocalSave();
            });
          },
        callback21: Dynamic = (): Dynamic =>
          applyClashResolution(
            {
              path: options2,
              base: liveHashes.get(options2) ?? null,
              mine: value15,
              theirsSha: callback19(),
            },
            true,
          ).then((): Dynamic => {});
      function value17(): Dynamic {
        let value19: Dynamic = callback19();
        value19 === null
          ? (liveHashes.delete(options2), fileDirtyVersions.delete(input))
          : liveHashes.set(options2, value19);
        value14 !== undefined && value19 !== null
          ? ((savedFiles[input] = value14), (loadedFiles[input] = value14))
          : (delete savedFiles[input], delete loadedFiles[input]);
      }
      async function value18(input2?: Dynamic): Promise<Dynamic> {
        await callback21();
        disposed || createMyCopy(input, input2);
      }
      let state2: Dynamic = {
          file: input,
          why: extra,
          get deleted(): Dynamic {
            return callback19() === null;
          },
          takeTheirs: callback20("take theirs", callback21),
          keepMine: callback20("keep mine", value17),
          keepMineAsCopy: callback20("keep mine as a copy", value18),
        },
        callback22: Dynamic = (): Dynamic => {
          try {
            options.onBoardClash?.(state2);
          } catch {}
        };
      boardClashes.set(input, {
        theirsSha: context,
        askedAt: timers.now(),
        ask: callback22,
      });
      callback22();
    }
    let callback13: Dynamic = (input?: Dynamic): Dynamic =>
        input === DESIGN_INDEX_FILE_PATH
          ? (liveHashes.get(DESIGN_INDEX_FILE_PATH) ?? null)
          : publishedHashes.has(input)
            ? (publishedHashes.get(input) ?? null)
            : (liveHashes.get(input) ?? null),
      index4: Dynamic = 0,
      items: Dynamic = [];
    function offerCrashStash(): Dynamic {
      let value14: Dynamic = value7;
      if (value14 === undefined) return;
      index4 = value14.edits.filter(
        (input?: Dynamic): Dynamic => input.base !== callback13(input.path),
      ).length;
      let state2: Dynamic = {
        files: value14.edits.length,
        changedSince: index4,
        at: value14.at,
        restore: restoreCrashStash,
        discard: discardCrashStash,
        whenAnswered: (input?: Dynamic): Dynamic => {
          items.push(input);
        },
      };
      try {
        options.onStashOffer?.(state2);
      } catch {}
    }
    function restoreCrashStash(): Dynamic {
      let value14: Dynamic = value7;
      if (
        !(
          value14 === undefined ||
          !canWrite ||
          loadState !== "live" ||
          disposed
        )
      ) {
        if (
          value14.edits.filter(
            (input?: Dynamic): Dynamic => input.base !== callback13(input.path),
          ).length > index4
        ) {
          offerCrashStash();
          return;
        }
        clearCrashStashOffer();
        index3 += 1;
        applyStashedContent(value14);
      }
    }
    function discardCrashStash(): Dynamic {
      value7 !== undefined &&
        (clearCrashStashOffer(),
        options.saveStash?.clearOffered(),
        notifyContent(false));
    }
    function clearCrashStashOffer(): Dynamic {
      value7 = undefined;
      for (let value14 of items.splice(0) as Dynamic)
        try {
          value14();
        } catch {}
    }
    function applyStashedContent(input?: Dynamic): Dynamic {
      let state2: Dynamic = {
          ...state.content.files,
        },
        items2: Dynamic = [],
        items3: Dynamic = [],
        items4: Dynamic = [],
        items5: Dynamic = [];
      for (let value15 of input.edits as Dynamic) {
        let value16: Dynamic =
          value15.path === DESIGN_INDEX_FILE_PATH
            ? undefined
            : (0, runtime.fromProjectContentPath)(value15.path, "design");
        if (value16 === undefined) continue;
        let value17: Dynamic = callback13(value15.path);
        if (value15.text === null) {
          value15.base !== null && value15.base === value17 && value16 in state2
            ? delete state2[value16]
            : value17 !== null && items3.push(value16);
          continue;
        }
        if (value15.base === value17) {
          state2[value16] = value15.text;
          continue;
        }
        if (
          (0, runtime.isArtboardFile)(value16) &&
          value17 !== null &&
          options.sameBoardRule === "first"
        ) {
          items4.push({
            p: value16,
            text: value15.text,
          });
          continue;
        }
        if (
          options.sameBoardRule === "last" &&
          (0, runtime.isArtboardFile)(value16) &&
          value15.base === null &&
          value17 !== null
        ) {
          items5.push({
            p: value16,
            text: value15.text,
          });
          continue;
        }
        if (options.sameBoardRule === "last") {
          state2[value16] = value15.text;
          value17 === null
            ? (liveHashes.delete(value15.path),
              fileDirtyVersions.delete(value16))
            : liveHashes.set(value15.path, value17);
          delete loadedFiles[value16];
          continue;
        }
        if ((0, runtime.isArtboardFile)(value16) && value17 !== null) {
          items2.push({
            p: value16,
            treePath: value15.path,
            theirsSha: value17,
            theirs: state.content.files[value16],
          });
          state2[value16] = value15.text;
          continue;
        }
        items3.push(value16);
      }
      let value14: Dynamic = input.edits.find(
        (input2?: Dynamic): Dynamic => input2.path === DESIGN_INDEX_FILE_PATH,
      );
      if (value14 !== undefined && value14.text !== null) {
        let value15: Dynamic;
        try {
          value15 = (0, runtime.normalizeDesignIndex)(JSON.parse(value14.text));
        } catch {
          value15 = undefined;
        }
        if (
          value15 !== undefined &&
          value14.base !== null &&
          value14.base === (liveHashes.get(DESIGN_INDEX_FILE_PATH) ?? null)
        ) {
          let value16: Dynamic = value15;
          indexState.update(
            (input2?: Dynamic): Dynamic =>
              (0, runtime.replaceIndexObjectProperties)(
                input2,
                (0, runtime.cloneIndexValue)(value16) as DataRecord,
              ),
          );
          value.commit();
        } else items3.push("the canvas layout");
      }
      adoptRemoteFiles(state2);
      for (let value15 of items2 as Dynamic)
        offerBoardClashNotice(
          value15.p,
          value15.treePath,
          value15.theirsSha,
          value15.theirs,
          "this is your unsaved edit from before the page reloaded, and the board has changed since",
        );
      for (let value15 of items5 as Dynamic)
        notice(
          "Someone else made \u201C" +
            value15.p.replace(/\.dc\.html$/, "") +
            "\u201D meanwhile; yours is \u201C" +
            createMyCopy(value15.p, value15.text, true).replace(
              /\.dc\.html$/,
              "",
            ) +
            "\u201D.",
        );
      for (let value15 of items4 as Dynamic)
        notice(
          value15.p.replace(/\.dc\.html$/, "") +
            " changed remotely; your unsaved edit is in \u201C" +
            createMyCopy(value15.p, value15.text).replace(/\.dc\.html$/, "") +
            "\u201D",
        );
      items3.length > 0 &&
        notice(
          "Some of your unsaved edits from before the page reloaded were not put back, because they changed since: " +
            items3
              .map(
                (input2?: Dynamic): Dynamic =>
                  input2.replace(/\.dc\.html$/, ""),
              )
              .join(", ") +
            ".",
        );
      options.debug?.event("stash-restored", {
        files: input.edits.length,
        asked: items2.map((input2?: Dynamic): Dynamic => input2.p),
        notBack: items3,
      });
      scheduleLocalSave();
      value.stashRestored();
    }
    function releaseHeldFocusedFiles(input?: Dynamic): Dynamic {
      for (let value14 of [...heldRemoteFiles] as Dynamic)
        ((0, runtime.artboardStorePath)(value14) !== input &&
          value14 !== input) ||
          callback8(value14) ||
          releaseHeldFile(value14);
    }
    let value11: Dynamic;
    function retryFailedLoad(input: Dynamic = false): Dynamic {
      if (!(loadState !== "failed" || disposed)) {
        value4 !== undefined &&
          (timers.clearTimeout(value4), (value4 = undefined));
        loadState = "loading";
        for (let value14 of [...loadListeners] as Dynamic) value14();
        notifySave();
        value11 = loadFiles(input);
      }
    }
    let callback14: Dynamic = (): Dynamic =>
      value8 !== undefined || Object.keys(state.content.files).some(callback9);
    function flushBeforeExit(): Dynamic {
      let value14: Dynamic = callback14();
      value8 !== undefined &&
        (timers.clearTimeout(value8), (value8 = undefined));
      value14 && loadState === "live" && publishLocalChanges();
      value.flushNow();
    }
    let callback15: Dynamic = (): Dynamic => {
        typeof document !== "undefined" &&
          (document as Dynamic).visibilityState !== "visible" &&
          flushBeforeExit();
      },
      callback16: Dynamic = (): Dynamic => flushBeforeExit(),
      callback17: Dynamic = (): Dynamic =>
        syncState.dirty > 0 ||
        syncState.inFlight ||
        value8 !== undefined ||
        syncState.unsendable !== undefined,
      callback18: Dynamic = (event?: Dynamic): Dynamic => {
        callback17() &&
          (flushBeforeExit(), event.preventDefault(), (event.returnValue = ""));
      },
      value12: Dynamic =
        typeof document !== "undefined" &&
        typeof (document as Dynamic).addEventListener == "function";
    typeof addEventListener == "function" &&
      (value12 &&
        (document as Dynamic).addEventListener("visibilitychange", callback15),
      addEventListener("pagehide", callback16),
      canWrite && addEventListener("beforeunload", callback18));
    let value13: Dynamic = loadFiles();
    return {
      saveMode: (): Dynamic => "auto",
      state: (): Dynamic => state,
      content: (): Dynamic => state.content,
      title: (): Dynamic => state.title,
      comments: (): Dynamic => state.comments,
      dirty: callback17,
      readOnly: (): Dynamic => !canWrite,
      saveState: getSaveState,
      commentSync: (): Dynamic => ({
        status: "idle",
        pending: 0,
      }),
      pendingCommentIds: (): Dynamic => new Set(),
      retryCommentPublish(): Dynamic {},
      setContent(input: Dynamic): Dynamic {
        input !== state.content &&
          (replaceDocument({
            ...state,
            content: input,
          }),
          (0, runtime.recordEdit)());
      },
      updateContent(input: Dynamic, options2: Dynamic): Dynamic {
        let value14: Dynamic = input(state.content);
        value14 !== state.content &&
          (replaceDocument({
            ...state,
            content: value14,
          }),
          options2?.auto !== true && (0, runtime.recordEdit)());
      },
      setTitle(input: Dynamic): Dynamic {
        let value14: Dynamic = (0, runtime.normalizeNewDocumentTitle)(input);
        value14.length === 0 ||
          value14 === state.title ||
          (replaceDocument({
            ...state,
            title: value14,
          }),
          (0, runtime.recordEdit)());
      },
      addComment: (): Dynamic => {},
      removeComment(): Dynamic {},
      documentBytes: (): Dynamic =>
        Object.values(state.content.files).reduce(
          (input?: Dynamic, items2?: Dynamic): Dynamic => input + items2.length,
          0,
        ),
      async save(): Promise<Dynamic> {
        if (loadState === "failed") return retryFailedLoad(true);
        flushBeforeExit();
      },
      stashOffer: (): Dynamic =>
        value7 === undefined
          ? undefined
          : {
              at: value7.at,
            },
      restoreStash(): Dynamic {
        restoreCrashStash();
      },
      discardStash: discardCrashStash,
      restoreCount: (): Dynamic => index3,
      subscribe(input: Dynamic): Dynamic {
        contentListeners.add(input);
        return (): Dynamic => {
          contentListeners.delete(input);
        };
      },
      subscribeSave(input: Dynamic): Dynamic {
        saveListeners.add(input);
        return (): Dynamic => {
          saveListeners.delete(input);
        };
      },
      debugState(): Dynamic {
        let liveSha: Dynamic = options.port.liveSha,
          value14: Dynamic = value.conflicted?.() ?? new Map(),
          value15: Dynamic = [...liveHashes.keys()]
            .sort()
            .map((input?: Dynamic): Dynamic => {
              let value17: Dynamic =
                  input === DESIGN_INDEX_FILE_PATH
                    ? runtime.canvasMetadataFile
                    : input.startsWith(runtime.projectPathPrefix)
                      ? input.slice(runtime.projectPathPrefix.length)
                      : input,
                value18: Dynamic = state.content.files[value17],
                value19: Dynamic = liveSha?.call(options.port, input),
                items2: Dynamic = [];
              value17 !== runtime.canvasMetadataFile &&
                callback9(value17) &&
                items2.push("dirty");
              syncState.inFlight &&
                items2.includes("dirty") &&
                items2.push("in-flight");
              value14.has(input) && items2.push("conflicted");
              heldRemoteFiles.has(value17) && items2.push("held");
              boardClashes.has(value17) &&
                !items2.includes("conflicted") &&
                items2.push("conflicted");
              value19 !== undefined &&
                value19 !== liveHashes.get(input) &&
                items2.push("behind");
              return {
                path: input,
                sha: liveHashes.get(input) ?? null,
                ...(value19 !== undefined
                  ? {
                      liveSha: value19,
                    }
                  : {}),
                ...(typeof value18 == "string"
                  ? {
                      size: value18.length,
                    }
                  : {}),
                state: items2.join(" "),
              };
            }),
          value16: Dynamic = Object.keys(state.content.files)
            .filter(
              (input?: Dynamic): Dynamic =>
                input !== runtime.canvasMetadataFile && callback9(input),
            )
            .map(
              (input?: Dynamic): Dynamic =>
                (0, runtime.toProjectContentPath)(input),
            );
        return {
          files: value15,
          queue: {
            dirty:
              value8 !== undefined && value16.length === 0
                ? ["(a flush is scheduled)"]
                : value16,
            inFlight: syncState.inFlight,
            ...(syncState.lastError !== undefined
              ? {
                  lastError:
                    syncState.lastError +
                    (syncState.backoffUntil !== undefined
                      ? " \xB7 retrying in " +
                        String(
                          Math.max(
                            0,
                            Math.round(
                              (syncState.backoffUntil - timers.now()) / 1e3,
                            ),
                          ),
                        ) +
                        " s"
                      : ""),
                }
              : {}),
            conflicted: [...value14.keys()],
            note: "a refused save is re-read and resent with backoff for about 10 s, then reported stuck (and stashed) and retried slowly",
          },
        };
      },
      reconciles: (): Dynamic => undoHistory,
      editorSaw: rememberManifestDeletions,
      retrySave: (): Dynamic => value.retryNow(),
      maxFileBytes: runtime.PlatformFileContentResolvedValue_11,
      loadState: (): Dynamic => loadState,
      shown: (): Dynamic => loadState === "live",
      cachedSettled: (): Dynamic => false,
      subscribeLoad(input: Dynamic): Dynamic {
        loadListeners.add(input);
        return (): Dynamic => {
          loadListeners.delete(input);
        };
      },
      healthSource(): Dynamic {
        let callback19: Dynamic = (): Dynamic =>
            loadState === "failed" &&
            value4 !== undefined &&
            index < FILE_READ_MAX_RETRIES &&
            value5 !== undefined &&
            timers.now() - (value6 ?? value5.at) < FILE_READ_TIMEOUT_MS
              ? "loading"
              : loadState,
          callback20: Dynamic = (): Dynamic =>
            loadState === "live" &&
            canWrite &&
            syncState.stuck === undefined &&
            syncState.unsendable === undefined &&
            syncState.lastError !== undefined,
          callback21: Dynamic = (state2?: Dynamic): Dynamic =>
            state2.status === "error" && callback20()
              ? {
                  status: "saving",
                }
              : state2;
        return {
          loadState: callback19,
          cachedSettled: (): Dynamic => false,
          subscribeLoad: (input?: Dynamic): Dynamic => (
            loadListeners.add(input),
            (): Dynamic => {
              loadListeners.delete(input);
            }
          ),
          saveState: (): Dynamic => callback21(getSaveState()),
          subscribeSave: (input?: Dynamic): Dynamic => {
            let callback22: Dynamic = (input2?: Dynamic): Dynamic =>
              input(callback21(input2));
            saveListeners.add(callback22);
            return (): Dynamic => {
              saveListeners.delete(callback22);
            };
          },
          syncDetail: (): Dynamic => {
            let value14: Dynamic = syncState.stuck?.code ?? syncState.lastError;
            return value14 !== undefined
              ? {
                  lastError: {
                    code:
                      FILES_ERROR_DATABASE_ALIASES[String(value14)] ??
                      String(value14),
                  },
                }
              : {};
          },
          dirty: (): Dynamic => callback17(),
        };
      },
      flushNow: flushBeforeExit,
      retryLoad: retryFailedLoad,
      storeUntouched: (): Dynamic => false,
      releaseHold: releaseHeldFocusedFiles,
      theirsOnItsWay: (input?: Dynamic): Dynamic =>
        heldRemoteFiles.has(input) ||
        callback7((0, runtime.toProjectContentPath)(input)),
      syncDetail: (): Dynamic => ({
        pending: syncState.dirty + (value8 !== undefined ? 1 : 0),
        inflight: syncState.inFlight ? DESIGN_INDEX_FILE_PATH : null,
        flights: syncState.inFlight ? 1 : 0,
        ...(lastSaveAt !== undefined
          ? {
              lastSyncedAt: lastSaveAt,
            }
          : {}),
        ...(lastSaveError !== undefined
          ? {
              lastError: lastSaveError,
            }
          : {}),
      }),
      dispose(): Dynamic {
        disposed = true;
        value10 !== undefined &&
          (timers.clearTimeout(value10), (value10 = undefined));
        value9 !== undefined &&
          (timers.clearTimeout(value9), (value9 = undefined));
        value4 !== undefined &&
          (timers.clearTimeout(value4), (value4 = undefined));
        value8 !== undefined && timers.clearTimeout(value8);
        typeof removeEventListener == "function" &&
          (value12 &&
            (document as Dynamic).removeEventListener(
              "visibilitychange",
              callback15,
            ),
          removeEventListener("pagehide", callback16),
          removeEventListener("beforeunload", callback18));
        value.dispose();
      },
      ready: value13,
      applyRemote: handleRemoteUpdate,
      heldShas: (): Dynamic => liveHashes,
      async settle(): Promise<Dynamic> {
        flushBeforeExit();
        await value.settle();
      },
      queue: value,
      index: (): Dynamic => indexState.get(),
      indexSaved: (): Dynamic => indexState.baseSha() !== null,
      listedBoards(): Dynamic {
        let value14: Dynamic = (0, runtime.normalizeDesignIndex)(
            indexState.get(),
          ),
          files: Dynamic = state.content.files,
          value15: Dynamic = Object.fromEntries(
            Object.entries(value14.boards).filter(
              ([input]: Dynamic): Dynamic =>
                (0, runtime.isArtboardFile)(input) &&
                !(0, runtime.isDesignSystemFile)(input),
            ),
          ),
          values5: Dynamic = new Set(Object.keys(value15));
        if (hasLocalChanges)
          return {
            listed: values5,
            awaited: [],
          };
        let value16: Dynamic =
            runtime.PlatformFileContentFilesValue -
            1 -
            Object.keys(files).length,
          items2: Dynamic = [];
        for (let value17 of (0, runtime.orderedDesignMapKeys)(
          value14.order,
          value15,
        ) as Dynamic) {
          if (items2.length >= value16) break;
          !(value17 in files) &&
            (publishedHashes.get((0, runtime.toProjectContentPath)(value17)) ??
              null) === null &&
            !knownArtboardFiles.has(value17) &&
            !fileDirtyVersions.has(value17) &&
            validateListedDesignFile({
              path: (0, runtime.toProjectContentPath)(value17),
              size: 0,
            }) !== null &&
            items2.push(value17);
        }
        return {
          listed: values5,
          awaited: (0, runtime.buildSelectedBoardsDocument)(value14, items2),
        };
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "hasUnstashedUnsendableEdits",
    () => hasUnstashedUnsendableEdits,
    (value) => {
      hasUnstashedUnsendableEdits = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "filesDocumentTimers",
    () => filesDocumentTimers,
    (value) => {
      filesDocumentTimers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_FILE_MIME_TYPES",
    () => DESIGN_FILE_MIME_TYPES,
    (value) => {
      DESIGN_FILE_MIME_TYPES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getDesignFileContentType",
    () => getDesignFileContentType,
  );
  bindRuntimeValue(
    runtime,
    "canSaveDesignFile",
    () => canSaveDesignFile,
    (value) => {
      canSaveDesignFile = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "describeUnsupportedDesignFile",
    () => describeUnsupportedDesignFile,
    (value) => {
      describeUnsupportedDesignFile = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isMissingRequiredDesignFile",
    () => isMissingRequiredDesignFile,
    (value) => {
      isMissingRequiredDesignFile = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "describeReservedDesignFilename",
    () => describeReservedDesignFilename,
    (value) => {
      describeReservedDesignFilename = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "describeMissingDesignFile",
    () => describeMissingDesignFile,
    (value) => {
      describeMissingDesignFile = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "describeUnsavableDesignFile",
    () => describeUnsavableDesignFile,
    (value) => {
      describeUnsavableDesignFile = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_INDEX_FILE_PATH",
    () => DESIGN_INDEX_FILE_PATH,
    (value) => {
      DESIGN_INDEX_FILE_PATH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_RESTART_MAX_ATTEMPTS",
    () => DESIGN_RESTART_MAX_ATTEMPTS,
    (value) => {
      DESIGN_RESTART_MAX_ATTEMPTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_RESTART_DELAY_MS",
    () => DESIGN_RESTART_DELAY_MS,
    (value) => {
      DESIGN_RESTART_DELAY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_BOOT_MAX_ATTEMPTS",
    () => DESIGN_BOOT_MAX_ATTEMPTS,
    (value) => {
      DESIGN_BOOT_MAX_ATTEMPTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_BOOT_MAX_WAIT_MS",
    () => DESIGN_BOOT_MAX_WAIT_MS,
    (value) => {
      DESIGN_BOOT_MAX_WAIT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "validateListedDesignFile",
    () => validateListedDesignFile,
  );
  bindRuntimeValue(
    runtime,
    "bytesToBase64",
    () => bytesToBase64,
    (value) => {
      bytesToBase64 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "base64ToBytes",
    () => base64ToBytes,
    (value) => {
      base64ToBytes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_READ_MAX_RETRIES",
    () => FILE_READ_MAX_RETRIES,
    (value) => {
      FILE_READ_MAX_RETRIES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_READ_TIMEOUT_MS",
    () => FILE_READ_TIMEOUT_MS,
    (value) => {
      FILE_READ_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILES_ERROR_DATABASE_ALIASES",
    () => FILES_ERROR_DATABASE_ALIASES,
    (value) => {
      FILES_ERROR_DATABASE_ALIASES = value;
    },
  );
  bindRuntimeValue(runtime, "encodeDesignPortFile", () => encodeDesignPortFile);
  bindRuntimeValue(
    runtime,
    "countPortContentBytes",
    () => countPortContentBytes,
  );
  bindRuntimeValue(
    runtime,
    "describeIndexMergeConflict",
    () => describeIndexMergeConflict,
  );
  bindRuntimeValue(
    runtime,
    "describeSamePropertyConflict",
    () => describeSamePropertyConflict,
  );
  bindRuntimeValue(
    runtime,
    "createFilesDesignDocument",
    () => createFilesDesignDocument,
  );
  return () => {
    hasUnstashedUnsendableEdits = (input?: Dynamic): Dynamic =>
      input.unsendable !== undefined && input.unsendableStashed !== true;
    filesDocumentTimers = {
      setTimeout: (input?: Dynamic, options?: Dynamic): Dynamic =>
        setTimeout(input, options),
      clearTimeout: (input?: Dynamic): Dynamic => clearTimeout(input),
      now: (): Dynamic => Date.now(),
    };
    DESIGN_FILE_MIME_TYPES = {
      jsx: "text/javascript",
      cjs: "text/javascript",
      tsx: "text/plain",
      ts: "text/plain",
    };
    canSaveDesignFile = (input?: Dynamic): Dynamic =>
      getDesignFileContentType(input) !== null;
    describeUnsupportedDesignFile = (input?: Dynamic): Dynamic =>
      "\u201C" +
      input +
      "\u201D can\u2019t be saved with this canvas. Add it as a PNG, JPEG, WebP or SVG instead.";
    isMissingRequiredDesignFile = (input?: Dynamic): Dynamic =>
      (0, runtime.isReservedProjectPath)(
        "design",
        runtime.projectPathPrefix + input,
      );
    describeReservedDesignFilename = (input?: Dynamic): Dynamic =>
      "\u201C" +
      input +
      "\u201D won\u2019t be saved under that name. Give the file another name.";
    describeMissingDesignFile = (input?: Dynamic): Dynamic =>
      "\u201C" +
      input +
      "\u201D is missing from this canvas. Add it again under another name.";
    describeUnsavableDesignFile = (input?: Dynamic): Dynamic =>
      isMissingRequiredDesignFile(input)
        ? describeMissingDesignFile(input)
        : describeUnsupportedDesignFile(input);
    DESIGN_INDEX_FILE_PATH = runtime.projectMetadataPaths.design;
    DESIGN_RESTART_MAX_ATTEMPTS = 6;
    DESIGN_RESTART_DELAY_MS = 5e3;
    DESIGN_BOOT_MAX_ATTEMPTS = 6;
    DESIGN_BOOT_MAX_WAIT_MS = 15e3;
    bytesToBase64 = (items?: Dynamic): Dynamic => {
      let text: Dynamic = "";
      for (let index: Dynamic = 0; index < items.length; index += 32768)
        text += String.fromCharCode(...items.subarray(index, index + 32768));
      return btoa(text);
    };
    base64ToBytes = (input?: Dynamic): Dynamic =>
      Uint8Array.from(
        atob(input),
        (input2?: Dynamic): Dynamic => input2.charCodeAt(0),
      );
    FILE_READ_MAX_RETRIES = 3;
    FILE_READ_TIMEOUT_MS = 3e4;
    FILES_ERROR_DATABASE_ALIASES = {
      too_large: "refused",
      invalid_content: "invalid_argument",
      read_only_path: "invalid_argument",
      not_declared: "invalid_argument",
      upstream_error: "unavailable",
      rate_limited: "resource_exhausted",
      not_writer: "not_granted",
      capability_disabled: "capability_disabled",
    };
  };
}
