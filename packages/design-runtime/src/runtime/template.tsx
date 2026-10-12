/**
 * Reconstructed template subsystem of the Design Component runtime.
 * Source declarations: dc-runtime.js offsets 149782..166769.
 * Semantic names are inferred from the shipped behavior; see runtime-map.json.
 */
/* @jsxRuntime classic */
/* @jsx renderJSX */
import { evaluateExpression } from "./expressions";
import { createElement as renderJSX, getReact } from "./react";
import type {
  RuntimeValue,
  Keyframe,
  PropsMetadata,
  ParsedDesignComponent,
  ComponentRegistry,
  StreamingTracker,
  RenderValues,
  TemplateContext,
  CompiledTemplate,
  DesignRuntime,
  RuntimeOptions,
} from "./types";
export var CAMEL_ATTRIBUTE_PREFIX = "sc-camel-",
  INLINE_TAGS: RuntimeValue = new Set(
    "a abbr b bdi bdo br cite code del dfn em i ins kbd mark q s samp small span strike strong sub sup u var wbr".split(
      " ",
    ),
  ),
  RAW_TAG_REPLACEMENTS: RuntimeValue = {
    select: "sc-raw-select",
    table: "sc-raw-table",
    tbody: "sc-raw-tbody",
    thead: "sc-raw-thead",
    tfoot: "sc-raw-tfoot",
    tr: "sc-raw-tr",
    td: "sc-raw-td",
    th: "sc-raw-th",
    caption: "sc-raw-caption",
  },
  ORIGINAL_RAW_TAGS: RuntimeValue = Object.fromEntries(
    Object.entries(RAW_TAG_REPLACEMENTS).map(
      ([tagName, replacement]: RuntimeValue): RuntimeValue => [
        replacement,
        tagName,
      ],
    ),
  ),
  BOOLEAN_ATTRIBUTES: RuntimeValue = new Set(
    "allowFullScreen async autoFocus autoPlay checked controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden itemScope loop multiple muted noModule noValidate open playsInline readOnly required reversed scoped seamless selected".split(
      " ",
    ),
  ),
  REACT_EVENT_NAMES: RuntimeValue = {
    onclick: "onClick",
    onchange: "onChange",
    oninput: "onInput",
    onsubmit: "onSubmit",
    onkeydown: "onKeyDown",
    onkeyup: "onKeyUp",
    onkeypress: "onKeyPress",
    onmousedown: "onMouseDown",
    onmouseup: "onMouseUp",
    onmouseenter: "onMouseEnter",
    onmouseleave: "onMouseLeave",
    onfocus: "onFocus",
    onblur: "onBlur",
    ondoubleclick: "onDoubleClick",
    oncontextmenu: "onContextMenu",
    onmousemove: "onMouseMove",
    onmouseover: "onMouseOver",
    onmouseout: "onMouseOut",
    onpointerdown: "onPointerDown",
    onpointerup: "onPointerUp",
    onpointermove: "onPointerMove",
    onpointerenter: "onPointerEnter",
    onpointerleave: "onPointerLeave",
    onpointercancel: "onPointerCancel",
    onpointerover: "onPointerOver",
    onpointerout: "onPointerOut",
    ongotpointercapture: "onGotPointerCapture",
    onlostpointercapture: "onLostPointerCapture",
    ontouchstart: "onTouchStart",
    ontouchend: "onTouchEnd",
    ontouchmove: "onTouchMove",
    ontouchcancel: "onTouchCancel",
    ondragstart: "onDragStart",
    ondragend: "onDragEnd",
    ondragenter: "onDragEnter",
    ondragleave: "onDragLeave",
    ondragover: "onDragOver",
    onanimationstart: "onAnimationStart",
    onanimationend: "onAnimationEnd",
    onanimationiteration: "onAnimationIteration",
    ontransitionend: "onTransitionEnd",
  },
  TAG_ATTRIBUTE_PATTERN = `(?:[^>"']|"[^"]*"|'[^']*')*`,
  SELF_CLOSING_IMPORT_PATTERN: RuntimeValue = new RegExp(
    "<(x-import|dc-import)(" + TAG_ATTRIBUTE_PATTERN + ")/>",
    "gi",
  ),
  QUOTED_ATTRIBUTE_PATTERN = `(?:=\\s*"[^"]*"|=\\s*'[^']*'|=(?!\\s*["'])|[^>=])*`,
  HTML_TOKEN_PATTERN: RuntimeValue = new RegExp(
    "(<!---?>|<!--[\\s\\S]*?--!?>)|(<(script|style|textarea|title)(?=[\\s/>])" +
      QUOTED_ATTRIBUTE_PATTERN +
      ">)([\\s\\S]*?<\\/\\3(?=[\\s/>])[^>]*>)|<[a-zA-Z][^\\s/>]*(?=[\\s/>])" +
      QUOTED_ATTRIBUTE_PATTERN +
      ">",
    "gi",
  ),
  CAMEL_ATTRIBUTE_PATTERN =
    /=\s*"[^"]*"|=\s*'[^']*'|(\s)([a-z]+[A-Z][A-Za-z0-9]*)(?=\s*=)/g;
