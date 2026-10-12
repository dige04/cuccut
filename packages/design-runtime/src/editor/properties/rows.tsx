/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorPropertiesRows(
  runtime: RuntimeBindings,
): () => void {
  var PropertiesRowsLimit: Dynamic;
  var PropertiesRowsRgbaPattern: Dynamic;
  var PropertiesRowsPreventDefault: Dynamic;
  var jsxPropertiesRows: Dynamic;
  function PropertyPanelRoot({
    className: className,
    children: children,
    ...props
  }: Dynamic): Dynamic {
    return (
      <runtime.CdsRoot
        density={"compact"}
        render={
          <div
            className={(0, runtime.joinClassNames)(
              "flex flex-col",
              "[--prop-row-h:32px] pointer-coarse:[--prop-row-h:40px]",
              className,
            )}
            {...props}
          />
        }
      >
        {children}
      </runtime.CdsRoot>
    );
  }
  function PropertyTextRow({
    label: label,
    onReset: onReset,
    title: title,
    description: description,
    onPress: onPress,
    disabled: disabled2,
    trailing: trailing,
    children: children,
  }: Dynamic): Dynamic {
    return (
      <runtime.PropertyRow
        label={label}
        onReset={onReset}
        onPress={onPress}
        disabled={disabled2}
        title={title}
        description={description}
        trailing={trailing}
      >
        {children}
      </runtime.PropertyRow>
    );
  }
  function PropertyNumberRow({
    label: label,
    value: value,
    onValue: onValue,
    onScrub: onScrub,
    onScrubEnd: onScrubEnd,
    min: min2,
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
    disabled: disabled2,
    title: title,
    description: description,
  }: Dynamic): Dynamic {
    let value2: Dynamic = (0, runtime.reactPropertiesSection.useRef)(false),
      callback: Dynamic = (): Dynamic => {
        value2.current = true;
        setTimeout((): Dynamic => {
          value2.current = false;
        }, 0);
        onScrubEnd?.();
      },
      value3: Dynamic =
        onScrub &&
        emptyStepFrom !== null &&
        placeholder !== undefined &&
        /^-?\d+(\.\d+)?$/.test(placeholder)
          ? Number(placeholder)
          : undefined,
      value4: Dynamic =
        value ??
        (typeof emptyStepFrom == "number" && Number.isFinite(emptyStepFrom)
          ? emptyStepFrom
          : value3),
      value5: Dynamic = !disabled2 && !mixed && value4 !== undefined,
      value6: Dynamic = (0, runtime.useNumericScrub)({
        value: value4 ?? NaN,
        step: step,
        min: min2,
        max: max,
        disabled: !value5,
        onScrub: (input?: Dynamic): Dynamic => (onScrub ?? onValue)(input),
        onScrubEnd: callback,
      }),
      value7: Dynamic = units !== undefined && onUnit !== undefined;
    return (
      <runtime.PropertyRow
        label={label}
        title={title}
        description={description}
        disabled={disabled2}
        onReset={onReset}
        trailing={trailing}
        labelProps={{
          onMouseDown: value5 ? value6 : undefined,
          onPointerDown: value5 ? runtime.captureNumericPointer : undefined,
          className: value5 ? "cursor-ew-resize" : undefined,
        }}
        onPress={(element?: Dynamic): Dynamic => {
          value2.current || element.querySelector("input")?.focus();
        }}
      >
        <runtime.NumericInput
          aria-label={label}
          prefix={prefix}
          unit={value7 ? undefined : unit}
          value={value}
          onValue={onValue}
          onScrub={onScrub}
          onScrubEnd={callback}
          min={min2}
          max={max}
          step={step}
          smallStep={smallStep}
          placeholder={placeholder}
          hint={hint}
          emptyStepFrom={emptyStepFrom}
          clearable={clearable}
          mixed={mixed}
          disabled={disabled2}
        />
        {value7 ? (
          <runtime.PropertySelect
            compact={true}
            aria-label={label + " unit"}
            title={"Unit"}
            items={units.map(
              (input?: Dynamic): Dynamic => ({
                value: input,
                label: input,
              }),
            )}
            value={unit ?? units[0] ?? null}
            onChange={onUnit}
            disabled={disabled2}
            align={"end"}
          />
        ) : null}
        {adornment}
      </runtime.PropertyRow>
    );
  }
  function rangeFraction(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return context <= options
      ? 0
      : Math.max(0, Math.min(1, (input - options) / (context - options)));
  }
  function rangeValue(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let value2: Dynamic =
      options + Math.max(0, Math.min(1, input)) * (context - options);
    if (!value || value <= 0) return value2;
    let value3: Dynamic =
        Math.round((value2 - options) / value) * value + options,
      callback: Dynamic = (input2?: Dynamic): Dynamic => {
        let value6: Dynamic = String(input2),
          value7: Dynamic = value6.indexOf(".");
        return value7 === -1 ? 0 : value6.length - value7 - 1;
      },
      value4: Dynamic = Math.max(callback(value), callback(options)),
      value5: Dynamic = value4 === 0 ? value3 : Number(value3.toFixed(value4));
    return Math.max(options, Math.min(context, value5));
  }
  function PropertyRangeRow({
    label: label,
    value: value,
    onValue: onValue,
    onLive: onLive,
    onLiveEnd: onLiveEnd,
    min: min2 = 0,
    max = 100,
    step = 1,
    unit: unit,
    adornment: adornment,
    mixed = false,
    onReset: onReset,
    disabled: disabled2,
    title: title,
    description: description,
  }: Dynamic): Dynamic {
    let value2: Dynamic = (0, runtime.reactPropertiesSection.useRef)(new Set()),
      value3: Dynamic = (0, runtime.reactPropertiesSection.useRef)(onLiveEnd);
    value3.current = onLiveEnd;
    let value4: Dynamic = (0, runtime.reactPropertiesSection.useRef)(value);
    (0, runtime.reactPropertiesSection.useEffect)(
      (): Dynamic => (): Dynamic => {
        for (let value6 of value2.current as Dynamic) value6();
        value2.current.clear();
      },
      [],
    );
    let callback: Dynamic = (input?: Dynamic): Dynamic => {
        if (disabled2 || input.button !== 0) return;
        let currentTarget: Dynamic = input.currentTarget,
          bounds: Dynamic = currentTarget.getBoundingClientRect(),
          pointerId: Dynamic = input.pointerId;
        try {
          currentTarget.setPointerCapture(pointerId);
        } catch {}
        currentTarget.focus();
        let value6: Dynamic = value,
          flag: Dynamic = false,
          callback3: Dynamic = (input2?: Dynamic): Dynamic => {
            let value7: Dynamic = rangeValue(
              (input2 - bounds.left - 6) / (bounds.width - 12),
              min2,
              max,
              step,
            );
            value7 !== value6 &&
              ((value6 = value7), (flag = true), (onLive ?? onValue)(value7));
          };
        callback3(input.clientX);
        let callback4: Dynamic = (input2?: Dynamic): Dynamic => {
            input2.pointerId === pointerId && callback3(input2.clientX);
          },
          callback5: Dynamic = (): Dynamic => {
            (window as Dynamic).removeEventListener("pointermove", callback4);
            (window as Dynamic).removeEventListener("pointerup", callback7);
            (window as Dynamic).removeEventListener("pointercancel", callback7);
          },
          callback6: Dynamic = (): Dynamic => {
            value2.current.delete(callback6);
            callback5();
            flag && ((flag = false), value3.current?.(value6));
          },
          callback7: Dynamic = (input2?: Dynamic): Dynamic => {
            input2.pointerId === pointerId && callback6();
          };
        (window as Dynamic).addEventListener("pointermove", callback4);
        (window as Dynamic).addEventListener("pointerup", callback7);
        (window as Dynamic).addEventListener("pointercancel", callback7);
        value2.current.add(callback6);
      },
      callback2: Dynamic = (event?: Dynamic): Dynamic => {
        if (disabled2) return;
        let value6: Dynamic;
        if (event.key === "ArrowRight" || event.key === "ArrowUp")
          value6 = (0, runtime.stepNumericValue)(value, 1, event, {
            step: step,
            min: min2,
            max: max,
          });
        else if (event.key === "ArrowLeft" || event.key === "ArrowDown")
          value6 = (0, runtime.stepNumericValue)(value, -1, event, {
            step: step,
            min: min2,
            max: max,
          });
        else if (event.key === "Home") value6 = min2;
        else if (event.key === "End") value6 = max;
        else if (event.key === " ") {
          event.preventDefault();
          return;
        }
        value6 !== undefined &&
          (event.preventDefault(), value6 !== value && onValue(value6));
      },
      value5: Dynamic = rangeFraction(value, min2, max);
    return (
      <runtime.PropertyRow
        label={label}
        title={title}
        description={description}
        disabled={disabled2}
        onReset={onReset}
      >
        <div className={"w-[68px] shrink-0"}>
          <runtime.NumericInput
            aria-label={label}
            value={mixed ? undefined : value}
            mixed={mixed}
            emptyStepFrom={mixed ? null : undefined}
            onValue={(input?: Dynamic): Dynamic => {
              input !== undefined && onValue(input);
            }}
            onScrub={(input?: Dynamic): Dynamic => {
              value4.current = input;
              (onLive ?? onValue)(input);
            }}
            onScrubEnd={(): Dynamic => value3.current?.(value4.current)}
            min={min2}
            max={max}
            step={step}
            scrubOrigin={min2}
            unit={unit}
            steppers={false}
            disabled={disabled2}
          />
        </div>
        <div
          role={"slider"}
          aria-label={label}
          aria-valuemin={min2}
          aria-valuemax={max}
          aria-valuenow={mixed ? undefined : value}
          aria-valuetext={mixed ? runtime.MixedValue : undefined}
          aria-disabled={disabled2 || undefined}
          tabIndex={disabled2 ? -1 : 0}
          onPointerDown={callback}
          onKeyDown={callback2}
          className={
            "group/track relative ml-1 flex h-control min-w-8 flex-1 touch-none select-none items-center px-1.5 outline-none focus-visible:outline-hidden aria-disabled:opacity-50 pointer-coarse:h-10"
          }
        >
          <div className={"h-0.5 w-full rounded-full bg-alpha-2"}>
            {mixed ? null : (
              <div
                className={"h-full rounded-full bg-fill-accent"}
                style={{
                  width: String(value5 * 100) + "%",
                }}
              />
            )}
          </div>
          {mixed ? null : (
            <div
              data-kit={"slider-thumb"}
              className={(0, runtime.joinClassNames)(
                "pointer-events-none absolute h-3 w-3 -translate-x-1/2 rounded-full",
                "bg-surface-3 shadow-panel-sm group-focus-visible/track:shadow-focus",
              )}
              style={{
                left: "calc(" + String(value5) + " * (100% - 12px) + 6px)",
              }}
            />
          )}
        </div>
        {adornment}
      </runtime.PropertyRow>
    );
  }
  function PropertyBooleanRow({
    label: label,
    checked: checked,
    onChange: onChange,
    onReset: onReset,
    disabled: disabled2,
    title: title,
    description: description,
  }: Dynamic): Dynamic {
    return (
      <runtime.PropertyRow
        label={label}
        title={title}
        description={description}
        disabled={disabled2}
        onReset={onReset}
        onPress={(): Dynamic => onChange(!checked)}
      >
        <runtime.Switch
          checked={checked}
          onCheckedChange={(input?: Dynamic): Dynamic => onChange(input)}
          aria-label={label}
          disabled={disabled2}
        />
      </runtime.PropertyRow>
    );
  }
  function PropertyEnumRow({
    label: label,
    options: options,
    value: value,
    onChange: onChange,
    popupAttrs: popupAttrs,
    onReset: onReset,
    disabled: disabled2,
    title: title,
    description: description,
  }: Dynamic): Dynamic {
    let value2: Dynamic = options.length > PropertiesRowsLimit;
    return (
      <runtime.PropertyRow
        label={label}
        title={title}
        description={description}
        disabled={disabled2}
        onReset={onReset}
        onPress={
          value2
            ? (element?: Dynamic): Dynamic =>
                element.querySelector('[data-kit="PropertySelect"]')?.click()
            : undefined
        }
      >
        {value2 ? (
          <runtime.PropertySelect
            aria-label={label}
            items={options.map(
              (input?: Dynamic): Dynamic => ({
                value: input.value,
                label: input.label,
              }),
            )}
            value={value}
            onChange={onChange}
            disabled={disabled2}
            popupAttrs={popupAttrs}
          />
        ) : (
          <runtime.SegmentedControl
            aria-label={label}
            fullWidth={
              !options.every(
                (input?: Dynamic): Dynamic => input.icon !== undefined,
              )
            }
            segments={options.map((input?: Dynamic): Dynamic => {
              let state: Dynamic = {
                disabled: disabled2 || input.whyDisabled !== undefined,
                disabledReason: input.whyDisabled,
              };
              return input.icon !== undefined
                ? {
                    value: input.value,
                    icon: input.icon,
                    tooltip: input.title ?? input.label,
                    ...state,
                  }
                : {
                    value: input.value,
                    label: input.label,
                    tooltip: input.title,
                    ...state,
                  };
            })}
            value={value}
            onChange={disabled2 ? (): Dynamic => {} : onChange}
          />
        )}
      </runtime.PropertyRow>
    );
  }
  function PropertySelectRow({
    label: label,
    icon: icon,
    hint: hint,
    options: options,
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    popupAttrs: popupAttrs,
    searchable: searchable,
    searchLabel: searchLabel,
    onOpenChange: onOpenChange,
    trailing: trailing,
    onReset: onReset,
    disabled: disabled2,
    title: title,
    description: description,
  }: Dynamic): Dynamic {
    return (
      <runtime.PropertyRow
        label={label}
        title={title}
        description={description}
        disabled={disabled2}
        onReset={onReset}
        trailing={trailing}
        onPress={(element?: Dynamic): Dynamic =>
          element.querySelector('[data-kit="PropertySelect"]')?.click()
        }
      >
        <runtime.PropertySelect
          aria-label={label}
          icon={icon}
          hint={hint}
          items={options}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled2}
          popupAttrs={popupAttrs}
          searchable={searchable}
          searchLabel={searchLabel}
          onOpenChange={onOpenChange}
        />
      </runtime.PropertyRow>
    );
  }
  function ColorWellFace({
    hex: hex,
    alpha = 100,
    className: className,
  }: Dynamic): Dynamic {
    return (
      <span
        aria-hidden={"true"}
        className={(0, runtime.joinClassNames)(
          runtime.PropertiesPrimitivesClassNames_2,
          className,
        )}
      >
        {hex !== null ? (
          <runtime.jsxPropertiesColorPicker.Fragment>
            <span
              className={"absolute inset-y-0 left-0 w-1/2"}
              style={{
                backgroundColor: hex,
              }}
            />
            <span
              className={"absolute inset-y-0 right-0 w-1/2"}
              style={{
                backgroundColor: hex,
                opacity: Math.round(alpha * 100) / 1e4,
              }}
            />
          </runtime.jsxPropertiesColorPicker.Fragment>
        ) : null}
      </span>
    );
  }
  function useColorContrast(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic =
      input === undefined ? undefined : JSON.stringify(input);
    return (0, runtime.reactPropertiesSection.useMemo)(
      (): Dynamic =>
        input === undefined || options === undefined
          ? undefined
          : (0, runtime.evaluateColorContrast)(options, input),
      [value, options],
    );
  }
  function PropertyColorRow({
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
    closeLabel = runtime.CloseValue,
    popoverTitle: popoverTitle,
    allowNone: allowNone,
    onNone: onNone,
    isNone: isNone,
    noneDisabledReason: noneDisabledReason,
    disabled: disabled2,
    disabledReason: disabledReason,
    keepFocus = false,
    editsAreUndoSteps: editsAreUndoSteps,
    popover: popover,
    open: open,
    onOpenChange: onOpenChange,
    title: title,
    testid: testid,
  }: Dynamic): Dynamic {
    let [value2, value3]: Dynamic = (0,
      runtime.reactPropertiesSection.useState)(false),
      value4: Dynamic = open ?? value2,
      callback: Dynamic = (input?: Dynamic): Dynamic => {
        value3(input);
        onOpenChange?.(input);
      },
      [value5, value6]: Dynamic = (0, runtime.reactPropertiesSection.useState)(
        false,
      ),
      value7: Dynamic = (0, runtime.reactPropertiesSection.useRef)(false),
      value8: Dynamic = (0, runtime.reactPropertiesSection.useRef)(null),
      value9: Dynamic = popover?.anchor,
      value10: Dynamic =
        value9 === undefined
          ? undefined
          : (): Dynamic =>
              value8.current === null ? null : value9(value8.current),
      value11: Dynamic = (0,
      runtime.reactPropertiesSection.useMemo)((): Dynamic => {
        let value28: Dynamic = value ?? placeholder;
        if (value28 === undefined) return;
        let value29: Dynamic = (0, runtime.parseHsvaColor)(value28);
        return {
          solid: (0, runtime.hsvaToRgbHex)(value29),
          alpha: value29.a,
        };
      }, [value, placeholder]),
      value12: Dynamic =
        value !== undefined && PropertiesRowsRgbaPattern.test(value),
      value13: Dynamic = (0,
      runtime.reactPropertiesSection.useMemo)((): Dynamic => {
        if (!value12 || value11 === undefined) return;
        if (valueName !== undefined) return valueName ?? undefined;
        if (swatches === undefined) return;
        if (current !== undefined) {
          if (current === null) return;
          let value29: Dynamic = swatches.find(
            (input?: Dynamic): Dynamic =>
              typeof input != "string" &&
              (input.name === current ||
                ("picks" in input && input.picks === current)),
          );
          return value29 !== undefined &&
            typeof value29 != "string" &&
            value29.label !== undefined &&
            value29.label.trim() !== ""
            ? value29.label
            : undefined;
        }
        let value28: Dynamic = value11.solid.toLowerCase();
        for (let value29 of swatches as Dynamic) {
          let value30: Dynamic =
            typeof value29 == "string"
              ? value29
              : "value" in value29
                ? value29.value
                : value29.color;
          if (!PropertiesRowsRgbaPattern.test(value30)) continue;
          let value31: Dynamic = (0, runtime.parseHsvaColor)(value30);
          if (
            !(value31.a < 1) &&
            (0, runtime.hsvaToRgbHex)(value31).toLowerCase() === value28
          )
            return typeof value29 != "string" &&
              value29.label !== undefined &&
              value29.label.trim() !== ""
              ? value29.label
              : undefined;
        }
      }, [value12, value11, swatches, current, valueName]),
      value14: Dynamic =
        value !== undefined
          ? typeof valueName == "string"
            ? valueName
            : value12 && value11 !== undefined
              ? (value13 ?? value11.solid.toUpperCase())
              : value
          : (clearLabel ?? placeholder ?? "None"),
      value15: Dynamic =
        value12 && value11 !== undefined && value11.alpha < 1
          ? Math.round(value11.alpha * 100) + "%"
          : undefined,
      value16: Dynamic =
        mixed || chip !== undefined ? undefined : (value ?? placeholder),
      value17: Dynamic = useColorContrast(contrast, value16),
      value18: Dynamic = (0, runtime.reactPropertiesSection.useMemo)(
        (): Dynamic =>
          value17 === undefined
            ? undefined
            : (0, runtime.summarizeContrastResults)(value17).sentence,
        [value17],
      ),
      value19: Dynamic =
        description !== undefined && description !== ""
          ? value18 !== undefined
            ? description.replace(/\.?\s*$/, ". ") + value18
            : description
          : value18,
      value20: Dynamic = (0, runtime.reactPropertiesSection.useId)(),
      value21: Dynamic = swatches !== undefined && swatches.length > 0,
      value22: Dynamic =
        headerTabs === undefined ||
        headerTabs.value === (headerTabs.colorTab ?? "color"),
      [value23, value24]: Dynamic = (0,
      runtime.reactPropertiesSection.useState)("system"),
      [value25, value26]: Dynamic = (0,
      runtime.reactPropertiesSection.useState)(value4);
    value4 !== value25 &&
      (value26(value4),
      value4 &&
        (value24(value21 && value22 ? "system" : "custom"),
        value6(value7.current),
        (value7.current = false)));
    let value27: Dynamic = (
      <runtime.ColorPickerWithSwatches
        testid={testid !== undefined ? testid + "-menu" : undefined}
        title={popoverTitle ?? label}
        swatches={swatches}
        current={current}
        onSwatch={onSwatch}
        fold={fold}
        value={value ?? placeholder ?? "#000000"}
        unset={value === undefined || mixed || !value22 || unset}
        repick={unset && current != null}
        opaque={opaque}
        contrast={value16 !== undefined ? contrast : undefined}
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
                onPick: (): Dynamic => {
                  onNone ? onNone() : onChange(undefined);
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
        tab={value21 ? value23 : undefined}
        onTab={value24}
        heading={popoverTitle ?? label}
        headerEnd={
          value21 || headerTabs !== undefined || popoverTitle !== undefined ? (
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
              onClick={(): Dynamic => callback(false)}
              className={"relative shrink-0"}
            />
          ) : undefined
        }
      />
    );
    return (
      <span
        ref={value8}
        className={"relative flex min-w-0 flex-1"}
        title={disabled2 ? disabledReason : undefined}
      >
        <runtime.EditorPopover
          open={value4}
          onOpen={(): Dynamic => callback(true)}
          onClose={(): Dynamic => callback(false)}
          trigger={
            <runtime.PropertyPickerButton
              data-testid={testid}
              title={disabled2 ? (disabledReason ?? title) : title}
              aria-label={
                label +
                ": " +
                (mixed
                  ? runtime.MixedValue
                  : chip !== undefined
                    ? chip.text
                    : value !== undefined
                      ? value14 + (value15 !== undefined ? " " + value15 : "")
                      : clearLabel !== undefined &&
                          /[\p{L}\p{N}]/u.test(clearLabel)
                        ? clearLabel
                        : clearLabel !== undefined
                          ? "none"
                          : "unset")
              }
              aria-describedby={value19 !== undefined ? value20 : undefined}
              disabled={disabled2}
              onClick={(input?: Dynamic): Dynamic => {
                value4 || (value7.current = input.detail === 0);
              }}
              onMouseDown={keepFocus ? PropertiesRowsPreventDefault : undefined}
              muted={mixed}
              chip={
                mixed ? (
                  <runtime.PropertyColorWell data-kit={"swatch-mixed"}>
                    <span
                      className={"absolute inset-y-0 left-0 w-1/2"}
                      style={{
                        backgroundColor: "#ffffff",
                      }}
                    />
                    <span
                      className={"absolute inset-y-0 right-0 w-1/2"}
                      style={{
                        backgroundColor: "#141413",
                      }}
                    />
                  </runtime.PropertyColorWell>
                ) : chip !== undefined ? (
                  <runtime.PropertyColorWell
                    data-kit={"swatch-chip"}
                    background={chip.css}
                  />
                ) : (
                  <ColorWellFace
                    hex={value11?.solid ?? null}
                    alpha={(value11?.alpha ?? 1) * 100}
                  />
                )
              }
              caption={!mixed && chip === undefined ? value15 : undefined}
              trailing={
                contrastMark && value17 !== undefined ? (
                  <runtime.ContrastMark
                    results={value17}
                    sentence={false}
                    className={"ml-auto pl-1"}
                  />
                ) : undefined
              }
            >
              {mixed
                ? runtime.MixedValue
                : chip !== undefined
                  ? chip.text
                  : value14}
            </runtime.PropertyPickerButton>
          }
          align={"left"}
          side={popover?.side}
          positionAnchor={value10}
          padding={"none"}
          aria-label={popoverTitle ?? label}
          className={runtime.ColorPickerLabel}
          popupAttrs={popupAttrs}
          editsAreUndoSteps={editsAreUndoSteps}
          focusOnOpen={value5}
          keepFocus={keepFocus}
          planHeight={
            value21 || headerTabs !== undefined
              ? runtime.ColorPickerConstant
              : undefined
          }
        >
          {keepFocus ? (
            <div
              data-session-strip={""}
              onKeyDownCapture={runtime.preventInputEnterSubmit}
            >
              {value27}
            </div>
          ) : (
            value27
          )}
        </runtime.EditorPopover>
        {value19 !== undefined ? (
          <span id={value20} hidden={true} data-kit={"field-description"}>
            {value19}
          </span>
        ) : null}
      </span>
    );
  }
  function PropertyHexRow({
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
    disabled: disabled2,
    title: title,
    description: description,
    ...props
  }: Dynamic): Dynamic {
    let [value2, value3]: Dynamic = (0,
    runtime.reactPropertiesSection.useState)(false);
    return (
      <runtime.PropertyRow
        label={label}
        title={title}
        disabled={disabled2}
        onReset={
          onReset ??
          (clearLabel !== undefined && value !== undefined
            ? (): Dynamic => onChange(undefined)
            : undefined)
        }
        trailing={trailing}
        onPress={(): Dynamic => {
          disabled2 || value3(!value2);
        }}
        onPointerDown={(event?: Dynamic): Dynamic => {
          value2 &&
            !(0, runtime.isNestedPropertyControl)(
              event.currentTarget,
              event.target,
            ) &&
            event.stopPropagation();
        }}
      >
        <PropertyColorRow
          {...props}
          label={label}
          value={value}
          onChange={onChange}
          description={description}
          contrast={contrast}
          placeholder={placeholder}
          clearLabel={clearLabel}
          mixed={mixed}
          chip={chip}
          disabled={disabled2}
          open={value2}
          onOpenChange={value3}
        />
        {adornment}
      </runtime.PropertyRow>
    );
  }
  bindRuntimeValue(runtime, "PropertyPanelRoot", () => PropertyPanelRoot);
  bindRuntimeValue(runtime, "PropertyTextRow", () => PropertyTextRow);
  bindRuntimeValue(runtime, "PropertyNumberRow", () => PropertyNumberRow);
  bindRuntimeValue(runtime, "rangeFraction", () => rangeFraction);
  bindRuntimeValue(runtime, "rangeValue", () => rangeValue);
  bindRuntimeValue(runtime, "PropertyRangeRow", () => PropertyRangeRow);
  bindRuntimeValue(runtime, "PropertyBooleanRow", () => PropertyBooleanRow);
  bindRuntimeValue(
    runtime,
    "PropertiesRowsLimit",
    () => PropertiesRowsLimit,
    (value) => {
      PropertiesRowsLimit = value;
    },
  );
  bindRuntimeValue(runtime, "PropertyEnumRow", () => PropertyEnumRow);
  bindRuntimeValue(runtime, "PropertySelectRow", () => PropertySelectRow);
  bindRuntimeValue(
    runtime,
    "PropertiesRowsRgbaPattern",
    () => PropertiesRowsRgbaPattern,
    (value) => {
      PropertiesRowsRgbaPattern = value;
    },
  );
  bindRuntimeValue(runtime, "ColorWellFace", () => ColorWellFace);
  bindRuntimeValue(runtime, "useColorContrast", () => useColorContrast);
  bindRuntimeValue(runtime, "PropertyColorRow", () => PropertyColorRow);
  bindRuntimeValue(
    runtime,
    "PropertiesRowsPreventDefault",
    () => PropertiesRowsPreventDefault,
    (value) => {
      PropertiesRowsPreventDefault = value;
    },
  );
  bindRuntimeValue(runtime, "PropertyHexRow", () => PropertyHexRow);
  bindRuntimeValue(
    runtime,
    "jsxPropertiesRows",
    () => jsxPropertiesRows,
    (value) => {
      jsxPropertiesRows = value;
    },
  );
  return () => {
    PropertiesRowsLimit = 4;
    PropertiesRowsRgbaPattern =
      /^(?:#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\(\s*[\d.]+[\s,]+[\d.]+[\s,]+[\d.]+(?:[\s,/]+[\d.]+)?\s*\))$/i;
    PropertiesRowsPreventDefault = (event?: Dynamic): Dynamic =>
      event.preventDefault();
    jsxPropertiesRows = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
  };
}
