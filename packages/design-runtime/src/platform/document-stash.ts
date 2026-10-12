/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformDocumentStash(
  runtime: RuntimeBindings,
): () => void {
  var readOnlyDocumentMessage: Dynamic;
  var documentStashStoragePrefix: Dynamic;
  var readOnlyStashStoragePrefix: Dynamic;
  function getDocumentStashKey(input?: Dynamic): Dynamic {
    return (
      documentStashStoragePrefix + (0, runtime.normalizeArtifactPath)(input)
    );
  }
  function createSessionStorageAdapter(input?: Dynamic): Dynamic {
    return {
      read(): Dynamic {
        try {
          return sessionStorage.getItem(input);
        } catch {
          return null;
        }
      },
      write(input2: Dynamic): Dynamic {
        try {
          sessionStorage.setItem(input, input2);
          return true;
        } catch {
          return false;
        }
      },
      clear(): Dynamic {
        try {
          sessionStorage.removeItem(input);
        } catch {}
      },
    };
  }
  function createDocumentStash(): Dynamic {
    return createSessionStorageAdapter(getDocumentStashKey(location.pathname));
  }
  function readReadOnlyStash(): Dynamic {
    let value: Dynamic = createReadOnlyStash().read();
    return value !== null && value.length > 0 ? value : null;
  }
  function createReadOnlyStash(): Dynamic {
    return typeof location === "undefined"
      ? {
          read: (): Dynamic => null,
          write: (): Dynamic => false,
          clear: (): Dynamic => {},
        }
      : createSessionStorageAdapter(
          readOnlyStashStoragePrefix +
            getDocumentStashKey(location.pathname).slice(
              documentStashStoragePrefix.length,
            ),
        );
  }
  function hashDocumentState(items?: Dynamic): Dynamic {
    let count: Dynamic = 3735928559,
      count2: Dynamic = 1103547991;
    for (let index: Dynamic = 0; index < items.length; index++) {
      let value: Dynamic = items.charCodeAt(index);
      count = Math.imul(count ^ value, 2654435761);
      count2 = Math.imul(count2 ^ value, 1597334677);
    }
    count =
      Math.imul(count ^ (count >>> 16), 2246822507) ^
      Math.imul(count2 ^ (count2 >>> 13), 3266489909);
    count2 =
      Math.imul(count2 ^ (count2 >>> 16), 2246822507) ^
      Math.imul(count ^ (count >>> 13), 3266489909);
    return (
      (count2 >>> 0).toString(16).padStart(8, "0") +
      (count >>> 0).toString(16).padStart(8, "0")
    );
  }
  function parseDocumentStash(input?: Dynamic): Dynamic {
    if (input !== null)
      try {
        let value: Dynamic = JSON.parse(input);
        if (
          typeof value == "object" &&
          value !== null &&
          (value.v === 2 || value.v === 1) &&
          typeof value.at == "number" &&
          "state" in value
        ) {
          let value2: Dynamic = value;
          return {
            at: value2.at,
            state: value2.state,
            ops: value2.ops,
            expectEmbed:
              typeof value2.expectEmbed == "string"
                ? value2.expectEmbed
                : undefined,
          };
        }
      } catch {}
  }
  bindRuntimeValue(
    runtime,
    "readOnlyDocumentMessage",
    () => readOnlyDocumentMessage,
    (value) => {
      readOnlyDocumentMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "documentStashStoragePrefix",
    () => documentStashStoragePrefix,
    (value) => {
      documentStashStoragePrefix = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "readOnlyStashStoragePrefix",
    () => readOnlyStashStoragePrefix,
    (value) => {
      readOnlyStashStoragePrefix = value;
    },
  );
  bindRuntimeValue(runtime, "getDocumentStashKey", () => getDocumentStashKey);
  bindRuntimeValue(
    runtime,
    "createSessionStorageAdapter",
    () => createSessionStorageAdapter,
  );
  bindRuntimeValue(runtime, "createDocumentStash", () => createDocumentStash);
  bindRuntimeValue(runtime, "readReadOnlyStash", () => readReadOnlyStash);
  bindRuntimeValue(runtime, "createReadOnlyStash", () => createReadOnlyStash);
  bindRuntimeValue(runtime, "hashDocumentState", () => hashDocumentState);
  bindRuntimeValue(runtime, "parseDocumentStash", () => parseDocumentStash);
  return () => {
    readOnlyDocumentMessage =
      "You can view this artifact but not edit it. Saving needs write access from an owner.";
    documentStashStoragePrefix = "appifact-stash/";
    readOnlyStashStoragePrefix = "appifact-ro/";
  };
}
