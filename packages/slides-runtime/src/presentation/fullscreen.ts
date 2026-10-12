/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** `Document` plus the WebKit-prefixed fullscreen members (Safari before 16.4). */
export interface FullscreenDocument extends Document {
  readonly documentElement: HTMLElement & FullscreenElement;
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
}
/** `Element` plus the WebKit-prefixed fullscreen request. */
export interface FullscreenElement extends Element {
  webkitRequestFullscreen?: () => void;
}
/** How a fullscreen request ended: entered, refused by the browser, or not possible at all. */
export type FullscreenOutcome =
  | { kind: "entered" }
  | { kind: "denied" }
  | { kind: "unavailable" };
/** Names of the fullscreen change and error events the document supports (standard or WebKit-prefixed). */
export interface FullscreenEventNames {
  change: string;
  error: string;
}
/** An in-flight fullscreen request being watched; `cancel` detaches its listeners and timer. */
export interface FullscreenRequestObserver {
  outcome: Promise<FullscreenOutcome>;
  cancel: () => void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    FULLSCREEN_REQUEST_TIMEOUT_MS: number;
    cancelStaleFullscreenListener: (() => void) | null;
    fullscreenRequestSequence: number;
    fullscreenRequestsInFlight: number;
    exitStaleFullscreenRequest: (
      document2: FullscreenDocument,
      element: FullscreenElement,
    ) => void;
    isPromiseLike: (
      value?: { then?: unknown } | null,
    ) => value is PromiseLike<unknown>;
    getFullscreenDocument: (
      documentOverride?: FullscreenDocument,
    ) => FullscreenDocument | undefined;
    supportsStandardFullscreen: (document2: FullscreenDocument) => boolean;
    supportsWebkitFullscreen: (document2: FullscreenDocument) => boolean;
    fullscreenAvailable: (document2?: FullscreenDocument) => boolean;
    getFullscreenElement: (document2?: FullscreenDocument) => Element | null;
    isFullscreenOrEntering: (document2?: FullscreenDocument) => boolean;
    getFullscreenEventNames: (
      document2: FullscreenDocument,
    ) => FullscreenEventNames;
    observeFullscreenRequest: (
      document2: FullscreenDocument,
      element: FullscreenElement,
      timeoutMs: number,
    ) => FullscreenRequestObserver;
    requestFullscreen: (
      element: FullscreenElement,
    ) => Promise<FullscreenOutcome>;
    exitFullscreen: (document2?: FullscreenDocument) => Promise<void>;
    subscribeFullscreenChange: (
      listener: (element: Element | null) => void,
      document2?: FullscreenDocument,
    ) => () => void;
  }
}

