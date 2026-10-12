import type * as Host from "../contracts/platform-host";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";

export function installMediaAssets(runtime: RuntimeBindings): () => void {
  var storedBlobPattern: RegExp;
  async function getAssetsCapability(): Promise<Host.AssetsCapability | null> {
    // CucCut: the host is globalThis.designSystemHost (packages/design-system/src/editor/design-system-host.ts), not globalThis.claude.
    let claude = (
      globalThis as typeof globalThis &
        Pick<Host.ProtocolGlobal, "designSystemHost">
    ).designSystemHost;
    if (typeof claude?.use === "function") {
      return (0, runtime.loadClaudeCapabilityWithTimeout)(
        "assets",
        (0, runtime.capabilityHasMethod)("upload"),
      ) as Promise<Host.AssetsCapability | null>;
    }
    if (typeof claude?.assets?.upload === "function") {
      return claude.assets;
    } else {
      return null;
    }
  }
  function isEmulatorBlobUrl(url: string): boolean {
    return url.startsWith("blob:") && (0, runtime.isEmulatorPage)();
  }
  function isStoredBlobReference(url: string): boolean {
    return storedBlobPattern.test(url) || isEmulatorBlobUrl(url);
  }
  bindRuntimeValue(
    runtime,
    "storedBlobPattern",
    () => storedBlobPattern,
    (value) => {
      storedBlobPattern = value;
    },
  );
  bindRuntimeValue(runtime, "getAssetsCapability", () => getAssetsCapability);
  bindRuntimeValue(runtime, "isEmulatorBlobUrl", () => isEmulatorBlobUrl);
  bindRuntimeValue(
    runtime,
    "isStoredBlobReference",
    () => isStoredBlobReference,
  );
  return () => {
    storedBlobPattern = /^\/?_blob\/[0-9a-f]{32}$/;
  };
}
