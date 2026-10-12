import { useVirtualizer } from "@tanstack/react-virtual";
import { measureElement } from "@tanstack/virtual-core";
import type { RuntimeBindings } from "../bindings";

declare module "../bindings" {
  interface RuntimeBindings {
    useVirtualizer: typeof useVirtualizer;
    measureElement: typeof measureElement;
  }
}

/** TanStack initializes through npm; keep the original application's consumed surface. */
export function installVirtualizer(runtime: RuntimeBindings): void {
  runtime.useVirtualizer = useVirtualizer;
  runtime.measureElement = measureElement;
  runtime.initializeNpmDependency = () => {};
}
