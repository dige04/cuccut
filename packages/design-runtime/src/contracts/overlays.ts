import type * as React from "react";
import type { Menu } from "@base-ui/react/menu";
import type { Popover } from "@base-ui/react/popover";
import type { Dialog } from "@base-ui/react/dialog";
import type { AlertDialog } from "@base-ui/react/alert-dialog";
import type { Tooltip } from "@base-ui/react/tooltip";
import type { Combobox } from "@base-ui/react/combobox";
import type { DesignStyle, ControlSize, Density, ForwardComponent } from "./ui";

export type OverlayKind =
  | "modal"
  | "tooltip"
  | "contextmenu"
  | "popover"
  | "menu"
  | "combobox"
  | "coachmark";
export type OverlayPresentation = "auto" | "sheet" | "popup";
export type CollisionPadding =
  | number
  | { top?: number; right?: number; bottom?: number; left?: number };
export type PassiveOpenLevel = "off" | "declared" | "hover";
export interface LayerRenderProps extends React.HTMLAttributes<HTMLElement> {
  "data-cds"?: string;
  style?: DesignStyle;
}
export interface LayerProps {
  base?: number;
  render?: React.ReactElement<LayerRenderProps>;
  children?: React.ReactNode;
}
export interface LayerValue {
  base: number;
  style: DesignStyle;
  portalProps: { className: string; style: DesignStyle };
}
export interface OverlayActions {
  close: () => void;
  unmount: () => void;
}
export interface PublicOverlayActions {
  close(): void;
  unmount(): void;
}
export type OverlayChangeDetails =
  | Menu.Root.ChangeEventDetails
  | Popover.Root.ChangeEventDetails
  | Dialog.Root.ChangeEventDetails
  | Combobox.Root.ChangeEventDetails;
export type OverlayChange = (
  open: boolean,
  details: OverlayChangeDetails,
) => void;
export type MenuChange = (
  open: boolean,
  details: Menu.Root.ChangeEventDetails,
) => void;
export interface CloseWatcherHandle {
  onclose: (() => void) | null;
  destroy(): void;
}
export type BrowserWindow = Window &
  Pick<
    typeof globalThis,
    | "Element"
    | "HTMLElement"
    | "HTMLInputElement"
    | "HTMLButtonElement"
    | "ResizeObserver"
    | "MutationObserver"
  > & {
    CloseWatcher?: new () => CloseWatcherHandle;
    navigator: Navigator & { userAgentData?: { platform?: string } };
  };
export interface FocusOptionsWithVisibility extends FocusOptions {
  focusVisible?: boolean;
}
export type FocusableElement = HTMLElement | SVGElement;
export type PopupInputKind = "" | "mouse" | "keyboard" | "touch" | "pen";
export type PopupFocus =
  | boolean
  | React.RefObject<FocusableElement | null>
  | ((input: PopupInputKind) => boolean | FocusableElement | null | undefined);
export type InitialPopupFocus =
  | boolean
  | ((input: PopupInputKind) => boolean | FocusableElement | null | undefined);
export interface PassiveOpenCell {
  getLevel(): "off" | "declared" | "hover";
  subscribe(listener: () => void): () => void;
  engage(): void;
  registerPopup(element: HTMLElement | null): void;
  declareFocusProps(
    initialFocus: InitialPopupFocus | undefined,
    finalFocus: PopupFocus | null | undefined,
  ): void;
  getPopup(): HTMLElement | null;
  getTrigger(): HTMLElement | null;
}
export interface PassiveOpenGateState {
  cell: PassiveOpenCell;
  renderedWith(
    open: boolean | undefined,
    onChange: MenuChange | undefined,
    allowHover: boolean,
  ): void;
  onOpenChange: MenuChange;
}
export type PassivePopupProps = Omit<
  Menu.Popup.Props,
  "initialFocus" | "finalFocus"
