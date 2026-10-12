/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorTextListState(
  runtime: RuntimeBindings,
): () => void {
  function getTextListKind(input?: Dynamic): Dynamic {
    if (!input) return "none";
    let value: Dynamic = input.tagName.toLowerCase(),
      value2: Dynamic =
        value === "ul" || value === "ol"
          ? input
          : value === "li"
            ? input.parentElement
            : input.children.length === 1 &&
                /^(ul|ol)$/i.test(input.children[0].tagName)
              ? input.children[0]
              : null;
    return value2 == null
      ? "none"
      : value2.tagName.toLowerCase() === "ol"
        ? "number"
        : "bullet";
  }
  function listKindToTag(input?: Dynamic, options?: Dynamic): Dynamic {
    return input === "number"
      ? "ol"
      : input === "bullet"
        ? "ul"
        : options === "number"
          ? "ol"
          : options === "bullet"
            ? "ul"
            : null;
  }
  function normalizeTextEditListState(input?: Dynamic): Dynamic {
    if (input.active !== true) return null;
    let value: Dynamic = input.plain === true;
    return {
      tid: Number.isInteger(input.tid) ? input.tid : null,
      plain: value,
      ul: !value && input.formats?.ul === true,
      ol: !value && input.formats?.ol === true,
    };
  }
  function createPendingTextListCounter(): Dynamic {
    let index: Dynamic = 0;
    return {
      begin: (input?: Dynamic): Dynamic => {
        let value: Dynamic = input ? 1 : 0;
        index += value;
        return (): Dynamic => {
          index -= value;
        };
      },
      pending: (): Dynamic => index > 0,
    };
  }
  function sameTextEditListState(input?: Dynamic, options?: Dynamic): Dynamic {
    return (
      input === options ||
      (input !== null &&
        options !== null &&
        input.tid === options.tid &&
        input.plain === options.plain &&
        input.ul === options.ul &&
        input.ol === options.ol)
    );
  }
  function resolveTextListState(
    items?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let value2: Dynamic =
        options !== null && context !== undefined && options.tid === context
          ? options
          : null,
      value3: Dynamic = value2 !== null && !value2.plain ? value2 : null,
      value4: Dynamic = value3
        ? value3.ol
          ? "number"
          : value3.ul
            ? "bullet"
            : "none"
        : (items[0] ?? "none"),
      value5: Dynamic =
        value3 === null &&
        items.some((input?: Dynamic): Dynamic => input !== items[0]),
      value6: Dynamic =
        items.length !== 1
          ? "Make lists one text at a time"
          : value2?.plain
            ? "This text is bound to the script \u2014 formatting is off"
            : value3 === null && !value
              ? "This text is not editable inline \u2014 select the text inside it"
              : null;
    return {
      value: value4,
      mixed: value5,
      live: value3 !== null,
      off: value6,
    };
  }
  function classifyTextListEdit(input?: Dynamic, options?: Dynamic): Dynamic {
    return input === null || options === null
      ? "refused"
      : input.undoLength !== options.undoLength ||
          input.template !== options.template ||
          input.pendingScript !== options.pendingScript ||
          input.pendingProps !== options.pendingProps ||
          input.pendingPropsJson !== options.pendingPropsJson
        ? "applied"
        : "refused";
  }
  function isSuccessfulTextListEdit(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    return input === "applied" || (input === "none" && !options);
  }
  bindRuntimeValue(runtime, "getTextListKind", () => getTextListKind);
  bindRuntimeValue(runtime, "listKindToTag", () => listKindToTag);
  bindRuntimeValue(
    runtime,
    "normalizeTextEditListState",
    () => normalizeTextEditListState,
  );
  bindRuntimeValue(
    runtime,
    "createPendingTextListCounter",
    () => createPendingTextListCounter,
  );
  bindRuntimeValue(
    runtime,
    "sameTextEditListState",
    () => sameTextEditListState,
  );
  bindRuntimeValue(runtime, "resolveTextListState", () => resolveTextListState);
  bindRuntimeValue(runtime, "classifyTextListEdit", () => classifyTextListEdit);
  bindRuntimeValue(
    runtime,
    "isSuccessfulTextListEdit",
    () => isSuccessfulTextListEdit,
  );
  return () => {};
}
