/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** Row data of a document in the host's legacy document store. */
export type LegacyDocData = Record<string, unknown>;

export interface LegacySnapshotMetadata {
  fromCache?: boolean;
  hasPendingWrites?: boolean;
}

export interface LegacyDocSnapshot {
  exists: boolean;
  id: string;
  metadata?: LegacySnapshotMetadata;
  data(): LegacyDocData | undefined;
}

export interface LegacyQuerySnapshot {
  docs: LegacyDocSnapshot[];
  metadata?: LegacySnapshotMetadata;
  docChanges?(): { doc: { id: string } }[];
}

/** A collection query (the host store is Firestore-shaped). */
export interface LegacyQuery {
  limit(count: number): LegacyQuery;
  get(): Promise<LegacyQuerySnapshot>;
  onSnapshot(
    next: (snapshot: LegacyQuerySnapshot) => void,
    error: () => void,
  ): () => void;
}

export interface LegacyDocRef {
  get(): Promise<LegacyDocSnapshot>;
  update(fields: LegacyDocData): Promise<void>;
  set(fields: LegacyDocData): Promise<void>;
  /** Optional lock primitive; hosts without it make the port answer "unsupported". */
  acquire?(options: unknown): Promise<{ acquired?: boolean; expiresAt?: unknown }>;
}

/** The `db` capability of the host (`slidesHost.db` or loaded by name). */
export interface LegacyDatabaseCapability {
  doc(path: string): LegacyDocRef;
  collection(path: string): LegacyQuery;
}

/** A document read through the legacy port: its full path and a copy of its data. */
export interface LegacyDatabaseDocument {
  path: string;
  data: LegacyDocData;
}

export type LegacyAcquireResult =
  | "unsupported"
  | { acquired: boolean; expiresAt?: string };

/** Promise-based view of the legacy store used to migrate old decks into files. */
export interface LegacyDatabasePort {
  list(collection: string): Promise<LegacyDatabaseDocument[]>;
  get(path: string): Promise<LegacyDatabaseDocument | null>;
  update(path: string, fields: LegacyDocData): Promise<void>;
  set(path: string, fields: LegacyDocData): Promise<void>;
  acquire(path: string, options: unknown): Promise<LegacyAcquireResult>;
  /** Calls `onChange` with the changed document paths (undefined when unknown); returns the unsubscribe function. */
  watch(
    collection: string,
    onChange: (paths: string[] | undefined) => void,
  ): () => void;
}

/** The part of the host bridge (`globalThis.slidesHost`) this module reads. */
interface LegacyDatabaseHost {
  use?: (name: string) => Promise<unknown>;
  db?: unknown;
}

declare module "../bindings" {
  interface RuntimeBindings {
    isDatabaseCapability: (value: unknown) => value is LegacyDatabaseCapability;
    getDatabaseCapability: () => Promise<LegacyDatabaseCapability | null>;
    LEGACY_DATABASE_LIST_LIMIT: number;
    LEGACY_DATABASE_FRESH_READ_ATTEMPTS: number;
    LEGACY_DATABASE_FRESH_READ_DELAY_MS: number;
    readFreshDatabaseSnapshot: <
      S extends { metadata?: LegacySnapshotMetadata },
    >(
      readSnapshot: () => Promise<S>,
    ) => Promise<S>;
    createLegacyDatabasePort: (
      database: LegacyDatabaseCapability,
    ) => LegacyDatabasePort;
    getLegacyDatabasePort: () => Promise<LegacyDatabasePort | null>;
  }
}

