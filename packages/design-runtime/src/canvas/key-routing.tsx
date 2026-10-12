/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasKeyRouting(runtime: RuntimeBindings): () => void {
  var react_Eu: Dynamic;
  function isConnectedArtboardWindow(targetWindow?: Dynamic): Dynamic {
    try {
      return targetWindow.frameElement?.isConnected === true;
    } catch {
      return false;
    }
  }
  function createFrameKeyListenerRegistry(): Dynamic {
    let entries: Dynamic = new Map(),
      callback: Dynamic = (input?: Dynamic): Dynamic => {
        let entry: Dynamic = entries.get(input);
        entries.delete(input);
        try {
          entry?.off();
        } catch {}
      },
      callback2: Dynamic = (): Dynamic => {
        for (let [value, value2] of [...entries] as Dynamic)
          isConnectedArtboardWindow(value2.target) || callback(value);
      };
    return {
      seen(input: Dynamic, options: Dynamic, context: Dynamic): Dynamic {
        callback2();
        if (options === null || entries.get(input)?.target === options) return;
        callback(input);
        let value: Dynamic = context(options),
          callback3: Dynamic = (input2?: Dynamic): Dynamic => {
            !input2.persisted &&
              entries.get(input)?.target === options &&
              callback(input);
          },
          callback4: Dynamic = (): Dynamic => {};
        try {
          callback4 = (0, runtime.addNativeEventListener)(
            options,
            "pagehide",
            callback3,
            false,
          );
        } catch {}
        entries.set(input, {
          target: options,
          off: (): Dynamic => {
            try {
              callback4();
            } finally {
              value();
            }
          },
        });
      },
      drop: callback,
      gone(input: Dynamic): Dynamic {
        let entry: Dynamic = entries.get(input);
        entry !== undefined &&
          !isConnectedArtboardWindow(entry.target) &&
          callback(input);
      },
      dropAll(): Dynamic {
        for (let value of [...entries.keys()] as Dynamic) callback(value);
      },
    };
  }
  function frameStepChordOwner(
    frame?: Dynamic,
    navigation2?: Dynamic,
  ): Dynamic {
    let value: Dynamic = navigation2.editing ?? navigation2.began;
    if (value === null || navigation2.frame(value) !== frame) return null;
    let value2: Dynamic = navigation2.began === value,
      value3: Dynamic = navigation2.editing === null ? frame : null;
    return (): Dynamic =>
      value2 && navigation2.inside() === value
        ? (navigation2.stopOf(value) ?? value3)
        : value3;
  }
  function useArtboardKeyRouting({
    host: host,
    enabled: enabled,
    onEnter: onEnter,
    settle: settle,
    textEditOpen: textEditOpen,
    ownsStepChord: ownsStepChord,
    pageOwnsKeys: pageOwnsKeys,
    subscribe: subscribe,
    textEditIn: textEditIn,
    editBeganFromStop: editBeganFromStop,
    walkInside: walkInside,
    stopOf: stopOf,
  }: Dynamic): Dynamic {
    let [value]: Dynamic = (0, react_Eu.useState)(
        (): Dynamic => (0, runtime.createCanvasFindAdapter)(host),
      ),
      value2: Dynamic = (0, runtime.useFindInPage)({
        adapter: value,
        enabled: enabled,
        ownsStepChord: ownsStepChord,
        restoreFocus: runtime.focusCanvasDocument,
        returnTo: (input?: Dynamic): Dynamic =>
          frameStepChordOwner(input, {
            editing: textEditIn(),
            began: editBeganFromStop(),
            frame: host.frame,
            inside: walkInside,
            stopOf: stopOf,
          }),
      }),
      value3: Dynamic = (0, react_Eu.useRef)(onEnter);
    value3.current = onEnter;
    (0, react_Eu.useEffect)((): Dynamic => {
      if (!value2.isOpen) return;
      let callback: Dynamic = (event?: Dynamic): Dynamic => {
        let callback2: Dynamic = (input?: Dynamic): Dynamic =>
          input instanceof Element &&
          input.closest("[" + runtime.McFindAttribute + "]") !== null;
        callback2(event.target) &&
          !callback2(event.relatedTarget) &&
          value3.current();
      };
      value3.current();
      (document as Dynamic).addEventListener("focusin", callback);
      return (): Dynamic =>
        (document as Dynamic).removeEventListener("focusin", callback);
    }, [value2.isOpen]);
    (0, react_Eu.useEffect)(
      (): Dynamic => subscribe(value.changed),
      [subscribe, value],
    );
    let [value4]: Dynamic = (0, react_Eu.useState)(
        createFrameKeyListenerRegistry,
      ),
      value5: Dynamic = (0, react_Eu.useRef)(pageOwnsKeys);
    value5.current = pageOwnsKeys;
    let value6: Dynamic = (0, react_Eu.useRef)(settle);
    value6.current = settle;
    let value7: Dynamic = (0, react_Eu.useRef)(value2.isOpen);
    value7.current = value2.isOpen;
    let value8: Dynamic = (0, react_Eu.useCallback)(
        (input?: Dynamic): Dynamic => {
          let current: Dynamic = value7.current;
          value6.current((): Dynamic => {
            (!current || value7.current) && input();
          });
        },
        [],
      ),
      value9: Dynamic = (0, react_Eu.useRef)(value2.open);
    value9.current = value2.open;
    let { attach: value10 }: Dynamic = value2,
      value11: Dynamic = (0, react_Eu.useCallback)(
        (input?: Dynamic): Dynamic => {
          try {
            return host.frame(input)?.contentWindow ?? null;
          } catch {
            return null;
          }
        },
        [host],
      ),
      value12: Dynamic = (0, react_Eu.useCallback)(
        (input?: Dynamic): Dynamic => {
          let callback: Dynamic = (
            input2?: Dynamic,
            options?: Dynamic,
          ): Dynamic =>
            (0, runtime.revealFindMatchAfterTextEdit)(
              options,
              value5.current(input),
              input2,
              value8,
              (): Dynamic => value9.current(),
            );
          value4.seen(
            input,
            value11(input),
            (input2?: Dynamic): Dynamic =>
              value10(input2, (): Dynamic => value5.current(input), callback),
          );
        },
        [value10, value4, value11, value8],
      ),
      value13: Dynamic = (0, react_Eu.useCallback)(
        (input?: Dynamic): Dynamic => {
          value4.drop(input);
          value12(input);
          value.frameBooted(input);
        },
        [value, value4, value12],
      ),
      value14: Dynamic = (0, react_Eu.useCallback)(
        (input?: Dynamic): Dynamic => value4.gone(input),
        [value4],
      );
    (0, react_Eu.useEffect)(
      (): Dynamic => (): Dynamic => value4.dropAll(),
      [value4],
    );
    let value15: Dynamic = (0, react_Eu.useRef)(textEditOpen);
    value15.current = textEditOpen;
    let { step: value16 }: Dynamic = value2,
      value17: Dynamic = (0, react_Eu.useCallback)(
        (input?: Dynamic): Dynamic =>
          (0, runtime.revealFindMatchAfterSettle)(
            (document as Dynamic).activeElement instanceof HTMLIFrameElement &&
              value15.current(),
            (): Dynamic => value16(input),
            value8,
            (): Dynamic => value9.current(),
          ),
        [value16, value8],
      );
    return {
      find: (0, react_Eu.useMemo)(
        (): Dynamic => ({
          ...value2,
          bar: {
            ...value2.bar,
            onStep: value17,
          },
        }),
        [value2, value17],
      ),
      changed: value.changed,
      frameBooted: value13,
      frameSeen: value12,
      frameGone: value14,
    };
  }
  bindRuntimeValue(
    runtime,
    "react_Eu",
    () => react_Eu,
    (value) => {
      react_Eu = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isConnectedArtboardWindow",
    () => isConnectedArtboardWindow,
  );
  bindRuntimeValue(
    runtime,
    "createFrameKeyListenerRegistry",
    () => createFrameKeyListenerRegistry,
  );
  bindRuntimeValue(runtime, "frameStepChordOwner", () => frameStepChordOwner);
  bindRuntimeValue(
    runtime,
    "useArtboardKeyRouting",
    () => useArtboardKeyRouting,
  );
  return () => {
    react_Eu = (0, runtime.toModuleNamespace)((0, runtime.load_react)(), 1);
  };
}
