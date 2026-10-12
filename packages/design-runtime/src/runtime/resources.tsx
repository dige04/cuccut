/**
 * Reconstructed resources subsystem of the Design Component runtime.
 * Source declarations: dc-runtime.js offsets 172959..176976.
 * Semantic names are inferred from the shipped behavior; see runtime-map.json.
 */
import { getReact } from "./react";
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
export function findResourceBlob(url: string): Blob | null {
  const blobs: RuntimeValue = window.__resourceBlobs,
    blob: RuntimeValue = blobs ? blobs[url.split("#")[0]!] : undefined;
  return blob instanceof Blob ? blob : null;
}
export var REACT_CDN_URL = "https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js",
  REACT_CDN_INTEGRITY = "sha384-DGyLxAyjq0f9SPpVevD6IgztCFlnMF6oW/XQGmfe+IsZ8TqEiDrcHkMLKI6fiB/Z",
  REACT_DOM_CDN_URL =
    "https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js",
  REACT_DOM_CDN_INTEGRITY =
    "sha384-gTGxhz21lVGYNMcdJOyq01Edg0jhn/c22nsx0kyqP0TxaV5WVdsSH1fSDUf5YJj1",
  BABEL_CDN_URL = "https://cdn.jsdelivr.net/npm/@babel/standalone@7.29.0/babel.min.js",
  BABEL_CDN_INTEGRITY = "sha384-m08KidiNqLdpJqLq95G/LEi8Qvjl/xUYll3QILypMoQ65QorJ9Lvtp2RXYGBFj1y";
export function resolveScriptResource(url?: RuntimeValue, integrity?: RuntimeValue): RuntimeValue {
  const resources: RuntimeValue = window.__resources,
    mapped: RuntimeValue = resources ? resources[url] : undefined;
  return typeof mapped == "string" && mapped
    ? {
        src: mapped,
      }
    : {
        src: url,
        integrity: integrity,
      };
}
export var isCustomElementName: RuntimeValue = (tagName?: RuntimeValue): RuntimeValue =>
  !tagName.includes(".") && tagName.includes("-");
export function isReactComponent(value?: RuntimeValue): RuntimeValue {
  return typeof value == "function"
    ? !isCustomElementConstructor(value)
    : typeof value == "object" && value !== null && typeof value.$$typeof == "symbol";
}
export function lookupGlobalPath(root?: RuntimeValue, propertyPath?: RuntimeValue): RuntimeValue {
  let value: RuntimeValue = root;
  for (const segment of propertyPath.split(".")) {
    if (value == null) return;
    value = value[segment];
  }
  return value;
}
export var GLOBAL_POLL_INTERVAL = 50,
  GLOBAL_POLL_TIMEOUT = 3e4;
