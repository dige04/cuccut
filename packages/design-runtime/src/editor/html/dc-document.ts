/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorHtmlDcDocument(
  runtime: RuntimeBindings,
): () => void {
  var SupportJsValue: Dynamic;
  var HtmlDcDocumentXImportDcImportPattern: Dynamic;
  var TextXDcValue: Dynamic;
  var HtmlDcDocumentScriptBdataDcScriptPattern: Dynamic;
  var HtmlDcDocumentScriptStyleTextareaValues: Dynamic;
  var HtmlDcDocumentJoin: Dynamic;
  var HtmlDcDocumentLocalName: Dynamic;
  var HtmlDcDocumentNextSibling: Dynamic;
  var HtmlDcDocumentClosest: Dynamic;
  var HtmlDcDocumentItems: Dynamic;
  function isDcHtmlDocument(input?: Dynamic): Dynamic {
    return (
      /<script[^>]*\bsrc\s*=\s*["'](?:\.\/)?support\.js["']/i.test(input) &&
      /<x-dc[\s>]/i.test(input)
    );
  }
  function expandSelfClosingImports(input?: Dynamic): Dynamic {
    return input.replace(
      HtmlDcDocumentXImportDcImportPattern,
      (input2?: Dynamic, options?: Dynamic, context?: Dynamic): Dynamic =>
        `<${options}${context}></${options}>`,
    );
  }
  function normalizeDcScriptType(input?: Dynamic): Dynamic {
    let value: Dynamic = parseDcHtmlDocument(input);
    if (!value?.jsMatch) return input;
    let index: Dynamic = value.jsMatch.index,
      value2: Dynamic = index + 7,
      value3: Dynamic = findHtmlTagEnd(input, index);
    if (
      index < value.templateEnd ||
      value3 === -1 ||
      !/[\s/]/.test(input[value2] ?? "")
    )
      return input;
    let value4: Dynamic = input
      .slice(value2, value3)
      .replace(/"[^"]*"|'[^']*'/g, '""');
    return /\stype\s*=/i.test(value4)
      ? input
      : input.slice(0, value2) +
          ` type="${TextXDcValue}"` +
          input.slice(value2);
  }
  function artboardComponentName(input?: Dynamic): Dynamic {
    return (input.split("/").pop() || input).replace(/\.dc\.html$/, "");
  }
  function findHtmlTagEnd(items?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = null;
    for (let value2: Dynamic = options; value2 < items.length; value2++) {
      let value3: Dynamic = items[value2];
      if (value) value3 === value && (value = null);
      else if (value3 === '"' || value3 === "'") value = value3;
      else if (value3 === ">") return value2;
    }
    return -1;
  }
  function findDcScriptStart(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = -1;
    for (let value7 of input.matchAll(/<script/gi) as Dynamic)
      value = value7.index;
    let value2: Dynamic = value < options ? -1 : findHtmlTagEnd(input, value),
      value3: Dynamic = input.search(/data-dc-script/i);
    if (
      value2 === -1 ||
      input.indexOf(">", value) !== value2 ||
      value3 < value ||
      value3 > value2 ||
      !/\sdata-dc-script[\s=/>]/i.test(input.slice(value, value2 + 1)) ||
      !/<\/script>/i.test(input.slice(value2)) ||
      input.lastIndexOf("<\!--", value) > input.lastIndexOf("-->", value)
    )
      return null;
    let value4: Dynamic = new RegExp(
      HtmlDcDocumentScriptBdataDcScriptPattern.source,
      "iy",
    );
    value4.lastIndex = value;
    let value5: Dynamic = value4.exec(input),
      value6: Dynamic = input.slice(value + (value5?.[0].length ?? 0));
    return value5 && /^\s*(<\/body\s*>\s*)?(<\/html\s*>\s*)?$/i.test(value6)
      ? value5
      : null;
  }
  function isSourceOffsetCompatible(input?: Dynamic): Dynamic {
    if (
      /<plaintext[\s/>]/i.test(input) ||
      Object.keys(runtime.HtmlTagNormalizationSelectTableTbodyConfig).some(
        (input2?: Dynamic): Dynamic =>
          new RegExp("<" + input2 + "[\\s/>]", "i").test(input),
      )
    )
      return false;
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
      input.match(new RegExp(input2 + "[\\s/>]", "gi"))?.length ?? 0;
    return HtmlDcDocumentScriptStyleTextareaValues.every(
      (input2?: Dynamic): Dynamic =>
        callback("<" + input2) === callback("</" + input2),
    );
  }
  function sameDcScriptContent(input?: Dynamic, options?: Dynamic): Dynamic {
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
        input2.replace(
          /\r\n?/g,
          `
`,
        ),
      nextElementSibling: Dynamic = input.nextElementSibling;
    return (
      HtmlDcDocumentLocalName(nextElementSibling) &&
      callback(nextElementSibling.textContent ?? "") === callback(options[1])
    );
  }
  function verifyTemplateOffset(
    input?: Dynamic,
    doc?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = input.toLowerCase(),
      value2: Dynamic = [
        "x-dc-offset-mark",
        "x-dc-offset-mark-a",
        "x-dc-offset-mark-b",
      ].find((input2?: Dynamic): Dynamic => !value.includes(input2));
    if (value2 === undefined) return false;
    let value3: Dynamic = input,
      value4: Dynamic = context
        .map(
          (input2?: Dynamic, options?: Dynamic): Dynamic => ({
            at: input2.at,
            i: options,
          }),
        )
        .sort(
          (input2?: Dynamic, options?: Dynamic): Dynamic =>
            options.at - input2.at,
        );
    for (let value6 of value4 as Dynamic)
      value3 =
        value3.slice(0, value6.at) +
        "<" +
        value2 +
        ' data-n="' +
        value6.i +
        '"></' +
        value2 +
        ">" +
        value3.slice(value6.at);
    let value5: Dynamic = new DOMParser().parseFromString(value3, "text/html");
    if (
      !context.every((input2?: Dynamic, options?: Dynamic): Dynamic => {
        let value6: Dynamic = value5.querySelectorAll(
          value2 + '[data-n="' + options + '"]',
        );
        return value6.length === 1 && input2.holds(value6[0]);
      })
    )
      return false;
    for (let value6 of value5.querySelectorAll(value2) as Dynamic)
      value6.remove();
    value5.normalize();
    doc.normalize();
    return value5.documentElement.outerHTML === doc.documentElement.outerHTML;
  }
  function validateSourceOffset(
    input?: Dynamic,
    options?: Dynamic,
    items?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    if (typeof DOMParser === "undefined" || typeof document === "undefined")
      return false;
    let value2: Dynamic = HtmlDcDocumentItems.findIndex(
        (input2?: Dynamic): Dynamic => input2.src === input,
      ),
      value3: Dynamic =
        value2 === -1
          ? {
              src: input,
              ok: value4(),
            }
          : HtmlDcDocumentItems.splice(value2, 1)[0];
    HtmlDcDocumentItems.unshift(value3);
    HtmlDcDocumentItems.length = Math.min(HtmlDcDocumentItems.length, 8);
    return value3.ok;
    function value4(): Dynamic {
      let callback: Dynamic = (input2?: Dynamic): Dynamic =>
          new DOMParser().parseFromString(input2, "text/html"),
        value5: Dynamic = callback(input),
        items2: Dynamic = [...value5.querySelectorAll("x-dc")],
        value6: Dynamic = extra
          ? [
              ...callback(
                input.slice(0, value.index) +
                  `</x-dc>
` +
                  input.slice(value.index),
              ).querySelectorAll("x-dc"),
            ]
          : items2;
      if (
        items2.length !== 1 ||
        value6.length !== 1 ||
        !sameDcScriptContent(value6[0], value)
      )
        return false;
      let value7: Dynamic = (document as Dynamic).createElement("template");
      value7.innerHTML = (0, runtime.toParserHtml)(items);
      let items3: Dynamic = [...value6[0].querySelectorAll("*")];
      if (
        HtmlDcDocumentJoin(value7.content.querySelectorAll("*")) !==
        HtmlDcDocumentJoin(items3)
      )
        return false;
      if (extra) {
        let items4: Dynamic = [...items2[0].querySelectorAll("*")];
        if (
          !HtmlDcDocumentLocalName(items4.at(-1)) ||
          HtmlDcDocumentJoin(items4.slice(0, -1)) !== HtmlDcDocumentJoin(items3)
        )
          return false;
      }
      let state: Dynamic = {
          at: options,
          holds: (input2?: Dynamic): Dynamic =>
            input2.parentElement?.localName === "x-dc" &&
            input2.previousSibling === null,
        },
        value8: Dynamic = extra
          ? [
              {
                at: value.index,
                holds: (input2?: Dynamic): Dynamic =>
                  !!input2.closest("x-dc") && HtmlDcDocumentNextSibling(input2),
              },
            ]
          : [
              {
                at: options + items.length,
                holds: HtmlDcDocumentClosest,
              },
              {
                at: value.index,
                holds: (input2?: Dynamic): Dynamic =>
                  HtmlDcDocumentNextSibling(input2) &&
                  input2.previousElementSibling?.localName === "x-dc",
              },
            ];
      return verifyTemplateOffset(input, value5, [state, ...value8]);
    }
  }
  function parseDcHtmlDocument(input?: Dynamic): Dynamic {
    let value: Dynamic = input.search(/<x-dc[\s>]/i);
    if (value === -1) return null;
    let value2: Dynamic = findHtmlTagEnd(input, value);
    if (value2 === -1) return null;
    let value3: Dynamic = value2 + 1,
      value4: Dynamic = input.lastIndexOf("</x-dc>"),
      callback: Dynamic = (): Dynamic => {
        if (value4 < value2) return null;
        let value13: Dynamic = new RegExp(
          HtmlDcDocumentScriptBdataDcScriptPattern.source,
          "i",
        ).exec(input);
        return {
          template: input.slice(value3, value4),
          templateStart: value3,
          templateEnd: value4,
          unclosed: false,
          js: value13 ? value13[1] : "",
          jsMatch: value13,
        };
      },
      value5: Dynamic =
        value4 < value2 || /<script/i.test(input.slice(value2, value4))
          ? findDcScriptStart(input, value2)
          : null;
    if (!value5 || (value4 >= value2 && value4 < value5.index))
      return callback();
    let value6: Dynamic = input.slice(value2, value5.index),
      value7: Dynamic = value6.lastIndexOf("</x-dc>");
    if (value7 !== -1) {
      let value13: Dynamic = input.slice(value3, value2 + value7);
      return !(value6.match(/<\/x-dc[\s/>]/gi)?.length === 1) ||
        !validateSourceOffset(input, value3, value13, value5, false)
        ? callback()
        : {
            template: value13,
            templateStart: value3,
            templateEnd: value2 + value7,
            unclosed: false,
            js: value5[1],
            jsMatch: value5,
          };
    }
    let value8: Dynamic = input
        .slice(0, value5.index)
        .match(/<x-dc[\s/>]/gi)?.length,
      value9: Dynamic =
        input.lastIndexOf("<\!--", value) > input.lastIndexOf("-->", value),
      value10: Dynamic = /<\/head[\s/>]|<body[\s/>]|<\/x-dc[\s/>]/i.test(
        value6,
      ),
      value11: Dynamic =
        value8 !== 1 || value9 || value10 || !isSourceOffsetCompatible(value6),
      value12: Dynamic = input.slice(value3, value5.index);
    return value11 ||
      !validateSourceOffset(input, value3, value12, value5, true)
      ? callback()
      : {
          template: value12,
          templateStart: value3,
          templateEnd: value5.index,
          unclosed: true,
          js: value5[1],
          jsMatch: value5,
        };
  }
  function sameDcTemplate(input?: Dynamic, options?: Dynamic): Dynamic {
    if (input === options) return true;
    if (options === undefined) return false;
    let value: Dynamic = parseDcHtmlDocument(input),
      value2: Dynamic = parseDcHtmlDocument(options);
    return (
      value != null &&
      value2 != null &&
      value.template === value2.template &&
      value.js === value2.js
    );
  }
  function replaceDcTemplate(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return options.unclosed && context === options.template
      ? input
      : input.slice(0, options.templateStart) +
          context +
          (options.unclosed
            ? `</x-dc>
`
            : "") +
          input.slice(options.templateEnd);
  }
  bindRuntimeValue(
    runtime,
    "SupportJsValue",
    () => SupportJsValue,
    (value) => {
      SupportJsValue = value;
    },
  );
  bindRuntimeValue(runtime, "isDcHtmlDocument", () => isDcHtmlDocument);
  bindRuntimeValue(
    runtime,
    "HtmlDcDocumentXImportDcImportPattern",
    () => HtmlDcDocumentXImportDcImportPattern,
    (value) => {
      HtmlDcDocumentXImportDcImportPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "expandSelfClosingImports",
    () => expandSelfClosingImports,
  );
  bindRuntimeValue(
    runtime,
    "TextXDcValue",
    () => TextXDcValue,
    (value) => {
      TextXDcValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeDcScriptType",
    () => normalizeDcScriptType,
  );
  bindRuntimeValue(
    runtime,
    "artboardComponentName",
    () => artboardComponentName,
  );
  bindRuntimeValue(runtime, "findHtmlTagEnd", () => findHtmlTagEnd);
  bindRuntimeValue(
    runtime,
    "HtmlDcDocumentScriptBdataDcScriptPattern",
    () => HtmlDcDocumentScriptBdataDcScriptPattern,
    (value) => {
      HtmlDcDocumentScriptBdataDcScriptPattern = value;
    },
  );
  bindRuntimeValue(runtime, "findDcScriptStart", () => findDcScriptStart);
  bindRuntimeValue(
    runtime,
    "HtmlDcDocumentScriptStyleTextareaValues",
    () => HtmlDcDocumentScriptStyleTextareaValues,
    (value) => {
      HtmlDcDocumentScriptStyleTextareaValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isSourceOffsetCompatible",
    () => isSourceOffsetCompatible,
  );
  bindRuntimeValue(
    runtime,
    "HtmlDcDocumentJoin",
    () => HtmlDcDocumentJoin,
    (value) => {
      HtmlDcDocumentJoin = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HtmlDcDocumentLocalName",
    () => HtmlDcDocumentLocalName,
    (value) => {
      HtmlDcDocumentLocalName = value;
    },
  );
  bindRuntimeValue(runtime, "sameDcScriptContent", () => sameDcScriptContent);
  bindRuntimeValue(runtime, "verifyTemplateOffset", () => verifyTemplateOffset);
  bindRuntimeValue(
    runtime,
    "HtmlDcDocumentNextSibling",
    () => HtmlDcDocumentNextSibling,
    (value) => {
      HtmlDcDocumentNextSibling = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HtmlDcDocumentClosest",
    () => HtmlDcDocumentClosest,
    (value) => {
      HtmlDcDocumentClosest = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HtmlDcDocumentItems",
    () => HtmlDcDocumentItems,
    (value) => {
      HtmlDcDocumentItems = value;
    },
  );
  bindRuntimeValue(runtime, "validateSourceOffset", () => validateSourceOffset);
  bindRuntimeValue(runtime, "parseDcHtmlDocument", () => parseDcHtmlDocument);
  bindRuntimeValue(runtime, "sameDcTemplate", () => sameDcTemplate);
  bindRuntimeValue(runtime, "replaceDcTemplate", () => replaceDcTemplate);
  return () => {
    SupportJsValue = "support.js";
    HtmlDcDocumentXImportDcImportPattern =
      /<(x-import|dc-import)((?:[^>"']|"[^"]*"|'[^']*')*)\/>/gi;
    TextXDcValue = "text/x-dc";
    HtmlDcDocumentScriptBdataDcScriptPattern =
      /<script[^>]*\bdata-dc-script\b[^>]*>([\s\S]*?)<\/script>/;
    HtmlDcDocumentScriptStyleTextareaValues = [
      "script",
      "style",
      "textarea",
      "title",
      "xmp",
      "iframe",
      "noembed",
      "noframes",
      "noscript",
    ];
    HtmlDcDocumentJoin = (input?: Dynamic): Dynamic =>
      [...input]
        .map(
          (input2?: Dynamic): Dynamic =>
            runtime.HtmlTagNormalizationFromEntriesValue[input2.localName] ??
            (input2.localName === "sc-helmet" ? "helmet" : input2.localName),
        )
        .join(" ");
    HtmlDcDocumentLocalName = (input?: Dynamic): Dynamic =>
      input?.nodeType === 1 &&
      input.localName === "script" &&
      input.hasAttribute("data-dc-script");
    HtmlDcDocumentNextSibling = (input?: Dynamic): Dynamic =>
      HtmlDcDocumentLocalName(input.nextSibling);
    HtmlDcDocumentClosest = (input?: Dynamic): Dynamic => {
      let ancestor: Dynamic = input.closest("x-dc");
      for (
        let value: Dynamic = input;
        value && value !== ancestor;
        value = value.parentNode
      )
        for (
          let nextSibling: Dynamic = value.nextSibling;
          nextSibling;
          nextSibling = nextSibling.nextSibling
        )
          if (
            nextSibling.nodeType !== 3 ||
            (nextSibling.textContent ?? "").trim() !== ""
          )
            return false;
      return !!ancestor;
    };
    HtmlDcDocumentItems = [];
  };
}
