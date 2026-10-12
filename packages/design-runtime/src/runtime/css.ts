/**
 * Reconstructed css subsystem of the Design Component runtime.
 * Source declarations: dc-runtime.js offsets 180830..182199.
 * Semantic names are inferred from the shipped behavior; see runtime-map.json.
 */

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
export function unquotedUrlEnd(css: string, start: number): number {
  if (
    (css[start] !== "u" && css[start] !== "U") ||
    css.slice(start, start + 4).toLowerCase() !== "url(" ||
    /[a-z0-9_-]/i.test(css[start - 1] ?? "")
  )
    return -1;
  let offset: RuntimeValue = start + 4;
  for (; offset < css.length && /\s/.test(css[offset]!); ) offset++;
  if (css[offset] === '"' || css[offset] === "'") return -1;
  for (; offset < css.length && css[offset] !== ")"; ) {
    css[offset] === "\\" && offset++;
    offset++;
  }
  return offset < css.length ? offset + 1 : css.length;
}
export function stripCssComments(css: string): string {
  let output = "",
    quote = "";
  for (let index = 0; index < css.length; index++) {
    const character: RuntimeValue = css[index];
    if (quote) {
      if (character === "\\") {
        output += character + (css[index + 1] ?? "");
        index++;
        continue;
      }
      character === quote && (quote = "");
      output += character;
    } else if (character === "'" || character === '"') {
      quote = character;
      output += character;
    } else if (character === "/" && css[index + 1] === "*") {
      const commentEnd: RuntimeValue = css.indexOf("*/", index + 2);
      index = commentEnd === -1 ? css.length : commentEnd + 1;
      output += " ";
    } else {
      const urlEnd: RuntimeValue = unquotedUrlEnd(css, index);
      urlEnd === -1
        ? (output += character)
        : ((output += css.slice(index, urlEnd)), (index = urlEnd - 1));
    }
  }
  return output;
}
export function importantDeclarations(css: string): string {
  css = stripCssComments(css);
  const declarations: RuntimeValue = [];
  let start = 0,
    depth = 0,
    quote = "";
  for (let index = 0; index < css.length; index++) {
    const character: RuntimeValue = css[index];
    if (quote) character === "\\" ? index++ : character === quote && (quote = "");
    else if (character === "'" || character === '"') quote = character;
    else if (character === "(") depth++;
    else if (character === ")") depth = Math.max(0, depth - 1);
    else if (character === ";" && depth === 0) {
      declarations.push(css.slice(start, index));
      start = index + 1;
    } else {
      const urlEnd: RuntimeValue = unquotedUrlEnd(css, index);
      urlEnd !== -1 && (index = urlEnd - 1);
    }
  }
  declarations.push(css.slice(start));
  return declarations
    .map((declaration?: RuntimeValue): RuntimeValue => declaration.trim())
    .filter(Boolean)
    .map(
      (declaration?: RuntimeValue): RuntimeValue =>
        /!\s*important$/i.test(declaration) ? declaration : declaration + " !important",
    )
    .join(";");
}
export function createPseudoClassManager(documentNode?: RuntimeValue): RuntimeValue {
  let styleElement: RuntimeValue = null;
  const classes: RuntimeValue = new Map();
  let sequence = 0;
  return (pseudo?: RuntimeValue, css?: RuntimeValue): RuntimeValue => {
    const key: RuntimeValue = pseudo + "|" + css,
      existing: RuntimeValue = classes.get(key);
    if (existing) return existing;
    styleElement ||
      ((styleElement = documentNode.createElement("style")),
      documentNode.head.appendChild(styleElement));
    const className: RuntimeValue = "scp" + (sequence++).toString(36),
      isPseudoElement: RuntimeValue = pseudo === "before" || pseudo === "after",
      selector: RuntimeValue = isPseudoElement
        ? "." + className + "::" + pseudo
        : "." + className + ":" + pseudo;
    styleElement.sheet.insertRule(
      selector + "{" + (isPseudoElement ? css : importantDeclarations(css)) + "}",
      styleElement.sheet.cssRules.length,
    );
    classes.set(key, className);
    return className;
  };
}
