import type * as Overlays from "../contracts/overlays";
import type { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import type * as React from "react";
import type {
  ShortcutModifier,
  ShortcutChord,
  ShortcutLabel,
  ShortcutProps,
  BrowserWindow,
  ShrinkWrapMeasurement,
  ShrinkWrapLayout,
  ShrinkWrapJob,
  ShrinkWrapQueue,
  ShrinkWrapResizeStore,
  ShrinkWrapLoadingStore,
  ShrinkWrapRecompute,
  ShrinkWrapSchedule,
  ShrinkWrapOptions,
  CancelableTimeout,
  HotReloadCopyExports,
} from "../contracts/dom";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiAvatars(runtime: RuntimeBindings): () => void {
  var reactShortcut: typeof React;
  var jsxShortcut: typeof import("react/jsx-runtime");
  var shortcutKeycapClasses: string;
  var singleCharacterKeycapClasses: string;
  var multipleCharacterKeycapClasses: string;
  var shortcutTextKeyClasses: string;
  var shortcutVariantClasses: Record<"keycap" | "text", string>;
  var SHORTCUT_SEQUENCE_SEPARATOR: string;
  var SHORTCUT_MODIFIER_SEPARATOR: string;
  var appleKeyboardUserAgentPattern: RegExp;
  var subscribeAppleKeyboardNoop: (listener: () => void) => () => void;
  var shortcutModifierNames: ShortcutModifier[];
  var isShortcutModifier: (input: string) => input is ShortcutModifier;
  var shortcutModifierOrder: ShortcutModifier[];
  var appleModifierLabels: Record<ShortcutModifier, string>;
  var otherModifierLabels: Record<ShortcutModifier, string>;
  var appleKeyLabels: Record<string, string>;
  var otherKeyLabels: Record<string, string>;
  var appleAriaModifierNames: Record<string, string>;
  var otherAriaModifierNames: Record<string, string>;
  var initializeShortcuts: () => void;
  var reactTextOverflow: typeof React;
  var documentTextRanges: WeakMap<Document, Range>;
  var initializeTextClipping: () => void;
  var reactCancelableTimeout: typeof React;
  var initializeCancelableTimeout: () => void;
  var SHRINK_WRAP_STYLE_PROPERTY: "maxWidth";
  var shrinkWrapBaselineWidths: WeakMap<HTMLElement, string>;
  var shrinkWrapWrittenWidths: WeakMap<HTMLElement, string>;
  var SHRINK_WRAP_MAX_ITERATIONS: number;
  var SHRINK_WRAP_ATTRIBUTE: string;
  var SHRINK_WRAP_MAX_LINE_RECTS: number;
  var shrinkWrapAtomicTags: Set<string>;
  var shrinkWrapQueues: WeakMap<Window, ShrinkWrapQueue>;
  var shrinkWrapResizeObservers: WeakMap<BrowserWindow, ShrinkWrapResizeStore>;
  var shrinkWrapWindowResizeStores: WeakMap<
    EventTarget,
    ShrinkWrapLoadingStore
  >;
  var initializeShrinkWrapMeasurement: () => void;
  var reactShrinkWrap: typeof React;
  var jsxShrinkWrap: typeof import("react/jsx-runtime");
  var ShrinkWrap: React.ForwardRefExoticComponent<
    React.ComponentPropsWithoutRef<"div"> &
      ShrinkWrapOptions &
      React.RefAttributes<HTMLDivElement>
  >;
  var initializeShrinkWrap: () => void;
  var buttonBackgroundLayerClasses: string;
  var buttonFocusClasses: string;
  var dangerButtonFocusClasses: string;
  var buttonFillLayerClasses: string;
  var buttonBackgroundShadowClasses: string;
  var buttonJoinedFillClasses: string;
  var buttonPressedFillClasses: string;
  var secondaryButtonFillClasses: string;
  var buttonSolidInsetClasses: string;
  var initializeDisabledReasonDebug: () => void;
  var reactDisabledReason: typeof React;
  var jsxDisabledReason: typeof import("react/jsx-runtime");
  var disabledReasonFocusClasses: string;
  var DISABLED_REASON_ATTRIBUTE: string;
  var initializeDisabledReason: () => void;
  var jsxTooltipClasses: typeof import("react/jsx-runtime");
  var tooltipBaseClasses: string;
  var singleLineTooltipClasses: string;
  var tooltipDetailClasses: string;
  var multilineTooltipBaseClasses: string;
  var multilineTooltipClasses: string;
  var multilineTooltipArrowClass: string;
  var initializeTooltipClasses: () => void;
  var reactTooltipContext: typeof React;
  var tooltipsDisabledContext: React.Context<boolean>;
  var tooltipImplementationContext: React.Context<Overlays.TooltipImplementation | null>;
  var initializeTooltipContext: () => void;
  var tooltipExports: Overlays.TooltipImplementation & {
    useTooltipTrigger(): boolean;
    useTooltipGroup(): boolean;
    OverflowTooltip: React.ComponentType<Overlays.OverflowTooltipProps>;
  };
  var reactTooltip: typeof React;
  var jsxTooltip: typeof import("react/jsx-runtime");
  var activeTooltipActionsRef: React.RefObject<Overlays.TooltipInstantActions> | null;
  var TOOLTIP_NO_SHOW: Overlays.EmptyTooltipContent;
  var closedTooltipState: Overlays.TooltipBodyState;
  var openTooltipState: Overlays.TooltipBodyUpdate;
  var closeTooltipState: Overlays.TooltipBodyUpdate;
  var clearTooltipBody: Overlays.TooltipBodyUpdate;
  var openTooltipWithBody: (
    body: React.ReactNode,
  ) => Overlays.TooltipBodyUpdate;
  var replaceTooltipBody: (body: React.ReactNode) => Overlays.TooltipBodyUpdate;
  var resetTooltipState: Overlays.TooltipBodyUpdate;
  var tooltipSingleLineClasses: string;
  var tooltipTextBalanceClass: string;
  var tooltipSecondaryDetailClasses: string;
  var tooltipContentRowClasses: string;
  var tooltipContentAlignmentClass: string;
  var tooltipMultilineBodyClasses: string;
  var OverflowTooltip: React.ForwardRefExoticComponent<
    Overlays.OverflowTooltipProps & React.RefAttributes<HTMLSpanElement>
  >;
  var defaultTooltipImplementation: Overlays.TooltipImplementation;
  var tooltipProviderContext: React.Context<boolean>;
  var initializeTooltip: () => void;
  var initializeHostSupport: () => void;
  var hotReloadCopyExports: HotReloadCopyExports;
  function getKeycapClasses(input: string | undefined): string {
    return `${shortcutKeycapClasses} ${Array.from(input ?? "").length === 1 ? singleCharacterKeycapClasses : multipleCharacterKeycapClasses}`;
  }
  function Shortcut({
    keys: keys,
    variant = "keycap",
    onFill = false,
    className: className,
    ...props
  }: ShortcutProps): React.ReactElement {
    let value = useAppleKeyboard(),
      value2 = (0, runtime.useTranslation)(
        "sequenceThen",
        SHORTCUT_SEQUENCE_SEPARATOR,
      ),
      value3 = parseShortcutSequence(keys).map((input: string) =>
        renderShortcutChord(input, value),
      ),
      value4 = variant === "text" && !value;
    return (
      <span
        {...props}
        data-cds={"Shortcut"}
        data-variant={variant}
        className={(0, runtime.cn)(
          shortcutVariantClasses[variant],
          onFill && "[--cds-shortcut-cap-ink:currentColor]",
          className,
        )}
      >
        {value3.map((input: ShortcutLabel[], options: number) =>
          (() => {
            const _Element2 = reactShortcut.Fragment;
            const _elementProps2 = {
              children: [
                options > 0 && (
                  <span
                    className={"px-[2px] [color:var(--cds-shortcut-cap-ink)]"}
                  >
                    {value2}
                  </span>
                ),
                input.map(
                  (
                    { label: label, spoken: spoken }: ShortcutLabel,
                    options2: number,
                  ) =>
                    (() => {
                      const _Element = reactShortcut.Fragment;
                      const _elementProps = {
                        children: [
                          value4 && options2 > 0 && (
                            <span
                              className={
                                "mx-[-0.3em] [color:var(--cds-shortcut-cap-ink)]"
                              }
                            >
                              {SHORTCUT_MODIFIER_SEPARATOR}
                            </span>
                          ),
                          <kbd
                            className={
                              variant === "text"
                                ? shortcutTextKeyClasses
                                : getKeycapClasses(label)
                            }
                          >
                            {spoken === undefined ? (
                              label
                            ) : value4 ? (
                              spoken
                            ) : (
                              <jsxShortcut.Fragment>
                                {[
                                  <span aria-hidden={"true"}>{label}</span>,
                                  <span className={"sr-only select-none"}>
                                    {spoken}
                                  </span>,
                                ]}
                              </jsxShortcut.Fragment>
                            )}
                          </kbd>,
                        ],
                      };
                      const _elementKey = options2;
                      return <_Element key={_elementKey} {..._elementProps} />;
                    })(),
                ),
              ],
            };
            const _elementKey2 = options;
            return <_Element2 key={_elementKey2} {..._elementProps2} />;
          })(),
        )}
      </span>
    );
  }
  function useAppleKeyboard(): boolean {
    return reactShortcut.useSyncExternalStore(
      subscribeAppleKeyboardNoop,
      () => appleKeyboardUserAgentPattern.test(navigator.userAgent),
      () => false,
    );
  }
  function ownPropertyValue<Value>(
    input: Readonly<Record<string, Value>>,
    options: string,
  ): Value | undefined {
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
  function parseShortcutChord(
    input: string,
    options: boolean | undefined,
  ): ShortcutChord {
    let value = input
        .toLowerCase()
        .split("+")
        .map((input2: string) => input2.trim())
        .filter((input2: string) => input2 !== ""),
      items: ShortcutModifier[] = [],
      items2: string[] = [];
    for (let value2 of value) {
      if (isShortcutModifier(value2)) {
        items.push(value2);
      } else {
        items2.push(value2);
      }
    }
    let callback = (input2: string) =>
      (shortcutModifierOrder as readonly string[]).indexOf(
        !options &&
          (input2 === "cmd" || input2 === "command" || input2 === "meta")
          ? "ctrl"
          : input2,
      );
    items.sort(
      (input2: ShortcutModifier, options2: ShortcutModifier) =>
        callback(input2) - callback(options2),
    );
    return {
      modifiers: items,
      keys: items2,
    };
  }
  function renderShortcutChord(
    input: string,
    options: boolean,
  ): ShortcutLabel[] {
    let { modifiers: value, keys: value2 } = parseShortcutChord(input, options),
      value3 = options ? appleModifierLabels : otherModifierLabels,
      callback = (input2: string, options2: string) => {
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
      ...value.map((input2: ShortcutModifier) =>
        callback(input2, value3[input2]),
      ),
      ...value2.map((input2: string) =>
        callback(input2, getShortcutKeyLabel(input2, options)),
      ),
    ];
  }
  function shortcutToAriaKeyShortcuts(
    input: string,
    options: boolean,
  ): string | undefined {
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
      callback = (items: string) =>
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
  function isTextRangeClipped(element: HTMLElement): boolean {
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
  function useCancelableTimeout(): CancelableTimeout {
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
  function writeShrinkWrapWidth(input: HTMLElement, options: string): void {
    input.style[SHRINK_WRAP_STYLE_PROPERTY] = options;
    shrinkWrapWrittenWidths.set(input, options);
  }
  function captureShrinkWrapBaseline(input: HTMLElement): void {
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
  ): ShrinkWrapMeasurement {
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
      callback3 = (input: Node) => {
        for (
          let value4 =
            input.nodeType === 1 ? (input as Element) : input.parentElement;
          value4 && value4 !== element;
          value4 = value4.parentElement
        ) {
          if (value4.getAttribute("data-shrinkwrap") === "fill") {
            return true;
          }
        }
        return false;
      },
      value = ownerDocument.createRange(),
      value2 = ownerDocument.createTreeWalker(element, 5, {
        acceptNode: (input: Node) => {
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
        for (let value4 of value.getClientRects?.() ?? []) {
          if (value4.width > 0) {
            callback(value4);
            callback2(value4);
          }
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
          for (let value6 of value4.getClientRects()) {
            if (value6.width > 0) {
              callback(value6);
            }
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
  ): boolean {
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
    }: ShrinkWrapMeasurement,
  ): ShrinkWrapLayout {
    let value = element.ownerDocument.defaultView?.getComputedStyle(element),
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
  ): boolean {
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
  ): boolean {
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
  function restoreShrinkWrapWidth(input: HTMLElement): void {
    if (!shrinkWrapBaselineWidths.has(input)) {
      return;
    }
    captureShrinkWrapBaseline(input);
    writeShrinkWrapWidth(input, shrinkWrapBaselineWidths.get(input) ?? "");
  }
  function createShrinkWrapJob(
    input: HTMLElement,
    options: (width: number | null) => void,
  ): ShrinkWrapJob {
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
  function settleShrinkWrapJob(
    input: ShrinkWrapJob,
    options: number | null,
  ): void {
    if (options === null) {
      restoreShrinkWrapWidth(input.el);
    } else {
      writeShrinkWrapWidth(input.el, `${options}px`);
    }
    input.stage = "settled";
    input.done(options);
  }
  function readShrinkWrapNaturalLayout(input: ShrinkWrapJob): void {
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
      callback2 = (input2: number) => callback(input2) >= value2 - 0.5,
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
      let value2 = input.lo > 0 ? Math.floor((input.lo + input.hi) / 2) : NaN;
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
  function runShrinkWrapJobs(input: ShrinkWrapJob[]): void {
    for (let value2 of input) {
      captureShrinkWrapBaseline(value2.el);
      restoreShrinkWrapWidth(value2.el);
    }
    for (let value2 of input) {
      readShrinkWrapNaturalLayout(value2);
    }
    let value = input.filter((input2) => input2.stage === "verify");
    for (let value2 of value) {
      writeShrinkWrapWidth(value2.el, `${value2.candidate}px`);
    }
    for (let index = 0; value.length > 0 && index < 16; index++) {
      let value2 = value.map((input2): [ShrinkWrapJob, boolean | "shrank"] => [
          input2,
          checkShrinkWrapCandidate(input2),
        ]),
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
      for (let [value3, value4] of items) {
        writeShrinkWrapWidth(value3.el, `${value4}px`);
      }
      value = items.map(([input2]) => input2);
    }
    for (let value2 of value) {
      if (value2.stage !== "settled") {
        settleShrinkWrapJob(value2, null);
      }
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
  function getShrinkWrapQueue(input: Window): ShrinkWrapQueue {
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
    input: Window,
    options: ShrinkWrapQueue,
    items: ShrinkWrapJob[],
  ): void {
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
  function flushShrinkWrapMicrotask(input: Window): void {
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
  function flushShrinkWrapResizeJobs(input: Window): void {
    let entry = shrinkWrapQueues.get(input);
    if (!entry) {
      return;
    }
    let items: ShrinkWrapJob[] = [];
    for (let [value, value2] of entry.queue) {
      if (value2.resizeDue) {
        entry.queue.delete(value);
        items.push(value2);
      }
    }
    drainShrinkWrapQueue(input, entry, items);
  }
  function enqueueShrinkWrapJob(
    element: HTMLElement,
    options: (width: number | null) => void,
    context: ShrinkWrapSchedule,
  ): void {
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
  function cancelShrinkWrapJob(element: HTMLElement): void {
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
  function shouldRecomputeShrinkWrap(input: ShrinkWrapRecompute): boolean {
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
    input: BrowserWindow,
    options: Element,
    context: (entry: ResizeObserverEntry) => void,
  ): void {
    let entry = shrinkWrapResizeObservers.get(input);
    if (!entry) {
      let entries = new Map<
        Element,
        Set<(entry: ResizeObserverEntry) => void>
      >();
      entry = {
        observer: new input.ResizeObserver((input2) => {
          for (let value of input2) {
            for (let value2 of entries.get(value.target) ?? []) {
              value2(value);
            }
          }
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
    input: BrowserWindow,
    options: Element,
    context: (entry: ResizeObserverEntry) => void,
  ): void {
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
    input: BrowserWindow,
    options: Element,
  ): void {
    let entry = shrinkWrapResizeObservers.get(input);
    if (!entry || !entry.handlers.has(options) || entry.paused.has(options)) {
      return;
    }
    entry.observer.unobserve(options);
    entry.paused.add(options);
    if (!entry.resumeQueued) {
      entry.resumeQueued = input.requestAnimationFrame(() => {
        entry.resumeQueued = 0;
        for (let value of entry.paused) {
          if (entry.handlers.has(value)) {
            entry.observer.observe(value);
          }
        }
        entry.paused.clear();
      });
    }
  }
  function subscribeShrinkWrapWindowResize(
    input: EventTarget | undefined,
    options: () => void,
  ): () => void {
    if (typeof input?.addEventListener !== "function") {
      return () => {
        return;
      };
    }
    let entry = shrinkWrapWindowResizeStores.get(input);
    if (!entry) {
      let values = new Set<() => void>(),
        callback = () => {
          for (let value2 of values) {
            value2();
          }
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
    { immediate: options = false }: Pick<ShrinkWrapOptions, "immediate"> = {},
  ): () => void {
    let flag = false,
      value: number | null = null,
      defaultView = element.ownerDocument.defaultView as BrowserWindow | null,
      entries = new Map<
        Element,
        {
          inline: number;
          block: number;
        }
      >(),
      items: Element[] = [],
      callback = (input: Element) => {
        let value4 = input as HTMLElement;
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
        for (let value4 of items) {
          callback(value4);
        }
        if (value2 && index > 0) {
          for (let value4 of items.slice(index)) {
            pauseShrinkWrapResizeObservation(value2, value4);
          }
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
          value5 = value4 ? value4.inlineSize : event.contentRect.width,
          value6 = value4 ? value4.blockSize : event.contentRect.height,
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
            index = Math.max(index, items.indexOf(event.target));
          }
          callback3(value8 ? "frame" : "resize");
        }
      },
      callback5 = (input: Element) => {
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
          for (let value4 of items) {
            unregisterShrinkWrapResizeHandler(value2, value4, callback4);
          }
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
      ) {
        callback5(parentElement);
      }
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
  }: ShrinkWrapOptions = {}): React.RefCallback<HTMLElement> {
    let ref = reactShrinkWrap.useRef<(() => void) | null>(null);
    return reactShrinkWrap.useCallback(
      (input3: HTMLElement | null) => {
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
  function getButtonBackgroundLayerClasses(input: {
    joined?: boolean;
    solid?: boolean;
  }): string {
    return `${buttonBackgroundLayerClasses} ${!input.joined && input.solid ? buttonSolidInsetClasses : "inset-0"} ${input.joined ? "" : buttonBackgroundShadowClasses}`;
  }
  function getDisabledReasonWrapperProps(
    input: React.ReactNode,
    options: string | undefined,
    context: string | undefined,
  ): React.HTMLAttributes<HTMLSpanElement> & {
    "data-cds-disabled-reason-wrapper": string;
  } {
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
  function hasDisabledReason(input: React.ReactNode): boolean {
    return !!input;
  }
  function DisabledReasonAnnouncement({
    id: id,
    reason: reason,
  }: {
    id?: string;
    reason?: React.ReactNode;
  }): React.ReactElement {
    let ref = reactDisabledReason.useRef<HTMLSpanElement | null>(null);
    reactDisabledReason.useEffect(() => {
      return;
    }, [reason]);
    return (
      <span
        ref={ref}
        id={id}
        hidden={true}
        {...{
          [DISABLED_REASON_ATTRIBUTE]: "",
        }}
      >
        {hasDisabledReason(reason) ? reason : null}
      </span>
    );
  }
  function DarkTooltipScope({
    children: children,
  }: React.PropsWithChildren): React.ReactElement {
    return (
      <div className={"cds-dark-scope contents"} data-mode={"dark"}>
        {children}
      </div>
    );
  }
  function useTooltipsDisabled(): boolean {
    return reactTooltipContext.useContext(tooltipsDisabledContext);
  }
  function cancelInputDismissingTooltipOpen(
    input: boolean,
    options: TooltipPrimitive.Root.ChangeEventDetails,
  ): boolean {
    if (
      input &&
      options.reason === "trigger-focus" &&
      (0, runtime.isInputTriggeredBlur)(options.event)
    ) {
      options.cancel();
      return true;
    }
    return false;
  }
  function closePreviousTooltip(
    input: React.RefObject<Overlays.TooltipInstantActions>,
  ): void {
    if (activeTooltipActionsRef !== null && activeTooltipActionsRef !== input) {
      activeTooltipActionsRef.current?.closeInstant();
    }
    activeTooltipActionsRef = input;
  }
  function isEmptyTooltipContent(input: unknown): boolean {
    return (
      input === null ||
      input === undefined ||
      input === "" ||
      typeof input === "boolean" ||
      (Array.isArray(input) && input.every(isEmptyTooltipContent))
    );
  }
  function evaluateTooltipContent(
    input: () => React.ReactNode,
  ): React.ReactNode | Overlays.EmptyTooltipContent {
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
  }: {
    keys: string;
    className?: string;
  }): React.ReactElement {
    return (
      <Shortcut
        keys={keys}
        variant={"text"}
        className={(0, runtime.cn)(
          "text-[calc(0.75rem*var(--cds-rem-scale,1))] [--cds-shortcut-cap-ink:var(--cds-text-muted)]",
          className,
        )}
      />
    );
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
  }: Overlays.TooltipProps): React.ReactElement {
    let value = (0, runtime.usePortalContainer)(),
      value2 = useShrinkWrapRef({
        immediate: true,
      }),
      value3 = reactTooltip.useId(),
      ref = reactTooltip.useRef<TooltipPrimitive.Root.Actions | null>(null),
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
      value12 =
        !value10 && value11 ? (content as React.ReactNode) : value8.body,
      value13 = !isEmptyTooltipContent(value12),
      value14 = (open ?? value8.open) && (!value10 || value13);
    if (!value10 && value11 && value14 && !Object.is(value8.body, content)) {
      value9(replaceTooltipBody(content as React.ReactNode));
    }
    let callback = reactTooltip.useCallback(
        (input: boolean, options: TooltipPrimitive.Root.ChangeEventDetails) => {
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
    let callback2 = reactTooltip.useCallback((input: boolean) => {
      if (!input) {
        value5(false);
        value7(null);
        value9(clearTooltipBody);
      }
    }, []);
    reactTooltip.useEffect(() => {
      if (!value6) {
        return;
      }
      let ownerDocument = value6.ownerDocument,
        callback5 = (event: Event) => {
          let target = event.target as Node | null;
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
      [value17] = reactTooltip.useState(() =>
        lazy && open === undefined ? runtime.baseTooltip.createHandle() : null,
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
    let value22 = (0, runtime.useOptionalEventCallback)(() => {
        if (ref3.current || value20 || !value11 || open !== undefined) {
          return;
        }
        let value29: React.ReactNode;
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
      }),
      value23 = (0, runtime.useOptionalEventCallback)(
        (input: React.PointerEvent<HTMLElement>) => {
          if (value20 || input.pointerType === "touch") {
            return;
          }
          if (!value11) {
            return;
          }
          ref4.current = input.currentTarget;
          value21.start(delay, value22);
        },
      ),
      value24 = (0, runtime.useOptionalEventCallback)(() => {
        if (closeOnClick !== false) {
          value21.cancel();
        }
      }),
      value25 = (0, runtime.useOptionalEventCallback)(
        (event: React.FocusEvent<HTMLElement>) => {
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
          value22();
        },
      );
    if (value17 !== null && open === true && !value18) {
      value19(true);
    }
    let callback4 = reactTooltip.useCallback(
        (input: boolean, options: TooltipPrimitive.Root.ChangeEventDetails) => {
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
          : (input: React.HTMLAttributes<HTMLSpanElement>) => (
              <span {...input} className={"inline-flex"}>
                {children}
              </span>
            ),
      value27 = (
        <runtime.baseTooltip.Trigger
          ref={triggerRef as React.Ref<HTMLButtonElement>}
          id={value3}
          delay={delay}
          closeDelay={closeDelay}
          closeOnClick={closeOnClick}
          handle={value17 ?? undefined}
          disabled={value17 !== null && !value20 ? !value11 : undefined}
          onPointerEnter={value17 ? value23 : undefined}
          onPointerLeave={value17 ? value21.cancel : undefined}
          onPointerDown={value17 ? value24 : undefined}
          onFocus={value17 ? value25 : undefined}
          render={value26}
        />
      ),
      value28 =
        value20 && value13 ? (
          <runtime.baseTooltip.Portal container={(container ?? value) as import("../contracts/overlays").BaseUIPortalContainer}>
            <runtime.PortalRoot>
              <runtime.CollisionPaddingProvider
                override={collisionPadding}
                container={container ?? value}
              >
                {(input: Overlays.CollisionPadding) => (
                  <runtime.layerBaseContext.Provider value={value16.base}>
                    <runtime.baseTooltip.Positioner
                      data-cds={"Tooltip"}
                      className={"data-[anchor-hidden]:invisible"}
                      style={value16.style}
                      side={side}
                      align={align}
                      sideOffset={sideOffset}
                      collisionPadding={input}
                    >
                      <runtime.baseTooltip.Popup
                        ref={value2}
                        role={"tooltip"}
                        style={
                          value4
                            ? {
                                transition: "none",
                              }
                            : undefined
                        }
                        className={(0, runtime.cn)(
                          tooltipSingleLineClasses,
                          tooltipSecondaryDetailClasses,
                          multiline || detail || secondaryHint
                            ? tooltipMultilineBodyClasses
                            : tooltipContentRowClasses,
                          !shortcut && tooltipTextBalanceClass,
                          className,
                        )}
                      >
                        <DarkTooltipScope>
                          {multiline || detail || secondaryHint ? (
                            <jsxTooltip.Fragment>
                              {[
                                <span
                                  className={
                                    "inline-flex min-w-0 items-center gap-2"
                                  }
                                >
                                  {[
                                    <span
                                      className={multilineTooltipArrowClass}
                                    >
                                      {value12}
                                    </span>,
                                    shortcut && (
                                      <TooltipShortcut keys={shortcut} />
                                    ),
                                  ]}
                                </span>,
                                secondaryHint && (
                                  <span
                                    className={
                                      "inline-flex min-w-0 items-center gap-2"
                                    }
                                  >
                                    {[
                                      <span className={"min-w-0 break-words"}>
                                        {secondaryHint.label}
                                      </span>,
                                      <TooltipShortcut
                                        keys={secondaryHint.shortcut}
                                      />,
                                    ]}
                                  </span>
                                ),
                                detail && (
                                  <span
                                    className={
                                      "break-words text-[calc(0.6875rem*var(--cds-rem-scale,1))]/[calc(0.875rem*var(--cds-rem-scale,1))] text-secondary"
                                    }
                                  >
                                    {detail}
                                  </span>
                                ),
                              ]}
                            </jsxTooltip.Fragment>
                          ) : (
                            <jsxTooltip.Fragment>
                              {[
                                <span className={multilineTooltipArrowClass}>
                                  {value12}
                                </span>,
                                shortcut && (
                                  <TooltipShortcut
                                    keys={shortcut}
                                    className={tooltipContentAlignmentClass}
                                  />
                                ),
                              ]}
                            </jsxTooltip.Fragment>
                          )}
                        </DarkTooltipScope>
                      </runtime.baseTooltip.Popup>
                    </runtime.baseTooltip.Positioner>
                  </runtime.layerBaseContext.Provider>
                )}
              </runtime.CollisionPaddingProvider>
            </runtime.PortalRoot>
          </runtime.baseTooltip.Portal>
        ) : null;
    if (value17) {
      return (
        <jsxTooltip.Fragment>
          {[
            <tooltipImplementationContext.Provider
              value={defaultTooltipImplementation}
            >
              <tooltipsDisabledContext.Provider value={value11}>
                {value27}
              </tooltipsDisabledContext.Provider>
            </tooltipImplementationContext.Provider>,
            value20 && (
              <runtime.baseTooltip.Root
                handle={value17}
                open={value14}
                disableHoverablePopup={!hoverable}
                trackCursorAxis={trackCursorAxis}
                disabled={!value11}
                actionsRef={ref}
                onOpenChange={callback4}
                onOpenChangeComplete={callback2}
                triggerId={value3}
              >
                {value28}
              </runtime.baseTooltip.Root>
            ),
          ]}
        </jsxTooltip.Fragment>
      );
    }
    return (
      <runtime.baseTooltip.Root
        open={value14}
        disableHoverablePopup={!hoverable}
        trackCursorAxis={trackCursorAxis}
        disabled={!value11}
        actionsRef={ref}
        onOpenChange={callback}
        onOpenChangeComplete={callback2}
        triggerId={value3}
      >
        {[
          <tooltipImplementationContext.Provider
            value={defaultTooltipImplementation}
          >
            <tooltipsDisabledContext.Provider value={value11}>
              {value27}
            </tooltipsDisabledContext.Provider>
          </tooltipImplementationContext.Provider>,
          value28,
        ]}
      </runtime.baseTooltip.Root>
    );
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
  }: Overlays.DisabledTooltipProps): React.ReactElement {
    let value = reactTooltip.useId();
    return (
      <Tooltip
        content={hasDisabledReason(reason) ? reason : undefined}
        side={side}
        align={align}
        sideOffset={sideOffset}
        multiline={multiline}
        delay={delay}
        collisionPadding={collisionPadding}
        hoverable={hoverable}
        className={className}
        closeOnClick={false}
        openOnHandedBackFocus={true}
      >
        <span
          {...getDisabledReasonWrapperProps(reason, value, wrapperClassName)}
        >
          {[
            children,
            <DisabledReasonAnnouncement id={value} reason={reason} />,
          ]}
        </span>
      </Tooltip>
    );
  }
  function TooltipImplementationProvider({
    children: children,
  }: React.PropsWithChildren): React.ReactElement {
    return (
      <tooltipImplementationContext.Provider
        value={defaultTooltipImplementation}
      >
        {children}
      </tooltipImplementationContext.Provider>
    );
  }
  function useHasTooltipProvider(): boolean {
    return reactTooltip.useContext(tooltipProviderContext);
  }
  function TooltipProvider({
    delay = 600,
    closeDelay = 200,
    children: children,
  }: React.PropsWithChildren<{
    delay?: number;
    closeDelay?: number;
  }>): React.ReactElement {
    return (
      <tooltipProviderContext.Provider value={true}>
        <runtime.baseTooltip.Provider delay={delay} closeDelay={closeDelay}>
          {children}
        </runtime.baseTooltip.Provider>
      </tooltipProviderContext.Provider>
    );
  }
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
    "reactTextOverflow",
    () => reactTextOverflow,
    (value) => {
      reactTextOverflow = value;
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
  bindRuntimeValue<"TOOLTIP_NO_SHOW", Overlays.EmptyTooltipContent>(
    runtime,
    "TOOLTIP_NO_SHOW",
    () => TOOLTIP_NO_SHOW,
    (value) => {
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
  bindRuntimeValue(
    runtime,
    "initializeHostSupport",
    () => initializeHostSupport,
    (value) => {
      initializeHostSupport = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hotReloadCopyExports",
    () => hotReloadCopyExports,
    (value) => {
      hotReloadCopyExports = value;
    },
  );
  return () => {
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
      (shortcutModifierNames as readonly string[]).includes(input);
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
      reactTextOverflow = (0, runtime.toModuleNamespace)(
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
    initializeShrinkWrapMeasurement = (0, runtime.initializeOnce)(() => {
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
    });
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
      ShrinkWrap = reactShrinkWrap.forwardRef(
        (
          {
            enabled = true,
            immediate = false,
            children: children,
            ...props
          }: React.ComponentPropsWithoutRef<"div"> & ShrinkWrapOptions,
          options: React.ForwardedRef<HTMLDivElement>,
        ): React.ReactElement => {
          let value = useShrinkWrapRef({
              enabled: enabled,
              immediate: immediate,
            }),
            value2 = (0, runtime.useMergedRefs)(options, value);
          return (
            <div ref={value2} data-cds={"ShrinkWrap"} {...props}>
              {children}
            </div>
          );
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
      tooltipImplementationContext =
        reactTooltipContext.createContext<Overlays.TooltipImplementation | null>(
          null,
        );
    });
    tooltipExports = {} as typeof tooltipExports;
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
    openTooltipWithBody = (input) => (input2) =>
      input2.open && Object.is(input2.body, input)
        ? input2
        : {
            open: true,
            body: input,
          };
    replaceTooltipBody = (input) => (input2) =>
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
      TOOLTIP_NO_SHOW = Symbol(
        "cds.Tooltip.noShow",
      ) as Overlays.EmptyTooltipContent;
      closedTooltipState = {
        open: false,
        body: undefined,
      };
      tooltipSingleLineClasses = singleLineTooltipClasses;
      tooltipSecondaryDetailClasses = tooltipDetailClasses;
      tooltipMultilineBodyClasses = `flex flex-col gap-0.5 ${multilineTooltipClasses}`;
      OverflowTooltip = reactTooltip.forwardRef(function (
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
        }: Overlays.OverflowTooltipProps,
        options: React.ForwardedRef<HTMLSpanElement>,
      ): React.ReactElement {
        let ref = reactTooltip.useRef<HTMLSpanElement | null>(null),
          value = (0, runtime.useMergedRefs)(ref, options),
          value2 = useTooltipsDisabled();
        return (
          <Tooltip
            content={
              value2
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
                  }
            }
            side={side}
            align={align}
            sideOffset={sideOffset}
            delay={delay}
            collisionPadding={collisionPadding}
            hoverable={hoverable}
            lazy={lazy}
          >
            <span
              {...props}
              ref={value}
              data-cds={"OverflowTooltip"}
              className={(0, runtime.cn)(
                "block min-w-0 overflow-x-clip text-ellipsis whitespace-nowrap",
                className,
              )}
            >
              {children}
            </span>
          </Tooltip>
        );
      });
      OverflowTooltip.displayName = "OverflowTooltip";
      defaultTooltipImplementation = {
        Tooltip: Tooltip,
        DisabledReasonTooltip: DisabledReasonTooltip,
      };
      tooltipProviderContext = reactTooltip.createContext(false);
    });
    initializeHostSupport = () => {};
    hotReloadCopyExports = {} as HotReloadCopyExports;
    (0, runtime.defineLiveExports)(hotReloadCopyExports, {
      unpublishableWords: (): HotReloadCopyExports["unpublishableWords"] =>
        runtime.unpublishableMigrationFilesMessage,
      keptWords: (): HotReloadCopyExports["keptWords"] =>
        runtime.storeFoldKeptFilesMessage,
      downloadsRefusedWords:
        (): HotReloadCopyExports["downloadsRefusedWords"] =>
          runtime.temporarilyUnsavableMigrationFilesMessage,
      STRAY_INDEX_NOTICE: (): string =>
        runtime.IGNORED_LEGACY_ROOT_FILE_MESSAGE,
      STORE_WRITTEN_NOTICE: (): string =>
        runtime.UNREAD_LEGACY_STORE_CHANGES_MESSAGE,
      REOPENED_VIEW_ONLY_MESSAGE: (): string =>
        runtime.DESIGN_SYSTEM_REOPENED_MESSAGE,
      REOPENED_MESSAGE: (): string =>
        runtime.EDITABLE_DESIGN_SYSTEM_REOPENED_MESSAGE,
      RELOAD_YOURSELF_NOTICE: (): string => runtime.DEFAULT_RELOAD_MESSAGE,
      NOT_REOPENED_SPOKEN: (): string => runtime.MIGRATION_UNCHANGED_MESSAGE,
      NOT_REOPENED_NOTICE: (): string =>
        runtime.MIGRATION_REOPEN_UNAVAILABLE_MESSAGE,
      NOT_MOVED_REOPEN_MESSAGE: (): string =>
        runtime.MIGRATION_STOPPED_REOPEN_MESSAGE,
      NOT_MOVED_RELOAD_NOTICE: (): string =>
        runtime.MIGRATION_STOPPED_RELOAD_MESSAGE,
      NOT_MOVED_INTERRUPTED_NOTICE: (): string =>
        runtime.MIGRATION_INTERRUPTED_MESSAGE,
      MOVE_WAIT_OVER_MESSAGE: (): string =>
        runtime.MIGRATION_OTHER_TAB_TIMEOUT_MESSAGE,
      MOVE_STOPPED_NOTICE: (): string =>
        runtime.MIGRATION_UNREADABLE_FILE_MESSAGE,
      MOVE_ENDED_REOPEN_MESSAGE: (): string =>
        runtime.MIGRATION_ENDED_REOPEN_MESSAGE,
      MOVED_REOPEN_MESSAGE: (): string => runtime.MIGRATION_DONE_REOPEN_MESSAGE,
      FOLDED_NOTICE: (): string => runtime.EXTERNAL_CHANGES_FOLDED_MESSAGE,
      ABOUT_TO_MOVE_MESSAGE: (): string =>
        runtime.MIGRATION_STARTING_REOPEN_MESSAGE,
    });
  };
}
