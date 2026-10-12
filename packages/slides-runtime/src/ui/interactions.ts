/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type {
  Context,
  ContextType,
  CSSProperties,
  ElementType,
  ForwardedRef,
  ForwardRefExoticComponent,
  HTMLAttributes,
  DragEvent as ReactDragEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  ReactNode,
  Ref,
  RefAttributes,
  RefCallback,
  RefObject,
} from "react";
import type { ClassValue } from "clsx";
import type {
  ExternalStore,
  SafeMutationObserver,
  ThemeTokenGroup,
  ThemeTokenKeys,
} from "./foundation";

/** Values substituted into `{name}` placeholders of a translation string. */
export type TranslationValues = Record<string, string | number>;
/** Looks up a translated label; returns nothing when the key is not translated. */
export type TranslateLabel = (
  key: string,
  fallback: string,
  values?: TranslationValues,
) => string | null | undefined;
export interface SheetHandleProps {
  drawPill?: boolean;
}
export interface SheetTitleBarProps {
  leading?: ReactNode;
  title?: ReactNode;
}
export interface SheetBodyProps {
  className?: string;
  children?: ReactNode;
}
/** Callbacks the sheet frame offers to its content while text is being edited. */
export interface SheetTextEntryFocusOptions {
  setDetent?: (detent: string) => void;
  holdTextEntryFocus?: () => (() => void) | null;
}
export interface SheetDismissOptions {
  open?: boolean;
  dismiss?: () => void;
  treeId?: string;
}
export interface SheetUncoverGate {
  ready: () => boolean;
  dispose: () => void;
}
export interface SheetScrollMeasurement {
  visible: number;
  overflowContent: number;
}
/** Heights recorded when the sheet content was pinned. */
export interface SheetMeasurement {
  contentHeight: number;
  written: number;
  chromeAtPin: number;
  chromeSettled: number;
  grows: boolean;
}
interface DetachedSheetElement {
  node: HTMLElement;
  half: boolean;
}
type SheetState = ReturnType<RuntimeBindings["useSheetState"]>;
type SheetFrame = ContextType<RuntimeBindings["sheetFrameContext"]>;
type SheetCover = ContextType<RuntimeBindings["sheetCoverContext"]>;
/** Stacking info a sheet publishes to the sheets opened above it (`sheetParentContext`). */
export interface SheetStack {
  depth: SheetState["depth"];
  frameHeight: ReturnType<RuntimeBindings["getSheetFrameHeight"]>;
  cover: SheetCover;
}
/** What a popup renders with when it can be presented as a bottom sheet. */
export interface SheetPopupHostState {
  sheet: SheetState["sheet"];
  concealed: boolean;
  chrome: RuntimeBindings["SheetChrome"];
  ref: (element: HTMLElement | null) => void;
  style: ReturnType<RuntimeBindings["getSheetPopupStyle"]> | undefined;
  positionerStyle: ReturnType<RuntimeBindings["getSheetPositionerStyle"]> | undefined;
  attrs: Record<string, unknown>;
  frame: SheetFrame;
  state: SheetState;
  stack: SheetStack | null;
}
export interface SheetPopupHostProps {
  children: (host: SheetPopupHostState) => ReactNode;
}

/** Kinds of overlay that stack inside a layer band; each has its own z-index offset. */
export type OverlayLayerKind = "modal" | "tooltip" | "contextmenu" | "popover" | "menu" | "combobox" | "coachmark";
/** Inline style that may also carry CSS custom properties. */
export type CssVariablesStyle = CSSProperties & { [name: `--${string}`]: string | number | undefined };
export interface OverlayLayerStyle {
  zIndex: number;
  "--cds-layer-base": number;
}
export interface OverlayLayer {
  base: number;
  style: OverlayLayerStyle;
  portalProps: {
    className: string;
    style: { "--cds-portal-z": number; "--cds-layer-base": number };
  };
}
export interface CdsLayerRenderProps {
  "data-cds"?: string;
  style?: CssVariablesStyle;
}
export interface CdsLayerProps {
  children?: ReactNode;
  base?: number;
  render?: ReactElement<CdsLayerRenderProps>;
}
export interface CdsLayerVarBridgeProps {
  children?: ReactNode;
  className?: string;
}
/** Ref callback produced by merging several refs; the returned function detaches them. */
export type MergedRefCallback<Instance> = (instance: Instance | null) => (() => void) | undefined;
/** Theme descriptor handed to `experimental.theme`; only its id is read here. */
export interface ExperimentalThemeDescriptor {
  id: string;
}
export interface ExperimentalThemeConfiguration {
  theme: ExperimentalThemeDescriptor;
  /** Turns the descriptor into token values for `useTokenValue`. */
  resolve?: (theme: ExperimentalThemeDescriptor) => unknown;
  /** Puts the theme on the page and returns the function that removes it again. */
  apply?: (theme: ExperimentalThemeDescriptor, options: { target: HTMLElement }) => (() => void) | undefined;
}
export interface ResolvedThemeSnapshot {
  theme: ExperimentalThemeDescriptor;
  resolved: unknown;
}
/** External store (for useSyncExternalStore) that holds the resolved experimental theme. */
export interface ThemeStore {
  subscribe: (listener: () => void) => () => boolean;
  getSnapshot: () => ResolvedThemeSnapshot | undefined;
  getServerSnapshot: () => ResolvedThemeSnapshot | undefined;
  getId: () => string | undefined;
  set: (configuration: ExperimentalThemeConfiguration | undefined) => void;
}
export type ThemeCleanupRef = RefObject<(() => void) | undefined>;
export interface CloseOnActivityHideProviderProps {
  actionsRef: RefObject<{ close?: () => void } | null | undefined>;
  children?: ReactNode;
}
interface ModalCatcherDragSession {
  event: Event;
  restoreAll: () => void;
}
export interface SkeletonShownSnapshot {
  shown: boolean;
}
/** Remembers whether a skeleton group has already been shown. */
export interface SkeletonShownStore {
  getSnapshot: () => SkeletonShownSnapshot;
  subscribe: (listener: () => void) => () => void;
  markShown: () => void;
  reset: () => void;
}
export interface ResetSkeletonContextsProps {
  children?: ReactNode;
}
export interface PortalRootProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Page background token (e.g. `surface-2`) or a CSS background. */
  surface?: string;
  density?: string;
  /** Adds a companion element that catches pointer events behind a modal. */
  companionModalCatcher?: boolean;
  closeOnActivityHide?: boolean;
}

export type IconSizeName = "xs" | "sm" | "md" | "lg" | "xl" | "xxl";
/** `auto*` sizes follow the density-driven icon size (one step smaller or larger for `-sm`/`-lg`). */
export type IconSizeSetting = IconSizeName | "auto" | "auto-sm" | "auto-lg";
export type IconStrokeWeights =
  | { regular: number }
  | { regular: number; strong: number };
export interface IconSizeMetric {
  px: number;
  master: "small" | "base";
  stroke: IconStrokeWeights;
}
export interface IconFontStyle {
  fontSize: string;
  fontWeight: number;
}
export interface IconSizeStyles {
  regular: Readonly<IconFontStyle>;
  strong?: Readonly<IconFontStyle>;
}
/** Lower and upper variable-font weight axis values of one icon master. */
export interface IconMasterWeightBounds {
  lo: number;
  hi: number;
}
/** Shape of the icon font manifest: code points, animation tables and per-master weight bounds. */
export interface IconFontManifest {
  icons: Record<string, number>;
  secondary?: Record<string, number>;
  next?: number;
  wght: Record<string, IconMasterWeightBounds>;
  anim?: string[];
  animLoop?: string[];
  animDur?: Record<string, number>;
  animDurOut?: Record<string, number>;
  animEase?: Record<string, string>;
}
export interface CustomIconPath {
  d: string;
  strokeWidth: number;
}
export interface CustomIconDefinition {
  viewBox: number | string;
  paths: (string | CustomIconPath)[];
}
export interface IconGlyphReference {
  name: string;
}
interface IconCommonProps extends HTMLAttributes<HTMLElement> {
  size?: IconSizeSetting;
  alt?: string;
  animated?: boolean;
}
/** An inline SVG icon drawn from `customIcon`. */
export interface CustomIconProps extends IconCommonProps {
  customIcon: CustomIconDefinition;
  name?: string;
  icon?: IconGlyphReference;
}
interface GlyphIconCommonProps extends IconCommonProps {
  customIcon?: undefined;
  bold?: boolean;
  /** Pixel size that overrides the named size. */
  customSize?: number;
}
/** An icon-font glyph picked by `name` or by an icon reference. */
export type GlyphIconProps =
  | (GlyphIconCommonProps & { name: string; icon?: undefined })
  | (GlyphIconCommonProps & { icon: IconGlyphReference; name?: undefined });
export type IconProps = CustomIconProps | GlyphIconProps;
export interface IconSlotProps {
  /** An icon name or an already rendered node. */
  icon?: ReactNode;
}
/** An element, or a ref to one, that a popup is rendered inside. */
export type ContainerElement = Element | DocumentFragment;
export type ContainerSource =
  | ContainerElement
  | { current: ContainerElement | null; nodeType?: undefined };
export type CollisionPadding =
  | number
  | { top?: number; right?: number; bottom?: number; left?: number };
export interface CollisionPaddingContextValue {
  collisionPadding: CollisionPadding | undefined;
}
export interface CollisionPaddingProviderProps {
  override?: CollisionPadding;
  container?: ContainerSource | null;
  provideInherit?: boolean;
  children: (padding: CollisionPadding | undefined) => ReactNode;
}
export type ElevationName = "panel" | "popover";
export type SurfaceName = "surface-2" | "surface-3";
export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  left: number;
  right: number;
  bottom: number;
}
/** Floating-UI style virtual element that anchors a submenu to its trigger row. */
export interface MenuVirtualAnchor {
  readonly contextElement: HTMLElement | undefined;
  getBoundingClientRect: () => AnchorRect;
}
/** What a menu publishes to its descendants (items, submenu triggers, search field). */
export interface MenuTriggerContextValue {
  triggerRef: RefObject<HTMLElement | null>;
  setTriggerNode: (node: HTMLElement | null) => void;
  openRef: RefObject<boolean>;
  close: () => void;
  stashLabel: (label: ReactNode) => void;
}
export interface SubmenuState {
  label: ReactNode;
  open: boolean;
}
/** Object that identifies a root menu (an actions ref or a stable ref object). */
export type MenuRootIdentity = object;
export interface MenuScrollContentProps {
  header?: ReactNode;
  headerClassName?: string;
  footer?: ReactNode;
  maxVisibleItems?: number;
  fill?: boolean;
  children?: ReactNode;
}
/** The pieces of a context-menu open event the keyboard-focus logic inspects. */
export interface ContextMenuEventLike {
  type: string;
  button?: number;
  pointerType?: string;
}
export interface MenuOpenChangeDetails {
  isCanceled: boolean;
  event?: ContextMenuEventLike;
}
/** Resolves the element that owns a popup (for focus and dismissal trees). */
export type OverlayOwnerResolver = () => Element | null;

export type DirectionalClassGroups = Record<string, [Record<string, readonly string[]>]>;
interface DisplayNamed {
  displayName?: string;
}
export interface SheetDismissButtonProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** Element type to render; defaults to a button. */
  as?: ElementType;
  onDismiss?: () => void;
  label?: string;
}
/** The pieces a bottom sheet is assembled from. */
export interface SheetChromeParts {
  Handle: (props: SheetHandleProps) => ReactElement;
  TitleBar: (props: SheetTitleBarProps) => ReactElement | null;
  DismissButton: ForwardRefExoticComponent<SheetDismissButtonProps & RefAttributes<HTMLElement>>;
  Body: (props: SheetBodyProps) => ReactElement;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactTranslations: ReactNamespace;
    reactSheetChrome: ReactNamespace;
    jsxSheetChrome: JsxNamespace;
    reactSheetMeasurement: ReactNamespace;
    reactSheetPopupHost: ReactNamespace;
    reactLayers: ReactNamespace;
    jsxLayers: JsxNamespace;
    reactMergedRefs: ReactNamespace;
    reactExperimentalTheme: ReactNamespace;
    reactActivityHide: ReactNamespace;
    jsxActivityHide: JsxNamespace;
    reactPointerDismissal: ReactNamespace;
    jsxPointerDismissal: JsxNamespace;
    reactSkeletonContexts: ReactNamespace;
    jsxSkeletonContexts: JsxNamespace;
    jsxPortalRoot: JsxNamespace;
    reactForUiInteractions: ReactNamespace;
    jsxIcons: JsxNamespace;
    reactCollisionPadding: ReactNamespace;
    jsxCollisionPadding: JsxNamespace;
    reactMenuContexts: ReactNamespace;
    jsxMenuScrollContent: JsxNamespace;
    reactKeyboardContextMenuFocus: ReactNamespace;
    skeletonElementContext: Context<"div" | "span">;
    menuTriggerContext: Context<MenuTriggerContextValue | null>;
    menuSheetLabelsContext: Context<{ sheetTitle?: string; backLabel?: string; closeLabel?: string }>;
    cn: (...classValues: ClassValue[]) => string;
    classMergeThemeKeys: ThemeTokenKeys;
    classMergeTypographyScale: readonly string[];
    classMergeTypographyWeights: readonly string[];
    getClassMergeThemeValues: (group: ThemeTokenGroup) => readonly string[];
    paddingTokenNames: readonly string[];
    marginTokenNames: readonly string[];
    gapTokenNames: readonly string[];
    createDirectionalClassGroups: (prefix: string, values: readonly string[]) => DirectionalClassGroups;
    typographyClassNames: readonly string[];
    typographyWeightClassNames: string[];
    mergeTailwindClasses: (classList: string) => string;
    initializeClassNames: () => void;
    interpolateTranslation: (template: string, values?: TranslationValues) => string;
    translateWithFallback: (translate: TranslateLabel | undefined, key: string, fallback: string, values?: TranslationValues) => string;
    useTranslation: (key: string, fallback: string, values?: TranslationValues) => string;
    translationContext: Context<TranslateLabel | undefined>;
    initializeTranslations: () => void;
    SheetHandle: (arg0: SheetHandleProps) => ReactElement;
    SheetTitleBar: (arg0: SheetTitleBarProps) => ReactElement | null;
    SheetBody: (arg0: SheetBodyProps) => ReactElement;
    SheetDismissButton: ForwardRefExoticComponent<SheetDismissButtonProps & RefAttributes<HTMLElement>>;
    SheetChrome: SheetChromeParts;
    initializeSheetChrome: () => void;
    getFiniteRunningAnimations: (element: Element) => Animation[];
    isFiniteRunningAnimation: (animation: Animation) => boolean;
    afterElementAnimations: (element: Element, onComplete: () => void) => () => void;
    initializeAnimationWait: () => void;
    useSheetTextEntryFocus: (element: HTMLElement | null, options?: SheetTextEntryFocusOptions | null) => void;
    useSheetPressedState: (element: HTMLElement | null) => void;
    isScrollContentReplacement: (records: MutationRecord[], hadOverflow: boolean) => boolean;
    measureNaturalSheetHeight: (element: HTMLElement) => number;
    createSheetUncoverGate: (element: HTMLElement, onReady: () => void) => SheetUncoverGate;
    afterCssTransitions: (input: Element, options: Window, context: () => void) => () => void;
    measureSheetScrollContent: (element: HTMLElement) => SheetScrollMeasurement;
    measureSheetControlOverflow: (sheetElement: HTMLElement, controlElement: Element | null) => number;
    useDismissSheetOnForeignFocus: (element: HTMLElement | null, options: SheetDismissOptions | null | undefined, context: boolean | undefined) => void;
    initializeSheetMeasurement: () => void;
    createPinnedSheetMeasurement: (element: HTMLElement, height: number, canGrow: boolean) => SheetMeasurement;
    useSheetHeightUntilVisible: (element: HTMLElement | null, onMeasure: (element: HTMLElement, height: number) => void) => void;
    useSheetPopupHost: () => SheetPopupHostState;
    SheetPopupHost: (arg0: SheetPopupHostProps) => ReactNode;
    initializeSheetPopupHost: () => void;
    checkLayerBase: (input: number, options: number) => void;
    CdsLayer: (arg0: CdsLayerProps) => ReactElement;
    warnInvalidLayerOffset: (source: string, layerOffset: number) => void;
    useDefaultOverlayLayer: (input: OverlayLayerKind) => OverlayLayer;
    useOverlayLayer: (kind: OverlayLayerKind, layerOffset?: number) => OverlayLayer;
    CdsLayerVarBridge: (arg0: CdsLayerVarBridgeProps) => ReactElement;
    LAYER_BAND_SIZE: number;
    TOAST_LAYER_BASE: number;
    layerBaseContext: Context<number>;
    overlayLayerOffsets: Record<OverlayLayerKind, number>;
    portalLayerClasses: string;
    initializeLayers: () => void;
    setReactRef: <Instance>(ref: Ref<Instance> | undefined, value: Instance | null) => void | (() => void);
    mergeRefs: <Instance>(...refs: (Ref<Instance> | undefined)[]) => MergedRefCallback<Instance>;
    useMergedRefs: <Instance>(firstRef?: Ref<Instance>, secondRef?: Ref<Instance>, thirdRef?: Ref<Instance>) => MergedRefCallback<Instance>;
    useStableMergedRef: <Instance>(firstRef: RefCallback<Instance>, secondRef: Ref<Instance> | undefined) => MergedRefCallback<Instance>;
    initializeMergedRefs: () => void;
    resolveExperimentalTheme: (configuration: ExperimentalThemeConfiguration) => unknown;
    createThemeStore: (configuration?: ExperimentalThemeConfiguration) => ThemeStore;
    useCdsThemeId: () => string | undefined;
    reportThemeErrorOnce: (message: string) => void;
    reportThemeApplicationError: (themeId: string, error: unknown) => void;
    disposeThemeApplication: (cleanupRef: ThemeCleanupRef) => void;
    useExperimentalThemeStore: (configuration: ExperimentalThemeConfiguration | undefined, targetRef: RefObject<HTMLElement | null>) => ThemeStore;
    createResolvedThemeSnapshot: (
    input?: ExperimentalThemeConfiguration | null,
    options?: ResolvedThemeSnapshot,
  ) => ResolvedThemeSnapshot | undefined;
    themeStoreContext: Context<ThemeStore | undefined>;
    defaultThemeStore: ThemeStore;
    reportedThemeErrors: Set<string>;
    initializeExperimentalTheme: () => void;
    getElementNamespace: (input: Element | null | undefined) => string | null | undefined;
    isHtmlElement: (input: Element | null | undefined) => input is HTMLElement;
    isSvgElement: (input: Element | null | undefined) => boolean;
    HTML_NAMESPACE: string;
    SVG_NAMESPACE_GE0: string;
    initializeElementNamespaces: () => void;
    isHiddenByInlineDisplay: (input: Element) => boolean;
    hasOpenChild: (input: Element) => boolean;
    CloseOnActivityHideProvider: (arg0: CloseOnActivityHideProviderProps) => ReactElement;
    useCloseOnActivityHideRef: (input: boolean) => RefObject<HTMLElement | null>;
    activityHideElementsContext: Context<Set<Element> | null>;
    initializeCloseOnActivityHide: () => void;
    getCompanionModalCatcher: (input: Element, options: EventTarget | null) => HTMLElement | null;
    shouldSuppressModalCatcherFocus: (input: Element, options: EventTarget | null) => boolean;
    handleModalCatcherPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
    handleModalCatcherMouseDown: (event: ReactMouseEvent<HTMLElement>) => void;
    handleModalCatcherDragStart: (event: ReactDragEvent<HTMLElement>) => void;
    modalCatcherDragSession: ModalCatcherDragSession | null;
    modalCatcherDragEndEvents: string[];
    initializeModalCatcher: () => void;
    pointerDismissalContext: Context<boolean>;
    initializePointerDismissal: () => void;
    ResetSkeletonContexts: (arg0: ResetSkeletonContextsProps) => ReactElement;
    skeletonActiveContext: Context<boolean>;
    skeletonGroupContext: Context<number | null>;
    skeletonShownStoreContext: Context<SkeletonShownStore | null>;
    initializeSkeletonContexts: () => void;
    PortalRoot: (arg0: PortalRootProps) => ReactElement;
    initializePortalRoot: () => void;
    rootFontSizeProbe: () => HTMLElement;
    measureRootRemScale: (element: Element) => number;
    readRootRemSize: () => number;
    rootRemSnapshot: () => number;
    serverRootRemSnapshot: () => number;
    subscribeRootRemSize: (listener: () => void) => () => void;
    useRootRemSize: () => number;
    REM_SCALE_VARIABLE: string;
    DEFAULT_ROOT_FONT_SIZE: number;
    ROOT_REM_PROBE_LENGTH_CSS: string;
    ROOT_REM_PROBE_STYLE: string;
    ROOT_FONT_PROBE_ATTRIBUTE: string;
    pixelsToScaledRem: (pixels: number) => string;
    rootRemProbeElement: HTMLElement | null;
    rootRemResizeObserver: ResizeObserver | null;
    cachedRootRemSize: number | null;
    rootRemSubscribers: Set<() => void>;
    initializeRemScale: () => void;
    iconFontManifest: IconFontManifest;
    iconCodepoints: IconFontManifest["icons"];
    secondaryIconCodepoints: IconFontManifest["secondary"];
    nextIconCodepoint: IconFontManifest["next"];
    iconMasterWeights: IconFontManifest["wght"];
    animatedIconNames: IconFontManifest["anim"];
    loopingIconNames: IconFontManifest["animLoop"];
    iconAnimationDurations: IconFontManifest["animDur"];
    iconAnimationExitDurations: IconFontManifest["animDurOut"];
    iconAnimationEasings: IconFontManifest["animEase"];
    iconManifest: IconFontManifest;
    initializeIconManifest: () => void;
    initializeIconAccessibility: () => void;
    resolveIconSize: (size: IconSizeSetting, densitySize: IconSizeName) => IconSizeName;
    useDensityIconSize: () => IconSizeName;
    useIconSize: (input?: IconSizeSetting) => IconSizeName;
    getClosestIconSize: (pixels: number) => IconSizeName;
    calculateIconFontWeight: (strokeWidth: number, masterSize: number, pixels: number) => number;
    validateIconAccessibility: (input: string | undefined, options: object) => void;
    getCustomIconFontStyle: (pixels: number, strokeWidth: number) => IconFontStyle;
    createIconSizeStyles: (size: IconSizeName) => Readonly<IconSizeStyles>;
    Icon: (input: IconProps) => ReactElement;
    isIconName: (input: unknown) => input is string;
    IconSlot: (arg0: IconSlotProps) => ReactElement;
    iconSizeMetrics: Record<IconSizeName, IconSizeMetric>;
    iconSizes: IconSizeName[];
    DEFAULT_ICON_SIZE: IconSizeName;
    primaryIconGlyphs: Record<string, number>;
    secondaryIconGlyphs: Record<string, number>;
    animatedIcons: Set<string>;
    loopingIcons: Set<string>;
    animationDurations: Record<string, number>;
    animationExitDurations: Record<string, number>;
    animationEasings: Record<string, string>;
    iconWeightBounds: Record<string, IconMasterWeightBounds>;
    MIN_ICON_FONT_WEIGHT: number;
    MAX_ICON_FONT_WEIGHT: number;
    customIconBaseStyle: { flexShrink: number; };
    iconFontStyles: Readonly<Record<IconSizeName, Readonly<IconSizeStyles>>>;
    initializeIcons: () => void;
    readDesktopTitlebarInset: (doc: Document) => number;
    getDesktopTitlebarStore: (doc: Document) => ExternalStore<number>;
    resolveContainerElement: (input: ContainerSource | null | undefined) => ContainerElement | null;
    useDesktopTitlebarInset: (input: ContainerSource | null | undefined) => number;
    useCollisionPadding: (input: CollisionPadding | undefined, options: ContainerSource | null | undefined) => CollisionPadding | undefined;
    CollisionPaddingProvider: (arg0: CollisionPaddingProviderProps) => ReactNode;
    DEFAULT_COLLISION_PADDING: number;
    desktopTitlebarStores: WeakMap<Document, ExternalStore<number>>;
    getZeroInsetSnapshot: () => number;
    subscribeInsetNoop: () => () => void;
    collisionPaddingContext: Context<CollisionPaddingContextValue | null>;
    initializeCollisionPadding: () => void;
    getSurfaceClasses: (input: ElevationName) => string;
    elevationSurfaceNames: Record<ElevationName, SurfaceName>;
    elevationShadowClasses: Record<ElevationName, string>;
    surfaceBackgroundClasses: Record<SurfaceName, string>;
    focusShadowByMode: { light: string; dark: string; };
    dangerFocusShadowByMode: { light: string; dark: string; };
    initializeSurfaces: () => void;
    createMenuVirtualAnchor: (input: Pick<MenuTriggerContextValue, "triggerRef">) => MenuVirtualAnchor;
    warnNestedMenuLayerOffset: () => void;
    warnNestedMenuInitialFocus: () => void;
    useStableObjectRef: <Value>() => { current: Value | null };
    defaultSubmenuState: SubmenuState;
    submenuStateContext: Context<SubmenuState>;
    FOCUSES_NOTHING_ATTRIBUTE: string;
    contextMenuContext: Context<boolean>;
    menuBarContext: Context<boolean>;
    MENU_ANCHOR_SELECTOR: string;
    menuRootIdentityContext: Context<MenuRootIdentity | null>;
    menuIsOpenContext: Context<MenuRootIdentity | null>;
    initializeMenuContexts: () => void;
    MenuScrollContent: (arg0: MenuScrollContentProps) => ReactElement;
    menuScrollClasses: string;
    menuBodyScrollClasses: string;
    menuHeaderClasses: string;
    menuFooterClasses: string;
    MENU_ITEM_HEIGHT_CSS: string;
    initializeMenuScrollContent: () => void;
    isKeyboardContextMenuEvent: (input: ContextMenuEventLike | undefined) => boolean;
    recordKeyboardContextMenuOpen: (input: MenuRootIdentity, options: boolean, context: MenuOpenChangeDetails) => void;
    useKeyboardContextMenuInitialFocus: (input: RefObject<HTMLElement | null>) => void;
    keyboardContextMenuRoots: WeakMap<MenuRootIdentity, boolean>;
    initializeKeyboardContextMenuFocus: () => void;
    TEXT_ENTRY_SELECTOR: string;
    initializeTextEntrySelector: () => void;
    blurWithSafeRelatedTarget: (input: HTMLElement) => void;
    initializeSafeBlur: () => void;
    registerOverlayOwner: (input: Element, options: OverlayOwnerResolver) => void;
    getOverlayOwnerAncestors: (input: Element | null) => Element[];
  }
}