> & { initialFocus?: InitialPopupFocus; finalFocus?: PopupFocus | null };
export type PassivePopupTransform = (
  props: PassivePopupProps,
) => PassivePopupProps;
export interface PassiveGateProps {
  cell: PassiveOpenCell | null;
  nested: boolean;
  children: (transform: PassivePopupTransform) => React.ReactNode;
}
export interface MenuLabels {
  sheetTitle?: React.ReactNode;
  backLabel?: string;
  closeLabel?: string;
}
export interface MenuItemState {
  label: React.ReactNode;
  open: boolean;
}
export interface PopupScrollAreaProps {
  header?: React.ReactNode;
  headerClassName?: string;
  footer?: React.ReactNode;
  maxVisibleItems?: number;
  fill?: boolean;
  children?: React.ReactNode;
}
export interface PopupPlacement {
  side?: string;
  align?: string;
}
export interface KeyboardInset {
  inset: number;
  visible: number;
  offset: number;
}
export type SheetDetent = "default" | "tall";
export interface SheetFrameState {
  height?: number;
  detent?: SheetDetent;
  keyboard?: KeyboardInset | null;
}
export interface SheetDetents {
  rest: number;
  tall: number;
  room: number;
}
export interface SheetPosition {
  height: number;
  slide: number;
  shown: number;
}
export interface SheetGestureRelease {
  rawAtRelease: number;
  rawAtGrab: number;
  caughtSlide: number;
  commit: boolean;
  detent: SheetDetent;
  velocity: number;
}
export interface SheetGestureResult {
  dismiss: boolean;
  detent: SheetDetent;
}
export interface TooltipDelay {
  start(delay: number, callback: () => void): void;
  cancel(): void;
}
export interface TooltipImplementation {
  Tooltip: React.ComponentType<TooltipProps>;
  DisabledReasonTooltip: React.ComponentType<DisabledTooltipProps>;
  TooltipImplProvider?: React.ComponentType<React.PropsWithChildren>;
  TooltipGroup?: React.ComponentType<
    React.PropsWithChildren<{ delay?: number; closeDelay?: number }>
  >;
}
export interface TooltipProps {
  children: React.ReactNode;
  content?: React.ReactNode | (() => React.ReactNode);
  side?: Tooltip.Positioner.Props["side"];
  align?: Tooltip.Positioner.Props["align"];
  sideOffset?: number;
  shortcut?: string | readonly string[];
  disabled?: boolean;
  delay?: number;
  closeDelay?: number;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  textOnly?: boolean;
  onlyWhenTruncated?: boolean;
  className?: string;
  layerOffset?: number;
  detail?: React.ReactNode;
  secondaryHint?: {
    label: React.ReactNode;
    shortcut?: string | readonly string[];
  };
  multiline?: boolean;
  collisionPadding?: CollisionPadding;
  trackCursorAxis?: "x" | "y" | "both";
  hoverable?: boolean;
  closeOnClick?: boolean;
  lazy?: boolean;
  openOnHandedBackFocus?: boolean;
  triggerRef?: React.Ref<HTMLElement>;
  container?: HTMLElement | React.RefObject<HTMLElement | null> | null;
  autoFocus?: boolean;
}
export interface DisabledTooltipProps
  extends Omit<TooltipProps, "content" | "triggerRef"> {
  reason?: React.ReactNode;
  wrapperClassName?: string;
}
export interface MenuPopupProps
  extends Omit<Menu.Popup.Props, "initialFocus" | "finalFocus">,
    Pick<
      Menu.Positioner.Props,
      | "side"
      | "align"
      | "sideOffset"
      | "collisionPadding"
      | "collisionAvoidance"
      | "anchor"
    > {
  initialFocus?: InitialPopupFocus;
  finalFocus?: PopupFocus | null;
  container?: HTMLElement | React.RefObject<HTMLElement | null> | null;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  maxVisibleItems?: number;
  layerOffset?: number;
  stableWhileOpen?: boolean;
  "data-cds"?: string;
}
export type MenuRootProps = Omit<Menu.Root.Props<never>, "actionsRef"> &
  MenuLabels & { actionsRef?: React.Ref<PublicOverlayActions> };
