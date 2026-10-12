/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorClipboardHtmlSanitization(
  runtime: RuntimeBindings,
): () => void {
  var ClipboardHtmlSanitizationSubscribers: Dynamic;
  var ClipboardHtmlSanitizationSrcdocContenteditableFormactionSet: Dynamic;
  var ClipboardHtmlSanitizationSubscribers_2: Dynamic;
  var ClipboardHtmlSanitizationAnimateSetAnimatemotionSet: Dynamic;
  var ClipboardHtmlSanitizationDataKeyframesDataDcDataOmValues: Dynamic;
  var ClipboardHtmlSanitizationSome: Dynamic;
  var ClipboardHtmlSanitizationDataKeyframesAttrPattern: Dynamic;
  var ClipboardHtmlSanitizationDynsrcLowsrcUsemapSet: Dynamic;
  var ClipboardHtmlSanitizationExpressionMozBindingPattern: Dynamic;
  var ClipboardHtmlSanitizationAZPattern: Dynamic;
  var ClipboardHtmlSanitizationExpressionMozBindingPattern_2: Dynamic;
  var ClipboardHtmlSanitizationScriptDataDcScriptPattern: Dynamic;
  function isSafePastedTag(input?: Dynamic): Dynamic {
    let value: Dynamic = input.trim().toLowerCase();
    if (!/^[a-z][a-z0-9:-]*$/.test(value)) return false;
    let value2: Dynamic = value.slice(value.lastIndexOf(":") + 1);
    if (value2 === "") return false;
    for (let value3 of (value2 === value
      ? [value]
      : [value, value2]) as Dynamic)
      if (
        value3.startsWith("on") ||
        ClipboardHtmlSanitizationSome(value3) ||
        ClipboardHtmlSanitizationSrcdocContenteditableFormactionSet.has(
          value3,
        ) ||
        ClipboardHtmlSanitizationSubscribers_2.has(value3) ||
        value3 === "srcset" ||
        value3 === "is" ||
        value3 === "attributename" ||
        value3.startsWith("style") ||
        value3.startsWith("sc-") ||
        ClipboardHtmlSanitizationScriptDataDcScriptPattern.test(value3)
      )
        return false;
    return true;
  }
  function isUnsafePastedAttribute(input?: Dynamic): Dynamic {
    return !/^[a-z][a-z0-9-]*$/.test(input) ||
      input.startsWith("on") ||
      input.startsWith("sc-") ||
      ClipboardHtmlSanitizationSome(input) ||
      input.startsWith("style") ||
      input === "is" ||
      ClipboardHtmlSanitizationSrcdocContenteditableFormactionSet.has(input) ||
      ClipboardHtmlSanitizationDynsrcLowsrcUsemapSet.has(input)
      ? false
      : input !== "attributename";
  }
  function isSafePastedProtocol(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = /^([a-z][a-z0-9+.-]*):/.exec(input);
    if (!value) return true;
    let value2: Dynamic = value[1];
    return value2 === "http" ||
      value2 === "https" ||
      value2 === "mailto" ||
      value2 === "tel"
      ? true
      : value2 === "data"
        ? options && input.startsWith("data:image/")
        : false;
  }
  function isSafePastedUrl(input?: Dynamic, options: Dynamic = false): Dynamic {
    let value: Dynamic = input.replace(/[\u0000-\u0020]/g, "").toLowerCase(),
      value2: Dynamic = value.search(/[:/?#]/);
    return (value2 === -1 ? value : value.slice(0, value2)).includes("{{")
      ? false
      : isSafePastedProtocol(value, options);
  }
  function isSafePastedSrcset(input?: Dynamic): Dynamic {
    return input
      .split(",")
      .map((input2?: Dynamic): Dynamic => input2.trim().split(/\s+/)[0] ?? "")
      .every(
        (input2?: Dynamic): Dynamic =>
          input2 === "" || isSafePastedUrl(input2, true),
      );
  }
  function removeCssStrings(input?: Dynamic): Dynamic {
    return input.replace(
      /\\[\s\S]|"(?:\\[\s\S]|[^"\\\n\r\f])*"|'(?:\\[\s\S]|[^'\\\n\r\f])*'/g,
      (input2?: Dynamic): Dynamic => (input2[0] === "\\" ? input2 : ""),
    );
  }
  function decodeCssEscapes(input?: Dynamic): Dynamic {
    return input.replace(
      /\\([0-9a-fA-F]{1,6})[ \t\n\r\f]?|\\([\s\S])|\\$/g,
      (input2?: Dynamic, options?: Dynamic, context?: Dynamic): Dynamic => {
        if (options !== undefined) {
          let value: Dynamic = parseInt(options, 16);
          return value > 0 &&
            value <= 1114111 &&
            !(value >= 55296 && value <= 57343)
            ? String.fromCodePoint(value)
            : "\uFFFD";
        }
        return context ?? "\uFFFD";
      },
    );
  }
  function splitSafeCssDeclarations(input?: Dynamic): Dynamic {
    let items: Dynamic = [],
      index: Dynamic = 0,
      text: Dynamic = "",
      text2: Dynamic = "",
      flag: Dynamic = false;
    for (let value of input as Dynamic) {
      if (text) {
        flag
          ? (flag = false)
          : value === "\\"
            ? (flag = true)
            : value === text && (text = "");
        text2 += value;
        continue;
      }
      value === '"' || value === "'"
        ? (text = value)
        : value === "("
          ? (index += 1)
          : value === ")" && (index = Math.max(0, index - 1));
      value === ";" && index === 0
        ? (items.push(text2), (text2 = ""))
        : (text2 += value);
    }
    items.push(text2);
    return items;
  }
  function isSafeStyleAttribute(input?: Dynamic): Dynamic {
    return (
      /^style-[a-z][a-z-]*$/.test(input) &&
      !ClipboardHtmlSanitizationScriptDataDcScriptPattern.test(input)
    );
  }
  function sanitizePastedStyle(items?: Dynamic): Dynamic {
    if (items.length > 8192) return null;
    let value: Dynamic = items.trim();
    if (
      /^\{\{[^{}<>'"]*\}\}$/.test(value) &&
      !ClipboardHtmlSanitizationScriptDataDcScriptPattern.test(value)
    )
      return items;
    let items2: Dynamic = [];
    for (let value2 of splitSafeCssDeclarations(items) as Dynamic) {
      let value3: Dynamic = value2.trim();
      if (!value3) continue;
      let value4: Dynamic = value3.indexOf(":");
      if (value4 <= 0) continue;
      let value5: Dynamic = value3.slice(0, value4).trim(),
        value6: Dynamic = value3.slice(value4 + 1).trim();
      if (
        !/^(?:--[A-Za-z0-9_-]+|-?[A-Za-z][A-Za-z0-9-]*)$/.test(value5) ||
        (0, runtime.isUnsafeCssProperty)(value5) ||
        ClipboardHtmlSanitizationScriptDataDcScriptPattern.test(value5) ||
        ClipboardHtmlSanitizationScriptDataDcScriptPattern.test(value6) ||
        /\\$/.test(value6) ||
        /\\[0-9a-fA-F]{0,6}\{\{/.test(value6)
      )
        continue;
      let value7: Dynamic = value6.replace(/\{\{[^{}<>'"]*\}\}/g, "0");
      ClipboardHtmlSanitizationExpressionMozBindingPattern.test(
        decodeCssEscapes(value7).replace(/[\u0000\t\n\r\f]/g, ""),
      ) ||
        ClipboardHtmlSanitizationAZPattern.test(
          decodeCssEscapes(removeCssStrings(value7)).replace(
            /[\u0000\t\n\r\f]/g,
            "",
          ),
        ) ||
        ClipboardHtmlSanitizationExpressionMozBindingPattern_2.test(
          decodeCssEscapes(value6.replace(/\{\{[^{}<>'"]*\}\}/g, "")).replace(
            /[\u0000\t\n\r\f]/g,
            "",
          ),
        ) ||
        (value6.length !== 0 && items2.push(value5 + ": " + value6));
    }
    return items2.length > 0 ? items2.join("; ") : null;
  }
  function isPastedStylePreserved(input?: Dynamic): Dynamic {
    let length: Dynamic = splitSafeCssDeclarations(input).filter(
        (input2?: Dynamic): Dynamic => input2.trim() !== "",
      ).length,
      value: Dynamic = sanitizePastedStyle(input);
    return value == null
      ? length === 0
      : splitSafeCssDeclarations(value).length === length;
  }
  function getNativeDomAccessor(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = Object.getPrototypeOf(input);
    for (; value; ) {
      let value2: Dynamic = Object.getOwnPropertyDescriptor(value, options);
      if (value2?.get) {
        let get2: Dynamic = value2.get;
        return (input2?: Dynamic): Dynamic => get2.call(input2);
      }
      if (value2 && typeof value2.value == "function") {
        let value3: Dynamic = value2.value;
        return (input2?: Dynamic, ...options2: Dynamic[]): Dynamic =>
          value3.call(input2, ...options2);
      }
      value = Object.getPrototypeOf(value);
    }
    return (input2?: Dynamic, ...options2: Dynamic[]): Dynamic => {
      let value2: Dynamic = input2[options];
      return typeof value2 == "function"
        ? value2.apply(input2, options2)
        : value2;
    };
  }
  function createNativeDomAccessors(input?: Dynamic): Dynamic {
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
      getNativeDomAccessor(input, input2);
    return {
      tagName: callback("tagName"),
      attributes: callback("attributes"),
      children: callback("children"),
      childNodes: callback("childNodes"),
      nodeType: callback("nodeType"),
      getAttribute: callback("getAttribute"),
      removeChild: callback("removeChild"),
      setAttribute: callback("setAttribute"),
      removeAttribute: callback("removeAttribute"),
      remove: callback("remove"),
    };
  }
  function sanitizePastedDom(input?: Dynamic, options?: Dynamic): Dynamic {
    for (let value of Array.from(options.childNodes(input)) as Dynamic)
      options.nodeType(value) === 8 && options.removeChild(input, value);
    for (let value of Array.from(options.children(input)) as Dynamic) {
      let value2: Dynamic = options.tagName(value).toLowerCase(),
        value3: Dynamic = value2.startsWith("sc-raw-")
          ? value2.slice(7)
          : value2;
      if (
        value2.includes(":") ||
        ClipboardHtmlSanitizationSubscribers.has(value2) ||
        ClipboardHtmlSanitizationSubscribers.has(value3)
      ) {
        options.remove(value);
        continue;
      }
      if (
        ClipboardHtmlSanitizationScriptDataDcScriptPattern.test("<" + value2)
      ) {
        options.remove(value);
        continue;
      }
      if (
        (ClipboardHtmlSanitizationAnimateSetAnimatemotionSet.has(value2) ||
          ClipboardHtmlSanitizationAnimateSetAnimatemotionSet.has(value3)) &&
        Array.from(options.attributes(value))
          .filter(
            (input2?: Dynamic): Dynamic =>
              input2.name.toLowerCase() === "attributename",
          )
          .some((input2?: Dynamic): Dynamic => !isSafePastedTag(input2.value))
      ) {
        options.remove(value);
        continue;
      }
      for (let value4 of Array.from(options.attributes(value)) as Dynamic) {
        let value5: Dynamic = value4.name.toLowerCase();
        if (value5 === "is") {
          options.remove(value);
          break;
        }
        if (
          value5.startsWith("on") ||
          ClipboardHtmlSanitizationSrcdocContenteditableFormactionSet.has(
            value5,
          )
        ) {
          options.removeAttribute(value, value4.name);
          continue;
        }
        if (value5.startsWith("sc-")) {
          options.removeAttribute(value, value4.name);
          continue;
        }
        let value6: Dynamic =
          ClipboardHtmlSanitizationDataKeyframesAttrPattern.exec(value5);
        if (value6 != null && !isUnsafePastedAttribute(value6[1] ?? "")) {
          options.removeAttribute(value, value4.name);
          continue;
        }
        if (value5.startsWith("style-")) {
          if (!isSafeStyleAttribute(value5)) {
            options.removeAttribute(value, value4.name);
            continue;
          }
          let value8: Dynamic = sanitizePastedStyle(value4.value);
          value8 == null
            ? options.removeAttribute(value, value4.name)
            : value8 !== value4.value &&
              options.setAttribute(value, value4.name, value8);
          continue;
        }
        if (value5 === "style") {
          let value8: Dynamic = sanitizePastedStyle(value4.value);
          value8 == null
            ? options.removeAttribute(value, value4.name)
            : value8 !== value4.value &&
              options.setAttribute(value, value4.name, value8);
          continue;
        }
        let value7: Dynamic =
          value5 === "src" ||
          value5 === "poster" ||
          ((value5 === "href" || value5 === "xlink:href") &&
            (value2 === "image" || value2 === "feimage"));
        if (
          ClipboardHtmlSanitizationSubscribers_2.has(value5) &&
          !isSafePastedUrl(value4.value, value7)
        ) {
          options.removeAttribute(value, value4.name);
          continue;
        }
        if (value5 === "srcset" && !isSafePastedSrcset(value4.value)) {
          options.removeAttribute(value, value4.name);
          continue;
        }
        (ClipboardHtmlSanitizationScriptDataDcScriptPattern.test(
          value4.value,
        ) ||
          ClipboardHtmlSanitizationScriptDataDcScriptPattern.test(value5)) &&
          options.removeAttribute(value, value4.name);
      }
      sanitizePastedDom(value, options);
    }
  }
  function sanitizePastedHtml(input?: Dynamic): Dynamic {
    if (typeof DOMParser === "undefined") return (0, runtime.escapeHtml)(input);
    let value: Dynamic = input;
    for (let index: Dynamic = 0; index < 2; index++) {
      let value2: Dynamic = new DOMParser().parseFromString(value, "text/html");
      sanitizePastedDom(value2.body, createNativeDomAccessors(value2.body));
      value = value2.body.innerHTML;
    }
    return value;
  }
  bindRuntimeValue(
    runtime,
    "ClipboardHtmlSanitizationSubscribers",
    () => ClipboardHtmlSanitizationSubscribers,
    (value) => {
      ClipboardHtmlSanitizationSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardHtmlSanitizationSrcdocContenteditableFormactionSet",
    () => ClipboardHtmlSanitizationSrcdocContenteditableFormactionSet,
    (value) => {
      ClipboardHtmlSanitizationSrcdocContenteditableFormactionSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardHtmlSanitizationSubscribers_2",
    () => ClipboardHtmlSanitizationSubscribers_2,
    (value) => {
      ClipboardHtmlSanitizationSubscribers_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardHtmlSanitizationAnimateSetAnimatemotionSet",
    () => ClipboardHtmlSanitizationAnimateSetAnimatemotionSet,
    (value) => {
      ClipboardHtmlSanitizationAnimateSetAnimatemotionSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardHtmlSanitizationDataKeyframesDataDcDataOmValues",
    () => ClipboardHtmlSanitizationDataKeyframesDataDcDataOmValues,
    (value) => {
      ClipboardHtmlSanitizationDataKeyframesDataDcDataOmValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardHtmlSanitizationSome",
    () => ClipboardHtmlSanitizationSome,
    (value) => {
      ClipboardHtmlSanitizationSome = value;
    },
  );
  bindRuntimeValue(runtime, "isSafePastedTag", () => isSafePastedTag);
  bindRuntimeValue(
    runtime,
    "ClipboardHtmlSanitizationDataKeyframesAttrPattern",
    () => ClipboardHtmlSanitizationDataKeyframesAttrPattern,
    (value) => {
      ClipboardHtmlSanitizationDataKeyframesAttrPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardHtmlSanitizationDynsrcLowsrcUsemapSet",
    () => ClipboardHtmlSanitizationDynsrcLowsrcUsemapSet,
    (value) => {
      ClipboardHtmlSanitizationDynsrcLowsrcUsemapSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isUnsafePastedAttribute",
    () => isUnsafePastedAttribute,
  );
  bindRuntimeValue(runtime, "isSafePastedProtocol", () => isSafePastedProtocol);
  bindRuntimeValue(runtime, "isSafePastedUrl", () => isSafePastedUrl);
  bindRuntimeValue(runtime, "isSafePastedSrcset", () => isSafePastedSrcset);
  bindRuntimeValue(
    runtime,
    "ClipboardHtmlSanitizationExpressionMozBindingPattern",
    () => ClipboardHtmlSanitizationExpressionMozBindingPattern,
    (value) => {
      ClipboardHtmlSanitizationExpressionMozBindingPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardHtmlSanitizationAZPattern",
    () => ClipboardHtmlSanitizationAZPattern,
    (value) => {
      ClipboardHtmlSanitizationAZPattern = value;
    },
  );
  bindRuntimeValue(runtime, "removeCssStrings", () => removeCssStrings);
  bindRuntimeValue(
    runtime,
    "ClipboardHtmlSanitizationExpressionMozBindingPattern_2",
    () => ClipboardHtmlSanitizationExpressionMozBindingPattern_2,
    (value) => {
      ClipboardHtmlSanitizationExpressionMozBindingPattern_2 = value;
    },
  );
  bindRuntimeValue(runtime, "decodeCssEscapes", () => decodeCssEscapes);
  bindRuntimeValue(
    runtime,
    "splitSafeCssDeclarations",
    () => splitSafeCssDeclarations,
  );
  bindRuntimeValue(runtime, "isSafeStyleAttribute", () => isSafeStyleAttribute);
  bindRuntimeValue(runtime, "sanitizePastedStyle", () => sanitizePastedStyle);
  bindRuntimeValue(
    runtime,
    "isPastedStylePreserved",
    () => isPastedStylePreserved,
  );
  bindRuntimeValue(
    runtime,
    "ClipboardHtmlSanitizationScriptDataDcScriptPattern",
    () => ClipboardHtmlSanitizationScriptDataDcScriptPattern,
    (value) => {
      ClipboardHtmlSanitizationScriptDataDcScriptPattern = value;
    },
  );
  bindRuntimeValue(runtime, "getNativeDomAccessor", () => getNativeDomAccessor);
  bindRuntimeValue(
    runtime,
    "createNativeDomAccessors",
    () => createNativeDomAccessors,
  );
  bindRuntimeValue(runtime, "sanitizePastedDom", () => sanitizePastedDom);
  bindRuntimeValue(runtime, "sanitizePastedHtml", () => sanitizePastedHtml);
  return () => {
    ClipboardHtmlSanitizationSubscribers = new Set([
      "script",
      "style",
      "link",
      "meta",
      "base",
      "iframe",
      "frame",
      "frameset",
      "portal",
      "embed",
      "object",
      "applet",
      "noembed",
      "noscript",
      "noframes",
      "plaintext",
      "xmp",
      "template",
      "foreignobject",
      "math",
      "annotation-xml",
      "head",
      "title",
      "x-import",
      "dc-import",
      "helmet",
      "sc-helmet",
    ]);
    ClipboardHtmlSanitizationSrcdocContenteditableFormactionSet = new Set([
      "srcdoc",
      "contenteditable",
      "formaction",
      "ping",
    ]);
    ClipboardHtmlSanitizationSubscribers_2 = new Set([
      "href",
      "xlink:href",
      "src",
      "action",
      "poster",
      "data",
      "cite",
      "background",
      "dynsrc",
      "lowsrc",
      "longdesc",
      "usemap",
    ]);
    ClipboardHtmlSanitizationAnimateSetAnimatemotionSet = new Set([
      "animate",
      "set",
      "animatemotion",
      "animatetransform",
      "animatecolor",
    ]);
    ClipboardHtmlSanitizationDataKeyframesDataDcDataOmValues = [
      "data-keyframes-",
      "data-dc-",
      "data-om-",
      "data-dm-",
      "data-react-",
    ];
    ClipboardHtmlSanitizationSome = (input?: Dynamic): Dynamic =>
      ClipboardHtmlSanitizationDataKeyframesDataDcDataOmValues.some(
        (input2?: Dynamic): Dynamic => input.startsWith(input2),
      );
    ClipboardHtmlSanitizationDataKeyframesAttrPattern =
      /^data-keyframes-attr-(.*)$/;
    ClipboardHtmlSanitizationDynsrcLowsrcUsemapSet = new Set([
      "dynsrc",
      "lowsrc",
      "usemap",
    ]);
    ClipboardHtmlSanitizationExpressionMozBindingPattern =
      /[<>{}\\]|\/\*|expression\s*\(|-moz-binding|behavior\s*:|javascript\s*:/i;
    ClipboardHtmlSanitizationAZPattern = /@[a-z-]/i;
    ClipboardHtmlSanitizationExpressionMozBindingPattern_2 =
      /[<>{}\\]|\/\*|expression\s*\(|-moz-binding|behavior\s*:|javascript\s*:/i;
    ClipboardHtmlSanitizationScriptDataDcScriptPattern =
      /<\/?script|data-dc-script|<\/?x-dc|<\!--/i;
  };
}
