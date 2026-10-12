/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type {
  ButtonHTMLAttributes,
  Context,
  ElementType,
  ForwardRefExoticComponent,
  HTMLAttributes,
  Key,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  NamedExoticComponent,
  ReactElement,
  ReactNode,
  Ref,
  RefAttributes,
  RefObject,
} from "react";
import type { Combobox as BaseCombobox } from "@base-ui/react/combobox";
import type {
  AdaptiveSheet,
  ControllableOpenProps,
  SheetHost,
  SheetImplementation,
} from "./foundation";
import type {
  CollisionPadding,
  MergedRefCallback,
  SheetChromeParts,
  TranslateLabel,
} from "./interactions";
import type { CdsControlSize, CdsDensity, DisplayNamedComponent } from "./overlays";
import type { FieldChromeProps } from "./toast";
import type { CheckboxProps } from "./menu";

/** Visual style of a semantic badge. */
export type BadgeVariant = "neutral" | "accent" | "success" | "warning" | "danger" | "pro";
/** Named color of a badge. */
export type BadgeColor =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "aqua"
  | "blue"
  | "violet"
  | "magenta";
/** Icon size step a badge picks from its own size. */
export type BadgeIconSize = "xs" | "sm" | "md";
/** Props of the element a badge clones to render its remove button. */
export interface BadgeRemoveRenderProps {
  className?: string;
  [prop: string]: unknown;
}
export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, "color"> {
  variant?: BadgeVariant | BadgeColor;
  /** An icon name or an already rendered node. */
  icon?: ReactNode;
  iconOnly?: boolean;
  onRemove?: () => void;
  removeLabel?: string;
  removeRender?: ReactElement<BadgeRemoveRenderProps>;
  /** Draws a solid fill instead of a tint. */
  bold?: boolean;
  size?: CdsControlSize;
  truncate?: boolean;
}

/** One typography token: its value per density and, for some, per control step. */
export interface TypographyThemeValue {
  compact: number;
  comfortable: number;
  steps?: number[];
  textSize?: Record<CdsDensity, { sm: number; md: number; lg: number }> | "shift";
}
export interface SteppedTypographyThemeValue extends TypographyThemeValue {
  steps: number[];
}
export interface TypographyThemeValues {
  "font-size-body": SteppedTypographyThemeValue;
  "font-size-caption": SteppedTypographyThemeValue;
  "font-size-code": TypographyThemeValue;
  "font-size-footnote": TypographyThemeValue;
  "font-size-heading": TypographyThemeValue;
  "font-size-prose": SteppedTypographyThemeValue;
  "font-size-title": TypographyThemeValue;
  "leading-body": SteppedTypographyThemeValue;
  "leading-caption": TypographyThemeValue;
  "leading-code": TypographyThemeValue;
  "leading-footnote": TypographyThemeValue;
  "leading-heading": TypographyThemeValue;
  "leading-prose": SteppedTypographyThemeValue;
  "leading-title": TypographyThemeValue;
}

/** The accessible-name attributes a combobox part mirrors from another element. */
export interface AccessibleNameProps {
  "aria-labelledby"?: string;
  "aria-label"?: string;
}
export interface AccessibleNameOptions {
  /** Name to use when the element has none of its own. */
  fallback?: string;
  /** Also read the name of a text entry (inputs normally have none to mirror). */
  fromTextEntry?: boolean;
}
export type ComboboxMode = "select" | "input";
export type ComboboxVariant = "outline" | "ghost";
export type ComboboxIndicator = "check" | "checkbox";
export type ComboboxTriggerMode = "summary" | "chips";
export type ComboboxAlign = BaseCombobox.Positioner.Props["align"];
export interface ComboboxAccessibilityOptions {
  reactId: string;
  label?: ReactNode;
  triggerPrefix?: string;
  mode: ComboboxMode;
  triggerMode: ComboboxTriggerMode | null;
  insideField: boolean;
}
export interface ComboboxAccessibility {
  labelId: string | undefined;
  triggerId: string | undefined;
  triggerValueId: string | undefined;
  ownLabelProps: { id: string; "aria-labelledby": string | undefined } | undefined;
}
export interface MirroredAccessibleName {
  ref: (instance: HTMLElement | null) => (() => void) | undefined;
  nameProps: AccessibleNameProps;
}

/** One selectable row of a combobox. */
export interface ComboboxOption {
  value: string;
  label: string;
  description?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  /** Draws a separator above this row. */
  separatorBefore?: boolean;
  /** Starts a captioned group at this row. */
  groupLabelBefore?: string;
}
export type ComboboxFilter = (item: ComboboxOption, query: string) => boolean;
export type ComboboxFooterContent = ReactNode | ((api: { close: () => void }) => ReactNode);
/** Group captions and separators computed for the rows currently shown. */
export interface ComboboxGroupMetadata {
  captionAbove: Map<string, string>;
  separatorAbove: Set<string>;
  runLabel: Map<string, string>;
}
export interface ComboboxGroupRun {
  label: string;
  separator: boolean;
  start: string;
}
export interface ComboboxListHeightStyle {
  "--cds-popup-max-h": string;
  "--cds-popup-list-max-h": string;
}

interface ComboboxCommonProps {
  "data-cds"?: string;
  mode?: ComboboxMode;
  variant?: ComboboxVariant;
  items: ComboboxOption[];
  searchable?: boolean;
  indicator?: ComboboxIndicator;
  placeholder?: string;
  searchPlaceholder?: string;
  triggerPrefix?: string;
  label?: ReactNode;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-required"?: boolean;
  clearable?: boolean;
  clearLabel?: string;
  closeLabel?: string;
  hideCaret?: boolean;
  filter?: ComboboxFilter;
  autoHighlight?: boolean;
  onInputChange?: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
  footerDivider?: boolean;
  emptyMessage?: ReactNode;
  isLoading?: boolean;
  /** Delay before rows turn stale while a reload is in flight. */
  loadingStaleAfter?: number;
  footer?: ComboboxFooterContent;
  renderItem?: (item: ComboboxOption, query: string) => ReactNode;
  announceGroupLabels?: boolean;
  virtualized?: boolean;
  estimateItemSize?: number;
  hasMore?: boolean;
  isFetchingMore?: boolean;
  onLoadMore?: () => void;
  /** Changes when the pagination restarts (a new query, for example). */
  paginationKey?: string | number;
  popupClassName?: string;
  layerOffset?: number;
  maxVisibleItems?: number;
  align?: ComboboxAlign;
  collisionPadding?: CollisionPadding;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  size?: CdsControlSize;
  fullWidth?: boolean;
  className?: string;
}
export interface ComboboxSingleProps extends ComboboxCommonProps {
  multiple?: false;
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string | null) => void;
  renderTriggerValue?: (item: ComboboxOption | null) => ReactNode;
  triggerMode?: undefined;
}
export interface ComboboxMultipleProps extends ComboboxCommonProps {
  multiple: true;
  value?: string[];
  defaultValue?: string[];
  onChange?: (value: string[]) => void;
  renderTriggerValue?: (items: ComboboxOption[]) => ReactNode;
  triggerMode?: ComboboxTriggerMode;
  /** Moves the search field from the chips row into the popup. */
  popupSearchInChips?: boolean;
  /** Lists the selected rows first. */
  groupSelected?: boolean;
  keepQueryOnSelect?: boolean;
  selectAllFooter?: boolean;
  /** Plural noun for the summary label, for example "slides". */
  summaryNoun?: string;
}
export type ComboboxProps = ComboboxSingleProps | ComboboxMultipleProps;
export type FieldComboboxProps = ComboboxProps & FieldChromeProps;

/** Imperative handle of a virtualized row list. */
export interface VirtualizedRowsActions {
  scrollToIndex: (index: number) => void;
}
export interface VirtualizedComboboxRowsProps {
  count: number;
  estimateItemSize: number;
  estimateRowSize?: (index: number) => number;
  scrollEl: HTMLElement | null;
  actionsRef: Ref<VirtualizedRowsActions>;
  getItemKey: (index: number) => Key;
  renderRow: (index: number) => ReactNode;
}
export interface DelayedVisibleProps {
  ms: number;
  children?: ReactNode;
}
export interface ComboboxStatusProps extends BaseCombobox.Status.Props {
  loading?: boolean;
  delay?: number;
  loadingLabel?: ReactNode;
}
export interface ComboboxItemRowProps {
  item: ComboboxOption;
  index?: number;
  selected: boolean;
  stale: boolean;
  renderItem?: (item: ComboboxOption, query: string) => ReactNode;
  searchQuery: string;
  indicator: ComboboxIndicator;
  leadsList?: boolean;
  separatorAbove?: boolean;
  groupCaption?: string;
  announcedGroupLabel?: string;
  wrapDescription?: boolean;
}
export type ComboboxRenderListItem = (
  item: ComboboxOption,
  groups: ComboboxGroupMetadata | null,
  leadsList: boolean,
  index?: number,
) => ReactNode;

/** The sheet host a combobox popup renders with; its chrome holds the sheet pieces. */
export interface ComboboxSheetHost extends Omit<SheetHost, "chrome"> {
  chrome: SheetChromeParts;
}
/** The lazily loaded sheet module, with the combobox backdrop. */
export interface ComboboxSheetParts extends SheetImplementation {
  ComboboxSheetBackdrop: ElementType;
}
export interface ComboboxPopupFrameProps {
  sheetPopup: ComboboxSheetHost;
  sheetParts: ComboboxSheetParts | null;
  anchorRef: RefObject<HTMLElement | null>;
  align: ComboboxAlign;
  collisionPadding?: CollisionPadding;
  popupClassName?: string;
  layerOffset?: number;
  maxVisibleItems?: number;
  dataCds: string;
  isLoading: boolean;
  loadingStaleAfter?: number;
  showPopupSearch: boolean;
  focusListOnOpen: boolean;
  searchPlaceholder?: string;
  triggerPrefix?: string;
  chipsPopupSearch: boolean;
  disabled: boolean;
  virtualized: boolean;
  sortedItems: ComboboxOption[];
  displayedItems: ComboboxOption[];
  renderedItemCount: number;
  estimateItemSize?: number;
  hasMore: boolean;
  isFetchingMore: boolean;
  onLoadMore?: () => void;
  paginationKey?: string | number;
  virtualRowsRef: RefObject<VirtualizedRowsActions | null>;
  emptyMessage: ReactNode;
  groupSelected: boolean;
  renderListItem: ComboboxRenderListItem;
  valueSet: Set<string>;
  searchQuery: string;
  showSelectAllFooter: boolean;
  footer?: ComboboxFooterContent;
  footerDivider: boolean;
  handleSelectAll: () => void;
  handleClearAll: () => void;
  selectAllDisabled: boolean;
  clearAllDisabled: boolean;
  close: () => void;
  closeLabel?: string;
}
export type ComboboxPopupResponsiveProps = Omit<ComboboxPopupFrameProps, "sheetPopup" | "sheetParts">;

/** Elements the combobox parts register with the root so they can find each other. */
export interface ComboboxRegistration {
  addOutsideInput: () => () => void;
  hasOutsideInput: () => boolean;
  setTrigger: (element: HTMLElement | null) => void;
  getTrigger: () => HTMLElement | null;
  setPopupInput: (element: HTMLElement | null) => void;
  getPopupInput: () => HTMLElement | null;
  setList: (element: HTMLElement | null) => void;
  getList: () => HTMLElement | null;
}
export interface ComboboxRegistrationState {
  inputOutsidePopup: number;
  trigger: HTMLElement | null;
  popupInput: HTMLElement | null;
  list: HTMLElement | null;
}
/** Close details handed to the root when the combobox closes itself. */
export interface ComboboxCloseEventDetails {
  reason: "close-press";
  event: Event;
  trigger: undefined;
  isCanceled: boolean;
  isPropagationAllowed: boolean;
  cancel: () => void;
  allowPropagation: () => void;
}
export type ComboboxRootProps = BaseCombobox.Root.Props<ComboboxOption, boolean | undefined>;
/** What the sheet host overrides on the combobox root it wraps. */
export type ComboboxRootSheetOverrides = Pick<
  AdaptiveSheet,
  "modal" | "onOpenChange" | "onOpenChangeComplete"
>;
export interface ComboboxRootRegistrationProps {
  rootProps: ComboboxRootProps & ControllableOpenProps;
  registration: ComboboxRegistration;
}

type WithClassName<Props> = Omit<Props, "className" | "ref"> & { className?: string };
export interface ComboboxChipProps extends WithClassName<BaseCombobox.Chip.Props> {
  removable?: boolean;
}
export type ComboboxChipRemoveProps = WithClassName<BaseCombobox.ChipRemove.Props>;
export interface ComboboxTriggerProps extends WithClassName<BaseCombobox.Trigger.Props> {
  variant?: ComboboxVariant;
  size?: CdsControlSize;
}
export interface ComboboxValueProps {
  className?: string;
  placeholder?: ReactNode;
  children?: ReactNode | ((value: ReactNode) => ReactNode);
}
export type ComboboxInputProps = WithClassName<BaseCombobox.Input.Props>;
export type ComboboxClearProps = WithClassName<BaseCombobox.Clear.Props>;
export interface ComboboxCaretProps {
  className?: string;
}
export interface ComboboxFooterActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon name. */
  icon?: string;
}
export interface ComboboxPopupProps
  extends WithClassName<BaseCombobox.Popup.Props>,
    Pick<
      BaseCombobox.Positioner.Props,
      "side" | "align" | "sideOffset" | "collisionPadding" | "collisionAvoidance"
    > {
  "data-cds"?: string;
  positionerClassName?: string;
  layerOffset?: number;
  maxVisibleItems?: number;
  closeLabel?: string;
}
export interface ComboboxPopupViewProps extends ComboboxPopupProps {
  sheetPopup: ComboboxSheetHost;
  sheetParts: ComboboxSheetParts | null;
}
export type ComboboxListProps = WithClassName<BaseCombobox.List.Props>;
export type ComboboxEmptyProps = WithClassName<BaseCombobox.Empty.Props>;
export interface ComboboxPrimitiveItemProps extends WithClassName<BaseCombobox.Item.Props> {
  description?: ReactNode;
  icon?: ReactNode;
  stale?: boolean;
}
export type ComboboxItemCheckProps = WithClassName<BaseCombobox.ItemIndicator.Props>;
export type ComboboxGroupLabelProps = WithClassName<BaseCombobox.GroupLabel.Props>;
export interface ComboboxChipsProps extends WithClassName<BaseCombobox.Chips.Props> {
  size?: CdsControlSize;
}
export interface ComboboxSeparatorProps {
  className?: string;
}
export interface ComboboxFooterProps {
  className?: string;
  children?: ReactNode;
}
export interface FieldCheckboxProps extends CheckboxProps {
  error?: ReactNode;
  fieldClassName?: string;
}

export type ComboboxComponent = (props: ComboboxProps) => ReactElement;
/** `Combobox` with its parts attached (`Combobox.Root`, `Combobox.Trigger`, ...). */
export interface ComboboxNamespace extends DisplayNamedComponent {
  (props: ComboboxProps): ReactElement;
  Root: (props: ComboboxRootProps) => ReactElement;
  Trigger: ForwardRefExoticComponent<ComboboxTriggerProps & RefAttributes<HTMLButtonElement>>;
  Value: ForwardRefExoticComponent<ComboboxValueProps & RefAttributes<HTMLSpanElement>>;
  Input: ForwardRefExoticComponent<ComboboxInputProps & RefAttributes<HTMLInputElement>>;
  PopupSearch: ForwardRefExoticComponent<ComboboxInputProps & RefAttributes<HTMLInputElement>>;
  Clear: ForwardRefExoticComponent<ComboboxClearProps & RefAttributes<HTMLButtonElement>>;
  Caret: (props: ComboboxCaretProps) => ReactElement;
  FooterAction: ForwardRefExoticComponent<
    ComboboxFooterActionProps & RefAttributes<HTMLButtonElement>
  >;
  Popup: ForwardRefExoticComponent<ComboboxPopupProps & RefAttributes<HTMLDivElement>>;
  List: ForwardRefExoticComponent<ComboboxListProps & RefAttributes<HTMLDivElement>>;
  Empty: ForwardRefExoticComponent<ComboboxEmptyProps & RefAttributes<HTMLDivElement>>;
  Status: ForwardRefExoticComponent<ComboboxStatusProps & RefAttributes<HTMLDivElement>>;
  Item: ForwardRefExoticComponent<ComboboxPrimitiveItemProps & RefAttributes<HTMLDivElement>>;
  ItemIndicator: ForwardRefExoticComponent<ComboboxItemCheckProps & RefAttributes<HTMLSpanElement>>;
  Group: typeof BaseCombobox.Group;
  GroupLabel: ForwardRefExoticComponent<ComboboxGroupLabelProps & RefAttributes<HTMLDivElement>>;
  Separator: (props: ComboboxSeparatorProps) => ReactElement;
  Footer: (props: ComboboxFooterProps) => ReactElement;
  Chips: ForwardRefExoticComponent<ComboboxChipsProps & RefAttributes<HTMLDivElement>>;
  Chip: ForwardRefExoticComponent<ComboboxChipProps & RefAttributes<HTMLDivElement>>;
  ChipRemove: ForwardRefExoticComponent<ComboboxChipRemoveProps & RefAttributes<HTMLButtonElement>>;
  Collection: typeof BaseCombobox.Collection;
}
export type FieldComboboxComponent = (props: FieldComboboxProps) => ReactElement;
export type FieldCheckboxComponent = ForwardRefExoticComponent<
  FieldCheckboxProps & RefAttributes<HTMLButtonElement>
