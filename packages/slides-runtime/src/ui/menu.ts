/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactDomNamespace,
  type ReactNamespace,
} from "../bindings";
import type {
  ChangeEvent,
  CompositionEvent,
  Context,
  CSSProperties,
  ElementType,
  FocusEvent as ReactFocusEvent,
  ForwardRefExoticComponent,
  ForwardedRef,
  InputHTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  ReactNode,
  ReactPortal,
  Ref,
  RefAttributes,
  RefObject,
} from "react";
import type { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import type { Menu as BaseMenu } from "@base-ui/react/menu";
import type { Menubar as BaseMenubar } from "@base-ui/react/menubar";
import type { Popover as BasePopover } from "@base-ui/react/popover";
import type { BaseUIEvent } from "@base-ui/react/types";
import type { ButtonProps, ButtonSize } from "./disclosure";
import type {
  ControllableOpenProps,
  OverlayActions,
  SheetHost,
  SheetImplementation,
  SheetOpenChangeDetails,
} from "./foundation";
import type {
  CollisionPadding,
  ContainerSource,
  MenuRootIdentity,
  OverlayLayerKind,
} from "./interactions";
import type { PassiveInitialFocus } from "./overlays";

/** Invalid/disabled state a field publishes to the inputs inside it. */
export interface FieldStateContextValue {
  invalid: boolean;
  disabled: boolean;
}

/** The parts of a key event that decide whether IME composition suppression is reset. */
export interface CompositionKeyEvent {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  keyCode: number;
  isComposing?: boolean;
  nativeEvent?: { isComposing?: boolean };
}

/** Anything with the one method the focus-prevention handlers call. */
interface PreventableEvent {
  preventDefault: () => void;
}

/** The passive-open state a menu root publishes to its popups. */
export type PassiveOpenCell = ReturnType<RuntimeBindings["usePassiveOpenState"]>["cell"];

/** Width and height a pending menu list holds while it loads. */
export interface MenuSize {
  width: number;
  height: number;
}

type MenuPositionerProps = BaseMenu.Positioner.Props;

/** Where a menu opens relative to its trigger, and where focus goes when it closes. */
export interface MenuPlacementProps {
  side?: MenuPositionerProps["side"];
  align?: MenuPositionerProps["align"];
  sideOffset?: MenuPositionerProps["sideOffset"];
  collisionPadding?: CollisionPadding;
  finalFocus?: BaseMenu.Popup.Props["finalFocus"];
}

/** Props of a menu popup: Base UI popup props plus placement and scroll-area options. */
export interface MenuPopupProps
  extends MenuPlacementProps,
    Omit<BaseMenu.Popup.Props, "finalFocus" | "className" | "children"> {
  anchor?: MenuPositionerProps["anchor"];
  collisionAvoidance?: MenuPositionerProps["collisionAvoidance"];
  container?: ContainerSource | null;
  className?: string;
  children?: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  maxVisibleItems?: number;
  layerOffset?: number;
  stableWhileOpen?: boolean;
  "data-cds"?: string;
  initialFocus?: PassiveInitialFocus;
}

/** A row description for `Menu` `items`. */
export interface MenuItemDescriptor {
  label?: ReactNode;
  icon?: ReactNode;
  hint?: string;
  items?: MenuEntry[];
  separatorBefore?: boolean;
  disabled?: boolean;
  shortcut?: string;
  variant?: "default" | "danger";
  checked?: boolean;
  checkedRole?: "checkbox" | "radio";
  indicator?: "check" | "checkbox";
  indeterminate?: boolean;
  description?: ReactNode;
  disabledReason?: ReactNode;
  keepOpen?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  routerOptions?: object;
  target?: string;
  onSelect?: MenuItemProps["onClick"];
}

export type MenuEntry = "separator" | MenuItemDescriptor;

/** Labels a menu shows when it is presented as a bottom sheet. */
export interface MenuSheetLabelProps {
  sheetTitle?: string;
  backLabel?: string;
  closeLabel?: string;
}

/** Props of the `Menu` convenience component: a trigger button plus a list of `items`. */
export interface SimpleMenuProps extends MenuPlacementProps, MenuSheetLabelProps {
  items?: MenuEntry[];
  /** `"context-menu"` opens the menu from a right click; omit for a dropdown. */
  trigger?: "context-menu";
  open?: boolean;
  disabled?: boolean;
  className?: string;
  style?: ButtonProps["style"];
  "data-cds"?: string;
  children?: ReactNode;
  renderTrigger?: ReactElement;
  iconOnly?: boolean;
  tooltip?: boolean | string;
  "aria-label"?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  icon?: ReactNode;
  iconPosition?: ButtonProps["iconPosition"];
  pressed?: boolean;
  disabledReason?: ReactNode;
  disabledReasonSide?: string;
  label?: ReactNode;
  onOpenChange?: (open: boolean, details: BaseMenu.Root.ChangeEventDetails) => void;
}

/** What Base UI hands a render-function child of a menu root. */
export interface MenuRenderState {
  payload: unknown;
}

/** Props of `Menu.Root`: Base UI root props that also accept sheet labels. */
export interface MenuRootProps
  extends Omit<BaseMenu.Root.Props, "actionsRef" | "children">,
    MenuSheetLabelProps {
  actionsRef?: Ref<OverlayActions>;
  children?: ReactNode | ((state: MenuRenderState) => ReactNode);
}

export interface MenuSubmenuProps extends Omit<BaseMenu.SubmenuRoot.Props, "actionsRef"> {
  actionsRef?: Ref<OverlayActions>;
}

export interface MenuHeaderProps {
  children?: ReactNode;
  className?: string;
}

export interface MenuCaretProps {
  size?: ButtonSize;
}

export interface MenuPopupContentProps extends MenuPlacementProps {
  dataCds?: string;
  items?: MenuEntry[];
}

/** Open-change callback; bivariant so handlers written against narrower or wider details are accepted. */
export type SheetOpenChangeHandler = {
  bivarianceHack(open: boolean, details: SheetOpenChangeDetails): void;
}["bivarianceHack"];

/** What `useDropdownMenu` needs beyond the menu props. */
export interface DropdownMenuContext {
  triggerRef: RefObject<Element | null>;
  onOpenChange: SheetOpenChangeHandler;
  onOpenChangeComplete?: (open: boolean) => void;
  actionsRef: RefObject<OverlayActions | null>;
  contextMenuOnOpenChange?: SheetOpenChangeHandler;
  sheetCapable?: boolean;
  inMenuBar: boolean;
}

/** The parts of a key event that decide whether a menu search field takes the key. */
export type MenuSearchKeyEvent = Pick<
  KeyboardEvent,
  | "getModifierState"
  | "key"
  | "shiftKey"
  | "ctrlKey"
  | "metaKey"
  | "altKey"
  | "keyCode"
>;

export interface MenuSearchablePopupProps extends Omit<MenuPopupProps, "children" | "header"> {
  children: (query: string, rawQuery: string) => ReactNode;
  searchLabel?: string;
  query?: string;
  onQueryChange?: (query: string) => void;
  resetQueryOnClose?: boolean;
  onSubmitQuery?: (query: string) => void;
  beforeSearch?: ReactNode;
}

export interface MenuPendingListProps {
  pending?: boolean;
  loading?: boolean;
  placeholderRows?: number;
  icon?: boolean;
  children?: ReactNode;
}

export interface CheckboxVisualProps {
  checked?: boolean;
  indeterminate?: boolean;
  className?: string;
}

export interface AdaptiveSheetPopupHostProps {
  kind: OverlayLayerKind;
  children: (host: SheetHost, parts: SheetImplementation | null) => ReactNode;
}

/** The lazily loaded sheet module, with the popover pieces `Popover.Popup` renders in a sheet. */
export interface PopoverSheetParts extends SheetImplementation {
  PopoverSheetBackdrop: ElementType;
  PopoverSheetContent: ElementType;
}

type PopoverAnchor = BasePopover.Positioner.Props["anchor"];

/** What a popover root tracks about its popup, to decide when focus-out may close it. */
export interface PopoverMountState {
  popupMounted: boolean;
  declinesFocus: boolean;
  anchor: PopoverAnchor;
  triggerEl: HTMLElement | null;
}

export interface PopoverMountStore {
  update: (patch: Partial<PopoverMountState>) => void;
  read: () => PopoverMountState;
}

export interface PopoverRootProps extends Omit<BasePopover.Root.Props, "actionsRef"> {
  actionsRef?: Ref<OverlayActions>;
}

export interface ControlledPopoverRootProps extends Omit<PopoverRootProps, "onOpenChange"> {
  onOpenChange?: (open: boolean, details: SheetOpenChangeDetails) => void;
  consumerHandlesOpenChange: boolean;
}

interface DisplayNamed {
  displayName?: string;
}

/** Props of `TextInput`: a native input with optional start/end slots and a clear button. */
export interface TextInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "className"> {
  className?: string;
  size?: ButtonSize;
  fullWidth?: boolean;
  slotStart?: ReactNode;
  slotEnd?: ReactNode;
  clearable?: boolean | "always";
  onClear?: () => void;
  clearLabel?: string;
}

export type TextInputComponent = ForwardRefExoticComponent<
  TextInputProps & RefAttributes<HTMLInputElement>
>;

/** Props of `Menu.Item`: Base UI item props plus the check, link and layout options. */
export interface MenuItemProps extends Omit<BaseMenu.Item.Props, "className" | "children"> {
  variant?: "default" | "danger";
  icon?: ReactNode;
  shortcut?: string;
  checked?: boolean;
  checkedRole?: "checkbox" | "radio";
  checkPosition?: "leading" | "trailing";
  indicator?: "check" | "checkbox";
  indeterminate?: boolean;
  hint?: string;
  description?: ReactNode;
  disabledReason?: ReactNode;
  href?: string;
  routerOptions?: object;
  target?: string;
  rel?: string;
  download?: boolean | string;
  keepOpen?: boolean;
  focusesNothing?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export interface MenuSubmenuTriggerProps
  extends Omit<BaseMenu.SubmenuTrigger.Props, "className" | "children"> {
  icon?: ReactNode;
  leading?: ReactNode;
  hint?: string;
  trailing?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export interface MenuTriggerButtonProps extends ButtonProps {
  id?: string;
}

export interface MenuBarProps extends Omit<BaseMenubar.Props, "className"> {
  className?: string;
}

export type MenuPopupComponent = ForwardRefExoticComponent<
  MenuPopupProps & RefAttributes<HTMLDivElement>
>;
export type MenuItemComponent = ForwardRefExoticComponent<
  MenuItemProps & RefAttributes<HTMLElement>
>;
export type MenuSubmenuTriggerComponent = ForwardRefExoticComponent<
  MenuSubmenuTriggerProps & RefAttributes<HTMLElement>
>;
export type MenuTriggerButtonComponent = ForwardRefExoticComponent<
  MenuTriggerButtonProps & RefAttributes<HTMLElement>
>;
export type MenuBarComponent = ForwardRefExoticComponent<
  MenuBarProps & RefAttributes<HTMLDivElement>
>;

/** `Menu`: the convenience component, with the menu parts attached as properties. */
export interface MenuComponent {
  (props: SimpleMenuProps): ReactElement;
  displayName?: string;
  Root: (props: MenuRootProps) => ReactElement;
  Bar: MenuBarComponent;
  Trigger: typeof BaseMenu.Trigger;
  TriggerButton: MenuTriggerButtonComponent;
  Popup: MenuPopupComponent;
  Item: MenuItemComponent;
  Separator: () => ReactElement;
  Group: typeof BaseMenu.Group;
  GroupLabel: (props: MenuHeaderProps) => ReactElement;
  Header: (props: MenuHeaderProps) => ReactElement;
  Submenu: (props: MenuSubmenuProps) => ReactElement;
  SubmenuTrigger: MenuSubmenuTriggerComponent;
  SearchablePopup: (props: MenuSearchablePopupProps) => ReactElement;
  PendingList: (props: MenuPendingListProps) => ReactElement;
}

export type PopoverPadding = "none" | "xs" | "sm" | "md" | "lg";

/** Props of `Popover.Popup`. */
export interface PopoverPopupProps extends Omit<BasePopover.Popup.Props, "className" | "children"> {
  side?: BasePopover.Positioner.Props["side"];
  align?: BasePopover.Positioner.Props["align"];
  sideOffset?: BasePopover.Positioner.Props["sideOffset"];
  alignOffset?: BasePopover.Positioner.Props["alignOffset"];
  anchor?: PopoverAnchor;
  collisionPadding?: CollisionPadding;
  padding?: PopoverPadding;
  scrollFade?: boolean;
  layerOffset?: number;
  closeLabel?: string;
  sheetHeight?: string;
  keepFocus?: boolean;
  className?: string;
  children?: ReactNode;
}

interface PopoverPopupViewProps extends PopoverPopupProps {
  sheetPopup: SheetHost;
  sheetParts: PopoverSheetParts | null;
}

interface PopoverPopupInnerProps extends Omit<BasePopover.Popup.Props, "className" | "children"> {
  anchored: boolean;
  className?: string;
  children?: ReactNode;
}

export type PopoverPopupComponent = ForwardRefExoticComponent<
  PopoverPopupProps & RefAttributes<HTMLDivElement>
>;
export type PopoverTriggerComponent = ForwardRefExoticComponent<
  BasePopover.Trigger.Props & RefAttributes<HTMLElement>
>;

/** `Popover`: the root with the popover parts attached. */
export interface PopoverNamespace {
  Root: (props: PopoverRootProps) => ReactElement;
  Trigger: PopoverTriggerComponent;
  Popup: PopoverPopupComponent;
  Title: typeof BasePopover.Title;
  Description: typeof BasePopover.Description;
  Close: typeof BasePopover.Close;
  Arrow: typeof BasePopover.Arrow;
  createHandle: typeof BasePopover.createHandle;
}

/** Props of `Checkbox`: Base UI checkbox props plus a label, description and size. */
export interface CheckboxProps extends Omit<BaseCheckbox.Root.Props, "className"> {
  label?: ReactNode;
  description?: ReactNode;
  size?: ButtonSize;
  className?: string;
  disabledReason?: ReactNode;
}

export type CheckboxComponent = ForwardRefExoticComponent<
  CheckboxProps & RefAttributes<HTMLButtonElement>
>;

/** What a menu row needs to name itself: the label text and the elements it was measured from. */
export interface MenuItemLabel {
  label: string | undefined;
  labelSpanRef: RefObject<HTMLElement | null>;
  rowRef: RefObject<HTMLElement | null>;
}
/** Overlays nested in a popover and the open-change handler that lets them close first. */
export interface PopoverOverlayStack {
  innerOverlays: ReturnType<RuntimeBindings["createOverlayStack"]>;
  onOpenChange: (open: boolean, details: BasePopover.Root.ChangeEventDetails) => void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactiK: ReactNamespace;
    reactForUiMenu: ReactNamespace;
    jsxForUiMenu: JsxNamespace;
    reactiZ: ReactNamespace;
    jsxZu: JsxNamespace;
    reactDOMrG0: ReactDomNamespace;
    jsxsM: JsxNamespace;
    jsxo_: JsxNamespace;
    reacttM: ReactNamespace;
    reacta0: ReactNamespace;
    jsxC0: JsxNamespace;
    jsxtK: JsxNamespace;
    reactD6: ReactNamespace;
    jsxU7: JsxNamespace;
    reactForUiMenu2: ReactNamespace;
    jsxForUiMenu2: JsxNamespace;
    textFieldStateContext: Context<FieldStateContextValue | null>;
    initializeUiMenu: () => void;
    initializeUiMenu2: () => void;
    initializeUiMenu3: () => void;
    initializeUiMenu4: () => void;
    initializeUiMenu5: () => void;
    initializeUiMenu6: () => void;
    initializeUiMenu7: () => void;
    initializeUiMenu8: () => void;
    initializeUiMenu9: () => void;
    initializeUiMenu10: () => void;
    initializeUiMenu11: () => void;
    initializeUiMenu12: () => void;
    TextInput_oE0: string;
    TEXT_INPUT_CLEAR_CLASS: string;
    TEXT_INPUT_CLUSTER_CLASS: string;
    TEXT_INPUT_ICON_CLASS: string;
    TEXT_INPUT_CLEAR_BUTTON_CLASS: string;
    TextInput: TextInputComponent;
    SHEET_PENDING_ATTRIBUTE: string;
    concealedPopupStyle: CSSProperties;
    preventPendingSheetFocus: (event: PreventableEvent) => void;
    COMPOSITION_TIME_SENTINEL: number;
    lastCompositionEndTime: number;
    suppressedCompositionEvents: WeakSet<Event>;
    compositionLineBreakInputTypes: Set<string>;
    compositionSuppressionResetEvents: string[];
    checkboxVisualClasses: string;
    CHECKBOX_MARK_CLASS: string;
    CheckboxMark: string;
    numericShortcutPattern: RegExp;
    MenuPopup: MenuPopupComponent;
    MenuSheetCapablePopup: MenuPopupComponent;
    MenuItem: MenuItemComponent;
    MenuSubmenuTrigger: MenuSubmenuTriggerComponent;
    menuGroupLabelClasses: string;
    MenuTriggerButton: MenuTriggerButtonComponent;
    MENU_PLACEHOLDER_MINIMUM_WIDTH: number;
    emptyMenuSize: MenuSize;
    HIGHLIGHTED_MENU_ITEM_SELECTOR: string;
    MenuBar: MenuBarComponent;
    Menu: MenuComponent;
    POPOVER_SURFACE_CLASS: string;
    POPOVER_LAYOUT_INHERIT_CLASS: string;
    POPOVER_PADDING_CLASSES: Record<PopoverPadding, string>;
    POPOVER_PADDING_OVERFLOW_CLASS_PATTERN: RegExp;
    POPOVER_PADDING_OVERFLOW_STYLE_PATTERN: RegExp;
    PopoverPopupInner: ForwardRefExoticComponent<PopoverPopupInnerProps & RefAttributes<HTMLDivElement>>;
    PopoverPopup: PopoverPopupComponent;
    PopoverSheetCapablePopup: PopoverPopupComponent;
    PopoverPopupView: ForwardRefExoticComponent<PopoverPopupViewProps & RefAttributes<HTMLDivElement>>;
    popoverStateContext: Context<PopoverMountStore | null>;
    popoverControlledStateContext: Context<ReturnType<RuntimeBindings["createOverlayStack"]> | null>;
    PopoverTrigger: PopoverTriggerComponent;
    PopoverTriggerAlias: PopoverTriggerComponent;
    PopoverComponents: PopoverNamespace;
    CHECKBOX_CLASS: string;
    Checkbox: CheckboxComponent;
    useFieldInvalid: () => boolean;
    useFieldDisabled: () => boolean;
    useFieldLabelId: () => string | undefined;
    useHasFieldContext: () => boolean;
    CheckboxVisual: (props: CheckboxVisualProps) => ReactElement;
    getMenuCaretSize: (input: string, options?: ButtonSize) => "sm" | "xs";
    AdaptiveSheetPopupHost: (props: AdaptiveSheetPopupHostProps) => ReactNode;
    CheckboxGlyph: (props: { indeterminate?: boolean }) => ReactElement;
    ControlledMenuRoot: (props: MenuRootProps) => ReactElement;
    ControlledPopoverRoot: (props: ControlledPopoverRootProps) => ReactElement;
    MenuCaret: (props: MenuCaretProps) => ReactElement;
    MenuContextProviders: (
      input: ReactNode,
      options: PassiveOpenCell | null,
      context: MenuRootIdentity,
      value?: boolean,
    ) => ReactElement;
    MenuGroupLabel: (props: MenuHeaderProps) => ReactElement;
    MenuHeader: (props: MenuHeaderProps) => ReactElement;
    MenuPendingList: (props: MenuPendingListProps) => ReactElement;
    MenuPopupContent: (props: MenuPopupContentProps) => ReactElement;
    MenuRoot: (props: MenuRootProps) => ReactElement;
    MenuRootProviders: (props: SimpleMenuProps) => ReactElement;
    MenuSearchTriggerFocusBridge: (props: {
      inputRef: RefObject<HTMLInputElement | null>;
    }) => null;
    MenuSearchTriggerKeyboardBridge: (props: {
      inputRef: RefObject<HTMLInputElement | null>;
      applyKey: (key: string) => void;
    }) => null;
    MenuSearchablePopup: (props: MenuSearchablePopupProps) => ReactElement;
    MenuSeparator: () => ReactElement;
    MenuShortcut: (props: { keys: string }) => ReactElement;
    MenuSubmenu: (props: MenuSubmenuProps) => ReactElement;
    PendingSheetBackdrop: (props: { kind: OverlayLayerKind }) => ReactPortal | null;
    PopoverRoot: (props: PopoverRootProps) => ReactElement;
    ResetQueryOnUnmount: (props: { reset: () => void }) => null;
    SimpleMenu: (props: SimpleMenuProps) => ReactElement;
    cancelNestedMenuClose: (
      input: boolean,
      options: SheetOpenChangeDetails,
      context?: string,
    ) => boolean;
    extractReactText: (input: ReactNode) => string | undefined;
    getShortcutNumeralClasses: (input: string) => string;
    isAppleBrowser: () => boolean;
    isFocusOutEvent: (input?: Event) => input is FocusEvent;
    isMenuItemList: (input: ReactNode | MenuEntry[]) => input is MenuEntry[];
    isMenuSearchEditingKey: (input: MenuSearchKeyEvent) => boolean;
    isNestedMenuEvent: (
      input: EventTarget | null | undefined,
      options?: string,
    ) => boolean;
    isPopoverArrow: (input: ReactNode) => boolean;
    normalizeLabelText: (input: string) => string;
    popoverRefusesFocusOut: (input: PopoverMountState) => boolean;
    recordCompositionEnd: (input: number) => void;
    refuseInnerMenuClose: (input: SheetOpenChangeDetails, options?: string) => boolean;
    renderMenuItems: (input?: ReactNode | MenuEntry[]) => ReactNode;
    resetCompositionSuppression: (event: CompositionKeyEvent) => void;
    resolvePopoverAnchor: (input: PopoverMountState) => Element | null | "virtual";
    shouldRefuseNestedMenuClose: (
      input: boolean,
      options: SheetOpenChangeDetails,
      context?: string,
    ) => boolean;
    shouldSuppressCompositionEnter: (input: KeyboardEvent) => boolean;
    suppressFollowupCompositionLineBreak: (
      input: Event,
      options: EventTarget,
      context: () => void,
    ) => void;
    useDropdownMenu: (
      input: SimpleMenuProps,
      options: ContainerSource | null | undefined,
      context: DropdownMenuContext,
    ) => ReactElement;
    useFocusMenuAfterPending: (
      input: RefObject<HTMLElement | null>,
      options: boolean,
    ) => void;
    useMenuItemLabel: (input: ReactNode, options?: string) => MenuItemLabel;
    useMenuPopupElement: (
      input: MenuPopupProps,
      options: ForwardedRef<HTMLDivElement>,
      context: boolean,
      value: boolean,
    ) => ReactElement;
    usePopoverOverlayStack: (
      input: BasePopover.Root.Props["onOpenChange"],
    ) => PopoverOverlayStack;
    usePopoverStyleDebug: (
      input: string | undefined,
      options: BasePopover.Popup.Props["style"],
    ) => void;
    useRefocusAfterPendingSheet: (
      input?: boolean,
    ) => (element: HTMLElement | null) => void;
  }
}

export function installUiMenu(runtime: RuntimeBindings): () => void {
  var reactiK: ReactNamespace;
  var textFieldStateContext: Context<FieldStateContextValue | null>;
  var initializeUiMenu: () => void;
  var reactForUiMenu: ReactNamespace;
  var jsxForUiMenu: JsxNamespace;
  var TextInput_oE0: string;
  var TEXT_INPUT_CLEAR_CLASS: string;
  var TEXT_INPUT_CLUSTER_CLASS: string;
  var TEXT_INPUT_ICON_CLASS: string;
  var TEXT_INPUT_CLEAR_BUTTON_CLASS: string;
  var TextInput: TextInputComponent;
  var initializeUiMenu2: () => void;
  var reactiZ: ReactNamespace;
  var jsxZu: JsxNamespace;
  var reactDOMrG0: ReactDomNamespace;
  var SHEET_PENDING_ATTRIBUTE: string;
  var concealedPopupStyle: CSSProperties;
  var preventPendingSheetFocus: (event: PreventableEvent) => void;
  var initializeUiMenu3: () => void;
  var COMPOSITION_TIME_SENTINEL: number;
  var lastCompositionEndTime: number;
  var suppressedCompositionEvents: WeakSet<Event>;
  var compositionLineBreakInputTypes: Set<string>;
  var compositionSuppressionResetEvents: string[];
  var initializeUiMenu4: () => void;
  var jsxsM: JsxNamespace;
  var checkboxVisualClasses: string;
  var CHECKBOX_MARK_CLASS: string;
  var CheckboxMark: string;
  var initializeUiMenu5: () => void;
  var jsxo_: JsxNamespace;
  var initializeUiMenu6: () => void;
  var initializeUiMenu7: () => void;
  var reacttM: ReactNamespace;
  var initializeUiMenu8: () => void;
  var reacta0: ReactNamespace;
  var jsxC0: JsxNamespace;
  var numericShortcutPattern: RegExp;
  var MenuPopup: MenuPopupComponent;
  var MenuSheetCapablePopup: MenuPopupComponent;
  var MenuItem: MenuItemComponent;
  var MenuSubmenuTrigger: MenuSubmenuTriggerComponent;
  var menuGroupLabelClasses: string;
  var MenuTriggerButton: MenuTriggerButtonComponent;
  var MENU_PLACEHOLDER_MINIMUM_WIDTH: number;
  var emptyMenuSize: MenuSize;
  var HIGHLIGHTED_MENU_ITEM_SELECTOR: string;
  var MenuBar: MenuBarComponent;
  var Menu: MenuComponent;
  var initializeUiMenu9: () => void;
  var jsxtK: JsxNamespace;
  var initializeUiMenu10: () => void;
  var reactD6: ReactNamespace;
  var jsxU7: JsxNamespace;
  var POPOVER_SURFACE_CLASS: string;
  var POPOVER_LAYOUT_INHERIT_CLASS: string;
  var POPOVER_PADDING_CLASSES: Record<PopoverPadding, string>;
  var POPOVER_PADDING_OVERFLOW_CLASS_PATTERN: RegExp;
  var POPOVER_PADDING_OVERFLOW_STYLE_PATTERN: RegExp;
  var PopoverPopupInner: ForwardRefExoticComponent<PopoverPopupInnerProps & RefAttributes<HTMLDivElement>>;
  var PopoverPopup: PopoverPopupComponent;
  var PopoverSheetCapablePopup: PopoverPopupComponent;
  var PopoverPopupView: ForwardRefExoticComponent<PopoverPopupViewProps & RefAttributes<HTMLDivElement>>;
  var popoverStateContext: Context<PopoverMountStore | null>;
  var popoverControlledStateContext: Context<ReturnType<RuntimeBindings["createOverlayStack"]> | null>;
  var PopoverTrigger: PopoverTriggerComponent;
  var PopoverTriggerAlias: PopoverTriggerComponent;
  var PopoverComponents: PopoverNamespace;
  var initializeUiMenu11: () => void;
  var reactForUiMenu2: ReactNamespace;
  var jsxForUiMenu2: JsxNamespace;
  var CHECKBOX_CLASS: string;
  var Checkbox: CheckboxComponent;
  var initializeUiMenu12: () => void;
  function useFieldInvalid() {
    return reactiK.useContext(textFieldStateContext)?.invalid ?? false;
  }
  function useFieldDisabled() {
    return reactiK.useContext(textFieldStateContext)?.disabled ?? false;
  }
  function useFieldLabelId() {
    let { labelId: labelId, controlId: controlId } = (0,
    runtime.baseUseLabelableContext)();
    return labelId ?? (controlId ? `${controlId}-label` : undefined);
  }
  function useHasFieldContext() {
    return reactiK.useContext(textFieldStateContext) !== null;
  }
  function useRefocusAfterPendingSheet(input?: boolean) {
    let ref = reactiZ.useRef<HTMLElement | null>(null),
      ref2 = reactiZ.useRef(input);
    reactiZ.useEffect(() => {
      if (ref2.current && !input) {
        ref.current?.focus({
          preventScroll: true,
        });
      }
      ref2.current = input;
    }, [input]);
    return reactiZ.useCallback((input2: HTMLElement | null) => {
      ref.current = input2;
    }, []);
  }
  function PendingSheetBackdrop({ kind: kind }: { kind: OverlayLayerKind }) {
    let value = reactiZ.useContext(runtime.sheetFrameContext),
      value2 = (0, runtime.usePortalContainer)(),
      value3 = (0, runtime.useDefaultOverlayLayer)(kind);
    (0, runtime.useAndroidCloseWatcher)(value?.open ?? false, value?.dismiss);
    let [value4, value5] = reactiZ.useState(false),
      ref = reactiZ.useRef(false),
      value6 = (0, runtime.useRootWindow)();
    reactiZ.useEffect(() => {
      if (value6 === undefined) {
        return;
      }
      let value8 = value6.requestAnimationFrame(() => {
        value5(true);
      });
      return () => {
        value6.cancelAnimationFrame(value8);
      };
    }, [value6]);
    let value7 =
      value2 ??
      (typeof document === "undefined" ? null : document.body);
    if (value7 === null || value === null || !value.open) {
      return null;
    }
    return reactDOMrG0.createPortal(
      jsxZu.jsx(runtime.PortalRoot, {
        ...value3.portalProps,
        children: jsxZu.jsx("div", {
          role: "presentation",
          [SHEET_PENDING_ATTRIBUTE]: "",
          className: (0, runtime.clsx)(
            runtime.sheetBackdropClasses,
            !value4 && "opacity-0",
          ),
          style: value3.style,
          onPointerDown: (input: ReactPointerEvent<HTMLElement>) => {
            ref.current = true;
            preventPendingSheetFocus(input);
          },
          onPointerCancel: () => {
            ref.current = false;
          },
          onMouseDown: preventPendingSheetFocus,
          onClick: () => {
            if (!ref.current) {
              return;
            }
            ref.current = false;
            value.dismiss();
          },
        }),
      }),
      value7,
    );
  }
  function isAppleBrowser() {
    if (typeof window === "undefined") {
      return false;
    }
    return /Apple Computer/.test(window.navigator.vendor);
  }
  function recordCompositionEnd(input: number) {
    lastCompositionEndTime = input;
  }
  function resetCompositionSuppression(event: CompositionKeyEvent) {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.altKey ||
      event.keyCode === 229 ||
      event.isComposing === true ||
      event.nativeEvent?.isComposing === true
    ) {
      lastCompositionEndTime = COMPOSITION_TIME_SENTINEL;
    }
  }
  function shouldSuppressCompositionEnter(input: KeyboardEvent) {
    if (input.isComposing || input.keyCode === 229) {
      lastCompositionEndTime = COMPOSITION_TIME_SENTINEL;
      return true;
    }
    if (suppressedCompositionEvents.has(input)) {
      return true;
    }
    if (
      isAppleBrowser() &&
      Math.abs(input.timeStamp - lastCompositionEndTime) < 500
    ) {
      lastCompositionEndTime = COMPOSITION_TIME_SENTINEL;
      if (input.metaKey || input.ctrlKey) {
        return false;
      }
      suppressedCompositionEvents.add(input);
      return true;
    }
    return false;
  }
  function suppressFollowupCompositionLineBreak(
    input: Event,
    options: EventTarget,
    context: () => void,
  ) {
    if (!suppressedCompositionEvents.has(input)) {
      return;
    }
    let value = input,
      callback = (event: Event) => {
        if (event === value) {
          return;
        }
        for (let value2 of compositionSuppressionResetEvents)
          options.removeEventListener(value2, callback, {
            capture: true,
          });
        if (
          event.type === "beforeinput" &&
          "inputType" in event &&
          typeof event.inputType === "string" &&
          compositionLineBreakInputTypes.has(event.inputType)
        ) {
          event.preventDefault();
          context();
        }
      };
    for (let value2 of compositionSuppressionResetEvents)
      options.addEventListener(value2, callback, {
        capture: true,
      });
  }
  function CheckboxGlyph({
    indeterminate = false,
  }: {
    indeterminate?: boolean;
  }) {
    return jsxsM.jsx(runtime.Icon, {
      name: indeterminate ? "Minus" : "Check",
      size: "sm",
      bold: true,
      style: {
        fontSize: "var(--cds-checkbox-glyph)",
      },
    });
  }
  function CheckboxVisual({
    checked: checked,
    indeterminate = false,
    className: className,
  }: CheckboxVisualProps) {
    let value = checked || indeterminate;
    return jsxsM.jsx("span", {
      "data-checked": checked && !indeterminate ? "" : undefined,
      "data-indeterminate": indeterminate ? "" : undefined,
      "data-unchecked": value ? undefined : "",
      className: (0, runtime.cn)(
        checkboxVisualClasses,
        value && "bg-fill-accent border-transparent",
        className,
      ),
      children:
        value &&
        jsxsM.jsx("span", {
          className: "text-on-accent",
          children: jsxsM.jsx(CheckboxGlyph, {
            indeterminate: indeterminate,
          }),
        }),
    });
  }
  function MenuContextProviders(
    input: ReactNode,
    options: PassiveOpenCell | null,
    context: MenuRootIdentity,
    value: boolean = false,
  ) {
    let value2 = jsxo_.jsx(runtime.passiveOpenStateContext.Provider, {
      value: options,
      children: jsxo_.jsx(runtime.menuRootIdentityContext.Provider, {
        value: context,
        children: jsxo_.jsx(runtime.menuIsOpenContext.Provider, {
          value: null,
          children: jsxo_.jsx(runtime.menuTriggerContext.Provider, {
            value: null,
            children: jsxo_.jsx(runtime.submenuStateContext.Provider, {
              value: runtime.defaultSubmenuState,
              children: jsxo_.jsx(runtime.contextMenuContext.Provider, {
                value: value,
                children: value
                  ? input
                  : jsxo_.jsx(runtime.TooltipImplementationProvider, {
                      children: input,
                    }),
              }),
            }),
          }),
        }),
      }),
    });
    if (value) {
      return jsxo_.jsx(runtime.MenuOpenerProvider, {
        value: undefined,
        children: value2,
      });
    } else {
      return value2;
    }
  }
  function isNestedMenuEvent(
    input: EventTarget | null | undefined,
    options?: string,
  ) {
    let value =
      (0, runtime.asElement)(input)?.closest("[data-nested]") ?? null;
    if (value === null) {
      return false;
    }
    if (options === undefined) {
      return true;
    }
    let value2 = (0, runtime.asElement)(
      value.closest("[data-sheet-tree]"),
    );
    return (
      value2 !== null && value2.getAttribute("data-sheet-tree") === options
    );
  }
  function isFocusOutEvent(input?: Event): input is FocusEvent {
    return (
      input !== undefined &&
      "relatedTarget" in input &&
      input.type === "focusout"
    );
  }
  function shouldRefuseNestedMenuClose(
    input: boolean,
    options: SheetOpenChangeDetails,
    context?: string,
  ) {
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
    options: SheetOpenChangeDetails,
    context?: string,
  ) {
    if (!shouldRefuseNestedMenuClose(input, options, context)) {
      return false;
    }
    options.cancel!();
    return true;
  }
  function extractReactText(input: ReactNode): string | undefined {
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
    for (let value of input) {
      let value2 = extractReactText(value);
      if (value2 === undefined) {
        return;
      }
      text += value2;
    }
    return text;
  }
  function normalizeLabelText(input: string) {
    return input.replace(/\s+/g, " ").trim();
  }
  function useMenuItemLabel(input: ReactNode, options?: string) {
    let ref = reacttM.useRef<HTMLElement>(null),
      ref2 = reacttM.useRef<HTMLElement>(null),
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
  function getShortcutNumeralClasses(input: string) {
    if (numericShortcutPattern.test(input)) {
      return "tabular-nums";
    } else {
      return "";
    }
  }
  function MenuShortcut({ keys: keys }: { keys: string }) {
    return jsxC0.jsx(runtime.Shortcut, {
      keys: keys,
      variant: "text",
      "aria-hidden": true,
      className: (0, runtime.cn)(
        "pointer-coarse:hidden text-footnote",
        getShortcutNumeralClasses(keys),
      ),
    });
  }
  function useMenuPopupElement(
    input: MenuPopupProps,
    options: ForwardedRef<HTMLDivElement>,
    context: boolean,
    value: boolean,
  ): ReactElement {
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
      value20 = reacta0.useContext(runtime.menuTriggerContext),
      value21 =
        reacta0.useContext(runtime.contextMenuContext) && value20 === null,
      value22 = reacta0.useContext(runtime.collisionPaddingContext),
      value23 = value4 ?? value22?.collisionPadding,
      memo = reacta0.useMemo(
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
    let value29 = useRefocusAfterPendingSheet(value),
      value30 = (0, runtime.useStableMergedRef)(
        (input2: HTMLDivElement | null) => {
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
    return jsxC0.jsx(runtime.baseMenu.Portal, {
      container: value7 ?? value19,
      children: jsxC0.jsx(runtime.PortalRoot, {
        ...value31.portalProps,
        style: value
          ? {
              ...value31.portalProps.style,
              ...concealedPopupStyle,
            }
          : value31.portalProps.style,
        surface: runtime.elevationSurfaceNames.popover,
        companionModalCatcher: true,
        closeOnActivityHide: true,
        children: jsxC0.jsx(runtime.CollisionPaddingProvider, {
          override: value23,
          container: value7 ?? value19,
          provideInherit: true,
          children: (input2: CollisionPadding | undefined) =>
            jsxC0.jsx(runtime.layerBaseContext.Provider, {
              value: value31.base,
              children: jsxC0.jsx(runtime.baseMenu.Positioner, {
                ref: value25.positionerRef,
                className: value25.held?.positionerClassName,
                style:
                  value25.held !== null
                    ? {
                        ...value31.style,
                        ...value25.held.positionerStyle,
                      }
                    : value31.style,
                side: value25.side,
                align: value25.align,
                sideOffset: value24,
                collisionPadding: input2,
                collisionAvoidance: value5,
                anchor: memo,
                children: jsxC0.jsx(runtime.PassiveOpenGate, {
                  cell: value28.cell,
                  nested: value20 !== null,
                  children: (input3: <Props extends object>(props: Props) => Props) =>
                    jsxC0.jsx(runtime.MenuPopupElement, {
                      anchoredWithoutFinalFocus: value27,
                      cursorAnchored: value21,
                      "data-cds": value18,
                      ref: value30,
                      ...input3(value15),
                      className: (0, runtime.cn)(
                        runtime.contextMenuPopupClasses,
                        value25.held?.popupClassName,
                        value8,
                      ),
                      children: jsxC0.jsx(runtime.MenuScrollContent, {
                        header: value10,
                        footer: value11,
                        maxVisibleItems: value12,
                        children: value9,
                      }),
                    }),
                }),
              }),
            }),
        }),
      }),
    });
  }
  function MenuSubmenu({
    actionsRef: actionsRef,
    ...props
  }: MenuSubmenuProps): ReactElement {
    let [value, value2] = reacta0.useState(
        props.open ?? props.defaultOpen ?? false,
      ),
      ref = reacta0.useRef(value),
      value3 = (0, runtime.useOptionalEventCallback)(
        props.onOpenChange,
      ),
      { sheet: value4 } = (0, runtime.useSheetState)(),
      value5 = reacta0.useContext(runtime.sheetFrameContext),
      value6 = value5?.treeId,
      ref2 = reacta0.useRef<ReactNode>(null),
      callback = reacta0.useCallback((input: ReactNode) => {
        ref2.current = input;
      }, []),
      [value7, value8] = reacta0.useState<ReactNode>(null),
      callback2 = reacta0.useCallback(
        (input: boolean, options: BaseMenu.SubmenuRoot.ChangeEventDetails) => {
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
      ref3 = reacta0.useRef<HTMLElement | null>(null),
      callback3 = reacta0.useCallback((input: HTMLElement | null) => {
        ref3.current = input;
      }, []),
      ref4 = reacta0.useRef<BaseMenu.Root.Actions | null>(null);
    (0, runtime.useForwardedOverlayActions)(ref4, actionsRef);
    let callback4 = reacta0.useCallback(() => {
        ref4.current?.close();
      }, []),
      value9 = reacta0.useContext(runtime.menuIsOpenContext),
      value10 = reacta0.useContext(runtime.menuRootIdentityContext),
      value11 = value9 ?? value10,
      memo = reacta0.useMemo(
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
        value8(
          (input) => (input === current ? input : current),
        );
      }
    }, [value12]);
    let memo2 = reacta0.useMemo(
      () => ({
        label: value7,
        open: value12,
      }),
      [value7, value12],
    );
    return jsxC0.jsx(runtime.menuTriggerContext.Provider, {
      value: memo,
      children: jsxC0.jsx(runtime.submenuStateContext.Provider, {
        value: memo2,
        children: jsxC0.jsx(runtime.menuIsOpenContext.Provider, {
          value: value11,
          children: jsxC0.jsx(runtime.menuRootIdentityContext.Provider, {
            value: ref4,
            children: jsxC0.jsx(runtime.baseMenu.SubmenuRoot, {
              ...props,
              actionsRef: ref4,
              onOpenChange: callback2,
            }),
          }),
        }),
      }),
    });
  }
  function MenuSeparator(): ReactElement {
    return jsxC0.jsx(runtime.baseMenu.Separator, {
      className: "compact:mx-2 comfortable:mx-2.5 my-1 h-px bg-border",
    });
  }
  function MenuHeader({
    children: children,
    className: className,
  }: MenuHeaderProps): ReactElement {
    let value = (0, runtime.useIsSheet)(),
      value2 = reacta0.useContext(runtime.menuTriggerContext) !== null,
      { label: value3 } = reacta0.useContext(
        runtime.submenuStateContext,
      ),
      value4 =
        value &&
        value2 &&
        typeof children === "string" &&
        typeof value3 === "string" &&
        children.trim() === value3.trim();
    return jsxC0.jsx("div", {
      role: "presentation",
      className: (0, runtime.cn)(
        menuGroupLabelClasses,
        value4 && "first:hidden",
        className,
      ),
      children: children,
    });
  }
  function MenuGroupLabel({
    children: children,
    className: className,
  }: MenuHeaderProps): ReactElement {
    return jsxC0.jsx(runtime.baseMenu.GroupLabel, {
      className: (0, runtime.cn)(menuGroupLabelClasses, className),
      children: children,
    });
  }
  function isMenuItemList(
    input: ReactNode | MenuEntry[],
  ): input is MenuEntry[] {
    return Array.isArray(input);
  }
  function renderMenuItems(input?: ReactNode | MenuEntry[]): ReactNode {
    if (!isMenuItemList(input)) {
      return input;
    }
    return input.map((event, options): ReactNode => {
      if (event === "separator") {
        return jsxC0.jsx(MenuSeparator, {}, options);
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
        return jsxC0.jsxs(
          reacta0.Fragment,
          {
            children: [
              event.separatorBefore && jsxC0.jsx(MenuSeparator, {}),
              jsxC0.jsxs(MenuSubmenu, {
                disabled: event.disabled,
                children: [
                  jsxC0.jsx(MenuSubmenuTrigger, {
                    icon: event.icon,
                    hint: event.hint,
                    children: event.label,
                  }),
                  jsxC0.jsx(MenuPopup, {
                    children: renderMenuItems(event.items),
                  }),
                ],
              }),
            ],
          },
          options,
        );
      }
      return jsxC0.jsxs(
        reacta0.Fragment,
        {
          children: [
            event.separatorBefore && jsxC0.jsx(MenuSeparator, {}),
            jsxC0.jsx(MenuItem, {
              icon: event.icon,
              shortcut: event.shortcut,
              variant: event.variant,
              disabled: event.disabled,
              checked: event.checked,
              checkedRole: event.checkedRole,
              indicator: event.indicator,
              indeterminate: event.indeterminate,
              hint: event.hint,
              description: event.description,
              disabledReason: event.disabledReason,
              keepOpen: event.keepOpen,
              leading: event.leading,
              trailing: event.trailing,
              href: event.href,
              routerOptions: event.routerOptions,
              target: event.target,
              onClick: event.onSelect,
              children: event.label,
            }),
          ],
        },
        options,
      );
    });
  }
  function getMenuCaretSize(input: string, options?: ButtonSize) {
    if ((0, runtime.getDensitySizeIndex)(input, options) >= 4) {
      return "sm";
    } else {
      return "xs";
    }
  }
  function MenuCaret({ size: size }: MenuCaretProps): ReactElement {
    let value = (0, runtime.useDensity)(),
      value2 = (0, runtime.useButtonGroup)();
    return jsxC0.jsx(runtime.Icon, {
      name: "CaretDown",
      size: getMenuCaretSize(value, size ?? value2?.size),
      "data-cds-part": "menu-caret",
      className: "shrink-0 opacity-60",
    });
  }
  function MenuPopupContent({
    side: side,
    align: align,
    sideOffset: sideOffset,
    collisionPadding: collisionPadding,
    finalFocus: finalFocus,
    dataCds: dataCds,
    items: items,
  }: MenuPopupContentProps): ReactElement {
    return jsxC0.jsx(runtime.ContextMenuPopupFrame, {
      side: side,
      align: align,
      sideOffset: sideOffset,
      collisionPadding: collisionPadding,
      finalFocus: finalFocus,
      "data-cds": dataCds ?? "Menu",
      children: renderMenuItems(items),
    });
  }
  function SimpleMenu(input: SimpleMenuProps): ReactElement {
    let value = (0, runtime.useSheetCapablePresentation)(),
      value2 = reacta0.useContext(runtime.menuBarContext),
      value3 = (0, runtime.useStableObjectRef)<OverlayActions>(),
      onOpenChange = input.onOpenChange,
      { onOpenChange: value4, triggerRef: value5 } = (0,
      runtime.useTrackedMenuTrigger)(
        (input2: boolean, options: BaseMenu.Root.ChangeEventDetails) => {
          onOpenChange?.(input2, options);
          (0, runtime.recordKeyboardContextMenuOpen)(value3, input2, options);
        },
        value2,
      ),
      value6 = (0, runtime.usePortalContainer)();
    if (value) {
      return jsxC0.jsx(MenuRootProviders, {
        ...input,
      });
    }
    return useDropdownMenu(input, value6, {
      triggerRef: value5,
      onOpenChange: value4,
      actionsRef: value3,
      contextMenuOnOpenChange: value4,
      inMenuBar: value2,
    });
  }
  function MenuRootProviders(input: SimpleMenuProps): ReactElement {
    let {
        open: value,
        sheetTitle: value2,
        backLabel: value3,
        closeLabel: value4,
      } = input,
      memo = reacta0.useMemo(
        () => ({
          sheetTitle: value2,
          backLabel: value3,
          closeLabel: value4,
        }),
        [value2, value3, value4],
      ),
      value5 = (0, runtime.usePortalContainer)(),
      value6 = reacta0.useContext(runtime.menuBarContext),
      { onOpenChange: value7, triggerRef: value8 } = (0,
      runtime.useTrackedMenuTrigger)(input.onOpenChange, value6),
      value9 = (0, runtime.useControllableOpen)({
        open: value,
        onOpenChange: value7 as ControllableOpenProps["onOpenChange"],
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
    return jsxC0.jsx(runtime.SheetContextProvider, {
      value: value10,
      children: jsxC0.jsx(runtime.menuSheetLabelsContext.Provider, {
        value: memo,
        children: value11,
      }),
    });
  }
  function useDropdownMenu(
    input: SimpleMenuProps,
    options: ContainerSource | null | undefined,
    context: DropdownMenuContext,
  ): ReactElement {
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
        return jsxC0.jsx("div", {
          "data-disabled": "",
          className: value9,
          children: input.children,
        });
      }
      if (context.sheetCapable) {
        return jsxC0.jsx(runtime.CloseOnActivityHideProvider, {
          actionsRef: context.actionsRef,
          children: jsxC0.jsx(runtime.baseContextMenu.Root, {
            open: value7,
            onOpenChange: context.onOpenChange,
            onOpenChangeComplete: context.onOpenChangeComplete,
            actionsRef: context.actionsRef,
            children: MenuContextProviders(
              jsxC0.jsxs(jsxC0.Fragment, {
                children: [
                  jsxC0.jsx(runtime.baseContextMenu.Trigger, {
                    className: value9,
                    children: input.children,
                  }),
                  jsxC0.jsx(MenuPopup, {
                    side: value2,
                    align: value3,
                    sideOffset: value4,
                    collisionPadding: value5,
                    finalFocus: value6,
                    "data-cds": value11 ?? "Menu",
                    children: renderMenuItems(value),
                  }),
                ],
              }),
              null,
              context.actionsRef,
              true,
            ),
          }),
        });
      }
      return jsxC0.jsx(runtime.CloseOnActivityHideProvider, {
        actionsRef: context.actionsRef,
        children: jsxC0.jsxs(runtime.baseContextMenu.Root, {
          open: value7,
          onOpenChange: context.contextMenuOnOpenChange,
          actionsRef: context.actionsRef,
          children: [
            jsxC0.jsx(runtime.baseContextMenu.Trigger, {
              className: value9,
              children: input.children,
            }),
            jsxC0.jsx(runtime.baseContextMenu.Portal, {
              container: options,
              children: jsxC0.jsx(runtime.menuRootIdentityContext.Provider, {
                value: context.actionsRef,
                children: jsxC0.jsx(MenuPopupContent, {
                  side: value2,
                  align: value3,
                  sideOffset: value4,
                  collisionPadding: value5,
                  finalFocus: value6,
                  dataCds: value11,
                  items: value,
                }),
              }),
            }),
          ],
        }),
      });
    }
    let value12: ReactElement;
    if (input.renderTrigger !== undefined) {
      value12 = jsxC0.jsx(runtime.baseMenu.Trigger, {
        disabled: value8,
        className: value9,
        style: value10,
        render: input.renderTrigger,
      });
    } else if (input.iconOnly) {
      let value13 =
          input.tooltip === false
            ? undefined
            : typeof input.tooltip === "string"
              ? input.tooltip
              : input["aria-label"],
        value14 = jsxC0.jsx(runtime.baseMenu.Trigger, {
          disabled: value8,
          render: jsxC0.jsx(runtime.Button, {
            variant: input.variant,
            size: input.size,
            iconOnly: true,
            icon: input.icon || "DotsVertical",
            "aria-label": input["aria-label"],
            pressed: input.pressed,
            tooltip: false,
            className: value9,
            style: value10,
          }),
        }),
        value15 = value13
          ? jsxC0.jsx(runtime.Tooltip, {
              content: value13,
              children: value14,
            })
          : value14;
      value12 =
        input.disabledReason !== undefined
          ? jsxC0.jsx(runtime.DisabledReasonTooltip, {
              side: input.disabledReasonSide,
              reason: value8 ? input.disabledReason : undefined,
              children: value15,
            })
          : value15;
    } else {
      value12 = jsxC0.jsx(runtime.baseMenu.Trigger, {
        disabled: value8,
        render: jsxC0.jsxs(runtime.Button, {
          variant: input.variant,
          size: input.size,
          icon: input.icon,
          iconPosition: input.iconPosition,
          "aria-label": input["aria-label"],
          className: value9,
          style: value10,
          children: [
            input.label,
            jsxC0.jsx(MenuCaret, {
              size: input.size,
            }),
          ],
        }),
      });
    }
    return jsxC0.jsx(runtime.MenuOpenerProvider, {
      value: context.triggerRef,
      children: jsxC0.jsx(runtime.CloseOnActivityHideProvider, {
        actionsRef: context.actionsRef,
        children: jsxC0.jsx(runtime.baseMenu.Root, {
          open: value7,
          onOpenChange: context.onOpenChange,
          onOpenChangeComplete: context.onOpenChangeComplete,
          actionsRef: context.actionsRef,
          modal: context.inMenuBar ? undefined : true,
          children: MenuContextProviders(
            jsxC0.jsxs(jsxC0.Fragment, {
              children: [
                value12,
                jsxC0.jsx(MenuPopup, {
                  side: value2,
                  align: value3,
                  sideOffset: value4,
                  collisionPadding: value5,
                  finalFocus: value6,
                  "data-cds": value11,
                  children: renderMenuItems(value),
                }),
              ],
            }),
            null,
            context.actionsRef,
          ),
        }),
      }),
    });
  }
  function refuseInnerMenuClose(
    input: SheetOpenChangeDetails,
    options?: string,
  ) {
    return shouldRefuseNestedMenuClose(false, input, options);
  }
  function MenuRoot(input: MenuRootProps): ReactElement {
    let {
        children: value,
        sheetTitle: value2,
        backLabel: value3,
        closeLabel: value4,
        ...value5
      } = input,
      value6 = (0, runtime.useSheetCapablePresentation)(),
      value7 = reacta0.useContext(runtime.menuBarContext),
      { onOpenChange: value8, triggerRef: value9 } = (0,
      runtime.useTrackedMenuTrigger)(value5.onOpenChange, value7),
      value10 = (0, runtime.usePassiveOpenState)(
        value8,
        value5.open,
        !value7,
      ),
      value11 = (0, runtime.useStableObjectRef)<OverlayActions>();
    (0, runtime.useForwardedOverlayActions)(value11, value5.actionsRef);
    if (value6) {
      return jsxC0.jsx(runtime.CloseOnActivityHideProvider, {
        actionsRef: value11,
        children: jsxC0.jsx(ControlledMenuRoot, {
          ...input,
          actionsRef: value11,
        }),
      });
    }
    return jsxC0.jsx(runtime.MenuOpenerProvider, {
      value: value9,
      children: jsxC0.jsx(runtime.CloseOnActivityHideProvider, {
        actionsRef: value11,
        children: jsxC0.jsx(runtime.baseMenu.Root, {
          ...value5,
          modal: value7 ? undefined : value5.modal,
          actionsRef: value11,
          onOpenChange: value10.onOpenChange,
          children:
            typeof value === "function"
              ? (input2: MenuRenderState) =>
                  MenuContextProviders(value(input2), value10.cell, value11)
              : MenuContextProviders(value, value10.cell, value11),
        }),
      }),
    });
  }
  function ControlledMenuRoot(input: MenuRootProps): ReactElement {
    let {
        children: value,
        sheetTitle: value2,
        backLabel: value3,
        closeLabel: value4,
        ...value5
      } = input,
      memo = reacta0.useMemo(
        () => ({
          sheetTitle: value2,
          backLabel: value3,
          closeLabel: value4,
        }),
        [value2, value3, value4],
      ),
      value6 = reacta0.useContext(runtime.menuBarContext),
      { onOpenChange: value7, triggerRef: value8 } = (0,
      runtime.useTrackedMenuTrigger)(input.onOpenChange, value6),
      value9 = (0, runtime.usePassiveOpenState)(
        value7,
        input.open,
        !value6,
      ),
      value10 = (0, runtime.useControllableOpen)({
        ...input,
        onOpenChange: value9.onOpenChange as ControllableOpenProps["onOpenChange"],
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
    return jsxC0.jsx(runtime.MenuOpenerProvider, {
      value: value8,
      children: jsxC0.jsx(runtime.SheetContextProvider, {
        value: value12,
        children: jsxC0.jsx(runtime.menuSheetLabelsContext.Provider, {
          value: memo,
          children: jsxC0.jsx(runtime.baseMenu.Root, {
            ...value5,
            modal: value6 ? undefined : (value12.modal ?? value5.modal),
            actionsRef: value12.actionsRef,
            onOpenChange: value12.onOpenChange,
            onOpenChangeComplete: value12.onOpenChangeComplete,
            children:
              typeof value === "function"
                ? (input2: MenuRenderState) =>
                    MenuContextProviders(
                      value(input2),
                      value9.cell,
                      value12.actionsRef,
                    )
                : MenuContextProviders(value, value9.cell, value12.actionsRef),
          }),
        }),
      }),
    });
  }
  function ResetQueryOnUnmount({
    reset: reset,
  }: {
    reset: () => void;
  }): null {
    reacta0.useEffect(() => () => reset(), [reset]);
    return null;
  }
  function isMenuSearchEditingKey(input: MenuSearchKeyEvent) {
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
    inputRef: RefObject<HTMLInputElement | null>;
    applyKey: (key: string) => void;
  }): null {
    let value = reacta0.useContext(
      runtime.menuTriggerContext,
    )?.triggerRef;
    reacta0.useEffect(() => {
      let value2 = value?.current;
      if (!value2) {
        return;
      }
      let callback = (event: KeyboardEvent) => {
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
      return () =>
        value2.removeEventListener("keydown", callback, true);
    }, [value, inputRef, applyKey]);
    return null;
  }
  function MenuSearchTriggerFocusBridge({
    inputRef: inputRef,
  }: {
    inputRef: RefObject<HTMLInputElement | null>;
  }): null {
    let value = reacta0.useContext(runtime.menuTriggerContext);
    reacta0.useEffect(() => {
      let value2 = value?.triggerRef.current;
      if (!value || !value2) {
        return;
      }
      let { openRef: value3 } = value,
        callback = (input: FocusEvent) => {
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
    reacta0.useEffect(() => {
      let callback = () => {
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
  }: MenuSearchablePopupProps): ReactElement {
    let [value, value2] = reacta0.useState(""),
      value3 = query ?? value,
      value4 = (0, runtime.useEventCallback)(
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
      ref = reacta0.useRef(false);
    reacta0.useEffect(() => {
      return;
    }, [query, onQueryChange]);
    let value6 = (0, runtime.useIsSheet)(),
      value7 = (0, runtime.useMediaQuery__U)(
        (0, runtime.useRootWindow)(),
        runtime.COARSE_POINTER_QUERY_rG,
      ),
      value8 = !value6 && !value7,
      value9 = reacta0.useContext(runtime.menuIsOpenContext),
      value10 = reacta0.useContext(runtime.menuRootIdentityContext),
      value11 = (value9 ?? value10) as RefObject<OverlayActions | null> | null,
      ref2 = reacta0.useRef<HTMLDivElement>(null),
      ref3 = reacta0.useRef<HTMLInputElement>(null),
      ref4 = reacta0.useRef<(() => void) | null>(null);
    reacta0.useEffect(() => () => ref4.current?.(), []);
    let callback = reacta0.useCallback((input: string) => {
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
            let value19 =
              (value12.codePointAt(value13 - 2) ?? 0) > 65535;
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
            current?.querySelector<HTMLElement>('input, button, [role="radio"]');
        if (!value12) {
          return false;
        }
        value12.focus();
        return true;
      };
    return jsxC0.jsxs(MenuPopup, {
      ...props,
      stableWhileOpen: stableWhileOpen,
      onKeyDown: (event: BaseUIEvent<ReactKeyboardEvent<HTMLDivElement>>) => {
        let current = ref3.current;
        if (
          !current ||
          (event.target as Element).closest?.("input, textarea, [contenteditable]") ||
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
      },
      onFocus: (event: BaseUIEvent<ReactFocusEvent<HTMLDivElement>>) => {
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
      },
      onMouseDown: (event: BaseUIEvent<ReactMouseEvent<HTMLDivElement>>) => {
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
      },
      header: jsxC0.jsxs(jsxC0.Fragment, {
        children: [
          beforeSearch !== undefined &&
            jsxC0.jsx("div", {
              ref: ref2,
              role: "presentation",
              className: "px-sm pt-sm",
              onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => {
                if (event.key === "Escape") {
                  return;
                }
                event.stopPropagation();
                if (event.key === "Tab") {
                  event.preventDefault();
                  ref3.current?.focus();
                }
              },
              children: beforeSearch,
            }),
          jsxC0.jsx(TextInput, {
            ref: ref3,
            value: value3,
            onChange: (event: ChangeEvent<HTMLInputElement>) =>
              value4(event.target.value),
            onCompositionEnd: (event: CompositionEvent<HTMLInputElement>) =>
              recordCompositionEnd(event.nativeEvent.timeStamp),
            onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => {
              resetCompositionSuppression(event);
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
                  if (shouldSuppressCompositionEnter(event.nativeEvent)) {
                    suppressFollowupCompositionLineBreak(
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
            },
            placeholder: searchLabel,
            "aria-label": searchLabel,
            autoComplete: "off",
            "data-1p-ignore": true,
            autoFocus: value8,
            tabIndex: value8 ? undefined : -1,
            className:
              "!border-transparent !bg-transparent !shadow-none compact:!pl-2 comfortable:!pl-2.5",
          }),
          jsxC0.jsx(runtime.baseMenu.Separator, {
            className: "-mx-1 my-1 h-px bg-border",
          }),
        ],
      }),
      children: [
        resetQueryOnClose &&
          jsxC0.jsx(ResetQueryOnUnmount, {
            reset: value5,
          }),
        value8 &&
          jsxC0.jsx(MenuSearchTriggerFocusBridge, {
            inputRef: ref3,
          }),
        jsxC0.jsx(MenuSearchTriggerKeyboardBridge, {
          inputRef: ref3,
          applyKey: callback,
        }),
        children(value3.trim().toLowerCase(), value3.trim()),
      ],
    });
  }
  function useFocusMenuAfterPending(
    input: RefObject<HTMLElement | null>,
    options: boolean,
  ) {
    let ref = reacta0.useRef(options);
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
    reacta0.useEffect(() => {
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
  }: MenuPendingListProps): ReactElement {
    let ref = reacta0.useRef<HTMLDivElement>(null),
      ref2 = reacta0.useRef(emptyMenuSize);
    reacta0.useEffect(() => {
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
      [value2, value3] = reacta0.useState(emptyMenuSize);
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
    return jsxC0.jsx("div", {
      ref: ref,
      "aria-busy": value || undefined,
      style: value4
        ? {
            minWidth: value2.width,
            height: value2.height,
          }
        : undefined,
      className: value4 ? "overflow-hidden" : undefined,
      children: loading
        ? jsxC0.jsx(runtime.SkeletonGroup, {
            children: jsxC0.jsx(runtime.SkeletonPrimitive.Rows, {
              icon: icon,
              rows: value4
                ? Math.ceil(value2.height / MENU_PLACEHOLDER_MINIMUM_WIDTH)
                : placeholderRows,
            }),
          })
        : children,
    });
  }
  function AdaptiveSheetPopupHost({
    kind: kind,
    children: children,
  }: AdaptiveSheetPopupHostProps): ReactNode {
    let value = (0, runtime.useSheetImplementation)(),
      { pending: value2 } = (0, runtime.useSheetState)();
    if (value !== null) {
      return jsxtK.jsx(value.SheetPopupHost, {
        children: (input: SheetHost) => children(input, value),
      });
    }
    return jsxtK.jsxs(jsxtK.Fragment, {
      children: [
        children(
          value2 ? runtime.concealedSheetHost : runtime.defaultSheetHost,
          null,
        ),
        value2
          ? jsxtK.jsx(PendingSheetBackdrop, {
              kind: kind,
            })
          : null,
      ],
    });
  }
  function usePopoverStyleDebug(
    input: string | undefined,
    options: BasePopover.Popup.Props["style"],
  ) {
    let ref = reactD6.useRef(false);
    reactD6.useEffect(() => {
      return;
    }, [input, options]);
  }
  function isPopoverArrow(input: ReactNode) {
    return (
      reactD6.isValidElement(input) && input.type === runtime.basePopover.Arrow
    );
  }
  function usePopoverOverlayStack(input: BasePopover.Root.Props["onOpenChange"]) {
    let [value] = reactD6.useState(runtime.createOverlayStack);
    return {
      innerOverlays: value,
      onOpenChange: reactD6.useCallback(
        (input2: boolean, options: BasePopover.Root.ChangeEventDetails) => {
          if (
            (0, runtime.interceptEscapeForInnerOverlay)(value, input2, options)
          ) {
            return;
          }
          input?.(input2, options);
        },
        [value, input],
      ),
    };
  }
  function resolvePopoverAnchor(
    input: PopoverMountState,
  ): Element | null | "virtual" {
    let anchor = input.anchor;
    if (anchor === undefined || anchor === null) {
      return input.triggerEl;
    }
    if (anchor instanceof Element) {
      return anchor;
    }
    if (typeof anchor === "object" && "current" in anchor) {
      let current = anchor.current;
      if (current instanceof Element) {
        return current;
      } else {
        return null;
      }
    }
    return "virtual";
  }
  function popoverRefusesFocusOut(input: PopoverMountState) {
    if (!input.popupMounted || !input.declinesFocus) {
      return false;
    }
    let value = resolvePopoverAnchor(input);
    if (value === "virtual") {
      return true;
    }
    if (value === null) {
      return false;
    }
    return (
      (0, runtime.isEditableElement)(value) ||
      value.querySelector(
        'input:not([type=button],[type=checkbox],[type=radio],[type=range],[type=submit],[type=reset],[type=color],[type=file],[type=image],[type=hidden],[readonly]), textarea:not([readonly]), [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]',
      ) !== null ||
      value.closest(
        'input:not([type=button],[type=checkbox],[type=radio],[type=range],[type=submit],[type=reset],[type=color],[type=file],[type=image],[type=hidden],[readonly]), textarea:not([readonly]), [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]',
      ) !== null
    );
  }
  function PopoverRoot({
    onOpenChange: onOpenChange,
    actionsRef: actionsRef,
    ...props
  }: PopoverRootProps): ReactElement {
    let value = usePopoverOverlayStack(onOpenChange),
      value2 = (0, runtime.useSheetCapablePresentation)(),
      ref = reactD6.useRef<BasePopover.Root.Actions | null>(null);
    (0, runtime.useForwardedOverlayActions)(ref, actionsRef);
    return jsxU7.jsx(popoverControlledStateContext.Provider, {
      value: value.innerOverlays,
      children: jsxU7.jsx(runtime.CloseOnActivityHideProvider, {
        actionsRef: ref,
        children: value2
          ? jsxU7.jsx(ControlledPopoverRoot, {
              ...props,
              actionsRef: ref,
              onOpenChange: value.onOpenChange,
              consumerHandlesOpenChange: onOpenChange !== undefined,
            })
          : jsxU7.jsx(runtime.basePopover.Root, {
              ...props,
              actionsRef: ref,
              onOpenChange: value.onOpenChange,
            }),
      }),
    });
  }
  function ControlledPopoverRoot({
    consumerHandlesOpenChange: consumerHandlesOpenChange,
    ...props
  }: ControlledPopoverRootProps): ReactElement {
    let value = (0, runtime.useControllableOpen)(props),
      ref = reactD6.useRef<PopoverMountState>({
        popupMounted: false,
        declinesFocus: false,
        anchor: undefined,
        triggerEl: null,
      }),
      memo = reactD6.useMemo(
        () => ({
          update: (input: Partial<PopoverMountState>) => {
            Object.assign(ref.current, input);
          },
          read: () => ref.current,
        }),
        [],
      ),
      value2 = (0, runtime.useValueCapturedOnOpen)(
        value.open,
        () => {
          let value4 = memo.read();
          return !value4.popupMounted || popoverRefusesFocusOut(value4);
        },
        false,
      ),
      value3 = (0, runtime.useAdaptiveSheet)({
        open: value.open,
        actionsRef: props.actionsRef,
        onOpenChange: value.onOpenChange,
        onOpenChangeComplete: props.onOpenChangeComplete,
        structurallyAnchored: value2,
        closable: !(props.open !== undefined && !consumerHandlesOpenChange),
      });
    return jsxU7.jsx(popoverStateContext.Provider, {
      value: memo,
      children: jsxU7.jsx(runtime.SheetContextProvider, {
        value: value3,
        children: jsxU7.jsx(runtime.basePopover.Root, {
          ...props,
          modal: value3.modal ?? props.modal,
          actionsRef: value3.actionsRef,
          onOpenChange: value3.onOpenChange,
          onOpenChangeComplete: value3.onOpenChangeComplete,
        }),
      }),
    });
  }
  bindRuntimeValue(runtime, "useFieldInvalid", () => useFieldInvalid);
  bindRuntimeValue(runtime, "useFieldDisabled", () => useFieldDisabled);
  bindRuntimeValue(runtime, "useFieldLabelId", () => useFieldLabelId);
  bindRuntimeValue(runtime, "useHasFieldContext", () => useHasFieldContext);
  bindRuntimeValue(
    runtime,
    "reactiK",
    () => reactiK,
    (value) => {
      reactiK = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "textFieldStateContext",
    () => textFieldStateContext,
    (value) => {
      textFieldStateContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiMenu",
    () => initializeUiMenu,
    (value) => {
      initializeUiMenu = value;
    },
  );
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
    "TextInput_oE0",
    () => TextInput_oE0,
    (value) => {
      TextInput_oE0 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_INPUT_CLEAR_CLASS",
    () => TEXT_INPUT_CLEAR_CLASS,
    (value) => {
      TEXT_INPUT_CLEAR_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_INPUT_CLUSTER_CLASS",
    () => TEXT_INPUT_CLUSTER_CLASS,
    (value) => {
      TEXT_INPUT_CLUSTER_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_INPUT_ICON_CLASS",
    () => TEXT_INPUT_ICON_CLASS,
    (value) => {
      TEXT_INPUT_ICON_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_INPUT_CLEAR_BUTTON_CLASS",
    () => TEXT_INPUT_CLEAR_BUTTON_CLASS,
    (value) => {
      TEXT_INPUT_CLEAR_BUTTON_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TextInput",
    () => TextInput,
    (value) => {
      TextInput = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiMenu2",
    () => initializeUiMenu2,
    (value) => {
      initializeUiMenu2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useRefocusAfterPendingSheet",
    () => useRefocusAfterPendingSheet,
  );
  bindRuntimeValue(runtime, "PendingSheetBackdrop", () => PendingSheetBackdrop);
  bindRuntimeValue(
    runtime,
    "reactiZ",
    () => reactiZ,
    (value) => {
      reactiZ = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxZu",
    () => jsxZu,
    (value) => {
      jsxZu = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactDOMrG0",
    () => reactDOMrG0,
    (value) => {
      reactDOMrG0 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SHEET_PENDING_ATTRIBUTE",
    () => SHEET_PENDING_ATTRIBUTE,
    (value) => {
      SHEET_PENDING_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "concealedPopupStyle",
    () => concealedPopupStyle,
    (value) => {
      concealedPopupStyle = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "preventPendingSheetFocus",
    () => preventPendingSheetFocus,
    (value) => {
      preventPendingSheetFocus = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiMenu3",
    () => initializeUiMenu3,
    (value) => {
      initializeUiMenu3 = value;
    },
  );
  bindRuntimeValue(runtime, "isAppleBrowser", () => isAppleBrowser);
  bindRuntimeValue(runtime, "recordCompositionEnd", () => recordCompositionEnd);
  bindRuntimeValue(
    runtime,
    "resetCompositionSuppression",
    () => resetCompositionSuppression,
  );
  bindRuntimeValue(
    runtime,
    "shouldSuppressCompositionEnter",
    () => shouldSuppressCompositionEnter,
  );
  bindRuntimeValue(
    runtime,
    "suppressFollowupCompositionLineBreak",
    () => suppressFollowupCompositionLineBreak,
  );
  bindRuntimeValue(
    runtime,
    "COMPOSITION_TIME_SENTINEL",
    () => COMPOSITION_TIME_SENTINEL,
    (value) => {
      COMPOSITION_TIME_SENTINEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "lastCompositionEndTime",
    () => lastCompositionEndTime,
    (value) => {
      lastCompositionEndTime = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "suppressedCompositionEvents",
    () => suppressedCompositionEvents,
    (value) => {
      suppressedCompositionEvents = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "compositionLineBreakInputTypes",
    () => compositionLineBreakInputTypes,
    (value) => {
      compositionLineBreakInputTypes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "compositionSuppressionResetEvents",
    () => compositionSuppressionResetEvents,
    (value) => {
      compositionSuppressionResetEvents = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiMenu4",
    () => initializeUiMenu4,
    (value) => {
      initializeUiMenu4 = value;
    },
  );
  bindRuntimeValue(runtime, "CheckboxGlyph", () => CheckboxGlyph);
  bindRuntimeValue(runtime, "CheckboxVisual", () => CheckboxVisual);
  bindRuntimeValue(
    runtime,
    "jsxsM",
    () => jsxsM,
    (value) => {
      jsxsM = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "checkboxVisualClasses",
    () => checkboxVisualClasses,
    (value) => {
      checkboxVisualClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CHECKBOX_MARK_CLASS",
    () => CHECKBOX_MARK_CLASS,
    (value) => {
      CHECKBOX_MARK_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CheckboxMark",
    () => CheckboxMark,
    (value) => {
      CheckboxMark = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiMenu5",
    () => initializeUiMenu5,
    (value) => {
      initializeUiMenu5 = value;
    },
  );
  bindRuntimeValue(runtime, "MenuContextProviders", () => MenuContextProviders);
  bindRuntimeValue(
    runtime,
    "jsxo_",
    () => jsxo_,
    (value) => {
      jsxo_ = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiMenu6",
    () => initializeUiMenu6,
    (value) => {
      initializeUiMenu6 = value;
    },
  );
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
    "initializeUiMenu7",
    () => initializeUiMenu7,
    (value) => {
      initializeUiMenu7 = value;
    },
  );
  bindRuntimeValue(runtime, "extractReactText", () => extractReactText);
  bindRuntimeValue(runtime, "normalizeLabelText", () => normalizeLabelText);
  bindRuntimeValue(runtime, "useMenuItemLabel", () => useMenuItemLabel);
  bindRuntimeValue(
    runtime,
    "reacttM",
    () => reacttM,
    (value) => {
      reacttM = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiMenu8",
    () => initializeUiMenu8,
    (value) => {
      initializeUiMenu8 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getShortcutNumeralClasses",
    () => getShortcutNumeralClasses,
  );
  bindRuntimeValue(runtime, "MenuShortcut", () => MenuShortcut);
  bindRuntimeValue(runtime, "useMenuPopupElement", () => useMenuPopupElement);
  bindRuntimeValue(runtime, "MenuSubmenu", () => MenuSubmenu);
  bindRuntimeValue(runtime, "MenuSeparator", () => MenuSeparator);
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
    "useFocusMenuAfterPending",
    () => useFocusMenuAfterPending,
  );
  bindRuntimeValue(runtime, "MenuPendingList", () => MenuPendingList);
  bindRuntimeValue(
    runtime,
    "reacta0",
    () => reacta0,
    (value) => {
      reacta0 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxC0",
    () => jsxC0,
    (value) => {
      jsxC0 = value;
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
  bindRuntimeValue(
    runtime,
    "menuGroupLabelClasses",
    () => menuGroupLabelClasses,
    (value) => {
      menuGroupLabelClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MenuTriggerButton",
    () => MenuTriggerButton,
    (value) => {
      MenuTriggerButton = value;
    },
  );
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
  bindRuntimeValue(
    runtime,
    "initializeUiMenu9",
    () => initializeUiMenu9,
    (value) => {
      initializeUiMenu9 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "AdaptiveSheetPopupHost",
    () => AdaptiveSheetPopupHost,
  );
  bindRuntimeValue(
    runtime,
    "jsxtK",
    () => jsxtK,
    (value) => {
      jsxtK = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiMenu10",
    () => initializeUiMenu10,
    (value) => {
      initializeUiMenu10 = value;
    },
  );
  bindRuntimeValue(runtime, "usePopoverStyleDebug", () => usePopoverStyleDebug);
  bindRuntimeValue(runtime, "isPopoverArrow", () => isPopoverArrow);
  bindRuntimeValue(
    runtime,
    "usePopoverOverlayStack",
    () => usePopoverOverlayStack,
  );
  bindRuntimeValue(runtime, "resolvePopoverAnchor", () => resolvePopoverAnchor);
  bindRuntimeValue(
    runtime,
    "popoverRefusesFocusOut",
    () => popoverRefusesFocusOut,
  );
  bindRuntimeValue(runtime, "PopoverRoot", () => PopoverRoot);
  bindRuntimeValue(
    runtime,
    "ControlledPopoverRoot",
    () => ControlledPopoverRoot,
  );
  bindRuntimeValue(
    runtime,
    "reactD6",
    () => reactD6,
    (value) => {
      reactD6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxU7",
    () => jsxU7,
    (value) => {
      jsxU7 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "POPOVER_SURFACE_CLASS",
    () => POPOVER_SURFACE_CLASS,
    (value) => {
      POPOVER_SURFACE_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "POPOVER_LAYOUT_INHERIT_CLASS",
    () => POPOVER_LAYOUT_INHERIT_CLASS,
    (value) => {
      POPOVER_LAYOUT_INHERIT_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "POPOVER_PADDING_CLASSES",
    () => POPOVER_PADDING_CLASSES,
    (value) => {
      POPOVER_PADDING_CLASSES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "POPOVER_PADDING_OVERFLOW_CLASS_PATTERN",
    () => POPOVER_PADDING_OVERFLOW_CLASS_PATTERN,
    (value) => {
      POPOVER_PADDING_OVERFLOW_CLASS_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "POPOVER_PADDING_OVERFLOW_STYLE_PATTERN",
    () => POPOVER_PADDING_OVERFLOW_STYLE_PATTERN,
    (value) => {
      POPOVER_PADDING_OVERFLOW_STYLE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PopoverPopupInner",
    () => PopoverPopupInner,
    (value) => {
      PopoverPopupInner = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PopoverPopup",
    () => PopoverPopup,
    (value) => {
      PopoverPopup = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PopoverSheetCapablePopup",
    () => PopoverSheetCapablePopup,
    (value) => {
      PopoverSheetCapablePopup = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PopoverPopupView",
    () => PopoverPopupView,
    (value) => {
      PopoverPopupView = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "popoverStateContext",
    () => popoverStateContext,
    (value) => {
      popoverStateContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "popoverControlledStateContext",
    () => popoverControlledStateContext,
    (value) => {
      popoverControlledStateContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PopoverTrigger",
    () => PopoverTrigger,
    (value) => {
      PopoverTrigger = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PopoverTriggerAlias",
    () => PopoverTriggerAlias,
    (value) => {
      PopoverTriggerAlias = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PopoverComponents",
    () => PopoverComponents,
    (value) => {
      PopoverComponents = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiMenu11",
    () => initializeUiMenu11,
    (value) => {
      initializeUiMenu11 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactForUiMenu2",
    () => reactForUiMenu2,
    (value) => {
      reactForUiMenu2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiMenu2",
    () => jsxForUiMenu2,
    (value) => {
      jsxForUiMenu2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CHECKBOX_CLASS",
    () => CHECKBOX_CLASS,
    (value) => {
      CHECKBOX_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "Checkbox",
    () => Checkbox,
    (value) => {
      Checkbox = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiMenu12",
    () => initializeUiMenu12,
    (value) => {
      initializeUiMenu12 = value;
    },
  );
  return () => {
    initializeUiMenu = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeNpmDependency)();
      reactiK = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      textFieldStateContext = reactiK.createContext<FieldStateContextValue | null>(null);
    });
    TEXT_INPUT_CLUSTER_CLASS =
      "[&_[data-cds=Button]:not([data-cds-ghost])]:h-[var(--fhn)] [&_[data-cds=Button]:not([data-cds-ghost])]:rounded-[calc(var(--fr)-(var(--fh)-var(--fhn))/2)] [&_[data-cds=Button][data-cds-icon-only]:not([data-cds-ghost])]:w-[var(--fhn)]";
    TEXT_INPUT_ICON_CLASS =
      "has-[[data-cds-end-slot]_[data-cds=Button]:not([data-cds-ghost])]:pr-[calc((var(--cds-h-control)-var(--cds-h-control-nested))/2)]";
    TEXT_INPUT_CLEAR_BUTTON_CLASS =
      "pr-[calc((var(--cds-h-control)-var(--cds-h-control-nested))/2)]";
    initializeUiMenu2 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeTranslations)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeClickToFocus)();
      (0, runtime.initializeMergedRefs)();
      (0, runtime.initializeUiDisclosure9)();
      (0, runtime.initializeUiDisclosure12)();
      initializeUiMenu();
      (0, runtime.initializeNpmDependency)();
      reactForUiMenu = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiMenu = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      TextInput_oE0 = runtime.TEXT_INPUT_CLASS;
      TEXT_INPUT_CLEAR_CLASS = runtime.TEXT_INPUT_REQUIRED_CLASS;
      TextInput = reactForUiMenu.forwardRef<HTMLInputElement, TextInputProps>(
        (
          {
            className: className,
            size: size,
            fullWidth = true,
            slotStart: slotStart,
            slotEnd: slotEnd,
            clearable = false,
            onClear: onClear,
            clearLabel: clearLabel,
            onChange: onChange,
            onKeyDown: onKeyDown,
            ...props
          }: TextInputProps,
          options,
        ) => {
          let {
              id: value,
              "aria-describedby": value2,
              "aria-invalid": value3,
              disabled: value4,
              ...value5
            } = props,
            state = {
              id: value,
              "aria-describedby": value2,
              disabled: value4,
            },
            value6 = (0, runtime.useTranslation)("clear", "Clear"),
            value7 = clearLabel ?? value6,
            value8 = useFieldInvalid(),
            value9 = value8 || value3,
            value10 = useFieldDisabled(),
            value11 = value4 || value10,
            value12 = fullWidth ? "w-full" : "",
            value13 = fullWidth ? "w-full min-w-0" : "",
            ref = reactForUiMenu.useRef<HTMLInputElement>(null),
            { clickToFocusProps: value14 } = (0,
            runtime.useClickToFocus)(() => ref.current?.focus(), {
              disabled: value11,
              readOnly: value5.readOnly,
            }),
            value15 = (0, runtime.useMergedRefs)(ref, options),
            value16 = value5.value !== undefined,
            [value17, value18] = reactForUiMenu.useState(
              () =>
                value5.defaultValue !== undefined &&
                String(value5.defaultValue).length > 0,
            ),
            value19 = value16
              ? value5.value !== undefined && String(value5.value).length > 0
              : value17,
            callback = (event: ChangeEvent<HTMLInputElement>) => {
              if (clearable && !value16) {
                value18(event.target.value.length > 0);
              }
              onChange?.(event);
            },
            callback2 = () => {
              let current = ref.current;
              if (!value16 && current) {
                Object.getOwnPropertyDescriptor(
                  window.HTMLInputElement.prototype,
                  "value",
                )?.set?.call(current, "");
                current.dispatchEvent(
                  new Event("input", {
                    bubbles: true,
                  }),
                );
                value18(false);
              }
              onClear?.();
              current?.focus();
            },
            value20 =
              (clearable === "always" || (clearable && value19)) && !value11,
            value21 =
              value20 &&
              value19 &&
              (!value16 || onClear !== undefined) &&
              !value5.readOnly,
            value22 = value20
              ? jsxForUiMenu.jsx(runtime.Button, {
                  iconOnly: true,
                  variant: "ghost",
                  size: size === "sm" || size === "xs" ? "xs" : "sm",
                  className:
                    "!size-[var(--fhn)] !rounded-[calc(var(--fr)-(var(--fh)-var(--fhn))/2)]",
                  icon: "X",
                  "aria-label": value7,
                  tooltip: false,
                  tabIndex: value21 ? -1 : undefined,
                  onMouseDown: (event: ReactMouseEvent<HTMLElement>) =>
                    event.preventDefault(),
                  onClick: callback2,
                })
              : null,
            ref2 = reactForUiMenu.useRef(false),
            callback3 = (event: ReactKeyboardEvent<HTMLInputElement>) => {
              event.preventDefault();
              event.stopPropagation();
              event.nativeEvent.stopImmediatePropagation();
            },
            callback4 = (event: ReactKeyboardEvent<HTMLInputElement>) => {
              onKeyDown?.(event);
              if (event.key === "Escape" && !event.repeat) {
                ref2.current = false;
              }
              if (
                !(
                  event.key === "Escape" &&
                  !(
                    event.metaKey ||
                    event.ctrlKey ||
                    event.altKey ||
                    event.shiftKey
                  ) &&
                  !event.nativeEvent.isComposing &&
                  event.nativeEvent.keyCode !== 229 &&
                  !event.defaultPrevented &&
                  !event.isPropagationStopped()
                )
              ) {
                return;
              }
              if (event.repeat) {
                if (ref2.current) {
                  callback3(event);
                }
                return;
              }
              ref2.current = value21 && event.currentTarget.value !== "";
              if (ref2.current) {
                callback3(event);
                callback2();
              }
            };
          if (slotStart || slotEnd || clearable) {
            let value23 = value22
                ? TEXT_INPUT_CLEAR_BUTTON_CLASS
                : "pr-md",
              value24 = `flex shrink-0 items-center gap-[var(--cds-pad-sm,6px)] text-muted [--fh:var(--cds-h-control)] [--fr:var(--cds-radius)] [--fhn:var(--cds-h-control-nested)] ${TEXT_INPUT_CLUSTER_CLASS}`;
            return jsxForUiMenu.jsxs("div", {
              "data-cds": "TextInput",
              ...(0, runtime.getControlSizeAttributes)(size),
              "data-invalid": value8 || undefined,
              onMouseDown: value14.onMouseDown,
              className: (0, runtime.cn)(
                TextInput_oE0,
                value23,
                TEXT_INPUT_ICON_CLASS,
                "inline-flex",
                value13,
                value11 ? "cursor-default" : "cursor-text",
                "items-center gap-[var(--cds-pad-sm,6px)] has-[:focus-visible]:shadow-focus",
                "has-[input:disabled]:opacity-disabled",
                value11 ? undefined : runtime.TEXT_INPUT_HOVER_CLASS,
                className,
              ),
              children: [
                slotStart
                  ? jsxForUiMenu.jsx("span", {
                      className: "flex shrink-0 items-center text-muted",
                      children: slotStart,
                    })
                  : null,
                jsxForUiMenu.jsx(runtime.baseField.Control, {
                  ...state,
                  render: jsxForUiMenu.jsx("input", {
                    ref: value15,
                    "aria-invalid": value9,
                    ...value5,
                    onChange: callback,
                    onKeyDown: callback4,
                    className: (0, runtime.cn)(
                      TEXT_INPUT_CLEAR_CLASS,
                      "disabled:opacity-100",
                    ),
                  }),
                }),
                value22 || slotEnd
                  ? jsxForUiMenu.jsxs("span", {
                      "data-cds-end-slot": "",
                      className: value24,
                      children: [slotEnd, value22],
                    })
                  : null,
              ],
            });
          }
          return jsxForUiMenu.jsx(runtime.baseField.Control, {
            ref: options,
            ...state,
            render: jsxForUiMenu.jsx("input", {
              "data-cds": "TextInput",
              ...(0, runtime.getControlSizeAttributes)(size),
              "data-invalid": value8 || undefined,
              "aria-invalid": value9,
              ...value5,
              onChange: callback,
              onKeyDown: callback4,
              className: (0, runtime.cn)(
                "cds-input cds-reset",
                TextInput_oE0,
                "pr-md",
                value12,
                "placeholder:text-muted outline-none focus-visible:outline-hidden enabled:[&:hover:not(:focus):not([data-invalid])]:shadow-field-hover focus-visible:shadow-focus disabled:opacity-disabled",
                className,
              ),
            }),
          });
        },
      );
      TextInput.displayName = "TextInput";
    });
    SHEET_PENDING_ATTRIBUTE = "data-cds-sheet-pending";
    preventPendingSheetFocus = (event: PreventableEvent) => {
      event.preventDefault();
    };
    initializeUiMenu3 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeLayers)();
      (0, runtime.initializeAndroidCloseWatcher)();
      (0, runtime.initializePortalRoot)();
      (0, runtime.initializeAdaptiveSheets)();
      (0, runtime.initializeSheetClassNames)();
      (0, runtime.initializeNpmDependency)();
      reactiZ = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxZu = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      reactDOMrG0 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactDomNamespace)(),
        1,
      );
      concealedPopupStyle = {
        visibility: "hidden",
        opacity: 0,
      };
    });
    COMPOSITION_TIME_SENTINEL = -1e8;
    initializeUiMenu4 = (0, runtime.initializeOnce)(() => {
      lastCompositionEndTime = COMPOSITION_TIME_SENTINEL;
      suppressedCompositionEvents = new WeakSet();
      compositionLineBreakInputTypes = new Set([
        "insertParagraph",
        "insertLineBreak",
      ]);
      compositionSuppressionResetEvents = [
        "beforeinput",
        "keydown",
        "keyup",
        "compositionstart",
        "focusout",
      ];
    });
    checkboxVisualClasses =
      "flex shrink-0 size-[var(--cds-checkbox)] items-center justify-center rounded-[var(--cds-checkbox-radius)] border border-strong bg-transparent";
    CHECKBOX_MARK_CLASS =
      "inline-flex gap-xs text-start font-sans text-body font-normal text-primary";
    CheckboxMark = "mt-[calc((1lh_-_var(--cds-checkbox,1rem))_/_2)]";
    initializeUiMenu5 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeIcons)();
      jsxsM = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
    });
    initializeUiMenu6 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeTooltip)();
      (0, runtime.initializeMenuContexts)();
      (0, runtime.initializePassiveOpen)();
      (0, runtime.initializeMenuOpener)();
      jsxo_ = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
    });
    initializeUiMenu7 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeElementAccess)();
    });
    initializeUiMenu8 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeIsomorphicLayoutEffect)();
      reacttM = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
    });
    menuGroupLabelClasses =
      "compact:px-2 comfortable:px-2.5 py-1 text-footnote font-medium text-muted";
    MENU_PLACEHOLDER_MINIMUM_WIDTH = 20;
    HIGHLIGHTED_MENU_ITEM_SELECTOR = '[data-highlighted][tabindex="0"]';
    initializeUiMenu9 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeMediaQueryStores)();
      (0, runtime.initializeIsomorphicLayoutEffect)();
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeCdsLink)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeElementAccess)();
      (0, runtime.initializeLayers)();
      (0, runtime.initializeEventCallbacks)();
      (0, runtime.initializeClickToFocus)();
      (0, runtime.initializeElementNamespaces)();
      (0, runtime.initializeCloseOnActivityHide)();
      (0, runtime.initializeMergedRefs)();
      (0, runtime.initializePortalRoot)();
      (0, runtime.initializeIcons)();
      (0, runtime.initializeCollisionPadding)();
      (0, runtime.initializeShortcuts)();
      (0, runtime.initializeDisabledReason)();
      (0, runtime.initializeTooltip)();
      (0, runtime.initializeUiDisclosure9)();
      (0, runtime.initializeSurfaces)();
      (0, runtime.initializeUiDisclosure10)();
      (0, runtime.initializeOverlayActions)();
      (0, runtime.initializePresentationMode)();
      (0, runtime.initializeAdaptiveSheets)();
      initializeUiMenu3();
      initializeUiMenu4();
      initializeUiMenu5();
      initializeUiMenu2();
      (0, runtime.initializeMenuContexts)();
      (0, runtime.initializeKeyboardContextMenuFocus)();
      (0, runtime.initializeMenuScrollContent)();
      (0, runtime.initializeContextMenuPopup)();
      (0, runtime.initializePassiveOpen)();
      (0, runtime.initializeMenuItemVariants)();
      (0, runtime.initializeMenuOpener)();
      initializeUiMenu6();
      (0, runtime.initializeMenuPopupElement)();
      initializeUiMenu7();
      (0, runtime.initializeStablePopupPlacement)();
      initializeUiMenu8();
      (0, runtime.initializeNpmDependency)();
      (0, runtime.initializeNpmDependency)();
      (0, runtime.initializeNpmDependency)();
      (0, runtime.initializeNpmDependency)();
      reacta0 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxC0 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      numericShortcutPattern = /^\d+$/;
      MenuPopup = reacta0.forwardRef<HTMLDivElement, MenuPopupProps>(
        (
          {
            align = "start",
            stableWhileOpen = false,
            "data-cds": dataCds = "Menu",
            ...props
          }: MenuPopupProps,
          options,
        ) => {
          let state = {
              align: align,
              stableWhileOpen: stableWhileOpen,
              "data-cds": dataCds,
              ...props,
            },
            value = (0, runtime.useHasSheetFrame)(),
            value2 = useMenuPopupElement(
              state,
              options,
              !value,
              false,
            );
          if (value) {
            return jsxC0.jsx(MenuSheetCapablePopup, {
              ...state,
              ref: options,
            });
          }
          return value2;
        },
      );
      MenuPopup.displayName = "Menu.Popup";
      MenuSheetCapablePopup = reacta0.forwardRef<HTMLDivElement, MenuPopupProps>(
        (input, options) => {
          let value = (0, runtime.useSheetImplementation)(),
            { pending: value2 } = (0, runtime.useSheetState)(),
            value3 = reacta0.useContext(runtime.menuTriggerContext),
            value4 =
              reacta0.useContext(runtime.contextMenuContext) && value3 === null
                ? "contextmenu"
                : "menu",
            value5 = useMenuPopupElement(
              input,
              options,
              value === null,
              value === null && value2,
            );
          if (value !== null) {
            return jsxC0.jsx(value.MenuSheetPopup, {
              ...input,
              ref: options,
            });
          }
          return jsxC0.jsxs(jsxC0.Fragment, {
            children: [
              value5,
              value2 && value3 === null
                ? jsxC0.jsx(PendingSheetBackdrop, {
                    kind: value4,
                  })
                : null,
            ],
          });
        },
      );
      MenuSheetCapablePopup.displayName = "MenuSheetCapablePopup";
      MenuItem = reacta0.forwardRef<HTMLElement, MenuItemProps>(
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
          options,
        ) => {
          let value = indicator === "checkbox",
            value2 = value
              ? href !== undefined
                ? undefined
                : (checked ?? false)
              : checked,
            value3 = value ? "checkbox" : (checkedRole ?? "checkbox"),
            value4 = checkPosition ?? (value ? "leading" : "trailing"),
            value5 = (0, runtime.useAppleKeyboard)(),
            value6 = reacta0.useId(),
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
            callback = (input: ReactElement) =>
              disabledReason === undefined
                ? input
                : jsxC0.jsx(runtime.Tooltip, {
                    content: value11 ? disabledReason : undefined,
                    side: "right",
                    multiline: true,
                    closeOnClick: false,
                    children: jsxC0.jsxs("div", {
                      role: "none",
                      children: [
                        input,
                        jsxC0.jsx(runtime.DisabledReasonAnnouncement, {
                          id: value6,
                          reason: value11 ? disabledReason : undefined,
                        }),
                      ],
                    }),
                  }),
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
            value15 =
              value2 !== undefined &&
              jsxC0.jsx("span", {
                className: (0, runtime.clsx)(
                  "flex size-icon shrink-0 items-center justify-center",
                  value4 === "trailing" && !hint && !shortcut && "-mr-1",
                  Boolean(value4 === "trailing" && shortcut && !hint) &&
                    "pointer-coarse:-mr-1",
                  value &&
                    value4 === "leading" &&
                    "-ml-1 group-has-[[data-cds-icon-row]]/menu-popup:ml-0",
                ),
                style: value
                  ? undefined
                  : {
                      color: "var(--cds-fill-accent)",
                    },
                children: value
                  ? jsxC0.jsx("span", {
                      "data-size": "xs",
                      className: "flex shrink-0",
                      children: jsxC0.jsx(CheckboxVisual, {
                        checked: value2,
                        indeterminate: indeterminate,
                      }),
                    })
                  : value2 &&
                    jsxC0.jsx(runtime.Icon, {
                      name: "Check",
                      size: "auto",
                      bold: true,
                    }),
              }),
            value16 = jsxC0.jsxs(jsxC0.Fragment, {
              children: [
                leading,
                value4 === "leading" && value15,
                icon !== undefined &&
                  jsxC0.jsx(runtime.IconSlot, {
                    icon: icon,
                  }),
                description
                  ? jsxC0.jsxs("span", {
                      className: "flex min-w-0 flex-1 flex-col",
                      children: [
                        jsxC0.jsx("span", {
                          ref: value8,
                          className: "truncate",
                          children: children,
                        }),
                        jsxC0.jsx("span", {
                          className:
                            "truncate py-[0.125em] -my-[0.125em] text-footnote text-muted group-data-[highlighted]/menu-danger:text-on-danger",
                          children: description,
                        }),
                      ],
                    })
                  : jsxC0.jsx("span", {
                      ref: value8,
                      className: "min-w-0 flex-1 truncate",
                      children: children,
                    }),
                Boolean(
                  trailing ||
                    (value2 !== undefined && value4 === "trailing") ||
                    hint ||
                    shortcut,
                ) &&
                  jsxC0.jsxs("span", {
                    className: (0, runtime.clsx)(
                      "ml-md flex shrink-0 items-center gap-xs",
                      Boolean(
                        shortcut &&
                          !trailing &&
                          !(value2 !== undefined && value4 === "trailing") &&
                          !hint,
                      ) && "pointer-coarse:hidden",
                    ),
                    children: [
                      trailing,
                      value4 === "trailing" && value15,
                      hint &&
                        jsxC0.jsx("span", {
                          className: `max-w-[160px] shrink-0 truncate py-[0.125em] -my-[0.125em] text-footnote text-muted group-data-[highlighted]/menu-danger:text-on-danger ${getShortcutNumeralClasses(hint)}`,
                          children: hint,
                        }),
                      shortcut &&
                        jsxC0.jsx(MenuShortcut, {
                          keys: shortcut,
                        }),
                    ],
                  }),
              ],
            });
          if (href !== undefined) {
            let value17 = (0, runtime.omitLinkEventProps)(state);
            return callback(
              jsxC0.jsx(runtime.baseMenu.Item, {
                ref: value10,
                ...value17,
                ...value12,
                closeOnClick: keepOpen ? false : undefined,
                className: value14,
                render: jsxC0.jsx("a", {
                  ...value13,
                }),
                children: value16,
              }),
            );
          }
          if (value2 !== undefined) {
            if (value3 === "radio") {
              return callback(
                jsxC0.jsx(runtime.baseMenu.Item, {
                  ref: value10,
                  ...state,
                  ...value12,
                  role: "menuitemradio",
                  "aria-checked": value2,
                  closeOnClick: keepOpen ? false : undefined,
                  className: value14,
                  children: value16,
                }),
              );
            }
            return callback(
              jsxC0.jsx(runtime.baseMenu.CheckboxItem, {
                ref: value10,
                ...state,
                ...(value && indeterminate
                  ? {
                      "aria-checked": "mixed",
                    }
                  : {}),
                ...value12,
                checked: value2,
                closeOnClick: value ? false : !keepOpen,
                className: value14,
                children: value16,
              }),
            );
          }
          return callback(
            jsxC0.jsx(runtime.baseMenu.Item, {
              ref: value10,
              ...state,
              ...value12,
              closeOnClick: keepOpen ? false : undefined,
              className: value14,
              children: value16,
            }),
          );
        },
      );
      MenuItem.displayName = "Menu.Item";
      MenuSubmenuTrigger = reacta0.forwardRef<HTMLElement, MenuSubmenuTriggerProps>(
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
          options,
        ) => {
          let value = reacta0.useContext(runtime.menuTriggerContext),
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
          return jsxC0.jsxs(runtime.baseMenu.SubmenuTrigger, {
            ref: value7,
            "data-cds-icon-row": icon !== undefined ? "" : undefined,
            ...props,
            label: value4,
            ...value3,
            openOnHover: value2 ? false : openOnHover,
            className: (0, runtime.cn)(
              (0, runtime.menuItemVariants)({
                variant: "default",
              }),
              "justify-between data-[popup-open]:bg-fill-ghost-hover",
              className,
            ),
            children: [
              leading,
              icon !== undefined &&
                jsxC0.jsx(runtime.IconSlot, {
                  icon: icon,
                }),
              jsxC0.jsx("span", {
                ref: value5,
                className: "min-w-0 flex-1 truncate",
                children: children,
              }),
              trailing || hint
                ? jsxC0.jsxs("span", {
                    className: "ml-md flex shrink-0 items-center gap-xs",
                    children: [
                      trailing,
                      hint &&
                        jsxC0.jsx("span", {
                          className: `max-w-[160px] shrink-0 truncate py-[0.125em] -my-[0.125em] text-footnote text-muted ${getShortcutNumeralClasses(hint)}`,
                          children: hint,
                        }),
                      jsxC0.jsx(runtime.Icon, {
                        name: "CaretRight",
                        size: "sm",
                        className: "-mr-1 shrink-0 text-muted",
                      }),
                    ],
                  })
                : jsxC0.jsx(runtime.Icon, {
                    name: "CaretRight",
                    size: "sm",
                    className: "-mr-1 shrink-0 text-muted",
                  }),
            ],
          });
        },
      );
      MenuSubmenuTrigger.displayName = "Menu.SubmenuTrigger";
      (MenuSubmenu as DisplayNamed).displayName = "Menu.Submenu";
      (MenuSeparator as DisplayNamed).displayName = "Menu.Separator";
      (MenuHeader as DisplayNamed).displayName = "Menu.Header";
      (MenuGroupLabel as DisplayNamed).displayName = "Menu.GroupLabel";
      (SimpleMenu as DisplayNamed).displayName = "Menu";
      (MenuRoot as DisplayNamed).displayName = "Menu.Root";
      MenuTriggerButton = reacta0.forwardRef<HTMLElement, MenuTriggerButtonProps>(function (
        { children: children, id: id, ...props }: MenuTriggerButtonProps,
        options,
      ) {
        return jsxC0.jsx(runtime.baseMenu.Trigger, {
          id: id,
          disabled: props.disabled || props.busy,
          render: jsxC0.jsxs(runtime.Button, {
            ref: options,
            ...props,
            ...(props.busy
              ? {
                  disabled: props.disabled,
                }
              : undefined),
            children: [
              children,
              jsxC0.jsx(MenuCaret, {
                size: props.size,
              }),
            ],
          }),
        });
      });
      MenuTriggerButton.displayName = "Menu.TriggerButton";
      (MenuSearchablePopup as DisplayNamed).displayName = "Menu.SearchablePopup";
      emptyMenuSize = {
        width: 0,
        height: 0,
      };
      (MenuPendingList as DisplayNamed).displayName = "Menu.PendingList";
      MenuBar = reacta0.forwardRef<HTMLDivElement, MenuBarProps>(function (
        { className: className, ...props }: MenuBarProps,
        options,
      ) {
        return jsxC0.jsx(runtime.menuBarContext.Provider, {
          value: true,
          children: jsxC0.jsx(runtime.baseMenubar, {
            ref: options,
            "data-cds": "MenuBar",
            ...props,
            className: (0, runtime.cn)("flex items-center gap-xs", className),
          }),
        });
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
    });
    initializeUiMenu10 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeAdaptiveSheets)();
      initializeUiMenu3();
      jsxtK = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
    });
    POPOVER_LAYOUT_INHERIT_CLASS =
      "[display:inherit] [flex-direction:inherit] [flex-wrap:inherit] [align-items:inherit] [justify-content:inherit] [justify-items:inherit] [gap:inherit] [grid-template-columns:inherit] [grid-template-rows:inherit] [grid-auto-flow:inherit] [grid-auto-columns:inherit] [grid-auto-rows:inherit] col-span-full row-span-full self-stretch justify-self-stretch max-h-[inherit] min-h-0 min-w-0 flex-auto overflow-y-auto rounded-[inherit] outline-none focus-visible:outline-hidden";
    initializeUiMenu11 = (0, runtime.initializeOnce)(() => {
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
      (0, runtime.initializeSheetStyles)();
      (0, runtime.initializePresentationMode)();
      (0, runtime.initializeAdaptiveSheets)();
      (0, runtime.initializeSheetClassNames)();
      initializeUiMenu3();
      initializeUiMenu10();
      (0, runtime.initializeOverlayFocus)();
      (0, runtime.initializeOverlayStack)();
      (0, runtime.initializePopupPointerFocus)();
      (0, runtime.initializeNpmDependency)();
      reactD6 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxU7 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      POPOVER_SURFACE_CLASS = `draggable-none max-w-[320px] max-h-[var(--available-height)] ${(0, runtime.getSurfaceClasses)("popover")} cds-reset text-body font-normal text-primary outline-none focus-visible:outline-hidden`;
      POPOVER_PADDING_CLASSES = {
        none: "p-0",
        xs: "p-xs",
        sm: "p-sm",
        md: "p-md",
        lg: "p-lg",
      };
      POPOVER_PADDING_OVERFLOW_CLASS_PATTERN =
        /(?:^|\s)!?(?:-?p[xysetrbl]?-[^\s:]+|overflow-[^\s:]+)!?(?=\s|$)/;
      POPOVER_PADDING_OVERFLOW_STYLE_PATTERN = /^(?:padding|overflow[XY]?$)/;
      PopoverPopupInner = reactD6.forwardRef<HTMLDivElement, PopoverPopupInnerProps>(
        (
          {
            anchored: anchored,
            finalFocus: finalFocus,
            className: className,
            children: children,
            ...props
          }: PopoverPopupInnerProps,
          options,
        ) => {
          let value =
              reactD6.useContext(runtime.sheetFrameContext)?.open ?? true,
            value2 = anchored && finalFocus === undefined,
            value3 = (0, runtime.useOverlayFocusReturn)({
              skipRestoreOnOutsideFocus: true,
              open: value,
              registerOpenerReturn: value2,
            }),
            value4 = (0, runtime.useMergedRefs)(
              options,
              value3.popupRef,
            );
          return jsxU7.jsx(runtime.basePopover.Popup, {
            "data-cds": "Popover",
            [runtime.OVERLAY_ATTRIBUTE]: "",
            ref: value4,
            finalFocus: value2 ? value3.finalFocus : finalFocus,
            ...props,
            className: className,
            children: children,
          });
        },
      );
      PopoverPopupInner.displayName = "Popover.PopupInner";
      PopoverPopup = reactD6.forwardRef<HTMLDivElement, PopoverPopupProps>(
        (
          {
            side = "bottom",
            align = "center",
            sideOffset = 6,
            padding = "lg",
            scrollFade = true,
            ...props
          }: PopoverPopupProps,
          options,
        ) => {
          let state = {
            side: side,
            align: align,
            sideOffset: sideOffset,
            padding: padding,
            scrollFade: scrollFade,
            ...props,
          };
          if ((0, runtime.useHasSheetFrame)()) {
            return jsxU7.jsx(PopoverSheetCapablePopup, {
              ...state,
              ref: options,
            });
          } else {
            return jsxU7.jsx(PopoverPopupView, {
              ...state,
              ref: options,
              sheetPopup: runtime.defaultSheetHost,
              sheetParts: null,
            });
          }
        },
      );
      PopoverPopup.displayName = "Popover.Popup";
      PopoverSheetCapablePopup = reactD6.forwardRef<HTMLDivElement, PopoverPopupProps>(
        (input, options) =>
          jsxU7.jsx(AdaptiveSheetPopupHost, {
            kind: "popover",
            children: (input2: SheetHost, options2: SheetImplementation | null) =>
              jsxU7.jsx(PopoverPopupView, {
                ...input,
                ref: options,
                sheetPopup: input2,
                sheetParts: options2,
              }),
          }),
      );
      PopoverSheetCapablePopup.displayName = "PopoverSheetCapablePopup";
      PopoverPopupView = reactD6.forwardRef<HTMLDivElement, PopoverPopupViewProps>(function (
        { sheetPopup: sheetPopup, sheetParts: sheetParts, ...props }: PopoverPopupViewProps,
        options,
      ) {
        let {
            side: value12 = "bottom",
            align: value13 = "center",
            sideOffset: value14 = 6,
            alignOffset: value,
            anchor: value2,
            collisionPadding: value3,
            padding: value15 = "lg",
            scrollFade: value16 = true,
            layerOffset: value4,
            closeLabel: value5,
            sheetHeight: value6,
            className: value7,
            children: value8,
            onFocus: value9,
            onMouseDown: value10,
            keepFocus: value17 = false,
            ...value11
          } = props,
          ref = reactD6.useRef<HTMLDivElement>(null),
          sheet = sheetPopup.sheet,
          value18 = reactD6.useContext(runtime.sheetFrameContext),
          value19 =
            (value18?.open ?? false) && value18?.height !== undefined,
          value20 = value18?.setDetent;
        (0, runtime.useIsomorphicLayoutEffect)(() => {
          let current = ref.current;
          if (
            sheet &&
            value19 &&
            value6 === "tall" &&
            current !== null &&
            current.querySelector(
              'input:not([type=button],[type=checkbox],[type=radio],[type=range],[type=submit],[type=reset],[type=color],[type=file],[type=image],[type=hidden],[readonly]), textarea:not([readonly]), [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]',
            ) !== null
          ) {
            value20?.("tall");
          }
        }, [sheet, value19, value6, value20]);
        let value21 =
            sheetPopup.sheet && sheetParts !== null ? sheetParts : null,
          value22 = reactD6.useContext(popoverStateContext),
          value23 = value11.initialFocus === false,
          callback = (event: ReactMouseEvent<HTMLElement>) => {
            let value31 = (0, runtime.asElement)(event.target);
            if (
              !value17 ||
              value31 === null ||
              !event.currentTarget.contains(value31)
            ) {
              return;
            }
            if (
              !(0, runtime.shouldAllowPopupPointerFocus)(event, {
                draggable: true,
              })
            ) {
              event.preventDefault();
            }
          },
          value24 = reactD6.useContext(popoverControlledStateContext);
        (0, runtime.useIsomorphicLayoutEffect)(() => {
          if (value22 === null) {
            return;
          }
          value22.update({
            popupMounted: true,
            declinesFocus: value23,
            anchor: value2,
          });
          return () => {
            value22.update({
              popupMounted: false,
            });
          };
        }, [value22, value23, value2]);
        let value25 = useRefocusAfterPendingSheet(
            sheetPopup.concealed && !value23,
          ),
          value26 = (0, runtime.useMergedRefs)(
            options,
            sheetPopup.ref,
            value25,
          ),
          value27 = (0, runtime.useOverlayLayer)("popover", value4);
        usePopoverStyleDebug(value7, value11.style);
        let value28 = reactD6.Children.toArray(value8),
          value29 = value28.filter(isPopoverArrow),
          value30 = jsxU7.jsx(runtime.overlayStackContext.Provider, {
            value: value24,
            children: value28.filter(
              (input) => !isPopoverArrow(input),
            ),
          });
        return jsxU7.jsx(runtime.basePopover.Portal, {
          container: (0, runtime.usePortalContainer)(),
          children: jsxU7.jsxs(runtime.PortalRoot, {
            ...value27.portalProps,
            style: sheetPopup.concealed
              ? {
                  ...value27.portalProps.style,
                  ...concealedPopupStyle,
                }
              : value27.portalProps.style,
            surface: runtime.elevationSurfaceNames.popover,
            density: sheet ? runtime.SHEET_DENSITY : undefined,
            companionModalCatcher: !sheet,
            closeOnActivityHide: true,
            children: [
              value21 !== null &&
                sheetPopup.sheet &&
                jsxU7.jsx(value21.PopoverSheetBackdrop, {
                  sheetPopup: sheetPopup,
                }),
              jsxU7.jsx(runtime.layerBaseContext.Provider, {
                value: value27.base,
                children: jsxU7.jsx(runtime.basePopover.Positioner, {
                  style:
                    sheetPopup.positionerStyle !== undefined
                      ? {
                          ...value27.style,
                          ...sheetPopup.positionerStyle,
                        }
                      : value27.style,
                  side: value12,
                  align: value13,
                  sideOffset: value14,
                  alignOffset: value,
                  anchor: value2,
                  collisionPadding: value3,
                  ...(sheet ? runtime.sheetPositioningOverrides : {}),
                  className:
                    sheet && sheetPopup.state.depth === 0
                      ? runtime.sheetOverflowBackgroundClasses
                      : undefined,
                  children: jsxU7.jsx(PopoverPopupInner, {
                    anchored: value2 !== undefined && value2 !== null,
                    ref: value26,
                    ...sheetPopup.attrs,
                    ...value11,
                    ...(sheet
                      ? {
                          initialFocus: undefined,
                        }
                      : {}),
                    onMouseDown: sheet
                      ? value10
                      : (input: BaseUIEvent<ReactMouseEvent<HTMLDivElement>>) => {
                          value10?.(input);
                          callback(input);
                        },
                    style:
                      sheetPopup.style === undefined
                        ? value11.style
                        : typeof value11.style === "function"
                          ? (input: BasePopover.Popup.State) => ({
                              ...(
                                value11.style as (
                                  state: BasePopover.Popup.State,
                                ) => CSSProperties | undefined
                              )(input),
                              ...sheetPopup.style,
                            })
                          : {
                              ...value11.style,
                              ...sheetPopup.style,
                            },
                    onFocus: (event: BaseUIEvent<ReactFocusEvent<HTMLDivElement>>) => {
                      value9?.(event);
                      let currentTarget = event.currentTarget;
                      if (
                        event.target === currentTarget &&
                        currentTarget.ownerDocument.activeElement ===
                          currentTarget
                      ) {
                        ref.current?.focus({
                          preventScroll: true,
                        });
                      }
                    },
                    className: (0, runtime.cn)(
                      POPOVER_SURFACE_CLASS,
                      sheet && runtime.sheetPopupClasses,
                      sheet &&
                        "data-[starting-style]:translate-y-[calc(100%+1.5rem)] data-[ending-style]:translate-y-[calc(100%+1.5rem)]",
                      sheet &&
                        "origin-top [&[data-cds-sheet-covered]:not([data-starting-style]):not([data-ending-style])]:-translate-y-3 data-[cds-sheet-covered]:scale-[0.94] after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-backdrop after:opacity-0 after:transition-opacity after:duration-sheet motion-reduce:after:transition-none data-[cds-sheet-covered]:after:opacity-100",
                      sheet && "flex flex-col",
                      !sheet && value7,
                    ),
                    children:
                      value21 !== null && sheetPopup.sheet
                        ? jsxU7.jsx(value21.PopoverSheetContent, {
                            sheetPopup: sheetPopup,
                            className: value7,
                            bodyRef: ref,
                            bodyClassName: (0, runtime.cn)(
                              POPOVER_LAYOUT_INHERIT_CLASS,
                              value16 && "scroll-fade-y",
                              POPOVER_PADDING_CLASSES[value15],
                            ),
                            closeLabel: value5,
                            children: value30,
                          })
                        : jsxU7.jsxs(jsxU7.Fragment, {
                            children: [
                              jsxU7.jsx("div", {
                                ref: ref,
                                tabIndex: -1,
                                "data-cds-popover-body": "",
                                [runtime.SHEET_SCROLL_ATTRIBUTE]: "",
                                className: (0, runtime.cn)(
                                  POPOVER_LAYOUT_INHERIT_CLASS,
                                  value16 && "scroll-fade-y",
                                  POPOVER_PADDING_CLASSES[value15],
                                ),
                                children: value30,
                              }),
                              value29,
                            ],
                          }),
                  }),
                }),
              }),
            ],
          }),
        });
      });
      PopoverPopupView.displayName = "PopoverPopupView";
      popoverStateContext = reactD6.createContext<PopoverMountStore | null>(null);
      popoverControlledStateContext = reactD6.createContext<
        ReturnType<RuntimeBindings["createOverlayStack"]> | null
      >(null);
      (PopoverRoot as DisplayNamed).displayName = "Popover.Root";
      PopoverTrigger = reactD6.forwardRef<HTMLElement, BasePopover.Trigger.Props>(function (
        input,
        options,
      ) {
        let value = reactD6.useContext(popoverStateContext),
          callback = reactD6.useCallback(
            (input2: HTMLElement | null) => {
              value?.update({
                triggerEl: input2,
              });
            },
            [value],
          ),
          value2 = (0, runtime.useMergedRefs)(options, callback);
        return jsxU7.jsx(runtime.basePopover.Trigger, {
          ...input,
          ref: value2,
        });
      });
      PopoverTrigger.displayName = "Popover.Trigger";
      PopoverTriggerAlias = PopoverTrigger;
      PopoverComponents = {
        Root: PopoverRoot,
        Trigger: PopoverTriggerAlias,
        Popup: PopoverPopup,
        Title: runtime.basePopover.Title,
        Description: runtime.basePopover.Description,
        Close: runtime.basePopover.Close,
        Arrow: runtime.basePopover.Arrow,
        createHandle: runtime.basePopover.createHandle,
      };
    });
    initializeUiMenu12 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeUiDisclosure)();
      (0, runtime.initializeTooltip)();
      initializeUiMenu5();
      (0, runtime.initializeNpmDependency)();
      (0, runtime.initializeNpmDependency)();
      reactForUiMenu2 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiMenu2 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      CHECKBOX_CLASS = `${checkboxVisualClasses} transition-colors duration-fast ease-out motion-reduce:transition-none group-data-[unchecked]/cb:group-hover/cb:border-stronger group-data-[checked]/cb:bg-fill-accent group-data-[checked]/cb:border-transparent group-data-[indeterminate]/cb:bg-fill-accent group-data-[indeterminate]/cb:border-transparent group-data-[checked]/cb:group-hover/cb:bg-fill-accent-hover group-data-[indeterminate]/cb:group-hover/cb:bg-fill-accent-hover group-data-[disabled]/cb:group-data-[unchecked]/cb:group-hover/cb:border-strong group-focus-visible/cb:shadow-focus`;
      Checkbox = reactForUiMenu2.forwardRef<HTMLButtonElement, CheckboxProps>(
        (
          {
            label: label,
            description: description,
            size: size,
            className: className,
            disabledReason: disabledReason,
            "aria-describedby": ariaDescribedby,
            "aria-labelledby": ariaLabelledby,
            onMouseDown: onMouseDown,
            ...props
          }: CheckboxProps,
          options,
        ) => {
          let value = reactForUiMenu2.useId(),
            value2 = reactForUiMenu2.useId(),
            value3 =
              label !== null &&
              label !== undefined &&
              typeof label !== "boolean" &&
              label !== "",
            value4 = value3 && !!description,
            [value5, value6] = reactForUiMenu2.useState(
              props.indeterminate ?? false,
            ),
            value7 =
              props.indeterminate === true ||
              (props.checked === false && value5);
          if (value7 !== value5) {
            value6(value7);
          }
          let value8 = jsxForUiMenu2.jsxs(runtime.baseCheckbox.Root, {
            ref: options,
            "data-cds": "Checkbox",
            "aria-labelledby":
              ariaLabelledby ||
              (value4 && !props["aria-label"] ? value : undefined),
            "aria-describedby":
              [ariaDescribedby, value4 ? value2 : undefined]
                .filter(Boolean)
                .join(" ") || undefined,
            ...props,
            ...(size === "xxs"
              ? {
                  "data-size": "xxs",
                }
              : (0, runtime.getControlSizeAttributes)(size)),
            onMouseDown: (0, runtime.withRepeatedClickSelectionPrevention)(
              onMouseDown,
            ),
            className: (0, runtime.cn)(
              "cds-reset group/cb border-0 outline-none focus-visible:outline-hidden data-[disabled]:opacity-disabled",
              CHECKBOX_MARK_CLASS,
              value3 ? "items-start" : "items-center",
              size === "xxs" &&
                "[--cds-checkbox:var(--cds-checkbox-xxs)] [--cds-checkbox-radius:var(--cds-checkbox-xxs-radius)] [--cds-checkbox-glyph:var(--cds-checkbox-xxs-glyph)]",
              className,
            ),
            children: [
              jsxForUiMenu2.jsx("span", {
                className: (0, runtime.clsx)(
                  CHECKBOX_CLASS,
                  value3 && "mt-[calc((1lh_-_var(--cds-checkbox,1rem))_/_2)]",
                ),
                children: jsxForUiMenu2.jsx("span", {
                  className:
                    "text-on-accent [clip-path:inset(0_100%_0_0)] transition-[clip-path] duration-snap ease-out motion-reduce:transition-none group-data-[checked]/cb:[clip-path:inset(0)] group-data-[checked]/cb:duration-base group-data-[indeterminate]/cb:[clip-path:inset(0)] group-data-[indeterminate]/cb:duration-base",
                  children: jsxForUiMenu2.jsx(CheckboxGlyph, {
                    indeterminate: value7,
                  }),
                }),
              }),
              value3 &&
                (value4
                  ? jsxForUiMenu2.jsxs("span", {
                      className: "flex min-w-0 flex-col",
                      children: [
                        jsxForUiMenu2.jsx("span", {
                          id: value,
                          children: label,
                        }),
                        jsxForUiMenu2.jsx("span", {
                          id: value2,
                          className: "text-footnote leading-snug text-muted",
                          children: description,
                        }),
                      ],
                    })
                  : jsxForUiMenu2.jsx("span", {
                      children: label,
                    })),
            ],
          });
          if (disabledReason === undefined) {
            return value8;
          }
          return jsxForUiMenu2.jsx(runtime.DisabledReasonTooltip, {
            reason: props.disabled ? disabledReason : undefined,
            children: value8,
          });
        },
      );
      Checkbox.displayName = "Checkbox";
    });
  };
}
