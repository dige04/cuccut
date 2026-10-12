import type * as React from "react";
import type { TooltipSide, DesignStyle } from "./controls";
export interface HsvaColor {
  h: number;
  s: number;
  v: number;
  a: number;
}
export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}
export interface OklchColor {
  l: number;
  c: number;
  h: number;
}
export interface ContrastGround {
  css: string;
  label: string;
}
export interface ContrastOptions {
  role?: "text" | "largeText" | "graphic";
  against: ContrastGround | ContrastGround[];
}
export interface ContrastResult {
  ground: ContrastGround;
  ratio: number;
  min: number;
  passes: boolean;
}
export interface ContrastFix {
  rgba: RgbaColor;
  css: string;
  ground: ContrastGround;
  ratio: number;
}
export interface ContrastVerdict {
  passes: boolean;
  worst: ContrastResult;
}
export interface ContrastFixCandidate {
  rgba: RgbaColor;
  worst: ContrastResult;
  moved: number;
}
export interface ContrastSentence {
  ratio: string;
  ground: string;
  passes: boolean;
  min: string;
}
export type ContrastDetailsSentence = ContrastSentence & {
  alsoPassing?: number;
  alsoFailing?: string[];
};
export type ContrastCountSentence = ContrastSentence & {
  alsoPassing?: number;
  alsoFailing?: number;
};
export interface ContrastDisplayInfo {
  worst: ContrastResult;
  title: string;
  sentence: string;
  spoken: string;
}
export interface ContrastButtonFix {
  css: string;
  ratio: number;
  ground: string;
  onUse: (touch: boolean) => void;
}
export interface ContrastMarkProps {
  results: ContrastResult[];
  sentence?: boolean;
  className?: string;
}
export interface ContrastCaptionProps {
  result: ContrastResult;
  name?: string;
  className?: string;
}
export interface ContrastLockupProps {
  fg: string | RgbaColor;
  results: ContrastResult[];
  className?: string;
}
export interface ContrastFixButtonProps {
  fix: ContrastButtonFix;
  held?: boolean;
  rootRef?: React.Ref<HTMLSpanElement>;
  onGoneFocused?: () => void;
}
export interface ContrastColorDetailsProps {
  fg: string | RgbaColor;
  results: ContrastResult[];
  sentenceId?: string;
  fix?: ContrastButtonFix;
  fixHeld?: boolean;
  fixRef?: React.Ref<HTMLSpanElement>;
  onFixGoneFocused?: () => void;
}
export type PointerMove = (x: number, y: number, bounds: DOMRect) => void;
export type ColorGestureMove = (
  x: number,
  y: number,
  bounds: DOMRect,
) => boolean;
export interface ColorPickerProps {
  value: string;
  unset?: boolean;
  opaque?: boolean;
  onChange: (color: string) => void;
  onPickEnd?: (color: string) => void;
  contrast?: ContrastOptions;
}
export interface ColorPickerLabelProps {
  text?: string;
  title?: boolean;
}
export interface ColorPickerGroupProps {
  label?: string;
  className?: string;
  role?: React.AriaRole;
  scroll?: boolean;
  children?: React.ReactNode;
}
export interface SwatchDotProps {
  paint?: React.CSSProperties;
  current?: boolean;
}
export interface SwatchButtonProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement | HTMLDivElement>,
    "style"
  > {
  label: string;
  paint?: React.CSSProperties;
  current?: boolean;
  readOnly?: boolean;
}
export interface ColorHexInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}
export interface ColorGestureState {
  shade?: ContrastFix;
}
export interface ColorSwatch {
  name: string;
  color: string;
  label?: string;
  group?: string;
  subgroup?: string;
  empty?: boolean;
  disabledReason?: React.ReactNode;
  picks?: string;
}
export interface ColorValueSwatch extends Omit<ColorSwatch, "color"> {
  value: string;
}
export type ColorSwatchInput = string | ColorSwatch | ColorValueSwatch;
export interface ColorKindOption {
  value: string;
  label: string;
  disabledReason?: React.ReactNode;
}
export interface ColorKind {
  value: string;
  colorValue?: string;
  options: ColorKindOption[];
  label?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}
