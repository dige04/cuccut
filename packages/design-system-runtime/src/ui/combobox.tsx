import type { RestoredComboboxRootProps } from "../contracts/overlays";
import type { SheetPopupResult } from "../contracts/overlays";
import type { FieldComboboxProps } from "../contracts/overlays";
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
} from "../contracts/overlays";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiCombobox(runtime: RuntimeBindings): () => void {
  var reactForUiInputs25: typeof React;
  var jsxForUiInputs24: typeof import("react/jsx-runtime");
  var COMBOBOX_TRIGGER_CLASS: string;
  var COMBOBOX_VARIANT_CLASSES: {
    outline: string;
    ghost: string;
  };
  var COMBOBOX_FOCUS_CLASS: string;
  var COMBOBOX_MODE_CLASSES: {
    select: string;
    input: string;
  };
  var COMBOBOX_CHIPS_INPUT_CLASS: string;
  var COMBOBOX_TRIGGER_BUTTON_CLASS: string;
  var COMBOBOX_INLINE_INPUT_CLASS: string;
  var COMBOBOX_SEARCH_INPUT_CLASS: string;
  var COMBOBOX_CHIP_CLASS: string;
  var COMBOBOX_CHIP_LIST_CLASS: string;
  var COMBOBOX_POPUP_CLASS: string;
  var COMBOBOX_POPUP_BODY_CLASS: string;
  var COMBOBOX_ANCHOR_HIDDEN_CLASS: string;
  var COMBOBOX_LIST_CLASS: string;
  var COMBOBOX_POPUP_SEARCH_CLASS: string;
  var COMBOBOX_ITEM_CLASS: string;
  var COMBOBOX_ROW_HEIGHT_CSS: string;
  var COMBOBOX_SEPARATOR_CLASS: string;
  var COMBOBOX_SEPARATOR_PART: string;
  var COMBOBOX_GROUP_LABEL_CLASS: string;
  var COMBOBOX_SELECTED_SEPARATOR_CLASS: string;
  var COMBOBOX_EMPTY_CLASS: string;
  var COMBOBOX_FOOTER_DIVIDER_CLASS: string;
  var COMBOBOX_FOOTER_CLASS: string;
  var COMBOBOX_NO_RESULTS_LABEL: string;
  var COMBOBOX_DEFAULT_ROW_HEIGHT: number;
  var COMBOBOX_DEFAULT_VISIBLE_ROWS: number;
  var COMBOBOX_CHIP_LABEL_MAX_LENGTH: number;
  var COMBOBOX_DEFAULT_CHIP_COUNT: number;
  var normalizeComboboxSearchText: (input: string) => string;
  var comboboxItemLabel: (input: ComboboxOption) => string;
  var comboboxItemValue: (input: ComboboxOption) => string;
  var ComboboxChip: ForwardComponent<HTMLDivElement, ComboboxChipProps>;
  var COMBOBOX_CHIP_REMOVE_CLASS: string;
  var ComboboxChipRemove: ForwardComponent<
    HTMLButtonElement,
    ComboboxPartProps<"ChipRemove">
  >;
  var ComboboxOptionRow: GenericComboboxRow;
  var ComboboxTrigger: ForwardComponent<
    HTMLButtonElement,
    ComboboxTriggerProps
  >;
  var ComboboxValue: ForwardComponent<HTMLSpanElement, ComboboxValueProps>;
  var COMBOBOX_AUTOCOMPLETE_INPUT_PROPS: {
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
  var ComboboxItem: ForwardComponent<HTMLDivElement, ComboboxItemPartProps>;
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
  var ComboboxChipsContext: React.Context<boolean>;
  var ComboboxPopupInputContext: React.Context<boolean>;
  var nullComboboxElement: () => null;
  var ComboboxComponents: typeof Combobox & {
    Root: typeof ComboboxRoot;
    Trigger: typeof ComboboxTrigger;
    Value: typeof ComboboxValue;
    Caret: typeof ComboboxCaret;
    Input: typeof ComboboxInput;
    PopupSearch: typeof ComboboxPopupSearch;
    Popup: typeof ComboboxPopup;
    Clear: typeof ComboboxClear;
    List: typeof ComboboxList;
    Empty: typeof ComboboxEmpty;
    Status: ForwardComponent<HTMLDivElement, ComboboxStatusProps>;
    Item: typeof ComboboxItem;
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
  var jsxForUiInputs25: typeof import("react/jsx-runtime");
  function VirtualizedComboboxRows({
    count: count,
    estimateItemSize: estimateItemSize,
    estimateRowSize: estimateRowSize,
    scrollEl: scrollEl,
    actionsRef: actionsRef,
    getItemKey: getItemKey,
    renderRow: renderRow,
  }: VirtualComboboxProps): React.ReactElement {
    let callback = (input: number): number =>
        estimateRowSize?.(input) ?? estimateItemSize,
      value = (0, runtime.useVirtualizer)({
        count: count,
        getItemKey: getItemKey,
        getScrollElement: () => scrollEl,
        estimateSize: callback,
        measureElement: (
          input: Element,
          options: ResizeObserverEntry | undefined,
          context: import("@tanstack/virtual-core").Virtualizer<
            HTMLDivElement,
            Element
          >,
        ) =>
          Math.max(
            (0, runtime.measureVirtualElement)(input, options, context),
            callback(context.indexFromElement(input)),
          ),
        overscan: runtime.COMBOBOX_VIRTUAL_OVERSCAN,
        scrollPaddingStart: 28,
        scrollPaddingEnd: 28,
        enabled: scrollEl !== null,
      });
    runtime.reactForUiInputs24.useImperativeHandle(
      actionsRef,
      () => ({
        scrollToIndex: (input: number) => value.scrollToIndex(input),
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
          value2.map((input: import("@tanstack/virtual-core").VirtualItem) =>
            (() => {
              const _Element = "div";
              const _elementProps = {
                ref: value.measureElement,
                "data-index": input.index,
                style: {
                  position: "absolute" as const,
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${input.start}px)`,
                },
                children: renderRow(input.index),
              };
              const _elementKey = input.key;
              return <_Element key={_elementKey} {..._elementProps} />;
            })(),
          )
        ) : count > 0 ? (
          <div aria-hidden={true} className={"flex flex-col gap-1 px-md py-1"}>
            {Array.from(
              {
                length: runtime.COMBOBOX_SKELETON_ROW_COUNT,
              },
              (input: unknown, options: number) =>
                (() => {
                  const _Element2 = runtime.SkeletonPrimitive;
                  const _elementProps2 = {
                    height: estimateItemSize - 8,
                    className: "w-full",
                  };
                  const _elementKey2 = options;
                  return <_Element2 key={_elementKey2} {..._elementProps2} />;
                })(),
            )}
          </div>
        ) : null}
      </div>
    );
  }
  function comboboxListHeightStyle(
    visibleItems?: number,
    rowHeight?: number,
  ): DesignStyle | undefined {
    if (visibleItems === undefined || !(visibleItems > 0)) {
      return;
    }
    return {
      "--cds-popup-max-h": "var(--available-height)",
      "--cds-popup-list-max-h":
        rowHeight !== undefined
          ? `calc(${visibleItems} * ${rowHeight}px)`
          : `calc(${visibleItems} * ${COMBOBOX_ROW_HEIGHT_CSS})`,
    };
  }
  function comboboxItemMatchesQuery<Value extends ComboboxKey>(
    item: ComboboxOption<Value>,
    query: string,
  ): boolean {
    let value = normalizeComboboxSearchText(query);
    return (
      normalizeComboboxSearchText(item.label).includes(value) ||
      normalizeComboboxSearchText(item.value).includes(value)
    );
  }
  function comboboxSelectionLabel<Value extends ComboboxKey>(
    selected: readonly ComboboxOption<Value>[],
    noun?: string,
    locale?: LabelResolver,
  ): string {
    let [value] = selected;
    if (value !== undefined && selected.length === 1) {
      return value.label;
    }
    if (noun !== undefined) {
      return `${selected.length} ${noun}`;
    }
    return (0, runtime.translateWithFallback)(
      locale,
      "nSelected",
      "{count} selected",
      {
        count: selected.length,
      },
    );
  }
  function comboboxGroupMetadata<Value extends ComboboxKey>(
    items: readonly ComboboxOption<Value>[],
    isSelected: (item: ComboboxOption<Value>) => boolean,
    selectedFirst: boolean,
  ): ComboboxGroupMap<Value> {
    let entries: Map<Value, string> = new Map(),
      values: Set<Value> = new Set(),
      entries2: Map<Value, string> = new Map();
    if (!selectedFirst) {
      for (let value3 of items) {
        if (value3.groupLabelBefore !== undefined && isSelected(value3)) {
          entries.set(value3.value, value3.groupLabelBefore);
        }
      }
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
    for (let value3 of items) {
      if (value3.groupLabelBefore !== undefined) {
        value = value3.groupLabelBefore;
        value2 = {
          label: value,
          separator: value3.separatorBefore === true,
          start: value3.value,
        };
      } else if (value3.separatorBefore) {
        value = undefined;
        value2 = undefined;
      }
      if (value === undefined) {
        continue;
      }
      entries2.set(value3.value, value);
      if (value2 !== undefined && isSelected(value3)) {
        entries.set(value3.value, value2.label);
        if (value2.separator && value2.start !== value3.value) {
          values.add(value3.value);
        }
        value2 = undefined;
      }
    }
    return {
      captionAbove: entries,
      separatorAbove: values,
      runLabel: entries2,
    };
  }
  function Combobox<Value extends ComboboxKey>(
    props: ComboboxProps<Value>,
  ): React.ReactElement {
    let {
        "data-cds": value5 = "Combobox",
        mode = "select",
        variant = "outline",
        items: items,
        searchable: searchable,
        indicator: indicator,
        placeholder: placeholder,
        searchPlaceholder: searchPlaceholder,
        triggerPrefix: triggerPrefix,
        label: label,
        "aria-label": value,
        "aria-labelledby": value2,
        "aria-describedby": value3,
        "aria-required": value4,
        clearable = false,
        clearLabel: clearLabel,
        closeLabel: closeLabel,
        hideCaret = false,
        filter: filter,
        autoHighlight: autoHighlight,
        onInputChange: onInputChange,
        onOpenChange: onOpenChange,
        footerDivider = true,
        emptyMessage: emptyMessage,
        isLoading = false,
        loadingStaleAfter: loadingStaleAfter,
        footer: footer,
        renderItem: renderItem,
        announceGroupLabels = false,
        virtualized = false,
        estimateItemSize: estimateItemSize,
        hasMore = false,
        isFetchingMore = false,
        onLoadMore: onLoadMore,
        paginationKey: paginationKey,
        popupClassName: popupClassName,
        layerOffset: layerOffset,
        maxVisibleItems: maxVisibleItems,
        align = "start",
        collisionPadding: collisionPadding,
        disabled: disabled,
        required: required,
        name: name,
        size: size,
        fullWidth = true,
        className: className,
      } = props,
      value6 = reactForUiInputs25.useContext<LabelResolver | undefined>(
        runtime.translationContext,
      ),
      value7 = (0, runtime.useTranslation)("clearSelection", "Clear selection"),
      value8 = clearLabel ?? value7,
      value9 = (0, runtime.useTranslation)(
        "noResults",
        COMBOBOX_NO_RESULTS_LABEL,
      ),
      value10 = emptyMessage ?? value9,
      value11 = searchable ?? (items.length > 5 || onInputChange !== undefined),
      value12 = props.multiple === true,
      value13 = props.multiple ? (props.triggerMode ?? "summary") : null,
      value14 = (props.multiple && props.popupSearchInChips) ?? false,
      value15 = (props.multiple && props.groupSelected) ?? false,
      value16 = (props.multiple && props.keepQueryOnSelect) ?? false,
      value17 = value13 === "chips" && !value14 && searchable !== false,
      value18 = !value15 && filter === undefined,
      value19 = value17 && (autoHighlight ?? value18),
      value20 = value19 && !value16,
      value21 = props.multiple && (props.selectAllFooter ?? false),
      value22 = indicator ?? (value12 ? "checkbox" : "check"),
      value23 = (0, runtime.useFieldInvalid)(),
      value24 = (0, runtime.useHasFieldContext)(),
      value25 = (0, runtime.useFieldDisabled)(),
      value26 = disabled || value25,
      value27 = props.value !== undefined,
      [value28, value29] = reactForUiInputs25.useState(() =>
        props.multiple
          ? (props.defaultValue ?? [])
          : (props.defaultValue ?? null),
      ),
      value30 = props.multiple ? (value27 ? props.value : value28) : undefined,
      value31 = props.multiple ? undefined : value27 ? props.value : value28,
      memo = reactForUiInputs25.useMemo(
        () =>
          new Map(
            items.map((input: ComboboxOption<Value>) => [input.value, input]),
          ),
        [items],
      ),
      memo2 = reactForUiInputs25.useMemo(() => {
        if (props.multiple) {
          return ((value30 ?? []) as Value[])
            .map((input: Value) => memo.get(input))
            .filter(
              (input: ComboboxOption<Value> | undefined) => input !== undefined,
            );
        }
        let value58 = value31 ?? null,
          value59 = value58 === null ? undefined : memo.get(value58 as Value);
        if (value59) {
          return [value59];
        } else {
          return [];
        }
      }, [props.multiple, value30, value31, memo]),
      value32 = memo2[0] ?? null,
      value33 = memo2.length > 0,
      ref = reactForUiInputs25.useRef(props);
    reactForUiInputs25.useEffect(() => {
      ref.current = props;
    }, [props]);
    let ref2 = reactForUiInputs25.useRef(memo2);
    reactForUiInputs25.useEffect(() => {
      ref2.current = memo2;
    }, [memo2]);
    let ref3 = reactForUiInputs25.useRef(false),
      ref4 = reactForUiInputs25.useRef(value30);
    reactForUiInputs25.useEffect(() => {
      ref4.current = value30;
    }, [value30]);
    let callback = reactForUiInputs25.useCallback(
        (
          input: ComboboxOption<Value> | ComboboxOption<Value>[] | null,
          options?: import("@base-ui/react/combobox").Combobox.Root.ChangeEventDetails,
        ) => {
          let current = ref.current;
          if (current.multiple) {
            ref3.current =
              current.keepQueryOnSelect === true &&
              options?.reason === "item-press";
            let value58 = (input ?? []) as ComboboxOption<Value>[],
              values = new Set(
                value58.map((input2: ComboboxOption<Value>) => input2.value),
              ),
              value59 = ref2.current.filter(
                (input2: ComboboxOption<Value>) =>
                  input2.disabled && !values.has(input2.value),
              );
            if (value59.length > 0) {
              value58 = [...value58, ...value59];
              let values2 = new Set(ref4.current ?? []);
              if (
                value58.length === values2.size &&
                value58.every((input2: ComboboxOption<Value>) =>
                  values2.has(input2.value),
                )
              ) {
                return;
              }
            }
            let value60 = value58.map(
              (input2: ComboboxOption<Value>) => input2.value,
            );
            if (!value27) {
              value29(value60);
            }
            current.onChange?.(value60);
          } else {
            let value58 = input as ComboboxOption<Value> | null;
            if (value58?.disabled) {
              options?.cancel();
              return;
            }
            let value59 = value58?.value ?? null;
            if (!value27) {
              value29(value59);
            }
            current.onChange?.(value59);
          }
        },
        [value27],
      ),
      callback2 = reactForUiInputs25.useCallback(() => {
        let values = new Set(memo2.map((input: ComboboxOption) => input.value));
        callback(
          ref.current.items.filter(
            (input: ComboboxOption<Value>) =>
              !input.disabled || values.has(input.value),
          ),
        );
      }, [callback, memo2]),
      callback3 = reactForUiInputs25.useCallback(() => {
        callback([]);
      }, [callback]),
      [value34, value35] = reactForUiInputs25.useState(false),
      [value36, value37] = reactForUiInputs25.useState(""),
      ref5 = reactForUiInputs25.useRef<VirtualComboboxActions | null>(null),
      ref6 = reactForUiInputs25.useRef(false),
      callback4 = reactForUiInputs25.useCallback(
        (
          input: string,
          options?: import("@base-ui/react/combobox").Combobox.Root.ChangeEventDetails,
        ) => {
          let current = ref3.current;
          ref3.current = false;
          if (current && input === "" && options?.reason === "input-clear") {
            options.cancel();
            return;
          }
          value37(input);
          if (input !== "") {
            ref6.current = false;
          }
          if (input !== "" || !ref6.current) {
            onInputChange?.(input);
          }
          if (virtualized) {
            ref5.current?.scrollToIndex(0);
          }
        },
        [onInputChange, virtualized],
      ),
      callback5 = reactForUiInputs25.useCallback(
        (
          input: boolean,
          options?: import("@base-ui/react/combobox").Combobox.Root.ChangeEventDetails,
        ) => {
          ref3.current = false;
          let value58 = !input && options?.reason === "item-press";
          if (value12 && value58 && !value20) {
            options!.cancel?.();
            if (!value16) {
              callback4("");
            }
            return;
          }
          value35(input);
          onOpenChange?.(input);
          if (!input) {
            if (value58 && value20) {
              callback4("");
              ref6.current = true;
            } else if (value16) {
              callback4("");
              ref6.current = true;
            } else {
              value37("");
            }
          }
        },
        [value12, value16, onOpenChange, callback4, value20],
      ),
      callback6 = reactForUiInputs25.useCallback(
        () => callback5(false),
        [callback5],
      ),
      ref7 = reactForUiInputs25.useRef<{
        close(): void;
      } | null>(null);
    reactForUiInputs25.useImperativeHandle(
      ref7,
      () => ({
        close: callback6,
      }),
      [callback6],
    );
    let memo3 = reactForUiInputs25.useMemo(
        () => new Set(memo2.map((input: ComboboxOption) => input.value)),
        [memo2],
      ),
      memo4 = reactForUiInputs25.useMemo(() => {
        if (!value15) {
          return items;
        }
        let value58 = items.slice();
        value58.sort(
          (input: ComboboxOption<Value>, options: ComboboxOption<Value>) => {
            return (
              (memo3.has(input.value) ? 0 : 1) -
              (memo3.has(options.value) ? 0 : 1)
            );
          },
        );
        return value58;
      }, [items, value15, memo3]),
      memo5 = reactForUiInputs25.useMemo(() => {
        if (!virtualized || !(value11 || value17)) {
          return memo4;
        }
        let value58 = value36.trim();
        if (!value58) {
          return memo4;
        }
        let value59 = filter ?? comboboxItemMatchesQuery;
        return memo4.filter((input: ComboboxOption<Value>) =>
          value59(input, value58),
        );
      }, [virtualized, value11, value17, memo4, value36, filter]),
      ref8 = reactForUiInputs25.useRef(memo5);
    reactForUiInputs25.useEffect(() => {
      ref8.current = memo5;
    }, [memo5]);
    let callback7 = reactForUiInputs25.useCallback(
        (
          input: ComboboxOption<Value> | undefined,
          options: import("@base-ui/react/combobox").Combobox.Root.HighlightEventDetails,
        ) => {
          if (options.reason !== "keyboard" || !input) {
            return;
          }
          let value58 = ref8.current.findIndex(
            (input2: ComboboxOption<Value>) => input2.value === input.value,
          );
          if (value58 >= 0) {
            ref5.current?.scrollToIndex(value58);
          }
        },
        [],
      ),
      memo6 = reactForUiInputs25.useMemo(() => {
        if (virtualized) {
          return null;
        }
        if (!value11 && !value17 && mode === "select") {
          return null;
        }
        let value58 = filter ?? comboboxItemMatchesQuery;
        return (input: ComboboxOption<Value>, options: string) =>
          value58(input, options);
      }, [virtualized, value11, value17, mode, filter]),
      memo7 = reactForUiInputs25.useMemo(() => {
        let value58 = value36.trim();
        if (!memo6 || value58 === "") {
          return memo5.length;
        }
        let index = 0;
        for (let value59 of memo5) {
          if (memo6(value59, value58)) {
            index += 1;
          }
        }
        return index;
      }, [memo6, memo5, value36]),
      value38 = isLoading && loadingStaleAfter !== undefined,
      value39 = renderItem,
      callback8 = reactForUiInputs25.useCallback(
        (
          input: ComboboxOption<Value>,
          options: ComboboxGroupMap<Value> | null,
          context: boolean,
          value58?: number,
        ) =>
          (() => {
            const _Element3 = ComboboxOptionRow;
            const _elementProps3 = {
              item: input,
              index: value58,
              wrapDescription: value58 === undefined,
              selected: memo3.has(input.value),
              stale: value38,
              renderItem: value39,
              searchQuery: value39 ? value36 : "",
              indicator: value22,
              leadsList: context,
              separatorAbove: options?.separatorAbove.has(input.value) ?? false,
              groupCaption: options?.captionAbove.get(input.value),
              announcedGroupLabel: announceGroupLabels
                ? options?.runLabel.get(input.value)
                : undefined,
            };
            const _elementKey3 = input.value;
            return <_Element3 key={_elementKey3} {..._elementProps3} />;
          })(),
        [value39, value36, value22, memo3, value38, announceGroupLabels],
      ),
      ref9 = reactForUiInputs25.useRef<HTMLDivElement | null>(null),
      ref10 = reactForUiInputs25.useRef(false),
      ref11 = reactForUiInputs25.useRef(false);
    reactForUiInputs25.useEffect(() => {
      ref11.current = value34;
    }, [value34]);
    reactForUiInputs25.useEffect(() => {
      if (mode !== "input") {
        return;
      }
      let value58 = ref9.current?.ownerDocument ?? document,
        value59 = value58.defaultView ?? window,
        callback11 = () => {
          ref10.current = ref11.current;
          let callback12 = () => {
            value59.removeEventListener("pointerup", callback12);
            value59.removeEventListener("pointercancel", callback12);
            value59.setTimeout(() => {
              ref10.current = false;
            }, 0);
          };
          value59.addEventListener("pointerup", callback12);
          value59.addEventListener("pointercancel", callback12);
        };
      value58.addEventListener("pointerdown", callback11, {
        capture: true,
        passive: true,
      });
      return () => {
        value58.removeEventListener("pointerdown", callback11, {
          capture: true,
        });
      };
    }, [mode]);
    let callback9 = reactForUiInputs25.useCallback(() => {
        ref9.current?.querySelector("input")?.focus();
      }, []),
      { clickToFocusProps: clickToFocusProps } = (0, runtime.useClickToFocus)(
        () => {
          if (value34 || ref10.current) {
            return;
          }
          callback9();
        },
        {
          disabled: value26,
        },
      ),
      memo8 = reactForUiInputs25.useMemo(
        () =>
          new Set(
            memo2
              .filter((input: ComboboxOption<Value>) => input.disabled)
              .map((input: ComboboxOption) => input.value),
          ),
        [memo2],
      ),
      value40 =
        props.multiple === true &&
        ((value30 ?? []) as Value[]).some((input: Value) => !memo8.has(input)),
      value41 = value33 && (!props.multiple || value40),
      value42 = clearable && value41,
      value43 = !hideCaret && !(clearable && value27 && value41),
      value44 =
        mode === "select" &&
        value11 &&
        (value13 !== "chips" || value14) &&
        (items.length > 0 || isLoading || onInputChange !== undefined),
      value45 = mode === "select" && value13 !== "chips" && !value44,
      value46 = value17
        ? value19
        : (autoHighlight ?? (value18 && (mode === "input" || value44))),
      callback10 = () => {
        let callback11 = (input: React.ReactNode, options: boolean = false) =>
          !value32?.icon ? (
            input
          ) : (
            <span className={"flex min-w-0 items-center gap-2"}>
              {[
                <runtime.IconSlot icon={value32.icon} />,
                <span
                  className={(0, runtime.cn)(
                    "min-w-0 truncate",
                    options && "self-baseline",
                  )}
                >
                  {input}
                </span>,
              ]}
            </span>
          );
        if (props.multiple) {
          let value58 =
            props.renderTriggerValue?.(memo2) ??
            (memo2.length === 0
              ? (placeholder ?? " ")
              : comboboxSelectionLabel(memo2, props.summaryNoun, value6));
          if (triggerPrefix !== undefined) {
            return (
              <span className={"flex min-w-0 items-baseline gap-1.5"}>
                {[
                  <span className={"shrink-0 text-muted"}>
                    {triggerPrefix}
                  </span>,
                  <span className={"min-w-0 truncate"}>{value58}</span>,
                ]}
              </span>
            );
          }
          if (memo2.length === 0) {
            return <span className={"font-normal text-muted"}>{value58}</span>;
          }
          return value58;
        }
        if (triggerPrefix !== undefined) {
          let value58 =
            props.renderTriggerValue?.(value32) ??
            value32?.label ??
            placeholder;
          return (
            <span className={"flex min-w-0 items-baseline gap-1.5"}>
              {[
                <span className={"shrink-0 text-muted"}>{triggerPrefix}</span>,
                value58 !== undefined && (
                  <span className={"min-w-0 truncate"} title={value32?.label}>
                    {callback11(value58, true)}
                  </span>
                ),
              ]}
            </span>
          );
        }
        if (props.renderTriggerValue) {
          let value58 = props.renderTriggerValue(value32);
          if (value58 !== undefined && value58 !== null) {
            return callback11(value58);
          }
        }
        if (!value32) {
          return (
            <span className={"font-normal text-muted"}>
              {placeholder ?? " "}
            </span>
          );
        }
        return callback11(value32.label);
      },
      value47 = value43 && (
        <span
          aria-hidden={true}
          className={
            "pointer-events-none flex size-icon shrink-0 items-center justify-center text-muted"
          }
        >
          <runtime.Icon name={"CaretDown"} size={"sm"} />
        </span>
      ),
      value48 = value42 && (mode === "select" || !value43),
      text =
        "[--fh:var(--cds-h-control)] [--fhn:var(--cds-h-control-nested)] [--fr:var(--cds-radius)]",
      value49 = value42 && (
        <span
          className={
            value48
              ? `flex aspect-square h-control shrink-0 items-center justify-center ${text}`
              : `flex shrink-0 items-center ${text}`
          }
        >
          <runtime.baseCombobox.Clear
            render={
              <runtime.Button
                iconOnly={true}
                variant={"ghost"}
                size={size === "sm" || size === "xs" ? "xs" : "sm"}
                icon={"X"}
                aria-label={value8}
                tooltip={false}
                className={
                  "!size-[var(--fhn)] !rounded-[calc(var(--fr)-(var(--fh)-var(--fhn))/2)] data-[ending-style]:hidden"
                }
              />
            }
          />
        </span>
      ),
      value50 = fullWidth ? "w-full min-w-0" : "shrink-0",
      value51 = reactForUiInputs25.useId(),
      {
        labelId: labelId,
        triggerId: triggerId,
        triggerValueId: triggerValueId,
        ownLabelProps: ownLabelProps,
      } = (0, runtime.comboboxAccessibilityProps)({
        reactId: value51,
        label: label,
        triggerPrefix: triggerPrefix,
        mode: mode,
        triggerMode: value13,
        insideField: value24,
      }),
      state = {
        ...(value2 !== undefined
          ? {
              ...(ownLabelProps && {
                id: ownLabelProps.id,
              }),
              ...(value !== undefined && {
                "aria-label": value,
              }),
              "aria-labelledby": value2,
            }
          : value !== undefined && !label
            ? {
                ...(ownLabelProps && {
                  id: ownLabelProps.id,
                }),
                "aria-label": value,
              }
            : ownLabelProps || value !== undefined
              ? {
                  ...ownLabelProps,
                  ...(value !== undefined && {
                    "aria-label": value,
                  }),
                }
              : ownLabelProps),
        ...(value3 !== undefined && {
          "aria-describedby": value3,
        }),
        ...(value4 && {
          "aria-required": true,
        }),
      },
      value52 = value48 ? "pr-0" : "pr-sm",
      value53 =
        memo2.length > 0
          ? "pl-[calc((var(--cds-h-control)-var(--cds-h-control-nested))/2)]"
          : "pl-sm",
      value54 =
        value13 === "chips"
          ? `${COMBOBOX_CHIPS_INPUT_CLASS} ${value53} ${value50}`
          : `${COMBOBOX_TRIGGER_CLASS} ${COMBOBOX_VARIANT_CLASSES[variant]} ${COMBOBOX_MODE_CLASSES[mode]} ${value52} ${value50}`,
      value55 = (0, runtime.useSheetCapablePresentation)(),
      value56 = (
        <runtime.baseCombobox.Root
          multiple={value12}
          items={virtualized ? memo5 : memo4}
          value={value12 ? memo2 : value32}
          onValueChange={callback}
          open={value34}
          onOpenChange={callback5}
          {...(mode === "select"
            ? {
                inputValue: value36,
              }
            : {})}
          onInputValueChange={callback4}
          onItemHighlighted={virtualized ? callback7 : undefined}
          virtualized={virtualized}
          filter={memo6}
          autoHighlight={value46}
          itemToStringLabel={comboboxItemLabel}
          itemToStringValue={comboboxItemValue}
          disabled={value26}
          required={required}
          name={name}
        >
          {[
            value13 === "chips" ? (
              <div
                ref={ref9}
                data-cds={value5}
                {...(0, runtime.getControlSizeAttributes)(size)}
                className={(0, runtime.cn)(value54, className)}
                data-disabled={value26 || undefined}
                data-invalid={value23 || undefined}
                onMouseDown={clickToFocusProps.onMouseDown}
                onClick={
                  value26
                    ? undefined
                    : (event: React.MouseEvent<HTMLDivElement>) => {
                        event.preventDefault();
                        if (!value34) {
                          callback9();
                          callback5(true);
                        }
                      }
                }
              >
                {[
                  <runtime.baseCombobox.Chips
                    className={`${COMBOBOX_CHIP_LIST_CLASS} ${value34 ? "" : "pointer-events-none"}`}
                  >
                    {[
                      memo2.map((input: ComboboxOption<Value>) =>
                        (() => {
                          const _Element4 = ComboboxChip;
                          const _elementProps4 = {
                            removable: value34 && !input.disabled,
                            children: input.label,
                          };
                          const _elementKey4 = input.value;
                          return (
                            <_Element4 key={_elementKey4} {..._elementProps4} />
                          );
                        })(),
                      ),
                      <runtime.baseCombobox.Input
                        className={`${COMBOBOX_SEARCH_INPUT_CLASS} ${memo2.length === 0 && placeholder === undefined ? "min-w-[2ch]" : ""}`}
                        placeholder={
                          memo2.length === 0 ? placeholder : undefined
                        }
                        disabled={value26}
                        {...state}
                        autoComplete={"off"}
                        data-1p-ignore={true}
                        data-lpignore={"true"}
                      />,
                    ]}
                  </runtime.baseCombobox.Chips>,
                  value47,
                ]}
              </div>
            ) : mode === "input" ? (
              <div
                ref={ref9}
                data-cds={value5}
                {...(0, runtime.getControlSizeAttributes)(size)}
                className={(0, runtime.cn)(value54, className)}
                data-disabled={value26 || undefined}
                data-invalid={value23 || undefined}
                onMouseDown={clickToFocusProps.onMouseDown}
                onClick={
                  value26
                    ? undefined
                    : (event: React.MouseEvent<HTMLDivElement>) => {
                        let current = ref10.current;
                        ref10.current = false;
                        let ancestor = (event.target as HTMLElement).closest(
                          "button",
                        );
                        if (
                          ancestor &&
                          event.currentTarget.contains(ancestor)
                        ) {
                          return;
                        }
                        event.preventDefault();
                        if (!value34 && !current) {
                          callback9();
                          callback5(true);
                        }
                      }
                }
              >
                {[
                  <runtime.baseCombobox.Input
                    className={COMBOBOX_INLINE_INPUT_CLASS}
                    placeholder={placeholder}
                    disabled={value26}
                    {...state}
                    autoComplete={"off"}
                    data-1p-ignore={true}
                    data-lpignore={"true"}
                  />,
                  value49,
                  value47,
                ]}
              </div>
            ) : (
              <div
                ref={ref9}
                data-cds={value5}
                {...(0, runtime.getControlSizeAttributes)(size)}
                className={(0, runtime.cn)(value54, className)}
                data-disabled={value26 || undefined}
                data-invalid={value23 || undefined}
              >
                {[
                  <runtime.baseCombobox.Trigger
                    disabled={value26}
                    {...state}
                    className={COMBOBOX_TRIGGER_BUTTON_CLASS}
                  >
                    {[
                      (() => {
                        const _Element5 = "span";
                        const _elementProps5 = {
                          id: triggerValueId,
                          className: "min-w-0 flex-1 truncate",
                          children: callback10(),
                        };
                        const _elementKey5 = memo2
                          .map((input: ComboboxOption) => input.value)
                          .join("\x00");
                        return (
                          <_Element5 key={_elementKey5} {..._elementProps5} />
                        );
                      })(),
                      value43 && (
                        <runtime.Icon
                          name={"CaretDown"}
                          size={"sm"}
                          className={
                            "mr-0.5 shrink-0 text-muted transition-colors group-hover/cbx:text-secondary"
                          }
                        />
                      ),
                    ]}
                  </runtime.baseCombobox.Trigger>,
                  value49,
                ]}
              </div>
            ),
            <runtime.baseCombobox.Portal
              container={((0, runtime.usePortalContainer)()) as import("../contracts/overlays").BaseUIPortalContainer}
            >
              <ComboboxPopupResponsive
                anchorRef={ref9}
                align={align}
                collisionPadding={collisionPadding}
                popupClassName={popupClassName}
                layerOffset={layerOffset}
                maxVisibleItems={maxVisibleItems}
                dataCds={value5}
                isLoading={isLoading}
                loadingStaleAfter={loadingStaleAfter}
                showPopupSearch={value44}
                focusListOnOpen={value45}
                searchPlaceholder={searchPlaceholder ?? placeholder}
                triggerPrefix={triggerPrefix}
                chipsPopupSearch={value13 === "chips" && value44}
                disabled={value26}
                virtualized={virtualized}
                sortedItems={memo4}
                displayedItems={memo5}
                renderedItemCount={memo7}
                estimateItemSize={estimateItemSize}
                hasMore={hasMore}
                isFetchingMore={isFetchingMore}
                onLoadMore={onLoadMore}
                paginationKey={paginationKey}
                virtualRowsRef={ref5}
                emptyMessage={value10}
                groupSelected={value15}
                renderListItem={callback8}
                valueSet={memo3}
                searchQuery={value36}
                showSelectAllFooter={value21}
                footer={footer}
                footerDivider={footerDivider}
                handleSelectAll={callback2}
                handleClearAll={callback3}
                selectAllDisabled={items.every(
                  (input: ComboboxOption<Value>) =>
                    input.disabled || memo3.has(input.value),
                )}
                clearAllDisabled={!value40}
                close={callback6}
                closeLabel={closeLabel}
              />
            </runtime.baseCombobox.Portal>,
          ]}
        </runtime.baseCombobox.Root>
      ),
      value57 = (
        <runtime.CloseOnActivityHideProvider actionsRef={ref7}>
          {value55 ? (
            <runtime.FloatingPositionRenderProp
              open={value34}
              close={callback6}
              onOpenChange={callback5}
              structurallyAnchored={mode !== "select" || value13 === "chips"}
            >
              {(
                input: SheetPopupResult<
                  import("@base-ui/react/combobox").Combobox.Root.ChangeEventDetails
                >,
              ) =>
                reactForUiInputs25.cloneElement(
                  value56 as React.ReactElement<
                    Pick<
                      import("@base-ui/react/combobox").Combobox.Root.Props<
                        ComboboxOption<Value>
                      >,
                      "modal" | "onOpenChange" | "onOpenChangeComplete"
                    >
                  >,
                  {
                    modal: input.modal,
                    onOpenChange: input.onOpenChange,
                    onOpenChangeComplete: input.onOpenChangeComplete,
                  },
                )
              }
            </runtime.FloatingPositionRenderProp>
          ) : (
            value56
          )}
        </runtime.CloseOnActivityHideProvider>
      );
    if (labelId === undefined) {
      return value57;
    }
    return (
      <div
        className={`gap-xs flex-col font-sans ${fullWidth ? "flex w-full" : "inline-flex"}`}
      >
        {[
          <label
            id={labelId}
            htmlFor={triggerId}
            className={"text-body text-primary font-medium leading-none"}
          >
            {label}
          </label>,
          value57,
        ]}
      </div>
    );
  }
  function comboboxSheetLabel(
    pointerType: PopupInputKind,
    touch: HTMLElement | null | undefined,
    desktop: HTMLElement | null | undefined,
    fallback: HTMLElement | null | undefined,
  ): HTMLElement | undefined {
    if (pointerType === "touch") {
      return touch ?? undefined;
    }
    return desktop ?? fallback ?? touch ?? undefined;
  }
  function ComboboxPopupResponsive<Value extends ComboboxKey>(
    props: ComboboxBridgeProps<Value>,
  ): React.ReactElement {
    if ((0, runtime.useHasSheetFrame)()) {
      return <ComboboxPopupAsSheet {...props} />;
    } else {
      return (
        <ComboboxPopupFrame
          {...props}
          sheetPopup={runtime.defaultSheetHost}
          sheetParts={null}
        />
      );
    }
  }
  function ComboboxPopupAsSheet<Value extends ComboboxKey>(
    props: ComboboxBridgeProps<Value>,
  ): React.ReactElement {
    return (
      <runtime.AdaptiveSheetPopupHost kind={"combobox"}>
        {(input: SheetRenderState, options: MobileSheetParts | null) => (
          <ComboboxPopupFrame
            {...props}
            sheetPopup={input}
            sheetParts={options}
          />
        )}
      </runtime.AdaptiveSheetPopupHost>
    );
  }
  function ComboboxPopupFrame<Value extends ComboboxKey>({
    sheetPopup: anchorRef,
    sheetParts: sheetParts,
    anchorRef: align,
    align: align2,
    collisionPadding: showPopupSearch,
    popupClassName: popupClassName,
    layerOffset: collisionPadding,
    maxVisibleItems: maxVisibleItems,
    dataCds: layerOffset,
    isLoading: isLoading,
    loadingStaleAfter: dataCds,
    showPopupSearch: focusListOnOpen,
    focusListOnOpen: loadingStaleAfter,
    searchPlaceholder: searchPlaceholder,
    triggerPrefix: chipsPopupSearch,
    chipsPopupSearch: sortedItems,
    disabled: disabled,
    virtualized: triggerPrefix,
    sortedItems: estimateItemSize,
    displayedItems: virtualized,
    renderedItemCount: displayedItems,
    estimateItemSize: hasMore,
    hasMore: virtualRowsRef,
    isFetchingMore: onLoadMore,
    onLoadMore: renderListItem,
    paginationKey: groupSelected,
    virtualRowsRef: renderedItemCount,
    emptyMessage: isFetchingMore,
    groupSelected: paginationKey,
    renderListItem: valueSet,
    valueSet: searchQuery,
    searchQuery: emptyMessage,
    showSelectAllFooter: footer,
    footer: footer2,
    footerDivider: handleSelectAll,
    handleSelectAll: footerDivider,
    handleClearAll: handleClearAll,
    selectAllDisabled: selectAllDisabled,
    clearAllDisabled: clearAllDisabled,
    close: close,
    closeLabel: closeLabel,
  }: ComboboxHostProps<Value>): React.ReactElement {
    let selectAllDisabled2 = (0, runtime.useTranslation)(
        "loadingOptions",
        "Loading options",
      ),
      value = (0, runtime.useTranslation)(
        "loadingMoreOptions",
        "Loading more options",
      ),
      value2 = isLoading && displayedItems === 0,
      value3 = (0, runtime.useTranslation)("selectAll", "Select all"),
      closeLabel2 = (0, runtime.useTranslation)("clear", "Clear"),
      [value4, value5] = reactForUiInputs25.useState<HTMLDivElement | null>(
        null,
      ),
      value6 = (0, runtime.useRootRemSize)(),
      close2 = (0, runtime.useDensity)(),
      sheet = anchorRef.sheet,
      value7 = sheet
        ? (runtime.typographyThemeValues["leading-body"].steps[
            (0, runtime.getDensitySizeIndex)("comfortable", "lg") - 1
          ] ?? runtime.typographyThemeValues["leading-body"].comfortable)
        : runtime.typographyThemeValues["leading-body"][close2],
      value8 =
        hasMore === undefined
          ? Math.ceil(
              Math.max(COMBOBOX_DEFAULT_ROW_HEIGHT / 16, value7 + 0.5) * value6,
            )
          : value6 === 16
            ? hasMore
            : Math.ceil((hasMore * value6) / 16),
      value9 = runtime.baseCombobox.useFilteredItems<ComboboxOption<Value>>(),
      value10 = triggerPrefix ? virtualized : value9,
      value11 = !(paginationKey && searchQuery.size > 0),
      memo = reactForUiInputs25.useMemo(() => {
        if (
          !estimateItemSize.some(
            (input: ComboboxOption<Value>) =>
              input.groupLabelBefore !== undefined,
          )
        ) {
          return null;
        }
        let values = new Set(
          value10.map((input: ComboboxOption) => input.value),
        );
        return comboboxGroupMetadata(
          estimateItemSize,
          (input: ComboboxOption<Value>) => values.has(input.value),
          value11,
        );
      }, [estimateItemSize, value10, value11]),
      value12 = value10[0]?.value,
      callback = reactForUiInputs25.useCallback(
        (input: ComboboxOption<Value>): React.ReactNode =>
          valueSet(input, memo, input.value === value12),
        [valueSet, memo, value12],
      ),
      callback2 = reactForUiInputs25.useCallback(
        (input: number): string | number => {
          let value24 = virtualized[input];
          if (value24 === undefined) {
            return input;
          } else {
            return value24.value;
          }
        },
        [virtualized],
      ),
      clearAllDisabled2 = reactForUiInputs25.useCallback(
        (input: number): React.ReactNode => {
          let value24 = virtualized[input];
          if (value24 === undefined) {
            return null;
          } else {
            return valueSet(value24, memo, input === 0, input);
          }
        },
        [virtualized, valueSet, memo],
      ),
      value13 = renderListItem !== undefined,
      [value14, value15] = reactForUiInputs25.useState<HTMLElement | null>(
        null,
      ),
      ref = reactForUiInputs25.useRef(renderListItem);
    reactForUiInputs25.useEffect(() => {
      ref.current = renderListItem;
    }, [renderListItem]);
    let ref2 = reactForUiInputs25.useRef<number | null>(null);
    reactForUiInputs25.useEffect(() => {
      ref2.current = null;
    }, [emptyMessage, groupSelected]);
    let ref3 = reactForUiInputs25.useRef(displayedItems);
    reactForUiInputs25.useEffect(() => {
      if (displayedItems < ref3.current) {
        ref2.current = null;
      }
      ref3.current = displayedItems;
    }, [displayedItems]);
    reactForUiInputs25.useEffect(() => {
      if (
        !value14 ||
        !value4 ||
        !value13 ||
        onLoadMore ||
        displayedItems === 0 ||
        (ref2.current !== null && displayedItems <= ref2.current)
      ) {
        return;
      }
      let value24 = new IntersectionObserver(
        (input: IntersectionObserverEntry[]) => {
          if (!input.at(-1)?.isIntersecting) {
            return;
          }
          value24.disconnect();
          ref2.current = displayedItems;
          ref.current?.();
        },
        {
          root: value4,
          rootMargin: `0px 0px ${value8 * COMBOBOX_DEFAULT_CHIP_COUNT}px 0px`,
        },
      );
      value24.observe(value14);
      return () => value24.disconnect();
    }, [
      value14,
      value4,
      value13,
      onLoadMore,
      displayedItems,
      emptyMessage,
      groupSelected,
      value8,
    ]);
    let value16 = (0, runtime.useOverlayLayer)("combobox", collisionPadding),
      value17 = anchorRef.sheet ? anchorRef.chrome : null,
      value18 = anchorRef.sheet && sheetParts !== null ? sheetParts : null,
      value19 = reactForUiInputs25.useContext(runtime.sheetParentContext),
      value20 = sheet
        ? Math.max(value8, Math.ceil((40 * value6) / 16))
        : value8,
      callback3 = reactForUiInputs25.useCallback(
        (input: number): number => {
          let value24 = virtualized[input];
          if (value24 === undefined) {
            return value20;
          }
          let value25 =
              input > 0 &&
              (value24.separatorBefore ||
                (memo?.separatorAbove.has(value24.value) ?? false)),
            value26 = memo?.captionAbove.has(value24.value) ?? false;
          return (
            value20 +
            (value25 ? COMBOBOX_DEFAULT_VISIBLE_ROWS : 0) +
            (value26 ? COMBOBOX_CHIP_LABEL_MAX_LENGTH : 0)
          );
        },
        [virtualized, memo, value20],
      ),
      ref4 = reactForUiInputs25.useRef(null),
      value21 = (0, runtime.useMergedRefs)(ref4, anchorRef.ref),
      callback4 = reactForUiInputs25.useCallback(
        () => align.current?.querySelector('[role="combobox"]'),
        [align],
      ),
      ref5 = reactForUiInputs25.useRef(null),
      { ref: value22, nameProps: value23 } = (0,
      runtime.useMirroredAccessibleName)(
        ref5,
        callback4,
        {},
        {
          fallback: chipsPopupSearch,
          fromTextEntry: sortedItems,
        },
      ),
      callback5 = reactForUiInputs25.useCallback(
        (input: PopupInputKind): HTMLElement | undefined =>
          comboboxSheetLabel(input, ref4.current, null, ref5.current),
        [],
      );
    return (
      <runtime.PortalRoot
        {...value16.portalProps}
        style={
          anchorRef.concealed
            ? {
                ...value16.portalProps.style,
                ...runtime.concealedPopupStyle,
              }
            : value16.portalProps.style
        }
        surface={runtime.elevationSurfaceNames.popover}
        density={sheet ? runtime.SHEET_DENSITY : undefined}
        closeOnActivityHide={true}
      >
        {[
          value18 !== null && anchorRef.sheet && (
            <value18.ComboboxSheetBackdrop sheetPopup={anchorRef} />
          ),
          <runtime.layerBaseContext.Provider value={value16.base}>
            <runtime.baseCombobox.Positioner
              style={
                anchorRef.positionerStyle !== undefined
                  ? {
                      ...value16.style,
                      ...anchorRef.positionerStyle,
                    }
                  : value16.style
              }
              anchor={align}
              side={"bottom"}
              align={align2}
              sideOffset={6}
              collisionPadding={showPopupSearch}
              positionMethod={"fixed"}
              {...(sheet ? (runtime.sheetPositioningOverrides as Partial<typeof runtime.sheetPositioningOverrides>) : {})}
              className={(0, runtime.cn)(
                popupClassName ?? "w-[var(--anchor-width)] min-w-[12rem]",
                !sheet && COMBOBOX_ANCHOR_HIDDEN_CLASS,
                sheet &&
                  anchorRef.state.depth === 0 &&
                  "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-[100dvh] after:bg-surface-3",
              )}
            >
              <runtime.baseCombobox.Popup
                ref={value21}
                data-cds={layerOffset}
                initialFocus={loadingStaleAfter ? callback5 : undefined}
                {...value23}
                {...(anchorRef.attrs as React.HTMLAttributes<HTMLDivElement>)}
                className={(0, runtime.cn)(
                  COMBOBOX_POPUP_CLASS,
                  sheet && runtime.sheetPopupClasses,
                  sheet &&
                    "data-[starting-style]:translate-y-[calc(100%+1.5rem)] data-[ending-style]:translate-y-[calc(100%+1.5rem)]",
                  sheet &&
                    "origin-top [&[data-cds-sheet-covered]:not([data-starting-style]):not([data-ending-style])]:-translate-y-3 data-[cds-sheet-covered]:scale-[0.94] after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-backdrop after:opacity-0 after:transition-opacity after:duration-sheet motion-reduce:after:transition-none data-[cds-sheet-covered]:after:opacity-100",
                )}
                style={{
                  ...(sheet
                    ? undefined
                    : comboboxListHeightStyle(
                        maxVisibleItems,
                        triggerPrefix ? value20 : undefined,
                      )),
                  ...(dataCds !== undefined && {
                    "--cds-combobox-stale-after": `${dataCds}ms`,
                  }),
                  ...anchorRef.style,
                }}
                aria-busy={isLoading || onLoadMore}
              >
                {[
                  value17 !== null && <value17.Handle />,
                  <runtime.sheetParentContext.Provider
                    value={sheet ? anchorRef.stack : value19}
                  >
                    <div className={COMBOBOX_POPUP_BODY_CLASS}>
                      {[
                        focusListOnOpen && (
                          <runtime.baseCombobox.Input
                            className={COMBOBOX_POPUP_SEARCH_CLASS}
                            placeholder={searchPlaceholder}
                            disabled={disabled}
                            {...value23}
                            autoComplete={"off"}
                            data-1p-ignore={true}
                            data-lpignore={"true"}
                          />
                        ),
                        <div
                          ref={triggerPrefix || value13 ? value5 : undefined}
                          tabIndex={-1}
                          className={COMBOBOX_LIST_CLASS}
                          {...{
                            [runtime.SHEET_SCROLL_ATTRIBUTE]: "",
                          }}
                        >
                          <jsxForUiInputs24.Fragment>
                            {[
                              <runtime.baseCombobox.Empty
                                className={COMBOBOX_EMPTY_CLASS}
                              >
                                {isLoading || onLoadMore
                                  ? null
                                  : isFetchingMore}
                              </runtime.baseCombobox.Empty>,
                              <runtime.baseCombobox.List
                                ref={value22}
                                tabIndex={-1}
                                {...value23}
                                className={`cds-reset outline-none focus-visible:outline-hidden ${paginationKey ? COMBOBOX_SELECTED_SEPARATOR_CLASS : ""}`}
                              >
                                {triggerPrefix ? (
                                  <VirtualizedComboboxRows
                                    count={virtualized.length}
                                    estimateItemSize={value20}
                                    estimateRowSize={callback3}
                                    scrollEl={value4}
                                    actionsRef={renderedItemCount}
                                    getItemKey={callback2}
                                    renderRow={clearAllDisabled2}
                                  />
                                ) : (
                                  callback
                                )}
                              </runtime.baseCombobox.List>,
                              virtualRowsRef && value13 && !isLoading && (
                                <div
                                  ref={value15}
                                  aria-hidden={true}
                                  className={"h-px"}
                                />
                              ),
                              <runtime.ComboboxStatus
                                delay={0}
                                loading={value2 || onLoadMore}
                                loadingLabel={
                                  value2 ? selectAllDisabled2 : value
                                }
                              />,
                            ]}
                          </jsxForUiInputs24.Fragment>
                        </div>,
                        (footer || footer2) && (
                          <jsxForUiInputs24.Fragment>
                            {[
                              handleSelectAll && (
                                <div
                                  aria-hidden={true}
                                  className={COMBOBOX_FOOTER_DIVIDER_CLASS}
                                />
                              ),
                              <div
                                className={
                                  handleSelectAll
                                    ? COMBOBOX_FOOTER_CLASS
                                    : "shrink-0"
                                }
                              >
                                {[
                                  footer && (
                                    <div
                                      className={
                                        "flex items-center justify-between gap-sm p-1"
                                      }
                                    >
                                      {[
                                        <runtime.Button
                                          variant={"ghost"}
                                          size={"sm"}
                                          onClick={footerDivider}
                                          disabled={selectAllDisabled}
                                        >
                                          {value3}
                                        </runtime.Button>,
                                        <runtime.Button
                                          variant={"ghost"}
                                          size={"sm"}
                                          onClick={handleClearAll}
                                          disabled={clearAllDisabled}
                                        >
                                          {closeLabel2}
                                        </runtime.Button>,
                                      ]}
                                    </div>
                                  ),
                                  footer2 &&
                                    (typeof footer2 === "function"
                                      ? footer2({
                                          close: close,
                                        })
                                      : footer2),
                                ]}
                              </div>,
                            ]}
                          </jsxForUiInputs24.Fragment>
                        ),
                        value17 !== null && (
                          <value17.DismissButton
                            onDismiss={close}
                            label={closeLabel}
                          />
                        ),
                      ]}
                    </div>
                  </runtime.sheetParentContext.Provider>,
                ]}
              </runtime.baseCombobox.Popup>
            </runtime.baseCombobox.Positioner>
          </runtime.layerBaseContext.Provider>,
        ]}
      </runtime.PortalRoot>
    );
  }
  function useComboboxOutsideInputRegistration(): void {
    let value = reactForUiInputs25.useContext(ComboboxRegistrationContext),
      value2 = reactForUiInputs25.useContext(ComboboxPopupInputContext);
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      if (value === null || value2) {
        return;
      }
      return value.addOutsideInput();
    }, [value, value2]);
  }
  function useComboboxTriggerRef(
    ref?: React.Ref<HTMLElement>,
  ): React.RefCallback<HTMLElement> {
    let value = reactForUiInputs25.useContext(ComboboxRegistrationContext),
      value2 = useComboboxRegistrationRef(
        reactForUiInputs25.useContext(ComboboxPopupInputContext)
          ? undefined
          : value?.setTrigger,
        value?.getTrigger,
      );
    return (0, runtime.useMergedRefs)(ref, value2);
  }
  function useComboboxPopupInputRef(
    ref?: React.Ref<HTMLElement>,
  ): React.RefCallback<HTMLElement> {
    let value = reactForUiInputs25.useContext(ComboboxRegistrationContext),
      value2 = useComboboxRegistrationRef(
        reactForUiInputs25.useContext(ComboboxPopupInputContext)
          ? value?.setPopupInput
          : undefined,
        value?.getPopupInput,
      );
    return (0, runtime.useMergedRefs)(ref, value2);
  }
  function useComboboxTriggerElement(): () => HTMLElement | null {
    let value = reactForUiInputs25.useContext(ComboboxRegistrationContext);
    if (reactForUiInputs25.useContext(ComboboxChipsContext)) {
      return nullComboboxElement;
    } else {
      return value?.getTrigger ?? nullComboboxElement;
    }
  }
  function useComboboxAccessibleName(
    ref: React.Ref<HTMLElement> | undefined,
    label?: string,
    labelledBy?: string,
  ): {
    ref: React.RefCallback<HTMLElement>;
    nameProps: AccessibleNameProps;
  } {
    let value = reactForUiInputs25.useContext(ComboboxPopupInputContext),
      value2 = useComboboxTriggerElement();
    return (0, runtime.useMirroredAccessibleName)(
      ref,
      value ? value2 : nullComboboxElement,
      {
        ...(label !== undefined && {
          "aria-label": label,
        }),
        ...(labelledBy !== undefined && {
          "aria-labelledby": labelledBy,
        }),
      },
    );
  }
  function useComboboxListRef(
    ref?: React.Ref<HTMLElement>,
  ): React.RefCallback<HTMLElement> {
    let value = reactForUiInputs25.useContext(ComboboxRegistrationContext),
      value2 = useComboboxRegistrationRef(value?.setList, value?.getList);
    return (0, runtime.useMergedRefs)(ref, value2);
  }
  function useComboboxRegistrationRef(
    setElement: ((element: HTMLElement | null) => void) | undefined,
    getElement: (() => HTMLElement | null) | undefined,
  ): React.RefCallback<HTMLElement> {
    let ref = reactForUiInputs25.useRef<HTMLElement | null>(null);
    return reactForUiInputs25.useCallback(
      (input: HTMLElement | null) => {
        if (setElement === undefined || getElement === undefined) {
          return;
        }
        if (input !== null) {
          ref.current = input;
          setElement(input);
        } else if (getElement() === ref.current) {
          setElement(null);
        }
      },
      [setElement, getElement],
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
      <runtime.baseCombobox.Separator
        className={(0, runtime.cn)(COMBOBOX_SEPARATOR_CLASS, className)}
        data-cds-part={COMBOBOX_SEPARATOR_PART}
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
      <jsxForUiInputs24.Fragment>
        {[
          <div aria-hidden={true} className={COMBOBOX_FOOTER_DIVIDER_CLASS} />,
          <div className={(0, runtime.cn)(COMBOBOX_FOOTER_CLASS, className)}>
            {children}
          </div>,
        ]}
      </jsxForUiInputs24.Fragment>
    );
  }
  function comboboxCloseEventDetails(): ImperativeComboboxDetails {
    let state: ImperativeComboboxDetails = {
      reason: "close-press",
      event: new Event("base-ui"),
      trigger: undefined,
      isCanceled: false,
      isPropagationAllowed: false,
      cancel(): void {
        state.isCanceled = true;
      },
      allowPropagation(): void {
        state.isPropagationAllowed = true;
      },
    };
    return state;
  }
  function ComboboxRoot<Value, Multiple extends boolean = false>(
    input: RestoredComboboxRootProps<Value, Multiple>,
  ): React.ReactElement {
    let ref = reactForUiInputs25.useRef<{
        inputOutsidePopup: number;
        trigger: HTMLElement | null;
        popupInput: HTMLElement | null;
        list: HTMLElement | null;
      }>({
        inputOutsidePopup: 0,
        trigger: null,
        popupInput: null,
        list: null,
      }),
      [value, value2] = reactForUiInputs25.useState(false),
      memo = reactForUiInputs25.useMemo(
        () => ({
          addOutsideInput: () => {
            ref.current.inputOutsidePopup += 1;
            value2(true);
            return () => {
              ref.current.inputOutsidePopup -= 1;
              value2(ref.current.inputOutsidePopup > 0);
            };
          },
          hasOutsideInput: () => ref.current.inputOutsidePopup > 0,
          setTrigger: (input2: HTMLElement | null) => {
            ref.current.trigger = input2;
          },
          getTrigger: () => ref.current.trigger,
          setPopupInput: (input2: HTMLElement | null) => {
            ref.current.popupInput = input2;
          },
          getPopupInput: () => ref.current.popupInput,
          setList: (input2: HTMLElement | null) => {
            ref.current.list = input2;
          },
          getList: () => ref.current.list,
        }),
        [],
      ),
      value3 = (0, runtime.useSheetCapablePresentation)();
    return (
      <ComboboxRegistrationContext.Provider value={memo}>
        <ComboboxChipsContext.Provider value={value}>
          <ComboboxPopupInputContext.Provider value={false}>
            {value3 ? (
              <ComboboxRootRegistration rootProps={input} registration={memo} />
            ) : (
              <runtime.baseCombobox.Root {...input} />
            )}
          </ComboboxPopupInputContext.Provider>
        </ComboboxChipsContext.Provider>
      </ComboboxRegistrationContext.Provider>
    );
  }
  function ComboboxRootRegistration<Value, Multiple extends boolean = false>({
    rootProps: rootProps,
    registration: registration,
  }: {
    rootProps: RestoredComboboxRootProps<Value, Multiple>;
    registration: ComboboxRegistration;
  }): React.ReactElement {
    let value = (0, runtime.useControllableOpen)(rootProps),
      { onOpenChange: onOpenChange } = value,
      callback = reactForUiInputs25.useCallback(() => {
        onOpenChange(false, comboboxCloseEventDetails());
      }, [onOpenChange]),
      value2 = (0, runtime.useValueCapturedOnOpen)(
        value.open,
        registration.hasOutsideInput,
        false,
      ),
      value3 = (0, runtime.useAdaptiveSheet)({
        open: value.open,
        close: callback,
        onOpenChange: value.onOpenChange,
        onOpenChangeComplete: rootProps.onOpenChangeComplete,
        structurallyAnchored: value2,
        closable: !(
          rootProps.open !== undefined && rootProps.onOpenChange === undefined
        ),
      });
    return (
      <runtime.SheetContextProvider value={value3}>
        <runtime.baseCombobox.Root
          {...rootProps}
          open={value.open}
          modal={value3.modal ?? rootProps.modal}
          onOpenChange={value3.onOpenChange}
          onOpenChangeComplete={value3.onOpenChangeComplete}
        />
      </runtime.SheetContextProvider>
    );
  }
  function FieldCombobox({
    label: error,
    hint: hint,
    error: required,
    required: label,
    fieldClassName: fieldClassName,
    ...remainingProps
  }: FieldComboboxProps): React.ReactElement {
    if (
      (error === undefined || error === null) &&
      (hint === undefined || hint === null) &&
      !required &&
      fieldClassName === undefined &&
      remainingProps.mode !== "input" &&
      (
        remainingProps as {
          triggerMode?: "summary" | "chips";
        }
      ).triggerMode !== "chips"
    ) {
      return <ComboboxComponents required={label} {...remainingProps} />;
    }
    return (
      <runtime.FieldWrapper
        label={error}
        hint={hint}
        error={required}
        fieldClassName={fieldClassName}
      >
        <ComboboxComponents required={label} {...remainingProps} />
      </runtime.FieldWrapper>
    );
  }
  bindRuntimeValue(
    runtime,
    "VirtualizedComboboxRows",
    () => VirtualizedComboboxRows,
  );
  bindRuntimeValue(
    runtime,
    "reactForUiInputs25",
    () => reactForUiInputs25,
    (value) => {
      reactForUiInputs25 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiInputs24",
    () => jsxForUiInputs24,
    (value) => {
      jsxForUiInputs24 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_TRIGGER_CLASS",
    () => COMBOBOX_TRIGGER_CLASS,
    (value) => {
      COMBOBOX_TRIGGER_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_VARIANT_CLASSES",
    () => COMBOBOX_VARIANT_CLASSES,
    (value) => {
      COMBOBOX_VARIANT_CLASSES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_FOCUS_CLASS",
    () => COMBOBOX_FOCUS_CLASS,
    (value) => {
      COMBOBOX_FOCUS_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_MODE_CLASSES",
    () => COMBOBOX_MODE_CLASSES,
    (value) => {
      COMBOBOX_MODE_CLASSES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_CHIPS_INPUT_CLASS",
    () => COMBOBOX_CHIPS_INPUT_CLASS,
    (value) => {
      COMBOBOX_CHIPS_INPUT_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_TRIGGER_BUTTON_CLASS",
    () => COMBOBOX_TRIGGER_BUTTON_CLASS,
    (value) => {
      COMBOBOX_TRIGGER_BUTTON_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_INLINE_INPUT_CLASS",
    () => COMBOBOX_INLINE_INPUT_CLASS,
    (value) => {
      COMBOBOX_INLINE_INPUT_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_SEARCH_INPUT_CLASS",
    () => COMBOBOX_SEARCH_INPUT_CLASS,
    (value) => {
      COMBOBOX_SEARCH_INPUT_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_CHIP_CLASS",
    () => COMBOBOX_CHIP_CLASS,
    (value) => {
      COMBOBOX_CHIP_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_CHIP_LIST_CLASS",
    () => COMBOBOX_CHIP_LIST_CLASS,
    (value) => {
      COMBOBOX_CHIP_LIST_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_POPUP_CLASS",
    () => COMBOBOX_POPUP_CLASS,
    (value) => {
      COMBOBOX_POPUP_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_POPUP_BODY_CLASS",
    () => COMBOBOX_POPUP_BODY_CLASS,
    (value) => {
      COMBOBOX_POPUP_BODY_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_ANCHOR_HIDDEN_CLASS",
    () => COMBOBOX_ANCHOR_HIDDEN_CLASS,
    (value) => {
      COMBOBOX_ANCHOR_HIDDEN_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_LIST_CLASS",
    () => COMBOBOX_LIST_CLASS,
    (value) => {
      COMBOBOX_LIST_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "comboboxListHeightStyle",
    () => comboboxListHeightStyle,
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_POPUP_SEARCH_CLASS",
    () => COMBOBOX_POPUP_SEARCH_CLASS,
    (value) => {
      COMBOBOX_POPUP_SEARCH_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_ITEM_CLASS",
    () => COMBOBOX_ITEM_CLASS,
    (value) => {
      COMBOBOX_ITEM_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_ROW_HEIGHT_CSS",
    () => COMBOBOX_ROW_HEIGHT_CSS,
    (value) => {
      COMBOBOX_ROW_HEIGHT_CSS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_SEPARATOR_CLASS",
    () => COMBOBOX_SEPARATOR_CLASS,
    (value) => {
      COMBOBOX_SEPARATOR_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_SEPARATOR_PART",
    () => COMBOBOX_SEPARATOR_PART,
    (value) => {
      COMBOBOX_SEPARATOR_PART = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_GROUP_LABEL_CLASS",
    () => COMBOBOX_GROUP_LABEL_CLASS,
    (value) => {
      COMBOBOX_GROUP_LABEL_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_SELECTED_SEPARATOR_CLASS",
    () => COMBOBOX_SELECTED_SEPARATOR_CLASS,
    (value) => {
      COMBOBOX_SELECTED_SEPARATOR_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_EMPTY_CLASS",
    () => COMBOBOX_EMPTY_CLASS,
    (value) => {
      COMBOBOX_EMPTY_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_FOOTER_DIVIDER_CLASS",
    () => COMBOBOX_FOOTER_DIVIDER_CLASS,
    (value) => {
      COMBOBOX_FOOTER_DIVIDER_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_FOOTER_CLASS",
    () => COMBOBOX_FOOTER_CLASS,
    (value) => {
      COMBOBOX_FOOTER_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_NO_RESULTS_LABEL",
    () => COMBOBOX_NO_RESULTS_LABEL,
    (value) => {
      COMBOBOX_NO_RESULTS_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_DEFAULT_ROW_HEIGHT",
    () => COMBOBOX_DEFAULT_ROW_HEIGHT,
    (value) => {
      COMBOBOX_DEFAULT_ROW_HEIGHT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_DEFAULT_VISIBLE_ROWS",
    () => COMBOBOX_DEFAULT_VISIBLE_ROWS,
    (value) => {
      COMBOBOX_DEFAULT_VISIBLE_ROWS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_CHIP_LABEL_MAX_LENGTH",
    () => COMBOBOX_CHIP_LABEL_MAX_LENGTH,
    (value) => {
      COMBOBOX_CHIP_LABEL_MAX_LENGTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMBOBOX_DEFAULT_CHIP_COUNT",
    () => COMBOBOX_DEFAULT_CHIP_COUNT,
    (value) => {
      COMBOBOX_DEFAULT_CHIP_COUNT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeComboboxSearchText",
    () => normalizeComboboxSearchText,
    (value) => {
      normalizeComboboxSearchText = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "comboboxItemMatchesQuery",
    () => comboboxItemMatchesQuery,
  );
  bindRuntimeValue(
    runtime,
    "comboboxItemLabel",
    () => comboboxItemLabel,
    (value) => {
      comboboxItemLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "comboboxItemValue",
    () => comboboxItemValue,
    (value) => {
      comboboxItemValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "comboboxSelectionLabel",
    () => comboboxSelectionLabel,
  );
  bindRuntimeValue(
    runtime,
    "comboboxGroupMetadata",
    () => comboboxGroupMetadata,
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
    "COMBOBOX_CHIP_REMOVE_CLASS",
    () => COMBOBOX_CHIP_REMOVE_CLASS,
    (value) => {
      COMBOBOX_CHIP_REMOVE_CLASS = value;
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
  bindRuntimeValue(runtime, "Combobox", () => Combobox);
  bindRuntimeValue(runtime, "comboboxSheetLabel", () => comboboxSheetLabel);
  bindRuntimeValue(
    runtime,
    "ComboboxPopupResponsive",
    () => ComboboxPopupResponsive,
  );
  bindRuntimeValue(runtime, "ComboboxPopupAsSheet", () => ComboboxPopupAsSheet);
  bindRuntimeValue(runtime, "ComboboxPopupFrame", () => ComboboxPopupFrame);
  bindRuntimeValue(
    runtime,
    "ComboboxOptionRow",
    () => ComboboxOptionRow,
    (value) => {
      ComboboxOptionRow = value;
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
    "COMBOBOX_AUTOCOMPLETE_INPUT_PROPS",
    () => COMBOBOX_AUTOCOMPLETE_INPUT_PROPS,
    (value) => {
      COMBOBOX_AUTOCOMPLETE_INPUT_PROPS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useComboboxOutsideInputRegistration",
    () => useComboboxOutsideInputRegistration,
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
    "useComboboxTriggerElement",
    () => useComboboxTriggerElement,
  );
  bindRuntimeValue(
    runtime,
    "useComboboxAccessibleName",
    () => useComboboxAccessibleName,
  );
  bindRuntimeValue(runtime, "useComboboxListRef", () => useComboboxListRef);
  bindRuntimeValue(
    runtime,
    "useComboboxRegistrationRef",
    () => useComboboxRegistrationRef,
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
  bindRuntimeValue(runtime, "ComboboxCaret", () => ComboboxCaret);
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
    "ComboboxItem",
    () => ComboboxItem,
    (value) => {
      ComboboxItem = value;
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
  bindRuntimeValue(runtime, "ComboboxSeparator", () => ComboboxSeparator);
  bindRuntimeValue(runtime, "ComboboxFooter", () => ComboboxFooter);
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
    "ComboboxChipsContext",
    () => ComboboxChipsContext,
    (value) => {
      ComboboxChipsContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComboboxPopupInputContext",
    () => ComboboxPopupInputContext,
    (value) => {
      ComboboxPopupInputContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "comboboxCloseEventDetails",
    () => comboboxCloseEventDetails,
  );
  bindRuntimeValue(
    runtime,
    "nullComboboxElement",
    () => nullComboboxElement,
    (value) => {
      nullComboboxElement = value;
    },
  );
  bindRuntimeValue(runtime, "ComboboxRoot", () => ComboboxRoot);
  bindRuntimeValue(
    runtime,
    "ComboboxRootRegistration",
    () => ComboboxRootRegistration,
  );
  bindRuntimeValue(
    runtime,
    "ComboboxComponents",
    () => ComboboxComponents,
    (value) => {
      ComboboxComponents = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiInputs25",
    () => jsxForUiInputs25,
    (value) => {
      jsxForUiInputs25 = value;
    },
  );
  bindRuntimeValue(runtime, "FieldCombobox", () => FieldCombobox);
  return () => {
    reactForUiInputs25 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxForUiInputs24 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    COMBOBOX_TRIGGER_CLASS =
      "cds-reset group/cbx inline-flex items-center gap-1.5 h-control rounded font-sans text-body font-normal text-primary outline-none focus-visible:outline-hidden transition duration-fast data-[disabled]:opacity-disabled data-[disabled]:pointer-events-none";
    COMBOBOX_VARIANT_CLASSES = {
      outline: `${runtime.fieldRingClasses} ${runtime.fieldHoverClasses}`,
      ghost:
        "bg-transparent hover:bg-fill-ghost-hover has-[[aria-haspopup][aria-expanded=true]]:bg-fill-ghost-hover aria-expanded:bg-fill-ghost-hover",
    };
    COMBOBOX_FOCUS_CLASS =
      "has-[:focus-visible]:shadow-focus data-[invalid]:has-[:focus-visible]:shadow-focus-danger";
    COMBOBOX_MODE_CLASSES = {
      select: `pl-0 ${COMBOBOX_FOCUS_CLASS} data-[disabled]:cursor-default`,
      input: `pl-sm cursor-text ${COMBOBOX_FOCUS_CLASS} data-[disabled]:cursor-default`,
    };
    COMBOBOX_CHIPS_INPUT_CLASS = `cds-reset group/cbx flex min-w-0 items-center gap-1.5 h-control pr-sm rounded font-sans text-body font-normal text-primary ${runtime.fieldRingClasses} ${runtime.fieldHoverClasses} cursor-text transition duration-fast ${COMBOBOX_FOCUS_CLASS} data-[disabled]:opacity-disabled data-[disabled]:pointer-events-none`;
    COMBOBOX_TRIGGER_BUTTON_CLASS =
      "cds-reset flex min-w-0 flex-1 items-center gap-1.5 self-stretch pl-sm text-left border-0 bg-transparent p-0 outline-none focus-visible:outline-hidden";
    COMBOBOX_INLINE_INPUT_CLASS =
      "cds-reset min-w-0 flex-1 self-stretch bg-transparent border-0 outline-none focus-visible:outline-hidden p-0 text-body font-normal text-primary placeholder:text-muted";
    COMBOBOX_SEARCH_INPUT_CLASS =
      "cds-reset min-w-0 flex-1 bg-transparent border-0 outline-none focus-visible:outline-hidden p-0 text-body font-normal text-primary placeholder:text-muted";
    COMBOBOX_CHIP_CLASS =
      "relative max-w-full shrink-0 outline-none focus-visible:outline-hidden focus-visible:[box-shadow:inset_0_0_0_1px_var(--cds-fill-accent)]";
    COMBOBOX_CHIP_LIST_CLASS =
      "flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-hidden [&>*]:relative [mask-image:linear-gradient(to_right,#000_calc(100%-24px),transparent)]";
    COMBOBOX_POPUP_CLASS = `draggable-none flex flex-col max-h-[min(var(--available-height,100dvh),var(--cds-popup-max-h,320px))] ${(0, runtime.getSurfaceClasses)("popover")} cds-reset text-body font-normal text-primary outline-none focus-visible:outline-hidden`;
    COMBOBOX_POPUP_BODY_CLASS =
      "flex min-h-0 flex-1 flex-col overflow-hidden rounded-[inherit] p-1";
    COMBOBOX_ANCHOR_HIDDEN_CLASS = "data-[anchor-hidden]:invisible";
    COMBOBOX_LIST_CLASS =
      "cds-reset min-h-0 flex-1 overflow-y-auto overflow-x-hidden scroll-fade-y outline-none focus-visible:outline-hidden max-h-[var(--cds-popup-list-max-h,none)]";
    COMBOBOX_POPUP_SEARCH_CLASS =
      "-mx-1 -mt-1 mb-1 block w-[calc(100%+8px)] shrink-0 cds-reset bg-transparent border-0 border-b border-b-[var(--cds-border)] outline-none focus-visible:outline-hidden px-[calc(var(--cds-pad-md)+4px)] py-2 text-body font-normal text-primary placeholder:text-muted";
    COMBOBOX_ITEM_CLASS =
      "cds-reset group/cbx-item flex w-full items-center gap-2 min-h-control px-md py-1 rounded text-body font-normal text-primary select-none outline-none focus-visible:outline-hidden data-[highlighted]:bg-fill-ghost-hover data-[disabled]:opacity-disabled data-[disabled]:pointer-events-none transition-opacity duration-fast data-[disabled]:transition-none data-[stale]:not-data-[disabled]:opacity-50 data-[stale]:delay-[var(--cds-combobox-stale-after,500ms)] starting:data-[stale]:not-data-[disabled]:opacity-100";
    COMBOBOX_ROW_HEIGHT_CSS =
      "max(var(--cds-h-control), var(--cds-leading-body) + 0.5rem)";
    COMBOBOX_SEPARATOR_CLASS = "mx-pad-md my-1 h-px bg-border";
    COMBOBOX_SEPARATOR_PART = "separator";
    COMBOBOX_GROUP_LABEL_CLASS =
      "px-md pt-2 pb-1 text-footnote font-medium text-muted select-none";
    COMBOBOX_SELECTED_SEPARATOR_CLASS =
      "[&>[data-selected]+[role=option]:not([data-selected])]:relative [&>[data-selected]+[role=option]:not([data-selected])]:mt-2 [&>[data-selected]+[role=option]:not([data-selected])]:before:absolute [&>[data-selected]+[role=option]:not([data-selected])]:before:-top-1 [&>[data-selected]+[role=option]:not([data-selected])]:before:inset-x-0 [&>[data-selected]+[role=option]:not([data-selected])]:before:border-t";
    COMBOBOX_EMPTY_CLASS = `empty:hidden ${runtime.COMBOBOX_STATUS_CLASS}`;
    COMBOBOX_FOOTER_DIVIDER_CLASS = "mx-pad-md mt-1 h-px shrink-0 bg-border";
    COMBOBOX_FOOTER_CLASS = "shrink-0 pt-1";
    COMBOBOX_NO_RESULTS_LABEL = "No results";
    COMBOBOX_DEFAULT_ROW_HEIGHT = 32;
    COMBOBOX_DEFAULT_VISIBLE_ROWS = 9;
    COMBOBOX_CHIP_LABEL_MAX_LENGTH = 28;
    COMBOBOX_DEFAULT_CHIP_COUNT = 3;
    normalizeComboboxSearchText = (input: string) =>
      input
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase();
    comboboxItemLabel = (input: ComboboxOption) => input.label;
    comboboxItemValue = (input: ComboboxOption) => input.value;
    ComboboxChip = reactForUiInputs25.forwardRef(
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
          <runtime.baseCombobox.Chip
            ref={value}
            {...props}
            className={(0, runtime.cn)(COMBOBOX_CHIP_CLASS, className)}
            render={
              render ?? (
                <runtime.Badge
                  variant={"neutral"}
                  truncate={true}
                  removeRender={
                    removable ? <runtime.baseCombobox.ChipRemove /> : undefined
                  }
                >
                  {children}
                </runtime.Badge>
              )
            }
          >
            {children}
          </runtime.baseCombobox.Chip>
        );
      },
    );
    ComboboxChip.displayName = "Combobox.Chip";
    COMBOBOX_CHIP_REMOVE_CLASS =
      "cds-reset inline-flex size-[calc(var(--cds-h-control-nested)-4px)] shrink-0 items-center justify-center rounded-[calc(var(--cds-h-control-nested)/4-2px)] border-0 bg-transparent p-0 text-muted outline-none focus-visible:outline-hidden transition-colors hover:bg-neutral-hover hover:text-primary focus-visible:bg-neutral-hover focus-visible:text-primary";
    ComboboxChipRemove = reactForUiInputs25.forwardRef(
      (
        {
          className: className,
          children: children,
          ...props
        }: ComboboxPartProps<"ChipRemove">,
        options: React.ForwardedRef<HTMLButtonElement>,
      ): React.ReactElement => {
        let value = (0, runtime.useTranslation)("removeItem", "Remove {item}", {
          item: "item",
        });
        return (
          <runtime.baseCombobox.ChipRemove
            ref={options}
            aria-label={value}
            {...props}
            className={(0, runtime.cn)(COMBOBOX_CHIP_REMOVE_CLASS, className)}
          >
            {children ?? <runtime.Icon name={"X"} size={"sm"} />}
          </runtime.baseCombobox.ChipRemove>
        );
      },
    );
    ComboboxChipRemove.displayName = "Combobox.ChipRemove";
    (
      Combobox as typeof Combobox & {
        displayName?: string;
      }
    ).displayName = "Combobox";
    ComboboxOptionRow = reactForUiInputs25.memo(
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
      }: ComboboxRowProps<Value>) => {
        let value = indicator === "checkbox",
          value2 =
            announcedGroupLabel !== undefined ? (
              <span className={"sr-only"}>{`, ${announcedGroupLabel}`}</span>
            ) : null;
        return (
          <jsxForUiInputs24.Fragment>
            {[
              !leadsList && (item.separatorBefore || separatorAbove) && (
                <runtime.baseCombobox.Separator
                  className={COMBOBOX_SEPARATOR_CLASS}
                  data-cds-part={COMBOBOX_SEPARATOR_PART}
                />
              ),
              groupCaption !== undefined && (
                <div aria-hidden={true} className={COMBOBOX_GROUP_LABEL_CLASS}>
                  {groupCaption}
                </div>
              ),
              <runtime.baseCombobox.Item
                value={item}
                index={index}
                disabled={item.disabled}
                data-stale={stale || undefined}
                className={COMBOBOX_ITEM_CLASS}
                title={renderItem ? undefined : item.label}
              >
                {[
                  value && (
                    <span
                      data-size={"xs"}
                      className={
                        "flex shrink-0 -ml-[calc(var(--cds-pad-md)-(var(--cds-h-control)-var(--cds-checkbox))/2)]"
                      }
                    >
                      <runtime.CheckboxVisual checked={selected} />
                    </span>
                  ),
                  item.icon !== undefined && (
                    <runtime.IconSlot icon={item.icon} />
                  ),
                  renderItem ? (
                    <div className={"min-w-0 flex-1"}>
                      {[renderItem(item, searchQuery), value2]}
                    </div>
                  ) : (
                    <div className={"flex min-w-0 flex-1 flex-col gap-0.5"}>
                      {[
                        <span className={"truncate"}>
                          {[item.label, value2]}
                        </span>,
                        item.description !== undefined && (
                          <span
                            className={`text-footnote leading-snug text-muted ${wrapDescription ? "whitespace-normal break-words" : "truncate"}`}
                          >
                            {item.description}
                          </span>
                        ),
                      ]}
                    </div>
                  ),
                  indicator === "check" && (
                    <runtime.baseCombobox.ItemIndicator
                      className={"shrink-0 text-accent"}
                    >
                      <runtime.Icon name={"Check"} size={"auto"} bold={true} />
                    </runtime.baseCombobox.ItemIndicator>
                  ),
                ]}
              </runtime.baseCombobox.Item>,
            ]}
          </jsxForUiInputs24.Fragment>
        );
      },
    ) as GenericComboboxRow;
    ComboboxOptionRow.displayName = "ComboboxItem";
    ComboboxTrigger = reactForUiInputs25.forwardRef(
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
        let value = reactForUiInputs25.useId(),
          value2 = (0, runtime.useHasFieldContext)(),
          value3 =
            props["aria-label"] !== undefined ||
            props["aria-labelledby"] !== undefined ||
            props.id !== undefined ||
            props.render !== undefined ||
            value2,
          value4 = useComboboxTriggerRef(options);
        return (
          <runtime.baseCombobox.Trigger
            ref={value4}
            {...(value3
              ? {}
              : {
                  "aria-labelledby": value,
                })}
            data-cds={"Combobox"}
            {...props}
            {...(0, runtime.getControlSizeAttributes)(size)}
            className={(0, runtime.cn)(
              COMBOBOX_TRIGGER_CLASS,
              COMBOBOX_VARIANT_CLASSES[variant],
              "px-sm focus-visible:shadow-focus data-[invalid]:focus-visible:shadow-focus-danger",
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
          </runtime.baseCombobox.Trigger>
        );
      },
    );
    ComboboxTrigger.displayName = "Combobox.Trigger";
    ComboboxValue = reactForUiInputs25.forwardRef(
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
            <runtime.baseCombobox.Value>{children}</runtime.baseCombobox.Value>
          ) : placeholder !== undefined ? (
            <runtime.baseCombobox.Value>
              {(input: React.ReactNode) =>
                input === null || input === undefined || input === "" ? (
                  <span className={"text-muted"}>{placeholder}</span>
                ) : (
                  input
                )
              }
            </runtime.baseCombobox.Value>
          ) : (
            <runtime.baseCombobox.Value />
          )}
        </span>
      ),
    );
    ComboboxValue.displayName = "Combobox.Value";
    COMBOBOX_AUTOCOMPLETE_INPUT_PROPS = {
      autoComplete: "off",
      "data-1p-ignore": true,
      "data-lpignore": "true",
    };
    ComboboxInput = reactForUiInputs25.forwardRef(
      (
        {
          className: className,
          "aria-label": ariaLabel,
          "aria-labelledby": ariaLabelledby,
          ...props
        }: ComboboxPartProps<"Input">,
        options: React.ForwardedRef<HTMLInputElement>,
      ): React.ReactElement => {
        useComboboxOutsideInputRegistration();
        let { ref: value, nameProps: value2 } = useComboboxAccessibleName(
          useComboboxPopupInputRef(useComboboxTriggerRef(options)),
          ariaLabel,
          ariaLabelledby,
        );
        return (
          <runtime.baseCombobox.Input
            ref={value}
            {...COMBOBOX_AUTOCOMPLETE_INPUT_PROPS}
            {...value2}
            {...props}
            className={(0, runtime.cn)(COMBOBOX_INLINE_INPUT_CLASS, className)}
          />
        );
      },
    );
    ComboboxInput.displayName = "Combobox.Input";
    ComboboxPopupSearch = reactForUiInputs25.forwardRef(
      (
        {
          className: className,
          "aria-label": ariaLabel,
          "aria-labelledby": ariaLabelledby,
          ...props
        }: ComboboxPartProps<"Input">,
        options: React.ForwardedRef<HTMLInputElement>,
      ): React.ReactElement => {
        let { ref: value, nameProps: value2 } = useComboboxAccessibleName(
          useComboboxPopupInputRef(options),
          ariaLabel,
          ariaLabelledby,
        );
        return (
          <runtime.baseCombobox.Input
            ref={value}
            {...COMBOBOX_AUTOCOMPLETE_INPUT_PROPS}
            {...value2}
            {...props}
            className={(0, runtime.cn)(COMBOBOX_POPUP_SEARCH_CLASS, className)}
          />
        );
      },
    );
    ComboboxPopupSearch.displayName = "Combobox.PopupSearch";
    ComboboxClear = reactForUiInputs25.forwardRef(
      (
        {
          className: className,
          children: children,
          "aria-label": ariaLabel,
          ...props
        }: ComboboxPartProps<"Clear">,
        options: React.ForwardedRef<HTMLButtonElement>,
      ): React.ReactElement => {
        let value = (0, runtime.useTranslation)(
          "clearSelection",
          "Clear selection",
        );
        return (
          <runtime.baseCombobox.Clear
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
      ComboboxCaret as typeof ComboboxCaret & {
        displayName?: string;
      }
    ).displayName = "Combobox.Caret";
    ComboboxFooterAction = reactForUiInputs25.forwardRef(
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
          {[
            icon && (
              <runtime.IconSlot
                icon={
                  <runtime.Icon
                    name={icon}
                    size={"auto"}
                    className={"text-muted"}
                  />
                }
              />
            ),
            children,
          ]}
        </button>
      ),
    );
    ComboboxFooterAction.displayName = "Combobox.FooterAction";
    ComboboxPopup = reactForUiInputs25.forwardRef(
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
        if ((0, runtime.useHasSheetFrame)()) {
          return <ComboboxSheetCapablePopup {...state} ref={options} />;
        } else {
          return (
            <ComboboxPopupView
              {...state}
              ref={options}
              sheetPopup={runtime.defaultSheetHost}
              sheetParts={null}
            />
          );
        }
      },
    );
    ComboboxPopup.displayName = "Combobox.Popup";
    ComboboxSheetCapablePopup = reactForUiInputs25.forwardRef(
      (
        input: ComboboxPopupProps,
        options: React.ForwardedRef<HTMLDivElement>,
      ): React.ReactElement => (
        <runtime.AdaptiveSheetPopupHost kind={"combobox"}>
          {(input2: SheetRenderState, options2: MobileSheetParts | null) => (
            <ComboboxPopupView
              {...input}
              ref={options}
              sheetPopup={input2}
              sheetParts={options2}
            />
          )}
        </runtime.AdaptiveSheetPopupHost>
      ),
    );
    ComboboxSheetCapablePopup.displayName = "ComboboxSheetCapablePopup";
    ComboboxPopupView = reactForUiInputs25.forwardRef(function (
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
        value18 = (0, runtime.useOverlayLayer)("combobox", value5),
        sheet = sheetPopup.sheet,
        value19 = sheetPopup.sheet ? sheetPopup.chrome : null,
        value20 = sheetPopup.sheet && sheetParts !== null ? sheetParts : null,
        ref = reactForUiInputs25.useRef(null),
        value21 = reactForUiInputs25.useContext(ComboboxRegistrationContext),
        value22 = reactForUiInputs25.useContext(ComboboxChipsContext),
        { ref: value23, nameProps: value24 } = (0,
        runtime.useMirroredAccessibleName)(
          options,
          useComboboxTriggerElement(),
          {
            ...(value11 !== undefined && {
              "aria-label": value11,
            }),
            ...(value12 !== undefined && {
              "aria-labelledby": value12,
            }),
          },
        ),
        value25 = (0, runtime.useMergedRefs)(value23, ref, sheetPopup.ref),
        callback = reactForUiInputs25.useCallback(
          (input: PopupInputKind): HTMLElement | undefined =>
            comboboxSheetLabel(
              input,
              ref.current,
              value21?.getPopupInput() ?? null,
              value21?.getList() ?? null,
            ),
          [value21],
        ),
        value26 = sheet
          ? callback
          : value3 !== undefined
            ? value3
            : value21 === null || value22
              ? false
              : callback,
        value27 = sheet ? undefined : comboboxListHeightStyle(value6),
        value28 = value27 ?? {},
        value29 = sheetPopup.style ?? {},
        value30 =
          value27 === undefined && sheetPopup.style === undefined
            ? value9
            : typeof value9 === "function"
              ? (
                  input: import("@base-ui/react/combobox").Combobox.Popup.State,
                ) => ({
                  ...value28,
                  ...(
                    value9 as (
                      state: import("@base-ui/react/combobox").Combobox.Popup.State,
                    ) => React.CSSProperties
                  )(input),
                  ...value29,
                })
              : {
                  ...value28,
                  ...value9,
                  ...value29,
                };
      return (
        <runtime.baseCombobox.Portal
          container={((0, runtime.usePortalContainer)()) as import("../contracts/overlays").BaseUIPortalContainer}
        >
          <runtime.PortalRoot
            {...value18.portalProps}
            style={
              sheetPopup.concealed
                ? {
                    ...value18.portalProps.style,
                    ...runtime.concealedPopupStyle,
                  }
                : value18.portalProps.style
            }
            surface={runtime.elevationSurfaceNames.popover}
            density={sheet ? runtime.SHEET_DENSITY : undefined}
          >
            {[
              value20 !== null && sheetPopup.sheet && (
                <value20.ComboboxSheetBackdrop sheetPopup={sheetPopup} />
              ),
              <runtime.layerBaseContext.Provider value={value18.base}>
                <runtime.baseCombobox.Positioner
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
                  {...(sheet ? (runtime.sheetPositioningOverrides as Partial<typeof runtime.sheetPositioningOverrides>) : {})}
                  className={(0, runtime.cn)(
                    value4 ?? "w-[var(--anchor-width)] min-w-[12rem]",
                    !sheet && COMBOBOX_ANCHOR_HIDDEN_CLASS,
                    sheet &&
                      sheetPopup.state.depth === 0 &&
                      "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-[100dvh] after:bg-surface-3",
                  )}
                >
                  <runtime.baseCombobox.Popup
                    data-cds={value17}
                    ref={value25}
                    initialFocus={value26}
                    {...value24}
                    {...(sheetPopup.attrs as React.HTMLAttributes<HTMLDivElement>)}
                    {...value13}
                    style={value30}
                    className={(0, runtime.cn)(
                      COMBOBOX_POPUP_CLASS,
                      sheet && runtime.sheetPopupClasses,
                      sheet &&
                        "data-[starting-style]:translate-y-[calc(100%+1.5rem)] data-[ending-style]:translate-y-[calc(100%+1.5rem)]",
                      sheet &&
                        "origin-top [&[data-cds-sheet-covered]:not([data-starting-style]):not([data-ending-style])]:-translate-y-3 data-[cds-sheet-covered]:scale-[0.94] after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-backdrop after:opacity-0 after:transition-opacity after:duration-sheet motion-reduce:after:transition-none data-[cds-sheet-covered]:after:opacity-100",
                      value8,
                    )}
                  >
                    <ComboboxPopupInputContext.Provider value={true}>
                      {value19 !== null ? (
                        <runtime.sheetParentContext.Provider
                          value={sheetPopup.stack}
                        >
                          {[
                            <value19.Handle />,
                            <value19.Body>
                              <div className={COMBOBOX_POPUP_BODY_CLASS}>
                                {[
                                  value10,
                                  <value19.DismissButton
                                    onDismiss={sheetPopup.frame?.dismiss}
                                    label={value7}
                                  />,
                                ]}
                              </div>
                            </value19.Body>,
                          ]}
                        </runtime.sheetParentContext.Provider>
                      ) : (
                        <div className={COMBOBOX_POPUP_BODY_CLASS}>
                          {value10}
                        </div>
                      )}
                    </ComboboxPopupInputContext.Provider>
                  </runtime.baseCombobox.Popup>
                </runtime.baseCombobox.Positioner>
              </runtime.layerBaseContext.Provider>,
            ]}
          </runtime.PortalRoot>
        </runtime.baseCombobox.Portal>
      );
    });
    ComboboxPopupView.displayName = "ComboboxPopupView";
    ComboboxList = reactForUiInputs25.forwardRef(
      (
        {
          className: className,
          "aria-label": ariaLabel,
          "aria-labelledby": ariaLabelledby,
          ...props
        }: ComboboxPartProps<"List">,
        options: React.ForwardedRef<HTMLDivElement>,
      ): React.ReactElement => {
        let { ref: value, nameProps: value2 } = (0,
        runtime.useMirroredAccessibleName)(
          useComboboxListRef(options),
          useComboboxTriggerElement(),
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
          <runtime.baseCombobox.List
            ref={value}
            {...value2}
            {...props}
            className={(0, runtime.cn)(COMBOBOX_LIST_CLASS, className)}
            {...{
              [runtime.SHEET_SCROLL_ATTRIBUTE]: "",
            }}
          />
        );
      },
    );
    ComboboxList.displayName = "Combobox.List";
    ComboboxEmpty = reactForUiInputs25.forwardRef(
      (
        {
          className: className,
          children: children,
          ...props
        }: ComboboxPartProps<"Empty">,
        options: React.ForwardedRef<HTMLDivElement>,
      ): React.ReactElement => {
        let value = (0, runtime.useTranslation)(
          "noResults",
          COMBOBOX_NO_RESULTS_LABEL,
        );
        return (
          <runtime.baseCombobox.Empty
            ref={options}
            {...props}
            className={(0, runtime.cn)(COMBOBOX_EMPTY_CLASS, className)}
          >
            {children === undefined ? value : children}
          </runtime.baseCombobox.Empty>
        );
      },
    );
    ComboboxEmpty.displayName = "Combobox.Empty";
    ComboboxItem = reactForUiInputs25.forwardRef(
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
      ) => (
        <runtime.baseCombobox.Item
          ref={options}
          data-stale={stale || undefined}
          {...props}
          className={(0, runtime.cn)(COMBOBOX_ITEM_CLASS, className)}
        >
          {[
            icon !== undefined && <runtime.IconSlot icon={icon} />,
            <div className={"flex min-w-0 flex-1 flex-col gap-0.5"}>
              {[
                <span className={"truncate"}>{children}</span>,
                description !== undefined && (
                  <span
                    className={
                      "whitespace-normal break-words text-footnote leading-snug text-muted"
                    }
                  >
                    {description}
                  </span>
                ),
              ]}
            </div>,
            <ComboboxItemIndicator />,
          ]}
        </runtime.baseCombobox.Item>
      ),
    );
    ComboboxItem.displayName = "Combobox.Item";
    ComboboxItemIndicator = reactForUiInputs25.forwardRef(
      (
        {
          className: className,
          children: children,
          ...props
        }: ComboboxPartProps<"ItemIndicator">,
        options: React.ForwardedRef<HTMLSpanElement>,
      ): React.ReactElement => (
        <runtime.baseCombobox.ItemIndicator
          ref={options}
          {...props}
          className={(0, runtime.cn)("shrink-0 text-accent", className)}
        >
          {children ?? <runtime.Icon name={"Check"} size={"md"} bold={true} />}
        </runtime.baseCombobox.ItemIndicator>
      ),
    );
    ComboboxItemIndicator.displayName = "Combobox.ItemIndicator";
    ComboboxGroupLabel = reactForUiInputs25.forwardRef(
      (
        { className: className, ...props }: ComboboxPartProps<"GroupLabel">,
        options: React.ForwardedRef<HTMLDivElement>,
      ): React.ReactElement => (
        <runtime.baseCombobox.GroupLabel
          ref={options}
          {...props}
          className={(0, runtime.cn)(COMBOBOX_GROUP_LABEL_CLASS, className)}
        />
      ),
    );
    ComboboxGroupLabel.displayName = "Combobox.GroupLabel";
    (
      ComboboxSeparator as typeof ComboboxSeparator & {
        displayName?: string;
      }
    ).displayName = "Combobox.Separator";
    (
      ComboboxFooter as typeof ComboboxFooter & {
        displayName?: string;
      }
    ).displayName = "Combobox.Footer";
    ComboboxChips = reactForUiInputs25.forwardRef(
      (
        { size: size, className: className, ...props }: ComboboxChipsProps,
        options: React.ForwardedRef<HTMLDivElement>,
      ): React.ReactElement => (
        <runtime.baseCombobox.Chips
          ref={options}
          {...props}
          {...(0, runtime.getControlSizeAttributes)(size)}
          className={(0, runtime.cn)(
            COMBOBOX_CHIPS_INPUT_CLASS,
            "h-auto min-h-control flex-wrap py-1 pl-sm [&>*]:relative",
            className,
          )}
        />
      ),
    );
    ComboboxChips.displayName = "Combobox.Chips";
    ComboboxRegistrationContext =
      reactForUiInputs25.createContext<ComboboxRegistration | null>(null);
    ComboboxChipsContext = reactForUiInputs25.createContext(false);
    ComboboxPopupInputContext = reactForUiInputs25.createContext(false);
    nullComboboxElement = () => null;
    (
      ComboboxRoot as typeof ComboboxRoot & {
        displayName?: string;
      }
    ).displayName = "Combobox.Root";
    ComboboxComponents = Object.assign(Combobox, {
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
      Status: runtime.ComboboxStatus,
      Item: ComboboxItem,
      ItemIndicator: ComboboxItemIndicator,
      Group: runtime.baseCombobox.Group,
      GroupLabel: ComboboxGroupLabel,
      Separator: ComboboxSeparator,
      Footer: ComboboxFooter,
      Chips: ComboboxChips,
      Chip: ComboboxChip,
      ChipRemove: ComboboxChipRemove,
      Collection: runtime.baseCombobox.Collection,
    });
    jsxForUiInputs25 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    (
      FieldCombobox as typeof FieldCombobox & {
        displayName?: string;
      }
    ).displayName = "Field.Combobox";
  };
}
