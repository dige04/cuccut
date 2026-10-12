/** Restored application module; prepare first, initialize in original order. */
import type {
  FocusEvent as ReactFocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  ReactNode,
  Ref,
} from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";

/** Modifier keys that scale a step: Alt makes it small, Shift makes it large. */
export interface StepModifierKeys {
  altKey: boolean;
  shiftKey: boolean;
}
/** Bounds and step of a keyboard-stepped number. */
export interface NumberStepOptions {
  step?: number;
  min?: number;
  max?: number;
}
/** Options of a scrub gesture (dragging sideways to change a number). */
export interface NumberScrubOptions extends NumberStepOptions {
  /** Current value; scrubbing starts from it. */
  value: number;
  /** Value that snapped steps are counted from. */
  origin?: number | null;
  disabled?: boolean;
  onScrub: (value: number) => void;
  onScrubEnd?: () => void;
  /** Called with `true` at the first movement and `false` at the end. */
  onScrubbing?: (scrubbing: boolean) => void;
}
/** One drag, driven by pointer movements. */
export interface NumberScrubGesture {
  /** Moves to `clientX`; `fine` (Shift) makes the steps ten times larger. */
  move(clientX: number, fine?: boolean): void;
  /** Ends the gesture. */
  up(): void;
  /** Whether the pointer has moved since the gesture started. */
  readonly live: boolean;
}
/** The scrub preview shown while dragging. */
interface NumberScrubPreview {
  from: number | undefined;
  v: number;
  hostMoved: boolean;
}
/** Keyboard event of a Base UI number field. */
type NumberFieldKeyboardEvent = ReactKeyboardEvent<HTMLInputElement> & {
  /** Stops Base UI from handling the key itself. */
  preventBaseUIHandler?: () => void;
};
export interface PropertyNumberInputProps extends NumberStepOptions {
  /** `undefined` when the field is empty. */
  value?: number;
  /** Called with `undefined` when a clearable field is emptied. */
  onValue: (value: number | undefined) => void;
  onScrub?: (value: number) => void;
  onScrubEnd?: () => void;
  prefix?: ReactNode;
  unit?: ReactNode;
  /** Whether dragging the unit scrubs the value. */
  unitScrubs?: boolean;
  /** Refuses typed letters that are not the unit. */
  refuseLetters?: boolean;
  ownUnit?: string;
  scrubOrigin?: number | null;
  smallStep?: number;
  /** Where the arrow keys start from in an empty field; `null` disables it. */
  emptyStepFrom?: number | null;
  placeholder?: string;
  hint?: string;
  clearable?: boolean;
  /** Shows the mixed state of a multiple selection. */
  mixed?: boolean;
  steppers?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  title?: string;
  "aria-label"?: string;
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactForUiNumberControls: ReactNamespace;
    reactForUiNumberControls2: ReactNamespace;
    jsxForUiNumberControls: JsxNamespace;
    decimalPlaces: (value: number) => number;
    roundScrubValue: (value: number, step: number) => number;
    scrubPrecision: (step: number) => number;
    snapScrubValue: (
      value: number,
      step: number,
      origin?: number | null,
    ) => number;
    steppedNumberValue: (
      value: number,
      direction: number,
      event: StepModifierKeys,
      options?: NumberStepOptions,
    ) => number;
    initializeNumberScrubNoop: () => void;
    createNumberScrubGesture: (
      getOptions: () => NumberScrubOptions,
      startX: number,
    ) => NumberScrubGesture;
    useNumberScrubGesture: (
      options: NumberScrubOptions,
    ) => (event: ReactMouseEvent<HTMLElement>) => void;
    captureNumberScrubPointer: (event: ReactPointerEvent<HTMLElement>) => void;
    attachNumberScrubGesture: (
      gesture: NumberScrubGesture,
      ownWindow?: Window,
    ) => () => void;
    activeNumberScrubCleanup: (() => void) | null;
    initializeUiNumberControls: () => void;
    numberInputDecimalPlaces: (value: number) => number;
    PropertyNumberInput: (props: PropertyNumberInputProps) => ReactElement;
    PROPERTY_NUMBER_FORMAT_OPTIONS: Intl.NumberFormatOptions;
    propertyNumberFormatter: Intl.NumberFormat;
    PROPERTY_NUMBER_UNIT_CLASS: string;
    PROPERTY_NUMBER_INPUT_CLASS: string;
    PROPERTY_NUMBER_STEPPER_CLASS: string;
    initializeUiNumberControls2: () => void;
  }
}

