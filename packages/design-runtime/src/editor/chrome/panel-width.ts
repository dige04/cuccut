/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorChromePanelWidth(
  runtime: RuntimeBindings,
): () => void {
  var McSideValue: Dynamic;
  var ChromePanelWidthHandler: Dynamic;
  var ChromePanelWidthConstant: Dynamic;
  var ChromePanelWidthConstant_2: Dynamic;
  function readPanelPreference(input?: Dynamic, options?: Dynamic): Dynamic {
    try {
      let value: Dynamic = localStorage.getItem(McSideValue + input);
      if (value === null) return;
      let value2: Dynamic = JSON.parse(value);
      if (options(value2)) return value2;
    } catch {}
  }
  function writePanelPreference(input?: Dynamic, options?: Dynamic): Dynamic {
    try {
      localStorage.setItem(McSideValue + input, JSON.stringify(options));
    } catch {}
  }
  function panelMaximumWidth(): Dynamic {
    return Math.max(
      ChromePanelWidthConstant,
      Math.min(560, (window as Dynamic).innerWidth - 120),
    );
  }
  function clampPanelWidth(input?: Dynamic): Dynamic {
    return Math.max(
      ChromePanelWidthConstant,
      Math.min(panelMaximumWidth(), Math.round(input)),
    );
  }
  function startPanelResizeGesture(
    event?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value: Dynamic = "touch",
  ): Dynamic {
    let callback: Dynamic = (): Dynamic => {};
    if (
      (value === "touch" && event.pointerType === "mouse") ||
      !event.isPrimary ||
      event.button !== 0
    )
      return callback;
    event.preventDefault();
    let currentTarget: Dynamic = event.currentTarget,
      pointerId: Dynamic = event.pointerId;
    currentTarget.setPointerCapture?.(pointerId);
    let callback2: Dynamic = (input?: Dynamic): Dynamic =>
        options === "x" ? input.clientX : input.clientY,
      value2: Dynamic = callback2(event),
      value3: Dynamic = "pointer:" + pointerId,
      flag: Dynamic = false,
      flag2: Dynamic = false;
    context.onResizeStart(value3);
    let callback3: Dynamic = (input?: Dynamic): Dynamic => {
        if (input.pointerId !== pointerId) return;
        let value4: Dynamic = callback2(input) - value2;
        Math.abs(value4) > 3 && (flag = true);
        context.onResize(value4, value3);
      },
      callback4: Dynamic = (input?: Dynamic): Dynamic => {
        flag2 ||
          ((flag2 = true),
          (window as Dynamic).removeEventListener("pointermove", callback3),
          (window as Dynamic).removeEventListener("pointerup", callback5),
          (window as Dynamic).removeEventListener("pointercancel", callback5),
          currentTarget.removeEventListener("lostpointercapture", callback5),
          context.onResizeEnd(flag, value3, input));
      },
      callback5: Dynamic = (input?: Dynamic): Dynamic => {
        input.pointerId === pointerId && callback4();
      };
    (window as Dynamic).addEventListener("pointermove", callback3);
    (window as Dynamic).addEventListener("pointerup", callback5);
    (window as Dynamic).addEventListener("pointercancel", callback5);
    currentTarget.addEventListener("lostpointercapture", callback5);
    return callback4;
  }
  function usePanelWidth(input: Dynamic = 304, options?: Dynamic): Dynamic {
    let [value]: Dynamic = (0, runtime.reactChromePanelShell.useState)(
        (): Dynamic =>
          typeof matchMedia == "function" &&
          matchMedia(runtime.ToolbarPrimitivesMediaQuery).matches
            ? Math.max(input, ChromePanelWidthConstant_2)
            : input,
      ),
      [value2, value3]: Dynamic = (0, runtime.reactChromePanelShell.useState)(
        (): Dynamic =>
          readPanelPreference("width", ChromePanelWidthHandler) ?? value,
      ),
      [value4, value5]: Dynamic = (0, runtime.reactChromePanelShell.useState)(
        panelMaximumWidth,
      );
    (0, runtime.reactChromePanelShell.useLayoutEffect)((): Dynamic => {
      let callback: Dynamic = (): Dynamic => {
        value5(panelMaximumWidth());
        value3((input2?: Dynamic): Dynamic => clampPanelWidth(input2));
      };
      callback();
      (window as Dynamic).addEventListener("resize", callback);
      return (): Dynamic =>
        (window as Dynamic).removeEventListener("resize", callback);
    }, []);
    let value6: Dynamic = (0, runtime.reactChromePanelShell.useRef)(value2),
      value7: Dynamic = (0, runtime.reactChromePanelShell.useRef)(options);
    (0, runtime.reactChromePanelShell.useLayoutEffect)((): Dynamic => {
      value6.current = value2;
      value7.current = options;
    });
    let value8: Dynamic = (0, runtime.reactChromePanelShell.useRef)(value2),
      value9: Dynamic = (0, runtime.reactChromePanelShell.useMemo)(
        (): Dynamic => ({
          onResizeStart: (): Dynamic => {
            value8.current = value6.current;
          },
          onResize: (input2?: Dynamic): Dynamic => {
            let value10: Dynamic = clampPanelWidth(value8.current - input2);
            value3(value10);
            value7.current?.(value10, value8.current);
          },
          onResizeEnd: (): Dynamic => {
            value3(
              (input2?: Dynamic): Dynamic => (
                writePanelPreference("width", input2),
                input2
              ),
            );
          },
        }),
        [],
      );
    return {
      width: value2,
      min: ChromePanelWidthConstant,
      max: value4,
      defaultWidth: value,
      gesture: value9,
    };
  }
  bindRuntimeValue(
    runtime,
    "McSideValue",
    () => McSideValue,
    (value) => {
      McSideValue = value;
    },
  );
  bindRuntimeValue(runtime, "readPanelPreference", () => readPanelPreference);
  bindRuntimeValue(runtime, "writePanelPreference", () => writePanelPreference);
  bindRuntimeValue(
    runtime,
    "ChromePanelWidthHandler",
    () => ChromePanelWidthHandler,
    (value) => {
      ChromePanelWidthHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ChromePanelWidthConstant",
    () => ChromePanelWidthConstant,
    (value) => {
      ChromePanelWidthConstant = value;
    },
  );
  bindRuntimeValue(runtime, "panelMaximumWidth", () => panelMaximumWidth);
  bindRuntimeValue(runtime, "clampPanelWidth", () => clampPanelWidth);
  bindRuntimeValue(
    runtime,
    "startPanelResizeGesture",
    () => startPanelResizeGesture,
  );
  bindRuntimeValue(
    runtime,
    "ChromePanelWidthConstant_2",
    () => ChromePanelWidthConstant_2,
    (value) => {
      ChromePanelWidthConstant_2 = value;
    },
  );
  bindRuntimeValue(runtime, "usePanelWidth", () => usePanelWidth);
  return () => {
    McSideValue = "mc-side/";
    ChromePanelWidthHandler = (input?: Dynamic): Dynamic =>
      typeof input == "number" && Number.isFinite(input);
    ChromePanelWidthConstant = 285;
    ChromePanelWidthConstant_2 = 376;
  };
}
