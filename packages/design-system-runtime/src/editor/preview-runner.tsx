import type * as React from "react";
import type * as Editor from "../contracts/editor-runtime";
import type * as Model from "../contracts";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorPreviewRunner(
  runtime: RuntimeBindings,
): () => void {
  var reactPreviewComponents: typeof import("react");
  var PREVIEW_PROJECT_PREFIX: string;
  var CARD_PROJECT_REFERENCE_PATTERN: RegExp;
  var BUNDLE_PROJECT_REFERENCE_PATTERN: RegExp;
  var hasRawProjectReferences: (
    text: string,
    kind: "card" | "bundle",
  ) => boolean;
  var EXECUTABLE_SCRIPT_TYPE_PATTERN: RegExp;
  var SCRIPT_TAG_ATTRIBUTE_PATTERN: RegExp;
  var RELATIVE_SCRIPT_IMPORT_PATTERN: RegExp;
  var RELATIVE_IMPORT_MAP_PATTERN: RegExp;
  var PREVIEW_VALIDATION_BASE_URL: string;
  var BLOCKED_SCRIPT_SOURCE_GUIDANCE: string;
  var BLOCKED_SCRIPT_IMPORT_GUIDANCE: string;
  var RAW_PROJECT_REFERENCE_GUIDANCE: string;
  var PREVIEW_RUNNER_GLOBAL: string;
  var PREVIEW_RUNNER_PATH: string;
  var PREVIEW_RUNNER_REGISTRY_OPTIONS: Editor.PreviewRegistryOptions;
  var PREVIEW_RUNNER_BACKOFF_MS: number[];
  var componentPreviewPath: (name: string) => string;
  function getOrCreatePreviewDocumentRegistry<Doc, State extends object>(
    environment: object,
    options: Editor.PreviewRegistryOptions,
    createState: () => State,
  ): Editor.StatefulPreviewRegistry<Doc, State> {
    let globalObject = environment as Record<string, unknown>,
      existing = globalObject[options.global];
    if (
      existing != null &&
      (existing as Partial<Editor.PreviewDocumentRegistry<Doc>>).docs instanceof
        Map
    ) {
      return existing as Editor.StatefulPreviewRegistry<Doc, State>;
    }
    let documents = new Map<string, Doc>(),
      waiting = new Map<string, Editor.PreviewWaiting>(),
      registry: Editor.StatefulPreviewRegistry<Doc, State> = {
        ...createState(),
        docs: documents,
        waiting: waiting,
        seq: 0,
        tookAt: 0,
        take: (input: string) => {
          let entry = documents.get(input);
          if (entry !== undefined) {
            registry.tookAt = performance.now();
            try {
              waiting.get(input)?.taken?.();
            } catch {}
          }
          documents.delete(input);
          waiting.delete(input);
          return entry;
        },
      };
    globalObject[options.global] = registry;
    return registry;
  }
  function registerPreviewDocument<Doc>(
    registry: Editor.PreviewDocumentRegistry<Doc>,
    options: Editor.PreviewRegistryOptions,
    document2: Doc,
    waiting?: Editor.PreviewWaiting,
  ): string {
    registry.seq += 1;
    let token: string = options.tokenPrefix + String(registry.seq);
    registry.docs.set(token, document2);
    if (waiting !== undefined) {
      registry.waiting.set(token, waiting);
    }
    return token;
  }
  function removePreviewDocument(
    registry: Editor.PreviewDocumentRegistry<unknown>,
    token: string,
  ): void {
    registry.docs.delete(token);
    registry.waiting.delete(token);
  }
  function encodedPreviewPathname(path: string, baseURI: string): string {
    return new URL(path.split("/").map(encodeURIComponent).join("/"), baseURI)
      .pathname;
  }
  function trimScriptAttributeWhitespace(text: string): string {
    let start: number = 0,
      end = text.length;
    while (start < end && text.charCodeAt(start) <= 32) {
      start++;
    }
    while (end > start && text.charCodeAt(end - 1) <= 32) {
      end--;
    }
    return text.slice(start, end);
  }
  function isDisallowedRelativeScriptSource(
    src: string,
    cardPath: string,
  ): boolean {
    if (/[&\\]/.test(src)) {
      return true;
    }
    try {
      let value = new URL(
          src,
          PREVIEW_VALIDATION_BASE_URL +
            cardPath.split("/").map(encodeURIComponent).join("/"),
        ),
        pathname = new URL(PREVIEW_PROJECT_PREFIX, PREVIEW_VALIDATION_BASE_URL)
          .pathname,
        value2 = decodeURIComponent(value.pathname)
          .toLowerCase()
          .replace(/\/+/g, "/")
          .replace(/\/$/, "");
      if (
        value.origin !== new URL(PREVIEW_VALIDATION_BASE_URL).origin ||
        !value2.startsWith(pathname) ||
        /[\\\u0000-\u001f]|\/\.\.?(?:\/|$)/.test(value2)
      ) {
        return true;
      }
      let value3 = value2.slice(pathname.length);
      return (
        value3.startsWith(runtime.DESIGN_SYSTEM_PATHS.libDir) ||
        /(?:^|\/)_vendor\/|(?:^|\/)(?:_ds_)?bundle\.js$/.test(value3)
      );
    } catch {
      return true;
    }
  }
  function blockedPreviewScriptReference(
    html: string,
    cardPath: string,
    strict: boolean = false,
  ): boolean | string {
    let findNext = (input: RegExp, options: number) => {
        input.lastIndex = options;
        return input.exec(html)?.index ?? -1;
      },
      openScriptPattern: RegExp = /<script/gi,
      closeScriptPattern: RegExp = /<\/script[ \t\n\f\r/>]/gi,
      scriptEnd = -2,
      scannedInlineEnd = 0,
      scannedImportMapEnd = 0,
      hasBaseTag = /<base[ \t\n\f\r/>]/i.test(html);
    for (let value = findNext(openScriptPattern, 0); value >= 0; ) {
      let value2 = value + 7;
      if (value2 < html.length && !/[ \t\n\f\r/>]/.test(html[value2])) {
        value = findNext(openScriptPattern, value2);
        continue;
      }
      for (
        let text = "",
          flag = false,
          flag2: boolean = false,
          flag3: boolean = false;
        value2 < html.length;
        value2++
      ) {
        let value7 = html[value2],
          value8 =
            value7 === " " ||
            value7 ===
              `
` ||
            value7 === "\t" ||
            value7 === "\f" ||
            value7 === "\r";
        if (text !== "") {
          text = value7 === text ? "" : text;
        } else if (value7 === ">") {
          break;
        } else if (flag3) {
          flag3 = !value8;
        } else if (flag2) {
          if (!value8) {
            if (((flag2 = false), value7 === '"' || value7 === "'")) {
              text = value7;
            } else {
              flag3 = true;
            }
          }
        } else if (!flag) {
          flag = !value8 && value7 !== "/";
        } else if (value7 === "/" || value7 === "=") {
          flag = false;
          flag2 = value7 === "=";
        }
      }
      let value3: string | undefined, value4: string | undefined;
      for (let value7 of html
        .slice(value + 7, value2)
        .matchAll(SCRIPT_TAG_ATTRIBUTE_PATTERN)) {
        let value8 = trimScriptAttributeWhitespace(
          value7[2] ?? value7[3] ?? value7[4] ?? "",
        );
        if (value7[1].toLowerCase() === "type") {
          value3 ??= value8.toLowerCase();
        } else if (value7[1].toLowerCase() === "src") {
          value4 ??= value8;
        }
      }
      let value5 = EXECUTABLE_SCRIPT_TYPE_PATTERN.test(value3 ?? ""),
        value6 = scriptEnd === -1 || value < scriptEnd;
      if (!value6) {
        scriptEnd = findNext(closeScriptPattern, value2);
      }
      if (value4 !== undefined) {
        if (
          value5 &&
          value4 !== "" &&
          !/^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(value4) &&
          (strict ||
            value6 ||
            hasBaseTag ||
            isDisallowedRelativeScriptSource(value4, cardPath))
        ) {
          return value4;
        }
      } else if (!strict && (value5 || value3 === "importmap")) {
        if (scriptEnd !== -1 && scriptEnd < value2) {
          scriptEnd = findNext(closeScriptPattern, value2);
        }
        let value7 = scriptEnd < 0 ? html.length : scriptEnd,
          value8: boolean = value3 === "importmap";
        if (
          value7 > (value8 ? scannedImportMapEnd : scannedInlineEnd) &&
          (value8
            ? RELATIVE_IMPORT_MAP_PATTERN
            : RELATIVE_SCRIPT_IMPORT_PATTERN
          ).test(html.slice(value2 + 1, value7))
        ) {
          return true;
        }
        if (value8) {
          scannedImportMapEnd = value7;
        } else {
          scannedInlineEnd = value7;
        }
      }
      value = findNext(openScriptPattern, value2);
    }
    return false;
  }
  function previewRunnerRegistry(
    environment: object,
  ): Editor.PreviewRunnerRegistry {
    return getOrCreatePreviewDocumentRegistry(
      environment,
      PREVIEW_RUNNER_REGISTRY_OPTIONS,
      () => ({
        on: false,
        worked: false,
        strikes: 0,
        struckAt: 0,
        off: false,
        refusals: 0,
        pauses: PREVIEW_RUNNER_BACKOFF_MS,
        refusedSeq: 0,
        refusedAt: 0,
        suspended: false,
      }),
    );
  }
  function enablePreviewRunner(
    environment: object = window,
    signal?: AbortSignal,
    pauses: number[] = PREVIEW_RUNNER_BACKOFF_MS,
  ): void {
    previewRunnerRegistry(environment).on = true;
    if (pauses.length > 0) {
      previewRunnerRegistry(environment).pauses = pauses;
    }
    if (signal?.aborted === true) {
      suspendPreviewRunner(environment);
    } else {
      signal?.addEventListener(
        "abort",
        () => suspendPreviewRunner(environment),
        {
          once: true,
        },
      );
    }
  }
  function isPreviewRunnerCoolingDown(environment: object): boolean {
    let registry = previewRunnerRegistry(environment);
    return (
      !registry.off &&
      registry.refusals > 0 &&
      performance.now() - registry.refusedAt <
        registry.pauses[Math.min(registry.refusals, registry.pauses.length) - 1]
    );
  }
  function isPreviewRunnerAvailable(environment: object): boolean {
    let registry = previewRunnerRegistry(environment);
    return (
      registry.on &&
      !registry.off &&
      !registry.suspended &&
      !isPreviewRunnerCoolingDown(environment)
    );
  }
  function isPreviewRunnerEnabled(environment: object): boolean {
    return previewRunnerRegistry(environment).on;
  }
  function wasPreviewRunnerRecentlyTaken(
    environment: object,
    withinMs: number,
  ): boolean {
    let takenAt = previewRunnerRegistry(environment).tookAt;
    return takenAt > 0 && performance.now() - takenAt < withinMs;
  }
  function suspendPreviewRunner(environment: object = window): void {
    let registry = previewRunnerRegistry(environment);
    registry.suspended = true;
    let waiting = [...registry.waiting.values()];
    registry.waiting.clear();
    for (let value of waiting) {
      try {
        value.remove();
      } catch {}
    }
    for (let value of waiting) {
      try {
        value.notify();
      } catch {}
    }
  }
  function recordPreviewRunnerOutcome(
    environment: object,
    outcome: string,
    token: string,
  ): {
    tell: boolean;
  } {
    let registry = previewRunnerRegistry(environment);
    if (outcome === "worked") {
      registry.worked = true;
      registry.refusals = 0;
      if (!registry.off) {
        registry.strikes = 0;
      }
      return {
        tell: false,
      };
    }
    let sequence: number = Number(
      token.slice(PREVIEW_RUNNER_REGISTRY_OPTIONS.tokenPrefix.length),
    );
    if (outcome === "refused") {
      let value: boolean = registry.refusals === 0;
      if (sequence > registry.refusedSeq) {
        registry.refusals += 1;
        registry.refusedSeq = registry.seq;
      }
      registry.refusedAt = performance.now();
      return {
        tell: value,
      };
    }
    if (sequence > registry.struckAt) {
      registry.strikes += 1;
      registry.struckAt = registry.seq;
    }
    if (registry.strikes >= 2) {
      registry.off = true;
    }
    return {
      tell: true,
    };
  }
  function previewRunnerAddresses(
    path: string,
    baseURI: string,
  ): {
    runner: string;
    card: string;
  } | null {
    try {
      let value = encodedPreviewPathname(path, baseURI);
      if (value.startsWith(new URL(PREVIEW_PROJECT_PREFIX, baseURI).pathname)) {
        return {
          runner: new URL(PREVIEW_RUNNER_PATH, baseURI).pathname,
          card: value,
        };
      } else {
        return null;
      }
    } catch {
      return null;
    }
  }
  function registerPreviewRunnerDocument(
    environment: object,
    url: string,
    html: string,
    waiting?: Editor.PreviewWaiting,
  ): string {
    return registerPreviewDocument(
      previewRunnerRegistry(environment),
      PREVIEW_RUNNER_REGISTRY_OPTIONS,
      {
        url: url,
        html: html,
      },
      waiting,
    );
  }
  function removePreviewRunnerDocument(
    environment: object,
    token: string,
  ): void {
    removePreviewDocument(previewRunnerRegistry(environment), token);
  }
  function hasPreviewRunnerDocument(
    environment: object,
    token: string,
  ): boolean {
    return previewRunnerRegistry(environment).docs.has(token);
  }
  bindRuntimeValue(
    runtime,
    "reactPreviewComponents",
    () => reactPreviewComponents,
    (value) => {
      reactPreviewComponents = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getOrCreatePreviewDocumentRegistry",
    () => getOrCreatePreviewDocumentRegistry,
  );
  bindRuntimeValue(
    runtime,
    "registerPreviewDocument",
    () => registerPreviewDocument,
  );
  bindRuntimeValue(
    runtime,
    "removePreviewDocument",
    () => removePreviewDocument,
  );
  bindRuntimeValue(
    runtime,
    "encodedPreviewPathname",
    () => encodedPreviewPathname,
  );
  bindRuntimeValue(
    runtime,
    "PREVIEW_PROJECT_PREFIX",
    () => PREVIEW_PROJECT_PREFIX,
    (value) => {
      PREVIEW_PROJECT_PREFIX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CARD_PROJECT_REFERENCE_PATTERN",
    () => CARD_PROJECT_REFERENCE_PATTERN,
    (value) => {
      CARD_PROJECT_REFERENCE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BUNDLE_PROJECT_REFERENCE_PATTERN",
    () => BUNDLE_PROJECT_REFERENCE_PATTERN,
    (value) => {
      BUNDLE_PROJECT_REFERENCE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hasRawProjectReferences",
    () => hasRawProjectReferences,
    (value) => {
      hasRawProjectReferences = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EXECUTABLE_SCRIPT_TYPE_PATTERN",
    () => EXECUTABLE_SCRIPT_TYPE_PATTERN,
    (value) => {
      EXECUTABLE_SCRIPT_TYPE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SCRIPT_TAG_ATTRIBUTE_PATTERN",
    () => SCRIPT_TAG_ATTRIBUTE_PATTERN,
    (value) => {
      SCRIPT_TAG_ATTRIBUTE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "trimScriptAttributeWhitespace",
    () => trimScriptAttributeWhitespace,
  );
  bindRuntimeValue(
    runtime,
    "RELATIVE_SCRIPT_IMPORT_PATTERN",
    () => RELATIVE_SCRIPT_IMPORT_PATTERN,
    (value) => {
      RELATIVE_SCRIPT_IMPORT_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RELATIVE_IMPORT_MAP_PATTERN",
    () => RELATIVE_IMPORT_MAP_PATTERN,
    (value) => {
      RELATIVE_IMPORT_MAP_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PREVIEW_VALIDATION_BASE_URL",
    () => PREVIEW_VALIDATION_BASE_URL,
    (value) => {
      PREVIEW_VALIDATION_BASE_URL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isDisallowedRelativeScriptSource",
    () => isDisallowedRelativeScriptSource,
  );
  bindRuntimeValue(
    runtime,
    "blockedPreviewScriptReference",
    () => blockedPreviewScriptReference,
  );
  bindRuntimeValue(
    runtime,
    "BLOCKED_SCRIPT_SOURCE_GUIDANCE",
    () => BLOCKED_SCRIPT_SOURCE_GUIDANCE,
    (value) => {
      BLOCKED_SCRIPT_SOURCE_GUIDANCE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BLOCKED_SCRIPT_IMPORT_GUIDANCE",
    () => BLOCKED_SCRIPT_IMPORT_GUIDANCE,
    (value) => {
      BLOCKED_SCRIPT_IMPORT_GUIDANCE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RAW_PROJECT_REFERENCE_GUIDANCE",
    () => RAW_PROJECT_REFERENCE_GUIDANCE,
    (value) => {
      RAW_PROJECT_REFERENCE_GUIDANCE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PREVIEW_RUNNER_GLOBAL",
    () => PREVIEW_RUNNER_GLOBAL,
    (value) => {
      PREVIEW_RUNNER_GLOBAL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PREVIEW_RUNNER_PATH",
    () => PREVIEW_RUNNER_PATH,
    (value) => {
      PREVIEW_RUNNER_PATH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PREVIEW_RUNNER_REGISTRY_OPTIONS",
    () => PREVIEW_RUNNER_REGISTRY_OPTIONS,
    (value) => {
      PREVIEW_RUNNER_REGISTRY_OPTIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "previewRunnerRegistry",
    () => previewRunnerRegistry,
  );
  bindRuntimeValue(
    runtime,
    "PREVIEW_RUNNER_BACKOFF_MS",
    () => PREVIEW_RUNNER_BACKOFF_MS,
    (value) => {
      PREVIEW_RUNNER_BACKOFF_MS = value;
    },
  );
  bindRuntimeValue(runtime, "enablePreviewRunner", () => enablePreviewRunner);
  bindRuntimeValue(
    runtime,
    "isPreviewRunnerCoolingDown",
    () => isPreviewRunnerCoolingDown,
  );
  bindRuntimeValue(
    runtime,
    "isPreviewRunnerAvailable",
    () => isPreviewRunnerAvailable,
  );
  bindRuntimeValue(
    runtime,
    "isPreviewRunnerEnabled",
    () => isPreviewRunnerEnabled,
  );
  bindRuntimeValue(
    runtime,
    "wasPreviewRunnerRecentlyTaken",
    () => wasPreviewRunnerRecentlyTaken,
  );
  bindRuntimeValue(runtime, "suspendPreviewRunner", () => suspendPreviewRunner);
  bindRuntimeValue(
    runtime,
    "recordPreviewRunnerOutcome",
    () => recordPreviewRunnerOutcome,
  );
  bindRuntimeValue(
    runtime,
    "componentPreviewPath",
    () => componentPreviewPath,
    (value) => {
      componentPreviewPath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "previewRunnerAddresses",
    () => previewRunnerAddresses,
  );
  bindRuntimeValue(
    runtime,
    "registerPreviewRunnerDocument",
    () => registerPreviewRunnerDocument,
  );
  bindRuntimeValue(
    runtime,
    "removePreviewRunnerDocument",
    () => removePreviewRunnerDocument,
  );
  bindRuntimeValue(
    runtime,
    "hasPreviewRunnerDocument",
    () => hasPreviewRunnerDocument,
  );
  return () => {
    reactPreviewComponents = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    PREVIEW_PROJECT_PREFIX = "project/";
    CARD_PROJECT_REFERENCE_PATTERN =
      /(?:^|["'`(=,;\s])(?:\.\\?\/)*(?:_blob|project)\\?\//;
    BUNDLE_PROJECT_REFERENCE_PATTERN =
      /(?:["'`=]|\(\s*)(?:\.\\?\/)*(?:_blob|project)\\?\//;
    hasRawProjectReferences = (text: string, kind: "card" | "bundle") =>
      (kind === "card"
        ? CARD_PROJECT_REFERENCE_PATTERN
        : BUNDLE_PROJECT_REFERENCE_PATTERN
      ).test(text);
    EXECUTABLE_SCRIPT_TYPE_PATTERN =
      /^(?:module|text\/(?:javascript(?:1\.[0-5])?|ecmascript|jscript|livescript|x-javascript|x-ecmascript)|application\/(?:javascript|ecmascript|x-javascript|x-ecmascript))?$/;
    SCRIPT_TAG_ATTRIBUTE_PATTERN =
      /(=?[^ \t\n\f\r=/>]+)[ \t\n\f\r]*(?:=[ \t\n\f\r]*(?:"([^"]*)"|'([^']*)'|([^ \t\n\f\r>]+)))?/g;
    RELATIVE_SCRIPT_IMPORT_PATTERN =
      /\bimport\s*(?:\(\s*)?["'`]\.{1,2}\/|\bfrom\s*["'`]\.{1,2}\//;
    RELATIVE_IMPORT_MAP_PATTERN = /:\s*"\.{1,2}\//;
    PREVIEW_VALIDATION_BASE_URL = "https://card.invalid/0/0/";
    BLOCKED_SCRIPT_SOURCE_GUIDANCE =
      'Remove the tag if it loads components/bundle.js or a library: those are already provided. A script of the card’s own does not hold the preview when a plain <script src> tag names it under project/, outside components/lib/ and _vendor/, not called bundle.js or _ds_bundle.js, with no "&" or "\\" in the path, no <base> tag in the card, and the tag not written from a script’s text.';
    BLOCKED_SCRIPT_IMPORT_GUIDANCE =
      "Remove the import (one inside a comment or a string counts too), or load the file with a plain <script src> tag.";
    RAW_PROJECT_REFERENCE_GUIDANCE =
      'Write the reference as "/_blob/<id>" or relative to the card';
    PREVIEW_RUNNER_GLOBAL = "__dsPreviewRunner";
    PREVIEW_RUNNER_PATH = "artifact-type/run.html";
    PREVIEW_RUNNER_REGISTRY_OPTIONS = {
      global: PREVIEW_RUNNER_GLOBAL,
      tokenPrefix: "r",
    };
    PREVIEW_RUNNER_BACKOFF_MS = [150, 300, 600, 1000, 2000];
    componentPreviewPath = (componentName: string): string =>
      runtime.DESIGN_SYSTEM_PATHS.componentsDir +
      componentName +
      "/" +
      runtime.COMPONENT_FILENAMES.preview;
  };
}
