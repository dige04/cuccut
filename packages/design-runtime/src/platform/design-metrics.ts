/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformDesignMetrics(
  runtime: RuntimeBindings,
): () => void {
  var DESIGN_OPEN_METRIC_EVENTS: Dynamic;
  var DESIGN_SYSTEM_MID_USAGE_RATIO: Dynamic;
  var DESIGN_SYSTEM_HIGH_USAGE_RATIO: Dynamic;
  var NON_CONTENT_HTML_TAGS: Dynamic;
  var OPAQUE_HTML_TAGS: Dynamic;
  var MAX_TELEMETRY_TAGS: Dynamic;
  var GLOBAL_COMPONENT_ATTRIBUTE_PATTERN: Dynamic;
  var IMPORT_FROM_ATTRIBUTE_PATTERN: Dynamic;
  var COMPONENT_BUNDLE_PATH_PATTERN: Dynamic;
  var DESIGN_SYSTEM_METADATA_PATTERN: Dynamic;
  var isAsciiLetterCode: Dynamic;
  var isHtmlTagNameCode: Dynamic;
  var lowercaseAsciiCode: Dynamic;
  function findHtmlClosingTag(
    html?: Dynamic,
    tagName?: Dynamic,
    startOffset?: Dynamic,
  ): Dynamic {
    for (
      let value: Dynamic = startOffset;
      (value = html.indexOf("</", value)) !== -1;
      value += 2
    ) {
      let index: Dynamic = 0;
      for (
        ;
        index < tagName.length &&
        lowercaseAsciiCode(html.charCodeAt(value + 2 + index)) ===
          tagName.charCodeAt(index);

      )
        index++;
      if (
        index === tagName.length &&
        !isHtmlTagNameCode(html.charCodeAt(value + 2 + index))
      )
        return value;
    }
    return html.length;
  }
  function scanHtmlStartTags(html?: Dynamic, onTag?: Dynamic): Dynamic {
    let length: Dynamic = html.length,
      offset: Dynamic = 0;
    for (; (offset = html.indexOf("<", offset)) !== -1; ) {
      if (html.startsWith("!--", offset + 1)) {
        let value4: Dynamic = html.indexOf("-->", offset + 4);
        offset = value4 === -1 ? length : value4 + 3;
        continue;
      }
      let value: Dynamic = offset + 1;
      if (value >= length || !isAsciiLetterCode(html.charCodeAt(value))) {
        offset = value;
        continue;
      }
      for (; value < length && isHtmlTagNameCode(html.charCodeAt(value)); )
        value++;
      let value2: Dynamic = html.slice(offset + 1, value).toLowerCase(),
        value3: Dynamic = value;
      for (let index: Dynamic = 0; value3 < length; value3++) {
        let value4: Dynamic = html.charCodeAt(value3);
        if (index !== 0) value4 === index && (index = 0);
        else if (value4 === 34 || value4 === 39) index = value4;
        else if (value4 === 62) break;
      }
      if (value3 >= length) return;
      NON_CONTENT_HTML_TAGS.has(value2) ||
        onTag(value2, html.slice(value, value3));
      offset = value3 + 1;
      OPAQUE_HTML_TAGS.has(value2) &&
        html.charCodeAt(value3 - 1) !== 47 &&
        (offset = findHtmlClosingTag(html, value2, offset));
    }
  }
  function countDesignSystemImportTags(html?: Dynamic): Dynamic {
    let importCount: Dynamic = 0,
      contentTagCount: Dynamic = 0;
    scanHtmlStartTags(html, (input?: Dynamic, options?: Dynamic): Dynamic => {
      contentTagCount++;
      if (input !== "x-import") return;
      let value: Dynamic = options.replace(/'[^']*'/g, "''"),
        value2: Dynamic = GLOBAL_COMPONENT_ATTRIBUTE_PATTERN.exec(value);
      value2 &&
        value2[1].includes(".") &&
        !value2[1].includes("{{") &&
        !IMPORT_FROM_ATTRIBUTE_PATTERN.test(value.replace(/"[^"]*"/g, '""')) &&
        importCount++;
    });
    return {
      mounts: importCount,
      elements: contentTagCount,
    };
  }
  function classifyDesignSystemUsage(
    imports?: Dynamic,
    contentTags?: Dynamic,
  ): Dynamic {
    let ratio: Dynamic = contentTags > 0 ? imports / contentTags : 0;
    return ratio >= DESIGN_SYSTEM_HIGH_USAGE_RATIO
      ? "high"
      : ratio >= DESIGN_SYSTEM_MID_USAGE_RATIO
        ? "mid"
        : "low";
  }
  function computeDesignOpenMetricEvents({
    files: files,
    published: published,
    designSystems: designSystems,
  }: Dynamic): Dynamic {
    let events: Dynamic = [DESIGN_OPEN_METRIC_EVENTS.opened];
    designSystems > 0 && events.push(DESIGN_OPEN_METRIC_EVENTS.tokens);
    [
      ...Object.keys(files).filter(
        (input?: Dynamic): Dynamic => !(0, runtime.isArtboardFile)(input),
      ),
      ...published,
    ].some(
      (input?: Dynamic): Dynamic =>
        COMPONENT_BUNDLE_PATH_PATTERN.test(input) ||
        DESIGN_SYSTEM_METADATA_PATTERN.test(input),
    ) && events.push(DESIGN_OPEN_METRIC_EVENTS.bundle);
    let index: Dynamic = 0,
      index2: Dynamic = 0;
    for (let [value, value2] of Object.entries(files) as Dynamic) {
      if (
        !(0, runtime.isArtboardFile)(value) ||
        (0, runtime.isLoadingArtboardHtml)(value2)
      )
        continue;
      let value3: Dynamic = countDesignSystemImportTags(value2);
      index += value3.mounts;
      index2 += value3.elements;
    }
    index > 0 &&
      events.push(
        DESIGN_OPEN_METRIC_EVENTS.use[classifyDesignSystemUsage(index, index2)],
      );
    return events;
  }
  function whenDocumentLive(doc?: Dynamic, onLive?: Dynamic): Dynamic {
    if (doc.loadState() === "live") return onLive();
    let fired: Dynamic = false,
      unsubscribe: Dynamic = doc.subscribeLoad((): Dynamic => {
        fired ||
          doc.loadState() !== "live" ||
          ((fired = true), unsubscribe(), onLive());
      });
  }
  function whenPublishedBoardsReady(
    doc?: Dynamic,
    onReady?: Dynamic,
    timeoutMs: Dynamic = 1e4,
    runtime2: Dynamic = globalThis,
  ): Dynamic {
    let callSafely: Dynamic = (): Dynamic => {
      try {
        onReady();
      } catch {}
    };
    whenDocumentLive(doc, (): Dynamic => {
      let flag: Dynamic = false,
        callback: Dynamic = (): Dynamic => {},
        value: Dynamic,
        value2: Dynamic,
        callback2: Dynamic = (): Dynamic => {
          flag ||
            ((flag = true),
            callback(),
            runtime2.clearTimeout(value),
            runtime2.clearTimeout(value2),
            typeof runtime2.requestIdleCallback == "function"
              ? runtime2.requestIdleCallback(callSafely, {
                  timeout: timeoutMs,
                })
              : runtime2.setTimeout(callSafely, 0));
        },
        callback3: Dynamic = (): Dynamic => {
          try {
            let flag2: Dynamic = false;
            for (let [value3, value4] of Object.entries(
              doc.content().files,
            ) as Dynamic)
              if ((0, runtime.isArtboardFile)(value3)) {
                if ((0, runtime.isLoadingArtboardHtml)(value4))
                  return "loading";
                flag2 = true;
              }
            return flag2 ? "in" : "none";
          } catch {
            return "in";
          }
        },
        callback4: Dynamic = (input?: Dynamic): Dynamic => {
          if (flag) return;
          runtime2.clearTimeout(value);
          let value3: Dynamic = callback3();
          value3 !== "none" &&
            ((value2 ??= runtime2.setTimeout(callback2, timeoutMs)),
            (value =
              value3 === "in"
                ? runtime2.setTimeout(callback2, input)
                : undefined));
        };
      callback = doc.subscribe((): Dynamic => callback4(MAX_TELEMETRY_TAGS));
      callback4(0);
    });
  }
  function reportDesignOpened(
    doc?: Dynamic,
    context?: Dynamic,
    published?: Dynamic,
    designSystems?: Dynamic,
    runtime2: Dynamic = globalThis,
  ): Dynamic {
    try {
      if (!context.canWrite || context.capture || context.embedded) return;
      whenPublishedBoardsReady(
        doc,
        (): Dynamic =>
          (0, runtime.sendStaggeredAnalytics)(
            computeDesignOpenMetricEvents({
              files: doc.content().files,
              ...published(),
            }),
            designSystems,
            runtime2,
          ),
        undefined,
        runtime2,
      );
    } catch {}
  }
  bindRuntimeValue(
    runtime,
    "DESIGN_OPEN_METRIC_EVENTS",
    () => DESIGN_OPEN_METRIC_EVENTS,
    (value) => {
      DESIGN_OPEN_METRIC_EVENTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_MID_USAGE_RATIO",
    () => DESIGN_SYSTEM_MID_USAGE_RATIO,
    (value) => {
      DESIGN_SYSTEM_MID_USAGE_RATIO = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_HIGH_USAGE_RATIO",
    () => DESIGN_SYSTEM_HIGH_USAGE_RATIO,
    (value) => {
      DESIGN_SYSTEM_HIGH_USAGE_RATIO = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NON_CONTENT_HTML_TAGS",
    () => NON_CONTENT_HTML_TAGS,
    (value) => {
      NON_CONTENT_HTML_TAGS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OPAQUE_HTML_TAGS",
    () => OPAQUE_HTML_TAGS,
    (value) => {
      OPAQUE_HTML_TAGS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_TELEMETRY_TAGS",
    () => MAX_TELEMETRY_TAGS,
    (value) => {
      MAX_TELEMETRY_TAGS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GLOBAL_COMPONENT_ATTRIBUTE_PATTERN",
    () => GLOBAL_COMPONENT_ATTRIBUTE_PATTERN,
    (value) => {
      GLOBAL_COMPONENT_ATTRIBUTE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "IMPORT_FROM_ATTRIBUTE_PATTERN",
    () => IMPORT_FROM_ATTRIBUTE_PATTERN,
    (value) => {
      IMPORT_FROM_ATTRIBUTE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMPONENT_BUNDLE_PATH_PATTERN",
    () => COMPONENT_BUNDLE_PATH_PATTERN,
    (value) => {
      COMPONENT_BUNDLE_PATH_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_METADATA_PATTERN",
    () => DESIGN_SYSTEM_METADATA_PATTERN,
    (value) => {
      DESIGN_SYSTEM_METADATA_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isAsciiLetterCode",
    () => isAsciiLetterCode,
    (value) => {
      isAsciiLetterCode = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isHtmlTagNameCode",
    () => isHtmlTagNameCode,
    (value) => {
      isHtmlTagNameCode = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "lowercaseAsciiCode",
    () => lowercaseAsciiCode,
    (value) => {
      lowercaseAsciiCode = value;
    },
  );
  bindRuntimeValue(runtime, "findHtmlClosingTag", () => findHtmlClosingTag);
  bindRuntimeValue(runtime, "scanHtmlStartTags", () => scanHtmlStartTags);
  bindRuntimeValue(
    runtime,
    "countDesignSystemImportTags",
    () => countDesignSystemImportTags,
  );
  bindRuntimeValue(
    runtime,
    "classifyDesignSystemUsage",
    () => classifyDesignSystemUsage,
  );
  bindRuntimeValue(
    runtime,
    "computeDesignOpenMetricEvents",
    () => computeDesignOpenMetricEvents,
  );
  bindRuntimeValue(runtime, "whenDocumentLive", () => whenDocumentLive);
  bindRuntimeValue(
    runtime,
    "whenPublishedBoardsReady",
    () => whenPublishedBoardsReady,
  );
  bindRuntimeValue(runtime, "reportDesignOpened", () => reportDesignOpened);
  return () => {
    DESIGN_OPEN_METRIC_EVENTS = {
      opened: "frame_design_opened",
      tokens: "frame_design_ds_tokens",
      bundle: "frame_design_ds_bundle",
      use: {
        low: "frame_design_ds_use_low",
        mid: "frame_design_ds_use_mid",
        high: "frame_design_ds_use_high",
      },
    };
    DESIGN_SYSTEM_MID_USAGE_RATIO = 0.1;
    DESIGN_SYSTEM_HIGH_USAGE_RATIO = 0.3;
    NON_CONTENT_HTML_TAGS = new Set([
      "html",
      "head",
      "body",
      "x-dc",
      "link",
      "meta",
      "title",
      "base",
      "br",
      "wbr",
      "script",
      "style",
      "helmet",
    ]);
    OPAQUE_HTML_TAGS = new Set(["script", "style", "helmet", "svg"]);
    MAX_TELEMETRY_TAGS = 2e3;
    GLOBAL_COMPONENT_ATTRIBUTE_PATTERN =
      /\scomponent-from-global-scope\s*=\s*"([^"]*)"/i;
    IMPORT_FROM_ATTRIBUTE_PATTERN = /\sfrom\s*=/i;
    COMPONENT_BUNDLE_PATH_PATTERN =
      /(?:^|[-/])components\.m?js$|(?:^|\/)ds\/[^/]+\/.+\.m?js$/i;
    DESIGN_SYSTEM_METADATA_PATTERN = /(?:^|\/)design-system\.json$/i;
    isAsciiLetterCode = (input?: Dynamic): Dynamic =>
      (input | 32) >= 97 && (input | 32) <= 122;
    isHtmlTagNameCode = (input?: Dynamic): Dynamic =>
      isAsciiLetterCode(input) || (input >= 48 && input <= 57) || input === 45;
    lowercaseAsciiCode = (input?: Dynamic): Dynamic =>
      input >= 65 && input <= 90 ? input + 32 : input;
  };
}