export function preserveCamelAttributes(html: string): string {
  const rewriteTag: RuntimeValue = (tag?: RuntimeValue): RuntimeValue =>
    tag.replace(
      CAMEL_ATTRIBUTE_PATTERN,
      (
        match?: RuntimeValue,
        whitespace?: RuntimeValue,
        attributeName?: RuntimeValue,
      ): RuntimeValue =>
        attributeName === undefined
          ? match
          : whitespace +
            CAMEL_ATTRIBUTE_PREFIX +
            attributeName.replace(
              /[A-Z]/g,
              (letter?: RuntimeValue): RuntimeValue =>
                "-" + letter.toLowerCase(),
            ),
    );
  return html.replace(
    HTML_TOKEN_PATTERN,
    (
      token?: RuntimeValue,
      comment?: RuntimeValue,
      openingTag?: RuntimeValue,
      rawTagName?: RuntimeValue,
      bodyAndClosingTag?: RuntimeValue,
    ): RuntimeValue =>
      comment !== undefined
        ? token
        : openingTag
          ? rewriteTag(openingTag) + bodyAndClosingTag
          : rewriteTag(token),
  );
}
export function preprocessTemplate(html: string): string {
  html = html.replace(
    SELF_CLOSING_IMPORT_PATTERN,
    (
      match?: RuntimeValue,
      tagName?: RuntimeValue,
      attributes?: RuntimeValue,
    ): RuntimeValue => "<" + tagName + attributes + "></" + tagName + ">",
  );
  html = html.replace(/<helmet(\s|>)/gi, "<sc-helmet$1");
  html = html.replace(/<\/helmet\s*>/gi, "</sc-helmet>");
  html = preserveCamelAttributes(html);
  for (const [originalTag, replacementTag] of Object.entries(
    RAW_TAG_REPLACEMENTS,
  ))
    html = html.replace(
      new RegExp("(</?)" + originalTag + "(?=[\\s>])", "gi"),
      "$1" + replacementTag,
    );
  return html;
}
export function toCamelCase(propertyName: string): string {
  return propertyName.replace(
    /-([a-z])/g,
    (match?: RuntimeValue, letter?: RuntimeValue): RuntimeValue =>
      letter.toUpperCase(),
  );
}
export function toCssPropertyName(propertyName: string): string {
  if (propertyName.startsWith("--") || !/[a-z][A-Z]/.test(propertyName))
    return propertyName;
  if (propertyName === "cssFloat") return "float";
  const kebabName: RuntimeValue = propertyName.replace(
    /[A-Z]/g,
    (letter?: RuntimeValue): RuntimeValue => "-" + letter.toLowerCase(),
  );
  return /^(webkit|moz|ms|o)-/.test(kebabName) ? "-" + kebabName : kebabName;
}
export function parseInlineStyle(css: string): Record<string, string> {
  const style: RuntimeValue = {};
  for (const declaration of css.split(";")) {
    const colonOffset: RuntimeValue = declaration.indexOf(":");
    if (colonOffset < 0) continue;
    const propertyName: RuntimeValue = declaration.slice(0, colonOffset).trim();
    style[
      propertyName.startsWith("--") ? propertyName : toCamelCase(propertyName)
    ] = declaration.slice(colonOffset + 1).trim();
  }
  return style;
}
export function compileInterpolation(text?: RuntimeValue): RuntimeValue {
  const wholeExpressionMatch: RuntimeValue = text.match(
    /^\s*\{\{([\s\S]+?)\}\}\s*$/,
  );
  if (wholeExpressionMatch) {
    const expression: RuntimeValue = wholeExpressionMatch[1];
    return (scope?: RuntimeValue): RuntimeValue =>
      evaluateExpression(scope, expression);
  }
  if (text.includes("{{")) {
    const segments: RuntimeValue = text.split(/\{\{([\s\S]+?)\}\}/g);
    return (scope?: RuntimeValue): RuntimeValue =>
      segments
        .map(
          (segment?: RuntimeValue, index?: RuntimeValue): RuntimeValue =>
            index & 1 ? (evaluateExpression(scope, segment) ?? "") : segment,
        )
        .join("");
  }
  return (): RuntimeValue => text;
}
export function isSafeCssProperty(propertyName: string): boolean {
  return propertyName === "constructor" || propertyName === "prototype"
    ? false
    : /^(?:--[a-zA-Z0-9_-]+|[a-z][a-z0-9-]*)$/.test(propertyName);
}
export var KEYFRAME_ATTRIBUTE_PATTERN = /^data-keyframes-(css|attr)-(.+)$/;
export function parseKeyframeAttribute(attributeName: string): {
  kind: string;
  prop: string;
} | null {
  const match: RuntimeValue = KEYFRAME_ATTRIBUTE_PATTERN.exec(attributeName);
  return match
    ? {
        kind: match[1],
        prop: match[2],
      }
    : null;
}
export var UNSAFE_KEYFRAME_TAGS: RuntimeValue = new Set([
  "script",
  "style",
  "link",
  "meta",
  "base",
  "iframe",
  "frame",
  "embed",
  "object",
  "portal",
  "template",
  "head",
  "html",
  "body",
  "animate",
  "set",
  "animatemotion",
  "applet",
  "frameset",
  "noembed",
  "xmp",
]);
export function isSafeKeyframeTag(tagName: string): boolean {
  return !UNSAFE_KEYFRAME_TAGS.has(tagName.toLowerCase());
}
export function isSafeKeyframeAttribute(attributeName: string): boolean {
  return !(
    !/^[a-z][a-z0-9-]*$/.test(attributeName) ||
    attributeName.startsWith("on") ||
    attributeName === "srcdoc" ||
    attributeName === "style" ||
    attributeName === "class" ||
    attributeName === "id" ||
    attributeName === "is" ||
    attributeName === "contenteditable" ||
    attributeName === "key" ||
    attributeName === "ref" ||
    attributeName === "children" ||
    attributeName === "dangerouslysetinnerhtml" ||
    attributeName.startsWith("data-dc-") ||
    attributeName.startsWith("data-om-") ||
    attributeName.startsWith("data-dm-") ||
    attributeName.startsWith("data-react-") ||
    attributeName.startsWith("data-keyframes-") ||
    attributeName.startsWith("sc-camel-")
  );
}
export var NAVIGATION_URL_ATTRIBUTES: RuntimeValue = new Set([
    "href",
    "action",
    "formaction",
    "cite",
    "ping",
    "longdesc",
  ]),
  RESOURCE_URL_ATTRIBUTES: RuntimeValue = new Set([
    "src",
    "srcset",
    "poster",
    "data",
    "background",
  ]);