>;
/** The `Field.*` parts, resolved lazily so each module can finish loading first. */
export interface FieldComponentsNamespace {
  Validity: RuntimeBindings["FieldRow"];
  TextInput: RuntimeBindings["FieldTextInput"];
  TextArea: RuntimeBindings["FieldTextArea"];
  Root: RuntimeBindings["FieldRoot"];
  NumberInput: RuntimeBindings["FieldNumberInput"];
  Label: RuntimeBindings["FieldLabel"];
  Error: RuntimeBindings["FieldError"];
  Description: RuntimeBindings["FieldDescription"];
  Control: RuntimeBindings["FieldRootWithLabel"];
  Combobox: FieldComboboxComponent;
  Checkbox: FieldCheckboxComponent;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactForUiInputs22: ReactNamespace;
    jsxForUiInputs22: JsxNamespace;
    reactForUiInputs222: ReactNamespace;
    reactForUiInputs23: ReactNamespace;
    jsxForUiInputs222: JsxNamespace;
    reactForUiInputs24: ReactNamespace;
    jsxForUiInputs23: JsxNamespace;
    reactForUiInputs25: ReactNamespace;
    jsxForUiInputs24: JsxNamespace;
    jsxForUiInputs25: JsxNamespace;
    reactForUiInputs26: ReactNamespace;
    jsxForUiInputs26: JsxNamespace;
    isBadgeVariant: (input: string) => input is BadgeVariant;
    badgeVariantClasses: Record<BadgeVariant, string>;
    BADGE_VARIANT_CLASSES: Record<BadgeVariant, string>;
    BADGE_SIZE_CLASSES: Record<BadgeColor, string>;
    BADGE_ICON_CLASSES: Record<BadgeColor, string>;
    BADGE_ICON_SIZE_CLASSES: Record<BadgeIconSize, string>;
    BADGE_TEXT_CLASS: string;
    BADGE_LABEL_CLASSES: Record<CdsDensity, Record<CdsControlSize, BadgeIconSize>>;
    Badge: ForwardRefExoticComponent<BadgeProps & RefAttributes<HTMLSpanElement>>;
    initializeUiInputs22: () => void;
    typographyThemeValues: TypographyThemeValues;
    initializeUiInputs222: () => void;
    comboboxAccessibilityProps: (options: ComboboxAccessibilityOptions) => ComboboxAccessibility;
    comboboxAccessibilityNoop: () => void;
    accessibleNameFromElement: (
      element?: Element | null,
      options?: AccessibleNameOptions,
    ) => AccessibleNameProps;
    useMirroredAccessibleName: (
      ref: Ref<HTMLElement> | undefined,
      getFallback: () => Element | null | undefined,
      nameProps: AccessibleNameProps,
      options?: AccessibleNameOptions,
    ) => MirroredAccessibleName;
    initializeUiInputs23: () => void;
    useDelayedVisible: (timeoutMs: number) => boolean;
    DelayedVisible: (props: DelayedVisibleProps) => ReactNode;
    COMBOBOX_STATUS_DELAY_MS: number;
    COMBOBOX_STATUS_CLASS: string;
    COMBOBOX_STATUS_CONTENT_CLASS: string;
    ComboboxStatus: ForwardRefExoticComponent<ComboboxStatusProps & RefAttributes<HTMLDivElement>>;
    initializeUiInputs24: () => void;
    VirtualizedComboboxRows: (props: VirtualizedComboboxRowsProps) => ReactElement;
    COMBOBOX_VIRTUAL_OVERSCAN: number;
    COMBOBOX_SKELETON_ROW_COUNT: number;
    initializeUiInputs25: () => void;
    comboboxListHeightStyle: (
      visibleItems?: number,
      rowHeight?: number,
    ) => ComboboxListHeightStyle | undefined;
    comboboxItemMatchesQuery: ComboboxFilter;
    comboboxSelectionLabel: (
      selected: ComboboxOption[],
      noun?: string,
      locale?: TranslateLabel,
    ) => string;
    comboboxGroupMetadata: (
      items: ComboboxOption[],
      isSelected: (item: ComboboxOption) => boolean,
      selectedFirst: boolean,
    ) => ComboboxGroupMetadata;
    Combobox: ComboboxComponent;
    comboboxSheetLabel: (
      pointerType: string,
      touch: HTMLElement | null | undefined,
      desktop: HTMLElement | null | undefined,
      fallback: HTMLElement | null | undefined,
    ) => HTMLElement | undefined;
    ComboboxPopupResponsive: (props: ComboboxPopupResponsiveProps) => ReactElement;
    ComboboxPopupAsSheet: (props: ComboboxPopupResponsiveProps) => ReactElement;
    ComboboxPopupFrame: (props: ComboboxPopupFrameProps) => ReactElement;
    useComboboxOutsideInputRegistration: () => void;
    useComboboxTriggerRef: (ref?: Ref<HTMLElement>) => MergedRefCallback<HTMLElement>;
    useComboboxPopupInputRef: (ref?: Ref<HTMLElement>) => MergedRefCallback<HTMLElement>;
    useComboboxTriggerElement: () => () => HTMLElement | null;
    useComboboxAccessibleName: (
      ref: Ref<HTMLElement> | undefined,
      label?: string,
      labelledBy?: string,
    ) => MirroredAccessibleName;
    useComboboxListRef: (ref?: Ref<HTMLElement>) => MergedRefCallback<HTMLElement>;
    useComboboxRegistrationRef: (
      setElement?: (element: HTMLElement | null) => void,
      getElement?: () => HTMLElement | null,
    ) => (element: HTMLElement | null) => void;
    ComboboxCaret: (props: ComboboxCaretProps) => ReactElement;
    ComboboxSeparator: (props: ComboboxSeparatorProps) => ReactElement;
    ComboboxFooter: (props: ComboboxFooterProps) => ReactElement;
    comboboxCloseEventDetails: () => ComboboxCloseEventDetails;
    ComboboxRoot: (props: ComboboxRootProps) => ReactElement;
    ComboboxRootRegistration: (props: ComboboxRootRegistrationProps) => ReactElement;
    COMBOBOX_TRIGGER_CLASS: string;
    COMBOBOX_VARIANT_CLASSES: Record<ComboboxVariant, string>;
    COMBOBOX_FOCUS_CLASS: string;
    COMBOBOX_MODE_CLASSES: Record<ComboboxMode, string>;
    COMBOBOX_CHIPS_INPUT_CLASS: string;
    COMBOBOX_TRIGGER_BUTTON_CLASS: string;
    COMBOBOX_INLINE_INPUT_CLASS: string;
    COMBOBOX_SEARCH_INPUT_CLASS: string;
    COMBOBOX_CHIP_CLASS: string;
    COMBOBOX_CHIP_LIST_CLASS: string;
    COMBOBOX_POPUP_CLASS: string;
    COMBOBOX_POPUP_BODY_CLASS: string;
    COMBOBOX_ANCHOR_HIDDEN_CLASS: string;
    COMBOBOX_LIST_CLASS: string;
    COMBOBOX_POPUP_SEARCH_CLASS: string;
    COMBOBOX_ITEM_CLASS: string;
    COMBOBOX_ROW_HEIGHT_CSS: string;
    COMBOBOX_SEPARATOR_CLASS: string;
    COMBOBOX_SEPARATOR_PART: string;
    COMBOBOX_GROUP_LABEL_CLASS: string;
    COMBOBOX_SELECTED_SEPARATOR_CLASS: string;
    COMBOBOX_EMPTY_CLASS: string;
    COMBOBOX_FOOTER_DIVIDER_CLASS: string;
    COMBOBOX_FOOTER_CLASS: string;
    COMBOBOX_NO_RESULTS_LABEL: string;
    COMBOBOX_DEFAULT_ROW_HEIGHT: number;
    COMBOBOX_DEFAULT_VISIBLE_ROWS: number;
    COMBOBOX_CHIP_LABEL_MAX_LENGTH: number;
    COMBOBOX_DEFAULT_CHIP_COUNT: number;
    normalizeComboboxSearchText: (input: string) => string;
    comboboxItemLabel: (item: ComboboxOption) => string;
    comboboxItemValue: (item: ComboboxOption) => string;
    ComboboxChip: ForwardRefExoticComponent<ComboboxChipProps & RefAttributes<HTMLDivElement>>;
    COMBOBOX_CHIP_REMOVE_CLASS: string;
    ComboboxChipRemove: ForwardRefExoticComponent<
      ComboboxChipRemoveProps & RefAttributes<HTMLButtonElement>
    >;
    ComboboxItem: NamedExoticComponent<ComboboxItemRowProps>;
    ComboboxTrigger: ForwardRefExoticComponent<ComboboxTriggerProps & RefAttributes<HTMLButtonElement>>;
    ComboboxValue: ForwardRefExoticComponent<ComboboxValueProps & RefAttributes<HTMLSpanElement>>;
    COMBOBOX_AUTOCOMPLETE_PROPS: {
      autoComplete: "off";
      "data-1p-ignore": true;
      "data-lpignore": "true";
    };
    ComboboxInput: ForwardRefExoticComponent<ComboboxInputProps & RefAttributes<HTMLInputElement>>;
    ComboboxPopupSearch: ForwardRefExoticComponent<ComboboxInputProps & RefAttributes<HTMLInputElement>>;
    ComboboxClear: ForwardRefExoticComponent<ComboboxClearProps & RefAttributes<HTMLButtonElement>>;
    ComboboxFooterAction: ForwardRefExoticComponent<
      ComboboxFooterActionProps & RefAttributes<HTMLButtonElement>
    >;
    ComboboxPopup: ForwardRefExoticComponent<ComboboxPopupProps & RefAttributes<HTMLDivElement>>;
    ComboboxSheetCapablePopup: ForwardRefExoticComponent<
      ComboboxPopupProps & RefAttributes<HTMLDivElement>
    >;
    ComboboxPopupView: ForwardRefExoticComponent<
      ComboboxPopupViewProps & RefAttributes<HTMLDivElement>
    >;
    ComboboxList: ForwardRefExoticComponent<ComboboxListProps & RefAttributes<HTMLDivElement>>;
    ComboboxEmpty: ForwardRefExoticComponent<ComboboxEmptyProps & RefAttributes<HTMLDivElement>>;
    ComboboxPrimitiveItem: ForwardRefExoticComponent<
      ComboboxPrimitiveItemProps & RefAttributes<HTMLDivElement>
    >;
    ComboboxItemCheck: ForwardRefExoticComponent<
      ComboboxItemCheckProps & RefAttributes<HTMLSpanElement>
    >;
    ComboboxGroupLabel: ForwardRefExoticComponent<
      ComboboxGroupLabelProps & RefAttributes<HTMLDivElement>
    >;
    ComboboxChips: ForwardRefExoticComponent<ComboboxChipsProps & RefAttributes<HTMLDivElement>>;
    ComboboxRegistrationContext: Context<ComboboxRegistration | null>;
    ComboboxChipsContext: Context<boolean>;
    ComboboxPopupInputContext: Context<boolean>;
    nullComboboxElement: () => null;
    ComboboxComponents: ComboboxNamespace;
    initializeUiInputs26: () => void;
    FieldCombobox: FieldComboboxComponent;
    initializeUiInputs27: () => void;
    preserveFieldCheckboxFocus: (event: ReactMouseEvent<HTMLElement>) => void;
    FieldCheckbox: FieldCheckboxComponent;
    initializeUiInputs28: () => void;
    FieldComponents: FieldComponentsNamespace;
    initializeUiInputs29: () => void;
    initializeUiInputs210: () => void;
  }
}

