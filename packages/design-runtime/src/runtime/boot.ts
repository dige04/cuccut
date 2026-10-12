/**
 * Reconstructed boot subsystem of the Design Component runtime.
 * Source declarations: dc-runtime.js offsets 185953..187896.
 * Semantic names are inferred from the shipped behavior; see runtime-map.json.
 */
import { createRuntime, createStreamingTracker } from "./registry";
import { RUNTIME_CSS, mountDesignDocument } from "./document";
import { beginErrorReporting, createErrorReporter, setErrorReporter } from "./errors";
import {
  REACT_CDN_INTEGRITY,
  REACT_CDN_URL,
  REACT_DOM_CDN_INTEGRITY,
  REACT_DOM_CDN_URL,
  resolveScriptResource,
} from "./resources";
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
export function hideDesignSource(): RuntimeValue {
  const styleElement: RuntimeValue = document.createElement("style");
  styleElement.textContent = "x-dc{display:none!important}";
  document.head.appendChild(styleElement);
}
export function loadScript(url?: RuntimeValue, integrity?: RuntimeValue): RuntimeValue {
  return new Promise((resolve?: RuntimeValue, reject?: RuntimeValue): RuntimeValue => {
    const scriptElement: RuntimeValue = document.createElement("script");
    scriptElement.src = url;
    integrity && ((scriptElement.integrity = integrity), (scriptElement.crossOrigin = "anonymous"));
    scriptElement.async = false;
    scriptElement.onload = (): RuntimeValue => resolve();
    scriptElement.onerror = (): RuntimeValue => reject(new Error(`failed to load ${url}`));
    document.head.appendChild(scriptElement);
  });
}
/**
 * CucCut: restored from the shipped dc-runtime. The live preview prepends React to support.js and dc-runtime.js
 * bundles its own, so both skip loading; the whole-design HTML export embeds React under the CDN URLs
 * (`window.__resources`), which only this lookup reaches (docs/design/canvas §8.3).
 */
export function ensureReactAvailable(): RuntimeValue {
  const page: RuntimeValue = window;
  if (page.React && page.ReactDOM) return Promise.resolve();
  const react: RuntimeValue = resolveScriptResource(REACT_CDN_URL, REACT_CDN_INTEGRITY),
    reactDom: RuntimeValue = resolveScriptResource(REACT_DOM_CDN_URL, REACT_DOM_CDN_INTEGRITY);
  return Promise.all([loadScript(react.src, react.integrity), loadScript(reactDom.src, reactDom.integrity)]).then(
    (): RuntimeValue => {},
  );
}
export function bootRuntime(): RuntimeValue {
  const omelette: RuntimeValue = window.__dcRuntimeMode === "omelette",
    runtime: RuntimeValue = createRuntime(document, {
      omelette: omelette,
    });
  let rootName = "Root",
    mounted = false;
  const runtimeStyle: RuntimeValue = document.createElement("style");
  runtimeStyle.textContent = RUNTIME_CSS;
  document.head.prepend(runtimeStyle);
  const notifyBooted: RuntimeValue = (): RuntimeValue => {
      if (window.parent === window) return;
      const entry: RuntimeValue = runtime.registry.entries[rootName];
      try {
        window.parent.postMessage(
          {
            type: "__dc_booted",
            rootName: rootName,
            mounted: mounted,
            propsMeta: (entry && entry.propsMeta) || null,
            preview: (entry && entry.preview) || null,
            tellsErrors: true,
          },
          "*",
        );
      } catch {}
    },
    streaming: RuntimeValue = createStreamingTracker();
  window.parent !== window &&
    setErrorReporter(
      createErrorReporter(
        (errors?: RuntimeValue): RuntimeValue => {
          try {
            const message: RuntimeValue = {
              type: "__dc_render_errors",
              errors: errors,
            };
            window.parent.postMessage(message, "*");
          } catch {}
        },
        (callback?: RuntimeValue): RuntimeValue => {
          setTimeout(callback, 200);
        },
        (): RuntimeValue => streaming.live(),
      ),
    );
  const api: RuntimeValue = {
    __dcUpdate: (
      name?: RuntimeValue,
      kind?: RuntimeValue,
      content?: RuntimeValue,
      isStreaming?: RuntimeValue,
      source?: RuntimeValue,
    ): RuntimeValue => {
      streaming.push(name, isStreaming, source);
      runtime.dcUpdate(name, kind, content, isStreaming);
      name === rootName && !isStreaming && kind === "props" && notifyBooted();
    },
    __dcStreaming: (name?: RuntimeValue): RuntimeValue => streaming.live(name),
    __dcSetProps: (name?: RuntimeValue, props?: RuntimeValue): RuntimeValue =>
      runtime.setProps(name, props),
    __dcSeekKeyframes: (time?: RuntimeValue): RuntimeValue => runtime.seekKeyframes(time),
    __dcKeyframesPlayhead: (): RuntimeValue => runtime.keyframesPlayhead(),
    __dcRootName: (): RuntimeValue => rootName,
    __dcAnnotatedTemplate: (name?: RuntimeValue): RuntimeValue => runtime.annotatedTemplate(name),
    __dcTemplateSource: (name?: RuntimeValue): RuntimeValue => runtime.templateSource(name),
    __dcBoot: (): RuntimeValue => {
      const mountedRootName: RuntimeValue = mountDesignDocument(runtime, document);
      mountedRootName != null && ((rootName = mountedRootName), (mounted = true));
      notifyBooted();
      beginErrorReporting();
    },
    __dcRegistry: runtime.registry.entries,
    getDC: (name?: RuntimeValue): RuntimeValue => runtime.getDC(name),
    DCLogic: runtime.StreamableLogic,
    StreamableLogic: runtime.StreamableLogic,
  };
  Object.assign(window, api);
  window.__dcContentKeyed = true;
  document.readyState !== "loading"
    ? api.__dcBoot()
    : document.addEventListener("DOMContentLoaded", (): RuntimeValue => api.__dcBoot());
}
