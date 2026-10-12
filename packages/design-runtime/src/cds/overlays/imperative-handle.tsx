import type { OverlayActions, PublicOverlayActions } from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsOverlaysImperativeHandle(
  runtime: RuntimeBindings,
): () => void {
  var reactOverlaysImperativeHandle: typeof React;
  var initializeOverlaysImperativeHandle: () => void;
  function useOverlayImperativeHandle(
    input: React.RefObject<OverlayActions | null>,
    options?: React.Ref<PublicOverlayActions>,
  ): void {
    (0, reactOverlaysImperativeHandle.useImperativeHandle)(
      options,
      () => ({
        close: () => input.current?.close?.(),
        unmount: () => input.current?.unmount(),
      }),
      [input],
    );
  }
  bindRuntimeValue(
    runtime,
    "useOverlayImperativeHandle",
    () => useOverlayImperativeHandle,
  );
  bindRuntimeValue(
    runtime,
    "reactOverlaysImperativeHandle",
    () => reactOverlaysImperativeHandle,
    (value) => {
      reactOverlaysImperativeHandle = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeOverlaysImperativeHandle",
    () => initializeOverlaysImperativeHandle,
    (value) => {
      initializeOverlaysImperativeHandle = value;
    },
  );
  return () => {
    initializeOverlaysImperativeHandle = (0, runtime.initializeOnce)(() => {
      "use client";

      reactOverlaysImperativeHandle = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
    });
  };
}