export function installUiInteractions(runtime: RuntimeBindings): () => void {
  var classMergeThemeKeys: ThemeTokenKeys;
  var classMergeTypographyScale: readonly string[];
  var classMergeTypographyWeights: readonly string[];
  var getClassMergeThemeValues: (group: ThemeTokenGroup) => readonly string[];
  var paddingTokenNames: readonly string[];
  var marginTokenNames: readonly string[];
  var gapTokenNames: readonly string[];
  var createDirectionalClassGroups: (prefix: string, values: readonly string[]) => DirectionalClassGroups;
  var typographyClassNames: readonly string[];
  var typographyWeightClassNames: string[];
  var mergeTailwindClasses: (classList: string) => string;
  var initializeClassNames: () => void;
  var reactTranslations: ReactNamespace;
  var translationContext: Context<TranslateLabel | undefined>;
  var initializeTranslations: () => void;
  var reactSheetChrome: ReactNamespace;
  var jsxSheetChrome: JsxNamespace;
  var SheetDismissButton: ForwardRefExoticComponent<SheetDismissButtonProps & RefAttributes<HTMLElement>>;
  var SheetChrome: SheetChromeParts;
  var initializeSheetChrome: () => void;
  var initializeAnimationWait: () => void;
  var reactSheetMeasurement: ReactNamespace;
  var initializeSheetMeasurement: () => void;
  var reactSheetPopupHost: ReactNamespace;
  var initializeSheetPopupHost: () => void;
  var reactLayers: ReactNamespace;
  var jsxLayers: JsxNamespace;
  var LAYER_BAND_SIZE: number;
  var TOAST_LAYER_BASE: number;
  var layerBaseContext: Context<number>;
  var overlayLayerOffsets: Record<OverlayLayerKind, number>;
  var portalLayerClasses: string;
  var initializeLayers: () => void;
  var reactMergedRefs: ReactNamespace;
  var initializeMergedRefs: () => void;
  var reactExperimentalTheme: ReactNamespace;
  var createResolvedThemeSnapshot: (
    input?: ExperimentalThemeConfiguration | null,
    options?: ResolvedThemeSnapshot,
  ) => ResolvedThemeSnapshot | undefined;
  var themeStoreContext: Context<ThemeStore | undefined>;
  var defaultThemeStore: ThemeStore;
  var reportedThemeErrors: Set<string>;
  var initializeExperimentalTheme: () => void;
  var HTML_NAMESPACE: string;
  var SVG_NAMESPACE_GE0: string;
  var initializeElementNamespaces: () => void;
  var reactActivityHide: ReactNamespace;
  var jsxActivityHide: JsxNamespace;
  var activityHideElementsContext: Context<Set<Element> | null>;
  var initializeCloseOnActivityHide: () => void;
  var modalCatcherDragSession: ModalCatcherDragSession | null;
  var modalCatcherDragEndEvents: string[];
  var initializeModalCatcher: () => void;
  var reactPointerDismissal: ReactNamespace;
  var jsxPointerDismissal: JsxNamespace;
  var pointerDismissalContext: Context<boolean>;
  var initializePointerDismissal: () => void;
  var reactSkeletonContexts: ReactNamespace;
  var jsxSkeletonContexts: JsxNamespace;
  var skeletonActiveContext: Context<boolean>;
  var skeletonElementContext: Context<"div" | "span">;
  var skeletonGroupContext: Context<number | null>;
  var skeletonShownStoreContext: Context<SkeletonShownStore | null>;
  var initializeSkeletonContexts: () => void;
  var jsxPortalRoot: JsxNamespace;
  var initializePortalRoot: () => void;
  var reactForUiInteractions: ReactNamespace;
  var REM_SCALE_VARIABLE: string;
  var DEFAULT_ROOT_FONT_SIZE: number;
  var ROOT_REM_PROBE_LENGTH_CSS: string;
  var ROOT_REM_PROBE_STYLE: string;
  var ROOT_FONT_PROBE_ATTRIBUTE: string;
  var pixelsToScaledRem: (pixels: number) => string;
  var rootRemProbeElement: HTMLElement | null;
  var rootRemResizeObserver: ResizeObserver | null;
  var cachedRootRemSize: number | null;
  var rootRemSubscribers: Set<() => void>;
  var initializeRemScale: () => void;
  var iconFontManifest: IconFontManifest;
  var iconCodepoints: IconFontManifest["icons"];
  var secondaryIconCodepoints: IconFontManifest["secondary"];
  var nextIconCodepoint: IconFontManifest["next"];
  var iconMasterWeights: IconFontManifest["wght"];
  var animatedIconNames: IconFontManifest["anim"];
  var loopingIconNames: IconFontManifest["animLoop"];
  var iconAnimationDurations: IconFontManifest["animDur"];
  var iconAnimationExitDurations: IconFontManifest["animDurOut"];
  var iconAnimationEasings: IconFontManifest["animEase"];
  var iconManifest: IconFontManifest;
  var initializeIconManifest: () => void;
  var initializeIconAccessibility: () => void;
  var jsxIcons: JsxNamespace;
  var iconSizeMetrics: Record<IconSizeName, IconSizeMetric>;
  var iconSizes: IconSizeName[];
  var DEFAULT_ICON_SIZE: IconSizeName;
  var primaryIconGlyphs: Record<string, number>;
  var secondaryIconGlyphs: Record<string, number>;
  var animatedIcons: Set<string>;
  var loopingIcons: Set<string>;
  var animationDurations: Record<string, number>;
  var animationExitDurations: Record<string, number>;
  var animationEasings: Record<string, string>;
  var iconWeightBounds: Record<string, IconMasterWeightBounds>;
  var MIN_ICON_FONT_WEIGHT: number;
  var MAX_ICON_FONT_WEIGHT: number;
  var customIconBaseStyle: { flexShrink: number; };
  var iconFontStyles: Readonly<Record<IconSizeName, Readonly<IconSizeStyles>>>;
  var initializeIcons: () => void;
  var reactCollisionPadding: ReactNamespace;
  var jsxCollisionPadding: JsxNamespace;
  var DEFAULT_COLLISION_PADDING: number;
  var desktopTitlebarStores: WeakMap<Document, ExternalStore<number>>;
  var getZeroInsetSnapshot: () => number;
  var subscribeInsetNoop: () => () => void;
  var collisionPaddingContext: Context<CollisionPaddingContextValue | null>;
  var initializeCollisionPadding: () => void;
  var elevationSurfaceNames: Record<ElevationName, SurfaceName>;
  var elevationShadowClasses: Record<ElevationName, string>;
  var surfaceBackgroundClasses: Record<SurfaceName, string>;
  var focusShadowByMode: { light: string; dark: string; };
  var dangerFocusShadowByMode: { light: string; dark: string; };
  var initializeSurfaces: () => void;
  var reactMenuContexts: ReactNamespace;
  var menuTriggerContext: Context<MenuTriggerContextValue | null>;
  var defaultSubmenuState: SubmenuState;
  var submenuStateContext: Context<SubmenuState>;
  var FOCUSES_NOTHING_ATTRIBUTE: string;
  var contextMenuContext: Context<boolean>;
  var menuBarContext: Context<boolean>;
  var menuSheetLabelsContext: Context<{ sheetTitle?: string; backLabel?: string; closeLabel?: string }>;
  var MENU_ANCHOR_SELECTOR: string;
  var menuRootIdentityContext: Context<MenuRootIdentity | null>;
  var menuIsOpenContext: Context<MenuRootIdentity | null>;
  var initializeMenuContexts: () => void;
  var jsxMenuScrollContent: JsxNamespace;
  var menuScrollClasses: string;
  var menuBodyScrollClasses: string;
  var menuHeaderClasses: string;
  var menuFooterClasses: string;
  var MENU_ITEM_HEIGHT_CSS: string;
  var initializeMenuScrollContent: () => void;
  var reactKeyboardContextMenuFocus: ReactNamespace;
  var keyboardContextMenuRoots: WeakMap<MenuRootIdentity, boolean>;
  var initializeKeyboardContextMenuFocus: () => void;
  var TEXT_ENTRY_SELECTOR: string;
  var initializeTextEntrySelector: () => void;
  var initializeSafeBlur: () => void;
  function cn(...classValues: ClassValue[]): string {
    return mergeTailwindClasses((0, runtime.clsx)(classValues));
  }
  function interpolateTranslation(
    template: string,
    values?: TranslationValues,
  ): string {
    if (!values) {
      return template;
    }
    return template.replace(
      /\{(\w+)\}/g,
      (input: string, options: string): string =>
        options in values ? String(values[options]) : input,
    );
  }
  function translateWithFallback(
    translate: TranslateLabel | undefined,
    key: string,
    fallback: string,
    values?: TranslationValues,
  ): string {
    return (
      translate?.(key, fallback, values) ||
      interpolateTranslation(fallback, values)
    );
  }
  function useTranslation(
    key: string,
    fallback: string,
    values?: TranslationValues,
  ): string {
    return translateWithFallback(
      reactTranslations.useContext(translationContext),
      key,
      fallback,
      values,
    );
  }
  function SheetHandle({ drawPill = true }: SheetHandleProps): ReactElement {
    let dragHandlers = (0, runtime.useSheetDrag)();
    return jsxSheetChrome.jsx("div", {
      "aria-hidden": true,
      "data-cds-sheet-handle": "",
      ...dragHandlers,
      className:
        "flex min-h-8 shrink-0 touch-none items-center justify-center select-none",
      children: jsxSheetChrome.jsx("div", {
        className: (0, runtime.clsx)(
          "h-1 w-9 rounded-full bg-border",
          !drawPill && "opacity-0",
        ),
      }),
    });
  }
  function SheetTitleBar({ leading: leading, title: title }: SheetTitleBarProps): ReactElement | null {
    let dragHandlers = (0, runtime.useSheetDrag)(),
      hasLeading =
        leading !== undefined && leading !== null && leading !== false;
    if (
      !hasLeading &&
      !(
        title !== undefined &&
        title !== null &&
        title !== false &&
        title !== ""
      )
    ) {
      return null;
    }
    return jsxSheetChrome.jsxs("div", {
      ...dragHandlers,
      className:
        "order-first flex min-h-control shrink-0 touch-none items-center gap-xs px-1 pb-1 select-none",
      children: [
        hasLeading &&
          jsxSheetChrome.jsx("span", {
            className: "-me-2.5 shrink-0",
            children: leading,
          }),
        jsxSheetChrome.jsx("span", {
          "aria-hidden": true,
          className: (0, runtime.clsx)(
            "min-w-0 flex-1 truncate text-start text-heading font-semibold text-primary",
            !hasLeading && "ps-2.5",
          ),
          children: title,
        }),
      ],
    });
  }
  function SheetBody({
    className: className,
    children: children,
  }: SheetBodyProps): ReactElement {
    return jsxSheetChrome.jsx("div", {
      className: cn("flex min-h-0 flex-auto flex-col", className),
      children: children,
    });
  }
  function getFiniteRunningAnimations(element: Element): Animation[] {
    if (typeof element.getAnimations !== "function") {
      return [];
    }
    return element.getAnimations().filter(isFiniteRunningAnimation);
  }
  function isFiniteRunningAnimation(animation: Animation): boolean {
    if (
      animation.playState !== "running" ||
      animation.effect?.getTiming().iterations === 1 / 0
    ) {
      return false;
    }
    let timeline = animation.timeline;
    return !(
      typeof timeline === "object" &&
      timeline !== null &&
      "source" in timeline
    );
  }
  function afterElementAnimations(
    element: Element,
    onComplete: () => void,
  ): () => void {
    let active = true,
      animationFrame = requestAnimationFrame(() => {
        animationFrame = requestAnimationFrame(() => {
          let value = getFiniteRunningAnimations(element);
          if (value.length === 0) {
            onComplete();
            return;
          }
          Promise.allSettled(
            value.map((input) => input.finished),
          ).then(() => {
            if (active) {
              onComplete();
            }
          });
        });
      });
    return () => {
      active = false;
      cancelAnimationFrame(animationFrame);
    };
  }
  function useSheetTextEntryFocus(
    element: HTMLElement | null,
    options?: SheetTextEntryFocusOptions | null,
  ): void {
    let value = options?.setDetent,
      value2 = options?.holdTextEntryFocus;
    reactSheetMeasurement.useEffect(() => {
      if (element === null || value === undefined || value2 === undefined) {
        return;
      }
      let value3: (() => void) | null = null,
        callback = () => {
          if (value3 === null) {
            value3 = value2();
          }
        },
        callback2 = () => {
          value3?.();
          value3 = null;
        },
        index = 0,
        callback3 = (input: EventTarget | null): boolean => {
          if (!(input instanceof Element)) {
            return false;
          }
          if ((0, runtime.isEditableElement)(input)) {
            return true;
          }
          let ancestor = input.closest(
            '[data-cds="TextInput"], label',
          );
          if (ancestor === null) {
            return false;
          }
          let value4 =
            ancestor instanceof HTMLLabelElement ? ancestor.control : null;
          return (
            (0, runtime.isEditableElement)(value4) ||
            ancestor.querySelector(
              'input:not([type=button],[type=checkbox],[type=radio],[type=range],[type=submit],[type=reset],[type=color],[type=file],[type=image],[type=hidden],[readonly]), textarea:not([readonly]), [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]',
            ) !== null
          );
        },
        callback4 = (event: Event): void => {
          if (callback3(event.target)) {
            index = event.timeStamp || Date.now();
          }
        },
        callback5 = (event: Event): void => {
          if ((0, runtime.isEditableElement)(event.target)) {
            callback();
            if (index > 0 && (event.timeStamp || Date.now()) - index < 1000) {
              index = 0;
              value("tall");
            }
          }
        },
        callback6 = (event: Event): void => {
          if (index > 0 && callback3(event.target)) {
            index = 0;
            value("tall");
          }
        },
        callback7 = (event: Event): void => {
          if ((0, runtime.isEditableElement)(event.target)) {
            callback2();
          }
        };
      element.addEventListener("pointerdown", callback4);
      element.addEventListener("focusin", callback5);
      element.addEventListener("focusout", callback7);
      element.addEventListener("click", callback6);
      if (
        element.contains(element.ownerDocument.activeElement) &&
        (0, runtime.isEditableElement)(element.ownerDocument.activeElement)
      ) {
        callback();
      }
      return () => {
        element.removeEventListener("pointerdown", callback4);
        element.removeEventListener("focusin", callback5);
        element.removeEventListener("focusout", callback7);
        element.removeEventListener("click", callback6);
        callback2();
      };
    }, [element, value, value2]);
  }
  function useSheetPressedState(element: HTMLElement | null): void {
    reactSheetMeasurement.useEffect(() => {
      if (element === null) {
        return;
      }
      let ownerDocument = element.ownerDocument,
        value: Element | null = null,
        callback = () => {
          element.removeAttribute(runtime.SHEET_PRESSED_ATTRIBUTE);
          value?.removeAttribute(runtime.SHEET_CONTROL_HELD_ATTRIBUTE);
          value = null;
          ownerDocument.removeEventListener("click", callback, true);
          ownerDocument.removeEventListener("pointercancel", callback, true);
          ownerDocument.removeEventListener("keydown", callback, true);
        },
        callback2 = () => {
          ownerDocument.addEventListener("click", callback, true);
          ownerDocument.addEventListener("pointercancel", callback, true);
          ownerDocument.addEventListener("keydown", callback, true);
          element.setAttribute(runtime.SHEET_PRESSED_ATTRIBUTE, "");
          let element2 = element.querySelector(
            "[data-cds-sheet-control]",
          );
          if (element2?.matches(":focus-visible, [data-highlighted]")) {
            value = element2;
            element2.setAttribute(runtime.SHEET_CONTROL_HELD_ATTRIBUTE, "");
          }
        };
      element.addEventListener("pointerdown", callback2, true);
      return () => {
        element.removeEventListener("pointerdown", callback2, true);
        callback();
      };
    }, [element]);
  }
  function isScrollContentReplacement(
    records: MutationRecord[],
    hadOverflow: boolean,
  ): boolean {
    if (!hadOverflow) {
      return false;
    }
    let scrollSelector = `[${runtime.SHEET_SCROLL_ATTRIBUTE}]`,
      addedCount = 0,
      removedCount = 0;
    for (let value of records) {
      let target = value.target,
        value2 =
          target.nodeType === Node.ELEMENT_NODE ? (target as Element) : target.parentElement;
      if (value2 === null || value2.closest(scrollSelector) === null) {
        return false;
      }
      addedCount += value.addedNodes.length;
      removedCount += value.removedNodes.length;
    }
    return addedCount > 0 && removedCount > 0 && removedCount <= addedCount;
  }
  function measureNaturalSheetHeight(element: HTMLElement): number {
    let renderedHeight = element.getBoundingClientRect().height,
      scrollElements = Array.from(
        element.querySelectorAll<HTMLElement>(`[${runtime.SHEET_SCROLL_ATTRIBUTE}]`),
      );
    if (scrollElements.length === 0) {
      return renderedHeight;
    }
    let naturalHeight = renderedHeight;
    for (let value of scrollElements) {
      let firstElementChild = value.firstElementChild;
      while (
        firstElementChild !== null &&
        firstElementChild.getClientRects().length === 0
      )
        firstElementChild = firstElementChild.nextElementSibling;
      let lastElementChild = value.lastElementChild;
      while (
        lastElementChild !== null &&
        lastElementChild.getClientRects().length === 0
      )
        lastElementChild = lastElementChild.previousElementSibling;
      let value2 =
          element.ownerDocument.defaultView?.getComputedStyle(value),
        value3 =
          parseFloat(value2?.paddingTop ?? "0") +
          parseFloat(value2?.paddingBottom ?? "0"),
        value4 =
          firstElementChild !== null && lastElementChild !== null
            ? lastElementChild.getBoundingClientRect().bottom -
              firstElementChild.getBoundingClientRect().top +
              value3
            : value3;
      naturalHeight += value4 - value.clientHeight;
    }
    return Math.max(0, naturalHeight);
  }
  function createSheetUncoverGate(
    element: HTMLElement,
    onReady: () => void,
  ): SheetUncoverGate {
    let windowObject = element.ownerDocument.defaultView;
    if (
      windowObject === null ||
      typeof windowObject.MutationObserver === "undefined"
    ) {
      return {
        ready: () => true,
        dispose: () => {
          return;
        },
      };
    }
    let pending = false,
      cancelWait: (() => void) | null = null,
      flush = () => {
        cancelWait = null;
        if (pending) {
          pending = false;
          onReady();
        }
      },
      observer = new windowObject.MutationObserver(() => {
        cancelWait?.();
        if (element.hasAttribute("data-cds-sheet-covered")) {
          cancelWait = null;
          return;
        }
        cancelWait =
          typeof element.getAnimations === "function"
            ? afterElementAnimations(element, flush)
            : afterCssTransitions(element, windowObject, flush);
      });
    observer.observe(element, {
      attributes: true,
      attributeFilter: [runtime.SHEET_COVERED_ATTRIBUTE],
    });
    return {
      ready: () => {
        if (
          element.hasAttribute("data-cds-sheet-covered") ||
          cancelWait !== null
        ) {
          pending = true;
          return false;
        }
        return true;
      },
      dispose: () => {
        observer.disconnect();
        cancelWait?.();
        cancelWait = null;
      },
    };
  }
  function afterCssTransitions(
    input: Element,
    options: Window,
    context: () => void,
  ): () => void {
    let style = options.getComputedStyle(input),
      callback = (input2: string): number[] =>
        input2.split(",").map((input3: string): number => {
          let value4 = parseFloat(input3);
          if (!Number.isFinite(value4)) {
            return 0;
          }
          if (input3.trim().endsWith("ms")) {
            return value4;
          } else {
            return value4 * 1000;
          }
        }),
      value = callback(style.transitionDelay ?? ""),
      value2 = Math.max(
        ...callback(style.transitionDuration ?? "").map(
          (input2: number, options2: number): number =>
            input2 + (value[options2 % value.length] ?? 0),
        ),
      ),
      value3 = options.setTimeout(context, value2 + 34);
    return () => options.clearTimeout(value3);
  }
  function measureSheetScrollContent(element: HTMLElement): SheetScrollMeasurement {
    let visible = 0,
      overflowContent = 0;
    for (let value of Array.from(
      element.querySelectorAll<HTMLElement>(`[${runtime.SHEET_SCROLL_ATTRIBUTE}]`),
    ))
      if (
        ((visible += value.clientHeight),
        value.scrollHeight > value.clientHeight + 1)
      ) {
        overflowContent += value.scrollHeight;
      }
    return {
      visible: visible,
      overflowContent: overflowContent,
    };
  }
  function measureSheetControlOverflow(
    sheetElement: HTMLElement,
    controlElement: Element | null,
  ): number {
    let windowObject = sheetElement.ownerDocument.defaultView;
    if (
      windowObject === null ||
      controlElement === null ||
      !sheetElement.contains(controlElement)
    ) {
      return 0;
    }
    let position =
      windowObject.getComputedStyle(controlElement).position;
    if (position === "absolute" || position === "fixed") {
      return 0;
    }
    let overflow = 0;
    for (let value = controlElement; value !== sheetElement; ) {
      let parentElement = value.parentElement;
      if (parentElement === null) {
        break;
      }
      let style = windowObject.getComputedStyle(parentElement),
        value2 =
          parentElement.getBoundingClientRect().bottom -
          parseFloat(style.paddingBottom) -
          parseFloat(style.borderBottomWidth),
        value3 = parseFloat(
          windowObject.getComputedStyle(value).marginBottom,
        );
      overflow += Math.max(
        0,
        value.getBoundingClientRect().bottom +
          Math.max(0, value3) -
          value2 +
          parentElement.scrollTop,
      );
      value = parentElement;
    }
    return overflow;
  }
  function useDismissSheetOnForeignFocus(
    element: HTMLElement | null,
    options: SheetDismissOptions | null | undefined,
    context: boolean | undefined,
  ): void {
    let ref = reactSheetMeasurement.useRef(context);
    reactSheetMeasurement.useEffect(() => {
      ref.current = context;
    }, [context]);
    let value = options?.open ?? false,
      value2 = options?.dismiss,
      value3 = options?.treeId;
    reactSheetMeasurement.useEffect(() => {
      if (
        element === null ||
        !value ||
        value2 === undefined ||
        value3 === undefined
      ) {
        return;
      }
      let ownerDocument = element.ownerDocument,
        defaultView = ownerDocument.defaultView,
        index = 0,
        callback = () => {
          if (index !== 0 || defaultView === null) {
            return;
          }
          index = defaultView.requestAnimationFrame(() => {
            index = 0;
            let activeElement = ownerDocument.activeElement;
            if (
              ref.current ||
              activeElement === null ||
              activeElement === ownerDocument.body ||
              element.contains(activeElement) ||
              activeElement.closest(
                `[data-sheet-tree="${CSS.escape(value3)}"]`,
              ) !== null ||
              activeElement.closest(
                '[aria-modal="true"], [data-cds="Dialog"]',
              ) === null
            ) {
              return;
            }
            value2();
          });
        };
      element.addEventListener("focusout", callback);
      return () => {
        element.removeEventListener("focusout", callback);
        if (index !== 0) {
          defaultView?.cancelAnimationFrame(index);
        }
      };
    }, [element, value, value2, value3]);
  }
  function createPinnedSheetMeasurement(
    element: HTMLElement,
    height: number,
    canGrow: boolean,
  ): SheetMeasurement {
    let roundedHeight = Math.round(height),
      chromeHeight =
        height - measureSheetScrollContent(element).visible;
    return {
      contentHeight: roundedHeight,
      written: roundedHeight,
      chromeAtPin: chromeHeight,
      chromeSettled: chromeHeight,
      grows: canGrow,
    };
  }
  function useSheetHeightUntilVisible(
    element: HTMLElement | null,
    onMeasure: (element: HTMLElement, height: number) => void,
  ): void {
    reactSheetPopupHost.useEffect(() => {
      let value = (0, runtime.getResizeObserverConstructor)(element);
      if (element === null || value === undefined) {
        return;
      }
      let value2 = new value(() => {
        let height = element.getBoundingClientRect().height;
        if (height > 0) {
          value2.disconnect();
          onMeasure(element, height);
        }
      });
      value2.observe(element);
      return () => value2.disconnect();
    }, [element, onMeasure]);
  }
  function useSheetPopupHost(): SheetPopupHostState {
    let sheetState = (0, runtime.useSheetState)(),
      [halfHeightFloor, setHalfHeightFloor] =
        reactSheetPopupHost.useState(false),
      halfHeightFloorRef = reactSheetPopupHost.useRef(false),
      measurementRef = reactSheetPopupHost.useRef<SheetMeasurement | null>(null),
      pinnedElementRef = reactSheetPopupHost.useRef<HTMLElement | null>(null),
      detachedElementRef = reactSheetPopupHost.useRef<DetachedSheetElement | null>(null),
      updateHalfHeightFloor = reactSheetPopupHost.useCallback(
        (input: boolean): void => {
          halfHeightFloorRef.current = input;
          setHalfHeightFloor(input);
        },
        [],
      ),
      [element, setElement] = reactSheetPopupHost.useState<HTMLElement | null>(null),
      { sheet: sheet } = sheetState,
      frame = reactSheetPopupHost.useContext(
        runtime.sheetFrameContext,
      ),
      parentSheet = reactSheetPopupHost.useContext<SheetStack | null>(
        runtime.sheetParentContext,
      ),
      elementRef = reactSheetPopupHost.useRef<HTMLElement | null>(null),
      pinHeight = frame?.pinHeight,
      measureAndPin = reactSheetPopupHost.useCallback(
        (input: HTMLElement, options: number): void => {
          let value = (0, runtime.sheetContentCanGrow)(input);
          pinHeight?.(options, value);
          pinnedElementRef.current = input;
          measurementRef.current = createPinnedSheetMeasurement(
            input,
            options,
            value,
          );
        },
        [pinHeight],
      ),
      attachElement = reactSheetPopupHost.useCallback(
        (input: HTMLElement | null): void => {
          let current = detachedElementRef.current;
          detachedElementRef.current =
            input === null && elementRef.current !== null
              ? {
                  node: elementRef.current,
                  half: halfHeightFloorRef.current,
                }
              : null;
          elementRef.current = sheet ? input : null;
          setElement(sheet ? input : null);
          if (sheet && input !== null && current?.node === input) {
            updateHalfHeightFloor(current.half);
            if (pinnedElementRef.current !== input) {
              pinnedElementRef.current = input;
              measurementRef.current = createPinnedSheetMeasurement(
                input,
                input.getBoundingClientRect().height,
                (0, runtime.sheetContentCanGrow)(input),
              );
            }
            return;
          }
          if (input === null || !sheet) {
            updateHalfHeightFloor(false);
          }
          if (input !== null && sheet) {
            let value = (0, runtime.hasEditableSheetContent)(input);
            if (value) {
              let value2 = `min(${runtime.MIN_SHEET_HEIGHT_CSS}, ${runtime.MAX_SHEET_HEIGHT_CSS})`;
              input.style.minHeight = value2;
              input.style.maxHeight = value2;
            }
            updateHalfHeightFloor(value);
            measureAndPin(input, input.getBoundingClientRect().height);
          }
        },
        [sheet, measureAndPin, updateHalfHeightFloor],
      ),
      height = frame?.height;
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      let current = elementRef.current;
      if (!sheet || height !== undefined || current === null) {
        return;
      }
      (0, runtime.resetSheetDragStyle)(current);
      measureAndPin(current, current.getBoundingClientRect().height);
    }, [sheet, height, measureAndPin]);
    let open = frame?.open ?? false;
    useSheetHeightUntilVisible(
      sheet && open && height === undefined ? element : null,
      measureAndPin,
    );
    let repinHeight = frame?.repinHeight,
      dragState = frame?.drag;
    reactSheetPopupHost.useEffect(() => {
      if (!sheet || !open || element === null || repinHeight === undefined) {
        return;
      }
      let defaultView = element.ownerDocument.defaultView;
      if (
        defaultView === null ||
        typeof defaultView.MutationObserver === "undefined"
      ) {
        return;
      }
      let index = 0,
        flag = false,
        flag2 = false,
        value: Element | null = null,
        value2 =
          typeof defaultView.ResizeObserver === "undefined"
            ? null
            : new defaultView.ResizeObserver(() => {
                callback4();
              }),
        callback = () => {
          let element2 = element.querySelector(
            "[data-cds-sheet-control]",
          );
          if (element2 === value || value2 === null) {
            return;
          }
          if (value !== null) {
            value2.unobserve(value);
          }
          value = element2;
          if (element2 !== null) {
            value2.observe(element2);
          }
        },
        callback2 = (input: number, options: boolean): void => {
          let value5 = (0, runtime.getSheetMinimumHeight)(
            defaultView.innerHeight,
            halfHeightFloorRef.current,
          );
          repinHeight(Math.max(input, value5), options);
        },
        callback3 = () => {
          index = 0;
          if (dragState !== undefined && dragState.get() !== null) {
            index = defaultView.requestAnimationFrame(callback3);
            return;
          }
          if (!value3.ready()) {
            return;
          }
          callback();
          if ((0, runtime.hasEditableSheetContent)(element)) {
            if (!halfHeightFloorRef.current) {
              updateHalfHeightFloor(true);
              repinHeight(
                defaultView.innerHeight * runtime.MIN_SHEET_HEIGHT_FRACTION,
                true,
              );
            }
            flag2 = false;
            return;
          }
          let value5 = measureSheetControlOverflow(element, value),
            value6 = measureSheetScrollContent(element),
            value7 =
              element.getBoundingClientRect().height + value5 - value6.visible,
            value8 =
              (0, runtime.getSheetAvailableHeight)(defaultView, element) *
              runtime.MAX_SHEET_HEIGHT_FRACTION;
          if (flag2) {
            flag2 = false;
            let value10 = Math.round(
              Math.max(
                measureNaturalSheetHeight(element) + value5,
                value6.overflowContent > 0
                  ? value7 + value6.overflowContent
                  : 0,
              ),
            );
            flag = value10 > value8;
            measurementRef.current = {
              contentHeight: value10,
              written: Math.min(value10, value8),
              chromeAtPin: value7,
              chromeSettled: value7,
              grows: flag,
            };
            callback2(Math.min(value10, value8), flag);
            return;
          }
          let current = measurementRef.current;
          if (
            current === null ||
            Math.abs(value7 - current.chromeSettled) < 1
          ) {
            return;
          }
          current.chromeSettled = value7;
          if (Math.abs(value7 - current.chromeAtPin) < 1) {
            callback2(current.written, current.grows);
            return;
          }
          let value9 =
            current.contentHeight + value7 - current.chromeAtPin;
          callback2(Math.min(value9, value8), value9 > value8 || current.grows);
        },
        callback4 = () => {
          if (index === 0) {
            index = defaultView.requestAnimationFrame(callback3);
          }
        },
        value3 = createSheetUncoverGate(element, callback4);
      callback();
      let value4 = new defaultView.MutationObserver(
        (input) => {
          if (
            (index !== 0 && flag2) ||
            isScrollContentReplacement(input, flag)
          ) {
            return;
          }
          flag2 = true;
          callback4();
        },
      );
      value4.observe(element, {
        childList: true,
        subtree: true,
      });
      return () => {
        value4.disconnect();
        value3.dispose();
        value2?.disconnect();
        if (index !== 0) {
          defaultView.cancelAnimationFrame(index);
        }
        if (pinnedElementRef.current === element) {
          measurementRef.current = null;
          pinnedElementRef.current = null;
        }
      };
    }, [sheet, open, element, repinHeight, dragState, updateHalfHeightFloor]);
    useSheetTextEntryFocus(element, frame);
    useSheetPressedState(element);
    useDismissSheetOnForeignFocus(element, frame, sheetState.covered);
    (0, runtime.useAndroidCloseWatcher)(
      sheet && (frame?.open ?? false),
      frame?.dismiss,
    );
    let coverParent = reactSheetPopupHost.useContext(
        runtime.sheetCoverContext,
      ),
      windowObject = (0, runtime.useRootWindow)(),
      frameHeight = (0, runtime.getSheetFrameHeight)(
        frame,
        windowObject,
        element,
      ),
      stack = reactSheetPopupHost.useMemo(
        () =>
          sheet && coverParent !== null
            ? {
                depth: sheetState.depth,
                frameHeight: frameHeight,
                cover: coverParent,
              }
            : null,
        [sheet, coverParent, sheetState.depth, frameHeight],
      ),
      covered = sheet && sheetState.covered,
      inert = sheet && sheetState.inert,
      style = sheet
        ? (0, runtime.getSheetPopupStyle)(frame, {
            floor: halfHeightFloor ? "half" : "content",
            parentFrameHeight: parentSheet?.frameHeight,
          })
        : undefined;
    return {
      sheet: sheet,
      concealed: false,
      chrome: SheetChrome,
      ref: attachElement,
      style: style,
      positionerStyle: sheet
        ? (0, runtime.getSheetPositionerStyle)(frame)
        : undefined,
      attrs: {
        ...(sheet ? (0, runtime.getControlSizeAttributes)("lg") : {}),
        "data-presentation": sheet ? "sheet" : undefined,
        "data-sheet-tree": sheet ? frame?.treeId : undefined,
        [runtime.SHEET_COVERED_ATTRIBUTE]: covered ? "" : undefined,
        "data-cds-sheet-depth": sheet ? String(sheetState.depth) : undefined,
        "data-cds-sheet-detent": sheet ? frame?.detent : undefined,
        "aria-hidden": inert ? "true" : undefined,
        ...(inert ? runtime.inertElementProps : {}),
      },
      frame: frame,
      state: sheetState,
      stack: stack,
    };
  }
  function SheetPopupHost({ children: children }: SheetPopupHostProps): ReactNode {
    return children(useSheetPopupHost());
  }
  function checkLayerBase(input: number, options: number): void {
    return;
  }
  function CdsLayer({
    children: children,
    base: base,
    render: render,
  }: CdsLayerProps): ReactElement {
    let value = reactLayers.useContext(layerBaseContext),
      value2 = base ?? value + LAYER_BAND_SIZE;
    if (base === undefined) {
      checkLayerBase(value2, value);
    }
    let value3 =
      render === undefined
        ? null
        : reactLayers.cloneElement(
            render,
            {
              "data-cds": render.props["data-cds"] ?? "CdsLayer",
              style: {
                ...render.props.style,
                zIndex: value2,
                "--cds-layer-base": value2,
              },
            },
            children,
          );
    return jsxLayers.jsx(layerBaseContext.Provider, {
      value: value2,
      children: value3 ?? children,
    });
  }
  function warnInvalidLayerOffset(
    source: string,
    layerOffset: number,
  ): void {
    if (
      Number.isInteger(layerOffset) &&
      layerOffset >= 0 &&
      layerOffset < LAYER_BAND_SIZE
    ) {
      return;
    }
    let warning = `cds: ${source} — value must be an integer in [0, ${LAYER_BAND_SIZE}). A non-integer is silently invalid as a z-index (the declaration is dropped and the element falls to z-auto); anything outside the range escapes its band and stacks unpredictably against other overlays.`;
    console.warn(warning);
  }
  function useDefaultOverlayLayer(input: OverlayLayerKind): OverlayLayer {
    return useOverlayLayer(input);
  }
  function useOverlayLayer(kind: OverlayLayerKind, layerOffset?: number): OverlayLayer {
    let parentBase = reactLayers.useContext(layerBaseContext);
    if (layerOffset === undefined) {
      let value = parentBase + LAYER_BAND_SIZE;
      checkLayerBase(value, parentBase);
      let value2 = value + overlayLayerOffsets[kind];
      return {
        base: value,
        style: {
          zIndex: value2,
          "--cds-layer-base": value,
        },
        portalProps: {
          className: portalLayerClasses,
          style: {
            "--cds-portal-z": value2,
            "--cds-layer-base": value,
          },
        },
      };
    }
    warnInvalidLayerOffset(`layerOffset=${layerOffset}`, layerOffset);
    let zIndex = parentBase + layerOffset;
    return {
      base: parentBase,
      style: {
        zIndex: zIndex,
        "--cds-layer-base": parentBase,
      },
      portalProps: {
        className: portalLayerClasses,
        style: {
          "--cds-portal-z": zIndex,
          "--cds-layer-base": parentBase,
        },
      },
    };
  }
  function CdsLayerVarBridge({
    children: children,
    className: className,
  }: CdsLayerVarBridgeProps): ReactElement {
    let value = reactLayers.useContext(layerBaseContext);
    return jsxLayers.jsx("div", {
      className: cn("contents", className),
      "data-cds": "CdsLayerVarBridge",
      "data-cds-layer-var-bridge": "",
      style: {
        "--cds-layer-base": value,
      },
      children: children,
    });
  }
  function setReactRef<Instance>(
    ref: Ref<Instance> | undefined,
    value: Instance | null,
  ): void | (() => void) {
    if (typeof ref === "function") {
      return ref(value);
    }
    if (ref) {
      ref.current = value;
    }
  }
  function mergeRefs<Instance>(
    ...refs: (Ref<Instance> | undefined)[]
  ): MergedRefCallback<Instance> {
    return (input: Instance | null): (() => void) | undefined => {
      let value = refs.map(
        (input2) => setReactRef(input2, input),
      );
      if (
        !value.some((input2) => typeof input2 === "function")
      ) {
        return;
      }
      return () => {
        refs.forEach((input2, options) => {
          let value2 = value[options];
          if (typeof value2 === "function") {
            value2();
          } else {
            setReactRef(input2, null);
          }
        });
      };
    };
  }
  function useMergedRefs<Instance>(
    firstRef?: Ref<Instance>,
    secondRef?: Ref<Instance>,
    thirdRef?: Ref<Instance>,
  ): MergedRefCallback<Instance> {
    return reactMergedRefs.useMemo(
      () => mergeRefs(firstRef, secondRef, thirdRef),
      [firstRef, secondRef, thirdRef],
    );
  }
  function useStableMergedRef<Instance>(
    firstRef: RefCallback<Instance>,
    secondRef: Ref<Instance> | undefined,
  ): MergedRefCallback<Instance> {
    let stableFirstRef = (0, runtime.useEventCallback)(firstRef);
    return (0, runtime.useEventCallback)(
      (input: Instance | null): (() => void) | undefined => mergeRefs(stableFirstRef, secondRef)(input),
    );
  }
  function resolveExperimentalTheme(configuration: ExperimentalThemeConfiguration): unknown {
    try {
      return configuration.resolve?.(configuration.theme);
    } catch (value: unknown) {
      reportThemeErrorOnce(
        '<CdsRoot experimental.theme> could not resolve the theme "' +
          String(configuration.theme.id) +
          '", so useTokenValue returns unthemed values. ' +
          (value instanceof Error ? value.message : String(value)),
      );
      return;
    }
  }
  function createThemeStore(configuration?: ExperimentalThemeConfiguration): ThemeStore {
    let listeners = new Set<() => void>(),
      snapshot = createResolvedThemeSnapshot(configuration),
      serverSnapshot = snapshot,
      notify = () => {
        for (let value of listeners) value();
      };
    return {
      subscribe: (input: () => void): (() => boolean) => {
        listeners.add(input);
        return () => listeners.delete(input);
      },
      getSnapshot: () => snapshot,
      getServerSnapshot: () => serverSnapshot,
      getId: () => snapshot?.theme.id,
      set: (input: ExperimentalThemeConfiguration | undefined): void => {
        let value = createResolvedThemeSnapshot(input, snapshot);
        if (value !== snapshot) {
          snapshot = value;
          notify();
        }
      },
    };
  }
  function useCdsThemeId(): string | undefined {
    let value =
      reactExperimentalTheme.useContext(themeStoreContext) ?? defaultThemeStore;
    return reactExperimentalTheme.useSyncExternalStore(
      value.subscribe,
      value.getId,
      () => value.getServerSnapshot()?.theme.id,
    );
  }
  function reportThemeErrorOnce(message: string): void {
    if (reportedThemeErrors.has(message)) {
      return;
    }
    reportedThemeErrors.add(message);
    console.error("cds: " + message);
  }
  function reportThemeApplicationError(
    themeId: string,
    error: unknown,
  ): void {
    reportThemeErrorOnce(
      '<CdsRoot experimental.theme> could not put the theme "' +
        themeId +
        '" on the page, so the page keeps what it had (no theme, or the previous one) while useTokenValue and useCdsTheme answer for "' +
        themeId +
        '". ' +
        (error instanceof Error ? error.message : String(error)),
    );
  }
  function disposeThemeApplication(cleanupRef: ThemeCleanupRef): void {
    let cleanup = cleanupRef.current;
    cleanupRef.current = undefined;
    try {
      cleanup?.();
    } catch {}
  }
  function useExperimentalThemeStore(
    configuration: ExperimentalThemeConfiguration | undefined,
    targetRef: RefObject<HTMLElement | null>,
  ): ThemeStore {
    let parentStore =
        reactExperimentalTheme.useContext(themeStoreContext),
      [ownStore] = reactExperimentalTheme.useState(
        () =>
          parentStore === undefined
            ? createThemeStore(configuration)
            : defaultThemeStore,
      ),
      isRoot = parentStore === undefined,
      theme = configuration?.theme ?? undefined,
      resolve = configuration?.resolve,
      apply = configuration?.apply,
      applyRef = reactExperimentalTheme.useRef(apply);
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      applyRef.current = apply;
    }, [apply]);
    let hasApply = apply !== undefined,
      cleanupRef = reactExperimentalTheme.useRef<(() => void) | undefined>(undefined);
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      if (isRoot) {
        ownStore.set(
          theme === undefined
            ? undefined
            : {
                theme: theme,
                resolve: resolve,
              },
        );
      }
    }, [isRoot, ownStore, theme, resolve]);
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      let current = targetRef.current,
        current2 = applyRef.current;
      if (
        isRoot &&
        theme !== undefined &&
        current2 !== undefined &&
        current !== null
      ) {
        try {
          cleanupRef.current = current2(theme, {
            target: current,
          });
        } catch (value: unknown) {
          reportThemeApplicationError(theme.id, value);
        }
      } else {
        disposeThemeApplication(cleanupRef);
      }
    }, [isRoot, theme, hasApply, targetRef]);
    (0, runtime.useIsomorphicLayoutEffect)(
      () => () => disposeThemeApplication(cleanupRef),
      [],
    );
    reactExperimentalTheme.useEffect(() => {}, [
      configuration === null,
      theme,
      hasApply,
      parentStore,
      targetRef,
    ]);
    return parentStore ?? ownStore;
  }
  function getElementNamespace(input: Element | null | undefined): string | null | undefined {
    let value = input;
    if (value?.nodeType === 1) {
      return value.namespaceURI;
    } else {
      return undefined;
    }
  }
  function isHtmlElement(input: Element | null | undefined): input is HTMLElement {
    return getElementNamespace(input) === HTML_NAMESPACE;
  }
  function isSvgElement(input: Element | null | undefined): boolean {
    return getElementNamespace(input) === SVG_NAMESPACE_GE0;
  }
  function isHiddenByInlineDisplay(input: Element): boolean {
    if (!input.isConnected) {
      return false;
    }
    for (
      let value: Element | null = input;
      value !== null;
      value = value.parentElement
    )
      if (isHtmlElement(value) && value.style.display === "none") {
        return true;
      }
    return false;
  }
  function hasOpenChild(input: Element): boolean {
    for (let value of input.children)
      if (value.hasAttribute("data-open")) {
        return true;
      }
    return false;
  }
  function CloseOnActivityHideProvider({
    actionsRef: actionsRef,
    children: children,
  }: CloseOnActivityHideProviderProps): ReactElement {
    let [value] = reactActivityHide.useState(() => new Set<Element>()),
      ref = reactActivityHide.useRef(false);
    reactActivityHide.useEffect(() => {
      if (ref.current) {
        ref.current = false;
        actionsRef.current?.close?.();
      }
      return () => {
        ref.current = false;
        for (let value2 of value)
          if (isHiddenByInlineDisplay(value2) && hasOpenChild(value2)) {
            ref.current = true;
          }
      };
    }, [actionsRef, value]);
    return jsxActivityHide.jsx(activityHideElementsContext.Provider, {
      value: value,
      children: children,
    });
  }
  function useCloseOnActivityHideRef(input: boolean): RefObject<HTMLElement | null> {
    let value = reactActivityHide.useContext(
        activityHideElementsContext,
      ),
      ref = reactActivityHide.useRef<HTMLElement>(null);
    reactActivityHide.useEffect(() => {
      let current = ref.current;
      if (!input || value === null || current === null) {
        return;
      }
      value.add(current);
      return () => {
        value.delete(current);
      };
    }, [value, input]);
    return ref;
  }
  function getCompanionModalCatcher(
    input: Element,
    options: EventTarget | null,
  ): HTMLElement | null {
    let value = (0, runtime.asElement)(options);
    if (value === null || value.parentElement !== input) {
      return null;
    }
    if (value.childElementCount === 0 && value.style.position === "fixed") {
      return value;
    } else {
      return null;
    }
  }
  function shouldSuppressModalCatcherFocus(
    input: Element,
    options: EventTarget | null,
  ): boolean {
    let value = getCompanionModalCatcher(input, options);
    if (value === null) {
      return false;
    }
    let value2 = (0, runtime.asElement)(
        value.ownerDocument.activeElement,
      ),
      value3 = input.parentElement ?? input;
    return value2 === null || !value3.contains(value2);
  }
  function handleModalCatcherPointerDown(event: ReactPointerEvent<HTMLElement>): void {
    if (
      event.pointerType !== "touch" &&
      shouldSuppressModalCatcherFocus(event.currentTarget, event.target)
    ) {
      event.preventDefault();
    }
  }
  function handleModalCatcherMouseDown(event: ReactMouseEvent<HTMLElement>): void {
    if (shouldSuppressModalCatcherFocus(event.currentTarget, event.target)) {
      event.preventDefault();
    }
  }
  function handleModalCatcherDragStart(event: ReactDragEvent<HTMLElement>): void {
    let currentTarget = event.currentTarget,
      value: HTMLElement | null = null;
    for (let value3 of currentTarget.children)
      if (
        ((value = getCompanionModalCatcher(currentTarget, value3)),
        value !== null)
      ) {
        break;
      }
    if (value === null) {
      return;
    }
    let value2 = value;
    if (
      modalCatcherDragSession !== null &&
      modalCatcherDragSession.event === event.nativeEvent
    ) {
      value2.style.pointerEvents = "none";
      let restoreAll = modalCatcherDragSession.restoreAll;
      modalCatcherDragSession.restoreAll = () => {
        value2.style.pointerEvents = "";
        restoreAll();
      };
      return;
    }
    modalCatcherDragSession?.restoreAll();
    value2.style.pointerEvents = "none";
    let ownerDocument = value2.ownerDocument,
      state: ModalCatcherDragSession = {
        event: event.nativeEvent,
        restoreAll: () => {
          value2.style.pointerEvents = "";
          for (let value3 of modalCatcherDragEndEvents)
            ownerDocument.removeEventListener(value3, callback, true);
          if (modalCatcherDragSession === state) {
            modalCatcherDragSession = null;
          }
        },
      },
      callback = () => state.restoreAll();
    modalCatcherDragSession = state;
    for (let value3 of modalCatcherDragEndEvents)
      ownerDocument.addEventListener(value3, callback, true);
  }
  function ResetSkeletonContexts({ children: children }: ResetSkeletonContextsProps): ReactElement {
    return jsxSkeletonContexts.jsx(skeletonActiveContext.Provider, {
      value: false,
      children: jsxSkeletonContexts.jsx(skeletonElementContext.Provider, {
        value: "div",
        children: jsxSkeletonContexts.jsx(skeletonShownStoreContext.Provider, {
          value: null,
          children: jsxSkeletonContexts.jsx(skeletonGroupContext.Provider, {
            value: null,
            children: children,
          }),
        }),
      }),
    });
  }
  function PortalRoot({
    children: children,
    className: className,
    style: style,
    surface: surface,
    density: density,
    companionModalCatcher = false,
    closeOnActivityHide = false,
  }: PortalRootProps): ReactElement {
    let value = useCloseOnActivityHideRef(closeOnActivityHide),
      value2 = useMergedRefs(runtime.trackInputForElement, value),
      value3 = (0, runtime.useDensity)(),
      value4 = density ?? value3,
      value5 = (0, runtime.useColorMode)(),
      value6 = useCdsThemeId(),
      value7 = (0, runtime.usePlatform)(),
      value8 = (0, runtime.useFont)(),
      value9 =
        (0, runtime.useDocumentFont)(value8 === undefined) ?? value8,
      value10 = (0, runtime.useMonospaceFont)(),
      value11 = (0, runtime.useFeatureFlagAttribute)(),
      value12 = (0, runtime.usePageBackground)(),
      value13 = (0, runtime.useSurfaceBackground)(),
      value14 = surface ?? value13,
      value15 =
        value14 || value10 !== undefined || style
          ? {
              ...(0, runtime.getSurfaceBackgroundStyle)(value14),
              ...(0, runtime.getMonospaceOverrideStyle)(value10),
              ...style,
            }
          : undefined;
    return jsxPortalRoot.jsx("div", {
      ref: value2,
      className: cn("cds-root pointer-events-auto", className),
      "data-cds-portal": "",
      "data-density": value4,
      "data-mode": value5,
      "data-cds-theme": value6,
      "data-platform": value7,
      "data-font": value9,
      "data-cds-fizzy-lake": value11,
      "data-page-bg": value12,
      style: value15,
      onPointerDown: companionModalCatcher
        ? handleModalCatcherPointerDown
        : undefined,
      onMouseDown: companionModalCatcher
        ? handleModalCatcherMouseDown
        : undefined,
      onDragStart: companionModalCatcher
        ? handleModalCatcherDragStart
        : undefined,
      children: jsxPortalRoot.jsx(runtime.portalDensityContext.Provider, {
        value: value4,
        children: jsxPortalRoot.jsx(runtime.surfaceBackgroundContext.Provider, {
          value: value14,
          children: jsxPortalRoot.jsx(runtime.isPortalRootContext.Provider, {
            value: true,
            children: jsxPortalRoot.jsx(pointerDismissalContext.Provider, {
              value: false,
              children: jsxPortalRoot.jsx(ResetSkeletonContexts, {
                children: children,
              }),
            }),
          }),
        }),
      }),
    });
  }
  function rootFontSizeProbe(): HTMLElement {
    if (rootRemProbeElement === null || !rootRemProbeElement.isConnected) {
      if (rootRemProbeElement !== null) {
        rootRemResizeObserver?.unobserve(rootRemProbeElement);
        rootRemProbeElement.remove();
      }
      rootRemProbeElement =
        document.documentElement.querySelector<HTMLElement>(
          `:scope > [${ROOT_FONT_PROBE_ATTRIBUTE}]`,
        ) ?? document.createElement("div");
      rootRemProbeElement.setAttribute("aria-hidden", "true");
      rootRemProbeElement.setAttribute(ROOT_FONT_PROBE_ATTRIBUTE, "");
      rootRemProbeElement.style.cssText = ROOT_REM_PROBE_STYLE;
      if (!rootRemProbeElement.isConnected) {
        document.documentElement.appendChild(rootRemProbeElement);
      }
      rootRemResizeObserver?.observe(rootRemProbeElement);
    }
    return rootRemProbeElement;
  }
  function measureRootRemScale(element: Element): number {
    let value = /^([\d.]+)px$/.exec(
        getComputedStyle(element).fontSize,
      ),
      value2 =
        value === null ? NaN : Number(value[1]) / DEFAULT_ROOT_FONT_SIZE;
    if (value2 > 0) {
      return value2;
    }
    return (
      parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      ) || 16
    );
  }
  function readRootRemSize(): number {
    if (typeof document === "undefined") {
      return 16;
    }
    return measureRootRemScale(rootFontSizeProbe());
  }
  function rootRemSnapshot(): number {
    cachedRootRemSize ??= readRootRemSize();
    return cachedRootRemSize;
  }
  function serverRootRemSnapshot(): number {
    return 16;
  }
  function subscribeRootRemSize(listener: () => void): () => void {
    rootRemSubscribers.add(listener);
    if (
      rootRemResizeObserver === null &&
      typeof document !== "undefined" &&
      typeof ResizeObserver !== "undefined"
    ) {
      let value = rootFontSizeProbe();
      rootRemResizeObserver = new ResizeObserver(() => {
        let value2 = readRootRemSize();
        if (value2 !== cachedRootRemSize) {
          cachedRootRemSize = value2;
          for (let value3 of rootRemSubscribers) value3();
        }
      });
      rootRemResizeObserver.observe(value);
    }
    return () => {
      rootRemSubscribers.delete(listener);
      if (rootRemSubscribers.size === 0) {
        rootRemResizeObserver?.disconnect();
        rootRemResizeObserver = null;
        cachedRootRemSize = null;
      }
    };
  }
  function useRootRemSize(): number {
    return reactForUiInteractions.useSyncExternalStore(
      subscribeRootRemSize,
      rootRemSnapshot,
      serverRootRemSnapshot,
    );
  }
  function resolveIconSize(size: IconSizeSetting, densitySize: IconSizeName): IconSizeName {
    if (size === "auto") {
      return densitySize;
    }
    if (size === "auto-sm" || size === "auto-lg") {
      return (
        iconSizes[
          iconSizes.indexOf(densitySize) + (size === "auto-lg" ? 1 : -1)
        ] ?? densitySize
      );
    }
    return size;
  }
  function useDensityIconSize(): IconSizeName {
    if ((0, runtime.useDensity)() === "comfortable") {
      return "md";
    } else {
      return "sm";
    }
  }
  function useIconSize(input: IconSizeSetting = DEFAULT_ICON_SIZE): IconSizeName {
    return resolveIconSize(input, useDensityIconSize());
  }
  function getClosestIconSize(pixels: number): IconSizeName {
    let closestSize = iconSizes[0]!,
      minimumDistance = 1 / 0;
    for (let value of iconSizes) {
      let value2 = Math.abs(iconSizeMetrics[value].px - pixels);
      if (value2 <= minimumDistance) {
        minimumDistance = value2;
        closestSize = value;
      }
    }
    return closestSize;
  }
  function calculateIconFontWeight(
    strokeWidth: number,
    masterSize: number,
    pixels: number,
  ): number {
    let normalizedWeight = (strokeWidth * masterSize) / pixels,
      { lo: minimumMasterWeight, hi: maximumMasterWeight } =
        iconWeightBounds[`${masterSize}`]!,
      weightFraction =
        (normalizedWeight - minimumMasterWeight) /
        (maximumMasterWeight - minimumMasterWeight),
      fontWeight =
        MIN_ICON_FONT_WEIGHT +
        (MAX_ICON_FONT_WEIGHT - MIN_ICON_FONT_WEIGHT) * weightFraction;
    return (
      Math.round(
        Math.max(
          MIN_ICON_FONT_WEIGHT,
          Math.min(MAX_ICON_FONT_WEIGHT, fontWeight),
        ) * 10,
      ) / 10
    );
  }
  function validateIconAccessibility(
    input: string | undefined,
    options: object,
  ): void {}
  function getCustomIconFontStyle(
    pixels: number,
    strokeWidth: number,
  ): IconFontStyle {
    let masterSize = pixels <= 18 ? 16 : 20;
    return {
      fontSize: pixelsToScaledRem(pixels),
      fontWeight: calculateIconFontWeight(strokeWidth, masterSize, pixels),
    };
  }
  function createIconSizeStyles(size: IconSizeName): Readonly<IconSizeStyles> {
    let { px: pixels, stroke: stroke } = iconSizeMetrics[size];
    return Object.freeze({
      regular: Object.freeze(getCustomIconFontStyle(pixels, stroke.regular)),
      ...("strong" in stroke && {
        strong: Object.freeze(getCustomIconFontStyle(pixels, stroke.strong)),
      }),
    });
  }
  function Icon(input: IconProps): ReactElement {
    let value = useDensityIconSize();
    if (input.customIcon) {
      let {
        customIcon: value27,
        size: value35 = DEFAULT_ICON_SIZE,
        alt: value28,
        className: value29,
        style: value30,
        name: value31,
        icon: value32,
        animated: value33,
        ...value34
      } = input;
      validateIconAccessibility(value28, value34);
      let px = iconSizeMetrics[resolveIconSize(value35, value)].px,
        value36 = pixelsToScaledRem(px);
      return jsxIcons.jsx("svg", {
        "data-cds": "Icon",
        width: "1em",
        height: "1em",
        viewBox: `0 0 ${value27.viewBox} ${value27.viewBox}`,
        fill: "currentColor",
        fillRule: "evenodd",
        stroke: "none",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        xmlns: "http://www.w3.org/2000/svg",
        style: {
          ...customIconBaseStyle,
          fontSize: value36,
          ...value30,
        },
        className: value29,
        ...value34,
        role: value34.role ?? (value28 ? "img" : undefined),
        "aria-hidden": value34["aria-hidden"] ?? (value28 ? undefined : true),
        "aria-label": value34["aria-label"] ?? (value28 || undefined),
        children: value27.paths.map(
          (input2: string | CustomIconPath, options: number): ReactElement =>
            typeof input2 === "string"
              ? jsxIcons.jsx(
                  "path",
                  {
                    d: input2,
                  },
                  options,
                )
              : jsxIcons.jsx(
                  "path",
                  {
                    d: input2.d,
                    fill: "none",
                    stroke: "currentColor",
                    strokeWidth: input2.strokeWidth,
                    vectorEffect: "non-scaling-stroke",
                  },
                  options,
                ),
        ),
      });
    }
    let {
      bold: value11 = false,
      animated: value12 = false,
      alt: value2,
      className: value3,
      style: value4,
      name: value5,
      icon: value6,
      size: value7,
      customSize: value8,
      customIcon: value9,
      ...value10
    } = input;
    validateIconAccessibility(value2, value10);
    let value13 = input.name ?? input.icon.name,
      value14: number,
      value15: IconSizeName;
    if (value8 !== undefined) {
      value14 = value8;
      value15 = getClosestIconSize(value14);
    } else {
      value15 = resolveIconSize(value7 ?? DEFAULT_ICON_SIZE, value);
      value14 = iconSizeMetrics[value15].px;
    }
    let stroke = iconSizeMetrics[value15].stroke,
      value16 =
        value7 === "auto" || value7 === "auto-sm" || value7 === "auto-lg",
      value17 = value11 && !("strong" in stroke) && !value16,
      value18 = primaryIconGlyphs[value13],
      value19 =
        value18 === undefined ? undefined : secondaryIconGlyphs[value13],
      value20 = iconFontStyles[value15],
      value21 =
        value8 === undefined
          ? value11 && value20.strong !== undefined
            ? value20.strong
            : value20.regular
          : getCustomIconFontStyle(
              value14,
              value11 && "strong" in stroke ? stroke.strong : stroke.regular,
            ),
      value22 = value12 && animatedIcons.has(value13),
      value23 = value22 ? animationDurations[value13] : undefined,
      value24 = value22 ? animationExitDurations[value13] : undefined,
      value25 = value22 ? animationEasings[value13] : undefined,
      value26 = value22
        ? {
            ...value21,
            "--cds-opsz": value14,
            "--cds-wght": value21.fontWeight,
            ...(value23 !== undefined && {
              "--cds-anim-dur": `${value23}ms`,
            }),
            ...(value24 !== undefined && {
              "--cds-anim-dur-out": `${value24}ms`,
            }),
            ...(value25 !== undefined && {
              "--cds-anim-ease": value25,
            }),
          }
        : value21;
    return jsxIcons.jsxs("span", {
      "data-cds": "Icon",
      "data-cds-anim": value22 ? "" : undefined,
      "data-cds-anim-loop":
        value22 && loopingIcons.has(value13) ? "" : undefined,
      style: value4
        ? {
            ...value26,
            ...value4,
          }
        : value26,
      className: value3,
      ...value10,
      role: value10.role ?? (value2 ? "img" : undefined),
      "aria-hidden": value10["aria-hidden"] ?? (value2 ? undefined : true),
      "aria-label": value10["aria-label"] ?? (value2 || undefined),
      children: [
        value19 !== undefined &&
          jsxIcons.jsx("span", {
            "data-cds-icon-layer": "secondary",
            "aria-hidden": "true",
            children: String.fromCodePoint(value19),
          }),
        value18 !== undefined ? String.fromCodePoint(value18) : null,
      ],
    });
  }
  function isIconName(input: unknown): input is string {
    return typeof input === "string";
  }
  function IconSlot({ icon: icon }: IconSlotProps): ReactElement {
    return jsxIcons.jsx("span", {
      className: "flex size-icon shrink-0 items-center justify-center",
      children: isIconName(icon)
        ? jsxIcons.jsx(Icon, {
            name: icon,
            size: "auto",
          })
        : icon,
    });
  }
  function readDesktopTitlebarInset(doc: Document): number {
    let documentElement = doc.documentElement,
      value =
        doc.defaultView
          ?.getComputedStyle(documentElement)
          .getPropertyValue("--desktop-titlebar-inset") ||
        documentElement.style.getPropertyValue("--desktop-titlebar-inset"),
      value2 = Number.parseFloat(value);
    if (Number.isFinite(value2) && value2 > 0) {
      return value2;
    } else {
      return 0;
    }
  }
  function getDesktopTitlebarStore(doc: Document): ExternalStore<number> {
    let entry = desktopTitlebarStores.get(doc);
    if (entry === undefined) {
      let values = new Set<() => void>(),
        value: SafeMutationObserver | null = null,
        flag = false,
        value2: number,
        flag2 = false,
        callback = () => {
          flag2 = false;
          value2 = readDesktopTitlebarInset(doc);
          return value2;
        };
      entry = {
        subscribe(input: () => void) {
          values.add(input);
          if (value === null && !flag) {
            let value3 = (0, runtime.createSafeMutationObserver)(
              MutationObserver,
              () => {
                if (values.size === 0) {
                  flag2 = true;
                  return;
                }
                let value4 = value2;
                if (callback() !== value4) {
                  for (let value5 of values) value5();
                }
              },
            );
            if (
              value3.observe(doc.documentElement, {
                attributes: true,
                attributeFilter: ["style"],
              })
            ) {
              callback();
              value = value3;
            } else {
              flag = true;
            }
          }
          return () => {
            values.delete(input);
          };
        },
        getSnapshot: () => {
          if (value === null) {
            return readDesktopTitlebarInset(doc);
          }
          let value3 =
            values.size === 0 && value.takeRecords().length > 0;
          if (flag2 || value3) {
            callback();
          }
          return value2;
        },
      };
      desktopTitlebarStores.set(doc, entry);
    }
    return entry;
  }
  function resolveContainerElement(input: ContainerSource | null | undefined): ContainerElement | null {
    let callback = (input2: ContainerSource | null | undefined): input2 is ContainerElement =>
      typeof input2 === "object" &&
      input2 !== null &&
      (input2.nodeType === 1 || input2.nodeType === 11) &&
      "ownerDocument" in input2;
    if (callback(input)) {
      return input;
    }
    if (typeof input === "object" && input !== null && "current" in input) {
      let current = input.current;
      if (callback(current)) {
        return current;
      } else {
        return null;
      }
    }
    return null;
  }
  function useDesktopTitlebarInset(input: ContainerSource | null | undefined): number {
    let value = (0, runtime.useRootElement)(),
      callback = reactCollisionPadding.useCallback(
        () =>
          (resolveContainerElement(input) ?? value)?.ownerDocument ??
          (typeof document === "undefined" ? null : document),
        [input, value],
      ),
      [value2, value3] = reactCollisionPadding.useState<Document | null>(callback);
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      value3(callback());
    });
    let memo = reactCollisionPadding.useMemo(
      () => (value2 === null ? null : getDesktopTitlebarStore(value2)),
      [value2],
    );
    return reactCollisionPadding.useSyncExternalStore(
      memo === null ? subscribeInsetNoop : memo.subscribe,
      memo === null ? getZeroInsetSnapshot : memo.getSnapshot,
      getZeroInsetSnapshot,
    );
  }
  function useCollisionPadding(
    input: CollisionPadding | undefined,
    options: ContainerSource | null | undefined,
  ): CollisionPadding | undefined {
    let value = useDesktopTitlebarInset(options);
    return reactCollisionPadding.useMemo(() => {
      if (input !== undefined) {
        return input;
      }
      if (value <= 0) {
        return;
      }
      return {
        top: DEFAULT_COLLISION_PADDING + value,
        right: DEFAULT_COLLISION_PADDING,
        bottom: DEFAULT_COLLISION_PADDING,
        left: DEFAULT_COLLISION_PADDING,
      };
    }, [input, value]);
  }
  function CollisionPaddingProvider({
    override: override,
    container: container,
    provideInherit = false,
    children: children,
  }: CollisionPaddingProviderProps): ReactNode {
    let value = useCollisionPadding(override, container),
      memo = reactCollisionPadding.useMemo(
        () => ({
          collisionPadding: value,
        }),
        [value],
      ),
      value2 = children(value);
    if (provideInherit) {
      return jsxCollisionPadding.jsx(collisionPaddingContext.Provider, {
        value: memo,
        children: value2,
      });
    } else {
      return value2;
    }
  }
  function getSurfaceClasses(input: ElevationName): string {
    return `rounded-card ${surfaceBackgroundClasses[elevationSurfaceNames[input]]} ${elevationShadowClasses[input]}`;
  }
  function createMenuVirtualAnchor(input: Pick<MenuTriggerContextValue, "triggerRef">): MenuVirtualAnchor {
    return {
      get contextElement(): HTMLElement | undefined {
        return input.triggerRef.current ?? undefined;
      },
      getBoundingClientRect: () => {
        let value = input.triggerRef.current?.getBoundingClientRect(),
          value2 = input.triggerRef.current
            ?.closest(MENU_ANCHOR_SELECTOR)
            ?.getBoundingClientRect(),
          value3 = value2?.x ?? value?.x ?? 0,
          value4 = value?.y ?? 0,
          value5 = value2?.width ?? value?.width ?? 0,
          value6 = value?.height ?? 0;
        return {
          x: value3,
          y: value4,
          width: value5,
          height: value6,
          top: value4,
          left: value3,
          right: value3 + value5,
          bottom: value4 + value6,
        };
      },
    };
  }
  function warnNestedMenuLayerOffset(): void {
    console.warn(
      "cds: layerOffset is ignored on nested `Menu.Popup` / `ContextMenu.SubmenuPopup` — a submenu's parent band is the root menu's own band, where the root's click shield sits; joining it would interleave the submenu with the root's own popup and shield — below them at low offsets. Set layerOffset on the root popup instead.",
    );
  }
  function warnNestedMenuInitialFocus(): void {
    console.warn(
      "cds: initialFocus is ignored on nested `Menu.Popup` / `ContextMenu.SubmenuPopup` — whether an open moves focus is the root popup's decision and its submenus follow it. Set initialFocus on the root Menu.Popup instead.",
    );
  }
  function useStableObjectRef<Value>(): { current: Value | null } {
    let [value] = reactMenuContexts.useState<{ current: Value | null }>(
      () => ({
        current: null,
      }),
    );
    return value;
  }
  function MenuScrollContent({
    header: header,
    headerClassName: headerClassName,
    footer: footer,
    maxVisibleItems: maxVisibleItems,
    fill = false,
    children: children,
  }: MenuScrollContentProps): ReactElement {
    let value =
      maxVisibleItems !== undefined
        ? `calc(${maxVisibleItems} * ${MENU_ITEM_HEIGHT_CSS} + 0.5rem)`
        : undefined;
    if (header || footer) {
      return jsxMenuScrollContent.jsxs("div", {
        className: (0, runtime.clsx)(
          "flex min-h-0 flex-col overflow-hidden rounded-[inherit]",
          fill && "flex-1",
        ),
        children: [
          header &&
            jsxMenuScrollContent.jsx("div", {
              className: cn(menuHeaderClasses, headerClassName),
              children: header,
            }),
          jsxMenuScrollContent.jsx("div", {
            style: {
              maxHeight: value,
            },
            className: `${menuBodyScrollClasses}${header ? " pt-0" : ""}`,
            [runtime.SHEET_SCROLL_ATTRIBUTE]: "",
            children: children,
          }),
          footer &&
            jsxMenuScrollContent.jsx("div", {
              className: menuFooterClasses,
              children: footer,
            }),
        ],
      });
    }
    return jsxMenuScrollContent.jsx("div", {
      style: {
        maxHeight: value,
      },
      className: (0, runtime.clsx)(menuScrollClasses, fill && "flex-1"),
      [runtime.SHEET_SCROLL_ATTRIBUTE]: "",
      children: children,
    });
  }
  function isKeyboardContextMenuEvent(input: ContextMenuEventLike | undefined): boolean {
    if (input === undefined || input.type !== "contextmenu") {
      return false;
    }
    let { button: value, pointerType: value2 } = input;
    return value === -1 && value2 !== "touch" && value2 !== "pen";
  }
  function recordKeyboardContextMenuOpen(
    input: MenuRootIdentity,
    options: boolean,
    context: MenuOpenChangeDetails,
  ): void {
    if (context.isCanceled) {
      return;
    }
    if (options && isKeyboardContextMenuEvent(context.event)) {
      keyboardContextMenuRoots.set(input, true);
    } else {
      keyboardContextMenuRoots.delete(input);
    }
  }
  function useKeyboardContextMenuInitialFocus(input: RefObject<HTMLElement | null>): void {
    let value = reactKeyboardContextMenuFocus.useContext(
      menuRootIdentityContext,
    );
    reactKeyboardContextMenuFocus.useEffect(() => {
      if (value === null || !keyboardContextMenuRoots.has(value)) {
        return;
      }
      let index = 0,
        count = 3,
        callback = () => {
          let current = input.current,
            value2 = current?.ownerDocument.activeElement ?? null;
          if (
            current !== null &&
            value2 !== null &&
            !current.contains(value2) &&
            count > 0
          ) {
            count -= 1;
            index = requestAnimationFrame(callback);
            return;
          }
          keyboardContextMenuRoots.delete(value);
          if (current !== null && value2 === current) {
            current
              .querySelector<HTMLElement>('[role^="menuitem"]:not([data-disabled])')
              ?.focus({
                preventScroll: true,
              });
          }
        };
      index = requestAnimationFrame(callback);
      return () => {
        cancelAnimationFrame(index);
      };
    }, [value, input]);
  }
  function blurWithSafeRelatedTarget(input: HTMLElement): void {
    let callback = (input2: FocusEvent): void => {
      let relatedTarget = input2.relatedTarget;
      if (
        relatedTarget !== null &&
        relatedTarget !== undefined &&
        (0, runtime.asElement)(relatedTarget) === null
      ) {
        Object.defineProperty(input2, "relatedTarget", {
          value: null,
          configurable: true,
        });
      }
    };
    input.addEventListener("focusout", callback, true);
    try {
      input.blur();
    } finally {
      input.removeEventListener("focusout", callback, true);
    }
  }
  function registerOverlayOwner(input: Element, options: OverlayOwnerResolver): void {
    runtime.overlayOwnerResolvers.set(input, options);
  }
  function getOverlayOwnerAncestors(input: Element | null): Element[] {
    let items: Element[] = [],
      value: Element | null = input;
    while (value !== null && items.length < runtime.MAX_OVERLAY_OWNER_DEPTH) {
      let entry = runtime.overlayOwnerResolvers.get(value);
      if (entry === undefined) {
        value = value.parentElement;
        continue;
      }
      let value2 = entry();
      if (value2 === null || value2 === value || items.includes(value2)) {
        break;
      }
      items.push(value2);
      value = value2;
    }
    return items;
  }
  bindRuntimeValue(runtime, "cn", () => cn);
  bindRuntimeValue(
    runtime,
    "classMergeThemeKeys",
    () => classMergeThemeKeys,
    (value) => {
      classMergeThemeKeys = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "classMergeTypographyScale",
    () => classMergeTypographyScale,
    (value) => {
      classMergeTypographyScale = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "classMergeTypographyWeights",
    () => classMergeTypographyWeights,
    (value) => {
      classMergeTypographyWeights = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getClassMergeThemeValues",
    () => getClassMergeThemeValues,
    (value) => {
      getClassMergeThemeValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "paddingTokenNames",
    () => paddingTokenNames,
    (value) => {
      paddingTokenNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "marginTokenNames",
    () => marginTokenNames,
    (value) => {
      marginTokenNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "gapTokenNames",
    () => gapTokenNames,
    (value) => {
      gapTokenNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createDirectionalClassGroups",
    () => createDirectionalClassGroups,
    (value) => {
      createDirectionalClassGroups = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "typographyClassNames",
    () => typographyClassNames,
    (value) => {
      typographyClassNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "typographyWeightClassNames",
    () => typographyWeightClassNames,
    (value) => {
      typographyWeightClassNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "mergeTailwindClasses",
    () => mergeTailwindClasses,
    (value) => {
      mergeTailwindClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeClassNames",
    () => initializeClassNames,
    (value) => {
      initializeClassNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "interpolateTranslation",
    () => interpolateTranslation,
  );
  bindRuntimeValue(
    runtime,
    "translateWithFallback",
    () => translateWithFallback,
  );
  bindRuntimeValue(runtime, "useTranslation", () => useTranslation);
  bindRuntimeValue(
    runtime,
    "reactTranslations",
    () => reactTranslations,
    (value) => {
      reactTranslations = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "translationContext",
    () => translationContext,
    (value) => {
      translationContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeTranslations",
    () => initializeTranslations,
    (value) => {
      initializeTranslations = value;
    },
  );
  bindRuntimeValue(runtime, "SheetHandle", () => SheetHandle);
  bindRuntimeValue(runtime, "SheetTitleBar", () => SheetTitleBar);
  bindRuntimeValue(runtime, "SheetBody", () => SheetBody);
  bindRuntimeValue(
    runtime,
    "reactSheetChrome",
    () => reactSheetChrome,
    (value) => {
      reactSheetChrome = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxSheetChrome",
    () => jsxSheetChrome,
    (value) => {
      jsxSheetChrome = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetDismissButton",
    () => SheetDismissButton,
    (value) => {
      SheetDismissButton = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetChrome",
    () => SheetChrome,
    (value) => {
      SheetChrome = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetChrome",
    () => initializeSheetChrome,
    (value) => {
      initializeSheetChrome = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getFiniteRunningAnimations",
    () => getFiniteRunningAnimations,
  );
  bindRuntimeValue(
    runtime,
    "isFiniteRunningAnimation",
    () => isFiniteRunningAnimation,
  );
  bindRuntimeValue(
    runtime,
    "afterElementAnimations",
    () => afterElementAnimations,
  );
  bindRuntimeValue(
    runtime,
    "initializeAnimationWait",
    () => initializeAnimationWait,
    (value) => {
      initializeAnimationWait = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useSheetTextEntryFocus",
    () => useSheetTextEntryFocus,
  );
  bindRuntimeValue(runtime, "useSheetPressedState", () => useSheetPressedState);
  bindRuntimeValue(
    runtime,
    "isScrollContentReplacement",
    () => isScrollContentReplacement,
  );
  bindRuntimeValue(
    runtime,
    "measureNaturalSheetHeight",
    () => measureNaturalSheetHeight,
  );
  bindRuntimeValue(
    runtime,
    "createSheetUncoverGate",
    () => createSheetUncoverGate,
  );
  bindRuntimeValue(runtime, "afterCssTransitions", () => afterCssTransitions);
  bindRuntimeValue(
    runtime,
    "measureSheetScrollContent",
    () => measureSheetScrollContent,
  );
  bindRuntimeValue(
    runtime,
    "measureSheetControlOverflow",
    () => measureSheetControlOverflow,
  );
  bindRuntimeValue(
    runtime,
    "useDismissSheetOnForeignFocus",
    () => useDismissSheetOnForeignFocus,
  );
  bindRuntimeValue(
    runtime,
    "reactSheetMeasurement",
    () => reactSheetMeasurement,
    (value) => {
      reactSheetMeasurement = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetMeasurement",
    () => initializeSheetMeasurement,
    (value) => {
      initializeSheetMeasurement = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createPinnedSheetMeasurement",
    () => createPinnedSheetMeasurement,
  );
  bindRuntimeValue(
    runtime,
    "useSheetHeightUntilVisible",
    () => useSheetHeightUntilVisible,
  );
  bindRuntimeValue(runtime, "useSheetPopupHost", () => useSheetPopupHost);
  bindRuntimeValue(runtime, "SheetPopupHost", () => SheetPopupHost);
  bindRuntimeValue(
    runtime,
    "reactSheetPopupHost",
    () => reactSheetPopupHost,
    (value) => {
      reactSheetPopupHost = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetPopupHost",
    () => initializeSheetPopupHost,
    (value) => {
      initializeSheetPopupHost = value;
    },
  );
  bindRuntimeValue(runtime, "checkLayerBase", () => checkLayerBase);
  bindRuntimeValue(runtime, "CdsLayer", () => CdsLayer);
  bindRuntimeValue(
    runtime,
    "warnInvalidLayerOffset",
    () => warnInvalidLayerOffset,
  );
  bindRuntimeValue(
    runtime,
    "useDefaultOverlayLayer",
    () => useDefaultOverlayLayer,
  );
  bindRuntimeValue(runtime, "useOverlayLayer", () => useOverlayLayer);
  bindRuntimeValue(runtime, "CdsLayerVarBridge", () => CdsLayerVarBridge);
  bindRuntimeValue(
    runtime,
    "reactLayers",
    () => reactLayers,
    (value) => {
      reactLayers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxLayers",
    () => jsxLayers,
    (value) => {
      jsxLayers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LAYER_BAND_SIZE",
    () => LAYER_BAND_SIZE,
    (value) => {
      LAYER_BAND_SIZE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TOAST_LAYER_BASE",
    () => TOAST_LAYER_BASE,
    (value) => {
      TOAST_LAYER_BASE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "layerBaseContext",
    () => layerBaseContext,
    (value) => {
      layerBaseContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "overlayLayerOffsets",
    () => overlayLayerOffsets,
    (value) => {
      overlayLayerOffsets = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "portalLayerClasses",
    () => portalLayerClasses,
    (value) => {
      portalLayerClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeLayers",
    () => initializeLayers,
    (value) => {
      initializeLayers = value;
    },
  );
  bindRuntimeValue(runtime, "setReactRef", () => setReactRef);
  bindRuntimeValue(runtime, "mergeRefs", () => mergeRefs);
  bindRuntimeValue(runtime, "useMergedRefs", () => useMergedRefs);
  bindRuntimeValue(runtime, "useStableMergedRef", () => useStableMergedRef);
  bindRuntimeValue(
    runtime,
    "reactMergedRefs",
    () => reactMergedRefs,
    (value) => {
      reactMergedRefs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeMergedRefs",
    () => initializeMergedRefs,
    (value) => {
      initializeMergedRefs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "resolveExperimentalTheme",
    () => resolveExperimentalTheme,
  );
  bindRuntimeValue(runtime, "createThemeStore", () => createThemeStore);
  bindRuntimeValue(runtime, "useCdsThemeId", () => useCdsThemeId);
  bindRuntimeValue(runtime, "reportThemeErrorOnce", () => reportThemeErrorOnce);
  bindRuntimeValue(
    runtime,
    "reportThemeApplicationError",
    () => reportThemeApplicationError,
  );
  bindRuntimeValue(
    runtime,
    "disposeThemeApplication",
    () => disposeThemeApplication,
  );
  bindRuntimeValue(
    runtime,
    "useExperimentalThemeStore",
    () => useExperimentalThemeStore,
  );
  bindRuntimeValue(
    runtime,
    "reactExperimentalTheme",
    () => reactExperimentalTheme,
    (value) => {
      reactExperimentalTheme = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createResolvedThemeSnapshot",
    () => createResolvedThemeSnapshot,
    (value) => {
      createResolvedThemeSnapshot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "themeStoreContext",
    () => themeStoreContext,
    (value) => {
      themeStoreContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultThemeStore",
    () => defaultThemeStore,
    (value) => {
      defaultThemeStore = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reportedThemeErrors",
    () => reportedThemeErrors,
    (value) => {
      reportedThemeErrors = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeExperimentalTheme",
    () => initializeExperimentalTheme,
    (value) => {
      initializeExperimentalTheme = value;
    },
  );
  bindRuntimeValue(runtime, "getElementNamespace", () => getElementNamespace);
  bindRuntimeValue(runtime, "isHtmlElement", () => isHtmlElement);
  bindRuntimeValue(runtime, "isSvgElement", () => isSvgElement);
  bindRuntimeValue(
    runtime,
    "HTML_NAMESPACE",
    () => HTML_NAMESPACE,
    (value) => {
      HTML_NAMESPACE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SVG_NAMESPACE_GE0",
    () => SVG_NAMESPACE_GE0,
    (value) => {
      SVG_NAMESPACE_GE0 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeElementNamespaces",
    () => initializeElementNamespaces,
    (value) => {
      initializeElementNamespaces = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isHiddenByInlineDisplay",
    () => isHiddenByInlineDisplay,
  );
  bindRuntimeValue(runtime, "hasOpenChild", () => hasOpenChild);
  bindRuntimeValue(
    runtime,
    "CloseOnActivityHideProvider",
    () => CloseOnActivityHideProvider,
  );
  bindRuntimeValue(
    runtime,
    "useCloseOnActivityHideRef",
    () => useCloseOnActivityHideRef,
  );
  bindRuntimeValue(
    runtime,
    "reactActivityHide",
    () => reactActivityHide,
    (value) => {
      reactActivityHide = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxActivityHide",
    () => jsxActivityHide,
    (value) => {
      jsxActivityHide = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "activityHideElementsContext",
    () => activityHideElementsContext,
    (value) => {
      activityHideElementsContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeCloseOnActivityHide",
    () => initializeCloseOnActivityHide,
    (value) => {
      initializeCloseOnActivityHide = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getCompanionModalCatcher",
    () => getCompanionModalCatcher,
  );
  bindRuntimeValue(
    runtime,
    "shouldSuppressModalCatcherFocus",
    () => shouldSuppressModalCatcherFocus,
  );
  bindRuntimeValue(
    runtime,
    "handleModalCatcherPointerDown",
    () => handleModalCatcherPointerDown,
  );
  bindRuntimeValue(
    runtime,
    "handleModalCatcherMouseDown",
    () => handleModalCatcherMouseDown,
  );
  bindRuntimeValue(
    runtime,
    "handleModalCatcherDragStart",
    () => handleModalCatcherDragStart,
  );
  bindRuntimeValue(
    runtime,
    "modalCatcherDragSession",
    () => modalCatcherDragSession,
    (value) => {
      modalCatcherDragSession = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "modalCatcherDragEndEvents",
    () => modalCatcherDragEndEvents,
    (value) => {
      modalCatcherDragEndEvents = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeModalCatcher",
    () => initializeModalCatcher,
    (value) => {
      initializeModalCatcher = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactPointerDismissal",
    () => reactPointerDismissal,
    (value) => {
      reactPointerDismissal = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxPointerDismissal",
    () => jsxPointerDismissal,
    (value) => {
      jsxPointerDismissal = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pointerDismissalContext",
    () => pointerDismissalContext,
    (value) => {
      pointerDismissalContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializePointerDismissal",
    () => initializePointerDismissal,
    (value) => {
      initializePointerDismissal = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ResetSkeletonContexts",
    () => ResetSkeletonContexts,
  );
  bindRuntimeValue(
    runtime,
    "reactSkeletonContexts",
    () => reactSkeletonContexts,
    (value) => {
      reactSkeletonContexts = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxSkeletonContexts",
    () => jsxSkeletonContexts,
    (value) => {
      jsxSkeletonContexts = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "skeletonActiveContext",
    () => skeletonActiveContext,
    (value) => {
      skeletonActiveContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "skeletonElementContext",
    () => skeletonElementContext,
    (value) => {
      skeletonElementContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "skeletonGroupContext",
    () => skeletonGroupContext,
    (value) => {
      skeletonGroupContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "skeletonShownStoreContext",
    () => skeletonShownStoreContext,
    (value) => {
      skeletonShownStoreContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSkeletonContexts",
    () => initializeSkeletonContexts,
    (value) => {
      initializeSkeletonContexts = value;
    },
  );
  bindRuntimeValue(runtime, "PortalRoot", () => PortalRoot);
  bindRuntimeValue(
    runtime,
    "jsxPortalRoot",
    () => jsxPortalRoot,
    (value) => {
      jsxPortalRoot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializePortalRoot",
    () => initializePortalRoot,
    (value) => {
      initializePortalRoot = value;
    },
  );
  bindRuntimeValue(runtime, "rootFontSizeProbe", () => rootFontSizeProbe);
  bindRuntimeValue(runtime, "measureRootRemScale", () => measureRootRemScale);
  bindRuntimeValue(runtime, "readRootRemSize", () => readRootRemSize);
  bindRuntimeValue(runtime, "rootRemSnapshot", () => rootRemSnapshot);
  bindRuntimeValue(
    runtime,
    "serverRootRemSnapshot",
    () => serverRootRemSnapshot,
  );
  bindRuntimeValue(runtime, "subscribeRootRemSize", () => subscribeRootRemSize);
  bindRuntimeValue(runtime, "useRootRemSize", () => useRootRemSize);
  bindRuntimeValue(
    runtime,
    "reactForUiInteractions",
    () => reactForUiInteractions,
    (value) => {
      reactForUiInteractions = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "REM_SCALE_VARIABLE",
    () => REM_SCALE_VARIABLE,
    (value) => {
      REM_SCALE_VARIABLE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DEFAULT_ROOT_FONT_SIZE",
    () => DEFAULT_ROOT_FONT_SIZE,
    (value) => {
      DEFAULT_ROOT_FONT_SIZE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ROOT_REM_PROBE_LENGTH_CSS",
    () => ROOT_REM_PROBE_LENGTH_CSS,
    (value) => {
      ROOT_REM_PROBE_LENGTH_CSS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ROOT_REM_PROBE_STYLE",
    () => ROOT_REM_PROBE_STYLE,
    (value) => {
      ROOT_REM_PROBE_STYLE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ROOT_FONT_PROBE_ATTRIBUTE",
    () => ROOT_FONT_PROBE_ATTRIBUTE,
    (value) => {
      ROOT_FONT_PROBE_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pixelsToScaledRem",
    () => pixelsToScaledRem,
    (value) => {
      pixelsToScaledRem = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "rootRemProbeElement",
    () => rootRemProbeElement,
    (value) => {
      rootRemProbeElement = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "rootRemResizeObserver",
    () => rootRemResizeObserver,
    (value) => {
      rootRemResizeObserver = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cachedRootRemSize",
    () => cachedRootRemSize,
    (value) => {
      cachedRootRemSize = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "rootRemSubscribers",
    () => rootRemSubscribers,
    (value) => {
      rootRemSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeRemScale",
    () => initializeRemScale,
    (value) => {
      initializeRemScale = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "iconFontManifest",
    () => iconFontManifest,
    (value) => {
      iconFontManifest = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "iconCodepoints",
    () => iconCodepoints,
    (value) => {
      iconCodepoints = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "secondaryIconCodepoints",
    () => secondaryIconCodepoints,
    (value) => {
      secondaryIconCodepoints = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "nextIconCodepoint",
    () => nextIconCodepoint,
    (value) => {
      nextIconCodepoint = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "iconMasterWeights",
    () => iconMasterWeights,
    (value) => {
      iconMasterWeights = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "animatedIconNames",
    () => animatedIconNames,
    (value) => {
      animatedIconNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "loopingIconNames",
    () => loopingIconNames,
    (value) => {
      loopingIconNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "iconAnimationDurations",
    () => iconAnimationDurations,
    (value) => {
      iconAnimationDurations = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "iconAnimationExitDurations",
    () => iconAnimationExitDurations,
    (value) => {
      iconAnimationExitDurations = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "iconAnimationEasings",
    () => iconAnimationEasings,
    (value) => {
      iconAnimationEasings = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "iconManifest",
    () => iconManifest,
    (value) => {
      iconManifest = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeIconManifest",
    () => initializeIconManifest,
    (value) => {
      initializeIconManifest = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeIconAccessibility",
    () => initializeIconAccessibility,
    (value) => {
      initializeIconAccessibility = value;
    },
  );
  bindRuntimeValue(runtime, "resolveIconSize", () => resolveIconSize);
  bindRuntimeValue(runtime, "useDensityIconSize", () => useDensityIconSize);
  bindRuntimeValue(runtime, "useIconSize", () => useIconSize);
  bindRuntimeValue(runtime, "getClosestIconSize", () => getClosestIconSize);
  bindRuntimeValue(
    runtime,
    "calculateIconFontWeight",
    () => calculateIconFontWeight,
  );
  bindRuntimeValue(
    runtime,
    "validateIconAccessibility",
    () => validateIconAccessibility,
  );
  bindRuntimeValue(
    runtime,
    "getCustomIconFontStyle",
    () => getCustomIconFontStyle,
  );
  bindRuntimeValue(runtime, "createIconSizeStyles", () => createIconSizeStyles);
  bindRuntimeValue(runtime, "Icon", () => Icon);
  bindRuntimeValue(runtime, "isIconName", () => isIconName);
  bindRuntimeValue(runtime, "IconSlot", () => IconSlot);
  bindRuntimeValue(
    runtime,
    "jsxIcons",
    () => jsxIcons,
    (value) => {
      jsxIcons = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "iconSizeMetrics",
    () => iconSizeMetrics,
    (value) => {
      iconSizeMetrics = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "iconSizes",
    () => iconSizes,
    (value) => {
      iconSizes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DEFAULT_ICON_SIZE",
    () => DEFAULT_ICON_SIZE,
    (value) => {
      DEFAULT_ICON_SIZE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "primaryIconGlyphs",
    () => primaryIconGlyphs,
    (value) => {
      primaryIconGlyphs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "secondaryIconGlyphs",
    () => secondaryIconGlyphs,
    (value) => {
      secondaryIconGlyphs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "animatedIcons",
    () => animatedIcons,
    (value) => {
      animatedIcons = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "loopingIcons",
    () => loopingIcons,
    (value) => {
      loopingIcons = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "animationDurations",
    () => animationDurations,
    (value) => {
      animationDurations = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "animationExitDurations",
    () => animationExitDurations,
    (value) => {
      animationExitDurations = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "animationEasings",
    () => animationEasings,
    (value) => {
      animationEasings = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "iconWeightBounds",
    () => iconWeightBounds,
    (value) => {
      iconWeightBounds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIN_ICON_FONT_WEIGHT",
    () => MIN_ICON_FONT_WEIGHT,
    (value) => {
      MIN_ICON_FONT_WEIGHT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_ICON_FONT_WEIGHT",
    () => MAX_ICON_FONT_WEIGHT,
    (value) => {
      MAX_ICON_FONT_WEIGHT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "customIconBaseStyle",
    () => customIconBaseStyle,
    (value) => {
      customIconBaseStyle = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "iconFontStyles",
    () => iconFontStyles,
    (value) => {
      iconFontStyles = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeIcons",
    () => initializeIcons,
    (value) => {
      initializeIcons = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "readDesktopTitlebarInset",
    () => readDesktopTitlebarInset,
  );
  bindRuntimeValue(
    runtime,
    "getDesktopTitlebarStore",
    () => getDesktopTitlebarStore,
  );
  bindRuntimeValue(
    runtime,
    "resolveContainerElement",
    () => resolveContainerElement,
  );
  bindRuntimeValue(
    runtime,
    "useDesktopTitlebarInset",
    () => useDesktopTitlebarInset,
  );
  bindRuntimeValue(runtime, "useCollisionPadding", () => useCollisionPadding);
  bindRuntimeValue(
    runtime,
    "CollisionPaddingProvider",
    () => CollisionPaddingProvider,
  );
  bindRuntimeValue(
    runtime,
    "reactCollisionPadding",
    () => reactCollisionPadding,
    (value) => {
      reactCollisionPadding = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxCollisionPadding",
    () => jsxCollisionPadding,
    (value) => {
      jsxCollisionPadding = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DEFAULT_COLLISION_PADDING",
    () => DEFAULT_COLLISION_PADDING,
    (value) => {
      DEFAULT_COLLISION_PADDING = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "desktopTitlebarStores",
    () => desktopTitlebarStores,
    (value) => {
      desktopTitlebarStores = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getZeroInsetSnapshot",
    () => getZeroInsetSnapshot,
    (value) => {
      getZeroInsetSnapshot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "subscribeInsetNoop",
    () => subscribeInsetNoop,
    (value) => {
      subscribeInsetNoop = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "collisionPaddingContext",
    () => collisionPaddingContext,
    (value) => {
      collisionPaddingContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeCollisionPadding",
    () => initializeCollisionPadding,
    (value) => {
      initializeCollisionPadding = value;
    },
  );
  bindRuntimeValue(runtime, "getSurfaceClasses", () => getSurfaceClasses);
  bindRuntimeValue(
    runtime,
    "elevationSurfaceNames",
    () => elevationSurfaceNames,
    (value) => {
      elevationSurfaceNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "elevationShadowClasses",
    () => elevationShadowClasses,
    (value) => {
      elevationShadowClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "surfaceBackgroundClasses",
    () => surfaceBackgroundClasses,
    (value) => {
      surfaceBackgroundClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "focusShadowByMode",
    () => focusShadowByMode,
    (value) => {
      focusShadowByMode = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "dangerFocusShadowByMode",
    () => dangerFocusShadowByMode,
    (value) => {
      dangerFocusShadowByMode = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSurfaces",
    () => initializeSurfaces,
    (value) => {
      initializeSurfaces = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createMenuVirtualAnchor",
    () => createMenuVirtualAnchor,
  );
  bindRuntimeValue(
    runtime,
    "warnNestedMenuLayerOffset",
    () => warnNestedMenuLayerOffset,
  );
  bindRuntimeValue(
    runtime,
    "warnNestedMenuInitialFocus",
    () => warnNestedMenuInitialFocus,
  );
  bindRuntimeValue(runtime, "useStableObjectRef", () => useStableObjectRef);
  bindRuntimeValue(
    runtime,
    "reactMenuContexts",
    () => reactMenuContexts,
    (value) => {
      reactMenuContexts = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "menuTriggerContext",
    () => menuTriggerContext,
    (value) => {
      menuTriggerContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultSubmenuState",
    () => defaultSubmenuState,
    (value) => {
      defaultSubmenuState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "submenuStateContext",
    () => submenuStateContext,
    (value) => {
      submenuStateContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FOCUSES_NOTHING_ATTRIBUTE",
    () => FOCUSES_NOTHING_ATTRIBUTE,
    (value) => {
      FOCUSES_NOTHING_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "contextMenuContext",
    () => contextMenuContext,
    (value) => {
      contextMenuContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "menuBarContext",
    () => menuBarContext,
    (value) => {
      menuBarContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "menuSheetLabelsContext",
    () => menuSheetLabelsContext,
    (value) => {
      menuSheetLabelsContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MENU_ANCHOR_SELECTOR",
    () => MENU_ANCHOR_SELECTOR,
    (value) => {
      MENU_ANCHOR_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "menuRootIdentityContext",
    () => menuRootIdentityContext,
    (value) => {
      menuRootIdentityContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "menuIsOpenContext",
    () => menuIsOpenContext,
    (value) => {
      menuIsOpenContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeMenuContexts",
    () => initializeMenuContexts,
    (value) => {
      initializeMenuContexts = value;
    },
  );
  bindRuntimeValue(runtime, "MenuScrollContent", () => MenuScrollContent);
  bindRuntimeValue(
    runtime,
    "jsxMenuScrollContent",
    () => jsxMenuScrollContent,
    (value) => {
      jsxMenuScrollContent = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "menuScrollClasses",
    () => menuScrollClasses,
    (value) => {
      menuScrollClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "menuBodyScrollClasses",
    () => menuBodyScrollClasses,
    (value) => {
      menuBodyScrollClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "menuHeaderClasses",
    () => menuHeaderClasses,
    (value) => {
      menuHeaderClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "menuFooterClasses",
    () => menuFooterClasses,
    (value) => {
      menuFooterClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MENU_ITEM_HEIGHT_CSS",
    () => MENU_ITEM_HEIGHT_CSS,
    (value) => {
      MENU_ITEM_HEIGHT_CSS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeMenuScrollContent",
    () => initializeMenuScrollContent,
    (value) => {
      initializeMenuScrollContent = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isKeyboardContextMenuEvent",
    () => isKeyboardContextMenuEvent,
  );
  bindRuntimeValue(
    runtime,
    "recordKeyboardContextMenuOpen",
    () => recordKeyboardContextMenuOpen,
  );
  bindRuntimeValue(
    runtime,
    "useKeyboardContextMenuInitialFocus",
    () => useKeyboardContextMenuInitialFocus,
  );
  bindRuntimeValue(
    runtime,
    "reactKeyboardContextMenuFocus",
    () => reactKeyboardContextMenuFocus,
    (value) => {
      reactKeyboardContextMenuFocus = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "keyboardContextMenuRoots",
    () => keyboardContextMenuRoots,
    (value) => {
      keyboardContextMenuRoots = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeKeyboardContextMenuFocus",
    () => initializeKeyboardContextMenuFocus,
    (value) => {
      initializeKeyboardContextMenuFocus = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_ENTRY_SELECTOR",
    () => TEXT_ENTRY_SELECTOR,
    (value) => {
      TEXT_ENTRY_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeTextEntrySelector",
    () => initializeTextEntrySelector,
    (value) => {
      initializeTextEntrySelector = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "blurWithSafeRelatedTarget",
    () => blurWithSafeRelatedTarget,
  );
  bindRuntimeValue(
    runtime,
    "initializeSafeBlur",
    () => initializeSafeBlur,
    (value) => {
      initializeSafeBlur = value;
    },
  );
  bindRuntimeValue(runtime, "registerOverlayOwner", () => registerOverlayOwner);
  bindRuntimeValue(
    runtime,
    "getOverlayOwnerAncestors",
    () => getOverlayOwnerAncestors,
  );
  return () => {
    getClassMergeThemeValues = (input: ThemeTokenGroup): readonly string[] =>
      classMergeThemeKeys[input];
    createDirectionalClassGroups = (
      input: string,
      options: readonly string[],
    ): DirectionalClassGroups =>
      Object.fromEntries(
        ["", "x", "y", "s", "e", "t", "r", "b", "l"].map(
          (input2: string): [string, [Record<string, readonly string[]>]] => [
            `${input}${input2}`,
            [
              {
                [`${input}${input2}`]: options,
              },
            ],
          ],
        ),
      );
    initializeClassNames = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeThemeTokenManifest)();
      (0, runtime.initializeNpmDependency)();
      (0, runtime.initializeNpmDependency)();
      ({
        themeKeys: classMergeThemeKeys,
        TYPE_SCALE: classMergeTypographyScale,
        TYPE_WEIGHT_NAMES: classMergeTypographyWeights,
      } = runtime.themeTokenManifest);
      paddingTokenNames = getClassMergeThemeValues("padding");
      marginTokenNames = getClassMergeThemeValues("margin");
      gapTokenNames = getClassMergeThemeValues("gap");
      typographyClassNames = classMergeTypographyScale;
      typographyWeightClassNames = classMergeTypographyScale.flatMap(
        (input: string): string[] =>
          classMergeTypographyWeights.map(
            (input2: string): string => `${input}-${input2}`,
          ),
      );
      mergeTailwindClasses = (0, runtime.extendTailwindMerge)<"font-size-weight" | "grade">({
        extend: {
          conflictingClassGroups: {
            "font-size-weight": ["font-size", "font-weight", "leading"],
            "font-size": ["font-size-weight"],
          },
          theme: {
            radius: getClassMergeThemeValues("borderRadius"),
          },
          classGroups: {
            "font-size": [
              {
                text: typographyClassNames,
              },
            ],
            "font-size-weight": [
              {
                text: typographyWeightClassNames,
              },
            ],
            "font-family": [
              {
                font: [...getClassMergeThemeValues("fontFamily"), "inherit"],
              },
            ],
            "font-weight": [
              {
                font: getClassMergeThemeValues("fontWeight"),
              },
            ],
            grade: [
              {
                grad: [
                  "semibold",
                  "bold",
                  runtime.validators.isInteger,
                  runtime.validators.isArbitraryValue,
                ],
              },
            ],
            h: [
              {
                h: getClassMergeThemeValues("height"),
              },
            ],
            w: [
              {
                w: [...getClassMergeThemeValues("width"), "stretch"],
              },
            ],
            size: [
              {
                size: getClassMergeThemeValues("size"),
              },
            ],
            "min-h": [
              {
                "min-h": getClassMergeThemeValues("minHeight"),
              },
            ],
            "max-h": [
              {
                "max-h": ["none"],
              },
            ],
            shadow: [
              {
                shadow: getClassMergeThemeValues("boxShadow"),
              },
            ],
            duration: [
              {
                duration: getClassMergeThemeValues("transitionDuration"),
              },
            ],
            ease: [
              {
                ease: getClassMergeThemeValues("transitionTimingFunction"),
              },
            ],
            cursor: [
              {
                cursor: getClassMergeThemeValues("cursor"),
              },
            ],
            z: [
              {
                z: getClassMergeThemeValues("zIndex"),
              },
            ],
            opacity: [
              {
                opacity: getClassMergeThemeValues("opacity"),
              },
            ],
            ...createDirectionalClassGroups("p", paddingTokenNames),
            ...createDirectionalClassGroups("m", [
              ...marginTokenNames,
              "outset",
            ]),
            gap: [
              {
                gap: gapTokenNames,
              },
            ],
            "gap-x": [
              {
                "gap-x": gapTokenNames,
              },
            ],
            "gap-y": [
              {
                "gap-y": gapTokenNames,
              },
            ],
          },
        },
      });
    });
    initializeTranslations = (0, runtime.initializeOnce)(() => {
      reactTranslations = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      translationContext = reactTranslations.createContext<TranslateLabel | undefined>(undefined);
    });
    initializeSheetChrome = (0, runtime.initializeOnce)(() => {
      initializeClassNames();
      initializeTranslations();
      (0, runtime.initializeSheetDrag)();
      (0, runtime.initializeNpmDependency)();
      reactSheetChrome = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxSheetChrome = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      SheetDismissButton = reactSheetChrome.forwardRef(function (
        {
          as: as2 = "button",
          onDismiss: onDismiss,
          label: label,
          className: className,
          ...props
        }: SheetDismissButtonProps,
        options: ForwardedRef<HTMLElement>,
      ): ReactElement {
        let value = useTranslation("close", "Close"),
          value2 = label ?? value;
        return jsxSheetChrome.jsx(as2, {
          ref: options,
          type: "button",
          "data-cds-sheet-control": "",
          onClick: onDismiss,
          ...props,
          className: cn(
            "cds-reset mx-1 mb-1 block shrink-0 rounded px-2 text-start text-body font-normal text-primary outline-none select-none focus-visible:bg-fill-ghost-hover focus-visible:outline-hidden [&:not(:focus-visible):not([data-cds-sheet-control-held])]:sr-only",
            "min-h-control",
            className,
          ),
          children: value2,
        });
      });
      SheetChrome = {
        Handle: SheetHandle,
        TitleBar: SheetTitleBar,
        DismissButton: SheetDismissButton,
        Body: SheetBody,
      };
    });
    initializeAnimationWait = (): void => {};
    initializeSheetMeasurement = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeVisualKeyboard)();
      (0, runtime.initializePresentationMode)();
      initializeAnimationWait();
      reactSheetMeasurement = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
    });
    initializeSheetPopupHost = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeIsomorphicLayoutEffect)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeResizeObserverAccess)();
      (0, runtime.initializeAndroidCloseWatcher)();
      (0, runtime.initializeSheetStyles)();
      (0, runtime.initializePresentationMode)();
      (0, runtime.initializeAdaptiveSheets)();
      (0, runtime.initializeSheetDrag)();
      initializeSheetChrome();
      initializeSheetMeasurement();
      reactSheetPopupHost = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
    });
    LAYER_BAND_SIZE = 100;
    TOAST_LAYER_BASE = 9000;
    portalLayerClasses = "[&>*]:z-[var(--cds-portal-z)]";
    initializeLayers = (0, runtime.initializeOnce)(() => {
      initializeClassNames();
      reactLayers = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxLayers = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      layerBaseContext = reactLayers.createContext(0);
      (CdsLayer as DisplayNamed).displayName = "CdsLayer";
      overlayLayerOffsets = {
        modal: 40,
        tooltip: 30,
        contextmenu: 30,
        popover: 20,
        menu: 20,
        combobox: 20,
        coachmark: 10,
      };
      (CdsLayerVarBridge as DisplayNamed).displayName = "CdsLayerVarBridge";
    });
    initializeMergedRefs = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeEventCallbacks)();
      reactMergedRefs = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
    });
    createResolvedThemeSnapshot = (
      input?: ExperimentalThemeConfiguration | null,
      options?: ResolvedThemeSnapshot,
    ): ResolvedThemeSnapshot | undefined => {
      if (
        input === null ||
        input === undefined ||
        input.theme === undefined ||
        input.theme === null
      ) {
        return;
      }
      let value = resolveExperimentalTheme(input);
      if (
        options !== undefined &&
        options.theme === input.theme &&
        options.resolved === value
      ) {
        return options;
      } else {
        return {
          theme: input.theme,
          resolved: value,
        };
      }
    };
    initializeExperimentalTheme = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeIsomorphicLayoutEffect)();
      reactExperimentalTheme = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      themeStoreContext = reactExperimentalTheme.createContext<ThemeStore | undefined>(undefined);
      defaultThemeStore = createThemeStore(undefined);
      reportedThemeErrors = new Set();
    });
    HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
    SVG_NAMESPACE_GE0 = "http://www.w3.org/2000/svg";
    initializeElementNamespaces = (): void => {};
    initializeCloseOnActivityHide = (0, runtime.initializeOnce)(() => {
      initializeElementNamespaces();
      reactActivityHide = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxActivityHide = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      activityHideElementsContext = reactActivityHide.createContext<Set<Element> | null>(null);
    });
    modalCatcherDragSession = null;
    initializeModalCatcher = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeElementAccess)();
      modalCatcherDragEndEvents = ["dragend", "drop", "pointerdown"];
    });
    initializePointerDismissal = (0, runtime.initializeOnce)(() => {
      reactPointerDismissal = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxPointerDismissal = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      pointerDismissalContext = reactPointerDismissal.createContext(false);
    });
    initializeSkeletonContexts = (0, runtime.initializeOnce)(() => {
      reactSkeletonContexts = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxSkeletonContexts = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      skeletonActiveContext = reactSkeletonContexts.createContext(false);
      skeletonElementContext = reactSkeletonContexts.createContext<"div" | "span">("div");
      skeletonGroupContext = reactSkeletonContexts.createContext<number | null>(null);
      skeletonShownStoreContext = reactSkeletonContexts.createContext<SkeletonShownStore | null>(null);
    });
    initializePortalRoot = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeDocumentFont)();
      (0, runtime.initializeFeatureFlags)();
      (0, runtime.initializeInputDismissalTracking)();
      initializeExperimentalTheme();
      initializeClassNames();
      (0, runtime.initializeCdsRoot)();
      initializeCloseOnActivityHide();
      initializeModalCatcher();
      initializePointerDismissal();
      initializeMergedRefs();
      initializeSkeletonContexts();
      jsxPortalRoot = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
    });
    REM_SCALE_VARIABLE = "--cds-rem-scale";
    DEFAULT_ROOT_FONT_SIZE = 16;
    ROOT_FONT_PROBE_ATTRIBUTE = "data-cds-root-font-size-probe";
    pixelsToScaledRem = (input: number): string =>
      `calc(${input / 16}rem * var(${REM_SCALE_VARIABLE}, 1))`;
    rootRemProbeElement = null;
    rootRemResizeObserver = null;
    cachedRootRemSize = null;
    initializeRemScale = (0, runtime.initializeOnce)(() => {
      reactForUiInteractions = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      ROOT_REM_PROBE_LENGTH_CSS = `calc(${DEFAULT_ROOT_FONT_SIZE}rem * var(${REM_SCALE_VARIABLE}, 1))`;
      ROOT_REM_PROBE_STYLE = `position:fixed;top:0;left:0;width:${ROOT_REM_PROBE_LENGTH_CSS};min-width:0;max-width:none;height:0;font-size:${ROOT_REM_PROBE_LENGTH_CSS};-webkit-text-size-adjust:none;text-size-adjust:none;visibility:hidden;pointer-events:none;`;
      rootRemSubscribers = new Set();
    });
    initializeIconManifest = (0, runtime.initializeOnce)(() => {
      iconFontManifest = JSON.parse(`{
 "icons": {
  "Activity": 57344,
  "Add": 57345,
  "AddCircle": 57346,
  "Agent": 57347,
  "Alarm": 57348,
  "Android": 57349,
  "Ant": 57350,
  "Apple": 57351,
  "Archive": 57352,
  "ArrowDown": 57353,
  "ArrowDownCircle": 57354,
  "ArrowInSquare": 57355,
  "ArrowLeft": 57356,
  "ArrowLeftCircle": 57357,
  "ArrowOutSquare": 57358,
  "ArrowReturn": 57359,
  "ArrowRight": 57360,
  "ArrowRightCircle": 57361,
  "ArrowSplitRight": 57362,
  "ArrowUp": 57363,
  "ArrowUpCircle": 57364,
  "ArrowUpRight": 57365,
  "ArrowsOut": 57366,
  "Artifacts": 57367,
  "Atom": 57368,
  "Attachment": 57369,
  "Batch": 57370,
  "Beaker": 57371,
  "Binoculars": 57372,
  "Book": 57373,
  "BookClosed": 57374,
  "BookText": 57375,
  "Box": 57376,
  "BrowseSelect": 57377,
  "Bullhorn": 57378,
  "Cache": 57379,
  "Calendar": 57380,
  "Camera": 57381,
  "Capacity": 57382,
  "CaretDown": 57383,
  "CaretDownUp": 57384,
  "CaretLeft": 57385,
  "CaretRight": 57386,
  "CaretUp": 57387,
  "CaretUpDown": 57388,
  "ChangesPlusMinus": 57389,
  "ChangesPlusMinusFilled": 57390,
  "Chart": 57391,
  "ChartLine": 57392,
  "Chat": 57393,
  "ChatAdd": 57394,
  "ChatAddFilled": 57395,
  "ChatDelete": 57396,
  "ChatDeleteFilled": 57397,
  "ChatFilled": 57398,
  "ChatSimple": 57399,
  "ChatSimpleFilled": 57400,
  "Chats": 57401,
  "ChatsFilled": 57402,
  "Check": 57403,
  "CheckCircle": 57404,
  "CheckCircleFilled": 57405,
  "CheckDouble": 57406,
  "Checklist": 57407,
  "ChecklistFilled": 57408,
  "Clipboard": 57409,
  "ClipboardArrow": 57410,
  "Clock": 57411,
  "Cloud": 57412,
  "CloudFilled": 57413,
  "CloudSlash": 57414,
  "CloudSlashFilled": 57415,
  "Code": 57416,
  "CodeBlock": 57417,
  "CodeBrackets": 57418,
  "CodeFilled": 57419,
  "CoffeeCup": 57420,
  "Collapse": 57421,
  "CommandCard": 57422,
  "CommandLine": 57423,
  "CommandLineFilled": 57424,
  "CommandLinePrompt": 57425,
  "Compact": 57426,
  "Computer": 57427,
  "Concierge": 57428,
  "Connectors": 57429,
  "Copy": 57430,
  "Create": 57431,
  "CreditCard": 57432,
  "Cursor": 57433,
  "CursorFilled": 57434,
  "DNA": 57435,
  "Database": 57436,
  "Disconnect": 57437,
  "Dispatch": 57438,
  "DollarSign": 57439,
  "DotsCircle": 57440,
  "DotsHorizontal": 57441,
  "DotsVertical": 57442,
  "Download": 57443,
  "Edit": 57444,
  "Email": 57445,
  "Evals": 57446,
  "Expand": 57447,
  "ExtendedThinking": 57448,
  "Eye": 57449,
  "EyeSlash": 57450,
  "Fastforward": 57451,
  "File": 57452,
  "FileAdd": 57453,
  "FileUpload": 57454,
  "Files": 57455,
  "Filter": 57456,
  "Flag": 57457,
  "Folder": 57458,
  "FolderOpen": 57459,
  "FolderPlus": 57460,
  "Ghost": 57461,
  "GhostFilled": 57462,
  "Gift": 57463,
  "GitBranch": 57464,
  "GitCommit": 57465,
  "GitDiff": 57466,
  "GitFork": 57467,
  "GitMerge": 57468,
  "GitMergeConflict": 57469,
  "GitMergedSimple": 57470,
  "GitPullRequest": 57471,
  "GitPullRequestClosed": 57472,
  "GitPullRequestDraft": 57473,
  "Globe": 57474,
  "GraduationCap": 57475,
  "Grid": 57476,
  "Hand": 57477,
  "HandHeart": 57478,
  "Haptics": 57479,
  "Help": 57480,
  "History": 57481,
  "Home": 57482,
  "ID": 57483,
  "Image": 57484,
  "Indent": 57485,
  "InfoSimple": 57486,
  "Info": 57487,
  "Interactive": 57488,
  "Key": 57489,
  "Keyboard": 57490,
  "Laptop": 57491,
  "LaptopFilled": 57492,
  "LaptopSlash": 57493,
  "Library": 57494,
  "Lightbulb": 57495,
  "Lightning": 57496,
  "Link": 57497,
  "LinkSimple": 57498,
  "ListAdd": 57499,
  "ListBullet": 57500,
  "ListNumbered": 57501,
  "Location": 57502,
  "LocationQuestionMark": 57503,
  "LocationSlash": 57504,
  "Lock": 57505,
  "LockOpen": 57506,
  "LockShield": 57507,
  "Logout": 57508,
  "Mailbox": 57509,
  "MapPin": 57510,
  "Mcp": 57511,
  "Memory": 57512,
  "Mention": 57513,
  "Menu": 57514,
  "Microphone": 57515,
  "MicrophoneFilled": 57516,
  "MicrophoneSlash": 57517,
  "Minus": 57518,
  "MobilePhone": 57519,
  "Moon": 57520,
  "MoonFilled": 57521,
  "MoonStars": 57522,
  "Note": 57523,
  "Notification": 57524,
  "NotificationSlash": 57525,
  "Organization": 57526,
  "Owl": 57527,
  "Palette": 57528,
  "PaletteFilled": 57529,
  "PaperPlane": 57530,
  "Pause": 57531,
  "Phone": 57532,
  "Pin": 57533,
  "PinFilled": 57534,
  "PinSlash": 57535,
  "Placeholder": 57536,
  "Play": 57537,
  "PlayCircle": 57538,
  "PlayCircleFilled": 57539,
  "PlayFilled": 57540,
  "Plugin": 57541,
  "Press": 57542,
  "Pro": 57543,
  "Prohibit": 57544,
  "Projects": 57545,
  "ProjectsFilled": 57546,
  "ProjectsX": 57547,
  "Prompt": 57548,
  "Recording": 57549,
  "Reorder": 57551,
  "Research": 57552,
  "Screenshare": 57553,
  "Scroll": 57554,
  "Search": 57555,
  "SearchCircle": 57556,
  "Select": 57557,
  "Settings": 57558,
  "Shapes": 57559,
  "ArrowBendUpRight": 57560,
  "ShareAndroid": 57561,
  "Share": 57562,
  "ShieldSearch": 57563,
  "Shuffle": 57564,
  "Sidebar": 57565,
  "SidebarClose": 57566,
  "SidebarOpen": 57567,
  "Signpost": 57568,
  "SlashShortcutCommand": 57569,
  "Slides": 57570,
  "Sort": 57571,
  "Speaker": 57572,
  "Spinner": 57573,
  "Spreadsheet": 57574,
  "Star": 57575,
  "StarFilled": 57576,
  "StarSlash": 57577,
  "Stop": 57578,
  "StopCircle": 57579,
  "StopFilled": 57580,
  "Styles": 57581,
  "Sun": 57582,
  "SunFilled": 57583,
  "SunHorizon": 57584,
  "Tasks": 57585,
  "Team": 57586,
  "Temperature": 57587,
  "TemperatureSimple": 57588,
  "TextAa": 57589,
  "TextBold": 57590,
  "TextItalics": 57591,
  "TextUnderline": 57592,
  "ThumbsDown": 57593,
  "ThumbsDownFilled": 57594,
  "ThumbsUp": 57595,
  "ThumbsUpFilled": 57596,
  "Timer": 57597,
  "Toggles": 57598,
  "Token": 57599,
  "Tool": 57600,
  "Trash": 57601,
  "Trust": 57602,
  "Upload": 57603,
  "User": 57604,
  "UserCircle": 57605,
  "Users": 57606,
  "Verified": 57607,
  "Voice": 57608,
  "Warning": 57609,
  "WarningCircle": 57610,
  "WarningShield": 57611,
  "Workspace": 57612,
  "Wrench": 57613,
  "WrenchFilled": 57614,
  "X": 57615,
  "XCircle": 57616,
  "GitMergeQueue": 57617,
  "Orbit": 57618,
  "SidebarRight": 57619,
  "Bluetooth": 57621,
  "BluetoothSlash": 57622,
  "Bookmark": 57623,
  "ComputerClassic": 57624,
  "Linux": 57625,
  "Windows": 57626,
  "AgentSimple": 57627,
  "AgentsSimple": 57628,
  "ArrowClockwise": 57629,
  "ArrowCounterClockwise": 57630,
  "MinimizeBottomLeft": 57631,
  "MinimizeBottomRight": 57632,
  "MinimizeTopLeft": 57633,
  "MinimizeTopRight": 57634,
  "EyeFrame": 57635,
  "Frame": 57636,
  "Hammer": 57637,
  "HealthConnect": 57638,
  "Heart": 57639,
  "Scale": 57640,
  "ArrowDownLeft": 57641,
  "ArrowDownRight": 57642,
  "ArrowUpLeft": 57643,
  "Bank": 57644,
  "Goal": 57645,
  "ProgressQuarter": 57646,
  "UsageGaugeHigh": 57647,
  "UsageGaugeMiddle": 57648,
  "EditFilled": 57649,
  "Quote": 57650,
  "MemorySlash": 57651,
  "AddLarge": 57652,
  "Ticket": 57653,
  "WindowNew": 57654,
  "BookmarkFilled": 57655,
  "AlignStretch": 57656,
  "ArrowLine": 57657,
  "Crop": 57658,
  "Diagram": 57659,
  "Dropdown": 57660,
  "Eraser": 57661,
  "EyeDropper": 57662,
  "FrameHash": 57663,
  "Heading1": 57664,
  "Heading2": 57665,
  "Heading3": 57666,
  "JustifyCenter": 57667,
  "LineHeight": 57668,
  "LineSegment": 57669,
  "Outdent": 57670,
  "Sigma": 57671,
  "Table": 57672,
  "TextAlignCenter": 57673,
  "TextAlignJustify": 57674,
  "TextAlignLeft": 57675,
  "TextAlignRight": 57676,
  "TextHighlight": 57677,
  "TextT": 57678,
  "ZoomIn": 57679,
  "ZoomOut": 57680,
  "AlignCenter": 57681,
  "AlignEnd": 57682,
  "AlignStart": 57683,
  "CornerBottomLeft": 57684,
  "CornerBottomRight": 57685,
  "CornerTopLeft": 57686,
  "CornerTopRight": 57687,
  "JustifyEnd": 57688,
  "JustifySpaceBetween": 57689,
  "JustifyStart": 57690,
  "LetterSpacing": 57691,
  "TableCellSplit": 57692,
  "TableCellsMerge": 57693,
  "TableColumnDelete": 57694,
  "TableColumnInsertLeft": 57695,
  "TableColumnInsertRight": 57696,
  "TableRowDelete": 57697,
  "TableRowInsertAbove": 57698,
  "TableRowInsertBelow": 57699,
  "Smiley": 57719,
  "SmileyAdd": 57720,
  "SideBottom": 57721,
  "SideLeft": 57722,
  "SideRight": 57723,
  "SideTop": 57724,
  "Comment": 57729,
  "CommentFilled": 57730,
  "FolderLink": 57732,
  "ArrowBendUpLeft": 57733,
  "Circle": 57734,
  "Github": 57735,
  "Images": 57736,
  "SpeakerSlash": 57737,
  "CirclesAdd": 57738
 },
 "secondary": {
  "AlignCenter": 57700,
  "AlignEnd": 57701,
  "AlignStart": 57702,
  "CornerBottomLeft": 57703,
  "CornerBottomRight": 57704,
  "CornerTopLeft": 57705,
  "CornerTopRight": 57706,
  "JustifyEnd": 57707,
  "JustifySpaceBetween": 57708,
  "JustifyStart": 57709,
  "LetterSpacing": 57710,
  "TableCellSplit": 57711,
  "TableCellsMerge": 57712,
  "TableColumnDelete": 57713,
  "TableColumnInsertLeft": 57714,
  "TableColumnInsertRight": 57715,
  "TableRowDelete": 57716,
  "TableRowInsertAbove": 57717,
  "TableRowInsertBelow": 57718,
  "SideBottom": 57725,
  "SideLeft": 57726,
  "SideRight": 57727,
  "SideTop": 57728,
  "JustifyCenter": 57731
 },
 "next": 57739,
 "wght": {
  "16": {
   "lo": 0.8,
   "hi": 1.25
  },
  "20": {
   "lo": 1.125,
   "hi": 1.8
  }
 },
 "anim": [
  "Artifacts",
  "Chart",
  "Chats",
  "Clock",
  "Code",
  "Download",
  "Lightbulb",
  "Palette",
  "Projects",
  "Signpost",
  "Tasks",
  "Tool"
 ],
 "animLoop": [
  "Code"
 ],
 "animDur": {
  "Palette": 800
 },
 "animDurOut": {
  "Palette": 0
 },
 "animEase": {
  "Palette": "ease-out"
 }
}`);
      iconCodepoints = iconFontManifest.icons;
      secondaryIconCodepoints = iconFontManifest.secondary;
      nextIconCodepoint = iconFontManifest.next;
      iconMasterWeights = iconFontManifest.wght;
      animatedIconNames = iconFontManifest.anim;
      loopingIconNames = iconFontManifest.animLoop;
      iconAnimationDurations = iconFontManifest.animDur;
      iconAnimationExitDurations = iconFontManifest.animDurOut;
      iconAnimationEasings = iconFontManifest.animEase;
      iconManifest = iconFontManifest;
    });
    initializeIconAccessibility = (): void => {};
    DEFAULT_ICON_SIZE = "md";
    initializeIcons = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeCdsRoot)();
      initializeRemScale();
      initializeIconManifest();
      initializeIconAccessibility();
      jsxIcons = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      iconSizeMetrics = {
        xs: {
          px: 12,
          master: "small",
          stroke: {
            regular: 0.8,
          },
        },
        sm: {
          px: 16,
          master: "small",
          stroke: {
            regular: 1,
            strong: 1.25,
          },
        },
        md: {
          px: 20,
          master: "base",
          stroke: {
            regular: 1.2,
            strong: 1.5,
          },
        },
        lg: {
          px: 24,
          master: "base",
          stroke: {
            regular: 1.4,
          },
        },
        xl: {
          px: 28,
          master: "base",
          stroke: {
            regular: 1.6,
          },
        },
        xxl: {
          px: 32,
          master: "base",
          stroke: {
            regular: 1.8,
          },
        },
      };
      iconSizes = ["xs", "sm", "md", "lg", "xl", "xxl"];
      primaryIconGlyphs = iconManifest.icons;
      secondaryIconGlyphs = iconManifest.secondary ?? {};
      animatedIcons = new Set(iconManifest.anim ?? []);
      loopingIcons = new Set(iconManifest.animLoop ?? []);
      animationDurations = iconManifest.animDur ?? {};
      animationExitDurations = iconManifest.animDurOut ?? {};
      animationEasings = iconManifest.animEase ?? {};
      iconWeightBounds = iconManifest.wght;
      [MIN_ICON_FONT_WEIGHT, MAX_ICON_FONT_WEIGHT] = [400, 700];
      customIconBaseStyle = {
        flexShrink: 0,
      };
      iconFontStyles = Object.freeze({
        xs: createIconSizeStyles("xs"),
        sm: createIconSizeStyles("sm"),
        md: createIconSizeStyles("md"),
        lg: createIconSizeStyles("lg"),
        xl: createIconSizeStyles("xl"),
        xxl: createIconSizeStyles("xxl"),
      });
    });
    DEFAULT_COLLISION_PADDING = 5;
    getZeroInsetSnapshot = (): number => 0;
    subscribeInsetNoop = (): (() => void) => (): void => {
      return;
    };
    initializeCollisionPadding = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeSafeObservers)();
      (0, runtime.initializeIsomorphicLayoutEffect)();
      (0, runtime.initializeCdsRoot)();
      reactCollisionPadding = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxCollisionPadding = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      desktopTitlebarStores = new WeakMap();
      collisionPaddingContext = reactCollisionPadding.createContext<CollisionPaddingContextValue | null>(null);
    });
    initializeSurfaces = (0, runtime.initializeOnce)(() => {
      elevationSurfaceNames = {
        panel: "surface-2",
        popover: "surface-3",
      };
      elevationShadowClasses = {
        panel: "shadow-panel-sm",
        popover: "shadow-panel",
      };
      surfaceBackgroundClasses = {
        "surface-2": "bg-surface-2",
        "surface-3": "bg-surface-3",
      };
      focusShadowByMode = {
        light:
          "inset 0 0 0 1px var(--cds-page-bg), 0 0 0 1px var(--cds-fill-accent), 0 0 6px 1px var(--cds-bg-accent)",
        dark: "inset 0 0 0 1px var(--cds-page-bg), 0 0 0 1px var(--cds-fill-accent), 0 0 6px 1px hsl(from var(--cds-role-accent-600) h s l / 60%)",
      };
      dangerFocusShadowByMode = {
        light:
          "inset 0 0 0 1px var(--cds-page-bg), 0 0 0 1px var(--cds-fill-danger), 0 0 6px 1px var(--cds-bg-danger)",
        dark: "inset 0 0 0 1px var(--cds-page-bg), 0 0 0 1px var(--cds-fill-danger), 0 0 6px 1px hsl(from var(--cds-role-danger-600) h s l / 60%)",
      };
    });
    FOCUSES_NOTHING_ATTRIBUTE = "data-cds-focuses-nothing";
    MENU_ANCHOR_SELECTOR =
      '[data-cds="Menu"], [data-cds="ContextMenu"], [data-cds="DropdownButton"], [data-cds="SplitDropdownButton"], [data-cds="ModelSelector"]';
    initializeMenuContexts = (0, runtime.initializeOnce)(() => {
      reactMenuContexts = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      menuTriggerContext = reactMenuContexts.createContext<MenuTriggerContextValue | null>(null);
      defaultSubmenuState = {
        label: null,
        open: false,
      };
      submenuStateContext =
        reactMenuContexts.createContext(defaultSubmenuState);
      contextMenuContext = reactMenuContexts.createContext(false);
      menuBarContext = reactMenuContexts.createContext(false);
      menuSheetLabelsContext = reactMenuContexts.createContext<{ sheetTitle?: string; backLabel?: string; closeLabel?: string }>({
        sheetTitle: undefined,
        backLabel: undefined,
        closeLabel: undefined,
      });
      menuRootIdentityContext = reactMenuContexts.createContext<MenuRootIdentity | null>(null);
      menuIsOpenContext = reactMenuContexts.createContext<MenuRootIdentity | null>(null);
    });
    menuScrollClasses =
      "min-h-0 overflow-y-auto scroll-fade-y rounded-[inherit] border-b-[length:var(--cds-ring-inner)] border-transparent p-1";
    menuBodyScrollClasses =
      "min-h-0 flex-1 overflow-y-auto scroll-fade-y border-b-[length:var(--cds-ring-inner)] border-transparent p-1";
    menuHeaderClasses = "shrink-0 px-1 pt-1";
    menuFooterClasses = "-mt-1 shrink-0 px-1 pb-1";
    MENU_ITEM_HEIGHT_CSS = "max(var(--cds-h-control), var(--cds-leading-body))";
    initializeMenuScrollContent = (0, runtime.initializeOnce)(() => {
      initializeClassNames();
      (0, runtime.initializePresentationMode)();
      (0, runtime.initializeNpmDependency)();
      jsxMenuScrollContent = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
    });
    initializeKeyboardContextMenuFocus = (0, runtime.initializeOnce)(
      () => {
        initializeMenuContexts();
        reactKeyboardContextMenuFocus = (0, runtime.toModuleNamespace)(
          (0, runtime.loadReactNamespace)(),
          1,
        );
        keyboardContextMenuRoots = new WeakMap();
      },
    );
    TEXT_ENTRY_SELECTOR =
      "input:not([type='hidden']):not([disabled]),[contenteditable]:not([contenteditable='false']),textarea:not([disabled])";
    initializeTextEntrySelector = (): void => {};
    initializeSafeBlur = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeElementAccess)();
    });
  };
}
