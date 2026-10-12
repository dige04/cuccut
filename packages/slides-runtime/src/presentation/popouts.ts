/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type ReactDomClientNamespace,
  type ReactNamespace,
} from "../bindings";

/** A popout's window; `ResizeObserver` is the one global the speaker panel reads from it. */
export type PopoutWindow = Window & { ResizeObserver?: typeof ResizeObserver };
/** Options of `openPopoutView`. */
export interface PopoutOpenOptions {
  /** Open a browser tab instead of a sized popup window. */
  tab?: boolean;
  /** Requested popup size in pixels. */
  width?: number;
  height?: number;
  /** Document title; defaults to the popout key. */
  title?: string;
  /** Extra CSS appended to the styles copied from the opener. */
  css?: string;
}
/** A live popout window and the channel to talk to it. */
export interface PopoutView {
  win: PopoutWindow;
  /** Element the popout's UI renders into. */
  root: HTMLDivElement;
  /** The opener's end of the message channel. */
  port: MessagePort;
  /** The popout's end of the message channel. */
  peer: MessagePort;
  /** Settles once the popout is closed. */
  closed: Promise<void>;
  close: () => void;
}
/** `opened` carries the view, `unavailable` means no popout can ever open here, `blocked` that this attempt failed. */
export type PopoutOpenResult =
  | { kind: "opened"; view: PopoutView; reused?: true }
  | { kind: "unavailable" | "blocked" };

declare module "../bindings" {
  interface RuntimeBindings {
    ReactSpeakerNotes: ReactNamespace;
    SpeakerNotesReactRoot: ReactDomClientNamespace;
    openPopoutViews: Map<string, PopoutView>;
    popoutOpening: boolean;
    popoutPagehideCleanup: (() => void) | null;
    normalizePopoutWindowDimension: (
      requested: number | undefined,
      fallback: number,
    ) => number;
    escapePopoutHtml: (text: string) => string;
    buildPopoutDocumentHtml: (title: string) => string;
    collectPopoutStyles: (document: Document) => string[];
    installPopoutPagehideCleanup: () => void;
    isPopoutViewAlive: (view: PopoutView) => boolean;
    focusPopoutWindow: (window: Window) => void;
    openPopoutView: (key: string, options?: PopoutOpenOptions) => PopoutOpenResult;
  }
}