export function installPresentationFullscreen(
  runtime: RuntimeBindings,
): () => void {
  var FULLSCREEN_REQUEST_TIMEOUT_MS: number;
  var cancelStaleFullscreenListener: (() => void) | null;
  var fullscreenRequestSequence: number;
  var fullscreenRequestsInFlight: number;
  function exitStaleFullscreenRequest(
    document2: FullscreenDocument,
    element: FullscreenElement,
  ): void {
    cancelStaleFullscreenListener?.();
    let { change: eventNames } = getFullscreenEventNames(document2),
      callback: () => void = (): void => {
        clearTimeout(value);
        document2.removeEventListener(eventNames, callback2);
        if (cancelStaleFullscreenListener === callback) {
          cancelStaleFullscreenListener = null;
        }
      },
      callback2: () => void = (): void => {
        if (getFullscreenElement(document2) !== element) {
          return;
        }
        callback();
        exitFullscreen(document2);
      };
    document2.addEventListener(eventNames, callback2);
    let value = setTimeout(callback, FULLSCREEN_REQUEST_TIMEOUT_MS * 20);
    cancelStaleFullscreenListener = callback;
  }
  function isPromiseLike(
    value?: { then?: unknown } | null,
  ): value is PromiseLike<unknown> {
    return (
      typeof value === "object" &&
      value !== null &&
      typeof value.then === "function"
    );
  }
  function getFullscreenDocument(
    documentOverride?: FullscreenDocument,
  ): FullscreenDocument | undefined {
    if (documentOverride !== undefined) {
      return documentOverride;
    }
    if (typeof document === "undefined") {
      return undefined;
    } else {
      return document;
    }
  }
  function supportsStandardFullscreen(document2: FullscreenDocument): boolean {
    return (
      document2.fullscreenEnabled === true &&
      typeof document2.documentElement?.requestFullscreen === "function"
    );
  }
  function supportsWebkitFullscreen(document2: FullscreenDocument): boolean {
    return (
      document2.webkitFullscreenEnabled === true &&
      typeof document2.documentElement?.webkitRequestFullscreen === "function"
    );
  }
  function fullscreenAvailable(document2?: FullscreenDocument): boolean {
    let resolvedDocument = getFullscreenDocument(document2);
    return (
      resolvedDocument !== undefined &&
      (supportsStandardFullscreen(resolvedDocument) ||
        supportsWebkitFullscreen(resolvedDocument))
    );
  }
  function getFullscreenElement(document2?: FullscreenDocument): Element | null {
    let resolvedDocument = getFullscreenDocument(document2);
    if (resolvedDocument === undefined) {
      return null;
    }
    return (
      resolvedDocument.fullscreenElement ??
      resolvedDocument.webkitFullscreenElement ??
      null
    );
  }
  function isFullscreenOrEntering(document2?: FullscreenDocument): boolean {
    return (
      fullscreenRequestsInFlight > 0 || getFullscreenElement(document2) !== null
    );
  }
  function getFullscreenEventNames(
    document2: FullscreenDocument,
  ): FullscreenEventNames {
    if ("onfullscreenchange" in document2) {
      return {
        change: "fullscreenchange",
        error: "fullscreenerror",
      };
    } else {
      return {
        change: "webkitfullscreenchange",
        error: "webkitfullscreenerror",
      };
    }
  }
  function observeFullscreenRequest(
    document2: FullscreenDocument,
    element: FullscreenElement,
    timeoutMs: number,
  ): FullscreenRequestObserver {
    let cleanup: () => void = (): void => {};
    return {
      outcome: new Promise<FullscreenOutcome>(
        (input: (outcome: FullscreenOutcome) => void): void => {
          let { change: value, error: value2 } =
              getFullscreenEventNames(document2),
            value3: ReturnType<typeof setTimeout>,
            flag = false;
          cleanup = (): void => {
            flag = true;
            clearTimeout(value3);
            document2.removeEventListener(value, callback2);
            document2.removeEventListener(value2, callback3);
          };
          let callback = (input2: FullscreenOutcome): void => {
              if (flag) {
                return;
              }
              cleanup();
              input(input2);
            },
            callback2 = (): void => {
              if (getFullscreenElement(document2) === element) {
                callback({
                  kind: "entered",
                });
              }
            },
            callback3 = (): void =>
              callback({
                kind: "denied",
              });
          document2.addEventListener(value, callback2);
          document2.addEventListener(value2, callback3);
          if (getFullscreenElement(document2) === element) {
            queueMicrotask(callback2);
          }
          value3 = setTimeout((): void => {
            if (getFullscreenElement(document2) === element) {
              callback({
                kind: "entered",
              });
              return;
            }
            callback({
              kind: "denied",
            });
            if (timeoutMs === fullscreenRequestSequence) {
              exitStaleFullscreenRequest(document2, element);
            }
          }, FULLSCREEN_REQUEST_TIMEOUT_MS);
        },
      ),
      cancel: cleanup,
    };
  }
  function requestFullscreen(
    element: FullscreenElement,
  ): Promise<FullscreenOutcome> {
    let ownerDocument = getFullscreenDocument(element.ownerDocument);
    if (ownerDocument === undefined || !fullscreenAvailable(ownerDocument)) {
      return Promise.resolve<FullscreenOutcome>({
        kind: "unavailable",
      });
    }
    if (getFullscreenElement(ownerDocument) === element) {
      return Promise.resolve<FullscreenOutcome>({
        kind: "entered",
      });
    }
    let requestId = ++fullscreenRequestSequence;
    cancelStaleFullscreenListener?.();
    fullscreenRequestsInFlight += 1;
    let observer = (
        input: Promise<FullscreenOutcome>,
      ): Promise<FullscreenOutcome> => {
        input.then((): void => {
          fullscreenRequestsInFlight -= 1;
        });
        return input;
      },
      value = element;
    try {
      if (supportsStandardFullscreen(ownerDocument)) {
        let value2 = value.requestFullscreen({
            navigationUI: "hide",
          }),
          value3 = observeFullscreenRequest(ownerDocument, element, requestId);
        if (!isPromiseLike(value2)) {
          return observer(value3.outcome);
        }
        let value4 = Promise.resolve(value2).then(
          (): FullscreenOutcome => ({
            kind: "entered",
          }),
          (): FullscreenOutcome => ({
            kind: "denied",
          }),
        );
        value4.then(value3.cancel);
        return observer(Promise.race([value4, value3.outcome]));
      }
      value.webkitRequestFullscreen!();
      return observer(
        observeFullscreenRequest(ownerDocument, element, requestId).outcome,
      );
    } catch {
      fullscreenRequestsInFlight -= 1;
      return Promise.resolve<FullscreenOutcome>({
        kind: "denied",
      });
    }
  }
  function exitFullscreen(document2?: FullscreenDocument): Promise<void> {
    let resolvedDocument = getFullscreenDocument(document2);
    if (
      resolvedDocument === undefined ||
      getFullscreenElement(resolvedDocument) === null
    ) {
      return Promise.resolve();
    }
    try {
      if (
        resolvedDocument.fullscreenElement &&
        typeof resolvedDocument.exitFullscreen === "function"
      ) {
        return Promise.resolve(resolvedDocument.exitFullscreen()).catch(
          (): void => {
            return;
          },
        );
      }
      resolvedDocument.webkitExitFullscreen?.();
    } catch {}
    return Promise.resolve();
  }
  function subscribeFullscreenChange(
    listener: (element: Element | null) => void,
    document2?: FullscreenDocument,
  ): () => void {
    let resolvedDocument = getFullscreenDocument(document2);
    if (resolvedDocument === undefined) {
      return (): void => {};
    }
    let { change: change } = getFullscreenEventNames(resolvedDocument),
      callback = (): void => listener(getFullscreenElement(resolvedDocument));
    resolvedDocument.addEventListener(change, callback);
    return (): void => resolvedDocument.removeEventListener(change, callback);
  }
  bindRuntimeValue(
    runtime,
    "FULLSCREEN_REQUEST_TIMEOUT_MS",
    () => FULLSCREEN_REQUEST_TIMEOUT_MS,
    (value) => {
      FULLSCREEN_REQUEST_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cancelStaleFullscreenListener",
    () => cancelStaleFullscreenListener,
    (value) => {
      cancelStaleFullscreenListener = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fullscreenRequestSequence",
    () => fullscreenRequestSequence,
    (value) => {
      fullscreenRequestSequence = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fullscreenRequestsInFlight",
    () => fullscreenRequestsInFlight,
    (value) => {
      fullscreenRequestsInFlight = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exitStaleFullscreenRequest",
    () => exitStaleFullscreenRequest,
  );
  bindRuntimeValue(runtime, "isPromiseLike", () => isPromiseLike);
  bindRuntimeValue(
    runtime,
    "getFullscreenDocument",
    () => getFullscreenDocument,
  );
  bindRuntimeValue(
    runtime,
    "supportsStandardFullscreen",
    () => supportsStandardFullscreen,
  );
  bindRuntimeValue(
    runtime,
    "supportsWebkitFullscreen",
    () => supportsWebkitFullscreen,
  );
  bindRuntimeValue(runtime, "fullscreenAvailable", () => fullscreenAvailable);
  bindRuntimeValue(runtime, "getFullscreenElement", () => getFullscreenElement);
  bindRuntimeValue(
    runtime,
    "isFullscreenOrEntering",
    () => isFullscreenOrEntering,
  );
  bindRuntimeValue(
    runtime,
    "getFullscreenEventNames",
    () => getFullscreenEventNames,
  );
  bindRuntimeValue(
    runtime,
    "observeFullscreenRequest",
    () => observeFullscreenRequest,
  );
  bindRuntimeValue(runtime, "requestFullscreen", () => requestFullscreen);
  bindRuntimeValue(runtime, "exitFullscreen", () => exitFullscreen);
  bindRuntimeValue(
    runtime,
    "subscribeFullscreenChange",
    () => subscribeFullscreenChange,
  );
  return () => {
    (0, runtime.initializeVideoLinkPlayer)();
    FULLSCREEN_REQUEST_TIMEOUT_MS = 3000;
    cancelStaleFullscreenListener = null;
    fullscreenRequestSequence = 0;
    fullscreenRequestsInFlight = 0;
  };
}
