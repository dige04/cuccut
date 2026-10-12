/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installFastEditSession(runtime: RuntimeBindings): () => void {
  var MAX_FAST_EDIT_CALLS: Dynamic;
  var MAX_FAST_EDIT_READ_ROUNDS: Dynamic;
  var MAX_FAST_EDIT_FED_CHARS: Dynamic;
  var MAX_FAST_EDIT_SECTION_CHARS: Dynamic;
  var MAX_FAST_EDIT_BOX_CHARS: Dynamic;
  var MAX_FAST_EDIT_INPUT_LOG_CHARS: Dynamic;
  var MAX_FAST_EDIT_FRAME_OUTPUT_CHARS: Dynamic;
  var OPEN_ARTBOARD_PLACEHOLDER_ID: Dynamic;
  var FAST_EDIT_ERROR_MESSAGES: Dynamic;
  var FAST_EDIT_CAPABILITY_DENIED_CODES: Dynamic;
  var FAST_EDIT_CAPABILITY_UNAVAILABLE_MESSAGE: Dynamic;
  var FAST_EDIT_NOOP_CODES: Dynamic;
  var SANDBOX_NOT_READY_MESSAGE_PATTERN: Dynamic;
  var MAX_FAST_EDIT_REPAIR_ATTEMPTS: Dynamic;
  var FAST_EDIT_MARKUP_REPAIR_INSTRUCTIONS: Dynamic;
  var FAST_EDIT_INITIAL_DELAY_MS: Dynamic;
  var FAST_EDIT_COLLECT_READS: Dynamic;
  var FAST_EDIT_ALLOW_EMPTY_SELECTION: Dynamic;
  var FAST_EDIT_CONTROL_CALL_PATTERN: Dynamic;
  var FAST_EDIT_HTML_INSERTION_PATTERN: Dynamic;
  var FAST_EDIT_MUTATION_CALL_PATTERN: Dynamic;
  var FAST_EDIT_REPAIR_MESSAGES: Dynamic;
  var describeFastEditRefusal: Dynamic;
  var createFastEditSessionState: Dynamic;
  var FAST_EDIT_ROUNDTRIP_TIMEOUT_MS: Dynamic;
  var FAST_EDIT_SANDBOX_START_TIMEOUT_MS: Dynamic;
  var FAST_EDIT_TIMEOUT_SENTINEL: Dynamic;
  var withFastEditTimeout: Dynamic;
  var waitForFastEditAbort: Dynamic;
  var artboardRectangle: Dynamic;
  var distanceBetweenArtboards: Dynamic;
  var normalizeFastEditThrownError: Dynamic;
  var rehydrateFastEditHtml: Dynamic;
  var resolveTemplateHandleId: Dynamic;
  function readTemplateInputDefaults(html?: Dynamic): Dynamic {
    let defaults: Dynamic = {};
    try {
      let value: Dynamic = JSON.parse(
        (0, runtime.getDcPropsJson)(html) ?? "{}",
      );
      if (value !== null && typeof value == "object")
        for (let [value2, value3] of Object.entries(value) as Dynamic)
          !value2.startsWith("$") &&
            value3 !== null &&
            typeof value3 == "object" &&
            (defaults[value2] = value3.default);
    } catch {}
    return defaults;
  }
  async function verifySandboxTemplateRoundTrip(
    sandbox?: Dynamic,
    html?: Dynamic,
  ): Promise<Dynamic> {
    let roundTripped: Dynamic = await withFastEditTimeout(
      sandbox
        .roundTrip((0, runtime.wrapFastEditTemplate)(html))
        .catch((): Dynamic => null),
      4e3,
    );
    if (roundTripped === FAST_EDIT_TIMEOUT_SENTINEL || roundTripped === null)
      return "late";
    let innerHtml: Dynamic = (0, runtime.unwrapFastEditSection)(roundTripped);
    if (innerHtml === null) return "reshaped";
    let roundTripValidation: Dynamic = (0, runtime.validateFastEditTemplate)(
        html,
        innerHtml,
      ),
      originalValidation: Dynamic = (0, runtime.validateFastEditTemplate)(
        html,
        html,
      );
    return roundTripValidation.ok &&
      originalValidation.ok &&
      roundTripValidation.template === originalValidation.template
      ? "held"
      : "reshaped";
  }
  function removeHelmetHandleIds(html?: Dynamic, prefix?: Dynamic): Dynamic {
    if (!/^[a-z]{1,8}$/.test(prefix) || !/<(?:sc-)?helmet\b/i.test(html))
      return html;
    let template: Dynamic = (document as Dynamic).createElement("template");
    template.innerHTML = html;
    let handlePattern: Dynamic = new RegExp("^" + prefix + "\\d+$"),
      changed: Dynamic = false;
    for (let value of Array.from(
      template.content.querySelectorAll("helmet, sc-helmet"),
    ) as Dynamic)
      for (let value2 of [
        value,
        ...Array.from(value.querySelectorAll("*")),
      ] as Dynamic) {
        let attribute: Dynamic = value2.getAttribute("id");
        attribute !== null &&
          handlePattern.test(attribute) &&
          (value2.removeAttribute("id"), (changed = true));
      }
    return changed ? template.innerHTML : html;
  }
  function resolveRenderedElementPath(
    selectorPath?: Dynamic,
    html?: Dynamic,
    prefix?: Dynamic,
  ): Dynamic {
    let segments: Dynamic = selectorPath.split(" > "),
      rootSelector: Dynamic = segments[0] ?? "",
      relativeSegments: Dynamic =
        rootSelector === "#dc-root"
          ? segments[1] === "div:nth-of-type(1)"
            ? segments.slice(2)
            : []
          : segments.slice(1);
    if (
      !rootSelector.startsWith("#") ||
      (rootSelector === "#dc-root" && relativeSegments.length === 0) ||
      !/^[a-z]{1,8}$/.test(prefix)
    )
      return null;
    let template: Dynamic = (document as Dynamic).createElement("template");
    template.innerHTML = html;
    let element: Dynamic =
      rootSelector === "#dc-root"
        ? template.content.firstElementChild
        : (Array.from(template.content.querySelectorAll("*")).find(
            (element2?: Dynamic): Dynamic =>
              element2.getAttribute("id") === rootSelector.slice(1),
          ) ?? null);
    for (let value of relativeSegments as Dynamic) {
      let value2: Dynamic =
          /^([a-z][a-z0-9-]{0,23}):nth-of-type\(([1-9][0-9]{0,3})\)$/.exec(
            value,
          ),
        value3: Dynamic = element === null ? [] : Array.from(element.children);
      if (
        value2 === null ||
        value3.some(
          (input?: Dynamic): Dynamic =>
            /^sc-|^(?:dc|x)-import$/.test(input.localName),
        ) ||
        ((element =
          value3.filter(
            (input?: Dynamic): Dynamic => input.localName === value2[1],
          )[Number(value2[2]) - 1] ?? null),
        element === null)
      )
        return null;
    }
    return element === null
      ? null
      : (0, runtime.describeTemplateElementTarget)(element, prefix, -1);
  }
  function resolveTemplateHandleIds(
    ids?: Dynamic,
    options?: Dynamic,
    html?: Dynamic,
    prefix?: Dynamic,
  ): Dynamic {
    if (ids.length === 0 || !/^[a-z]{1,8}$/.test(prefix))
      return ids.map((): Dynamic => null);
    let parse: Dynamic = (input?: Dynamic): Dynamic => {
        let value6: Dynamic = (document as Dynamic).createElement("template");
        value6.innerHTML = (0, runtime.toParserHtml)(input);
        return Array.from(value6.content.querySelectorAll("*"));
      },
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        input.filter(
          (input2?: Dynamic): Dynamic =>
            input2.closest("helmet, sc-helmet") === null,
        ),
      value: Dynamic = parse(options),
      value2: Dynamic = callback(value),
      value3: Dynamic = callback(parse(html)).slice(1),
      callback2: Dynamic = (input?: Dynamic): Dynamic =>
        new Map(
          input.map(
            (input2?: Dynamic, options2?: Dynamic): Dynamic => [
              input2,
              options2,
            ],
          ),
        ),
      value4: Dynamic = callback2(value2),
      value5: Dynamic = callback2(
        value.filter(
          (input?: Dynamic): Dynamic => input.localName === "sc-for",
        ),
      );
    return ids.map((input?: Dynamic): Dynamic => {
      let value6: Dynamic = value[input],
        value7: Dynamic =
          value6 === undefined || value2.length !== value3.length
            ? undefined
            : value3[value4.get(value6) ?? -1];
      return value6 === undefined ||
        value7 === undefined ||
        value7.localName !== value6.localName ||
        (0, runtime.directTargetText)(value7) !==
          (0, runtime.directTargetText)(value6)
        ? null
        : (0, runtime.describeTemplateElementTarget)(
            value7,
            prefix,
            value5.get(value6.parentElement?.closest("sc-for") ?? value6) ?? -1,
          );
    });
  }
  bindRuntimeValue(
    runtime,
    "MAX_FAST_EDIT_CALLS",
    () => MAX_FAST_EDIT_CALLS,
    (value) => {
      MAX_FAST_EDIT_CALLS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_FAST_EDIT_READ_ROUNDS",
    () => MAX_FAST_EDIT_READ_ROUNDS,
    (value) => {
      MAX_FAST_EDIT_READ_ROUNDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_FAST_EDIT_FED_CHARS",
    () => MAX_FAST_EDIT_FED_CHARS,
    (value) => {
      MAX_FAST_EDIT_FED_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_FAST_EDIT_SECTION_CHARS",
    () => MAX_FAST_EDIT_SECTION_CHARS,
    (value) => {
      MAX_FAST_EDIT_SECTION_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_FAST_EDIT_BOX_CHARS",
    () => MAX_FAST_EDIT_BOX_CHARS,
    (value) => {
      MAX_FAST_EDIT_BOX_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_FAST_EDIT_INPUT_LOG_CHARS",
    () => MAX_FAST_EDIT_INPUT_LOG_CHARS,
    (value) => {
      MAX_FAST_EDIT_INPUT_LOG_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_FAST_EDIT_FRAME_OUTPUT_CHARS",
    () => MAX_FAST_EDIT_FRAME_OUTPUT_CHARS,
    (value) => {
      MAX_FAST_EDIT_FRAME_OUTPUT_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OPEN_ARTBOARD_PLACEHOLDER_ID",
    () => OPEN_ARTBOARD_PLACEHOLDER_ID,
    (value) => {
      OPEN_ARTBOARD_PLACEHOLDER_ID = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_ERROR_MESSAGES",
    () => FAST_EDIT_ERROR_MESSAGES,
    (value) => {
      FAST_EDIT_ERROR_MESSAGES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_CAPABILITY_DENIED_CODES",
    () => FAST_EDIT_CAPABILITY_DENIED_CODES,
    (value) => {
      FAST_EDIT_CAPABILITY_DENIED_CODES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_CAPABILITY_UNAVAILABLE_MESSAGE",
    () => FAST_EDIT_CAPABILITY_UNAVAILABLE_MESSAGE,
    (value) => {
      FAST_EDIT_CAPABILITY_UNAVAILABLE_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_NOOP_CODES",
    () => FAST_EDIT_NOOP_CODES,
    (value) => {
      FAST_EDIT_NOOP_CODES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SANDBOX_NOT_READY_MESSAGE_PATTERN",
    () => SANDBOX_NOT_READY_MESSAGE_PATTERN,
    (value) => {
      SANDBOX_NOT_READY_MESSAGE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_FAST_EDIT_REPAIR_ATTEMPTS",
    () => MAX_FAST_EDIT_REPAIR_ATTEMPTS,
    (value) => {
      MAX_FAST_EDIT_REPAIR_ATTEMPTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_MARKUP_REPAIR_INSTRUCTIONS",
    () => FAST_EDIT_MARKUP_REPAIR_INSTRUCTIONS,
    (value) => {
      FAST_EDIT_MARKUP_REPAIR_INSTRUCTIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_INITIAL_DELAY_MS",
    () => FAST_EDIT_INITIAL_DELAY_MS,
    (value) => {
      FAST_EDIT_INITIAL_DELAY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_COLLECT_READS",
    () => FAST_EDIT_COLLECT_READS,
    (value) => {
      FAST_EDIT_COLLECT_READS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_ALLOW_EMPTY_SELECTION",
    () => FAST_EDIT_ALLOW_EMPTY_SELECTION,
    (value) => {
      FAST_EDIT_ALLOW_EMPTY_SELECTION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_CONTROL_CALL_PATTERN",
    () => FAST_EDIT_CONTROL_CALL_PATTERN,
    (value) => {
      FAST_EDIT_CONTROL_CALL_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_HTML_INSERTION_PATTERN",
    () => FAST_EDIT_HTML_INSERTION_PATTERN,
    (value) => {
      FAST_EDIT_HTML_INSERTION_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_MUTATION_CALL_PATTERN",
    () => FAST_EDIT_MUTATION_CALL_PATTERN,
    (value) => {
      FAST_EDIT_MUTATION_CALL_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_REPAIR_MESSAGES",
    () => FAST_EDIT_REPAIR_MESSAGES,
    (value) => {
      FAST_EDIT_REPAIR_MESSAGES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "describeFastEditRefusal",
    () => describeFastEditRefusal,
    (value) => {
      describeFastEditRefusal = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createFastEditSessionState",
    () => createFastEditSessionState,
    (value) => {
      createFastEditSessionState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_ROUNDTRIP_TIMEOUT_MS",
    () => FAST_EDIT_ROUNDTRIP_TIMEOUT_MS,
    (value) => {
      FAST_EDIT_ROUNDTRIP_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_SANDBOX_START_TIMEOUT_MS",
    () => FAST_EDIT_SANDBOX_START_TIMEOUT_MS,
    (value) => {
      FAST_EDIT_SANDBOX_START_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_TIMEOUT_SENTINEL",
    () => FAST_EDIT_TIMEOUT_SENTINEL,
    (value) => {
      FAST_EDIT_TIMEOUT_SENTINEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "withFastEditTimeout",
    () => withFastEditTimeout,
    (value) => {
      withFastEditTimeout = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "waitForFastEditAbort",
    () => waitForFastEditAbort,
    (value) => {
      waitForFastEditAbort = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "artboardRectangle",
    () => artboardRectangle,
    (value) => {
      artboardRectangle = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "distanceBetweenArtboards",
    () => distanceBetweenArtboards,
    (value) => {
      distanceBetweenArtboards = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeFastEditThrownError",
    () => normalizeFastEditThrownError,
    (value) => {
      normalizeFastEditThrownError = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "readTemplateInputDefaults",
    () => readTemplateInputDefaults,
  );
  bindRuntimeValue(
    runtime,
    "rehydrateFastEditHtml",
    () => rehydrateFastEditHtml,
    (value) => {
      rehydrateFastEditHtml = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "verifySandboxTemplateRoundTrip",
    () => verifySandboxTemplateRoundTrip,
  );
  bindRuntimeValue(
    runtime,
    "removeHelmetHandleIds",
    () => removeHelmetHandleIds,
  );
  bindRuntimeValue(
    runtime,
    "resolveRenderedElementPath",
    () => resolveRenderedElementPath,
  );
  bindRuntimeValue(
    runtime,
    "resolveTemplateHandleId",
    () => resolveTemplateHandleId,
    (value) => {
      resolveTemplateHandleId = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "resolveTemplateHandleIds",
    () => resolveTemplateHandleIds,
  );
  return () => {
    MAX_FAST_EDIT_CALLS = 6;
    MAX_FAST_EDIT_READ_ROUNDS = 2;
    MAX_FAST_EDIT_FED_CHARS = runtime.FAST_EDIT_INPUT_LIMITS.maxFed;
    MAX_FAST_EDIT_SECTION_CHARS = runtime.FAST_EDIT_INPUT_LIMITS.maxSection;
    MAX_FAST_EDIT_BOX_CHARS = runtime.FAST_EDIT_INPUT_LIMITS.maxBoxChars;
    MAX_FAST_EDIT_INPUT_LOG_CHARS = 1e3;
    MAX_FAST_EDIT_FRAME_OUTPUT_CHARS = 16e6;
    OPEN_ARTBOARD_PLACEHOLDER_ID = "~open";
    FAST_EDIT_ERROR_MESSAGES = {
      rate_limited:
        // CucCut: user-facing copy calls the agent "the agent", not Claude.
        "The agent is busy, or your usage limit is reached. Try again later.",
      queue_overflow:
        "The agent is busy, or your usage limit is reached. Try again later.",
      invalid_request: "Fast Edit could not ask the agent. Nothing changed.",
      transform_error: "Fast Edit could not ask the agent. Nothing changed.",
      invalid_json: "Fast Edit could not ask the agent. Nothing changed.",
      tools_unavailable: "Fast Edit could not ask the agent. Nothing changed.",
      image_rejected: "The agent could not take that picture. Try without it.",
      images_unavailable:
        "The agent cannot take pictures in this view. Try without them.",
      session_expired: "Sign in again to ask the agent here.",
      refused: "The agent declined that request. Try different words.",
      prompt_too_large:
        "This artboard is too big to send. Trim it and try again.",
      upstream_error: "Could not reach the agent. Try again.",
      refused_add:
        "The agent could not name the new artboard. Nothing was added. Try again.",
      busy: "The agent is already writing here.",
      gone: "That artboard is no longer on the canvas.",
      no_artboards:
        "Add an artboard first: Fast Edit changes artboards that are already here.",
      not_ready:
        "This artboard has not finished loading. Wait a moment, then ask again.",
      too_long:
        "The reply was too long to take. Nothing changed. Ask for less at a time.",
      cut_short:
        "The reply was cut short. Nothing changed. Ask for less at a time.",
      read_only: "You can look at this canvas here but not change it.",
      no_box:
        "Fast Edit cannot run in this view, so nothing was sent to the agent.",
      slow_start:
        "Fast Edit was still starting, so nothing was sent to the agent. Try again in a moment.",
      start_stuck:
        "Fast Edit has not been able to start, so nothing was sent to the agent. Try reloading the page.",
      not_loaded: "Fast Edit could not load. Reload the page to try again.",
      box_cannot_hold:
        "Fast Edit cannot change one of these artboards yet. Nothing changed.",
      sandbox_failed:
        "Fast Edit stopped before the agent finished. Nothing changed. Try again.",
      not_saved: "The change could not be saved. Try again.",
      page_error: "Something went wrong in Fast Edit. Nothing changed.",
      busy_other:
        "The agent is already writing this artboard for someone else. Try again in a moment.",
      conflict_again:
        "Someone else keeps changing the same artboard. Changes already made are kept. Ask again in a moment.",
      save_clash:
        "Somebody else saved this artboard at the same moment, so one of the two changes may not have been kept.",
      save_unknown:
        "Your change is in this page, but the server has not confirmed it. If it goes away, ask again.",
      read_twice:
        "The agent could not finish this in one go. Nothing changed. Ask for less at a time.",
      call_cap:
        "This took too many tries. Changes already made are kept. Ask again.",
      nothing:
        "The agent could not make that change here. Nothing changed. Try different words.",
      partly_kept:
        "The agent could not make part of that change. Changes already made are kept.",
      ask_claude: "Fast Edit cannot do this one here. Nothing changed.",
      not_granted:
        "The agent is turned off here: under Permissions in this artifact\u2019s title menu, or by your organisation\u2019s admin.",
    };
    FAST_EDIT_CAPABILITY_DENIED_CODES = new Set([
      "not_granted",
      "sampling_disabled",
      "not_declared",
      "capability_disabled",
      "capability_removed",
    ]);
    FAST_EDIT_CAPABILITY_UNAVAILABLE_MESSAGE =
      "The agent is not available in this view.";
    FAST_EDIT_NOOP_CODES = new Set([
      "no_change",
      "no_match",
      "already_so",
      "not_run",
      "words_only",
      "empty_completion",
    ]);
    SANDBOX_NOT_READY_MESSAGE_PATTERN = /^the sandbox was not ready in \d+ ms$/;
    MAX_FAST_EDIT_REPAIR_ATTEMPTS = 3;
    FAST_EDIT_MARKUP_REPAIR_INSTRUCTIONS =
      "Write well-formed markup: every tag closed; element and attribute names as plain HTML has them; a style-\u2026 attribute only for a state CSS has (style-hover, style-focus); no doctype, html, head, body or noscript tag.";
    FAST_EDIT_INITIAL_DELAY_MS = 250;
    FAST_EDIT_COLLECT_READS = true;
    FAST_EDIT_ALLOW_EMPTY_SELECTION = false;
    FAST_EDIT_CONTROL_CALL_PATTERN = /^\s*(?:log|read|askClaude|forget)\(/;
    FAST_EDIT_HTML_INSERTION_PATTERN =
      /\.(?:append|prepend|before|after|html|replaceWith)\(/;
    FAST_EDIT_MUTATION_CALL_PATTERN =
      /\.(?:css|text|attr|removeAttr|remove|empty|detach|append|prepend|before|after|html|replaceWith|insertBefore|insertAfter|appendTo|prependTo|wrap|unwrap)\(/;
    FAST_EDIT_REPAIR_MESSAGES = {
      outside:
        "Write no <x-dc> tag, and do not write the word data-dc-script anywhere: the artboard\u2019s own program script is not changed from here.",
      not_template: FAST_EDIT_MARKUP_REPAIR_INSTRUCTIONS,
      reparse: FAST_EDIT_MARKUP_REPAIR_INSTRUCTIONS,
      too_big:
        "Make the change smaller: fewer elements, less nesting, no columns inside columns, several short statements.",
      shape:
        "Give left, top, width and height as whole px numbers and a short plain title in data-title.",
      page_style:
        "Give the page fill or colour as #rrggbb and the font as one of the families the canvas already uses.",
      box_cannot_hold: "Leave that artboard as it is and change the others.",
      empty_drawing:
        "The drawing came out empty: none of its shapes reached it. A drawing goes in whole, as one string.",
      reshaped:
        "The browser would reshape this markup, so it was not saved. Every element stands where it may stand: a table part needs its table round it, a cell in a row and a row in a table.",
      changed:
        "Someone changed that artboard while you were writing: look at it as it is now.",
      cap_news:
        "Add at most " +
        String(runtime.FAST_EDIT_OPERATION_LIMITS.news) +
        " artboards in one reply.",
      no_match:
        "Your selectors matched nothing: start every selector with the id of a file shown below and use the handle ids and tags you see in it.",
      already_so:
        "Nothing changed: where your selectors matched, every value you set is already there. Read the element as it stands below: the fault is in another declaration or another element.",
      line_no_match:
        "A line of your last reply changed nothing: its selector matched nothing. A new element has no class and no handle: reach it from one that is there: $('#{{PREFIX}}1 > div').last().",
      no_change:
        "Nobody reads your words and nothing changed: make the change with statements, or the nearest change the page allows; do not explain.",
      data_cut: "Leave a data: value as it is: it is shown cut.",
      thrown:
        "A line that throws does nothing: use jQuery calls on elements that exist, one statement per line.",
      beyond_target:
        "That reply wrote to an artboard this comment is not about. An id like {{PREFIX}}28 on a new element is not kept: a new element has no handle; reach it from one that is there: $('#{{PREFIX}}1 > div').last().",
    };
    describeFastEditRefusal = (input?: Dynamic, options?: Dynamic): Dynamic =>
      (input === "no_change"
        ? ""
        : "The page refused your last reply (" + input + "). ") +
      (FAST_EDIT_REPAIR_MESSAGES[options] ??
        FAST_EDIT_REPAIR_MESSAGES.no_change) +
      " Nothing of that reply was applied: write the whole reply again.";
    createFastEditSessionState = (input?: Dynamic): Dynamic => ({
      named: null,
      lastTouched: "",
      othersChanged: new Set(),
      busy: null,
      ...(0, runtime.createFastEditJournalState)(undefined, input),
    });
    FAST_EDIT_ROUNDTRIP_TIMEOUT_MS = 4e3;
    FAST_EDIT_SANDBOX_START_TIMEOUT_MS = 1500;
    FAST_EDIT_TIMEOUT_SENTINEL = Symbol("late");
    withFastEditTimeout = (input?: Dynamic, options?: Dynamic): Dynamic =>
      Promise.race([
        input,
        new Promise(
          (input2?: Dynamic): Dynamic =>
            setTimeout(input2, options, FAST_EDIT_TIMEOUT_SENTINEL),
        ),
      ]);
    waitForFastEditAbort = (input?: Dynamic): Dynamic =>
      new Promise((input2?: Dynamic): Dynamic => {
        input.aborted
          ? input2("stopped")
          : input.addEventListener("abort", (): Dynamic => input2("stopped"), {
              once: true,
            });
      });
    artboardRectangle = (input?: Dynamic): Dynamic => ({
      x: input.x,
      y: input.y,
      w: input.w,
      h: input.h,
    });
    distanceBetweenArtboards = (input?: Dynamic, options?: Dynamic): Dynamic =>
      Math.hypot(
        Math.max(
          0,
          options.x - (input.x + input.w),
          input.x - (options.x + options.w),
        ),
        Math.max(
          0,
          options.y - (input.y + input.h),
          input.y - (options.y + options.h),
        ),
      );
    normalizeFastEditThrownError = (input?: Dynamic): Dynamic =>
      input !== null &&
      typeof input == "object" &&
      typeof input.code == "string"
        ? input
        : {
            code: "page_error",
          };
    rehydrateFastEditHtml = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
    ): Dynamic => {
      let value: Dynamic = (0, runtime.unwrapFastEditSection)(options);
      return value === null
        ? null
        : (0, runtime.resolveOwnedElementIdCollisions)(input, value, context);
    };
    resolveTemplateHandleId = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
      value?: Dynamic,
    ): Dynamic => resolveTemplateHandleIds([input], options, context, value)[0];
  };
}
