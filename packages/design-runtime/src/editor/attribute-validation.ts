/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installEditorAttributeValidation(
  runtime: RuntimeBindings,
): () => void {
  var allowedLinkProtocols: Dynamic;
  var mediaSourceTags: Dynamic;
  var initializeEditorAttributeValidation: Dynamic;
  function normalizeExternalUrl(input?: Dynamic, options?: Dynamic): Dynamic {
    try {
      if (options.includes(new URL(input).protocol)) return input;
      if (!/^[^:/?#]+:\d+(?:[/?#]|$)/.test(input)) return null;
    } catch {}
    let value: Dynamic = input.startsWith("//")
      ? "https:" + input
      : "https://" + input;
    try {
      if (new URL(value).protocol === "https:") return value;
    } catch {}
    return null;
  }
  function normalizeLinkInput(input?: Dynamic): Dynamic {
    let value: Dynamic = input.replace(/[\t\n\r]/g, "").trim();
    return value
      ? value.startsWith("#")
        ? value
        : normalizeExternalUrl(value, allowedLinkProtocols)
      : null;
  }
  function sanitizeEditableLink(input?: Dynamic): Dynamic {
    let value: Dynamic = input.replace(/[\t\n\r]/g, "").trim();
    if (!value) return null;
    if (value.startsWith("#")) return value;
    try {
      let protocol: Dynamic = new URL(value, "https://dc-editor-base.invalid/")
        .protocol;
      return allowedLinkProtocols.includes(protocol) ? value : null;
    } catch {
      return null;
    }
  }
  function sanitizeMediaSource(input?: Dynamic): Dynamic {
    let value: Dynamic = input.replace(/[\t\n\r]/g, "").trim();
    if (!value || value.startsWith("#")) return null;
    try {
      let value2: Dynamic = new URL(value, "https://dc-editor-base.invalid/");
      return value2.protocol === "http:" || value2.protocol === "https:"
        ? value
        : null;
    } catch {
      return null;
    }
  }
  function classifyProtectedAttribute(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = input.toLowerCase(),
      value2: Dynamic = options.map(
        (input2?: Dynamic): Dynamic => (input2 ?? "").toLowerCase(),
      ),
      value3: Dynamic = /^@data-keyframes-attr-(.+)$/.exec(value);
    return value3
      ? classifyProtectedAttribute("@" + value3[1], options) == null
        ? null
        : "keyframe-track"
      : /^@on/.test(value)
        ? "handler"
        : value === "@srcdoc" && value2.includes("iframe")
          ? "srcdoc"
          : (value === "@src" ||
                value === "@href" ||
                value.endsWith(":href")) &&
              value2.includes("script")
            ? "script-src"
            : value === "@href" || value.endsWith(":href")
              ? "href"
              : (value === "@action" && value2.includes("form")) ||
                  (value === "@formaction" &&
                    value2.some(
                      (input2?: Dynamic): Dynamic =>
                        input2 === "button" || input2 === "input",
                    ))
                ? "action"
                : (value === "@src" &&
                      value2.some(
                        (input2?: Dynamic): Dynamic =>
                          mediaSourceTags.has(input2),
                      )) ||
                    (value === "@data" &&
                      value2.some(
                        (input2?: Dynamic): Dynamic =>
                          input2 === "object" || input2 === "embed",
                      ))
                  ? "embed-src"
                  : null;
  }
  function isProtectedAttribute(input?: Dynamic, options?: Dynamic): Dynamic {
    return classifyProtectedAttribute(input, options) != null;
  }
  function validateAttributeEdit(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = classifyProtectedAttribute(input, context);
    if (value === "handler")
      return {
        ok: false,
        message:
          "Event-handler attributes are code and can\u2019t be edited here \u2014 ask in chat to change the behavior instead.",
      };
    if (value === "srcdoc")
      return {
        ok: false,
        message:
          "srcdoc is a full HTML document and can\u2019t be edited here \u2014 ask in chat to change the embedded content instead.",
      };
    if (value === "script-src")
      return {
        ok: false,
        message:
          "A script\u2019s source is code and can\u2019t be edited here \u2014 ask in chat to change the script instead.",
      };
    if (value === "keyframe-track") {
      let value2: Dynamic = /^@data-keyframes-attr-(.+)$/.exec(
        input.toLowerCase(),
      );
      return validateKeyframeAttributeEdit(
        classifyProtectedAttribute("@" + (value2?.[1] ?? ""), context),
        options,
      );
    }
    if (value === "href") {
      let value2: Dynamic = sanitizeEditableLink(options);
      return value2 == null
        ? {
            ok: false,
            message:
              "That link can\u2019t be used \u2014 enter a web address (https://\u2026), a project page path, mailto: or tel: link.",
          }
        : {
            ok: true,
            value: value2,
          };
    }
    if (value === "action") {
      let value2: Dynamic = sanitizeEditableLink(options);
      return value2 == null
        ? {
            ok: false,
            message:
              "That action can\u2019t be used \u2014 enter a web address (https://\u2026), a path, mailto: or tel:.",
          }
        : {
            ok: true,
            value: value2,
          };
    }
    if (value === "embed-src") {
      let value2: Dynamic = sanitizeMediaSource(options);
      return value2 == null
        ? {
            ok: false,
            message:
              "That source can\u2019t be used \u2014 enter a web address (https://\u2026) or a project file path.",
          }
        : {
            ok: true,
            value: value2,
          };
    }
    return {
      ok: true,
      value: options,
    };
  }
  function validateKeyframeAttributeEdit(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    if (
      input === "handler" ||
      input === "srcdoc" ||
      input === "script-src" ||
      input === "keyframe-track"
    )
      return {
        ok: false,
        message:
          "This keyframe track targets an attribute that can\u2019t be edited here \u2014 ask in chat instead.",
      };
    let value: Dynamic;
    try {
      value = JSON.parse(options);
    } catch {
      return {
        ok: false,
        message: "Keyframes must be a JSON array of {t, v} objects.",
      };
    }
    for (let value2 of (Array.isArray(value) ? value : []) as Dynamic) {
      let value3: Dynamic = value2?.v;
      if (typeof value3 != "string" || value3.includes("{{")) continue;
      if (
        (input === "embed-src"
          ? sanitizeMediaSource(value3)
          : sanitizeEditableLink(value3)) == null
      )
        return {
          ok: false,
          message:
            "A keyframe value isn\u2019t a usable URL \u2014 use a web address (https://\u2026) or a project file path.",
        };
    }
    return {
      ok: true,
      value: options,
    };
  }
  bindRuntimeValue(runtime, "normalizeExternalUrl", () => normalizeExternalUrl);
  bindRuntimeValue(runtime, "normalizeLinkInput", () => normalizeLinkInput);
  bindRuntimeValue(runtime, "sanitizeEditableLink", () => sanitizeEditableLink);
  bindRuntimeValue(runtime, "sanitizeMediaSource", () => sanitizeMediaSource);
  bindRuntimeValue(
    runtime,
    "classifyProtectedAttribute",
    () => classifyProtectedAttribute,
  );
  bindRuntimeValue(runtime, "isProtectedAttribute", () => isProtectedAttribute);
  bindRuntimeValue(
    runtime,
    "validateAttributeEdit",
    () => validateAttributeEdit,
  );
  bindRuntimeValue(
    runtime,
    "validateKeyframeAttributeEdit",
    () => validateKeyframeAttributeEdit,
  );
  bindRuntimeValue(
    runtime,
    "allowedLinkProtocols",
    () => allowedLinkProtocols,
    (value) => {
      allowedLinkProtocols = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "mediaSourceTags",
    () => mediaSourceTags,
    (value) => {
      mediaSourceTags = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeEditorAttributeValidation",
    () => initializeEditorAttributeValidation,
    (value) => {
      initializeEditorAttributeValidation = value;
    },
  );
  return () => {
    initializeEditorAttributeValidation = (0, runtime.initializeOnce)(
      (): Dynamic => {
        "use strict";

        allowedLinkProtocols = ["http:", "https:", "mailto:", "tel:"];
        mediaSourceTags = new Set([
          "iframe",
          "frame",
          "embed",
          "video",
          "source",
        ]);
      },
    );
  };
}
