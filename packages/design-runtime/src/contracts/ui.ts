import type * as React from "react";
import type { Collapsible } from "@base-ui/react/collapsible";
import type { Switch } from "@base-ui/react/switch";
import type { RadioGroup } from "@base-ui/react/radio-group";
export type { ClassValue } from "clsx";
export * from "./overlays";
export interface OptionalStableCallback {
  <Args extends unknown[], Result>(
    input: (...args: Args) => Result,
  ): (...args: Args) => Result | undefined;
  <Args extends unknown[], Result>(
    input: ((...args: Args) => Result) | undefined,
  ): ((...args: Args) => Result | undefined) | undefined;
}

export type ControlSize = "xxs" | "xs" | "sm" | "base" | "lg";
export type Density = "compact" | "comfortable";
export type ColorMode = "light" | "dark";
export type Elevation = "panel" | "popover";
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
/** Native CSS declarations plus the design system's custom properties. */
export type DesignStyle = React.CSSProperties & {
  [property: `--${string}`]: string | number | undefined;
};
export type ForwardComponent<Element, Props> = React.ForwardRefExoticComponent<
  React.PropsWithoutRef<Props> & React.RefAttributes<Element>
>;
export interface FieldState {
  invalid?: boolean;
  disabled?: boolean;
}
export interface ButtonGroupState {
  compact: boolean;
  icon?: React.ReactNode;
  exactFit?: boolean;
}
export interface CheckboxGlyphProps {
  indeterminate?: boolean;
}
export interface CheckboxVisualProps extends CheckboxGlyphProps {
  checked?: boolean;
  className?: string;
}
export interface SpinnerProps {
  size?: "s" | "m" | "l" | "sm" | "md" | "lg";
  delay?: number;
  inheritColor?: boolean;
  label?: React.ReactNode;
  className?: string;
}
export interface DelayedSpinnerProps {
  show: boolean;
  children?: React.ReactNode;
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
export interface SurfaceProps
  extends Omit<React.ComponentPropsWithoutRef<"div">, "style"> {
  elevation: Elevation;
  style?: DesignStyle;
}
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
export interface ClickToFocusOptions {
  disabled?: boolean;
  readOnly?: boolean;
  shouldIgnoreTarget?: (target: Element) => boolean;
}
export type LabelValues = Readonly<Record<string, string | number>>;
export type LabelResolver = (
  key: string,
  fallback: string,
  values?: LabelValues,
) => string | undefined;
export type SwitchProps = Omit<Switch.Root.Props, "className"> & {
  className?: string;
  size?: ControlSize;
  disabledReason?: React.ReactNode;
  disabledReasonSide?:
    | "top"
    | "bottom"
    | "left"
    | "right"
    | "inline-start"
    | "inline-end";
};
export type CollapsibleRootProps = Collapsible.Root.Props;
export type CollapsibleTriggerProps = Omit<
  Collapsible.Trigger.Props,
  "className"
> & {
  className?: string;
  caretPosition?: "start" | "end";
  hideCaret?: boolean;
};
export type CollapsiblePanelProps = Omit<
  Collapsible.Panel.Props,
  "className"
> & { className?: string };
export interface RadioGlyphProps {
  topAlign?: boolean;
  focusRing?: boolean;
}
export interface RadioOption {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
}
export interface RadioGroupProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: readonly RadioOption[];
  disabled?: boolean;
  size?: ControlSize;
  name?: string;
  className?: string;
}
export interface RadioItemProps extends RadioOption {
  className?: string;
}
export interface RadioCardProps extends RadioItemProps {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  children?: React.ReactNode;
}
export type RadioRootProps = Omit<RadioGroup.Props, "className"> & {
  className?: string;
  size?: ControlSize;
};
export interface MediaQueryStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): boolean;
}
export interface DocumentInputState {
  observedInput: boolean;
  lastInputDismissing: boolean;
}
export interface InputFocusEvent {
  target: EventTarget | null;
  relatedTarget: EventTarget | null;
}
export type SelectionMouseEvent = Pick<
  React.MouseEvent<Element>,
  "detail" | "button" | "target" | "preventDefault"
>;
export interface ActivityBoundaryProps {
  actionsRef: React.RefObject<{ close?: () => void } | null>;
  children?: React.ReactNode;
}
export interface SheetFrame {
  detent?: "tall" | "default";
  height: number;
}
export interface MutableCell<Value> {
  get(): Value | null;
  set(value: Value | null): void;
}
export interface FlipGeometry {
  left: number;
  width: number;
}
export interface FlipIndicatorState {
  value: unknown;
  tabs(): ReadonlyMap<unknown, HTMLElement>;
  activate(value: unknown): void;
  registerTab(
    value: unknown,
    element: HTMLElement | null,
    previous: HTMLElement | null,
  ): void;
  setCollapsed(collapsed: boolean): void;
}
export interface TabMenuItem<Value = unknown> {
  value: Value;
  text: string;
  srText: string;
  disabled: boolean;
  reason?: string;
}
export interface TabsListMenuProps {
  size?: ControlSize;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  listRef: React.RefObject<HTMLElement | null>;
  triggerHadFocusRef: React.RefObject<boolean>;
}
export interface VirtualTriggerAnchor {
  readonly contextElement: Element | undefined;
  getBoundingClientRect(): Omit<DOMRectReadOnly, "toJSON">;
}
export type ThemeClassGroup =
  | "borderRadius"
  | "boxShadow"
  | "cursor"
  | "fontFamily"
  | "fontWeight"
  | "gap"
  | "height"
  | "margin"
  | "minHeight"
  | "opacity"
  | "padding"
  | "size"
  | "transitionDuration"
  | "transitionTimingFunction"
  | "width"
  | "zIndex";
export interface ThemeClassKeys {
  $schema: string;
  TYPE_SCALE: string[];
  TYPE_WEIGHT_NAMES: string[];
  themeKeys: Record<ThemeClassGroup, string[]>;
}
