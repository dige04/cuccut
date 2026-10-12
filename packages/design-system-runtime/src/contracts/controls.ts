import type * as React from "react";
import type { Field } from "@base-ui/react/field";
import type { Switch } from "@base-ui/react/switch";
import type { Checkbox } from "@base-ui/react/checkbox";
import type { NumberField } from "@base-ui/react/number-field";
import type { Menu } from "@base-ui/react/menu";
import type { ClassValue } from "clsx";
export type ControlSize = "xxs" | "xs" | "sm" | "base" | "lg";
export type Density = "compact" | "comfortable";
export type ResolvedIconSize = "xs" | "sm" | "md" | "lg" | "xl" | "xxl";
export type IconSize = ResolvedIconSize | "auto" | "auto-sm" | "auto-lg";
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "brand"
  | "onContent"
  | "onAccent";
export type DesignStyle =
  | React.CSSProperties
  | (React.CSSProperties & {
      [property in `--${string}`]?: string | number;
    });
export type ForwardComponent<Element, Props> = React.ForwardRefExoticComponent<
  React.PropsWithoutRef<Props> & React.RefAttributes<Element>
>;
export type VariantClasses<Variants> = (
  options?: Variants &
    (
      | { class: ClassValue; className?: undefined }
      | { className: ClassValue; class?: undefined }
      | { class?: undefined; className?: undefined }
    ),
) => string;
export interface ButtonGroupState {
  size?: ControlSize;
  joined?: "start" | "middle" | "end";
  enforceVariant?: boolean;
  buttonVariant?: ButtonVariant;
}
export type ButtonElement = HTMLButtonElement | HTMLAnchorElement;
export interface ButtonProps
  extends Omit<React.HTMLAttributes<ButtonElement>, "style"> {
  variant?: ButtonVariant;
  size?: ControlSize;
  icon?: React.ReactNode;
  iconOnly?: boolean;
  iconPosition?: "start" | "end";
  tooltip?: string | boolean;
  tooltipSide?: TooltipSide;
  indicator?: React.ReactNode;
  shortcut?: string;
  busy?: boolean;
  busyLabel?: string;
  pressed?: boolean | "mixed";
  flush?: boolean | "start" | "end" | "both";
  style?: DesignStyle;
  disabled?: boolean;
  disabledReason?: React.ReactNode;
  disabledReasonSide?: TooltipSide;
  type?: "button" | "submit" | "reset";
  href?: string;
  routerOptions?: object;
  target?: string;
  rel?: string;
  download?: string | boolean;
  render?:
    | React.ReactElement
    | ((
        props: React.HTMLAttributes<ButtonElement>,
        state: object,
      ) => React.ReactElement);
}
export type OverlayKind =
  | "modal"
  | "tooltip"
  | "contextmenu"
  | "popover"
  | "menu"
  | "combobox"
  | "coachmark";
export type TooltipSide =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "inline-start"
  | "inline-end";
export type ButtonKeyEvent = Pick<
  React.KeyboardEvent<ButtonElement>,
  "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey"
>;
export interface FieldState {
  invalid: boolean;
  disabled: boolean;
}
export interface CheckboxGlyphProps {
  indeterminate?: boolean;
}
export interface CheckboxVisualProps extends CheckboxGlyphProps {
  checked?: boolean;
  className?: string;
}
export interface TextInputProps
  extends Omit<React.ComponentPropsWithoutRef<"input">, "size"> {
  size?: ControlSize;
  fullWidth?: boolean;
  slotStart?: React.ReactNode;
  slotEnd?: React.ReactNode;
  clearable?: boolean | "always";
  clearLabel?: string;
  onClear?: () => void;
}
export interface TextAreaProps
  extends Omit<React.ComponentPropsWithoutRef<"textarea">, "size" | "style"> {
  size?: ControlSize;
  resize?: "none" | "y";
  autosize?: boolean;
  bare?: boolean;
  fullWidth?: boolean;
  style?: DesignStyle;
}
export type AutosizeOptions = Pick<
  TextAreaProps,
  "autosize" | "value" | "defaultValue"
