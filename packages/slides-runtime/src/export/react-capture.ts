/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type ReactDomNamespace,
  type ReactNamespace,
} from "../bindings";
import type { ComponentClass, ReactNode } from "react";
import type { Root } from "react-dom/client";

/** Props of the error boundary that reports render failures back to `renderReactSynchronously`. */
interface CaptureErrorBoundaryProps {
  onError: (error: Error) => void;
  children?: ReactNode;
}

interface CaptureErrorBoundaryState {
  failed: boolean;
}

declare module "../bindings" {
  interface RuntimeBindings {
    CaptureReact: ReactNamespace;
    CaptureReactDom: ReactDomNamespace;
    CaptureErrorBoundary: ComponentClass<CaptureErrorBoundaryProps>;
    initializeSynchronousReactRender: () => void;
    /** Renders `element` into `root` inside `flushSync` and rethrows the first render error. */
    renderReactSynchronously: (root: Root, element: ReactNode) => void;
  }
}

export function installExportReactCapture(
  runtime: RuntimeBindings,
): () => void {
  var CaptureReact: ReactNamespace;
  var CaptureReactDom: ReactDomNamespace;
  var CaptureErrorBoundary: RuntimeBindings["CaptureErrorBoundary"];
  var initializeSynchronousReactRender: RuntimeBindings["initializeSynchronousReactRender"];
  function renderReactSynchronously(root: Root, element: ReactNode): void {
    let result: { threw: boolean; error: unknown } = {
      threw: false,
      error: undefined,
    };
    CaptureReactDom.flushSync(
      () =>
        root.render(
          CaptureReact.createElement(
            CaptureErrorBoundary,
            {
              onError: (input: Error): void => {
                result.threw = true;
                result.error = input;
              },
            },
            element,
          ),
        ),
    );
    if (result.threw) {
      throw result.error;
    }
  }
  bindRuntimeValue(
    runtime,
    "renderReactSynchronously",
    () => renderReactSynchronously,
  );
  bindRuntimeValue(
    runtime,
    "CaptureReact",
    () => CaptureReact,
    (value) => {
      CaptureReact = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CaptureReactDom",
    () => CaptureReactDom,
    (value) => {
      CaptureReactDom = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CaptureErrorBoundary",
    () => CaptureErrorBoundary,
    (value) => {
      CaptureErrorBoundary = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSynchronousReactRender",
    () => initializeSynchronousReactRender,
    (value) => {
      initializeSynchronousReactRender = value;
    },
  );
  return () => {
    initializeSynchronousReactRender = (0, runtime.initializeOnce)(
      (): void => {
        CaptureReact = (0, runtime.toModuleNamespace)(
          (0, runtime.loadReactNamespace)(),
          1,
        );
        CaptureReactDom = (0, runtime.toModuleNamespace)(
          (0, runtime.loadReactDomNamespace)(),
          1,
        );
        CaptureErrorBoundary = class value extends CaptureReact.Component<
          CaptureErrorBoundaryProps,
          CaptureErrorBoundaryState
        > {
          state: CaptureErrorBoundaryState = {
            failed: false,
          };
          static getDerivedStateFromError(): CaptureErrorBoundaryState {
            return {
              failed: true,
            };
          }
          componentDidCatch(input: Error): void {
            this.props.onError(input);
          }
          render(): ReactNode {
            if (this.state.failed) {
              return null;
            } else {
              return this.props.children;
            }
          }
        };
      },
    );
  };
}
