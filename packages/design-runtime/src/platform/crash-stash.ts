/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformCrashStash(
  runtime: RuntimeBindings,
): () => void {
  var CRASH_STASH_TTL_MS: Dynamic;
  var CRASH_STASH_RETENTION_LABEL: Dynamic;
  var MAX_CRASH_STASH_EDITS_PER_ENTRY: Dynamic;
  var MAX_CRASH_STASH_ENTRY_CHARS: Dynamic;
  var MAX_CRASH_STASH_CHARS: Dynamic;
  var crashStashKey: Dynamic;
  var crashStashEditSize: Dynamic;
  var baseArtifactIdentity: Dynamic;
  var isCrashStashEntry: Dynamic;
  var CRASH_STASH_DATABASE: Dynamic;
  var CRASH_STASH_STORE: Dynamic;
  var ARTIFACT_VERSION_PATH_PATTERN: Dynamic;
  var CRASH_STASH_LOCK_PREFIX: Dynamic;
  var getNavigatorLocks: Dynamic;
  function extractPortFileText(value?: Dynamic): Dynamic {
    if (value === null) return "";
    let content: Dynamic =
      typeof value == "object" &&
      !(typeof Blob !== "undefined" && value instanceof Blob)
        ? value.content
        : value;
    return typeof content == "string" ? content : "";
  }
  function createCrashStash(
    store?: Dynamic,
    artifactId?: Dynamic,
    viewerId?: Dynamic,
    tabId?: Dynamic,
    now?: Dynamic,
    getActiveTabs?: Dynamic,
  ): Dynamic {
    let key: Dynamic = crashStashKey(artifactId, viewerId, tabId),
      pending: Dynamic = [],
      attempt: Dynamic = async (
        input?: Dynamic,
        options?: Dynamic,
      ): Promise<Dynamic> => {
        try {
          return await options();
        } catch {
          return input;
        }
      },
      isSameArtifact: Dynamic = (input?: Dynamic): Dynamic =>
        baseArtifactIdentity(input.artifactId) ===
        baseArtifactIdentity(artifactId),
      pruneExpiredEntries: Dynamic = async (): Promise<Dynamic> => {
        let items: Dynamic = [];
        for (let value of (await store.all()) as Dynamic) {
          if (
            !isCrashStashEntry(value) ||
            now() - value.createdAt > CRASH_STASH_TTL_MS
          ) {
            typeof value?.key == "string" && (await store.delete(value.key));
            continue;
          }
          items.push(value);
        }
        return items;
      },
      getOtherActiveTabs: Dynamic = async (): Promise<Dynamic> => {
        let values: Dynamic = new Set(
          await getActiveTabs().catch((): Dynamic => new Set()),
        );
        values.delete(tabId);
        return values;
      };
    return {
      put: (items?: Dynamic, options?: Dynamic): Dynamic =>
        attempt(false, async (): Promise<Dynamic> => {
          if (viewerId === "") return false;
          if (items.length === 0) {
            await store.delete(key);
            return true;
          }
          let items2: Dynamic = [],
            index: Dynamic = 0;
          for (let value6 of items as Dynamic)
            items2.length >= MAX_CRASH_STASH_EDITS_PER_ENTRY ||
              index + crashStashEditSize(value6) >
                MAX_CRASH_STASH_ENTRY_CHARS ||
              (items2.push({
                path: value6.path,
                text: value6.text,
                base: value6.base,
              }),
              (index += crashStashEditSize(value6)));
          let value: Dynamic = await pruneExpiredEntries(),
            value2: Dynamic = await getOtherActiveTabs(),
            value3: Dynamic = value.filter(
              (input?: Dynamic): Dynamic => input.key !== key,
            ),
            value4: Dynamic =
              index +
              value3.reduce(
                (input?: Dynamic, options2?: Dynamic): Dynamic =>
                  input + options2.chars,
                0,
              );
          for (let value6 of value3
            .filter((input?: Dynamic): Dynamic => !value2.has(input.tabId))
            .sort(
              (input?: Dynamic, options2?: Dynamic): Dynamic =>
                input.at - options2.at,
            ) as Dynamic) {
            if (value4 <= MAX_CRASH_STASH_CHARS) break;
            await store.delete(value6.key);
            value4 -= value6.chars;
          }
          if (value4 > MAX_CRASH_STASH_CHARS) return false;
          let value5: Dynamic =
            value.find((input?: Dynamic): Dynamic => input.key === key)
              ?.createdAt ?? now();
          await store.put({
            key: key,
            artifactId: artifactId,
            viewerId: viewerId,
            tabId: tabId,
            createdAt: value5,
            at: now(),
            version: options,
            edits: items2,
            chars: index,
          });
          return items2.length === items.length;
        }),
      read: (): Dynamic =>
        attempt(undefined, async (): Promise<Dynamic> => {
          if (viewerId === "") return;
          let value: Dynamic = await getOtherActiveTabs(),
            value2: Dynamic = (await pruneExpiredEntries())
              .filter(
                (input?: Dynamic): Dynamic =>
                  input.artifactId === artifactId &&
                  input.viewerId === viewerId &&
                  !value.has(input.tabId),
              )
              .sort(
                (input?: Dynamic, options?: Dynamic): Dynamic =>
                  input.at - options.at,
              );
          pending = value2.map(
            (input?: Dynamic): Dynamic => ({
              key: input.key,
              at: input.at,
            }),
          );
          let entries: Dynamic = new Map();
          for (let value4 of value2 as Dynamic)
            for (let value5 of value4.edits as Dynamic)
              entries.set(value5.path, value5);
          if (entries.size === 0) return;
          let value3: Dynamic = value2[value2.length - 1];
          return {
            createdAt: Math.min(
              ...value2.map((input?: Dynamic): Dynamic => input.createdAt),
            ),
            at: value3.at,
            version: value3.version,
            edits: [...entries.values()],
          };
        }),
      clear: (): Dynamic =>
        attempt(undefined, (): Dynamic => store.delete(key)),
      clearOffered: (): Dynamic =>
        attempt(undefined, async (): Promise<Dynamic> => {
          let value: Dynamic = pending;
          pending = [];
          let entries: Dynamic = new Map(
            (await store.all()).map(
              (input?: Dynamic): Dynamic => [input.key, input.at],
            ),
          );
          for (let value2 of value as Dynamic)
            entries.get(value2.key) === value2.at &&
              (await store.delete(value2.key));
        }),
      clearArtifact: (): Dynamic =>
        attempt(undefined, async (): Promise<Dynamic> => {
          for (let value of (await store.all()) as Dynamic)
            typeof value?.artifactId == "string" &&
              isSameArtifact(value) &&
              (await store.delete(value.key));
        }),
      purgeOtherViewers: (): Dynamic =>
        attempt(undefined, async (): Promise<Dynamic> => {
          for (let value of (await pruneExpiredEntries()) as Dynamic)
            viewerId !== "" &&
              isSameArtifact(value) &&
              value.viewerId !== viewerId &&
              (await store.delete(value.key));
        }),
    };
  }
  function awaitIndexedDbRequest(request?: Dynamic): Dynamic {
    return new Promise((input?: Dynamic, options?: Dynamic): Dynamic => {
      request.onsuccess = (): Dynamic => input(request.result);
      request.onerror = (): Dynamic =>
        options(request.error ?? new Error("indexedDB request failed"));
    });
  }
  function createIndexedDbStashStore(indexedDb?: Dynamic): Dynamic {
    let databasePromise: Dynamic,
      openDatabase: Dynamic = (): Dynamic => (
        (databasePromise ??= new Promise(
          (input?: Dynamic, options?: Dynamic): Dynamic => {
            let value: Dynamic = indexedDb.open(CRASH_STASH_DATABASE, 1);
            value.onupgradeneeded = (): Dynamic => {
              value.result.createObjectStore(CRASH_STASH_STORE, {
                keyPath: "key",
              });
            };
            value.onsuccess = (): Dynamic => input(value.result);
            value.onerror = (): Dynamic =>
              options(value.error ?? new Error("indexedDB open failed"));
            value.onblocked = (): Dynamic =>
              options(new Error("indexedDB open blocked"));
          },
        )),
        databasePromise.catch((): Dynamic => {
          databasePromise = undefined;
        }),
        databasePromise
      ),
      callback: Dynamic = async (input?: Dynamic): Promise<Dynamic> => {
        let value: Dynamic = (await openDatabase()).transaction(
            CRASH_STASH_STORE,
            "readwrite",
          ),
          promise: Dynamic = new Promise(
            (input2?: Dynamic, options?: Dynamic): Dynamic => {
              value.oncomplete = (): Dynamic => input2();
              value.onerror = (): Dynamic =>
                options(
                  value.error ?? new Error("indexedDB transaction failed"),
                );
              value.onabort = (): Dynamic =>
                options(
                  value.error ?? new Error("indexedDB transaction aborted"),
                );
            },
          );
        await Promise.all([
          awaitIndexedDbRequest(input(value.objectStore(CRASH_STASH_STORE))),
          promise,
        ]);
      };
    return {
      all: async (): Promise<Dynamic> =>
        awaitIndexedDbRequest(
          (await openDatabase())
            .transaction(CRASH_STASH_STORE, "readonly")
            .objectStore(CRASH_STASH_STORE)
            .getAll(),
        ),
      put: (input?: Dynamic): Dynamic =>
        callback((input2?: Dynamic): Dynamic => input2.put(input)),
      delete: (input?: Dynamic): Dynamic =>
        callback((input2?: Dynamic): Dynamic => input2.delete(input)),
    };
  }
  function artifactPathIdentity(
    location2: Dynamic = (globalThis as Dynamic).location,
  ): Dynamic {
    return (location2?.pathname ?? "").replace(
      ARTIFACT_VERSION_PATH_PATTERN,
      "$1",
    );
  }
  function trackActiveStashTabs(tabId?: Dynamic): Dynamic {
    let locks: Dynamic = getNavigatorLocks();
    return locks === undefined
      ? (): Dynamic => Promise.resolve(new Set())
      : (locks
          .request(
            CRASH_STASH_LOCK_PREFIX + tabId,
            (): Dynamic => new Promise((): Dynamic => {}),
          )
          .catch((): Dynamic => {}),
        async (): Promise<Dynamic> =>
          new Set(
            ((await locks.query()).held ?? [])
              .map((input?: Dynamic): Dynamic => input.name ?? "")
              .filter(
                (input?: Dynamic): Dynamic =>
                  input.startsWith(CRASH_STASH_LOCK_PREFIX),
              )
              .map(
                (input?: Dynamic): Dynamic =>
                  input.slice(CRASH_STASH_LOCK_PREFIX.length),
              ),
          ));
  }
  function createBrowserCrashStash(options?: Dynamic): Dynamic {
    let indexedDb: Dynamic;
    try {
      indexedDb = options.indexedDB ?? (globalThis as Dynamic).indexedDB;
    } catch {
      indexedDb = undefined;
    }
    if (indexedDb === undefined || typeof options.viewerId != "string")
      return null;
    let value: Dynamic = options.tabId ?? crypto.randomUUID();
    return createCrashStash(
      createIndexedDbStashStore(indexedDb),
      options.artifactId ?? artifactPathIdentity(),
      options.viewerId,
      value,
      options.now ?? Date.now,
      options.liveTabs ?? trackActiveStashTabs(value),
    );
  }
  async function restoreBrowserCrashStash(
    suffix: Dynamic = "",
  ): Promise<Dynamic> {
    let viewerId: Dynamic = (await (0, runtime.getCurrentUserId)()) ?? "",
      stash: Dynamic = createBrowserCrashStash({
        viewerId: viewerId,
        artifactId:
          artifactPathIdentity() + (suffix === "" ? "" : "#" + suffix),
      });
    await stash?.purgeOtherViewers();
    return stash;
  }
  bindRuntimeValue(runtime, "extractPortFileText", () => extractPortFileText);
  bindRuntimeValue(
    runtime,
    "CRASH_STASH_TTL_MS",
    () => CRASH_STASH_TTL_MS,
    (value) => {
      CRASH_STASH_TTL_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CRASH_STASH_RETENTION_LABEL",
    () => CRASH_STASH_RETENTION_LABEL,
    (value) => {
      CRASH_STASH_RETENTION_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_CRASH_STASH_EDITS_PER_ENTRY",
    () => MAX_CRASH_STASH_EDITS_PER_ENTRY,
    (value) => {
      MAX_CRASH_STASH_EDITS_PER_ENTRY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_CRASH_STASH_ENTRY_CHARS",
    () => MAX_CRASH_STASH_ENTRY_CHARS,
    (value) => {
      MAX_CRASH_STASH_ENTRY_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_CRASH_STASH_CHARS",
    () => MAX_CRASH_STASH_CHARS,
    (value) => {
      MAX_CRASH_STASH_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "crashStashKey",
    () => crashStashKey,
    (value) => {
      crashStashKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "crashStashEditSize",
    () => crashStashEditSize,
    (value) => {
      crashStashEditSize = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "baseArtifactIdentity",
    () => baseArtifactIdentity,
    (value) => {
      baseArtifactIdentity = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isCrashStashEntry",
    () => isCrashStashEntry,
    (value) => {
      isCrashStashEntry = value;
    },
  );
  bindRuntimeValue(runtime, "createCrashStash", () => createCrashStash);
  bindRuntimeValue(
    runtime,
    "CRASH_STASH_DATABASE",
    () => CRASH_STASH_DATABASE,
    (value) => {
      CRASH_STASH_DATABASE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CRASH_STASH_STORE",
    () => CRASH_STASH_STORE,
    (value) => {
      CRASH_STASH_STORE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "awaitIndexedDbRequest",
    () => awaitIndexedDbRequest,
  );
  bindRuntimeValue(
    runtime,
    "createIndexedDbStashStore",
    () => createIndexedDbStashStore,
  );
  bindRuntimeValue(
    runtime,
    "ARTIFACT_VERSION_PATH_PATTERN",
    () => ARTIFACT_VERSION_PATH_PATTERN,
    (value) => {
      ARTIFACT_VERSION_PATH_PATTERN = value;
    },
  );
  bindRuntimeValue(runtime, "artifactPathIdentity", () => artifactPathIdentity);
  bindRuntimeValue(
    runtime,
    "CRASH_STASH_LOCK_PREFIX",
    () => CRASH_STASH_LOCK_PREFIX,
    (value) => {
      CRASH_STASH_LOCK_PREFIX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getNavigatorLocks",
    () => getNavigatorLocks,
    (value) => {
      getNavigatorLocks = value;
    },
  );
  bindRuntimeValue(runtime, "trackActiveStashTabs", () => trackActiveStashTabs);
  bindRuntimeValue(
    runtime,
    "createBrowserCrashStash",
    () => createBrowserCrashStash,
  );
  bindRuntimeValue(
    runtime,
    "restoreBrowserCrashStash",
    () => restoreBrowserCrashStash,
  );
  return () => {
    CRASH_STASH_TTL_MS = 4320 * 60 * 1e3;
    CRASH_STASH_RETENTION_LABEL = "3 days";
    MAX_CRASH_STASH_EDITS_PER_ENTRY = 64;
    MAX_CRASH_STASH_ENTRY_CHARS = 1e6;
    MAX_CRASH_STASH_CHARS = 2e6;
    crashStashKey = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
    ): Dynamic => [input, options, context].join("\0");
    crashStashEditSize = (input?: Dynamic): Dynamic =>
      input.path.length + (input.text?.length ?? 0);
    baseArtifactIdentity = (input?: Dynamic): Dynamic => input.split("#")[0];
    isCrashStashEntry = (input?: Dynamic): Dynamic =>
      typeof input?.key == "string" &&
      typeof input.artifactId == "string" &&
      typeof input.viewerId == "string" &&
      Number.isFinite(input.createdAt) &&
      Number.isFinite(input.at) &&
      Number.isFinite(input.chars) &&
      input.chars >= 0 &&
      Array.isArray(input.edits) &&
      input.edits.every(
        (input2?: Dynamic): Dynamic =>
          typeof input2?.path == "string" &&
          (typeof input2.text == "string" || input2.text === null) &&
          (typeof input2.base == "string" || input2.base === null),
      );
    CRASH_STASH_DATABASE = "appifact-crash-stash";
    CRASH_STASH_STORE = "entries";
    ARTIFACT_VERSION_PATH_PATTERN = /(^|\/)_f\/[^/]+\//;
    CRASH_STASH_LOCK_PREFIX = "appifact-stash-tab:";
    getNavigatorLocks = (): Dynamic => {
      try {
        return (globalThis as Dynamic).navigator?.locks;
      } catch {
        return;
      }
    };
  };
}
