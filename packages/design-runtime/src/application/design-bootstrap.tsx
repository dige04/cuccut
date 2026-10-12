/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installApplicationDesignBootstrap(
  runtime: RuntimeBindings,
): () => void {
  var restoredDesignViewState: Dynamic;
  var lastFocusedDesignFile: Dynamic;
  var DESIGN_VIEW_STORAGE_KEY_PATTERN: Dynamic;
  var getRestoredDesignViewState: Dynamic;
  var recoveryJsxRuntime: Dynamic;
  var afterTwoAnimationFrames: Dynamic;
  var hasDesignFilesListing: Dynamic;
  var selectWritableBootListing: Dynamic;
  var pointerInteractionActive: Dynamic;
  var lastDesignInteractionAt: Dynamic;
  var initialDesignTitle: Dynamic;
  var DESIGN_FOCUS_WAIT_MS: Dynamic;
  var RELATIVE_ASSET_REFERENCE_PATTERN: Dynamic;
  var LAST_FOCUSED_ARTBOARD_KEY: Dynamic;
  var DESIGN_FILES_READ_FAILURE_MESSAGE: Dynamic;
  var loadDesignDocumentTree: Dynamic;
  function captureDesignViewState(): Dynamic {
    let state: Dynamic = {};
    try {
      for (let index: Dynamic = 0; index < sessionStorage.length; index++) {
        let value2: Dynamic = sessionStorage.key(index);
        value2 !== null &&
          DESIGN_VIEW_STORAGE_KEY_PATTERN.test(value2) &&
          (state[value2] = sessionStorage.getItem(value2) ?? "");
      }
    } catch {}
    let value: Dynamic = lastFocusedDesignFile ?? decodeFocusedDesignRoute();
    return {
      view: state,
      ...(value !== null
        ? {
            focused: value,
          }
        : {}),
    };
  }
  function decodeFocusedDesignRoute(): Dynamic {
    let route: Dynamic = (0, runtime.currentEditingArtboardPath)();
    if (route === null) return null;
    let encodedFile: Dynamic = route.slice(route.indexOf("/") + 1);
    try {
      let value: Dynamic = decodeURIComponent(
        encodedFile.replace(/~([0-9a-f]{2})/g, "%$1"),
      );
      return (0, runtime.artboardStorePath)(value) === route ? value : null;
    } catch {
      return null;
    }
  }
  function restoreDesignViewState(snapshot?: Dynamic): Dynamic {
    if (typeof snapshot != "object" || snapshot === null) return;
    let state: Dynamic = snapshot;
    restoredDesignViewState = {
      ...(typeof state.focused == "string"
        ? {
            focused: state.focused,
          }
        : {}),
    };
    if (!(typeof state.view != "object" || state.view === null))
      try {
        for (let [value, value2] of Object.entries(state.view) as Dynamic)
          DESIGN_VIEW_STORAGE_KEY_PATTERN.test(value) &&
            typeof value2 == "string" &&
            sessionStorage.getItem(value) === null &&
            sessionStorage.setItem(value, value2);
      } catch {}
  }
  function showCrashRecoveryNotice(recovery?: Dynamic): Dynamic {
    let noticeId: Dynamic = 0,
      singleFile: Dynamic = recovery.files === 1,
      description: Dynamic = `${singleFile ? "An edit" : String(recovery.files) + " edits"} you made here earlier`;
    noticeId = (0, runtime.showEditorActionToast)(
      recovery.changedSince === 0
        ? `${description} ${singleFile ? "was" : "were"} never saved. Put ${singleFile ? "it" : "them"} back?`
        : `${description} may not have been saved. The canvas has changed since then, so putting ${singleFile ? "it" : "them"} back can replace newer changes. Put ${singleFile ? "it" : "them"} back anyway?`,
      <span className={"flex shrink-0 items-center gap-1"}>
        <runtime.Button
          type={"button"}
          variant={"ghost"}
          onClick={(): Dynamic => {
            (0, runtime.closeEditorToast)(noticeId);
            recovery.discard();
          }}
        >
          {"Discard"}
        </runtime.Button>
        <runtime.Button
          type={"button"}
          variant={"primary"}
          onClick={(): Dynamic => {
            (0, runtime.closeEditorToast)(noticeId);
            recovery.restore();
          }}
        >
          {"Put back"}
        </runtime.Button>
      </span>,
    );
    recovery.whenAnswered(
      (): Dynamic => (0, runtime.closeEditorToast)(noticeId),
    );
  }
  function showOverwrittenEditNotice(edit?: Dynamic): Dynamic {
    let title: Dynamic = edit.file.replace(/\.dc\.html$/, ""),
      noticeId: Dynamic = 0;
    noticeId = (0, runtime.showEditorActionToast)(
      `\u201C${title}\u201D was saved over by a version that leaves out a change you had saved. Their version is on screen.`,
      <runtime.Button
        type={"button"}
        variant={"primary"}
        onClick={(): Dynamic => {
          (0, runtime.closeEditorToast)(noticeId);
          edit.putBack();
        }}
      >
        {"Put my change back"}
      </runtime.Button>,
    );
  }
  function hasDesignIndexListing(
    listing?: Dynamic,
    options: Dynamic = {
      embedded: false,
    },
  ): Dynamic {
    return options.embedded || listing === null || listing === undefined
      ? false
      : Object.hasOwn(listing, runtime.projectMetadataPaths.design);
  }
  function getSkippedDesignFiles(listing?: Dynamic): Dynamic {
    return Object.fromEntries(
      Object.entries(listing ?? {}).filter(
        ([input, input2]: Dynamic): Dynamic =>
          input.startsWith(runtime.projectPathPrefix) &&
          !(0, runtime.isReservedProjectPath)("design", input) &&
          (0, runtime.validateListedDesignFile)({
            path: input,
            size: Number(input2?.size ?? 0),
          }) === null,
      ),
    );
  }
  async function chooseDesignBootstrapMode(
    listing?: Dynamic,
    readIndex?: Dynamic,
    options: Dynamic = {
      embedded: false,
    },
  ): Promise<Dynamic> {
    let mayAskNarrowed: Dynamic =
        options.narrowed === true &&
        options.ask !== undefined &&
        !options.embedded &&
        listing !== null &&
        listing !== undefined,
      hasIndex: Dynamic = hasDesignIndexListing(listing, options);
    if (!hasIndex && !mayAskNarrowed)
      return {
        boot: "store",
      };
    let text: Dynamic = hasIndex
      ? await readIndex()
      : await options.ask(runtime.projectMetadataPaths.design);
    if (text === undefined)
      return {
        boot: "unreadable",
      };
    if (text === null || (0, runtime.getStorageModeFromJson)(text) !== "files")
      return {
        boot: "store",
      };
    if (
      readDesignIndexKind(text) === "converted" &&
      !Object.hasOwn(listing, runtime.readPortVersion)
    ) {
      let value: Dynamic = mayAskNarrowed
        ? await options.ask(runtime.readPortVersion)
        : null;
      if (value === undefined)
        return {
          boot: "unreadable",
        };
      if (value === null)
        return {
          boot: "store",
        };
    }
    return {
      boot: "files",
    };
  }
  function createBootstrapFileReader(
    fetchFile?: Dynamic,
    mayWrite?: Dynamic,
    timers: Dynamic = {
      setTimeout: (input?: Dynamic, options?: Dynamic): Dynamic =>
        setTimeout(input, options),
    },
  ): Dynamic {
    return async (input?: Dynamic): Promise<Dynamic> => {
      if (!(await mayWrite().catch((): Dynamic => false)))
        return fetchFile(input)
          .then(
            (input2?: Dynamic): Dynamic => (input2.ok ? input2.text() : null),
          )
          .catch((): Dynamic => null);
      for (let index: Dynamic = 0; ; index++) {
        let value: Dynamic = await fetchFile(input).catch((): Dynamic => {}),
          value2: Dynamic =
            value?.ok === true
              ? await value.text().catch((): Dynamic => {})
              : undefined;
        if (value2 !== undefined) return value2;
        if (value?.status === 404) return null;
        if (index >= runtime.PlatformFilesHotReloadItems.length) return;
        await new Promise((input2?: Dynamic): Dynamic => {
          timers.setTimeout(input2, runtime.PlatformFilesHotReloadItems[index]);
        });
      }
    };
  }
  function readDesignIndexKind(indexText?: Dynamic): Dynamic {
    try {
      return (0, runtime.getStorageMigrationMarker)(JSON.parse(indexText))
        ?.kind;
    } catch {
      return;
    }
  }
  function trackPointerInteractions(): Dynamic {
    if (!(typeof window === "undefined")) {
      (window as Dynamic).addEventListener(
        "pointerdown",
        (): Dynamic => (pointerInteractionActive = true),
        true,
      );
      for (let value of ["pointerup", "pointercancel", "blur"] as Dynamic)
        (window as Dynamic).addEventListener(
          value,
          (): Dynamic => (pointerInteractionActive = false),
          true,
        );
    }
  }
  function hasActiveEditorInteraction(): Dynamic {
    if (pointerInteractionActive || typeof document === "undefined")
      return pointerInteractionActive;
    let activeElement: Dynamic = (document as Dynamic).activeElement;
    return (
      activeElement instanceof HTMLElement &&
      (activeElement.isContentEditable ||
        activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA")
    );
  }
  function shouldDeferDesignRestart(): Dynamic {
    if (hasActiveEditorInteraction()) return true;
    if (typeof document === "undefined") return false;
    if (
      (document as Dynamic).querySelector(
        "[data-mega-frames-inert], [data-mega-grabbing]",
      ) !== null
    )
      return true;
    for (let value of (document as Dynamic).querySelectorAll(
      "iframe",
    ) as Dynamic)
      try {
        if (
          value.contentDocument?.querySelector(
            "[data-dc-editor-editing], [data-dc-editor-dragging], [data-dc-dragging]",
          ) != null
        )
          return true;
      } catch {}
    return (
      performance.now() -
        Math.max(
          lastDesignInteractionAt,
          (0, runtime.ModelHistoryRebaseHandler_4)(),
        ) <
      1500
    );
  }
  function createDesignBootstrapDebugger(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    if (options || input !== "files")
      return (0, runtime.createNoopHotDebugger)();
    let value: Dynamic = (0, runtime.createHotDebugger)({
      product: "design",
      hot: (0, runtime.getHotCapability)(),
      bootStartedAt: runtime.applicationBootTime,
    });
    value.mount(input);
    return value;
  }
  function deferCrashStashAccess(stashPromise?: Dynamic): Dynamic {
    let resolvedStash: Dynamic = stashPromise.catch((): Dynamic => null);
    return {
      put: async (input?: Dynamic, options?: Dynamic): Promise<Dynamic> =>
        (await resolvedStash)?.put(input, options) ?? false,
      read: async (): Promise<Dynamic> => (await resolvedStash)?.read(),
      clear: async (): Promise<Dynamic> => (await resolvedStash)?.clear(),
      clearOffered: async (): Promise<Dynamic> =>
        (await resolvedStash)?.clearOffered(),
      clearArtifact: async (): Promise<Dynamic> =>
        (await resolvedStash)?.clearArtifact(),
      purgeOtherViewers: async (): Promise<Dynamic> =>
        (await resolvedStash)?.purgeOtherViewers(),
    };
  }
  async function readDesignIndexWithRetry(
    fetchFile?: Dynamic,
  ): Promise<Dynamic> {
    let retryWaits: Dynamic = [
      0,
      ...(runtime.hotReloadController.queued.length > 0
        ? runtime.PlatformFilesHotReloadItems
        : runtime.PlatformFilesHotReloadItems.slice(
            0,
            runtime.PlatformFilesHotReloadLimit,
          )),
    ];
    for (let value of retryWaits as Dynamic) {
      value > 0 &&
        (await new Promise(
          (input?: Dynamic): Dynamic => setTimeout(input, value),
        ));
      try {
        let value2: Dynamic = await fetchFile(
          runtime.projectMetadataPaths.design,
        );
        if (value2.ok) return await value2.text();
        if (
          value2.status === 404 &&
          runtime.hotReloadController.queued.length === 0
        )
          return null;
      } catch {}
    }
  }
  function createBootDesignFilesPort(
    fetchFile?: Dynamic,
    listing?: Dynamic,
    canWrite?: Dynamic,
    debugContext?: Dynamic,
    narrowed: Dynamic = false,
  ): Dynamic {
    return (0, runtime.createDesignFilesPort)({
      fetch: fetchFile,
      fetchFresh: (input?: Dynamic): Dynamic =>
        fetch(input, {
          credentials: "same-origin",
          cache: "no-store",
          signal: AbortSignal.timeout(3e4),
        }),
      ...wrapBootFilesListing(listing),
      ...(narrowed && listing !== undefined
        ? {
            bootNarrowed: true,
          }
        : {}),
      canWrite: canWrite,
      onRead: (
        input?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
        value?: Dynamic,
      ): Dynamic => debugContext.dbg.read(input, options, context, value),
      onPublishError: (input?: Dynamic): Dynamic =>
        debugContext.dbg.event(
          "publish-raw-error",
          input instanceof Error
            ? {
                message: input.message,
              }
            : input,
        ),
    });
  }
  function wrapBootFilesListing(listing?: Dynamic): Dynamic {
    return listing === undefined
      ? {}
      : {
          bootFiles: listing ?? {},
        };
  }
  function focusDesignArtboard(
    file?: Dynamic,
    document2: Dynamic = typeof document === "undefined" ? undefined : document,
  ): Dynamic {
    let canvas: Dynamic =
        document2?.querySelector('main[aria-label="Canvas"]') ?? null,
      handle: Dynamic =
        // @ts-expect-error -- TS 7 reads `x ?? null` as always nullish (TS2871); the original expression is kept as is.
        (file !== undefined && file !== ""
          ? ([
              ...(canvas?.querySelectorAll(
                '[data-testid^="mega-artboard-handle-"]',
              ) ?? []),
            ].find(
              (element?: Dynamic): Dynamic =>
                element.getAttribute("data-testid") ===
                "mega-artboard-handle-" + file,
            ) ?? null)
          : null) ?? canvas;
    handle !== null &&
      (handle.hasAttribute("tabindex") || handle.setAttribute("tabindex", "-1"),
      handle.focus({
        preventScroll: true,
      }));
  }
  function focusDesignArtboardWhenWindowActive(
    file?: Dynamic,
    options: Dynamic = {},
  ): Dynamic {
    let document2: Dynamic =
      options.doc ?? (typeof document === "undefined" ? undefined : document);
    if (document2 === undefined || document2.hasFocus())
      return focusDesignArtboard(file, document2);
    let window2: Dynamic =
      options.win ?? (typeof window === "undefined" ? undefined : window);
    if (window2 === undefined) return;
    let timers: Dynamic = options.timers ?? {
        setTimeout: (input?: Dynamic, options2?: Dynamic): Dynamic =>
          setTimeout(input, options2),
        clearTimeout: (input?: Dynamic): Dynamic => clearTimeout(input),
      },
      flag: Dynamic = true,
      value: Dynamic,
      callback: Dynamic = (): Dynamic => {
        if (flag) {
          flag = false;
          timers.clearTimeout(value);
          document2.removeEventListener?.("visibilitychange", callback3);
          window2.removeEventListener("focus", callback2);
          for (let value2 of ["keydown", "pointerdown"] as Dynamic)
            window2.removeEventListener(value2, callback, true);
        }
      },
      callback2: Dynamic = (): Dynamic => {
        flag && (callback(), focusDesignArtboard(file, document2));
      },
      callback3: Dynamic = (): Dynamic => {
        timers.clearTimeout(value);
        value =
          (document2.visibilityState ?? "visible") === "visible"
            ? timers.setTimeout(callback, DESIGN_FOCUS_WAIT_MS)
            : undefined;
      };
    window2.addEventListener("focus", callback2);
    for (let value2 of ["keydown", "pointerdown"] as Dynamic)
      window2.addEventListener(value2, callback, true);
    document2.addEventListener?.("visibilitychange", callback3);
    callback3();
  }
  async function buildFallbackDesignFileListing(
    fetchFile?: Dynamic,
  ): Promise<Dynamic> {
    try {
      let value: Dynamic = await fetchFile(runtime.projectMetadataPaths.design);
      if (!value.ok) return null;
      let value2: Dynamic = await value.text(),
        value3: Dynamic = (0, runtime.normalizeDesignIndex)(JSON.parse(value2)),
        state: Dynamic = {
          [runtime.projectMetadataPaths.design]: {
            sha256: "",
            size: value2.length,
            contentType: "application/json",
          },
        };
      if (readDesignIndexKind(value2) === "converted") {
        if (!(await fetchFile(runtime.readPortVersion)).ok) return null;
        state[runtime.readPortVersion] = {
          sha256: "",
        };
      }
      let value4: Dynamic = (0, runtime.orderedDesignMapKeys)(
          value3.order,
          value3.boards,
        ).filter(
          (input?: Dynamic): Dynamic =>
            (0, runtime.validateListedDesignFile)({
              path: runtime.projectPathPrefix + input,
              size: 0,
            }) === input,
        ),
        callback: Dynamic = (input?: Dynamic): Dynamic => {
          let value9: Dynamic = Object.fromEntries(
              value4
                .filter((input2?: Dynamic): Dynamic => !input.has(input2))
                .map((input2?: Dynamic): Dynamic => [input2, ""]),
            ),
            value10: Dynamic = (0, runtime.selectDesignCover)({
              files: {
                ...value9,
                [runtime.canvasMetadataFile]: (0,
                runtime.buildDesignDocumentFromIndex)(value3, value9),
              },
            });
          return {
            files:
              value10?.boards.map((input2?: Dynamic): Dynamic => input2.file) ??
              [],
            snapshot: value10?.snapshot === true,
          };
        },
        entries: Dynamic = new Map(),
        values: Dynamic = new Set(),
        value5: Dynamic = callback(values),
        files: Dynamic = value5.files;
      for (let index: Dynamic = 0; value5.snapshot; index += 1) {
        await Promise.all(
          files
            .filter((input?: Dynamic): Dynamic => !entries.has(input))
            .map(
              async (input?: Dynamic): Promise<Dynamic> =>
                entries.set(
                  input,
                  await fetchFile(runtime.projectPathPrefix + input).catch(
                    (): Dynamic => {},
                  ),
                ),
            ),
        );
        let value9: Dynamic = files.filter(
          (input?: Dynamic): Dynamic => entries.get(input)?.status === 404,
        );
        if (value9.length === 0) break;
        for (let value11 of value9 as Dynamic) values.add(value11);
        let value10: Dynamic =
          index < 3
            ? callback(values)
            : {
                files: files.filter(
                  (input?: Dynamic): Dynamic => !values.has(input),
                ),
                snapshot: true,
              };
        if (!value10.snapshot || value10.files.length === 0) {
          let value11: Dynamic = value5.files.filter(
            (input?: Dynamic): Dynamic => !values.has(input),
          );
          files = value11.length > 0 ? value11 : value5.files;
          break;
        }
        files = value10.files;
        if (index === 3) break;
      }
      for (let value9 of files as Dynamic)
        state[runtime.projectPathPrefix + value9] = {
          sha256: "",
          contentType: "text/html",
        };
      let value6: Dynamic = files[0];
      if (value6 === undefined) return state;
      await Promise.all(
        value4
          .filter(runtime.isDesignSystemFile)
          .map(async (input?: Dynamic): Promise<Dynamic> => {
            (
              await fetchFile(runtime.projectPathPrefix + input).catch(
                (): Dynamic => {},
              )
            )?.ok === true &&
              (state[runtime.projectPathPrefix + input] = {
                sha256: "",
                contentType: "text/html",
              });
          }),
      );
      let value7: Dynamic = value5.snapshot
        ? entries.get(value6)
        : await fetchFile(runtime.projectPathPrefix + value6);
      if (value7?.ok !== true) return state;
      let value8: Dynamic = value6.includes("/")
        ? value6.slice(0, value6.lastIndexOf("/") + 1)
        : "";
      for (let value9 of (await value7.text()).matchAll(
        RELATIVE_ASSET_REFERENCE_PATTERN,
      ) as Dynamic) {
        let items: Dynamic = [];
        for (let value11 of (value8 + value9[1]).split("/") as Dynamic)
          value11 === ".."
            ? items.pop()
            : value11 !== "." && value11 !== "" && items.push(value11);
        let value10: Dynamic = items.join("/");
        (value5.snapshot &&
          (0, runtime.isArtboardFile)(value10) &&
          !files.includes(value10)) ||
          (items[items.length - 1] !== "support.js" &&
            (0, runtime.validateListedDesignFile)({
              path: runtime.projectPathPrefix + value10,
              size: 0,
            }) !== null &&
            (state[runtime.projectPathPrefix + value10] = {
              sha256: "",
            }));
      }
      return state;
    } catch {
      return null;
    }
  }
  async function bootDesignDocument({
    get: fetchFile,
    listing: listingPromise,
    narrowed: isNarrowed,
    embedded: embedded,
  }: Dynamic): Promise<Dynamic> {
    let isEmbedded: Dynamic = embedded || runtime.isEmbeddedApplication,
      debugContext: Dynamic = {
        dbg: (0, runtime.createNoopHotDebugger)(),
      },
      listing: Dynamic = await listingPromise;
    !isEmbedded &&
      (0, runtime.isFrameCaptureDocument)() &&
      !hasDesignIndexListing(listing) &&
      (listing = (await buildFallbackDesignFileListing(fetchFile)) ?? listing);
    let narrowed: Dynamic =
        isNarrowed?.() === true && listing === (await listingPromise),
      bootDecision: Dynamic = await chooseDesignBootstrapMode(
        listing,
        (): Dynamic => readDesignIndexWithRetry(fetchFile),
        {
          embedded: isEmbedded,
          narrowed: narrowed,
          ask: createBootstrapFileReader(
            fetchFile,
            (): Dynamic =>
              (0, runtime.resolveDesignWriteAccess)().then(
                (input?: Dynamic): Dynamic => input.canWrite,
              ),
          ),
        },
      ),
      mode: Dynamic = isEmbedded
        ? bootDecision
        : bootDecision.boot === "store"
          ? {
              boot: "files",
            }
          : bootDecision;
    if (mode.boot === "unreadable") {
      runtime.hotReloadController.detach();
      return (): Dynamic => {
        throw new Error(DESIGN_FILES_READ_FAILURE_MESSAGE);
      };
    }
    if (mode.boot === "store") {
      let value3: Dynamic = runtime.hotReloadController.queued.length > 0,
        value4: Dynamic = runtime.hotReloadController.owed() !== undefined;
      runtime.hotReloadController.detach();
      if (value3 && !value4)
        try {
          (0, runtime.getHotCapability)()?.restart?.({
            note: "store canvas: content adopted during boot",
          });
        } catch {}
      return null;
    }
    let port: Dynamic,
      conversionAttempted: Dynamic = false,
      converted: Dynamic = false;
    if (
      !isEmbedded &&
      !hasDesignFilesListing(listing) &&
      !(0, runtime.isFrameCaptureDocument)()
    ) {
      let value3: Dynamic =
          runtime.hotReloadController.queued.length > 0
            ? "an update was adopted during this open"
            : undefined,
        value4: Dynamic = await (0, runtime.convertDatabaseDesignToFiles)({
          listing: narrowed ? undefined : listing,
          canWrite: (): Dynamic =>
            (0, runtime.resolveDesignWriteAccess)().then(
              (input?: Dynamic): Dynamic => input.canWrite,
            ),
          port: (): Dynamic =>
            (port ??= createBootDesignFilesPort(
              fetchFile,
              listing,
              true,
              debugContext,
              narrowed,
            )),
          store: (): Dynamic => (0, runtime.getSnapshotDatabaseAdapter)(),
          readBlob: async (input?: Dynamic): Promise<Dynamic> => {
            for (let index: Dynamic = 0; ; index += 1)
              try {
                let value5: Dynamic = await fetch(input, {
                  credentials: "same-origin",
                  signal: AbortSignal.timeout(12e4),
                });
                if (!value5.ok)
                  throw new Error(
                    "upload not readable: " + String(value5.status),
                  );
                return await value5.text();
              } catch (value5: Dynamic) {
                if (index >= 1) throw value5;
              }
          },
          defaultTitle: initialDesignTitle,
          ...(value3 !== undefined
            ? {
                holdOff: value3,
              }
            : {}),
        });
      value4.did === "nothing" &&
        value4.reason !== undefined &&
        console.warn(
          "design: this canvas\u2019s old store was not copied into its files (" +
            value4.reason +
            ")",
        );
      conversionAttempted =
        value4.did === "nothing" && value4.pastMeta === true;
      converted = value4.did === "restored";
    }
    runtime.hotReloadController.armReady();
    let value: Dynamic = (debugContext.dbg = createDesignBootstrapDebugger(
      "files",
      isEmbedded,
    ));
    value.phase("boot decided: files");
    value.field(
      "mode",
      "files \xB7 " + String(Object.keys(listing ?? {}).length) + " listed",
    );
    let value2: Dynamic = value.option(
      "inplace",
      "apply a remote board change in place (__dcUpdate) instead of rebuilding its iframe",
    );
    (0, runtime.setEditorOwnsUndoProbe)(value2);
    (0, runtime.setUndoGestureObserver)(
      (input?: Dynamic, options?: Dynamic): Dynamic =>
        value.event(input, options),
    );
    (0, runtime.ModelHistoryRebaseHandler)(
      true,
      (input?: Dynamic, options?: Dynamic): Dynamic =>
        value.event("undo-rebased", {
          board: input,
          ...options,
        }),
    );
    return (input?: Dynamic): Dynamic => {
      if (
        converted &&
        runtime.hotReloadController.queued.length > 0 &&
        ((conversionAttempted = true), (0, runtime.canHotRestart)())
      )
        try {
          (0, runtime.getHotCapability)()?.restart?.({
            note: "design: an update arrived while the old store was being copied",
          });
        } catch {}
      let callback: Dynamic = (): Dynamic => {},
        promise: Dynamic = new Promise((input2?: Dynamic): Dynamic => {
          callback = input2;
        });
      try {
        let value3: Dynamic =
          port ??
          createBootDesignFilesPort(
            fetchFile,
            listing,
            input.canWrite,
            debugContext,
            narrowed,
          );
        value.field("on version", value3.version().version || "(unknown)");
        value.field(
          "can write",
          input.canWrite
            ? "yes"
            : "no" +
                (input.reason !== undefined ? " \xB7 " + input.reason : ""),
        );
        let value4: Dynamic = (0, runtime.createFilesDesignDocument)({
          port: value3,
          defaultTitle: (document as Dynamic).title || "Design",
          canWrite: input.canWrite && !conversionAttempted,
          ...(conversionAttempted
            ? {
                readOnlyReason: DESIGN_FILES_READ_FAILURE_MESSAGE,
              }
            : input.reason !== undefined
              ? {
                  readOnlyReason: input.reason,
                }
              : {}),
          holdRemote: (input2?: Dynamic): Dynamic =>
            (0, runtime.artboardStorePath)(input2) ===
              (0, runtime.currentEditingArtboardPath)() &&
            shouldDeferDesignRestart(),
          sameBoardRule: LAST_FOCUSED_ARTBOARD_KEY,
          onSaveDropped: showOverwrittenEditNotice,
          saveStash: deferCrashStashAccess(
            (0, runtime.restoreBrowserCrashStash)("design"),
          ),
          ...(isEmbedded
            ? {}
            : {
                paced: true,
              }),
          onStashOffer: showCrashRecoveryNotice,
          onNotice: (input2?: Dynamic): Dynamic => {
            value.event("notice", {
              message: input2,
            });
            (0, runtime.showEditorToast)(input2);
          },
          debug: (0, runtime.createSaveEventReporter)({
            saveStart: (input2?: Dynamic, options?: Dynamic): Dynamic => (
              (0, runtime.removePublishedFiles)(input2),
              value.saveStart(input2, options)
            ),
            saveEnd: (input2?: Dynamic, options?: Dynamic): Dynamic => (
              (0, runtime.recordPublishedVersion)(options),
              value.saveEnd(input2, options)
            ),
            event: (input2?: Dynamic, options?: Dynamic): Dynamic =>
              value.event(input2, options),
          }),
        });
        value.provide({
          files: (): Dynamic => value4.debugState().files,
          queue: (): Dynamic => value4.debugState().queue,
        });
        let value5: Dynamic = value4.healthSource(),
          value6: Dynamic = (0, runtime.monitorDocumentLoadHealth)(
            value5,
            (input2?: Dynamic): Dynamic =>
              runtime.healthReporter.report(...input2),
          ),
          value7: Dynamic = (0, runtime.monitorDocumentSaveHealth)(
            value5,
            (input2?: Dynamic): Dynamic =>
              runtime.healthReporter.report(...input2),
          ),
          value8: Dynamic = value4.dispose.bind(value4);
        value4.dispose = (): Dynamic => {
          value6();
          value7();
          value8();
        };
        value4.subscribe((input2?: Dynamic): Dynamic => {
          input2?.remote !== true &&
            (lastDesignInteractionAt = performance.now());
        });
        let value9: Dynamic = getSkippedDesignFiles(listing);
        (0, runtime.setPublishedFileReferences)(value9);
        (0, runtime.resetPublishedFileIndex)(
          selectWritableBootListing(listing, {
            hosted: isEmbedded,
            capture: (0, runtime.isFrameCaptureDocument)(),
            narrowed: narrowed,
          }),
        );
        if ((narrowed && input.canWrite) || listing === undefined) {
          (0, runtime.clearPendingFileOverlay)();
          let value11: Dynamic =
              listing === undefined
                ? (): Dynamic => value3.list()
                : (): Dynamic =>
                    (0, runtime.retryAccessFailure)(
                      (): Dynamic => (0, runtime.listWritableFiles)(value3),
                    ),
            promise2: Dynamic = new Promise((input2?: Dynamic): Dynamic => {
              if (value4.loadState() === "live") return input2();
              let value12: Dynamic = value4.subscribeLoad((): Dynamic => {
                value4.loadState() === "live" && (value12(), input2());
              });
            });
          (listing === undefined ? promise2 : value4.ready)
            .then(value11)
            .then(
              (input2?: Dynamic): Dynamic =>
                (0, runtime.setPublishedFileReferences)(
                  getSkippedDesignFiles(
                    Object.fromEntries(
                      input2.map(
                        (input3?: Dynamic): Dynamic => [
                          input3.path,
                          {
                            sha256: input3.sha256,
                            size: input3.size,
                            contentType: input3.contentType,
                          },
                        ],
                      ),
                    ),
                  ),
                ),
            )
            .catch((): Dynamic => {});
        }
        trackPointerInteractions();
        (0, runtime.createFilesHotReloadController)({
          port: value3,
          applyRemote: async (input2?: Dynamic): Promise<Dynamic> => {
            (0, runtime.updatePublishedFileIndex)(input2.changed);
            await value4.applyRemote(input2);
            afterTwoAnimationFrames(
              (): Dynamic => value.visible(input2.to.version, "adopted"),
            );
          },
          isBusy: (): Dynamic =>
            hasActiveEditorInteraction() ||
            (0, runtime.hasUnstashedUnsendableEdits)(value4.queue.state()),
          snapshot: (): Dynamic => captureDesignViewState(),
          restore: (input2?: Dynamic): Dynamic =>
            restoreDesignViewState(input2),
          reveal: promise,
          onEvent: (input2?: Dynamic): Dynamic => {
            let value11: Dynamic = (0, runtime.classifyHotEditMetric)(input2);
            value11 !== null && runtime.healthReporter.report(...value11);
            value.hotEvent(input2);
          },
          onBeforeRestart: (input2?: Dynamic): Dynamic => {
            value.beforeRestart(input2);
            value4.flushNow();
          },
        });
        (0, runtime.completeThumbnailAfterPromise)(
          (): Dynamic =>
            (0, runtime.waitForActiveDesignFramesReady)().then(
              (): Dynamic => (0, runtime.waitForThumbnailPaint)(),
            ),
        );
        value4.ready.then((): Dynamic => {
          value.phase(
            "document ready (" +
              String(Object.keys(value4.content().files).length) +
              " files)",
          );
          let value11: Dynamic = value4.loadState() === "live";
          (!value11 ||
            !Object.keys(value4.content().files).some(
              (input2?: Dynamic): Dynamic =>
                (0, runtime.isArtboardFile)(input2) &&
                !(0, runtime.isDesignSystemFile)(input2),
            )) &&
            callback();
          !value11 || isEmbedded || (0, runtime.isFrameCaptureDocument)();
        });
        (0, runtime.waitForDesignFramesReady)().then((): Dynamic => {
          value.phase("first artboard painted");
          afterTwoAnimationFrames((): Dynamic => {
            callback();
            (0, runtime.announceMigrationReopen)({
              canWrite: input.canWrite,
              focus: (input2?: Dynamic): Dynamic =>
                focusDesignArtboardWhenWindowActive(
                  input2 ?? getRestoredDesignViewState()?.focused,
                ),
            });
            runtime.hotReloadController.restarted &&
              value.visible(value3.version().version, "restarted");
          });
          (0, runtime.waitForThumbnailPaint)().then(
            (): Dynamic => value.phase("all painted"),
          );
        });
        let value10: Dynamic = getRestoredDesignViewState();
        return {
          doc: value4,
          census: {
            canWrite: input.canWrite && !conversionAttempted,
            capture: (0, runtime.isFrameCaptureDocument)(),
            embedded: isEmbedded,
          },
          ...(value10?.focused !== undefined
            ? {
                entryFile: value10.focused,
              }
            : {}),
        };
      } catch (value3: Dynamic) {
        throw (runtime.hotReloadController.detach(), value3);
      }
    };
  }
  bindRuntimeValue(
    runtime,
    "restoredDesignViewState",
    () => restoredDesignViewState,
    (value) => {
      restoredDesignViewState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "lastFocusedDesignFile",
    () => lastFocusedDesignFile,
    (value) => {
      lastFocusedDesignFile = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_VIEW_STORAGE_KEY_PATTERN",
    () => DESIGN_VIEW_STORAGE_KEY_PATTERN,
    (value) => {
      DESIGN_VIEW_STORAGE_KEY_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "captureDesignViewState",
    () => captureDesignViewState,
  );
  bindRuntimeValue(
    runtime,
    "decodeFocusedDesignRoute",
    () => decodeFocusedDesignRoute,
  );
  bindRuntimeValue(
    runtime,
    "restoreDesignViewState",
    () => restoreDesignViewState,
  );
  bindRuntimeValue(
    runtime,
    "getRestoredDesignViewState",
    () => getRestoredDesignViewState,
    (value) => {
      getRestoredDesignViewState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "recoveryJsxRuntime",
    () => recoveryJsxRuntime,
    (value) => {
      recoveryJsxRuntime = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "showCrashRecoveryNotice",
    () => showCrashRecoveryNotice,
  );
  bindRuntimeValue(
    runtime,
    "showOverwrittenEditNotice",
    () => showOverwrittenEditNotice,
  );
  bindRuntimeValue(
    runtime,
    "afterTwoAnimationFrames",
    () => afterTwoAnimationFrames,
    (value) => {
      afterTwoAnimationFrames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hasDesignIndexListing",
    () => hasDesignIndexListing,
  );
  bindRuntimeValue(
    runtime,
    "hasDesignFilesListing",
    () => hasDesignFilesListing,
    (value) => {
      hasDesignFilesListing = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "selectWritableBootListing",
    () => selectWritableBootListing,
    (value) => {
      selectWritableBootListing = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getSkippedDesignFiles",
    () => getSkippedDesignFiles,
  );
  bindRuntimeValue(
    runtime,
    "chooseDesignBootstrapMode",
    () => chooseDesignBootstrapMode,
  );
  bindRuntimeValue(
    runtime,
    "createBootstrapFileReader",
    () => createBootstrapFileReader,
  );
  bindRuntimeValue(runtime, "readDesignIndexKind", () => readDesignIndexKind);
  bindRuntimeValue(
    runtime,
    "pointerInteractionActive",
    () => pointerInteractionActive,
    (value) => {
      pointerInteractionActive = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "trackPointerInteractions",
    () => trackPointerInteractions,
  );
  bindRuntimeValue(
    runtime,
    "hasActiveEditorInteraction",
    () => hasActiveEditorInteraction,
  );
  bindRuntimeValue(
    runtime,
    "lastDesignInteractionAt",
    () => lastDesignInteractionAt,
    (value) => {
      lastDesignInteractionAt = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shouldDeferDesignRestart",
    () => shouldDeferDesignRestart,
  );
  bindRuntimeValue(
    runtime,
    "createDesignBootstrapDebugger",
    () => createDesignBootstrapDebugger,
  );
  bindRuntimeValue(
    runtime,
    "deferCrashStashAccess",
    () => deferCrashStashAccess,
  );
  bindRuntimeValue(
    runtime,
    "readDesignIndexWithRetry",
    () => readDesignIndexWithRetry,
  );
  bindRuntimeValue(
    runtime,
    "createBootDesignFilesPort",
    () => createBootDesignFilesPort,
  );
  bindRuntimeValue(runtime, "wrapBootFilesListing", () => wrapBootFilesListing);
  bindRuntimeValue(
    runtime,
    "initialDesignTitle",
    () => initialDesignTitle,
    (value) => {
      initialDesignTitle = value;
    },
  );
  bindRuntimeValue(runtime, "focusDesignArtboard", () => focusDesignArtboard);
  bindRuntimeValue(
    runtime,
    "DESIGN_FOCUS_WAIT_MS",
    () => DESIGN_FOCUS_WAIT_MS,
    (value) => {
      DESIGN_FOCUS_WAIT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "focusDesignArtboardWhenWindowActive",
    () => focusDesignArtboardWhenWindowActive,
  );
  bindRuntimeValue(
    runtime,
    "RELATIVE_ASSET_REFERENCE_PATTERN",
    () => RELATIVE_ASSET_REFERENCE_PATTERN,
    (value) => {
      RELATIVE_ASSET_REFERENCE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buildFallbackDesignFileListing",
    () => buildFallbackDesignFileListing,
  );
  bindRuntimeValue(
    runtime,
    "LAST_FOCUSED_ARTBOARD_KEY",
    () => LAST_FOCUSED_ARTBOARD_KEY,
    (value) => {
      LAST_FOCUSED_ARTBOARD_KEY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_FILES_READ_FAILURE_MESSAGE",
    () => DESIGN_FILES_READ_FAILURE_MESSAGE,
    (value) => {
      DESIGN_FILES_READ_FAILURE_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "loadDesignDocumentTree",
    () => loadDesignDocumentTree,
    (value) => {
      loadDesignDocumentTree = value;
    },
  );
  bindRuntimeValue(runtime, "bootDesignDocument", () => bootDesignDocument);
  return () => {
    lastFocusedDesignFile = null;
    DESIGN_VIEW_STORAGE_KEY_PATTERN = /^design-view\//;
    getRestoredDesignViewState = (): Dynamic => restoredDesignViewState;
    (0, runtime.initializeCdsIndex)();
    recoveryJsxRuntime = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    afterTwoAnimationFrames = (input?: Dynamic): Dynamic => {
      if (typeof requestAnimationFrame != "function")
        return void setTimeout(input, 0);
      requestAnimationFrame((): Dynamic => requestAnimationFrame(input));
    };
    hasDesignFilesListing = (input?: Dynamic): Dynamic =>
      hasDesignIndexListing(input) ||
      (input != null && Object.hasOwn(input, "canvas.json"));
    selectWritableBootListing = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic =>
      options.hosted || options.capture || options.narrowed || input == null
        ? undefined
        : input;
    pointerInteractionActive = false;
    lastDesignInteractionAt = -1 / 0;
    initialDesignTitle =
      (typeof document === "undefined" ? "" : (document as Dynamic).title) ||
      "Design";
    DESIGN_FOCUS_WAIT_MS = 5e3;
    RELATIVE_ASSET_REFERENCE_PATTERN =
      /(?:\b(?:href|src)\s*=\s*["']|url\(\s*["']?)(?!(?:[a-z][a-z0-9+.-]*:|\/|#))([^"'()?#\s]+)/gi;
    LAST_FOCUSED_ARTBOARD_KEY = "last";
    DESIGN_FILES_READ_FAILURE_MESSAGE =
      "Couldn\u2019t read this canvas\u2019s files. Reload to try again.";
    loadDesignDocumentTree = async (input?: Dynamic): Promise<Dynamic> => {
      try {
        return await bootDesignDocument(input);
      } catch (value: Dynamic) {
        console.warn("design: the files boot failed", value);
        runtime.hotReloadController.detach();
        return input.embedded || runtime.isEmbeddedApplication
          ? null
          : (): Dynamic => {
              throw new Error(DESIGN_FILES_READ_FAILURE_MESSAGE);
            };
      }
    };
  };
}