export interface MenuRootState {
  triggerRef: React.RefObject<HTMLElement | null>;
  setTriggerNode(element: HTMLElement | null): void;
  openRef: React.RefObject<boolean>;
  close(): void;
  stashLabel(label: React.ReactNode): void;
}
export interface OpenerReturnOptions {
  registerOpenerReturn?: boolean;
  skipRestoreOnOutsideFocus?: boolean;
  disabled?: boolean;
  open?: boolean;
  finalFocus?: PopupFocus;
  restoreFocus?: boolean;
  triggerRef?: React.RefObject<HTMLElement | null>;
}
export interface OpenerReturnState {
  finalFocus: (input?: PopupInputKind) => HTMLElement | false | null;
  popupRef: React.RefObject<HTMLDivElement | null>;
}
export interface SheetChrome {
  Handle: React.ComponentType;
  Body: React.ComponentType<React.PropsWithChildren<{ className?: string }>>;
  DismissButton: React.ComponentType<{
    onDismiss?: () => void;
    label?: string;
  }>;
  nested?: boolean;
  concealed?: boolean;
  close?: () => void;
  dismiss?: () => void;
  back?: () => void;
  treeId?: string;
  closeLabel?: string;
  backLabel?: string;
}
export interface SheetPopupState {
  open: boolean;
  sheet: boolean;
  concealed: boolean;
  pending: boolean;
  modal?: boolean;
  treeId?: string;
  keyboard?: KeyboardInset | null;
  height?: number;
  setDetent?(detent: SheetDetent): void;
  dismiss(): void;
  refusesAmbientClose(details: OverlayChangeDetails): boolean;
  actionsRef: React.RefObject<OverlayActions | null>;
  onOpenChange: OverlayChange;
  onOpenChangeComplete?: (open: boolean) => void;
  ref?: React.RefCallback<HTMLElement>;
  chrome: SheetChrome;
}
export interface SheetRenderState {
  sheet: boolean;
  concealed: boolean;
  chrome: SheetChrome | null;
  attrs?: React.HTMLAttributes<HTMLElement>;
  style?: DesignStyle;
  positionerStyle?: DesignStyle;
  ref?: React.RefCallback<HTMLDivElement>;
  state?: { depth: number };
  stack?: { depth: number; parentFrameHeight?: number };
  frame?: { dismiss(): void };
}
export interface MobileSheetParts {
  SheetPopupHost: React.ComponentType<{
    children: (state: SheetRenderState) => React.ReactNode;
  }>;
  ComboboxSheetBackdrop: React.ComponentType<{ sheetPopup: SheetRenderState }>;
  PopoverSheetBackdrop: React.ComponentType<{ sheetPopup: SheetRenderState }>;
  MenuSheetPopup: React.ComponentType<MenuPopupProps>;
  PopoverSheetContent: React.ComponentType<
    React.PropsWithChildren<{
      sheetPopup: SheetRenderState;
      className?: string;
      bodyRef: React.RefObject<HTMLDivElement | null>;
      bodyClassName?: string;
      closeLabel?: string;
    }>
  >;
}
export interface InnerOverlay {
  isOpen(): boolean;
  close(): void;
  contains?(target: Node): boolean;
}
export interface InnerOverlayStack {
  register(overlay: InnerOverlay): () => void;
  topmostOpen(): InnerOverlay | undefined;
}
export interface ComboboxRegistration {
  addOutsideInput(): () => void;
  hasOutsideInput(): boolean;
  setTrigger(element: HTMLElement | null): void;
  getTrigger(): HTMLElement | null;
  setPopupInput(element: HTMLElement | null): void;
  getPopupInput(): HTMLElement | null;
  setList(element: HTMLElement | null): void;
  getList(): HTMLElement | null;
}
export type MenuItemProps = Omit<Menu.Item.Props, "className"> & {
  className?: string;
  variant?: "default" | "danger";
  icon?: React.ReactNode;
  shortcut?: string | readonly string[];
  checked?: boolean;
  checkedRole?: "checkbox" | "radio";
  checkPosition?: "leading" | "trailing";
  indicator?: "check" | "checkbox" | "radio" | "none";
  indeterminate?: boolean;
  hint?: string;
  description?: React.ReactNode;
  disabledReason?: React.ReactNode;
  href?: string;
  routerOptions?: { replace?: boolean; scroll?: boolean };
  target?: string;
  rel?: string;
  download?: string | boolean;
  keepOpen?: boolean;
  focusesNothing?: boolean;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
};
/** The shipped search normalizer calls String.normalize on both labels and values. */
export type ComboboxKey = string;
export interface ComboboxOption<Value extends ComboboxKey = string> {
  value: Value;
  label: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  separatorBefore?: boolean;
  groupLabelBefore?: string;
}
export interface ComboboxSharedProps<Value extends ComboboxKey> {
  "data-cds"?: string;
  mode?: "select" | "input";
  variant?: "outline" | "ghost";
  items: ComboboxOption<Value>[];
  searchable?: boolean;
  indicator?: "check" | "checkbox" | "radio" | "none";
  placeholder?: string;
  searchPlaceholder?: string;
  triggerPrefix?: string;
  label?: React.ReactNode;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-required"?: boolean;
  clearable?: boolean;
  clearLabel?: string;
  closeLabel?: string;
  hideCaret?: boolean;
  filter?: (item: ComboboxOption<Value>, query: string) => boolean;
  autoHighlight?: boolean;
  onInputChange?: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
  footerDivider?: boolean;
  emptyMessage?: React.ReactNode;
  isLoading?: boolean;
  loadingStaleAfter?: number;
  footer?: React.ReactNode | ((actions: { close(): void }) => React.ReactNode);
  renderItem?: (item: ComboboxOption<Value>, query: string) => React.ReactNode;
  announceGroupLabels?: boolean;
  virtualized?: boolean;
  estimateItemSize?: number;
  hasMore?: boolean;
  isFetchingMore?: boolean;
  onLoadMore?: () => void;
  paginationKey?: string | number;
  popupClassName?: string;
  layerOffset?: number;
  maxVisibleItems?: number;
  align?: Combobox.Positioner.Props["align"];
  collisionPadding?: Combobox.Positioner.Props["collisionPadding"];
  disabled?: boolean;
  required?: boolean;
  name?: string;
  size?: ControlSize;
  fullWidth?: boolean;
  className?: string;
}
export type ComboboxProps<Value extends ComboboxKey = string> =
  ComboboxSharedProps<Value> &
    (
      | {
          multiple?: false;
          value?: Value | null;
          defaultValue?: Value | null;
          onChange?: (value: Value | null) => void;
          renderTriggerValue?: (
            item: ComboboxOption<Value> | null,
          ) => React.ReactNode;
        }
      | {
          multiple: true;
          value?: Value[];
          defaultValue?: Value[];
          onChange?: (value: Value[]) => void;
          triggerMode?: "summary" | "chips";
          popupSearchInChips?: boolean;
          groupSelected?: boolean;
          selectAllFooter?: boolean;
          summaryNoun?: string;
          renderTriggerValue?: (
            items: ComboboxOption<Value>[],
          ) => React.ReactNode;
        }
    );
