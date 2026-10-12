/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type {
  Context,
  ForwardRefExoticComponent,
  FunctionComponent,
  HTMLAttributes,
  FocusEvent as ReactFocusEvent,
  PointerEvent as ReactPointerEvent,
  NamedExoticComponent,
  ReactElement,
  ReactNode,
  Ref,
  RefAttributes,
  RefObject,
} from "react";
import type { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import type { CollisionPadding } from "./interactions";

export interface SparkProps {
  /** Pixels when a number, otherwise any CSS length. */
  size?: number | string;
  color?: string;
  className?: string;
}
export type AvatarSize = "xs" | "sm" | "md" | "lg";
export type AvatarVariant = "default" | "pro" | "claude";
/** Context an avatar stack provides so its avatars share one size. */
export interface AvatarStackContextValue {
  size: AvatarSize;
}
export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  src?: string;
  /** Full name; the initials and the accessible label come from it. */
  name: string;
  size?: AvatarSize;
  variant?: AvatarVariant;
}
export interface AvatarVariantProps {
  size?: AvatarSize;
  variant?: AvatarVariant;
}
export type ShortcutVariant = "keycap" | "text";
export interface ShortcutProps extends HTMLAttributes<HTMLSpanElement> {
  /** Space-separated chords, for example "cmd+k" or "g then i". */
  keys: string;
  variant?: ShortcutVariant;
  /** Draws the keycaps for a filled (accent) background. */
  onFill?: boolean;
}
export type ShortcutModifier =
  | "cmd"
  | "command"
  | "meta"
  | "ctrl"
  | "control"
  | "alt"
  | "option"
  | "shift";