>;
export interface SurfaceProps
  extends Omit<React.ComponentPropsWithoutRef<"div">, "style"> {
  elevation: "panel" | "popover";
  style?: DesignStyle;
}
export type SurfaceBackground = "surface-2" | "surface-3";
export type BadgeVariant =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "pro";
export type AccentColor =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "aqua"
  | "blue"
  | "violet"
  | "magenta";
export interface BadgeProps extends React.ComponentPropsWithoutRef<"span"> {
  variant?: BadgeVariant | AccentColor;
  icon?: React.ReactNode;
  iconOnly?: boolean;
  onRemove?: () => void;
  removeLabel?: string;
  removeRender?: React.ReactElement<React.ComponentPropsWithoutRef<"button">>;
  bold?: boolean;
  size?: ControlSize;
  truncate?: boolean;
}
export interface CounterProps extends React.ComponentPropsWithoutRef<"span"> {
  value: number;
  max?: number;
  showZero?: boolean;
  dot?: boolean;
  variant?: Exclude<BadgeVariant, "pro">;
  size?: ControlSize;
}
export type SwitchProps = Omit<Switch.Root.Props, "className"> & {
  className?: string;
  size?: ControlSize;
  disabledReason?: React.ReactNode;
  disabledReasonSide?: TooltipSide;
};
export type CheckboxProps = Omit<Checkbox.Root.Props, "className"> & {
  className?: string;
  label?: React.ReactNode;
  description?: React.ReactNode;
  size?: ControlSize;
  disabledReason?: React.ReactNode;
};
export interface FieldWrapperProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  fieldClassName?: string;
  children?: React.ReactNode;
}
export type FieldCheckboxProps = CheckboxProps & FieldWrapperProps;
export type FieldRootProps = Omit<Field.Root.Props, "className"> & {
  className?: string;
};
export type FieldLabelProps = Omit<Field.Label.Props, "className"> & {
  className?: string;
};
export type FieldDescriptionProps = Omit<
  Field.Description.Props,
  "className"
> & { className?: string };
export type FieldErrorProps = Omit<Field.Error.Props, "className"> & {
  className?: string;
};
export type FieldTextInputProps = TextInputProps & FieldWrapperProps;
export type FieldTextAreaProps = TextAreaProps & FieldWrapperProps;
export type NumberInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size" | "value" | "defaultValue" | "onChange"
> &
  Pick<
    NumberField.Root.Props,
    | "value"
    | "defaultValue"
    | "onValueChange"
    | "onValueCommitted"
    | "format"
    | "locale"
    | "min"
    | "max"
    | "step"
    | "smallStep"
    | "largeStep"
    | "snapOnStep"
    | "allowOutOfRange"
  > & {
    size?: ControlSize;
    fullWidth?: boolean;
    currency?: string;
    slotStart?: React.ReactNode;
    slotEnd?: React.ReactNode;
  };
