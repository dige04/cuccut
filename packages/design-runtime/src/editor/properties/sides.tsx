/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorPropertiesSides(
  runtime: RuntimeBindings,
): () => void {
  var PropertiesSidesSideTopSideRightSideBottomValues: Dynamic;
  var PropertiesSidesCornerTopLeftCornerTopRightCornerBottomRightValues: Dynamic;
  var reactPropertiesSides: Dynamic;
  var jsxPropertiesSides: Dynamic;
  var PropertiesSidesNwNeSeValues: Dynamic;
  var PropertiesSidesNESValues: Dynamic;
  var PropertiesSidesNESConfig: Dynamic;
  var PropertiesSidesNwNeSeConfig: Dynamic;
  var PropertiesSidesNSEConfig: Dynamic;
  var PropertiesSidesConstant: Dynamic;
  var RESIZE_HANDLE_HIT_SIZE_PX: Dynamic;
  var RESIZE_HANDLE_LENGTH_PX: Dynamic;
  var RESIZE_HANDLE_THICKNESS_PX: Dynamic;
  var RESIZE_EDGE_MIN_LENGTH_PX: Dynamic;
  var PropertiesSidesConstant_2: Dynamic;
  var PropertiesSidesConstant_3: Dynamic;
  var PropertiesSidesArrowLeftArrowRightArrowUpConfig: Dynamic;
  function PropertySidesRow({
    label: label,
    kind = "side",
    values: values,
    placeholders: placeholders,
    unit = "px",
    min: min2,
    max: max,
    step: step,
    smallStep: smallStep,
    mixed: mixed,
    disabled: disabled2,
    toggleDisabledReason: toggleDisabledReason,
    onSides: onSides,
    onScrubSides: onScrubSides,
    onScrubEnd: onScrubEnd,
    onReset: onReset,
    title: title,
    description: description,
    icon: icon,
    expandLabel: expandLabel,
    partLabels: partLabels,
    "data-testid": dataTestid,
  }: Dynamic): Dynamic {
    let value: Dynamic =
        expandLabel ??
        (kind === "corner"
          ? runtime.ColorContrastCopyLabel_7
          : runtime.ColorContrastCopyLabel_6),
      value2: Dynamic =
        partLabels ??
        (kind === "corner"
          ? runtime.ColorContrastCopyItems
          : runtime.ColorContrastCopyTopRightBottomValues),
      value3: Dynamic =
        icon ??
        (kind === "corner"
          ? runtime.PropertiesTooltipNameViewBoxPathsConfig_4
          : runtime.PropertiesTooltipNameViewBoxPathsConfig_2),
      value4: Dynamic = values.map(
        (input?: Dynamic, options?: Dynamic): Dynamic =>
          input !== undefined ? String(input) : (placeholders?.[options] ?? ""),
      ),
      value5: Dynamic =
        values.some((input?: Dynamic): Dynamic => input !== undefined) &&
        values.every(
          (input?: Dynamic): Dynamic =>
            input !== undefined && input === values[0],
        ),
      value6: Dynamic = value4.every(
        (input?: Dynamic): Dynamic => input === value4[0],
      ),
      value7: Dynamic = !mixed && !value6 && !value5,
      [value8, value9]: Dynamic = (0, runtime.reactPropertiesSegments.useState)(
        value7,
      );
    value7 && !value8 && value9(true);
    let value10: Dynamic = mixed || !value5 ? undefined : values[0],
      value11: Dynamic = mixed || value7 ? undefined : value4[0],
      callback: Dynamic = (input?: Dynamic): Dynamic => {
        if (mixed) return null;
        let value16: Dynamic =
          input === undefined || input.trim() === "" ? NaN : Number(input);
        return Number.isFinite(value16) ? value16 : undefined;
      },
      value12: Dynamic = label.toLowerCase(),
      value13: Dynamic = (0, runtime.reactPropertiesSegments.useRef)([]),
      value14: Dynamic =
        onScrubSides &&
        ((input?: Dynamic): Dynamic => {
          value13.current = input;
          onScrubSides(input);
        }),
      callback2: Dynamic = (): Dynamic => {
        let current: Dynamic = value13.current;
        value13.current = [];
        onScrubEnd?.(current);
      },
      value15: Dynamic = (
        <runtime.DisabledReasonTooltip
          reason={
            toggleDisabledReason ??
            (!disabled2 && value7 && value8
              ? runtime.ColorContrastCopyLabel_8
              : undefined)
          }
          wrapperClassName={"shrink-0"}
        >
          <runtime.Button
            variant={"ghost"}
            iconOnly={true}
            icon={<runtime.PropertyOptionIcon icon={value3} />}
            aria-label={
              (value8 ? runtime.HideValue : runtime.EditValue) +
              " " +
              value12 +
              " " +
              value.toLowerCase()
            }
            pressed={value8}
            disabled={
              disabled2 ||
              (value7 && value8) ||
              toggleDisabledReason !== undefined
            }
            data-testid={dataTestid ? dataTestid + "-toggle" : undefined}
            onClick={(): Dynamic =>
              value9((input?: Dynamic): Dynamic => !input)
            }
            className={"shrink-0"}
          />
        </runtime.DisabledReasonTooltip>
      );
    return (
      <runtime.jsxPropertiesSegments.Fragment>
        <runtime.PropertyRow
          label={label}
          title={title}
          description={description}
          onReset={onReset}
          disabled={disabled2}
          data-testid={dataTestid}
          onPress={(element?: Dynamic): Dynamic =>
            element.querySelector("input")?.focus()
          }
          trailing={value15}
        >
          <runtime.NumericInput
            aria-label={label}
            value={value10}
            placeholder={value11}
            hint={value7 ? value : undefined}
            unit={unit}
            min={min2}
            max={max}
            step={step}
            smallStep={smallStep}
            mixed={mixed}
            clearable={true}
            refuseLetters={true}
            disabled={disabled2}
            emptyStepFrom={value7 ? null : callback(value4[0])}
            onValue={(input?: Dynamic): Dynamic =>
              onSides(
                runtime.PropertiesSegmentsItems.map(
                  (input2?: Dynamic): Dynamic => ({
                    side: input2,
                    value: input,
                  }),
                ),
              )
            }
            onScrub={
              value14 &&
              ((input?: Dynamic): Dynamic =>
                value14(
                  runtime.PropertiesSegmentsItems.map(
                    (input2?: Dynamic): Dynamic => ({
                      side: input2,
                      value: input,
                    }),
                  ),
                ))
            }
            onScrubEnd={callback2}
          />
        </runtime.PropertyRow>
        {value8 ? (
          <runtime.PropertyRow
            label={""}
            title={title}
            disabled={disabled2}
            data-testid={dataTestid ? dataTestid + "-parts" : undefined}
          >
            <div className={"grid min-w-0 flex-1 grid-cols-2 gap-2"}>
              {runtime.PropertiesSegmentsSideCornerConfig[kind].map(
                (input?: Dynamic): Dynamic => (
                  <runtime.NumericInput
                    key={input}
                    aria-label={label + " " + value2[input].toLowerCase()}
                    title={value2[input]}
                    prefix={<PropertySideGlyph kind={kind} index={input} />}
                    value={mixed ? undefined : values[input]}
                    placeholder={
                      mixed ? undefined : (placeholders?.[input] ?? "")
                    }
                    emptyStepFrom={callback(placeholders?.[input])}
                    mixed={mixed}
                    min={min2}
                    max={max}
                    step={step}
                    smallStep={smallStep}
                    clearable={true}
                    refuseLetters={true}
                    ownUnit={unit}
                    steppers={false}
                    disabled={disabled2}
                    onValue={(input2?: Dynamic): Dynamic =>
                      onSides([
                        {
                          side: input,
                          value: input2,
                        },
                      ])
                    }
                    onScrub={
                      value14 &&
                      ((input2?: Dynamic): Dynamic =>
                        value14([
                          {
                            side: input,
                            value: input2,
                          },
                        ]))
                    }
                    onScrubEnd={callback2}
                  />
                ),
              )}
            </div>
          </runtime.PropertyRow>
        ) : null}
      </runtime.jsxPropertiesSegments.Fragment>
    );
  }
  function PropertyCornersRow(input?: Dynamic): Dynamic {
    return <PropertySidesRow {...input} kind={"corner"} />;
  }
  function PropertySideGlyph({ kind: kind, index: index }: Dynamic): Dynamic {
    return (
      <runtime.EditorIcon
        name={
          (kind === "corner"
            ? PropertiesSidesCornerTopLeftCornerTopRightCornerBottomRightValues
            : PropertiesSidesSideTopSideRightSideBottomValues)[index]
        }
        size={16}
      />
    );
  }
  bindRuntimeValue(runtime, "PropertySidesRow", () => PropertySidesRow);
  bindRuntimeValue(runtime, "PropertyCornersRow", () => PropertyCornersRow);
  bindRuntimeValue(
    runtime,
    "PropertiesSidesSideTopSideRightSideBottomValues",
    () => PropertiesSidesSideTopSideRightSideBottomValues,
    (value) => {
      PropertiesSidesSideTopSideRightSideBottomValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesSidesCornerTopLeftCornerTopRightCornerBottomRightValues",
    () => PropertiesSidesCornerTopLeftCornerTopRightCornerBottomRightValues,
    (value) => {
      PropertiesSidesCornerTopLeftCornerTopRightCornerBottomRightValues = value;
    },
  );
  bindRuntimeValue(runtime, "PropertySideGlyph", () => PropertySideGlyph);
  bindRuntimeValue(
    runtime,
    "reactPropertiesSides",
    () => reactPropertiesSides,
    (value) => {
      reactPropertiesSides = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxPropertiesSides",
    () => jsxPropertiesSides,
    (value) => {
      jsxPropertiesSides = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesSidesNwNeSeValues",
    () => PropertiesSidesNwNeSeValues,
    (value) => {
      PropertiesSidesNwNeSeValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesSidesNESValues",
    () => PropertiesSidesNESValues,
    (value) => {
      PropertiesSidesNESValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesSidesNESConfig",
    () => PropertiesSidesNESConfig,
    (value) => {
      PropertiesSidesNESConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesSidesNwNeSeConfig",
    () => PropertiesSidesNwNeSeConfig,
    (value) => {
      PropertiesSidesNwNeSeConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesSidesNSEConfig",
    () => PropertiesSidesNSEConfig,
    (value) => {
      PropertiesSidesNSEConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesSidesConstant",
    () => PropertiesSidesConstant,
    (value) => {
      PropertiesSidesConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RESIZE_HANDLE_HIT_SIZE_PX",
    () => RESIZE_HANDLE_HIT_SIZE_PX,
    (value) => {
      RESIZE_HANDLE_HIT_SIZE_PX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RESIZE_HANDLE_LENGTH_PX",
    () => RESIZE_HANDLE_LENGTH_PX,
    (value) => {
      RESIZE_HANDLE_LENGTH_PX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RESIZE_HANDLE_THICKNESS_PX",
    () => RESIZE_HANDLE_THICKNESS_PX,
    (value) => {
      RESIZE_HANDLE_THICKNESS_PX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RESIZE_EDGE_MIN_LENGTH_PX",
    () => RESIZE_EDGE_MIN_LENGTH_PX,
    (value) => {
      RESIZE_EDGE_MIN_LENGTH_PX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesSidesConstant_2",
    () => PropertiesSidesConstant_2,
    (value) => {
      PropertiesSidesConstant_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesSidesConstant_3",
    () => PropertiesSidesConstant_3,
    (value) => {
      PropertiesSidesConstant_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesSidesArrowLeftArrowRightArrowUpConfig",
    () => PropertiesSidesArrowLeftArrowRightArrowUpConfig,
    (value) => {
      PropertiesSidesArrowLeftArrowRightArrowUpConfig = value;
    },
  );
  return () => {
    PropertiesSidesSideTopSideRightSideBottomValues = [
      "SideTop",
      "SideRight",
      "SideBottom",
      "SideLeft",
    ];
    PropertiesSidesCornerTopLeftCornerTopRightCornerBottomRightValues = [
      "CornerTopLeft",
      "CornerTopRight",
      "CornerBottomRight",
      "CornerBottomLeft",
    ];
    reactPropertiesSides = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    jsxPropertiesSides = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    PropertiesSidesNwNeSeValues = ["nw", "ne", "se", "sw"];
    PropertiesSidesNESValues = ["n", "e", "s", "w", "nw", "ne", "se", "sw"];
    PropertiesSidesNESConfig = {
      n: "top edge",
      e: "right edge",
      s: "bottom edge",
      w: "left edge",
      nw: "top left",
      ne: "top right",
      se: "bottom right",
      sw: "bottom left",
    };
    PropertiesSidesNwNeSeConfig = {
      nw: "top left",
      ne: "top right",
      se: "bottom right",
      sw: "bottom left",
    };
    PropertiesSidesNSEConfig = {
      n: "ns-resize",
      s: "ns-resize",
      e: "ew-resize",
      w: "ew-resize",
      nw: "nwse-resize",
      se: "nwse-resize",
      ne: "nesw-resize",
      sw: "nesw-resize",
    };
    PropertiesSidesConstant = 0.005;
    [
      RESIZE_HANDLE_HIT_SIZE_PX,
      RESIZE_HANDLE_LENGTH_PX,
      RESIZE_HANDLE_THICKNESS_PX,
      RESIZE_EDGE_MIN_LENGTH_PX,
    ] = [16, 12, 3, 44];
    PropertiesSidesConstant_2 = 0.35;
    PropertiesSidesConstant_3 = 1.1;
    PropertiesSidesArrowLeftArrowRightArrowUpConfig = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
  };
}
