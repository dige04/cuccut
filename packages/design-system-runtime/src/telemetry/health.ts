import type * as Host from "../contracts/platform-host";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installTelemetryHealth(runtime: RuntimeBindings): () => void {
  var artifactHealth: Host.HealthReporter;
  function getArtifactHealthReporter(): Host.HealthReporter | undefined {
    let host = (
      globalThis as typeof globalThis &
        Pick<Host.ProtocolGlobal, "__appifact_health">
    ).__appifact_health;
    if (typeof host !== "object" || host === null) {
      return;
    }
    let health = host;
    if (
      typeof health.report === "function" &&
      typeof health.track === "function"
    ) {
      return host;
    } else {
      return undefined;
    }
  }
  bindRuntimeValue(
    runtime,
    "getArtifactHealthReporter",
    () => getArtifactHealthReporter,
  );
  bindRuntimeValue(
    runtime,
    "artifactHealth",
    () => artifactHealth,
    (value) => {
      artifactHealth = value;
    },
  );
  return () => {
    artifactHealth = {
      report(input, options, context): void {
        try {
          getArtifactHealthReporter()?.report(input, options, context);
        } catch {}
      },
      async track<Value>(
        input: string,
        options: () => Value | PromiseLike<Value>,
        context?: unknown,
      ): Promise<Value> {
        let value = getArtifactHealthReporter();
        if (value === undefined) {
          return await options();
        }
        let value2: Promise<Value>;
        try {
          value2 = value.track(input, options, context);
        } catch {
          return await options();
        }
        return await value2;
      },
    };
  };
}
