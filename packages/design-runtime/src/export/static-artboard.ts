/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installExportStaticArtboard(
  runtime: RuntimeBindings,
): () => void {
  var exportNonRenderedTags: Dynamic;
  var exportSafeContentSelector: Dynamic;
  var cssIdentifierTokenPattern: Dynamic;
  var unsafeCssPropertyPattern: Dynamic;
  var cssWhitespacePattern: Dynamic;
  var rootCssSelectorPattern: Dynamic;
  var cssCustomPropertyNamePattern: Dynamic;
  var cssCustomPropertyDeclarationPattern: Dynamic;
  var cssCustomPropertyReferencePattern: Dynamic;
  var exportMetadataTagPattern: Dynamic;
  var staticCssDeclarationAtRulePattern: Dynamic;
  var dynamicCssMutationPattern: Dynamic;
  var interpolatedCssPropertyPattern: Dynamic;
  var externalExportAssetPattern: Dynamic;
  var cssAssetUuidPattern: Dynamic;
  var unresolvedCssKeywordPattern: Dynamic;
  var cssVariablePrefixBoundaryPattern: Dynamic;
  var cssVariableSuffixBoundaryPattern: Dynamic;
  var staticTemplateExpressionPattern: Dynamic;
  var staticExportAttribute: Dynamic;
  var forbiddenStaticExportTagPattern: Dynamic;
  var dynamicStaticExportAttributePattern: Dynamic;
  var staticExportIdSuffix: Dynamic;
  var exportSvgNamespace: Dynamic;
  var exportHtmlNamespace: Dynamic;
  var staticTemplateLiteralKeywords: Dynamic;
  var maxStaticExportTemplateLength: Dynamic;
  var importantVisibleCssPattern: Dynamic;
  var dynamicStaticExportTagPattern: Dynamic;
  function removeUnsafeCssDeclarations(css?: Dynamic): Dynamic {
    let text: Dynamic = "",
      index: Dynamic = 0,
      index2: Dynamic = 0,
      flag: Dynamic = true,
      length: Dynamic = css.length;
    for (; index < length; ) {
      if (flag) {
        let value2: Dynamic = index;
        for (; value2 < length && cssWhitespacePattern.test(css[value2]); )
          value2++;
        if (css[value2] === "/" && css[value2 + 1] === "*") {
          let value4: Dynamic = css.indexOf("*/", value2 + 2),
            value5: Dynamic = value4 < 0 ? length : value4 + 2;
          text += css.slice(index, value5);
          index = value5;
          continue;
        }
        flag = false;
        cssIdentifierTokenPattern.lastIndex = value2;
        let value3: Dynamic = cssIdentifierTokenPattern.exec(css);
        if (value3) {
          let value4: Dynamic = value2 + value3[0].length;
          for (;;) {
            for (; value4 < length && cssWhitespacePattern.test(css[value4]); )
              value4++;
            if (css[value4] !== "/" || css[value4 + 1] !== "*") break;
            let value5: Dynamic = css.indexOf("*/", value4 + 2);
            value4 = value5 < 0 ? length : value5 + 2;
          }
          if (css[value4] === ":") {
            let value5: Dynamic = (0, runtime.camelToKebabCss)(value3[0]);
            text +=
              css.slice(index, value2) +
              (unsafeCssPropertyPattern.test(value5) ? value3[0] : value5);
            index = value2 + value3[0].length;
            continue;
          }
        }
      }
      let value: Dynamic = css[index];
      if (value === '"' || value === "'") {
        let value2: Dynamic = index + 1;
        for (; value2 < length && css[value2] !== value; )
          value2 += css[value2] === "\\" ? 2 : 1;
        text += css.slice(index, value2 + 1);
        index = value2 + 1;
        continue;
      }
      if (value === "/" && css[index + 1] === "*") {
        let value2: Dynamic = css.indexOf("*/", index + 2),
          value3: Dynamic = value2 < 0 ? length : value2 + 2;
        text += css.slice(index, value3);
        index = value3;
        continue;
      }
      if (value === "\\") {
        text += css.slice(index, index + 2);
        index += 2;
        continue;
      }
      value === "(" || value === "{" || value === "["
        ? index2++
        : value === ")" || value === "}" || value === "]"
          ? (index2 = Math.max(0, index2 - 1))
          : value === ";" && index2 === 0 && (flag = true);
      text += value;
      index++;
    }
    return text;
  }
  function parseExportTweakMetadata(json?: Dynamic): Dynamic {
    if (!json)
      return {
        props: null,
        preview: null,
      };
    let value: Dynamic;
    try {
      value = JSON.parse(json);
    } catch {
      return {
        props: null,
        preview: null,
      };
    }
    if (!value || typeof value != "object" || Array.isArray(value))
      return {
        props: null,
        preview: null,
      };
    let value2: Dynamic = value,
      value3: Dynamic =
        value2.$preview && typeof value2.$preview == "object"
          ? value2.$preview
          : null,
      state: Dynamic = {};
    for (let value4 of Object.keys(value2) as Dynamic)
      value4[0] !== "$" && (state[value4] = value2[value4]);
    return {
      props: Object.keys(state).length ? state : null,
      preview: value3,
    };
  }
  function scanQuotedStringEnd(source?: Dynamic, start?: Dynamic): Dynamic {
    let value: Dynamic = source[start];
    for (let value2: Dynamic = start + 1; value2 < source.length; value2++)
      if (source[value2] === "\\") value2++;
      else if (source[value2] === value) return value2;
    return source.length;
  }
  function splitCssRuleBlocks(css?: Dynamic): Dynamic {
    let items: Dynamic = [],
      index: Dynamic = 0;
    for (; index < css.length; ) {
      let value: Dynamic = -1;
      for (let value4: Dynamic = index; value4 < css.length; value4++) {
        let value5: Dynamic = css[value4];
        if (value5 === '"' || value5 === "'")
          value4 = scanQuotedStringEnd(css, value4);
        else if (value5 === "{") {
          value = value4;
          break;
        }
      }
      if (value < 0) break;
      let value2: Dynamic = css
          .slice(index, value)
          .replace(/^(\s*@[^;{}]*;)+/, ""),
        count: Dynamic = 1,
        value3: Dynamic = value + 1;
      for (; value3 < css.length && count > 0; value3++) {
        let value4: Dynamic = css[value3];
        value4 === '"' || value4 === "'"
          ? (value3 = scanQuotedStringEnd(css, value3))
          : value4 === "{"
            ? count++
            : value4 === "}" && count--;
      }
      items.push({
        selector: value2.trim(),
        body: css.slice(value + 1, count === 0 ? value3 - 1 : value3),
        clean: count === 0 && !value2.includes(";"),
      });
      index = value3;
    }
    return items;
  }
  function splitCssDeclarations(declarations?: Dynamic): Dynamic {
    let items: Dynamic = [],
      index: Dynamic = 0,
      index2: Dynamic = 0,
      text: Dynamic = "",
      flag: Dynamic = false,
      callback: Dynamic = (input?: Dynamic): Dynamic => {
        let value: Dynamic = declarations.slice(index, input),
          value2: Dynamic = value.indexOf(":");
        value2 > 0 &&
          items.push({
            name: value.slice(0, value2).trim(),
            value: value.slice(value2 + 1).trim(),
            balanced: index2 === 0 && text === "" && !flag,
          });
      };
    for (let index3: Dynamic = 0; index3 < declarations.length; index3++) {
      let value: Dynamic = declarations[index3];
      text !== ""
        ? value === "\\"
          ? index3++
          : value === text && (text = "")
        : value === '"' || value === "'"
          ? (text = value)
          : value === "(" || value === "["
            ? index2++
            : value === ")" || value === "]"
              ? index2 === 0
                ? (flag = true)
                : index2--
              : value === ";" &&
                index2 === 0 &&
                (callback(index3), (index = index3 + 1), (flag = false));
    }
    callback(declarations.length);
    return items;
  }
  function collectStaticRootCssVariables(
    document2?: Dynamic,
    additionalCss?: Dynamic,
  ): Dynamic {
    let entries: Dynamic = new Map(),
      values: Dynamic = new Set(),
      callback: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic => {
        !cssCustomPropertyNamePattern.test(input) ||
        options === "" ||
        unresolvedCssKeywordPattern.test(options) ||
        /!\s*important\s*$/i.test(options) ||
        (entries.has(input) && entries.get(input) !== options)
          ? values.add(input)
          : entries.set(input, options);
      },
      callback2: Dynamic = (input?: Dynamic): Dynamic => {
        for (let value2 of input.matchAll(
          cssCustomPropertyDeclarationPattern,
        ) as Dynamic)
          values.add(value2[1]);
      },
      callback3: Dynamic = (input?: Dynamic): Dynamic => {
        for (let value2 of input.matchAll(
          cssCustomPropertyReferencePattern,
        ) as Dynamic)
          for (
            let value3: Dynamic = value2[0];
            value3.startsWith("--");
            value3 = value3.slice(1)
          )
            values.add(value3);
      },
      callback4: Dynamic = (input?: Dynamic): Dynamic => {
        for (let value2 of input as Dynamic)
          value2.name.startsWith("--") &&
            (value2.balanced
              ? callback(value2.name, value2.value)
              : values.add(value2.name));
      },
      callback5: Dynamic = (input?: Dynamic): Dynamic => {
        callback2(input);
        for (let value2 of (input.match(/@[^{};]*/g) ?? []) as Dynamic)
          callback3(value2);
      },
      value: Dynamic = additionalCss
        .filter((input?: Dynamic): Dynamic => input.mime === "text/html")
        .map(
          (input?: Dynamic): Dynamic =>
            new DOMParser().parseFromString(input.text, "text/html"),
        );
    if (
      hasUnresolvedExportDependencies(document2, true) ||
      value.some(
        (input?: Dynamic): Dynamic =>
          hasUnresolvedExportDependencies(input, false),
      )
    )
      return new Map();
    for (let value2 of additionalCss as Dynamic) {
      if (
        value2.mime === "text/css" &&
        hasNonGoogleFontsCssImports(
          value2.text.replace(/\/\*[\s\S]*?\*\//g, " "),
        )
      )
        return new Map();
      if (
        value2.mime !== "text/css" &&
        value2.mime !== "text/html" &&
        interpolatedCssPropertyPattern.test(value2.text)
      )
        return new Map();
    }
    for (let value2 of Array.from(
      document2.querySelectorAll("style"),
    ) as Dynamic) {
      let value3: Dynamic = (value2.textContent ?? "").replace(
          /\/\*[\s\S]*?\*\//g,
          " ",
        ),
        value4: Dynamic = (value2.getAttribute("media") ?? "")
          .trim()
          .toLowerCase(),
        value5: Dynamic = (value2.getAttribute("type") ?? "text/css")
          .trim()
          .toLowerCase();
      if (
        (value4 !== "" && value4 !== "all") ||
        value5 !== "text/css" ||
        value2.closest(
          "noscript, template, sc-if, sc-for, dc-import, x-import",
        ) !== null
      ) {
        callback5(value3);
        continue;
      }
      for (let value6 of splitCssRuleBlocks(value3) as Dynamic) {
        if (
          !value6.clean ||
          value6.selector.startsWith("@") ||
          !rootCssSelectorPattern.test(value6.selector) ||
          value6.body.includes("{")
        ) {
          value6.selector.startsWith("@") && callback3(value6.selector);
          staticCssDeclarationAtRulePattern.test(value6.selector) &&
            callback3(value6.body);
          callback5(value6.body);
          continue;
        }
        callback4(splitCssDeclarations(value6.body));
      }
    }
    let callback6: Dynamic = (doc?: Dynamic, options?: Dynamic): Dynamic => {
      for (let value2 of Array.from(doc.querySelectorAll("*")) as Dynamic)
        for (let value3 of Array.from(value2.attributes) as Dynamic)
          value3.name === "style" && options && value2 === doc.documentElement
            ? callback4(splitCssDeclarations(value3.value))
            : value3.name === "style"
              ? callback2(value3.value)
              : callback3(value3.name + " " + value3.value);
      for (let value2 of Array.from(doc.querySelectorAll("script")) as Dynamic)
        callback3(value2.textContent ?? "");
      for (let value2 of Array.from(
        doc.querySelectorAll("template"),
      ) as Dynamic)
        callback3(value2.innerHTML);
    };
    callback6(document2, true);
    for (let value2 of value as Dynamic) {
      for (let value3 of Array.from(
        value2.querySelectorAll("style"),
      ) as Dynamic)
        callback5((value3.textContent ?? "").replace(/\/\*[\s\S]*?\*\//g, " "));
      callback6(value2, false);
    }
    for (let value2 of additionalCss as Dynamic)
      value2.mime === "text/css"
        ? callback5(value2.text)
        : value2.mime !== "text/html" && callback3(value2.text);
    for (let value2 of values as Dynamic) entries.delete(value2);
    for (let flag: Dynamic = true; flag; ) {
      flag = false;
      for (let [value2, value3] of entries as Dynamic)
        for (let value4 of value3.matchAll(/var\(\s*(--[\w-]+)/gi) as Dynamic)
          if (
            !entries.has(value4[1]) ||
            cssVariableReferencesProperty(entries, value4[1], value2)
          ) {
            entries.delete(value2);
            flag = true;
            break;
          }
    }
    return entries;
  }
  function isGoogleFontsCssUrl(url?: Dynamic): Dynamic {
    return /^https:\/\/fonts\.googleapis\.com\//i.test(url.trim());
  }
  function hasNonGoogleFontsCssImports(css?: Dynamic): Dynamic {
    return Array.from(
      css.matchAll(/@import\s*(?:url\()?\s*["']?([^"')\s;]+)/gi),
    ).some((input?: Dynamic): Dynamic => !isGoogleFontsCssUrl(input[1]));
  }
  function hasUnresolvedExportDependencies(
    document2?: Dynamic,
    files?: Dynamic,
  ): Dynamic {
    if (hasExternalExportStylesheets(document2)) return true;
    for (let value of Array.from(
      document2.querySelectorAll("x-import"),
    ) as Dynamic)
      for (let value2 of ["from", "src", "import"] as Dynamic)
        if (
          (value.getAttribute(value2) ?? "")
            .split(/\s+/)
            .some(
              (input?: Dynamic): Dynamic =>
                externalExportAssetPattern.test(input),
            )
        )
          return true;
    for (let value of Array.from(
      document2.querySelectorAll("script"),
    ) as Dynamic)
      if (value.hasAttribute("src")) {
        if (
          (files || value.closest("helmet, sc-helmet") !== null) &&
          !cssAssetUuidPattern.test(value.getAttribute("src") ?? "")
        )
          return true;
      } else if (dynamicCssMutationPattern.test(value.textContent ?? ""))
        return true;
    return false;
  }
  function hasExternalExportStylesheets(document2?: Dynamic): Dynamic {
    for (let value of Array.from(
      document2.querySelectorAll("link[href]"),
    ) as Dynamic)
      if (
        /\bstylesheet\b/i.test(value.getAttribute("rel") ?? "") &&
        !isGoogleFontsCssUrl(value.getAttribute("href") ?? "")
      )
        return true;
    return Array.from(document2.querySelectorAll("style")).some(
      (input?: Dynamic): Dynamic =>
        hasNonGoogleFontsCssImports(
          (input.textContent ?? "").replace(/\/\*[\s\S]*?\*\//g, " "),
        ),
    );
  }
  function cssVariableReferencesProperty(
    variables?: Dynamic,
    property?: Dynamic,
    target?: Dynamic,
    visited: Dynamic = new Set(),
  ): Dynamic {
    if (property === target) return true;
    if (visited.has(property)) return false;
    visited.add(property);
    for (let value of (variables.get(property) ?? "").matchAll(
      /var\(\s*(--[\w-]+)/gi,
    ) as Dynamic)
      if (cssVariableReferencesProperty(variables, value[1], target, visited))
        return true;
    return false;
  }
  function substituteStaticCssVariables(
    css?: Dynamic,
    variables?: Dynamic,
    depth: Dynamic = 0,
  ): Dynamic {
    if (depth > 8) return css;
    let text: Dynamic = "",
      index: Dynamic = 0;
    for (; index < css.length; ) {
      let value: Dynamic = css[index];
      if (value === "/" && css[index + 1] === "*") {
        let value7: Dynamic = css.indexOf("*/", index + 2),
          value8: Dynamic = value7 < 0 ? css.length : value7 + 2;
        text += css.slice(index, value8);
        index = value8;
        continue;
      }
      if (value === '"' || value === "'") {
        let value7: Dynamic = scanQuotedStringEnd(css, index);
        text += css.slice(index, value7 + 1);
        index = value7 + 1;
        continue;
      }
      if (/^url\(\s*[^"'\s)]/i.test(css.slice(index, index + 24))) {
        let value7: Dynamic = css.indexOf(")", index),
          value8: Dynamic = value7 < 0 ? css.length : value7 + 1;
        text += css.slice(index, value8);
        index = value8;
        continue;
      }
      if (
        css.slice(index, index + 4).toLowerCase() !== "var(" ||
        /[\w-]/.test(css[index - 1] ?? " ")
      ) {
        text += value;
        index++;
        continue;
      }
      let index2: Dynamic = 0,
        value2: Dynamic = index + 4;
      for (; value2 < css.length; value2++) {
        let value7: Dynamic = css[value2];
        if (value7 === "/" && css[value2 + 1] === "*") {
          let value8: Dynamic = css.indexOf("*/", value2 + 2);
          value2 = value8 < 0 ? css.length : value8 + 1;
        } else if (value7 === '"' || value7 === "'")
          value2 = scanQuotedStringEnd(css, value2);
        else if (value7 === "(") index2++;
        else if (value7 === ")") {
          if (index2 === 0) break;
          index2--;
        }
      }
      if (value2 >= css.length) {
        text += css.slice(index);
        break;
      }
      let value3: Dynamic = css.slice(index + 4, value2),
        value4: Dynamic = value3.indexOf(","),
        value5: Dynamic = (
          value4 < 0 ? value3 : value3.slice(0, value4)
        ).trim(),
        entry: Dynamic = variables.get(value5),
        value6: Dynamic =
          cssVariablePrefixBoundaryPattern.test(css[index - 1] ?? "") &&
          cssVariableSuffixBoundaryPattern.test(css[value2 + 1] ?? "");
      text +=
        entry === undefined || !value6
          ? css.slice(index, value2 + 1)
          : substituteStaticCssVariables(entry, variables, depth + 1);
      index = value2 + 1;
    }
    return text;
  }
  function escapeStaticExportStyleTag(css?: Dynamic): Dynamic {
    return css.replace(/<\/(style)/gi, "<\\/$1");
  }
  function collectStaticExportTweakValues(document2?: Dynamic): Dynamic {
    let element: Dynamic = document2.querySelector("script[data-dc-script]"),
      { props: value }: Dynamic = parseExportTweakMetadata(
        element?.getAttribute("data-props") ?? null,
      ),
      state: Dynamic = {};
    for (let [value2, value3] of Object.entries(value ?? {}) as Dynamic)
      value3 !== null &&
        typeof value3 == "object" &&
        value3.default !== undefined &&
        (state[value2] = value3.default);
    let values: Dynamic = new Set(
      Object.keys(state).filter(
        (input?: Dynamic): Dynamic => state[input] === null,
      ),
    );
    for (let value2 of mutatedRenderValueNames(
      element?.textContent ?? "",
      Object.keys(state),
      values,
    ) as Dynamic)
      delete state[value2];
    return state;
  }
  function mutatedRenderValueNames(
    source?: Dynamic,
    names?: Dynamic,
    values?: Dynamic,
  ): Dynamic {
    let values2: Dynamic = new Set();
    if (!/\brenderVals\b/.test(source)) return values2;
    let value: Dynamic = maskStaticTemplateJavaScript(source);
    if (value === null) return new Set(names);
    let callback: Dynamic = (input?: Dynamic): Dynamic =>
        /^(?:[-+*/%&|^]|\*\*|<<|>>>?|&&|\|\||\?\?)?=(?![=>])/.test(input) ||
        /^(?:\+\+|--|of\b|in\b)/.test(input),
      callback2: Dynamic = (input?: Dynamic): Dynamic =>
        /^(?:(?:\.[A-Za-z_$][\w$]*|\[[^\]]*\])+\s*(?:[-+*/%&|^]|\*\*|<<|>>>?|&&|\|\||\?\?)?=(?![=>])|(?:\.[A-Za-z_$][\w$]*|\[[^\]]*\])*\.(?:push|pop|shift|unshift|splice|sort|reverse|fill|copyWithin)\s*\()/.test(
          input,
        ),
      values3: Dynamic = new Set(["this.props"]);
    for (let value3 of value.matchAll(
      /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*this\.props\s*(?=[;,\n)]|$)/g,
    ) as Dynamic)
      (
        value.match(
          new RegExp(
            "(?<![\\w$.])" +
              value3[1].replace(/\$/g, "\\$") +
              "\\s*(?:[-+*/%&|^]|\\*\\*|<<|>>>?|&&|\\|\\||\\?\\?)?=(?![=>])",
            "g",
          ),
        ) ?? []
      ).length === 1 && values3.add(value3[1]);
    /[{,]\s*props\s*[},][^=]*=\s*this\b/.test(value) &&
      !/(?<![\w$.])props\s*=(?![=>])/.test(value) &&
      values3.add("props");
    if (
      Array.from(values3).some(
        (input?: Dynamic): Dynamic =>
          value.includes("Object.assign(" + input + ",") ||
          value.includes("Object.assign(" + input + ")") ||
          new RegExp(
            "\\bin\\s+" + input.replace(/[$.]/g, "\\$&") + "\\s*\\)",
          ).test(value),
      )
    )
      return new Set(names);
    let callback3: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic => {
        let value3: Dynamic =
          /^\(?\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\.([A-Za-z_$][\w$]*)\s*(\?\?\s*(?:'[\w$]*'|"[\w$]*"|``|\[[^\]A-Za-z_$]*\]|-?\d+(?:\.\d+)?|true|false|null|undefined)\s*)?\)?$/.exec(
            input.trim(),
          );
        return (
          value3 !== null &&
          value3[2] === options &&
          values3.has(value3[1]) &&
          !(value3[3] !== undefined && values.has(options))
        );
      },
      value2: Dynamic = /\b(?:const|let|var)$/,
      values4: Dynamic = new Set(
        Array.from(
          value.matchAll(
            /\b(?:const|let|var)\s*\{([^{}=]*)\}\s*=\s*([\w$.]+)/g,
          ),
        ).flatMap(
          (input?: Dynamic): Dynamic =>
            values3.has(input[2])
              ? input[1]
                  .split(",")
                  .map((input2?: Dynamic): Dynamic => input2.trim())
              : [],
        ),
      );
    for (let value3 of names as Dynamic) {
      if (!/^[A-Za-z_$][\w$]*$/.test(value3)) continue;
      let value4: Dynamic = new RegExp(
          "(?<![\\w$])" + value3.replace(/\$/g, "\\$") + "(?![\\w$])",
          "g",
        ),
        value5: Dynamic = values4.has(value3);
      Array.from(value.matchAll(value4)).some((input?: Dynamic): Dynamic => {
        let value6: Dynamic = value
            .slice(Math.max(0, input.index - 240), input.index)
            .trimEnd(),
          value7: Dynamic = value
            .slice(input.index + value3.length)
            .trimStart();
        if (/['"`]$/.test(value6)) {
          let value8: Dynamic = value7.slice(1).trimStart();
          return value8.startsWith(":")
            ? !callback3(
                value8.slice(1, scanJavaScriptExpressionEnd(value8, 1)),
                value3,
              )
            : value8.startsWith("]")
              ? callback(value8.slice(1).trimStart())
                ? true
                : !values3.has(
                    /[\w$.]*$/.exec(
                      value6.slice(0, -1).replace(/\s*\[\s*$/, ""),
                    )![0],
                  )
              : false;
        }
        if (callback(value7) || /(?:\+\+|--)$/.test(value6)) {
          let value8: Dynamic =
            /^=(?![=>])/.test(value7) && value2.test(value6)
              ? value7.slice(1)
              : null;
          return value8 === null ||
            !callback3(
              value8.slice(0, scanJavaScriptExpressionEnd(value8, 0)),
              value3,
            )
            ? true
            : ((value5 = true), false);
        }
        return /^(?:,[^=;{}]*)?[}\]]\s*=(?![=>])/.test(value7) &&
          !/\b(?:const|let|var)\s*[{[][^{}[\]]*$/.test(value6)
          ? true
          : value6.endsWith(".")
            ? !values3.has(/[\w$.]*$/.exec(value6.slice(0, -1))![0]) ||
              /\bdelete\s*[\w$.]*$/.test(value6) ||
              callback2(value7)
            : value7.startsWith(":")
              ? !callback3(
                  value7.slice(1, scanJavaScriptExpressionEnd(value7, 1)),
                  value3,
                )
              : !value5 || callback2(value7);
      }) && values2.add(value3);
    }
    return values2;
  }
  function maskStaticTemplateJavaScript(source?: Dynamic): Dynamic {
    let text: Dynamic = "";
    for (let index: Dynamic = 0; index < source.length; index++) {
      let value: Dynamic = source[index];
      if (value === "/" && source[index + 1] === "/") {
        let value2: Dynamic = source.indexOf(
          `
`,
          index,
        );
        index = value2 < 0 ? source.length : value2 - 1;
        text += " ";
      } else if (value === "/" && source[index + 1] === "*") {
        let value2: Dynamic = source.indexOf("*/", index + 2);
        if (value2 < 0) return null;
        index = value2 + 1;
        text += " ";
      } else if (
        value === "/" &&
        /(?:^|[(,=:[!&|?{};+\-*%<>~^]|\breturn|\btypeof|\bcase)\s*$/.test(text)
      ) {
        let value2: Dynamic = index + 1;
        for (
          let flag: Dynamic = false;
          value2 < source.length &&
          (flag || source[value2] !== "/") &&
          source[value2] !==
            `
`;
          value2++
        )
          source[value2] === "\\"
            ? value2++
            : source[value2] === "["
              ? (flag = true)
              : source[value2] === "]" && (flag = false);
        if (source[value2] !== "/") return null;
        text += "/ /";
        index = value2;
      } else if (value === '"' || value === "'" || value === "`") {
        let value2: Dynamic = scanQuotedStringEnd(source, index);
        if (value2 >= source.length) return null;
        let value3: Dynamic = source.slice(index + 1, value2);
        text +=
          value + (/^[A-Za-z_$][\w$]*$/.test(value3) ? value3 : "") + value;
        index = value2;
      } else
        value === "?" &&
        source[index + 1] === "." &&
        !/\d/.test(source[index + 2] ?? "")
          ? ((text += "."), index++)
          : (text += value);
    }
    return text;
  }
  function scanJavaScriptExpressionEnd(
    source?: Dynamic,
    start?: Dynamic,
  ): Dynamic {
    let index: Dynamic = 0;
    for (; start < source.length; start++) {
      let value: Dynamic = source[start];
      if (value === "(" || value === "[" || value === "{") index++;
      else if (value === ")" || value === "]" || value === "}") {
        if (index === 0) return start;
        index--;
      } else if ((value === "," || value === ";") && index === 0) return start;
    }
    return start;
  }
  function staticTemplateValueString(value?: Dynamic): Dynamic {
    return typeof value == "string" || typeof value == "number"
      ? String(value)
      : Array.isArray(value)
        ? value
            .filter(
              (input?: Dynamic): Dynamic =>
                typeof input == "string" || typeof input == "number",
            )
            .join("")
        : null;
  }
  function interpolateStaticExportTemplate(
    template?: Dynamic,
    values?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let index: Dynamic = 0,
      callback: Dynamic = (input?: Dynamic, options2?: Dynamic): Dynamic => {
        let value: Dynamic = Array.from(
          input
            .replace(/'[^']*'|"[^"]*"/g, "")
            .matchAll(/(?<![\w$.])[A-Za-z_$][\w$]*/g),
          (input2?: Dynamic): Dynamic => input2[0],
        ).filter(
          (input2?: Dynamic): Dynamic =>
            !staticTemplateLiteralKeywords.has(input2),
        );
        return value.every(
          (input2?: Dynamic): Dynamic =>
            Object.prototype.hasOwnProperty.call(options2, input2),
        )
          ? (value.length > 0 && index++, true)
          : false;
      },
      callback2: Dynamic = (input?: Dynamic, options2?: Dynamic): Dynamic => {
        let flag: Dynamic = true;
        for (let value of input.matchAll(
          staticTemplateExpressionPattern,
        ) as Dynamic)
          flag = callback(value[1], options2) && flag;
        return {
          v: (0, runtime.compileTemplateExpression)(input)(options2),
          known: flag,
        };
      },
      callback3: Dynamic = (
        input?: Dynamic,
        options2?: Dynamic,
        context?: Dynamic,
      ): Dynamic =>
        input.includes("{{")
          ? input
              .split(staticTemplateExpressionPattern)
              .flatMap((input2?: Dynamic, options3?: Dynamic): Dynamic => {
                if (!(options3 & 1))
                  return input2 === "" ? [] : [template.createTextNode(input2)];
                if (!callback(input2, options2))
                  return [template.createTextNode("{{" + input2 + "}}")];
                let value: Dynamic = staticTemplateValueString(
                  (0, runtime.evaluateTemplateExpression)(options2, input2),
                );
                if (value === null) return [];
                if (!context) return [template.createTextNode(value)];
                let value2: Dynamic = template.createElement("span");
                value2.setAttribute("class", "sc-interp");
                value2.textContent = value;
                return [value2];
              })
          : [template.createTextNode(input)],
      callback4: Dynamic = (input?: Dynamic, options2?: Dynamic): Dynamic =>
        Array.from(input.childNodes).flatMap(
          (input2?: Dynamic): Dynamic =>
            callback5(
              input2,
              options2,
              (input.namespaceURI ?? exportHtmlNamespace) ===
                exportHtmlNamespace && input.localName !== "textarea",
            ),
        ),
      callback5: Dynamic = (
        input?: Dynamic,
        options2?: Dynamic,
        context?: Dynamic,
      ): Dynamic => {
        if (input.nodeType === 3)
          return callback3(input.nodeValue ?? "", options2, context);
        if (input.nodeType !== 1) return [];
        let value: Dynamic = input,
          value2: Dynamic = value.localName.toLowerCase();
        if (
          forbiddenStaticExportTagPattern.test(value2) ||
          value.hasAttribute(staticExportAttribute)
        )
          return [];
        if (value2 === "sc-if") {
          let { v: value5, known: value6 }: Dynamic = callback2(
            value.getAttribute("value") ?? "",
            options2,
          );
          return (value6 ? value5 : value.hasAttribute("value"))
            ? callback4(value, options2)
            : [];
        }
        if (value2 === "sc-for") {
          let { v: value5, known: value6 }: Dynamic = callback2(
              value.getAttribute("list") ?? "",
              options2,
            ),
            value7: Dynamic = value.getAttribute("as") || "item";
          return !value6 || !Array.isArray(value5)
            ? callback4(value, options2)
            : value5.flatMap(
                (input2?: Dynamic, options3?: Dynamic): Dynamic =>
                  callback4(value, {
                    ...options2,
                    [value7]: input2,
                    $index: options3,
                  }),
              );
        }
        let value3: Dynamic =
            runtime.HtmlTagNormalizationFromEntriesValue[value2],
          value4: Dynamic =
            value3 === undefined
              ? value.cloneNode(false)
              : template.createElement(value3);
        for (let value5 of Array.from(value4.attributes) as Dynamic)
          value4.removeAttribute(value5.name);
        for (let { name: value5, value: value6 } of Array.from(
          value.attributes,
        ) as Dynamic) {
          let value7: Dynamic = value5.startsWith(runtime.ScCamelValue)
            ? (0, runtime.kebabToCamelCase)(
                value5.slice(runtime.ScCamelValue.length),
              )
            : value5;
          if (
            dynamicStaticExportAttributePattern.test(value7) ||
            (value2 === "x-import" && /^(from|src|import)$/.test(value7))
          )
            continue;
          let value8: Dynamic = value6;
          (value6.includes("{{") &&
            ((value8 = callback2(value6, options2).v),
            typeof value8 == "string" && value8.includes("<"))) ||
            (typeof value8 == "string" || typeof value8 == "number"
              ? value4.setAttribute(
                  value7,
                  value7 === "style"
                    ? removeUnsafeCssDeclarations(String(value8))
                    : String(value8),
                )
              : typeof value8 == "boolean" && /^(data-|aria-)/.test(value7)
                ? value4.setAttribute(value7, String(value8))
                : value8 === true && value4.setAttribute(value7, ""));
        }
        for (let value5 of callback4(value, options2) as Dynamic)
          value4.appendChild(value5);
        return [value4];
      },
      items: Dynamic = [];
    for (let value of Array.from(values.childNodes) as Dynamic) {
      if (value.nodeType === 3 && (value.nodeValue ?? "").trim() !== "")
        return null;
      items.push(...callback5(value, options, true));
    }
    return {
      nodes: items,
      resolved: index,
    };
  }
  function collectReferencedElementIds(element?: Dynamic): Dynamic {
    let items: Dynamic = [
        element,
        ...Array.from(element.querySelectorAll("*")),
      ],
      values: Dynamic = new Set();
    for (let value of items as Dynamic)
      for (let { name: value2, value: value3 } of Array.from(
        value.attributes,
      ) as Dynamic) {
        for (let value4 of value3.matchAll(
          /url\(\s*['"]?#([^'")\s]+)/g,
        ) as Dynamic)
          values.add(value4[1]);
        (value2 === "href" || value2 === "xlink:href") &&
          value3.startsWith("#") &&
          values.add(value3.slice(1));
      }
    let values2: Dynamic = new Set(
      items
        .filter(
          (element2?: Dynamic): Dynamic =>
            element2.namespaceURI === exportSvgNamespace &&
            values.has(element2.getAttribute("id") ?? ""),
        )
        .map((element2?: Dynamic): Dynamic => element2.getAttribute("id")),
    );
    if (values2.size !== 0)
      for (let value of items as Dynamic)
        for (let { name: value2, value: value3 } of Array.from(
          value.attributes,
        ) as Dynamic) {
          let value4: Dynamic = value3.replace(
            /url\(\s*(['"]?)#([^'")\s]+)\1\s*\)/g,
            (input?: Dynamic, options?: Dynamic, context?: Dynamic): Dynamic =>
              values2.has(context)
                ? "url(" +
                  options +
                  "#" +
                  context +
                  staticExportIdSuffix +
                  options +
                  ")"
                : input,
          );
          (value2 === "href" || value2 === "xlink:href") &&
            values2.has(value3.slice(1)) &&
            value3.startsWith("#") &&
            (value4 = value3 + staticExportIdSuffix);
          value2 === "id" &&
            value.namespaceURI === exportSvgNamespace &&
            values2.has(value3) &&
            (value4 = value3 + staticExportIdSuffix);
          value4 !== value3 && value.setAttribute(value2, value4);
        }
  }
  function hasImportantStaticVisibilityStyles(
    document2?: Dynamic,
    stage?: Dynamic,
  ): Dynamic {
    let value: Dynamic = Array.from(stage.children).filter(
      (input?: Dynamic): Dynamic => !input.hasAttribute(staticExportAttribute),
    );
    if (
      value.some(
        (element?: Dynamic): Dynamic =>
          importantVisibleCssPattern.test(element.getAttribute("style") ?? ""),
      )
    )
      return true;
    let callback: Dynamic = (input?: Dynamic): Dynamic =>
      splitCssRuleBlocks(input).some((input2?: Dynamic): Dynamic => {
        if (
          !importantVisibleCssPattern.test(input2.body) ||
          staticCssDeclarationAtRulePattern.test(input2.selector) ||
          /^@(-\w+-)?keyframes\b/i.test(input2.selector)
        )
          return false;
        if (input2.selector.startsWith("@")) return callback(input2.body);
        if (input2.body.includes("{")) return true;
        try {
          return value.some(
            (input3?: Dynamic): Dynamic => input3.matches(input2.selector),
          );
        } catch {
          return true;
        }
      });
    return Array.from(document2.querySelectorAll("style"))
      .filter(
        (input?: Dynamic): Dynamic =>
          input.closest("[" + staticExportAttribute + "]") === null,
      )
      .some(
        (input?: Dynamic): Dynamic =>
          callback((input.textContent ?? "").replace(/\/\*[\s\S]*?\*\//g, " ")),
      );
  }
  function buildStaticArtboardCopy(
    document2?: Dynamic,
    stage?: Dynamic,
  ): Dynamic {
    for (let value7 of Array.from(stage.children).filter(
      (input?: Dynamic): Dynamic => input.hasAttribute(staticExportAttribute),
    ) as Dynamic)
      value7.remove();
    if (!stage.innerHTML.includes("{{")) return null;
    let callback: Dynamic = (input?: Dynamic): Dynamic => (
        console.info(
          "[design/export] This export has no static copy of the board (tweak values filled in, for importers that run no script): " +
            input,
        ),
        null
      ),
      value: Dynamic = interpolateStaticExportTemplate(
        document2,
        stage,
        collectStaticExportTweakValues(document2),
      );
    if (value === null)
      return callback(
        "the board has text directly inside <x-dc>, outside any element; wrap that text in an element to include the copy",
      );
    if (value.resolved === 0) return null;
    let value2: Dynamic = value.nodes.filter(
      (input?: Dynamic): Dynamic => input.nodeType === 1,
    );
    if (value2.length === 0) return null;
    let value3: Dynamic, value4: Dynamic;
    if (
      value2.length === 1 &&
      value.nodes.every(
        (input?: Dynamic): Dynamic =>
          input === value2[0] || (input.nodeValue ?? "").trim() === "",
      )
    ) {
      value3 = value2[0];
      value4 = value.nodes;
    } else {
      value3 = document2.createElement("div");
      for (let value7 of value.nodes as Dynamic) value3.appendChild(value7);
      value4 = [value3];
    }
    collectReferencedElementIds(value3);
    let value5: Dynamic = document2.createElement("sc-if");
    value5.setAttribute(staticExportAttribute, "");
    value5.setAttribute("value", "{{ false }}");
    let value6: Dynamic = document2.createElement("style");
    value6.textContent =
      "x-dc>*{display:none!important}x-dc>[" +
      staticExportAttribute +
      "]{display:block!important}";
    value5.appendChild(value6);
    for (let value7 of value4 as Dynamic) value5.appendChild(value7);
    return value5.outerHTML.length > maxStaticExportTemplateLength
      ? callback("the copy would be over 512K characters, too large to include")
      : hasExternalExportStylesheets(document2)
        ? callback(
            "the page links or @imports a stylesheet the export cannot read, so it cannot tell whether the board would stay hidden behind the copy; inline or remove that stylesheet to include the copy",
          )
        : (stage.appendChild(value5),
          hasImportantStaticVisibilityStyles(document2, stage)
            ? (value5.remove(),
              callback(
                "one of the board's top-level elements has a display or all declaration marked !important (inline or in a stylesheet), which could show the board beside the copy; drop the !important to include the copy",
              ))
            : value3);
  }
  function prepareStaticArtboardExport(
    document2?: Dynamic,
    artboard?: Dynamic,
    additionalCss: Dynamic = [],
  ): Dynamic {
    let value: Dynamic = String(Math.max(1, Math.round(artboard.w))),
      value2: Dynamic = String(Math.max(1, Math.round(artboard.h))),
      value3: Dynamic = collectStaticRootCssVariables(document2, additionalCss);
    if (value3.size > 0) {
      for (let value10 of Array.from(
        document2.querySelectorAll("style"),
      ) as Dynamic) {
        let value11: Dynamic = value10.textContent ?? "";
        value11.includes("var(") &&
          (value10.textContent = escapeStaticExportStyleTag(
            substituteStaticCssVariables(value11, value3),
          ));
      }
      for (let value10 of Array.from(
        document2.querySelectorAll('[style*="var("]'),
      ) as Dynamic)
        value10.setAttribute(
          "style",
          substituteStaticCssVariables(
            value10.getAttribute("style") ?? "",
            value3,
          ),
        );
    }
    let element: Dynamic = document2.querySelector("x-dc");
    for (let value10 of Array.from(
      document2.querySelectorAll(
        '[data-canvas-width], [data-canvas-height], [data-document-role="page"]',
      ),
    ) as Dynamic)
      for (let value11 of [
        "data-canvas-width",
        "data-canvas-height",
        "data-document-role",
      ] as Dynamic)
        value10.removeAttribute(value11);
    for (let value10 of Array.from(
      document2.head.querySelectorAll('meta[name^="hz:"]'),
    ) as Dynamic)
      value10.remove();
    let value4: Dynamic =
        element === null
          ? []
          : Array.from(element.children).filter(
              (input?: Dynamic): Dynamic =>
                !exportMetadataTagPattern.test(input.tagName) &&
                !input.hasAttribute(staticExportAttribute),
            ),
      value5: Dynamic =
        value4.length === 1 &&
        !dynamicStaticExportTagPattern.test(value4[0].localName)
          ? value4[0]
          : document2.body;
    value5.setAttribute("data-canvas-width", value);
    value5.setAttribute("data-canvas-height", value2);
    let value6: Dynamic = null;
    if (
      element !== null &&
      additionalCss.some(
        (input?: Dynamic): Dynamic =>
          /javascript/i.test(input.mime) &&
          (0, runtime.isDesignRuntimeSource)(input.text),
      )
    )
      try {
        value6 = buildStaticArtboardCopy(document2, element);
      } catch {
        for (let value10 of Array.from(element.children).filter(
          (input?: Dynamic): Dynamic =>
            input.hasAttribute(staticExportAttribute),
        ) as Dynamic)
          value10.remove();
        console.warn(
          "[design/export] Building the static copy of the board for importers that run no script failed; exported without it",
        );
      }
    let value7: Dynamic =
        value6 !== null && value6.hasAttribute("data-canvas-width"),
      value8: Dynamic = value7 ? value6 : value5;
    value8.setAttribute("data-document-role", "page");
    let value9: Dynamic = artboard.label?.trim() ?? "";
    value9 !== "" &&
      (value8.getAttribute("data-label") ?? "").trim() === "" &&
      value8.setAttribute("data-label", value9);
    for (let [value10, value11] of [
      [
        "hz:slide-selector",
        value7 ? ":not(x-dc)>[data-canvas-width]" : "[data-canvas-width]",
      ],
      ["hz:canvas-width", value],
      ["hz:canvas-height", value2],
    ] as Dynamic) {
      let value12: Dynamic = document2.createElement("meta");
      value12.setAttribute("name", value10);
      value12.setAttribute("content", value11);
      document2.head.appendChild(value12);
    }
  }
  bindRuntimeValue(
    runtime,
    "exportNonRenderedTags",
    () => exportNonRenderedTags,
    (value) => {
      exportNonRenderedTags = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportSafeContentSelector",
    () => exportSafeContentSelector,
    (value) => {
      exportSafeContentSelector = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssIdentifierTokenPattern",
    () => cssIdentifierTokenPattern,
    (value) => {
      cssIdentifierTokenPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "unsafeCssPropertyPattern",
    () => unsafeCssPropertyPattern,
    (value) => {
      unsafeCssPropertyPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssWhitespacePattern",
    () => cssWhitespacePattern,
    (value) => {
      cssWhitespacePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "removeUnsafeCssDeclarations",
    () => removeUnsafeCssDeclarations,
  );
  bindRuntimeValue(
    runtime,
    "parseExportTweakMetadata",
    () => parseExportTweakMetadata,
  );
  bindRuntimeValue(
    runtime,
    "rootCssSelectorPattern",
    () => rootCssSelectorPattern,
    (value) => {
      rootCssSelectorPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssCustomPropertyNamePattern",
    () => cssCustomPropertyNamePattern,
    (value) => {
      cssCustomPropertyNamePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssCustomPropertyDeclarationPattern",
    () => cssCustomPropertyDeclarationPattern,
    (value) => {
      cssCustomPropertyDeclarationPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssCustomPropertyReferencePattern",
    () => cssCustomPropertyReferencePattern,
    (value) => {
      cssCustomPropertyReferencePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportMetadataTagPattern",
    () => exportMetadataTagPattern,
    (value) => {
      exportMetadataTagPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "staticCssDeclarationAtRulePattern",
    () => staticCssDeclarationAtRulePattern,
    (value) => {
      staticCssDeclarationAtRulePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "dynamicCssMutationPattern",
    () => dynamicCssMutationPattern,
    (value) => {
      dynamicCssMutationPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "interpolatedCssPropertyPattern",
    () => interpolatedCssPropertyPattern,
    (value) => {
      interpolatedCssPropertyPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "externalExportAssetPattern",
    () => externalExportAssetPattern,
    (value) => {
      externalExportAssetPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssAssetUuidPattern",
    () => cssAssetUuidPattern,
    (value) => {
      cssAssetUuidPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "unresolvedCssKeywordPattern",
    () => unresolvedCssKeywordPattern,
    (value) => {
      unresolvedCssKeywordPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssVariablePrefixBoundaryPattern",
    () => cssVariablePrefixBoundaryPattern,
    (value) => {
      cssVariablePrefixBoundaryPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssVariableSuffixBoundaryPattern",
    () => cssVariableSuffixBoundaryPattern,
    (value) => {
      cssVariableSuffixBoundaryPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "staticTemplateExpressionPattern",
    () => staticTemplateExpressionPattern,
    (value) => {
      staticTemplateExpressionPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "staticExportAttribute",
    () => staticExportAttribute,
    (value) => {
      staticExportAttribute = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "forbiddenStaticExportTagPattern",
    () => forbiddenStaticExportTagPattern,
    (value) => {
      forbiddenStaticExportTagPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "dynamicStaticExportAttributePattern",
    () => dynamicStaticExportAttributePattern,
    (value) => {
      dynamicStaticExportAttributePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "staticExportIdSuffix",
    () => staticExportIdSuffix,
    (value) => {
      staticExportIdSuffix = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportSvgNamespace",
    () => exportSvgNamespace,
    (value) => {
      exportSvgNamespace = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportHtmlNamespace",
    () => exportHtmlNamespace,
    (value) => {
      exportHtmlNamespace = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "staticTemplateLiteralKeywords",
    () => staticTemplateLiteralKeywords,
    (value) => {
      staticTemplateLiteralKeywords = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxStaticExportTemplateLength",
    () => maxStaticExportTemplateLength,
    (value) => {
      maxStaticExportTemplateLength = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "importantVisibleCssPattern",
    () => importantVisibleCssPattern,
    (value) => {
      importantVisibleCssPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "dynamicStaticExportTagPattern",
    () => dynamicStaticExportTagPattern,
    (value) => {
      dynamicStaticExportTagPattern = value;
    },
  );
  bindRuntimeValue(runtime, "scanQuotedStringEnd", () => scanQuotedStringEnd);
  bindRuntimeValue(runtime, "splitCssRuleBlocks", () => splitCssRuleBlocks);
  bindRuntimeValue(runtime, "splitCssDeclarations", () => splitCssDeclarations);
  bindRuntimeValue(
    runtime,
    "collectStaticRootCssVariables",
    () => collectStaticRootCssVariables,
  );
  bindRuntimeValue(runtime, "isGoogleFontsCssUrl", () => isGoogleFontsCssUrl);
  bindRuntimeValue(
    runtime,
    "hasNonGoogleFontsCssImports",
    () => hasNonGoogleFontsCssImports,
  );
  bindRuntimeValue(
    runtime,
    "hasUnresolvedExportDependencies",
    () => hasUnresolvedExportDependencies,
  );
  bindRuntimeValue(
    runtime,
    "hasExternalExportStylesheets",
    () => hasExternalExportStylesheets,
  );
  bindRuntimeValue(
    runtime,
    "cssVariableReferencesProperty",
    () => cssVariableReferencesProperty,
  );
  bindRuntimeValue(
    runtime,
    "substituteStaticCssVariables",
    () => substituteStaticCssVariables,
  );
  bindRuntimeValue(
    runtime,
    "escapeStaticExportStyleTag",
    () => escapeStaticExportStyleTag,
  );
  bindRuntimeValue(
    runtime,
    "collectStaticExportTweakValues",
    () => collectStaticExportTweakValues,
  );
  bindRuntimeValue(
    runtime,
    "mutatedRenderValueNames",
    () => mutatedRenderValueNames,
  );
  bindRuntimeValue(
    runtime,
    "maskStaticTemplateJavaScript",
    () => maskStaticTemplateJavaScript,
  );
  bindRuntimeValue(
    runtime,
    "scanJavaScriptExpressionEnd",
    () => scanJavaScriptExpressionEnd,
  );
  bindRuntimeValue(
    runtime,
    "staticTemplateValueString",
    () => staticTemplateValueString,
  );
  bindRuntimeValue(
    runtime,
    "interpolateStaticExportTemplate",
    () => interpolateStaticExportTemplate,
  );
  bindRuntimeValue(
    runtime,
    "collectReferencedElementIds",
    () => collectReferencedElementIds,
  );
  bindRuntimeValue(
    runtime,
    "hasImportantStaticVisibilityStyles",
    () => hasImportantStaticVisibilityStyles,
  );
  bindRuntimeValue(
    runtime,
    "buildStaticArtboardCopy",
    () => buildStaticArtboardCopy,
  );
  bindRuntimeValue(
    runtime,
    "prepareStaticArtboardExport",
    () => prepareStaticArtboardExport,
  );
  return () => {
    exportNonRenderedTags = new Set(
      "script style textarea option title select canvas iframe video audio".split(
        " ",
      ),
    );
    exportSafeContentSelector =
      ":not(" + [...runtime.HtmlTagNormalizationSubscribers].join(",") + ")";
    cssIdentifierTokenPattern = /-{0,2}[A-Za-z_][A-Za-z0-9_-]*/y;
    unsafeCssPropertyPattern = /^(?:behavior|-moz-binding)$/i;
    cssWhitespacePattern = /[ \t\n\r\f]/;
    rootCssSelectorPattern = /^\s*(?::root|html)(?:\s*,\s*(?::root|html))*\s*$/;
    cssCustomPropertyNamePattern = /^--[\w-]+$/;
    cssCustomPropertyDeclarationPattern = /(--[\w-]+)\s*:/g;
    cssCustomPropertyReferencePattern = /--[\w-]+/g;
    exportMetadataTagPattern =
      /^(helmet|sc-helmet|noscript|script|style|template|link|meta)$/i;
    staticCssDeclarationAtRulePattern =
      /^@(font-face|page|counter-style|font-palette-values|font-feature-values|property)\b/i;
    dynamicCssMutationPattern =
      /setProperty\((?!\s*(['"`])[\w-]+\1\s*[,)])|--[\w-]*(['"`])\s*\+|--[\w-]*\$\{|\.cssText\s*\+?=(?!=)/;
    interpolatedCssPropertyPattern = /--[\w-]*(['"`])\s*\+|--[\w-]*\$\{/;
    externalExportAssetPattern = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
    cssAssetUuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    unresolvedCssKeywordPattern =
      /^(initial|inherit|unset|revert|revert-layer)$/i;
    cssVariablePrefixBoundaryPattern = /^$|[\s,(:;{/]/;
    cssVariableSuffixBoundaryPattern = /^$|[\s,);}!/]/;
    staticTemplateExpressionPattern = /\{\{([\s\S]+?)\}\}/g;
    staticExportAttribute = "data-dc-static";
    forbiddenStaticExportTagPattern =
      /^(helmet|sc-helmet|script|style|noscript|template|link|meta|base|title|iframe|frame|object|embed|audio|video|xmp|noembed|noframes|plaintext)$/i;
    dynamicStaticExportAttributePattern =
      /^(on|style-|data-keyframes-|ref$|autofocus$)/i;
    staticExportIdSuffix = "-dc-static";
    exportSvgNamespace = "http://www.w3.org/2000/svg";
    exportHtmlNamespace = "http://www.w3.org/1999/xhtml";
    staticTemplateLiteralKeywords = new Set([
      "true",
      "false",
      "null",
      "undefined",
    ]);
    maxStaticExportTemplateLength = 512 * 1024;
    importantVisibleCssPattern =
      /(?<![\w-])(?:display\s*:(?!\s*none\b)|all\s*:)[^;{}]*!\s*important/i;
    dynamicStaticExportTagPattern = /^(sc-if|sc-for|dc-import|x-import)$/i;
  };
}
