/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type * as React from "react";
import type {
  ReactNamespace,
  JsxNamespace,
  NumberPropertyRowProps,
  ColorChipProps,
  ColorPropertyRowProps,
  ColorTextPropertyRowProps,
} from "../contracts/composition";
export function installUiPropertyRows(runtime: RuntimeBindings): () => void {
  var reactForUiPropertyRows: ReactNamespace;
  var jsxmq: JsxNamespace;
  var COLOR_CHIP_PATTERN: RegExp;
  var preventDefaultEvent: (event: React.SyntheticEvent) => void;
  function NumberPropertyRow({
    label: label,
    value: value,
    onValue: onValue,
    onScrub: onScrub,
    onScrubEnd: onScrubEnd,
    min: min,
    max: max,
    step: step,
    smallStep: smallStep,
    placeholder: placeholder,
    hint: hint,
    emptyStepFrom: emptyStepFrom,
    clearable: clearable,
    prefix: prefix,
    unit: unit,
    units: units,
    onUnit: onUnit,
    mixed: mixed,
    adornment: adornment,
    trailing: trailing,
    onReset: onReset,
    disabled: disabled,
    title: title,
    description: description,
  }: NumberPropertyRowProps) {
    let ref = reactForUiPropertyRows.useRef(false),
      callback = () => {
        ref.current = true;
        setTimeout(() => {
          ref.current = false;
        }, 0);
        onScrubEnd?.();
      },
      value2 =
        onScrub &&
        emptyStepFrom !== null &&
        placeholder !== undefined &&
        /^-?\d+(\.\d+)?$/.test(placeholder)
          ? Number(placeholder)
          : undefined,
      value3 =
        value ??
        (typeof emptyStepFrom === "number" && Number.isFinite(emptyStepFrom)
          ? emptyStepFrom
          : value2),
      value4 = !disabled && !mixed && value3 !== undefined,
      value5 = (0, runtime.useNumberScrubGesture)({
        value: value3 ?? NaN,
        step: step,
        min: min,
        max: max,
        disabled: !value4,
        onScrub: (input: number) => (onScrub ?? onValue)(input),
        onScrubEnd: callback,
      }),
      value6 = units !== undefined && onUnit !== undefined;
    return (
      <runtime.PropertyRow
        label={label}
        title={title}
        description={description}
        disabled={disabled}
        onReset={onReset}
        trailing={trailing}
        labelProps={{
          onMouseDown: value4 ? value5 : undefined,
          onPointerDown: value4 ? runtime.captureNumberScrubPointer : undefined,
          className: value4 ? "cursor-ew-resize" : undefined,
        }}
        onPress={(element: HTMLElement) => {
          if (ref.current) {
            return;
          }
          element.querySelector("input")?.focus();
        }}
      >
        {[
          <runtime.PropertyNumberInput
            aria-label={label}
            prefix={prefix}
            unit={value6 ? undefined : unit}
            value={value}
            onValue={onValue}
            onScrub={onScrub}
            onScrubEnd={callback}
            min={min}
            max={max}
            step={step}
            smallStep={smallStep}
            placeholder={placeholder}
            hint={hint}
            emptyStepFrom={emptyStepFrom}
            clearable={clearable}
            mixed={mixed}
            disabled={disabled}
          />,
          value6 ? (
            <runtime.Select
              compact={true}
              aria-label={label + " unit"}
              title={"Unit"}
              items={units!.map((input: string) => ({
                value: input,
                label: input,
              }))}
              value={unit ?? units![0] ?? null}
              onChange={onUnit!}
              disabled={disabled}
              align={"end"}
            />
          ) : null,
          adornment,
        ]}
      </runtime.PropertyRow>
    );
  }
  function ColorChip({
    hex: hex,
    alpha = 100,
    className: className,
  }: ColorChipProps) {
    return (
      <span
        aria-hidden={"true"}
        className={(0, runtime.joinClassNames)(
          runtime.COLOR_SWATCH_CLASS,
          className,
        )}
      >
        {hex !== null ? (
          <jsxmq.Fragment>
            {[
              <span
                className={"absolute inset-y-0 left-0 w-1/2"}
                style={{
                  backgroundColor: hex,
                }}
              />,
              <span
                className={"absolute inset-y-0 right-0 w-1/2"}
                style={{
                  backgroundColor: hex,
                  opacity: Math.round(alpha * 100) / 1e4,
                }}
              />,
            ]}
          </jsxmq.Fragment>
        ) : null}
      </span>
    );
  }
  function useContrastResult(
    contrast: import("../contracts/color-controls").ContrastOptions | undefined,
    value: string | undefined,
  ) {
    let value2 = contrast === undefined ? undefined : JSON.stringify(contrast);
    return reactForUiPropertyRows.useMemo(
      () =>
        contrast === undefined || value === undefined
          ? undefined
          : (0, runtime.colorContrastResults)(value, contrast),
      [value2, value],
    );
  }
  function ColorPropertyRow({
    label: label,
    value: value,
    onChange: onChange,
    onLive: onLive,
    onLiveEnd: onLiveEnd,
    swatches: swatches,
    current: current,
    onSwatch: onSwatch,
    fold: fold,
    opaque: opaque,
    description: description,
    contrast: contrast,
    contrastMark = false,
    placeholder: placeholder,
    clearLabel: clearLabel,
    popupAttrs: popupAttrs,
    mixed = false,
    unset = false,
    valueName: valueName,
    chip: chip,
    headerTabs: headerTabs,
    panel: panel,
    closeLabel = runtime.DEFAULT_CLOSE_LABEL,
    popoverTitle: popoverTitle,
    allowNone: allowNone,
    onNone: onNone,
    isNone: isNone,
    noneDisabledReason: noneDisabledReason,
    disabled: disabled,
    disabledReason: disabledReason,
    keepFocus = false,
    editsAreUndoSteps: editsAreUndoSteps,
    popover: popover,
    open: open,
    onOpenChange: onOpenChange,
    title: title,
    testid: testid,
  }: ColorPropertyRowProps) {
    let [value2, value3] = reactForUiPropertyRows.useState(false),
      value4 = open ?? value2,
      callback = (input: boolean) => {
        value3(input);
        onOpenChange?.(input);
      },
      [value5, value6] = reactForUiPropertyRows.useState(false),
      ref = reactForUiPropertyRows.useRef(false),
      ref2 = reactForUiPropertyRows.useRef<HTMLButtonElement | null>(null),
      value7 = popover?.anchor,
      value8 =
        value7 === undefined
          ? undefined
          : () => (ref2.current === null ? null : value7(ref2.current)),
      memo = reactForUiPropertyRows.useMemo(() => {
        let value23 = value ?? placeholder;
        if (value23 === undefined) {
          return;
        }
        let value24 = (0, runtime.parseCssColorToHsva)(value23);
        return {
          solid: (0, runtime.hsvaToHexColor)(value24),
          alpha: value24.a,
        };
      }, [value, placeholder]),
      value9 = value !== undefined && COLOR_CHIP_PATTERN.test(value),
      memo2 = reactForUiPropertyRows.useMemo(() => {
        if (!value9 || memo === undefined) {
          return;
        }
        if (valueName !== undefined) {
          return valueName ?? undefined;
        }
        if (swatches === undefined) {
          return;
        }
        if (current !== undefined) {
          if (current === null) {
            return;
          }
          let value24 = swatches.find(
            (input: import("../contracts/color-controls").ColorSwatchInput) =>
              typeof input !== "string" &&
              (input.name === current ||
                ("picks" in input && input.picks === current)),
          );
          if (
            value24 !== undefined &&
            typeof value24 !== "string" &&
            value24.label !== undefined &&
            value24.label.trim() !== ""
          ) {
            return value24.label;
          } else {
            return undefined;
          }
        }
        let value23 = memo.solid.toLowerCase();
        for (let value24 of swatches) {
          let value25 =
            typeof value24 === "string"
              ? value24
              : "value" in value24
                ? value24.value
                : value24.color;
          if (!COLOR_CHIP_PATTERN.test(value25)) {
            continue;
          }
          let value26 = (0, runtime.parseCssColorToHsva)(value25);
          if (value26.a < 1) {
            continue;
          }
          if ((0, runtime.hsvaToHexColor)(value26).toLowerCase() !== value23) {
            continue;
          }
          if (
            typeof value24 !== "string" &&
            value24.label !== undefined &&
            value24.label.trim() !== ""
          ) {
            return value24.label;
          } else {
            return undefined;
          }
        }
        return;
      }, [value9, memo, swatches, current, valueName]),
      value10 =
        value !== undefined
          ? typeof valueName === "string"
            ? valueName
            : value9 && memo !== undefined
              ? (memo2 ?? memo.solid.toUpperCase())
              : value
          : (clearLabel ?? placeholder ?? "None"),
      value11 =
        value9 && memo !== undefined && memo.alpha < 1
          ? Math.round(memo.alpha * 100) + "%"
          : undefined,
      value12 =
        mixed || chip !== undefined ? undefined : (value ?? placeholder),
      value13 = useContrastResult(contrast, value12),
      memo3 = reactForUiPropertyRows.useMemo(
        () =>
          value13 === undefined
            ? undefined
            : (0, runtime.contrastDisplayInfo)(value13).sentence,
        [value13],
      ),
      value14 =
        description !== undefined && description !== ""
          ? memo3 !== undefined
            ? description.replace(/\.?\s*$/, ". ") + memo3
            : description
          : memo3,
      value15 = reactForUiPropertyRows.useId(),
      value16 = swatches !== undefined && swatches.length > 0,
      value17 =
        headerTabs === undefined ||
        headerTabs.value === (headerTabs.colorTab ?? "color"),
      [value18, value19] = reactForUiPropertyRows.useState("system"),
      [value20, value21] = reactForUiPropertyRows.useState(value4);
    if (value4 !== value20) {
      value21(value4);
      if (value4) {
        value19(value16 && value17 ? "system" : "custom");
        value6(ref.current);
        ref.current = false;
      }
    }
    let value22 = (
      <runtime.ColorSelect
        testid={testid !== undefined ? testid + "-menu" : undefined}
        title={popoverTitle ?? label}
        swatches={swatches}
        current={current}
        onSwatch={onSwatch}
        fold={fold}
        value={value ?? placeholder ?? "#000000"}
        unset={value === undefined || mixed || !value17 || unset}
        repick={unset && current != null}
        opaque={opaque}
        contrast={value12 !== undefined ? contrast : undefined}
        onChange={onLive ?? onChange}
        onPickEnd={onLive ? onLiveEnd : undefined}
        none={
          allowNone
            ? {
                current:
                  isNone ??
                  (value === undefined &&
                    placeholder === undefined &&
                    chip === undefined &&
                    !mixed),
                onPick: () => {
                  if (onNone) {
                    onNone();
                  } else {
                    onChange(undefined);
                  }
                  callback(false);
                },
                ...(noneDisabledReason !== undefined
                  ? {
                      disabledReason: noneDisabledReason,
                    }
                  : {}),
              }
            : undefined
        }
        kind={
          headerTabs !== undefined
            ? {
                value: headerTabs.value,
                options: headerTabs.options,
                onChange: headerTabs.onChange,
                label: headerTabs.label ?? label,
                colorValue: headerTabs.colorTab,
              }
            : undefined
        }
        face={panel}
        tab={value16 ? value18 : undefined}
        onTab={value19}
        heading={popoverTitle ?? label}
        headerEnd={
          value16 || headerTabs !== undefined || popoverTitle !== undefined ? (
            <runtime.Button
              variant={"ghost"}
              size={"sm"}
              iconOnly={true}
              icon={
                <runtime.Icon
                  name={"X"}
                  size={"sm"}
                  className={"text-secondary"}
                />
              }
              aria-label={closeLabel}
              onClick={() => callback(false)}
              className={"relative shrink-0"}
            />
          ) : undefined
        }
      />
    );
    return (
      <span
        ref={ref2}
        className={"relative flex min-w-0 flex-1"}
        title={disabled ? disabledReason : undefined}
      >
        {[
          <runtime.PropertyPopup
            open={value4}
            onOpen={() => callback(true)}
            onClose={() => callback(false)}
            trigger={
              <runtime.FieldButton
                data-testid={testid}
                title={disabled ? (disabledReason ?? title) : title}
                aria-label={
                  label +
                  ": " +
                  (mixed
                    ? runtime.MIXED_LABEL
                    : chip !== undefined
                      ? chip.text
                      : value !== undefined
                        ? value10 + (value11 !== undefined ? " " + value11 : "")
                        : clearLabel !== undefined &&
                            /[\p{L}\p{N}]/u.test(clearLabel)
                          ? clearLabel
                          : clearLabel !== undefined
                            ? "none"
                            : "unset")
                }
                aria-describedby={value14 !== undefined ? value15 : undefined}
                disabled={disabled}
                onClick={(input: React.MouseEvent<HTMLElement>) => {
                  if (!value4) {
                    ref.current = input.detail === 0;
                  }
                }}
                onMouseDown={keepFocus ? preventDefaultEvent : undefined}
                muted={mixed}
                chip={
                  mixed ? (
                    <runtime.PropertyColorPreview data-kit={"swatch-mixed"}>
                      {[
                        <span
                          className={"absolute inset-y-0 left-0 w-1/2"}
                          style={{
                            backgroundColor: "#ffffff",
                          }}
                        />,
                        <span
                          className={"absolute inset-y-0 right-0 w-1/2"}
                          style={{
                            backgroundColor: "#141413",
                          }}
                        />,
                      ]}
                    </runtime.PropertyColorPreview>
                  ) : chip !== undefined ? (
                    <runtime.PropertyColorPreview
                      data-kit={"swatch-chip"}
                      background={chip.css}
                    />
                  ) : (
                    <ColorChip
                      hex={memo?.solid ?? null}
                      alpha={(memo?.alpha ?? 1) * 100}
                    />
                  )
                }
                caption={!mixed && chip === undefined ? value11 : undefined}
                trailing={
                  contrastMark && value13 !== undefined ? (
                    <runtime.ContrastMark
                      results={value13}
                      sentence={false}
                      className={"ml-auto pl-1"}
                    />
                  ) : undefined
                }
              >
                {mixed
                  ? runtime.MIXED_LABEL
                  : chip !== undefined
                    ? chip.text
                    : value10}
              </runtime.FieldButton>
            }
            align={"left"}
            side={popover?.side}
            positionAnchor={value8}
            padding={"none"}
            aria-label={popoverTitle ?? label}
            className={runtime.COLOR_PICKER_POPOVER_CLASS}
            popupAttrs={popupAttrs}
            editsAreUndoSteps={editsAreUndoSteps}
            focusOnOpen={value5}
            keepFocus={keepFocus}
            planHeight={
              value16 || headerTabs !== undefined
                ? runtime.COLOR_PICKER_POPOVER_HEIGHT
                : undefined
            }
          >
            {keepFocus ? (
              <div
                data-session-strip={""}
                onKeyDownCapture={runtime.popupPointerEvent}
              >
                {value22}
              </div>
            ) : (
              value22
            )}
          </runtime.PropertyPopup>,
          value14 !== undefined ? (
            <span id={value15} hidden={true} data-kit={"field-description"}>
              {value14}
            </span>
          ) : null,
        ]}
      </span>
    );
  }
  function ColorTextPropertyRow({
    label: label,
    value: value,
    onChange: onChange,
    contrast: contrast,
    placeholder: placeholder,
    clearLabel: clearLabel,
    adornment: adornment,
    trailing: trailing,
    mixed = false,
    chip: chip,
    onReset: onReset,
    disabled: disabled,
    title: title,
    description: description,
    ...remainingProps
  }: ColorTextPropertyRowProps) {
    let [value2, value3] = reactForUiPropertyRows.useState(false);
    return (
      <runtime.PropertyRow
        label={label}
        title={title}
        disabled={disabled}
        onReset={
          onReset ??
          (clearLabel !== undefined && value !== undefined
            ? () => onChange(undefined)
            : undefined)
        }
        trailing={trailing}
        onPress={() => {
          if (disabled) {
            return;
          }
          value3(!value2);
        }}
        onPointerDown={(event: React.PointerEvent<HTMLDivElement>) => {
          if (
            value2 &&
            !(0, runtime.propertyRowPressShouldIgnore)(
              event.currentTarget,
              event.target as Element,
            )
          ) {
            event.stopPropagation();
          }
        }}
      >
        {[
          <ColorPropertyRow
            {...remainingProps}
            label={label}
            value={value}
            onChange={onChange}
            description={description}
            contrast={contrast}
            placeholder={placeholder}
            clearLabel={clearLabel}
            mixed={mixed}
            chip={chip}
            disabled={disabled}
            open={value2}
            onOpenChange={value3}
          />,
          adornment,
        ]}
      </runtime.PropertyRow>
    );
  }
  bindRuntimeValue(
    runtime,
    "reactForUiPropertyRows",
    () => reactForUiPropertyRows,
    (value) => {
      reactForUiPropertyRows = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxmq",
    () => jsxmq,
    (value) => {
      jsxmq = value;
    },
  );
  bindRuntimeValue(runtime, "NumberPropertyRow", () => NumberPropertyRow);
  bindRuntimeValue(
    runtime,
    "COLOR_CHIP_PATTERN",
    () => COLOR_CHIP_PATTERN,
    (value) => {
      COLOR_CHIP_PATTERN = value;
    },
  );
  bindRuntimeValue(runtime, "ColorChip", () => ColorChip);
  bindRuntimeValue(runtime, "useContrastResult", () => useContrastResult);
  bindRuntimeValue(runtime, "ColorPropertyRow", () => ColorPropertyRow);
  bindRuntimeValue(
    runtime,
    "preventDefaultEvent",
    () => preventDefaultEvent,
    (value) => {
      preventDefaultEvent = value;
    },
  );
  bindRuntimeValue(runtime, "ColorTextPropertyRow", () => ColorTextPropertyRow);
  return () => {
    reactForUiPropertyRows = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxmq = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    COLOR_CHIP_PATTERN =
      /^(?:#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\(\s*[\d.]+[\s,]+[\d.]+[\s,]+[\d.]+(?:[\s,/]+[\d.]+)?\s*\))$/i;
    preventDefaultEvent = (event: React.SyntheticEvent) =>
      event.preventDefault();
  };
}