export type FieldNumberInputProps = NumberInputProps & FieldWrapperProps;
export interface FieldComponents {
  Root: ForwardComponent<HTMLDivElement, FieldRootProps>;
  Label: ForwardComponent<HTMLLabelElement, FieldLabelProps>;
  Description: ForwardComponent<HTMLParagraphElement, FieldDescriptionProps>;
  Error: ForwardComponent<HTMLDivElement, FieldErrorProps>;
  TextInput: ForwardComponent<HTMLInputElement, FieldTextInputProps>;
  TextArea: ForwardComponent<HTMLTextAreaElement, FieldTextAreaProps>;
  NumberInput: ForwardComponent<HTMLInputElement, FieldNumberInputProps>;
  Control: typeof Field.Control;
  Validity: typeof Field.Validity;
  Combobox: React.ComponentType<import("./overlays").FieldComboboxProps>;
  Checkbox: ForwardComponent<HTMLElement, FieldCheckboxProps>;
}
export interface CompositionKeyboardEvent {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  keyCode: number;
  isComposing?: boolean;
  nativeEvent?: { isComposing?: boolean };
}
export interface CompositionEnterEvent extends Event {
  isComposing?: boolean;
  keyCode: number;
  metaKey: boolean;
  ctrlKey: boolean;
}
export interface CalloutProps {
  variant?: "neutral" | "warning" | "danger";
  icon?: React.ReactNode;
  action?: React.ReactNode;
  actionAlign?: "first-line" | "center";
  details?: React.ReactNode;
  defaultDetailsOpen?: boolean;
  detailsOpen?: boolean;
  onDetailsOpenChange?: (open: boolean) => void;
  onDismiss?: () => void;
  dismissLabel?: string;
  role?: React.AriaRole;
  composerCalibration?: boolean | "glyph" | "text";
  className?: string;
  "data-testid"?: string;
  children?: React.ReactNode;
}
export interface PictogramComponent {
  isCdsPictogram?: boolean;
  $$typeof?: symbol;
  type?: PictogramComponent;
  render?: PictogramComponent;
}
export interface SelectOption<Value extends string | number = string | number> {
  value: Value;
  label: string;
  icon?: string;
  disabled?: boolean;
  title?: string;
  hint?: string;
  group?: string;
  subgroup?: string;
  separatorBefore?: boolean;
  labelStyle?: React.CSSProperties;
}
export type SelectOptionRowProps = Omit<Menu.Item.Props, "className"> & {
  className?: string | ((state: Menu.Item.State) => string);
  disabledReason?: React.ReactNode;
  rowSize?: "md" | "lg";
  hint?: string;
  checked?: boolean;
  checkedRole?: "radio";
  icon?: string;
};
export interface SelectProps<Value extends string | number = string | number> {
  items: readonly SelectOption<Value>[];
  value: Value | null;
  onChange: (value: Value) => void;
  "aria-label"?: string;
  placeholder?: string;
  hint?: string;
  icon?: string;
  compact?: boolean;
  disabled?: boolean;
  title?: string;
  align?: "start" | "center" | "end";
  popupAttrs?: React.HTMLAttributes<HTMLDivElement> & {
    [attribute: `data-${string}`]: string | number | boolean | undefined;
  };
  defaultOpen?: boolean;
  searchable?: boolean;
  searchLabel?: string;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  "data-testid"?: string;
}
export type SelectKeyEvent = Parameters<
  NonNullable<Menu.Popup.Props["onKeyDown"]>
>[0];
export type SelectPointerEvent = Parameters<
  NonNullable<Menu.Popup.Props["onMouseDown"]>
>[0];
export type SkeletonTag = "div" | "span";
export type SkeletonMotion = "wave" | "sweep" | "lockstep";
export interface SkeletonProps {
  width?: React.CSSProperties["width"];
  height?: React.CSSProperties["height"];
  className?: string;
  decorative?: boolean;
  as?: SkeletonTag;
}
export interface SkeletonGroupProps {
  children?: React.ReactNode;
  hold?: "delayed" | { none: string };
  label?: string;
  className?: string;
  decorative?: boolean;
  onShown?: () => void;
  onHidden?: () => void;
  as?: SkeletonTag;
  motion?: SkeletonMotion;
}
export interface SkeletonRowsProps {
  rows?: number | number[];
  icon?: boolean;
}
export interface SkeletonChipProps {
  width?: React.CSSProperties["width"];
  shape?: "pill" | "rounded";
}
export interface SkeletonLinesProps {
  lines?: number;
  className?: string;
}
export type SkeletonBlockProps = Pick<SkeletonProps, "height" | "className">;
export interface SkeletonSnapshot {
  readonly shown: boolean;
}
export interface SkeletonShownStore {
  getSnapshot(): SkeletonSnapshot;
  subscribe(listener: () => void): () => void;
  markShown(): void;
  reset(): void;
}
export interface SkeletonComponent
  extends React.FunctionComponent<SkeletonProps> {
  Rows: React.FunctionComponent<SkeletonRowsProps>;
  Chip: React.FunctionComponent<SkeletonChipProps>;
  Lines: React.FunctionComponent<SkeletonLinesProps>;
  Block: React.FunctionComponent<SkeletonBlockProps>;
}
export interface NamedAnimation extends Animation {
  readonly animationName?: string;
  readonly effect:
    | (AnimationEffect & { readonly target?: Element | null })
    | null;
}
export interface AnimationDocument extends Document {
  getAnimations(): NamedAnimation[];
}
export interface AnimationElement extends HTMLElement {
  getAnimations(): NamedAnimation[];
}

