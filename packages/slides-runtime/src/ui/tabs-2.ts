/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type { Tabs as BaseTabs } from "@base-ui/react/tabs";
import type {
  Context,
  ForwardRefExoticComponent,
  ReactElement,
  ReactNode,
  RefAttributes,
  RefObject,
} from "react";
import type { TooltipProps } from "./avatars";
import type { CdsControlSize } from "./overlays";

/** What identifies a tab; compared with `Object.is` and otherwise opaque. */
export type TabValue = unknown;
/** What a tab strip shares with its overflow menu. */
export interface TabsOverflowContextValue {
  /** Value of the selected tab. */
  value: TabValue;
  /** Registers a tab element (`null` unregisters it; `previous` is the element it replaces). */
  registerTab: (
    value: TabValue,
    element: HTMLElement | null,
    previous: HTMLElement | null,
  ) => void;
  /** The registered tab elements by value. */
  tabs: () => Map<TabValue, HTMLElement>;
  /** Selects the tab with that value by clicking it. */
  activate: (value: TabValue) => void;
  /** Reports whether the list has collapsed into a dropdown. */
  setCollapsed: (collapsed: boolean) => void;
}
/** A tab as an entry of the overflow dropdown. */
export interface TabMenuItem {
  value: TabValue;
  text: string;
  /** Screen-reader-only text of the tab. */
  srText: string;
  disabled: boolean;
  reason: string | undefined;
}
export interface TabsListMenuProps {
  size?: CdsControlSize;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /** The tab list the dropdown stands in for. */
  listRef: RefObject<HTMLElement | null>;
  /** Set on unmount to whether focus was inside the dropdown trigger. */
  triggerHadFocusRef: RefObject<boolean>;
}
export interface TabsListProps
  extends Omit<BaseTabs.List.Props, "className" | "ref"> {
  className?: string;
  /** Pulls the tabs together so adjacent lists overlap by their edge. */
  flush?: boolean;
  size?: CdsControlSize;
}
export interface TabsTabProps
  extends Omit<BaseTabs.Tab.Props, "className" | "ref"> {
  className?: string;
  /** Why the tab is disabled; shown as a tooltip. */
  disabledReason?: ReactNode;
  disabledReasonSide?: TooltipProps["side"];
}
export interface TabsPanelProps
  extends Omit<BaseTabs.Panel.Props, "className" | "ref"> {
  className?: string;
}
export interface TabsRootProps
  extends Omit<
    BaseTabs.Root.Props,
    "ref" | "value" | "defaultValue" | "onValueChange"
  > {
  value?: TabValue;
  defaultValue?: TabValue;
  onValueChange?: (
    value: TabValue,
    details: BaseTabs.Root.ChangeEventDetails,
  ) => void;
}
export type TabsListComponent = ForwardRefExoticComponent<
  TabsListProps & RefAttributes<HTMLDivElement>
>;
export type TabsTabComponent = ForwardRefExoticComponent<
  TabsTabProps & RefAttributes<HTMLElement>
>;
export type TabsPanelComponent = ForwardRefExoticComponent<
  TabsPanelProps & RefAttributes<HTMLDivElement>
>;
export type TabsRootComponent = ForwardRefExoticComponent<
  TabsRootProps & RefAttributes<HTMLDivElement>
>;
/** `Tabs`: the tab parts. */
export interface TabsNamespace {
  Root: TabsRootComponent;
  List: TabsListComponent;
  Tab: TabsTabComponent;
  Panel: TabsPanelComponent;
}

declare module "../bindings" {
  interface RuntimeBindings {
    useTabsOverflow: () => TabsOverflowContextValue | null;
    tabsOverflowContext: Context<TabsOverflowContextValue | null>;
    STASHED_TAB_ATTRIBUTE: string;
    TABS_MENU_TRIGGER_ID: string;
    TABS_MENU_LABEL_ID: string;
    initializeUiTabs22: () => void;
    TAB_SELECTOR: string;
    TAB_TEXT_EXCLUDED_SELECTOR: string;
    initializeUiTabs222: () => void;
    TAB_LIST_CLASS: string;
    TAB_EDGE_RADIUS_CLASS: string;
    TAB_SELECTED_CLASS: string;
    TAB_INACTIVE_CLASS: string;
    TAB_UNDERLINE_CLASS: string;
    TABS_OVERFLOW_RECHECK_MS: number;
    TabsList: TabsListComponent;
    TAB_CLOSE_BUTTON_CLASS: string;
    TAB_CLOSE_BUTTON_HOVER_CLASS: string;
    TabsTab: TabsTabComponent;
    TabsPanel: TabsPanelComponent;
    TabsRoot: TabsRootComponent;
    Tabs: TabsNamespace;
    initializeUiTabs23: () => void;
    reactuP: ReactNamespace;
    reactm3: ReactNamespace;
    jsxg3: JsxNamespace;
    reacti6: ReactNamespace;
    jsxForUiTabs22: JsxNamespace;
  }
}

