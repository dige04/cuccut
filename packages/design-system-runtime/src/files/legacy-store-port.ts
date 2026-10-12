import type * as Boot from "../contracts/boot";
import type * as Model from "../contracts";
import type * as Storage from "../contracts/model-storage";
import type * as Dom from "../contracts/dom";
import type * as Host from "../contracts/platform-host";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installFilesLegacyStorePort(
  runtime: RuntimeBindings,
): () => void {
  var LEGACY_DATABASE_FRESH_READ_ATTEMPTS: number;
  var LEGACY_DATABASE_FRESH_READ_DELAY_MS: number;
  var migrationTabHolderId: string | undefined;
  async function readFreshDatabaseSnapshot<
    Snapshot extends Boot.NativeAuthoritySnapshot,
  >(read: () => Promise<Snapshot>): Promise<Snapshot> {
    for (let index: number = 0; ; index++) {
      let value = await read();
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
      await new Promise(
        (input) => void setTimeout(input, LEGACY_DATABASE_FRESH_READ_DELAY_MS),
      );
    }
  }
  function createLegacyDatabasePort(
    handle: Boot.NativeLegacyDatabase,
  ): Model.FilesMigrationStore {
    return {
      async list(input) {
        let value = await readFreshDatabaseSnapshot(() =>
            handle
              .collection(input)
              .limit(runtime.LEGACY_DATABASE_LIST_LIMIT)
              .get(),
          ),
          items = [];
        for (let value2 of value.docs) {
          if (value2.exists) {
            items.push({
              path: input + "/" + value2.id,
              data: {
                ...(value2.data() ?? {}),
              },
            });
          }
        }
        return items;
      },
      async get(input) {
        let value = await readFreshDatabaseSnapshot(() =>
          handle.doc(input).get(),
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
      async update(input, options): Promise<void> {
        await handle.doc(input).update({
          ...options,
        });
      },
      async set(input, options): Promise<void> {
        await handle.doc(input).set({
          ...options,
        });
      },
      async acquire(input, options) {
        let value = handle.doc(input);
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
      watch(input, options) {
        let flag: boolean = true,
          value: (() => void) | undefined,
          callback = (input2: Boot.NativeLegacyQuerySnapshot) => {
            try {
              return input2
                .docChanges?.()
                .map((input3): string => input + "/" + input3.doc.id);
            } catch {
              return;
            }
          };
        try {
          value = handle
            .collection(input)
            .limit(runtime.LEGACY_DATABASE_LIST_LIMIT)
            .onSnapshot(
              (input2): void => {
                if (flag) {
                  flag = false;
                } else {
                  options(callback(input2));
                }
              },
              (): void => {
                return;
              },
            );
        } catch {
          value = undefined;
        }
        return (): void => {
          try {
            value?.();
          } catch {}
        };
      },
    };
  }
  function migrationTabHolder(): string {
    migrationTabHolderId ??= "tab-" + crypto.randomUUID();
    return migrationTabHolderId;
  }
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
    "migrationTabHolderId",
    () => migrationTabHolderId,
    (value) => {
      migrationTabHolderId = value;
    },
  );
  bindRuntimeValue(runtime, "migrationTabHolder", () => migrationTabHolder);
  return () => {
    LEGACY_DATABASE_FRESH_READ_ATTEMPTS = 5;
    LEGACY_DATABASE_FRESH_READ_DELAY_MS = 400;
  };
}
