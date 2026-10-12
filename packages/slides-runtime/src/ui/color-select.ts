/** Restored application module; prepare first, initialize in original order. */
import type { CSSProperties, ReactElement, ReactNode } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type { DeckColorRow, DeckColorSwatch } from "../rendering/theme";
import type { ContrastRequirement } from "./contrast";

/** A swatch of a palette: a named color, or the empty "none" entry. */
export interface ColorSwatch extends DeckColorSwatch {
  /** The entry that stands for no color. */
  empty?: boolean;
  /** Why the swatch can't be picked; it is shown disabled. */
  disabledReason?: string;
}
/** What a palette accepts as a swatch: a bare color, a color row or a ready swatch. */
export type ColorSwatchInput = string | DeckColorRow | ColorSwatch;
/** The colors a design system contributes and the heading they sit under. */
export interface SwatchSystem {
  label: string;
  colors: string[];
}
/** The entry offered at the head of a palette to clear the color. */
export interface NoneSwatchOption {
  /** Whether "none" is the current choice. */
  current?: boolean;
  disabledReason?: string;
  onPick: () => void;
}
/** The tab a swatch palette shows: the named swatches or the free color picker. */
export type SwatchPaletteTab = "system" | "custom";
/** One option of the fill type switch above a palette. */
export interface SwatchKindOption {
  value: string;
  label: string;
  disabledReason?: string;
}
/** The fill type switch (solid, gradient, ...) shown above a palette. */
export interface SwatchKind {
  options: SwatchKindOption[];
  value: string;
  /** The kind value that means a plain color; "color" when omitted. */
  colorValue?: string;
  label?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}
/** Props of the free color picker shown in the custom tab. */
export interface SwatchColorEditor {
  value?: string;
  unset?: boolean;
  /** Hide the alpha channel. */
  opaque?: boolean;
  onChange: (css: string) => void;
  onPickEnd?: (css: string) => void;
  contrast?: ContrastRequirement;
}
export interface SwatchPaletteProps {
  title?: string;
  swatches: ColorSwatch[];
  /** Name of the chosen swatch, or null when none matches. */
  current: string | null;
  /** Report a click on the chosen swatch again. */
  repick?: boolean;
  onSwatch: (name: string) => void;
  onPicked?: () => void;
  /** Fold swatches that repeat an earlier color into it. */
  fold?: boolean;
  color?: SwatchColorEditor;
  kind?: SwatchKind;
  /** Shown instead of the color picker when the kind isn't a plain color. */
  face?: ReactNode;
  tab?: SwatchPaletteTab;
  onTab?: (tab: SwatchPaletteTab) => void;
  headerEnd?: ReactNode;
  heading?: ReactNode;
  headless?: boolean;
  testid?: string;
  className?: string;
}
export interface ColorSelectProps
  extends Omit<
    SwatchPaletteProps,
    "swatches" | "current" | "onSwatch" | "color"
  >,
  SwatchColorEditor {
  swatches?: readonly ColorSwatchInput[];
  none?: NoneSwatchOption;
  /** Name of the chosen swatch; derived from `value` when omitted. */
  current?: string | null;
  onSwatch?: (name: string) => void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    swatchPreviewStyle: (input: string | undefined) => CSSProperties | undefined;
    swatchColorKey: (color: string) => string;
    colorsEqual: (color: string, otherColor: string) => boolean;
    mergeDesignSystemSwatches: (
      system: SwatchSystem | undefined,
      swatches: readonly ColorSwatch[],
    ) => ColorSwatch[];
    SwatchPalette: (props: SwatchPaletteProps) => ReactElement;
    normalizeColorSwatches: (
      swatches: readonly ColorSwatchInput[] | undefined,
      allowEmpty: boolean,
      disabledReason?: string,
    ) => ColorSwatch[];
    ColorSelect: (props: ColorSelectProps) => ReactElement;
    ColorSelectReact: ReactNamespace;
    ColorSelectJsx: JsxNamespace;
    symbolicColorPattern: RegExp;
    unsafeColorPattern: RegExp;
    swatchLabel: (swatch: Pick<ColorSwatch, "label" | "name">) => string;
    isEmptySwatch: (swatch: Pick<ColorSwatch, "empty" | "name">) => boolean;
    swatchLabelIsColor: (swatch: Pick<ColorSwatch, "label" | "name">) => boolean;
    /** Most "used" design-system colors that get added to a palette. */
    swatchPaletteColumns: number;
    /** Swatch name of the "none" entry. */
    emptySwatchValue: string;
    initializeColorSelect: () => void;
  }
}

