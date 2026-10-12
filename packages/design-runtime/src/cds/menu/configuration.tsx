import type {
  MenuItemState,
  MenuLabels,
  MenuRootState,
  OverlayActions,
  PopupScrollAreaProps,
} from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsMenuConfiguration(
  runtime: RuntimeBindings,
): () => void {
  var reactMenuConfiguration: typeof React;
  var MenuRootContext: React.Context<MenuRootState | null>;
  var MenuConfigurationLabelOpenConfig: MenuItemState;
  var MenuItemContext: React.Context<MenuItemState>;
  var CdsFocusesNothingAttribute: string;
  var MenuConfigurationContext: React.Context<boolean>;
  var MenuConfigurationContext_2: React.Context<boolean>;
  var MenuSheetLabelsContext: React.Context<MenuLabels>;
  var MenuConfigurationLabel: string;
  var MenuTriggerContext: React.Context<React.RefObject<OverlayActions | null> | null>;
  var MenuSurfaceContext: React.Context<React.RefObject<OverlayActions | null> | null>;
  var initializeMenuConfiguration: () => void;
  function warnNestedMenuLayerOffset(): void {
    console.warn(
      "cds: layerOffset is ignored on nested `Menu.Popup` / `ContextMenu.SubmenuPopup` \u2014 a submenu's parent band is the root menu's own band, where the root's click shield sits; joining it would interleave the submenu with the root's own popup and shield \u2014 below them at low offsets. Set layerOffset on the root popup instead.",
    );
  }
  function warnNestedMenuInitialFocus(): void {
    console.warn(
      "cds: initialFocus is ignored on nested `Menu.Popup` / `ContextMenu.SubmenuPopup` \u2014 whether an open moves focus is the root popup's decision and its submenus follow it. Set initialFocus on the root Menu.Popup instead.",
    );
  }
  function useMutableMenuRef<
    Element = HTMLElement,
  >(): React.RefObject<Element | null> {
    let [value] = (0, reactMenuConfiguration.useState)(() => ({
      current: null,
    }));
    return value;
  }
  function PopupScrollArea({
    header: header,
    headerClassName: headerClassName,
    footer: footer,
    maxVisibleItems: maxVisibleItems,
    fill = false,
    children: children,
  }: PopupScrollAreaProps): React.ReactElement {
    let value =
      maxVisibleItems !== undefined
        ? `calc(${maxVisibleItems} * ${runtime.SheetsScrollAreaLabel} + 0.5rem)`
        : undefined;
    return header || footer ? (
      <div
        className={(0, runtime.npm_clsx_Ea)(
          "flex min-h-0 flex-col overflow-hidden rounded-[inherit]",
          fill && "flex-1",
        )}
      >
        {header && (
          <div
            className={(0, runtime.cn)(
              runtime.SheetsScrollAreaClassNames_3,
              headerClassName,
            )}
          >
            {header}
          </div>
        )}
        <div
          style={{
            maxHeight: value,
          }}
          className={`${runtime.SheetsScrollAreaClassNames_2}${header ? " pt-0" : ""}`}
          {...{
            [runtime.sheetScrollAttribute]: "",
          }}
        >
          {children}
        </div>
        {footer && (
          <div className={runtime.SheetsScrollAreaClassNames_4}>{footer}</div>
        )}
      </div>
    ) : (
      <div
        style={{
          maxHeight: value,
        }}
        className={(0, runtime.npm_clsx_Ea)(
          runtime.SheetsScrollAreaClassNames,
          fill && "flex-1",
        )}
        {...{
          [runtime.sheetScrollAttribute]: "",
        }}
      >
        {children}
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "warnNestedMenuLayerOffset",
    () => warnNestedMenuLayerOffset,
  );
  bindRuntimeValue(
    runtime,
    "warnNestedMenuInitialFocus",
    () => warnNestedMenuInitialFocus,
  );
  bindRuntimeValue(runtime, "useMutableMenuRef", () => useMutableMenuRef);
  bindRuntimeValue(
    runtime,
    "reactMenuConfiguration",
    () => reactMenuConfiguration,
    (value) => {
      reactMenuConfiguration = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MenuRootContext",
    () => MenuRootContext,
    (value) => {
      MenuRootContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MenuConfigurationLabelOpenConfig",
    () => MenuConfigurationLabelOpenConfig,
    (value) => {
      MenuConfigurationLabelOpenConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MenuItemContext",
    () => MenuItemContext,
    (value) => {
      MenuItemContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CdsFocusesNothingAttribute",
    () => CdsFocusesNothingAttribute,
    (value) => {
      CdsFocusesNothingAttribute = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MenuConfigurationContext",
    () => MenuConfigurationContext,
    (value) => {
      MenuConfigurationContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MenuConfigurationContext_2",
    () => MenuConfigurationContext_2,
    (value) => {
      MenuConfigurationContext_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MenuSheetLabelsContext",
    () => MenuSheetLabelsContext,
    (value) => {
      MenuSheetLabelsContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MenuConfigurationLabel",
    () => MenuConfigurationLabel,
    (value) => {
      MenuConfigurationLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MenuTriggerContext",
    () => MenuTriggerContext,
    (value) => {
      MenuTriggerContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MenuSurfaceContext",
    () => MenuSurfaceContext,
    (value) => {
      MenuSurfaceContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeMenuConfiguration",
    () => initializeMenuConfiguration,
    (value) => {
      initializeMenuConfiguration = value;
    },
  );
  bindRuntimeValue(runtime, "PopupScrollArea", () => PopupScrollArea);
  return () => {
    initializeMenuConfiguration = (0, runtime.initializeOnce)(() => {
      "use client";

      reactMenuConfiguration = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      MenuRootContext = (0,
      reactMenuConfiguration.createContext)<MenuRootState | null>(null);
      MenuConfigurationLabelOpenConfig = {
        label: null,
        open: false,
      };
      MenuItemContext = (0,
      reactMenuConfiguration.createContext)<MenuItemState>(
        MenuConfigurationLabelOpenConfig,
      );
      CdsFocusesNothingAttribute = "data-cds-focuses-nothing";
      MenuConfigurationContext = (0, reactMenuConfiguration.createContext)(
        false,
      );
      MenuConfigurationContext_2 = (0, reactMenuConfiguration.createContext)(
        false,
      );
      MenuSheetLabelsContext = (0,
      reactMenuConfiguration.createContext)<MenuLabels>({
        sheetTitle: undefined,
        backLabel: undefined,
        closeLabel: undefined,
      });
      MenuConfigurationLabel =
        '[data-cds="Menu"], [data-cds="ContextMenu"], [data-cds="DropdownButton"], [data-cds="SplitDropdownButton"], [data-cds="ModelSelector"]';
      MenuTriggerContext = (0,
      reactMenuConfiguration.createContext)<React.RefObject<OverlayActions | null> | null>(
        null,
      );
      MenuSurfaceContext = (0,
      reactMenuConfiguration.createContext)<React.RefObject<OverlayActions | null> | null>(
        null,
      );
    });
  };
}