export interface ComboboxLabelInput {
  reactId: string;
  label?: React.ReactNode;
  triggerPrefix?: React.ReactNode;
  mode: "select" | "input";
  triggerMode?: "summary" | "chips" | null;
  insideField: boolean;
}
export interface AccessibleNameProps {
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}
export interface ComboboxLabelResult {
  labelId?: string;
  triggerId?: string;
  triggerValueId?: string;
  ownLabelProps?: AccessibleNameProps;
}
export interface ComboboxGroupMap<Value extends ComboboxKey> {
  captionAbove: Map<Value, string>;
  separatorAbove: Set<Value>;
  runLabel: Map<Value, string>;
}
export interface VirtualComboboxActions {
  scrollToIndex(index: number): void;
}
export interface VirtualComboboxProps {
  count: number;
  estimateItemSize: number;
  estimateRowSize?: (index: number) => number;
  scrollEl: HTMLDivElement | null;
  actionsRef?: React.Ref<VirtualComboboxActions>;
  getItemKey: (index: number) => string | number;
  renderRow: (index: number) => React.ReactNode;
}
export interface ComboboxRowProps<Value extends ComboboxKey> {
  item: ComboboxOption<Value>;
  index?: number;
  selected: boolean;
  stale: boolean;
  renderItem?: (item: ComboboxOption<Value>, query: string) => React.ReactNode;
  searchQuery: string;
  indicator: "check" | "checkbox" | "radio" | "none";
  leadsList?: boolean;
  separatorAbove?: boolean;
  groupCaption?: string;
  announcedGroupLabel?: string;
  wrapDescription?: boolean;
}
export interface GenericComboboxRow {
  <Value extends ComboboxKey>(
    props: ComboboxRowProps<Value>,
  ): React.ReactElement;
  displayName?: string;
}
export interface ComboboxHostProps<Value extends ComboboxKey> {
  sheetPopup: SheetRenderState;
  sheetParts: MobileSheetParts | null;
  anchorRef: React.RefObject<HTMLDivElement | null>;
  align?: Combobox.Positioner.Props["align"];
  collisionPadding?: CollisionPadding;
  popupClassName?: string;
  layerOffset?: number;
  maxVisibleItems?: number;
  dataCds?: string;
  isLoading: boolean;
  loadingStaleAfter?: number;
  showPopupSearch: boolean;
  focusListOnOpen: boolean;
  searchPlaceholder?: string;
  triggerPrefix?: string;
  chipsPopupSearch: boolean;
  disabled?: boolean;
  virtualized: boolean;
  sortedItems: ComboboxOption<Value>[];
  displayedItems: ComboboxOption<Value>[];
  renderedItemCount: number;
  estimateItemSize?: number;
  hasMore: boolean;
  isFetchingMore: boolean;
  onLoadMore?: () => void;
  paginationKey?: string | number;
  virtualRowsRef: React.RefObject<VirtualComboboxActions | null>;
  emptyMessage?: React.ReactNode;
  groupSelected: boolean;
  renderListItem(
    item: ComboboxOption<Value>,
    groups: ComboboxGroupMap<Value> | null,
    first: boolean,
    index?: number,
  ): React.ReactNode;
  valueSet: Set<Value>;
  searchQuery: string;
  showSelectAllFooter?: boolean;
  footer?: ComboboxSharedProps<Value>["footer"];
  footerDivider: boolean;
  handleSelectAll(): void;
  handleClearAll(): void;
  selectAllDisabled: boolean;
  clearAllDisabled: boolean;
  close(): void;
  closeLabel?: string;
}
export type ComboboxBridgeProps<Value extends ComboboxKey> = Omit<
  ComboboxHostProps<Value>,
  "sheetPopup" | "sheetParts"
