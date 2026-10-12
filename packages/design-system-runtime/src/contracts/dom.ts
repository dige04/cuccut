import type * as React from "react";

/** The minimum observable media-query surface used by pointer and layout stores. */
export interface MediaQueryWindow {
  matchMedia(query: string): MediaQueryList;
}
export interface ExternalStore<Value> {
  subscribe(listener: () => void): () => void;
  getSnapshot(): Value;
}
export interface CoarsePointerStore {
  source: MediaQueryWindow["matchMedia"];
  list: MediaQueryList;
  coarse: boolean;
  subscribers: Set<() => void>;
  onListChange(): void;
}
export interface SafeObserver<Observer> {
  observer: Observer | null;
  attempt(operation: (observer: Observer) => void): boolean;
}
export interface SafeResizeObserver {
  observe(target: Element, options?: ResizeObserverOptions): boolean;
  unobserve(target: Element): void;
  disconnect(): void;
}
export interface SafeMutationObserver {
  observe(target: Node, options?: MutationObserverInit): boolean;
  disconnect(): void;
  takeRecords(): MutationRecord[];
}
export interface DocumentInputState {
  observedInput: boolean;
  lastInputDismissing: boolean;
}
export interface InputFocusEvent {
  target: (EventTarget & { ownerDocument?: Document | null }) | null;
  relatedTarget: EventTarget | null;
}
export type DocumentFont = "anthropic" | "system";
export type CustomStyle =
  | React.CSSProperties
  | (React.CSSProperties & {
      [property in `--${string}`]?: string | number | undefined;
    });
export interface KeyboardInset {
  inset: number;
  visible: number;
  offset: number;
}
export type SheetDetent = "default" | "tall";
export interface SheetFrame {
  height?: number;
  detent?: SheetDetent;
  keyboard?: KeyboardInset | null;
}
export interface SheetBounds {
  rest: number;
  tall: number;
  room: number;
}
export interface SheetDragGeometry {
  height: number;
  slide: number;
  shown: number;
}
export interface SheetDragRelease {
  rawAtRelease: number;
  rawAtGrab: number;
  caughtSlide: number;
  commit: boolean;
  detent: SheetDetent;
  velocity: number;
}
export interface SheetRelease {
  dismiss: boolean;
  detent: SheetDetent;
}
export interface SheetDragSettings {
  detentThreshold: number;
  dismissFraction: number;
  flingVelocity: number;
  rubberBand: number;
  overshootRoom: number;
}
export interface CloseWatcherHandle {
  onclose: (() => void) | null;
  destroy(): void;
}
export type BrowserWindow = Window &
  Pick<
    typeof globalThis,
    "ResizeObserver" | "MutationObserver" | "Element" | "HTMLElement"
  > & {
    CloseWatcher?: new () => CloseWatcherHandle;
    navigator: Navigator & { userAgentData?: { platform?: string } };
  };
export type CallbackRef<Value> = React.Ref<Value> | undefined;
export type RefCleanup = () => void;

export interface SheetState {
  sheet: boolean;
  pending: boolean;
  covered: boolean;
  inert: boolean;
  depth: number;
}
export type ShortcutModifier =
  | "ctrl"
  | "control"
  | "alt"
  | "option"
  | "shift"
  | "cmd"
  | "command"
  | "meta";
