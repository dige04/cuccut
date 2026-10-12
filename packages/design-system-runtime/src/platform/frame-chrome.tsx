import type * as Host from "../contracts/platform-host";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installPlatformFrameChrome(
  runtime: RuntimeBindings,
): () => void {
  var reactForPlatformFrameChrome: typeof React;
  var reactForPlatformFrameChrome2: typeof React;
  var OPEN_OVERLAY_SELECTOR: string;
  var MENU_POPOVER_OPEN_SELECTORS: string;
  bindRuntimeValue(
    runtime,
    "reactForPlatformFrameChrome",
    () => reactForPlatformFrameChrome,
    (value) => {
      reactForPlatformFrameChrome = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactForPlatformFrameChrome2",
    () => reactForPlatformFrameChrome2,
    (value) => {
      reactForPlatformFrameChrome2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OPEN_OVERLAY_SELECTOR",
    () => OPEN_OVERLAY_SELECTOR,
    (value) => {
      OPEN_OVERLAY_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MENU_POPOVER_OPEN_SELECTORS",
    () => MENU_POPOVER_OPEN_SELECTORS,
    (value) => {
      MENU_POPOVER_OPEN_SELECTORS = value;
    },
  );
  return () => {
    reactForPlatformFrameChrome = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    reactForPlatformFrameChrome2 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    OPEN_OVERLAY_SELECTOR = [
      "[data-mc-popover]",
      "[data-mc-menu]",
      "[data-mc-scrim]",
      '[data-cds="Menu"]',
      '[data-cds="Popover"]',
      '[data-cds="Dialog"]',
      '[role="alertdialog"]:not([aria-modal="false"])',
      '[role="dialog"][aria-modal="true"]',
    ].join(", ");
    MENU_POPOVER_OPEN_SELECTORS = [
      '[data-cds="Menu"]',
      '[data-cds="ContextMenu"]',
      '[data-cds="DropdownButton"]',
      '[data-cds="SplitDropdownButton"]',
      '[data-cds="ModelSelector"]',
    ].join(", ");
  };
}
