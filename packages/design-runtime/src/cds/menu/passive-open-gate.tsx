import type {
  PassiveOpenCell,
  PassivePopupProps,
  PassivePopupTransform,
} from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsMenuPassiveOpenGate(
  runtime: RuntimeBindings,
): () => void {
  var reactMenuPassiveOpenGate: typeof React;
  var jsxMenuPassiveOpenGate: typeof import("react/jsx-runtime");
  var reactDomMenuPassiveOpenGate: typeof import("react-dom");
  var TriggerHoverValue: string;
  var FocusOutValue: string;
  var PassiveOpenCellContext: React.Context<PassiveOpenCell | null>;
  var PassiveOpenDisabledContext: React.Context<boolean>;
  var MenuPassiveOpenGateTabIndexConfig: Pick<PassivePopupProps, "tabIndex">;
  var MenuPassiveOpenGateRegistry: Pick<PassivePopupProps, "tabIndex">;
  var MenuPassiveOpenGateArrowDownArrowUpHomeSet: Set<string>;
  var MenuPassiveOpenGateSubscribers: Set<string>;
  var MenuPassiveOpenGateHandler: (listener: () => void) => () => void;
  var MenuPassiveOpenGateDefaultText: () => "off";
  var MenuPassiveOpenGateHandler_2: PassivePopupTransform;
  var initializeMenuPassiveOpenGate: typeof import("react-dom");
  bindRuntimeValue(
    runtime,
    "reactMenuPassiveOpenGate",
    () => reactMenuPassiveOpenGate,
    (value) => {
      reactMenuPassiveOpenGate = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxMenuPassiveOpenGate",
    () => jsxMenuPassiveOpenGate,
    (value) => {
      jsxMenuPassiveOpenGate = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactDomMenuPassiveOpenGate",
    () => reactDomMenuPassiveOpenGate,
    (value) => {
      reactDomMenuPassiveOpenGate = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TriggerHoverValue",
    () => TriggerHoverValue,
    (value) => {
      TriggerHoverValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FocusOutValue",
    () => FocusOutValue,
    (value) => {
      FocusOutValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PassiveOpenCellContext",
    () => PassiveOpenCellContext,
    (value) => {
      PassiveOpenCellContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PassiveOpenDisabledContext",
    () => PassiveOpenDisabledContext,
    (value) => {
      PassiveOpenDisabledContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MenuPassiveOpenGateTabIndexConfig",
    () => MenuPassiveOpenGateTabIndexConfig,
    (value) => {
      MenuPassiveOpenGateTabIndexConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MenuPassiveOpenGateRegistry",
    () => MenuPassiveOpenGateRegistry,
    (value) => {
      MenuPassiveOpenGateRegistry = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MenuPassiveOpenGateArrowDownArrowUpHomeSet",
    () => MenuPassiveOpenGateArrowDownArrowUpHomeSet,
    (value) => {
      MenuPassiveOpenGateArrowDownArrowUpHomeSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MenuPassiveOpenGateSubscribers",
    () => MenuPassiveOpenGateSubscribers,
    (value) => {
      MenuPassiveOpenGateSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MenuPassiveOpenGateHandler",
    () => MenuPassiveOpenGateHandler,
    (value) => {
      MenuPassiveOpenGateHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MenuPassiveOpenGateDefaultText",
    () => MenuPassiveOpenGateDefaultText,
    (value) => {
      MenuPassiveOpenGateDefaultText = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MenuPassiveOpenGateHandler_2",
    () => MenuPassiveOpenGateHandler_2,
    (value) => {
      MenuPassiveOpenGateHandler_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeMenuPassiveOpenGate",
    () => initializeMenuPassiveOpenGate,
    (value) => {
      initializeMenuPassiveOpenGate = value;
    },
  );
  return () => {
    initializeMenuPassiveOpenGate = (0, runtime.initializeOnce)(() => {
      "use client";

      (0, runtime.initializeHooksStableCallback)();
      (0, runtime.initializeSheetsScrollArea_4)();
      (0, runtime.initializeMenuPopup_3)();
      reactMenuPassiveOpenGate = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      jsxMenuPassiveOpenGate = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      reactDomMenuPassiveOpenGate = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_dom)(),
      );
      TriggerHoverValue = "trigger-hover";
      FocusOutValue = "focus-out";
      PassiveOpenCellContext = (0,
      reactMenuPassiveOpenGate.createContext)<PassiveOpenCell | null>(null);
      PassiveOpenDisabledContext = (0, reactMenuPassiveOpenGate.createContext)(
        false,
      );
      MenuPassiveOpenGateTabIndexConfig = {
        tabIndex: undefined,
      };
      MenuPassiveOpenGateRegistry = {};
      MenuPassiveOpenGateArrowDownArrowUpHomeSet = new Set([
        "ArrowDown",
        "ArrowUp",
        "Home",
        "End",
      ]);
      runtime.PassiveOpenGate.displayName = "PassiveOpenGate";
      MenuPassiveOpenGateSubscribers = new Set([
        "Shift",
        "Control",
        "Alt",
        "Meta",
        "AltGraph",
        "CapsLock",
        "NumLock",
        "ScrollLock",
        "Fn",
        "FnLock",
        "Hyper",
        "Super",
        "Symbol",
        "SymbolLock",
      ]);
      MenuPassiveOpenGateHandler = () => () => {};
      MenuPassiveOpenGateDefaultText = () => "off";
      MenuPassiveOpenGateHandler_2 = (
        input: PassivePopupProps,
      ): PassivePopupProps => input;
    });
  };
}
