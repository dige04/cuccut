/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasKeyboardFocus(
  runtime: RuntimeBindings,
): () => void {
  var react_LB: Dynamic;
  var canvasFocusableSelector: Dynamic;
  function isRenderedFocusableTarget(
    element: Dynamic,
    { rendered: rendered, topmostAt: topmostAt }: Dynamic,
    scope?: Dynamic,
  ): Dynamic {
    if (
      !element.matches(canvasFocusableSelector) ||
      element.closest('[inert], [hidden], [aria-hidden="true"]') != null ||
      !rendered(element)
    )
      return false;
    if (scope == null) return true;
    let bounds: Dynamic = element.getBoundingClientRect(),
      value: Dynamic = Math.max(bounds.left, scope.left),
      value2: Dynamic = Math.min(bounds.right, scope.right),
      value3: Dynamic = Math.max(bounds.top, scope.top),
      value4: Dynamic = Math.min(bounds.bottom, scope.bottom);
    if (value >= value2 || value3 >= value4) return false;
    let value5: Dynamic = topmostAt(
      (value + value2) / 2,
      (value3 + value4) / 2,
    );
    return value5 == null || element.contains(value5);
  }
  function createCanvasKeyboardFocusController(
    getRoot?: Dynamic,
    {
      blocked: options = runtime.hasBlockingEditorOverlay,
      rendered: options2 = (input?: Dynamic): Dynamic =>
        input.getClientRects().length > 0,
      topmostAt: options3 = (input?: Dynamic, options4?: Dynamic): Dynamic =>
        (document as Dynamic).elementFromPoint(input, options4),
    }: Dynamic = {},
  ): Dynamic {
    let state: Dynamic = {
        rendered: options2,
        topmostAt: options3,
      },
      cache: Dynamic = new WeakMap(),
      callback: Dynamic = (): Dynamic =>
        getRoot().flatMap((input?: Dynamic): Dynamic => {
          let value: Dynamic = input.el();
          return value && value.isConnected
            ? [
                {
                  region: input,
                  el: value,
                },
              ]
            : [];
        }),
      callback2: Dynamic = (input?: Dynamic, options4?: Dynamic): Dynamic => {
        if (!(options4 instanceof HTMLElement)) return -1;
        let value: Dynamic = -1;
        input.forEach((input2?: Dynamic, options5?: Dynamic): Dynamic => {
          input2.el.contains(options4) &&
            (value === -1 || input[value].el.contains(input2.el)) &&
            (value = options5);
        });
        return value;
      },
      callback3: Dynamic = (input?: Dynamic): Dynamic =>
        callback2(input, (document as Dynamic).activeElement),
      callback4: Dynamic = (input?: Dynamic, options4?: Dynamic): Dynamic => {
        let value: Dynamic = input.filter(
            (input2?: Dynamic): Dynamic =>
              input2 !== options4 && options4.el.contains(input2.el),
          ),
          value2: Dynamic = options4.region.anchor?.() ?? null;
        if (
          value2 &&
          value2.isConnected &&
          options4.el.contains(value2) &&
          !value.some(
            (input2?: Dynamic): Dynamic => input2.el.contains(value2),
          ) &&
          (value2.focus({
            preventScroll: true,
          }),
          (document as Dynamic).activeElement === value2)
        )
          return true;
        let entry: Dynamic = cache.get(options4.el),
          items: Dynamic = [
            entry && entry.isConnected && options4.el.contains(entry)
              ? entry
              : null,
            options4.region.fallback?.() ?? null,
            ...options4.el.querySelectorAll(canvasFocusableSelector),
          ],
          value3: Dynamic = options4.region.clipTo?.() ?? null,
          value4: Dynamic = value3 ? value3.getBoundingClientRect() : null;
        for (let value5 of items as Dynamic)
          if (
            !(
              !value5 ||
              value.some(
                (input2?: Dynamic): Dynamic => input2.el.contains(value5),
              ) ||
              !isRenderedFocusableTarget(value5, state, value4)
            ) &&
            (value5.focus({
              preventScroll: value3 !== null,
            }),
            (document as Dynamic).activeElement === value5)
          )
            return true;
        return false;
      },
      callback5: Dynamic = (input?: Dynamic): Dynamic => {
        if (options()) return;
        let value: Dynamic = callback(),
          length: Dynamic = value.length;
        if (length === 0) return;
        let value2: Dynamic = callback3(value),
          value3: Dynamic =
            value2 !== -1
              ? value2
              : value.findIndex(
                  (input2?: Dynamic): Dynamic => input2.region.home,
                );
        for (let count: Dynamic = 1; count <= length; count++) {
          let value4: Dynamic =
            (((value3 + input * count) % length) + length) % length;
          if (value4 !== value2 && callback4(value, value[value4])) return;
        }
      },
      callback6: Dynamic = (event?: Dynamic): Dynamic => {
        let value: Dynamic = callback(),
          value2: Dynamic = callback2(
            value,
            event.target instanceof Element ? event.target : null,
          );
        value2 !== -1 && cache.set(value[value2].el, event.target);
      },
      flag: Dynamic = false,
      callback7: Dynamic = (
        input: Dynamic = (document as Dynamic).activeElement,
      ): Dynamic => {
        flag = true;
        let value: Dynamic = callback(),
          value2: Dynamic = value.find(
            (input2?: Dynamic): Dynamic => input2.region.home,
          );
        (!value2 || !callback4(value, value2)) &&
          input instanceof HTMLElement &&
          input.blur();
      },
      callback8: Dynamic = (input?: Dynamic): Dynamic => {
        input.key === "Escape" && (flag = false);
      },
      callback9: Dynamic = (event?: Dynamic): Dynamic => {
        if (event.key !== "Escape") return;
        if (event.repeat && flag) {
          event.preventDefault();
          return;
        }
        flag = false;
        if (
          event.defaultPrevented ||
          event.altKey ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          options()
        )
          return;
        let target: Dynamic = event.target;
        if (
          !(target instanceof HTMLElement) ||
          (0, runtime.isEditingInputTarget)(target) ||
          target.getAttribute("aria-expanded") === "true"
        )
          return;
        let value: Dynamic = callback(),
          value2: Dynamic = callback3(value);
        value2 === -1 ||
          !value[value2].region.escapeHome ||
          (event.preventDefault(), callback7(target));
      },
      callback10: Dynamic = (event?: Dynamic): Dynamic => {
        event.key !== "F6" ||
          event.defaultPrevented ||
          event.isComposing ||
          event.altKey ||
          options() ||
          (event.preventDefault(),
          event.repeat || callback5(event.shiftKey ? -1 : 1));
      },
      callback11: Dynamic = (input?: Dynamic): Dynamic =>
        callback5(input.detail.reverse ? -1 : 1);
    (document as Dynamic).addEventListener("focusin", callback6);
    (window as Dynamic).addEventListener("keydown", callback10, true);
    (window as Dynamic).addEventListener("keydown", callback9, true);
    (window as Dynamic).addEventListener("keyup", callback8, true);
    (window as Dynamic).addEventListener("focus-region-key", callback11);
    return {
      move: callback5,
      goHome: callback7,
      dispose(): Dynamic {
        (document as Dynamic).removeEventListener("focusin", callback6);
        (window as Dynamic).removeEventListener("keydown", callback10, true);
        (window as Dynamic).removeEventListener("keydown", callback9, true);
        (window as Dynamic).removeEventListener("keyup", callback8, true);
        (window as Dynamic).removeEventListener("focus-region-key", callback11);
      },
    };
  }
  function useCanvasKeyboardFocus(root?: Dynamic, blocked?: Dynamic): Dynamic {
    let value: Dynamic = (0, react_LB.useRef)(root);
    value.current = root;
    let value2: Dynamic = (0, react_LB.useRef)(blocked);
    value2.current = blocked;
    let value3: Dynamic = (0, react_LB.useRef)({
      goHome: (): Dynamic => {},
    });
    (0, react_LB.useEffect)((): Dynamic => {
      let value4: Dynamic = createCanvasKeyboardFocusController(
        (): Dynamic => value.current,
        {
          blocked: (): Dynamic =>
            (0, runtime.hasBlockingEditorOverlay)() ||
            (value2.current?.() ?? false),
        },
      );
      value3.current.goHome = (): Dynamic => value4.goHome();
      return value4.dispose;
    }, []);
    return value3.current;
  }
  bindRuntimeValue(
    runtime,
    "react_LB",
    () => react_LB,
    (value) => {
      react_LB = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "canvasFocusableSelector",
    () => canvasFocusableSelector,
    (value) => {
      canvasFocusableSelector = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isRenderedFocusableTarget",
    () => isRenderedFocusableTarget,
  );
  bindRuntimeValue(
    runtime,
    "createCanvasKeyboardFocusController",
    () => createCanvasKeyboardFocusController,
  );
  bindRuntimeValue(
    runtime,
    "useCanvasKeyboardFocus",
    () => useCanvasKeyboardFocus,
  );
  return () => {
    (0, runtime.initializeInspectorContext)();
    react_LB = (0, runtime.toModuleNamespace)((0, runtime.load_react)(), 1);
    canvasFocusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  };
}
