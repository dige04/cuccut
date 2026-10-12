/** Contracts recovered from UI controller branches and their DOM/React call sites. */
import type * as React from "react";
export type ReactNamespace = typeof import("react");
export type JsxNamespace = typeof import("react/jsx-runtime");
export interface TextCommitKey {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
}
export interface TextCommitOptions {
  value(): string;
  commit(value: string): void;
  validate?(value: string): string | null;
  draft: React.RefObject<string | null>;
  escaped: React.RefObject<boolean>;
  error?: React.RefObject<string | null>;
  rerender(): void;
  allowEmpty?: boolean;
}
export interface TextCommitController {
  display(): string;
  onFocus(): void;
  onChange(value: string): void;
  onBlur(): void;
  onForcedExit(): void;
  onKeyDown(event: TextCommitKey): { blur?: boolean };
}
export interface UseTextCommitOptions {
  value: string;
  commit(value: string): void;
  fold?: boolean;
  allowEmpty?: boolean;
  validate?(value: string): string | null;
  readOnly?: boolean;
}
export type TextEditorElement = HTMLInputElement | HTMLTextAreaElement;
export interface CommitTextInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange"
  > {
  value: string;
  onCommit(value: string, reason: "enter" | "blur"): void;
  onCancel?(): void;
  onChange?(value: string): void;
  selectOnOpen?: boolean;
}
export interface EditableTextProps {
  value: string;
  onCommit(value: string): void;
  readOnly?: boolean;
  onEditingChange?(editing: boolean): void;
  defaultEditing?: boolean;
  initialDraft?: string;
  placeholder?: string;
  maxLength?: number;
  tabIndex?: number;
  className?: string;
  inputTestId?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}
export interface ToolbarTab {
  value: string;
  title?: string;
  label: React.ReactNode;
}
export interface ToolbarTabsProps {
  tabs: readonly ToolbarTab[];
  value: string;
  onChange(value: string): void;
  label: string;
}
export interface OptionListProps {
  value: string;
  onChange(value: string): void;
  label: string;
  rowSelector: string;
  onEnterIndex?(): number;
  className?: string;
  "data-testid"?: string;
}
export type UndoCommand = "undo" | "redo";
export type UndoKeyEvent = Pick<
  KeyboardEvent,
  "altKey" | "metaKey" | "ctrlKey" | "key" | "shiftKey"
