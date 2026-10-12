/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorHtmlAuthoring(
  runtime: RuntimeBindings,
): () => void {
  var parseUtilityClassesValue: Dynamic;
  var HtmlAuthoringSubscribers: Dynamic;
  var DcTplAttribute: Dynamic;
  var HtmlAuthoringCss: Dynamic;
  var HtmlAuthoringSubscribers_2: Dynamic;
  var HtmlAuthoringTextTspanTextpathSet: Dynamic;
  var HtmlAuthoringFFFFDFFFDPattern: Dynamic;
  var HtmlAuthoringSubscribers_3: Dynamic;
  var HtmlAuthoringH1H2H3Set: Dynamic;
  var HtmlAuthoringTrTdThConfig: Dynamic;
  var HtmlAuthoringTableTheadTbodyConfig: Dynamic;
  var HtmlAuthoringSubscribers_4: Dynamic;
  var HtmlAuthoringLiDtDdSet: Dynamic;
  function stripLeadingCssAtRules(input?: Dynamic): Dynamic {
    let value: Dynamic = input.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
      value2: Dynamic =
        /^@(import|charset)\b(?:[^;{}"'(]|"[^"]*"|'[^']*'|\([^)]*\))*;\s*/i;
    for (
      let value3: Dynamic = value2.exec(value);
      value3;
      value3 = value2.exec(value)
    )
      value = value.slice(value3[0].length);
    return !/@(import|charset|namespace)\b/i.test(value);
  }
  function fromParserHtml(input?: Dynamic): Dynamic {
    input = input.replace(
      new RegExp("(\\s)" + runtime.ScCamelValue + "([a-z0-9-]+)(\\s*=)", "g"),
      (
        input2?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
        value?: Dynamic,
      ): Dynamic => options + (0, runtime.kebabToCamelCase)(context) + value,
    );
    input = input.replace(/<sc-helmet(\s|>)/gi, "<helmet$1");
    input = input.replace(/<\/sc-helmet\s*>/gi, "</helmet>");
    for (let [value, value2] of Object.entries(
      runtime.HtmlTagNormalizationFromEntriesValue,
    ) as Dynamic)
      input = input.replace(
        new RegExp("(</?)" + value + "(?=[\\s>])", "gi"),
        "$1" + value2,
      );
    return input;
  }
  function normalizeAuthoredHtml(input?: Dynamic): Dynamic {
    let value: Dynamic = (document as Dynamic).createElement("template");
    value.innerHTML = (0, runtime.toParserHtml)(input);
    return fromParserHtml(value.innerHTML);
  }
  function isInlineTextContainer(input?: Dynamic): Dynamic {
    if ((input.textContent ?? "").trim() === "") return false;
    for (let value of input.querySelectorAll("*") as Dynamic)
      if (
        !runtime.HtmlTagNormalizationSubscribers.has(
          value.tagName.toLowerCase(),
        )
      )
        return false;
    return true;
  }
  function isIconOnlyElement(input?: Dynamic): Dynamic {
    if (
      input.closest("pre, code") ||
      [...input.childNodes].some(
        (input2?: Dynamic): Dynamic =>
          input2.nodeType === 3 && (input2.nodeValue ?? "").trim() !== "",
      )
    )
      return false;
    let value: Dynamic = [...input.children].filter(
        (input2?: Dynamic): Dynamic => !/^w?br$/i.test(input2.tagName),
      ),
      callback: Dynamic = (input2?: Dynamic): Dynamic =>
        (input2.textContent ?? "")
          .replace(HtmlAuthoringFFFFDFFFDPattern, "")
          .trim() !== "";
    return (
      (value.length > 1 && value.filter(callback).length <= 1) ||
      value.some(isIconOnlyElement)
    );
  }
  function canContainHtmlChildren(input?: Dynamic): Dynamic {
    return !HtmlAuthoringSubscribers_2.has(input.toLowerCase());
  }
  function canContainHtmlTag(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = input.toLowerCase(),
      value2: Dynamic = options.toLowerCase();
    return !(
      !canContainHtmlChildren(value) ||
      (value === "p" && HtmlAuthoringSubscribers_3.has(value2)) ||
      (HtmlAuthoringSubscribers_4.has(value) &&
        HtmlAuthoringLiDtDdSet.has(value2)) ||
      (HtmlAuthoringH1H2H3Set.has(value) &&
        HtmlAuthoringH1H2H3Set.has(value2)) ||
      (value === value2 &&
        (value === "a" ||
          value === "form" ||
          value === "button" ||
          value === "label")) ||
      (HtmlAuthoringTrTdThConfig[value2] &&
        !HtmlAuthoringTrTdThConfig[value2].has(value)) ||
      (HtmlAuthoringTableTheadTbodyConfig[value] &&
        !HtmlAuthoringTableTheadTbodyConfig[value].has(value2))
    );
  }
  bindRuntimeValue(
    runtime,
    "parseUtilityClassesValue",
    () => parseUtilityClassesValue,
    (value) => {
      parseUtilityClassesValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HtmlAuthoringSubscribers",
    () => HtmlAuthoringSubscribers,
    (value) => {
      HtmlAuthoringSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DcTplAttribute",
    () => DcTplAttribute,
    (value) => {
      DcTplAttribute = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HtmlAuthoringCss",
    () => HtmlAuthoringCss,
    (value) => {
      HtmlAuthoringCss = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "stripLeadingCssAtRules",
    () => stripLeadingCssAtRules,
  );
  bindRuntimeValue(runtime, "fromParserHtml", () => fromParserHtml);
  bindRuntimeValue(
    runtime,
    "normalizeAuthoredHtml",
    () => normalizeAuthoredHtml,
  );
  bindRuntimeValue(
    runtime,
    "HtmlAuthoringSubscribers_2",
    () => HtmlAuthoringSubscribers_2,
    (value) => {
      HtmlAuthoringSubscribers_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HtmlAuthoringTextTspanTextpathSet",
    () => HtmlAuthoringTextTspanTextpathSet,
    (value) => {
      HtmlAuthoringTextTspanTextpathSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isInlineTextContainer",
    () => isInlineTextContainer,
  );
  bindRuntimeValue(
    runtime,
    "HtmlAuthoringFFFFDFFFDPattern",
    () => HtmlAuthoringFFFFDFFFDPattern,
    (value) => {
      HtmlAuthoringFFFFDFFFDPattern = value;
    },
  );
  bindRuntimeValue(runtime, "isIconOnlyElement", () => isIconOnlyElement);
  bindRuntimeValue(
    runtime,
    "canContainHtmlChildren",
    () => canContainHtmlChildren,
  );
  bindRuntimeValue(
    runtime,
    "HtmlAuthoringSubscribers_3",
    () => HtmlAuthoringSubscribers_3,
    (value) => {
      HtmlAuthoringSubscribers_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HtmlAuthoringH1H2H3Set",
    () => HtmlAuthoringH1H2H3Set,
    (value) => {
      HtmlAuthoringH1H2H3Set = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HtmlAuthoringTrTdThConfig",
    () => HtmlAuthoringTrTdThConfig,
    (value) => {
      HtmlAuthoringTrTdThConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HtmlAuthoringTableTheadTbodyConfig",
    () => HtmlAuthoringTableTheadTbodyConfig,
    (value) => {
      HtmlAuthoringTableTheadTbodyConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HtmlAuthoringSubscribers_4",
    () => HtmlAuthoringSubscribers_4,
    (value) => {
      HtmlAuthoringSubscribers_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HtmlAuthoringLiDtDdSet",
    () => HtmlAuthoringLiDtDdSet,
    (value) => {
      HtmlAuthoringLiDtDdSet = value;
    },
  );
  bindRuntimeValue(runtime, "canContainHtmlTag", () => canContainHtmlTag);
  return () => {
    parseUtilityClassesValue = (0, runtime.parseUtilityClasses)(
      runtime.builtInUtilityCss,
    );
    HtmlAuthoringSubscribers = new Set(
      parseUtilityClassesValue.map(
        (input?: Dynamic): Dynamic => input.className,
      ),
    );
    DcTplAttribute = "data-dc-tpl";
    HtmlAuthoringCss = `
/*sheet*/
`;
    HtmlAuthoringSubscribers_2 = new Set([
      "area",
      "base",
      "br",
      "col",
      "embed",
      "hr",
      "img",
      "input",
      "link",
      "meta",
      "param",
      "source",
      "track",
      "wbr",
      "canvas",
      "iframe",
      "option",
      "script",
      "select",
      "style",
      "textarea",
      "title",
      "video",
      "audio",
      "path",
      "circle",
      "rect",
      "line",
      "ellipse",
      "polygon",
      "polyline",
      "use",
    ]);
    HtmlAuthoringTextTspanTextpathSet = new Set(["text", "tspan", "textpath"]);
    HtmlAuthoringFFFFDFFFDPattern =
      /[\uE000-\uF8FF\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]/gu;
    HtmlAuthoringSubscribers_3 = new Set(
      "address article aside blockquote details div dl fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr main menu nav ol p pre section table ul".split(
        " ",
      ),
    );
    HtmlAuthoringH1H2H3Set = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
    HtmlAuthoringTrTdThConfig = {
      tr: new Set(["thead", "tbody", "tfoot", "table"]),
      td: new Set(["tr"]),
      th: new Set(["tr"]),
      thead: new Set(["table"]),
      tbody: new Set(["table"]),
      tfoot: new Set(["table"]),
      caption: new Set(["table"]),
      colgroup: new Set(["table"]),
      col: new Set(["colgroup"]),
    };
    HtmlAuthoringTableTheadTbodyConfig = {
      table: new Set(["caption", "colgroup", "thead", "tbody", "tfoot", "tr"]),
      thead: new Set(["tr"]),
      tbody: new Set(["tr"]),
      tfoot: new Set(["tr"]),
      tr: new Set(["td", "th"]),
      colgroup: new Set(["col"]),
    };
    HtmlAuthoringSubscribers_4 = new Set(
      "span a b i em strong u s small sub sup code label button abbr cite q mark time kbd samp var h1 h2 h3 h4 h5 h6".split(
        " ",
      ),
    );
    HtmlAuthoringLiDtDdSet = new Set([
      ...HtmlAuthoringSubscribers_3,
      "li",
      "dt",
      "dd",
    ]);
  };
}
