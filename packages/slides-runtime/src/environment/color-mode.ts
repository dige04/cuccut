/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

declare module "../bindings" {
  interface RuntimeBindings {
    colorModeBootstrapScript: (mode?: string) => string;
    initializeDocumentColorMode: (document: Document) => () => void;
    defaultDensity: string;
    rootHtmlAttributes: string;
    automaticColorModeScript: string;
    pinnedColorModeAttribute: string;
  }
}

export function installEnvironmentColorMode(runtime: RuntimeBindings): () => void {
  var defaultDensity: string;
  var rootHtmlAttributes: string;
  var automaticColorModeScript: string;
  var pinnedColorModeAttribute: string;
  function colorModeBootstrapScript(mode?: string) {
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
  function initializeDocumentColorMode(document2: Document) {
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
    let value = document2.defaultView?.MutationObserver;
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
    "colorModeBootstrapScript",
    () => colorModeBootstrapScript,
  );
  bindRuntimeValue(
    runtime,
    "initializeDocumentColorMode",
    () => initializeDocumentColorMode,
  );
  bindRuntimeValue(
    runtime,
    "defaultDensity",
    () => defaultDensity,
    (value) => {
      defaultDensity = value;
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
    "pinnedColorModeAttribute",
    () => pinnedColorModeAttribute,
    (value) => {
      pinnedColorModeAttribute = value;
    },
  );
  return () => {
    defaultDensity = "comfortable";
    rootHtmlAttributes = 'class="cds-root" data-density="comfortable"';
    automaticColorModeScript =
      "(function(){var h=document.documentElement;function s(){var t=h.getAttribute('data-theme');if(t==='light'||t==='dark'){h.setAttribute('data-mode',t)}else{h.removeAttribute('data-mode')}}s();if(typeof MutationObserver==='function'){new MutationObserver(s).observe(h,{attributes:true,attributeFilter:['data-theme']})}})();";
    pinnedColorModeAttribute = "data-mode-pin";
  };
}
