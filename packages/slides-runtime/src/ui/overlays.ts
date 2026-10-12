/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type CssVariableStyle,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactDomNamespace,
  type ReactNamespace,
} from "../bindings";
import type {
  Context,
  CSSProperties,
  FocusEvent as ReactFocusEvent,
  ForwardRefExoticComponent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  ReactNode,
  Ref,
  RefAttributes,
  RefObject,
} from "react";
import type { Menu as BaseMenu } from "@base-ui/react/menu";
import type { BaseUIEvent } from "@base-ui/react/types";
import type { SheetImplementation, SheetLevelHandle, SheetOpenChangeDetails } from "./foundation";
import type {
  CollisionPadding,
  ContainerSource,
  ExperimentalThemeConfiguration,
  OverlayOwnerResolver,
  SheetPopupHostState,
  TranslateLabel,
  TranslationValues,
} from "./interactions";

/** Open-change details the overlay helpers read (a subset of Base UI's change-event details). */
export interface OpenChangeDetails {
  reason: string;
  event?: Event & { detail?: number };
  trigger?: Element;
  isCanceled?: boolean;
  cancel?: () => void;
}
/** Open-state callback; bivariant so Base UI handlers with narrower details are accepted. */
export type OpenChangeHandler = {
  bivarianceHack(open: boolean, details: OpenChangeDetails): void;
}["bivarianceHack"];

export interface OverlayFocusReturnOptions {
  open?: boolean;
  skipRestoreOnOutsideFocus?: boolean;
  registerOpenerReturn?: boolean;
  triggerRef?: RefObject<Element | null>;
}
export interface OverlayFocusReturn {
  /** Base UI `finalFocus`: `false` skips restoring, `null` lets Base UI decide, an element receives focus. */
  finalFocus: () => false | null | HTMLElement;
  popupRef: RefObject<HTMLElement | null>;
}

/** An overlay nested inside another that can be asked to close. */
export interface InnerOverlay {
  isOpen: () => boolean;
  close: () => void;
}
/** Registry of the open overlays nested inside one popup. */
export interface OverlayStack {
  register: (overlay: InnerOverlay) => () => void;
  topmostOpen: () => InnerOverlay | undefined;
}
export interface InnerOverlayCloseEvent {
  currentTarget?: (EventTarget & { nodeType?: number; defaultView?: Window | null }) | null;
  preventDefault: () => void;
}
export interface InnerOverlayCloseDetails {
  reason: string;
  cancel?: () => void;
  event?: InnerOverlayCloseEvent;
}
export interface MenuOverlayRegistration {
  elementRef: RefObject<HTMLElement | null>;
  overlayAttrs: Record<string, string>;
}

/** Mouse-down event as dispatched on a focus-forwarding container. */
export interface ElementMouseDownEvent {
  button: number;
  target: HTMLElement;
  currentTarget: HTMLElement;
  nativeEvent: MouseEvent;
  preventDefault: () => void;
}
export interface ClickToFocusOptions {
  disabled?: boolean;
  readOnly?: boolean;
  shouldIgnoreTarget?: (target: Element) => boolean;
}
/** Pointer event on a popup, checked for whether it may take focus. */
export interface PopupPointerEvent {
  target: EventTarget | null;
  currentTarget: Element;
  nativeEvent: MouseEvent;
}

/** How a passively opened popup treats focus: not at all, declined, or only through hover. */
export type PassiveOpenLevel = "off" | "declared" | "hover";
export type PassiveInteractionType = "" | "keyboard" | "mouse";
export type PassiveInitialFocus =
  | boolean
  | ((interactionType: PassiveInteractionType) => unknown);
export type PassiveFinalFocus =
  | boolean
  | RefObject<HTMLElement | null>
  | ((closeType: PassiveInteractionType) => unknown)
  | null;
export interface PassiveOpenCell {
  getLevel: () => PassiveOpenLevel;
  subscribe: (listener: () => void) => () => void;
  engage: () => void;
  registerPopup: (element: HTMLElement | null) => void;
  declareFocusProps: (
    initialFocus: PassiveInitialFocus | undefined,
    finalFocus: PassiveFinalFocus | undefined,
  ) => void;
  getPopup: () => HTMLElement | null;
  getTrigger: () => HTMLElement | null;
}
export interface PassiveOpenState {
  cell: PassiveOpenCell;
  renderedWith: (
    open: boolean | undefined,
    onOpenChange: OpenChangeHandler | undefined,
    allowHover: boolean,
  ) => void;
  onOpenChange: (open: boolean, details: OpenChangeDetails) => void;
}
export interface PassiveOpenContextValue {
  cell: PassiveOpenCell | null;
  root: PassiveOpenCell | null;
}
export interface PassiveFocusProps {
  tabIndex?: undefined;
}
/** Props of a popup element that the passive-open gate may rewrite. */
export interface PassivePopupProps {
  tabIndex?: number;
  finalFocus?: BaseMenu.Popup.Props["finalFocus"];
  onFocus?: { handle(event: ReactFocusEvent<HTMLElement>): void }["handle"];
  onMouseDown?: { handle(event: ReactMouseEvent<HTMLElement>): void }["handle"];
  onKeyDown?: { handle(event: ReactKeyboardEvent<HTMLElement>): void }["handle"];
  [key: string]: unknown;
}
export type PassivePopupPropsTransform = (
  props: PassivePopupProps,
) => PassivePopupProps;
export interface PassiveOpenGateProps {
  cell: PassiveOpenCell | null;
  nested?: boolean;
  children: (transformPopupProps: PassivePopupPropsTransform) => ReactNode;
}
export interface TrackedMenuTrigger {
  triggerRef: RefObject<Element | null>;
  onOpenChange: (open: boolean, details: OpenChangeDetails) => void;
}

/** Side and alignment a popup actually ended up with, read back from its data attributes. */
export interface PopupPlacement {
  side: string | undefined;
  align: string | undefined;
}
/** Styles that keep a popup anchored at the bottom while its content shrinks. */
export interface HeldPopupStyle {
  positionerStyle: CSSProperties;
  positionerClassName: string;
  popupClassName: string;
}
export interface StablePopupPlacementOptions {
  enabled: boolean;
  side?: string;
  align?: string;
}
export interface StablePopupPlacement {
  positionerRef: ((element: HTMLElement | null) => void) | undefined;
  popupRef: (element: HTMLElement | null) => void;
  side: string | undefined;
  align: string | undefined;
  held: HeldPopupStyle | null;
}

/** When the inert state of a modal's surroundings should be lifted after it closes. */
export type SheetInertReleaseTiming = "now" | "after-paint";
export interface ModalPortalInertOptions {
  node: HTMLElement | null;
  open: boolean;
  liftOnClose?: () => SheetInertReleaseTiming;
}
export interface KeyEventLike {
  key: string;
  preventDefault: () => void;
  stopPropagation: () => void;
}
/** Sheet-backed popup state read by the scrim components. */
export interface SheetBackdropProps {
  sheetPopup: Pick<SheetPopupHostState, "frame" | "state">;
}
export interface PopoverSheetBodyProps {
  sheetPopup: Pick<SheetPopupHostState, "chrome" | "stack">;
  className?: string;
  bodyRef?: Ref<HTMLDivElement>;
  bodyClassName?: string;
  closeLabel?: string;
  children?: ReactNode;
}

/** Event the link handlers receive (click, pointer or focus). */
export type LinkEvent =
  | ReactMouseEvent<Element>
  | ReactPointerEvent<Element>
  | ReactFocusEvent<Element>;
/** Link event handler; declared as a method so handlers written for one event kind are accepted. */
export type LinkEventHandler = { handle(event: LinkEvent): void }["handle"];
/** Events that CDS links forward to the router for prefetching. */
export type LinkEventName =
  | "onPointerEnter"
  | "onPointerLeave"
  | "onPointerDown"
  | "onFocus"
  | "onBlur";
export type LinkEventPropName = "onClick" | LinkEventName;
export type LinkEventHandlers = { [Name in LinkEventPropName]?: LinkEventHandler };
/** Any props object that may carry link event handlers. */
export type LinkEventSource = LinkEventHandlers & object;
/** Router a CdsRoot hands to its links. */
export interface CdsRouter {
  resolveHref?: (href: string) => string;
  navigate: (href: string, options?: unknown) => void;
  intentHandlers?: (href: string) => LinkEventHandlers | undefined;
}
/** Link state used to decide whether the router handles a click. */
export interface RouterLinkCandidate {
  href: string | undefined;
  target: string | undefined;
  download: string | boolean | null | undefined;
  router: boolean;
}
export interface CdsLinkOptions extends LinkEventHandlers {
  href?: string;
  routerOptions?: unknown;
  target?: string;
  rel?: string | null;
  download?: string | boolean | null;
}
export interface CdsLinkProps extends LinkEventHandlers {
  href: string | undefined;
  target: string | undefined;
  rel: string | undefined;
  download: string | boolean | null | undefined;
  onClick: (event: ReactMouseEvent<Element>) => void;
}
/** Density preset of a CdsRoot. */
export type CdsDensity = "compact" | "comfortable";
/** Control sizes accepted by CDS controls; "xxs" has no density offset. */
export type CdsControlSize = "xxs" | "xs" | "sm" | "base" | "lg";
export type CdsColorMode = "light" | "dark";
/** Value of the `mode` prop; "auto" and "system" follow the operating system. */
export type CdsRootMode = CdsColorMode | "auto" | "system";
export type CdsPlatform = "web" | "desktop";
/** External store (for useSyncExternalStore) holding the color mode of a CdsRoot. */
export interface ColorModeStore {
  setElement: (element: HTMLElement | null) => void;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => CdsColorMode | undefined;
  getServerSnapshot: () => CdsColorMode | undefined;
  getAttrSnapshot: () => string | undefined;
  getServerAttrSnapshot: () => string | undefined;
  getSettingSnapshot: () => string | undefined;
  getServerSettingSnapshot: () => string | undefined;
}
export interface CdsExperimentalOptions {
  densityOverride?: CdsDensity;
  naturalImageTiles?: boolean;
  theme?: ExperimentalThemeConfiguration;
  fizzyLake?: { parts?: readonly string[] };
}
/** A `render` element that may also be a lazy element (checked through `$$typeof`). */
export type CdsRenderElement = ReactElement & { $$typeof?: symbol };
export interface CdsRootProps {
  density?: CdsDensity;
  mode?: CdsRootMode;
  platform?: CdsPlatform;
  font?: string;
  /** `null` clears the inherited monospace font. */
  fontMono?: string | null;
  pageBackground?: string;
  locale?: string;
  router?: CdsRouter;
  labels?: TranslateLabel;
  experimental?: CdsExperimentalOptions;
  render?: CdsRenderElement;
  className?: string;
  children?: ReactNode;
}
/** CSS rule fields read while scanning layer declarations; each exists only on the rule class the scan checks for. */
export interface LayerRuleFields {
  nameList: Iterable<string>;
  name: string;
  layerName: string | null;
  styleSheet: CSSStyleSheet | null;
}
/** Ref the menu root exposes through `menuRootIdentityContext`; only `close` is read here. */
export interface MenuRootRef {
  current?: { close?: () => void } | null;
}
/** Function component that carries a `displayName`. */
export interface DisplayNamedComponent {
  displayName?: string;
}

type MenuPositionerProps = BaseMenu.Positioner.Props;
/** Where a menu popup opens relative to its anchor, and where focus goes when it closes. */
export interface MenuPopupPlacement {
  side?: MenuPositionerProps["side"];
  align?: MenuPositionerProps["align"];
  sideOffset?: MenuPositionerProps["sideOffset"];
  collisionPadding?: CollisionPadding;
  finalFocus?: BaseMenu.Popup.Props["finalFocus"];
}
export interface ContextMenuPopupFrameProps
  extends MenuPopupPlacement,
    Omit<BaseMenu.Popup.Props, "finalFocus" | "className" | "children" | "ref"> {
  anchor?: MenuPositionerProps["anchor"];
  className?: string;
  children?: ReactNode;
  "data-cds"?: string;
}
export interface MenuPopupElementProps extends Omit<BaseMenu.Popup.Props, "ref"> {
  /** Restores focus through the popup's own final-focus handling when the menu has none. */
  anchoredWithoutFinalFocus?: boolean;
  cursorAnchored?: boolean;
}
export interface MenuSheetPopupProps
  extends MenuPopupPlacement,
    Omit<BaseMenu.Popup.Props, "finalFocus" | "className" | "children" | "ref"> {
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
export interface MenuItemVariantProps {
  variant?: "default" | "danger" | null;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactOverlayFocus: ReactNamespace;
    reactOverlayStack: ReactNamespace;
    reactMenuOverlayRegistration: ReactNamespace;
    reactContextMenuPopup: ReactNamespace;
    jsxContextMenuPopup: JsxNamespace;
    reactClickToFocus: ReactNamespace;
    reactPassiveOpen: ReactNamespace;
    jsxPassiveOpen: JsxNamespace;
    reactDomPassiveOpen: ReactDomNamespace;
    reactMenuOpener: ReactNamespace;
    reactMenuPopupElement: ReactNamespace;
    jsxMenuPopupElement: JsxNamespace;
    reactStablePopupPlacement: ReactNamespace;
    reactModalPortalInert: ReactNamespace;
    reactMenuSheetPopup: ReactNamespace;
    jsxMenuSheetPopup: JsxNamespace;
    jsxPopoverSheetBody: JsxNamespace;
    jsxContextMenuSheetBackdrop: JsxNamespace;
    reactSheetImplementation: ReactNamespace;
    reactPreloadSheets: ReactNamespace;
    reactCdsLink: ReactNamespace;
    reactCdsRoot: ReactNamespace;
    jsxCdsRoot: JsxNamespace;
    useCaptureOverlayOpener: (
      open: boolean | undefined,
      openerRef: RefObject<Element | null>,
      rootRef: RefObject<HTMLElement | null>,
      onCaptured?: () => void,
      ownerAncestorsRef?: RefObject<Element[]>,
    ) => void;
    useOverlayFocusReturn: (options?: OverlayFocusReturnOptions) => OverlayFocusReturn;
    resolveConnectedRefElement: <E extends Element>(input?: RefObject<E | null> | null) => E | null;
    useOverlayFinalFocus: (
      open: boolean | undefined,
      takeFocus?: boolean,
      fallbackTriggerRef?: RefObject<HTMLElement | null>,
    ) => OverlayFocusReturn;
    resolveFinalFocusTarget: (
      opener: Element | null | undefined,
      popup: Element | null | undefined,
    ) => false | HTMLElement;
    isTextEntryTarget: (input: Element) => boolean;
    createOverlayStack: () => OverlayStack;
    useRegisterInnerOverlay: (overlay: InnerOverlay) => void;
    isDocumentCurrentTarget: (input?: { currentTarget?: { nodeType?: number } | null }) => boolean;
    interceptEscapeForInnerOverlay: (
      stack: OverlayStack,
      open: boolean,
      details: InnerOverlayCloseDetails,
    ) => boolean;
    useMenuOverlayRegistration: () => MenuOverlayRegistration;
    calculateScrollbarThickness: (offsetSize: number, clientSize: number, borderSize?: number) => number;
    isScrollbarPointerPosition: (offsetX: number, offsetY: number, targetElement: HTMLElement) => boolean;
    useClickToFocus: (
      focus?: () => void,
      options?: ClickToFocusOptions,
    ) => { clickToFocusProps: { onMouseDown: (event: ElementMouseDownEvent) => void } };
    shouldAllowPopupPointerFocus: (event: PopupPointerEvent, options?: { draggable?: boolean }) => boolean;
    closestWithinElement: (targetElement: Element, selector: string, container: Element) => boolean;
    usePassiveOpenState: (
      onOpenChange: OpenChangeHandler | undefined,
      open: boolean | undefined,
      allowHover?: boolean,
    ) => PassiveOpenState;
    createPassiveOpenState: () => PassiveOpenState;
    classifyOpenInputType: (input?: Event & { detail?: number }) => PassiveInteractionType;
    declinesInitialFocus: (
      initialFocus: PassiveInitialFocus | undefined,
      interactionType: PassiveInteractionType,
    ) => boolean;
    getDocumentIfAvailable: () => Document | undefined;
    resolvePassiveFinalFocus: (
      finalFocus: PassiveFinalFocus | undefined,
      fallbackElement: HTMLElement | null,
    ) => HTMLElement | null;
    getFocusedElement: (input?: Document | null) => HTMLElement | null;
    elementIsWithin: (input: Element | null, options: Element | null) => boolean;
    restorePassiveOverlayFocus: (
      documentObject: Document,
      popup: HTMLElement | null,
      opener: HTMLElement,
      blurBeforeRestore: boolean,
    ) => void;
    usePassiveOpenContext: (input: boolean) => PassiveOpenContextValue;
    useMenuPassiveFocusProps: () => PassiveFocusProps;
    PassiveOpenGate: (props: PassiveOpenGateProps) => ReactElement;
    PassiveOpenKeyboardBridge: (props: { cell: PassiveOpenCell }) => null;
    isCanceledOpenWithinTrigger: (input: OpenChangeDetails) => boolean;
    useTrackedMenuTrigger: (
      onOpenChange: OpenChangeHandler | undefined,
      refuseCanceledTriggerOpen?: boolean,
    ) => TrackedMenuTrigger;
    useMenuOpenerRef: () => RefObject<Element | null> | undefined;
    useMenuOwnerRef: (
      input: RefObject<Element | null> | undefined,
      options: PassiveFinalFocus | undefined,
    ) => (element: Element | null) => void;
    initializeOverlayOwners: () => void;
    initializeOverlayFocus: () => void;
    initializeOverlaySelector: () => void;
    initializeOverlayStack: () => void;
    initializeMenuOverlayRegistration: () => void;
    initializeContextMenuPopup: () => void;
    initializeClickToFocus: () => void;
    initializePopupPointerFocus: () => void;
    initializePassiveOpen: () => void;
    initializeMenuItemVariants: () => void;
    initializeMenuOpener: () => void;
    initializeMenuPopupElement: () => void;
    initializeStablePopupPlacement: () => void;
    initializeModalReleasePlatform: () => void;
    initializeModalPortalInert: () => void;
    initializeMenuSheetPopup: () => void;
    initializePopoverSheetBody: () => void;
    initializeContextMenuSheetBackdrop: () => void;
    initializeMobileSheetExports: () => void;
    initializeSheetImplementation: () => void;
    initializePreloadSheets: () => void;
    initializeCdsPlatform: () => void;
    initializeLinkWarnings: () => void;
    initializeHrefWhitespace: () => void;
    initializeLinkTargets: () => void;
    initializeCdsLink: () => void;
    initializeCdsRoot: () => void;
    overlayOwnerResolvers: WeakMap<Element, OverlayOwnerResolver>;
    MAX_OVERLAY_OWNER_DEPTH: number;
    OVERLAY_ATTRIBUTE: string;
    OPEN_OVERLAY_SELECTOR_VQ5: string;
    overlayStackContext: Context<OverlayStack | null>;
    DOCUMENT_NODE_TYPE: number;
    menuOverlayAttributes: Record<string, string>;
    INTERACTIVE_CLICK_TARGET_SELECTOR: string;
    FORM_POINTER_FOCUS_SELECTOR: string;
    SELECT_ELEMENT_SELECTOR: string;
    DRAGGABLE_ELEMENT_SELECTOR: string;
    PASSIVE_HOVER_OPEN_REASON: string;
    PASSIVE_FOCUS_OUT_REASON: string;
    passiveOpenStateContext: Context<PassiveOpenCell | null>;
    passiveFocusDeclinedContext: Context<boolean>;
    passiveDeclinedFocusProps: PassiveFocusProps;
    passiveDefaultFocusProps: PassiveFocusProps;
    passiveOpenEngagementKeys: Set<string>;
    passiveOpenModifierKeys: Set<string>;
    subscribePassiveOpenNoop: () => () => void;
    getPassiveOffSnapshot: () => PassiveOpenLevel;
    unchangedPopupProps: PassivePopupPropsTransform;
    menuOpenerRefContext: Context<RefObject<Element | null> | undefined>;
    MenuOpenerProvider: Context<RefObject<Element | null> | undefined>["Provider"];
    readPopupPlacement: (element: Element) => PopupPlacement;
    arePopupPlacementsEqual: (input: PopupPlacement | null, options: PopupPlacement) => boolean;
    placementNeedsBottomHold: (input: PopupPlacement | null) => boolean;
    useStablePopupPlacement: (options: StablePopupPlacementOptions) => StablePopupPlacement;
    resolvePlatformWindow: (input?: Window) => Window | undefined;
    matchesWindowMediaQuery: (input: string, options?: Window) => boolean;
    useCoarseOrHoverlessPointer: (ownWindow?: Window) => boolean;
    usesImmediateModalRelease: (input?: Window) => boolean;
    subscribeDeviceMediaQueries: (listener: () => void, ownWindow?: Window) => () => void;
    makeOutsidePortalInert: (element: Element) => () => void;
    useModalPortalInert: (options: ModalPortalInertOptions) => () => void;
    canDelayModalInertRelease: (input: Window) => boolean;
    releaseInertAfterPaint: (input: Window, options: () => void, context: () => void) => () => void;
    findOverlayPortalContainer: (element: Element) => Element | null;
    preventModalTabNavigation: (event: KeyEventLike) => void;
    coverParentMenuSheet: (input: Element, options: object) => void;
    uncoverParentMenuSheet: (input: Element, options: object) => void;
    getSheetInertReleaseTiming: (input: SheetOpenChangeDetails | null | undefined) => SheetInertReleaseTiming;
    MenuSheetTitleBar: (props: { nested: boolean }) => ReactElement;
    MenuSheetCloseButton: () => ReactElement;
    PopoverSheetBackdrop: (props: SheetBackdropProps) => ReactElement;
    PopoverSheetBody: (props: PopoverSheetBodyProps) => ReactElement;
    ContextMenuSheetBackdrop: (props: SheetBackdropProps) => ReactElement;
    subscribeSheetImplementation: (input: () => void) => () => void;
    loadSheetImplementation: () => Promise<SheetImplementation | null>;
    preloadSheetImplementation: () => void;
    isSheetImplementationLoaded: () => boolean;
    useSheetImplementationLoaded: () => boolean;
    useSheetImplementationFailed: () => boolean;
    useLoadedSheetImplementation: () => SheetImplementation | null;
    usePreloadSheetsForCoarsePointer: (input: boolean, options?: Window) => void;
    heldPositionerClasses: string;
    heldPopupClasses: string;
    POPUP_PLACEMENT_SETTLE_FRAMES: number;
    COARSE_OR_HOVERLESS_QUERY: string;
    MOBILE_WIDTH_QUERY: string;
    TOUCH_DEVICE_QUERY: string;
    ELECTRON_USER_AGENT_TOKEN: string;
    inertExcludedTags: Set<string>;
    MODAL_INERT_LIVE_REGION_SELECTOR: string;
    modalInertRefCounts: WeakMap<Element, number>;
    coveredMenuSheetOwners: WeakMap<Element, Set<object>>;
    mobileSheetExports: SheetImplementation;
    loadedSheetImplementation: SheetImplementation | null;
    sheetImplementationFailed: boolean;
    sheetImplementationRequests: number;
    sheetImplementationGeneration: number;
    sheetImplementationPromise: Promise<SheetImplementation | null> | null;
    sheetImplementationSubscribers: Set<() => void>;
    getSheetImplementationSnapshot: () => SheetImplementation | null;
    getSheetImplementationLoadedSnapshot: () => boolean;
    getSheetImplementationFailedSnapshot: () => boolean;
    getNullSheetImplementationSnapshot: () => SheetImplementation | null;
    getFalseSheetImplementationSnapshot: () => boolean;
    detectCdsPlatform: () => CdsPlatform;
    desktopPlatformUserAgentPattern: RegExp;
    reportLinkSanitizationDebug: (href: string, replacement: string, reason: string) => void;
    truncateLinkDebugValue: (value: string) => string;
    MAX_LINK_DEBUG_WARNINGS: number;
    MAX_LINK_DEBUG_LENGTH: number;
    reportedLinkWarnings: Set<string>;
    linkWarningLimitReached: boolean;
    normalizeHrefWhitespace: (href: string) => string;
    isSanitizedHrefFallback: (href: string | undefined, sanitized: string | undefined) => boolean;
    linkWhitespacePattern: RegExp;
    opensInSeparateBrowsingContext: (target: string | undefined) => boolean;
    normalizeLinkRel: (target: string | undefined, rel: string | null | undefined, defaultRel: () => string) => string | undefined;
    existingBrowsingContextNames: Set<string>;
    unsafeLinkRelTokenPattern: RegExp;
    useCdsRouter: () => CdsRouter | undefined;
    sanitizeHref: (href: string | undefined) => string | undefined;
    rejectUnsafeHref: (href: string, reason: string) => string;
    validateRelativeHref: (href: string) => string;
    hasUnsafeRelativePath: (href: string) => boolean;
    getHrefPathBeforeQuery: (href: string) => string;
    isAllowedEditorHref: (href: string) => boolean;
    isAllowedAndroidIntentHref: (href: string) => boolean;
    classifyHrefOrigin: (href: string, base: string) => "relative" | "first-party" | "other";
    isOriginStableHref: (href: string | undefined) => boolean;
    getSeparateContextRel: (href: string | undefined) => string;
    getAutomaticLinkRel: (href: string | undefined, target: string | undefined) => string | undefined;
    isSameOriginHref: (href: string) => boolean;
    shouldHandleLinkWithRouter: (link: RouterLinkCandidate) => link is RouterLinkCandidate & { href: string };
    normalizeRouterHref: (href: string) => string;
    isModifiedLinkClick: (event: ReactMouseEvent<Element>) => boolean;
    pickLinkEventProps: (props: LinkEventSource) => LinkEventHandlers;
    omitLinkEventProps: (props: object) => Record<string, unknown>;
    composeLinkEventHandlers: (ownHandler: LinkEventHandler | undefined, routerHandler: LinkEventHandler | undefined, skipWhenPrevented: boolean) => LinkEventHandler | undefined;
    useCdsLink: (options: CdsLinkOptions) => CdsLinkProps;
    cdsRouterContext: Context<CdsRouter | undefined>;
    forbiddenHrefControlCharacterPattern: RegExp;
    leadingHrefWhitespacePattern: RegExp;
    networkPathHrefPattern: RegExp;
    rootRelativeHrefPattern: RegExp;
    unrootedHrefPattern: RegExp;
    relativePathDotSegmentPattern: RegExp;
    dotSegmentPattern: RegExp;
    encodedOrBackslashPathPattern: RegExp;
    allowedHrefSchemePattern: RegExp;
    androidIntentHrefPattern: RegExp;
    editorHrefSchemePattern: RegExp;
    allowedEditorHrefPattern: RegExp;
    allowedIntentPropertyNames: Set<string>;
    absoluteHrefPattern: RegExp;
    trustedFirstPartyDomains: string[];
    trustedAndroidIntentPackages: Set<string>;
    HTTPS_RELATIVE_HREF_BASE: string;
    HTTP_RELATIVE_HREF_BASE: string;
    linkEventPropNames: LinkEventPropName[];
    linkPrefetchEventKinds: Record<LinkEventName, boolean>;
    linkPrefetchEventNames: LinkEventName[];
    getElementWindow: (element: Element | null | undefined) => Window & typeof globalThis;
    elementHasUnavailableWindow: (element: Element | undefined) => boolean;
    getConnectedElementWindow: (element: Element | undefined) => (Window & typeof globalThis) | undefined;
    hasCdsHtmlFontSizing: (element: HTMLElement) => boolean;
    migrateCdsHtmlFontSizing: () => void;
    getControlSizeAttributes: (size?: CdsControlSize) => { "data-size"?: CdsControlSize };
    getDensitySizeIndex: (density: string, size?: CdsControlSize) => number;
    createColorModeStore: (configuredMode?: CdsRootMode) => ColorModeStore;
    usePageBackground: () => string | undefined;
    useDensity: () => CdsDensity;
    useResolvedColorMode: () => CdsColorMode;
    useColorMode: () => CdsColorMode | undefined;
    usePlatform: () => CdsPlatform;
    useFont: () => string | undefined;
    useMonospaceFont: () => string | null | undefined;
    getMonospaceOverrideStyle: (fontMono?: string | null) => CssVariableStyle;
    useSurfaceBackground: () => string | undefined;
    getSurfaceBackgroundStyle: (surface?: string | null) => CssVariableStyle;
    isTintedFillSurface: (surface: string) => boolean;
    sanitizeCssBackground: (background: string) => string;
    isSurfaceToken: (surface: string) => boolean;
    useCdsConfig: () => string | undefined;
    useRootElement: () => HTMLElement | undefined;
    usePortalContainer: () => HTMLElement | undefined;
    useRootWindow: () => Window & typeof globalThis;
    CdsRoot: (props: CdsRootProps) => ReactElement;
    subscribePlatformNoop: () => () => void;
    getWebPlatformSnapshot: () => "web";
    getCoarsePointerServerSnapshot: () => boolean;
    subscribeRootCoarsePointer: (listener: () => void) => () => void;
    hasMigratedHtmlFontSizing: boolean;
    densitySizeIndices: Record<CdsDensity, number>;
    controlSizeOffsets: Partial<Record<CdsControlSize, number>>;
    densityContext: Context<CdsDensity>;
    portalDensityContext: Context<CdsDensity>;
    colorModeStoreContext: Context<ColorModeStore | undefined>;
    defaultColorModeStore: ColorModeStore;
    DARK_COLOR_SCHEME_QUERY: string;
    normalizeColorMode: (mode: string | null | undefined) => "light" | "dark" | "system" | undefined;
    platformContext: Context<CdsPlatform | undefined>;
    fontContext: Context<string | undefined>;
    monospaceFontContext: Context<string | null | undefined>;
    pageBackgroundContext: Context<string | undefined>;
    naturalImageTilesContext: Context<boolean | undefined>;
    densityOverrideContext: Context<CdsDensity | undefined>;
    surfaceBackgroundContext: Context<string | undefined>;
    localeContext: Context<string | undefined>;
    rootElementContext: Context<HTMLElement | undefined>;
    rootPortalContainerContext: Context<HTMLElement | undefined>;
    isPortalRootContext: Context<boolean>;
    opaqueTintOverrides: Record<`--${string}`, string>;
    surfaceTokenNames: Set<string>;
    contextMenuPopupClasses: string;
    ContextMenuPopupFrame: ForwardRefExoticComponent<ContextMenuPopupFrameProps & RefAttributes<HTMLDivElement>>;
    menuItemVariants: (props?: MenuItemVariantProps) => string;
    menuItemDescriptionPaddingClass: string;
    MenuPopupElement: ForwardRefExoticComponent<MenuPopupElementProps & RefAttributes<HTMLDivElement>>;
    MenuSheetPopup: ForwardRefExoticComponent<MenuSheetPopupProps & RefAttributes<HTMLDivElement>>;
  }
}

