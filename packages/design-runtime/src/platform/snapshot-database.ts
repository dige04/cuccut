/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformSnapshotDatabase(
  runtime: RuntimeBindings,
): () => void {
  var MAX_PUBLISH_BUNDLE_BYTES: Dynamic;
  var PUBLISH_BUNDLE_EXPIRY_MS: Dynamic;
  var MAX_SNAPSHOT_COLLECTION_DOCS: Dynamic;
  var readPortVersion: Dynamic;
  var SNAPSHOT_MAX_CACHE_RETRIES: Dynamic;
  var SNAPSHOT_CACHE_RETRY_DELAY_MS: Dynamic;
  function hashCanonicalIndex(index?: Dynamic): Dynamic {
    return (0, runtime.sha256)(
      (0, runtime.stringifyCanonicalIndex)(index === undefined ? null : index),
    );
  }
  function parsePublishedIndexMetadata(text?: Dynamic): Dynamic {
    if (text === null) return null;
    try {
      let value: Dynamic = JSON.parse(text),
        callback: Dynamic = (input?: Dynamic): Dynamic =>
          typeof input == "object" && input !== null && !Array.isArray(input);
      return value !== null &&
        (value.v === 1 || value.v === 2) &&
        callback(value.documents) &&
        callback(value.files)
        ? value
        : null;
    } catch {
      return null;
    }
  }
  async function readServerSnapshot(readSnapshot?: Dynamic): Promise<Dynamic> {
    for (let index: Dynamic = 0; ; index++) {
      let value: Dynamic = await readSnapshot();
      if (
        value.metadata?.fromCache !== true &&
        value.metadata?.hasPendingWrites !== true
      )
        return value;
      if (index + 1 >= SNAPSHOT_MAX_CACHE_RETRIES)
        throw Object.assign(
          new Error("the store answered from its cache only"),
          {
            code: "not_authoritative",
          },
        );
      await new Promise((input?: Dynamic): Dynamic => {
        setTimeout(input, SNAPSHOT_CACHE_RETRY_DELAY_MS);
      });
    }
  }
  function createSnapshotDatabaseAdapter(database?: Dynamic): Dynamic {
    return {
      async list(input: Dynamic): Promise<Dynamic> {
        let value: Dynamic = await readServerSnapshot(
            (): Dynamic =>
              database
                .collection(input)
                .limit(MAX_SNAPSHOT_COLLECTION_DOCS)
                .get(),
          ),
          items: Dynamic = [];
        for (let value2 of value.docs as Dynamic)
          value2.exists &&
            items.push({
              path: input + "/" + value2.id,
              data: {
                ...(value2.data() ?? {}),
              },
            });
        return items;
      },
      async get(input: Dynamic): Promise<Dynamic> {
        let value: Dynamic = await readServerSnapshot(
          (): Dynamic => database.doc(input).get(),
        );
        return value.exists
          ? {
              path: input,
              data: {
                ...(value.data() ?? {}),
              },
            }
          : null;
      },
      async update(input: Dynamic, options: Dynamic): Promise<Dynamic> {
        await database.doc(input).update({
          ...options,
        });
      },
      async set(input: Dynamic, options: Dynamic): Promise<Dynamic> {
        await database.doc(input).set({
          ...options,
        });
      },
      async acquire(input: Dynamic, options: Dynamic): Promise<Dynamic> {
        let value: Dynamic = database.doc(input);
        if (typeof value.acquire != "function") return "unsupported";
        let value2: Dynamic = await value.acquire(options);
        return {
          acquired: value2.acquired === true,
          ...(typeof value2.expiresAt == "string"
            ? {
                expiresAt: value2.expiresAt,
              }
            : {}),
        };
      },
      watch(input: Dynamic, options: Dynamic): Dynamic {
        let flag: Dynamic = true,
          value: Dynamic,
          callback: Dynamic = (input2?: Dynamic): Dynamic => {
            try {
              return input2
                .docChanges?.()
                .map(
                  (input3?: Dynamic): Dynamic => input + "/" + input3.doc.id,
                );
            } catch {
              return;
            }
          };
        try {
          value = database
            .collection(input)
            .limit(MAX_SNAPSHOT_COLLECTION_DOCS)
            .onSnapshot(
              (input2?: Dynamic): Dynamic => {
                flag ? (flag = false) : options(callback(input2));
              },
              (): Dynamic => {},
            );
        } catch {
          value = undefined;
        }
        return (): Dynamic => {
          try {
            value?.();
          } catch {}
        };
      },
    };
  }
  async function getSnapshotDatabaseAdapter(): Promise<Dynamic> {
    let value: Dynamic = await (0, runtime.resolveDatabaseCapability)();
    return value === null ? null : createSnapshotDatabaseAdapter(value);
  }
  bindRuntimeValue(
    runtime,
    "MAX_PUBLISH_BUNDLE_BYTES",
    () => MAX_PUBLISH_BUNDLE_BYTES,
    (value) => {
      MAX_PUBLISH_BUNDLE_BYTES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PUBLISH_BUNDLE_EXPIRY_MS",
    () => PUBLISH_BUNDLE_EXPIRY_MS,
    (value) => {
      PUBLISH_BUNDLE_EXPIRY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_SNAPSHOT_COLLECTION_DOCS",
    () => MAX_SNAPSHOT_COLLECTION_DOCS,
    (value) => {
      MAX_SNAPSHOT_COLLECTION_DOCS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "readPortVersion",
    () => readPortVersion,
    (value) => {
      readPortVersion = value;
    },
  );
  bindRuntimeValue(runtime, "hashCanonicalIndex", () => hashCanonicalIndex);
  bindRuntimeValue(
    runtime,
    "parsePublishedIndexMetadata",
    () => parsePublishedIndexMetadata,
  );
  bindRuntimeValue(
    runtime,
    "SNAPSHOT_MAX_CACHE_RETRIES",
    () => SNAPSHOT_MAX_CACHE_RETRIES,
    (value) => {
      SNAPSHOT_MAX_CACHE_RETRIES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SNAPSHOT_CACHE_RETRY_DELAY_MS",
    () => SNAPSHOT_CACHE_RETRY_DELAY_MS,
    (value) => {
      SNAPSHOT_CACHE_RETRY_DELAY_MS = value;
    },
  );
  bindRuntimeValue(runtime, "readServerSnapshot", () => readServerSnapshot);
  bindRuntimeValue(
    runtime,
    "createSnapshotDatabaseAdapter",
    () => createSnapshotDatabaseAdapter,
  );
  bindRuntimeValue(
    runtime,
    "getSnapshotDatabaseAdapter",
    () => getSnapshotDatabaseAdapter,
  );
  return () => {
    MAX_PUBLISH_BUNDLE_BYTES = 15 * 1024 * 1024;
    PUBLISH_BUNDLE_EXPIRY_MS = 5 * 6e4;
    MAX_SNAPSHOT_COLLECTION_DOCS = 1e3;
    readPortVersion = runtime.migrationMetadataPath;
    SNAPSHOT_MAX_CACHE_RETRIES = 5;
    SNAPSHOT_CACHE_RETRY_DELAY_MS = 400;
  };
}
