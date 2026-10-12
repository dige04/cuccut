/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformDocumentTheme(
  runtime: RuntimeBindings,
): () => void {
  var cdsRootClassName: Dynamic;
  var defaultDensity: Dynamic;
  var cdsRootAttributes: Dynamic;
  var automaticColorModeScript: Dynamic;
  var explicitColorModeAttribute: Dynamic;
  function buildColorModeScript(input?: Dynamic): Dynamic {
    return input === undefined
      ? automaticColorModeScript
      : "(function(){var h=document.documentElement;h.setAttribute('data-mode','" +
          input +
          "');h.setAttribute('" +
          explicitColorModeAttribute +
          "','" +
          input +
          "')})();";
  }
  function applyDocumentCdsTheme(doc?: Dynamic): Dynamic {
    let documentElement: Dynamic = doc.documentElement;
    documentElement.classList.add(cdsRootClassName);
    documentElement.hasAttribute("data-density") ||
      documentElement.setAttribute("data-density", defaultDensity);
    let attribute: Dynamic = documentElement.getAttribute(
      explicitColorModeAttribute,
    );
    if (attribute === "light" || attribute === "dark") {
      documentElement.setAttribute("data-mode", attribute);
      return (): Dynamic => {};
    }
    let callback: Dynamic = (): Dynamic => {
      let attribute2: Dynamic = documentElement.getAttribute("data-theme");
      attribute2 === "light" || attribute2 === "dark"
        ? documentElement.setAttribute("data-mode", attribute2)
        : documentElement.removeAttribute("data-mode");
    };
    callback();
    let value: Dynamic = doc.defaultView?.MutationObserver;
    if (value === undefined) return (): Dynamic => {};
    let value2: Dynamic = new value(callback);
    value2.observe(documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return (): Dynamic => value2.disconnect();
  }
  bindRuntimeValue(
    runtime,
    "cdsRootClassName",
    () => cdsRootClassName,
    (value) => {
      cdsRootClassName = value;
    },
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
    "cdsRootAttributes",
    () => cdsRootAttributes,
    (value) => {
      cdsRootAttributes = value;
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
    "explicitColorModeAttribute",
    () => explicitColorModeAttribute,
    (value) => {
      explicitColorModeAttribute = value;
    },
  );
  bindRuntimeValue(runtime, "buildColorModeScript", () => buildColorModeScript);
  bindRuntimeValue(
    runtime,
    "applyDocumentCdsTheme",
    () => applyDocumentCdsTheme,
  );
  return () => {
    cdsRootClassName = "cds-root";
    defaultDensity = "comfortable";
    cdsRootAttributes = `class="${cdsRootClassName}" data-density="${defaultDensity}"`;
    automaticColorModeScript =
      "(function(){var h=document.documentElement;function s(){var t=h.getAttribute('data-theme');if(t==='light'||t==='dark'){h.setAttribute('data-mode',t)}else{h.removeAttribute('data-mode')}}s();if(typeof MutationObserver==='function'){new MutationObserver(s).observe(h,{attributes:true,attributeFilter:['data-theme']})}})();";
    explicitColorModeAttribute = "data-mode-pin";
  };
}
