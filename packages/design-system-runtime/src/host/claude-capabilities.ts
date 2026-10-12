import type * as Host from "../contracts/platform-host";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installHostClaudeCapabilities(
  runtime: RuntimeBindings,
): () => void {
  var capabilityLoadTimeoutMs: number;
  function getClaudeBridge(): Host.ClaudeBridge | undefined {
    // CucCut: the host is globalThis.designSystemHost (packages/design-system/src/editor/design-system-host.ts), not globalThis.claude.
    return (
      globalThis as typeof globalThis &
        Pick<Host.ProtocolGlobal, "designSystemHost">
    ).designSystemHost;
  }
  function hasClaudeCapabilityLoader(): boolean {
    return typeof getClaudeBridge()?.use === "function";
  }
  function getClaudeCapability(name: string): unknown {
    return getClaudeBridge()?.[name];
  }
  async function loadClaudeCapability(name: string): Promise<unknown> {
    let value = getClaudeBridge();
    if (typeof value?.use !== "function") {
      return null;
    }
    let value2 = await value.use.call(value, name);
    if (
      (value2 as { available?: unknown } | null | undefined)?.available ===
      false
    ) {
      return null;
    } else {
      return value2;
    }
  }
  async function getOrLoadClaudeCapability<Capability>(
    name: string,
    validate: (value: unknown) => value is Capability,
    timeoutMs: number = capabilityLoadTimeoutMs,
  ): Promise<Capability | null> {
    let value = getClaudeCapability(name);
    if (validate(value)) {
      return value;
    }
    return loadClaudeCapabilityWithTimeout(name, validate, timeoutMs);
  }
  async function loadClaudeCapabilityWithTimeout<Capability>(
    name: string,
    validate: (value: unknown) => value is Capability,
    timeoutMs: number = capabilityLoadTimeoutMs,
  ): Promise<Capability | null> {
    let value: ReturnType<typeof setTimeout> | undefined;
    try {
      let promise = new Promise<null>(
          (input) => (value = setTimeout(input, timeoutMs, null)),
        ),
        value2 = await Promise.race([loadClaudeCapability(name), promise]);
      if (validate(value2)) {
        return value2;
      } else {
        return null;
      }
    } catch {
      return null;
    } finally {
      clearTimeout(value);
    }
  }
  function capabilityHasMethod<Method extends string>(
    methodName: Method,
  ): (
    input: unknown,
  ) => input is Record<Method, (...args: unknown[]) => unknown> {
    return (
      input: unknown,
    ): input is Record<Method, (...args: unknown[]) => unknown> =>
      (typeof input === "object" || typeof input === "function") &&
      input !== null &&
      typeof (input as Record<string, unknown>)[methodName] === "function";
  }
  bindRuntimeValue(runtime, "getClaudeBridge", () => getClaudeBridge);
  bindRuntimeValue(
    runtime,
    "hasClaudeCapabilityLoader",
    () => hasClaudeCapabilityLoader,
  );
  bindRuntimeValue(runtime, "getClaudeCapability", () => getClaudeCapability);
  bindRuntimeValue(runtime, "loadClaudeCapability", () => loadClaudeCapability);
  bindRuntimeValue(
    runtime,
    "capabilityLoadTimeoutMs",
    () => capabilityLoadTimeoutMs,
    (value) => {
      capabilityLoadTimeoutMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getOrLoadClaudeCapability",
    () => getOrLoadClaudeCapability,
  );
  bindRuntimeValue(
    runtime,
    "loadClaudeCapabilityWithTimeout",
    () => loadClaudeCapabilityWithTimeout,
  );
  bindRuntimeValue(runtime, "capabilityHasMethod", () => capabilityHasMethod);
  return () => {
    capabilityLoadTimeoutMs = 45000;
  };
}
