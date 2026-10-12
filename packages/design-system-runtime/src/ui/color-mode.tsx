import type * as React from "react";
import type * as Color from "../contracts/color-controls";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiColorMode(runtime: RuntimeBindings): () => void {
  var jsxColorModePrimitives: typeof import("react/jsx-runtime");
  var reactColorMode: typeof import("react");
  var reactDomColorMode: typeof import("react-dom");
  var jsxColorMode: typeof import("react/jsx-runtime");
  var APP_DENSITY: import("../contracts/controls").Density;
  var rootHtmlAttributes: string;
  var automaticColorModeScript: string;
  function colorModeBootstrapScript(mode?: "light" | "dark"): string {
    if (mode === undefined) {
      return automaticColorModeScript;
    } else {
      return (
        "(function(){var h=document.documentElement;h.setAttribute('data-mode','" +
        mode +
        "');h.setAttribute('data-mode-pin','" +
        mode +
        "')})();"
      );
    }
  }
  function initializeDocumentColorMode(document2: Document): () => void {
    let documentElement = document2.documentElement;
    documentElement.classList.add("cds-root");
    if (!documentElement.hasAttribute("data-density")) {
      documentElement.setAttribute("data-density", "comfortable");
    }
    let attribute = documentElement.getAttribute("data-mode-pin");
    if (attribute === "light" || attribute === "dark") {
      documentElement.setAttribute("data-mode", attribute);
      return () => {};
    }
    let callback = () => {
      let attribute2 = documentElement.getAttribute("data-theme");
      if (attribute2 === "light" || attribute2 === "dark") {
        documentElement.setAttribute("data-mode", attribute2);
      } else {
        documentElement.removeAttribute("data-mode");
      }
    };
    callback();
    let value = (document2.defaultView as (Window & typeof globalThis) | null)
      ?.MutationObserver;
    if (value === undefined) {
      return () => {};
    }
    let value2 = new value(callback);
    value2.observe(documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => value2.disconnect();
  }
  bindRuntimeValue(
    runtime,
    "jsxColorModePrimitives",
    () => jsxColorModePrimitives,
    (value) => {
      jsxColorModePrimitives = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactColorMode",
    () => reactColorMode,
    (value) => {
      reactColorMode = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactDomColorMode",
    () => reactDomColorMode,
    (value) => {
      reactDomColorMode = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxColorMode",
    () => jsxColorMode,
    (value) => {
      jsxColorMode = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "APP_DENSITY",
    () => APP_DENSITY,
    (value) => {
      APP_DENSITY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "rootHtmlAttributes",
    () => rootHtmlAttributes,
    (value) => {
      rootHtmlAttributes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "automaticColorModeScript",
    () => automaticColorModeScript,
    (value) => {
      automaticColorModeScript = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "colorModeBootstrapScript",
    () => colorModeBootstrapScript,
  );
  bindRuntimeValue(
    runtime,
    "initializeDocumentColorMode",
    () => initializeDocumentColorMode,
  );
  return () => {
    jsxColorModePrimitives = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    reactColorMode = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    reactDomColorMode = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactDomNamespace)(),
      1,
    );
    jsxColorMode = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    APP_DENSITY = "comfortable";
    rootHtmlAttributes = 'class="cds-root" data-density="comfortable"';
    automaticColorModeScript =
      "(function(){var h=document.documentElement;function s(){var t=h.getAttribute('data-theme');if(t==='light'||t==='dark'){h.setAttribute('data-mode',t)}else{h.removeAttribute('data-mode')}}s();if(typeof MutationObserver==='function'){new MutationObserver(s).observe(h,{attributes:true,attributeFilter:['data-theme']})}})();";
  };
}
