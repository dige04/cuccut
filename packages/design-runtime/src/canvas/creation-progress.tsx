/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installCanvasCreationProgress(
  runtime: RuntimeBindings,
): () => void {
  var jsx_U1e: Dynamic;
  var creationCursorContentInset: Dynamic;
  var creationCursorHeaderOffset: Dynamic;
  var react_Gu: Dynamic;
  var emptyCreationProgress: Dynamic;
  var supportsListedArtboards: Dynamic;
  var getListedArtboards: Dynamic;
  var emptyListedArtboards: Dynamic;
  var creationProgressStateKey: Dynamic;
  var listedArtboardNames: Dynamic;
  var emptyPendingArtboards: Dynamic;
  var emptyCreationBoxes: Dynamic;
  var emptyCreationCoverFiles: Dynamic;
  var emptyCreationProgressUi: Dynamic;
  var creationProgressRetryMs: Dynamic;
  var creationProgressOptions: Dynamic;
  var fitArtboardPadding: Dynamic;
  var fitArtboardHeaderHeight: Dynamic;
  var firstArtboardInReadingOrder: Dynamic;
  var creationSequenceFeatureFlagName: Dynamic;
  var creationSequenceFeatureFlag: Dynamic;
  var creationSequenceEnabled: Dynamic;
  function DesignCreationCursor({
    cursor: cursor,
    boards: boards,
    artboards: artboards,
    scale: scale,
  }: Dynamic): Dynamic {
    if (cursor.at !== "box" && cursor.at !== "rest") return null;
    let value: Dynamic = (cursor.at === "box" ? boards : artboards).find(
      (input?: Dynamic): Dynamic => input.file === cursor.file,
    );
    if (value === undefined) return null;
    let value2: Dynamic =
      cursor.at === "box"
        ? {
            left: value.x + creationCursorContentInset / scale,
            top: value.y + creationCursorContentInset / scale,
          }
        : {
            left: value.x,
            top: value.y - creationCursorHeaderOffset / scale,
          };
    return (
      <div
        aria-hidden={"true"}
        data-testid={"dc-creation-cursor"}
        className={"pointer-events-none absolute left-0 top-0"}
      >
        <runtime.PeerBadge
          tint={"violet"}
          label={{
            kind: "name",
            // CucCut: user-facing copy calls the agent "the agent", not Claude.
            text: "Agent",
          }}
          at={value2}
          glyphScale={1 / scale}
        />
      </div>
    );
  }
  function computeDesignCreationProgress(state?: Dynamic): Dynamic {
    if (!state.on) return emptyCreationProgress;
    let value: Dynamic =
        state.lastProgressAt === undefined
          ? undefined
          : state.lastProgressAt + 6e5,
      value2: Dynamic = state.heard || state.working,
      value3: Dynamic = value2
        ? state.working
        : value !== undefined && state.now < value,
      value4: Dynamic = value3
        ? state.boxed.filter(
            (input?: Dynamic): Dynamic => input.page === state.page,
          )
        : [],
      value5: Dynamic = value4.map((input?: Dynamic): Dynamic => input.spec),
      value6: Dynamic = value4.find(
        (input?: Dynamic): Dynamic => input.arriving !== true,
      ),
      value7: Dynamic = state.boxedThisTurn || state.boxed.length > 0,
      value8: Dynamic =
        state.lastProgressAt === undefined
          ? undefined
          : state.lastProgressAt + 9e4,
      value9: Dynamic =
        !value2 && value3 && value8 !== undefined && state.now < value8,
      state2: Dynamic = {
        at: "none",
      };
    (state.working || value9) &&
      state.editing &&
      (value6 !== undefined
        ? (state2 = {
            at: "box",
            file: value6.spec.file,
          })
        : value4.length > 0
          ? (state2 = {
              at: "box",
              file: value4[value4.length - 1].spec.file,
            })
          : state.working
            ? state.pageEmpty
              ? (state2 = {
                  at: "tips",
                  rotate: !value7,
                })
              : (value7 || state.arrivedThisTurn) &&
                state.lastHere !== undefined &&
                (state2 = {
                  at: "rest",
                  file: state.lastHere,
                })
            : (state2 = {
                at: "none",
              }));
    return {
      boxes: value5,
      cursor: state2,
      toCome: value3 ? state.boxed.length : 0,
      wakeAt:
        !value3 || value2
          ? undefined
          : value9 && value8 !== undefined
            ? Math.min(value8, value ?? value8)
            : value,
    };
  }
  function useMemoByKey(key?: Dynamic, compute?: Dynamic): Dynamic {
    let value: Dynamic = (0, react_Gu.useRef)(undefined);
    value.current?.key !== key &&
      (value.current = {
        key: key,
        value: compute(),
      });
    return value.current.value;
  }
  function useDesignCreationWorkingState(enabled?: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0, react_Gu.useState)((): Dynamic => {
      let value3: Dynamic =
        enabled && runtime.claudeActivityStore.get() === "working";
      return {
        working: value3,
        heard: value3,
      };
    });
    (0, react_Gu.useEffect)((): Dynamic => {
      if (!enabled) return;
      let value3: Dynamic,
        callback: Dynamic = (): Dynamic => {
          clearTimeout(value3);
          runtime.claudeActivityStore.get() === "working"
            ? value2(
                (input?: Dynamic): Dynamic =>
                  input.working && input.heard
                    ? input
                    : {
                        working: true,
                        heard: true,
                      },
              )
            : (value3 = setTimeout(
                (): Dynamic =>
                  value2(
                    (input?: Dynamic): Dynamic =>
                      input.working
                        ? {
                            ...input,
                            working: false,
                          }
                        : input,
                  ),
                runtime.CanvasWorkingStateRegistry.graceMs ??
                  runtime.CanvasWorkingStateConstant,
              ));
        },
        value4: Dynamic = runtime.claudeActivityStore.subscribe(callback);
      callback();
      return (): Dynamic => {
        value4();
        clearTimeout(value3);
      };
    }, [enabled]);
    return value;
  }
  function useDesignCreationProgress(options?: Dynamic): Dynamic {
    let { doc: value }: Dynamic = options,
      [, value2]: Dynamic = (0, react_Gu.useReducer)(
        (input?: Dynamic): Dynamic => input + 1,
        0,
      ),
      [value3]: Dynamic = (0, react_Gu.useState)((): Dynamic => {
        let value21: Dynamic = options.flag
          ? getListedArtboards(value)
          : emptyListedArtboards;
        return {
          creating:
            options.flag &&
            supportsListedArtboards(value) &&
            (options.artboards.length === 0 || value21.awaited.length > 0),
          names: options.flag ? listedArtboardNames(value) : new Set(),
          listed: value21.listed,
          needsProgress: new Set(
            value21.awaited.map((input?: Dynamic): Dynamic => input.file),
          ),
          awaitedKey: value21.awaited.map(
            (input?: Dynamic): Dynamic => input.file,
          ).join(`
`),
          boxed: new Map(),
          awaitedNow: new Set(),
          sawProgress: false,
          boxedThisTurn: false,
          arrivedThisTurn: false,
          lastProgressAt: undefined,
          cover: new Set(),
        };
      }),
      creating: Dynamic = value3.creating,
      value4: Dynamic = useDesignCreationWorkingState(creating),
      value5: Dynamic = (0, react_Gu.useRef)(value4.working);
    value5.current = value4.working;
    let value6: Dynamic = (0, react_Gu.useRef)(false);
    (0, react_Gu.useEffect)((): Dynamic => {
      if (creating)
        return (0, runtime.subscribeRemoteDocumentUpdates)(
          value,
          (input?: Dynamic): Dynamic => {
            let value21: Dynamic = listedArtboardNames(value),
              value22: Dynamic = [...value21].filter(
                (input2?: Dynamic): Dynamic => !value3.names.has(input2),
              );
            value3.names = value21;
            let value23: Dynamic = creationProgressStateKey(value3),
              value24: Dynamic = value3.boxed.size > 0,
              { listed: value25, awaited: value26 }: Dynamic =
                getListedArtboards(value),
              value27: Dynamic = value26.map(
                (input2?: Dynamic): Dynamic => input2.file,
              ).join(`
`);
            input &&
              value27 !== value3.awaitedKey &&
              ((value3.sawProgress = true),
              (value3.lastProgressAt = Date.now()));
            value3.awaitedKey = value27;
            value3.listed = value25;
            let entries: Dynamic = new Map();
            for (let value28 of value26 as Dynamic)
              (value3.boxed.has(value28.file) ||
                (input &&
                  (value3.sawProgress ||
                    !value3.needsProgress.has(value28.file)))) &&
                entries.set(value28.file, value28);
            value3.awaitedNow = new Set(entries.keys());
            for (let [value28, value29] of value3.boxed as Dynamic)
              !entries.has(value28) &&
                value3.listed.has(value28) &&
                !value21.has(value28) &&
                entries.set(value28, value29);
            value3.boxed = entries;
            value5.current && entries.size > 0 && (value3.boxedThisTurn = true);
            (value5.current ||
              runtime.claudeActivityStore.get() === "working") &&
              input &&
              value22.length > 0 &&
              (value3.arrivedThisTurn = true);
            if (input && (value24 || entries.size > 0 || value6.current))
              for (let value28 of value22 as Dynamic) value3.cover.add(value28);
            for (let value28 of value3.cover as Dynamic)
              value21.has(value28) || value3.cover.delete(value28);
            value23 !== creationProgressStateKey(value3) && value2();
          },
        );
    }, [value, creating, value3]);
    value4.working || (value3.arrivedThisTurn = false);
    if (value4.working) value3.boxed.size > 0 && (value3.boxedThisTurn = true);
    else if (value3.boxedThisTurn || (value4.heard && value3.boxed.size > 0)) {
      for (let value21 of value3.boxed.keys() as Dynamic)
        value3.needsProgress.add(value21);
      value3.boxed = new Map();
      value3.awaitedNow = new Set();
      value3.sawProgress = false;
      value3.boxedThisTurn = false;
    }
    let value7: Dynamic = options.artboardsHere
        .filter((input?: Dynamic): Dynamic => input.frameless !== true)
        .at(-1)?.file,
      value8: Dynamic = computeDesignCreationProgress({
        on: creating,
        now: Date.now(),
        working: value4.working,
        heard: value4.heard,
        lastProgressAt: value3.lastProgressAt,
        boxedThisTurn: value3.boxedThisTurn,
        arrivedThisTurn: value3.arrivedThisTurn,
        boxed: [...value3.boxed.values()].map(
          (input?: Dynamic): Dynamic => ({
            spec: input,
            page: (0, runtime.designPageId)(input, options.pages),
            arriving: !value3.awaitedNow.has(input.file),
          }),
        ),
        page: options.pageId,
        pageEmpty: options.pageEmpty,
        lastHere: value7,
        editing: options.editing,
      }),
      wakeAt: Dynamic = value8.wakeAt;
    (0, react_Gu.useEffect)((): Dynamic => {
      if (wakeAt === undefined) return;
      let value21: Dynamic,
        callback: Dynamic = (): Dynamic => {
          let value22: Dynamic = wakeAt - Date.now();
          value22 <= 0 ? value2() : (value21 = setTimeout(callback, value22));
        };
      callback();
      return (): Dynamic => clearTimeout(value21);
    }, [wakeAt]);
    let value9: Dynamic = value8.cursor.at === "tips";
    value6.current = value9;
    let value10: Dynamic = value8.cursor.at === "tips" && value8.cursor.rotate,
      [value11, value12]: Dynamic = (0, react_Gu.useState)(-1);
    (0, react_Gu.useEffect)((): Dynamic => {
      value12(-1);
      if (!value9 || !value10) return;
      let value21: Dynamic = Date.now(),
        value22: Dynamic,
        callback: Dynamic = (): Dynamic => {
          let value23: Dynamic = Date.now() - value21;
          value12((0, runtime.designCreationTipIndex)(value23));
          value22 = setTimeout(
            callback,
            (0, runtime.timeUntilNextDesignCreationTip)(value23),
          );
        };
      value22 = setTimeout(
        callback,
        (0, runtime.timeUntilNextDesignCreationTip)(0),
      );
      return (): Dynamic => clearTimeout(value22);
    }, [value9, value10]);
    let value13: Dynamic = (0, react_Gu.useRef)(value8.toCome);
    value13.current = value8.toCome;
    let value14: Dynamic = (0, react_Gu.useRef)(false),
      value15: Dynamic = (0, react_Gu.useRef)(value4.heard),
      value16: Dynamic = value8.toCome > 0;
    (0, react_Gu.useEffect)((): Dynamic => {
      let value21: Dynamic = value4.heard && !value15.current;
      value15.current = value4.heard;
      if (!value16) {
        value4.heard &&
          (!value4.working || value21) &&
          (value14.current = false);
        return;
      }
      if (value14.current) return;
      let flag: Dynamic = true,
        value22: Dynamic,
        callback: Dynamic = (): Dynamic => {
          value14.current ||
            ((0, runtime.announce)(
              (): Dynamic =>
                !flag || value14.current || value13.current === 0
                  ? null
                  : ((value14.current = true),
                    (0, runtime.ClipboardWorkingFilesHandler)(value13.current)),
              {
                ifIdle: true,
              },
            ),
            (value22 = setTimeout(
              callback,
              creationProgressOptions.retryMs ?? creationProgressRetryMs,
            )));
        };
      callback();
      return (): Dynamic => {
        flag = false;
        clearTimeout(value22);
      };
    }, [value16, value4.working, value4.heard]);
    let value17: Dynamic =
        value8.cursor.at === "box" ? value8.cursor.file : null,
      value18: Dynamic = useMemoByKey(
        value8.boxes.map(
          (input?: Dynamic): Dynamic =>
            [
              input.file,
              input.x,
              input.y,
              input.w,
              input.h,
              input.title,
              JSON.stringify(input.radius),
              input.page,
            ].join("	"),
        ).join(`
`),
        (): Dynamic =>
          value8.boxes.length === 0 ? emptyCreationBoxes : value8.boxes,
      ),
      value19: Dynamic = (0, react_Gu.useMemo)(
        (): Dynamic =>
          value18.length === 0
            ? emptyPendingArtboards
            : value18.map(
                (input?: Dynamic): Dynamic => ({
                  spec: input,
                  active: input.file === value17,
                }),
              ),
        [value18, value17],
      ),
      value20: Dynamic = useMemoByKey(
        [...value3.cover].join(`
`),
        (): Dynamic =>
          value3.cover.size === 0
            ? emptyCreationCoverFiles
            : new Set(value3.cover),
      ),
      current: Dynamic = (0, react_Gu.useRef)((input?: Dynamic): Dynamic => {
        value3.cover.delete(input) && value2();
      }).current;
    return creating
      ? {
          creating: true,
          pendingBoards: value19,
          boxesHere: value18,
          coverFiles: value20,
          cursor: value8.cursor,
          workingLabel: value4.working && value18.length > 0,
          tip: value11,
          onArtboardReady: current,
        }
      : emptyCreationProgressUi;
  }
  function fitBoundsCamera(bounds?: Dynamic, viewport?: Dynamic): Dynamic {
    let value: Dynamic = bounds.maxX - bounds.minX,
      value2: Dynamic = bounds.maxY - bounds.minY,
      value3: Dynamic = Math.min(
        2,
        Math.max(
          runtime.viewportScaleLimits.minScale,
          Math.min(
            (viewport.w - fitArtboardPadding * 2) / value,
            (viewport.h - viewport.top - fitArtboardPadding * 2) / value2,
          ),
        ),
      );
    return {
      x: bounds.minX - (viewport.w / value3 - value) / 2,
      y:
        bounds.minY -
        viewport.top / value3 -
        ((viewport.h - viewport.top) / value3 - value2) / 2,
      scale: value3,
    };
  }
  function creationFocusedCamera(
    artboards?: Dynamic,
    camera?: Dynamic,
    viewport?: Dynamic,
  ): Dynamic {
    let value: Dynamic = firstArtboardInReadingOrder(artboards);
    if (value === undefined) return;
    let value2: Dynamic = fitBoundsCamera(
        {
          minX: 0,
          minY: -fitArtboardHeaderHeight,
          maxX: runtime.PlatformFileContentConstant_5,
          maxY: runtime.PlatformFileContentConstant_6,
        },
        viewport,
      ),
      value3: Dynamic = Math.min(
        2,
        Math.max(
          runtime.viewportScaleLimits.minScale,
          value2.scale *
            Math.min(
              runtime.PlatformFileContentConstant_5 / value.w,
              runtime.PlatformFileContentConstant_6 / value.h,
            ),
        ),
      );
    if (!(camera.scale < value3)) return;
    let value4: Dynamic =
        (runtime.PlatformFileContentConstant_5 / 2 - value2.x) * value2.scale,
      value5: Dynamic =
        (runtime.PlatformFileContentConstant_6 / 2 - value2.y) * value2.scale;
    return {
      x: value.x + value.w / 2 - value4 / value3,
      y: value.y + value.h / 2 - value5 / value3,
      scale: value3,
    };
  }
  bindRuntimeValue(
    runtime,
    "jsx_U1e",
    () => jsx_U1e,
    (value) => {
      jsx_U1e = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "creationCursorContentInset",
    () => creationCursorContentInset,
    (value) => {
      creationCursorContentInset = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "creationCursorHeaderOffset",
    () => creationCursorHeaderOffset,
    (value) => {
      creationCursorHeaderOffset = value;
    },
  );
  bindRuntimeValue(runtime, "DesignCreationCursor", () => DesignCreationCursor);
  bindRuntimeValue(
    runtime,
    "react_Gu",
    () => react_Gu,
    (value) => {
      react_Gu = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "emptyCreationProgress",
    () => emptyCreationProgress,
    (value) => {
      emptyCreationProgress = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "computeDesignCreationProgress",
    () => computeDesignCreationProgress,
  );
  bindRuntimeValue(
    runtime,
    "supportsListedArtboards",
    () => supportsListedArtboards,
    (value) => {
      supportsListedArtboards = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getListedArtboards",
    () => getListedArtboards,
    (value) => {
      getListedArtboards = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "emptyListedArtboards",
    () => emptyListedArtboards,
    (value) => {
      emptyListedArtboards = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "creationProgressStateKey",
    () => creationProgressStateKey,
    (value) => {
      creationProgressStateKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "listedArtboardNames",
    () => listedArtboardNames,
    (value) => {
      listedArtboardNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "emptyPendingArtboards",
    () => emptyPendingArtboards,
    (value) => {
      emptyPendingArtboards = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "emptyCreationBoxes",
    () => emptyCreationBoxes,
    (value) => {
      emptyCreationBoxes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "emptyCreationCoverFiles",
    () => emptyCreationCoverFiles,
    (value) => {
      emptyCreationCoverFiles = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "emptyCreationProgressUi",
    () => emptyCreationProgressUi,
    (value) => {
      emptyCreationProgressUi = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "creationProgressRetryMs",
    () => creationProgressRetryMs,
    (value) => {
      creationProgressRetryMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "creationProgressOptions",
    () => creationProgressOptions,
    (value) => {
      creationProgressOptions = value;
    },
  );
  bindRuntimeValue(runtime, "useMemoByKey", () => useMemoByKey);
  bindRuntimeValue(
    runtime,
    "useDesignCreationWorkingState",
    () => useDesignCreationWorkingState,
  );
  bindRuntimeValue(
    runtime,
    "useDesignCreationProgress",
    () => useDesignCreationProgress,
  );
  bindRuntimeValue(
    runtime,
    "fitArtboardPadding",
    () => fitArtboardPadding,
    (value) => {
      fitArtboardPadding = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fitArtboardHeaderHeight",
    () => fitArtboardHeaderHeight,
    (value) => {
      fitArtboardHeaderHeight = value;
    },
  );
  bindRuntimeValue(runtime, "fitBoundsCamera", () => fitBoundsCamera);
  bindRuntimeValue(
    runtime,
    "firstArtboardInReadingOrder",
    () => firstArtboardInReadingOrder,
    (value) => {
      firstArtboardInReadingOrder = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "creationFocusedCamera",
    () => creationFocusedCamera,
  );
  bindRuntimeValue(
    runtime,
    "creationSequenceFeatureFlagName",
    () => creationSequenceFeatureFlagName,
    (value) => {
      creationSequenceFeatureFlagName = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "creationSequenceFeatureFlag",
    () => creationSequenceFeatureFlag,
    (value) => {
      creationSequenceFeatureFlag = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "creationSequenceEnabled",
    () => creationSequenceEnabled,
    (value) => {
      creationSequenceEnabled = value;
    },
  );
  return () => {
    jsx_U1e = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    creationCursorContentInset = 18;
    creationCursorHeaderOffset = 72;
    react_Gu = (0, runtime.toModuleNamespace)((0, runtime.load_react)(), 1);
    emptyCreationProgress = Object.freeze({
      boxes: Object.freeze([]),
      cursor: Object.freeze({
        at: "none",
      }),
      toCome: 0,
      wakeAt: undefined,
    });
    supportsListedArtboards = (input?: Dynamic): Dynamic =>
      typeof input.listedBoards == "function";
    getListedArtboards = (input?: Dynamic): Dynamic =>
      input.listedBoards?.() ?? emptyListedArtboards;
    emptyListedArtboards = {
      listed: new Set(),
      awaited: [],
    };
    creationProgressStateKey = (input?: Dynamic): Dynamic =>
      [
        [...input.boxed.values()]
          .map(
            (input2?: Dynamic): Dynamic =>
              [
                input2.file,
                input2.x,
                input2.y,
                input2.w,
                input2.h,
                input2.title,
                input2.page,
              ].join(),
          )
          .join(";"),
        [...input.awaitedNow].join(),
        [...input.cover].join(),
        String(input.lastProgressAt),
        String(input.arrivedThisTurn),
      ].join("|");
    listedArtboardNames = (input?: Dynamic): Dynamic =>
      new Set(
        Object.keys(input.content().files).filter(
          (input2?: Dynamic): Dynamic =>
            (0, runtime.isArtboardFile)(input2) &&
            !(0, runtime.isDesignSystemFile)(input2),
        ),
      );
    emptyPendingArtboards = [];
    emptyCreationBoxes = [];
    emptyCreationCoverFiles = new Set();
    emptyCreationProgressUi = {
      creating: false,
      pendingBoards: emptyPendingArtboards,
      boxesHere: emptyCreationBoxes,
      coverFiles: emptyCreationCoverFiles,
      cursor: {
        at: "none",
      },
      workingLabel: false,
      tip: -1,
      onArtboardReady(): Dynamic {},
    };
    creationProgressRetryMs = 1500;
    creationProgressOptions = {};
    fitArtboardPadding = 48;
    fitArtboardHeaderHeight = 40;
    firstArtboardInReadingOrder = (input?: Dynamic): Dynamic =>
      input.reduce(
        (input2?: Dynamic, options?: Dynamic): Dynamic =>
          input2 === undefined ||
          options.x + options.y < input2.x + input2.y ||
          (options.x + options.y === input2.x + input2.y &&
            options.y < input2.y)
            ? options
            : input2,
        undefined,
      );
    creationSequenceFeatureFlagName = "appifact_creation_sequence";
    creationSequenceEnabled = (): Dynamic =>
      (creationSequenceFeatureFlag ??= (0, runtime.getFeatureFlag)(
        creationSequenceFeatureFlagName,
        false,
      ));
  };
}
