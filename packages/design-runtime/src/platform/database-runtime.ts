/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformDatabaseRuntime(
  runtime: RuntimeBindings,
): () => void {
  var databaseRuntimeSnapshot: Dynamic;
  function setDatabaseRuntimeSnapshot(input?: Dynamic): Dynamic {
    databaseRuntimeSnapshot = input;
  }
  function getDatabaseRuntimeSnapshot(): Dynamic {
    return databaseRuntimeSnapshot;
  }
  async function initializeDatabaseRuntime(): Promise<Dynamic> {
    if (typeof window === "undefined") return;
    let value: Dynamic = window;
    if (value.appifact !== undefined)
      try {
        let value2: Dynamic = await value.appifact.ready();
        if (value2.saving.mode !== "auto") return;
        let value3: Dynamic = await value2.doc.getAll();
        setDatabaseRuntimeSnapshot({
          runtime: value2,
          snapshot: value3,
        });
      } catch (value2: Dynamic) {
        console.error(
          "appifact runtime probe failed \u2014 booting the frame model",
          value2,
        );
      }
  }
  bindRuntimeValue(
    runtime,
    "databaseRuntimeSnapshot",
    () => databaseRuntimeSnapshot,
    (value) => {
      databaseRuntimeSnapshot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setDatabaseRuntimeSnapshot",
    () => setDatabaseRuntimeSnapshot,
  );
  bindRuntimeValue(
    runtime,
    "getDatabaseRuntimeSnapshot",
    () => getDatabaseRuntimeSnapshot,
  );
  bindRuntimeValue(
    runtime,
    "initializeDatabaseRuntime",
    () => initializeDatabaseRuntime,
  );
  return () => {};
}
