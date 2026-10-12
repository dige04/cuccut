import type * as Layers from "../contracts/layers";
import type * as Dom from "../contracts/dom";
import type * as Overlays from "../contracts/overlays";
import type {
  CollisionPadding,
  FocusableElement,
  ForwardComponent,
  InitialPopupFocus,
  MenuChange,
  MenuPopupProps,
  PassiveGateProps,
  PassiveOpenCell,
  PassiveOpenGateState,
  PassiveOpenLevel,
  PassivePopupProps,
  PopupFocus,
  PopupInputKind,
  PassivePopupTransform,
  MenuPopupElementProps,
  PopupAnimationInput,
  PopupAnimationState,
  PopupPlacement,
  ColorMode,
  ControlSize,
  Density,
  DesignStyle,
} from "../contracts/layers";
import type * as React from "react";
import type {
  SheetFrame,
  InnerOverlay,
  OverlayStack,
  OverlayCloseDetails,
  OverlayEvent,
  OverlayFocusOptions,
  OverlayFocusReturn,
  ClickToFocusOptions,
  HrefOrigin,
} from "../contracts/dom";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiOverlays(runtime: RuntimeBindings): () => void {
  var overlayOwnerResolvers: WeakMap<Element, () => FocusableElement | null>;
  var MAX_OVERLAY_OWNER_DEPTH: number;
  var initializeOverlayOwners: () => void;
  var reactOverlayFocus: typeof React;
  var initializeOverlayFocus: () => void;
  var OVERLAY_ATTRIBUTE: "data-cds-overlay";
  var OPEN_OVERLAY_SELECTOR_VQ5: string;
  var initializeOverlaySelector: () => void;
  var reactOverlayStack: typeof React;
  var overlayStackContext: React.Context<OverlayStack | null>;
  var DOCUMENT_NODE_TYPE: number;
  var initializeOverlayStack: () => void;
  var reactMenuOverlayRegistration: typeof React;
  var menuOverlayAttributes: {
    "data-cds-overlay": string;
  };
  var initializeMenuOverlayRegistration: () => void;
  var reactContextMenuPopup: typeof React;
  var jsxContextMenuPopup: typeof import("react/jsx-runtime");
  var contextMenuPopupClasses: string;
  var ContextMenuPopupFrame: ForwardComponent<
    HTMLDivElement,
    MenuPopupElementProps
  >;
  var initializeContextMenuPopup: () => void;
  var reactClickToFocus: typeof React;
  var INTERACTIVE_CLICK_TARGET_SELECTOR: string;
  var initializeClickToFocus: () => void;
  var FORM_POINTER_FOCUS_SELECTOR: string;
  var SELECT_ELEMENT_SELECTOR: string;
  var DRAGGABLE_ELEMENT_SELECTOR: string;
  var initializePopupPointerFocus: () => void;
  var reactPassiveOpen: typeof React;
  var jsxPassiveOpen: typeof import("react/jsx-runtime");
  var reactDomPassiveOpen: typeof import("react-dom");
  var PASSIVE_HOVER_OPEN_REASON: string;
  var PASSIVE_FOCUS_OUT_REASON: string;
  var passiveOpenStateContext: React.Context<PassiveOpenCell | null>;
  var passiveFocusDeclinedContext: React.Context<boolean>;
  var passiveDeclinedFocusProps: Pick<PassivePopupProps, "tabIndex">;
  var passiveDefaultFocusProps: Pick<PassivePopupProps, "tabIndex">;
  var passiveOpenEngagementKeys: Set<string>;
  var passiveOpenModifierKeys: Set<string>;
  var subscribePassiveOpenNoop: (listener: () => void) => () => void;
  var getPassiveOffSnapshot: () => "off";
  var unchangedPopupProps: PassivePopupTransform;
  var initializePassiveOpen: () => void;
  var menuItemVariants: (props?: { variant?: "default" | "danger" }) => string;
  var menuItemDescriptionPaddingClass: string;
  var initializeMenuItemVariants: () => void;
  var reactMenuOpener: typeof React;
  var menuOpenerRefContext: React.Context<
    React.RefObject<HTMLElement | null> | undefined
  >;
  var MenuOpenerProvider: React.Provider<
    React.RefObject<HTMLElement | null> | undefined
  >;
  var initializeMenuOpener: () => void;
  var reactMenuPopupElement: typeof React;
  var jsxMenuPopupElement: typeof import("react/jsx-runtime");
  var MenuPopupElement: ForwardComponent<HTMLDivElement, MenuPopupElementProps>;
  var initializeMenuPopupElement: () => void;
  var reactStablePopupPlacement: typeof React;
  var heldPositionerClasses: string;
  var heldPopupClasses: string;
  var POPUP_PLACEMENT_SETTLE_FRAMES: number;
  var initializeStablePopupPlacement: () => void;
  var TOUCH_DEVICE_QUERY: string;
  var ELECTRON_USER_AGENT_TOKEN: string;
  var initializeModalReleasePlatform: () => void;
  var reactModalPortalInert: typeof React;
  var inertExcludedTags: Set<string>;
  var MODAL_INERT_LIVE_REGION_SELECTOR: string;
  var modalInertRefCounts: Layers.InertRefCounts;
  var initializeModalPortalInert: () => void;
  var reactMenuSheetPopup: typeof React;
  var jsxMenuSheetPopup: typeof import("react/jsx-runtime");
  var coveredMenuSheetOwners: Layers.CoveredMenuSheetOwners;
  var MenuSheetPopup: ForwardComponent<HTMLDivElement, MenuPopupProps>;
  var initializeMenuSheetPopup: () => void;
  var jsxPopoverSheetBody: typeof import("react/jsx-runtime");
  var initializePopoverSheetContent: () => void;
  var jsxComboboxSheetBackdrop: typeof import("react/jsx-runtime");
  var initializeComboboxSheetBackdrop: () => void;
  var mobileSheetExports: Overlays.MobileSheetParts;
  var initializeMobileSheetExports: () => void;
  var reactSheetImplementation: typeof React;
  var loadedSheetImplementation: Overlays.MobileSheetParts | null;
  var sheetImplementationFailed: boolean;
  var sheetImplementationRequests: number;
  var sheetImplementationGeneration: number;
  var sheetImplementationPromise: Promise<Overlays.MobileSheetParts | null> | null;
  var sheetImplementationSubscribers: Set<() => void>;
  var getSheetImplementationSnapshot: () => Overlays.MobileSheetParts | null;
  var getSheetImplementationLoadedSnapshot: () => boolean;
  var getSheetImplementationFailedSnapshot: () => boolean;
  var getNullSheetImplementationSnapshot: () => null;
  var getFalseSheetImplementationSnapshot: () => false;
  var initializeSheetImplementation: () => void;
  var reactPreloadSheets: typeof React;
  var initializePreloadSheets: () => void;
  var desktopPlatformUserAgentPattern: RegExp;
  var initializeCdsPlatform: () => void;
  var MAX_LINK_DEBUG_WARNINGS: number;
  var MAX_LINK_DEBUG_LENGTH: number;
  var reportedLinkWarnings: Set<string>;
  var linkWarningLimitReached: boolean;
  var initializeLinkWarnings: () => void;
  var linkWhitespacePattern: RegExp;
  var initializeHrefWhitespace: () => void;
  var existingBrowsingContextNames: Set<string>;
  var unsafeLinkRelTokenPattern: RegExp;
  var initializeLinkTargets: () => void;
  var reactCdsLink: typeof React;
  var cdsRouterContext: React.Context<Overlays.LinkRouter | undefined>;
  var forbiddenHrefControlCharacterPattern: RegExp;
  var leadingHrefWhitespacePattern: RegExp;
  var networkPathHrefPattern: RegExp;
  var rootRelativeHrefPattern: RegExp;
  var unrootedHrefPattern: RegExp;
  var relativePathDotSegmentPattern: RegExp;
  var dotSegmentPattern: RegExp;
  var encodedOrBackslashPathPattern: RegExp;
  var allowedHrefSchemePattern: RegExp;
  var androidIntentHrefPattern: RegExp;
  var editorHrefSchemePattern: RegExp;
  var allowedEditorHrefPattern: RegExp;
  var allowedIntentPropertyNames: Set<string>;
  var absoluteHrefPattern: RegExp;
  var trustedAnthropicDomains: string[];
  var trustedAndroidIntentPackages: Set<string>;
  var HTTPS_RELATIVE_HREF_BASE: string;
  var HTTP_RELATIVE_HREF_BASE: string;
  var linkEventPropNames: Layers.LinkEventName[];
  var linkPrefetchEventKinds: Record<Layers.LinkIntentEventName, boolean>;
  var linkPrefetchEventNames: Layers.LinkIntentEventName[];
  var initializeCdsLink: () => void;
  var initializeElementWindow: () => void;
  var reactCdsRoot: typeof React;
  var jsxCdsRoot: typeof import("react/jsx-runtime");
  var subscribePlatformNoop: (listener: () => void) => () => void;
  var getWebPlatformSnapshot: () => "web";
  var getCoarsePointerServerSnapshot: () => boolean;
  var subscribeRootCoarsePointer: (listener: () => void) => () => void;
  var hasMigratedHtmlFontSizing: boolean;
  var densitySizeIndices: Record<Density, number>;
  var controlSizeOffsets: Partial<Record<ControlSize, number>>;
  var densityContext: React.Context<Density>;
  var portalDensityContext: React.Context<Density>;
  var colorModeStoreContext: React.Context<Layers.ColorModeStore | undefined>;
  var defaultColorModeStore: Layers.ColorModeStore;
  var DARK_COLOR_SCHEME_QUERY: string;
  var normalizeColorMode: (
    mode: string | null | undefined,
  ) => Layers.ConfiguredColorMode | undefined;
  var platformContext: React.Context<Layers.CdsPlatform | undefined>;
  var fontContext: React.Context<Layers.CdsFont | undefined>;
  var monospaceFontContext: React.Context<string | null | undefined>;
  var pageBackgroundContext: React.Context<string | undefined>;
  var naturalImageTilesContext: React.Context<boolean | undefined>;
  var densityOverrideContext: React.Context<Density | undefined>;
  var surfaceBackgroundContext: React.Context<string | undefined>;
  var localeContext: React.Context<string | undefined>;
  var rootElementContext: React.Context<HTMLElement | undefined>;
  var rootPortalContainerContext: React.Context<Layers.PortalContainer>;
  var isPortalRootContext: React.Context<boolean>;
  var opaqueTintOverrides: DesignStyle;
  var surfaceTokenNames: Set<string>;
  var initializeCdsRoot: () => void;
  function useCaptureOverlayOpener(
    open: boolean | undefined,
    openerRef: React.RefObject<HTMLElement | null>,
    rootRef: React.RefObject<HTMLElement | null>,
    onCaptured?: () => void,
    ownerAncestorsRef?: React.RefObject<FocusableElement[]>,
  ): void {
    let rootElement: HTMLElement | undefined = useRootElement(),
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
          activeElement && activeElement !== value.body
            ? (activeElement as HTMLElement)
            : null;
      openerRef.current = value2;
      if (ownerAncestorsRef) {
        ownerAncestorsRef.current = (0, runtime.getOverlayOwnerAncestors)(
          value2,
        );
      }
      onCaptured?.();
    }, [open, rootElement, openerRef, rootRef, onCaptured, ownerAncestorsRef]);
  }
  function useOverlayFocusReturn(
    options?: OverlayFocusOptions,
  ): OverlayFocusReturn {
    let skipRestoreOnOutsideFocus = options?.skipRestoreOnOutsideFocus ?? false,
      registerOpenerReturn = options?.registerOpenerReturn ?? true,
      triggerRef = options?.triggerRef,
      openerRef = reactOverlayFocus.useRef<HTMLElement | null>(null),
      popupRef = reactOverlayFocus.useRef<HTMLElement | null>(null),
      rootRef = reactOverlayFocus.useRef<HTMLElement | null>(null);
    useCaptureOverlayOpener(options?.open ?? true, openerRef, rootRef);
    let shouldRegisterRef = reactOverlayFocus.useRef(registerOpenerReturn);
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
  function resolveConnectedRefElement(
    input: React.RefObject<HTMLElement | null> | null | undefined,
  ): HTMLElement | null {
    let value = input?.current ?? null;
    if (value?.isConnected) {
      return value;
    } else {
      return null;
    }
  }
  function useOverlayFinalFocus(
    open: boolean | undefined,
    takeFocus: boolean = true,
    fallbackTriggerRef?: React.RefObject<HTMLElement | null> | null,
  ): OverlayFocusReturn {
    let rootElement: HTMLElement | undefined = useRootElement(),
      fallbackOpenerRef = reactOverlayFocus.useRef<HTMLElement | null>(null),
      needsFocusCheckRef = reactOverlayFocus.useRef(false),
      onCaptured = reactOverlayFocus.useCallback(() => {
        fallbackOpenerRef.current = null;
        needsFocusCheckRef.current = true;
      }, []),
      openerRef = reactOverlayFocus.useRef<HTMLElement | null>(null),
      ownerAncestorsRef = reactOverlayFocus.useRef<FocusableElement[]>([]),
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
      (0, runtime.blurWithSafeRelatedTarget)(value3 as FocusableElement);
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
            activeElement = (rootRef.current?.ownerDocument ?? document)
              .activeElement;
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
  function resolveFinalFocusTarget(
    opener: FocusableElement | null | undefined,
    popup: HTMLElement | null | undefined,
  ): FocusableElement | false {
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
    let focusTarget = opener;
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
  function createOverlayStack(): OverlayStack {
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
  function isDocumentCurrentTarget(input: OverlayEvent | undefined): boolean {
    return (
      (input?.currentTarget as Node | null | undefined)?.nodeType ===
      DOCUMENT_NODE_TYPE
    );
  }
  function interceptEscapeForInnerOverlay(
    stack: OverlayStack,
    open: boolean,
    details: OverlayCloseDetails,
  ): boolean {
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
      (
        (event?.currentTarget as Document | null | undefined)?.defaultView ??
        globalThis
      ).setTimeout(() => {
        if (topmostOverlay.isOpen()) {
          topmostOverlay.close();
        }
      }, 0);
    } else {
      event?.preventDefault();
      topmostOverlay.close();
    }
    return true;
  }
  function useMenuOverlayRegistration(): {
    elementRef: React.RefObject<HTMLElement | null>;
    overlayAttrs: {
      "data-cds-overlay": string;
    };
  } {
    let ref = reactMenuOverlayRegistration.useRef<HTMLElement | null>(null),
      value =
        reactMenuOverlayRegistration.useContext<React.RefObject<Dom.OverlayActions | null> | null>(
          runtime.menuRootIdentityContext,
        );
    useRegisterInnerOverlay({
      isOpen: () =>
        value !== null && ref.current?.hasAttribute("data-open") === true,
      close: () => value?.current?.close?.(),
    });
    return {
      elementRef: ref,
      overlayAttrs: menuOverlayAttributes,
    };
  }
  function calculateScrollbarThickness(
    offsetSize: number,
    clientSize: number,
    borderSize: number,
  ): number {
    return offsetSize - clientSize - (borderSize || 0);
  }
  function isScrollbarPointerPosition(
    offsetX: number,
    offsetY: number,
    targetElement: HTMLElement,
  ): boolean {
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
  function useClickToFocus(
    focus: (() => void) | undefined,
    options: ClickToFocusOptions = {},
  ): {
    clickToFocusProps: {
      onMouseDown: React.MouseEventHandler<HTMLElement>;
    };
  } {
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
          (event: React.MouseEvent<HTMLElement>) => {
            if (event.button !== 0 || readOnly || disabled) {
              return;
            }
            let { target: value, currentTarget: value2 } =
              event as React.MouseEvent<HTMLElement> & {
                target: HTMLElement;
              };
            if (!value2.contains(value)) {
              return;
            }
            if (value !== value2) {
              if (ignoreTargetCallback?.(value)) {
                return;
              }
              let ancestor = value.closest(INTERACTIVE_CLICK_TARGET_SELECTOR);
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
    event: React.MouseEvent<HTMLElement>,
    {
      draggable = false,
    }: {
      draggable?: boolean;
    } = {},
  ): boolean {
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
        targetElement as HTMLElement,
      )
    );
  }
  function closestWithinElement(
    targetElement: Element,
    selector: string,
    matchingAncestor: Element,
  ): boolean {
    let ancestor = targetElement.closest(selector);
    return ancestor !== null && matchingAncestor.contains(ancestor);
  }
  function usePassiveOpenState(
    onOpenChange: MenuChange | undefined,
    open: boolean | undefined,
    allowHover: boolean = true,
  ): PassiveOpenGateState {
    let [state] = reactPassiveOpen.useState(createPassiveOpenState);
    state.renderedWith(open, onOpenChange, allowHover);
    return state;
  }
  function createPassiveOpenState(): PassiveOpenGateState {
    let value: MenuChange | undefined,
      flag = true,
      text: PassiveOpenLevel = "off",
      value2: HTMLElement | null = null,
      value3: FocusableElement | null = null,
      flag2 = false,
      value4: PopupFocus | null | undefined = undefined,
      value5: InitialPopupFocus | undefined = undefined,
      flag3 = false,
      value6: HTMLElement | null = null,
      value7: HTMLElement | null = null,
      value8: Layers.PassiveOpenInput | null = null,
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
          values.forEach((input2: () => void) => {
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
        declareFocusProps(
          input: InitialPopupFocus | undefined,
          options: PopupFocus | null | undefined,
        ): void {
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
        options: MenuChange | undefined,
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
      onOpenChange(
        input: boolean,
        options: import("@base-ui/react/menu").Menu.Root.ChangeEventDetails,
      ): void {
        value?.(input, options);
        if (options.isCanceled === true) {
          return;
        }
        flag2 = false;
        let value10 = flag && options.reason === PASSIVE_HOVER_OPEN_REASON,
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
          value7 = (0, runtime.asElement)(
            options.trigger ?? null,
          ) as HTMLElement | null;
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
  function classifyOpenInputType(input?: Event): PopupInputKind {
    if (input === undefined) {
      return "";
    }
    if ("key" in input) {
      return "keyboard";
    }
    let { type: value } = input;
    if (value === "click" && (input as MouseEvent).detail === 0) {
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
    initialFocus: InitialPopupFocus | undefined,
    interactionType: PopupInputKind,
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
    finalFocus: PopupFocus | null | undefined,
    fallbackElement: FocusableElement | null,
  ): FocusableElement | null {
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
  function getFocusedElement(input: Document | undefined): HTMLElement | null {
    let value = (0, runtime.asElement)(
      input?.activeElement ?? null,
    ) as HTMLElement | null;
    if (value === null || value === input?.body) {
      return null;
    } else {
      return value;
    }
  }
  function elementIsWithin(input: Node | null, options: Node | null): boolean {
    return input !== null && options !== null && options.contains(input);
  }
  function restorePassiveOverlayFocus(
    documentObject: Document,
    popup: HTMLElement | null,
    opener: FocusableElement,
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
          (0, runtime.blurWithSafeRelatedTarget)(value2 as FocusableElement);
        }
        opener.focus({
          preventScroll: true,
        });
      }
    });
  }
  function usePassiveOpenContext(input: boolean): {
    cell: PassiveOpenCell | null;
    root: PassiveOpenCell | null;
  } {
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
  function useMenuPassiveFocusProps(): Pick<PassivePopupProps, "tabIndex"> {
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
  }: PassiveGateProps): React.ReactElement {
    let value = reactPassiveOpen.useSyncExternalStore(
        cell === null ? subscribePassiveOpenNoop : cell.subscribe,
        cell === null ? getPassiveOffSnapshot : cell.getLevel,
        getPassiveOffSnapshot,
      ),
      value2 =
        cell === null ? "off" : nested && value === "hover" ? "off" : value;
    return (
      <passiveFocusDeclinedContext.Provider value={value2 === "declared"}>
        {[
          value2 === "declared" && !nested && cell !== null ? (
            <PassiveOpenKeyboardBridge cell={cell} />
          ) : null,
          children(
            cell === null || value2 === "off"
              ? unchangedPopupProps
              : value2 === "hover"
                ? (input: PassivePopupProps) => ({
                    ...input,
                    tabIndex: undefined,
                    onFocus(
                      input2: Parameters<
                        NonNullable<PassivePopupProps["onFocus"]>
                      >[0],
                    ): void {
                      input.onFocus?.(input2);
                      cell.engage();
                    },
                  })
                : (input: PassivePopupProps) => ({
                    ...input,
                    tabIndex: undefined,
                    finalFocus: false,
                    onMouseDown(
                      event: Parameters<
                        NonNullable<PassivePopupProps["onMouseDown"]>
                      >[0],
                    ): void {
                      input.onMouseDown?.(event);
                      if (!shouldAllowPopupPointerFocus(event)) {
                        event.preventDefault();
                      }
                    },
                    onKeyDown(
                      event: Parameters<
                        NonNullable<PassivePopupProps["onKeyDown"]>
                      >[0],
                    ): void {
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
        ]}
      </passiveFocusDeclinedContext.Provider>
    );
  }
  function PassiveOpenKeyboardBridge({
    cell: cell,
  }: {
    cell: PassiveOpenCell;
  }): null {
    reactPassiveOpen.useEffect(() => {
      let value = cell.getTrigger();
      if (value === null) {
        return;
      }
      let callback = (event: KeyboardEvent): void => {
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
          value5 = (0, runtime.asElement)(value4 ?? null) as HTMLElement | null;
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
  function isCanceledOpenWithinTrigger(
    input: import("@base-ui/react/menu").Menu.Root.ChangeEventDetails,
  ): boolean {
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
    onOpenChange: MenuChange | undefined,
    refuseCanceledTriggerOpen: boolean = false,
  ): {
    triggerRef: React.RefObject<HTMLElement | null>;
    onOpenChange: MenuChange;
  } {
    let triggerRef = reactMenuOpener.useRef<HTMLElement | null>(null);
    return {
      triggerRef: triggerRef,
      onOpenChange: (0, runtime.useEventCallback)(
        (
          input: boolean,
          options: import("@base-ui/react/menu").Menu.Root.ChangeEventDetails,
        ) => {
          if (
            !input &&
            refuseCanceledTriggerOpen &&
            isCanceledOpenWithinTrigger(options)
          ) {
            options.cancel?.();
            return;
          }
          triggerRef.current =
            (options.trigger as HTMLElement | undefined) ?? null;
          onOpenChange?.(input, options);
        },
      ),
    };
  }
  function useMenuOpenerRef(): React.RefObject<HTMLElement | null> | undefined {
    return reactMenuOpener.useContext(menuOpenerRefContext);
  }
  function useMenuOwnerRef(
    input: React.RefObject<HTMLElement | null> | undefined,
    options: PopupFocus | null | undefined,
  ): React.RefCallback<HTMLElement> {
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
      (input2: HTMLElement | null) => {
        if (input2 !== null) {
          (0, runtime.registerOverlayOwner)(input2, callback);
        }
      },
      [callback],
    );
  }
  function readPopupPlacement(element: Element): PopupPlacement {
    return {
      side: (element.getAttribute("data-side") || undefined) as PopupPlacement["side"],
      align: (element.getAttribute("data-align") || undefined) as PopupPlacement["align"],
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
  }: PopupAnimationInput): Layers.StablePopupPlacement {
    let [value, value2] =
        reactStablePopupPlacement.useState<PopupPlacement | null>(null),
      [value3, value4] =
        reactStablePopupPlacement.useState<PopupPlacement | null>(null),
      [value5, value6] = reactStablePopupPlacement.useState<
        number | undefined
      >(),
      ref = reactStablePopupPlacement.useRef<HTMLElement | null>(null),
      ref2 = reactStablePopupPlacement.useRef(false),
      ref3 = reactStablePopupPlacement.useRef<(() => void) | null>(null),
      callback = reactStablePopupPlacement.useCallback(
        (element: HTMLElement | null): void => {
          ref3.current?.();
          ref3.current = null;
          if (!element) {
            value2(null);
            value4(null);
            ref2.current = false;
            return;
          }
          let value8 = element.ownerDocument.defaultView ?? window,
            value9 = typeof value8.requestAnimationFrame === "function",
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
              value2((input: PopupPlacement | null) =>
                arePopupPlacementsEqual(input, value10) ? input : value10,
              );
            },
            callback4 = () => {
              let value10 = readPopupPlacement(element);
              value4((input: PopupPlacement | null) =>
                arePopupPlacementsEqual(input, value10) ? input : value10,
              );
              ref2.current = placementNeedsBottomHold(value10);
              if (!ref2.current) {
                let value11 = ref.current?.getBoundingClientRect().height;
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
        (input: HTMLElement | null): void => {
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
              value6((input2: number | undefined) =>
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
      value7: Layers.PopupHeldPlacement | null =
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
  function matchesWindowMediaQuery(input: string, options?: Window): boolean {
    let value = resolvePlatformWindow(options);
    return (
      typeof value?.matchMedia === "function" && value.matchMedia(input).matches
    );
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
  function makeOutsidePortalInert(element: HTMLElement): () => void {
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
        for (let value2 of Array.from(element2.children)) {
          callback2(value2);
        }
      },
      value = element,
      body = element.ownerDocument.body;
    while (value !== null && value !== body && value.parentElement !== null) {
      let parentElement = value.parentElement,
        value2 = value;
      for (let value3 of Array.from(parentElement.children)) {
        if (value3 !== value2) {
          callback2(value3);
        }
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
  }: Layers.ModalPortalInertOptions): () => void {
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
        let value4 = releaseInertAfterPaint(value, current, () => {
          if (ref2.current === value4) {
            ref2.current = null;
          }
        });
        ref2.current = value4;
      };
    }, [node, open, value, value2]);
    return reactModalPortalInert.useCallback(() => ref2.current?.(), []);
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
  ): () => void {
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
  function findOverlayPortalContainer(
    element: HTMLElement,
  ): HTMLElement | null {
    let body = element.ownerDocument.body,
      value: HTMLElement | null = element,
      value2: HTMLElement | null = null;
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
  function preventModalTabNavigation(
    event: React.KeyboardEvent<HTMLElement>,
  ): void {
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
  function getSheetInertReleaseTiming(
    input?: Overlays.OverlayEventDetails | null,
  ): "now" | "after-paint" {
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
  function MenuSheetTitleBar({
    nested: nested,
  }: {
    nested: boolean;
  }): React.ReactElement {
    let value = reactMenuSheetPopup.useContext<Overlays.MenuRootState | null>(
        runtime.menuTriggerContext,
      ),
      { label: value2 } =
        reactMenuSheetPopup.useContext<Overlays.MenuItemState>(
          runtime.submenuStateContext,
        ),
      value3 = reactMenuSheetPopup.useContext<Overlays.MenuLabels>(
        runtime.menuSheetLabelsContext,
      ),
      value4 = (0, runtime.useTranslation)("back", "Back"),
      value5 = value3.backLabel ?? value4;
    return (
      <runtime.SheetTitleBar
        title={nested ? value2 : value3.sheetTitle}
        leading={
          nested ? (
            <runtime.baseMenu.Item
              closeOnClick={false}
              onClick={() => value?.close()}
              aria-label={value5}
              label={value5}
              className={(0, runtime.cn)(
                menuItemVariants({
                  variant: "default",
                }),
                "min-h-control w-auto py-0",
              )}
            >
              <runtime.IconSlot
                icon={
                  <runtime.Icon
                    name={"ArrowLeft"}
                    size={"md"}
                    className={"rtl:-scale-x-100"}
                  />
                }
              />
            </runtime.baseMenu.Item>
          ) : undefined
        }
      />
    );
  }
  function MenuSheetCloseButton(): React.ReactElement {
    let value =
        reactMenuSheetPopup.useContext<Overlays.SheetFrameContext | null>(
          runtime.sheetFrameContext,
        ),
      value2 = (0, runtime.useTranslation)("close", "Close"),
      value3 =
        reactMenuSheetPopup.useContext(
          runtime.menuSheetLabelsContext as React.Context<{
            closeLabel?: string;
          }>,
        ).closeLabel ?? value2;
    return (
      <runtime.baseMenu.Item
        closeOnClick={false}
        onClick={() => value?.dismiss()}
        aria-label={value3}
        label={value3}
        data-cds-sheet-control={""}
        className={
          "group/sheet-close cds-reset block w-full rounded outline-none select-none focus-visible:outline-hidden [&:not(:focus-visible):not([data-highlighted]):not([data-cds-sheet-control-held])]:sr-only"
        }
      >
        <span
          className={(0, runtime.cn)(
            menuItemVariants({
              variant: "default",
            }),
            "group-data-[highlighted]/sheet-close:bg-fill-ghost-hover",
          )}
        >
          {[
            <runtime.IconSlot icon={"X"} />,
            <span className={"min-w-0 flex-1 truncate"}>{value3}</span>,
          ]}
        </span>
      </runtime.baseMenu.Item>
    );
  }
  function PopoverSheetBackdrop({
    sheetPopup: sheetPopup,
  }: {
    sheetPopup: Overlays.SheetRenderState;
  }): React.ReactElement {
    return (
      <runtime.basePopover.Backdrop
        data-presentation={"sheet"}
        data-sheet-scrim={sheetPopup.frame?.treeId}
        className={
          sheetPopup.state.depth > 0
            ? runtime.transparentSheetBackdropClasses
            : runtime.sheetBackdropClasses
        }
      />
    );
  }
  function PopoverSheetBody({
    sheetPopup: sheetPopup,
    className: className,
    bodyRef: bodyRef,
    bodyClassName: bodyClassName,
    closeLabel: closeLabel,
    children: children,
  }: Layers.PopoverSheetBodyProps): React.ReactElement {
    let { chrome: value } = sheetPopup;
    return (
      <runtime.sheetParentContext.Provider value={sheetPopup.stack}>
        {[
          <value.Handle />,
          <value.Body
            className={(0, runtime.cn)(
              className,
              "h-auto max-h-none min-h-0 w-full min-w-0 max-w-none flex-auto",
            )}
          >
            {[
              <div
                ref={bodyRef}
                tabIndex={-1}
                data-cds-popover-body={""}
                {...{
                  [runtime.SHEET_SCROLL_ATTRIBUTE]: "",
                }}
                className={bodyClassName}
              >
                {children}
              </div>,
              <value.DismissButton
                as={runtime.basePopover.Close}
                label={closeLabel}
              />,
            ]}
          </value.Body>,
        ]}
      </runtime.sheetParentContext.Provider>
    );
  }
  function ContextMenuSheetBackdrop({
    sheetPopup: sheetPopup,
  }: {
    sheetPopup: Overlays.SheetRenderState;
  }): React.ReactElement {
    return (
      <runtime.baseCombobox.Backdrop
        data-presentation={"sheet"}
        data-sheet-scrim={sheetPopup.frame?.treeId}
        className={
          sheetPopup.state.depth > 0
            ? runtime.transparentSheetBackdropClasses
            : runtime.sheetBackdropClasses
        }
      />
    );
  }
  function subscribeSheetImplementation(input: () => void): () => void {
    sheetImplementationSubscribers.add(input);
    return () => {
      sheetImplementationSubscribers.delete(input);
    };
  }
  function loadSheetImplementation(): Promise<Overlays.MobileSheetParts | null> {
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
        (input: Overlays.MobileSheetParts | null) =>
          typeof input === "object" &&
          input !== null &&
          "SheetPopupHost" in input
            ? input
            : null,
        () => null,
      )
      .then((input: Overlays.MobileSheetParts | null) => {
        if (value !== sheetImplementationGeneration) {
          return input;
        }
        if (input === null) {
          sheetImplementationFailed = true;
        } else {
          loadedSheetImplementation = input;
        }
        for (let value2 of sheetImplementationSubscribers) {
          value2();
        }
        return input;
      });
    return sheetImplementationPromise!;
  }
  function preloadSheetImplementation(): void {
    if (loadedSheetImplementation !== null || sheetImplementationFailed) {
      return;
    }
    sheetImplementationRequests += 1;
    loadSheetImplementation();
  }
  function isSheetImplementationLoaded(): boolean {
    return loadedSheetImplementation !== null;
  }
  function useSheetImplementationLoaded(): boolean {
    return reactSheetImplementation.useSyncExternalStore(
      subscribeSheetImplementation,
      getSheetImplementationLoadedSnapshot,
      getFalseSheetImplementationSnapshot,
    );
  }
  function useSheetImplementationFailed(): boolean {
    return reactSheetImplementation.useSyncExternalStore(
      subscribeSheetImplementation,
      getSheetImplementationFailedSnapshot,
      getFalseSheetImplementationSnapshot,
    );
  }
  function useLoadedSheetImplementation(): Overlays.MobileSheetParts | null {
    return reactSheetImplementation.useSyncExternalStore(
      subscribeSheetImplementation,
      getSheetImplementationSnapshot,
      getNullSheetImplementationSnapshot,
    );
  }
  function usePreloadSheetsForCoarsePointer(
    input: boolean,
    options: Window | undefined,
  ): void {
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
  function detectCdsPlatform(): Layers.CdsPlatform {
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
  ): void {
    return;
  }
  function truncateLinkDebugValue(items: string): string {
    if (items.length <= MAX_LINK_DEBUG_LENGTH) {
      return items;
    }
    let value = items.charCodeAt(119),
      value2 = value >= 55296 && value <= 56319 ? 119 : MAX_LINK_DEBUG_LENGTH;
    return `${items.slice(0, value2)}…`;
  }
  function normalizeHrefWhitespace(input: string): string {
    let value = input.replace(linkWhitespacePattern, ""),
      index = 0,
      length = value.length;
    while (index < length && value.charCodeAt(index) <= 32) {
      index++;
    }
    while (length > index && value.charCodeAt(length - 1) <= 32) {
      length--;
    }
    if (index === 0 && length === value.length) {
      return value;
    } else {
      return value.slice(index, length);
    }
  }
  function isSanitizedHrefFallback(
    input: string | undefined,
    options: string | undefined,
  ): boolean {
    return (
      options === "#" &&
      input !== undefined &&
      normalizeHrefWhitespace(input) !== "#"
    );
  }
  function opensInSeparateBrowsingContext(
    input: string | null | undefined,
  ): boolean {
    return !!input && !existingBrowsingContextNames.has(input.toLowerCase());
  }
  function normalizeLinkRel(
    input: string | null | undefined,
    options: string | null | undefined,
    context: () => string,
  ): string | undefined {
    if (!opensInSeparateBrowsingContext(input)) {
      return options ?? undefined;
    }
    if (options === undefined || options === null) {
      return context();
    }
    let value = options
      .split(/\s+/)
      .filter(
        (input2: string) => input2 !== "" && input2.toLowerCase() !== "opener",
      );
    if (
      !value.some((input2: string) => unsafeLinkRelTokenPattern.test(input2))
    ) {
      value.push("noopener");
    }
    return value.join(" ");
  }
  function useCdsRouter(): Overlays.LinkRouter | undefined {
    return reactCdsLink.useContext(cdsRouterContext);
  }
  function sanitizeHref(input: string | undefined): string | undefined {
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
  function rejectUnsafeHref(input: string, options: string): string {
    reportLinkSanitizationDebug(input, "#", options);
    return "#";
  }
  function validateRelativeHref(input: string): string {
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
          .map((input2: string) =>
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
  function hasUnsafeRelativePath(input: string): boolean {
    if (!rootRelativeHrefPattern.test(input)) {
      return false;
    }
    let value = getHrefPathBeforeQuery(input);
    return value.includes("\\") || relativePathDotSegmentPattern.test(value);
  }
  function getHrefPathBeforeQuery(input: string): string {
    let value = input.search(/[?#]/);
    if (value < 0) {
      return input;
    } else {
      return input.slice(0, value);
    }
  }
  function isAllowedEditorHref(input: string): boolean {
    return allowedEditorHrefPattern.test(
      input.replace(editorHrefSchemePattern, (input2: string) =>
        input2.toLowerCase(),
      ),
    );
  }
  function isAllowedAndroidIntentHref(input: string): boolean {
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
  function classifyHrefOrigin(input: string, options: string): HrefOrigin {
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
      trustedAnthropicDomains.some(
        (input2: string) =>
          hostname === input2 || hostname.endsWith("." + input2),
      )
    ) {
      return "first-party";
    } else {
      return "other";
    }
  }
  function isOriginStableHref(input: string | undefined): boolean {
    if (!input) {
      return false;
    }
    let value = classifyHrefOrigin(input, HTTPS_RELATIVE_HREF_BASE);
    return (
      value !== "other" &&
      value === classifyHrefOrigin(input, HTTP_RELATIVE_HREF_BASE)
    );
  }
  function getSeparateContextRel(input: string | undefined): string {
    if (isOriginStableHref(input)) {
      return "noopener";
    } else {
      return "noopener noreferrer";
    }
  }
  function getAutomaticLinkRel(
    input: string | undefined,
    options: string | null | undefined,
  ): string | undefined {
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
  function isSameOriginHref(input: string): boolean {
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
  function shouldHandleLinkWithRouter(event: Layers.LinkCandidate): boolean {
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
  function normalizeRouterHref(input: string): string {
    if (!absoluteHrefPattern.test(input)) {
      return input;
    }
    let value = new URL(input, window.location.href);
    return value.pathname.replace(/^\/{2,}/, "/") + value.search + value.hash;
  }
  function isModifiedLinkClick(input: Layers.LinkClickEvent): boolean {
    return (
      input.defaultPrevented ||
      input.button !== 0 ||
      input.metaKey ||
      input.ctrlKey ||
      input.shiftKey ||
      input.altKey
    );
  }
  function pickLinkEventProps(
    input: Overlays.RouterEvents,
  ): Overlays.RouterEvents {
    let value = input,
      state: Layers.LinkEvents = {};
    for (let value2 of linkEventPropNames) {
      if (value[value2] !== undefined) {
        state[value2] = value[value2];
      }
    }
    return state;
  }
  function omitLinkEventProps<Props extends Overlays.RouterEvents>(
    input: Props,
  ): Omit<Props, Layers.LinkEventName> {
    let state = {
      ...input,
    };
    for (let value of linkEventPropNames) {
      delete state[value];
    }
    return state;
  }
  function composeLinkEventHandlers<
    Event extends React.SyntheticEvent<HTMLElement>,
  >(
    input: React.EventHandler<Event> | undefined,
    options: React.EventHandler<Event> | undefined,
    context?: boolean,
  ): ((event: Event) => void) | undefined {
    if (!options) {
      return input;
    }
    return (input2: Event) => {
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
  }: Overlays.LinkInput): Overlays.LinkAttributes {
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
          return normalizeRouterHref(state.href!);
        } else {
          return undefined;
        }
      }, [safeHref, safeTarget, safeDownload, hasRouter]),
      handleClick = reactCdsLink.useCallback(
        (event: React.MouseEvent<HTMLElement>) => {
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
          state2: Layers.LinkEvents = {};
        for (let value of linkPrefetchEventNames) {
          let value2 = composeLinkEventHandlers<
            React.SyntheticEvent<HTMLElement>
          >(
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
      rel: normalizeLinkRel(safeTarget, rel, () =>
        getSeparateContextRel(resolvedHref),
      ),
      download: safeDownload,
      onClick: handleClick,
      ...combinedIntentHandlers,
    };
  }
  function getElementWindow(
    input: Element | null | undefined,
  ): Window | undefined {
    return input?.ownerDocument.defaultView ?? globalThis.window;
  }
  function elementHasUnavailableWindow(element: Element | undefined): boolean {
    return (
      element !== undefined &&
      (!element.isConnected || element.ownerDocument.defaultView === null)
    );
  }
  function getConnectedElementWindow(
    input: Element | undefined,
  ): Window | undefined {
    if (elementHasUnavailableWindow(input)) {
      return;
    }
    return getElementWindow(input);
  }
  function hasCdsHtmlFontSizing(element: HTMLElement): boolean {
    return (
      element === element.ownerDocument.documentElement &&
      element.style.fontSize.includes("--cds-font-size-body")
    );
  }
  function migrateCdsHtmlFontSizing(): void {
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
          let value3: CSSRuleList;
          try {
            value3 = input.cssRules;
          } catch {
            return;
          }
          for (let value4 of value3) {
            let name = value4.constructor.name;
            if (name === "CSSLayerStatementRule") {
              for (let value5 of (value4 as CSSLayerStatementRule).nameList) {
                callback(value5);
              }
            } else if (name === "CSSLayerBlockRule") {
              callback((value4 as CSSLayerBlockRule).name);
            } else if (name === "CSSImportRule") {
              let value5 = value4 as CSSImportRule;
              callback(value5.layerName);
              if (value5.styleSheet) {
                callback2(value5.styleSheet);
              }
            }
          }
        };
      for (let value3 of document.styleSheets) {
        callback2(value3);
      }
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
  function getControlSizeAttributes(input?: ControlSize): {
    "data-size"?: Exclude<ControlSize, "base">;
  } {
    if (input && input !== "base") {
      return {
        "data-size": input,
      };
    } else {
      return {};
    }
  }
  function getDensitySizeIndex(input: Density, options?: ControlSize): number {
    let value =
      densitySizeIndices[input] + controlSizeOffsets[options ?? "base"]!;
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
  function createColorModeStore(
    configuredMode: Layers.ConfiguredColorMode | undefined,
  ): Layers.ColorModeStore {
    let element: HTMLElement | null = null,
      inheritedModeAttribute =
        configuredMode === undefined && typeof document !== "undefined"
          ? document.documentElement.getAttribute("data-mode")
          : null,
      getSetting = () =>
        configuredMode ?? normalizeColorMode(inheritedModeAttribute),
      modeFromDarkPreference = (input: boolean): ColorMode =>
        input ? "dark" : "light",
      colorSchemeMedia: MediaQueryList | undefined,
      systemColorMode: ColorMode | undefined,
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
              : document.documentElement.getAttribute("data-mode"));
        }
      },
      explicitColorMode = (
        input: Layers.ConfiguredColorMode | undefined,
      ): ColorMode | undefined =>
        input === "light" || input === "dark" ? input : undefined,
      listeners = new Set<() => void>(),
      notify = () => listeners.forEach((input: () => void) => input()),
      changedBeforeSubscription = false,
      startObserving = () => {
        let items: (() => void)[] = [];
        initialize();
        let value = colorSchemeMedia;
        if (value) {
          let callback = () => {
            systemColorMode = modeFromDarkPreference(value.matches);
            notify();
          };
          value.addEventListener("change", callback);
          items.push(() => value.removeEventListener("change", callback));
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
        return () => items.forEach((input: () => void) => input());
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
  function usePageBackground(): string | undefined {
    return reactCdsRoot.useContext(pageBackgroundContext);
  }
  function useDensity(): Density {
    return reactCdsRoot.useContext(densityContext);
  }
  function useResolvedColorMode(): ColorMode {
    return useColorMode() ?? "light";
  }
  function useColorMode(): ColorMode | undefined {
    let value =
      reactCdsRoot.useContext(colorModeStoreContext) ?? defaultColorModeStore;
    return reactCdsRoot.useSyncExternalStore(
      value.subscribe,
      value.getSnapshot,
      value.getServerSnapshot,
    );
  }
  function usePlatform(): Layers.CdsPlatform | undefined {
    return reactCdsRoot.useContext(platformContext) ?? "web";
  }
  function useFont(): Layers.CdsFont | undefined {
    return reactCdsRoot.useContext(fontContext);
  }
  function useMonospaceFont(): string | null | undefined {
    return reactCdsRoot.useContext(monospaceFontContext);
  }
  function getMonospaceOverrideStyle(input?: string | null): DesignStyle {
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
  function useSurfaceBackground(): string | undefined {
    return reactCdsRoot.useContext(surfaceBackgroundContext);
  }
  function getSurfaceBackgroundStyle(input?: string): DesignStyle {
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
  function isTintedFillSurface(input: string): boolean {
    return isSurfaceToken(input) && input.startsWith("fill-");
  }
  function sanitizeCssBackground(input: string): string {
    return input.replaceAll(/[\u0000-\u001f\u007f;{}*]/g, "");
  }
  function isSurfaceToken(input: string): boolean {
    return surfaceTokenNames.has(input);
  }
  function useCdsLocale(): string | undefined {
    return reactCdsRoot.useContext(localeContext);
  }
  function useRootElement(): HTMLElement | undefined {
    return reactCdsRoot.useContext(rootElementContext);
  }
  function usePortalContainer(): Layers.PortalContainer {
    let value = reactCdsRoot.useContext(rootElementContext),
      value2 = reactCdsRoot.useContext(rootPortalContainerContext),
      value3 = reactCdsRoot.useContext(isPortalRootContext);
    return value ?? (value3 ? undefined : value2);
  }
  function useRootWindow(): Window | undefined {
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
  }: Layers.CdsRootProps): React.ReactElement {
    let parentDensity = reactCdsRoot.useContext(densityContext),
      parentPlatform = reactCdsRoot.useContext(platformContext),
      parentFont = reactCdsRoot.useContext(fontContext),
      parentPageBackground = reactCdsRoot.useContext(pageBackgroundContext),
      parentRouter = useCdsRouter(),
      parentLabels = reactCdsRoot.useContext(runtime.translationContext),
      parentDensityOverride = reactCdsRoot.useContext(densityOverrideContext),
      densityOverride = experimental?.densityOverride ?? parentDensityOverride,
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
                context?: Overlays.LabelValues,
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
      resolvedSurfaceBackground = pageBackground ?? parentSurfaceBackground,
      parentLocale = reactCdsRoot.useContext(localeContext),
      normalizedLocale = locale?.trim() ? locale.trim() : undefined,
      resolvedLocale = normalizedLocale ?? parentLocale,
      detectedPlatform = reactCdsRoot.useSyncExternalStore(
        subscribePlatformNoop,
        detectCdsPlatform,
        getWebPlatformSnapshot,
      ),
      resolvedPlatform = platform ?? parentPlatform ?? detectedPlatform,
      elementRef = reactCdsRoot.useRef<HTMLElement | null>(null),
      parentColorModeStore = reactCdsRoot.useContext(colorModeStoreContext),
      ownsColorModeStore =
        mode !== undefined || parentColorModeStore === undefined,
      [colorModeState, setColorModeState] = reactCdsRoot.useState(() =>
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
      colorModeStore: Layers.ColorModeStore;
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
    let renderElement = render;
    if (
      typeof renderElement === "object" &&
      renderElement !== null &&
      (
        renderElement as {
          $$typeof?: symbol;
        }
      ).$$typeof === Symbol.for("react.lazy")
    ) {
      renderElement = reactCdsRoot.Children.toArray(
        renderElement,
      )[0] as React.ReactElement<Layers.RootRenderProps>;
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
    return (
      <densityContext.Provider value={resolvedDensity}>
        <colorModeStoreContext.Provider value={colorModeStore}>
          <platformContext.Provider value={resolvedPlatform}>
            <fontContext.Provider value={resolvedFont}>
              <monospaceFontContext.Provider value={resolvedFontMono}>
                <pageBackgroundContext.Provider value={resolvedPageBackground}>
                  <surfaceBackgroundContext.Provider
                    value={resolvedSurfaceBackground}
                  >
                    <localeContext.Provider value={resolvedLocale}>
                      <cdsRouterContext.Provider value={resolvedRouter}>
                        <runtime.translationContext.Provider
                          value={resolvedLabels}
                        >
                          <naturalImageTilesContext.Provider
                            value={naturalImageTiles}
                          >
                            <densityOverrideContext.Provider
                              value={densityOverride}
                            >
                              <runtime.themeStoreContext.Provider
                                value={themeStore}
                              >
                                <runtime.featureFlagContext.Provider
                                  value={featureFlagNames}
                                >
                                  {rootElement}
                                </runtime.featureFlagContext.Provider>
                              </runtime.themeStoreContext.Provider>
                            </densityOverrideContext.Provider>
                          </naturalImageTilesContext.Provider>
                        </runtime.translationContext.Provider>
                      </cdsRouterContext.Provider>
                    </localeContext.Provider>
                  </surfaceBackgroundContext.Provider>
                </pageBackgroundContext.Provider>
              </monospaceFontContext.Provider>
            </fontContext.Provider>
          </platformContext.Provider>
        </colorModeStoreContext.Provider>
      </densityContext.Provider>
    );
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
    "usesImmediateModalRelease",
    () => usesImmediateModalRelease,
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
    "initializePopoverSheetContent",
    () => initializePopoverSheetContent,
    (value) => {
      initializePopoverSheetContent = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ContextMenuSheetBackdrop",
    () => ContextMenuSheetBackdrop,
  );
  bindRuntimeValue(
    runtime,
    "jsxComboboxSheetBackdrop",
    () => jsxComboboxSheetBackdrop,
    (value) => {
      jsxComboboxSheetBackdrop = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComboboxSheetBackdrop",
    () => initializeComboboxSheetBackdrop,
    (value) => {
      initializeComboboxSheetBackdrop = value;
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
    "trustedAnthropicDomains",
    () => trustedAnthropicDomains,
    (value) => {
      trustedAnthropicDomains = value;
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
  bindRuntimeValue(
    runtime,
    "initializeElementWindow",
    () => initializeElementWindow,
    (value) => {
      initializeElementWindow = value;
    },
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
  bindRuntimeValue(runtime, "useCdsLocale", () => useCdsLocale);
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
      overlayStackContext =
        reactOverlayStack.createContext<OverlayStack | null>(null);
    });
    initializeMenuOverlayRegistration = (0, runtime.initializeOnce)(() => {
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
    });
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
      ContextMenuPopupFrame = reactContextMenuPopup.forwardRef(
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
          }: MenuPopupProps,
          options: React.ForwardedRef<HTMLDivElement>,
        ): React.ReactElement => {
          let { finalFocus: value, popupRef: value2 } = useOverlayFocusReturn({
            registerOpenerReturn:
              finalFocus === undefined || finalFocus === null,
          });
          (0, runtime.useKeyboardContextMenuInitialFocus)(value2);
          let value3 = (0, runtime.useDefaultOverlayLayer)("contextmenu"),
            { elementRef: value4, overlayAttrs: value5 } =
              useMenuOverlayRegistration(),
            value6 = (0, runtime.useMergedRefs)(options, value2, value4);
          return (
            <runtime.ResetSheetContexts>
              <runtime.PortalRoot
                {...value3.portalProps}
                surface={runtime.elevationSurfaceNames.popover}
                companionModalCatcher={true}
                closeOnActivityHide={true}
              >
                <runtime.CollisionPaddingProvider
                  override={collisionPadding}
                  provideInherit={true}
                >
                  {(input: CollisionPadding) => (
                    <runtime.layerBaseContext.Provider value={value3.base}>
                      <runtime.baseContextMenu.Positioner
                        style={value3.style}
                        anchor={anchor}
                        side={side}
                        align={align}
                        sideOffset={sideOffset}
                        collisionPadding={input}
                      >
                        <runtime.baseContextMenu.Popup
                          data-cds={dataCds}
                          {...value5}
                          ref={value6}
                          finalFocus={(finalFocus ?? value) as import("../contracts/overlays").BaseUIPopupFocus}
                          {...props}
                          className={(0, runtime.cn)(
                            contextMenuPopupClasses,
                            className,
                          )}
                        >
                          <runtime.MenuScrollContent>
                            {children}
                          </runtime.MenuScrollContent>
                        </runtime.baseContextMenu.Popup>
                      </runtime.baseContextMenu.Positioner>
                    </runtime.layerBaseContext.Provider>
                  )}
                </runtime.CollisionPaddingProvider>
              </runtime.PortalRoot>
            </runtime.ResetSheetContexts>
          );
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
      passiveOpenStateContext =
        reactPassiveOpen.createContext<PassiveOpenCell | null>(null);
      passiveFocusDeclinedContext =
        reactPassiveOpen.createContext<boolean>(false);
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
      (PassiveOpenGate as React.FC<PassiveGateProps>).displayName =
        "PassiveOpenGate";
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
      menuOpenerRefContext = reactMenuOpener.createContext<
        React.RefObject<HTMLElement | null> | undefined
      >(undefined);
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
      MenuPopupElement = reactMenuPopupElement.forwardRef(
        (
          {
            anchoredWithoutFinalFocus: anchoredWithoutFinalFocus,
            cursorAnchored = false,
            finalFocus: finalFocus,
            ...props
          }: MenuPopupElementProps,
          options: React.ForwardedRef<HTMLDivElement>,
        ): React.ReactElement => {
          let value =
              reactMenuPopupElement.useContext(
                runtime.sheetFrameContext as React.Context<
                  | (SheetFrame & {
                      open: boolean;
                    })
                  | null
                >,
              )?.open ?? true,
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
          return (
            <runtime.baseMenu.Popup
              {...value3}
              ref={value5}
              finalFocus={
                ((finalFocus === undefined ||
                  (cursorAnchored && finalFocus === null)) &&
                anchoredWithoutFinalFocus
                  ? value4.finalFocus
                  : finalFocus) as import("../contracts/overlays").BaseUIPopupFocus
              }
              {...props}
            />
          );
        },
      );
      MenuPopupElement.displayName = "MenuPopupElement";
    });
    heldPositionerClasses = "pointer-events-none";
    heldPopupClasses = "pointer-events-auto";
    POPUP_PLACEMENT_SETTLE_FRAMES = 2;
    initializeStablePopupPlacement = (0, runtime.initializeOnce)(() => {
      reactStablePopupPlacement = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
    });
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
      MenuSheetPopup = reactMenuSheetPopup.forwardRef(
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
          }: MenuPopupProps,
          options: React.ForwardedRef<HTMLDivElement>,
        ) => {
          let value = usePortalContainer(),
            value2 =
              reactMenuSheetPopup.useContext<Overlays.MenuRootState | null>(
                runtime.menuTriggerContext,
              ),
            value3 =
              reactMenuSheetPopup.useContext<boolean>(
                runtime.contextMenuContext,
              ) && value2 === null,
            value4 = (0, runtime.useIsSheet)(),
            value5 = value4 && value2 !== null,
            value6 = reactMenuSheetPopup.useContext<{
              collisionPadding?: CollisionPadding;
            } | null>(runtime.collisionPaddingContext),
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
            value10 =
              reactMenuSheetPopup.useContext<Overlays.SheetFrameContext | null>(
                runtime.sheetFrameContext,
              ),
            value11 = reactMenuSheetPopup.useContext<Overlays.MenuItemState>(
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
            callback3 = reactMenuSheetPopup.useCallback((input: boolean) => {
              ref3.current = input;
              value13(input);
            }, []),
            [value14, value15] =
              reactMenuSheetPopup.useState<HTMLElement | null>(null),
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
            value18: Dom.SheetState = (0, runtime.useSheetState)(),
            value19 =
              reactMenuSheetPopup.useContext<Dom.SheetParentState | null>(
                runtime.sheetParentContext,
              ),
            value20 = reactMenuSheetPopup.useContext<
              ((token: object) => () => void) | null
            >(runtime.sheetCoverContext),
            [value21, value22] =
              reactMenuSheetPopup.useState<HTMLElement | null>(null),
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
                  let value43 = (0, runtime.hasEditableSheetContent)(element);
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
              callback2(current!);
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
              value43: Dom.SheetLevelHandle | undefined,
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
                  value49 = (0, runtime.hasEditableSheetContent)(value21),
                  value50 = (0, runtime.measureNaturalSheetHeight)(value21);
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
              value44 = (0, runtime.createSheetUncoverGate)(value21, () => {
                if (value45 === undefined) {
                  value45 = defaultView?.requestAnimationFrame(callback7);
                }
              }),
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
                  value46 = (0, runtime.measureNaturalSheetHeight)(value21);
                flag = value46 > value45;
                let value47 = (0, runtime.getSheetMinimumHeight)(
                  defaultView.innerHeight,
                  ref3.current,
                );
                value30(Math.max(Math.min(value46, value45), value47), flag);
              },
              value43 = (0, runtime.createSheetUncoverGate)(value21, () => {
                if (index === 0) {
                  index = defaultView.requestAnimationFrame(callback6);
                }
              }),
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
          let value34 = useMenuOwnerRef(value2?.triggerRef, props.finalFocus),
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
              onKeyDown: (
                input: Parameters<NonNullable<MenuPopupProps["onKeyDown"]>>[0],
              ) => {
                props.onKeyDown?.(input);
                preventModalTabNavigation(input);
              },
            },
            value37 = (0, runtime.useStableMergedRef)(
              (input: HTMLElement | null) => {
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
                  ? (
                      input: import("@base-ui/react/menu").Menu.Popup.State,
                    ) => ({
                      ...(
                        style as (
                          state: import("@base-ui/react/menu").Menu.Popup.State,
                        ) => React.CSSProperties
                      )(input),
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
          return (
            <runtime.baseMenu.Portal container={(container ?? value) as import("../contracts/overlays").BaseUIPortalContainer}>
              <runtime.PortalRoot
                {...value40.portalProps}
                surface={runtime.elevationSurfaceNames.popover}
                density={value4 ? runtime.SHEET_DENSITY : undefined}
                companionModalCatcher={!value4}
                closeOnActivityHide={true}
              >
                {[
                  value4 && !value5 && (
                    <runtime.baseMenu.Backdrop
                      data-presentation={"sheet"}
                      data-sheet-scrim={value10?.treeId}
                      className={
                        value18.depth > 0
                          ? "draggable-none fixed inset-0 bg-transparent"
                          : runtime.sheetBackdropClasses
                      }
                    />
                  ),
                  <runtime.CollisionPaddingProvider
                    override={value7}
                    container={container ?? value}
                    provideInherit={true}
                  >
                    {(input: CollisionPadding | undefined) => (
                      <runtime.layerBaseContext.Provider value={value40.base}>
                        <runtime.baseMenu.Positioner
                          ref={value9.positionerRef}
                          data-sheet-tree={value4 ? value10?.treeId : undefined}
                          style={
                            value4
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
                                : value40.style
                          }
                          side={value9.side}
                          align={value9.align}
                          sideOffset={value8}
                          collisionPadding={input}
                          collisionAvoidance={collisionAvoidance}
                          anchor={memo}
                          {...(value4 ? (runtime.sheetPositioningOverrides as Partial<typeof runtime.sheetPositioningOverrides>) : {})}
                          className={
                            value4
                              ? value5
                                ? runtime.sheetClipClasses
                                : value18.depth === 0
                                  ? runtime.sheetOverflowBackgroundClasses
                                  : undefined
                              : value9.held?.positionerClassName
                          }
                        >
                          <PassiveOpenGate
                            cell={value4 ? null : value36.cell}
                            nested={value2 !== null}
                          >
                            {(input2: PassivePopupTransform) => (
                              <MenuPopupElement
                                anchoredWithoutFinalFocus={value35}
                                cursorAnchored={value3}
                                data-cds={dataCds}
                                data-presentation={value4 ? "sheet" : undefined}
                                data-sheet-tree={
                                  value4 ? value10?.treeId : undefined
                                }
                                data-cds-sheet-depth={
                                  value4 ? String(value18.depth) : undefined
                                }
                                {...(value23
                                  ? {
                                      [runtime.SHEET_COVERED_ATTRIBUTE]: "",
                                    }
                                  : {})}
                                {...(value24 ? (runtime.inertElementProps as React.HTMLAttributes<HTMLDivElement>) : {})}
                                {...(value5 && value10 !== null && !value10.open
                                  ? {
                                      [runtime.SHEET_TREE_CLOSING_ATTRIBUTE]:
                                        "",
                                    }
                                  : {})}
                                {...(value5 && value26 && !value11.open
                                  ? {
                                      [runtime.SHEET_PEELING_ATTRIBUTE]: "",
                                    }
                                  : {})}
                                {...(value4
                                  ? getControlSizeAttributes("lg")
                                  : {})}
                                ref={value37}
                                {...input2(value4 ? state : props)}
                                style={value39}
                                className={(0, runtime.cn)(
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
                                )}
                              >
                                {value4 ? (
                                  <runtime.sheetParentContext.Provider
                                    value={memo2}
                                  >
                                    {[
                                      <runtime.SheetHandle
                                        drawPill={!value5}
                                      />,
                                      <div
                                        className={
                                          runtime.sheetDrillBodyClasses
                                        }
                                      >
                                        {[
                                          <runtime.MenuScrollContent
                                            header={header}
                                            headerClassName={
                                              runtime.sheetSeparatorClasses
                                            }
                                            footer={footer}
                                            fill={true}
                                          >
                                            {[
                                              children,
                                              !value5 && (
                                                <MenuSheetCloseButton />
                                              ),
                                            ]}
                                          </runtime.MenuScrollContent>,
                                          <MenuSheetTitleBar nested={value5} />,
                                        ]}
                                      </div>,
                                    ]}
                                  </runtime.sheetParentContext.Provider>
                                ) : (
                                  <runtime.MenuScrollContent
                                    header={header}
                                    footer={footer}
                                    maxVisibleItems={maxVisibleItems}
                                  >
                                    {children}
                                  </runtime.MenuScrollContent>
                                )}
                              </MenuPopupElement>
                            )}
                          </PassiveOpenGate>
                        </runtime.baseMenu.Positioner>
                      </runtime.layerBaseContext.Provider>
                    )}
                  </runtime.CollisionPaddingProvider>,
                ]}
              </runtime.PortalRoot>
            </runtime.baseMenu.Portal>
          );
        },
      );
      MenuSheetPopup.displayName = "MenuSheetPopup";
    });
    initializePopoverSheetContent = (0, runtime.initializeOnce)(() => {
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
    initializeComboboxSheetBackdrop = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeSheetClassNames)();
      (0, runtime.initializeNpmDependency)();
      jsxComboboxSheetBackdrop = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
    });
    mobileSheetExports = {} as Overlays.MobileSheetParts;
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
      initializePopoverSheetContent();
      initializeComboboxSheetBackdrop();
    });
    loadedSheetImplementation = null;
    sheetImplementationFailed = false;
    sheetImplementationRequests = 0;
    sheetImplementationGeneration = 0;
    sheetImplementationPromise = null;
    getSheetImplementationSnapshot = () => loadedSheetImplementation;
    getSheetImplementationLoadedSnapshot = () =>
      loadedSheetImplementation !== null;
    getSheetImplementationFailedSnapshot = () => sheetImplementationFailed;
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
      // CucCut: the desktop app is told apart by Electron alone.
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
      cdsRouterContext = reactCdsLink.createContext<
        Overlays.LinkRouter | undefined
      >(undefined);
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
      // CucCut: no first-party editor extensions; only VS Code settings links are followed.
      allowedEditorHrefPattern =
        /^vscode:\/\/settings\/[A-Za-z0-9][A-Za-z0-9_.-]*$/;
      allowedIntentPropertyNames = new Set([
        "scheme",
        "package",
        "S.browser_fallback_url",
      ]);
      absoluteHrefPattern = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;
      // CucCut: no first-party web domains or Android apps; every external link is treated as "other".
      trustedAnthropicDomains = [];
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
      linkPrefetchEventNames = Object.keys(
        linkPrefetchEventKinds,
      ) as Layers.LinkIntentEventName[];
    });
    initializeElementWindow = () => {};
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
      initializeElementWindow();
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
      densityContext = reactCdsRoot.createContext<Density>("comfortable");
      portalDensityContext = densityContext;
      colorModeStoreContext = reactCdsRoot.createContext<
        Layers.ColorModeStore | undefined
      >(undefined);
      defaultColorModeStore = {
        setElement: () => {
          return;
        },
        subscribe: () => () => {
          return;
        },
        getSnapshot: (): undefined => {
          return;
        },
        getServerSnapshot: (): undefined => {
          return;
        },
        getAttrSnapshot: (): undefined => {
          return;
        },
        getServerAttrSnapshot: (): undefined => {
          return;
        },
        getSettingSnapshot: (): undefined => {
          return;
        },
        getServerSettingSnapshot: (): undefined => {
          return;
        },
      };
      platformContext = reactCdsRoot.createContext<
        Layers.CdsPlatform | undefined
      >(undefined);
      fontContext = reactCdsRoot.createContext<Layers.CdsFont | undefined>(
        undefined,
      );
      monospaceFontContext = reactCdsRoot.createContext<
        string | null | undefined
      >(undefined);
      pageBackgroundContext = reactCdsRoot.createContext<string | undefined>(
        undefined,
      );
      naturalImageTilesContext = reactCdsRoot.createContext<
        boolean | undefined
      >(undefined);
      densityOverrideContext = reactCdsRoot.createContext<Density | undefined>(
        undefined,
      );
      surfaceBackgroundContext = reactCdsRoot.createContext<string | undefined>(
        undefined,
      );
      localeContext = reactCdsRoot.createContext<string | undefined>(undefined);
      rootElementContext = reactCdsRoot.createContext<HTMLElement | undefined>(
        undefined,
      );
      rootPortalContainerContext =
        reactCdsRoot.createContext<Layers.PortalContainer>(undefined);
      isPortalRootContext = reactCdsRoot.createContext<boolean>(false);
      opaqueTintOverrides = Object.fromEntries(
        runtime.accentColorNames.map((input: string) => [
          `--cds-bg-tint-${input}`,
          `var(--cds-bg-tint-${input}-opaque)`,
        ]),
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
