/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type {
  Context,
  CSSProperties,
  Dispatch,
  ElementType,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  Ref,
  RefObject,
  SetStateAction,
} from "react";

/** The pair of functions React's useSyncExternalStore consumes. */
export interface ExternalStore<T> {
  subscribe: (onStoreChange: () => void) => () => void;
  getSnapshot: () => T;
}

/** A cached window.matchMedia(query) subscription. */
export type MediaQueryStore = ExternalStore<boolean>;

/** Per-window cache entry tracking the "(pointer: coarse)" media query. */
export interface CoarsePointerStore {
  source: Window["matchMedia"];
  list: MediaQueryList;
  coarse: boolean;
  subscribers: Set<() => void>;
  onListChange: () => void;
}

/** An observer constructed under a guard that reports construction and use errors once. */
export interface SafeObserver<T> {
  observer: T | null;
  attempt: (use: (observer: T) => void) => boolean;
}

export interface SafeResizeObserver {
  observe: (target: Element, options?: ResizeObserverOptions) => boolean;
  unobserve: (target: Element) => void;
  disconnect: () => void;
}

export interface SafeMutationObserver {
  observe: (target: Node, options?: MutationObserverInit) => boolean;
  disconnect: () => void;
  takeRecords: () => MutationRecord[];
}

/** Keyboard state seen by the document while a trusted input event is pending. */
export interface InputDismissalState {
  observedInput: boolean;
  lastInputDismissing: boolean;
}

/** Optional hook that wraps an async load in a transition; never installed in this build. */
export type TransitionRunner = <T>(
  name: string,
  callback: () => Promise<T>,
) => Promise<T>;

export interface SheetDragSettings {
  detentThreshold: number;
  dismissFraction: number;
  flingVelocity: number;
  rubberBand: number;
  overshootRoom: number;
}

export interface SheetPositioningOverrides {
  disableAnchorTracking: boolean;
  collisionAvoidance: { side: string; align: string };
}

/** Properties that make an element inert; boolean on React 19, empty string before. */
export interface InertProps {
  inert?: true | "";
}

/** Window with the experimental CloseWatcher constructor Android Chrome exposes. */
export interface CloseWatcherLike {
  onclose: (() => void) | null;
  destroy: () => void;
}
export type CloseWatcherWindow = Window & {
  CloseWatcher?: new () => CloseWatcherLike;
};
export type AndroidNavigator = Navigator & {
  userAgentData?: { platform?: string };
};

/** Soft-keyboard geometry derived from window.visualViewport, in CSS pixels. */
export interface VisualKeyboardMetrics {
  inset: number;
  visible: number;
  offset: number;
}

/** "default" or "tall"; kept open to any string because sheet content passes plain strings. */
export type SheetDetent = "default" | "tall" | (string & {});

/** Resting, expanded and overshoot heights (CSS pixels) of a bottom sheet. */
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

/** Pointer state at the end of a drag, fed to determineSheetRelease. */
export interface SheetRelease {
  detent: SheetDetent;
  rawAtGrab: number;
  rawAtRelease: number;
  caughtSlide: number;
  velocity: number;
  commit: boolean;
}

export interface SheetReleaseOutcome {
  dismiss: boolean;
  detent: SheetDetent;
}

/** One stacked sheet level reporting its content height. */
export interface SheetLevel {
  height: number;
  grows: boolean;
}

export interface SheetLevelHandle {
  set: (height: number, grows?: boolean) => void;
  release: () => void;
}

export interface MutableValue<T> {
  get: () => T;
  set: (value: T) => void;
}

/** Base UI open-change details as far as the sheet logic reads them. */
export interface SheetOpenChangeDetails {
  reason?: string;
  event?: Event;
  isCanceled?: boolean;
  cancel?: () => void;
}

/** Imperative handle a popup exposes through its actionsRef. */
export interface OverlayActions {
  close?: () => void;
  unmount: () => void;
}

/** Live drag of a bottom sheet (and the scrims behind it). */
export interface SheetDragEntry extends SheetBounds {
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

export interface SheetDragHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
  onLostPointerCapture: (event: ReactPointerEvent<HTMLElement>) => void;
}

/** Layout state shared by a sheet and everything rendered inside it. */
export interface SheetFrameBase {
  treeId: string;
  open: boolean;
  showing: boolean;
  height: number | undefined;
  pinHeight: (height: number, grows?: boolean) => void;
  repinHeight: (height: number, grows?: boolean) => void;
  pushLevelHeight: (height: number, grows?: boolean) => SheetLevelHandle;
  canGrow: boolean;
  detent: SheetDetent;
  setDetent: Dispatch<SetStateAction<SheetDetent>>;
  holdTextEntryFocus: () => () => void;
  keyboard: VisualKeyboardMetrics | null;
  dismiss: () => void;
  drag: MutableValue<SheetDragEntry | null>;
}

export interface SheetFrame extends SheetFrameBase {
  refusesAmbientClose: (details: SheetOpenChangeDetails) => boolean;
  takeCloseRequest: () => SheetOpenChangeDetails | null;
}

export interface SheetFrameState {
  showing: boolean;
  frame: SheetFrameBase;
  actionsRef: RefObject<OverlayActions | null>;
  onOpenChangeComplete: (open: boolean) => void;
}

export interface SheetStack {
  cover: (token: object) => () => void;
}

/** The enclosing sheet as seen by a nested sheet. */
export interface SheetParent {
  depth: number;
  cover: SheetStack["cover"] | null;
  frameHeight: number | undefined;
}

export interface AdaptiveSheetState {
  sheet: boolean;
  pending: boolean;
  covered: boolean;
  inert: boolean;
  depth: number;
}

export interface AdaptiveSheetProps {
  open: boolean;
  actionsRef?: Ref<OverlayActions>;
  close?: () => void;
  onOpenChange?: (open: boolean, details: SheetOpenChangeDetails) => void;
  onOpenChangeComplete?: (open: boolean) => void;
  structurallyAnchored?: boolean;
  closable?: boolean;
  refuseClose?: (
    details: SheetOpenChangeDetails,
    treeId: string,
  ) => boolean | undefined;
}

export interface AdaptiveSheet {
  sheet: boolean;
  showing: boolean;
  frame: SheetFrame;
  actionsRef: RefObject<OverlayActions | null>;
  onOpenChange: (open: boolean, details: SheetOpenChangeDetails) => void;
  onOpenChangeComplete: (open: boolean) => void;
  modal: true | undefined;
  state: AdaptiveSheetState;
  stack: SheetStack;
}

export interface ControllableOpenProps {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean, details: SheetOpenChangeDetails) => void;
}

export interface ControllableOpen {
  open: boolean;
  onOpenChange: (open: boolean, details: SheetOpenChangeDetails) => void;
}

/** What the popup host gives its children: either the plain popup or a bottom sheet. */
export interface SheetHost {
  sheet: boolean;
  concealed: boolean;
  chrome: ReactNode;
  ref: (element: HTMLElement | null) => void;
  style: CSSProperties | undefined;
  positionerStyle: CSSProperties | undefined;
  attrs: Record<string, string | undefined>;
  frame: SheetFrame | null;
  state: AdaptiveSheetState;
  stack: SheetStack | null;
}

/** The lazily loaded mobile sheet module. */
export interface SheetImplementation {
  SheetPopupHost: (props: {
    children: (host: SheetHost) => ReactNode;
  }) => ReactNode;
  MenuSheetPopup: ElementType;
  [exportName: string]: unknown;
}

export type SheetPopupStyle = CSSProperties & { "--available-height": string };

export interface SheetPopupStyleOptions {
  floor: string | undefined;
  parentFrameHeight: number | undefined;
}

export interface SheetProviderProps {
  value: Pick<AdaptiveSheet, "state" | "stack" | "frame">;
  children?: ReactNode;
}

export type ThemeTokenGroup =
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

export type ThemeTokenKeys = Record<ThemeTokenGroup, readonly string[]>;

export interface ThemeTokenManifest {
  $schema: string;
  TYPE_SCALE: readonly string[];
  TYPE_WEIGHT_NAMES: readonly string[];
  themeKeys: ThemeTokenKeys;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactMediaQuery: ReactNamespace;
    reactDocumentFont: ReactNamespace;
    reactFeatureFlags: ReactNamespace;
    reactIsomorphicLayoutEffect: ReactNamespace;
    reactAndroidCloseWatcher: ReactNamespace;
    reactEventCallbacks: ReactNamespace;
    reactVisualKeyboard: ReactNamespace;
    reactPresentationMode: ReactNamespace;
    reactInertProps: ReactNamespace;
    reactOverlayActions: ReactNamespace;
    reactAdaptiveSheets: ReactNamespace;
    jsxAdaptiveSheets: JsxNamespace;
    reactReducedMotion: ReactNamespace;
    reactSheetDrag: ReactNamespace;
    sheetFrameContext: Context<SheetFrame | null>;
    sheetStateContext: Context<AdaptiveSheetState>;
    accentColorNames: string[];
    initializeAccentColors: () => void;
    getMediaQueryStore: (windowObject: Window, query: string) => MediaQueryStore | null;
    useMediaQuery__U: (windowObject: Window | null | undefined, query: string) => boolean;
    MOBILE_COARSE_POINTER_QUERY: string;
    mediaQueryStores: WeakMap<Window, Map<string, MediaQueryStore>>;
    subscribeNoop: ExternalStore<boolean>["subscribe"];
    getFalseSnapshot: () => boolean;
    COARSE_POINTER_QUERY_rG: string;
    initializeMediaQueryStores: () => void;
    resolveWindow: (windowOverride?: Window) => Window | undefined;
    addMediaQueryListener: (mediaQuery: MediaQueryList, listener: () => void) => void;
    removeMediaQueryListener: (mediaQuery: MediaQueryList, listener: () => void) => void;
    notifySubscribers: (subscribers: Set<() => void>) => void;
    createCoarsePointerStore: (windowObject: Window, previousStore?: CoarsePointerStore) => CoarsePointerStore;
    getCoarsePointerSnapshot: (windowOverride?: Window) => boolean;
    subscribeCoarsePointer: (listener: () => void, windowOverride?: Window) => () => void;
    coarsePointerStores: WeakMap<Window, CoarsePointerStore>;
    initializeCoarsePointerStores: () => void;
    reportAsyncError: (input: unknown) => void;
    invokeAndReportError: (input: () => void) => void;
    initializeErrorReporting: () => void;
    createSafeObserver: <T>(constructObserver: () => T) => SafeObserver<T>;
    createSafeResizeObserver: (ObserverConstructor: typeof ResizeObserver, callback: ResizeObserverCallback) => SafeResizeObserver;
    createSafeMutationObserver: (ObserverConstructor: typeof MutationObserver, callback: MutationCallback) => SafeMutationObserver;
    initializeSafeObservers: () => void;
    createFontAttributeStore: () => ExternalStore<string | undefined>;
    useDocumentFont: (enabled: boolean) => string | undefined;
    supportedFonts: Record<string, boolean>;
    isSupportedFont: (font: string) => boolean;
    readDocumentFont: () => string | undefined;
    subscribeFontNoop: ExternalStore<string | undefined>["subscribe"];
    getUndefinedFontSnapshot: () => undefined;
    initializeDocumentFont: () => void;
    useFeatureFlagAttribute: () => string | undefined;
    mergeFeatureFlagNames: (existingNames: string | undefined, additionalNames: readonly string[] | undefined) => string | undefined;
    featureFlagContext: Context<string | undefined>;
    initializeFeatureFlags: () => void;
    registerInputDismissalTracking: (documentObject: Document | undefined) => void;
    trackInputForElement: (element: Element | null | undefined) => void;
    isInputTriggeredBlur: (event: FocusEvent) => boolean;
    inputDismissalStates: WeakMap<Document, InputDismissalState>;
    dismissalKeys: Set<string>;
    initializeInputDismissalTracking: () => void;
    runWithTransition: <T>(input: string, options: () => Promise<T>) => Promise<T>;
    transitionRunner: TransitionRunner | undefined;
    initializeTransitionRunner: () => void;
    useIsomorphicLayoutEffect: ReactNamespace["useLayoutEffect"];
    initializeIsomorphicLayoutEffect: () => void;
    getResizeObserverConstructor: (element: Element | null | undefined) => typeof ResizeObserver | undefined;
    initializeResizeObserverAccess: () => void;
    isAndroidWindow: (windowObject: Window) => boolean;
    useAndroidCloseWatcher: (enabled: boolean, onClose: (() => void) | undefined) => void;
    initializeAndroidCloseWatcher: () => void;
    rubberBandDistance: (distance: number, overshootRoom: number) => number;
    inverseRubberBandDistance: (distance: number, overshootRoom: number) => number;
    calculateSheetBounds: (restHeight: number, availableHeight: number, maximumHeightFraction: number, canGrow?: boolean) => SheetBounds;
    hasTallSheetDetent: (bounds: SheetBounds) => boolean;
    calculateSheetDragGeometry: (bounds: SheetBounds, rawHeight: number) => SheetDragGeometry;
    recoverRawSheetHeight: (bounds: SheetBounds, height: number, slide: number) => number;
    determineSheetRelease: (bounds: SheetBounds, release: SheetRelease) => SheetReleaseOutcome;
    sheetDragSettings: SheetDragSettings;
    initializeSheetDragSettings: () => void;
    getSheetPositionerStyle: (frame: Pick<SheetFrame, "keyboard"> | null | undefined) => CSSProperties;
    getSheetAvailableHeight: (windowObject: Window, sheetElement: Element | null | undefined) => number;
    getSheetMinimumHeight: (viewportHeight: number, hasHalfHeightFloor: boolean) => number;
    getSheetPopupStyle: (frame: Pick<SheetFrame, "keyboard" | "height" | "detent"> | null | undefined, options: SheetPopupStyleOptions) => SheetPopupStyle;
    SAFE_AREA_TOP_CSS: string;
    VIEWPORT_HEIGHT_EXCLUDING_SAFE_AREA_CSS: string;
    baseSheetPositionerStyle: CSSProperties;
    sheetPositioningOverrides: SheetPositioningOverrides;
    MAX_SHEET_HEIGHT_FRACTION: number;
    MAX_SHEET_HEIGHT_CSS: string;
    MAX_SHEET_OVERSHOOT_HEIGHT_CSS: string;
    SHEET_DENSITY: string;
    MIN_SHEET_HEIGHT_FRACTION: number;
    MIN_SHEET_HEIGHT_CSS: string;
    initializeSheetStyles: () => void;
    asElement: <E extends Element = HTMLElement>(node: unknown) => E | null;
    initializeElementAccess: () => void;
    createRequiredRefCallback: <A extends unknown[], R>(input: { current: (...args: A) => R; }) => (...args: A) => R;
    createOptionalRefCallback: <A extends unknown[], R>(input: { current: ((...args: A) => R) | undefined; }) => (...args: A) => R | undefined;
    useOptionalEventCallback: <A extends unknown[], R>(callback: ((...args: A) => R) | undefined) => ((...args: A) => R | undefined) | undefined;
    useEventCallback: <A extends unknown[], R>(callback: (...args: A) => R) => (...args: A) => R;
    initializeEventCallbacks: () => void;
    isEditableElement: (element: EventTarget | null | undefined) => boolean;
    measureVisualKeyboard: (windowObject: Window) => VisualKeyboardMetrics | null;
    useVisualKeyboard: (enabled: boolean, onKeyboardChange: (keyboard: VisualKeyboardMetrics | null) => void, options?: { unpan?: boolean }) => void;
    EDITABLE_ELEMENT_SELECTOR: string;
    KEYBOARD_MINIMUM_HEIGHT: number;
    VIEWPORT_SCALE_TOLERANCE: number;
    initializeVisualKeyboard: () => void;
    useMobileSheetMediaQuery: () => boolean;
    usePresentationMode: () => string;
    useCoarsePresentation: () => boolean;
    sheetContentCanGrow: (element: Element) => boolean;
    hasEditableSheetContent: (element: Element) => boolean;
    shouldUseSheetPresentation: (mode: string, anchored: boolean, mobileCoarsePointer: boolean) => boolean;
    usePresentationWhileShowing: (presentation: boolean, open: boolean, showing: boolean) => boolean;
    useOverlayShowing: (open: boolean) => { showing: boolean; onOpenChangeComplete: (open: boolean) => void };
    useValueCapturedOnOpen: <T>(open: boolean, readValue: () => T, defaultValue: T) => T;
    presentationModeContext: Context<string>;
    SHEET_DRILLED_ATTRIBUTE: string;
    SHEET_COVERED_ATTRIBUTE: string;
    SHEET_PEELING_ATTRIBUTE: string;
    SHEET_TREE_CLOSING_ATTRIBUTE: string;
    SHEET_SCROLL_ATTRIBUTE: string;
    SHEET_PRESSED_ATTRIBUTE: string;
    SHEET_CONTROL_HELD_ATTRIBUTE: string;
    OVERLAY_CLOSE_FALLBACK_MS: number;
    initializePresentationMode: () => void;
    getInertProps: (inert: boolean) => InertProps;
    reactMajorVersion: number;
    supportsBooleanInert: boolean;
    initializeInertProps: () => void;
    useForwardedOverlayActions: (internalActionsRef: RefObject<OverlayActions | null>, forwardedActionsRef: Ref<OverlayActions> | undefined) => void;
    initializeOverlayActions: () => void;
    createMutableValue: <T>() => MutableValue<T | null>;
    getSheetFrameHeight: (frame: Pick<SheetFrame, "detent" | "height"> | null, windowObject: Window | undefined, element: Element | null | undefined) => number | undefined;
    getStackedSheetHeight: (levels: readonly SheetLevel[]) => number | undefined;
    useSheetFrame: (open: boolean, forwardedActionsRef: Ref<OverlayActions> | undefined, onOpenChangeComplete: ((open: boolean) => void) | undefined, close: (() => void) | undefined) => SheetFrameState;
    useIsSheet: () => boolean;
    useSheetState: () => AdaptiveSheetState;
    isLiveRegionEvent: (event: Pick<Event, "target"> | undefined) => boolean;
    useAdaptiveSheet: (props: AdaptiveSheetProps) => AdaptiveSheet;
    ResetSheetContexts: (props: { children?: ReactNode }) => ReactNode;
    FloatingPositionRenderProp: (props: AdaptiveSheetProps & { children: (sheet: AdaptiveSheet) => ReactNode; }) => ReactNode;
    SheetContextProvider: (props: SheetProviderProps) => ReactNode;
    useControllableOpen: (props: ControllableOpenProps) => ControllableOpen;
    useHasSheetFrame: () => boolean;
    useSheetCapablePresentation: () => boolean;
    useSheetImplementation: () => SheetImplementation | null;
    getStackedSheetCanGrow: (levels: readonly SheetLevel[]) => boolean;
    sheetParentContext: Context<SheetParent | null>;
    inertElementProps: InertProps;
    SHEET_IMPLEMENTATION_WAIT_MS: number;
    sheetImplementationUnavailable: boolean;
    sheetImplementationWaiters: Set<() => void>;
    ambientCloseReasons: Set<string>;
    SHEET_UNCOVER_CLOSE_GRACE_MS: number;
    LIVE_REGION_SELECTOR: string;
    defaultSheetState: AdaptiveSheetState;
    emptySheetRef: (element: HTMLElement | null) => void;
    defaultSheetHost: SheetHost;
    concealedSheetHost: SheetHost;
    sheetCoverContext: Context<SheetStack["cover"] | null>;
    initializeAdaptiveSheets: () => void;
    isReducedMotion: () => boolean;
    REDUCED_MOTION_QUERY: string;
    REDUCED_MOTION_ATTRIBUTE: string;
    initializeReducedMotion: () => void;
    SHEET_DURATION_CLASS: string;
    sheetTransitionClasses: string;
    sheetRadiusClasses: string;
    sheetPopupClasses: string;
    SHEET_DISMISS_TRANSLATE_CSS: string;
    sheetDrillBodyClasses: string;
    sheetBackdropClasses: string;
    transparentSheetBackdropClasses: string;
    sheetOverflowBackgroundClasses: string;
    sheetClipClasses: string;
    sheetSeparatorClasses: string;
    initializeSheetClassNames: () => void;
    resetSheetDragStyle: (input: HTMLElement) => void;
    useSheetDrag: () => SheetDragHandlers;
    initializeSheetDrag: () => void;
    THEME_TOKEN_SCHEMA_DESCRIPTION: string;
    typographyScaleNames: string[];
    typographyWeightNames: string[];
    themeTokenKeys: ThemeTokenKeys;
    themeTokenManifest: ThemeTokenManifest;
    initializeThemeTokenManifest: () => void;
  }
}

