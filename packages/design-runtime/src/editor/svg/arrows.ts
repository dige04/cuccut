/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorSvgArrows(runtime: RuntimeBindings): () => void {
  var SvgArrowsConstant: Dynamic;
  var SvgArrowsConstant_2: Dynamic;
  var SvgArrowsConstant_3: Dynamic;
  var SvgArrowsCss: Dynamic;
  var SvgArrowsConstant_4: Dynamic;
  var openArrowHeadPath: Dynamic;
  var SvgArrowsFilledOpenConfig: Dynamic;
  var SvgArrowsRefX: Dynamic;
  var OpenValue: Dynamic;
  var SvgArrowsHandler: Dynamic;
  var SvgArrowsDcArrowHeadFilledPattern: Dynamic;
  var SvgArrowsExec: Dynamic;
  function inspectSvgArrow(element?: Dynamic): Dynamic {
    let state: Dynamic = {
        defs: 1,
        title: 1,
        desc: 1,
        metadata: 1,
        style: 1,
        script: 1,
      },
      value: Dynamic = null;
    for (let index: Dynamic = 0; index < element.children.length; index++) {
      let value12: Dynamic = element.children[index];
      if (state[(value12.tagName || "").toLowerCase()] !== 1) {
        if (value) return null;
        value = value12;
      }
    }
    if (
      !value ||
      value.hasAttribute("transform") ||
      /transform\s*:/.test(value.getAttribute("style") || "")
    )
      return null;
    let value2: Dynamic = (value.tagName || "").toLowerCase(),
      callback: Dynamic = (input?: Dynamic): Dynamic => {
        if (input == null) return 0;
        let value12: Dynamic = input.trim();
        return /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?(?:px)?$/.test(
          value12,
        )
          ? parseFloat(value12)
          : null;
      },
      callback2: Dynamic = (
        input?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
        value12?: Dynamic,
        extra?: Dynamic,
      ): Dynamic => ({
        shaft: value,
        tag: value2,
        sx: input,
        sy: options,
        ex: context,
        ey: value12,
        legacy: extra,
      });
    if (value2 === "line") {
      let value12: Dynamic = callback(value.getAttribute("x1")),
        value13: Dynamic = callback(value.getAttribute("y1")),
        value14: Dynamic = callback(value.getAttribute("x2")),
        value15: Dynamic = callback(value.getAttribute("y2"));
      return value12 == null ||
        value13 == null ||
        value14 == null ||
        value15 == null
        ? null
        : callback2(value12, value13, value14, value15, false);
    }
    if (value2 === "polyline") {
      let value12: Dynamic = (value.getAttribute("points") || "")
        .trim()
        .split(/[\s,]+/)
        .filter((input?: Dynamic): Dynamic => input !== "")
        .map(callback);
      return value12.length !== 4 ||
        value12.some((input?: Dynamic): Dynamic => input == null)
        ? null
        : callback2(value12[0], value12[1], value12[2], value12[3], false);
    }
    if (value2 !== "path") return null;
    let value3: Dynamic = value.getAttribute("d") || "",
      value4: Dynamic =
        value3.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ||
        [];
    if (value4.join("").length !== value3.replace(/[\s,]/g, "").length)
      return null;
    let callback3: Dynamic = (input?: Dynamic): Dynamic =>
      input != null && /^[-+.\d]/.test(input);
    if (
      value4.length === 15 &&
      value4[0] === "M" &&
      value4[3] === "L" &&
      value4[6] === "M" &&
      value4[9] === "L" &&
      value4[12] === "L" &&
      [1, 2, 4, 5, 7, 8, 10, 11, 13, 14].every(
        (input?: Dynamic): Dynamic => callback3(value4[input]),
      )
    )
      return (element.getAttribute("preserveAspectRatio") ||
        element.getAttribute("sc-camel-preserve-aspect-ratio")) === "none" &&
        /(^|;)\s*fill:\s*none/.test(element.getAttribute("style") || "")
        ? callback2(+value4[1], +value4[2], +value4[4], +value4[5], true)
        : null;
    if (
      value4.length < 5 ||
      (value4[0] !== "M" && value4[0] !== "m") ||
      !callback3(value4[1]) ||
      !callback3(value4[2])
    )
      return null;
    let value5: Dynamic = +value4[1],
      value6: Dynamic = +value4[2],
      value7: Dynamic = value4[3],
      value8: Dynamic = value7 === value7.toLowerCase(),
      value9: Dynamic,
      value10: Dynamic,
      value11: Dynamic;
    if (callback3(value7)) {
      if (!callback3(value4[4])) return null;
      value9 = +value7;
      value10 = +value4[4];
      value11 = 5;
      value4[0] === "m" && ((value9 += value5), (value10 += value6));
    } else if (value7 === "L" || value7 === "l") {
      if (!callback3(value4[4]) || !callback3(value4[5])) return null;
      value9 = +value4[4];
      value10 = +value4[5];
      value11 = 6;
      value8 && ((value9 += value5), (value10 += value6));
    } else if (value7 === "H" || value7 === "h") {
      if (!callback3(value4[4])) return null;
      value9 = +value4[4] + (value8 ? value5 : 0);
      value10 = value6;
      value11 = 5;
    } else if (value7 === "V" || value7 === "v") {
      if (!callback3(value4[4])) return null;
      value9 = value5;
      value10 = +value4[4] + (value8 ? value6 : 0);
      value11 = 5;
    } else return null;
    return value4.length === value11
      ? callback2(value5, value6, value9, value10, false)
      : null;
  }
  function recognizeArrowHeadPath(input?: Dynamic): Dynamic {
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
        input2.match(/[A-Za-z]|[-+]?(?:\d+\.?\d*|\.\d+)/g) ?? [],
      value: Dynamic = callback(input),
      callback2: Dynamic = (items?: Dynamic): Dynamic =>
        items.length === value.length &&
        items.every(
          (input2?: Dynamic, options?: Dynamic): Dynamic =>
            /[A-Za-z]/.test(input2)
              ? input2 === value[options]
              : Math.abs(parseFloat(input2) - parseFloat(value[options])) <=
                0.001,
        );
    return callback2(callback(SvgArrowsCss))
      ? "filled"
      : callback2(callback(openArrowHeadPath))
        ? "open"
        : null;
  }
  function arrowHeadKindFromId(input?: Dynamic): Dynamic {
    return /^dc-arrow-head-(filled|open)(?:-|$)/.exec(input)?.[1] ?? null;
  }
  function createArrowHeadId(
    input: Dynamic = "filled",
    options: Dynamic = Math.random,
  ): Dynamic {
    return (
      SvgArrowsHandler(input) +
      "-" +
      Math.floor(options() * 36 ** 6)
        .toString(36)
        .padStart(6, "0")
    );
  }
  function normalizeSvgPaint(input?: Dynamic): Dynamic {
    let value: Dynamic = (input ?? "").trim();
    if (/^(none|transparent)$/i.test(value)) return "none";
    if (
      value === "" ||
      value.length > 64 ||
      !/^[#\w(),.%\s/-]+$/.test(value) ||
      /url\(/i.test(value) ||
      /^(inherit|initial|unset|context-(stroke|fill))$/i.test(value)
    )
      return null;
    let index: Dynamic = 0;
    for (let value2 of value as Dynamic)
      if (value2 === "(") index++;
      else if (value2 === ")" && --index < 0) return null;
    return index === 0 ? value : null;
  }
  function arrowHeadFillStyle(input?: Dynamic, options: Dynamic = ""): Dynamic {
    return [
      ...options
        .split(";")
        .map((input2?: Dynamic): Dynamic => input2.trim())
        .filter(
          (input2?: Dynamic): Dynamic =>
            input2 !== "" && !/^(fill|stroke)\s*:/i.test(input2),
        ),
      "stroke: none",
      `fill: ${normalizeSvgPaint(input) ?? "none"}`,
      "fill: context-stroke",
    ].join("; ");
  }
  function arrowHeadFillAttribute(input?: Dynamic): Dynamic {
    let value: Dynamic = normalizeSvgPaint(input);
    return value != null &&
      /^(#[0-9a-f]{3,8}|[a-z]+|(rgb|hsl)a?\([^()]*\)|var\(--[\w-]+\))$/i.test(
        value,
      )
      ? ` fill="${value}"`
      : "";
  }
  function arrowHeadMarkerHtml(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    return `<marker id="${input}" orient="${context === "start" ? "auto-start-reverse" : "auto"}" markerWidth="5" markerHeight="5" refX="${SvgArrowsFilledOpenConfig[options].refX}" refY="${SvgArrowsConstant_2}" overflow="visible"><path d="${SvgArrowsFilledOpenConfig[options].d}"${arrowHeadFillAttribute(value)} stroke="none" style="${arrowHeadFillStyle(value)}"/></marker>`;
  }
  function defaultArrowHeadDefs(input?: Dynamic, options?: Dynamic): Dynamic {
    return `<defs>${arrowHeadMarkerHtml(input, "filled", "end", options)}</defs>`;
  }
  function shortenLineEnd(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = Math.hypot(context - input, value - options);
    if (!(value2 > 0) || !(extra > 0))
      return {
        x: context,
        y: value,
      };
    let value3: Dynamic =
        Math.max(value2 - extra, Math.min(value2, 0.5)) / value2,
      callback: Dynamic = (input2?: Dynamic): Dynamic =>
        Math.round(input2 * 100) / 100;
    return {
      x: callback(input + (context - input) * value3),
      y: callback(options + (value - options) * value3),
    };
  }
  function shortenLineEnds(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
    detail?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = Math.hypot(context - input, value - options),
      value3: Dynamic = Math.max(extra, 0),
      value4: Dynamic = Math.max(detail, 0),
      callback: Dynamic = (input2?: Dynamic): Dynamic =>
        Math.round(input2 * 100) / 100;
    if (!(value2 > 0) || value3 + value4 === 0)
      return {
        sx: callback(input),
        sy: callback(options),
        ex: callback(context),
        ey: callback(value),
      };
    let value5: Dynamic = Math.min(value2, 0.5),
      value6: Dynamic = value2 - value3 - value4 >= value5,
      value7: Dynamic = value3 > 0 && value4 > 0 ? 1e4 : 100,
      callback2: Dynamic = (input2?: Dynamic): Dynamic =>
        Math.round(input2 * value7) / value7,
      value8: Dynamic = value6
        ? value3
        : ((value2 - value5) * value3) / (value3 + value4),
      value9: Dynamic = value6 ? value2 - value4 : value8 + value5,
      callback3: Dynamic = (input2?: Dynamic): Dynamic => [
        callback2(input + ((context - input) * input2) / value2),
        callback2(options + ((value - options) * input2) / value2),
      ],
      [value10, value11]: Dynamic =
        value3 > 0 ? callback3(value8) : [callback(input), callback(options)],
      [value12, value13]: Dynamic = callback3(value9);
    return {
      sx: value10,
      sy: value11,
      ex: value12,
      ey: value13,
    };
  }
  function arrowMarkerLength(
    input?: Dynamic,
    element?: Dynamic,
    context: Dynamic = "end",
  ): Dynamic {
    let value: Dynamic = /^\s*url\(\s*["']?#([^"')\s]+)["']?\s*\)\s*$/.exec(
      element.getAttribute("marker-" + context) || "",
    );
    if (!value) return 0;
    let value2: Dynamic = input.getElementsByTagName("marker"),
      value3: Dynamic = null;
    for (let index: Dynamic = 0; index < value2.length; index++)
      if (value2[index].getAttribute("id") === value[1]) {
        value3 = value2[index];
        break;
      }
    if (!value3) return 0;
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
        value3.getAttribute(input2) ??
        value3.getAttribute(
          "sc-camel-" +
            input2.replace(
              /[A-Z]/g,
              (input3?: Dynamic): Dynamic => "-" + input3.toLowerCase(),
            ),
        ),
      value4: Dynamic = value3.getAttribute("orient") || "";
    if (
      callback("viewBox") != null ||
      (callback("markerUnits") ?? "strokeWidth") !== "strokeWidth" ||
      !(context === "start"
        ? value4 === "auto-start-reverse"
        : /^auto/.test(value4))
    )
      return 0;
    let value5: Dynamic = value3.getElementsByTagName("path")[0],
      value6: Dynamic = (value5 && value5.getAttribute("d")) || "";
    if (
      !value5 ||
      value5.hasAttribute("transform") ||
      !/^[MLZz\d\s,.+-]+$/.test(value6)
    )
      return 0;
    let value7: Dynamic = value6.match(/[-+]?(?:\d+\.?\d*|\.\d+)/g) || [],
      value8: Dynamic = -1 / 0;
    for (let index: Dynamic = 0; index + 1 < value7.length; index += 2)
      value8 = Math.max(value8, parseFloat(value7[index]));
    value3.getAttribute("overflow") !== "visible" &&
      !/(^|;)\s*overflow\s*:\s*visible/.test(
        value3.getAttribute("style") || "",
      ) &&
      (value8 = Math.min(
        value8,
        parseFloat(callback("markerWidth") || "3") || 0,
      ));
    let value9: Dynamic = value8 - parseFloat(callback("refX") || "0");
    return value9 > 0 && value9 < 64 ? value9 : 0;
  }
  function regenerateArrowHeadIds(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = Math.random,
  ): Dynamic {
    let flag: Dynamic = false,
      value: Dynamic = null;
    for (let value2 of options as Dynamic) {
      let items: Dynamic = [
        ...(value2.tagName.toLowerCase() === "marker" ? [value2] : []),
        ...value2.querySelectorAll("marker"),
      ];
      for (let value3 of items as Dynamic) {
        let value4: Dynamic = value3.getAttribute("id") ?? "",
          value5: Dynamic = arrowHeadKindFromId(value4);
        if (
          !value5 ||
          ((value ??= [...input.querySelectorAll("marker")]),
          !value.some(
            (element?: Dynamic): Dynamic =>
              element !== value3 && element.getAttribute("id") === value4,
          ))
        )
          continue;
        let value6: Dynamic = createArrowHeadId(value5, context);
        value3.setAttribute("id", value6);
        let value7: Dynamic = value3.closest("svg") ?? value2;
        for (let value8 of value7.querySelectorAll(
          "[marker-end], [marker-start]",
        ) as Dynamic)
          for (let value9 of ["marker-end", "marker-start"] as Dynamic)
            /#([^"')\s]+)/.exec(value8.getAttribute(value9) ?? "")?.[1] ===
              value4 && value8.setAttribute(value9, `url(#${value6})`);
        flag = true;
      }
    }
    return flag;
  }
  function inheritedSvgPaint(input?: Dynamic, options?: Dynamic): Dynamic {
    for (
      let value: Dynamic = input;
      value;
      value = value.tagName.toLowerCase() === "svg" ? null : value.parentElement
    ) {
      let value2: Dynamic = (value.getAttribute("style") ?? "")
          .split(";")
          .map((input2?: Dynamic): Dynamic => input2.split(":"))
          .filter(
            (input2?: Dynamic): Dynamic =>
              input2[0].trim().toLowerCase() === options,
          ),
        value3: Dynamic = (
          value2.length > 0
            ? value2[value2.length - 1].slice(1).join(":")
            : (value.getAttribute(options) ?? "")
        ).trim();
      if (value3 !== "") return !/^(none|transparent)$/i.test(value3);
    }
    return options === "fill";
  }
  function inspectArrowHeadElement(element?: Dynamic): Dynamic {
    return inheritedSvgPaint(element, "fill")
      ? recognizeArrowHeadPath(element.getAttribute("d") ?? "")
      : inheritedSvgPaint(element, "stroke")
        ? "open"
        : null;
  }
  function inspectSvgArrowHeads(element?: Dynamic): Dynamic {
    let value: Dynamic =
      element.tagName.toLowerCase() === "svg" ? inspectSvgArrow(element) : null;
    if (!value) return null;
    let value2: Dynamic = element.getAttribute("style") ?? "",
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        [value.shaft, element].some(
          (element2?: Dynamic): Dynamic =>
            new RegExp("(^|;)\\s*marker(-" + input + ")?\\s*:", "i").test(
              element2.getAttribute("style") ?? "",
            ),
        ),
      value3: Dynamic =
        value.tag === "path" &&
        /(^|;)\s*fill\s*:\s*none/.test(value2) &&
        /(^|;)\s*overflow\s*:\s*visible/.test(value2) &&
        (value.legacy ||
          ((element.getAttribute("preserveAspectRatio") ??
            element.getAttribute("sc-camel-preserve-aspect-ratio")) ===
            "none" &&
            /^\s*M\s*[-\d.e+]+[\s,]+[-\d.e+]+\s+L\s*[-\d.e+]+[\s,]+[-\d.e+]+\s*$/i.test(
              value.shaft.getAttribute("d") ?? "",
            ))),
      callback2: Dynamic = (input?: Dynamic): Dynamic =>
        /^\s*(none)?\s*$/i.test(
          value.shaft.getAttribute("marker-" + input) ?? "",
        );
    if (
      !value3 &&
      ["start", "end"].every(
        (input?: Dynamic): Dynamic => callback2(input) && !callback(input),
      )
    )
      return null;
    let callback3: Dynamic = (input?: Dynamic): Dynamic => {
      if (callback(input)) return "unknown";
      if (callback2(input)) return "none";
      let attribute: Dynamic = value.shaft.getAttribute("marker-" + input),
        value4: Dynamic = SvgArrowsExec(attribute),
        value5: Dynamic =
          value4 == null
            ? undefined
            : [...element.getElementsByTagName("marker")].find(
                (element2?: Dynamic): Dynamic =>
                  element2.getAttribute("id") === value4,
              ),
        value6: Dynamic = value5 ? [...value5.children] : [],
        value7: Dynamic = value5?.getAttribute("orient") ?? "";
      return value6.length !== 1 ||
        value6[0].tagName.toLowerCase() !== "path" ||
        !(input === "start"
          ? value7 === "auto-start-reverse"
          : /^auto/.test(value7))
        ? "unknown"
        : (inspectArrowHeadElement(value6[0]) ?? "unknown");
    };
    return value.legacy
      ? {
          shaft: value.shaft,
          legacy: true,
          start: "none",
          end: "open",
        }
      : {
          shaft: value.shaft,
          legacy: false,
          start: callback3("start"),
          end: callback3("end"),
        };
  }
  bindRuntimeValue(runtime, "inspectSvgArrow", () => inspectSvgArrow);
  bindRuntimeValue(
    runtime,
    "SvgArrowsConstant",
    () => SvgArrowsConstant,
    (value) => {
      SvgArrowsConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SvgArrowsConstant_2",
    () => SvgArrowsConstant_2,
    (value) => {
      SvgArrowsConstant_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SvgArrowsConstant_3",
    () => SvgArrowsConstant_3,
    (value) => {
      SvgArrowsConstant_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SvgArrowsCss",
    () => SvgArrowsCss,
    (value) => {
      SvgArrowsCss = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SvgArrowsConstant_4",
    () => SvgArrowsConstant_4,
    (value) => {
      SvgArrowsConstant_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "openArrowHeadPath",
    () => openArrowHeadPath,
    (value) => {
      openArrowHeadPath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SvgArrowsFilledOpenConfig",
    () => SvgArrowsFilledOpenConfig,
    (value) => {
      SvgArrowsFilledOpenConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SvgArrowsRefX",
    () => SvgArrowsRefX,
    (value) => {
      SvgArrowsRefX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OpenValue",
    () => OpenValue,
    (value) => {
      OpenValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "recognizeArrowHeadPath",
    () => recognizeArrowHeadPath,
  );
  bindRuntimeValue(
    runtime,
    "SvgArrowsHandler",
    () => SvgArrowsHandler,
    (value) => {
      SvgArrowsHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SvgArrowsDcArrowHeadFilledPattern",
    () => SvgArrowsDcArrowHeadFilledPattern,
    (value) => {
      SvgArrowsDcArrowHeadFilledPattern = value;
    },
  );
  bindRuntimeValue(runtime, "arrowHeadKindFromId", () => arrowHeadKindFromId);
  bindRuntimeValue(runtime, "createArrowHeadId", () => createArrowHeadId);
  bindRuntimeValue(runtime, "normalizeSvgPaint", () => normalizeSvgPaint);
  bindRuntimeValue(runtime, "arrowHeadFillStyle", () => arrowHeadFillStyle);
  bindRuntimeValue(
    runtime,
    "arrowHeadFillAttribute",
    () => arrowHeadFillAttribute,
  );
  bindRuntimeValue(runtime, "arrowHeadMarkerHtml", () => arrowHeadMarkerHtml);
  bindRuntimeValue(runtime, "defaultArrowHeadDefs", () => defaultArrowHeadDefs);
  bindRuntimeValue(runtime, "shortenLineEnd", () => shortenLineEnd);
  bindRuntimeValue(runtime, "shortenLineEnds", () => shortenLineEnds);
  bindRuntimeValue(runtime, "arrowMarkerLength", () => arrowMarkerLength);
  bindRuntimeValue(
    runtime,
    "regenerateArrowHeadIds",
    () => regenerateArrowHeadIds,
  );
  bindRuntimeValue(runtime, "inheritedSvgPaint", () => inheritedSvgPaint);
  bindRuntimeValue(
    runtime,
    "inspectArrowHeadElement",
    () => inspectArrowHeadElement,
  );
  bindRuntimeValue(
    runtime,
    "SvgArrowsExec",
    () => SvgArrowsExec,
    (value) => {
      SvgArrowsExec = value;
    },
  );
  bindRuntimeValue(runtime, "inspectSvgArrowHeads", () => inspectSvgArrowHeads);
  return () => {
    SvgArrowsConstant = 4;
    SvgArrowsConstant_2 = 2;
    SvgArrowsConstant_3 = 2;
    SvgArrowsCss = `M0 0 L${SvgArrowsConstant} ${SvgArrowsConstant_2} L0 ${2 * SvgArrowsConstant_2} Z`;
    SvgArrowsConstant_4 = 1.7;
    openArrowHeadPath = ((): Dynamic => {
      let value: Dynamic = Math.hypot(SvgArrowsConstant, SvgArrowsConstant_4),
        value2: Dynamic = (SvgArrowsConstant_4 / value) * 0.5,
        value3: Dynamic = (SvgArrowsConstant / value) * 0.5,
        callback: Dynamic = (input?: Dynamic): Dynamic =>
          String(Math.round(input * 1e3) / 1e3),
        value4: Dynamic = `A${0.5} ${0.5} 0 0 1 `,
        value5: Dynamic = callback(SvgArrowsConstant + value2),
        value6: Dynamic = SvgArrowsConstant_2 - SvgArrowsConstant_4,
        value7: Dynamic = SvgArrowsConstant_2 + SvgArrowsConstant_4;
      return `M${callback(value2)} ${callback(value6 - value3)} L${value5} ${callback(SvgArrowsConstant_2 - value3)} ${value4}${value5} ${callback(SvgArrowsConstant_2 + value3)} L${callback(value2)} ${callback(value7 + value3)} ${value4}${callback(-value2)} ${callback(value7 - value3)} L${callback(SvgArrowsConstant - (0.5 * value) / SvgArrowsConstant_4)} ${SvgArrowsConstant_2} L${callback(-value2)} ${callback(value6 + value3)} ${value4}${callback(value2)} ${callback(value6 - value3)} Z`;
    })();
    SvgArrowsFilledOpenConfig = {
      filled: {
        d: SvgArrowsCss,
        refX: SvgArrowsConstant - SvgArrowsConstant_3,
      },
      open: {
        d: openArrowHeadPath,
        refX: SvgArrowsConstant,
      },
    };
    SvgArrowsRefX = (input?: Dynamic): Dynamic =>
      input === "none"
        ? 0
        : SvgArrowsConstant - SvgArrowsFilledOpenConfig[input].refX;
    OpenValue = "open";
    SvgArrowsHandler = (input?: Dynamic): Dynamic => "dc-arrow-head-" + input;
    SvgArrowsDcArrowHeadFilledPattern =
      /dc-arrow-head-(filled|open)(-[0-9a-z]+)?/g;
    SvgArrowsExec = (input?: Dynamic): Dynamic =>
      /^\s*url\(\s*["']?#([^"')\s]+)["']?\s*\)\s*$/.exec(input ?? "")?.[1] ??
      null;
  };
}