export interface SwatchPaletteProps {
  title?: string;
  swatches: ColorSwatch[];
  current: string | null;
  repick?: boolean;
  onSwatch: (name: string) => void;
  onPicked?: () => void;
  fold?: boolean;
  color?: ColorPickerProps;
  kind?: ColorKind;
  face?: React.ReactNode;
  tab?: string;
  onTab?: (tab: string) => void;
  headerEnd?: React.ReactNode;
  heading?: React.ReactNode;
  headless?: boolean;
  testid?: string;
  className?: string;
}
export type ColorSelectProps = ColorPickerProps &
  Omit<SwatchPaletteProps, "swatches" | "current" | "onSwatch" | "color"> & {
    swatches?: ColorSwatchInput[];
    current?: string | null;
    onSwatch?: (name: string) => void;
    none?: {
      current?: boolean;
      disabledReason?: React.ReactNode;
      onPick: () => void;
    };
  };
export interface TooltipWrapperProps {
  tip: React.ReactNode;
  shortcut?: string;
  side?: TooltipSide;
  align?: "left" | "right" | "center";
  wrap?: boolean;
  delay?: number;
  className?: string;
  children?: React.ReactNode;
}
export interface NumberScrubOptions {
  value: number;
  step?: number;
  origin?: number | null;
  min?: number;
  max?: number;
  disabled?: boolean;
  onScrub: (value: number) => void;
  onScrubbing?: (live: boolean) => void;
  onScrubEnd?: () => void;
}
export interface NumberScrubGesture {
  move(x: number, largeStep?: boolean): void;
  up(): void;
  readonly live: boolean;
}
export interface NumberScrubState {
  from: number | undefined;
  v: number;
  hostMoved: boolean;
}
export type NumberInputKeyEvent = React.KeyboardEvent<HTMLInputElement> & {
  preventBaseUIHandler?: () => void;
};
export interface PropertyNumberInputProps {
  value?: number;
  onValue: (value: number | undefined) => void;
  onScrub?: (value: number) => void;
  onScrubEnd?: () => void;
  prefix?: React.ReactNode;
  unit?: React.ReactNode;
  unitScrubs?: boolean;
  refuseLetters?: boolean;
  ownUnit?: string;
  min?: number;
  max?: number;
  step?: number;
  scrubOrigin?: number | null;
  smallStep?: number;
  emptyStepFrom?: number | null;
  placeholder?: string;
  hint?: string;
  clearable?: boolean;
  mixed?: boolean;
  steppers?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  title?: string;
  "aria-label"?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  className?: string;
}
export interface PropertyIconPath {
  d: string;
  strokeWidth: number;
}
export interface PropertyIconDefinition {
  name: string;
  viewBox: number;
  paths: (string | PropertyIconPath)[];
}
export interface PropertyIconProps {
  icon: string | PropertyIconDefinition;
  className?: string;
}
export interface KitIconProps {
  name: string;
  size?: number;
  className?: string;
  style?: DesignStyle;
}
export interface FillModeOption {
  value: string;
  tooltip: string;
  disabled?: boolean;
  icon?: string;
  label?: React.ReactNode;
}
export interface PanelTab {
  value: string;
  label: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  "data-testid"?: string;
}
export interface PanelHeaderProps {
  tabs?: PanelTab[];
  activateOnFocus?: boolean;
  tabsLabel?: string;
  title?: React.ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  trailing?: React.ReactNode;
  tab?: string;
  onTabChange?: (tab: string) => void;
  className?: string;
  "data-testid"?: string;
}
export type PanelDockMode = "docked" | "floating";
export interface PanelPosition {
  x: number;
  y: number;
}
export interface SidePanelMeta extends PanelHeaderProps {
  id: string;
  title: string;
  onClose: () => void;
  detachable?: boolean;
  sheetFitsContent?: boolean;
  narrow?: "sheet" | "overlay";
  wide?: "overlay" | "docked";
  wideHeader?: boolean;
  hideTitle?: boolean;
  closeInset?: "shell" | "header";
  resizeLabel?: string;
}
export interface SidePanelState {
  activeId: string | null;
  hostEl: HTMLDivElement | null;
  leadingEl: HTMLSpanElement | null;
  trailingEl: HTMLSpanElement | null;
  openPanel: (panel: SidePanelMeta) => void;
  closePanel: (id: string) => void;
  setPanelHidden: (hidden: boolean) => void;
}
export interface SidePanelHostState {
  meta: SidePanelMeta | null;
  hidden: boolean;
  setHostEl: React.Dispatch<React.SetStateAction<HTMLDivElement | null>>;
  setLeadingEl: React.Dispatch<React.SetStateAction<HTMLSpanElement | null>>;
  setTrailingEl: React.Dispatch<React.SetStateAction<HTMLSpanElement | null>>;
}
export type PanelGestureEnd = (cancelled?: boolean) => void;
export interface PanelResizeGesture {
  onResizeStart: (source?: string) => void;
  onResize: (delta: number, source?: string) => void;
  onResizeEnd: (moved?: boolean, source?: string, cancelled?: boolean) => void;
}
export interface PanelWidthState {
  width: number;
  min: number;
  max: number;
  defaultWidth: number;
  gesture: PanelResizeGesture;
}
export interface PanelWidthHandleProps extends PanelWidthState {
  label?: string;
  className?: string;
}
export interface PanelResizeHandleProps {
  name: string;
  label: string;
  now: number;
  min: number;
  max: number;
  valueText?: string;
  side?: "top" | "inline-start";
  gesture: PanelResizeGesture;
  disabled?: boolean;
  unavailableTip?: React.ReactNode;
  onHome?: () => void;
  onEnd?: () => void;
  onReset?: () => void;
  className?: string;
  grabClassName?: string;
  grabTargetClassName?: string;
}
export interface PanedLayoutProps {
  toolbar?: React.ReactNode;
  leading?: React.ReactNode;
  toolbarVariant?: "docked" | "floating";
  children?: React.ReactNode;
}
export interface ToolbarTip {
  disabled?: boolean;
  disabledTip?: string;
  tip?: string;
  label: string;
  shortcut?: string;
}
export interface ToolbarDisabledDescription {
  disabled?: boolean;
  reason?: string;
  name: string;
  pressed?: React.AriaAttributes["aria-pressed"];
  expanded?: React.AriaAttributes["aria-expanded"];
  hasPopup?: React.AriaAttributes["aria-haspopup"];
}
export interface ToolbarAccessibleDescription {
  disabled?: boolean;
  name: string;
  tip: string;
  shortcut?: string;
  describedBy?: string;
  descriptionSuffix?: string;
}
export interface ToolbarAccessibility {
  describedBy?: string;
  keyShortcuts?: string;
  mirror: React.ReactElement | null;
}
export interface ToolbarDisabledAccessibility {
  props: React.AriaAttributes & { role?: "button" };
  inner: React.AriaAttributes;
  mirror: React.ReactElement | null;
}
export interface ToolbarPointerPoint {
  x: number;
  y: number;
  at: number;
  perf: number | null;
}
export interface ToolbarPointerSession {
  onStrip: boolean;
  inPopup: boolean;
  mouse: boolean;
  began: ToolbarPointerPoint;
  ended: ToolbarPointerPoint | null;
  early?: boolean;
  stray?: boolean;
  runAt?: number;
  end?: number;
}
export type CompletedToolbarPointerSession = ToolbarPointerSession & {
  ended: ToolbarPointerPoint;
};
export interface ToolbarTouchDeadline {
  left: number;
  top: number;
  end: number;
  since: number;
  movedAt: number;
}
export type ToolbarClickEvent = Pick<
  MouseEvent,
  "detail" | "timeStamp" | "clientX" | "clientY"
>;
export interface ToolbarStripProps
  extends React.HTMLAttributes<HTMLDivElement> {
  surface?: "panel" | "popover";
  placed?: "above" | "below";
  coversSelection?: boolean;
  wrap?: boolean;
}
export interface ToolbarButtonProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "tip" | "aria-expanded"
  > {
  icon?: React.ReactNode;
  glyph?: React.ReactNode;
  label: string;
  tip?: string;
  disabledTip?: string;
  shortcut?: string;
  descriptionSuffix?: string;
  pressed?: boolean;
  expanded?: boolean;
  count?: number;
  iconOnly?: boolean;
  caret?: boolean;
  tipSide?: TooltipSide;
  variant?: import("./controls").ButtonVariant;
  "aria-expanded"?: React.AriaAttributes["aria-expanded"];
}
export interface ToolbarStripButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  chevron?: boolean;
  icon?: React.ReactNode;
}
export type ToolbarFocusEvent = Event & {
  currentTarget: HTMLElement;
  relatedTarget?: EventTarget | null;
};
