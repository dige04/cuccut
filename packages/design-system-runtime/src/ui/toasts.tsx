/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type * as React from "react";
import type {
  ReactNamespace,
  JsxNamespace,
  QueuedToast,
  PinnedToast,
  ToastAction,
  ToastNotificationBridge,
} from "../contracts/composition";
export function installUiToasts(runtime: RuntimeBindings): () => void {
  var jsxToasts: JsxNamespace;
  var reactk_: ReactNamespace;
  var toastQueue: QueuedToast[];
  var pinnedToast: PinnedToast | null;
  var nextToastId: number;
  var toastSubscribers: Set<(toasts: QueuedToast[]) => void>;
  var pinnedToastSubscribers: Set<(toast: PinnedToast | null) => void>;
  function notifyToastSubscribers() {
    for (let value of toastSubscribers) {
      value(toastQueue);
    }
  }
  function showToast(text: string, durationMs: number = 6000) {
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
    text: string,
    action: ToastAction,
    onClose?: () => void,
  ) {
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
  function closeToast(toastId: number) {
    if (!toastQueue.some((input: QueuedToast) => input.id === toastId)) {
      return;
    }
    toastQueue = toastQueue.filter(
      (input: QueuedToast) => input.id !== toastId,
    );
    notifyToastSubscribers();
  }
  function clearNonActionToasts() {
    let value = toastQueue.filter(
      (input: QueuedToast) => input.action !== undefined,
    );
    if (value.length === toastQueue.length) {
      return;
    }
    toastQueue = value;
    notifyToastSubscribers();
  }
  function clearAllToasts() {
    if (toastQueue.length === 0) {
      return;
    }
    toastQueue = [];
    notifyToastSubscribers();
  }
  function subscribeToasts(listener: (toasts: QueuedToast[]) => void) {
    toastSubscribers.add(listener);
    listener(toastQueue);
    return () => {
      toastSubscribers.delete(listener);
    };
  }
  function useToastBridge() {
    let {
        add: add,
        close: close,
        setPinned: setPinned,
      }: ToastNotificationBridge = (0, runtime.useToastNotifications)(),
      ref = reactk_.useRef(new Map<number, string>());
    reactk_.useEffect(() => {
      let callback = (input: PinnedToast | null) => setPinned(input);
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
      return subscribeToasts((input: QueuedToast[]) => {
        let values = new Set(input.map((input2: QueuedToast) => input2.id));
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
    "jsxToasts",
    () => jsxToasts,
    (value) => {
      jsxToasts = value;
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
  bindRuntimeValue(runtime, "showToast", () => showToast);
  bindRuntimeValue(runtime, "showActionToast", () => showActionToast);
  bindRuntimeValue(runtime, "closeToast", () => closeToast);
  bindRuntimeValue(runtime, "clearNonActionToasts", () => clearNonActionToasts);
  bindRuntimeValue(runtime, "clearAllToasts", () => clearAllToasts);
  bindRuntimeValue(runtime, "subscribeToasts", () => subscribeToasts);
  bindRuntimeValue(runtime, "useToastBridge", () => useToastBridge);
  return () => {
    jsxToasts = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
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
