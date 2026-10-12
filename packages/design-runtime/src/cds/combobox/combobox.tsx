import type {
  AccessibleNameProps,
  ComboboxBridgeProps,
  ComboboxChipProps,
  ComboboxChipsProps,
  ComboboxFooterActionProps,
  ComboboxGroupMap,
  ComboboxHostProps,
  ComboboxItemPartProps,
  ComboboxKey,
  ComboboxLabelInput,
  ComboboxLabelResult,
  ComboboxOption,
  ComboboxPartProps,
  ComboboxPopupProps,
  ComboboxPopupViewProps,
  ComboboxProps,
  ComboboxRegistration,
  ComboboxRowProps,
  ComboboxStatusProps,
  ComboboxTriggerProps,
  ComboboxValueProps,
  DesignStyle,
  ForwardComponent,
  GenericComboboxRow,
  ImperativeComboboxDetails,
  LabelResolver,
  MobileSheetParts,
  OverlayChange,
  PopupInputKind,
  SheetPopupState,
  SheetRenderState,
  VirtualComboboxActions,
  VirtualComboboxProps,
} from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsComboboxCombobox(
  runtime: RuntimeBindings,
): () => void {
  var ComboboxComboboxFontSizeBodyFontSizeCaptionFontSizeCodeConfig: {
    "font-size-body": {
      compact: number;
      comfortable: number;
      steps: number[];
      textSize: {
        compact: {
          sm: number;
          lg: number;
        };
        comfortable: {
          sm: number;
          lg: number;
        };
      };
    };
    "font-size-caption": {
      compact: number;
      comfortable: number;
      steps: number[];
    };
    "font-size-code": {
      compact: number;
      comfortable: number;
    };
    "font-size-footnote": {
      compact: number;
      comfortable: number;
    };
    "font-size-heading": {
      compact: number;
      comfortable: number;
      textSize: {
        compact: {
          sm: number;
          lg: number;
        };
        comfortable: {
          sm: number;
          lg: number;
        };
      };
    };
    "font-size-prose": {
      compact: number;
      comfortable: number;
      steps: number[];
      textSize: string;
    };
    "font-size-title": {
      compact: number;
      comfortable: number;
    };
    "leading-body": {
      compact: number;
      comfortable: number;
      steps: number[];
      textSize: {
        compact: {
          sm: number;
          lg: number;
        };
        comfortable: {
          sm: number;
          lg: number;
        };
      };
    };
    "leading-caption": {
      compact: number;
      comfortable: number;
    };
    "leading-code": {
      compact: number;
      comfortable: number;
    };
    "leading-footnote": {
      compact: number;
      comfortable: number;
    };
    "leading-heading": {
      compact: number;
      comfortable: number;
      textSize: {
        compact: {
          sm: number;
          lg: number;
        };
        comfortable: {
          sm: number;
          lg: number;
        };
      };
    };
    "leading-prose": {
      compact: number;
      comfortable: number;
      steps: number[];
      textSize: string;
    };
    "leading-title": {
      compact: number;
      comfortable: number;
    };
  };
  var initializeComboboxCombobox: () => void;
  var initializeComboboxCombobox_2: () => void;
  var reactComboboxCombobox: typeof React;
  var initializeComboboxCombobox_3: () => void;
  var reactComboboxCombobox_2: typeof React;
  var jsxComboboxCombobox: typeof import("react/jsx-runtime");
  var ComboboxComboboxConstant: number;
  var ComboboxComboboxClassNames: string;
  var ComboboxComboboxCss: string;
  var ComboboxStatus: ForwardComponent<HTMLDivElement, ComboboxStatusProps>;
  var initializeComboboxCombobox_4: () => void;
  var reactComboboxCombobox_3: typeof React;
  var jsxComboboxCombobox_2: typeof import("react/jsx-runtime");
  var ComboboxComboboxConstant_2: number;
  var ComboboxComboboxConstant_3: number;
  var initializeComboboxCombobox_5: () => void;
  var reactComboboxCombobox_4: typeof React;
  var jsxComboboxCombobox_3: typeof import("react/jsx-runtime");
  var ComboboxComboboxClassNames_2: string;
  var ComboboxComboboxOutlineGhostConfig: {
    outline: string;
    ghost: string;
  };
  var ComboboxComboboxSelectInputConfig: {
    select: string;
    input: string;
  };
  var ComboboxComboboxCss_2: string;
  var ComboboxComboboxClassNames_3: string;
  var ComboboxComboboxClassNames_4: string;
  var ComboboxComboboxClassNames_5: string;
  var ComboboxComboboxLabel: string;
  var ComboboxComboboxClassNames_6: string;
  var ComboboxComboboxCss_3: string;
  var ComboboxComboboxClassNames_7: string;
  var ComboboxComboboxClassNames_8: string;
  var ComboboxComboboxClassNames_9: string;
  var comboboxGroupLabelClasses: string;
  var ComboboxComboboxLabel_2: string;
  var ComboboxComboboxClassNames_10: string;
  var SeparatorValue: string;
  var ComboboxComboboxClassNames_11: string;
  var comboboxInputClasses: string;
  var ComboboxComboboxCss_4: string;
  var ComboboxComboboxClassNames_12: string;
  var ComboboxComboboxClassNames_13: string;
  var ComboboxComboboxLabel_3: string;
  var ComboboxComboboxConstant_4: number;
  var ComboboxComboboxConstant_5: number;
  var ComboboxComboboxConstant_6: number;
  var ComboboxComboboxConstant_7: number;
  var ComboboxComboboxToLowerCase: (input: string) => string;
  var ComboboxComboboxGetLabel: (input: ComboboxOption<ComboboxKey>) => string;
  var ComboboxComboboxGetValue: (input: ComboboxOption<ComboboxKey>) => string;
  var ComboboxChip: ForwardComponent<HTMLDivElement, ComboboxChipProps>;
  var comboboxOutsideInputClasses: string;
  var ComboboxChipRemove: ForwardComponent<
    HTMLButtonElement,
    ComboboxPartProps<"ChipRemove">
  >;
  var ComboboxItem: GenericComboboxRow;
  var ComboboxTrigger: ForwardComponent<
    HTMLButtonElement,
    ComboboxTriggerProps
  >;
  var ComboboxValue: ForwardComponent<HTMLSpanElement, ComboboxValueProps>;
  var ComboboxComboboxAutoCompleteData1pIgnoreDataLpignoreConfig: {
    autoComplete: string;
    "data-1p-ignore": boolean;
    "data-lpignore": string;
  };
  var ComboboxInput: ForwardComponent<
    HTMLInputElement,
    ComboboxPartProps<"Input">
  >;
  var ComboboxPopupSearch: ForwardComponent<
    HTMLInputElement,
    ComboboxPartProps<"Input">
  >;
  var ComboboxClear: ForwardComponent<
    HTMLButtonElement,
    ComboboxPartProps<"Clear">
  >;
  var ComboboxFooterAction: ForwardComponent<
    HTMLButtonElement,
    ComboboxFooterActionProps
  >;
  var ComboboxPopup: ForwardComponent<HTMLDivElement, ComboboxPopupProps>;
  var ComboboxSheetCapablePopup: ForwardComponent<
    HTMLDivElement,
    ComboboxPopupProps
  >;
  var ComboboxPopupView: ForwardComponent<
    HTMLDivElement,
    ComboboxPopupViewProps
  >;
  var ComboboxList: ForwardComponent<HTMLDivElement, ComboboxPartProps<"List">>;
  var ComboboxEmpty: ForwardComponent<
    HTMLDivElement,
    ComboboxPartProps<"Empty">
  >;
  var ComboboxItemAlias: ForwardComponent<
    HTMLDivElement,
    ComboboxItemPartProps
  >;
  var ComboboxItemIndicator: ForwardComponent<
    HTMLSpanElement,
    ComboboxPartProps<"ItemIndicator">
  >;
  var ComboboxGroupLabel: ForwardComponent<
    HTMLDivElement,
    ComboboxPartProps<"GroupLabel">
  >;
  var ComboboxChips: ForwardComponent<HTMLDivElement, ComboboxChipsProps>;
  var ComboboxRegistrationContext: React.Context<ComboboxRegistration | null>;
  var ComboboxTriggerHiddenContext: React.Context<boolean>;
  var ComboboxInputInsidePopupContext: React.Context<boolean>;
  var ComboboxComboboxHandler: () => null;
  var ComboboxComboboxAssignValue: typeof Combobox & {
    Root: typeof ComboboxRoot;
    Trigger: typeof ComboboxTrigger;
    Value: typeof ComboboxValue;
    Caret: typeof ComboboxCaret;
    Input: typeof ComboboxInput;
    Popup: typeof ComboboxPopup;
    PopupSearch: typeof ComboboxPopupSearch;
    Clear: typeof ComboboxClear;
    List: typeof ComboboxList;
    Empty: typeof ComboboxEmpty;
    Status: typeof ComboboxStatus;
    Item: typeof ComboboxItemAlias;
    ItemIndicator: typeof ComboboxItemIndicator;
    Group: typeof import("@base-ui/react/combobox").Combobox.Group;
    GroupLabel: typeof ComboboxGroupLabel;
    Chips: typeof ComboboxChips;
    Chip: typeof ComboboxChip;
    ChipRemove: typeof ComboboxChipRemove;
    Separator: typeof ComboboxSeparator;
    Footer: typeof ComboboxFooter;
    FooterAction: typeof ComboboxFooterAction;
    Collection: typeof import("@base-ui/react/combobox").Combobox.Collection;
  };
  var initializeComboboxCombobox_6: () => void;
  function comboboxLabelProps({
    reactId: reactId,
    label: label,
    triggerPrefix: triggerPrefix,
    mode: mode,
    triggerMode: triggerMode,
    insideField: insideField,
  }: ComboboxLabelInput): ComboboxLabelResult {
    let value = label ? `${reactId}-label` : undefined,
      value2 = mode === "select" && triggerMode !== "chips",
      value3 =
        value !== undefined ||
        (!insideField && (triggerPrefix !== undefined || value2)),
      value4 = value3 ? `${reactId}-trigger` : undefined,
      value5 = value3 && value2 ? `${reactId}-trigger-value` : undefined,
      value6 =
        (value3 && [value, value5].filter(Boolean).join(" ")) || undefined;
    return {
      labelId: value,
      triggerId: value4,
      triggerValueId: value5,
      ownLabelProps:
        value3 && value4
          ? {
              id: value4,
              "aria-labelledby": value6,
            }
          : undefined,
    };
  }
  function copyTriggerLabelProps(
    element: Element | null | undefined,
    {
      fallback: options,
      fromTextEntry: options2 = false,
    }: {
      fallback?: string;
      fromTextEntry?: boolean;
    } = {},
  ): AccessibleNameProps {
    if (
      element == null ||
      (!options2 && (0, runtime.isTextInputElement)(element))
    )
      return {};
    let ownerDocument = element.ownerDocument,
      value = (element.getAttribute("aria-labelledby") ?? "")
        .split(/\s+/)
        .filter((input) => {
          if (input === "") return false;
          let value2 = ownerDocument.getElementById(input);
          return value2 !== null && !element.contains(value2);
        });
    if (value.length > 0)
      return {
        "aria-labelledby": value.join(" "),
      };
    for (let value2 of [element.getAttribute("aria-label"), options]) {
      let value3 = value2?.trim();
      if (value3 !== undefined && value3 !== "")
        return {
          "aria-label": value3,
        };
    }
    return {};
  }
  function useTriggerLabelProps(
    input: React.Ref<HTMLElement> | undefined,
    options: () => Element | null | undefined,
    context: AccessibleNameProps,
    {
      fallback: value,
      fromTextEntry: value2 = false,
    }: {
      fallback?: string;
      fromTextEntry?: boolean;
    } = {},
  ): {
    ref: React.RefCallback<HTMLElement>;
    nameProps: AccessibleNameProps;
  } {
    let [value3, value4] = (0,
      reactComboboxCombobox.useState)<AccessibleNameProps>({}),
      value5 =
        context["aria-label"] !== undefined ||
        context["aria-labelledby"] !== undefined,
      value6 = (0, reactComboboxCombobox.useCallback)(
        (input2: HTMLElement | null): void => {
          if (input2 === null || value5) return;
          let value7 = copyTriggerLabelProps(options(), {
            fallback: value,
            fromTextEntry: value2,
          });
          value4((input3) =>
            input3["aria-labelledby"] === value7["aria-labelledby"] &&
            input3["aria-label"] === value7["aria-label"]
              ? input3
              : value7,
          );
        },
        [value5, options, value, value2],
      );
    return {
      ref: (0, runtime.useMergedRefs)(input, value6),
      nameProps: value5 ? context : value3,
    };
  }
  function useDelayElapsed(input: number): boolean {
    let [value, value2] = (0, reactComboboxCombobox_2.useState)(input <= 0);
    (0, reactComboboxCombobox_2.useEffect)(() => {
      if (input <= 0) return;
      let value3 = window.setTimeout(() => value2(true), input);
      return () => window.clearTimeout(value3);
    }, [input]);
    return input <= 0 || value;
  }
  function DelayedContent({
    ms: ms2,
    children: children,
  }: {
    ms: number;
    children?: React.ReactNode;
  }): React.ReactNode {
    return useDelayElapsed(ms2) ? children : null;
  }
  function VirtualComboboxRows({
    count: count,
    estimateItemSize: estimateItemSize,
    estimateRowSize: estimateRowSize,
    scrollEl: scrollEl,
    actionsRef: actionsRef,
    getItemKey: getItemKey,
    renderRow: renderRow,
  }: VirtualComboboxProps): React.ReactElement {
    "use no memo";

    let callback = (input: number): number =>
        estimateRowSize?.(input) ?? estimateItemSize,
      value = (0, runtime.npm_useVirtualizer_m7e)({
        count: count,
        getItemKey: getItemKey,
        getScrollElement: () => scrollEl,
        estimateSize: callback,
        measureElement: (input, options, context) =>
          Math.max(
            (0, runtime.npm_measureElement_mve)(input, options, context),
            callback(context.indexFromElement(input)),
          ),
        overscan: ComboboxComboboxConstant_2,
        scrollPaddingStart: 28,
        scrollPaddingEnd: 28,
        enabled: scrollEl !== null,
      });
    (0, reactComboboxCombobox_3.useImperativeHandle)(
      actionsRef,
      () => ({
        scrollToIndex: (input) => value.scrollToIndex(input),
      }),
      [value],
    );
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      value.measure();
    }, [value, estimateItemSize]);
    let value2 = value.getVirtualItems();
    return (
      <div
        data-row-pitch={estimateItemSize}
        style={{
          minHeight: `${value.getTotalSize()}px`,
          position: "relative",
        }}
      >
        {value2.length > 0 ? (
          value2.map((input) =>
            (() => {
              const _Component = "div";
              const _props = {
                ref: value.measureElement,
                "data-index": input.index,
                style: {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${input.start}px)`,
                },
                children: renderRow(input.index),
              } as const;
              const _key = input.key;
              return <_Component key={_key} {..._props} />;
            })(),
          )
        ) : count > 0 ? (
          <div aria-hidden={true} className={"flex flex-col gap-1 px-md py-1"}>
            {Array.from<undefined, React.ReactElement>(
              {
                length: ComboboxComboboxConstant_3,
              },
              (input, options) => (
                <runtime.ComponentsSkeletonAssignValue
                  key={options}
                  height={estimateItemSize - 8}
                  className={"w-full"}
                />
              ),
            )}
          </div>
        ) : null}
      </div>
    );
  }
  function comboboxMaxHeightStyle(
    input?: number,
    options?: number,
  ): DesignStyle | undefined {
    if (!(input === undefined || !(input > 0)))
      return {
        "--cds-popup-max-h": "var(--available-height)",
        "--cds-popup-list-max-h":
          options !== undefined
            ? `calc(${input} * ${options}px)`
            : `calc(${input} * ${ComboboxComboboxLabel_2})`,
      };
  }
  function comboboxItemMatchesSearch<Value extends ComboboxKey>(
    input: ComboboxOption<Value>,
    options: string,
  ): boolean {
    let value = ComboboxComboboxToLowerCase(options);
    return (
      ComboboxComboboxToLowerCase(input.label).includes(value) ||
      ComboboxComboboxToLowerCase(input.value).includes(value)
    );
  }
  function comboboxSelectionLabel<Value extends ComboboxKey>(
    items: readonly ComboboxOption<Value>[],
    options?: string,
    context?: LabelResolver,
  ): string {
    let [value] = items;
    return value !== undefined && items.length === 1
      ? value.label
      : options !== undefined
        ? `${items.length} ${options}`
        : (0, runtime.resolveLabel)(context, "nSelected", "{count} selected", {
            count: items.length,
          });
  }
  function comboboxVisibleGroups<Value extends ComboboxKey>(
    input: readonly ComboboxOption<Value>[],
    options: (item: ComboboxOption<Value>) => boolean,
    context: boolean,
  ): ComboboxGroupMap<Value> {
    let entries: Map<Value, string> = new Map(),
      values: Set<Value> = new Set(),
      entries2: Map<Value, string> = new Map();
    if (!context) {
      for (let value3 of input)
        value3.groupLabelBefore !== undefined &&
          options(value3) &&
          entries.set(value3.value, value3.groupLabelBefore);
      return {
        captionAbove: entries,
        separatorAbove: values,
        runLabel: entries2,
      };
    }
    let value: string | undefined,
      value2:
        | {
            label: string;
            separator: boolean;
            start: Value;
          }
        | undefined;
    for (let value3 of input) {
      value3.groupLabelBefore !== undefined
        ? ((value = value3.groupLabelBefore),
          (value2 = {
            label: value,
            separator: value3.separatorBefore === true,
            start: value3.value,
          }))
        : value3.separatorBefore && ((value = undefined), (value2 = undefined));
      value !== undefined &&
        (entries2.set(value3.value, value),
        value2 !== undefined &&
          options(value3) &&
          (entries.set(value3.value, value2.label),
          value2.separator &&
            value2.start !== value3.value &&
            values.add(value3.value),
          (value2 = undefined)));
    }
    return {
      captionAbove: entries,
      separatorAbove: values,
      runLabel: entries2,
    };
  }
  function Combobox<Value extends ComboboxKey>(
    input: ComboboxProps<Value>,
  ): React.ReactElement {
    let {
        "data-cds": value34 = "Combobox",
        mode: value35 = "select",
        variant: value36 = "outline",
        items: value,
        searchable: value2,
        indicator: value3,
        placeholder: value4,
        searchPlaceholder: value5,
        triggerPrefix: value6,
        label: value7,
        "aria-label": value8,
        "aria-labelledby": value9,
        "aria-describedby": value10,
        "aria-required": value11,
        clearable: value37 = false,
        clearLabel: value12,
        closeLabel: value13,
        hideCaret: value38 = false,
        filter: value14,
        autoHighlight: value15,
        onInputChange: value16,
        onOpenChange: value17,
        footerDivider: value39 = true,
        emptyMessage: value18,
        isLoading: value40 = false,
        loadingStaleAfter: value19,
        footer: value20,
        renderItem: value21,
        announceGroupLabels: value41 = false,
        virtualized: value42 = false,
        estimateItemSize: value22,
        hasMore: value43 = false,
        isFetchingMore: value44 = false,
        onLoadMore: value23,
        paginationKey: value24,
        popupClassName: value25,
        layerOffset: value26,
        maxVisibleItems: value27,
        align: value45 = "start",
        collisionPadding: value28,
        disabled: value29,
        required: value30,
        name: value31,
        size: value32,
        fullWidth: value46 = true,
        className: value33,
      } = input,
      value47 = (0, reactComboboxCombobox_4.useContext)(
        runtime.LabelsProviderContext,
      ),
      value48 = (0, runtime.useLabel)("clearSelection", "Clear selection"),
      value49 = value12 ?? value48,
      value50 = (0, runtime.useLabel)("noResults", ComboboxComboboxLabel_3),
      value51 = value18 ?? value50,
      value52 = value2 ?? (value.length > 5 || value16 !== undefined),
      value53 = input.multiple === true,
      value54 = input.multiple ? (input.triggerMode ?? "summary") : null,
      value55 = (input.multiple && input.popupSearchInChips) ?? false,
      value56 = (input.multiple && input.groupSelected) ?? false,
      value57 = input.multiple && (input.selectAllFooter ?? false),
      value58 = value3 ?? (value53 ? "checkbox" : "check"),
      value59 = (0, runtime.useFieldInvalid)(),
      value60 = (0, runtime.isInsideField)(),
      value61 = (0, runtime.useFieldDisabled)(),
      value62 = value29 || value61,
      value63 = input.value !== undefined,
      [value64, value65] = (0, reactComboboxCombobox_4.useState)(() =>
        input.multiple
          ? (input.defaultValue ?? [])
          : (input.defaultValue ?? null),
      ),
      value66: Value[] | undefined = (
        input.multiple ? (value63 ? input.value : value64) : undefined
      ) as Value[] | undefined,
      value67: Value | null | undefined = (
        input.multiple ? undefined : value63 ? input.value : value64
      ) as Value | null | undefined,
      value68 = (0, reactComboboxCombobox_4.useMemo)(
        () => new Map(value.map((input2) => [input2.value, input2])),
        [value],
      ),
      value69 = (0, reactComboboxCombobox_4.useMemo)(() => {
        if (input.multiple)
          return (value66 ?? [])
            .map((input2) => value68.get(input2))
            .filter((input2) => input2 !== undefined);
        let value125 = value67 ?? null,
          value126 = value125 === null ? undefined : value68.get(value125);
        return value126 ? [value126] : [];
      }, [input.multiple, value66, value67, value68]),
      value70 = value69[0] ?? null,
      value71 = value69.length > 0,
      value72 = (0, reactComboboxCombobox_4.useRef)(input);
    (0, reactComboboxCombobox_4.useEffect)(() => {
      value72.current = input;
    }, [input]);
    let value73 = (0, reactComboboxCombobox_4.useRef)(value69);
    (0, reactComboboxCombobox_4.useEffect)(() => {
      value73.current = value69;
    }, [value69]);
    let value74 = (0, reactComboboxCombobox_4.useRef)(value66);
    (0, reactComboboxCombobox_4.useEffect)(() => {
      value74.current = value66;
    }, [value66]);
    let value75 = (0, reactComboboxCombobox_4.useCallback)(
        (
          input2: ComboboxOption<Value> | ComboboxOption<Value>[] | null,
          options?: import("@base-ui/react/combobox").Combobox.Root.ChangeEventDetails,
        ): void => {
          let current = value72.current;
          if (current.multiple) {
            let value125:
                | ComboboxOption<Value>[]
                | ComboboxOption<Value>
                | null = (input2 ?? []) as ComboboxOption<Value>[],
              values = new Set(value125.map((input3) => input3.value)),
              value126 = value73.current.filter(
                (input3) => input3.disabled && !values.has(input3.value),
              );
            if (value126.length > 0) {
              value125 = [...value125, ...value126];
              let values2 = new Set(value74.current ?? []);
              if (
                value125.length === values2.size &&
                value125.every((input3) => values2.has(input3.value))
              )
                return;
            }
            let value127 = value125.map((input3) => input3.value);
            value63 || value65(value127);
            current.onChange?.(value127);
          } else {
            let value125:
              | ComboboxOption<Value>[]
              | ComboboxOption<Value>
              | null = input2 as ComboboxOption<Value> | null;
            if (value125?.disabled) {
              options?.cancel();
              return;
            }
            let value126 = value125?.value ?? null;
            value63 || value65(value126);
            current.onChange?.(value126);
          }
        },
        [value63],
      ),
      value76 = (0, reactComboboxCombobox_4.useCallback)(() => {
        let values = new Set(value69.map((input2) => input2.value));
        value75(
          value72.current.items.filter(
            (input2) => !input2.disabled || values.has(input2.value),
          ),
        );
      }, [value75, value69]),
      value77 = (0, reactComboboxCombobox_4.useCallback)(() => {
        value75([]);
      }, [value75]),
      [value78, value79] = (0, reactComboboxCombobox_4.useState)(false),
      [value80, value81] = (0, reactComboboxCombobox_4.useState)(""),
      value82 = (0,
      reactComboboxCombobox_4.useRef)<VirtualComboboxActions | null>(null),
      value83 = (0, reactComboboxCombobox_4.useCallback)(
        (input2: string): void => {
          value81(input2);
          value16?.(input2);
          value42 && value82.current?.scrollToIndex(0);
        },
        [value16, value42],
      ),
      value84 = (0, reactComboboxCombobox_4.useCallback)(
        (
          input2: boolean,
          options?: import("@base-ui/react/combobox").Combobox.Root.ChangeEventDetails,
        ): void => {
          if (value53 && !input2 && options?.reason === "item-press") {
            options.cancel?.();
            value83("");
            return;
          }
          value79(input2);
          value17?.(input2);
          input2 || value81("");
        },
        [value53, value17, value83],
      ),
      value85 = (0, reactComboboxCombobox_4.useCallback)(
        () => value84(false),
        [value84],
      ),
      value86 = (0, reactComboboxCombobox_4.useRef)<{
        close: () => void;
      } | null>(null);
    (0, reactComboboxCombobox_4.useImperativeHandle)(
      value86,
      () => ({
        close: value85,
      }),
      [value85],
    );
    let value87 = (0, reactComboboxCombobox_4.useMemo)(
        () => new Set(value69.map((input2) => input2.value)),
        [value69],
      ),
      value88 = (0, reactComboboxCombobox_4.useMemo)(() => {
        if (!value56) return value;
        let value125 = value.slice();
        value125.sort(
          (input2, options) =>
            (value87.has(input2.value) ? 0 : 1) -
            (value87.has(options.value) ? 0 : 1),
        );
        return value125;
      }, [value, value56, value87]),
      value89 = (0, reactComboboxCombobox_4.useMemo)(() => {
        if (!value42 || !value52) return value88;
        let value125 = value80.trim();
        if (!value125) return value88;
        let value126 = value14 ?? comboboxItemMatchesSearch;
        return value88.filter((input2) => value126(input2, value125));
      }, [value42, value52, value88, value80, value14]),
      value90 = (0, reactComboboxCombobox_4.useRef)(value89);
    (0, reactComboboxCombobox_4.useEffect)(() => {
      value90.current = value89;
    }, [value89]);
    let value91 = (0, reactComboboxCombobox_4.useCallback)(
        (
          input2: ComboboxOption<Value> | undefined,
          options: import("@base-ui/react/combobox").Combobox.Root.HighlightEventDetails,
        ): void => {
          if (options.reason !== "keyboard" || !input2) return;
          let value125 = value90.current.findIndex(
            (input3) => input3.value === input2.value,
          );
          value125 >= 0 && value82.current?.scrollToIndex(value125);
        },
        [],
      ),
      value92 = (0, reactComboboxCombobox_4.useMemo)<
        ((item: ComboboxOption<Value>, query: string) => boolean) | null
      >(() => {
        if (value42 || (!value52 && value35 === "select")) return null;
        let value125 = value14 ?? comboboxItemMatchesSearch;
        return (input2, options) => value125(input2, options);
      }, [value42, value52, value35, value14]),
      value93 = (0, reactComboboxCombobox_4.useMemo)(() => {
        let value125 = value80.trim();
        if (!value92 || value125 === "") return value89.length;
        let index = 0;
        for (let value126 of value89)
          value92(value126, value125) && (index += 1);
        return index;
      }, [value92, value89, value80]),
      value94 = value40 && value19 !== undefined,
      value95 = value21,
      value96 = (0, reactComboboxCombobox_4.useCallback)(
        (
          input2: ComboboxOption<Value>,
          options: ComboboxGroupMap<Value> | null,
          context: boolean,
          value125?: number,
        ): React.ReactElement =>
          (() => {
            const _Component2 = ComboboxItem;
            const _props2 = {
              item: input2,
              index: value125,
              wrapDescription: value125 === undefined,
              selected: value87.has(input2.value),
              stale: value94,
              renderItem: value95,
              searchQuery: value95 ? value80 : "",
              indicator: value58,
              leadsList: context,
              separatorAbove:
                options?.separatorAbove.has(input2.value) ?? false,
              groupCaption: options?.captionAbove.get(input2.value),
              announcedGroupLabel: value41
                ? options?.runLabel.get(input2.value)
                : undefined,
            } as const;
            const _key2 = input2.value;
            return <_Component2 key={_key2} {..._props2} />;
          })(),
        [value95, value80, value58, value87, value94, value41],
      ),
      value97 = (0, reactComboboxCombobox_4.useRef)<HTMLDivElement | null>(
        null,
      ),
      value98 = (0, reactComboboxCombobox_4.useRef)(false),
      value99 = (0, reactComboboxCombobox_4.useRef)(false);
    (0, reactComboboxCombobox_4.useEffect)(() => {
      value99.current = value78;
    }, [value78]);
    (0, reactComboboxCombobox_4.useEffect)(() => {
      if (value35 !== "input") return;
      let value125 = value97.current?.ownerDocument ?? document,
        value126 = value125.defaultView ?? window,
        callback2 = () => {
          value98.current = value99.current;
          let callback3 = () => {
            value126.removeEventListener("pointerup", callback3);
            value126.removeEventListener("pointercancel", callback3);
            value126.setTimeout(() => {
              value98.current = false;
            }, 0);
          };
          value126.addEventListener("pointerup", callback3);
          value126.addEventListener("pointercancel", callback3);
        };
      value125.addEventListener("pointerdown", callback2, {
        capture: true,
        passive: true,
      });
      return () => {
        value125.removeEventListener("pointerdown", callback2, {
          capture: true,
        });
      };
    }, [value35]);
    let value100 = (0, reactComboboxCombobox_4.useCallback)(() => {
        value97.current?.querySelector("input")?.focus();
      }, []),
      { clickToFocusProps: value101 } = (0, runtime.useClickToFocus)(
        () => {
          value78 || value98.current || value100();
        },
        {
          disabled: value62,
        },
      ),
      value102 = (0, reactComboboxCombobox_4.useMemo)(
        () =>
          new Set(
            value69
              .filter((input2) => input2.disabled)
              .map((input2) => input2.value),
          ),
        [value69],
      ),
      value103 =
        input.multiple === true &&
        (value66 ?? []).some((input2) => !value102.has(input2)),
      value104 = value71 && (!input.multiple || value103),
      value105 = value37 && value104,
      value106 = !value38 && !(value37 && value63 && value104),
      value107 =
        value35 === "select" &&
        value52 &&
        (value54 !== "chips" || value55) &&
        (value.length > 0 || value40 || value16 !== undefined),
      value108 = value35 === "select" && value54 !== "chips" && !value107,
      value109 =
        value15 ??
        (!value56 &&
          value14 === undefined &&
          (value35 === "input" || value107)),
      callback = () => {
        let callback2 = (input2: React.ReactNode): React.ReactNode =>
          value70?.icon === undefined ? (
            input2
          ) : (
            <span className={"flex min-w-0 items-center gap-2"}>
              <runtime.IconRenderer icon={value70.icon} />
              <span className={"min-w-0 truncate"}>{input2}</span>
            </span>
          );
        if (input.multiple) {
          let value125 =
            input.renderTriggerValue?.(value69) ??
            (value69.length === 0
              ? (value4 ?? "\xA0")
              : comboboxSelectionLabel(value69, input.summaryNoun, value47));
          return value6 !== undefined ? (
            <span className={"flex min-w-0 items-baseline gap-1.5"}>
              <span className={"shrink-0 text-muted"}>{value6}</span>
              <span className={"min-w-0 truncate"}>{value125}</span>
            </span>
          ) : value69.length === 0 ? (
            <span className={"font-normal text-muted"}>{value125}</span>
          ) : (
            value125
          );
        }
        if (value6 !== undefined) {
          let value125 =
            input.renderTriggerValue?.(value70) ?? value70?.label ?? value4;
          return (
            <span className={"flex min-w-0 items-baseline gap-1.5"}>
              <span className={"shrink-0 text-muted"}>{value6}</span>
              {value125 !== undefined && (
                <span className={"min-w-0 truncate"} title={value70?.label}>
                  {callback2(value125)}
                </span>
              )}
            </span>
          );
        }
        if (input.renderTriggerValue) {
          let value125 = input.renderTriggerValue(value70);
          if (value125 != null) return callback2(value125);
        }
        return value70 ? (
          callback2(value70.label)
        ) : (
          <span className={"font-normal text-muted"}>{value4 ?? "\xA0"}</span>
        );
      },
      value110 = value106 && (
        <span
          aria-hidden={true}
          className={
            "pointer-events-none flex size-icon shrink-0 items-center justify-center text-muted"
          }
        >
          <runtime.Icon name={"CaretDown"} size={"sm"} />
        </span>
      ),
      value111 = value105 && (value35 === "select" || !value106),
      text =
        "[--fh:var(--cds-h-control)] [--fhn:var(--cds-h-control-nested)] [--fr:var(--cds-radius)]",
      value112 = value105 && (
        <span
          className={
            value111
              ? `flex aspect-square h-control shrink-0 items-center justify-center ${text}`
              : `flex shrink-0 items-center ${text}`
          }
        >
          <runtime.npm_Combobox_Yi.Clear
            render={
              <runtime.Button
                iconOnly={true}
                variant={"ghost"}
                size={value32 === "sm" || value32 === "xs" ? "xs" : "sm"}
                icon={"X"}
                aria-label={value49}
                tooltip={false}
                className={
                  "!size-[var(--fhn)] !rounded-[calc(var(--fr)-(var(--fh)-var(--fhn))/2)] data-[ending-style]:hidden"
                }
              />
            }
          />
        </span>
      ),
      value113 = value46 ? "w-full min-w-0" : "shrink-0",
      value114 = (0, reactComboboxCombobox_4.useId)(),
      {
        labelId: value115,
        triggerId: value116,
        triggerValueId: value117,
        ownLabelProps: value118,
      } = comboboxLabelProps({
        reactId: value114,
        label: value7,
        triggerPrefix: value6,
        mode: value35,
        triggerMode: value54,
        insideField: value60,
      }),
      state = {
        ...(value9 !== undefined
          ? {
              ...(value118 && {
                id: value118.id,
              }),
              ...(value8 !== undefined && {
                "aria-label": value8,
              }),
              "aria-labelledby": value9,
            }
          : value8 !== undefined && !value7
            ? {
                ...(value118 && {
                  id: value118.id,
                }),
                "aria-label": value8,
              }
            : value118 || value8 !== undefined
              ? {
                  ...value118,
                  ...(value8 !== undefined && {
                    "aria-label": value8,
                  }),
                }
              : value118),
        ...(value10 !== undefined && {
          "aria-describedby": value10,
        }),
        ...(value11 && {
          "aria-required": true,
        }),
      },
      value119 = value111 ? "pr-0" : "pr-sm",
      value120 =
        value69.length > 0
          ? "pl-[calc((var(--cds-h-control)-var(--cds-h-control-nested))/2)]"
          : "pl-sm",
      value121 =
        value54 === "chips"
          ? `${ComboboxComboboxCss_2} ${value120} ${value113}`
          : `${ComboboxComboboxClassNames_2} ${ComboboxComboboxOutlineGhostConfig[value36]} ${ComboboxComboboxSelectInputConfig[value35]} ${value119} ${value113}`,
      value122 = (0, runtime.useSheetInteractionMode)(),
      value123 = (
        <runtime.npm_Combobox_Yi.Root
          multiple={value53}
          items={value42 ? value89 : value88}
          value={value53 ? value69 : value70}
          onValueChange={value75}
          open={value78}
          onOpenChange={value84}
          {...(value35 === "select"
            ? {
                inputValue: value80,
              }
            : {})}
          onInputValueChange={value83}
          onItemHighlighted={value42 ? value91 : undefined}
          virtualized={value42}
          filter={value92}
          autoHighlight={value109}
          itemToStringLabel={ComboboxComboboxGetLabel}
          itemToStringValue={ComboboxComboboxGetValue}
          disabled={value62}
          required={value30}
          name={value31}
        >
          {value54 === "chips" ? (
            <div
              ref={value97}
              data-cds={value34}
              {...(0, runtime.getSizeAttribute)(value32)}
              className={(0, runtime.cn)(value121, value33)}
              data-disabled={value62 || undefined}
              data-invalid={value59 || undefined}
              onMouseDown={value101.onMouseDown}
              onClick={
                value62
                  ? undefined
                  : (event: React.MouseEvent<HTMLElement>) => {
                      event.preventDefault();
                      value78 || (value100(), value84(true));
                    }
              }
            >
              <runtime.npm_Combobox_Yi.Chips
                className={`${ComboboxComboboxClassNames_6} ${value78 ? "" : "pointer-events-none"}`}
              >
                {value69.map((input2) =>
                  (() => {
                    const _Component3 = ComboboxChip;
                    const _props3 = {
                      removable: value78 && !input2.disabled,
                      children: input2.label,
                    } as const;
                    const _key3 = input2.value;
                    return <_Component3 key={_key3} {..._props3} />;
                  })(),
                )}
                <runtime.npm_Combobox_Yi.Input
                  className={`${ComboboxComboboxClassNames_5} ${value69.length === 0 && value4 === undefined ? "min-w-[2ch]" : ""}`}
                  placeholder={value69.length === 0 ? value4 : undefined}
                  disabled={value62}
                  {...state}
                  autoComplete={"off"}
                  data-1p-ignore={true}
                  data-lpignore={"true"}
                />
              </runtime.npm_Combobox_Yi.Chips>
              {value110}
            </div>
          ) : value35 === "input" ? (
            <div
              ref={value97}
              data-cds={value34}
              {...(0, runtime.getSizeAttribute)(value32)}
              className={(0, runtime.cn)(value121, value33)}
              data-disabled={value62 || undefined}
              data-invalid={value59 || undefined}
              onMouseDown={value101.onMouseDown}
              onClick={
                value62
                  ? undefined
                  : (event: React.MouseEvent<HTMLElement>) => {
                      let current = value98.current;
                      value98.current = false;
                      let ancestor = (event.target as Element).closest(
                        "button",
                      );
                      (ancestor && event.currentTarget.contains(ancestor)) ||
                        (event.preventDefault(),
                        !value78 && !current && (value100(), value84(true)));
                    }
              }
            >
              <runtime.npm_Combobox_Yi.Input
                className={ComboboxComboboxClassNames_4}
                placeholder={value4}
                disabled={value62}
                {...state}
                autoComplete={"off"}
                data-1p-ignore={true}
                data-lpignore={"true"}
              />
              {value112}
              {value110}
            </div>
          ) : (
            <div
              ref={value97}
              data-cds={value34}
              {...(0, runtime.getSizeAttribute)(value32)}
              className={(0, runtime.cn)(value121, value33)}
              data-disabled={value62 || undefined}
              data-invalid={value59 || undefined}
            >
              <runtime.npm_Combobox_Yi.Trigger
                disabled={value62}
                {...state}
                className={ComboboxComboboxClassNames_3}
              >
                <span id={value117} className={"min-w-0 flex-1 truncate"}>
                  {callback()}
                </span>
                {value106 && (
                  <runtime.Icon
                    name={"CaretDown"}
                    size={"sm"}
                    className={
                      "mr-0.5 shrink-0 text-muted transition-colors group-hover/cbx:text-secondary"
                    }
                  />
                )}
              </runtime.npm_Combobox_Yi.Trigger>
              {value112}
            </div>
          )}
          <runtime.npm_Combobox_Yi.Portal
            container={(0, runtime.useOverlayRoot)()}
          >
            <ComboboxSheetBridge
              anchorRef={value97}
              align={value45}
              collisionPadding={value28}
              popupClassName={value25}
              layerOffset={value26}
              maxVisibleItems={value27}
              dataCds={value34}
              isLoading={value40}
              loadingStaleAfter={value19}
              showPopupSearch={value107}
              focusListOnOpen={value108}
              searchPlaceholder={value5 ?? value4}
              triggerPrefix={value6}
              chipsPopupSearch={value54 === "chips" && value107}
              disabled={value62}
              virtualized={value42}
              sortedItems={value88}
              displayedItems={value89}
              renderedItemCount={value93}
              estimateItemSize={value22}
              hasMore={value43}
              isFetchingMore={value44}
              onLoadMore={value23}
              paginationKey={value24}
              virtualRowsRef={value82}
              emptyMessage={value51}
              groupSelected={value56}
              renderListItem={value96}
              valueSet={value87}
              searchQuery={value80}
              showSelectAllFooter={value57}
              footer={value20}
              footerDivider={value39}
              handleSelectAll={value76}
              handleClearAll={value77}
              selectAllDisabled={value.every(
                (input2) => input2.disabled || value87.has(input2.value),
              )}
              clearAllDisabled={!value103}
              close={value85}
              closeLabel={value13}
            />
          </runtime.npm_Combobox_Yi.Portal>
        </runtime.npm_Combobox_Yi.Root>
      ),
      value124 = (
        <runtime.ActivityBoundary actionsRef={value86}>
          {value122 ? (
            <runtime.SheetPopupRender
              open={value78}
              close={value85}
              onOpenChange={value84}
              structurallyAnchored={value35 !== "select" || value54 === "chips"}
            >
              {(input2: SheetPopupState) =>
                (0, reactComboboxCombobox_4.cloneElement)(
                  value123 as React.ReactElement<{
                    modal?: boolean;
                    onOpenChange?: OverlayChange;
                    onOpenChangeComplete?: (open: boolean) => void;
                  }>,
                  {
                    modal: input2.modal,
                    onOpenChange: input2.onOpenChange,
                    onOpenChangeComplete: input2.onOpenChangeComplete,
                  },
                )
              }
            </runtime.SheetPopupRender>
          ) : (
            value123
          )}
        </runtime.ActivityBoundary>
      );
    return value115 === undefined ? (
      value124
    ) : (
      <div
        className={`gap-xs flex-col font-sans ${value46 ? "flex w-full" : "inline-flex"}`}
      >
        <label
          id={value115}
          htmlFor={value116}
          className={"text-body text-primary font-medium leading-none"}
        >
          {value7}
        </label>
        {value124}
      </div>
    );
  }
  function comboboxTriggerForInputKind(
    input: PopupInputKind,
    options: HTMLElement | null | undefined,
    context: HTMLElement | null | undefined,
    value: HTMLElement | null | undefined,
  ): HTMLElement | undefined {
    return input === "touch"
      ? (options ?? undefined)
      : (context ?? value ?? options ?? undefined);
  }
  function ComboboxSheetBridge<Value extends ComboboxKey>(
    input: ComboboxBridgeProps<Value>,
  ): React.ReactElement {
    return (0, runtime.isInsideSheetPopup)() ? (
      <ComboboxSheetPopup {...input} />
    ) : (
      <ComboboxPopupHost
        {...input}
        sheetPopup={runtime.SheetsPopupStackSheetConcealedChromeConfig}
        sheetParts={null}
      />
    );
  }
  function ComboboxSheetPopup<Value extends ComboboxKey>(
    input: ComboboxBridgeProps<Value>,
  ): React.ReactElement {
    return (
      <runtime.SheetCapablePopup kind={"combobox"}>
        {(input2: SheetRenderState, options: MobileSheetParts | null) => (
          <ComboboxPopupHost
            {...input}
            sheetPopup={input2}
            sheetParts={options}
          />
        )}
      </runtime.SheetCapablePopup>
    );
  }
  function ComboboxPopupHost<Value extends ComboboxKey>({
    sheetPopup: sheetPopup,
    sheetParts: sheetParts,
    anchorRef: anchorRef,
    align: align,
    collisionPadding: collisionPadding,
    popupClassName: popupClassName,
    layerOffset: layerOffset,
    maxVisibleItems: maxVisibleItems,
    dataCds: dataCds,
    isLoading: isLoading,
    loadingStaleAfter: loadingStaleAfter,
    showPopupSearch: showPopupSearch,
    focusListOnOpen: focusListOnOpen,
    searchPlaceholder: searchPlaceholder,
    triggerPrefix: triggerPrefix,
    chipsPopupSearch: chipsPopupSearch,
    disabled: disabled2,
    virtualized: virtualized,
    sortedItems: sortedItems,
    displayedItems: displayedItems,
    renderedItemCount: renderedItemCount,
    estimateItemSize: estimateItemSize,
    hasMore: hasMore,
    isFetchingMore: isFetchingMore,
    onLoadMore: onLoadMore,
    paginationKey: paginationKey,
    virtualRowsRef: virtualRowsRef,
    emptyMessage: emptyMessage,
    groupSelected: groupSelected,
    renderListItem: renderListItem,
    valueSet: valueSet,
    searchQuery: searchQuery,
    showSelectAllFooter: showSelectAllFooter,
    footer: footer,
    footerDivider: footerDivider,
    handleSelectAll: handleSelectAll,
    handleClearAll: handleClearAll,
    selectAllDisabled: selectAllDisabled,
    clearAllDisabled: clearAllDisabled,
    close: close,
    closeLabel: closeLabel,
  }: ComboboxHostProps<Value>): React.ReactElement {
    let value = (0, runtime.useLabel)("loadingOptions", "Loading options"),
      value2 = (0, runtime.useLabel)(
        "loadingMoreOptions",
        "Loading more options",
      ),
      value3 = isLoading && renderedItemCount === 0,
      value4 = (0, runtime.useLabel)("selectAll", "Select all"),
      value5 = (0, runtime.useLabel)("clear", "Clear"),
      [value6, value7] = (0,
      reactComboboxCombobox_4.useState)<HTMLDivElement | null>(null),
      value8 = (0, runtime.useRootFontSize)(),
      value9 = (0, runtime.useDensity)(),
      sheet = sheetPopup.sheet,
      value10 = sheet
        ? (ComboboxComboboxFontSizeBodyFontSizeCaptionFontSizeCodeConfig[
            "leading-body"
          ].steps[(0, runtime.getControlSizeRank)("comfortable", "lg") - 1] ??
          ComboboxComboboxFontSizeBodyFontSizeCaptionFontSizeCodeConfig[
            "leading-body"
          ].comfortable)
        : ComboboxComboboxFontSizeBodyFontSizeCaptionFontSizeCodeConfig[
            "leading-body"
          ][value9],
      value11 =
        estimateItemSize === undefined
          ? Math.ceil(
              Math.max(ComboboxComboboxConstant_4 / 16, value10 + 0.5) * value8,
            )
          : value8 === 16
            ? estimateItemSize
            : Math.ceil((estimateItemSize * value8) / 16),
      value12 =
        runtime.npm_Combobox_Yi.useFilteredItems<ComboboxOption<Value>>(),
      value13 = virtualized ? displayedItems : value12,
      value14 = !(groupSelected && valueSet.size > 0),
      value15 = (0, reactComboboxCombobox_4.useMemo)(() => {
        if (!sortedItems.some((input) => input.groupLabelBefore !== undefined))
          return null;
        let values = new Set(value13.map((input) => input.value));
        return comboboxVisibleGroups(
          sortedItems,
          (input) => values.has(input.value),
          value14,
        );
      }, [sortedItems, value13, value14]),
      value16 = value13[0]?.value,
      value17 = (0, reactComboboxCombobox_4.useCallback)(
        (input: ComboboxOption<Value>): React.ReactNode =>
          renderListItem(input, value15, input.value === value16),
        [renderListItem, value15, value16],
      ),
      value18 = (0, reactComboboxCombobox_4.useCallback)(
        (input: number): string | number => {
          let value39 = displayedItems[input];
          return value39 === undefined ? input : value39.value;
        },
        [displayedItems],
      ),
      value19 = (0, reactComboboxCombobox_4.useCallback)(
        (input: number): React.ReactNode => {
          let value39 = displayedItems[input];
          return value39 === undefined
            ? null
            : renderListItem(value39, value15, input === 0, input);
        },
        [displayedItems, renderListItem, value15],
      ),
      value20 = onLoadMore !== undefined,
      [value21, value22] = (0,
      reactComboboxCombobox_4.useState)<HTMLDivElement | null>(null),
      value23 = (0, reactComboboxCombobox_4.useRef)(onLoadMore);
    (0, reactComboboxCombobox_4.useEffect)(() => {
      value23.current = onLoadMore;
    }, [onLoadMore]);
    let value24: React.RefObject<number | null> = (0,
    reactComboboxCombobox_4.useRef)<number | null>(null);
    (0, reactComboboxCombobox_4.useEffect)(() => {
      value24.current = null;
    }, [searchQuery, paginationKey]);
    let value25 = (0, reactComboboxCombobox_4.useRef)(renderedItemCount);
    (0, reactComboboxCombobox_4.useEffect)(() => {
      renderedItemCount < value25.current && (value24.current = null);
      value25.current = renderedItemCount;
    }, [renderedItemCount]);
    (0, reactComboboxCombobox_4.useEffect)(() => {
      if (
        !value21 ||
        !value6 ||
        !value20 ||
        isFetchingMore ||
        renderedItemCount === 0 ||
        (value24.current !== null && renderedItemCount <= value24.current)
      )
        return;
      let value39 = new IntersectionObserver(
        ([input]) => {
          input?.isIntersecting &&
            (value39.disconnect(),
            (value24.current = renderedItemCount),
            value23.current?.());
        },
        {
          root: value6,
          rootMargin: `0px 0px ${value11 * ComboboxComboboxConstant_7}px 0px`,
        },
      );
      value39.observe(value21);
      return () => value39.disconnect();
    }, [
      value21,
      value6,
      value20,
      isFetchingMore,
      renderedItemCount,
      searchQuery,
      paginationKey,
      value11,
    ]);
    let value26 = (0, runtime.useLayer)("combobox", layerOffset),
      value27 = sheetPopup.sheet ? sheetPopup.chrome : null,
      value28 = sheetPopup.sheet && sheetParts !== null ? sheetParts : null,
      value29 = (0, reactComboboxCombobox_4.useContext)(
        runtime.SheetStackContext,
      ),
      value30 = sheet
        ? Math.max(value11, Math.ceil((40 * value8) / 16))
        : value11,
      value31 = (0, reactComboboxCombobox_4.useCallback)(
        (input: number): number => {
          let value39 = displayedItems[input];
          if (value39 === undefined) return value30;
          let value40 =
              input > 0 &&
              (value39.separatorBefore ||
                (value15?.separatorAbove.has(value39.value) ?? false)),
            value41 = value15?.captionAbove.has(value39.value) ?? false;
          return (
            value30 +
            (value40 ? ComboboxComboboxConstant_5 : 0) +
            (value41 ? ComboboxComboboxConstant_6 : 0)
          );
        },
        [displayedItems, value15, value30],
      ),
      value32 = (0, reactComboboxCombobox_4.useRef)<HTMLDivElement | null>(
        null,
      ),
      value33 = (0, runtime.useMergedRefs)(value32, sheetPopup.ref),
      value34 = (0, reactComboboxCombobox_4.useCallback)(
        () => anchorRef.current?.querySelector('[role="combobox"]'),
        [anchorRef],
      ),
      value35 = (0, reactComboboxCombobox_4.useRef)<HTMLElement | null>(null),
      { ref: value36, nameProps: value37 } = useTriggerLabelProps(
        value35,
        value34,
        {},
        {
          fallback: triggerPrefix,
          fromTextEntry: chipsPopupSearch,
        },
      ),
      value38 = (0, reactComboboxCombobox_4.useCallback)(
        (input: PopupInputKind): HTMLElement | undefined =>
          comboboxTriggerForInputKind(
            input,
            value32.current,
            null,
            value35.current,
          ),
        [],
      );
    return (
      <runtime.PopupSurface
        {...value26.portalProps}
        style={
          sheetPopup.concealed
            ? {
                ...value26.portalProps.style,
                ...runtime.OverlaysBackdropVisibilityOpacityConfig,
              }
            : value26.portalProps.style
        }
        surface={runtime.surfaceBackgroundTokens.popover}
        density={sheet ? runtime.ComfortableValue : undefined}
        closeOnActivityHide={true}
      >
        {value28 !== null && sheetPopup.sheet && (
          <value28.ComboboxSheetBackdrop sheetPopup={sheetPopup} />
        )}
        <runtime.LayerBaseContext.Provider value={value26.base}>
          <runtime.npm_Combobox_Yi.Positioner
            style={
              sheetPopup.positionerStyle !== undefined
                ? {
                    ...value26.style,
                    ...sheetPopup.positionerStyle,
                  }
                : value26.style
            }
            anchor={anchorRef}
            side={"bottom"}
            align={align}
            sideOffset={6}
            collisionPadding={collisionPadding}
            positionMethod={"fixed"}
            {...(sheet
              ? runtime.SheetsLayoutDisableAnchorTrackingCollisionAvoidanceConfig
              : {})}
            className={(0, runtime.cn)(
              popupClassName ?? "w-[var(--anchor-width)] min-w-[12rem]",
              sheet &&
                (
                  sheetPopup.state as {
                    depth: number;
                  }
                ).depth === 0 &&
                "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-[100dvh] after:bg-surface-3",
            )}
          >
            <runtime.npm_Combobox_Yi.Popup
              ref={value33}
              data-cds={dataCds}
              initialFocus={focusListOnOpen ? value38 : undefined}
              {...value37}
              {...sheetPopup.attrs}
              className={(0, runtime.cn)(
                ComboboxComboboxCss_3,
                sheet && runtime.PlatformReducedMotionCss_2,
                sheet &&
                  "data-[starting-style]:translate-y-[calc(100%+1.5rem)] data-[ending-style]:translate-y-[calc(100%+1.5rem)]",
                sheet &&
                  "origin-top [&[data-cds-sheet-covered]:not([data-starting-style]):not([data-ending-style])]:-translate-y-3 data-[cds-sheet-covered]:scale-[0.94] after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-backdrop after:opacity-0 after:transition-opacity after:duration-sheet motion-reduce:after:transition-none data-[cds-sheet-covered]:after:opacity-100",
              )}
              style={{
                ...(sheet
                  ? undefined
                  : comboboxMaxHeightStyle(
                      maxVisibleItems,
                      virtualized ? value30 : undefined,
                    )),
                ...(loadingStaleAfter !== undefined && {
                  "--cds-combobox-stale-after": `${loadingStaleAfter}ms`,
                }),
                ...sheetPopup.style,
              }}
              aria-busy={isLoading || isFetchingMore}
            >
              {value27 !== null && <value27.Handle />}
              <runtime.SheetStackContext.Provider
                value={sheet ? sheetPopup.stack : value29}
              >
                <div className={ComboboxComboboxClassNames_7}>
                  {showPopupSearch && (
                    <runtime.npm_Combobox_Yi.Input
                      className={ComboboxComboboxClassNames_9}
                      placeholder={searchPlaceholder}
                      disabled={disabled2}
                      {...value37}
                      autoComplete={"off"}
                      data-1p-ignore={true}
                      data-lpignore={"true"}
                    />
                  )}
                  <div
                    ref={virtualized || value20 ? value7 : undefined}
                    tabIndex={-1}
                    className={ComboboxComboboxClassNames_8}
                    {...{
                      [runtime.sheetScrollAttribute]: "",
                    }}
                  >
                    <jsxComboboxCombobox_3.Fragment>
                      <runtime.npm_Combobox_Yi.Empty
                        className={ComboboxComboboxCss_4}
                      >
                        {isLoading || isFetchingMore ? null : emptyMessage}
                      </runtime.npm_Combobox_Yi.Empty>
                      <runtime.npm_Combobox_Yi.List
                        ref={value36}
                        tabIndex={-1}
                        {...value37}
                        className={`cds-reset outline-none focus-visible:outline-hidden ${groupSelected ? comboboxInputClasses : ""}`}
                      >
                        {virtualized ? (
                          <VirtualComboboxRows
                            count={displayedItems.length}
                            estimateItemSize={value30}
                            estimateRowSize={value31}
                            scrollEl={value6}
                            actionsRef={virtualRowsRef}
                            getItemKey={value18}
                            renderRow={value19}
                          />
                        ) : (
                          value17
                        )}
                      </runtime.npm_Combobox_Yi.List>
                      {hasMore && value20 && !isLoading && (
                        <div
                          ref={value22}
                          aria-hidden={true}
                          className={"h-px"}
                        />
                      )}
                      <ComboboxStatus
                        delay={0}
                        loading={value3 || isFetchingMore}
                        loadingLabel={value3 ? value : value2}
                      />
                    </jsxComboboxCombobox_3.Fragment>
                  </div>
                  {(showSelectAllFooter || footer) && (
                    <jsxComboboxCombobox_3.Fragment>
                      {footerDivider && (
                        <div
                          aria-hidden={true}
                          className={ComboboxComboboxClassNames_12}
                        />
                      )}
                      <div
                        className={
                          footerDivider
                            ? ComboboxComboboxClassNames_13
                            : "shrink-0"
                        }
                      >
                        {showSelectAllFooter && (
                          <div
                            className={
                              "flex items-center justify-between gap-sm p-1"
                            }
                          >
                            <runtime.Button
                              variant={"ghost"}
                              size={"sm"}
                              onClick={handleSelectAll}
                              disabled={selectAllDisabled}
                            >
                              {value4}
                            </runtime.Button>
                            <runtime.Button
                              variant={"ghost"}
                              size={"sm"}
                              onClick={handleClearAll}
                              disabled={clearAllDisabled}
                            >
                              {value5}
                            </runtime.Button>
                          </div>
                        )}
                        {footer &&
                          (typeof footer == "function"
                            ? footer({
                                close: close,
                              })
                            : footer)}
                      </div>
                    </jsxComboboxCombobox_3.Fragment>
                  )}
                  {value27 !== null && (
                    <value27.DismissButton
                      onDismiss={close}
                      label={closeLabel}
                    />
                  )}
                </div>
              </runtime.SheetStackContext.Provider>
            </runtime.npm_Combobox_Yi.Popup>
          </runtime.npm_Combobox_Yi.Positioner>
        </runtime.LayerBaseContext.Provider>
      </runtime.PopupSurface>
    );
  }
  function registerOutsideComboboxInput(): void {
    let value = (0, reactComboboxCombobox_4.useContext)(
        ComboboxRegistrationContext,
      ),
      value2 = (0, reactComboboxCombobox_4.useContext)(
        ComboboxInputInsidePopupContext,
      );
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      if (!(value === null || value2)) return value.addOutsideInput();
    }, [value, value2]);
  }
  function useComboboxTriggerRef(
    input?: React.Ref<HTMLElement>,
  ): React.RefCallback<HTMLElement> {
    let value = (0, reactComboboxCombobox_4.useContext)(
        ComboboxRegistrationContext,
      ),
      value2 = useRegisteredElementRef(
        (0, reactComboboxCombobox_4.useContext)(ComboboxInputInsidePopupContext)
          ? undefined
          : value?.setTrigger,
        value?.getTrigger,
      );
    return (0, runtime.useMergedRefs)(input, value2);
  }
  function useComboboxPopupInputRef(
    input?: React.Ref<HTMLElement>,
  ): React.RefCallback<HTMLElement> {
    let value = (0, reactComboboxCombobox_4.useContext)(
        ComboboxRegistrationContext,
      ),
      value2 = useRegisteredElementRef(
        (0, reactComboboxCombobox_4.useContext)(ComboboxInputInsidePopupContext)
          ? value?.setPopupInput
          : undefined,
        value?.getPopupInput,
      );
    return (0, runtime.useMergedRefs)(input, value2);
  }
  function useComboboxTriggerGetter(): () => HTMLElement | null {
    let value = (0, reactComboboxCombobox_4.useContext)(
      ComboboxRegistrationContext,
    );
    return (0, reactComboboxCombobox_4.useContext)(ComboboxTriggerHiddenContext)
      ? ComboboxComboboxHandler
      : (value?.getTrigger ?? ComboboxComboboxHandler);
  }
  function useComboboxInputLabel(
    input: React.Ref<HTMLElement> | undefined,
    options?: string,
    context?: string,
  ): {
    ref: React.RefCallback<HTMLElement>;
    nameProps: AccessibleNameProps;
  } {
    let value = (0, reactComboboxCombobox_4.useContext)(
        ComboboxInputInsidePopupContext,
      ),
      value2 = useComboboxTriggerGetter();
    return useTriggerLabelProps(
      input,
      value ? value2 : ComboboxComboboxHandler,
      {
        ...(options !== undefined && {
          "aria-label": options,
        }),
        ...(context !== undefined && {
          "aria-labelledby": context,
        }),
      },
    );
  }
  function useComboboxListRef(
    input?: React.Ref<HTMLElement>,
  ): React.RefCallback<HTMLElement> {
    let value = (0, reactComboboxCombobox_4.useContext)(
        ComboboxRegistrationContext,
      ),
      value2 = useRegisteredElementRef(value?.setList, value?.getList);
    return (0, runtime.useMergedRefs)(input, value2);
  }
  function useRegisteredElementRef(
    input: ((element: HTMLElement | null) => void) | undefined,
    options: (() => HTMLElement | null) | undefined,
  ): React.RefCallback<HTMLElement> {
    let value = (0, reactComboboxCombobox_4.useRef)<HTMLElement | null>(null);
    return (0, reactComboboxCombobox_4.useCallback)(
      (input2: HTMLElement | null) => {
        input === undefined ||
          options === undefined ||
          (input2 !== null
            ? ((value.current = input2), input(input2))
            : options() === value.current && input(null));
      },
      [input, options],
    );
  }
  function ComboboxCaret({
    className: className,
  }: {
    className?: string;
  }): React.ReactElement {
    return (
      <span
        aria-hidden={true}
        className={(0, runtime.cn)(
          "pointer-events-none flex size-icon shrink-0 items-center justify-center text-muted",
          className,
        )}
      >
        <runtime.Icon name={"CaretDown"} size={"sm"} />
      </span>
    );
  }
  function ComboboxSeparator({
    className: className,
  }: {
    className?: string;
  }): React.ReactElement {
    return (
      <runtime.npm_Combobox_Yi.Separator
        className={(0, runtime.cn)(ComboboxComboboxClassNames_10, className)}
        data-cds-part={SeparatorValue}
      />
    );
  }
  function ComboboxFooter({
    className: className,
    children: children,
  }: React.PropsWithChildren<{
    className?: string;
  }>): React.ReactElement {
    return (
      <jsxComboboxCombobox_3.Fragment>
        <div aria-hidden={true} className={ComboboxComboboxClassNames_12} />
        <div
          className={(0, runtime.cn)(ComboboxComboboxClassNames_13, className)}
        >
          {children}
        </div>
      </jsxComboboxCombobox_3.Fragment>
    );
  }
  function imperativeComboboxCloseDetails(): ImperativeComboboxDetails {
    let state: ImperativeComboboxDetails = {
      reason: "close-press",
      event: new Event("base-ui"),
      trigger: undefined,
      isCanceled: false,
      isPropagationAllowed: false,
      cancel() {
        state.isCanceled = true;
      },
      allowPropagation() {
        state.isPropagationAllowed = true;
      },
    };
    return state;
  }
  function ComboboxRoot<Value, Multiple extends boolean = false>(
    input: import("@base-ui/react/combobox").Combobox.Root.Props<
      Value,
      Multiple
    >,
  ): React.ReactElement {
    let value: React.RefObject<{
        inputOutsidePopup: number;
        trigger: HTMLElement | null;
        popupInput: HTMLElement | null;
        list: HTMLElement | null;
      }> = (0, reactComboboxCombobox_4.useRef)({
        inputOutsidePopup: 0,
        trigger: null,
        popupInput: null,
        list: null,
      }),
      [value2, value3] = (0, reactComboboxCombobox_4.useState)(false),
      value4: ComboboxRegistration = (0,
      reactComboboxCombobox_4.useMemo)<ComboboxRegistration>(
        () => ({
          addOutsideInput: () => (
            (value.current.inputOutsidePopup += 1),
            value3(true),
            () => {
              value.current.inputOutsidePopup -= 1;
              value3(value.current.inputOutsidePopup > 0);
            }
          ),
          hasOutsideInput: () => value.current.inputOutsidePopup > 0,
          setTrigger: (input2) => {
            value.current.trigger = input2;
          },
          getTrigger: () => value.current.trigger,
          setPopupInput: (input2) => {
            value.current.popupInput = input2;
          },
          getPopupInput: () => value.current.popupInput,
          setList: (input2) => {
            value.current.list = input2;
          },
          getList: () => value.current.list,
        }),
        [],
      ),
      value5 = (0, runtime.useSheetInteractionMode)();
    return (
      <ComboboxRegistrationContext.Provider value={value4}>
        <ComboboxTriggerHiddenContext.Provider value={value2}>
          <ComboboxInputInsidePopupContext.Provider value={false}>
            {value5 ? (
              <RegisteredComboboxRoot rootProps={input} registration={value4} />
            ) : (
              <runtime.npm_Combobox_Yi.Root {...input} />
            )}
          </ComboboxInputInsidePopupContext.Provider>
        </ComboboxTriggerHiddenContext.Provider>
      </ComboboxRegistrationContext.Provider>
    );
  }
  function RegisteredComboboxRoot<Value, Multiple extends boolean = false>({
    rootProps: rootProps,
    registration: registration,
  }: {
    rootProps: import("@base-ui/react/combobox").Combobox.Root.Props<
      Value,
      Multiple
    >;
    registration: ComboboxRegistration;
  }): React.ReactElement {
    let value = (0, runtime.useOverlayOpenState)(rootProps),
      { onOpenChange: value2 } = value,
      value3 = (0, reactComboboxCombobox_4.useCallback)(() => {
        value2(
          false,
          imperativeComboboxCloseDetails() as import("@base-ui/react/combobox").Combobox.Root.ChangeEventDetails,
        );
      }, [value2]),
      value4 = (0, runtime.useOpenSnapshot)(
        value.open,
        registration.hasOutsideInput,
        false,
      ),
      value5 = (0, runtime.useSheetPopup)({
        open: value.open,
        close: value3,
        onOpenChange: value.onOpenChange,
        onOpenChangeComplete: rootProps.onOpenChangeComplete,
        structurallyAnchored: value4,
        closable: !(
          rootProps.open !== undefined && rootProps.onOpenChange === undefined
        ),
      });
    return (
      <runtime.SheetPopupProvider value={value5}>
        <runtime.npm_Combobox_Yi.Root
          {...rootProps}
          open={value.open}
          modal={value5.modal ?? rootProps.modal}
          onOpenChange={value5.onOpenChange}
          onOpenChangeComplete={value5.onOpenChangeComplete}
        />
      </runtime.SheetPopupProvider>
    );
  }
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxFontSizeBodyFontSizeCaptionFontSizeCodeConfig",
    () => ComboboxComboboxFontSizeBodyFontSizeCaptionFontSizeCodeConfig,
    (value) => {
      ComboboxComboboxFontSizeBodyFontSizeCaptionFontSizeCodeConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComboboxCombobox",
    () => initializeComboboxCombobox,
    (value) => {
      initializeComboboxCombobox = value;
    },
  );
  bindRuntimeValue(runtime, "comboboxLabelProps", () => comboboxLabelProps);
  bindRuntimeValue(
    runtime,
    "initializeComboboxCombobox_2",
    () => initializeComboboxCombobox_2,
    (value) => {
      initializeComboboxCombobox_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "copyTriggerLabelProps",
    () => copyTriggerLabelProps,
  );
  bindRuntimeValue(runtime, "useTriggerLabelProps", () => useTriggerLabelProps);
  bindRuntimeValue(
    runtime,
    "reactComboboxCombobox",
    () => reactComboboxCombobox,
    (value) => {
      reactComboboxCombobox = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComboboxCombobox_3",
    () => initializeComboboxCombobox_3,
    (value) => {
      initializeComboboxCombobox_3 = value;
    },
  );
  bindRuntimeValue(runtime, "useDelayElapsed", () => useDelayElapsed);
  bindRuntimeValue(runtime, "DelayedContent", () => DelayedContent);
  bindRuntimeValue(
    runtime,
    "reactComboboxCombobox_2",
    () => reactComboboxCombobox_2,
    (value) => {
      reactComboboxCombobox_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxComboboxCombobox",
    () => jsxComboboxCombobox,
    (value) => {
      jsxComboboxCombobox = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxConstant",
    () => ComboboxComboboxConstant,
    (value) => {
      ComboboxComboboxConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxClassNames",
    () => ComboboxComboboxClassNames,
    (value) => {
      ComboboxComboboxClassNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxCss",
    () => ComboboxComboboxCss,
    (value) => {
      ComboboxComboboxCss = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxStatus",
    () => ComboboxStatus,
    (value) => {
      ComboboxStatus = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComboboxCombobox_4",
    () => initializeComboboxCombobox_4,
    (value) => {
      initializeComboboxCombobox_4 = value;
    },
  );
  bindRuntimeValue(runtime, "VirtualComboboxRows", () => VirtualComboboxRows);
  bindRuntimeValue(
    runtime,
    "reactComboboxCombobox_3",
    () => reactComboboxCombobox_3,
    (value) => {
      reactComboboxCombobox_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxComboboxCombobox_2",
    () => jsxComboboxCombobox_2,
    (value) => {
      jsxComboboxCombobox_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxConstant_2",
    () => ComboboxComboboxConstant_2,
    (value) => {
      ComboboxComboboxConstant_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxConstant_3",
    () => ComboboxComboboxConstant_3,
    (value) => {
      ComboboxComboboxConstant_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComboboxCombobox_5",
    () => initializeComboboxCombobox_5,
    (value) => {
      initializeComboboxCombobox_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "comboboxMaxHeightStyle",
    () => comboboxMaxHeightStyle,
  );
  bindRuntimeValue(
    runtime,
    "comboboxItemMatchesSearch",
    () => comboboxItemMatchesSearch,
  );
  bindRuntimeValue(
    runtime,
    "comboboxSelectionLabel",
    () => comboboxSelectionLabel,
  );
  bindRuntimeValue(
    runtime,
    "comboboxVisibleGroups",
    () => comboboxVisibleGroups,
  );
  bindRuntimeValue(runtime, "Combobox", () => Combobox);
  bindRuntimeValue(
    runtime,
    "comboboxTriggerForInputKind",
    () => comboboxTriggerForInputKind,
  );
  bindRuntimeValue(runtime, "ComboboxSheetBridge", () => ComboboxSheetBridge);
  bindRuntimeValue(runtime, "ComboboxSheetPopup", () => ComboboxSheetPopup);
  bindRuntimeValue(runtime, "ComboboxPopupHost", () => ComboboxPopupHost);
  bindRuntimeValue(
    runtime,
    "registerOutsideComboboxInput",
    () => registerOutsideComboboxInput,
  );
  bindRuntimeValue(
    runtime,
    "useComboboxTriggerRef",
    () => useComboboxTriggerRef,
  );
  bindRuntimeValue(
    runtime,
    "useComboboxPopupInputRef",
    () => useComboboxPopupInputRef,
  );
  bindRuntimeValue(
    runtime,
    "useComboboxTriggerGetter",
    () => useComboboxTriggerGetter,
  );
  bindRuntimeValue(
    runtime,
    "useComboboxInputLabel",
    () => useComboboxInputLabel,
  );
  bindRuntimeValue(runtime, "useComboboxListRef", () => useComboboxListRef);
  bindRuntimeValue(
    runtime,
    "useRegisteredElementRef",
    () => useRegisteredElementRef,
  );
  bindRuntimeValue(runtime, "ComboboxCaret", () => ComboboxCaret);
  bindRuntimeValue(runtime, "ComboboxSeparator", () => ComboboxSeparator);
  bindRuntimeValue(runtime, "ComboboxFooter", () => ComboboxFooter);
  bindRuntimeValue(
    runtime,
    "imperativeComboboxCloseDetails",
    () => imperativeComboboxCloseDetails,
  );
  bindRuntimeValue(runtime, "ComboboxRoot", () => ComboboxRoot);
  bindRuntimeValue(
    runtime,
    "RegisteredComboboxRoot",
    () => RegisteredComboboxRoot,
  );
  bindRuntimeValue(
    runtime,
    "reactComboboxCombobox_4",
    () => reactComboboxCombobox_4,
    (value) => {
      reactComboboxCombobox_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxComboboxCombobox_3",
    () => jsxComboboxCombobox_3,
    (value) => {
      jsxComboboxCombobox_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxClassNames_2",
    () => ComboboxComboboxClassNames_2,
    (value) => {
      ComboboxComboboxClassNames_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxOutlineGhostConfig",
    () => ComboboxComboboxOutlineGhostConfig,
    (value) => {
      ComboboxComboboxOutlineGhostConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxSelectInputConfig",
    () => ComboboxComboboxSelectInputConfig,
    (value) => {
      ComboboxComboboxSelectInputConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxCss_2",
    () => ComboboxComboboxCss_2,
    (value) => {
      ComboboxComboboxCss_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxClassNames_3",
    () => ComboboxComboboxClassNames_3,
    (value) => {
      ComboboxComboboxClassNames_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxClassNames_4",
    () => ComboboxComboboxClassNames_4,
    (value) => {
      ComboboxComboboxClassNames_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxClassNames_5",
    () => ComboboxComboboxClassNames_5,
    (value) => {
      ComboboxComboboxClassNames_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxLabel",
    () => ComboboxComboboxLabel,
    (value) => {
      ComboboxComboboxLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxClassNames_6",
    () => ComboboxComboboxClassNames_6,
    (value) => {
      ComboboxComboboxClassNames_6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxCss_3",
    () => ComboboxComboboxCss_3,
    (value) => {
      ComboboxComboboxCss_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxClassNames_7",
    () => ComboboxComboboxClassNames_7,
    (value) => {
      ComboboxComboboxClassNames_7 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxClassNames_8",
    () => ComboboxComboboxClassNames_8,
    (value) => {
      ComboboxComboboxClassNames_8 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxClassNames_9",
    () => ComboboxComboboxClassNames_9,
    (value) => {
      ComboboxComboboxClassNames_9 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "comboboxGroupLabelClasses",
    () => comboboxGroupLabelClasses,
    (value) => {
      comboboxGroupLabelClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxLabel_2",
    () => ComboboxComboboxLabel_2,
    (value) => {
      ComboboxComboboxLabel_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxClassNames_10",
    () => ComboboxComboboxClassNames_10,
    (value) => {
      ComboboxComboboxClassNames_10 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SeparatorValue",
    () => SeparatorValue,
    (value) => {
      SeparatorValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxClassNames_11",
    () => ComboboxComboboxClassNames_11,
    (value) => {
      ComboboxComboboxClassNames_11 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "comboboxInputClasses",
    () => comboboxInputClasses,
    (value) => {
      comboboxInputClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxCss_4",
    () => ComboboxComboboxCss_4,
    (value) => {
      ComboboxComboboxCss_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxClassNames_12",
    () => ComboboxComboboxClassNames_12,
    (value) => {
      ComboboxComboboxClassNames_12 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxClassNames_13",
    () => ComboboxComboboxClassNames_13,
    (value) => {
      ComboboxComboboxClassNames_13 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxLabel_3",
    () => ComboboxComboboxLabel_3,
    (value) => {
      ComboboxComboboxLabel_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxConstant_4",
    () => ComboboxComboboxConstant_4,
    (value) => {
      ComboboxComboboxConstant_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxConstant_5",
    () => ComboboxComboboxConstant_5,
    (value) => {
      ComboboxComboboxConstant_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxConstant_6",
    () => ComboboxComboboxConstant_6,
    (value) => {
      ComboboxComboboxConstant_6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxConstant_7",
    () => ComboboxComboboxConstant_7,
    (value) => {
      ComboboxComboboxConstant_7 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxToLowerCase",
    () => ComboboxComboboxToLowerCase,
    (value) => {
      ComboboxComboboxToLowerCase = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxGetLabel",
    () => ComboboxComboboxGetLabel,
    (value) => {
      ComboboxComboboxGetLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxGetValue",
    () => ComboboxComboboxGetValue,
    (value) => {
      ComboboxComboboxGetValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxChip",
    () => ComboboxChip,
    (value) => {
      ComboboxChip = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "comboboxOutsideInputClasses",
    () => comboboxOutsideInputClasses,
    (value) => {
      comboboxOutsideInputClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxChipRemove",
    () => ComboboxChipRemove,
    (value) => {
      ComboboxChipRemove = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxItem",
    () => ComboboxItem,
    (value) => {
      ComboboxItem = value as GenericComboboxRow;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxTrigger",
    () => ComboboxTrigger,
    (value) => {
      ComboboxTrigger = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxValue",
    () => ComboboxValue,
    (value) => {
      ComboboxValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxAutoCompleteData1pIgnoreDataLpignoreConfig",
    () => ComboboxComboboxAutoCompleteData1pIgnoreDataLpignoreConfig,
    (value) => {
      ComboboxComboboxAutoCompleteData1pIgnoreDataLpignoreConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxInput",
    () => ComboboxInput,
    (value) => {
      ComboboxInput = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxPopupSearch",
    () => ComboboxPopupSearch,
    (value) => {
      ComboboxPopupSearch = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxClear",
    () => ComboboxClear,
    (value) => {
      ComboboxClear = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxFooterAction",
    () => ComboboxFooterAction,
    (value) => {
      ComboboxFooterAction = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxPopup",
    () => ComboboxPopup,
    (value) => {
      ComboboxPopup = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxSheetCapablePopup",
    () => ComboboxSheetCapablePopup,
    (value) => {
      ComboboxSheetCapablePopup = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxPopupView",
    () => ComboboxPopupView,
    (value) => {
      ComboboxPopupView = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxList",
    () => ComboboxList,
    (value) => {
      ComboboxList = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxEmpty",
    () => ComboboxEmpty,
    (value) => {
      ComboboxEmpty = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxItemAlias",
    () => ComboboxItemAlias,
    (value) => {
      ComboboxItemAlias = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxItemIndicator",
    () => ComboboxItemIndicator,
    (value) => {
      ComboboxItemIndicator = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxGroupLabel",
    () => ComboboxGroupLabel,
    (value) => {
      ComboboxGroupLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxChips",
    () => ComboboxChips,
    (value) => {
      ComboboxChips = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxRegistrationContext",
    () => ComboboxRegistrationContext,
    (value) => {
      ComboboxRegistrationContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxTriggerHiddenContext",
    () => ComboboxTriggerHiddenContext,
    (value) => {
      ComboboxTriggerHiddenContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxInputInsidePopupContext",
    () => ComboboxInputInsidePopupContext,
    (value) => {
      ComboboxInputInsidePopupContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxHandler",
    () => ComboboxComboboxHandler,
    (value) => {
      ComboboxComboboxHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComboboxAssignValue",
    () => ComboboxComboboxAssignValue,
    (value) => {
      ComboboxComboboxAssignValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComboboxCombobox_6",
    () => initializeComboboxCombobox_6,
    (value) => {
      initializeComboboxCombobox_6 = value;
    },
  );
  return () => {
    initializeComboboxCombobox = (0, runtime.initializeOnce)(() => {
      ComboboxComboboxFontSizeBodyFontSizeCaptionFontSizeCodeConfig = {
        "font-size-body": {
          compact: 0.8125,
          comfortable: 0.875,
          steps: [0.75, 0.8125, 0.875, 0.875, 0.9375],
          textSize: {
            compact: {
              sm: 0.8125,
              lg: 0.875,
            },
            comfortable: {
              sm: 0.8125,
              lg: 0.9375,
            },
          },
        },
        "font-size-caption": {
          compact: 0.6875,
          comfortable: 0.75,
          steps: [0.625, 0.6875, 0.75, 0.75, 0.8125],
        },
        "font-size-code": {
          compact: 0.75,
          comfortable: 0.8125,
        },
        "font-size-footnote": {
          compact: 0.75,
          comfortable: 0.8125,
        },
        "font-size-heading": {
          compact: 0.875,
          comfortable: 0.9375,
          textSize: {
            compact: {
              sm: 0.8125,
              lg: 0.9375,
            },
            comfortable: {
              sm: 0.875,
              lg: 1,
            },
          },
        },
        "font-size-prose": {
          compact: 0.875,
          comfortable: 1,
          steps: [0.8125, 0.875, 0.9375, 1, 1.125],
          textSize: "shift",
        },
        "font-size-title": {
          compact: 1.25,
          comfortable: 1.375,
        },
        "leading-body": {
          compact: 1.1875,
          comfortable: 1.25,
          steps: [1.0625, 1.1875, 1.25, 1.25, 1.375],
          textSize: {
            compact: {
              sm: 1.1875,
              lg: 1.25,
            },
            comfortable: {
              sm: 1.1875,
              lg: 1.375,
            },
          },
        },
        "leading-caption": {
          compact: 1.0625,
          comfortable: 1.0625,
        },
        "leading-code": {
          compact: 1.0625,
          comfortable: 1.1875,
        },
        "leading-footnote": {
          compact: 0.9375,
          comfortable: 1.0625,
        },
        "leading-heading": {
          compact: 1.125,
          comfortable: 1.25,
          textSize: {
            compact: {
              sm: 1.125,
              lg: 1.375,
            },
            comfortable: {
              sm: 1.25,
              lg: 1.5,
            },
          },
        },
        "leading-prose": {
          compact: 1.25,
          comfortable: 1.5,
          steps: [1.1875, 1.25, 1.375, 1.5, 1.6875],
          textSize: "shift",
        },
        "leading-title": {
          compact: 1.5625,
          comfortable: 1.75,
        },
      };
    });
    initializeComboboxCombobox_2 = (0, runtime.initializeOnce)(() => {});
    initializeComboboxCombobox_3 = (0, runtime.initializeOnce)(() => {
      "use client";

      (0, runtime.initializeDomRefComposition)();
      (0, runtime.initializeSheetsKeyboardViewport)();
      reactComboboxCombobox = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
    });
    initializeComboboxCombobox_4 = (0, runtime.initializeOnce)(() => {
      "use client";

      (0, runtime.initializeSheetsStyles_2)();
      (0, runtime.initializeComponentsSpinner)();
      reactComboboxCombobox_2 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      jsxComboboxCombobox = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      (0, runtime.initializeNpm__base_ui_react_wY)();
      ComboboxComboboxConstant = 500;
      ComboboxComboboxClassNames =
        "px-md py-1.5 text-body text-muted select-none";
      ComboboxComboboxCss = `flex items-center gap-2 ${ComboboxComboboxClassNames}`;
      ComboboxStatus = (0, reactComboboxCombobox_2.forwardRef)<
        HTMLDivElement,
        ComboboxStatusProps
      >(
        (
          {
            loading = false,
            delay = ComboboxComboboxConstant,
            loadingLabel: loadingLabel,
            ...props
          }: ComboboxStatusProps,
          options: React.ForwardedRef<HTMLDivElement>,
        ): React.ReactElement => {
          let value = (0, runtime.useLabel)(
            "loadingOptions",
            "Loading options",
          );
          return (
            <runtime.npm_Combobox_Yi.Status ref={options} {...props}>
              {loading && (
                <DelayedContent ms={delay}>
                  <div className={ComboboxComboboxCss}>
                    <runtime.Spinner size={"sm"} />
                    <span>{loadingLabel ?? value}</span>
                  </div>
                </DelayedContent>
              )}
            </runtime.npm_Combobox_Yi.Status>
          );
        },
      );
      ComboboxStatus.displayName = "Combobox.Status";
    });
    initializeComboboxCombobox_5 = (0, runtime.initializeOnce)(() => {
      "use client";

      (0, runtime.initializeHooksLayoutEffect)();
      (0, runtime.initializeComponentsSkeleton)();
      reactComboboxCombobox_3 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      jsxComboboxCombobox_2 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      (0, runtime.initializeNpm__tanstack_react_virtual_h7e)();
      ComboboxComboboxConstant_2 = 5;
      ComboboxComboboxConstant_3 = 4;
    });
    initializeComboboxCombobox_6 = (0, runtime.initializeOnce)(() => {
      "use client";

      (0, runtime.initializeHooksLayoutEffect)();
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeSheetsStyles_2)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeOverlaysLayers)();
      (0, runtime.initializeMenuPopup_2)();
      (0, runtime.initializeDomRefComposition_3)();
      (0, runtime.initializeDomRefComposition)();
      (0, runtime.initializePlatformRootFontSize_2)();
      (0, runtime.initializePlatformRootFontSize_3)();
      (0, runtime.initializeComponentsIcon_2)();
      (0, runtime.initializeButtonButton)();
      (0, runtime.initializeButtonButton_2)();
      (0, runtime.initializeThemeSurfaces)();
      (0, runtime.initializeSheetsLayout)();
      (0, runtime.initializeSheetsPresentation)();
      (0, runtime.initializeSheetsPopupStack)();
      (0, runtime.initializePlatformReducedMotion_2)();
      (0, runtime.initializeOverlaysBackdrop)();
      (0, runtime.initializePopoverPopover)();
      (0, runtime.initializeComponentsCheckbox)();
      (0, runtime.initializeFieldContext)();
      (0, runtime.initializeComponentsBadge)();
      initializeComboboxCombobox();
      initializeComboboxCombobox_2();
      initializeComboboxCombobox_3();
      initializeComboboxCombobox_4();
      initializeComboboxCombobox_5();
      reactComboboxCombobox_4 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      jsxComboboxCombobox_3 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      (0, runtime.initializeNpm__base_ui_react_wY)();
      ComboboxComboboxClassNames_2 =
        "cds-reset group/cbx inline-flex items-center gap-1.5 h-control rounded font-sans text-body font-normal text-primary outline-none focus-visible:outline-hidden transition duration-fast data-[disabled]:opacity-disabled data-[disabled]:pointer-events-none";
      ComboboxComboboxOutlineGhostConfig = {
        outline: `${runtime.ButtonButtonClassNames_2} ${runtime.ButtonButtonClassNames_3}`,
        ghost:
          "bg-transparent hover:bg-fill-ghost-hover has-[[aria-haspopup][aria-expanded=true]]:bg-fill-ghost-hover aria-expanded:bg-fill-ghost-hover",
      };
      ComboboxComboboxSelectInputConfig = {
        select:
          "pl-0 has-[:focus-visible]:shadow-focus data-[disabled]:cursor-default",
        input:
          "pl-sm cursor-text has-[:focus-visible]:shadow-focus data-[disabled]:cursor-default",
      };
      ComboboxComboboxCss_2 = `cds-reset group/cbx flex min-w-0 items-center gap-1.5 h-control pr-sm rounded font-sans text-body font-normal text-primary ${runtime.ButtonButtonClassNames_2} ${runtime.ButtonButtonClassNames_3} cursor-text transition duration-fast has-[:focus-visible]:shadow-focus data-[disabled]:opacity-disabled data-[disabled]:pointer-events-none`;
      ComboboxComboboxClassNames_3 =
        "cds-reset flex min-w-0 flex-1 items-center gap-1.5 self-stretch pl-sm text-left border-0 bg-transparent p-0 outline-none focus-visible:outline-hidden";
      ComboboxComboboxClassNames_4 =
        "cds-reset min-w-0 flex-1 self-stretch bg-transparent border-0 outline-none focus-visible:outline-hidden p-0 text-body font-normal text-primary placeholder:text-muted";
      ComboboxComboboxClassNames_5 =
        "cds-reset min-w-0 flex-1 bg-transparent border-0 outline-none focus-visible:outline-hidden p-0 text-body font-normal text-primary placeholder:text-muted";
      ComboboxComboboxLabel =
        "relative max-w-full shrink-0 outline-none focus-visible:outline-hidden focus-visible:[box-shadow:inset_0_0_0_1px_var(--cds-fill-accent)]";
      ComboboxComboboxClassNames_6 =
        "flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-hidden [&>*]:relative [mask-image:linear-gradient(to_right,#000_calc(100%-24px),transparent)]";
      ComboboxComboboxCss_3 = `draggable-none flex flex-col max-h-[min(var(--available-height,100dvh),var(--cds-popup-max-h,320px))] ${(0, runtime.popupSurfaceClassName)("popover")} cds-reset text-body font-normal text-primary outline-none focus-visible:outline-hidden`;
      ComboboxComboboxClassNames_7 =
        "flex min-h-0 flex-1 flex-col overflow-hidden rounded-[inherit] p-1";
      ComboboxComboboxClassNames_8 =
        "cds-reset min-h-0 flex-1 overflow-y-auto overflow-x-hidden scroll-fade-y outline-none focus-visible:outline-hidden max-h-[var(--cds-popup-list-max-h,none)]";
      ComboboxComboboxClassNames_9 =
        "-mx-1 -mt-1 mb-1 block w-[calc(100%+8px)] shrink-0 cds-reset bg-transparent border-0 border-b border-b-[var(--cds-border)] outline-none focus-visible:outline-hidden px-[calc(var(--cds-pad-md)+4px)] py-2 text-body font-normal text-primary placeholder:text-muted";
      comboboxGroupLabelClasses =
        "cds-reset group/cbx-item flex w-full items-center gap-2 min-h-control px-md py-1 rounded text-body font-normal text-primary select-none outline-none focus-visible:outline-hidden data-[highlighted]:bg-fill-ghost-hover data-[disabled]:opacity-disabled data-[disabled]:pointer-events-none transition-opacity duration-fast data-[disabled]:transition-none data-[stale]:not-data-[disabled]:opacity-50 data-[stale]:delay-[var(--cds-combobox-stale-after,500ms)] starting:data-[stale]:not-data-[disabled]:opacity-100";
      ComboboxComboboxLabel_2 =
        "max(var(--cds-h-control), var(--cds-leading-body) + 0.5rem)";
      ComboboxComboboxClassNames_10 = "mx-pad-md my-1 h-px bg-border";
      SeparatorValue = "separator";
      ComboboxComboboxClassNames_11 =
        "px-md pt-2 pb-1 text-footnote font-medium text-muted select-none";
      comboboxInputClasses =
        "[&>[data-selected]+[role=option]:not([data-selected])]:relative [&>[data-selected]+[role=option]:not([data-selected])]:mt-2 [&>[data-selected]+[role=option]:not([data-selected])]:before:absolute [&>[data-selected]+[role=option]:not([data-selected])]:before:-top-1 [&>[data-selected]+[role=option]:not([data-selected])]:before:inset-x-0 [&>[data-selected]+[role=option]:not([data-selected])]:before:border-t";
      ComboboxComboboxCss_4 = `empty:hidden ${ComboboxComboboxClassNames}`;
      ComboboxComboboxClassNames_12 = "mx-pad-md mt-1 h-px shrink-0 bg-border";
      ComboboxComboboxClassNames_13 = "shrink-0 pt-1";
      ComboboxComboboxLabel_3 = "No results";
      ComboboxComboboxConstant_4 = 32;
      ComboboxComboboxConstant_5 = 9;
      ComboboxComboboxConstant_6 = 28;
      ComboboxComboboxConstant_7 = 3;
      ComboboxComboboxToLowerCase = (input: string): string =>
        input
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase();
      ComboboxComboboxGetLabel = (input: ComboboxOption<ComboboxKey>): string =>
        input.label;
      ComboboxComboboxGetValue = (
        input: ComboboxOption<ComboboxKey>,
      ): ComboboxKey => input.value;
      ComboboxChip = (0, reactComboboxCombobox_4.forwardRef)<
        HTMLDivElement,
        ComboboxChipProps
      >(
        (
          {
            removable = true,
            className: className,
            render: render,
            children: children,
            ...props
          }: ComboboxChipProps,
          options: React.ForwardedRef<HTMLDivElement>,
        ): React.ReactElement => {
          let value = options;
          return (
            <runtime.npm_Combobox_Yi.Chip
              ref={value}
              {...props}
              className={(0, runtime.cn)(ComboboxComboboxLabel, className)}
              render={
                render ?? (
                  <runtime.Badge
                    variant={"neutral"}
                    truncate={true}
                    removeRender={
                      removable ? (
                        <runtime.npm_Combobox_Yi.ChipRemove />
                      ) : undefined
                    }
                  >
                    {children}
                  </runtime.Badge>
                )
              }
            >
              {children}
            </runtime.npm_Combobox_Yi.Chip>
          );
        },
      );
      ComboboxChip.displayName = "Combobox.Chip";
      comboboxOutsideInputClasses =
        "cds-reset inline-flex size-[calc(var(--cds-h-control-nested)-4px)] shrink-0 items-center justify-center rounded-[calc(var(--cds-h-control-nested)/4-2px)] border-0 bg-transparent p-0 text-muted outline-none focus-visible:outline-hidden transition-colors hover:bg-neutral-hover hover:text-primary focus-visible:bg-neutral-hover focus-visible:text-primary";
      ComboboxChipRemove = (0, reactComboboxCombobox_4.forwardRef)<
        HTMLButtonElement,
        ComboboxPartProps<"ChipRemove">
      >(
        (
          {
            className: className,
            children: children,
            ...props
          }: ComboboxPartProps<"ChipRemove">,
          options: React.ForwardedRef<HTMLButtonElement>,
        ): React.ReactElement => {
          let value = (0, runtime.useLabel)("removeItem", "Remove {item}", {
            item: "item",
          });
          return (
            <runtime.npm_Combobox_Yi.ChipRemove
              ref={options}
              aria-label={value}
              {...props}
              className={(0, runtime.cn)(
                comboboxOutsideInputClasses,
                className,
              )}
            >
              {children ?? <runtime.Icon name={"X"} size={"sm"} />}
            </runtime.npm_Combobox_Yi.ChipRemove>
          );
        },
      );
      ComboboxChipRemove.displayName = "Combobox.ChipRemove";
      (Combobox as React.FC<ComboboxProps<ComboboxKey>>).displayName =
        "Combobox";
      ComboboxItem = (0, reactComboboxCombobox_4.memo)(
        <Value extends ComboboxKey>({
          item: item,
          index: index,
          selected: selected,
          stale: stale,
          renderItem: renderItem,
          searchQuery: searchQuery,
          indicator: indicator,
          leadsList = false,
          separatorAbove = false,
          groupCaption: groupCaption,
          announcedGroupLabel: announcedGroupLabel,
          wrapDescription = true,
        }: ComboboxRowProps<Value>): React.ReactElement => {
          let value = indicator === "checkbox",
            value2 =
              announcedGroupLabel !== undefined ? (
                <span className={"sr-only"}>{`, ${announcedGroupLabel}`}</span>
              ) : null;
          return (
            <jsxComboboxCombobox_3.Fragment>
              {!leadsList && (item.separatorBefore || separatorAbove) && (
                <runtime.npm_Combobox_Yi.Separator
                  className={ComboboxComboboxClassNames_10}
                  data-cds-part={SeparatorValue}
                />
              )}
              {groupCaption !== undefined && (
                <div
                  aria-hidden={true}
                  className={ComboboxComboboxClassNames_11}
                >
                  {groupCaption}
                </div>
              )}
              <runtime.npm_Combobox_Yi.Item
                value={item}
                index={index}
                disabled={item.disabled}
                data-stale={stale || undefined}
                className={comboboxGroupLabelClasses}
                title={renderItem ? undefined : item.label}
              >
                {value && (
                  <span
                    data-size={"xs"}
                    className={
                      "flex shrink-0 -ml-[calc(var(--cds-pad-md)-(var(--cds-h-control)-var(--cds-checkbox))/2)]"
                    }
                  >
                    <runtime.CheckboxVisual checked={selected} />
                  </span>
                )}
                {item.icon !== undefined && (
                  <runtime.IconRenderer icon={item.icon} />
                )}
                {renderItem ? (
                  <div className={"min-w-0 flex-1"}>
                    {renderItem(item, searchQuery)}
                    {value2}
                  </div>
                ) : (
                  <div className={"flex min-w-0 flex-1 flex-col gap-0.5"}>
                    <span className={"truncate"}>
                      {item.label}
                      {value2}
                    </span>
                    {item.description !== undefined && (
                      <span
                        className={`text-footnote leading-snug text-muted ${wrapDescription ? "whitespace-normal break-words" : "truncate"}`}
                      >
                        {item.description}
                      </span>
                    )}
                  </div>
                )}
                {indicator === "check" && (
                  <runtime.npm_Combobox_Yi.ItemIndicator
                    className={"shrink-0 text-accent"}
                  >
                    <runtime.Icon name={"Check"} size={"auto"} bold={true} />
                  </runtime.npm_Combobox_Yi.ItemIndicator>
                )}
              </runtime.npm_Combobox_Yi.Item>
            </jsxComboboxCombobox_3.Fragment>
          );
        },
      ) as GenericComboboxRow;
      ComboboxItem.displayName = "ComboboxItem";
      ComboboxTrigger = (0, reactComboboxCombobox_4.forwardRef)<
        HTMLButtonElement,
        ComboboxTriggerProps
      >(
        (
          {
            variant = "outline",
            size: size,
            className: className,
            children: children,
            ...props
          }: ComboboxTriggerProps,
          options: React.ForwardedRef<HTMLButtonElement>,
        ): React.ReactElement => {
          let value = (0, reactComboboxCombobox_4.useId)(),
            value2 = (0, runtime.isInsideField)(),
            value3 =
              props["aria-label"] !== undefined ||
              props["aria-labelledby"] !== undefined ||
              props.id !== undefined ||
              props.render !== undefined ||
              value2,
            value4 = useComboboxTriggerRef(options);
          return (
            <runtime.npm_Combobox_Yi.Trigger
              ref={value4}
              {...(value3
                ? {}
                : {
                    "aria-labelledby": value,
                  })}
              data-cds={"Combobox"}
              {...props}
              {...(0, runtime.getSizeAttribute)(size)}
              className={(0, runtime.cn)(
                ComboboxComboboxClassNames_2,
                ComboboxComboboxOutlineGhostConfig[variant],
                "px-sm focus-visible:shadow-focus",
                className,
              )}
            >
              {value3 ? (
                children
              ) : (
                <span id={value} className={"contents"}>
                  {children}
                </span>
              )}
            </runtime.npm_Combobox_Yi.Trigger>
          );
        },
      );
      ComboboxTrigger.displayName = "Combobox.Trigger";
      ComboboxValue = (0, reactComboboxCombobox_4.forwardRef)<
        HTMLSpanElement,
        ComboboxValueProps
      >(
        (
          {
            className: className,
            placeholder: placeholder,
            children: children,
          }: ComboboxValueProps,
          options: React.ForwardedRef<HTMLSpanElement>,
        ): React.ReactElement => (
          <span
            ref={options}
            className={(0, runtime.cn)(
              "min-w-0 flex-1 truncate text-left",
              className,
            )}
          >
            {children !== undefined ? (
              <runtime.npm_Combobox_Yi.Value>
                {children}
              </runtime.npm_Combobox_Yi.Value>
            ) : placeholder !== undefined ? (
              <runtime.npm_Combobox_Yi.Value>
                {(input: React.ReactNode) =>
                  input == null || input === "" ? (
                    <span className={"text-muted"}>{placeholder}</span>
                  ) : (
                    input
                  )
                }
              </runtime.npm_Combobox_Yi.Value>
            ) : (
              <runtime.npm_Combobox_Yi.Value />
            )}
          </span>
        ),
      );
      ComboboxValue.displayName = "Combobox.Value";
      ComboboxComboboxAutoCompleteData1pIgnoreDataLpignoreConfig = {
        autoComplete: "off",
        "data-1p-ignore": true,
        "data-lpignore": "true",
      };
      ComboboxInput = (0, reactComboboxCombobox_4.forwardRef)<
        HTMLInputElement,
        ComboboxPartProps<"Input">
      >(
        (
          {
            className: className,
            "aria-label": ariaLabel,
            "aria-labelledby": ariaLabelledby,
            ...props
          }: ComboboxPartProps<"Input">,
          options: React.ForwardedRef<HTMLInputElement>,
        ): React.ReactElement => {
          registerOutsideComboboxInput();
          let { ref: value, nameProps: value2 } = useComboboxInputLabel(
            useComboboxPopupInputRef(useComboboxTriggerRef(options)),
            ariaLabel,
            ariaLabelledby,
          );
          return (
            <runtime.npm_Combobox_Yi.Input
              ref={value}
              {...ComboboxComboboxAutoCompleteData1pIgnoreDataLpignoreConfig}
              {...value2}
              {...props}
              className={(0, runtime.cn)(
                ComboboxComboboxClassNames_4,
                className,
              )}
            />
          );
        },
      );
      ComboboxInput.displayName = "Combobox.Input";
      ComboboxPopupSearch = (0, reactComboboxCombobox_4.forwardRef)<
        HTMLInputElement,
        ComboboxPartProps<"Input">
      >(
        (
          {
            className: className,
            "aria-label": ariaLabel,
            "aria-labelledby": ariaLabelledby,
            ...props
          }: ComboboxPartProps<"Input">,
          options: React.ForwardedRef<HTMLInputElement>,
        ): React.ReactElement => {
          let { ref: value, nameProps: value2 } = useComboboxInputLabel(
            useComboboxPopupInputRef(options),
            ariaLabel,
            ariaLabelledby,
          );
          return (
            <runtime.npm_Combobox_Yi.Input
              ref={value}
              {...ComboboxComboboxAutoCompleteData1pIgnoreDataLpignoreConfig}
              {...value2}
              {...props}
              className={(0, runtime.cn)(
                ComboboxComboboxClassNames_9,
                className,
              )}
            />
          );
        },
      );
      ComboboxPopupSearch.displayName = "Combobox.PopupSearch";
      ComboboxClear = (0, reactComboboxCombobox_4.forwardRef)<
        HTMLButtonElement,
        ComboboxPartProps<"Clear">
      >(
        (
          {
            className: className,
            children: children,
            "aria-label": ariaLabel,
            ...props
          }: ComboboxPartProps<"Clear">,
          options: React.ForwardedRef<HTMLButtonElement>,
        ): React.ReactElement => {
          let value = (0, runtime.useLabel)(
            "clearSelection",
            "Clear selection",
          );
          return (
            <runtime.npm_Combobox_Yi.Clear
              ref={options}
              {...props}
              render={
                <runtime.Button
                  iconOnly={true}
                  variant={"ghost"}
                  size={"sm"}
                  icon={children || "X"}
                  aria-label={ariaLabel ?? value}
                  tooltip={false}
                  className={(0, runtime.cn)(
                    "data-[ending-style]:hidden",
                    className,
                  )}
                />
              }
            />
          );
        },
      );
      ComboboxClear.displayName = "Combobox.Clear";
      (
        ComboboxCaret as React.FC<{
          className?: string;
        }>
      ).displayName = "Combobox.Caret";
      ComboboxFooterAction = (0, reactComboboxCombobox_4.forwardRef)<
        HTMLButtonElement,
        ComboboxFooterActionProps
      >(
        (
          {
            icon: icon,
            children: children,
            className: className,
            ...props
          }: ComboboxFooterActionProps,
          options: React.ForwardedRef<HTMLButtonElement>,
        ): React.ReactElement => (
          <button
            ref={options}
            type={"button"}
            {...props}
            className={(0, runtime.cn)(
              "cds-reset flex w-full items-center gap-2 min-h-control px-md rounded",
              "text-body font-normal text-primary select-none outline-none focus-visible:outline-hidden",
              "hover:bg-fill-ghost-hover focus-visible:bg-fill-ghost-hover",
              className,
            )}
          >
            {icon && (
              <runtime.IconRenderer
                icon={
                  <runtime.Icon
                    name={icon}
                    size={"auto"}
                    className={"text-muted"}
                  />
                }
              />
            )}
            {children}
          </button>
        ),
      );
      ComboboxFooterAction.displayName = "Combobox.FooterAction";
      ComboboxPopup = (0, reactComboboxCombobox_4.forwardRef)<
        HTMLDivElement,
        ComboboxPopupProps
      >(
        (
          {
            side = "bottom",
            align = "start",
            sideOffset = 6,
            "data-cds": dataCds = "Combobox",
            ...props
          }: ComboboxPopupProps,
          options: React.ForwardedRef<HTMLDivElement>,
        ): React.ReactElement => {
          let state = {
            side: side,
            align: align,
            sideOffset: sideOffset,
            "data-cds": dataCds,
            ...props,
          };
          return (0, runtime.isInsideSheetPopup)() ? (
            <ComboboxSheetCapablePopup {...state} ref={options} />
          ) : (
            <ComboboxPopupView
              {...state}
              ref={options}
              sheetPopup={runtime.SheetsPopupStackSheetConcealedChromeConfig}
              sheetParts={null}
            />
          );
        },
      );
      ComboboxPopup.displayName = "Combobox.Popup";
      ComboboxSheetCapablePopup = (0, reactComboboxCombobox_4.forwardRef)<
        HTMLDivElement,
        ComboboxPopupProps
      >(
        (
          input: ComboboxPopupProps,
          options: React.ForwardedRef<HTMLDivElement>,
        ): React.ReactElement => (
          <runtime.SheetCapablePopup kind={"combobox"}>
            {(input2: SheetRenderState, options2: MobileSheetParts | null) => (
              <ComboboxPopupView
                {...input}
                ref={options}
                sheetPopup={input2}
                sheetParts={options2}
              />
            )}
          </runtime.SheetCapablePopup>
        ),
      );
      ComboboxSheetCapablePopup.displayName = "ComboboxSheetCapablePopup";
      ComboboxPopupView = (0, reactComboboxCombobox_4.forwardRef)<
        HTMLDivElement,
        ComboboxPopupViewProps
      >(function (
        {
          sheetPopup: sheetPopup,
          sheetParts: sheetParts,
          ...props
        }: ComboboxPopupViewProps,
        options: React.ForwardedRef<HTMLDivElement>,
      ): React.ReactElement {
        let {
            side: value14 = "bottom",
            align: value15 = "start",
            sideOffset: value16 = 6,
            collisionPadding: value,
            collisionAvoidance: value2,
            initialFocus: value3,
            positionerClassName: value4,
            layerOffset: value5,
            maxVisibleItems: value6,
            closeLabel: value7,
            className: value8,
            style: value9,
            children: value10,
            "data-cds": value17 = "Combobox",
            "aria-label": value11,
            "aria-labelledby": value12,
            ...value13
          } = props,
          value18 = (0, runtime.useLayer)("combobox", value5),
          sheet = sheetPopup.sheet,
          value19 = sheetPopup.sheet ? sheetPopup.chrome : null,
          value20 = sheetPopup.sheet && sheetParts !== null ? sheetParts : null,
          value21 = (0, reactComboboxCombobox_4.useRef)<HTMLDivElement | null>(
            null,
          ),
          value22 = (0, reactComboboxCombobox_4.useContext)(
            ComboboxRegistrationContext,
          ),
          value23 = (0, reactComboboxCombobox_4.useContext)(
            ComboboxTriggerHiddenContext,
          ),
          { ref: value24, nameProps: value25 } = useTriggerLabelProps(
            options,
            useComboboxTriggerGetter(),
            {
              ...(value11 !== undefined && {
                "aria-label": value11,
              }),
              ...(value12 !== undefined && {
                "aria-labelledby": value12,
              }),
            },
          ),
          value26 = (0, runtime.useMergedRefs)(
            value24,
            value21,
            sheetPopup.ref,
          ),
          value27 = (0, reactComboboxCombobox_4.useCallback)(
            (input: PopupInputKind): HTMLElement | undefined =>
              comboboxTriggerForInputKind(
                input,
                value21.current,
                value22?.getPopupInput() ?? null,
                value22?.getList() ?? null,
              ),
            [value22],
          ),
          value28 = sheet
            ? value27
            : value3 !== undefined
              ? value3
              : value22 === null || value23
                ? false
                : value27,
          value29 = sheet ? undefined : comboboxMaxHeightStyle(value6),
          value30 = value29 ?? {},
          value31 = sheetPopup.style ?? {},
          value32: import("@base-ui/react/combobox").Combobox.Popup.Props["style"] =
            value29 === undefined && sheetPopup.style === undefined
              ? value9
              : typeof value9 == "function"
                ? (input) => ({
                    ...value30,
                    ...value9(input),
                    ...value31,
                  })
                : {
                    ...value30,
                    ...value9,
                    ...value31,
                  };
        return (
          <runtime.npm_Combobox_Yi.Portal
            container={(0, runtime.useOverlayRoot)()}
          >
            <runtime.PopupSurface
              {...value18.portalProps}
              style={
                sheetPopup.concealed
                  ? {
                      ...value18.portalProps.style,
                      ...runtime.OverlaysBackdropVisibilityOpacityConfig,
                    }
                  : value18.portalProps.style
              }
              surface={runtime.surfaceBackgroundTokens.popover}
              density={sheet ? runtime.ComfortableValue : undefined}
            >
              {value20 !== null && sheetPopup.sheet && (
                <value20.ComboboxSheetBackdrop sheetPopup={sheetPopup} />
              )}
              <runtime.LayerBaseContext.Provider value={value18.base}>
                <runtime.npm_Combobox_Yi.Positioner
                  style={
                    sheetPopup.positionerStyle !== undefined
                      ? {
                          ...value18.style,
                          ...sheetPopup.positionerStyle,
                        }
                      : value18.style
                  }
                  side={value14}
                  align={value15}
                  sideOffset={value16}
                  collisionPadding={value}
                  collisionAvoidance={value2}
                  positionMethod={"fixed"}
                  {...(sheet
                    ? runtime.SheetsLayoutDisableAnchorTrackingCollisionAvoidanceConfig
                    : {})}
                  className={(0, runtime.cn)(
                    value4 ?? "w-[var(--anchor-width)] min-w-[12rem]",
                    sheet &&
                      (
                        sheetPopup.state as {
                          depth: number;
                        }
                      ).depth === 0 &&
                      "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-[100dvh] after:bg-surface-3",
                  )}
                >
                  <runtime.npm_Combobox_Yi.Popup
                    data-cds={value17}
                    ref={value26}
                    initialFocus={value28}
                    {...value25}
                    {...sheetPopup.attrs}
                    {...value13}
                    style={value32}
                    className={(0, runtime.cn)(
                      ComboboxComboboxCss_3,
                      sheet && runtime.PlatformReducedMotionCss_2,
                      sheet &&
                        "data-[starting-style]:translate-y-[calc(100%+1.5rem)] data-[ending-style]:translate-y-[calc(100%+1.5rem)]",
                      sheet &&
                        "origin-top [&[data-cds-sheet-covered]:not([data-starting-style]):not([data-ending-style])]:-translate-y-3 data-[cds-sheet-covered]:scale-[0.94] after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-backdrop after:opacity-0 after:transition-opacity after:duration-sheet motion-reduce:after:transition-none data-[cds-sheet-covered]:after:opacity-100",
                      value8,
                    )}
                  >
                    <ComboboxInputInsidePopupContext.Provider value={true}>
                      {value19 !== null ? (
                        <runtime.SheetStackContext.Provider
                          value={sheetPopup.stack}
                        >
                          <value19.Handle />
                          <value19.Body>
                            <div className={ComboboxComboboxClassNames_7}>
                              {value10}
                              <value19.DismissButton
                                onDismiss={sheetPopup.frame?.dismiss}
                                label={value7}
                              />
                            </div>
                          </value19.Body>
                        </runtime.SheetStackContext.Provider>
                      ) : (
                        <div className={ComboboxComboboxClassNames_7}>
                          {value10}
                        </div>
                      )}
                    </ComboboxInputInsidePopupContext.Provider>
                  </runtime.npm_Combobox_Yi.Popup>
                </runtime.npm_Combobox_Yi.Positioner>
              </runtime.LayerBaseContext.Provider>
            </runtime.PopupSurface>
          </runtime.npm_Combobox_Yi.Portal>
        );
      });
      ComboboxPopupView.displayName = "ComboboxPopupView";
      ComboboxList = (0, reactComboboxCombobox_4.forwardRef)<
        HTMLDivElement,
        ComboboxPartProps<"List">
      >(
        (
          {
            className: className,
            "aria-label": ariaLabel,
            "aria-labelledby": ariaLabelledby,
            ...props
          }: ComboboxPartProps<"List">,
          options: React.ForwardedRef<HTMLDivElement>,
        ): React.ReactElement => {
          let { ref: value, nameProps: value2 } = useTriggerLabelProps(
            useComboboxListRef(options),
            useComboboxTriggerGetter(),
            {
              ...(ariaLabel !== undefined && {
                "aria-label": ariaLabel,
              }),
              ...(ariaLabelledby !== undefined && {
                "aria-labelledby": ariaLabelledby,
              }),
            },
          );
          return (
            <runtime.npm_Combobox_Yi.List
              ref={value}
              {...value2}
              {...props}
              className={(0, runtime.cn)(
                ComboboxComboboxClassNames_8,
                className,
              )}
              {...{
                [runtime.sheetScrollAttribute]: "",
              }}
            />
          );
        },
      );
      ComboboxList.displayName = "Combobox.List";
      ComboboxEmpty = (0, reactComboboxCombobox_4.forwardRef)<
        HTMLDivElement,
        ComboboxPartProps<"Empty">
      >(
        (
          {
            className: className,
            children: children,
            ...props
          }: ComboboxPartProps<"Empty">,
          options: React.ForwardedRef<HTMLDivElement>,
        ): React.ReactElement => {
          let value = (0, runtime.useLabel)(
            "noResults",
            ComboboxComboboxLabel_3,
          );
          return (
            <runtime.npm_Combobox_Yi.Empty
              ref={options}
              {...props}
              className={(0, runtime.cn)(ComboboxComboboxCss_4, className)}
            >
              {children === undefined ? value : children}
            </runtime.npm_Combobox_Yi.Empty>
          );
        },
      );
      ComboboxEmpty.displayName = "Combobox.Empty";
      ComboboxItemAlias = (0, reactComboboxCombobox_4.forwardRef)<
        HTMLDivElement,
        ComboboxItemPartProps
      >(
        (
          {
            description: description,
            icon: icon,
            stale = false,
            className: className,
            children: children,
            ...props
          }: ComboboxItemPartProps,
          options: React.ForwardedRef<HTMLDivElement>,
        ): React.ReactElement => (
          <runtime.npm_Combobox_Yi.Item
            ref={options}
            data-stale={stale || undefined}
            {...props}
            className={(0, runtime.cn)(comboboxGroupLabelClasses, className)}
          >
            {icon !== undefined && <runtime.IconRenderer icon={icon} />}
            <div className={"flex min-w-0 flex-1 flex-col gap-0.5"}>
              <span className={"truncate"}>{children}</span>
              {description !== undefined && (
                <span
                  className={
                    "whitespace-normal break-words text-footnote leading-snug text-muted"
                  }
                >
                  {description}
                </span>
              )}
            </div>
            <ComboboxItemIndicator />
          </runtime.npm_Combobox_Yi.Item>
        ),
      );
      ComboboxItemAlias.displayName = "Combobox.Item";
      ComboboxItemIndicator = (0, reactComboboxCombobox_4.forwardRef)<
        HTMLSpanElement,
        ComboboxPartProps<"ItemIndicator">
      >(
        (
          {
            className: className,
            children: children,
            ...props
          }: ComboboxPartProps<"ItemIndicator">,
          options: React.ForwardedRef<HTMLSpanElement>,
        ): React.ReactElement => (
          <runtime.npm_Combobox_Yi.ItemIndicator
            ref={options}
            {...props}
            className={(0, runtime.cn)("shrink-0 text-accent", className)}
          >
            {children ?? (
              <runtime.Icon name={"Check"} size={"md"} bold={true} />
            )}
          </runtime.npm_Combobox_Yi.ItemIndicator>
        ),
      );
      ComboboxItemIndicator.displayName = "Combobox.ItemIndicator";
      ComboboxGroupLabel = (0, reactComboboxCombobox_4.forwardRef)<
        HTMLDivElement,
        ComboboxPartProps<"GroupLabel">
      >(
        (
          { className: className, ...props }: ComboboxPartProps<"GroupLabel">,
          options: React.ForwardedRef<HTMLDivElement>,
        ): React.ReactElement => (
          <runtime.npm_Combobox_Yi.GroupLabel
            ref={options}
            {...props}
            className={(0, runtime.cn)(
              ComboboxComboboxClassNames_11,
              className,
            )}
          />
        ),
      );
      ComboboxGroupLabel.displayName = "Combobox.GroupLabel";
      (
        ComboboxSeparator as React.FC<{
          className?: string;
        }>
      ).displayName = "Combobox.Separator";
      (
        ComboboxFooter as React.FC<
          React.PropsWithChildren<{
            className?: string;
          }>
        >
      ).displayName = "Combobox.Footer";
      ComboboxChips = (0, reactComboboxCombobox_4.forwardRef)<
        HTMLDivElement,
        ComboboxChipsProps
      >(
        (
          { size: size, className: className, ...props }: ComboboxChipsProps,
          options: React.ForwardedRef<HTMLDivElement>,
        ): React.ReactElement => (
          <runtime.npm_Combobox_Yi.Chips
            ref={options}
            {...props}
            {...(0, runtime.getSizeAttribute)(size)}
            className={(0, runtime.cn)(
              ComboboxComboboxCss_2,
              "h-auto min-h-control flex-wrap py-1 pl-sm [&>*]:relative",
              className,
            )}
          />
        ),
      );
      ComboboxChips.displayName = "Combobox.Chips";
      ComboboxRegistrationContext = (0,
      reactComboboxCombobox_4.createContext)<ComboboxRegistration | null>(null);
      ComboboxTriggerHiddenContext = (0, reactComboboxCombobox_4.createContext)(
        false,
      );
      ComboboxInputInsidePopupContext = (0,
      reactComboboxCombobox_4.createContext)(false);
      ComboboxComboboxHandler = () => null;
      (
        ComboboxRoot as React.ComponentType<
          import("@base-ui/react/combobox").Combobox.Root.Props<never>
        >
      ).displayName = "Combobox.Root";
      ComboboxComboboxAssignValue = Object.assign(Combobox, {
        Root: ComboboxRoot,
        Trigger: ComboboxTrigger,
        Value: ComboboxValue,
        Input: ComboboxInput,
        PopupSearch: ComboboxPopupSearch,
        Clear: ComboboxClear,
        Caret: ComboboxCaret,
        FooterAction: ComboboxFooterAction,
        Popup: ComboboxPopup,
        List: ComboboxList,
        Empty: ComboboxEmpty,
        Status: ComboboxStatus,
        Item: ComboboxItemAlias,
        ItemIndicator: ComboboxItemIndicator,
        Group: runtime.npm_Combobox_Yi.Group,
        GroupLabel: ComboboxGroupLabel,
        Separator: ComboboxSeparator,
        Footer: ComboboxFooter,
        Chips: ComboboxChips,
        Chip: ComboboxChip,
        ChipRemove: ComboboxChipRemove,
        Collection: runtime.npm_Combobox_Yi.Collection,
      });
    });
  };
}
