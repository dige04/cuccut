import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsHooksStableCallback(
  runtime: RuntimeBindings,
): () => void {
  var initializeHooksStableCallback: () => void;
  var reactHooksStableCallback: typeof React;
  var initializeHooksStableCallback_2: () => void;
  function asElement(value: EventTarget | null | undefined): Element | null {
    return (
      (value as Node | null | undefined)?.nodeType === 1 ? value : null
    ) as Element | null;
  }
  function createStableCallback<Args extends unknown[], Result>(
    input: React.RefObject<(...args: Args) => Result>,
  ): (...args: Args) => Result {
    return (...input2) => input.current(...input2);
  }
  function createOptionalStableCallback<Args extends unknown[], Result>(
    input: React.RefObject<((...args: Args) => Result) | undefined>,
  ): (...args: Args) => Result | undefined {
    return (...input2) => input.current?.(...input2);
  }
  function useOptionalStableCallback<Args extends unknown[], Result>(
    input: (...args: Args) => Result,
  ): (...args: Args) => Result | undefined;
  function useOptionalStableCallback<Args extends unknown[], Result>(
    input: ((...args: Args) => Result) | undefined,
  ): ((...args: Args) => Result | undefined) | undefined;
  function useOptionalStableCallback<Args extends unknown[], Result>(
    input: ((...args: Args) => Result) | undefined,
  ): ((...args: Args) => Result | undefined) | undefined {
    let value = (0, reactHooksStableCallback.useRef)(input);
    (0, reactHooksStableCallback.useInsertionEffect)(() => {
      value.current = input;
    }, [input]);
    let [value2] = (0, reactHooksStableCallback.useState)(() =>
      createOptionalStableCallback(value),
    );
    return input === undefined ? undefined : value2;
  }
  function useStableCallback<Args extends unknown[], Result>(
    input: (...args: Args) => Result,
  ): (...args: Args) => Result {
    let value = (0, reactHooksStableCallback.useRef)(input);
    (0, reactHooksStableCallback.useInsertionEffect)(() => {
      value.current = input;
    }, [input]);
    let [value2] = (0, reactHooksStableCallback.useState)(() =>
      createStableCallback(value),
    );
    return value2;
  }
  bindRuntimeValue(runtime, "asElement", () => asElement);
  bindRuntimeValue(
    runtime,
    "initializeHooksStableCallback",
    () => initializeHooksStableCallback,
    (value) => {
      initializeHooksStableCallback = value;
    },
  );
  bindRuntimeValue(runtime, "createStableCallback", () => createStableCallback);
  bindRuntimeValue(
    runtime,
    "createOptionalStableCallback",
    () => createOptionalStableCallback,
  );
  bindRuntimeValue(
    runtime,
    "useOptionalStableCallback",
    () => useOptionalStableCallback,
  );
  bindRuntimeValue(runtime, "useStableCallback", () => useStableCallback);
  bindRuntimeValue(
    runtime,
    "reactHooksStableCallback",
    () => reactHooksStableCallback,
    (value) => {
      reactHooksStableCallback = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeHooksStableCallback_2",
    () => initializeHooksStableCallback_2,
    (value) => {
      initializeHooksStableCallback_2 = value;
    },
  );
  return () => {
    initializeHooksStableCallback = (0, runtime.initializeOnce)(() => {});
    initializeHooksStableCallback_2 = (0, runtime.initializeOnce)(() => {
      reactHooksStableCallback = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
    });
  };
}
