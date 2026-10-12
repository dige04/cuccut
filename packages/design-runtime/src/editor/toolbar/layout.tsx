/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorToolbarLayout(
  runtime: RuntimeBindings,
): () => void {
  var jsxToolbarLayout: Dynamic;
  var ToolbarLayoutLimit: Dynamic;
  var ToolbarLayoutConstant: Dynamic;
  var ToolbarLayoutConstant_2: Dynamic;
  var ToolbarLayoutLabel: Dynamic;
  var ToolbarLayoutLabel_2: Dynamic;
  var ToolbarLayoutPresentationNoneGroupSet: Dynamic;
  var ToolbarLayoutMatches: Dynamic;
  var ToolbarLayoutHasAttribute: Dynamic;
  var ToolbarLayoutLimit_2: Dynamic;
  function useToolbarMediaQuery(input?: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.reactToolbarPrimitives.useCallback)(
      (input2?: Dynamic): Dynamic => {
        if (typeof matchMedia != "function") return (): Dynamic => {};
        let value2: Dynamic = matchMedia(input);
        value2.addEventListener("change", input2);
        return (): Dynamic => value2.removeEventListener("change", input2);
      },
      [input],
    );
    return (0, runtime.reactToolbarPrimitives.useSyncExternalStore)(
      value,
      (): Dynamic =>
        typeof matchMedia == "function" && matchMedia(input).matches,
      (): Dynamic => false,
    );
  }
  function useTouchToolbar(): Dynamic {
    return useToolbarMediaQuery(runtime.ToolbarPrimitivesMediaQuery);
  }
  function usePhoneCanvas(): Dynamic {
    return useToolbarMediaQuery(runtime.ToolbarPrimitivesLabel);
  }
  function hasVisibleToolbarContent(
    element?: Dynamic,
    options: Dynamic = {},
  ): Dynamic {
    let attribute: Dynamic = element.getAttribute("role");
    if (
      options.skip?.(element) ||
      (options.pinFixed && element.classList.contains("tb-pin-scroll"))
    )
      return false;
    if (element.hasAttribute("data-tb-shows") && !element.closest("[hidden]"))
      return true;
    if (element.matches(ToolbarLayoutLabel) || attribute === "separator")
      return false;
    if (
      element.matches(ToolbarLayoutLabel_2) ||
      (attribute !== null &&
        !ToolbarLayoutPresentationNoneGroupSet.has(attribute))
    )
      return true;
    for (let value of element.childNodes as Dynamic)
      if (
        (value.nodeType === 3 && value.textContent?.trim()) ||
        (value.nodeType === 1 && hasVisibleToolbarContent(value, options))
      )
        return true;
    return false;
  }
  function visibleToolbarSeatCount(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let index: Dynamic = 0;
    for (let value of input.children as Dynamic)
      index += value.matches("[data-tb-seat], .contents")
        ? visibleToolbarSeatCount(value, options)
        : hasVisibleToolbarContent(value, options)
          ? 1
          : 0;
    return index;
  }
  function updateToolbarEmptySlots(element?: Dynamic): Dynamic {
    let state: Dynamic = {
      pinFixed: element.hasAttribute("data-pin-fixed"),
    };
    for (let value of element.querySelectorAll(
      ".tb-slot, .tb-tail, .tb-publish",
    ) as Dynamic)
      ToolbarLayoutHasAttribute(
        value,
        "data-tb-empty",
        !hasVisibleToolbarContent(value, state),
      );
    for (let value of element.querySelectorAll(".tb-tail") as Dynamic)
      ToolbarLayoutHasAttribute(
        value,
        "data-tb-only-dot",
        !hasVisibleToolbarContent(value, {
          ...state,
          skip: ToolbarLayoutMatches,
        }),
      );
    for (let value of element.querySelectorAll(".tb-publish") as Dynamic)
      ToolbarLayoutHasAttribute(
        value,
        "data-tb-has-save",
        [...value.querySelectorAll("[data-tb-save]")].some(
          (input?: Dynamic): Dynamic => hasVisibleToolbarContent(input, state),
        ),
      );
    for (let value of element.querySelectorAll(".tb-card") as Dynamic)
      ToolbarLayoutHasAttribute(
        value,
        "data-tb-empty",
        !hasVisibleToolbarContent(value, state),
      );
    let element2: Dynamic = element.querySelector(".tb-card-start");
    if (element2) {
      let index: Dynamic = 0;
      for (let value of element2.querySelectorAll(
        ".tb-scroll > .tb-slot",
      ) as Dynamic)
        index += visibleToolbarSeatCount(value, state);
      ToolbarLayoutHasAttribute(element2, "data-tb-floor", index >= 3);
    }
  }
  function updateToolbarPinnedWords(element?: Dynamic): Dynamic {
    let element2: Dynamic = element.querySelector(".tb-scroll");
    if (!element2) return;
    if (!element2.querySelector(".tb-lock-words"))
      return element2.removeAttribute("data-tb-lock-words");
    if (element2.scrollLeft > 1 && !element2.hasAttribute("data-tb-lock-words"))
      return;
    let element3: Dynamic = element2.querySelector(".tb-yields"),
      value: Dynamic = element3 ? "yield" : "";
    element2.getAttribute("data-tb-lock-words") !== value &&
      element2.setAttribute("data-tb-lock-words", value);
    let value2: Dynamic =
      element3 != null &&
      element3.clientWidth < ToolbarLayoutLimit_2 &&
      element3.scrollWidth > element3.clientWidth;
    (element2.scrollWidth > element2.clientWidth + 1 || value2) &&
      element2.removeAttribute("data-tb-lock-words");
  }
  function toolbarDensity(input: Dynamic = "compact"): Dynamic {
    return useTouchToolbar() ? "comfortable" : input;
  }
  function useToolbarOverlaySize(): Dynamic {
    let [value, value2]: Dynamic = (0,
      runtime.reactCanvasMeasurements.useState)(0),
      [value3, value4]: Dynamic = (0, runtime.reactCanvasMeasurements.useState)(
        0,
      ),
      [value5, value6]: Dynamic = (0, runtime.reactCanvasMeasurements.useState)(
        null,
      );
    (0, runtime.reactCanvasMeasurements.useLayoutEffect)((): Dynamic => {
      let value7: Dynamic = null;
      for (
        let value11: Dynamic = value5?.parentElement;
        value11 && !value7;
        value11 = value11.parentElement
      )
        value7 = value11.querySelector(":scope > .tb-root");
      if (!value5 || !value7) {
        value2(0);
        value4(0);
        return;
      }
      let value8: Dynamic = value7,
        callback: Dynamic = (): Dynamic => {
          if (!value8.hasAttribute("data-tb-overlay")) {
            value2(0);
            value4(0);
            return;
          }
          let bounds: Dynamic = value8.getBoundingClientRect();
          value2(
            Math.max(
              0,
              Math.round(bounds.bottom - value5.getBoundingClientRect().top),
            ),
          );
          let value11: Dynamic = [...value8.querySelectorAll(".tb-card")]
            .map((input?: Dynamic): Dynamic => input.getBoundingClientRect())
            .filter((input?: Dynamic): Dynamic => input.width > 0)
            .flatMap(
              (input?: Dynamic): Dynamic => [
                input.left - bounds.left,
                bounds.right - input.right,
              ],
            );
          value4(
            value11.length > 0
              ? Math.max(0, Math.round(Math.min(...value11)))
              : 0,
          );
        };
      callback();
      let value9: Dynamic =
        typeof MutationObserver === "undefined"
          ? null
          : new MutationObserver(callback);
      value9?.observe(value8, {
        attributes: true,
        attributeFilter: ["data-tb-overlay"],
      });
      let value10: Dynamic =
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver(callback);
      value10?.observe(value8);
      value10?.observe(value5);
      return (): Dynamic => {
        value9?.disconnect();
        value10?.disconnect();
      };
    }, [value5]);
    return [value, value6, value3];
  }
  function toolbarOverlayHeight(input?: Dynamic): Dynamic {
    return (
      parseFloat(getComputedStyle(input).getPropertyValue("--tb-overlay-h")) ||
      0
    );
  }
  function ToolbarDivider(): Dynamic {
    return (
      <span
        aria-hidden={"true"}
        className={
          "tb-divider mx-0.5 h-[18px] w-px shrink-0 self-center bg-border-line"
        }
      />
    );
  }
  bindRuntimeValue(runtime, "useToolbarMediaQuery", () => useToolbarMediaQuery);
  bindRuntimeValue(runtime, "useTouchToolbar", () => useTouchToolbar);
  bindRuntimeValue(runtime, "usePhoneCanvas", () => usePhoneCanvas);
  bindRuntimeValue(
    runtime,
    "jsxToolbarLayout",
    () => jsxToolbarLayout,
    (value) => {
      jsxToolbarLayout = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ToolbarLayoutLimit",
    () => ToolbarLayoutLimit,
    (value) => {
      ToolbarLayoutLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ToolbarLayoutConstant",
    () => ToolbarLayoutConstant,
    (value) => {
      ToolbarLayoutConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ToolbarLayoutConstant_2",
    () => ToolbarLayoutConstant_2,
    (value) => {
      ToolbarLayoutConstant_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ToolbarLayoutLabel",
    () => ToolbarLayoutLabel,
    (value) => {
      ToolbarLayoutLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ToolbarLayoutLabel_2",
    () => ToolbarLayoutLabel_2,
    (value) => {
      ToolbarLayoutLabel_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ToolbarLayoutPresentationNoneGroupSet",
    () => ToolbarLayoutPresentationNoneGroupSet,
    (value) => {
      ToolbarLayoutPresentationNoneGroupSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hasVisibleToolbarContent",
    () => hasVisibleToolbarContent,
  );
  bindRuntimeValue(
    runtime,
    "visibleToolbarSeatCount",
    () => visibleToolbarSeatCount,
  );
  bindRuntimeValue(
    runtime,
    "ToolbarLayoutMatches",
    () => ToolbarLayoutMatches,
    (value) => {
      ToolbarLayoutMatches = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ToolbarLayoutHasAttribute",
    () => ToolbarLayoutHasAttribute,
    (value) => {
      ToolbarLayoutHasAttribute = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "updateToolbarEmptySlots",
    () => updateToolbarEmptySlots,
  );
  bindRuntimeValue(
    runtime,
    "ToolbarLayoutLimit_2",
    () => ToolbarLayoutLimit_2,
    (value) => {
      ToolbarLayoutLimit_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "updateToolbarPinnedWords",
    () => updateToolbarPinnedWords,
  );
  bindRuntimeValue(runtime, "toolbarDensity", () => toolbarDensity);
  bindRuntimeValue(
    runtime,
    "useToolbarOverlaySize",
    () => useToolbarOverlaySize,
  );
  bindRuntimeValue(runtime, "toolbarOverlayHeight", () => toolbarOverlayHeight);
  bindRuntimeValue(runtime, "ToolbarDivider", () => ToolbarDivider);
  return () => {
    jsxToolbarLayout = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    ToolbarLayoutLimit = 1e3;
    ToolbarLayoutConstant = 896;
    ToolbarLayoutConstant_2 = 1072;
    ToolbarLayoutLabel =
      "[hidden], [aria-hidden='true'], [data-quiet], [data-tb-paddle], [data-tb-fade], .tb-divider";
    ToolbarLayoutLabel_2 =
      "button, input, select, textarea, a[href], img, svg, video, canvas, [data-cds]:not([data-cds='Surface']), [data-tb-status], [data-tb-shows]";
    ToolbarLayoutPresentationNoneGroupSet = new Set([
      "presentation",
      "none",
      "group",
      "toolbar",
      "separator",
      "region",
    ]);
    ToolbarLayoutMatches = (input?: Dynamic): Dynamic =>
      input.matches(".tb-sync-dot, [data-tb-save]");
    ToolbarLayoutHasAttribute = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
    ): Dynamic => {
      context !== input.hasAttribute(options) &&
        input.toggleAttribute(options, context);
    };
    ToolbarLayoutLimit_2 = 48;
  };
}
