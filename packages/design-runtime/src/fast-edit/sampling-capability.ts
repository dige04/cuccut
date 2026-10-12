/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installFastEditSamplingCapability(
  runtime: RuntimeBindings,
): () => void {
  var embeddedFastEditWorkerSource: Dynamic;
  var samplingCapabilityIntercepted: Dynamic;
  var originalClaudeUse: Dynamic;
  function interceptSamplingCapability(
    embedded: Dynamic = runtime.isEmbeddedApplication,
  ): Dynamic {
    if (!(samplingCapabilityIntercepted || embedded)) {
      samplingCapabilityIntercepted = true;
      try {
        // CucCut: the host is globalThis.designHost (packages/design/src/editor/design-host.ts), not globalThis.claude.
        let claude: Dynamic = (globalThis as Dynamic).designHost;
        if (typeof claude?.use != "function") return;
        let value: Dynamic = claude.use.bind(claude);
        originalClaudeUse = value;
        Object.defineProperty(claude, "use", {
          value: (input?: Dynamic, options?: Dynamic): Dynamic =>
            input === "sample" ? Promise.resolve(null) : value(input, options),
          writable: true,
          configurable: true,
          enumerable: false,
        });
      } catch {}
    }
  }
  async function resolveSamplingCapability(
    isValid?: Dynamic,
    timeoutMs: Dynamic = runtime.capabilityTimeoutMs,
  ): Promise<Dynamic> {
    if (originalClaudeUse === null)
      return (0, runtime.awaitHostCapability)("sample", isValid, timeoutMs);
    let timeout: Dynamic;
    try {
      let promise: Dynamic = new Promise(
          (input?: Dynamic): Dynamic =>
            (timeout = setTimeout(input, timeoutMs, null)),
        ),
        value: Dynamic = await Promise.race([
          originalClaudeUse("sample"),
          promise,
        ]);
      return value?.available !== false && isValid(value) ? value : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
  bindRuntimeValue(
    runtime,
    "embeddedFastEditWorkerSource",
    () => embeddedFastEditWorkerSource,
    (value) => {
      embeddedFastEditWorkerSource = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "samplingCapabilityIntercepted",
    () => samplingCapabilityIntercepted,
    (value) => {
      samplingCapabilityIntercepted = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "originalClaudeUse",
    () => originalClaudeUse,
    (value) => {
      originalClaudeUse = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "interceptSamplingCapability",
    () => interceptSamplingCapability,
  );
  bindRuntimeValue(
    runtime,
    "resolveSamplingCapability",
    () => resolveSamplingCapability,
  );
  return () => {
    embeddedFastEditWorkerSource = "";
    samplingCapabilityIntercepted = false;
    originalClaudeUse = null;
  };
}
