/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { SlidesHost } from "../../../slides/src/editor/slides-host";

/** Type guard a caller supplies to accept (or reject) a capability object the host handed over. */
export type HostCapabilityValidator<T> = (value: unknown) => value is T;
/** Reads a capability off `slidesHost`: the declared ones are typed, other names are host-defined. */
export interface GetHostCapability {
  <K extends keyof SlidesHost>(name: K): SlidesHost[K];
  (name: string): unknown;
}

declare module "../bindings" {
  interface RuntimeBindings {
    getHostBridge: () => SlidesHost | undefined;
    hasHostCapabilityLoader: () => boolean;
    getHostCapability: GetHostCapability;
    loadHostCapability: (name: string) => Promise<unknown>;
    getOrLoadHostCapability: <T>(
      name: string,
      validate: HostCapabilityValidator<T>,
      timeoutMs?: number,
    ) => Promise<T | null>;
    loadHostCapabilityWithTimeout: <T>(
      name: string,
      validate: HostCapabilityValidator<T>,
      timeoutMs?: number,
    ) => Promise<T | null>;
    capabilityHasMethod: <T extends object = object>(
      methodName: string,
    ) => HostCapabilityValidator<T>;
    capabilityLoadTimeoutMs: number;
  }
}

export function installEnvironmentHostCapabilities(
  runtime: RuntimeBindings,
): () => void {
  var capabilityLoadTimeoutMs: number;
  function getHostBridge() {
    return globalThis.slidesHost;
  }
  function hasHostCapabilityLoader() {
    return typeof getHostBridge()?.use === "function";
  }
  function getHostCapability<K extends keyof SlidesHost>(
    name: K,
  ): SlidesHost[K];
  function getHostCapability(name: string): unknown;
  function getHostCapability(name: string): unknown {
    return (getHostBridge() as Record<string, unknown> | undefined)?.[name];
  }
  async function loadHostCapability(name: string): Promise<unknown> {
    let value = getHostBridge();
    if (typeof value?.use !== "function") {
      return null;
    }
    let value2 = (await value.use.call(value, name)) as
      | { available?: boolean }
      | null
      | undefined;
    if (value2?.available === false) {
      return null;
    } else {
      return value2;
    }
  }
  async function getOrLoadHostCapability<T>(
    name: string,
    validate: HostCapabilityValidator<T>,
    timeoutMs: number = capabilityLoadTimeoutMs,
  ): Promise<T | null> {
    let value = getHostCapability(name);
    if (validate(value)) {
      return value;
    }
    return loadHostCapabilityWithTimeout(name, validate, timeoutMs);
  }
  async function loadHostCapabilityWithTimeout<T>(
    name: string,
    validate: HostCapabilityValidator<T>,
    timeoutMs: number = capabilityLoadTimeoutMs,
  ): Promise<T | null> {
    let value: ReturnType<typeof setTimeout> | undefined;
    try {
      let promise = new Promise<null>(
          (input) =>
            (value = setTimeout(input, timeoutMs, null)),
        ),
        value2 = await Promise.race([
          loadHostCapability(name),
          promise,
        ]);
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
  function capabilityHasMethod<T extends object = object>(
    methodName: string,
  ): HostCapabilityValidator<T> {
    return (input: unknown): input is T =>
      (typeof input === "object" || typeof input === "function") &&
      input !== null &&
      typeof (input as Record<string, unknown>)[methodName] === "function";
  }
  bindRuntimeValue(runtime, "getHostBridge", () => getHostBridge);
  bindRuntimeValue(
    runtime,
    "hasHostCapabilityLoader",
    () => hasHostCapabilityLoader,
  );
  bindRuntimeValue(runtime, "getHostCapability", () => getHostCapability);
  bindRuntimeValue(runtime, "loadHostCapability", () => loadHostCapability);
  bindRuntimeValue(
    runtime,
    "getOrLoadHostCapability",
    () => getOrLoadHostCapability,
  );
  bindRuntimeValue(
    runtime,
    "loadHostCapabilityWithTimeout",
    () => loadHostCapabilityWithTimeout,
  );
  bindRuntimeValue(runtime, "capabilityHasMethod", () => capabilityHasMethod);
  bindRuntimeValue(
    runtime,
    "capabilityLoadTimeoutMs",
    () => capabilityLoadTimeoutMs,
    (value) => {
      capabilityLoadTimeoutMs = value;
    },
  );
  return () => {
    capabilityLoadTimeoutMs = 45000;
  };
}
