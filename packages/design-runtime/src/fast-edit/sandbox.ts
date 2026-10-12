/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installFastEditSandbox(runtime: RuntimeBindings): () => void {
  var FAST_EDIT_INPUT_LIMITS: Dynamic;
  var FAST_EDIT_WORKER_SHA256: Dynamic;
  var FAST_EDIT_IFRAME_BRIDGE_SOURCE: Dynamic;
  var FAST_EDIT_SANDBOX_CSP: Dynamic;
  var FAST_EDIT_SANDBOX_LIMITS: Dynamic;
  var FAST_EDIT_SDK3_LIMITS: Dynamic;
  var FAST_EDIT_ID_PATTERN: Dynamic;
  var UNSAFE_FAST_EDIT_IDS: Dynamic;
  var isSafeFastEditId: Dynamic;
  var FAST_EDIT_NAME_PATTERN: Dynamic;
  var FAST_EDIT_HANDLE_ID_PATTERN: Dynamic;
  var RESERVED_FAST_EDIT_NAMES: Dynamic;
  var isReservedFastEditName: Dynamic;
  var FAST_EDIT_WORKER_MESSAGE_KINDS: Dynamic;
  var jsonForInlineScript: Dynamic;
  var fastEditWorkerSource: Dynamic;
  var verifiedFastEditWorkerBytes: Dynamic;
  var installFastEditWorker: Dynamic;
  var FAST_EDIT_WORKER_LIFETIME_LIMITS: Dynamic;
  var FAST_EDIT_PREVIEW_PACING: Dynamic;
  var deriveSandboxBridgeLimits: Dynamic;
  var FAST_EDIT_CANVAS_SANDBOX_LIMITS: Dynamic;
  async function verifyFastEditWorker(bytes?: Dynamic): Promise<Dynamic> {
    if (fastEditWorkerSource !== "" || verifiedFastEditWorkerBytes !== null)
      return true;
    let copiedBytes: Dynamic, sha2562: Dynamic;
    try {
      if (
        !(bytes instanceof Uint8Array) ||
        typeof crypto != "object" ||
        crypto === null ||
        !crypto.subtle
      )
        return false;
      copiedBytes = new Uint8Array(bytes);
      sha2562 = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", copiedBytes)),
        (input?: Dynamic): Dynamic => input.toString(16).padStart(2, "0"),
      ).join("");
    } catch {
      return false;
    }
    return sha2562 !== FAST_EDIT_WORKER_SHA256
      ? false
      : (fastEditWorkerSource === "" &&
          verifiedFastEditWorkerBytes === null &&
          (verifiedFastEditWorkerBytes = copiedBytes),
        true);
  }
  function createFastEditSandbox({
    html: html,
    deck: deck,
    verbs: verbs,
    sdk: sdk,
    files: files,
    current: current,
    index: index,
    layouts: layouts,
    names: names,
    onHtml: onHtml,
    onDeck: onDeck,
    onOp: onOp,
    onDone: onDone,
    onTouch: onTouch,
    onPreview: onPreview,
    onError: onError,
    onLog: onLog,
    limits: limits,
  }: Dynamic = {}): Dynamic {
    if (sdk !== undefined && sdk !== 2 && sdk !== 3)
      throw new Error("createReplBox: sdk must be 2, 3 or absent");
    let hasSdk: Dynamic = sdk === 2 || sdk === 3,
      filePathsById: Dynamic = null,
      noCurrent: Dynamic = false;
    if (sdk === 3) {
      if (verbs !== undefined || deck !== undefined)
        throw new Error(
          "createReplBox: sdk:3 takes files / current / index / layouts, not verbs or deck",
        );
      if (
        !Array.isArray(files) ||
        (current !== undefined && typeof current != "string")
      )
        throw new Error(
          "createReplBox: sdk:3 needs files: [{ id, path, title?, html }], which may be empty (current: id is optional: it only serves the old names slide / $(sel) / deck.current)",
        );
      if (
        files.some(
          (input?: Dynamic): Dynamic => input && input.id === "container",
        )
      )
        throw new Error(
          "createReplBox: a file cannot be named container: #container is the root they attach to",
        );
      filePathsById = Object.create(null);
      let values3: Dynamic = new Set();
      for (let value28 of files as Dynamic) {
        if (
          !value28 ||
          typeof value28.path != "string" ||
          !value28.path ||
          value28.path.length > 300 ||
          values3.has(value28.path) ||
          files.some(
            (input?: Dynamic): Dynamic => input && input.id === value28.path,
          )
        )
          throw new Error(
            "createReplBox: every file needs a path (1 to 300 characters) that is unique and is not another file's id",
          );
        values3.add(value28.path);
        typeof value28.id == "string" &&
          (filePathsById[value28.id] = value28.path);
      }
      noCurrent = current === undefined;
      verbs = {
        current: noCurrent ? "" : current,
        slides: files,
        layouts: layouts,
        title: index && index.title,
        sections: index && index.sections,
      };
      html = "<section></section>";
    }
    let effectiveLimits: Dynamic = Object.assign(
      {},
      FAST_EDIT_SANDBOX_LIMITS,
      hasSdk ? FAST_EDIT_SDK3_LIMITS : {},
      limits || {},
    );
    if (typeof html != "string" || html.length > effectiveLimits.maxHtml)
      throw new Error(
        "createReplBox: html must be a string of at most " +
          effectiveLimits.maxHtml +
          " characters",
      );
    let hasValue: Dynamic = (input?: Dynamic): Dynamic => input != null;
    if (hasValue(deck))
      throw new Error(
        "createReplBox: the deck (shell) mode is not in this build; use verbs",
      );
    if (hasValue(deck) && hasValue(verbs))
      throw new Error("createReplBox: pass deck or verbs, not both");
    let validateDeck: Dynamic = (
        input?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
      ): Dynamic => {
        let values3: Dynamic = new Set(),
          items2: Dynamic = [];
        if (
          typeof input != "object" ||
          !(context || isSafeFastEditId(input.current)) ||
          !Array.isArray(input.slides) ||
          input.slides.length > effectiveLimits.maxSlides
        )
          throw new Error(
            "createReplBox: " +
              options +
              " must be { current: id, slides: [{ id, title }] } with at most " +
              effectiveLimits.maxSlides +
              " slides",
          );
        for (let value28 of input.slides as Dynamic) {
          if (
            !value28 ||
            !isSafeFastEditId(value28.id) ||
            values3.has(value28.id)
          )
            throw new Error(
              "createReplBox: " +
                options +
                " slide ids must be unique, match " +
                FAST_EDIT_ID_PATTERN +
                " and not be __proto__ / constructor / prototype",
            );
          values3.add(value28.id);
          items2.push({
            id: value28.id,
            title: String(
              value28.title === undefined ? "" : value28.title,
            ).slice(0, 300),
          });
        }
        if (!context && !values3.has(input.current))
          throw new Error(
            "createReplBox: " +
              options +
              ".current must be one of " +
              options +
              ".slides",
          );
        return {
          current: input.current,
          slides: items2,
        };
      },
      mode: Dynamic = hasValue(deck)
        ? "deck"
        : hasValue(verbs)
          ? "verbs"
          : "plain";
    if (hasSdk && mode !== "verbs")
      throw new Error(
        "createReplBox: sdk:2 needs verbs: { current, slides: [{ id, title, html }] }",
      );
    let normalizedDeck: Dynamic =
        mode === "verbs"
          ? validateDeck(verbs, sdk === 3 ? "files" : "verbs", noCurrent)
          : null,
      sandboxConfig: Dynamic = null,
      stopped: Dynamic = false,
      knownIds: Dynamic = new Set(),
      createdIds: Dynamic = new Set();
    if (hasSdk) {
      let value28: Dynamic = Object.create(null),
        value29: Dynamic = Object.create(null),
        value30: Dynamic = sdk === 3 ? 0 : html.length;
      for (let value32 of verbs.slides as Dynamic)
        if (
          (knownIds.add(value32.id),
          !(sdk !== 3 && value32.id === verbs.current))
        ) {
          if (
            typeof value32.html != "string" ||
            value32.html.length > effectiveLimits.maxHtml
          )
            throw new Error(
              "createReplBox: sdk:2 needs html (a string of at most " +
                effectiveLimits.maxHtml +
                ' characters) on every slide; "' +
                value32.id +
                '" has none',
            );
          value28[value32.id] = value32.html;
          value30 += value32.html.length;
        }
      if (hasValue(verbs.layouts)) {
        if (
          typeof verbs.layouts != "object" ||
          Array.isArray(verbs.layouts) ||
          Object.keys(verbs.layouts).length > effectiveLimits.maxLayouts
        )
          throw new Error(
            "createReplBox: verbs.layouts must be { name: html } with at most " +
              effectiveLimits.maxLayouts +
              " names",
          );
        for (let value32 of Object.keys(verbs.layouts) as Dynamic) {
          let value33: Dynamic = verbs.layouts[value32];
          if (
            !isSafeFastEditId(value32) ||
            typeof value33 != "string" ||
            value33.length > effectiveLimits.maxHtml
          )
            throw new Error(
              'createReplBox: layout "' +
                value32 +
                '" must have a name like an id (not __proto__ / constructor / prototype) and html of at most ' +
                effectiveLimits.maxHtml +
                " characters",
            );
          value29[value32] = value33;
          value30 += value33.length;
        }
      }
      if (
        hasValue(verbs.title) &&
        (typeof verbs.title != "string" || verbs.title.length > 300)
      )
        throw new Error(
          "createReplBox: verbs.title must be a string of at most 300 characters",
        );
      let items2: Dynamic = [];
      if (hasValue(verbs.sections)) {
        if (
          !Array.isArray(verbs.sections) ||
          verbs.sections.length > effectiveLimits.maxSlides
        )
          throw new Error(
            "createReplBox: verbs.sections must be [{ start: slideId, title }] with at most " +
              effectiveLimits.maxSlides +
              " entries",
          );
        for (let value32 of verbs.sections as Dynamic) {
          if (
            !value32 ||
            !isSafeFastEditId(value32.start) ||
            !knownIds.has(value32.start) ||
            typeof value32.title != "string" ||
            value32.title.length > 300 ||
            items2.some(
              (input?: Dynamic): Dynamic => input.start === value32.start,
            )
          )
            throw new Error(
              "createReplBox: every section needs a start that is one of the slides (each at most once) and a title of at most 300 characters",
            );
          items2.push({
            start: value32.start,
            title: value32.title,
          });
          value30 += value32.title.length;
        }
      }
      if (value30 > effectiveLimits.maxInputChars)
        throw new Error(
          "createReplBox: sdk:2 takes at most " +
            effectiveLimits.maxInputChars +
            " characters of slide and layout text in all",
        );
      let value31: Dynamic = null;
      if (sdk === 3 && hasValue(names)) {
        if (
          typeof names != "object" ||
          Array.isArray(names) ||
          Object.keys(names).length > 40
        )
          throw new Error(
            "createReplBox: names must be { spelling: implementation | null } with at most 40 entries",
          );
        value31 = Object.create(null);
        for (let value32 of Object.keys(names) as Dynamic) {
          if (
            !/^[A-Za-z_$][\w$]{0,30}$/.test(value32) ||
            UNSAFE_FAST_EDIT_IDS.has(value32) ||
            !(
              names[value32] === null ||
              (typeof names[value32] == "string" &&
                /^[A-Za-z]{1,20}$/.test(names[value32]))
            )
          )
            throw new Error(
              'createReplBox: names: "' +
                value32 +
                '" must be an identifier and name an implementation (or null)',
            );
          value31[value32] = names[value32];
        }
      }
      sandboxConfig = {
        version: sdk,
        paths: filePathsById,
        names: value31,
        texts: value28,
        layouts: value29,
        title: hasValue(verbs.title) ? verbs.title : "",
        sections: items2,
      };
    }
    let value: Dynamic =
        typeof onPreview == "function" &&
        Number.isFinite(effectiveLimits.previewMs) &&
        effectiveLimits.previewMs >= 0,
      value2: Dynamic = JSON.stringify({
        deck: mode === "deck" ? validateDeck(deck, "deck") : null,
        verbs: normalizedDeck,
        sdk: sandboxConfig,
        previewMs: value ? Math.round(effectiveLimits.previewMs) : -1,
        pace:
          effectiveLimits.pace && typeof effectiveLimits.pace == "object"
            ? {
                frameCharsPerMs: effectiveLimits.pace.frameCharsPerMs,
                frameMs: effectiveLimits.pace.frameMs,
                previewCharsPerMs: effectiveLimits.pace.previewCharsPerMs,
                maxPreviews: effectiveLimits.pace.maxPreviews,
              }
            : undefined,
        chains:
          typeof effectiveLimits.chains == "boolean"
            ? effectiveLimits.chains
            : undefined,
      }),
      value3: Dynamic = Array.from(
        crypto.getRandomValues(new Uint8Array(16)),
        (input?: Dynamic): Dynamic => input.toString(16).padStart(2, "0"),
      ).join(""),
      value4: Dynamic = /^https?:/.test(location.origin)
        ? location.origin
        : "*";
    if (fastEditWorkerSource === "") {
      if (verifiedFastEditWorkerBytes === null)
        throw new Error(
          "createReplBox: the Worker's text has not been accepted (acceptWorker)",
        );
      fastEditWorkerSource = jsonForInlineScript(
        new TextDecoder("utf-8", {
          fatal: true,
        }).decode(verifiedFastEditWorkerBytes),
      );
      verifiedFastEditWorkerBytes = null;
    }
    let value5: Dynamic =
        '<!doctype html><meta http-equiv="Content-Security-Policy" content="' +
        FAST_EDIT_SANDBOX_CSP +
        '"><meta charset="utf-8"><script type="text/plain" id="w">' +
        fastEditWorkerSource +
        '<\/script><script type="text/plain" id="h">' +
        jsonForInlineScript(html) +
        '<\/script><script type="text/plain" id="d">' +
        jsonForInlineScript(value2) +
        "<\/script><script>" +
        FAST_EDIT_IFRAME_BRIDGE_SOURCE.replace("__NONCE__", value3).replace(
          "__ORIGIN__",
          value4,
        ) +
        "<\/script>",
      value6: Dynamic = (document as Dynamic).createElement("iframe");
    value6.setAttribute("sandbox", "allow-scripts");
    value6.setAttribute("aria-hidden", "true");
    value6.setAttribute("tabindex", "-1");
    value6.style.display = "none";
    if (
      !(
        value6.sandbox &&
        value6.sandbox.length === 1 &&
        value6.sandbox.contains("allow-scripts")
      )
    )
      throw new Error(
        'createReplBox: the frame must carry sandbox="allow-scripts" and nothing else',
      );
    let flag: Dynamic = false,
      flag2: Dynamic = false,
      flag3: Dynamic = false,
      flag4: Dynamic = false,
      text: Dynamic = "destroyed",
      index2: Dynamic = 0,
      index3: Dynamic = 0,
      index4: Dynamic = 0,
      index5: Dynamic = 0,
      value7: Dynamic = -1,
      value8: Dynamic = Date.now(),
      value9: Dynamic = value8,
      items: Dynamic = [],
      index6: Dynamic = 0,
      index7: Dynamic = 0,
      index8: Dynamic = 0,
      index9: Dynamic = 0,
      index10: Dynamic = 0,
      index11: Dynamic = 0,
      index12: Dynamic = 0,
      index13: Dynamic = 0,
      index14: Dynamic = 0,
      index15: Dynamic = 0,
      values: Dynamic = new Set(),
      value10: Dynamic,
      promise: Dynamic = new Promise((input?: Dynamic): Dynamic => {
        value10 = input;
      }),
      callback: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic => {
        if (typeof input == "function")
          try {
            input(options);
          } catch (value28: Dynamic) {
            setTimeout((): Dynamic => {
              throw value28;
            });
          }
      };
    function value11(): Dynamic {
      if (!flag) {
        flag = true;
        (window as Dynamic).removeEventListener("message", value16);
        value6.removeEventListener("load", value14);
        clearInterval(value27);
        value6.remove();
        items.length = 0;
        for (let value28 of entries.values() as Dynamic) value28.resolve(null);
        entries.clear();
        value10({
          ok: false,
          code: text,
        });
      }
    }
    function value12(input?: Dynamic, options?: Dynamic): Dynamic {
      flag ||
        ((text = input),
        value11(),
        callback(onError, {
          code: input,
          message: options || input,
          fatal: true,
        }));
    }
    function value13(): Dynamic {
      ++index3 >= effectiveLimits.maxDrops &&
        value12("protocol", "too many malformed messages");
    }
    function value14(): Dynamic {
      if (++index2 > 1)
        return value12(
          "navigated",
          "the sandbox frame loaded a second document",
        );
      let flag5: Dynamic = false;
      try {
        flag5 = value6.contentDocument !== null;
      } catch {
        flag5 = false;
      }
      flag5 && value12("same-origin", "the sandbox frame is not cross-origin");
    }
    let callback2: Dynamic = (items2?: Dynamic, options?: Dynamic): Dynamic =>
      typeof items2 == "string" && items2.length <= options;
    function value15(items2?: Dynamic): Dynamic {
      if (typeof items2 == "string") return items2.length;
      if (!items2 || typeof items2 != "object") return 0;
      let index17: Dynamic = 0,
        index18: Dynamic = 0;
      for (let value28 in items2) {
        let value29: Dynamic = items2[value28];
        if (typeof value29 == "string") index17 += value29.length;
        else if (value29 && typeof value29 == "object")
          for (let value30 in value29) {
            let value31: Dynamic = value29[value30];
            if (++index18 > 5e4) return index17 + 1e9;
            if (typeof value31 == "string") index17 += value31.length;
            else if (value31 && typeof value31 == "object")
              for (let value32 in value31) {
                if (++index18 > 5e4) return index17 + 1e9;
                typeof value31[value32] == "string" &&
                  (index17 += value31[value32].length);
              }
          }
      }
      return index17;
    }
    function value16(dataset?: Dynamic): Dynamic {
      if (flag || dataset.source !== value6.contentWindow) return;
      let data: Dynamic = dataset.data;
      if (data && typeof data == "object" && data.kind === "html") {
        let value28: Dynamic = value15(data);
        if (
          value28 > effectiveLimits.maxHtml + effectiveLimits.maxStmt + 1e3 ||
          (index14 += value28) > effectiveLimits.maxFrameChars
        )
          return value12(
            "flood",
            "over " +
              effectiveLimits.maxFrameChars +
              " characters of result frames came out of the sandbox in one run",
          );
      } else if ((index13 += value15(data)) > effectiveLimits.maxOutChars)
        return value12(
          "flood",
          "over " +
            effectiveLimits.maxOutChars +
            " characters came out of the sandbox in one run",
        );
      if (
        dataset.origin !== "null" ||
        !data ||
        typeof data != "object" ||
        data.nonce !== value3 ||
        !FAST_EDIT_WORKER_MESSAGE_KINDS.has(data.kind)
      )
        return value13();
      if (++index4 > effectiveLimits.maxMessages)
        return value12(
          "flood",
          "over " + effectiveLimits.maxMessages + " messages in one run",
        );
      value8 = Date.now();
      if (data.kind !== "beat") {
        if (data.kind === "fault")
          return value12(
            "no-worker",
            callback2(data.message, effectiveLimits.maxMessage)
              ? data.message
              : "no worker",
          );
        if (data.kind === "ready") {
          if (flag2) return value13();
          flag2 = true;
          value10({
            ok: true,
          });
          for (let value28 of items.splice(0) as Dynamic) value25(value28);
          return;
        }
        if (data.kind === "log") {
          if (!hasSdk)
            return callback2(data.message, effectiveLimits.maxMessage)
              ? callback(onLog, {
                  message: data.message,
                })
              : value13();
          if (
            !callback2(data.message, effectiveLimits.maxLogMessage) ||
            (data.n !== undefined &&
              !(Number.isInteger(data.n) && data.n >= 0 && data.n <= 1e5)) ||
            (data.cut !== undefined && typeof data.cut != "boolean")
          )
            return value13();
          if (data.n !== undefined) {
            if (
              index12 + 1 > effectiveLimits.maxLogCalls ||
              index11 + data.message.length > effectiveLimits.maxLogChars
            )
              return value13();
            index12++;
            index11 += data.message.length;
          } else if (data.message.length > effectiveLimits.maxMessage)
            return value13();
          return callback(
            onLog,
            data.n === undefined
              ? {
                  message: data.message,
                }
              : {
                  message: data.message,
                  n: data.n,
                  cut: data.cut === true,
                },
          );
        }
        if (data.kind === "error") {
          if (
            !callback2(data.message, effectiveLimits.maxMessage) ||
            (data.stmt !== undefined &&
              !callback2(data.stmt, effectiveLimits.maxStmt))
          )
            return value13();
          let value28: Dynamic =
              data.code !== undefined || data.id !== undefined,
            id: Dynamic = data.id;
          if (
            value28 &&
            !(
              sdk === 3 &&
              (id === undefined || isSafeFastEditId(id)) &&
              (data.code === "exists"
                ? knownIds.has(id)
                : data.code === "removed"
                  ? createdIds.has(id)
                  : data.code === "own"
                    ? id === undefined || isReservedFastEditName(id)
                    : data.code === "not_plain" && id === undefined)
            )
          )
            return value13();
          callback(
            onError,
            Object.assign(
              {
                code: "statement",
                message: hasSdk
                  ? data.message
                      .split(
                        `
`,
                      )[0]
                      .slice(0, effectiveLimits.maxErrorChars)
                  : data.message,
                stmt: data.stmt || "",
                fatal: false,
              },
              value28
                ? id === undefined
                  ? {
                      refused: data.code,
                    }
                  : {
                      refused: data.code,
                      id: id,
                    }
                : {},
            ),
          );
          !hasSdk &&
            ++index5 >= effectiveLimits.maxStatements &&
            value12("maxStatements");
          return;
        }
        if (data.kind === "deck") return value17(data);
        if (data.kind === "op") return value18(data);
        if (data.kind === "view" || data.kind === "handles")
          return value23(data);
        if (data.kind === "preview") return value21(data);
        if (data.kind === "done") return value19(data);
        if (data.kind === "touch") return value20(data);
        if (
          !callback2(data.html, effectiveLimits.maxHtml) ||
          !Number.isInteger(data.seq) ||
          data.seq < 0 ||
          data.seq <= value7 ||
          !callback2(data.stmt, effectiveLimits.maxStmt) ||
          (data.final !== undefined && typeof data.final != "boolean") ||
          flag4 ||
          (data.final === true && !flag3) ||
          (hasSdk &&
            !(
              typeof data.slideId == "string" &&
              (knownIds.has(data.slideId) ||
                (data.final === true &&
                  (sdk === 3
                    ? data.slideId === "" && data.html === ""
                    : data.slideId === verbs.current)))
            ))
        )
          return value13();
        value7 = data.seq;
        data.final === true && (flag4 = true);
        callback(
          onHtml,
          hasSdk
            ? {
                seq: data.seq,
                slideId: sdk === 3 && data.final === true ? null : data.slideId,
                html: data.html,
                stmt: data.stmt,
                final: data.final === true,
              }
            : {
                seq: data.seq,
                html: data.html,
                stmt: data.stmt,
                final: data.final === true,
              },
        );
        !hasSdk &&
          !data.final &&
          ++index5 >= effectiveLimits.maxStatements &&
          value12("maxStatements");
      }
    }
    let callback3: Dynamic = (items2?: Dynamic, options?: Dynamic): Dynamic =>
      Array.isArray(items2) &&
      items2.length <= options &&
      items2.every(
        (input?: Dynamic): Dynamic =>
          typeof input == "string" && FAST_EDIT_ID_PATTERN.test(input),
      ) &&
      new Set(items2).size === items2.length;
    function value17(input?: Dynamic): Dynamic {
      if (
        mode !== "deck" ||
        flag4 ||
        !Number.isInteger(input.seq) ||
        input.seq < 0 ||
        input.seq <= value7 ||
        (input.stmt !== undefined &&
          !callback2(input.stmt, effectiveLimits.maxStmt)) ||
        !callback3(input.order, effectiveLimits.maxSlides) ||
        !callback3(input.removed, effectiveLimits.maxSlides) ||
        !Array.isArray(input.added) ||
        !Array.isArray(input.clones) ||
        input.added.length > effectiveLimits.maxNewSlides ||
        input.clones.length > effectiveLimits.maxNewSlides
      )
        return value13();
      let index17: Dynamic = 0,
        items2: Dynamic = [],
        items3: Dynamic = [];
      for (let value28 of input.added as Dynamic) {
        if (
          !value28 ||
          typeof value28 != "object" ||
          !FAST_EDIT_ID_PATTERN.test(value28.id) ||
          !callback2(value28.html, effectiveLimits.maxHtml)
        )
          return value13();
        index17 += value28.html.length;
        items2.push({
          id: value28.id,
          html: value28.html,
        });
      }
      for (let value28 of input.clones as Dynamic) {
        if (
          !value28 ||
          typeof value28 != "object" ||
          !FAST_EDIT_ID_PATTERN.test(value28.id) ||
          !FAST_EDIT_ID_PATTERN.test(value28.cloneOf)
        )
          return value13();
        items3.push({
          id: value28.id,
          cloneOf: value28.cloneOf,
        });
      }
      for (let value28 of input.order as Dynamic) index17 += value28.length;
      for (let value28 of input.removed as Dynamic) index17 += value28.length;
      if (index17 > effectiveLimits.maxDeckChars) return value13();
      value7 = input.seq;
      callback(onDeck, {
        seq: input.seq,
        stmt: input.stmt || "",
        order: input.order.slice(),
        added: items2,
        clones: items3,
        removed: input.removed.slice(),
      });
      ++index7 >= effectiveLimits.maxStatements && value12("maxStatements");
    }
    let state: Dynamic = {
        move: ["id"],
        remove: ["id"],
        duplicate: ["id"],
        add: ["html"],
      },
      state2: Dynamic = {
        move: ["before", "after"],
        remove: [],
        duplicate: ["newId"],
        add: ["before", "after", "id"],
      };
    hasSdk &&
      ((state.title = ["title"]),
      (state2.title = []),
      (state.undo = []),
      (state2.undo = []),
      (state.section = ["action", "id"]),
      (state2.section = ["title"]),
      (state2.duplicate = ["newId", "minted", "html"]),
      (state2.add = ["before", "after", "id", "minted"]));
    sdk === 3 &&
      ((state.askClaude = []),
      (state2.askClaude = ["prompt"]),
      (state.order = ["ids"]),
      (state2.order = []),
      (state2.move = ["before", "after", "where"]),
      (state2.add = ["before", "after", "where", "id", "minted"]),
      (state2.duplicate = ["newId", "minted", "html", "where"]));
    let callback4: Dynamic = (input?: Dynamic): Dynamic =>
      input !== null &&
      typeof input == "object" &&
      !Array.isArray(input) &&
      Object.keys(input).length >= 1 &&
      Object.keys(input).length <= 8 &&
      Object.keys(input).every(
        (input2?: Dynamic): Dynamic =>
          /^[A-Za-z][\w-]{0,31}$/.test(input2) &&
          input2 !== "before" &&
          input2 !== "after" &&
          (callback2(input[input2], 100) ||
            (typeof input[input2] == "number" &&
              input[input2] === input[input2])),
      );
    function value18(input?: Dynamic): Dynamic {
      let op2: Dynamic = input.op;
      if (
        mode !== "verbs" ||
        flag4 ||
        !Number.isInteger(input.seq) ||
        input.seq < 0 ||
        input.seq <= value7 ||
        (input.stmt !== undefined &&
          !callback2(input.stmt, effectiveLimits.maxStmt)) ||
        !op2 ||
        typeof op2 != "object" ||
        Array.isArray(op2) ||
        typeof op2.op != "string" ||
        !Object.prototype.hasOwnProperty.call(state, op2.op)
      )
        return value13();
      let value28: Dynamic = state[op2.op],
        value29: Dynamic = state2[op2.op],
        value30: Dynamic = Object.keys(op2),
        state3: Dynamic = {
          op: op2.op,
        };
      for (let value34 of value30 as Dynamic)
        if (
          value34 !== "op" &&
          !value28.includes(value34) &&
          !value29.includes(value34)
        )
          return value13();
      for (let value34 of value28 as Dynamic)
        if (!(value34 in op2)) return value13();
      for (let value34 of value30 as Dynamic) {
        if (value34 === "op") continue;
        let value35: Dynamic = op2[value34];
        if (
          !(value34 === "html"
            ? callback2(value35, effectiveLimits.maxHtml) &&
              (sdk === 3 ? /^<[a-z][a-z0-9-]*[\s>]/i : /^<section[\s>]/i).test(
                value35,
              )
            : value34 === "ids"
              ? callback3(value35, effectiveLimits.maxSlides) &&
                value35.every(
                  (input2?: Dynamic): Dynamic => knownIds.has(input2),
                )
              : value34 === "where"
                ? callback4(value35)
                : value34 === "title"
                  ? callback2(value35, 300) && value35.length > 0
                  : value34 === "prompt"
                    ? callback2(value35, 1e3) && value35.length > 0
                    : value34 === "minted"
                      ? value35 === true
                      : value34 === "action"
                        ? value35 === "start" ||
                          value35 === "rename" ||
                          value35 === "remove"
                        : isSafeFastEditId(value35))
        )
          return value13();
        state3[value34] =
          value34 === "where"
            ? Object.assign({}, value35)
            : value34 === "ids"
              ? value35.slice()
              : value35;
      }
      if (hasSdk) {
        for (let value35 of ["id", "before", "after"] as Dynamic)
          if (
            value35 in op2 &&
            !(op2.op === "add" && value35 === "id") &&
            !knownIds.has(op2[value35])
          )
            return value13();
        let value34: Dynamic =
          op2.op === "add"
            ? op2.id
            : op2.op === "duplicate"
              ? op2.newId
              : undefined;
        if (
          (value34 !== undefined &&
            (knownIds.has(value34) ||
              knownIds.size >= effectiveLimits.maxSlides)) ||
          (sdk === 3 &&
            value34 !== undefined &&
            (!FAST_EDIT_NAME_PATTERN.test(value34) ||
              isReservedFastEditName(value34))) ||
          (op2.op === "section" && (op2.action === "remove") == "title" in op2)
        )
          return value13();
      }
      if (
        sdk === 3
          ? op2.op === "move"
            ? +(+("before" in op2) + +("after" in op2)) + +("where" in op2) != 1
            : op2.op === "add" &&
              +(+("before" in op2) + +("after" in op2)) + +("where" in op2) > 1
          : (op2.op === "move" || op2.op === "add") &&
            "before" in op2 == "after" in op2
      )
        return value13();
      let value31: Dynamic = typeof op2.html == "string" ? op2.html.length : 0,
        value32: Dynamic =
          sdk === 3 && (op2.op === "undo" || op2.op === "askClaude");
      if (value32 && stopped) return value13();
      let value33: Dynamic = value32 || (sdk === 3 && op2.op === "remove");
      if (
        (!value33 && index8 + 1 > effectiveLimits.maxOps) ||
        index9 + value31 > effectiveLimits.maxDeckChars
      )
        return value13();
      value33 || index8++;
      value32 && (stopped = true);
      index9 += value31;
      value7 = input.seq;
      hasSdk &&
        (op2.op === "add" && op2.id !== undefined && knownIds.add(op2.id),
        op2.op === "duplicate" &&
          op2.newId !== undefined &&
          knownIds.add(op2.newId),
        op2.op === "remove" &&
          (knownIds.delete(op2.id), createdIds.add(op2.id)));
      callback(onOp, {
        seq: input.seq,
        stmt: input.stmt || "",
        op: state3,
      });
    }
    function value19(input?: Dynamic): Dynamic {
      if (
        !hasSdk ||
        flag4 ||
        !Number.isInteger(input.seq) ||
        input.seq < 0 ||
        input.seq <= value7 ||
        !Number.isInteger(input.n) ||
        input.n <= index10 ||
        input.n > 1e5 ||
        !callback2(input.stmt, effectiveLimits.maxStmt) ||
        !callback3(input.changed, effectiveLimits.maxSlides) ||
        !input.changed.every(
          (input2?: Dynamic): Dynamic => knownIds.has(input2),
        ) ||
        !Number.isInteger(input.logged) ||
        input.logged < 0 ||
        input.logged > 1e4 ||
        (input.skipped !== undefined && typeof input.skipped != "boolean") ||
        (input.handles !== undefined &&
          !(
            sdk === 3 &&
            callback3(input.handles, effectiveLimits.maxSlides) &&
            input.handles.every(
              (input2?: Dynamic): Dynamic => knownIds.has(input2),
            )
          )) ||
        (input.threw !== undefined &&
          !(
            input.threw &&
            typeof input.threw == "object" &&
            !Array.isArray(input.threw) &&
            Object.keys(input.threw).length === 1 &&
            callback2(input.threw.message, effectiveLimits.maxMessage)
          ))
      )
        return value13();
      value7 = input.seq;
      index10 = input.n;
      let state3: Dynamic = {
        seq: input.seq,
        n: input.n,
        stmt: input.stmt,
        changed: input.changed.slice(),
        logged: input.logged,
      };
      input.threw &&
        (state3.threw = {
          message: input.threw.message
            .split(
              `
`,
            )[0]
            .slice(0, effectiveLimits.maxErrorChars),
        });
      input.skipped === true && (state3.skipped = true);
      input.handles !== undefined && (state3.handles = input.handles.slice());
      callback(onDone, state3);
      ++index5 >= effectiveLimits.maxStatements && value12("maxStatements");
    }
    function value20(input?: Dynamic): Dynamic {
      if (
        !hasSdk ||
        flag4 ||
        !Number.isInteger(input.seq) ||
        input.seq < 0 ||
        input.seq <= value7 ||
        !Number.isInteger(input.n) ||
        input.n < 0 ||
        input.n > 1e5 ||
        typeof input.slideId != "string" ||
        !knownIds.has(input.slideId) ||
        values.has(input.slideId)
      )
        return value13();
      value7 = input.seq;
      values.add(input.slideId);
      callback(onTouch, {
        seq: input.seq,
        n: input.n,
        slideId: input.slideId,
      });
    }
    let values2: Dynamic = new Set([
      "html",
      "append",
      "prepend",
      "after",
      "before",
      "create",
      "add",
    ]);
    function value21(event?: Dynamic): Dynamic {
      if (
        !value ||
        flag4 ||
        !Number.isInteger(event.seq) ||
        event.seq < 0 ||
        event.seq <= value7 ||
        !values2.has(event.method) ||
        !callback2(event.html, effectiveLimits.maxHtml) ||
        !callback2(event.head, 80)
      )
        return value13();
      let value28: Dynamic = null;
      if (event.target !== null && event.target !== undefined) {
        let target: Dynamic = event.target;
        if (
          typeof target != "object" ||
          Array.isArray(target) ||
          Object.keys(target).some(
            (input?: Dynamic): Dynamic => input !== "file" && input !== "id",
          ) ||
          !(
            target.file === null ||
            (typeof target.file == "string" &&
              hasSdk &&
              knownIds.has(target.file))
          ) ||
          !(target.id === null || callback2(target.id, 128))
        )
          return value13();
        value28 = {
          file: target.file,
          id: target.id,
        };
      }
      if (
        (event.method === "create" || event.method === "add") !=
          (value28 === null) ||
        ++index15 > effectiveLimits.maxPreviews
      )
        return value13();
      value7 = event.seq;
      callback(onPreview, {
        seq: event.seq,
        method: event.method,
        target: value28,
        html: event.html,
        head: event.head,
      });
    }
    let entries: Dynamic = new Map(),
      index16: Dynamic = 0,
      value22: Dynamic = /^k[a-z]{0,2}$/;
    function value23(source?: Dynamic): Dynamic {
      let value28: Dynamic = Number.isInteger(source.req)
        ? entries.get(source.req)
        : undefined;
      if (
        sdk !== 3 ||
        !value28 ||
        value28.kind !== source.kind ||
        source.attr !== "id" ||
        !(typeof source.prefix == "string" && value22.test(source.prefix))
      )
        return value13();
      let value29: Dynamic;
      if (source.kind === "view") {
        if (
          typeof source.slideId != "string" ||
          source.slideId !== value28.id ||
          !knownIds.has(source.slideId) ||
          !callback2(source.html, effectiveLimits.maxViewChars)
        )
          return value13();
        value29 = {
          id: source.slideId,
          attr: "id",
          prefix: source.prefix,
          html: source.html,
        };
      } else {
        if (
          !Array.isArray(source.rows) ||
          source.rows.length > effectiveLimits.maxHandleRows
        )
          return value13();
        let items2: Dynamic = [];
        for (let value30 of source.rows as Dynamic) {
          if (
            !value30 ||
            typeof value30 != "object" ||
            !(
              typeof value30.k == "string" &&
              value30.k.startsWith(source.prefix) &&
              /^\d{1,6}$/.test(value30.k.slice(source.prefix.length))
            ) ||
            typeof value30.file != "string" ||
            !knownIds.has(value30.file) ||
            !callback2(value30.tag, 20) ||
            !/^[a-z0-9]*$/.test(value30.tag) ||
            !callback2(value30.words, 40)
          )
            return value13();
          items2.push({
            k: value30.k,
            file: value30.file,
            tag: value30.tag,
            words: value30.words,
          });
        }
        value29 = {
          attr: "id",
          prefix: source.prefix,
          rows: items2,
        };
      }
      entries.delete(source.req);
      value28.resolve(value29);
    }
    function value24(input?: Dynamic, options?: Dynamic): Dynamic {
      return sdk !== 3
        ? Promise.reject(
            new Error("createReplBox: view() and handles() are sdk:3"),
          )
        : promise.then(
            (input2?: Dynamic): Dynamic =>
              new Promise((input3?: Dynamic): Dynamic => {
                if (!input2.ok || flag || index16 >= effectiveLimits.maxAsks)
                  return input3(null);
                let value28: Dynamic = ++index16;
                entries.set(value28, {
                  kind: input,
                  id: options.id,
                  resolve: input3,
                });
                value25(
                  Object.assign(
                    {
                      kind: input,
                      req: value28,
                    },
                    options,
                  ),
                );
              }),
          );
    }
    function value25(input?: Dynamic): Dynamic {
      input.nonce = value3;
      value6.contentWindow.postMessage(input, "*");
    }
    function value26(source?: Dynamic): Dynamic {
      flag ||
        flag4 ||
        (flag3 && source.kind === "chunk") ||
        (flag2 ? value25(source) : items.push(source));
    }
    let value27: Dynamic = setInterval((): Dynamic => {
      if (flag) return;
      let value28: Dynamic = Date.now();
      if (value28 - value9 > effectiveLimits.maxMs)
        return flag4
          ? value11()
          : value12("maxMs", "the run passed " + effectiveLimits.maxMs + " ms");
      if (!flag4) {
        if (!flag2 && value28 - value9 > effectiveLimits.bootMs)
          return value12(
            "no-worker",
            "the sandbox was not ready in " + effectiveLimits.bootMs + " ms",
          );
        if (value28 - value8 > effectiveLimits.silenceMs)
          return value12(
            "timeout",
            "the sandbox went silent for " + effectiveLimits.silenceMs + " ms",
          );
      }
    }, 250);
    (window as Dynamic).addEventListener("message", value16);
    value6.addEventListener("load", value14);
    value6.srcdoc = value5;
    (document as Dynamic).body.appendChild(value6);
    return {
      feed(items2: Dynamic): Dynamic {
        if (!(typeof items2 != "string" || !items2 || flag || flag3)) {
          if ((index6 += items2.length) > effectiveLimits.maxFeedChars)
            return value12(
              "flood",
              "over " +
                effectiveLimits.maxFeedChars +
                " characters fed in one run",
            );
          value26({
            kind: "chunk",
            text: items2,
          });
        }
      },
      view(input: Dynamic): Dynamic {
        let value28: Dynamic =
          (filePathsById &&
            typeof input == "string" &&
            Object.keys(filePathsById).find(
              (input2?: Dynamic): Dynamic => filePathsById[input2] === input,
            )) ||
          input;
        return value24("view", {
          id: value28,
        });
      },
      handles(input: Dynamic): Dynamic {
        return value24("handles", {
          since: Number.isInteger(input) && input > 0 ? input : 0,
        });
      },
      flush(): Dynamic {
        flag2 &&
          !flag3 &&
          value26({
            kind: "flush",
          });
      },
      end(): Dynamic {
        flag3 ||
          ((flag3 = true),
          value26({
            kind: "end",
          }));
      },
      stop: value11,
      destroy: value11,
      ready: promise,
      get alive(): Dynamic {
        return !flag;
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_INPUT_LIMITS",
    () => FAST_EDIT_INPUT_LIMITS,
    (value) => {
      FAST_EDIT_INPUT_LIMITS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_WORKER_SHA256",
    () => FAST_EDIT_WORKER_SHA256,
    (value) => {
      FAST_EDIT_WORKER_SHA256 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_IFRAME_BRIDGE_SOURCE",
    () => FAST_EDIT_IFRAME_BRIDGE_SOURCE,
    (value) => {
      FAST_EDIT_IFRAME_BRIDGE_SOURCE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_SANDBOX_CSP",
    () => FAST_EDIT_SANDBOX_CSP,
    (value) => {
      FAST_EDIT_SANDBOX_CSP = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_SANDBOX_LIMITS",
    () => FAST_EDIT_SANDBOX_LIMITS,
    (value) => {
      FAST_EDIT_SANDBOX_LIMITS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_SDK3_LIMITS",
    () => FAST_EDIT_SDK3_LIMITS,
    (value) => {
      FAST_EDIT_SDK3_LIMITS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_ID_PATTERN",
    () => FAST_EDIT_ID_PATTERN,
    (value) => {
      FAST_EDIT_ID_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "UNSAFE_FAST_EDIT_IDS",
    () => UNSAFE_FAST_EDIT_IDS,
    (value) => {
      UNSAFE_FAST_EDIT_IDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isSafeFastEditId",
    () => isSafeFastEditId,
    (value) => {
      isSafeFastEditId = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_NAME_PATTERN",
    () => FAST_EDIT_NAME_PATTERN,
    (value) => {
      FAST_EDIT_NAME_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_HANDLE_ID_PATTERN",
    () => FAST_EDIT_HANDLE_ID_PATTERN,
    (value) => {
      FAST_EDIT_HANDLE_ID_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RESERVED_FAST_EDIT_NAMES",
    () => RESERVED_FAST_EDIT_NAMES,
    (value) => {
      RESERVED_FAST_EDIT_NAMES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isReservedFastEditName",
    () => isReservedFastEditName,
    (value) => {
      isReservedFastEditName = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_WORKER_MESSAGE_KINDS",
    () => FAST_EDIT_WORKER_MESSAGE_KINDS,
    (value) => {
      FAST_EDIT_WORKER_MESSAGE_KINDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsonForInlineScript",
    () => jsonForInlineScript,
    (value) => {
      jsonForInlineScript = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fastEditWorkerSource",
    () => fastEditWorkerSource,
    (value) => {
      fastEditWorkerSource = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "verifiedFastEditWorkerBytes",
    () => verifiedFastEditWorkerBytes,
    (value) => {
      verifiedFastEditWorkerBytes = value;
    },
  );
  bindRuntimeValue(runtime, "verifyFastEditWorker", () => verifyFastEditWorker);
  bindRuntimeValue(
    runtime,
    "createFastEditSandbox",
    () => createFastEditSandbox,
  );
  bindRuntimeValue(
    runtime,
    "installFastEditWorker",
    () => installFastEditWorker,
    (value) => {
      installFastEditWorker = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_WORKER_LIFETIME_LIMITS",
    () => FAST_EDIT_WORKER_LIFETIME_LIMITS,
    (value) => {
      FAST_EDIT_WORKER_LIFETIME_LIMITS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_PREVIEW_PACING",
    () => FAST_EDIT_PREVIEW_PACING,
    (value) => {
      FAST_EDIT_PREVIEW_PACING = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "deriveSandboxBridgeLimits",
    () => deriveSandboxBridgeLimits,
    (value) => {
      deriveSandboxBridgeLimits = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_CANVAS_SANDBOX_LIMITS",
    () => FAST_EDIT_CANVAS_SANDBOX_LIMITS,
    (value) => {
      FAST_EDIT_CANVAS_SANDBOX_LIMITS = value;
    },
  );
  return () => {
    FAST_EDIT_INPUT_LIMITS = {
      maxSection: 2e5,
      maxBoxChars: 6e5,
      maxFiles: 512,
      maxFed: 2e5,
    };
    FAST_EDIT_WORKER_SHA256 =
      "18e7e4395b5e25f4a482f14c74fa91959d4772ce7ca3a23411abeb1505efc8b1";
    FAST_EDIT_IFRAME_BRIDGE_SOURCE =
      '(function fastEditIframeBridge() {\n  const nonce = "__NONCE__";\n  const origin = "__ORIGIN__";\n  const parentWindow = window.parent;\n  const postToParent = (message) => {\n    message.nonce = nonce;\n    parentWindow.postMessage(message, origin);\n  };\n  const readJsonScript = (id) => {\n    return JSON.parse(document.getElementById(id).textContent);\n  };\n  let worker;\n  let ready = false;\n  const fault = (message) => postToParent({ kind: "fault", message });\n  try {\n    worker = new Worker(\n      URL.createObjectURL(\n        new Blob([readJsonScript("w")], { type: "text/javascript" })\n      )\n    );\n  } catch {\n    fault("no worker");\n    return;\n  }\n  worker.onerror = (event) => {\n    const message = String(event && event.message || "failed").slice(0, 300);\n    if (ready)\n      postToParent({\n        kind: "error",\n        message: "uncaught: " + message,\n        stmt: ""\n      });\n    else fault("worker: " + message);\n  };\n  worker.onmessage = (event) => {\n    const data = event.data;\n    const kind = data && data.kind;\n    if (kind === "ready") {\n      ready = true;\n      postToParent({ kind });\n    } else if (kind === "beat") postToParent({ kind });\n    else if (kind === "html")\n      postToParent({\n        kind,\n        seq: data.seq,\n        slideId: data.slideId,\n        html: data.html,\n        stmt: data.stmt,\n        final: data.final === true\n      });\n    else if (kind === "done")\n      postToParent({\n        kind,\n        seq: data.seq,\n        n: data.n,\n        stmt: data.stmt,\n        changed: data.changed,\n        logged: data.logged,\n        threw: data.threw,\n        skipped: data.skipped,\n        handles: data.handles\n      });\n    else if (kind === "touch")\n      postToParent({ kind, seq: data.seq, n: data.n, slideId: data.slideId });\n    else if (kind === "preview")\n      postToParent({\n        kind,\n        seq: data.seq,\n        method: data.method,\n        target: data.target,\n        html: data.html,\n        head: data.head\n      });\n    else if (kind === "view")\n      postToParent({\n        kind,\n        req: data.req,\n        slideId: data.slideId,\n        attr: data.attr,\n        prefix: data.prefix,\n        html: data.html\n      });\n    else if (kind === "handles")\n      postToParent({\n        kind,\n        req: data.req,\n        attr: data.attr,\n        prefix: data.prefix,\n        rows: data.rows\n      });\n    else if (kind === "op")\n      postToParent({ kind, seq: data.seq, stmt: data.stmt, op: data.op });\n    else if (kind === "error")\n      postToParent({\n        kind,\n        message: data.message,\n        stmt: data.stmt,\n        code: data.code,\n        id: data.id\n      });\n    else if (kind === "log")\n      postToParent({ kind, message: data.message, n: data.n, cut: data.cut });\n  };\n  addEventListener("message", (event) => {\n    const data = event.data;\n    if (event.source !== parentWindow || !data || data.nonce !== nonce) return;\n    if (data.kind === "chunk" && typeof data.text === "string")\n      worker.postMessage({ kind: "chunk", text: data.text });\n    else if (data.kind === "flush") worker.postMessage({ kind: "flush" });\n    else if (data.kind === "view" && typeof data.id === "string")\n      worker.postMessage({ kind: "view", id: data.id, req: data.req });\n    else if (data.kind === "handles")\n      worker.postMessage({ kind: "handles", since: data.since, req: data.req });\n    else if (data.kind === "end") worker.postMessage({ kind: "end" });\n  });\n  const configuration = JSON.parse(readJsonScript("d")) || {};\n  worker.postMessage({\n    kind: "init",\n    html: readJsonScript("h"),\n    deck: configuration.deck || null,\n    verbs: configuration.verbs || null,\n    sdk: configuration.sdk || null,\n    previewMs: configuration.previewMs,\n    pace: configuration.pace,\n    chains: configuration.chains\n  });\n})()';
    FAST_EDIT_SANDBOX_CSP =
      "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:; child-src blob:; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'";
    FAST_EDIT_SANDBOX_LIMITS = {
      silenceMs: 4e3,
      bootMs: 1500,
      maxStatements: 200,
      maxMs: 12e4,
      maxHtml: 2e5,
      maxMessage: 2e3,
      maxStmt: 4e3,
      maxDrops: 5,
      maxMessages: 2e3,
      maxFeedChars: 2e5,
      maxSlides: 500,
      maxNewSlides: 8,
      maxDeckChars: 1e6,
      maxOps: 24,
      maxOutChars: 8e6,
      previewMs: 120,
      maxPreviews: 1500,
    };
    FAST_EDIT_SDK3_LIMITS = {
      maxMessages: 6e3,
      maxSlides: 512,
      maxInputChars: 2e6,
      maxLayouts: 32,
      maxLogMessage: 12e3,
      maxLogChars: 24576,
      maxLogCalls: 12,
      maxErrorChars: 200,
      maxStatements: 400,
      maxOutChars: 16e6,
      maxFrameChars: 16e6,
      maxViewChars: 3e5,
      maxHandleRows: 4e3,
      maxAsks: 400,
    };
    FAST_EDIT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
    UNSAFE_FAST_EDIT_IDS = new Set(["__proto__", "constructor", "prototype"]);
    isSafeFastEditId = (input?: Dynamic): Dynamic =>
      typeof input == "string" &&
      FAST_EDIT_ID_PATTERN.test(input) &&
      !UNSAFE_FAST_EDIT_IDS.has(input);
    FAST_EDIT_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,23}$/;
    FAST_EDIT_HANDLE_ID_PATTERN = /^k[a-z]{0,2}\d{1,6}$/;
    RESERVED_FAST_EDIT_NAMES = [
      "container",
      "constructor",
      "prototype",
      "body",
      "html",
      "head",
    ];
    isReservedFastEditName = (input?: Dynamic): Dynamic =>
      FAST_EDIT_HANDLE_ID_PATTERN.test(input) ||
      RESERVED_FAST_EDIT_NAMES.includes(input.toLowerCase());
    FAST_EDIT_WORKER_MESSAGE_KINDS = new Set(
      [
        "ready",
        "html",
        "op",
        "done",
        "touch",
        "preview",
        "view",
        "handles",
        "error",
        "log",
        "beat",
        "fault",
      ].concat([]),
    );
    jsonForInlineScript = (input?: Dynamic): Dynamic =>
      JSON.stringify(String(input)).replace(/</g, "\\u003c");
    fastEditWorkerSource = "";
    verifiedFastEditWorkerBytes = null;
    installFastEditWorker = (input?: Dynamic): Dynamic =>
      verifyFastEditWorker(input);
    FAST_EDIT_WORKER_LIFETIME_LIMITS = {
      lifeMs: 27 * 6e4,
      maxSection: FAST_EDIT_INPUT_LIMITS.maxSection,
      maxFed: FAST_EDIT_INPUT_LIMITS.maxFed,
      maxStmt: 4e3,
      maxFiles: FAST_EDIT_INPUT_LIMITS.maxFiles,
      maxStatements: 400,
      maxOps: 24,
      beatMs: 500,
    };
    FAST_EDIT_PREVIEW_PACING = {
      frameCharsPerMs: 100,
      frameMs: 250,
      previewCharsPerMs: 5,
      maxPreviews: 1e3,
    };
    deriveSandboxBridgeLimits = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic => ({
      maxMs: input.lifeMs,
      previewMs: 250,
      pace: options,
      maxFrameChars:
        options.frameCharsPerMs * input.lifeMs +
        (input.maxFiles + input.maxOps + 1) *
          (input.maxSection + input.maxStmt + 200),
      maxMessages: 16e3,
    });
    FAST_EDIT_CANVAS_SANDBOX_LIMITS = deriveSandboxBridgeLimits(
      FAST_EDIT_WORKER_LIFETIME_LIMITS,
      FAST_EDIT_PREVIEW_PACING,
    );
  };
}
