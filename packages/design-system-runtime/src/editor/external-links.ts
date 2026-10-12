import type * as React from "react";
import type * as Core from "../contracts";
import type * as M from "../contracts/documentation";
import type * as Files from "../contracts/file-browser";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorExternalLinks(
  runtime: RuntimeBindings,
): () => void {
  var EXTERNAL_LINK_CLASS_NAME: string;
  var EXTERNAL_LINK_PATTERN: RegExp;
  var STORED_EXTERNAL_LINK_PATTERN: RegExp;
  var MODIFIER_KEY_LABEL: string;
  var EXTERNAL_LINK_OPEN_HINT: string;
  var createLinkEnterHandler: (
    requiresModifier: boolean,
  ) => React.KeyboardEventHandler<HTMLElement>;
  var onModifiedLinkEnter: React.KeyboardEventHandler<HTMLElement>;
  var onLinkEnter: React.KeyboardEventHandler<HTMLElement>;
  function classifyExternalLink(
    url: string,
    options?: Core.EditorLinkOptions,
  ): string | null {
    if (
      !(
        options?.storedUrl === true
          ? STORED_EXTERNAL_LINK_PATTERN
          : EXTERNAL_LINK_PATTERN
      ).test(url)
    ) {
      return null;
    }
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return null;
    }
    let currentHostname =
        typeof location === "undefined" ? "" : location.hostname,
      parentDomain = currentHostname.replace(/^[^.]+\./, ""),
      hostname = parsedUrl.hostname;
    if (
      hostname === "" ||
      hostname.endsWith(".") ||
      hostname === currentHostname
    ) {
      return null;
    }
    if (parsedUrl.username !== "" || parsedUrl.password !== "") {
      return null;
    }
    if (
      hostname === "claudeusercontent.com" ||
      hostname.endsWith(".claudeusercontent.com")
    ) {
      return null;
    }
    if (
      parentDomain.includes(".") &&
      (hostname === parentDomain || hostname.endsWith("." + parentDomain))
    ) {
      return null;
    }
    return url;
  }
  function externalLinkProps(
    url: string,
    mode: Core.EditorLinkMode = "live",
  ): M.ExternalLinkProps {
    if (mode === "live") {
      return {
        href: url,
        target: "_blank",
        rel: "noopener noreferrer",
        draggable: false,
        className: EXTERNAL_LINK_CLASS_NAME,
      };
    }
    if (mode === "edit") {
      return {
        "data-href": url,
        role: "link",
        tabIndex: 0,
        title: url + EXTERNAL_LINK_OPEN_HINT,
        className: EXTERNAL_LINK_CLASS_NAME,
        onKeyDown: onModifiedLinkEnter,
      };
    }
    return {
      "data-href": url,
      role: "link",
      tabIndex: 0,
      title: url,
      className: EXTERNAL_LINK_CLASS_NAME,
      onKeyDown: onLinkEnter,
    };
  }
  function linkUrlFromElement(anchor: Element): string {
    let value =
      anchor.getAttribute("href") || anchor.getAttribute("data-href") || "";
    if (EXTERNAL_LINK_PATTERN.test(value)) {
      return value;
    } else {
      return "";
    }
  }
  function safeLinkUrlFromElement(anchor: Element): string {
    return classifyExternalLink(linkUrlFromElement(anchor)) ?? "";
  }
  function prepareEditableLinks(root: ParentNode): void {
    for (let value of Array.from<HTMLAnchorElement>(
      root.querySelectorAll<HTMLAnchorElement>("a[href]"),
    )) {
      let value2 = linkUrlFromElement(value);
      value.removeAttribute("href");
      value.removeAttribute("target");
      value.removeAttribute("rel");
      if (value2 === "") {
        continue;
      }
      value.setAttribute("data-href", value2);
      value.setAttribute("role", "link");
      value.setAttribute("tabindex", "0");
      value.setAttribute("title", value2 + EXTERNAL_LINK_OPEN_HINT);
      value.setAttribute("class", EXTERNAL_LINK_CLASS_NAME);
    }
  }
  function openExternalLink(
    url: string,
    options?: Core.EditorLinkOptions,
  ): void {
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
  bindRuntimeValue(
    runtime,
    "EXTERNAL_LINK_CLASS_NAME",
    () => EXTERNAL_LINK_CLASS_NAME,
    (value) => {
      EXTERNAL_LINK_CLASS_NAME = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EXTERNAL_LINK_PATTERN",
    () => EXTERNAL_LINK_PATTERN,
    (value) => {
      EXTERNAL_LINK_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "STORED_EXTERNAL_LINK_PATTERN",
    () => STORED_EXTERNAL_LINK_PATTERN,
    (value) => {
      STORED_EXTERNAL_LINK_PATTERN = value;
    },
  );
  bindRuntimeValue(runtime, "classifyExternalLink", () => classifyExternalLink);
  bindRuntimeValue(
    runtime,
    "MODIFIER_KEY_LABEL",
    () => MODIFIER_KEY_LABEL,
    (value) => {
      MODIFIER_KEY_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EXTERNAL_LINK_OPEN_HINT",
    () => EXTERNAL_LINK_OPEN_HINT,
    (value) => {
      EXTERNAL_LINK_OPEN_HINT = value;
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
    "onModifiedLinkEnter",
    () => onModifiedLinkEnter,
    (value) => {
      onModifiedLinkEnter = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "onLinkEnter",
    () => onLinkEnter,
    (value) => {
      onLinkEnter = value;
    },
  );
  bindRuntimeValue(runtime, "externalLinkProps", () => externalLinkProps);
  bindRuntimeValue(runtime, "linkUrlFromElement", () => linkUrlFromElement);
  bindRuntimeValue(
    runtime,
    "safeLinkUrlFromElement",
    () => safeLinkUrlFromElement,
  );
  bindRuntimeValue(runtime, "prepareEditableLinks", () => prepareEditableLinks);
  bindRuntimeValue(runtime, "openExternalLink", () => openExternalLink);
  return () => {
    EXTERNAL_LINK_CLASS_NAME = "text-blue-text underline underline-offset-2";
    EXTERNAL_LINK_PATTERN = /^https?:\/\/[^\s)\[]*$/;
    STORED_EXTERNAL_LINK_PATTERN = /^https?:\/\/\S*$/;
    MODIFIER_KEY_LABEL = (0, runtime.isApplePlatform)() ? "⌘" : "Ctrl";
    EXTERNAL_LINK_OPEN_HINT =
      " (" +
      MODIFIER_KEY_LABEL +
      "-click or " +
      MODIFIER_KEY_LABEL +
      "+Enter to open)";
    createLinkEnterHandler =
      (requiresModifier: boolean) =>
      (event: React.KeyboardEvent<HTMLElement>): void => {
        if (
          event.key !== "Enter" ||
          event.nativeEvent?.isComposing ||
          (requiresModifier && !(event.metaKey || event.ctrlKey))
        ) {
          return;
        }
        event.preventDefault();
        openExternalLink(linkUrlFromElement(event.currentTarget));
      };
    onModifiedLinkEnter = createLinkEnterHandler(true);
    onLinkEnter = createLinkEnterHandler(false);
  };
}
