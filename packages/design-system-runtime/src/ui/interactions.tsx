import type * as I from "../contracts/interactions";
import type * as C from "../contracts/controls";
import type * as O from "../contracts/overlays";
import type * as D from "../contracts/dom";
import type * as React from "react";
import type {
  CallbackRef,
  RefCleanup,
  OverlayKind,
  LayerProps,
  LayerValue,
  LayerRenderProps,
  CustomStyle,
} from "../contracts/dom";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiInteractions(runtime: RuntimeBindings): () => void {
  var classMergeThemeKeys: D.ThemeTokenManifest["themeKeys"];
  var classMergeTypographyScale: string[];
  var classMergeTypographyWeights: string[];
  var getClassMergeThemeValues: (name: D.ThemeClassGroup) => string[];
  var paddingTokenNames: string[];
  var marginTokenNames: string[];
  var gapTokenNames: string[];
  var createDirectionalClassGroups: (
    prefix: string,
    tokens: string[],
  ) => Record<string, Record<string, string[]>[]>;
  var typographyClassNames: string[];
  var typographyWeightClassNames: string[];
  var mergeTailwindClasses: (classes: string) => string;
  var initializeClassNames: () => void;
  var reactTranslations: typeof React;
  var translationContext: React.Context<I.TranslationResolver | undefined>;
  var initializeTranslations: () => void;
  var reactSheetChrome: typeof React;
  var jsxSheetChrome: typeof import("react/jsx-runtime");
  var SheetDismissButton: C.ForwardComponent<
    HTMLElement,
    I.SheetDismissButtonProps
  >;
  var SheetChrome: I.SheetChrome;
  var initializeSheetChrome: () => void;
  var initializeSheetFocusSupport: () => void;
  var reactSheetMeasurement: typeof React;
  var initializeSheetMeasurement: () => void;
  var reactSheetPopupHost: typeof React;
  var initializeSheetPopupHost: () => void;
  var reactLayers: typeof React;
  var jsxLayers: typeof import("react/jsx-runtime");
  var LAYER_BAND_SIZE: number;
  var TOAST_LAYER_BASE: number;
  var layerBaseContext: React.Context<number>;
  var overlayLayerOffsets: Record<OverlayKind, number>;
  var portalLayerClasses: string;
  var initializeLayers: () => void;
  var reactMergedRefs: typeof React;
  var initializeMergedRefs: () => void;
  var reactExperimentalTheme: typeof React;
  var createResolvedThemeSnapshot: (
    configuration?: I.ThemeConfiguration | null,
    previous?: I.ThemeSnapshot,
  ) => I.ThemeSnapshot | undefined;
  var themeStoreContext: React.Context<I.ThemeStore | undefined>;
  var defaultThemeStore: I.ThemeStore;
  var reportedThemeErrors: Set<string>;
  var initializeExperimentalTheme: () => void;
  var HTML_NAMESPACE: string;
  var SVG_NAMESPACE_GE0: string;
  var initializeElementNamespaces: () => void;
  var reactActivityHide: typeof React;
  var jsxActivityHide: typeof import("react/jsx-runtime");
  var activityHideElementsContext: React.Context<Set<Element> | null>;
  var initializeCloseOnActivityHide: () => void;
  var modalCatcherDragSession: I.ModalCatcherDragSession | null;
  var modalCatcherDragEndEvents: string[];
  var initializeModalCatcher: () => void;
  var reactPointerDismissal: typeof React;
  var jsxPointerDismissal: typeof import("react/jsx-runtime");
  var pointerDismissalContext: React.Context<boolean>;
  var initializePointerDismissal: () => void;
  var reactSkeletonContexts: typeof React;
  var jsxSkeletonContexts: typeof import("react/jsx-runtime");
  var skeletonActiveContext: React.Context<boolean>;
  var skeletonElementContext: React.Context<C.SkeletonTag>;
  var skeletonGroupContext: React.Context<number | null>;
  var skeletonShownStoreContext: React.Context<C.SkeletonShownStore | null>;
  var initializeSkeletonContexts: () => void;
  var jsxPortalRoot: typeof import("react/jsx-runtime");
  var initializePortalRoot: () => void;
  var reactForUiInteractions: typeof React;
  var REM_SCALE_VARIABLE: string;
  var DEFAULT_ROOT_FONT_SIZE: number;
  var ROOT_REM_PROBE_LENGTH_CSS: string;
  var ROOT_REM_PROBE_STYLE: string;
  var ROOT_FONT_PROBE_ATTRIBUTE: string;
  var pixelsToScaledRem: (pixels: number) => string;
  var rootRemProbeElement: HTMLDivElement | null;
  var rootRemResizeObserver: ResizeObserver | null;
  var cachedRootRemSize: number | null;
  var rootRemSubscribers: Set<() => void>;
  var initializeRemScale: () => void;
  var iconFontManifest: I.IconFontManifest;
  var iconCodepoints: I.IconFontManifest["icons"];
  var secondaryIconCodepoints: I.IconFontManifest["secondary"];
  var nextIconCodepoint: number;
  var iconMasterWeights: I.IconFontManifest["wght"];
  var animatedIconNames: string[] | undefined;
  var loopingIconNames: string[] | undefined;
  var iconAnimationDurations: I.IconFontManifest["animDur"];
  var iconAnimationExitDurations: I.IconFontManifest["animDurOut"];
  var iconAnimationEasings: I.IconFontManifest["animEase"];
  var iconManifest: I.IconFontManifest;
  var initializeIconManifest: () => void;
  var initializeIconAccessibility: () => void;
  var jsxIcons: typeof import("react/jsx-runtime");
  var iconSizeMetrics: Record<C.ResolvedIconSize, I.IconSizeMetric>;
  var iconSizes: C.ResolvedIconSize[];
  var DEFAULT_ICON_SIZE: C.IconSize;
  var primaryIconGlyphs: I.IconFontManifest["icons"];
  var secondaryIconGlyphs: Readonly<Record<string, number>>;
  var animatedIcons: Set<string>;
  var loopingIcons: Set<string>;
  var animationDurations: Readonly<Record<string, number>>;
  var animationExitDurations: Readonly<Record<string, number>>;
  var animationEasings: Readonly<Record<string, string>>;
  var iconWeightBounds: I.IconFontManifest["wght"];
  var MIN_ICON_FONT_WEIGHT: number;
  var MAX_ICON_FONT_WEIGHT: number;
  var customIconBaseStyle: React.CSSProperties;
  var iconFontStyles: Readonly<Record<C.ResolvedIconSize, I.IconSizeStyles>>;
  var initializeIcons: () => void;
  var reactCollisionPadding: typeof React;
  var jsxCollisionPadding: typeof import("react/jsx-runtime");
  var DEFAULT_COLLISION_PADDING: number;
  var desktopTitlebarStores: WeakMap<Document, D.ExternalStore<number>>;
  var getZeroInsetSnapshot: () => number;
  var subscribeInsetNoop: (listener: () => void) => () => void;
  var collisionPaddingContext: React.Context<I.CollisionPaddingContext | null>;
  var initializeCollisionPadding: () => void;
  var elevationSurfaceNames: Record<
    C.SurfaceProps["elevation"],
    C.SurfaceBackground
  >;
  var elevationShadowClasses: Record<C.SurfaceProps["elevation"], string>;
  var surfaceBackgroundClasses: Record<C.SurfaceBackground, string>;
  var focusShadowByMode: Record<"light" | "dark", string>;
  var dangerFocusShadowByMode: Record<"light" | "dark", string>;
  var initializeSurfaces: () => void;
  var reactMenuContexts: typeof React;
  var menuTriggerContext: React.Context<O.MenuRootState | null>;
  var defaultSubmenuState: O.MenuItemState;
  var submenuStateContext: React.Context<O.MenuItemState>;
  var FOCUSES_NOTHING_ATTRIBUTE: string;
  var contextMenuContext: React.Context<boolean>;
  var menuBarContext: React.Context<boolean>;
  var menuSheetLabelsContext: React.Context<O.MenuLabels>;
  var MENU_ANCHOR_SELECTOR: string;
  var menuRootIdentityContext: React.Context<React.RefObject<O.OverlayActions | null> | null>;
  var menuIsOpenContext: React.Context<React.RefObject<O.OverlayActions | null> | null>;
  var initializeMenuContexts: () => void;
  var jsxMenuScrollContent: typeof import("react/jsx-runtime");
  var menuScrollClasses: string;
  var menuBodyScrollClasses: string;
  var menuHeaderClasses: string;
  var menuFooterClasses: string;
  var MENU_ITEM_HEIGHT_CSS: string;
  var initializeMenuScrollContent: () => void;
  var reactKeyboardContextMenuFocus: typeof React;
  var keyboardContextMenuRoots: WeakMap<object, boolean>;
  var initializeKeyboardContextMenuFocus: () => void;
  var TEXT_ENTRY_SELECTOR: string;
  var initializeTextEntrySelector: () => void;
  var initializeSafeBlur: () => void;
  function cn(...classValues: import("clsx").ClassValue[]) {
    return mergeTailwindClasses((0, runtime.clsx)(classValues));
  }
  function interpolateTranslation(
    template: string,
    values?: I.TranslationValues,
  ) {
    if (!values) {
      return template;
    }
    return template.replace(/\{(\w+)\}/g, (input: string, options: string) =>
      options in values ? String(values[options]) : input,
    );
  }
  function translateWithFallback(
    translate: I.TranslationResolver | undefined,
    key: string,
    fallback: string,
    values?: I.TranslationValues,
  ) {
    return (
      translate?.(key, fallback, values) ||
      interpolateTranslation(fallback, values)
    );
  }
  function useTranslation(
    key: string,
    fallback: string,
    values?: I.TranslationValues,
  ) {
    return translateWithFallback(
      reactTranslations.useContext(translationContext),
      key,
      fallback,
      values,
    );
  }
  function SheetHandle({ drawPill = true }: I.SheetHandleProps) {
    let dragHandlers: Pick<
      React.DOMAttributes<HTMLElement>,
      | "onPointerDown"
      | "onPointerMove"
      | "onPointerUp"
      | "onPointerCancel"
      | "onLostPointerCapture"
    > = (0, runtime.useSheetDrag)();
    return (
      <div
        aria-hidden={true}
        data-cds-sheet-handle={""}
        {...dragHandlers}
        className={
          "flex min-h-8 shrink-0 touch-none items-center justify-center select-none"
        }
      >
        <div
          className={(0, runtime.clsx)(
            "h-1 w-9 rounded-full bg-border",
            !drawPill && "opacity-0",
          )}
        />
      </div>
    );
  }
  function SheetTitleBar({
    leading: leading,
    title: title,
  }: I.SheetTitleBarProps) {
    let dragHandlers: Pick<
        React.DOMAttributes<HTMLElement>,
        | "onPointerDown"
        | "onPointerMove"
        | "onPointerUp"
        | "onPointerCancel"
        | "onLostPointerCapture"
      > = (0, runtime.useSheetDrag)(),
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
    return (
      <div
        {...dragHandlers}
        className={
          "order-first flex min-h-control shrink-0 touch-none items-center gap-xs px-1 pb-1 select-none"
        }
      >
        {[
          hasLeading && <span className={"-me-2.5 shrink-0"}>{leading}</span>,
          <span
            aria-hidden={true}
            className={(0, runtime.clsx)(
              "min-w-0 flex-1 truncate text-start text-heading font-semibold text-primary",
              !hasLeading && "ps-2.5",
            )}
          >
            {title}
          </span>,
        ]}
      </div>
    );
  }
  function SheetBody({
    className: className,
    children: children,
  }: I.SheetBodyProps) {
    return (
      <div className={cn("flex min-h-0 flex-auto flex-col", className)}>
        {children}
      </div>
    );
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
          Promise.allSettled(value.map((input) => input.finished)).then(() => {
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
    options: O.SheetFrameContext | null,
  ) {
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
        callback3 = (input: EventTarget | null) => {
          if (!(input instanceof Element)) {
            return false;
          }
          if ((0, runtime.isEditableElement)(input)) {
            return true;
          }
          let ancestor = input.closest('[data-cds="TextInput"], label');
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
        callback4 = (event: Event) => {
          if (callback3(event.target)) {
            index = event.timeStamp || Date.now();
          }
        },
        callback5 = (event: Event) => {
          if ((0, runtime.isEditableElement)(event.target as Element | null)) {
            callback();
            if (index > 0 && (event.timeStamp || Date.now()) - index < 1000) {
              index = 0;
              value("tall");
            }
          }
        },
        callback6 = (event: Event) => {
          if (index > 0 && callback3(event.target)) {
            index = 0;
            value("tall");
          }
        },
        callback7 = (event: Event) => {
          if ((0, runtime.isEditableElement)(event.target as Element | null)) {
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
          let element2 = element.querySelector("[data-cds-sheet-control]");
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
    records: readonly MutationRecord[],
    hadOverflow: boolean,
  ) {
    if (!hadOverflow) {
      return false;
    }
    let scrollSelector = `[${runtime.SHEET_SCROLL_ATTRIBUTE}]`,
      addedCount = 0,
      removedCount = 0;
    for (let value of records) {
      let target = value.target,
        value2 =
          target.nodeType === Node.ELEMENT_NODE
            ? (target as Element)
            : target.parentElement;
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
      scrollElements = Array.from<HTMLElement>(
        element.querySelectorAll<HTMLElement>(
          `[${runtime.SHEET_SCROLL_ATTRIBUTE}]`,
        ),
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
      ) {
        firstElementChild = firstElementChild.nextElementSibling;
      }
      let lastElementChild = value.lastElementChild;
      while (
        lastElementChild !== null &&
        lastElementChild.getClientRects().length === 0
      ) {
        lastElementChild = lastElementChild.previousElementSibling;
      }
      let value2 = element.ownerDocument.defaultView?.getComputedStyle(value),
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
  function createSheetUncoverGate(element: HTMLElement, onReady: () => void) {
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
    input: HTMLElement,
    options: Window,
    context: () => void,
  ) {
    let style = options.getComputedStyle(input),
      callback = (input2: string) =>
        input2.split(",").map((input3: string) => {
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
          (input2: number, options2: number) =>
            input2 + (value[options2 % value.length] ?? 0),
        ),
      ),
      value3 = options.setTimeout(context, value2 + 34);
    return () => options.clearTimeout(value3);
  }
  function measureSheetScrollContent(element: HTMLElement): {
    visible: number;
    overflowContent: number;
  } {
    let visible = 0,
      overflowContent = 0;
    for (let value of Array.from<HTMLElement>(
      element.querySelectorAll<HTMLElement>(
        `[${runtime.SHEET_SCROLL_ATTRIBUTE}]`,
      ),
    )) {
      if (
        ((visible += value.clientHeight),
        value.scrollHeight > value.clientHeight + 1)
      ) {
        overflowContent += value.scrollHeight;
      }
    }
    return {
      visible: visible,
      overflowContent: overflowContent,
    };
  }
  function measureSheetControlOverflow(
    sheetElement: HTMLElement,
    controlElement: Element | null,
  ) {
    let windowObject = sheetElement.ownerDocument.defaultView;
    if (
      windowObject === null ||
      controlElement === null ||
      !sheetElement.contains(controlElement)
    ) {
      return 0;
    }
    let position = windowObject.getComputedStyle(controlElement).position;
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
        value3 = parseFloat(windowObject.getComputedStyle(value).marginBottom);
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
    options: O.SheetFrameContext | null,
    context: boolean,
  ) {
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
  ) {
    let roundedHeight = Math.round(height),
      chromeHeight = height - measureSheetScrollContent(element).visible;
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
  ) {
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
  function useSheetPopupHost(): I.SheetPopupHostState {
    let sheetState: D.SheetState = (0, runtime.useSheetState)(),
      [halfHeightFloor, setHalfHeightFloor] =
        reactSheetPopupHost.useState(false),
      halfHeightFloorRef = reactSheetPopupHost.useRef(false),
      measurementRef =
        reactSheetPopupHost.useRef<I.PinnedSheetMeasurement>(null),
      pinnedElementRef = reactSheetPopupHost.useRef<HTMLElement>(null),
      detachedElementRef =
        reactSheetPopupHost.useRef<I.DetachedSheetElement>(null),
      updateHalfHeightFloor = reactSheetPopupHost.useCallback(
        (input: boolean) => {
          halfHeightFloorRef.current = input;
          setHalfHeightFloor(input);
        },
        [],
      ),
      [element, setElement] = reactSheetPopupHost.useState<HTMLElement | null>(
        null,
      ),
      { sheet: sheet } = sheetState,
      frame = reactSheetPopupHost.useContext(runtime.sheetFrameContext),
      parentSheet = reactSheetPopupHost.useContext<D.SheetParentState | null>(
        runtime.sheetParentContext,
      ),
      elementRef = reactSheetPopupHost.useRef<HTMLElement>(null),
      pinHeight = frame?.pinHeight,
      measureAndPin = reactSheetPopupHost.useCallback(
        (input: HTMLElement, options: number) => {
          let value: boolean = (0, runtime.sheetContentCanGrow)(input);
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
        (input: HTMLElement | null) => {
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
            let value: boolean = (0, runtime.hasEditableSheetContent)(input);
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
          let element2 = element.querySelector("[data-cds-sheet-control]");
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
        callback2 = (input: number, options: boolean) => {
          let value5: number = (0, runtime.getSheetMinimumHeight)(
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
          let value9 = current.contentHeight + value7 - current.chromeAtPin;
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
        (input: MutationRecord[]) => {
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
    let coverParent = reactSheetPopupHost.useContext<
        ((token: object) => () => void) | null
      >(runtime.sheetCoverContext),
      windowObject = (0, runtime.useRootWindow)(),
      frameHeight: number | undefined = (0, runtime.getSheetFrameHeight)(
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
      style: C.DesignStyle | undefined = sheet
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
  function SheetPopupHost({
    children: children,
  }: {
    children(state: I.SheetPopupHostState): React.ReactNode;
  }) {
    return children(useSheetPopupHost());
  }
  function checkLayerBase(input: number, options: number): void {
    return;
  }
  function CdsLayer({
    children: children,
    base: base,
    render: render,
  }: LayerProps): React.ReactElement {
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
    return (
      <layerBaseContext.Provider value={value2}>
        {value3 ?? children}
      </layerBaseContext.Provider>
    );
  }
  function warnInvalidLayerOffset(source: string, layerOffset: number): void {
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
  function useDefaultOverlayLayer(input: OverlayKind): LayerValue {
    return useOverlayLayer(input);
  }
  function useOverlayLayer(
    parentBase: OverlayKind,
    layerOffset?: number,
  ): LayerValue {
    let zIndex = reactLayers.useContext(layerBaseContext);
    if (layerOffset === undefined) {
      let value2 = zIndex + LAYER_BAND_SIZE;
      checkLayerBase(value2, zIndex);
      let value3 = value2 + overlayLayerOffsets[parentBase];
      return {
        base: value2,
        style: {
          zIndex: value3,
          "--cds-layer-base": value2,
        },
        portalProps: {
          className: portalLayerClasses,
          style: {
            "--cds-portal-z": value3,
            "--cds-layer-base": value2,
          },
        },
      };
    }
    warnInvalidLayerOffset(`layerOffset=${layerOffset}`, layerOffset);
    let value = zIndex + layerOffset;
    return {
      base: zIndex,
      style: {
        zIndex: value,
        "--cds-layer-base": zIndex,
      },
      portalProps: {
        className: portalLayerClasses,
        style: {
          "--cds-portal-z": value,
          "--cds-layer-base": zIndex,
        },
      },
    };
  }
  function useCdsLayerAwareZIndex(layerOffset: number): number {
    let inheritedLayer = reactLayers.useContext(layerBaseContext);
    warnInvalidLayerOffset(
      `useCdsLayerAwareZIndex(${layerOffset})`,
      layerOffset,
    );
    return inheritedLayer + layerOffset;
  }
  function CdsLayerVarBridge({
    children: children,
    className: className,
  }: React.PropsWithChildren<{
    className?: string;
  }>): React.ReactElement {
    let value = reactLayers.useContext(layerBaseContext);
    return (
      <div
        className={cn("contents", className)}
        data-cds={"CdsLayerVarBridge"}
        data-cds-layer-var-bridge={""}
        style={
          {
            "--cds-layer-base": value,
          } as CustomStyle
        }
      >
        {children}
      </div>
    );
  }
  function setReactRef<Value>(
    ref: CallbackRef<Value>,
    value: Value | null,
  ): void | RefCleanup {
    if (typeof ref === "function") {
      return ref(value);
    }
    if (ref) {
      ref.current = value;
    }
  }
  function mergeRefs<Value>(
    ...refs: CallbackRef<Value>[]
  ): React.RefCallback<Value> {
    return (input: Value | null) => {
      let value = refs.map((input2) => setReactRef(input2, input));
      if (!value.some((input2) => typeof input2 === "function")) {
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
  function useMergedRefs<Value>(
    firstRef?: CallbackRef<Value>,
    secondRef?: CallbackRef<Value>,
    thirdRef?: CallbackRef<Value>,
  ): React.RefCallback<Value> {
    return reactMergedRefs.useMemo(
      () => mergeRefs(firstRef, secondRef, thirdRef),
      [firstRef, secondRef, thirdRef],
    );
  }
  function useStableMergedRef<Value>(
    firstRef: React.RefCallback<Value>,
    secondRef?: CallbackRef<Value>,
  ): React.RefCallback<Value> {
    let stableFirstRef: React.RefCallback<Value> = (0,
    runtime.useEventCallback)(firstRef);
    return (0, runtime.useEventCallback)((input: Value | null) =>
      mergeRefs(stableFirstRef, secondRef)(input),
    );
  }
  function resolveExperimentalTheme(
    configuration: I.ThemeConfiguration,
  ): unknown {
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
  function createThemeStore(
    configuration?: I.ThemeConfiguration | null,
  ): I.ThemeStore {
    let listeners = new Set<() => void>(),
      snapshot = createResolvedThemeSnapshot(configuration),
      serverSnapshot = snapshot,
      notify = () => {
        for (let value of listeners) {
          value();
        }
      };
    return {
      subscribe: (input: () => void) => {
        listeners.add(input);
        return () => listeners.delete(input);
      },
      getSnapshot: () => snapshot,
      getServerSnapshot: () => serverSnapshot,
      getId: () => snapshot?.theme.id,
      set: (input: I.ThemeConfiguration | null | undefined) => {
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
  function reportThemeApplicationError(themeId: string, error: unknown) {
    reportThemeErrorOnce(
      '<CdsRoot experimental.theme> could not put the theme "' +
        themeId +
        '" on the page, so the page keeps what it had (no theme, or the previous one) while useTokenValue and useCdsTheme answer for "' +
        themeId +
        '". ' +
        (error instanceof Error ? error.message : String(error)),
    );
  }
  function disposeThemeApplication(
    cleanupRef: React.RefObject<(() => void) | void>,
  ): void {
    let cleanup = cleanupRef.current;
    cleanupRef.current = undefined;
    try {
      cleanup?.();
    } catch {}
  }
  function useExperimentalThemeStore(
    configuration: I.ThemeConfiguration | null | undefined,
    targetRef: React.RefObject<HTMLElement | null>,
  ) {
    let parentStore = reactExperimentalTheme.useContext(themeStoreContext),
      [ownStore] = reactExperimentalTheme.useState(() =>
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
      cleanupRef = reactExperimentalTheme.useRef<(() => void) | void>(
        undefined,
      );
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
  function getElementNamespace(input?: unknown): string | null | undefined {
    let value = input as Element | null | undefined;
    if (value?.nodeType === 1) {
      return value.namespaceURI;
    } else {
      return undefined;
    }
  }
  function isHtmlElement(input?: unknown): input is HTMLElement {
    return getElementNamespace(input) === HTML_NAMESPACE;
  }
  function isSvgElement(input?: unknown): input is SVGElement {
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
    ) {
      if (isHtmlElement(value) && value.style.display === "none") {
        return true;
      }
    }
    return false;
  }
  function hasOpenChild(input: Element): boolean {
    for (let value of input.children) {
      if (value.hasAttribute("data-open")) {
        return true;
      }
    }
    return false;
  }
  function CloseOnActivityHideProvider({
    actionsRef: actionsRef,
    children: children,
  }: I.ActivityHideProviderProps) {
    let [value] = reactActivityHide.useState(() => new Set<Element>()),
      ref = reactActivityHide.useRef(false);
    reactActivityHide.useEffect(() => {
      if (ref.current) {
        ref.current = false;
        actionsRef.current?.close?.();
      }
      return () => {
        ref.current = false;
        for (let value2 of value) {
          if (isHiddenByInlineDisplay(value2) && hasOpenChild(value2)) {
            ref.current = true;
          }
        }
      };
    }, [actionsRef, value]);
    return (
      <activityHideElementsContext.Provider value={value}>
        {children}
      </activityHideElementsContext.Provider>
    );
  }
  function useCloseOnActivityHideRef(
    input: boolean,
  ): React.RefObject<HTMLElement | null> {
    let value = reactActivityHide.useContext(activityHideElementsContext),
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
    input: HTMLElement,
    options: EventTarget | null,
  ): HTMLElement | null {
    let value = (0, runtime.asElement)(options) as HTMLElement | null;
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
    input: HTMLElement,
    options: EventTarget | null,
  ) {
    let value = getCompanionModalCatcher(input, options);
    if (value === null) {
      return false;
    }
    let value2 = (0, runtime.asElement)(value.ownerDocument.activeElement),
      value3 = input.parentElement ?? input;
    return value2 === null || !value3.contains(value2);
  }
  function handleModalCatcherPointerDown(
    event: React.PointerEvent<HTMLElement>,
  ): void {
    if (
      event.pointerType !== "touch" &&
      shouldSuppressModalCatcherFocus(event.currentTarget, event.target)
    ) {
      event.preventDefault();
    }
  }
  function handleModalCatcherMouseDown(
    event: React.MouseEvent<HTMLElement>,
  ): void {
    if (shouldSuppressModalCatcherFocus(event.currentTarget, event.target)) {
      event.preventDefault();
    }
  }
  function handleModalCatcherDragStart(
    event: React.DragEvent<HTMLElement>,
  ): void {
    let currentTarget = event.currentTarget,
      value: HTMLElement | null = null;
    for (let value3 of currentTarget.children) {
      if (
        ((value = getCompanionModalCatcher(currentTarget, value3)),
        value !== null)
      ) {
        break;
      }
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
      state = {
        event: event.nativeEvent,
        restoreAll: () => {
          value2.style.pointerEvents = "";
          for (let value3 of modalCatcherDragEndEvents) {
            ownerDocument.removeEventListener(value3, callback, true);
          }
          if (modalCatcherDragSession === state) {
            modalCatcherDragSession = null;
          }
        },
      },
      callback = () => state.restoreAll();
    modalCatcherDragSession = state;
    for (let value3 of modalCatcherDragEndEvents) {
      ownerDocument.addEventListener(value3, callback, true);
    }
  }
  function ResetSkeletonContexts({
    children: children,
  }: React.PropsWithChildren) {
    return (
      <skeletonActiveContext.Provider value={false}>
        <skeletonElementContext.Provider value={"div"}>
          <skeletonShownStoreContext.Provider value={null}>
            <skeletonGroupContext.Provider value={null}>
              {children}
            </skeletonGroupContext.Provider>
          </skeletonShownStoreContext.Provider>
        </skeletonElementContext.Provider>
      </skeletonActiveContext.Provider>
    );
  }
  function PortalRoot({
    children: children,
    className: className,
    style: style,
    surface: surface,
    density: density,
    companionModalCatcher = false,
    closeOnActivityHide = false,
  }: I.PortalRootProps) {
    let value = useCloseOnActivityHideRef(closeOnActivityHide),
      value2 = useMergedRefs(runtime.trackInputForElement, value),
      value3 = (0, runtime.useDensity)(),
      value4 = density ?? value3,
      value5: "light" | "dark" | undefined = (0, runtime.useColorMode)(),
      value6 = useCdsThemeId(),
      value7: string | undefined = (0, runtime.usePlatform)(),
      value8: string | undefined = (0, runtime.useFont)(),
      value9: string | undefined =
        (0, runtime.useDocumentFont)(value8 === undefined) ?? value8,
      value10: string | null | undefined = (0, runtime.useMonospaceFont)(),
      value11: string | undefined = (0, runtime.useFeatureFlagAttribute)(),
      value12: string | undefined = (0, runtime.usePageBackground)(),
      value13: string | undefined = (0, runtime.useSurfaceBackground)(),
      value14 = surface ?? value13,
      value15: C.DesignStyle | undefined =
        value14 || value10 !== undefined || style
          ? {
              ...(0, runtime.getSurfaceBackgroundStyle)(value14),
              ...(0, runtime.getMonospaceOverrideStyle)(value10),
              ...style,
            }
          : undefined;
    return (
      <div
        ref={value2}
        className={cn("cds-root pointer-events-auto", className)}
        data-cds-portal={""}
        data-density={value4}
        data-mode={value5}
        data-cds-theme={value6}
        data-platform={value7}
        data-font={value9}
        data-cds-fizzy-lake={value11}
        data-page-bg={value12}
        style={value15}
        onPointerDown={
          companionModalCatcher ? handleModalCatcherPointerDown : undefined
        }
        onMouseDown={
          companionModalCatcher ? handleModalCatcherMouseDown : undefined
        }
        onDragStart={
          companionModalCatcher ? handleModalCatcherDragStart : undefined
        }
      >
        <runtime.portalDensityContext.Provider value={value4}>
          <runtime.surfaceBackgroundContext.Provider value={value14}>
            <runtime.isPortalRootContext.Provider value={true}>
              <pointerDismissalContext.Provider value={false}>
                <ResetSkeletonContexts>{children}</ResetSkeletonContexts>
              </pointerDismissalContext.Provider>
            </runtime.isPortalRootContext.Provider>
          </runtime.surfaceBackgroundContext.Provider>
        </runtime.portalDensityContext.Provider>
      </div>
    );
  }
  function rootFontSizeProbe(): HTMLDivElement {
    if (rootRemProbeElement === null || !rootRemProbeElement.isConnected) {
      if (rootRemProbeElement !== null) {
        rootRemResizeObserver?.unobserve(rootRemProbeElement);
        rootRemProbeElement.remove();
      }
      rootRemProbeElement =
        document.documentElement.querySelector(
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
    let value = /^([\d.]+)px$/.exec(getComputedStyle(element).fontSize),
      value2 = value === null ? NaN : Number(value[1]) / DEFAULT_ROOT_FONT_SIZE;
    if (value2 > 0) {
      return value2;
    }
    return (
      parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
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
          for (let value3 of rootRemSubscribers) {
            value3();
          }
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
  function resolveIconSize(
    size: C.IconSize,
    densitySize: C.ResolvedIconSize,
  ): C.ResolvedIconSize {
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
  function useDensityIconSize(): C.ResolvedIconSize {
    if ((0, runtime.useDensity)() === "comfortable") {
      return "md";
    } else {
      return "sm";
    }
  }
  function useIconSize(input: C.IconSize = DEFAULT_ICON_SIZE) {
    return resolveIconSize(input, useDensityIconSize());
  }
  function getClosestIconSize(pixels: number): C.ResolvedIconSize {
    let closestSize = iconSizes[0],
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
    masterSize: I.IconMasterSize,
    pixels: number,
  ) {
    let normalizedWeight = (strokeWidth * masterSize) / pixels,
      { lo: minimumMasterWeight, hi: maximumMasterWeight } =
        iconWeightBounds[`${masterSize}`],
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
    options: React.AriaAttributes,
  ): void {}
  function getCustomIconFontStyle(pixels: number, strokeWidth: number) {
    let masterSize: I.IconMasterSize = pixels <= 18 ? 16 : 20;
    return {
      fontSize: pixelsToScaledRem(pixels),
      fontWeight: calculateIconFontWeight(strokeWidth, masterSize, pixels),
    };
  }
  function createIconSizeStyles(size: C.ResolvedIconSize): I.IconSizeStyles {
    let { px: pixels, stroke: stroke } = iconSizeMetrics[size];
    return Object.freeze({
      regular: Object.freeze(getCustomIconFontStyle(pixels, stroke.regular)),
      ...("strong" in stroke && {
        strong: Object.freeze(getCustomIconFontStyle(pixels, stroke.strong)),
      }),
    });
  }
  function Icon(input: I.IconProps): React.ReactElement {
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
      let px2 = iconSizeMetrics[resolveIconSize(value35, value)].px,
        value36 = pixelsToScaledRem(px2);
      return (
        <svg
          data-cds={"Icon"}
          width={"1em"}
          height={"1em"}
          viewBox={`0 0 ${value27.viewBox} ${value27.viewBox}`}
          fill={"currentColor"}
          fillRule={"evenodd"}
          stroke={"none"}
          strokeLinecap={"round"}
          strokeLinejoin={"round"}
          xmlns={"http://www.w3.org/2000/svg"}
          style={{
            ...customIconBaseStyle,
            fontSize: value36,
            ...value30,
          }}
          className={value29}
          {...value34}
          role={value34.role ?? (value28 ? "img" : undefined)}
          aria-hidden={value34["aria-hidden"] ?? (value28 ? undefined : true)}
          aria-label={value34["aria-label"] ?? (value28 || undefined)}
        >
          {value27.paths.map(
            (input2: string | I.CustomIconStrokePath, options: number) =>
              typeof input2 === "string"
                ? (() => {
                    const _Element = "path";
                    const _elementProps = {
                      d: input2,
                    };
                    const _elementKey = options;
                    return <_Element key={_elementKey} {..._elementProps} />;
                  })()
                : (() => {
                    const _Element2 = "path";
                    const _elementProps2 = {
                      d: input2.d,
                      fill: "none",
                      stroke: "currentColor",
                      strokeWidth: input2.strokeWidth,
                      vectorEffect: "non-scaling-stroke",
                    };
                    const _elementKey2 = options;
                    return <_Element2 key={_elementKey2} {..._elementProps2} />;
                  })(),
          )}
        </svg>
      );
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
      value15: C.ResolvedIconSize;
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
    return (
      <span
        data-cds={"Icon"}
        data-cds-anim={value22 ? "" : undefined}
        data-cds-anim-loop={
          value22 && loopingIcons.has(value13) ? "" : undefined
        }
        style={
          value4
            ? {
                ...value26,
                ...value4,
              }
            : value26
        }
        className={value3}
        {...value10}
        role={value10.role ?? (value2 ? "img" : undefined)}
        aria-hidden={value10["aria-hidden"] ?? (value2 ? undefined : true)}
        aria-label={value10["aria-label"] ?? (value2 || undefined)}
      >
        {[
          value19 !== undefined && (
            <span data-cds-icon-layer={"secondary"} aria-hidden={"true"}>
              {String.fromCodePoint(value19)}
            </span>
          ),
          value18 !== undefined ? String.fromCodePoint(value18) : null,
        ]}
      </span>
    );
  }
  function isIconName(input: unknown): input is string {
    return typeof input === "string";
  }
  function IconSlot({ icon: icon }: { icon?: React.ReactNode }) {
    return (
      <span className={"flex size-icon shrink-0 items-center justify-center"}>
        {isIconName(icon) ? <Icon name={icon} size={"auto"} /> : icon}
      </span>
    );
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
  function getDesktopTitlebarStore(doc: Document): D.ExternalStore<number> {
    let entry = desktopTitlebarStores.get(doc);
    if (entry === undefined) {
      let values = new Set<() => void>(),
        value: D.SafeMutationObserver | null = null,
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
                  for (let value5 of values) {
                    value5();
                  }
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
          let value3 = values.size === 0 && value.takeRecords().length > 0;
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
  function resolveContainerElement(
    input?: I.ContainerInput,
  ): I.ContainerElement | null {
    let callback = (input2: I.ContainerInput): input2 is I.ContainerElement =>
      typeof input2 === "object" &&
      input2 !== null &&
      ((input2 as Node).nodeType === 1 || (input2 as Node).nodeType === 11) &&
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
  function useDesktopTitlebarInset(input?: I.ContainerInput): number {
    let value: HTMLElement | undefined = (0, runtime.useRootElement)(),
      callback = reactCollisionPadding.useCallback(
        () =>
          (resolveContainerElement(input) ?? value)?.ownerDocument ??
          (typeof document === "undefined" ? null : document),
        [input, value],
      ),
      [value2, value3] = reactCollisionPadding.useState(callback);
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
    input?: O.CollisionPadding,
    options?: I.ContainerInput,
  ): O.CollisionPadding | undefined {
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
  }: I.CollisionPaddingProviderProps) {
    let value = useCollisionPadding(override, container),
      memo = reactCollisionPadding.useMemo(
        () => ({
          collisionPadding: value,
        }),
        [value],
      ),
      value2 = children(value);
    if (provideInherit) {
      return (
        <collisionPaddingContext.Provider value={memo}>
          {value2}
        </collisionPaddingContext.Provider>
      );
    } else {
      return value2;
    }
  }
  function getSurfaceClasses(input: C.SurfaceProps["elevation"]): string {
    return `rounded-card ${surfaceBackgroundClasses[elevationSurfaceNames[input]]} ${elevationShadowClasses[input]}`;
  }
  function createMenuVirtualAnchor(
    input: Pick<O.MenuRootState, "triggerRef">,
  ): {
    readonly contextElement: HTMLElement | undefined;
    getBoundingClientRect(): Omit<DOMRectReadOnly, "toJSON">;
  } {
    return {
      get contextElement() {
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
  function warnNestedMenuLayerOffset() {
    console.warn(
      "cds: layerOffset is ignored on nested `Menu.Popup` / `ContextMenu.SubmenuPopup` — a submenu's parent band is the root menu's own band, where the root's click shield sits; joining it would interleave the submenu with the root's own popup and shield — below them at low offsets. Set layerOffset on the root popup instead.",
    );
  }
  function warnNestedMenuInitialFocus() {
    console.warn(
      "cds: initialFocus is ignored on nested `Menu.Popup` / `ContextMenu.SubmenuPopup` — whether an open moves focus is the root popup's decision and its submenus follow it. Set initialFocus on the root Menu.Popup instead.",
    );
  }
  function useStableObjectRef<
    Value = HTMLElement,
  >(): React.RefObject<Value | null> {
    let [value] = reactMenuContexts.useState<React.RefObject<Value | null>>(
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
  }: O.PopupScrollAreaProps) {
    let value =
      maxVisibleItems !== undefined
        ? `calc(${maxVisibleItems} * ${MENU_ITEM_HEIGHT_CSS} + 0.5rem)`
        : undefined;
    if (header || footer) {
      return (
        <div
          className={(0, runtime.clsx)(
            "flex min-h-0 flex-col overflow-hidden rounded-[inherit]",
            fill && "flex-1",
          )}
        >
          {[
            header && (
              <div className={cn(menuHeaderClasses, headerClassName)}>
                {header}
              </div>
            ),
            <div
              style={{
                maxHeight: value,
              }}
              className={`${menuBodyScrollClasses}${header ? " pt-0" : ""}`}
              {...{
                [runtime.SHEET_SCROLL_ATTRIBUTE]: "",
              }}
            >
              {children}
            </div>,
            footer && <div className={menuFooterClasses}>{footer}</div>,
          ]}
        </div>
      );
    }
    return (
      <div
        style={{
          maxHeight: value,
        }}
        className={(0, runtime.clsx)(menuScrollClasses, fill && "flex-1")}
        {...{
          [runtime.SHEET_SCROLL_ATTRIBUTE]: "",
        }}
      >
        {children}
      </div>
    );
  }
  function isKeyboardContextMenuEvent(
    input?: I.ContextMenuInputEvent,
  ): boolean {
    if (input === undefined || input.type !== "contextmenu") {
      return false;
    }
    let { button: value, pointerType: value2 } = input;
    return value === -1 && value2 !== "touch" && value2 !== "pen";
  }
  function recordKeyboardContextMenuOpen(
    input: object,
    options: boolean,
    context: I.ContextMenuChange,
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
  function useKeyboardContextMenuInitialFocus(
    input: React.RefObject<HTMLElement | null>,
  ): void {
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
              .querySelector<HTMLElement>(
                '[role^="menuitem"]:not([data-disabled])',
              )
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
  function blurWithSafeRelatedTarget(input: O.FocusableElement): void {
    let callback = (input2: Event) => {
      let relatedTarget = (input2 as FocusEvent).relatedTarget;
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
  function registerOverlayOwner(
    input: Element,
    options: () => O.FocusableElement | null,
  ): void {
    runtime.overlayOwnerResolvers.set(input, options);
  }
  function getOverlayOwnerAncestors(
    input: Element | null,
  ): O.FocusableElement[] {
    let items: O.FocusableElement[] = [],
      value: Element | null | undefined = input;
    while (value !== null && items.length < runtime.MAX_OVERLAY_OWNER_DEPTH) {
      let entry: (() => O.FocusableElement | null) | undefined =
        runtime.overlayOwnerResolvers.get(value);
      if (entry === undefined) {
        value = value.parentElement;
        continue;
      }
      let value2: O.FocusableElement | null = entry();
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
    "initializeSheetFocusSupport",
    () => initializeSheetFocusSupport,
    (value) => {
      initializeSheetFocusSupport = value;
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
  bindRuntimeValue(
    runtime,
    "useCdsLayerAwareZIndex",
    () => useCdsLayerAwareZIndex,
  );
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
    getClassMergeThemeValues = (input: D.ThemeClassGroup) =>
      classMergeThemeKeys[input];
    createDirectionalClassGroups = (input: string, options: string[]) =>
      Object.fromEntries(
        ["", "x", "y", "s", "e", "t", "r", "b", "l"].map((input2: string) => [
          `${input}${input2}`,
          [
            {
              [`${input}${input2}`]: options,
            },
          ],
        ]),
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
        (input: string) =>
          classMergeTypographyWeights.map(
            (input2: string) => `${input}-${input2}`,
          ),
      );
      mergeTailwindClasses = (0, runtime.extendTailwindMerge)<
        "font-size-weight" | "grade"
      >({
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
      translationContext = reactTranslations.createContext<
        I.TranslationResolver | undefined
      >(undefined);
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
        }: I.SheetDismissButtonProps,
        options: React.ForwardedRef<HTMLElement>,
      ) {
        let value = useTranslation("close", "Close"),
          value2 = label ?? value;
        return (() => {
          const _Element3 = as2;
          const _elementProps3 = {
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
          };
          return <_Element3 {..._elementProps3} />;
        })();
      });
      SheetChrome = {
        Handle: SheetHandle,
        TitleBar: SheetTitleBar,
        DismissButton: SheetDismissButton,
        Body: SheetBody,
      };
    });
    initializeSheetFocusSupport = () => {};
    initializeSheetMeasurement = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeVisualKeyboard)();
      (0, runtime.initializePresentationMode)();
      initializeSheetFocusSupport();
      reactSheetMeasurement = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
    });
    initializeSheetPopupHost = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeIsomorphicLayoutEffect)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeIconSupport)();
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
      (CdsLayer as React.FunctionComponent<LayerProps>).displayName =
        "CdsLayer";
      overlayLayerOffsets = {
        modal: 40,
        tooltip: 30,
        contextmenu: 30,
        popover: 20,
        menu: 20,
        combobox: 20,
        coachmark: 10,
      };
      (
        CdsLayerVarBridge as React.FunctionComponent<
          React.PropsWithChildren<{
            className?: string;
          }>
        >
      ).displayName = "CdsLayerVarBridge";
    });
    initializeMergedRefs = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeEventCallbacks)();
      reactMergedRefs = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
    });
    createResolvedThemeSnapshot = (
      input?: I.ThemeConfiguration | null,
      options?: I.ThemeSnapshot,
    ) => {
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
      themeStoreContext = reactExperimentalTheme.createContext<
        I.ThemeStore | undefined
      >(undefined);
      defaultThemeStore = createThemeStore(undefined);
      reportedThemeErrors = new Set();
    });
    HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
    SVG_NAMESPACE_GE0 = "http://www.w3.org/2000/svg";
    initializeElementNamespaces = () => {};
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
      activityHideElementsContext =
        reactActivityHide.createContext<Set<Element> | null>(null);
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
      skeletonElementContext =
        reactSkeletonContexts.createContext<C.SkeletonTag>("div");
      skeletonGroupContext = reactSkeletonContexts.createContext<number | null>(
        null,
      );
      skeletonShownStoreContext =
        reactSkeletonContexts.createContext<C.SkeletonShownStore | null>(null);
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
    pixelsToScaledRem = (pixels: number): string =>
      `calc(${pixels / 16}rem * var(${REM_SCALE_VARIABLE}, 1))`;
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
    initializeIconAccessibility = () => {};
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
    getZeroInsetSnapshot = () => 0;
    subscribeInsetNoop = () => () => {
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
      collisionPaddingContext =
        reactCollisionPadding.createContext<I.CollisionPaddingContext | null>(
          null,
        );
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
      menuTriggerContext =
        reactMenuContexts.createContext<O.MenuRootState | null>(null);
      defaultSubmenuState = {
        label: null,
        open: false,
      };
      submenuStateContext =
        reactMenuContexts.createContext(defaultSubmenuState);
      contextMenuContext = reactMenuContexts.createContext(false);
      menuBarContext = reactMenuContexts.createContext(false);
      menuSheetLabelsContext = reactMenuContexts.createContext<O.MenuLabels>({
        sheetTitle: undefined,
        backLabel: undefined,
        closeLabel: undefined,
      });
      menuRootIdentityContext =
        reactMenuContexts.createContext<React.RefObject<O.OverlayActions | null> | null>(
          null,
        );
      menuIsOpenContext =
        reactMenuContexts.createContext<React.RefObject<O.OverlayActions | null> | null>(
          null,
        );
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
    initializeKeyboardContextMenuFocus = (0, runtime.initializeOnce)(() => {
      initializeMenuContexts();
      reactKeyboardContextMenuFocus = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      keyboardContextMenuRoots = new WeakMap();
    });
    TEXT_ENTRY_SELECTOR =
      "input:not([type='hidden']):not([disabled]),[contenteditable]:not([contenteditable='false']),textarea:not([disabled])";
    initializeTextEntrySelector = () => {};
    initializeSafeBlur = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeElementAccess)();
    });
  };
}
