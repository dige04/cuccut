/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformHostCapabilities(
  runtime: RuntimeBindings,
): () => void {
  var capabilityTimeoutMs: Dynamic;
  function getClaudeHost(): Dynamic {
    // CucCut: the host is globalThis.designHost (packages/design/src/editor/design-host.ts), not globalThis.claude.
    return (globalThis as Dynamic).designHost;
  }
  function hasCapabilityLoader(): Dynamic {
    return typeof getClaudeHost()?.use == "function";
  }
  function getCachedHostCapability(input?: Dynamic): Dynamic {
    return getClaudeHost()?.[input];
  }
  async function requestHostCapability(input?: Dynamic): Promise<Dynamic> {
    let value: Dynamic = getClaudeHost();
    if (typeof value?.use != "function") return null;
    let value2: Dynamic = await value.use.call(value, input);
    return value2?.available === false ? null : value2;
  }
  async function resolveHostCapability(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = capabilityTimeoutMs,
  ): Promise<Dynamic> {
    let value: Dynamic = getCachedHostCapability(input);
    return options(value)
      ? value
      : awaitHostCapability(input, options, context);
  }
  async function awaitHostCapability(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = capabilityTimeoutMs,
  ): Promise<Dynamic> {
    let value: Dynamic;
    try {
      let promise: Dynamic = new Promise(
          (input2?: Dynamic): Dynamic =>
            (value = setTimeout(input2, context, null)),
        ),
        value2: Dynamic = await Promise.race([
          requestHostCapability(input),
          promise,
        ]);
      return options(value2) ? value2 : null;
    } catch {
      return null;
    } finally {
      clearTimeout(value);
    }
  }
  function hasCapabilityMethod(input?: Dynamic): Dynamic {
    return (input2?: Dynamic): Dynamic =>
      (typeof input2 == "object" || typeof input2 == "function") &&
      input2 !== null &&
      typeof input2[input] == "function";
  }
  bindRuntimeValue(runtime, "getClaudeHost", () => getClaudeHost);
  bindRuntimeValue(runtime, "hasCapabilityLoader", () => hasCapabilityLoader);
  bindRuntimeValue(
    runtime,
    "getCachedHostCapability",
    () => getCachedHostCapability,
  );
  bindRuntimeValue(
    runtime,
    "requestHostCapability",
    () => requestHostCapability,
  );
  bindRuntimeValue(
    runtime,
    "capabilityTimeoutMs",
    () => capabilityTimeoutMs,
    (value) => {
      capabilityTimeoutMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "resolveHostCapability",
    () => resolveHostCapability,
  );
  bindRuntimeValue(runtime, "awaitHostCapability", () => awaitHostCapability);
  bindRuntimeValue(runtime, "hasCapabilityMethod", () => hasCapabilityMethod);
  return () => {
    capabilityTimeoutMs = 45e3;
  };
}
