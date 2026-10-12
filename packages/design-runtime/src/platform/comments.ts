/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformComments(runtime: RuntimeBindings): () => void {
  var maxDocumentComments: Dynamic;
  var maxCommentTextLength: Dynamic;
  var maxCommentAttachments: Dynamic;
  function truncateUtf16Safely(text?: Dynamic, maxUnits?: Dynamic): Dynamic {
    if (text.length <= maxUnits) return text;
    let truncated: Dynamic = text.slice(0, maxUnits),
      lastUnit: Dynamic = truncated.charCodeAt(truncated.length - 1);
    return lastUnit >= 55296 && lastUnit <= 56319
      ? truncated.slice(0, -1)
      : truncated;
  }
  function isValidCommentImage(items?: Dynamic): Dynamic {
    return /^\/?_blob\/[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(items)
      ? true
      : items.length <= 2e5 &&
          /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/.test(
            items,
          );
  }
  function getObjectProperty(input?: Dynamic, options?: Dynamic): Dynamic {
    return typeof input == "object" && input !== null
      ? input[options]
      : undefined;
  }
  function parseDocumentComments(input?: Dynamic): Dynamic {
    if (!Array.isArray(input)) return [];
    let items: Dynamic = [],
      values: Dynamic = new Set();
    for (let value of input as Dynamic) {
      let value2: Dynamic = getObjectProperty(value, "id"),
        value3: Dynamic = getObjectProperty(value, "text"),
        value4: Dynamic = getObjectProperty(value, "at");
      if (
        typeof value2 != "string" ||
        value2.length === 0 ||
        value2.length > 64 ||
        values.has(value2) ||
        typeof value3 != "string" ||
        typeof value4 != "number" ||
        !Number.isFinite(value4)
      )
        continue;
      values.add(value2);
      let value5: Dynamic = getObjectProperty(value, "author"),
        value6: Dynamic = getObjectProperty(value, "userId"),
        value7: Dynamic = getObjectProperty(value, "elementKey"),
        value8: Dynamic = getObjectProperty(value, "elementLabel"),
        value9: Dynamic = getObjectProperty(value, "images"),
        value10: Dynamic = Array.isArray(value9)
          ? value9
              .filter(
                (input2?: Dynamic): Dynamic =>
                  typeof input2 == "string" && isValidCommentImage(input2),
              )
              .slice(0, maxCommentAttachments)
          : [];
      items.push({
        id: value2,
        text: truncateUtf16Safely(value3, maxCommentTextLength),
        at: value4,
        author:
          typeof value5 == "string" && value5.length > 0
            ? truncateUtf16Safely(value5, 80)
            : "viewer",
        userId:
          typeof value6 == "string" && value6.length > 0
            ? truncateUtf16Safely(value6, 128)
            : undefined,
        elementKey:
          typeof value7 == "string" && value7.length > 0
            ? truncateUtf16Safely(value7, 400)
            : undefined,
        elementLabel:
          typeof value8 == "string"
            ? truncateUtf16Safely(value8, 160)
            : undefined,
        ...(value10.length > 0
          ? {
              images: value10,
            }
          : {}),
      });
    }
    items.sort(
      (input2?: Dynamic, options?: Dynamic): Dynamic => input2.at - options.at,
    );
    return items.slice(-maxDocumentComments);
  }
  function applyCommentOperations(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = input;
    for (let value2 of options as Dynamic)
      if (value2.op === "add") {
        if (
          value.some(
            (input2?: Dynamic): Dynamic => input2.id === value2.comment.id,
          ) ||
          value.length >= maxDocumentComments
        )
          continue;
        value = [...value, value2.comment].sort(
          (input2?: Dynamic, options2?: Dynamic): Dynamic =>
            input2.at - options2.at,
        );
      } else
        value = value.filter(
          (input2?: Dynamic): Dynamic => input2.id !== value2.id,
        );
    return value;
  }
  function filterEffectiveCommentOperations(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let values: Dynamic = new Set(
      input.map((input2?: Dynamic): Dynamic => input2.id),
    );
    return options.filter(
      (input2?: Dynamic): Dynamic =>
        input2.op === "add"
          ? !values.has(input2.comment.id)
          : values.has(input2.id),
    );
  }
  function parseCommentOperations(input?: Dynamic): Dynamic {
    if (!Array.isArray(input)) return [];
    let items: Dynamic = [];
    for (let value of input as Dynamic) {
      let value2: Dynamic = getObjectProperty(value, "op");
      if (value2 === "add") {
        let value3: Dynamic = parseDocumentComments([
          getObjectProperty(value, "comment"),
        ])[0];
        value3 &&
          items.push({
            op: "add",
            comment: value3,
          });
      } else if (value2 === "remove") {
        let value3: Dynamic = getObjectProperty(value, "id");
        typeof value3 == "string" &&
          value3.length > 0 &&
          value3.length <= 64 &&
          items.push({
            op: "remove",
            id: value3,
          });
      }
    }
    return items;
  }
  bindRuntimeValue(runtime, "truncateUtf16Safely", () => truncateUtf16Safely);
  bindRuntimeValue(
    runtime,
    "maxDocumentComments",
    () => maxDocumentComments,
    (value) => {
      maxDocumentComments = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxCommentTextLength",
    () => maxCommentTextLength,
    (value) => {
      maxCommentTextLength = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxCommentAttachments",
    () => maxCommentAttachments,
    (value) => {
      maxCommentAttachments = value;
    },
  );
  bindRuntimeValue(runtime, "isValidCommentImage", () => isValidCommentImage);
  bindRuntimeValue(runtime, "getObjectProperty", () => getObjectProperty);
  bindRuntimeValue(
    runtime,
    "parseDocumentComments",
    () => parseDocumentComments,
  );
  bindRuntimeValue(
    runtime,
    "applyCommentOperations",
    () => applyCommentOperations,
  );
  bindRuntimeValue(
    runtime,
    "filterEffectiveCommentOperations",
    () => filterEffectiveCommentOperations,
  );
  bindRuntimeValue(
    runtime,
    "parseCommentOperations",
    () => parseCommentOperations,
  );
  return () => {
    maxDocumentComments = 200;
    maxCommentTextLength = 4e3;
    maxCommentAttachments = 4;
  };
}