export interface ShortcutChord {
  modifiers: ShortcutModifier[];
  keys: string[];
}
export interface ShortcutLabel {
  label: string;
  spoken?: string;
}
export interface ShortcutProps extends React.HTMLAttributes<HTMLSpanElement> {
  keys: string;
  variant?: "keycap" | "text";
  onFill?: boolean;
}
/** Types of hooks and pure helpers exported through the mutable module registry. */
export interface DomRuntimeBindings {
  getMediaQueryStore(
    windowObject: MediaQueryWindow,
    query: string,
  ): ExternalStore<boolean> | null;
  useMediaQuery__U(
    windowObject: MediaQueryWindow | null | undefined,
    query: string,
  ): boolean;
  resolveWindow(
    windowOverride?: MediaQueryWindow,
  ): MediaQueryWindow | undefined;
  getCoarsePointerSnapshot(windowOverride?: MediaQueryWindow): boolean;
  subscribeCoarsePointer(
    listener: () => void,
    windowOverride?: MediaQueryWindow,
  ): () => void;
  createRequiredRefCallback<Args extends unknown[], Result>(
    ref: React.RefObject<(...args: Args) => Result>,
  ): (...args: Args) => Result;
  createOptionalRefCallback<Args extends unknown[], Result>(
    ref: React.RefObject<((...args: Args) => Result) | undefined>,
  ): (...args: Args) => Result | undefined;
  useEventCallback<Args extends unknown[], Result>(
    callback: (...args: Args) => Result,
  ): (...args: Args) => Result;
  useOptionalEventCallback: OptionalEventCallback;
  setReactRef<Value>(
    ref: CallbackRef<Value>,
    value: Value | null,
  ): void | RefCleanup;
  mergeRefs<Value>(...refs: CallbackRef<Value>[]): React.RefCallback<Value>;
  useMergedRefs<Value>(
    firstRef?: CallbackRef<Value>,
    secondRef?: CallbackRef<Value>,
    thirdRef?: CallbackRef<Value>,
  ): React.RefCallback<Value>;
  useStableMergedRef<Value>(
    firstRef: React.RefCallback<Value>,
    secondRef?: CallbackRef<Value>,
  ): React.RefCallback<Value>;
  createSafeResizeObserver(
    ObserverConstructor: typeof ResizeObserver,
    callback: ResizeObserverCallback,
  ): SafeResizeObserver;
  createSafeMutationObserver(
    ObserverConstructor: typeof MutationObserver,
    callback: MutationCallback,
  ): SafeMutationObserver;
  isInputTriggeredBlur(event: InputFocusEvent): boolean;
  rubberBandDistance(distance: number, overshootRoom: number): number;
  inverseRubberBandDistance(distance: number, overshootRoom: number): number;
  calculateSheetBounds(
    restHeight: number,
    availableHeight: number,
    maximumHeightFraction: number,
    canGrow?: boolean,
  ): SheetBounds;
  hasTallSheetDetent(bounds: SheetBounds): boolean;
  calculateSheetDragGeometry(
    bounds: SheetBounds,
    rawHeight: number,
  ): SheetDragGeometry;
  recoverRawSheetHeight(
    bounds: SheetBounds,
    height: number,
    slide: number,
  ): number;
  determineSheetRelease(
    bounds: SheetBounds,
    release: SheetDragRelease,
  ): SheetRelease;
  getSheetAvailableHeight(
    windowObject: Pick<Window, "innerHeight" | "getComputedStyle">,
    sheetElement: Element | null | undefined,
  ): number;
  getSheetPopupStyle(
    frame: SheetFrame | null,
    options: { floor?: "half" | "content"; parentFrameHeight?: number },
  ): CustomStyle;
  getSheetMinimumHeight(
    viewportHeight: number,
    hasHalfHeightFloor: boolean,
  ): number;
  measureVisualKeyboard(
    windowObject: Pick<Window, "visualViewport" | "document">,
  ): KeyboardInset | null;
  useDocumentFont(enabled?: boolean): DocumentFont | undefined;
  useFeatureFlagAttribute(): string | undefined;
  mergeFeatureFlagNames(
    existingNames: string | undefined,
    additionalNames: readonly string[] | undefined,
  ): string | undefined;
  parseShortcutSequence(shortcut: string): string[];
  parseShortcutChord(
    shortcut: string,
    apple: boolean | undefined,
  ): ShortcutChord;
  renderShortcutChord(shortcut: string, apple: boolean): ShortcutLabel[];
  shortcutToAriaKeyShortcuts(
    shortcut: string,
    apple: boolean,
  ): string | undefined;
}
export type OverlayKind =
  | "modal"
  | "tooltip"
  | "contextmenu"
  | "popover"
  | "menu"
  | "combobox"
  | "coachmark";