>;
export interface UndoActions {
  undo(): void;
  redo(): void;
}
export interface AnnounceHistory<Command, Seed = Command> extends UndoActions {
  exec(value: Command): void;
  seed(value: Seed): void;
  canUndo(): boolean;
  canRedo(): boolean;
  redoDepth(): number;
  clear(): void;
  subscribe(listener: () => void): () => void;
}
export interface SelectionToolbarOptions {
  gap?: number;
  holdWhileFocusIn?: React.RefObject<HTMLElement | null>;
  enabled?: boolean;
}
export interface FileDropOptions {
  disabled?: boolean;
  onFiles(files: File[], event: React.DragEvent<HTMLElement>): void;
  accept?(file: File): boolean;
}
export interface FileDropHandlerOptions extends FileDropOptions {
  depth: React.RefObject<number>;
  internal?: React.RefObject<boolean>;
  setOver(over: boolean): void;
}
export interface FileDropOverlayProps {
  show: boolean;
  label: string;
  hint?: string;
}
export type ToastAction = React.ReactNode;
export interface QueuedToast {
  id: number;
  text: string;
  durationMs: number;
  action?: ToastAction;
  onClose?(): void;
}
export type PinnedToast = import("./overlays").PinnedToast;
export type ToastNotificationBridge = import("./overlays").ToastNotifications;
export interface ContextMenuPoint {
  x: number;
  y: number;
}
export interface ContextMenuProps {
  at: ContextMenuPoint | null;
  onClose(): void;
  children?: React.ReactNode;
  title?: string;
  "aria-label"?: string;
  anchor?: "point" | "tap";
  className?: string;
  focusFirstItem?: boolean;
}
export interface RetainedContextMenu {
  at: ContextMenuPoint;
  children?: React.ReactNode;
  title?: string;
  name?: string;
  anchor: "point" | "tap";
}
export interface PopupChangeDetails {
  reason: string;
  event?: Event | React.SyntheticEvent;
  cancel(): void;
}
export type PopoverSide = "top" | "bottom";
export type ToolbarTooltipSide = PopoverSide | "left" | "right";
export interface PopoverPlacement {
  side: PopoverSide;
  maxHeight: number | undefined;
}
export interface UndoPointerProps {
  [attribute: `data-${string}`]: string;
  onPointerDownCapture: React.PointerEventHandler<HTMLElement>;
}
export type ArtifactLoadState = "loading" | "failed" | "live";
export interface ArtifactLoadDocument {
  loadState?(): string;
  subscribeLoad?(listener: () => void): () => void;
  save?(): unknown;
}
export interface ArtifactLoadBoundaryProps {
  doc: ArtifactLoadDocument;
  skeleton?: React.ReactNode;
  skeletonFlush?: boolean;
  children?: React.ReactNode;
}
export interface PropertyAction {
  label: string;
  onSelect(): void;
  variant?: "danger";
  disabled?: boolean;
  separatorBefore?: boolean;
}
export interface PropertyColorPreviewProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  background?: string;
}
export interface PropertyRowProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onReset"> {
  label?: React.ReactNode;
  onReset?(): void;
  resetLabel?: string;
  description?: string;
  onPress?(row: HTMLDivElement): void;
  disabled?: boolean;
  labelProps?: React.HTMLAttributes<HTMLSpanElement>;
  actions?: PropertyAction[];
  actionsLabel?: string;
  defaultActionsOpen?: boolean;
  trailing?: React.ReactNode;
}
export interface PropertySectionHeaderProps {
  title: React.ReactNode;
  actions?: React.ReactNode;
  collapsed?: boolean;
  onToggle?(): void;
  subsection?: boolean;
  className?: string;
}
export interface FieldButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  chip?: React.ReactNode;
  caption?: React.ReactNode;
  muted?: boolean;
  trailing?: React.ReactNode;
}
export interface ShadowValue {
  x: number;
  y: number;
  blur: number;
  spread?: number;
  color: string;
}
export interface PropertyPopoverPanelProps {
  title: React.ReactNode;
  onClose(): void;
  labelWidth?: string;
  children?: React.ReactNode;
}
export interface ShadowPropertyEditorProps {
  title: React.ReactNode;
  value: ShadowValue;
  onChange(value: ShadowValue): void;
  onLive?(value: ShadowValue): void;
  onLiveEnd?(): void;
  onClose(): void;
  spread?: boolean;
  bounds?: Partial<
    Record<
      "x" | "y" | "blur" | "spread",
      { min?: number; max?: number; step?: number }
    >
  >;
  disabled?: boolean;
  swatches?: import("./color-controls").ColorSwatchInput[];
  unifiedPopover?: boolean;
  editsAreUndoSteps?: boolean;
}
export interface PropertyPopoverProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  trigger?: import("@base-ui/react/popover").Popover.Trigger.Props<void>["render"];
  anchor?(): Element | null;
  side?: "left" | "right" | "top" | "bottom";
  focusOnOpen?: boolean;
  className?: string;
  editsAreUndoSteps?: boolean;
  children?: React.ReactNode;
}
export interface RemovePropertyButtonProps {
  label: string;
  onClick(): void;
  disabled?: boolean;
  disabledReason?: string;
}
export interface PropertyPopoverTriggerProps
  extends Omit<FieldButtonProps, "color"> {
  label: string;
  color?: string | null;
  text: string;
  open?: boolean;
}
export interface PropertyPopupProps {
  open: boolean;
  onClose(): void;
  trigger?: import("@base-ui/react/popover").Popover.Trigger.Props<void>["render"];
  onOpen?(): void;
  children?: React.ReactNode;
  align?: "left" | "right";
  side?: "left" | "right" | "top" | "bottom";
  planHeight?: number;
  positionAnchor?(): Element | null;
  popupAttrs?: React.HTMLAttributes<HTMLDivElement> & {
    [attribute: `data-${string}`]: string | number | boolean | null | undefined;
  };
  editsAreUndoSteps?: boolean;
  padding?: "none" | "default";
  className?: string;
  "aria-label"?: string;
  focusOnOpen?: boolean;
  initialFocus?: import("./overlays").InitialPopupFocus;
  keepFocus?: boolean;
}
export type PropertyPopupChangeDetails =
  import("@base-ui/react/popover").Popover.Root.ChangeEventDetails;