export function sanitizeKeyframeAttribute(
  attributeName: string,
  value: unknown,
): string | null {
  const text: RuntimeValue = String(value),
    isNavigation: RuntimeValue = NAVIGATION_URL_ATTRIBUTES.has(attributeName);
  if (!isNavigation && !RESOURCE_URL_ATTRIBUTES.has(attributeName)) return text;
  const urls: RuntimeValue =
    attributeName === "srcset"
      ? text
          .split(",")
          .map(
            (candidate?: RuntimeValue): RuntimeValue =>
              candidate.trim().split(/\s+/)[0] ?? "",
          )
      : attributeName === "ping"
        ? text.trim().split(/\s+/)
        : [text];
  for (const url of urls)
    if (!isSafeKeyframeUrl(url, isNavigation)) return null;
  return text;
}
export function isSafeKeyframeUrl(
  url: string,
  allowNavigation: boolean,
): boolean {
  const normalized: RuntimeValue = url.replace(/[\t\n\r]/g, "").trim();
  if (!normalized) return true;
  try {
    const protocol: RuntimeValue = new URL(
      normalized,
      "https://dc-keyframes-base.invalid/",
    ).protocol;
    return protocol === "http:" ||
      protocol === "https:" ||
      (allowNavigation && (protocol === "mailto:" || protocol === "tel:"))
      ? true
      : !allowNavigation &&
          protocol === "data:" &&
          /^data:image\/(?!svg)/i.test(normalized.replace(/\s+/g, ""));
  } catch {
    return false;
  }
}
export function parseKeyframeTrack(input: unknown): Keyframe[] | null {
  let value: RuntimeValue = input;
  if (typeof value == "string") {
    const json: RuntimeValue = value.trim();
    if (!json) return null;
    const cachedTrack: RuntimeValue = keyframeTrackCache.get(json);
    if (cachedTrack !== undefined) return cachedTrack;
    let parsed: RuntimeValue;
    try {
      parsed = JSON.parse(json);
    } catch {
      keyframeTrackCache.set(json, null);
      return null;
    }
    const track: RuntimeValue = normalizeKeyframeTrack(parsed);
    keyframeTrackCache.size > 512 && keyframeTrackCache.clear();
    keyframeTrackCache.set(json, track);
    return track;
  }
  return normalizeKeyframeTrack(value);
}
export var keyframeTrackCache: RuntimeValue = new Map();
export function normalizeKeyframeTrack(input: unknown): Keyframe[] | null {
  if (!Array.isArray(input)) return null;
  const frames: RuntimeValue = [];
  for (const frame of input) {
    if (!frame || typeof frame != "object" || Array.isArray(frame)) continue;
    const { t: time, v: value } = frame;
    typeof time != "number" ||
      !Number.isFinite(time) ||
      (typeof value == "number"
        ? !Number.isFinite(value)
        : typeof value != "string") ||
      frames.push(frame);
  }
  return frames.length
    ? frames.sort(
        (left?: RuntimeValue, right?: RuntimeValue): RuntimeValue =>
          left.t - right.t,
      )
    : null;
}
export function sampleKeyframeTrack(
  frames: Keyframe[],
  playhead: number,
): string | number {
  const firstFrame: RuntimeValue = frames[0];
  if (playhead <= firstFrame.t) return firstFrame.v;
  const lastFrame: RuntimeValue = frames[frames.length - 1];
  if (playhead >= lastFrame.t) return lastFrame.v;
  let index = 0;
  for (; index < frames.length - 1 && frames[index + 1]!.t <= playhead; )
    index++;
  const leftFrame: RuntimeValue = frames[index],
    rightFrame: RuntimeValue = frames[index + 1];
  if (rightFrame.t === leftFrame.t) return rightFrame.v;
  const progress: RuntimeValue =
    (playhead - leftFrame.t) / (rightFrame.t - leftFrame.t);
  return interpolateValue(
    leftFrame.v,
    rightFrame.v,
    applyEasing(leftFrame.ease, progress),
    progress,
  );
}
export var EASING_CURVES: RuntimeValue = {
    in: [0.42, 0, 1, 1],
    out: [0, 0, 0.58, 1],
    inOut: [0.42, 0, 0.58, 1],
    ease: [0.25, 0.1, 0.25, 1],
    "ease-in": [0.42, 0, 1, 1],
    "ease-out": [0, 0, 0.58, 1],
    "ease-in-out": [0.42, 0, 0.58, 1],
  },
  CUBIC_BEZIER_PATTERN =
    /^cubic-bezier\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)$/i;
