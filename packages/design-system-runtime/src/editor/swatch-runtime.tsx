import type * as React from "react";
import type * as Editor from "../contracts/editor-runtime";
import type * as Model from "../contracts";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorSwatchRuntime(
  runtime: RuntimeBindings,
): () => void {
  var reactSwatchPreview: typeof import("react");
  var SWATCH_NAVIGATING_MESSAGE: string;
  var SWATCH_READY_MESSAGE: string;
  var SWATCH_ERROR_MESSAGE: string;
  var SWATCH_REACT_ERROR_MESSAGE: string;
  var MISSING_REACT_ERROR_PATTERN: RegExp;
  var PREVIEW_STORAGE_PREFIX: string;
  var PREVIEW_SCOPED_STORAGE_SCRIPT: string;
  var createPreviewLifecycleScript: (
    admittedCdnPrefixes: readonly string[],
  ) => string;
  var SWATCH_ATTRIBUTE: string;
  var PREVIEW_BOOT_TIMEOUT_MS: number;
  var PREVIEW_IFRAME_SANDBOX: string;
  var ADMITTED_PREVIEW_CDN_PREFIXES: string[];
  var PREVIEW_LIFECYCLE_SCRIPT: string;
  var clearedPreviewStorageWindows: WeakSet<object>;
  var swatchHeadKeyCache: WeakMap<Editor.PreviewRuntimeHead, string>;
  var swatchRuntimeKeyCache: WeakMap<Editor.PreviewRuntimeHead, string>;
  var SWATCH_HEAD_REGISTRY_GLOBAL: string;
  var SWATCH_HEAD_SEQUENCE_GLOBAL: string;
  var registeredSwatchHeadIds: WeakMap<Editor.PreviewRuntimeHead, string>;
  var ALL_SWATCH_HEAD_PIECES: "all";
  var SWATCH_PIECE_ATTRIBUTE: string;
  var SWATCH_FAILED_ATTRIBUTE: string;
  var SWATCH_LOCAL_URL_PATTERN: RegExp;
  var SWATCH_SHA256_INTEGRITY_PATTERN: RegExp;
  var SWATCH_THEME_ID_PATTERN: RegExp;
  var SWATCH_RUNTIME_TAG_URL_PATTERN: RegExp;
  var SWATCH_SHA384_INTEGRITY_PATTERN: RegExp;
  var SWATCH_PLACED_ATTRIBUTE: string;
  var bundlePageAddressReferenceCache: WeakMap<
    Editor.PreviewRuntimeHead,
    boolean
  >;
  var reportedPageAddressReasons: WeakMap<object, Set<string>>;
  function escapeScriptJson(json: string): string {
    return json.replaceAll("<", "\\u003c");
  }
  function previewIsolationScript(): string {
    return (
      `(function () {
  var rtc = ['RTCPeerConnection', 'webkitRTCPeerConnection', 'RTCDataChannel', 'RTCIceCandidate', 'RTCSessionDescription', 'RTCRtpSender', 'RTCRtpReceiver'];
  var rtcFailed = 0;
  for (var r = 0; r < rtc.length; r++) {
    try {
      Object.defineProperty(window, rtc[r], { value: undefined, writable: false, configurable: false });
    } catch (e1) {
      try { delete window[rtc[r]]; } catch (e2) {}
      try { Object.defineProperty(window, rtc[r], { value: undefined, writable: false, configurable: true }); } catch (e3) {}
    }
    if (typeof window[rtc[r]] === 'function') rtcFailed++;
  }
  if (rtcFailed > 0) {
    try { parent.postMessage({ type: 'ds-swatch:error' }, '*'); } catch (e4) {}
  }
})();
` + PREVIEW_SCOPED_STORAGE_SCRIPT
    );
  }
  function clearPreviewStorageOnce(
    environment: Pick<Window, "localStorage" | "sessionStorage">,
  ): void {
    if (clearedPreviewStorageWindows.has(environment)) {
      return;
    }
    clearedPreviewStorageWindows.add(environment);
    for (let value of ["localStorage", "sessionStorage"] as const) {
      try {
        let value2 = environment[value],
          items = [];
        for (let index: number = 0; index < value2.length; index++) {
          let value3 = value2.key(index);
          if (value3 !== null && value3.indexOf(PREVIEW_STORAGE_PREFIX) === 0) {
            items.push(value3);
          }
        }
        for (let value3 of items) {
          value2.removeItem(value3);
        }
      } catch {}
    }
  }
  function swatchContentHash(text: string): string {
    let hash: number = 2166136261;
    for (let index: number = 0; index < text.length; index++) {
      hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
    }
    return String(text.length) + ":" + (hash >>> 0).toString(36);
  }
  function swatchHeadKey(head: Editor.PreviewRuntimeHead): string {
    let cached = swatchHeadKeyCache.get(head);
    if (cached !== undefined) {
      return cached;
    }
    let key: string =
      [
        swatchContentHash(head.tokensCss),
        swatchContentHash(head.fontsKey ?? ""),
        swatchContentHash(head.bundleCss),
        swatchRuntimeKey(head),
      ].join("|") +
      "|" +
      (head.themeId ?? "") +
      "|" +
      (head.mode ?? "");
    swatchHeadKeyCache.set(head, key);
    return key;
  }
  function swatchRuntimeKey(head: Editor.PreviewRuntimeHead): string {
    let cached = swatchRuntimeKeyCache.get(head);
    if (cached !== undefined) {
      return cached;
    }
    let key = (head.runtimeTags ?? [])
        .map((input): string => input.src + "#" + input.integrity)
        .join(","),
      value: string =
        (key === "" ? "" : key + "|") +
        head.runtimeScripts.map(swatchContentHash).join(",") +
        "|" +
        swatchContentHash(head.bundleJs);
    swatchRuntimeKeyCache.set(head, value);
    return value;
  }
  function swatchHeadsEqual(
    left: Editor.PreviewRuntimeHead,
    right: Editor.PreviewRuntimeHead,
  ): void {
    if (
      !(
        right.tokensCss === left.tokensCss &&
        right.fontsKey === left.fontsKey &&
        right.bundleCss === left.bundleCss &&
        right.bundleJs === left.bundleJs &&
        right.themeId === left.themeId &&
        right.mode === left.mode &&
        right.runtimeScripts.length === left.runtimeScripts.length &&
        right.runtimeScripts.every(
          (input, options): boolean => input === left.runtimeScripts[options],
        ) &&
        JSON.stringify(right.runtimeTags ?? []) ===
          JSON.stringify(left.runtimeTags ?? [])
      )
    ) {
      return;
    }
    let entry = swatchHeadKeyCache.get(left),
      entry2 = swatchRuntimeKeyCache.get(left);
    if (entry !== undefined) {
      swatchHeadKeyCache.set(right, entry);
    }
    if (entry2 !== undefined) {
      swatchRuntimeKeyCache.set(right, entry2);
    }
  }
  function nextSwatchHeadId(environment: object): string {
    let globalObject = environment as Record<string, unknown>,
      sequence =
        (typeof globalObject[SWATCH_HEAD_SEQUENCE_GLOBAL] === "number"
          ? (globalObject[SWATCH_HEAD_SEQUENCE_GLOBAL] as number)
          : 0) + 1;
    globalObject[SWATCH_HEAD_SEQUENCE_GLOBAL] = sequence;
    return "h" + String(sequence);
  }
  function swatchHeadRegistry(
    environment: object,
  ): Map<string, Editor.SwatchHeadEntry> {
    let globalObject = environment as Record<string, unknown>,
      registry = globalObject[SWATCH_HEAD_REGISTRY_GLOBAL];
    if (registry === undefined) {
      registry = new Map();
      globalObject[SWATCH_HEAD_REGISTRY_GLOBAL] = registry;
    }
    return registry as Map<string, Editor.SwatchHeadEntry>;
  }
  function swatchHeadPieceReference(
    head: Editor.PreviewRuntimeHead,
    piece: string | number,
  ): Editor.SwatchUrlReference | undefined {
    let urls = head.urls;
    if (urls === undefined) {
      return;
    }
    if (piece === "c") {
      return urls.bundleCss;
    }
    if (piece === "b") {
      return urls.bundleJs;
    }
    let value = typeof piece === "string" ? /^f([0-9]+)$/.exec(piece) : null;
    if (value !== null) {
      return urls.fonts[Number(value[1])];
    }
    if (
      typeof piece === "number" ||
      (typeof piece === "string" && /^[0-9]+$/.test(piece))
    ) {
      return urls.runtimeScripts[Number(piece)];
    } else {
      return undefined;
    }
  }
  function retainSwatchHead(
    environment: object,
    head: Editor.PreviewRuntimeHead,
    onMissed?: (reference: Editor.SwatchUrlReference) => void,
  ): string {
    let registry = swatchHeadRegistry(environment),
      existingId = registeredSwatchHeadIds.get(head),
      existing =
        existingId === undefined ? undefined : registry.get(existingId);
    if (
      existingId !== undefined &&
      existing !== undefined &&
      existing.head === head
    ) {
      existing.refs += 1;
      return existingId;
    }
    existingId = nextSwatchHeadId(environment);
    registeredSwatchHeadIds.set(head, existingId);
    let id = (input: string | number): void => {
      let value = swatchHeadPieceReference(head, input);
      if (value !== undefined) {
        onMissed?.(value);
      }
    };
    registry.set(existingId, {
      head: head,
      refs: 1,
      missed: id,
    });
    return existingId;
  }
  function releaseSwatchHead(environment: object, id: string): void {
    let registry = swatchHeadRegistry(environment),
      entry = registry.get(id);
    if (entry === undefined) {
      return;
    }
    entry.refs -= 1;
    if (entry.refs <= 0) {
      registry.delete(id);
    }
  }
  function swatchHeadScript(
    id: string,
    pieces: "all" | readonly Editor.HeadScriptPiece[] = ALL_SWATCH_HEAD_PIECES,
    withUrlFallback: boolean = false,
  ): string {
    if (!/^h[0-9]+$/.test(id)) {
      throw Error("swatch head id outside its grammar: " + id);
    }
    if (pieces !== ALL_SWATCH_HEAD_PIECES) {
      return swatchHeadPiecesScript(id, pieces, withUrlFallback);
    }
    return (
      `(function () {
  var d = document, h = d.head || d.documentElement;
  var reg = parent['` +
      SWATCH_HEAD_REGISTRY_GLOBAL +
      `'];
  var e = reg && typeof reg.get === 'function' ? reg.get('` +
      id +
      `') : undefined;
  if (!e || !e.head) throw new Error('design-system preview: head ` +
      id +
      ` is not on the page');
  var H = e.head;
  function css(t) { if (!t) return; var s = d.createElement('style'); s.textContent = t; h.appendChild(s); }
  function js(t) { if (!t) return; var s = d.createElement('script'); s.text = t; h.appendChild(s); }
  css('html{overflow:hidden!important}');
  css(H.tokensCss);
  css(H.fontsCss);
  css(H.bundleCss);
  H.runtimeScripts.forEach(function (t) { js(t); });
  js(H.bundleJs);
})();`
    );
  }
  function swatchHeadPiecesScript(
    id: string,
    pieces: readonly Editor.HeadScriptPiece[],
    withUrlFallback: boolean,
  ): string {
    let callback = (input: Editor.HeadScriptPiece) => {
      if (typeof input === "number") {
        if (!Number.isInteger(input) || input < 0) {
          throw Error(
            "swatch head piece outside its grammar: " + String(input),
          );
        }
        return (
          "  js(H.runtimeScripts[" +
          String(input) +
          `]);
`
        );
      }
      return {
        o: `  css('html{overflow:hidden!important}');
`,
        t: `  css(H.tokensCss);
`,
        f: `  F = css(H.fontsCss); byUrlFaces = !!F;
`,
        F: `  css(H.fontsCssHeld || H.fontsCss);
`,
        c: `  css(H.bundleCss);
`,
        b: `  js(H.bundleJs);
`,
      }[input];
    };
    return (
      `(function () {
  var d = document, h = d.head || d.documentElement, F = null, byUrlFaces = false;
  var reg = parent['` +
      SWATCH_HEAD_REGISTRY_GLOBAL +
      `'];
  var e = reg && typeof reg.get === 'function' ? reg.get('` +
      id +
      `') : undefined;
  if (!e || !e.head) throw new Error('design-system preview: head ` +
      id +
      ` is not on the page');
  var H = e.head, U = H.urls || {};
` +
      (withUrlFallback
        ? "  var L = U.bundleCss ? d.querySelector('head > link[" +
          SWATCH_PIECE_ATTRIBUTE +
          `="c"]') : null;
  if (L && L.getAttribute('href') !== U.bundleCss.url) L = null;
`
        : `  var L = null;
`) +
      `  function css(t) { if (!t) return null; var s = d.createElement('style'); s.textContent = t; if (L) h.insertBefore(s, L); else h.appendChild(s); return s; }
  function js(t) { if (!t) return; var s = d.createElement('script'); s.text = t; h.appendChild(s); }
` +
      (withUrlFallback
        ? `  function missed(k) { try { if (typeof e.missed === 'function') e.missed(k); } catch (x) {} }
  d.addEventListener('error', function (ev) {
    var t = ev.target, k = t && t.tagName === 'SCRIPT' && t.getAttribute ? t.getAttribute('` +
          SWATCH_PIECE_ATTRIBUTE +
          `') : null;
    var u = k === 'b' ? U.bundleJs : k === null ? undefined : (U.runtimeScripts || [])[Number(k)];
    var text = k === 'b' ? H.bundleJs : H.runtimeScripts[Number(k)];
    if (!u || t.getAttribute('src') !== u.url || typeof text !== 'string' || !t.parentNode) return;
    var s = d.createElement('script');
    s.text = text;
    t.parentNode.replaceChild(s, t);
    missed(k === 'b' ? k : Number(k));
  }, true);
  try {
    var norm = function (v) { v = String(v).replace(/^["']|["']$/g, '').toLowerCase(); return v === 'normal' ? '400' : v === 'bold' ? '700' : v; };
    var slant = function (v) { return String(v).toLowerCase().split(' ')[0]; };
    var ask = typeof fetch === 'function' ? fetch : null, asked = {};
    d.fonts.addEventListener('loadingerror', function (ev) {
      if (!byUrlFaces) return;
      var faces = ev.fontfaces || [], ours = U.fonts || [];
      for (var i = faces.length - 1; i >= 0; i--) for (var j = ours.length - 1; j >= 0; j--) {
        var a = faces[i], b = ours[j].face;
        if (!H.fontsCssHeld || !b || norm(a.family) !== norm(b.family) || norm(a.weight) !== norm(b.weight) || slant(a.style) !== slant(b.style)) continue;
        if (F) { F.textContent = H.fontsCssHeld; F = null; }
        if (asked[j] || !ask) continue;
        asked[j] = 1;
        (function (j) {
          var told = function () { missed('f' + j); };
          try {
            ask(ours[j].url).then(function (r) {
              if (!r.ok) told();
              try { if (r.body) r.body.cancel(); } catch (x) {}
            }, told);
          } catch (x) {}
        })(j);
      }
    });
  } catch (x) {}
`
        : "") +
      pieces.map(callback).join("") +
      (withUrlFallback
        ? `  function sheetFailed() { if (!L || !L.parentNode) return; var s = d.createElement('style'); s.textContent = H.bundleCss; L.parentNode.replaceChild(s, L); L = null; missed('c'); }
  if (L) { if (L.hasAttribute('` +
          SWATCH_FAILED_ATTRIBUTE +
          `')) sheetFailed(); else L.addEventListener('error', sheetFailed); }
`
        : "") +
      "})();"
    );
  }
  function swatchPublishedPieceTag(
    piece: string | number,
    reference: Editor.SwatchUrlReference,
  ): string | undefined {
    if (
      !SWATCH_LOCAL_URL_PATTERN.test(reference.url) ||
      reference.integrity === undefined ||
      !SWATCH_SHA256_INTEGRITY_PATTERN.test(reference.integrity)
    ) {
      return;
    }
    let attributes: string =
      '="' +
      reference.url +
      '" integrity="' +
      reference.integrity +
      '" ' +
      SWATCH_PIECE_ATTRIBUTE +
      '="' +
      String(piece) +
      '"';
    if (piece === "c") {
      return (
        '<link rel="stylesheet" href' +
        attributes +
        ` onerror="this.setAttribute('` +
        SWATCH_FAILED_ATTRIBUTE +
        `','')">`
      );
    } else {
      return "<script src" + attributes + "><\/script>";
    }
  }
  function swatchHtmlAttributes(head: Editor.PreviewRuntimeHead): string {
    let themeId =
        head.themeId !== undefined && SWATCH_THEME_ID_PATTERN.test(head.themeId)
          ? head.themeId
          : "",
      mode = head.mode === "dark" || head.mode === "light" ? head.mode : "";
    if (themeId === "" && mode === "") {
      return "";
    }
    let classes =
        themeId === mode
          ? [themeId]
          : [themeId, mode].filter((input): boolean => input !== ""),
      colorScheme =
        head.colorScheme === "dark" || head.colorScheme === "light"
          ? head.colorScheme
          : mode;
    return (
      (themeId !== "" ? ' data-theme="' + themeId + '"' : "") +
      (mode !== ""
        ? ' data-mode="' + mode + '" style="color-scheme:' + colorScheme + '"'
        : "") +
      ' class="' +
      classes.join(" ") +
      '"'
    );
  }
  function swatchRuntimeTagHtml(tag: Model.SwatchRuntimeTag): string {
    if (
      !SWATCH_RUNTIME_TAG_URL_PATTERN.test(tag.src) ||
      !SWATCH_SHA384_INTEGRITY_PATTERN.test(tag.integrity)
    ) {
      throw Error("swatch runtime tag outside its grammar: " + tag.src);
    }
    return (
      '<script src="' +
      tag.src +
      '" integrity="' +
      tag.integrity +
      '" crossorigin="anonymous"><\/script>'
    );
  }
  function swatchDocumentHtml(
    html: string,
    head: Editor.PreviewRuntimeHead,
    headId: string,
    holdFonts: boolean = false,
  ): string {
    let placement = swatchHeadPlacement(head.urls, headId, holdFonts);
    return (
      "<!doctype html><html" +
      swatchHtmlAttributes(head) +
      '><head><meta name="referrer" content="no-referrer">' +
      placement.head +
      "</head><body><script>" +
      previewIsolationScript() +
      "<\/script><script>" +
      PREVIEW_LIFECYCLE_SCRIPT +
      "<\/script>" +
      (head.runtimeTags ?? []).map(swatchRuntimeTagHtml).join("") +
      placement.body +
      html +
      "</body></html>"
    );
  }
  function swatchHeadPlacement(
    urls: Editor.PreviewRuntimeUrls | undefined,
    headId: string,
    holdFonts: boolean,
  ): {
    head: string;
    body: string;
  } {
    let inlineHeadScript = (
      input?: readonly Editor.HeadScriptPiece[],
      options: boolean = false,
    ): string =>
      "<script>" + swatchHeadScript(headId, input, options) + "<\/script>";
    if (urls === undefined) {
      return {
        head: "",
        body: inlineHeadScript(),
      };
    }
    let scriptTags = [
        ...urls.runtimeScripts.map((input, options) => ({
          piece: options,
          ref: input,
        })),
        {
          piece: "b" as const,
          ref: urls.bundleJs,
        },
      ].map(({ piece: piece, ref: ref }) => ({
        piece: piece,
        tag:
          ref === undefined ? undefined : swatchPublishedPieceTag(piece, ref),
      })),
      cssTag =
        urls.bundleCss === undefined ||
        scriptTags[scriptTags.length - 1]?.tag === undefined
          ? undefined
          : swatchPublishedPieceTag("c", urls.bundleCss),
      hasPublishedTags =
        cssTag !== undefined ||
        scriptTags.some((input): boolean => input.tag !== undefined),
      hasUrlPieces = hasPublishedTags || (!holdFonts && urls.fonts.length > 0),
      bodyHtml = "",
      pendingPieces: Editor.HeadScriptPiece[] = [
        "o",
        "t",
        holdFonts ? "F" : "f",
        ...(cssTag === undefined ? ["c" as const] : []),
      ],
      firstBlock: boolean = true,
      flushInlinePieces = (): void => {
        if (pendingPieces.length > 0) {
          bodyHtml += inlineHeadScript(
            pendingPieces,
            firstBlock && hasUrlPieces,
          );
        }
        pendingPieces = [];
        firstBlock = false;
      };
    for (let { piece: value, tag: value2 } of scriptTags) {
      if (value2 === undefined) {
        pendingPieces.push(value);
      } else {
        flushInlinePieces();
        bodyHtml += value2;
      }
    }
    flushInlinePieces();
    return {
      head: cssTag ?? "",
      body:
        bodyHtml +
        (hasPublishedTags
          ? "<script " + SWATCH_PLACED_ATTRIBUTE + "><\/script>"
          : ""),
    };
  }
  function syncSwatchTheme(
    iframe: HTMLIFrameElement,
    head: readonly Editor.SwatchUrlReference[],
  ): Editor.HeadPlacementState {
    let value: Document | null;
    try {
      value = iframe.contentDocument;
    } catch {
      value = null;
    }
    if (value === null) {
      return {
        state: "gone",
      };
    }
    if (
      value.querySelector("script[" + SWATCH_PLACED_ATTRIBUTE + "]") !== null
    ) {
      return {
        state: "placed",
      };
    }
    let items = [...value.querySelectorAll("[" + SWATCH_PIECE_ATTRIBUTE + "]")];
    if (items.length === 0) {
      return {
        state: value.readyState === "loading" ? "not-reached" : "no-document",
      };
    }
    let values = new Set(
        items.map(
          (element) =>
            element.getAttribute("src") ?? element.getAttribute("href") ?? "",
        ),
      ),
      value2: string[] | undefined;
    try {
      value2 = iframe.contentWindow?.performance
        .getEntriesByType("resource")
        .map((input) => new URL(input.name).pathname);
    } catch {
      value2 = undefined;
    }
    if (value2 !== undefined) {
      let callback = (input: Editor.SwatchUrlReference) =>
          value2!.includes(input.url),
        value5 = head.find(
          (input) => values.has(input.url) && !callback(input),
        );
      if (value5 !== undefined) {
        return {
          state: "waiting",
          on: value5,
        };
      }
      if (
        value.readyState === "loading" &&
        head.some((input): boolean => !values.has(input.url))
      ) {
        return {
          state: "not-reached",
        };
      } else {
        return {
          state: "placed",
        };
      }
    }
    let value3 = items[items.length - 1],
      value4 =
        value3?.getAttribute("src") ?? value3?.getAttribute("href") ?? null;
    return {
      state: "waiting",
      on: head.find((input): boolean => input.url === value4),
    };
  }
  function swatchHeadWithHeldFonts(
    head: Editor.PreviewRuntimeHead,
    changes: string,
    heldFonts?: (url: string) => boolean,
  ): Editor.SwatchHeadUrls {
    let urls = head.urls;
    if (urls === undefined) {
      return {
        urls: undefined,
        heldFonts: false,
        awaited: [],
      };
    }
    let value =
        urls.runtimeScripts.length === head.runtimeScripts.length
          ? urls.runtimeScripts
          : head.runtimeScripts.map((): undefined => {
              return;
            }),
      text = "";
    try {
      text = new URL(".", changes).pathname;
    } catch {}
    let callback = (
        input: Editor.SwatchUrlReference | undefined,
      ): input is Editor.SwatchUrlReference =>
        input !== undefined &&
        text.length > 1 &&
        input.url.startsWith(text) &&
        (heldFonts === undefined || heldFonts(input.url)),
      callback2 = (input: Editor.SwatchUrlReference | undefined) =>
        callback(input) && swatchPublishedPieceTag("b", input) !== undefined
          ? input
          : undefined,
      value2 = urls.fonts.every(callback),
      value3 = callback2(urls.bundleJs),
      state = {
        bundleCss: value3 === undefined ? undefined : callback2(urls.bundleCss),
        runtimeScripts: value.map(callback2),
        bundleJs: value3,
        fonts: value2 ? urls.fonts : [],
      },
      value4 = [
        state.bundleCss,
        ...state.runtimeScripts,
        state.bundleJs,
      ].filter(
        (input): input is Editor.SwatchUrlReference => input !== undefined,
      );
    if (value4.length === 0 && urls.fonts.length === 0) {
      return {
        urls: undefined,
        heldFonts: false,
        awaited: value4,
      };
    }
    return {
      urls: state,
      heldFonts: urls.fonts.length > 0 && !value2,
      awaited: value4,
    };
  }
  function windowOrigin(environment: {
    origin?: unknown;
    location?: {
      origin?: unknown;
    };
  }): string {
    let value = environment;
    if (typeof value.origin === "string") {
      return value.origin;
    }
    if (typeof value.location?.origin === "string") {
      return value.location.origin;
    } else {
      return "null";
    }
  }
  function createLiveSwatch(
    options: Editor.LiveSwatchOptions,
  ): Editor.LiveSwatch {
    let value = options.doc ?? document,
      value2 = options.win ?? window;
    clearPreviewStorageOnce(value2);
    let value3 = retainSwatchHead(value2, options.head, options.onUrlMissed),
      value4 = value.createElement("iframe");
    value4.setAttribute("sandbox", PREVIEW_IFRAME_SANDBOX);
    let value5 = swatchHeadWithHeldFonts(
        options.head,
        value.baseURI,
        options.urlOffered,
      ),
      value6 = swatchDocumentHtml(
        options.html,
        {
          ...options.head,
          urls: value5.urls,
        },
        value3,
        value5.heldFonts,
      ),
      value7 =
        options.cardFile !== undefined &&
        (0, runtime.isPreviewRunnerAvailable)(value2)
          ? (0, runtime.previewRunnerAddresses)(options.cardFile, value.baseURI)
          : null,
      value8 =
        value7 !== null && !swatchRequiresPageAddress(value2, options)
          ? value7
          : null,
      value9: number | undefined,
      value10 =
        value8 !== null
          ? (0, runtime.registerPreviewRunnerDocument)(
              value2,
              value8.card,
              value6,
              {
                remove: () => value4.remove(),
                notify: () => value14("suspended", ""),
                taken: (): void => {
                  value9 = value2.performance.now();
                },
              },
            )
          : undefined;
    if (value10 === undefined) {
      value9 = value2.performance.now();
    }
    value4.setAttribute(
      SWATCH_ATTRIBUTE,
      value10 !== undefined ? "runner" : "",
    );
    value4.tabIndex = -1;
    value4.referrerPolicy = "no-referrer";
    value4.title = options.title;
    value4.style.width = "100%";
    value4.style.height = "100%";
    value4.style.border = "0";
    value4.style.display = "block";
    value4.style.background = "transparent";
    let flag: boolean = false,
      flag2: boolean = false,
      callback = (): void => {
        return;
      };
    function value11(): void {
      if (flag) {
        return;
      }
      flag = true;
      callback();
      options.onNavigated();
    }
    let value12: ReturnType<typeof setTimeout> | undefined,
      value13: boolean = value10 === undefined;
    function value14(
      input: "suspended" | "refused" | "unclear",
      options2: string,
    ) {
      if (value13 || flag2 || value10 === undefined) {
        return;
      }
      value13 = true;
      if (input === "suspended") {
        return void options.onUndelivered?.();
      }
      (0, runtime.removePreviewRunnerDocument)(value2, value10);
      if (
        (0, runtime.recordPreviewRunnerOutcome)(value2, input, value10).tell
      ) {
        console.warn(
          'design-system: "' +
            options.title +
            '" could not load through ' +
            runtime.PREVIEW_RUNNER_PATH +
            " (" +
            options2 +
            ") and was loaded without an address of its own, so files its card names by relative path will not load" +
            ((0, runtime.isPreviewRunnerCoolingDown)(value2)
              ? "; previews that start in the next moment load the same way, and ones that start after that try " +
                runtime.PREVIEW_RUNNER_PATH +
                " again"
              : (0, runtime.isPreviewRunnerAvailable)(value2)
                ? ""
                : "; later previews on this page will load the same way until the page is reloaded"),
        );
      }
      options.onUndelivered?.();
    }
    let index = 0;
    value4.addEventListener("load", () => {
      if (value8 !== null && value10 !== undefined && !value13) {
        if (isBlankPreviewFrame(value4)) {
          return;
        }
        if ((0, runtime.hasPreviewRunnerDocument)(value2, value10)) {
          return value14(
            "refused",
            "run.html was missing, was refused, or loaded without running the preview",
          );
        }
        if (previewFramePathname(value4) === value8.runner) {
          return value14("unclear", "it did not reach its card’s address");
        }
        value13 = true;
        (0, runtime.recordPreviewRunnerOutcome)(value2, "worked", value10);
      }
      index += 1;
      if (index > 1) {
        value11();
      }
    });
    let flag3: boolean = false,
      value15 = windowOrigin(value2),
      callback2 = (dataset: MessageEvent<unknown>): void => {
        let value16 = classifyPreviewMessage(
          {
            source: dataset.source,
            origin: dataset.origin,
            data: dataset.data,
          },
          value4.contentWindow,
          value15,
          flag,
        );
        if (value16 === "navigating") {
          value11();
        } else if (value16 === "ready") {
          if (!flag3) {
            flag3 = true;
            options.onReady?.(previewMessageHeight(dataset.data));
            if (options.onContentHeight !== undefined && !flag) {
              callback = (0, runtime.observePreviewHeight)(
                value4,
                options.onContentHeight,
                options.declaredHeight,
              );
            }
          }
        } else if (value16 === "error" || value16 === "error-react") {
          options.onError?.(value16 === "error-react" ? "react" : undefined);
        }
      };
    value2.addEventListener("message", callback2);
    if (value8 === null || value10 === undefined) {
      value4.srcdoc = value6;
    } else {
      value4.src = value8.runner + "#" + value10;
      let value16 = options.runnerAskMs ?? PREVIEW_BOOT_TIMEOUT_MS,
        index2 = 0,
        index3 = 0,
        callback3 = (): void => {
          if (
            value13 ||
            !(0, runtime.hasPreviewRunnerDocument)(value2, value10)
          ) {
            return;
          }
          if (
            value.hidden ||
            (previewFramePathname(value4) === value8.runner &&
              (index2 += 1) <= 3) ||
            ((0, runtime.wasPreviewRunnerRecentlyTaken)(value2, value16) &&
              (index3 += 1) <= 8)
          ) {
            value12 = setTimeout(callback3, value16);
          } else {
            value12 = setTimeout((): void => {
              if ((0, runtime.hasPreviewRunnerDocument)(value2, value10)) {
                value14("unclear", "run.html did not start in time");
              }
            }, 0);
          }
        };
      value12 = setTimeout(callback3, value16);
    }
    return {
      iframe: value4,
      awaited: value5.awaited,
      headProgress: () => syncSwatchTheme(value4, value5.awaited),
      documentAgeMs: () =>
        value9 === undefined ? undefined : value2.performance.now() - value9,
      dispose: (): void => {
        if (flag2) {
          return;
        }
        flag2 = true;
        callback();
        clearTimeout(value12);
        value2.removeEventListener("message", callback2);
        if (value10 !== undefined) {
          (0, runtime.removePreviewRunnerDocument)(value2, value10);
        }
        value4.remove();
        releaseSwatchHead(value2, value3);
      },
    };
  }
  function swatchRequiresPageAddress(
    environment: object,
    options: Editor.LiveSwatchOptions,
  ): boolean {
    let bundleHasPageReference = bundlePageAddressReferenceCache.get(
      options.head,
    );
    if (bundleHasPageReference === undefined) {
      bundlePageAddressReferenceCache.set(
        options.head,
        (bundleHasPageReference =
          (0, runtime.hasRawProjectReferences)(
            options.head.bundleCss,
            "bundle",
          ) ||
          (0, runtime.hasRawProjectReferences)(
            options.head.bundleJs,
            "bundle",
          )),
      );
    }
    let hasPageReference =
        bundleHasPageReference ||
        (0, runtime.hasRawProjectReferences)(options.html, "card"),
      blockedScript =
        !hasPageReference &&
        options.fromProps !== true &&
        (0, runtime.blockedPreviewScriptReference)(
          options.html,
          options.cardFile ?? "",
        );
    if (!hasPageReference && blockedScript === false) {
      return false;
    }
    let reported = reportedPageAddressReasons.get(environment) ?? new Set();
    reportedPageAddressReasons.set(environment, reported);
    let propsHavePageReference =
        !bundleHasPageReference && options.fromProps === true,
      reasonKey: string = bundleHasPageReference
        ? ""
        : (blockedScript !== false
            ? `script
`
            : propsHavePageReference
              ? `props
`
              : "") + (options.cardFile ?? "");
    if (!reported.has(reasonKey)) {
      if ((reported.add(reasonKey), typeof blockedScript === "string")) {
        console.info(
          'design-system: "' +
            options.title +
            '" keeps the page’s address because its card names a script by a relative path (' +
            JSON.stringify(
              blockedScript.length > 80
                ? blockedScript.slice(0, 80) + "…"
                : blockedScript,
            ) +
            ") that may be a file the page adds itself, which would then run twice. So a file named relative to the card will not load. " +
            runtime.BLOCKED_SCRIPT_SOURCE_GUIDANCE,
        );
      } else if (blockedScript) {
        console.info(
          'design-system: "' +
            options.title +
            `" keeps the page’s address because an inline script in its card imports './…' or '../…', or its import map points to such a path, which may be a file the page adds itself and would then run twice. So a file named relative to the card will not load. ` +
            runtime.BLOCKED_SCRIPT_IMPORT_GUIDANCE,
        );
      } else if (propsHavePageReference) {
        console.info(
          'design-system: "' +
            options.title +
            '" keeps the page’s address while a value in Props reads as a path from the page’s folder ("_blob/…" or "project/…"), so a file named relative to the card will not load there. If it is a path, write it as "/_blob/<id>" or relative to the card and the preview gets its card’s address.',
        );
      } else {
        console.info(
          "design-system: " +
            (bundleHasPageReference
              ? "this system’s previews keep"
              : '"' + options.title + '" keeps') +
            " the page’s address, so a file named relative to the card will not load there: " +
            (bundleHasPageReference
              ? "its bundle.css or bundle.js"
              : "its card") +
            ' names something from the page’s folder ("_blob/…" or "project/…"). ' +
            runtime.RAW_PROJECT_REFERENCE_GUIDANCE +
            " and " +
            (bundleHasPageReference ? "each" : "the") +
            " preview gets its card’s address.",
        );
      }
    }
    return true;
  }
  function isBlankPreviewFrame(iframe: HTMLIFrameElement): boolean {
    try {
      return iframe.contentWindow?.location.href === "about:blank";
    } catch {
      return false;
    }
  }
  function previewFramePathname(iframe: HTMLIFrameElement): string | undefined {
    try {
      return iframe.contentWindow?.location.pathname;
    } catch {
      return;
    }
  }
  function classifyPreviewMessage(
    event: Pick<MessageEvent<unknown>, "source" | "origin" | "data">,
    frameWindow: Window | null,
    origin: string,
    navigated: boolean,
  ): Editor.PreviewMessageKind {
    if (frameWindow === null || event.source !== frameWindow) {
      return "drop";
    }
    if (event.origin !== origin) {
      return "drop";
    }
    if (navigated) {
      return "drop";
    }
    let message = event.data as {
      type?: unknown;
    } | null;
    if (typeof message !== "object" || message === null) {
      return "drop";
    }
    if (message.type === SWATCH_NAVIGATING_MESSAGE) {
      return "navigating";
    }
    if (message.type === SWATCH_READY_MESSAGE) {
      return "ready";
    }
    if (message.type === SWATCH_ERROR_MESSAGE) {
      return "error";
    }
    if (message.type === SWATCH_REACT_ERROR_MESSAGE) {
      return "error-react";
    }
    return "drop";
  }
  function previewMessageHeight(message: unknown): number | undefined {
    let height = (
      message as
        | {
            h?: unknown;
          }
        | null
        | undefined
    )?.h;
    if (typeof height !== "number" || !Number.isFinite(height)) {
      return;
    }
    return (0, runtime.clampPreviewHeight)(height);
  }
  bindRuntimeValue(
    runtime,
    "reactSwatchPreview",
    () => reactSwatchPreview,
    (value) => {
      reactSwatchPreview = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SWATCH_NAVIGATING_MESSAGE",
    () => SWATCH_NAVIGATING_MESSAGE,
    (value) => {
      SWATCH_NAVIGATING_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SWATCH_READY_MESSAGE",
    () => SWATCH_READY_MESSAGE,
    (value) => {
      SWATCH_READY_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SWATCH_ERROR_MESSAGE",
    () => SWATCH_ERROR_MESSAGE,
    (value) => {
      SWATCH_ERROR_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SWATCH_REACT_ERROR_MESSAGE",
    () => SWATCH_REACT_ERROR_MESSAGE,
    (value) => {
      SWATCH_REACT_ERROR_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MISSING_REACT_ERROR_PATTERN",
    () => MISSING_REACT_ERROR_PATTERN,
    (value) => {
      MISSING_REACT_ERROR_PATTERN = value;
    },
  );
  bindRuntimeValue(runtime, "escapeScriptJson", () => escapeScriptJson);
  bindRuntimeValue(
    runtime,
    "PREVIEW_STORAGE_PREFIX",
    () => PREVIEW_STORAGE_PREFIX,
    (value) => {
      PREVIEW_STORAGE_PREFIX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PREVIEW_SCOPED_STORAGE_SCRIPT",
    () => PREVIEW_SCOPED_STORAGE_SCRIPT,
    (value) => {
      PREVIEW_SCOPED_STORAGE_SCRIPT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "previewIsolationScript",
    () => previewIsolationScript,
  );
  bindRuntimeValue(
    runtime,
    "createPreviewLifecycleScript",
    () => createPreviewLifecycleScript,
    (value) => {
      createPreviewLifecycleScript = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SWATCH_ATTRIBUTE",
    () => SWATCH_ATTRIBUTE,
    (value) => {
      SWATCH_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PREVIEW_BOOT_TIMEOUT_MS",
    () => PREVIEW_BOOT_TIMEOUT_MS,
    (value) => {
      PREVIEW_BOOT_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PREVIEW_IFRAME_SANDBOX",
    () => PREVIEW_IFRAME_SANDBOX,
    (value) => {
      PREVIEW_IFRAME_SANDBOX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ADMITTED_PREVIEW_CDN_PREFIXES",
    () => ADMITTED_PREVIEW_CDN_PREFIXES,
    (value) => {
      ADMITTED_PREVIEW_CDN_PREFIXES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PREVIEW_LIFECYCLE_SCRIPT",
    () => PREVIEW_LIFECYCLE_SCRIPT,
    (value) => {
      PREVIEW_LIFECYCLE_SCRIPT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "clearedPreviewStorageWindows",
    () => clearedPreviewStorageWindows,
    (value) => {
      clearedPreviewStorageWindows = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "clearPreviewStorageOnce",
    () => clearPreviewStorageOnce,
  );
  bindRuntimeValue(
    runtime,
    "swatchHeadKeyCache",
    () => swatchHeadKeyCache,
    (value) => {
      swatchHeadKeyCache = value;
    },
  );
  bindRuntimeValue(runtime, "swatchContentHash", () => swatchContentHash);
  bindRuntimeValue(runtime, "swatchHeadKey", () => swatchHeadKey);
  bindRuntimeValue(
    runtime,
    "swatchRuntimeKeyCache",
    () => swatchRuntimeKeyCache,
    (value) => {
      swatchRuntimeKeyCache = value;
    },
  );
  bindRuntimeValue(runtime, "swatchRuntimeKey", () => swatchRuntimeKey);
  bindRuntimeValue(runtime, "swatchHeadsEqual", () => swatchHeadsEqual);
  bindRuntimeValue(
    runtime,
    "SWATCH_HEAD_REGISTRY_GLOBAL",
    () => SWATCH_HEAD_REGISTRY_GLOBAL,
    (value) => {
      SWATCH_HEAD_REGISTRY_GLOBAL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SWATCH_HEAD_SEQUENCE_GLOBAL",
    () => SWATCH_HEAD_SEQUENCE_GLOBAL,
    (value) => {
      SWATCH_HEAD_SEQUENCE_GLOBAL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "registeredSwatchHeadIds",
    () => registeredSwatchHeadIds,
    (value) => {
      registeredSwatchHeadIds = value;
    },
  );
  bindRuntimeValue(runtime, "nextSwatchHeadId", () => nextSwatchHeadId);
  bindRuntimeValue(runtime, "swatchHeadRegistry", () => swatchHeadRegistry);
  bindRuntimeValue(
    runtime,
    "swatchHeadPieceReference",
    () => swatchHeadPieceReference,
  );
  bindRuntimeValue(runtime, "retainSwatchHead", () => retainSwatchHead);
  bindRuntimeValue(runtime, "releaseSwatchHead", () => releaseSwatchHead);
  bindRuntimeValue(
    runtime,
    "ALL_SWATCH_HEAD_PIECES",
    () => ALL_SWATCH_HEAD_PIECES,
    (value) => {
      ALL_SWATCH_HEAD_PIECES = value;
    },
  );
  bindRuntimeValue(runtime, "swatchHeadScript", () => swatchHeadScript);
  bindRuntimeValue(
    runtime,
    "SWATCH_PIECE_ATTRIBUTE",
    () => SWATCH_PIECE_ATTRIBUTE,
    (value) => {
      SWATCH_PIECE_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SWATCH_FAILED_ATTRIBUTE",
    () => SWATCH_FAILED_ATTRIBUTE,
    (value) => {
      SWATCH_FAILED_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "swatchHeadPiecesScript",
    () => swatchHeadPiecesScript,
  );
  bindRuntimeValue(
    runtime,
    "SWATCH_LOCAL_URL_PATTERN",
    () => SWATCH_LOCAL_URL_PATTERN,
    (value) => {
      SWATCH_LOCAL_URL_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SWATCH_SHA256_INTEGRITY_PATTERN",
    () => SWATCH_SHA256_INTEGRITY_PATTERN,
    (value) => {
      SWATCH_SHA256_INTEGRITY_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "swatchPublishedPieceTag",
    () => swatchPublishedPieceTag,
  );
  bindRuntimeValue(
    runtime,
    "SWATCH_THEME_ID_PATTERN",
    () => SWATCH_THEME_ID_PATTERN,
    (value) => {
      SWATCH_THEME_ID_PATTERN = value;
    },
  );
  bindRuntimeValue(runtime, "swatchHtmlAttributes", () => swatchHtmlAttributes);
  bindRuntimeValue(
    runtime,
    "SWATCH_RUNTIME_TAG_URL_PATTERN",
    () => SWATCH_RUNTIME_TAG_URL_PATTERN,
    (value) => {
      SWATCH_RUNTIME_TAG_URL_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SWATCH_SHA384_INTEGRITY_PATTERN",
    () => SWATCH_SHA384_INTEGRITY_PATTERN,
    (value) => {
      SWATCH_SHA384_INTEGRITY_PATTERN = value;
    },
  );
  bindRuntimeValue(runtime, "swatchRuntimeTagHtml", () => swatchRuntimeTagHtml);
  bindRuntimeValue(runtime, "swatchDocumentHtml", () => swatchDocumentHtml);
  bindRuntimeValue(
    runtime,
    "SWATCH_PLACED_ATTRIBUTE",
    () => SWATCH_PLACED_ATTRIBUTE,
    (value) => {
      SWATCH_PLACED_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(runtime, "swatchHeadPlacement", () => swatchHeadPlacement);
  bindRuntimeValue(runtime, "syncSwatchTheme", () => syncSwatchTheme);
  bindRuntimeValue(
    runtime,
    "swatchHeadWithHeldFonts",
    () => swatchHeadWithHeldFonts,
  );
  bindRuntimeValue(runtime, "windowOrigin", () => windowOrigin);
  bindRuntimeValue(runtime, "createLiveSwatch", () => createLiveSwatch);
  bindRuntimeValue(
    runtime,
    "bundlePageAddressReferenceCache",
    () => bundlePageAddressReferenceCache,
    (value) => {
      bundlePageAddressReferenceCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reportedPageAddressReasons",
    () => reportedPageAddressReasons,
    (value) => {
      reportedPageAddressReasons = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "swatchRequiresPageAddress",
    () => swatchRequiresPageAddress,
  );
  bindRuntimeValue(runtime, "isBlankPreviewFrame", () => isBlankPreviewFrame);
  bindRuntimeValue(runtime, "previewFramePathname", () => previewFramePathname);
  bindRuntimeValue(
    runtime,
    "classifyPreviewMessage",
    () => classifyPreviewMessage,
  );
  bindRuntimeValue(runtime, "previewMessageHeight", () => previewMessageHeight);
  return () => {
    reactSwatchPreview = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    SWATCH_NAVIGATING_MESSAGE = "ds-swatch:navigating";
    SWATCH_READY_MESSAGE = "ds-swatch:ready";
    SWATCH_ERROR_MESSAGE = "ds-swatch:error";
    SWATCH_REACT_ERROR_MESSAGE = "ds-swatch:error-react";
    MISSING_REACT_ERROR_PATTERN =
      /^(?:Uncaught )?ReferenceError: (?:(?:React|ReactDOM) is not defined|Can't find variable: (?:React|ReactDOM))$/;
    PREVIEW_STORAGE_PREFIX = "preview:";
    PREVIEW_SCOPED_STORAGE_SCRIPT =
      `(function () {
  var PREFIX = '` +
      PREVIEW_STORAGE_PREFIX +
      `';
  var memory = function () {
    var m = Object.create(null);
    return {
      getItem: function (k) { return k in m ? m[k] : null; },
      setItem: function (k, v) { m[k] = String(v); },
      removeItem: function (k) { delete m[k]; },
      key: function (i) { var ks = Object.keys(m); i = Math.floor(Number(i)) || 0; return i >= 0 && i < ks.length ? ks[i] : null; },
      get length() { return Object.keys(m).length; }
    };
  };
  var scope = function (real) {
    var keys = function () {
      var out = [];
      for (var i = 0, n = real.length; i < n; i++) { var k = real.key(i); if (k !== null && k.indexOf(PREFIX) === 0) out.push(k.slice(PREFIX.length)); }
      return out;
    };
    var api = {
      getItem: function (k) { return real.getItem(PREFIX + String(k)); },
      setItem: function (k, v) { real.setItem(PREFIX + String(k), String(v)); },
      removeItem: function (k) { real.removeItem(PREFIX + String(k)); },
      clear: function () { keys().forEach(function (k) { real.removeItem(PREFIX + k); }); },
      key: function (i) { var ks = keys(); i = Math.floor(Number(i)) || 0; return i >= 0 && i < ks.length ? ks[i] : null; },
      get length() { return keys().length; }
    };
    if (typeof Proxy !== 'function') return api;
    var own = function (p) { return typeof p === 'string' && !(p in api) && p !== 'length'; };
    return new Proxy(api, {
      get: function (t, p) { if (p === 'length') return keys().length; if (p in api) return api[p]; if (!own(p)) return undefined; var v = real.getItem(PREFIX + p); return v === null ? undefined : v; },
      set: function (t, p, v) { if (own(p)) real.setItem(PREFIX + p, String(v)); return true; },
      deleteProperty: function (t, p) { if (own(p)) real.removeItem(PREFIX + p); return true; },
      has: function (t, p) { return p in api || p === 'length' || (own(p) && real.getItem(PREFIX + p) !== null); },
      ownKeys: function () { return keys(); },
      getOwnPropertyDescriptor: function (t, p) { if (!own(p)) return undefined; var v = real.getItem(PREFIX + p); return v === null ? undefined : { value: v, writable: true, enumerable: true, configurable: true }; }
    });
  };
  var natives = {};
  var views = {};
  ['localStorage', 'sessionStorage'].forEach(function (n) {
    var real = null;
    try { real = window[n]; } catch (e) { real = null; }
    if (!real || typeof real.getItem !== 'function') real = memory();
    natives[n] = real;
    views[n] = scope(real);
    try { Object.defineProperty(window, n, { value: views[n], configurable: true }); } catch (e) {}
  });
  try {
    window.addEventListener('storage', function (e) {
      if (!e.isTrusted) return;
      var k = e.key;
      var area = e.storageArea === natives.localStorage ? views.localStorage : e.storageArea === natives.sessionStorage ? views.sessionStorage : null;
      if (k === null || (typeof k === 'string' && k.indexOf(PREFIX) === 0)) {
        try { Object.defineProperties(e, { key: { value: k === null ? null : k.slice(PREFIX.length), configurable: true }, storageArea: { value: area, configurable: true } }); } catch (x) { e.stopImmediatePropagation(); }
        return;
      }
      e.stopImmediatePropagation();
    }, true);
  } catch (e) {}
})();`;
    createPreviewLifecycleScript = (
      admittedCdnPrefixes: readonly string[],
    ): string =>
      `(function () {
  var sent = false;
  var booted = false;
  var failed = false;
  var noReact = false;
  var noReactRe = ` +
      escapeScriptJson(String(MISSING_REACT_ERROR_PATTERN)) +
      `;
  function nav() {
    if (sent) return;
    sent = true;
    try { parent.postMessage({ type: 'ds-swatch:navigating' }, '*'); } catch (e) {}
  }
  window.addEventListener('beforeunload', nav);
  window.addEventListener('pagehide', nav);
  /* Boot-failure detection, through load plus one tick. capture
   * is true so element-targeted errors are seen (they do not
   * bubble). FILTERED: uncaught exceptions (window-targeted) are
   * boot failures; an element error on a SCRIPT is one when the
   * script is INLINE, or when its src is on the admitted CDN list -
   * that script is load-bearing (a card from Claude Design runs its
   * JSX through Babel fetched there), so a CDN that does not answer,
   * an integrity mismatch or an offline viewer demotes the preview
   * to the static tier with a notice instead of leaving it blank.
   * Any other failed src/href - a relative bundle.js tag a preview.html
   * carries for folder portability (the frame has provided the bundle
   * already; beside the page it is a 404 or a text/plain sibling the
   * browser will not execute), an image that is gone - is a degraded
   * asset, not a reason to demote. v2 has no module graph, so nothing
   * else reports at a script element. */
  var admitted = ` +
      escapeScriptJson(JSON.stringify(admittedCdnPrefixes)) +
      `;
  function onList(u) {
    var m = /^(?:https:)?\\/\\/([^\\/?#]+)([^?#]*)/i.exec(String(u)); if (!m) return false;
    var host = m[1].toLowerCase(), path = m[2] === '' ? '/' : m[2];
    for (var i = 0; i < admitted.length; i++) { var s = /^https:\\/\\/([^\\/]+)(\\/.*)?$/.exec(admitted[i]); if (s && host === s[1] && (!s[2] || path.slice(0, s[2].length) === s[2])) return true; }
    return false;
  }
  window.addEventListener('error', function (e) {
    if (booted) return;
    var t = e.target;
    if (t === window || t === null || t === undefined) { failed = true; if (typeof e.message === 'string' && noReactRe.test(e.message)) noReact = true; return; }
    var tag = t.tagName ? String(t.tagName).toUpperCase() : '';
    var src = '';
    try { src = (t.getAttribute && (t.getAttribute('src') || t.getAttribute('href'))) || ''; } catch (x) {}
    if (tag === 'SCRIPT' && (src === '' || onList(src))) { failed = true; }
  }, true);
  function tall() { try { var de = document.documentElement, b = document.body; return Math.ceil(Math.max(de.scrollHeight, b ? b.scrollHeight : 0)); } catch (x) { return 0; } }
  function post() {
    var h = tall();
    try { parent.postMessage(failed ? { type: noReact ? 'ds-swatch:error-react' : 'ds-swatch:error' } : { type: 'ds-swatch:ready', h: h }, '*'); } catch (e) {}
  }
  window.addEventListener('load', function () {
    setTimeout(function () {
      booted = true;
      var fr = null;
      try { fr = document.fonts ? document.fonts.ready : null; } catch (x) {}
      if (failed || !fr || typeof fr.then !== 'function') { post(); return; }
      var done = false;
      function once() { if (done) return; done = true; post(); }
      fr.then(once, once);
      setTimeout(once, 1000);
    }, 0);
  });
})();`;
    SWATCH_ATTRIBUTE = "data-ds-swatch";
    PREVIEW_BOOT_TIMEOUT_MS = 4000;
    PREVIEW_IFRAME_SANDBOX = "allow-scripts allow-same-origin";
    ADMITTED_PREVIEW_CDN_PREFIXES = [
      "https://cdnjs.cloudflare.com",
      "https://cdn.jsdelivr.net/pyodide/",
      "https://cdn.jsdelivr.net/gh/python-visualization/",
      "https://cdn.jsdelivr.net/npm/",
      "https://cdn.tailwindcss.com",
      "https://code.jquery.com",
      "https://unpkg.com",
    ];
    PREVIEW_LIFECYCLE_SCRIPT = createPreviewLifecycleScript(
      ADMITTED_PREVIEW_CDN_PREFIXES,
    );
    clearedPreviewStorageWindows = new WeakSet();
    swatchHeadKeyCache = new WeakMap();
    swatchRuntimeKeyCache = new WeakMap();
    SWATCH_HEAD_REGISTRY_GLOBAL = "__dsSwatchHeads";
    SWATCH_HEAD_SEQUENCE_GLOBAL = "__dsSwatchHeadSeq";
    registeredSwatchHeadIds = new WeakMap();
    ALL_SWATCH_HEAD_PIECES = "all";
    SWATCH_PIECE_ATTRIBUTE = "data-ds-piece";
    SWATCH_FAILED_ATTRIBUTE = "data-ds-failed";
    SWATCH_LOCAL_URL_PATTERN = /^\/(?!\/)[^\s"<>&\\]*$/;
    SWATCH_SHA256_INTEGRITY_PATTERN = /^sha256-[A-Za-z0-9+/]{43}=$/;
    SWATCH_THEME_ID_PATTERN = /^[a-z0-9][a-z0-9_.-]{0,63}$/;
    // CucCut: a runtime tag is the editor page's own vendor copy (model/libraries.ts), a root-relative path under
    // the page's artifact-type/vendor/, not a jsDelivr npm UMD address.
    SWATCH_RUNTIME_TAG_URL_PATTERN =
      /^\/(?!\/)(?:[A-Za-z0-9._~%-]+\/)*artifact-type\/vendor\/[a-z][a-z0-9.-]*\.js$/;
    SWATCH_SHA384_INTEGRITY_PATTERN = /^sha384-[A-Za-z0-9+/]{64}$/;
    SWATCH_PLACED_ATTRIBUTE = "data-ds-placed";
    bundlePageAddressReferenceCache = new WeakMap();
    reportedPageAddressReasons = new WeakMap();
  };
}