export interface LayerRenderProps extends React.HTMLAttributes<HTMLElement> {
  "data-cds"?: string;
  style?: CustomStyle;
}
export interface LayerProps {
  base?: number;
  render?: React.ReactElement<LayerRenderProps>;
  children?: React.ReactNode;
}
export interface LayerValue {
  base: number;
  style: CustomStyle;
  portalProps: { className: string; style: CustomStyle };
}
export interface InnerOverlay {
  isOpen(): boolean;
  close(): void;
}
export interface OverlayStack {
  register(overlay: InnerOverlay): () => void;
  topmostOpen(): InnerOverlay | undefined;
}
export interface OverlayEvent {
  currentTarget: EventTarget | null;
  preventDefault(): void;
}
export interface OverlayCloseDetails {
  reason: string;
  cancel?(): void;
  event?: OverlayEvent;
}
export interface OverlayFocusOptions {
  open?: boolean;
  skipRestoreOnOutsideFocus?: boolean;
  registerOpenerReturn?: boolean;
  triggerRef?: React.RefObject<HTMLElement | null>;
}
export interface OverlayFocusReturn {
  finalFocus(): HTMLElement | SVGElement | false | null;
  popupRef: React.RefObject<HTMLElement | null>;
}
export interface ClickToFocusOptions {
  disabled?: boolean;
  readOnly?: boolean;
  shouldIgnoreTarget?(target: Element): boolean;
}
export type HrefOrigin = "relative" | "first-party" | "other";
export type OverlayPresentation = "auto" | "sheet" | "popup";
export interface MutableCell<Value> {
  get(): Value | null;
  set(value: Value | null): void;
}
export interface SheetLevel {
  height: number;
  grows: boolean;
}
export interface SheetLevelHandle {
  set(height: number, grows?: boolean): void;
  release(): void;
}
export interface SheetGestureSession extends SheetBounds {
  owner: object;
  pointerId: number;
  startY: number;
  lastY: number;
  lastT: number;
  velocity: number;
  detent: SheetDetent;
  raw: number;
  caughtSlide: number;
  sheets: { el: HTMLElement; height: string }[];
  doc: Document;
  scrims: HTMLElement[];
}
export interface OverlayActions {
  close(): void;
  unmount(): void;
}
export interface PublicOverlayActions {
  close(): void;
  unmount(): void;
}
export interface SheetRuntimeFrame extends SheetFrame {
  treeId: string;
  open: boolean;
  showing: boolean;
  canGrow: boolean;
  detent: SheetDetent;
  setDetent(detent: SheetDetent): void;
  pinHeight(height: number, grows?: boolean): void;
  repinHeight(height: number, grows?: boolean): void;
  pushLevelHeight(height: number, grows?: boolean): SheetLevelHandle;
  holdTextEntryFocus(): () => void;
  dismiss(): void;
  drag: MutableCell<SheetGestureSession>;
}
export interface SheetFrameResult {
  showing: boolean;
  frame: SheetRuntimeFrame;
  actionsRef: React.RefObject<OverlayActions | null>;
  onOpenChangeComplete(open: boolean): void;
}
export interface ShrinkWrapMeasurement {
  rects: DOMRect[];
  left: number;
  right: number;
  clipped: number;
  boundLeft: number;
  boundRight: number;
}
export interface ShrinkWrapLayout {
  height: number;
  overflow: number;
  client: number;
  spill: number;
  clipped: number;
  widths: number[];
}
export interface ShrinkWrapJob {
  el: HTMLElement;
  done(width: number | null): void;
  boxWidth: number;
  borderBoxSizing: boolean;
  natural: ShrinkWrapLayout | null;
  candidate: number;
  stage: "read" | "verify" | "nudge1" | "nudge2" | "bisect" | "settled";
  lo: number;
  hi: number;
  probes: number;
  resizeDue: boolean;
}
export interface ShrinkWrapQueue {
  queue: Map<HTMLElement, ShrinkWrapJob>;
  microtaskQueued: boolean;
  frameQueued: number;
}
export interface ShrinkWrapResizeStore {
  observer: ResizeObserver;
  handlers: Map<Element, Set<(entry: ResizeObserverEntry) => void>>;
  paused: Set<Element>;
  resumeQueued: number;
}
export interface ShrinkWrapLoadingStore {
  refits: Set<() => void>;
  listener(): void;
}
export interface ShrinkWrapRecompute {
  self: boolean;
  inline: number;
  block: number;
  prevInline: number;
  prevBlock: number;
  applied: number | null;
}
export type ShrinkWrapSchedule = "microtask" | "frame" | "resize";
export interface ShrinkWrapOptions {
  enabled?: boolean;
  immediate?: boolean;
}
export interface CancelableTimeout {
  start(delay: number, callback: () => void): void;
  cancel(): void;
}
export interface SheetParentState {
  depth: number;
  frameHeight?: number;
  cover(token: object): () => void;
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
export interface ThemeTokenManifest {
  $schema: string;
  TYPE_SCALE: string[];
  TYPE_WEIGHT_NAMES: string[];
  themeKeys: Record<ThemeClassGroup, string[]>;
}
export interface TransitionRunner {
  <Value>(name: string, callback: () => Value): Value;
}
export interface OptionalEventCallback {
  <Args extends unknown[], Result>(
    callback: (...args: Args) => Result,
  ): (...args: Args) => Result | undefined;
  <Args extends unknown[], Result>(
    callback: ((...args: Args) => Result) | undefined,
  ): ((...args: Args) => Result | undefined) | undefined;
}
export interface HotReloadCopyExports {
  unpublishableWords(paths: readonly string[]): string;
  keptWords(kept: readonly { path: string; why: string }[]): string;
  downloadsRefusedWords(paths: readonly string[]): string;
  STRAY_INDEX_NOTICE: string;
  STORE_WRITTEN_NOTICE: string;
  REOPENED_VIEW_ONLY_MESSAGE: string;
  REOPENED_MESSAGE: string;
  RELOAD_YOURSELF_NOTICE: string;
  NOT_REOPENED_SPOKEN: string;
  NOT_REOPENED_NOTICE: string;
  NOT_MOVED_REOPEN_MESSAGE: string;
  NOT_MOVED_RELOAD_NOTICE: string;
  NOT_MOVED_INTERRUPTED_NOTICE: string;
  MOVE_WAIT_OVER_MESSAGE: string;
  MOVE_STOPPED_NOTICE: string;
  MOVE_ENDED_REOPEN_MESSAGE: string;
  MOVED_REOPEN_MESSAGE: string;
  FOLDED_NOTICE: string;
  ABOUT_TO_MOVE_MESSAGE: string;
}

/** Native element attributes with the design system's string-valued data fields. */
export type DataAttributes<ElementType extends HTMLElement = HTMLDivElement> =
  React.HTMLAttributes<ElementType> & {
    [attribute in `data-${string}`]?: string | undefined;
  };