export function installUiTabs2(runtime: RuntimeBindings): () => void {
  var reactuP: ReactNamespace;
  var tabsOverflowContext: Context<TabsOverflowContextValue | null>;
  var STASHED_TAB_ATTRIBUTE: string;
  var TABS_MENU_TRIGGER_ID: string;
  var TABS_MENU_LABEL_ID: string;
  var initializeUiTabs22: () => void;
  var reactm3: ReactNamespace;
  var jsxg3: JsxNamespace;
  var TAB_SELECTOR: string;
  var TAB_TEXT_EXCLUDED_SELECTOR: string;
  var initializeUiTabs222: () => void;
  var reacti6: ReactNamespace;
  var jsxForUiTabs22: JsxNamespace;
  var TAB_LIST_CLASS: string;
  var TAB_EDGE_RADIUS_CLASS: string;
  var TAB_SELECTED_CLASS: string;
  var TAB_INACTIVE_CLASS: string;
  var TAB_UNDERLINE_CLASS: string;
  var TABS_OVERFLOW_RECHECK_MS: number;
  var TabsList: TabsListComponent;
  var TAB_CLOSE_BUTTON_CLASS: string;
  var TAB_CLOSE_BUTTON_HOVER_CLASS: string;
  var TabsTab: TabsTabComponent;
  var TabsPanel: TabsPanelComponent;
  var TabsRoot: TabsRootComponent;
  var Tabs: TabsNamespace;
  var initializeUiTabs23: () => void;
  function useTabsOverflow(): TabsOverflowContextValue | null {
    return reactuP.useContext(tabsOverflowContext);
  }
  function extractVisibleElementText(
    input: Element,
    options: string,
  ): string {
    let text = "",
      callback = (input2: Node): void => {
        if (input2.nodeType === Node.TEXT_NODE) {
          text += input2.nodeValue ?? "";
        } else if (input2.nodeType === Node.ELEMENT_NODE) {
          if (
            input2 !== input &&
            ((input2 as Element).matches(options) ||
              getComputedStyle(input2 as Element).display === "none")
          ) {
            return;
          }
          text += " ";
          input2.childNodes.forEach(callback);
          text += " ";
        }
      };
    callback(input);
    return text.replace(/\s+/g, " ").trim();
  }
  function getTabLabelText(element: Element): string {
    let value = extractVisibleElementText(
      element,
      TAB_TEXT_EXCLUDED_SELECTOR,
    );
    if (value !== "") {
      return value;
    } else {
      return (element.getAttribute("aria-label") ?? "").trim();
    }
  }
  function getTabScreenReaderText(input: Element): string {
    let text = "";
    input.querySelectorAll(".sr-only").forEach((input2: Element) => {
      if (input2.closest("[data-cds-disabled-reason]") === null) {
        text += ` ${extractVisibleElementText(input2, '[aria-hidden="true"], [hidden]')}`;
      }
    });
    return text.trim();
  }
  function sortConnectedTabsByDocumentOrder(
    input: Map<TabValue, HTMLElement>,
  ): TabMenuItem[] {
    return [...input.entries()]
      .filter(([, input2]) => input2.isConnected)
      .sort(
        ([, input2], [, options]) =>
          input2.compareDocumentPosition(options) &
          Node.DOCUMENT_POSITION_FOLLOWING
            ? -1
            : 1,
      )
      .map(([input2, input3]) => createTabMenuItem(input2, input3));
  }
  function collectTabValues(
    input: Element | null,
    options: Map<TabValue, HTMLElement>,
  ): TabMenuItem[] {
    if (input === null) {
      return [];
    }
    let entries = new Map<Element, TabValue>();
    options.forEach(
      (input2, options2) => entries.set(input2, options2),
    );
    let items: TabMenuItem[] = [];
    input
      .querySelectorAll(TAB_SELECTOR)
      .forEach((input2: Element) => {
        if (entries.has(input2)) {
          items.push(createTabMenuItem(entries.get(input2), input2));
        }
      });
    return items;
  }
  function createTabMenuItem(input: TabValue, element: Element): TabMenuItem {
    let value = element
      .querySelector("[data-cds-disabled-reason]")
      ?.textContent?.trim();
    return {
      value: input,
      text: getTabLabelText(element),
      srText: getTabScreenReaderText(element),
      disabled:
        element.getAttribute("aria-disabled") === "true" ||
        element.hasAttribute("data-disabled"),
      reason: value === undefined || value === "" ? undefined : value,
    };
  }
  function areTabMenuItemsEqual(
    items: TabMenuItem[],
    items2: TabMenuItem[],
  ): boolean {
    return (
      items.length === items2.length &&
      items.every(
        (input, options) =>
          Object.is(input.value, items2[options]!.value) &&
          input.text === items2[options]!.text &&
          input.srText === items2[options]!.srText &&
          input.disabled === items2[options]!.disabled &&
          input.reason === items2[options]!.reason,
      )
    );
  }
  function TabsListMenu({
    size: size,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledby,
    listRef: listRef,
    triggerHadFocusRef: triggerHadFocusRef,
  }: TabsListMenuProps): ReactElement {
    let value = useTabsOverflow(),
      ref = reactm3.useRef<HTMLElement>(null),
      value2 = reactm3.useId(),
      value3 = reactm3.useId(),
      [value4, value5] = reactm3.useState(
        () =>
          sortConnectedTabsByDocumentOrder(value?.tabs() ?? new Map()),
      ),
      callback = reactm3.useCallback(() => {
        let value8 = collectTabValues(
          listRef.current,
          value?.tabs() ?? new Map(),
        );
        value5(
          (input) =>
            areTabMenuItemsEqual(input, value8) ? input : value8,
        );
      }, [listRef, value]);
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      callback();
      let current = listRef.current;
      if (current === null || typeof MutationObserver === "undefined") {
        return;
      }
      let value8 = (0, runtime.createSafeMutationObserver)(
        MutationObserver,
        callback,
      );
      value8.observe(current, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["aria-disabled", "data-disabled", "aria-label"],
      });
      return () => value8.disconnect();
    }, [callback, listRef]);
    reactm3.useEffect(callback, [callback]);
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      let current = listRef.current,
        value8 = current?.ownerDocument.activeElement ?? null;
      if (current !== null && value8 !== null && current.contains(value8)) {
        ref.current?.focus();
      }
      return () => {
        let current2 = ref.current,
          value9 = current2?.ownerDocument.activeElement ?? null,
          value10 = current2?.getAttribute("aria-controls") ?? null,
          value11 =
            value10 === null
              ? null
              : current2!.ownerDocument.getElementById(value10);
        triggerHadFocusRef.current =
          current2 !== null &&
          value9 !== null &&
          (value9 === current2 ||
            (value11 !== null && value11.contains(value9)));
      };
    }, [listRef, triggerHadFocusRef]);
    let value6 = value4.find(
        (input) =>
          value !== null && Object.is(input.value, value.value),
      ),
      value7 = [
        ariaLabelledby ?? (ariaLabel !== undefined ? value2 : undefined),
        value6 !== undefined ? value3 : undefined,
      ]
        .filter(Boolean)
        .join(" ");
    return jsxg3.jsxs(runtime.Menu.Root, {
      sheetTitle: ariaLabel,
      children: [
        jsxg3.jsxs(runtime.Menu.TriggerButton, {
          ref: ref,
          variant: "secondary",
          size: size,
          "aria-labelledby": value7 === "" ? undefined : value7,
          "data-cds-part": TABS_MENU_TRIGGER_ID,
          className: "max-w-full min-w-0",
          children: [
            ariaLabel !== undefined && ariaLabelledby === undefined
              ? jsxg3.jsx("span", {
                  id: value2,
                  className: "sr-only",
                  children: ariaLabel,
                })
              : null,
            value6 !== undefined
              ? jsxg3.jsx("span", {
                  id: value3,
                  "data-cds-part": TABS_MENU_LABEL_ID,
                  className: "max-w-40 min-w-0 truncate",
                  children: value6.text,
                })
              : ariaLabel !== undefined
                ? jsxg3.jsx("span", {
                    "aria-hidden": true,
                    "data-cds-part": TABS_MENU_LABEL_ID,
                    className: "max-w-40 min-w-0 truncate",
                    children: ariaLabel,
                  })
                : null,
          ],
        }),
        jsxg3.jsx(runtime.Menu.Popup, {
          children: jsxg3.jsx(runtime.Menu.Group, {
            "aria-label": ariaLabelledby === undefined ? ariaLabel : undefined,
            "aria-labelledby": ariaLabelledby,
            children: value4.map(
              (input, options) =>
                jsxg3.jsxs(
                  runtime.Menu.Item,
                  {
                    checkedRole: "radio",
                    checked: input === value6,
                    disabled: input.disabled,
                    disabledReason: input.reason,
                    onClick: () => value?.activate(input.value),
                    children: [
                      input.text,
                      input.srText !== ""
                        ? jsxg3.jsxs("span", {
                            className: "sr-only",
                            children: [" ", input.srText],
                          })
                        : null,
                    ],
                  },
                  `${String(input.value)}:${options}`,
                ),
            ),
          }),
        }),
      ],
    });
  }
  function debugTabListOverflow(input: string, options: string): void {}
  function resetAncestorHorizontalScroll(
    input: Element,
    options: Element,
  ): boolean {
    for (
      let value: Element | null = input;
      value !== null && value !== options;
      value = value.parentElement
    ) {
      let { overflowX: value2 } = getComputedStyle(value);
      if (value2 === "auto" || value2 === "scroll") {
        return true;
      }
    }
    return false;
  }
  function canTabsOverflowInline(input: Element, options: Element): boolean {
    if (getComputedStyle(input).display === "contents") {
      return true;
    }
    for (let value of Array.from(input.children)) {
      if (
        value === options ||
        value.contains(options) ||
        !(0, runtime.isHtmlElement)(value) ||
        value.getAttribute("data-cds-part") === "tabs-menu-trigger"
      ) {
        continue;
      }
      let value2 = getComputedStyle(value);
      if (
        value2.display !== "none" &&
        value2.position !== "absolute" &&
        value2.position !== "fixed"
      ) {
        return true;
      }
    }
    return false;
  }
  function useTabsOverflowMenu(
    input: RefObject<HTMLElement | null>,
    options: string | undefined,
    context: boolean,
    value: boolean,
  ): boolean {
    let [value2, value3] = reacti6.useState(false),
      ref = reacti6.useRef(new Map<number, number>()),
      ref2 = reacti6.useRef(0),
      ref3 = reacti6.useRef(NaN),
      ref4 = reacti6.useRef(context),
      ref5 = reacti6.useRef(value);
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      let current = input.current,
        value4 = current?.closest('[data-cds="Tabs"]') ?? null,
        value5 = value4?.parentElement ?? null;
      if (current === null || value4 === null || value5 === null) {
        return;
      }
      let value6 = (0, runtime.getResizeObserverConstructor)(value5);
      if (value6 === undefined) {
        return;
      }
      let value7 = ref4.current !== context || ref5.current !== value;
      ref4.current = context;
      ref5.current = value;
      let value8: ReturnType<typeof setTimeout> | undefined,
        callback = (
          input2: boolean,
          options2: number,
          context2: boolean,
        ): void => {
          let value12 = Date.now(),
            current2 = ref.current;
          if (value12 - ref2.current > TABS_OVERFLOW_RECHECK_MS) {
            current2.clear();
          }
          let value13 = Math.round(options2),
            value14 = current2.get(value13) ?? 0;
          if (!input2 && !context2 && value14 >= 2) {
            if (ref3.current !== value13) {
              ref3.current = value13;
              clearTimeout(value8);
              value8 = setTimeout(() => callback3(false), 550);
            }
            return;
          }
          if (value13 !== ref3.current) {
            ref3.current = NaN;
          }
          if (!input2) {
            current2.set(value13, value14 + 1);
          }
          ref2.current = value12;
          value3(input2);
        },
        callback2 = (): boolean =>
          value4.getAttribute("data-orientation") === "vertical" ||
          canTabsOverflowInline(value4, current) ||
          resetAncestorHorizontalScroll(current, value4) ||
          !(0, runtime.isUnwrappedHorizontalFlex)(value5),
        callback3 = (input2: boolean): void => {
          if (callback2()) {
            if (value2) {
              value3(false);
            }
            return;
          }
          let value12 = (0, runtime.getInnerElementWidth)(value5);
          if (value12 <= 0) {
            return;
          }
          let value13 = (0, runtime.measureTabStripContents)(current);
          if (value13 <= 0) {
            return;
          }
          let value14 = getComputedStyle(current),
            value15 = getComputedStyle(value4),
            value16 =
              value13 +
              (Number.parseFloat(value14.marginLeft) || 0) +
              (Number.parseFloat(value14.marginRight) || 0) +
              (Number.parseFloat(value15.paddingLeft) || 0) +
              (Number.parseFloat(value15.paddingRight) || 0) +
              (Number.parseFloat(value15.borderLeftWidth) || 0) +
              (Number.parseFloat(value15.borderRightWidth) || 0),
            value17 = (0, runtime.getTabOverflowWidth)(
              value5,
              value4,
              value16,
            );
          if (value2) {
            if (!context && value12 >= value17 + (value ? 0 : 64)) {
              callback(false, value12, input2);
            }
            return;
          }
          if (value12 + 0.5 < value17) {
            if (options === undefined) {
              debugTabListOverflow(
                "label",
                "cds: a Tabs.List collapsed into a dropdown but has no aria-label / aria-labelledby, so the dropdown's name is only the active tab. Give the list a label.",
              );
            }
            callback(true, value12, input2);
          }
        };
      callback3(value7);
      let value9 = (0, runtime.createSafeResizeObserver)(
        value6,
        () => callback3(false),
      );
      value9.observe(value5);
      value9.observe(current);
      let value10 =
        typeof MutationObserver === "undefined"
          ? null
          : (0, runtime.createSafeMutationObserver)(
              MutationObserver,
              () => callback3(true),
            );
      value10?.observe(current, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      let value11 =
        typeof MutationObserver === "undefined"
          ? null
          : (0, runtime.createSafeMutationObserver)(
              MutationObserver,
              () => callback3(false),
            );
      value11?.observe(value5, {
        childList: true,
      });
      return () => {
        clearTimeout(value8);
        value9.disconnect();
        value10?.disconnect();
        value11?.disconnect();
      };
    }, [value2, value, context, options, input]);
    return value2;
  }
  bindRuntimeValue(runtime, "useTabsOverflow", () => useTabsOverflow);
  bindRuntimeValue(
    runtime,
    "reactuP",
    () => reactuP,
    (value) => {
      reactuP = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tabsOverflowContext",
    () => tabsOverflowContext,
    (value) => {
      tabsOverflowContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "STASHED_TAB_ATTRIBUTE",
    () => STASHED_TAB_ATTRIBUTE,
    (value) => {
      STASHED_TAB_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TABS_MENU_TRIGGER_ID",
    () => TABS_MENU_TRIGGER_ID,
    (value) => {
      TABS_MENU_TRIGGER_ID = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TABS_MENU_LABEL_ID",
    () => TABS_MENU_LABEL_ID,
    (value) => {
      TABS_MENU_LABEL_ID = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiTabs22",
    () => initializeUiTabs22,
    (value) => {
      initializeUiTabs22 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "extractVisibleElementText",
    () => extractVisibleElementText,
  );
  bindRuntimeValue(runtime, "getTabLabelText", () => getTabLabelText);
  bindRuntimeValue(
    runtime,
    "getTabScreenReaderText",
    () => getTabScreenReaderText,
  );
  bindRuntimeValue(
    runtime,
    "sortConnectedTabsByDocumentOrder",
    () => sortConnectedTabsByDocumentOrder,
  );
  bindRuntimeValue(runtime, "collectTabValues", () => collectTabValues);
  bindRuntimeValue(runtime, "createTabMenuItem", () => createTabMenuItem);
  bindRuntimeValue(runtime, "areTabMenuItemsEqual", () => areTabMenuItemsEqual);
  bindRuntimeValue(runtime, "TabsListMenu", () => TabsListMenu);
  bindRuntimeValue(
    runtime,
    "reactm3",
    () => reactm3,
    (value) => {
      reactm3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxg3",
    () => jsxg3,
    (value) => {
      jsxg3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TAB_SELECTOR",
    () => TAB_SELECTOR,
    (value) => {
      TAB_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TAB_TEXT_EXCLUDED_SELECTOR",
    () => TAB_TEXT_EXCLUDED_SELECTOR,
    (value) => {
      TAB_TEXT_EXCLUDED_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiTabs222",
    () => initializeUiTabs222,
    (value) => {
      initializeUiTabs222 = value;
    },
  );
  bindRuntimeValue(runtime, "debugTabListOverflow", () => debugTabListOverflow);
  bindRuntimeValue(
    runtime,
    "resetAncestorHorizontalScroll",
    () => resetAncestorHorizontalScroll,
  );
  bindRuntimeValue(
    runtime,
    "canTabsOverflowInline",
    () => canTabsOverflowInline,
  );
  bindRuntimeValue(runtime, "useTabsOverflowMenu", () => useTabsOverflowMenu);
  bindRuntimeValue(
    runtime,
    "reacti6",
    () => reacti6,
    (value) => {
      reacti6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiTabs22",
    () => jsxForUiTabs22,
    (value) => {
      jsxForUiTabs22 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TAB_LIST_CLASS",
    () => TAB_LIST_CLASS,
    (value) => {
      TAB_LIST_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TAB_EDGE_RADIUS_CLASS",
    () => TAB_EDGE_RADIUS_CLASS,
    (value) => {
      TAB_EDGE_RADIUS_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TAB_SELECTED_CLASS",
    () => TAB_SELECTED_CLASS,
    (value) => {
      TAB_SELECTED_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TAB_INACTIVE_CLASS",
    () => TAB_INACTIVE_CLASS,
    (value) => {
      TAB_INACTIVE_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TAB_UNDERLINE_CLASS",
    () => TAB_UNDERLINE_CLASS,
    (value) => {
      TAB_UNDERLINE_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TABS_OVERFLOW_RECHECK_MS",
    () => TABS_OVERFLOW_RECHECK_MS,
    (value) => {
      TABS_OVERFLOW_RECHECK_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TabsList",
    () => TabsList,
    (value) => {
      TabsList = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TAB_CLOSE_BUTTON_CLASS",
    () => TAB_CLOSE_BUTTON_CLASS,
    (value) => {
      TAB_CLOSE_BUTTON_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TAB_CLOSE_BUTTON_HOVER_CLASS",
    () => TAB_CLOSE_BUTTON_HOVER_CLASS,
    (value) => {
      TAB_CLOSE_BUTTON_HOVER_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TabsTab",
    () => TabsTab,
    (value) => {
      TabsTab = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TabsPanel",
    () => TabsPanel,
    (value) => {
      TabsPanel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TabsRoot",
    () => TabsRoot,
    (value) => {
      TabsRoot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "Tabs",
    () => Tabs,
    (value) => {
      Tabs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiTabs23",
    () => initializeUiTabs23,
    (value) => {
      initializeUiTabs23 = value;
    },
  );
  return () => {
    STASHED_TAB_ATTRIBUTE = "data-cds-stashed";
    TABS_MENU_TRIGGER_ID = "tabs-menu-trigger";
    TABS_MENU_LABEL_ID = "tabs-menu-label";
    initializeUiTabs22 = (0, runtime.initializeOnce)(() => {
      reactuP = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      tabsOverflowContext = reactuP.createContext<TabsOverflowContextValue | null>(
        null,
      );
    });
    TAB_SELECTOR = '[role="tab"]';
    TAB_TEXT_EXCLUDED_SELECTOR =
      '[aria-hidden="true"], [hidden], [data-cds-disabled-reason], [role="img"], svg, .sr-only';
    initializeUiTabs222 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeSafeObservers)();
      (0, runtime.initializeIsomorphicLayoutEffect)();
      (0, runtime.initializeUiMenu9)();
      initializeUiTabs22();
      reactm3 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxg3 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      (TabsListMenu as typeof TabsListMenu & { displayName?: string }).displayName =
        "Tabs.ListMenu";
    });
    TAB_LIST_CLASS = "flex items-center font-sans";
    TAB_EDGE_RADIUS_CLASS =
      "data-[orientation=horizontal]:[&>[role=tab]:first-child]:before:start-0 data-[orientation=horizontal]:[&>:first-child>[data-orientation][role=tab]:first-child]:before:start-0 data-[orientation=horizontal]:[&>:first-child>:first-child>[data-orientation][role=tab]:first-child]:before:start-0";
    TAB_SELECTED_CLASS =
      "data-[orientation=horizontal]:[&>[role=tab]:last-child]:before:end-0 data-[orientation=horizontal]:[&>:last-child>[data-orientation][role=tab]:last-child]:before:end-0 data-[orientation=horizontal]:[&>:last-child>:last-child>[data-orientation][role=tab]:last-child]:before:end-0";
    TAB_INACTIVE_CLASS = "-ml-pad-md";
    TAB_UNDERLINE_CLASS =
      "invisible absolute size-0 min-h-0 min-w-0 max-w-none overflow-hidden";
    TABS_OVERFLOW_RECHECK_MS = 500;
    TAB_CLOSE_BUTTON_CLASS =
      "relative isolate inline-flex shrink-0 items-center justify-center gap-1.5 rounded-none h-control px-md cds-reset whitespace-nowrap select-none outline-none focus-visible:outline-hidden bg-transparent text-body font-medium text-muted before:absolute before:inset-y-0 before:inset-x-px before:rounded before:-z-[1] before:transition-shadow before:duration-fast [&:not([data-active]):not([data-disabled])]:hover:text-secondary [&:not([data-active]):not([data-disabled])]:hover:before:bg-fill-ghost-hover data-[active]:text-primary data-[active]:before:bg-fill-ghost-hover focus-visible:before:shadow-focus data-[disabled]:opacity-disabled data-[disabled]:pointer-events-none";
    TAB_CLOSE_BUTTON_HOVER_CLASS = "data-[disabled]:pointer-events-auto";
    initializeUiTabs23 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeSafeObservers)();
      (0, runtime.initializeIsomorphicLayoutEffect)();
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeResizeObserverAccess)();
      (0, runtime.initializeUiDisclosure)();
      (0, runtime.initializeElementNamespaces)();
      (0, runtime.initializeMergedRefs)();
      (0, runtime.initializeDisabledReason)();
      (0, runtime.initializeTooltip)();
      (0, runtime.initializeUiDisclosure6)();
      (0, runtime.initializeInertProps)();
      (0, runtime.initializeUiTabs)();
      initializeUiTabs22();
      initializeUiTabs222();
      (0, runtime.initializeNpmDependency)();
      reacti6 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiTabs22 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      TabsList = reacti6.forwardRef<HTMLDivElement, TabsListProps>(
        (
          {
            className: className,
            flush: flush,
            size: size,
            activateOnFocus = true,
            ...props
          },
          options,
        ) => {
          let ref = reacti6.useRef<HTMLDivElement>(null),
            value = (0, runtime.useMergedRefs)(options, ref),
            value2 = (0, runtime.useCompactable)(),
            value3 = useTabsOverflowMenu(
              ref,
              props["aria-label"] ?? props["aria-labelledby"],
              value2.compact,
              value2.exactFit === true,
            ),
            value4 = useTabsOverflow()?.setCollapsed;
          (0, runtime.useIsomorphicLayoutEffect)(() => {
            value4?.(value3);
            return () => value4?.(false);
          }, [value3, value4]);
          let ref2 = reacti6.useRef(false);
          (0, runtime.useIsomorphicLayoutEffect)(() => {
            if (!value3 && ref2.current) {
              ref2.current = false;
              ref.current
                ?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
                ?.focus();
            }
          }, [value3]);
          return jsxForUiTabs22.jsxs(jsxForUiTabs22.Fragment, {
            children: [
              jsxForUiTabs22.jsx(runtime.baseTabs.List, {
                ref: value,
                activateOnFocus: activateOnFocus,
                ...props,
                ...(0, runtime.getControlSizeAttributes)(size),
                ...(0, runtime.getInertProps)(value3),
                ...(value3
                  ? {
                      [STASHED_TAB_ATTRIBUTE]: "",
                    }
                  : null),
                className: (0, runtime.cn)(
                  TAB_LIST_CLASS,
                  TAB_EDGE_RADIUS_CLASS,
                  TAB_SELECTED_CLASS,
                  flush ? TAB_INACTIVE_CLASS : "",
                  className,
                  value3 && TAB_UNDERLINE_CLASS,
                ),
              }),
              value3
                ? jsxForUiTabs22.jsx(TabsListMenu, {
                    size: size,
                    "aria-label": props["aria-label"],
                    "aria-labelledby": props["aria-labelledby"],
                    listRef: ref,
                    triggerHadFocusRef: ref2,
                  })
                : null,
            ],
          });
        },
      );
      TabsList.displayName = "Tabs.List";
      TabsTab = reacti6.forwardRef<HTMLElement, TabsTabProps>(
        (
          {
            className: className,
            children: children,
            disabledReason: disabledReason,
            disabledReasonSide: disabledReasonSide,
            "aria-describedby": ariaDescribedby,
            ...props
          },
          options,
        ) => {
          let value = reacti6.useId(),
            value2 =
              !!props.disabled &&
              (0, runtime.hasDisabledReason)(disabledReason),
            value3 = useTabsOverflow()?.registerTab,
            { value: value4 } = props,
            ref = reacti6.useRef<HTMLElement | null>(null),
            callback = reacti6.useCallback(
              (input: HTMLElement | null) => {
                value3?.(value4, input, ref.current);
                ref.current = input;
              },
              [value3, value4],
            ),
            value5 = (0, runtime.useMergedRefs)(options, callback),
            value6 = jsxForUiTabs22.jsxs(runtime.baseTabs.Tab, {
              ref: value5,
              ...props,
              "aria-describedby": value2
                ? [ariaDescribedby, value].filter(Boolean).join(" ")
                : ariaDescribedby,
              className: (0, runtime.cn)(
                TAB_CLOSE_BUTTON_CLASS,
                value2 ? TAB_CLOSE_BUTTON_HOVER_CLASS : undefined,
                className,
              ),
              onMouseDown: (0, runtime.withRepeatedClickSelectionPrevention)(
                props.onMouseDown,
              ),
              children: [
                children,
                disabledReason !== undefined &&
                  jsxForUiTabs22.jsx(runtime.DisabledReasonAnnouncement, {
                    id: value,
                    reason: value2 ? disabledReason : undefined,
                  }),
              ],
            });
          if (disabledReason === undefined) {
            return value6;
          }
          return jsxForUiTabs22.jsx(runtime.Tooltip, {
            content: value2 ? disabledReason : undefined,
            side: disabledReasonSide,
            multiline: true,
            hoverable: false,
            closeOnClick: false,
            openOnHandedBackFocus: true,
            children: value6,
          });
        },
      );
      TabsTab.displayName = "Tabs.Tab";
      TabsPanel = reacti6.forwardRef<HTMLDivElement, TabsPanelProps>(
        (
          { className: className, ...props },
          options,
        ) =>
          jsxForUiTabs22.jsx(runtime.baseTabs.Panel, {
            ref: options,
            ...props,
            className: (0, runtime.cn)(
              "cds-reset outline-none focus-visible:outline-hidden",
              className,
            ),
          }),
      );
      TabsPanel.displayName = "Tabs.Panel";
      TabsRoot = reacti6.forwardRef<HTMLDivElement, TabsRootProps>(
        (input, options) => {
          let {
              value: value,
              defaultValue: value2,
              onValueChange: value3,
            } = input,
            [value4, value5] = reacti6.useState<TabValue>(
              value2 === undefined ? 0 : value2,
            ),
            value6 = value === undefined ? value4 : value,
            callback = reacti6.useCallback(
              (
                input2: TabValue,
                options2: BaseTabs.Root.ChangeEventDetails,
              ) => {
                value3?.(input2, options2);
                if (!options2.isCanceled) {
                  value5(input2);
                }
              },
              [value3],
            ),
            ref = reacti6.useRef(new Map<TabValue, HTMLElement>()),
            callback2 = reacti6.useCallback(
              (
                input2: TabValue,
                options2: HTMLElement | null,
                context: HTMLElement | null,
              ): void => {
                if (options2 === null) {
                  if (ref.current.get(input2) === context) {
                    ref.current.delete(input2);
                  }
                  return;
                }
                ref.current.set(input2, options2);
              },
              [],
            ),
            callback3 = reacti6.useCallback(
              () => ref.current,
              [],
            ),
            callback4 = reacti6.useCallback(
              (input2: TabValue) => {
                ref.current.get(input2)?.click();
              },
              [],
            ),
            [value7, value8] = reacti6.useState(false),
            memo = reacti6.useMemo(
              () => ({
                value: value6,
                registerTab: callback2,
                tabs: callback3,
                activate: callback4,
                setCollapsed: value8,
              }),
              [value6, callback2, callback3, callback4],
            ),
            className = input.className;
          return jsxForUiTabs22.jsx(tabsOverflowContext.Provider, {
            value: memo,
            children: jsxForUiTabs22.jsx(runtime.baseTabs.Root, {
              ref: options,
              "data-cds": "Tabs",
              "data-collapsed": value7 ? "" : undefined,
              ...input,
              className:
                typeof className === "function"
                  ? (input2: BaseTabs.Root.State) =>
                      (0, runtime.cn)(
                        value7 && "min-w-0 max-w-full",
                        className(input2),
                      )
                  : (0, runtime.cn)(value7 && "min-w-0 max-w-full", className),
              onValueChange: callback,
            }),
          });
        },
      );
      TabsRoot.displayName = "Tabs.Root";
      Tabs = {
        Root: TabsRoot,
        List: TabsList,
        Tab: TabsTab,
        Panel: TabsPanel,
      };
    });
  };
}