export function installFilesLegacyDatabase(
  runtime: RuntimeBindings,
): () => void {
  var LEGACY_DATABASE_LIST_LIMIT: number;
  var LEGACY_DATABASE_FRESH_READ_ATTEMPTS: number;
  var LEGACY_DATABASE_FRESH_READ_DELAY_MS: number;
  function isDatabaseCapability(
    value: unknown,
  ): value is LegacyDatabaseCapability {
    return (
      typeof value === "object" &&
      value !== null &&
      typeof (value as Partial<LegacyDatabaseCapability>).doc === "function" &&
      typeof (value as Partial<LegacyDatabaseCapability>).collection ===
        "function"
    );
  }
  async function getDatabaseCapability(): Promise<LegacyDatabaseCapability | null> {
    let slidesHost = (
      globalThis as typeof globalThis & { slidesHost?: LegacyDatabaseHost }
    ).slidesHost;
    try {
      if (typeof slidesHost?.use === "function") {
        let value: unknown = await (0, runtime.loadHostCapability)("db");
        if (isDatabaseCapability(value)) {
          return value;
        } else {
          return null;
        }
      }
    } catch {
      return null;
    }
    if (isDatabaseCapability(slidesHost?.db)) {
      return slidesHost.db;
    } else {
      return null;
    }
  }
  async function readFreshDatabaseSnapshot<
    S extends { metadata?: LegacySnapshotMetadata },
  >(readSnapshot: () => Promise<S>): Promise<S> {
    for (let index = 0; ; index++) {
      let value = await readSnapshot();
      if (
        value.metadata?.fromCache !== true &&
        value.metadata?.hasPendingWrites !== true
      ) {
        return value;
      }
      if (index + 1 >= LEGACY_DATABASE_FRESH_READ_ATTEMPTS) {
        throw Object.assign(Error("the store answered from its cache only"), {
          code: "not_authoritative",
        });
      }
      await new Promise<void>(
        (input) => void setTimeout(input, LEGACY_DATABASE_FRESH_READ_DELAY_MS),
      );
    }
  }
  function createLegacyDatabasePort(
    database: LegacyDatabaseCapability,
  ): LegacyDatabasePort {
    return {
      async list(input: string): Promise<LegacyDatabaseDocument[]> {
        let value = await readFreshDatabaseSnapshot(() =>
            database.collection(input).limit(LEGACY_DATABASE_LIST_LIMIT).get(),
          ),
          items: LegacyDatabaseDocument[] = [];
        for (let value2 of value.docs)
          if (value2.exists) {
            items.push({
              path: input + "/" + value2.id,
              data: {
                ...(value2.data() ?? {}),
              },
            });
          }
        return items;
      },
      async get(input: string): Promise<LegacyDatabaseDocument | null> {
        let value = await readFreshDatabaseSnapshot(() =>
          database.doc(input).get(),
        );
        if (value.exists) {
          return {
            path: input,
            data: {
              ...(value.data() ?? {}),
            },
          };
        } else {
          return null;
        }
      },
      async update(input: string, options: LegacyDocData): Promise<void> {
        await database.doc(input).update({
          ...options,
        });
      },
      async set(input: string, options: LegacyDocData): Promise<void> {
        await database.doc(input).set({
          ...options,
        });
      },
      async acquire(
        input: string,
        options: unknown,
      ): Promise<LegacyAcquireResult> {
        let value = database.doc(input);
        if (typeof value.acquire !== "function") {
          return "unsupported";
        }
        let value2 = await value.acquire(options);
        return {
          acquired: value2.acquired === true,
          ...(typeof value2.expiresAt === "string"
            ? {
                expiresAt: value2.expiresAt,
              }
            : {}),
        };
      },
      watch(
        input: string,
        options: (paths: string[] | undefined) => void,
      ): () => void {
        let flag = true,
          value: (() => void) | undefined,
          callback = (input2: LegacyQuerySnapshot): string[] | undefined => {
            try {
              return input2
                .docChanges?.()
                .map((input3) => input + "/" + input3.doc.id);
            } catch {
              return;
            }
          };
        try {
          value = database
            .collection(input)
            .limit(LEGACY_DATABASE_LIST_LIMIT)
            .onSnapshot(
              (input2) => {
                if (flag) {
                  flag = false;
                } else {
                  options(callback(input2));
                }
              },
              () => {
                return;
              },
            );
        } catch {
          value = undefined;
        }
        return () => {
          try {
            value?.();
          } catch {}
        };
      },
    };
  }
  async function getLegacyDatabasePort(): Promise<LegacyDatabasePort | null> {
    let value = await getDatabaseCapability();
    if (value === null) {
      return null;
    } else {
      return createLegacyDatabasePort(value);
    }
  }
  bindRuntimeValue(runtime, "isDatabaseCapability", () => isDatabaseCapability);
  bindRuntimeValue(
    runtime,
    "getDatabaseCapability",
    () => getDatabaseCapability,
  );
  bindRuntimeValue(
    runtime,
    "LEGACY_DATABASE_LIST_LIMIT",
    () => LEGACY_DATABASE_LIST_LIMIT,
    (value) => {
      LEGACY_DATABASE_LIST_LIMIT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LEGACY_DATABASE_FRESH_READ_ATTEMPTS",
    () => LEGACY_DATABASE_FRESH_READ_ATTEMPTS,
    (value) => {
      LEGACY_DATABASE_FRESH_READ_ATTEMPTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LEGACY_DATABASE_FRESH_READ_DELAY_MS",
    () => LEGACY_DATABASE_FRESH_READ_DELAY_MS,
    (value) => {
      LEGACY_DATABASE_FRESH_READ_DELAY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "readFreshDatabaseSnapshot",
    () => readFreshDatabaseSnapshot,
  );
  bindRuntimeValue(
    runtime,
    "createLegacyDatabasePort",
    () => createLegacyDatabasePort,
  );
  bindRuntimeValue(
    runtime,
    "getLegacyDatabasePort",
    () => getLegacyDatabasePort,
  );
  return () => {
    LEGACY_DATABASE_LIST_LIMIT = 1000;
    LEGACY_DATABASE_FRESH_READ_ATTEMPTS = 5;
    LEGACY_DATABASE_FRESH_READ_DELAY_MS = 400;
  };
}
