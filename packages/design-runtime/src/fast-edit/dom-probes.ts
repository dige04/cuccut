import type {
  LayoutProbe,
  ComputedStyleProbe,
  ProbeRectangle,
  ElementHitProbe,
  NearestRectangle,
  RankedRectangle,
} from "../contracts/fast-edit";
import type { PreviewHandle } from "../contracts/geometry";
import type { DataRecord } from "../contracts/storage";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installFastEditDomProbes(runtime: RuntimeBindings): () => void {
  var boundedDomProbeString: (value: unknown) => string;
  var MAX_STYLE_PROBE_PROPERTIES: number;
  var MAX_STYLE_PROBE_INDEX: number;
  var normalizeDomProbeText: (value: unknown) => string;
  var COMPUTED_STYLE_RANGES: Record<
    "size" | "weight" | "box",
    readonly [number, number]
  >;
  function parseLayoutProbe(value: unknown): LayoutProbe | null {
    if (value === null || typeof value != "object") return null;
    let probe: DataRecord = value as DataRecord,
      element = boundedDomProbeString(probe.el),
      parent = boundedDomProbeString(probe.parent),
      alignment = ["stretch", "normal"].includes(
        boundedDomProbeString(probe.align),
      ),
      callback: () => "column_stretch" | "column" = () =>
        alignment ? "column_stretch" : "column";
    if (parent === "flex" || parent === "inline-flex")
      return ["column", "column-reverse"].includes(
        boundedDomProbeString(probe.dir),
      )
        ? callback()
        : ["row", "row-reverse"].includes(boundedDomProbeString(probe.dir))
          ? "row"
          : null;
    if (parent === "grid" || parent === "inline-grid") {
      let value2 =
        boundedDomProbeString(probe.cols) === "none"
          ? 1
          : boundedDomProbeString(probe.cols)
              .trim()
              .split(/\s+/)
              .filter((input) => /^[\d.]+px$/.test(input)).length;
      return value2 === 1 ? callback() : value2 > 1 ? "row" : null;
    }
    return [
      "block",
      "flow-root",
      "list-item",
      "inline-block",
      "table-cell",
    ].includes(parent)
      ? ["inline", "inline-block", "inline-flex", "inline-grid"].includes(
          element,
        )
        ? "inline"
        : ["block", "flow-root", "list-item", "flex", "grid", "table"].includes(
              element,
            )
          ? "block"
          : null
      : null;
  }
  async function probeRenderedElementLayout(
    webview: PreviewHandle,
    selector: string,
  ): Promise<LayoutProbe | null> {
    try {
      return parseLayoutProbe(
        await webview.executeJavaScript(
          `(function fastEditLayoutProbe(selector) {
  try {
    const element = document.querySelector(selector);
    if (!element || !element.parentElement) return null;
    const style = getComputedStyle(element);
    const parentStyle = getComputedStyle(element.parentElement);
    return {
      el: style.display,
      parent: parentStyle.display,
      dir: parentStyle.flexDirection,
      align: parentStyle.alignItems,
      cols: parentStyle.gridTemplateColumns
    };
  } catch {
    return null;
  }
})(${JSON.stringify(selector)})`,
          1500,
        ),
      );
    } catch {
      return null;
    }
  }
  function parseComputedColor(value: unknown): string | null {
    let rgbaMatch =
      /^rgba?\((\d{1,3}), (\d{1,3}), (\d{1,3})(?:, (0|1|0?\.\d{1,6}))?\)$/.exec(
        boundedDomProbeString(value),
      );
    if (rgbaMatch === null) return null;
    let [items, items2, items3] = [
        Number(rgbaMatch[1]),
        Number(rgbaMatch[2]),
        Number(rgbaMatch[3]),
      ],
      value2 =
        rgbaMatch[4] === undefined
          ? 1
          : Math.round(Number(rgbaMatch[4]) * 100) / 100;
    return items > 255 || items2 > 255 || items3 > 255
      ? null
      : value2 === 0
        ? "none"
        : value2 === 1
          ? "#" +
            [items, items2, items3]
              .map((input) => input.toString(16).padStart(2, "0"))
              .join("")
          : "rgba(" + [items, items2, items3, value2].join(", ") + ")";
  }
  function parseComputedStyleProbe(value: unknown): ComputedStyleProbe {
    if (value === null || typeof value != "object") return {};
    let probe: DataRecord = value as DataRecord,
      inRange: (n: number, range: readonly [number, number]) => boolean = (
        input,
        [options, options2],
      ) => Number.isFinite(input) && input >= options && input <= options2,
      value2 = /^(\d{1,4}(?:\.\d{1,6})?)px$/.exec(
        boundedDomProbeString(probe.size),
      ),
      value3 = value2 === null ? NaN : Math.round(Number(value2[1]) * 10) / 10,
      value4 = /^\d{3}$/.test(boundedDomProbeString(probe.weight))
        ? Number(probe.weight)
        : NaN,
      callback: (n: unknown) => number = (input) =>
        typeof input == "number" ? Math.round(input) : NaN,
      value5 = callback(probe.w),
      value6 = callback(probe.h),
      value7 = parseComputedColor(probe.color),
      value8 = parseComputedColor(probe.ground),
      value9 = parseComputedColor(probe.behind);
    return {
      ...(inRange(value3, COMPUTED_STYLE_RANGES.size)
        ? {
            size: value3,
          }
        : {}),
      ...(inRange(value4, COMPUTED_STYLE_RANGES.weight)
        ? {
            weight: value4,
          }
        : {}),
      ...(probe.style === "italic" || probe.style === "oblique"
        ? {
            style: probe.style,
          }
        : {}),
      ...(value7 !== null && value7 !== "none"
        ? {
            color: value7,
          }
        : {}),
      ...(value8 !== null
        ? {
            ground: value8,
          }
        : {}),
      ...(value8 === "none" && value9 !== null && value9 !== "none"
        ? {
            behind: value9,
          }
        : {}),
      ...(probe.align === "center" ||
      probe.align === "right" ||
      probe.align === "justify"
        ? {
            align: probe.align,
          }
        : {}),
      ...(inRange(value5, COMPUTED_STYLE_RANGES.box) &&
      inRange(value6, COMPUTED_STYLE_RANGES.box)
        ? {
            w: value5,
            h: value6,
          }
        : {}),
    };
  }
  function parseDomProbeRectangles(value: unknown): ProbeRectangle[] {
    let boundedCoordinate: (n: unknown) => number | null = (input) =>
      typeof input == "number" && Number.isFinite(input)
        ? Math.round(Math.min(1e5, Math.max(-1e5, input)))
        : null;
    return Array.isArray(value)
      ? value
          .slice(0, MAX_STYLE_PROBE_PROPERTIES)
          .flatMap((items): ProbeRectangle[] => {
            let value2 =
              Array.isArray(items) && items.length === 4
                ? items.map(boundedCoordinate)
                : [];
            return value2.length === 4 &&
              value2.every((input) => input !== null) &&
              value2[2]! > value2[0]! &&
              value2[3]! > value2[1]!
              ? [[value2[0]!, value2[1]!, value2[2]!, value2[3]!]]
              : [];
          })
      : [];
  }
  function findNearestProbeRectangle(
    rectangles: readonly ProbeRectangle[],
    x: number,
    y: number,
  ): NearestRectangle | null {
    let nearest: RankedRectangle | null = null;
    for (let [value, value2, value3, value4] of rectangles) {
      let value5 = Math.max(value - x, x - value3, 0),
        value6 = Math.max(value2 - y, y - value4, 0),
        value7 = Math.hypot(value5, value6);
      if (value5 <= 8 && value6 <= 8) return null;
      let value8 = value6 === 0;
      (nearest === null ||
        (value8 && !nearest.level) ||
        (value8 === nearest.level && value7 < nearest.d)) &&
        (nearest =
          value5 >= value6
            ? {
                px: Math.round(value5),
                side: x > value3 ? "right" : "left",
                d: value7,
                level: value8,
              }
            : {
                px: Math.round(value6),
                side: y > value4 ? "below" : "above",
                d: value7,
                level: value8,
              });
    }
    return nearest === null
      ? null
      : {
          px: nearest.px,
          side: nearest.side,
        };
  }
  function parseElementHitProbe(value: unknown): ElementHitProbe | null {
    if (value === null || typeof value != "object") return null;
    let probe: DataRecord = value as DataRecord,
      tag = boundedDomProbeString(probe.tag);
    if (
      !/^[a-z][a-z0-9-]{0,23}$/.test(tag) ||
      typeof probe.kids != "number" ||
      typeof probe.interp != "boolean" ||
      typeof probe.imported != "boolean" ||
      typeof probe.atPath != "boolean"
    )
      return null;
    let value2 = normalizeDomProbeText(probe.own);
    return {
      tid:
        typeof probe.tpl == "number" &&
        Number.isInteger(probe.tpl) &&
        probe.tpl >= 0 &&
        probe.tpl <= MAX_STYLE_PROBE_INDEX
          ? probe.tpl
          : null,
      tag: tag,
      own: value2,
      all: normalizeDomProbeText(probe.all),
      hollow: value2 === "" && !probe.interp && probe.kids > 0,
      imported: probe.imported,
      atPath: probe.atPath,
      words: parseDomProbeRectangles(probe.words),
      look: parseComputedStyleProbe(probe.look),
    };
  }
  async function probeRenderedElementHit(
    webview: PreviewHandle,
    selector: string,
    index: number | null = null,
  ): Promise<ElementHitProbe | null> {
    let safeIndex =
      typeof index == "number" &&
      Number.isInteger(index) &&
      index >= 0 &&
      index <= MAX_STYLE_PROBE_INDEX
        ? index
        : null;
    try {
      return parseElementHitProbe(
        await webview.executeJavaScript(
          `(function fastEditHitProbe(selector, templateIndex) {
  try {
    let element = document.querySelector(selector);
    let multipleMatches = false;
    let atPath = true;
    const root = document.querySelector(".sc-host:not(.sc-host .sc-host)");
    const hostOf = (candidate) => {
      return (candidate.hasAttribute("data-sc-name") && candidate.parentElement ? candidate.parentElement : candidate).closest("[data-sc-name]");
    };
    if (templateIndex !== null) {
      const matches = Array.from(
        document.querySelectorAll('[data-dc-tpl="' + templateIndex + '"]')
      ).filter((candidate) => hostOf(candidate) === root);
      if (!(element && matches.indexOf(element) >= 0)) {
        const descendants = matches.filter(
          (candidate) => element && element.contains(candidate)
        );
        if (descendants.length) {
          element = descendants[0];
          multipleMatches = descendants.length > 1;
          atPath = false;
        } else if (matches.length === 1) {
          element = matches[0];
          atPath = false;
        }
      }
    }
    if (!element) return null;
    const host = hostOf(element);
    let ownText = "";
    let childElements = 0;
    let hasInterpolation = false;
    for (let child = element.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 3) ownText += child.nodeValue;
      else if (child.nodeType === 1) {
        if (child.classList.contains("sc-interp"))
          hasInterpolation = true;
        else childElements++;
      }
    }
    const templateId = element.getAttribute("data-dc-tpl");
    const words = [];
    const textWalker = document.createTreeWalker(element, 4);
    let textNode;
    while ((textNode = textWalker.nextNode()) && words.length < 40) {
      if (!textNode.nodeValue.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(textNode);
      const rectangles = range.getClientRects();
      for (let index = 0; index < rectangles.length && words.length < 40; index++) {
        const rectangle = rectangles[index];
        words.push([
          rectangle.left,
          rectangle.top,
          rectangle.right,
          rectangle.bottom
        ]);
      }
    }
    const style = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    const transparentColor = /^(?:transparent|rgba\\(\\d+, \\d+, \\d+, 0\\))$/;
    let behind = null;
    for (let ancestor = element.parentElement; ancestor && behind === null; ancestor = ancestor.parentElement) {
      const color = getComputedStyle(ancestor).backgroundColor;
      if (!transparentColor.test(color)) behind = color;
    }
    return {
      look: multipleMatches ? null : {
        behind,
        size: style.fontSize,
        weight: style.fontWeight,
        style: style.fontStyle,
        color: style.color,
        ground: style.backgroundColor,
        align: style.textAlign,
        w: bounds.width,
        h: bounds.height
      },
      words,
      tpl: templateId !== null && /^\\d{1,6}$/.test(templateId) ? Number(templateId) : null,
      tag: element.localName,
      own: ownText.slice(0, 2e3),
      all: multipleMatches ? "" : (element.textContent || "").slice(0, 2e3),
      kids: childElements,
      interp: hasInterpolation,
      imported: Boolean(root) && host !== root,
      atPath
    };
  } catch {
    return null;
  }
})(${JSON.stringify(selector)},${String(safeIndex)})`,
          1500,
        ),
      );
    } catch {
      return null;
    }
  }
  bindRuntimeValue(
    runtime,
    "boundedDomProbeString",
    () => boundedDomProbeString,
    (value) => {
      boundedDomProbeString = value;
    },
  );
  bindRuntimeValue(runtime, "parseLayoutProbe", () => parseLayoutProbe);
  bindRuntimeValue(
    runtime,
    "probeRenderedElementLayout",
    () => probeRenderedElementLayout,
  );
  bindRuntimeValue(
    runtime,
    "MAX_STYLE_PROBE_PROPERTIES",
    () => MAX_STYLE_PROBE_PROPERTIES,
    (value) => {
      MAX_STYLE_PROBE_PROPERTIES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_STYLE_PROBE_INDEX",
    () => MAX_STYLE_PROBE_INDEX,
    (value) => {
      MAX_STYLE_PROBE_INDEX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeDomProbeText",
    () => normalizeDomProbeText,
    (value) => {
      normalizeDomProbeText = value;
    },
  );
  bindRuntimeValue(runtime, "parseComputedColor", () => parseComputedColor);
  bindRuntimeValue(
    runtime,
    "COMPUTED_STYLE_RANGES",
    () => COMPUTED_STYLE_RANGES,
    (value) => {
      COMPUTED_STYLE_RANGES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parseComputedStyleProbe",
    () => parseComputedStyleProbe,
  );
  bindRuntimeValue(
    runtime,
    "parseDomProbeRectangles",
    () => parseDomProbeRectangles,
  );
  bindRuntimeValue(
    runtime,
    "findNearestProbeRectangle",
    () => findNearestProbeRectangle,
  );
  bindRuntimeValue(runtime, "parseElementHitProbe", () => parseElementHitProbe);
  bindRuntimeValue(
    runtime,
    "probeRenderedElementHit",
    () => probeRenderedElementHit,
  );
  return () => {
    boundedDomProbeString = (value: unknown): string =>
      typeof value == "string" && value.length <= 2e3 ? value : "";
    MAX_STYLE_PROBE_PROPERTIES = 40;
    MAX_STYLE_PROBE_INDEX = 99999;
    normalizeDomProbeText = (value: unknown): string =>
      boundedDomProbeString(value).replace(/\s+/g, " ").trim();
    COMPUTED_STYLE_RANGES = {
      size: [1, 2e3],
      weight: [100, 900],
      box: [1, 1e5],
    };
  };
}
