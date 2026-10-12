/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformStorageMigration(
  runtime: RuntimeBindings,
): () => void {
  var ConvertedFromValue: Dynamic;
  var CreatedOnFilesValue: Dynamic;
  var MovedToValue: Dynamic;
  var PlatformStorageMigrationIsArray: Dynamic;
  function getStorageMigrationMarker(input?: Dynamic): Dynamic {
    if (!PlatformStorageMigrationIsArray(input)) return null;
    let value: Dynamic = input[ConvertedFromValue];
    if (PlatformStorageMigrationIsArray(value))
      return {
        kind: "converted",
        marker: value,
      };
    let value2: Dynamic = input[CreatedOnFilesValue];
    return PlatformStorageMigrationIsArray(value2)
      ? {
          kind: "created",
          marker: value2,
        }
      : null;
  }
  function getStorageModeFromMetadata(input?: Dynamic): Dynamic {
    return getStorageMigrationMarker(input) === null ? "store" : "files";
  }
  function getStorageModeFromJson(input?: Dynamic): Dynamic {
    if (typeof input != "string") return "store";
    try {
      return getStorageModeFromMetadata(JSON.parse(input));
    } catch {
      return "store";
    }
  }
  function migrationTimestampMarker(input?: Dynamic): Dynamic {
    return {
      v: 1,
      at: input.at,
    };
  }
  function getMovedToMarker(input?: Dynamic): Dynamic {
    if (!PlatformStorageMigrationIsArray(input)) return null;
    let value: Dynamic = input[MovedToValue];
    if (
      !PlatformStorageMigrationIsArray(value) ||
      typeof value.path != "string" ||
      typeof value.at != "string"
    )
      return null;
    let state: Dynamic = {
      ...value,
    };
    for (let value2 of ["dropping", "dropped", "took"] as Dynamic)
      typeof state[value2] != "string" && delete state[value2];
    return state;
  }
  bindRuntimeValue(
    runtime,
    "ConvertedFromValue",
    () => ConvertedFromValue,
    (value) => {
      ConvertedFromValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CreatedOnFilesValue",
    () => CreatedOnFilesValue,
    (value) => {
      CreatedOnFilesValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MovedToValue",
    () => MovedToValue,
    (value) => {
      MovedToValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformStorageMigrationIsArray",
    () => PlatformStorageMigrationIsArray,
    (value) => {
      PlatformStorageMigrationIsArray = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getStorageMigrationMarker",
    () => getStorageMigrationMarker,
  );
  bindRuntimeValue(
    runtime,
    "getStorageModeFromMetadata",
    () => getStorageModeFromMetadata,
  );
  bindRuntimeValue(
    runtime,
    "getStorageModeFromJson",
    () => getStorageModeFromJson,
  );
  bindRuntimeValue(
    runtime,
    "migrationTimestampMarker",
    () => migrationTimestampMarker,
  );
  bindRuntimeValue(runtime, "getMovedToMarker", () => getMovedToMarker);
  return () => {
    ConvertedFromValue = "convertedFrom";
    CreatedOnFilesValue = "createdOnFiles";
    MovedToValue = "movedTo";
    PlatformStorageMigrationIsArray = (input?: Dynamic): Dynamic =>
      typeof input == "object" && input !== null && !Array.isArray(input);
  };
}
