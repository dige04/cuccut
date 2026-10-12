/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformDatabaseAdapter(
  runtime: RuntimeBindings,
): () => void {
  var MAX_DATABASE_COLLECTION_DOCS: Dynamic;
  var KNOWN_DATABASE_ERROR_CODES: Dynamic;
  var DATABASE_ACCESS_DENIED_CODES: Dynamic;
  function normalizeDatabaseError(error?: Dynamic): Dynamic {
    let record: Dynamic =
        typeof error == "object" && error !== null ? error : {},
      isDatabaseTypeError: Dynamic =
        record.name === "TypeError" &&
        typeof record.message == "string" &&
        record.message.startsWith("db "),
      code: Dynamic =
        typeof record.code == "string" &&
        KNOWN_DATABASE_ERROR_CODES.includes(record.code)
          ? record.code
          : isDatabaseTypeError
            ? "invalid_argument"
            : "unavailable",
      message: Dynamic =
        typeof record.message == "string"
          ? record.message
          : error instanceof Error
            ? error.message
            : String(code);
    return {
      code: code,
      message: message,
    };
  }
  function isDatabaseCapability(capability?: Dynamic): Dynamic {
    return (
      typeof capability == "object" &&
      capability !== null &&
      typeof capability.doc == "function" &&
      typeof capability.collection == "function"
    );
  }
  async function resolveDatabaseCapability(): Promise<Dynamic> {
    // CucCut: the host is globalThis.designHost (packages/design/src/editor/design-host.ts), not globalThis.claude.
    let claude: Dynamic = (globalThis as Dynamic).designHost;
    try {
      if (typeof claude?.use == "function") {
        let value: Dynamic = await (0, runtime.requestHostCapability)("db");
        return isDatabaseCapability(value) ? value : null;
      }
    } catch {
      return null;
    }
    return isDatabaseCapability(claude?.db) ? claude.db : null;
  }
  function createRealtimeDatabaseAdapter(database?: Dynamic): Dynamic {
    return {
      subscribe(input: Dynamic, options: Dynamic, context: Dynamic): Dynamic {
        let flag: Dynamic = true,
          value: Dynamic;
        try {
          value = database
            .collection(input)
            .limit(MAX_DATABASE_COLLECTION_DOCS)
            .onSnapshot(
              (input2?: Dynamic): Dynamic => {
                let items: Dynamic = [];
                for (let value3 of input2.docChanges() as Dynamic) {
                  let value4: Dynamic = input + "/" + value3.doc.id;
                  value3.type === "removed"
                    ? items.push({
                        type: "removed",
                        path: value4,
                      })
                    : items.push({
                        type: value3.type,
                        path: value4,
                        data: value3.doc.data() ?? {},
                      });
                }
                let value2: Dynamic = flag;
                flag = false;
                options(items, {
                  initial: value2,
                  fromCache: input2.metadata?.fromCache === true,
                  hasPendingWrites: input2.metadata?.hasPendingWrites === true,
                });
              },
              (input2?: Dynamic): Dynamic =>
                context(normalizeDatabaseError(input2)),
            );
        } catch (value2: Dynamic) {
          queueMicrotask(
            (): Dynamic => context(normalizeDatabaseError(value2)),
          );
        }
        return (): Dynamic => {
          try {
            value?.();
          } catch {}
        };
      },
      async set(input: Dynamic, options: Dynamic): Promise<Dynamic> {
        try {
          await database.doc(input).set({
            ...options,
          });
        } catch (value: Dynamic) {
          throw normalizeDatabaseError(value);
        }
      },
      async update(input: Dynamic, options: Dynamic): Promise<Dynamic> {
        try {
          await database.doc(input).update({
            ...options,
          });
        } catch (value: Dynamic) {
          throw normalizeDatabaseError(value);
        }
      },
      async del(input: Dynamic): Promise<Dynamic> {
        try {
          await database.doc(input).delete();
        } catch (value: Dynamic) {
          throw normalizeDatabaseError(value);
        }
      },
    };
  }
  async function getRealtimeDatabaseAdapter(): Promise<Dynamic> {
    let value: Dynamic = await resolveDatabaseCapability();
    return value === null ? null : createRealtimeDatabaseAdapter(value);
  }
  bindRuntimeValue(
    runtime,
    "MAX_DATABASE_COLLECTION_DOCS",
    () => MAX_DATABASE_COLLECTION_DOCS,
    (value) => {
      MAX_DATABASE_COLLECTION_DOCS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "KNOWN_DATABASE_ERROR_CODES",
    () => KNOWN_DATABASE_ERROR_CODES,
    (value) => {
      KNOWN_DATABASE_ERROR_CODES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DATABASE_ACCESS_DENIED_CODES",
    () => DATABASE_ACCESS_DENIED_CODES,
    (value) => {
      DATABASE_ACCESS_DENIED_CODES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeDatabaseError",
    () => normalizeDatabaseError,
  );
  bindRuntimeValue(runtime, "isDatabaseCapability", () => isDatabaseCapability);
  bindRuntimeValue(
    runtime,
    "resolveDatabaseCapability",
    () => resolveDatabaseCapability,
  );
  bindRuntimeValue(
    runtime,
    "createRealtimeDatabaseAdapter",
    () => createRealtimeDatabaseAdapter,
  );
  bindRuntimeValue(
    runtime,
    "getRealtimeDatabaseAdapter",
    () => getRealtimeDatabaseAdapter,
  );
  return () => {
    MAX_DATABASE_COLLECTION_DOCS = 1e3;
    KNOWN_DATABASE_ERROR_CODES = [
      "invalid_argument",
      "resource_exhausted",
      "quota_exceeded",
      "unavailable",
      "revoked",
      "not_granted",
      "capability_disabled",
      "capability_removed",
      "transform_error",
    ];
    DATABASE_ACCESS_DENIED_CODES = [
      "revoked",
      "not_granted",
      "capability_disabled",
      "capability_removed",
    ];
  };
}
