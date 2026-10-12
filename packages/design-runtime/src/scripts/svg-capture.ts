/** Restored injected script; compiled as an isolated IIFE before insertion into a preview. */
import type { Dynamic } from "../runtime-types";
import { elementToSVG as _e, inlineResources as kt } from "dom-to-svg";
var text: Dynamic = "http://www.w3.org/2000/svg",
  text2: Dynamic =
    ":root:root:root body *{user-select:text!important;-webkit-user-select:text!important}[data-dc-editor-overlay],[data-omelette-chrome],[data-noncommentable]{display:none!important}",
  text3: Dynamic = ".sc-host:not(.sc-host .sc-host)",
  value_X: Dynamic = null;
function helper_Ar(
  this: Dynamic,
  fillStyle?: Dynamic,
  ..._extraArguments: Dynamic[]
): Dynamic {
  if (
    ((value_X ??= (document as Dynamic)
      .createElement("canvas")
      .getContext("2d", {
        willReadFrequently: true,
      })),
    !value_X || !CSS.supports("color", fillStyle))
  )
    return null;
  value_X.clearRect(0, 0, 1, 1);
  value_X.fillStyle = "#0000";
  value_X.fillStyle = fillStyle;
  value_X.fillRect(0, 0, 1, 1);
  let [data, data2, data3, data4]: Dynamic = value_X.getImageData(
    0,
    0,
    1,
    1,
  ).data;
  return (
    "rgba(" +
    String(data) +
    ", " +
    String(data2) +
    ", " +
    String(data3) +
    ", " +
    String(Math.round(((data4 ?? 0) / 255) * 1e3) / 1e3) +
    ")"
  );
}
var value_kr: Dynamic =
  /(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\((?:[^()]|\([^()]*\))*\)|#[0-9a-f]{3,8}\b/i;
function helper_Cr(
  this: Dynamic,
  fillStyle?: Dynamic,
  ..._extraArguments2: Dynamic[]
): Dynamic {
  if (!fillStyle || fillStyle === "none") return [];
  let items: Dynamic = [];
  for (let value_r of fillStyle.split(/,(?![^(]*\))/) as Dynamic) {
    let value_i: Dynamic = value_r.trim();
    if (/\binset\b/.test(value_i)) continue;
    let value_o: Dynamic = value_i.match(value_kr),
      color: Dynamic = value_o ? helper_Ar(value_o[0]) : null;
    if (!value_o || !color) continue;
    let filtered: Dynamic = value_i
      .replace(value_o[0], " ")
      .trim()
      .split(/\s+/)
      .map(parseFloat)
      .filter(
        (input?: Dynamic, ..._extraArguments3: Dynamic[]): Dynamic =>
          !(Number as Dynamic).isNaN(input),
      );
    filtered.length < 2 ||
      items.push({
        x: filtered[0] ?? 0,
        y: filtered[1] ?? 0,
        blur: filtered[2] ?? 0,
        spread: filtered[3] ?? 0,
        color: color,
      });
  }
  return items;
}
function helper_j(
  this: Dynamic,
  fillStyle?: Dynamic,
  options?: Dynamic,
  context?: Dynamic,
  ..._extraArguments4: Dynamic[]
): Dynamic {
  let value_i: Dynamic = fillStyle.createElementNS(text, options);
  for (let [value_o, color] of (Object as Dynamic).entries(context) as Dynamic)
    value_i.setAttribute(value_o, String(color));
  return value_i;
}
function helper_Er(
  this: Dynamic,
  fillStyle?: Dynamic,
  options?: Dynamic,
  context?: Dynamic,
  value?: Dynamic,
  ..._extraArguments5: Dynamic[]
): Dynamic {
  let element: Dynamic = options.querySelector("defs");
  element ||
    ((element = fillStyle.createElementNS(text, "defs")),
    options.insertBefore(element, options.firstChild));
  let color: Dynamic = options.querySelector(
      'g[data-stacking-layer="rootBackgroundAndBorders"]',
    ),
    index: Dynamic = 0;
  for (let value_u of value as Dynamic) {
    let value_p: Dynamic = getComputedStyle(value_u);
    if (
      value_p.boxShadow === "none" ||
      value_p.display === "none" ||
      value_p.visibility === "hidden"
    )
      continue;
    let bounds: Dynamic = value_u.getBoundingClientRect();
    if (!bounds.width || !bounds.height) continue;
    let value_f: Dynamic = parseFloat(value_p.borderTopLeftRadius) || 0,
      value_a: Dynamic = [...options.querySelectorAll("rect")].find(
        (element2?: Dynamic, ..._extraArguments6: Dynamic[]): Dynamic =>
          !element2.hasAttribute("mask") &&
          Math.abs(Number(element2.getAttribute("x")) - bounds.x) < 0.6 &&
          Math.abs(Number(element2.getAttribute("y")) - bounds.y) < 0.6 &&
          Math.abs(Number(element2.getAttribute("width")) - bounds.width) <
            0.6 &&
          Math.abs(Number(element2.getAttribute("height")) - bounds.height) <
            0.6,
      );
    for (let value_c of helper_Cr(value_p.boxShadow) as Dynamic) {
      let captureArea: Dynamic = "dc-shadow-" + String(++index),
        value_x: Dynamic = helper_j(fillStyle, "mask", {
          id: captureArea + "-cut",
          maskUnits: "userSpaceOnUse",
          x: context.x,
          y: context.y,
          width: context.width,
          height: context.height,
        });
      value_x.append(
        helper_j(fillStyle, "rect", {
          x: context.x,
          y: context.y,
          width: context.width,
          height: context.height,
          fill: "#fff",
        }),
        helper_j(fillStyle, "rect", {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          rx: value_f,
          ry: value_f,
          fill: "#000",
        }),
      );
      element.append(value_x);
      let value_g: Dynamic = helper_j(fillStyle, "rect", {
        x: bounds.x - value_c.spread + value_c.x,
        y: bounds.y - value_c.spread + value_c.y,
        width: Math.max(0, bounds.width + 2 * value_c.spread),
        height: Math.max(0, bounds.height + 2 * value_c.spread),
        rx: Math.max(0, value_f + value_c.spread),
        ry: Math.max(0, value_f + value_c.spread),
        fill: value_c.color,
        mask: "url(#" + captureArea + "-cut)",
      });
      if (value_c.blur > 0) {
        let value_m: Dynamic = helper_j(fillStyle, "filter", {
          id: captureArea,
          x: "-50%",
          y: "-50%",
          width: "200%",
          height: "200%",
        });
        value_m.append(
          helper_j(fillStyle, "feGaussianBlur", {
            stdDeviation: value_c.blur / 2,
          }),
        );
        element.append(value_m);
        value_g.setAttribute("filter", "url(#" + captureArea + ")");
      }
      value_a
        ? value_a.before(value_g)
        : color
          ? color.after(value_g)
          : options.insertBefore(value_g, element.nextSibling);
    }
  }
}
function helper_Lr(
  this: Dynamic,
  fillStyle?: Dynamic,
  options?: Dynamic,
  context?: Dynamic,
  ..._extraArguments7: Dynamic[]
): Dynamic {
  for (let value_i of context.querySelectorAll("canvas") as Dynamic) {
    let bounds: Dynamic = value_i.getBoundingClientRect();
    if (!bounds.width || !bounds.height) continue;
    let color: Dynamic;
    try {
      color = value_i.toDataURL("image/png");
    } catch {
      continue;
    }
    options.append(
      helper_j(fillStyle, "image", {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        href: color,
      }),
    );
  }
}
async function __dcSvgCapture(
  this: Dynamic,
  fillStyle?: Dynamic,
  options: Dynamic = null,
  ..._extraArguments8: Dynamic[]
): Promise<Dynamic> {
  let value_r: Dynamic = fillStyle === "page",
    value_i: Dynamic = value_r
      ? null
      : (document as Dynamic).querySelector("[data-dc-editor-selected]"),
    value_o: Dynamic = value_r
      ? (document as Dynamic).documentElement
      : value_i &&
        (value_i.ownerSVGElement != null
          ? (value_i.closest("svg") ?? value_i)
          : value_i);
  if (!value_o)
    return {
      e: "no-selection",
    };
  let color: Dynamic =
      (document as Dynamic).querySelector(text3) ?? (document as Dynamic).body,
    value_n: Dynamic = new CSSStyleSheet();
  value_n.replaceSync(
    text2 +
      (color.style.transform
        ? (color === (document as Dynamic).body ? "body" : text3) +
          "{transform:none!important}"
        : ""),
  );
  let body: Dynamic = (document as Dynamic).body,
    value_p: Dynamic = body.hasAttribute("data-dc-editor-overlay-hidden"),
    value_l: Dynamic = body.hasAttribute("data-dc-capturing"),
    value_f: Dynamic = getSelection(),
    value_a: Dynamic =
      value_f && value_f.rangeCount > 0 ? value_f.getRangeAt(0) : null,
    value_c: Dynamic,
    captureArea: Dynamic,
    value_x: Dynamic = false,
    value_g: Dynamic;
  try {
    if (
      (((document as Dynamic).adoptedStyleSheets = [
        ...(document as Dynamic).adoptedStyleSheets,
        value_n,
      ]),
      body.setAttribute("data-dc-editor-overlay-hidden", ""),
      value_r && body.setAttribute("data-dc-capturing", ""),
      (captureArea = value_r
        ? new DOMRect(
            -scrollX,
            -scrollY,
            options?.w ??
              Math.max(
                innerWidth,
                (document as Dynamic).documentElement.scrollWidth,
              ),
            options?.h ??
              Math.max(
                innerHeight,
                (document as Dynamic).documentElement.scrollHeight,
              ),
          )
        : value_o.getBoundingClientRect()),
      !captureArea.width || !captureArea.height)
    )
      return {
        e: "zero-size",
      };
    if (
      (value_r &&
        options?.h != null &&
        (document as Dynamic).documentElement.scrollHeight > options.h + 1 &&
        (value_x = true),
      (value_c = _e(value_o, {
        captureArea: captureArea,
        keepLinks: false,
      })),
      (value_g = value_c.documentElement),
      value_r)
    ) {
      let element: Dynamic = value_g.querySelector(
        'g[data-stacking-layer="rootBackgroundAndBorders"] > rect',
      );
      if (element)
        for (let [value_k, value_L] of [
          ["x", captureArea.x],
          ["y", captureArea.y],
          ["width", captureArea.width],
          ["height", captureArea.height],
        ] as Dynamic)
          element.setAttribute(value_k, String(value_L));
    }
    helper_Er(
      value_c,
      value_g,
      captureArea,
      value_r
        ? body.querySelectorAll("*")
        : [value_o, ...value_o.querySelectorAll("*")],
    );
    helper_Lr(value_c, value_g, value_o);
  } finally {
    (document as Dynamic).adoptedStyleSheets = (
      document as Dynamic
    ).adoptedStyleSheets.filter(
      (input?: Dynamic, ..._extraArguments9: Dynamic[]): Dynamic =>
        input !== value_n,
    );
    value_p || body.removeAttribute("data-dc-editor-overlay-hidden");
    value_r && !value_l && body.removeAttribute("data-dc-capturing");
    value_f &&
      (value_f.removeAllRanges(), value_a && value_f.addRange(value_a));
  }
  for (let value_w of [...value_g.querySelectorAll("style")] as Dynamic)
    value_w.remove();
  await kt(value_g);
  let value_m: Dynamic = new XMLSerializer().serializeToString(value_g);
  return value_x
    ? {
        s: value_m,
        clipped: true,
      }
    : {
        s: value_m,
      };
}
(window as Dynamic).__dcSvgCapture = __dcSvgCapture;