export function installUiColorSelect(runtime: RuntimeBindings): () => void {
  var ColorSelectReact: ReactNamespace;
  var ColorSelectJsx: JsxNamespace;
  var symbolicColorPattern: RegExp;
  var unsafeColorPattern: RegExp;
  var swatchLabel: RuntimeBindings["swatchLabel"];
  var isEmptySwatch: RuntimeBindings["isEmptySwatch"];
  var swatchLabelIsColor: RuntimeBindings["swatchLabelIsColor"];
  var swatchPaletteColumns: number;
  var emptySwatchValue: string;
  var initializeColorSelect: () => void;
  function swatchPreviewStyle(
    input: string | undefined,
  ): CSSProperties | undefined {
    if (input === undefined) {
      return;
    }
    if (/gradient\(/.test(input) && !unsafeColorPattern.test(input)) {
      return {
        background: input,
      };
    }
    if (symbolicColorPattern.test(input) && !unsafeColorPattern.test(input)) {
      return {
        backgroundColor: input,
      };
    }
    let value = (0, runtime.parseCssColorToHsva)(input),
      value2 = (0, runtime.hsvaToCssColor)(value);
    if (value.a < 1) {
      return {
        background: `linear-gradient(${value2}, ${value2}), ${runtime.COLOR_ALPHA_CHECKERBOARD}`,
      };
    } else {
      return {
        backgroundColor: value2,
      };
    }
  }
  function swatchColorKey(color: string): string {
    if (symbolicColorPattern.test(color)) {
      return "sym:" + color.trim();
    } else {
      return (0, runtime.hsvaToCssColor)(
        (0, runtime.parseCssColorToHsva)(color),
      );
    }
  }
  function colorsEqual(color: string, otherColor: string): boolean {
    return swatchColorKey(color) === swatchColorKey(otherColor);
  }
  function mergeDesignSystemSwatches(
    system: SwatchSystem | undefined,
    swatches: readonly ColorSwatch[],
  ): ColorSwatch[] {
    if (system === undefined || system.colors.length === 0) {
      return [...swatches];
    }
    let value = swatches.findIndex(
        (input: ColorSwatch): boolean => !isEmptySwatch(input),
      ),
      value2 = (value < 0 ? swatches : swatches.slice(0, value)).map(
        (input: ColorSwatch): ColorSwatch =>
          input.group === undefined
            ? input
            : {
                ...input,
                group: system.label,
                subgroup: undefined,
              },
      ),
      value3 = value < 0 ? [] : swatches.slice(value),
      entries = new Map<string, ColorSwatch>(),
      entries2 = new Map<string, ColorSwatch[]>();
    for (let value4 of value3) {
      if (
        isEmptySwatch(value4) ||
        swatchLabelIsColor(value4) ||
        value4.picks !== undefined
      ) {
        continue;
      }
      let value5 = swatchColorKey(value4.color);
      if (!entries.has(value5)) {
        entries.set(value5, value4);
      }
      let value6 = (value4.label ?? value4.name).replace(/^--/, "");
      entries2.set(value6, [...(entries2.get(value6) ?? []), value4]);
    }
    let callback = (
        input: string,
        options: string | undefined,
      ): ColorSwatch | undefined => {
        let value4 = entries2.get(input) ?? [];
        if (
          value4.length <= 1 ||
          value4.every(
            (input2: ColorSwatch): boolean =>
              swatchColorKey(input2.color) === swatchColorKey(value4[0]!.color),
          )
        ) {
          return value4[0];
        }
        if (options === undefined) {
          return undefined;
        } else {
          return value4.find(
            (input2: ColorSwatch): boolean =>
              swatchColorKey(input2.color) === swatchColorKey(options),
          );
        }
      },
      values = new Set<string>(),
      items: ColorSwatch[] = [];
    for (let value4 of system.colors) {
      if (items.length >= swatchPaletteColumns) {
        break;
      }
      let value5 = /^var\(\s*--([\w-]+)\s*(?:,\s*(.+?)\s*)?\)$/.exec(
          value4,
        ),
        value6 =
          value5 !== null
            ? callback(value5[1]!, value5[2])
            : entries.get(swatchColorKey(value4));
      if (value6 === undefined || values.has(value6.name)) {
        continue;
      }
      values.add(value6.name);
      items.push({
        name: "used:" + value6.name,
        color: value6.color,
        label: value6.label ?? value6.name,
        group: system.label,
        picks: value6.name,
      });
    }
    if (items.length === 0) {
      return [...swatches];
    }
    return [...value2, ...items, ...value3];
  }
  function SwatchPalette({
    title: title,
    swatches: swatches,
    current: current,
    repick = false,
    onSwatch: onSwatch,
    onPicked: onPicked,
    fold = false,
    color: color,
    kind: kind,
    face: face,
    tab: tab,
    onTab: onTab,
    headerEnd: headerEnd,
    heading: heading,
    headless = false,
    testid: testid,
    className: className,
  }: SwatchPaletteProps): ReactElement {
    let value = swatches.some(
        (input: ColorSwatch): boolean => !isEmptySwatch(input),
      ),
      value2 = value && color !== undefined,
      value3 =
        kind !== undefined && kind.options.length > 1 ? kind : undefined,
      value4 =
        value3 === undefined || value3.value === (value3.colorValue ?? "color"),
      [value5, value6] = ColorSelectReact.useState<SwatchPaletteTab>(
        () => (value && value4 ? "system" : "custom"),
      ),
      value7 = !value2
        ? color === undefined
          ? "system"
          : "custom"
        : (tab ?? value5),
      callback = (input: SwatchPaletteTab): void => {
        value6(input);
        onTab?.(input);
      },
      value8 =
        value2 &&
        (swatches.some(
          (input: ColorSwatch): boolean => input.subgroup !== undefined,
        ) ||
          swatches.length > runtime.OPTION_LIST_MAX_HEIGHT),
      [value9, value10] = ColorSelectReact.useState(""),
      value11 = value8 ? value9.trim().toLowerCase() : "",
      value12 = JSON.stringify(
        swatches.map(
          (input: ColorSwatch) => [
            input.name,
            input.color,
            input.label,
            input.group,
            input.subgroup,
            input.empty === true,
            input.disabledReason ?? null,
            input.picks ?? null,
          ],
        ),
      ),
      { shown: memo, foldedInto: memo2 } =
        ColorSelectReact.useMemo(() => {
          let entries = new Map<string, string>(),
            entries2 = new Map<string, string>(),
            items: ColorSwatch[] = [];
          for (let value19 of swatches) {
            if (isEmptySwatch(value19) || !fold) {
              items.push(value19);
              continue;
            }
            let value20 = swatchColorKey(value19.color),
              entry = entries.get(value20);
            if (entry !== undefined && swatchLabelIsColor(value19)) {
              entries2.set(value19.name, entry);
              continue;
            }
            if (entry === undefined) {
              entries.set(value20, value19.name);
            }
            items.push(value19);
          }
          return {
            shown: items,
            foldedInto: entries2,
          };
        }, [value12, fold]),
      value13 =
        current !== null ? (memo2.get(current) ?? current) : null,
      value14 = memo.filter(
        (input) =>
          (0, runtime.optionMatchesQuery)(
            value11,
            swatchLabel(input),
            input.color,
            input.subgroup,
            input.group,
          ),
      ),
      value15 = value8
        ? ColorSelectJsx.jsx(runtime.OptionList, {
            value: value9,
            onChange: value10,
            label: runtime.COLOR_SEARCH_LABEL,
            className: "mt-1 mb-2 w-0 min-w-full",
            rowSelector: "[data-swatch]",
            onEnterIndex: () =>
              (0, runtime.optionTypeaheadMatch)(
                value11,
                value14
                  .filter(
                    (input) =>
                      input.disabledReason === undefined,
                  )
                  .map((input) => swatchLabel(input)),
              ),
            "data-testid":
              testid !== undefined ? testid + "-search" : undefined,
          })
        : null,
      callback2 = (input: ColorSwatch): ReactElement => {
        let value19 = ColorSelectJsx.jsx(runtime.SwatchButton, {
          label: swatchLabel(input),
          "data-testid":
            testid !== undefined ? testid + "-" + input.name : undefined,
          "data-swatch": input.name,
          paint:
            input.empty === true ? undefined : swatchPreviewStyle(input.color),
          current:
            input.name === value13 ||
            (input.picks !== undefined && input.picks === value13),
          disabled: input.disabledReason !== undefined,
          onMouseDown: (event: MouseEvent): void => event.preventDefault(),
          onClick: () => {
            onPicked?.();
            if (
              repick ||
              (input.picks ?? input.name) !== current ||
              isEmptySwatch(input)
            ) {
              onSwatch(input.picks ?? input.name);
            }
          },
        });
        if (input.disabledReason === undefined) {
          return value19;
        } else {
          return ColorSelectJsx.jsx(runtime.DisabledReasonTooltip, {
            reason: input.disabledReason,
            wrapperClassName: "flex w-full shrink-0 cursor-not-allowed",
            children: value19,
          });
        }
      },
      callback3 = (input: ColorSwatch[], options?: string): ReactElement =>
        ColorSelectJsx.jsx(runtime.ColorPickerGroup, {
          label: title,
          className: (0, runtime.joinClassNames)("w-0 min-w-full", options),
          children: input.map(
            (input2: ColorSwatch, options2: number): ReactElement => {
              let value19 =
                  input2.group !== undefined &&
                  input2.group !== input[options2 - 1]?.group,
                value20 =
                  input2.subgroup !== undefined &&
                  (value19 ||
                    input2.subgroup !== input[options2 - 1]?.subgroup);
              return ColorSelectJsx.jsxs(
                ColorSelectReact.Fragment,
                {
                  children: [
                    value19
                      ? ColorSelectJsx.jsx(runtime.ColorPickerHeader, {
                          text: input2.group,
                          title: true,
                        })
                      : null,
                    value20
                      ? ColorSelectJsx.jsx(runtime.ColorPickerHeader, {
                          text: input2.subgroup,
                        })
                      : null,
                    callback2(input2),
                  ],
                },
                input2.name + ":" + String(options2),
              );
            },
          ),
        }),
      value16 =
        !headless && (value2 || headerEnd !== undefined)
          ? ColorSelectJsx.jsxs("div", {
              className: (0, runtime.joinClassNames)(
                "-mx-2 -mt-2 mb-1 flex items-center justify-between gap-2",
                !value2 && "order-first",
              ),
              "data-kit": "color-popover-header",
              children: [
                value2
                  ? ColorSelectJsx.jsx(runtime.ColorHexInput, {
                      value: value7,
                      onChange: callback,
                      className: "",
                    })
                  : ColorSelectJsx.jsx("span", {
                      className:
                        "min-w-0 flex-1 truncate pl-2 text-body-semibold text-primary",
                      children: heading,
                    }),
                title !== undefined && value2
                  ? ColorSelectJsx.jsx("span", {
                      className: "sr-only",
                      children: title,
                    })
                  : null,
                headerEnd,
              ],
            })
          : null,
      value17 = !value2 && color !== undefined ? memo : [],
      value18 = ColorSelectJsx.jsxs(ColorSelectJsx.Fragment, {
        children: [
          value17.length > 0
            ? ColorSelectJsx.jsx("div", {
                className: "-mx-2 mb-1 flex flex-col",
                children: callback3(value17),
              })
            : null,
          value3 !== undefined
            ? ColorSelectJsx.jsx(runtime.PropertyRow, {
                label: runtime.TYPE_LABEL,
                className: value4 ? "mb-1" : undefined,
                ...runtime.gradientStopKeyboardHandlers,
                children: ColorSelectJsx.jsx(runtime.SegmentedControl, {
                  "aria-label": value3.label ?? "Fill type",
                  fullWidth: true,
                  segments: value3.options.map(
                    (input: SwatchKindOption) => ({
                      ...(0, runtime.fillModeOption)(
                        input.value,
                        input.label,
                        value3.disabled === true ||
                          input.disabledReason !== undefined
                          ? true
                          : undefined,
                      ),
                      ...(input.disabledReason !== undefined
                        ? {
                            disabledReason: input.disabledReason,
                          }
                        : {}),
                    }),
                  ),
                  value: value3.value,
                  onChange: (input: string): void | boolean =>
                    input !== value3.value &&
                    !value3.disabled &&
                    value3.onChange(input),
                }),
              })
            : null,
          value4 && color !== undefined
            ? ColorSelectJsx.jsx(runtime.ColorPicker, {
                ...color,
              })
            : face,
        ],
      });
    return ColorSelectJsx.jsxs("div", {
      "data-kit": "color-selector",
      "data-search-scope": "",
      onKeyDown: (0, runtime.createOptionListKeyHandler)("[data-swatch]"),
      className: (0, runtime.joinClassNames)(
        "flex min-w-56 flex-col [--pp-gutter-l:0px] [--pp-gutter-r:0px] [--pp-label-w:3rem]",
        className,
      ),
      children: [
        value2 ? value16 : null,
        value7 === "system"
          ? ColorSelectJsx.jsxs("div", {
              className: (0, runtime.joinClassNames)(
                "flex min-h-0 flex-col",
                value2 ? "-mx-2" : "-m-2",
              ),
              children: [
                value15,
                value14.length > 0
                  ? callback3(
                      value14,
                      value2
                        ? "mb-[calc(-1*var(--cs-bottom,16px))] pb-[var(--cs-bottom,16px)]"
                        : undefined,
                    )
                  : ColorSelectJsx.jsx("p", {
                      role: "status",
                      className: "px-2 py-1 text-footnote text-muted",
                      children: runtime.NO_COLOR_MATCHES_LABEL,
                    }),
              ],
            })
          : value18,
        value2 ? null : value16,
      ],
    });
  }
  function normalizeColorSwatches(
    swatches: readonly ColorSwatchInput[] | undefined,
    allowEmpty: boolean,
    disabledReason?: string,
  ): ColorSwatch[] {
    let value = (swatches ?? []).map(
      (input: ColorSwatchInput): ColorSwatch =>
        typeof input === "string"
          ? {
              name: input,
              color: input,
            }
          : "value" in input
            ? {
                name: input.name,
                color: input.value,
                label: input.label,
                group: input.group,
                subgroup: input.subgroup,
                ...(input.picks !== undefined
                  ? {
                      picks: input.picks,
                    }
                  : {}),
              }
            : input,
    );
    if (!allowEmpty) {
      return value;
    }
    let state: ColorSwatch = {
      name: emptySwatchValue,
      label: "None",
      color: "transparent",
      empty: true,
      group: value[0]?.group,
      subgroup: value[0]?.subgroup,
    };
    if (disabledReason !== undefined) {
      state.disabledReason = disabledReason;
    }
    return [state, ...value];
  }
  function ColorSelect({
    value: value,
    unset: unset,
    opaque: opaque,
    onChange: onChange,
    onPickEnd: onPickEnd,
    contrast: contrast,
    swatches: swatches,
    none: none,
    current: current,
    onSwatch: onSwatch,
    ...props
  }: ColorSelectProps): ReactElement {
    let memo = ColorSelectReact.useMemo(
        () =>
          normalizeColorSwatches(
            swatches,
            none !== undefined,
            none?.disabledReason,
          ),
        [swatches, none !== undefined, none?.disabledReason],
      ),
      callback = (input: string | undefined): string =>
        (0, runtime.rgbaHexColor)({
          ...(0, runtime.parseCssColorToHsva)(input),
          ...(opaque
            ? {
                a: 1,
              }
            : {}),
        }),
      value2 = JSON.stringify(
        memo.map((input: ColorSwatch) => [input.name, input.color]),
      ),
      memo2 = ColorSelectReact.useMemo(
        () =>
          memo.map(
            (input: ColorSwatch): string | null =>
              input.empty === true ? null : callback(input.color),
          ),
        [value2, opaque],
      ),
      memo3 = ColorSelectReact.useMemo(() => {
        if (none?.current) {
          return emptySwatchValue;
        }
        if (current !== undefined) {
          return current;
        }
        if (unset) {
          return null;
        }
        let value3 = callback(value),
          value4 = memo2.indexOf(value3);
        if (value4 < 0) {
          return null;
        } else {
          return memo[value4]!.picks ?? memo[value4]!.name;
        }
      }, [memo, memo2, value, unset, opaque, none?.current, current]);
    return ColorSelectJsx.jsx(SwatchPalette, {
      ...props,
      swatches: memo,
      current: memo3,
      onSwatch: (input: string): void => {
        if (input === emptySwatchValue) {
          return none?.onPick();
        }
        if (onSwatch !== undefined) {
          return onSwatch(input);
        }
        let value3 = memo.find(
          (input2: ColorSwatch): boolean => input2.name === input,
        );
        if (value3 === undefined) {
          return;
        }
        let value4 = callback(value3.color);
        onChange(value4);
        onPickEnd?.(value4);
        if (contrast !== undefined) {
          (0, runtime.announceLiveMessage)(() => {
            let value5 = (0, runtime.colorContrastResults)(
              value4,
              contrast,
            );
            if (value5 === undefined) {
              return null;
            } else {
              return (0, runtime.contrastDisplayInfo)(value5).spoken;
            }
          });
        }
      },
      color: {
        value: value,
        unset: unset,
        opaque: opaque,
        onChange: onChange,
        onPickEnd: onPickEnd,
        contrast: contrast,
      },
    });
  }
  bindRuntimeValue(runtime, "swatchPreviewStyle", () => swatchPreviewStyle);
  bindRuntimeValue(runtime, "swatchColorKey", () => swatchColorKey);
  bindRuntimeValue(runtime, "colorsEqual", () => colorsEqual);
  bindRuntimeValue(
    runtime,
    "mergeDesignSystemSwatches",
    () => mergeDesignSystemSwatches,
  );
  bindRuntimeValue(runtime, "SwatchPalette", () => SwatchPalette);
  bindRuntimeValue(
    runtime,
    "normalizeColorSwatches",
    () => normalizeColorSwatches,
  );
  bindRuntimeValue(runtime, "ColorSelect", () => ColorSelect);
  bindRuntimeValue(
    runtime,
    "ColorSelectReact",
    () => ColorSelectReact,
    (value) => {
      ColorSelectReact = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ColorSelectJsx",
    () => ColorSelectJsx,
    (value) => {
      ColorSelectJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "symbolicColorPattern",
    () => symbolicColorPattern,
    (value) => {
      symbolicColorPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "unsafeColorPattern",
    () => unsafeColorPattern,
    (value) => {
      unsafeColorPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "swatchLabel",
    () => swatchLabel,
    (value) => {
      swatchLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isEmptySwatch",
    () => isEmptySwatch,
    (value) => {
      isEmptySwatch = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "swatchLabelIsColor",
    () => swatchLabelIsColor,
    (value) => {
      swatchLabelIsColor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "swatchPaletteColumns",
    () => swatchPaletteColumns,
    (value) => {
      swatchPaletteColumns = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "emptySwatchValue",
    () => emptySwatchValue,
    (value) => {
      emptySwatchValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeColorSelect",
    () => initializeColorSelect,
    (value) => {
      initializeColorSelect = value;
    },
  );
  return () => {
    swatchLabel = (input: Pick<ColorSwatch, "label" | "name">): string =>
      input.label ?? input.name[0]!.toUpperCase() + input.name.slice(1);
    isEmptySwatch = (input: Pick<ColorSwatch, "empty" | "name">): boolean =>
      input.empty === true || input.name === "default";
    swatchLabelIsColor = (input: Pick<ColorSwatch, "label" | "name">): boolean =>
      /^(#|rgba?\(|hsla?\()/i.test((input.label ?? input.name).trim());
    swatchPaletteColumns = 12;
    emptySwatchValue = ":none";
    initializeColorSelect = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeUiInputs210)();
      (0, runtime.initializeUiAnnouncements)();
      (0, runtime.initializeUiContrast)();
      (0, runtime.initializeUiContrastControls)();
      (0, runtime.initializeUiColorPicker)();
      (0, runtime.initializeGradientEditor)();
      (0, runtime.initializeIconButton)();
      (0, runtime.initializeUiInspectorIcons)();
      (0, runtime.initializeUiPropertySearch)();
      (0, runtime.initializeUiPropertyRow3)();
      (0, runtime.initializeUiPropertyLabels)();
      ColorSelectReact = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      ColorSelectJsx = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      symbolicColorPattern = /^\s*(var|color-mix)\(/i;
      unsafeColorPattern =
        /url\s*\(|image(-set)?\s*\(|src\s*\(|cross-fade\s*\(|element\s*\(|\\/i;
    });
  };
}