>;
export type ComboboxPartProps<
  Part extends
    | "Status"
    | "Chip"
    | "ChipRemove"
    | "Trigger"
    | "Value"
    | "Input"
    | "Clear"
    | "Popup"
    | "List"
    | "Empty"
    | "Item"
    | "ItemIndicator"
    | "GroupLabel"
    | "Chips",
> = Omit<
  React.ComponentPropsWithoutRef<(typeof Combobox)[Part]>,
  "className"
> & { className?: string };
export type ComboboxStatusProps = ComboboxPartProps<"Status"> & {
  loading?: boolean;
  delay?: number;
  loadingLabel?: string;
};
export type ComboboxChipProps = ComboboxPartProps<"Chip"> & {
  removable?: boolean;
};
export type ComboboxTriggerProps = ComboboxPartProps<"Trigger"> & {
  variant?: "outline" | "ghost";
  size?: ControlSize;
};
export type ComboboxValueProps = Omit<
  ComboboxPartProps<"Value">,
  "children"
> & { children?: React.ReactNode };
export type ComboboxPopupProps = ComboboxPartProps<"Popup"> &
  Pick<
    Combobox.Positioner.Props,
    | "side"
    | "align"
    | "sideOffset"
    | "collisionPadding"
    | "collisionAvoidance"
    | "anchor"
  > & {
    container?: HTMLElement | React.RefObject<HTMLElement | null> | null;
    layerOffset?: number;
    maxVisibleItems?: number;
    positionerClassName?: string;
    closeLabel?: string;
    "data-cds"?: string;
  };
export type ComboboxPopupViewProps = ComboboxPopupProps & {
  sheetPopup: SheetRenderState;
  sheetParts: MobileSheetParts | null;
};
/** Programmatic close retains a real Event; Base UI's user-event branch is narrower. */
export type ImperativeComboboxDetails = Omit<
  Combobox.Root.ChangeEventDetails,
  "reason" | "event"
> & { reason: "close-press"; event: Event };
export type ComboboxItemPartProps = ComboboxPartProps<"Item"> & {
  description?: React.ReactNode;
  icon?: React.ReactNode;
  stale?: boolean;
};
export type ComboboxChipsProps = ComboboxPartProps<"Chips"> & {
  size?: ControlSize;
};
export type ComboboxFooterActionProps =
  React.ComponentPropsWithoutRef<"button"> & { icon?: React.ReactNode };
