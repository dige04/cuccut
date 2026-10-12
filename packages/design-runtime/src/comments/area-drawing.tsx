/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installCommentsAreaDrawing(
  runtime: RuntimeBindings,
): () => void {
  var react_mi: Dynamic;
  var jsx_O_: Dynamic;
  var react_jw: Dynamic;
  var commentAreaDragThreshold: Dynamic;
  function CommentAreaOutline({
    rect: rect,
    origin: origin,
    handle: handle,
    onHandlePointerDown: onHandlePointerDown,
    kind: kind,
  }: Dynamic): Dynamic {
    return (
      <jsx_O_.Fragment>
        <div
          aria-hidden={true}
          data-testid={"comment-area-outline"}
          data-kind={kind}
          className={
            "pointer-events-none absolute border border-dashed border-editor-comment-target"
          }
          style={{
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          }}
        />
        {origin ? (
          <div
            aria-hidden={true}
            data-testid={"comment-area-origin"}
            className={
              "pointer-events-none absolute rounded-full ring-6 ring-inset ring-editor-comment-target"
            }
            style={{
              left: origin.x - 10 / 2,
              top: origin.y - 10 / 2,
              width: 10,
              height: 10,
              outline: "2px solid transparent",
              outlineOffset: -2,
            }}
          />
        ) : null}
        {origin && handle ? (
          <div
            data-area-handle={""}
            className={"absolute rounded-full"}
            style={{
              left: origin.x - 18 / 2,
              top: origin.y - 18 / 2,
              width: 18,
              height: 18,
              cursor: "nwse-resize",
            }}
            onPointerDown={onHandlePointerDown}
          />
        ) : null}
      </jsx_O_.Fragment>
    );
  }
  function useCommentAreaMarquee(input?: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0, react_jw.useState)(null),
      value3: Dynamic = (0, react_jw.useRef)(input);
    value3.current = input;
    let value4: Dynamic = (0, react_jw.useRef)(null),
      callback: Dynamic = (): Dynamic => {
        value4.current?.cleanup();
        value4.current = null;
        value2(null);
      };
    (0, react_jw.useEffect)(
      (): Dynamic => (): Dynamic => value4.current?.cleanup(),
      [],
    );
    return {
      marquee: value,
      drawing: (): Dynamic => value4.current !== null,
      start: (
        input2?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
      ): Dynamic => {
        let current: Dynamic = value3.current,
          value5: Dynamic = current.stage(),
          value6: Dynamic =
            context ?? current.toLocal(input2.clientX, input2.clientY);
        if (!value5 || value6 == null) return false;
        callback();
        let pointerId: Dynamic = input2.pointerId;
        try {
          options.setPointerCapture(pointerId);
        } catch {}
        let callback2: Dynamic = (): Dynamic => {
            callback();
            value3.current.onNothing();
          },
          callback3: Dynamic = (input3?: Dynamic): Dynamic =>
            Math.hypot(
              input3.clientX - input2.clientX,
              input3.clientY - input2.clientY,
            ) > value3.current.slopPx,
          flag: Dynamic = false,
          callback4: Dynamic = (input3?: Dynamic): Dynamic => {
            if (input3.pointerId !== pointerId) return;
            if ((input3.buttons & 1) === 0) return callback2();
            if (!flag && !callback3(input3)) return;
            !flag && !context && value3.current.onLive?.();
            flag = true;
            let bounds: Dynamic = value5.getBoundingClientRect();
            value2({
              pin: value6,
              x1: input3.clientX - bounds.left,
              y1: input3.clientY - bounds.top,
              resizing: context !== undefined,
            });
          },
          callback5: Dynamic = (input3?: Dynamic): Dynamic => {
            if (input3.pointerId !== pointerId) return;
            callback();
            let current2: Dynamic = value3.current;
            if (input3.button !== 0) return current2.onNothing();
            if (!callback3(input3)) {
              context || current2.onClick(input3);
              return current2.onNothing();
            }
            let value7: Dynamic = current2.toLocal(
                input3.clientX,
                input3.clientY,
              ),
              value8: Dynamic = current2.toClient(value6);
            if (
              value7 == null ||
              !value8 ||
              Math.abs(input3.clientX - value8.x) < commentAreaDragThreshold ||
              Math.abs(input3.clientY - value8.y) < commentAreaDragThreshold
            )
              return current2.onNothing();
            current2.onArea({
              c0: value6,
              c1: value7,
              at: context
                ? value8
                : {
                    x: input3.clientX,
                    y: input3.clientY,
                  },
              resizing: context !== undefined,
            });
          },
          callback6: Dynamic = (event?: Dynamic): Dynamic => {
            event.key !== "Escape" ||
              !value4.current ||
              (event.preventDefault(), event.stopPropagation(), callback2());
          },
          callback7: Dynamic = (input3?: Dynamic): Dynamic => {
            input3.pointerId === pointerId && callback2();
          };
        (window as Dynamic).addEventListener("pointermove", callback4, true);
        (window as Dynamic).addEventListener("pointerup", callback5, true);
        (window as Dynamic).addEventListener("pointercancel", callback7, true);
        (window as Dynamic).addEventListener("keydown", callback6, true);
        (window as Dynamic).addEventListener("blur", callback2);
        value4.current = {
          id: pointerId,
          cleanup: (): Dynamic => {
            (window as Dynamic).removeEventListener(
              "pointermove",
              callback4,
              true,
            );
            (window as Dynamic).removeEventListener(
              "pointerup",
              callback5,
              true,
            );
            (window as Dynamic).removeEventListener(
              "pointercancel",
              callback7,
              true,
            );
            (window as Dynamic).removeEventListener("keydown", callback6, true);
            (window as Dynamic).removeEventListener("blur", callback2);
            try {
              options.hasPointerCapture(pointerId) &&
                options.releasePointerCapture(pointerId);
            } catch {}
          },
        };
        return true;
      },
      cancel: callback,
    };
  }
  function usePendingCommentArea(input?: Dynamic, options?: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0, react_jw.useState)(null),
      value3: Dynamic = (0, react_jw.useRef)(null),
      value4: Dynamic = (0, react_jw.useRef)({
        composing: input,
        scope: options,
      });
    value4.current = {
      composing: input,
      scope: options,
    };
    let callback: Dynamic = (): Dynamic => {
        let current: Dynamic = value3.current;
        value2(
          value4.current.composing && current?.scope === value4.current.scope
            ? current.rect
            : null,
        );
      },
      callback2: Dynamic = (): Dynamic => {
        value3.current = null;
        value2(null);
      };
    (0, react_jw.useEffect)((): Dynamic => {
      input || callback2();
    }, [input]);
    (0, react_jw.useEffect)(callback, [options]);
    return {
      drawn: value,
      show: value2,
      hold: (input2?: Dynamic, options2?: Dynamic): Dynamic => {
        value3.current = {
          rect: input2,
          scope: options2,
        };
      },
      restore: callback,
      clear: callback2,
    };
  }
  bindRuntimeValue(
    runtime,
    "react_mi",
    () => react_mi,
    (value) => {
      react_mi = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsx_O_",
    () => jsx_O_,
    (value) => {
      jsx_O_ = value;
    },
  );
  bindRuntimeValue(runtime, "CommentAreaOutline", () => CommentAreaOutline);
  bindRuntimeValue(
    runtime,
    "react_jw",
    () => react_jw,
    (value) => {
      react_jw = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commentAreaDragThreshold",
    () => commentAreaDragThreshold,
    (value) => {
      commentAreaDragThreshold = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useCommentAreaMarquee",
    () => useCommentAreaMarquee,
  );
  bindRuntimeValue(
    runtime,
    "usePendingCommentArea",
    () => usePendingCommentArea,
  );
  return () => {
    react_mi = (0, runtime.toModuleNamespace)((0, runtime.load_react)(), 1);
    jsx_O_ = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    react_jw = (0, runtime.toModuleNamespace)((0, runtime.load_react)(), 1);
    commentAreaDragThreshold = 12;
  };
}