export function installUiFoundation(runtime: RuntimeBindings): () => void {
  var accentColorNames: string[];
  var initializeAccentColors: () => void;
  var reactMediaQuery: ReactNamespace;
  var MOBILE_COARSE_POINTER_QUERY: string;
  var mediaQueryStores: WeakMap<Window, Map<string, MediaQueryStore>>;
  var subscribeNoop: ExternalStore<boolean>["subscribe"];
  var getFalseSnapshot: () => boolean;
  var COARSE_POINTER_QUERY_rG: string;
  var initializeMediaQueryStores: () => void;
  var coarsePointerStores: WeakMap<Window, CoarsePointerStore>;
  var initializeCoarsePointerStores: () => void;
  var initializeErrorReporting: () => void;
  var initializeSafeObservers: () => void;
  var reactDocumentFont: ReactNamespace;
  var supportedFonts: Record<string, boolean>;
  var isSupportedFont: (font: string) => boolean;
  var readDocumentFont: () => string | undefined;
  var subscribeFontNoop: ExternalStore<string | undefined>["subscribe"];
  var getUndefinedFontSnapshot: () => undefined;
  var initializeDocumentFont: () => void;
  var reactFeatureFlags: ReactNamespace;
  var featureFlagContext: Context<string | undefined>;
  var initializeFeatureFlags: () => void;
  var inputDismissalStates: WeakMap<Document, InputDismissalState>;
  var dismissalKeys: Set<string>;
  var initializeInputDismissalTracking: () => void;
  var transitionRunner: TransitionRunner | undefined;
  var initializeTransitionRunner: () => void;
  var reactIsomorphicLayoutEffect: ReactNamespace;
  var useIsomorphicLayoutEffect: ReactNamespace["useLayoutEffect"];
  var initializeIsomorphicLayoutEffect: () => void;
  var initializeResizeObserverAccess: () => void;
  var reactAndroidCloseWatcher: ReactNamespace;
  var initializeAndroidCloseWatcher: () => void;
  var sheetDragSettings: SheetDragSettings;
  var initializeSheetDragSettings: () => void;
  var SAFE_AREA_TOP_CSS: string;
  var VIEWPORT_HEIGHT_EXCLUDING_SAFE_AREA_CSS: string;
  var baseSheetPositionerStyle: CSSProperties;
  var sheetPositioningOverrides: SheetPositioningOverrides;
  var MAX_SHEET_HEIGHT_FRACTION: number;
  var MAX_SHEET_HEIGHT_CSS: string;
  var MAX_SHEET_OVERSHOOT_HEIGHT_CSS: string;
  var SHEET_DENSITY: string;
  var MIN_SHEET_HEIGHT_FRACTION: number;
  var MIN_SHEET_HEIGHT_CSS: string;
  var initializeSheetStyles: () => void;
  var initializeElementAccess: () => void;
  var reactEventCallbacks: ReactNamespace;
  var initializeEventCallbacks: () => void;
  var reactVisualKeyboard: ReactNamespace;
  var EDITABLE_ELEMENT_SELECTOR: string;
  var KEYBOARD_MINIMUM_HEIGHT: number;
  var VIEWPORT_SCALE_TOLERANCE: number;
  var initializeVisualKeyboard: () => void;
  var reactPresentationMode: ReactNamespace;
  var presentationModeContext: Context<string>;
  var SHEET_DRILLED_ATTRIBUTE: string;
  var SHEET_COVERED_ATTRIBUTE: string;
  var SHEET_PEELING_ATTRIBUTE: string;
  var SHEET_TREE_CLOSING_ATTRIBUTE: string;
  var SHEET_SCROLL_ATTRIBUTE: string;
  var SHEET_PRESSED_ATTRIBUTE: string;
  var SHEET_CONTROL_HELD_ATTRIBUTE: string;
  var OVERLAY_CLOSE_FALLBACK_MS: number;
  var initializePresentationMode: () => void;
  var reactInertProps: ReactNamespace;
  var reactMajorVersion: number;
  var supportsBooleanInert: boolean;
  var initializeInertProps: () => void;
  var reactOverlayActions: ReactNamespace;
  var initializeOverlayActions: () => void;
  var reactAdaptiveSheets: ReactNamespace;
  var jsxAdaptiveSheets: JsxNamespace;
  var sheetFrameContext: Context<SheetFrame | null>;
  var getStackedSheetCanGrow: (levels: readonly SheetLevel[]) => boolean;
  var sheetParentContext: Context<SheetParent | null>;
  var sheetStateContext: Context<{ sheet: boolean; pending: boolean; covered: boolean; inert: boolean; depth: number }>;
  var inertElementProps: InertProps;
  var SHEET_IMPLEMENTATION_WAIT_MS: number;
  var sheetImplementationUnavailable: boolean;
  var sheetImplementationWaiters: Set<() => void>;
  var ambientCloseReasons: Set<string>;
  var SHEET_UNCOVER_CLOSE_GRACE_MS: number;
  var LIVE_REGION_SELECTOR: string;
  var defaultSheetState: AdaptiveSheetState;
  var emptySheetRef: (element: HTMLElement | null) => void;
  var defaultSheetHost: SheetHost;
  var concealedSheetHost: SheetHost;
  var sheetCoverContext: Context<SheetStack["cover"] | null>;
  var initializeAdaptiveSheets: () => void;
  var reactReducedMotion: ReactNamespace;
  var REDUCED_MOTION_QUERY: string;
  var REDUCED_MOTION_ATTRIBUTE: string;
  var initializeReducedMotion: () => void;
  var SHEET_DURATION_CLASS: string;
  var sheetTransitionClasses: string;
  var sheetRadiusClasses: string;
  var sheetPopupClasses: string;
  var SHEET_DISMISS_TRANSLATE_CSS: string;
  var sheetDrillBodyClasses: string;
  var sheetBackdropClasses: string;
  var transparentSheetBackdropClasses: string;
  var sheetOverflowBackgroundClasses: string;
  var sheetClipClasses: string;
  var sheetSeparatorClasses: string;
  var initializeSheetClassNames: () => void;
  var reactSheetDrag: ReactNamespace;
  var initializeSheetDrag: () => void;
  var THEME_TOKEN_SCHEMA_DESCRIPTION: string;
  var typographyScaleNames: string[];
  var typographyWeightNames: string[];
  var themeTokenKeys: ThemeTokenKeys;
  var themeTokenManifest: ThemeTokenManifest;
  var initializeThemeTokenManifest: () => void;
  function getMediaQueryStore(
    windowObject: Window,
    query: string,
  ): MediaQueryStore | null {
    if (typeof windowObject.matchMedia !== "function") {
      return null;
    }
    let windowStores = mediaQueryStores.get(windowObject);
    if (windowStores === undefined) {
      windowStores = new Map();
      mediaQueryStores.set(windowObject, windowStores);
    }
    let store = windowStores.get(query);
    if (store === undefined) {
      let value = windowObject.matchMedia(query);
      store = {
        subscribe: (input: () => void) => {
          value.addEventListener("change", input);
          return () => value.removeEventListener("change", input);
        },
        getSnapshot: () => value.matches,
      };
      windowStores.set(query, store);
    }
    return store;
  }
  function useMediaQuery__U(
    windowObject: Window | null | undefined,
    query: string,
  ): boolean {
    let store =
      windowObject === null || windowObject === undefined
        ? null
        : getMediaQueryStore(windowObject, query);
    return reactMediaQuery.useSyncExternalStore(
      store === null ? subscribeNoop : store.subscribe,
      store === null ? getFalseSnapshot : store.getSnapshot,
      getFalseSnapshot,
    );
  }
  function resolveWindow(windowOverride?: Window): Window | undefined {
    return (
      windowOverride ?? (typeof window === "undefined" ? undefined : window)
    );
  }
  function addMediaQueryListener(
    mediaQuery: MediaQueryList,
    listener: () => void,
  ): void {
    mediaQuery.addEventListener?.("change", listener);
  }
  function removeMediaQueryListener(
    mediaQuery: MediaQueryList,
    listener: () => void,
  ): void {
    mediaQuery.removeEventListener?.("change", listener);
  }
  function notifySubscribers(subscribers: Set<() => void>): void {
    let errors: unknown[] = [];
    for (let value of Array.from<() => void>(subscribers))
      try {
        if (subscribers.has(value)) {
          value();
        }
      } catch (value2) {
        errors.push(value2);
      }
    if (errors.length > 0) {
      throw errors[0];
    }
  }
  function createCoarsePointerStore(
    windowObject: Window,
    previousStore?: CoarsePointerStore,
  ): CoarsePointerStore {
    let subscribers = previousStore?.subscribers ?? new Set<() => void>(),
      mediaQuery = windowObject.matchMedia(COARSE_POINTER_QUERY_rG),
      store: CoarsePointerStore = {
        source: windowObject.matchMedia,
        list: mediaQuery,
        coarse: mediaQuery.matches,
        subscribers: subscribers,
        onListChange: () => {
          store.coarse = mediaQuery.matches;
          notifySubscribers(subscribers);
        },
      };
    if (subscribers.size > 0) {
      if (previousStore !== undefined) {
        removeMediaQueryListener(
          previousStore.list,
          previousStore.onListChange,
        );
      }
      addMediaQueryListener(mediaQuery, store.onListChange);
      if (
        previousStore !== undefined &&
        previousStore.coarse !== store.coarse
      ) {
        queueMicrotask(() => notifySubscribers(subscribers));
      }
    } else {
      queueMicrotask(() => {
        if (
          subscribers.size === 0 &&
          coarsePointerStores.get(windowObject) === store
        ) {
          coarsePointerStores.delete(windowObject);
        }
      });
    }
    coarsePointerStores.set(windowObject, store);
    return store;
  }
  function getCoarsePointerSnapshot(windowOverride?: Window): boolean {
    let windowObject = resolveWindow(windowOverride);
    if (typeof windowObject?.matchMedia !== "function") {
      return false;
    }
    let store = coarsePointerStores.get(windowObject);
    if (store === undefined || store.source !== windowObject.matchMedia) {
      return createCoarsePointerStore(windowObject, store).coarse;
    }
    if (store.subscribers.size === 0) {
      store.coarse = store.list.matches;
    }
    return store.coarse;
  }
  function subscribeCoarsePointer(
    listener: () => void,
    windowOverride?: Window,
  ): () => void {
    let windowObject = resolveWindow(windowOverride);
    if (typeof windowObject?.matchMedia !== "function") {
      return () => {
        return;
      };
    }
    let previousStore = coarsePointerStores.get(windowObject),
      store =
        previousStore !== undefined &&
        previousStore.source === windowObject.matchMedia
          ? previousStore
          : createCoarsePointerStore(windowObject, previousStore),
      { subscribers: subscribers } = store;
    if (subscribers.size === 0) {
      addMediaQueryListener(store.list, store.onListChange);
      store.coarse = store.list.matches;
    }
    let notify = () => listener();
    subscribers.add(notify);
    return () => {
      if (!subscribers.delete(notify) || subscribers.size > 0) {
        return;
      }
      let entry = coarsePointerStores.get(windowObject);
      if (entry?.subscribers === subscribers) {
        removeMediaQueryListener(entry.list, entry.onListChange);
        coarsePointerStores.delete(windowObject);
      }
    };
  }
  function reportAsyncError(input: unknown): void {
    if (typeof reportError === "function") {
      reportError(input);
    } else {
      queueMicrotask(() => {
        throw input;
      });
    }
  }
  function invokeAndReportError(input: () => void): void {
    try {
      input();
    } catch (value) {
      reportAsyncError(value);
    }
  }
  function createSafeObserver<T>(
    constructObserver: () => T,
  ): SafeObserver<T> {
    let reported = false,
      reportOnce = (input: unknown) => {
        if (!reported) {
          reported = true;
          reportAsyncError(input);
        }
      },
      observer: T | null = null;
    try {
      observer = constructObserver();
    } catch (value) {
      reportOnce(value);
    }
    return {
      observer: observer,
      attempt(input: (observer: T) => void) {
        if (observer === null) {
          return false;
        }
        try {
          input(observer);
          return true;
        } catch (value) {
          reportOnce(value);
          return false;
        }
      },
    };
  }
  function createSafeResizeObserver(
    ObserverConstructor: typeof ResizeObserver,
    callback: ResizeObserverCallback,
  ): SafeResizeObserver {
    let safeObserver = createSafeObserver(
      () => new ObserverConstructor(callback),
    );
    return {
      observe: (input: Element, options?: ResizeObserverOptions) =>
        safeObserver.attempt(
          (input2) =>
            options === undefined
              ? input2.observe(input)
              : input2.observe(input, options),
        ),
      unobserve: (input: Element) =>
        safeObserver.observer?.unobserve(input),
      disconnect: () => safeObserver.observer?.disconnect(),
    };
  }
  function createSafeMutationObserver(
    ObserverConstructor: typeof MutationObserver,
    callback: MutationCallback,
  ): SafeMutationObserver {
    let safeObserver = createSafeObserver(
      () => new ObserverConstructor(callback),
    );
    return {
      observe: (input: Node, options?: MutationObserverInit) =>
        safeObserver.attempt(
          (input2) => input2.observe(input, options),
        ),
      disconnect: () => safeObserver.observer?.disconnect(),
      takeRecords: () => safeObserver.observer?.takeRecords() ?? [],
    };
  }
  function createFontAttributeStore(): ExternalStore<string | undefined> {
    let value: string | undefined,
      flag = false,
      callback = () => {
        let value2 = value;
        value = readDocumentFont();
        flag = true;
        return value !== value2;
      };
    return {
      subscribe: (input: () => void) => {
        if (typeof MutationObserver === "undefined") {
          return () => {
            return;
          };
        }
        let value2 = createSafeMutationObserver(
          MutationObserver,
          () => {
            if (callback()) {
              input();
            }
          },
        );
        value2.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["data-font"],
        });
        if (callback()) {
          queueMicrotask(input);
        }
        return () => {
          value2.disconnect();
          flag = false;
        };
      },
      getSnapshot: () => {
        if (!flag) {
          callback();
        }
        return value;
      },
    };
  }
  function useDocumentFont(enabled: boolean): string | undefined {
    let [store] = reactDocumentFont.useState(createFontAttributeStore);
    return reactDocumentFont.useSyncExternalStore(
      enabled ? store.subscribe : subscribeFontNoop,
      enabled ? store.getSnapshot : getUndefinedFontSnapshot,
      getUndefinedFontSnapshot,
    );
  }
  function useFeatureFlagAttribute(): string | undefined {
    return reactFeatureFlags.useContext(featureFlagContext);
  }
  function mergeFeatureFlagNames(
    existingNames: string | undefined,
    additionalNames: readonly string[] | undefined,
  ): string | undefined {
    if (!additionalNames?.length) {
      return existingNames;
    }
    let names = new Set(existingNames?.split(" "));
    for (let value of additionalNames) names.add(value);
    return [...names].sort().join(" ");
  }
  function registerInputDismissalTracking(
    documentObject: Document | undefined,
  ): void {
    if (
      documentObject === undefined ||
      inputDismissalStates.has(documentObject)
    ) {
      return;
    }
    let inputState = {
      observedInput: false,
      lastInputDismissing: false,
    };
    inputDismissalStates.set(documentObject, inputState);
    let eventTarget: Pick<Document, "addEventListener"> =
      documentObject.defaultView ?? documentObject;
    eventTarget.addEventListener(
      "keydown",
      (input: KeyboardEvent) => {
        if (!input.isTrusted) {
          return;
        }
        inputState.observedInput = true;
        inputState.lastInputDismissing =
          !input.isComposing && dismissalKeys.has(input.key);
      },
      true,
    );
    eventTarget.addEventListener(
      "pointerdown",
      (input: PointerEvent) => {
        if (!input.isTrusted) {
          return;
        }
        inputState.observedInput = true;
        inputState.lastInputDismissing = true;
      },
      true,
    );
    documentObject.defaultView?.addEventListener("blur", () => {
      inputState.observedInput = false;
      inputState.lastInputDismissing = false;
    });
  }
  function trackInputForElement(element: Element | null | undefined): void {
    registerInputDismissalTracking(element?.ownerDocument);
  }
  function isInputTriggeredBlur(event: FocusEvent): boolean {
    if (event.relatedTarget !== null && event.relatedTarget !== undefined) {
      return false;
    }
    let ownerDocument = (event.target as Node | null)?.ownerDocument ?? undefined,
      inputState =
        ownerDocument === undefined || ownerDocument === null
          ? undefined
          : inputDismissalStates.get(ownerDocument);
    if (inputState === undefined || !inputState.observedInput) {
      return false;
    }
    return inputState.lastInputDismissing;
  }
  function runWithTransition<T>(
    input: string,
    options: () => Promise<T>,
  ): Promise<T> {
    try {
      if (transitionRunner) {
        return Promise.resolve(transitionRunner(input, options));
      } else {
        return options();
      }
    } catch (value) {
      return Promise.reject(
        value instanceof Error ? value : Error(String(value)),
      );
    }
  }
  function getResizeObserverConstructor(
    element: Element | null | undefined,
  ): typeof ResizeObserver | undefined {
    return element?.ownerDocument.defaultView?.ResizeObserver;
  }
  function isAndroidWindow(windowObject: Window): boolean {
    let navigator2: AndroidNavigator = windowObject.navigator,
      platform = navigator2.userAgentData?.platform ?? "";
    return (
      /android/i.test(platform) || /android/i.test(navigator2.userAgent ?? "")
    );
  }
  function useAndroidCloseWatcher(
    enabled: boolean,
    onClose: (() => void) | undefined,
  ): void {
    let windowObject: CloseWatcherWindow | undefined = (0,
    runtime.useRootWindow)();
    reactAndroidCloseWatcher.useEffect(() => {
      if (!enabled || windowObject === undefined || onClose === undefined) {
        return;
      }
      let CloseWatcher = windowObject.CloseWatcher;
      if (CloseWatcher === undefined || !isAndroidWindow(windowObject)) {
        return;
      }
      let value: CloseWatcherLike | null = null,
        flag = false,
        callback = () => {
          try {
            value = new CloseWatcher();
          } catch {
            value = null;
            return;
          }
          value.onclose = () => {
            onClose();
            windowObject.addEventListener("pointerup", callback2, {
              capture: true,
              once: true,
            });
            windowObject.addEventListener("keydown", callback2, {
              capture: true,
              once: true,
            });
          };
        },
        callback2 = () => {
          windowObject.removeEventListener("pointerup", callback2, {
            capture: true,
          });
          windowObject.removeEventListener("keydown", callback2, {
            capture: true,
          });
          if (!flag) {
            value?.destroy();
            callback();
          }
        };
      callback();
      return () => {
        flag = true;
        windowObject.removeEventListener("pointerup", callback2, {
          capture: true,
        });
        windowObject.removeEventListener("keydown", callback2, {
          capture: true,
        });
        value?.destroy();
      };
    }, [enabled, windowObject, onClose]);
  }
  function rubberBandDistance(
    distance: number,
    overshootRoom: number,
  ): number {
    if (distance <= 0 || overshootRoom <= 0) {
      return 0;
    }
    return (
      (1 -
        1 / ((distance * sheetDragSettings.rubberBand) / overshootRoom + 1)) *
      overshootRoom
    );
  }
  function inverseRubberBandDistance(
    distance: number,
    overshootRoom: number,
  ): number {
    if (distance <= 0 || overshootRoom <= 0) {
      return 0;
    }
    return (
      ((1 / (1 - Math.min(distance, overshootRoom * 0.9) / overshootRoom) - 1) *
        overshootRoom) /
      sheetDragSettings.rubberBand
    );
  }
  function calculateSheetBounds(
    restHeight: number,
    availableHeight: number,
    maximumHeightFraction: number,
    canGrow: boolean = true,
  ): SheetBounds {
    let maximumHeight = Math.max(
        availableHeight * maximumHeightFraction,
        restHeight,
      ),
      tallHeight =
        !canGrow ||
        maximumHeight - restHeight < sheetDragSettings.detentThreshold
          ? restHeight
          : maximumHeight;
    return {
      rest: restHeight,
      tall: tallHeight,
      room: Math.max(
        0,
        (availableHeight - tallHeight) * sheetDragSettings.overshootRoom,
      ),
    };
  }
  function hasTallSheetDetent(bounds: SheetBounds): boolean {
    return bounds.tall > bounds.rest;
  }
  function calculateSheetDragGeometry(
    bounds: SheetBounds,
    rawHeight: number,
  ): SheetDragGeometry {
    if (rawHeight > bounds.tall) {
      return {
        height:
          bounds.tall +
          rubberBandDistance(rawHeight - bounds.tall, bounds.room),
        slide: 0,
        shown: 1,
      };
    }
    if (rawHeight >= bounds.rest) {
      return {
        height: rawHeight,
        slide: 0,
        shown: 1,
      };
    }
    let slide = bounds.rest - rawHeight;
    return {
      height: bounds.rest,
      slide: slide,
      shown: 1 - Math.min(1, slide / Math.max(1, bounds.rest)),
    };
  }
  function recoverRawSheetHeight(
    bounds: SheetBounds,
    height: number,
    slide: number,
  ): number {
    if (height > bounds.tall) {
      return (
        bounds.tall +
        inverseRubberBandDistance(height - bounds.tall, bounds.room)
      );
    }
    return Math.min(height, bounds.tall) - Math.max(0, slide);
  }
  function determineSheetRelease(
    bounds: SheetBounds,
    release: SheetRelease,
  ): SheetReleaseOutcome {
    let { slide: slide } = calculateSheetDragGeometry(
        bounds,
        release.rawAtRelease,
      ),
      dismiss =
        release.commit &&
        slide > 0 &&
        (slide - release.caughtSlide >
          bounds.rest * sheetDragSettings.dismissFraction ||
          (release.detent === "default" &&
            release.velocity > sheetDragSettings.flingVelocity));
    if (!release.commit || dismiss) {
      return {
        dismiss: dismiss,
        detent: release.detent,
      };
    }
    if (release.rawAtGrab > bounds.rest && release.rawAtGrab < bounds.tall) {
      let value = release.rawAtRelease - release.rawAtGrab;
      if (
        value > sheetDragSettings.detentThreshold &&
        hasTallSheetDetent(bounds)
      ) {
        return {
          dismiss: false,
          detent: "tall",
        };
      }
      if (value < -sheetDragSettings.detentThreshold) {
        return {
          dismiss: false,
          detent: "default",
        };
      }
      return {
        dismiss: false,
        detent: release.detent,
      };
    }
    if (
      release.detent === "default" &&
      hasTallSheetDetent(bounds) &&
      release.rawAtRelease > bounds.rest + sheetDragSettings.detentThreshold
    ) {
      return {
        dismiss: false,
        detent: "tall",
      };
    }
    if (
      release.detent === "tall" &&
      release.rawAtRelease < bounds.tall - sheetDragSettings.detentThreshold
    ) {
      return {
        dismiss: false,
        detent: "default",
      };
    }
    return {
      dismiss: false,
      detent: release.detent,
    };
  }
  function getSheetPositionerStyle(
    frame: Pick<SheetFrame, "keyboard"> | null | undefined,
  ): CSSProperties {
    let keyboardInset = frame?.keyboard?.inset ?? 0;
    if (keyboardInset > 0) {
      return {
        ...baseSheetPositionerStyle,
        bottom: keyboardInset,
      };
    } else {
      return baseSheetPositionerStyle;
    }
  }
  function getSheetAvailableHeight(
    windowObject: Window,
    sheetElement: Element | null | undefined,
  ): number {
    let positioner = sheetElement?.parentElement;
    if (positioner === null || positioner === undefined) {
      return windowObject.innerHeight;
    }
    let topMargin = Number.parseFloat(
      windowObject.getComputedStyle(positioner)?.scrollMarginTop ?? "",
    );
    if (topMargin > 0) {
      return Math.max(0, windowObject.innerHeight - topMargin);
    } else {
      return windowObject.innerHeight;
    }
  }
  function getSheetMinimumHeight(
    viewportHeight: number,
    hasHalfHeightFloor: boolean,
  ): number {
    if (hasHalfHeightFloor) {
      return viewportHeight * MIN_SHEET_HEIGHT_FRACTION;
    } else {
      return 0;
    }
  }
  function getSheetPopupStyle(
    frame: Pick<SheetFrame, "keyboard" | "height" | "detent"> | null | undefined,
    {
      floor: floor,
      parentFrameHeight: parentFrameHeight,
    }: SheetPopupStyleOptions,
  ): SheetPopupStyle {
    let keyboard = frame?.keyboard ?? null,
      minimumHeightCss =
        floor === "half"
          ? `min(${MIN_SHEET_HEIGHT_CSS}, ${MAX_SHEET_HEIGHT_CSS})`
          : "0px";
    return {
      ["--available-height"]: MAX_SHEET_HEIGHT_CSS,
      width: "100%",
      maxWidth: "none",
      minWidth: 0,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      paddingBottom: keyboard !== null ? "0.5rem" : undefined,
      minHeight:
        keyboard !== null
          ? undefined
          : parentFrameHeight !== undefined
            ? `max(${minimumHeightCss}, ${parentFrameHeight}px)`
            : floor === "half"
              ? minimumHeightCss
              : undefined,
      maxHeight:
        keyboard !== null
          ? `calc(${keyboard.visible}px - ${SAFE_AREA_TOP_CSS} - 8px)`
          : frame?.height !== undefined
            ? MAX_SHEET_OVERSHOOT_HEIGHT_CSS
            : floor === "half"
              ? minimumHeightCss
              : MAX_SHEET_HEIGHT_CSS,
      height:
        frame?.detent === "tall"
          ? MAX_SHEET_HEIGHT_CSS
          : frame?.height !== undefined
            ? `${frame.height}px`
            : undefined,
    };
  }
  function asElement<E extends Element = HTMLElement>(
    node: unknown,
  ): E | null {
    if ((node as Node | null | undefined)?.nodeType === 1) {
      return node as E;
    } else {
      return null;
    }
  }
  function createRequiredRefCallback<A extends unknown[], R>(input: {
    current: (...args: A) => R;
  }): (...args: A) => R {
    return (...input2: A) => input.current(...input2);
  }
  function createOptionalRefCallback<A extends unknown[], R>(input: {
    current: ((...args: A) => R) | undefined;
  }): (...args: A) => R | undefined {
    return (...input2: A) => input.current?.(...input2);
  }
  function useOptionalEventCallback<A extends unknown[], R>(
    callback: ((...args: A) => R) | undefined,
  ): ((...args: A) => R | undefined) | undefined {
    let callbackRef = reactEventCallbacks.useRef(callback);
    reactEventCallbacks.useInsertionEffect(() => {
      callbackRef.current = callback;
    }, [callback]);
    let [stableCallback] = reactEventCallbacks.useState(
      () => createOptionalRefCallback(callbackRef),
    );
    if (callback === undefined) {
      return undefined;
    } else {
      return stableCallback;
    }
  }
  function useEventCallback<A extends unknown[], R>(
    callback: (...args: A) => R,
  ): (...args: A) => R {
    let callbackRef = reactEventCallbacks.useRef(callback);
    reactEventCallbacks.useInsertionEffect(() => {
      callbackRef.current = callback;
    }, [callback]);
    let [stableCallback] = reactEventCallbacks.useState(
      () => createRequiredRefCallback(callbackRef),
    );
    return stableCallback;
  }
  function isEditableElement(element: EventTarget | null | undefined): boolean {
    if (element === null || element === undefined) {
      return false;
    }
    if (
      (element as Element).matches(
        'input:not([type=button],[type=checkbox],[type=radio],[type=range],[type=submit],[type=reset],[type=color],[type=file],[type=image],[type=hidden],[readonly]), textarea:not([readonly]), [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]',
      )
    ) {
      return true;
    }
    return asElement(element)?.isContentEditable === true;
  }
  function measureVisualKeyboard(
    windowObject: Window,
  ): VisualKeyboardMetrics | null {
    let viewport = windowObject.visualViewport;
    if (viewport === undefined || viewport === null) {
      return null;
    }
    if (Math.abs((viewport.scale ?? 1) - 1) > VIEWPORT_SCALE_TOLERANCE) {
      return null;
    }
    let documentHeight =
      windowObject.document.documentElement.clientHeight;
    return {
      inset: Math.max(
        0,
        Math.round(documentHeight - (viewport.offsetTop + viewport.height)),
      ),
      visible: Math.round(viewport.height),
      offset: Math.max(0, Math.round(viewport.offsetTop)),
    };
  }
  function useVisualKeyboard(
    enabled: boolean,
    onKeyboardChange: (keyboard: VisualKeyboardMetrics | null) => void,
    { unpan = false }: { unpan?: boolean } = {},
  ): void {
    let windowObject: Window | undefined = (0, runtime.useRootWindow)(),
      notifyKeyboardChange = useEventCallback(onKeyboardChange);
    reactVisualKeyboard.useEffect(() => {
      if (!enabled || windowObject === undefined) {
        return;
      }
      let visualViewport = windowObject.visualViewport;
      if (visualViewport === undefined || visualViewport === null) {
        return;
      }
      let value: VisualKeyboardMetrics | null = null,
        flag = false,
        index = 0,
        callback = () => {
          index = 0;
          let value2 = measureVisualKeyboard(windowObject),
            clientHeight =
              windowObject.document.documentElement.clientHeight,
            value3 =
              value2 !== null &&
              value2.visible < clientHeight - KEYBOARD_MINIMUM_HEIGHT,
            value4 = value3 ? value2 : null;
          if (
            value4?.inset !== value?.inset ||
            value4?.visible !== value?.visible ||
            value4?.offset !== value?.offset
          ) {
            value = value4;
            notifyKeyboardChange(value4);
          }
          if (unpan && value3 && !flag && visualViewport.offsetTop > 0) {
            flag = true;
            windowObject.document.documentElement.scrollIntoView({
              block: "start",
              inline: "start",
              behavior: "instant",
            });
            windowObject.scrollTo({
              top: 0,
              left: 0,
              behavior: "instant",
            });
          }
          if (!value3) {
            flag = false;
          }
        },
        callback2 = () => {
          if (index === 0) {
            index = windowObject.requestAnimationFrame(callback);
          }
        };
      callback();
      visualViewport.addEventListener("resize", callback2);
      visualViewport.addEventListener("scroll", callback2);
      return () => {
        visualViewport.removeEventListener("resize", callback2);
        visualViewport.removeEventListener("scroll", callback2);
        if (index !== 0) {
          windowObject.cancelAnimationFrame(index);
        }
        notifyKeyboardChange(null);
      };
    }, [enabled, windowObject, notifyKeyboardChange, unpan]);
  }
  function useMobileSheetMediaQuery(): boolean {
    return useMediaQuery__U(
      (0, runtime.useRootWindow)(),
      MOBILE_COARSE_POINTER_QUERY,
    );
  }
  function usePresentationMode(): string {
    return reactPresentationMode.useContext(presentationModeContext);
  }
  function useCoarsePresentation(): boolean {
    let presentationMode = usePresentationMode(),
      windowObject: Window | undefined = (0, runtime.useRootWindow)(),
      coarsePointer = reactPresentationMode.useSyncExternalStore(
        subscribeNoop,
        () =>
          windowObject !== undefined &&
          (getMediaQueryStore(
            windowObject,
            "(pointer: coarse)",
          )?.getSnapshot() ??
            false),
        getFalseSnapshot,
      );
    return presentationMode === "sheet" || coarsePointer;
  }
  function sheetContentCanGrow(element: Element): boolean {
    if (hasEditableSheetContent(element)) {
      return true;
    }
    for (let value of Array.from<HTMLElement>(
      element.querySelectorAll<HTMLElement>(`[${SHEET_SCROLL_ATTRIBUTE}]`),
    ))
      if (value.scrollHeight > value.clientHeight + 1) {
        return true;
      }
    return false;
  }
  function hasEditableSheetContent(element: Element): boolean {
    return element.querySelector(EDITABLE_ELEMENT_SELECTOR) !== null;
  }
  function shouldUseSheetPresentation(
    mode: string,
    anchored: boolean,
    mobileCoarsePointer: boolean,
  ): boolean {
    if (anchored) {
      return false;
    }
    if (mode !== "auto") {
      return mode === "sheet";
    }
    return mobileCoarsePointer;
  }
  function usePresentationWhileShowing(
    presentation: boolean,
    open: boolean,
    showing: boolean,
  ): boolean {
    let [capturedPresentation, setCapturedPresentation] =
        reactPresentationMode.useState(presentation),
      [previousOpen, setPreviousOpen] =
        reactPresentationMode.useState(open);
    if (open !== previousOpen) {
      setPreviousOpen(open);
      if (open) {
        setCapturedPresentation(presentation);
        return presentation;
      }
    }
    if (showing) {
      return capturedPresentation;
    } else {
      return presentation;
    }
  }
  function useOverlayShowing(open: boolean): {
    showing: boolean;
    onOpenChangeComplete: (open: boolean) => void;
  } {
    let [wasShowing, setWasShowing] =
      reactPresentationMode.useState(open);
    if (open && !wasShowing) {
      setWasShowing(true);
    }
    let onOpenChangeComplete = reactPresentationMode.useCallback(
      (input: boolean) => {
        if (!input) {
          setWasShowing(false);
        }
      },
      [],
    );
    reactPresentationMode.useEffect(() => {
      if (open || !wasShowing) {
        return;
      }
      let value = setTimeout(() => {
        setWasShowing(false);
      }, OVERLAY_CLOSE_FALLBACK_MS);
      return () => {
        clearTimeout(value);
      };
    }, [open, wasShowing]);
    return {
      showing: open || wasShowing,
      onOpenChangeComplete: onOpenChangeComplete,
    };
  }
  function useValueCapturedOnOpen<T>(
    open: boolean,
    readValue: () => T,
    defaultValue: T,
  ): T {
    let [capturedState, setCapturedState] =
        reactPresentationMode.useState(
          () => ({
            wasOpen: open,
            value: open ? readValue() : defaultValue,
          }),
        ),
      readValueRef = reactPresentationMode.useRef(readValue);
    useIsomorphicLayoutEffect(() => {
      readValueRef.current = readValue;
    });
    useIsomorphicLayoutEffect(() => {
      if (!open) {
        return;
      }
      let value = readValueRef.current();
      setCapturedState(
        (input) =>
          input.wasOpen && Object.is(input.value, value)
            ? input
            : {
                wasOpen: true,
                value: value,
              },
      );
    }, [open]);
    if (open !== capturedState.wasOpen) {
      let value = open ? readValue() : capturedState.value;
      setCapturedState({
        wasOpen: open,
        value: value,
      });
      return value;
    }
    return capturedState.value;
  }
  function getInertProps(inert: boolean): InertProps {
    if (!inert) {
      return {};
    }
    return {
      inert: supportsBooleanInert ? true : "",
    };
  }
  function useForwardedOverlayActions(
    internalActionsRef: RefObject<OverlayActions | null>,
    forwardedActionsRef: Ref<OverlayActions> | undefined,
  ): void {
    reactOverlayActions.useImperativeHandle(
      forwardedActionsRef,
      () => ({
        close: () => internalActionsRef.current?.close?.(),
        unmount: () => internalActionsRef.current?.unmount(),
      }),
      [internalActionsRef],
    );
  }
  function createMutableValue<T>(): MutableValue<T | null> {
    let value: T | null = null;
    return {
      get: () => value,
      set: (input: T | null) => {
        value = input;
      },
    };
  }
  function getSheetFrameHeight(
    frame: Pick<SheetFrame, "detent" | "height"> | null,
    windowObject: Window | undefined,
    element: Element | null | undefined,
  ): number | undefined {
    if (frame === null) {
      return;
    }
    if (frame.detent === "tall" && windowObject !== undefined) {
      return Math.round(
        getSheetAvailableHeight(windowObject, element) *
          MAX_SHEET_HEIGHT_FRACTION,
      );
    } else {
      return frame.height;
    }
  }
  function getStackedSheetHeight(
    levels: readonly SheetLevel[],
  ): number | undefined {
    let firstLevel = levels[0],
      lastLevel = levels.at(-1);
    if (firstLevel === undefined || lastLevel === undefined) {
      return undefined;
    } else {
      return Math.max(lastLevel.height, firstLevel.height);
    }
  }
  function useSheetFrame(
    open: boolean,
    forwardedActionsRef: Ref<OverlayActions> | undefined,
    onOpenChangeComplete: ((open: boolean) => void) | undefined,
    close: (() => void) | undefined,
  ): SheetFrameState {
    let actionsRef = reactAdaptiveSheets.useRef<OverlayActions | null>(null);
    useForwardedOverlayActions(actionsRef, forwardedActionsRef);
    let treeId = reactAdaptiveSheets.useId(),
      [height, setHeight] = reactAdaptiveSheets.useState<number | undefined>(),
      [canGrow, setCanGrow] = reactAdaptiveSheets.useState(true),
      levelsRef = reactAdaptiveSheets.useRef<SheetLevel[]>([]),
      [detent, setDetent] = reactAdaptiveSheets.useState<SheetDetent>("default"),
      focusHoldsRef = reactAdaptiveSheets.useRef(new Set<object>()),
      [hasFocusHold, setHasFocusHold] =
        reactAdaptiveSheets.useState(false),
      [keyboard, setKeyboard] =
        reactAdaptiveSheets.useState<VisualKeyboardMetrics | null>(null),
      [previousOpen, setPreviousOpen] =
        reactAdaptiveSheets.useState(open);
    if (open !== previousOpen) {
      setPreviousOpen(open);
      if (open) {
        setHeight(undefined);
        setCanGrow(true);
        setDetent("default");
        setHasFocusHold(false);
      }
    }
    useIsomorphicLayoutEffect(() => {
      if (!open) {
        levelsRef.current = [];
        focusHoldsRef.current = new Set();
      }
    }, [open]);
    useVisualKeyboard(open && hasFocusHold, setKeyboard, {
      unpan: true,
    });
    let {
        showing: showing,
        onOpenChangeComplete: completeShowingTransition,
      } = useOverlayShowing(open),
      notifyOpenChangeComplete =
        useOptionalEventCallback(onOpenChangeComplete),
      lastCompletedOpenRef = reactAdaptiveSheets.useRef<boolean | null>(null);
    reactAdaptiveSheets.useEffect(() => {
      lastCompletedOpenRef.current = null;
    }, [open]);
    let handleOpenChangeComplete = reactAdaptiveSheets.useCallback(
        (input: boolean) => {
          completeShowingTransition(input);
          if (lastCompletedOpenRef.current === input) {
            return;
          }
          lastCompletedOpenRef.current = input;
          notifyOpenChangeComplete?.(input);
        },
        [completeShowingTransition, notifyOpenChangeComplete],
      ),
      pinHeight = reactAdaptiveSheets.useCallback(
        (input: number, options = true) => {
          if (levelsRef.current.length > 0 || !(input > 0)) {
            return;
          }
          levelsRef.current = [
            {
              height: Math.round(input),
              grows: options,
            },
          ];
          setHeight(Math.round(input));
          setCanGrow(options);
        },
        [],
      ),
      repinHeight = reactAdaptiveSheets.useCallback(
        (input: number, options?: boolean) => {
          let current = levelsRef.current,
            value = current[0];
          if (value === undefined || !(input > 0)) {
            return;
          }
          value.height = Math.round(input);
          if (options !== undefined) {
            value.grows = options;
          }
          setHeight(getStackedSheetHeight(current));
          setCanGrow(getStackedSheetCanGrow(current));
        },
        [],
      ),
      pushLevelHeight = reactAdaptiveSheets.useCallback(
        (input: number, options = true): SheetLevelHandle => {
          let state = {
              height: Math.round(input),
              grows: options,
            },
            current = levelsRef.current;
          current.push(state);
          setHeight(getStackedSheetHeight(current));
          setCanGrow(getStackedSheetCanGrow(current));
          let flag = false,
            callback = () =>
              !flag && current === levelsRef.current;
          return {
            set: (input2: number, options2?: boolean) => {
              if (!callback()) {
                return;
              }
              state.height = Math.round(input2);
              if (options2 !== undefined) {
                state.grows = options2;
              }
              setHeight(getStackedSheetHeight(current));
              setCanGrow(getStackedSheetCanGrow(current));
            },
            release: () => {
              if (flag) {
                return;
              }
              let value = current.indexOf(state);
              flag = true;
              if (value >= 0) {
                current.splice(value, 1);
              }
              if (current === levelsRef.current) {
                setHeight(getStackedSheetHeight(current));
                setCanGrow(getStackedSheetCanGrow(current));
              }
            },
          };
        },
        [],
      ),
      holdTextEntryFocus =
        reactAdaptiveSheets.useCallback(() => {
          let state = {},
            current = focusHoldsRef.current;
          current.add(state);
          setHasFocusHold(true);
          return () => {
            current.delete(state);
            if (current === focusHoldsRef.current) {
              setHasFocusHold(current.size > 0);
            }
          };
        }, []),
      closeCallback = useOptionalEventCallback(close),
      dismiss = reactAdaptiveSheets.useCallback(() => {
        if (closeCallback !== undefined) {
          closeCallback();
        } else {
          actionsRef.current?.close?.();
        }
      }, [closeCallback]),
      [dragState] = reactAdaptiveSheets.useState<
        MutableValue<SheetDragEntry | null>
      >(createMutableValue);
    return {
      showing: showing,
      frame: reactAdaptiveSheets.useMemo(
        () => ({
          treeId: treeId,
          open: open,
          showing: showing,
          height: height,
          pinHeight: pinHeight,
          repinHeight: repinHeight,
          pushLevelHeight: pushLevelHeight,
          canGrow: canGrow,
          detent: detent,
          setDetent: setDetent,
          holdTextEntryFocus: holdTextEntryFocus,
          keyboard: keyboard,
          dismiss: dismiss,
          drag: dragState,
        }),
        [
          treeId,
          open,
          showing,
          height,
          canGrow,
          pinHeight,
          repinHeight,
          pushLevelHeight,
          detent,
          holdTextEntryFocus,
          keyboard,
          dismiss,
          dragState,
        ],
      ),
      actionsRef: actionsRef,
      onOpenChangeComplete: handleOpenChangeComplete,
    };
  }
  function useIsSheet(): boolean {
    return reactAdaptiveSheets.useContext(sheetStateContext).sheet;
  }
  function useSheetState(): AdaptiveSheetState {
    return reactAdaptiveSheets.useContext(sheetStateContext);
  }
  function isLiveRegionEvent(event: Pick<Event, "target"> | undefined): boolean {
    let target = event?.target;
    return (
      target instanceof Element && target.closest(LIVE_REGION_SELECTOR) !== null
    );
  }
  function useAdaptiveSheet(props: AdaptiveSheetProps): AdaptiveSheet {
    let {
        open: open,
        actionsRef: forwardedActionsRef,
        close: close,
        onOpenChange: onOpenChange,
        onOpenChangeComplete: onOpenChangeComplete,
        structurallyAnchored = false,
        closable = true,
        refuseClose: refuseClose,
      } = props,
      parentSheet = reactAdaptiveSheets.useContext(sheetParentContext),
      presentationMode = usePresentationMode(),
      mobileCoarsePointer = useMobileSheetMediaQuery(),
      sheetFrame = useSheetFrame(
        open,
        forwardedActionsRef,
        onOpenChangeComplete,
        close,
      ),
      sheetImplementationAvailable = (0,
      runtime.useSheetImplementationLoaded)(),
      sheetImplementationRejected = (0,
      runtime.useSheetImplementationFailed)(),
      coarsePresentation = useCoarsePresentation();
    reactAdaptiveSheets.useEffect(() => {
      if (
        coarsePresentation &&
        !sheetImplementationAvailable &&
        !sheetImplementationRejected
      ) {
        (0, runtime.preloadSheetImplementation)();
      }
    }, [
      coarsePresentation,
      sheetImplementationAvailable,
      sheetImplementationRejected,
      open,
    ]);
    let prefersSheet = usePresentationWhileShowing(
        shouldUseSheetPresentation(
          presentationMode,
          false,
          mobileCoarsePointer,
        ) &&
          (closable || presentationMode === "sheet"),
        open,
        sheetFrame.showing,
      ),
      [usesFallback, setUsesFallback] = reactAdaptiveSheets.useState(
        () =>
          (sheetImplementationUnavailable || sheetImplementationRejected) &&
          !sheetImplementationAvailable,
      ),
      [previousOpen, setPreviousOpen] =
        reactAdaptiveSheets.useState(open);
    if (open !== previousOpen) {
      setPreviousOpen(open);
      let value =
        (sheetImplementationUnavailable || sheetImplementationRejected) &&
        !sheetImplementationAvailable;
      if (open && usesFallback !== value) {
        setUsesFallback(value);
      }
    }
    if (
      open &&
      sheetImplementationRejected &&
      !sheetImplementationAvailable &&
      !usesFallback
    ) {
      setUsesFallback(true);
    }
    let waitingForImplementation =
      prefersSheet &&
      !structurallyAnchored &&
      !sheetImplementationAvailable &&
      !usesFallback;
    reactAdaptiveSheets.useEffect(() => {
      if (!waitingForImplementation || !open) {
        return;
      }
      let callback = () => {
        if (!(0, runtime.isSheetImplementationLoaded)()) {
          sheetImplementationUnavailable = true;
          setUsesFallback(true);
        }
      };
      sheetImplementationWaiters.add(callback);
      let value = setTimeout(callback, SHEET_IMPLEMENTATION_WAIT_MS);
      return () => {
        sheetImplementationWaiters.delete(callback);
        clearTimeout(value);
      };
    }, [waitingForImplementation, open]);
    let sheet = prefersSheet && !structurallyAnchored && !usesFallback;
    useAndroidCloseWatcher(
      open && prefersSheet && !structurallyAnchored && usesFallback,
      sheetFrame.frame.dismiss,
    );
    let pending =
        sheet && sheetFrame.showing && (!sheetImplementationAvailable || !open),
      depth =
        sheet && parentSheet !== null ? parentSheet.depth + 1 : 0,
      coveringChildrenRef = reactAdaptiveSheets.useRef(new Set<object>()),
      lastUncoveredAtRef = reactAdaptiveSheets.useRef(0),
      [covered, setCovered] = reactAdaptiveSheets.useState(false),
      cover = reactAdaptiveSheets.useCallback(
        (input: object) => {
          coveringChildrenRef.current.add(input);
          setCovered(true);
          return () => {
            coveringChildrenRef.current.delete(input);
            lastUncoveredAtRef.current = Date.now();
            setCovered(coveringChildrenRef.current.size > 0);
          };
        },
        [],
      ),
      [coverToken] = reactAdaptiveSheets.useState(() => ({}));
    useIsomorphicLayoutEffect(() => {
      if (!sheet || !open || parentSheet === null) {
        return;
      }
      return parentSheet.cover!(coverToken);
    }, [sheet, open, parentSheet, coverToken]);
    let windowObject = (0, runtime.useRootWindow)(),
      treeId = sheetFrame.frame.treeId,
      [focusOutsideCoveredSheet, setFocusOutsideCoveredSheet] =
        reactAdaptiveSheets.useState(false);
    useIsomorphicLayoutEffect(() => {
      if (!covered || windowObject === undefined) {
        return;
      }
      let index = 0,
        callback = () => {
          let activeElement = windowObject.document.activeElement;
          if (
            activeElement !== null &&
            activeElement.closest(
              `[data-sheet-tree="${CSS.escape(treeId)}"]`,
            ) !== null
          ) {
            index = windowObject.requestAnimationFrame(callback);
            return;
          }
          setFocusOutsideCoveredSheet(true);
        };
      index = windowObject.requestAnimationFrame(callback);
      return () => {
        windowObject.cancelAnimationFrame(index);
        setFocusOutsideCoveredSheet(false);
      };
    }, [covered, treeId, windowObject]);
    let inert = covered && focusOutsideCoveredSheet,
      notifyOpenChange = useOptionalEventCallback(onOpenChange),
      refuseCloseCallback = useOptionalEventCallback(refuseClose),
      sheetRef = reactAdaptiveSheets.useRef(sheet);
    useIsomorphicLayoutEffect(() => {
      sheetRef.current = sheet;
    }, [sheet]);
    let refusesAmbientClose = reactAdaptiveSheets.useCallback(
        (input: SheetOpenChangeDetails) => {
          if (input.reason === undefined) {
            return false;
          }
          if (
            (coveringChildrenRef.current.size > 0 ||
              Date.now() - lastUncoveredAtRef.current <
                SHEET_UNCOVER_CLOSE_GRACE_MS) &&
            ambientCloseReasons.has(input.reason)
          ) {
            return true;
          }
          return (
            sheetRef.current &&
            input.reason === "outside-press" &&
            isLiveRegionEvent(input.event)
          );
        },
        [],
      ),
      closeRequestRef = reactAdaptiveSheets.useRef<SheetOpenChangeDetails | null>(
        null,
      ),
      takeCloseRequest =
        reactAdaptiveSheets.useCallback(() => {
          let current = closeRequestRef.current;
          closeRequestRef.current = null;
          if (current?.isCanceled === true) {
            return null;
          } else {
            return current;
          }
        }, []),
      handleOpenChange = reactAdaptiveSheets.useCallback(
        (input: boolean, options: SheetOpenChangeDetails) => {
          let value = options;
          if (!input && refusesAmbientClose(value)) {
            value.cancel?.();
            return;
          }
          if (
            !input &&
            sheetRef.current &&
            refuseCloseCallback?.(options, treeId) === true
          ) {
            value.cancel?.();
            return;
          }
          closeRequestRef.current = input ? null : value;
          if (!input) {
            windowObject?.requestAnimationFrame(() => {
              if (closeRequestRef.current === value) {
                closeRequestRef.current = null;
              }
            });
          }
          if (input && coarsePresentation) {
            (0, runtime.preloadSheetImplementation)();
          }
          notifyOpenChange?.(input, options);
        },
        [
          notifyOpenChange,
          refuseCloseCallback,
          refusesAmbientClose,
          treeId,
          coarsePresentation,
          windowObject,
        ],
      ),
      state = reactAdaptiveSheets.useMemo(
        () => ({
          sheet: sheet,
          pending: pending,
          covered: covered,
          inert: inert,
          depth: depth,
        }),
        [sheet, pending, covered, inert, depth],
      ),
      parentFrameHeight = parentSheet?.frameHeight,
      effectiveFrame = reactAdaptiveSheets.useMemo(() => {
        let value =
          sheetFrame.frame.height !== undefined &&
          parentFrameHeight !== undefined
            ? Math.max(sheetFrame.frame.height, parentFrameHeight)
            : sheetFrame.frame.height;
        if (value !== sheetFrame.frame.height) {
          return {
            ...sheetFrame.frame,
            height: value,
          };
        } else {
          return sheetFrame.frame;
        }
      }, [sheetFrame.frame, parentFrameHeight]),
      frame = reactAdaptiveSheets.useMemo(
        () => ({
          ...effectiveFrame,
          refusesAmbientClose: refusesAmbientClose,
          takeCloseRequest: takeCloseRequest,
        }),
        [effectiveFrame, refusesAmbientClose, takeCloseRequest],
      ),
      stack = reactAdaptiveSheets.useMemo(
        () => ({
          cover: cover,
        }),
        [cover],
      );
    return {
      sheet: sheet,
      showing: sheetFrame.showing,
      frame: frame,
      actionsRef: sheetFrame.actionsRef,
      onOpenChange: handleOpenChange,
      onOpenChangeComplete: sheetFrame.onOpenChangeComplete,
      modal: sheet ? true : undefined,
      state: state,
      stack: stack,
    };
  }
  function ResetSheetContexts({
    children: children,
  }: {
    children?: ReactNode;
  }): ReactNode {
    return jsxAdaptiveSheets.jsx(sheetStateContext.Provider, {
      value: defaultSheetState,
      children: jsxAdaptiveSheets.jsx(sheetParentContext.Provider, {
        value: null,
        children: jsxAdaptiveSheets.jsx(sheetCoverContext.Provider, {
          value: null,
          children: jsxAdaptiveSheets.jsx(sheetFrameContext.Provider, {
            value: null,
            children: children,
          }),
        }),
      }),
    });
  }
  function FloatingPositionRenderProp(
    props: AdaptiveSheetProps & {
      children: (sheet: AdaptiveSheet) => ReactNode;
    },
  ): ReactNode {
    let { children: children, ...remainingProps } = props,
      value = useAdaptiveSheet(remainingProps);
    return jsxAdaptiveSheets.jsx(SheetContextProvider, {
      value: value,
      children: children(value),
    });
  }
  function SheetContextProvider({
    value: value,
    children: children,
  }: SheetProviderProps): ReactNode {
    return jsxAdaptiveSheets.jsx(sheetStateContext.Provider, {
      value: value.state,
      children: jsxAdaptiveSheets.jsx(sheetCoverContext.Provider, {
        value: value.stack.cover,
        children: jsxAdaptiveSheets.jsx(sheetFrameContext.Provider, {
          value: value.frame,
          children: children,
        }),
      }),
    });
  }
  function useControllableOpen(props: ControllableOpenProps): ControllableOpen {
    let [uncontrolledOpen, setUncontrolledOpen] =
        reactAdaptiveSheets.useState(props.defaultOpen ?? false),
      open = props.open ?? uncontrolledOpen,
      onOpenChange = useOptionalEventCallback(props.onOpenChange);
    return {
      open: open,
      onOpenChange: reactAdaptiveSheets.useCallback(
        (input: boolean, options: SheetOpenChangeDetails) => {
          onOpenChange?.(input, options);
          if (!options.isCanceled) {
            setUncontrolledOpen(input);
          }
        },
        [onOpenChange],
      ),
    };
  }
  function useHasSheetFrame(): boolean {
    return reactAdaptiveSheets.useContext(sheetFrameContext) !== null;
  }
  function useSheetCapablePresentation(): boolean {
    let value = useCoarsePresentation(),
      value2 =
        reactAdaptiveSheets.useContext(sheetFrameContext) !== null;
    return value || value2;
  }
  function useSheetImplementation(): SheetImplementation | null {
    let implementation = (0, runtime.useLoadedSheetImplementation)(),
      frame = reactAdaptiveSheets.useContext(sheetFrameContext),
      showing = frame?.showing ?? false,
      open = frame?.open ?? false,
      { sheet: sheet } = useSheetState(),
      canCaptureImplementation = !showing || (sheet && open),
      [capturedImplementation, setCapturedImplementation] =
        reactAdaptiveSheets.useState(
          () =>
            implementation !== null && canCaptureImplementation
              ? implementation
              : null,
        );
    if (
      capturedImplementation === null &&
      implementation !== null &&
      canCaptureImplementation
    ) {
      setCapturedImplementation(implementation);
      return implementation;
    }
    return capturedImplementation;
  }
  function isReducedMotion(): boolean {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return false;
    }
    return (
      (typeof window.matchMedia === "function" &&
        window.matchMedia(REDUCED_MOTION_QUERY).matches) ||
      document.documentElement.getAttribute(
        REDUCED_MOTION_ATTRIBUTE,
      ) === "true"
    );
  }
  function resetSheetDragStyle(input: HTMLElement): void {
    input.style.transition = "";
    input.style.translate = "";
  }
  function useSheetDrag(): SheetDragHandlers {
    let frame = reactSheetDrag.useContext(sheetFrameContext),
      [dragOwner] = reactSheetDrag.useState(() => ({})),
      [fallbackDragState] = reactSheetDrag.useState<
        MutableValue<SheetDragEntry | null>
      >(createMutableValue),
      dragState = frame?.drag ?? fallbackDragState,
      findTreeSheets = (element: Element) =>
        frame === null
          ? []
          : Array.from<HTMLElement>(
              element.ownerDocument.querySelectorAll<HTMLElement>(
                `[data-presentation="sheet"][data-sheet-tree="${CSS.escape(frame.treeId)}"]:not([data-ending-style])`,
              ),
            ),
      applyDragGeometry = (
        input: SheetDragEntry,
        options: number,
      ) => {
        let {
          height: value,
          slide: value2,
          shown: value3,
        } = calculateSheetDragGeometry(input, input.raw - options);
        for (let { el: value5 } of input.sheets) {
          value5.style.height = `${value}px`;
          value5.style.translate = value2 > 0 ? `0 ${value2}px` : "";
        }
        let value4 = value3 < 1 ? value3.toFixed(3) : "";
        for (let value5 of input.scrims)
          if (value5.style.opacity !== value4) {
            value5.style.opacity = value4;
          }
      },
      onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
        if (
          frame === null ||
          !frame.open ||
          event.button !== 0 ||
          dragState.get() !== null ||
          frame.keyboard !== null
        ) {
          return;
        }
        if (
          event.target instanceof Element &&
          event.target.closest(
            'button, a, input, textarea, [role="menuitem"], [role="option"], [data-cds-sheet-control]',
          ) !== null
        ) {
          return;
        }
        if (event.currentTarget.closest("[data-cds-sheet-covered]") !== null) {
          return;
        }
        let ancestor = event.currentTarget.closest(
          '[data-presentation="sheet"]',
        );
        if (ancestor === null) {
          return;
        }
        let bounds = ancestor.getBoundingClientRect(),
          height = bounds.height,
          value =
            ancestor.parentElement?.getBoundingClientRect().bottom,
          value2 = Math.max(
            0,
            bounds.bottom - (value ?? bounds.bottom),
          ),
          defaultView = ancestor.ownerDocument.defaultView,
          value3 =
            defaultView === null
              ? height
              : getSheetAvailableHeight(defaultView, ancestor);
        event.currentTarget.setPointerCapture(event.pointerId);
        let value4 = findTreeSheets(ancestor).map(
            (input) => {
              let height2 = input.style.height;
              input.style.transition = "none";
              input.style.height = `${height}px`;
              return {
                el: input,
                height: height2,
              };
            },
          ),
          value5 = frame.canGrow || frame.detent === "tall",
          value6 = calculateSheetBounds(
            Math.min(frame.height ?? height, height),
            value3,
            MAX_SHEET_HEIGHT_FRACTION,
            value5,
          ),
          value7 =
            isReducedMotion() || !value5
              ? {
                  ...value6,
                  room: 0,
                }
              : value6,
          value8 = Array.from<HTMLElement>(
            ancestor.ownerDocument.querySelectorAll<HTMLElement>(
              `[data-presentation="sheet"][data-sheet-scrim="${CSS.escape(frame.treeId)}"]`,
            ),
          );
        for (let value9 of value8) value9.style.transition = "none";
        let state: SheetDragEntry = {
          owner: dragOwner,
          pointerId: event.pointerId,
          startY: event.clientY,
          lastY: event.clientY,
          lastT: event.timeStamp,
          velocity: 0,
          detent: frame.detent,
          raw: recoverRawSheetHeight(value7, height, value2),
          caughtSlide: value2,
          ...value7,
          sheets: value4,
          doc: ancestor.ownerDocument,
          scrims: value8,
        };
        dragState.set(state);
        applyDragGeometry(state, 0);
      },
      onPointerMove = (input: ReactPointerEvent<HTMLElement>) => {
        let entry = dragState.get();
        if (
          entry === null ||
          entry.owner !== dragOwner ||
          input.pointerId !== entry.pointerId
        ) {
          return;
        }
        let value = input.timeStamp - entry.lastT;
        if (value > 0) {
          entry.velocity = (input.clientY - entry.lastY) / value;
        }
        entry.lastY = input.clientY;
        entry.lastT = input.timeStamp;
        applyDragGeometry(entry, input.clientY - entry.startY);
      },
      restoreDragStyles = (
        input: SheetDragEntry,
        options: boolean,
      ) => {
        for (let { el: value, height: value2 } of input.sheets)
          if (((value.style.transition = ""), options)) {
            value.style.translate = `0 ${SHEET_DISMISS_TRANSLATE_CSS}`;
          } else {
            value.style.height = value2;
            value.style.translate = "";
          }
        for (let value of input.scrims) {
          value.style.transition = "";
          value.style.opacity = "";
        }
      },
      open = frame?.open ?? false;
    useIsomorphicLayoutEffect(() => {
      let entry = dragState.get();
      if (!open && entry !== null && entry.owner === dragOwner) {
        dragState.set(null);
        restoreDragStyles(entry, false);
      }
    }, [open, dragState, dragOwner]);
    let latestFrameRef = reactSheetDrag.useRef<{
      open: boolean;
      height: number | undefined;
      detent: SheetDetent;
    }>({
      open: false,
      height: undefined,
      detent: "default",
    });
    useIsomorphicLayoutEffect(() => {
      latestFrameRef.current = {
        open: frame?.open ?? false,
        height: frame?.height,
        detent: frame?.detent ?? "default",
      };
    }, [frame]);
    reactSheetDrag.useEffect(
      () => () => {
        let entry = dragState.get();
        if (entry !== null && entry.owner === dragOwner) {
          dragState.set(null);
          restoreDragStyles(entry, false);
        }
      },
      [dragState, dragOwner],
    );
    let finishDrag = (
      input: ReactPointerEvent<HTMLElement>,
      options: boolean,
    ) => {
      let entry = dragState.get();
      if (
        entry === null ||
        entry.owner !== dragOwner ||
        frame === null ||
        input.pointerId !== entry.pointerId
      ) {
        return;
      }
      dragState.set(null);
      if (input.currentTarget.hasPointerCapture(input.pointerId)) {
        input.currentTarget.releasePointerCapture(input.pointerId);
      }
      let value = entry.lastY - entry.startY,
        value2 =
          input.timeStamp - entry.lastT > 100 ? 0 : entry.velocity,
        { dismiss: value3, detent: value4 } = determineSheetRelease(
          entry,
          {
            detent: entry.detent,
            rawAtGrab: entry.raw,
            rawAtRelease: entry.raw - value,
            caughtSlide: entry.caughtSlide,
            velocity: value2,
            commit: options,
          },
        );
      restoreDragStyles(entry, value3);
      if (value3) {
        frame.dismiss();
        let { doc: value5 } = entry;
        value5.defaultView?.requestAnimationFrame(() => {
          let current = latestFrameRef.current;
          if (!current.open) {
            return;
          }
          let value6 =
            current.detent === "tall"
              ? MAX_SHEET_HEIGHT_CSS
              : current.height !== undefined
                ? `${current.height}px`
                : "";
          for (let value7 of value5.querySelectorAll<HTMLElement>(
            `[data-sheet-tree="${CSS.escape(frame.treeId)}"][data-presentation="sheet"]`,
          )) {
            resetSheetDragStyle(value7);
            value7.style.height = value6;
          }
        });
      } else if (value4 !== entry.detent) {
        frame.setDetent(value4);
      }
    };
    return {
      onPointerDown: onPointerDown,
      onPointerMove: onPointerMove,
      onPointerUp: (input: ReactPointerEvent<HTMLElement>) =>
        finishDrag(input, true),
      onPointerCancel: (input: ReactPointerEvent<HTMLElement>) =>
        finishDrag(input, false),
      onLostPointerCapture: (input: ReactPointerEvent<HTMLElement>) =>
        finishDrag(input, false),
    };
  }
  bindRuntimeValue(
    runtime,
    "accentColorNames",
    () => accentColorNames,
    (value) => {
      accentColorNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeAccentColors",
    () => initializeAccentColors,
    (value) => {
      initializeAccentColors = value;
    },
  );
  bindRuntimeValue(runtime, "getMediaQueryStore", () => getMediaQueryStore);
  bindRuntimeValue(runtime, "useMediaQuery__U", () => useMediaQuery__U);
  bindRuntimeValue(
    runtime,
    "reactMediaQuery",
    () => reactMediaQuery,
    (value) => {
      reactMediaQuery = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MOBILE_COARSE_POINTER_QUERY",
    () => MOBILE_COARSE_POINTER_QUERY,
    (value) => {
      MOBILE_COARSE_POINTER_QUERY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "mediaQueryStores",
    () => mediaQueryStores,
    (value) => {
      mediaQueryStores = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "subscribeNoop",
    () => subscribeNoop,
    (value) => {
      subscribeNoop = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getFalseSnapshot",
    () => getFalseSnapshot,
    (value) => {
      getFalseSnapshot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COARSE_POINTER_QUERY_rG",
    () => COARSE_POINTER_QUERY_rG,
    (value) => {
      COARSE_POINTER_QUERY_rG = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeMediaQueryStores",
    () => initializeMediaQueryStores,
    (value) => {
      initializeMediaQueryStores = value;
    },
  );
  bindRuntimeValue(runtime, "resolveWindow", () => resolveWindow);
  bindRuntimeValue(
    runtime,
    "addMediaQueryListener",
    () => addMediaQueryListener,
  );
  bindRuntimeValue(
    runtime,
    "removeMediaQueryListener",
    () => removeMediaQueryListener,
  );
  bindRuntimeValue(runtime, "notifySubscribers", () => notifySubscribers);
  bindRuntimeValue(
    runtime,
    "createCoarsePointerStore",
    () => createCoarsePointerStore,
  );
  bindRuntimeValue(
    runtime,
    "getCoarsePointerSnapshot",
    () => getCoarsePointerSnapshot,
  );
  bindRuntimeValue(
    runtime,
    "subscribeCoarsePointer",
    () => subscribeCoarsePointer,
  );
  bindRuntimeValue(
    runtime,
    "coarsePointerStores",
    () => coarsePointerStores,
    (value) => {
      coarsePointerStores = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeCoarsePointerStores",
    () => initializeCoarsePointerStores,
    (value) => {
      initializeCoarsePointerStores = value;
    },
  );
  bindRuntimeValue(runtime, "reportAsyncError", () => reportAsyncError);
  bindRuntimeValue(runtime, "invokeAndReportError", () => invokeAndReportError);
  bindRuntimeValue(
    runtime,
    "initializeErrorReporting",
    () => initializeErrorReporting,
    (value) => {
      initializeErrorReporting = value;
    },
  );
  bindRuntimeValue(runtime, "createSafeObserver", () => createSafeObserver);
  bindRuntimeValue(
    runtime,
    "createSafeResizeObserver",
    () => createSafeResizeObserver,
  );
  bindRuntimeValue(
    runtime,
    "createSafeMutationObserver",
    () => createSafeMutationObserver,
  );
  bindRuntimeValue(
    runtime,
    "initializeSafeObservers",
    () => initializeSafeObservers,
    (value) => {
      initializeSafeObservers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createFontAttributeStore",
    () => createFontAttributeStore,
  );
  bindRuntimeValue(runtime, "useDocumentFont", () => useDocumentFont);
  bindRuntimeValue(
    runtime,
    "reactDocumentFont",
    () => reactDocumentFont,
    (value) => {
      reactDocumentFont = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "supportedFonts",
    () => supportedFonts,
    (value) => {
      supportedFonts = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isSupportedFont",
    () => isSupportedFont,
    (value) => {
      isSupportedFont = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "readDocumentFont",
    () => readDocumentFont,
    (value) => {
      readDocumentFont = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "subscribeFontNoop",
    () => subscribeFontNoop,
    (value) => {
      subscribeFontNoop = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getUndefinedFontSnapshot",
    () => getUndefinedFontSnapshot,
    (value) => {
      getUndefinedFontSnapshot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeDocumentFont",
    () => initializeDocumentFont,
    (value) => {
      initializeDocumentFont = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useFeatureFlagAttribute",
    () => useFeatureFlagAttribute,
  );
  bindRuntimeValue(
    runtime,
    "mergeFeatureFlagNames",
    () => mergeFeatureFlagNames,
  );
  bindRuntimeValue(
    runtime,
    "reactFeatureFlags",
    () => reactFeatureFlags,
    (value) => {
      reactFeatureFlags = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "featureFlagContext",
    () => featureFlagContext,
    (value) => {
      featureFlagContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeFeatureFlags",
    () => initializeFeatureFlags,
    (value) => {
      initializeFeatureFlags = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "registerInputDismissalTracking",
    () => registerInputDismissalTracking,
  );
  bindRuntimeValue(runtime, "trackInputForElement", () => trackInputForElement);
  bindRuntimeValue(runtime, "isInputTriggeredBlur", () => isInputTriggeredBlur);
  bindRuntimeValue(
    runtime,
    "inputDismissalStates",
    () => inputDismissalStates,
    (value) => {
      inputDismissalStates = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "dismissalKeys",
    () => dismissalKeys,
    (value) => {
      dismissalKeys = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeInputDismissalTracking",
    () => initializeInputDismissalTracking,
    (value) => {
      initializeInputDismissalTracking = value;
    },
  );
  bindRuntimeValue(runtime, "runWithTransition", () => runWithTransition);
  bindRuntimeValue(
    runtime,
    "transitionRunner",
    () => transitionRunner,
    (value) => {
      transitionRunner = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeTransitionRunner",
    () => initializeTransitionRunner,
    (value) => {
      initializeTransitionRunner = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactIsomorphicLayoutEffect",
    () => reactIsomorphicLayoutEffect,
    (value) => {
      reactIsomorphicLayoutEffect = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useIsomorphicLayoutEffect",
    () => useIsomorphicLayoutEffect,
    (value) => {
      useIsomorphicLayoutEffect = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeIsomorphicLayoutEffect",
    () => initializeIsomorphicLayoutEffect,
    (value) => {
      initializeIsomorphicLayoutEffect = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getResizeObserverConstructor",
    () => getResizeObserverConstructor,
  );
  bindRuntimeValue(
    runtime,
    "initializeResizeObserverAccess",
    () => initializeResizeObserverAccess,
    (value) => {
      initializeResizeObserverAccess = value;
    },
  );
  bindRuntimeValue(runtime, "isAndroidWindow", () => isAndroidWindow);
  bindRuntimeValue(
    runtime,
    "useAndroidCloseWatcher",
    () => useAndroidCloseWatcher,
  );
  bindRuntimeValue(
    runtime,
    "reactAndroidCloseWatcher",
    () => reactAndroidCloseWatcher,
    (value) => {
      reactAndroidCloseWatcher = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeAndroidCloseWatcher",
    () => initializeAndroidCloseWatcher,
    (value) => {
      initializeAndroidCloseWatcher = value;
    },
  );
  bindRuntimeValue(runtime, "rubberBandDistance", () => rubberBandDistance);
  bindRuntimeValue(
    runtime,
    "inverseRubberBandDistance",
    () => inverseRubberBandDistance,
  );
  bindRuntimeValue(runtime, "calculateSheetBounds", () => calculateSheetBounds);
  bindRuntimeValue(runtime, "hasTallSheetDetent", () => hasTallSheetDetent);
  bindRuntimeValue(
    runtime,
    "calculateSheetDragGeometry",
    () => calculateSheetDragGeometry,
  );
  bindRuntimeValue(
    runtime,
    "recoverRawSheetHeight",
    () => recoverRawSheetHeight,
  );
  bindRuntimeValue(
    runtime,
    "determineSheetRelease",
    () => determineSheetRelease,
  );
  bindRuntimeValue(
    runtime,
    "sheetDragSettings",
    () => sheetDragSettings,
    (value) => {
      sheetDragSettings = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetDragSettings",
    () => initializeSheetDragSettings,
    (value) => {
      initializeSheetDragSettings = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getSheetPositionerStyle",
    () => getSheetPositionerStyle,
  );
  bindRuntimeValue(
    runtime,
    "getSheetAvailableHeight",
    () => getSheetAvailableHeight,
  );
  bindRuntimeValue(
    runtime,
    "getSheetMinimumHeight",
    () => getSheetMinimumHeight,
  );
  bindRuntimeValue(runtime, "getSheetPopupStyle", () => getSheetPopupStyle);
  bindRuntimeValue(
    runtime,
    "SAFE_AREA_TOP_CSS",
    () => SAFE_AREA_TOP_CSS,
    (value) => {
      SAFE_AREA_TOP_CSS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "VIEWPORT_HEIGHT_EXCLUDING_SAFE_AREA_CSS",
    () => VIEWPORT_HEIGHT_EXCLUDING_SAFE_AREA_CSS,
    (value) => {
      VIEWPORT_HEIGHT_EXCLUDING_SAFE_AREA_CSS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "baseSheetPositionerStyle",
    () => baseSheetPositionerStyle,
    (value) => {
      baseSheetPositionerStyle = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sheetPositioningOverrides",
    () => sheetPositioningOverrides,
    (value) => {
      sheetPositioningOverrides = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_SHEET_HEIGHT_FRACTION",
    () => MAX_SHEET_HEIGHT_FRACTION,
    (value) => {
      MAX_SHEET_HEIGHT_FRACTION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_SHEET_HEIGHT_CSS",
    () => MAX_SHEET_HEIGHT_CSS,
    (value) => {
      MAX_SHEET_HEIGHT_CSS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_SHEET_OVERSHOOT_HEIGHT_CSS",
    () => MAX_SHEET_OVERSHOOT_HEIGHT_CSS,
    (value) => {
      MAX_SHEET_OVERSHOOT_HEIGHT_CSS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SHEET_DENSITY",
    () => SHEET_DENSITY,
    (value) => {
      SHEET_DENSITY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIN_SHEET_HEIGHT_FRACTION",
    () => MIN_SHEET_HEIGHT_FRACTION,
    (value) => {
      MIN_SHEET_HEIGHT_FRACTION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIN_SHEET_HEIGHT_CSS",
    () => MIN_SHEET_HEIGHT_CSS,
    (value) => {
      MIN_SHEET_HEIGHT_CSS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetStyles",
    () => initializeSheetStyles,
    (value) => {
      initializeSheetStyles = value;
    },
  );
  bindRuntimeValue(runtime, "asElement", () => asElement);
  bindRuntimeValue(
    runtime,
    "initializeElementAccess",
    () => initializeElementAccess,
    (value) => {
      initializeElementAccess = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createRequiredRefCallback",
    () => createRequiredRefCallback,
  );
  bindRuntimeValue(
    runtime,
    "createOptionalRefCallback",
    () => createOptionalRefCallback,
  );
  bindRuntimeValue(
    runtime,
    "useOptionalEventCallback",
    () => useOptionalEventCallback,
  );
  bindRuntimeValue(runtime, "useEventCallback", () => useEventCallback);
  bindRuntimeValue(
    runtime,
    "reactEventCallbacks",
    () => reactEventCallbacks,
    (value) => {
      reactEventCallbacks = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeEventCallbacks",
    () => initializeEventCallbacks,
    (value) => {
      initializeEventCallbacks = value;
    },
  );
  bindRuntimeValue(runtime, "isEditableElement", () => isEditableElement);
  bindRuntimeValue(
    runtime,
    "measureVisualKeyboard",
    () => measureVisualKeyboard,
  );
  bindRuntimeValue(runtime, "useVisualKeyboard", () => useVisualKeyboard);
  bindRuntimeValue(
    runtime,
    "reactVisualKeyboard",
    () => reactVisualKeyboard,
    (value) => {
      reactVisualKeyboard = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EDITABLE_ELEMENT_SELECTOR",
    () => EDITABLE_ELEMENT_SELECTOR,
    (value) => {
      EDITABLE_ELEMENT_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "KEYBOARD_MINIMUM_HEIGHT",
    () => KEYBOARD_MINIMUM_HEIGHT,
    (value) => {
      KEYBOARD_MINIMUM_HEIGHT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "VIEWPORT_SCALE_TOLERANCE",
    () => VIEWPORT_SCALE_TOLERANCE,
    (value) => {
      VIEWPORT_SCALE_TOLERANCE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeVisualKeyboard",
    () => initializeVisualKeyboard,
    (value) => {
      initializeVisualKeyboard = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useMobileSheetMediaQuery",
    () => useMobileSheetMediaQuery,
  );
  bindRuntimeValue(runtime, "usePresentationMode", () => usePresentationMode);
  bindRuntimeValue(
    runtime,
    "useCoarsePresentation",
    () => useCoarsePresentation,
  );
  bindRuntimeValue(runtime, "sheetContentCanGrow", () => sheetContentCanGrow);
  bindRuntimeValue(
    runtime,
    "hasEditableSheetContent",
    () => hasEditableSheetContent,
  );
  bindRuntimeValue(
    runtime,
    "shouldUseSheetPresentation",
    () => shouldUseSheetPresentation,
  );
  bindRuntimeValue(
    runtime,
    "usePresentationWhileShowing",
    () => usePresentationWhileShowing,
  );
  bindRuntimeValue(runtime, "useOverlayShowing", () => useOverlayShowing);
  bindRuntimeValue(
    runtime,
    "useValueCapturedOnOpen",
    () => useValueCapturedOnOpen,
  );
  bindRuntimeValue(
    runtime,
    "reactPresentationMode",
    () => reactPresentationMode,
    (value) => {
      reactPresentationMode = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "presentationModeContext",
    () => presentationModeContext,
    (value) => {
      presentationModeContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SHEET_DRILLED_ATTRIBUTE",
    () => SHEET_DRILLED_ATTRIBUTE,
    (value) => {
      SHEET_DRILLED_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SHEET_COVERED_ATTRIBUTE",
    () => SHEET_COVERED_ATTRIBUTE,
    (value) => {
      SHEET_COVERED_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SHEET_PEELING_ATTRIBUTE",
    () => SHEET_PEELING_ATTRIBUTE,
    (value) => {
      SHEET_PEELING_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SHEET_TREE_CLOSING_ATTRIBUTE",
    () => SHEET_TREE_CLOSING_ATTRIBUTE,
    (value) => {
      SHEET_TREE_CLOSING_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SHEET_SCROLL_ATTRIBUTE",
    () => SHEET_SCROLL_ATTRIBUTE,
    (value) => {
      SHEET_SCROLL_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SHEET_PRESSED_ATTRIBUTE",
    () => SHEET_PRESSED_ATTRIBUTE,
    (value) => {
      SHEET_PRESSED_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SHEET_CONTROL_HELD_ATTRIBUTE",
    () => SHEET_CONTROL_HELD_ATTRIBUTE,
    (value) => {
      SHEET_CONTROL_HELD_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OVERLAY_CLOSE_FALLBACK_MS",
    () => OVERLAY_CLOSE_FALLBACK_MS,
    (value) => {
      OVERLAY_CLOSE_FALLBACK_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializePresentationMode",
    () => initializePresentationMode,
    (value) => {
      initializePresentationMode = value;
    },
  );
  bindRuntimeValue(runtime, "getInertProps", () => getInertProps);
  bindRuntimeValue(
    runtime,
    "reactInertProps",
    () => reactInertProps,
    (value) => {
      reactInertProps = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactMajorVersion",
    () => reactMajorVersion,
    (value) => {
      reactMajorVersion = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "supportsBooleanInert",
    () => supportsBooleanInert,
    (value) => {
      supportsBooleanInert = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeInertProps",
    () => initializeInertProps,
    (value) => {
      initializeInertProps = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useForwardedOverlayActions",
    () => useForwardedOverlayActions,
  );
  bindRuntimeValue(
    runtime,
    "reactOverlayActions",
    () => reactOverlayActions,
    (value) => {
      reactOverlayActions = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeOverlayActions",
    () => initializeOverlayActions,
    (value) => {
      initializeOverlayActions = value;
    },
  );
  bindRuntimeValue(runtime, "createMutableValue", () => createMutableValue);
  bindRuntimeValue(runtime, "getSheetFrameHeight", () => getSheetFrameHeight);
  bindRuntimeValue(
    runtime,
    "getStackedSheetHeight",
    () => getStackedSheetHeight,
  );
  bindRuntimeValue(runtime, "useSheetFrame", () => useSheetFrame);
  bindRuntimeValue(runtime, "useIsSheet", () => useIsSheet);
  bindRuntimeValue(runtime, "useSheetState", () => useSheetState);
  bindRuntimeValue(runtime, "isLiveRegionEvent", () => isLiveRegionEvent);
  bindRuntimeValue(runtime, "useAdaptiveSheet", () => useAdaptiveSheet);
  bindRuntimeValue(runtime, "ResetSheetContexts", () => ResetSheetContexts);
  bindRuntimeValue(
    runtime,
    "FloatingPositionRenderProp",
    () => FloatingPositionRenderProp,
  );
  bindRuntimeValue(runtime, "SheetContextProvider", () => SheetContextProvider);
  bindRuntimeValue(runtime, "useControllableOpen", () => useControllableOpen);
  bindRuntimeValue(runtime, "useHasSheetFrame", () => useHasSheetFrame);
  bindRuntimeValue(
    runtime,
    "useSheetCapablePresentation",
    () => useSheetCapablePresentation,
  );
  bindRuntimeValue(
    runtime,
    "useSheetImplementation",
    () => useSheetImplementation,
  );
  bindRuntimeValue(
    runtime,
    "reactAdaptiveSheets",
    () => reactAdaptiveSheets,
    (value) => {
      reactAdaptiveSheets = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxAdaptiveSheets",
    () => jsxAdaptiveSheets,
    (value) => {
      jsxAdaptiveSheets = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sheetFrameContext",
    () => sheetFrameContext,
    (value) => {
      sheetFrameContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getStackedSheetCanGrow",
    () => getStackedSheetCanGrow,
    (value) => {
      getStackedSheetCanGrow = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sheetParentContext",
    () => sheetParentContext,
    (value) => {
      sheetParentContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sheetStateContext",
    () => sheetStateContext,
    (value) => {
      sheetStateContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "inertElementProps",
    () => inertElementProps,
    (value) => {
      inertElementProps = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SHEET_IMPLEMENTATION_WAIT_MS",
    () => SHEET_IMPLEMENTATION_WAIT_MS,
    (value) => {
      SHEET_IMPLEMENTATION_WAIT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sheetImplementationUnavailable",
    () => sheetImplementationUnavailable,
    (value) => {
      sheetImplementationUnavailable = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sheetImplementationWaiters",
    () => sheetImplementationWaiters,
    (value) => {
      sheetImplementationWaiters = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ambientCloseReasons",
    () => ambientCloseReasons,
    (value) => {
      ambientCloseReasons = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SHEET_UNCOVER_CLOSE_GRACE_MS",
    () => SHEET_UNCOVER_CLOSE_GRACE_MS,
    (value) => {
      SHEET_UNCOVER_CLOSE_GRACE_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LIVE_REGION_SELECTOR",
    () => LIVE_REGION_SELECTOR,
    (value) => {
      LIVE_REGION_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultSheetState",
    () => defaultSheetState,
    (value) => {
      defaultSheetState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "emptySheetRef",
    () => emptySheetRef,
    (value) => {
      emptySheetRef = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultSheetHost",
    () => defaultSheetHost,
    (value) => {
      defaultSheetHost = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "concealedSheetHost",
    () => concealedSheetHost,
    (value) => {
      concealedSheetHost = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sheetCoverContext",
    () => sheetCoverContext,
    (value) => {
      sheetCoverContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeAdaptiveSheets",
    () => initializeAdaptiveSheets,
    (value) => {
      initializeAdaptiveSheets = value;
    },
  );
  bindRuntimeValue(runtime, "isReducedMotion", () => isReducedMotion);
  bindRuntimeValue(
    runtime,
    "reactReducedMotion",
    () => reactReducedMotion,
    (value) => {
      reactReducedMotion = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "REDUCED_MOTION_QUERY",
    () => REDUCED_MOTION_QUERY,
    (value) => {
      REDUCED_MOTION_QUERY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "REDUCED_MOTION_ATTRIBUTE",
    () => REDUCED_MOTION_ATTRIBUTE,
    (value) => {
      REDUCED_MOTION_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeReducedMotion",
    () => initializeReducedMotion,
    (value) => {
      initializeReducedMotion = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SHEET_DURATION_CLASS",
    () => SHEET_DURATION_CLASS,
    (value) => {
      SHEET_DURATION_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sheetTransitionClasses",
    () => sheetTransitionClasses,
    (value) => {
      sheetTransitionClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sheetRadiusClasses",
    () => sheetRadiusClasses,
    (value) => {
      sheetRadiusClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sheetPopupClasses",
    () => sheetPopupClasses,
    (value) => {
      sheetPopupClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SHEET_DISMISS_TRANSLATE_CSS",
    () => SHEET_DISMISS_TRANSLATE_CSS,
    (value) => {
      SHEET_DISMISS_TRANSLATE_CSS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sheetDrillBodyClasses",
    () => sheetDrillBodyClasses,
    (value) => {
      sheetDrillBodyClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sheetBackdropClasses",
    () => sheetBackdropClasses,
    (value) => {
      sheetBackdropClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "transparentSheetBackdropClasses",
    () => transparentSheetBackdropClasses,
    (value) => {
      transparentSheetBackdropClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sheetOverflowBackgroundClasses",
    () => sheetOverflowBackgroundClasses,
    (value) => {
      sheetOverflowBackgroundClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sheetClipClasses",
    () => sheetClipClasses,
    (value) => {
      sheetClipClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sheetSeparatorClasses",
    () => sheetSeparatorClasses,
    (value) => {
      sheetSeparatorClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetClassNames",
    () => initializeSheetClassNames,
    (value) => {
      initializeSheetClassNames = value;
    },
  );
  bindRuntimeValue(runtime, "resetSheetDragStyle", () => resetSheetDragStyle);
  bindRuntimeValue(runtime, "useSheetDrag", () => useSheetDrag);
  bindRuntimeValue(
    runtime,
    "reactSheetDrag",
    () => reactSheetDrag,
    (value) => {
      reactSheetDrag = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetDrag",
    () => initializeSheetDrag,
    (value) => {
      initializeSheetDrag = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "THEME_TOKEN_SCHEMA_DESCRIPTION",
    () => THEME_TOKEN_SCHEMA_DESCRIPTION,
    (value) => {
      THEME_TOKEN_SCHEMA_DESCRIPTION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "typographyScaleNames",
    () => typographyScaleNames,
    (value) => {
      typographyScaleNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "typographyWeightNames",
    () => typographyWeightNames,
    (value) => {
      typographyWeightNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "themeTokenKeys",
    () => themeTokenKeys,
    (value) => {
      themeTokenKeys = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "themeTokenManifest",
    () => themeTokenManifest,
    (value) => {
      themeTokenManifest = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeThemeTokenManifest",
    () => initializeThemeTokenManifest,
    (value) => {
      initializeThemeTokenManifest = value;
    },
  );
  return () => {
    initializeAccentColors = (0, runtime.initializeOnce)(() => {
      accentColorNames = [
        "red",
        "orange",
        "yellow",
        "green",
        "aqua",
        "blue",
        "violet",
        "magenta",
      ];
    });
    MOBILE_COARSE_POINTER_QUERY = "(pointer: coarse) and (max-width: 639.98px)";
    subscribeNoop = () => () => {
      return;
    };
    getFalseSnapshot = () => false;
    COARSE_POINTER_QUERY_rG = "(pointer: coarse)";
    initializeMediaQueryStores = (0, runtime.initializeOnce)(() => {
      reactMediaQuery = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      mediaQueryStores = new WeakMap();
    });
    initializeCoarsePointerStores = (0, runtime.initializeOnce)(() => {
      initializeMediaQueryStores();
      coarsePointerStores = new WeakMap();
    });
    initializeErrorReporting = () => {};
    initializeSafeObservers = (0, runtime.initializeOnce)(() => {
      initializeErrorReporting();
    });
    isSupportedFont = (input: string) =>
      Object.hasOwn(supportedFonts, input);
    readDocumentFont = () => {
      if (typeof document === "undefined") {
        return;
      }
      let attribute = document.documentElement.getAttribute("data-font");
      if (attribute !== null && isSupportedFont(attribute)) {
        return attribute;
      } else {
        return undefined;
      }
    };
    subscribeFontNoop = () => () => {
      return;
    };
    getUndefinedFontSnapshot = () => {
      return;
    };
    initializeDocumentFont = (0, runtime.initializeOnce)(() => {
      initializeSafeObservers();
      reactDocumentFont = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      supportedFonts = {
        anthropic: true,
        system: true,
      };
    });
    initializeFeatureFlags = (0, runtime.initializeOnce)(() => {
      reactFeatureFlags = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      featureFlagContext = reactFeatureFlags.createContext<string | undefined>(
        undefined,
      );
    });
    initializeInputDismissalTracking = (0, runtime.initializeOnce)(
      () => {
        inputDismissalStates = new WeakMap();
        dismissalKeys = new Set(["Escape", "Enter", " "]);
      },
    );
    initializeTransitionRunner = () => {};
    initializeIsomorphicLayoutEffect = (0, runtime.initializeOnce)(
      () => {
        reactIsomorphicLayoutEffect = (0, runtime.toModuleNamespace)(
          (0, runtime.loadReactNamespace)(),
          1,
        );
        useIsomorphicLayoutEffect =
          typeof window !== "undefined"
            ? reactIsomorphicLayoutEffect.useLayoutEffect
            : reactIsomorphicLayoutEffect.useEffect;
      },
    );
    initializeResizeObserverAccess = () => {};
    initializeAndroidCloseWatcher = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeCdsRoot)();
      reactAndroidCloseWatcher = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
    });
    initializeSheetDragSettings = (0, runtime.initializeOnce)(() => {
      sheetDragSettings = {
        detentThreshold: 40,
        dismissFraction: 0.25,
        flingVelocity: 0.8,
        rubberBand: 0.55,
        overshootRoom: 0.5,
      };
    });
    SAFE_AREA_TOP_CSS = "env(safe-area-inset-top, 0px)";
    MAX_SHEET_HEIGHT_FRACTION = 0.9;
    SHEET_DENSITY = "comfortable";
    MIN_SHEET_HEIGHT_FRACTION = 0.5;
    initializeSheetStyles = (0, runtime.initializeOnce)(() => {
      initializeSheetDragSettings();
      VIEWPORT_HEIGHT_EXCLUDING_SAFE_AREA_CSS = `(100dvh - ${SAFE_AREA_TOP_CSS})`;
      baseSheetPositionerStyle = {
        position: "fixed",
        top: "auto",
        right: 0,
        bottom: 0,
        left: 0,
        width: "auto",
        minWidth: 0,
        maxWidth: "none",
        transform: "none",
        scrollMarginTop: SAFE_AREA_TOP_CSS,
      };
      sheetPositioningOverrides = {
        disableAnchorTracking: true,
        collisionAvoidance: {
          side: "none",
          align: "none",
        },
      };
      MAX_SHEET_HEIGHT_CSS = `calc(${VIEWPORT_HEIGHT_EXCLUDING_SAFE_AREA_CSS} * ${MAX_SHEET_HEIGHT_FRACTION})`;
      MAX_SHEET_OVERSHOOT_HEIGHT_CSS = `calc(${VIEWPORT_HEIGHT_EXCLUDING_SAFE_AREA_CSS} * ${MAX_SHEET_HEIGHT_FRACTION + 0.09999999999999998 * sheetDragSettings.overshootRoom})`;
      MIN_SHEET_HEIGHT_CSS = `${MIN_SHEET_HEIGHT_FRACTION * 100}dvh`;
    });
    initializeElementAccess = () => {};
    initializeEventCallbacks = (0, runtime.initializeOnce)(() => {
      reactEventCallbacks = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
    });
    EDITABLE_ELEMENT_SELECTOR =
      'input:not([type=button],[type=checkbox],[type=radio],[type=range],[type=submit],[type=reset],[type=color],[type=file],[type=image],[type=hidden],[readonly]), textarea:not([readonly]), [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]';
    KEYBOARD_MINIMUM_HEIGHT = 120;
    VIEWPORT_SCALE_TOLERANCE = 0.01;
    initializeVisualKeyboard = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeCdsRoot)();
      initializeElementAccess();
      initializeEventCallbacks();
      reactVisualKeyboard = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
    });
    SHEET_DRILLED_ATTRIBUTE = "data-cds-sheet-drilled";
    SHEET_COVERED_ATTRIBUTE = "data-cds-sheet-covered";
    SHEET_PEELING_ATTRIBUTE = "data-cds-sheet-peeling";
    SHEET_TREE_CLOSING_ATTRIBUTE = "data-cds-sheet-tree-closing";
    SHEET_SCROLL_ATTRIBUTE = "data-cds-sheet-scroll";
    SHEET_PRESSED_ATTRIBUTE = "data-cds-sheet-pressed";
    SHEET_CONTROL_HELD_ATTRIBUTE = "data-cds-sheet-control-held";
    OVERLAY_CLOSE_FALLBACK_MS = 1000;
    initializePresentationMode = (0, runtime.initializeOnce)(() => {
      initializeMediaQueryStores();
      initializeIsomorphicLayoutEffect();
      (0, runtime.initializeCdsRoot)();
      initializeVisualKeyboard();
      reactPresentationMode = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      presentationModeContext = reactPresentationMode.createContext("auto");
    });
    initializeInertProps = (0, runtime.initializeOnce)(() => {
      reactInertProps = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      reactMajorVersion = Number.parseInt(reactInertProps.version, 10);
      supportsBooleanInert =
        !Number.isFinite(reactMajorVersion) ||
        reactMajorVersion === 0 ||
        reactMajorVersion >= 19;
    });
    initializeOverlayActions = (0, runtime.initializeOnce)(() => {
      reactOverlayActions = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
    });
    getStackedSheetCanGrow = (input: readonly SheetLevel[]) =>
      input.at(-1)?.grows ?? true;
    SHEET_IMPLEMENTATION_WAIT_MS = 600;
    sheetImplementationUnavailable = false;
    SHEET_UNCOVER_CLOSE_GRACE_MS = 120;
    LIVE_REGION_SELECTOR =
      '[data-cds="Toast"], [aria-live]:not([aria-live="off"]), [role="status"], [role="alert"], [role="log"]';
    emptySheetRef = () => {
      return;
    };
    initializeAdaptiveSheets = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeSheetImplementation)();
      initializeIsomorphicLayoutEffect();
      (0, runtime.initializeCdsRoot)();
      initializeAndroidCloseWatcher();
      initializeEventCallbacks();
      initializeInertProps();
      initializeOverlayActions();
      initializeVisualKeyboard();
      initializeSheetStyles();
      initializePresentationMode();
      reactAdaptiveSheets = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxAdaptiveSheets = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      sheetFrameContext = reactAdaptiveSheets.createContext<SheetFrame | null>(
        null,
      );
      sheetParentContext = reactAdaptiveSheets.createContext<SheetParent | null>(
        null,
      );
      sheetStateContext = reactAdaptiveSheets.createContext<{ sheet: boolean; pending: boolean; covered: boolean; inert: boolean; depth: number }>({
        sheet: false,
        pending: false,
        covered: false,
        inert: false,
        depth: 0,
      });
      inertElementProps = getInertProps(true);
      sheetImplementationWaiters = new Set();
      ambientCloseReasons = new Set([
        "outside-press",
        "focus-out",
        "escape-key",
      ]);
      defaultSheetState = {
        sheet: false,
        pending: false,
        covered: false,
        inert: false,
        depth: 0,
      };
      defaultSheetHost = {
        sheet: false,
        concealed: false,
        chrome: null,
        ref: emptySheetRef,
        style: undefined,
        positionerStyle: undefined,
        attrs: {},
        frame: null,
        state: defaultSheetState,
        stack: null,
      };
      concealedSheetHost = {
        ...defaultSheetHost,
        concealed: true,
      };
      sheetCoverContext = reactAdaptiveSheets.createContext<
        SheetStack["cover"] | null
      >(null);
    });
    REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
    REDUCED_MOTION_ATTRIBUTE = "data-reduce-motion";
    initializeReducedMotion = (0, runtime.initializeOnce)(() => {
      reactReducedMotion = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
    });
    SHEET_DURATION_CLASS = "duration-sheet";
    sheetRadiusClasses = "rounded-t-card rounded-b-none";
    SHEET_DISMISS_TRANSLATE_CSS = "calc(100% + 1.5rem)";
    transparentSheetBackdropClasses =
      "draggable-none fixed inset-0 bg-transparent";
    sheetOverflowBackgroundClasses =
      "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-[100dvh] after:bg-surface-3";
    sheetClipClasses = "[clip-path:inset(0_0_-200vh_0)]";
    sheetSeparatorClasses =
      "[&_[role=separator]]:-mx-1 [&_[role=separator]]:mt-0";
    initializeSheetClassNames = (0, runtime.initializeOnce)(() => {
      sheetTransitionClasses = `${SHEET_DURATION_CLASS} ease-out motion-reduce:transition-none`;
      sheetPopupClasses = `group/sheet relative w-full min-w-0 max-w-none overflow-hidden ${sheetRadiusClasses} pb-[max(env(safe-area-inset-bottom),0.5rem)] transition-[translate,height,scale] ${sheetTransitionClasses} [&_[data-cds-sheet-scroll]]:overscroll-contain [&[data-cds-sheet-pressed]_[data-cds-sheet-scroll]]:[scroll-padding-block:0px]`;
      sheetDrillBodyClasses = `flex min-h-0 flex-1 flex-col transition-[translate] ${sheetTransitionClasses} group-data-[cds-sheet-drilled]/sheet:-translate-x-full rtl:group-data-[cds-sheet-drilled]/sheet:translate-x-full`;
      sheetBackdropClasses = `draggable-none fixed inset-0 bg-backdrop transition-opacity ${sheetTransitionClasses} data-[starting-style]:opacity-0 data-[ending-style]:opacity-0`;
    });
    initializeSheetDrag = (0, runtime.initializeOnce)(() => {
      initializeIsomorphicLayoutEffect();
      initializeReducedMotion();
      initializeSheetDragSettings();
      initializeSheetStyles();
      initializeAdaptiveSheets();
      initializeSheetClassNames();
      reactSheetDrag = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
    });
    THEME_TOKEN_SCHEMA_DESCRIPTION =
      "GENERATED by `yarn gen:tokens` from tokens/theme.ts (key names of theme-extend.json sections, for src/utils/cn.ts)";
    initializeThemeTokenManifest = (0, runtime.initializeOnce)(() => {
      typographyScaleNames = [
        "caption",
        "footnote",
        "code",
        "body",
        "prose",
        "heading",
        "title",
      ];
      typographyWeightNames = ["regular", "medium", "semibold", "bold"];
      themeTokenKeys = {
        borderRadius: ["composer", "card", "chip"],
        boxShadow: [
          "sm",
          "md",
          "lg",
          "popover",
          "drop-ring",
          "drop-ring-danger",
          "drop-glow",
          "drop-glow-danger",
          "focus",
          "focus-danger",
          "field",
          "field-pressed",
          "field-drop",
          "field-ring",
          "field-hover",
          "field-invalid",
          "panel",
          "panel-sm",
          "panel-md",
          "panel-lg",
          "card-ring",
          "composer",
          "composer-hover",
          "composer-focus",
          "ring-accent",
          "ring-pro",
          "ring-warning",
          "ring-danger",
          "ring-success",
        ],
        cursor: ["interactive"],
        fontFamily: ["mono", "mono-ui", "sans", "sans-display", "voice"],
        fontWeight: ["medium", "semibold", "bold", "normal"],
        gap: ["xs", "sm", "md", "lg", "xl"],
        height: ["control", "control-nested", "icon"],
        margin: [
          "pad-xs",
          "pad-sm",
          "pad-md",
          "pad-lg",
          "pad-xl",
          "xs",
          "sm",
          "md",
          "lg",
          "xl",
        ],
        minHeight: ["control"],
        opacity: ["disabled", "icon-secondary"],
        padding: ["xs", "sm", "md", "lg", "xl"],
        size: ["control", "control-nested", "icon"],
        transitionDuration: ["fast", "snap", "base", "sheet", "slow"],
        transitionTimingFunction: ["out", "snap", "overshoot"],
        width: ["control", "control-nested", "icon"],
        zIndex: ["modal", "coachmark", "popover", "tooltip", "toast"],
      };
      themeTokenManifest = {
        $schema: THEME_TOKEN_SCHEMA_DESCRIPTION,
        TYPE_SCALE: typographyScaleNames,
        TYPE_WEIGHT_NAMES: typographyWeightNames,
        themeKeys: themeTokenKeys,
      };
    });
  };
}
