import type * as Host from "../contracts/platform-host";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";

export function installPlatformEmulator(runtime: RuntimeBindings): () => void {
  var emulatorPageDetected: boolean | undefined;
  function emulatorHostMetaName(): string {
    return ["appifact", "emulator", "host"].join("-");
  }
  function isEmulatorPage(): boolean {
    emulatorPageDetected ??=
      typeof document !== "undefined" &&
      (document.querySelector(
        'meta[name="' + (0, runtime.emulatorBuildMetaName)() + '"]',
      ) !== null ||
        document.querySelector(
          'meta[name="' + emulatorHostMetaName() + '"]',
        ) !== null);
    return emulatorPageDetected;
  }
  bindRuntimeValue(runtime, "emulatorHostMetaName", () => emulatorHostMetaName);
  bindRuntimeValue(
    runtime,
    "emulatorPageDetected",
    () => emulatorPageDetected,
    (value) => {
      emulatorPageDetected = value;
    },
  );
  bindRuntimeValue(runtime, "isEmulatorPage", () => isEmulatorPage);
  return () => {};
}
