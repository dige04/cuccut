/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** One unsaved file edit as the crash stash keeps it. */
export interface CrashStashEdit {
  path: string;
  /** New text, or `null` for a deletion. */
  text: string | null;
  /** Sha the edit was based on. */
  base: string | null;
}

/** What one tab stashed for one artifact (one IndexedDB row). */
export interface CrashStashEntry {
  /** Identity of the (artifact, viewer, tab) triple. */
  key: string;
  artifactId: string;
  viewerId: string;
  tabId: string;
  /** First write of this entry, milliseconds since the epoch. */
  createdAt: number;
  /** Last write, milliseconds since the epoch. */
  at: number;
  /** The files version the edits were made against. */
  version: string;
  edits: CrashStashEdit[];
  /** Characters of paths and texts in `edits`. */
  chars: number;
}

/** A stored row before it is checked: every field may be missing or of another type. */
export type CrashStashRowShape = { [Field in keyof CrashStashEntry]?: unknown };

/** What the stash needs from its storage. Rows are the ones this module wrote; damaged or old ones are dropped by `isCrashStashEntry`. */
export interface CrashStashStorage {
  all(): Promise<CrashStashEntry[]>;
  put(entry: CrashStashEntry): Promise<void>;
  delete(key: string): Promise<void>;
}

/** The merged unsaved edits of every dead tab of this viewer. */
export interface CrashStashRead {
  /** Oldest first write among the merged entries. */
  createdAt: number;
  /** Last write among them. */
  at: number;
  version: string;
  /** The latest edit of each path. */
  edits: CrashStashEdit[];
}

/** Stash of unsaved edits for one artifact, one viewer and one tab. Every method resolves instead of rejecting. */
export interface CrashStashKit {
  /** Replaces this tab's entry; false when something did not fit or the write failed. */
  put(edits: readonly CrashStashEdit[], version: string): Promise<boolean>;
  read(): Promise<CrashStashRead | undefined>;
  clear(): Promise<void>;
  /** Removes the entries that `read` returned, unless they changed since. */
  clearOffered(): Promise<void>;
  clearArtifact(): Promise<void>;
  purgeOtherViewers(): Promise<void>;
}

/** Options of the IndexedDB-backed stash. */
export interface IndexedDbCrashStashKitOptions {
  indexedDB?: IDBFactory;
  /** The kit does not exist (is `null`) without a viewer id. */
  viewerId?: string;
  artifactId?: string;
  tabId?: string;
  now?: () => number;
  /** Ids of the tabs that are still open. */
  liveTabs?: () => Promise<Set<string>>;
}

declare module "../bindings" {
  interface RuntimeBindings {
    /** Entries older than this are dropped. */
    CRASH_STASH_MAX_AGE_MS: number;
    /** `CRASH_STASH_MAX_AGE_MS` in words, for messages. */
    CRASH_STASH_RETENTION_LABEL: string;
    CRASH_STASH_MAX_ENTRIES: number;
    CRASH_STASH_MAX_ARTIFACT_CHARS: number;
    CRASH_STASH_MAX_TOTAL_CHARS: number;
    crashStashIdentityKey: (
      artifactId: string,
      viewerId: string,
      tabId: string,
    ) => string;
    crashStashEntrySize: (entry: Pick<CrashStashEdit, "path" | "text">) => number;
    stripArtifactScopeFragment: (artifactId: string) => string;
    isCrashStashEntry: (
      entry: CrashStashRowShape | null | undefined,
    ) => entry is CrashStashEntry;
    createCrashStashKit: (
      storage: CrashStashStorage,
      artifactId: string,
      viewerId: string,
      tabId: string,
      now: () => number,
      liveTabs: () => Promise<Set<string>>,
    ) => CrashStashKit;
    CRASH_STASH_DATABASE_NAME: string;
    CRASH_STASH_OBJECT_STORE: string;
    awaitIndexedDbRequest: <T>(request: IDBRequest<T>) => Promise<T>;
    createIndexedDbCrashStashStorage: (
      indexedDb: IDBFactory,
    ) => CrashStashStorage;
    FRAME_SCOPE_PATH_PATTERN: RegExp;
    /** The artifact's path with the frame scope removed. */
    artifactPathWithoutFrameScope: (
      location?: Pick<Location, "pathname">,
    ) => string;
    CRASH_STASH_TAB_LOCK_PREFIX: string;
    getNavigatorLocks: () => LockManager | undefined;
    /** Holds a lock named after the tab; returns a function listing the ids of the tabs that hold one. */
    claimCrashStashTabLock: (tabId: string) => () => Promise<Set<string>>;
    createIndexedDbCrashStashKit: (
      options: IndexedDbCrashStashKitOptions,
    ) => CrashStashKit | null;
    createCurrentArtifactCrashStash: (
      scope?: string,
    ) => Promise<CrashStashKit | null>;
  }
}

