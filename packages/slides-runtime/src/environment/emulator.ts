/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

declare module "../bindings" {
  interface RuntimeBindings {
    emulatorHostMetaName: () => string;
    isEmulatorPage: () => boolean;
    emulatorPageDetected: boolean | undefined;
    initializeEmulatorDetection: () => void;
  }
}

export function installEnvironmentEmulator(runtime: RuntimeBindings): () => void {
  var emulatorPageDetected: boolean | undefined;
  var initializeEmulatorDetection: () => void;
  function emulatorHostMetaName() {
    return ["appifact", "emulator", "host"].join("-");
  }
  function isEmulatorPage() {
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
  bindRuntimeValue(runtime, "isEmulatorPage", () => isEmulatorPage);
  bindRuntimeValue(
    runtime,
    "emulatorPageDetected",
    () => emulatorPageDetected,
    (value) => {
      emulatorPageDetected = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeEmulatorDetection",
    () => initializeEmulatorDetection,
    (value) => {
      initializeEmulatorDetection = value;
    },
  );
  return () => {
    initializeEmulatorDetection = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeCompiledPage)();
    });
  };
}
