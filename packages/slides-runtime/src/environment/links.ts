/** Restored application module; prepare first, initialize in original order. */
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** Opens the link of the focused element on Enter (see `createLinkEnterHandler`). */
export type LinkEnterHandler = (event: ReactKeyboardEvent) => void;
export interface ExternalLinkOptions {
  /** The URL comes from stored content, where the looser pattern applies. */
  storedUrl?: boolean;
}

declare module "../bindings" {
  interface RuntimeBindings {
    truncateUtf16Safely: (text: string, maxLength: number) => string;
    classifyExternalLink: (
      url: string,
      options?: ExternalLinkOptions,
    ) => string | null;
    linkUrlFromElement: (element: Element) => string;
    openExternalLink: (url: string, options?: ExternalLinkOptions) => void;
    externalLinkPattern: RegExp;
    storedLinkPattern: RegExp;
    linkModifierLabel: string;
    linkOpenHint: string;
    createLinkEnterHandler: (requireModifier: boolean) => LinkEnterHandler;
    modifiedLinkEnterHandler: LinkEnterHandler;
    linkEnterHandler: LinkEnterHandler;
    initializeExternalLinks: () => void;
  }
}

export function installEnvironmentLinks(runtime: RuntimeBindings): () => void {
  var externalLinkPattern: RegExp;
  var storedLinkPattern: RegExp;
  var linkModifierLabel: string;
  var linkOpenHint: string;
  var createLinkEnterHandler: (requireModifier: boolean) => LinkEnterHandler;
  var modifiedLinkEnterHandler: LinkEnterHandler;
  var linkEnterHandler: LinkEnterHandler;
  var initializeExternalLinks: () => void;
  function truncateUtf16Safely(text: string, maxLength: number) {
    if (text.length <= maxLength) {
      return text;
    }
    let value = text.slice(0, maxLength),
      value2 = value.charCodeAt(value.length - 1);
    if (value2 >= 55296 && value2 <= 56319) {
      return value.slice(0, -1);
    } else {
      return value;
    }
  }
  function classifyExternalLink(url: string, options?: ExternalLinkOptions) {
    if (
      !(
        options?.storedUrl === true ? storedLinkPattern : externalLinkPattern
      ).test(url)
    ) {
      return null;
    }
    let value: URL;
    try {
      value = new URL(url);
    } catch {
      return null;
    }
    let value2 =
        typeof location === "undefined" ? "" : location.hostname,
      value3 = value2.replace(/^[^.]+\./, ""),
      hostname = value.hostname;
    if (hostname === "" || hostname.endsWith(".") || hostname === value2) {
      return null;
    }
    if (value.username !== "" || value.password !== "") {
      return null;
    }
    if (
      value3.includes(".") &&
      (hostname === value3 || hostname.endsWith("." + value3))
    ) {
      return null;
    }
    return url;
  }
  function linkUrlFromElement(element: Element) {
    let value =
      element.getAttribute("href") || element.getAttribute("data-href") || "";
    if (externalLinkPattern.test(value)) {
      return value;
    } else {
      return "";
    }
  }
  function openExternalLink(url: string, options?: ExternalLinkOptions) {
    if (classifyExternalLink(url, options) === null) {
      return;
    }
    let value = document.createElement("a");
    value.href = url;
    value.target = "_blank";
    value.rel = "noopener noreferrer";
    document.body.append(value);
    value.click();
    value.remove();
  }
  bindRuntimeValue(runtime, "truncateUtf16Safely", () => truncateUtf16Safely);
  bindRuntimeValue(runtime, "classifyExternalLink", () => classifyExternalLink);
  bindRuntimeValue(runtime, "linkUrlFromElement", () => linkUrlFromElement);
  bindRuntimeValue(runtime, "openExternalLink", () => openExternalLink);
  bindRuntimeValue(
    runtime,
    "externalLinkPattern",
    () => externalLinkPattern,
    (value) => {
      externalLinkPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "storedLinkPattern",
    () => storedLinkPattern,
    (value) => {
      storedLinkPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "linkModifierLabel",
    () => linkModifierLabel,
    (value) => {
      linkModifierLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "linkOpenHint",
    () => linkOpenHint,
    (value) => {
      linkOpenHint = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createLinkEnterHandler",
    () => createLinkEnterHandler,
    (value) => {
      createLinkEnterHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "modifiedLinkEnterHandler",
    () => modifiedLinkEnterHandler,
    (value) => {
      modifiedLinkEnterHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "linkEnterHandler",
    () => linkEnterHandler,
    (value) => {
      linkEnterHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeExternalLinks",
    () => initializeExternalLinks,
    (value) => {
      initializeExternalLinks = value;
    },
  );
  return () => {
    createLinkEnterHandler =
      (input: boolean): LinkEnterHandler =>
      (event) => {
        if (
          event.key !== "Enter" ||
          event.nativeEvent?.isComposing ||
          (input && !(event.metaKey || event.ctrlKey))
        ) {
          return;
        }
        event.preventDefault();
        openExternalLink(linkUrlFromElement(event.currentTarget));
      };
    initializeExternalLinks = (0, runtime.initializeOnce)(() => {
      externalLinkPattern = /^https?:\/\/[^\s)\[]*$/;
      storedLinkPattern = /^https?:\/\/\S*$/;
      linkModifierLabel = (0, runtime.isApplePlatform)() ? "⌘" : "Ctrl";
      linkOpenHint =
        " (" +
        linkModifierLabel +
        "-click or " +
        linkModifierLabel +
        "+Enter to open)";
      modifiedLinkEnterHandler = createLinkEnterHandler(true);
      linkEnterHandler = createLinkEnterHandler(false);
    });
  };
}
