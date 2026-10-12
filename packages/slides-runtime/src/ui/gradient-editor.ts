/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  ReactNode,
} from "react";
import type { SelectItem, SelectValue } from "./select";

/** One stop of the gradient editor: its color and position, plus how the stop was authored. */
export interface GradientEditorStop {
  color: string;
  /** Percent along the bar; undefined while unset (spread evenly between its neighbours). */
  pos?: number;
  /** Authored color text (for example a symbolic value) shown in place of `color`. */
  swatch?: string;
  /** Written by hand in a form the editor keeps as is. */
  locked?: boolean;
  /** A midpoint hint rather than a color stop. */
  hint?: boolean;
}
export interface GradientEditorProps {
  radial?: boolean;
  /** Switches between a linear and a radial gradient; absent when only linear is available. */
  onRadial?: (radial: boolean) => void;
  angle?: number;
  onAngle: (angle: number | undefined) => void;
  onAngleScrub?: (angle: number) => void;
  onAngleScrubEnd?: () => void;
  stops: GradientEditorStop[];
  selected: number;
  onSelect: (index: number) => void;
  onStops: (stops: GradientEditorStop[]) => void;
  /** Receives intermediate stops while one is dragged or scrubbed. */
  onStopsLive?: (stops: GradientEditorStop[]) => void;
  onLiveEnd?: () => void;
  minStops?: number;
  maxStops?: number;
  disabled?: boolean;
  renderStopPicker: (index: number) => ReactNode;
  testid?: string;
}
/** A stop drag in progress: which stop, the pointer driving it and where it started. */
interface GradientStopDrag {
  index: number;
  id: number;
  pointer: number;
  x0: number;
  moved: boolean;
  last: number;
  posBefore: number;
}
export interface GradientStopKeyboardHandlers {
  onKeyDownCapture: (event: ReactKeyboardEvent<HTMLElement>) => void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    GradientEditorReact: ReactNamespace;
    GradientEditorJsx: JsxNamespace;
    normalizeGradientStopPositions: (
      stops: readonly GradientEditorStop[],
    ) => number[];
    GradientEditor: (props: GradientEditorProps) => ReactElement;
    gradientStopKeyboardHandlers: GradientStopKeyboardHandlers;
    clampGradientEditorValue: (
      input: number,
      options: number,
      context: number,
    ) => number;
    normalizeGradientColor: (input: string) => string;
    normalizeGradientColorInput: (input: string) => string;
    symbolicGradientColorPattern: RegExp;
    gradientStopLengthPattern: RegExp;
    handAuthoredGradientExplanation: string;
    gradientTypeChoices: (input: boolean) => SelectItem[];
    initializeGradientEditor: () => void;
  }
}

