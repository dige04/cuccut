/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type ReactNamespace,
} from "../bindings";

/** Resolves the canvas element that should get keyboard focus back, or null when there is none. */
export type CanvasFocusResolver = () => HTMLElement | null;

declare module "../bindings" {
  interface RuntimeBindings {
    reactdH: ReactNamespace;
    canvasFocusResolver: CanvasFocusResolver | null;
    setCanvasFocusResolver: (
      resolve: CanvasFocusResolver | null,
    ) => () => void;
    useCanvasFocusResolver: (resolve: CanvasFocusResolver) => void;
    usePopupFocusRestoration: (
      open: unknown,
      isOpenNow?: () => boolean,
    ) => void;
    focusCanvasWhenDocumentIsIdle: () => boolean;
    isInspectorFocusTarget: (target: EventTarget | null | undefined) => boolean;
  }
}

export function installUiCanvasFocus(runtime: RuntimeBindings): () => void {
  var reactdH: ReactNamespace;
  var canvasFocusResolver: CanvasFocusResolver | null;
  function setCanvasFocusResolver(
    resolve: CanvasFocusResolver | null,
  ): () => void {
    canvasFocusResolver = resolve;
    return (): void => {
      if (canvasFocusResolver === resolve) {
        canvasFocusResolver = null;
      }
    };
  }
  function useCanvasFocusResolver(resolve: CanvasFocusResolver): void {
    let ref = reactdH.useRef(resolve);
    ref.current = resolve;
    reactdH.useEffect(
      () => setCanvasFocusResolver(() => ref.current()),
      [],
    );
  }
  function usePopupFocusRestoration(
    open: unknown,
    isOpenNow?: () => boolean,
  ): void {
    let ref = reactdH.useRef<{
      open: unknown;
      isOpenNow: (() => boolean) | undefined;
    }>({
      open: open,
      isOpenNow: isOpenNow,
    });
    ref.current = {
      open: open,
      isOpenNow: isOpenNow,
    };
    let ref2 = reactdH.useRef(false);
    reactdH.useEffect(() => {
      ref2.current = true;
      return () => {
        ref2.current = false;
      };
    }, []);
    reactdH.useEffect(() => {
      if (!open) {
        return;
      }
      return () => {
        if (canvasFocusResolver === null) {
          return;
        }
        requestAnimationFrame(() => {
          let { open: current, isOpenNow: current2 } = ref.current;
          if (!(current2 ? current2() : ref2.current && Boolean(current))) {
            focusCanvasWhenDocumentIsIdle();
          }
        });
      };
    }, [open]);
  }
  function focusCanvasWhenDocumentIsIdle(): boolean {
    if (canvasFocusResolver === null || !document.hasFocus()) {
      return false;
    }
    let activeElement = document.activeElement;
    if (
      !(
        activeElement === null ||
        activeElement === document.body ||
        activeElement === document.documentElement
      )
    ) {
      return false;
    }
    let value = canvasFocusResolver();
    if (
      value === null ||
      !value.isConnected ||
      value.closest('[inert], [aria-hidden="true"]') !== null
    ) {
      return false;
    }
    value.focus({
      preventScroll: true,
    });
    return document.activeElement === value;
  }
  function isInspectorFocusTarget(
    target: EventTarget | null | undefined,
  ): boolean {
    let value = target as Partial<Pick<Element, "closest">> | null | undefined;
    return (
      value != null &&
      typeof value.closest === "function" &&
      value.closest(
        '[data-property-row],[data-tweaks-surface],[role="separator"]',
      ) != null
    );
  }
  bindRuntimeValue(
    runtime,
    "reactdH",
    () => reactdH,
    (value) => {
      reactdH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "canvasFocusResolver",
    () => canvasFocusResolver,
    (value) => {
      canvasFocusResolver = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setCanvasFocusResolver",
    () => setCanvasFocusResolver,
  );
  bindRuntimeValue(
    runtime,
    "useCanvasFocusResolver",
    () => useCanvasFocusResolver,
  );
  bindRuntimeValue(
    runtime,
    "usePopupFocusRestoration",
    () => usePopupFocusRestoration,
  );
  bindRuntimeValue(
    runtime,
    "focusCanvasWhenDocumentIsIdle",
    () => focusCanvasWhenDocumentIsIdle,
  );
  bindRuntimeValue(
    runtime,
    "isInspectorFocusTarget",
    () => isInspectorFocusTarget,
  );
  return () => {
    (0, runtime.initializeUiPropertyPopover2)();
    (0, runtime.initializeUiPropertyFocus)();
    reactdH = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    canvasFocusResolver = null;
  };
}
