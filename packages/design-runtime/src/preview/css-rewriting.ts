/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPreviewCssRewriting(
  runtime: RuntimeBindings,
): () => void {
  var PreviewCssRewritingTest: Dynamic;
  var PreviewCssRewritingImportCharsetPattern: Dynamic;
  var PreviewCssRewritingReplace: Dynamic;
  function stripStylesheetComments(items?: Dynamic): Dynamic {
    let text: Dynamic = "",
      text2: Dynamic = "";
    for (let index: Dynamic = 0; index < items.length; index++) {
      let value: Dynamic = items[index];
      if (text2) {
        if (value === "\\") {
          text += value + (items[index + 1] ?? "");
          index++;
          continue;
        }
        value === text2 && (text2 = "");
        text += value;
      } else if (value === "'" || value === '"') {
        text2 = value;
        text += value;
      } else if (value === "/" && items[index + 1] === "*") {
        let value2: Dynamic = items.indexOf("*/", index + 2);
        index = value2 === -1 ? items.length : value2 + 1;
        text += " ";
      } else {
        let value2: Dynamic = findCssUrlEnd(items, index);
        value2 === -1
          ? (text += value)
          : ((text += items.slice(index, value2)), (index = value2 - 1));
      }
    }
    return text;
  }
  function findCssUrlEnd(items?: Dynamic, options?: Dynamic): Dynamic {
    if (
      (items[options] !== "u" && items[options] !== "U") ||
      items.slice(options, options + 4).toLowerCase() !== "url(" ||
      /[a-z0-9_-]/i.test(items[options - 1] ?? "")
    )
      return -1;
    let value: Dynamic = options + 4;
    for (; value < items.length && /\s/.test(items[value]); ) value++;
    if (items[value] === '"' || items[value] === "'") return -1;
    for (; value < items.length && items[value] !== ")"; ) {
      items[value] === "\\" && value++;
      value++;
    }
    return value < items.length ? value + 1 : items.length;
  }
  function inlineStylesheetImports(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (context.has(input)) return "";
    context.add(input);
    let value: Dynamic = (0, runtime.PreviewAssetRewritingSlice)(input),
      value2: Dynamic = (0, runtime.rewriteProjectAssets)(
        stripStylesheetComments(options[input] ?? ""),
        options,
        value,
      ),
      value3: Dynamic = leadingStylesheetAtRuleEnd(value2);
    return value2.replace(
      runtime.PreviewHtmlScannerImportPattern,
      (input2?: Dynamic, ...options2: Dynamic[]): Dynamic => {
        if (options2[6] >= value3) return "";
        if (options2[5]) return input2;
        let value4: Dynamic = (0, runtime.resolveProjectAssetPath)(
          value,
          String(
            options2[0] ??
              options2[1] ??
              options2[2] ??
              options2[3] ??
              options2[4] ??
              "",
          ),
        );
        return value4 !== null &&
          /\.css$/i.test(value4) &&
          options[value4] != null
          ? inlineStylesheetImports(value4, options, context) +
              `
`
          : input2;
      },
    );
  }
  function isStandaloneStylesheet(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = stripStylesheetComments(options[input] ?? "");
    if (/@import\b/i.test(value) || /_blob\//.test(value)) return false;
    let value2: Dynamic = (0, runtime.PreviewAssetRewritingSlice)(input);
    if ((0, runtime.rewriteProjectAssets)(value, options, value2) !== value)
      return false;
    for (let value3 of value.matchAll(
      /url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s"'()]+))\s*\)/gi,
    ) as Dynamic) {
      let value4: Dynamic = value3[1] ?? value3[2] ?? value3[3] ?? "";
      if (value4 === "" || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value4))
        continue;
      let value5: Dynamic = (0, runtime.resolveProjectAssetPath)(
        value2,
        value4.split(/[?#]/)[0],
      );
      if (
        value5 !== null &&
        options[value5] != null &&
        options[value5] !== context[value5]
      )
        return false;
    }
    return true;
  }
  function leadingStylesheetAtRuleEnd(items?: Dynamic): Dynamic {
    let index: Dynamic = 0;
    for (;;) {
      for (; index < items.length && /\s/.test(items[index]); ) index++;
      PreviewCssRewritingImportCharsetPattern.lastIndex = index;
      let value: Dynamic = PreviewCssRewritingImportCharsetPattern.exec(items);
      if (value === null) return index;
      index += value[0].length;
    }
  }
  function moveCssImportsFirst(input?: Dynamic): Dynamic {
    let items: Dynamic = [],
      value: Dynamic = input.replace(
        runtime.PreviewHtmlScannerImportPattern,
        (input2?: Dynamic): Dynamic => (items.push(input2), ""),
      );
    return items.length === 0
      ? input
      : items.join(`
`) +
          `
` +
          value;
  }
  bindRuntimeValue(
    runtime,
    "stripStylesheetComments",
    () => stripStylesheetComments,
  );
  bindRuntimeValue(runtime, "findCssUrlEnd", () => findCssUrlEnd);
  bindRuntimeValue(
    runtime,
    "inlineStylesheetImports",
    () => inlineStylesheetImports,
  );
  bindRuntimeValue(
    runtime,
    "PreviewCssRewritingTest",
    () => PreviewCssRewritingTest,
    (value) => {
      PreviewCssRewritingTest = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isStandaloneStylesheet",
    () => isStandaloneStylesheet,
  );
  bindRuntimeValue(
    runtime,
    "PreviewCssRewritingImportCharsetPattern",
    () => PreviewCssRewritingImportCharsetPattern,
    (value) => {
      PreviewCssRewritingImportCharsetPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "leadingStylesheetAtRuleEnd",
    () => leadingStylesheetAtRuleEnd,
  );
  bindRuntimeValue(
    runtime,
    "PreviewCssRewritingReplace",
    () => PreviewCssRewritingReplace,
    (value) => {
      PreviewCssRewritingReplace = value;
    },
  );
  bindRuntimeValue(runtime, "moveCssImportsFirst", () => moveCssImportsFirst);
  return () => {
    PreviewCssRewritingTest = (input?: Dynamic): Dynamic =>
      /(?:url\(\s*|@import\s*)["']?\/(?!\/)/i.test(
        stripStylesheetComments(input),
      );
    PreviewCssRewritingImportCharsetPattern =
      /(?:@import\s*(?:url\(\s*(?:"[^"]*"|'[^']*'|[^\s)]*)\s*\)|"[^"]*"|'[^']*')[^;{]*|@charset\s*"[^"]*"|@layer\b[^;{]*)(?:;|$)/iy;
    PreviewCssRewritingReplace = (input?: Dynamic): Dynamic =>
      input.replace(/<(?=\s*(?:\/\s*)?noscript)/gi, "\\3c ");
  };
}
