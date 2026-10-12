import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsPlatformRuntime(
  runtime: RuntimeBindings,
): () => void {
  var PlatformRuntimeClaudeNestPattern: RegExp;
  var initializePlatformRuntime: () => void;
  function detectRuntimePlatform(): "web" | "desktop" {
    return typeof navigator === "undefined"
      ? "web"
      : PlatformRuntimeClaudeNestPattern.test(navigator.userAgent)
        ? "desktop"
        : "web";
  }
  bindRuntimeValue(
    runtime,
    "detectRuntimePlatform",
    () => detectRuntimePlatform,
  );
  bindRuntimeValue(
    runtime,
    "PlatformRuntimeClaudeNestPattern",
    () => PlatformRuntimeClaudeNestPattern,
    (value) => {
      PlatformRuntimeClaudeNestPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializePlatformRuntime",
    () => initializePlatformRuntime,
    (value) => {
      initializePlatformRuntime = value;
    },
  );
  return () => {
    initializePlatformRuntime = (0, runtime.initializeOnce)(() => {
      // CucCut: the desktop app is told apart by Electron alone.
      PlatformRuntimeClaudeNestPattern = /\bElectron\//i;
    });
  };
}