/** Measurements are read before writes so sibling controls can animate together. */
export interface SegmentBounds {
  left: number;
  width: number;
}
export interface SegmentWidth {
  width: number;
  scaled: boolean;
}
export type SegmentMeasure = (
  correction?: boolean,
  writes?: (() => void)[],
) => void;
export interface SegmentObserverEntry {
  Observer: typeof ResizeObserver;
  observer: ResizeObserver;
  measures: Map<Element, SegmentMeasure>;
}
export interface SegmentPoll {
  cancel(): void;
  width: number;
  still: number;
  frames: number;
}
export interface SegmentLayoutState {
  live: boolean;
  poll: SegmentPoll | null;
}
export interface SegmentThumbPosition {
  get(): number | null;
  on(event: "change", listener: (position: number | null) => void): () => void;
}
export interface SegmentOption {
  value: string;
  label?: React.ReactNode;
  icon?: string;
  disabled?: boolean;
  disabledReason?: React.ReactNode;
  tooltip?: React.ReactNode;
  tooltipDetail?: React.ReactNode;
  tooltipHoverable?: boolean;
  shortcut?: string;
  indicator?: React.ReactNode;
}
export interface SegmentedControlProps
  extends Pick<
    React.AriaAttributes,
    "aria-label" | "aria-required" | "aria-invalid" | "aria-describedby"
  > {
  segments: readonly SegmentOption[];
  value: string;
  onChange(value: string): void;
  variant?: "contained" | "ghost";
  size?: ControlSize;
  fullWidth?: boolean;
  disabled?: boolean;
  tooltipSide?: TooltipSide;
  tooltipClassName?: string;
  thumbPosition?: SegmentThumbPosition;
  className?: string;
}
export interface ResizeHandleProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    "onResize" | "onResizeStart" | "onResizeEnd"
  > {
  orientation?: "vertical" | "horizontal";
  side?: "inline-start" | "inline-end" | "top" | "bottom";
  onResize(delta: number): void;
  onResizeStart?(): void;
  onResizeEnd?(changed: boolean): void;
}
export interface CurrencyDisplayParts {
  symbol: string;
  side: "start" | "end";
}
export interface TextLinkProps
  extends Omit<
      React.AnchorHTMLAttributes<HTMLAnchorElement>,
      keyof React.DOMAttributes<HTMLAnchorElement>
    >,
    React.DOMAttributes<HTMLElement> {
  icon?: React.ReactNode;
  iconPosition?: "start" | "end";
  external?: boolean | "with-icon";
  inheritColor?: boolean;
  render?: React.ReactElement;
  disabled?: boolean;
  routerOptions?: object;
}
export interface InteractiveLinkElementProps {
  stamp: { [attribute: `data-${string}`]: string };
  forwardedRef: React.Ref<HTMLElement>;
  linkInput: import("./overlays").LinkInput;
  render?: React.ReactElement;
  body: React.ReactNode;
  className?: string;
  actionClassName?: string;
  actionDisabled?: boolean;
  rest: TextLinkProps & { "data-inherit-color"?: string };
}
export type AnnouncementMessage =
  | string
  | null
  | undefined
  | (() => string | null | undefined);
export interface AnnouncementOptions {
  ifIdle?: boolean;
}
export type AnnouncementListener = (
  message: AnnouncementMessage,
  options: AnnouncementOptions,
) => void;
export interface LiveAnnouncerProps {
  settleMs?: number;
  clearMs?: number;
}
export type CollaboratorTint = `categorical-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
