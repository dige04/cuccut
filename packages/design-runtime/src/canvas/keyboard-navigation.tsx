/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasKeyboardNavigation(
  runtime: RuntimeBindings,
): () => void {
  var react_ta: Dynamic;
  var canvasFocusAnnouncementDelayMs: Dynamic;
  var canvasFocusAnnouncementRepeatCount: Dynamic;
  var keyboardNavigationMode: Dynamic;
  var canvasKeyboardRepeatIntervalMs: Dynamic;
  function useCanvasKeyboardNavigation(
    options?: Dynamic,
    options2?: Dynamic,
  ): Dynamic {
    let value: Dynamic = (0, react_ta.useRef)(options);
    value.current = options;
    let value2: Dynamic = (0, react_ta.useRef)(options2);
    value2.current = options2;
    let [value3, value4]: Dynamic = (0, react_ta.useState)(null),
      value5: Dynamic = (0, react_ta.useRef)(null),
      callback: Dynamic = (input?: Dynamic): Dynamic => {
        value5.current = input;
        value4(input);
      },
      value6: Dynamic = (0, react_ta.useRef)(null),
      value7: Dynamic = (0, react_ta.useRef)(undefined),
      value8: Dynamic = (0, react_ta.useRef)(0),
      value9: Dynamic = (0, react_ta.useRef)(null),
      value10: Dynamic = (0, react_ta.useRef)(null),
      value11: Dynamic = (0, react_ta.useRef)(null),
      value12: Dynamic = (0, react_ta.useRef)(0),
      value13: Dynamic = (0, react_ta.useRef)(null),
      value14: Dynamic = (0, react_ta.useRef)(null),
      value15: Dynamic = (0, react_ta.useRef)(null),
      value16: Dynamic = (0, react_ta.useRef)(null),
      value17: Dynamic = (0, react_ta.useRef)(null),
      callback2: Dynamic = (input?: Dynamic, options3?: Dynamic): Dynamic => {
        let current: Dynamic = value6.current;
        if (
          current != null &&
          current.file === input &&
          (0, runtime.findOutlineLocation)(options3, current.tid)
        )
          return current.tid;
        let value31: Dynamic =
          value.current.megaSelRef.current.elements.get(input)?.tids;
        if (!value31 || value31.length === 0) return null;
        let values: Dynamic = new Set(value31),
          callback14: Dynamic = (input2?: Dynamic): Dynamic => {
            for (let value32 of input2 as Dynamic) {
              if (values.has(value32.tid)) return value32.tid;
              let value33: Dynamic = callback14(value32.children);
              if (value33 != null) return value33;
            }
            return null;
          };
        return callback14(options3);
      },
      callback3: Dynamic = (input?: Dynamic, options3?: Dynamic): Dynamic => {
        let current: Dynamic = value9.current;
        current?.token !== input.token &&
          ((!options3 && value11.current?.token !== input.token) ||
            (current?.timer && clearTimeout(current.timer),
            (value9.current = {
              ...input,
              timer: options3
                ? callback4(input, canvasFocusAnnouncementRepeatCount)
                : null,
            })));
      },
      callback4: Dynamic = (input?: Dynamic, options3?: Dynamic): Dynamic => {
        let value31: Dynamic = setTimeout((): Dynamic => {
          let current: Dynamic = value9.current;
          if (current?.timer !== value31) return;
          current.timer = null;
          let current2: Dynamic = value.current;
          if (
            !(
              value5.current !== input.file ||
              value6.current?.file !== input.file ||
              current2.focusedFileRef.current !== input.file
            )
          ) {
            if (value10.current) {
              callback9();
              return;
            }
            options3 <= 0 ||
              (current2.selectLayerNow(
                input.file,
                input.tid,
                input.token,
                false,
              )
                ? (current.timer = callback4(input, options3 - 1))
                : current2.handlesRef.current.get(input.file)?.isReady() ===
                    false && callback5(input));
          }
        }, value.current.echoWaitMs ?? canvasFocusAnnouncementDelayMs);
        return value31;
      },
      callback5: Dynamic = (input?: Dynamic): Dynamic => {
        value11.current?.cancel();
        let value31: Dynamic = ++value12.current,
          callback14: Dynamic = (input2?: Dynamic): Dynamic => {
            if (
              value11.current?.serial !== value31 ||
              ((value11.current = null),
              input2 !== "gave-up" || value5.current !== input.file)
            )
              return;
            if (value9.current?.token === input.token) {
              let current2: Dynamic = value10.current;
              current2 && (callback8(), callback7(current2, false));
              return;
            }
            let current: Dynamic = value6.current;
            !current ||
              current.file !== input.file ||
              current.tid !== input.tid ||
              ((0, runtime.announce)(
                (0, runtime.artboardLoadFailureAnnouncement)(
                  value.current.titleOf(input.file),
                ),
              ),
              (value6.current = null));
          },
          value32: Dynamic = value.current.selectElementIn(
            input.file,
            input.tid,
            (): Dynamic => callback3(input, false),
            input.token,
            callback14,
          );
        value11.current = {
          ...input,
          cancel: value32,
          serial: value31,
        };
      },
      callback6: Dynamic = (): Dynamic => {
        let current: Dynamic = value9.current;
        return (
          current != null &&
          (current.timer != null || value11.current?.token === current.token)
        );
      },
      callback7: Dynamic = (input?: Dynamic, options3?: Dynamic): Dynamic => {
        value.current.selectLayerNow(
          input.file,
          input.tid,
          input.token,
          options3,
        )
          ? callback3(input, true)
          : callback5(input);
      },
      callback8: Dynamic = (): Dynamic => {
        let current: Dynamic = value9.current;
        current?.timer && clearTimeout(current.timer);
        value9.current = null;
        value10.current = null;
        value11.current?.cancel();
        value11.current = null;
      },
      callback9: Dynamic = (): Dynamic => {
        let current: Dynamic = value10.current;
        callback8();
        current && callback7(current, false);
      },
      callback10: Dynamic = (): Dynamic => callback8(),
      callback11: Dynamic = (input?: Dynamic): Dynamic => {
        let current: Dynamic = value.current,
          value31: Dynamic = value9.current ?? value11.current;
        value31 &&
          value31.file === input &&
          (current.megaSelRef.current.elements.has(input) ||
            current.clearFrameSelection(input, value31.token));
        callback10();
        current.selectArtboard(input);
      },
      callback12: Dynamic = (input?: Dynamic): Dynamic => {
        let current: Dynamic = value.current;
        value16.current = null;
        value6.current?.file === input && (value6.current = null);
        callback(null);
        callback11(input);
        current.focusArtboard(input);
        (0, runtime.announce)(
          (0, runtime.selectionAnnouncement)(
            (0, runtime.selectionFromArtboards)(new Set([input])),
            value2.current,
            current.titleOf,
          ),
        );
        current.sayUnreadable?.(input);
      };
    (0, react_ta.useEffect)(
      (): Dynamic => (): Dynamic => {
        callback10();
        value14.current && clearTimeout(value14.current);
      },
      [],
    );
    let callback13: Dynamic = (
        input?: Dynamic,
        options3?: Dynamic,
        context?: Dynamic,
      ): Dynamic => {
        value6.current = {
          file: input,
          tid: options3,
        };
        value7.current = value2.current[input];
        (0, runtime.announce)(context);
        let state: Dynamic = {
            file: input,
            tid: options3,
            token: keyboardNavigationMode + String(++value8.current),
            at: Date.now(),
            tree: value2.current[input],
          },
          current: Dynamic = value9.current;
        current && current.file === input && callback6()
          ? (value10.current = state)
          : (callback10(), callback7(state, true));
      },
      value18: Dynamic = (0, react_ta.useCallback)(
        (input?: Dynamic): Dynamic => {
          let current: Dynamic = value.current,
            value31: Dynamic = value2.current[input],
            entry: Dynamic = current.handlesRef.current.get(input),
            value32: Dynamic = current.titleOf(input);
          current.bringArtboardIntoView(input);
          value17.current = null;
          (value9.current ?? value11.current) != null &&
            (value9.current ?? value11.current).file !== input &&
            callback10();
          value6.current?.file !== input && (value6.current = null);
          if (entry?.isBlocked()) {
            value16.current = null;
            callback(null);
            callback11(input);
            current.focusArtboard(input);
            (0, runtime.announce)(
              (0, runtime.artboardLoadFailureAnnouncement)(value32),
            );
            return;
          }
          if (value31 === undefined || entry == null) {
            callback(input);
            value16.current = input;
            current.clearSelectionQuietly();
            current.focusArtboard(input);
            (0, runtime.announce)(
              (0, runtime.artboardLoadingAnnouncement)(value32),
            );
            return;
          }
          value16.current = null;
          if (value31 === null) return callback12(input);
          if (value31.length === 0) {
            callback(null);
            callback11(input);
            current.focusArtboard(input);
            (0, runtime.announce)(
              (0, runtime.emptyArtboardSelectionAnnouncement)(value32),
            );
            return;
          }
          callback(input);
          (0, runtime.canvasElementSelectionCount)(
            current.megaSelRef.current,
          ) && current.clearSelectionQuietly();
          let value33: Dynamic =
              current.focusedFileRef.current === input
                ? callback2(input, value31)
                : null,
            value34: Dynamic =
              value33 != null
                ? (0, runtime.findOutlineLocation)(value31, value33).node
                : (0, runtime.deepestSingleOutlineNode)(value31);
          callback13(
            input,
            value34.tid,
            (0, runtime.outlineLayerNavigationAnnouncement)(
              (0, runtime.findOutlineLocation)(value31, value34.tid),
            ),
          );
        },
        [],
      );
    (0, react_ta.useEffect)((): Dynamic => {
      let current: Dynamic = value16.current;
      if (current == null || value5.current !== current) return;
      let value31: Dynamic = options2[current],
        current2: Dynamic = value.current,
        entry: Dynamic = current2.handlesRef.current.get(current);
      if (entry?.isBlocked()) {
        value16.current = null;
        callback(null);
        callback11(current);
        (0, runtime.announce)(
          (0, runtime.artboardLoadFailureAnnouncement)(
            current2.titleOf(current),
          ),
        );
        return;
      }
      if (value31 === undefined || entry == null) return;
      value16.current = null;
      if (value31 === null) return callback12(current);
      if (value31.length === 0) {
        callback(null);
        callback11(current);
        (0, runtime.announce)(
          (0, runtime.emptyArtboardSelectionAnnouncement)(
            current2.titleOf(current),
          ),
        );
        return;
      }
      let value32: Dynamic = (0, runtime.deepestSingleOutlineNode)(value31);
      callback13(
        current,
        value32.tid,
        (0, runtime.outlineLayerNavigationAnnouncement)(
          (0, runtime.findOutlineLocation)(value31, value32.tid),
        ),
      );
    }, [options2, value3]);
    let value19: Dynamic = (0, react_ta.useCallback)(
        (input?: Dynamic, options3?: Dynamic): Dynamic => {
          if (value5.current !== input) return;
          let value31: Dynamic = value2.current[input];
          if (value31 === undefined) {
            (0, runtime.announce)(
              (0, runtime.artboardLoadingAnnouncement)(
                value.current.titleOf(input),
              ),
            );
            return;
          }
          if (value31 === null) return callback12(input);
          let value32: Dynamic = (0, runtime.adjacentOutlineNode)(
            value31,
            callback2(input, value31),
            options3,
          );
          if (!value32) {
            let current: Dynamic = value.current;
            value16.current = null;
            value6.current = null;
            callback(null);
            callback11(input);
            (0, runtime.announce)(
              (0, runtime.emptyArtboardSelectionAnnouncement)(
                current.titleOf(input),
              ),
            );
            return;
          }
          callback13(
            input,
            value32.tid,
            (0, runtime.outlineLayerAnnouncement)(
              (0, runtime.findOutlineLocation)(value31, value32.tid),
            ),
          );
        },
        [],
      ),
      value20: Dynamic = (0, react_ta.useCallback)(
        (input?: Dynamic): Dynamic => {
          if (value5.current !== input) return;
          let current: Dynamic = value.current,
            value31: Dynamic = value2.current[input];
          if (value31 === undefined) {
            (0, runtime.announce)(
              (0, runtime.artboardLoadingAnnouncement)(current.titleOf(input)),
            );
            return;
          }
          if (value31 === null) return callback12(input);
          let value32: Dynamic = callback2(input, value31);
          if (value32 == null) {
            value19(input, "first");
            return;
          }
          let value33: Dynamic = (0, runtime.findOutlineLocation)(
              value31,
              value32,
            ),
            entry: Dynamic = current.handlesRef.current.get(input);
          if (
            current.canEditRef.current &&
            entry &&
            current.focusedFileRef.current === input &&
            entry.describeTids([value32])[0]?.editable === true
          ) {
            if (!entry.isReady()) {
              (0, runtime.announce)(
                (0, runtime.artboardLoadingAnnouncement)(
                  current.titleOf(input),
                ),
              );
              return;
            }
            value17.current = input;
            entry.startTextEdit(current.rootNameOf(input), value32, "end");
            (0, runtime.announce)(runtime.AccessibilityAnnouncementsLabel_16);
            return;
          }
          let value34: Dynamic = (0, runtime.firstNestedOutlineNode)(
            value33.node,
          );
          if (!value34) {
            (0, runtime.announce)(runtime.NoLayersInsideThisOneMessage);
            return;
          }
          callback13(
            input,
            value34.tid,
            (0, runtime.outlineLayerAnnouncement)(
              (0, runtime.findOutlineLocation)(value31, value34.tid),
            ),
          );
        },
        [value19],
      ),
      value21: Dynamic = (0, react_ta.useCallback)(
        (input?: Dynamic): Dynamic => {
          let current: Dynamic = value.current;
          value16.current = null;
          value17.current = null;
          value6.current = null;
          value15.current = null;
          callback(null);
          callback11(input);
          (0, runtime.announce)(
            (0, runtime.exitOutlineAnnouncement)(current.titleOf(input)),
          );
        },
        [],
      ),
      value22: Dynamic = (0, react_ta.useCallback)(
        (input?: Dynamic): Dynamic => {
          if (value5.current !== input) return;
          let value31: Dynamic = value2.current[input];
          if (value31 === undefined) {
            (0, runtime.announce)(
              (0, runtime.artboardLoadingAnnouncement)(
                value.current.titleOf(input),
              ),
            );
            return;
          }
          if (value31 === null) return callback12(input);
          let value32: Dynamic = callback2(input, value31);
          if (value32 == null) {
            value19(input, "first");
            return;
          }
          let value33: Dynamic = (0, runtime.findOutlineLocation)(
            value31,
            value32,
          );
          if (!value33.parent) {
            value21(input);
            return;
          }
          callback13(
            input,
            value33.parent.tid,
            (0, runtime.outlineLayerAnnouncement)(
              (0, runtime.findOutlineLocation)(value31, value33.parent.tid),
            ),
          );
        },
        [value19, value21],
      ),
      value23: Dynamic = (0, react_ta.useCallback)((): Dynamic => {
        if (value5.current == null && value16.current == null) return;
        value16.current = null;
        value17.current = null;
        value6.current = null;
        let current: Dynamic = value.current,
          value31: Dynamic = value9.current ?? value11.current;
        value31 &&
          current.focusedFileRef.current === value31.file &&
          (current.megaSelRef.current.elements.has(value31.file) &&
            current.forgetHostSelection(value31.file),
          current.clearFrameSelection(value31.file, value31.token));
        value15.current = null;
        callback10();
        callback(null);
      }, []),
      value24: Dynamic = (0, react_ta.useCallback)(
        (input?: Dynamic): Dynamic => {
          let value31: Dynamic = value17.current === input;
          value17.current = null;
          if (
            !value31 ||
            value5.current !== input ||
            !(document as Dynamic).hasFocus()
          )
            return;
          let activeElement: Dynamic = (document as Dynamic).activeElement;
          (activeElement != null &&
            activeElement !== (document as Dynamic).body &&
            activeElement.tagName !== "IFRAME") ||
            value.current.stopOf(input)?.focus({
              preventScroll: true,
            });
        },
        [],
      ),
      value25: Dynamic = (0, react_ta.useCallback)(
        (): Dynamic => value17.current,
        [],
      ),
      value26: Dynamic = (0, react_ta.useCallback)(
        (input?: Dynamic): Dynamic => {
          value15.current?.file === input && (value15.current = null);
          let value31: Dynamic = value9.current ?? value11.current,
            value32: Dynamic =
              value10.current?.file === input
                ? value10.current
                : value31?.file === input
                  ? value31
                  : null,
            value33: Dynamic =
              value6.current?.file === input && value5.current === input
                ? value6.current
                : null,
            current: Dynamic = value.current.megaSelRef.current,
            entry: Dynamic = current.elements.get(input),
            value34: Dynamic =
              !value32 &&
              value33 &&
              entry &&
              entry.tids.length === 1 &&
              entry.tids[0] === value33.tid &&
              entry.part === undefined
                ? {
                    file: input,
                    tid: value33.tid,
                    token: keyboardNavigationMode + String(++value8.current),
                    at: Date.now(),
                    tree: value7.current,
                  }
                : null,
            value35: Dynamic = value32 ?? value34,
            value36: Dynamic = value2.current[input];
          return value35 && value36 != null && value35.tree === value36
            ? (callback8(), callback7(value35, false), "redriven")
            : (value31?.file === input && callback10(),
              value6.current?.file === input && (value6.current = null),
              !value35 || value5.current !== input
                ? false
                : ([...current.elements.keys()].some(
                    (input2?: Dynamic): Dynamic => input2 !== input,
                  ) || (0, runtime.announce)(runtime.NothingSelectedMessage),
                  "lost"));
        },
        [],
      ),
      value27: Dynamic = (0, react_ta.useCallback)(
        (input?: Dynamic, items?: Dynamic, context?: Dynamic): Dynamic => {
          let value31: Dynamic = items == null || items.length === 0,
            current: Dynamic = value9.current;
          if (context != null && context.startsWith(keyboardNavigationMode)) {
            if (value31) return false;
            if (
              current &&
              current.token === context &&
              current.file === input &&
              items.length === 1 &&
              items[0] === current.tid
            ) {
              value15.current = {
                file: input,
                tid: current.tid,
              };
              value10.current == null &&
                ((value6.current = {
                  file: input,
                  tid: current.tid,
                }),
                (value7.current = current.tree));
              callback9();
              return true;
            }
            if (
              !(
                value5.current === input &&
                current == null &&
                value11.current == null
              )
            )
              return false;
          }
          let value32: Dynamic =
            current?.file === input || value11.current?.file === input;
          if (value31 && value32) return false;
          value15.current = null;
          !value31 && value32 && callback10();
          if (value5.current !== input) return true;
          if (value31) {
            value6.current = null;
            return true;
          }
          let current2: Dynamic = value6.current;
          return current2 != null &&
            current2.file === input &&
            items.length === 1 &&
            items[0] === current2.tid
            ? ((value15.current = {
                file: input,
                tid: current2.tid,
              }),
              true)
            : ((current2 == null ||
                current2.file !== input ||
                !items.includes(current2.tid)) &&
                ((value6.current = {
                  file: input,
                  tid: items[0],
                }),
                (value7.current = value2.current[input])),
              true);
        },
        [],
      ),
      value28: Dynamic = (0, react_ta.useCallback)(
        (input?: Dynamic): Dynamic => {
          let current: Dynamic = value15.current;
          value15.current = null;
          if (
            !current ||
            input.elements.size !== 1 ||
            input.artboards.size + input.notes.size > 0
          )
            return false;
          let entry: Dynamic = input.elements.get(current.file);
          return (
            entry != null &&
            entry.tids.length === 1 &&
            entry.tids[0] === current.tid &&
            entry.part === undefined
          );
        },
        [],
      ),
      value29: Dynamic = (0, react_ta.useCallback)(
        (input?: Dynamic): Dynamic =>
          value9.current?.file === input ||
          value10.current?.file === input ||
          value11.current?.file === input,
        [],
      ),
      value30: Dynamic = (0, react_ta.useCallback)(
        (input?: Dynamic): Dynamic => {
          if (!value29(input)) return false;
          let value31: Dynamic =
            (value10.current ?? value9.current ?? value11.current)?.at ??
            Date.now();
          if (value13.current === value31) return true;
          value13.current = value31;
          let callback14: Dynamic = (): Dynamic => {
              value14.current = null;
              let current: Dynamic = value6.current;
              if (
                value13.current !== value31 ||
                !value29(input) ||
                !current ||
                current.file !== input
              )
                return;
              let value33: Dynamic = value2.current[input],
                value34: Dynamic = value33
                  ? (0, runtime.findOutlineLocation)(value33, current.tid)
                  : null;
              value34 &&
                (0, runtime.announce)(
                  (0, runtime.selectingAnnouncement)(
                    (0, runtime.outlineNodeDescription)(value34.node),
                  ),
                );
            },
            value32: Dynamic = Date.now() - value31;
          value32 >= canvasKeyboardRepeatIntervalMs
            ? callback14()
            : (value14.current && clearTimeout(value14.current),
              (value14.current = setTimeout(
                callback14,
                canvasKeyboardRepeatIntervalMs - value32,
              )));
          return true;
        },
        [value29],
      );
    return (0, react_ta.useMemo)(
      (): Dynamic => ({
        inside: value3,
        insideRef: value5,
        enter: value18,
        step: value19,
        descend: value20,
        ascend: value22,
        leave: value21,
        abandon: value23,
        settling: value29,
        holdKey: value30,
        onTextEditEnded: value24,
        editBeganFromStop: value25,
        frameRebooted: value26,
        noteSelection: value27,
        saidSelection: value28,
      }),
      [
        value3,
        value18,
        value19,
        value20,
        value22,
        value21,
        value23,
        value29,
        value30,
        value24,
        value25,
        value26,
        value27,
        value28,
      ],
    );
  }
  bindRuntimeValue(
    runtime,
    "react_ta",
    () => react_ta,
    (value) => {
      react_ta = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "canvasFocusAnnouncementDelayMs",
    () => canvasFocusAnnouncementDelayMs,
    (value) => {
      canvasFocusAnnouncementDelayMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "canvasFocusAnnouncementRepeatCount",
    () => canvasFocusAnnouncementRepeatCount,
    (value) => {
      canvasFocusAnnouncementRepeatCount = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "keyboardNavigationMode",
    () => keyboardNavigationMode,
    (value) => {
      keyboardNavigationMode = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "canvasKeyboardRepeatIntervalMs",
    () => canvasKeyboardRepeatIntervalMs,
    (value) => {
      canvasKeyboardRepeatIntervalMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useCanvasKeyboardNavigation",
    () => useCanvasKeyboardNavigation,
  );
  return () => {
    react_ta = (0, runtime.toModuleNamespace)((0, runtime.load_react)(), 1);
    canvasFocusAnnouncementDelayMs = 1500;
    canvasFocusAnnouncementRepeatCount = 3;
    keyboardNavigationMode = "kb";
    canvasKeyboardRepeatIntervalMs = 300;
  };
}
