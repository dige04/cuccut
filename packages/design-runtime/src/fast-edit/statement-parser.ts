/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installFastEditStatementParser(
  runtime: RuntimeBindings,
): () => void {
  var splitCssPropertyValue: Dynamic;
  var joinCssDeclarations: Dynamic;
  var PAGE_STYLE_PROPERTY_ALIASES: Dynamic;
  var BLOCK_LAYOUT_ELEMENT_TAGS: Dynamic;
  var OWNED_ELEMENT_ID_PREFIX: Dynamic;
  var OWNED_ELEMENT_ID_PATTERN: Dynamic;
  var PARTIAL_INSERTION_METHODS: Dynamic;
  var READONLY_JQUERY_CHAIN_METHODS: Dynamic;
  var TARGET_JQUERY_INSERTION_METHODS: Dynamic;
  var HTML_INSERTION_METHODS: Dynamic;
  var isOutsideArtboardSelector: Dynamic;
  function parseScopedTemplate(html?: Dynamic): Dynamic {
    let template: Dynamic = (document as Dynamic).createElement("template");
    template.innerHTML = (0, runtime.toParserHtml)(html);
    return template;
  }
  function mapFastEditCssChanges(
    before?: Dynamic,
    after?: Dynamic,
    prefix?: Dynamic,
    families?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let changes: Dynamic = [];
    try {
      let callback: Dynamic = (input?: Dynamic): Dynamic =>
          (0, runtime.camelToKebabCss)(
            input.slice(0, Math.max(0, input.indexOf(":"))).trim(),
          ).toLowerCase(),
        callback2: Dynamic = (input?: Dynamic): Dynamic =>
          (0, runtime.splitCssDeclarations_2)(
            input?.getAttribute("style") ?? "",
          ),
        callback3: Dynamic = (
          input?: Dynamic,
          options2?: Dynamic,
          context?: Dynamic,
        ): Dynamic =>
          input === "100%" ||
          input === options2 ||
          (input !== undefined &&
            /^\d+(\.\d+)?px$/.test(input) &&
            parseFloat(input) >= context),
        callback4: Dynamic = (input?: Dynamic): Dynamic => {
          let entries: Dynamic = new Map(
            callback2(input).map(
              (input2?: Dynamic): Dynamic => [
                callback(input2),
                splitCssPropertyValue(input2)[1].toLowerCase(),
              ],
            ),
          );
          return (
            ![
              "max-width",
              "max-height",
              "max-inline-size",
              "max-block-size",
              "inline-size",
              "block-size",
            ].some((input2?: Dynamic): Dynamic => entries.has(input2)) &&
            callback3(entries.get("width"), "100vw", options.w) &&
            (callback3(entries.get("height"), "100vh", options.h) ||
              callback3(entries.get("min-height"), "100vh", options.h))
          );
        },
        callback5: Dynamic = (input?: Dynamic, options2?: Dynamic): Dynamic => {
          let callback7: Dynamic = (input2?: Dynamic): Dynamic =>
              PAGE_STYLE_PROPERTY_ALIASES.background.includes(callback(input2)),
            callback8: Dynamic = (input2?: Dynamic): Dynamic =>
              callback(input2) === "background" &&
              (0, runtime.validatePageColor)(
                splitCssPropertyValue(input2)[1],
              ) === null,
            value4: Dynamic = input.map(callback8).lastIndexOf(true),
            value5: Dynamic = input.map(
              (input2?: Dynamic): Dynamic =>
                callback7(input2) && !callback8(input2)
                  ? callback(input2) + ": " + options2
                  : input2,
            );
          value4 >= 0 &&
            !input.slice(value4 + 1).some(callback7) &&
            value5.splice(value4 + 1, 0, "background-color: " + options2);
          return value5;
        },
        callback6: Dynamic = (input?: Dynamic): Dynamic =>
          input.content.children.length === 1
            ? input.content.children[0]
            : undefined,
        value: Dynamic = parseScopedTemplate(after),
        value2: Dynamic = callback6(value),
        value3: Dynamic = callback6(parseScopedTemplate(before));
      if (
        value2 === undefined ||
        !(
          callback4(value2) ||
          (BLOCK_LAYOUT_ELEMENT_TAGS.has(value2.localName) &&
            !callback2(value2).some(
              (input?: Dynamic): Dynamic =>
                PAGE_STYLE_PROPERTY_ALIASES.background.includes(
                  callback(input),
                ),
            ))
        )
      )
        return {
          text: after,
          own: changes,
        };
      let flag: Dynamic = false;
      for (let value4 of ["background", "color", "font"] as Dynamic) {
        let value5: Dynamic = prefix[value4],
          callback7: Dynamic = (input?: Dynamic): Dynamic =>
            PAGE_STYLE_PROPERTY_ALIASES[value4].includes(callback(input)),
          value6: Dynamic = callback2(value2),
          value7: Dynamic = value6.some(callback7);
        if (value5 !== undefined) {
          if (
            value6
              .filter(callback7)
              .map((input?: Dynamic): Dynamic => input.trim())
              .join(";") !==
            callback2(value3)
              .filter(callback7)
              .map((input?: Dynamic): Dynamic => input.trim())
              .join(";")
          ) {
            changes.push(value4);
            continue;
          }
          (!value7 && !families.includes(value4)) ||
            (value2.setAttribute(
              "style",
              joinCssDeclarations(
                value7
                  ? value4 === "background"
                    ? callback5(value6, value5)
                    : value6.map(
                        (input?: Dynamic): Dynamic =>
                          callback7(input)
                            ? callback(input) + ": " + value5
                            : input,
                      )
                  : [
                      ...value6,
                      PAGE_STYLE_PROPERTY_ALIASES[value4][0] + ": " + value5,
                    ],
              ),
            ),
            (flag = true));
        }
      }
      return {
        text: flag ? (0, runtime.fromParserHtml)(value.innerHTML) : after,
        own: changes,
      };
    } catch {
      return {
        text: after,
        own: [],
      };
    }
  }
  function collectOwnedElementIds(htmls?: Dynamic): Dynamic {
    let pattern: Dynamic = new RegExp(
      "(?<![\\w-])" + OWNED_ELEMENT_ID_PATTERN + "(?![\\w-])",
      "g",
    );
    return new Set(
      htmls.flatMap((input?: Dynamic): Dynamic => input.match(pattern) ?? []),
    );
  }
  function nextHandleSequence(htmls?: Dynamic, prefix?: Dynamic): Dynamic {
    let pattern: Dynamic = new RegExp("^" + prefix + "(\\d{1,6})$"),
      next: Dynamic = 0;
    for (let value of htmls as Dynamic) {
      let value2: Dynamic = (document as Dynamic).createElement("template");
      value2.innerHTML = (0, runtime.toParserHtml)(value);
      for (let value3 of Array.from(
        value2.content.querySelectorAll("[id]"),
      ) as Dynamic)
        next = Math.max(
          next,
          Number(pattern.exec(value3.getAttribute("id") ?? "")?.[1] ?? 0),
        );
    }
    return next;
  }
  function adoptHandleIds(
    html?: Dynamic,
    prefix?: Dynamic,
    sequence?: Dynamic,
    options?: Dynamic,
    reservedIds: Dynamic = new Set(),
  ): Dynamic {
    let availableOwnedId: Dynamic = (input?: Dynamic): Dynamic => {
        let value2: Dynamic = OWNED_ELEMENT_ID_PREFIX + input;
        for (let count: Dynamic = 2; reservedIds.has(value2); count++)
          value2 = OWNED_ELEMENT_ID_PREFIX + input + "_" + String(count);
        return value2;
      },
      htmlLength: Dynamic = html.length;
    if (!options) {
      let length: Dynamic = /\d{0,6}$/.exec(html)![0].length,
        value2: Dynamic = html.slice(0, htmlLength - length);
      for (let length2: Dynamic = prefix.length; length2 > 0; length2--)
        if (
          (length === 0 || length2 === prefix.length) &&
          value2.endsWith(prefix.slice(0, length2))
        ) {
          htmlLength -= length + length2;
          break;
        }
    }
    let values: Dynamic = new Set(),
      value: Dynamic = prefix + "(\\d{1,6})(?![A-Za-z0-9_-])",
      text: Dynamic = "",
      index: Dynamic = 0;
    for (let value2 of html.matchAll(
      new RegExp(
        `((?<![\\w-])[iI][dD]\\s*=\\s*\\\\?["'])` +
          value +
          `|(#|\\[\\s*[iI][dD]\\s*=\\s*\\\\?["']?)` +
          value,
        "g",
      ),
    ) as Dynamic) {
      let [value3, value4, value5, value6, value7]: Dynamic = value2;
      if (value2.index + value3.length > htmlLength) break;
      value4 !== undefined &&
        value5 !== undefined &&
        Number(value5) > sequence &&
        values.add(value5);
      text +=
        html.slice(index, value2.index) +
        (value4 !== undefined && value5 !== undefined
          ? Number(value5) > sequence
            ? value4 + availableOwnedId(value5)
            : value3
          : value6 !== undefined && value7 !== undefined && values.has(value7)
            ? value6 + availableOwnedId(value7)
            : value3);
      index = value2.index + value3.length;
    }
    return text + html.slice(index, htmlLength);
  }
  function isIncompleteInsertionStatement(
    text?: Dynamic,
    complete?: Dynamic,
  ): Dynamic {
    let lastDot: Dynamic = text.lastIndexOf("."),
      partialMethod: Dynamic = lastDot < 0 ? "" : text.slice(lastDot);
    return (
      !complete &&
      lastDot >= 0 &&
      PARTIAL_INSERTION_METHODS.some(
        (items?: Dynamic): Dynamic =>
          items.startsWith(partialMethod) ||
          (partialMethod.startsWith(items) &&
            /^\s*[`'"]?$/.test(partialMethod.slice(items.length))),
      )
        ? text.slice(0, lastDot)
        : text
    ).replace(
      /(\$\(\s*(?:'[^'<\n][^'\n]*'|"[^"<\n][^"\n]*"|`[^`<\n][^`\n]*`)\s*\))\.insert(After|Before)\((?=\s*[`'"]<)/g,
      (input?: Dynamic, options?: Dynamic, context?: Dynamic): Dynamic =>
        options + "." + context.toLowerCase() + "(",
    );
  }
  function parseAppendedArtboardSection(statement?: Dynamic): Dynamic {
    let sectionMatch: Dynamic =
      /^\s*<section((?:\s+[\w:-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*>/.exec(
        statement,
      );
    if (
      sectionMatch === null ||
      !/<\/section>\s*$/.test(statement) ||
      statement.split(/<section[\s>]/i).length !== 2 ||
      statement.split(/<\/section>/i).length !== 2
    )
      return null;
    let value: Dynamic = Array.from(
      sectionMatch[1].matchAll(
        /\s+([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g,
      ),
    )
      .filter((input?: Dynamic): Dynamic => input[1].toLowerCase() === "id")
      .map((input?: Dynamic): Dynamic => input[2] ?? input[3] ?? "");
    return value.length === 1 && /^[A-Za-z][\w-]*$/.test(value[0])
      ? value[0]
      : null;
  }
  function classifyFastEditStatement(
    statement?: Dynamic,
    complete?: Dynamic,
    target?: Dynamic,
    html?: Dynamic,
  ): Dynamic {
    let pendingResult: Dynamic = complete ? "aim" : "wait",
      classifyChain: Dynamic = (items?: Dynamic): Dynamic => {
        let value9: Dynamic = /^\s*\.([A-Za-z]*)/.exec(items);
        return value9 === null
          ? /^\s*$/.test(items)
            ? pendingResult
            : "aim"
          : value9[0].length === items.length
            ? pendingResult
            : items[value9[0].length] === "("
              ? {
                  name: value9[1],
                  to: value9[0].length + 1,
                }
              : "aim";
      },
      value: Dynamic = classifyChain(statement);
    if (typeof value == "string") return value;
    if (TARGET_JQUERY_INSERTION_METHODS.has(value.name)) return "leave";
    if (
      !READONLY_JQUERY_CHAIN_METHODS.has(value.name) &&
      !HTML_INSERTION_METHODS.has(value.name)
    )
      return "aim";
    let value2: Dynamic = statement.slice(value.to).replace(/^\s+/, ""),
      value3: Dynamic = value2[0];
    if (value3 === undefined) return pendingResult;
    if (HTML_INSERTION_METHODS.has(value.name)) {
      let value9: Dynamic =
        value3 === "`" || value3 === "'" || value3 === '"'
          ? value2.slice(1).replace(/^\s+/, "")
          : "x";
      return value9.length < 9 && "<section".startsWith(value9.slice(0, 8))
        ? pendingResult
        : /^<section[\s>]/.test(value9)
          ? "leave"
          : "aim";
    }
    let value4: Dynamic = null,
      value5: Dynamic = value2.slice(1);
    if (value3 !== ")") {
      if (value3 !== "`" && value3 !== "'" && value3 !== '"') return "aim";
      let count: Dynamic = 1;
      for (
        ;
        count < value2.length &&
        value2[count] !== value3 &&
        value2[count] !== "\\" &&
        value2[count] !==
          `
`;

      )
        count += 1;
      if (count === value2.length) return pendingResult;
      if (value2[count] !== value3) return "aim";
      let value9: Dynamic = value2.slice(count + 1).replace(/^\s+/, "");
      if (value9 === "") return pendingResult;
      if (value9[0] !== ")") return "aim";
      value4 = value2.slice(1, count).trim();
      value5 = value9.slice(1);
    }
    if (
      value4 !== null &&
      (isOutsideArtboardSelector(value4, target, html) ||
        (value.name === "children" &&
          (value4 === ":last-child" || value4 === ":last")))
    )
      return "leave";
    if (
      !(value.name === "children"
        ? value4 === null || value4 === "section"
        : value4 === "section" || value4 === "> section")
    )
      return "aim";
    let value6: Dynamic = classifyChain(value5);
    if (typeof value6 == "string") return value6;
    let value7: Dynamic = value5.indexOf(")", value6.to),
      value8: Dynamic = value5
        .slice(value6.to, value7 < 0 ? undefined : value7 + 1)
        .replace(/\s+/g, "");
    return value6.name !== "eq"
      ? value6.name !== "last"
        ? "aim"
        : value8 === ""
          ? pendingResult
          : value8[0] === ")"
            ? "leave"
            : "aim"
      : value8.length < 3 && "-1)".startsWith(value8)
        ? pendingResult
        : value8.startsWith("-1)")
          ? "leave"
          : "aim";
  }
  function rewriteContainerAppendStatements(
    reply?: Dynamic,
    target?: Dynamic,
    newline: Dynamic = `
`,
  ): Dynamic {
    let appendPattern: Dynamic =
        /^[ \t]*\$\(\s*(['"])#container\1\s*\)\s*\.append\(\s*/gm,
      replyLength: Dynamic = reply.length,
      rewritten: Dynamic = "",
      offset: Dynamic = 0;
    for (
      let value: Dynamic = appendPattern.exec(reply);
      value !== null;
      value = appendPattern.exec(reply)
    ) {
      let lastIndex: Dynamic = appendPattern.lastIndex,
        value2: Dynamic = reply[lastIndex] ?? "";
      if (value2 !== "`" && value2 !== "'" && value2 !== '"') continue;
      let value3: Dynamic = lastIndex + 1;
      for (
        ;
        value3 < replyLength &&
        reply[value3] !== value2 &&
        reply[value3] !== "\\" &&
        !(value2 === "`"
          ? reply[value3] === "$" && reply[value3 + 1] === "{"
          : reply[value3] ===
            `
`);

      )
        value3 += 1;
      appendPattern.lastIndex = value3;
      if (value3 >= replyLength) break;
      let value4: Dynamic =
          reply[value3] === value2
            ? /^\s*\)(\s*)\.(?!\d)/.exec(reply.slice(value3 + 1))
            : null,
        value5: Dynamic =
          value4 === null
            ? null
            : parseAppendedArtboardSection(reply.slice(lastIndex + 1, value3));
      if (value4 === null || value5 === null) continue;
      let value6: Dynamic = value3 + value4[0].length,
        value7: Dynamic = classifyFastEditStatement(
          reply.slice(value6),
          target,
          value5,
          reply.slice(lastIndex + 1, value3),
        );
      if (value7 === "wait") return rewritten + reply.slice(offset, value6);
      appendPattern.lastIndex = value6;
      value7 !== "leave" &&
        ((rewritten +=
          reply.slice(offset, value6) +
          (value4[1].includes(`
`)
            ? ""
            : newline) +
          "$('#" +
          value5 +
          "')"),
        (offset = value6));
    }
    return rewritten + reply.slice(offset);
  }
  function resolveOwnedElementIdCollisions(
    before?: Dynamic,
    after?: Dynamic,
    prefix?: Dynamic,
  ): Dynamic {
    if (!after.includes(' id="' + OWNED_ELEMENT_ID_PREFIX)) return after;
    let usedIds: Dynamic = collectOwnedElementIds([before]),
      replacements: Dynamic = new Map(
        Array.from(
          after.matchAll(
            new RegExp(' id="(' + OWNED_ELEMENT_ID_PATTERN + ')"', "g"),
          ),
          (input?: Dynamic): Dynamic => [input[2], input[1]],
        ).filter(
          ([, input]: Dynamic): Dynamic => !(prefix ?? usedIds).has(input),
        ),
      ),
      value: Dynamic = after.replace(
        /(?<![\w-])k(?:[a-z]{2})?(\d{1,6})(?![\w-])/g,
        (input?: Dynamic, options?: Dynamic): Dynamic =>
          replacements.get(options) ?? input,
      ),
      value2: Dynamic = (document as Dynamic).createElement("template");
    value2.innerHTML = (0, runtime.toParserHtml)(value);
    let callback: Dynamic = (input?: Dynamic): Dynamic =>
        (
          value.match(new RegExp("(?<![\\w-])" + input + "(?![\\w-])", "g")) ??
          []
        ).length,
      entries: Dynamic = new Map(),
      value3: Dynamic = new RegExp("^" + OWNED_ELEMENT_ID_PATTERN + "$"),
      callback2: Dynamic = (input?: Dynamic): Dynamic => {
        for (let value4 of Array.from(input.querySelectorAll("*")) as Dynamic) {
          let value5: Dynamic = value4.getAttribute("id") ?? "";
          value3.test(value5) &&
            entries.set(value5, [...(entries.get(value5) ?? []), value4]);
          let content: Dynamic = value4.content;
          content !== undefined && callback2(content);
        }
      };
    callback2(value2.content);
    let flag: Dynamic = false;
    for (let [value4, value5] of entries as Dynamic)
      if (!usedIds.has(value4) && callback(value4) <= value5.length) {
        for (let value6 of value5 as Dynamic) value6.removeAttribute("id");
        flag = true;
      }
    return flag ? (0, runtime.fromParserHtml)(value2.innerHTML) : value;
  }
  bindRuntimeValue(runtime, "parseScopedTemplate", () => parseScopedTemplate);
  bindRuntimeValue(
    runtime,
    "splitCssPropertyValue",
    () => splitCssPropertyValue,
    (value) => {
      splitCssPropertyValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "joinCssDeclarations",
    () => joinCssDeclarations,
    (value) => {
      joinCssDeclarations = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PAGE_STYLE_PROPERTY_ALIASES",
    () => PAGE_STYLE_PROPERTY_ALIASES,
    (value) => {
      PAGE_STYLE_PROPERTY_ALIASES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BLOCK_LAYOUT_ELEMENT_TAGS",
    () => BLOCK_LAYOUT_ELEMENT_TAGS,
    (value) => {
      BLOCK_LAYOUT_ELEMENT_TAGS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "mapFastEditCssChanges",
    () => mapFastEditCssChanges,
  );
  bindRuntimeValue(
    runtime,
    "OWNED_ELEMENT_ID_PREFIX",
    () => OWNED_ELEMENT_ID_PREFIX,
    (value) => {
      OWNED_ELEMENT_ID_PREFIX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OWNED_ELEMENT_ID_PATTERN",
    () => OWNED_ELEMENT_ID_PATTERN,
    (value) => {
      OWNED_ELEMENT_ID_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "collectOwnedElementIds",
    () => collectOwnedElementIds,
  );
  bindRuntimeValue(runtime, "nextHandleSequence", () => nextHandleSequence);
  bindRuntimeValue(runtime, "adoptHandleIds", () => adoptHandleIds);
  bindRuntimeValue(
    runtime,
    "PARTIAL_INSERTION_METHODS",
    () => PARTIAL_INSERTION_METHODS,
    (value) => {
      PARTIAL_INSERTION_METHODS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isIncompleteInsertionStatement",
    () => isIncompleteInsertionStatement,
  );
  bindRuntimeValue(
    runtime,
    "parseAppendedArtboardSection",
    () => parseAppendedArtboardSection,
  );
  bindRuntimeValue(
    runtime,
    "READONLY_JQUERY_CHAIN_METHODS",
    () => READONLY_JQUERY_CHAIN_METHODS,
    (value) => {
      READONLY_JQUERY_CHAIN_METHODS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TARGET_JQUERY_INSERTION_METHODS",
    () => TARGET_JQUERY_INSERTION_METHODS,
    (value) => {
      TARGET_JQUERY_INSERTION_METHODS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HTML_INSERTION_METHODS",
    () => HTML_INSERTION_METHODS,
    (value) => {
      HTML_INSERTION_METHODS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isOutsideArtboardSelector",
    () => isOutsideArtboardSelector,
    (value) => {
      isOutsideArtboardSelector = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "classifyFastEditStatement",
    () => classifyFastEditStatement,
  );
  bindRuntimeValue(
    runtime,
    "rewriteContainerAppendStatements",
    () => rewriteContainerAppendStatements,
  );
  bindRuntimeValue(
    runtime,
    "resolveOwnedElementIdCollisions",
    () => resolveOwnedElementIdCollisions,
  );
  return () => {
    splitCssPropertyValue = (input?: Dynamic): Dynamic => {
      let value: Dynamic = input.indexOf(":");
      return value < 0
        ? ["", input.trim()]
        : [
            input.slice(0, value).trim().toLowerCase(),
            input.slice(value + 1).trim(),
          ];
    };
    joinCssDeclarations = (input?: Dynamic): Dynamic =>
      input
        .map((input2?: Dynamic): Dynamic => input2.trim())
        .filter((input2?: Dynamic): Dynamic => input2 !== "")
        .join("; ");
    PAGE_STYLE_PROPERTY_ALIASES = {
      background: ["background", "background-color"],
      color: ["color"],
      font: ["font-family"],
    };
    BLOCK_LAYOUT_ELEMENT_TAGS = new Set([
      "div",
      "section",
      "main",
      "article",
      "header",
      "footer",
      "aside",
      "nav",
    ]);
    OWNED_ELEMENT_ID_PREFIX = "own";
    OWNED_ELEMENT_ID_PATTERN =
      OWNED_ELEMENT_ID_PREFIX + "(\\d{1,6})(?:_\\d{1,6})?";
    PARTIAL_INSERTION_METHODS = [".insertAfter(", ".insertBefore("];
    READONLY_JQUERY_CHAIN_METHODS = new Set(["find", "children"]);
    TARGET_JQUERY_INSERTION_METHODS = new Set([
      "appendTo",
      "prependTo",
      "insertAfter",
      "insertBefore",
      "replaceAll",
    ]);
    HTML_INSERTION_METHODS = new Set(["append", "prepend", "after", "before"]);
    isOutsideArtboardSelector = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
    ): Dynamic => {
      let values: Dynamic = new Set(
        Array.from(
          context.matchAll(
            /\sid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi,
          ),
          (input2?: Dynamic): Dynamic =>
            input2[1] ?? input2[2] ?? input2[3] ?? "",
        ),
      );
      return (
        !/[[\]()"']/.test(input) &&
        input.split(",").every((input2?: Dynamic): Dynamic => {
          let value: Dynamic = /^#([A-Za-z][\w-]*)/.exec(input2.trim())?.[1];
          return (
            value !== undefined && (value === options || !values.has(value))
          );
        })
      );
    };
  };
}
