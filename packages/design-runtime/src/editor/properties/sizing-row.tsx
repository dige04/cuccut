/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorPropertiesSizingRow(
  runtime: RuntimeBindings,
): () => void {
  var PropertiesSizingRowHandler: Dynamic;
  var PropertiesSizingRowHandler_2: Dynamic;
  var JustifyStartValue: Dynamic;
  var JustifyCenterValue: Dynamic;
  var JustifyEndValue: Dynamic;
  var AlignStartValue: Dynamic;
  var AlignCenterValue: Dynamic;
  var AlignEndValue: Dynamic;
  var JustifySpaceBetweenValue: Dynamic;
  var PropertiesSizingRowFlexStartStartCenterConfig: Dynamic;
  var PropertiesSizingRowFlexStartStartCenterConfig_2: Dynamic;
  var PropertiesSizingRowTlTrBlConfig: Dynamic;
  var PropertiesSizingRowHandlerValue: Dynamic;
  var PropertiesSizingRowHandlerValue_2: Dynamic;
  var PropertiesSizingRowLeftHcenterRightConfig: Dynamic;
  var jsxPropertiesSizingRow: Dynamic;
  function PropertySizingRow({
    shell: shell,
    label: label,
    prop: prop,
    value: value,
    fallback: fallback,
    disabled: disabled2,
    mixed: mixed,
    noHug: noHug,
    fixedOnlyReason: fixedOnlyReason,
    onCommitMany: onCommitMany,
  }: Dynamic): Dynamic {
    let [value2, value3]: Dynamic = (0,
      runtime.reactPropertiesAssetPicker_3.useState)(value ?? ""),
      value4: Dynamic = (0, runtime.reactPropertiesAssetPicker_3.useRef)(false),
      value5: Dynamic = (0, runtime.reactPropertiesAssetPicker_3.useRef)(false),
      value6: Dynamic = (0, runtime.reactPropertiesAssetPicker_3.useRef)(false),
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        onCommitMany([
          {
            prop: prop,
            value: input,
          },
        ]),
      { start: value7, live: value8 }: Dynamic = (0, runtime.useLiveStyleScrub)(
        {
          value:
            (0, runtime.parseCssNumber)(value || fallback || "")?.value ?? 0,
          min: 0,
          disabled: disabled2,
          onScrub: (input?: Dynamic): Dynamic =>
            callback(`${Math.round(input)}px`),
        },
      ),
      value9: Dynamic = (0, runtime.parseCssNumber)(fallback || ""),
      value10: Dynamic = value9
        ? (0, runtime.formatCssNumber)(
            (0, runtime.roundCssNumber)(value9.value, value9.unit),
            value9.unit,
          )
        : fallback || "auto",
      value11: Dynamic = !mixed && !value && !!value9,
      value12: Dynamic = value11 ? value10 : (value ?? ""),
      value13: Dynamic = value8 != null ? `${Math.round(value8)}px` : value12;
    (!value4.current || !value5.current) &&
      value13 !== value2 &&
      value3(value13);
    let value14: Dynamic = value == null || value === "" || value === "auto",
      value15: Dynamic = !mixed && value14 && !noHug,
      value16: Dynamic = !mixed && value === "100%",
      callback2: Dynamic = (): Dynamic => {
        let value18: Dynamic = (0, runtime.parseCssNumber)(value || ""),
          value19: Dynamic =
            value18 && (value18.unit === "px" || value18.unit === "")
              ? value18
              : (0, runtime.parseCssNumber)(fallback || "");
        return value19 ? `${Math.round(value19.value)}px` : null;
      },
      value17: Dynamic = mixed
        ? null
        : value16
          ? "fill"
          : value15
            ? "hug"
            : "fixed";
    return (
      <runtime.PropertyRow
        label={label}
        {...shell}
        labelProps={
          disabled2
            ? undefined
            : {
                onPointerDown: value7,
                className: "cursor-ew-resize touch-none",
              }
        }
      >
        <runtime.TextInput
          value={value2}
          placeholder={mixed ? "Mixed" : value10}
          aria-label={label}
          title={
            !mixed && fallback && value10 !== fallback
              ? `Rendered size: ${fallback}`
              : undefined
          }
          disabled={disabled2}
          className={(0, runtime.cn)(
            !mixed && !value11 && "placeholder:text-primary",
          )}
          onFocus={(input?: Dynamic): Dynamic => {
            value4.current = true;
            value5.current = false;
            input.currentTarget.select();
          }}
          onChange={(event?: Dynamic): Dynamic => {
            value5.current = true;
            value3(event.target.value);
          }}
          onBlur={(): Dynamic => {
            value4.current = false;
            let current: Dynamic = value5.current;
            value5.current = false;
            if (value6.current) {
              value6.current = false;
              value3(value12);
              return;
            }
            let value18: Dynamic = value2.trim();
            current &&
            value18 !== (value ?? "") &&
            !(value11 && value18 === value12)
              ? callback(
                  value18
                    ? (0, runtime.normalizePropertyNumber)(prop, value18)
                    : null,
                )
              : value3(value12);
          }}
          onKeyDown={(event?: Dynamic): Dynamic => {
            if (event.key === "Enter" || event.key === "Escape") {
              event.key === "Escape" &&
                ((value6.current = true), value3(value12));
              event.target.blur();
              return;
            }
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              if (
                event.metaKey ||
                event.ctrlKey ||
                event.nativeEvent.isComposing ||
                mixed
              )
                return;
              let value18: Dynamic =
                  value11 && !value5.current ? "" : value2.trim(),
                value19: Dynamic = (0, runtime.parseCssNumber)(value18);
              if (value18 && !value19) return;
              let value20: Dynamic = (0, runtime.parseCssNumber)(
                  value || fallback || "",
                ),
                value21: Dynamic =
                  value19?.value ?? (value20 ? Math.round(value20.value) : 0),
                value22: Dynamic = value19?.unit || value20?.unit || "px";
              event.preventDefault();
              let value23: Dynamic =
                  (0, runtime.getFineUnitStep)(value22, undefined) != null
                    ? 0.1
                    : 1,
                value24: Dynamic = (0, runtime.stepCssNumber)(
                  value21,
                  event.key === "ArrowUp" ? 1 : -1,
                  event,
                  {
                    step: value23,
                    unit: value22,
                    min: 0,
                  },
                ),
                value25: Dynamic = (0, runtime.formatCssNumber)(
                  value24,
                  value22,
                );
              value3(value25);
              value25 !== (value ?? "") &&
                callback((0, runtime.normalizePropertyNumber)(prop, value25));
              let target: Dynamic = event.target;
              requestAnimationFrame((): Dynamic => target.select());
            }
          }}
        />
        <runtime.PropertySelect
          compact={true}
          aria-label={`${label} mode`}
          data-testid={`dc-size-mode-${prop}`}
          items={
            fixedOnlyReason !== undefined
              ? [
                  {
                    value: "fixed",
                    label: "Fixed",
                  },
                ]
              : [
                  ...(noHug
                    ? []
                    : [
                        {
                          value: "hug",
                          label: "Hug",
                        },
                      ]),
                  {
                    value: "fixed",
                    label: "Fixed",
                  },
                  {
                    value: "fill",
                    label: "Fill",
                  },
                ]
          }
          value={fixedOnlyReason !== undefined ? "fixed" : value17}
          placeholder={"Mixed"}
          disabled={disabled2 || fixedOnlyReason !== undefined}
          title={fixedOnlyReason}
          onChange={(input?: Dynamic): Dynamic => {
            if (input === "hug") callback(null);
            else if (input === "fill") callback("100%");
            else {
              let value18: Dynamic = callback2();
              value18 != null && callback(value18);
            }
          }}
        />
      </runtime.PropertyRow>
    );
  }
  bindRuntimeValue(runtime, "PropertySizingRow", () => PropertySizingRow);
  bindRuntimeValue(
    runtime,
    "PropertiesSizingRowHandler",
    () => PropertiesSizingRowHandler,
    (value) => {
      PropertiesSizingRowHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesSizingRowHandler_2",
    () => PropertiesSizingRowHandler_2,
    (value) => {
      PropertiesSizingRowHandler_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "JustifyStartValue",
    () => JustifyStartValue,
    (value) => {
      JustifyStartValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "JustifyCenterValue",
    () => JustifyCenterValue,
    (value) => {
      JustifyCenterValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "JustifyEndValue",
    () => JustifyEndValue,
    (value) => {
      JustifyEndValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "AlignStartValue",
    () => AlignStartValue,
    (value) => {
      AlignStartValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "AlignCenterValue",
    () => AlignCenterValue,
    (value) => {
      AlignCenterValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "AlignEndValue",
    () => AlignEndValue,
    (value) => {
      AlignEndValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "JustifySpaceBetweenValue",
    () => JustifySpaceBetweenValue,
    (value) => {
      JustifySpaceBetweenValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesSizingRowFlexStartStartCenterConfig",
    () => PropertiesSizingRowFlexStartStartCenterConfig,
    (value) => {
      PropertiesSizingRowFlexStartStartCenterConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesSizingRowFlexStartStartCenterConfig_2",
    () => PropertiesSizingRowFlexStartStartCenterConfig_2,
    (value) => {
      PropertiesSizingRowFlexStartStartCenterConfig_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesSizingRowTlTrBlConfig",
    () => PropertiesSizingRowTlTrBlConfig,
    (value) => {
      PropertiesSizingRowTlTrBlConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesSizingRowHandlerValue",
    () => PropertiesSizingRowHandlerValue,
    (value) => {
      PropertiesSizingRowHandlerValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesSizingRowHandlerValue_2",
    () => PropertiesSizingRowHandlerValue_2,
    (value) => {
      PropertiesSizingRowHandlerValue_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesSizingRowLeftHcenterRightConfig",
    () => PropertiesSizingRowLeftHcenterRightConfig,
    (value) => {
      PropertiesSizingRowLeftHcenterRightConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxPropertiesSizingRow",
    () => jsxPropertiesSizingRow,
    (value) => {
      jsxPropertiesSizingRow = value;
    },
  );
  return () => {
    (0, runtime.initializeCdsIndex)();
    PropertiesSizingRowHandler = (
      input?: Dynamic,
      options: Dynamic = 1,
    ): Dynamic => ({
      d: input,
      strokeWidth: options,
    });
    PropertiesSizingRowHandler_2 = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic => ({
      name: input,
      viewBox: 16,
      paths: [PropertiesSizingRowHandler(options)],
    });
    JustifyStartValue = "JustifyStart";
    JustifyCenterValue = "JustifyCenter";
    JustifyEndValue = "JustifyEnd";
    AlignStartValue = "AlignStart";
    AlignCenterValue = "AlignCenter";
    AlignEndValue = "AlignEnd";
    JustifySpaceBetweenValue = "JustifySpaceBetween";
    PropertiesSizingRowFlexStartStartCenterConfig = {
      "flex-start": JustifyStartValue,
      start: JustifyStartValue,
      center: JustifyCenterValue,
      "flex-end": JustifyEndValue,
      end: JustifyEndValue,
      "space-between": JustifySpaceBetweenValue,
      "space-around": PropertiesSizingRowHandler_2(
        "JustifyAround",
        "M2.5 2.5V13.5M13.5 2.5V13.5M6 5V11M10 5V11",
      ),
      "space-evenly": PropertiesSizingRowHandler_2(
        "JustifyEvenly",
        "M2.5 2.5V13.5M13.5 2.5V13.5M6.25 5V11M9.75 5V11M8 7V9",
      ),
      stretch: PropertiesSizingRowHandler_2(
        "JustifyStretch",
        "M2.5 2.5V13.5M13.5 2.5V13.5M4.5 6H11.5M4.5 10H11.5",
      ),
    };
    PropertiesSizingRowFlexStartStartCenterConfig_2 = {
      "flex-start": AlignStartValue,
      start: AlignStartValue,
      center: AlignCenterValue,
      "flex-end": AlignEndValue,
      end: AlignEndValue,
      stretch: "AlignStretch",
      baseline: PropertiesSizingRowHandler_2(
        "AlignItemsBaseline",
        "M2.5 10.5H13.5M5 10.5V5L6.5 5M9.5 10.5V7H11.5V10.5",
      ),
      auto: PropertiesSizingRowHandler_2(
        "AlignAuto",
        "M4 4H6M10 4H12M4 12H6M10 12H12M4 4V6M12 4V6M4 10V12M12 10V12",
      ),
    };
    PropertiesSizingRowTlTrBlConfig = {
      tl: PropertiesSizingRowHandler_2(
        "ConnectorDownRight",
        "M4 4L12 12M12 6.5V12H6.5",
      ),
      tr: PropertiesSizingRowHandler_2(
        "ConnectorDownLeft",
        "M12 4L4 12M4 6.5V12H9.5",
      ),
      bl: PropertiesSizingRowHandler_2(
        "ConnectorUpRight",
        "M4 12L12 4M6.5 4H12V9.5",
      ),
      br: PropertiesSizingRowHandler_2(
        "ConnectorUpLeft",
        "M12 12L4 4M9.5 4H4V9.5",
      ),
    };
    PropertiesSizingRowHandlerValue = PropertiesSizingRowHandler_2(
      "LayoutStack",
      "M2.5 3.5H13.5V12.5H2.5Z M5 6V10M8 6V10M11 6V10",
    );
    PropertiesSizingRowHandlerValue_2 = PropertiesSizingRowHandler_2(
      "LayoutLayered",
      "M3 5H11V11H3Z M5 3H13V9",
    );
    PropertiesSizingRowLeftHcenterRightConfig = {
      left: PropertiesSizingRowHandler_2(
        "ActionAlignLeft",
        "M3.93 3.4V12.58M6.59 10.99H12.17M6.59 7.99H9.48M6.59 4.99H12.17",
      ),
      hcenter: PropertiesSizingRowHandler_2(
        "ActionAlignHCenter",
        "M5.21 10.99H10.79M6.56 7.99H9.44M5.21 4.99H10.79",
      ),
      right: PropertiesSizingRowHandler_2(
        "ActionAlignRight",
        "M12.07 3.4V12.58M3.83 10.99H9.41M6.52 7.99H9.41M3.83 4.99H9.41",
      ),
      top: PropertiesSizingRowHandler_2(
        "ActionAlignTop",
        "M5 6.58V12.16M11 6.58V12.16M8 6.58V9.47M3.41 3.93H12.59",
      ),
      vcenter: PropertiesSizingRowHandler_2(
        "ActionAlignVCenter",
        "M10.99 5.21V10.79M7.99 6.56V9.44M4.99 5.21V10.79",
      ),
      bottom: PropertiesSizingRowHandler_2(
        "ActionAlignBottom",
        "M3.42 12.07H12.6M5.01 3.83V9.41M8.01 6.52V9.41M11.01 3.83V9.41",
      ),
    };
    jsxPropertiesSizingRow = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
  };
}
