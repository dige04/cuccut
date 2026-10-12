/** Restored application module; prepare first, initialize in original order. */
import type { ReactNode } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";

/** A queued toast: plain text with an optional action node. */
export interface ToastEntry {
  id: number;
  text: ReactNode;
  /** Milliseconds before it closes; 0 keeps it until closed. */
  durationMs: number;
  action?: ReactNode;
  onClose?: () => void;
}

/** The toast kept on screen while a long task runs. */
export interface PinnedToast {
  title: ReactNode;
  action?: ReactNode;
}

/** Identifier the notification manager returns for an added toast. */
export type ToastHandle = ReturnType<
  ReturnType<RuntimeBindings["useToastNotifications"]>["add"]
>;

export type ToastQueueListener = (queue: ToastEntry[]) => void;
export type PinnedToastListener = (toast: PinnedToast | null) => void;

declare module "../bindings" {
  interface RuntimeBindings {
    jsxid0: JsxNamespace;
    jsxr__: JsxNamespace;
    reactk_: ReactNamespace;
    toastQueue: ToastEntry[];
    pinnedToast: PinnedToast | null;
    nextToastId: number;
    toastSubscribers: Set<ToastQueueListener>;
    pinnedToastSubscribers: Set<PinnedToastListener>;
    notifyToastSubscribers: () => void;
    setPinnedToast: (toast: PinnedToast | null) => void;
    showToast: (text: ReactNode, durationMs?: number) => number;
    showActionToast: (
      text: ReactNode,
      action: ReactNode,
      onClose?: () => void,
    ) => number;
    closeToast: (toastId: number | null | undefined) => void;
    subscribeToasts: (listener: ToastQueueListener) => () => void;
    useToastBridge: () => null;
  }
}

export function installUiToasts(runtime: RuntimeBindings): () => void {
  var jsxid0: JsxNamespace;
  var jsxr__: JsxNamespace;
  var reactk_: ReactNamespace;
  var toastQueue: ToastEntry[];
  var pinnedToast: PinnedToast | null;
  var nextToastId: number;
  var toastSubscribers: Set<ToastQueueListener>;
  var pinnedToastSubscribers: Set<PinnedToastListener>;
  function notifyToastSubscribers(): void {
    for (let value of toastSubscribers) value(toastQueue);
  }
  function setPinnedToast(toast: PinnedToast | null): void {
    if (toast === pinnedToast) {
      return;
    }
    pinnedToast = toast;
    for (let value of pinnedToastSubscribers) value(pinnedToast);
  }
  function showToast(text: ReactNode, durationMs = 6000): number {
    let value = nextToastId++;
    toastQueue = [
      ...toastQueue,
      {
        id: value,
        text: text,
        durationMs: durationMs,
      },
    ];
    notifyToastSubscribers();
    return value;
  }
  function showActionToast(
    text: ReactNode,
    action: ReactNode,
    onClose?: () => void,
  ): number {
    let value = nextToastId++;
    toastQueue = [
      ...toastQueue,
      {
        id: value,
        text: text,
        durationMs: 0,
        action: action,
        ...(onClose
          ? {
              onClose: onClose,
            }
          : {}),
      },
    ];
    notifyToastSubscribers();
    return value;
  }
  function closeToast(toastId: number | null | undefined): void {
    if (!toastQueue.some((input) => input.id === toastId)) {
      return;
    }
    toastQueue = toastQueue.filter((input) => input.id !== toastId);
    notifyToastSubscribers();
  }
  function subscribeToasts(listener: ToastQueueListener): () => void {
    toastSubscribers.add(listener);
    listener(toastQueue);
    return () => {
      toastSubscribers.delete(listener);
    };
  }
  function useToastBridge(): null {
    let {
        add: add,
        close: close,
        setPinned: setPinned,
      } = (0, runtime.useToastNotifications)(),
      ref = reactk_.useRef(new Map<number, ToastHandle>());
    reactk_.useEffect(() => {
      let callback: PinnedToastListener = (input) => setPinned(input);
      pinnedToastSubscribers.add(callback);
      if (pinnedToast !== null) {
        callback(pinnedToast);
      }
      return () => {
        pinnedToastSubscribers.delete(callback);
      };
    }, [setPinned]);
    reactk_.useEffect(() => {
      let current = ref.current;
      return subscribeToasts((input) => {
        let values = new Set(input.map((input2) => input2.id));
        for (let value of input) {
          if (current.has(value.id)) {
            continue;
          }
          let value2 = add({
            title: value.text,
            action: value.action,
            timeout: Math.max(0, value.durationMs),
            dedupe: false,
            onClose: () => {
              current.delete(value.id);
              closeToast(value.id);
              value.onClose?.();
            },
          });
          current.set(value.id, value2);
        }
        for (let [value, value2] of [...current]) {
          if (values.has(value)) {
            continue;
          }
          current.delete(value);
          close(value2);
        }
      });
    }, [add, close]);
    return null;
  }
  bindRuntimeValue(
    runtime,
    "jsxid0",
    () => jsxid0,
    (value) => {
      jsxid0 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxr__",
    () => jsxr__,
    (value) => {
      jsxr__ = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactk_",
    () => reactk_,
    (value) => {
      reactk_ = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "toastQueue",
    () => toastQueue,
    (value) => {
      toastQueue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pinnedToast",
    () => pinnedToast,
    (value) => {
      pinnedToast = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "nextToastId",
    () => nextToastId,
    (value) => {
      nextToastId = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "toastSubscribers",
    () => toastSubscribers,
    (value) => {
      toastSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pinnedToastSubscribers",
    () => pinnedToastSubscribers,
    (value) => {
      pinnedToastSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "notifyToastSubscribers",
    () => notifyToastSubscribers,
  );
  bindRuntimeValue(runtime, "setPinnedToast", () => setPinnedToast);
  bindRuntimeValue(runtime, "showToast", () => showToast);
  bindRuntimeValue(runtime, "showActionToast", () => showActionToast);
  bindRuntimeValue(runtime, "closeToast", () => closeToast);
  bindRuntimeValue(runtime, "subscribeToasts", () => subscribeToasts);
  bindRuntimeValue(runtime, "useToastBridge", () => useToastBridge);
  return () => {
    (0, runtime.initializeImageDownsampling)();
    (0, runtime.initializeUiPropertyIcons)();
    jsxid0 = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    jsxr__ = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    (0, runtime.initializeUiAnnouncements)();
    (0, runtime.initializeUiInputs210)();
    reactk_ = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    toastQueue = [];
    pinnedToast = null;
    nextToastId = 1;
    toastSubscribers = new Set();
    pinnedToastSubscribers = new Set();
  };
}
