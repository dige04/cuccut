/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installFastEditComposer(runtime: RuntimeBindings): () => void {
  var ReactSamplingCapability: Dynamic;
  var isSamplingFunction: Dynamic;
  var fastEditUiJsxRuntime: Dynamic;
  var getArtboardViewportBounds: Dynamic;
  var fastEditHistoryLimit: Dynamic;
  function useSamplingCapability(
    capabilityName?: Dynamic,
    isValid: Dynamic = isSamplingFunction,
  ): Dynamic {
    let [capability, setCapability]: Dynamic = (0,
    ReactSamplingCapability.useState)(undefined);
    (0, ReactSamplingCapability.useEffect)((): Dynamic => {
      if (capabilityName === null) {
        setCapability(undefined);
        return;
      }
      let flag: Dynamic = true;
      (capabilityName === "sample"
        ? (0, runtime.resolveSamplingCapability)(isValid)
        : (0, runtime.awaitHostCapability)(capabilityName, isValid)
      ).then((input?: Dynamic): Dynamic => {
        flag && setCapability((): Dynamic => input);
      });
      return (): Dynamic => {
        flag = false;
      };
    }, [capabilityName]);
    return capability;
  }
  function rankVisibleArtboards(files?: Dynamic): Dynamic {
    return files
      .map((input?: Dynamic): Dynamic => {
        let value: Dynamic = getArtboardViewportBounds(input),
          value2: Dynamic =
            value === undefined
              ? 0
              : Math.max(
                  0,
                  Math.min(value.right, (window as Dynamic).innerWidth) -
                    Math.max(value.left, 0),
                ) *
                Math.max(
                  0,
                  Math.min(value.bottom, (window as Dynamic).innerHeight) -
                    Math.max(value.top, 0),
                );
        return {
          f: input,
          area: value2,
        };
      })
      .filter((input?: Dynamic): Dynamic => input.area > 0)
      .sort(
        (input?: Dynamic, options?: Dynamic): Dynamic =>
          options.area - input.area,
      )
      .map((input?: Dynamic): Dynamic => input.f);
  }
  function FastEditComposer({ host: host, parts: parts }: Dynamic): Dynamic {
    let hostRef: Dynamic = (0, runtime.ReactFastEdit.useRef)(host);
    hostRef.current = host;
    let sample: Dynamic = useSamplingCapability(
        host.readOnly ? null : "sample",
      ),
      debugEnabled: Dynamic = (0, runtime.ReactFastEdit.useMemo)(
        (): Dynamic => (0, runtime.isFastEditDebugEnabled)(),
        [],
      ),
      engine: Dynamic = (0, runtime.ReactFastEdit.useMemo)(
        (): Dynamic =>
          typeof sample != "function"
            ? null
            : debugEnabled
              ? (0, runtime.instrumentSamplingClient)(
                  parts.createEngine(sample),
                )
              : parts.createEngine(sample),
        [sample, parts, debugEnabled],
      );
    (0, runtime.ReactFastEdit.useEffect)(
      (): Dynamic => (): Dynamic => engine?.dispose(),
      [engine],
    );
    let historyLimitRef: Dynamic = (0, runtime.ReactFastEdit.useRef)(
      fastEditHistoryLimit(undefined),
    );
    (0, runtime.ReactFastEdit.useEffect)((): Dynamic => {
      engine
        ?.maxPromptBytes()
        .then((input?: Dynamic): Dynamic => {
          historyLimitRef.current = fastEditHistoryLimit(input);
        })
        .catch((): Dynamic => {});
    }, [engine]);
    let sessionRef: Dynamic = (0, runtime.ReactFastEdit.useRef)(
        (0, runtime.createFastEditSessionState)(undefined),
      ),
      busyRef: Dynamic = (0, runtime.ReactFastEdit.useRef)(false),
      enabled: Dynamic = engine !== null && !host.readOnly,
      controllerRef: Dynamic = (0, runtime.ReactFastEdit.useRef)(null);
    (0, runtime.ReactFastEdit.useEffect)((): Dynamic => {
      if (!enabled) return;
      let value: Dynamic = (0, runtime.subscribeDraftPreviews)(
        (input?: Dynamic): Dynamic => {
          if (input.html === null) {
            runtime.draftHtmlPreviewStore.hold(input.path, false);
            return;
          }
          runtime.draftHtmlPreviewStore.hold(input.path, true);
          let html: Dynamic = input.html;
          html !== "" &&
            (async (): Promise<Dynamic> => {
              let value3: Dynamic = await hostRef.current.handlesRef.current
                ?.get(input.path)
                ?.askTemplate()
                .catch((): Dynamic => null);
              if (typeof value3 != "string" || !value.holds(input.path)) return;
              let value4: Dynamic = (0, runtime.validateFastEditTemplate)(
                value3,
                html,
              );
              if (value4.ok)
                try {
                  runtime.draftHtmlPreviewStore.hold(
                    input.path,
                    true,
                    (0, runtime.buildStaticFastEditPreview)(
                      value4.template,
                      {},
                    ),
                  );
                } catch {}
            })();
        },
        (input?: Dynamic): Dynamic =>
          hostRef.current.canvas
            .boards()
            .some((input2?: Dynamic): Dynamic => input2.file === input),
      );
      controllerRef.current = value;
      let value2: Dynamic = setInterval((): Dynamic => {
        value.sweep();
      }, 2e3);
      return (): Dynamic => {
        clearInterval(value2);
        value.stop();
        controllerRef.current = null;
      };
    }, [enabled]);
    (0, runtime.ReactFastEdit.useEffect)((): Dynamic => {
      if (!enabled) return;
      let callback: Dynamic = (): Dynamic => {
          busyRef.current = true;
        },
        callback2: Dynamic = (): Dynamic => {
          busyRef.current = false;
        };
      (window as Dynamic).addEventListener("pointerdown", callback, {
        capture: true,
        passive: true,
      });
      for (let value2 of ["pointerup", "pointercancel", "blur"] as Dynamic)
        (window as Dynamic).addEventListener(value2, callback2, {
          capture: true,
          passive: true,
        });
      let value: Dynamic = (0, runtime.subscribeSaveEvents)(
        (input?: Dynamic): Dynamic => {
          let current: Dynamic = sessionRef.current;
          if (input.type === "event" && input.name === "apply")
            for (let value2 of (input.data?.boardsReread ?? []) as Dynamic)
              typeof value2 == "string" &&
                current.othersChanged.size < 24 &&
                current.othersChanged.add(value2);
          else if (input.type === "landed" && current.busy === null) {
            let value2: Dynamic = input.paths
              .map(
                (input2?: Dynamic): Dynamic => input2.replace(/^project\//, ""),
              )
              .find((input2?: Dynamic): Dynamic => input2.endsWith(".dc.html"));
            value2 !== undefined && (current.lastTouched = value2);
          }
        },
      );
      return (): Dynamic => {
        (window as Dynamic).removeEventListener("pointerdown", callback, {
          capture: true,
        });
        for (let value2 of ["pointerup", "pointercancel", "blur"] as Dynamic)
          (window as Dynamic).removeEventListener(value2, callback2, {
            capture: true,
          });
        value();
      };
    }, [enabled]);
    (0, runtime.ReactFastEdit.useEffect)((): Dynamic => {
      if (!enabled || engine === null) return;
      let value: Dynamic = (0, runtime.createFastEditController)(
        (): Dynamic => ({
          rules: parts.commentRules,
          addRules: parts.newArtboardRules,
          engine: engine,
          sandbox: parts.sandbox,
          session: sessionRef.current,
          host: (): Dynamic => hostRef.current,
          holds: (input?: Dynamic): Dynamic =>
            controllerRef.current?.holds(input) ?? false,
          inView: rankVisibleArtboards,
          pointerDown: (): Dynamic => busyRef.current,
          maxBytes: historyLimitRef.current,
          ...((0, runtime.PlatformSaveEventsHandler_2)()
            ? {
                onDocEvent: runtime.subscribeSaveEvents,
              }
            : {}),
          ...(debugEnabled
            ? {
                onNoCall: runtime.recordFastEditNoCall,
              }
            : {}),
          rectsOf: async (
            input?: Dynamic,
            options?: Dynamic,
          ): Promise<Dynamic> => {
            let value2: Dynamic =
                hostRef.current.handlesRef.current?.get(input),
              value3: Dynamic =
                value2?.isReady() === true && !value2.isBlocked()
                  ? (0, runtime.createPreviewHandle)(value2.webviewRef.current)
                  : null;
            return value3 == null
              ? null
              : (0, runtime.pickerCommentRects)(value3, options);
          },
          layoutOf: async (
            input?: Dynamic,
            options?: Dynamic,
          ): Promise<Dynamic> => {
            let value2: Dynamic =
                hostRef.current.handlesRef.current?.get(input),
              value3: Dynamic =
                value2?.isReady() === true && !value2.isBlocked()
                  ? (0, runtime.createPreviewHandle)(value2.webviewRef.current)
                  : null;
            return value3 == null
              ? null
              : (0, runtime.probeRenderedElementLayout)(value3, options);
          },
          drawnAt: async (
            input?: Dynamic,
            options?: Dynamic,
            context?: Dynamic,
          ): Promise<Dynamic> => {
            let value2: Dynamic =
                hostRef.current.handlesRef.current?.get(input),
              value3: Dynamic =
                value2?.isReady() === true && !value2.isBlocked()
                  ? (0, runtime.createPreviewHandle)(value2.webviewRef.current)
                  : null;
            return value3 == null
              ? null
              : (0, runtime.probeRenderedElementHit)(value3, options, context);
          },
        }),
        {
          tier: (): Dynamic => parts.tier,
        },
      );
      (0, runtime.setSelectionActionHandler)(value.fastTrack);
      (0, runtime.setSelectionHostFactory)(value.side);
      let flag: Dynamic = true;
      (async (): Promise<Dynamic> => {
        for (; flag; ) {
          let value2: Dynamic = await (0, runtime.captureFastEditCanvasState)({
            host: (): Dynamic => hostRef.current,
            session: sessionRef.current,
          }).catch((): Dynamic => 1);
          await new Promise(
            (input?: Dynamic): Dynamic =>
              setTimeout(input, value2 > 0 ? 400 : 2500),
          );
        }
      })();
      return (): Dynamic => {
        flag = false;
        (0, runtime.setSelectionActionHandler)(null);
        (0, runtime.setSelectionHostFactory)(null);
      };
    }, [enabled, engine, parts, debugEnabled]);
    return enabled ? (
      <fastEditUiJsxRuntime.Fragment>
        <runtime.DraftArtboardPreviews
          boards={(): Dynamic => hostRef.current.canvas.boards()}
        />
        {debugEnabled && !host.hidden && <runtime.FastEditDebugPanel />}
      </fastEditUiJsxRuntime.Fragment>
    ) : null;
  }
  function registerFastEditComposer(parts?: Dynamic): Dynamic {
    (0, runtime.setHostedEditorComponent)(
      ({ host: host }: Dynamic): Dynamic => (
        <FastEditComposer host={host} parts={parts} />
      ),
    );
  }
  bindRuntimeValue(
    runtime,
    "ReactSamplingCapability",
    () => ReactSamplingCapability,
    (value) => {
      ReactSamplingCapability = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isSamplingFunction",
    () => isSamplingFunction,
    (value) => {
      isSamplingFunction = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useSamplingCapability",
    () => useSamplingCapability,
  );
  bindRuntimeValue(
    runtime,
    "fastEditUiJsxRuntime",
    () => fastEditUiJsxRuntime,
    (value) => {
      fastEditUiJsxRuntime = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getArtboardViewportBounds",
    () => getArtboardViewportBounds,
    (value) => {
      getArtboardViewportBounds = value;
    },
  );
  bindRuntimeValue(runtime, "rankVisibleArtboards", () => rankVisibleArtboards);
  bindRuntimeValue(
    runtime,
    "fastEditHistoryLimit",
    () => fastEditHistoryLimit,
    (value) => {
      fastEditHistoryLimit = value;
    },
  );
  bindRuntimeValue(runtime, "FastEditComposer", () => FastEditComposer);
  bindRuntimeValue(
    runtime,
    "registerFastEditComposer",
    () => registerFastEditComposer,
  );
  return () => {
    ReactSamplingCapability = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    isSamplingFunction = (input?: Dynamic): Dynamic =>
      typeof input == "function";
    fastEditUiJsxRuntime = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    getArtboardViewportBounds = (input?: Dynamic): Dynamic =>
      (document as Dynamic)
        .querySelector('[data-mega-artboard="' + CSS.escape(input) + '"]')
        ?.getBoundingClientRect();
    fastEditHistoryLimit = (input?: Dynamic): Dynamic =>
      typeof input == "number" && Number.isFinite(input) && input > 4096
        ? Math.min(6e4, input - 512)
        : 6e4;
  };
}