export function applyEasing(easing: unknown, progress: number): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  if (typeof easing != "string" || !easing || easing === "linear")
    return progress;
  const curve: RuntimeValue = Object.hasOwn(EASING_CURVES, easing)
    ? EASING_CURVES[easing]
    : undefined;
  if (curve) return solveCubicBezier(curve, progress);
  const match: RuntimeValue = CUBIC_BEZIER_PATTERN.exec(easing.trim());
  if (match) {
    const x1: RuntimeValue = clampUnit(Number(match[1])),
      y1: RuntimeValue = Number(match[2]),
      x2: RuntimeValue = clampUnit(Number(match[3])),
      y2: RuntimeValue = Number(match[4]);
    if ([x1, y1, x2, y2].every(Number.isFinite))
      return solveCubicBezier([x1, y1, x2, y2], progress);
  }
  return progress;
}
export function clampUnit(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
export function solveCubicBezier(
  [x1, y1, x2, y2]: number[],
  progress: number,
): number {
  const xLinear: RuntimeValue = 3 * x1!,
    xQuadratic: RuntimeValue = 3 * (x2! - x1!) - xLinear,
    xCubic: RuntimeValue = 1 - xLinear - xQuadratic,
    yLinear: RuntimeValue = 3 * y1!,
    yQuadratic: RuntimeValue = 3 * (y2! - y1!) - yLinear,
    yCubic: RuntimeValue = 1 - yLinear - yQuadratic,
    sampleX: RuntimeValue = (parameter?: RuntimeValue): RuntimeValue =>
      ((xCubic * parameter + xQuadratic) * parameter + xLinear) * parameter,
    sampleY: RuntimeValue = (parameter?: RuntimeValue): RuntimeValue =>
      ((yCubic * parameter + yQuadratic) * parameter + yLinear) * parameter,
    slopeX: RuntimeValue = (parameter?: RuntimeValue): RuntimeValue =>
      (3 * xCubic * parameter + 2 * xQuadratic) * parameter + xLinear;
  let parameter: RuntimeValue = progress;
  for (let iteration = 0; iteration < 8; iteration++) {
    const error: RuntimeValue = sampleX(parameter) - progress;
    if (Math.abs(error) < 1e-6) return sampleY(parameter);
    const slope: RuntimeValue = slopeX(parameter);
    if (Math.abs(slope) < 1e-6) break;
    parameter -= error / slope;
  }
  let lower = 0,
    upper = 1;
  for (parameter = progress; upper - lower > 1e-6; ) {
    sampleX(parameter) < progress ? (lower = parameter) : (upper = parameter);
    parameter = (lower + upper) / 2;
  }
  return sampleY(parameter);
}
export var VALUE_WITH_UNIT_PATTERN = /^(-?\d*\.?\d+(?:e[-+]?\d+)?)([a-z%]*)$/i,
  HEX_COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i,
  NUMERIC_TOKEN_PATTERN = /-?\d*\.?\d+(?:e[-+]?\d+)?/g;
export function interpolateValue(
  startValue: string | number,
  endValue: string | number,
  progress: number,
  rawProgress: number = progress,
): string | number {
  if (typeof startValue == "number" && typeof endValue == "number")
    return startValue + (endValue - startValue) * progress;
  const startText: RuntimeValue = String(startValue),
    endText: RuntimeValue = String(endValue),
    startUnitMatch: RuntimeValue = VALUE_WITH_UNIT_PATTERN.exec(startText),
    endUnitMatch: RuntimeValue = VALUE_WITH_UNIT_PATTERN.exec(endText);
  if (startUnitMatch && endUnitMatch) {
    const startUnit: RuntimeValue = startUnitMatch[2].toLowerCase(),
      endUnit: RuntimeValue = endUnitMatch[2].toLowerCase();
    if (startUnit === endUnit || !startUnit || !endUnit) {
      const interpolated: RuntimeValue = lerp(
        Number(startUnitMatch[1]),
        Number(endUnitMatch[1]),
        progress,
      );
      return formatInterpolatedNumber(interpolated) + (startUnit || endUnit);
    }
    return rawProgress < 1 ? startValue : endValue;
  }
  const startColorMatch: RuntimeValue = HEX_COLOR_PATTERN.exec(startText),
    endColorMatch: RuntimeValue = HEX_COLOR_PATTERN.exec(endText);
  if (startColorMatch && endColorMatch)
    return interpolateHexColor(startColorMatch[1], endColorMatch[1], progress);
  const startNumbers: RuntimeValue = startText.match(NUMERIC_TOKEN_PATTERN),
    endNumbers: RuntimeValue = endText.match(NUMERIC_TOKEN_PATTERN);
  if (startNumbers && endNumbers && startNumbers.length === endNumbers.length) {
    const startLiterals: RuntimeValue = startText.split(NUMERIC_TOKEN_PATTERN),
      endLiterals: RuntimeValue = endText.split(NUMERIC_TOKEN_PATTERN);
    if (
      startLiterals.length === endLiterals.length &&
      startLiterals.every(
        (literal?: RuntimeValue, index?: RuntimeValue): RuntimeValue =>
          literal === endLiterals[index],
      )
    ) {
      let output = "";
      for (let index = 0; index < startLiterals.length; index++)
        if (((output += startLiterals[index]), index < startNumbers.length)) {
          const startNumber: RuntimeValue = startNumbers[index],
            endNumber: RuntimeValue = endNumbers[index],
            hasLeadingZero: RuntimeValue =
              /^-?0\d/.test(startNumber) || /^-?0\d/.test(endNumber);
          output += hasLeadingZero
            ? rawProgress < 1
              ? startNumber
              : endNumber
            : formatInterpolatedNumber(
                lerp(Number(startNumber), Number(endNumber), progress),
              );
        }
      return output;
    }
  }
  return rawProgress < 1 ? startValue : endValue;
}
export function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}
export function formatInterpolatedNumber(value: number): string {
  return String(Math.round(value * 1e4) / 1e4);
}
export function interpolateHexColor(
  startColor: string,
  endColor: string,
  progress: number,
): string {
  const startChannels: RuntimeValue = parseHexChannels(startColor),
    endChannels: RuntimeValue = parseHexChannels(endColor),
    formatChannel: RuntimeValue = (channel?: RuntimeValue): RuntimeValue =>
      Math.round(clampUnit(channel / 255) * 255)
        .toString(16)
        .padStart(2, "0"),
    channelCount: RuntimeValue =
      startChannels.length === 4 || endChannels.length === 4 ? 4 : 3;
  let hex = "#";
  for (let index = 0; index < channelCount; index++)
    hex += formatChannel(
      lerp(startChannels[index] ?? 255, endChannels[index] ?? 255, progress),
    );
  return hex;
}
export function parseHexChannels(hex: string): number[] {
  return (
    hex.length <= 4
      ? hex.split("").map((digit?: RuntimeValue): RuntimeValue => digit + digit)
      : (hex.match(/../g) ?? [])
  ).map((channel?: RuntimeValue): RuntimeValue => parseInt(channel, 16));
}
export function compileAttributes(
  element?: RuntimeValue,
  mode?: RuntimeValue,
  context?: RuntimeValue,
): RuntimeValue {
  const propGetters: RuntimeValue = [],
    pseudoClasses: RuntimeValue = [];
  let initialChecked = false;
  const keyframeTracks: RuntimeValue = [];
  let hintSize: RuntimeValue = null;
  for (const { name: attributeName, value: attributeValue } of [
    ...element.attributes,
  ]) {
    if (attributeName === "sc-name" || attributeName === "data-dc-tpl")
      continue;
    if (mode === "dom") {
      const keyframeAttribute: RuntimeValue =
          parseKeyframeAttribute(attributeName),
        safeTarget: RuntimeValue =
          !keyframeAttribute ||
          keyframeAttribute.kind === "css" ||
          isSafeKeyframeTag(
            ORIGINAL_RAW_TAGS[element.localName] || element.localName,
          );
      keyframeAttribute &&
        safeTarget &&
        (keyframeAttribute.kind === "css"
          ? isSafeCssProperty(keyframeAttribute.prop)
          : isSafeKeyframeAttribute(keyframeAttribute.prop)) &&
        keyframeTracks.push({
          kind: keyframeAttribute.kind,
          prop: keyframeAttribute.prop,
          getter: compileInterpolation(attributeValue),
        });
    }
    let propName: RuntimeValue = attributeName;
    if (
      (propName.startsWith(CAMEL_ATTRIBUTE_PREFIX) &&
        (propName = toCamelCase(propName.slice(CAMEL_ATTRIBUTE_PREFIX.length))),
      propName === "hint-size")
    ) {
      hintSize = attributeValue;
      continue;
    }
    if (propName.startsWith("style-")) {
      pseudoClasses.push(
        context.pseudoClass(propName.slice(6), attributeValue),
      );
      continue;
    }
    if (mode !== "dom")
      propName.includes("-") &&
        !(
          mode === "x-import" &&
          (propName.startsWith("aria-") || propName.startsWith("data-"))
        ) &&
        (propName = toCamelCase(propName));
    else if (propName === "class") propName = "className";
    else if (propName === "for") propName = "htmlFor";
    else if (propName.startsWith("on"))
      propName =
        REACT_EVENT_NAMES[propName] ||
        "on" + propName[2].toUpperCase() + propName.slice(3);
    else if (
      propName === "checked" &&
      element.localName === "input" &&
      !attributeValue.includes("{{") &&
      !context.omelette
    ) {
      propGetters.push(["defaultChecked", (): RuntimeValue => true]);
      initialChecked = true;
      continue;
    } else if (
      attributeValue === "" &&
      BOOLEAN_ATTRIBUTES.has(propName) &&
      !context.omelette
    ) {
      propGetters.push([propName, (): RuntimeValue => true]);
      continue;
    }
    propGetters.push([propName, compileInterpolation(attributeValue)]);
  }
  return {
    propGetters: propGetters,
    pseudoClasses: pseudoClasses,
    hintSize: hintSize,
    kfTracks: keyframeTracks,
    initialChecked: initialChecked,
  };
}
export var HOST_LAYOUT_PROPERTIES: RuntimeValue = new Set([
    "position",
    "left",
    "right",
    "top",
    "bottom",
    "inset",
    "width",
    "height",
    "z-index",
    "transform",
  ]),
  layoutPropertyName: RuntimeValue = (
    propertyName?: RuntimeValue,
  ): RuntimeValue =>
    propertyName.startsWith("--")
      ? propertyName
      : propertyName.replace(
          /[A-Z]/g,
          (letter?: RuntimeValue): RuntimeValue => "-" + letter.toLowerCase(),
        );
