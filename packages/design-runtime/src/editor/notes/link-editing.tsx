/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorNotesLinkEditing(
  runtime: RuntimeBindings,
): () => void {
  var jsxNotesLinkEditing: Dynamic;
  var NotesLinkEditingLabel: Dynamic;
  var NotesLinkEditingClosest: Dynamic;
  var Fef3a2Value: Dynamic;
  var noteLinkHighlightColor: Dynamic;
  var NotesLinkEditingGrayRedOrangeConfig: Dynamic;
  var NotesLinkEditingGrayRedOrangeConfig_2: Dynamic;
  var NotesLinkEditingHandler: Dynamic;
  var NotesLinkEditingHandler_2: Dynamic;
  var NotesLinkEditingLh: Dynamic;
  var NotesLinkEditingKind: Dynamic;
  var NotesLinkEditingSize: Dynamic;
  var NotesLinkEditingMin: Dynamic;
  function createNoteLinkEditor(input?: Dynamic): Dynamic {
    let value: Dynamic = null,
      callback: Dynamic = (input2?: Dynamic): Dynamic => {
        let value2: Dynamic = input2
          ? (input2 instanceof Element
              ? input2
              : input2.parentElement
            )?.closest(runtime.ContenteditableFalseValue)
          : null;
        return value2 && input.contains(value2) ? value2 : null;
      },
      callback2: Dynamic = (
        input2?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
      ): Dynamic => {
        let value2: Dynamic = (0,
        runtime.NotesAutoformatCaretPositionFromPoint)(input2, options);
        return (
          callback(value2 ? value2[0] : null) ??
          callback(context instanceof Node ? context : null)
        );
      },
      callback3: Dynamic = (input2?: Dynamic): Dynamic =>
        !!(window as Dynamic).getSelection()?.anchorNode &&
        input2.contains((window as Dynamic).getSelection().anchorNode),
      callback4: Dynamic = (
        input2?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
      ): Dynamic => {
        let parentNode: Dynamic = context.parentNode,
          value2: Dynamic = [...parentNode.childNodes].indexOf(context),
          value3: Dynamic = (document as Dynamic).createRange();
        value3.setStart(...options);
        input2.setBaseAndExtent(
          ...options,
          parentNode,
          value3.comparePoint(parentNode, value2) < 0 ? value2 : value2 + 1,
        );
      },
      callback5: Dynamic = (
        input2?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
        value2?: Dynamic,
      ): Dynamic => {
        let value3: Dynamic = (window as Dynamic).getSelection();
        if (value !== input2 || !value3 || value3.rangeCount === 0) return;
        if (!input2.chip && !input2.anchor) {
          let value11: Dynamic = value2 ?? callback(value3.focusNode);
          value11 &&
            input.contains(value3.anchorNode) &&
            !callback(value3.anchorNode) &&
            callback4(
              value3,
              [value3.anchorNode, value3.anchorOffset],
              value11,
            );
          return;
        }
        let bounds: Dynamic = input.getBoundingClientRect(),
          value4: Dynamic = Math.min(
            Math.max(options, bounds.left + 1, 0),
            bounds.right - 1,
            (window as Dynamic).innerWidth - 1,
          ),
          value5: Dynamic = Math.min(
            Math.max(context, bounds.top + 1, 0),
            bounds.bottom - 1,
            (window as Dynamic).innerHeight - 1,
          ),
          value6: Dynamic = (0, runtime.NotesAutoformatCaretPositionFromPoint)(
            value4,
            value5,
          ),
          value7: Dynamic =
            value6 &&
            (value6[0] instanceof Element
              ? value6[0]
              : value6[0].parentElement),
          value8: Dynamic =
            !!value6 &&
            !!value7 &&
            input.contains(value7) &&
            !value7.closest(runtime.ContenteditableFalseValue),
          value9: Dynamic = value2 ?? (value6 ? callback(value6[0]) : null),
          value10: Dynamic = input2.chip?.parentNode;
        if (input2.chip && value10) {
          let value11: Dynamic = [...value10.childNodes].indexOf(input2.chip),
            value12: Dynamic = (document as Dynamic).createRange();
          value12.setStart(value10, value11 + 1);
          if (value8)
            input2.anchor = [
              value10,
              value12.comparePoint(value6[0], value6[1]) < 0
                ? value11 + 1
                : value11,
            ];
          else if (value9 && value9 !== input2.chip)
            input2.anchor = [
              value10,
              input2.chip.compareDocumentPosition(value9) &
              Node.DOCUMENT_POSITION_PRECEDING
                ? value11 + 1
                : value11,
            ];
          else if (!input2.anchor) {
            let value13: Dynamic = input2.chip.getClientRects()[0];
            input2.anchor = [
              value10,
              value13 &&
              (context < value13.top ||
                (context <= value13.bottom && options < value13.left))
                ? value11 + 1
                : value11,
            ];
          }
        }
        input2.anchor &&
          (value8
            ? value3.setBaseAndExtent(...input2.anchor, value6[0], value6[1])
            : (value9 ?? input2.chip) &&
              callback4(value3, input2.anchor, value9 ?? input2.chip));
      },
      callback6: Dynamic = (event?: Dynamic): Dynamic => {
        let value2: Dynamic = value;
        if (
          !value2 ||
          event.buttons !== 1 ||
          (cancelAnimationFrame(value2.raf),
          Math.hypot(event.clientX - value2.x, event.clientY - value2.y) < 5)
        )
          return;
        let value3: Dynamic = callback2(
          event.clientX,
          event.clientY,
          event.target,
        );
        if (
          value2.chip &&
          !value2.anchor &&
          value3 === value2.chip &&
          callback3(value2.chip)
        )
          return;
        let { clientX: value4, clientY: value5 }: Dynamic = event;
        value2.raf = requestAnimationFrame(
          (): Dynamic => callback5(value2, value4, value5, value3),
        );
      },
      callback7: Dynamic = (event?: Dynamic): Dynamic => {
        let value2: Dynamic = value;
        value2 && cancelAnimationFrame(value2.raf);
        if (value2 && event instanceof MouseEvent && event.type === "mouseup") {
          let value3: Dynamic = (window as Dynamic).getSelection(),
            value4: Dynamic = callback2(
              event.clientX,
              event.clientY,
              event.target,
            );
          Math.hypot(event.clientX - value2.x, event.clientY - value2.y) < 5
            ? value3 &&
              value2.chip &&
              (value3.isCollapsed ||
                !value2.chip.contains(value3.anchorNode) ||
                !value2.chip.contains(value3.focusNode)) &&
              (0, runtime.NotesAutoformatParentNode)(value3, value2.chip)
            : (value2.chip &&
                !value2.anchor &&
                value4 === value2.chip &&
                callback3(value2.chip)) ||
              callback5(value2, event.clientX, event.clientY, value4);
        }
        value = null;
        event?.type === "mouseup" &&
          requestAnimationFrame((): Dynamic => {
            let value3: Dynamic = (window as Dynamic).getSelection();
            if (!value3 || value3.rangeCount === 0) return;
            let value4: Dynamic = callback(value3.anchorNode),
              value5: Dynamic = callback(value3.focusNode);
            value3.isCollapsed
              ? value5 && (0, runtime.NotesAutoformatParentNode)(value3, value5)
              : value5 && !value4 && input.contains(value3.anchorNode)
                ? callback4(
                    value3,
                    [value3.anchorNode, value3.anchorOffset],
                    value5,
                  )
                : value4 &&
                  !value5 &&
                  input.contains(value3.focusNode) &&
                  callback4(
                    value3,
                    [value3.focusNode, value3.focusOffset],
                    value4,
                  );
          });
      };
    (window as Dynamic).addEventListener("mousemove", callback6, true);
    (window as Dynamic).addEventListener("pointerdown", callback7, true);
    (window as Dynamic).addEventListener("mouseup", callback7, true);
    (window as Dynamic).addEventListener("pointercancel", callback7, true);
    return {
      onMouseDown(event: Dynamic): Dynamic {
        if (event.button !== 0) return;
        let value2: Dynamic =
            !event.shiftKey &&
            !event.metaKey &&
            !event.ctrlKey &&
            !event.altKey,
          value3: Dynamic = (window as Dynamic).getSelection(),
          value4: Dynamic = (0, runtime.NotesAutoformatCaretPositionFromPoint)(
            event.clientX,
            event.clientY,
          ),
          value5: Dynamic =
            callback(value4 ? value4[0] : null) ?? callback(event.target),
          value6: Dynamic =
            value2 &&
            event.detail < 2 &&
            !!value3 &&
            !!value4 &&
            !value3.isCollapsed &&
            value3.rangeCount > 0 &&
            value3.getRangeAt(0).isPointInRange(...value4);
        value = {
          x: event.clientX,
          y: event.clientY,
          chip: value2 ? value5 : null,
          anchor: value6 && !value5 ? value4 : null,
          raf: 0,
        };
        if (value6) {
          event.preventDefault();
          value5
            ? (0, runtime.NotesAutoformatParentNode)(value3, value5)
            : value3.collapse(...value4);
          input.focus();
          return;
        }
        if (!value5 || !value2 || !value3 || event.detail < 2) return;
        event.preventDefault();
        value = null;
        let parentNode: Dynamic = value5.parentNode,
          value7: Dynamic = [...parentNode.childNodes].indexOf(value5);
        value3.setBaseAndExtent(parentNode, value7, parentNode, value7 + 1);
        input.focus();
      },
      stop(): Dynamic {
        (window as Dynamic).removeEventListener("mousemove", callback6, true);
        (window as Dynamic).removeEventListener("pointerdown", callback7, true);
        (window as Dynamic).removeEventListener("mouseup", callback7, true);
        (window as Dynamic).removeEventListener(
          "pointercancel",
          callback7,
          true,
        );
        callback7();
      },
    };
  }
  bindRuntimeValue(runtime, "createNoteLinkEditor", () => createNoteLinkEditor);
  bindRuntimeValue(
    runtime,
    "jsxNotesLinkEditing",
    () => jsxNotesLinkEditing,
    (value) => {
      jsxNotesLinkEditing = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesLinkEditingLabel",
    () => NotesLinkEditingLabel,
    (value) => {
      NotesLinkEditingLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesLinkEditingClosest",
    () => NotesLinkEditingClosest,
    (value) => {
      NotesLinkEditingClosest = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "Fef3a2Value",
    () => Fef3a2Value,
    (value) => {
      Fef3a2Value = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "noteLinkHighlightColor",
    () => noteLinkHighlightColor,
    (value) => {
      noteLinkHighlightColor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesLinkEditingGrayRedOrangeConfig",
    () => NotesLinkEditingGrayRedOrangeConfig,
    (value) => {
      NotesLinkEditingGrayRedOrangeConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesLinkEditingGrayRedOrangeConfig_2",
    () => NotesLinkEditingGrayRedOrangeConfig_2,
    (value) => {
      NotesLinkEditingGrayRedOrangeConfig_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesLinkEditingHandler",
    () => NotesLinkEditingHandler,
    (value) => {
      NotesLinkEditingHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesLinkEditingHandler_2",
    () => NotesLinkEditingHandler_2,
    (value) => {
      NotesLinkEditingHandler_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesLinkEditingLh",
    () => NotesLinkEditingLh,
    (value) => {
      NotesLinkEditingLh = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesLinkEditingKind",
    () => NotesLinkEditingKind,
    (value) => {
      NotesLinkEditingKind = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesLinkEditingSize",
    () => NotesLinkEditingSize,
    (value) => {
      NotesLinkEditingSize = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NotesLinkEditingMin",
    () => NotesLinkEditingMin,
    (value) => {
      NotesLinkEditingMin = value;
    },
  );
  return () => {
    jsxNotesLinkEditing = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    NotesLinkEditingLabel = "[data-note-typing-strip], [data-mc-popover]";
    NotesLinkEditingClosest = (input?: Dynamic): Dynamic =>
      input instanceof Element && input.closest(NotesLinkEditingLabel) !== null;
    Fef3a2Value = "#fef3a2";
    noteLinkHighlightColor = "#4a4220";
    NotesLinkEditingGrayRedOrangeConfig = {
      gray: "#73726c",
      red: "#c62828",
      orange: "#a05c00",
      green: "#2e7d32",
      teal: "#3f7566",
      blue: "#2a78d6",
      purple: "#6a64a8",
      pink: "#ad4d72",
    };
    NotesLinkEditingGrayRedOrangeConfig_2 = {
      gray: "#d9d6d0",
      red: "#f5c6c2",
      orange: "#f8d9b8",
      green: "#cfe5c9",
      teal: "#c4e4e0",
      blue: "#c8daf4",
      purple: "#dccdf1",
      pink: "#f4cadf",
    };
    NotesLinkEditingHandler = (input?: Dynamic): Dynamic =>
      input === "default"
        ? Fef3a2Value
        : NotesLinkEditingGrayRedOrangeConfig_2[input];
    NotesLinkEditingHandler_2 = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic => {
      let value: Dynamic =
        options === "default"
          ? undefined
          : NotesLinkEditingGrayRedOrangeConfig[options];
      return input !== "title1"
        ? (value ?? noteLinkHighlightColor)
        : value === undefined
          ? "var(--cds-text-primary)"
          : "color-mix(in oklab, " +
            value +
            " var(--om-title-ink, 100%), var(--cds-text-primary))";
    };
    NotesLinkEditingLh = (input?: Dynamic): Dynamic => {
      let { size: value }: Dynamic = (0, runtime.annotationTextStyle)(input),
        value2: Dynamic = (0, runtime.PlatformFileContentMin)(value);
      return Math.round(value * value2.lh) + 2 * value2.py;
    };
    NotesLinkEditingKind = (source?: Dynamic): Dynamic => {
      if (source.kind !== "title1") return source.w;
      let { size: value }: Dynamic = (0, runtime.annotationTextStyle)(source),
        value2: Dynamic = source.text
          .split(
            `
`,
          )
          .reduce(
            (input?: Dynamic, options?: Dynamic): Dynamic =>
              Math.max(
                input,
                (0, runtime.PlatformFileContentMatch)(options, value),
              ),
            0,
          );
      return Math.min(
        (0, runtime.PlatformFileContentMaxW)(source),
        value2 + 2 * (0, runtime.PlatformFileContentMin)(value).px,
      );
    };
    NotesLinkEditingSize = (input?: Dynamic): Dynamic => {
      let value: Dynamic = (0, runtime.annotationTextStyle)(input),
        value2: Dynamic = (0, runtime.PlatformFileContentMin)(value.size);
      return {
        color: NotesLinkEditingHandler_2(value.kind, value.color),
        fontSize: value.size,
        fontWeight: value.bold ? 700 : undefined,
        fontStyle: value.italic ? "italic" : undefined,
        lineHeight: value2.lh,
        letterSpacing: value2.ls,
        padding: String(value2.py) + "px " + String(value2.px) + "px",
        minHeight: NotesLinkEditingLh(input),
      };
    };
    NotesLinkEditingMin = (input?: Dynamic): Dynamic =>
      Math.min(
        runtime.PlatformFileContentConstant_10,
        Math.max(runtime.PlatformFileContentConstant_9, Math.round(input)),
      );
  };
}
