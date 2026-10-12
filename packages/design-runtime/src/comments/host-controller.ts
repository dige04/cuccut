/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCommentsHostController(
  runtime: RuntimeBindings,
): () => void {
  var customAnchorsHostMethod: Dynamic;
  var sendToClaudeHostMethod: Dynamic;
  var customAnchorsController: Dynamic;
  var claimCustomAnchors: Dynamic;
  var bindCustomAnchors: Dynamic;
  function connectCustomAnchors(host?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic;
    try {
      value = Promise.resolve(host.customAnchors(options));
    } catch (value2: Dynamic) {
      value = Promise.reject(value2);
    }
    return value.then(
      (input?: Dynamic): Dynamic => {
        let value2: Dynamic = input;
        if (!value2 || typeof value2.compose != "function") {
          console.warn(
            "[design] customAnchors returned no controller; artboard comments stay off",
          );
          return null;
        }
        if (!sendToClaudeHostMethod(host)) return value2;
        let value3: Dynamic = null,
          flag: Dynamic = false;
        (0, runtime.awaitEditorReady)().then((input2?: Dynamic): Dynamic => {
          if (!input2 || flag) return;
          let value4: Dynamic;
          try {
            value4 = host.onSendToClaude(runtime.runSelectionAction);
          } catch {
            return;
          }
          typeof value4 == "function"
            ? (value3 = value4)
            : Promise.resolve(value4).catch((): Dynamic => {});
        });
        return {
          compose: (
            input2?: Dynamic,
            options2?: Dynamic,
            context?: Dynamic,
          ): Dynamic => value2.compose(input2, options2, context),
          get areas(): Dynamic {
            return value2.areas;
          },
          open: (input2?: Dynamic, options2?: Dynamic): Dynamic =>
            value2.open(input2, options2),
          placed: (input2?: Dynamic): Dynamic => {
            value2.placed(input2);
          },
          domAnchor: (input2?: Dynamic, options2?: Dynamic): Dynamic =>
            value2.domAnchor(input2, options2),
          ...(typeof value2.enterMode == "function"
            ? {
                enterMode: (): Dynamic => {
                  value2.enterMode?.();
                },
              }
            : {}),
          ...(typeof value2.exitMode == "function"
            ? {
                exitMode: (): Dynamic => {
                  value2.exitMode?.();
                },
              }
            : {}),
          release: (): Dynamic => {
            flag = true;
            value3?.();
            value3 = null;
            value2.release();
          },
        };
      },
      (input?: Dynamic): Dynamic => {
        let value2: Dynamic = input;
        console.warn(
          "[design] customAnchors refused; artboard comments stay off:",
          value2?.code,
          value2?.message,
        );
        return null;
      },
    );
  }
  function createCustomAnchorsController(): Dynamic {
    let value: Dynamic = null,
      value2: Dynamic = null,
      flag: Dynamic = false,
      value3: Dynamic = null,
      state: Dynamic = {
        mode: false,
        threads: null,
        composing: false,
      },
      state2: Dynamic = {
        mode: (input?: Dynamic): Dynamic => {
          state.mode = input;
          value3?.mode(input);
        },
        threads: (input?: Dynamic): Dynamic => {
          state.threads = input;
          value3?.threads(input);
        },
        reveal: (input?: Dynamic): Dynamic => {
          value3?.reveal(input);
        },
        composing: (input?: Dynamic): Dynamic => {
          state.composing = input;
          value3?.composing?.(input);
        },
        move: (input?: Dynamic, options?: Dynamic): Dynamic =>
          value3?.move?.(input, options) ?? Promise.resolve(null),
        hotkey: true,
      },
      callback: Dynamic = (): Dynamic => {
        if (value !== null) return value;
        let value4: Dynamic = (0, runtime.getCachedHostCapability)("comments");
        if (customAnchorsHostMethod(value4))
          return (value = connectCustomAnchors(value4, state2));
        // CucCut: the host is globalThis.designHost (packages/design/src/editor/design-host.ts), not globalThis.claude.
        let claude: Dynamic = (globalThis as Dynamic).designHost;
        return typeof claude?.use != "function"
          ? (value = Promise.resolve(null))
          : ((value2 = claude.use.bind(claude)), (value = callback2(value2)));
      },
      callback2: Dynamic = (input?: Dynamic): Dynamic => {
        let value4: Dynamic;
        try {
          value4 = Promise.resolve(input("comments"));
        } catch {
          value4 = Promise.resolve(null);
        }
        return value4.then(
          (input2?: Dynamic): Dynamic =>
            input2?.available !== false && customAnchorsHostMethod(input2)
              ? connectCustomAnchors(input2, state2)
              : (console.warn(
                  "[design] comments capability not served; artboard comments stay off",
                ),
                null),
          (): Dynamic => null,
        );
      };
    return {
      claim: callback,
      bind: async (input?: Dynamic): Promise<Dynamic> => {
        let value4: Dynamic = await callback();
        value4 === null &&
          value2 !== null &&
          (flag || ((flag = true), (value = callback2(value2))),
          (value4 = await value));
        if (value4 === null) return null;
        let value5: Dynamic = value4;
        value3 = input;
        state.threads !== null && input.threads(state.threads);
        state.composing && input.composing?.(true);
        state.mode && input.mode(true);
        return {
          compose: (
            input2?: Dynamic,
            options?: Dynamic,
            context?: Dynamic,
          ): Dynamic => value5.compose(input2, options, context),
          get areas(): Dynamic {
            return value5.areas;
          },
          open: (input2?: Dynamic, options?: Dynamic): Dynamic =>
            value5.open(input2, options),
          placed: (input2?: Dynamic): Dynamic => {
            value5.placed(input2);
          },
          domAnchor: (input2?: Dynamic, options?: Dynamic): Dynamic =>
            value5.domAnchor(input2, options),
          ...(typeof value5.enterMode == "function"
            ? {
                enterMode: (): Dynamic => {
                  value5.enterMode?.();
                },
              }
            : {}),
          ...(typeof value5.exitMode == "function"
            ? {
                exitMode: (): Dynamic => {
                  value5.exitMode?.();
                },
              }
            : {}),
          release: (): Dynamic => {
            value3 === input && (value3 = null);
          },
        };
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "customAnchorsHostMethod",
    () => customAnchorsHostMethod,
    (value) => {
      customAnchorsHostMethod = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sendToClaudeHostMethod",
    () => sendToClaudeHostMethod,
    (value) => {
      sendToClaudeHostMethod = value;
    },
  );
  bindRuntimeValue(runtime, "connectCustomAnchors", () => connectCustomAnchors);
  bindRuntimeValue(
    runtime,
    "createCustomAnchorsController",
    () => createCustomAnchorsController,
  );
  bindRuntimeValue(
    runtime,
    "customAnchorsController",
    () => customAnchorsController,
    (value) => {
      customAnchorsController = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "claimCustomAnchors",
    () => claimCustomAnchors,
    (value) => {
      claimCustomAnchors = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "bindCustomAnchors",
    () => bindCustomAnchors,
    (value) => {
      bindCustomAnchors = value;
    },
  );
  return () => {
    customAnchorsHostMethod = (0, runtime.hasCapabilityMethod)("customAnchors");
    sendToClaudeHostMethod = (0, runtime.hasCapabilityMethod)("onSendToClaude");
    customAnchorsController = createCustomAnchorsController();
    claimCustomAnchors = (): Dynamic => {
      customAnchorsController.claim();
    };
    bindCustomAnchors = (input?: Dynamic): Dynamic =>
      customAnchorsController.bind(input);
  };
}
