/**
 * Reconstructed react subsystem of the Design Component runtime.
 * Source declarations: dc-runtime.js offsets 142745..143180.
 * Semantic names are inferred from the shipped behavior; see runtime-map.json.
 */

import type {
  RuntimeValue,
  Keyframe,
  PropsMetadata,
  ParsedDesignComponent,
  ComponentRegistry,
  StreamingTracker,
  RenderValues,
  TemplateContext,
  CompiledTemplate,
  DesignRuntime,
  RuntimeOptions,
} from "./types";
export var defineProperty: RuntimeValue = Object.defineProperty,
  defineOwnField: RuntimeValue = (
    target?: RuntimeValue,
    property?: RuntimeValue,
    value?: RuntimeValue,
  ): RuntimeValue =>
    property in target
      ? defineProperty(target, property, {
          enumerable: true,
          configurable: true,
          writable: true,
          value: value,
        })
      : (target[property] = value),
  initializeField: RuntimeValue = (
    target?: RuntimeValue,
    property?: RuntimeValue,
    value?: RuntimeValue,
  ): RuntimeValue =>
    defineOwnField(
      target,
      typeof property != "symbol" ? property + "" : property,
      value,
    );
export function getReact(): RuntimeValue {
  const react: RuntimeValue = window.React;
  if (!react) throw new Error("dc-runtime: window.React is not available yet");
  return react;
}
export function getReactDOM(): RuntimeValue {
  const reactDOM: RuntimeValue = window.ReactDOM;
  if (!reactDOM)
    throw new Error("dc-runtime: window.ReactDOM is not available yet");
  return reactDOM;
}
export function createElement(...argumentsList: RuntimeValue[]): RuntimeValue {
  return getReact().createElement(...argumentsList);
}
// The classic JSX factory owns React's type-only JSX namespace.
export namespace createElement {
  export namespace JSX {
    export type Element = import("react").JSX.Element;
    export type ElementClass = import("react").JSX.ElementClass;
    export type ElementAttributesProperty =
      import("react").JSX.ElementAttributesProperty;
    export type ElementChildrenAttribute =
      import("react").JSX.ElementChildrenAttribute;
    export type IntrinsicElements = import("react").JSX.IntrinsicElements;
    export type IntrinsicAttributes = import("react").JSX.IntrinsicAttributes;
    export type IntrinsicClassAttributes<T> =
      import("react").JSX.IntrinsicClassAttributes<T>;
    export type LibraryManagedAttributes<C, P> =
      import("react").JSX.LibraryManagedAttributes<C, P>;
  }
}