export function installUiInputs2(runtime: RuntimeBindings): () => void {
  var reactForUiInputs22: ReactNamespace;
  var jsxForUiInputs22: JsxNamespace;
  var badgeVariantClasses: RuntimeBindings["badgeVariantClasses"];
  var BADGE_VARIANT_CLASSES: RuntimeBindings["BADGE_VARIANT_CLASSES"];
  var BADGE_SIZE_CLASSES: RuntimeBindings["BADGE_SIZE_CLASSES"];
  var BADGE_ICON_CLASSES: RuntimeBindings["BADGE_ICON_CLASSES"];
  var BADGE_ICON_SIZE_CLASSES: RuntimeBindings["BADGE_ICON_SIZE_CLASSES"];
  var BADGE_TEXT_CLASS: RuntimeBindings["BADGE_TEXT_CLASS"];
  var BADGE_LABEL_CLASSES: RuntimeBindings["BADGE_LABEL_CLASSES"];
  var Badge: RuntimeBindings["Badge"];
  var initializeUiInputs22: RuntimeBindings["initializeUiInputs22"];
  var typographyThemeValues: RuntimeBindings["typographyThemeValues"];
  var initializeUiInputs222: RuntimeBindings["initializeUiInputs222"];
  var comboboxAccessibilityNoop: RuntimeBindings["comboboxAccessibilityNoop"];
  var reactForUiInputs222: ReactNamespace;
  var initializeUiInputs23: RuntimeBindings["initializeUiInputs23"];
  var reactForUiInputs23: ReactNamespace;
  var jsxForUiInputs222: JsxNamespace;
  var COMBOBOX_STATUS_DELAY_MS: RuntimeBindings["COMBOBOX_STATUS_DELAY_MS"];
  var COMBOBOX_STATUS_CLASS: RuntimeBindings["COMBOBOX_STATUS_CLASS"];
  var COMBOBOX_STATUS_CONTENT_CLASS: RuntimeBindings["COMBOBOX_STATUS_CONTENT_CLASS"];
  var ComboboxStatus: RuntimeBindings["ComboboxStatus"];
  var initializeUiInputs24: RuntimeBindings["initializeUiInputs24"];
  var reactForUiInputs24: ReactNamespace;
  var jsxForUiInputs23: JsxNamespace;
  var COMBOBOX_VIRTUAL_OVERSCAN: RuntimeBindings["COMBOBOX_VIRTUAL_OVERSCAN"];
  var COMBOBOX_SKELETON_ROW_COUNT: RuntimeBindings["COMBOBOX_SKELETON_ROW_COUNT"];
  var initializeUiInputs25: RuntimeBindings["initializeUiInputs25"];
  var reactForUiInputs25: ReactNamespace;
  var jsxForUiInputs24: JsxNamespace;
  var COMBOBOX_TRIGGER_CLASS: RuntimeBindings["COMBOBOX_TRIGGER_CLASS"];
  var COMBOBOX_VARIANT_CLASSES: RuntimeBindings["COMBOBOX_VARIANT_CLASSES"];
  var COMBOBOX_FOCUS_CLASS: RuntimeBindings["COMBOBOX_FOCUS_CLASS"];
  var COMBOBOX_MODE_CLASSES: RuntimeBindings["COMBOBOX_MODE_CLASSES"];
  var COMBOBOX_CHIPS_INPUT_CLASS: RuntimeBindings["COMBOBOX_CHIPS_INPUT_CLASS"];
  var COMBOBOX_TRIGGER_BUTTON_CLASS: RuntimeBindings["COMBOBOX_TRIGGER_BUTTON_CLASS"];
  var COMBOBOX_INLINE_INPUT_CLASS: RuntimeBindings["COMBOBOX_INLINE_INPUT_CLASS"];
  var COMBOBOX_SEARCH_INPUT_CLASS: RuntimeBindings["COMBOBOX_SEARCH_INPUT_CLASS"];
  var COMBOBOX_CHIP_CLASS: RuntimeBindings["COMBOBOX_CHIP_CLASS"];
  var COMBOBOX_CHIP_LIST_CLASS: RuntimeBindings["COMBOBOX_CHIP_LIST_CLASS"];
  var COMBOBOX_POPUP_CLASS: RuntimeBindings["COMBOBOX_POPUP_CLASS"];
  var COMBOBOX_POPUP_BODY_CLASS: RuntimeBindings["COMBOBOX_POPUP_BODY_CLASS"];
  var COMBOBOX_ANCHOR_HIDDEN_CLASS: RuntimeBindings["COMBOBOX_ANCHOR_HIDDEN_CLASS"];
  var COMBOBOX_LIST_CLASS: RuntimeBindings["COMBOBOX_LIST_CLASS"];
  var COMBOBOX_POPUP_SEARCH_CLASS: RuntimeBindings["COMBOBOX_POPUP_SEARCH_CLASS"];
  var COMBOBOX_ITEM_CLASS: RuntimeBindings["COMBOBOX_ITEM_CLASS"];
  var COMBOBOX_ROW_HEIGHT_CSS: RuntimeBindings["COMBOBOX_ROW_HEIGHT_CSS"];
  var COMBOBOX_SEPARATOR_CLASS: RuntimeBindings["COMBOBOX_SEPARATOR_CLASS"];
  var COMBOBOX_SEPARATOR_PART: RuntimeBindings["COMBOBOX_SEPARATOR_PART"];
  var COMBOBOX_GROUP_LABEL_CLASS: RuntimeBindings["COMBOBOX_GROUP_LABEL_CLASS"];
  var COMBOBOX_SELECTED_SEPARATOR_CLASS: RuntimeBindings["COMBOBOX_SELECTED_SEPARATOR_CLASS"];
  var COMBOBOX_EMPTY_CLASS: RuntimeBindings["COMBOBOX_EMPTY_CLASS"];
  var COMBOBOX_FOOTER_DIVIDER_CLASS: RuntimeBindings["COMBOBOX_FOOTER_DIVIDER_CLASS"];
  var COMBOBOX_FOOTER_CLASS: RuntimeBindings["COMBOBOX_FOOTER_CLASS"];
  var COMBOBOX_NO_RESULTS_LABEL: RuntimeBindings["COMBOBOX_NO_RESULTS_LABEL"];
  var COMBOBOX_DEFAULT_ROW_HEIGHT: RuntimeBindings["COMBOBOX_DEFAULT_ROW_HEIGHT"];
  var COMBOBOX_DEFAULT_VISIBLE_ROWS: RuntimeBindings["COMBOBOX_DEFAULT_VISIBLE_ROWS"];
  var COMBOBOX_CHIP_LABEL_MAX_LENGTH: RuntimeBindings["COMBOBOX_CHIP_LABEL_MAX_LENGTH"];
  var COMBOBOX_DEFAULT_CHIP_COUNT: RuntimeBindings["COMBOBOX_DEFAULT_CHIP_COUNT"];
  var normalizeComboboxSearchText: RuntimeBindings["normalizeComboboxSearchText"];
  var comboboxItemLabel: RuntimeBindings["comboboxItemLabel"];
  var comboboxItemValue: RuntimeBindings["comboboxItemValue"];
  var ComboboxChip: RuntimeBindings["ComboboxChip"];
  var COMBOBOX_CHIP_REMOVE_CLASS: RuntimeBindings["COMBOBOX_CHIP_REMOVE_CLASS"];
  var ComboboxChipRemove: RuntimeBindings["ComboboxChipRemove"];
  var ComboboxItem: RuntimeBindings["ComboboxItem"];
  var ComboboxTrigger: RuntimeBindings["ComboboxTrigger"];
  var ComboboxValue: RuntimeBindings["ComboboxValue"];
  var COMBOBOX_AUTOCOMPLETE_PROPS: RuntimeBindings["COMBOBOX_AUTOCOMPLETE_PROPS"];
  var ComboboxInput: RuntimeBindings["ComboboxInput"];
  var ComboboxPopupSearch: RuntimeBindings["ComboboxPopupSearch"];
  var ComboboxClear: RuntimeBindings["ComboboxClear"];
  var ComboboxFooterAction: RuntimeBindings["ComboboxFooterAction"];
  var ComboboxPopup: RuntimeBindings["ComboboxPopup"];
  var ComboboxSheetCapablePopup: RuntimeBindings["ComboboxSheetCapablePopup"];
  var ComboboxPopupView: RuntimeBindings["ComboboxPopupView"];
  var ComboboxList: RuntimeBindings["ComboboxList"];
  var ComboboxEmpty: RuntimeBindings["ComboboxEmpty"];
  var ComboboxPrimitiveItem: RuntimeBindings["ComboboxPrimitiveItem"];
  var ComboboxItemCheck: RuntimeBindings["ComboboxItemCheck"];
  var ComboboxGroupLabel: RuntimeBindings["ComboboxGroupLabel"];
  var ComboboxChips: RuntimeBindings["ComboboxChips"];
  var ComboboxRegistrationContext: RuntimeBindings["ComboboxRegistrationContext"];
  var ComboboxChipsContext: RuntimeBindings["ComboboxChipsContext"];
  var ComboboxPopupInputContext: RuntimeBindings["ComboboxPopupInputContext"];
  var nullComboboxElement: RuntimeBindings["nullComboboxElement"];
  var ComboboxComponents: RuntimeBindings["ComboboxComponents"];
  var initializeUiInputs26: RuntimeBindings["initializeUiInputs26"];
  var jsxForUiInputs25: JsxNamespace;
  var initializeUiInputs27: RuntimeBindings["initializeUiInputs27"];
  var reactForUiInputs26: ReactNamespace;
  var jsxForUiInputs26: JsxNamespace;
  var FieldCheckbox: RuntimeBindings["FieldCheckbox"];
  var initializeUiInputs28: RuntimeBindings["initializeUiInputs28"];
  var FieldComponents: RuntimeBindings["FieldComponents"];
  var initializeUiInputs29: RuntimeBindings["initializeUiInputs29"];
  var initializeUiInputs210: RuntimeBindings["initializeUiInputs210"];
  function isBadgeVariant(input: string): input is BadgeVariant {
    return Object.hasOwn(badgeVariantClasses, input);
  }
  function comboboxAccessibilityProps({
    reactId: reactId,
    label: label,
    triggerPrefix: triggerPrefix,
    mode: mode,
    triggerMode: triggerMode,
    insideField: insideField,
  }: ComboboxAccessibilityOptions) {
    let value = label ? `${reactId}-label` : undefined,
      value2 = mode === "select" && triggerMode !== "chips",
      value3 =
        value !== undefined ||
        (!insideField && (triggerPrefix !== undefined || value2)),
      value4 = value3 ? `${reactId}-trigger` : undefined,
      value5 =
        value3 && value2 ? `${reactId}-trigger-value` : undefined,
      value6 = value3
        ? [value, value5].filter(Boolean).join(" ") || undefined
        : undefined;
    return {
      labelId: value,
      triggerId: value4,
      triggerValueId: value5,
      ownLabelProps:
        value3 && value4
          ? {
              id: value4,
              "aria-labelledby": value6,
            }
          : undefined,
    };
  }
  function accessibleNameFromElement(
    element?: Element | null,
    { fallback: options, fromTextEntry = false }: AccessibleNameOptions = {},
  ): AccessibleNameProps {
    if (
      element === null ||
      element === undefined ||
      (!fromTextEntry && (0, runtime.isEditableElement)(element))
    ) {
      return {};
    }
    let ownerDocument = element.ownerDocument,
      value = (element.getAttribute("aria-labelledby") ?? "")
        .split(/\s+/)
        .filter((input: string) => {
          if (input === "") {
            return false;
          }
          let value2 = ownerDocument.getElementById(input);
          return value2 !== null && !element.contains(value2);
        });
    if (value.length > 0) {
      return {
        "aria-labelledby": value.join(" "),
      };
    }
    for (let value2 of [
      element.getAttribute("aria-label"),
      options,
    ]) {
      let value3 = value2?.trim();
      if (value3 !== undefined && value3 !== "") {
        return {
          "aria-label": value3,
        };
      }
    }
    return {};
  }
  function useMirroredAccessibleName(
    ref: Ref<HTMLElement> | undefined,
    getFallback: () => Element | null | undefined,
    nameProps: AccessibleNameProps,
    { fallback: options, fromTextEntry = false }: AccessibleNameOptions = {},
  ) {
    let [value, value2] = reactForUiInputs222.useState<AccessibleNameProps>({}),
      value3 =
        nameProps["aria-label"] !== undefined ||
        nameProps["aria-labelledby"] !== undefined,
      callback = reactForUiInputs222.useCallback(
        (input: HTMLElement | null) => {
          if (input === null || value3) {
            return;
          }
          let value4 = accessibleNameFromElement(getFallback(), {
            fallback: options,
            fromTextEntry: fromTextEntry,
          });
          value2(
            (input2: AccessibleNameProps) =>
              input2["aria-labelledby"] === value4["aria-labelledby"] &&
              input2["aria-label"] === value4["aria-label"]
                ? input2
                : value4,
          );
        },
        [value3, getFallback, options, fromTextEntry],
      );
    return {
      ref: (0, runtime.useMergedRefs)(ref, callback),
      nameProps: value3 ? nameProps : value,
    };
  }
  function useDelayedVisible(timeoutMs: number) {
    let [value, value2] = reactForUiInputs23.useState(timeoutMs <= 0);
    reactForUiInputs23.useEffect(() => {
      if (timeoutMs <= 0) {
        return;
      }
      let value3 = window.setTimeout(
        () => value2(true),
        timeoutMs,
      );
      return () => window.clearTimeout(value3);
    }, [timeoutMs]);
    return timeoutMs <= 0 || value;
  }
  function DelayedVisible({ ms: ms2, children: children }: DelayedVisibleProps) {
    if (useDelayedVisible(ms2)) {
      return children;
    } else {
      return null;
    }
  }
  function VirtualizedComboboxRows({
    count: count,
    estimateItemSize: estimateItemSize,
    estimateRowSize: estimateRowSize,
    scrollEl: scrollEl,
    actionsRef: actionsRef,
    getItemKey: getItemKey,
    renderRow: renderRow,
  }: VirtualizedComboboxRowsProps) {
    let callback = (input: number) =>
        estimateRowSize?.(input) ?? estimateItemSize,
      value = (0, runtime.useVirtualizer)({
        count: count,
        getItemKey: getItemKey,
        getScrollElement: () => scrollEl,
        estimateSize: callback,
        measureElement: (
          input,
          options,
          context,
        ) =>
          Math.max(
            (0, runtime.measureElement)(input, options, context),
            callback(context.indexFromElement(input)),
          ),
        overscan: COMBOBOX_VIRTUAL_OVERSCAN,
        scrollPaddingStart: 28,
        scrollPaddingEnd: 28,
        enabled: scrollEl !== null,
      });
    reactForUiInputs24.useImperativeHandle(
      actionsRef,
      () => ({
        scrollToIndex: (input: number) => value.scrollToIndex(input),
      }),
      [value],
    );
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      value.measure();
    }, [value, estimateItemSize]);
    let value2 = value.getVirtualItems();
    return jsxForUiInputs23.jsx("div", {
      "data-row-pitch": estimateItemSize,
      style: {
        minHeight: `${value.getTotalSize()}px`,
        position: "relative",
      },
      children:
        value2.length > 0
          ? value2.map(
              (input) =>
                jsxForUiInputs23.jsx(
                  "div",
                  {
                    ref: value.measureElement,
                    "data-index": input.index,
                    style: {
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${input.start}px)`,
                    },
                    children: renderRow(input.index),
                  },
                  input.key,
                ),
            )
          : count > 0
            ? jsxForUiInputs23.jsx("div", {
                "aria-hidden": true,
                className: "flex flex-col gap-1 px-md py-1",
                children: Array.from<unknown, ReactElement>(
                  {
                    length: COMBOBOX_SKELETON_ROW_COUNT,
                  },
                  (input, options) =>
                    jsxForUiInputs23.jsx(
                      runtime.SkeletonPrimitive,
                      {
                        height: estimateItemSize - 8,
                        className: "w-full",
                      },
                      options,
                    ),
                ),
              })
            : null,
    });
  }
  function comboboxListHeightStyle(
    visibleItems?: number,
    rowHeight?: number,
  ) {
    if (visibleItems === undefined || !(visibleItems > 0)) {
      return;
    }
    return {
      "--cds-popup-max-h": "var(--available-height)",
      "--cds-popup-list-max-h":
        rowHeight !== undefined
          ? `calc(${visibleItems} * ${rowHeight}px)`
          : `calc(${visibleItems} * ${COMBOBOX_ROW_HEIGHT_CSS})`,
    };
  }
  function comboboxItemMatchesQuery(item: ComboboxOption, query: string) {
    let value = normalizeComboboxSearchText(query);
    return (
      normalizeComboboxSearchText(item.label).includes(value) ||
      normalizeComboboxSearchText(item.value).includes(value)
    );
  }
  function comboboxSelectionLabel(
    selected: ComboboxOption[],
    noun?: string,
    locale?: TranslateLabel,
  ) {
    let [value] = selected;
    if (value !== undefined && selected.length === 1) {
      return value.label;
    }
    if (noun !== undefined) {
      return `${selected.length} ${noun}`;
    }
    return (0, runtime.translateWithFallback)(
      locale,
      "nSelected",
      "{count} selected",
      {
        count: selected.length,
      },
    );
  }
  function comboboxGroupMetadata(
    items: ComboboxOption[],
    isSelected: (item: ComboboxOption) => boolean,
    selectedFirst: boolean,
  ): ComboboxGroupMetadata {
    let entries = new Map<string, string>(),
      values = new Set<string>(),
      entries2 = new Map<string, string>();
    if (!selectedFirst) {
      for (let value3 of items)
        if (value3.groupLabelBefore !== undefined && isSelected(value3)) {
          entries.set(value3.value, value3.groupLabelBefore);
        }
      return {
        captionAbove: entries,
        separatorAbove: values,
        runLabel: entries2,
      };
    }
    let value: string | undefined, value2: ComboboxGroupRun | undefined;
    for (let value3 of items) {
      if (value3.groupLabelBefore !== undefined) {
        value = value3.groupLabelBefore;
        value2 = {
          label: value,
          separator: value3.separatorBefore === true,
          start: value3.value,
        };
      } else if (value3.separatorBefore) {
        value = undefined;
        value2 = undefined;
      }
      if (value === undefined) {
        continue;
      }
      entries2.set(value3.value, value);
      if (value2 !== undefined && isSelected(value3)) {
        entries.set(value3.value, value2.label);
        if (value2.separator && value2.start !== value3.value) {
          values.add(value3.value);
        }
        value2 = undefined;
      }
    }
    return {
      captionAbove: entries,
      separatorAbove: values,
      runLabel: entries2,
    };
  }
  function Combobox(props: ComboboxProps) {
    let {
        "data-cds": value5 = "Combobox",
        mode = "select",
        variant = "outline",
        items: items,
        searchable: searchable,
        indicator: indicator,
        placeholder: placeholder,
        searchPlaceholder: searchPlaceholder,
        triggerPrefix: triggerPrefix,
        label: label,
        "aria-label": value,
        "aria-labelledby": value2,
        "aria-describedby": value3,
        "aria-required": value4,
        clearable = false,
        clearLabel: clearLabel,
        closeLabel: closeLabel,
        hideCaret = false,
        filter: filter,
        autoHighlight: autoHighlight,
        onInputChange: onInputChange,
        onOpenChange: onOpenChange,
        footerDivider = true,
        emptyMessage: emptyMessage,
        isLoading = false,
        loadingStaleAfter: loadingStaleAfter,
        footer: footer,
        renderItem: renderItem,
        announceGroupLabels = false,
        virtualized = false,
        estimateItemSize: estimateItemSize,
        hasMore = false,
        isFetchingMore = false,
        onLoadMore: onLoadMore,
        paginationKey: paginationKey,
        popupClassName: popupClassName,
        layerOffset: layerOffset,
        maxVisibleItems: maxVisibleItems,
        align = "start",
        collisionPadding: collisionPadding,
        disabled: disabled,
        required: required,
        name: name,
        size: size,
        fullWidth = true,
        className: className,
      } = props,
      value6 = reactForUiInputs25.useContext(
        runtime.translationContext,
      ),
      value7 = (0, runtime.useTranslation)(
        "clearSelection",
        "Clear selection",
      ),
      value8 = clearLabel ?? value7,
      value9 = (0, runtime.useTranslation)(
        "noResults",
        COMBOBOX_NO_RESULTS_LABEL,
      ),
      value10 = emptyMessage ?? value9,
      value11 =
        searchable ?? (items.length > 5 || onInputChange !== undefined),
      value12 = props.multiple === true,
      value13 = props.multiple
        ? (props.triggerMode ?? "summary")
        : null,
      value14 = (props.multiple && props.popupSearchInChips) ?? false,
      value15 = (props.multiple && props.groupSelected) ?? false,
      value16 = (props.multiple && props.keepQueryOnSelect) ?? false,
      value17 =
        value13 === "chips" && !value14 && searchable !== false,
      value18 = !value15 && filter === undefined,
      value19 = value17 && (autoHighlight ?? value18),
      value20 = value19 && !value16,
      value21 = props.multiple && (props.selectAllFooter ?? false),
      value22 = indicator ?? (value12 ? "checkbox" : "check"),
      value23 = (0, runtime.useFieldInvalid)(),
      value24 = (0, runtime.useHasFieldContext)(),
      value25 = (0, runtime.useFieldDisabled)(),
      value26 = disabled || value25,
      value27 = props.value !== undefined,
      [value28, value29] = reactForUiInputs25.useState<string | string[] | null>(
        () =>
          props.multiple
            ? (props.defaultValue ?? [])
            : (props.defaultValue ?? null),
      ),
      value30 = props.multiple
        ? value27
          ? props.value
          : (value28 as string[])
        : undefined,
      value31 = props.multiple
        ? undefined
        : value27
          ? props.value
          : (value28 as string | null),
      memo = reactForUiInputs25.useMemo(
        () =>
          new Map(
            items.map((input: ComboboxOption): [string, ComboboxOption] => [input.value, input]),
          ),
        [items],
      ),
      memo2 = reactForUiInputs25.useMemo(() => {
        if (props.multiple) {
          return (value30 ?? [])
            .map((input) => memo.get(input))
            .filter((input) => input !== undefined);
        }
        let value58 = value31 ?? null,
          value59 = value58 === null ? undefined : memo.get(value58);
        if (value59) {
          return [value59];
        } else {
          return [];
        }
      }, [props.multiple, value30, value31, memo]),
      value32 = memo2[0] ?? null,
      value33 = memo2.length > 0,
      ref = reactForUiInputs25.useRef(props);
    reactForUiInputs25.useEffect(() => {
      ref.current = props;
    }, [props]);
    let ref2 = reactForUiInputs25.useRef(memo2);
    reactForUiInputs25.useEffect(() => {
      ref2.current = memo2;
    }, [memo2]);
    let ref3 = reactForUiInputs25.useRef(false),
      ref4 = reactForUiInputs25.useRef(value30);
    reactForUiInputs25.useEffect(() => {
      ref4.current = value30;
    }, [value30]);
    let callback = reactForUiInputs25.useCallback(
        (input: ComboboxOption | ComboboxOption[] | null, options?: BaseCombobox.Root.ChangeEventDetails) => {
          let current = ref.current;
          if (current.multiple) {
            ref3.current =
              current.keepQueryOnSelect === true &&
              options?.reason === "item-press";
            let value58 = (input ?? []) as ComboboxOption[],
              values = new Set(
                value58.map((input2) => input2.value),
              ),
              value59 = ref2.current.filter(
                (input2) =>
                  input2.disabled && !values.has(input2.value),
              );
            if (value59.length > 0) {
              value58 = [...value58, ...value59];
              let values2 = new Set(ref4.current ?? []);
              if (
                value58.length === values2.size &&
                value58.every(
                  (input2) => values2.has(input2.value),
                )
              ) {
                return;
              }
            }
            let value60 = value58.map(
              (input2) => input2.value,
            );
            if (!value27) {
              value29(value60);
            }
            current.onChange?.(value60);
          } else {
            let value58 = input as ComboboxOption | null;
            if (value58?.disabled) {
              options?.cancel();
              return;
            }
            let value59 = value58?.value ?? null;
            if (!value27) {
              value29(value59);
            }
            current.onChange?.(value59);
          }
        },
        [value27],
      ),
      callback2 = reactForUiInputs25.useCallback(() => {
        let values = new Set(
          memo2.map((input) => input.value),
        );
        callback(
          ref.current.items.filter(
            (input) =>
              !input.disabled || values.has(input.value),
          ),
        );
      }, [callback, memo2]),
      callback3 = reactForUiInputs25.useCallback(() => {
        callback([]);
      }, [callback]),
      [value34, value35] = reactForUiInputs25.useState(false),
      [value36, value37] = reactForUiInputs25.useState(""),
      ref5 = reactForUiInputs25.useRef<VirtualizedRowsActions>(null),
      ref6 = reactForUiInputs25.useRef(false),
      callback4 = reactForUiInputs25.useCallback(
        (input: string, options?: BaseCombobox.Root.ChangeEventDetails) => {
          let current = ref3.current;
          ref3.current = false;
          if (current && input === "" && options?.reason === "input-clear") {
            options.cancel();
            return;
          }
          value37(input);
          if (input !== "") {
            ref6.current = false;
          }
          if (input !== "" || !ref6.current) {
            onInputChange?.(input);
          }
          if (virtualized) {
            ref5.current?.scrollToIndex(0);
          }
        },
        [onInputChange, virtualized],
      ),
      callback5 = reactForUiInputs25.useCallback(
        (input: boolean, options?: BaseCombobox.Root.ChangeEventDetails) => {
          ref3.current = false;
          let value58 = !input && options?.reason === "item-press";
          if (value12 && value58 && !value20) {
            options!.cancel?.();
            if (!value16) {
              callback4("");
            }
            return;
          }
          value35(input);
          onOpenChange?.(input);
          if (!input) {
            if (value58 && value20) {
              callback4("");
              ref6.current = true;
            } else if (value16) {
              callback4("");
              ref6.current = true;
            } else {
              value37("");
            }
          }
        },
        [value12, value16, onOpenChange, callback4, value20],
      ),
      callback6 = reactForUiInputs25.useCallback(
        () => callback5(false),
        [callback5],
      ),
      ref7 = reactForUiInputs25.useRef<{ close: () => void }>(null);
    reactForUiInputs25.useImperativeHandle(
      ref7,
      () => ({
        close: callback6,
      }),
      [callback6],
    );
    let memo3 = reactForUiInputs25.useMemo(
        () =>
          new Set(memo2.map((input) => input.value)),
        [memo2],
      ),
      memo4 = reactForUiInputs25.useMemo(() => {
        if (!value15) {
          return items;
        }
        let value58 = items.slice();
        value58.sort((input, options) => {
          return (
            (memo3.has(input.value) ? 0 : 1) -
            (memo3.has(options.value) ? 0 : 1)
          );
        });
        return value58;
      }, [items, value15, memo3]),
      memo5 = reactForUiInputs25.useMemo(() => {
        if (!virtualized || !(value11 || value17)) {
          return memo4;
        }
        let value58 = value36.trim();
        if (!value58) {
          return memo4;
        }
        let value59 = filter ?? comboboxItemMatchesQuery;
        return memo4.filter(
          (input) => value59(input, value58),
        );
      }, [virtualized, value11, value17, memo4, value36, filter]),
      ref8 = reactForUiInputs25.useRef(memo5);
    reactForUiInputs25.useEffect(() => {
      ref8.current = memo5;
    }, [memo5]);
    let callback7 = reactForUiInputs25.useCallback(
        (input: ComboboxOption | undefined, options: BaseCombobox.Root.HighlightEventDetails) => {
          if (options.reason !== "keyboard" || !input) {
            return;
          }
          let value58 = ref8.current.findIndex(
            (input2) => input2.value === input.value,
          );
          if (value58 >= 0) {
            ref5.current?.scrollToIndex(value58);
          }
        },
        [],
      ),
      memo6 = reactForUiInputs25.useMemo(() => {
        if (virtualized) {
          return null;
        }
        if (!value11 && !value17 && mode === "select") {
          return null;
        }
        let value58 = filter ?? comboboxItemMatchesQuery;
        return (input: ComboboxOption, options: string) =>
          value58(input, options);
      }, [virtualized, value11, value17, mode, filter]),
      memo7 = reactForUiInputs25.useMemo(() => {
        let value58 = value36.trim();
        if (!memo6 || value58 === "") {
          return memo5.length;
        }
        let index = 0;
        for (let value59 of memo5)
          if (memo6(value59, value58)) {
            index += 1;
          }
        return index;
      }, [memo6, memo5, value36]),
      value38 = isLoading && loadingStaleAfter !== undefined,
      value39 = renderItem,
      callback8 = reactForUiInputs25.useCallback(
        (
          input: ComboboxOption,
          options: ComboboxGroupMetadata | null,
          context: boolean,
          value58?: number,
        ) =>
          jsxForUiInputs24.jsx(
            ComboboxItem,
            {
              item: input,
              index: value58,
              wrapDescription: value58 === undefined,
              selected: memo3.has(input.value),
              stale: value38,
              renderItem: value39,
              searchQuery: value39 ? value36 : "",
              indicator: value22,
              leadsList: context,
              separatorAbove: options?.separatorAbove.has(input.value) ?? false,
              groupCaption: options?.captionAbove.get(input.value),
              announcedGroupLabel: announceGroupLabels
                ? options?.runLabel.get(input.value)
                : undefined,
            },
            input.value,
          ),
        [value39, value36, value22, memo3, value38, announceGroupLabels],
      ),
      ref9 = reactForUiInputs25.useRef<HTMLDivElement>(null),
      ref10 = reactForUiInputs25.useRef(false),
      ref11 = reactForUiInputs25.useRef(false);
    reactForUiInputs25.useEffect(() => {
      ref11.current = value34;
    }, [value34]);
    reactForUiInputs25.useEffect(() => {
      if (mode !== "input") {
        return;
      }
      let value58 = ref9.current?.ownerDocument ?? document,
        value59 = value58.defaultView ?? window,
        callback11 = () => {
          ref10.current = ref11.current;
          let callback12 = () => {
            value59.removeEventListener("pointerup", callback12);
            value59.removeEventListener("pointercancel", callback12);
            value59.setTimeout(() => {
              ref10.current = false;
            }, 0);
          };
          value59.addEventListener("pointerup", callback12);
          value59.addEventListener("pointercancel", callback12);
        };
      value58.addEventListener("pointerdown", callback11, {
        capture: true,
        passive: true,
      });
      return () => {
        value58.removeEventListener("pointerdown", callback11, {
          capture: true,
        });
      };
    }, [mode]);
    let callback9 = reactForUiInputs25.useCallback(() => {
        ref9.current?.querySelector("input")?.focus();
      }, []),
      { clickToFocusProps: clickToFocusProps } = (0,
      runtime.useClickToFocus)(
        () => {
          if (value34 || ref10.current) {
            return;
          }
          callback9();
        },
        {
          disabled: value26,
        },
      ),
      memo8 = reactForUiInputs25.useMemo(
        () =>
          new Set(
            memo2
              .filter((input) => input.disabled)
              .map((input) => input.value),
          ),
        [memo2],
      ),
      value40 =
        props.multiple === true &&
        (value30 ?? []).some((input) => !memo8.has(input)),
      value41 = value33 && (!props.multiple || value40),
      value42 = clearable && value41,
      value43 = !hideCaret && !(clearable && value27 && value41),
      value44 =
        mode === "select" &&
        value11 &&
        (value13 !== "chips" || value14) &&
        (items.length > 0 || isLoading || onInputChange !== undefined),
      value45 = mode === "select" && value13 !== "chips" && !value44,
      value46 = value17
        ? value19
        : (autoHighlight ?? (value18 && (mode === "input" || value44))),
      callback10 = () => {
        let callback11 = (
          input: ReactNode,
          options = false,
        ) =>
          !value32?.icon
            ? input
            : jsxForUiInputs24.jsxs("span", {
                className: "flex min-w-0 items-center gap-2",
                children: [
                  jsxForUiInputs24.jsx(runtime.IconSlot, {
                    icon: value32.icon,
                  }),
                  jsxForUiInputs24.jsx("span", {
                    className: (0, runtime.cn)(
                      "min-w-0 truncate",
                      options && "self-baseline",
                    ),
                    children: input,
                  }),
                ],
              });
        if (props.multiple) {
          let value58 =
            props.renderTriggerValue?.(memo2) ??
            (memo2.length === 0
              ? (placeholder ?? " ")
              : comboboxSelectionLabel(memo2, props.summaryNoun, value6));
          if (triggerPrefix !== undefined) {
            return jsxForUiInputs24.jsxs("span", {
              className: "flex min-w-0 items-baseline gap-1.5",
              children: [
                jsxForUiInputs24.jsx("span", {
                  className: "shrink-0 text-muted",
                  children: triggerPrefix,
                }),
                jsxForUiInputs24.jsx("span", {
                  className: "min-w-0 truncate",
                  children: value58,
                }),
              ],
            });
          }
          if (memo2.length === 0) {
            return jsxForUiInputs24.jsx("span", {
              className: "font-normal text-muted",
              children: value58,
            });
          }
          return value58;
        }
        if (triggerPrefix !== undefined) {
          let value58 =
            props.renderTriggerValue?.(value32) ??
            value32?.label ??
            placeholder;
          return jsxForUiInputs24.jsxs("span", {
            className: "flex min-w-0 items-baseline gap-1.5",
            children: [
              jsxForUiInputs24.jsx("span", {
                className: "shrink-0 text-muted",
                children: triggerPrefix,
              }),
              value58 !== undefined &&
                jsxForUiInputs24.jsx("span", {
                  className: "min-w-0 truncate",
                  title: value32?.label,
                  children: callback11(value58, true),
                }),
            ],
          });
        }
        if (props.renderTriggerValue) {
          let value58 = props.renderTriggerValue(value32);
          if (value58 !== undefined && value58 !== null) {
            return callback11(value58);
          }
        }
        if (!value32) {
          return jsxForUiInputs24.jsx("span", {
            className: "font-normal text-muted",
            children: placeholder ?? " ",
          });
        }
        return callback11(value32.label);
      },
      value47 =
        value43 &&
        jsxForUiInputs24.jsx("span", {
          "aria-hidden": true,
          className:
            "pointer-events-none flex size-icon shrink-0 items-center justify-center text-muted",
          children: jsxForUiInputs24.jsx(runtime.Icon, {
            name: "CaretDown",
            size: "sm",
          }),
        }),
      value48 = value42 && (mode === "select" || !value43),
      text =
        "[--fh:var(--cds-h-control)] [--fhn:var(--cds-h-control-nested)] [--fr:var(--cds-radius)]",
      value49 =
        value42 &&
        jsxForUiInputs24.jsx("span", {
          className: value48
            ? `flex aspect-square h-control shrink-0 items-center justify-center ${text}`
            : `flex shrink-0 items-center ${text}`,
          children: jsxForUiInputs24.jsx(runtime.baseCombobox.Clear, {
            render: jsxForUiInputs24.jsx(runtime.Button, {
              iconOnly: true,
              variant: "ghost",
              size: size === "sm" || size === "xs" ? "xs" : "sm",
              icon: "X",
              "aria-label": value8,
              tooltip: false,
              className:
                "!size-[var(--fhn)] !rounded-[calc(var(--fr)-(var(--fh)-var(--fhn))/2)] data-[ending-style]:hidden",
            }),
          }),
        }),
      value50 = fullWidth ? "w-full min-w-0" : "shrink-0",
      value51 = reactForUiInputs25.useId(),
      {
        labelId: labelId,
        triggerId: triggerId,
        triggerValueId: triggerValueId,
        ownLabelProps: ownLabelProps,
      } = comboboxAccessibilityProps({
        reactId: value51,
        label: label,
        triggerPrefix: triggerPrefix,
        mode: mode,
        triggerMode: value13,
        insideField: value24,
      }),
      state = {
        ...(value2 !== undefined
          ? {
              ...(ownLabelProps && {
                id: ownLabelProps.id,
              }),
              ...(value !== undefined && {
                "aria-label": value,
              }),
              "aria-labelledby": value2,
            }
          : value !== undefined && !label
            ? {
                ...(ownLabelProps && {
                  id: ownLabelProps.id,
                }),
                "aria-label": value,
              }
            : ownLabelProps || value !== undefined
              ? {
                  ...ownLabelProps,
                  ...(value !== undefined && {
                    "aria-label": value,
                  }),
                }
              : ownLabelProps),
        ...(value3 !== undefined && {
          "aria-describedby": value3,
        }),
        ...(value4 && {
          "aria-required": true,
        }),
      },
      value52 = value48 ? "pr-0" : "pr-sm",
      value53 =
        memo2.length > 0
          ? "pl-[calc((var(--cds-h-control)-var(--cds-h-control-nested))/2)]"
          : "pl-sm",
      value54 =
        value13 === "chips"
          ? `${COMBOBOX_CHIPS_INPUT_CLASS} ${value53} ${value50}`
          : `${COMBOBOX_TRIGGER_CLASS} ${COMBOBOX_VARIANT_CLASSES[variant]} ${COMBOBOX_MODE_CLASSES[mode]} ${value52} ${value50}`,
      value55 = (0, runtime.useSheetCapablePresentation)(),
      value56 = jsxForUiInputs24.jsxs(runtime.baseCombobox.Root, {
        multiple: value12,
        items: virtualized ? memo5 : memo4,
        value: value12 ? memo2 : value32,
        onValueChange: callback,
        open: value34,
        onOpenChange: callback5,
        ...(mode === "select"
          ? {
              inputValue: value36,
            }
          : {}),
        onInputValueChange: callback4,
        onItemHighlighted: virtualized ? callback7 : undefined,
        virtualized: virtualized,
        filter: memo6,
        autoHighlight: value46,
        itemToStringLabel: comboboxItemLabel,
        itemToStringValue: comboboxItemValue,
        disabled: value26,
        required: required,
        name: name,
        children: [
          value13 === "chips"
            ? jsxForUiInputs24.jsxs("div", {
                ref: ref9,
                "data-cds": value5,
                ...(0, runtime.getControlSizeAttributes)(size),
                className: (0, runtime.cn)(value54, className),
                "data-disabled": value26 || undefined,
                "data-invalid": value23 || undefined,
                onMouseDown: clickToFocusProps.onMouseDown,
                onClick: value26
                  ? undefined
                  : (event: ReactMouseEvent<HTMLDivElement>) => {
                      event.preventDefault();
                      if (!value34) {
                        callback9();
                        callback5(true);
                      }
                    },
                children: [
                  jsxForUiInputs24.jsxs(runtime.baseCombobox.Chips, {
                    className: `${COMBOBOX_CHIP_LIST_CLASS} ${value34 ? "" : "pointer-events-none"}`,
                    children: [
                      memo2.map(
                        (input) =>
                          jsxForUiInputs24.jsx(
                            ComboboxChip,
                            {
                              removable: value34 && !input.disabled,
                              children: input.label,
                            },
                            input.value,
                          ),
                      ),
                      jsxForUiInputs24.jsx(runtime.baseCombobox.Input, {
                        className: `${COMBOBOX_SEARCH_INPUT_CLASS} ${memo2.length === 0 && placeholder === undefined ? "min-w-[2ch]" : ""}`,
                        placeholder:
                          memo2.length === 0 ? placeholder : undefined,
                        disabled: value26,
                        ...state,
                        autoComplete: "off",
                        "data-1p-ignore": true,
                        "data-lpignore": "true",
                      }),
                    ],
                  }),
                  value47,
                ],
              })
            : mode === "input"
              ? jsxForUiInputs24.jsxs("div", {
                  ref: ref9,
                  "data-cds": value5,
                  ...(0, runtime.getControlSizeAttributes)(size),
                  className: (0, runtime.cn)(value54, className),
                  "data-disabled": value26 || undefined,
                  "data-invalid": value23 || undefined,
                  onMouseDown: clickToFocusProps.onMouseDown,
                  onClick: value26
                    ? undefined
                    : (event: ReactMouseEvent<HTMLDivElement>) => {
                        let current = ref10.current;
                        ref10.current = false;
                        let ancestor = (event.target as Element).closest("button");
                        if (
                          ancestor &&
                          event.currentTarget.contains(ancestor)
                        ) {
                          return;
                        }
                        event.preventDefault();
                        if (!value34 && !current) {
                          callback9();
                          callback5(true);
                        }
                      },
                  children: [
                    jsxForUiInputs24.jsx(runtime.baseCombobox.Input, {
                      className: COMBOBOX_INLINE_INPUT_CLASS,
                      placeholder: placeholder,
                      disabled: value26,
                      ...state,
                      autoComplete: "off",
                      "data-1p-ignore": true,
                      "data-lpignore": "true",
                    }),
                    value49,
                    value47,
                  ],
                })
              : jsxForUiInputs24.jsxs("div", {
                  ref: ref9,
                  "data-cds": value5,
                  ...(0, runtime.getControlSizeAttributes)(size),
                  className: (0, runtime.cn)(value54, className),
                  "data-disabled": value26 || undefined,
                  "data-invalid": value23 || undefined,
                  children: [
                    jsxForUiInputs24.jsxs(runtime.baseCombobox.Trigger, {
                      disabled: value26,
                      ...state,
                      className: COMBOBOX_TRIGGER_BUTTON_CLASS,
                      children: [
                        jsxForUiInputs24.jsx(
                          "span",
                          {
                            id: triggerValueId,
                            className: "min-w-0 flex-1 truncate",
                            children: callback10(),
                          },
                          memo2
                            .map((input) => input.value)
                            .join("\x00"),
                        ),
                        value43 &&
                          jsxForUiInputs24.jsx(runtime.Icon, {
                            name: "CaretDown",
                            size: "sm",
                            className:
                              "mr-0.5 shrink-0 text-muted transition-colors group-hover/cbx:text-secondary",
                          }),
                      ],
                    }),
                    value49,
                  ],
                }),
          jsxForUiInputs24.jsx(runtime.baseCombobox.Portal, {
            container: (0, runtime.usePortalContainer)(),
            children: jsxForUiInputs24.jsx(ComboboxPopupResponsive, {
              anchorRef: ref9,
              align: align,
              collisionPadding: collisionPadding,
              popupClassName: popupClassName,
              layerOffset: layerOffset,
              maxVisibleItems: maxVisibleItems,
              dataCds: value5,
              isLoading: isLoading,
              loadingStaleAfter: loadingStaleAfter,
              showPopupSearch: value44,
              focusListOnOpen: value45,
              searchPlaceholder: searchPlaceholder ?? placeholder,
              triggerPrefix: triggerPrefix,
              chipsPopupSearch: value13 === "chips" && value44,
              disabled: value26,
              virtualized: virtualized,
              sortedItems: memo4,
              displayedItems: memo5,
              renderedItemCount: memo7,
              estimateItemSize: estimateItemSize,
              hasMore: hasMore,
              isFetchingMore: isFetchingMore,
              onLoadMore: onLoadMore,
              paginationKey: paginationKey,
              virtualRowsRef: ref5,
              emptyMessage: value10,
              groupSelected: value15,
              renderListItem: callback8,
              valueSet: memo3,
              searchQuery: value36,
              showSelectAllFooter: value21,
              footer: footer,
              footerDivider: footerDivider,
              handleSelectAll: callback2,
              handleClearAll: callback3,
              selectAllDisabled: items.every(
                (input) =>
                  input.disabled || memo3.has(input.value),
              ),
              clearAllDisabled: !value40,
              close: callback6,
              closeLabel: closeLabel,
            }),
          }),
        ],
      }),
      value57 = jsxForUiInputs24.jsx(
        runtime.CloseOnActivityHideProvider,
        {
          actionsRef: ref7,
          children: value55
            ? jsxForUiInputs24.jsx(runtime.FloatingPositionRenderProp, {
                open: value34,
                close: callback6,
                onOpenChange: callback5,
                structurallyAnchored: mode !== "select" || value13 === "chips",
                children: (input: AdaptiveSheet) =>
                  reactForUiInputs25.cloneElement(value56 as ReactElement<ComboboxRootSheetOverrides>, {
                    modal: input.modal,
                    onOpenChange: input.onOpenChange,
                    onOpenChangeComplete: input.onOpenChangeComplete,
                  }),
              })
            : value56,
        },
      );
    if (labelId === undefined) {
      return value57;
    }
    return jsxForUiInputs24.jsxs("div", {
      className: `gap-xs flex-col font-sans ${fullWidth ? "flex w-full" : "inline-flex"}`,
      children: [
        jsxForUiInputs24.jsx("label", {
          id: labelId,
          htmlFor: triggerId,
          className: "text-body text-primary font-medium leading-none",
          children: label,
        }),
        value57,
      ],
    });
  }
  function comboboxSheetLabel(
    pointerType: string,
    touch: HTMLElement | null | undefined,
    desktop: HTMLElement | null | undefined,
    fallback: HTMLElement | null | undefined,
  ): HTMLElement | undefined {
    if (pointerType === "touch") {
      return touch ?? undefined;
    }
    return desktop ?? fallback ?? touch ?? undefined;
  }
  function ComboboxPopupResponsive(props: ComboboxPopupResponsiveProps) {
    if ((0, runtime.useHasSheetFrame)()) {
      return jsxForUiInputs24.jsx(ComboboxPopupAsSheet, {
        ...props,
      });
    } else {
      return jsxForUiInputs24.jsx(ComboboxPopupFrame, {
        ...props,
        sheetPopup: runtime.defaultSheetHost,
        sheetParts: null,
      });
    }
  }
  function ComboboxPopupAsSheet(props: ComboboxPopupResponsiveProps) {
    return jsxForUiInputs24.jsx(runtime.AdaptiveSheetPopupHost, {
      kind: "combobox",
      children: (input: SheetHost, options: SheetImplementation | null) =>
        jsxForUiInputs24.jsx(ComboboxPopupFrame, {
          ...props,
          sheetPopup: input,
          sheetParts: options,
        }),
    });
  }
  function ComboboxPopupFrame({
    sheetPopup: sheetPopup,
    sheetParts: sheetParts,
    anchorRef: anchorRef,
    align: align,
    collisionPadding: collisionPadding,
    popupClassName: popupClassName,
    layerOffset: layerOffset,
    maxVisibleItems: maxVisibleItems,
    dataCds: dataCds,
    isLoading: isLoading,
    loadingStaleAfter: loadingStaleAfter,
    showPopupSearch: showPopupSearch,
    focusListOnOpen: focusListOnOpen,
    searchPlaceholder: searchPlaceholder,
    triggerPrefix: triggerPrefix,
    chipsPopupSearch: chipsPopupSearch,
    disabled: disabled,
    virtualized: virtualized,
    sortedItems: sortedItems,
    displayedItems: displayedItems,
    renderedItemCount: renderedItemCount,
    estimateItemSize: estimateItemSize,
    hasMore: hasMore,
    isFetchingMore: isFetchingMore,
    onLoadMore: onLoadMore,
    paginationKey: paginationKey,
    virtualRowsRef: virtualRowsRef,
    emptyMessage: emptyMessage,
    groupSelected: groupSelected,
    renderListItem: renderListItem,
    valueSet: valueSet,
    searchQuery: searchQuery,
    showSelectAllFooter: showSelectAllFooter,
    footer: footer,
    footerDivider: footerDivider,
    handleSelectAll: handleSelectAll,
    handleClearAll: handleClearAll,
    selectAllDisabled: selectAllDisabled,
    clearAllDisabled: clearAllDisabled,
    close: close,
    closeLabel: closeLabel,
  }: ComboboxPopupFrameProps) {
    let value = (0, runtime.useTranslation)(
        "loadingOptions",
        "Loading options",
      ),
      value2 = (0, runtime.useTranslation)(
        "loadingMoreOptions",
        "Loading more options",
      ),
      value3 = isLoading && renderedItemCount === 0,
      value4 = (0, runtime.useTranslation)("selectAll", "Select all"),
      value5 = (0, runtime.useTranslation)("clear", "Clear"),
      [value6, value7] = reactForUiInputs25.useState<HTMLElement | null>(null),
      value8 = (0, runtime.useRootRemSize)(),
      value9 = (0, runtime.useDensity)(),
      sheet = sheetPopup.sheet,
      value10 = sheet
        ? (typographyThemeValues["leading-body"].steps[
            (0, runtime.getDensitySizeIndex)("comfortable", "lg") - 1
          ] ?? typographyThemeValues["leading-body"].comfortable)
        : typographyThemeValues["leading-body"][value9],
      value11 =
        estimateItemSize === undefined
          ? Math.ceil(
              Math.max(COMBOBOX_DEFAULT_ROW_HEIGHT / 16, value10 + 0.5) *
                value8,
            )
          : value8 === 16
            ? estimateItemSize
            : Math.ceil((estimateItemSize * value8) / 16),
      value12 = runtime.baseCombobox.useFilteredItems<ComboboxOption>(),
      value13 = virtualized ? displayedItems : value12,
      value14 = !(groupSelected && valueSet.size > 0),
      memo = reactForUiInputs25.useMemo(() => {
        if (
          !sortedItems.some(
            (input) => input.groupLabelBefore !== undefined,
          )
        ) {
          return null;
        }
        let values = new Set(
          value13.map((input) => input.value),
        );
        return comboboxGroupMetadata(
          sortedItems,
          (input) => values.has(input.value),
          value14,
        );
      }, [sortedItems, value13, value14]),
      value15 = value13[0]?.value,
      callback = reactForUiInputs25.useCallback(
        (input: ComboboxOption) =>
          renderListItem(input, memo, input.value === value15),
        [renderListItem, memo, value15],
      ),
      callback2 = reactForUiInputs25.useCallback(
        (input: number) => {
          let value25 = displayedItems[input];
          if (value25 === undefined) {
            return input;
          } else {
            return value25.value;
          }
        },
        [displayedItems],
      ),
      callback3 = reactForUiInputs25.useCallback(
        (input: number) => {
          let value25 = displayedItems[input];
          if (value25 === undefined) {
            return null;
          } else {
            return renderListItem(value25, memo, input === 0, input);
          }
        },
        [displayedItems, renderListItem, memo],
      ),
      value16 = onLoadMore !== undefined,
      [value17, value18] = reactForUiInputs25.useState<HTMLElement | null>(null),
      ref = reactForUiInputs25.useRef(onLoadMore);
    reactForUiInputs25.useEffect(() => {
      ref.current = onLoadMore;
    }, [onLoadMore]);
    let ref2 = reactForUiInputs25.useRef<number | null>(null);
    reactForUiInputs25.useEffect(() => {
      ref2.current = null;
    }, [searchQuery, paginationKey]);
    let ref3 = reactForUiInputs25.useRef(renderedItemCount);
    reactForUiInputs25.useEffect(() => {
      if (renderedItemCount < ref3.current) {
        ref2.current = null;
      }
      ref3.current = renderedItemCount;
    }, [renderedItemCount]);
    reactForUiInputs25.useEffect(() => {
      if (
        !value17 ||
        !value6 ||
        !value16 ||
        isFetchingMore ||
        renderedItemCount === 0 ||
        (ref2.current !== null && renderedItemCount <= ref2.current)
      ) {
        return;
      }
      let value25 = new IntersectionObserver(
        (input) => {
          if (!input.at(-1)?.isIntersecting) {
            return;
          }
          value25.disconnect();
          ref2.current = renderedItemCount;
          ref.current?.();
        },
        {
          root: value6,
          rootMargin: `0px 0px ${value11 * COMBOBOX_DEFAULT_CHIP_COUNT}px 0px`,
        },
      );
      value25.observe(value17);
      return () => value25.disconnect();
    }, [
      value17,
      value6,
      value16,
      isFetchingMore,
      renderedItemCount,
      searchQuery,
      paginationKey,
      value11,
    ]);
    let value19 = (0, runtime.useOverlayLayer)(
        "combobox",
        layerOffset,
      ),
      value20 = sheetPopup.sheet ? sheetPopup.chrome : null,
      value21 =
        sheetPopup.sheet && sheetParts !== null ? sheetParts : null,
      value22 = reactForUiInputs25.useContext(
        runtime.sheetParentContext,
      ),
      value23 = sheet
        ? Math.max(value11, Math.ceil((40 * value8) / 16))
        : value11,
      callback4 = reactForUiInputs25.useCallback(
        (input: number) => {
          let value25 = displayedItems[input];
          if (value25 === undefined) {
            return value23;
          }
          let value26 =
              input > 0 &&
              (value25.separatorBefore ||
                (memo?.separatorAbove.has(value25.value) ?? false)),
            value27 = memo?.captionAbove.has(value25.value) ?? false;
          return (
            value23 +
            (value26 ? COMBOBOX_DEFAULT_VISIBLE_ROWS : 0) +
            (value27 ? COMBOBOX_CHIP_LABEL_MAX_LENGTH : 0)
          );
        },
        [displayedItems, memo, value23],
      ),
      ref4 = reactForUiInputs25.useRef<HTMLElement>(null),
      value24 = (0, runtime.useMergedRefs)(ref4, sheetPopup.ref),
      callback5 = reactForUiInputs25.useCallback(
        () => anchorRef.current?.querySelector('[role="combobox"]'),
        [anchorRef],
      ),
      ref5 = reactForUiInputs25.useRef<HTMLElement>(null),
      { ref: ref6, nameProps: nameProps } = useMirroredAccessibleName(
        ref5,
        callback5,
        {},
        {
          fallback: triggerPrefix,
          fromTextEntry: chipsPopupSearch,
        },
      ),
      callback6 = reactForUiInputs25.useCallback(
        (input: string) =>
          comboboxSheetLabel(input, ref4.current, null, ref5.current),
        [],
      );
    return jsxForUiInputs24.jsxs(runtime.PortalRoot, {
      ...value19.portalProps,
      style: sheetPopup.concealed
        ? {
            ...value19.portalProps.style,
            ...runtime.concealedPopupStyle,
          }
        : value19.portalProps.style,
      surface: runtime.elevationSurfaceNames.popover,
      density: sheet ? runtime.SHEET_DENSITY : undefined,
      closeOnActivityHide: true,
      children: [
        value21 !== null &&
          sheetPopup.sheet &&
          jsxForUiInputs24.jsx(value21.ComboboxSheetBackdrop, {
            sheetPopup: sheetPopup,
          }),
        jsxForUiInputs24.jsx(runtime.layerBaseContext.Provider, {
          value: value19.base,
          children: jsxForUiInputs24.jsx(runtime.baseCombobox.Positioner, {
            style:
              sheetPopup.positionerStyle !== undefined
                ? {
                    ...value19.style,
                    ...sheetPopup.positionerStyle,
                  }
                : value19.style,
            anchor: anchorRef,
            side: "bottom",
            align: align,
            sideOffset: 6,
            collisionPadding: collisionPadding,
            positionMethod: "fixed",
            ...(sheet ? runtime.sheetPositioningOverrides : {}),
            className: (0, runtime.cn)(
              popupClassName ?? "w-[var(--anchor-width)] min-w-[12rem]",
              !sheet && COMBOBOX_ANCHOR_HIDDEN_CLASS,
              sheet &&
                sheetPopup.state.depth === 0 &&
                "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-[100dvh] after:bg-surface-3",
            ),
            children: jsxForUiInputs24.jsxs(runtime.baseCombobox.Popup, {
              ref: value24,
              "data-cds": dataCds,
              initialFocus: focusListOnOpen ? callback6 : undefined,
              ...nameProps,
              ...sheetPopup.attrs,
              className: (0, runtime.cn)(
                COMBOBOX_POPUP_CLASS,
                sheet && runtime.sheetPopupClasses,
                sheet &&
                  "data-[starting-style]:translate-y-[calc(100%+1.5rem)] data-[ending-style]:translate-y-[calc(100%+1.5rem)]",
                sheet &&
                  "origin-top [&[data-cds-sheet-covered]:not([data-starting-style]):not([data-ending-style])]:-translate-y-3 data-[cds-sheet-covered]:scale-[0.94] after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-backdrop after:opacity-0 after:transition-opacity after:duration-sheet motion-reduce:after:transition-none data-[cds-sheet-covered]:after:opacity-100",
              ),
              style: {
                ...(sheet
                  ? undefined
                  : comboboxListHeightStyle(
                      maxVisibleItems,
                      virtualized ? value23 : undefined,
                    )),
                ...(loadingStaleAfter !== undefined && {
                  "--cds-combobox-stale-after": `${loadingStaleAfter}ms`,
                }),
                ...sheetPopup.style,
              },
              "aria-busy": isLoading || isFetchingMore,
              children: [
                value20 !== null && jsxForUiInputs24.jsx(value20.Handle, {}),
                jsxForUiInputs24.jsx(runtime.sheetParentContext.Provider, {
                  value: sheet ? sheetPopup.stack : value22,
                  children: jsxForUiInputs24.jsxs("div", {
                    className: COMBOBOX_POPUP_BODY_CLASS,
                    children: [
                      showPopupSearch &&
                        jsxForUiInputs24.jsx(runtime.baseCombobox.Input, {
                          className: COMBOBOX_POPUP_SEARCH_CLASS,
                          placeholder: searchPlaceholder,
                          disabled: disabled,
                          ...nameProps,
                          autoComplete: "off",
                          "data-1p-ignore": true,
                          "data-lpignore": "true",
                        }),
                      jsxForUiInputs24.jsx("div", {
                        ref: virtualized || value16 ? value7 : undefined,
                        tabIndex: -1,
                        className: COMBOBOX_LIST_CLASS,
                        [runtime.SHEET_SCROLL_ATTRIBUTE]: "",
                        children: jsxForUiInputs24.jsxs(
                          jsxForUiInputs24.Fragment,
                          {
                            children: [
                              jsxForUiInputs24.jsx(runtime.baseCombobox.Empty, {
                                className: COMBOBOX_EMPTY_CLASS,
                                children:
                                  isLoading || isFetchingMore
                                    ? null
                                    : emptyMessage,
                              }),
                              jsxForUiInputs24.jsx(runtime.baseCombobox.List, {
                                ref: ref6,
                                tabIndex: -1,
                                ...nameProps,
                                className: `cds-reset outline-none focus-visible:outline-hidden ${groupSelected ? COMBOBOX_SELECTED_SEPARATOR_CLASS : ""}`,
                                children: virtualized
                                  ? jsxForUiInputs24.jsx(
                                      VirtualizedComboboxRows,
                                      {
                                        count: displayedItems.length,
                                        estimateItemSize: value23,
                                        estimateRowSize: callback4,
                                        scrollEl: value6,
                                        actionsRef: virtualRowsRef,
                                        getItemKey: callback2,
                                        renderRow: callback3,
                                      },
                                    )
                                  : callback,
                              }),
                              hasMore &&
                                value16 &&
                                !isLoading &&
                                jsxForUiInputs24.jsx("div", {
                                  ref: value18,
                                  "aria-hidden": true,
                                  className: "h-px",
                                }),
                              jsxForUiInputs24.jsx(ComboboxStatus, {
                                delay: 0,
                                loading: value3 || isFetchingMore,
                                loadingLabel: value3 ? value : value2,
                              }),
                            ],
                          },
                        ),
                      }),
                      (showSelectAllFooter || footer) &&
                        jsxForUiInputs24.jsxs(jsxForUiInputs24.Fragment, {
                          children: [
                            footerDivider &&
                              jsxForUiInputs24.jsx("div", {
                                "aria-hidden": true,
                                className: COMBOBOX_FOOTER_DIVIDER_CLASS,
                              }),
                            jsxForUiInputs24.jsxs("div", {
                              className: footerDivider
                                ? COMBOBOX_FOOTER_CLASS
                                : "shrink-0",
                              children: [
                                showSelectAllFooter &&
                                  jsxForUiInputs24.jsxs("div", {
                                    className:
                                      "flex items-center justify-between gap-sm p-1",
                                    children: [
                                      jsxForUiInputs24.jsx(runtime.Button, {
                                        variant: "ghost",
                                        size: "sm",
                                        onClick: handleSelectAll,
                                        disabled: selectAllDisabled,
                                        children: value4,
                                      }),
                                      jsxForUiInputs24.jsx(runtime.Button, {
                                        variant: "ghost",
                                        size: "sm",
                                        onClick: handleClearAll,
                                        disabled: clearAllDisabled,
                                        children: value5,
                                      }),
                                    ],
                                  }),
                                footer &&
                                  (typeof footer === "function"
                                    ? footer({
                                        close: close,
                                      })
                                    : footer),
                              ],
                            }),
                          ],
                        }),
                      value20 !== null &&
                        jsxForUiInputs24.jsx(value20.DismissButton, {
                          onDismiss: close,
                          label: closeLabel,
                        }),
                    ],
                  }),
                }),
              ],
            }),
          }),
        }),
      ],
    });
  }
  function useComboboxOutsideInputRegistration() {
    let value = reactForUiInputs25.useContext(
        ComboboxRegistrationContext,
      ),
      value2 = reactForUiInputs25.useContext(
        ComboboxPopupInputContext,
      );
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      if (value === null || value2) {
        return;
      }
      return value.addOutsideInput();
    }, [value, value2]);
  }
  function useComboboxTriggerRef(ref?: Ref<HTMLElement>) {
    let value = reactForUiInputs25.useContext(
        ComboboxRegistrationContext,
      ),
      value2 = useComboboxRegistrationRef(
        reactForUiInputs25.useContext(ComboboxPopupInputContext)
          ? undefined
          : value?.setTrigger,
        value?.getTrigger,
      );
    return (0, runtime.useMergedRefs)(ref, value2);
  }
  function useComboboxPopupInputRef(ref?: Ref<HTMLElement>) {
    let value = reactForUiInputs25.useContext(
        ComboboxRegistrationContext,
      ),
      value2 = useComboboxRegistrationRef(
        reactForUiInputs25.useContext(ComboboxPopupInputContext)
          ? value?.setPopupInput
          : undefined,
        value?.getPopupInput,
      );
    return (0, runtime.useMergedRefs)(ref, value2);
  }
  function useComboboxTriggerElement() {
    let value = reactForUiInputs25.useContext(
      ComboboxRegistrationContext,
    );
    if (reactForUiInputs25.useContext(ComboboxChipsContext)) {
      return nullComboboxElement;
    } else {
      return value?.getTrigger ?? nullComboboxElement;
    }
  }
  function useComboboxAccessibleName(
    ref: Ref<HTMLElement> | undefined,
    label?: string,
    labelledBy?: string,
  ) {
    let value = reactForUiInputs25.useContext(
        ComboboxPopupInputContext,
      ),
      value2 = useComboboxTriggerElement();
    return useMirroredAccessibleName(
      ref,
      value ? value2 : nullComboboxElement,
      {
        ...(label !== undefined && {
          "aria-label": label,
        }),
        ...(labelledBy !== undefined && {
          "aria-labelledby": labelledBy,
        }),
      },
    );
  }
  function useComboboxListRef(ref?: Ref<HTMLElement>) {
    let value = reactForUiInputs25.useContext(
        ComboboxRegistrationContext,
      ),
      value2 = useComboboxRegistrationRef(
        value?.setList,
        value?.getList,
      );
    return (0, runtime.useMergedRefs)(ref, value2);
  }
  function useComboboxRegistrationRef(
    setElement?: (element: HTMLElement | null) => void,
    getElement?: () => HTMLElement | null,
  ): (element: HTMLElement | null) => void {
    let ref = reactForUiInputs25.useRef<HTMLElement | null>(null);
    return reactForUiInputs25.useCallback(
      (input: HTMLElement | null) => {
        if (setElement === undefined || getElement === undefined) {
          return;
        }
        if (input !== null) {
          ref.current = input;
          setElement(input);
        } else if (getElement() === ref.current) {
          setElement(null);
        }
      },
      [setElement, getElement],
    );
  }
  function ComboboxCaret({ className: className }: ComboboxCaretProps) {
    return jsxForUiInputs24.jsx("span", {
      "aria-hidden": true,
      className: (0, runtime.cn)(
        "pointer-events-none flex size-icon shrink-0 items-center justify-center text-muted",
        className,
      ),
      children: jsxForUiInputs24.jsx(runtime.Icon, {
        name: "CaretDown",
        size: "sm",
      }),
    });
  }
  function ComboboxSeparator({ className: className }: ComboboxSeparatorProps) {
    return jsxForUiInputs24.jsx(runtime.baseCombobox.Separator, {
      className: (0, runtime.cn)(COMBOBOX_SEPARATOR_CLASS, className),
      "data-cds-part": COMBOBOX_SEPARATOR_PART,
    });
  }
  function ComboboxFooter({
    className: className,
    children: children,
  }: ComboboxFooterProps) {
    return jsxForUiInputs24.jsxs(jsxForUiInputs24.Fragment, {
      children: [
        jsxForUiInputs24.jsx("div", {
          "aria-hidden": true,
          className: COMBOBOX_FOOTER_DIVIDER_CLASS,
        }),
        jsxForUiInputs24.jsx("div", {
          className: (0, runtime.cn)(COMBOBOX_FOOTER_CLASS, className),
          children: children,
        }),
      ],
    });
  }
  function comboboxCloseEventDetails(): ComboboxCloseEventDetails {
    let state: ComboboxCloseEventDetails = {
      reason: "close-press",
      event: new Event("base-ui"),
      trigger: undefined,
      isCanceled: false,
      isPropagationAllowed: false,
      cancel() {
        state.isCanceled = true;
      },
      allowPropagation() {
        state.isPropagationAllowed = true;
      },
    };
    return state;
  }
  function ComboboxRoot(input: ComboboxRootProps) {
    let ref = reactForUiInputs25.useRef<ComboboxRegistrationState>({
        inputOutsidePopup: 0,
        trigger: null,
        popupInput: null,
        list: null,
      }),
      [value, value2] = reactForUiInputs25.useState(false),
      memo = reactForUiInputs25.useMemo(
        () => ({
          addOutsideInput: () => {
            ref.current.inputOutsidePopup += 1;
            value2(true);
            return () => {
              ref.current.inputOutsidePopup -= 1;
              value2(ref.current.inputOutsidePopup > 0);
            };
          },
          hasOutsideInput: () => ref.current.inputOutsidePopup > 0,
          setTrigger: (input2: HTMLElement | null) => {
            ref.current.trigger = input2;
          },
          getTrigger: () => ref.current.trigger,
          setPopupInput: (input2: HTMLElement | null) => {
            ref.current.popupInput = input2;
          },
          getPopupInput: () => ref.current.popupInput,
          setList: (input2: HTMLElement | null) => {
            ref.current.list = input2;
          },
          getList: () => ref.current.list,
        }),
        [],
      ),
      value3 = (0, runtime.useSheetCapablePresentation)();
    return jsxForUiInputs24.jsx(ComboboxRegistrationContext.Provider, {
      value: memo,
      children: jsxForUiInputs24.jsx(ComboboxChipsContext.Provider, {
        value: value,
        children: jsxForUiInputs24.jsx(ComboboxPopupInputContext.Provider, {
          value: false,
          children: value3
            ? jsxForUiInputs24.jsx(ComboboxRootRegistration, {
                rootProps: input,
                registration: memo,
              })
            : jsxForUiInputs24.jsx(runtime.baseCombobox.Root, {
                ...input,
              }),
        }),
      }),
    });
  }
  function ComboboxRootRegistration({
    rootProps: rootProps,
    registration: registration,
  }: ComboboxRootRegistrationProps) {
    let value = (0, runtime.useControllableOpen)(rootProps),
      { onOpenChange: onOpenChange } = value,
      callback = reactForUiInputs25.useCallback(() => {
        onOpenChange(false, comboboxCloseEventDetails());
      }, [onOpenChange]),
      value2 = (0, runtime.useValueCapturedOnOpen)(
        value.open,
        registration.hasOutsideInput,
        false,
      ),
      value3 = (0, runtime.useAdaptiveSheet)({
        open: value.open,
        close: callback,
        onOpenChange: value.onOpenChange,
        onOpenChangeComplete: rootProps.onOpenChangeComplete,
        structurallyAnchored: value2,
        closable: !(
          rootProps.open !== undefined && rootProps.onOpenChange === undefined
        ),
      });
    return jsxForUiInputs24.jsx(runtime.SheetContextProvider, {
      value: value3,
      children: jsxForUiInputs24.jsx(runtime.baseCombobox.Root, {
        ...rootProps,
        open: value.open,
        modal: value3.modal ?? rootProps.modal,
        onOpenChange: value3.onOpenChange,
        onOpenChangeComplete: value3.onOpenChangeComplete,
      }),
    });
  }
  function FieldCombobox({
    label: label,
    hint: hint,
    error: error,
    required: required,
    fieldClassName: fieldClassName,
    ...remainingProps
  }: FieldComboboxProps) {
    if (
      (label === undefined || label === null) &&
      (hint === undefined || hint === null) &&
      !error &&
      fieldClassName === undefined &&
      remainingProps.mode !== "input" &&
      remainingProps.triggerMode !== "chips"
    ) {
      return jsxForUiInputs25.jsx(ComboboxComponents, {
        required: required,
        ...remainingProps,
      });
    }
    return jsxForUiInputs25.jsx(runtime.FieldWrapper, {
      label: label,
      hint: hint,
      error: error,
      fieldClassName: fieldClassName,
      children: jsxForUiInputs25.jsx(ComboboxComponents, {
        required: required,
        ...remainingProps,
      }),
    });
  }
  function preserveFieldCheckboxFocus(event: ReactMouseEvent<HTMLElement>): void {
    if (
      (0, runtime.asElement)(event.target)
        ?.closest('label, [role="button"]')
        ?.matches('[role="button"]:not(a[href])')
    ) {
      event.preventDefault();
    }
  }
  bindRuntimeValue(runtime, "isBadgeVariant", () => isBadgeVariant);
  bindRuntimeValue(
    runtime,
    "reactForUiInputs22",
    () => reactForUiInputs22,
    (value) => {
      reactForUiInputs22 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiInputs22",
    () => jsxForUiInputs22,
    (value) => {
      jsxForUiInputs22 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "badgeVariantClasses",
    () => badgeVariantClasses,
    (value) => {
      badgeVariantClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BADGE_VARIANT_CLASSES",
    () => BADGE_VARIANT_CLASSES,
    (value) => {
      BADGE_VARIANT_CLASSES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BADGE_SIZE_CLASSES",
    () => BADGE_SIZE_CLASSES,
    (value) => {
      BADGE_SIZE_CLASSES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BADGE_ICON_CLASSES",
    () => BADGE_ICON_CLASSES,
    (value) => {
      BADGE_ICON_CLASSES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BADGE_ICON_SIZE_CLASSES",
    () => BADGE_ICON_SIZE_CLASSES,
    (value) => {
      BADGE_ICON_SIZE_CLASSES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BADGE_TEXT_CLASS",
    () => BADGE_TEXT_CLASS,
    (value) => {
      BADGE_TEXT_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BADGE_LABEL_CLASSES",
    () => BADGE_LABEL_CLASSES,
    (value) => {
      BADGE_LABEL_CLASSES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "Badge",
    () => Badge,
    (value) => {
      Badge = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiInputs22",
    () => initializeUiInputs22,
    (value) => {
      initializeUiInputs22 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "typographyThemeValues",
    () => typographyThemeValues,
    (value) => {
      typographyThemeValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiInputs222",
    () => initializeUiInputs222,
    (value) => {
      initializeUiInputs222 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "comboboxAccessibilityProps",
    () => comboboxAccessibilityProps,
  );
  bindRuntimeValue(
    runtime,
    "comboboxAccessibilityNoop",
    () => comboboxAccessibilityNoop,
    (value) => {
      comboboxAccessibilityNoop = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "accessibleNameFromElement",
    () => accessibleNameFromElement,
  );
  bindRuntimeValue(
    runtime,
    "useMirroredAccessibleName",
    () => useMirroredAccessibleName,
  );
  bindRuntimeValue(
    runtime,
    "reactForUiInputs222",
    () => reactForUiInputs222,
    (value) => {
      reactForUiInputs222 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiInputs23",
    () => initializeUiInputs23,
    (value) => {
      initializeUiInputs23 = value;
    },
  );
  bindRuntimeValue(runtime, "useDelayedVisible", () => useDelayedVisible);
  bindRuntimeValue(runtime, "DelayedVisible", () => DelayedVisible);
  bindRuntimeValue(
    runtime,
    "reactForUiInputs23",
    () => reactForUiInputs23,
    (value) => {
      reactForUiInputs23 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiInputs222",
    () => jsxForUiInputs222,
    (value) => {
      jsxForUiInputs222 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_STATUS_DELAY_MS",
    () => COMBOBOX_STATUS_DELAY_MS,
    (value) => {
      COMBOBOX_STATUS_DELAY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_STATUS_CLASS",
    () => COMBOBOX_STATUS_CLASS,
    (value) => {
      COMBOBOX_STATUS_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_STATUS_CONTENT_CLASS",
    () => COMBOBOX_STATUS_CONTENT_CLASS,
    (value) => {
      COMBOBOX_STATUS_CONTENT_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxStatus",
    () => ComboboxStatus,
    (value) => {
      ComboboxStatus = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiInputs24",
    () => initializeUiInputs24,
    (value) => {
      initializeUiInputs24 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "VirtualizedComboboxRows",
    () => VirtualizedComboboxRows,
  );
  bindRuntimeValue(
    runtime,
    "reactForUiInputs24",
    () => reactForUiInputs24,
    (value) => {
      reactForUiInputs24 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiInputs23",
    () => jsxForUiInputs23,
    (value) => {
      jsxForUiInputs23 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_VIRTUAL_OVERSCAN",
    () => COMBOBOX_VIRTUAL_OVERSCAN,
    (value) => {
      COMBOBOX_VIRTUAL_OVERSCAN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_SKELETON_ROW_COUNT",
    () => COMBOBOX_SKELETON_ROW_COUNT,
    (value) => {
      COMBOBOX_SKELETON_ROW_COUNT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiInputs25",
    () => initializeUiInputs25,
    (value) => {
      initializeUiInputs25 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "comboboxListHeightStyle",
    () => comboboxListHeightStyle,
  );
  bindRuntimeValue(
    runtime,
    "comboboxItemMatchesQuery",
    () => comboboxItemMatchesQuery,
  );
  bindRuntimeValue(
    runtime,
    "comboboxSelectionLabel",
    () => comboboxSelectionLabel,
  );
  bindRuntimeValue(
    runtime,
    "comboboxGroupMetadata",
    () => comboboxGroupMetadata,
  );
  bindRuntimeValue(runtime, "Combobox", () => Combobox);
  bindRuntimeValue(runtime, "comboboxSheetLabel", () => comboboxSheetLabel);
  bindRuntimeValue(
    runtime,
    "ComboboxPopupResponsive",
    () => ComboboxPopupResponsive,
  );
  bindRuntimeValue(runtime, "ComboboxPopupAsSheet", () => ComboboxPopupAsSheet);
  bindRuntimeValue(runtime, "ComboboxPopupFrame", () => ComboboxPopupFrame);
  bindRuntimeValue(
    runtime,
    "useComboboxOutsideInputRegistration",
    () => useComboboxOutsideInputRegistration,
  );
  bindRuntimeValue(
    runtime,
    "useComboboxTriggerRef",
    () => useComboboxTriggerRef,
  );
  bindRuntimeValue(
    runtime,
    "useComboboxPopupInputRef",
    () => useComboboxPopupInputRef,
  );
  bindRuntimeValue(
    runtime,
    "useComboboxTriggerElement",
    () => useComboboxTriggerElement,
  );
  bindRuntimeValue(
    runtime,
    "useComboboxAccessibleName",
    () => useComboboxAccessibleName,
  );
  bindRuntimeValue(runtime, "useComboboxListRef", () => useComboboxListRef);
  bindRuntimeValue(
    runtime,
    "useComboboxRegistrationRef",
    () => useComboboxRegistrationRef,
  );
  bindRuntimeValue(runtime, "ComboboxCaret", () => ComboboxCaret);
  bindRuntimeValue(runtime, "ComboboxSeparator", () => ComboboxSeparator);
  bindRuntimeValue(runtime, "ComboboxFooter", () => ComboboxFooter);
  bindRuntimeValue(
    runtime,
    "comboboxCloseEventDetails",
    () => comboboxCloseEventDetails,
  );
  bindRuntimeValue(runtime, "ComboboxRoot", () => ComboboxRoot);
  bindRuntimeValue(
    runtime,
    "ComboboxRootRegistration",
    () => ComboboxRootRegistration,
  );
  bindRuntimeValue(
    runtime,
    "reactForUiInputs25",
    () => reactForUiInputs25,
    (value) => {
      reactForUiInputs25 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiInputs24",
    () => jsxForUiInputs24,
    (value) => {
      jsxForUiInputs24 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_TRIGGER_CLASS",
    () => COMBOBOX_TRIGGER_CLASS,
    (value) => {
      COMBOBOX_TRIGGER_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_VARIANT_CLASSES",
    () => COMBOBOX_VARIANT_CLASSES,
    (value) => {
      COMBOBOX_VARIANT_CLASSES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_FOCUS_CLASS",
    () => COMBOBOX_FOCUS_CLASS,
    (value) => {
      COMBOBOX_FOCUS_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_MODE_CLASSES",
    () => COMBOBOX_MODE_CLASSES,
    (value) => {
      COMBOBOX_MODE_CLASSES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_CHIPS_INPUT_CLASS",
    () => COMBOBOX_CHIPS_INPUT_CLASS,
    (value) => {
      COMBOBOX_CHIPS_INPUT_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_TRIGGER_BUTTON_CLASS",
    () => COMBOBOX_TRIGGER_BUTTON_CLASS,
    (value) => {
      COMBOBOX_TRIGGER_BUTTON_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_INLINE_INPUT_CLASS",
    () => COMBOBOX_INLINE_INPUT_CLASS,
    (value) => {
      COMBOBOX_INLINE_INPUT_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_SEARCH_INPUT_CLASS",
    () => COMBOBOX_SEARCH_INPUT_CLASS,
    (value) => {
      COMBOBOX_SEARCH_INPUT_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_CHIP_CLASS",
    () => COMBOBOX_CHIP_CLASS,
    (value) => {
      COMBOBOX_CHIP_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_CHIP_LIST_CLASS",
    () => COMBOBOX_CHIP_LIST_CLASS,
    (value) => {
      COMBOBOX_CHIP_LIST_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_POPUP_CLASS",
    () => COMBOBOX_POPUP_CLASS,
    (value) => {
      COMBOBOX_POPUP_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_POPUP_BODY_CLASS",
    () => COMBOBOX_POPUP_BODY_CLASS,
    (value) => {
      COMBOBOX_POPUP_BODY_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_ANCHOR_HIDDEN_CLASS",
    () => COMBOBOX_ANCHOR_HIDDEN_CLASS,
    (value) => {
      COMBOBOX_ANCHOR_HIDDEN_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_LIST_CLASS",
    () => COMBOBOX_LIST_CLASS,
    (value) => {
      COMBOBOX_LIST_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_POPUP_SEARCH_CLASS",
    () => COMBOBOX_POPUP_SEARCH_CLASS,
    (value) => {
      COMBOBOX_POPUP_SEARCH_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_ITEM_CLASS",
    () => COMBOBOX_ITEM_CLASS,
    (value) => {
      COMBOBOX_ITEM_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_ROW_HEIGHT_CSS",
    () => COMBOBOX_ROW_HEIGHT_CSS,
    (value) => {
      COMBOBOX_ROW_HEIGHT_CSS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_SEPARATOR_CLASS",
    () => COMBOBOX_SEPARATOR_CLASS,
    (value) => {
      COMBOBOX_SEPARATOR_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_SEPARATOR_PART",
    () => COMBOBOX_SEPARATOR_PART,
    (value) => {
      COMBOBOX_SEPARATOR_PART = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_GROUP_LABEL_CLASS",
    () => COMBOBOX_GROUP_LABEL_CLASS,
    (value) => {
      COMBOBOX_GROUP_LABEL_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_SELECTED_SEPARATOR_CLASS",
    () => COMBOBOX_SELECTED_SEPARATOR_CLASS,
    (value) => {
      COMBOBOX_SELECTED_SEPARATOR_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_EMPTY_CLASS",
    () => COMBOBOX_EMPTY_CLASS,
    (value) => {
      COMBOBOX_EMPTY_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_FOOTER_DIVIDER_CLASS",
    () => COMBOBOX_FOOTER_DIVIDER_CLASS,
    (value) => {
      COMBOBOX_FOOTER_DIVIDER_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_FOOTER_CLASS",
    () => COMBOBOX_FOOTER_CLASS,
    (value) => {
      COMBOBOX_FOOTER_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_NO_RESULTS_LABEL",
    () => COMBOBOX_NO_RESULTS_LABEL,
    (value) => {
      COMBOBOX_NO_RESULTS_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_DEFAULT_ROW_HEIGHT",
    () => COMBOBOX_DEFAULT_ROW_HEIGHT,
    (value) => {
      COMBOBOX_DEFAULT_ROW_HEIGHT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_DEFAULT_VISIBLE_ROWS",
    () => COMBOBOX_DEFAULT_VISIBLE_ROWS,
    (value) => {
      COMBOBOX_DEFAULT_VISIBLE_ROWS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_CHIP_LABEL_MAX_LENGTH",
    () => COMBOBOX_CHIP_LABEL_MAX_LENGTH,
    (value) => {
      COMBOBOX_CHIP_LABEL_MAX_LENGTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_DEFAULT_CHIP_COUNT",
    () => COMBOBOX_DEFAULT_CHIP_COUNT,
    (value) => {
      COMBOBOX_DEFAULT_CHIP_COUNT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeComboboxSearchText",
    () => normalizeComboboxSearchText,
    (value) => {
      normalizeComboboxSearchText = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "comboboxItemLabel",
    () => comboboxItemLabel,
    (value) => {
      comboboxItemLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "comboboxItemValue",
    () => comboboxItemValue,
    (value) => {
      comboboxItemValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxChip",
    () => ComboboxChip,
    (value) => {
      ComboboxChip = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_CHIP_REMOVE_CLASS",
    () => COMBOBOX_CHIP_REMOVE_CLASS,
    (value) => {
      COMBOBOX_CHIP_REMOVE_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxChipRemove",
    () => ComboboxChipRemove,
    (value) => {
      ComboboxChipRemove = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxItem",
    () => ComboboxItem,
    (value) => {
      ComboboxItem = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxTrigger",
    () => ComboboxTrigger,
    (value) => {
      ComboboxTrigger = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxValue",
    () => ComboboxValue,
    (value) => {
      ComboboxValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_AUTOCOMPLETE_PROPS",
    () => COMBOBOX_AUTOCOMPLETE_PROPS,
    (value) => {
      COMBOBOX_AUTOCOMPLETE_PROPS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxInput",
    () => ComboboxInput,
    (value) => {
      ComboboxInput = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxPopupSearch",
    () => ComboboxPopupSearch,
    (value) => {
      ComboboxPopupSearch = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxClear",
    () => ComboboxClear,
    (value) => {
      ComboboxClear = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxFooterAction",
    () => ComboboxFooterAction,
    (value) => {
      ComboboxFooterAction = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxPopup",
    () => ComboboxPopup,
    (value) => {
      ComboboxPopup = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxSheetCapablePopup",
    () => ComboboxSheetCapablePopup,
    (value) => {
      ComboboxSheetCapablePopup = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxPopupView",
    () => ComboboxPopupView,
    (value) => {
      ComboboxPopupView = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxList",
    () => ComboboxList,
    (value) => {
      ComboboxList = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxEmpty",
    () => ComboboxEmpty,
    (value) => {
      ComboboxEmpty = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxPrimitiveItem",
    () => ComboboxPrimitiveItem,
    (value) => {
      ComboboxPrimitiveItem = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxItemCheck",
    () => ComboboxItemCheck,
    (value) => {
      ComboboxItemCheck = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxGroupLabel",
    () => ComboboxGroupLabel,
    (value) => {
      ComboboxGroupLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxChips",
    () => ComboboxChips,
    (value) => {
      ComboboxChips = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxRegistrationContext",
    () => ComboboxRegistrationContext,
    (value) => {
      ComboboxRegistrationContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxChipsContext",
    () => ComboboxChipsContext,
    (value) => {
      ComboboxChipsContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxPopupInputContext",
    () => ComboboxPopupInputContext,
    (value) => {
      ComboboxPopupInputContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "nullComboboxElement",
    () => nullComboboxElement,
    (value) => {
      nullComboboxElement = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComponents",
    () => ComboboxComponents,
    (value) => {
      ComboboxComponents = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiInputs26",
    () => initializeUiInputs26,
    (value) => {
      initializeUiInputs26 = value;
    },
  );
  bindRuntimeValue(runtime, "FieldCombobox", () => FieldCombobox);
  bindRuntimeValue(
    runtime,
    "jsxForUiInputs25",
    () => jsxForUiInputs25,
    (value) => {
      jsxForUiInputs25 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiInputs27",
    () => initializeUiInputs27,
    (value) => {
      initializeUiInputs27 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "preserveFieldCheckboxFocus",
    () => preserveFieldCheckboxFocus,
  );
  bindRuntimeValue(
    runtime,
    "reactForUiInputs26",
    () => reactForUiInputs26,
    (value) => {
      reactForUiInputs26 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiInputs26",
    () => jsxForUiInputs26,
    (value) => {
      jsxForUiInputs26 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FieldCheckbox",
    () => FieldCheckbox,
    (value) => {
      FieldCheckbox = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiInputs28",
    () => initializeUiInputs28,
    (value) => {
      initializeUiInputs28 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FieldComponents",
    () => FieldComponents,
    (value) => {
      FieldComponents = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiInputs29",
    () => initializeUiInputs29,
    (value) => {
      initializeUiInputs29 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiInputs210",
    () => initializeUiInputs210,
    (value) => {
      initializeUiInputs210 = value;
    },
  );
  return () => {
    BADGE_TEXT_CLASS =
      "leading-[calc(0.75rem*var(--cds-rem-scale,1))] py-[0.125em] -my-[0.125em]";
    initializeUiInputs22 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeTranslations)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeIcons)();
      (0, runtime.initializeNpmDependency)();
      (0, runtime.initializeNpmDependency)();
      reactForUiInputs22 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiInputs22 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      badgeVariantClasses = {
        neutral: "bg-neutral text-secondary",
        accent: "bg-tint-blue text-accent",
        success: "bg-tint-green text-tint-green",
        warning: "bg-tint-yellow text-warning",
        danger: "bg-tint-red text-danger",
        pro: "bg-tint-violet text-pro",
      };
      BADGE_VARIANT_CLASSES = {
        neutral: "bg-gray-700 dark:bg-gray-550 text-gray-0",
        accent: "bg-blue-500 text-gray-0",
        success: "bg-green-500 text-gray-0",
        warning: "bg-yellow-500 text-gray-0",
        danger: "bg-red-450 text-gray-0",
        pro: "bg-violet-450 text-gray-0",
      };
      BADGE_SIZE_CLASSES = {
        red: "bg-red-450 text-gray-0",
        orange: "bg-orange-450 text-gray-0",
        yellow: "bg-yellow-500 text-gray-0",
        green: "bg-green-500 text-gray-0",
        aqua: "bg-aqua-500 text-gray-0",
        blue: "bg-blue-500 text-gray-0",
        violet: "bg-violet-450 text-gray-0",
        magenta: "bg-magenta-450 text-gray-0",
      };
      BADGE_ICON_CLASSES = {
        red: "bg-tint-red text-tint-red",
        orange: "bg-tint-orange text-tint-orange",
        yellow: "bg-tint-yellow text-tint-yellow",
        green: "bg-tint-green text-tint-green",
        aqua: "bg-tint-aqua text-tint-aqua",
        blue: "bg-tint-blue text-tint-blue",
        violet: "bg-tint-violet text-tint-violet",
        magenta: "bg-tint-magenta text-tint-magenta",
      };
      BADGE_ICON_SIZE_CLASSES = {
        xs: "ml-[calc((var(--cds-h-control-nested)-calc(0.75rem*var(--cds-rem-scale,1)))/2-var(--cds-pad-sm)+1px)] mr-[-0.8px] shrink-0",
        sm: "ml-[calc((var(--cds-h-control-nested)-calc(1rem*var(--cds-rem-scale,1)))/2-var(--cds-pad-sm)+1px)] mr-[-0.8px] shrink-0",
        md: "ml-[calc((var(--cds-h-control-nested)-calc(1.25rem*var(--cds-rem-scale,1)))/2-var(--cds-pad-sm)+1px)] mr-[-0.8px] shrink-0",
      };
      BADGE_LABEL_CLASSES = {
        comfortable: {
          lg: "md",
          base: "sm",
          sm: "sm",
          xs: "xs",
          xxs: "xs",
        },
        compact: {
          lg: "sm",
          base: "xs",
          sm: "xs",
          xs: "xs",
          xxs: "xs",
        },
      };
      Badge = reactForUiInputs22.forwardRef<HTMLSpanElement, BadgeProps>(
        (
          {
            variant: variant,
            icon: icon,
            iconOnly = false,
            onRemove: onRemove,
            removeLabel: removeLabel,
            removeRender: removeRender,
            bold: bold,
            size: size,
            truncate: truncate,
            className: className,
            children: children,
            ...props
          },
          options,
        ) => {
          let value = variant ?? "accent",
            value2 = (0, runtime.useTranslation)(
              "removeItem",
              "Remove {item}",
              {
                item: typeof children === "string" ? children : "item",
              },
            ),
            value3 = (0, runtime.useDensity)(),
            value4 = BADGE_LABEL_CLASSES[value3][size ?? "base"],
            length =
              reactForUiInputs22.Children.toArray(children).length,
            value5 =
              !iconOnly &&
              (length > 0 ||
                onRemove !== undefined ||
                removeRender !== undefined)
                ? BADGE_ICON_SIZE_CLASSES[value4]
                : "shrink-0",
            value6 =
              (size === "xxs"
                ? 1
                : (0, runtime.getDensitySizeIndex)(value3, size)) === 1
                ? BADGE_TEXT_CLASS
                : "pb-[0.05em]",
            value7 = removeLabel || value2,
            value8 = (0, runtime.clsx)(
              "cds-reset relative inline-flex shrink-0 items-center justify-center",
              "before:absolute before:left-[-2px] before:top-1/2 before:-translate-y-1/2 before:content-['']",
              "before:h-[max(24px,100%)] before:w-[max(24px,calc(100%+2px))]",
              "size-[max(calc(var(--cds-h-control-nested)-calc(0.375rem*var(--cds-rem-scale,1))),calc(0.75rem*var(--cds-rem-scale,1)))]",
              "rounded-[calc(var(--cds-h-control-nested)/4-min(calc(0.1875rem*var(--cds-rem-scale,1)),(var(--cds-h-control-nested)-calc(0.75rem*var(--cds-rem-scale,1)))/2))]",
              "-ml-0.5 mr-[calc(min(calc(0.1875rem*var(--cds-rem-scale,1)),(var(--cds-h-control-nested)-calc(0.75rem*var(--cds-rem-scale,1)))/2)-var(--cds-pad-sm))]",
              "text-current outline-none focus-visible:outline-hidden",
              "[--cds-badge-x-wght:577.8] hover:[--cds-badge-x-wght:700]",
              "transition-[color,background-color,box-shadow,--cds-badge-x-wght]",
              bold === true
                ? "hover:bg-[color-mix(in_srgb,currentColor_20%,transparent)]"
                : "hover:bg-[color-mix(in_srgb,currentColor_10%,transparent)]",
              "focus-visible:shadow-focus",
            ),
            { className: value9, ...value10 }: BadgeRemoveRenderProps = Object.fromEntries(
              Object.entries<unknown>(removeRender?.props ?? {}).filter(
                ([, input]) => input !== undefined,
              ),
            ),
            value11 = jsxForUiInputs22.jsx(runtime.Icon, {
              name: "X",
              size: "xs",
              style: {
                fontVariationSettings:
                  "'opsz' 12, 'wght' var(--cds-badge-x-wght, 577.8)",
              },
            }),
            value12 =
              removeRender !== undefined
                ? reactForUiInputs22.cloneElement(
                    removeRender,
                    (0, runtime.baseMergeProps)(
                      {
                        className: (0, runtime.cn)(value8, value9),
                        "aria-label": value7,
                        children: value11,
                      },
                      value10,
                    ),
                  )
                : onRemove !== undefined &&
                  jsxForUiInputs22.jsx("button", {
                    type: "button",
                    "aria-label": value7,
                    onClick: (input: ReactMouseEvent<HTMLButtonElement>) => {
                      input.stopPropagation();
                      onRemove();
                    },
                    onKeyDown: (input: ReactKeyboardEvent<HTMLButtonElement>) => {
                      if (input.key === "Enter" || input.key === " ") {
                        input.stopPropagation();
                      }
                    },
                    onKeyUp: (input: ReactKeyboardEvent<HTMLButtonElement>) => {
                      if (input.key === "Enter" || input.key === " ") {
                        input.stopPropagation();
                      }
                    },
                    className: value8,
                    children: value11,
                  }),
            value13 = isBadgeVariant(value),
            value14 =
              bold === true
                ? value13
                  ? BADGE_VARIANT_CLASSES[value as BadgeVariant]
                  : BADGE_SIZE_CLASSES[value as BadgeColor]
                : value13
                  ? badgeVariantClasses[value as BadgeVariant]
                  : BADGE_ICON_CLASSES[value as BadgeColor];
          return jsxForUiInputs22.jsxs("span", {
            ref: options,
            "data-cds": "Badge",
            role: iconOnly ? "img" : undefined,
            ...(size === "xxs"
              ? {
                  "data-step": "1",
                }
              : (0, runtime.getControlSizeAttributes)(size)),
            ...props,
            className: (0, runtime.cn)(
              "inline-flex items-center gap-1 align-middle h-control-nested whitespace-nowrap rounded-chip",
              iconOnly
                ? "aspect-square w-control-nested justify-center px-0"
                : "px-sm",
              "font-sans text-caption font-medium leading-[round(1.25em,1px)]",
              truncate ? "min-w-0" : "shrink-0",
              value14,
              className,
            ),
            children: [
              typeof icon !== "number" &&
                icon &&
                ((0, runtime.isIconName)(icon)
                  ? jsxForUiInputs22.jsx(runtime.Icon, {
                      name: icon,
                      size: value4,
                      className: value5,
                    })
                  : jsxForUiInputs22.jsx("span", {
                      "aria-hidden": true,
                      className: (0, runtime.cn)("inline-flex", value5),
                      children: icon,
                    })),
              truncate
                ? jsxForUiInputs22.jsx("span", {
                    className: (0, runtime.cn)(
                      value6,
                      "min-w-0 overflow-x-clip text-ellipsis whitespace-nowrap",
                    ),
                    children: children,
                  })
                : length === 1
                  ? jsxForUiInputs22.jsx("span", {
                      className: value6,
                      children: children,
                    })
                  : children,
              value12,
            ],
          });
        },
      );
      Badge.displayName = "Badge";
    });
    initializeUiInputs222 = (0, runtime.initializeOnce)(() => {
      typographyThemeValues = {
        "font-size-body": {
          compact: 0.8125,
          comfortable: 0.875,
          steps: [0.75, 0.8125, 0.875, 0.875, 0.9375],
          textSize: {
            compact: {
              sm: 0.8125,
              md: 0.875,
              lg: 0.9375,
            },
            comfortable: {
              sm: 0.8125,
              md: 0.875,
              lg: 0.9375,
            },
          },
        },
        "font-size-caption": {
          compact: 0.6875,
          comfortable: 0.75,
          steps: [0.625, 0.6875, 0.75, 0.75, 0.8125],
        },
        "font-size-code": {
          compact: 0.75,
          comfortable: 0.8125,
        },
        "font-size-footnote": {
          compact: 0.75,
          comfortable: 0.8125,
        },
        "font-size-heading": {
          compact: 0.875,
          comfortable: 0.9375,
          textSize: {
            compact: {
              sm: 0.8125,
              md: 0.875,
              lg: 0.9375,
            },
            comfortable: {
              sm: 0.875,
              md: 0.9375,
              lg: 1,
            },
          },
        },
        "font-size-prose": {
          compact: 0.875,
          comfortable: 1,
          steps: [0.8125, 0.875, 0.9375, 1, 1.125],
          textSize: "shift",
        },
        "font-size-title": {
          compact: 1.25,
          comfortable: 1.375,
        },
        "leading-body": {
          compact: 1.1875,
          comfortable: 1.25,
          steps: [1.0625, 1.1875, 1.25, 1.25, 1.375],
          textSize: {
            compact: {
              sm: 1.1875,
              md: 1.25,
              lg: 1.375,
            },
            comfortable: {
              sm: 1.1875,
              md: 1.25,
              lg: 1.375,
            },
          },
        },
        "leading-caption": {
          compact: 1.0625,
          comfortable: 1.0625,
        },
        "leading-code": {
          compact: 1.0625,
          comfortable: 1.1875,
        },
        "leading-footnote": {
          compact: 0.9375,
          comfortable: 1.0625,
        },
        "leading-heading": {
          compact: 1.125,
          comfortable: 1.25,
          textSize: {
            compact: {
              sm: 1.125,
              md: 1.125,
              lg: 1.375,
            },
            comfortable: {
              sm: 1.25,
              md: 1.25,
              lg: 1.5,
            },
          },
        },
        "leading-prose": {
          compact: 1.25,
          comfortable: 1.5,
          steps: [1.1875, 1.25, 1.375, 1.5, 1.6875],
          textSize: "shift",
        },
        "leading-title": {
          compact: 1.5625,
          comfortable: 1.75,
        },
      };
    });
    comboboxAccessibilityNoop = () => {};
    initializeUiInputs23 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeMergedRefs)();
      (0, runtime.initializeVisualKeyboard)();
      reactForUiInputs222 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
    });
    COMBOBOX_STATUS_DELAY_MS = 500;
    COMBOBOX_STATUS_CLASS = "px-md py-1.5 text-body text-muted select-none";
    initializeUiInputs24 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeTranslations)();
      (0, runtime.initializeUiDisclosure5)();
      (0, runtime.initializeNpmDependency)();
      reactForUiInputs23 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiInputs222 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      COMBOBOX_STATUS_CONTENT_CLASS = `flex items-center gap-2 ${COMBOBOX_STATUS_CLASS}`;
      ComboboxStatus = reactForUiInputs23.forwardRef<HTMLDivElement, ComboboxStatusProps>(
        (
          {
            loading = false,
            delay = COMBOBOX_STATUS_DELAY_MS,
            loadingLabel: loadingLabel,
            ...props
          },
          options,
        ) => {
          let value = (0, runtime.useTranslation)(
            "loadingOptions",
            "Loading options",
          );
          return jsxForUiInputs222.jsx(runtime.baseCombobox.Status, {
            ref: options,
            ...props,
            children:
              loading &&
              jsxForUiInputs222.jsx(DelayedVisible, {
                ms: delay,
                children: jsxForUiInputs222.jsxs("div", {
                  className: COMBOBOX_STATUS_CONTENT_CLASS,
                  children: [
                    jsxForUiInputs222.jsx(runtime.Spinner, {
                      size: "sm",
                    }),
                    jsxForUiInputs222.jsx("span", {
                      children: loadingLabel ?? value,
                    }),
                  ],
                }),
              }),
          });
        },
      );
      ComboboxStatus.displayName = "Combobox.Status";
    });
    COMBOBOX_VIRTUAL_OVERSCAN = 5;
    COMBOBOX_SKELETON_ROW_COUNT = 4;
    initializeUiInputs25 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeIsomorphicLayoutEffect)();
      (0, runtime.initializeUiDisclosure10)();
      (0, runtime.initializeNpmDependency)();
      reactForUiInputs24 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiInputs23 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
    });
    COMBOBOX_TRIGGER_CLASS =
      "cds-reset group/cbx inline-flex items-center gap-1.5 h-control rounded font-sans text-body font-normal text-primary outline-none focus-visible:outline-hidden transition duration-fast data-[disabled]:opacity-disabled data-[disabled]:pointer-events-none";
    COMBOBOX_FOCUS_CLASS =
      "has-[:focus-visible]:shadow-focus data-[invalid]:has-[:focus-visible]:shadow-focus-danger";
    COMBOBOX_TRIGGER_BUTTON_CLASS =
      "cds-reset flex min-w-0 flex-1 items-center gap-1.5 self-stretch pl-sm text-left border-0 bg-transparent p-0 outline-none focus-visible:outline-hidden";
    COMBOBOX_INLINE_INPUT_CLASS =
      "cds-reset min-w-0 flex-1 self-stretch bg-transparent border-0 outline-none focus-visible:outline-hidden p-0 text-body font-normal text-primary placeholder:text-muted";
    COMBOBOX_SEARCH_INPUT_CLASS =
      "cds-reset min-w-0 flex-1 bg-transparent border-0 outline-none focus-visible:outline-hidden p-0 text-body font-normal text-primary placeholder:text-muted";
    COMBOBOX_CHIP_CLASS =
      "relative max-w-full shrink-0 outline-none focus-visible:outline-hidden focus-visible:[box-shadow:inset_0_0_0_1px_var(--cds-fill-accent)]";
    COMBOBOX_CHIP_LIST_CLASS =
      "flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-hidden [&>*]:relative [mask-image:linear-gradient(to_right,#000_calc(100%-24px),transparent)]";
    COMBOBOX_POPUP_BODY_CLASS =
      "flex min-h-0 flex-1 flex-col overflow-hidden rounded-[inherit] p-1";
    COMBOBOX_ANCHOR_HIDDEN_CLASS = "data-[anchor-hidden]:invisible";
    COMBOBOX_LIST_CLASS =
      "cds-reset min-h-0 flex-1 overflow-y-auto overflow-x-hidden scroll-fade-y outline-none focus-visible:outline-hidden max-h-[var(--cds-popup-list-max-h,none)]";
    COMBOBOX_POPUP_SEARCH_CLASS =
      "-mx-1 -mt-1 mb-1 block w-[calc(100%+8px)] shrink-0 cds-reset bg-transparent border-0 border-b border-b-[var(--cds-border)] outline-none focus-visible:outline-hidden px-[calc(var(--cds-pad-md)+4px)] py-2 text-body font-normal text-primary placeholder:text-muted";
    COMBOBOX_ITEM_CLASS =
      "cds-reset group/cbx-item flex w-full items-center gap-2 min-h-control px-md py-1 rounded text-body font-normal text-primary select-none outline-none focus-visible:outline-hidden data-[highlighted]:bg-fill-ghost-hover data-[disabled]:opacity-disabled data-[disabled]:pointer-events-none transition-opacity duration-fast data-[disabled]:transition-none data-[stale]:not-data-[disabled]:opacity-50 data-[stale]:delay-[var(--cds-combobox-stale-after,500ms)] starting:data-[stale]:not-data-[disabled]:opacity-100";
    COMBOBOX_ROW_HEIGHT_CSS =
      "max(var(--cds-h-control), var(--cds-leading-body) + 0.5rem)";
    COMBOBOX_SEPARATOR_CLASS = "mx-pad-md my-1 h-px bg-border";
    COMBOBOX_SEPARATOR_PART = "separator";
    COMBOBOX_GROUP_LABEL_CLASS =
      "px-md pt-2 pb-1 text-footnote font-medium text-muted select-none";
    COMBOBOX_SELECTED_SEPARATOR_CLASS =
      "[&>[data-selected]+[role=option]:not([data-selected])]:relative [&>[data-selected]+[role=option]:not([data-selected])]:mt-2 [&>[data-selected]+[role=option]:not([data-selected])]:before:absolute [&>[data-selected]+[role=option]:not([data-selected])]:before:-top-1 [&>[data-selected]+[role=option]:not([data-selected])]:before:inset-x-0 [&>[data-selected]+[role=option]:not([data-selected])]:before:border-t";
    COMBOBOX_FOOTER_DIVIDER_CLASS = "mx-pad-md mt-1 h-px shrink-0 bg-border";
    COMBOBOX_FOOTER_CLASS = "shrink-0 pt-1";
    COMBOBOX_NO_RESULTS_LABEL = "No results";
    COMBOBOX_DEFAULT_ROW_HEIGHT = 32;
    COMBOBOX_DEFAULT_VISIBLE_ROWS = 9;
    COMBOBOX_CHIP_LABEL_MAX_LENGTH = 28;
    COMBOBOX_DEFAULT_CHIP_COUNT = 3;
    normalizeComboboxSearchText = (input: string) =>
      input
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase();
    comboboxItemLabel = (input: ComboboxOption) => input.label;
    comboboxItemValue = (input: ComboboxOption) => input.value;
    COMBOBOX_CHIP_REMOVE_CLASS =
      "cds-reset inline-flex size-[calc(var(--cds-h-control-nested)-4px)] shrink-0 items-center justify-center rounded-[calc(var(--cds-h-control-nested)/4-2px)] border-0 bg-transparent p-0 text-muted outline-none focus-visible:outline-hidden transition-colors hover:bg-neutral-hover hover:text-primary focus-visible:bg-neutral-hover focus-visible:text-primary";
    nullComboboxElement = () => null;
    initializeUiInputs26 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeIsomorphicLayoutEffect)();
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeTranslations)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeLayers)();
      (0, runtime.initializeClickToFocus)();
      (0, runtime.initializeCloseOnActivityHide)();
      (0, runtime.initializeMergedRefs)();
      (0, runtime.initializePortalRoot)();
      (0, runtime.initializeRemScale)();
      (0, runtime.initializeIcons)();
      (0, runtime.initializeUiDisclosure9)();
      (0, runtime.initializeUiDisclosure12)();
      (0, runtime.initializeSurfaces)();
      (0, runtime.initializeSheetStyles)();
      (0, runtime.initializePresentationMode)();
      (0, runtime.initializeAdaptiveSheets)();
      (0, runtime.initializeSheetClassNames)();
      (0, runtime.initializeUiMenu3)();
      (0, runtime.initializeUiMenu10)();
      (0, runtime.initializeUiMenu5)();
      (0, runtime.initializeUiMenu)();
      initializeUiInputs22();
      initializeUiInputs222();
      comboboxAccessibilityNoop();
      initializeUiInputs23();
      initializeUiInputs24();
      initializeUiInputs25();
      (0, runtime.initializeNpmDependency)();
      reactForUiInputs25 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiInputs24 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      COMBOBOX_VARIANT_CLASSES = {
        outline: `${runtime.TEXT_INPUT_SURFACE_CLASS} ${runtime.TEXT_INPUT_HOVER_CLASS}`,
        ghost:
          "bg-transparent hover:bg-fill-ghost-hover has-[[aria-haspopup][aria-expanded=true]]:bg-fill-ghost-hover aria-expanded:bg-fill-ghost-hover",
      };
      COMBOBOX_MODE_CLASSES = {
        select: `pl-0 ${COMBOBOX_FOCUS_CLASS} data-[disabled]:cursor-default`,
        input: `pl-sm cursor-text ${COMBOBOX_FOCUS_CLASS} data-[disabled]:cursor-default`,
      };
      COMBOBOX_CHIPS_INPUT_CLASS = `cds-reset group/cbx flex min-w-0 items-center gap-1.5 h-control pr-sm rounded font-sans text-body font-normal text-primary ${runtime.TEXT_INPUT_SURFACE_CLASS} ${runtime.TEXT_INPUT_HOVER_CLASS} cursor-text transition duration-fast ${COMBOBOX_FOCUS_CLASS} data-[disabled]:opacity-disabled data-[disabled]:pointer-events-none`;
      COMBOBOX_POPUP_CLASS = `draggable-none flex flex-col max-h-[min(var(--available-height,100dvh),var(--cds-popup-max-h,320px))] ${(0, runtime.getSurfaceClasses)("popover")} cds-reset text-body font-normal text-primary outline-none focus-visible:outline-hidden`;
      COMBOBOX_EMPTY_CLASS = `empty:hidden ${COMBOBOX_STATUS_CLASS}`;
      ComboboxChip = reactForUiInputs25.forwardRef<HTMLDivElement, ComboboxChipProps>(
        (
          {
            removable = true,
            className: className,
            render: render,
            children: children,
            ...props
          },
          options,
        ) => {
          let value = options;
          return jsxForUiInputs24.jsx(runtime.baseCombobox.Chip, {
            ref: value,
            ...props,
            className: (0, runtime.cn)(COMBOBOX_CHIP_CLASS, className),
            render:
              render ??
              jsxForUiInputs24.jsx(Badge, {
                variant: "neutral",
                truncate: true,
                removeRender: removable
                  ? jsxForUiInputs24.jsx(runtime.baseCombobox.ChipRemove, {})
                  : undefined,
                children: children,
              }),
            children: children,
          });
        },
      );
      ComboboxChip.displayName = "Combobox.Chip";
      ComboboxChipRemove = reactForUiInputs25.forwardRef<HTMLButtonElement, ComboboxChipRemoveProps>(
        (
          { className: className, children: children, ...props },
          options,
        ) => {
          let value = (0, runtime.useTranslation)(
            "removeItem",
            "Remove {item}",
            {
              item: "item",
            },
          );
          return jsxForUiInputs24.jsx(runtime.baseCombobox.ChipRemove, {
            ref: options,
            "aria-label": value,
            ...props,
            className: (0, runtime.cn)(COMBOBOX_CHIP_REMOVE_CLASS, className),
            children:
              children ??
              jsxForUiInputs24.jsx(runtime.Icon, {
                name: "X",
                size: "sm",
              }),
          });
        },
      );
      ComboboxChipRemove.displayName = "Combobox.ChipRemove";
      (Combobox as DisplayNamedComponent).displayName = "Combobox";
      ComboboxItem = reactForUiInputs25.memo(
        ({
          item: item,
          index: index,
          selected: selected,
          stale: stale,
          renderItem: renderItem,
          searchQuery: searchQuery,
          indicator: indicator,
          leadsList = false,
          separatorAbove = false,
          groupCaption: groupCaption,
          announcedGroupLabel: announcedGroupLabel,
          wrapDescription = true,
        }: ComboboxItemRowProps) => {
          let value = indicator === "checkbox",
            value2 =
              announcedGroupLabel !== undefined
                ? jsxForUiInputs24.jsx("span", {
                    className: "sr-only",
                    children: `, ${announcedGroupLabel}`,
                  })
                : null;
          return jsxForUiInputs24.jsxs(jsxForUiInputs24.Fragment, {
            children: [
              !leadsList &&
                (item.separatorBefore || separatorAbove) &&
                jsxForUiInputs24.jsx(runtime.baseCombobox.Separator, {
                  className: COMBOBOX_SEPARATOR_CLASS,
                  "data-cds-part": COMBOBOX_SEPARATOR_PART,
                }),
              groupCaption !== undefined &&
                jsxForUiInputs24.jsx("div", {
                  "aria-hidden": true,
                  className: COMBOBOX_GROUP_LABEL_CLASS,
                  children: groupCaption,
                }),
              jsxForUiInputs24.jsxs(runtime.baseCombobox.Item, {
                value: item,
                index: index,
                disabled: item.disabled,
                "data-stale": stale || undefined,
                className: COMBOBOX_ITEM_CLASS,
                title: renderItem ? undefined : item.label,
                children: [
                  value &&
                    jsxForUiInputs24.jsx("span", {
                      "data-size": "xs",
                      className:
                        "flex shrink-0 -ml-[calc(var(--cds-pad-md)-(var(--cds-h-control)-var(--cds-checkbox))/2)]",
                      children: jsxForUiInputs24.jsx(runtime.CheckboxVisual, {
                        checked: selected,
                      }),
                    }),
                  item.icon !== undefined &&
                    jsxForUiInputs24.jsx(runtime.IconSlot, {
                      icon: item.icon,
                    }),
                  renderItem
                    ? jsxForUiInputs24.jsxs("div", {
                        className: "min-w-0 flex-1",
                        children: [renderItem(item, searchQuery), value2],
                      })
                    : jsxForUiInputs24.jsxs("div", {
                        className: "flex min-w-0 flex-1 flex-col gap-0.5",
                        children: [
                          jsxForUiInputs24.jsxs("span", {
                            className: "truncate",
                            children: [item.label, value2],
                          }),
                          item.description !== undefined &&
                            jsxForUiInputs24.jsx("span", {
                              className: `text-footnote leading-snug text-muted ${wrapDescription ? "whitespace-normal break-words" : "truncate"}`,
                              children: item.description,
                            }),
                        ],
                      }),
                  indicator === "check" &&
                    jsxForUiInputs24.jsx(runtime.baseCombobox.ItemIndicator, {
                      className: "shrink-0 text-accent",
                      children: jsxForUiInputs24.jsx(runtime.Icon, {
                        name: "Check",
                        size: "auto",
                        bold: true,
                      }),
                    }),
                ],
              }),
            ],
          });
        },
      );
      ComboboxItem.displayName = "ComboboxItem";
      ComboboxTrigger = reactForUiInputs25.forwardRef<HTMLButtonElement, ComboboxTriggerProps>(
        (
          {
            variant = "outline",
            size: size,
            className: className,
            children: children,
            ...props
          },
          options,
        ) => {
          let value = reactForUiInputs25.useId(),
            value2 = (0, runtime.useHasFieldContext)(),
            value3 =
              props["aria-label"] !== undefined ||
              props["aria-labelledby"] !== undefined ||
              props.id !== undefined ||
              props.render !== undefined ||
              value2,
            value4 = useComboboxTriggerRef(options);
          return jsxForUiInputs24.jsx(runtime.baseCombobox.Trigger, {
            ref: value4,
            ...(value3
              ? {}
              : {
                  "aria-labelledby": value,
                }),
            "data-cds": "Combobox",
            ...props,
            ...(0, runtime.getControlSizeAttributes)(size),
            className: (0, runtime.cn)(
              COMBOBOX_TRIGGER_CLASS,
              COMBOBOX_VARIANT_CLASSES[variant],
              "px-sm focus-visible:shadow-focus data-[invalid]:focus-visible:shadow-focus-danger",
              className,
            ),
            children: value3
              ? children
              : jsxForUiInputs24.jsx("span", {
                  id: value,
                  className: "contents",
                  children: children,
                }),
          });
        },
      );
      ComboboxTrigger.displayName = "Combobox.Trigger";
      ComboboxValue = reactForUiInputs25.forwardRef<HTMLSpanElement, ComboboxValueProps>(
        (
          {
            className: className,
            placeholder: placeholder,
            children: children,
          },
          options,
        ) =>
          jsxForUiInputs24.jsx("span", {
            ref: options,
            className: (0, runtime.cn)(
              "min-w-0 flex-1 truncate text-left",
              className,
            ),
            children:
              children !== undefined
                ? jsxForUiInputs24.jsx(runtime.baseCombobox.Value, {
                    children: children,
                  })
                : placeholder !== undefined
                  ? jsxForUiInputs24.jsx(runtime.baseCombobox.Value, {
                      children: (input: ReactNode) =>
                        input === null || input === undefined || input === ""
                          ? jsxForUiInputs24.jsx("span", {
                              className: "text-muted",
                              children: placeholder,
                            })
                          : input,
                    })
                  : jsxForUiInputs24.jsx(runtime.baseCombobox.Value, {}),
          }),
      );
      ComboboxValue.displayName = "Combobox.Value";
      COMBOBOX_AUTOCOMPLETE_PROPS = {
        autoComplete: "off",
        "data-1p-ignore": true,
        "data-lpignore": "true",
      };
      ComboboxInput = reactForUiInputs25.forwardRef<HTMLInputElement, ComboboxInputProps>(
        (
          {
            className: className,
            "aria-label": ariaLabel,
            "aria-labelledby": ariaLabelledby,
            ...props
          },
          options,
        ) => {
          useComboboxOutsideInputRegistration();
          let { ref: value, nameProps: value2 } =
            useComboboxAccessibleName(
              useComboboxPopupInputRef(useComboboxTriggerRef(options)),
              ariaLabel,
              ariaLabelledby,
            );
          return jsxForUiInputs24.jsx(runtime.baseCombobox.Input, {
            ref: value,
            ...COMBOBOX_AUTOCOMPLETE_PROPS,
            ...value2,
            ...props,
            className: (0, runtime.cn)(COMBOBOX_INLINE_INPUT_CLASS, className),
          });
        },
      );
      ComboboxInput.displayName = "Combobox.Input";
      ComboboxPopupSearch = reactForUiInputs25.forwardRef<HTMLInputElement, ComboboxInputProps>(
        (
          {
            className: className,
            "aria-label": ariaLabel,
            "aria-labelledby": ariaLabelledby,
            ...props
          },
          options,
        ) => {
          let { ref: value, nameProps: value2 } =
            useComboboxAccessibleName(
              useComboboxPopupInputRef(options),
              ariaLabel,
              ariaLabelledby,
            );
          return jsxForUiInputs24.jsx(runtime.baseCombobox.Input, {
            ref: value,
            ...COMBOBOX_AUTOCOMPLETE_PROPS,
            ...value2,
            ...props,
            className: (0, runtime.cn)(COMBOBOX_POPUP_SEARCH_CLASS, className),
          });
        },
      );
      ComboboxPopupSearch.displayName = "Combobox.PopupSearch";
      ComboboxClear = reactForUiInputs25.forwardRef<HTMLButtonElement, ComboboxClearProps>(
        (
          {
            className: className,
            children: children,
            "aria-label": ariaLabel,
            ...props
          },
          options,
        ) => {
          let value = (0, runtime.useTranslation)(
            "clearSelection",
            "Clear selection",
          );
          return jsxForUiInputs24.jsx(runtime.baseCombobox.Clear, {
            ref: options,
            ...props,
            render: jsxForUiInputs24.jsx(runtime.Button, {
              iconOnly: true,
              variant: "ghost",
              size: "sm",
              icon: children || "X",
              "aria-label": ariaLabel ?? value,
              tooltip: false,
              className: (0, runtime.cn)(
                "data-[ending-style]:hidden",
                className,
              ),
            }),
          });
        },
      );
      ComboboxClear.displayName = "Combobox.Clear";
      (ComboboxCaret as DisplayNamedComponent).displayName = "Combobox.Caret";
      ComboboxFooterAction = reactForUiInputs25.forwardRef<HTMLButtonElement, ComboboxFooterActionProps>(
        (
          {
            icon: icon,
            children: children,
            className: className,
            ...props
          },
          options,
        ) =>
          jsxForUiInputs24.jsxs("button", {
            ref: options,
            type: "button",
            ...props,
            className: (0, runtime.cn)(
              "cds-reset flex w-full items-center gap-2 min-h-control px-md rounded",
              "text-body font-normal text-primary select-none outline-none focus-visible:outline-hidden",
              "hover:bg-fill-ghost-hover focus-visible:bg-fill-ghost-hover",
              className,
            ),
            children: [
              icon &&
                jsxForUiInputs24.jsx(runtime.IconSlot, {
                  icon: jsxForUiInputs24.jsx(runtime.Icon, {
                    name: icon,
                    size: "auto",
                    className: "text-muted",
                  }),
                }),
              children,
            ],
          }),
      );
      ComboboxFooterAction.displayName = "Combobox.FooterAction";
      ComboboxPopup = reactForUiInputs25.forwardRef<HTMLDivElement, ComboboxPopupProps>(
        (
          {
            side = "bottom",
            align = "start",
            sideOffset = 6,
            "data-cds": dataCds = "Combobox",
            ...props
          },
          options,
        ) => {
          let state = {
            side: side,
            align: align,
            sideOffset: sideOffset,
            "data-cds": dataCds,
            ...props,
          };
          if ((0, runtime.useHasSheetFrame)()) {
            return jsxForUiInputs24.jsx(ComboboxSheetCapablePopup, {
              ...state,
              ref: options,
            });
          } else {
            return jsxForUiInputs24.jsx(ComboboxPopupView, {
              ...state,
              ref: options,
              sheetPopup: runtime.defaultSheetHost,
              sheetParts: null,
            });
          }
        },
      );
      ComboboxPopup.displayName = "Combobox.Popup";
      ComboboxSheetCapablePopup = reactForUiInputs25.forwardRef<HTMLDivElement, ComboboxPopupProps>(
        (input, options) =>
          jsxForUiInputs24.jsx(runtime.AdaptiveSheetPopupHost, {
            kind: "combobox",
            children: (input2: ComboboxSheetHost, options2: ComboboxSheetParts | null) =>
              jsxForUiInputs24.jsx(ComboboxPopupView, {
                ...input,
                ref: options,
                sheetPopup: input2,
                sheetParts: options2,
              }),
          }),
      );
      ComboboxSheetCapablePopup.displayName = "ComboboxSheetCapablePopup";
      ComboboxPopupView = reactForUiInputs25.forwardRef<HTMLDivElement, ComboboxPopupViewProps>(function (
        { sheetPopup: sheetPopup, sheetParts: sheetParts, ...props },
        options,
      ): ReactElement {
        let {
            side: value14 = "bottom",
            align: value15 = "start",
            sideOffset: value16 = 6,
            collisionPadding: value,
            collisionAvoidance: value2,
            initialFocus: value3,
            positionerClassName: value4,
            layerOffset: value5,
            maxVisibleItems: value6,
            closeLabel: value7,
            className: value8,
            style: value9,
            children: value10,
            "data-cds": value17 = "Combobox",
            "aria-label": value11,
            "aria-labelledby": value12,
            ...value13
          } = props,
          value18 = (0, runtime.useOverlayLayer)("combobox", value5),
          sheet = sheetPopup.sheet,
          value19 = sheetPopup.sheet ? sheetPopup.chrome : null,
          value20 =
            sheetPopup.sheet && sheetParts !== null ? sheetParts : null,
          ref = reactForUiInputs25.useRef(null),
          value21 = reactForUiInputs25.useContext(
            ComboboxRegistrationContext,
          ),
          value22 =
            reactForUiInputs25.useContext(ComboboxChipsContext),
          { ref: value23, nameProps: value24 } =
            useMirroredAccessibleName(options, useComboboxTriggerElement(), {
              ...(value11 !== undefined && {
                "aria-label": value11,
              }),
              ...(value12 !== undefined && {
                "aria-labelledby": value12,
              }),
            }),
          value25 = (0, runtime.useMergedRefs)(
            value23,
            ref,
            sheetPopup.ref,
          ),
          callback = reactForUiInputs25.useCallback(
            (input: string) =>
              comboboxSheetLabel(
                input,
                ref.current,
                value21?.getPopupInput() ?? null,
                value21?.getList() ?? null,
              ),
            [value21],
          ),
          value26 = sheet
            ? callback
            : value3 !== undefined
              ? value3
              : value21 === null || value22
                ? false
                : callback,
          value27 = sheet
            ? undefined
            : comboboxListHeightStyle(value6),
          value28 = value27 ?? {},
          value29 = sheetPopup.style ?? {},
          value30 =
            value27 === undefined && sheetPopup.style === undefined
              ? value9
              : typeof value9 === "function"
                ? (input: BaseCombobox.Popup.State) => ({
                    ...value28,
                    ...value9(input),
                    ...value29,
                  })
                : {
                    ...value28,
                    ...value9,
                    ...value29,
                  };
        return jsxForUiInputs24.jsx(runtime.baseCombobox.Portal, {
          container: (0, runtime.usePortalContainer)(),
          children: jsxForUiInputs24.jsxs(runtime.PortalRoot, {
            ...value18.portalProps,
            style: sheetPopup.concealed
              ? {
                  ...value18.portalProps.style,
                  ...runtime.concealedPopupStyle,
                }
              : value18.portalProps.style,
            surface: runtime.elevationSurfaceNames.popover,
            density: sheet ? runtime.SHEET_DENSITY : undefined,
            children: [
              value20 !== null &&
                sheetPopup.sheet &&
                jsxForUiInputs24.jsx(value20.ComboboxSheetBackdrop, {
                  sheetPopup: sheetPopup,
                }),
              jsxForUiInputs24.jsx(runtime.layerBaseContext.Provider, {
                value: value18.base,
                children: jsxForUiInputs24.jsx(
                  runtime.baseCombobox.Positioner,
                  {
                    style:
                      sheetPopup.positionerStyle !== undefined
                        ? {
                            ...value18.style,
                            ...sheetPopup.positionerStyle,
                          }
                        : value18.style,
                    side: value14,
                    align: value15,
                    sideOffset: value16,
                    collisionPadding: value,
                    collisionAvoidance: value2,
                    positionMethod: "fixed",
                    ...(sheet ? runtime.sheetPositioningOverrides : {}),
                    className: (0, runtime.cn)(
                      value4 ?? "w-[var(--anchor-width)] min-w-[12rem]",
                      !sheet && COMBOBOX_ANCHOR_HIDDEN_CLASS,
                      sheet &&
                        sheetPopup.state.depth === 0 &&
                        "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-[100dvh] after:bg-surface-3",
                    ),
                    children: jsxForUiInputs24.jsx(runtime.baseCombobox.Popup, {
                      "data-cds": value17,
                      ref: value25,
                      initialFocus: value26,
                      ...value24,
                      ...sheetPopup.attrs,
                      ...value13,
                      style: value30,
                      className: (0, runtime.cn)(
                        COMBOBOX_POPUP_CLASS,
                        sheet && runtime.sheetPopupClasses,
                        sheet &&
                          "data-[starting-style]:translate-y-[calc(100%+1.5rem)] data-[ending-style]:translate-y-[calc(100%+1.5rem)]",
                        sheet &&
                          "origin-top [&[data-cds-sheet-covered]:not([data-starting-style]):not([data-ending-style])]:-translate-y-3 data-[cds-sheet-covered]:scale-[0.94] after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-backdrop after:opacity-0 after:transition-opacity after:duration-sheet motion-reduce:after:transition-none data-[cds-sheet-covered]:after:opacity-100",
                        value8,
                      ),
                      children: jsxForUiInputs24.jsx(
                        ComboboxPopupInputContext.Provider,
                        {
                          value: true,
                          children:
                            value19 !== null
                              ? jsxForUiInputs24.jsxs(
                                  runtime.sheetParentContext.Provider,
                                  {
                                    value: sheetPopup.stack,
                                    children: [
                                      jsxForUiInputs24.jsx(value19.Handle, {}),
                                      jsxForUiInputs24.jsx(value19.Body, {
                                        children: jsxForUiInputs24.jsxs("div", {
                                          className: COMBOBOX_POPUP_BODY_CLASS,
                                          children: [
                                            value10,
                                            jsxForUiInputs24.jsx(
                                              value19.DismissButton,
                                              {
                                                onDismiss:
                                                  sheetPopup.frame?.dismiss,
                                                label: value7,
                                              },
                                            ),
                                          ],
                                        }),
                                      }),
                                    ],
                                  },
                                )
                              : jsxForUiInputs24.jsx("div", {
                                  className: COMBOBOX_POPUP_BODY_CLASS,
                                  children: value10,
                                }),
                        },
                      ),
                    }),
                  },
                ),
              }),
            ],
          }),
        });
      });
      ComboboxPopupView.displayName = "ComboboxPopupView";
      ComboboxList = reactForUiInputs25.forwardRef<HTMLDivElement, ComboboxListProps>(
        (
          {
            className: className,
            "aria-label": ariaLabel,
            "aria-labelledby": ariaLabelledby,
            ...props
          },
          options,
        ) => {
          let { ref: value, nameProps: value2 } =
            useMirroredAccessibleName(
              useComboboxListRef(options),
              useComboboxTriggerElement(),
              {
                ...(ariaLabel !== undefined && {
                  "aria-label": ariaLabel,
                }),
                ...(ariaLabelledby !== undefined && {
                  "aria-labelledby": ariaLabelledby,
                }),
              },
            );
          return jsxForUiInputs24.jsx(runtime.baseCombobox.List, {
            ref: value,
            ...value2,
            ...props,
            className: (0, runtime.cn)(COMBOBOX_LIST_CLASS, className),
            [runtime.SHEET_SCROLL_ATTRIBUTE]: "",
          });
        },
      );
      ComboboxList.displayName = "Combobox.List";
      ComboboxEmpty = reactForUiInputs25.forwardRef<HTMLDivElement, ComboboxEmptyProps>(
        (
          { className: className, children: children, ...props },
          options,
        ) => {
          let value = (0, runtime.useTranslation)(
            "noResults",
            COMBOBOX_NO_RESULTS_LABEL,
          );
          return jsxForUiInputs24.jsx(runtime.baseCombobox.Empty, {
            ref: options,
            ...props,
            className: (0, runtime.cn)(COMBOBOX_EMPTY_CLASS, className),
            children: children === undefined ? value : children,
          });
        },
      );
      ComboboxEmpty.displayName = "Combobox.Empty";
      ComboboxPrimitiveItem = reactForUiInputs25.forwardRef<HTMLDivElement, ComboboxPrimitiveItemProps>(
        (
          {
            description: description,
            icon: icon,
            stale = false,
            className: className,
            children: children,
            ...props
          },
          options,
        ) =>
          jsxForUiInputs24.jsxs(runtime.baseCombobox.Item, {
            ref: options,
            "data-stale": stale || undefined,
            ...props,
            className: (0, runtime.cn)(COMBOBOX_ITEM_CLASS, className),
            children: [
              icon !== undefined &&
                jsxForUiInputs24.jsx(runtime.IconSlot, {
                  icon: icon,
                }),
              jsxForUiInputs24.jsxs("div", {
                className: "flex min-w-0 flex-1 flex-col gap-0.5",
                children: [
                  jsxForUiInputs24.jsx("span", {
                    className: "truncate",
                    children: children,
                  }),
                  description !== undefined &&
                    jsxForUiInputs24.jsx("span", {
                      className:
                        "whitespace-normal break-words text-footnote leading-snug text-muted",
                      children: description,
                    }),
                ],
              }),
              jsxForUiInputs24.jsx(ComboboxItemCheck, {}),
            ],
          }),
      );
      ComboboxPrimitiveItem.displayName = "Combobox.Item";
      ComboboxItemCheck = reactForUiInputs25.forwardRef<HTMLSpanElement, ComboboxItemCheckProps>(
        (
          { className: className, children: children, ...props },
          options,
        ) =>
          jsxForUiInputs24.jsx(runtime.baseCombobox.ItemIndicator, {
            ref: options,
            ...props,
            className: (0, runtime.cn)("shrink-0 text-accent", className),
            children:
              children ??
              jsxForUiInputs24.jsx(runtime.Icon, {
                name: "Check",
                size: "md",
                bold: true,
              }),
          }),
      );
      ComboboxItemCheck.displayName = "Combobox.ItemIndicator";
      ComboboxGroupLabel = reactForUiInputs25.forwardRef<HTMLDivElement, ComboboxGroupLabelProps>(
        (
          { className: className, ...props },
          options,
        ) =>
          jsxForUiInputs24.jsx(runtime.baseCombobox.GroupLabel, {
            ref: options,
            ...props,
            className: (0, runtime.cn)(COMBOBOX_GROUP_LABEL_CLASS, className),
          }),
      );
      ComboboxGroupLabel.displayName = "Combobox.GroupLabel";
      (ComboboxSeparator as DisplayNamedComponent).displayName = "Combobox.Separator";
      (ComboboxFooter as DisplayNamedComponent).displayName = "Combobox.Footer";
      ComboboxChips = reactForUiInputs25.forwardRef<HTMLDivElement, ComboboxChipsProps>(
        (
          { size: size, className: className, ...props },
          options,
        ) =>
          jsxForUiInputs24.jsx(runtime.baseCombobox.Chips, {
            ref: options,
            ...props,
            ...(0, runtime.getControlSizeAttributes)(size),
            className: (0, runtime.cn)(
              COMBOBOX_CHIPS_INPUT_CLASS,
              "h-auto min-h-control flex-wrap py-1 pl-sm [&>*]:relative",
              className,
            ),
          }),
      );
      ComboboxChips.displayName = "Combobox.Chips";
      ComboboxRegistrationContext = reactForUiInputs25.createContext<ComboboxRegistration | null>(null);
      ComboboxChipsContext = reactForUiInputs25.createContext<boolean>(false);
      ComboboxPopupInputContext = reactForUiInputs25.createContext<boolean>(false);
      (ComboboxRoot as DisplayNamedComponent).displayName = "Combobox.Root";
      ComboboxComponents = Object.assign(Combobox, {
        Root: ComboboxRoot,
        Trigger: ComboboxTrigger,
        Value: ComboboxValue,
        Input: ComboboxInput,
        PopupSearch: ComboboxPopupSearch,
        Clear: ComboboxClear,
        Caret: ComboboxCaret,
        FooterAction: ComboboxFooterAction,
        Popup: ComboboxPopup,
        List: ComboboxList,
        Empty: ComboboxEmpty,
        Status: ComboboxStatus,
        Item: ComboboxPrimitiveItem,
        ItemIndicator: ComboboxItemCheck,
        Group: runtime.baseCombobox.Group,
        GroupLabel: ComboboxGroupLabel,
        Separator: ComboboxSeparator,
        Footer: ComboboxFooter,
        Chips: ComboboxChips,
        Chip: ComboboxChip,
        ChipRemove: ComboboxChipRemove,
        Collection: runtime.baseCombobox.Collection,
      });
    });
    initializeUiInputs27 = (0, runtime.initializeOnce)(() => {
      initializeUiInputs26();
      (0, runtime.initializeUiToast2)();
      jsxForUiInputs25 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      (FieldCombobox as DisplayNamedComponent).displayName = "Field.Combobox";
    });
    initializeUiInputs28 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeElementAccess)();
      (0, runtime.initializeUiDisclosure)();
      (0, runtime.initializeUiMenu5)();
      (0, runtime.initializeUiMenu12)();
      (0, runtime.initializeUiToast2)();
      (0, runtime.initializeNpmDependency)();
      reactForUiInputs26 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiInputs26 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      FieldCheckbox = reactForUiInputs26.forwardRef<HTMLButtonElement, FieldCheckboxProps>(
        (
          {
            label: label,
            description: description,
            error: error,
            fieldClassName: fieldClassName,
            className: className,
            "aria-labelledby": ariaLabelledby,
            "aria-describedby": ariaDescribedby,
            ...props
          },
          options,
        ) => {
          let value = reactForUiInputs26.useId(),
            value2 = reactForUiInputs26.useId();
          return jsxForUiInputs26.jsx(runtime.FieldWrapper, {
            error: error,
            fieldClassName: fieldClassName,
            children: jsxForUiInputs26.jsxs("label", {
              ...(0, runtime.getControlSizeAttributes)(props.size),
              onMouseDown: runtime.preventRepeatedClickSelection,
              onClick: preserveFieldCheckboxFocus,
              className: (0, runtime.cn)(
                runtime.CHECKBOX_MARK_CLASS,
                "group/cb items-start self-start",
                props.disabled ? "cursor-default" : "cursor-interactive",
                className,
              ),
              children: [
                jsxForUiInputs26.jsx("span", {
                  className: (0, runtime.clsx)("flex", runtime.CheckboxMark),
                  children: jsxForUiInputs26.jsx(runtime.Checkbox, {
                    ref: options,
                    "aria-labelledby": ariaLabelledby || value,
                    "aria-describedby":
                      [ariaDescribedby, description ? value2 : undefined]
                        .filter(Boolean)
                        .join(" ") || undefined,
                    ...props,
                  }),
                }),
                jsxForUiInputs26.jsxs("span", {
                  className: (0, runtime.clsx)(
                    "flex min-w-0 flex-col",
                    props.disabled && "text-disabled",
                  ),
                  children: [
                    jsxForUiInputs26.jsx("span", {
                      id: value,
                      children: label,
                    }),
                    !!description &&
                      jsxForUiInputs26.jsx("span", {
                        id: value2,
                        className: (0, runtime.cn)(
                          "text-footnote leading-snug text-muted",
                          props.disabled && "text-disabled",
                        ),
                        children: description,
                      }),
                  ],
                }),
              ],
            }),
          });
        },
      );
      FieldCheckbox.displayName = "Field.Checkbox";
    });
    FieldComponents = {} as FieldComponentsNamespace;
    (0, runtime.defineLiveExports)(FieldComponents, {
      Validity: () => runtime.FieldRow,
      TextInput: () => runtime.FieldTextInput,
      TextArea: () => runtime.FieldTextArea,
      Root: () => runtime.FieldRoot,
      NumberInput: () => runtime.FieldNumberInput,
      Label: () => runtime.FieldLabel,
      Error: () => runtime.FieldError,
      Description: () => runtime.FieldDescription,
      Control: () => runtime.FieldRootWithLabel,
      Combobox: () => FieldCombobox,
      Checkbox: () => FieldCheckbox,
    });
    initializeUiInputs29 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeUiToast2)();
      (0, runtime.initializeUiToast3)();
      (0, runtime.initializeUiToast4)();
      (0, runtime.initializeUiToast5)();
      initializeUiInputs27();
      initializeUiInputs28();
    });
    initializeUiInputs210 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeUiEditorTokens)();
      (0, runtime.initializeIcons)();
      (0, runtime.initializeUiEditorSelection2)();
      (0, runtime.initializeUiAvatars3)();
      (0, runtime.initializeShortcuts)();
      (0, runtime.initializeTooltip)();
      (0, runtime.initializeUiAvatarStack)();
      (0, runtime.initializeUiDisclosure4)();
      (0, runtime.initializeUiDisclosure5)();
      (0, runtime.initializeUiDisclosure9)();
      (0, runtime.initializeUiDisclosure10)();
      (0, runtime.initializeUiDisclosure11)();
      (0, runtime.initializeUiMenu2)();
      (0, runtime.initializeMenuItemVariants)();
      (0, runtime.initializeUiMenu9)();
      (0, runtime.initializeUiMenu11)();
      (0, runtime.initializeUiMenu12)();
      (0, runtime.initializeUiInputs3)();
      (0, runtime.initializeUiInputs6)();
      (0, runtime.initializeUiInputs9)();
      (0, runtime.initializeUiDialog)();
      (0, runtime.initializeUiTabs2)();
      (0, runtime.initializeUiTabs3)();
      (0, runtime.initializeUiTabs4)();
      (0, runtime.initializeUiTabs5)();
      (0, runtime.initializeUiTabs6)();
      (0, runtime.initializeUiTable)();
      (0, runtime.initializeUiTable2)();
      (0, runtime.initializeUiTable3)();
      (0, runtime.initializeUiTable4)();
      (0, runtime.initializeUiTable5)();
      (0, runtime.initializeUiTable7)();
      (0, runtime.initializeUiTabs23)();
      (0, runtime.initializeUiToast)();
      initializeUiInputs29();
    });
  };
}