export type ImeKeyEvent = Pick<
  KeyboardEvent,
  | "key"
  | "keyCode"
  | "shiftKey"
  | "altKey"
  | "metaKey"
  | "ctrlKey"
  | "timeStamp"
  | "type"
> & { isComposing?: boolean; nativeEvent?: Pick<KeyboardEvent, "isComposing"> };
export type MenuItems = readonly (MenuEntry | "separator")[];
export type MenuEntry = Omit<
  MenuItemProps,
  "children" | "onClick" | "label"
> & {
  label?: React.ReactNode;
  separatorBefore?: boolean;
  items?: MenuItems;
  onSelect?: Menu.Item.Props["onClick"];
};
export type MenuItemsContent = MenuItems | React.ReactNode;
export type MenuSubmenuProps = Omit<Menu.SubmenuRoot.Props, "actionsRef"> & {
  actionsRef?: React.Ref<PublicOverlayActions>;
};
export type MenuSubmenuTriggerProps = Omit<
  Menu.SubmenuTrigger.Props,
  "className"
> & {
  className?: string;
  icon?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  hint?: string;
};
export interface MenuProps
  extends Omit<MenuRootProps, "children">,
    Pick<
      MenuPopupProps,
      | "side"
      | "align"
      | "sideOffset"
      | "collisionPadding"
      | "finalFocus"
      | "style"
    > {
  items: MenuItemsContent;
  trigger?: "context-menu" | "click";
  disabled?: boolean;
  className?: string;
  "data-cds"?: string;
  children?: React.ReactNode;
  renderTrigger?: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
  label?: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: ControlSize;
  icon?: React.ReactNode;
  iconOnly?: boolean;
  tooltip?: boolean | string;
  "aria-label"?: string;
  pressed?: boolean;
  disabledReason?: React.ReactNode;
  disabledReasonSide?: Tooltip.Positioner.Props["side"];
  iconPosition?: "start" | "end";
}
export interface ContextMenuState {
  triggerRef: React.RefObject<HTMLElement | null>;
  onOpenChange: MenuChange;
  contextMenuOnOpenChange?: MenuChange;
  onOpenChangeComplete?: (open: boolean) => void;
  actionsRef: React.RefObject<OverlayActions | null>;
  sheetCapable?: boolean;
  inMenuBar: boolean;
}
export interface MenuSearchProps extends Omit<MenuPopupProps, "children"> {
  children(query: string, originalQuery: string): React.ReactNode;
  searchLabel: string;
  query?: string;
  onQueryChange?: (query: string) => void;
  resetQueryOnClose?: boolean;
  onSubmitQuery?: (query: string) => void;
  beforeSearch?: React.ReactNode;
}
export interface MenuPendingProps {
  pending?: boolean;
  loading?: boolean;
  placeholderRows?: number;
  icon?: boolean;
  children?: React.ReactNode;
}
export interface MenuTextState {
  label?: string;
  labelSpanRef: React.RefObject<HTMLSpanElement | null>;
  rowRef: React.RefObject<HTMLElement | null>;
}
export interface MenuPopupElementProps extends MenuPopupProps {
  anchoredWithoutFinalFocus?: boolean;
  cursorAnchored?: boolean;
}
export interface PopupAnimationInput {
  enabled: boolean;
  side?: string;
  align?: string;
}
export interface PopupAnimationState extends PopupPlacement {
  positionerRef?: React.RefCallback<HTMLElement>;
  popupRef: React.RefCallback<HTMLElement>;
  held: { positionerStyle: DesignStyle; positionerClassName: string } | null;
}
export type MenuTriggerButtonProps =
  React.ComponentPropsWithoutRef<"button"> & {
    busy?: boolean;
    size?: ControlSize;
    variant?: "primary" | "secondary" | "ghost";
    icon?: React.ReactNode;
    iconOnly?: boolean;
  };
export type SearchKeyEvent = Pick<
  KeyboardEvent,
  | "key"
  | "keyCode"
  | "shiftKey"
  | "altKey"
  | "ctrlKey"
  | "metaKey"
  | "getModifierState"
>;
export type MenuPopupKeyboardEvent = Parameters<
  NonNullable<Menu.Popup.Props["onKeyDown"]>
>[0];
export type MenuPopupFocusEvent = Parameters<
  NonNullable<Menu.Popup.Props["onFocus"]>
