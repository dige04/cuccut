/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPreviewHtmlScanner(
  runtime: RuntimeBindings,
): () => void {
  var PreviewHtmlScannerImportPattern: Dynamic;
  var PreviewHtmlScannerPattern: Dynamic;
  var htmlTagSelfClosing: Dynamic;
  var PreviewHtmlScannerPattern_2: Dynamic;
  var PreviewHtmlScannerScriptStyleTextareaValues: Dynamic;
  var PreviewHtmlScannerSubscribers: Dynamic;
  function parseHtmlAttributes(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = false,
  ): Dynamic {
    let state: Dynamic = {},
      value: Dynamic = input.search(/[\s/>]/);
    if (value < 0) return state;
    PreviewHtmlScannerPattern.lastIndex = value;
    for (
      let value2: Dynamic = PreviewHtmlScannerPattern.exec(input);
      value2 !== null;
      value2 = PreviewHtmlScannerPattern.exec(input)
    ) {
      let value3: Dynamic = value2[1].toLowerCase();
      value3 !== "/" &&
        !options.includes(value3) &&
        !(context && value3 in state) &&
        (state[value3] = (0, runtime.decodeHtmlAttributeEntities)(
          value2[2] ?? value2[3] ?? value2[4] ?? "",
        ));
    }
    return state;
  }
  function getHtmlAttribute(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = input.search(/[\s/>]/);
    if (value < 0) return null;
    PreviewHtmlScannerPattern.lastIndex = value;
    for (
      let value2: Dynamic = PreviewHtmlScannerPattern.exec(input);
      value2 !== null;
      value2 = PreviewHtmlScannerPattern.exec(input)
    )
      if (value2[1].toLowerCase() === options)
        return (0, runtime.decodeHtmlAttributeEntities)(
          value2[2] ?? value2[3] ?? value2[4] ?? "",
        );
    return null;
  }
  function scanHtmlTagEnd(items?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = options,
      length: Dynamic = items.length;
    for (htmlTagSelfClosing = false; value < length; ) {
      let value2: Dynamic = items.charCodeAt(value);
      if (value2 === 62) return value;
      htmlTagSelfClosing = value2 === 47;
      if (value2 === 61) {
        for (
          htmlTagSelfClosing = false, value++;
          value < length && items.charCodeAt(value) <= 32;

        )
          value++;
        value2 = items.charCodeAt(value);
        if (value2 === 34 || value2 === 39) {
          let value3: Dynamic = items.indexOf(
            String.fromCharCode(value2),
            value + 1,
          );
          if (value3 < 0) return -1;
          value = value3 + 1;
        } else
          for (
            ;
            value < length &&
            items.charCodeAt(value) > 32 &&
            items.charCodeAt(value) !== 62;

          )
            value++;
        continue;
      }
      value++;
    }
    return -1;
  }
  function scanHtmlTags(
    items?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let items2: Dynamic = [],
      value: Dynamic = items.replace(
        /[A-Z]+/g,
        (input?: Dynamic): Dynamic => input.toLowerCase(),
      ),
      index: Dynamic = 0,
      index2: Dynamic = 0,
      index3: Dynamic = 0;
    for (;;) {
      let value2: Dynamic = items.indexOf("<", index);
      if (value2 < 0) break;
      if (items.startsWith("<\!--", value2)) {
        let value9: Dynamic;
        if (items.startsWith(">", value2 + 4)) value9 = value2 + 5;
        else if (items.startsWith("->", value2 + 4)) value9 = value2 + 6;
        else {
          PreviewHtmlScannerPattern_2.lastIndex = value2 + 4;
          let value10: Dynamic = PreviewHtmlScannerPattern_2.exec(items);
          value9 =
            value10 === null ? items.length : value10.index + value10[0].length;
        }
        context?.push([value2, value9]);
        index = value9;
        continue;
      }
      let value3: Dynamic = value.charCodeAt(value2 + 1),
        value4: Dynamic = value3 >= 97 && value3 <= 122;
      if (value3 === 33 || value3 === 63) {
        let value9: Dynamic = items.indexOf(">", value2 + 2);
        if (value9 < 0) break;
        items2.push({
          name: "",
          start: value2,
          end: value9 + 1,
        });
        index = value9 + 1;
        continue;
      }
      let value5: Dynamic =
        value3 === 47 &&
        value.charCodeAt(value2 + 2) >= 97 &&
        value.charCodeAt(value2 + 2) <= 122;
      if (!value4 && !value5) {
        index = value2 + 1;
        continue;
      }
      let value6: Dynamic = value2 + (value5 ? 2 : 1);
      for (
        let value9: Dynamic = value.charCodeAt(value6);
        (value9 >= 97 && value9 <= 122) ||
        (value9 >= 48 && value9 <= 57) ||
        value9 === 45;
        value9 = value.charCodeAt(++value6)
      );
      let value7: Dynamic = value.slice(value2 + (value5 ? 2 : 1), value6),
        value8: Dynamic = scanHtmlTagEnd(items, value6);
      if (value8 < 0) break;
      items2.push({
        name: value5 ? "" : value7,
        start: value2,
        end: value8 + 1,
      });
      index = value8 + 1;
      value7 === "svg" && !(!value5 && htmlTagSelfClosing)
        ? (index2 = Math.max(0, index2 + (value5 ? -1 : 1)))
        : value7 === "math" && !(!value5 && htmlTagSelfClosing)
          ? (index3 = Math.max(0, index3 + (value5 ? -1 : 1)))
          : !value5 &&
            index2 + index3 > 0 &&
            PreviewHtmlScannerSubscribers.has(value7) &&
            (index2 = index3 = 0);
      if (
        !value5 &&
        PreviewHtmlScannerScriptStyleTextareaValues.includes(value7) &&
        index2 + index3 === 0
      ) {
        let value9: Dynamic = index;
        for (;;) {
          value9 = value.indexOf("</" + value7, value9);
          if (value9 < 0) {
            value9 = items.length;
            break;
          }
          let value10: Dynamic = value.charCodeAt(value9 + 2 + value7.length);
          if (
            value10 === 62 ||
            value10 === 47 ||
            value10 === 32 ||
            (value10 >= 9 && value10 <= 13) ||
            Number.isNaN(value10)
          )
            break;
          value9 += 2;
        }
        options?.push([index, value9]);
        index = value9;
      }
    }
    return items2;
  }
  function findHtmlTags(input?: Dynamic, options?: Dynamic): Dynamic {
    return scanHtmlTags(input)
      .filter((input2?: Dynamic): Dynamic => input2.name === options)
      .map((input2?: Dynamic): Dynamic => [input2.start, input2.end]);
  }
  function maskHtmlRawContent(input?: Dynamic, options: Dynamic = {}): Dynamic {
    let items: Dynamic = [],
      items2: Dynamic = [];
    scanHtmlTags(input, items, items2);
    let value: Dynamic = (
        options.bodies === "keep" ? items2 : items2.concat(items)
      ).sort(
        (input2?: Dynamic, options2?: Dynamic): Dynamic =>
          input2[0] - options2[0],
      ),
      text: Dynamic = "",
      index: Dynamic = 0;
    for (let [value2, value3] of value as Dynamic)
      value2 < index ||
        ((text += input.slice(index, value2) + " ".repeat(value3 - value2)),
        (index = value3));
    return text + input.slice(index);
  }
  bindRuntimeValue(
    runtime,
    "PreviewHtmlScannerImportPattern",
    () => PreviewHtmlScannerImportPattern,
    (value) => {
      PreviewHtmlScannerImportPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewHtmlScannerPattern",
    () => PreviewHtmlScannerPattern,
    (value) => {
      PreviewHtmlScannerPattern = value;
    },
  );
  bindRuntimeValue(runtime, "parseHtmlAttributes", () => parseHtmlAttributes);
  bindRuntimeValue(runtime, "getHtmlAttribute", () => getHtmlAttribute);
  bindRuntimeValue(
    runtime,
    "htmlTagSelfClosing",
    () => htmlTagSelfClosing,
    (value) => {
      htmlTagSelfClosing = value;
    },
  );
  bindRuntimeValue(runtime, "scanHtmlTagEnd", () => scanHtmlTagEnd);
  bindRuntimeValue(
    runtime,
    "PreviewHtmlScannerPattern_2",
    () => PreviewHtmlScannerPattern_2,
    (value) => {
      PreviewHtmlScannerPattern_2 = value;
    },
  );
  bindRuntimeValue(runtime, "scanHtmlTags", () => scanHtmlTags);
  bindRuntimeValue(runtime, "findHtmlTags", () => findHtmlTags);
  bindRuntimeValue(
    runtime,
    "PreviewHtmlScannerScriptStyleTextareaValues",
    () => PreviewHtmlScannerScriptStyleTextareaValues,
    (value) => {
      PreviewHtmlScannerScriptStyleTextareaValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewHtmlScannerSubscribers",
    () => PreviewHtmlScannerSubscribers,
    (value) => {
      PreviewHtmlScannerSubscribers = value;
    },
  );
  bindRuntimeValue(runtime, "maskHtmlRawContent", () => maskHtmlRawContent);
  return () => {
    PreviewHtmlScannerImportPattern =
      /@import\s*(?:url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]*))\s*\)|"([^"]*)"|'([^']*)')\s*((?:[^\s;{][^;{]*)?)(?:;|$)/gi;
    PreviewHtmlScannerPattern =
      /([^\s"'=<>\/\x60]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    htmlTagSelfClosing = false;
    PreviewHtmlScannerPattern_2 = /--!?>/g;
    PreviewHtmlScannerScriptStyleTextareaValues = [
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
    PreviewHtmlScannerSubscribers = new Set(
      "b big blockquote body br center code dd div dl dt em embed h1 h2 h3 h4 h5 h6 head hr i img li listing menu meta nobr ol p pre ruby s small span strong strike sub sup table tt u ul var font".split(
        " ",
      ),
    );
  };
}
