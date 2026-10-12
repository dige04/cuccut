/**
 * Reconstructed registry subsystem of the Design Component runtime.
 * Source declarations: dc-runtime.js offsets 182199..185953.
 * Semantic names are inferred from the shipped behavior; see runtime-map.json.
 */
/* @jsxRuntime classic */
/* @jsx renderJSX */
import { createPseudoClassManager } from "./css";
import { DESIGN_MODE_META_PATTERN, createHelmetManager } from "./helmet";
import { createExternalModuleLoader, findResourceBlob } from "./resources";
import {
  Placeholder,
  StreamableLogic,
  createComponentFactory,
  evaluateLogicClass,
} from "./components";
import { createElement as renderJSX } from "./react";
import { parseDesignHtml, parsePropsMetadata } from "./document";
import { compileTemplate } from "./template";
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
export function createRegistry(): ComponentRegistry {
  const entries: RuntimeValue = Object.create(null);
  function get(name?: RuntimeValue): RuntimeValue {
    return (
      entries[name] ||
      (entries[name] = {
        html: "",
        tpl: null,
        Logic: null,
        jsStreaming: false,
        htmlStreaming: false,
        ver: 0,
        subs: new Set(),
        fetched: false,
      })
    );
  }
  function bump(name?: RuntimeValue): RuntimeValue {
    const entry: RuntimeValue = get(name);
    entry.ver++;
    for (const notify of entry.subs) notify();
  }
  return {
    entries: entries,
    get: get,
    bump: bump,
    bumpAll(): RuntimeValue {
      for (const name in entries) bump(name);
    },
  };
}
export var siblingBasePath = ".";
export function createRuntime(
  documentNode: Document = document,
  options: RuntimeOptions = {},
): DesignRuntime {
  const omelette: RuntimeValue = options.omelette === true,
    registry: RuntimeValue = createRegistry(),
    pseudoClass: RuntimeValue = createPseudoClassManager(documentNode),
    helmet: RuntimeValue = createHelmetManager(
      documentNode,
      (name?: RuntimeValue): RuntimeValue => registry.get(name).htmlStreaming,
      {
        omelette: omelette,
      },
    ),
    externalModules: RuntimeValue = createExternalModuleLoader(
      (): RuntimeValue => registry.bumpAll(),
    ),
    components: RuntimeValue = createComponentFactory(
      registry,
      fetchSibling,
      ensureCompiled,
    ),
    context: RuntimeValue = {
      component: (name?: RuntimeValue): RuntimeValue => components.getDC(name),
      placeholder: (props?: RuntimeValue): RuntimeValue => (
        <Placeholder {...props} />
      ),
      helmet: (element?: RuntimeValue): RuntimeValue => helmet.compile(element),
      loadExternal: (
        kind?: RuntimeValue,
        url?: RuntimeValue,
        previousLoad?: RuntimeValue,
      ): RuntimeValue => externalModules.load(kind, url, previousLoad),
      resolveExternal: (
        url?: RuntimeValue,
        name?: RuntimeValue,
      ): RuntimeValue => externalModules.resolve(url, name),
      resolveExternalGlobal: (
        url?: RuntimeValue,
        name?: RuntimeValue,
      ): RuntimeValue => externalModules.resolveGlobal(url, name),
      resolveExternalError: (
        url?: RuntimeValue,
        name?: RuntimeValue,
      ): RuntimeValue => externalModules.getError(url, name),
      pseudoClass: pseudoClass,
      keyframesPlayhead: (): RuntimeValue => playhead,
      omelette: omelette,
    };
  let playhead = 0;
  function seekKeyframes(time?: RuntimeValue): RuntimeValue {
    const normalizedTime: RuntimeValue =
      typeof time == "number" && Number.isFinite(time) ? Math.max(0, time) : 0;
    normalizedTime !== playhead &&
      ((playhead = normalizedTime), registry.bumpAll());
  }
  function fetchSibling(name?: RuntimeValue): RuntimeValue {
    const entry: RuntimeValue = registry.get(name);
    if (entry.fetched) return;
    entry.fetched = true;
    const siblingUrl: RuntimeValue =
        siblingBasePath + "/" + encodeURIComponent(name) + ".dc.html",
      resources: RuntimeValue = window.__resources,
      mappedUrl: RuntimeValue = resources ? resources[siblingUrl] : undefined,
      url: RuntimeValue =
        typeof mappedUrl == "string" && mappedUrl ? mappedUrl : siblingUrl,
      blob: RuntimeValue = findResourceBlob(url);
    (blob
      ? blob.text()
      : fetch(url).then(
          (response?: RuntimeValue): RuntimeValue =>
            response.ok
              ? response.text()
              : (console.error(
                  '[dc-runtime] sibling fetch for "' + name + '" failed:',
                  siblingUrl,
                  "returned",
                  response.status,
                  "\u2014 the reference renders as an empty placeholder.",
                ),
                ""),
        )
    )
      .then((html?: RuntimeValue): RuntimeValue => {
        if (!html) return;
        const parsed: RuntimeValue = parseDesignHtml(html);
        if (!parsed) {
          console.error(
            '[dc-runtime] sibling fetch for "' + name + '":',
            siblingUrl,
            "has no <x-dc> block \u2014 not a Design Component.",
          );
          return;
        }
        parsed.props && (entry.propsMeta = parsed.props);
        parsed.preview && (entry.preview = parsed.preview);
        parsed.template && !entry.html && updateHtml(name, parsed.template);
        parsed.js && !entry.Logic && updateJs(name, parsed.js);
      })
      .catch(
        (error?: RuntimeValue): RuntimeValue =>
          console.error(
            '[dc-runtime] sibling fetch for "' + name + '" threw:',
            siblingUrl,
            error,
          ),
      );
  }
  let rootName: RuntimeValue = null;
  function compileEntry(
    name?: RuntimeValue,
    entry?: RuntimeValue,
  ): RuntimeValue {
    entry.tplStale = false;
    try {
      entry.tpl = compileTemplate(entry.html, context);
    } catch (error) {
      console.error("[dc-runtime] template compile FAILED for", name, error);
    }
  }
  function ensureCompiled(name?: RuntimeValue): RuntimeValue {
    const entry: RuntimeValue = registry.get(name);
    entry.tplStale && compileEntry(name, entry);
  }
  function updateHtml(name?: RuntimeValue, html?: RuntimeValue): RuntimeValue {
    const entry: RuntimeValue = registry.get(name);
    if (((entry.html = html), name === rootName)) {
      const designMode: RuntimeValue =
        DESIGN_MODE_META_PATTERN.exec(html)?.[1] ?? null;
      (designMode || !entry.htmlStreaming) &&
        helmet.setDesignDocMode(designMode);
    }
    entry.subs.size === 0 ? (entry.tplStale = true) : compileEntry(name, entry);
    registry.bump(name);
  }
  function updateJs(
    name?: RuntimeValue,
    javascript?: RuntimeValue,
  ): RuntimeValue {
    const entry: RuntimeValue = registry.get(name),
      sequence: RuntimeValue = (entry.jsSeq = (entry.jsSeq || 0) + 1);
    try {
      const Logic: RuntimeValue = evaluateLogicClass(javascript);
      if (entry.jsSeq !== sequence) return;
      typeof Logic != "function"
        ? (entry.logicError =
            name +
            ".dc.html: <script data-dc-script> must define `class Component extends DCLogic`")
        : ((entry.logicError = null), (entry.Logic = Logic));
    } catch (error) {
      if (entry.jsSeq !== sequence) return;
      console.error(
        "[dc-runtime] logic class eval FAILED for",
        name,
        "\u2014 the template renders with props only.",
        error,
      );
      entry.logicError =
        name +
        ": " +
        (error instanceof Error && error.message
          ? error.message
          : String(error));
    }
    registry.bump(name);
  }
  function setStreaming(
    name?: RuntimeValue,
    kind?: RuntimeValue,
    streaming?: RuntimeValue,
  ): RuntimeValue {
    const entry: RuntimeValue = registry.get(name);
    kind === "html"
      ? (entry.htmlStreaming = !!streaming)
      : (entry.jsStreaming = !!streaming);
    let anyStreaming = false;
    for (const componentName in registry.entries) {
      const componentEntry: RuntimeValue = registry.entries[componentName];
      if (
        componentEntry &&
        (componentEntry.htmlStreaming || componentEntry.jsStreaming)
      ) {
        anyStreaming = true;
        break;
      }
    }
    documentNode.documentElement.classList.toggle(
      "sc-dc-streaming",
      anyStreaming,
    );
    registry.bump(name);
  }
  function dcUpdate(
    name?: RuntimeValue,
    kind?: RuntimeValue,
    content?: RuntimeValue,
    streaming?: RuntimeValue,
  ): RuntimeValue {
    if ((streaming && (registry.get(name).fetched = true), kind === "html")) {
      setStreaming(name, "html", !!streaming);
      updateHtml(name, content);
    } else if (kind === "js") {
      setStreaming(name, "js", !!streaming);
      streaming || updateJs(name, content);
    } else if (kind === "props") {
      const { props: props, preview: preview } = parsePropsMetadata(content),
        entry: RuntimeValue = registry.get(name);
      entry.propsMeta = props ?? undefined;
      entry.preview = preview;
      registry.bump(name);
    }
  }
  function setProps(name?: RuntimeValue, props?: RuntimeValue): RuntimeValue {
    registry.get(name).propOverrides =
      props && typeof props == "object"
        ? {
            ...props,
          }
        : null;
    registry.bump(name);
  }
  function adoptParsed(
    name?: RuntimeValue,
    parsed?: RuntimeValue,
  ): RuntimeValue {
    if (!parsed) return;
    const entry: RuntimeValue = registry.get(name);
    parsed.props && (entry.propsMeta = parsed.props);
    parsed.preview && (entry.preview = parsed.preview);
    parsed.template && updateHtml(name, parsed.template);
    parsed.js && updateJs(name, parsed.js);
  }
  return {
    registry: registry,
    getDC: components.getDC,
    updateHtml: updateHtml,
    updateJs: updateJs,
    dcUpdate: dcUpdate,
    setProps: setProps,
    seekKeyframes: seekKeyframes,
    keyframesPlayhead: (): RuntimeValue => playhead,
    adoptParsed: adoptParsed,
    setRootName: (name?: RuntimeValue): RuntimeValue => {
      rootName = name;
    },
    markFetched: (name?: RuntimeValue): RuntimeValue => {
      registry.get(name).fetched = true;
    },
    annotatedTemplate: (name?: RuntimeValue): RuntimeValue => {
      ensureCompiled(name);
      const entry: RuntimeValue = registry.get(name);
      return (entry.tpl && entry.tpl.__annotated) || null;
    },
    templateSource: (name?: RuntimeValue): RuntimeValue =>
      registry.get(name).html || null,
    StreamableLogic: StreamableLogic,
  };
}
export function createStreamingTracker(
  ttl: number = 6e4,
  now: () => number = Date.now,
): StreamingTracker {
  const startedAt: RuntimeValue = new Map(),
    isLive: RuntimeValue = (name?: RuntimeValue): RuntimeValue => {
      const timestamp: RuntimeValue = startedAt.get(name);
      return timestamp === undefined
        ? false
        : now() - timestamp > ttl
          ? (startedAt.delete(name), false)
          : true;
    };
  return {
    push(
      name?: RuntimeValue,
      streaming?: RuntimeValue,
      source?: RuntimeValue,
    ): RuntimeValue {
      source !== "dc-model" &&
        (streaming ? startedAt.set(name, now()) : startedAt.delete(name));
    },
    live(name?: RuntimeValue): RuntimeValue {
      if (name !== undefined) return isLive(name);
      for (const componentName of [...startedAt.keys()])
        if (isLive(componentName)) return true;
      return false;
    },
  };
}
