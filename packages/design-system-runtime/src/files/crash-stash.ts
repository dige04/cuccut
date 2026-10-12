/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type {
  CrashStashStorageRaw,
  CrashStashOffer,
  CrashStashHead,
  CrashStashWireValue,
  IndexedCrashStashOptions,
} from "../contracts/files-core";
import type * as Files from "../contracts";
export function installFilesCrashStash(runtime: RuntimeBindings): () => void {
  var CRASH_STASH_MAX_AGE_MS: number;
  var CRASH_STASH_RETENTION_LABEL: string;
  var CRASH_STASH_MAX_ENTRIES: number;
  var CRASH_STASH_MAX_ARTIFACT_CHARS: number;
  var CRASH_STASH_MAX_TOTAL_CHARS: number;
  var crashStashIdentityKey: (
    artifact: string,
    viewer: string,
    tab: string,
  ) => string;
  var crashStashEntrySize: (edit: Files.StashedFileEdit) => number;
  var stripArtifactScopeFragment: (artifact: string) => string;
  var isCrashStashEntry: (value: unknown) => value is Files.CrashStashEntry;
  var CRASH_STASH_DATABASE_NAME: string;
  var CRASH_STASH_OBJECT_STORE: string;
  var FRAME_SCOPE_PATH_PATTERN: RegExp;
  var CRASH_STASH_TAB_LOCK_PREFIX: string;
  var getNavigatorLocks: () => LockManager | undefined;
  function createCrashStashKit(
    storage: CrashStashStorageRaw,
    artifactId: string,
    viewerId: string,
    tabId: string,
    now: () => number,
    liveTabs: () => Promise<Set<string>>,
  ): Files.FilesCrashStash {
    let value = crashStashIdentityKey(artifactId, viewerId, tabId),
      items: CrashStashHead[] = [],
      callback = async <Default, Result>(
        input: Default,
        options: () => Result | Promise<Result>,
      ): Promise<Default | Result> => {
        try {
          return await options();
        } catch {
          return input;
        }
      },
      callback2 = (input: { artifactId: string }): boolean =>
        stripArtifactScopeFragment(input.artifactId) ===
        stripArtifactScopeFragment(artifactId),
      callback3 = async (): Promise<Files.CrashStashEntry[]> => {
        let items2: Files.CrashStashEntry[] = [];
        for (let value2 of await storage.all()) {
          if (
            !isCrashStashEntry(value2) ||
            now() - value2.createdAt > CRASH_STASH_MAX_AGE_MS
          ) {
            if (
              typeof (value2 as CrashStashWireValue | null)?.key === "string"
            ) {
              await storage.delete((value2 as { key: string }).key);
            }
            continue;
          }
          items2.push(value2);
        }
        return items2;
      },
      callback4 = async (): Promise<Set<string>> => {
        let values = new Set(await liveTabs().catch(() => new Set<string>()));
        values.delete(tabId);
        return values;
      };
    return {
      put: (items2: Files.StashedFileEdit[], options: string) =>
        callback(false, async (): Promise<boolean> => {
          if (viewerId === "") {
            return false;
          }
          if (items2.length === 0) {
            await storage.delete(value);
            return true;
          }
          let items3: Files.StashedFileEdit[] = [],
            index = 0;
          for (let value7 of items2) {
            if (
              items3.length >= CRASH_STASH_MAX_ENTRIES ||
              index + crashStashEntrySize(value7) >
                CRASH_STASH_MAX_ARTIFACT_CHARS
            ) {
              continue;
            }
            items3.push({
              path: value7.path,
              text: value7.text,
              base: value7.base,
            });
            index += crashStashEntrySize(value7);
          }
          let value2 = await callback3(),
            value3 = await callback4(),
            value4 = value2.filter(
              (input: Files.CrashStashEntry): boolean => input.key !== value,
            ),
            value5 =
              index +
              value4.reduce(
                (input: number, options2: Files.CrashStashEntry) =>
                  input + options2.chars,
                0,
              );
          for (let value7 of value4
            .filter(
              (input: Files.CrashStashEntry): boolean =>
                !value3.has(input.tabId),
            )
            .sort(
              (input: Files.CrashStashEntry, options2: Files.CrashStashEntry) =>
                input.at - options2.at,
            )) {
            if (value5 <= CRASH_STASH_MAX_TOTAL_CHARS) {
              break;
            }
            await storage.delete(value7.key);
            value5 -= value7.chars;
          }
          if (value5 > CRASH_STASH_MAX_TOTAL_CHARS) {
            return false;
          }
          let value6 =
            value2.find(
              (input: Files.CrashStashEntry): boolean => input.key === value,
            )?.createdAt ?? now();
          await storage.put({
            key: value,
            artifactId: artifactId,
            viewerId: viewerId,
            tabId: tabId,
            createdAt: value6,
            at: now(),
            version: options,
            edits: items3,
            chars: index,
          });
          return items3.length === items2.length;
        }),
      read: () =>
        callback(undefined, async (): Promise<CrashStashOffer> => {
          if (viewerId === "") {
            return;
          }
          let value2 = await callback4(),
            value3 = (await callback3())
              .filter(
                (input: Files.CrashStashEntry) =>
                  input.artifactId === artifactId &&
                  input.viewerId === viewerId &&
                  !value2.has(input.tabId),
              )
              .sort(
                (
                  input: Files.CrashStashEntry,
                  options: Files.CrashStashEntry,
                ) => input.at - options.at,
              );
          items = value3.map((input: Files.CrashStashEntry) => ({
            key: input.key,
            at: input.at,
          }));
          let entries: Map<string, Files.StashedFileEdit> = new Map();
          for (let value5 of value3) {
            for (let value6 of value5.edits) {
              entries.set(value6.path, value6);
            }
          }
          if (entries.size === 0) {
            return;
          }
          let value4 = value3[value3.length - 1];
          return {
            createdAt: Math.min(
              ...value3.map((input: Files.CrashStashEntry) => input.createdAt),
            ),
            at: value4.at,
            version: value4.version,
            edits: [...entries.values()],
          };
        }),
      clear: () => callback(undefined, () => storage.delete(value)),
      clearOffered: () =>
        callback(undefined, async (): Promise<void> => {
          let value2 = items;
          items = [];
          let entries = new Map(
            (await storage.all()).map((input: unknown): [unknown, unknown] => [
              (input as CrashStashWireValue).key,
              (input as CrashStashWireValue).at,
            ]),
          );
          for (let value3 of value2) {
            if (entries.get(value3.key) === value3.at) {
              await storage.delete(value3.key);
            }
          }
        }),
      clearArtifact: () =>
        callback(undefined, async (): Promise<void> => {
          for (let value2 of await storage.all()) {
            if (
              typeof (value2 as CrashStashWireValue | null)?.artifactId ===
                "string" &&
              callback2(value2 as { artifactId: string })
            ) {
              await storage.delete((value2 as { key: string }).key);
            }
          }
        }),
      purgeOtherViewers: () =>
        callback(undefined, async (): Promise<void> => {
          for (let value2 of await callback3()) {
            if (
              viewerId !== "" &&
              callback2(value2) &&
              value2.viewerId !== viewerId
            ) {
              await storage.delete((value2 as { key: string }).key);
            }
          }
        }),
    };
  }
  function awaitIndexedDbRequest<Value>(
    request: IDBRequest<Value>,
  ): Promise<Value> {
    return new Promise<Value>(
      (
        input: (value: Value) => void,
        options: (reason: unknown) => void,
      ): void => {
        request.onsuccess = () => input(request.result);
        request.onerror = () =>
          options(request.error ?? Error("indexedDB request failed"));
      },
    );
  }
  function createIndexedDbCrashStashStorage(indexedDb: IDBFactory) {
    let value: Promise<IDBDatabase> | undefined,
      callback = () => {
        value ??= new Promise<IDBDatabase>(
          (
            input: (value: IDBDatabase) => void,
            options: (reason: unknown) => void,
          ): void => {
            let value2 = indexedDb.open(CRASH_STASH_DATABASE_NAME, 1);
            value2.onupgradeneeded = (): void => {
              value2.result.createObjectStore(CRASH_STASH_OBJECT_STORE, {
                keyPath: "key",
              });
            };
            value2.onsuccess = () => input(value2.result);
            value2.onerror = () =>
              options(value2.error ?? Error("indexedDB open failed"));
            value2.onblocked = () => options(Error("indexedDB open blocked"));
          },
        );
        value.catch((): void => {
          value = undefined;
        });
        return value;
      },
      callback2 = async <Result>(
        input: (store: IDBObjectStore) => IDBRequest<Result>,
      ): Promise<void> => {
        let value2 = (await callback()).transaction(
            CRASH_STASH_OBJECT_STORE,
            "readwrite",
          ),
          promise = new Promise<void>(
            (input2: () => void, options: (reason: unknown) => void): void => {
              value2.oncomplete = () => input2();
              value2.onerror = () =>
                options(value2.error ?? Error("indexedDB transaction failed"));
              value2.onabort = () =>
                options(value2.error ?? Error("indexedDB transaction aborted"));
            },
          );
        await Promise.all([
          awaitIndexedDbRequest(
            input(value2.objectStore(CRASH_STASH_OBJECT_STORE)),
          ),
          promise,
        ]);
      };
    return {
      all: async (): Promise<unknown[]> =>
        awaitIndexedDbRequest(
          (await callback())
            .transaction(CRASH_STASH_OBJECT_STORE, "readonly")
            .objectStore(CRASH_STASH_OBJECT_STORE)
            .getAll() as IDBRequest<unknown[]>,
        ),
      put: (input: Files.CrashStashEntry) =>
        callback2((input2: IDBObjectStore) => input2.put(input)),
      delete: (input: string) =>
        callback2((input2: IDBObjectStore) => input2.delete(input)),
    };
  }
  function artifactPathWithoutFrameScope(
    location2: Pick<Location, "pathname"> | undefined = globalThis.location,
  ) {
    return (location2?.pathname ?? "").replace(FRAME_SCOPE_PATH_PATTERN, "$1");
  }
  function claimCrashStashTabLock(tabId: string) {
    let locks = getNavigatorLocks();
    if (locks === undefined) {
      return () => Promise.resolve(new Set<string>());
    }
    locks
      .request(
        CRASH_STASH_TAB_LOCK_PREFIX + tabId,
        () =>
          new Promise((): void => {
            return;
          }),
      )
      .catch((): void => {
        return;
      });
    return async (): Promise<Set<string>> =>
      new Set(
        ((await locks.query()).held ?? [])
          .map((input: LockInfo) => input.name ?? "")
          .filter((input: string) =>
            input.startsWith(CRASH_STASH_TAB_LOCK_PREFIX),
          )
          .map((input: string) =>
            input.slice(CRASH_STASH_TAB_LOCK_PREFIX.length),
          ),
      );
  }
  function createIndexedDbCrashStashKit(options: IndexedCrashStashOptions) {
    let indexedDb: IDBFactory | undefined;
    try {
      indexedDb = options.indexedDB ?? globalThis.indexedDB;
    } catch {
      indexedDb = undefined;
    }
    if (indexedDb === undefined || typeof options.viewerId !== "string") {
      return null;
    }
    let tabId = options.tabId ?? crypto.randomUUID();
    return createCrashStashKit(
      createIndexedDbCrashStashStorage(indexedDb),
      options.artifactId ?? artifactPathWithoutFrameScope(),
      options.viewerId,
      tabId,
      options.now ?? Date.now,
      options.liveTabs ?? claimCrashStashTabLock(tabId),
    );
  }
  async function createCurrentArtifactCrashStash(
    scope = "",
  ): Promise<Files.FilesCrashStash | null> {
    let value = (await (0, runtime.currentUserId)()) ?? "",
      value2 = createIndexedDbCrashStashKit({
        viewerId: value,
        artifactId:
          artifactPathWithoutFrameScope() + (scope === "" ? "" : "#" + scope),
      });
    await value2?.purgeOtherViewers();
    return value2;
  }
  async function applyCrashStashEdits(
    input: Files.FilesCrashStash,
    options: (path: string) => string | null | undefined,
  ): Promise<CrashStashOffer> {
    let value = await input.read();
    if (value === undefined) {
      return;
    }
    let value2 = value.edits.filter((input2: Files.StashedFileEdit) => {
      let value3 = options(input2.path);
      return value3 === undefined || value3 !== input2.text;
    });
    if (value2.length === 0) {
      await input.clearOffered();
      return;
    }
    return {
      ...value,
      edits: value2,
    };
  }
  bindRuntimeValue(
    runtime,
    "CRASH_STASH_MAX_AGE_MS",
    () => CRASH_STASH_MAX_AGE_MS,
    (value) => {
      CRASH_STASH_MAX_AGE_MS = value;
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
    "CRASH_STASH_MAX_ENTRIES",
    () => CRASH_STASH_MAX_ENTRIES,
    (value) => {
      CRASH_STASH_MAX_ENTRIES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CRASH_STASH_MAX_ARTIFACT_CHARS",
    () => CRASH_STASH_MAX_ARTIFACT_CHARS,
    (value) => {
      CRASH_STASH_MAX_ARTIFACT_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CRASH_STASH_MAX_TOTAL_CHARS",
    () => CRASH_STASH_MAX_TOTAL_CHARS,
    (value) => {
      CRASH_STASH_MAX_TOTAL_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "crashStashIdentityKey",
    () => crashStashIdentityKey,
    (value) => {
      crashStashIdentityKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "crashStashEntrySize",
    () => crashStashEntrySize,
    (value) => {
      crashStashEntrySize = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "stripArtifactScopeFragment",
    () => stripArtifactScopeFragment,
    (value) => {
      stripArtifactScopeFragment = value;
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
  bindRuntimeValue(runtime, "createCrashStashKit", () => createCrashStashKit);
  bindRuntimeValue(
    runtime,
    "CRASH_STASH_DATABASE_NAME",
    () => CRASH_STASH_DATABASE_NAME,
    (value) => {
      CRASH_STASH_DATABASE_NAME = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CRASH_STASH_OBJECT_STORE",
    () => CRASH_STASH_OBJECT_STORE,
    (value) => {
      CRASH_STASH_OBJECT_STORE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "awaitIndexedDbRequest",
    () => awaitIndexedDbRequest,
  );
  bindRuntimeValue(
    runtime,
    "createIndexedDbCrashStashStorage",
    () => createIndexedDbCrashStashStorage,
  );
  bindRuntimeValue(
    runtime,
    "FRAME_SCOPE_PATH_PATTERN",
    () => FRAME_SCOPE_PATH_PATTERN,
    (value) => {
      FRAME_SCOPE_PATH_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "artifactPathWithoutFrameScope",
    () => artifactPathWithoutFrameScope,
  );
  bindRuntimeValue(
    runtime,
    "CRASH_STASH_TAB_LOCK_PREFIX",
    () => CRASH_STASH_TAB_LOCK_PREFIX,
    (value) => {
      CRASH_STASH_TAB_LOCK_PREFIX = value;
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
  bindRuntimeValue(
    runtime,
    "claimCrashStashTabLock",
    () => claimCrashStashTabLock,
  );
  bindRuntimeValue(
    runtime,
    "createIndexedDbCrashStashKit",
    () => createIndexedDbCrashStashKit,
  );
  bindRuntimeValue(
    runtime,
    "createCurrentArtifactCrashStash",
    () => createCurrentArtifactCrashStash,
  );
  bindRuntimeValue(runtime, "applyCrashStashEdits", () => applyCrashStashEdits);
  return () => {
    CRASH_STASH_MAX_AGE_MS = 259200000;
    CRASH_STASH_RETENTION_LABEL = "3 days";
    CRASH_STASH_MAX_ENTRIES = 64;
    CRASH_STASH_MAX_ARTIFACT_CHARS = 1e6;
    CRASH_STASH_MAX_TOTAL_CHARS = 2000000;
    crashStashIdentityKey = (input: string, options: string, context: string) =>
      [input, options, context].join("\x00");
    crashStashEntrySize = (input: Files.StashedFileEdit) =>
      input.path.length + (input.text?.length ?? 0);
    stripArtifactScopeFragment = (input: string) => input.split("#")[0];
    isCrashStashEntry = (input: unknown): input is Files.CrashStashEntry =>
      typeof (input as CrashStashWireValue | null)?.key === "string" &&
      typeof (input as Files.CrashStashEntry).artifactId === "string" &&
      typeof (input as Files.CrashStashEntry).viewerId === "string" &&
      Number.isFinite((input as Files.CrashStashEntry).createdAt) &&
      Number.isFinite((input as Files.CrashStashEntry).at) &&
      Number.isFinite((input as Files.CrashStashEntry).chars) &&
      (input as Files.CrashStashEntry).chars >= 0 &&
      Array.isArray((input as Files.CrashStashEntry).edits) &&
      (input as Files.CrashStashEntry).edits.every(
        (input2: unknown) =>
          typeof (input2 as Partial<Files.StashedFileEdit> | null)?.path ===
            "string" &&
          (typeof (input2 as Partial<Files.StashedFileEdit>).text ===
            "string" ||
            (input2 as Partial<Files.StashedFileEdit>).text === null) &&
          (typeof (input2 as Partial<Files.StashedFileEdit>).base ===
            "string" ||
            (input2 as Partial<Files.StashedFileEdit>).base === null),
      );
    CRASH_STASH_DATABASE_NAME = "appifact-crash-stash";
    CRASH_STASH_OBJECT_STORE = "entries";
    FRAME_SCOPE_PATH_PATTERN = /(^|\/)_f\/[^/]+\//;
    CRASH_STASH_TAB_LOCK_PREFIX = "appifact-stash-tab:";
    getNavigatorLocks = () => {
      try {
        return globalThis.navigator?.locks;
      } catch {
        return;
      }
    };
  };
}
