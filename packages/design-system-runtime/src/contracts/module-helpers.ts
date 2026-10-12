/** The original interop copies named properties rather than callable signatures. */
export type ModuleNamespace<Value extends object> = {
  [Key in keyof Value]: Value[Key];
} & { readonly default?: Value; readonly __esModule?: boolean };
export type ExportGetters = Record<string, () => unknown>;
export interface RequireFunction {
  (specifier: string, ...args: unknown[]): unknown;
  apply(thisArg: unknown, args: ArrayLike<unknown>): unknown;
}
