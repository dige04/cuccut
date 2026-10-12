import type { DoneMessage } from "./types";
/** Fast edit runtime: CSS fidelity, SDK v1/v2/v3, streaming statements and previews. */
import { Window as HappyWindow } from "happy-dom";
import { jQueryFactory as createJQuery } from "jquery/factory";
import * as statementStream from "./statement-stream";
import type {
  Dynamic,
  EditRuntime,
  EmitWorkerMessage,
  RuntimeLimits,
} from "./types";
var DEFAULT_LIMITS: RuntimeLimits = {
  maxLines: 40,
  maxChars: 20000,
  maxHtml: 200000,
  maxStmt: 4000,
  maxMsg: 500,
  maxLogs: 50,
  idleRunMs: 150,
  splitter: "stream",
  previewMs: -1,
};
var WINDOW_INTRINSICS: Dynamic = [
  "Array",
  "Object",
  "Function",
  "Promise",
  "Symbol",
  "Map",
  "Set",
  "WeakMap",
  "WeakSet",
  "Date",
  "RegExp",
  "Number",
  "String",
  "Boolean",
  "Proxy",
  "Error",
  "TypeError",
  "SyntaxError",
  "RangeError",
  "ReferenceError",
  "EvalError",
  "URIError",
];
var UNITLESS_CSS_PROPERTIES: Dynamic = new Set([
  "lineHeight",
  "opacity",
  "fontWeight",
  "zIndex",
  "flex",
  "flexGrow",
  "flexShrink",
  "order",
  "zoom",
  "columnCount",
  "aspectRatio",
  "gridRow",
  "gridColumn",
  "gridRowStart",
  "gridRowEnd",
  "gridColumnStart",
  "gridColumnEnd",
  "gridArea",
  "fillOpacity",
  "strokeOpacity",
  "floodOpacity",
  "stopOpacity",
  "animationIterationCount",
  "scale",
  "widows",
  "orphans",
]);
var camelCaseCssProperty: Dynamic = (
  input?: Dynamic,
  ..._extraArguments: Dynamic[]
): Dynamic =>
  String(input)
    .replace(/^-ms-/, "ms-")
    .replace(
      /-([a-z])/g,
      (
        input2?: Dynamic,
        options?: Dynamic,
        ..._extraArguments2: Dynamic[]
      ): Dynamic => options.toUpperCase(),
    );
