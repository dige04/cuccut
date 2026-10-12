/**
 * Reconstructed helmet subsystem of the Design Component runtime.
 * Source declarations: dc-runtime.js offsets 176976..180830.
 * Semantic names are inferred from the shipped behavior; see runtime-map.json.
 */
import { findResourceBlob } from "./resources";
import type {
  RuntimeValue,
  Keyframe,
  PropsMetadata,
  ParsedDesignComponent,
  ComponentRegistry,
  StreamingTracker,
  RenderValues,
  TemplateContext,
  CompiledTemplate,
  DesignRuntime,
  RuntimeOptions,
} from "./types";
export var ATOMIC_CSS =
    ".fx{display:flex}.col{display:flex;flex-direction:column}.grid{display:grid}.ac{align-items:center}.jc{justify-content:center}.jb{justify-content:space-between}.f1{flex:1}.noshrink{flex-shrink:0}.wrap{flex-wrap:wrap}.fw5{font-weight:500}.fw6{font-weight:600}.fw7{font-weight:700}.fw8{font-weight:800}.fs11{font-size:11px}.fs12{font-size:12px}.fs13{font-size:13px}.fs14{font-size:14px}.fs15{font-size:15px}.fs16{font-size:16px}.fs20{font-size:20px}.fs22{font-size:22px}.upper{text-transform:uppercase}.tc{text-align:center}.nowrap{white-space:nowrap}.gap8{gap:8px}.gap10{gap:10px}.gap12{gap:12px}.gap16{gap:16px}.gap24{gap:24px}.m0{margin:0}.mt8{margin-top:8px}.mt12{margin-top:12px}.mt16{margin-top:16px}.mb8{margin-bottom:8px}.mb12{margin-bottom:12px}.mb16{margin-bottom:16px}.posrel{position:relative}.posabs{position:absolute}.round{border-radius:50%}.ohide{overflow:hidden}.bbox{box-sizing:border-box}.pointer{cursor:pointer}.w100{width:100%}.b0{border:none}",
  DESIGN_MODE_META_PATTERN =
    /<meta\b[^>]*\bname\s*=\s*["']design_doc_mode["'][^>]*\b(?:content|value)\s*=\s*["'](\w+)["']/i,
  LIGHT_BACKGROUND = "#ededeb",
  DARK_BACKGROUND = "#171717",
  OMELETTE_LIGHT_BACKGROUND = "#f0eee6",
  OMELETTE_DARK_BACKGROUND = "#2e2c26";
export function createHelmetManager(
  documentNode?: RuntimeValue,
  isHtmlStreaming?: RuntimeValue,
  options: RuntimeValue = {},
): RuntimeValue {
  const installedResources: RuntimeValue = new Set(),
    headElements: RuntimeValue = new Map();
  let designMode: RuntimeValue = null,
    canvasStyle: RuntimeValue = null,
    theme = "light";
  try {
    const documentTheme: RuntimeValue = documentNode.documentElement.dataset.theme;
    theme =
      documentTheme === "dark" || documentTheme === "light"
        ? documentTheme
        : new URLSearchParams(documentNode.defaultView?.location.search ?? "").get("theme") ===
            "dark"
          ? "dark"
          : "light";
  } catch {}
  function updateCanvasTheme(): RuntimeValue {
    if (!canvasStyle) return;
    const background: RuntimeValue = options.omelette
      ? theme === "dark"
        ? OMELETTE_DARK_BACKGROUND
        : OMELETTE_LIGHT_BACKGROUND
      : theme === "dark"
        ? DARK_BACKGROUND
        : LIGHT_BACKGROUND;
    canvasStyle.textContent = `html,body{background:${background}}#dc-root>.sc-host{position:relative}`;
  }
  function notifyDesignMode(mode?: RuntimeValue): RuntimeValue {
    if (window.parent !== window)
      try {
        window.parent.postMessage(
          {
            type: "__dc_design_mode",
            mode: mode,
          },
          "*",
        );
      } catch {}
  }
  function setDesignDocMode(mode?: RuntimeValue): RuntimeValue {
    mode !== designMode &&
      ((designMode = mode),
      notifyDesignMode(mode),
      mode === "canvas"
        ? (documentNode.documentElement.setAttribute("data-dc-canvas", ""),
          (canvasStyle = documentNode.createElement("style")),
          canvasStyle.setAttribute("data-dc-canvas", ""),
          updateCanvasTheme(),
          documentNode.head.appendChild(canvasStyle))
        : (documentNode.documentElement.removeAttribute("data-dc-canvas"),
          canvasStyle?.remove(),
          (canvasStyle = null)));
  }
  window.addEventListener("message", (event?: RuntimeValue): RuntimeValue => {
    const type: RuntimeValue = event.data && event.data.type;
    if (type === "__dc_theme") {
      const messageTheme: RuntimeValue = event.data.theme;
      (messageTheme === "light" || messageTheme === "dark") &&
        ((theme = messageTheme), updateCanvasTheme());
      return;
    }
    !designMode || type !== "__dc_probe" || notifyDesignMode(designMode);
  });
  function compile(element?: RuntimeValue): RuntimeValue {
    const children: RuntimeValue = [...element.children],
      hasFollowingContent: RuntimeValue =
        element.nextSibling != null || element.parentNode?.nextSibling != null;
    if (element.hasAttribute("data-dc-atomics") && !installedResources.has("__dc-atomics")) {
      installedResources.add("__dc-atomics");
      const atomicStyle: RuntimeValue = documentNode.createElement("style");
      atomicStyle.id = "__dc-atomics";
      atomicStyle.textContent = ATOMIC_CSS;
      documentNode.head.appendChild(atomicStyle);
    }
    return (values?: RuntimeValue, host?: RuntimeValue): RuntimeValue => {
      const name: RuntimeValue = (host && host.__name) || "",
        isStreaming: RuntimeValue = !!(name && isHtmlStreaming(name));
      for (let index = 0; index < children.length; index++) {
        const child: RuntimeValue = children[index],
          tagName: RuntimeValue = child.tagName,
          isIncompleteTail: RuntimeValue =
            isStreaming && !hasFollowingContent && index === children.length - 1;
        if (tagName === "SCRIPT") {
          if (isIncompleteTail) continue;
          const scriptKey: RuntimeValue =
            "SCRIPT|" + (child.getAttribute("src") || child.textContent || "");
          if (installedResources.has(scriptKey)) continue;
          installedResources.add(scriptKey);
          const scriptElement: RuntimeValue = documentNode.createElement("script");
          for (const { name: attributeName, value: attributeValue } of [...child.attributes])
            scriptElement.setAttribute(attributeName, attributeValue);
          child.textContent && (scriptElement.textContent = child.textContent);
          documentNode.head.appendChild(scriptElement);
        } else if (tagName === "LINK" || tagName === "META") {
          if (isIncompleteTail) continue;
          const resourceKey: RuntimeValue =
            tagName +
            "|" +
            (child.getAttribute("href") || child.getAttribute("src") || child.outerHTML);
          if (installedResources.has(resourceKey)) continue;
          if ((installedResources.add(resourceKey), tagName === "LINK")) {
            const relationships: RuntimeValue = (child.getAttribute("rel") || "")
                .toLowerCase()
                .split(/\s+/),
              href: RuntimeValue = (child.getAttribute("href") || "").trim(),
              resources: RuntimeValue = window.__resources,
              mappedUrl: RuntimeValue =
                resources &&
                relationships.includes("stylesheet") &&
                !relationships.includes("alternate")
                  ? resources[href]
                  : undefined,
              stylesheetBlob: RuntimeValue =
                typeof mappedUrl == "string" && mappedUrl ? findResourceBlob(mappedUrl) : null;
            if (stylesheetBlob) {
              const stylesheetElement: RuntimeValue = documentNode.createElement("style");
              child.hasAttribute("disabled")
                ? stylesheetElement.setAttribute("media", "not all")
                : child.getAttribute("media") &&
                  stylesheetElement.setAttribute("media", child.getAttribute("media"));
              child.getAttribute("title") &&
                stylesheetElement.setAttribute("title", child.getAttribute("title"));
              stylesheetBlob.text().then((css?: RuntimeValue): RuntimeValue => {
                stylesheetElement.textContent = css;
              });
              documentNode.head.appendChild(stylesheetElement);
              continue;
            }
          }
          documentNode.head.appendChild(child.cloneNode(true));
        } else {
          const elementKey: RuntimeValue = name + "|" + index;
          let headElement: RuntimeValue = headElements.get(elementKey);
          (!headElement || headElement.tagName !== tagName) &&
            (headElement && headElement.remove(),
            (headElement = documentNode.createElement(tagName.toLowerCase())),
            headElements.set(elementKey, headElement),
            documentNode.head.appendChild(headElement));
          for (const { name: attributeName, value: attributeValue } of [...child.attributes])
            headElement.getAttribute(attributeName) !== attributeValue &&
              headElement.setAttribute(attributeName, attributeValue);
          headElement.textContent !== child.textContent &&
            (headElement.textContent = child.textContent);
        }
      }
      return null;
    };
  }
  return {
    compile: compile,
    setDesignDocMode: setDesignDocMode,
  };
}