export function installFilesCrashStash(runtime: RuntimeBindings): () => void {
  var CRASH_STASH_MAX_AGE_MS: RuntimeBindings["CRASH_STASH_MAX_AGE_MS"];
  var CRASH_STASH_RETENTION_LABEL: RuntimeBindings["CRASH_STASH_RETENTION_LABEL"];
  var CRASH_STASH_MAX_ENTRIES: RuntimeBindings["CRASH_STASH_MAX_ENTRIES"];
  var CRASH_STASH_MAX_ARTIFACT_CHARS: RuntimeBindings["CRASH_STASH_MAX_ARTIFACT_CHARS"];
  var CRASH_STASH_MAX_TOTAL_CHARS: RuntimeBindings["CRASH_STASH_MAX_TOTAL_CHARS"];
  var crashStashIdentityKey: RuntimeBindings["crashStashIdentityKey"];
  var crashStashEntrySize: RuntimeBindings["crashStashEntrySize"];
  var stripArtifactScopeFragment: RuntimeBindings["stripArtifactScopeFragment"];
  var isCrashStashEntry: RuntimeBindings["isCrashStashEntry"];
  var CRASH_STASH_DATABASE_NAME: RuntimeBindings["CRASH_STASH_DATABASE_NAME"];
  var CRASH_STASH_OBJECT_STORE: RuntimeBindings["CRASH_STASH_OBJECT_STORE"];
  var FRAME_SCOPE_PATH_PATTERN: RuntimeBindings["FRAME_SCOPE_PATH_PATTERN"];
  var CRASH_STASH_TAB_LOCK_PREFIX: RuntimeBindings["CRASH_STASH_TAB_LOCK_PREFIX"];
  var getNavigatorLocks: RuntimeBindings["getNavigatorLocks"];
  function createCrashStashKit(
    storage: CrashStashStorage,
    artifactId: string,
    viewerId: string,
    tabId: string,
    now: () => number,
    liveTabs: () => Promise<Set<string>>,
  ): CrashStashKit {
    let value = crashStashIdentityKey(artifactId, viewerId, tabId),
      items: { key: string; at: number }[] = [],
      callback = async <T>(input: T, options: () => Promise<T>): Promise<T> => {
        try {
          return await options();
        } catch {
          return input;
        }
      },
      callback2 = (input: CrashStashEntry): boolean =>
        stripArtifactScopeFragment(input.artifactId) ===
        stripArtifactScopeFragment(artifactId),
      callback3 = async (): Promise<CrashStashEntry[]> => {
        let items2: CrashStashEntry[] = [];
        for (let value2 of await storage.all()) {
          if (
            !isCrashStashEntry(value2) ||
            now() - value2.createdAt > CRASH_STASH_MAX_AGE_MS
          ) {
            if (typeof value2?.key === "string") {
              await storage.delete(value2.key);
            }
            continue;
          }
          items2.push(value2);
        }
        return items2;
      },
      callback4 = async (): Promise<Set<string>> => {
        let values = new Set<string>(
          await liveTabs().catch((): Set<string> => new Set()),
        );
        values.delete(tabId);
        return values;
      };
    return {
      put: (items2: readonly CrashStashEdit[], options: string): Promise<boolean> =>
        callback(false, async (): Promise<boolean> => {
          if (viewerId === "") {
            return false;
          }
          if (items2.length === 0) {
            await storage.delete(value);
            return true;
          }
          let items3: CrashStashEdit[] = [],
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
            value4 = value2.filter((input) => input.key !== value),
            value5 =
              index +
              value4.reduce((input, options2) => input + options2.chars, 0);
          for (let value7 of value4
            .filter((input) => !value3.has(input.tabId))
            .sort((input, options2) => input.at - options2.at)) {
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
            value2.find((input) => input.key === value)?.createdAt ?? now();
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
      read: (): Promise<CrashStashRead | undefined> =>
        callback<CrashStashRead | undefined>(
          undefined,
          async (): Promise<CrashStashRead | undefined> => {
            if (viewerId === "") {
              return;
            }
            let value2 = await callback4(),
              value3 = (await callback3())
                .filter(
                  (input) =>
                    input.artifactId === artifactId &&
                    input.viewerId === viewerId &&
                    !value2.has(input.tabId),
                )
                .sort((input, options) => input.at - options.at);
            items = value3.map((input) => ({
              key: input.key,
              at: input.at,
            }));
            let entries = new Map<string, CrashStashEdit>();
            for (let value5 of value3)
              for (let value6 of value5.edits) entries.set(value6.path, value6);
            if (entries.size === 0) {
              return;
            }
            let value4 = value3[value3.length - 1]!;
            return {
              createdAt: Math.min(...value3.map((input) => input.createdAt)),
              at: value4.at,
              version: value4.version,
              edits: [...entries.values()],
            };
          },
        ),
      clear: (): Promise<void> =>
        callback<void>(undefined, () => storage.delete(value)),
      clearOffered: (): Promise<void> =>
        callback<void>(undefined, async (): Promise<void> => {
          let value2 = items;
          items = [];
          let entries = new Map<unknown, unknown>(
            (await storage.all()).map((input): [string, number] => [
              input.key,
              input.at,
            ]),
          );
          for (let value3 of value2)
            if (entries.get(value3.key) === value3.at) {
              await storage.delete(value3.key);
            }
        }),
      clearArtifact: (): Promise<void> =>
        callback<void>(undefined, async (): Promise<void> => {
          for (let value2 of await storage.all())
            if (typeof value2?.artifactId === "string" && callback2(value2)) {
              await storage.delete(value2.key);
            }
        }),
      purgeOtherViewers: (): Promise<void> =>
        callback<void>(undefined, async (): Promise<void> => {
          for (let value2 of await callback3())
            if (
              viewerId !== "" &&
              callback2(value2) &&
              value2.viewerId !== viewerId
            ) {
              await storage.delete(value2.key);
            }
        }),
    };
  }
  function awaitIndexedDbRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise<T>((input, options): void => {
      request.onsuccess = (): void => input(request.result);
      request.onerror = (): void =>
        options(request.error ?? Error("indexedDB request failed"));
    });
  }
  function createIndexedDbCrashStashStorage(
    indexedDb: IDBFactory,
  ): CrashStashStorage {
    let value: Promise<IDBDatabase> | undefined,
      callback = (): Promise<IDBDatabase> => {
        value ??= new Promise<IDBDatabase>((input, options): void => {
          let value2 = indexedDb.open(CRASH_STASH_DATABASE_NAME, 1);
          value2.onupgradeneeded = (): void => {
            value2.result.createObjectStore(CRASH_STASH_OBJECT_STORE, {
              keyPath: "key",
            });
          };
          value2.onsuccess = (): void => input(value2.result);
          value2.onerror = (): void =>
            options(value2.error ?? Error("indexedDB open failed"));
          value2.onblocked = (): void =>
            options(Error("indexedDB open blocked"));
        });
        value.catch((): void => {
          value = undefined;
        });
        return value;
      },
      callback2 = async (
        input: (store: IDBObjectStore) => IDBRequest,
      ): Promise<void> => {
        let value2 = (await callback()).transaction(
            CRASH_STASH_OBJECT_STORE,
            "readwrite",
          ),
          promise = new Promise<void>((input2, options): void => {
            value2.oncomplete = (): void => input2();
            value2.onerror = (): void =>
              options(value2.error ?? Error("indexedDB transaction failed"));
            value2.onabort = (): void =>
              options(value2.error ?? Error("indexedDB transaction aborted"));
          });
        await Promise.all([
          awaitIndexedDbRequest(
            input(value2.objectStore(CRASH_STASH_OBJECT_STORE)),
          ),
          promise,
        ]);
      };
    return {
      all: async (): Promise<CrashStashEntry[]> =>
        awaitIndexedDbRequest(
          (await callback())
            .transaction(CRASH_STASH_OBJECT_STORE, "readonly")
            .objectStore(CRASH_STASH_OBJECT_STORE)
            .getAll(),
        ),
      put: (input: CrashStashEntry): Promise<void> =>
        callback2((input2) => input2.put(input)),
      delete: (input: string): Promise<void> =>
        callback2((input2) => input2.delete(input)),
    };
  }
  function artifactPathWithoutFrameScope(
    location2: Pick<Location, "pathname"> | undefined = globalThis.location,
  ): string {
    return (location2?.pathname ?? "").replace(FRAME_SCOPE_PATH_PATTERN, "$1");
  }
  function claimCrashStashTabLock(tabId: string): () => Promise<Set<string>> {
    let locks = getNavigatorLocks();
    if (locks === undefined) {
      return (): Promise<Set<string>> => Promise.resolve(new Set());
    }
    locks
      .request(
        CRASH_STASH_TAB_LOCK_PREFIX + tabId,
        (): Promise<void> =>
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
          .map((input) => input.name ?? "")
          .filter((input) => input.startsWith(CRASH_STASH_TAB_LOCK_PREFIX))
          .map((input) => input.slice(CRASH_STASH_TAB_LOCK_PREFIX.length)),
      );
  }
  function createIndexedDbCrashStashKit(
    options: IndexedDbCrashStashKitOptions,
  ): CrashStashKit | null {
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
    scope: string = "",
  ): Promise<CrashStashKit | null> {
    let value = (await (0, runtime.currentUserId)()) ?? "",
      value2 = createIndexedDbCrashStashKit({
        viewerId: value,
        artifactId:
          artifactPathWithoutFrameScope() + (scope === "" ? "" : "#" + scope),
      });
    await value2?.purgeOtherViewers();
    return value2;
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
  return () => {
    CRASH_STASH_MAX_AGE_MS = 259200000;
    CRASH_STASH_RETENTION_LABEL = "3 days";
    CRASH_STASH_MAX_ENTRIES = 64;
    CRASH_STASH_MAX_ARTIFACT_CHARS = 1e6;
    CRASH_STASH_MAX_TOTAL_CHARS = 2000000;
    crashStashIdentityKey = (
      artifactId: string,
      viewerId: string,
      tabId: string,
    ): string => [artifactId, viewerId, tabId].join("\x00");
    crashStashEntrySize = (entry: Pick<CrashStashEdit, "path" | "text">): number =>
      entry.path.length + (entry.text?.length ?? 0);
    stripArtifactScopeFragment = (artifactId: string): string =>
      artifactId.split("#")[0]!;
    isCrashStashEntry = (
      entry: CrashStashRowShape | null | undefined,
    ): entry is CrashStashEntry =>
      typeof entry?.key === "string" &&
      typeof entry.artifactId === "string" &&
      typeof entry.viewerId === "string" &&
      Number.isFinite(entry.createdAt) &&
      Number.isFinite(entry.at) &&
      Number.isFinite(entry.chars) &&
      (entry.chars as number) >= 0 &&
      Array.isArray(entry.edits) &&
      entry.edits.every(
        (input: Partial<CrashStashEdit> | null | undefined): boolean =>
          typeof input?.path === "string" &&
          (typeof input.text === "string" || input.text === null) &&
          (typeof input.base === "string" || input.base === null),
      );
    CRASH_STASH_DATABASE_NAME = "appifact-crash-stash";
    CRASH_STASH_OBJECT_STORE = "entries";
    FRAME_SCOPE_PATH_PATTERN = /(^|\/)_f\/[^/]+\//;
    CRASH_STASH_TAB_LOCK_PREFIX = "appifact-stash-tab:";
    getNavigatorLocks = (): LockManager | undefined => {
      try {
        return globalThis.navigator?.locks;
      } catch {
        return;
      }
    };
  };
}
