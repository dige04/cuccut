import type * as React from "react";
import type {
  ForwardComponent,
  ControlSize,
  TabMenuItem,
  TabsOverflowState,
  TabsListMenuProps,
  TabsListProps,
  TabsTabProps,
  TabsRootProps,
  TabsPanelProps,
} from "../contracts/overlays";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiTabs(runtime: RuntimeBindings): () => void {
  var reactuP: typeof React;
  var tabsOverflowContext: React.Context<TabsOverflowState | null>;
  var TABS_STASHED_ATTRIBUTE: string;
  var TABS_MENU_TRIGGER_ID: string;
  var TABS_MENU_LABEL_ID: string;
  var reactForUiTabs: typeof React;
  var jsxForUiTabs: typeof import("react/jsx-runtime");
  var TAB_SELECTOR: string;
  var TAB_TEXT_EXCLUDED_SELECTOR: string;
  var reactForUiTabs2: typeof React;
  var jsxrZ: typeof import("react/jsx-runtime");
  var tabsListBaseClasses: string;
  var tabsFirstTabIndicatorClasses: string;
  var tabsLastTabIndicatorClasses: string;
  var tabsFlushClasses: string;
  var stashedTabsClasses: string;
  var TABS_OVERFLOW_RECHECK_MS: number;
  var TabsList: ForwardComponent<HTMLDivElement, TabsListProps>;
  var tabBaseClasses: string;
  var disabledTabPointerClasses: string;
  var TabsTab: ForwardComponent<HTMLButtonElement, TabsTabProps>;
  var TabsPanel: ForwardComponent<HTMLDivElement, TabsPanelProps>;
  var TabsRoot: ForwardComponent<HTMLDivElement, TabsRootProps>;
  var Tabs: {
    Root: typeof TabsRoot;
    List: typeof TabsList;
    Tab: typeof TabsTab;
    Panel: typeof TabsPanel;
  };
  function applyTabFlexCorrection(
    element: HTMLElement,
    options: string | null,
    context: string,
  ): void {
    if (options === null) {
      element.removeAttribute("style");
      return;
    }
    let cssText = element.style.cssText;
    if (!runtime.findBarListenerWindows.has(element.ownerDocument)) {
      element.setAttribute("style", options);
      if (!(cssText !== context && element.style.cssText === cssText)) {
        return;
      }
      runtime.findBarListenerWindows.add(element.ownerDocument);
    }
    element.style.cssText = context;
  }
  function parsePixelCssValue(input: string): number {
    if (/^\d*\.?\d+px$/.test(input)) {
      return Number.parseFloat(input);
    } else {
      return 0;
    }
  }
  function measureTabStripContents(input: HTMLElement): number {
    let { POSITIVE_INFINITY: value, NEGATIVE_INFINITY: value2 } = Number;
    for (let value4 of Array.from(input.children)) {
      if (
        !(0, runtime.isHtmlElement)(value4) &&
        !(0, runtime.isSvgElement)(value4)
      ) {
        continue;
      }
      let position = getComputedStyle(value4).position;
      if (position === "absolute" || position === "fixed") {
        continue;
      }
      let bounds = value4.getBoundingClientRect();
      if (bounds.width <= 0 && bounds.height <= 0) {
        continue;
      }
      value = Math.min(value, bounds.left);
      value2 = Math.max(value2, bounds.right);
    }
    if (value2 < value) {
      return 0;
    }
    let value3 = getComputedStyle(input);
    return (
      value2 -
      value +
      (Number.parseFloat(value3.paddingLeft) || 0) +
      (Number.parseFloat(value3.paddingRight) || 0)
    );
  }
  function useTabsOverflow(): TabsOverflowState | null {
    return reactuP.useContext(tabsOverflowContext);
  }
  function extractVisibleElementText(input: Element, options: string): string {
    let text = "",
      callback = (input2: Node) => {
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
    let value = extractVisibleElementText(element, TAB_TEXT_EXCLUDED_SELECTOR);
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
    input: ReadonlyMap<unknown, HTMLElement>,
  ): TabMenuItem[] {
    return [...input.entries()]
      .filter(([, input2]: [unknown, HTMLElement]) => input2.isConnected)
      .sort(
        (
          [, input2]: [unknown, HTMLElement],
          [, options]: [unknown, HTMLElement],
        ) =>
          input2.compareDocumentPosition(options) &
          Node.DOCUMENT_POSITION_FOLLOWING
            ? -1
            : 1,
      )
      .map(([input2, input3]: [unknown, HTMLElement]) =>
        createTabMenuItem(input2, input3),
      );
  }
  function collectTabValues(
    input: HTMLElement | null,
    options: ReadonlyMap<unknown, HTMLElement>,
  ): TabMenuItem[] {
    if (input === null) {
      return [];
    }
    let entries = new Map<HTMLElement, unknown>();
    options.forEach((input2: HTMLElement, options2: unknown) =>
      entries.set(input2, options2),
    );
    let items: TabMenuItem[] = [];
    input
      .querySelectorAll<HTMLElement>(TAB_SELECTOR)
      .forEach((input2: HTMLElement) => {
        if (entries.has(input2)) {
          items.push(createTabMenuItem(entries.get(input2), input2));
        }
      });
    return items;
  }
  function createTabMenuItem(input: unknown, element: Element): TabMenuItem {
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
    items: readonly TabMenuItem[],
    items2: readonly TabMenuItem[],
  ): boolean {
    return (
      items.length === items2.length &&
      items.every(
        (input: TabMenuItem, options: number) =>
          Object.is(input.value, items2[options].value) &&
          input.text === items2[options].text &&
          input.srText === items2[options].srText &&
          input.disabled === items2[options].disabled &&
          input.reason === items2[options].reason,
      )
    );
  }
  function TabsListMenu({
    size: size,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledby,
    listRef: listRef,
    triggerHadFocusRef: triggerHadFocusRef,
  }: TabsListMenuProps): React.ReactElement {
    let value = useTabsOverflow(),
      ref = reactForUiTabs.useRef<HTMLButtonElement | null>(null),
      value2 = reactForUiTabs.useId(),
      value3 = reactForUiTabs.useId(),
      [value4, value5] = reactForUiTabs.useState(() =>
        sortConnectedTabsByDocumentOrder(value?.tabs() ?? new Map()),
      ),
      callback = reactForUiTabs.useCallback(() => {
        let value8 = collectTabValues(
          listRef.current,
          value?.tabs() ?? new Map(),
        );
        value5((input: TabMenuItem[]) =>
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
    reactForUiTabs.useEffect(callback, [callback]);
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
        (input: TabMenuItem) =>
          value !== null && Object.is(input.value, value.value),
      ),
      value7 = [
        ariaLabelledby ?? (ariaLabel !== undefined ? value2 : undefined),
        value6 !== undefined ? value3 : undefined,
      ]
        .filter(Boolean)
        .join(" ");
    return (
      <runtime.Menu.Root sheetTitle={ariaLabel}>
        {[
          <runtime.Menu.TriggerButton
            ref={ref}
            variant={"secondary"}
            size={size}
            aria-labelledby={value7 === "" ? undefined : value7}
            data-cds-part={TABS_MENU_TRIGGER_ID}
            className={"max-w-full min-w-0"}
          >
            {[
              ariaLabel !== undefined && ariaLabelledby === undefined ? (
                <span id={value2} className={"sr-only"}>
                  {ariaLabel}
                </span>
              ) : null,
              value6 !== undefined ? (
                <span
                  id={value3}
                  data-cds-part={TABS_MENU_LABEL_ID}
                  className={"max-w-40 min-w-0 truncate"}
                >
                  {value6.text}
                </span>
              ) : ariaLabel !== undefined ? (
                <span
                  aria-hidden={true}
                  data-cds-part={TABS_MENU_LABEL_ID}
                  className={"max-w-40 min-w-0 truncate"}
                >
                  {ariaLabel}
                </span>
              ) : null,
            ]}
          </runtime.Menu.TriggerButton>,
          <runtime.Menu.Popup>
            <runtime.Menu.Group
              aria-label={ariaLabelledby === undefined ? ariaLabel : undefined}
              aria-labelledby={ariaLabelledby}
            >
              {value4.map((input: TabMenuItem, options: number) =>
                (() => {
                  const _Element = runtime.Menu.Item;
                  const _elementProps = {
                    checkedRole: "radio" as const,
                    checked: input === value6,
                    disabled: input.disabled,
                    disabledReason: input.reason,
                    onClick: () => value?.activate(input.value),
                    children: [
                      input.text,
                      input.srText !== "" ? (
                        <span className={"sr-only"}>{[" ", input.srText]}</span>
                      ) : null,
                    ],
                  };
                  const _elementKey = `${String(input.value)}:${options}`;
                  return <_Element key={_elementKey} {..._elementProps} />;
                })(),
              )}
            </runtime.Menu.Group>
          </runtime.Menu.Popup>,
        ]}
      </runtime.Menu.Root>
    );
  }
  function debugTabListOverflow(input: string, options: string): void {}
  function resetAncestorHorizontalScroll(
    input: HTMLElement | null,
    options: Element,
  ): boolean {
    for (
      let value = input;
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
    input: React.RefObject<HTMLElement | null>,
    options: string | undefined,
    context: boolean,
    value: boolean,
  ): boolean {
    let [value2, value3] = reactForUiTabs2.useState(false),
      ref = reactForUiTabs2.useRef(new Map<number, number>()),
      ref2 = reactForUiTabs2.useRef(0),
      ref3 = reactForUiTabs2.useRef(NaN),
      ref4 = reactForUiTabs2.useRef(context),
      ref5 = reactForUiTabs2.useRef(value);
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      let current = input.current,
        value4 = current?.closest<HTMLElement>('[data-cds="Tabs"]') ?? null,
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
        callback = (input2: boolean, options2: number, context2: boolean) => {
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
        callback2 = () =>
          value4.getAttribute("data-orientation") === "vertical" ||
          canTabsOverflowInline(value4, current) ||
          resetAncestorHorizontalScroll(current, value4) ||
          !(0, runtime.isUnwrappedHorizontalFlex)(value5),
        callback3 = (input2: boolean) => {
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
          let value13 = measureTabStripContents(current);
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
            value17 = (0, runtime.getTabOverflowWidth)(value5, value4, value16);
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
      let value9 = (0, runtime.createSafeResizeObserver)(value6, () =>
        callback3(false),
      );
      value9.observe(value5);
      value9.observe(current);
      let value10 =
        typeof MutationObserver === "undefined"
          ? null
          : (0, runtime.createSafeMutationObserver)(MutationObserver, () =>
              callback3(true),
            );
      value10?.observe(current, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      let value11 =
        typeof MutationObserver === "undefined"
          ? null
          : (0, runtime.createSafeMutationObserver)(MutationObserver, () =>
              callback3(false),
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
  bindRuntimeValue(
    runtime,
    "applyTabFlexCorrection",
    () => applyTabFlexCorrection,
  );
  bindRuntimeValue(runtime, "parsePixelCssValue", () => parsePixelCssValue);
  bindRuntimeValue(
    runtime,
    "measureTabStripContents",
    () => measureTabStripContents,
  );
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
  bindRuntimeValue(runtime, "useTabsOverflow", () => useTabsOverflow);
  bindRuntimeValue(
    runtime,
    "TABS_STASHED_ATTRIBUTE",
    () => TABS_STASHED_ATTRIBUTE,
    (value) => {
      TABS_STASHED_ATTRIBUTE = value;
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
    "reactForUiTabs",
    () => reactForUiTabs,
    (value) => {
      reactForUiTabs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiTabs",
    () => jsxForUiTabs,
    (value) => {
      jsxForUiTabs = value;
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
    "reactForUiTabs2",
    () => reactForUiTabs2,
    (value) => {
      reactForUiTabs2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxrZ",
    () => jsxrZ,
    (value) => {
      jsxrZ = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tabsListBaseClasses",
    () => tabsListBaseClasses,
    (value) => {
      tabsListBaseClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tabsFirstTabIndicatorClasses",
    () => tabsFirstTabIndicatorClasses,
    (value) => {
      tabsFirstTabIndicatorClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tabsLastTabIndicatorClasses",
    () => tabsLastTabIndicatorClasses,
    (value) => {
      tabsLastTabIndicatorClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tabsFlushClasses",
    () => tabsFlushClasses,
    (value) => {
      tabsFlushClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "stashedTabsClasses",
    () => stashedTabsClasses,
    (value) => {
      stashedTabsClasses = value;
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
    "TabsList",
    () => TabsList,
    (value) => {
      TabsList = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tabBaseClasses",
    () => tabBaseClasses,
    (value) => {
      tabBaseClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "disabledTabPointerClasses",
    () => disabledTabPointerClasses,
    (value) => {
      disabledTabPointerClasses = value;
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
  return () => {
    reactuP = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    tabsOverflowContext = reactuP.createContext<TabsOverflowState | null>(null);
    TABS_STASHED_ATTRIBUTE = "data-cds-stashed";
    TABS_MENU_TRIGGER_ID = "tabs-menu-trigger";
    TABS_MENU_LABEL_ID = "tabs-menu-label";
    (0, runtime.initializeSafeObservers)();
    (0, runtime.initializeIsomorphicLayoutEffect)();
    reactForUiTabs = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxForUiTabs = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    TAB_SELECTOR = '[role="tab"]';
    TAB_TEXT_EXCLUDED_SELECTOR =
      '[aria-hidden="true"], [hidden], [data-cds-disabled-reason], [role="img"], svg, .sr-only';
    (
      TabsListMenu as typeof TabsListMenu & {
        displayName?: string;
      }
    ).displayName = "Tabs.ListMenu";
    reactForUiTabs2 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxrZ = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    tabsListBaseClasses = "flex items-center font-sans";
    tabsFirstTabIndicatorClasses =
      "data-[orientation=horizontal]:[&>[role=tab]:first-child]:before:start-0 data-[orientation=horizontal]:[&>:first-child>[data-orientation][role=tab]:first-child]:before:start-0 data-[orientation=horizontal]:[&>:first-child>:first-child>[data-orientation][role=tab]:first-child]:before:start-0";
    tabsLastTabIndicatorClasses =
      "data-[orientation=horizontal]:[&>[role=tab]:last-child]:before:end-0 data-[orientation=horizontal]:[&>:last-child>[data-orientation][role=tab]:last-child]:before:end-0 data-[orientation=horizontal]:[&>:last-child>:last-child>[data-orientation][role=tab]:last-child]:before:end-0";
    tabsFlushClasses = "-ml-pad-md";
    stashedTabsClasses =
      "invisible absolute size-0 min-h-0 min-w-0 max-w-none overflow-hidden";
    TABS_OVERFLOW_RECHECK_MS = 500;
    TabsList = reactForUiTabs2.forwardRef(
      (
        {
          className: className,
          flush: flush,
          size: size,
          activateOnFocus = true,
          ...props
        }: TabsListProps,
        options: React.ForwardedRef<HTMLDivElement>,
      ) => {
        let ref = reactForUiTabs2.useRef<HTMLElement | null>(null),
          value = (0, runtime.useMergedRefs)(options, ref),
          value2 = (0, runtime.useCompactableControl)(),
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
        let ref2 = reactForUiTabs2.useRef(false);
        (0, runtime.useIsomorphicLayoutEffect)(() => {
          if (!value3 && ref2.current) {
            ref2.current = false;
            ref.current
              ?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
              ?.focus();
          }
        }, [value3]);
        return (
          <jsxrZ.Fragment>
            {[
              <runtime.baseTabs.List
                ref={value}
                activateOnFocus={activateOnFocus}
                {...props}
                {...(0, runtime.getControlSizeAttributes)(size)}
                {...((0, runtime.getInertProps)(value3) as React.HTMLAttributes<HTMLDivElement>)}
                {...(value3
                  ? {
                      [TABS_STASHED_ATTRIBUTE]: "",
                    }
                  : null)}
                className={(0, runtime.cn)(
                  tabsListBaseClasses,
                  tabsFirstTabIndicatorClasses,
                  tabsLastTabIndicatorClasses,
                  flush ? tabsFlushClasses : "",
                  className,
                  value3 && stashedTabsClasses,
                )}
              />,
              value3 ? (
                <TabsListMenu
                  size={size}
                  aria-label={props["aria-label"]}
                  aria-labelledby={props["aria-labelledby"]}
                  listRef={ref}
                  triggerHadFocusRef={ref2}
                />
              ) : null,
            ]}
          </jsxrZ.Fragment>
        );
      },
    );
    TabsList.displayName = "Tabs.List";
    tabBaseClasses =
      "relative isolate inline-flex shrink-0 items-center justify-center gap-1.5 rounded-none h-control px-md cds-reset whitespace-nowrap select-none outline-none focus-visible:outline-hidden bg-transparent text-body font-medium text-muted before:absolute before:inset-y-0 before:inset-x-px before:rounded before:-z-[1] before:transition-shadow before:duration-fast [&:not([data-active]):not([data-disabled])]:hover:text-secondary [&:not([data-active]):not([data-disabled])]:hover:before:bg-fill-ghost-hover data-[active]:text-primary data-[active]:before:bg-fill-ghost-hover focus-visible:before:shadow-focus data-[disabled]:opacity-disabled data-[disabled]:pointer-events-none";
    disabledTabPointerClasses = "data-[disabled]:pointer-events-auto";
    TabsTab = reactForUiTabs2.forwardRef(
      (
        {
          className: className,
          children: children,
          disabledReason: disabledReason,
          disabledReasonSide: disabledReasonSide,
          "aria-describedby": ariaDescribedby,
          ...props
        }: TabsTabProps,
        options: React.ForwardedRef<HTMLButtonElement>,
      ) => {
        let value = reactForUiTabs2.useId(),
          value2 =
            !!props.disabled && (0, runtime.hasDisabledReason)(disabledReason),
          value3 = useTabsOverflow()?.registerTab,
          { value: value4 } = props,
          ref = reactForUiTabs2.useRef<HTMLElement | null>(null),
          callback = reactForUiTabs2.useCallback(
            (input: HTMLElement | null) => {
              value3?.(value4, input, ref.current);
              ref.current = input;
            },
            [value3, value4],
          ),
          value5 = (0, runtime.useMergedRefs)(options, callback),
          value6 = (
            <runtime.baseTabs.Tab
              ref={value5}
              {...props}
              aria-describedby={
                value2
                  ? [ariaDescribedby, value].filter(Boolean).join(" ")
                  : ariaDescribedby
              }
              className={(0, runtime.cn)(
                tabBaseClasses,
                value2 ? disabledTabPointerClasses : undefined,
                className,
              )}
              onMouseDown={(0, runtime.withRepeatedClickSelectionPrevention)(
                props.onMouseDown,
              )}
            >
              {[
                children,
                disabledReason !== undefined && (
                  <runtime.DisabledReasonAnnouncement
                    id={value}
                    reason={value2 ? disabledReason : undefined}
                  />
                ),
              ]}
            </runtime.baseTabs.Tab>
          );
        if (disabledReason === undefined) {
          return value6;
        }
        return (
          <runtime.Tooltip
            content={value2 ? disabledReason : undefined}
            side={disabledReasonSide}
            multiline={true}
            hoverable={false}
            closeOnClick={false}
            openOnHandedBackFocus={true}
          >
            {value6}
          </runtime.Tooltip>
        );
      },
    );
    TabsTab.displayName = "Tabs.Tab";
    TabsPanel = reactForUiTabs2.forwardRef(
      (
        { className: className, ...props }: TabsPanelProps,
        options: React.ForwardedRef<HTMLDivElement>,
      ) => (
        <runtime.baseTabs.Panel
          ref={options}
          {...props}
          className={(0, runtime.cn)(
            "cds-reset outline-none focus-visible:outline-hidden",
            className,
          )}
        />
      ),
    );
    TabsPanel.displayName = "Tabs.Panel";
    TabsRoot = reactForUiTabs2.forwardRef(
      (input: TabsRootProps, options: React.ForwardedRef<HTMLDivElement>) => {
        let {
            value: value,
            defaultValue: value2,
            onValueChange: value3,
          } = input,
          [value4, value5] = reactForUiTabs2.useState<unknown>(
            value2 === undefined ? 0 : value2,
          ),
          value6 = value === undefined ? value4 : value,
          callback = reactForUiTabs2.useCallback(
            (
              input2: unknown,
              options2: import("@base-ui/react/tabs").Tabs.Root.ChangeEventDetails,
            ) => {
              value3?.(input2, options2);
              if (!options2.isCanceled) {
                value5(input2);
              }
            },
            [value3],
          ),
          ref = reactForUiTabs2.useRef(new Map<unknown, HTMLElement>()),
          callback2 = reactForUiTabs2.useCallback(
            (
              input2: unknown,
              options2: HTMLElement | null,
              context: HTMLElement | null,
            ) => {
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
          callback3 = reactForUiTabs2.useCallback(() => ref.current, []),
          callback4 = reactForUiTabs2.useCallback((input2: unknown) => {
            ref.current.get(input2)?.click();
          }, []),
          [value7, value8] = reactForUiTabs2.useState(false),
          memo = reactForUiTabs2.useMemo(
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
        return (
          <tabsOverflowContext.Provider value={memo}>
            <runtime.baseTabs.Root
              ref={options}
              data-cds={"Tabs"}
              data-collapsed={value7 ? "" : undefined}
              {...input}
              className={
                typeof className === "function"
                  ? (input2: import("@base-ui/react/tabs").Tabs.Root.State) =>
                      (0, runtime.cn)(
                        value7 && "min-w-0 max-w-full",
                        className(input2),
                      )
                  : (0, runtime.cn)(value7 && "min-w-0 max-w-full", className)
              }
              onValueChange={callback}
            />
          </tabsOverflowContext.Provider>
        );
      },
    );
    TabsRoot.displayName = "Tabs.Root";
    Tabs = {
      Root: TabsRoot,
      List: TabsList,
      Tab: TabsTab,
      Panel: TabsPanel,
    };
  };
}
