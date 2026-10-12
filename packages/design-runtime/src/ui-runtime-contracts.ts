import type * as React from "react";
import type {
  ControlSize,
  Density,
  ColorMode,
  Elevation,
  SurfaceBackground,
  BadgeVariant,
  AccentColor,
  DesignStyle,
  ForwardComponent,
  FieldState,
  ButtonGroupState,
  CheckboxGlyphProps,
  CheckboxVisualProps,
  SpinnerProps,
  DelayedSpinnerProps,
  TextAreaProps,
  TextInputProps,
  SurfaceProps,
  BadgeProps,
  ClickToFocusOptions,
  LabelValues,
  LabelResolver,
  SwitchProps,
  CollapsibleRootProps,
  CollapsibleTriggerProps,
  CollapsiblePanelProps,
  RadioGlyphProps,
  RadioOption,
  RadioGroupProps,
  RadioItemProps,
  RadioCardProps,
  RadioRootProps,
  MediaQueryStore,
  DocumentInputState,
  InputFocusEvent,
  SelectionMouseEvent,
  ActivityBoundaryProps,
  SheetFrame,
  MutableCell,
  FlipGeometry,
  FlipIndicatorState,
  TabMenuItem,
  TabsListMenuProps,
  VirtualTriggerAnchor,
  ThemeClassGroup,
  ThemeClassKeys,
  ClassValue,
  OverlayKind,
  OverlayPresentation,
  LayerRenderProps,
  LayerProps,
  LayerValue,
  OverlayActions,
  PublicOverlayActions,
  OverlayChangeDetails,
  OverlayChange,
  MenuChange,
  CloseWatcherHandle,
  BrowserWindow,
  FocusOptionsWithVisibility,
  FocusableElement,
  PopupInputKind,
  PopupFocus,
  PassiveOpenCell,
  PassiveOpenGateState,
  PassivePopupProps,
  PassivePopupTransform,
  PassiveGateProps,
  MenuLabels,
  MenuItemState,
  PopupScrollAreaProps,
  PopupPlacement,
  KeyboardInset,
  SheetDetent,
  SheetFrameState,
  SheetDetents,
  SheetPosition,
  SheetGestureRelease,
  SheetGestureResult,
  TooltipDelay,
  TooltipImplementation,
  TooltipProps,
  DisabledTooltipProps,
  MenuPopupProps,
  MenuRootProps,
  MenuItemProps,
  ComboboxKey,
  ComboboxOption,
  ComboboxSharedProps,
  ComboboxProps,
  ComboboxLabelInput,
  AccessibleNameProps,
  ComboboxLabelResult,
  ComboboxGroupMap,
  VirtualComboboxActions,
  VirtualComboboxProps,
  InitialPopupFocus,
  MenuRootState,
  OpenerReturnOptions,
  OpenerReturnState,
  SheetChrome,
  SheetPopupState,
  InnerOverlay,
  InnerOverlayStack,
  ComboboxRegistration,
  CollisionPadding,
  PassiveOpenLevel,
  SheetRenderState,
  MobileSheetParts,
  ComboboxRowProps,
  GenericComboboxRow,
  ComboboxHostProps,
  ComboboxBridgeProps,
  ComboboxPartProps,
  ComboboxStatusProps,
  ComboboxChipProps,
  ComboboxTriggerProps,
  ComboboxValueProps,
  ComboboxPopupProps,
  ComboboxItemPartProps,
  ComboboxChipsProps,
  ComboboxFooterActionProps,
  ComboboxPopupViewProps,
  ImperativeComboboxDetails,
  ImeKeyEvent,
  MenuItems,
  MenuEntry,
  MenuItemsContent,
  MenuSubmenuProps,
  MenuSubmenuTriggerProps,
  MenuProps,
  ContextMenuState,
  MenuSearchProps,
  MenuPendingProps,
  MenuTextState,
  MenuPopupElementProps,
  PopupAnimationInput,
  PopupAnimationState,
  MenuTriggerButtonProps,
  SearchKeyEvent,
  MenuPopupKeyboardEvent,
  MenuPopupFocusEvent,
  DialogRootProps,
  AlertDialogRootProps,
  DialogPopupProps,
  DialogPopupInnerProps,
  DialogHeaderProps,
  DialogFooterProps,
  ConfirmationDialogProps,
  ConfirmationFocus,
  DialogTitleProps,
  DialogDescriptionProps,
  PopoverRootProps,
  PopoverPopupProps,
  PopoverPopupViewProps,
  PopoverPopupInnerProps,
  PopoverAnchorState,
  PopoverAnchorStore,
  EmptyTooltipContent,
  TooltipBodyState,
  TooltipBodyUpdate,
  TooltipInstantActions,
  OverflowTooltipProps,
  DeferredTooltipScope,
  DeferredTooltipNode,
  TooltipTriggerProps,
  DeferredTooltipLoad,
  DeferredTooltipState,
  TooltipPointerEvent,
  OptionalStableCallback,
  OverlayEventDetails,
  OverlayOpenProps,
  SheetPopupOptions,
  SheetFrameContext,
  SheetStackState,
  SheetPopupResult,
  RouterEvents,
  LinkInput,
  LinkAttributes,
  LinkRouter,
  ButtonGroupOptions,
  PolymorphicTooltipTrigger,
} from "./contracts/ui";
/** Reviewed UI module bindings, including generic hooks and native events. */
export interface UIContracts {
  asElement: (value: EventTarget | null | undefined) => Element | null;
  createStableCallback: <Args extends unknown[], Result>(
    input: React.RefObject<(...args: Args) => Result>,
  ) => (...args: Args) => Result;
  createOptionalStableCallback: <Args extends unknown[], Result>(
    input: React.RefObject<((...args: Args) => Result) | undefined>,
  ) => (...args: Args) => Result | undefined;
  useOptionalStableCallback: OptionalStableCallback;
  useStableCallback: <Args extends unknown[], Result>(
    input: (...args: Args) => Result,
  ) => (...args: Args) => Result;
  useIsomorphicLayoutEffect: typeof React.useLayoutEffect;
  mobileSheetMediaQuery: string;
  mediaQueryStores: WeakMap<Window, Map<string, MediaQueryStore>>;
  HooksMediaQueryHandler: MediaQueryStore["subscribe"];
  HooksMediaQueryHandler_2: () => boolean;
  coarsePointerMediaQuery: string;
  getMediaQueryStore: (
    input: Window,
    options: string,
  ) => MediaQueryStore | null;
  useWindowMediaQuery: (
    input: Window | null | undefined,
    options: string,
  ) => boolean;
  accentColorNames: string[];
  getOwnerWindow: (element?: Element | null) => Window | undefined;
  isDetachedElement: (element?: Element) => boolean;
  getConnectedOwnerWindow: (input?: Element) => Window | undefined;
  documentInputStates: WeakMap<Document, DocumentInputState>;
  dismissalKeys: Set<string>;
  observeDocumentInput: (input?: Document) => void;
  ensureDocumentInputObserver: (input?: Element | null) => void;
  isRestoredFocus: (event: InputFocusEvent) => boolean;
  DomSelectionPreventionFreezeValue: Readonly<{
    onMouseDown: (event: SelectionMouseEvent) => void;
  }>;
  preventMultipleClickSelection: (event: SelectionMouseEvent) => void;
  withSelectionPrevention: <Event extends SelectionMouseEvent>(
    input?: (event: Event) => void,
  ) => (event: Event) => void;
  DomInertParseIntValue: number;
  DomInertResolvedValue: boolean;
  getInertProps: (input: boolean | undefined) => { inert?: true | "" };
  createSheetMutableCell: <Value = SheetFrame>() => MutableCell<Value>;
  sheetFrameHeight: (
    input: SheetFrame | null,
    options?: Pick<Window, "innerHeight">,
  ) => number | undefined;
  sheetStackMaxHeight: (input: readonly SheetFrame[]) => number | undefined;
  HttpWwwW3Org1999XhtmlValue: string;
  HttpWwwW3Org2000SvgValue: string;
  ActivityVisibilityContext: React.Context<Set<Element> | null>;
  DomRefCompositionEventRestoreAllState: {
    event: Event;
    restoreAll: () => void;
  } | null;
  DomRefCompositionDragendDropPointerdownValues: string[];
  DisabledContext: React.Context<boolean>;
  assignRef: <Element>(
    ref: React.Ref<Element> | undefined,
    value: Element | null,
  ) => void | (() => void);
  mergeRefs: <Element>(
    ...refs: (React.Ref<Element> | undefined)[]
  ) => React.RefCallback<Element>;
  useMergedRefs: <Element>(
    input?: React.Ref<Element>,
    options?: React.Ref<Element>,
    context?: React.Ref<Element>,
  ) => React.RefCallback<Element>;
  useEventRef: <Element>(
    input: React.RefCallback<Element>,
    options?: React.Ref<Element>,
  ) => React.RefCallback<Element>;
  elementNamespace: (
    input: Node | null | undefined,
  ) => string | null | undefined;
  isHtmlElement: (input: Node | null | undefined) => input is HTMLElement;
  isSvgElement: (input: Node | null | undefined) => input is SVGElement;
  hasDisplayNoneAncestor: (input: Element) => boolean;
  hasOpenChildOverlay: (input: Element) => boolean;
  ActivityBoundary: (props: ActivityBoundaryProps) => React.ReactElement;
  useCloseOnHiddenActivity: (
    input: boolean | undefined,
  ) => React.RefObject<HTMLElement | null>;
  companionModalCatcher: (
    input: Element,
    options: EventTarget | null,
  ) => HTMLElement | null;
  shouldPreventModalCatcherFocus: (
    input: Element,
    options: EventTarget | null,
  ) => boolean;
  preventModalCatcherPointerFocus: (
    event: React.PointerEvent<HTMLElement>,
  ) => void;
  preventModalCatcherMouseFocus: (event: React.MouseEvent<HTMLElement>) => void;
  handleModalCatcherDismissal: (
    event: React.SyntheticEvent<HTMLElement>,
  ) => void;
  FieldStateContext: React.Context<FieldState | null>;
  useFieldInvalid: () => boolean;
  useFieldDisabled: () => boolean;
  isInsideField: () => boolean;
  ButtonGroupContext: React.Context<ButtonGroupState>;
  CdsCompactableAttribute: string;
  ButtonContextClassNames: string;
  ButtonContextClassNames_2: string;
  ButtonContextClassNames_3: string;
  ButtonContextClassNames_4: string;
  CdsBtnSquishValue: string;
  ButtonContextClassNames_5: string;
  ButtonContextClassNames_6: string;
  ButtonContextClassNames_7: string;
  ButtonContextClassNames_8: string;
  useButtonGroup: () => ButtonGroupState;
  useButtonAnimation: (
    input: React.RefObject<HTMLElement | null>,
    options: "Button" | "SegmentedControl",
  ) => void;
  buttonBackgroundClassName: (input: {
    joined?: boolean;
    solid?: boolean;
  }) => string;
  HeldValue: string;
  SwitchContextConstant: number;
  SwitchContextElementCache: WeakMap<HTMLElement, Animation>;
  FlipIndicatorContext: React.Context<FlipIndicatorState | null>;
  CdsStashedAttribute: string;
  TabsMenuTriggerValue: string;
  TabsMenuLabelValue: string;
  animateFlipIndicator: (
    input: HTMLElement,
    options: Element,
    context: FlipGeometry | null,
    config?: { correction?: boolean },
  ) => void;
  cssTimeMilliseconds: (input: CSSStyleDeclaration, options: string) => number;
  supportsElementAnimations: (input: Element) => boolean;
  backgroundHasAlpha: (input: CSSStyleDeclaration) => boolean;
  setTransformWillChange: (input: HTMLElement, options: boolean) => void;
  hasRunningAnimations: (input: Element) => boolean;
  cancelElementAnimations: (input: Element) => void;
  hasFlipAnimation: (input: HTMLElement) => boolean;
  seekFlipAnimation: (
    input: HTMLElement,
    options: number,
    context: () => readonly FlipGeometry[],
  ) => void;
  isFlipIndicatorEntering: (input: HTMLElement) => boolean;
  useFlipIndicatorContext: () => FlipIndicatorState | null;
  preventRepeatedEnter: (
    event: Pick<React.KeyboardEvent, "repeat" | "key" | "preventDefault">,
  ) => void;
  ComponentsCheckboxClassNames: string;
  CheckboxGlyph: (props: CheckboxGlyphProps) => React.ReactElement;
  CheckboxVisual: (props: CheckboxVisualProps) => React.ReactElement;
  ComponentsSpinnerSMLConfig: Partial<
    Record<NonNullable<SpinnerProps["size"]>, "sm" | "md" | "lg">
  >;
  ComponentsSpinnerSmMdLgConfig: Record<
    "sm" | "md" | "lg",
    { box: number; stroke: number }
  >;
  Spinner: (props: SpinnerProps) => React.ReactElement | null;
  DelayedSpinner: (props: DelayedSpinnerProps) => React.ReactElement | null;
  TextArea: ForwardComponent<HTMLTextAreaElement, TextAreaProps>;
  ButtonButtonCssAlias: string;
  ButtonButtonClassNamesAlias: string;
  ComponentsTextInputClassNames: string;
  ComponentsTextInputClassNames_2: string;
  TextInput: ForwardComponent<HTMLInputElement, TextInputProps>;
  Surface: ForwardComponent<HTMLDivElement, SurfaceProps>;
  surfaceFocusStyle: (input?: string) => DesignStyle;
  switchRootClasses: string;
  ComponentsSwitchClassNames: string;
  ComponentsSwitchLabel: string;
  ComponentsSwitchLabel_2: string;
  Switch: ForwardComponent<HTMLInputElement, SwitchProps>;
  CollapsibleRoot: ForwardComponent<HTMLDivElement, CollapsibleRootProps>;
  collapsibleTriggerClasses: string;
  ComponentsCollapsibleLabel: string;
  CollapsibleTrigger: ForwardComponent<
    HTMLButtonElement,
    CollapsibleTriggerProps
  >;
  collapsiblePanelClasses: string;
  CollapsiblePanel: ForwardComponent<HTMLDivElement, CollapsiblePanelProps>;
  ComponentsCollapsibleRootTriggerPanelConfig: {
    Root: UIContracts["CollapsibleRoot"];
    Trigger: UIContracts["CollapsibleTrigger"];
    Panel: UIContracts["CollapsiblePanel"];
  };
  radioGlyphClasses: string;
  RadioGroupItem: ForwardComponent<HTMLButtonElement, RadioItemProps>;
  radioItemClasses: string;
  RadioGroupCard: ForwardComponent<HTMLButtonElement, RadioCardProps>;
  RadioGroupRoot: ForwardComponent<HTMLDivElement, RadioRootProps>;
  ComponentsRadioGroupAssignValue: UIContracts["RadioGroup"] & {
    Root: UIContracts["RadioGroupRoot"];
    Item: UIContracts["RadioGroupItem"];
    Card: UIContracts["RadioGroupCard"];
  };
  RadioGlyph: (props: RadioGlyphProps) => React.ReactElement;
  RadioGroup: React.FC<RadioGroupProps>;
  RoleTabValue: string;
  TabsListMenuLabel: string;
  collectAccessibleTabText: (input: Element, options: string) => string;
  accessibleTabText: (element: Element) => string;
  screenReaderTabText: (input: Element) => string;
  registeredTabsInDomOrder: <Value>(
    input: ReadonlyMap<Value, HTMLElement>,
  ) => TabMenuItem<Value>[];
  readTabMenuItems: <Value>(
    input: Element | null,
    options: ReadonlyMap<Value, HTMLElement>,
  ) => TabMenuItem<Value>[];
  tabMenuItem: <Value>(input: Value, element: Element) => TabMenuItem<Value>;
  sameTabMenuItems: <Value>(
    items: readonly TabMenuItem<Value>[],
    items2: readonly TabMenuItem<Value>[],
  ) => boolean;
  TabsListMenu: (props: TabsListMenuProps) => React.ReactElement;
  surfaceBackgroundTokens: Record<Elevation, SurfaceBackground>;
  ThemeSurfacesPanelPopoverConfig: Record<Elevation, string>;
  ThemeSurfacesSurface2Surface3Config: Record<SurfaceBackground, string>;
  focusShadowTokens: Record<ColorMode, string>;
  dangerFocusShadowTokens: Record<ColorMode, string>;
  virtualTriggerAnchor: (input: {
    triggerRef: React.RefObject<Element | null>;
  }) => VirtualTriggerAnchor;
  reducedMotionMediaQuery: string;
  reducedMotionAttribute: string;
  DurationSheetValue: string;
  PlatformReducedMotionCss: string;
  PlatformReducedMotionClassNames: string;
  PlatformReducedMotionCss_2: string;
  PlatformReducedMotionLabel: string;
  PlatformReducedMotionCss_3: string;
  PlatformReducedMotionCss_4: string;
  PlatformReducedMotionClassNames_2: string;
  PlatformReducedMotionClassNames_3: string;
  ClipPathInset00200vh0Value: string;
  PlatformReducedMotionLabel_2: string;
  ThemeClassNamesLabel: string;
  typographyScaleNames: string[];
  typographyWeightNames: string[];
  ThemeClassNamesBorderRadiusBoxShadowCursorConfig: Record<
    ThemeClassGroup,
    string[]
  >;
  themeClassKeys: ThemeClassKeys;
  themeClassKeysByGroup: Record<ThemeClassGroup, string[]>;
  typographyScaleClassKeys: string[];
  typographyWeightClassKeys: string[];
  getThemeClassKeys: (input: ThemeClassGroup) => string[];
  getThemeClassKeysValue: string[];
  getThemeClassKeysValue_2: string[];
  getThemeClassKeysValue_3: string[];
  ThemeClassNamesFromEntries: (
    input: string,
    options: string[],
  ) => Record<string, { [key: string]: string[] }[]>;
  ThemeClassNamesAlias: string[];
  ThemeClassNamesFlatMapValue: string[];
  mergeCdsClasses: (classes: string) => string;
  cn: (...inputs: ClassValue[]) => string;
  getSizeAttribute: (input?: ControlSize) => {
    "data-size"?: Exclude<ControlSize, "base">;
  };
  getControlSizeRank: (input: Density, options?: ControlSize) => number;
  useDensity: () => Density;
  useResolvedColorMode: () => ColorMode;
  monoFontOverrideStyle: (input?: string | null) => DesignStyle;
  pageBackgroundStyle: (input?: string) => DesignStyle;
  isFillBackgroundToken: (input: string) => boolean;
  sanitizeBackgroundValue: (input: string) => string;
  isBackgroundToken: (input: string) => boolean;
  popupSurfaceClassName: (input: Elevation) => string;
  textInputSelector: string;
  SheetsKeyboardViewportConstant: number;
  SheetsKeyboardViewportLimit: number;
  isTextInputElement: (input: Element | null | undefined) => boolean;
  measureKeyboardInset: (input: Window) => KeyboardInset | null;
  useKeyboardViewport: (
    input: boolean,
    options: (inset: KeyboardInset | null) => void,
    config?: { unpan?: boolean },
  ) => void;
  PlatformRuntimeClaudeNestPattern: RegExp;
  detectRuntimePlatform: () => "web" | "desktop";
  CdsDisabledReasonAttribute: string;
  disabledReasonWrapperProps: (
    input: React.ReactNode,
    options?: string,
    context?: string,
  ) => {
    tabIndex: number;
    "aria-describedby": string | undefined;
    className: string;
  };
  hasDisabledReason: (input: React.ReactNode) => boolean;
  DisabledReasonDescription: (props: {
    id?: string;
    reason?: React.ReactNode;
  }) => React.ReactElement;
  MenuPopupCss: string;
  ContextMenuPopupFrame: ForwardComponent<HTMLDivElement, MenuPopupProps>;
  MenuPopupCss_2: string;
  MenuPopupLabel: string;
  SelectValue: string;
  DraggableTrueValue: string;
  scrollbarWidth: (input: number, options: number, context?: number) => number;
  isScrollbarPointerEvent: (
    input: number,
    options: number,
    context: HTMLElement,
  ) => boolean;
  useClickToFocus: (
    input: (() => void) | undefined,
    options?: ClickToFocusOptions,
  ) => {
    clickToFocusProps: { onMouseDown: React.MouseEventHandler<HTMLElement> };
  };
  isInteractivePressTarget: (
    event: React.MouseEvent<HTMLElement>,
    config?: { draggable?: boolean },
  ) => boolean;
  closestMatchesWithin: (
    input: Element,
    options: string,
    context: Element,
  ) => boolean;
  usePassiveOpenGate: (
    input: MenuChange | undefined,
    options: boolean | undefined,
    context?: boolean,
  ) => PassiveOpenGateState;
  createPassiveOpenGate: () => PassiveOpenGateState;
  passiveOpenInputKind: (input?: Event) => PopupInputKind;
  declinesInitialFocus: (
    input: InitialPopupFocus | undefined,
    options: PopupInputKind,
  ) => boolean;
  defaultOwnerDocument: () => Document | undefined;
  resolveInitialFocusTarget: (
    input: PopupFocus | null | undefined,
    options: Element | null,
  ) => FocusableElement | null;
  activeDocumentElement: (input?: Document) => Element | null;
  isInsidePopup: (input: Node | null, options: Element | null) => boolean;
  focusPopupAfterMicrotask: (
    input: Document,
    options: Element | null,
    context: FocusableElement,
    value: boolean,
  ) => void;
  usePassiveOpenCell: (input: boolean) => {
    cell: PassiveOpenCell | null;
    root: PassiveOpenCell | null;
  };
  usePassiveOpenHandlers: () => Pick<PassivePopupProps, "tabIndex">;
  PassiveOpenGate: React.FC<PassiveGateProps>;
  PassiveOpenTypingWatcher: (props: { cell: PassiveOpenCell }) => null;
  LabelsProviderContext: React.Context<LabelResolver | undefined>;
  interpolateLabel: (input: string, options?: LabelValues) => string;
  resolveLabel: (
    input: LabelResolver | undefined,
    options: string,
    context: string,
    value?: LabelValues,
  ) => string;
  useLabel: (input: string, options: string, context?: LabelValues) => string;
  isButtonActivationKey: (input: Pick<React.KeyboardEvent, "key">) => boolean;
  isUnmodifiedButtonActivationKey: (
    input: Pick<
      React.KeyboardEvent,
      "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey"
    >,
  ) => boolean;
  buttonSizeToIconSize: (input?: ControlSize) => "auto-sm" | "md" | "auto";
  ComponentsBadgeNeutralAccentSuccessConfig: Record<BadgeVariant, string>;
  ComponentsBadgeNeutralAccentSuccessConfig_2: Record<BadgeVariant, string>;
  ComponentsBadgeRedOrangeYellowConfig: Record<AccentColor, string>;
  ComponentsBadgeRedOrangeYellowConfig_2: Record<AccentColor, string>;
  ComponentsBadgeXsSmMdConfig: Record<"xs" | "sm" | "md", string>;
  ComponentsBadgeClassNames: string;
  ComponentsBadgeComfortableCompactConfig: Record<
    Density,
    Record<ControlSize, "xs" | "sm" | "md">
  >;
  Badge: ForwardComponent<HTMLSpanElement, BadgeProps>;
  isBadgeVariant: (input: BadgeVariant | AccentColor) => input is BadgeVariant;
  LAYER_BAND_SIZE: number;
  GLOBAL_LAYER_BASE: number;
  LayerBaseContext: React.Context<number>;
  overlayLayerOffsets: Record<OverlayKind, number>;
  portalLayerClassName: string;
  CdsLayer: (props: LayerProps) => React.ReactElement;
  validateLayerOffset: (label: string, offset: number) => void;
  useDefaultLayer: (input: OverlayKind) => LayerValue;
  useLayer: (kind: OverlayKind, offset?: number) => LayerValue;
  CdsLayerVarBridge: (
    props: React.PropsWithChildren<{ className?: string }>,
  ) => React.ReactElement;
  useOverlayImperativeHandle: (
    input: React.RefObject<OverlayActions | null>,
    options?: React.Ref<PublicOverlayActions>,
  ) => void;
  isAndroidWindow: (input: BrowserWindow) => boolean;
  useAndroidCloseWatcher: (input: boolean, options?: () => void) => void;
  sheetGestureConstants: {
    detentThreshold: number;
    dismissFraction: number;
    flingVelocity: number;
    rubberBand: number;
    overshootRoom: number;
  };
  rubberBandDistance: (distance: number, room: number) => number;
  inverseRubberBandDistance: (distance: number, room: number) => number;
  calculateSheetDetents: (
    restHeight: number,
    viewportHeight: number,
    tallFraction: number,
    allowTall?: boolean,
  ) => SheetDetents;
  sheetHasTallDetent: (input: SheetDetents) => boolean;
  calculateSheetPosition: (
    detents: SheetDetents,
    rawHeight: number,
  ) => SheetPosition;
  sheetPositionToRawHeight: (
    detents: SheetDetents,
    height: number,
    slide: number,
  ) => number;
  settleSheetGesture: (
    input: SheetDetents,
    options: SheetGestureRelease,
  ) => SheetGestureResult;
  SheetsLayoutPositionTopRightConfig: DesignStyle;
  SheetsLayoutDisableAnchorTrackingCollisionAvoidanceConfig: Pick<
    import("@base-ui/react/combobox").Combobox.Positioner.Props,
    "disableAnchorTracking" | "collisionAvoidance"
  >;
  SheetsLayoutConstant: number;
  SheetsLayoutCss: string;
  SheetsLayoutCss_2: string;
  ComfortableValue: string;
  SheetsLayoutConstant_2: number;
  SheetsLayoutCss_3: string;
  getSheetFixedPosition: (input?: SheetFrameState | null) => DesignStyle;
  getSheetFrameStyle: (
    input: SheetFrameState | null,
    options: { floor?: "half" | "content"; parentFrameHeight?: number },
  ) => DesignStyle;
  OverlayPresentationContext: React.Context<OverlayPresentation>;
  drilledSheetAttribute: string;
  coveredSheetAttribute: string;
  CdsSheetPeelingAttribute: string;
  CdsSheetTreeClosingAttribute: string;
  sheetScrollAttribute: string;
  CdsSheetPressedAttribute: string;
  CdsSheetControlHeldAttribute: string;
  SheetsPresentationDelayMs: number;
  useMobileSheets: () => boolean;
  useOverlayPresentation: () => OverlayPresentation;
  useTouchOverlay: () => boolean;
  sheetNeedsScrolling: (input: Element) => boolean;
  sheetContainsTextInput: (element: Element) => boolean;
  shouldUseSheet: (
    input: OverlayPresentation,
    options: boolean,
    context: boolean,
  ) => boolean;
  useFrozenSheetMode: (
    input: boolean,
    options: boolean,
    context: boolean,
  ) => boolean;
  useSheetPendingUnmount: (input: boolean) => {
    showing: boolean;
    onOpenChangeComplete: (open: boolean) => void;
  };
  useOpenSnapshot: <Value>(
    input: boolean,
    options: () => Value,
    context: Value,
  ) => Value;
  TooltipTriggerContext: React.Context<boolean>;
  TooltipImplementationContext: React.Context<TooltipImplementation | null>;
  TooltipTriggerElementCache: WeakMap<Document, Range>;
  useTooltipTrigger: () => boolean;
  getResizeObserver: (
    input?: Element | null,
  ) => typeof ResizeObserver | undefined;
  measureContentRect: (element: Element) => boolean;
  useTooltipDelay: () => TooltipDelay;
  TooltipStylesClassNames: string;
  TooltipStylesCss: string;
  tooltipPopupClasses: string;
  TooltipStylesLabel: string;
  TooltipStylesCss_2: string;
  TooltipStylesLabel_2: string;
  tooltipImplementationExports: Partial<TooltipImplementation>;
  DarkScope: (props: React.PropsWithChildren) => React.ReactElement;
  MenuRootContext: React.Context<MenuRootState | null>;
  MenuConfigurationLabelOpenConfig: MenuItemState;
  MenuItemContext: React.Context<MenuItemState>;
  CdsFocusesNothingAttribute: string;
  MenuConfigurationContext: React.Context<boolean>;
  MenuConfigurationContext_2: React.Context<boolean>;
  MenuSheetLabelsContext: React.Context<MenuLabels>;
  MenuConfigurationLabel: string;
  MenuTriggerContext: React.Context<React.RefObject<OverlayActions | null> | null>;
  MenuSurfaceContext: React.Context<React.RefObject<OverlayActions | null> | null>;
  warnNestedMenuLayerOffset: () => void;
  warnNestedMenuInitialFocus: () => void;
  useMutableMenuRef: <
    Element = HTMLElement,
  >() => React.RefObject<Element | null>;
  PopupScrollArea: (props: PopupScrollAreaProps) => React.ReactElement;
  reactMenuPassiveOpenGate: typeof React;
  jsxMenuPassiveOpenGate: typeof import("react/jsx-runtime");
  reactDomMenuPassiveOpenGate: typeof import("react-dom");
  TriggerHoverValue: string;
  FocusOutValue: string;
  PassiveOpenCellContext: React.Context<PassiveOpenCell | null>;
  PassiveOpenDisabledContext: React.Context<boolean>;
  MenuPassiveOpenGateTabIndexConfig: Pick<PassivePopupProps, "tabIndex">;
  MenuPassiveOpenGateRegistry: Pick<PassivePopupProps, "tabIndex">;
  MenuPassiveOpenGateArrowDownArrowUpHomeSet: Set<string>;
  MenuPassiveOpenGateSubscribers: Set<string>;
  MenuPassiveOpenGateHandler: (listener: () => void) => () => void;
  MenuPassiveOpenGateDefaultText: () => "off";
  MenuPassiveOpenGateHandler_2: PassivePopupTransform;
  ComboboxComboboxFontSizeBodyFontSizeCaptionFontSizeCodeConfig: {
    "font-size-body": {
      compact: number;
      comfortable: number;
      steps: number[];
      textSize: {
        compact: { sm: number; lg: number };
        comfortable: { sm: number; lg: number };
      };
    };
    "font-size-caption": {
      compact: number;
      comfortable: number;
      steps: number[];
    };
    "font-size-code": { compact: number; comfortable: number };
    "font-size-footnote": { compact: number; comfortable: number };
    "font-size-heading": {
      compact: number;
      comfortable: number;
      textSize: {
        compact: { sm: number; lg: number };
        comfortable: { sm: number; lg: number };
      };
    };
    "font-size-prose": {
      compact: number;
      comfortable: number;
      steps: number[];
      textSize: string;
    };
    "font-size-title": { compact: number; comfortable: number };
    "leading-body": {
      compact: number;
      comfortable: number;
      steps: number[];
      textSize: {
        compact: { sm: number; lg: number };
        comfortable: { sm: number; lg: number };
      };
    };
    "leading-caption": { compact: number; comfortable: number };
    "leading-code": { compact: number; comfortable: number };
    "leading-footnote": { compact: number; comfortable: number };
    "leading-heading": {
      compact: number;
      comfortable: number;
      textSize: {
        compact: { sm: number; lg: number };
        comfortable: { sm: number; lg: number };
      };
    };
    "leading-prose": {
      compact: number;
      comfortable: number;
      steps: number[];
      textSize: string;
    };
    "leading-title": { compact: number; comfortable: number };
  };
  ComboboxComboboxConstant: number;
  ComboboxComboboxClassNames: string;
  ComboboxComboboxCss: string;
  ComboboxStatus: ForwardComponent<HTMLDivElement, ComboboxStatusProps>;
  ComboboxComboboxConstant_2: number;
  ComboboxComboboxConstant_3: number;
  ComboboxComboboxClassNames_2: string;
  ComboboxComboboxOutlineGhostConfig: { outline: string; ghost: string };
  ComboboxComboboxSelectInputConfig: { select: string; input: string };
  ComboboxComboboxCss_2: string;
  ComboboxComboboxClassNames_3: string;
  ComboboxComboboxClassNames_4: string;
  ComboboxComboboxClassNames_5: string;
  ComboboxComboboxLabel: string;
  ComboboxComboboxClassNames_6: string;
  ComboboxComboboxCss_3: string;
  ComboboxComboboxClassNames_7: string;
  ComboboxComboboxClassNames_8: string;
  ComboboxComboboxClassNames_9: string;
  comboboxGroupLabelClasses: string;
  ComboboxComboboxLabel_2: string;
  ComboboxComboboxClassNames_10: string;
  SeparatorValue: string;
  ComboboxComboboxClassNames_11: string;
  comboboxInputClasses: string;
  ComboboxComboboxCss_4: string;
  ComboboxComboboxClassNames_12: string;
  ComboboxComboboxClassNames_13: string;
  ComboboxComboboxLabel_3: string;
  ComboboxComboboxConstant_4: number;
  ComboboxComboboxConstant_5: number;
  ComboboxComboboxConstant_6: number;
  ComboboxComboboxConstant_7: number;
  ComboboxComboboxToLowerCase: (input: string) => string;
  ComboboxComboboxGetLabel: (input: ComboboxOption<ComboboxKey>) => string;
  ComboboxComboboxGetValue: (input: ComboboxOption<ComboboxKey>) => string;
  ComboboxChip: ForwardComponent<HTMLDivElement, ComboboxChipProps>;
  comboboxOutsideInputClasses: string;
  ComboboxChipRemove: ForwardComponent<
    HTMLButtonElement,
    ComboboxPartProps<"ChipRemove">
  >;
  ComboboxItem: GenericComboboxRow;
  ComboboxTrigger: ForwardComponent<HTMLButtonElement, ComboboxTriggerProps>;
  ComboboxValue: ForwardComponent<HTMLSpanElement, ComboboxValueProps>;
  ComboboxComboboxAutoCompleteData1pIgnoreDataLpignoreConfig: {
    autoComplete: string;
    "data-1p-ignore": boolean;
    "data-lpignore": string;
  };
  ComboboxInput: ForwardComponent<HTMLInputElement, ComboboxPartProps<"Input">>;
  ComboboxPopupSearch: ForwardComponent<
    HTMLInputElement,
    ComboboxPartProps<"Input">
  >;
  ComboboxClear: ForwardComponent<
    HTMLButtonElement,
    ComboboxPartProps<"Clear">
  >;
  ComboboxFooterAction: ForwardComponent<
    HTMLButtonElement,
    ComboboxFooterActionProps
  >;
  ComboboxPopup: ForwardComponent<HTMLDivElement, ComboboxPopupProps>;
  ComboboxSheetCapablePopup: ForwardComponent<
    HTMLDivElement,
    ComboboxPopupProps
  >;
  ComboboxPopupView: ForwardComponent<HTMLDivElement, ComboboxPopupViewProps>;
  ComboboxList: ForwardComponent<HTMLDivElement, ComboboxPartProps<"List">>;
  ComboboxEmpty: ForwardComponent<HTMLDivElement, ComboboxPartProps<"Empty">>;
  ComboboxItemAlias: ForwardComponent<HTMLDivElement, ComboboxItemPartProps>;
  ComboboxItemIndicator: ForwardComponent<
    HTMLSpanElement,
    ComboboxPartProps<"ItemIndicator">
  >;
  ComboboxGroupLabel: ForwardComponent<
    HTMLDivElement,
    ComboboxPartProps<"GroupLabel">
  >;
  ComboboxChips: ForwardComponent<HTMLDivElement, ComboboxChipsProps>;
  ComboboxRegistrationContext: React.Context<ComboboxRegistration | null>;
  ComboboxTriggerHiddenContext: React.Context<boolean>;
  ComboboxInputInsidePopupContext: React.Context<boolean>;
  ComboboxComboboxHandler: () => null;
  ComboboxComboboxAssignValue: UIContracts["Combobox"] & {
    Root: UIContracts["ComboboxRoot"];
    Trigger: UIContracts["ComboboxTrigger"];
    Value: UIContracts["ComboboxValue"];
    Caret: UIContracts["ComboboxCaret"];
    Input: UIContracts["ComboboxInput"];
    Popup: UIContracts["ComboboxPopup"];
    PopupSearch: UIContracts["ComboboxPopupSearch"];
    Clear: UIContracts["ComboboxClear"];
    List: UIContracts["ComboboxList"];
    Empty: UIContracts["ComboboxEmpty"];
    Status: UIContracts["ComboboxStatus"];
    Item: UIContracts["ComboboxItemAlias"];
    ItemIndicator: UIContracts["ComboboxItemIndicator"];
    Group: typeof import("@base-ui/react/combobox").Combobox.Group;
    GroupLabel: UIContracts["ComboboxGroupLabel"];
    Chips: UIContracts["ComboboxChips"];
    Chip: UIContracts["ComboboxChip"];
    ChipRemove: UIContracts["ComboboxChipRemove"];
    Separator: UIContracts["ComboboxSeparator"];
    Footer: UIContracts["ComboboxFooter"];
    FooterAction: UIContracts["ComboboxFooterAction"];
    Collection: typeof import("@base-ui/react/combobox").Combobox.Collection;
  };
  comboboxLabelProps: (props: ComboboxLabelInput) => ComboboxLabelResult;
  copyTriggerLabelProps: (
    element: Element | null | undefined,
    options?: { fallback?: string; fromTextEntry?: boolean },
  ) => AccessibleNameProps;
  useTriggerLabelProps: (
    input: React.Ref<HTMLElement> | undefined,
    options: () => Element | null | undefined,
    context: AccessibleNameProps,
    config?: { fallback?: string; fromTextEntry?: boolean },
  ) => { ref: React.RefCallback<HTMLElement>; nameProps: AccessibleNameProps };
  useDelayElapsed: (input: number) => boolean;
  DelayedContent: (props: {
    ms: number;
    children?: React.ReactNode;
  }) => React.ReactNode;
  VirtualComboboxRows: (props: VirtualComboboxProps) => React.ReactElement;
  comboboxMaxHeightStyle: (
    input?: number,
    options?: number,
  ) => DesignStyle | undefined;
  comboboxItemMatchesSearch: <Value extends ComboboxKey>(
    input: ComboboxOption<Value>,
    options: string,
  ) => boolean;
  comboboxSelectionLabel: <Value extends ComboboxKey>(
    items: readonly ComboboxOption<Value>[],
    options?: string,
    context?: LabelResolver,
  ) => string;
  comboboxVisibleGroups: <Value extends ComboboxKey>(
    input: readonly ComboboxOption<Value>[],
    options: (item: ComboboxOption<Value>) => boolean,
    context: boolean,
  ) => ComboboxGroupMap<Value>;
  Combobox: <Value extends ComboboxKey>(
    input: ComboboxProps<Value>,
  ) => React.ReactElement;
  comboboxTriggerForInputKind: (
    input: PopupInputKind,
    options: HTMLElement | null | undefined,
    context: HTMLElement | null | undefined,
    value: HTMLElement | null | undefined,
  ) => HTMLElement | undefined;
  ComboboxSheetBridge: <Value extends ComboboxKey>(
    input: ComboboxBridgeProps<Value>,
  ) => React.ReactElement;
  ComboboxSheetPopup: <Value extends ComboboxKey>(
    input: ComboboxBridgeProps<Value>,
  ) => React.ReactElement;
  ComboboxPopupHost: <Value extends ComboboxKey>(
    props: ComboboxHostProps<Value>,
  ) => React.ReactElement;
  registerOutsideComboboxInput: () => void;
  useComboboxTriggerRef: (
    input?: React.Ref<HTMLElement>,
  ) => React.RefCallback<HTMLElement>;
  useComboboxPopupInputRef: (
    input?: React.Ref<HTMLElement>,
  ) => React.RefCallback<HTMLElement>;
  useComboboxTriggerGetter: () => () => HTMLElement | null;
  useComboboxInputLabel: (
    input: React.Ref<HTMLElement> | undefined,
    options?: string,
    context?: string,
  ) => { ref: React.RefCallback<HTMLElement>; nameProps: AccessibleNameProps };
  useComboboxListRef: (
    input?: React.Ref<HTMLElement>,
  ) => React.RefCallback<HTMLElement>;
  useRegisteredElementRef: (
    input: ((element: HTMLElement | null) => void) | undefined,
    options: (() => HTMLElement | null) | undefined,
  ) => React.RefCallback<HTMLElement>;
  ComboboxCaret: (props: { className?: string }) => React.ReactElement;
  ComboboxSeparator: (props: { className?: string }) => React.ReactElement;
  ComboboxFooter: (
    props: React.PropsWithChildren<{ className?: string }>,
  ) => React.ReactElement;
  imperativeComboboxCloseDetails: () => ImperativeComboboxDetails;
  ComboboxRoot: <Value, Multiple extends boolean = false>(
    input: import("@base-ui/react/combobox").Combobox.Root.Props<
      Value,
      Multiple
    >,
  ) => React.ReactElement;
  RegisteredComboboxRoot: <Value, Multiple extends boolean = false>(props: {
    rootProps: import("@base-ui/react/combobox").Combobox.Root.Props<
      Value,
      Multiple
    >;
    registration: ComboboxRegistration;
  }) => React.ReactElement;
  menuItemVariants: (options?: { variant?: "default" | "danger" }) => string;
  MenuItemStylesClassNames: string;
  ParentMenuContext: React.Context<
    React.RefObject<HTMLElement | null> | undefined
  >;
  MenuItemStylesProviderValue: React.Provider<
    React.RefObject<HTMLElement | null> | undefined
  >;
  MenuPopupElement: ForwardComponent<HTMLDivElement, MenuPopupElementProps>;
  wasTriggerOpenCanceled: (
    input: import("@base-ui/react/menu").Menu.Root.ChangeEventDetails,
  ) => boolean;
  useMenuTriggerRef: (
    input: MenuChange | undefined,
    options?: boolean,
  ) => {
    triggerRef: React.RefObject<HTMLElement | null>;
    onOpenChange: MenuChange;
  };
  useParentMenu: () => React.RefObject<HTMLElement | null> | undefined;
  useMenuPopupFocus: (
    input: React.RefObject<HTMLElement | null> | undefined,
    options: PopupFocus | null | undefined,
  ) => React.RefCallback<HTMLElement>;
  popupPlacementAttributes: (element: Element) => PopupPlacement;
  samePopupPlacement: (
    input: PopupPlacement | null,
    options: PopupPlacement,
  ) => boolean;
  popupUsesReverseEntry: (input: PopupPlacement | null) => boolean;
  usePopupEntryAnimation: (props: PopupAnimationInput) => PopupAnimationState;
  noImeTimestamp: number;
  MenuMenuAlias: number;
  MenuMenuObservedElements: WeakSet<Event>;
  MenuMenuInsertParagraphInsertLineBreakSet: Set<string>;
  MenuMenuBeforeinputKeydownKeyupValues: string[];
  MenuMenuPattern: RegExp;
  MenuPopup: ForwardComponent<HTMLDivElement, MenuPopupProps>;
  MenuSheetCapablePopup: ForwardComponent<HTMLDivElement, MenuPopupProps>;
  MenuItem: ForwardComponent<HTMLDivElement, MenuItemProps>;
  MenuSubmenuTrigger: ForwardComponent<HTMLDivElement, MenuSubmenuTriggerProps>;
  MenuMenuClassNames: string;
  MenuTriggerButton: ForwardComponent<
    HTMLButtonElement,
    MenuTriggerButtonProps
  >;
  MenuMenuConstant: number;
  MenuMenuWidthHeightConfig: { width: number; height: number };
  DataHighlightedTabindex0Value: string;
  MenuBar: ForwardComponent<
    HTMLDivElement,
    import("@base-ui/react/menubar").Menubar.Props
  >;
  MenuMenuAssignValue: UIContracts["Menu"] & {
    Root: UIContracts["MenuRoot"];
    Bar: UIContracts["MenuBar"];
    Trigger: typeof import("@base-ui/react/menu").Menu.Trigger;
    TriggerButton: UIContracts["MenuTriggerButton"];
    Popup: UIContracts["MenuPopup"];
    Item: UIContracts["MenuItem"];
    Separator: UIContracts["MenuSeparator"];
    Group: typeof import("@base-ui/react/menu").Menu.Group;
    GroupLabel: UIContracts["MenuGroupLabel"];
    Header: UIContracts["MenuHeader"];
    Submenu: UIContracts["MenuSubmenu"];
    SubmenuTrigger: UIContracts["MenuSubmenuTrigger"];
    SearchablePopup: UIContracts["MenuSearchablePopup"];
    PendingList: UIContracts["MenuPendingList"];
  };
  isAppleWebKit: () => boolean;
  rememberImeEnter: (input: number) => void;
  resetImeEnterTimestamp: (event: ImeKeyEvent) => void;
  shouldIgnoreImeEvent: (input: KeyboardEvent) => boolean;
  consumeImeFollowupEvents: (
    input: KeyboardEvent,
    options: HTMLElement,
    context: () => void,
  ) => void;
  MenuContextProviders: (
    input: React.ReactNode,
    options: PassiveOpenCell | null,
    context: React.RefObject<OverlayActions | null>,
    value?: boolean,
  ) => React.ReactElement;
  isNestedSheetTarget: (
    input: EventTarget | null | undefined,
    options?: string,
  ) => boolean;
  isFocusOutEvent: (input: Event | undefined) => input is FocusEvent;
  shouldKeepNestedMenuOpen: (
    input: boolean,
    options: import("@base-ui/react/menu").Menu.Root.ChangeEventDetails,
    context?: string,
  ) => boolean;
  cancelNestedMenuClose: (
    input: boolean,
    options: import("@base-ui/react/menu").Menu.Root.ChangeEventDetails,
    context?: string,
  ) => boolean;
  extractReactText: (input: React.ReactNode) => string | undefined;
  normalizeMenuText: (input: string) => string;
  useMenuItemText: (input: React.ReactNode, options?: string) => MenuTextState;
  menuShortcutClassName: (
    input: string | readonly string[] | undefined,
  ) => string;
  MenuShortcut: (props: {
    keys: string | readonly string[];
  }) => React.ReactElement;
  MenuPopupContent: (
    input: MenuPopupProps,
    options: React.ForwardedRef<HTMLDivElement>,
    context: boolean,
    value: boolean,
  ) => React.ReactElement;
  MenuSubmenu: (props: MenuSubmenuProps) => React.ReactElement;
  MenuSeparator: () => React.ReactElement;
  MenuHeader: (
    props: React.PropsWithChildren<{ className?: string }>,
  ) => React.ReactElement;
  MenuGroupLabel: (
    props: React.PropsWithChildren<{ className?: string }>,
  ) => React.ReactElement;
  isMenuItemsArray: (input: MenuItemsContent) => input is MenuItems;
  renderMenuItems: (input: MenuItemsContent) => React.ReactNode;
  menuCaretSize: (input: Density, options?: ControlSize) => "sm" | "xs";
  MenuCaret: (props: { size?: ControlSize }) => React.ReactElement;
  ContextMenuContent: (
    props: Pick<
      MenuPopupProps,
      "side" | "align" | "sideOffset" | "collisionPadding" | "finalFocus"
    > & { dataCds?: string; items: MenuItemsContent },
  ) => React.ReactElement;
  Menu: (input: MenuProps) => React.ReactElement;
  useContextMenuRoot: (input: MenuProps) => React.ReactElement;
  ContextMenu: (
    input: MenuProps,
    options: HTMLElement | undefined,
    context: ContextMenuState,
  ) => React.ReactElement;
  menuCloseTargetsNestedPopup: (
    input: import("@base-ui/react/menu").Menu.Root.ChangeEventDetails,
    options?: string,
  ) => boolean;
  MenuRoot: (input: MenuRootProps) => React.ReactElement;
  MenuRoot_2: (input: MenuRootProps) => React.ReactElement;
  ResetOnUnmount: (props: { reset: () => void }) => null;
  isSearchMenuTypingKey: (input: SearchKeyEvent) => boolean;
  MenuSearchTypingWatcher: (props: {
    inputRef: React.RefObject<HTMLInputElement | null>;
    applyKey: (key: string) => void;
  }) => null;
  MenuSearchTriggerWatcher: (props: {
    inputRef: React.RefObject<HTMLInputElement | null>;
  }) => null;
  MenuSearchablePopup: (props: MenuSearchProps) => React.ReactElement;
  useSearchMenuFocus: (
    input: React.RefObject<HTMLElement | null>,
    options: boolean,
  ) => void;
  MenuPendingList: (props: MenuPendingProps) => React.ReactElement;
  DialogDialogCss: string;
  DialogDialogClassNames: string;
  DialogDialogCss_2: string;
  DialogDialogClassNames_2: string;
  dialogBackdropClasses: string;
  DialogDialogClassNames_3: string;
  StartingOpacity0Value: string;
  DialogDialogCurrentState: AbortController | null;
  DialogDialogHeightWebkitAppRegionConfig: React.CSSProperties & {
    WebkitAppRegion: string;
  };
  DialogDialogClassNames_4: string;
  DataNestedDialogOpenBlur2pxValue: string;
  DialogDialogSmMdLgConfig: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    "2xl": string;
    "3xl": string;
  };
  DialogDialogPattern: RegExp;
  DialogDialogContext: React.Context<boolean | "trap-focus" | undefined>;
  DialogDialogContext_2: React.Context<boolean>;
  DialogDialogClassNames_5: string;
  DialogDialogClassNames_6: string;
  Mt05Value: string;
  Mt1Value: string;
  DialogDialogClassNames_7: string;
  DialogDialogContext_3: React.Context<
    React.RefObject<HTMLButtonElement | null> | undefined
  >;
  DialogDialogContext_4: React.Context<boolean>;
  DialogTrigger: ForwardComponent<
    HTMLButtonElement,
    import("@base-ui/react/dialog").Dialog.Trigger.Props<void>
  >;
  DialogDialogDelayMs: number;
  DialogDialogLabel: string;
  DialogPopupInner: ForwardComponent<HTMLDivElement, DialogPopupInnerProps>;
  ConfirmationDialogPopupInner: ForwardComponent<
    HTMLDivElement,
    import("@base-ui/react/alert-dialog").AlertDialog.Popup.Props
  >;
  DialogPopup: ForwardComponent<HTMLDivElement, DialogPopupProps>;
  DialogTitle: ForwardComponent<HTMLHeadingElement, DialogTitleProps>;
  DialogDialogLabel_2: string;
  DialogDescription: ForwardComponent<
    HTMLParagraphElement,
    DialogDescriptionProps
  >;
  DialogDialogStartCenterEndConfig: {
    start: string;
    center: string;
    end: string;
    between: string;
  };
  DialogDialogRootTriggerPopupConfig: {
    Root: UIContracts["DialogRoot"];
    Trigger: UIContracts["DialogTrigger"];
    Popup: UIContracts["DialogPopup"];
    Backdrop: typeof import("@base-ui/react/dialog").Dialog.Backdrop;
    Header: UIContracts["DialogHeader"];
    Title: UIContracts["DialogTitle"];
    Description: UIContracts["DialogDescription"];
    Footer: UIContracts["DialogFooter"];
    Close: typeof import("@base-ui/react/dialog").Dialog.Close;
    CloseButton: UIContracts["DialogCloseButton"];
  };
  DialogDialogRootTriggerPopupConfig_2: {
    Root: UIContracts["AlertDialogRoot"];
    Trigger: typeof import("@base-ui/react/alert-dialog").AlertDialog.Trigger;
    Popup: UIContracts["DialogPopup"];
    Backdrop: typeof import("@base-ui/react/alert-dialog").AlertDialog.Backdrop;
    Header: UIContracts["DialogHeader"];
    Title: UIContracts["DialogTitle"];
    Description: UIContracts["DialogDescription"];
    Footer: UIContracts["DialogFooter"];
    Close: typeof import("@base-ui/react/alert-dialog").AlertDialog.Close;
    CloseButton: UIContracts["DialogCloseButton"];
    createHandle: typeof import("@base-ui/react/alert-dialog").AlertDialog.createHandle;
  };
  WindowDragStrip: () => React.ReactElement;
  useDialogPresence: (input?: string) => void;
  useDialogOpenAutofocus: (
    input: React.RefObject<HTMLElement | null>,
    options: boolean,
    context: React.RefObject<HTMLElement | null>,
    value: React.RefObject<boolean>,
    extra: React.RefObject<boolean>,
    detail: () => HTMLElement | null,
  ) => () => HTMLElement | null;
  DialogCloseButton: (props: {
    "aria-label"?: string;
    className?: string;
    flush?: boolean;
  }) => React.ReactElement;
  DialogHeader: (props: DialogHeaderProps) => React.ReactElement;
  DialogFooter: (props: DialogFooterProps) => React.ReactElement;
  DialogRoot: <Payload = void>(
    props: DialogRootProps<Payload>,
  ) => React.ReactElement;
  AlertDialogRoot: <Payload = void>(
    props: AlertDialogRootProps<Payload>,
  ) => React.ReactElement;
  ConfirmationDialog: (props: ConfirmationDialogProps) => React.ReactElement;
  PopoverPopoverCss: string;
  popoverPopupClassNames: string;
  PopoverPopoverNoneXsSmConfig: {
    none: string;
    xs: string;
    sm: string;
    md: string;
    lg: string;
  };
  PopoverPopoverXysetrblOverflowPattern: RegExp;
  PopoverPopoverPaddingOverflowPattern: RegExp;
  PopoverPopupInner: ForwardComponent<HTMLDivElement, PopoverPopupInnerProps>;
  PopoverPopup: ForwardComponent<HTMLDivElement, PopoverPopupProps>;
  PopoverSheetCapablePopup: ForwardComponent<HTMLDivElement, PopoverPopupProps>;
  PopoverPopupView: ForwardComponent<HTMLDivElement, PopoverPopupViewProps>;
  PopoverPopoverContext: React.Context<PopoverAnchorStore | null>;
  PopoverPopoverContext_2: React.Context<InnerOverlayStack | null>;
  PopoverTrigger: ForwardComponent<
    HTMLButtonElement,
    import("@base-ui/react/popover").Popover.Trigger.Props<void>
  >;
  PopoverTriggerAlias: UIContracts["PopoverTrigger"];
  PopoverPopoverRootTriggerPopupConfig: {
    Root: UIContracts["PopoverRoot"];
    Trigger: UIContracts["PopoverTrigger"];
    Popup: UIContracts["PopoverPopup"];
    Title: typeof import("@base-ui/react/popover").Popover.Title;
    Description: typeof import("@base-ui/react/popover").Popover.Description;
    Close: typeof import("@base-ui/react/popover").Popover.Close;
    Arrow: typeof import("@base-ui/react/popover").Popover.Arrow;
    createHandle: typeof import("@base-ui/react/popover").Popover.createHandle;
  };
  SheetCapablePopup: (props: {
    kind: OverlayKind;
    children: (
      state: SheetRenderState,
      parts: MobileSheetParts | null,
    ) => React.ReactNode;
  }) => React.ReactElement;
  usePopoverAnimation: (
    input: string | undefined,
    options: import("@base-ui/react/popover").Popover.Popup.Props["style"],
  ) => void;
  isPopoverArrow: (input: React.ReactNode) => boolean;
  usePopoverInnerOverlays: (
    input: import("@base-ui/react/popover").Popover.Root.Props<void>["onOpenChange"],
  ) => {
    innerOverlays: InnerOverlayStack;
    onOpenChange: NonNullable<
      import("@base-ui/react/popover").Popover.Root.Props<void>["onOpenChange"]
    >;
  };
  resolvePopoverAnchor: (
    input: PopoverAnchorState,
  ) => Element | null | "virtual";
  hasPopoverInputAnchor: (input: PopoverAnchorState) => boolean;
  PopoverRoot: <Payload = void>(
    props: PopoverRootProps<Payload>,
  ) => React.ReactElement;
  usePopoverRoot: <Payload = void>(
    props: PopoverRootProps<Payload> & { consumerHandlesOpenChange: boolean },
  ) => React.ReactElement;
  CdsSheetPendingAttribute: string;
  OverlaysBackdropVisibilityOpacityConfig: React.CSSProperties;
  OverlaysBackdropPreventDefault: (
    event: Pick<React.SyntheticEvent, "preventDefault">,
  ) => void;
  useRestoreFocusOnClose: (input: boolean) => React.RefCallback<HTMLElement>;
  OverlayBackdrop: (props: { kind: OverlayKind }) => React.ReactPortal | null;
  TooltipTooltipCurrentState: React.RefObject<TooltipInstantActions> | null;
  emptyTooltipContent: EmptyTooltipContent;
  TooltipTooltipOpenBodyConfig: TooltipBodyState;
  TooltipTooltipOpen: TooltipBodyUpdate;
  TooltipTooltipOpen_2: TooltipBodyUpdate;
  TooltipTooltipBody: TooltipBodyUpdate;
  TooltipTooltipOpen_3: (input: React.ReactNode) => TooltipBodyUpdate;
  TooltipTooltipIs: (input: React.ReactNode) => TooltipBodyUpdate;
  TooltipTooltipOpen_4: TooltipBodyUpdate;
  TooltipStylesCssAlias: string;
  TooltipTooltipClassNames: string;
  TooltipTooltipAlias: string;
  TooltipTooltipClassNames_2: string;
  SelfStartValue: string;
  TooltipTooltipCss: string;
  OverflowTooltip: ForwardComponent<HTMLSpanElement, OverflowTooltipProps>;
  TooltipTooltipTooltipDisabledReasonTooltipConfig: Pick<
    TooltipImplementation,
    "Tooltip" | "DisabledReasonTooltip"
  >;
  TooltipTooltipContext: React.Context<boolean>;
  cancelRestoredTooltipFocus: (
    input: boolean,
    options: import("@base-ui/react/tooltip").Tooltip.Root.ChangeEventDetails,
  ) => boolean;
  activateTooltip: (input: React.RefObject<TooltipInstantActions>) => void;
  isEmptyTooltipContent: (input: React.ReactNode) => boolean;
  resolveTooltipContent: (
    input: () => React.ReactNode,
  ) => React.ReactNode | EmptyTooltipContent;
  TooltipShortcut: (props: {
    keys?: string | readonly string[];
    className?: string;
  }) => React.ReactElement;
  Tooltip: (props: TooltipProps) => React.ReactElement;
  DisabledReasonTooltip: (props: DisabledTooltipProps) => React.ReactElement;
  TooltipImplProvider: (props: React.PropsWithChildren) => React.ReactElement;
  useTooltipGroup: () => boolean;
  TooltipGroup: (
    props: React.PropsWithChildren<{ delay?: number; closeDelay?: number }>,
  ) => React.ReactElement;
  TooltipDeferredProviderCurrentState: TooltipImplementation | null;
  TooltipDeferredProviderCurrentState_2: Promise<TooltipImplementation> | null;
  TooltipDeferredProviderSubscribers: Set<() => void>;
  TooltipDeferredProviderCurrentState_3: ReturnType<typeof setTimeout> | null;
  TooltipDeferredProviderSubscribers_2: Set<() => void>;
  TooltipDeferredProviderPointermoveKeydownTouchstartValues: string[];
  tooltipPreloadArmed: boolean;
  TooltipDeferredProviderDataCdsTooltipPendingConfig: {
    "data-cds-tooltip-pending": string;
  };
  TooltipDeferredProviderDelayMs: number;
  TooltipDeferredProviderContext: React.Context<DeferredTooltipScope | null>;
  scheduleTooltipHandoff: (input: () => void) => void;
  cancelTooltipHandoff: (input: () => void) => void;
  loadTooltipImplementation: () => Promise<TooltipImplementation>;
  preloadTooltipsAfterInteraction: () => void;
  preloadTooltips: () => void;
  trackDeferredTooltipNode: (
    input: DeferredTooltipNode,
    options: HTMLElement | null,
  ) => void;
  restoreTooltipFocus: (
    input: DeferredTooltipNode,
    element: HTMLElement,
  ) => void;
  cancelTooltipTapHold: (input: DeferredTooltipNode) => void;
  interceptTooltipPointer: (
    input: DeferredTooltipNode,
    options: TooltipPointerEvent,
    context: () => void,
  ) => void;
  getTooltipImplementation: (
    input: DeferredTooltipScope | null,
  ) => TooltipImplementation | null;
  DeferredTooltipProvider: (
    props: React.PropsWithChildren,
  ) => React.ReactElement;
  isPointerFocused: (element: Element) => boolean;
  useDeferredTooltipImplementation: (input: boolean) => DeferredTooltipState;
  disableAutoFocus: (input: React.ReactNode) => React.ReactNode;
  DeferredTooltip: (input: TooltipProps) => React.ReactElement;
  DeferredDisabledReasonTooltip: (
    input: DisabledTooltipProps,
  ) => React.ReactElement;
  scaleCssPixels: (input: number) => string;
  PageBackgroundContext: React.Context<string | undefined>;
  useCdsWindow: () => BrowserWindow | undefined;
  useOverlayRoot: () => HTMLElement | undefined;
  reactSheetsMenuPopup: typeof React;
  SheetPopupContext: React.Context<SheetFrameContext | null>;
  useOpenerReturn: (options?: OpenerReturnOptions) => OpenerReturnState;
  useSheetState: () => { sheet: boolean; pending: boolean };
  registerOpenerReturn: (
    element: Element,
    getter: () => FocusableElement | null,
  ) => void;
  reactSheetsScrollArea: typeof React;
  jsxSheetsScrollArea: typeof import("react/jsx-runtime");
  npm_useVirtualizer_m7e: typeof import("@tanstack/react-virtual").useVirtualizer;
  npm_measureElement_mve: typeof import("@tanstack/virtual-core").measureElement;
  npm_Combobox_Yi: typeof import("@base-ui/react/combobox").Combobox;
  useRootFontSize: () => number;
  SheetsPopupStackSheetConcealedChromeConfig: SheetRenderState;
  SheetsPopupStackConcealedConfig: SheetRenderState;
  SheetStackContext: React.Context<
    { depth: number; parentFrameHeight?: number } | null | undefined
  >;
  useIsSheet: () => boolean;
  isInsideSheetPopup: () => boolean;
  useSheetInteractionMode: () => boolean;
  useAvailableSheetParts: () => MobileSheetParts | null;
  useAppleKeyboard: () => boolean;
  ComponentsIconContext: React.Context<{
    collisionPadding?: CollisionPadding;
  } | null>;
  createInnerOverlayStack: () => InnerOverlayStack;
  InnerOverlaysContext: React.Context<InnerOverlayStack | null>;
  closeInnerOverlayOnEscape: (
    stack: InnerOverlayStack,
    open: boolean,
    details: OverlayChangeDetails,
  ) => boolean;
  useFinalFocus: (
    open: boolean,
    enabled?: boolean,
    trigger?: React.RefObject<HTMLElement | null> | null,
  ) => OpenerReturnState;
  useDialogKeyboardViewport: (
    enabled: boolean | undefined,
  ) => React.RefCallback<HTMLDivElement>;
  npm_Tooltip_Ax: typeof import("@base-ui/react/tooltip").Tooltip;
  useShrinkWrap: (options?: {
    enabled?: boolean;
    immediate?: boolean;
  }) => React.RefCallback<HTMLElement>;
  useButtonGroupOptions: () => ButtonGroupOptions | null;
  useLinkProps: (props: LinkInput) => LinkAttributes;
  omitRouterOptions: <Props extends object>(
    props: Props,
  ) => Omit<Props, keyof RouterEvents>;
  pickRouterOptions: (props: RouterEvents) => RouterEvents;
  useOverlayOpenState: <Details extends OverlayEventDetails>(
    props: OverlayOpenProps<Details>,
  ) => {
    open: boolean;
    onOpenChange: (open: boolean, details: Details) => void;
  };
  useSheetPopup: <Details extends OverlayEventDetails>(
    props: SheetPopupOptions<Details>,
  ) => SheetPopupResult<Details>;
  useMenuInnerOverlay: () => {
    elementRef: React.RefObject<HTMLElement | null>;
    overlayAttrs: { [attribute: `data-${string}`]: string | undefined };
  };
  ComponentsSkeletonAssignValue: React.ComponentType<{
    width?: React.CSSProperties["width"];
    height?: React.CSSProperties["height"];
    className?: string;
    decorative?: boolean;
    as?: "div" | "span";
  }> & {
    Rows: React.ComponentType<{ rows?: number | number[]; icon?: boolean }>;
    Chip: React.ComponentType<{
      width?: React.CSSProperties["width"];
      shape?: "pill" | "rect";
    }>;
    Lines: React.ComponentType<{ lines?: number; className?: string }>;
    Block: React.ComponentType<{
      height?: React.CSSProperties["height"];
      className?: string;
    }>;
  };
}
