/** Every live binding has a reviewed contract or a checked producer type. */
import type { NpmRuntimeBindings } from "./npm-runtime-types";
import type { ModuleNamespace } from "./contracts/module-helpers";
import type { ReviewedRuntimeBindings } from "./reviewed-runtime-types";
import type { InferredRuntimeBindings } from "./inferred-runtime-types";
export interface RuntimeBindings
  extends NpmRuntimeBindings,
    ReviewedRuntimeBindings,
    InferredRuntimeBindings {
  toModuleNamespace<T extends object>(
    moduleValue: T,
    nodeInterop?: boolean | number,
    namespace?: object,
  ): ModuleNamespace<T>;
  initializeOnce<T>(
    initializer: ((signal: 0) => T) | 0 | undefined,
    result?: T,
  ): () => T | undefined;
}
/** Preserve mutable bindings between modules, including hoisted functions. */
export function bindRuntimeValue<
  Key extends keyof RuntimeBindings,
  Value extends RuntimeBindings[Key],
>(
  runtime: RuntimeBindings,
  name: Key,
  read: () => Value,
  write?: (value: Value) => void,
): void {
  Object.defineProperty(runtime, name, {
    enumerable: true,
    configurable: true,
    get: read,
    set: write,
  });
}