>[0];
export type DialogRootProps<Payload = void> = Omit<
  Dialog.Root.Props<Payload>,
  "actionsRef"
> & { dismissible?: boolean; actionsRef?: React.Ref<PublicOverlayActions> };
export type AlertDialogRootProps<Payload = void> = Omit<
  AlertDialog.Root.Props<Payload>,
  "actionsRef"
> & { actionsRef?: React.Ref<PublicOverlayActions> };
export type DialogPopupProps = Omit<Dialog.Popup.Props, "className"> & {
  className?: string;
  size?: "sm" | "md" | "lg";
  fullHeight?: boolean;
  unstyled?: boolean;
  surface?: string;
  backdropClassName?: string;
  backdropStyle?: React.CSSProperties;
  portalClassName?: string;
  "data-cds"?: string;
};
export type DialogPopupInnerProps = Dialog.Popup.Props & {
  fitVisualViewport?: boolean;
  "data-cds"?: string;
};
export interface DialogHeaderProps {
  actions?: React.ReactNode;
  description?: React.ReactNode;
  showClose?: boolean;
  closeLabel?: string;
  className?: string;
  children?: React.ReactNode;
}
export interface DialogFooterProps {
  align?: "start" | "center" | "end" | "between";
  className?: string;
  children?: React.ReactNode;
}
export interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange(open: boolean, details: { reason: "confirm" | "dismiss" }): void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: React.ReactNode;
  cancelLabel?: React.ReactNode;
  confirmVariant?: "primary" | "secondary" | "danger";
  initialFocus?: "confirm" | "cancel";
  disabled?: boolean;
  confirmDisabledReason?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
  portalClassName?: string;
  onConfirm(): void | Promise<void>;
  closeOnConfirm?: boolean;
  children?: React.ReactNode;
}
export type ConfirmationFocus = "confirm" | "cancel" | "pending";
export type DialogTitleProps = Omit<Dialog.Title.Props, "className"> & {
  className?: string;
};
export type DialogDescriptionProps = Omit<
  Dialog.Description.Props,
  "className"
> & { className?: string };
export type PopoverRootProps<Payload = void> = Omit<
  Popover.Root.Props<Payload>,
  "actionsRef"
> & { actionsRef?: React.Ref<PublicOverlayActions> };
export type PopoverPopupProps = Omit<Popover.Popup.Props, "className"> &
  Pick<
    Popover.Positioner.Props,
    | "side"
    | "align"
    | "sideOffset"
    | "alignOffset"
    | "collisionPadding"
    | "anchor"
  > & {
    className?: string;
    padding?: "none" | "xs" | "sm" | "md" | "lg";
    scrollFade?: boolean;
    layerOffset?: number;
    closeLabel?: string;
    sheetHeight?: "default" | "tall";
    keepFocus?: boolean;
  };
export type PopoverPopupViewProps = PopoverPopupProps & {
  sheetPopup: SheetRenderState;
  sheetParts: MobileSheetParts | null;
};
export type PopoverPopupInnerProps = Omit<Popover.Popup.Props, "className"> & {
  anchored?: boolean;
  className?: string;
};
export interface PopoverAnchorState {
  popupMounted: boolean;
  declinesFocus: boolean;
  anchor?: Popover.Positioner.Props["anchor"];
  triggerEl: Element | null;
}
export interface PopoverAnchorStore {
  update(state: Partial<PopoverAnchorState>): void;
  read(): PopoverAnchorState;
}
export declare const tooltipNoContent: unique symbol;
export type EmptyTooltipContent = typeof tooltipNoContent;
export interface TooltipBodyState {
  open: boolean;
  body?: React.ReactNode;
}
export type TooltipBodyUpdate = (state: TooltipBodyState) => TooltipBodyState;
export interface TooltipInstantActions {
  closeInstant(): void;
}
export type OverflowTooltipProps = React.ComponentPropsWithoutRef<"span"> &
  Pick<
    TooltipProps,
    | "side"
    | "align"
    | "sideOffset"
    | "delay"
    | "collisionPadding"
    | "hoverable"
    | "lazy"
  >;