/** One chord split into its modifiers (in display order) and its other keys. */
export interface ShortcutChord {
  modifiers: ShortcutModifier[];
  keys: string[];
}
/** One rendered key: the visible label and, when it differs, the spoken name. */
export interface ShortcutKeyPart {
  label: string;
  spoken?: string;
}
export interface CancelableTimeout {
  start: (delay: number, callback: () => void) => void;
  cancel: () => void;
}
/** A window that can host a resize observer (a document's default view). */
export type ShrinkWrapWindow = Window & typeof globalThis;
export interface ShrinkWrapLineRects {
  rects: DOMRect[];
  left: number;
  right: number;
  /** Overflow hidden by scrolling or clipping, in pixels. */
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
export type ShrinkWrapStage =
  | "read"
  | "verify"
  | "nudge1"
  | "nudge2"
  | "bisect"
  | "settled";
/** When a queued shrink-wrap job should run. */
export type ShrinkWrapSchedule = "microtask" | "resize" | "frame";
/** One shrink-wrap fit in progress for an element. */
export interface ShrinkWrapJob {
  el: HTMLElement;
  /** Called with the fitted width in pixels, or null to keep the natural width. */
  done: (width: number | null) => void;
  boxWidth: number;
  borderBoxSizing: boolean;
  natural: ShrinkWrapLayout | null;
  candidate: number;
  stage: ShrinkWrapStage;
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
export type ShrinkWrapResizeHandler = (entry: ResizeObserverEntry) => void;
export interface ShrinkWrapResizeObservation {
  observer: ResizeObserver;
  handlers: Map<Element, Set<ShrinkWrapResizeHandler>>;
  paused: Set<Element>;
  resumeQueued: number;
}
export interface ShrinkWrapWindowResizeStore {
  refits: Set<() => void>;
  listener: () => void;
}
/** Inputs that decide whether a resize needs a new shrink-wrap fit. */
export interface ShrinkWrapResizeChange {
  /** Whether the observed element is the shrink-wrapped element itself. */
  self: boolean;
  inline: number;
  block: number;
  prevInline: number;
  prevBlock: number;
  applied: number | null;
}
/** Last seen inline and block size of an observed element. */
export interface ShrinkWrapObservedSize {
  inline: number;
  block: number;
}
export interface ShrinkWrapProps extends HTMLAttributes<HTMLDivElement> {
  enabled?: boolean;
  /** Fits synchronously on mount instead of in a microtask. */
  immediate?: boolean;
}
export interface ButtonBackgroundLayerOptions {
  joined?: boolean;
  solid?: boolean;
}
export interface DisabledReasonWrapperProps {
  tabIndex: number;
  "aria-describedby": string | undefined;
  "data-cds-disabled-reason-wrapper": string;
  className: string;
}
export interface DisabledReasonAnnouncementProps {
  id: string;
  reason?: ReactNode;
}
export type TooltipSide = NonNullable<BaseTooltip.Positioner.Props["side"]>;
export type TooltipAlign = NonNullable<BaseTooltip.Positioner.Props["align"]>;
/** Tooltip content that is only built when the tooltip is about to open. */
export type TooltipContentFactory = () => ReactNode;
export interface TooltipSecondaryHint {
  label: ReactNode;
  shortcut: string;
}
export interface TooltipPlacementProps {
  side?: TooltipSide;
  align?: TooltipAlign;
  sideOffset?: number;
  collisionPadding?: CollisionPadding;
  delay?: number;
  hoverable?: boolean;
}
export interface TooltipProps extends TooltipPlacementProps {
  /** Text or nodes to show, or a factory that returns nothing to skip showing. */
  content?: ReactNode | TooltipContentFactory;
  detail?: ReactNode;
  secondaryHint?: TooltipSecondaryHint;
  multiline?: boolean;
  /** Shortcut shown next to the content, in `Shortcut` key syntax. */
  shortcut?: string;
  trackCursorAxis?: BaseTooltip.Root.Props["trackCursorAxis"];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  closeDelay?: number;
  closeOnClick?: boolean;
  /** Mounts the tooltip machinery on first pointer or focus instead of eagerly. */
  lazy?: boolean;
  /** Opens when focus is handed back to the trigger (for example after a menu closes). */
  openOnHandedBackFocus?: boolean;
  triggerRef?: Ref<HTMLElement>;
  container?: HTMLElement | null;
  className?: string;
  children?: ReactNode;
}
export interface DisabledReasonTooltipProps extends TooltipPlacementProps {
  reason?: ReactNode;
  multiline?: boolean;
  className?: string;
  wrapperClassName?: string;
  children?: ReactNode;
}
export interface OverflowTooltipProps
  extends HTMLAttributes<HTMLSpanElement>,
    Omit<TooltipPlacementProps, "sideOffset"> {
  sideOffset?: number;
  lazy?: boolean;
}
export interface TooltipProviderProps {
  delay?: number;
  closeDelay?: number;
  children?: ReactNode;
}
export interface TooltipShortcutProps {
  keys: string;
  className?: string;
}
/** What a tooltip needs to close itself instantly, shared by all open tooltips. */
export interface TooltipCloser {
  closeInstant: () => void;
}
/** Whether a tooltip is open and the content it currently shows. */
export interface TooltipState {
  open: boolean;
  body: ReactNode;
}
export type TooltipStateUpdate = (state: TooltipState) => TooltipState;
/** The tooltip parts other components pick up through context. */
export interface TooltipImplementationParts {
  Tooltip: (props: TooltipProps) => ReactElement;
  DisabledReasonTooltip: (props: DisabledReasonTooltipProps) => ReactElement;
}
export interface TooltipExports extends TooltipImplementationParts {
  useTooltipTrigger: () => boolean;
  useTooltipGroup: () => boolean;
  TooltipImplProvider: (props: { children?: ReactNode }) => ReactElement;
  TooltipGroup: (props: TooltipProviderProps) => ReactElement;
  OverflowTooltip: ForwardRefExoticComponent<
    OverflowTooltipProps & RefAttributes<HTMLSpanElement>
  >;
}
/** Marks "this content factory chose not to show a tooltip". */
declare const tooltipNoShowSymbol: unique symbol;
export type TooltipNoShow = typeof tooltipNoShowSymbol;

declare module "../bindings" {
  interface RuntimeBindings {
    reactForUiAvatars: ReactNamespace;
    jsxForUiAvatars: JsxNamespace;
    CLAUDE_SPARK_PATH: string;
    CLAUDE_CLAY_COLOR: string;
    CLAUDE_CLAY_CSS_COLOR: string;
    SPARK_SIZE_CLASS: string;
    StaticSpark: FunctionComponent<SparkProps>;
    Spark: NamedExoticComponent<SparkProps>;
    initializeUiAvatars: () => void;
    useAvatarStack: () => AvatarStackContextValue | null;
    reactForUiAvatars2: ReactNamespace;
    AvatarStackContext: Context<AvatarStackContextValue | null>;
    initializeUiAvatars2: () => void;
    avatarInitials: (name: string, locale: string | undefined, maxInitials: number) => string;
    reactForUiAvatars3: ReactNamespace;
    jsxForUiAvatars2: JsxNamespace;
    avatarVariants: (props?: AvatarVariantProps) => string;
    Avatar: ForwardRefExoticComponent<AvatarProps & RefAttributes<HTMLSpanElement>>;
    initializeUiAvatars3: () => void;
    getKeycapClasses: (label?: string) => string;
    Shortcut: (props: ShortcutProps) => ReactElement;
    useAppleKeyboard: () => boolean;
    ownPropertyValue: <Value>(record: Record<string, Value>, key: string) => Value | undefined;
    getShortcutKeyLabel: (key: string, isApple: boolean) => string;
    parseShortcutSequence: (sequence: string) => string[];
    parseShortcutChord: (chord: string, isApple: boolean) => ShortcutChord;
    renderShortcutChord: (chord: string, isApple: boolean) => ShortcutKeyPart[];
    shortcutToAriaKeyShortcuts: (shortcut: string, isApple: boolean) => string | undefined;
    reactShortcut: ReactNamespace;
    jsxShortcut: JsxNamespace;
    shortcutKeycapClasses: string;
    singleCharacterKeycapClasses: string;
    multipleCharacterKeycapClasses: string;
    shortcutTextKeyClasses: string;
    shortcutVariantClasses: Record<ShortcutVariant, string>;
    SHORTCUT_SEQUENCE_SEPARATOR: string;
    SHORTCUT_MODIFIER_SEPARATOR: string;
    appleKeyboardUserAgentPattern: RegExp;
    subscribeAppleKeyboardNoop: () => () => void;
    shortcutModifierNames: readonly string[];
    isShortcutModifier: (name: string) => name is ShortcutModifier;
    shortcutModifierOrder: readonly string[];
    appleModifierLabels: Record<ShortcutModifier, string>;
    otherModifierLabels: Record<ShortcutModifier, string>;
    appleKeyLabels: Record<string, string>;
    otherKeyLabels: Record<string, string>;
    appleAriaModifierNames: Record<string, string>;
    otherAriaModifierNames: Record<string, string>;
    initializeShortcuts: () => void;
    isTextRangeClipped: (element: Element) => boolean;
    reactTextClipping: ReactNamespace;
    documentTextRanges: WeakMap<Document, Range>;
    initializeTextClipping: () => void;
    useCancelableTimeout: () => CancelableTimeout;
    reactCancelableTimeout: ReactNamespace;
    initializeCancelableTimeout: () => void;
    writeShrinkWrapWidth: (element: HTMLElement, width: string) => void;
    captureShrinkWrapBaseline: (element: HTMLElement) => void;
    measureShrinkWrapLineRects: (
      element: HTMLElement,
      isWideEnough?: (width: number) => boolean,
    ) => ShrinkWrapLineRects;
    isShrinkWrapAtomicElement: (element: Element, style: CSSStyleDeclaration) => boolean;
    measureShrinkWrapLayout: (element: HTMLElement, lineRects: ShrinkWrapLineRects) => ShrinkWrapLayout;
    shrinkWrapLayoutWorsened: (before: ShrinkWrapLayout, after: ShrinkWrapLayout) => boolean;
    shrinkWrapLayoutImproved: (before: ShrinkWrapLayout, after: ShrinkWrapLayout) => boolean;
    restoreShrinkWrapWidth: (element: HTMLElement) => void;
    createShrinkWrapJob: (element: HTMLElement, done: (width: number | null) => void) => ShrinkWrapJob;
    settleShrinkWrapJob: (job: ShrinkWrapJob, width: number | null) => void;
    readShrinkWrapNaturalLayout: (job: ShrinkWrapJob) => void;
    checkShrinkWrapCandidate: (job: ShrinkWrapJob) => boolean | "shrank";
    advanceShrinkWrapSearch: (job: ShrinkWrapJob, fits: boolean) => number | null;
    runShrinkWrapJobs: (jobs: ShrinkWrapJob[]) => void;
    shrinkWrapSynchronously: (element: HTMLElement) => number | null;
    getShrinkWrapQueue: (view: ShrinkWrapWindow) => ShrinkWrapQueue;
    drainShrinkWrapQueue: (view: ShrinkWrapWindow, queue: ShrinkWrapQueue, jobs: ShrinkWrapJob[]) => void;
    flushShrinkWrapMicrotask: (view: ShrinkWrapWindow) => void;
    flushShrinkWrapResizeJobs: (view: ShrinkWrapWindow) => void;
    enqueueShrinkWrapJob: (
      element: HTMLElement,
      done: (width: number | null) => void,
      schedule: ShrinkWrapSchedule,
    ) => void;
    cancelShrinkWrapJob: (element: HTMLElement) => void;
    shouldRecomputeShrinkWrap: (change: ShrinkWrapResizeChange) => boolean;
    registerShrinkWrapResizeHandler: (
      view: ShrinkWrapWindow,
      element: Element,
      handler: ShrinkWrapResizeHandler,
    ) => void;
    unregisterShrinkWrapResizeHandler: (
      view: ShrinkWrapWindow,
      element: Element,
      handler: ShrinkWrapResizeHandler,
    ) => void;
    pauseShrinkWrapResizeObservation: (view: ShrinkWrapWindow, element: Element) => void;
    subscribeShrinkWrapWindowResize: (fonts: FontFaceSet | undefined, refit: () => void) => () => void;
    observeShrinkWrap: (element: HTMLElement, options?: { immediate?: boolean }) => () => void;
    SHRINK_WRAP_STYLE_PROPERTY: "maxWidth";
    shrinkWrapBaselineWidths: WeakMap<HTMLElement, string>;
    shrinkWrapWrittenWidths: WeakMap<HTMLElement, string>;
    SHRINK_WRAP_MAX_ITERATIONS: number;
    SHRINK_WRAP_ATTRIBUTE: string;
    SHRINK_WRAP_MAX_LINE_RECTS: number;
    shrinkWrapAtomicTags: Set<string>;
    shrinkWrapQueues: WeakMap<ShrinkWrapWindow, ShrinkWrapQueue>;
    shrinkWrapResizeObservers: WeakMap<ShrinkWrapWindow, ShrinkWrapResizeObservation>;
    shrinkWrapWindowResizeStores: WeakMap<FontFaceSet, ShrinkWrapWindowResizeStore>;
    initializeShrinkWrapMeasurement: () => void;
    useShrinkWrapRef: (options?: { enabled?: boolean; immediate?: boolean }) => (element: HTMLElement | null) => void;
    reactShrinkWrap: ReactNamespace;
    jsxShrinkWrap: JsxNamespace;
    ShrinkWrap: ForwardRefExoticComponent<ShrinkWrapProps & RefAttributes<HTMLDivElement>>;
    initializeShrinkWrap: () => void;
    getButtonBackgroundLayerClasses: (options: ButtonBackgroundLayerOptions) => string;
    buttonBackgroundLayerClasses: string;
    buttonFocusClasses: string;
    dangerButtonFocusClasses: string;
    buttonFillLayerClasses: string;
    buttonBackgroundShadowClasses: string;
    buttonJoinedFillClasses: string;
    buttonPressedFillClasses: string;
    secondaryButtonFillClasses: string;
    buttonSolidInsetClasses: string;
    initializeDisabledReasonDebug: () => void;
    getDisabledReasonWrapperProps: (
      reason: ReactNode,
      announcementId: string,
      className?: string,
    ) => DisabledReasonWrapperProps;
    hasDisabledReason: (reason: ReactNode) => boolean;
    DisabledReasonAnnouncement: (props: DisabledReasonAnnouncementProps) => ReactElement;
    reactDisabledReason: ReactNamespace;
    jsxDisabledReason: JsxNamespace;
    disabledReasonFocusClasses: string;
    DISABLED_REASON_ATTRIBUTE: string;
    initializeDisabledReason: () => void;
    DarkTooltipScope: (props: { children?: ReactNode }) => ReactElement;
    jsxTooltipClasses: JsxNamespace;
    tooltipBaseClasses: string;
    singleLineTooltipClasses: string;
    tooltipDetailClasses: string;
    multilineTooltipBaseClasses: string;
    multilineTooltipClasses: string;
    multilineTooltipArrowClass: string;
    initializeTooltipClasses: () => void;
    useTooltipsDisabled: () => boolean;
    reactTooltipContext: ReactNamespace;
    tooltipsDisabledContext: Context<boolean>;
    tooltipImplementationContext: Context<TooltipImplementationParts | null>;
    initializeTooltipContext: () => void;
    tooltipExports: TooltipExports;
    cancelInputDismissingTooltipOpen: (
      open: boolean,
      details: BaseTooltip.Root.ChangeEventDetails,
    ) => boolean;
    closePreviousTooltip: (closer: RefObject<TooltipCloser>) => void;
    isEmptyTooltipContent: (content: unknown) => boolean;
    evaluateTooltipContent: (factory: TooltipContentFactory) => ReactNode | TooltipNoShow;
    TooltipShortcut: (props: TooltipShortcutProps) => ReactElement;
    Tooltip: (props: TooltipProps) => ReactElement;
    DisabledReasonTooltip: (props: DisabledReasonTooltipProps) => ReactElement;
    TooltipImplementationProvider: (props: { children?: ReactNode }) => ReactElement;
    useHasTooltipProvider: () => boolean;
    TooltipProvider: (props: TooltipProviderProps) => ReactElement;
    reactTooltip: ReactNamespace;
    jsxTooltip: JsxNamespace;
    activeTooltipActionsRef: RefObject<TooltipCloser> | null;
    TOOLTIP_NO_SHOW: TooltipNoShow;
    closedTooltipState: TooltipState;
    openTooltipState: TooltipStateUpdate;
    closeTooltipState: TooltipStateUpdate;
    clearTooltipBody: TooltipStateUpdate;
    openTooltipWithBody: (body: ReactNode) => TooltipStateUpdate;
    replaceTooltipBody: (body: ReactNode) => TooltipStateUpdate;
    resetTooltipState: TooltipStateUpdate;
    tooltipSingleLineClasses: string;
    tooltipTextBalanceClass: string;
    tooltipSecondaryDetailClasses: string;
    tooltipContentRowClasses: string;
    tooltipContentAlignmentClass: string;
    tooltipMultilineBodyClasses: string;
    OverflowTooltip: TooltipExports["OverflowTooltip"];
    defaultTooltipImplementation: TooltipImplementationParts;
    tooltipProviderContext: Context<boolean>;
    initializeTooltip: () => void;
  }
}

export function installUiAvatars(runtime: RuntimeBindings): () => void {
  var reactForUiAvatars: ReactNamespace;
  var jsxForUiAvatars: JsxNamespace;
  var CLAUDE_SPARK_PATH: RuntimeBindings["CLAUDE_SPARK_PATH"];
  var CLAUDE_CLAY_COLOR: RuntimeBindings["CLAUDE_CLAY_COLOR"];
  var CLAUDE_CLAY_CSS_COLOR: RuntimeBindings["CLAUDE_CLAY_CSS_COLOR"];
  var SPARK_SIZE_CLASS: RuntimeBindings["SPARK_SIZE_CLASS"];
  var StaticSpark: RuntimeBindings["StaticSpark"];
  var Spark: RuntimeBindings["Spark"];
  var initializeUiAvatars: RuntimeBindings["initializeUiAvatars"];
  var reactForUiAvatars2: ReactNamespace;
  var AvatarStackContext: RuntimeBindings["AvatarStackContext"];
  var initializeUiAvatars2: RuntimeBindings["initializeUiAvatars2"];
  var reactForUiAvatars3: ReactNamespace;
  var jsxForUiAvatars2: JsxNamespace;
  var avatarVariants: RuntimeBindings["avatarVariants"];
  var Avatar: RuntimeBindings["Avatar"];
  var initializeUiAvatars3: RuntimeBindings["initializeUiAvatars3"];
  var reactShortcut: ReactNamespace;
  var jsxShortcut: JsxNamespace;
  var shortcutKeycapClasses: RuntimeBindings["shortcutKeycapClasses"];
  var singleCharacterKeycapClasses: RuntimeBindings["singleCharacterKeycapClasses"];
  var multipleCharacterKeycapClasses: RuntimeBindings["multipleCharacterKeycapClasses"];
  var shortcutTextKeyClasses: RuntimeBindings["shortcutTextKeyClasses"];
  var shortcutVariantClasses: RuntimeBindings["shortcutVariantClasses"];
  var SHORTCUT_SEQUENCE_SEPARATOR: RuntimeBindings["SHORTCUT_SEQUENCE_SEPARATOR"];
  var SHORTCUT_MODIFIER_SEPARATOR: RuntimeBindings["SHORTCUT_MODIFIER_SEPARATOR"];
  var appleKeyboardUserAgentPattern: RuntimeBindings["appleKeyboardUserAgentPattern"];
  var subscribeAppleKeyboardNoop: RuntimeBindings["subscribeAppleKeyboardNoop"];
  var shortcutModifierNames: RuntimeBindings["shortcutModifierNames"];
  var isShortcutModifier: RuntimeBindings["isShortcutModifier"];
  var shortcutModifierOrder: RuntimeBindings["shortcutModifierOrder"];
  var appleModifierLabels: RuntimeBindings["appleModifierLabels"];
  var otherModifierLabels: RuntimeBindings["otherModifierLabels"];
  var appleKeyLabels: RuntimeBindings["appleKeyLabels"];
  var otherKeyLabels: RuntimeBindings["otherKeyLabels"];
  var appleAriaModifierNames: RuntimeBindings["appleAriaModifierNames"];
  var otherAriaModifierNames: RuntimeBindings["otherAriaModifierNames"];
  var initializeShortcuts: RuntimeBindings["initializeShortcuts"];
  var reactTextClipping: ReactNamespace;
  var documentTextRanges: RuntimeBindings["documentTextRanges"];
  var initializeTextClipping: RuntimeBindings["initializeTextClipping"];
  var reactCancelableTimeout: ReactNamespace;
  var initializeCancelableTimeout: RuntimeBindings["initializeCancelableTimeout"];
  var SHRINK_WRAP_STYLE_PROPERTY: RuntimeBindings["SHRINK_WRAP_STYLE_PROPERTY"];
  var shrinkWrapBaselineWidths: RuntimeBindings["shrinkWrapBaselineWidths"];
  var shrinkWrapWrittenWidths: RuntimeBindings["shrinkWrapWrittenWidths"];
  var SHRINK_WRAP_MAX_ITERATIONS: RuntimeBindings["SHRINK_WRAP_MAX_ITERATIONS"];
  var SHRINK_WRAP_ATTRIBUTE: RuntimeBindings["SHRINK_WRAP_ATTRIBUTE"];
  var SHRINK_WRAP_MAX_LINE_RECTS: RuntimeBindings["SHRINK_WRAP_MAX_LINE_RECTS"];
  var shrinkWrapAtomicTags: RuntimeBindings["shrinkWrapAtomicTags"];
  var shrinkWrapQueues: RuntimeBindings["shrinkWrapQueues"];
  var shrinkWrapResizeObservers: RuntimeBindings["shrinkWrapResizeObservers"];
  var shrinkWrapWindowResizeStores: RuntimeBindings["shrinkWrapWindowResizeStores"];
  var initializeShrinkWrapMeasurement: RuntimeBindings["initializeShrinkWrapMeasurement"];
  var reactShrinkWrap: ReactNamespace;
  var jsxShrinkWrap: JsxNamespace;
  var ShrinkWrap: RuntimeBindings["ShrinkWrap"];
  var initializeShrinkWrap: RuntimeBindings["initializeShrinkWrap"];
  var buttonBackgroundLayerClasses: RuntimeBindings["buttonBackgroundLayerClasses"];
  var buttonFocusClasses: RuntimeBindings["buttonFocusClasses"];
  var dangerButtonFocusClasses: RuntimeBindings["dangerButtonFocusClasses"];
  var buttonFillLayerClasses: RuntimeBindings["buttonFillLayerClasses"];
  var buttonBackgroundShadowClasses: RuntimeBindings["buttonBackgroundShadowClasses"];
  var buttonJoinedFillClasses: RuntimeBindings["buttonJoinedFillClasses"];
  var buttonPressedFillClasses: RuntimeBindings["buttonPressedFillClasses"];
  var secondaryButtonFillClasses: RuntimeBindings["secondaryButtonFillClasses"];
  var buttonSolidInsetClasses: RuntimeBindings["buttonSolidInsetClasses"];
  var initializeDisabledReasonDebug: RuntimeBindings["initializeDisabledReasonDebug"];
  var reactDisabledReason: ReactNamespace;
  var jsxDisabledReason: JsxNamespace;
  var disabledReasonFocusClasses: RuntimeBindings["disabledReasonFocusClasses"];
  var DISABLED_REASON_ATTRIBUTE: RuntimeBindings["DISABLED_REASON_ATTRIBUTE"];
  var initializeDisabledReason: RuntimeBindings["initializeDisabledReason"];
  var jsxTooltipClasses: JsxNamespace;
  var tooltipBaseClasses: RuntimeBindings["tooltipBaseClasses"];
  var singleLineTooltipClasses: RuntimeBindings["singleLineTooltipClasses"];
  var tooltipDetailClasses: RuntimeBindings["tooltipDetailClasses"];
  var multilineTooltipBaseClasses: RuntimeBindings["multilineTooltipBaseClasses"];
  var multilineTooltipClasses: RuntimeBindings["multilineTooltipClasses"];
  var multilineTooltipArrowClass: RuntimeBindings["multilineTooltipArrowClass"];
  var initializeTooltipClasses: RuntimeBindings["initializeTooltipClasses"];
  var reactTooltipContext: ReactNamespace;
  var tooltipsDisabledContext: RuntimeBindings["tooltipsDisabledContext"];
  var tooltipImplementationContext: RuntimeBindings["tooltipImplementationContext"];
  var initializeTooltipContext: RuntimeBindings["initializeTooltipContext"];
  var tooltipExports: RuntimeBindings["tooltipExports"];
  var reactTooltip: ReactNamespace;
  var jsxTooltip: JsxNamespace;
  var activeTooltipActionsRef: RuntimeBindings["activeTooltipActionsRef"];
  var TOOLTIP_NO_SHOW: RuntimeBindings["TOOLTIP_NO_SHOW"];
  var closedTooltipState: RuntimeBindings["closedTooltipState"];
  var openTooltipState: RuntimeBindings["openTooltipState"];
  var closeTooltipState: RuntimeBindings["closeTooltipState"];
  var clearTooltipBody: RuntimeBindings["clearTooltipBody"];
  var openTooltipWithBody: RuntimeBindings["openTooltipWithBody"];
  var replaceTooltipBody: RuntimeBindings["replaceTooltipBody"];
  var resetTooltipState: RuntimeBindings["resetTooltipState"];
  var tooltipSingleLineClasses: RuntimeBindings["tooltipSingleLineClasses"];
  var tooltipTextBalanceClass: RuntimeBindings["tooltipTextBalanceClass"];
  var tooltipSecondaryDetailClasses: RuntimeBindings["tooltipSecondaryDetailClasses"];
  var tooltipContentRowClasses: RuntimeBindings["tooltipContentRowClasses"];
  var tooltipContentAlignmentClass: RuntimeBindings["tooltipContentAlignmentClass"];
  var tooltipMultilineBodyClasses: RuntimeBindings["tooltipMultilineBodyClasses"];
  var OverflowTooltip: RuntimeBindings["OverflowTooltip"];
  var defaultTooltipImplementation: RuntimeBindings["defaultTooltipImplementation"];
  var tooltipProviderContext: RuntimeBindings["tooltipProviderContext"];
  var initializeTooltip: RuntimeBindings["initializeTooltip"];
  function useAvatarStack() {
    return reactForUiAvatars2.useContext(AvatarStackContext);
  }
  function avatarInitials(
    name: string,
    locale: string | undefined,
    maxInitials: number,
  ) {
    let value = name.trim().split(/\s+/),
      callback = (input?: string) =>
        input ? ([...input][0] ?? "") : "";
    return (
      (
        callback(value[0]) +
        (maxInitials === 2 && value.length > 1
          ? callback(value[value.length - 1])
          : "")
      ).toLocaleUpperCase(locale) || "?"
    );
  }
  function getKeycapClasses(input?: string) {
    return `${shortcutKeycapClasses} ${Array.from(input ?? "").length === 1 ? singleCharacterKeycapClasses : multipleCharacterKeycapClasses}`;
  }
  function Shortcut({
    keys: keys,
    variant = "keycap",
    onFill = false,
    className: className,
    ...props
  }: ShortcutProps): ReactElement {
    let value = useAppleKeyboard(),
      value2 = (0, runtime.useTranslation)(
        "sequenceThen",
        SHORTCUT_SEQUENCE_SEPARATOR,
      ),
      value3 = parseShortcutSequence(keys).map(
        (input) => renderShortcutChord(input, value),
      ),
      value4 = variant === "text" && !value;
    return jsxShortcut.jsx("span", {
      ...props,
      "data-cds": "Shortcut",
      "data-variant": variant,
      className: (0, runtime.cn)(
        shortcutVariantClasses[variant],
        onFill && "[--cds-shortcut-cap-ink:currentColor]",
        className,
      ),
      children: value3.map(
        (input, options) =>
          jsxShortcut.jsxs(
            reactShortcut.Fragment,
            {
              children: [
                options > 0 &&
                  jsxShortcut.jsx("span", {
                    className: "px-[2px] [color:var(--cds-shortcut-cap-ink)]",
                    children: value2,
                  }),
                input.map(
                  (
                    { label: label, spoken: spoken },
                    options2,
                  ) =>
                    jsxShortcut.jsxs(
                      reactShortcut.Fragment,
                      {
                        children: [
                          value4 &&
                            options2 > 0 &&
                            jsxShortcut.jsx("span", {
                              className:
                                "mx-[-0.3em] [color:var(--cds-shortcut-cap-ink)]",
                              children: SHORTCUT_MODIFIER_SEPARATOR,
                            }),
                          jsxShortcut.jsx("kbd", {
                            className:
                              variant === "text"
                                ? shortcutTextKeyClasses
                                : getKeycapClasses(label),
                            children:
                              spoken === undefined
                                ? label
                                : value4
                                  ? spoken
                                  : jsxShortcut.jsxs(jsxShortcut.Fragment, {
                                      children: [
                                        jsxShortcut.jsx("span", {
                                          "aria-hidden": "true",
                                          children: label,
                                        }),
                                        jsxShortcut.jsx("span", {
                                          className: "sr-only select-none",
                                          children: spoken,
                                        }),
                                      ],
                                    }),
                          }),
                        ],
                      },
                      options2,
                    ),
                ),
              ],
            },
            options,
          ),
      ),
    });
  }
  function useAppleKeyboard() {
    return reactShortcut.useSyncExternalStore(
      subscribeAppleKeyboardNoop,
      () => appleKeyboardUserAgentPattern.test(navigator.userAgent),
      () => false,
    );
  }
  function ownPropertyValue<Value>(input: Record<string, Value>, options: string): Value | undefined {
    if (Object.hasOwn(input, options)) {
      return input[options];
    } else {
      return undefined;
    }
  }
  function getShortcutKeyLabel(items: string, options: boolean): string {
    let value = ownPropertyValue(
      options ? appleKeyLabels : otherKeyLabels,
      items,
    );
    if (value !== undefined) {
      return value;
    }
    if (/^f\d+$/.test(items)) {
      return items.toUpperCase();
    }
    if (items.length === 1) {
      return items.toUpperCase();
    }
    return items.charAt(0).toUpperCase() + items.slice(1);
  }
  function parseShortcutSequence(input: string): string[] {
    let value = input.trim().replace(/\s*\+\s*/g, "+");
    if (value) {
      return value.split(/\s+/);
    } else {
      return [];
    }
  }
  function parseShortcutChord(input: string, options: boolean): ShortcutChord {
    let value = input
        .toLowerCase()
        .split("+")
        .map((input2) => input2.trim())
        .filter((input2) => input2 !== ""),
      items: ShortcutModifier[] = [],
      items2: string[] = [];
    for (let value2 of value)
      if (isShortcutModifier(value2)) {
        items.push(value2);
      } else {
        items2.push(value2);
      }
    let callback = (input2: string) =>
      shortcutModifierOrder.indexOf(
        !options &&
          (input2 === "cmd" || input2 === "command" || input2 === "meta")
          ? "ctrl"
          : input2,
      );
    items.sort(
      (input2, options2) =>
        callback(input2) - callback(options2),
    );
    return {
      modifiers: items,
      keys: items2,
    };
  }
  function renderShortcutChord(input: string, options: boolean): ShortcutKeyPart[] {
    let { modifiers: value, keys: value2 } = parseShortcutChord(
        input,
        options,
      ),
      value3 = options ? appleModifierLabels : otherModifierLabels,
      callback = (input2: string, options2: string): ShortcutKeyPart => {
        if (/^[A-Za-z0-9 ]+$/.test(options2)) {
          return {
            label: options2,
          };
        }
        let value4 = ownPropertyValue(appleAriaModifierNames, input2);
        if (value4 === undefined) {
          return {
            label: options2,
          };
        } else {
          return {
            label: options2,
            spoken: value4,
          };
        }
      };
    return [
      ...value.map(
        (input2) => callback(input2, value3[input2]),
      ),
      ...value2.map(
        (input2) =>
          callback(input2, getShortcutKeyLabel(input2, options)),
      ),
    ];
  }
  function shortcutToAriaKeyShortcuts(
    input: string,
    options: boolean,
  ) {
    let [value, ...value2] = parseShortcutSequence(input);
    if (value === undefined || value2.length > 0) {
      return;
    }
    let { modifiers: value3, keys: value4 } = parseShortcutChord(
      value,
      options,
    );
    if (value4.length !== 1) {
      return;
    }
    let value5 = options ? "Meta" : "Control",
      callback = (items: string): string =>
        items === "cmd" || items === "command" || items === "meta"
          ? value5
          : (ownPropertyValue(otherAriaModifierNames, items) ??
            (/^f\d+$/.test(items)
              ? items.toUpperCase()
              : items.length === 1
                ? items
                : items.charAt(0).toUpperCase() + items.slice(1)));
    return [...value3, ...value4].map(callback).join("+");
  }
  function isTextRangeClipped(element: Element): boolean {
    let ownerDocument = element.ownerDocument,
      entry = documentTextRanges.get(ownerDocument);
    if (entry === undefined) {
      entry = ownerDocument.createRange();
      documentTextRanges.set(ownerDocument, entry);
    }
    entry.selectNodeContents(element);
    let value = entry.getBoundingClientRect?.();
    entry.setStart(ownerDocument, 0);
    entry.collapse(true);
    if (value === undefined || value.width === 0) {
      return false;
    }
    let bounds = element.getBoundingClientRect();
    return value.right - bounds.right > 0.1 || bounds.left - value.left > 0.1;
  }
  function useCancelableTimeout() {
    let ref = reactCancelableTimeout.useRef<number | undefined>(undefined),
      callback = reactCancelableTimeout.useCallback(() => {
        window.clearTimeout(ref.current);
        ref.current = undefined;
      }, []),
      callback2 = reactCancelableTimeout.useCallback(
        (input: number, options: () => void) => {
          callback();
          ref.current = window.setTimeout(options, input);
        },
        [callback],
      );
    reactCancelableTimeout.useEffect(() => callback, [callback]);
    return reactCancelableTimeout.useMemo(
      () => ({
        start: callback2,
        cancel: callback,
      }),
      [callback2, callback],
    );
  }
  function writeShrinkWrapWidth(input: HTMLElement, options: string) {
    input.style[SHRINK_WRAP_STYLE_PROPERTY] = options;
    shrinkWrapWrittenWidths.set(input, options);
  }
  function captureShrinkWrapBaseline(input: HTMLElement) {
    let value = input.style[SHRINK_WRAP_STYLE_PROPERTY];
    if (
      !shrinkWrapBaselineWidths.has(input) ||
      value !== shrinkWrapWrittenWidths.get(input)
    ) {
      shrinkWrapBaselineWidths.set(input, value);
    }
  }
  function measureShrinkWrapLineRects(
    element: HTMLElement,
    options?: (width: number) => boolean,
  ) {
    let ownerDocument = element.ownerDocument,
      defaultView = ownerDocument.defaultView,
      items: DOMRect[] = [],
      POSITIVE_INFINITY = Number.POSITIVE_INFINITY,
      NEGATIVE_INFINITY = Number.NEGATIVE_INFINITY,
      callback = (input: DOMRect) => {
        items.push(input);
        if (input.left < POSITIVE_INFINITY) {
          POSITIVE_INFINITY = input.left;
        }
        if (input.right > NEGATIVE_INFINITY) {
          NEGATIVE_INFINITY = input.right;
        }
      },
      index = 0,
      POSITIVE_INFINITY2 = Number.POSITIVE_INFINITY,
      NEGATIVE_INFINITY2 = Number.NEGATIVE_INFINITY,
      callback2 = (input: DOMRect) => {
        if (input.left < POSITIVE_INFINITY2) {
          POSITIVE_INFINITY2 = input.left;
        }
        if (input.right > NEGATIVE_INFINITY2) {
          NEGATIVE_INFINITY2 = input.right;
        }
      },
      callback3 = (input: Node): boolean => {
        for (
          let value4 =
            input.nodeType === 1 ? (input as Element) : input.parentElement;
          value4 && value4 !== element;
          value4 = value4.parentElement
        )
          if (value4.getAttribute("data-shrinkwrap") === "fill") {
            return true;
          }
        return false;
      },
      value = ownerDocument.createRange(),
      value2 = ownerDocument.createTreeWalker(element, 5, {
        acceptNode: (input: Node): number => {
          if (input.nodeType === 1) {
            let value4 = defaultView?.getComputedStyle(input as Element);
            if (
              value4 &&
              (value4.display === "none" ||
                value4.position === "absolute" ||
                value4.position === "fixed")
            ) {
              return 2;
            }
            return 1;
          }
          if (callback3(input)) {
            return 2;
          } else {
            return 1;
          }
        },
      }),
      value3 = value2.nextNode();
    while (value3) {
      if (value3.nodeType === 3) {
        value.selectNodeContents(value3);
        for (let value4 of (value.getClientRects?.() ?? []))
          if (value4.width > 0) {
            callback(value4);
            callback2(value4);
          }
      } else {
        let value4 = value3 as HTMLElement,
          value5 = defaultView?.getComputedStyle(value4),
          bounds = value4.getBoundingClientRect();
        if (bounds.width > 0) {
          callback2(bounds);
        }
        if (
          value5 &&
          !callback3(value4) &&
          isShrinkWrapAtomicElement(value4, value5)
        ) {
          for (let value6 of value4.getClientRects())
            if (value6.width > 0) {
              callback(value6);
            }
        }
        if (
          value5 &&
          (value5.overflowX !== "visible" || value5.overflowY !== "visible")
        ) {
          index +=
            Math.max(0, value4.scrollWidth - value4.clientWidth) +
            Math.max(0, value4.scrollHeight - value4.clientHeight);
        }
      }
      if (
        options &&
        NEGATIVE_INFINITY > POSITIVE_INFINITY &&
        options(NEGATIVE_INFINITY - POSITIVE_INFINITY)
      ) {
        break;
      }
      value3 = value2.nextNode();
    }
    return {
      rects: items,
      left: POSITIVE_INFINITY,
      right: NEGATIVE_INFINITY,
      clipped: index,
      boundLeft: POSITIVE_INFINITY2,
      boundRight: NEGATIVE_INFINITY2,
    };
  }
  function isShrinkWrapAtomicElement(
    input: Element,
    options: CSSStyleDeclaration,
  ) {
    if (shrinkWrapAtomicTags.has(input.tagName.toUpperCase())) {
      return true;
    }
    return options.display.startsWith("inline");
  }
  function measureShrinkWrapLayout(
    element: HTMLElement,
    {
      rects: rects,
      clipped: clipped,
      boundLeft: boundLeft,
      boundRight: boundRight,
    }: ShrinkWrapLineRects,
  ): ShrinkWrapLayout {
    let value =
        element.ownerDocument.defaultView?.getComputedStyle(element),
      bounds = element.getBoundingClientRect(),
      index = 0;
    if (value && Number.isFinite(boundLeft)) {
      let value2 = parseFloat(value.width),
        value3 =
          value.boxSizing === "border-box"
            ? value2
            : value2 +
              parseFloat(value.paddingLeft) +
              parseFloat(value.paddingRight) +
              parseFloat(value.borderLeftWidth) +
              parseFloat(value.borderRightWidth),
        value4 = value3 > 0 ? bounds.width / value3 || 1 : 1,
        value5 =
          bounds.left +
          (parseFloat(value.borderLeftWidth) + parseFloat(value.paddingLeft)) *
            value4,
        value6 =
          bounds.right -
          (parseFloat(value.borderRightWidth) +
            parseFloat(value.paddingRight)) *
            value4;
      index =
        Math.max(0, boundRight - value6) + Math.max(0, value5 - boundLeft);
    }
    return {
      height: element.scrollHeight,
      overflow: element.scrollWidth,
      client: element.clientWidth,
      spill: index,
      clipped: clipped,
      widths: rects.map((input) => input.width),
    };
  }
  function shrinkWrapLayoutWorsened(
    input: ShrinkWrapLayout,
    options: ShrinkWrapLayout,
  ) {
    if (
      options.height > input.height ||
      options.overflow > options.client + 0.5 ||
      options.spill > input.spill + 0.5 ||
      options.clipped > input.clipped + 0.5
    ) {
      return false;
    }
    return (
      input.widths.length === options.widths.length &&
      input.widths.every(
        (input2, options2) =>
          Math.abs(input2 - (options.widths[options2] ?? NaN)) <= 0.5,
      )
    );
  }
  function shrinkWrapLayoutImproved(
    input: ShrinkWrapLayout,
    options: ShrinkWrapLayout,
  ) {
    return (
      (options.height < input.height ||
        options.clipped < input.clipped - 0.5) &&
      input.widths.length === options.widths.length &&
      input.widths.every(
        (input2, options2) =>
          Math.abs(input2 - (options.widths[options2] ?? NaN)) <= 0.5,
      )
    );
  }
  function restoreShrinkWrapWidth(input: HTMLElement) {
    if (!shrinkWrapBaselineWidths.has(input)) {
      return;
    }
    captureShrinkWrapBaseline(input);
    writeShrinkWrapWidth(input, shrinkWrapBaselineWidths.get(input) ?? "");
  }
  function createShrinkWrapJob(input: HTMLElement, options: (width: number | null) => void): ShrinkWrapJob {
    return {
      el: input,
      done: options,
      boxWidth: 0,
      borderBoxSizing: true,
      natural: null,
      candidate: 0,
      stage: "read",
      lo: 0,
      hi: 0,
      probes: 0,
      resizeDue: false,
    };
  }
  function settleShrinkWrapJob(input: ShrinkWrapJob, options: number | null) {
    if (options === null) {
      restoreShrinkWrapWidth(input.el);
    } else {
      writeShrinkWrapWidth(input.el, `${options}px`);
    }
    input.stage = "settled";
    input.done(options);
  }
  function readShrinkWrapNaturalLayout(input: ShrinkWrapJob) {
    let { el: value } = input,
      defaultView = value.ownerDocument.defaultView;
    if (!defaultView || typeof value.getBoundingClientRect !== "function") {
      settleShrinkWrapJob(input, null);
      return;
    }
    let style = defaultView.getComputedStyle(value),
      value2 = parseFloat(style.width);
    if (!Number.isFinite(value2) || value2 <= 0) {
      settleShrinkWrapJob(input, null);
      return;
    }
    let value3 = style.boxSizing === "border-box",
      value4 =
        parseFloat(style.paddingLeft) +
        parseFloat(style.paddingRight) +
        parseFloat(style.borderLeftWidth) +
        parseFloat(style.borderRightWidth),
      value5 = value3 ? value2 : value2 + value4,
      value6 = value.getBoundingClientRect().width / value5 || 1,
      callback = (input2: number) => {
        let value9 = input2 / value6;
        return Math.ceil((value3 ? value9 + value4 : value9) - 0.001);
      },
      callback2 = (input2: number) =>
        callback(input2) >= value2 - 0.5,
      value7 = measureShrinkWrapLineRects(value, callback2);
    if (value7.rects.length === 0) {
      settleShrinkWrapJob(input, null);
      return;
    }
    let value8 = value7.right - value7.left;
    if (callback2(value8)) {
      settleShrinkWrapJob(input, null);
      return;
    }
    input.natural = measureShrinkWrapLayout(value, value7);
    input.boxWidth = value2;
    input.borderBoxSizing = value3;
    input.candidate = callback(value8);
    input.stage = "verify";
  }
  function checkShrinkWrapCandidate(input: ShrinkWrapJob): boolean | "shrank" {
    if (input.natural === null) {
      return false;
    }
    let value = measureShrinkWrapLayout(
      input.el,
      measureShrinkWrapLineRects(input.el),
    );
    if (shrinkWrapLayoutImproved(input.natural, value)) {
      return "shrank";
    } else {
      return shrinkWrapLayoutWorsened(input.natural, value);
    }
  }
  function advanceShrinkWrapSearch(
    input: ShrinkWrapJob,
    options: boolean,
  ): number | null {
    let { boxWidth: value } = input;
    if (input.stage === "verify") {
      if (options) {
        settleShrinkWrapJob(input, input.candidate);
        return null;
      }
      input.stage = "nudge1";
      if (input.candidate + 1 < value) {
        return input.candidate + 1;
      }
      input.stage = "bisect";
    } else if (input.stage === "nudge1") {
      if (options) {
        settleShrinkWrapJob(input, input.candidate + 1);
        return null;
      }
      input.stage = "nudge2";
      if (input.candidate + 2 < value) {
        return input.candidate + 2;
      }
      input.stage = "bisect";
    } else if (input.stage === "nudge2") {
      if (options) {
        settleShrinkWrapJob(input, input.candidate + 2);
        return null;
      }
      input.stage = "bisect";
    } else if (input.stage === "bisect") {
      input.probes += 1;
      let value2 =
        input.lo > 0 ? Math.floor((input.lo + input.hi) / 2) : NaN;
      if (options) {
        input.hi = value2;
      } else {
        input.lo = value2;
      }
    }
    if (input.stage === "bisect") {
      if (input.lo === 0) {
        input.lo = input.candidate + 2;
        input.hi = Math.ceil(value);
      }
      if (
        input.probes >= SHRINK_WRAP_MAX_ITERATIONS ||
        input.hi - input.lo <= 1
      ) {
        if (input.hi < value - 0.5) {
          settleShrinkWrapJob(input, input.hi);
        } else {
          settleShrinkWrapJob(input, null);
        }
        return null;
      }
      return Math.floor((input.lo + input.hi) / 2);
    }
    return null;
  }
  function runShrinkWrapJobs(input: ShrinkWrapJob[]) {
    for (let value2 of input) {
      captureShrinkWrapBaseline(value2.el);
      restoreShrinkWrapWidth(value2.el);
    }
    for (let value2 of input) readShrinkWrapNaturalLayout(value2);
    let value = input.filter(
      (input2) => input2.stage === "verify",
    );
    for (let value2 of value)
      writeShrinkWrapWidth(value2.el, `${value2.candidate}px`);
    for (let index = 0; value.length > 0 && index < 16; index++) {
      let value2 = value.map(
          (input2): [ShrinkWrapJob, boolean | "shrank"] => [
            input2,
            checkShrinkWrapCandidate(input2),
          ],
        ),
        items: [ShrinkWrapJob, number][] = [];
      for (let [value3, value4] of value2) {
        if (value4 === "shrank") {
          settleShrinkWrapJob(value3, null);
          continue;
        }
        let value5 = advanceShrinkWrapSearch(value3, value4);
        if (value5 !== null) {
          items.push([value3, value5]);
        }
      }
      for (let [value3, value4] of items)
        writeShrinkWrapWidth(value3.el, `${value4}px`);
      value = items.map(([input2]) => input2);
    }
    for (let value2 of value)
      if (value2.stage !== "settled") {
        settleShrinkWrapJob(value2, null);
      }
  }
  function shrinkWrapSynchronously(input: HTMLElement): number | null {
    let value: number | null = null;
    runShrinkWrapJobs([
      createShrinkWrapJob(input, (input2) => {
        value = input2;
      }),
    ]);
    return value;
  }
  function getShrinkWrapQueue(input: ShrinkWrapWindow): ShrinkWrapQueue {
    let entry = shrinkWrapQueues.get(input);
    if (!entry) {
      entry = {
        queue: new Map(),
        microtaskQueued: false,
        frameQueued: 0,
      };
      shrinkWrapQueues.set(input, entry);
    }
    return entry;
  }
  function drainShrinkWrapQueue(
    input: ShrinkWrapWindow,
    options: ShrinkWrapQueue,
    items: ShrinkWrapJob[],
  ) {
    if (items.length > 0) {
      runShrinkWrapJobs(items);
    }
    if (options.queue.size > 0) {
      return;
    }
    if (options.frameQueued) {
      input.cancelAnimationFrame(options.frameQueued);
      options.frameQueued = 0;
    }
    if (!options.microtaskQueued) {
      shrinkWrapQueues.delete(input);
    }
  }
  function flushShrinkWrapMicrotask(input: ShrinkWrapWindow) {
    let entry = shrinkWrapQueues.get(input);
    if (!entry) {
      return;
    }
    entry.microtaskQueued = false;
    if (entry.frameQueued) {
      input.cancelAnimationFrame(entry.frameQueued);
      entry.frameQueued = 0;
    }
    let items = [...entry.queue.values()];
    entry.queue.clear();
    drainShrinkWrapQueue(input, entry, items);
  }
  function flushShrinkWrapResizeJobs(input: ShrinkWrapWindow) {
    let entry = shrinkWrapQueues.get(input);
    if (!entry) {
      return;
    }
    let items: ShrinkWrapJob[] = [];
    for (let [value, value2] of entry.queue)
      if (value2.resizeDue) {
        entry.queue.delete(value);
        items.push(value2);
      }
    drainShrinkWrapQueue(input, entry, items);
  }
  function enqueueShrinkWrapJob(
    element: HTMLElement,
    options: (width: number | null) => void,
    context: ShrinkWrapSchedule,
  ) {
    let defaultView = element.ownerDocument.defaultView;
    if (!defaultView) {
      options(shrinkWrapSynchronously(element));
      return;
    }
    let value = getShrinkWrapQueue(defaultView),
      entry = value.queue.get(element);
    if (entry) {
      entry.done = options;
    } else {
      entry = createShrinkWrapJob(element, options);
      value.queue.set(element, entry);
    }
    if (context === "microtask") {
      if (!value.microtaskQueued) {
        value.microtaskQueued = true;
        queueMicrotask(() => {
          flushShrinkWrapMicrotask(defaultView);
        });
      }
    } else if (context === "resize") {
      entry.resizeDue = true;
    } else if (!value.frameQueued && !value.microtaskQueued) {
      value.frameQueued = defaultView.requestAnimationFrame(() => {
        flushShrinkWrapMicrotask(defaultView);
      });
    }
  }
  function cancelShrinkWrapJob(element: HTMLElement) {
    let defaultView = element.ownerDocument.defaultView;
    if (!defaultView) {
      return;
    }
    let entry = shrinkWrapQueues.get(defaultView);
    if (!entry) {
      return;
    }
    entry.queue.delete(element);
    drainShrinkWrapQueue(defaultView, entry, []);
  }
  function shouldRecomputeShrinkWrap(input: ShrinkWrapResizeChange): boolean {
    if (input.self) {
      let value =
        input.applied !== null && Math.abs(input.inline - input.applied) <= 1;
      return (
        Math.abs(input.block - input.prevBlock) > 1 ||
        (!value && Math.abs(input.inline - input.prevInline) > 1)
      );
    }
    return Math.abs(input.inline - input.prevInline) > 1;
  }
  function registerShrinkWrapResizeHandler(
    input: ShrinkWrapWindow,
    options: Element,
    context: ShrinkWrapResizeHandler,
  ) {
    let entry = shrinkWrapResizeObservers.get(input);
    if (!entry) {
      let entries = new Map<Element, Set<ShrinkWrapResizeHandler>>();
      entry = {
        observer: new input.ResizeObserver((input2) => {
          for (let value of input2)
            for (let value2 of (entries.get(value.target) ?? []))
              value2(value);
          flushShrinkWrapResizeJobs(input);
        }),
        handlers: entries,
        paused: new Set(),
        resumeQueued: 0,
      };
      shrinkWrapResizeObservers.set(input, entry);
    }
    let entry2 = entry.handlers.get(options);
    if (!entry2) {
      try {
        entry.observer.observe(options);
      } catch (value: unknown) {
        if (entry.handlers.size === 0) {
          shrinkWrapResizeObservers.delete(input);
        }
        throw value;
      }
      entry2 = new Set();
      entry.handlers.set(options, entry2);
    }
    entry2.add(context);
  }
  function unregisterShrinkWrapResizeHandler(
    input: ShrinkWrapWindow,
    options: Element,
    context: ShrinkWrapResizeHandler,
  ) {
    let entry = shrinkWrapResizeObservers.get(input),
      value = entry?.handlers.get(options);
    if (!entry || !value) {
      return;
    }
    value.delete(context);
    if (value.size === 0) {
      entry.handlers.delete(options);
      entry.paused.delete(options);
      entry.observer.unobserve(options);
    }
    if (entry.handlers.size === 0) {
      entry.observer.disconnect();
      if (entry.resumeQueued) {
        input.cancelAnimationFrame(entry.resumeQueued);
      }
      shrinkWrapResizeObservers.delete(input);
    }
  }
  function pauseShrinkWrapResizeObservation(
    input: ShrinkWrapWindow,
    options: Element,
  ) {
    let entry = shrinkWrapResizeObservers.get(input);
    if (!entry || !entry.handlers.has(options) || entry.paused.has(options)) {
      return;
    }
    entry.observer.unobserve(options);
    entry.paused.add(options);
    if (!entry.resumeQueued) {
      entry.resumeQueued = input.requestAnimationFrame(() => {
        entry.resumeQueued = 0;
        for (let value of entry.paused)
          if (entry.handlers.has(value)) {
            entry.observer.observe(value);
          }
        entry.paused.clear();
      });
    }
  }
  function subscribeShrinkWrapWindowResize(
    input: FontFaceSet | undefined,
    options: () => void,
  ) {
    if (typeof input?.addEventListener !== "function") {
      return () => {
        return;
      };
    }
    let entry = shrinkWrapWindowResizeStores.get(input);
    if (!entry) {
      let values = new Set<() => void>(),
        callback = () => {
          for (let value2 of values) value2();
        };
      input.addEventListener("loadingdone", callback);
      entry = {
        refits: values,
        listener: callback,
      };
      shrinkWrapWindowResizeStores.set(input, entry);
    }
    let value = entry;
    value.refits.add(options);
    return () => {
      value.refits.delete(options);
      if (
        value.refits.size === 0 &&
        shrinkWrapWindowResizeStores.get(input) === value
      ) {
        shrinkWrapWindowResizeStores.delete(input);
        input.removeEventListener?.("loadingdone", value.listener);
      }
    };
  }
  function observeShrinkWrap(
    element: HTMLElement,
    { immediate: options = false }: { immediate?: boolean } = {},
  ): () => void {
    let flag = false,
      value: number | null = null,
      defaultView = element.ownerDocument.defaultView,
      entries = new Map<Element, ShrinkWrapObservedSize>(),
      items: HTMLElement[] = [],
      callback = (input: HTMLElement) => {
        let value4 = input;
        entries.set(input, {
          inline: value4.offsetWidth ?? 0,
          block: value4.offsetHeight ?? 0,
        });
      },
      value2 = defaultView?.ResizeObserver ? defaultView : null,
      index = 0,
      callback2 = (input: number | null) => {
        if (flag) {
          return;
        }
        value = input;
        for (let value4 of items) callback(value4);
        if (value2 && index > 0) {
          for (let value4 of items.slice(index))
            pauseShrinkWrapResizeObservation(value2, value4);
        }
        index = 0;
      },
      callback3 = (input: ShrinkWrapSchedule) => {
        if (!flag) {
          enqueueShrinkWrapJob(element, callback2, input);
        }
      },
      callback4 = (event: ResizeObserverEntry) => {
        let value4 = event.borderBoxSize?.[0],
          value5 = value4
            ? value4.inlineSize
            : event.contentRect.width,
          value6 = value4
            ? value4.blockSize
            : event.contentRect.height,
          value7 = entries.get(event.target) ?? {
            inline: value5,
            block: value6,
          };
        entries.set(event.target, {
          inline: value5,
          block: value6,
        });
        let value8 = event.target === element;
        if (
          shouldRecomputeShrinkWrap({
            self: value8,
            inline: value5,
            block: value6,
            prevInline: value7.inline,
            prevBlock: value7.block,
            applied: value,
          })
        ) {
          if (!value8) {
            index = Math.max(index, items.indexOf(event.target as HTMLElement));
          }
          callback3(value8 ? "frame" : "resize");
        }
      },
      callback5 = (input: HTMLElement) => {
        if (value2) {
          registerShrinkWrapResizeHandler(value2, input, callback4);
        }
        items.push(input);
        if (options) {
          callback(input);
        }
      },
      value3: MutationObserver | null = null,
      callback6 = () => {
        return;
      },
      callback7 = () => {
        flag = true;
        cancelShrinkWrapJob(element);
        if (value2) {
          for (let value4 of items)
            unregisterShrinkWrapResizeHandler(value2, value4, callback4);
        }
        value3?.disconnect();
        callback6();
        restoreShrinkWrapWidth(element);
      };
    try {
      if (options) {
        value = shrinkWrapSynchronously(element);
      } else {
        callback3("microtask");
      }
      callback5(element);
      for (
        let parentElement = element.parentElement, index2 = 0;
        parentElement && index2 < SHRINK_WRAP_MAX_LINE_RECTS;
        parentElement = parentElement.parentElement, index2++
      )
        callback5(parentElement);
      if (defaultView?.MutationObserver) {
        let value4 = new defaultView.MutationObserver(() => {
          callback3("microtask");
        });
        value4.observe(element, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true,
          attributeFilter: [SHRINK_WRAP_ATTRIBUTE],
        });
        value3 = value4;
      }
      let fonts = element.ownerDocument.fonts,
        callback8 = () => callback3("microtask");
      callback6 = subscribeShrinkWrapWindowResize(fonts, callback8);
      if (fonts && fonts.status !== "loaded") {
        fonts.ready.then(callback8);
      }
    } catch (value4: unknown) {
      try {
        callback7();
      } catch {}
      throw value4;
    }
    return callback7;
  }
  function useShrinkWrapRef({
    enabled: input = true,
    immediate: input2 = false,
  }: { enabled?: boolean; immediate?: boolean } = {}): (element: HTMLElement | null) => void {
    let ref = reactShrinkWrap.useRef<(() => void) | null>(null);
    return reactShrinkWrap.useCallback(
      (input3: HTMLElement | null): void => {
        let current = ref.current;
        ref.current = null;
        if (current) {
          (0, runtime.invokeAndReportError)(current);
        }
        if (!input3) {
          return;
        }
        if (!input) {
          restoreShrinkWrapWidth(input3);
          return;
        }
        (0, runtime.invokeAndReportError)(() => {
          ref.current = observeShrinkWrap(input3, {
            immediate: input2,
          });
        });
      },
      [input, input2],
    );
  }
  function getButtonBackgroundLayerClasses(input: ButtonBackgroundLayerOptions) {
    return `${buttonBackgroundLayerClasses} ${!input.joined && input.solid ? buttonSolidInsetClasses : "inset-0"} ${input.joined ? "" : buttonBackgroundShadowClasses}`;
  }
  function getDisabledReasonWrapperProps(
    input: ReactNode,
    options: string,
    context?: string,
  ) {
    let value = hasDisabledReason(input);
    return {
      tabIndex: value ? 0 : -1,
      "aria-describedby": value ? options : undefined,
      "data-cds-disabled-reason-wrapper": "",
      className: (0, runtime.cn)(
        "inline-flex",
        disabledReasonFocusClasses,
        context,
      ),
    };
  }
  function hasDisabledReason(input: ReactNode) {
    return !!input;
  }
  function DisabledReasonAnnouncement({
    id: id,
    reason: reason,
  }: DisabledReasonAnnouncementProps): ReactElement {
    let ref = reactDisabledReason.useRef<HTMLSpanElement>(null);
    reactDisabledReason.useEffect(() => {
      return;
    }, [reason]);
    return jsxDisabledReason.jsx("span", {
      ref: ref,
      id: id,
      hidden: true,
      [DISABLED_REASON_ATTRIBUTE]: "",
      children: hasDisabledReason(reason) ? reason : null,
    });
  }
  function DarkTooltipScope({ children: children }: { children?: ReactNode }) {
    return jsxTooltipClasses.jsx("div", {
      className: "cds-dark-scope contents",
      "data-mode": "dark",
      children: children,
    });
  }
  function useTooltipsDisabled() {
    return reactTooltipContext.useContext(tooltipsDisabledContext);
  }
  function cancelInputDismissingTooltipOpen(
    input: boolean,
    options: BaseTooltip.Root.ChangeEventDetails,
  ) {
    if (
      input &&
      options.reason === "trigger-focus" &&
      (0, runtime.isInputTriggeredBlur)(options.event as FocusEvent)
    ) {
      options.cancel();
      return true;
    }
    return false;
  }
  function closePreviousTooltip(input: RefObject<TooltipCloser>) {
    if (activeTooltipActionsRef !== null && activeTooltipActionsRef !== input) {
      activeTooltipActionsRef.current?.closeInstant();
    }
    activeTooltipActionsRef = input;
  }
  function isEmptyTooltipContent(input: unknown) {
    return (
      input === null ||
      input === undefined ||
      input === "" ||
      typeof input === "boolean" ||
      (Array.isArray(input) && input.every(isEmptyTooltipContent))
    );
  }
  function evaluateTooltipContent(input: TooltipContentFactory) {
    let value = input();
    if (isEmptyTooltipContent(value)) {
      return TOOLTIP_NO_SHOW;
    } else {
      return value;
    }
  }
  function TooltipShortcut({
    keys: keys,
    className: className,
  }: TooltipShortcutProps): ReactElement {
    return jsxTooltip.jsx(Shortcut, {
      keys: keys,
      variant: "text",
      className: (0, runtime.cn)(
        "text-[calc(0.75rem*var(--cds-rem-scale,1))] [--cds-shortcut-cap-ink:var(--cds-text-muted)]",
        className,
      ),
    });
  }
  function Tooltip({
    content: content,
    detail: detail,
    secondaryHint: secondaryHint,
    multiline: multiline,
    shortcut: shortcut,
    side = "top",
    align: align,
    sideOffset = 4,
    collisionPadding: collisionPadding,
    trackCursorAxis: trackCursorAxis,
    delay = 300,
    open: open,
    onOpenChange: onOpenChange,
    closeDelay: closeDelay,
    hoverable = true,
    closeOnClick: closeOnClick,
    lazy = false,
    openOnHandedBackFocus = false,
    triggerRef: triggerRef,
    container: container,
    className: className,
    children: children,
  }: TooltipProps): ReactElement {
    let value = (0, runtime.usePortalContainer)(),
      value2 = useShrinkWrapRef({
        immediate: true,
      }),
      value3 = reactTooltip.useId(),
      ref = reactTooltip.useRef<BaseTooltip.Root.Actions | null>(null),
      [value4, value5] = reactTooltip.useState(false),
      ref2 = reactTooltip.useRef({
        closeInstant: () => {
          value5(true);
          ref.current?.close();
        },
      }),
      [value6, value7] = reactTooltip.useState<Element | null>(null),
      [value8, value9] = reactTooltip.useState(closedTooltipState);
    if (open === false && value8.open) {
      value9(closeTooltipState);
    }
    let value10 = typeof content === "function",
      value11 = value10 || !isEmptyTooltipContent(content),
      value12 = !value10 && value11 ? content : value8.body,
      value13 = !isEmptyTooltipContent(value12),
      value14 = (open ?? value8.open) && (!value10 || value13);
    if (!value10 && value11 && value14 && !Object.is(value8.body, content)) {
      value9(replaceTooltipBody(content as ReactNode));
    }
    let callback = reactTooltip.useCallback(
        (input: boolean, options: BaseTooltip.Root.ChangeEventDetails) => {
          if (
            !openOnHandedBackFocus &&
            cancelInputDismissingTooltipOpen(input, options)
          ) {
            return false;
          }
          if (input) {
            if (typeof content !== "function") {
              value9(openTooltipWithBody(content));
            } else if (!value14) {
              let value29 = evaluateTooltipContent(content);
              if (value29 === TOOLTIP_NO_SHOW) {
                options.cancel();
                return false;
              }
              value9(openTooltipWithBody(value29));
            } else {
              value9(openTooltipState);
            }
            value5(false);
            closePreviousTooltip(ref2);
          } else if (
            (value9(value14 ? closeTooltipState : resetTooltipState),
            activeTooltipActionsRef === ref2)
          ) {
            activeTooltipActionsRef = null;
          }
          value7(
            input && options.reason === "trigger-hover"
              ? (options.trigger ?? null)
              : null,
          );
          onOpenChange?.(input);
          return true;
        },
        [onOpenChange, openOnHandedBackFocus, content, value14],
      ),
      value15 = open !== undefined,
      open2 = value8.open;
    reactTooltip.useEffect(() => {
      if (!value15 || !value11 || !value13) {
        return;
      }
      if (open) {
        closePreviousTooltip(ref2);
      } else if (activeTooltipActionsRef === ref2) {
        activeTooltipActionsRef = null;
      }
      return () => {
        if (!open2 && activeTooltipActionsRef === ref2) {
          activeTooltipActionsRef = null;
        }
      };
    }, [value15, open, value11, value13, open2, value10]);
    let callback2 = reactTooltip.useCallback(
      (input: boolean) => {
        if (!input) {
          value5(false);
          value7(null);
          value9(clearTooltipBody);
        }
      },
      [],
    );
    reactTooltip.useEffect(() => {
      if (!value6) {
        return;
      }
      let ownerDocument = value6.ownerDocument,
        callback5 = (event: Event) => {
          let target = event.target as Element | null;
          if (target && target !== value6 && target.contains(value6)) {
            ref2.current.closeInstant();
          }
        };
      ownerDocument.addEventListener("scroll", callback5, {
        capture: true,
        passive: true,
      });
      return () => {
        ownerDocument.removeEventListener("scroll", callback5, {
          capture: true,
        });
      };
    }, [value6]);
    reactTooltip.useEffect(() => {
      return () => {
        if (activeTooltipActionsRef === ref2) {
          activeTooltipActionsRef = null;
        }
      };
    }, []);
    let value16 = (0, runtime.useDefaultOverlayLayer)("tooltip"),
      [value17] = reactTooltip.useState<BaseTooltip.Handle<unknown> | null>(
        () =>
          lazy && open === undefined
            ? runtime.baseTooltip.createHandle()
            : null,
      ),
      [value18, value19] = reactTooltip.useState(false),
      value20 = value18 || value17 === null,
      ref3 = reactTooltip.useRef(false),
      callback3 = reactTooltip.useCallback(() => {
        ref3.current = true;
        value19(true);
      }, []),
      value21 = useCancelableTimeout(),
      ref4 = reactTooltip.useRef<HTMLElement | null>(null),
      ref5 = reactTooltip.useRef(false);
    reactTooltip.useEffect(() => {
      if (open === false) {
        ref5.current = false;
      }
    }, [open]);
    let value22 = (0, runtime.useOptionalEventCallback)(
        () => {
          if (ref3.current || value20 || !value11 || open !== undefined) {
            return;
          }
          let value29: ReactNode;
          if (typeof content === "function") {
            let value30 = evaluateTooltipContent(content);
            if (value30 === TOOLTIP_NO_SHOW) {
              return;
            }
            value29 = value30;
          } else {
            value29 = content;
          }
          callback3();
          value5(false);
          closePreviousTooltip(ref2);
          value7(ref4.current);
          value9(openTooltipWithBody(value29));
          ref5.current = true;
          onOpenChange?.(true);
        },
      ),
      value23 = (0, runtime.useOptionalEventCallback)(
        (input: ReactPointerEvent<HTMLElement>) => {
          if (value20 || input.pointerType === "touch") {
            return;
          }
          if (!value11) {
            return;
          }
          ref4.current = input.currentTarget;
          value21.start(delay, value22!);
        },
      ),
      value24 = (0, runtime.useOptionalEventCallback)(() => {
        if (closeOnClick !== false) {
          value21.cancel();
        }
      }),
      value25 = (0, runtime.useOptionalEventCallback)(
        (event: ReactFocusEvent<HTMLElement>) => {
          if (value20) {
            return;
          }
          if (!event.target.matches(":focus-visible")) {
            return;
          }
          if (
            !openOnHandedBackFocus &&
            (0, runtime.isInputTriggeredBlur)(event.nativeEvent)
          ) {
            return;
          }
          ref4.current = null;
          value21.cancel();
          value22!();
        },
      );
    if (value17 !== null && open === true && !value18) {
      value19(true);
    }
    let callback4 = reactTooltip.useCallback(
        (input: boolean, options: BaseTooltip.Root.ChangeEventDetails) => {
          if (
            !openOnHandedBackFocus &&
            cancelInputDismissingTooltipOpen(input, options)
          ) {
            return;
          }
          if (input && ref5.current && value14) {
            value9(openTooltipState);
            return;
          }
          if (callback(input, options)) {
            ref5.current = input;
          }
        },
        [callback, openOnHandedBackFocus, value14],
      ),
      value26 =
        reactTooltip.isValidElement(children) &&
        children.type !== reactTooltip.Fragment
          ? children
          : (input: HTMLAttributes<HTMLElement>) =>
              jsxTooltip.jsx("span", {
                ...input,
                className: "inline-flex",
                children: children,
              }),
      value27 = jsxTooltip.jsx(runtime.baseTooltip.Trigger, {
        ref: triggerRef,
        id: value3,
        delay: delay,
        closeDelay: closeDelay,
        closeOnClick: closeOnClick,
        handle: value17 ?? undefined,
        disabled: value17 !== null && !value20 ? !value11 : undefined,
        onPointerEnter: value17 ? value23 : undefined,
        onPointerLeave: value17 ? value21.cancel : undefined,
        onPointerDown: value17 ? value24 : undefined,
        onFocus: value17 ? value25 : undefined,
        render: value26,
      }),
      value28 =
        value20 && value13
          ? jsxTooltip.jsx(runtime.baseTooltip.Portal, {
              container: container ?? value,
              children: jsxTooltip.jsx(runtime.PortalRoot, {
                children: jsxTooltip.jsx(runtime.CollisionPaddingProvider, {
                  override: collisionPadding,
                  container: container ?? value,
                  children: (input: CollisionPadding | undefined) =>
                    jsxTooltip.jsx(runtime.layerBaseContext.Provider, {
                      value: value16.base,
                      children: jsxTooltip.jsx(runtime.baseTooltip.Positioner, {
                        "data-cds": "Tooltip",
                        className: "data-[anchor-hidden]:invisible",
                        style: value16.style,
                        side: side,
                        align: align,
                        sideOffset: sideOffset,
                        collisionPadding: input,
                        children: jsxTooltip.jsx(runtime.baseTooltip.Popup, {
                          ref: value2,
                          role: "tooltip",
                          style: value4
                            ? {
                                transition: "none",
                              }
                            : undefined,
                          className: (0, runtime.cn)(
                            tooltipSingleLineClasses,
                            tooltipSecondaryDetailClasses,
                            multiline || detail || secondaryHint
                              ? tooltipMultilineBodyClasses
                              : tooltipContentRowClasses,
                            !shortcut && tooltipTextBalanceClass,
                            className,
                          ),
                          children: jsxTooltip.jsx(DarkTooltipScope, {
                            children:
                              multiline || detail || secondaryHint
                                ? jsxTooltip.jsxs(jsxTooltip.Fragment, {
                                    children: [
                                      jsxTooltip.jsxs("span", {
                                        className:
                                          "inline-flex min-w-0 items-center gap-2",
                                        children: [
                                          jsxTooltip.jsx("span", {
                                            className:
                                              multilineTooltipArrowClass,
                                            children: value12,
                                          }),
                                          shortcut &&
                                            jsxTooltip.jsx(TooltipShortcut, {
                                              keys: shortcut,
                                            }),
                                        ],
                                      }),
                                      secondaryHint &&
                                        jsxTooltip.jsxs("span", {
                                          className:
                                            "inline-flex min-w-0 items-center gap-2",
                                          children: [
                                            jsxTooltip.jsx("span", {
                                              className: "min-w-0 break-words",
                                              children: secondaryHint.label,
                                            }),
                                            jsxTooltip.jsx(TooltipShortcut, {
                                              keys: secondaryHint.shortcut,
                                            }),
                                          ],
                                        }),
                                      detail &&
                                        jsxTooltip.jsx("span", {
                                          className:
                                            "break-words text-[calc(0.6875rem*var(--cds-rem-scale,1))]/[calc(0.875rem*var(--cds-rem-scale,1))] text-secondary",
                                          children: detail,
                                        }),
                                    ],
                                  })
                                : jsxTooltip.jsxs(jsxTooltip.Fragment, {
                                    children: [
                                      jsxTooltip.jsx("span", {
                                        className: multilineTooltipArrowClass,
                                        children: value12,
                                      }),
                                      shortcut &&
                                        jsxTooltip.jsx(TooltipShortcut, {
                                          keys: shortcut,
                                          className:
                                            tooltipContentAlignmentClass,
                                        }),
                                    ],
                                  }),
                          }),
                        }),
                      }),
                    }),
                }),
              }),
            })
          : null;
    if (value17) {
      return jsxTooltip.jsxs(jsxTooltip.Fragment, {
        children: [
          jsxTooltip.jsx(tooltipImplementationContext.Provider, {
            value: defaultTooltipImplementation,
            children: jsxTooltip.jsx(tooltipsDisabledContext.Provider, {
              value: value11,
              children: value27,
            }),
          }),
          value20 &&
            jsxTooltip.jsx(runtime.baseTooltip.Root, {
              handle: value17,
              open: value14,
              disableHoverablePopup: !hoverable,
              trackCursorAxis: trackCursorAxis,
              disabled: !value11,
              actionsRef: ref,
              onOpenChange: callback4,
              onOpenChangeComplete: callback2,
              triggerId: value3,
              children: value28,
            }),
        ],
      });
    }
    return jsxTooltip.jsxs(runtime.baseTooltip.Root, {
      open: value14,
      disableHoverablePopup: !hoverable,
      trackCursorAxis: trackCursorAxis,
      disabled: !value11,
      actionsRef: ref,
      onOpenChange: callback,
      onOpenChangeComplete: callback2,
      triggerId: value3,
      children: [
        jsxTooltip.jsx(tooltipImplementationContext.Provider, {
          value: defaultTooltipImplementation,
          children: jsxTooltip.jsx(tooltipsDisabledContext.Provider, {
            value: value11,
            children: value27,
          }),
        }),
        value28,
      ],
    });
  }
  function DisabledReasonTooltip({
    reason: reason,
    side: side,
    align: align,
    sideOffset: sideOffset,
    multiline = true,
    delay: delay,
    collisionPadding: collisionPadding,
    hoverable: hoverable,
    className: className,
    wrapperClassName: wrapperClassName,
    children: children,
  }: DisabledReasonTooltipProps): ReactElement {
    let value = reactTooltip.useId();
    return jsxTooltip.jsx(Tooltip, {
      content: hasDisabledReason(reason) ? reason : undefined,
      side: side,
      align: align,
      sideOffset: sideOffset,
      multiline: multiline,
      delay: delay,
      collisionPadding: collisionPadding,
      hoverable: hoverable,
      className: className,
      closeOnClick: false,
      openOnHandedBackFocus: true,
      children: jsxTooltip.jsxs("span", {
        ...getDisabledReasonWrapperProps(reason, value, wrapperClassName),
        children: [
          children,
          jsxTooltip.jsx(DisabledReasonAnnouncement, {
            id: value,
            reason: reason,
          }),
        ],
      }),
    });
  }
  function TooltipImplementationProvider({
    children: children,
  }: { children?: ReactNode }): ReactElement {
    return jsxTooltip.jsx(tooltipImplementationContext.Provider, {
      value: defaultTooltipImplementation,
      children: children,
    });
  }
  function useHasTooltipProvider() {
    return reactTooltip.useContext(tooltipProviderContext);
  }
  function TooltipProvider({
    delay = 600,
    closeDelay = 200,
    children: children,
  }: TooltipProviderProps): ReactElement {
    return jsxTooltip.jsx(tooltipProviderContext.Provider, {
      value: true,
      children: jsxTooltip.jsx(runtime.baseTooltip.Provider, {
        delay: delay,
        closeDelay: closeDelay,
        children: children,
      }),
    });
  }
  bindRuntimeValue(
    runtime,
    "reactForUiAvatars",
    () => reactForUiAvatars,
    (value) => {
      reactForUiAvatars = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiAvatars",
    () => jsxForUiAvatars,
    (value) => {
      jsxForUiAvatars = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CLAUDE_SPARK_PATH",
    () => CLAUDE_SPARK_PATH,
    (value) => {
      CLAUDE_SPARK_PATH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CLAUDE_CLAY_COLOR",
    () => CLAUDE_CLAY_COLOR,
    (value) => {
      CLAUDE_CLAY_COLOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CLAUDE_CLAY_CSS_COLOR",
    () => CLAUDE_CLAY_CSS_COLOR,
    (value) => {
      CLAUDE_CLAY_CSS_COLOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SPARK_SIZE_CLASS",
    () => SPARK_SIZE_CLASS,
    (value) => {
      SPARK_SIZE_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StaticSpark",
    () => StaticSpark,
    (value) => {
      StaticSpark = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "Spark",
    () => Spark,
    (value) => {
      Spark = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiAvatars",
    () => initializeUiAvatars,
    (value) => {
      initializeUiAvatars = value;
    },
  );
  bindRuntimeValue(runtime, "useAvatarStack", () => useAvatarStack);
  bindRuntimeValue(
    runtime,
    "reactForUiAvatars2",
    () => reactForUiAvatars2,
    (value) => {
      reactForUiAvatars2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "AvatarStackContext",
    () => AvatarStackContext,
    (value) => {
      AvatarStackContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiAvatars2",
    () => initializeUiAvatars2,
    (value) => {
      initializeUiAvatars2 = value;
    },
  );
  bindRuntimeValue(runtime, "avatarInitials", () => avatarInitials);
  bindRuntimeValue(
    runtime,
    "reactForUiAvatars3",
    () => reactForUiAvatars3,
    (value) => {
      reactForUiAvatars3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiAvatars2",
    () => jsxForUiAvatars2,
    (value) => {
      jsxForUiAvatars2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "avatarVariants",
    () => avatarVariants,
    (value) => {
      avatarVariants = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "Avatar",
    () => Avatar,
    (value) => {
      Avatar = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiAvatars3",
    () => initializeUiAvatars3,
    (value) => {
      initializeUiAvatars3 = value;
    },
  );
  bindRuntimeValue(runtime, "getKeycapClasses", () => getKeycapClasses);
  bindRuntimeValue(runtime, "Shortcut", () => Shortcut);
  bindRuntimeValue(runtime, "useAppleKeyboard", () => useAppleKeyboard);
  bindRuntimeValue(runtime, "ownPropertyValue", () => ownPropertyValue);
  bindRuntimeValue(runtime, "getShortcutKeyLabel", () => getShortcutKeyLabel);
  bindRuntimeValue(
    runtime,
    "parseShortcutSequence",
    () => parseShortcutSequence,
  );
  bindRuntimeValue(runtime, "parseShortcutChord", () => parseShortcutChord);
  bindRuntimeValue(runtime, "renderShortcutChord", () => renderShortcutChord);
  bindRuntimeValue(
    runtime,
    "shortcutToAriaKeyShortcuts",
    () => shortcutToAriaKeyShortcuts,
  );
  bindRuntimeValue(
    runtime,
    "reactShortcut",
    () => reactShortcut,
    (value) => {
      reactShortcut = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxShortcut",
    () => jsxShortcut,
    (value) => {
      jsxShortcut = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shortcutKeycapClasses",
    () => shortcutKeycapClasses,
    (value) => {
      shortcutKeycapClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "singleCharacterKeycapClasses",
    () => singleCharacterKeycapClasses,
    (value) => {
      singleCharacterKeycapClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "multipleCharacterKeycapClasses",
    () => multipleCharacterKeycapClasses,
    (value) => {
      multipleCharacterKeycapClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shortcutTextKeyClasses",
    () => shortcutTextKeyClasses,
    (value) => {
      shortcutTextKeyClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shortcutVariantClasses",
    () => shortcutVariantClasses,
    (value) => {
      shortcutVariantClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SHORTCUT_SEQUENCE_SEPARATOR",
    () => SHORTCUT_SEQUENCE_SEPARATOR,
    (value) => {
      SHORTCUT_SEQUENCE_SEPARATOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SHORTCUT_MODIFIER_SEPARATOR",
    () => SHORTCUT_MODIFIER_SEPARATOR,
    (value) => {
      SHORTCUT_MODIFIER_SEPARATOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "appleKeyboardUserAgentPattern",
    () => appleKeyboardUserAgentPattern,
    (value) => {
      appleKeyboardUserAgentPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "subscribeAppleKeyboardNoop",
    () => subscribeAppleKeyboardNoop,
    (value) => {
      subscribeAppleKeyboardNoop = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shortcutModifierNames",
    () => shortcutModifierNames,
    (value) => {
      shortcutModifierNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isShortcutModifier",
    () => isShortcutModifier,
    (value) => {
      isShortcutModifier = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shortcutModifierOrder",
    () => shortcutModifierOrder,
    (value) => {
      shortcutModifierOrder = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "appleModifierLabels",
    () => appleModifierLabels,
    (value) => {
      appleModifierLabels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "otherModifierLabels",
    () => otherModifierLabels,
    (value) => {
      otherModifierLabels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "appleKeyLabels",
    () => appleKeyLabels,
    (value) => {
      appleKeyLabels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "otherKeyLabels",
    () => otherKeyLabels,
    (value) => {
      otherKeyLabels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "appleAriaModifierNames",
    () => appleAriaModifierNames,
    (value) => {
      appleAriaModifierNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "otherAriaModifierNames",
    () => otherAriaModifierNames,
    (value) => {
      otherAriaModifierNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeShortcuts",
    () => initializeShortcuts,
    (value) => {
      initializeShortcuts = value;
    },
  );
  bindRuntimeValue(runtime, "isTextRangeClipped", () => isTextRangeClipped);
  bindRuntimeValue(
    runtime,
    "reactTextClipping",
    () => reactTextClipping,
    (value) => {
      reactTextClipping = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "documentTextRanges",
    () => documentTextRanges,
    (value) => {
      documentTextRanges = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeTextClipping",
    () => initializeTextClipping,
    (value) => {
      initializeTextClipping = value;
    },
  );
  bindRuntimeValue(runtime, "useCancelableTimeout", () => useCancelableTimeout);
  bindRuntimeValue(
    runtime,
    "reactCancelableTimeout",
    () => reactCancelableTimeout,
    (value) => {
      reactCancelableTimeout = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeCancelableTimeout",
    () => initializeCancelableTimeout,
    (value) => {
      initializeCancelableTimeout = value;
    },
  );
  bindRuntimeValue(runtime, "writeShrinkWrapWidth", () => writeShrinkWrapWidth);
  bindRuntimeValue(
    runtime,
    "captureShrinkWrapBaseline",
    () => captureShrinkWrapBaseline,
  );
  bindRuntimeValue(
    runtime,
    "measureShrinkWrapLineRects",
    () => measureShrinkWrapLineRects,
  );
  bindRuntimeValue(
    runtime,
    "isShrinkWrapAtomicElement",
    () => isShrinkWrapAtomicElement,
  );
  bindRuntimeValue(
    runtime,
    "measureShrinkWrapLayout",
    () => measureShrinkWrapLayout,
  );
  bindRuntimeValue(
    runtime,
    "shrinkWrapLayoutWorsened",
    () => shrinkWrapLayoutWorsened,
  );
  bindRuntimeValue(
    runtime,
    "shrinkWrapLayoutImproved",
    () => shrinkWrapLayoutImproved,
  );
  bindRuntimeValue(
    runtime,
    "restoreShrinkWrapWidth",
    () => restoreShrinkWrapWidth,
  );
  bindRuntimeValue(runtime, "createShrinkWrapJob", () => createShrinkWrapJob);
  bindRuntimeValue(runtime, "settleShrinkWrapJob", () => settleShrinkWrapJob);
  bindRuntimeValue(
    runtime,
    "readShrinkWrapNaturalLayout",
    () => readShrinkWrapNaturalLayout,
  );
  bindRuntimeValue(
    runtime,
    "checkShrinkWrapCandidate",
    () => checkShrinkWrapCandidate,
  );
  bindRuntimeValue(
    runtime,
    "advanceShrinkWrapSearch",
    () => advanceShrinkWrapSearch,
  );
  bindRuntimeValue(runtime, "runShrinkWrapJobs", () => runShrinkWrapJobs);
  bindRuntimeValue(
    runtime,
    "shrinkWrapSynchronously",
    () => shrinkWrapSynchronously,
  );
  bindRuntimeValue(runtime, "getShrinkWrapQueue", () => getShrinkWrapQueue);
  bindRuntimeValue(runtime, "drainShrinkWrapQueue", () => drainShrinkWrapQueue);
  bindRuntimeValue(
    runtime,
    "flushShrinkWrapMicrotask",
    () => flushShrinkWrapMicrotask,
  );
  bindRuntimeValue(
    runtime,
    "flushShrinkWrapResizeJobs",
    () => flushShrinkWrapResizeJobs,
  );
  bindRuntimeValue(runtime, "enqueueShrinkWrapJob", () => enqueueShrinkWrapJob);
  bindRuntimeValue(runtime, "cancelShrinkWrapJob", () => cancelShrinkWrapJob);
  bindRuntimeValue(
    runtime,
    "shouldRecomputeShrinkWrap",
    () => shouldRecomputeShrinkWrap,
  );
  bindRuntimeValue(
    runtime,
    "registerShrinkWrapResizeHandler",
    () => registerShrinkWrapResizeHandler,
  );
  bindRuntimeValue(
    runtime,
    "unregisterShrinkWrapResizeHandler",
    () => unregisterShrinkWrapResizeHandler,
  );
  bindRuntimeValue(
    runtime,
    "pauseShrinkWrapResizeObservation",
    () => pauseShrinkWrapResizeObservation,
  );
  bindRuntimeValue(
    runtime,
    "subscribeShrinkWrapWindowResize",
    () => subscribeShrinkWrapWindowResize,
  );
  bindRuntimeValue(runtime, "observeShrinkWrap", () => observeShrinkWrap);
  bindRuntimeValue(
    runtime,
    "SHRINK_WRAP_STYLE_PROPERTY",
    () => SHRINK_WRAP_STYLE_PROPERTY,
    (value) => {
      SHRINK_WRAP_STYLE_PROPERTY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shrinkWrapBaselineWidths",
    () => shrinkWrapBaselineWidths,
    (value) => {
      shrinkWrapBaselineWidths = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shrinkWrapWrittenWidths",
    () => shrinkWrapWrittenWidths,
    (value) => {
      shrinkWrapWrittenWidths = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SHRINK_WRAP_MAX_ITERATIONS",
    () => SHRINK_WRAP_MAX_ITERATIONS,
    (value) => {
      SHRINK_WRAP_MAX_ITERATIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SHRINK_WRAP_ATTRIBUTE",
    () => SHRINK_WRAP_ATTRIBUTE,
    (value) => {
      SHRINK_WRAP_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SHRINK_WRAP_MAX_LINE_RECTS",
    () => SHRINK_WRAP_MAX_LINE_RECTS,
    (value) => {
      SHRINK_WRAP_MAX_LINE_RECTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shrinkWrapAtomicTags",
    () => shrinkWrapAtomicTags,
    (value) => {
      shrinkWrapAtomicTags = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shrinkWrapQueues",
    () => shrinkWrapQueues,
    (value) => {
      shrinkWrapQueues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shrinkWrapResizeObservers",
    () => shrinkWrapResizeObservers,
    (value) => {
      shrinkWrapResizeObservers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shrinkWrapWindowResizeStores",
    () => shrinkWrapWindowResizeStores,
    (value) => {
      shrinkWrapWindowResizeStores = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeShrinkWrapMeasurement",
    () => initializeShrinkWrapMeasurement,
    (value) => {
      initializeShrinkWrapMeasurement = value;
    },
  );
  bindRuntimeValue(runtime, "useShrinkWrapRef", () => useShrinkWrapRef);
  bindRuntimeValue(
    runtime,
    "reactShrinkWrap",
    () => reactShrinkWrap,
    (value) => {
      reactShrinkWrap = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxShrinkWrap",
    () => jsxShrinkWrap,
    (value) => {
      jsxShrinkWrap = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ShrinkWrap",
    () => ShrinkWrap,
    (value) => {
      ShrinkWrap = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeShrinkWrap",
    () => initializeShrinkWrap,
    (value) => {
      initializeShrinkWrap = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getButtonBackgroundLayerClasses",
    () => getButtonBackgroundLayerClasses,
  );
  bindRuntimeValue(
    runtime,
    "buttonBackgroundLayerClasses",
    () => buttonBackgroundLayerClasses,
    (value) => {
      buttonBackgroundLayerClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buttonFocusClasses",
    () => buttonFocusClasses,
    (value) => {
      buttonFocusClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "dangerButtonFocusClasses",
    () => dangerButtonFocusClasses,
    (value) => {
      dangerButtonFocusClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buttonFillLayerClasses",
    () => buttonFillLayerClasses,
    (value) => {
      buttonFillLayerClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buttonBackgroundShadowClasses",
    () => buttonBackgroundShadowClasses,
    (value) => {
      buttonBackgroundShadowClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buttonJoinedFillClasses",
    () => buttonJoinedFillClasses,
    (value) => {
      buttonJoinedFillClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buttonPressedFillClasses",
    () => buttonPressedFillClasses,
    (value) => {
      buttonPressedFillClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "secondaryButtonFillClasses",
    () => secondaryButtonFillClasses,
    (value) => {
      secondaryButtonFillClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buttonSolidInsetClasses",
    () => buttonSolidInsetClasses,
    (value) => {
      buttonSolidInsetClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeDisabledReasonDebug",
    () => initializeDisabledReasonDebug,
    (value) => {
      initializeDisabledReasonDebug = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getDisabledReasonWrapperProps",
    () => getDisabledReasonWrapperProps,
  );
  bindRuntimeValue(runtime, "hasDisabledReason", () => hasDisabledReason);
  bindRuntimeValue(
    runtime,
    "DisabledReasonAnnouncement",
    () => DisabledReasonAnnouncement,
  );
  bindRuntimeValue(
    runtime,
    "reactDisabledReason",
    () => reactDisabledReason,
    (value) => {
      reactDisabledReason = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxDisabledReason",
    () => jsxDisabledReason,
    (value) => {
      jsxDisabledReason = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "disabledReasonFocusClasses",
    () => disabledReasonFocusClasses,
    (value) => {
      disabledReasonFocusClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DISABLED_REASON_ATTRIBUTE",
    () => DISABLED_REASON_ATTRIBUTE,
    (value) => {
      DISABLED_REASON_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeDisabledReason",
    () => initializeDisabledReason,
    (value) => {
      initializeDisabledReason = value;
    },
  );
  bindRuntimeValue(runtime, "DarkTooltipScope", () => DarkTooltipScope);
  bindRuntimeValue(
    runtime,
    "jsxTooltipClasses",
    () => jsxTooltipClasses,
    (value) => {
      jsxTooltipClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tooltipBaseClasses",
    () => tooltipBaseClasses,
    (value) => {
      tooltipBaseClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "singleLineTooltipClasses",
    () => singleLineTooltipClasses,
    (value) => {
      singleLineTooltipClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tooltipDetailClasses",
    () => tooltipDetailClasses,
    (value) => {
      tooltipDetailClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "multilineTooltipBaseClasses",
    () => multilineTooltipBaseClasses,
    (value) => {
      multilineTooltipBaseClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "multilineTooltipClasses",
    () => multilineTooltipClasses,
    (value) => {
      multilineTooltipClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "multilineTooltipArrowClass",
    () => multilineTooltipArrowClass,
    (value) => {
      multilineTooltipArrowClass = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeTooltipClasses",
    () => initializeTooltipClasses,
    (value) => {
      initializeTooltipClasses = value;
    },
  );
  bindRuntimeValue(runtime, "useTooltipsDisabled", () => useTooltipsDisabled);
  bindRuntimeValue(
    runtime,
    "reactTooltipContext",
    () => reactTooltipContext,
    (value) => {
      reactTooltipContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tooltipsDisabledContext",
    () => tooltipsDisabledContext,
    (value) => {
      tooltipsDisabledContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tooltipImplementationContext",
    () => tooltipImplementationContext,
    (value) => {
      tooltipImplementationContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeTooltipContext",
    () => initializeTooltipContext,
    (value) => {
      initializeTooltipContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tooltipExports",
    () => tooltipExports,
    (value) => {
      tooltipExports = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cancelInputDismissingTooltipOpen",
    () => cancelInputDismissingTooltipOpen,
  );
  bindRuntimeValue(runtime, "closePreviousTooltip", () => closePreviousTooltip);
  bindRuntimeValue(
    runtime,
    "isEmptyTooltipContent",
    () => isEmptyTooltipContent,
  );
  bindRuntimeValue(
    runtime,
    "evaluateTooltipContent",
    () => evaluateTooltipContent,
  );
  bindRuntimeValue(runtime, "TooltipShortcut", () => TooltipShortcut);
  bindRuntimeValue(runtime, "Tooltip", () => Tooltip);
  bindRuntimeValue(
    runtime,
    "DisabledReasonTooltip",
    () => DisabledReasonTooltip,
  );
  bindRuntimeValue(
    runtime,
    "TooltipImplementationProvider",
    () => TooltipImplementationProvider,
  );
  bindRuntimeValue(
    runtime,
    "useHasTooltipProvider",
    () => useHasTooltipProvider,
  );
  bindRuntimeValue(runtime, "TooltipProvider", () => TooltipProvider);
  bindRuntimeValue(
    runtime,
    "reactTooltip",
    () => reactTooltip,
    (value) => {
      reactTooltip = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxTooltip",
    () => jsxTooltip,
    (value) => {
      jsxTooltip = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "activeTooltipActionsRef",
    () => activeTooltipActionsRef,
    (value) => {
      activeTooltipActionsRef = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TOOLTIP_NO_SHOW",
    (): TooltipNoShow => TOOLTIP_NO_SHOW,
    (value: TooltipNoShow) => {
      TOOLTIP_NO_SHOW = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "closedTooltipState",
    () => closedTooltipState,
    (value) => {
      closedTooltipState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "openTooltipState",
    () => openTooltipState,
    (value) => {
      openTooltipState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "closeTooltipState",
    () => closeTooltipState,
    (value) => {
      closeTooltipState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "clearTooltipBody",
    () => clearTooltipBody,
    (value) => {
      clearTooltipBody = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "openTooltipWithBody",
    () => openTooltipWithBody,
    (value) => {
      openTooltipWithBody = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "replaceTooltipBody",
    () => replaceTooltipBody,
    (value) => {
      replaceTooltipBody = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "resetTooltipState",
    () => resetTooltipState,
    (value) => {
      resetTooltipState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tooltipSingleLineClasses",
    () => tooltipSingleLineClasses,
    (value) => {
      tooltipSingleLineClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tooltipTextBalanceClass",
    () => tooltipTextBalanceClass,
    (value) => {
      tooltipTextBalanceClass = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tooltipSecondaryDetailClasses",
    () => tooltipSecondaryDetailClasses,
    (value) => {
      tooltipSecondaryDetailClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tooltipContentRowClasses",
    () => tooltipContentRowClasses,
    (value) => {
      tooltipContentRowClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tooltipContentAlignmentClass",
    () => tooltipContentAlignmentClass,
    (value) => {
      tooltipContentAlignmentClass = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tooltipMultilineBodyClasses",
    () => tooltipMultilineBodyClasses,
    (value) => {
      tooltipMultilineBodyClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OverflowTooltip",
    () => OverflowTooltip,
    (value) => {
      OverflowTooltip = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultTooltipImplementation",
    () => defaultTooltipImplementation,
    (value) => {
      defaultTooltipImplementation = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tooltipProviderContext",
    () => tooltipProviderContext,
    (value) => {
      tooltipProviderContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeTooltip",
    () => initializeTooltip,
    (value) => {
      initializeTooltip = value;
    },
  );
  return () => {
    CLAUDE_SPARK_PATH =
      "m19.6 66.5 19.7-11 .3-1-.3-.5h-1l-3.3-.2-11.2-.3L14 53l-9.5-.5-2.4-.5L0 49l.2-1.5 2-1.3 2.9.2 6.3.5 9.5.6 6.9.4L38 49.1h1.6l.2-.7-.5-.4-.4-.4L29 41l-10.6-7-5.6-4.1-3-2-1.5-2-.6-4.2 2.7-3 3.7.3.9.2 3.7 2.9 8 6.1L37 36l1.5 1.2.6-.4.1-.3-.7-1.1L33 25l-6-10.4-2.7-4.3-.7-2.6c-.3-1-.4-2-.4-3l3-4.2L28 0l4.2.6L33.8 2l2.6 6 4.1 9.3L47 29.9l2 3.8 1 3.4.3 1h.7v-.5l.5-7.2 1-8.7 1-11.2.3-3.2 1.6-3.8 3-2L61 2.6l2 2.9-.3 1.8-1.1 7.7L59 27.1l-1.5 8.2h.9l1-1.1 4.1-5.4 6.9-8.6 3-3.5L77 13l2.3-1.8h4.3l3.1 4.7-1.4 4.9-4.4 5.6-3.7 4.7-5.3 7.1-3.2 5.7.3.4h.7l12-2.6 6.4-1.1 7.6-1.3 3.5 1.6.4 1.6-1.4 3.4-8.2 2-9.6 2-14.3 3.3-.2.1.2.3 6.4.6 2.8.2h6.8l12.6 1 3.3 2 1.9 2.7-.3 2-5.1 2.6-6.8-1.6-16-3.8-5.4-1.3h-.8v.4l4.6 4.5 8.3 7.5L89 80.1l.5 2.4-1.3 2-1.4-.2-9.2-7-3.6-3-8-6.8h-.5v.7l1.8 2.7 9.8 14.7.5 4.5-.7 1.4-2.6 1-2.7-.6-5.8-8-6-9-4.7-8.2-.5.4-2.9 30.2-1.3 1.5-3 1.2-2.5-2-1.4-3 1.4-6.2 1.6-8 1.3-6.4 1.2-7.9.7-2.6v-.2H49L43 72l-9 12.3-7.2 7.6-1.7.7-3-1.5.3-2.8L24 86l10-12.8 6-7.9 4-4.6-.1-.5h-.3L17.2 77.4l-4.7.6-2-2 .2-3 1-1 8-5.5Z";
    CLAUDE_CLAY_COLOR = "#d97757";
    SPARK_SIZE_CLASS = "h-[var(--cds-spark-size)] w-[var(--cds-spark-size)]";
    StaticSpark = ({
      size = 32,
      color = CLAUDE_CLAY_CSS_COLOR,
      className: className,
    }: SparkProps) => {
      let value = typeof size === "number";
      return jsxForUiAvatars.jsx("svg", {
        "data-cds": "Spark",
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 100 100",
        width: size,
        height: size,
        className: value
          ? (0, runtime.cn)(SPARK_SIZE_CLASS, className)
          : className,
        style: value
          ? {
              "--cds-spark-size": (0, runtime.pixelsToScaledRem)(size as number),
            }
          : undefined,
        fill: color,
        "aria-hidden": true,
        children: jsxForUiAvatars.jsx("path", {
          d: CLAUDE_SPARK_PATH,
        }),
      });
    };
    initializeUiAvatars = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeRemScale)();
      reactForUiAvatars = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiAvatars = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      CLAUDE_CLAY_CSS_COLOR = `var(--cds-clay, ${CLAUDE_CLAY_COLOR})`;
      StaticSpark.displayName = "StaticSpark";
      Spark = reactForUiAvatars.memo(StaticSpark);
    });
    initializeUiAvatars2 = (0, runtime.initializeOnce)(() => {
      reactForUiAvatars2 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      AvatarStackContext = reactForUiAvatars2.createContext<AvatarStackContextValue | null>(null);
    });
    initializeUiAvatars3 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeCdsRoot)();
      initializeUiAvatars();
      initializeUiAvatars2();
      (0, runtime.initializeNpmDependency)();
      reactForUiAvatars3 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiAvatars2 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      avatarVariants = (0, runtime.cva)(
        "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-sans font-medium leading-none",
        {
          variants: {
            size: {
              xs: "size-[var(--cds-avatar-xs)] text-[length:var(--cds-avatar-text-xs)]",
              sm: "size-[var(--cds-avatar-sm)] text-[calc(0.5625rem*var(--cds-rem-scale,1))]",
              md: "size-[var(--cds-avatar-md)] text-footnote",
              lg: "size-[var(--cds-avatar-lg)] text-body",
            },
            variant: {
              default: "bg-fill-control text-primary",
              pro: "bg-fill-pro text-on-pro",
              claude: "bg-fill-brand text-on-brand",
            },
          },
          defaultVariants: {
            size: "md",
            variant: "default",
          },
        },
      );
      Avatar = reactForUiAvatars3.forwardRef<HTMLSpanElement, AvatarProps>(
        (
          {
            src: src,
            name: name,
            size: size,
            variant: variant,
            className: className,
            ...props
          },
          options,
        ) => {
          let value = useAvatarStack();
          if (value) {
            size = value.size;
          }
          let value2 = (0, runtime.useCdsConfig)(),
            [value3, value4] = reactForUiAvatars3.useState(false),
            [value5, value6] = reactForUiAvatars3.useState(src);
          if (value5 !== src) {
            value6(src);
            value4(false);
          }
          let memo = reactForUiAvatars3.useMemo(
              () =>
                avatarInitials(name, value2, size === "xs" ? 1 : 2),
              [name, value2, size],
            ),
            value7 = Boolean(src) && !value3;
          return jsxForUiAvatars2.jsx("span", {
            ref: options,
            "data-cds": "Avatar",
            ...props,
            className: (0, runtime.cn)(
              avatarVariants({
                size: size,
                variant: variant,
              }),
              className,
            ),
            role: value7 ? undefined : "img",
            "aria-label": value7 ? undefined : name,
            children: value7
              ? jsxForUiAvatars2.jsx("img", {
                  src: src,
                  alt: name,
                  className: "size-full object-cover",
                  draggable: false,
                  onError: () => value4(true),
                })
              : variant === "claude"
                ? jsxForUiAvatars2.jsx(Spark, {
                    size: "60%",
                    color: "currentColor",
                  })
                : memo,
          });
        },
      );
      Avatar.displayName = "Avatar";
    });
    shortcutKeycapClasses =
      "inline-flex shrink-0 items-center justify-center h-[calc(1em+6px)] rounded-[var(--cds-keycap-radius,4px)] [color:var(--cds-shortcut-cap-ink)] bg-[color:var(--cds-shortcut-cap-fill)] border border-[color:var(--cds-shortcut-cap-line)] font-inherit [font-variation-settings:inherit] [line-height:1]";
    singleCharacterKeycapClasses = "w-[calc(1em+6px)] px-0";
    multipleCharacterKeycapClasses = "min-w-[calc(1em+6px)] px-[3px]";
    shortcutTextKeyClasses =
      "font-inherit [font-variation-settings:inherit] [color:var(--cds-shortcut-cap-ink)]";
    SHORTCUT_SEQUENCE_SEPARATOR = "then";
    SHORTCUT_MODIFIER_SEPARATOR = "+";
    subscribeAppleKeyboardNoop = () => () => {
      return;
    };
    isShortcutModifier = (input: string): input is ShortcutModifier =>
      shortcutModifierNames.includes(input);
    initializeShortcuts = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeTranslations)();
      reactShortcut = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxShortcut = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      shortcutVariantClasses = {
        keycap: "inline-flex shrink-0 items-center gap-[2px] text-caption",
        text: "inline-flex shrink-0 items-baseline gap-[0.3em] text-caption",
      };
      appleKeyboardUserAgentPattern = /mac|iphone|ipad|ipod/i;
      shortcutModifierNames = [
        "cmd",
        "command",
        "meta",
        "ctrl",
        "control",
        "alt",
        "option",
        "shift",
      ];
      shortcutModifierOrder = [
        "ctrl",
        "control",
        "alt",
        "option",
        "shift",
        "cmd",
        "command",
        "meta",
      ];
      appleModifierLabels = {
        ctrl: "⌃",
        control: "⌃",
        alt: "⌥",
        option: "⌥",
        shift: "⇧",
        cmd: "⌘",
        command: "⌘",
        meta: "⌘",
      };
      otherModifierLabels = {
        ctrl: "Ctrl",
        control: "Ctrl",
        alt: "Alt",
        option: "Alt",
        shift: "Shift",
        cmd: "Ctrl",
        command: "Ctrl",
        meta: "Ctrl",
      };
      appleKeyLabels = {
        space: "␣",
        enter: "⏎",
        return: "⏎",
        delete: "⌫",
        backspace: "⌫",
        escape: "Esc",
        esc: "Esc",
        tab: "⇥",
        up: "↑",
        down: "↓",
        left: "←",
        right: "→",
        pageup: "Page Up",
        pagedown: "Page Down",
        home: "Home",
        end: "End",
        insert: "Insert",
      };
      otherKeyLabels = {
        space: "Space",
        enter: "⏎",
        return: "⏎",
        delete: "Backspace",
        backspace: "Backspace",
        escape: "Esc",
        esc: "Esc",
        tab: "Tab",
        up: "↑",
        down: "↓",
        left: "←",
        right: "→",
        pageup: "Page Up",
        pagedown: "Page Down",
        home: "Home",
        end: "End",
        insert: "Insert",
      };
      appleAriaModifierNames = {
        cmd: "Command",
        command: "Command",
        meta: "Command",
        ctrl: "Control",
        control: "Control",
        alt: "Option",
        option: "Option",
        shift: "Shift",
        enter: "Enter",
        return: "Enter",
        space: "Space",
        tab: "Tab",
        delete: "Delete",
        backspace: "Delete",
        up: "Up",
        down: "Down",
        left: "Left",
        right: "Right",
      };
      otherAriaModifierNames = {
        ctrl: "Control",
        control: "Control",
        alt: "Alt",
        option: "Alt",
        shift: "Shift",
        enter: "Enter",
        return: "Enter",
        escape: "Escape",
        esc: "Escape",
        space: "Space",
        tab: "Tab",
        delete: "Backspace",
        backspace: "Backspace",
        up: "ArrowUp",
        down: "ArrowDown",
        left: "ArrowLeft",
        right: "ArrowRight",
        home: "Home",
        end: "End",
        pageup: "PageUp",
        pagedown: "PageDown",
        insert: "Insert",
      };
    });
    initializeTextClipping = (0, runtime.initializeOnce)(() => {
      reactTextClipping = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      documentTextRanges = new WeakMap();
    });
    initializeCancelableTimeout = (0, runtime.initializeOnce)(() => {
      reactCancelableTimeout = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
    });
    SHRINK_WRAP_STYLE_PROPERTY = "maxWidth";
    SHRINK_WRAP_MAX_ITERATIONS = 12;
    SHRINK_WRAP_ATTRIBUTE = "data-shrinkwrap";
    SHRINK_WRAP_MAX_LINE_RECTS = 16;
    initializeShrinkWrapMeasurement = (0, runtime.initializeOnce)(
      () => {
        shrinkWrapBaselineWidths = new WeakMap();
        shrinkWrapWrittenWidths = new WeakMap();
        shrinkWrapAtomicTags = new Set([
          "IMG",
          "SVG",
          "VIDEO",
          "AUDIO",
          "CANVAS",
          "IFRAME",
          "EMBED",
          "OBJECT",
          "PICTURE",
          "INPUT",
          "TEXTAREA",
          "SELECT",
          "PROGRESS",
          "METER",
        ]);
        shrinkWrapQueues = new WeakMap();
        shrinkWrapResizeObservers = new WeakMap();
        shrinkWrapWindowResizeStores = new WeakMap();
      },
    );
    initializeShrinkWrap = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeErrorReporting)();
      (0, runtime.initializeMergedRefs)();
      initializeShrinkWrapMeasurement();
      reactShrinkWrap = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxShrinkWrap = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      ShrinkWrap = reactShrinkWrap.forwardRef<HTMLDivElement, ShrinkWrapProps>(
        (
          {
            enabled = true,
            immediate = false,
            children: children,
            ...props
          },
          options,
        ) => {
          let value = useShrinkWrapRef({
              enabled: enabled,
              immediate: immediate,
            }),
            value2 = (0, runtime.useMergedRefs)(options, value);
          return jsxShrinkWrap.jsx("div", {
            ref: value2,
            "data-cds": "ShrinkWrap",
            ...props,
            children: children,
          });
        },
      );
      ShrinkWrap.displayName = "ShrinkWrap";
    });
    buttonBackgroundLayerClasses = "absolute -z-[1] rounded-[inherit]";
    buttonFocusClasses =
      "focus-visible:shadow-focus [&[data-initial-focus]:focus]:shadow-focus";
    dangerButtonFocusClasses =
      "focus-visible:shadow-focus-danger [&[data-initial-focus]:focus]:shadow-focus-danger";
    buttonFillLayerClasses =
      "absolute inset-0 rounded-[inherit] transition-[background-color,box-shadow,color] duration-fast ease-out group-focus-visible/btn:shadow-[inset_0_0_0_1px_var(--cds-page-bg)] group-[[data-initial-focus]:focus]/btn:shadow-[inset_0_0_0_1px_var(--cds-page-bg)]";
    buttonBackgroundShadowClasses = "cds-btn-squish";
    buttonJoinedFillClasses =
      "shadow-field group-aria-pressed/btn:shadow-field-pressed group-focus-visible/btn:group-aria-pressed/btn:shadow-[inset_0_0_0_1px_var(--cds-page-bg)]";
    buttonPressedFillClasses =
      "group-aria-pressed/btn:bg-accent group-hover/btn:group-aria-pressed/btn:bg-accent";
    secondaryButtonFillClasses =
      "bg-fill-secondary group-hover/btn:bg-fill-secondary-hover group-[[aria-haspopup][aria-expanded=true]]/btn:bg-fill-secondary-hover";
    buttonSolidInsetClasses = "inset-[0.5px]";
    initializeDisabledReasonDebug = () => {};
    DISABLED_REASON_ATTRIBUTE = "data-cds-disabled-reason";
    initializeDisabledReason = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeClassNames)();
      initializeDisabledReasonDebug();
      reactDisabledReason = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxDisabledReason = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      disabledReasonFocusClasses = `rounded outline-none focus-visible:outline-hidden [&[data-initial-focus]:focus]:outline-hidden transition-shadow duration-fast ${buttonFocusClasses}`;
    });
    tooltipBaseClasses =
      "rounded-[calc(0.375rem*var(--cds-rem-scale,1))] bg-[var(--cds-tooltip-bg)] text-[var(--cds-tooltip-fg)] shadow-sm dark:shadow-panel-sm print:hidden text-[calc(0.8125rem*var(--cds-rem-scale,1))]/[calc(1.125rem*var(--cds-rem-scale,1))] font-normal";
    tooltipDetailClasses =
      "origin-[var(--transform-origin)] transition-[opacity,scale] duration-snap ease-snap motion-reduce:transition-none data-[starting-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[ending-style]:scale-[0.98] data-[instant]:duration-0";
    multilineTooltipBaseClasses = "max-w-[240px] whitespace-normal";
    multilineTooltipArrowClass = "min-w-0 break-words";
    initializeTooltipClasses = (0, runtime.initializeOnce)(() => {
      jsxTooltipClasses = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      singleLineTooltipClasses = `px-2 ${tooltipBaseClasses}`;
      multilineTooltipClasses = `${multilineTooltipBaseClasses} py-1.5`;
    });
    initializeTooltipContext = (0, runtime.initializeOnce)(() => {
      reactTooltipContext = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      tooltipsDisabledContext = reactTooltipContext.createContext(false);
      tooltipImplementationContext = reactTooltipContext.createContext<TooltipImplementationParts | null>(null);
    });
    tooltipExports = {} as TooltipExports;
    (0, runtime.defineLiveExports)(tooltipExports, {
      useTooltipTrigger: () => useTooltipsDisabled,
      useTooltipGroup: () => useHasTooltipProvider,
      TooltipImplProvider: () => TooltipImplementationProvider,
      TooltipGroup: () => TooltipProvider,
      Tooltip: () => Tooltip,
      OverflowTooltip: () => OverflowTooltip,
      DisabledReasonTooltip: () => DisabledReasonTooltip,
    });
    activeTooltipActionsRef = null;
    openTooltipState = (input) =>
      input.open
        ? input
        : {
            ...input,
            open: true,
          };
    closeTooltipState = (input) =>
      input.open
        ? {
            ...input,
            open: false,
          }
        : input;
    clearTooltipBody = (input) =>
      input.body === undefined
        ? input
        : {
            ...input,
            body: undefined,
          };
    openTooltipWithBody =
      (input) =>
      (input2) =>
        input2.open && Object.is(input2.body, input)
          ? input2
          : {
              open: true,
              body: input,
            };
    replaceTooltipBody =
      (input) =>
      (input2) =>
        Object.is(input2.body, input)
          ? input2
          : {
              ...input2,
              body: input,
            };
    resetTooltipState = (input) =>
      input.open || input.body !== undefined ? closedTooltipState : input;
    tooltipTextBalanceClass = "text-balance";
    tooltipContentRowClasses =
      "inline-flex items-center gap-2 min-h-[calc(1.5rem*var(--cds-rem-scale,1))] max-w-[240px] py-[calc(0.1875rem*var(--cds-rem-scale,1))]";
    tooltipContentAlignmentClass = "self-start";
    initializeTooltip = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeInputDismissalTracking)();
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeLayers)();
      (0, runtime.initializeEventCallbacks)();
      (0, runtime.initializeMergedRefs)();
      (0, runtime.initializePortalRoot)();
      (0, runtime.initializeCollisionPadding)();
      initializeTextClipping();
      initializeCancelableTimeout();
      initializeShortcuts();
      initializeShrinkWrap();
      initializeDisabledReason();
      initializeTooltipClasses();
      initializeTooltipContext();
      (0, runtime.initializeNpmDependency)();
      reactTooltip = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxTooltip = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      TOOLTIP_NO_SHOW = Symbol("cds.Tooltip.noShow") as TooltipNoShow;
      closedTooltipState = {
        open: false,
        body: undefined,
      };
      tooltipSingleLineClasses = singleLineTooltipClasses;
      tooltipSecondaryDetailClasses = tooltipDetailClasses;
      tooltipMultilineBodyClasses = `flex flex-col gap-0.5 ${multilineTooltipClasses}`;
      OverflowTooltip = reactTooltip.forwardRef<HTMLSpanElement, OverflowTooltipProps>(function (
        {
          className: className,
          side: side,
          align: align,
          sideOffset: sideOffset,
          delay: delay,
          collisionPadding: collisionPadding,
          hoverable: hoverable,
          lazy: lazy,
          children: children,
          ...props
        },
        options,
      ) {
        let ref = reactTooltip.useRef<HTMLSpanElement>(null),
          value = (0, runtime.useMergedRefs)(ref, options),
          value2 = useTooltipsDisabled();
        return jsxTooltip.jsx(Tooltip, {
          content: value2
            ? undefined
            : () => {
                let current = ref.current;
                if (current === null) {
                  return;
                }
                if (
                  current.scrollWidth > current.clientWidth ||
                  isTextRangeClipped(current)
                ) {
                  return children;
                } else {
                  return undefined;
                }
              },
          side: side,
          align: align,
          sideOffset: sideOffset,
          delay: delay,
          collisionPadding: collisionPadding,
          hoverable: hoverable,
          lazy: lazy,
          children: jsxTooltip.jsx("span", {
            ...props,
            ref: value,
            "data-cds": "OverflowTooltip",
            className: (0, runtime.cn)(
              "block min-w-0 overflow-x-clip text-ellipsis whitespace-nowrap",
              className,
            ),
            children: children,
          }),
        });
      });
      OverflowTooltip.displayName = "OverflowTooltip";
      defaultTooltipImplementation = {
        Tooltip: Tooltip,
        DisabledReasonTooltip: DisabledReasonTooltip,
      };
      tooltipProviderContext = reactTooltip.createContext(false);
    });
  };
}
