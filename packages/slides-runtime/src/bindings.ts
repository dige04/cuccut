import type * as React from "react";
import type { CSSProperties } from "react";
import type * as ReactDom from "react-dom";
import type * as ReactDomClient from "react-dom/client";
import type * as JsxRuntime from "react/jsx-runtime";

/**
 * Values modules share through the runtime. A module declares the types of the bindings it defines by augmenting
 * this interface next to its install function (`declare module "../bindings" { interface RuntimeBindings { … } }`);
 * a name nobody has declared reads as `unknown`, so it has to be declared before other modules can use it.
 */
export interface RuntimeBindings {
  [name: string]: unknown;
}
/** What `toModuleNamespace(module, 1)` returns: the module's own exports plus `default` pointing at the module. */
export type ModuleNamespace<T> = T & { default: T };
export type ReactNamespace = ModuleNamespace<typeof React>;
export type ReactDomNamespace = ModuleNamespace<typeof ReactDom>;
export type ReactDomClientNamespace = ModuleNamespace<typeof ReactDomClient>;
export type JsxNamespace = ModuleNamespace<typeof JsxRuntime>;
/**
 * Inline style that also sets CSS custom properties (`--name`). React passes them through, but `CSSProperties` does
 * not list them; use this instead of augmenting React's types, which would leak into every package in the program.
 */
export type CssVariableStyle = CSSProperties & {
  [name: `--${string}`]: string | number | undefined;
};
/** Preserve mutable bindings between modules, including hoisted functions. */
export function bindRuntimeValue<K extends string>(
  runtime: RuntimeBindings,
  name: K,
  read: () => RuntimeBindings[K],
  write?: (value: RuntimeBindings[K]) => void,
): void {
  Object.defineProperty(runtime, name, {
    enumerable: true,
    configurable: true,
    get: read,
    set: write,
  });
}
