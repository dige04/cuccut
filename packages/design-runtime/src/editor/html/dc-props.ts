/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorHtmlDcProps(runtime: RuntimeBindings): () => void {
  var HtmlDcPropsAmpLtGtConfig: Dynamic;
  var Value_3: Dynamic;
  var HtmlDcPropsItems: Dynamic;
  function decodeHtmlEntities(input?: Dynamic): Dynamic {
    return input.replace(
      /&(amp|lt|gt|quot|apos|#[0-9]+|#[xX][0-9a-fA-F]+);/g,
      (input2?: Dynamic, options?: Dynamic): Dynamic => {
        if (options[0] !== "#") return HtmlDcPropsAmpLtGtConfig[options];
        let value: Dynamic =
          options[1] === "x" || options[1] === "X"
            ? parseInt(options.slice(2), 16)
            : parseInt(options.slice(1), 10);
        return value >= 128 && value <= 159
          ? Value_3[value - 128]
          : value === 0 || value > 1114111 || (value >= 55296 && value <= 57343)
            ? "\uFFFD"
            : String.fromCodePoint(value);
      },
    );
  }
  function getDcPropsJson(input?: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.parseDcHtmlDocument)(input);
    if (!value?.jsMatch) return null;
    let value2: Dynamic = (0, runtime.findHtmlTagEnd)(
      input,
      value.jsMatch.index,
    );
    if (value2 === -1) return null;
    let value3: Dynamic = input.slice(value.jsMatch.index, value2),
      value4: Dynamic =
        /\bdata-props\s*=\s*"((?:[^"\\]|\\.)*)"/i.exec(value3) ??
        /\bdata-props\s*=\s*'((?:[^'\\]|\\.)*)'/i.exec(value3);
    return value4 ? decodeHtmlEntities(value4[1]) : null;
  }
  function setDcPropsJson(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.parseDcHtmlDocument)(input);
    if (!value) return null;
    let value2: Dynamic = options.trim()
      ? ` data-props="${(0, runtime.escapeHtmlAttributeValue)(options.trim())}"`
      : "";
    if (!value.jsMatch) {
      let value5: Dynamic = `<script type="${runtime.TextXDcValue}" data-dc-script${value2}><\/script>
`,
        value6: Dynamic = input.lastIndexOf("</body>");
      return value6 === -1
        ? input + value5
        : input.slice(0, value6) + value5 + input.slice(value6);
    }
    let index: Dynamic = value.jsMatch.index,
      value3: Dynamic = (0, runtime.findHtmlTagEnd)(input, index);
    if (value3 === -1) return null;
    let value4: Dynamic = input
      .slice(index, value3)
      .replace(/\s+data-props\s*=\s*"(?:[^"\\]|\\.)*"/i, "")
      .replace(/\s+data-props\s*=\s*'(?:[^'\\]|\\.)*'/i, "");
    return input.slice(0, index) + value4 + value2 + input.slice(value3);
  }
  function setDcScript(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (!options.jsMatch) {
      let value2: Dynamic = `<script type="${runtime.TextXDcValue}" data-dc-script>
${context}
<\/script>
`,
        value3: Dynamic = input.lastIndexOf("</body>");
      return value3 === -1
        ? input + value2
        : input.slice(0, value3) + value2 + input.slice(value3);
    }
    let jsMatch: Dynamic = options.jsMatch,
      value: Dynamic = jsMatch[0].slice(0, jsMatch[0].indexOf(">") + 1);
    return (
      input.slice(0, jsMatch.index) +
      value +
      context +
      "<\/script>" +
      input.slice(jsMatch.index + jsMatch[0].length)
    );
  }
  function findForbiddenTemplateTag(input?: Dynamic): Dynamic {
    for (let { re: value, label: value2 } of HtmlDcPropsItems as Dynamic)
      if (value.test(input)) return value2;
    return null;
  }
  bindRuntimeValue(
    runtime,
    "HtmlDcPropsAmpLtGtConfig",
    () => HtmlDcPropsAmpLtGtConfig,
    (value) => {
      HtmlDcPropsAmpLtGtConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "Value_3",
    () => Value_3,
    (value) => {
      Value_3 = value;
    },
  );
  bindRuntimeValue(runtime, "decodeHtmlEntities", () => decodeHtmlEntities);
  bindRuntimeValue(runtime, "getDcPropsJson", () => getDcPropsJson);
  bindRuntimeValue(runtime, "setDcPropsJson", () => setDcPropsJson);
  bindRuntimeValue(runtime, "setDcScript", () => setDcScript);
  bindRuntimeValue(
    runtime,
    "HtmlDcPropsItems",
    () => HtmlDcPropsItems,
    (value) => {
      HtmlDcPropsItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findForbiddenTemplateTag",
    () => findForbiddenTemplateTag,
  );
  return () => {
    HtmlDcPropsAmpLtGtConfig = {
      amp: "&",
      lt: "<",
      gt: ">",
      quot: '"',
      apos: "'",
    };
    Value_3 =
      "\u20AC\x81\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\x8D\u017D\x8F\x90\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\x9D\u017E\u0178";
    HtmlDcPropsItems = [
      {
        re: /<!doctype/i,
        label: "<!DOCTYPE",
      },
      {
        re: /<html[\s>]/i,
        label: "<html>",
      },
      {
        re: /<head[\s>]/i,
        label: "<head>",
      },
      {
        re: /<body[\s>]/i,
        label: "<body>",
      },
      {
        re: /<\/?x-dc[\s>]/i,
        label: "<x-dc>",
      },
      {
        re: /data-dc-script/i,
        label: "data-dc-script",
      },
    ];
  };
}
