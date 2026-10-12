/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorClipboardImageValidation(
  runtime: RuntimeBindings,
): () => void {
  var ClipboardImageValidationLimit: Dynamic;
  var ClipboardImageValidationLimit_2: Dynamic;
  var ClipboardImageValidationSubscribers: Dynamic;
  var ClipboardImageValidationScriptIframeObjectSet: Dynamic;
  var ClipboardImageValidationHandler: Dynamic;
  var ClipboardImageValidationFromCharCode: Dynamic;
  var ClipboardImageValidationResolvedValue: Dynamic;
  var ClipboardImageValidationDecode: Dynamic;
  var ClipboardImageValidationDecode_2: Dynamic;
  var ClipboardImageValidationNow: Dynamic;
  var ClipboardImageValidationSinceSpentMsConfig: Dynamic;
  var ClipboardImageValidationLimit_3: Dynamic;
  var ClipboardImageValidationLimit_4: Dynamic;
  var ClipboardImageValidationLimit_5: Dynamic;
  var ClipboardImageValidationConstant: Dynamic;
  var ClipboardImageValidationPattern: Dynamic;
  var ClipboardImageValidationIso2022JpReplacementShiftJisSet: Dynamic;
  var ClipboardImageValidationCharsetPattern: Dynamic;
  var ClipboardImageValidationResolvedValue_2: Dynamic;
  function readRasterImagePixels(items?: Dynamic): Dynamic {
    let callback: Dynamic = (input?: Dynamic): Dynamic =>
        (items[input] << 8) | items[input + 1],
      callback2: Dynamic = (input?: Dynamic): Dynamic =>
        items[input] | (items[input + 1] << 8),
      callback3: Dynamic = (input?: Dynamic): Dynamic =>
        items[input] | (items[input + 1] << 8) | (items[input + 2] << 16),
      callback4: Dynamic = (input?: Dynamic): Dynamic =>
        ((items[input] << 24) |
          (items[input + 1] << 16) |
          (items[input + 2] << 8) |
          items[input + 3]) >>>
        0,
      callback5: Dynamic = (input?: Dynamic): Dynamic =>
        (items[input] |
          (items[input + 1] << 8) |
          (items[input + 2] << 16) |
          (items[input + 3] << 24)) >>>
        0,
      callback6: Dynamic = (input?: Dynamic, items2?: Dynamic): Dynamic =>
        input + items2.length <= items.length &&
        [...items2].every(
          (input2?: Dynamic, options?: Dynamic): Dynamic =>
            items[input + options] === input2.charCodeAt(0),
        );
    if (
      items.length >= 24 &&
      items[0] === 137 &&
      callback6(1, "PNG") &&
      callback4(4) === 218765834 &&
      callback6(12, "IHDR")
    )
      return callback4(16) * callback4(20);
    if (items.length >= 10 && callback6(0, "GIF8")) {
      let value2: Dynamic = callback2(6),
        value3: Dynamic = callback2(8),
        index: Dynamic = 0,
        callback7: Dynamic = (input?: Dynamic): Dynamic => {
          let value5: Dynamic = input;
          for (; value5 < items.length && items[value5] > 0; )
            value5 += items[value5] + 1;
          return value5 + 1;
        },
        value4: Dynamic =
          13 + (items[10] & 128 ? 3 << ((items[10] & 7) + 1) : 0);
      for (; value4 < items.length && items[value4] !== 59; ) {
        if (items[value4] === 33) {
          value4 = callback7(value4 + 2);
          continue;
        }
        if (items[value4] !== 44 || value4 + 10 > items.length) return;
        value2 = Math.max(
          value2,
          callback2(value4 + 1) + callback2(value4 + 5),
        );
        value3 = Math.max(
          value3,
          callback2(value4 + 3) + callback2(value4 + 7),
        );
        index += 1;
        value4 +=
          10 +
          (items[value4 + 9] & 128 ? 3 << ((items[value4 + 9] & 7) + 1) : 0);
        value4 = callback7(value4 + 1);
      }
      return index > 0 ? value2 * value3 : undefined;
    }
    if (items.length >= 26 && callback6(0, "BM"))
      return callback5(14) === 12
        ? callback2(18) * callback2(20)
        : Math.abs(callback5(18) | 0) * Math.abs(callback5(22) | 0);
    if (items.length >= 30 && callback6(0, "RIFF") && callback6(8, "WEBP")) {
      let index: Dynamic = 0,
        index2: Dynamic = 0,
        flag: Dynamic = false;
      for (let count: Dynamic = 12; count + 8 <= items.length; ) {
        let value2: Dynamic = callback5(count + 4),
          value3: Dynamic = count + 8;
        if (callback6(count, "VP8X") && value3 + 10 <= items.length) {
          index = Math.max(index, callback3(value3 + 4) + 1);
          index2 = Math.max(index2, callback3(value3 + 7) + 1);
          flag = true;
        } else if (callback6(count, "VP8L") && value3 + 5 <= items.length) {
          let value4: Dynamic = callback5(value3 + 1);
          index = Math.max(index, (value4 & 16383) + 1);
          index2 = Math.max(index2, ((value4 >>> 14) & 16383) + 1);
          flag = true;
        } else if (callback6(count, "VP8 ") && value3 + 10 <= items.length) {
          index = Math.max(index, callback2(value3 + 6) & 16383);
          index2 = Math.max(index2, callback2(value3 + 8) & 16383);
          flag = true;
        } else if (callback6(count, "ANMF") && value3 + 12 <= items.length) {
          index = Math.max(
            index,
            callback3(value3) * 2 + callback3(value3 + 6) + 1,
          );
          index2 = Math.max(
            index2,
            callback3(value3 + 3) * 2 + callback3(value3 + 9) + 1,
          );
          flag = true;
          count = value3 + 16;
          continue;
        }
        count = value3 + value2 + (value2 & 1);
      }
      return flag ? index * index2 : undefined;
    }
    if (items.length >= 4 && items[0] === 255 && items[1] === 216) {
      for (let count: Dynamic = 2; count + 9 < items.length; ) {
        if (items[count] !== 255) return;
        let value2: Dynamic = items[count + 1];
        if (value2 === 255) {
          count += 1;
          continue;
        }
        if (
          value2 === 216 ||
          (value2 >= 208 && value2 <= 215) ||
          value2 === 1
        ) {
          count += 2;
          continue;
        }
        if (
          value2 >= 192 &&
          value2 <= 207 &&
          value2 !== 196 &&
          value2 !== 200 &&
          value2 !== 204
        )
          return callback(count + 5) === 0
            ? undefined
            : callback(count + 5) * callback(count + 7);
        if (
          !(
            value2 === 196 ||
            value2 === 204 ||
            value2 === 219 ||
            value2 === 220 ||
            value2 === 221 ||
            (value2 >= 224 && value2 <= 239) ||
            value2 === 254
          )
        )
          return;
        count += 2 + callback(count + 2);
      }
      return;
    }
    if (!callback6(4, "ftyp")) return;
    let value: Dynamic;
    for (let count: Dynamic = 8; count + 16 <= items.length; count++)
      items[count] === 105 &&
        callback6(count, "ispe") &&
        (value = Math.max(
          value ?? 0,
          callback4(count + 8) * callback4(count + 12),
        ));
    return value;
  }
  function stripDelimitedText(
    input?: Dynamic,
    items?: Dynamic,
    items2?: Dynamic,
  ): Dynamic {
    let text: Dynamic = "",
      index: Dynamic = 0;
    for (
      let value: Dynamic = input.indexOf(items);
      value !== -1;
      value = input.indexOf(items, index)
    ) {
      text += input.slice(index, value);
      let value2: Dynamic = input.indexOf(items2, value + items.length);
      if (value2 === -1) return text;
      index = value2 + items2.length;
    }
    return text + input.slice(index);
  }
  function decodePercentEncodedBytes(input?: Dynamic): Dynamic {
    let value: Dynamic = new TextEncoder().encode(input);
    if (!input.includes("%")) return value;
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
        input2 <= 57 ? input2 - 48 : (input2 | 32) - 87,
      callback2: Dynamic = (input2?: Dynamic): Dynamic =>
        input2 !== undefined &&
        ((input2 >= 48 && input2 <= 57) ||
          ((input2 | 32) >= 97 && (input2 | 32) <= 102)),
      index: Dynamic = 0;
    for (let index2: Dynamic = 0; index2 < value.length; index2++)
      value[index2] === 37 &&
      callback2(value[index2 + 1]) &&
      callback2(value[index2 + 2])
        ? ((value[index++] =
            (callback(value[index2 + 1]) << 4) | callback(value[index2 + 2])),
          (index2 += 2))
        : (value[index++] = value[index2]);
    return value.subarray(0, index);
  }
  function decodeCssTextEscapes(input?: Dynamic): Dynamic {
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
      Number.isFinite(input2) && input2 > 0 && input2 <= 1114111
        ? String.fromCodePoint(input2)
        : "\uFFFD";
    return input
      .replace(/\\\r?\n|\\\r|\\\f/g, "")
      .replace(
        /\\([0-9a-f]{1,6})(?:\r\n|[ \t\n\r\f])?/gi,
        (input2?: Dynamic, options?: Dynamic): Dynamic =>
          callback(parseInt(options, 16)),
      )
      .replace(/\\([\s\S])/g, "$1");
  }
  function findSvgDoctypeEnd(items?: Dynamic): Dynamic {
    let value: Dynamic = items.indexOf("<!DOCTYPE");
    if (value === -1) return;
    let text: Dynamic = "";
    for (let value2: Dynamic = value; value2 < items.length; value2++) {
      let value3: Dynamic = items[value2];
      if (text) value3 === text && (text = "");
      else if (value3 === '"' || value3 === "'") text = value3;
      else if (value3 === ">") return items.slice(value, value2 + 1);
    }
    return items.slice(value);
  }
  function hasSafeSvgPreamble(input?: Dynamic): Dynamic {
    let value: Dynamic = stripDelimitedText(input, "<\!--", "-->");
    return (
      validateSvgPreamble(value) &&
      (value === input || validateSvgPreamble(input))
    );
  }
  function validateSvgPreamble(input?: Dynamic): Dynamic {
    let value: Dynamic =
      /^[\s\ufeff]*<\?xml[^>]*encoding\s*=\s*["']\s*([^"']*?)\s*["']/i.exec(
        input,
      )?.[1];
    if (value !== undefined && !isSafeTextEncoding(value)) return false;
    let value2: Dynamic = findSvgDoctypeEnd(input);
    if (value2 === undefined) return !input.includes("<!ENTITY");
    let value3: Dynamic = value2.indexOf("[");
    if (value3 !== -1) {
      let value5: Dynamic = input.indexOf(
        "]",
        input.indexOf("<!DOCTYPE") + value3,
      );
      if (
        value5 === -1 ||
        input
          .slice(input.indexOf("<!DOCTYPE") + value3 + 1, value5)
          .replace(
            /<!ENTITY\s+[A-Za-z_][\w.-]*\s+(?:"[^"<&%]*"|'[^'<&%]*')\s*>/g,
            "",
          )
          .trim() !== "" ||
        ((value2 = input.slice(
          input.indexOf("<!DOCTYPE"),
          input.indexOf("<!DOCTYPE") + value3,
        )),
        input.indexOf("<!ENTITY", value5) !== -1)
      )
        return false;
    } else if (input.includes("<!ENTITY")) return false;
    let value4: Dynamic = /PUBLIC\s+(?:"([^"]*)"|'([^']*)')/.exec(value2);
    return (
      value4 === null ||
      ClipboardImageValidationSubscribers.has(value4[1] ?? value4[2] ?? "")
    );
  }
  function validateEmbeddedCssAssets(
    input?: Dynamic,
    options: Dynamic = ClipboardImageValidationNow(),
    context: Dynamic = 0,
  ): Dynamic {
    let value: Dynamic = decodeCssTextEscapes(input);
    return (
      validateCssDataUrls(value, options, context) &&
      (value === input || validateCssDataUrls(input, options, context))
    );
  }
  function chargeEmbeddedImageBudget(
    items?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
    detail?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = extra.doc + " " + context,
      value3: Dynamic = !extra.charged.has(value2);
    extra.charged.add(value2);
    if (value3 && ++extra.count > ClipboardImageValidationLimit) return false;
    let value4: Dynamic = readRasterImagePixels(items);
    if (value4 !== undefined) {
      if (
        value4 > 67108864 ||
        (value3 && (extra.total += value4),
        extra.total > ClipboardImageValidationLimit_2)
      )
        return false;
    } else if (ClipboardImageValidationHandler(items)) return false;
    let value5: Dynamic = ClipboardImageValidationFromCharCode(items);
    if (
      value5 !== undefined &&
      value3 &&
      (extra.fonts += Math.max(value5, items.length)) >
        ClipboardImageValidationResolvedValue
    )
      return false;
    if (!value3) return true;
    let value6: Dynamic = ClipboardImageValidationDecode_2(items, options),
      items2: Dynamic = [
        ...new Set(
          value6.map(
            (input?: Dynamic): Dynamic => input.replace(/\u0000/g, ""),
          ),
        ),
      ];
    if (
      value4 === undefined &&
      value5 === undefined &&
      items2.some(
        (input?: Dynamic): Dynamic =>
          ClipboardImageValidationCharsetPattern.test(input),
      )
    )
      return false;
    if (detail >= 2)
      return (
        value4 !== undefined &&
        !items2.some(
          (input?: Dynamic): Dynamic =>
            ClipboardImageValidationPattern.test(input) ||
            ClipboardImageValidationPattern.test(decodeCssTextEscapes(input)),
        )
      );
    if (
      value &&
      !items2.every(
        (input?: Dynamic): Dynamic =>
          validateEmbeddedCssAssets(input, extra, detail + 1),
      )
    )
      return false;
    for (let value7 of value6 as Dynamic)
      if (
        /^[\s\ufeff\u0000]*</.test(value7) &&
        !validateSvgImage(
          value7.replace(/^[\s\ufeff\u0000]+/, ""),
          extra,
          detail + 1,
        )
      )
        return false;
    return true;
  }
  function isSafeTextEncoding(input?: Dynamic): Dynamic {
    try {
      let encoding: Dynamic = new TextDecoder(input.trim()).encoding;
      return !ClipboardImageValidationIso2022JpReplacementShiftJisSet.has(
        encoding,
      );
    } catch {
      return false;
    }
  }
  function validateCssDataUrls(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (/@import/i.test(input)) return false;
    let index: Dynamic = 0;
    for (let value of input.matchAll(
      /(?<![a-z0-9+.-])d[\t\n\r]*a[\t\n\r]*t[\t\n\r]*a[\t\n\r]*:/gi,
    ) as Dynamic) {
      if (
        Date.now() > options.deadline ||
        ++options.matches > ClipboardImageValidationLimit * 8
      )
        return false;
      let value2: Dynamic = input.slice(value.index + value[0].length),
        value3: Dynamic = value2.indexOf(",");
      if (value3 === -1) return false;
      let value4: Dynamic = value2.slice(0, value3),
        value5: Dynamic = value4
          .replace(/[\t\n\r]+/g, "")
          .trim()
          .toLowerCase(),
        value6: Dynamic = value2.slice(value3 + 1),
        value7: Dynamic = /; *base64$/.test(value5);
      if (!value7 && /base64/.test(value5)) return false;
      let value8: Dynamic = /(?:^|;) *charset=["']?([^;"']*)/.exec(value5)?.[1];
      if (value8 !== undefined && !isSafeTextEncoding(value8)) return false;
      if (value7) {
        let value9: Dynamic = /^[A-Za-z0-9+/=%\s]*/.exec(value6)![0],
          value10: Dynamic = value6[value9.length];
        if (value10 !== undefined && !/["');,]/.test(value10)) return false;
        let flag: Dynamic = false;
        for (let value11 of new Set([
          value9,
          value9.split(/\s/, 1)[0],
        ]) as Dynamic) {
          let value12: Dynamic = (
            value11.includes("%")
              ? new TextDecoder("latin1").decode(
                  decodePercentEncodedBytes(value11),
                )
              : value11
          ).replace(/[\t\n\f\r ]+/g, "");
          if (/[^A-Za-z0-9+/=]/.test(value12)) return false;
          let value13: Dynamic;
          try {
            value13 = Uint8Array.from(
              atob(value12),
              (input2?: Dynamic): Dynamic => input2.charCodeAt(0),
            );
          } catch {
            continue;
          }
          if (
            !chargeEmbeddedImageBudget(
              value13,
              value5,
              value4 + "," + value11,
              true,
              options,
              context,
            )
          )
            return false;
          flag = true;
          break;
        }
        if (!flag) return false;
      } else {
        if (++index > ClipboardImageValidationLimit_5) return false;
        let value9: Dynamic = value6.replace(/[\t\n\r]+/g, ""),
          value10: Dynamic = decodePercentEncodedBytes(value9);
        if (
          readRasterImagePixels(value10) !== undefined ||
          ClipboardImageValidationHandler(value10) ||
          ClipboardImageValidationFromCharCode(value10) !== undefined ||
          !chargeEmbeddedImageBudget(
            value10,
            value5,
            value4 + "," + value6,
            true,
            options,
            context,
          )
        )
          return false;
      }
    }
    return true;
  }
  function validateSvgImage(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = 0,
  ): Dynamic {
    if (options !== undefined)
      return validateNestedSvgImage(input, options, context);
    let value: Dynamic = Date.now();
    value - ClipboardImageValidationSinceSpentMsConfig.since >
      ClipboardImageValidationLimit_3 &&
      ((ClipboardImageValidationSinceSpentMsConfig.since = value),
      (ClipboardImageValidationSinceSpentMsConfig.spentMs = 0));
    if (
      ClipboardImageValidationSinceSpentMsConfig.spentMs >
      ClipboardImageValidationLimit_4
    )
      return false;
    let flag: Dynamic = false;
    try {
      flag = validateNestedSvgImage(input, ClipboardImageValidationNow(), 0);
      return flag;
    } finally {
      let value2: Dynamic = Date.now() - value;
      (!flag || value2 > 1e3) &&
        (ClipboardImageValidationSinceSpentMsConfig.spentMs += value2);
    }
  }
  function validateNestedSvgImage(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let doc: Dynamic = options.doc;
    options.doc = ++options.docs;
    try {
      return validateSvgDocument(input, options, context);
    } finally {
      options.doc = doc;
    }
  }
  function validateSvgDocument(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (typeof DOMParser === "undefined" || !hasSafeSvgPreamble(input))
      return false;
    let value: Dynamic = new DOMParser().parseFromString(
      input,
      "image/svg+xml",
    );
    if (
      value.getElementsByTagName("parsererror").length > 0 ||
      (value.doctype?.publicId &&
        !ClipboardImageValidationSubscribers.has(value.doctype.publicId))
    )
      return false;
    let callback: Dynamic = (input2?: Dynamic): Dynamic => {
      for (
        let firstChild: Dynamic = input2.firstChild;
        firstChild;
        firstChild = firstChild.nextSibling
      )
        if (firstChild.nodeType === 7 || !callback(firstChild)) return false;
      return true;
    };
    if (!callback(value)) return false;
    for (let value2 of Array.from(value.querySelectorAll("*")) as Dynamic) {
      let value3: Dynamic = value2.localName.toLowerCase();
      if (
        ClipboardImageValidationScriptIframeObjectSet.has(value3) ||
        (value3 === "style" &&
          (ClipboardImageValidationCharsetPattern.test(
            value2.textContent ?? "",
          ) ||
            !validateEmbeddedCssAssets(
              value2.textContent ?? "",
              options,
              context,
            )))
      )
        return false;
      for (let value4 of Array.from(value2.attributes) as Dynamic)
        if (
          ClipboardImageValidationCharsetPattern.test(value4.value) ||
          !validateEmbeddedCssAssets(value4.value, options, context)
        )
          return false;
    }
    return true;
  }
  async function hasSafeImagePixelCount(input?: Dynamic): Promise<Dynamic> {
    try {
      let value: Dynamic = readRasterImagePixels(
        new Uint8Array(await input.arrayBuffer()),
      );
      return value !== undefined && value <= 67108864;
    } catch {
      return false;
    }
  }
  async function canDecodeRasterImage(input?: Dynamic): Promise<Dynamic> {
    return /^image\/svg\+xml(;|$)/i.test(input.type) ||
      input.size > ClipboardImageValidationResolvedValue_2
      ? false
      : hasSafeImagePixelCount(input);
  }
  async function isPlayableImage(
    input?: Dynamic,
    options?: Dynamic,
  ): Promise<Dynamic> {
    if (!/^image\/svg\+xml(;|$)/i.test(input.type))
      try {
        return (options ?? (await hasSafeImagePixelCount(input)))
          ? ((await createImageBitmap(input)).close(), true)
          : false;
      } catch {
        return false;
      }
    if (
      !validateSvgImage(
        ClipboardImageValidationDecode(
          new Uint8Array(await input.arrayBuffer()),
        ),
      )
    )
      return false;
    let value: Dynamic = URL.createObjectURL(input),
      value2: Dynamic = new Image(),
      value3: Dynamic = await new Promise((input2?: Dynamic): Dynamic => {
        let value4: Dynamic = setTimeout((): Dynamic => input2(false), 1e4);
        value2.onload = (): Dynamic => {
          clearTimeout(value4);
          input2(true);
        };
        value2.onerror = (): Dynamic => {
          clearTimeout(value4);
          input2(false);
        };
        value2.src = value;
      });
    URL.revokeObjectURL(value);
    return value3;
  }
  bindRuntimeValue(
    runtime,
    "readRasterImagePixels",
    () => readRasterImagePixels,
  );
  bindRuntimeValue(
    runtime,
    "ClipboardImageValidationLimit",
    () => ClipboardImageValidationLimit,
    (value) => {
      ClipboardImageValidationLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardImageValidationLimit_2",
    () => ClipboardImageValidationLimit_2,
    (value) => {
      ClipboardImageValidationLimit_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardImageValidationSubscribers",
    () => ClipboardImageValidationSubscribers,
    (value) => {
      ClipboardImageValidationSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardImageValidationScriptIframeObjectSet",
    () => ClipboardImageValidationScriptIframeObjectSet,
    (value) => {
      ClipboardImageValidationScriptIframeObjectSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardImageValidationHandler",
    () => ClipboardImageValidationHandler,
    (value) => {
      ClipboardImageValidationHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardImageValidationFromCharCode",
    () => ClipboardImageValidationFromCharCode,
    (value) => {
      ClipboardImageValidationFromCharCode = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardImageValidationResolvedValue",
    () => ClipboardImageValidationResolvedValue,
    (value) => {
      ClipboardImageValidationResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardImageValidationDecode",
    () => ClipboardImageValidationDecode,
    (value) => {
      ClipboardImageValidationDecode = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardImageValidationDecode_2",
    () => ClipboardImageValidationDecode_2,
    (value) => {
      ClipboardImageValidationDecode_2 = value;
    },
  );
  bindRuntimeValue(runtime, "stripDelimitedText", () => stripDelimitedText);
  bindRuntimeValue(
    runtime,
    "decodePercentEncodedBytes",
    () => decodePercentEncodedBytes,
  );
  bindRuntimeValue(runtime, "decodeCssTextEscapes", () => decodeCssTextEscapes);
  bindRuntimeValue(runtime, "findSvgDoctypeEnd", () => findSvgDoctypeEnd);
  bindRuntimeValue(runtime, "hasSafeSvgPreamble", () => hasSafeSvgPreamble);
  bindRuntimeValue(runtime, "validateSvgPreamble", () => validateSvgPreamble);
  bindRuntimeValue(
    runtime,
    "ClipboardImageValidationNow",
    () => ClipboardImageValidationNow,
    (value) => {
      ClipboardImageValidationNow = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardImageValidationSinceSpentMsConfig",
    () => ClipboardImageValidationSinceSpentMsConfig,
    (value) => {
      ClipboardImageValidationSinceSpentMsConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardImageValidationLimit_3",
    () => ClipboardImageValidationLimit_3,
    (value) => {
      ClipboardImageValidationLimit_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardImageValidationLimit_4",
    () => ClipboardImageValidationLimit_4,
    (value) => {
      ClipboardImageValidationLimit_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "validateEmbeddedCssAssets",
    () => validateEmbeddedCssAssets,
  );
  bindRuntimeValue(
    runtime,
    "ClipboardImageValidationLimit_5",
    () => ClipboardImageValidationLimit_5,
    (value) => {
      ClipboardImageValidationLimit_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardImageValidationConstant",
    () => ClipboardImageValidationConstant,
    (value) => {
      ClipboardImageValidationConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "chargeEmbeddedImageBudget",
    () => chargeEmbeddedImageBudget,
  );
  bindRuntimeValue(
    runtime,
    "ClipboardImageValidationPattern",
    () => ClipboardImageValidationPattern,
    (value) => {
      ClipboardImageValidationPattern = value;
    },
  );
  bindRuntimeValue(runtime, "isSafeTextEncoding", () => isSafeTextEncoding);
  bindRuntimeValue(
    runtime,
    "ClipboardImageValidationIso2022JpReplacementShiftJisSet",
    () => ClipboardImageValidationIso2022JpReplacementShiftJisSet,
    (value) => {
      ClipboardImageValidationIso2022JpReplacementShiftJisSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardImageValidationCharsetPattern",
    () => ClipboardImageValidationCharsetPattern,
    (value) => {
      ClipboardImageValidationCharsetPattern = value;
    },
  );
  bindRuntimeValue(runtime, "validateCssDataUrls", () => validateCssDataUrls);
  bindRuntimeValue(runtime, "validateSvgImage", () => validateSvgImage);
  bindRuntimeValue(
    runtime,
    "validateNestedSvgImage",
    () => validateNestedSvgImage,
  );
  bindRuntimeValue(runtime, "validateSvgDocument", () => validateSvgDocument);
  bindRuntimeValue(
    runtime,
    "ClipboardImageValidationResolvedValue_2",
    () => ClipboardImageValidationResolvedValue_2,
    (value) => {
      ClipboardImageValidationResolvedValue_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hasSafeImagePixelCount",
    () => hasSafeImagePixelCount,
  );
  bindRuntimeValue(runtime, "canDecodeRasterImage", () => canDecodeRasterImage);
  bindRuntimeValue(runtime, "isPlayableImage", () => isPlayableImage);
  return () => {
    ClipboardImageValidationLimit = 256;
    ClipboardImageValidationLimit_2 = 67108864;
    ClipboardImageValidationSubscribers = new Set([
      "-//W3C//DTD SVG 1.1//EN",
      "-//W3C//DTD SVG 1.0//EN",
      "-//W3C//DTD SVG 1.1 Basic//EN",
      "-//W3C//DTD SVG 1.1 Tiny//EN",
    ]);
    ClipboardImageValidationScriptIframeObjectSet = new Set([
      "script",
      "iframe",
      "object",
      "embed",
    ]);
    ClipboardImageValidationHandler = (input?: Dynamic): Dynamic =>
      (input[0] === 137 &&
        input[1] === 80 &&
        input[2] === 78 &&
        input[3] === 71) ||
      (input[0] === 255 && input[1] === 216) ||
      (input[0] === 71 &&
        input[1] === 73 &&
        input[2] === 70 &&
        input[3] === 56) ||
      (input[0] === 66 && input[1] === 77) ||
      (input[0] === 82 &&
        input[1] === 73 &&
        input[2] === 70 &&
        input[3] === 70) ||
      (input[4] === 102 &&
        input[5] === 116 &&
        input[6] === 121 &&
        input[7] === 112) ||
      (input[0] === 0 &&
        input[1] === 0 &&
        (input[2] === 1 || input[2] === 2) &&
        input[3] === 0) ||
      (input[0] === 73 &&
        input[1] === 73 &&
        input[2] === 42 &&
        input[3] === 0) ||
      (input[0] === 77 &&
        input[1] === 77 &&
        input[2] === 0 &&
        input[3] === 42) ||
      (input[4] === 106 && input[5] === 80 && input[6] === 32) ||
      (input[0] === 255 &&
        input[1] === 79 &&
        input[2] === 255 &&
        input[3] === 81) ||
      (input[0] === 37 &&
        input[1] === 80 &&
        input[2] === 68 &&
        input[3] === 70) ||
      (input[0] === 255 && input[1] === 10) ||
      (input[4] === 74 &&
        input[5] === 88 &&
        input[6] === 76 &&
        input[7] === 32);
    ClipboardImageValidationFromCharCode = (items?: Dynamic): Dynamic => {
      let value: Dynamic = String.fromCharCode(
        items[0] ?? 0,
        items[1] ?? 0,
        items[2] ?? 0,
        items[3] ?? 0,
      );
      return (value === "wOFF" || value === "wOF2") && items.length >= 20
        ? ((items[16] << 24) |
            (items[17] << 16) |
            (items[18] << 8) |
            items[19]) >>>
            0
        : value === "OTTO" ||
            value === "true" ||
            value === "ttcf" ||
            (items[0] === 0 &&
              items[1] === 1 &&
              items[2] === 0 &&
              items[3] === 0)
          ? items.length
          : undefined;
    };
    ClipboardImageValidationResolvedValue = 64 * 1024 * 1024;
    ClipboardImageValidationDecode = (
      input?: Dynamic,
      options: Dynamic = "",
    ): Dynamic => {
      if (input[0] === 255 && input[1] === 254)
        return new TextDecoder("utf-16le").decode(input.subarray(2));
      if (input[0] === 254 && input[1] === 255)
        return new TextDecoder("utf-16be").decode(input.subarray(2));
      if (input[0] === 239 && input[1] === 187 && input[2] === 191)
        return new TextDecoder().decode(input.subarray(3));
      let text: Dynamic = "utf-8";
      try {
        let value: Dynamic = /(?:^|;) *charset=["']?([^;"']*)/i.exec(
          options,
        )?.[1];
        value && (text = new TextDecoder(value.trim()).encoding);
      } catch {}
      return new TextDecoder(
        text === "utf-16be" || text === "utf-16le" ? text : "utf-8",
      ).decode(input);
    };
    ClipboardImageValidationDecode_2 = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic => {
      let values: Dynamic = new Set([
        ClipboardImageValidationDecode(input, options),
        new TextDecoder().decode(input),
      ]);
      input.indexOf(0) !== -1 &&
        (values.add(new TextDecoder("utf-16le").decode(input)),
        values.add(new TextDecoder("utf-16be").decode(input)));
      return [...values];
    };
    ClipboardImageValidationNow = (): Dynamic => ({
      matches: 0,
      count: 0,
      total: 0,
      fonts: 0,
      deadline: Date.now() + ClipboardImageValidationConstant,
      charged: new Set(),
      doc: 0,
      docs: 0,
    });
    ClipboardImageValidationSinceSpentMsConfig = {
      since: 0,
      spentMs: 0,
    };
    ClipboardImageValidationLimit_3 = 6e4;
    ClipboardImageValidationLimit_4 = 15e3;
    ClipboardImageValidationLimit_5 = 32;
    ClipboardImageValidationConstant = 6e3;
    ClipboardImageValidationPattern =
      /(?<![a-z0-9+.-])d[\t\n\r]*a[\t\n\r]*t[\t\n\r]*a[\t\n\r]*:/i;
    ClipboardImageValidationIso2022JpReplacementShiftJisSet = new Set([
      "iso-2022-jp",
      "replacement",
      "shift_jis",
      "euc-jp",
      "euc-kr",
      "gbk",
      "gb18030",
      "big5",
    ]);
    ClipboardImageValidationCharsetPattern = /@charset|\u001b/i;
    ClipboardImageValidationResolvedValue_2 = 32 * 1024 * 1024;
  };
}