export interface NumberPropertyRowProps
  extends Omit<import("./color-controls").PropertyNumberInputProps, "unit"> {
  label: string;
  unit?: string;
  units?: string[];
  onUnit?(unit: string): void;
  adornment?: React.ReactNode;
  trailing?: React.ReactNode;
  onReset?(): void;
  description?: string;
}
export interface ColorChipProps {
  hex: string | null;
  alpha?: number;
  className?: string;
}
export interface ColorPropertyRowProps {
  label: string;
  value?: string;
  onChange(value: string | undefined): void;
  onLive?(value: string): void;
  onLiveEnd?(): void;
  swatches?: import("./color-controls").ColorSwatchInput[];
  current?: string | null;
  onSwatch?(name: string): void;
  fold?: boolean;
  opaque?: boolean;
  description?: string;
  contrast?: import("./color-controls").ContrastOptions;
  contrastMark?: boolean;
  placeholder?: string;
  clearLabel?: string;
  popupAttrs?: React.HTMLAttributes<HTMLDivElement> & {
    [attribute: `data-${string}`]: string | number | boolean | null | undefined;
  };
  mixed?: boolean;
  unset?: boolean;
  valueName?: string | null;
  chip?: { css: string; text: string };
  headerTabs?: {
    value: string;
    colorTab?: string;
    options: import("./color-controls").ColorKindOption[];
    label?: string;
    onChange(value: string): void;
  };
  panel?: React.ReactNode;
  closeLabel?: string;
  popoverTitle?: string;
  allowNone?: boolean;
  onNone?(): void;
  isNone?: boolean;
  noneDisabledReason?: string;
  disabled?: boolean;
  disabledReason?: string;
  keepFocus?: boolean;
  editsAreUndoSteps?: boolean;
  popover?: {
    anchor?(button: HTMLButtonElement): Element | null;
    side?: "left" | "right" | "top" | "bottom";
    className?: string;
    focusOnOpen?: boolean;
  };
  open?: boolean;
  onOpenChange?(open: boolean): void;
  title?: string;
  testid?: string;
}
export interface ColorTextPropertyRowProps extends ColorPropertyRowProps {
  adornment?: React.ReactNode;
  trailing?: React.ReactNode;
  onReset?(): void;
}
export interface ToolbarContentOptions {
  skip?(element: Element): boolean;
  pinFixed?: boolean;
}
export interface ArtifactSaveState {
  status:
    | "ready"
    | "saved"
    | "dirty"
    | "saving"
    | "error"
    | "readonly"
    | "loading"
    | "cached";
  message?: string;
}
export type SaveMode = "manual" | "auto";
export interface ToolbarUndo extends UndoActions {
  canUndo(): boolean;
  canRedo(): boolean;
  subscribe(listener: () => void): () => void;
}
export interface SaveStatusProps {
  state: ArtifactSaveState;
}
export interface SaveStatusControlProps extends SaveStatusProps {
  onRetry(): void;
  tipSide?: import("./controls").TooltipSide;
}
export interface ToolbarScrollPaddleProps {
  dir: -1 | 1;
  onPress(keyboard: boolean): void;
  onLetGo(): void;
}
export interface ToolbarScrollAreaProps {
  leading?: React.ReactNode;
  revealLeading?: string;
  children?: React.ReactNode;
}
export interface ToolbarSaveControlsProps {
  saveState: ArtifactSaveState;
  saveMode?: SaveMode;
  onSave(): void;
  syncDot?: boolean;
  editing?: boolean;
  onToggleEdit?(): void;
}
export interface ToolbarSurfaceProps
  extends React.HTMLAttributes<HTMLDivElement> {
  floating?: boolean;
}
export interface ArtifactToolbarProps extends React.PropsWithChildren {
  title: string;
  saveState: ArtifactSaveState;
  saveMode?: SaveMode;
  syncDot?: boolean;
  onSave(): void;
  undo?: ToolbarUndo | null;
  publishControls?: boolean;
  pinned?: React.ReactNode;
  trailing?: React.ReactNode;
  leading?: React.ReactNode;
  afterUndo?: React.ReactNode;
  undoButtons?: boolean;
  density?: import("./controls").Density;
  touchTargets?: "square" | "rect";
  readOnly?: boolean;
  quietReadOnlyReason?: string;
  variant?: "docked" | "floating";
  extrasEnd?: React.ReactNode;
}
export interface ArtifactShellDocument<Seed> extends ArtifactLoadDocument {
  stashOffer(): { at: number } | null | undefined;
  restoreStash(): Seed | null | undefined;
  discardStash(): void;
  readOnly(): boolean;
  saveMode(): SaveMode;
  title(): string;
  saveState(): ArtifactSaveState;
  save(): unknown;
  subscribe(listener: () => void): () => void;
  subscribeSave(listener: (state: ArtifactSaveState) => void): () => void;
}
export interface ArtifactShellUndo<Seed> extends ToolbarUndo {
  seed(value: Seed): void;
  redoDepth(): number;
  clear(): void;
}
export interface ArtifactShellProps<Seed> extends React.PropsWithChildren {
  doc: ArtifactShellDocument<Seed>;
  undo?: ArtifactShellUndo<Seed> | null;
  toolbarExtras?: React.ReactNode;
  toolbarExtrasEnd?: React.ReactNode;
  toolbarPinned?: React.ReactNode;
  toolbarAfterUndo?: React.ReactNode;
  toolbarQuietReadOnlyReason?: string;
  toolbarLeading?: React.ReactNode;
  toolbarTrailing?: React.ReactNode;
  toolbarUndoButtons?: boolean;
  toolbarDensity?: import("./controls").Density;
  toolbarTouchTargets?: "square" | "rect";
  alwaysShowExtras?: boolean;
  undoShortcuts?: boolean;
  tabs?: ToolbarTab[];
  tab?: string;
  onTabChange?(value: string): void;
  aboveContent?: React.ReactNode;
  skeleton?: React.ReactNode;
  skeletonFlush?: boolean;
  leading?: React.ReactNode;
  hideToolbar?: boolean;
  toolbarVariant?: "docked" | "floating";
}
