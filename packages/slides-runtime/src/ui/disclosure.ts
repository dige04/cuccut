/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type CssVariableStyle,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type {
  AnimationEvent as ReactAnimationEvent,
  Context,
  FocusEvent as ReactFocusEvent,
  FocusEventHandler,
  HTMLAttributes,
  ForwardRefExoticComponent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  MouseEventHandler,
  PointerEvent as ReactPointerEvent,
  ButtonHTMLAttributes,
  ReactElement,
  ReactNode,
  Ref,
  RefAttributes,
  RefCallback,
  RefObject,
} from "react";
import type { Collapsible as BaseCollapsible } from "@base-ui/react/collapsible";
import type { UseRenderRenderProp } from "@base-ui/react/use-render";
import type {
  ElevationName,
  SurfaceName,
  IconSizeName,
  IconSizeSetting,
  SkeletonShownSnapshot,
  SkeletonShownStore,
  MergedRefCallback,
} from "./interactions";
import type { TooltipImplementationParts } from "./avatars";

/** Mouse handler that stops a repeated click from selecting text. */
export type ClickSelectionEvent = ReactMouseEvent<HTMLElement>;
export type ClickSelectionHandler = (event: ClickSelectionEvent) => void;
/** An animation as reported by `Element.getAnimations()` on a CSS-driven element. */
type NamedAnimation = Animation & {
  animationName?: string;
  transitionProperty?: string;
};
/** The tooltip implementation module, loaded lazily. */
export type TooltipImplementation = TooltipImplementationParts;
/** Lets a host defer tooltip loading until it hands out an implementation. */
export interface DeferredTooltipHost {
  isDeferred: () => boolean;
  subscribe: (listener: () => void) => () => void;
  ambientImpl: () => TooltipImplementation | null;
}
/** Pointer and focus tracking of one tooltip trigger before the real tooltip is mounted. */
export interface TooltipTriggerState {
  hover: boolean;
  focus: boolean;
  down: boolean;
  node: HTMLElement | null;
  adopted: boolean;
  handBack: boolean;
  tapHold: ReturnType<typeof setTimeout> | null;
}
/** The event handlers a pending tooltip trigger intercepts. */
export interface TooltipTriggerHandlers {
  onPointerEnter?: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerLeave?: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel?: (event: ReactPointerEvent<HTMLElement>) => void;
  onClick?: MouseEventHandler<HTMLElement>;
  onFocus?: FocusEventHandler<HTMLElement>;
  onBlur?: FocusEventHandler<HTMLElement>;
}
export interface DeferredTooltipState {
  impl: TooltipImplementation | null;
  wasCold: boolean;
  interceptors: (props: TooltipTriggerHandlers) => TooltipTriggerHandlers;
  trackTrigger: ((node: HTMLElement | null) => void) | undefined;
}
export interface DeferredTooltipProps {
  children?: ReactNode;
  autoFocus?: boolean;
  [prop: string]: unknown;
}
export interface DeferredDisabledReasonTooltipProps {
  reason?: ReactNode;
  wrapperClassName?: string;
  children?: ReactNode;
  [prop: string]: unknown;
}
/** The parts of a keyboard event that decide whether a button activates. */
export type ButtonActivationEvent = Pick<
  ReactKeyboardEvent,
  "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey"
>;
export type SpinnerSizeName = "sm" | "md" | "lg";
export type SpinnerSize = SpinnerSizeName | "s" | "m" | "l";
export interface SpinnerMetric {
  box: number;
  stroke: number;
}
export interface SpinnerProps {
  size?: SpinnerSize;
  /** Milliseconds to wait before the spinner shows. */
  delay?: number;
  inheritColor?: boolean;
  label?: ReactNode;
  className?: string;
}
export interface DelayedScreenReaderLabelProps {
  show: boolean;
  children?: ReactNode;
}
/** What compactable controls read from their surrounding toolbar. */
export interface CompactableContextValue {
  compact: boolean;
  /** Icon shown instead of the label while compact. */
  icon?: ReactNode;
  exactFit?: boolean;
}
export type CollapsibleCaretPosition = "start" | "end";
export type CollapsibleRootProps = BaseCollapsible.Root.Props;
export interface CollapsibleTriggerProps extends Omit<BaseCollapsible.Trigger.Props, "className"> {
  className?: string;
  caretPosition?: CollapsibleCaretPosition;
  hideCaret?: boolean;
}
export interface CollapsiblePanelProps extends Omit<BaseCollapsible.Panel.Props, "className"> {
  className?: string;
}
export interface CollapsibleParts {
  Root: ForwardRefExoticComponent<CollapsibleRootProps & RefAttributes<HTMLDivElement>>;
  Trigger: ForwardRefExoticComponent<CollapsibleTriggerProps & RefAttributes<HTMLButtonElement>>;
  Panel: ForwardRefExoticComponent<CollapsiblePanelProps & RefAttributes<HTMLDivElement>>;
}
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "brand"
  | "onContent"
  | "onAccent";
/** Control sizes; `base` is the default and `xxs` is special-cased by buttons. */
export type ButtonSize = "xxs" | "xs" | "sm" | "base" | "lg";
export type ButtonJoinedPosition = "start" | "middle" | "end";
export type ButtonOutset = "start" | "end" | "both";
/** What a button group publishes to the buttons it contains. */
export interface ButtonGroupContextValue {
  joined?: ButtonJoinedPosition;
  size?: ButtonSize;
  enforceVariant?: boolean;
  buttonVariant?: ButtonVariant;
}
export interface ButtonProps
  extends Omit<
    ButtonHTMLAttributes<HTMLElement>,
    "type" | "style" | "className" | "children"
  > {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** An icon name or an already rendered node. */
  icon?: ReactNode;
  iconOnly?: boolean;
  iconPosition?: "start" | "end";
  tooltip?: ReactNode;
  tooltipSide?: string;
  indicator?: ReactNode;
  shortcut?: string;
  busy?: boolean;
  busyLabel?: ReactNode;
  pressed?: boolean;
  flush?: boolean | ButtonOutset;
  style?: CssVariableStyle;
  disabledReason?: ReactNode;
  disabledReasonSide?: string;
  type?: "button" | "submit" | "reset";
  href?: string;
  routerOptions?: object;
  target?: string;
  rel?: string;
  download?: boolean | string;
  render?: UseRenderRenderProp;
  className?: string;
  children?: ReactNode;
}
export type SkeletonElementTag = "div" | "span";
export type SkeletonMotion = "wave" | "sweep" | "lockstep";
/** How long a skeleton group holds back: delayed, or shown immediately for the given reason. */
export type SkeletonHold = "delayed" | { none: string };
export interface SkeletonGroupProps {
  children?: ReactNode;
  hold?: SkeletonHold;
  label?: string;
  className?: string;
  decorative?: boolean;
  onShown?: () => void;
  onHidden?: () => void;
  as?: SkeletonElementTag;
  motion?: SkeletonMotion;
}
export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  className?: string;
  decorative?: boolean;
  as?: SkeletonElementTag;
}
export interface SkeletonRowsProps {
  /** Number of rows, or the row count of each section separated by dividers. */
  rows?: number | number[];
  icon?: boolean;
}
export interface SkeletonChipProps {
  width?: number | string;
  shape?: "pill" | "rect";
}
export interface SkeletonLinesProps {
  lines?: number;
  className?: string;
}
export interface SkeletonBlockProps {
  height?: number | string;
  className?: string;
}
/** Animation events of a skeleton group, whose target is always an element. */
type SkeletonAnimationEvent = ReactAnimationEvent<HTMLElement> & { target: HTMLElement };
/** The skeleton component with its preset variants attached. */
export type SkeletonPrimitiveComponent = ((props: SkeletonProps) => ReactElement) & {
  Rows: (props: SkeletonRowsProps) => ReactElement;
  Chip: (props: SkeletonChipProps) => ReactElement;
  Lines: (props: SkeletonLinesProps) => ReactElement;
  Block: (props: SkeletonBlockProps) => ReactElement;
};
export interface SurfaceProps extends Omit<HTMLAttributes<HTMLDivElement>, "style"> {
  elevation: ElevationName;
  style?: CssVariableStyle;
}
interface DisplayNamed {
  displayName?: string;
}
/** The node a `hidden=until-found` element is tracked on, with the cleanup of its style recovery. */
interface BeforeMatchRecovery {
  node: HTMLElement;
  detach: () => void;
}
/** The tooltip implementation a trigger resolved, plus the hook that adopts the real trigger node. */
interface TooltipSlot {
  impl: TooltipImplementation;
  track: ((node: HTMLElement | null) => void) | undefined;
}
/** Document-level listeners that end a touch hold on a tooltip trigger. */
interface TouchReleaseListener {
  doc: Document;
  release: (event: PointerEvent) => void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    preventRepeatedClickSelection: ClickSelectionHandler;
    withRepeatedClickSelectionPrevention: <E extends ClickSelectionEvent>(onMouseDown?: (event: E) => void) => (event: E) => void;
    PRESERVE_INPUT_FOCUS_PROPS: Readonly<{ onMouseDown: ClickSelectionHandler }>;
    initializeUiDisclosure: () => void;
    useHiddenUntilFoundRef: () => RefCallback<HTMLElement>;
    attachBeforeMatchStyleRecovery: (element: HTMLElement) => () => void;
    overrideInlineStyles: (element: HTMLElement, styles: Record<string, string>) => () => void;
    react_k: ReactNamespace;
    initializeUiDisclosure2: () => void;
    reactForUiDisclosure: ReactNamespace;
    DISCLOSURE_PANEL_CLASS: string;
    isHeightTransitionAnimation: (animation: NamedAnimation) => boolean;
    observeDisclosureHeightAnimation: (element: HTMLElement) => () => void;
    useDisclosureAnimationRef: () => RefCallback<HTMLElement>;
    useDisclosureBodyRef: (ref?: Ref<HTMLDivElement>) => MergedRefCallback<HTMLDivElement>;
    initializeUiDisclosure3: () => void;
    reactForUiDisclosure2: ReactNamespace;
    jsxForUiDisclosure: JsxNamespace;
    CollapsibleRoot: CollapsibleParts["Root"];
    COLLAPSIBLE_TRIGGER_CLASS: string;
    COLLAPSIBLE_ICON_CLASS: string;
    CollapsibleTrigger: CollapsibleParts["Trigger"];
    COLLAPSIBLE_PANEL_CLASS: string;
    CollapsiblePanel: CollapsibleParts["Panel"];
    Collapsible: CollapsibleParts;
    initializeUiDisclosure4: () => void;
    Spinner: (props: SpinnerProps) => ReactElement | null;
    DelayedScreenReaderLabel: (props: DelayedScreenReaderLabelProps) => ReactElement | null;
    reactcK: ReactNamespace;
    jsxEq: JsxNamespace;
    spinnerSizeAliases: Partial<Record<SpinnerSize, SpinnerSizeName>>;
    spinnerSizeMetrics: Record<SpinnerSizeName, SpinnerMetric>;
    initializeUiDisclosure5: () => void;
    useCompactable: () => CompactableContextValue;
    reactForUiDisclosure3: ReactNamespace;
    CompactableContext: Context<CompactableContextValue>;
    COMPACTABLE_ATTRIBUTE: string;
    initializeUiDisclosure6: () => void;
    useCompactableControlDebug: (ref: RefObject<HTMLElement | null>, name: string) => void;
    reacttq0: ReactNamespace;
    initializeUiDisclosure7: () => void;
    scheduleTooltipUpdate: (callback: () => void) => void;
    cancelTooltipUpdate: (callback: () => void) => void;
    loadTooltipImplementation: () => Promise<TooltipImplementation>;
    preloadTooltipsOnInteraction: () => void;
    requestTooltipPreload: () => void;
    adoptTooltipTrigger: (trigger: TooltipTriggerState, node: HTMLElement | null) => void;
    restoreDeferredTooltipFocus: (trigger: TooltipTriggerState, element: HTMLElement) => void;
    cancelTooltipTouchHold: (trigger: TooltipTriggerState) => void;
    releaseTooltipTouchHold: (trigger: TooltipTriggerState, event: { type: string; pointerType?: string }, onRelease: () => void) => void;
    resolveTooltipImplementation: (host: DeferredTooltipHost | null) => TooltipImplementation | null;
    hasNonVisibleFocus: (element: Element) => boolean;
    useDeferredTooltipImplementation: (track: boolean) => DeferredTooltipState;
    disableElementAutofocus: (node: ReactNode) => ReactNode;
    DeferredTooltip: (props: DeferredTooltipProps) => ReactNode;
    DeferredDisabledReasonTooltip: (props: DeferredDisabledReasonTooltipProps) => ReactNode;
    reactf6: ReactNamespace;
    jsxh3: JsxNamespace;
    loadedTooltipImplementation: TooltipImplementation | null;
    tooltipImplementationPromise: Promise<TooltipImplementation> | null;
    tooltipImplementationListeners: Set<() => void>;
    tooltipBatchTimer: ReturnType<typeof setTimeout> | null;
    tooltipBatchCallbacks: Set<() => void>;
    tooltipPreloadEvents: string[];
    tooltipPreloadStarted: boolean;
    pendingTooltipProps: { "data-cds-tooltip-pending": string };
    TOUCH_TOOLTIP_HOLD_MS: number;
    deferredTooltipImplementationContext: Context<DeferredTooltipHost | null>;
    initializeUiDisclosure8: () => void;
    isButtonActivationKey: (event: Pick<ReactKeyboardEvent, "key">) => boolean;
    isUnmodifiedButtonActivation: (event: ButtonActivationEvent) => boolean;
    useButtonGroup: () => ButtonGroupContextValue | null;
    getButtonIconSize: (size: ButtonSize) => IconSizeSetting;
    useButtonIconSize: (size?: ButtonSize) => IconSizeName;
    getButtonIconVerticalPadding: (size: IconSizeName) => string;
    reacttJ: ReactNamespace;
    jsxForUiDisclosure2: JsxNamespace;
    stopEvent: (event: Pick<Event, "preventDefault" | "stopPropagation">) => void;
    BUTTON_ON_ACCENT_TEXT_CLASS: string;
    BUTTON_END_ICON_OFFSET_CLASS: string;
    buttonVariants: (props?: { variant?: ButtonVariant | null; iconOnly?: boolean | null }) => string;
    BUTTON_ON_CONTENT_FILL_CLASS: string;
    buttonPaintVariants: (props?: { variant?: ButtonVariant | null }) => string;
    buttonGroupContext: Context<ButtonGroupContextValue | null>;
    BUTTON_SEGMENT_RADIUS_CLASSES: Record<ButtonJoinedPosition, string>;
    BUTTON_OUTSET_CLASSES: Record<ButtonOutset, string>;
    BUTTON_OUTSET_STYLES: CssVariableStyle;
    buttonIconSizeContext: Context<IconSizeSetting | undefined>;
    Button: ForwardRefExoticComponent<ButtonProps & RefAttributes<HTMLElement>>;
    initializeUiDisclosure9: () => void;
    isShimmerAnimation: (animation: NamedAnimation) => boolean;
    synchronizeDocumentShimmers: (doc: Document) => void;
    flushShimmerSynchronization: () => void;
    scheduleShimmerSynchronization: (element: Element | null) => void;
    createSkeletonShownStore: () => SkeletonShownStore;
    markSkeletonShownAfterCallback: (onShown: (() => void) | undefined, store: SkeletonShownStore) => void;
    clearSkeletonElapsedStyle: (element: HTMLElement) => void;
    setSkeletonMotion: (element: HTMLElement, motion: SkeletonMotion) => void;
    ensurePositionedSkeletonHost: (element: HTMLElement) => boolean;
    synchronizeSkeletonAnimation: (element: HTMLElement, animationName?: string, offsetMs?: number) => void;
    SkeletonGroup: (props: SkeletonGroupProps) => ReactElement;
    Skeleton: (props: SkeletonProps) => ReactElement;
    SkeletonRows: (props: SkeletonRowsProps) => ReactElement;
    SkeletonChip: (props: SkeletonChipProps) => ReactElement;
    SkeletonLines: (props: SkeletonLinesProps) => ReactElement;
    SkeletonBlock: (props: SkeletonBlockProps) => ReactElement;
    reactz6: ReactNamespace;
    jsxW7: JsxNamespace;
    skeletonElementTags: Record<SkeletonElementTag, SkeletonElementTag>;
    pendingShimmerElements: Set<Element>;
    shimmerStartTimes: WeakMap<Document, number>;
    skeletonNotShownSnapshot: Readonly<SkeletonShownSnapshot>;
    skeletonShownSnapshot: Readonly<SkeletonShownSnapshot>;
    SKELETON_BREATHE_ANIMATION: string;
    SKELETON_SWEEP_ANIMATION: string;
    SKELETON_ANIMATION_DURATION_MS: number;
    DEFAULT_SKELETON_MOTION: SkeletonMotion;
    SKELETON_MINIMUM_HOLD_MS: number;
    SKELETON_DURATION_LIMIT_MS: number;
    SKELETON_SYNC_TOLERANCE_MS: number;
    skeletonAnimationStartTimes: WeakMap<Document, number>;
    skeletonIconRowWidths: number[];
    skeletonTextRowWidths: number[];
    skeletonLineWidths: string[];
    SkeletonPrimitive: SkeletonPrimitiveComponent;
    initializeUiDisclosure10: () => void;
    useSurfaceStyle: (surface: SurfaceName | undefined) => CssVariableStyle;
    reactForUiDisclosure4: ReactNamespace;
    jsxForUiDisclosure3: JsxNamespace;
    Surface: ForwardRefExoticComponent<SurfaceProps & RefAttributes<HTMLDivElement>>;
    initializeUiDisclosure11: () => void;
    TEXT_INPUT_SURFACE_CLASS: string;
    TEXT_INPUT_HOVER_CLASS: string;
    TEXT_INPUT_CLASS: string;
    TEXT_INPUT_REQUIRED_CLASS: string;
    TEXT_INPUT_PLACEHOLDER_CLASS: string;
    TEXT_INPUT_INVALID_CLASS: string;
    initializeUiDisclosure12: () => void;
  }
}

