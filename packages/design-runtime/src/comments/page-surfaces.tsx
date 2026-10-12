/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installCommentsPageSurfaces(
  runtime: RuntimeBindings,
): () => void {
  var jsx_zMe: Dynamic;
  var zeroPageScroll: Dynamic;
  var pageCommentSurfaceKey: Dynamic;
  function createPageScrollStore(): Dynamic {
    let entries: Dynamic = new Map(),
      values: Dynamic = new Set();
    return {
      get: (input?: Dynamic): Dynamic => entries.get(input) ?? zeroPageScroll,
      set(input: Dynamic, options: Dynamic, context: Dynamic): Dynamic {
        let value: Dynamic = entries.get(input) ?? zeroPageScroll;
        if (!(value.x === options && value.y === context)) {
          entries.set(input, {
            x: options,
            y: context,
          });
          for (let value2 of [...values] as Dynamic) value2();
        }
      },
      subscribe(input: Dynamic): Dynamic {
        values.add(input);
        return (): Dynamic => values.delete(input);
      },
    };
  }
  function observePageScrollAndPointer(
    targetWindow?: Dynamic,
    onPointer?: Dynamic,
    onScroll?: Dynamic,
  ): Dynamic {
    let callback: Dynamic = (input?: Dynamic): Dynamic =>
        typeof input == "number" && Number.isFinite(input) ? input : 0,
      value: Dynamic = null,
      callback2: Dynamic = (): Dynamic => {
        try {
          let value2: Dynamic = callback(targetWindow.scrollX),
            value3: Dynamic = callback(targetWindow.scrollY);
          onScroll(value2, value3);
          value && onPointer(value.x + value2, value.y + value3);
        } catch {}
      },
      callback3: Dynamic = (input?: Dynamic): Dynamic => {
        let value2: Dynamic = input;
        value2.isTrusted &&
          ((value = {
            x: value2.clientX,
            y: value2.clientY,
          }),
          callback2());
      },
      callback4: Dynamic = (input?: Dynamic): Dynamic => {
        let value2: Dynamic = input;
        value2.isTrusted && value2.relatedTarget == null && (value = null);
      },
      state: Dynamic = {
        capture: true,
        passive: true,
      };
    try {
      targetWindow.addEventListener("pointermove", callback3, state);
      targetWindow.addEventListener("pointerout", callback4, state);
      targetWindow.addEventListener("scroll", callback2, {
        passive: true,
      });
    } catch {
      return null;
    }
    callback2();
    return (): Dynamic => {
      try {
        targetWindow.removeEventListener("pointermove", callback3, state);
        targetWindow.removeEventListener("pointerout", callback4, state);
        targetWindow.removeEventListener("scroll", callback2);
      } catch {}
    };
  }
  function pagePointerWithinBox(
    clientX?: Dynamic,
    clientY?: Dynamic,
    scroll?: Dynamic,
    box?: Dynamic,
  ): Dynamic {
    let value: Dynamic = clientX - scroll.x,
      value2: Dynamic = clientY - scroll.y;
    return value < 0 || value2 < 0 || value > box.w || value2 > box.h
      ? null
      : {
          left: value,
          top: value2,
        };
  }
  function PageCommentSurface({
    file: file,
    box: box,
    store: store,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.react_YEt.useSyncExternalStore)(
      store.subscribe,
      (): Dynamic => store.get(file),
      (): Dynamic => store.get(file),
    );
    return (
      <runtime.ViewportScale>
        {(input?: Dynamic): Dynamic => (
          <runtime.PeerCursors
            surface={pageCommentSurfaceKey(file)}
            toLocal={(input2?: Dynamic, options?: Dynamic): Dynamic =>
              pagePointerWithinBox(input2, options, value, box)
            }
            glyphScale={1 / input}
          />
        )}
      </runtime.ViewportScale>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsx_zMe",
    () => jsx_zMe,
    (value) => {
      jsx_zMe = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "zeroPageScroll",
    () => zeroPageScroll,
    (value) => {
      zeroPageScroll = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pageCommentSurfaceKey",
    () => pageCommentSurfaceKey,
    (value) => {
      pageCommentSurfaceKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createPageScrollStore",
    () => createPageScrollStore,
  );
  bindRuntimeValue(
    runtime,
    "observePageScrollAndPointer",
    () => observePageScrollAndPointer,
  );
  bindRuntimeValue(runtime, "pagePointerWithinBox", () => pagePointerWithinBox);
  bindRuntimeValue(runtime, "PageCommentSurface", () => PageCommentSurface);
  return () => {
    jsx_zMe = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    zeroPageScroll = {
      x: 0,
      y: 0,
    };
    pageCommentSurfaceKey = (input?: Dynamic): Dynamic =>
      (0, runtime.embedMemoryPrefix)() +
      "page:" +
      (0, runtime.stableAnchorHash)(input);
  };
}