export function createExternalModuleLoader(onChange?: RuntimeValue): RuntimeValue {
  const modules: RuntimeValue = new Map();
  let babelPromise: RuntimeValue = null;
  const errors: RuntimeValue = new Map(),
    pollingGlobals: RuntimeValue = new Set();
  /**
   * CucCut: restored from the shipped dc-runtime. The reconstruction bundled `@babel/standalone` into support.js and
   * dc-runtime.js (about 3 MB in every exported artboard); the original loads it only when a JSX x-import needs it,
   * from the CDN URL or the copy mapped in `window.__resources`. The editor preview maps it to the editor's own
   * `artifact-type/babel.min.js` and the whole-design HTML export embeds it once (docs/design/canvas §3, §8.3).
   */
  function ensureBabel(): RuntimeValue {
    if (window.Babel) return Promise.resolve();
    if (babelPromise) return babelPromise;
    const resource: RuntimeValue = resolveScriptResource(BABEL_CDN_URL, BABEL_CDN_INTEGRITY);
    return (babelPromise = new Promise<void>((resolve, reject) => {
      const scriptElement: RuntimeValue = document.createElement("script");
      scriptElement.src = resource.src;
      if (resource.integrity) {
        scriptElement.integrity = resource.integrity;
        scriptElement.crossOrigin = "anonymous";
      }
      scriptElement.onload = (): RuntimeValue => resolve();
      scriptElement.onerror = reject;
      document.head.appendChild(scriptElement);
    }));
  }
  const loadPromises: RuntimeValue = new Map();
  function load(
    kind?: RuntimeValue,
    url?: RuntimeValue,
    previousLoad?: RuntimeValue,
  ): RuntimeValue {
    const existing: RuntimeValue = loadPromises.get(url);
    if (existing) return existing;
    modules.set(url, null);
    console.info("[dc-runtime] x-import: loading", url, "(" + kind + ")");
    const loadPromise: RuntimeValue = Promise.all([
      kind === "jsx" ? ensureBabel() : Promise.resolve(),
      previousLoad ?? Promise.resolve(),
    ])
      .then((): RuntimeValue => {
        const blob: RuntimeValue = findResourceBlob(url);
        return blob
          ? blob.text()
          : fetch(url).then((response?: RuntimeValue): RuntimeValue => {
              if (!response.ok) throw new Error("HTTP " + response.status);
              return response.text();
            });
      })
      .then((source?: RuntimeValue): RuntimeValue => {
        const javascript: RuntimeValue =
            kind === "jsx"
              ? window.Babel.transform(source, {
                  filename: url,
                  presets: ["react", "typescript"],
                }).code
              : source,
          module: RuntimeValue = {
            exports: {},
          },
          previousGlobals: RuntimeValue = new Set(Object.keys(window));
        new Function("React", "module", "exports", "require", javascript)(
          getReact(),
          module,
          module.exports,
          (): RuntimeValue => ({}),
        );
        const globals: RuntimeValue = {};
        for (const name of Object.keys(window))
          !previousGlobals.has(name) &&
            typeof window[name] == "function" &&
            (globals[name] = window[name]);
        modules.set(url, {
          mod: module.exports,
          globals: globals,
        });
        console.info(
          "[dc-runtime] x-import: loaded",
          url,
          "\u2014 exports:",
          Object.keys(module.exports),
          "window globals:",
          Object.keys(globals),
        );
        onChange();
      })
      .catch((error?: RuntimeValue): RuntimeValue => {
        modules.set(url, {
          mod: {},
          globals: {},
          error:
            "failed to load: " +
            (error instanceof Error && error.message ? error.message : String(error)),
        });
        console.error("[dc-runtime] x-import: FAILED to load", url, "(" + kind + ")", error);
        onChange();
      });
    loadPromises.set(url, loadPromise);
    return loadPromise;
  }
  function resolve(url?: RuntimeValue, name?: RuntimeValue): RuntimeValue {
    const entry: RuntimeValue = modules.get(url);
    if (!entry) return null;
    const { mod: exports, globals: globals } = entry,
      Component: RuntimeValue =
        (exports && exports[name]) ||
        (globals && globals[name]) ||
        (typeof window < "u" && window[name]) ||
        (exports && exports.default);
    if (typeof Component == "function") return Component;
    const errorKey: RuntimeValue = url + "\0" + name;
    errors.has(errorKey) ||
      (errors.set(
        errorKey,
        entry.error ||
          'no export named "' + name + '" (has: ' + Object.keys(exports).join(", ") + ")",
      ),
      console.error(
        "[dc-runtime] x-import: module",
        url,
        "loaded but has no component named",
        JSON.stringify(name),
        "\u2014 available exports:",
        Object.keys(exports),
        "window globals:",
        Object.keys(globals),
        ". The module must `module.exports = {" + name + "}` or set `window." + name + "`.",
      ));
    return null;
  }
  function pollGlobal(name?: RuntimeValue): RuntimeValue {
    if (pollingGlobals.has(name)) return;
    pollingGlobals.add(name);
    const startedAt: RuntimeValue = Date.now(),
      isCustomElement: RuntimeValue = isCustomElementName(name),
      poll: RuntimeValue = (): RuntimeValue => {
        if (
          isCustomElement
            ? customElements.get(name)
            : isReactComponent(lookupGlobalPath(window, name))
        ) {
          pollingGlobals.delete(name);
          onChange();
          return;
        }
        if (Date.now() - startedAt >= GLOBAL_POLL_TIMEOUT) {
          console.warn(
            "[dc-runtime] x-import: global",
            JSON.stringify(name),
            "never appeared on window after " + GLOBAL_POLL_TIMEOUT + "ms",
          );
          return;
        }
        setTimeout(poll, GLOBAL_POLL_INTERVAL);
      };
    setTimeout(poll, GLOBAL_POLL_INTERVAL);
  }
  function resolveGlobal(url?: RuntimeValue, name?: RuntimeValue): RuntimeValue {
    const isCustomElement: RuntimeValue = isCustomElementName(name);
    if (!url) {
      if (isCustomElement) return customElements.get(name) ? name : (pollGlobal(name), null);
      const globalValue: RuntimeValue = lookupGlobalPath(window, name);
      return isReactComponent(globalValue) ? globalValue : (pollGlobal(name), null);
    }
    const entry: RuntimeValue = modules.get(url);
    if (!entry) return null;
    if (isCustomElement && customElements.get(name)) return name;
    const Component: RuntimeValue = entry.globals[name] ?? lookupGlobalPath(window, name);
    if (isReactComponent(Component)) return Component;
    if (name.includes(".")) return null;
    const warningKey: RuntimeValue = url + "\0global\0" + name;
    errors.has(warningKey) ||
      (errors.set(warningKey, null),
      isCustomElement &&
        !customElements.get(name) &&
        console.warn(
          "[dc-runtime] x-import:",
          url,
          "loaded but no custom element",
          JSON.stringify(name),
          "is registered and window." +
            name +
            " is not a function \u2014 rendering <" +
            name +
            "> as an unknown element.",
        ));
    return name;
  }
  function getError(url?: RuntimeValue, name?: RuntimeValue): RuntimeValue {
    const entry: RuntimeValue = modules.get(url);
    return entry?.error ? entry.error : errors.get(url + "\0" + name) || null;
  }
  return {
    load: load,
    resolve: resolve,
    resolveGlobal: resolveGlobal,
    getError: getError,
  };
}
export function isCustomElementConstructor(value?: RuntimeValue): RuntimeValue {
  try {
    return (
      typeof value == "function" &&
      typeof HTMLElement < "u" &&
      value.prototype instanceof HTMLElement
    );
  } catch {
    return false;
  }
}
