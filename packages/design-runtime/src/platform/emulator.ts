/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformEmulator(runtime: RuntimeBindings): () => void {
  var PlatformEmulatorResolvedValue: Dynamic;
  function emulatorHostMetaName(): Dynamic {
    return ["appifact", "emulator", "host"].join("-");
  }
  function isEmulator(): Dynamic {
    PlatformEmulatorResolvedValue ??=
      typeof document !== "undefined" &&
      ((document as Dynamic).querySelector(
        'meta[name="' + (0, runtime.emulatorBuildMetaName)() + '"]',
      ) !== null ||
        (document as Dynamic).querySelector(
          'meta[name="' + emulatorHostMetaName() + '"]',
        ) !== null);
    return PlatformEmulatorResolvedValue;
  }
  bindRuntimeValue(runtime, "emulatorHostMetaName", () => emulatorHostMetaName);
  bindRuntimeValue(
    runtime,
    "PlatformEmulatorResolvedValue",
    () => PlatformEmulatorResolvedValue,
    (value) => {
      PlatformEmulatorResolvedValue = value;
    },
  );
  bindRuntimeValue(runtime, "isEmulator", () => isEmulator);
  return () => {};
}