var CHAIN_CONTINUATION: Dynamic = /^\s*(?:\.(?!\d)|\?|:|&&|\|\||,)/;
var CODE_FENCE: Dynamic = /^\s*```[\w-]*\s*$/;
var CODE_START: Dynamic =
  /^\s*(?:(?:const|let|var|function|if|for|while|do|try|switch|return|throw|new|await|async|class|typeof|delete|void)\s|\/\/|\/\*|[([{$`]|[A-Za-z_$][\w$]*\s*(?:[.(\[=]|\+\+|--))/;
var CODE_LIKE: Dynamic =
  /^\s*(?:(?:const|let|var|function|if|for|while|do|try|switch|return|throw|new|await|async|class|typeof|delete|void)\b|\/\/|\/\*|[([{$`'"!+~-]|[A-Za-z_$][\w$]*\s*(?:[.(\[=;]|\+\+|--|$))/;
var ENABLE_DOM_DECK: Dynamic = false;
function createEditRuntime(
  emit: EmitWorkerMessage,
  initialLimits?: Partial<RuntimeLimits>,
): EditRuntime;
function createEditRuntime(
  emit: EmitWorkerMessage,
  initialLimits?: Partial<RuntimeLimits>,
): EditRuntime {
  let limits: Dynamic = Object.assign({}, DEFAULT_LIMITS, initialLimits || {});
  let window: Dynamic;
  let document: Dynamic;
  let jquery: Dynamic;
  let select: Dynamic;
  let currentElement: Dynamic = null;
  let initialized: Dynamic = false;
  let domDeck: Dynamic = null;
  let deckApi: Dynamic = null;
  let executingStatement: Dynamic = "";
  let chainMode: Dynamic = false;
  let previousValue: Dynamic;
  let project: Dynamic = null;
  let lineTail: Dynamic = "";
  let pendingCode: Dynamic = "";
  let pendingLineCount: Dynamic = 0;
  let compiledPending: Dynamic = null;
  let hasSeenCode: Dynamic = false;
  let sequence: Dynamic = 0;
  let lastHtml: Dynamic = "";
  let idleTimer: Dynamic = 0;
  let finished: Dynamic = false;
  let insideCodeFence: Dynamic = null;
  let originalHadTbody: Dynamic = true;
  let pace: Dynamic = null;
  let nextFrameTime: Dynamic = 0;
  let previewCount: Dynamic = 0;
  let queuedFrames: Dynamic = new Map();
  function sendQueuedFrames(
    input?: Dynamic,
    ..._extraArguments4: Dynamic[]
  ): Dynamic {
    for (let [value2, value3] of queuedFrames) {
      if (!input && Date.now() < nextFrameTime) return;
      queuedFrames.delete(value2);
      emit({
        kind: "html" as const,
        seq: sequence++,
        slideId: value2,
        html: value3.html,
        stmt: value3.stmt,
      });
      nextFrameTime =
        Date.now() +
        Math.max(
          pace.frameMs,
          (value3.html.length + value3.stmt.length + value2.length + 100) /
            pace.frameCharsPerMs,
        );
    }
  }
  let stream: Dynamic = null;
  let useLineSplitter: Dynamic = limits.splitter === "lines";
  let incomingLine: Dynamic = "";
  let consumedLineChars: Dynamic = 0;
  let recognizedCode: Dynamic = false;
  let validFileId: Dynamic = {
    test: (input?: Dynamic, ..._extraArguments5: Dynamic[]): Dynamic =>
      /^[A-Za-z0-9_-]{1,64}$/.test(input) &&
      input !== "__proto__" &&
      input !== "constructor" &&
      input !== "prototype",
  };
  let truncate: Dynamic = (
    input?: Dynamic,
    options?: Dynamic,
    ..._extraArguments6: Dynamic[]
  ): Dynamic => {
    input = String(input);
    return input.length > options ? input.slice(0, options) : input;
  };
  let fileTerminology: Dynamic = (
    input?: Dynamic,
    ..._extraArguments7: Dynamic[]
  ): Dynamic =>
    String(input)
      .replace(/\bdeck: /g, "")
      .replace(/\bslides\b/g, "files")
      .replace(/\bslide\b/g, "file")
      .replace(/\bdeck\b/g, "project");
  let formatError: Dynamic = (
    input?: Dynamic,
    ..._extraArguments8: Dynamic[]
  ): Dynamic =>
    project
      ? truncate(
          (project.v3 ? fileTerminology(input) : String(input)).split(`
`)[0],
          200,
        )
      : truncate(input, limits.maxMsg);
  let emitError: Dynamic = (
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    ..._extraArguments9: Dynamic[]
  ): Dynamic =>
    emit(
      Object.assign(
        {
          kind: "error" as const,
          message: formatError(input),
          stmt: truncate(options || "", limits.maxStmt),
        },
        context,
      ),
    );
  let emitStatementError: Dynamic = (
    input?: Dynamic,
    options?: Dynamic,
    ..._extraArguments0: Dynamic[]
  ): Dynamic => {
    if ((emitError(input, options), project))
      emit({
        kind: "done" as const,
        seq: sequence++,
        n: ++project.n,
        stmt: truncate(options || "", limits.maxStmt),
        changed: [],
        logged: 0,
        threw: {
          message: formatError(input),
        },
      });
  };
  function initialize(
    html?: Dynamic,
    domDeckMetadata?: Dynamic,
    metadata?: Dynamic,
    sdk?: Dynamic,
    options?: Dynamic,
    ..._extraArguments1: Dynamic[]
  ): Dynamic {
    if (options && Number.isFinite(options.previewMs))
      limits.previewMs = options.previewMs;
    let requestedPace: Dynamic = options && options.pace;
    let positiveNumber: Dynamic = (
      input?: Dynamic,
      ..._extraArguments10: Dynamic[]
    ): Dynamic => Number.isFinite(input) && input > 0;
    pace =
      requestedPace &&
      typeof requestedPace === "object" &&
      positiveNumber(requestedPace.frameCharsPerMs) &&
      positiveNumber(requestedPace.frameMs) &&
      positiveNumber(requestedPace.previewCharsPerMs) &&
      positiveNumber(requestedPace.maxPreviews)
        ? {
            frameCharsPerMs: requestedPace.frameCharsPerMs,
            frameMs: requestedPace.frameMs,
            previewCharsPerMs: requestedPace.previewCharsPerMs,
            maxPreviews: requestedPace.maxPreviews,
          }
        : null;
    nextFrameTime = 0;
    previewCount = 0;
    queuedFrames.clear();
    chainMode =
      options && typeof options.chains === "boolean"
        ? options.chains
        : !!(sdk && sdk.version === 3);
    window = new HappyWindow({
      url: "about:blank",
      settings: {
        disableJavaScriptEvaluation: true,
        enableJavaScriptEvaluation: false,
        disableJavaScriptFileLoading: true,
        disableCSSFileLoading: true,
        disableComputedStyleRendering: true,
        disableIframePageLoading: true,
        navigation: {
          disableMainFrameNavigation: true,
          disableChildFrameNavigation: true,
          disableChildPageNavigation: true,
          disableFallbackToSetURL: true,
        },
      },
    });
    for (let value3 of WINDOW_INTRINSICS)
      if (window[value3] === undefined)
        window[value3] = (globalThis as Dynamic)[value3];
    window.getComputedStyle = (
      input?: Dynamic,
      ..._extraArguments11: Dynamic[]
    ): Dynamic =>
      new Proxy(input.style, {
        get(input2: Dynamic, options2: Dynamic): Dynamic {
          if (options2 === "getPropertyValue")
            return (
              input3?: Dynamic,
              ..._extraArguments12: Dynamic[]
            ): Dynamic =>
              input2.getPropertyValue(input3) ||
              getFallbackStyle(input, String(input3));
          let entry: Dynamic = Reflect.get(input2, options2);
          if (typeof entry === "function") return entry.bind(input2);
          return (entry === "" || entry === undefined) &&
            typeof options2 === "string" &&
            /^[a-zA-Z-]+$/.test(options2)
            ? getFallbackStyle(input, kebabCaseCssProperty(options2)) || entry
            : entry;
        },
      });
    document = window.document;
    try {
      window.Element.prototype.toString = function (
        this: Dynamic,
        ..._extraArguments13: Dynamic[]
      ): Dynamic {
        return (
          "[object " +
          ((this.constructor && this.constructor.name) || "Element") +
          "]"
        );
      };
    } catch (value3: Dynamic) {}
    if ((collectPlaceholders(html), sdk)) {
      for (let value3 of Object.keys(sdk.texts || {}))
        collectPlaceholders(sdk.texts[value3]);
      for (let value3 of Object.keys(sdk.layouts || {}))
        collectPlaceholders(sdk.layouts[value3]);
    }
    if (
      ((originalHadTbody = /<tbody[\s>]/i.test(String(html))),
      (document.body.innerHTML = String(html)),
      (currentElement = document.body.querySelector("section")),
      !currentElement)
    ) {
      emitError("no <section> in the slide text", "");
      return false;
    }
    if (
      ENABLE_DOM_DECK &&
      domDeckMetadata &&
      Array.isArray(domDeckMetadata.slides)
    )
      initializeDomDeck(domDeckMetadata);
    else if (metadata && Array.isArray(metadata.slides)) {
      if (sdk && (sdk.version === 2 || sdk.version === 3))
        project = createProjectState(metadata, sdk, html);
      deckApi = createDeckApi(metadata, project);
    }
    jquery = createJQuery(window);
    let style: Dynamic = jquery.style;
    jquery.style = function (
      this: Dynamic,
      element?: Dynamic,
      options2?: Dynamic,
      context?: Dynamic,
      value3?: Dynamic,
      ..._extraArguments14: Dynamic[]
    ): Dynamic {
      if (
        typeof context === "number" &&
        context === context &&
        !UNITLESS_CSS_PROPERTIES.has(camelCaseCssProperty(options2)) &&
        !String(options2).startsWith("--")
      )
        context = context + "px";
      if (context === undefined || !element || element.nodeType !== 1)
        return style.call(this, element, options2, context, value3);
      let value4: Dynamic = kebabCaseCssProperty(options2);
      let entry: Dynamic = fallbackStyles.get(element);
      if (typeof context === "string" && /url\(/i.test(context))
        return setFallbackStyle(element, value4, context);
      if (context === "" || context === null) {
        if (entry) entry.delete(value4);
        if (!removedStyleProperties.has(element))
          removedStyleProperties.set(element, new Set());
        removedStyleProperties.get(element).add(value4);
        return style.call(this, element, options2, context, value3);
      }
      if (entry) entry.delete(value4);
      let attribute: Dynamic = element.getAttribute("style");
      let cssText: Dynamic = element.style.cssText;
      let value5: Dynamic = style.call(
        this,
        element,
        options2,
        context,
        value3,
      );
      if (
        typeof context === "string" &&
        context.trim() &&
        element.style.cssText === cssText &&
        element.style.getPropertyValue(value4) === "" &&
        getFallbackStyle(element, value4) !== context
      )
        setFallbackStyle(element, value4, context);
      else {
        let value6: Dynamic =
          typeof context === "string" &&
          !/^[-+]=/.test(context) &&
          !(jquery.cssHooks[camelCaseCssProperty(options2)] || {}).set
            ? context.trim()
            : element.style.getPropertyValue(value4);
        let value7: Dynamic =
          element.style.cssText === cssText || !value6
            ? attribute
            : mergeCssDeclaration(attribute || "", value4, value6);
        if (value7 === null) element.removeAttribute("style");
        else element.setAttribute("style", value7);
        if (
          attribute === null ||
          (lastJqueryStyles.has(element)
            ? lastJqueryStyles.get(element) === attribute
            : !originalStyles.has(element) ||
              originalStyles.get(element) === attribute)
        )
          lastJqueryStyles.set(element, value7);
        else lastJqueryStyles.delete(element);
      }
      return value5;
    };
    jquery.attrHooks.style = {
      set: (
        input?: Dynamic,
        options2?: Dynamic,
        ..._extraArguments15: Dynamic[]
      ): Dynamic => {
        directStyleWrites.add(input);
        fallbackStyles.delete(input);
        input.setAttribute("style", String(options2));
        return options2;
      },
    };
    let value2: Dynamic = (..._extraArguments16: Dynamic[]): Dynamic => {
      throw Error(project.goneMsg);
    };
    if (
      ((select = function (
        input?: Dynamic,
        options2?: Dynamic,
        ..._extraArguments17: Dynamic[]
      ): Dynamic {
        if (project && project.v3)
          return project.seen(
            arguments.length
              ? jquery(input, options2)
              : jquery(document.body).children(),
          );
        if (
          project &&
          project.currentRemoved &&
          (!arguments.length ||
            (typeof input === "string" &&
              options2 === undefined &&
              !/^\s*</.test(input)))
        )
          value2();
        return arguments.length
          ? jquery(input, options2)
          : jquery(currentElement);
      }),
      Object.setPrototypeOf(select, jquery),
      (select.prototype = jquery.prototype),
      Object.defineProperty(select, "slide", {
        get: (..._extraArguments18: Dynamic[]): Dynamic =>
          project && project.currentRemoved ? value2() : jquery(currentElement),
      }),
      (scratchElement = document.createElement("div")),
      project && project.v3)
    ) {
      initializeFileSdk(metadata, sdk);
      initialized = true;
      emit({
        kind: "ready" as const,
      });
      return true;
    }
    for (let value3 of [
      currentElement,
      ...currentElement.querySelectorAll("[style]"),
    ])
      if (value3.getAttribute("style") !== null)
        originalStyles.set(value3, value3.getAttribute("style"));
    if (((lastHtml = serializeCurrentSlide()), project && project.current))
      project.slides.get(project.current).last = lastHtml;
    if (domDeck) {
      let value3: Dynamic = validateDomDeck();
      domDeck.last = value3.ok ? JSON.stringify(value3.state) : "";
    }
    initialized = true;
    emit({
      kind: "ready" as const,
    });
    return true;
  }
  let originalStyles: Dynamic = new WeakMap();
  let scratchElement: Dynamic = null;
  function parseCssDeclarations(
    css?: Dynamic,
    ..._extraArguments19: Dynamic[]
  ): Dynamic {
    let declarations: Dynamic = [];
    let parenthesisDepth: Dynamic = 0;
    let quote: Dynamic = "";
    let declarationStart: Dynamic = 0;
    for (let index: Dynamic = 0; index <= css.length; index++) {
      let character: Dynamic = css[index];
      if (
        index === css.length ||
        (character === ";" && !parenthesisDepth && !quote)
      ) {
        let text: Dynamic = css.slice(declarationStart, index).trim();
        let colonIndex: Dynamic = text.indexOf(":");
        if (((declarationStart = index + 1), colonIndex > 0))
          declarations.push({
            prop: text.slice(0, colonIndex).trim().toLowerCase(),
            value: text.slice(colonIndex + 1).trim(),
            text: text,
          });
      } else if (quote) {
        if (character === quote) quote = "";
      } else if (character === '"' || character === "'") quote = character;
      else if (character === "(") parenthesisDepth++;
      else if (character === ")" && parenthesisDepth) parenthesisDepth--;
    }
    return declarations;
  }
  let cssDeclarationMap: Dynamic = (
    input?: Dynamic,
    ..._extraArguments20: Dynamic[]
  ): Dynamic =>
    new Map(
      parseCssDeclarations(input).map(
        (declaration?: Dynamic, ..._extraArguments21: Dynamic[]): Dynamic => [
          declaration.prop,
          declaration.value,
        ],
      ),
    );
  let normalizeCssDeclaration: Dynamic = (
    declaration?: Dynamic,
    ..._extraArguments22: Dynamic[]
  ): Dynamic => {
    scratchElement.setAttribute("style", declaration.text);
    let value2: Dynamic = cssDeclarationMap(scratchElement.style.cssText);
    scratchElement.removeAttribute("style");
    try {
      scratchElement.style.setProperty(
        declaration.prop,
        declaration.value.replace(/\s*!important\s*$/, ""),
        /!important\s*$/.test(declaration.value) ? "important" : "",
      );
    } catch (value4: Dynamic) {}
    let value3: Dynamic = cssDeclarationMap(
      scratchElement.getAttribute("style") || "",
    );
    scratchElement.removeAttribute("style");
    return [value2, value3];
  };
  let matchesCssDeclarations: Dynamic = (
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    ..._extraArguments23: Dynamic[]
  ): Dynamic => {
    if (!input.size) return false;
    for (let [value2, value3] of input)
      if (options.get(value2) !== value3 || context.has(value2)) return false;
    return true;
  };
  let freshCssDeclaration: Dynamic = (
    input?: Dynamic,
    options?: Dynamic,
    ..._extraArguments24: Dynamic[]
  ): Dynamic => ({
    prop: input,
    value: options,
    fresh: true,
  });
  function collapseFlexShorthand(
    input?: Dynamic,
    ..._extraArguments25: Dynamic[]
  ): Dynamic {
    let value2: Dynamic = (
      input2?: Dynamic,
      ..._extraArguments26: Dynamic[]
    ): Dynamic =>
      input.find(
        (declaration?: Dynamic, ..._extraArguments27: Dynamic[]): Dynamic =>
          declaration.fresh && declaration.prop === input2,
      );
    let value3: Dynamic = value2("flex-grow");
    let value4: Dynamic = value2("flex-shrink");
    let value5: Dynamic = value2("flex-basis");
    if (
      value3 &&
      value4 &&
      value5 &&
      value4.value === "1" &&
      value5.value === "0%"
    ) {
      value3.prop = "flex";
      input = input.filter(
        (input2?: Dynamic, ..._extraArguments28: Dynamic[]): Dynamic =>
          input2 !== value4 && input2 !== value5,
      );
    }
    for (let value6 of input)
      if (value6.fresh && value6.prop === "flex")
        value6.value = value6.value.replace(/^(\d+(?:\.\d+)?) 1 0%$/, "$1");
    return input;
  }
  let serializeCssDeclarations: Dynamic = (
    input?: Dynamic,
    ..._extraArguments29: Dynamic[]
  ): Dynamic =>
    input
      .map(
        (declaration?: Dynamic, ..._extraArguments30: Dynamic[]): Dynamic =>
          declaration.fresh
            ? declaration.prop + ": " + declaration.value
            : declaration.text,
      )
      .join("; ");
  let fallbackStyles: Dynamic = new WeakMap();
  let removedStyleProperties: Dynamic = new WeakMap();
  let directStyleWrites: Dynamic = new WeakSet();
  let kebabCaseCssProperty: Dynamic = (
    input?: Dynamic,
    ..._extraArguments31: Dynamic[]
  ): Dynamic =>
    String(input)
      .replace(/^ms(?=[A-Z])/, "-ms")
      .replace(
        /[A-Z]/g,
        (input2?: Dynamic, ..._extraArguments32: Dynamic[]): Dynamic =>
          "-" + input2.toLowerCase(),
      );
  let extractBackgroundUrl: Dynamic = (
    input?: Dynamic,
    ..._extraArguments33: Dynamic[]
  ): Dynamic => {
    let value2: Dynamic = input.search(/url\(/i);
    if (value2 < 0) return "";
    let text: Dynamic = "";
    for (let value3: Dynamic = value2 + 4; value3 < input.length; value3++) {
      let value4: Dynamic = input[value3];
      if (text) {
        if (value4 === text) text = "";
      } else if (value4 === '"' || value4 === "'") text = value4;
      else if (value4 === ")") return input.slice(value2, value3 + 1);
    }
    return "";
  };
  function replaceCssDeclaration(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    ..._extraArguments34: Dynamic[]
  ): Dynamic {
    let value2: Dynamic = parseCssDeclarations(input);
    let value3: Dynamic = false;
    let items: Dynamic = [];
    for (let value4 of value2)
      if (value4.prop !== options) items.push(value4.text);
      else if (!value3) {
        items.push(options + ": " + context);
        value3 = true;
      }
    if (!value3) items.push(options + ": " + context);
    return items.join("; ");
  }
  let lastJqueryStyles: Dynamic = new WeakMap();
  let canonicalCss: Dynamic = (
    input?: Dynamic,
    ..._extraArguments35: Dynamic[]
  ): Dynamic => {
    scratchElement.setAttribute("style", input);
    let value2: Dynamic = parseCssDeclarations(scratchElement.style.cssText)
      .map(
        (input2?: Dynamic, ..._extraArguments36: Dynamic[]): Dynamic =>
          input2.text,
      )
      .sort()
      .join(";");
    scratchElement.removeAttribute("style");
    return value2;
  };
  function mergeCssDeclaration(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    ..._extraArguments37: Dynamic[]
  ): Dynamic {
    let value2: Dynamic = options + ": " + context;
    let value3: Dynamic = canonicalCss(value2);
    let items: Dynamic = [];
    let value4: Dynamic = -1;
    for (let value5 of parseCssDeclarations(input))
      if (
        containsKnownPlaceholder(value5.value) ||
        (value5.prop !== options &&
          (canonicalCss(value5.text) === "" ||
            canonicalCss(value5.text + "; " + value2) !== value3))
      )
        items.push(value5);
      else if (value4 < 0) value4 = items.length;
    if (
      value4 < 0 ||
      items
        .slice(value4)
        .some(
          (declaration?: Dynamic, ..._extraArguments38: Dynamic[]): Dynamic =>
            declaration.prop === options ||
            canonicalCss(declaration.text + "; " + value2) !==
              canonicalCss(value2 + "; " + declaration.text),
        )
    )
      value4 = items.length;
    return [
      ...items
        .slice(0, value4)
        .map(
          (input2?: Dynamic, ..._extraArguments39: Dynamic[]): Dynamic =>
            input2.text,
        ),
      value2,
      ...items
        .slice(value4)
        .map(
          (input2?: Dynamic, ..._extraArguments40: Dynamic[]): Dynamic =>
            input2.text,
        ),
    ].join("; ");
  }
  function setFallbackStyle(
    element?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    ..._extraArguments41: Dynamic[]
  ): Dynamic {
    if (!fallbackStyles.has(element)) fallbackStyles.set(element, new Map());
    if (
      (fallbackStyles.get(element).set(options, context),
      removedStyleProperties.has(element))
    )
      removedStyleProperties.get(element).delete(options);
    try {
      element.style.removeProperty(options);
    } catch (value2: Dynamic) {}
    element.setAttribute(
      "style",
      replaceCssDeclaration(
        element.getAttribute("style") || "",
        options,
        context,
      ),
    );
  }
  function getFallbackStyle(
    element?: Dynamic,
    options?: Dynamic,
    ..._extraArguments42: Dynamic[]
  ): Dynamic {
    let entry: Dynamic = fallbackStyles.get(element);
    if (entry && entry.has(options)) return entry.get(options);
    let value2: Dynamic = new Map([
      ...cssDeclarationMap(originalStyles.get(element) || ""),
      ...cssDeclarationMap(element.getAttribute("style") || ""),
    ]);
    if (
      removedStyleProperties.has(element) &&
      removedStyleProperties.get(element).has(options)
    )
      return "";
    if (value2.has(options)) return value2.get(options);
    if (options === "background-image") {
      let value3: Dynamic =
        (entry && entry.get("background")) || value2.get("background");
      return value3 ? extractBackgroundUrl(value3) : "";
    }
    return "";
  }
  let TEMPLATE_PLACEHOLDER: Dynamic = /\{\{[^{}]{0,80}\}\}/g;
  let knownPlaceholders: Dynamic = new Set();
  let collectPlaceholders: Dynamic = (
    input?: Dynamic,
    ..._extraArguments43: Dynamic[]
  ): Dynamic => {
    for (let value2 of String(input).match(TEMPLATE_PLACEHOLDER) || [])
      knownPlaceholders.add(value2);
  };
  let containsKnownPlaceholder: Dynamic = (
    input?: Dynamic,
    ..._extraArguments44: Dynamic[]
  ): Dynamic =>
    knownPlaceholders.size > 0 &&
    (input.match(TEMPLATE_PLACEHOLDER) || []).some(
      (input2?: Dynamic, ..._extraArguments45: Dynamic[]): Dynamic =>
        knownPlaceholders.has(input2),
    );
  function reconcileCss(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    ..._extraArguments46: Dynamic[]
  ): Dynamic {
    let value2: Dynamic = cssDeclarationMap(options);
    let value3: Dynamic = new Set();
    let items: Dynamic = [];
    let value4: Dynamic = (context && fallbackStyles.get(context)) || new Map();
    let value5: Dynamic =
      (context && removedStyleProperties.get(context)) || new Set();
    let value6: Dynamic = !!context && directStyleWrites.has(context);
    for (let [value7, value8] of value4) value2.set(value7, value8);
    for (let value7 of parseCssDeclarations(input)) {
      let [value8, value9]: Dynamic = normalizeCssDeclaration(value7);
      let value10: Dynamic = matchesCssDeclarations(value8, value2, value3)
        ? value8
        : matchesCssDeclarations(value9, value2, value3)
          ? value9
          : null;
      if (containsKnownPlaceholder(value7.value)) {
        if ((items.push(value7), value10))
          for (let value11 of value10.keys()) value3.add(value11);
        else if (value2.get(value7.prop) === value7.value)
          value3.add(value7.prop);
        continue;
      }
      if (!value10 && !value8.size && !value9.size) {
        if (value3.has(value7.prop)) continue;
        if (value2.has(value7.prop)) {
          items.push(
            value2.get(value7.prop) === value7.value
              ? value7
              : freshCssDeclaration(value7.prop, value2.get(value7.prop)),
          );
          value3.add(value7.prop);
        } else if (!value5.has(value7.prop) && !value6) {
          items.push(value7);
          value3.add(value7.prop);
        }
        continue;
      }
      if (value10) {
        items.push(value7);
        for (let value11 of value10.keys()) value3.add(value11);
        continue;
      }
      for (let value11 of new Set([...value8.keys(), ...value9.keys()]))
        if (value2.has(value11) && !value3.has(value11)) {
          items.push(freshCssDeclaration(value11, value2.get(value11)));
          value3.add(value11);
        }
    }
    for (let [value7, value8] of value2)
      if (!value3.has(value7)) items.push(freshCssDeclaration(value7, value8));
    return serializeCssDeclarations(collapseFlexShorthand(items));
  }
  function settleStyles(
    input?: Dynamic,
    ..._extraArguments47: Dynamic[]
  ): Dynamic {
    for (let value2 of [input, ...input.querySelectorAll("[style]")]) {
      let attribute: Dynamic = value2.getAttribute("style");
      if (attribute === null) continue;
      let entry: Dynamic = originalStyles.get(value2);
      if (entry === attribute) continue;
      let value3: Dynamic = attribute;
      try {
        let value4: Dynamic =
          lastJqueryStyles.get(value2) === attribute &&
          !fallbackStyles.has(value2) &&
          !removedStyleProperties.has(value2);
        if (directStyleWrites.has(value2)) value3 = attribute;
        else if (entry !== undefined && !value4)
          value3 = reconcileCss(entry, attribute, value2);
        else if (fallbackStyles.has(value2)) {
          value3 = attribute;
          for (let [value5, value6] of fallbackStyles.get(value2))
            value3 = replaceCssDeclaration(value3, value5, value6);
        } else if (
          /flex-basis\s*:\s*0%|flex\s*:\s*[\d.]+\s+1\s+0%/.test(attribute)
        ) {
          let value5: Dynamic = new Set(
            parseCssDeclarations(entry || "").map(
              (input2?: Dynamic, ..._extraArguments48: Dynamic[]): Dynamic =>
                input2.text,
            ),
          );
          value3 =
            serializeCssDeclarations(
              collapseFlexShorthand(
                parseCssDeclarations(attribute).map(
                  (
                    declaration?: Dynamic,
                    ..._extraArguments49: Dynamic[]
                  ): Dynamic =>
                    /^flex(-grow|-shrink|-basis)?$/.test(declaration.prop) &&
                    !value5.has(declaration.text)
                      ? freshCssDeclaration(declaration.prop, declaration.value)
                      : declaration,
                ),
              ),
            ) + (/;\s*$/.test(attribute) ? ";" : "");
        }
      } catch (value4: Dynamic) {
        value3 = attribute;
      }
      if (value3 !== attribute) value2.setAttribute("style", value3);
      originalStyles.set(value2, value3);
      fallbackStyles.delete(value2);
      removedStyleProperties.delete(value2);
      directStyleWrites.delete(value2);
      lastJqueryStyles.delete(value2);
    }
  }
  function createDeckApi(
    metadata?: Dynamic,
    state?: Dynamic,
    ..._extraArguments50: Dynamic[]
  ): Dynamic {
    let currentId: Dynamic = String(metadata.current);
    let slides: Dynamic = [];
    let operationCount: Dynamic = 0;
    for (let value2 of metadata.slides) {
      let value3: Dynamic = String(value2 && value2.id);
      if (
        validFileId.test(value3) &&
        !slides.some(
          (entry?: Dynamic, ..._extraArguments51: Dynamic[]): Dynamic =>
            entry.id === value3,
        )
      )
        slides.push({
          id: value3,
          title: String((value2 && value2.title) || "").slice(0, 300),
        });
    }
    let fail: Dynamic = (
      input?: Dynamic,
      ..._extraArguments52: Dynamic[]
    ): Dynamic => {
      throw Error("deck: " + input);
    };
    let slideIndex: Dynamic = (
      input?: Dynamic,
      ..._extraArguments53: Dynamic[]
    ): Dynamic =>
      slides.findIndex(
        (entry?: Dynamic, ..._extraArguments54: Dynamic[]): Dynamic =>
          entry.id === input,
      );
    if (state)
      state.order = (..._extraArguments55: Dynamic[]): Dynamic =>
        slides.map(
          (entry?: Dynamic, ..._extraArguments56: Dynamic[]): Dynamic =>
            entry.id,
        );
    let requireSlideId: Dynamic = (
      input?: Dynamic,
      options?: Dynamic,
      ..._extraArguments57: Dynamic[]
    ): Dynamic => {
      if (typeof input !== "string" || !validFileId.test(input))
        fail(options + " must be a slide id (letters, digits, - or _)");
      if (slideIndex(input) < 0) fail('no slide with the id "' + input + '"');
      return input;
    };
    let validatePlace: Dynamic = (
      input?: Dynamic,
      options?: Dynamic,
      ..._extraArguments58: Dynamic[]
    ): Dynamic => {
      if (input === undefined && options) return options;
      if (!input || typeof input !== "object" || Array.isArray(input))
        fail("the place must be {before: id} or {after: id}");
      let value2: Dynamic = Object.keys(input);
      if (
        value2.length !== 1 ||
        (value2[0] !== "before" && value2[0] !== "after")
      )
        fail("the place must have exactly one of before / after");
      return {
        [value2[0]]: requireSlideId(input[value2[0]], value2[0]),
      };
    };
    let insertSlide: Dynamic = (
      input?: Dynamic,
      options?: Dynamic,
      ..._extraArguments59: Dynamic[]
    ): Dynamic => {
      let value2: Dynamic =
        options.before !== undefined ? options.before : options.after;
      let value3: Dynamic = slideIndex(value2);
      slides.splice(
        options.before !== undefined ? value3 : value3 + 1,
        0,
        input,
      );
    };
    let queueOperation: Dynamic = (
      input?: Dynamic,
      options?: Dynamic,
      ..._extraArguments60: Dynamic[]
    ): Dynamic => {
      if (operationCount >= 24) fail("at most 24 deck calls in one run");
      if ((operationCount++, state))
        state.ops.push({
          op: input,
          entry: options || null,
        });
      else
        emit({
          kind: "op" as const,
          seq: sequence++,
          stmt: truncate(executingStatement, limits.maxStmt),
          op: input,
        });
    };
    let requireActiveReply: Dynamic = (
      ..._extraArguments61: Dynamic[]
    ): Dynamic => {
      if (state && state.halted) fail("the reply ended at deck.undo()");
      if (operationCount >= 24) fail("at most 24 deck calls in one run");
    };
    let mintSlideId: Dynamic = (
      input?: Dynamic,
      ..._extraArguments62: Dynamic[]
    ): Dynamic => {
      let slice: Dynamic = String(input).slice(0, 56);
      let value2: Dynamic = slice;
      for (
        let count: Dynamic = 2;
        slideIndex(value2) >= 0 ||
        state.slides.has(value2) ||
        !validFileId.test(value2);
        count++
      )
        value2 = slice + "-" + count;
      return value2;
    };
    let checkSlideCapacity: Dynamic = (
      ..._extraArguments63: Dynamic[]
    ): Dynamic => {
      let index: Dynamic = 0;
      for (let value2 of state.slides.values()) if (!value2.removed) index++;
      if (index >= 64) fail("a deck holds at most 64 slides here");
    };
    let createSlideEntry: Dynamic = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
      value2?: Dynamic,
      argument?: Dynamic,
      ..._extraArguments64: Dynamic[]
    ): Dynamic => {
      let record: Dynamic = {
        id: input,
        text: value2,
        holder: context,
        el: options,
        last: null,
        removed: false,
        hadTbody: argument,
        made: true,
        born: state.n,
      };
      for (let value3 of [options, ...options.querySelectorAll("[style]")])
        if (value3.getAttribute("style") !== null)
          originalStyles.set(value3, value3.getAttribute("style"));
      record.last = state.text(record);
      state.slides.set(input, record);
      return record;
    };
    let api: Dynamic = {
      get slides(): Dynamic {
        return slides.map(
          (entry?: Dynamic, ..._extraArguments65: Dynamic[]): Dynamic => ({
            id: entry.id,
            title: entry.title,
          }),
        );
      },
      get current(): Dynamic {
        return currentId;
      },
      move(input: Dynamic, options: Dynamic): Dynamic {
        requireActiveReply();
        requireSlideId(input, "id");
        let value2: Dynamic = validatePlace(options);
        if ((value2.before || value2.after) === input)
          fail("a slide cannot be moved next to itself");
        let value3: Dynamic = slides.splice(slideIndex(input), 1)[0];
        insertSlide(value3, value2);
        queueOperation(
          Object.assign(
            {
              op: "move",
              id: input,
            },
            value2,
          ),
        );
      },
      remove(input: Dynamic): Dynamic {
        if (
          (requireActiveReply(),
          requireSlideId(input, "id"),
          input === currentId && !state)
        )
          fail('the current slide ("' + currentId + '") cannot be removed');
        if (state && slides.length <= 1)
          fail("the last slide of the deck cannot be removed");
        if (
          (slides.splice(slideIndex(input), 1),
          state && state.slides.has(input))
        )
          state.slides.get(input).removed = true;
        if (state && input === currentId) {
          if (
            ((state.currentRemoved = true),
            currentElement && currentElement.parentNode)
          )
            currentElement.parentNode.removeChild(currentElement);
        }
        queueOperation({
          op: "remove",
          id: input,
        });
      },
      duplicate(input: Dynamic, options: Dynamic): Dynamic {
        if (
          (requireActiveReply(),
          requireSlideId(input, "id"),
          options !== undefined)
        ) {
          if (typeof options !== "string" || !validFileId.test(options))
            fail("newId must be letters, digits, - or _ (at most 64)");
          if (slideIndex(options) >= 0 || (state && state.slides.has(options)))
            fail('a slide with the id "' + options + '" exists already');
        }
        if (!state) {
          slides.splice(slideIndex(input) + 1, 0, {
            id: options === undefined ? null : options,
            title: slides[slideIndex(input)].title,
          });
          queueOperation(
            options === undefined
              ? {
                  op: "duplicate",
                  id: input,
                }
              : {
                  op: "duplicate",
                  id: input,
                  newId: options,
                },
          );
          return;
        }
        checkSlideCapacity();
        let value2: Dynamic =
          input === currentId ? null : state.ensure(state.slides.get(input));
        if (value2 && !value2.made) state.touch(input);
        let value3: Dynamic =
          options === undefined ? mintSlideId(input + "-copy") : options;
        let value4: Dynamic = document.createElement("div");
        let value5: Dynamic = (value2 ? value2.el : currentElement).cloneNode(
          true,
        );
        if (value5.getAttribute("id") !== null)
          value5.setAttribute("id", value3);
        value4.appendChild(value5);
        let value6: Dynamic = createSlideEntry(
          value3,
          value5,
          value4,
          "",
          value2 ? value2.hadTbody : originalHadTbody,
        );
        slides.splice(slideIndex(input) + 1, 0, {
          id: value3,
          title: slides[slideIndex(input)].title,
        });
        queueOperation(
          options === undefined
            ? {
                op: "duplicate",
                id: input,
                newId: value3,
                minted: true,
              }
            : {
                op: "duplicate",
                id: input,
                newId: options,
              },
          value6,
        );
        return jquery(value5);
      },
      add(input: Dynamic, options: Dynamic): Dynamic {
        if ((requireActiveReply(), input && input.jquery))
          input = input[0] && input[0].outerHTML;
        else if (
          input &&
          typeof input === "object" &&
          typeof input.outerHTML === "string"
        )
          input = input.outerHTML;
        if (typeof input !== "string")
          fail("add(html) takes ONE <section …>…</section> as a string");
        if (((input = input.trim()), input.length > limits.maxHtml))
          fail("the new slide is over " + limits.maxHtml + " characters");
        if (!/^<section[\s>]/i.test(input))
          fail("the new slide must start with <section");
        if (state && state.currentRemoved && options === undefined)
          fail("say where: {before: id} or {after: id}");
        let value2: Dynamic = validatePlace(options, {
          after: currentId,
        });
        scratchElement.innerHTML = input;
        let children: Dynamic = scratchElement.children;
        let value3: Dynamic =
          children.length === 1 && children[0].tagName === "SECTION"
            ? children[0]
            : null;
        let value4: Dynamic = value3 && value3.getAttribute("id");
        if (((scratchElement.innerHTML = ""), !value3))
          fail("add(html) takes exactly one <section>");
        if (value4 !== null && value4 !== undefined) {
          if (!validFileId.test(value4))
            fail(
              "the new slide's id must be letters, digits, - or _ (at most 64)",
            );
          if (slideIndex(value4) >= 0 || (state && state.slides.has(value4)))
            fail('a slide with the id "' + value4 + '" exists already');
        }
        if (!state) {
          insertSlide(
            {
              id: value4 || null,
              title: "",
            },
            value2,
          );
          queueOperation(
            Object.assign(
              {
                op: "add",
                html: input,
              },
              value4
                ? {
                    id: value4,
                  }
                : {},
              value2,
            ),
          );
          return;
        }
        checkSlideCapacity();
        let value5: Dynamic = value4 || mintSlideId("slide");
        let value6: Dynamic = document.createElement("div");
        value6.innerHTML = input;
        let value7: Dynamic = createSlideEntry(
          value5,
          value6.querySelector("section"),
          value6,
          input,
          /<tbody[\s>]/i.test(input),
        );
        insertSlide(
          {
            id: value5,
            title: "",
          },
          value2,
        );
        queueOperation(
          Object.assign(
            {
              op: "add",
              html: input,
              id: value5,
            },
            value4
              ? {}
              : {
                  minted: true,
                },
            value2,
          ),
          value7,
        );
        return jquery(value7.el);
      },
    };
    if (state)
      Object.defineProperties(
        api,
        Object.getOwnPropertyDescriptors({
          slide(input: Dynamic): Dynamic {
            requireRunningReply();
            let filtered: Dynamic = [...state.slides.keys()].filter(
              (input2?: Dynamic, ..._extraArguments66: Dynamic[]): Dynamic =>
                !state.slides.get(input2).removed,
            );
            if (input === currentId && state.currentRemoved && currentId)
              fail("this slide was removed");
            if (
              typeof input !== "string" ||
              !state.slides.has(input) ||
              state.slides.get(input).removed
            )
              fail(
                "no slide with the id " +
                  JSON.stringify(input) +
                  "; the slides are: " +
                  filtered.join(", "),
              );
            if (input === currentId) return jquery(currentElement);
            let value2: Dynamic = state.ensure(state.slides.get(input));
            state.touch(input);
            return jquery(value2.el);
          },
          all(input: Dynamic): Dynamic {
            if (
              (requireRunningReply(),
              input !== undefined && typeof input !== "string")
            )
              fail("all(selector) takes a selector string, or nothing");
            let items: Dynamic = [];
            for (let value2 of slides) {
              let value3: Dynamic = value2.id && state.slides.get(value2.id);
              if (!value3 || value3.removed) continue;
              if (value2.id === currentId) {
                if (input === undefined) items.push(currentElement);
                else items.push(...jquery(document.body).find(input).toArray());
                continue;
              }
              if (
                (state.ensure(value3),
                state.touch(value2.id),
                input === undefined)
              )
                items.push(value3.el);
              else items.push(...jquery(value3.holder).find(input).toArray());
            }
            return jquery().pushStack(items);
          },
          get layouts(): Dynamic {
            return Object.keys(state.layouts);
          },
          layout(input: Dynamic): Dynamic {
            if (
              typeof input !== "string" ||
              !Object.prototype.hasOwnProperty.call(state.layouts, input)
            )
              fail(
                "no layout named " +
                  JSON.stringify(input) +
                  "; the layouts are: " +
                  Object.keys(state.layouts).join(", "),
              );
            return state.layouts[input];
          },
          title(input: Dynamic): Dynamic {
            if (input === undefined) return state.title;
            if (
              (requireActiveReply(),
              typeof input !== "string" || !input.trim() || input.length > 300)
            )
              fail("title(text) takes 1 to 300 characters");
            state.title = input.trim();
            queueOperation({
              op: "title",
              title: state.title,
            });
          },
          section(input: Dynamic, options: Dynamic): Dynamic {
            requireRunningReply();
            requireSlideId(input, "id");
            let index: Dynamic = state.sections.findIndex(
              (input2?: Dynamic, ..._extraArguments67: Dynamic[]): Dynamic =>
                input2.start === input,
            );
            let value2: Dynamic = (..._extraArguments68: Dynamic[]): Dynamic =>
              state.sections
                .map(
                  (
                    input2?: Dynamic,
                    ..._extraArguments69: Dynamic[]
                  ): Dynamic => input2.start,
                )
                .join(", ") || "(none)";
            let value3: Dynamic = (
              input2?: Dynamic,
              ..._extraArguments70: Dynamic[]
            ): Dynamic => {
              if (
                typeof input2 !== "string" ||
                !input2.trim() ||
                input2.length > 300
              )
                fail("a section title takes 1 to 300 characters");
              return input2.trim();
            };
            let value4: Dynamic = (
              input2?: Dynamic,
              ..._extraArguments71: Dynamic[]
            ): Dynamic =>
              Object.freeze({
                start: input2,
                get title(): Dynamic {
                  let match: Dynamic = state.sections.find(
                    (
                      input3?: Dynamic,
                      ..._extraArguments72: Dynamic[]
                    ): Dynamic => input3.start === input2,
                  );
                  return match ? match.title : undefined;
                },
                rename: Object.freeze(
                  (
                    input3?: Dynamic,
                    ..._extraArguments73: Dynamic[]
                  ): Dynamic => {
                    requireActiveReply();
                    let match: Dynamic = state.sections.find(
                      (
                        input4?: Dynamic,
                        ..._extraArguments74: Dynamic[]
                      ): Dynamic => input4.start === input2,
                    );
                    if (!match)
                      fail('no section starts at "' + input2 + '" any more');
                    match.title = value3(input3);
                    queueOperation({
                      op: "section",
                      action: "rename",
                      id: input2,
                      title: match.title,
                    });
                  },
                ),
                remove: Object.freeze(
                  (..._extraArguments75: Dynamic[]): Dynamic => {
                    requireActiveReply();
                    let index2: Dynamic = state.sections.findIndex(
                      (
                        input3?: Dynamic,
                        ..._extraArguments76: Dynamic[]
                      ): Dynamic => input3.start === input2,
                    );
                    if (index2 < 0)
                      fail('no section starts at "' + input2 + '" any more');
                    state.sections.splice(index2, 1);
                    queueOperation({
                      op: "section",
                      action: "remove",
                      id: input2,
                    });
                  },
                ),
              });
            if (arguments.length < 2 || options === undefined) {
              if (index < 0)
                fail(
                  'no section starts at "' +
                    input +
                    '"; sections start at: ' +
                    value2(),
                );
              return value4(input);
            }
            requireActiveReply();
            let value5: Dynamic = value3(options);
            if (index >= 0)
              fail(
                'a section already starts at "' +
                  input +
                  '"; use deck.section("' +
                  input +
                  '").rename(title)',
              );
            if (state.sections.length >= 64) fail("at most 64 sections");
            state.sections.push({
              start: input,
              title: value5,
            });
            queueOperation({
              op: "section",
              action: "start",
              id: input,
              title: value5,
            });
            return value4(input);
          },
          sections(): Dynamic {
            return state.sections
              .filter(
                (input?: Dynamic, ..._extraArguments77: Dynamic[]): Dynamic =>
                  slideIndex(input.start) >= 0,
              )
              .sort(
                (
                  input?: Dynamic,
                  options?: Dynamic,
                  ..._extraArguments78: Dynamic[]
                ): Dynamic =>
                  slideIndex(input.start) - slideIndex(options.start),
              )
              .map(
                (
                  input?: Dynamic,
                  ..._extraArguments79: Dynamic[]
                ): Dynamic => ({
                  start: input.start,
                  title: input.title,
                }),
              );
          },
          undo(): Dynamic {
            requireActiveReply();
            queueOperation({
              op: "undo",
            });
            state.halted = true;
          },
        }),
      );
    function requireRunningReply(..._extraArguments80: Dynamic[]): Dynamic {
      if (state && state.halted) fail("the reply ended at deck.undo()");
    }
    for (let value2 of ["move", "remove", "duplicate", "add"].concat(
      state
        ? ["slide", "all", "layout", "title", "undo", "section", "sections"]
        : [],
    ))
      Object.freeze(api[value2]);
    return Object.freeze(api);
  }
  function createProjectState(
    metadata?: Dynamic,
    sdk?: Dynamic,
    html?: Dynamic,
    ..._extraArguments81: Dynamic[]
  ): Dynamic {
    let state: Dynamic = {
      current: String(metadata.current),
      slides: new Map(),
      layouts: Object.create(null),
      title: "",
      ops: [],
      touched: new Set(),
      n: 0,
      logged: 0,
      logChars: 0,
      logCalls: 0,
      halted: false,
      order: (..._extraArguments82: Dynamic[]): Dynamic => [],
    };
    let texts: Dynamic = (sdk && sdk.texts) || {};
    for (let value3 of metadata.slides) {
      let value4: Dynamic = String(value3 && value3.id);
      if (validFileId.test(value4) && !state.slides.has(value4))
        state.slides.set(value4, {
          id: value4,
          text: typeof texts[value4] === "string" ? texts[value4] : "",
          holder: null,
          el: null,
          last: null,
          removed: false,
          hadTbody: true,
        });
    }
    if (state.current && !state.slides.has(state.current))
      state.slides.set(state.current, {
        id: state.current,
        text: "",
        holder: null,
        el: null,
        last: null,
        removed: false,
        hadTbody: true,
      });
    if (sdk && sdk.layouts && typeof sdk.layouts === "object") {
      for (let value3 of Object.keys(sdk.layouts))
        if (validFileId.test(value3) && typeof sdk.layouts[value3] === "string")
          state.layouts[value3] = sdk.layouts[value3];
    }
    if (sdk && typeof sdk.title === "string")
      state.title = sdk.title.slice(0, 300);
    state.sections = [];
    state.v3 = !!sdk && sdk.version === 3;
    state.paths = new Map();
    state.pathOf = new Map();
    state.kOf = new WeakMap();
    state.elOf = new Map();
    state.kN = 0;
    state.rows = [];
    state.currentRemoved = false;
    state.goneMsg = "deck: this slide was removed";
    let value2: Dynamic = (..._extraArguments83: Dynamic[]): Dynamic => {
      throw Error(state.goneMsg);
    };
    if (
      ((state.ghost = new Proxy(
        function (..._extraArguments84: Dynamic[]): Dynamic {},
        {
          get: (
            input?: Dynamic,
            options?: Dynamic,
            ..._extraArguments85: Dynamic[]
          ): Dynamic =>
            typeof options === "symbol" || options === "then"
              ? undefined
              : value2(),
          set: value2,
          has: value2,
          apply: value2,
          construct: value2,
        },
      )),
      sdk && Array.isArray(sdk.sections))
    ) {
      for (let value3 of sdk.sections)
        if (
          value3 &&
          state.slides.has(String(value3.start)) &&
          typeof value3.title === "string" &&
          !state.sections.some(
            (input?: Dynamic, ..._extraArguments86: Dynamic[]): Dynamic =>
              input.start === value3.start,
          )
        )
          state.sections.push({
            start: String(value3.start),
            title: value3.title.slice(0, 300),
          });
    }
    state.ensure = (
      entry?: Dynamic,
      ..._extraArguments87: Dynamic[]
    ): Dynamic => {
      if (entry.holder) return entry;
      let value3: Dynamic = document.createElement("div");
      value3.innerHTML = entry.text;
      let element: Dynamic = value3.querySelector("section");
      if (!element)
        throw Error('deck: the slide "' + entry.id + '" has no <section>');
      entry.holder = value3;
      entry.el = element;
      entry.hadTbody = /<tbody[\s>]/i.test(entry.text);
      for (let value4 of [element, ...element.querySelectorAll("[style]")])
        if (value4.getAttribute("style") !== null)
          originalStyles.set(value4, value4.getAttribute("style"));
      entry.last = state.text(entry);
      return entry;
    };
    state.text = (
      entry?: Dynamic,
      ..._extraArguments88: Dynamic[]
    ): Dynamic => {
      let element: Dynamic = entry.holder.querySelector("section");
      if (!element) {
        entry.holder.innerHTML = entry.last;
        element = entry.holder.querySelector("section");
        entry.el = element;
        for (let value4 of [element, ...element.querySelectorAll("[style]")])
          if (value4.getAttribute("style") !== null)
            originalStyles.set(value4, value4.getAttribute("style"));
        throw Error(
          'the <section> of the slide "' + entry.id + '" was removed; restored',
        );
      }
      entry.el = element;
      let value3: Dynamic = serializeElement(element);
      return entry.hadTbody ? value3 : value3.replace(/<\/?tbody>/g, "");
    };
    state.touch = (
      input?: Dynamic,
      ..._extraArguments89: Dynamic[]
    ): Dynamic => {
      if (
        input !== state.current &&
        !state.touched.has(input) &&
        !(state.slides.get(input) || {}).made
      ) {
        state.touched.add(input);
        emit({
          kind: "touch" as const,
          seq: sequence++,
          n: state.n,
          slideId: input,
        });
      }
    };
    state.log = Object.freeze(function (
      input?: Dynamic,
      ..._extraArguments90: Dynamic[]
    ): Dynamic {
      let value3: Dynamic;
      try {
        if (input && input.jquery)
          value3 = input
            .toArray()
            .map(
              (input2?: Dynamic, ..._extraArguments91: Dynamic[]): Dynamic =>
                input2 && typeof input2.outerHTML === "string"
                  ? input2.outerHTML
                  : String(
                      input2 && input2.textContent !== undefined
                        ? input2.textContent
                        : input2,
                    ),
            ).join(`
`);
        else if (
          input &&
          typeof input === "object" &&
          typeof input.outerHTML === "string"
        )
          value3 = input.outerHTML;
        else if (typeof input === "string") value3 = input;
        else if (input !== null && typeof input === "object") {
          if (((value3 = JSON.stringify(input)), value3 === undefined))
            value3 = String(input);
        } else value3 = String(input);
      } catch (value5: Dynamic) {
        value3 = String(input);
      }
      let count: Dynamic = 12000;
      let count2: Dynamic = 24576;
      let count3: Dynamic = 12;
      let value4: Dynamic = value3.length > count;
      if (state.logCalls >= count3)
        throw Error(
          "log: at most " +
            count3 +
            " values in one run; end the reply and read what you have",
        );
      if (value4) value3 = value3.slice(0, count);
      if (state.logChars + value3.length > count2)
        throw Error(
          "log: over 24 KB of values in this run; end the reply and read what you have",
        );
      state.logChars += value3.length;
      state.logged++;
      state.logCalls++;
      emit({
        kind: "log" as const,
        n: state.n,
        message: value3,
        cut: value4,
      });
    });
    return state;
  }
  function initializeFileSdk(
    metadata?: Dynamic,
    sdk?: Dynamic,
    ..._extraArguments92: Dynamic[]
  ): Dynamic {
    let state: Dynamic = project;
    let container: Dynamic = document.body;
    let documentRoot: Dynamic = document.documentElement;
    let head: Dynamic = document.head;
    let currentFileId: Dynamic = String(metadata.current || "");
    if (sdk.paths) {
      for (let value23 of Object.keys(sdk.paths))
        if (
          state.slides.has(value23) &&
          typeof sdk.paths[value23] === "string"
        ) {
          state.paths.set(sdk.paths[value23], value23);
          state.pathOf.set(value23, sdk.paths[value23]);
        }
    }
    state.one = true;
    state.current = "";
    state.currentRemoved = true;
    state.entryOf = new WeakMap();
    state.origId = new WeakMap();
    state.copyOf = new WeakMap();
    state.whereOf = new WeakMap();
    state.opsLeft = 24;
    state.retired = new Set();
    container.innerHTML = "";
    container.setAttribute("id", "container");
    let value2: Dynamic = [...state.slides.values()]
      .map(
        (input?: Dynamic, ..._extraArguments93: Dynamic[]): Dynamic =>
          input.text,
      )
      .concat(
        Object.keys(state.layouts).map(
          (input?: Dynamic, ..._extraArguments94: Dynamic[]): Dynamic =>
            state.layouts[input],
        ),
      );
    state.P = "k";
    while (
      value2.some(
        (input?: Dynamic, ..._extraArguments95: Dynamic[]): Dynamic =>
          new RegExp(`id\\s*=\\s*["']?` + state.P + "\\d").test(input),
      )
    )
      state.P =
        "k" +
        Math.random()
          .toString(36)
          .replace(/[^a-z]/g, "")
          .slice(0, 2)
          .padEnd(2, "q");
    let value3: Dynamic = (
      input?: Dynamic,
      ..._extraArguments96: Dynamic[]
    ): Dynamic =>
      typeof input === "string" &&
      input.startsWith(state.P) &&
      /^\d{1,6}$/.test(input.slice(state.P.length));
    let value4: Dynamic = (
      input?: Dynamic,
      ..._extraArguments97: Dynamic[]
    ): Dynamic => {
      for (let value23 of [input, ...input.querySelectorAll("[style]")])
        if (value23.getAttribute("style") !== null)
          originalStyles.set(value23, value23.getAttribute("style"));
    };
    let value5: Dynamic = (
      input?: Dynamic,
      options?: Dynamic,
      ..._extraArguments98: Dynamic[]
    ): Dynamic => {
      input.el = options;
      input.holder = container;
      state.entryOf.set(options, input);
      value4(options);
    };
    for (let value23 of state.slides.values()) {
      let value24: Dynamic = document.createElement("div");
      value24.innerHTML = value23.text;
      let value25: Dynamic =
        value24.children.length === 1 && value23.id !== "container"
          ? value24.children[0]
          : null;
      if (!value25) {
        emitError(
          'the file "' +
            value23.id +
            '" must be ONE element (it has ' +
            value24.children.length +
            ")",
          "",
        );
        value23.removed = true;
        continue;
      }
      value23.rootId = value25.getAttribute("id");
      value23.hadTbody = /<tbody[\s>]/i.test(value23.text);
      value23.hadSection = value25.getAttribute("data-section") !== null;
      value23.section = null;
      value25.setAttribute("id", value23.id);
      value23.idAt = [...value25.attributes].findIndex(
        (input?: Dynamic, ..._extraArguments99: Dynamic[]): Dynamic =>
          input.name === "id",
      );
      container.appendChild(value25);
      value5(value23, value25);
      for (let value26 of value25.querySelectorAll("[id]"))
        if (state.slides.has(value26.getAttribute("id"))) {
          state.origId.set(value26, value26.getAttribute("id"));
          value26.removeAttribute("id");
        }
    }
    for (let value23 of state.sections) {
      let entry: Dynamic = state.slides.get(value23.start);
      if (entry && !entry.removed) {
        if (((entry.section = value23.title), !entry.hadSection))
          entry.el.setAttribute("data-section", value23.title);
      }
    }
    let value6: Dynamic = (..._extraArguments100: Dynamic[]): Dynamic =>
      [...container.children]
        .map(
          (input?: Dynamic, ..._extraArguments101: Dynamic[]): Dynamic =>
            state.entryOf.get(input),
        )
        .filter(
          (input?: Dynamic, ..._extraArguments102: Dynamic[]): Dynamic =>
            input && !input.removed,
        )
        .map(
          (entry?: Dynamic, ..._extraArguments103: Dynamic[]): Dynamic =>
            entry.id,
        );
    state.order = value6;
    state.fileOf = (
      input?: Dynamic,
      ..._extraArguments104: Dynamic[]
    ): Dynamic => {
      let value23: Dynamic = input;
      while (value23 && value23.parentNode && value23.parentNode !== container)
        value23 = value23.parentNode;
      let value24: Dynamic =
        value23 && value23.parentNode === container
          ? state.entryOf.get(value23)
          : null;
      return value24 && !value24.removed ? value24.id : null;
    };
    state.used = new Set();
    state.started = false;
    state.assign = (..._extraArguments105: Dynamic[]): Dynamic => {
      let unhandledElements: Dynamic = [];
      for (let fileElement of container.children) {
        let fileEntry: Dynamic = state.entryOf.get(fileElement);
        if (!fileEntry || fileEntry.removed) continue;
        for (let element of fileElement.querySelectorAll("*")) {
          let oldHandle: Dynamic = state.kOf.get(element);
          let elementId: Dynamic = element.getAttribute("id");
          if (
            oldHandle !== undefined &&
            elementId !== null &&
            elementId !== oldHandle &&
            value3(elementId) &&
            !state.used.has(elementId) &&
            /^[1-9]/.test(elementId.slice(state.P.length))
          ) {
            state.used.add(elementId);
            state.elOf.delete(oldHandle);
            state.kOf.set(element, elementId);
            state.elOf.set(elementId, element);
            state.rehandled.add(fileEntry.id);
            continue;
          }
          if (oldHandle !== undefined) {
            if (elementId === oldHandle) continue;
            if (
              elementId === null ||
              (value3(elementId) && state.elOf.get(elementId) !== element)
            ) {
              element.setAttribute("id", oldHandle);
              continue;
            }
            state.kOf.delete(element);
            state.elOf.delete(oldHandle);
            state.rehandled.add(fileEntry.id);
            continue;
          }
          if (
            elementId !== null &&
            !(value3(elementId) && state.elOf.get(elementId) !== element)
          )
            continue;
          if (
            elementId !== null &&
            state.started &&
            !state.used.has(elementId) &&
            /^[1-9]/.test(elementId.slice(state.P.length))
          ) {
            state.used.add(elementId);
            state.kOf.set(element, elementId);
            state.elOf.set(elementId, element);
            state.rows.push(element);
            state.rehandled.add(fileEntry.id);
            continue;
          }
          unhandledElements.push([element, fileEntry]);
        }
      }
      for (let [fileElement, fileEntry] of unhandledElements) {
        let element: Dynamic;
        do element = state.P + ++state.kN;
        while (state.used.has(element));
        state.used.add(element);
        fileElement.setAttribute("id", element);
        state.kOf.set(fileElement, element);
        state.elOf.set(element, fileElement);
        state.rows.push(fileElement);
        state.rehandled.add(fileEntry.id);
      }
    };
    state.clean = (
      entry?: Dynamic,
      ..._extraArguments106: Dynamic[]
    ): Dynamic => {
      serializeElement(entry.el);
      let clone2: Dynamic = entry.el.cloneNode(true);
      let elements: Dynamic = [entry.el, ...entry.el.querySelectorAll("*")];
      let clonedElements: Dynamic = [clone2, ...clone2.querySelectorAll("*")];
      if (
        (elements.forEach(
          (
            input?: Dynamic,
            options?: Dynamic,
            ..._extraArguments107: Dynamic[]
          ): Dynamic => {
            if (!clonedElements[options] || options === 0) return;
            if (state.origId.has(input))
              clonedElements[options].setAttribute(
                "id",
                state.origId.get(input),
              );
            else if (
              state.kOf.get(input) !== undefined &&
              clonedElements[options].getAttribute("id") ===
                state.kOf.get(input)
            )
              clonedElements[options].removeAttribute("id");
            else if (value3(clonedElements[options].getAttribute("id")))
              clonedElements[options].removeAttribute("id");
          },
        ),
        entry.rootId === null || entry.rootId === undefined)
      ) {
        if (entry.made) clone2.setAttribute("id", entry.id);
        else clone2.removeAttribute("id");
      } else clone2.setAttribute("id", entry.rootId);
      if (!entry.hadSection) clone2.removeAttribute("data-section");
      let html: Dynamic = clone2.outerHTML;
      return entry.hadTbody ? html : html.replace(/<\/?tbody>/g, "");
    };
    state.text = state.clean;
    state.ensure = (
      input?: Dynamic,
      ..._extraArguments108: Dynamic[]
    ): Dynamic => input;
    state.view = (id?: Dynamic, ..._extraArguments109: Dynamic[]): Dynamic => {
      let entry: Dynamic = state.slides.get(id);
      if (!entry || entry.removed) return null;
      serializeElement(entry.el);
      let outerHTML: Dynamic = entry.el.outerHTML;
      return entry.hadTbody
        ? outerHTML
        : outerHTML.replace(/<(\/?)tbody( id="[^"]*")?>/g, "");
    };
    state.list = (
      since?: Dynamic,
      ..._extraArguments110: Dynamic[]
    ): Dynamic => {
      let rows: Dynamic = [];
      for (let element of state.rows) {
        let handle: Dynamic = state.kOf.get(element);
        if (handle === undefined || +handle.slice(state.P.length) <= since)
          continue;
        let fileId: Dynamic = state.fileOf(element);
        if (fileId)
          rows.push({
            k: handle,
            file: fileId,
            tag: element.tagName
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "")
              .slice(0, 20),
            words: truncate(
              (element.textContent || "").replace(/\s+/g, " ").trim(),
              40,
            ),
          });
        if (rows.length >= 4000) break;
      }
      return rows;
    };
    state.attr = "id";
    state.seen = (
      elements?: Dynamic,
      ..._extraArguments111: Dynamic[]
    ): Dynamic => {
      if (state.previewing) return elements;
      for (
        let index: Dynamic = 0;
        index < elements.length && index < 200;
        index++
      ) {
        let fileId: Dynamic =
          elements[index] && elements[index].nodeType === 1
            ? state.fileOf(elements[index])
            : null;
        if (
          fileId &&
          !state.touched.has(fileId) &&
          !state.slides.get(fileId).made
        ) {
          state.touched.add(fileId);
          emit({
            kind: "touch" as const,
            seq: sequence++,
            n: state.n,
            slideId: fileId,
          });
        }
      }
      return elements;
    };
    let find: Dynamic = jquery.find;
    jquery.find = Object.assign(function (
      this: Dynamic,
      ..._extraArguments112: Dynamic[]
    ): Dynamic {
      return state.seen(find.apply(this, arguments));
    }, find);
    let clone: Dynamic = jquery.fn.clone;
    jquery.fn.clone = function (
      this: Dynamic,
      ..._extraArguments113: Dynamic[]
    ): Dynamic {
      let value23: Dynamic = clone.apply(this, arguments);
      this.each(
        (
          input?: Dynamic,
          options?: Dynamic,
          ..._extraArguments114: Dynamic[]
        ): Dynamic => {
          let entry: Dynamic = state.entryOf.get(options);
          if (entry && !entry.removed && value23[input]) {
            if ((state.copyOf.set(value23[input], entry.id), !entry.hadSection))
              value23[input].removeAttribute("data-section");
          }
        },
      );
      return value23;
    };
    let value7: Dynamic = (
      input?: Dynamic,
      options?: Dynamic,
      ..._extraArguments115: Dynamic[]
    ): Dynamic => {
      if (input === container) throw Error("#container keeps its id");
      let entry: Dynamic = state.entryOf.get(input);
      if (
        entry &&
        !entry.removed &&
        input.parentNode === container &&
        options !== entry.id
      )
        throw Error(
          'a file keeps its id ("' +
            entry.id +
            '"); clone it and give the COPY a new id',
        );
    };
    jquery.attrHooks.id = {
      set: (
        input?: Dynamic,
        options?: Dynamic,
        ..._extraArguments116: Dynamic[]
      ): Dynamic => {
        value7(input, String(options));
        input.setAttribute("id", String(options));
        return options;
      },
    };
    let removeAttr: Dynamic = jquery.fn.removeAttr;
    jquery.fn.removeAttr = function (
      this: Dynamic,
      input?: Dynamic,
      ..._extraArguments117: Dynamic[]
    ): Dynamic {
      if (/(^|\s)id(\s|$)/i.test(String(input)))
        this.each(
          (
            input2?: Dynamic,
            options?: Dynamic,
            ..._extraArguments118: Dynamic[]
          ): Dynamic => value7(options, null),
        );
      return removeAttr.apply(this, arguments);
    };
    let value8: Dynamic = (
      input?: Dynamic,
      ..._extraArguments119: Dynamic[]
    ): Dynamic => {
      for (let index: Dynamic = 0; index < input.length; index++)
        if (
          input[index] === container ||
          input[index] === documentRoot ||
          input[index] === head
        )
          throw Error(
            "change the files, not the page: $('#id')… for one file, $('body > *')… for all of them",
          );
    };
    for (let value23 of ["empty", "replaceWith", "remove", "detach"]) {
      let value24: Dynamic = jquery.fn[value23];
      jquery.fn[value23] = function (
        this: Dynamic,
        ..._extraArguments120: Dynamic[]
      ): Dynamic {
        value8(this);
        return value24.apply(this, arguments);
      };
    }
    for (let value23 of ["html", "text"]) {
      let value24: Dynamic = jquery.fn[value23];
      jquery.fn[value23] = function (
        this: Dynamic,
        ..._extraArguments121: Dynamic[]
      ): Dynamic {
        if (arguments.length) value8(this);
        return value24.apply(this, arguments);
      };
    }
    for (let value23 of ["write", "writeln", "open", "close"])
      document[value23] = (..._extraArguments122: Dynamic[]): Dynamic => {
        throw Error(
          "document." + value23 + " is not available: change the elements",
        );
      };
    document.title = state.title;
    state.rehandled = new Set();
    state.assign();
    state.rehandled.clear();
    state.kN += 1e5;
    state.started = true;
    for (let value23 of state.slides.values())
      if (!value23.removed) {
        value23.last = state.clean(value23);
        value23.raw = value23.el.outerHTML;
      }
    state.prev = value6();
    state.settle = (..._extraArguments123: Dynamic[]): Dynamic => {
      let operations: Dynamic = [];
      let frames: Dynamic = [];
      let problems: Dynamic = [];
      if (document.documentElement !== documentRoot) {
        try {
          document.replaceChild(documentRoot, document.documentElement);
        } catch (expectedOrder: Dynamic) {}
        problems.push("the document element cannot be replaced; put back");
      }
      if (head && head.parentNode !== documentRoot) {
        documentRoot.insertBefore(head, documentRoot.firstChild);
        problems.push("head cannot be removed; put back");
      }
      if (container.getAttribute("id") !== "container") {
        container.setAttribute("id", "container");
        problems.push("#container keeps its id; put back");
      }
      if (container.parentNode !== documentRoot) {
        for (let expectedOrder of [...documentRoot.children])
          if (expectedOrder.tagName === "BODY" && expectedOrder !== container)
            documentRoot.removeChild(expectedOrder);
        documentRoot.appendChild(container);
        problems.push("body cannot be replaced; put back");
      }
      let restoreOrder: Dynamic = (
        input?: Dynamic,
        ..._extraArguments124: Dynamic[]
      ): Dynamic => {
        for (let value24 of input)
          container.appendChild(state.slides.get(value24).el);
      };
      let rollbackStructure: Dynamic = (
        input?: Dynamic,
        options: Dynamic = "; the files are as they were",
        ..._extraArguments125: Dynamic[]
      ): Dynamic => {
        for (let value24 of [...container.children])
          if (!state.entryOf.get(value24) || state.entryOf.get(value24).removed)
            container.removeChild(value24);
        restoreOrder(state.prev);
        problems.push(input + options);
      };
      let children: Dynamic = [...container.children];
      let newElements: Dynamic = [];
      let activeEntry: Dynamic = (
        input?: Dynamic,
        ..._extraArguments126: Dynamic[]
      ): Dynamic => {
        let entry: Dynamic = state.slides.get(input);
        return entry && !entry.removed ? entry : null;
      };
      for (let expectedOrder of children) {
        let mintId: Dynamic = state.entryOf.get(expectedOrder);
        let actualOrder: Dynamic = expectedOrder.getAttribute("id");
        if (mintId && !mintId.removed) {
          if (actualOrder !== mintId.id) {
            if (actualOrder !== null)
              expectedOrder.setAttribute("id", mintId.id);
            else {
              let mapped: Dynamic = [...expectedOrder.attributes].map(
                (
                  input?: Dynamic,
                  ..._extraArguments127: Dynamic[]
                ): Dynamic => [input.name, input.value],
              );
              for (let [value25] of mapped)
                expectedOrder.removeAttribute(value25);
              mapped.splice(Math.min(mintId.idAt, mapped.length), 0, [
                "id",
                mintId.id,
              ]);
              for (let [value25, value26] of mapped)
                expectedOrder.setAttribute(value25, value26);
            }
            problems.push('a file keeps its id ("' + mintId.id + '")');
          }
          continue;
        }
        let value24: Dynamic = actualOrder !== null && activeEntry(actualOrder);
        if (value24 && value24.el.parentNode !== container) {
          value5(value24, expectedOrder);
          continue;
        }
        newElements.push(expectedOrder);
      }
      let removedIds: Dynamic = state.prev.filter(
        (input?: Dynamic, ..._extraArguments128: Dynamic[]): Dynamic =>
          activeEntry(input) && activeEntry(input).el.parentNode !== container,
      );
      let PLAIN_FILE_ID: Dynamic = /^[A-Za-z][A-Za-z0-9_-]{0,23}$/;
      let RESERVED_HANDLE_ID: Dynamic = /^k[a-z]{0,2}\d{1,6}$/;
      let RESERVED_NAMES: Dynamic = [
        "container",
        "constructor",
        "prototype",
        "__proto__",
        "body",
        "html",
        "head",
      ];
      let proposedId: Dynamic = (
        element?: Dynamic,
        ..._extraArguments129: Dynamic[]
      ): Dynamic => {
        let attribute: Dynamic = element.getAttribute("id");
        return attribute === state.copyOf.get(element) ? null : attribute;
      };
      let validateNewFileId: Dynamic = (
        input?: Dynamic,
        ..._extraArguments130: Dynamic[]
      ): Dynamic => {
        let value24: Dynamic = proposedId(input);
        let value25: Dynamic = value24 !== null && state.slides.get(value24);
        let value26: Dynamic = (
          input2?: Dynamic,
          options?: Dynamic,
          ..._extraArguments131: Dynamic[]
        ): Dynamic => [
          options,
          Object.assign(
            {
              code: input2,
            },
            input2 !== "not_plain" && validFileId.test(value24)
              ? {
                  id: value24,
                }
              : {},
          ),
        ];
        return value24 === null
          ? null
          : value25 && value25.removed && value25.el
            ? value26(
                "removed",
                "#" +
                  value24 +
                  " was removed earlier in this reply; its id is free again in the next reply.",
              )
            : value25
              ? value26(
                  "exists",
                  "#" +
                    value24 +
                    " exists. Write to it to change it, or pick another id.",
                )
              : RESERVED_NAMES.includes(value24.toLowerCase()) ||
                  RESERVED_HANDLE_ID.test(value24)
                ? value26(
                    "own",
                    "#" +
                      value24 +
                      " is one of the page's own names. Pick another id.",
                  )
                : PLAIN_FILE_ID.test(value24)
                  ? null
                  : value26(
                      "not_plain",
                      "#" +
                        truncate(
                          value24.replace(
                            /[\x00-\x1f\x7f-\x9f\u2028\u2029]/g,
                            "",
                          ),
                          24,
                        ) +
                        " cannot be an id (letters, digits, - and _; a letter first; 24 at most). Pick another id.",
                    );
      };
      let idProblem: Dynamic = newElements.map(validateNewFileId).find(Boolean);
      let newFileCount: Dynamic = newElements.length;
      if (idProblem) {
        rollbackStructure(
          idProblem[0],
          " Nothing was added; other changes stand; the rest of the reply was not run.",
        );
        problems.push([problems.pop(), idProblem[1]]);
        state.halted = true;
      } else if (
        state.prev.length - removedIds.length + newElements.length >
        512
      )
        rollbackStructure("at most 512 files");
      else if (newFileCount > state.opsLeft)
        rollbackStructure(
          "this would make " +
            newFileCount +
            " new file" +
            (newFileCount === 1 ? "" : "s") +
            ", and " +
            state.opsLeft +
            " structural change" +
            (state.opsLeft === 1 ? " is" : "s are") +
            " left in this run (a remove is free)",
        );
      else {
        for (let value24 of removedIds) {
          let value25: Dynamic = activeEntry(value24);
          value25.removed = true;
          operations.push({
            op: "remove",
            id: value24,
          });
        }
        let expectedOrder: Dynamic = state.prev.filter(
          (input?: Dynamic, ..._extraArguments132: Dynamic[]): Dynamic =>
            !removedIds.includes(input),
        );
        let mintId: Dynamic = (
          input?: Dynamic,
          options?: Dynamic,
          ..._extraArguments133: Dynamic[]
        ): Dynamic => {
          if (proposedId(input) !== null) return [proposedId(input), false];
          let value24: Dynamic = options
            ? (/^[A-Za-z]/.test(options) ? options.slice(0, 16) : "file") +
              "-copy"
            : "new";
          let value25: Dynamic = value24;
          for (
            let count: Dynamic = 2;
            state.slides.has(value25) || !PLAIN_FILE_ID.test(value25);
            count++
          )
            value25 = value24 + "-" + count;
          return [value25, true];
        };
        for (let value24 of [...container.children]) {
          if (!newElements.includes(value24)) continue;
          let value25: Dynamic =
            state.copyOf.get(value24) && activeEntry(state.copyOf.get(value24))
              ? state.copyOf.get(value24)
              : null;
          let [value26, value27]: Dynamic = mintId(value24, value25);
          value24.setAttribute("id", value26);
          let record2: Dynamic = {
            id: value26,
            text: "",
            holder: container,
            el: value24,
            last: null,
            removed: false,
            hadTbody: value25
              ? state.slides.get(value25).hadTbody
              : /<tbody[\s>]/i.test(value24.outerHTML),
            made: true,
            born: state.n,
            rootId: null,
            section: null,
            hadSection: false,
            raw: null,
            title: value25 ? state.slides.get(value25).title : "",
          };
          state.slides.set(value26, record2);
          value5(record2, value24);
          let value28: Dynamic =
            value24.previousElementSibling &&
            state.fileOf(value24.previousElementSibling);
          let value29: Dynamic =
            value24.nextElementSibling &&
            state.fileOf(value24.nextElementSibling);
          let entry: Dynamic = state.whereOf.get(value24);
          let value30: Dynamic = value25
            ? {
                op: "duplicate",
                id: value25,
                newId: value26,
              }
            : Object.assign(
                {
                  op: "add",
                  html: "",
                  id: value26,
                },
                entry
                  ? {
                      where: entry,
                    }
                  : value28
                    ? {
                        after: value28,
                      }
                    : value29
                      ? {
                          before: value29,
                        }
                      : {},
              );
          if (value25 && entry) value30.where = entry;
          if (value27) value30.minted = true;
          if (
            (operations.push(value30),
            (record2.op = value30),
            (record2.src = value25),
            value25)
          )
            expectedOrder.splice(
              expectedOrder.indexOf(value25) + 1,
              0,
              value26,
            );
          else if (value28 && expectedOrder.includes(value28))
            expectedOrder.splice(
              expectedOrder.indexOf(value28) + 1,
              0,
              value26,
            );
          else if (value29 && expectedOrder.includes(value29))
            expectedOrder.splice(expectedOrder.indexOf(value29), 0, value26);
          else expectedOrder.push(value26);
        }
        let actualOrder: Dynamic = value6();
        if (actualOrder.join() !== expectedOrder.join()) {
          let match: Dynamic = actualOrder.find(
            (input?: Dynamic, ..._extraArguments134: Dynamic[]): Dynamic =>
              actualOrder
                .filter(
                  (
                    input2?: Dynamic,
                    ..._extraArguments135: Dynamic[]
                  ): Dynamic => input2 !== input,
                )
                .join() ===
              expectedOrder
                .filter(
                  (
                    input2?: Dynamic,
                    ..._extraArguments136: Dynamic[]
                  ): Dynamic => input2 !== input,
                )
                .join(),
          );
          let value24: Dynamic = actualOrder.indexOf(match);
          operations.push(
            match !== undefined && actualOrder.length > 1
              ? Object.assign(
                  {
                    op: "move",
                    id: match,
                  },
                  value24 > 0
                    ? {
                        after: actualOrder[value24 - 1],
                      }
                    : {
                        before: actualOrder[1],
                      },
                )
              : {
                  op: "order",
                  ids: actualOrder,
                },
          );
        }
        state.prev = actualOrder;
      }
      state.assign();
      for (let expectedOrder of state.prev) {
        let mintId: Dynamic = state.slides.get(expectedOrder);
        if (mintId.el.outerHTML === mintId.raw) continue;
        let value24: Dynamic;
        try {
          value24 = state.clean(mintId);
        } catch (value25: Dynamic) {
          problems.push(String(value25));
          continue;
        }
        if (
          ((mintId.raw = mintId.el.outerHTML),
          mintId.born === state.n && mintId.op)
        ) {
          if (value24.length > limits.maxHtml) {
            problems.push(
              'the text of the file "' +
                expectedOrder +
                '" is over ' +
                limits.maxHtml +
                " characters; not sent",
            );
            continue;
          }
          if (((mintId.last = value24), mintId.op.op === "add"))
            mintId.op.html = value24;
          else {
            let entry: Dynamic = state.slides.get(mintId.src);
            let value25: Dynamic =
              entry.rootId === null
                ? entry.last.replace(
                    /^(<[a-z][a-z0-9-]*)/i,
                    '$1 id="' + expectedOrder + '"',
                  )
                : entry.last.replace(
                    'id="' + entry.rootId + '"',
                    'id="' + expectedOrder + '"',
                  );
            if (value24 !== value25) mintId.op.html = value24;
          }
          continue;
        }
        if (value24 === mintId.last) continue;
        if (value24.length > limits.maxHtml) {
          problems.push(
            'the text of the file "' +
              expectedOrder +
              '" is over ' +
              limits.maxHtml +
              " characters; not sent",
          );
          continue;
        }
        mintId.last = value24;
        frames.push({
          id: expectedOrder,
          html: value24,
        });
      }
      for (let expectedOrder of state.prev) {
        let mintId: Dynamic = state.slides.get(expectedOrder);
        if (mintId.born === state.n && mintId.op && mintId.last === null) {
          if (
            ((mintId.last = state.clean(mintId)),
            (mintId.raw = mintId.el.outerHTML),
            mintId.op.op === "add")
          )
            mintId.op.html = mintId.last;
        }
      }
      let value23: Dynamic = String(document.title || "");
      if (value23 !== state.title)
        if (value23.trim() && value23.length <= 300) {
          state.title = value23;
          operations.push({
            op: "title",
            title: value23.trim(),
          });
        } else {
          document.title = state.title;
          problems.push("the title takes 1 to 300 characters");
        }
      for (let expectedOrder of state.prev) {
        let mintId: Dynamic = state.slides.get(expectedOrder);
        if (mintId.hadSection) continue;
        let actualOrder: Dynamic = mintId.el.getAttribute("data-section");
        let section: Dynamic = mintId.section;
        if (actualOrder === section) continue;
        if (
          actualOrder !== null &&
          (!actualOrder.trim() || actualOrder.length > 300)
        ) {
          if (section === null) mintId.el.removeAttribute("data-section");
          else mintId.el.setAttribute("data-section", section);
          problems.push("a section title takes 1 to 300 characters");
          continue;
        }
        mintId.section = actualOrder;
        operations.push(
          actualOrder === null
            ? {
                op: "section",
                action: "remove",
                id: expectedOrder,
              }
            : {
                op: "section",
                action: section === null ? "start" : "rename",
                id: expectedOrder,
                title: actualOrder.trim(),
              },
        );
        mintId.raw = mintId.el.outerHTML;
      }
      let removalCount: Dynamic = operations.filter(
        (input?: Dynamic, ..._extraArguments137: Dynamic[]): Dynamic =>
          input.op === "remove",
      ).length;
      if (operations.length - removalCount > state.opsLeft) {
        problems.push(
          "at most 24 structural changes in one run (a remove is free)",
        );
        operations.length = removalCount + state.opsLeft;
      }
      state.opsLeft -= operations.length - removalCount;
      return {
        frames: frames,
        ops: operations,
        problems: problems,
      };
    };
    let value9: Dynamic = (
      input?: Dynamic,
      ..._extraArguments138: Dynamic[]
    ): Dynamic => {
      let entry: Dynamic = state.slides.get(input);
      return Object.freeze({
        id: input,
        path: state.pathOf.has(input) ? state.pathOf.get(input) : null,
        title: (entry && entry.title) || "",
      });
    };
    for (let value23 of metadata.slides) {
      let entry: Dynamic = state.slides.get(String(value23 && value23.id));
      if (entry)
        entry.title = String((value23 && value23.title) || "").slice(0, 300);
    }
    let value10: Dynamic = (..._extraArguments139: Dynamic[]): Dynamic =>
      state.order().join(", ");
    let value11: Dynamic = (
      input?: Dynamic,
      ..._extraArguments140: Dynamic[]
    ): Dynamic => {
      let value23: Dynamic =
        typeof input === "string" && state.paths.has(input)
          ? state.paths.get(input)
          : input;
      let value24: Dynamic =
        typeof value23 === "string" ? state.slides.get(value23) : null;
      if (!value24 || value24.removed || value24.el.parentNode !== container)
        throw Error(
          "no file " +
            JSON.stringify(input === undefined ? null : input).slice(0, 80) +
            (value10()
              ? "; the files are: " + value10()
              : "; there is no file yet"),
        );
      return value24;
    };
    let value12: Dynamic = (
      input?: Dynamic,
      entry?: Dynamic,
      ..._extraArguments141: Dynamic[]
    ): Dynamic =>
      Object.defineProperties(input, {
        id: {
          value: entry.id,
        },
        path: {
          value: value9(entry.id).path,
        },
        title: {
          value: value9(entry.id).title,
        },
      });
    let value13: Dynamic = (
      input?: Dynamic,
      ..._extraArguments142: Dynamic[]
    ): Dynamic => {
      let value23: Dynamic = value11(input);
      return value12(state.seen(jquery(value23.el)), value23);
    };
    let value14: Dynamic = (..._extraArguments143: Dynamic[]): Dynamic =>
      state.seen(
        jquery().pushStack(
          state
            .order()
            .map(
              (input?: Dynamic, ..._extraArguments144: Dynamic[]): Dynamic =>
                state.slides.get(input).el,
            ),
        ),
      );
    let value15: Dynamic = (...input: Dynamic[]): Dynamic => {
      let items: Dynamic = [];
      for (let value23 of input.length ? input : [undefined]) {
        if (typeof value23 !== "number" && typeof value23 !== "string")
          throw Error(
            'handles are numbers or strings: k(7), k(3, 5), k("k7 k9")',
          );
        for (let value24 of typeof value23 === "number"
          ? [String(value23)]
          : value23.split(/[\s,#]+/).filter(Boolean)) {
          if (items.length >= 200)
            throw Error("at most 200 handles in one call");
          let value25: Dynamic = /^\d{1,6}$/.test(value24)
            ? state.P + value24
            : value24;
          let value26: Dynamic = state.elOf.has(value25)
            ? state.elOf.get(value25)
            : null;
          if (!value26 || !state.fileOf(value26))
            throw Error(
              "no element " +
                value24.slice(0, 20) +
                " (handles look like " +
                state.P +
                "1, " +
                state.P +
                "2 …; a removed element's handle is not given again)",
            );
          items.push(value26);
        }
      }
      return state.seen(jquery().pushStack(items));
    };
    let value16: Dynamic = (
      input?: Dynamic,
      ..._extraArguments145: Dynamic[]
    ): Dynamic =>
      input !== null &&
      typeof input === "object" &&
      !Array.isArray(input) &&
      Object.keys(input).length <= 100 &&
      Object.keys(input).every(
        (input2?: Dynamic, ..._extraArguments146: Dynamic[]): Dynamic =>
          typeof input[input2] === "string" ||
          (typeof input[input2] === "number" &&
            input[input2] === input[input2]),
      );
    let value17: Dynamic = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
      value23?: Dynamic,
      ..._extraArguments147: Dynamic[]
    ): Dynamic => {
      if (!input || typeof input !== "object" || Array.isArray(input))
        throw Error(options + " takes { k7: … }");
      let value24: Dynamic = Object.keys(input);
      if (value24.length > 200)
        throw Error(options + ": at most 200 handles in one call");
      let mapped: Dynamic = value24.map(
        (input2?: Dynamic, ..._extraArguments148: Dynamic[]): Dynamic => {
          if (!context(input[input2]))
            throw Error(
              options +
                ": the value for " +
                input2.slice(0, 20) +
                " must be " +
                (options === "style"
                  ? "an object like { color: '#fff', 'font-size': 40 }"
                  : "a string"),
            );
          return [value15(input2), input[input2]];
        },
      );
      for (let [value25, value26] of mapped) value23(value25, value26);
    };
    let value18: Dynamic = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
      ..._extraArguments149: Dynamic[]
    ): Dynamic => {
      if (options === undefined) {
        if (context) jquery(context).after(input);
        else container.appendChild(input);
        return;
      }
      if (!options || typeof options !== "object" || Array.isArray(options))
        throw Error(
          "the place is {before: name}, {after: name}, or a flat object the page understands",
        );
      let value23: Dynamic = Object.keys(options);
      if (
        value23.length === 1 &&
        (value23[0] === "before" || value23[0] === "after")
      ) {
        let el: Dynamic = value11(options[value23[0]]).el;
        if (el === input) throw Error("a file cannot go next to itself");
        if (value23[0] === "before") jquery(el).before(input);
        else jquery(el).after(input);
        return;
      }
      let record2: Dynamic = {};
      if (!value23.length || value23.length > 8)
        throw Error(
          "the place is {before: name}, {after: name}, or a flat object of short strings / numbers",
        );
      for (let value24 of value23) {
        let value25: Dynamic = options[value24];
        if (
          !/^[A-Za-z][\w-]{0,31}$/.test(value24) ||
          value24 === "before" ||
          value24 === "after" ||
          !(
            (typeof value25 === "string" && value25.length <= 100) ||
            (typeof value25 === "number" && value25 === value25)
          )
        )
          throw Error(
            "the place is {before: name}, {after: name}, or a flat object of short strings / numbers",
          );
        record2[value24] = value25;
      }
      if ((state.whereOf.set(input, record2), input.parentNode !== container))
        if (context) jquery(context).after(input);
        else container.appendChild(input);
      return record2;
    };
    let value19: Dynamic = (
      element?: Dynamic,
      ..._extraArguments150: Dynamic[]
    ): Dynamic => {
      if (element && element.jquery) element = element[0];
      if (typeof element === "string") {
        if (element.length > limits.maxHtml)
          throw Error("the new file is over " + limits.maxHtml + " characters");
        let value23: Dynamic = document.createElement("div");
        if (
          ((value23.innerHTML = element.trim()), value23.children.length !== 1)
        )
          throw Error("add(html) takes ONE element");
        element = value23.children[0];
      }
      if (!element || element.nodeType !== 1)
        throw Error("add(html) takes ONE element, as text or as a jQuery set");
      return element;
    };
    let value20: Dynamic = (..._extraArguments151: Dynamic[]): Dynamic => {
      if (state.halted) throw Error("the reply ended at undo()");
    };
    let record: Dynamic = {
      file: value13,
      files: value14,
      all: (input?: Dynamic, ..._extraArguments152: Dynamic[]): Dynamic =>
        input === undefined ? value14() : select(input),
      k: value15,
      fileOf: (input?: Dynamic, ..._extraArguments153: Dynamic[]): Dynamic => {
        let value23: Dynamic = input && input.jquery ? input[0] : input;
        let value24: Dynamic =
          value23 && value23.nodeType === 1 ? state.fileOf(value23) : null;
        if (!value24)
          throw Error(
            "fileOf takes an element (or a set) that is inside a file",
          );
        return value9(value24);
      },
      add: (
        input?: Dynamic,
        options?: Dynamic,
        ..._extraArguments154: Dynamic[]
      ): Dynamic => {
        value20();
        let value23: Dynamic = value19(input);
        value18(value23, options);
        return jquery(value23);
      },
      copy: (
        input?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
        ..._extraArguments155: Dynamic[]
      ): Dynamic => {
        if (
          (value20(),
          options !== null &&
            typeof options === "object" &&
            context === undefined)
        ) {
          context = options;
          options = undefined;
        }
        let value23: Dynamic = value11(input);
        let value24: Dynamic = jquery(value23.el).clone();
        if (options !== undefined) {
          if (
            typeof options !== "string" ||
            !validFileId.test(options) ||
            state.slides.has(options)
          )
            throw Error(
              "the new id must be letters, digits, - or _ (at most 64) and not taken",
            );
          value24.attr("id", options);
        }
        value18(value24[0], context, value23.el);
        return value24;
      },
      move: (
        input?: Dynamic,
        options?: Dynamic,
        ..._extraArguments156: Dynamic[]
      ): Dynamic => {
        value20();
        let value23: Dynamic = value11(input);
        let value24: Dynamic = value18(
          value23.el,
          options === undefined ? null : options,
        );
        if (value24) {
          state.whereOf.delete(value23.el);
          state.ops.push({
            op: {
              op: "move",
              id: value23.id,
              where: value24,
            },
            entry: null,
          });
        }
      },
      remove: (input?: Dynamic, ..._extraArguments157: Dynamic[]): Dynamic => {
        value20();
        jquery(value11(input).el).remove();
      },
      index: Object.freeze({
        get title(): Dynamic {
          return String(document.title);
        },
        set title(input: Dynamic) {
          if (typeof input !== "string" || !input.trim() || input.length > 300)
            throw Error("the title takes 1 to 300 characters");
          document.title = input;
        },
        sections: (..._extraArguments158: Dynamic[]): Dynamic =>
          state
            .order()
            .map(
              (input?: Dynamic, ..._extraArguments159: Dynamic[]): Dynamic =>
                state.slides.get(input),
            )
            .filter(
              (input?: Dynamic, ..._extraArguments160: Dynamic[]): Dynamic =>
                input.el.getAttribute("data-section") !== null &&
                !input.hadSection,
            )
            .map(
              (entry?: Dynamic, ..._extraArguments161: Dynamic[]): Dynamic => ({
                start: entry.id,
                title: entry.el.getAttribute("data-section"),
              }),
            ),
        section: (
          input?: Dynamic,
          options?: Dynamic,
          ..._extraArguments162: Dynamic[]
        ): Dynamic => {
          let value23: Dynamic = value11(input);
          let value24: Dynamic = Object.freeze({
            start: value23.id,
            get title(): Dynamic {
              return value23.el.getAttribute("data-section");
            },
            rename: (
              input2?: Dynamic,
              ..._extraArguments163: Dynamic[]
            ): Dynamic => {
              if (
                typeof input2 !== "string" ||
                !input2.trim() ||
                input2.length > 300
              )
                throw Error("a section title takes 1 to 300 characters");
              if (value23.el.getAttribute("data-section") === null)
                throw Error('no section starts at "' + value23.id + '"');
              value23.el.setAttribute("data-section", input2.trim());
            },
            remove: (..._extraArguments164: Dynamic[]): Dynamic => {
              if (value23.el.getAttribute("data-section") === null)
                throw Error('no section starts at "' + value23.id + '"');
              value23.el.removeAttribute("data-section");
            },
          });
          if (options === undefined) {
            if (value23.el.getAttribute("data-section") === null)
              throw Error('no section starts at "' + value23.id + '"');
            return value24;
          }
          if (
            typeof options !== "string" ||
            !options.trim() ||
            options.length > 300
          )
            throw Error("a section title takes 1 to 300 characters");
          if (value23.el.getAttribute("data-section") !== null)
            throw Error(
              'a section already starts at "' + value23.id + '"; rename it',
            );
          value23.el.setAttribute("data-section", options.trim());
          return value24;
        },
      }),
      style: (input?: Dynamic, ..._extraArguments165: Dynamic[]): Dynamic =>
        value17(
          input,
          "style",
          value16,
          (
            input2?: Dynamic,
            options?: Dynamic,
            ..._extraArguments166: Dynamic[]
          ): Dynamic => input2.css(Object.assign({}, options)),
        ),
      text: (input?: Dynamic, ..._extraArguments167: Dynamic[]): Dynamic =>
        value17(
          input,
          "text",
          (input2?: Dynamic, ..._extraArguments168: Dynamic[]): Dynamic =>
            typeof input2 === "string" ||
            (typeof input2 === "number" && input2 === input2),
          (
            input2?: Dynamic,
            options?: Dynamic,
            ..._extraArguments169: Dynamic[]
          ): Dynamic => input2.text(String(options)),
        ),
      read: state.log,
      document: document,
      layout: (input?: Dynamic, ..._extraArguments170: Dynamic[]): Dynamic => {
        if (
          typeof input !== "string" ||
          !Object.prototype.hasOwnProperty.call(state.layouts, input)
        )
          throw Error(
            "no layout named " +
              JSON.stringify(input) +
              "; the layouts are: " +
              Object.keys(state.layouts).join(", "),
          );
        return state.layouts[input];
      },
      layouts: (..._extraArguments171: Dynamic[]): Dynamic =>
        Object.keys(state.layouts),
      undo: (..._extraArguments172: Dynamic[]): Dynamic => {
        value20();
        state.ops.push({
          op: {
            op: "undo",
          },
          entry: null,
        });
        state.halted = true;
      },
      askClaude: (
        input?: Dynamic,
        ..._extraArguments173: Dynamic[]
      ): Dynamic => {
        value20();
        state.ops.push({
          op:
            typeof input === "string" && input.trim()
              ? {
                  op: "askClaude",
                  prompt: input.trim().slice(0, 1000),
                }
              : {
                  op: "askClaude",
                },
          entry: null,
        });
        state.halted = true;
      },
    };
    deckApi = Object.freeze({
      slide: record.file,
      all: record.all,
      add: record.add,
      duplicate: record.copy,
      move: record.move,
      remove: record.remove,
      title: (input?: Dynamic, ..._extraArguments174: Dynamic[]): Dynamic =>
        input === undefined
          ? record.index.title
          : void (record.index.title = input),
      section: record.index.section,
      sections: record.index.sections,
      layout: record.layout,
      get layouts(): Dynamic {
        return record.layouts();
      },
      undo: record.undo,
      get slides(): Dynamic {
        return state.order().map(
          (input?: Dynamic, ..._extraArguments175: Dynamic[]): Dynamic => ({
            id: input,
            title: value9(input).title,
          }),
        );
      },
      get current(): Dynamic {
        return currentFileId;
      },
    });
    state.me = (..._extraArguments176: Dynamic[]): Dynamic => {
      let value23: Dynamic = currentFileId
        ? state.slides.get(currentFileId)
        : null;
      if (value23 && !value23.removed && value23.el.parentNode === container)
        return value12(jquery(value23.el), value23);
      state.goneMsg = currentFileId
        ? "this file was removed"
        : "there is no current file: say which, $('#goals h2'), or every file, $('h2'), or a handle, $('#k7')";
      return state.ghost;
    };
    let value21: Dynamic = Object.assign({}, DEFAULT_SDK_NAMES);
    let value22: Dynamic = (sdk && sdk.names) || {};
    for (let value23 of Object.keys(value22))
      if (value22[value23] === null) delete value21[value23];
      else if (
        /^[A-Za-z_$][\w$]{0,30}$/.test(value23) &&
        !["$", "slide", "deck", "log"].includes(value23) &&
        Object.prototype.hasOwnProperty.call(record, value22[value23])
      )
        value21[value23] = value22[value23];
    state.pub = Object.keys(value21);
    try {
      Function(...state.pub, "");
    } catch (value23: Dynamic) {
      state.pub = Object.keys(DEFAULT_SDK_NAMES);
      Object.assign(value21, DEFAULT_SDK_NAMES);
    }
    state.pubVals = state.pub.map(
      (input?: Dynamic, ..._extraArguments177: Dynamic[]): Dynamic =>
        record[value21[input]],
    );
  }
  function executeFileStatement(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    ..._extraArguments178: Dynamic[]
  ): Dynamic {
    let value2: Dynamic = String(input);
    let value3: Dynamic = project;
    let value4: Dynamic = ++value3.n;
    let value5: Dynamic = truncate(value2, limits.maxStmt);
    if (((value3.logged = 0), (value3.ops = []), value3.halted)) {
      emit({
        kind: "done" as const,
        seq: sequence++,
        n: value4,
        stmt: value5,
        changed: [],
        logged: 0,
        skipped: true,
      });
      return false;
    }
    let value6: Dynamic = null;
    if (!options)
      try {
        options = compileStatement(value2, context);
      } catch (value9: Dynamic) {
        value6 = String(value9);
      }
    if (((executingStatement = value2), options))
      try {
        invokeStatement(
          options,
          [select, value3.me(), deckApi, value3.log, ...value3.pubVals],
          context,
        );
      } catch (value9: Dynamic) {
        value6 = String(value9);
      }
    let value7: Dynamic;
    try {
      value7 = value3.settle();
    } catch (value9: Dynamic) {
      value7 = {
        frames: [],
        ops: [],
        problems: [
          "the box could not read the document after this statement: " +
            String(value9),
        ],
      };
    }
    if (value6 !== null) emitError(value6, value2);
    let mapped: Dynamic = value7.problems.map(
      (input2?: Dynamic, ..._extraArguments179: Dynamic[]): Dynamic =>
        [].concat(input2),
    );
    let value8: Dynamic = mapped.length > 6;
    for (let [value9, value10] of value8
      ? [
          ...mapped.filter(
            (input2?: Dynamic, ..._extraArguments180: Dynamic[]): Dynamic =>
              input2[1],
          ),
          ...mapped.filter(
            (input2?: Dynamic, ..._extraArguments181: Dynamic[]): Dynamic =>
              !input2[1],
          ),
        ].slice(0, 5)
      : mapped)
      emitError(value9, value2, value10);
    if (value8)
      emitError(
        "and " + (mapped.length - 5) + " more problems in this statement",
        value2,
      );
    if (value6 === null && mapped.length) value6 = mapped[0][0];
    for (let value9 of value3.ops)
      if (value9.op.op === "undo" || value9.op.op === "askClaude")
        value7.ops.push(value9.op);
      else if (value3.opsLeft > 0) {
        value3.opsLeft--;
        value7.ops.push(value9.op);
      }
    if (!pace)
      for (let value9 of value7.frames)
        emit({
          kind: "html" as const,
          seq: sequence++,
          slideId: value9.id,
          html: value9.html,
          stmt: value5,
        });
    else {
      for (let value9 of value7.frames)
        queuedFrames.set(value9.id, {
          html: value9.html,
          stmt: value5,
        });
      for (let value9 of value7.ops)
        if (value9 && value9.op === "remove" && queuedFrames.has(value9.id)) {
          let entry: Dynamic = queuedFrames.get(value9.id);
          queuedFrames.delete(value9.id);
          emit({
            kind: "html" as const,
            seq: sequence++,
            slideId: value9.id,
            html: entry.html,
            stmt: entry.stmt,
          });
        }
      sendQueuedFrames(false);
    }
    for (let value9 of value7.ops) {
      let value10: Dynamic = Object.assign({}, value9);
      delete value10.where;
      emit({
        kind: "op" as const,
        seq: sequence++,
        stmt: value5,
        op: value9.where
          ? Object.assign(value10, {
              where: value9.where,
            })
          : value10,
      });
    }
    let record: DoneMessage = {
      kind: "done" as const,
      seq: sequence++,
      n: value4,
      stmt: value5,
      changed: value7.frames.map(
        (entry?: Dynamic, ..._extraArguments182: Dynamic[]): Dynamic =>
          entry.id,
      ),
      logged: value3.logged,
    };
    if (value3.rehandled.size) {
      if (
        ((record.handles = [...value3.rehandled].filter(
          (input2?: Dynamic, ..._extraArguments183: Dynamic[]): Dynamic =>
            value3.slides.get(input2) && !value3.slides.get(input2).removed,
        )),
        value3.rehandled.clear(),
        !record.handles.length)
      )
        delete record.handles;
    }
    if (value6 !== null)
      record.threw = {
        message: formatError(value6),
      };
    emit(record);
    return value6 === null;
  }
  function sendFileView(
    input?: Dynamic,
    options?: Dynamic,
    ..._extraArguments184: Dynamic[]
  ): Dynamic {
    if (!initialized || !project || !project.v3) return;
    input = project.paths.has(input) ? project.paths.get(input) : String(input);
    let value2: Dynamic = project.view(input);
    emit({
      kind: "view" as const,
      req: options,
      slideId: input,
      attr: "id",
      prefix: project.P,
      html: value2 === null ? "" : value2,
    });
  }
  function sendHandles(
    input?: Dynamic,
    options?: Dynamic,
    ..._extraArguments185: Dynamic[]
  ): Dynamic {
    if (!initialized || !project || !project.v3) return;
    emit({
      kind: "handles" as const,
      req: options,
      attr: "id",
      prefix: project.P,
      rows: project.list(Number.isInteger(input) && input > 0 ? input : 0),
    });
  }
  function executeSlideStatement(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    ..._extraArguments186: Dynamic[]
  ): Dynamic {
    let value2: Dynamic = String(input);
    let value3: Dynamic = project;
    let value4: Dynamic = ++value3.n;
    let value5: Dynamic = truncate(value2, limits.maxStmt);
    if (((value3.logged = 0), (value3.ops = []), value3.halted)) {
      emit({
        kind: "done" as const,
        seq: sequence++,
        n: value4,
        stmt: value5,
        changed: [],
        logged: 0,
        skipped: true,
      });
      return false;
    }
    let value6: Dynamic = null;
    if (!options)
      try {
        options = compileStatement(value2, context);
      } catch (value8: Dynamic) {
        value6 = String(value8);
      }
    if (((executingStatement = value2), options))
      try {
        invokeStatement(
          options,
          [
            select,
            value3.currentRemoved ? value3.ghost : jquery(currentElement),
            deckApi,
            value3.log,
          ],
          context,
        );
      } catch (value8: Dynamic) {
        value6 = String(value8);
      }
    if (value6 !== null) emitError(value6, value2);
    let items: Dynamic = [];
    let value7: Dynamic = (
      input2?: Dynamic,
      options2?: Dynamic,
      context2?: Dynamic,
      ..._extraArguments187: Dynamic[]
    ): Dynamic => {
      if (options2.length > limits.maxHtml) {
        emitError(
          'the text of the slide "' +
            input2 +
            '" is over ' +
            limits.maxHtml +
            " characters; not sent",
          value2,
        );
        return;
      }
      context2(options2);
      items.push(input2);
      emit({
        kind: "html" as const,
        seq: sequence++,
        slideId: input2,
        html: options2,
        stmt: value5,
      });
    };
    if (!value3.currentRemoved)
      try {
        let value8: Dynamic = serializeCurrentSlide();
        if (value8 !== null && value8 !== lastHtml)
          value7(
            value3.current,
            value8,
            (input2?: Dynamic, ..._extraArguments188: Dynamic[]): Dynamic => {
              lastHtml = input2;
              value3.slides.get(value3.current).last = input2;
            },
          );
      } catch (value8: Dynamic) {
        emitError(String(value8), value2);
      }
    for (let value8 of value3.order()) {
      let value9: Dynamic = value8 && value3.slides.get(value8);
      if (
        !value9 ||
        value8 === value3.current ||
        !value9.holder ||
        value9.removed ||
        value9.born === value4
      )
        continue;
      try {
        let value10: Dynamic = value3.text(value9);
        if (value10 !== value9.last)
          value7(
            value8,
            value10,
            (input2?: Dynamic, ..._extraArguments189: Dynamic[]): Dynamic => {
              value9.last = input2;
            },
          );
      } catch (value10: Dynamic) {
        emitError(String(value10), value2);
      }
    }
    for (let value8 of value3.ops) {
      let op: Dynamic = value8.op;
      if (value8.entry && value8.entry.born === value4 && !value8.entry.removed)
        try {
          let value9: Dynamic = value3.text(value8.entry);
          if (value9 !== value8.entry.last)
            if (value9.length > limits.maxHtml)
              emitError(
                'the text of the slide "' +
                  value8.entry.id +
                  '" is over ' +
                  limits.maxHtml +
                  " characters; not sent",
                value2,
              );
            else {
              op = Object.assign({}, op, {
                html: value9,
              });
              value8.entry.last = value9;
            }
        } catch (value9: Dynamic) {
          emitError(String(value9), value2);
        }
      emit({
        kind: "op" as const,
        seq: sequence++,
        stmt: value5,
        op: op,
      });
    }
    value3.ops = [];
    let record: DoneMessage = {
      kind: "done" as const,
      seq: sequence++,
      n: value4,
      stmt: value5,
      changed: items,
      logged: value3.logged,
    };
    if (value6 !== null)
      record.threw = {
        message: formatError(value6),
      };
    emit(record);
    return value6 === null;
  }
  function initializeDomDeck(
    state?: Dynamic,
    ..._extraArguments190: Dynamic[]
  ): Dynamic {
    let value2: Dynamic = document.createElement("main");
    let value3: Dynamic = String(state.current);
    let value4: Dynamic = new Set();
    if (
      (value2.setAttribute("id", "deck"),
      currentElement.getAttribute("id") !== value3)
    )
      currentElement.setAttribute("id", value3);
    for (let value5 of state.slides) {
      let value6: Dynamic = String(value5 && value5.id);
      if (!validFileId.test(value6) || value4.has(value6)) continue;
      if ((value4.add(value6), value6 === value3)) {
        value2.appendChild(currentElement);
        continue;
      }
      let value7: Dynamic = document.createElement("section");
      value7.setAttribute("id", value6);
      value7.setAttribute("data-shell", "");
      value7.setAttribute(
        "data-title",
        String((value5 && value5.title) || "").slice(0, 300),
      );
      value7.setAttribute("data-src", value6);
      value2.appendChild(value7);
    }
    if (currentElement.parentNode !== value2) {
      value2.appendChild(currentElement);
      value4.add(value3);
    }
    document.body.innerHTML = "";
    document.body.appendChild(value2);
    domDeck = {
      main: value2,
      current: value3,
      initial: value4,
      last: "",
    };
  }
  function findCurrentSection(..._extraArguments191: Dynamic[]): Dynamic {
    if (!domDeck) return document.body.querySelector("section");
    if (currentElement && currentElement.parentNode === domDeck.main)
      return currentElement;
    for (let value2 of domDeck.main.children)
      if (
        value2.tagName === "SECTION" &&
        value2.getAttribute("id") === domDeck.current
      )
        return value2;
    return null;
  }
  let invalidDeck: Dynamic = (
    input?: Dynamic,
    ..._extraArguments192: Dynamic[]
  ): Dynamic => ({
    ok: false,
    message: input,
  });
  function validateDomDeck(..._extraArguments193: Dynamic[]): Dynamic {
    let main: Dynamic = domDeck.main;
    if (main.parentNode !== document.body || main.getAttribute("id") !== "deck")
      return invalidDeck(
        "main#deck itself cannot be removed, moved or renamed",
      );
    let value2: Dynamic = findCurrentSection();
    if (value2 && value2.getAttribute("id") !== domDeck.current)
      return invalidDeck(
        'the current slide keeps its id "' + domDeck.current + '"',
      );
    let items: Dynamic = [];
    let items2: Dynamic = [];
    let items3: Dynamic = [];
    let value3: Dynamic = new Set();
    let index: Dynamic = 0;
    for (let value4 of main.children) {
      if (value4.tagName !== "SECTION") continue;
      let value5: Dynamic = value4.getAttribute("id") || "";
      if (!validFileId.test(value5))
        return invalidDeck(
          "every slide <section> needs an id of letters, digits, - or _ (at most 64 characters)",
        );
      if (value3.has(value5))
        return invalidDeck(
          'two slides have the id "' +
            value5 +
            '": give the new one its own id',
        );
      if ((value3.add(value5), items.push(value5), items.length > 500))
        return invalidDeck("a deck holds at most 500 slides");
      if (value4 === value2 || domDeck.initial.has(value5)) continue;
      if (items2.length + items3.length >= 8)
        return invalidDeck("at most 8 new slides in one run");
      if (
        value4.hasAttribute("data-shell") &&
        domDeck.initial.has(value4.getAttribute("data-src") || "")
      ) {
        items3.push({
          id: value5,
          cloneOf: value4.getAttribute("data-src"),
        });
        continue;
      }
      let value6: Dynamic = serializeElement(value4);
      if (value6.length > limits.maxHtml || (index += value6.length) > 1e6)
        return invalidDeck(
          "a new slide is over " + limits.maxHtml + " characters",
        );
      items2.push({
        id: value5,
        html: value6,
      });
    }
    let filtered: Dynamic = [...domDeck.initial].filter(
      (input?: Dynamic, ..._extraArguments194: Dynamic[]): Dynamic =>
        !value3.has(input),
    );
    return {
      ok: true,
      state: {
        order: items,
        added: items2,
        clones: items3,
        removed: filtered,
      },
    };
  }
  function restoreDomDeck(
    input?: Dynamic,
    ..._extraArguments195: Dynamic[]
  ): Dynamic {
    if (
      ((document.body.innerHTML = input),
      (domDeck.main = document.body.querySelector("main")),
      (currentElement = null),
      (currentElement = findCurrentSection()),
      currentElement)
    ) {
      for (let value2 of [
        currentElement,
        ...currentElement.querySelectorAll("[style]"),
      ])
        if (value2.getAttribute("style") !== null)
          originalStyles.set(value2, value2.getAttribute("style"));
    }
  }
  function serializeElement(
    input?: Dynamic,
    ..._extraArguments196: Dynamic[]
  ): Dynamic {
    settleStyles(input);
    for (let value2 of [
      input,
      ...input.querySelectorAll('[style], [class=""]'),
    ]) {
      if (
        value2.getAttribute("style") !== null &&
        value2.getAttribute("style").trim() === ""
      )
        value2.removeAttribute("style");
      if (value2.getAttribute("class") === "") value2.removeAttribute("class");
    }
    return input.outerHTML;
  }
  function serializeCurrentSlide(..._extraArguments197: Dynamic[]): Dynamic {
    let value2: Dynamic = findCurrentSection();
    if (!value2 && domDeck) {
      currentElement = null;
      return null;
    }
    if (!value2)
      throw (
        (document.body.innerHTML = lastHtml),
        (value2 = document.body.querySelector("section")),
        (currentElement = value2),
        Error("the slide <section> was removed; restored")
      );
    currentElement = value2;
    let value3: Dynamic = serializeElement(value2);
    return originalHadTbody ? value3 : value3.replace(/<\/?tbody>/g, "");
  }
  function resetPendingCode(..._extraArguments198: Dynamic[]): Dynamic {
    pendingCode = "";
    pendingLineCount = 0;
    compiledPending = null;
  }
  let stripVariableDeclaration: Dynamic = (
    input?: Dynamic,
    ..._extraArguments199: Dynamic[]
  ): Dynamic =>
    input.replace(
      /^(\s*)(?:const|let|var)\s+(?=[A-Za-z_$][\w$]*\s*(?:=|,|;|$))/,
      "$1",
    );
  let DEFAULT_SDK_NAMES: Dynamic = {
    read: "read",
    document: "document",
    file: "file",
    files: "files",
    all: "all",
    k: "k",
    $k: "k",
    fileOf: "fileOf",
    add: "add",
    copy: "copy",
    move: "move",
    remove: "remove",
    index: "index",
    style: "style",
    text: "text",
    layout: "layout",
    layouts: "layouts",
    undo: "undo",
    askClaude: "askClaude",
  };
  let STATEMENT_ONLY: Dynamic =
    /^\s*(?:function|class|if|for|while|do|switch|try|return|throw|import|export|async\s+function|\{|\/\/|\/\*)/;
  function compileStatement(
    code?: Dynamic,
    continuesPrevious?: Dynamic,
    ..._extraArguments200: Dynamic[]
  ): Dynamic {
    let argumentNames: Dynamic = [
      "$",
      "slide",
      "deck",
      "log",
      ...(project && project.v3 ? project.pub : []),
    ];
    if (!chainMode)
      return Function(...argumentNames, stripVariableDeclaration(code));
    let expression: Dynamic = stripVariableDeclaration(code).replace(
      /[;\s]+$/,
      "",
    );
    if (continuesPrevious)
      return Function(
        ...argumentNames,
        "__prev",
        "return (__prev" +
          expression.replace(/^\s+/, "") +
          `
);`,
      );
    if (!STATEMENT_ONLY.test(expression))
      try {
        return Function(
          ...argumentNames,
          "return (" +
            expression +
            `
);`,
        );
      } catch (value2: Dynamic) {}
    return Function(...argumentNames, stripVariableDeclaration(code));
  }
  function invokeStatement(
    compiled?: Dynamic,
    argumentsForStatement?: Dynamic,
    continuesPrevious?: Dynamic,
    ..._extraArguments201: Dynamic[]
  ): Dynamic {
    if (
      continuesPrevious &&
      (previousValue === undefined || previousValue === null)
    )
      throw Error(
        "a line that starts with . continues the statement before it, and that one gave no value",
      );
    try {
      let result: Dynamic = compiled.call(
        undefined,
        ...argumentsForStatement,
        ...(continuesPrevious ? [previousValue] : []),
      );
      previousValue = chainMode ? result : undefined;
    } catch (result: Dynamic) {
      if (!continuesPrevious) previousValue = undefined;
      throw result;
    }
  }
  function execute(
    code?: Dynamic,
    compiled?: Dynamic,
    continuesPrevious?: Dynamic,
    ..._extraArguments202: Dynamic[]
  ): Dynamic {
    let value2: Dynamic = String(code);
    if (!initialized) return false;
    if (project && project.one)
      return executeFileStatement(code, compiled, continuesPrevious);
    if (project)
      return executeSlideStatement(code, compiled, continuesPrevious);
    if (!compiled)
      try {
        compiled = compileStatement(value2, continuesPrevious);
      } catch (value6: Dynamic) {
        emitError(String(value6), value2);
        return false;
      }
    let value3: Dynamic = domDeck ? document.body.innerHTML : null;
    let value4: Dynamic = null;
    executingStatement = value2;
    try {
      invokeStatement(
        compiled,
        [select, jquery(currentElement), deckApi || undefined, undefined],
        continuesPrevious,
      );
    } catch (value6: Dynamic) {
      if ((emitError(String(value6), value2), domDeck)) {
        if (
          ((value4 = validateDomDeck()),
          !value4.ok || JSON.stringify(value4.state) !== domDeck.last)
        )
          restoreDomDeck(value3);
      }
      try {
        serializeCurrentSlide();
      } catch (value7: Dynamic) {}
      return false;
    }
    if (domDeck) {
      if (((value4 = validateDomDeck()), !value4.ok)) {
        emitError(value4.message + "; undone", value2);
        restoreDomDeck(value3);
        return false;
      }
    }
    let value5: Dynamic;
    try {
      value5 = serializeCurrentSlide();
    } catch (value6: Dynamic) {
      emitError(String(value6), value2);
      return false;
    }
    if (value5 !== null && value5.length > limits.maxHtml) {
      emitError(
        "the slide text is over " + limits.maxHtml + " characters; not sent",
        value2,
      );
      return false;
    }
    if (value5 !== null && value5 !== lastHtml) {
      lastHtml = value5;
      emit({
        kind: "html" as const,
        seq: sequence++,
        html: value5,
        stmt: truncate(value2, limits.maxStmt),
      });
    }
    if (value4) {
      let value6: Dynamic = JSON.stringify(value4.state);
      if (value6 !== domDeck.last) {
        domDeck.last = value6;
        emit(
          Object.assign(
            {
              kind: "deck" as const,
              seq: sequence++,
              stmt: truncate(value2, limits.maxStmt),
            },
            value4.state,
          ),
        );
      }
    }
    return true;
  }
  function executePending(..._extraArguments203: Dynamic[]): Dynamic {
    if ((clearTimeout(idleTimer), !compiledPending)) return;
    let value2: Dynamic = compiledPending;
    let value3: Dynamic = pendingCode;
    resetPendingCode();
    execute(value3, value2);
  }
  function acceptLine(
    input?: Dynamic,
    ..._extraArguments204: Dynamic[]
  ): Dynamic {
    if (((input = input.replace(/\r$/, "")), CODE_FENCE.test(input))) {
      flushPending();
      insideCodeFence = insideCodeFence !== true;
      return;
    }
    if (insideCodeFence === false) return;
    if (compiledPending)
      if (CHAIN_CONTINUATION.test(input)) compiledPending = null;
      else executePending();
    if (!pendingCode && input.trim() === "") return;
    pendingCode +=
      (pendingCode
        ? `
`
        : "") + input;
    pendingLineCount++;
    compilePending(false);
  }
  function compilePending(
    input?: Dynamic,
    ..._extraArguments205: Dynamic[]
  ): Dynamic {
    try {
      compiledPending = compileStatement(pendingCode);
      hasSeenCode = true;
    } catch (value2: Dynamic) {
      if (
        ((compiledPending = null),
        !hasSeenCode &&
          pendingLineCount === 1 &&
          !pendingCode.includes("$(") &&
          !CODE_LIKE.test(pendingCode))
      ) {
        resetPendingCode();
        return;
      }
      if (
        !input &&
        value2 instanceof SyntaxError &&
        pendingLineCount < limits.maxLines &&
        pendingCode.length < limits.maxChars
      )
        return;
      emitStatementError(String(value2), pendingCode);
      resetPendingCode();
      return;
    }
    if (input) executePending();
    else if (limits.idleRunMs > 0) {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(executePending, limits.idleRunMs);
    }
  }
  function flushPending(..._extraArguments206: Dynamic[]): Dynamic {
    if (compiledPending) executePending();
    else if (pendingCode) compilePending(true);
  }
  function acceptLineChunk(
    input?: Dynamic,
    ..._extraArguments207: Dynamic[]
  ): Dynamic {
    lineTail += String(input);
    let value2: Dynamic;
    while (
      (value2 = lineTail.indexOf(`
`)) >= 0
    ) {
      let slice: Dynamic = lineTail.slice(0, value2);
      lineTail = lineTail.slice(value2 + 1);
      acceptLine(slice);
    }
    if (
      compiledPending &&
      /\S/.test(lineTail) &&
      !CHAIN_CONTINUATION.test(lineTail) &&
      !/^\s*[.?:&|]$/.test(lineTail)
    )
      executePending();
    if (lineTail.length > limits.maxChars) {
      emitError(
        "a line is over " + limits.maxChars + " characters; dropped",
        lineTail,
      );
      lineTail = "";
    }
  }
  function endLineInput(..._extraArguments208: Dynamic[]): Dynamic {
    if (lineTail) {
      let value2: Dynamic = lineTail;
      lineTail = "";
      acceptLine(value2);
    }
    flushPending();
  }
  function createSplitter(..._extraArguments209: Dynamic[]): Dynamic {
    return statementStream.createStatementStream({
      joinChains: !chainMode,
      onStatement(input: Dynamic, options: Dynamic, context: Dynamic): Dynamic {
        hasSeenCode = true;
        execute(input, undefined, chainMode && !!(context && context.chain));
      },
      onError(input: Dynamic): Dynamic {
        if (input && input.code === "INCOMPLETE")
          emitStatementError(
            "the reply ended inside a statement (open: " + input.open + ")",
            input.tail,
          );
        else
          emitError(
            "splitter: " + String((input && input.message) || input),
            "",
          );
      },
    });
  }
  let isCompilable: Dynamic = (
    input?: Dynamic,
    ..._extraArguments210: Dynamic[]
  ): Dynamic => {
    try {
      compileStatement(input);
      return true;
    } catch (value2: Dynamic) {
      return false;
    }
  };
  let isProse: Dynamic = (
    input?: Dynamic,
    ..._extraArguments211: Dynamic[]
  ): Dynamic =>
    !input.includes("$(") && !CODE_LIKE.test(input) && !isCompilable(input);
  let skippedLineCount: Dynamic = 0;
  let reportSkippedProse: Dynamic = (
    input?: Dynamic,
    ..._extraArguments212: Dynamic[]
  ): Dynamic => {
    if (input.trim() && skippedLineCount++ < 5)
      emit({
        kind: "log" as const,
        message: truncate("skipped, not code: " + input.trim(), 200),
      });
  };
  let insideTemplate: Dynamic = (..._extraArguments213: Dynamic[]): Dynamic => {
    let value2: Dynamic = stream ? stream.tail() : "";
    let index: Dynamic = 0;
    for (let index2: Dynamic = 0; index2 < value2.length; index2++)
      if (value2[index2] === "\\") index2++;
      else if (value2[index2] === "`") index++;
    return index % 2 === 1;
  };
  function pushStream(
    input?: Dynamic,
    ..._extraArguments214: Dynamic[]
  ): Dynamic {
    try {
      stream.push(input);
    } catch (value3: Dynamic) {
      useLineSplitter = true;
      let value4: Dynamic = stream.tail();
      stream = null;
      acceptLineChunk(value4 + input);
      return;
    }
    let value2: Dynamic = stream.tail();
    if (
      value2.length > limits.maxChars ||
      (value2.length > limits.maxLines &&
        value2.split(`
`).length > limits.maxLines)
    ) {
      emitStatementError(
        "a statement is over " +
          limits.maxLines +
          " lines / " +
          limits.maxChars +
          " characters; dropped",
        value2,
      );
      stream.reset();
    }
  }
  function restartStream(..._extraArguments215: Dynamic[]): Dynamic {
    if (stream) {
      stream.end();
      stream = createSplitter();
    }
  }
  function acceptStreamChunk(
    input?: Dynamic,
    ..._extraArguments216: Dynamic[]
  ): Dynamic {
    for (let index: Dynamic = 0; index < input.length; ) {
      let value2: Dynamic = input.indexOf(
        `
`,
        index,
      );
      let value3: Dynamic =
        value2 < 0 ? input.slice(index) : input.slice(index, value2 + 1);
      index += value3.length;
      incomingLine += value3;
      let value4: Dynamic = value3.endsWith(`
`);
      let value5: Dynamic = incomingLine.trimStart()[0];
      if (
        !recognizedCode &&
        insideCodeFence !== true &&
        insideCodeFence !== false &&
        CODE_START.test(incomingLine)
      )
        recognizedCode = true;
      let value6: Dynamic =
        insideCodeFence === false ||
        (!recognizedCode && insideCodeFence !== true) ||
        value5 === undefined ||
        value5 === "`";
      if (useLineSplitter) {
        acceptLineChunk(incomingLine.slice(consumedLineChars));
        consumedLineChars = incomingLine.length;
      } else if (!value6) {
        pushStream(incomingLine.slice(consumedLineChars));
        consumedLineChars = incomingLine.length;
      }
      if (!value4) continue;
      if (consumedLineChars === 0 && !useLineSplitter) {
        let value7: Dynamic = incomingLine.replace(/\r?\n$/, "");
        if (CODE_FENCE.test(value7) && !insideTemplate()) {
          if (
            (restartStream(),
            (insideCodeFence = insideCodeFence !== true),
            insideCodeFence)
          )
            recognizedCode = true;
        } else if (insideCodeFence === false) reportSkippedProse(value7);
        else if (!recognizedCode && insideCodeFence !== true && isProse(value7))
          reportSkippedProse(value7);
        else {
          if (value7.trim()) recognizedCode = true;
          pushStream(incomingLine);
        }
      }
      incomingLine = "";
      consumedLineChars = 0;
    }
  }
  let previewState: Dynamic = null;
  let previewElement: Dynamic = null;
  let quotedStringPattern: Dynamic = (
    input?: Dynamic,
    ..._extraArguments217: Dynamic[]
  ): Dynamic => `(['"])((?:\\\\.|(?!\\` + input + ")[^\\\\\\n])*)\\" + input;
  let PREVIEW_PATTERNS: Dynamic = {
    assign: /^(?:(?:var|let|const)\s+)?(?:[A-Za-z_$][\w$]*\s*=\s*)?/,
    sel: new RegExp("^\\$\\(\\s*" + quotedStringPattern(1) + "\\s*\\)"),
    all: /^\$\(\s*\)/,
    me: /^(?:\$\.slide|slide)\b/,
    k: /^(?:k|\$k)\(\s*([\w\s,'"]*?)\s*\)/,
    file: new RegExp(
      "^(?:file|deck\\.slide)\\(\\s*" + quotedStringPattern(1) + "\\s*\\)",
    ),
    step: new RegExp(
      "^\\s*\\.(find|children|eq|first|last|parent|next|prev|closest|filter|not)\\(\\s*(?:" +
        quotedStringPattern(2) +
        "|(-?\\d+))?\\s*\\)",
    ),
    into: /^\s*\.(html|append|prepend|after|before)\(\s*(?=['"`])/,
    make: /^(?:\$|(?:deck\.)?add)\(\s*(?=['"`])/,
  };
  let unescapeSelector: Dynamic = (
    input?: Dynamic,
    ..._extraArguments218: Dynamic[]
  ): Dynamic => input.replace(/\\(.)/g, "$1");
  function parsePreviewForm(
    code?: Dynamic,
    ..._extraArguments219: Dynamic[]
  ): Dynamic {
    let offset: Dynamic = (code.match(/^\s*/) || [""])[0].length;
    offset += (code.slice(offset).match(PREVIEW_PATTERNS.assign) || [""])[0]
      .length;
    let remaining: Dynamic = (..._extraArguments220: Dynamic[]): Dynamic =>
      code.slice(offset);
    let match: Dynamic;
    if ((match = remaining().match(PREVIEW_PATTERNS.make))) {
      let value2: Dynamic = offset + match[0].length;
      let value3: Dynamic = match[0][0] === "$";
      let value4: Dynamic = readStringLiteral(code, value2);
      if (!value4) return null;
      let value5: Dynamic = (value4.value.match(/^\s*(\S)/) || [])[1];
      if (value5 === undefined) return value4.closed ? null : undefined;
      if (!value3 || value5 === "<")
        return {
          method: value3 ? "create" : "add",
          at: value2,
          steps: null,
        };
    }
    let steps: Dynamic = [];
    if (chainMode && remaining()[0] === ".") {
      steps.push(["prev"]);
      match = [""];
    } else if ((match = remaining().match(PREVIEW_PATTERNS.sel))) {
      let value2: Dynamic = readStringLiteral(
        code,
        offset + match[0].indexOf(match[1]),
      );
      if (!value2 || !value2.closed || /^\s*</.test(value2.value)) return null;
      steps.push(["$", value2.value]);
    } else if ((match = remaining().match(PREVIEW_PATTERNS.all)))
      steps.push(["files"]);
    else if ((match = remaining().match(PREVIEW_PATTERNS.me)))
      steps.push(["me"]);
    else if ((match = remaining().match(PREVIEW_PATTERNS.k)))
      steps.push(["k", match[1].replace(/['"]/g, " ")]);
    else if ((match = remaining().match(PREVIEW_PATTERNS.file)))
      steps.push(["file", unescapeSelector(match[2])]);
    else
      return code.length - offset < 80 &&
        /^[$\w.]*\(?\s*['"]?[^'"]*$/.test(remaining())
        ? undefined
        : null;
    offset += match[0].length;
    while ((match = remaining().match(PREVIEW_PATTERNS.step))) {
      steps.push([
        match[1],
        match[3] !== undefined
          ? unescapeSelector(match[3])
          : match[4] !== undefined
            ? +match[4]
            : undefined,
      ]);
      offset += match[0].length;
    }
    if ((match = remaining().match(PREVIEW_PATTERNS.into)))
      return {
        method: match[1],
        at: offset + match[0].length,
        steps: steps,
      };
    return /^\s*(?:\.\w*(?:\(\s*(?:['"][^'"\n]*|-?\d*)?\s*)?)?$/.test(
      remaining(),
    )
      ? undefined
      : null;
  }
  function readStringLiteral(
    code?: Dynamic,
    start?: Dynamic,
    ..._extraArguments221: Dynamic[]
  ): Dynamic {
    let quote: Dynamic = code[start];
    let escapes: Dynamic = {
      n: `
`,
      t: "\t",
      r: "\r",
      b: "\b",
      f: "\f",
      v: "\v",
      0: "\x00",
    };
    let value2: Dynamic = "";
    for (let index: Dynamic = start + 1; index < code.length; index++) {
      let character: Dynamic = code[index];
      if (character === "\\") {
        let escape2: Dynamic = code[++index];
        if (escape2 === undefined) break;
        if (escape2 === "u" || escape2 === "x") {
          let hexLength: Dynamic = escape2 === "x" ? 2 : 4;
          let hexDigits: Dynamic = code.slice(index + 1, index + 1 + hexLength);
          if (code[index + 1] === "{") {
            let braceEnd: Dynamic = code.indexOf("}", index);
            if (braceEnd < 0) break;
            value2 += String.fromCodePoint(
              parseInt(code.slice(index + 2, braceEnd), 16) || 65533,
            );
            index = braceEnd;
            continue;
          }
          if (hexDigits.length < hexLength) break;
          value2 += String.fromCharCode(parseInt(hexDigits, 16) || 65533);
          index += hexLength;
          continue;
        }
        value2 +=
          escape2 ===
          `
`
            ? ""
            : escapes[escape2] !== undefined
              ? escapes[escape2]
              : escape2;
        continue;
      }
      if (character === quote)
        return {
          value: value2,
          closed: true,
          end: index,
        };
      if (quote === "`" && character === "$") {
        if (code[index + 1] === "{") return null;
        if (code[index + 1] === undefined) break;
      }
      if (
        quote !== "`" &&
        character ===
          `
`
      )
        return null;
      value2 += character;
    }
    return {
      value: value2,
      closed: false,
    };
  }
  function sanitizePreviewHtml(
    input?: Dynamic,
    ..._extraArguments222: Dynamic[]
  ): Dynamic {
    let value2: Dynamic = false;
    let text: Dynamic = "";
    let index: Dynamic = 0;
    for (let index2: Dynamic = 0; index2 < input.length; index2++) {
      let value5: Dynamic = input[index2];
      if (!value2) {
        if (value5 === "<") {
          value2 = true;
          index = index2;
          text = "";
        }
      } else if (text) {
        if (value5 === text) text = "";
      } else if (value5 === '"' || value5 === "'") text = value5;
      else if (value5 === ">") value2 = false;
    }
    let value3: Dynamic =
      value2 && previewState && previewState.form && previewState.form.steps
        ? completeSvgDataUrl(input, index)
        : null;
    let value4: Dynamic =
      value3 !== null
        ? input.slice(0, index) + value3
        : (value2 ? input.slice(0, index) : input).replace(/&[#\w]{0,12}$/, "");
    if (!previewElement) previewElement = document.createElement("div");
    previewElement.innerHTML = value4;
    let innerHTML: Dynamic = previewElement.innerHTML;
    previewElement.innerHTML = "";
    return innerHTML;
  }
  let HTML_ENTITIES: Dynamic = {
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&lt;": "<",
    "&gt;": ">",
  };
  let UNSAFE_SVG_ELEMENTS: Dynamic = new Set([
    "style",
    "script",
    "foreignobject",
    "text",
  ]);
  let VOID_ELEMENTS: Dynamic = new Set([
    "img",
    "input",
    "br",
    "hr",
    "source",
    "embed",
  ]);
  function completeSvgDataUrl(
    html?: Dynamic,
    tagStart?: Dynamic,
    ..._extraArguments223: Dynamic[]
  ): Dynamic {
    let scanner: Dynamic = previewState.g;
    if (scanner === null) return null;
    let abandon: Dynamic = (..._extraArguments224: Dynamic[]): Dynamic => {
      previewState.g = null;
      return null;
    };
    if (scanner && scanner.from !== tagStart) return abandon();
    if (!scanner) {
      let value2: Dynamic =
        /^<([A-Za-z][\w-]*)((?:\s+[\w:-]+(?:=(?:"[^"]*"|'[^']*'))?)*)\s+[\w:-]+=(["'])/.exec(
          html.slice(tagStart),
        );
      if (!value2) return html.length - tagStart > 400 ? abandon() : null;
      let value3: Dynamic = tagStart + value2[0].length;
      let slice: Dynamic = html.slice(value3);
      if (slice.includes(value2[3])) return abandon();
      let value4: Dynamic =
        /url\(\s*(&quot;|&#39;|&apos;|'|")data:image\/svg\+xml((?:;[\w=-]+)*),/i.exec(
          slice,
        );
      if (!value4) return slice.length > 2000 ? abandon() : null;
      if (
        /;base64/i.test(value4[2]) ||
        /url\(/i.test(slice.slice(0, value4.index))
      )
        return abandon();
      scanner = previewState.g = {
        from: tagStart,
        i: value3 + value4.index + value4[0].length,
        Q: value4[1],
        aq: value2[3],
        depth: 0,
        tag: 0,
        q: "",
        name: "",
        closing: false,
        slash: false,
        cut: -1,
        done: false,
        was: -2,
        out: null,
        s0: value3 + value4.index + value4[0].length,
        tail:
          value4[1] +
          ")" +
          value2[3] +
          ">" +
          (VOID_ELEMENTS.has(value2[1].toLowerCase())
            ? ""
            : "</" + value2[1] + ">"),
      };
    }
    while (scanner.i < html.length && !scanner.done) {
      let value2: Dynamic = html[scanner.i];
      let count: Dynamic = 1;
      let value3: Dynamic = value2;
      if (value2 === "&") {
        let match: Dynamic = Object.keys(HTML_ENTITIES).find(
          (input?: Dynamic, ..._extraArguments225: Dynamic[]): Dynamic =>
            html.startsWith(input, scanner.i),
        );
        if (match) {
          value2 = HTML_ENTITIES[match];
          count = match.length;
          value3 = match;
        } else if (html.length - scanner.i < 6) break;
      }
      if (value3 === scanner.Q || value3 === scanner.aq) return abandon();
      if (scanner.i - scanner.s0 > 12000) return abandon();
      if (!scanner.tag) {
        if (value2 === "<") {
          let value4: Dynamic = /^(\/?)([A-Za-z][\w:.-]*)(?=[\s/>]|&gt;)/.exec(
            html.slice(scanner.i + count, scanner.i + count + 40),
          );
          if (!value4) {
            if (
              html.length - scanner.i - count < 40 &&
              /^\/?[\w:.-]*$/.test(html.slice(scanner.i + count))
            )
              break;
            return abandon();
          }
          if (
            ((scanner.name = value4[2].toLowerCase()),
            (scanner.closing = value4[1] === "/"),
            UNSAFE_SVG_ELEMENTS.has(scanner.name) ||
              (scanner.depth === 0 &&
                (scanner.closing || scanner.name !== "svg")))
          )
            return abandon();
          scanner.tag = 1;
          scanner.slash = false;
          scanner.i += count + value4[0].length;
          continue;
        }
      } else if (scanner.q) {
        if (value2 === scanner.q) scanner.q = "";
      } else if (value2 === '"' || value2 === "'") scanner.q = value2;
      else if (value2 === "<") return abandon();
      else if (value2 === ">") {
        if (((scanner.tag = 0), scanner.closing)) scanner.depth--;
        else if (!scanner.slash) scanner.depth++;
        if (scanner.depth < 0) return abandon();
        if (scanner.depth === 1) scanner.cut = scanner.i + count;
        if (scanner.depth === 0) {
          scanner.cut = scanner.i + count;
          scanner.done = true;
        }
      } else scanner.slash = value2 === "/";
      scanner.i += count;
    }
    if (scanner.cut < 0) return null;
    if (scanner.was !== scanner.cut) {
      scanner.was = scanner.cut;
      scanner.out =
        html.slice(tagStart, scanner.cut) +
        (scanner.done ? "" : "</svg>") +
        scanner.tail;
    }
    return scanner.out;
  }
  function resolvePreviewTarget(
    input?: Dynamic,
    ..._extraArguments226: Dynamic[]
  ): Dynamic {
    let value2: Dynamic = project;
    let value3: Dynamic = value2 && value2.one;
    let value4: Dynamic;
    if (value2) value2.previewing = true;
    try {
      for (let [value6, value7] of input)
        if (value6 === "prev") {
          if (!(previousValue instanceof jquery)) return null;
          value4 = previousValue;
        } else if (value6 === "$") value4 = jquery(value7);
        else if (value6 === "files")
          value4 = value3
            ? jquery(document.body).children()
            : jquery(currentElement);
        else if (value6 === "me") {
          let value8: Dynamic = value3 ? null : currentElement;
          if (!value8) return null;
          value4 = jquery(value8);
        } else if (value6 === "k") {
          if (!value3) return null;
          let filtered: Dynamic = String(value7)
            .split(/[\s,]+/)
            .filter(Boolean)
            .map(
              (input2?: Dynamic, ..._extraArguments227: Dynamic[]): Dynamic =>
                value2.elOf.get(
                  /^\d+$/.test(input2) ? value2.P + input2 : input2,
                ),
            )
            .filter(
              (input2?: Dynamic, ..._extraArguments228: Dynamic[]): Dynamic =>
                input2 && value2.fileOf(input2),
            );
          value4 = jquery().pushStack(filtered);
        } else if (value6 === "file") {
          if (!value2) return null;
          let value8: Dynamic =
            value2.paths && value2.paths.has(value7)
              ? value2.paths.get(value7)
              : value7;
          let entry: Dynamic = value2.slides.get(value8);
          if (
            !entry ||
            entry.removed ||
            !(value8 === value2.current ? currentElement : entry.el)
          )
            return null;
          value4 = jquery(
            value8 === value2.current && !value3 ? currentElement : entry.el,
          );
        } else
          value4 =
            value7 === undefined ? value4[value6]() : value4[value6](value7);
    } catch (value6: Dynamic) {
      return null;
    } finally {
      if (value2) value2.previewing = false;
    }
    let value5: Dynamic = value4 && value4[0];
    if (!value5 || value5.nodeType !== 1) return null;
    if (value3 && value5 === document.body)
      return {
        root: true,
      };
    return {
      file: value3
        ? value2.fileOf(value5)
        : value2
          ? value2.current || null
          : null,
      id: value5.getAttribute("id"),
    };
  }
  function previewPending(..._extraArguments229: Dynamic[]): Dynamic {
    if (
      !(limits.previewMs >= 0) ||
      finished ||
      !initialized ||
      (project && project.halted)
    )
      return;
    let value2: Dynamic = useLineSplitter
      ? (pendingCode
          ? pendingCode +
            `
`
          : "") + lineTail
      : stream
        ? stream.tail()
        : "";
    if (!value2.trim()) {
      previewState = null;
      return;
    }
    let value3: Dynamic = stream ? stream.count : 0;
    if (
      !previewState ||
      previewState.key !== value3 ||
      !value2.startsWith(previewState.head)
    )
      previewState = {
        key: value3,
        head: value2.slice(0, Math.min(value2.length, 24)),
        form: undefined,
        dead: false,
        at: 0,
        last: "",
        target: undefined,
        g: undefined,
      };
    if (previewState.dead) return;
    if (previewState.form === undefined) {
      if (
        ((previewState.form = parsePreviewForm(value2)),
        previewState.form === null ||
          (previewState.form === undefined && value2.length > 400))
      )
        previewState.dead = true;
      if (!previewState.form) return;
    }
    let value4: Dynamic = readStringLiteral(value2, previewState.form.at);
    if (!value4) {
      previewState.dead = true;
      return;
    }
    if (value4.closed) {
      let value7: Dynamic = (value2.slice(value4.end + 1).match(/^\s*(\S)/) ||
        [])[1];
      if (value7 === undefined) return;
      if (value7 !== ")" && value7 !== ",") {
        previewState.dead = true;
        return;
      }
    }
    let value5: Dynamic = Date.now();
    if (
      !value4.closed &&
      value5 - previewState.at <
        (pace
          ? Math.max(
              limits.previewMs,
              previewState.last.length / pace.previewCharsPerMs,
            )
          : limits.previewMs)
    )
      return;
    if (pace && previewCount >= pace.maxPreviews) {
      previewState.dead = true;
      return;
    }
    if (previewState.form.steps && previewState.target === undefined) {
      if (
        ((previewState.target = resolvePreviewTarget(previewState.form.steps)),
        !previewState.target)
      ) {
        previewState.dead = true;
        return;
      }
    }
    if (previewState.target && previewState.target.root) {
      if (
        previewState.form.method !== "append" &&
        previewState.form.method !== "prepend"
      ) {
        previewState.dead = true;
        return;
      }
      previewState.form = {
        method: "create",
        at: previewState.form.at,
        steps: null,
      };
      previewState.target = null;
    }
    let value6: Dynamic = truncate(
      sanitizePreviewHtml(value4.value),
      limits.maxHtml,
    );
    if (value4.closed) previewState.dead = true;
    if (
      value6 === previewState.last ||
      !value6 ||
      (!value4.closed && value6.length < previewState.last.length)
    )
      return;
    previewState.last = value6;
    previewState.at = value5;
    previewCount++;
    emit({
      kind: "preview" as const,
      seq: sequence++,
      method: previewState.form.method,
      target: previewState.target || null,
      html: value6,
      head: value2.trimStart().slice(0, 80),
    });
  }
  function chunk(input?: Dynamic, ..._extraArguments230: Dynamic[]): Dynamic {
    if (finished || !initialized) return;
    if (queuedFrames.size) sendQueuedFrames(false);
    if (((input = String(input)), useLineSplitter && !incomingLine)) {
      acceptLineChunk(input);
      previewPending();
      return;
    }
    if (!stream && !useLineSplitter) stream = createSplitter();
    if (
      limits.previewMs >= 0 &&
      input.includes(`
`)
    ) {
      for (let index: Dynamic = 0; index < input.length; ) {
        let value2: Dynamic = input.indexOf(
          `
`,
          index,
        );
        let value3: Dynamic =
          value2 < 0 ? input.slice(index) : input.slice(index, value2);
        if (value3) {
          acceptStreamChunk(value3);
          previewPending();
        }
        if (value2 < 0) break;
        acceptStreamChunk(`
`);
        index = value2 + 1;
      }
      previewPending();
      return;
    }
    acceptStreamChunk(input);
    previewPending();
  }
  function value(..._extraArguments231: Dynamic[]): Dynamic {
    if (finished || !initialized) return;
    if (incomingLine)
      acceptStreamChunk(`
`);
    if (useLineSplitter) endLineInput();
    else if (stream) {
      stream.end();
      stream = null;
    }
    finish();
  }
  function flush(..._extraArguments232: Dynamic[]): Dynamic {
    if (finished || !initialized) return;
    if (queuedFrames.size) sendQueuedFrames(false);
    if (useLineSplitter) {
      if (compiledPending) executePending();
      return;
    }
    if (stream && stream.tail().trim() === "") restartStream();
  }
  function finish(..._extraArguments233: Dynamic[]): Dynamic {
    if (finished || !initialized) return;
    if (((finished = true), clearTimeout(idleTimer), queuedFrames.size))
      sendQueuedFrames(true);
    emit(
      Object.assign(
        {
          kind: "html" as const,
          seq: sequence++,
          html: project && project.one ? "" : lastHtml,
          stmt: "",
          final: true,
        },
        project
          ? {
              slideId: project.current,
            }
          : {},
      ),
    );
  }
  return {
    init: initialize,
    chunk: chunk,
    end: value,
    flush: flush,
    exec: execute,
    finish: finish,
    view: sendFileView,
    handles: sendHandles,
    get html(): Dynamic {
      return lastHtml;
    },
  };
}
export { createEditRuntime, DEFAULT_LIMITS };
