import type { TabMenuItem, TabsListMenuProps } from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsComponentsNumberInput(
  runtime: RuntimeBindings,
): () => void {
  var reactTabsListMenu: typeof React;
  var jsxTabsListMenu: typeof import("react/jsx-runtime");
  var RoleTabValue: string;
  var TabsListMenuLabel: string;
  var initializeTabsListMenu: () => void;
  function collectAccessibleTabText(input: Element, options: string): string {
    let text = "",
      callback = (input2: Node): void => {
        if (input2.nodeType === Node.TEXT_NODE) text += input2.nodeValue ?? "";
        else if (input2.nodeType === Node.ELEMENT_NODE) {
          if (
            input2 !== input &&
            ((input2 as Element).matches(options) ||
              getComputedStyle(input2 as Element).display === "none")
          )
            return;
          text += " ";
          input2.childNodes.forEach(callback);
          text += " ";
        }
      };
    callback(input);
    return text.replace(/\s+/g, " ").trim();
  }
  function accessibleTabText(element: Element): string {
    let value = collectAccessibleTabText(element, TabsListMenuLabel);
    return value !== ""
      ? value
      : (element.getAttribute("aria-label") ?? "").trim();
  }
  function screenReaderTabText(input: Element): string {
    let text = "";
    input.querySelectorAll<HTMLElement>(".sr-only").forEach((input2) => {
      input2.closest("[data-cds-disabled-reason]") === null &&
        (text += ` ${collectAccessibleTabText(input2, '[aria-hidden="true"], [hidden]')}`);
    });
    return text.trim();
  }
  function registeredTabsInDomOrder<Value>(
    input: ReadonlyMap<Value, HTMLElement>,
  ): TabMenuItem<Value>[] {
    return [...input.entries()]
      .filter(([, input2]) => input2.isConnected)
      .sort(([, input2], [, options]) =>
        input2.compareDocumentPosition(options) &
        Node.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1,
      )
      .map(([input2, input3]) => tabMenuItem(input2, input3));
  }
  function readTabMenuItems<Value>(
    input: Element | null,
    options: ReadonlyMap<Value, HTMLElement>,
  ): TabMenuItem<Value>[] {
    if (input === null) return [];
    let entries: Map<HTMLElement, Value> = new Map();
    options.forEach((input2, options2) => entries.set(input2, options2));
    let items: TabMenuItem<Value>[] = [];
    input.querySelectorAll<HTMLElement>(RoleTabValue).forEach((input2) => {
      entries.has(input2) &&
        items.push(tabMenuItem(entries.get(input2)!, input2));
    });
    return items;
  }
  function tabMenuItem<Value>(
    input: Value,
    element: Element,
  ): TabMenuItem<Value> {
    let value = element
      .querySelector("[data-cds-disabled-reason]")
      ?.textContent?.trim();
    return {
      value: input,
      text: accessibleTabText(element),
      srText: screenReaderTabText(element),
      disabled:
        element.getAttribute("aria-disabled") === "true" ||
        element.hasAttribute("data-disabled"),
      reason: value === undefined || value === "" ? undefined : value,
    };
  }
  function sameTabMenuItems<Value>(
    items: readonly TabMenuItem<Value>[],
    items2: readonly TabMenuItem<Value>[],
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
  }: TabsListMenuProps): React.ReactElement {
    let value = (0, runtime.useFlipIndicatorContext)(),
      value2 = (0, reactTabsListMenu.useRef)<HTMLButtonElement | null>(null),
      value3 = (0, reactTabsListMenu.useId)(),
      value4 = (0, reactTabsListMenu.useId)(),
      [value5, value6] = (0, reactTabsListMenu.useState)(() =>
        registeredTabsInDomOrder(value?.tabs() ?? new Map()),
      ),
      value7 = (0, reactTabsListMenu.useCallback)(() => {
        let value10 = readTabMenuItems(
          listRef.current,
          value?.tabs() ?? new Map(),
        );
        value6((input) => (sameTabMenuItems(input, value10) ? input : value10));
      }, [listRef, value]);
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      value7();
      let current = listRef.current;
      if (current === null || typeof MutationObserver === "undefined") return;
      let observer = new MutationObserver(value7);
      observer.observe(current, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["aria-disabled", "data-disabled", "aria-label"],
      });
      return () => observer.disconnect();
    }, [value7, listRef]);
    (0, reactTabsListMenu.useEffect)(value7, [value7]);
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      let current = listRef.current,
        value10 = current?.ownerDocument.activeElement ?? null;
      current !== null &&
        value10 !== null &&
        current.contains(value10) &&
        value2.current?.focus();
      return () => {
        let current2 = value2.current,
          value11 = current2?.ownerDocument.activeElement ?? null,
          value12 = current2?.getAttribute("aria-controls") ?? null,
          value13 =
            value12 === null
              ? null
              : (current2 as HTMLButtonElement).ownerDocument.getElementById(
                  value12,
                );
        triggerHadFocusRef.current =
          current2 !== null &&
          value11 !== null &&
          (value11 === current2 ||
            (value13 !== null && value13.contains(value11)));
      };
    }, [listRef, triggerHadFocusRef]);
    let value8 = value5.find(
        (input) => value !== null && Object.is(input.value, value.value),
      ),
      value9 = [
        ariaLabelledby ?? (ariaLabel !== undefined ? value3 : undefined),
        value8 !== undefined ? value4 : undefined,
      ]
        .filter(Boolean)
        .join(" ");
    return (
      <runtime.MenuMenuAssignValue.Root sheetTitle={ariaLabel}>
        <runtime.MenuMenuAssignValue.TriggerButton
          ref={value2}
          variant={"secondary"}
          size={size}
          aria-labelledby={value9 === "" ? undefined : value9}
          data-cds-part={runtime.TabsMenuTriggerValue}
          className={"max-w-full min-w-0"}
        >
          {ariaLabel !== undefined && ariaLabelledby === undefined ? (
            <span id={value3} className={"sr-only"}>
              {ariaLabel}
            </span>
          ) : null}
          {value8 !== undefined ? (
            <span
              id={value4}
              data-cds-part={runtime.TabsMenuLabelValue}
              className={"max-w-40 min-w-0 truncate"}
            >
              {value8.text}
            </span>
          ) : ariaLabel !== undefined ? (
            <span
              aria-hidden={true}
              data-cds-part={runtime.TabsMenuLabelValue}
              className={"max-w-40 min-w-0 truncate"}
            >
              {ariaLabel}
            </span>
          ) : null}
        </runtime.MenuMenuAssignValue.TriggerButton>
        <runtime.MenuMenuAssignValue.Popup>
          <runtime.MenuMenuAssignValue.Group
            aria-label={ariaLabelledby === undefined ? ariaLabel : undefined}
            aria-labelledby={ariaLabelledby}
          >
            {value5.map((input, options) =>
              (() => {
                const _Component = runtime.MenuMenuAssignValue.Item;
                const _props = {
                  checkedRole: "radio",
                  checked: input === value8,
                  disabled: input.disabled,
                  disabledReason: input.reason,
                  onClick: () => value?.activate(input.value),
                  children: [
                    input.text,
                    input.srText !== "" ? (
                      <span className={"sr-only"}> {input.srText}</span>
                    ) : null,
                  ],
                } as const;
                const _key = `${String(input.value)}:${options}`;
                return <_Component key={_key} {..._props} />;
              })(),
            )}
          </runtime.MenuMenuAssignValue.Group>
        </runtime.MenuMenuAssignValue.Popup>
      </runtime.MenuMenuAssignValue.Root>
    );
  }
  bindRuntimeValue(
    runtime,
    "collectAccessibleTabText",
    () => collectAccessibleTabText,
  );
  bindRuntimeValue(runtime, "accessibleTabText", () => accessibleTabText);
  bindRuntimeValue(runtime, "screenReaderTabText", () => screenReaderTabText);
  bindRuntimeValue(
    runtime,
    "registeredTabsInDomOrder",
    () => registeredTabsInDomOrder,
  );
  bindRuntimeValue(runtime, "readTabMenuItems", () => readTabMenuItems);
  bindRuntimeValue(runtime, "tabMenuItem", () => tabMenuItem);
  bindRuntimeValue(runtime, "sameTabMenuItems", () => sameTabMenuItems);
  bindRuntimeValue(runtime, "TabsListMenu", () => TabsListMenu);
  bindRuntimeValue(
    runtime,
    "reactTabsListMenu",
    () => reactTabsListMenu,
    (value) => {
      reactTabsListMenu = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxTabsListMenu",
    () => jsxTabsListMenu,
    (value) => {
      jsxTabsListMenu = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RoleTabValue",
    () => RoleTabValue,
    (value) => {
      RoleTabValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TabsListMenuLabel",
    () => TabsListMenuLabel,
    (value) => {
      TabsListMenuLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeTabsListMenu",
    () => initializeTabsListMenu,
    (value) => {
      initializeTabsListMenu = value;
    },
  );
  return () => {
    initializeTabsListMenu = (0, runtime.initializeOnce)(() => {
      "use client";

      (0, runtime.initializeHooksLayoutEffect)();
      (0, runtime.initializeMenuMenu_5)();
      (0, runtime.initializeSwitchContext_2)();
      reactTabsListMenu = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      jsxTabsListMenu = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      RoleTabValue = '[role="tab"]';
      TabsListMenuLabel =
        '[aria-hidden="true"], [hidden], [data-cds-disabled-reason], [role="img"], svg, .sr-only';
      (TabsListMenu as React.FC<TabsListMenuProps>).displayName =
        "Tabs.ListMenu";
    });
  };
}
