/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasArtboardErrors(
  runtime: RuntimeBindings,
): () => void {
  var emptyArtboardErrors: Dynamic;
  var maxArtboardErrorMessages: Dynamic;
  var maxArtboardErrorFields: Dynamic;
  var serializeErrorMessages: Dynamic;
  function sanitizeArtboardErrorContext(value?: Dynamic): Dynamic {
    return Array.isArray(value)
      ? value.map(
          (input?: Dynamic): Dynamic =>
            typeof input == "object" &&
            input !== null &&
            typeof input.label == "string"
              ? {
                  ...input,
                  label: (0, runtime.sanitizeDesignContextText)(input.label),
                }
              : input,
        )
      : typeof value == "object" && value !== null
        ? (0, runtime.sanitizeDesignContextText)(value.text)
        : value;
  }
  function serializeArtboardErrorContext(
    errors?: Dynamic,
    firstError?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (errors.length === 0) return [];
    let state: Dynamic = {
        ...Object.fromEntries(
          Object.entries(context).map(
            ([input, input2]: Dynamic): Dynamic => [
              input,
              sanitizeArtboardErrorContext(input2),
            ],
          ),
        ),
        erroredArtboards: [],
        firstError: (0, runtime.sanitizeDesignContextText)(firstError),
      },
      value: Dynamic =
        new TextEncoder().encode(JSON.stringify(state)).length +
        maxArtboardErrorFields,
      items: Dynamic = [];
    for (let value2 of errors.slice(0, maxArtboardErrorMessages) as Dynamic) {
      value += value2.length + 3;
      if (value > runtime.maxDesignContextBytes) break;
      items.push(value2);
    }
    return items;
  }
  function artboardLoadErrorMessage(
    loadError?: Dynamic,
    previewError?: Dynamic,
  ): Dynamic {
    return loadError != null
      ? `Couldn't load this artboard: ${loadError}`
      : previewError != null
        ? `Preview stopped: ${previewError}`
        : null;
  }
  function artboardLoadErrorMessages(
    loadError?: Dynamic,
    previewError?: Dynamic,
    messages?: Dynamic,
  ): Dynamic {
    let value: Dynamic = artboardLoadErrorMessage(loadError, previewError);
    if (value === null) return messages;
    let value2: Dynamic = (0, runtime.sanitizeDesignContextText)(value, 300);
    return value2 === "" ? emptyArtboardErrors : [value2];
  }
  function normalizeArtboardErrorMessages(errors?: Dynamic): Dynamic {
    if (!Array.isArray(errors)) return [];
    let items: Dynamic = [];
    for (let value of errors.slice(0, 10) as Dynamic) {
      let value2: Dynamic =
        typeof value == "object" && value !== null ? value.message : undefined;
      if (typeof value2 != "string") continue;
      let value3: Dynamic = (0, runtime.sanitizeDesignContextText)(value2, 300);
      value3 !== "" && !items.includes(value3) && items.push(value3);
    }
    return items;
  }
  function reuseEqualStringArray(previous?: Dynamic, next?: Dynamic): Dynamic {
    return previous.length === next.length &&
      previous.every(
        (input?: Dynamic, options?: Dynamic): Dynamic =>
          input === next[options],
      )
      ? previous
      : next;
  }
  function updateArtboardErrorMap(
    errorMap?: Dynamic,
    file?: Dynamic,
    messages?: Dynamic,
  ): Dynamic {
    let entry: Dynamic = errorMap.get(file);
    if (
      messages.length === 0
        ? entry === undefined
        : entry !== undefined &&
          reuseEqualStringArray(entry, messages) === entry
    )
      return errorMap;
    let entries: Dynamic = new Map(errorMap);
    messages.length === 0 ? entries.delete(file) : entries.set(file, messages);
    return entries;
  }
  function errorMessagesMatch(
    dismissedMap?: Dynamic,
    file?: Dynamic,
    messages?: Dynamic,
  ): Dynamic {
    return dismissedMap.get(file) === serializeErrorMessages(messages);
  }
  function setDismissedArtboardErrors(
    dismissedMap?: Dynamic,
    file?: Dynamic,
    messages?: Dynamic,
  ): Dynamic {
    return errorMessagesMatch(dismissedMap, file, messages)
      ? dismissedMap
      : new Map(dismissedMap).set(file, serializeErrorMessages(messages));
  }
  function clearDismissedArtboardErrors(
    dismissedMap?: Dynamic,
    file?: Dynamic,
  ): Dynamic {
    if (!dismissedMap.has(file)) return dismissedMap;
    let entries: Dynamic = new Map(dismissedMap);
    entries.delete(file);
    return entries;
  }
  function retainMatchingDismissedErrors(
    errors?: Dynamic,
    dismissedMap?: Dynamic,
  ): Dynamic {
    return new Map(
      [...errors].filter(
        ([input, input2]: Dynamic): Dynamic =>
          errorMessagesMatch(dismissedMap, input, input2),
      ),
    );
  }
  bindRuntimeValue(
    runtime,
    "emptyArtboardErrors",
    () => emptyArtboardErrors,
    (value) => {
      emptyArtboardErrors = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxArtboardErrorMessages",
    () => maxArtboardErrorMessages,
    (value) => {
      maxArtboardErrorMessages = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxArtboardErrorFields",
    () => maxArtboardErrorFields,
    (value) => {
      maxArtboardErrorFields = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sanitizeArtboardErrorContext",
    () => sanitizeArtboardErrorContext,
  );
  bindRuntimeValue(
    runtime,
    "serializeArtboardErrorContext",
    () => serializeArtboardErrorContext,
  );
  bindRuntimeValue(
    runtime,
    "artboardLoadErrorMessage",
    () => artboardLoadErrorMessage,
  );
  bindRuntimeValue(
    runtime,
    "artboardLoadErrorMessages",
    () => artboardLoadErrorMessages,
  );
  bindRuntimeValue(
    runtime,
    "normalizeArtboardErrorMessages",
    () => normalizeArtboardErrorMessages,
  );
  bindRuntimeValue(
    runtime,
    "reuseEqualStringArray",
    () => reuseEqualStringArray,
  );
  bindRuntimeValue(
    runtime,
    "updateArtboardErrorMap",
    () => updateArtboardErrorMap,
  );
  bindRuntimeValue(
    runtime,
    "serializeErrorMessages",
    () => serializeErrorMessages,
    (value) => {
      serializeErrorMessages = value;
    },
  );
  bindRuntimeValue(runtime, "errorMessagesMatch", () => errorMessagesMatch);
  bindRuntimeValue(
    runtime,
    "setDismissedArtboardErrors",
    () => setDismissedArtboardErrors,
  );
  bindRuntimeValue(
    runtime,
    "clearDismissedArtboardErrors",
    () => clearDismissedArtboardErrors,
  );
  bindRuntimeValue(
    runtime,
    "retainMatchingDismissedErrors",
    () => retainMatchingDismissedErrors,
  );
  return () => {
    emptyArtboardErrors = [];
    maxArtboardErrorMessages = 10;
    maxArtboardErrorFields = 32;
    serializeErrorMessages = (input?: Dynamic): Dynamic =>
      JSON.stringify(input);
  };
}