export function extractHostLayout(style?: RuntimeValue): RuntimeValue {
  const parsed: RuntimeValue =
    typeof style == "string"
      ? parseInlineStyle(style)
      : style != null && typeof style == "object"
        ? style
        : null;
  if (!parsed) return;
  const layout: RuntimeValue = {};
  for (const [propertyName, value] of Object.entries(parsed))
    HOST_LAYOUT_PROPERTIES.has(layoutPropertyName(propertyName)) &&
      (layout[propertyName] = value);
  return Object.keys(layout).length ? layout : undefined;
}
export function compileTemplate(
  html: string,
  context: TemplateContext,
): CompiledTemplate {
  const templateElement: RuntimeValue = document.createElement("template");
  templateElement.innerHTML = preprocessTemplate(html);
  let annotationId = 0;
  (function annotateNode(node?: RuntimeValue): RuntimeValue {
    node.nodeType === Node.ELEMENT_NODE &&
      node.setAttribute("data-dc-tpl", String(annotationId++));
    for (const child of node.childNodes) annotateNode(child);
  })(templateElement.content);
  const children: RuntimeValue = compileChildren(
      templateElement.content,
      context,
    ),
    renderTemplate: RuntimeValue = (
      values?: RuntimeValue,
      host?: RuntimeValue,
    ): RuntimeValue =>
      children.map(
        (renderChild?: RuntimeValue, index?: RuntimeValue): RuntimeValue =>
          renderChild(values || {}, host, index),
      );
  renderTemplate.__annotated = templateElement.innerHTML;
  return renderTemplate;
}
export function compileChildren(
  node?: RuntimeValue,
  context?: RuntimeValue,
): RuntimeValue {
  return [...node.childNodes]
    .map((child?: RuntimeValue): RuntimeValue => compileNode(child, context))
    .filter((compiled?: RuntimeValue): RuntimeValue => compiled != null);
}
export function compileNode(
  node?: RuntimeValue,
  context?: RuntimeValue,
): RuntimeValue {
  if (node.nodeType === Node.TEXT_NODE) return compileTextNode(node);
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const element: RuntimeValue = node,
    tagName: RuntimeValue = element.tagName.toLowerCase();
  return tagName === "sc-for"
    ? compileLoop(element, context)
    : tagName === "sc-if"
      ? compileCondition(element, context)
      : tagName === "x-import"
        ? compileExternalImport(element, context)
        : tagName === "sc-helmet"
          ? context.helmet(element)
          : tagName === "dc-import"
            ? compileDesignImport(element, context)
            : compileDomElement(element, context);
}
export var warningKeys: RuntimeValue = new Set();
export function warnOnce(
  host?: RuntimeValue,
  message?: RuntimeValue,
): RuntimeValue {
  const key: RuntimeValue = (host?.__name || "?") + "\0" + message;
  warningKeys.has(key) ||
    (warningKeys.add(key),
    console.warn(
      "[dc-runtime] " + (host?.__name || "template") + ": " + message,
    ));
}
export function compileTextNode(node?: RuntimeValue): RuntimeValue {
  const text: RuntimeValue = node.nodeValue ?? "";
  if (!text.includes("{{"))
    return !text.trim() && !text.includes(" ")
      ? null
      : (): RuntimeValue => text;
  const segments: RuntimeValue = text.split(/\{\{([\s\S]+?)\}\}/g);
  return (
    values?: RuntimeValue,
    host?: RuntimeValue,
    key?: RuntimeValue,
  ): RuntimeValue =>
    (() => {
      const _Component2 = getReact().Fragment;
      return (
        <_Component2 key={key}>
          {...segments.map(
            (segment?: RuntimeValue, index?: RuntimeValue): RuntimeValue => {
              if (!(index & 1)) return segment;
              const value: RuntimeValue = evaluateExpression(values, segment);
              return value === undefined ? (
                host?.__streamingNow ? (
                  <span key={index} className={"sc-interp sc-missing"}>
                    {segment.trim()}
                  </span>
                ) : document.body?.hasAttribute("data-dc-editor-on") ? (
                  <span key={index} className={"sc-interp sc-unresolved"}>
                    {"{{ " + segment.trim() + " }}"}
                  </span>
                ) : (
                  (warnOnce(
                    host,
                    "{{ " +
                      segment.trim() +
                      " }} never resolved \u2014 rendered as empty",
                  ),
                  null)
                )
              ) : getReact().isValidElement(value) || Array.isArray(value) ? (
                (() => {
                  const _Component = getReact().Fragment;
                  return <_Component key={index}>{value}</_Component>;
                })()
              ) : value === null || typeof value == "boolean" ? null : (
                <span key={index} className={"sc-interp"}>
                  {String(value)}
                </span>
              );
            },
          )}
        </_Component2>
      );
    })();
}
export function compileLoop(
  element?: RuntimeValue,
  context?: RuntimeValue,
): RuntimeValue {
  const listGetter: RuntimeValue = compileInterpolation(
      element.getAttribute("list") || "",
    ),
    itemName: RuntimeValue = element.getAttribute("as") || "item",
    placeholderCount: RuntimeValue = parseInt(
      element.getAttribute("hint-placeholder-count") || "0",
      10,
    ),
    children: RuntimeValue = compileChildren(element, context),
    listExpression: RuntimeValue = element.getAttribute("list") || "";
  return (
    values?: RuntimeValue,
    host?: RuntimeValue,
    key?: RuntimeValue,
  ): RuntimeValue => {
    let items: RuntimeValue = listGetter(values);
    Array.isArray(items) ||
      (host?.__streamingNow
        ? (items =
            placeholderCount > 0 ? Array(placeholderCount).fill(undefined) : [])
        : (items != null &&
            warnOnce(
              host,
              'sc-for list="' +
                listExpression +
                '" is not an array (' +
                typeof items +
                ")",
            ),
          (items = [])));
    return (() => {
      const _Component4 = getReact().Fragment;
      return (
        <_Component4 key={key}>
          {items.map(
            (item?: RuntimeValue, index?: RuntimeValue): RuntimeValue => {
              const iterationScope: RuntimeValue = {
                ...values,
                [itemName]: item,
                $index: index,
              };
              return (() => {
                const _Component3 = getReact().Fragment;
                return (
                  <_Component3 key={index}>
                    {children.map(
                      (
                        renderChild?: RuntimeValue,
                        childIndex?: RuntimeValue,
                      ): RuntimeValue =>
                        renderChild(iterationScope, host, childIndex),
                    )}
                  </_Component3>
                );
              })();
            },
          )}
        </_Component4>
      );
    })();
  };
}
export function compileCondition(
  element?: RuntimeValue,
  context?: RuntimeValue,
): RuntimeValue {
  const conditionGetter: RuntimeValue = compileInterpolation(
      element.getAttribute("value") || "",
    ),
    placeholderValue: RuntimeValue = element.getAttribute(
      "hint-placeholder-val",
    ),
    placeholderGetter: RuntimeValue =
      placeholderValue != null ? compileInterpolation(placeholderValue) : null,
    children: RuntimeValue = compileChildren(element, context);
  return (
    values?: RuntimeValue,
    host?: RuntimeValue,
    key?: RuntimeValue,
  ): RuntimeValue => {
    let condition: RuntimeValue = conditionGetter(values);
    condition === undefined &&
      placeholderGetter &&
      host?.__streamingNow &&
      (condition = placeholderGetter(values));
    return condition
      ? (() => {
          const _Component5 = getReact().Fragment;
          return (
            <_Component5 key={key}>
              {children.map(
                (
                  renderChild?: RuntimeValue,
                  index?: RuntimeValue,
                ): RuntimeValue => renderChild(values, host, index),
              )}
            </_Component5>
          );
        })()
      : null;
  };
}
export function compileDesignImport(
  element?: RuntimeValue,
  context?: RuntimeValue,
): RuntimeValue {
  const componentName: RuntimeValue =
    element.getAttribute("name") || element.getAttribute("component") || "";
  element.removeAttribute("name");
  element.removeAttribute("component");
  const templateId: RuntimeValue = element.getAttribute("data-dc-tpl"),
    styleText: RuntimeValue = element.getAttribute("style");
  element.removeAttribute("style");
  const styleGetter: RuntimeValue =
      styleText != null ? compileInterpolation(styleText) : null,
    { propGetters: propGetters, hintSize: hintSize } = compileAttributes(
      element,
      "dc-import",
      context,
    ),
    children: RuntimeValue = compileChildren(element, context);
  return (
    values?: RuntimeValue,
    host?: RuntimeValue,
    key?: RuntimeValue,
  ): RuntimeValue => {
    const props: RuntimeValue = {
      key: key,
      __hintSize: hintSize,
      __tplId: templateId,
      __hostStyle: styleGetter
        ? extractHostLayout(styleGetter(values))
        : undefined,
    };
    for (const [propName, getter] of propGetters) {
      const value: RuntimeValue = getter(values);
      if (propName === "dcProps") {
        value && typeof value == "object" && Object.assign(props, value);
        continue;
      }
      props[propName] = value;
    }
    children.length &&
      (props.children = children.map(
        (renderChild?: RuntimeValue, index?: RuntimeValue): RuntimeValue =>
          renderChild(values, host, index),
      ));
    return (() => {
      const _Component6 = context.component(componentName);
      return <_Component6 {...props} />;
    })();
  };
}
export function compileExternalImport(
  element?: RuntimeValue,
  context?: RuntimeValue,
): RuntimeValue {
  const globalComponentGetter: RuntimeValue = compileInterpolation(
      element.getAttribute("component-from-global-scope") || "",
    ),
    componentGetter: RuntimeValue = compileInterpolation(
      element.getAttribute("component") || element.getAttribute("name") || "",
    ),
    sourceText: RuntimeValue =
      element.getAttribute("from") ||
      (element.getAttribute("component-from-global-scope")
        ? ""
        : element.getAttribute("src") || element.getAttribute("import") || ""),
    sourceUrls: RuntimeValue = sourceText.trim()
      ? sourceText.trim().split(/\s+/)
      : [],
    lastSourceUrl: RuntimeValue = sourceUrls.length
      ? sourceUrls[sourceUrls.length - 1]
      : "",
    sourceType: RuntimeValue = (url?: RuntimeValue): RuntimeValue =>
      /\.(jsx|tsx)(\?|#|$)/i.test(url) ? "jsx" : "js",
    templateId: RuntimeValue = element.getAttribute("data-dc-tpl"),
    styleText: RuntimeValue = element.getAttribute("style");
  element.removeAttribute("style");
  const styleGetter: RuntimeValue =
      styleText != null ? compileInterpolation(styleText) : null,
    needsHost: RuntimeValue = templateId != null || styleGetter != null,
    { propGetters: propGetters, hintSize: hintSize } = compileAttributes(
      element,
      "x-import",
      context,
    ),
    children: RuntimeValue =
      element.children.length > 0 || !!(element.textContent || "").trim()
        ? compileChildren(element, context)
        : [],
    dynamicSource: RuntimeValue = sourceText.includes("{{");
  if (sourceUrls.length && !dynamicSource) {
    let previousLoad: RuntimeValue;
    for (const url of sourceUrls)
      previousLoad = context.loadExternal(sourceType(url), url, previousLoad);
  }
  const resolveName: RuntimeValue = (
    getter?: RuntimeValue,
    values?: RuntimeValue,
  ): RuntimeValue => {
    const value: RuntimeValue = getter(values),
      name: RuntimeValue = value == null ? "" : String(value);
    return name.includes("{{") ? "" : name;
  };
  return (
    values?: RuntimeValue,
    host?: RuntimeValue,
    key?: RuntimeValue,
  ): RuntimeValue => {
    const globalName: RuntimeValue = resolveName(globalComponentGetter, values),
      componentName: RuntimeValue =
        globalName || resolveName(componentGetter, values),
      Component: RuntimeValue =
        !componentName || dynamicSource
          ? null
          : globalName
            ? context.resolveExternalGlobal(lastSourceUrl, globalName)
            : context.resolveExternal(lastSourceUrl, componentName),
      hostStyle: RuntimeValue = styleGetter
        ? extractHostLayout(styleGetter(values))
        : undefined,
      wrapperProps: RuntimeValue = needsHost
        ? {
            key: key,
            className: "sc-host-x",
            "data-dc-tpl": templateId,
            style: hostStyle || {
              display: "contents",
            },
          }
        : null;
    if (!Component) {
      const error: RuntimeValue = dynamicSource
          ? "x-import `from` cannot contain {{ \u2026 }} \u2014 module URLs are resolved at parse time; use a literal URL"
          : context.resolveExternalError(lastSourceUrl, componentName),
        placeholder: RuntimeValue = context.placeholder({
          key: wrapperProps ? undefined : key,
          name: componentName,
          hintSize: hintSize,
          error: error,
        });
      return wrapperProps ? (
        <div {...wrapperProps}>{placeholder}</div>
      ) : (
        placeholder
      );
    }
    const props: RuntimeValue = wrapperProps
      ? {}
      : {
          key: key,
        };
    let hasUnresolvedProps = false;
    for (const [propName, getter] of propGetters) {
      if (
        propName === "component" ||
        propName === "componentFromGlobalScope" ||
        propName === "from"
      )
        continue;
      const value: RuntimeValue = getter(values);
      if (
        (value === undefined && (hasUnresolvedProps = true),
        propName === "dcProps")
      ) {
        value && typeof value == "object" && Object.assign(props, value);
        continue;
      }
      props[propName] = value;
    }
    if (hasUnresolvedProps && host?.__htmlStreamingNow) {
      const placeholder: RuntimeValue = context.placeholder({
        key: wrapperProps ? undefined : key,
        name: componentName,
        hintSize: hintSize,
        error: null,
      });
      return wrapperProps ? (
        <div {...wrapperProps}>{placeholder}</div>
      ) : (
        placeholder
      );
    }
    children.length &&
      (props.children = children.map(
        (renderChild?: RuntimeValue, index?: RuntimeValue): RuntimeValue =>
          renderChild(values, host, index),
      ));
    return wrapperProps ? (
      <div {...wrapperProps}>
        <Component {...props} />
      </div>
    ) : (
      <Component {...props} />
    );
  };
}
export function structuralKey(element?: RuntimeValue): RuntimeValue {
  const clone: RuntimeValue = element.cloneNode(true);
  for (const descendant of clone.querySelectorAll("*"))
    for (; descendant.attributes.length; )
      descendant.removeAttribute(descendant.attributes[0].name);
  const html: RuntimeValue = clone.innerHTML;
  let hash = 5381;
  for (let index = 0; index < html.length; index++)
    hash = ((hash << 5) + hash + html.charCodeAt(index)) | 0;
  return html.length + "." + (hash >>> 0).toString(36);
}
export var RAW_TEXT_TAGS: RuntimeValue = new Set(
    "script style textarea option title select canvas iframe video audio".split(
      " ",
    ),
  ),
  BLOCK_DESCENDANT_SELECTOR: RuntimeValue =
    ":not(" + [...INLINE_TAGS].join(",") + ")",
  CSS_PROPERTY_TOKEN_PATTERN = /-{0,2}[A-Za-z_][A-Za-z0-9_-]*/y,
  UNSAFE_CSS_PROPERTY_PATTERN = /^(?:behavior|-moz-binding)$/i,
  CSS_WHITESPACE_PATTERN = /[ \t\n\r\f]/;
export function normalizeCssDeclarations(css: string): string {
  let output = "",
    offset = 0,
    depth = 0,
    atDeclarationStart = true;
  const length: RuntimeValue = css.length;
  for (; offset < length; ) {
    if (atDeclarationStart) {
      let propertyStart: RuntimeValue = offset;
      for (
        ;
        propertyStart < length &&
        CSS_WHITESPACE_PATTERN.test(css[propertyStart]!);

      )
        propertyStart++;
      if (css[propertyStart] === "/" && css[propertyStart + 1] === "*") {
        const commentEnd: RuntimeValue = css.indexOf("*/", propertyStart + 2),
          nextOffset: RuntimeValue = commentEnd < 0 ? length : commentEnd + 2;
        output += css.slice(offset, nextOffset);
        offset = nextOffset;
        continue;
      }
      atDeclarationStart = false;
      CSS_PROPERTY_TOKEN_PATTERN.lastIndex = propertyStart;
      const propertyMatch: RuntimeValue = CSS_PROPERTY_TOKEN_PATTERN.exec(css);
      if (propertyMatch) {
        let colonOffset: RuntimeValue = propertyStart + propertyMatch[0].length;
        for (;;) {
          for (
            ;
            colonOffset < length &&
            CSS_WHITESPACE_PATTERN.test(css[colonOffset]!);

          )
            colonOffset++;
          if (css[colonOffset] !== "/" || css[colonOffset + 1] !== "*") break;
          const commentEnd: RuntimeValue = css.indexOf("*/", colonOffset + 2);
          colonOffset = commentEnd < 0 ? length : commentEnd + 2;
        }
        if (css[colonOffset] === ":") {
          const propertyName: RuntimeValue = toCssPropertyName(
            propertyMatch[0],
          );
          output +=
            css.slice(offset, propertyStart) +
            (UNSAFE_CSS_PROPERTY_PATTERN.test(propertyName)
              ? propertyMatch[0]
              : propertyName);
          offset = propertyStart + propertyMatch[0].length;
          continue;
        }
      }
    }
    const character: RuntimeValue = css[offset];
    if (character === '"' || character === "'") {
      let stringEnd: RuntimeValue = offset + 1;
      for (; stringEnd < length && css[stringEnd] !== character; )
        stringEnd += css[stringEnd] === "\\" ? 2 : 1;
      output += css.slice(offset, stringEnd + 1);
      offset = stringEnd + 1;
      continue;
    }
    if (character === "/" && css[offset + 1] === "*") {
      const commentEnd: RuntimeValue = css.indexOf("*/", offset + 2),
        nextOffset: RuntimeValue = commentEnd < 0 ? length : commentEnd + 2;
      output += css.slice(offset, nextOffset);
      offset = nextOffset;
      continue;
    }
    if (character === "\\") {
      output += css.slice(offset, offset + 2);
      offset += 2;
      continue;
    }
    character === "(" || character === "{" || character === "["
      ? depth++
      : character === ")" || character === "}" || character === "]"
        ? (depth = Math.max(0, depth - 1))
        : character === ";" && depth === 0 && (atDeclarationStart = true);
    output += character;
    offset++;
  }
  return output;
}
export function cssRefKey(
  css?: RuntimeValue,
  preservedProperties?: RuntimeValue,
): RuntimeValue {
  return css == null ? undefined : css + "\0" + preservedProperties.join(";");
}
export function createCssRef(
  css?: RuntimeValue,
  preservedProperties?: RuntimeValue,
): RuntimeValue {
  const cacheKey: RuntimeValue = cssRefKey(css, preservedProperties);
  return (element?: RuntimeValue): RuntimeValue => {
    if (!element || element.__dcCss === cacheKey) return;
    element.__dcCss = cacheKey;
    const style: RuntimeValue = element.style,
      preservedValues: RuntimeValue = preservedProperties.map(
        (propertyName?: RuntimeValue): RuntimeValue => [
          propertyName,
          style.getPropertyValue(propertyName),
        ],
      );
    style.cssText = css ? normalizeCssDeclarations(css) : "";
    for (let index: RuntimeValue = style.length; index-- > 0; ) {
      const propertyName: RuntimeValue = style[index];
      if (!style.getPropertyPriority(propertyName)) continue;
      const value: RuntimeValue = style.getPropertyValue(propertyName);
      value && style.setProperty(propertyName, value);
      style.getPropertyPriority(propertyName) &&
        style.removeProperty(propertyName);
    }
    for (const [propertyName, value] of preservedValues)
      value && style.setProperty(propertyName, value);
  };
}
export function assignRef(
  ref?: RuntimeValue,
  element?: RuntimeValue,
): RuntimeValue {
  typeof ref == "function" ? ref(element) : (ref.current = element);
}
export function getCachedRef(
  cache?: RuntimeValue,
  limit?: RuntimeValue,
  key?: RuntimeValue,
  factory?: RuntimeValue,
): RuntimeValue {
  let value: RuntimeValue = cache.get(key);
  value ||
    (cache.size >= limit && cache.delete(cache.keys().next().value),
    cache.set(key, (value = factory())));
  return value;
}
export var userRefCache: RuntimeValue = new WeakMap();
export function createCssRefCache(): RuntimeValue {
  const cache: RuntimeValue = new Map();
  return (
    css?: RuntimeValue,
    preservedProperties?: RuntimeValue,
    userRef?: RuntimeValue,
  ): RuntimeValue => {
    const key: RuntimeValue =
        (css == null ? "none" : "css:" + css) +
        "\0" +
        preservedProperties.join(";"),
      buildRef: RuntimeValue = (): RuntimeValue =>
        createCssRef(css, preservedProperties);
    if (
      userRef == null ||
      (typeof userRef != "function" && typeof userRef != "object")
    )
      return getCachedRef(cache, 64, key, buildRef);
    let refCache: RuntimeValue = userRefCache.get(userRef);
    refCache || userRefCache.set(userRef, (refCache = new Map()));
    return getCachedRef(refCache, 1024, key, (): RuntimeValue => {
      const cssRef: RuntimeValue = buildRef();
      return (element?: RuntimeValue): RuntimeValue => {
        cssRef(element);
        assignRef(userRef, element);
      };
    });
  };
}
export function compileDomElement(
  element?: RuntimeValue,
  context?: RuntimeValue,
): RuntimeValue {
  const tagName: RuntimeValue =
      ORIGINAL_RAW_TAGS[element.localName] || element.localName,
    templateId: RuntimeValue = element.getAttribute("data-dc-tpl"),
    hasOnlyInlineChildren: RuntimeValue =
      element.childNodes.length > 0 &&
      !RAW_TEXT_TAGS.has(tagName) &&
      element.querySelector(BLOCK_DESCENDANT_SELECTOR) === null,
    {
      propGetters: propGetters,
      pseudoClasses: pseudoClasses,
      kfTracks: keyframeTracks,
      initialChecked: initialChecked,
    } = compileAttributes(element, "dom", context),
    keySuffix: RuntimeValue =
      (hasOnlyInlineChildren ? "|" + structuralKey(element) : "") +
      (initialChecked ? "|checked" : ""),
    children: RuntimeValue = compileChildren(element, context),
    cssRefs: RuntimeValue = context.omelette ? null : createCssRefCache();
  return (
    values?: RuntimeValue,
    host?: RuntimeValue,
    key?: RuntimeValue,
  ): RuntimeValue => {
    const props: RuntimeValue = {
      key: key + keySuffix,
      "data-dc-tpl": templateId,
    };
    let cssText: RuntimeValue = null;
    for (const [propName, getter] of propGetters) {
      let value: RuntimeValue = getter(values);
      propName === "style" &&
        typeof value == "string" &&
        ((cssText = value), (value = parseInlineStyle(value)));
      (propName === "value" || propName === "checked") &&
        value === undefined &&
        (value = propName === "checked" ? false : "");
      props[propName] = value;
    }
    pseudoClasses.length &&
      (props.className = [props.className, ...pseudoClasses]
        .filter(Boolean)
        .join(" "));
    const animatedProperties: RuntimeValue = [];
    if (keyframeTracks.length) {
      const playhead: RuntimeValue = context.keyframesPlayhead
        ? context.keyframesPlayhead()
        : 0;
      let animatedStyle: RuntimeValue = null;
      for (const trackBinding of keyframeTracks) {
        const track: RuntimeValue = parseKeyframeTrack(
          trackBinding.getter(values),
        );
        if (!track) continue;
        const frameValue: RuntimeValue = sampleKeyframeTrack(track, playhead);
        if (trackBinding.kind === "css") {
          animatedProperties.push(trackBinding.prop);
          animatedStyle ||
            ((animatedStyle =
              props.style && typeof props.style == "object"
                ? {
                    ...props.style,
                  }
                : {}),
            (props.style = animatedStyle));
          animatedStyle[
            trackBinding.prop.startsWith("--")
              ? trackBinding.prop
              : toCamelCase(trackBinding.prop)
          ] = frameValue;
        } else {
          const attributeValue: RuntimeValue = sanitizeKeyframeAttribute(
            trackBinding.prop,
            frameValue,
          );
          attributeValue != null && (props[trackBinding.prop] = attributeValue);
        }
      }
    }
    if (cssRefs) {
      const preservedProperties: RuntimeValue =
        cssText == null && props.style && typeof props.style == "object"
          ? Object.keys(props.style).map(layoutPropertyName)
          : animatedProperties;
      props.ref = cssRefs(cssText, preservedProperties.sort(), props.ref);
    }
    return (() => {
      const _Component7 = tagName;
      return (
        <_Component7 {...props}>
          {...children.map(
            (renderChild?: RuntimeValue, index?: RuntimeValue): RuntimeValue =>
              renderChild(values, host, index),
          )}
        </_Component7>
      );
    })();
  };
}