export function installUiNumberControls(runtime: RuntimeBindings): () => void {
  var initializeNumberScrubNoop: () => void;
  var reactForUiNumberControls: ReactNamespace;
  var activeNumberScrubCleanup: (() => void) | null;
  var initializeUiNumberControls: () => void;
  var reactForUiNumberControls2: ReactNamespace;
  var jsxForUiNumberControls: JsxNamespace;
  var PROPERTY_NUMBER_FORMAT_OPTIONS: Intl.NumberFormatOptions;
  var propertyNumberFormatter: Intl.NumberFormat;
  var PROPERTY_NUMBER_UNIT_CLASS: string;
  var PROPERTY_NUMBER_INPUT_CLASS: string;
  var PROPERTY_NUMBER_STEPPER_CLASS: string;
  var initializeUiNumberControls2: () => void;
  function decimalPlaces(value: number): number {
    let value2 = String(value),
      value3 = value2.indexOf(".");
    if (value3 === -1 || value2.includes("e")) {
      return 0;
    } else {
      return value2.length - value3 - 1;
    }
  }
  function roundScrubValue(value: number, step: number): number {
    let value2 = 10 ** scrubPrecision(step);
    return Math.round(value * value2) / value2;
  }
  function scrubPrecision(step: number): number {
    return Math.max(
      2,
      decimalPlaces(step),
      Math.ceil(-Math.log10(Math.max(step, Number.EPSILON))),
    );
  }
  function snapScrubValue(
    value: number,
    step: number,
    origin?: number | null,
  ): number {
    if (!(step > 0) || !Number.isFinite(step) || !Number.isFinite(value)) {
      return value + 0;
    }
    let value2 = origin == null && Number.isInteger(step) ? 1 : step,
      value3 = origin ?? 0,
      value4 = (value - value3) / value2,
      value5 = Math.round(Number(value4.toPrecision(12))),
      value6 =
        10 ** Math.max(scrubPrecision(value2), decimalPlaces(value3)),
      value7 =
        Math.round((value5 * value2 + value3) * value6) / value6 + 0;
    if (Math.abs(value4) < 1000000000000 && Number.isFinite(value7)) {
      return value7;
    }
    let value8 = roundScrubValue(value, step) + 0;
    if (Number.isFinite(value8)) {
      return value8;
    } else {
      return value + 0;
    }
  }
  function steppedNumberValue(
    value: number,
    direction: number,
    event: StepModifierKeys,
    options: NumberStepOptions = {},
  ): number {
    let value2 = options.step ?? 1,
      value3 = Math.min(0.1, value2),
      value4 = event.altKey
        ? value3
        : value2 * (event.shiftKey ? 10 : 1),
      value5 = roundScrubValue(value + direction * value4, value2);
    if (options.min != null) {
      value5 = Math.max(options.min, value5);
    }
    if (options.max != null) {
      value5 = Math.min(options.max, value5);
    }
    return value5;
  }
  function createNumberScrubGesture(
    getOptions: () => NumberScrubOptions,
    startX: number,
  ): NumberScrubGesture {
    let value = startX,
      value2: number | null = null,
      flag = false;
    return {
      move(input: number, options?: boolean) {
        let value3 = getOptions(),
          value4 = input - value;
        value = input;
        if (!flag) {
          if (value4 === 0) {
            return;
          }
          flag = true;
          value3.onScrubbing?.(true);
        }
        if (value2 == null) {
          value2 = Number.isFinite(value3.value) ? value3.value : 0;
        }
        let value5 = value3.step ?? 1,
          callback = (input2: number) =>
            Math.min(
              value3.max ?? 1 / 0,
              Math.max(value3.min ?? -1 / 0, input2),
            );
        value2 = callback(value2 + value4 * value5 * (options ? 10 : 1));
        let value6 =
          value2 === value3.min || value2 === value3.max
            ? value2
            : callback(snapScrubValue(value2, value5, value3.origin));
        value3.onScrub(value6 + 0);
      },
      up() {
        if (!flag) {
          return;
        }
        let value3 = getOptions();
        value3.onScrubbing?.(false);
        value3.onScrubEnd?.();
      },
      get live() {
        return flag;
      },
    };
  }
  function useNumberScrubGesture(
    options: NumberScrubOptions,
  ): (event: ReactMouseEvent<HTMLElement>) => void {
    let ref = reactForUiNumberControls.useRef(options);
    ref.current = options;
    let ref2 = reactForUiNumberControls.useRef<(() => void) | null>(null);
    reactForUiNumberControls.useEffect(
      () => () => {
        if (ref2.current && ref2.current === activeNumberScrubCleanup) {
          ref2.current();
        }
      },
      [],
    );
    return (event: ReactMouseEvent<HTMLElement>) => {
      if (ref.current.disabled) {
        return;
      }
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      let activeElement = document.activeElement as HTMLElement | null;
      if (
        activeElement &&
        activeElement !== event.currentTarget &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA")
      ) {
        activeElement.blur?.();
      }
      ref2.current = attachNumberScrubGesture(
        createNumberScrubGesture(() => ref.current, event.clientX),
      );
    };
  }
  function captureNumberScrubPointer(
    event: ReactPointerEvent<HTMLElement>,
  ): void {
    if (event.button !== 0 || event.pointerType === "touch") {
      return;
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {}
  }
  function attachNumberScrubGesture(
    gesture: NumberScrubGesture,
    ownWindow: Window = window,
  ): () => void {
    activeNumberScrubCleanup?.();
    let callback = (input: MouseEvent) => {
        let value = input;
        if (value.buttons === 0) {
          callback3();
          return;
        }
        gesture.move(value.clientX, value.shiftKey);
      },
      callback2 = (event: KeyboardEvent) => {
        if (event.key !== "Escape") {
          return;
        }
        if (gesture.live) {
          event.preventDefault();
        }
        callback3();
      },
      callback3 = () => {
        if (activeNumberScrubCleanup === callback3) {
          activeNumberScrubCleanup = null;
        }
        ownWindow.removeEventListener("mousemove", callback);
        ownWindow.removeEventListener("mouseup", callback3);
        ownWindow.removeEventListener("blur", callback3);
        ownWindow.removeEventListener("keydown", callback2, true);
        gesture.up();
      };
    activeNumberScrubCleanup = callback3;
    ownWindow.addEventListener("mousemove", callback);
    ownWindow.addEventListener("mouseup", callback3);
    ownWindow.addEventListener("blur", callback3);
    ownWindow.addEventListener("keydown", callback2, true);
    return callback3;
  }
  function numberInputDecimalPlaces(value: number): number {
    let value2 = String(value),
      value3 = value2.indexOf(".");
    if (value3 === -1 || value2.includes("e")) {
      return 0;
    } else {
      return value2.length - value3 - 1;
    }
  }
  function PropertyNumberInput({
    value: value,
    onValue: onValue,
    onScrub: onScrub,
    onScrubEnd: onScrubEnd,
    prefix: prefix,
    unit: unit,
    unitScrubs = true,
    refuseLetters = false,
    ownUnit = typeof unit === "string" ? unit : undefined,
    min: min,
    max: max,
    step: step,
    scrubOrigin: scrubOrigin,
    smallStep: smallStep,
    emptyStepFrom: emptyStepFrom,
    placeholder: placeholder,
    hint: hint,
    clearable: clearable,
    mixed = false,
    steppers = true,
    fullWidth = true,
    disabled: disabled,
    title: title,
    "aria-label": ariaLabel,
    inputRef: inputRef,
    className: className,
  }: PropertyNumberInputProps): ReactElement {
    let ref = reactForUiNumberControls2.useRef<HTMLInputElement>(null),
      callback = reactForUiNumberControls2.useCallback(
        (input: HTMLInputElement | null) => {
          ref.current = input;
          if (typeof inputRef === "function") {
            inputRef(input);
          } else if (inputRef) {
            inputRef.current = input;
          }
        },
        [inputRef],
      ),
      value2 =
        unit !== undefined && unit !== null && unit !== false && unit !== "",
      value3 =
        value === undefined &&
        !mixed &&
        emptyStepFrom !== null &&
        placeholder !== undefined &&
        /^-?\d+(\.\d+)?$/.test(placeholder)
          ? Number(placeholder)
          : undefined,
      value4 = value ?? value3,
      ref2 = reactForUiNumberControls2.useRef(false),
      ref3 = reactForUiNumberControls2.useRef(false),
      ref4 = reactForUiNumberControls2.useRef(false),
      ref5 = reactForUiNumberControls2.useRef(""),
      ref6 = reactForUiNumberControls2.useRef(false),
      callback2 = () => {
        let value14 = ref5.current.toLowerCase();
        ref5.current = "";
        if (
          !refuseLetters ||
          !value14 ||
          value14 === (ownUnit ?? "").toLowerCase()
        ) {
          return false;
        }
        if (ref4.current) {
          ref6.current = true;
        }
        return true;
      },
      value5 = step ?? 1,
      value6 = smallStep ?? Math.min(0.1, value5),
      value7 =
        ariaLabel ||
        (typeof prefix === "string" && prefix !== "" ? prefix : undefined),
      callback3 = (input: number | null) => {
        if (ref2.current) {
          return;
        }
        if (callback2()) {
          (0, runtime.announceLiveMessage)(
            (0, runtime.numberChangeRefusalMessage)(value7, ownUnit),
          );
          return;
        }
        if (input === null) {
          if (
            clearable &&
            !mixed &&
            value !== undefined &&
            !(ref4.current && emptyStepFrom !== undefined)
          ) {
            onValue(undefined);
          }
          return;
        }
        if (value === undefined && min !== undefined) {
          input = Math.max(min, input);
        }
        if (value === undefined && max !== undefined) {
          input = Math.min(max, input);
        }
        if (mixed || input !== value) {
          onValue(input);
        }
      },
      callback4 = (event: NumberFieldKeyboardEvent) => {
        ref3.current = false;
        ref6.current = false;
        if (!event.metaKey && !event.ctrlKey) {
          if (/^[a-zA-Z%]$/.test(event.key)) {
            ref5.current += event.key;
          } else if (/^[0-9.\-]$/.test(event.key)) {
            ref5.current = "";
          }
        }
        if (event.key === "Enter") {
          event.preventDefault();
          let current = ref.current;
          current?.blur();
          current?.focus();
          current?.select();
          ref3.current = true;
          queueMicrotask(() => {
            if (!ref3.current || !current) {
              return;
            }
            ref3.current = false;
            if (current.ownerDocument.activeElement === current) {
              current.select();
            }
          });
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          ref5.current = "";
          ref2.current = true;
          ref.current?.blur();
          ref2.current = false;
          return;
        }
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          if (
            emptyStepFrom !== undefined &&
            (ref.current?.value ?? "").trim() === ""
          ) {
            let preventBaseUIHandler = event.preventBaseUIHandler;
            if (preventBaseUIHandler) {
              preventBaseUIHandler.call(event);
            }
            event.preventDefault();
            event.stopPropagation();
            callback7(event.key === "ArrowUp" ? 1 : -1, event);
          }
          let current = ref.current;
          ref3.current = true;
          setTimeout(() => {
            if (!ref3.current || !current) {
              return;
            }
            ref3.current = false;
            if (current.ownerDocument.activeElement === current) {
              current.select();
            }
          }, 0);
          return;
        }
        if (event.key === "Home" || event.key === "End") {
          let preventBaseUIHandler = event.preventBaseUIHandler;
          if (preventBaseUIHandler) {
            preventBaseUIHandler.call(event);
          } else {
            event.preventDefault();
          }
          event.stopPropagation();
          return;
        }
        event.stopPropagation();
      },
      value8 =
        value ??
        (typeof emptyStepFrom === "number" && Number.isFinite(emptyStepFrom)
          ? emptyStepFrom
          : onScrub
            ? value3
            : undefined),
      value9 = !disabled && !mixed && value8 !== undefined,
      [value10, value11] =
        reactForUiNumberControls2.useState<NumberScrubPreview | null>(null),
      value12 = useNumberScrubGesture({
        value: value8 ?? NaN,
        step: step,
        min: min,
        max: max,
        origin: scrubOrigin,
        disabled: !value9,
        onScrub: (input: number) => {
          value11(
            (input2: NumberScrubPreview | null) => ({
              from: input2 ? input2.from : value,
              v: input,
              hostMoved:
                !!input2 &&
                (input2.hostMoved || !Object.is(value, input2.from)),
            }),
          );
          (onScrub ?? onValue)(input);
        },
        onScrubEnd: () => {
          value11(null);
          onScrubEnd?.();
        },
      }),
      callback5 = (input: ReactMouseEvent<HTMLElement>) => {
        value12(input);
        input.stopPropagation();
      },
      callback6 = () => {
        let current = ref.current;
        if (!current) {
          return;
        }
        ref6.current = false;
        if (current.ownerDocument.activeElement === current) {
          ref4.current = true;
          try {
            current.blur();
          } finally {
            ref4.current = false;
          }
        }
        current.focus({
          preventScroll: true,
        });
      },
      callback7 = (input: number, options: StepModifierKeys) => {
        let value14 =
            value4 === undefined || mixed
              ? ""
              : propertyNumberFormatter.format(value4),
          callback8 = () => {
            if (!ref6.current) {
              return false;
            }
            ref6.current = false;
            ref5.current = "";
            return true;
          };
        if (callback8()) {
          return;
        }
        let current = ref.current;
        if (
          current &&
          current.ownerDocument.activeElement === current &&
          current.value !== value14
        ) {
          callback6();
        }
        if (callback8()) {
          return;
        }
        ref5.current = "";
        let value15 = ref.current?.value ?? "",
          value16 =
            value15 !== value14 ? Number.parseFloat(value15) : Number.NaN,
          value17 = mixed || value15.trim() === "";
        if (value17 && !Number.isFinite(value16) && emptyStepFrom === null) {
          return;
        }
        let value18 = Number.isFinite(value16)
            ? value16
            : value17
              ? (emptyStepFrom ?? min ?? 0)
              : (value4 ?? 0),
          value19 = options.altKey
            ? value6
            : value5 * (options.shiftKey ? 10 : 1),
          value20 = Math.min(
            20,
            Math.max(
              numberInputDecimalPlaces(value18),
              numberInputDecimalPlaces(value5),
              options.altKey ? numberInputDecimalPlaces(value6) : 0,
            ),
          ),
          value21 = Number(
            (value18 + input * value19).toFixed(value20),
          );
        if (min !== undefined) {
          value21 = Math.max(min, value21);
        }
        if (max !== undefined) {
          value21 = Math.min(max, value21);
        }
        if (mixed || value21 !== value4) {
          onValue(value21);
        }
      },
      state = {
        ref: callback,
        value: mixed
          ? null
          : ((value10 && !value10.hostMoved && Object.is(value10.from, value)
              ? value10.v
              : value4) ?? null),
        onValueCommitted: callback3,
        min: min,
        max: max,
        step: value5,
        largeStep: value5 * 10,
        smallStep: value6,
        format: PROPERTY_NUMBER_FORMAT_OPTIONS,
        locale: "en-US",
        inputMode: "decimal",
        "aria-label": value7,
        disabled: disabled,
        placeholder: mixed ? runtime.MIXED_LABEL : (placeholder ?? hint),
        onKeyDown: callback4,
        onFocus: (event: ReactFocusEvent<HTMLInputElement>) => {
          event.preventDefault();
          event.currentTarget.select();
          ref5.current = "";
        },
      },
      value13 = steppers;
    return jsxForUiNumberControls.jsx(runtime.NumberInput, {
      ...state,
      title: title,
      fullWidth: fullWidth,
      className: (0, runtime.joinClassNames)(
        "group/field min-w-12",
        !mixed &&
          value3 === undefined &&
          placeholder !== undefined &&
          placeholder !== runtime.MIXED_LABEL &&
          "[&_input]:placeholder:text-primary",
        className,
      ),
      slotStart:
        prefix !== undefined && prefix !== ""
          ? jsxForUiNumberControls.jsx("span", {
              "data-scrub": "",
              onMouseDown: value9 ? callback5 : undefined,
              onPointerDown: value9 ? captureNumberScrubPointer : undefined,
              className: (0, runtime.joinClassNames)(
                PROPERTY_NUMBER_UNIT_CLASS,
                "inline-flex items-center text-caption-medium",
                value9 && "cursor-ew-resize",
              ),
              children: prefix,
            })
          : undefined,
      slotEnd:
        value2 || value13
          ? jsxForUiNumberControls.jsxs("span", {
              className: "flex items-center gap-2",
              children: [
                value2
                  ? jsxForUiNumberControls.jsx("span", {
                      "data-scrub": "",
                      onMouseDown: value9 && unitScrubs ? callback5 : undefined,
                      onPointerDown:
                        value9 && unitScrubs
                          ? captureNumberScrubPointer
                          : undefined,
                      className: (0, runtime.joinClassNames)(
                        PROPERTY_NUMBER_INPUT_CLASS,
                        value9 && unitScrubs && "cursor-ew-resize",
                      ),
                      children: unit,
                    })
                  : null,
                value13
                  ? jsxForUiNumberControls.jsxs("span", {
                      className:
                        "hidden flex-col group-focus-within/field:flex pointer-coarse:hidden!",
                      children: [
                        jsxForUiNumberControls.jsx("button", {
                          type: "button",
                          tabIndex: -1,
                          "aria-label": value7
                            ? runtime.INCREASE_LABEL + " " + value7
                            : runtime.INCREASE_LABEL,
                          className: PROPERTY_NUMBER_STEPPER_CLASS,
                          disabled: disabled,
                          onMouseDown: (
                            event: ReactMouseEvent<HTMLButtonElement>,
                          ) => {
                            event.preventDefault();
                            if (event.button !== 0) {
                              return;
                            }
                            callback6();
                          },
                          onMouseLeave: () => (ref6.current = false),
                          onClick: (input: ReactMouseEvent<HTMLButtonElement>) =>
                            callback7(1, input),
                          children: jsxForUiNumberControls.jsx(
                            runtime.KitIcon,
                            {
                              name: "CaretUp",
                              size: 12,
                            },
                          ),
                        }),
                        jsxForUiNumberControls.jsx("button", {
                          type: "button",
                          tabIndex: -1,
                          "aria-label": value7
                            ? runtime.DECREASE_LABEL + " " + value7
                            : runtime.DECREASE_LABEL,
                          className: PROPERTY_NUMBER_STEPPER_CLASS,
                          disabled: disabled,
                          onMouseDown: (
                            event: ReactMouseEvent<HTMLButtonElement>,
                          ) => {
                            event.preventDefault();
                            if (event.button !== 0) {
                              return;
                            }
                            callback6();
                          },
                          onMouseLeave: () => (ref6.current = false),
                          onClick: (input: ReactMouseEvent<HTMLButtonElement>) =>
                            callback7(-1, input),
                          children: jsxForUiNumberControls.jsx(
                            runtime.KitIcon,
                            {
                              name: "CaretDown",
                              size: 12,
                            },
                          ),
                        }),
                      ],
                    })
                  : null,
              ],
            })
          : undefined,
    });
  }
  bindRuntimeValue(runtime, "decimalPlaces", () => decimalPlaces);
  bindRuntimeValue(runtime, "roundScrubValue", () => roundScrubValue);
  bindRuntimeValue(runtime, "scrubPrecision", () => scrubPrecision);
  bindRuntimeValue(runtime, "snapScrubValue", () => snapScrubValue);
  bindRuntimeValue(runtime, "steppedNumberValue", () => steppedNumberValue);
  bindRuntimeValue(
    runtime,
    "initializeNumberScrubNoop",
    () => initializeNumberScrubNoop,
    (value) => {
      initializeNumberScrubNoop = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createNumberScrubGesture",
    () => createNumberScrubGesture,
  );
  bindRuntimeValue(
    runtime,
    "useNumberScrubGesture",
    () => useNumberScrubGesture,
  );
  bindRuntimeValue(
    runtime,
    "captureNumberScrubPointer",
    () => captureNumberScrubPointer,
  );
  bindRuntimeValue(
    runtime,
    "attachNumberScrubGesture",
    () => attachNumberScrubGesture,
  );
  bindRuntimeValue(
    runtime,
    "reactForUiNumberControls",
    () => reactForUiNumberControls,
    (value) => {
      reactForUiNumberControls = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "activeNumberScrubCleanup",
    () => activeNumberScrubCleanup,
    (value) => {
      activeNumberScrubCleanup = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiNumberControls",
    () => initializeUiNumberControls,
    (value) => {
      initializeUiNumberControls = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "numberInputDecimalPlaces",
    () => numberInputDecimalPlaces,
  );
  bindRuntimeValue(runtime, "PropertyNumberInput", () => PropertyNumberInput);
  bindRuntimeValue(
    runtime,
    "reactForUiNumberControls2",
    () => reactForUiNumberControls2,
    (value) => {
      reactForUiNumberControls2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiNumberControls",
    () => jsxForUiNumberControls,
    (value) => {
      jsxForUiNumberControls = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PROPERTY_NUMBER_FORMAT_OPTIONS",
    () => PROPERTY_NUMBER_FORMAT_OPTIONS,
    (value) => {
      PROPERTY_NUMBER_FORMAT_OPTIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "propertyNumberFormatter",
    () => propertyNumberFormatter,
    (value) => {
      propertyNumberFormatter = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PROPERTY_NUMBER_UNIT_CLASS",
    () => PROPERTY_NUMBER_UNIT_CLASS,
    (value) => {
      PROPERTY_NUMBER_UNIT_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PROPERTY_NUMBER_INPUT_CLASS",
    () => PROPERTY_NUMBER_INPUT_CLASS,
    (value) => {
      PROPERTY_NUMBER_INPUT_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PROPERTY_NUMBER_STEPPER_CLASS",
    () => PROPERTY_NUMBER_STEPPER_CLASS,
    (value) => {
      PROPERTY_NUMBER_STEPPER_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiNumberControls2",
    () => initializeUiNumberControls2,
    (value) => {
      initializeUiNumberControls2 = value;
    },
  );
  return () => {
    initializeNumberScrubNoop = () => {};
    activeNumberScrubCleanup = null;
    initializeUiNumberControls = (0, runtime.initializeOnce)(() => {
      initializeNumberScrubNoop();
      reactForUiNumberControls = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
    });
    PROPERTY_NUMBER_UNIT_CLASS = "select-none text-muted";
    PROPERTY_NUMBER_STEPPER_CLASS =
      "flex h-2.5 w-3 items-center justify-center rounded-sm text-muted outline-none hover:text-primary disabled:opacity-50";
    initializeUiNumberControls2 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeUiInputs210)();
      (0, runtime.initializeUiAnnouncements)();
      (0, runtime.initializeUiPropertyIcons)();
      initializeUiNumberControls();
      (0, runtime.initializeUiPropertyLabels)();
      reactForUiNumberControls2 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiNumberControls = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      PROPERTY_NUMBER_FORMAT_OPTIONS = {
        useGrouping: false,
      };
      propertyNumberFormatter = new Intl.NumberFormat(
        "en-US",
        PROPERTY_NUMBER_FORMAT_OPTIONS,
      );
      PROPERTY_NUMBER_INPUT_CLASS =
        PROPERTY_NUMBER_UNIT_CLASS + " text-caption";
    });
  };
}
