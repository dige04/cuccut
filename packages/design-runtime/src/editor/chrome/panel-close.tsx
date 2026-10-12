/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorChromePanelClose(
  runtime: RuntimeBindings,
): () => void {
  var reactChromePanelClose: Dynamic;
  var jsxChromePanelClose: Dynamic;
  var jsxChromePanelClose_2: Dynamic;
  var ChromePanelCloseClassNames: Dynamic;
  var ChromePanelCloseClassNames_2: Dynamic;
  function usePanelClose(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.reactChromeResizeGrip.useRef)({
      open: input,
      isOpenNow: options,
    });
    value.current = {
      open: input,
      isOpenNow: options,
    };
    let value2: Dynamic = (0, runtime.reactChromeResizeGrip.useRef)(false);
    (0, runtime.reactChromeResizeGrip.useEffect)(
      (): Dynamic => (
        (value2.current = true),
        (): Dynamic => {
          value2.current = false;
        }
      ),
      [],
    );
    (0, runtime.reactChromeResizeGrip.useEffect)((): Dynamic => {
      if (input)
        return (): Dynamic => {
          runtime.ChromeResizeGripCurrentState !== null &&
            requestAnimationFrame((): Dynamic => {
              let { open: current, isOpenNow: current2 }: Dynamic =
                value.current;
              (current2 ? current2() : value2.current && current) ||
                panelCanRestoreFocus();
            });
        };
    }, [input]);
  }
  function panelCanRestoreFocus(): Dynamic {
    if (
      runtime.ChromeResizeGripCurrentState === null ||
      !(document as Dynamic).hasFocus()
    )
      return false;
    let activeElement: Dynamic = (document as Dynamic).activeElement;
    if (
      !(
        activeElement === null ||
        activeElement === (document as Dynamic).body ||
        activeElement === (document as Dynamic).documentElement
      )
    )
      return false;
    let value: Dynamic = (0, runtime.ChromeResizeGripCurrentState)();
    return value === null ||
      !value.isConnected ||
      value.closest('[inert], [aria-hidden="true"]') !== null
      ? false
      : (value.focus({
          preventScroll: true,
        }),
        (document as Dynamic).activeElement === value);
  }
  bindRuntimeValue(runtime, "usePanelClose", () => usePanelClose);
  bindRuntimeValue(runtime, "panelCanRestoreFocus", () => panelCanRestoreFocus);
  bindRuntimeValue(
    runtime,
    "reactChromePanelClose",
    () => reactChromePanelClose,
    (value) => {
      reactChromePanelClose = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxChromePanelClose",
    () => jsxChromePanelClose,
    (value) => {
      jsxChromePanelClose = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxChromePanelClose_2",
    () => jsxChromePanelClose_2,
    (value) => {
      jsxChromePanelClose_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ChromePanelCloseClassNames",
    () => ChromePanelCloseClassNames,
    (value) => {
      ChromePanelCloseClassNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ChromePanelCloseClassNames_2",
    () => ChromePanelCloseClassNames_2,
    (value) => {
      ChromePanelCloseClassNames_2 = value;
    },
  );
  return () => {
    reactChromePanelClose = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    jsxChromePanelClose = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    jsxChromePanelClose_2 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    ChromePanelCloseClassNames =
      "[&_[role=radio]]:px-0 [&_[role=radio]]:min-w-[calc(var(--cds-h-control)_-_2px)]";
    ChromePanelCloseClassNames_2 =
      "[&_[data-cds=SegmentedControl]]:gap-0 [&_[data-cds=SegmentedControl]]:p-0 [&_[role=radio]]:px-0 [&_[role=radio]]:min-w-[var(--cds-h-control)]";
  };
}