export function installPresentationPopouts(
  runtime: RuntimeBindings,
): () => void {
  var ReactSpeakerNotes: ReactNamespace;
  var SpeakerNotesReactRoot: ReactDomClientNamespace;
  var openPopoutViews: RuntimeBindings["openPopoutViews"];
  var popoutOpening: RuntimeBindings["popoutOpening"];
  var popoutPagehideCleanup: RuntimeBindings["popoutPagehideCleanup"];
  function normalizePopoutWindowDimension(
    requested: number | undefined,
    fallback: number,
  ): number {
    return Math.max(100, Math.round(requested ?? fallback));
  }
  function escapePopoutHtml(text: string): string {
    return text.replace(
      /[&<>"']/g,
      (input) => "&#" + String(input.charCodeAt(0)) + ";",
    );
  }
  function buildPopoutDocumentHtml(title: string): string {
    return (
      '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
      escapePopoutHtml(title) +
      "</title><style>html,body{margin:0;height:100%}</style><script>setInterval(function(){if(!window.opener||window.opener.closed)window.close()},1000)<\/script></head><body></body></html>"
    );
  }
  function collectPopoutStyles(document2: Document): string[] {
    let css: string[] = [];
    for (let value of Array.from(
      document2.head.querySelectorAll<HTMLStyleElement | HTMLLinkElement>(
        'style,link[rel~="stylesheet"]',
      ),
    )) {
      if (value.tagName === "STYLE") {
        if (value.textContent) {
          css.push(value.textContent);
        }
        continue;
      }
      try {
        let value2 = value.sheet?.cssRules;
        if (value2) {
          css.push(
            Array.from(value2, (input) => input.cssText).join(`
`),
          );
        }
      } catch {}
    }
    return css;
  }
  function installPopoutPagehideCleanup(): void {
    if (popoutPagehideCleanup !== null) {
      return;
    }
    let callback = () => {
      for (let value of Array.from(openPopoutViews.values())) value.close();
    };
    window.addEventListener("pagehide", callback);
    popoutPagehideCleanup = () =>
      window.removeEventListener("pagehide", callback);
  }
  function isPopoutViewAlive(view: PopoutView): boolean {
    try {
      return !view.win.closed && view.win.document === view.root.ownerDocument;
    } catch {
      return false;
    }
  }
  function focusPopoutWindow(window2: Window): void {
    if ((0, runtime.isFullscreenOrEntering)()) {
      return;
    }
    try {
      window2.focus();
    } catch {}
  }
  function openPopoutView(
    key: string,
    options: PopoutOpenOptions = {},
  ): PopoutOpenResult {
    let existingView = openPopoutViews.get(key);
    if (existingView !== undefined) {
      if (isPopoutViewAlive(existingView)) {
        focusPopoutWindow(existingView.win);
        return {
          kind: "opened",
          view: existingView,
          reused: true,
        };
      }
      existingView.close();
    }
    if (
      popoutOpening ||
      typeof window === "undefined" ||
      typeof window.open !== "function"
    ) {
      return {
        kind: "unavailable",
      };
    }
    let value: PopoutWindow | null;
    try {
      value = window.open(
        "about:blank",
        "appifact-popup-" + key,
        options.tab === true
          ? ""
          : "popup=1,width=" +
              String(normalizePopoutWindowDimension(options.width, 480)) +
              ",height=" +
              String(normalizePopoutWindowDimension(options.height, 320)),
      );
    } catch (value7) {
      if ((value7 as Error | null | undefined)?.name === "InvalidAccessError") {
        popoutOpening = true;
        return {
          kind: "unavailable",
        };
      }
      return {
        kind: "blocked",
      };
    }
    if (value === null || value === undefined) {
      return {
        kind: "blocked",
      };
    }
    let value2 = value,
      value3: Document;
    try {
      value3 = value2.document;
      value3.open();
      value3.write(buildPopoutDocumentHtml(options.title ?? key));
      value3.close();
      if (value2.location.search !== "") {
        value2.history.replaceState(null, "", value2.location.pathname);
        if (value2.location.search !== "") {
          throw Error("popup kept its query");
        }
      }
    } catch {
      try {
        value2.close();
      } catch {}
      return {
        kind: "blocked",
      };
    }
    for (let value7 of [
      "lang",
      "data-theme",
      runtime.pinnedColorModeAttribute,
    ]) {
      let attribute = document.documentElement.getAttribute(value7);
      if (attribute !== null) {
        value3.documentElement.setAttribute(value7, attribute);
      }
    }
    (0, runtime.initializeDocumentColorMode)(value3);
    for (let value7 of [
      ...collectPopoutStyles(document),
      options.css ?? "",
    ]) {
      if (value7 === "") {
        continue;
      }
      let value8 = value3.createElement("style");
      value8.textContent = value7;
      value3.head.appendChild(value8);
    }
    let value4 = value3.createElement("div");
    value4.id = "popup-root";
    value3.body.appendChild(value4);
    let { port1: port1, port2: port2 } = new MessageChannel(),
      value5: () => void,
      promise = new Promise<void>((input) => {
        value5 = input;
      }),
      flag = false,
      callback = (input?: boolean): void => {
        if (flag) {
          return;
        }
        flag = true;
        if (openPopoutViews.get(key) === state) {
          openPopoutViews.delete(key);
        }
        clearInterval(value6);
        try {
          value2.removeEventListener("pagehide", callback3);
        } catch {}
        port1.close();
        port2.close();
        if (input && !value2.closed) {
          try {
            value2.close();
          } catch {}
        }
        value5();
      },
      callback2 = (): void => {
        if (!isPopoutViewAlive(state)) {
          callback(true);
        }
      },
      callback3 = (): void => {
        setTimeout(callback2, 0);
      };
    value2.addEventListener("pagehide", callback3);
    let value6 = setInterval(callback2, 1000),
      state: PopoutView = {
        win: value2,
        root: value4,
        port: port1,
        peer: port2,
        closed: promise,
        close: () => callback(true),
      };
    openPopoutViews.set(key, state);
    installPopoutPagehideCleanup();
    focusPopoutWindow(value2);
    return {
      kind: "opened",
      view: state,
    };
  }
  bindRuntimeValue(
    runtime,
    "ReactSpeakerNotes",
    () => ReactSpeakerNotes,
    (value) => {
      ReactSpeakerNotes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SpeakerNotesReactRoot",
    () => SpeakerNotesReactRoot,
    (value) => {
      SpeakerNotesReactRoot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "openPopoutViews",
    () => openPopoutViews,
    (value) => {
      openPopoutViews = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "popoutOpening",
    () => popoutOpening,
    (value) => {
      popoutOpening = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "popoutPagehideCleanup",
    () => popoutPagehideCleanup,
    (value) => {
      popoutPagehideCleanup = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizePopoutWindowDimension",
    () => normalizePopoutWindowDimension,
  );
  bindRuntimeValue(runtime, "escapePopoutHtml", () => escapePopoutHtml);
  bindRuntimeValue(
    runtime,
    "buildPopoutDocumentHtml",
    () => buildPopoutDocumentHtml,
  );
  bindRuntimeValue(runtime, "collectPopoutStyles", () => collectPopoutStyles);
  bindRuntimeValue(
    runtime,
    "installPopoutPagehideCleanup",
    () => installPopoutPagehideCleanup,
  );
  bindRuntimeValue(runtime, "isPopoutViewAlive", () => isPopoutViewAlive);
  bindRuntimeValue(runtime, "focusPopoutWindow", () => focusPopoutWindow);
  bindRuntimeValue(runtime, "openPopoutView", () => openPopoutView);
  return () => {
    ReactSpeakerNotes = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    SpeakerNotesReactRoot = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactDomClientNamespace)(),
      1,
    );
    openPopoutViews = new Map();
    popoutOpening = false;
    popoutPagehideCleanup = null;
  };
}