export function installUiDisclosure(runtime: RuntimeBindings): () => void {
  var PRESERVE_INPUT_FOCUS_PROPS: RuntimeBindings["PRESERVE_INPUT_FOCUS_PROPS"];
  var initializeUiDisclosure: RuntimeBindings["initializeUiDisclosure"];
  var react_k: ReactNamespace;
  var initializeUiDisclosure2: RuntimeBindings["initializeUiDisclosure2"];
  var reactForUiDisclosure: ReactNamespace;
  var DISCLOSURE_PANEL_CLASS: RuntimeBindings["DISCLOSURE_PANEL_CLASS"];
  var isHeightTransitionAnimation: RuntimeBindings["isHeightTransitionAnimation"];
  var observeDisclosureHeightAnimation: RuntimeBindings["observeDisclosureHeightAnimation"];
  var useDisclosureAnimationRef: RuntimeBindings["useDisclosureAnimationRef"];
  var useDisclosureBodyRef: RuntimeBindings["useDisclosureBodyRef"];
  var initializeUiDisclosure3: RuntimeBindings["initializeUiDisclosure3"];
  var reactForUiDisclosure2: ReactNamespace;
  var jsxForUiDisclosure: JsxNamespace;
  var CollapsibleRoot: RuntimeBindings["CollapsibleRoot"];
  var COLLAPSIBLE_TRIGGER_CLASS: RuntimeBindings["COLLAPSIBLE_TRIGGER_CLASS"];
  var COLLAPSIBLE_ICON_CLASS: RuntimeBindings["COLLAPSIBLE_ICON_CLASS"];
  var CollapsibleTrigger: RuntimeBindings["CollapsibleTrigger"];
  var COLLAPSIBLE_PANEL_CLASS: RuntimeBindings["COLLAPSIBLE_PANEL_CLASS"];
  var CollapsiblePanel: RuntimeBindings["CollapsiblePanel"];
  var Collapsible: RuntimeBindings["Collapsible"];
  var initializeUiDisclosure4: RuntimeBindings["initializeUiDisclosure4"];
  var reactcK: ReactNamespace;
  var jsxEq: JsxNamespace;
  var spinnerSizeAliases: RuntimeBindings["spinnerSizeAliases"];
  var spinnerSizeMetrics: RuntimeBindings["spinnerSizeMetrics"];
  var initializeUiDisclosure5: RuntimeBindings["initializeUiDisclosure5"];
  var reactForUiDisclosure3: ReactNamespace;
  var CompactableContext: RuntimeBindings["CompactableContext"];
  var COMPACTABLE_ATTRIBUTE: RuntimeBindings["COMPACTABLE_ATTRIBUTE"];
  var initializeUiDisclosure6: RuntimeBindings["initializeUiDisclosure6"];
  var reacttq0: ReactNamespace;
  var initializeUiDisclosure7: RuntimeBindings["initializeUiDisclosure7"];
  var reactf6: ReactNamespace;
  var jsxh3: JsxNamespace;
  var loadedTooltipImplementation: RuntimeBindings["loadedTooltipImplementation"];
  var tooltipImplementationPromise: RuntimeBindings["tooltipImplementationPromise"];
  var tooltipImplementationListeners: RuntimeBindings["tooltipImplementationListeners"];
  var tooltipBatchTimer: RuntimeBindings["tooltipBatchTimer"];
  var tooltipBatchCallbacks: RuntimeBindings["tooltipBatchCallbacks"];
  var tooltipPreloadEvents: RuntimeBindings["tooltipPreloadEvents"];
  var tooltipPreloadStarted: RuntimeBindings["tooltipPreloadStarted"];
  var pendingTooltipProps: RuntimeBindings["pendingTooltipProps"];
  var TOUCH_TOOLTIP_HOLD_MS: RuntimeBindings["TOUCH_TOOLTIP_HOLD_MS"];
  var deferredTooltipImplementationContext: RuntimeBindings["deferredTooltipImplementationContext"];
  var initializeUiDisclosure8: RuntimeBindings["initializeUiDisclosure8"];
  var reacttJ: ReactNamespace;
  var jsxForUiDisclosure2: JsxNamespace;
  var stopEvent: RuntimeBindings["stopEvent"];
  var BUTTON_ON_ACCENT_TEXT_CLASS: RuntimeBindings["BUTTON_ON_ACCENT_TEXT_CLASS"];
  var BUTTON_END_ICON_OFFSET_CLASS: RuntimeBindings["BUTTON_END_ICON_OFFSET_CLASS"];
  var buttonVariants: RuntimeBindings["buttonVariants"];
  var BUTTON_ON_CONTENT_FILL_CLASS: RuntimeBindings["BUTTON_ON_CONTENT_FILL_CLASS"];
  var buttonPaintVariants: RuntimeBindings["buttonPaintVariants"];
  var buttonGroupContext: RuntimeBindings["buttonGroupContext"];
  var BUTTON_SEGMENT_RADIUS_CLASSES: RuntimeBindings["BUTTON_SEGMENT_RADIUS_CLASSES"];
  var BUTTON_OUTSET_CLASSES: RuntimeBindings["BUTTON_OUTSET_CLASSES"];
  var BUTTON_OUTSET_STYLES: RuntimeBindings["BUTTON_OUTSET_STYLES"];
  var buttonIconSizeContext: RuntimeBindings["buttonIconSizeContext"];
  var Button: RuntimeBindings["Button"];
  var initializeUiDisclosure9: RuntimeBindings["initializeUiDisclosure9"];
  var reactz6: ReactNamespace;
  var jsxW7: JsxNamespace;
  var skeletonElementTags: RuntimeBindings["skeletonElementTags"];
  var pendingShimmerElements: RuntimeBindings["pendingShimmerElements"];
  var shimmerStartTimes: RuntimeBindings["shimmerStartTimes"];
  var skeletonNotShownSnapshot: RuntimeBindings["skeletonNotShownSnapshot"];
  var skeletonShownSnapshot: RuntimeBindings["skeletonShownSnapshot"];
  var SKELETON_BREATHE_ANIMATION: RuntimeBindings["SKELETON_BREATHE_ANIMATION"];
  var SKELETON_SWEEP_ANIMATION: RuntimeBindings["SKELETON_SWEEP_ANIMATION"];
  var SKELETON_ANIMATION_DURATION_MS: RuntimeBindings["SKELETON_ANIMATION_DURATION_MS"];
  var DEFAULT_SKELETON_MOTION: RuntimeBindings["DEFAULT_SKELETON_MOTION"];
  var SKELETON_MINIMUM_HOLD_MS: RuntimeBindings["SKELETON_MINIMUM_HOLD_MS"];
  var SKELETON_DURATION_LIMIT_MS: RuntimeBindings["SKELETON_DURATION_LIMIT_MS"];
  var SKELETON_SYNC_TOLERANCE_MS: RuntimeBindings["SKELETON_SYNC_TOLERANCE_MS"];
  var skeletonAnimationStartTimes: RuntimeBindings["skeletonAnimationStartTimes"];
  var skeletonIconRowWidths: RuntimeBindings["skeletonIconRowWidths"];
  var skeletonTextRowWidths: RuntimeBindings["skeletonTextRowWidths"];
  var skeletonLineWidths: RuntimeBindings["skeletonLineWidths"];
  var SkeletonPrimitive: RuntimeBindings["SkeletonPrimitive"];
  var initializeUiDisclosure10: RuntimeBindings["initializeUiDisclosure10"];
  var reactForUiDisclosure4: ReactNamespace;
  var jsxForUiDisclosure3: JsxNamespace;
  var Surface: RuntimeBindings["Surface"];
  var initializeUiDisclosure11: RuntimeBindings["initializeUiDisclosure11"];
  var TEXT_INPUT_SURFACE_CLASS: RuntimeBindings["TEXT_INPUT_SURFACE_CLASS"];
  var TEXT_INPUT_HOVER_CLASS: RuntimeBindings["TEXT_INPUT_HOVER_CLASS"];
  var TEXT_INPUT_CLASS: RuntimeBindings["TEXT_INPUT_CLASS"];
  var TEXT_INPUT_REQUIRED_CLASS: RuntimeBindings["TEXT_INPUT_REQUIRED_CLASS"];
  var TEXT_INPUT_PLACEHOLDER_CLASS: RuntimeBindings["TEXT_INPUT_PLACEHOLDER_CLASS"];
  var TEXT_INPUT_INVALID_CLASS: RuntimeBindings["TEXT_INPUT_INVALID_CLASS"];
  var initializeUiDisclosure12: RuntimeBindings["initializeUiDisclosure12"];
  function preventRepeatedClickSelection(event: ClickSelectionEvent) {
    if (event.detail <= 1 || event.button !== 0) {
      return;
    }
    if (
      (event.target as Element).closest?.(
        "input:not([type='hidden']):not([disabled]),[contenteditable]:not([contenteditable='false']),textarea:not([disabled])",
      )
    ) {
      return;
    }
    event.preventDefault();
  }
  function withRepeatedClickSelectionPrevention<E extends ClickSelectionEvent>(
    onMouseDown?: (event: E) => void,
  ): (event: E) => void {
    if (!onMouseDown) {
      return preventRepeatedClickSelection;
    }
    return (input: E) => {
      onMouseDown(input);
      preventRepeatedClickSelection(input);
    };
  }
  function useHiddenUntilFoundRef() {
    let ref = react_k.useRef<BeforeMatchRecovery | null>(null);
    return react_k.useCallback((input: HTMLElement | null) => {
      if (!input || input === ref.current?.node) {
        return;
      }
      ref.current?.detach();
      ref.current = {
        node: input,
        detach: attachBeforeMatchStyleRecovery(input),
      };
    }, []);
  }
  function attachBeforeMatchStyleRecovery(element: HTMLElement): () => void {
    let value: (() => void) | undefined,
      value2: MutationObserver | undefined,
      callback = () => {
        value2?.disconnect();
        value2 = undefined;
        value?.();
        value = undefined;
      },
      callback2 = (event: Event) => {
        if (event.target !== element || value) {
          return;
        }
        value = overrideInlineStyles(element, {
          height: "auto",
          "transition-property": "none",
        });
        value2 = new (element.ownerDocument.defaultView?.MutationObserver ??
          MutationObserver)(() => {
          if (element.hasAttribute("data-open")) {
            callback();
          }
        });
        value2.observe(element, {
          attributes: true,
          attributeFilter: ["data-open"],
        });
      };
    element.addEventListener("beforematch", callback2);
    return () => {
      element.removeEventListener("beforematch", callback2);
      callback();
    };
  }
  function overrideInlineStyles(element: HTMLElement, styles: Record<string, string>) {
    let previousStyles: [string, string, string][] = Object.keys(styles).map(
      (input) => [
        input,
        element.style.getPropertyValue(input),
        element.style.getPropertyPriority(input),
      ],
    );
    for (let [value, value2] of Object.entries(styles))
      element.style.setProperty(value, value2);
    return () => {
      for (let [value, value2, value3] of previousStyles)
        if (value2) {
          element.style.setProperty(value, value2, value3);
        } else {
          element.style.removeProperty(value);
        }
    };
  }
  function Spinner({
    size = "sm",
    delay = 0,
    inheritColor = false,
    label: label,
    className: className,
  }: SpinnerProps) {
    let [value, value2] = reactcK.useState(delay <= 0),
      [value3, value4] = reactcK.useState(delay);
    if (delay !== value3) {
      value4(delay);
      if (delay > 0 && value) {
        value2(false);
      }
    }
    let value5 = delay <= 0 || value;
    reactcK.useEffect(() => {
      if (delay <= 0) {
        return;
      }
      let value14 = window.setTimeout(
        () => value2(true),
        delay,
      );
      return () => window.clearTimeout(value14);
    }, [delay]);
    let value6 = spinnerSizeMetrics[(spinnerSizeAliases[size] ?? size) as SpinnerSizeName],
      value7 = inheritColor ? "currentColor" : "var(--cds-text-muted)",
      value8 = inheritColor
        ? "color-mix(in srgb, currentColor 25%, transparent)"
        : "var(--cds-border)",
      value9 = (0, runtime.pixelsToScaledRem)(value6.box),
      value10 = (0, runtime.pixelsToScaledRem)(value6.stroke),
      value11 = `calc(100% - ${value10})`,
      value12 = `radial-gradient(farthest-side, transparent ${value11}, #000 calc(${value11} + 0.5px))`,
      value13 = !value5
        ? null
        : jsxEq.jsxs("span", {
            "data-cds": "Spinner",
            className: (0, runtime.cn)(
              "relative inline-block shrink-0 align-middle",
              className,
            ),
            style: {
              width: value9,
              height: value9,
            },
            "aria-hidden": true,
            children: [
              jsxEq.jsx("span", {
                className: "absolute inset-0 rounded-full",
                style: {
                  border: `${value10} solid ${value8}`,
                },
              }),
              jsxEq.jsx("span", {
                className:
                  "absolute inset-0 rounded-full animate-[spin_1s_linear_infinite] motion-reduce:animate-none",
                style: {
                  background: `conic-gradient(transparent 40%, ${value7})`,
                  WebkitMask: value12,
                  mask: value12,
                },
              }),
            ],
          });
    if (!label) {
      return value13;
    }
    return jsxEq.jsxs("span", {
      role: "status",
      className: "leading-[0]",
      children: [
        value13,
        jsxEq.jsx(DelayedScreenReaderLabel, {
          show: value5,
          children: label,
        }),
      ],
    });
  }
  function DelayedScreenReaderLabel({
    show: show,
    children: children,
  }: DelayedScreenReaderLabelProps) {
    let [value, value2] = reactcK.useState(false);
    reactcK.useEffect(() => {
      let value3 = window.setTimeout(
        () => value2(true),
        100,
      );
      return () => window.clearTimeout(value3);
    }, []);
    if (show && value) {
      return jsxEq.jsx("span", {
        className: "sr-only",
        children: children,
      });
    } else {
      return null;
    }
  }
  function useCompactable() {
    return reactForUiDisclosure3.useContext(CompactableContext);
  }
  function useCompactableControlDebug(
    input: RefObject<HTMLElement | null>,
    options: string,
  ) {
    reacttq0.useEffect(() => {
      return;
    }, [input, options]);
  }
  function scheduleTooltipUpdate(input: () => void) {
    tooltipBatchCallbacks.add(input);
    tooltipBatchTimer ??= setTimeout(() => {
      tooltipBatchTimer = null;
      let items = [...tooltipBatchCallbacks];
      tooltipBatchCallbacks.clear();
      for (let value of items) value();
    }, 0);
  }
  function cancelTooltipUpdate(input: () => void) {
    tooltipBatchCallbacks.delete(input);
  }
  function loadTooltipImplementation() {
    tooltipImplementationPromise ??= Promise.resolve()
      .then(() => {
        (0, runtime.initializeTooltip)();
        return runtime.tooltipExports;
      })
      .then(
        (input) => {
          loadedTooltipImplementation = input;
          for (let value of tooltipImplementationListeners) value();
          return input;
        },
        (input) => {
          throw ((tooltipImplementationPromise = null), input);
        },
      );
    return tooltipImplementationPromise;
  }
  function preloadTooltipsOnInteraction() {
    if (tooltipPreloadStarted || loadedTooltipImplementation !== null) {
      return;
    }
    if (typeof document === "undefined") {
      return;
    }
    tooltipPreloadStarted = true;
    for (let value of tooltipPreloadEvents)
      document.addEventListener(value, requestTooltipPreload, {
        capture: true,
        passive: true,
        once: true,
      });
  }
  function requestTooltipPreload() {
    loadTooltipImplementation().catch(() => {
      return;
    });
  }
  function adoptTooltipTrigger(input: TooltipTriggerState, options: HTMLElement | null) {
    input.node = options;
    if (options === null) {
      return;
    }
    input.adopted = true;
    if (input.handBack) {
      input.handBack = false;
      queueMicrotask(
        () => restoreDeferredTooltipFocus(input, options),
      );
    }
  }
  function restoreDeferredTooltipFocus(
    input: TooltipTriggerState,
    element: HTMLElement,
  ) {
    if (!element.isConnected || !input.focus) {
      return;
    }
    let activeElement = element.ownerDocument.activeElement;
    if (
      activeElement !== null &&
      activeElement !== element.ownerDocument.body
    ) {
      return;
    }
    element.focus({
      preventScroll: true,
    });
  }
  function cancelTooltipTouchHold(input: TooltipTriggerState) {
    if (input.tapHold !== null) {
      clearTimeout(input.tapHold);
      input.tapHold = null;
    }
  }
  function releaseTooltipTouchHold(
    input: TooltipTriggerState,
    options: { type: string; pointerType?: string },
    context: () => void,
  ) {
    cancelTooltipTouchHold(input);
    if (
      input.down &&
      options.type === "pointerup" &&
      (options.pointerType === "touch" || options.pointerType === "pen")
    ) {
      input.tapHold = setTimeout(() => {
        input.tapHold = null;
        input.down = false;
        context();
      }, TOUCH_TOOLTIP_HOLD_MS);
      return;
    }
    input.down = false;
    context();
  }
  function resolveTooltipImplementation(input: DeferredTooltipHost | null): TooltipImplementation | null {
    if (loadedTooltipImplementation !== null) {
      return loadedTooltipImplementation;
    }
    if (input === null) {
      return null;
    } else {
      return input.ambientImpl();
    }
  }
  function hasNonVisibleFocus(element: Element) {
    if (element.ownerDocument.activeElement !== element) {
      return false;
    }
    try {
      return !element.matches(":focus-visible");
    } catch {
      return false;
    }
  }
  function useDeferredTooltipImplementation(input: boolean) {
    let value = reactf6.useContext(
        runtime.tooltipImplementationContext,
      ),
      value2 = reactf6.useContext(
        deferredTooltipImplementationContext,
      ),
      [value3, value4] = reactf6.useState<TooltipSlot | null>(() => {
        let value7 =
          value ??
          (value2 !== null && value2.isDeferred()
            ? null
            : resolveTooltipImplementation(value2));
        if (value7 === null) {
          return null;
        } else {
          return {
            impl: value7,
            track: undefined,
          };
        }
      }),
      value5 = value3 === null ? null : value3.impl,
      [value6] = reactf6.useState(value5 === null),
      ref = reactf6.useRef<TooltipTriggerState>({
        hover: false,
        focus: false,
        down: false,
        node: null,
        adopted: false,
        handBack: false,
        tapHold: null,
      }),
      ref2 = reactf6.useRef(false),
      callback = reactf6.useCallback(() => {
        if (ref.current.adopted || (value2 !== null && value2.isDeferred())) {
          return;
        }
        let {
          hover: current,
          focus: current2,
          down: current3,
          node: current4,
        } = ref.current;
        if (current3) {
          return;
        }
        let current5 = ref2.current;
        ref2.current = false;
        let value7 =
          current2 &&
          input &&
          current4 !== null &&
          hasNonVisibleFocus(current4);
        if (current2 && !value7) {
          return;
        }
        let value8 = resolveTooltipImplementation(value2);
        if (value8 !== null && (!current || current5)) {
          let current6 = ref.current;
          current6.handBack = value7;
          value4(
            (input2: TooltipSlot | null) =>
              input2 ?? {
                impl: value8,
                track: input
                  ? (input3: HTMLElement | null) =>
                      adoptTooltipTrigger(current6, input3)
                  : undefined,
              },
          );
        }
      }, [value2, input]),
      callback2 = reactf6.useCallback(() => {
        if (resolveTooltipImplementation(value2) === null) {
          return;
        }
        scheduleTooltipUpdate(callback);
      }, [value2, callback]),
      callback3 = reactf6.useCallback(() => {
        ref2.current = resolveTooltipImplementation(value2) !== null;
        callback2();
      }, [callback2, value2]),
      ref3 = reactf6.useRef<TouchReleaseListener | null>(null),
      callback4 = reactf6.useCallback(() => {
        let current = ref3.current;
        if (current === null) {
          return;
        }
        ref3.current = null;
        current.doc.removeEventListener("pointerup", current.release, true);
        current.doc.removeEventListener("pointercancel", current.release, true);
      }, []),
      callback5 = reactf6.useCallback(
        (input2: Document, options?: number) => {
          if (ref3.current !== null) {
            return;
          }
          let callback7 = (input3: PointerEvent) => {
            let pointerId = input3.pointerId;
            if (
              options !== undefined &&
              pointerId !== undefined &&
              pointerId !== options
            ) {
              return;
            }
            callback4();
            releaseTooltipTouchHold(ref.current, input3, callback2);
          };
          ref3.current = {
            doc: input2,
            release: callback7,
          };
          input2.addEventListener("pointerup", callback7, {
            capture: true,
          });
          input2.addEventListener("pointercancel", callback7, {
            capture: true,
          });
        },
        [callback2, callback4],
      );
    reactf6.useEffect(() => {
      if (!value6) {
        return;
      }
      preloadTooltipsOnInteraction();
      let current = ref.current,
        callback7 = () => {
          cancelTooltipUpdate(callback);
          if (current.tapHold !== null) {
            cancelTooltipTouchHold(current);
            current.down = false;
          }
          callback4();
        },
        items: (() => void)[] = [],
        value7 = value2 !== null && value2.isDeferred();
      if (value7) {
        items.push(value2!.subscribe(callback3));
      }
      if (loadedTooltipImplementation === null) {
        tooltipImplementationListeners.add(callback2);
        items.push(
          () => tooltipImplementationListeners.delete(callback2),
        );
      }
      if (!value7 && resolveTooltipImplementation(value2) !== null) {
        if (value2 !== null) {
          ref2.current = true;
        }
        callback2();
      }
      return () => {
        for (let value8 of items) value8();
        callback7();
      };
    }, [callback2, callback3, value2, callback4, callback, value6]);
    let callback6 = reactf6.useCallback(() => {
      loadTooltipImplementation().catch(() => {
        return;
      });
    }, []);
    return {
      impl: value5,
      wasCold: value6,
      interceptors: reactf6.useCallback(
        (input2: TooltipTriggerHandlers) => {
          let callback7 =
            <E>(input3: (event: E) => void, options?: (event: E) => void) =>
            (input4: E) => {
              input3(input4);
              options?.(input4);
            };
          return {
            onPointerEnter: callback7(() => {
              ref.current.hover = true;
              callback6();
            }, input2.onPointerEnter),
            onPointerLeave: callback7(() => {
              ref.current.hover = false;
              callback2();
            }, input2.onPointerLeave),
            onPointerDown: callback7((input3: ReactPointerEvent<HTMLElement>) => {
              if (input3.isPrimary !== false && input3.button === 0) {
                cancelTooltipTouchHold(ref.current);
                ref.current.down = true;
                callback5(input3.currentTarget.ownerDocument, input3.pointerId);
              }
            }, input2.onPointerDown),
            onPointerUp: callback7((input3: ReactPointerEvent<HTMLElement>) => {
              if (input3.isPrimary !== false) {
                releaseTooltipTouchHold(ref.current, input3, callback2);
              }
            }, input2.onPointerUp),
            onPointerCancel: callback7((input3: ReactPointerEvent<HTMLElement>) => {
              if (input3.isPrimary !== false) {
                releaseTooltipTouchHold(ref.current, input3, callback2);
              }
            }, input2.onPointerCancel),
            onClick: callback7((input3: ReactMouseEvent<HTMLElement>) => {
              if (ref.current.tapHold !== null) {
                releaseTooltipTouchHold(ref.current, input3, callback2);
              }
            }, input2.onClick),
            onFocus: callback7((input3: ReactFocusEvent<HTMLElement>) => {
              ref.current.focus = true;
              ref.current.node = (0, runtime.asElement)(input3.currentTarget);
              callback6();
            }, input2.onFocus),
            onBlur: callback7(() => {
              ref.current.focus = false;
              callback2();
            }, input2.onBlur),
          };
        },
        [callback2, callback5, callback6],
      ),
      trackTrigger: value3?.track,
    };
  }
  function disableElementAutofocus(input: ReactNode) {
    if (reactf6.isValidElement<{ autoFocus?: boolean }>(input)) {
      return reactf6.cloneElement(input, {
        autoFocus: false,
      });
    } else {
      return input;
    }
  }
  function DeferredTooltip(input: DeferredTooltipProps) {
    let {
        impl: value,
        wasCold: value2,
        interceptors: value3,
        trackTrigger: value4,
      } = useDeferredTooltipImplementation(true),
      value5 = input.autoFocus === false;
    if (value !== null) {
      if (value2 || value5) {
        return jsxh3.jsx(value.Tooltip, {
          ...input,
          triggerRef: value4,
          children: disableElementAutofocus(input.children),
        });
      } else {
        return jsxh3.jsx(value.Tooltip, {
          ...input,
        });
      }
    }
    let { children: value6 } = input;
    if (!reactf6.isValidElement<TooltipTriggerHandlers>(value6)) {
      return jsxh3.jsx(jsxh3.Fragment, {
        children: value6,
      });
    }
    let value7 = value6;
    return reactf6.cloneElement(value7, {
      ...value3(value7.props),
      ...pendingTooltipProps,
    });
  }
  function DeferredDisabledReasonTooltip(input: DeferredDisabledReasonTooltipProps) {
    let {
        impl: value,
        wasCold: value2,
        interceptors: value3,
      } = useDeferredTooltipImplementation(false),
      value4 = reactf6.useId();
    if (value !== null) {
      if (value2) {
        return jsxh3.jsx(value.DisabledReasonTooltip, {
          ...input,
          children: disableElementAutofocus(input.children),
        });
      } else {
        return jsxh3.jsx(value.DisabledReasonTooltip, {
          ...input,
        });
      }
    }
    let {
      reason: value5,
      wrapperClassName: value6,
      children: value7,
    } = input;
    return jsxh3.jsxs("span", {
      ...(0, runtime.getDisabledReasonWrapperProps)(value5, value4, value6),
      title: typeof value5 === "string" ? value5 : undefined,
      ...value3({}),
      ...pendingTooltipProps,
      children: [
        value7,
        jsxh3.jsx(runtime.DisabledReasonAnnouncement, {
          id: value4,
          reason: value5,
        }),
      ],
    });
  }
  function isButtonActivationKey(input: Pick<ReactKeyboardEvent, "key">) {
    return input.key === "Enter" || input.key === " ";
  }
  function isUnmodifiedButtonActivation(input: ButtonActivationEvent) {
    return (
      isButtonActivationKey(input) &&
      !input.ctrlKey &&
      !input.metaKey &&
      !input.altKey &&
      !input.shiftKey
    );
  }
  function useButtonGroup() {
    return reacttJ.useContext(buttonGroupContext);
  }
  function getButtonIconSize(input: ButtonSize): IconSizeSetting {
    if (input === "xs" || input === "xxs") {
      return "auto-sm";
    }
    if (input === "lg") {
      return "md";
    } else {
      return "auto";
    }
  }
  function useButtonIconSize(input?: ButtonSize) {
    let value = useButtonGroup(),
      value2 = reacttJ.useContext(buttonIconSizeContext);
    return (0, runtime.useIconSize)(
      input !== undefined
        ? getButtonIconSize(input)
        : (value2 ??
            (value?.size !== undefined
              ? getButtonIconSize(value.size)
              : "auto")),
    );
  }
  function getButtonIconVerticalPadding(input: IconSizeName) {
    return `calc((var(--cds-h-control) - ${(0, runtime.pixelsToScaledRem)(runtime.iconSizeMetrics[input].px)}) / 2)`;
  }
  function isShimmerAnimation(input: NamedAnimation) {
    return input.animationName === "cds-shimmer";
  }
  function synchronizeDocumentShimmers(input: Document) {
    let value: number | undefined,
      items: Animation[] = [];
    for (let value3 of input.getAnimations()) {
      if (!isShimmerAnimation(value3)) {
        continue;
      }
      let { startTime: value4 } = value3;
      if (
        typeof value4 === "number" &&
        (value === undefined || value4 < value)
      ) {
        value = value4;
      }
      let value5 = (value3.effect as KeyframeEffect | null)?.target;
      if (
        value5 !== undefined &&
        value5 !== null &&
        pendingShimmerElements.has(value5) &&
        value3.playState === "running"
      ) {
        items.push(value3);
      }
    }
    let value2 = value ?? shimmerStartTimes.get(input) ?? 0;
    for (let value3 of items) value3.startTime = value2;
    shimmerStartTimes.set(input, value2);
  }
  function flushShimmerSynchronization() {
    try {
      let values = new Set<Document>();
      for (let value of pendingShimmerElements)
        values.add(value.ownerDocument);
      for (let value of values) synchronizeDocumentShimmers(value);
    } finally {
      pendingShimmerElements.clear();
    }
  }
  function scheduleShimmerSynchronization(element: Element | null) {
    if (
      element === null ||
      typeof element.ownerDocument.getAnimations !== "function"
    ) {
      return;
    }
    if (pendingShimmerElements.size === 0) {
      queueMicrotask(flushShimmerSynchronization);
    }
    pendingShimmerElements.add(element);
  }
  function createSkeletonShownStore(): SkeletonShownStore {
    let snapshot = skeletonNotShownSnapshot,
      listeners = new Set<() => void>(),
      setSnapshot = (input: SkeletonShownSnapshot) => {
        if (snapshot === input) {
          return;
        }
        snapshot = input;
        for (let value of listeners)
          (0, runtime.invokeAndReportError)(value);
      };
    return {
      getSnapshot: () => snapshot,
      subscribe: (input: () => void) => {
        listeners.add(input);
        return () => {
          listeners.delete(input);
        };
      },
      markShown: () => setSnapshot(skeletonShownSnapshot),
      reset: () => setSnapshot(skeletonNotShownSnapshot),
    };
  }
  function markSkeletonShownAfterCallback(
    input: (() => void) | undefined,
    options: SkeletonShownStore,
  ) {
    try {
      input?.();
    } finally {
      options.markShown();
    }
  }
  function clearSkeletonElapsedStyle(input: HTMLElement) {
    input.style.removeProperty("--cds-skel-elapsed");
  }
  function setSkeletonMotion(input: HTMLElement, options: SkeletonMotion) {
    input.dataset.motion = options;
  }
  function ensurePositionedSkeletonHost(input: HTMLElement) {
    let position = getComputedStyle(input).position;
    if (position === "static" || position === "") {
      input.style.position = "relative";
      return true;
    }
    return false;
  }
  function synchronizeSkeletonAnimation(
    element: HTMLElement,
    options = SKELETON_BREATHE_ANIMATION,
    context = 0,
  ) {
    if (typeof element.getAnimations !== "function") {
      return;
    }
    let value = element
      .getAnimations()
      .find((input: NamedAnimation) => input.animationName === options);
    if (value === undefined || typeof value.startTime !== "number") {
      return;
    }
    let value2 = value.effect?.getComputedTiming();
    if (
      value2?.duration !== SKELETON_ANIMATION_DURATION_MS ||
      value2.iterations !== 1 / 0
    ) {
      return;
    }
    let value3 = value.startTime + (value2.delay ?? 0),
      value4 = value3 - context,
      ownerDocument = element.ownerDocument,
      entry = skeletonAnimationStartTimes.get(ownerDocument);
    if (entry === undefined) {
      skeletonAnimationStartTimes.set(ownerDocument, value4);
      return;
    }
    let value5 =
      (((value4 - entry) % SKELETON_ANIMATION_DURATION_MS) +
        SKELETON_ANIMATION_DURATION_MS) %
      SKELETON_ANIMATION_DURATION_MS;
    if (value5 < SKELETON_SYNC_TOLERANCE_MS || value5 > 1999) {
      return;
    }
    let value6 =
        typeof value.currentTime === "number"
          ? value.startTime + value.currentTime
          : value3,
      value7 = Math.ceil(
        (Math.max(value6, value3) - (entry + context)) /
          SKELETON_ANIMATION_DURATION_MS,
      );
    value.startTime =
      entry +
      context +
      value7 * SKELETON_ANIMATION_DURATION_MS -
      (value2.delay ?? 0);
  }
  function SkeletonGroup({
    children: children,
    hold = "delayed",
    label: label,
    className: className,
    decorative = false,
    onShown: onShown,
    onHidden: onHidden,
    as: as2,
    motion = DEFAULT_SKELETON_MOTION,
  }: SkeletonGroupProps): ReactElement {
    let value = reactz6.useContext(runtime.skeletonActiveContext),
      value2 = reactz6.useContext(runtime.skeletonElementContext),
      [value3] = reactz6.useState(as2 ?? value2),
      value4 = skeletonElementTags[value3],
      value5 = value3 === "span",
      value6 = reactz6.useContext(runtime.skeletonGroupContext),
      value7 = reactz6.useContext(runtime.skeletonShownStoreContext),
      [value8] = reactz6.useState(() => {
        let value18 = createSkeletonShownStore();
        if (value ? value7?.getSnapshot().shown === true : hold !== "delayed") {
          value18.markShown();
        }
        return value18;
      }),
      [value9] = reactz6.useState(value6),
      [value10, value11] = reactz6.useState(false),
      ref = reactz6.useRef(false),
      value12 = value && !value10,
      callback = reactz6.useCallback(
        (input: HTMLElement | null) => {
          if (
            input !== null &&
            input.parentElement !== null &&
            input.parentElement.closest('[data-cds="SkeletonGroup"]') === null
          ) {
            ref.current = true;
            value8.reset();
            value11(true);
          }
        },
        [value8],
      ),
      value13 = (0, runtime.useTranslation)("loading", "Loading"),
      [value14] = reactz6.useState(hold),
      value15 = value14 === "delayed",
      value16 = label ?? value13,
      ref2 = reactz6.useRef<HTMLElement | null>(null),
      callback2 = reactz6.useCallback((input: HTMLElement | null) => {
        ref2.current = input;
      }, []),
      ref3 = reactz6.useRef(false),
      ref4 = reactz6.useRef({
        onShown: onShown,
        onHidden: onHidden,
        labelText: value16,
      });
    reactz6.useEffect(() => {
      ref4.current = {
        onShown: onShown,
        onHidden: onHidden,
        labelText: value16,
      };
      if (ref3.current && ref2.current !== null) {
        let element = ref2.current.querySelector(
          "[data-skeleton-label]",
        );
        if (element !== null && element.textContent !== value16) {
          element.textContent = value16;
        }
      }
    }, [onShown, onHidden, value16, decorative]);
    reactz6.useLayoutEffect(() => {
      if (!value12 && !value15 && !ref3.current) {
        ref3.current = true;
        markSkeletonShownAfterCallback(ref4.current.onShown, value8);
      }
    }, [value12, value15, value8]);
    reactz6.useLayoutEffect(() => {
      if (!value12 || ref.current || value7 === null) {
        return;
      }
      let callback4 = () => {
        if (!value7.getSnapshot().shown) {
          value8.reset();
        } else if (!ref3.current) {
          ref3.current = true;
          markSkeletonShownAfterCallback(ref4.current.onShown, value8);
        } else {
          value8.markShown();
        }
      };
      callback4();
      return value7.subscribe(callback4);
    }, [value12, value7, value8]);
    reactz6.useEffect(
      () => () => {
        if (ref3.current) {
          ref4.current.onHidden?.();
          ref3.current = false;
        }
        value8.reset();
      },
      [value8],
    );
    reactz6.useLayoutEffect(() => {
      let current = ref2.current;
      if (current === null || value12 || !value15 || value9 === null) {
        return;
      }
      let value18 = performance.now() - value9;
      if (!Number.isFinite(value18) || value18 <= 0) {
        return;
      }
      current.style.setProperty("--cds-skel-elapsed", `${value18}ms`);
      return () => clearSkeletonElapsedStyle(current);
    }, [value12, value15, value9]);
    let ref5 = reactz6.useRef<HTMLElement | null>(null),
      callback3 = reactz6.useCallback((input: HTMLElement | null) => {
        ref5.current = input;
      }, []);
    reactz6.useEffect(() => {
      let current = ref5.current,
        current2 = ref2.current;
      if (
        motion !== "sweep" ||
        value12 ||
        current === null ||
        current2 === null
      ) {
        return;
      }
      let value18 = ensurePositionedSkeletonHost(current2),
        callback4 = () => {
          let items: string[] = [],
            value20 = current2.querySelectorAll<HTMLElement>(
              '[data-cds="Skeleton"]',
            );
          setSkeletonMotion(
            current2,
            value20.length === 0 ? "lockstep" : "sweep",
          );
          for (let value21 of value20) {
            let index = 0,
              index2 = 0,
              value22: HTMLElement | null = value21;
            while (value22 !== null && value22 !== current2)
              if (
                ((index += value22.offsetLeft),
                (index2 += value22.offsetTop),
                (value22 = value22.offsetParent as HTMLElement | null),
                value22 !== null && value22 !== current2)
              ) {
                index += value22!.clientLeft - value22!.scrollLeft;
                index2 += value22!.clientTop - value22!.scrollTop;
              }
            if (value22 !== current2) {
              continue;
            }
            items.push(
              `M${index},${index2}h${value21.offsetWidth}v${value21.offsetHeight}h${-value21.offsetWidth}Z`,
            );
          }
          current.style.clipPath = items.length
            ? `path("${items.join(" ")}")`
            : "";
          current.style.visibility = items.length ? "visible" : "hidden";
        };
      callback4();
      let value19 = (0, runtime.createSafeResizeObserver)(
        (0, runtime.getResizeObserverConstructor)(current2) ?? ResizeObserver,
        callback4,
      );
      value19.observe(current2);
      return () => {
        value19.disconnect();
        if (value18) {
          current2.style.removeProperty("position");
        }
      };
    }, [motion, value12]);
    reactz6.useEffect(() => {
      let current = ref2.current;
      if (motion !== "wave" || value12 || current === null) {
        return;
      }
      let callback4 = () => {
        let value19 = current.querySelectorAll<HTMLElement>(
            '[data-cds="Skeleton"]',
          ),
          value20 = Math.floor(
            SKELETON_ANIMATION_DURATION_MS / SKELETON_MINIMUM_HOLD_MS,
          ),
          index = 0;
        for (let value21 of value19)
          if (value21.style.getPropertyValue("--cds-skel-i") !== "") {
            index += 1;
          }
        for (let value21 of value19)
          if (value21.style.getPropertyValue("--cds-skel-i") === "") {
            value21.style.setProperty("--cds-skel-i", String(index % value20));
            index += 1;
          }
        setSkeletonMotion(current, value19.length === 0 ? "lockstep" : "wave");
      };
      callback4();
      let value18 = (0, runtime.createSafeMutationObserver)(
        MutationObserver,
        callback4,
      );
      value18.observe(current, {
        childList: true,
        subtree: true,
      });
      return () => value18.disconnect();
    }, [motion, value12]);
    let value17 = value5
      ? (0, runtime.cn)("block", className)
      : className;
    if (value12) {
      return jsxW7.jsx(value4, {
        ref: callback,
        "data-cds": "SkeletonGroup",
        className: value17,
        children: jsxW7.jsx(runtime.skeletonElementContext.Provider, {
          value: value3,
          children: jsxW7.jsx(runtime.skeletonShownStoreContext.Provider, {
            value: value8,
            children: children,
          }),
        }),
      });
    }
    return jsxW7.jsxs(value4, {
      ref: callback2,
      "data-cds": "SkeletonGroup",
      "data-motion": motion,
      "data-hold": value15 ? "delayed" : "none",
      "data-hold-reason": value15 ? undefined : (value14 as { none: string }).none,
      "data-shown": value15 ? undefined : "",
      role: decorative ? undefined : "status",
      "aria-hidden": decorative ? true : undefined,
      className: value17,
      onAnimationEnd: (event: SkeletonAnimationEvent) => {
        if (
          event.animationName === "cds-placeholder-reveal" &&
          event.target === event.currentTarget
        ) {
          event.currentTarget.style.setProperty(
            "--cds-skel-settled",
            `${SKELETON_DURATION_LIMIT_MS}ms`,
          );
          event.currentTarget.setAttribute("data-settled", "");
        }
      },
      onAnimationStart: (event: SkeletonAnimationEvent) => {
        if (
          event.animationName === "cds-placeholder-reveal" &&
          event.target === event.currentTarget
        ) {
          event.currentTarget.setAttribute("data-shown", "");
          let element = event.currentTarget.querySelector(
            "[data-skeleton-label]",
          );
          if (element !== null && element.textContent === "") {
            element.textContent = ref4.current.labelText;
          }
          if (!ref3.current) {
            ref3.current = true;
            markSkeletonShownAfterCallback(ref4.current.onShown, value8);
          }
        } else if (
          (event.animationName === SKELETON_BREATHE_ANIMATION &&
            event.target === event.currentTarget) ||
          (event.animationName === SKELETON_SWEEP_ANIMATION &&
            typeof event.target?.getAnimations === "function")
        ) {
          synchronizeSkeletonAnimation(event.target, event.animationName);
        } else if (
          event.animationName === SKELETON_BREATHE_ANIMATION &&
          motion === "wave" &&
          typeof event.target?.getAnimations === "function"
        ) {
          let target = event.target;
          synchronizeSkeletonAnimation(
            target,
            SKELETON_BREATHE_ANIMATION,
            (Number.parseInt(
              target.style.getPropertyValue("--cds-skel-i"),
              10,
            ) || 0) * SKELETON_MINIMUM_HOLD_MS,
          );
        }
      },
      children: [
        decorative
          ? null
          : jsxW7.jsx("span", {
              className: "sr-only",
              "data-skeleton-label": true,
              children: value15 ? "" : value16,
            }),
        motion === "sweep"
          ? jsxW7.jsx(value4, {
              "aria-hidden": true,
              ref: callback3,
              className: "cds-skel-sweep-clip",
              style: {
                visibility: "hidden",
              },
              children: jsxW7.jsx(value4, {
                className: "cds-skel-sweep-band",
              }),
            })
          : null,
        jsxW7.jsx(runtime.skeletonActiveContext.Provider, {
          value: true,
          children: jsxW7.jsx(runtime.skeletonElementContext.Provider, {
            value: value3,
            children: jsxW7.jsx(runtime.skeletonShownStoreContext.Provider, {
              value: value8,
              children: jsxW7.jsx(value4, {
                "aria-hidden": true,
                className: "contents",
                children: children,
              }),
            }),
          }),
        }),
      ],
    });
  }
  function Skeleton({
    width: width,
    height: height,
    className: className,
    decorative = false,
    as: as2,
  }: SkeletonProps) {
    let value = reactz6.useContext(runtime.skeletonActiveContext),
      value2 = reactz6.useContext(runtime.skeletonElementContext),
      value3 = skeletonElementTags[as2 ?? value2],
      value4 = value3 === "span" ? "block" : undefined,
      value5 = (0, runtime.useTranslation)("loading", "Loading");
    if (value) {
      return jsxW7.jsx(value3, {
        "data-cds": "Skeleton",
        className: (0, runtime.cn)(
          value4,
          "h-[1em] max-w-full rounded bg-[var(--cds-skeleton-base)]",
          className,
        ),
        style: {
          width: width,
          height: height,
        },
      });
    }
    return jsxW7.jsx(value3, {
      ref: scheduleShimmerSynchronization,
      "data-cds": "Skeleton",
      role: decorative ? undefined : "status",
      "aria-hidden": decorative ? true : undefined,
      className: (0, runtime.cn)(
        value4,
        "relative h-[1em] max-w-full overflow-hidden rounded bg-[var(--cds-skeleton-base)] after:absolute after:inset-0 after:animate-[cds-shimmer_2s_linear_infinite] after:bg-[linear-gradient(90deg,transparent,var(--cds-skeleton-sheen),transparent)] motion-reduce:after:hidden",
        className,
      ),
      style: {
        width: width,
        height: height,
      },
      children: decorative
        ? null
        : jsxW7.jsx("span", {
            className: "sr-only",
            children: value5,
          }),
    });
  }
  function SkeletonRows({ rows = 3, icon = true }: SkeletonRowsProps) {
    let value =
        skeletonElementTags[reactz6.useContext(runtime.skeletonElementContext)],
      value2 = value === "span" ? "block" : undefined,
      value3 = icon ? skeletonIconRowWidths : skeletonTextRowWidths,
      value4 = (typeof rows === "number" ? [rows] : rows).filter(
        (input: number) => input > 0,
      ),
      value5 = value4.length > 0 ? value4 : [3],
      items: ReactElement[] = [],
      index = 0;
    for (let [value6, value7] of value5.entries()) {
      if (value6 > 0) {
        items.push(
          jsxW7.jsx(
            value,
            {
              "aria-hidden": true,
              "data-slot": "menu-skeleton-separator",
              className: (0, runtime.cn)(
                value2,
                "compact:mx-2 comfortable:mx-2.5 my-1 h-px bg-border",
              ),
            },
            `separator-${value6}`,
          ),
        );
      }
      for (let value8 = index + value7; index < value8; index++)
        items.push(
          jsxW7.jsxs(
            value,
            {
              "aria-hidden": index > 0 ? true : undefined,
              className:
                "flex h-control items-center gap-xs compact:px-2 comfortable:px-2.5",
              children: [
                icon &&
                  jsxW7.jsx(SkeletonPrimitive, {
                    width: 20,
                    height: 20,
                  }),
                jsxW7.jsx("span", {
                  "aria-hidden": icon ? true : undefined,
                  className: "contents",
                  children: jsxW7.jsx(SkeletonPrimitive, {
                    width: value3[index % value3.length],
                    height: 16,
                  }),
                }),
              ],
            },
            index,
          ),
        );
    }
    return jsxW7.jsx(value, {
      className: value2,
      children: items,
    });
  }
  function SkeletonChip({ width = 120, shape = "pill" }: SkeletonChipProps) {
    return jsxW7.jsx(SkeletonPrimitive, {
      className:
        shape === "pill"
          ? "h-control shrink-0 rounded-full"
          : "h-control shrink-0 rounded",
      width: width,
    });
  }
  function SkeletonLines({
    lines = 8,
    className: className,
  }: SkeletonLinesProps) {
    let value =
      skeletonElementTags[reactz6.useContext(runtime.skeletonElementContext)];
    return jsxW7.jsx(value, {
      className: (0, runtime.cn)("flex flex-col gap-sm", className),
      children: Array.from<unknown, ReactElement>(
        {
          length: lines,
        },
        (input, options) =>
          jsxW7.jsx(
            "span",
            {
              "aria-hidden": options > 0 ? true : undefined,
              className: "contents",
              children: jsxW7.jsx(SkeletonPrimitive, {
                width: skeletonLineWidths[options % skeletonLineWidths.length],
                height: 14,
              }),
            },
            options,
          ),
      ),
    });
  }
  function SkeletonBlock({
    height: height,
    className: className,
  }: SkeletonBlockProps) {
    return jsxW7.jsx(SkeletonPrimitive, {
      className: className,
      width: "100%",
      height: height,
    });
  }
  function useSurfaceStyle(input: SurfaceName | undefined) {
    let value = (0, runtime.useResolvedColorMode)();
    return {
      ...(0, runtime.getSurfaceBackgroundStyle)(input),
      "--cds-focus-shadow": runtime.focusShadowByMode[value],
      "--cds-focus-shadow-danger": runtime.dangerFocusShadowByMode[value],
    };
  }
  bindRuntimeValue(
    runtime,
    "preventRepeatedClickSelection",
    () => preventRepeatedClickSelection,
  );
  bindRuntimeValue(
    runtime,
    "withRepeatedClickSelectionPrevention",
    () => withRepeatedClickSelectionPrevention,
  );
  bindRuntimeValue(
    runtime,
    "PRESERVE_INPUT_FOCUS_PROPS",
    () => PRESERVE_INPUT_FOCUS_PROPS,
    (value) => {
      PRESERVE_INPUT_FOCUS_PROPS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiDisclosure",
    () => initializeUiDisclosure,
    (value) => {
      initializeUiDisclosure = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useHiddenUntilFoundRef",
    () => useHiddenUntilFoundRef,
  );
  bindRuntimeValue(
    runtime,
    "attachBeforeMatchStyleRecovery",
    () => attachBeforeMatchStyleRecovery,
  );
  bindRuntimeValue(runtime, "overrideInlineStyles", () => overrideInlineStyles);
  bindRuntimeValue(
    runtime,
    "react_k",
    () => react_k,
    (value) => {
      react_k = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiDisclosure2",
    () => initializeUiDisclosure2,
    (value) => {
      initializeUiDisclosure2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactForUiDisclosure",
    () => reactForUiDisclosure,
    (value) => {
      reactForUiDisclosure = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DISCLOSURE_PANEL_CLASS",
    () => DISCLOSURE_PANEL_CLASS,
    (value) => {
      DISCLOSURE_PANEL_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isHeightTransitionAnimation",
    () => isHeightTransitionAnimation,
    (value) => {
      isHeightTransitionAnimation = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "observeDisclosureHeightAnimation",
    () => observeDisclosureHeightAnimation,
    (value) => {
      observeDisclosureHeightAnimation = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useDisclosureAnimationRef",
    () => useDisclosureAnimationRef,
    (value) => {
      useDisclosureAnimationRef = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useDisclosureBodyRef",
    () => useDisclosureBodyRef,
    (value) => {
      useDisclosureBodyRef = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiDisclosure3",
    () => initializeUiDisclosure3,
    (value) => {
      initializeUiDisclosure3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactForUiDisclosure2",
    () => reactForUiDisclosure2,
    (value) => {
      reactForUiDisclosure2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiDisclosure",
    () => jsxForUiDisclosure,
    (value) => {
      jsxForUiDisclosure = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CollapsibleRoot",
    () => CollapsibleRoot,
    (value) => {
      CollapsibleRoot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COLLAPSIBLE_TRIGGER_CLASS",
    () => COLLAPSIBLE_TRIGGER_CLASS,
    (value) => {
      COLLAPSIBLE_TRIGGER_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COLLAPSIBLE_ICON_CLASS",
    () => COLLAPSIBLE_ICON_CLASS,
    (value) => {
      COLLAPSIBLE_ICON_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CollapsibleTrigger",
    () => CollapsibleTrigger,
    (value) => {
      CollapsibleTrigger = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COLLAPSIBLE_PANEL_CLASS",
    () => COLLAPSIBLE_PANEL_CLASS,
    (value) => {
      COLLAPSIBLE_PANEL_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CollapsiblePanel",
    () => CollapsiblePanel,
    (value) => {
      CollapsiblePanel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "Collapsible",
    () => Collapsible,
    (value) => {
      Collapsible = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiDisclosure4",
    () => initializeUiDisclosure4,
    (value) => {
      initializeUiDisclosure4 = value;
    },
  );
  bindRuntimeValue(runtime, "Spinner", () => Spinner);
  bindRuntimeValue(
    runtime,
    "DelayedScreenReaderLabel",
    () => DelayedScreenReaderLabel,
  );
  bindRuntimeValue(
    runtime,
    "reactcK",
    () => reactcK,
    (value) => {
      reactcK = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxEq",
    () => jsxEq,
    (value) => {
      jsxEq = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "spinnerSizeAliases",
    () => spinnerSizeAliases,
    (value) => {
      spinnerSizeAliases = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "spinnerSizeMetrics",
    () => spinnerSizeMetrics,
    (value) => {
      spinnerSizeMetrics = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiDisclosure5",
    () => initializeUiDisclosure5,
    (value) => {
      initializeUiDisclosure5 = value;
    },
  );
  bindRuntimeValue(runtime, "useCompactable", () => useCompactable);
  bindRuntimeValue(
    runtime,
    "reactForUiDisclosure3",
    () => reactForUiDisclosure3,
    (value) => {
      reactForUiDisclosure3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CompactableContext",
    () => CompactableContext,
    (value) => {
      CompactableContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMPACTABLE_ATTRIBUTE",
    () => COMPACTABLE_ATTRIBUTE,
    (value) => {
      COMPACTABLE_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiDisclosure6",
    () => initializeUiDisclosure6,
    (value) => {
      initializeUiDisclosure6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useCompactableControlDebug",
    () => useCompactableControlDebug,
  );
  bindRuntimeValue(
    runtime,
    "reacttq0",
    () => reacttq0,
    (value) => {
      reacttq0 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiDisclosure7",
    () => initializeUiDisclosure7,
    (value) => {
      initializeUiDisclosure7 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "scheduleTooltipUpdate",
    () => scheduleTooltipUpdate,
  );
  bindRuntimeValue(runtime, "cancelTooltipUpdate", () => cancelTooltipUpdate);
  bindRuntimeValue(
    runtime,
    "loadTooltipImplementation",
    () => loadTooltipImplementation,
  );
  bindRuntimeValue(
    runtime,
    "preloadTooltipsOnInteraction",
    () => preloadTooltipsOnInteraction,
  );
  bindRuntimeValue(
    runtime,
    "requestTooltipPreload",
    () => requestTooltipPreload,
  );
  bindRuntimeValue(runtime, "adoptTooltipTrigger", () => adoptTooltipTrigger);
  bindRuntimeValue(
    runtime,
    "restoreDeferredTooltipFocus",
    () => restoreDeferredTooltipFocus,
  );
  bindRuntimeValue(
    runtime,
    "cancelTooltipTouchHold",
    () => cancelTooltipTouchHold,
  );
  bindRuntimeValue(
    runtime,
    "releaseTooltipTouchHold",
    () => releaseTooltipTouchHold,
  );
  bindRuntimeValue(
    runtime,
    "resolveTooltipImplementation",
    () => resolveTooltipImplementation,
  );
  bindRuntimeValue(runtime, "hasNonVisibleFocus", () => hasNonVisibleFocus);
  bindRuntimeValue(
    runtime,
    "useDeferredTooltipImplementation",
    () => useDeferredTooltipImplementation,
  );
  bindRuntimeValue(
    runtime,
    "disableElementAutofocus",
    () => disableElementAutofocus,
  );
  bindRuntimeValue(runtime, "DeferredTooltip", () => DeferredTooltip);
  bindRuntimeValue(
    runtime,
    "DeferredDisabledReasonTooltip",
    () => DeferredDisabledReasonTooltip,
  );
  bindRuntimeValue(
    runtime,
    "reactf6",
    () => reactf6,
    (value) => {
      reactf6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxh3",
    () => jsxh3,
    (value) => {
      jsxh3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "loadedTooltipImplementation",
    () => loadedTooltipImplementation,
    (value) => {
      loadedTooltipImplementation = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tooltipImplementationPromise",
    () => tooltipImplementationPromise,
    (value) => {
      tooltipImplementationPromise = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tooltipImplementationListeners",
    () => tooltipImplementationListeners,
    (value) => {
      tooltipImplementationListeners = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tooltipBatchTimer",
    () => tooltipBatchTimer,
    (value) => {
      tooltipBatchTimer = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tooltipBatchCallbacks",
    () => tooltipBatchCallbacks,
    (value) => {
      tooltipBatchCallbacks = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tooltipPreloadEvents",
    () => tooltipPreloadEvents,
    (value) => {
      tooltipPreloadEvents = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "tooltipPreloadStarted",
    () => tooltipPreloadStarted,
    (value) => {
      tooltipPreloadStarted = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pendingTooltipProps",
    () => pendingTooltipProps,
    (value) => {
      pendingTooltipProps = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TOUCH_TOOLTIP_HOLD_MS",
    () => TOUCH_TOOLTIP_HOLD_MS,
    (value) => {
      TOUCH_TOOLTIP_HOLD_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "deferredTooltipImplementationContext",
    () => deferredTooltipImplementationContext,
    (value) => {
      deferredTooltipImplementationContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiDisclosure8",
    () => initializeUiDisclosure8,
    (value) => {
      initializeUiDisclosure8 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isButtonActivationKey",
    () => isButtonActivationKey,
  );
  bindRuntimeValue(
    runtime,
    "isUnmodifiedButtonActivation",
    () => isUnmodifiedButtonActivation,
  );
  bindRuntimeValue(runtime, "useButtonGroup", () => useButtonGroup);
  bindRuntimeValue(runtime, "getButtonIconSize", () => getButtonIconSize);
  bindRuntimeValue(runtime, "useButtonIconSize", () => useButtonIconSize);
  bindRuntimeValue(
    runtime,
    "getButtonIconVerticalPadding",
    () => getButtonIconVerticalPadding,
  );
  bindRuntimeValue(
    runtime,
    "reacttJ",
    () => reacttJ,
    (value) => {
      reacttJ = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiDisclosure2",
    () => jsxForUiDisclosure2,
    (value) => {
      jsxForUiDisclosure2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "stopEvent",
    () => stopEvent,
    (value) => {
      stopEvent = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BUTTON_ON_ACCENT_TEXT_CLASS",
    () => BUTTON_ON_ACCENT_TEXT_CLASS,
    (value) => {
      BUTTON_ON_ACCENT_TEXT_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BUTTON_END_ICON_OFFSET_CLASS",
    () => BUTTON_END_ICON_OFFSET_CLASS,
    (value) => {
      BUTTON_END_ICON_OFFSET_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buttonVariants",
    () => buttonVariants,
    (value) => {
      buttonVariants = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BUTTON_ON_CONTENT_FILL_CLASS",
    () => BUTTON_ON_CONTENT_FILL_CLASS,
    (value) => {
      BUTTON_ON_CONTENT_FILL_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buttonPaintVariants",
    () => buttonPaintVariants,
    (value) => {
      buttonPaintVariants = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buttonGroupContext",
    () => buttonGroupContext,
    (value) => {
      buttonGroupContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BUTTON_SEGMENT_RADIUS_CLASSES",
    () => BUTTON_SEGMENT_RADIUS_CLASSES,
    (value) => {
      BUTTON_SEGMENT_RADIUS_CLASSES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BUTTON_OUTSET_CLASSES",
    () => BUTTON_OUTSET_CLASSES,
    (value) => {
      BUTTON_OUTSET_CLASSES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BUTTON_OUTSET_STYLES",
    () => BUTTON_OUTSET_STYLES,
    (value) => {
      BUTTON_OUTSET_STYLES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buttonIconSizeContext",
    () => buttonIconSizeContext,
    (value) => {
      buttonIconSizeContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "Button",
    () => Button,
    (value) => {
      Button = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiDisclosure9",
    () => initializeUiDisclosure9,
    (value) => {
      initializeUiDisclosure9 = value;
    },
  );
  bindRuntimeValue(runtime, "isShimmerAnimation", () => isShimmerAnimation);
  bindRuntimeValue(
    runtime,
    "synchronizeDocumentShimmers",
    () => synchronizeDocumentShimmers,
  );
  bindRuntimeValue(
    runtime,
    "flushShimmerSynchronization",
    () => flushShimmerSynchronization,
  );
  bindRuntimeValue(
    runtime,
    "scheduleShimmerSynchronization",
    () => scheduleShimmerSynchronization,
  );
  bindRuntimeValue(
    runtime,
    "createSkeletonShownStore",
    () => createSkeletonShownStore,
  );
  bindRuntimeValue(
    runtime,
    "markSkeletonShownAfterCallback",
    () => markSkeletonShownAfterCallback,
  );
  bindRuntimeValue(
    runtime,
    "clearSkeletonElapsedStyle",
    () => clearSkeletonElapsedStyle,
  );
  bindRuntimeValue(runtime, "setSkeletonMotion", () => setSkeletonMotion);
  bindRuntimeValue(
    runtime,
    "ensurePositionedSkeletonHost",
    () => ensurePositionedSkeletonHost,
  );
  bindRuntimeValue(
    runtime,
    "synchronizeSkeletonAnimation",
    () => synchronizeSkeletonAnimation,
  );
  bindRuntimeValue(runtime, "SkeletonGroup", () => SkeletonGroup);
  bindRuntimeValue(runtime, "Skeleton", () => Skeleton);
  bindRuntimeValue(runtime, "SkeletonRows", () => SkeletonRows);
  bindRuntimeValue(runtime, "SkeletonChip", () => SkeletonChip);
  bindRuntimeValue(runtime, "SkeletonLines", () => SkeletonLines);
  bindRuntimeValue(runtime, "SkeletonBlock", () => SkeletonBlock);
  bindRuntimeValue(
    runtime,
    "reactz6",
    () => reactz6,
    (value) => {
      reactz6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxW7",
    () => jsxW7,
    (value) => {
      jsxW7 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "skeletonElementTags",
    () => skeletonElementTags,
    (value) => {
      skeletonElementTags = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pendingShimmerElements",
    () => pendingShimmerElements,
    (value) => {
      pendingShimmerElements = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shimmerStartTimes",
    () => shimmerStartTimes,
    (value) => {
      shimmerStartTimes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "skeletonNotShownSnapshot",
    () => skeletonNotShownSnapshot,
    (value) => {
      skeletonNotShownSnapshot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "skeletonShownSnapshot",
    () => skeletonShownSnapshot,
    (value) => {
      skeletonShownSnapshot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SKELETON_BREATHE_ANIMATION",
    () => SKELETON_BREATHE_ANIMATION,
    (value) => {
      SKELETON_BREATHE_ANIMATION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SKELETON_SWEEP_ANIMATION",
    () => SKELETON_SWEEP_ANIMATION,
    (value) => {
      SKELETON_SWEEP_ANIMATION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SKELETON_ANIMATION_DURATION_MS",
    () => SKELETON_ANIMATION_DURATION_MS,
    (value) => {
      SKELETON_ANIMATION_DURATION_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DEFAULT_SKELETON_MOTION",
    () => DEFAULT_SKELETON_MOTION,
    (value) => {
      DEFAULT_SKELETON_MOTION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SKELETON_MINIMUM_HOLD_MS",
    () => SKELETON_MINIMUM_HOLD_MS,
    (value) => {
      SKELETON_MINIMUM_HOLD_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SKELETON_DURATION_LIMIT_MS",
    () => SKELETON_DURATION_LIMIT_MS,
    (value) => {
      SKELETON_DURATION_LIMIT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SKELETON_SYNC_TOLERANCE_MS",
    () => SKELETON_SYNC_TOLERANCE_MS,
    (value) => {
      SKELETON_SYNC_TOLERANCE_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "skeletonAnimationStartTimes",
    () => skeletonAnimationStartTimes,
    (value) => {
      skeletonAnimationStartTimes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "skeletonIconRowWidths",
    () => skeletonIconRowWidths,
    (value) => {
      skeletonIconRowWidths = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "skeletonTextRowWidths",
    () => skeletonTextRowWidths,
    (value) => {
      skeletonTextRowWidths = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "skeletonLineWidths",
    () => skeletonLineWidths,
    (value) => {
      skeletonLineWidths = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SkeletonPrimitive",
    () => SkeletonPrimitive,
    (value) => {
      SkeletonPrimitive = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiDisclosure10",
    () => initializeUiDisclosure10,
    (value) => {
      initializeUiDisclosure10 = value;
    },
  );
  bindRuntimeValue(runtime, "useSurfaceStyle", () => useSurfaceStyle);
  bindRuntimeValue(
    runtime,
    "reactForUiDisclosure4",
    () => reactForUiDisclosure4,
    (value) => {
      reactForUiDisclosure4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiDisclosure3",
    () => jsxForUiDisclosure3,
    (value) => {
      jsxForUiDisclosure3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "Surface",
    () => Surface,
    (value) => {
      Surface = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiDisclosure11",
    () => initializeUiDisclosure11,
    (value) => {
      initializeUiDisclosure11 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_INPUT_SURFACE_CLASS",
    () => TEXT_INPUT_SURFACE_CLASS,
    (value) => {
      TEXT_INPUT_SURFACE_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_INPUT_HOVER_CLASS",
    () => TEXT_INPUT_HOVER_CLASS,
    (value) => {
      TEXT_INPUT_HOVER_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_INPUT_CLASS",
    () => TEXT_INPUT_CLASS,
    (value) => {
      TEXT_INPUT_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_INPUT_REQUIRED_CLASS",
    () => TEXT_INPUT_REQUIRED_CLASS,
    (value) => {
      TEXT_INPUT_REQUIRED_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_INPUT_PLACEHOLDER_CLASS",
    () => TEXT_INPUT_PLACEHOLDER_CLASS,
    (value) => {
      TEXT_INPUT_PLACEHOLDER_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_INPUT_INVALID_CLASS",
    () => TEXT_INPUT_INVALID_CLASS,
    (value) => {
      TEXT_INPUT_INVALID_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiDisclosure12",
    () => initializeUiDisclosure12,
    (value) => {
      initializeUiDisclosure12 = value;
    },
  );
  return () => {
    initializeUiDisclosure = (0, runtime.initializeOnce)(() => {
      PRESERVE_INPUT_FOCUS_PROPS = Object.freeze({
        onMouseDown: preventRepeatedClickSelection,
      });
    });
    initializeUiDisclosure2 = (0, runtime.initializeOnce)(() => {
      react_k = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
    });
    DISCLOSURE_PANEL_CLASS =
      "break-words h-[var(--cds-disclosure-panel-height)] transition-[height] duration-base ease-out motion-reduce:transition-none data-[starting-style]:h-0 data-[ending-style]:h-0 data-[starting-style]:[clip-path:inset(-8px_-100vw_0_-100vw)] data-[ending-style]:[clip-path:inset(-8px_-100vw_0_-100vw)] data-[animating]:[clip-path:inset(-8px_-100vw_0_-100vw)] data-[starting-style]:contain-layout data-[ending-style]:contain-layout data-[animating]:contain-layout";
    isHeightTransitionAnimation = (animation) =>
      "transitionProperty" in animation &&
      animation.transitionProperty === "height";
    observeDisclosureHeightAnimation = (element) => {
      let callback = () => {
          let value2 =
            element.hasAttribute("data-starting-style") ||
            element.hasAttribute("data-ending-style") ||
            (element.getAnimations?.().some(isHeightTransitionAnimation) ??
              false);
          element.toggleAttribute("data-animating", value2);
        },
        value = new (element.ownerDocument.defaultView
          ?.MutationObserver ?? MutationObserver)(callback);
      value.observe(element, {
        attributeFilter: ["data-starting-style", "data-ending-style"],
      });
      callback();
      let callback2 = (event: TransitionEvent) => {
          if (event.target === element && event.propertyName === "height") {
            element.setAttribute("data-animating", "");
          }
        },
        callback3 = (event: TransitionEvent) => {
          if (event.target === element && event.propertyName === "height") {
            callback();
          }
        };
      element.addEventListener("transitionrun", callback2);
      element.addEventListener("transitionend", callback3);
      element.addEventListener("transitioncancel", callback3);
      return () => {
        value.disconnect();
        element.removeEventListener("transitionrun", callback2);
        element.removeEventListener("transitionend", callback3);
        element.removeEventListener("transitioncancel", callback3);
        element.removeAttribute("data-animating");
      };
    };
    useDisclosureAnimationRef = () => {
      let ref = reactForUiDisclosure.useRef<(() => void) | null>(null);
      return reactForUiDisclosure.useCallback((input: HTMLElement | null) => {
        ref.current?.();
        ref.current = input ? observeDisclosureHeightAnimation(input) : null;
      }, []);
    };
    useDisclosureBodyRef = (ref) =>
      (0, runtime.useMergedRefs)(
        ref,
        useDisclosureAnimationRef(),
        useHiddenUntilFoundRef(),
      );
    initializeUiDisclosure3 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeMergedRefs)();
      initializeUiDisclosure2();
      reactForUiDisclosure = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
    });
    COLLAPSIBLE_TRIGGER_CLASS =
      "cds-reset group/clp inline-flex w-fit items-center gap-1.5 border-0 select-none outline-none focus-visible:outline-hidden font-sans text-body font-normal text-secondary hover:text-primary transition-shadow duration-fast focus-visible:shadow-focus rounded data-[disabled]:opacity-disabled data-[disabled]:pointer-events-none";
    COLLAPSIBLE_ICON_CLASS =
      "shrink-0 transition-transform rtl:rotate-180 group-data-[panel-open]/clp:rotate-90";
    initializeUiDisclosure4 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeClassNames)();
      initializeUiDisclosure();
      initializeUiDisclosure3();
      (0, runtime.initializeIcons)();
      (0, runtime.initializeNpmDependency)();
      (0, runtime.initializeNpmDependency)();
      reactForUiDisclosure2 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiDisclosure = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      CollapsibleRoot = reactForUiDisclosure2.forwardRef<HTMLDivElement, CollapsibleRootProps>(
        (input, options) =>
          jsxForUiDisclosure.jsx(runtime.baseCollapsible.Root, {
            ref: options,
            "data-cds": "Collapsible",
            ...input,
          }),
      );
      CollapsibleRoot.displayName = "Collapsible.Root";
      CollapsibleTrigger = reactForUiDisclosure2.forwardRef<HTMLButtonElement, CollapsibleTriggerProps>(
        (
          {
            className: className,
            children: children,
            caretPosition: caretPosition,
            hideCaret: hideCaret,
            render: render,
            ...props
          },
          options,
        ) => {
          let value = withRepeatedClickSelectionPrevention(
              props.onMouseDown,
            ),
            value2 = hideCaret
              ? null
              : jsxForUiDisclosure.jsx(runtime.Icon, {
                  name: "CaretRight",
                  size: "sm",
                  className: (0, runtime.clsx)(
                    COLLAPSIBLE_ICON_CLASS,
                    caretPosition === "end" && "ms-auto",
                  ),
                });
          if (render) {
            return jsxForUiDisclosure.jsx(runtime.baseCollapsible.Trigger, {
              ref: options,
              render: render,
              className: className,
              ...props,
              onMouseDown: value,
            });
          } else {
            return jsxForUiDisclosure.jsxs(runtime.baseCollapsible.Trigger, {
              ref: options,
              ...props,
              className: (0, runtime.cn)(COLLAPSIBLE_TRIGGER_CLASS, className),
              onMouseDown: value,
              children: [
                caretPosition !== "end" && value2,
                children,
                caretPosition === "end" && value2,
              ],
            });
          }
        },
      );
      CollapsibleTrigger.displayName = "Collapsible.Trigger";
      COLLAPSIBLE_PANEL_CLASS = `${DISCLOSURE_PANEL_CLASS} [--cds-disclosure-panel-height:var(--collapsible-panel-height)]`;
      CollapsiblePanel = reactForUiDisclosure2.forwardRef<HTMLDivElement, CollapsiblePanelProps>(
        (
          { className: className, ...props },
          options,
        ) => {
          let value = useDisclosureBodyRef(options);
          return jsxForUiDisclosure.jsx(runtime.baseCollapsible.Panel, {
            ref: value,
            ...props,
            className: (0, runtime.cn)(COLLAPSIBLE_PANEL_CLASS, className),
          });
        },
      );
      CollapsiblePanel.displayName = "Collapsible.Panel";
      Collapsible = {
        Root: CollapsibleRoot,
        Trigger: CollapsibleTrigger,
        Panel: CollapsiblePanel,
      };
    });
    initializeUiDisclosure5 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeRemScale)();
      reactcK = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxEq = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      spinnerSizeAliases = {
        s: "sm",
        m: "md",
        l: "lg",
      };
      spinnerSizeMetrics = {
        sm: {
          box: 12,
          stroke: 1.5,
        },
        md: {
          box: 16,
          stroke: 1.75,
        },
        lg: {
          box: 20,
          stroke: 2,
        },
      };
    });
    COMPACTABLE_ATTRIBUTE = "data-cds-compactable";
    initializeUiDisclosure6 = (0, runtime.initializeOnce)(() => {
      reactForUiDisclosure3 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      CompactableContext = reactForUiDisclosure3.createContext<CompactableContextValue>({
        compact: false,
      });
    });
    initializeUiDisclosure7 = (0, runtime.initializeOnce)(() => {
      reacttq0 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
    });
    loadedTooltipImplementation = null;
    tooltipImplementationPromise = null;
    tooltipBatchTimer = null;
    tooltipPreloadStarted = false;
    TOUCH_TOOLTIP_HOLD_MS = 700;
    initializeUiDisclosure8 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeElementAccess)();
      (0, runtime.initializeDisabledReason)();
      (0, runtime.initializeTooltipContext)();
      reactf6 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxh3 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      tooltipImplementationListeners = new Set();
      tooltipBatchCallbacks = new Set();
      tooltipPreloadEvents = ["pointermove", "keydown", "touchstart"];
      pendingTooltipProps = {
        "data-cds-tooltip-pending": "",
      };
      deferredTooltipImplementationContext = reactf6.createContext<DeferredTooltipHost | null>(null);
    });
    stopEvent = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    BUTTON_ON_ACCENT_TEXT_CLASS =
      "text-primary font-medium focus-visible:shadow-[0_0_0_2px_rgb(255_255_255/0.7)] [&[data-initial-focus]:focus]:shadow-[0_0_0_2px_rgb(255_255_255/0.7)]";
    BUTTON_END_ICON_OFFSET_CLASS =
      "me-[calc((var(--cds-h-control)-1em-6px)/2-var(--cds-pad-md))]";
    BUTTON_ON_CONTENT_FILL_CLASS =
      "bg-[var(--cds-button-on-content)] backdrop-blur-md shadow-[inset_0_0_0_1px_var(--cds-button-on-content-ring)] group-focus-visible/btn:!shadow-[inset_0_0_0_1px_var(--cds-button-on-content-ring)] group-[[data-initial-focus]:focus]/btn:!shadow-[inset_0_0_0_1px_var(--cds-button-on-content-ring)] group-hover/btn:bg-[var(--cds-button-on-content-hover)] group-[[aria-haspopup][aria-expanded=true]]/btn:bg-[var(--cds-button-on-content-hover)]";
    initializeUiDisclosure9 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeCdsLink)();
      (0, runtime.initializeCdsRoot)();
      initializeUiDisclosure();
      (0, runtime.initializeRemScale)();
      (0, runtime.initializeIcons)();
      (0, runtime.initializeShortcuts)();
      (0, runtime.initializeDisabledReasonDebug)();
      (0, runtime.initializeTooltipContext)();
      initializeUiDisclosure6();
      initializeUiDisclosure7();
      initializeUiDisclosure5();
      initializeUiDisclosure8();
      (0, runtime.initializeNpmDependency)();
      (0, runtime.initializeNpmDependency)();
      (0, runtime.initializeNpmDependency)();
      reacttJ = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiDisclosure2 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      buttonVariants = (0, runtime.cva)(
        "cds-reset group/btn relative isolate inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap select-none cursor-[var(--cds-cursor-interactive)] aria-disabled:cursor-default data-[disabled]:cursor-default border-0 outline-none focus-visible:outline-hidden [&[data-initial-focus]:focus]:outline-hidden rounded h-control font-sans text-body [&:disabled:not([aria-busy])]:opacity-disabled disabled:pointer-events-none transition-shadow duration-fast",
        {
          variants: {
            variant: {
              primary: `text-on-primary font-medium [--cds-shortcut-cap-ink:currentColor] ${runtime.buttonFocusClasses}`,
              secondary: `text-primary font-normal aria-pressed:text-accent ${runtime.buttonFocusClasses}`,
              ghost: `text-primary font-normal aria-pressed:text-accent ${runtime.buttonFocusClasses}`,
              danger: `text-on-danger font-medium [--cds-shortcut-cap-ink:currentColor] ${runtime.dangerButtonFocusClasses}`,
              brand: `text-on-brand font-medium [--cds-shortcut-cap-ink:currentColor] ${runtime.buttonFocusClasses}`,
              onContent: BUTTON_ON_ACCENT_TEXT_CLASS,
              onAccent: BUTTON_ON_ACCENT_TEXT_CLASS,
            },
            iconOnly: {
              true: "aspect-square w-control px-0",
              false: "px-md",
            },
          },
          defaultVariants: {
            variant: "secondary",
            iconOnly: false,
          },
        },
      );
      buttonPaintVariants = (0, runtime.cva)(runtime.buttonFillLayerClasses, {
        variants: {
          variant: {
            primary:
              "bg-fill-primary group-hover/btn:bg-fill-primary-hover group-[[aria-haspopup][aria-expanded=true]]/btn:bg-fill-primary-hover",
            secondary: runtime.secondaryButtonFillClasses,
            ghost:
              "bg-transparent group-hover/btn:bg-fill-ghost-hover group-[[aria-haspopup][aria-expanded=true]]/btn:bg-fill-ghost-hover",
            danger:
              "bg-fill-danger group-hover/btn:bg-fill-danger-hover group-[[aria-haspopup][aria-expanded=true]]/btn:bg-fill-danger-hover",
            brand:
              "bg-fill-brand group-hover/btn:bg-fill-brand-hover group-[[aria-haspopup][aria-expanded=true]]/btn:bg-fill-brand-hover",
            onContent: BUTTON_ON_CONTENT_FILL_CLASS,
            onAccent: BUTTON_ON_CONTENT_FILL_CLASS,
          },
        },
        defaultVariants: {
          variant: "secondary",
        },
      });
      buttonGroupContext = reacttJ.createContext<ButtonGroupContextValue | null>(null);
      BUTTON_SEGMENT_RADIUS_CLASSES = {
        start: "rounded-e-none",
        end: "rounded-s-none",
        middle: "rounded-none",
      };
      BUTTON_OUTSET_CLASSES = {
        start: "ms-outset",
        end: "me-outset",
        both: "mx-outset",
      };
      BUTTON_OUTSET_STYLES = {
        "--cds-outset-x": "var(--cds-pad-md)",
      };
      buttonIconSizeContext = reacttJ.createContext<IconSizeSetting | undefined>(undefined);
      Button = reacttJ.forwardRef<HTMLElement, ButtonProps>(
        (
          {
            variant: variant,
            size: size,
            icon: icon,
            iconOnly = false,
            iconPosition = "start",
            tooltip: tooltip,
            tooltipSide: tooltipSide,
            indicator: indicator,
            shortcut: shortcut,
            busy = false,
            busyLabel: busyLabel,
            pressed: pressed,
            flush = false,
            style: style,
            disabled: disabled,
            disabledReason: disabledReason,
            disabledReasonSide: disabledReasonSide,
            type: type,
            href: href,
            routerOptions: routerOptions,
            target: target,
            rel: rel,
            download: download,
            render: render,
            className: className,
            children: children,
            "aria-label": ariaLabel,
            ...props
          },
          options,
        ) => {
          let value = useButtonGroup(),
            value2 = value?.joined;
          if (value) {
            if (((size = size ?? value.size), value.enforceVariant)) {
              variant = value.buttonVariant;
            } else {
              variant = variant ?? value.buttonVariant;
            }
          }
          let value3 = variant ?? "secondary",
            value4 = useCompactable(),
            value5 = iconOnly === true ? undefined : value4.icon,
            value6 = value5 !== undefined && value4.compact,
            value7 = iconOnly === true || value6,
            value8 = value6 ? value5 : icon,
            value9 = value6
              ? jsxForUiDisclosure2.jsx("span", {
                  "data-cds-part": "compact-name",
                  className: "contents",
                  children: children,
                })
              : null,
            value10 =
              flush === true ? "start" : flush === false ? undefined : flush,
            value11 =
              value10 !== undefined &&
              Object.hasOwn(BUTTON_OUTSET_CLASSES, value10)
                ? value10
                : undefined,
            value12 =
              value11 !== undefined && !value2 && value3 === "ghost"
                ? value11
                : undefined,
            value13 = (0, runtime.useAppleKeyboard)(),
            ref = reacttJ.useRef<HTMLElement | null>(null);
          useCompactableControlDebug(ref, "Button");
          let value14 = useButtonIconSize(size),
            value15 =
              value7 && value8
                ? (0, runtime.isIconName)(value8)
                  ? jsxForUiDisclosure2.jsx(runtime.Icon, {
                      name: value8,
                      size: value14,
                    })
                  : value8
                : null,
            value16 = (0, runtime.useTooltipsDisabled)(),
            value17 =
              (value7 && ariaLabel && tooltip !== false) ||
              value5 !== undefined,
            value18 =
              value5 !== undefined
                ? value6
                  ? value9
                  : undefined
                : typeof tooltip === "string"
                  ? tooltip
                  : ariaLabel,
            value19 =
              href === undefined && !!disabled && !!disabledReason,
            value20 = href === undefined && render === undefined,
            value21 = busy && value20,
            callback = (event: ReactKeyboardEvent<HTMLElement>) => {
              if (isButtonActivationKey(event)) {
                if (value21 && isUnmodifiedButtonActivation(event)) {
                  event.preventDefault();
                  event.stopPropagation();
                  return;
                }
                if (event.repeat && value20) {
                  event.preventDefault();
                }
              }
              props.onKeyDown?.(event);
            },
            callback2 = (event: ReactKeyboardEvent<HTMLElement>) => {
              if (value21 && isUnmodifiedButtonActivation(event)) {
                event.preventDefault();
                event.stopPropagation();
                return;
              }
              props.onKeyUp?.(event);
            },
            value22 =
              value12 === undefined
                ? undefined
                : value7
                  ? {
                      "--cds-outset-x": getButtonIconVerticalPadding(value14),
                    }
                  : BUTTON_OUTSET_STYLES,
            value23 = (0, runtime.cn)(
              buttonVariants({
                variant: variant,
                iconOnly: value7,
              }),
              value21 ? "pointer-events-none" : "",
              value12 ? BUTTON_OUTSET_CLASSES[value12] : "",
              value2 && value3 !== "ghost"
                ? BUTTON_SEGMENT_RADIUS_CLASSES[value2]
                : "",
              className,
            ),
            value24 = jsxForUiDisclosure2.jsxs(
              jsxForUiDisclosure2.Fragment,
              {
                children: [
                  jsxForUiDisclosure2.jsx("span", {
                    "aria-hidden": true,
                    className: (0, runtime.getButtonBackgroundLayerClasses)({
                      joined: !!value2,
                      solid:
                        value3 === "primary" ||
                        value3 === "danger" ||
                        value3 === "brand",
                    }),
                    children: jsxForUiDisclosure2.jsx("span", {
                      ref: ref,
                      "data-cds-part": "paint",
                      className: `${buttonPaintVariants({
                        variant: value3,
                      })} ${runtime.buttonPressedFillClasses} ${value3 === "secondary" && !value2 ? runtime.buttonJoinedFillClasses : ""}`,
                    }),
                  }),
                  jsxForUiDisclosure2.jsx("span", {
                    className: `inline-flex min-w-0 items-center gap-1 ${busy ? "opacity-0" : ""}`,
                    children: jsxForUiDisclosure2.jsx(
                      buttonIconSizeContext.Provider,
                      {
                        value: value14,
                        children: value15
                          ? indicator
                            ? jsxForUiDisclosure2.jsxs("span", {
                                className: "grid",
                                children: [
                                  jsxForUiDisclosure2.jsx("span", {
                                    className:
                                      "col-start-1 row-start-1 [--btn-dot-r:calc(0.1875rem*var(--cds-rem-scale,1))] [--btn-dot-x:calc(100%_-_var(--btn-dot-r)_+_1px)] [&:dir(rtl)]:[--btn-dot-x:calc(var(--btn-dot-r)_-_1px)] not-forced-colors:has-[~[data-cds-part=indicator]>[data-cds=Pulse]]:[mask-image:radial-gradient(circle_at_var(--btn-dot-x)_calc(var(--btn-dot-r)_-_1px),transparent_calc(var(--btn-dot-r)_+_2px),black_calc(var(--btn-dot-r)_+_2.5px))]",
                                    children: value15,
                                  }),
                                  jsxForUiDisclosure2.jsx("span", {
                                    "aria-hidden": true,
                                    "data-cds-part": "indicator",
                                    className:
                                      "relative col-start-1 row-start-1 -me-px -mt-px self-start justify-self-end has-[>[data-cds=Pulse]]:[--cds-page-bg:transparent]",
                                    children: indicator,
                                  }),
                                ],
                              })
                            : value6
                              ? jsxForUiDisclosure2.jsxs(
                                  jsxForUiDisclosure2.Fragment,
                                  {
                                    children: [
                                      value15,
                                      jsxForUiDisclosure2.jsx("span", {
                                        className: "sr-only",
                                        children: value9,
                                      }),
                                    ],
                                  },
                                )
                              : value15
                          : jsxForUiDisclosure2.jsxs(
                              jsxForUiDisclosure2.Fragment,
                              {
                                children: [
                                  value8 &&
                                    iconPosition === "start" &&
                                    ((0, runtime.isIconName)(value8)
                                      ? jsxForUiDisclosure2.jsx(runtime.Icon, {
                                          name: value8,
                                          size: value14,
                                          className: "-ms-1",
                                        })
                                      : jsxForUiDisclosure2.jsx("span", {
                                          className: "-ms-1 inline-flex",
                                          children: value8,
                                        })),
                                  children,
                                  value8 &&
                                    iconPosition === "end" &&
                                    ((0, runtime.isIconName)(value8)
                                      ? jsxForUiDisclosure2.jsx(runtime.Icon, {
                                          name: value8,
                                          size: value14,
                                          className: "-me-1",
                                        })
                                      : jsxForUiDisclosure2.jsx("span", {
                                          className: "-me-1 inline-flex",
                                          children: value8,
                                        })),
                                  shortcut &&
                                    jsxForUiDisclosure2.jsx(runtime.Shortcut, {
                                      keys: shortcut,
                                      "aria-hidden": true,
                                      className: (0, runtime.clsx)(
                                        "pointer-coarse:hidden ms-1",
                                        (!value2 || value2 === "end") &&
                                          BUTTON_END_ICON_OFFSET_CLASS,
                                      ),
                                    }),
                                ],
                              },
                            ),
                      },
                    ),
                  }),
                  busy &&
                    jsxForUiDisclosure2.jsx("span", {
                      className:
                        "absolute inset-0 grid place-items-center leading-[0]",
                      children: jsxForUiDisclosure2.jsx(Spinner, {
                        size: "sm",
                        inheritColor: true,
                        label: busyLabel,
                      }),
                    }),
                ],
              },
            ),
            value25 = (0, runtime.useCdsLink)({
              href: href,
              routerOptions: routerOptions,
              target: target,
              rel: rel,
              download: download,
              ...(0, runtime.pickLinkEventProps)(props),
            }),
            value26 = (0, runtime.baseUseRender)({
              render:
                render ??
                (href !== undefined
                  ? jsxForUiDisclosure2.jsx("a", {})
                  : jsxForUiDisclosure2.jsx("button", {
                      type: type ?? "button",
                      disabled: disabled,
                    })),
              ref: options,
              props: {
                "data-cds": "Button",
                ...(value7
                  ? {
                      "data-cds-icon-only": "",
                    }
                  : undefined),
                ...(value5 !== undefined
                  ? {
                      [COMPACTABLE_ATTRIBUTE]: "",
                    }
                  : undefined),
                ...(value3 === "ghost"
                  ? {
                      "data-cds-ghost": "",
                    }
                  : undefined),
                ...(size === "xxs"
                  ? {
                      "data-step": "1",
                    }
                  : (0, runtime.getControlSizeAttributes)(size)),
                className: value23,
                style: value22
                  ? {
                      ...value22,
                      ...style,
                    }
                  : style,
                "aria-busy": busy || undefined,
                "aria-pressed": href === undefined ? pressed : undefined,
                "aria-disabled": value21 || undefined,
                "aria-label": ariaLabel,
                "aria-keyshortcuts": shortcut
                  ? (0, runtime.shortcutToAriaKeyShortcuts)(shortcut, value13)
                  : undefined,
                children: value24,
                ...props,
                onMouseDown: withRepeatedClickSelectionPrevention(
                  props.onMouseDown,
                ),
                onClick: value21 ? stopEvent : props.onClick,
                onKeyDown: callback,
                onKeyUp: callback2,
                ...(href !== undefined ? value25 : undefined),
              },
            }),
            value27 = value17
              ? jsxForUiDisclosure2.jsx(DeferredTooltip, {
                  side: tooltipSide,
                  hoverable: false,
                  content: value16 || value19 ? undefined : value18,
                  shortcut: shortcut,
                  children: value26,
                })
              : value26;
          if (disabledReason === undefined || href !== undefined) {
            return value27;
          }
          return jsxForUiDisclosure2.jsx(DeferredDisabledReasonTooltip, {
            side: disabledReasonSide,
            reason: value19 ? disabledReason : undefined,
            children: value27,
          });
        },
      );
      Button.displayName = "Button";
    });
    SKELETON_BREATHE_ANIMATION = "cds-skeleton-breathe";
    SKELETON_SWEEP_ANIMATION = "cds-skeleton-sweep";
    SKELETON_ANIMATION_DURATION_MS = 2000;
    DEFAULT_SKELETON_MOTION = "wave";
    SKELETON_MINIMUM_HOLD_MS = 90;
    SKELETON_DURATION_LIMIT_MS = 1e5;
    SKELETON_SYNC_TOLERANCE_MS = 1;
    initializeUiDisclosure10 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeErrorReporting)();
      (0, runtime.initializeSafeObservers)();
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeTranslations)();
      (0, runtime.initializeResizeObserverAccess)();
      (0, runtime.initializeSkeletonContexts)();
      reactz6 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxW7 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      skeletonElementTags = {
        div: "div",
        span: "span",
      };
      pendingShimmerElements = new Set();
      shimmerStartTimes = new WeakMap();
      skeletonNotShownSnapshot = Object.freeze({
        shown: false,
      });
      skeletonShownSnapshot = Object.freeze({
        shown: true,
      });
      skeletonAnimationStartTimes = new WeakMap();
      skeletonIconRowWidths = [160, 128, 144];
      skeletonTextRowWidths = [120, 88, 104];
      (SkeletonRows as DisplayNamed).displayName = "Skeleton.Rows";
      (SkeletonChip as DisplayNamed).displayName = "Skeleton.Chip";
      skeletonLineWidths = ["92%", "100%", "96%", "58%"];
      (SkeletonLines as DisplayNamed).displayName = "Skeleton.Lines";
      (SkeletonBlock as DisplayNamed).displayName = "Skeleton.Block";
      (Skeleton as DisplayNamed).displayName = "Skeleton";
      (SkeletonGroup as DisplayNamed).displayName = "SkeletonGroup";
      SkeletonPrimitive = Object.assign(Skeleton, {
        Rows: SkeletonRows,
        Chip: SkeletonChip,
        Lines: SkeletonLines,
        Block: SkeletonBlock,
      });
    });
    initializeUiDisclosure11 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeSurfaces)();
      reactForUiDisclosure4 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiDisclosure3 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      Surface = reactForUiDisclosure4.forwardRef<HTMLDivElement, SurfaceProps>(
        (
          {
            elevation: elevation,
            className: className,
            style: style,
            children: children,
            ...props
          },
          options,
        ) => {
          let value = useSurfaceStyle(
            runtime.elevationSurfaceNames[elevation],
          );
          return jsxForUiDisclosure3.jsx("div", {
            ref: options,
            "data-cds": "Surface",
            "data-surface": elevation,
            ...props,
            className: (0, runtime.cn)(
              (0, runtime.getSurfaceClasses)(elevation),
              className,
            ),
            style: {
              ...value,
              ...style,
            },
            children: jsxForUiDisclosure3.jsx(
              runtime.surfaceBackgroundContext.Provider,
              {
                value: runtime.elevationSurfaceNames[elevation],
                children: children,
              },
            ),
          });
        },
      );
      Surface.displayName = "Surface";
    });
    TEXT_INPUT_SURFACE_CLASS =
      "bg-fill-field shadow-field-ring data-[invalid]:shadow-field-invalid";
    TEXT_INPUT_HOVER_CLASS =
      "[&:hover:not(:focus-visible):not(:has(:focus-visible)):not([data-invalid]):not([data-disabled])]:shadow-field-hover";
    TEXT_INPUT_REQUIRED_CLASS =
      "cds-input cds-reset min-w-0 flex-1 h-full bg-transparent border-0 p-0 outline-none focus-visible:outline-hidden text-body font-normal text-primary focus-visible:shadow-none placeholder:text-muted disabled:opacity-disabled";
    initializeUiDisclosure12 = (0, runtime.initializeOnce)(() => {
      TEXT_INPUT_CLASS = `h-control pl-md rounded ${TEXT_INPUT_SURFACE_CLASS} font-sans text-body font-normal text-primary transition duration-fast`;
      TEXT_INPUT_PLACEHOLDER_CLASS = `rounded ${TEXT_INPUT_SURFACE_CLASS} px-md py-sm transition duration-fast`;
      TEXT_INPUT_INVALID_CLASS = `${TEXT_INPUT_PLACEHOLDER_CLASS} [&:hover:not(:focus-within):not([data-invalid]):not([data-disabled])]:shadow-field-hover focus-within:shadow-focus data-[invalid]:focus-within:shadow-focus-danger font-sans text-body text-primary`;
    });
  };
}
