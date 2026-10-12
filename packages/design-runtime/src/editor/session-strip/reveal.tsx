/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorSessionStripReveal(
  runtime: RuntimeBindings,
): () => void {
  var SessionStripRevealConstant: Dynamic;
  var reactSessionStripReveal: Dynamic;
  var jsxSessionStripReveal: Dynamic;
  var reactSessionStripReveal_2: Dynamic;
  var jsxSessionStripReveal_2: Dynamic;
  function getSessionStripScrollRow(element?: Dynamic): Dynamic {
    return element.querySelector("[data-mc-row]") ?? element;
  }
  function revealSessionStripControl(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = getSessionStripScrollRow(input),
      bounds: Dynamic = options.getBoundingClientRect(),
      bounds2: Dynamic = value.getBoundingClientRect();
    bounds.left < bounds2.left + SessionStripRevealConstant
      ? (value.scrollLeft -=
          bounds2.left + SessionStripRevealConstant - bounds.left)
      : bounds.right > bounds2.right - SessionStripRevealConstant &&
        (value.scrollLeft +=
          bounds.right - (bounds2.right - SessionStripRevealConstant));
  }
  bindRuntimeValue(
    runtime,
    "getSessionStripScrollRow",
    () => getSessionStripScrollRow,
  );
  bindRuntimeValue(
    runtime,
    "SessionStripRevealConstant",
    () => SessionStripRevealConstant,
    (value) => {
      SessionStripRevealConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "revealSessionStripControl",
    () => revealSessionStripControl,
  );
  bindRuntimeValue(
    runtime,
    "reactSessionStripReveal",
    () => reactSessionStripReveal,
    (value) => {
      reactSessionStripReveal = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxSessionStripReveal",
    () => jsxSessionStripReveal,
    (value) => {
      jsxSessionStripReveal = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactSessionStripReveal_2",
    () => reactSessionStripReveal_2,
    (value) => {
      reactSessionStripReveal_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxSessionStripReveal_2",
    () => jsxSessionStripReveal_2,
    (value) => {
      jsxSessionStripReveal_2 = value;
    },
  );
  return () => {
    SessionStripRevealConstant = 48;
    reactSessionStripReveal = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    jsxSessionStripReveal = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    reactSessionStripReveal_2 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    jsxSessionStripReveal_2 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
  };
}