export function installUiGradientEditor(runtime: RuntimeBindings): () => void {
  var GradientEditorReact: ReactNamespace;
  var GradientEditorJsx: JsxNamespace;
  var gradientStopKeyboardHandlers: GradientStopKeyboardHandlers;
  var clampGradientEditorValue: (
    input: number,
    options: number,
    context: number,
  ) => number;
  var normalizeGradientColor: (input: string) => string;
  var normalizeGradientColorInput: (input: string) => string;
  var symbolicGradientColorPattern: RegExp;
  var gradientStopLengthPattern: RegExp;
  var handAuthoredGradientExplanation: string;
  var gradientTypeChoices: (input: boolean) => SelectItem[];
  var initializeGradientEditor: () => void;
  function normalizeGradientStopPositions(
    stops: readonly GradientEditorStop[],
  ): number[] {
    let value = stops.map(
      (input: GradientEditorStop): number | undefined =>
        input.pos === undefined
          ? undefined
          : clampGradientEditorValue(input.pos, 0, 100),
    );
    if (value.length === 0) {
      return [];
    }
    if (value[0] === undefined) {
      value[0] = 0;
    }
    if (value[value.length - 1] === undefined) {
      value[value.length - 1] = 100;
    }
    let value2 = -1 / 0;
    for (let index = 0; index < value.length; index++) {
      if (value[index] === undefined) {
        continue;
      }
      if (value[index]! < value2) {
        value[index] = value2;
      }
      value2 = value[index]!;
    }
    for (let count = 1; count < value.length - 1; count++) {
      if (value[count] !== undefined) {
        continue;
      }
      let value3 = count;
      while (value[value3] === undefined) value3++;
      let value4 = value[count - 1]!,
        value5 = value[value3]!;
      for (let value6 = count; value6 < value3; value6++)
        value[value6] =
          value4 +
          ((value5 - value4) * (value6 - count + 1)) / (value3 - count + 1);
      count = value3;
    }
    return value as number[];
  }
  function GradientEditor({
    radial: radial,
    onRadial: onRadial,
    angle: angle,
    onAngle: onAngle,
    onAngleScrub: onAngleScrub,
    onAngleScrubEnd: onAngleScrubEnd,
    stops: stops,
    selected: selected,
    onSelect: onSelect,
    onStops: onStops,
    onStopsLive: onStopsLive,
    onLiveEnd: onLiveEnd,
    minStops = 2,
    maxStops = 8,
    disabled = false,
    renderStopPicker: renderStopPicker,
    testid: testid,
  }: GradientEditorProps): ReactElement {
    let [value, value2] = GradientEditorReact.useState<
        GradientEditorStop[] | null
      >(null),
      value3 = value ?? stops,
      ref = GradientEditorReact.useRef(false),
      value4 = normalizeGradientStopPositions(value3),
      value5 =
        ref.current || value !== null
          ? value3.map(
              (input: GradientEditorStop, options: number): number =>
                input.pos === undefined
                  ? value4[options]!
                  : clampGradientEditorValue(input.pos, 0, 100),
            )
          : value4,
      callback = (input: GradientEditorStop): string =>
        input.swatch ?? input.color,
      value6 = value3.map(callback).join("\x00"),
      memo = GradientEditorReact.useMemo(() => {
        let entries = new Map<string, string>();
        for (let value17 of value6.split("\x00"))
          if (!entries.has(value17)) {
            entries.set(
              value17,
              symbolicGradientColorPattern.test(value17) ||
                gradientStopLengthPattern.test(value17)
                ? "transparent"
                : normalizeGradientColor(value17),
            );
          }
        return (input: string): string =>
          entries.get(input) ?? "transparent";
      }, [value6]),
      value7 = clampGradientEditorValue(
        selected,
        0,
        Math.max(0, value3.length - 1),
      ),
      ref2 = GradientEditorReact.useRef<HTMLDivElement | null>(null),
      ref3 = GradientEditorReact.useRef<HTMLDivElement | null>(null),
      ref4 = GradientEditorReact.useRef<number[]>([]),
      ref5 = GradientEditorReact.useRef(0);
    if (ref4.current.length !== value3.length) {
      ref4.current = value3.map(() => ref5.current++);
    }
    let current = ref4.current,
      callback2 = (): Element | null =>
        ref3.current?.closest('[data-mc-popover], [role="dialog"]') ??
        ref3.current,
      [value8, value9] = GradientEditorReact.useState<number | null>(null),
      [value10, value11] = GradientEditorReact.useState(false),
      value12 =
        value8 !== null && current.includes(value8)
          ? current.indexOf(value8)
          : null,
      ref6 = GradientEditorReact.useRef<GradientStopDrag | null>(null),
      ref7 = GradientEditorReact.useRef({
        stops: stops,
        onStopsLive: onStopsLive,
        onLiveEnd: onLiveEnd,
      });
    ref7.current = {
      stops: stops,
      onStopsLive: onStopsLive,
      onLiveEnd: onLiveEnd,
    };
    let callback3 = (input: GradientStopDrag): void => {
      let {
          stops: current2,
          onStopsLive: current3,
          onLiveEnd: current4,
        } = ref7.current,
        value17 = ref4.current.indexOf(input.id);
      if (current3 && value17 >= 0 && value17 < current2.length) {
        current3(
          current2.map(
            (input2: GradientEditorStop, options: number): GradientEditorStop =>
              options === value17
                ? {
                    ...input2,
                    pos: input.posBefore,
                  }
                : input2,
          ),
        );
      }
      current4?.();
    };
    GradientEditorReact.useEffect(
      () => (): void => {
        let current2 = ref6.current;
        if (current2?.moved) {
          callback3(current2);
        }
      },
      [],
    );
    let ref8 = GradientEditorReact.useRef(false),
      callback4 = (input: GradientEditorStop[]): GradientEditorStop[] =>
        input.map(
          (input2: GradientEditorStop, options: number): GradientEditorStop =>
            input2.locked === true
              ? input2
              : {
                  ...input2,
                  pos:
                    Math.round(
                      (input === value3
                        ? value5[options]!
                        : normalizeGradientStopPositions(input)[options]!) *
                        100,
                    ) / 100,
                },
        ),
      value13 = value3.some(
        (input: GradientEditorStop): boolean => input.locked === true,
      ),
      callback5 = (
        items: GradientEditorStop[],
        options: number,
        context: number,
      ): GradientEditorStop[] => {
        let value17 = value13 && options > 0 ? value5[options - 1]! : 0,
          value18 =
            value13 && options < items.length - 1 ? value5[options + 1]! : 100;
        return callback4(items).map(
          (input: GradientEditorStop, options2: number): GradientEditorStop =>
            options2 === options
              ? {
                  ...input,
                  pos: Math.round(
                    clampGradientEditorValue(context, value17, value18),
                  ),
                }
              : input,
        );
      },
      callback6 = (input: GradientEditorStop[]): void => {
        ref.current = true;
        if (onStopsLive) {
          onStopsLive(input);
        } else {
          value2(input);
        }
      },
      callback7 = (input: number): void => {
        let activeElement = document.activeElement,
          current2 = ref3.current;
        if (
          !current2 ||
          !(activeElement instanceof HTMLElement) ||
          !current2.contains(activeElement)
        ) {
          return;
        }
        let value17 = activeElement.matches('button[role="slider"]')
          ? 'button[role="slider"]'
          : activeElement.matches("input") &&
              activeElement.closest('[role="listitem"]') !== null
            ? '[role="listitem"] input'
            : null;
        if (value17 === null) {
          return;
        }
        requestAnimationFrame(
          (): void =>
            current2.querySelectorAll<HTMLElement>(value17)[input]?.focus(),
        );
      },
      ref9 = GradientEditorReact.useRef(0),
      callback8 = (input: GradientEditorStop[], options: number): number => {
        let value17 = input.some(
            (input2: GradientEditorStop): boolean => input2.locked === true,
          ),
          value18 = input.map(
            (input2: GradientEditorStop, options2: number): number => options2,
          );
        if (!value17) {
          value18.sort(
            (input2: number, options2: number): number =>
              input[input2]!.pos! - input[options2]!.pos! || input2 - options2,
          );
        }
        let value19 = Math.max(0, value18.indexOf(options)),
          value20 = value18.map(
            (input2: number): GradientEditorStop => input[input2]!,
          );
        ref4.current = value18.map(
          (input2: number): number => ref4.current[input2]!,
        );
        ref.current = false;
        if (value19 !== options) {
          ref9.current += 1;
          onStopsLive?.(value20);
          callback7(value19);
        }
        value2(null);
        onLiveEnd?.();
        onStops(value20);
        onSelect(value19);
        return value19;
      },
      length = value3.filter(
        (input: GradientEditorStop): boolean => input.hint !== true,
      ).length,
      value14 = length > minStops || length < value3.length,
      callback9 = (input: number): boolean =>
        !disabled &&
        value3.length > 0 &&
        (value3[input]?.hint === true ? true : length > minStops),
      callback10 = (input: number): number => {
        if (!callback9(input)) {
          return value3.length;
        }
        let value17 = value3.map(
          (input2: GradientEditorStop, options: number): boolean =>
            options !== input,
        );
        for (let flag = true; flag; ) {
          flag = false;
          let value19 = value3
            .map((input2: GradientEditorStop, options: number): number => options)
            .filter((input2: number): boolean | undefined => value17[input2]);
          value19.forEach((input2: number, options: number): void => {
            if (value3[input2]!.hint !== true || !value17[input2]) {
              return;
            }
            let value20 = options === 0,
              value21 = options === value19.length - 1,
              value22 =
                options > 0 && value3[value19[options - 1]!]!.hint === true;
            if (value20 || value21 || value22) {
              value17[input2] = false;
              flag = true;
            }
          });
        }
        let value18 = callback4(value3).filter(
          (input2: GradientEditorStop, options: number): boolean | undefined =>
            value17[options],
        );
        ref4.current = ref4.current.filter(
          (input2: number, options: number): boolean | undefined =>
            value17[options],
        );
        value9(null);
        onStops(value18);
        let length2 = value17
          .slice(0, value7 + 1)
          .filter((input2: boolean | undefined): boolean => !input2).length;
        onSelect(
          clampGradientEditorValue(
            value17[value7]
              ? value7 - length2
              : value7 -
                  length2 +
                  (value7 - length2 + 1 < value18.length ? 1 : 0),
            0,
            Math.max(0, value18.length - 1),
          ),
        );
        return value18.length;
      },
      callback11 = (): void => {
        if (disabled || value3.length >= maxStops || value3.length === 0) {
          return;
        }
        let value17 = value7,
          value18 = value17 < value3.length - 1,
          value19 = value5[value17]!,
          value20 = value18
            ? value5[value17 + 1]!
            : (value5[value17 - 1] ?? 0),
          state = {
            color:
              (value3[value17]!.locked === true
                ? value3.find(
                    (input: GradientEditorStop): boolean =>
                      input.locked !== true,
                  )
                : value3[value17]
              )?.color ?? "#808080",
            pos: Math.round((value19 + value20) / 2),
          },
          value21 = value18 ? value17 + 1 : value17,
          value22 = callback4(value3);
        ref4.current = [
          ...ref4.current.slice(0, value21),
          ref5.current++,
          ...ref4.current.slice(value21),
        ];
        onStops([
          ...value22.slice(0, value21),
          state,
          ...value22.slice(value21),
        ]);
        onSelect(value21);
      },
      ref10 = GradientEditorReact.useRef<HTMLDivElement | null>(null),
      callback12 = (input: Pick<PointerEvent, "clientX">): number => {
        let bounds = (ref10.current ?? ref2.current)!.getBoundingClientRect();
        return (
          ((input.clientX - bounds.left) / Math.max(1, bounds.width)) * 100
        );
      },
      callback13 =
        (input: number) =>
        (event: ReactPointerEvent<HTMLButtonElement>): void => {
          if (
            disabled ||
            event.button !== 0 ||
            ref6.current !== null ||
            value3[input]?.locked === true
          ) {
            return;
          }
          event.preventDefault();
          let current2 = ref9.current,
            activeElement = document.activeElement;
          if (
            activeElement instanceof HTMLElement &&
            activeElement !== event.currentTarget &&
            ref3.current?.contains(activeElement)
          ) {
            activeElement.blur();
          }
          if (ref9.current !== current2) {
            return;
          }
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.focus();
          ref6.current = {
            index: input,
            id: current[input]!,
            pointer: event.pointerId,
            x0: event.clientX,
            moved: false,
            last: value5[input]!,
            posBefore: value5[input]!,
          };
          ref8.current = false;
          onSelect(input);
        },
      callback14 = (input: ReactPointerEvent<HTMLButtonElement>): void => {
        let current2 = ref6.current;
        if (
          !current2 ||
          current2.pointer !== input.pointerId ||
          !input.currentTarget.hasPointerCapture(input.pointerId)
        ) {
          return;
        }
        if (!current2.moved && Math.abs(input.clientX - current2.x0) < 3) {
          return;
        }
        current2.moved = true;
        current2.last = callback12(input);
        callback6(callback5(value3, current2.index, current2.last));
      },
      callback15 = (
        input: ReactPointerEvent<HTMLButtonElement>,
        options: boolean,
      ): void => {
        let current2 = ref6.current;
        if (!current2 || current2.pointer !== input.pointerId) {
          return;
        }
        ref6.current = null;
        if (input.currentTarget.hasPointerCapture(input.pointerId)) {
          input.currentTarget.releasePointerCapture(input.pointerId);
        }
        if (!current2.moved) {
          return;
        }
        if (options) {
          ref8.current = true;
          callback8(
            callback5(value3, current2.index, current2.last),
            current2.index,
          );
        } else if (((ref.current = false), value2(null), onStopsLive)) {
          callback3(current2);
        } else {
          onLiveEnd?.();
        }
      },
      callback16 =
        (input: number) =>
        (event: ReactKeyboardEvent<HTMLButtonElement>): void => {
          if (disabled) {
            return;
          }
          if (
            value3[input]?.locked === true &&
            event.key !== "Delete" &&
            event.key !== "Backspace"
          ) {
            return;
          }
          let value17 = event.shiftKey ? 10 : 1,
            value18 = value5[input]!,
            value19: number | null = null;
          if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            value19 = value18 - value17;
          } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            value19 = value18 + value17;
          } else if (event.key === "Home") {
            value19 = 0;
          } else if (event.key === "End") {
            value19 = 100;
          } else if (event.key === "Delete" || event.key === "Backspace") {
            event.preventDefault();
            if (callback9(input)) {
              let value20 = callback10(input),
                value21 = Math.min(input, value20 - 1);
              requestAnimationFrame(
                (): void =>
                  ref10.current
                    ?.querySelectorAll<HTMLElement>('button[role="slider"]')
                    [value21]?.focus(),
              );
            }
            return;
          }
          if (value19 === null) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          callback8(callback5(value3, input, value19), input);
        },
      callback17 = (input: number): string =>
        "calc(0.75rem + (100% - 1.5rem) * " + String(input / 100) + ")",
      value15 = value3.flatMap(
        (input: GradientEditorStop, options: number): string[] =>
          input.hint === true
            ? []
            : [memo(callback(input)) + " " + callback17(value5[options]!)],
      ),
      value16 =
        "linear-gradient(90deg, " +
        (value15.length >= 2
          ? value15
          : ["transparent 0%", "transparent 100%"]
        ).join(", ") +
        ")";
    return GradientEditorJsx.jsxs("div", {
      ref: ref3,
      "data-testid": testid,
      "data-kit": "gradient-editor",
      className: "flex flex-col",
      children: [
        GradientEditorJsx.jsx(runtime.PropertyRow, {
          label: "Style",
          children: GradientEditorJsx.jsxs("div", {
            className: "flex min-w-0 flex-1 items-center gap-2",
            children: [
              GradientEditorJsx.jsx("div", {
                className: "min-w-0 flex-1",
                children: GradientEditorJsx.jsx(runtime.Select, {
                  "aria-label": "Gradient style",
                  items: gradientTypeChoices(onRadial !== undefined),
                  value: radial ? "radial" : "linear",
                  disabled: disabled,
                  onChange: (input: SelectValue): void => {
                    if ((input === "radial") !== radial) {
                      onRadial?.(input === "radial");
                    }
                  },
                }),
              }),
              GradientEditorJsx.jsx("div", {
                className: "w-[4.75rem] shrink-0",
                title: radial ? "A radial gradient has no angle." : undefined,
                children: GradientEditorJsx.jsx(runtime.PropertyNumberInput, {
                  "aria-label": "Angle",
                  prefix: GradientEditorJsx.jsx(runtime.PropertyIcon, {
                    icon: runtime.ANGLE_ICON,
                  }),
                  value: radial ? undefined : angle,
                  placeholder: radial ? "–" : "180",
                  ownUnit: "deg",
                  min: 0,
                  max: 360,
                  step: 1,
                  steppers: false,
                  disabled: disabled || radial,
                  onValue: (input: number | undefined): void =>
                    onAngle(
                      input === undefined
                        ? undefined
                        : clampGradientEditorValue(input, 0, 360),
                    ),
                  ...(onAngleScrub
                    ? {
                        onScrub: (input: number): void =>
                          onAngleScrub(clampGradientEditorValue(input, 0, 360)),
                        onScrubEnd: onAngleScrubEnd,
                      }
                    : {}),
                }),
              }),
            ],
          }),
        }),
        GradientEditorJsx.jsx("div", {
          className: (0, runtime.joinClassNames)(
            runtime.PROPERTY_SECTION_GUTTER_CLASS,
            "pt-3 pb-4",
          ),
          children: GradientEditorJsx.jsxs("div", {
            ref: ref2,
            "data-kit": "gradient-bar",
            className:
              "relative h-8 rounded shadow-card-ring bg-[repeating-conic-gradient(var(--cds-alpha-2)_0_25%,transparent_0_50%)] bg-[length:8px_8px]",
            children: [
              GradientEditorJsx.jsx("div", {
                className: "absolute inset-0 rounded",
                style: {
                  background: value16,
                },
              }),
              GradientEditorJsx.jsx("div", {
                ref: ref10,
                className: "absolute inset-y-0 left-3 right-3",
                children: value3.map(
                  (input: GradientEditorStop, options: number): ReactElement =>
                    GradientEditorJsx.jsx(
                      "button",
                      {
                        type: "button",
                        role: "slider",
                        "aria-label":
                          "Stop " + String(options + 1) + " position",
                        "aria-valuemin": 0,
                        "aria-valuemax": 100,
                        "aria-valuenow": Math.round(value5[options]!),
                        "aria-valuetext":
                          String(Math.round(value5[options]!)) + "%",
                        "data-selected": options === value7 ? "" : undefined,
                        disabled: disabled,
                        "aria-disabled":
                          input.locked === true ? true : undefined,
                        title:
                          input.locked === true
                            ? handAuthoredGradientExplanation
                            : undefined,
                        className: (0, runtime.joinClassNames)(
                          "absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-default touch-none rounded-full border-2 border-white p-0 shadow-card-ring",
                          "focus-visible:shadow-focus pointer-coarse:h-6 pointer-coarse:w-6",
                          options === value7
                            ? "z-[1] outline outline-2 outline-offset-1 outline-border-strong"
                            : "outline-none focus-visible:outline-hidden",
                        ),
                        style: {
                          left: String(value5[options]) + "%",
                          background: memo(callback(input)),
                        },
                        onPointerDown: callback13(options),
                        onPointerMove: callback14,
                        onPointerUp: (
                          input2: ReactPointerEvent<HTMLButtonElement>,
                        ): void => callback15(input2, true),
                        onPointerCancel: (
                          input2: ReactPointerEvent<HTMLButtonElement>,
                        ): void => callback15(input2, false),
                        onLostPointerCapture: (
                          input2: ReactPointerEvent<HTMLButtonElement>,
                        ): void => callback15(input2, false),
                        onKeyDown: callback16(options),
                        onClick: (): void => {
                          if (ref8.current) {
                            ref8.current = false;
                          } else {
                            onSelect(options);
                          }
                        },
                      },
                      current[options],
                    ),
                ),
              }),
            ],
          }),
        }),
        GradientEditorJsx.jsx(runtime.PropertyRow, {
          label: "Stops",
          children: GradientEditorJsx.jsx("div", {
            className: "flex min-w-0 flex-1 justify-end",
            children: GradientEditorJsx.jsx(runtime.Button, {
              variant: "ghost",
              size: "sm",
              iconOnly: true,
              icon: "Add",
              "aria-label": "Add stop",
              disabled: disabled || value3.length >= maxStops,
              disabledReason: String(maxStops) + " stops at most.",
              onClick: callback11,
            }),
          }),
        }),
        GradientEditorJsx.jsx("div", {
          role: "list",
          "aria-label": "Stops",
          className: (0, runtime.joinClassNames)(
            runtime.PROPERTY_SECTION_GUTTER_CLASS,
            "mt-1 flex flex-col gap-2",
          ),
          children: value3.map(
            (input: GradientEditorStop, options: number): ReactElement => {
              let value17 =
                !symbolicGradientColorPattern.test(callback(input)) &&
                !gradientStopLengthPattern.test(callback(input));
              return GradientEditorJsx.jsxs(
                "div",
                {
                  role: "listitem",
                  className: "flex min-w-0 items-center gap-2",
                  children: [
                    GradientEditorJsx.jsx("div", {
                      className: "w-[3.75rem] shrink-0",
                      children: GradientEditorJsx.jsx(
                        runtime.PropertyNumberInput,
                        {
                          "aria-label":
                            "Stop " + String(options + 1) + " position",
                          value: Math.round(value5[options]!),
                          unit: "%",
                          min: 0,
                          max: 100,
                          step: 1,
                          smallStep: 1,
                          steppers: false,
                          disabled: disabled || input.locked === true,
                          title:
                            input.locked === true
                              ? handAuthoredGradientExplanation
                              : undefined,
                          onValue: (input2: number | undefined): number =>
                            callback8(
                              callback5(
                                value3,
                                options,
                                input2 ?? value5[options]!,
                              ),
                              options,
                            ),
                          onScrub: (input2: number): void =>
                            callback6(callback5(value3, options, input2)),
                          onScrubEnd: (): number =>
                            callback8(
                              callback5(value3, options, value5[options]!),
                              options,
                            ),
                        },
                      ),
                    }),
                    GradientEditorJsx.jsx("span", {
                      className: "relative flex min-w-0 flex-1",
                      children: GradientEditorJsx.jsx(runtime.PropertyPopup, {
                        open: value12 === options,
                        onOpen: (): void => value9(current[options]!),
                        onClose: (): void => value9(null),
                        trigger: GradientEditorJsx.jsx(runtime.FieldButton, {
                          "aria-label":
                            "Stop " +
                            String(options + 1) +
                            " color: " +
                            normalizeGradientColorInput(input.color),
                          "data-selected": options === value7 ? "" : undefined,
                          disabled: disabled,
                          onClick: (input2: ReactMouseEvent): void => {
                            onSelect(options);
                            value11(input2.detail === 0);
                          },
                          className: (0, runtime.joinClassNames)(
                            "min-w-0 cursor-default",
                            options === value7 && "bg-fill-ghost-hover",
                          ),
                          chip: GradientEditorJsx.jsx(
                            runtime.PropertyColorPreview,
                            {
                              background: value17
                                ? memo(callback(input))
                                : undefined,
                            },
                          ),
                          children: normalizeGradientColorInput(input.color),
                        }),
                        side: "left",
                        positionAnchor: callback2,
                        padding: "none",
                        className: runtime.COLOR_PICKER_POPOVER_CLASS,
                        focusOnOpen: value10,
                        popupAttrs: {
                          "data-kit-stop-picker": String(options),
                        },
                        children:
                          value12 === options
                            ? renderStopPicker(options)
                            : null,
                      }),
                    }),
                    value14
                      ? GradientEditorJsx.jsx(runtime.Button, {
                          variant: "ghost",
                          size: "sm",
                          iconOnly: true,
                          icon: "Minus",
                          "aria-label": "Remove stop " + String(options + 1),
                          disabled: !callback9(options),
                          disabledReason:
                            "A gradient needs " +
                            String(minStops) +
                            " color stops.",
                          onClick: (): number => callback10(options),
                        })
                      : null,
                  ],
                },
                current[options],
              );
            },
          ),
        }),
      ],
    });
  }
  bindRuntimeValue(
    runtime,
    "normalizeGradientStopPositions",
    () => normalizeGradientStopPositions,
  );
  bindRuntimeValue(runtime, "GradientEditor", () => GradientEditor);
  bindRuntimeValue(
    runtime,
    "GradientEditorReact",
    () => GradientEditorReact,
    (value) => {
      GradientEditorReact = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GradientEditorJsx",
    () => GradientEditorJsx,
    (value) => {
      GradientEditorJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "gradientStopKeyboardHandlers",
    () => gradientStopKeyboardHandlers,
    (value) => {
      gradientStopKeyboardHandlers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "clampGradientEditorValue",
    () => clampGradientEditorValue,
    (value) => {
      clampGradientEditorValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeGradientColor",
    () => normalizeGradientColor,
    (value) => {
      normalizeGradientColor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeGradientColorInput",
    () => normalizeGradientColorInput,
    (value) => {
      normalizeGradientColorInput = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "symbolicGradientColorPattern",
    () => symbolicGradientColorPattern,
    (value) => {
      symbolicGradientColorPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "gradientStopLengthPattern",
    () => gradientStopLengthPattern,
    (value) => {
      gradientStopLengthPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "handAuthoredGradientExplanation",
    () => handAuthoredGradientExplanation,
    (value) => {
      handAuthoredGradientExplanation = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "gradientTypeChoices",
    () => gradientTypeChoices,
    (value) => {
      gradientTypeChoices = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeGradientEditor",
    () => initializeGradientEditor,
    (value) => {
      initializeGradientEditor = value;
    },
  );
  return () => {
    clampGradientEditorValue = (
      input: number,
      options: number,
      context: number,
    ): number => Math.min(context, Math.max(options, input));
    normalizeGradientColor = (input: string): string =>
      (0, runtime.hsvaToCssColor)((0, runtime.parseCssColorToHsva)(input));
    normalizeGradientColorInput = (input: string): string =>
      /^#[0-9a-f]{3,8}$/i.test(input.trim())
        ? input.trim().toUpperCase()
        : input.trim();
    handAuthoredGradientExplanation =
      "Written by hand in a form this editor keeps as is.";
    gradientTypeChoices = (input: boolean): SelectItem[] => [
      {
        value: "linear",
        label: "Linear",
      },
      {
        value: "radial",
        label: "Radial",
        disabled: !input,
        title: input ? undefined : "Linear gradients only here.",
      },
    ];
    initializeGradientEditor = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeUiInputs210)();
      (0, runtime.initializeUiColorPicker)();
      (0, runtime.initializeUiInspectorIcons)();
      (0, runtime.initializeUiNumberControls2)();
      (0, runtime.initializeUiPropertyRow3)();
      (0, runtime.initializeUiPropertyPopover2)();
      (0, runtime.initializeSelect)();
      GradientEditorReact = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      GradientEditorJsx = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      gradientStopKeyboardHandlers = {
        onKeyDownCapture: (event: ReactKeyboardEvent<HTMLElement>): void => {
          let value =
            event.target instanceof HTMLElement
              ? event.target.closest<HTMLElement>('[role="radio"]')
              : null;
          if (!value) {
            return;
          }
          if (
            event.key === "ArrowRight" ||
            event.key === "ArrowLeft" ||
            event.key === "ArrowDown" ||
            event.key === "ArrowUp"
          ) {
            event.preventDefault();
            event.stopPropagation();
            let items = [
                ...(value
                  .closest('[role="radiogroup"]')
                  ?.querySelectorAll<HTMLElement>('[role="radio"]') ?? []),
              ],
              value2 =
                event.key === "ArrowRight" || event.key === "ArrowDown"
                  ? 1
                  : -1;
            items[
              (items.indexOf(value) + value2 + items.length) % items.length
            ]?.focus();
          } else if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            value.click();
          }
        },
      };
      symbolicGradientColorPattern =
        /\b(var|env|attr|calc|color-mix)\(|^\s*(currentcolor|inherit|initial|unset)\s*$/i;
      gradientStopLengthPattern = /^\s*-?[\d.]+[a-z%]*\s*$/i;
    });
  };
}