export function installUiOverlays(runtime: RuntimeBindings): () => void {
  var overlayOwnerResolvers: RuntimeBindings["overlayOwnerResolvers"];
  var MAX_OVERLAY_OWNER_DEPTH: RuntimeBindings["MAX_OVERLAY_OWNER_DEPTH"];
  var initializeOverlayOwners: RuntimeBindings["initializeOverlayOwners"];
  var reactOverlayFocus: ReactNamespace;
  var initializeOverlayFocus: RuntimeBindings["initializeOverlayFocus"];
  var OVERLAY_ATTRIBUTE: RuntimeBindings["OVERLAY_ATTRIBUTE"];
  var OPEN_OVERLAY_SELECTOR_VQ5: RuntimeBindings["OPEN_OVERLAY_SELECTOR_VQ5"];
  var initializeOverlaySelector: RuntimeBindings["initializeOverlaySelector"];
  var reactOverlayStack: ReactNamespace;
  var overlayStackContext: RuntimeBindings["overlayStackContext"];
  var DOCUMENT_NODE_TYPE: RuntimeBindings["DOCUMENT_NODE_TYPE"];
  var initializeOverlayStack: RuntimeBindings["initializeOverlayStack"];
  var reactMenuOverlayRegistration: ReactNamespace;
  var menuOverlayAttributes: RuntimeBindings["menuOverlayAttributes"];
  var initializeMenuOverlayRegistration: RuntimeBindings["initializeMenuOverlayRegistration"];
  var reactContextMenuPopup: ReactNamespace;
  var jsxContextMenuPopup: JsxNamespace;
  var contextMenuPopupClasses: RuntimeBindings["contextMenuPopupClasses"];
  var ContextMenuPopupFrame: RuntimeBindings["ContextMenuPopupFrame"];
  var initializeContextMenuPopup: RuntimeBindings["initializeContextMenuPopup"];
  var reactClickToFocus: ReactNamespace;
  var INTERACTIVE_CLICK_TARGET_SELECTOR: RuntimeBindings["INTERACTIVE_CLICK_TARGET_SELECTOR"];
  var initializeClickToFocus: RuntimeBindings["initializeClickToFocus"];
  var FORM_POINTER_FOCUS_SELECTOR: RuntimeBindings["FORM_POINTER_FOCUS_SELECTOR"];
  var SELECT_ELEMENT_SELECTOR: RuntimeBindings["SELECT_ELEMENT_SELECTOR"];
  var DRAGGABLE_ELEMENT_SELECTOR: RuntimeBindings["DRAGGABLE_ELEMENT_SELECTOR"];
  var initializePopupPointerFocus: RuntimeBindings["initializePopupPointerFocus"];
  var reactPassiveOpen: ReactNamespace;
  var jsxPassiveOpen: JsxNamespace;
  var reactDomPassiveOpen: ReactDomNamespace;
  var PASSIVE_HOVER_OPEN_REASON: RuntimeBindings["PASSIVE_HOVER_OPEN_REASON"];
  var PASSIVE_FOCUS_OUT_REASON: RuntimeBindings["PASSIVE_FOCUS_OUT_REASON"];
  var passiveOpenStateContext: RuntimeBindings["passiveOpenStateContext"];
  var passiveFocusDeclinedContext: RuntimeBindings["passiveFocusDeclinedContext"];
  var passiveDeclinedFocusProps: RuntimeBindings["passiveDeclinedFocusProps"];
  var passiveDefaultFocusProps: RuntimeBindings["passiveDefaultFocusProps"];
  var passiveOpenEngagementKeys: RuntimeBindings["passiveOpenEngagementKeys"];
  var passiveOpenModifierKeys: RuntimeBindings["passiveOpenModifierKeys"];
  var subscribePassiveOpenNoop: RuntimeBindings["subscribePassiveOpenNoop"];
  var getPassiveOffSnapshot: RuntimeBindings["getPassiveOffSnapshot"];
  var unchangedPopupProps: RuntimeBindings["unchangedPopupProps"];
  var initializePassiveOpen: RuntimeBindings["initializePassiveOpen"];
  var menuItemVariants: RuntimeBindings["menuItemVariants"];
  var menuItemDescriptionPaddingClass: RuntimeBindings["menuItemDescriptionPaddingClass"];
  var initializeMenuItemVariants: RuntimeBindings["initializeMenuItemVariants"];
  var reactMenuOpener: ReactNamespace;
  var menuOpenerRefContext: RuntimeBindings["menuOpenerRefContext"];
  var MenuOpenerProvider: RuntimeBindings["MenuOpenerProvider"];
  var initializeMenuOpener: RuntimeBindings["initializeMenuOpener"];
  var reactMenuPopupElement: ReactNamespace;
  var jsxMenuPopupElement: JsxNamespace;
  var MenuPopupElement: RuntimeBindings["MenuPopupElement"];
  var initializeMenuPopupElement: RuntimeBindings["initializeMenuPopupElement"];
  var reactStablePopupPlacement: ReactNamespace;
  var heldPositionerClasses: RuntimeBindings["heldPositionerClasses"];
  var heldPopupClasses: RuntimeBindings["heldPopupClasses"];
  var POPUP_PLACEMENT_SETTLE_FRAMES: RuntimeBindings["POPUP_PLACEMENT_SETTLE_FRAMES"];
  var initializeStablePopupPlacement: RuntimeBindings["initializeStablePopupPlacement"];
  var COARSE_OR_HOVERLESS_QUERY: RuntimeBindings["COARSE_OR_HOVERLESS_QUERY"];
  var MOBILE_WIDTH_QUERY: RuntimeBindings["MOBILE_WIDTH_QUERY"];
  var TOUCH_DEVICE_QUERY: RuntimeBindings["TOUCH_DEVICE_QUERY"];
  var ELECTRON_USER_AGENT_TOKEN: RuntimeBindings["ELECTRON_USER_AGENT_TOKEN"];
  var initializeModalReleasePlatform: RuntimeBindings["initializeModalReleasePlatform"];
  var reactModalPortalInert: ReactNamespace;
  var inertExcludedTags: RuntimeBindings["inertExcludedTags"];
  var MODAL_INERT_LIVE_REGION_SELECTOR: RuntimeBindings["MODAL_INERT_LIVE_REGION_SELECTOR"];
  var modalInertRefCounts: RuntimeBindings["modalInertRefCounts"];
  var initializeModalPortalInert: RuntimeBindings["initializeModalPortalInert"];
  var reactMenuSheetPopup: ReactNamespace;
  var jsxMenuSheetPopup: JsxNamespace;
  var coveredMenuSheetOwners: RuntimeBindings["coveredMenuSheetOwners"];
  var MenuSheetPopup: RuntimeBindings["MenuSheetPopup"];
  var initializeMenuSheetPopup: RuntimeBindings["initializeMenuSheetPopup"];
  var jsxPopoverSheetBody: JsxNamespace;
  var initializePopoverSheetBody: RuntimeBindings["initializePopoverSheetBody"];
  var jsxContextMenuSheetBackdrop: JsxNamespace;
  var initializeContextMenuSheetBackdrop: RuntimeBindings["initializeContextMenuSheetBackdrop"];
  var mobileSheetExports: RuntimeBindings["mobileSheetExports"];
  var initializeMobileSheetExports: RuntimeBindings["initializeMobileSheetExports"];
  var reactSheetImplementation: ReactNamespace;
  var loadedSheetImplementation: RuntimeBindings["loadedSheetImplementation"];
  var sheetImplementationFailed: RuntimeBindings["sheetImplementationFailed"];
  var sheetImplementationRequests: RuntimeBindings["sheetImplementationRequests"];
  var sheetImplementationGeneration: RuntimeBindings["sheetImplementationGeneration"];
  var sheetImplementationPromise: RuntimeBindings["sheetImplementationPromise"];
  var sheetImplementationSubscribers: RuntimeBindings["sheetImplementationSubscribers"];
  var getSheetImplementationSnapshot: RuntimeBindings["getSheetImplementationSnapshot"];
  var getSheetImplementationLoadedSnapshot: RuntimeBindings["getSheetImplementationLoadedSnapshot"];
  var getSheetImplementationFailedSnapshot: RuntimeBindings["getSheetImplementationFailedSnapshot"];
  var getNullSheetImplementationSnapshot: RuntimeBindings["getNullSheetImplementationSnapshot"];
  var getFalseSheetImplementationSnapshot: RuntimeBindings["getFalseSheetImplementationSnapshot"];
  var initializeSheetImplementation: RuntimeBindings["initializeSheetImplementation"];
  var reactPreloadSheets: ReactNamespace;
  var initializePreloadSheets: RuntimeBindings["initializePreloadSheets"];
  var desktopPlatformUserAgentPattern: RuntimeBindings["desktopPlatformUserAgentPattern"];
  var initializeCdsPlatform: RuntimeBindings["initializeCdsPlatform"];
  var MAX_LINK_DEBUG_WARNINGS: RuntimeBindings["MAX_LINK_DEBUG_WARNINGS"];
  var MAX_LINK_DEBUG_LENGTH: RuntimeBindings["MAX_LINK_DEBUG_LENGTH"];
  var reportedLinkWarnings: RuntimeBindings["reportedLinkWarnings"];
  var linkWarningLimitReached: RuntimeBindings["linkWarningLimitReached"];
  var initializeLinkWarnings: RuntimeBindings["initializeLinkWarnings"];
  var linkWhitespacePattern: RuntimeBindings["linkWhitespacePattern"];
  var initializeHrefWhitespace: RuntimeBindings["initializeHrefWhitespace"];
  var existingBrowsingContextNames: RuntimeBindings["existingBrowsingContextNames"];
  var unsafeLinkRelTokenPattern: RuntimeBindings["unsafeLinkRelTokenPattern"];
  var initializeLinkTargets: RuntimeBindings["initializeLinkTargets"];
  var reactCdsLink: ReactNamespace;
  var cdsRouterContext: RuntimeBindings["cdsRouterContext"];
  var forbiddenHrefControlCharacterPattern: RuntimeBindings["forbiddenHrefControlCharacterPattern"];
  var leadingHrefWhitespacePattern: RuntimeBindings["leadingHrefWhitespacePattern"];
  var networkPathHrefPattern: RuntimeBindings["networkPathHrefPattern"];
  var rootRelativeHrefPattern: RuntimeBindings["rootRelativeHrefPattern"];
  var unrootedHrefPattern: RuntimeBindings["unrootedHrefPattern"];
  var relativePathDotSegmentPattern: RuntimeBindings["relativePathDotSegmentPattern"];
  var dotSegmentPattern: RuntimeBindings["dotSegmentPattern"];
  var encodedOrBackslashPathPattern: RuntimeBindings["encodedOrBackslashPathPattern"];
  var allowedHrefSchemePattern: RuntimeBindings["allowedHrefSchemePattern"];
  var androidIntentHrefPattern: RuntimeBindings["androidIntentHrefPattern"];
  var editorHrefSchemePattern: RuntimeBindings["editorHrefSchemePattern"];
  var allowedEditorHrefPattern: RuntimeBindings["allowedEditorHrefPattern"];
  var allowedIntentPropertyNames: RuntimeBindings["allowedIntentPropertyNames"];
  var absoluteHrefPattern: RuntimeBindings["absoluteHrefPattern"];
  var trustedFirstPartyDomains: RuntimeBindings["trustedFirstPartyDomains"];
  var trustedAndroidIntentPackages: RuntimeBindings["trustedAndroidIntentPackages"];
  var HTTPS_RELATIVE_HREF_BASE: RuntimeBindings["HTTPS_RELATIVE_HREF_BASE"];
  var HTTP_RELATIVE_HREF_BASE: RuntimeBindings["HTTP_RELATIVE_HREF_BASE"];
  var linkEventPropNames: RuntimeBindings["linkEventPropNames"];
  var linkPrefetchEventKinds: RuntimeBindings["linkPrefetchEventKinds"];
  var linkPrefetchEventNames: RuntimeBindings["linkPrefetchEventNames"];
  var initializeCdsLink: RuntimeBindings["initializeCdsLink"];
  var reactCdsRoot: ReactNamespace;
  var jsxCdsRoot: JsxNamespace;
  var subscribePlatformNoop: RuntimeBindings["subscribePlatformNoop"];
  var getWebPlatformSnapshot: RuntimeBindings["getWebPlatformSnapshot"];
  var getCoarsePointerServerSnapshot: RuntimeBindings["getCoarsePointerServerSnapshot"];
  var subscribeRootCoarsePointer: RuntimeBindings["subscribeRootCoarsePointer"];
  var hasMigratedHtmlFontSizing: RuntimeBindings["hasMigratedHtmlFontSizing"];
  var densitySizeIndices: RuntimeBindings["densitySizeIndices"];
  var controlSizeOffsets: RuntimeBindings["controlSizeOffsets"];
  var densityContext: RuntimeBindings["densityContext"];
  var portalDensityContext: RuntimeBindings["portalDensityContext"];
  var colorModeStoreContext: RuntimeBindings["colorModeStoreContext"];
  var defaultColorModeStore: RuntimeBindings["defaultColorModeStore"];
  var DARK_COLOR_SCHEME_QUERY: RuntimeBindings["DARK_COLOR_SCHEME_QUERY"];
  var normalizeColorMode: RuntimeBindings["normalizeColorMode"];
  var platformContext: RuntimeBindings["platformContext"];
  var fontContext: RuntimeBindings["fontContext"];
  var monospaceFontContext: RuntimeBindings["monospaceFontContext"];
  var pageBackgroundContext: RuntimeBindings["pageBackgroundContext"];
  var naturalImageTilesContext: RuntimeBindings["naturalImageTilesContext"];
  var densityOverrideContext: RuntimeBindings["densityOverrideContext"];
  var surfaceBackgroundContext: RuntimeBindings["surfaceBackgroundContext"];
  var localeContext: RuntimeBindings["localeContext"];
  var rootElementContext: RuntimeBindings["rootElementContext"];
  var rootPortalContainerContext: RuntimeBindings["rootPortalContainerContext"];
  var isPortalRootContext: RuntimeBindings["isPortalRootContext"];
  var opaqueTintOverrides: RuntimeBindings["opaqueTintOverrides"];
  var surfaceTokenNames: RuntimeBindings["surfaceTokenNames"];
  var initializeCdsRoot: RuntimeBindings["initializeCdsRoot"];
  function useCaptureOverlayOpener(
    open: boolean | undefined,
    openerRef: RefObject<Element | null>,
    rootRef: RefObject<HTMLElement | null>,
    onCaptured?: () => void,
    ownerAncestorsRef?: RefObject<Element[]>,
  ) {
    let rootElement = useRootElement(),
      capturedRef = reactOverlayFocus.useRef(false);
    reactOverlayFocus.useInsertionEffect(() => {
      if (!open) {
        capturedRef.current = false;
        return;
      }
      if (capturedRef.current) {
        return;
      }
      capturedRef.current = true;
      openerRef.current = null;
      rootRef.current = rootElement ?? null;
      let value = rootElement?.ownerDocument ?? document,
        activeElement = value.activeElement,
        value2 =
          activeElement && activeElement !== value.body ? activeElement : null;
      openerRef.current = value2;
      if (ownerAncestorsRef) {
        ownerAncestorsRef.current = (0, runtime.getOverlayOwnerAncestors)(
          value2,
        );
      }
      onCaptured?.();
    }, [open, rootElement, openerRef, rootRef, onCaptured, ownerAncestorsRef]);
  }
  function useOverlayFocusReturn(options?: OverlayFocusReturnOptions): OverlayFocusReturn {
    let skipRestoreOnOutsideFocus =
        options?.skipRestoreOnOutsideFocus ?? false,
      registerOpenerReturn = options?.registerOpenerReturn ?? true,
      triggerRef = options?.triggerRef,
      openerRef = reactOverlayFocus.useRef<Element | null>(null),
      popupRef = reactOverlayFocus.useRef<HTMLElement | null>(null),
      rootRef = reactOverlayFocus.useRef<HTMLElement | null>(null);
    useCaptureOverlayOpener(options?.open ?? true, openerRef, rootRef);
    let shouldRegisterRef =
      reactOverlayFocus.useRef(registerOpenerReturn);
    reactOverlayFocus.useLayoutEffect(() => {
      shouldRegisterRef.current = registerOpenerReturn;
    }, [registerOpenerReturn]);
    reactOverlayFocus.useLayoutEffect(() => {
      if (popupRef.current) {
        (0, runtime.registerOverlayOwner)(popupRef.current, () => {
          if (!shouldRegisterRef.current) {
            return null;
          }
          return resolveConnectedRefElement(triggerRef) ?? openerRef.current;
        });
      }
    }, [triggerRef]);
    let finalFocus = reactOverlayFocus.useCallback(() => {
      if (skipRestoreOnOutsideFocus) {
        let current = popupRef.current,
          value = rootRef.current?.ownerDocument ?? document,
          activeElement = value.activeElement;
        if (
          activeElement &&
          activeElement !== value.body &&
          !current?.contains(activeElement)
        ) {
          return false;
        }
      }
      if (resolveConnectedRefElement(triggerRef) !== null) {
        return null;
      }
      return resolveFinalFocusTarget(openerRef.current, popupRef.current);
    }, [skipRestoreOnOutsideFocus, triggerRef]);
    return reactOverlayFocus.useMemo(
      () => ({
        finalFocus: finalFocus,
        popupRef: popupRef,
      }),
      [finalFocus],
    );
  }
  function resolveConnectedRefElement<E extends Element>(input?: RefObject<E | null> | null): E | null {
    let value = input?.current ?? null;
    if (value?.isConnected) {
      return value;
    } else {
      return null;
    }
  }
  function useOverlayFinalFocus(
    open: boolean | undefined,
    takeFocus = true,
    fallbackTriggerRef?: RefObject<HTMLElement | null>,
  ) {
    let rootElement = useRootElement(),
      fallbackOpenerRef = reactOverlayFocus.useRef<HTMLElement | null>(null),
      needsFocusCheckRef = reactOverlayFocus.useRef(false),
      onCaptured = reactOverlayFocus.useCallback(() => {
        fallbackOpenerRef.current = null;
        needsFocusCheckRef.current = true;
      }, []),
      openerRef = reactOverlayFocus.useRef<Element | null>(null),
      ownerAncestorsRef = reactOverlayFocus.useRef<Element[]>([]),
      popupRef = reactOverlayFocus.useRef<HTMLElement | null>(null),
      rootRef = reactOverlayFocus.useRef<HTMLElement | null>(null);
    useCaptureOverlayOpener(
      open,
      openerRef,
      rootRef,
      onCaptured,
      ownerAncestorsRef,
    );
    reactOverlayFocus.useLayoutEffect(() => {
      if (!needsFocusCheckRef.current) {
        return;
      }
      needsFocusCheckRef.current = false;
      if (!takeFocus && !fallbackTriggerRef) {
        return;
      }
      let value = rootElement?.ownerDocument ?? document;
      if (!openerRef.current) {
        let value4 = fallbackTriggerRef?.current ?? null;
        fallbackOpenerRef.current =
          value4 !== null &&
          value4.isConnected &&
          !popupRef.current?.contains(value4)
            ? value4
            : null;
      }
      if (!takeFocus) {
        return;
      }
      let value2 = (0, runtime.asElement)(value.activeElement),
        value3 = value2 && value2 !== value.body ? value2 : null;
      if (!value3 || popupRef.current?.contains(value3)) {
        return;
      }
      (0, runtime.blurWithSafeRelatedTarget)(value3);
    }, [open, takeFocus, fallbackTriggerRef, rootElement]);
    let skipRestoreOnOutsideFocus = !takeFocus,
      finalFocus = reactOverlayFocus.useCallback(() => {
        if (skipRestoreOnOutsideFocus) {
          let current = popupRef.current,
            value = rootRef.current?.ownerDocument ?? document,
            activeElement = value.activeElement;
          if (
            activeElement &&
            activeElement !== value.body &&
            !current?.contains(activeElement)
          ) {
            return false;
          }
        }
        if (openerRef.current) {
          if (!openerRef.current.isConnected) {
            let value = ownerAncestorsRef.current.find(
              (input) => input.isConnected,
            );
            if (value) {
              return resolveFinalFocusTarget(value, popupRef.current);
            }
          }
          return resolveFinalFocusTarget(openerRef.current, popupRef.current);
        }
        if (fallbackOpenerRef.current) {
          let current = popupRef.current,
            activeElement = (
              rootRef.current?.ownerDocument ?? document
            ).activeElement;
          if (
            activeElement &&
            isTextEntryTarget(activeElement) &&
            !current?.contains(activeElement)
          ) {
            return false;
          }
          if (!fallbackOpenerRef.current.isConnected) {
            return false;
          }
          return null;
        }
        return false;
      }, [skipRestoreOnOutsideFocus]);
    return reactOverlayFocus.useMemo(
      () => ({
        finalFocus: finalFocus,
        popupRef: popupRef,
      }),
      [finalFocus, popupRef],
    );
  }
  function resolveFinalFocusTarget(opener: Element | null | undefined, popup: Element | null | undefined): false | HTMLElement {
    if (!opener?.isConnected) {
      return false;
    }
    let activeElement = opener.ownerDocument.activeElement;
    if (
      activeElement &&
      isTextEntryTarget(activeElement) &&
      !popup?.contains(activeElement)
    ) {
      return false;
    }
    let focusTarget = opener as HTMLElement;
    if (focusTarget.tabIndex < 0) {
      focusTarget.focus({
        preventScroll: true,
      });
      return false;
    }
    return focusTarget;
  }
  function isTextEntryTarget(input: Element): boolean {
    return input.matches(runtime.TEXT_ENTRY_SELECTOR);
  }
  function createOverlayStack() {
    let overlays: InnerOverlay[] = [];
    return {
      register: (input: InnerOverlay) => {
        overlays.push(input);
        return () => {
          let value = overlays.lastIndexOf(input);
          if (value !== -1) {
            overlays.splice(value, 1);
          }
        };
      },
      topmostOpen: () => {
        for (let value = overlays.length - 1; value >= 0; value -= 1) {
          let value2 = overlays[value];
          if (value2?.isOpen()) {
            return value2;
          }
        }
      },
    };
  }
  function useRegisterInnerOverlay(overlay: InnerOverlay): void {
    let stack = reactOverlayStack.useContext(overlayStackContext),
      overlayRef = reactOverlayStack.useRef(overlay);
    reactOverlayStack.useEffect(() => {
      overlayRef.current = overlay;
    }, [overlay]);
    reactOverlayStack.useEffect(() => {
      if (stack === null) {
        return;
      }
      return stack.register({
        isOpen: () => overlayRef.current.isOpen(),
        close: () => overlayRef.current.close(),
      });
    }, [stack]);
  }
  function isDocumentCurrentTarget(input?: { currentTarget?: { nodeType?: number } | null }): boolean {
    return input?.currentTarget?.nodeType === DOCUMENT_NODE_TYPE;
  }
  function interceptEscapeForInnerOverlay(
    stack: OverlayStack,
    open: boolean,
    details: InnerOverlayCloseDetails,
  ) {
    let closeDetails = details;
    if (open || closeDetails.reason !== "escape-key") {
      return false;
    }
    let topmostOverlay = stack.topmostOpen();
    if (topmostOverlay === undefined) {
      return false;
    }
    closeDetails.cancel?.();
    let event = closeDetails.event;
    if (isDocumentCurrentTarget(event)) {
      (event?.currentTarget?.defaultView ?? globalThis).setTimeout(
        () => {
          if (topmostOverlay.isOpen()) {
            topmostOverlay.close();
          }
        },
        0,
      );
    } else {
      event?.preventDefault();
      topmostOverlay.close();
    }
    return true;
  }
  function useMenuOverlayRegistration() {
    let ref = reactMenuOverlayRegistration.useRef<HTMLElement | null>(null),
      value = reactMenuOverlayRegistration.useContext(
        runtime.menuRootIdentityContext,
      );
    useRegisterInnerOverlay({
      isOpen: () =>
        value !== null && ref.current?.hasAttribute("data-open") === true,
      close: () => (value as MenuRootRef | null)?.current?.close?.(),
    });
    return {
      elementRef: ref,
      overlayAttrs: menuOverlayAttributes,
    };
  }
  function calculateScrollbarThickness(
    offsetSize: number,
    clientSize: number,
    borderSize?: number,
  ) {
    return offsetSize - clientSize - (borderSize || 0);
  }
  function isScrollbarPointerPosition(
    offsetX: number,
    offsetY: number,
    targetElement: HTMLElement,
  ) {
    let style = getComputedStyle(targetElement);
    if (style.display === "inline") {
      return false;
    }
    let verticalScrollbarWidth = calculateScrollbarThickness(
        targetElement.offsetWidth,
        targetElement.clientWidth,
        parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth),
      ),
      horizontalScrollbarHeight = calculateScrollbarThickness(
        targetElement.offsetHeight,
        targetElement.clientHeight,
        parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth),
      ),
      overVerticalScrollbar =
        verticalScrollbarWidth >= 1 &&
        (style.direction === "rtl"
          ? offsetX < verticalScrollbarWidth
          : offsetX >= targetElement.clientWidth),
      overHorizontalScrollbar =
        horizontalScrollbarHeight >= 1 && offsetY >= targetElement.clientHeight;
    return overVerticalScrollbar || overHorizontalScrollbar;
  }
  function useClickToFocus(focus?: () => void, options: ClickToFocusOptions = {}) {
    let {
        disabled = false,
        readOnly = false,
        shouldIgnoreTarget: shouldIgnoreTarget,
      } = options,
      focusCallback = (0, runtime.useOptionalEventCallback)(focus),
      ignoreTargetCallback = (0, runtime.useOptionalEventCallback)(
        shouldIgnoreTarget,
      );
    return {
      clickToFocusProps: {
        onMouseDown: reactClickToFocus.useCallback(
          (event: ElementMouseDownEvent) => {
            if (event.button !== 0 || readOnly || disabled) {
              return;
            }
            let { target: value, currentTarget: value2 } = event;
            if (!value2.contains(value)) {
              return;
            }
            if (value !== value2) {
              if (ignoreTargetCallback?.(value)) {
                return;
              }
              let ancestor = value.closest(
                INTERACTIVE_CLICK_TARGET_SELECTOR,
              );
              if (
                ancestor &&
                ancestor !== value2 &&
                value2.contains(ancestor)
              ) {
                return;
              }
            }
            let { offsetX: nativeEvent, offsetY: nativeEvent2 } =
              event.nativeEvent;
            if (isScrollbarPointerPosition(nativeEvent, nativeEvent2, value)) {
              return;
            }
            event.preventDefault();
            focusCallback?.();
          },
          [disabled, readOnly, focusCallback, ignoreTargetCallback],
        ),
      },
    };
  }
  function shouldAllowPopupPointerFocus(
    event: PopupPointerEvent,
    { draggable = false }: { draggable?: boolean } = {},
  ) {
    let targetElement = (0, runtime.asElement)(event.target);
    if (targetElement === null) {
      return false;
    }
    return (
      (0, runtime.isEditableElement)(targetElement) ||
      targetElement.matches(FORM_POINTER_FOCUS_SELECTOR) ||
      closestWithinElement(
        targetElement,
        SELECT_ELEMENT_SELECTOR,
        event.currentTarget,
      ) ||
      (draggable &&
        closestWithinElement(
          targetElement,
          DRAGGABLE_ELEMENT_SELECTOR,
          event.currentTarget,
        )) ||
      isScrollbarPointerPosition(
        event.nativeEvent.offsetX,
        event.nativeEvent.offsetY,
        targetElement,
      )
    );
  }
  function closestWithinElement(
    targetElement: Element,
    selector: string,
    container: Element,
  ) {
    let matchingAncestor = targetElement.closest(selector);
    return matchingAncestor !== null && container.contains(matchingAncestor);
  }
  function usePassiveOpenState(
    onOpenChange: OpenChangeHandler | undefined,
    open: boolean | undefined,
    allowHover = true,
  ) {
    let [state] = reactPassiveOpen.useState(createPassiveOpenState);
    state.renderedWith(open, onOpenChange, allowHover);
    return state;
  }
  function createPassiveOpenState(): PassiveOpenState {
    let value: OpenChangeHandler | undefined,
      flag = true,
      text: PassiveOpenLevel = "off",
      value2: HTMLElement | null = null,
      value3: HTMLElement | null = null,
      flag2 = false,
      value4: PassiveFinalFocus | undefined = undefined,
      value5: PassiveInitialFocus | undefined = undefined,
      flag3 = false,
      value6: HTMLElement | null = null,
      value7: HTMLElement | null = null,
      value8: { type: PassiveInteractionType; byHover: boolean } | null = null,
      value9: boolean | undefined = undefined,
      flag4 = false,
      flag5 = false,
      values = new Set<() => void>(),
      callback = (input: PassiveOpenLevel, options: boolean) => {
        if (input === text) {
          return;
        }
        text = input;
        if (options) {
          values.forEach((input2) => {
            input2();
          });
        }
      },
      callback2 = () => {
        flag3 = false;
        value6 = null;
        value7 = null;
        value8 = null;
        flag2 = false;
      };
    return {
      cell: {
        getLevel: () => text,
        subscribe(input: () => void): () => void {
          values.add(input);
          return () => {
            values.delete(input);
          };
        },
        engage(): void {
          if (text === "declared") {
            flag3 = false;
          }
          callback("off", true);
        },
        registerPopup(element: HTMLElement | null): void {
          value2 = element;
          if (element !== null) {
            if (flag2) {
              flag2 = false;
              value6 = getFocusedElement(element.ownerDocument);
            }
          } else if (!flag5) {
            callback("off", false);
            if (value3 !== null) {
              let value10 = value3;
              value3 = null;
              restorePassiveOverlayFocus(
                value10.ownerDocument,
                null,
                value10,
                false,
              );
            }
          }
        },
        declareFocusProps(input: PassiveInitialFocus | undefined, options: PassiveFinalFocus | undefined): void {
          value4 = options;
          let value10 = input !== value5;
          value5 = input;
          if (!value10 || !flag5 || value2 !== null || value8 === null) {
            return;
          }
          let value11 = declinesInitialFocus(input, value8.type);
          if (value11 === (text === "declared")) {
            return;
          }
          let value12: PassiveOpenLevel = value11
            ? "declared"
            : value8.byHover
              ? "hover"
              : "off";
          flag3 = value12 !== "off";
          callback(value12, false);
        },
        getPopup: () => value2,
        getTrigger: () => value7,
      },
      renderedWith(
        input: boolean | undefined,
        options: OpenChangeHandler | undefined,
        context: boolean,
      ): void {
        value = options;
        flag = context;
        if (value9 !== true && input === true && !flag4) {
          flag5 = true;
          value3 = null;
          if (value2 !== null) {
            value6 = getFocusedElement(value2.ownerDocument);
          } else {
            value6 = null;
            flag2 = true;
          }
          value7 = null;
          value8 = {
            type: "",
            byHover: false,
          };
          flag3 = declinesInitialFocus(value5, "");
          callback(flag3 ? "declared" : "off", false);
        } else if (value9 === true && input === false) {
          flag5 = false;
          flag4 = false;
          value3 =
            text === "declared" && flag3
              ? resolvePassiveFinalFocus(value4, value6)
              : null;
          callback2();
          if (text === "hover") {
            callback("off", false);
          }
        }
        value9 = input;
      },
      onOpenChange(input: boolean, options: OpenChangeDetails): void {
        value?.(input, options);
        if (options.isCanceled === true) {
          return;
        }
        flag2 = false;
        let value10 =
            flag && options.reason === PASSIVE_HOVER_OPEN_REASON,
          value11 =
            options.trigger?.ownerDocument ??
            value2?.ownerDocument ??
            getDocumentIfAvailable();
        if (!input) {
          flag5 = false;
          flag4 = false;
          if (flag3 && value11 !== undefined) {
            let value15 = resolvePassiveFinalFocus(
              value4,
              options.reason === PASSIVE_FOCUS_OUT_REASON && value7 !== null
                ? value7
                : value6,
            );
            if (value15 !== null) {
              restorePassiveOverlayFocus(value11, value2, value15, !value10);
            }
          }
          callback2();
          if (text === "hover") {
            callback("off", true);
          }
          return;
        }
        flag5 = true;
        flag4 = true;
        value3 = null;
        let value12 =
            value11 !== undefined &&
            elementIsWithin(value11.activeElement, value2),
          value13 = classifyOpenInputType(options.event),
          value14: PassiveOpenLevel = value12
            ? "off"
            : declinesInitialFocus(value5, value13)
              ? "declared"
              : value10
                ? "hover"
                : "off";
        if (!(value10 && value12)) {
          value6 = getFocusedElement(value11);
          value7 = (0, runtime.asElement)(options.trigger ?? null);
          value8 = value12
            ? null
            : {
                type: value13,
                byHover: value10,
              };
          flag3 = value14 !== "off";
        }
        callback(value14, true);
      },
    };
  }
  function classifyOpenInputType(input?: Event & { detail?: number }): PassiveInteractionType {
    if (input === undefined) {
      return "";
    }
    if ("key" in input) {
      return "keyboard";
    }
    let { type: value } = input;
    if (value === "click" && input.detail === 0) {
      return "keyboard";
    }
    if (
      value === "click" ||
      value === "contextmenu" ||
      value.startsWith("mouse") ||
      value.startsWith("pointer") ||
      value.startsWith("touch")
    ) {
      return "mouse";
    }
    return "";
  }
  function declinesInitialFocus(
    initialFocus: PassiveInitialFocus | undefined,
    interactionType: PassiveInteractionType,
  ): boolean {
    if (initialFocus === undefined || initialFocus === true) {
      return false;
    }
    if (initialFocus === false) {
      return true;
    }
    let resolvedFocus = initialFocus(interactionType);
    return resolvedFocus === false || resolvedFocus === undefined;
  }
  function getDocumentIfAvailable(): Document | undefined {
    if (typeof document === "undefined") {
      return undefined;
    } else {
      return document;
    }
  }
  function resolvePassiveFinalFocus(
    finalFocus: PassiveFinalFocus | undefined,
    fallbackElement: HTMLElement | null,
  ): HTMLElement | null {
    if (finalFocus === false) {
      return null;
    }
    if (
      finalFocus === undefined ||
      finalFocus === true ||
      finalFocus === null ||
      typeof finalFocus === "function"
    ) {
      return fallbackElement;
    }
    return finalFocus.current ?? fallbackElement;
  }
  function getFocusedElement(input?: Document | null): HTMLElement | null {
    let value = (0, runtime.asElement)(input?.activeElement ?? null);
    if (value === null || value === input?.body) {
      return null;
    } else {
      return value;
    }
  }
  function elementIsWithin(input: Element | null, options: Element | null): boolean {
    return input !== null && options !== null && options.contains(input);
  }
  function restorePassiveOverlayFocus(
    documentObject: Document,
    popup: HTMLElement | null,
    opener: HTMLElement,
    blurBeforeRestore: boolean,
  ): void {
    queueMicrotask(() => {
      let activeElement = documentObject.activeElement,
        value = elementIsWithin(activeElement, popup);
      if (
        (activeElement === null ||
          activeElement === documentObject.body ||
          value) &&
        opener.isConnected &&
        opener !== activeElement
      ) {
        let value2 =
          blurBeforeRestore && value
            ? (0, runtime.asElement)(activeElement)
            : null;
        if (value2 !== null) {
          (0, runtime.blurWithSafeRelatedTarget)(value2);
        }
        opener.focus({
          preventScroll: true,
        });
      }
    });
  }
  function usePassiveOpenContext(input: boolean): PassiveOpenContextValue {
    let value = reactPassiveOpen.useContext(passiveOpenStateContext);
    if (input) {
      return {
        cell: value,
        root: value,
      };
    } else {
      return {
        cell: value,
        root: null,
      };
    }
  }
  function useMenuPassiveFocusProps() {
    if (reactPassiveOpen.useContext(passiveFocusDeclinedContext)) {
      return passiveDeclinedFocusProps;
    } else {
      return passiveDefaultFocusProps;
    }
  }
  function PassiveOpenGate({
    cell: cell,
    nested: nested,
    children: children,
  }: PassiveOpenGateProps): ReactElement {
    let value = reactPassiveOpen.useSyncExternalStore(
        cell === null ? subscribePassiveOpenNoop : cell.subscribe,
        cell === null ? getPassiveOffSnapshot : cell.getLevel,
        getPassiveOffSnapshot,
      ),
      value2 =
        cell === null ? "off" : nested && value === "hover" ? "off" : value;
    return jsxPassiveOpen.jsxs(passiveFocusDeclinedContext.Provider, {
      value: value2 === "declared",
      children: [
        value2 === "declared" && !nested && cell !== null
          ? jsxPassiveOpen.jsx(PassiveOpenKeyboardBridge, {
              cell: cell,
            })
          : null,
        children(
          cell === null || value2 === "off"
            ? unchangedPopupProps
            : value2 === "hover"
              ? (input: PassivePopupProps): PassivePopupProps => ({
                  ...input,
                  tabIndex: undefined,
                  onFocus(input2: ReactFocusEvent<HTMLElement>) {
                    input.onFocus?.(input2);
                    cell.engage();
                  },
                })
              : (input: PassivePopupProps): PassivePopupProps => ({
                  ...input,
                  tabIndex: undefined,
                  finalFocus: false,
                  onMouseDown(event: ReactMouseEvent<HTMLElement>) {
                    input.onMouseDown?.(event);
                    if (!shouldAllowPopupPointerFocus(event)) {
                      event.preventDefault();
                    }
                  },
                  onKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
                    input.onKeyDown?.(event);
                    if (
                      !event.nativeEvent.isComposing &&
                      passiveOpenEngagementKeys.has(event.key)
                    ) {
                      cell.engage();
                    }
                  },
                }),
        ),
      ],
    });
  }
  function PassiveOpenKeyboardBridge({ cell: cell }: { cell: PassiveOpenCell }): null {
    reactPassiveOpen.useEffect(() => {
      let value = cell.getTrigger();
      if (value === null) {
        return;
      }
      let callback = (event: KeyboardEvent) => {
        if (
          event.isComposing ||
          event.key === "Tab" ||
          passiveOpenModifierKeys.has(event.key)
        ) {
          return;
        }
        reactDomPassiveOpen.flushSync(() => {
          cell.engage();
        });
        if (
          (event.key !== "ArrowDown" && event.key !== "ArrowUp") ||
          value.ownerDocument.activeElement !== value
        ) {
          return;
        }
        let value2 = cell.getPopup(),
          value3 =
            value2 === null
              ? []
              : Array.from(
                  value2.querySelectorAll(
                    '[role^="menuitem"]:not([data-disabled])',
                  ),
                ),
          value4 =
            event.key === "ArrowDown" ? value3[0] : value3[value3.length - 1],
          value5 = (0, runtime.asElement)(value4 ?? null);
        if (value5 !== null && value5.hasAttribute("data-highlighted")) {
          event.preventDefault();
          event.stopImmediatePropagation();
          value5.focus({
            preventScroll: true,
          });
        }
      };
      value.addEventListener("keydown", callback);
      return () => {
        value.removeEventListener("keydown", callback);
      };
    }, [cell]);
    return null;
  }
  function isCanceledOpenWithinTrigger(input: OpenChangeDetails): boolean {
    if (input.reason !== "cancel-open") {
      return false;
    }
    let value = input.trigger ?? null,
      value2 = input.event?.target ?? null;
    if (value === null || value2 === null || !("nodeType" in value2)) {
      return false;
    }
    let value3 = value2 as Node;
    if (value.contains(value3)) {
      return true;
    }
    let attribute = value.getAttribute("aria-controls");
    return (
      (attribute
        ? value.ownerDocument.getElementById(attribute)
        : null
      )?.contains(value3) ?? false
    );
  }
  function useTrackedMenuTrigger(
    onOpenChange: OpenChangeHandler | undefined,
    refuseCanceledTriggerOpen = false,
  ) {
    let triggerRef = reactMenuOpener.useRef<Element | null>(null);
    return {
      triggerRef: triggerRef,
      onOpenChange: (0, runtime.useEventCallback)(
        (input: boolean, options: OpenChangeDetails) => {
          if (
            !input &&
            refuseCanceledTriggerOpen &&
            isCanceledOpenWithinTrigger(options)
          ) {
            options.cancel?.();
            return;
          }
          triggerRef.current = options.trigger ?? null;
          onOpenChange?.(input, options);
        },
      ),
    };
  }
  function useMenuOpenerRef() {
    return reactMenuOpener.useContext(menuOpenerRefContext);
  }
  function useMenuOwnerRef(input: RefObject<Element | null> | undefined, options: PassiveFinalFocus | undefined): (element: Element | null) => void {
    let value = reactMenuOpener.useContext(menuOpenerRefContext),
      ref = reactMenuOpener.useRef(options);
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      ref.current = options;
    }, [options]);
    let callback = reactMenuOpener.useCallback(() => {
      let value2 =
          input !== undefined ? input.current : (value?.current ?? null),
        current = ref.current;
      if (current === false || typeof current === "function") {
        return null;
      }
      if (current === undefined || current === true || current === null) {
        return value2;
      }
      return current.current ?? value2;
    }, [input, value]);
    return reactMenuOpener.useCallback(
      (input2: Element | null) => {
        if (input2 !== null) {
          (0, runtime.registerOverlayOwner)(input2, callback);
        }
      },
      [callback],
    );
  }
  function readPopupPlacement(element: Element): PopupPlacement {
    return {
      side: element.getAttribute("data-side") || undefined,
      align: element.getAttribute("data-align") || undefined,
    };
  }
  function arePopupPlacementsEqual(
    input: PopupPlacement | null,
    options: PopupPlacement,
  ): boolean {
    return (
      input !== null &&
      input.side === options.side &&
      input.align === options.align
    );
  }
  function placementNeedsBottomHold(input: PopupPlacement | null): boolean {
    return (
      input?.side === "top" ||
      (input?.side !== undefined &&
        input.side !== "bottom" &&
        input.align === "end")
    );
  }
  function useStablePopupPlacement({
    enabled: enabled,
    side: side,
    align: align,
  }: StablePopupPlacementOptions): StablePopupPlacement {
    let [value, value2] = reactStablePopupPlacement.useState<PopupPlacement | null>(null),
      [value3, value4] = reactStablePopupPlacement.useState<PopupPlacement | null>(null),
      [value5, value6] = reactStablePopupPlacement.useState<number | undefined>(),
      ref = reactStablePopupPlacement.useRef<HTMLElement | null>(null),
      ref2 = reactStablePopupPlacement.useRef(false),
      ref3 = reactStablePopupPlacement.useRef<(() => void) | null>(null),
      callback = reactStablePopupPlacement.useCallback(
        (element: HTMLElement | null) => {
          ref3.current?.();
          ref3.current = null;
          if (!element) {
            value2(null);
            value4(null);
            ref2.current = false;
            return;
          }
          let value8 = element.ownerDocument.defaultView ?? window,
            value9 =
              typeof value8.requestAnimationFrame === "function",
            index = 0,
            index2 = 0,
            callback3 = () => {
              index2 += 1;
              if (index2 < POPUP_PLACEMENT_SETTLE_FRAMES) {
                index = value8.requestAnimationFrame(callback3);
                return;
              }
              index = 0;
              let value10 = readPopupPlacement(element);
              value2(
                (input) =>
                  arePopupPlacementsEqual(input, value10) ? input : value10,
              );
            },
            callback4 = () => {
              let value10 = readPopupPlacement(element);
              value4(
                (input) =>
                  arePopupPlacementsEqual(input, value10) ? input : value10,
              );
              ref2.current = placementNeedsBottomHold(value10);
              if (!ref2.current) {
                let value11 =
                  ref.current?.getBoundingClientRect().height;
                value6(
                  value11 !== undefined && value11 > 0 ? value11 : undefined,
                );
              }
              index2 = 0;
              if (value9 && index === 0) {
                index = value8.requestAnimationFrame(callback3);
              }
            };
          callback4();
          let observer = new MutationObserver(callback4);
          observer.observe(element, {
            attributes: true,
            attributeFilter: ["data-side", "data-align"],
          });
          ref3.current = () => {
            observer.disconnect();
            if (index !== 0) {
              value8.cancelAnimationFrame(index);
            }
          };
        },
        [],
      ),
      ref4 = reactStablePopupPlacement.useRef<ResizeObserver | null>(null),
      callback2 = reactStablePopupPlacement.useCallback(
        (input: HTMLElement | null) => {
          ref4.current?.disconnect();
          ref4.current = null;
          ref.current = input;
          if (!input) {
            value6(undefined);
            return;
          }
          if (!enabled) {
            return;
          }
          let callback3 = () => {
            let height = input.getBoundingClientRect().height;
            if (height > 0) {
              value6(
                (input2) =>
                  ref2.current && input2 !== undefined && height <= input2
                    ? input2
                    : height,
              );
            }
          };
          callback3();
          if (typeof ResizeObserver !== "undefined") {
            let observer = new ResizeObserver(callback3);
            observer.observe(input);
            ref4.current = observer;
          }
        },
        [enabled],
      ),
      value7: HeldPopupStyle | null =
        enabled && placementNeedsBottomHold(value3) && value5 !== undefined
          ? {
              positionerStyle: {
                minHeight: `min(${Math.floor(value5)}px, var(--available-height))`,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
              },
              positionerClassName: heldPositionerClasses,
              popupClassName: heldPopupClasses,
            }
          : null;
    return {
      positionerRef: enabled ? callback : undefined,
      popupRef: callback2,
      side: enabled ? (value?.side ?? side) : side,
      align: enabled ? (value?.align ?? align) : align,
      held: value7,
    };
  }
  function resolvePlatformWindow(input?: Window): Window | undefined {
    return input ?? (typeof window === "undefined" ? undefined : window);
  }
  function matchesWindowMediaQuery(
    input: string,
    options?: Window,
  ) {
    let value = resolvePlatformWindow(options);
    return (
      typeof value?.matchMedia === "function" && value.matchMedia(input).matches
    );
  }
  function useCoarseOrHoverlessPointer(ownWindow?: Window): boolean {
    return matchesWindowMediaQuery(COARSE_OR_HOVERLESS_QUERY, ownWindow);
  }
  function usesImmediateModalRelease(input?: Window): boolean {
    let value = resolvePlatformWindow(input);
    if (value?.navigator?.userAgent?.includes(ELECTRON_USER_AGENT_TOKEN)) {
      return true;
    }
    return !(
      matchesWindowMediaQuery(TOUCH_DEVICE_QUERY, value) &&
      (value?.navigator?.maxTouchPoints ?? 0) > 0
    );
  }
  function subscribeDeviceMediaQueries(
    listener: () => void,
    ownWindow?: Window,
  ) {
    let value = resolvePlatformWindow(ownWindow);
    if (typeof value?.matchMedia !== "function") {
      return () => {
        return;
      };
    }
    let value2 = [
      COARSE_OR_HOVERLESS_QUERY,
      MOBILE_WIDTH_QUERY,
      TOUCH_DEVICE_QUERY,
    ].map((input) => value.matchMedia(input));
    for (let value3 of value2)
      value3.addEventListener("change", listener);
    return () => {
      for (let value3 of value2)
        value3.removeEventListener("change", listener);
    };
  }
  function makeOutsidePortalInert(element: Element): () => void {
    let items: Element[] = [],
      callback = (input: Element) => {
        let value2 = modalInertRefCounts.get(input) ?? 0;
        if (value2 === 0) {
          if (input.hasAttribute("inert")) {
            return;
          }
          input.setAttribute("inert", "");
          input.setAttribute("data-cds-sheet-inert", "");
        }
        modalInertRefCounts.set(input, value2 + 1);
        items.push(input);
      },
      callback2 = (element2: Element) => {
        if (
          inertExcludedTags.has(element2.tagName) ||
          element2.matches(MODAL_INERT_LIVE_REGION_SELECTOR)
        ) {
          return;
        }
        if (element2.querySelector(MODAL_INERT_LIVE_REGION_SELECTOR) === null) {
          callback(element2);
          return;
        }
        for (let value2 of Array.from(element2.children))
          callback2(value2);
      },
      value = element,
      body = element.ownerDocument.body;
    while (value !== null && value !== body && value.parentElement !== null) {
      let parentElement = value.parentElement,
        value2 = value;
      for (let value3 of Array.from(parentElement.children))
        if (value3 !== value2) {
          callback2(value3);
        }
      value = parentElement;
    }
    return () => {
      for (let value2 of items) {
        let value3 = (modalInertRefCounts.get(value2) ?? 1) - 1;
        if (value3 <= 0) {
          modalInertRefCounts.delete(value2);
          if (value2.hasAttribute("data-cds-sheet-inert")) {
            value2.removeAttribute("inert");
            value2.removeAttribute("data-cds-sheet-inert");
          }
        } else {
          modalInertRefCounts.set(value2, value3);
        }
      }
    };
  }
  function useModalPortalInert({
    node: node,
    open: open,
    liftOnClose: liftOnClose,
  }: ModalPortalInertOptions): () => void {
    let value = useRootWindow(),
      value2 = (0, runtime.useOptionalEventCallback)(liftOnClose),
      ref = reactModalPortalInert.useRef<(() => void) | null>(null),
      ref2 = reactModalPortalInert.useRef<(() => void) | null>(null);
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      if (!open || node === null || value === undefined) {
        return;
      }
      let value3 = value.requestAnimationFrame(() => {
        if (ref.current === null) {
          let value4 = findOverlayPortalContainer(node);
          if (value4 !== null) {
            ref.current = makeOutsidePortalInert(value4);
          }
        }
      });
      return () => {
        value.cancelAnimationFrame(value3);
        let current = ref.current;
        ref.current = null;
        if (current === null) {
          return;
        }
        if (
          (value2?.() ?? "now") === "now" ||
          !canDelayModalInertRelease(value)
        ) {
          current();
          return;
        }
        let value4: () => void = releaseInertAfterPaint(
          value,
          current,
          () => {
            if (ref2.current === value4) {
              ref2.current = null;
            }
          },
        );
        ref2.current = value4;
      };
    }, [node, open, value, value2]);
    return reactModalPortalInert.useCallback(
      () => ref2.current?.(),
      [],
    );
  }
  function canDelayModalInertRelease(input: Window): boolean {
    return (
      !usesImmediateModalRelease(input) &&
      !(0, runtime.isReducedMotion)() &&
      input.document.visibilityState !== "hidden"
    );
  }
  function releaseInertAfterPaint(
    input: Window,
    options: () => void,
    context: () => void,
  ) {
    let document2 = input.document,
      flag = false,
      callback = () => {
        if (flag) {
          return;
        }
        flag = true;
        input.cancelAnimationFrame(value);
        input.removeEventListener("pointerdown", callback, true);
        input.removeEventListener("keydown", callback, true);
        input.removeEventListener("pagehide", callback);
        document2.removeEventListener("visibilitychange", callback2);
        options();
        context();
      },
      callback2 = () => {
        if (document2.visibilityState === "hidden") {
          callback();
        }
      },
      value = input.requestAnimationFrame(() => {
        value = input.requestAnimationFrame(callback);
      });
    input.addEventListener("pointerdown", callback, true);
    input.addEventListener("keydown", callback, true);
    input.addEventListener("pagehide", callback);
    document2.addEventListener("visibilitychange", callback2);
    return callback;
  }
  function findOverlayPortalContainer(element: Element): Element | null {
    let body = element.ownerDocument.body,
      value: Element | null = element,
      value2: Element | null = null;
    while (value !== null && value !== body) {
      if (
        value.hasAttribute("data-base-ui-portal") ||
        value.hasAttribute("data-cds-portal")
      ) {
        return value;
      }
      value2 = value;
      value = value.parentElement;
    }
    return value2;
  }
  function preventModalTabNavigation(event: KeyEventLike): void {
    if (event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
    }
  }
  function coverParentMenuSheet(input: Element, options: object): void {
    let entry = coveredMenuSheetOwners.get(input);
    if (entry === undefined) {
      entry = new Set();
      coveredMenuSheetOwners.set(input, entry);
    }
    entry.add(options);
    input.setAttribute("aria-hidden", "true");
    input.setAttribute(runtime.SHEET_DRILLED_ATTRIBUTE, "");
  }
  function uncoverParentMenuSheet(input: Element, options: object): void {
    let entry = coveredMenuSheetOwners.get(input);
    entry?.delete(options);
    if (entry === undefined || entry.size === 0) {
      input.removeAttribute("aria-hidden");
      input.removeAttribute(runtime.SHEET_DRILLED_ATTRIBUTE);
    }
  }
  function getSheetInertReleaseTiming(input: SheetOpenChangeDetails | null | undefined): SheetInertReleaseTiming {
    if (input?.reason === "outside-press") {
      return "after-paint";
    }
    let value = input?.event;
    if (
      input?.reason !== "item-press" ||
      value === undefined ||
      !("detail" in value) ||
      value.detail === 0
    ) {
      return "now";
    }
    let target = value.target;
    if (
      (target !== null && "closest" in target
        ? (target as Element).closest('[role^="menuitem"]')
        : null
      )?.hasAttribute("data-cds-focuses-nothing") === true
    ) {
      return "after-paint";
    } else {
      return "now";
    }
  }
  function MenuSheetTitleBar({ nested: nested }: { nested: boolean }): ReactElement {
    let value = reactMenuSheetPopup.useContext(
        runtime.menuTriggerContext,
      ),
      { label: value2 } = reactMenuSheetPopup.useContext(
        runtime.submenuStateContext,
      ),
      value3 = reactMenuSheetPopup.useContext(
        runtime.menuSheetLabelsContext,
      ),
      value4 = (0, runtime.useTranslation)("back", "Back"),
      value5 = value3.backLabel ?? value4;
    return jsxMenuSheetPopup.jsx(runtime.SheetTitleBar, {
      title: nested ? value2 : value3.sheetTitle,
      leading: nested
        ? jsxMenuSheetPopup.jsx(runtime.baseMenu.Item, {
            closeOnClick: false,
            onClick: () => value?.close(),
            "aria-label": value5,
            label: value5,
            className: (0, runtime.cn)(
              menuItemVariants({
                variant: "default",
              }),
              "min-h-control w-auto py-0",
            ),
            children: jsxMenuSheetPopup.jsx(runtime.IconSlot, {
              icon: jsxMenuSheetPopup.jsx(runtime.Icon, {
                name: "ArrowLeft",
                size: "md",
                className: "rtl:-scale-x-100",
              }),
            }),
          })
        : undefined,
    });
  }
  function MenuSheetCloseButton(): ReactElement {
    let value = reactMenuSheetPopup.useContext(
        runtime.sheetFrameContext,
      ),
      value2 = (0, runtime.useTranslation)("close", "Close"),
      value3 =
        reactMenuSheetPopup.useContext(runtime.menuSheetLabelsContext)
          .closeLabel ?? value2;
    return jsxMenuSheetPopup.jsx(runtime.baseMenu.Item, {
      closeOnClick: false,
      onClick: () => value?.dismiss(),
      "aria-label": value3,
      label: value3,
      "data-cds-sheet-control": "",
      className:
        "group/sheet-close cds-reset block w-full rounded outline-none select-none focus-visible:outline-hidden [&:not(:focus-visible):not([data-highlighted]):not([data-cds-sheet-control-held])]:sr-only",
      children: jsxMenuSheetPopup.jsxs("span", {
        className: (0, runtime.cn)(
          menuItemVariants({
            variant: "default",
          }),
          "group-data-[highlighted]/sheet-close:bg-fill-ghost-hover",
        ),
        children: [
          jsxMenuSheetPopup.jsx(runtime.IconSlot, {
            icon: "X",
          }),
          jsxMenuSheetPopup.jsx("span", {
            className: "min-w-0 flex-1 truncate",
            children: value3,
          }),
        ],
      }),
    });
  }
  function PopoverSheetBackdrop({ sheetPopup: sheetPopup }: SheetBackdropProps): ReactElement {
    return jsxPopoverSheetBody.jsx(runtime.basePopover.Backdrop, {
      "data-presentation": "sheet",
      "data-sheet-scrim": sheetPopup.frame?.treeId,
      className:
        sheetPopup.state.depth > 0
          ? runtime.transparentSheetBackdropClasses
          : runtime.sheetBackdropClasses,
    });
  }
  function PopoverSheetBody({
    sheetPopup: sheetPopup,
    className: className,
    bodyRef: bodyRef,
    bodyClassName: bodyClassName,
    closeLabel: closeLabel,
    children: children,
  }: PopoverSheetBodyProps): ReactElement {
    let { chrome: value } = sheetPopup;
    return jsxPopoverSheetBody.jsxs(runtime.sheetParentContext.Provider, {
      value: sheetPopup.stack,
      children: [
        jsxPopoverSheetBody.jsx(value.Handle, {}),
        jsxPopoverSheetBody.jsxs(value.Body, {
          className: (0, runtime.cn)(
            className,
            "h-auto max-h-none min-h-0 w-full min-w-0 max-w-none flex-auto",
          ),
          children: [
            jsxPopoverSheetBody.jsx("div", {
              ref: bodyRef,
              tabIndex: -1,
              "data-cds-popover-body": "",
              [runtime.SHEET_SCROLL_ATTRIBUTE]: "",
              className: bodyClassName,
              children: children,
            }),
            jsxPopoverSheetBody.jsx(value.DismissButton, {
              as: runtime.basePopover.Close,
              label: closeLabel,
            }),
          ],
        }),
      ],
    });
  }
  function ContextMenuSheetBackdrop({
    sheetPopup: sheetPopup,
  }: SheetBackdropProps): ReactElement {
    return jsxContextMenuSheetBackdrop.jsx(runtime.baseCombobox.Backdrop, {
      "data-presentation": "sheet",
      "data-sheet-scrim": sheetPopup.frame?.treeId,
      className:
        sheetPopup.state.depth > 0
          ? runtime.transparentSheetBackdropClasses
          : runtime.sheetBackdropClasses,
    });
  }
  function subscribeSheetImplementation(input: () => void): () => void {
    sheetImplementationSubscribers.add(input);
    return () => {
      sheetImplementationSubscribers.delete(input);
    };
  }
  function loadSheetImplementation() {
    let value = sheetImplementationGeneration;
    sheetImplementationPromise ??= (0, runtime.runWithTransition)(
      "cds_mobile_sheets",
      () =>
        Promise.resolve().then(() => {
          initializeMobileSheetExports();
          return mobileSheetExports;
        }),
    )
      .then(
        (input) =>
          typeof input === "object" &&
          input !== null &&
          "SheetPopupHost" in input
            ? input
            : null,
        () => null,
      )
      .then((input) => {
        if (value !== sheetImplementationGeneration) {
          return input;
        }
        if (input === null) {
          sheetImplementationFailed = true;
        } else {
          loadedSheetImplementation = input;
        }
        for (let value2 of sheetImplementationSubscribers) value2();
        return input;
      });
    return sheetImplementationPromise;
  }
  function preloadSheetImplementation() {
    if (loadedSheetImplementation !== null || sheetImplementationFailed) {
      return;
    }
    sheetImplementationRequests += 1;
    loadSheetImplementation();
  }
  function isSheetImplementationLoaded() {
    return loadedSheetImplementation !== null;
  }
  function useSheetImplementationLoaded() {
    return reactSheetImplementation.useSyncExternalStore(
      subscribeSheetImplementation,
      getSheetImplementationLoadedSnapshot,
      getFalseSheetImplementationSnapshot,
    );
  }
  function useSheetImplementationFailed() {
    return reactSheetImplementation.useSyncExternalStore(
      subscribeSheetImplementation,
      getSheetImplementationFailedSnapshot,
      getFalseSheetImplementationSnapshot,
    );
  }
  function useLoadedSheetImplementation() {
    return reactSheetImplementation.useSyncExternalStore(
      subscribeSheetImplementation,
      getSheetImplementationSnapshot,
      getNullSheetImplementationSnapshot,
    );
  }
  function usePreloadSheetsForCoarsePointer(
    input: boolean,
    options: Window | undefined,
  ) {
    let value = (0, runtime.useMediaQuery__U)(
      input ? options : undefined,
      runtime.COARSE_POINTER_QUERY_rG,
    );
    reactPreloadSheets.useEffect(() => {
      if (input && value) {
        preloadSheetImplementation();
      }
    }, [input, value]);
  }
  function detectCdsPlatform() {
    if (typeof navigator === "undefined") {
      return "web";
    }
    if (desktopPlatformUserAgentPattern.test(navigator.userAgent)) {
      return "desktop";
    } else {
      return "web";
    }
  }
  function reportLinkSanitizationDebug(
    input: string,
    options: string,
    context: string,
  ) {
    return;
  }
  function truncateLinkDebugValue(items: string) {
    if (items.length <= MAX_LINK_DEBUG_LENGTH) {
      return items;
    }
    let value = items.charCodeAt(119),
      value2 =
        value >= 55296 && value <= 56319 ? 119 : MAX_LINK_DEBUG_LENGTH;
    return `${items.slice(0, value2)}…`;
  }
  function normalizeHrefWhitespace(input: string) {
    let value = input.replace(linkWhitespacePattern, ""),
      index = 0,
      length = value.length;
    while (index < length && value.charCodeAt(index) <= 32) index++;
    while (length > index && value.charCodeAt(length - 1) <= 32) length--;
    if (index === 0 && length === value.length) {
      return value;
    } else {
      return value.slice(index, length);
    }
  }
  function isSanitizedHrefFallback(
    input: string | undefined,
    options: string | undefined,
  ) {
    return (
      options === "#" &&
      input !== undefined &&
      normalizeHrefWhitespace(input) !== "#"
    );
  }
  function opensInSeparateBrowsingContext(input: string | undefined) {
    return !!input && !existingBrowsingContextNames.has(input.toLowerCase());
  }
  function normalizeLinkRel(
    input: string | undefined,
    options: string | null | undefined,
    context: () => string,
  ) {
    if (!opensInSeparateBrowsingContext(input)) {
      return options ?? undefined;
    }
    if (options === undefined || options === null) {
      return context();
    }
    let value = options
      .split(/\s+/)
      .filter(
        (input2: string) =>
          input2 !== "" && input2.toLowerCase() !== "opener",
      );
    if (
      !value.some(
        (input2: string) => unsafeLinkRelTokenPattern.test(input2),
      )
    ) {
      value.push("noopener");
    }
    return value.join(" ");
  }
  function useCdsRouter() {
    return reactCdsLink.useContext(cdsRouterContext);
  }
  function sanitizeHref(input: string | undefined) {
    if (!input) {
      return input;
    }
    let value = normalizeHrefWhitespace(input);
    if (forbiddenHrefControlCharacterPattern.test(value)) {
      return rejectUnsafeHref(value, "it contains a control character");
    }
    if (leadingHrefWhitespacePattern.test(value)) {
      return rejectUnsafeHref(
        value,
        "it starts with whitespace the browser keeps",
      );
    }
    if (absoluteHrefPattern.test(value)) {
      if (value.startsWith("//")) {
        return value;
      }
      if (androidIntentHrefPattern.test(value)) {
        if (isAllowedAndroidIntentHref(value)) {
          return value;
        } else {
          return rejectUnsafeHref(
            value,
            "only an Anthropic Android app's own sign-in intent: shape is followed",
          );
        }
      }
      if (editorHrefSchemePattern.test(value)) {
        if (isAllowedEditorHref(value)) {
          return value;
        } else {
          return rejectUnsafeHref(
            value,
            "only an Anthropic extension's marketplace page or a VS Code settings link is followed",
          );
        }
      }
      if (!allowedHrefSchemePattern.test(value)) {
        return rejectUnsafeHref(
          value,
          "its scheme is not one CDS links navigate",
        );
      }
      return value;
    }
    return validateRelativeHref(value);
  }
  function rejectUnsafeHref(input: string, options: string) {
    reportLinkSanitizationDebug(input, "#", options);
    return "#";
  }
  function validateRelativeHref(input: string) {
    let value = networkPathHrefPattern.test(input);
    try {
      let value2 = new URL(input, HTTPS_RELATIVE_HREF_BASE),
        value3 =
          value2.pathname.replace(/^\/{2,}/, "/") + value2.search + value2.hash;
      if (
        value ||
        value2.origin !== HTTPS_RELATIVE_HREF_BASE ||
        value2.pathname.startsWith("//")
      ) {
        reportLinkSanitizationDebug(
          input,
          value3,
          value || value2.origin !== HTTPS_RELATIVE_HREF_BASE
            ? "it reads as a path but names a host"
            : "its dot segments resolve to a path that would re-read as protocol-relative",
        );
        return value3;
      }
      if (hasUnsafeRelativePath(input)) {
        reportLinkSanitizationDebug(
          input,
          value3,
          "its path has a backslash or dot segment, which the browser resolves before navigating",
        );
        return value3;
      }
      let value4 = getHrefPathBeforeQuery(input);
      if (
        unrootedHrefPattern.test(input) &&
        encodedOrBackslashPathPattern.test(value4) &&
        !value2.pathname.startsWith("//")
      ) {
        let value5 = value4
          .replaceAll("\\", "/")
          .split("/")
          .map(
            (input2: string) =>
              dotSegmentPattern.test(input2)
                ? input2.replace(/%2e/gi, ".")
                : input2,
          )
          .join("/");
        if (value5 !== value4) {
          let value6 = value5 + input.slice(value4.length);
          reportLinkSanitizationDebug(
            input,
            value6,
            "its path has a backslash or a %2e-spelled dot segment, which the browser reads as a plain slash or dot",
          );
          return value6;
        }
      }
    } catch {
      if (value) {
        return rejectUnsafeHref(
          input,
          "it names a host this URL parser cannot parse",
        );
      }
    }
    return input;
  }
  function hasUnsafeRelativePath(input: string) {
    if (!rootRelativeHrefPattern.test(input)) {
      return false;
    }
    let value = getHrefPathBeforeQuery(input);
    return value.includes("\\") || relativePathDotSegmentPattern.test(value);
  }
  function getHrefPathBeforeQuery(input: string) {
    let value = input.search(/[?#]/);
    if (value < 0) {
      return input;
    } else {
      return input.slice(0, value);
    }
  }
  function isAllowedEditorHref(input: string) {
    return allowedEditorHrefPattern.test(
      input.replace(
        editorHrefSchemePattern,
        (input2: string) => input2.toLowerCase(),
      ),
    );
  }
  function isAllowedAndroidIntentHref(input: string) {
    if (!androidIntentHrefPattern.test(input)) {
      return false;
    }
    let value = input.indexOf("#");
    if (value < 0 || input.indexOf("#", value + 1) >= 0) {
      return false;
    }
    let value2 = input.slice(value + 1);
    if (!value2.startsWith("Intent;") || !value2.endsWith(";end")) {
      return false;
    }
    let value3 = value2.slice(7, -4),
      entries = new Map<string, string>();
    for (let value4 of value3.split(";")) {
      let value5 = value4.indexOf("=");
      if (value5 <= 0) {
        return false;
      }
      let value6 = value4.slice(0, value5);
      if (entries.has(value6) || !allowedIntentPropertyNames.has(value6)) {
        return false;
      }
      entries.set(value6, value4.slice(value5 + 1));
    }
    let entry = entries.get("package");
    if (
      entry === undefined ||
      !trustedAndroidIntentPackages.has(entry) ||
      entries.get("scheme") !== "https"
    ) {
      return false;
    }
    let entry2 = entries.get("S.browser_fallback_url");
    if (entry2 === undefined) {
      return true;
    }
    try {
      return new URL(decodeURIComponent(entry2)).protocol === "https:";
    } catch {
      return false;
    }
  }
  function classifyHrefOrigin(input: string, options: string) {
    let value: URL;
    try {
      value = new URL(input, options);
    } catch {
      return "other";
    }
    if (value.origin === options) {
      return "relative";
    }
    if (value.protocol !== "https:" && value.protocol !== "http:") {
      return "other";
    }
    let hostname = value.hostname;
    if (
      trustedFirstPartyDomains.some(
        (input2: string) =>
          hostname === input2 || hostname.endsWith("." + input2),
      )
    ) {
      return "first-party";
    } else {
      return "other";
    }
  }
  function isOriginStableHref(input: string | undefined) {
    if (!input) {
      return false;
    }
    let value = classifyHrefOrigin(input, HTTPS_RELATIVE_HREF_BASE);
    return (
      value !== "other" &&
      value === classifyHrefOrigin(input, HTTP_RELATIVE_HREF_BASE)
    );
  }
  function getSeparateContextRel(input: string | undefined) {
    if (isOriginStableHref(input)) {
      return "noopener";
    } else {
      return "noopener noreferrer";
    }
  }
  function getAutomaticLinkRel(input: string | undefined, options: string | undefined) {
    let value = sanitizeHref(input);
    if (opensInSeparateBrowsingContext(options)) {
      return getSeparateContextRel(value);
    }
    if (isOriginStableHref(value)) {
      return undefined;
    } else {
      return "noreferrer";
    }
  }
  function isSameOriginHref(input: string) {
    if (typeof window === "undefined") {
      return false;
    }
    try {
      let value = new URL(input, window.location.href);
      return (
        value.origin !== "null" &&
        value.protocol === window.location.protocol &&
        value.origin === window.location.origin
      );
    } catch {
      return false;
    }
  }
  function shouldHandleLinkWithRouter(event: RouterLinkCandidate): event is RouterLinkCandidate & { href: string } {
    if (!event.router || !event.href || event.href.startsWith("#")) {
      return false;
    }
    if (event.target && event.target.toLowerCase() !== "_self") {
      return false;
    }
    if (
      event.download !== null &&
      event.download !== undefined &&
      event.download !== false
    ) {
      return false;
    }
    return isSameOriginHref(event.href);
  }
  function normalizeRouterHref(input: string) {
    if (!absoluteHrefPattern.test(input)) {
      return input;
    }
    let value = new URL(input, window.location.href);
    return value.pathname.replace(/^\/{2,}/, "/") + value.search + value.hash;
  }
  function isModifiedLinkClick(input: ReactMouseEvent<Element>) {
    return (
      input.defaultPrevented ||
      input.button !== 0 ||
      input.metaKey ||
      input.ctrlKey ||
      input.shiftKey ||
      input.altKey
    );
  }
  function pickLinkEventProps(input: LinkEventSource) {
    let value = input,
      state: LinkEventHandlers = {};
    for (let value2 of linkEventPropNames)
      if (value[value2] !== undefined) {
        state[value2] = value[value2];
      }
    return state;
  }
  function omitLinkEventProps(input: object) {
    let state: Record<string, unknown> = {
      ...input,
    };
    for (let value of linkEventPropNames) delete state[value];
    return state;
  }
  function composeLinkEventHandlers(
    input: LinkEventHandler | undefined,
    options: LinkEventHandler | undefined,
    context: boolean,
  ): LinkEventHandler | undefined {
    if (!options) {
      return input;
    }
    return (input2: LinkEvent) => {
      input?.(input2);
      if (!context || !input2.defaultPrevented) {
        options(input2);
      }
    };
  }
  function useCdsLink({
    href: href,
    routerOptions: routerOptions,
    target: target,
    rel: rel,
    download: download,
    onClick: onClick,
    onPointerEnter: onPointerEnter,
    onPointerLeave: onPointerLeave,
    onPointerDown: onPointerDown,
    onFocus: onFocus,
    onBlur: onBlur,
  }: CdsLinkOptions): CdsLinkProps {
    let router = useCdsRouter(),
      safeHref = sanitizeHref(href),
      hrefRejected = isSanitizedHrefFallback(href, safeHref),
      safeTarget = hrefRejected ? undefined : target,
      safeDownload = hrefRejected ? undefined : download,
      resolvedHref =
        router?.resolveHref &&
        safeHref &&
        !safeHref.startsWith("#") &&
        !absoluteHrefPattern.test(safeHref)
          ? router.resolveHref(safeHref)
          : safeHref,
      hasRouter = router !== undefined,
      routerHref = reactCdsLink.useMemo(() => {
        let state = {
          href: safeHref,
          target: safeTarget,
          download: safeDownload,
          router: hasRouter,
        };
        if (shouldHandleLinkWithRouter(state)) {
          return normalizeRouterHref(state.href);
        } else {
          return undefined;
        }
      }, [safeHref, safeTarget, safeDownload, hasRouter]),
      handleClick = reactCdsLink.useCallback(
        (event: ReactMouseEvent<Element>) => {
          onClick?.(event);
          if (
            isModifiedLinkClick(event) ||
            routerHref === undefined ||
            !router
          ) {
            return;
          }
          event.preventDefault();
          router.navigate(routerHref, routerOptions);
        },
        [onClick, routerHref, router, routerOptions],
      ),
      intentHandlers = router?.intentHandlers,
      routerIntentHandlers = reactCdsLink.useMemo(
        () =>
          intentHandlers && routerHref !== undefined
            ? intentHandlers(routerHref)
            : undefined,
        [intentHandlers, routerHref],
      ),
      combinedIntentHandlers = reactCdsLink.useMemo(() => {
        let state = {
            onPointerEnter: onPointerEnter,
            onPointerLeave: onPointerLeave,
            onPointerDown: onPointerDown,
            onFocus: onFocus,
            onBlur: onBlur,
          },
          state2: LinkEventHandlers = {};
        for (let value of linkPrefetchEventNames) {
          let value2 = composeLinkEventHandlers(
            state[value],
            routerIntentHandlers?.[value],
            linkPrefetchEventKinds[value],
          );
          if (value2) {
            state2[value] = value2;
          }
        }
        return state2;
      }, [
        routerIntentHandlers,
        onPointerEnter,
        onPointerLeave,
        onPointerDown,
        onFocus,
        onBlur,
      ]);
    return {
      href: resolvedHref,
      target: safeTarget,
      rel: normalizeLinkRel(
        safeTarget,
        rel,
        () => getSeparateContextRel(resolvedHref),
      ),
      download: safeDownload,
      onClick: handleClick,
      ...combinedIntentHandlers,
    };
  }
  function getElementWindow(input: Element | null | undefined) {
    return input?.ownerDocument.defaultView ?? globalThis.window;
  }
  function elementHasUnavailableWindow(element: Element | undefined) {
    return (
      element !== undefined &&
      (!element.isConnected || element.ownerDocument.defaultView === null)
    );
  }
  function getConnectedElementWindow(input: Element | undefined) {
    if (elementHasUnavailableWindow(input)) {
      return;
    }
    return getElementWindow(input);
  }
  function hasCdsHtmlFontSizing(element: HTMLElement) {
    return (
      element === element.ownerDocument.documentElement &&
      element.style.fontSize.includes("--cds-font-size-body")
    );
  }
  function migrateCdsHtmlFontSizing() {
    if (hasMigratedHtmlFontSizing || typeof document === "undefined") {
      return;
    }
    hasMigratedHtmlFontSizing = true;
    try {
      let items: string[] = [],
        values = new Set<string>(),
        callback = (input: string | null | undefined) => {
          if (!input) {
            return;
          }
          let value3 = input.split(".")[0] ?? input;
          if (!values.has(value3)) {
            values.add(value3);
            items.push(value3);
          }
        },
        callback2 = (input: CSSStyleSheet) => {
          let value3: Iterable<CSSRule & LayerRuleFields>;
          try {
            value3 = input.cssRules as Iterable<CSSRule & LayerRuleFields>;
          } catch {
            return;
          }
          for (let value4 of value3) {
            let name = value4.constructor.name;
            if (name === "CSSLayerStatementRule") {
              for (let value5 of value4.nameList) callback(value5);
            } else if (name === "CSSLayerBlockRule") {
              callback(value4.name);
            } else if (name === "CSSImportRule") {
              let value5 = value4;
              callback(value5.layerName);
              if (value5.styleSheet) {
                callback2(value5.styleSheet);
              }
            }
          }
        };
      for (let value3 of document.styleSheets)
        callback2(value3);
      let value = items.indexOf("utilities");
      if (value === -1) {
        return;
      }
      let value2 = items.indexOf("cds-card");
      if (value2 === -1 || value2 > value) {
        console.error(
          "cds: the `cds-card` cascade layer is " +
            (value2 === -1 ? "not declared" : "declared after `utilities`") +
            " in this document, so Card's stretched-link lift rules outrank consumer positioning utilities — `absolute`/`z-*` on interactive children inside <Card> will silently lose, and a `backgroundClassName` surface override stops applying, since the fill layer's resting color and hover step sit in the same layer and must rank below consumer utilities to be overridable. Fix: add `@layer cds-card;` before the `@import \"tailwindcss\"` line in this app's Tailwind entry CSS (see packages/cds/src/component-base.css § cds-card).",
        );
      }
    } catch {}
  }
  function getControlSizeAttributes(input?: CdsControlSize): { "data-size"?: CdsControlSize } {
    if (input && input !== "base") {
      return {
        "data-size": input,
      };
    } else {
      return {};
    }
  }
  function getDensitySizeIndex(input: string, options?: CdsControlSize) {
    let value =
      densitySizeIndices[input as CdsDensity] + (controlSizeOffsets[options ?? "base"] as number);
    if (value < 1) {
      return 1;
    } else {
      if (value > 5) {
        return 5;
      } else {
        return value;
      }
    }
  }
  function createColorModeStore(configuredMode?: CdsRootMode): ColorModeStore {
    let element: HTMLElement | null = null,
      inheritedModeAttribute =
        configuredMode === undefined && typeof document !== "undefined"
          ? document.documentElement.getAttribute("data-mode")
          : null,
      getSetting = () =>
        configuredMode ?? normalizeColorMode(inheritedModeAttribute),
      modeFromDarkPreference = (input: boolean): CdsColorMode =>
        input ? "dark" : "light",
      colorSchemeMedia: MediaQueryList | undefined,
      systemColorMode: CdsColorMode | undefined,
      initialized = false,
      initialize = () => {
        if (initialized) {
          return;
        }
        initialized = true;
        colorSchemeMedia =
          configuredMode !== "light" &&
          configuredMode !== "dark" &&
          typeof window !== "undefined" &&
          typeof window.matchMedia === "function"
            ? window.matchMedia(DARK_COLOR_SCHEME_QUERY)
            : undefined;
        systemColorMode = colorSchemeMedia
          ? modeFromDarkPreference(colorSchemeMedia.matches)
          : undefined;
      },
      readInheritedMode = () => {
        if (element) {
          inheritedModeAttribute =
            element.closest("[data-mode]")?.getAttribute("data-mode") ??
            (element.isConnected
              ? null
              : document.documentElement.getAttribute(
                  "data-mode",
                ));
        }
      },
      explicitColorMode = (input: string | undefined): CdsColorMode | undefined =>
        input === "light" || input === "dark" ? input : undefined,
      listeners = new Set<() => void>(),
      notify = () =>
        listeners.forEach((input: () => void) => input()),
      changedBeforeSubscription = false,
      startObserving = () => {
        let items: Array<() => void> = [];
        initialize();
        let value = colorSchemeMedia;
        if (value) {
          let callback = () => {
            systemColorMode = modeFromDarkPreference(value.matches);
            notify();
          };
          value.addEventListener("change", callback);
          items.push(
            () => value.removeEventListener("change", callback),
          );
          let value2 = modeFromDarkPreference(value.matches);
          if (value2 !== systemColorMode) {
            systemColorMode = value2;
            changedBeforeSubscription = true;
          }
        }
        if (
          configuredMode === undefined &&
          typeof MutationObserver !== "undefined"
        ) {
          let value2 = inheritedModeAttribute;
          readInheritedMode();
          if (inheritedModeAttribute !== value2) {
            changedBeforeSubscription = true;
          }
          let value3 = (0, runtime.createSafeMutationObserver)(
            MutationObserver,
            () => {
              let value4 = inheritedModeAttribute;
              readInheritedMode();
              if (inheritedModeAttribute !== value4) {
                notify();
              }
            },
          );
          value3.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-mode"],
            subtree: true,
          });
          items.push(() => value3.disconnect());
        }
        if (changedBeforeSubscription) {
          changedBeforeSubscription = false;
          queueMicrotask(notify);
        }
        return () =>
          items.forEach((input) => input());
      },
      stopObserving: (() => void) | undefined;
    return {
      setElement: (input: HTMLElement | null) => {
        element = input;
        if (configuredMode === undefined && input !== null) {
          let value = inheritedModeAttribute;
          readInheritedMode();
          if (inheritedModeAttribute !== value && listeners.size === 0) {
            changedBeforeSubscription = true;
          }
          notify();
        }
      },
      subscribe: (input: () => void) => {
        if (listeners.size === 0) {
          stopObserving = startObserving();
        }
        listeners.add(input);
        return () => {
          listeners.delete(input);
          if (listeners.size === 0) {
            stopObserving?.();
            stopObserving = undefined;
          }
        };
      },
      getSnapshot: () => {
        initialize();
        return explicitColorMode(getSetting()) ?? systemColorMode;
      },
      getServerSnapshot: () => explicitColorMode(configuredMode),
      getAttrSnapshot: () => {
        initialize();
        if (configuredMode !== undefined) {
          return (
            explicitColorMode(configuredMode) ??
            systemColorMode ??
            configuredMode
          );
        } else {
          return undefined;
        }
      },
      getServerAttrSnapshot: () => configuredMode,
      getSettingSnapshot: () => getSetting(),
      getServerSettingSnapshot: () => configuredMode,
    };
  }
  function usePageBackground() {
    return reactCdsRoot.useContext(pageBackgroundContext);
  }
  function useDensity() {
    return reactCdsRoot.useContext(densityContext);
  }
  function useResolvedColorMode() {
    return useColorMode() ?? "light";
  }
  function useColorMode() {
    let value =
      reactCdsRoot.useContext(colorModeStoreContext) ?? defaultColorModeStore;
    return reactCdsRoot.useSyncExternalStore(
      value.subscribe,
      value.getSnapshot,
      value.getServerSnapshot,
    );
  }
  function usePlatform() {
    return reactCdsRoot.useContext(platformContext) ?? "web";
  }
  function useFont() {
    return reactCdsRoot.useContext(fontContext);
  }
  function useMonospaceFont() {
    return reactCdsRoot.useContext(monospaceFontContext);
  }
  function getMonospaceOverrideStyle(input?: string | null) {
    if (input === null) {
      return {
        "--cds-font-mono-override": "initial",
      };
    }
    let value = input?.trim();
    if (!value) {
      return {};
    }
    return {
      "--cds-font-mono-override": `"${value
        .replaceAll(/[\u0000-\u001f\u007f]/g, "")
        .replaceAll("\\", "\\\\")
        .replaceAll('"', '\\"')}",`,
    };
  }
  function useSurfaceBackground() {
    return reactCdsRoot.useContext(surfaceBackgroundContext);
  }
  function getSurfaceBackgroundStyle(input?: string | null) {
    if (!input) {
      return {};
    }
    return {
      "--cds-page-bg": isSurfaceToken(input)
        ? `var(--cds-${input})`
        : sanitizeCssBackground(input),
      ...(isTintedFillSurface(input) ? opaqueTintOverrides : {}),
    };
  }
  function isTintedFillSurface(input: string) {
    return isSurfaceToken(input) && input.startsWith("fill-");
  }
  function sanitizeCssBackground(input: string) {
    return input.replaceAll(/[\u0000-\u001f\u007f;{}*]/g, "");
  }
  function isSurfaceToken(input: string) {
    return surfaceTokenNames.has(input);
  }
  function useCdsConfig() {
    return reactCdsRoot.useContext(localeContext);
  }
  function useRootElement() {
    return reactCdsRoot.useContext(rootElementContext);
  }
  function usePortalContainer() {
    let value = reactCdsRoot.useContext(rootElementContext),
      value2 = reactCdsRoot.useContext(rootPortalContainerContext),
      value3 = reactCdsRoot.useContext(isPortalRootContext);
    return value ?? (value3 ? undefined : value2);
  }
  function useRootWindow() {
    return getElementWindow(reactCdsRoot.useContext(rootElementContext));
  }
  function CdsRoot({
    density: density,
    mode: mode,
    platform: platform,
    font: font,
    fontMono: fontMono,
    pageBackground: pageBackground,
    locale: locale,
    router: router,
    labels: labels,
    experimental: experimental,
    render: render,
    className: className,
    children: children,
  }: CdsRootProps): ReactElement {
    let parentDensity = reactCdsRoot.useContext(densityContext),
      parentPlatform = reactCdsRoot.useContext(platformContext),
      parentFont = reactCdsRoot.useContext(fontContext),
      parentPageBackground = reactCdsRoot.useContext(
        pageBackgroundContext,
      ),
      parentRouter = useCdsRouter(),
      parentLabels = reactCdsRoot.useContext(
        runtime.translationContext,
      ),
      parentDensityOverride = reactCdsRoot.useContext(
        densityOverrideContext,
      ),
      densityOverride =
        experimental?.densityOverride ?? parentDensityOverride,
      coarsePointer = reactCdsRoot.useSyncExternalStore(
        subscribeRootCoarsePointer,
        runtime.getCoarsePointerSnapshot,
        getCoarsePointerServerSnapshot,
      ),
      resolvedDensity =
        densityOverride ??
        (coarsePointer ? "comfortable" : (density ?? parentDensity)),
      resolvedRouter = router ?? parentRouter,
      resolvedLabels = reactCdsRoot.useMemo(
        () =>
          labels && parentLabels
            ? (
                input: string,
                options: string,
                context?: TranslationValues,
              ) =>
                labels(input, options, context) ||
                parentLabels(input, options, context)
            : (labels ?? parentLabels),
        [labels, parentLabels],
      ),
      parentNaturalImageTiles = reactCdsRoot.useContext(
        naturalImageTilesContext,
      ),
      naturalImageTiles =
        experimental?.naturalImageTiles ?? parentNaturalImageTiles,
      featureFlagNames = (0, runtime.mergeFeatureFlagNames)(
        reactCdsRoot.useContext(runtime.featureFlagContext),
        experimental?.fizzyLake?.parts,
      );
    usePreloadSheetsForCoarsePointer(parentFont === undefined, useRootWindow());
    let parentFontMono = reactCdsRoot.useContext(monospaceFontContext),
      resolvedFontMono =
        fontMono === null
          ? null
          : ((fontMono?.trim() ? fontMono.trim() : undefined) ??
            parentFontMono),
      resolvedPageBackground = pageBackground ?? parentPageBackground,
      parentSurfaceBackground = reactCdsRoot.useContext(
        surfaceBackgroundContext,
      ),
      resolvedSurfaceBackground =
        pageBackground ?? parentSurfaceBackground,
      parentLocale = reactCdsRoot.useContext(localeContext),
      normalizedLocale = locale?.trim() ? locale.trim() : undefined,
      resolvedLocale = normalizedLocale ?? parentLocale,
      detectedPlatform = reactCdsRoot.useSyncExternalStore(
        subscribePlatformNoop,
        detectCdsPlatform,
        getWebPlatformSnapshot,
      ),
      resolvedPlatform =
        platform ?? parentPlatform ?? detectedPlatform,
      elementRef = reactCdsRoot.useRef<HTMLElement | null>(null),
      parentColorModeStore = reactCdsRoot.useContext(
        colorModeStoreContext,
      ),
      ownsColorModeStore =
        mode !== undefined || parentColorModeStore === undefined,
      [colorModeState, setColorModeState] = reactCdsRoot.useState<{ mode: CdsRootMode | undefined; scope: ColorModeStore } | null>(
        () =>
          ownsColorModeStore
            ? {
                mode: mode,
                scope: createColorModeStore(mode),
              }
            : null,
      ),
      inheritedColorModeStore = ownsColorModeStore
        ? undefined
        : parentColorModeStore,
      colorModeStore: ColorModeStore;
    if (inheritedColorModeStore !== undefined) {
      colorModeStore = inheritedColorModeStore;
    } else if (colorModeState !== null && colorModeState.mode === mode) {
      colorModeStore = colorModeState.scope;
    } else {
      colorModeStore = createColorModeStore(mode);
      setColorModeState({
        mode: mode,
        scope: colorModeStore,
      });
    }
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      (0, runtime.registerInputDismissalTracking)(
        elementRef.current?.ownerDocument,
      );
    }, []);
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      if (!ownsColorModeStore) {
        return;
      }
      colorModeStore.setElement(elementRef.current);
      return () => colorModeStore.setElement(null);
    }, [ownsColorModeStore, colorModeStore]);
    let themeStore = (0, runtime.useExperimentalThemeStore)(
        experimental?.theme,
        elementRef,
      ),
      colorModeAttribute = reactCdsRoot.useSyncExternalStore(
        colorModeStore.subscribe,
        ownsColorModeStore
          ? colorModeStore.getAttrSnapshot
          : colorModeStore.getSnapshot,
        ownsColorModeStore
          ? colorModeStore.getServerAttrSnapshot
          : colorModeStore.getServerSnapshot,
      );
    reactCdsRoot.useEffect(() => {
      return;
    }, [normalizedLocale]);
    let debugWarningsEnabled = false;
    reactCdsRoot.useEffect(() => {
      return;
    }, [debugWarningsEnabled]);
    reactCdsRoot.useEffect(() => {
      return;
    }, []);
    let renderElement: CdsRenderElement | undefined = render;
    if (
      typeof renderElement === "object" &&
      renderElement !== null &&
      renderElement.$$typeof === Symbol.for("react.lazy")
    ) {
      renderElement = reactCdsRoot.Children.toArray(renderElement)[0] as CdsRenderElement | undefined;
    }
    let isHtmlRoot =
        reactCdsRoot.isValidElement(renderElement) &&
        renderElement.type === "html",
      documentFont = (0, runtime.useDocumentFont)(
        font === undefined && parentFont === undefined && !isHtmlRoot,
      ),
      resolvedFont = font ?? parentFont ?? documentFont ?? "anthropic",
      rootElement = (0, runtime.baseUseRender)({
        render: renderElement,
        defaultTagName: "div",
        ref: elementRef,
        props: {
          className: (0, runtime.cn)("cds-root text-primary", className),
          "data-density": resolvedDensity,
          "data-mode": colorModeAttribute,
          "data-platform": resolvedPlatform,
          "data-font": resolvedFont,
          "data-cds-fizzy-lake": featureFlagNames,
          "data-page-bg": resolvedPageBackground,
          style: {
            ...(!isHtmlRoot && {
              fontSize: "var(--cds-font-size-body)",
            }),
            ...getSurfaceBackgroundStyle(resolvedSurfaceBackground),
            ...getMonospaceOverrideStyle(resolvedFontMono),
          },
          children: children,
        },
      });
    return jsxCdsRoot.jsx(densityContext.Provider, {
      value: resolvedDensity,
      children: jsxCdsRoot.jsx(colorModeStoreContext.Provider, {
        value: colorModeStore,
        children: jsxCdsRoot.jsx(platformContext.Provider, {
          value: resolvedPlatform,
          children: jsxCdsRoot.jsx(fontContext.Provider, {
            value: resolvedFont,
            children: jsxCdsRoot.jsx(monospaceFontContext.Provider, {
              value: resolvedFontMono,
              children: jsxCdsRoot.jsx(pageBackgroundContext.Provider, {
                value: resolvedPageBackground,
                children: jsxCdsRoot.jsx(surfaceBackgroundContext.Provider, {
                  value: resolvedSurfaceBackground,
                  children: jsxCdsRoot.jsx(localeContext.Provider, {
                    value: resolvedLocale,
                    children: jsxCdsRoot.jsx(cdsRouterContext.Provider, {
                      value: resolvedRouter,
                      children: jsxCdsRoot.jsx(
                        runtime.translationContext.Provider,
                        {
                          value: resolvedLabels,
                          children: jsxCdsRoot.jsx(
                            naturalImageTilesContext.Provider,
                            {
                              value: naturalImageTiles,
                              children: jsxCdsRoot.jsx(
                                densityOverrideContext.Provider,
                                {
                                  value: densityOverride,
                                  children: jsxCdsRoot.jsx(
                                    runtime.themeStoreContext.Provider,
                                    {
                                      value: themeStore,
                                      children: jsxCdsRoot.jsx(
                                        runtime.featureFlagContext.Provider,
                                        {
                                          value: featureFlagNames,
                                          children: rootElement,
                                        },
                                      ),
                                    },
                                  ),
                                },
                              ),
                            },
                          ),
                        },
                      ),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    });
  }
  bindRuntimeValue(
    runtime,
    "overlayOwnerResolvers",
    () => overlayOwnerResolvers,
    (value) => {
      overlayOwnerResolvers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_OVERLAY_OWNER_DEPTH",
    () => MAX_OVERLAY_OWNER_DEPTH,
    (value) => {
      MAX_OVERLAY_OWNER_DEPTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeOverlayOwners",
    () => initializeOverlayOwners,
    (value) => {
      initializeOverlayOwners = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useCaptureOverlayOpener",
    () => useCaptureOverlayOpener,
  );
  bindRuntimeValue(
    runtime,
    "useOverlayFocusReturn",
    () => useOverlayFocusReturn,
  );
  bindRuntimeValue(
    runtime,
    "resolveConnectedRefElement",
    () => resolveConnectedRefElement,
  );
  bindRuntimeValue(runtime, "useOverlayFinalFocus", () => useOverlayFinalFocus);
  bindRuntimeValue(
    runtime,
    "resolveFinalFocusTarget",
    () => resolveFinalFocusTarget,
  );
  bindRuntimeValue(runtime, "isTextEntryTarget", () => isTextEntryTarget);
  bindRuntimeValue(
    runtime,
    "reactOverlayFocus",
    () => reactOverlayFocus,
    (value) => {
      reactOverlayFocus = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeOverlayFocus",
    () => initializeOverlayFocus,
    (value) => {
      initializeOverlayFocus = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OVERLAY_ATTRIBUTE",
    () => OVERLAY_ATTRIBUTE,
    (value) => {
      OVERLAY_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OPEN_OVERLAY_SELECTOR_VQ5",
    () => OPEN_OVERLAY_SELECTOR_VQ5,
    (value) => {
      OPEN_OVERLAY_SELECTOR_VQ5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeOverlaySelector",
    () => initializeOverlaySelector,
    (value) => {
      initializeOverlaySelector = value;
    },
  );
  bindRuntimeValue(runtime, "createOverlayStack", () => createOverlayStack);
  bindRuntimeValue(
    runtime,
    "useRegisterInnerOverlay",
    () => useRegisterInnerOverlay,
  );
  bindRuntimeValue(
    runtime,
    "isDocumentCurrentTarget",
    () => isDocumentCurrentTarget,
  );
  bindRuntimeValue(
    runtime,
    "interceptEscapeForInnerOverlay",
    () => interceptEscapeForInnerOverlay,
  );
  bindRuntimeValue(
    runtime,
    "reactOverlayStack",
    () => reactOverlayStack,
    (value) => {
      reactOverlayStack = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "overlayStackContext",
    () => overlayStackContext,
    (value) => {
      overlayStackContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DOCUMENT_NODE_TYPE",
    () => DOCUMENT_NODE_TYPE,
    (value) => {
      DOCUMENT_NODE_TYPE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeOverlayStack",
    () => initializeOverlayStack,
    (value) => {
      initializeOverlayStack = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useMenuOverlayRegistration",
    () => useMenuOverlayRegistration,
  );
  bindRuntimeValue(
    runtime,
    "reactMenuOverlayRegistration",
    () => reactMenuOverlayRegistration,
    (value) => {
      reactMenuOverlayRegistration = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "menuOverlayAttributes",
    () => menuOverlayAttributes,
    (value) => {
      menuOverlayAttributes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeMenuOverlayRegistration",
    () => initializeMenuOverlayRegistration,
    (value) => {
      initializeMenuOverlayRegistration = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactContextMenuPopup",
    () => reactContextMenuPopup,
    (value) => {
      reactContextMenuPopup = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxContextMenuPopup",
    () => jsxContextMenuPopup,
    (value) => {
      jsxContextMenuPopup = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "contextMenuPopupClasses",
    () => contextMenuPopupClasses,
    (value) => {
      contextMenuPopupClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ContextMenuPopupFrame",
    () => ContextMenuPopupFrame,
    (value) => {
      ContextMenuPopupFrame = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeContextMenuPopup",
    () => initializeContextMenuPopup,
    (value) => {
      initializeContextMenuPopup = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "calculateScrollbarThickness",
    () => calculateScrollbarThickness,
  );
  bindRuntimeValue(
    runtime,
    "isScrollbarPointerPosition",
    () => isScrollbarPointerPosition,
  );
  bindRuntimeValue(runtime, "useClickToFocus", () => useClickToFocus);
  bindRuntimeValue(
    runtime,
    "reactClickToFocus",
    () => reactClickToFocus,
    (value) => {
      reactClickToFocus = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "INTERACTIVE_CLICK_TARGET_SELECTOR",
    () => INTERACTIVE_CLICK_TARGET_SELECTOR,
    (value) => {
      INTERACTIVE_CLICK_TARGET_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeClickToFocus",
    () => initializeClickToFocus,
    (value) => {
      initializeClickToFocus = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shouldAllowPopupPointerFocus",
    () => shouldAllowPopupPointerFocus,
  );
  bindRuntimeValue(runtime, "closestWithinElement", () => closestWithinElement);
  bindRuntimeValue(
    runtime,
    "FORM_POINTER_FOCUS_SELECTOR",
    () => FORM_POINTER_FOCUS_SELECTOR,
    (value) => {
      FORM_POINTER_FOCUS_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SELECT_ELEMENT_SELECTOR",
    () => SELECT_ELEMENT_SELECTOR,
    (value) => {
      SELECT_ELEMENT_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DRAGGABLE_ELEMENT_SELECTOR",
    () => DRAGGABLE_ELEMENT_SELECTOR,
    (value) => {
      DRAGGABLE_ELEMENT_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializePopupPointerFocus",
    () => initializePopupPointerFocus,
    (value) => {
      initializePopupPointerFocus = value;
    },
  );
  bindRuntimeValue(runtime, "usePassiveOpenState", () => usePassiveOpenState);
  bindRuntimeValue(
    runtime,
    "createPassiveOpenState",
    () => createPassiveOpenState,
  );
  bindRuntimeValue(
    runtime,
    "classifyOpenInputType",
    () => classifyOpenInputType,
  );
  bindRuntimeValue(runtime, "declinesInitialFocus", () => declinesInitialFocus);
  bindRuntimeValue(
    runtime,
    "getDocumentIfAvailable",
    () => getDocumentIfAvailable,
  );
  bindRuntimeValue(
    runtime,
    "resolvePassiveFinalFocus",
    () => resolvePassiveFinalFocus,
  );
  bindRuntimeValue(runtime, "getFocusedElement", () => getFocusedElement);
  bindRuntimeValue(runtime, "elementIsWithin", () => elementIsWithin);
  bindRuntimeValue(
    runtime,
    "restorePassiveOverlayFocus",
    () => restorePassiveOverlayFocus,
  );
  bindRuntimeValue(
    runtime,
    "usePassiveOpenContext",
    () => usePassiveOpenContext,
  );
  bindRuntimeValue(
    runtime,
    "useMenuPassiveFocusProps",
    () => useMenuPassiveFocusProps,
  );
  bindRuntimeValue(runtime, "PassiveOpenGate", () => PassiveOpenGate);
  bindRuntimeValue(
    runtime,
    "PassiveOpenKeyboardBridge",
    () => PassiveOpenKeyboardBridge,
  );
  bindRuntimeValue(
    runtime,
    "reactPassiveOpen",
    () => reactPassiveOpen,
    (value) => {
      reactPassiveOpen = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxPassiveOpen",
    () => jsxPassiveOpen,
    (value) => {
      jsxPassiveOpen = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactDomPassiveOpen",
    () => reactDomPassiveOpen,
    (value) => {
      reactDomPassiveOpen = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PASSIVE_HOVER_OPEN_REASON",
    () => PASSIVE_HOVER_OPEN_REASON,
    (value) => {
      PASSIVE_HOVER_OPEN_REASON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PASSIVE_FOCUS_OUT_REASON",
    () => PASSIVE_FOCUS_OUT_REASON,
    (value) => {
      PASSIVE_FOCUS_OUT_REASON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "passiveOpenStateContext",
    () => passiveOpenStateContext,
    (value) => {
      passiveOpenStateContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "passiveFocusDeclinedContext",
    () => passiveFocusDeclinedContext,
    (value) => {
      passiveFocusDeclinedContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "passiveDeclinedFocusProps",
    () => passiveDeclinedFocusProps,
    (value) => {
      passiveDeclinedFocusProps = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "passiveDefaultFocusProps",
    () => passiveDefaultFocusProps,
    (value) => {
      passiveDefaultFocusProps = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "passiveOpenEngagementKeys",
    () => passiveOpenEngagementKeys,
    (value) => {
      passiveOpenEngagementKeys = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "passiveOpenModifierKeys",
    () => passiveOpenModifierKeys,
    (value) => {
      passiveOpenModifierKeys = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "subscribePassiveOpenNoop",
    () => subscribePassiveOpenNoop,
    (value) => {
      subscribePassiveOpenNoop = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getPassiveOffSnapshot",
    () => getPassiveOffSnapshot,
    (value) => {
      getPassiveOffSnapshot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "unchangedPopupProps",
    () => unchangedPopupProps,
    (value) => {
      unchangedPopupProps = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializePassiveOpen",
    () => initializePassiveOpen,
    (value) => {
      initializePassiveOpen = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "menuItemVariants",
    () => menuItemVariants,
    (value) => {
      menuItemVariants = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "menuItemDescriptionPaddingClass",
    () => menuItemDescriptionPaddingClass,
    (value) => {
      menuItemDescriptionPaddingClass = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeMenuItemVariants",
    () => initializeMenuItemVariants,
    (value) => {
      initializeMenuItemVariants = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isCanceledOpenWithinTrigger",
    () => isCanceledOpenWithinTrigger,
  );
  bindRuntimeValue(
    runtime,
    "useTrackedMenuTrigger",
    () => useTrackedMenuTrigger,
  );
  bindRuntimeValue(runtime, "useMenuOpenerRef", () => useMenuOpenerRef);
  bindRuntimeValue(runtime, "useMenuOwnerRef", () => useMenuOwnerRef);
  bindRuntimeValue(
    runtime,
    "reactMenuOpener",
    () => reactMenuOpener,
    (value) => {
      reactMenuOpener = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "menuOpenerRefContext",
    () => menuOpenerRefContext,
    (value) => {
      menuOpenerRefContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MenuOpenerProvider",
    () => MenuOpenerProvider,
    (value) => {
      MenuOpenerProvider = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeMenuOpener",
    () => initializeMenuOpener,
    (value) => {
      initializeMenuOpener = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactMenuPopupElement",
    () => reactMenuPopupElement,
    (value) => {
      reactMenuPopupElement = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxMenuPopupElement",
    () => jsxMenuPopupElement,
    (value) => {
      jsxMenuPopupElement = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MenuPopupElement",
    () => MenuPopupElement,
    (value) => {
      MenuPopupElement = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeMenuPopupElement",
    () => initializeMenuPopupElement,
    (value) => {
      initializeMenuPopupElement = value;
    },
  );
  bindRuntimeValue(runtime, "readPopupPlacement", () => readPopupPlacement);
  bindRuntimeValue(
    runtime,
    "arePopupPlacementsEqual",
    () => arePopupPlacementsEqual,
  );
  bindRuntimeValue(
    runtime,
    "placementNeedsBottomHold",
    () => placementNeedsBottomHold,
  );
  bindRuntimeValue(
    runtime,
    "useStablePopupPlacement",
    () => useStablePopupPlacement,
  );
  bindRuntimeValue(
    runtime,
    "reactStablePopupPlacement",
    () => reactStablePopupPlacement,
    (value) => {
      reactStablePopupPlacement = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "heldPositionerClasses",
    () => heldPositionerClasses,
    (value) => {
      heldPositionerClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "heldPopupClasses",
    () => heldPopupClasses,
    (value) => {
      heldPopupClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "POPUP_PLACEMENT_SETTLE_FRAMES",
    () => POPUP_PLACEMENT_SETTLE_FRAMES,
    (value) => {
      POPUP_PLACEMENT_SETTLE_FRAMES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeStablePopupPlacement",
    () => initializeStablePopupPlacement,
    (value) => {
      initializeStablePopupPlacement = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "resolvePlatformWindow",
    () => resolvePlatformWindow,
  );
  bindRuntimeValue(
    runtime,
    "matchesWindowMediaQuery",
    () => matchesWindowMediaQuery,
  );
  bindRuntimeValue(
    runtime,
    "useCoarseOrHoverlessPointer",
    () => useCoarseOrHoverlessPointer,
  );
  bindRuntimeValue(
    runtime,
    "usesImmediateModalRelease",
    () => usesImmediateModalRelease,
  );
  bindRuntimeValue(
    runtime,
    "subscribeDeviceMediaQueries",
    () => subscribeDeviceMediaQueries,
  );
  bindRuntimeValue(
    runtime,
    "COARSE_OR_HOVERLESS_QUERY",
    () => COARSE_OR_HOVERLESS_QUERY,
    (value) => {
      COARSE_OR_HOVERLESS_QUERY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MOBILE_WIDTH_QUERY",
    () => MOBILE_WIDTH_QUERY,
    (value) => {
      MOBILE_WIDTH_QUERY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TOUCH_DEVICE_QUERY",
    () => TOUCH_DEVICE_QUERY,
    (value) => {
      TOUCH_DEVICE_QUERY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ELECTRON_USER_AGENT_TOKEN",
    () => ELECTRON_USER_AGENT_TOKEN,
    (value) => {
      ELECTRON_USER_AGENT_TOKEN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeModalReleasePlatform",
    () => initializeModalReleasePlatform,
    (value) => {
      initializeModalReleasePlatform = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "makeOutsidePortalInert",
    () => makeOutsidePortalInert,
  );
  bindRuntimeValue(runtime, "useModalPortalInert", () => useModalPortalInert);
  bindRuntimeValue(
    runtime,
    "canDelayModalInertRelease",
    () => canDelayModalInertRelease,
  );
  bindRuntimeValue(
    runtime,
    "releaseInertAfterPaint",
    () => releaseInertAfterPaint,
  );
  bindRuntimeValue(
    runtime,
    "findOverlayPortalContainer",
    () => findOverlayPortalContainer,
  );
  bindRuntimeValue(
    runtime,
    "preventModalTabNavigation",
    () => preventModalTabNavigation,
  );
  bindRuntimeValue(
    runtime,
    "reactModalPortalInert",
    () => reactModalPortalInert,
    (value) => {
      reactModalPortalInert = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "inertExcludedTags",
    () => inertExcludedTags,
    (value) => {
      inertExcludedTags = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MODAL_INERT_LIVE_REGION_SELECTOR",
    () => MODAL_INERT_LIVE_REGION_SELECTOR,
    (value) => {
      MODAL_INERT_LIVE_REGION_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "modalInertRefCounts",
    () => modalInertRefCounts,
    (value) => {
      modalInertRefCounts = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeModalPortalInert",
    () => initializeModalPortalInert,
    (value) => {
      initializeModalPortalInert = value;
    },
  );
  bindRuntimeValue(runtime, "coverParentMenuSheet", () => coverParentMenuSheet);
  bindRuntimeValue(
    runtime,
    "uncoverParentMenuSheet",
    () => uncoverParentMenuSheet,
  );
  bindRuntimeValue(
    runtime,
    "getSheetInertReleaseTiming",
    () => getSheetInertReleaseTiming,
  );
  bindRuntimeValue(runtime, "MenuSheetTitleBar", () => MenuSheetTitleBar);
  bindRuntimeValue(runtime, "MenuSheetCloseButton", () => MenuSheetCloseButton);
  bindRuntimeValue(
    runtime,
    "reactMenuSheetPopup",
    () => reactMenuSheetPopup,
    (value) => {
      reactMenuSheetPopup = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxMenuSheetPopup",
    () => jsxMenuSheetPopup,
    (value) => {
      jsxMenuSheetPopup = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "coveredMenuSheetOwners",
    () => coveredMenuSheetOwners,
    (value) => {
      coveredMenuSheetOwners = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MenuSheetPopup",
    () => MenuSheetPopup,
    (value) => {
      MenuSheetPopup = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeMenuSheetPopup",
    () => initializeMenuSheetPopup,
    (value) => {
      initializeMenuSheetPopup = value;
    },
  );
  bindRuntimeValue(runtime, "PopoverSheetBackdrop", () => PopoverSheetBackdrop);
  bindRuntimeValue(runtime, "PopoverSheetBody", () => PopoverSheetBody);
  bindRuntimeValue(
    runtime,
    "jsxPopoverSheetBody",
    () => jsxPopoverSheetBody,
    (value) => {
      jsxPopoverSheetBody = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializePopoverSheetBody",
    () => initializePopoverSheetBody,
    (value) => {
      initializePopoverSheetBody = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ContextMenuSheetBackdrop",
    () => ContextMenuSheetBackdrop,
  );
  bindRuntimeValue(
    runtime,
    "jsxContextMenuSheetBackdrop",
    () => jsxContextMenuSheetBackdrop,
    (value) => {
      jsxContextMenuSheetBackdrop = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeContextMenuSheetBackdrop",
    () => initializeContextMenuSheetBackdrop,
    (value) => {
      initializeContextMenuSheetBackdrop = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "mobileSheetExports",
    () => mobileSheetExports,
    (value) => {
      mobileSheetExports = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeMobileSheetExports",
    () => initializeMobileSheetExports,
    (value) => {
      initializeMobileSheetExports = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "subscribeSheetImplementation",
    () => subscribeSheetImplementation,
  );
  bindRuntimeValue(
    runtime,
    "loadSheetImplementation",
    () => loadSheetImplementation,
  );
  bindRuntimeValue(
    runtime,
    "preloadSheetImplementation",
    () => preloadSheetImplementation,
  );
  bindRuntimeValue(
    runtime,
    "isSheetImplementationLoaded",
    () => isSheetImplementationLoaded,
  );
  bindRuntimeValue(
    runtime,
    "useSheetImplementationLoaded",
    () => useSheetImplementationLoaded,
  );
  bindRuntimeValue(
    runtime,
    "useSheetImplementationFailed",
    () => useSheetImplementationFailed,
  );
  bindRuntimeValue(
    runtime,
    "useLoadedSheetImplementation",
    () => useLoadedSheetImplementation,
  );
  bindRuntimeValue(
    runtime,
    "reactSheetImplementation",
    () => reactSheetImplementation,
    (value) => {
      reactSheetImplementation = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "loadedSheetImplementation",
    () => loadedSheetImplementation,
    (value) => {
      loadedSheetImplementation = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sheetImplementationFailed",
    () => sheetImplementationFailed,
    (value) => {
      sheetImplementationFailed = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sheetImplementationRequests",
    () => sheetImplementationRequests,
    (value) => {
      sheetImplementationRequests = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sheetImplementationGeneration",
    () => sheetImplementationGeneration,
    (value) => {
      sheetImplementationGeneration = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sheetImplementationPromise",
    () => sheetImplementationPromise,
    (value) => {
      sheetImplementationPromise = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sheetImplementationSubscribers",
    () => sheetImplementationSubscribers,
    (value) => {
      sheetImplementationSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getSheetImplementationSnapshot",
    () => getSheetImplementationSnapshot,
    (value) => {
      getSheetImplementationSnapshot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getSheetImplementationLoadedSnapshot",
    () => getSheetImplementationLoadedSnapshot,
    (value) => {
      getSheetImplementationLoadedSnapshot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getSheetImplementationFailedSnapshot",
    () => getSheetImplementationFailedSnapshot,
    (value) => {
      getSheetImplementationFailedSnapshot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getNullSheetImplementationSnapshot",
    () => getNullSheetImplementationSnapshot,
    (value) => {
      getNullSheetImplementationSnapshot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getFalseSheetImplementationSnapshot",
    () => getFalseSheetImplementationSnapshot,
    (value) => {
      getFalseSheetImplementationSnapshot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetImplementation",
    () => initializeSheetImplementation,
    (value) => {
      initializeSheetImplementation = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "usePreloadSheetsForCoarsePointer",
    () => usePreloadSheetsForCoarsePointer,
  );
  bindRuntimeValue(
    runtime,
    "reactPreloadSheets",
    () => reactPreloadSheets,
    (value) => {
      reactPreloadSheets = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializePreloadSheets",
    () => initializePreloadSheets,
    (value) => {
      initializePreloadSheets = value;
    },
  );
  bindRuntimeValue(runtime, "detectCdsPlatform", () => detectCdsPlatform);
  bindRuntimeValue(
    runtime,
    "desktopPlatformUserAgentPattern",
    () => desktopPlatformUserAgentPattern,
    (value) => {
      desktopPlatformUserAgentPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeCdsPlatform",
    () => initializeCdsPlatform,
    (value) => {
      initializeCdsPlatform = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reportLinkSanitizationDebug",
    () => reportLinkSanitizationDebug,
  );
  bindRuntimeValue(
    runtime,
    "truncateLinkDebugValue",
    () => truncateLinkDebugValue,
  );
  bindRuntimeValue(
    runtime,
    "MAX_LINK_DEBUG_WARNINGS",
    () => MAX_LINK_DEBUG_WARNINGS,
    (value) => {
      MAX_LINK_DEBUG_WARNINGS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_LINK_DEBUG_LENGTH",
    () => MAX_LINK_DEBUG_LENGTH,
    (value) => {
      MAX_LINK_DEBUG_LENGTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reportedLinkWarnings",
    () => reportedLinkWarnings,
    (value) => {
      reportedLinkWarnings = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "linkWarningLimitReached",
    () => linkWarningLimitReached,
    (value) => {
      linkWarningLimitReached = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeLinkWarnings",
    () => initializeLinkWarnings,
    (value) => {
      initializeLinkWarnings = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeHrefWhitespace",
    () => normalizeHrefWhitespace,
  );
  bindRuntimeValue(
    runtime,
    "isSanitizedHrefFallback",
    () => isSanitizedHrefFallback,
  );
  bindRuntimeValue(
    runtime,
    "linkWhitespacePattern",
    () => linkWhitespacePattern,
    (value) => {
      linkWhitespacePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeHrefWhitespace",
    () => initializeHrefWhitespace,
    (value) => {
      initializeHrefWhitespace = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "opensInSeparateBrowsingContext",
    () => opensInSeparateBrowsingContext,
  );
  bindRuntimeValue(runtime, "normalizeLinkRel", () => normalizeLinkRel);
  bindRuntimeValue(
    runtime,
    "existingBrowsingContextNames",
    () => existingBrowsingContextNames,
    (value) => {
      existingBrowsingContextNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "unsafeLinkRelTokenPattern",
    () => unsafeLinkRelTokenPattern,
    (value) => {
      unsafeLinkRelTokenPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeLinkTargets",
    () => initializeLinkTargets,
    (value) => {
      initializeLinkTargets = value;
    },
  );
  bindRuntimeValue(runtime, "useCdsRouter", () => useCdsRouter);
  bindRuntimeValue(runtime, "sanitizeHref", () => sanitizeHref);
  bindRuntimeValue(runtime, "rejectUnsafeHref", () => rejectUnsafeHref);
  bindRuntimeValue(runtime, "validateRelativeHref", () => validateRelativeHref);
  bindRuntimeValue(
    runtime,
    "hasUnsafeRelativePath",
    () => hasUnsafeRelativePath,
  );
  bindRuntimeValue(
    runtime,
    "getHrefPathBeforeQuery",
    () => getHrefPathBeforeQuery,
  );
  bindRuntimeValue(runtime, "isAllowedEditorHref", () => isAllowedEditorHref);
  bindRuntimeValue(
    runtime,
    "isAllowedAndroidIntentHref",
    () => isAllowedAndroidIntentHref,
  );
  bindRuntimeValue(runtime, "classifyHrefOrigin", () => classifyHrefOrigin);
  bindRuntimeValue(runtime, "isOriginStableHref", () => isOriginStableHref);
  bindRuntimeValue(
    runtime,
    "getSeparateContextRel",
    () => getSeparateContextRel,
  );
  bindRuntimeValue(runtime, "getAutomaticLinkRel", () => getAutomaticLinkRel);
  bindRuntimeValue(runtime, "isSameOriginHref", () => isSameOriginHref);
  bindRuntimeValue(
    runtime,
    "shouldHandleLinkWithRouter",
    () => shouldHandleLinkWithRouter,
  );
  bindRuntimeValue(runtime, "normalizeRouterHref", () => normalizeRouterHref);
  bindRuntimeValue(runtime, "isModifiedLinkClick", () => isModifiedLinkClick);
  bindRuntimeValue(runtime, "pickLinkEventProps", () => pickLinkEventProps);
  bindRuntimeValue(runtime, "omitLinkEventProps", () => omitLinkEventProps);
  bindRuntimeValue(
    runtime,
    "composeLinkEventHandlers",
    () => composeLinkEventHandlers,
  );
  bindRuntimeValue(runtime, "useCdsLink", () => useCdsLink);
  bindRuntimeValue(
    runtime,
    "reactCdsLink",
    () => reactCdsLink,
    (value) => {
      reactCdsLink = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cdsRouterContext",
    () => cdsRouterContext,
    (value) => {
      cdsRouterContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "forbiddenHrefControlCharacterPattern",
    () => forbiddenHrefControlCharacterPattern,
    (value) => {
      forbiddenHrefControlCharacterPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "leadingHrefWhitespacePattern",
    () => leadingHrefWhitespacePattern,
    (value) => {
      leadingHrefWhitespacePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "networkPathHrefPattern",
    () => networkPathHrefPattern,
    (value) => {
      networkPathHrefPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "rootRelativeHrefPattern",
    () => rootRelativeHrefPattern,
    (value) => {
      rootRelativeHrefPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "unrootedHrefPattern",
    () => unrootedHrefPattern,
    (value) => {
      unrootedHrefPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "relativePathDotSegmentPattern",
    () => relativePathDotSegmentPattern,
    (value) => {
      relativePathDotSegmentPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "dotSegmentPattern",
    () => dotSegmentPattern,
    (value) => {
      dotSegmentPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "encodedOrBackslashPathPattern",
    () => encodedOrBackslashPathPattern,
    (value) => {
      encodedOrBackslashPathPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "allowedHrefSchemePattern",
    () => allowedHrefSchemePattern,
    (value) => {
      allowedHrefSchemePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "androidIntentHrefPattern",
    () => androidIntentHrefPattern,
    (value) => {
      androidIntentHrefPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "editorHrefSchemePattern",
    () => editorHrefSchemePattern,
    (value) => {
      editorHrefSchemePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "allowedEditorHrefPattern",
    () => allowedEditorHrefPattern,
    (value) => {
      allowedEditorHrefPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "allowedIntentPropertyNames",
    () => allowedIntentPropertyNames,
    (value) => {
      allowedIntentPropertyNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "absoluteHrefPattern",
    () => absoluteHrefPattern,
    (value) => {
      absoluteHrefPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "trustedFirstPartyDomains",
    () => trustedFirstPartyDomains,
    (value) => {
      trustedFirstPartyDomains = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "trustedAndroidIntentPackages",
    () => trustedAndroidIntentPackages,
    (value) => {
      trustedAndroidIntentPackages = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HTTPS_RELATIVE_HREF_BASE",
    () => HTTPS_RELATIVE_HREF_BASE,
    (value) => {
      HTTPS_RELATIVE_HREF_BASE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HTTP_RELATIVE_HREF_BASE",
    () => HTTP_RELATIVE_HREF_BASE,
    (value) => {
      HTTP_RELATIVE_HREF_BASE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "linkEventPropNames",
    () => linkEventPropNames,
    (value) => {
      linkEventPropNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "linkPrefetchEventKinds",
    () => linkPrefetchEventKinds,
    (value) => {
      linkPrefetchEventKinds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "linkPrefetchEventNames",
    () => linkPrefetchEventNames,
    (value) => {
      linkPrefetchEventNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeCdsLink",
    () => initializeCdsLink,
    (value) => {
      initializeCdsLink = value;
    },
  );
  bindRuntimeValue(runtime, "getElementWindow", () => getElementWindow);
  bindRuntimeValue(
    runtime,
    "elementHasUnavailableWindow",
    () => elementHasUnavailableWindow,
  );
  bindRuntimeValue(
    runtime,
    "getConnectedElementWindow",
    () => getConnectedElementWindow,
  );
  bindRuntimeValue(runtime, "hasCdsHtmlFontSizing", () => hasCdsHtmlFontSizing);
  bindRuntimeValue(
    runtime,
    "migrateCdsHtmlFontSizing",
    () => migrateCdsHtmlFontSizing,
  );
  bindRuntimeValue(
    runtime,
    "getControlSizeAttributes",
    () => getControlSizeAttributes,
  );
  bindRuntimeValue(runtime, "getDensitySizeIndex", () => getDensitySizeIndex);
  bindRuntimeValue(runtime, "createColorModeStore", () => createColorModeStore);
  bindRuntimeValue(runtime, "usePageBackground", () => usePageBackground);
  bindRuntimeValue(runtime, "useDensity", () => useDensity);
  bindRuntimeValue(runtime, "useResolvedColorMode", () => useResolvedColorMode);
  bindRuntimeValue(runtime, "useColorMode", () => useColorMode);
  bindRuntimeValue(runtime, "usePlatform", () => usePlatform);
  bindRuntimeValue(runtime, "useFont", () => useFont);
  bindRuntimeValue(runtime, "useMonospaceFont", () => useMonospaceFont);
  bindRuntimeValue(
    runtime,
    "getMonospaceOverrideStyle",
    () => getMonospaceOverrideStyle,
  );
  bindRuntimeValue(runtime, "useSurfaceBackground", () => useSurfaceBackground);
  bindRuntimeValue(
    runtime,
    "getSurfaceBackgroundStyle",
    () => getSurfaceBackgroundStyle,
  );
  bindRuntimeValue(runtime, "isTintedFillSurface", () => isTintedFillSurface);
  bindRuntimeValue(
    runtime,
    "sanitizeCssBackground",
    () => sanitizeCssBackground,
  );
  bindRuntimeValue(runtime, "isSurfaceToken", () => isSurfaceToken);
  bindRuntimeValue(runtime, "useCdsConfig", () => useCdsConfig);
  bindRuntimeValue(runtime, "useRootElement", () => useRootElement);
  bindRuntimeValue(runtime, "usePortalContainer", () => usePortalContainer);
  bindRuntimeValue(runtime, "useRootWindow", () => useRootWindow);
  bindRuntimeValue(runtime, "CdsRoot", () => CdsRoot);
  bindRuntimeValue(
    runtime,
    "reactCdsRoot",
    () => reactCdsRoot,
    (value) => {
      reactCdsRoot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxCdsRoot",
    () => jsxCdsRoot,
    (value) => {
      jsxCdsRoot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "subscribePlatformNoop",
    () => subscribePlatformNoop,
    (value) => {
      subscribePlatformNoop = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getWebPlatformSnapshot",
    () => getWebPlatformSnapshot,
    (value) => {
      getWebPlatformSnapshot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getCoarsePointerServerSnapshot",
    () => getCoarsePointerServerSnapshot,
    (value) => {
      getCoarsePointerServerSnapshot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "subscribeRootCoarsePointer",
    () => subscribeRootCoarsePointer,
    (value) => {
      subscribeRootCoarsePointer = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hasMigratedHtmlFontSizing",
    () => hasMigratedHtmlFontSizing,
    (value) => {
      hasMigratedHtmlFontSizing = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "densitySizeIndices",
    () => densitySizeIndices,
    (value) => {
      densitySizeIndices = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "controlSizeOffsets",
    () => controlSizeOffsets,
    (value) => {
      controlSizeOffsets = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "densityContext",
    () => densityContext,
    (value) => {
      densityContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "portalDensityContext",
    () => portalDensityContext,
    (value) => {
      portalDensityContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "colorModeStoreContext",
    () => colorModeStoreContext,
    (value) => {
      colorModeStoreContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultColorModeStore",
    () => defaultColorModeStore,
    (value) => {
      defaultColorModeStore = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DARK_COLOR_SCHEME_QUERY",
    () => DARK_COLOR_SCHEME_QUERY,
    (value) => {
      DARK_COLOR_SCHEME_QUERY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeColorMode",
    () => normalizeColorMode,
    (value) => {
      normalizeColorMode = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "platformContext",
    () => platformContext,
    (value) => {
      platformContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontContext",
    () => fontContext,
    (value) => {
      fontContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "monospaceFontContext",
    () => monospaceFontContext,
    (value) => {
      monospaceFontContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pageBackgroundContext",
    () => pageBackgroundContext,
    (value) => {
      pageBackgroundContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "naturalImageTilesContext",
    () => naturalImageTilesContext,
    (value) => {
      naturalImageTilesContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "densityOverrideContext",
    () => densityOverrideContext,
    (value) => {
      densityOverrideContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "surfaceBackgroundContext",
    () => surfaceBackgroundContext,
    (value) => {
      surfaceBackgroundContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "localeContext",
    () => localeContext,
    (value) => {
      localeContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "rootElementContext",
    () => rootElementContext,
    (value) => {
      rootElementContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "rootPortalContainerContext",
    () => rootPortalContainerContext,
    (value) => {
      rootPortalContainerContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isPortalRootContext",
    () => isPortalRootContext,
    (value) => {
      isPortalRootContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "opaqueTintOverrides",
    () => opaqueTintOverrides,
    (value) => {
      opaqueTintOverrides = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "surfaceTokenNames",
    () => surfaceTokenNames,
    (value) => {
      surfaceTokenNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeCdsRoot",
    () => initializeCdsRoot,
    (value) => {
      initializeCdsRoot = value;
    },
  );
  return () => {
    MAX_OVERLAY_OWNER_DEPTH = 8;
    initializeOverlayOwners = (0, runtime.initializeOnce)(() => {
      overlayOwnerResolvers = new WeakMap();
    });
    initializeOverlayFocus = (0, runtime.initializeOnce)(() => {
      initializeCdsRoot();
      (0, runtime.initializeElementAccess)();
      (0, runtime.initializeTextEntrySelector)();
      (0, runtime.initializeSafeBlur)();
      initializeOverlayOwners();
      reactOverlayFocus = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
    });
    OVERLAY_ATTRIBUTE = "data-cds-overlay";
    initializeOverlaySelector = (0, runtime.initializeOnce)(() => {
      OPEN_OVERLAY_SELECTOR_VQ5 = `[${OVERLAY_ATTRIBUTE}][data-open]`;
    });
    DOCUMENT_NODE_TYPE = 9;
    initializeOverlayStack = (0, runtime.initializeOnce)(() => {
      reactOverlayStack = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      overlayStackContext = reactOverlayStack.createContext<OverlayStack | null>(null);
    });
    initializeMenuOverlayRegistration = (0, runtime.initializeOnce)(
      () => {
        initializeOverlaySelector();
        (0, runtime.initializeMenuContexts)();
        initializeOverlayStack();
        reactMenuOverlayRegistration = (0, runtime.toModuleNamespace)(
          (0, runtime.loadReactNamespace)(),
          1,
        );
        menuOverlayAttributes = {
          [OVERLAY_ATTRIBUTE]: "",
        };
      },
    );
    initializeContextMenuPopup = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeLayers)();
      (0, runtime.initializeMergedRefs)();
      (0, runtime.initializePortalRoot)();
      (0, runtime.initializeCollisionPadding)();
      (0, runtime.initializeSurfaces)();
      (0, runtime.initializeAdaptiveSheets)();
      (0, runtime.initializeKeyboardContextMenuFocus)();
      initializeOverlayFocus();
      initializeMenuOverlayRegistration();
      (0, runtime.initializeMenuScrollContent)();
      (0, runtime.initializeNpmDependency)();
      reactContextMenuPopup = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxContextMenuPopup = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      contextMenuPopupClasses = `cds-reset draggable-none group/menu-popup relative flex flex-col min-w-[128px] max-w-[320px] max-h-[var(--available-height)] ${(0, runtime.getSurfaceClasses)("popover")} text-body font-normal text-primary outline-none focus-visible:outline-hidden`;
      ContextMenuPopupFrame = reactContextMenuPopup.forwardRef<HTMLDivElement, ContextMenuPopupFrameProps>(
        (
          {
            anchor: anchor,
            side: side,
            align: align,
            sideOffset: sideOffset,
            collisionPadding: collisionPadding,
            finalFocus: finalFocus,
            className: className,
            children: children,
            "data-cds": dataCds,
            ...props
          },
          options,
        ) => {
          let { finalFocus: value, popupRef: value2 } =
            useOverlayFocusReturn({
              registerOpenerReturn:
                finalFocus === undefined || finalFocus === null,
            });
          (0, runtime.useKeyboardContextMenuInitialFocus)(value2);
          let value3 = (0, runtime.useDefaultOverlayLayer)(
              "contextmenu",
            ),
            { elementRef: value4, overlayAttrs: value5 } =
              useMenuOverlayRegistration(),
            value6 = (0, runtime.useMergedRefs)(
              options,
              value2,
              value4,
            );
          return jsxContextMenuPopup.jsx(runtime.ResetSheetContexts, {
            children: jsxContextMenuPopup.jsx(runtime.PortalRoot, {
              ...value3.portalProps,
              surface: runtime.elevationSurfaceNames.popover,
              companionModalCatcher: true,
              closeOnActivityHide: true,
              children: jsxContextMenuPopup.jsx(
                runtime.CollisionPaddingProvider,
                {
                  override: collisionPadding,
                  provideInherit: true,
                  children: (input: CollisionPadding | undefined) =>
                    jsxContextMenuPopup.jsx(runtime.layerBaseContext.Provider, {
                      value: value3.base,
                      children: jsxContextMenuPopup.jsx(
                        runtime.baseContextMenu.Positioner,
                        {
                          style: value3.style,
                          anchor: anchor,
                          side: side,
                          align: align,
                          sideOffset: sideOffset,
                          collisionPadding: input,
                          children: jsxContextMenuPopup.jsx(
                            runtime.baseContextMenu.Popup,
                            {
                              "data-cds": dataCds,
                              ...value5,
                              ref: value6,
                              finalFocus: finalFocus ?? value,
                              ...props,
                              className: (0, runtime.cn)(
                                contextMenuPopupClasses,
                                className,
                              ),
                              children: jsxContextMenuPopup.jsx(
                                runtime.MenuScrollContent,
                                {
                                  children: children,
                                },
                              ),
                            },
                          ),
                        },
                      ),
                    }),
                },
              ),
            }),
          });
        },
      );
      ContextMenuPopupFrame.displayName = "ContextMenuPopupFrame";
    });
    initializeClickToFocus = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeTextEntrySelector)();
      (0, runtime.initializeEventCallbacks)();
      reactClickToFocus = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      INTERACTIVE_CLICK_TARGET_SELECTOR = `button,a[href],label,[role="button"],select,[tabindex]:not([tabindex="-1"]),${runtime.TEXT_ENTRY_SELECTOR}`;
    });
    FORM_POINTER_FOCUS_SELECTOR =
      'input[type="range"], select, input[readonly], textarea[readonly]';
    SELECT_ELEMENT_SELECTOR = "select";
    DRAGGABLE_ELEMENT_SELECTOR = '[draggable="true"]';
    initializePopupPointerFocus = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeElementAccess)();
      initializeClickToFocus();
      (0, runtime.initializeVisualKeyboard)();
    });
    PASSIVE_HOVER_OPEN_REASON = "trigger-hover";
    PASSIVE_FOCUS_OUT_REASON = "focus-out";
    subscribePassiveOpenNoop = () => () => {
      return;
    };
    getPassiveOffSnapshot = () => "off";
    unchangedPopupProps = (input: PassivePopupProps) => input;
    initializePassiveOpen = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeElementAccess)();
      (0, runtime.initializeSafeBlur)();
      initializePopupPointerFocus();
      reactPassiveOpen = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxPassiveOpen = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      reactDomPassiveOpen = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactDomNamespace)(),
        1,
      );
      passiveOpenStateContext = reactPassiveOpen.createContext<PassiveOpenCell | null>(null);
      passiveFocusDeclinedContext = reactPassiveOpen.createContext(false);
      passiveDeclinedFocusProps = {
        tabIndex: undefined,
      };
      passiveDefaultFocusProps = {};
      passiveOpenEngagementKeys = new Set([
        "ArrowDown",
        "ArrowUp",
        "Home",
        "End",
      ]);
      (PassiveOpenGate as DisplayNamedComponent).displayName = "PassiveOpenGate";
      passiveOpenModifierKeys = new Set([
        "Shift",
        "Control",
        "Alt",
        "Meta",
        "AltGraph",
        "CapsLock",
        "NumLock",
        "ScrollLock",
        "Fn",
        "FnLock",
        "Hyper",
        "Super",
        "Symbol",
        "SymbolLock",
      ]);
    });
    menuItemDescriptionPaddingClass =
      "pb-[calc((var(--cds-h-control)-var(--cds-font-size-body)-var(--cds-leading-footnote)+var(--cds-font-size-footnote))/2)]";
    initializeMenuItemVariants = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeNpmDependency)();
      menuItemVariants = (0, runtime.cva)(
        "cds-reset flex w-full items-center gap-xs compact:px-2 comfortable:px-2.5 py-[calc((var(--cds-h-control)-var(--cds-leading-body))/2)] rounded text-body font-normal [--cds-shortcut-cap-ink:var(--cds-text-muted)] select-none outline-none focus-visible:outline-hidden data-[disabled]:opacity-disabled data-[disabled]:pointer-events-none",
        {
          variants: {
            variant: {
              default: "text-primary data-[highlighted]:bg-fill-ghost-hover",
              danger:
                "group/menu-danger text-danger data-[highlighted]:bg-fill-danger data-[highlighted]:text-on-danger data-[highlighted]:[--cds-shortcut-cap-ink:currentColor]",
            },
          },
          defaultVariants: {
            variant: "default",
          },
        },
      );
    });
    initializeMenuOpener = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeIsomorphicLayoutEffect)();
      (0, runtime.initializeEventCallbacks)();
      initializeOverlayOwners();
      reactMenuOpener = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      menuOpenerRefContext = reactMenuOpener.createContext<RefObject<Element | null> | undefined>(undefined);
      MenuOpenerProvider = menuOpenerRefContext.Provider;
    });
    initializeMenuPopupElement = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeMergedRefs)();
      (0, runtime.initializeAdaptiveSheets)();
      initializeOverlayFocus();
      initializeMenuOverlayRegistration();
      initializeMenuOpener();
      (0, runtime.initializeNpmDependency)();
      reactMenuPopupElement = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxMenuPopupElement = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      MenuPopupElement = reactMenuPopupElement.forwardRef<HTMLDivElement, MenuPopupElementProps>(
        (
          {
            anchoredWithoutFinalFocus: anchoredWithoutFinalFocus,
            cursorAnchored = false,
            finalFocus: finalFocus,
            ...props
          },
          options,
        ) => {
          let value =
              reactMenuPopupElement.useContext(runtime.sheetFrameContext)
                ?.open ?? true,
            { elementRef: value2, overlayAttrs: value3 } =
              useMenuOverlayRegistration(),
            value4 = useOverlayFocusReturn({
              open: value,
              skipRestoreOnOutsideFocus: !cursorAnchored,
              registerOpenerReturn: anchoredWithoutFinalFocus,
              triggerRef: useMenuOpenerRef(),
            }),
            value5 = (0, runtime.useMergedRefs)(
              options,
              value2,
              anchoredWithoutFinalFocus ? value4.popupRef : undefined,
            );
          return jsxMenuPopupElement.jsx(runtime.baseMenu.Popup, {
            ...value3,
            ref: value5,
            finalFocus:
              (finalFocus === undefined ||
                (cursorAnchored && finalFocus === null)) &&
              anchoredWithoutFinalFocus
                ? value4.finalFocus
                : finalFocus,
            ...props,
          });
        },
      );
      MenuPopupElement.displayName = "MenuPopupElement";
    });
    heldPositionerClasses = "pointer-events-none";
    heldPopupClasses = "pointer-events-auto";
    POPUP_PLACEMENT_SETTLE_FRAMES = 2;
    initializeStablePopupPlacement = (0, runtime.initializeOnce)(
      () => {
        reactStablePopupPlacement = (0, runtime.toModuleNamespace)(
          (0, runtime.loadReactNamespace)(),
          1,
        );
      },
    );
    COARSE_OR_HOVERLESS_QUERY = "(pointer: coarse), (hover: none)";
    MOBILE_WIDTH_QUERY = "(width < 40rem)";
    TOUCH_DEVICE_QUERY = "(pointer: coarse)";
    ELECTRON_USER_AGENT_TOKEN = " Electron/";
    initializeModalReleasePlatform = () => {};
    MODAL_INERT_LIVE_REGION_SELECTOR =
      '[aria-live]:not([aria-live="off"]), [role="status"], [role="alert"], [role="log"], [data-cds="Toast"]';
    initializeModalPortalInert = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeIsomorphicLayoutEffect)();
      initializeCdsRoot();
      initializeModalReleasePlatform();
      (0, runtime.initializeEventCallbacks)();
      (0, runtime.initializeReducedMotion)();
      reactModalPortalInert = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      inertExcludedTags = new Set([
        "SCRIPT",
        "STYLE",
        "LINK",
        "TEMPLATE",
        "NOSCRIPT",
      ]);
      modalInertRefCounts = new WeakMap();
    });
    initializeMenuSheetPopup = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeIsomorphicLayoutEffect)();
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeTranslations)();
      initializeCdsRoot();
      (0, runtime.initializeLayers)();
      (0, runtime.initializeAndroidCloseWatcher)();
      (0, runtime.initializeMergedRefs)();
      (0, runtime.initializePortalRoot)();
      (0, runtime.initializeIcons)();
      (0, runtime.initializeCollisionPadding)();
      (0, runtime.initializeSurfaces)();
      (0, runtime.initializeSheetStyles)();
      (0, runtime.initializePresentationMode)();
      (0, runtime.initializeAdaptiveSheets)();
      (0, runtime.initializeSheetClassNames)();
      (0, runtime.initializeMenuContexts)();
      (0, runtime.initializeMenuScrollContent)();
      initializeContextMenuPopup();
      initializePassiveOpen();
      initializeMenuItemVariants();
      initializeMenuOpener();
      initializeMenuPopupElement();
      initializeStablePopupPlacement();
      (0, runtime.initializeSheetDrag)();
      (0, runtime.initializeSheetChrome)();
      (0, runtime.initializeSheetMeasurement)();
      initializeModalPortalInert();
      (0, runtime.initializeNpmDependency)();
      reactMenuSheetPopup = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxMenuSheetPopup = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      coveredMenuSheetOwners = new WeakMap();
      MenuSheetPopup = reactMenuSheetPopup.forwardRef<HTMLDivElement, MenuSheetPopupProps>(
        (
          {
            side: side,
            align = "start",
            sideOffset: sideOffset,
            collisionPadding: collisionPadding,
            collisionAvoidance: collisionAvoidance,
            anchor: anchor,
            container: container,
            className: className,
            children: children,
            header: header,
            footer: footer,
            maxVisibleItems: maxVisibleItems,
            layerOffset: layerOffset,
            stableWhileOpen = false,
            "data-cds": dataCds = "Menu",
            style: style,
            initialFocus: initialFocus,
            ...props
          },
          options,
        ) => {
          let value = usePortalContainer(),
            value2 = reactMenuSheetPopup.useContext(
              runtime.menuTriggerContext,
            ),
            value3 =
              reactMenuSheetPopup.useContext(runtime.contextMenuContext) &&
              value2 === null,
            value4 = (0, runtime.useIsSheet)(),
            value5 = value4 && value2 !== null,
            value6 = reactMenuSheetPopup.useContext(
              runtime.collisionPaddingContext,
            ),
            value7 = collisionPadding ?? value6?.collisionPadding,
            memo = reactMenuSheetPopup.useMemo(
              () =>
                anchor !== undefined || !value2
                  ? anchor
                  : (0, runtime.createMenuVirtualAnchor)(value2),
              [anchor, value2],
            ),
            value8 =
              sideOffset ??
              (value3 ? undefined : value2 && anchor === undefined ? 2 : 6),
            value9 = useStablePopupPlacement({
              enabled: stableWhileOpen && !value4 && !value3,
              side: side,
              align: align,
            }),
            value10 = reactMenuSheetPopup.useContext(
              runtime.sheetFrameContext,
            ),
            value11 = reactMenuSheetPopup.useContext(
              runtime.submenuStateContext,
            ),
            ref = reactMenuSheetPopup.useRef<HTMLElement | null>(null),
            ref2 = reactMenuSheetPopup.useRef<Element | null>(null),
            callback = reactMenuSheetPopup.useCallback(() => {
              let current = ref2.current;
              if (current !== null) {
                uncoverParentMenuSheet(current, ref2);
                ref2.current = null;
              }
            }, []),
            callback2 = reactMenuSheetPopup.useCallback(
              (element: HTMLElement) => {
                if (value2 === null) {
                  return;
                }
                let value43 =
                  value10 !== null
                    ? (value2.triggerRef.current?.closest(
                        `[data-sheet-tree="${CSS.escape(value10.treeId)}"][data-presentation="sheet"]`,
                      ) ?? null)
                    : null;
                if (value43 !== null && ref2.current !== value43) {
                  callback();
                  coverParentMenuSheet(value43, ref2);
                  ref2.current = value43;
                }
                if (!element.contains(element.ownerDocument.activeElement)) {
                  element.focus({
                    preventScroll: true,
                  });
                }
              },
              [value2, callback, value10],
            ),
            [value12, value13] = reactMenuSheetPopup.useState(false),
            ref3 = reactMenuSheetPopup.useRef(false),
            callback3 = reactMenuSheetPopup.useCallback(
              (input: boolean) => {
                ref3.current = input;
                value13(input);
              },
              [],
            ),
            [value14, value15] = reactMenuSheetPopup.useState<HTMLElement | null>(null),
            value16 = value10?.takeCloseRequest,
            callback4 = reactMenuSheetPopup.useCallback(
              () => getSheetInertReleaseTiming(value16?.() ?? null),
              [value16],
            ),
            value17 = useModalPortalInert({
              node: value14,
              open: value4 && !value5 && (value10?.open ?? false),
              liftOnClose: callback4,
            }),
            value18 = (0, runtime.useSheetState)(),
            value19 = reactMenuSheetPopup.useContext(
              runtime.sheetParentContext,
            ),
            value20 = reactMenuSheetPopup.useContext(
              runtime.sheetCoverContext,
            ),
            [value21, value22] = reactMenuSheetPopup.useState<HTMLElement | null>(null),
            callback5 = reactMenuSheetPopup.useCallback(
              (element: HTMLElement | null) => {
                ref.current = value4 ? element : null;
                value22(value4 ? element : null);
                value15(value4 && !value5 ? element : null);
                if (element === null) {
                  value17();
                  callback();
                  callback3(false);
                  return;
                }
                if (!value4) {
                  callback3(false);
                  return;
                }
                if (!value5) {
                  let value43 = (0, runtime.hasEditableSheetContent)(
                    element,
                  );
                  if (value43) {
                    element.style.minHeight = runtime.MIN_SHEET_HEIGHT_CSS;
                    element.style.maxHeight = runtime.MIN_SHEET_HEIGHT_CSS;
                  }
                  callback3(value43);
                  value10?.pinHeight(
                    element.getBoundingClientRect().height,
                    (0, runtime.sheetContentCanGrow)(element),
                  );
                  return;
                }
                callback2(element);
                element.style.transition = "none";
                element.style.translate =
                  element.ownerDocument.defaultView?.getComputedStyle(element)
                    .direction === "rtl"
                    ? "-100% 0"
                    : "100% 0";
                element.getBoundingClientRect();
                element.style.transition = "";
                element.style.translate = "";
              },
              [
                value4,
                value5,
                value10,
                callback,
                callback2,
                callback3,
                value17,
              ],
            );
          (0, runtime.useSheetTextEntryFocus)(value21, value10);
          (0, runtime.useSheetPressedState)(value21);
          (0, runtime.useDismissSheetOnForeignFocus)(
            value21,
            value10,
            value18.covered,
          );
          let value23 = value4 && value18.covered,
            value24 = value4 && value18.inert;
          (0, runtime.useAndroidCloseWatcher)(
            value4 && (value5 ? value11.open : (value10?.open ?? false)),
            value5 ? value2?.close : value10?.dismiss,
          );
          let ref4 = reactMenuSheetPopup.useRef(false),
            value25 = value10?.open ?? false;
          (0, runtime.useIsomorphicLayoutEffect)(() => {
            let current = ref.current,
              value43 = value5 && value11.open && current !== null,
              current2 = ref4.current;
            ref4.current = value43;
            if (value43 && !current2) {
              callback2(current as HTMLElement);
            } else if (!value43 && value25) {
              callback();
            }
          }, [value5, value11.open, value25, callback2, callback]);
          let ref5 = reactMenuSheetPopup.useRef(false),
            [value26, value27] = reactMenuSheetPopup.useState(false);
          (0, runtime.useIsomorphicLayoutEffect)(() => {
            let value43 = value5 && value11.open,
              current = ref5.current;
            ref5.current = value43;
            if (value43 !== current) {
              value27(!value43 && value25);
            }
          }, [value5, value11.open, value25]);
          (0, runtime.useIsomorphicLayoutEffect)(() => {
            let current = ref.current;
            if (value5 && value11.open && current !== null) {
              (0, runtime.resetSheetDragStyle)(current);
            }
          }, [value5, value11.open]);
          let value28 = value10?.pushLevelHeight,
            value29 = value10?.drag;
          reactMenuSheetPopup.useEffect(() => {
            if (
              !value5 ||
              !value11.open ||
              value21 === null ||
              value28 === undefined
            ) {
              return;
            }
            let defaultView = value21.ownerDocument.defaultView,
              value43: SheetLevelHandle | undefined,
              flag = false,
              callback6 = () => {
                let value47 = defaultView?.innerHeight ?? 1 / 0,
                  value48 =
                    (defaultView
                      ? (0, runtime.getSheetAvailableHeight)(
                          defaultView,
                          value21,
                        )
                      : 1 / 0) * runtime.MAX_SHEET_HEIGHT_FRACTION,
                  value49 = (0, runtime.hasEditableSheetContent)(
                    value21,
                  ),
                  value50 = (0, runtime.measureNaturalSheetHeight)(
                    value21,
                  );
                flag = value50 > value48;
                let value51 = value49
                    ? value47 * runtime.MIN_SHEET_HEIGHT_FRACTION
                    : Math.min(value50, value48),
                  value52 = value49 || flag;
                if (value43 === undefined) {
                  value43 = value28(value51, value52);
                } else {
                  value43.set(value51, value52);
                }
              },
              callback7 = () => {
                value45 = undefined;
                if (value29 !== undefined && value29.get() !== null) {
                  value45 = defaultView?.requestAnimationFrame(callback7);
                  return;
                }
                if (!value44.ready()) {
                  return;
                }
                callback6();
              },
              value44 = (0, runtime.createSheetUncoverGate)(
                value21,
                () => {
                  if (value45 === undefined) {
                    value45 = defaultView?.requestAnimationFrame(callback7);
                  }
                },
              ),
              value45 = defaultView?.requestAnimationFrame(callback7),
              value46 =
                defaultView !== null &&
                typeof defaultView.MutationObserver !== "undefined"
                  ? new defaultView.MutationObserver(
                      (input: MutationRecord[]) => {
                        if (
                          value45 !== undefined ||
                          value43 === undefined ||
                          (0, runtime.isScrollContentReplacement)(input, flag)
                        ) {
                          return;
                        }
                        value45 = defaultView.requestAnimationFrame(callback7);
                      },
                    )
                  : null;
            value46?.observe(value21, {
              childList: true,
              subtree: true,
            });
            return () => {
              value46?.disconnect();
              value44.dispose();
              if (value45 !== undefined) {
                defaultView?.cancelAnimationFrame(value45);
              }
              value43?.release();
            };
          }, [value5, value11.open, value21, value28, value29]);
          let value30 = value10?.repinHeight,
            value31 = value10?.open ?? false;
          reactMenuSheetPopup.useEffect(() => {
            if (
              !value4 ||
              value5 ||
              !value31 ||
              value21 === null ||
              value30 === undefined
            ) {
              return;
            }
            let defaultView = value21.ownerDocument.defaultView;
            if (
              defaultView === null ||
              typeof defaultView.MutationObserver === "undefined"
            ) {
              return;
            }
            let index = 0,
              flag = false,
              callback6 = () => {
                index = 0;
                if (value29 !== undefined && value29.get() !== null) {
                  index = defaultView.requestAnimationFrame(callback6);
                  return;
                }
                if (!value43.ready()) {
                  return;
                }
                if ((0, runtime.hasEditableSheetContent)(value21)) {
                  if (!ref3.current) {
                    callback3(true);
                    value30(
                      defaultView.innerHeight *
                        runtime.MIN_SHEET_HEIGHT_FRACTION,
                      true,
                    );
                  }
                  return;
                }
                let value45 =
                    (0, runtime.getSheetAvailableHeight)(defaultView, value21) *
                    runtime.MAX_SHEET_HEIGHT_FRACTION,
                  value46 = (0, runtime.measureNaturalSheetHeight)(
                    value21,
                  );
                flag = value46 > value45;
                let value47 = (0, runtime.getSheetMinimumHeight)(
                  defaultView.innerHeight,
                  ref3.current,
                );
                value30(Math.max(Math.min(value46, value45), value47), flag);
              },
              value43 = (0, runtime.createSheetUncoverGate)(
                value21,
                () => {
                  if (index === 0) {
                    index = defaultView.requestAnimationFrame(callback6);
                  }
                },
              ),
              value44 = new defaultView.MutationObserver(
                (input: MutationRecord[]) => {
                  if (
                    index !== 0 ||
                    (0, runtime.isScrollContentReplacement)(input, flag)
                  ) {
                    return;
                  }
                  index = defaultView.requestAnimationFrame(callback6);
                },
              );
            value44.observe(value21, {
              childList: true,
              subtree: true,
            });
            return () => {
              value44.disconnect();
              value43.dispose();
              if (index !== 0) {
                defaultView.cancelAnimationFrame(index);
              }
            };
          }, [value4, value5, value31, value21, value30, value29, callback3]);
          let value32 = value10?.height,
            value33 = value10?.pinHeight;
          (0, runtime.useIsomorphicLayoutEffect)(() => {
            let current = ref.current;
            if (
              !value4 ||
              value5 ||
              value32 !== undefined ||
              current === null
            ) {
              return;
            }
            (0, runtime.resetSheetDragStyle)(current);
            value33?.(
              current.getBoundingClientRect().height,
              (0, runtime.sheetContentCanGrow)(current),
            );
          }, [value4, value5, value32, value33]);
          let value34 = useMenuOwnerRef(
              value2?.triggerRef,
              props.finalFocus,
            ),
            value35 = value3
              ? props.finalFocus === undefined || props.finalFocus === null
              : anchor !== undefined &&
                anchor !== null &&
                value2 === null &&
                props.finalFocus === undefined,
            value36 = usePassiveOpenContext(value2 === null);
          value36.root?.declareFocusProps(initialFocus, props.finalFocus);
          if (value2 !== null && initialFocus !== undefined) {
            (0, runtime.warnNestedMenuInitialFocus)();
          }
          let state = {
              ...props,
              onKeyDown: (input: BaseUIEvent<ReactKeyboardEvent<HTMLDivElement>>) => {
                props.onKeyDown?.(input);
                preventModalTabNavigation(input);
              },
            },
            value37 = (0, runtime.useStableMergedRef)(
              (input: HTMLDivElement | null) => {
                value9.popupRef(input);
                callback5(input);
                value34(input);
                value36.root?.registerPopup(input);
              },
              options,
            ),
            value38 = value4
              ? (0, runtime.getSheetPopupStyle)(value10, {
                  floor: value12 ? "half" : "content",
                  parentFrameHeight: value5 ? undefined : value19?.frameHeight,
                })
              : undefined,
            value39 =
              value38 === undefined
                ? style
                : typeof style === "function"
                  ? (input: BaseMenu.Popup.State) => ({
                      ...style(input),
                      ...value38,
                    })
                  : {
                      ...style,
                      ...value38,
                    };
          if (value2 !== null && layerOffset !== undefined) {
            (0, runtime.warnNestedMenuLayerOffset)();
          }
          let value40 = (0, runtime.useOverlayLayer)(
              value3 ? "contextmenu" : "menu",
              value2 === null ? layerOffset : undefined,
            ),
            value41 = useRootWindow(),
            value42 = (0, runtime.getSheetFrameHeight)(
              value10,
              value41,
              value21,
            ),
            memo2 = reactMenuSheetPopup.useMemo(
              () =>
                value4 && value20 !== null
                  ? {
                      depth: value18.depth,
                      frameHeight: value42,
                      cover: value20,
                    }
                  : null,
              [value4, value20, value18.depth, value42],
            );
          return jsxMenuSheetPopup.jsx(runtime.baseMenu.Portal, {
            container: container ?? value,
            children: jsxMenuSheetPopup.jsxs(runtime.PortalRoot, {
              ...value40.portalProps,
              surface: runtime.elevationSurfaceNames.popover,
              density: value4 ? runtime.SHEET_DENSITY : undefined,
              companionModalCatcher: !value4,
              closeOnActivityHide: true,
              children: [
                value4 &&
                  !value5 &&
                  jsxMenuSheetPopup.jsx(runtime.baseMenu.Backdrop, {
                    "data-presentation": "sheet",
                    "data-sheet-scrim": value10?.treeId,
                    className:
                      value18.depth > 0
                        ? "draggable-none fixed inset-0 bg-transparent"
                        : runtime.sheetBackdropClasses,
                  }),
                jsxMenuSheetPopup.jsx(runtime.CollisionPaddingProvider, {
                  override: value7,
                  container: container ?? value,
                  provideInherit: true,
                  children: (input: CollisionPadding | undefined) =>
                    jsxMenuSheetPopup.jsx(runtime.layerBaseContext.Provider, {
                      value: value40.base,
                      children: jsxMenuSheetPopup.jsx(
                        runtime.baseMenu.Positioner,
                        {
                          ref: value9.positionerRef,
                          "data-sheet-tree": value4
                            ? value10?.treeId
                            : undefined,
                          style: value4
                            ? {
                                ...value40.style,
                                ...(0, runtime.getSheetPositionerStyle)(
                                  value10,
                                ),
                              }
                            : value9.held !== null
                              ? {
                                  ...value40.style,
                                  ...value9.held.positionerStyle,
                                }
                              : value40.style,
                          side: value9.side,
                          align: value9.align,
                          sideOffset: value8,
                          collisionPadding: input,
                          collisionAvoidance: collisionAvoidance,
                          anchor: memo,
                          ...(value4 ? runtime.sheetPositioningOverrides : {}),
                          className: value4
                            ? value5
                              ? runtime.sheetClipClasses
                              : value18.depth === 0
                                ? runtime.sheetOverflowBackgroundClasses
                                : undefined
                            : value9.held?.positionerClassName,
                          children: jsxMenuSheetPopup.jsx(PassiveOpenGate, {
                            cell: value4 ? null : value36.cell,
                            nested: value2 !== null,
                            children: (input2: PassivePopupPropsTransform) =>
                              jsxMenuSheetPopup.jsx(MenuPopupElement, {
                                anchoredWithoutFinalFocus: value35,
                                cursorAnchored: value3,
                                "data-cds": dataCds,
                                "data-presentation": value4
                                  ? "sheet"
                                  : undefined,
                                "data-sheet-tree": value4
                                  ? value10?.treeId
                                  : undefined,
                                "data-cds-sheet-depth": value4
                                  ? String(value18.depth)
                                  : undefined,
                                ...(value23
                                  ? {
                                      [runtime.SHEET_COVERED_ATTRIBUTE]: "",
                                    }
                                  : {}),
                                ...(value24 ? runtime.inertElementProps : {}),
                                ...(value5 && value10 !== null && !value10.open
                                  ? {
                                      [runtime.SHEET_TREE_CLOSING_ATTRIBUTE]:
                                        "",
                                    }
                                  : {}),
                                ...(value5 && value26 && !value11.open
                                  ? {
                                      [runtime.SHEET_PEELING_ATTRIBUTE]: "",
                                    }
                                  : {}),
                                ...(value4
                                  ? getControlSizeAttributes("lg")
                                  : {}),
                                ref: value37,
                                ...input2(value4 ? state : props),
                                style: value39,
                                className: (0, runtime.cn)(
                                  contextMenuPopupClasses,
                                  value9.held?.popupClassName,
                                  value4 && runtime.sheetPopupClasses,
                                  value4 &&
                                    (value5
                                      ? "bg-transparent shadow-none [&[data-ending-style]:not([data-cds-sheet-tree-closing])]:translate-x-full rtl:[&[data-ending-style]:not([data-cds-sheet-tree-closing])]:-translate-x-full [&[data-ending-style][data-cds-sheet-peeling]]:translate-x-full rtl:[&[data-ending-style][data-cds-sheet-peeling]]:-translate-x-full [&[data-ending-style][data-cds-sheet-tree-closing]]:translate-y-[calc(100%+1.5rem)]"
                                      : "data-[starting-style]:translate-y-[calc(100%+1.5rem)] data-[ending-style]:translate-y-[calc(100%+1.5rem)]"),
                                  value4 &&
                                    "origin-top [&[data-cds-sheet-covered]:not([data-starting-style]):not([data-ending-style])]:-translate-y-3 data-[cds-sheet-covered]:scale-[0.94] after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-backdrop after:opacity-0 after:transition-opacity after:duration-sheet motion-reduce:after:transition-none data-[cds-sheet-covered]:after:opacity-100",
                                  className,
                                ),
                                children: value4
                                  ? jsxMenuSheetPopup.jsxs(
                                      runtime.sheetParentContext.Provider,
                                      {
                                        value: memo2,
                                        children: [
                                          jsxMenuSheetPopup.jsx(
                                            runtime.SheetHandle,
                                            {
                                              drawPill: !value5,
                                            },
                                          ),
                                          jsxMenuSheetPopup.jsxs("div", {
                                            className:
                                              runtime.sheetDrillBodyClasses,
                                            children: [
                                              jsxMenuSheetPopup.jsxs(
                                                runtime.MenuScrollContent,
                                                {
                                                  header: header,
                                                  headerClassName:
                                                    runtime.sheetSeparatorClasses,
                                                  footer: footer,
                                                  fill: true,
                                                  children: [
                                                    children,
                                                    !value5 &&
                                                      jsxMenuSheetPopup.jsx(
                                                        MenuSheetCloseButton,
                                                        {},
                                                      ),
                                                  ],
                                                },
                                              ),
                                              jsxMenuSheetPopup.jsx(
                                                MenuSheetTitleBar,
                                                {
                                                  nested: value5,
                                                },
                                              ),
                                            ],
                                          }),
                                        ],
                                      },
                                    )
                                  : jsxMenuSheetPopup.jsx(
                                      runtime.MenuScrollContent,
                                      {
                                        header: header,
                                        footer: footer,
                                        maxVisibleItems: maxVisibleItems,
                                        children: children,
                                      },
                                    ),
                              }),
                          }),
                        },
                      ),
                    }),
                }),
              ],
            }),
          });
        },
      );
      MenuSheetPopup.displayName = "MenuSheetPopup";
    });
    initializePopoverSheetBody = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeClassNames)();
      (0, runtime.initializePresentationMode)();
      (0, runtime.initializeAdaptiveSheets)();
      (0, runtime.initializeSheetClassNames)();
      (0, runtime.initializeNpmDependency)();
      jsxPopoverSheetBody = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
    });
    initializeContextMenuSheetBackdrop = (0, runtime.initializeOnce)(
      () => {
        (0, runtime.initializeSheetClassNames)();
        (0, runtime.initializeNpmDependency)();
        jsxContextMenuSheetBackdrop = (0, runtime.toModuleNamespace)(
          (0, runtime.loadJsxNamespace)(),
          1,
        );
      },
    );
    mobileSheetExports = {} as SheetImplementation;
    (0, runtime.defineLiveExports)(mobileSheetExports, {
      SheetPopupHost: () => runtime.SheetPopupHost,
      PopoverSheetContent: () => PopoverSheetBody,
      PopoverSheetBackdrop: () => PopoverSheetBackdrop,
      MenuSheetPopup: () => MenuSheetPopup,
      ComboboxSheetBackdrop: () => ContextMenuSheetBackdrop,
    });
    initializeMobileSheetExports = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeSheetPopupHost)();
      initializeMenuSheetPopup();
      initializePopoverSheetBody();
      initializeContextMenuSheetBackdrop();
    });
    loadedSheetImplementation = null;
    sheetImplementationFailed = false;
    sheetImplementationRequests = 0;
    sheetImplementationGeneration = 0;
    sheetImplementationPromise = null;
    getSheetImplementationSnapshot = () => loadedSheetImplementation;
    getSheetImplementationLoadedSnapshot = () =>
      loadedSheetImplementation !== null;
    getSheetImplementationFailedSnapshot = () =>
      sheetImplementationFailed;
    getNullSheetImplementationSnapshot = () => null;
    getFalseSheetImplementationSnapshot = () => false;
    initializeSheetImplementation = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeTransitionRunner)();
      reactSheetImplementation = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      sheetImplementationSubscribers = new Set();
    });
    initializePreloadSheets = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeMediaQueryStores)();
      initializeSheetImplementation();
      reactPreloadSheets = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
    });
    initializeCdsPlatform = (0, runtime.initializeOnce)(() => {
      desktopPlatformUserAgentPattern = /\bElectron\//i;
    });
    MAX_LINK_DEBUG_WARNINGS = 50;
    MAX_LINK_DEBUG_LENGTH = 120;
    linkWarningLimitReached = false;
    initializeLinkWarnings = (0, runtime.initializeOnce)(() => {
      reportedLinkWarnings = new Set();
    });
    initializeHrefWhitespace = (0, runtime.initializeOnce)(() => {
      linkWhitespacePattern = /[\t\n\r]/g;
    });
    initializeLinkTargets = (0, runtime.initializeOnce)(() => {
      existingBrowsingContextNames = new Set(["_self", "_parent", "_top"]);
      unsafeLinkRelTokenPattern = /^no(?:opener|referrer)$/i;
    });
    HTTPS_RELATIVE_HREF_BASE = "https://cds-relative-href.invalid";
    HTTP_RELATIVE_HREF_BASE = "http://cds-relative-href.invalid";
    initializeCdsLink = (0, runtime.initializeOnce)(() => {
      initializeLinkWarnings();
      initializeHrefWhitespace();
      initializeLinkTargets();
      reactCdsLink = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      cdsRouterContext = reactCdsLink.createContext<CdsRouter | undefined>(undefined);
      forbiddenHrefControlCharacterPattern = /[\x00-\x1f\x7f-\x9f]/;
      leadingHrefWhitespacePattern = /^\s/;
      networkPathHrefPattern = /^[/\\]{2}/;
      rootRelativeHrefPattern = /^[/\\](?![/\\])/;
      unrootedHrefPattern = /^[^/\\]/;
      relativePathDotSegmentPattern = /\/(?:\.|%2e){1,2}(?:\/|$)/i;
      dotSegmentPattern = /^(?:\.|%2e){1,2}$/i;
      encodedOrBackslashPathPattern = /\\|%2e/i;
      // CucCut: the Claude app schemes (claude, claude-cli, claude-nest) are not link targets here.
      allowedHrefSchemePattern = /^(?:https?|mailto|tel|slack|blob):/i;
      androidIntentHrefPattern = /^intent:/i;
      editorHrefSchemePattern = /^(?:vscode|cursor):/i;
      allowedEditorHrefPattern = /^vscode:\/\/settings\/[A-Za-z0-9][A-Za-z0-9_.-]*$/;
      allowedIntentPropertyNames = new Set([
        "scheme",
        "package",
        "S.browser_fallback_url",
      ]);
      absoluteHrefPattern = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;
      // CucCut: no first-party web domains or Android apps; every external link is treated as "other".
      trustedFirstPartyDomains = [];
      trustedAndroidIntentPackages = new Set();
      linkEventPropNames = [
        "onClick",
        "onPointerEnter",
        "onPointerLeave",
        "onPointerDown",
        "onFocus",
        "onBlur",
      ];
      linkPrefetchEventKinds = {
        onPointerEnter: true,
        onPointerLeave: false,
        onPointerDown: true,
        onFocus: true,
        onBlur: false,
      };
      linkPrefetchEventNames = Object.keys(linkPrefetchEventKinds) as LinkEventName[];
    });
    subscribePlatformNoop = () => () => {};
    getWebPlatformSnapshot = () => "web";
    getCoarsePointerServerSnapshot = () => false;
    subscribeRootCoarsePointer = (input: () => void) => {
      let value = (0, runtime.subscribeCoarsePointer)(input);
      queueMicrotask(input);
      return value;
    };
    hasMigratedHtmlFontSizing = false;
    DARK_COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";
    normalizeColorMode = (input: string | null | undefined) =>
      input === "dark" || input === "light"
        ? input
        : input === "auto" || input === "system"
          ? "system"
          : undefined;
    initializeCdsRoot = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeAccentColors)();
      (0, runtime.initializeCoarsePointerStores)();
      (0, runtime.initializeSafeObservers)();
      (0, runtime.initializeDocumentFont)();
      (0, runtime.initializeFeatureFlags)();
      (0, runtime.initializeInputDismissalTracking)();
      initializePreloadSheets();
      (0, runtime.initializeIsomorphicLayoutEffect)();
      (0, runtime.initializeExperimentalTheme)();
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeTranslations)();
      initializeCdsPlatform();
      initializeCdsLink();
      (0, runtime.initializeNpmDependency)();
      (0, runtime.initializeNpmDependency)();
      reactCdsRoot = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxCdsRoot = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      densitySizeIndices = {
        compact: 2,
        comfortable: 4,
      };
      controlSizeOffsets = {
        xs: -2,
        sm: -1,
        base: 0,
        lg: 1,
      };
      densityContext = reactCdsRoot.createContext<CdsDensity>("comfortable");
      portalDensityContext = densityContext;
      colorModeStoreContext = reactCdsRoot.createContext<ColorModeStore | undefined>(undefined);
      defaultColorModeStore = {
        setElement: () => {
          return;
        },
        subscribe: () => () => {
          return;
        },
        getSnapshot: () => {
          return;
        },
        getServerSnapshot: () => {
          return;
        },
        getAttrSnapshot: () => {
          return;
        },
        getServerAttrSnapshot: () => {
          return;
        },
        getSettingSnapshot: () => {
          return;
        },
        getServerSettingSnapshot: () => {
          return;
        },
      };
      platformContext = reactCdsRoot.createContext<CdsPlatform | undefined>(undefined);
      fontContext = reactCdsRoot.createContext<string | undefined>(undefined);
      monospaceFontContext = reactCdsRoot.createContext<string | null | undefined>(undefined);
      pageBackgroundContext = reactCdsRoot.createContext<string | undefined>(undefined);
      naturalImageTilesContext = reactCdsRoot.createContext<boolean | undefined>(undefined);
      densityOverrideContext = reactCdsRoot.createContext<CdsDensity | undefined>(undefined);
      surfaceBackgroundContext = reactCdsRoot.createContext<string | undefined>(undefined);
      localeContext = reactCdsRoot.createContext<string | undefined>(undefined);
      rootElementContext = reactCdsRoot.createContext<HTMLElement | undefined>(undefined);
      rootPortalContainerContext = reactCdsRoot.createContext<HTMLElement | undefined>(undefined);
      isPortalRootContext = reactCdsRoot.createContext<boolean>(false);
      opaqueTintOverrides = Object.fromEntries(
        runtime.accentColorNames.map(
          (input: string): [string, string] => [
            `--cds-bg-tint-${input}`,
            `var(--cds-bg-tint-${input}-opaque)`,
          ],
        ),
      );
      surfaceTokenNames = new Set([
        "surface-0",
        "surface-1",
        "surface-2",
        "surface-3",
        "fill-accent",
      ]);
    });
  };
}
