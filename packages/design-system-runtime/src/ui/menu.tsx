import type { PublicOverlayActions } from "../contracts/overlays";
import type {
  MenuRootState,
  SheetFrameContext,
  MenuItemState,
} from "../contracts/overlays";
import type {
  CollisionPadding,
  ContextMenuState,
  ControlSize,
  Density,
  ForwardComponent,
  ImeKeyEvent,
  MenuItemProps,
  MenuItems,
  MenuItemsContent,
  MenuPendingProps,
  MenuPopupFocusEvent,
  MenuPopupKeyboardEvent,
  MenuPopupProps,
  MenuProps,
  MenuRootProps,
  MenuSearchProps,
  MenuSubmenuProps,
  MenuSubmenuTriggerProps,
  MenuTextState,
  MenuTriggerButtonProps,
  OverlayActions,
  PassiveOpenCell,
  PassivePopupTransform,
  SearchKeyEvent,
} from "../contracts/overlays";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiMenu(runtime: RuntimeBindings): () => void {
  var jsxo_: typeof import("react/jsx-runtime");
  var reacttM: typeof React;
  var reactForUiMenu: typeof React;
  var jsxForUiMenu: typeof import("react/jsx-runtime");
  var numericShortcutPattern: RegExp;
  var MenuPopup: ForwardComponent<HTMLDivElement, MenuPopupProps>;
  var MenuSheetCapablePopup: ForwardComponent<HTMLDivElement, MenuPopupProps>;
  var MenuItem: ForwardComponent<HTMLDivElement, MenuItemProps>;
  var MenuSubmenuTrigger: ForwardComponent<
    HTMLDivElement,
    MenuSubmenuTriggerProps
  >;
  var menuGroupLabelClasses: string;
  var MenuTriggerButton: ForwardComponent<
    HTMLButtonElement,
    MenuTriggerButtonProps
  >;
  var MENU_PLACEHOLDER_MINIMUM_WIDTH: number;
  var emptyMenuSize: {
    width: number;
    height: number;
  };
  var HIGHLIGHTED_MENU_ITEM_SELECTOR: string;
  var MenuBar: ForwardComponent<
    HTMLDivElement,
    import("@base-ui/react/menubar").Menubar.Props
  >;
  var Menu: typeof SimpleMenu & {
    Root: typeof MenuRoot;
    Bar: typeof MenuBar;
    Trigger: typeof import("@base-ui/react/menu").Menu.Trigger;
    TriggerButton: typeof MenuTriggerButton;
    Popup: typeof MenuPopup;
    Item: typeof MenuItem;
    Separator: typeof MenuSeparator;
    Group: typeof import("@base-ui/react/menu").Menu.Group;
    GroupLabel: typeof MenuGroupLabel;
    Header: typeof MenuHeader;
    Submenu: typeof MenuSubmenu;
    SubmenuTrigger: typeof MenuSubmenuTrigger;
    SearchablePopup: typeof MenuSearchablePopup;
    PendingList: typeof MenuPendingList;
  };
  function MenuContextProviders(
    input: React.ReactNode,
    options: PassiveOpenCell | null,
    context: React.RefObject<OverlayActions | null>,
    value: boolean = false,
  ): React.ReactElement {
    let value2 = (
      <runtime.passiveOpenStateContext.Provider value={options}>
        <runtime.menuRootIdentityContext.Provider value={context}>
          <runtime.menuIsOpenContext.Provider value={null}>
            <runtime.menuTriggerContext.Provider value={null}>
              <runtime.submenuStateContext.Provider
                value={runtime.defaultSubmenuState}
              >
                <runtime.contextMenuContext.Provider value={value}>
                  {value ? (
                    input
                  ) : (
                    <runtime.TooltipImplementationProvider>
                      {input}
                    </runtime.TooltipImplementationProvider>
                  )}
                </runtime.contextMenuContext.Provider>
              </runtime.submenuStateContext.Provider>
            </runtime.menuTriggerContext.Provider>
          </runtime.menuIsOpenContext.Provider>
        </runtime.menuRootIdentityContext.Provider>
      </runtime.passiveOpenStateContext.Provider>
    );
    if (value) {
      return (
        <runtime.MenuOpenerProvider value={undefined}>
          {value2}
        </runtime.MenuOpenerProvider>
      );
    } else {
      return value2;
    }
  }
  function isNestedMenuEvent(
    input: EventTarget | null | undefined,
    options?: string,
  ): boolean {
    let value = (0, runtime.asElement)(input)?.closest("[data-nested]") ?? null;
    if (value === null) {
      return false;
    }
    if (options === undefined) {
      return true;
    }
    let value2 = (0, runtime.asElement)(value.closest("[data-sheet-tree]"));
    return (
      value2 !== null && value2.getAttribute("data-sheet-tree") === options
    );
  }
  function isFocusOutEvent(input: Event | undefined): input is FocusEvent {
    return (
      input !== undefined &&
      "relatedTarget" in input &&
      input.type === "focusout"
    );
  }
  function shouldRefuseNestedMenuClose(
    input: boolean,
    options: import("@base-ui/react/menu").Menu.Root.ChangeEventDetails,
    context?: string,
  ): boolean {
    if (input) {
      return false;
    }
    let { reason: value, event: value2 } = options;
    if (value === "outside-press") {
      return isNestedMenuEvent(value2?.target, context);
    }
    if (value === "focus-out" && isFocusOutEvent(value2)) {
      let value3 = (0, runtime.asElement)(value2.relatedTarget),
        value4 =
          value2.relatedTarget === null ||
          (value3 !== null &&
            (value3 === value3.ownerDocument.body || !value3.isConnected));
      return (
        isNestedMenuEvent(value2.relatedTarget, context) ||
        (value4 && isNestedMenuEvent(value2.target, context))
      );
    }
    return false;
  }
  function cancelNestedMenuClose(
    input: boolean,
    options: import("@base-ui/react/menu").Menu.Root.ChangeEventDetails,
    context?: string,
  ): boolean {
    if (!shouldRefuseNestedMenuClose(input, options, context)) {
      return false;
    }
    options.cancel();
    return true;
  }
  function extractReactText(input: React.ReactNode): string | undefined {
    if (typeof input === "string") {
      return input;
    }
    if (typeof input === "number") {
      return String(input);
    }
    if (input === null || input === undefined || typeof input === "boolean") {
      return "";
    }
    if (!Array.isArray(input)) {
      return;
    }
    let text = "";
    for (let value of input as readonly React.ReactNode[]) {
      let value2 = extractReactText(value);
      if (value2 === undefined) {
        return;
      }
      text += value2;
    }
    return text;
  }
  function normalizeLabelText(input: string): string {
    return input.replace(/\s+/g, " ").trim();
  }
  function useMenuItemLabel(
    input: React.ReactNode,
    options?: string,
  ): MenuTextState {
    let ref = reacttM.useRef<HTMLElement | null>(null),
      ref2 = reacttM.useRef<HTMLElement | null>(null),
      [value, value2] = reacttM.useState<string | undefined>(),
      value3 =
        options === undefined
          ? normalizeLabelText(extractReactText(input) ?? "") || undefined
          : undefined,
      value4 = options === undefined && value3 === undefined;
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      if (!value4) {
        return;
      }
      let value5 = normalizeLabelText(ref.current?.textContent ?? ""),
        value6 = (ref2.current?.textContent ?? "").startsWith(value5),
        value7 =
          value5 === "" || (value6 && value !== value5) ? undefined : value5;
      if (value7 !== value) {
        value2(value7);
      }
    });
    return {
      label: options ?? value3 ?? (value4 ? value : undefined),
      labelSpanRef: ref,
      rowRef: ref2,
    };
  }
  function getShortcutNumeralClasses(input: string | undefined): string {
    if (numericShortcutPattern.test(input as string)) {
      return "tabular-nums";
    } else {
      return "";
    }
  }
  function MenuShortcut({ keys: keys }: { keys: string }): React.ReactElement {
    return (
      <runtime.Shortcut
        keys={keys}
        variant={"text"}
        aria-hidden={true}
        className={(0, runtime.cn)(
          "pointer-coarse:hidden text-footnote",
          getShortcutNumeralClasses(keys),
        )}
      />
    );
  }
  function useMenuPopupElement(
    input: MenuPopupProps,
    options: React.ForwardedRef<HTMLDivElement>,
    context: boolean,
    value: boolean,
  ): React.ReactElement {
    let {
        side: value2,
        align: value16 = "start",
        sideOffset: value3,
        collisionPadding: value4,
        collisionAvoidance: value5,
        anchor: value6,
        container: value7,
        className: value8,
        children: value9,
        header: value10,
        footer: value11,
        maxVisibleItems: value12,
        layerOffset: value13,
        stableWhileOpen: value17 = false,
        "data-cds": value18 = "Menu",
        initialFocus: value14,
        ...value15
      } = input,
      value19 = (0, runtime.usePortalContainer)(),
      value20 = reactForUiMenu.useContext<MenuRootState | null>(
        runtime.menuTriggerContext,
      ),
      value21 =
        reactForUiMenu.useContext<boolean>(runtime.contextMenuContext) &&
        value20 === null,
      value22 = reactForUiMenu.useContext<{
        collisionPadding?: CollisionPadding;
      } | null>(runtime.collisionPaddingContext),
      value23 = value4 ?? value22?.collisionPadding,
      memo = reactForUiMenu.useMemo(
        () =>
          value6 !== undefined || !value20
            ? value6
            : (0, runtime.createMenuVirtualAnchor)(value20),
        [value6, value20],
      ),
      value24 =
        value3 ??
        (value21 ? undefined : value20 && value6 === undefined ? 2 : 6),
      value25 = (0, runtime.useStablePopupPlacement)({
        enabled: value17 && !value21,
        side: value2,
        align: value16,
      }),
      value26 = (0, runtime.useMenuOwnerRef)(
        value20?.triggerRef,
        value15.finalFocus,
      ),
      value27 = value21
        ? value15.finalFocus === undefined || value15.finalFocus === null
        : value6 !== undefined &&
          value6 !== null &&
          value20 === null &&
          value15.finalFocus === undefined,
      value28 = (0, runtime.usePassiveOpenContext)(value20 === null);
    value28.root?.declareFocusProps(value14, value15.finalFocus);
    if (context && value20 !== null && value14 !== undefined) {
      (0, runtime.warnNestedMenuInitialFocus)();
    }
    let value29 = (0, runtime.useRefocusAfterPendingSheet)(value),
      value30 = (0, runtime.useStableMergedRef)(
        (input2: HTMLElement | null) => {
          value25.popupRef(input2);
          value26(input2);
          value29(input2);
          value28.root?.registerPopup(input2);
        },
        options,
      );
    if (context && value20 !== null && value13 !== undefined) {
      (0, runtime.warnNestedMenuLayerOffset)();
    }
    let value31 = (0, runtime.useOverlayLayer)(
      value21 ? "contextmenu" : "menu",
      value20 === null ? value13 : undefined,
    );
    return (
      <runtime.baseMenu.Portal container={(value7 ?? value19) as import("../contracts/overlays").BaseUIPortalContainer}>
        <runtime.PortalRoot
          {...value31.portalProps}
          style={
            value
              ? {
                  ...value31.portalProps.style,
                  ...runtime.concealedPopupStyle,
                }
              : value31.portalProps.style
          }
          surface={runtime.elevationSurfaceNames.popover}
          companionModalCatcher={true}
          closeOnActivityHide={true}
        >
          <runtime.CollisionPaddingProvider
            override={value23}
            container={value7 ?? value19}
            provideInherit={true}
          >
            {(input2: CollisionPadding | undefined) => (
              <runtime.layerBaseContext.Provider value={value31.base}>
                <runtime.baseMenu.Positioner
                  ref={value25.positionerRef}
                  className={value25.held?.positionerClassName}
                  style={
                    value25.held !== null
                      ? {
                          ...value31.style,
                          ...value25.held.positionerStyle,
                        }
                      : value31.style
                  }
                  side={value25.side}
                  align={value25.align}
                  sideOffset={value24}
                  collisionPadding={input2}
                  collisionAvoidance={value5}
                  anchor={memo}
                >
                  <runtime.PassiveOpenGate
                    cell={value28.cell}
                    nested={value20 !== null}
                  >
                    {(input3: PassivePopupTransform) => (
                      <runtime.MenuPopupElement
                        anchoredWithoutFinalFocus={value27}
                        cursorAnchored={value21}
                        data-cds={value18}
                        ref={value30}
                        {...input3(value15)}
                        className={(0, runtime.cn)(
                          runtime.contextMenuPopupClasses,
                          value25.held?.popupClassName,
                          value8,
                        )}
                      >
                        <runtime.MenuScrollContent
                          header={value10}
                          footer={value11}
                          maxVisibleItems={value12}
                        >
                          {value9}
                        </runtime.MenuScrollContent>
                      </runtime.MenuPopupElement>
                    )}
                  </runtime.PassiveOpenGate>
                </runtime.baseMenu.Positioner>
              </runtime.layerBaseContext.Provider>
            )}
          </runtime.CollisionPaddingProvider>
        </runtime.PortalRoot>
      </runtime.baseMenu.Portal>
    );
  }
  function MenuSubmenu({
    actionsRef: actionsRef,
    ...props
  }: MenuSubmenuProps): React.ReactElement {
    let [value, value2] = reactForUiMenu.useState(
        props.open ?? props.defaultOpen ?? false,
      ),
      ref = reactForUiMenu.useRef(value),
      value3 = (0, runtime.useOptionalEventCallback)(props.onOpenChange),
      { sheet: value4 } = (0, runtime.useSheetState)(),
      value5 = reactForUiMenu.useContext<SheetFrameContext | null>(
        runtime.sheetFrameContext,
      ),
      value6 = value5?.treeId,
      ref2 = reactForUiMenu.useRef<React.ReactNode>(null),
      callback = reactForUiMenu.useCallback((input: React.ReactNode): void => {
        ref2.current = input;
      }, []),
      [value7, value8] = reactForUiMenu.useState<React.ReactNode>(null),
      callback2 = reactForUiMenu.useCallback(
        (
          input: boolean,
          options: import("@base-ui/react/menu").Menu.Root.ChangeEventDetails,
        ): void => {
          if (value4 && cancelNestedMenuClose(input, options, value6)) {
            return;
          }
          if (
            value4 &&
            !input &&
            value5?.refusesAmbientClose(options) === true
          ) {
            options.cancel();
            return;
          }
          value3?.(input, options);
          if (!options.isCanceled) {
            ref.current = input;
            value2(input);
            if (input) {
              value8(ref2.current);
            }
          }
        },
        [value3, value4, value5, value6],
      ),
      ref3 = reactForUiMenu.useRef<HTMLElement | null>(null),
      callback3 = reactForUiMenu.useCallback(
        (input: HTMLElement | null): void => {
          ref3.current = input;
        },
        [],
      ),
      ref4 = reactForUiMenu.useRef<PublicOverlayActions | null>(null);
    (0, runtime.useForwardedOverlayActions)(ref4, actionsRef);
    let callback4 = reactForUiMenu.useCallback(() => {
        ref4.current?.close();
      }, []),
      value9 =
        reactForUiMenu.useContext<React.RefObject<OverlayActions | null> | null>(
          runtime.menuIsOpenContext,
        ),
      value10 =
        reactForUiMenu.useContext<React.RefObject<OverlayActions | null> | null>(
          runtime.menuRootIdentityContext,
        ),
      value11 = value9 ?? value10,
      memo = reactForUiMenu.useMemo(
        () => ({
          triggerRef: ref3,
          setTriggerNode: callback3,
          openRef: ref,
          close: callback4,
          stashLabel: callback,
        }),
        [callback3, callback4, callback],
      ),
      value12 = props.open ?? value;
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      ref.current = value12;
      if (value12) {
        let current = ref2.current;
        value8((input: React.ReactNode) =>
          input === current ? input : current,
        );
      }
    }, [value12]);
    let memo2 = reactForUiMenu.useMemo(
      () => ({
        label: value7,
        open: value12,
      }),
      [value7, value12],
    );
    return (
      <runtime.menuTriggerContext.Provider value={memo}>
        <runtime.submenuStateContext.Provider value={memo2}>
          <runtime.menuIsOpenContext.Provider value={value11}>
            <runtime.menuRootIdentityContext.Provider value={ref4}>
              <runtime.baseMenu.SubmenuRoot
                {...props}
                actionsRef={ref4}
                onOpenChange={callback2}
              />
            </runtime.menuRootIdentityContext.Provider>
          </runtime.menuIsOpenContext.Provider>
        </runtime.submenuStateContext.Provider>
      </runtime.menuTriggerContext.Provider>
    );
  }
  function MenuSeparator(): React.ReactElement {
    return (
      <runtime.baseMenu.Separator
        className={"compact:mx-2 comfortable:mx-2.5 my-1 h-px bg-border"}
      />
    );
  }
  function MenuHeader({
    children: children,
    className: className,
  }: React.PropsWithChildren<{
    className?: string;
  }>): React.ReactElement {
    let value = (0, runtime.useIsSheet)(),
      value2 =
        reactForUiMenu.useContext<MenuRootState | null>(
          runtime.menuTriggerContext,
        ) !== null,
      { label: value3 } = reactForUiMenu.useContext<MenuItemState>(
        runtime.submenuStateContext,
      ),
      value4 =
        value &&
        value2 &&
        typeof children === "string" &&
        typeof value3 === "string" &&
        children.trim() === value3.trim();
    return (
      <div
        role={"presentation"}
        className={(0, runtime.cn)(
          menuGroupLabelClasses,
          value4 && "first:hidden",
          className,
        )}
      >
        {children}
      </div>
    );
  }
  function MenuGroupLabel({
    children: children,
    className: className,
  }: React.PropsWithChildren<{
    className?: string;
  }>): React.ReactElement {
    return (
      <runtime.baseMenu.GroupLabel
        className={(0, runtime.cn)(menuGroupLabelClasses, className)}
      >
        {children}
      </runtime.baseMenu.GroupLabel>
    );
  }
  function isMenuItemList(input: MenuItemsContent): input is MenuItems {
    return Array.isArray(input);
  }
  function renderMenuItems(input: MenuItemsContent): React.ReactNode {
    if (!isMenuItemList(input)) {
      return input;
    }
    return input.map((event: MenuItems[number], options: number) => {
      if (event === "separator") {
        return (() => {
          const _Element = MenuSeparator;
          const _elementProps = {};
          const _elementKey = options;
          return <_Element key={_elementKey} {..._elementProps} />;
        })();
      }
      if (
        event.label === undefined ||
        event.label === null ||
        event.label === "" ||
        event.label === false
      ) {
        return null;
      }
      if (event.items) {
        return (() => {
          const _Element2 = reactForUiMenu.Fragment;
          const _elementProps2 = {
            children: [
              event.separatorBefore && <MenuSeparator />,
              <MenuSubmenu disabled={event.disabled}>
                {[
                  <MenuSubmenuTrigger icon={event.icon} hint={event.hint}>
                    {event.label}
                  </MenuSubmenuTrigger>,
                  <MenuPopup>{renderMenuItems(event.items)}</MenuPopup>,
                ]}
              </MenuSubmenu>,
            ],
          };
          const _elementKey2 = options;
          return <_Element2 key={_elementKey2} {..._elementProps2} />;
        })();
      }
      return (() => {
        const _Element3 = reactForUiMenu.Fragment;
        const _elementProps3 = {
          children: [
            event.separatorBefore && <MenuSeparator />,
            <MenuItem
              icon={event.icon}
              shortcut={event.shortcut}
              variant={event.variant}
              disabled={event.disabled}
              checked={event.checked}
              checkedRole={event.checkedRole}
              indicator={event.indicator}
              indeterminate={event.indeterminate}
              hint={event.hint}
              description={event.description}
              disabledReason={event.disabledReason}
              keepOpen={event.keepOpen}
              leading={event.leading}
              trailing={event.trailing}
              href={event.href}
              routerOptions={event.routerOptions}
              target={event.target}
              onClick={event.onSelect}
            >
              {event.label}
            </MenuItem>,
          ],
        };
        const _elementKey3 = options;
        return <_Element3 key={_elementKey3} {..._elementProps3} />;
      })();
    });
  }
  function getMenuCaretSize(
    input: Density,
    options?: ControlSize,
  ): "sm" | "xs" {
    if ((0, runtime.getDensitySizeIndex)(input, options) >= 4) {
      return "sm";
    } else {
      return "xs";
    }
  }
  function MenuCaret({
    size: size,
  }: {
    size?: ControlSize;
  }): React.ReactElement {
    let value = (0, runtime.useDensity)(),
      value2 = (0, runtime.useButtonGroup)();
    return (
      <runtime.Icon
        name={"CaretDown"}
        size={getMenuCaretSize(value, size ?? value2?.size)}
        data-cds-part={"menu-caret"}
        className={"shrink-0 opacity-60"}
      />
    );
  }
  function MenuPopupContent({
    side: side,
    align: align,
    sideOffset: sideOffset,
    collisionPadding: collisionPadding,
    finalFocus: finalFocus,
    dataCds: dataCds,
    items: items,
  }: Pick<
    MenuPopupProps,
    "side" | "align" | "sideOffset" | "collisionPadding" | "finalFocus"
  > & {
    dataCds?: string;
    items: MenuItemsContent;
  }): React.ReactElement {
    return (
      <runtime.ContextMenuPopupFrame
        side={side}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        finalFocus={finalFocus}
        data-cds={dataCds ?? "Menu"}
      >
        {renderMenuItems(items)}
      </runtime.ContextMenuPopupFrame>
    );
  }
  function SimpleMenu(input: MenuProps): React.ReactElement {
    let value = (0, runtime.useSheetCapablePresentation)(),
      value2 = reactForUiMenu.useContext<boolean>(runtime.menuBarContext),
      value3: React.RefObject<OverlayActions | null> = (0,
      runtime.useStableObjectRef)(),
      onOpenChange = input.onOpenChange,
      { onOpenChange: value4, triggerRef: value5 } = (0,
      runtime.useTrackedMenuTrigger)(
        (
          input2: boolean,
          options: import("@base-ui/react/menu").Menu.Root.ChangeEventDetails,
        ) => {
          onOpenChange?.(input2, options);
          (0, runtime.recordKeyboardContextMenuOpen)(value3, input2, options);
        },
        value2,
      ),
      value6 = (0, runtime.usePortalContainer)();
    if (value) {
      return <MenuRootProviders {...input} />;
    }
    return useDropdownMenu(input, value6, {
      triggerRef: value5,
      onOpenChange: value4,
      actionsRef: value3,
      contextMenuOnOpenChange: value4,
      inMenuBar: value2,
    });
  }
  function MenuRootProviders(input: MenuProps): React.ReactElement {
    let {
        open: value,
        sheetTitle: value2,
        backLabel: value3,
        closeLabel: value4,
      } = input,
      memo = reactForUiMenu.useMemo(
        () => ({
          sheetTitle: value2,
          backLabel: value3,
          closeLabel: value4,
        }),
        [value2, value3, value4],
      ),
      value5 = (0, runtime.usePortalContainer)(),
      value6 = reactForUiMenu.useContext<boolean>(runtime.menuBarContext),
      { onOpenChange: value7, triggerRef: value8 } = (0,
      runtime.useTrackedMenuTrigger)(input.onOpenChange, value6),
      value9 = (0, runtime.useControllableOpen)({
        open: value,
        onOpenChange: value7,
      }),
      open = value9.open,
      value10 = (0, runtime.useAdaptiveSheet)({
        open: open,
        onOpenChange: value9.onOpenChange,
        closable: !(value !== undefined && input.onOpenChange === undefined),
        refuseClose: refuseInnerMenuClose,
      }),
      value11 = useDropdownMenu(input, value5, {
        triggerRef: value8,
        onOpenChange: value10.onOpenChange,
        onOpenChangeComplete: value10.onOpenChangeComplete,
        actionsRef: value10.actionsRef,
        sheetCapable: true,
        inMenuBar: value6,
      });
    return (
      <runtime.SheetContextProvider value={value10}>
        <runtime.menuSheetLabelsContext.Provider value={memo}>
          {value11}
        </runtime.menuSheetLabelsContext.Provider>
      </runtime.SheetContextProvider>
    );
  }
  function useDropdownMenu(
    input: MenuProps,
    options: Element | ShadowRoot | undefined,
    context: ContextMenuState,
  ): React.ReactElement {
    let {
      items: value,
      side: value2,
      align: value3,
      sideOffset: value4,
      collisionPadding: value5,
      finalFocus: value6,
      open: value7,
      disabled: value8,
      className: value9,
      style: value10,
      "data-cds": value11,
    } = input;
    if (input.trigger === "context-menu") {
      if (value8) {
        return (
          <div data-disabled={""} className={value9}>
            {input.children}
          </div>
        );
      }
      if (context.sheetCapable) {
        return (
          <runtime.CloseOnActivityHideProvider actionsRef={context.actionsRef}>
            <runtime.baseContextMenu.Root
              open={value7}
              onOpenChange={context.onOpenChange as import("../contracts/overlays").ContextMenuChange}
              onOpenChangeComplete={context.onOpenChangeComplete}
              actionsRef={context.actionsRef}
            >
              {MenuContextProviders(
                <jsxForUiMenu.Fragment>
                  {[
                    <runtime.baseContextMenu.Trigger className={value9}>
                      {input.children}
                    </runtime.baseContextMenu.Trigger>,
                    <MenuPopup
                      side={value2}
                      align={value3}
                      sideOffset={value4}
                      collisionPadding={value5}
                      finalFocus={value6}
                      data-cds={value11 ?? "Menu"}
                    >
                      {renderMenuItems(value)}
                    </MenuPopup>,
                  ]}
                </jsxForUiMenu.Fragment>,
                null,
                context.actionsRef,
                true,
              )}
            </runtime.baseContextMenu.Root>
          </runtime.CloseOnActivityHideProvider>
        );
      }
      return (
        <runtime.CloseOnActivityHideProvider actionsRef={context.actionsRef}>
          <runtime.baseContextMenu.Root
            open={value7}
            onOpenChange={context.contextMenuOnOpenChange as import("../contracts/overlays").ContextMenuChange}
            actionsRef={context.actionsRef}
          >
            {[
              <runtime.baseContextMenu.Trigger className={value9}>
                {input.children}
              </runtime.baseContextMenu.Trigger>,
              <runtime.baseContextMenu.Portal container={(options) as import("../contracts/overlays").BaseUIPortalContainer}>
                <runtime.menuRootIdentityContext.Provider
                  value={context.actionsRef}
                >
                  <MenuPopupContent
                    side={value2}
                    align={value3}
                    sideOffset={value4}
                    collisionPadding={value5}
                    finalFocus={value6}
                    dataCds={value11}
                    items={value}
                  />
                </runtime.menuRootIdentityContext.Provider>
              </runtime.baseContextMenu.Portal>,
            ]}
          </runtime.baseContextMenu.Root>
        </runtime.CloseOnActivityHideProvider>
      );
    }
    let value12: React.ReactNode;
    if (input.renderTrigger !== undefined) {
      value12 = (
        <runtime.baseMenu.Trigger
          disabled={value8}
          className={value9}
          style={value10}
          render={input.renderTrigger}
        />
      );
    } else if (input.iconOnly) {
      let value13 =
          input.tooltip === false
            ? undefined
            : typeof input.tooltip === "string"
              ? input.tooltip
              : input["aria-label"],
        value14 = (
          <runtime.baseMenu.Trigger
            disabled={value8}
            render={
              <runtime.Button
                variant={input.variant}
                size={input.size}
                iconOnly={true}
                icon={input.icon || "DotsVertical"}
                aria-label={input["aria-label"]}
                pressed={input.pressed}
                tooltip={false}
                className={value9}
                style={value10}
              />
            }
          />
        ),
        value15 = value13 ? (
          <runtime.Tooltip content={value13}>{value14}</runtime.Tooltip>
        ) : (
          value14
        );
      value12 =
        input.disabledReason !== undefined ? (
          <runtime.DisabledReasonTooltip
            side={input.disabledReasonSide}
            reason={value8 ? input.disabledReason : undefined}
          >
            {value15}
          </runtime.DisabledReasonTooltip>
        ) : (
          value15
        );
    } else {
      value12 = (
        <runtime.baseMenu.Trigger
          disabled={value8}
          render={
            <runtime.Button
              variant={input.variant}
              size={input.size}
              icon={input.icon}
              iconPosition={input.iconPosition}
              aria-label={input["aria-label"]}
              className={value9}
              style={value10}
            >
              {[input.label, <MenuCaret size={input.size} />]}
            </runtime.Button>
          }
        />
      );
    }
    return (
      <runtime.MenuOpenerProvider value={context.triggerRef}>
        <runtime.CloseOnActivityHideProvider actionsRef={context.actionsRef}>
          <runtime.baseMenu.Root<void>
            open={value7}
            onOpenChange={context.onOpenChange as import("../contracts/overlays").ContextMenuChange}
            onOpenChangeComplete={context.onOpenChangeComplete}
            actionsRef={context.actionsRef}
            modal={context.inMenuBar ? undefined : true}
          >
            {MenuContextProviders(
              <jsxForUiMenu.Fragment>
                {[
                  value12,
                  <MenuPopup
                    side={value2}
                    align={value3}
                    sideOffset={value4}
                    collisionPadding={value5}
                    finalFocus={value6}
                    data-cds={value11}
                  >
                    {renderMenuItems(value)}
                  </MenuPopup>,
                ]}
              </jsxForUiMenu.Fragment>,
              null,
              context.actionsRef,
            )}
          </runtime.baseMenu.Root>
        </runtime.CloseOnActivityHideProvider>
      </runtime.MenuOpenerProvider>
    );
  }
  function refuseInnerMenuClose(
    input: import("@base-ui/react/menu").Menu.Root.ChangeEventDetails,
    options?: string,
  ): boolean {
    return shouldRefuseNestedMenuClose(false, input, options);
  }
  function MenuRoot(input: MenuRootProps): React.ReactElement {
    let {
        children: value,
        sheetTitle: value2,
        backLabel: value3,
        closeLabel: value4,
        ...value5
      } = input,
      value6 = (0, runtime.useSheetCapablePresentation)(),
      value7 = reactForUiMenu.useContext<boolean>(runtime.menuBarContext),
      { onOpenChange: value8, triggerRef: value9 } = (0,
      runtime.useTrackedMenuTrigger)(value5.onOpenChange, value7),
      value10 = (0, runtime.usePassiveOpenState)(value8, value5.open, !value7),
      value11: React.RefObject<OverlayActions | null> = (0,
      runtime.useStableObjectRef)();
    (0, runtime.useForwardedOverlayActions)(value11, value5.actionsRef);
    if (value6) {
      return (
        <runtime.CloseOnActivityHideProvider actionsRef={value11}>
          <ControlledMenuRoot {...input} actionsRef={value11} />
        </runtime.CloseOnActivityHideProvider>
      );
    }
    return (
      <runtime.MenuOpenerProvider value={value9}>
        <runtime.CloseOnActivityHideProvider actionsRef={value11}>
          <runtime.baseMenu.Root<void>
            {...value5}
            modal={value7 ? undefined : value5.modal}
            actionsRef={value11}
            onOpenChange={value10.onOpenChange}
          >
            {typeof value === "function"
              ? (input2: {payload:void}) =>
                  MenuContextProviders(value(input2), value10.cell, value11)
              : MenuContextProviders(value, value10.cell, value11)}
          </runtime.baseMenu.Root>
        </runtime.CloseOnActivityHideProvider>
      </runtime.MenuOpenerProvider>
    );
  }
  function ControlledMenuRoot(input: MenuRootProps): React.ReactElement {
    let {
        children: value,
        sheetTitle: value2,
        backLabel: value3,
        closeLabel: value4,
        ...value5
      } = input,
      memo = reactForUiMenu.useMemo(
        () => ({
          sheetTitle: value2,
          backLabel: value3,
          closeLabel: value4,
        }),
        [value2, value3, value4],
      ),
      value6 = reactForUiMenu.useContext<boolean>(runtime.menuBarContext),
      { onOpenChange: value7, triggerRef: value8 } = (0,
      runtime.useTrackedMenuTrigger)(input.onOpenChange, value6),
      value9 = (0, runtime.usePassiveOpenState)(value7, input.open, !value6),
      value10 = (0, runtime.useControllableOpen)({
        ...input,
        onOpenChange: value9.onOpenChange,
      }),
      value11 = (0, runtime.useValueCapturedOnOpen)(
        value10.open,
        () => value9.cell.getLevel() === "declared",
        false,
      ),
      value12 = (0, runtime.useAdaptiveSheet)({
        open: value10.open,
        actionsRef: input.actionsRef,
        onOpenChange: value10.onOpenChange,
        onOpenChangeComplete: input.onOpenChangeComplete,
        structurallyAnchored: value11,
        closable: !(
          input.open !== undefined && input.onOpenChange === undefined
        ),
        refuseClose: refuseInnerMenuClose,
      });
    return (
      <runtime.MenuOpenerProvider value={value8}>
        <runtime.SheetContextProvider value={value12}>
          <runtime.menuSheetLabelsContext.Provider value={memo}>
            <runtime.baseMenu.Root<void>
              {...value5}
              modal={value6 ? undefined : (value12.modal ?? value5.modal)}
              actionsRef={value12.actionsRef}
              onOpenChange={value12.onOpenChange}
              onOpenChangeComplete={value12.onOpenChangeComplete}
            >
              {typeof value === "function"
                ? (input2: {payload:void}) =>
                    MenuContextProviders(
                      value(input2),
                      value9.cell,
                      value12.actionsRef,
                    )
                : MenuContextProviders(value, value9.cell, value12.actionsRef)}
            </runtime.baseMenu.Root>
          </runtime.menuSheetLabelsContext.Provider>
        </runtime.SheetContextProvider>
      </runtime.MenuOpenerProvider>
    );
  }
  function ResetQueryOnUnmount({ reset: reset }: { reset: () => void }): null {
    reactForUiMenu.useEffect(() => () => reset(), [reset]);
    return null;
  }
  function isMenuSearchEditingKey(input: SearchKeyEvent): boolean {
    let value = input.getModifierState("AltGraph");
    return (
      ((input.key.length === 1 && input.key !== " ") ||
        input.key === "Backspace" ||
        (input.key === "Delete" && !input.shiftKey)) &&
      (!input.ctrlKey || value) &&
      !input.metaKey &&
      (!input.altKey || value) &&
      input.keyCode !== 229
    );
  }
  function MenuSearchTriggerKeyboardBridge({
    inputRef: inputRef,
    applyKey: applyKey,
  }: {
    inputRef: React.RefObject<HTMLInputElement | null>;
    applyKey: (key: string) => void;
  }): null {
    let value = reactForUiMenu.useContext<MenuRootState | null>(
      runtime.menuTriggerContext,
    )?.triggerRef;
    reactForUiMenu.useEffect(() => {
      let value2 = value?.current;
      if (!value2) {
        return;
      }
      let callback = (event: KeyboardEvent): void => {
        if (event.isComposing || !isMenuSearchEditingKey(event)) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        inputRef.current?.focus({
          preventScroll: true,
        });
        applyKey(event.key);
      };
      value2.addEventListener("keydown", callback, true);
      return () => value2.removeEventListener("keydown", callback, true);
    }, [value, inputRef, applyKey]);
    return null;
  }
  function MenuSearchTriggerFocusBridge({
    inputRef: inputRef,
  }: {
    inputRef: React.RefObject<HTMLInputElement | null>;
  }): null {
    let value = reactForUiMenu.useContext<MenuRootState | null>(
      runtime.menuTriggerContext,
    );
    reactForUiMenu.useEffect(() => {
      let value2 = value?.triggerRef.current;
      if (!value || !value2) {
        return;
      }
      let { openRef: value3 } = value,
        callback = (input: FocusEvent): void => {
          let current = inputRef.current,
            value4 = (0, runtime.asElement)(input.relatedTarget);
          if (
            current &&
            value4 &&
            value3.current &&
            current.closest('[role="menu"]')?.contains(value4)
          ) {
            current.focus({
              preventScroll: true,
            });
          }
        };
      value2.addEventListener("focus", callback);
      return () => value2.removeEventListener("focus", callback);
    }, [value, inputRef]);
    reactForUiMenu.useEffect(() => {
      let callback = (): void => {
        let current = inputRef.current;
        if (!current) {
          return;
        }
        let ancestor = current.closest('[role="menu"]'),
          activeElement = current.ownerDocument.activeElement;
        if (ancestor?.contains(activeElement) && activeElement !== ancestor) {
          return;
        }
        current.focus({
          preventScroll: true,
        });
      };
      callback();
      let index = 0,
        index2 = 0,
        callback2 = () => {
          callback();
          index += 1;
          if (index < 2) {
            index2 = requestAnimationFrame(callback2);
          }
        };
      index2 = requestAnimationFrame(callback2);
      return () => cancelAnimationFrame(index2);
    }, [inputRef]);
    return null;
  }
  function MenuSearchablePopup({
    children: children,
    searchLabel: searchLabel,
    query: query,
    onQueryChange: onQueryChange,
    resetQueryOnClose = true,
    onSubmitQuery: onSubmitQuery,
    beforeSearch: beforeSearch,
    onKeyDown: onKeyDown,
    onFocus: onFocus,
    stableWhileOpen = true,
    ...props
  }: MenuSearchProps): React.ReactElement {
    let [value, value2] = reactForUiMenu.useState(""),
      value3 = query ?? value,
      value4: (input: string) => void = (0, runtime.useEventCallback)(
        (input: string) => {
          value2(input);
          onQueryChange?.(input);
        },
      ),
      value5 = (0, runtime.useEventCallback)(() => {
        if (value3 !== "") {
          value4("");
        }
      }),
      ref = reactForUiMenu.useRef(false);
    reactForUiMenu.useEffect(() => {
      return;
    }, [query, onQueryChange]);
    let value6 = (0, runtime.useIsSheet)(),
      value7 = (0, runtime.useMediaQuery__U)(
        (0, runtime.useRootWindow)(),
        runtime.COARSE_POINTER_QUERY_rG,
      ),
      value8 = !value6 && !value7,
      value9 =
        reactForUiMenu.useContext<React.RefObject<OverlayActions | null> | null>(
          runtime.menuIsOpenContext,
        ),
      value10 =
        reactForUiMenu.useContext<React.RefObject<OverlayActions | null> | null>(
          runtime.menuRootIdentityContext,
        ),
      value11 = value9 ?? value10,
      ref2 = reactForUiMenu.useRef<HTMLDivElement | null>(null),
      ref3 = reactForUiMenu.useRef<HTMLInputElement | null>(null),
      ref4 = reactForUiMenu.useRef<(() => void) | null>(null);
    reactForUiMenu.useEffect(() => () => ref4.current?.(), []);
    let callback = reactForUiMenu.useCallback((input: string) => {
        let current = ref3.current;
        if (!current) {
          return;
        }
        let { value: value12 } = current,
          value13 = current.selectionStart ?? value12.length,
          value14 = current.selectionEnd ?? value12.length,
          value15 = input === "Backspace" || input === "Delete",
          value16 = value15 ? "" : input;
        if (value15 && value13 === value14) {
          if (input === "Backspace") {
            let value19 = (value12.codePointAt(value13 - 2) ?? 0) > 65535;
            value13 = Math.max(0, value13 - (value19 ? 2 : 1));
          } else {
            let value19 = (value12.codePointAt(value14) ?? 0) > 65535;
            value14 = Math.min(value12.length, value14 + (value19 ? 2 : 1));
          }
        }
        let value17 =
            value12.slice(0, value13) + value16 + value12.slice(value14),
          value18 = current.ownerDocument.defaultView ?? window;
        Object.getOwnPropertyDescriptor(
          value18.HTMLInputElement.prototype,
          "value",
        )?.set?.call(current, value17);
        current.setSelectionRange(
          value13 + value16.length,
          value13 + value16.length,
        );
        current.dispatchEvent(
          new Event("input", {
            bubbles: true,
          }),
        );
      }, []),
      callback2 = () => {
        let current = ref2.current,
          value12 =
            current?.querySelector<HTMLElement>('[tabindex="0"]') ??
            current?.querySelector<HTMLElement>(
              'input, button, [role="radio"]',
            );
        if (!value12) {
          return false;
        }
        value12.focus();
        return true;
      };
    return (
      <MenuPopup
        {...props}
        stableWhileOpen={stableWhileOpen}
        onKeyDown={(event: MenuPopupKeyboardEvent) => {
          let current = ref3.current;
          if (
            !current ||
            (event.target as HTMLElement).closest?.(
              "input, textarea, [contenteditable]",
            ) ||
            event.nativeEvent.isComposing ||
            !isMenuSearchEditingKey(event)
          ) {
            onKeyDown?.(event);
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          event.preventBaseUIHandler();
          current.focus({
            preventScroll: true,
          });
          callback(event.key);
        }}
        onFocus={(event: MenuPopupFocusEvent) => {
          onFocus?.(event);
          let currentTarget = event.currentTarget,
            ownerDocument = currentTarget.ownerDocument;
          if (
            !value8 ||
            event.target !== currentTarget ||
            ownerDocument.activeElement !== currentTarget
          ) {
            return;
          }
          let value12 = (0, runtime.asElement)(event.relatedTarget);
          if (
            !(
              value12?.hasAttribute("data-popup-open") &&
              currentTarget.contains(value12)
            )
          ) {
            ref3.current?.focus({
              preventScroll: true,
            });
            return;
          }
          ref4.current?.();
          let callback3 = (event2: MouseEvent) => {
            let value13 = (0, runtime.asElement)(event2.target),
              value14 = value13?.closest('[role="menu"]'),
              bounds = currentTarget.getBoundingClientRect(),
              value15 =
                event2.clientX >= bounds.left &&
                event2.clientX < bounds.right &&
                event2.clientY >= bounds.top &&
                event2.clientY < bounds.bottom;
            if (!value14 && value15) {
              return;
            }
            ref4.current?.();
            if (
              !(
                value14 &&
                (value14 !== currentTarget ||
                  value13?.closest('[role^="menuitem"]'))
              ) &&
              ownerDocument.activeElement === currentTarget
            ) {
              ref3.current?.focus({
                preventScroll: true,
              });
            }
          };
          ownerDocument.addEventListener("mousemove", callback3);
          ref4.current = () => {
            ownerDocument.removeEventListener("mousemove", callback3);
            ref4.current = null;
          };
        }}
        onMouseDown={(event: React.MouseEvent<HTMLElement>) => {
          let target = event.target as HTMLElement;
          if (
            ((0, runtime.isHtmlElement)(target) &&
              target.localName === "input") ||
            target === event.currentTarget
          ) {
            return;
          }
          if (
            target.classList.contains("overflow-y-auto") &&
            (0, runtime.isScrollbarPointerPosition)(
              event.nativeEvent.offsetX,
              event.nativeEvent.offsetY,
              target,
            )
          ) {
            return;
          }
          event.preventDefault();
        }}
        header={
          <jsxForUiMenu.Fragment>
            {[
              beforeSearch !== undefined && (
                <div
                  ref={ref2}
                  role={"presentation"}
                  className={"px-sm pt-sm"}
                  onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
                    if (event.key === "Escape") {
                      return;
                    }
                    event.stopPropagation();
                    if (event.key === "Tab") {
                      event.preventDefault();
                      ref3.current?.focus();
                    }
                  }}
                >
                  {beforeSearch}
                </div>
              ),
              <runtime.TextInput
                ref={ref3}
                value={value3}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  value4(event.target.value)
                }
                onCompositionEnd={(
                  event: React.CompositionEvent<HTMLInputElement>,
                ) =>
                  (0, runtime.recordCompositionEnd)(event.nativeEvent.timeStamp)
                }
                onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
                  (0, runtime.resetCompositionSuppression)(event);
                  if (event.nativeEvent.isComposing || event.keyCode === 229) {
                    event.stopPropagation();
                    return;
                  }
                  if (event.key === "Enter") {
                    let value12 = value3.trim();
                    if (
                      onSubmitQuery !== undefined &&
                      value12 !== "" &&
                      !event.repeat &&
                      !event.shiftKey &&
                      !event.altKey
                    ) {
                      let callback3 = () => {
                        onSubmitQuery(value12);
                        value11?.current?.close?.();
                      };
                      if (
                        (0, runtime.shouldSuppressCompositionEnter)(
                          event.nativeEvent,
                        )
                      ) {
                        (0, runtime.suppressFollowupCompositionLineBreak)(
                          event.nativeEvent,
                          event.currentTarget,
                          callback3,
                        );
                      } else {
                        event.preventDefault();
                        callback3();
                      }
                    }
                    event.stopPropagation();
                    return;
                  }
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    let value12 = event.currentTarget
                        .closest('[role="menu"]')
                        ?.querySelectorAll<HTMLElement>(
                          '[role^="menuitem"]:not([aria-disabled="true"])',
                        ),
                      value13 =
                        event.key === "ArrowDown"
                          ? value12?.[0]
                          : value12?.[value12.length - 1];
                    if (value13 !== undefined) {
                      event.preventDefault();
                      event.stopPropagation();
                      value13.focus();
                    }
                    return;
                  }
                  if (event.key === "Tab" && !event.shiftKey && callback2()) {
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                  }
                  if (event.key === "Escape" || event.key === "Tab") {
                    return;
                  }
                  event.stopPropagation();
                }}
                placeholder={searchLabel}
                aria-label={searchLabel}
                autoComplete={"off"}
                data-1p-ignore={true}
                autoFocus={value8}
                tabIndex={value8 ? undefined : -1}
                className={
                  "!border-transparent !bg-transparent !shadow-none compact:!pl-2 comfortable:!pl-2.5"
                }
              />,
              <runtime.baseMenu.Separator
                className={"-mx-1 my-1 h-px bg-border"}
              />,
            ]}
          </jsxForUiMenu.Fragment>
        }
      >
        {[
          resetQueryOnClose && <ResetQueryOnUnmount reset={value5} />,
          value8 && <MenuSearchTriggerFocusBridge inputRef={ref3} />,
          <MenuSearchTriggerKeyboardBridge
            inputRef={ref3}
            applyKey={callback}
          />,
          children(value3.trim().toLowerCase(), value3.trim()),
        ]}
      </MenuPopup>
    );
  }
  function useFocusMenuAfterPending(
    input: React.RefObject<HTMLElement | null>,
    options: boolean,
  ): void {
    let ref = reactForUiMenu.useRef(options);
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      let value = input.current?.closest<HTMLElement>('[role="menu"]');
      if (!options || ref.current || !value?.hasAttribute("data-open")) {
        return;
      }
      let activeElement = value.ownerDocument.activeElement;
      if (
        activeElement === null ||
        activeElement === value.ownerDocument.body
      ) {
        value.focus({
          preventScroll: true,
        });
      }
    }, [input, options]);
    reactForUiMenu.useEffect(() => {
      let value = ref.current && !options;
      ref.current = options;
      let current = input.current;
      if (!value || !current) {
        return;
      }
      let value2 = requestAnimationFrame(() => {
        let element = current.querySelector<HTMLElement>(
            HIGHLIGHTED_MENU_ITEM_SELECTOR,
          ),
          ancestor = current.closest('[role="menu"]');
        if (
          element &&
          ancestor &&
          current.ownerDocument.activeElement === ancestor
        ) {
          element.focus({
            preventScroll: true,
          });
        }
      });
      return () => cancelAnimationFrame(value2);
    }, [input, options]);
  }
  function MenuPendingList({
    pending = false,
    loading = false,
    placeholderRows = 3,
    icon = false,
    children: children,
  }: MenuPendingProps): React.ReactElement {
    let ref = reactForUiMenu.useRef<HTMLDivElement | null>(null),
      ref2 = reactForUiMenu.useRef(emptyMenuSize);
    reactForUiMenu.useEffect(() => {
      let current = ref.current;
      if (!current || typeof ResizeObserver === "undefined") {
        return;
      }
      let observer = new ResizeObserver(() => {
        ref2.current = {
          width: current.offsetWidth,
          height: current.offsetHeight,
        };
      });
      observer.observe(current);
      return () => observer.disconnect();
    }, []);
    let value = pending || loading,
      [value2, value3] = reactForUiMenu.useState(emptyMenuSize);
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      let current = ref.current;
      if (!value || !current) {
        value3(emptyMenuSize);
        return;
      }
      value3(
        loading && ref2.current.height > 0
          ? ref2.current
          : {
              width: current.offsetWidth,
              height: current.offsetHeight,
            },
      );
    }, [value, loading]);
    let value4 = value && value2.height > 0;
    useFocusMenuAfterPending(ref, loading);
    return (
      <div
        ref={ref}
        aria-busy={value || undefined}
        style={
          value4
            ? {
                minWidth: value2.width,
                height: value2.height,
              }
            : undefined
        }
        className={value4 ? "overflow-hidden" : undefined}
      >
        {loading ? (
          <runtime.SkeletonGroup>
            <runtime.SkeletonPrimitive.Rows
              icon={icon}
              rows={
                value4
                  ? Math.ceil(value2.height / MENU_PLACEHOLDER_MINIMUM_WIDTH)
                  : placeholderRows
              }
            />
          </runtime.SkeletonGroup>
        ) : (
          children
        )}
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxo_",
    () => jsxo_,
    (value) => {
      jsxo_ = value;
    },
  );
  bindRuntimeValue(runtime, "MenuContextProviders", () => MenuContextProviders);
  bindRuntimeValue(runtime, "isNestedMenuEvent", () => isNestedMenuEvent);
  bindRuntimeValue(runtime, "isFocusOutEvent", () => isFocusOutEvent);
  bindRuntimeValue(
    runtime,
    "shouldRefuseNestedMenuClose",
    () => shouldRefuseNestedMenuClose,
  );
  bindRuntimeValue(
    runtime,
    "cancelNestedMenuClose",
    () => cancelNestedMenuClose,
  );
  bindRuntimeValue(
    runtime,
    "reacttM",
    () => reacttM,
    (value) => {
      reacttM = value;
    },
  );
  bindRuntimeValue(runtime, "extractReactText", () => extractReactText);
  bindRuntimeValue(runtime, "normalizeLabelText", () => normalizeLabelText);
  bindRuntimeValue(runtime, "useMenuItemLabel", () => useMenuItemLabel);
  bindRuntimeValue(
    runtime,
    "reactForUiMenu",
    () => reactForUiMenu,
    (value) => {
      reactForUiMenu = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiMenu",
    () => jsxForUiMenu,
    (value) => {
      jsxForUiMenu = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "numericShortcutPattern",
    () => numericShortcutPattern,
    (value) => {
      numericShortcutPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getShortcutNumeralClasses",
    () => getShortcutNumeralClasses,
  );
  bindRuntimeValue(runtime, "MenuShortcut", () => MenuShortcut);
  bindRuntimeValue(runtime, "useMenuPopupElement", () => useMenuPopupElement);
  bindRuntimeValue(
    runtime,
    "MenuPopup",
    () => MenuPopup,
    (value) => {
      MenuPopup = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MenuSheetCapablePopup",
    () => MenuSheetCapablePopup,
    (value) => {
      MenuSheetCapablePopup = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MenuItem",
    () => MenuItem,
    (value) => {
      MenuItem = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MenuSubmenuTrigger",
    () => MenuSubmenuTrigger,
    (value) => {
      MenuSubmenuTrigger = value;
    },
  );
  bindRuntimeValue(runtime, "MenuSubmenu", () => MenuSubmenu);
  bindRuntimeValue(runtime, "MenuSeparator", () => MenuSeparator);
  bindRuntimeValue(
    runtime,
    "menuGroupLabelClasses",
    () => menuGroupLabelClasses,
    (value) => {
      menuGroupLabelClasses = value;
    },
  );
  bindRuntimeValue(runtime, "MenuHeader", () => MenuHeader);
  bindRuntimeValue(runtime, "MenuGroupLabel", () => MenuGroupLabel);
  bindRuntimeValue(runtime, "isMenuItemList", () => isMenuItemList);
  bindRuntimeValue(runtime, "renderMenuItems", () => renderMenuItems);
  bindRuntimeValue(runtime, "getMenuCaretSize", () => getMenuCaretSize);
  bindRuntimeValue(runtime, "MenuCaret", () => MenuCaret);
  bindRuntimeValue(runtime, "MenuPopupContent", () => MenuPopupContent);
  bindRuntimeValue(runtime, "SimpleMenu", () => SimpleMenu);
  bindRuntimeValue(runtime, "MenuRootProviders", () => MenuRootProviders);
  bindRuntimeValue(runtime, "useDropdownMenu", () => useDropdownMenu);
  bindRuntimeValue(runtime, "refuseInnerMenuClose", () => refuseInnerMenuClose);
  bindRuntimeValue(runtime, "MenuRoot", () => MenuRoot);
  bindRuntimeValue(runtime, "ControlledMenuRoot", () => ControlledMenuRoot);
  bindRuntimeValue(
    runtime,
    "MenuTriggerButton",
    () => MenuTriggerButton,
    (value) => {
      MenuTriggerButton = value;
    },
  );
  bindRuntimeValue(runtime, "ResetQueryOnUnmount", () => ResetQueryOnUnmount);
  bindRuntimeValue(
    runtime,
    "isMenuSearchEditingKey",
    () => isMenuSearchEditingKey,
  );
  bindRuntimeValue(
    runtime,
    "MenuSearchTriggerKeyboardBridge",
    () => MenuSearchTriggerKeyboardBridge,
  );
  bindRuntimeValue(
    runtime,
    "MenuSearchTriggerFocusBridge",
    () => MenuSearchTriggerFocusBridge,
  );
  bindRuntimeValue(runtime, "MenuSearchablePopup", () => MenuSearchablePopup);
  bindRuntimeValue(
    runtime,
    "MENU_PLACEHOLDER_MINIMUM_WIDTH",
    () => MENU_PLACEHOLDER_MINIMUM_WIDTH,
    (value) => {
      MENU_PLACEHOLDER_MINIMUM_WIDTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "emptyMenuSize",
    () => emptyMenuSize,
    (value) => {
      emptyMenuSize = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HIGHLIGHTED_MENU_ITEM_SELECTOR",
    () => HIGHLIGHTED_MENU_ITEM_SELECTOR,
    (value) => {
      HIGHLIGHTED_MENU_ITEM_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useFocusMenuAfterPending",
    () => useFocusMenuAfterPending,
  );
  bindRuntimeValue(runtime, "MenuPendingList", () => MenuPendingList);
  bindRuntimeValue(
    runtime,
    "MenuBar",
    () => MenuBar,
    (value) => {
      MenuBar = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "Menu",
    () => Menu,
    (value) => {
      Menu = value;
    },
  );
  return () => {
    (0, runtime.initializeMenuContexts)();
    (0, runtime.initializeKeyboardContextMenuFocus)();
    (0, runtime.initializeMenuScrollContent)();
    (0, runtime.initializeContextMenuPopup)();
    (0, runtime.initializePassiveOpen)();
    (0, runtime.initializeMenuItemVariants)();
    (0, runtime.initializeMenuOpener)();
    (0, runtime.initializeTooltip)();
    (0, runtime.initializeMenuContexts)();
    (0, runtime.initializePassiveOpen)();
    (0, runtime.initializeMenuOpener)();
    jsxo_ = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    (0, runtime.initializeMenuPopupElement)();
    (0, runtime.initializeElementAccess)();
    (0, runtime.initializeStablePopupPlacement)();
    (0, runtime.initializeIsomorphicLayoutEffect)();
    reacttM = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    reactForUiMenu = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxForUiMenu = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    numericShortcutPattern = /^\d+$/;
    MenuPopup = reactForUiMenu.forwardRef(
      (
        {
          align = "start",
          stableWhileOpen = false,
          "data-cds": dataCds = "Menu",
          ...props
        }: MenuPopupProps,
        options: React.ForwardedRef<HTMLDivElement>,
      ): React.ReactElement => {
        let state = {
            align: align,
            stableWhileOpen: stableWhileOpen,
            "data-cds": dataCds,
            ...props,
          },
          value = (0, runtime.useHasSheetFrame)(),
          value2 = useMenuPopupElement(state, options, !value, false);
        if (value) {
          return <MenuSheetCapablePopup {...state} ref={options} />;
        }
        return value2;
      },
    );
    MenuPopup.displayName = "Menu.Popup";
    MenuSheetCapablePopup = reactForUiMenu.forwardRef(
      (
        input: MenuPopupProps,
        options: React.ForwardedRef<HTMLDivElement>,
      ): React.ReactElement => {
        let value = (0, runtime.useSheetImplementation)(),
          { pending: value2 } = (0, runtime.useSheetState)(),
          value3 = reactForUiMenu.useContext<MenuRootState | null>(
            runtime.menuTriggerContext,
          ),
          value4: import("../contracts/overlays").OverlayKind =
            reactForUiMenu.useContext<boolean>(runtime.contextMenuContext) &&
            value3 === null
              ? "contextmenu"
              : "menu",
          value5 = useMenuPopupElement(
            input,
            options,
            value === null,
            value === null && value2,
          );
        if (value !== null) {
          return <value.MenuSheetPopup {...input} ref={options} />;
        }
        return (
          <jsxForUiMenu.Fragment>
            {[
              value5,
              value2 && value3 === null ? (
                <runtime.PendingSheetBackdrop kind={value4} />
              ) : null,
            ]}
          </jsxForUiMenu.Fragment>
        );
      },
    );
    MenuSheetCapablePopup.displayName = "MenuSheetCapablePopup";
    MenuItem = reactForUiMenu.forwardRef(
      (
        {
          variant: variant,
          icon: icon,
          shortcut: shortcut,
          checked: checked,
          checkedRole: checkedRole,
          checkPosition: checkPosition,
          indicator = "check",
          indeterminate: indeterminate,
          hint: hint,
          description: description,
          disabledReason: disabledReason,
          href: href,
          routerOptions: routerOptions,
          target: target,
          rel: rel,
          download: download,
          keepOpen: keepOpen,
          focusesNothing: focusesNothing,
          leading: leading,
          trailing: trailing,
          className: className,
          children: children,
          ...props
        }: MenuItemProps,
        options: React.ForwardedRef<HTMLDivElement>,
      ): React.ReactElement => {
        let value = indicator === "checkbox",
          value2 = value
            ? href !== undefined
              ? undefined
              : (checked ?? false)
            : checked,
          value3 = value ? "checkbox" : (checkedRole ?? "checkbox"),
          value4 = checkPosition ?? (value ? "leading" : "trailing"),
          value5 = (0, runtime.useAppleKeyboard)(),
          value6 = reactForUiMenu.useId(),
          {
            label: value7,
            labelSpanRef: value8,
            rowRef: value9,
          } = useMenuItemLabel(children, props.label),
          value10 = (0, runtime.useMergedRefs)(options, value9),
          value11 =
            props.disabled === true &&
            (0, runtime.hasDisabledReason)(disabledReason),
          state = {
            "aria-keyshortcuts": shortcut
              ? (0, runtime.shortcutToAriaKeyShortcuts)(shortcut, value5)
              : undefined,
            "data-cds-icon-row":
              icon !== undefined &&
              !(value2 !== undefined && value4 === "leading")
                ? ""
                : undefined,
            [runtime.FOCUSES_NOTHING_ATTRIBUTE]: focusesNothing
              ? ""
              : undefined,
            ...props,
            label: value7,
            "aria-describedby":
              [value11 ? value6 : undefined, props["aria-describedby"]]
                .filter(Boolean)
                .join(" ") || undefined,
          },
          value12 = (0, runtime.useMenuPassiveFocusProps)(),
          callback = (input: React.ReactElement): React.ReactElement =>
            disabledReason === undefined ? (
              input
            ) : (
              <runtime.Tooltip
                content={value11 ? disabledReason : undefined}
                side={"right"}
                multiline={true}
                closeOnClick={false}
              >
                <div role={"none"}>
                  {[
                    input,
                    <runtime.DisabledReasonAnnouncement
                      id={value6}
                      reason={value11 ? disabledReason : undefined}
                    />,
                  ]}
                </div>
              </runtime.Tooltip>
            ),
          value13 = (0, runtime.useCdsLink)({
            href: href,
            routerOptions: routerOptions,
            target: target,
            rel: rel,
            download: download,
            ...(0, runtime.pickLinkEventProps)(props),
          }),
          value14 = (0, runtime.cn)(
            (0, runtime.menuItemVariants)({
              variant: variant,
            }),
            description ? `${runtime.menuItemDescriptionPaddingClass} ` : "",
            className,
          ),
          value15 = value2 !== undefined && (
            <span
              className={(0, runtime.clsx)(
                "flex size-icon shrink-0 items-center justify-center",
                value4 === "trailing" && !hint && !shortcut && "-mr-1",
                Boolean(value4 === "trailing" && shortcut && !hint) &&
                  "pointer-coarse:-mr-1",
                value &&
                  value4 === "leading" &&
                  "-ml-1 group-has-[[data-cds-icon-row]]/menu-popup:ml-0",
              )}
              style={
                value
                  ? undefined
                  : {
                      color: "var(--cds-fill-accent)",
                    }
              }
            >
              {value ? (
                <span data-size={"xs"} className={"flex shrink-0"}>
                  <runtime.CheckboxVisual
                    checked={value2}
                    indeterminate={indeterminate}
                  />
                </span>
              ) : (
                value2 && (
                  <runtime.Icon name={"Check"} size={"auto"} bold={true} />
                )
              )}
            </span>
          ),
          value16 = (
            <jsxForUiMenu.Fragment>
              {[
                leading,
                value4 === "leading" && value15,
                icon !== undefined && <runtime.IconSlot icon={icon} />,
                description ? (
                  <span className={"flex min-w-0 flex-1 flex-col"}>
                    {[
                      <span ref={value8} className={"truncate"}>
                        {children}
                      </span>,
                      <span
                        className={
                          "truncate py-[0.125em] -my-[0.125em] text-footnote text-muted group-data-[highlighted]/menu-danger:text-on-danger"
                        }
                      >
                        {description}
                      </span>,
                    ]}
                  </span>
                ) : (
                  <span ref={value8} className={"min-w-0 flex-1 truncate"}>
                    {children}
                  </span>
                ),
                Boolean(
                  trailing ||
                    (value2 !== undefined && value4 === "trailing") ||
                    hint ||
                    shortcut,
                ) && (
                  <span
                    className={(0, runtime.clsx)(
                      "ml-md flex shrink-0 items-center gap-xs",
                      Boolean(
                        shortcut &&
                          !trailing &&
                          !(value2 !== undefined && value4 === "trailing") &&
                          !hint,
                      ) && "pointer-coarse:hidden",
                    )}
                  >
                    {[
                      trailing,
                      value4 === "trailing" && value15,
                      hint && (
                        <span
                          className={`max-w-[160px] shrink-0 truncate py-[0.125em] -my-[0.125em] text-footnote text-muted group-data-[highlighted]/menu-danger:text-on-danger ${getShortcutNumeralClasses(hint)}`}
                        >
                          {hint}
                        </span>
                      ),
                      shortcut && <MenuShortcut keys={shortcut} />,
                    ]}
                  </span>
                ),
              ]}
            </jsxForUiMenu.Fragment>
          );
        if (href !== undefined) {
          let value17 = (0, runtime.omitLinkEventProps)(state);
          return callback(
            <runtime.baseMenu.Item
              ref={value10}
              {...value17}
              {...value12}
              closeOnClick={keepOpen ? false : undefined}
              className={value14}
              render={<a {...value13} />}
            >
              {value16}
            </runtime.baseMenu.Item>,
          );
        }
        if (value2 !== undefined) {
          if (value3 === "radio") {
            return callback(
              <runtime.baseMenu.Item
                ref={value10}
                {...state}
                {...value12}
                role={"menuitemradio"}
                aria-checked={value2}
                closeOnClick={keepOpen ? false : undefined}
                className={value14}
              >
                {value16}
              </runtime.baseMenu.Item>,
            );
          }
          return callback(
            <runtime.baseMenu.CheckboxItem
              ref={value10}
              {...state}
              {...(value && indeterminate
                ? {
                    "aria-checked": "mixed",
                  }
                : {})}
              {...value12}
              checked={value2}
              closeOnClick={value ? false : !keepOpen}
              className={value14}
            >
              {value16}
            </runtime.baseMenu.CheckboxItem>,
          );
        }
        return callback(
          <runtime.baseMenu.Item
            ref={value10}
            {...state}
            {...value12}
            closeOnClick={keepOpen ? false : undefined}
            className={value14}
          >
            {value16}
          </runtime.baseMenu.Item>,
        );
      },
    );
    MenuItem.displayName = "Menu.Item";
    MenuSubmenuTrigger = reactForUiMenu.forwardRef(
      (
        {
          icon: icon,
          leading: leading,
          hint: hint,
          trailing: trailing,
          className: className,
          children: children,
          openOnHover: openOnHover,
          ...props
        }: MenuSubmenuTriggerProps,
        options: React.ForwardedRef<HTMLDivElement>,
      ): React.ReactElement => {
        let value = reactForUiMenu.useContext<MenuRootState | null>(
            runtime.menuTriggerContext,
          ),
          value2 = (0, runtime.useIsSheet)(),
          value3 = (0, runtime.useMenuPassiveFocusProps)(),
          {
            label: value4,
            labelSpanRef: value5,
            rowRef: value6,
          } = useMenuItemLabel(children, props.label),
          value7 = (0, runtime.useMergedRefs)(
            value?.setTriggerNode,
            options,
            value6,
          ),
          value8 = value?.stashLabel;
        (0, runtime.useIsomorphicLayoutEffect)(() => {
          if (value2) {
            value8?.(children);
          }
        }, [value2, value8, children]);
        return (
          <runtime.baseMenu.SubmenuTrigger
            ref={value7}
            data-cds-icon-row={icon !== undefined ? "" : undefined}
            {...props}
            label={value4}
            {...value3}
            openOnHover={value2 ? false : openOnHover}
            className={(0, runtime.cn)(
              (0, runtime.menuItemVariants)({
                variant: "default",
              }),
              "justify-between data-[popup-open]:bg-fill-ghost-hover",
              className,
            )}
          >
            {[
              leading,
              icon !== undefined && <runtime.IconSlot icon={icon} />,
              <span ref={value5} className={"min-w-0 flex-1 truncate"}>
                {children}
              </span>,
              trailing || hint ? (
                <span className={"ml-md flex shrink-0 items-center gap-xs"}>
                  {[
                    trailing,
                    hint && (
                      <span
                        className={`max-w-[160px] shrink-0 truncate py-[0.125em] -my-[0.125em] text-footnote text-muted ${getShortcutNumeralClasses(hint)}`}
                      >
                        {hint}
                      </span>
                    ),
                    <runtime.Icon
                      name={"CaretRight"}
                      size={"sm"}
                      className={"-mr-1 shrink-0 text-muted"}
                    />,
                  ]}
                </span>
              ) : (
                <runtime.Icon
                  name={"CaretRight"}
                  size={"sm"}
                  className={"-mr-1 shrink-0 text-muted"}
                />
              ),
            ]}
          </runtime.baseMenu.SubmenuTrigger>
        );
      },
    );
    MenuSubmenuTrigger.displayName = "Menu.SubmenuTrigger";
    (
      MenuSubmenu as typeof MenuSubmenu & {
        displayName?: string;
      }
    ).displayName = "Menu.Submenu";
    (
      MenuSeparator as typeof MenuSeparator & {
        displayName?: string;
      }
    ).displayName = "Menu.Separator";
    menuGroupLabelClasses =
      "compact:px-2 comfortable:px-2.5 py-1 text-footnote font-medium text-muted";
    (
      MenuHeader as typeof MenuHeader & {
        displayName?: string;
      }
    ).displayName = "Menu.Header";
    (
      MenuGroupLabel as typeof MenuGroupLabel & {
        displayName?: string;
      }
    ).displayName = "Menu.GroupLabel";
    (
      SimpleMenu as typeof SimpleMenu & {
        displayName?: string;
      }
    ).displayName = "Menu";
    (
      MenuRoot as typeof MenuRoot & {
        displayName?: string;
      }
    ).displayName = "Menu.Root";
    MenuTriggerButton = reactForUiMenu.forwardRef(function (
      { children: children, id: id, ...props }: MenuTriggerButtonProps,
      options: React.ForwardedRef<HTMLButtonElement>,
    ): React.ReactElement {
      return (
        <runtime.baseMenu.Trigger
          id={id}
          disabled={props.disabled || props.busy}
          render={
            <runtime.Button
              ref={options}
              {...props}
              {...(props.busy
                ? {
                    disabled: props.disabled,
                  }
                : undefined)}
            >
              {[children, <MenuCaret size={props.size} />]}
            </runtime.Button>
          }
        />
      );
    });
    MenuTriggerButton.displayName = "Menu.TriggerButton";
    (
      MenuSearchablePopup as typeof MenuSearchablePopup & {
        displayName?: string;
      }
    ).displayName = "Menu.SearchablePopup";
    MENU_PLACEHOLDER_MINIMUM_WIDTH = 20;
    emptyMenuSize = {
      width: 0,
      height: 0,
    };
    HIGHLIGHTED_MENU_ITEM_SELECTOR = '[data-highlighted][tabindex="0"]';
    (
      MenuPendingList as typeof MenuPendingList & {
        displayName?: string;
      }
    ).displayName = "Menu.PendingList";
    MenuBar = reactForUiMenu.forwardRef(function (
      {
        className: className,
        ...props
      }: import("@base-ui/react/menubar").Menubar.Props,
      options: React.ForwardedRef<HTMLDivElement>,
    ): React.ReactElement {
      return (
        <runtime.menuBarContext.Provider value={true}>
          <runtime.baseMenubarRoot
            ref={options}
            data-cds={"MenuBar"}
            {...props}
            className={(0, runtime.cn)("flex items-center gap-xs", className)}
          />
        </runtime.menuBarContext.Provider>
      );
    });
    MenuBar.displayName = "Menu.Bar";
    Menu = Object.assign(SimpleMenu, {
      Root: MenuRoot,
      Bar: MenuBar,
      Trigger: runtime.baseMenu.Trigger,
      TriggerButton: MenuTriggerButton,
      Popup: MenuPopup,
      Item: MenuItem,
      Separator: MenuSeparator,
      Group: runtime.baseMenu.Group,
      GroupLabel: MenuGroupLabel,
      Header: MenuHeader,
      Submenu: MenuSubmenu,
      SubmenuTrigger: MenuSubmenuTrigger,
      SearchablePopup: MenuSearchablePopup,
      PendingList: MenuPendingList,
    });
    (0, runtime.initializeIsomorphicLayoutEffect)();
    (0, runtime.initializeClassNames)();
    (0, runtime.initializeCdsRoot)();
    (0, runtime.initializeElementAccess)();
    (0, runtime.initializeLayers)();
    (0, runtime.initializeOverlaySelector)();
    (0, runtime.initializeCloseOnActivityHide)();
    (0, runtime.initializeMergedRefs)();
    (0, runtime.initializePortalRoot)();
    (0, runtime.initializeSurfaces)();
    (0, runtime.initializeOverlayActions)();
    (0, runtime.initializeVisualKeyboard)();
  };
}
