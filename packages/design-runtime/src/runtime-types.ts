/** Dynamic boundaries whose static types were erased in the shipped artifact.
 * Concrete document and host contracts are described in types.ts. */
export type Dynamic = any;
import type { ApplicationContracts } from "./runtime-contracts";

type NpmBindings = {
  -readonly [Key in keyof ApplicationContracts as Key extends `npm_${string}`
    ? Key
    : never]: ApplicationContracts[Key];
};
export interface RuntimeBindings
  extends Omit<Readonly<ApplicationContracts>, keyof NpmBindings>,
    NpmBindings {
  /** Shared live focus-cancellation cell, intentionally writable by dialog/link owners. */
  DialogDialogCurrentState: ApplicationContracts["DialogDialogCurrentState"];
  [name: string]: Dynamic;
}
/** Live accessors preserve hoisting and mutable cross-module bindings. */
type BindingValue<
  Key extends string,
  Value,
> = Key extends keyof ApplicationContracts ? ApplicationContracts[Key] : Value;

export function bindRuntimeValue<const Key extends string, Value>(
  runtime: RuntimeBindings,
  name: Key,
  get: () => BindingValue<NoInfer<Key>, Value>,
  set?: (value: BindingValue<NoInfer<Key>, Value>) => void,
): void {
  Object.defineProperty(runtime, name, {
    enumerable: true,
    configurable: true,
    get,
    ...(set ? { set } : {}),
  });
}