export interface DeferredTooltipScope {
  ambientImpl(): TooltipImplementation | null;
  isDeferred(): boolean;
  subscribe(listener: () => void): () => void;
  engage(): void;
}
export interface DeferredTooltipNode {
  hover: boolean;
  focus: boolean;
  down: boolean;
  node: HTMLElement | null;
  adopted: boolean;
  handBack: boolean;
  tapHold: ReturnType<typeof setTimeout> | null;
}
export type TooltipTriggerProps = React.HTMLAttributes<HTMLElement>;
export interface DeferredTooltipLoad {
  impl: TooltipImplementation;
  track?: React.RefCallback<HTMLElement>;
}
export interface DeferredTooltipState {
  impl: TooltipImplementation | null;
  wasCold: boolean;
  interceptors(props: TooltipTriggerProps): TooltipTriggerProps;
  trackTrigger?: React.RefCallback<HTMLElement>;
}
export interface TooltipPointerEvent {
  type: string;
  pointerType?: string;
}
export type OverlayEventDetails =
  | OverlayChangeDetails
  | ImperativeComboboxDetails;
export interface OverlayOpenProps<Details extends OverlayEventDetails> {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: Details) => void;
}
export interface SheetPopupOptions<Details extends OverlayEventDetails>
  extends OverlayOpenProps<Details> {
  open: boolean;
  actionsRef?: React.Ref<PublicOverlayActions>;
  close?: () => void;
  onOpenChangeComplete?: (open: boolean) => void;
  structurallyAnchored?: boolean;
  closable?: boolean;
  refuseClose?: (details: Details, treeId: string) => boolean;
}
export interface SheetFrameContext extends SheetFrameState {
  treeId: string;
  open: boolean;
  showing: boolean;
  canGrow: boolean;
  detent: SheetDetent;
  setDetent(detent: SheetDetent): void;
  pinHeight(height: number, grows?: boolean): void;
  repinHeight(height: number, grows?: boolean): void;
  pushLevelHeight(height: number, grows: boolean): () => void;
  holdTextEntryFocus(): () => void;
  dismiss(): void;
  drag: {
    get(): SheetPosition | null;
    set(position: SheetPosition | null): void;
  };
  refusesAmbientClose(details: OverlayEventDetails): boolean;
  takeCloseRequest(): OverlayEventDetails | null;
}
export interface SheetStackState {
  depth: number;
  frameHeight?: number;
  cover(token: object): () => void;
}
export interface SheetPopupResult<Details extends OverlayEventDetails> {
  sheet: boolean;
  showing: boolean;
  frame: SheetFrameContext;
  actionsRef: React.RefObject<OverlayActions | null>;
  onOpenChange(open: boolean, details: Details): void;
  onOpenChangeComplete(open: boolean): void;
  modal?: boolean;
  state: {
    sheet: boolean;
    pending: boolean;
    covered: boolean;
    inert: boolean;
    depth: number;
  };
  stack: SheetStackState;
}
export type RouterEvents = Pick<
  React.HTMLAttributes<HTMLElement>,
  | "onClick"
  | "onPointerEnter"
  | "onPointerLeave"
  | "onPointerDown"
  | "onFocus"
  | "onBlur"
>;
export interface LinkInput extends RouterEvents {
  href?: string;
  target?: string;
  rel?: string;
  download?: string | boolean;
  routerOptions?: object;
}
export type LinkAttributes = RouterEvents &
  Pick<
    React.AnchorHTMLAttributes<HTMLAnchorElement>,
    "href" | "target" | "rel" | "download"
  >;
export interface LinkRouter {
  navigate(path: string, options?: object): void;
  resolveHref?(path: string): string;
  intentHandlers?(path: string): RouterEvents;
}
export interface ButtonGroupOptions {
  size?: ControlSize;
  joined?: "start" | "middle" | "end";
  buttonVariant?:
    | "primary"
    | "secondary"
    | "ghost"
    | "danger"
    | "brand"
    | "onContent"
    | "onAccent";
  enforceVariant?: boolean;
}

/** Base UI's render prop supports non-button hosts; its native button ref must not
 * intersect the documented HTMLElement ref on the polymorphic Trigger. */
export type PolymorphicTooltipTrigger = <Payload>(
  props: Omit<
    import("@base-ui/react/tooltip").Tooltip.Trigger.Props<Payload>,
    "ref"
  > &
    React.RefAttributes<HTMLElement>,
) => React.ReactElement;
