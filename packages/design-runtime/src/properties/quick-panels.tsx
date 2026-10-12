/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installPropertiesQuickPanels(
  runtime: RuntimeBindings,
): () => void {
  var react_mB: Dynamic;
  var jsx_os: Dynamic;
  var borderSideMenuOrder: Dynamic;
  var borderSides: Dynamic;
  var borderSideLabels: Dynamic;
  var borderSideInitials: Dynamic;
  var borderStyleOptions: Dynamic;
  var borderStyleLabels: Dynamic;
  var borderStyleGlyphs: Dynamic;
  var quickPanelBodyClass: Dynamic;
  var quickPanelPopoverOptions: Dynamic;
  var quickPanelHintClass: Dynamic;
  var radiusCorners: Dynamic;
  var radiusCornerLabels: Dynamic;
  function preserveQuickPanelInputFocus(event?: Dynamic): Dynamic {
    event.target.closest(runtime.editableElementSelector) ||
      event.preventDefault();
  }
  function QuickPanelIconButton({
    icon: icon,
    label: label,
    pressed: pressed,
    disabledReason: disabledReason,
    hint: hint,
    onClick: onClick,
  }: Dynamic): Dynamic {
    return (
      <runtime.SessionStripButton
        icon={<runtime.PropertyOptionIcon icon={icon} />}
        aria-label={label}
        aria-pressed={pressed}
        title={disabledReason ?? hint}
        disabled={disabledReason !== undefined}
        onClick={onClick}
      />
    );
  }
  function BorderQuickPanel({
    style: style,
    width: width,
    sides: sides,
    color: color,
    onChange: onChange,
    onLive: onLive,
    onLiveEnd: onLiveEnd,
    supports: supports,
    widths: widths,
  }: Dynamic): Dynamic {
    let value: Dynamic =
        widths !== undefined
          ? borderSides
              .map((input?: Dynamic): Dynamic => widths.value[input] ?? 0)
              .filter((input?: Dynamic): Dynamic => input > 0)
          : [],
      value2: Dynamic = new Set(value).size > 1,
      [value3, value4]: Dynamic = (0, react_mB.useState)(
        sides !== undefined || value2,
      ),
      value5: Dynamic = (style ?? "none") === "none",
      value6: Dynamic = sides ?? borderSides,
      value7: Dynamic =
        supports.sides === true && (value3 || sides !== undefined || value2),
      callback: Dynamic = (input?: Dynamic): Dynamic => {
        let value8: Dynamic = borderSides.filter(
          (input2?: Dynamic): Dynamic =>
            input2 === input
              ? !value6.includes(input)
              : value6.includes(input2),
        );
        onChange({
          sides: value8.length === borderSides.length ? undefined : value8,
        });
      },
      callback2: Dynamic = (): Dynamic => (
        <QuickPanelIconButton
          icon={runtime.PropertiesTooltipNameViewBoxPathsConfig_2}
          label={"Individual borders"}
          pressed={value7}
          hint={
            widths !== undefined
              ? "Set each side\u2019s width"
              : "Choose which sides draw"
          }
          disabledReason={
            supports.sides === true
              ? value5
                ? "Pick a border style first"
                : undefined
              : supports.sides
          }
          onClick={(): Dynamic => {
            value7
              ? (value4(false),
                (sides !== undefined || value2) &&
                  onChange({
                    sides: undefined,
                  }))
              : value4(true);
          }}
        />
      );
    return (
      <div
        className={quickPanelBodyClass}
        onMouseDown={preserveQuickPanelInputFocus}
        data-quick-panel={"border"}
      >
        <runtime.SegmentedControl
          aria-label={"Border style"}
          fullWidth={true}
          value={style ?? "none"}
          onChange={(input?: Dynamic): Dynamic =>
            onChange({
              style: input,
            })
          }
          segments={borderStyleOptions.map(
            (input?: Dynamic): Dynamic => ({
              value: input,
              ...(input === "none"
                ? {
                    icon: "Prohibit",
                  }
                : {
                    label: (
                      <jsx_os.Fragment>
                        <runtime.PropertyOptionIcon
                          icon={borderStyleGlyphs[input]}
                        />
                        <span className={"sr-only"}>
                          {borderStyleLabels[input]}
                        </span>
                      </jsx_os.Fragment>
                    ),
                  }),
              tooltip: borderStyleLabels[input],
              disabled: !supports.styles.includes(input),
              disabledReason: supports.styleReason,
            }),
          )}
        />
        <fieldset
          disabled={value5}
          className={(0, runtime.joinClassNames)(
            "m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0",
            value5 && "opacity-60",
          )}
        >
          <div className={"min-w-0"}>{color}</div>
          <div
            className={"grid grid-cols-[1fr_1fr_auto] items-center gap-1.5"}
            role={"group"}
            aria-label={
              value7 && widths !== undefined ? "Side widths" : undefined
            }
          >
            {value7 && widths !== undefined ? (
              borderSideMenuOrder.map(
                (input?: Dynamic, options?: Dynamic): Dynamic =>
                  input === null ? (
                    options === 2 ? (
                      <react_mB.Fragment key={"toggle"}>
                        {callback2()}
                      </react_mB.Fragment>
                    ) : (
                      <span key={"gap"} />
                    )
                  ) : (
                    <runtime.NumericInput
                      key={input}
                      prefix={borderSideInitials[input]}
                      aria-label={borderSideLabels[input] + " border width"}
                      title={
                        borderSideLabels[input] + " border width (px; 0 = none)"
                      }
                      value={widths.value[input]}
                      min={0}
                      max={supports.widthMax}
                      step={1}
                      disabled={value5}
                      onValue={(input2?: Dynamic): Dynamic =>
                        widths.onChange({
                          [input]: input2 ?? 0,
                        })
                      }
                      onScrub={
                        widths.onLive
                          ? (input2?: Dynamic): Dynamic =>
                              widths.onLive({
                                [input]: input2,
                              })
                          : undefined
                      }
                      onScrubEnd={widths.onLiveEnd}
                    />
                  ),
              )
            ) : (
              <jsx_os.Fragment>
                <div className={"col-span-2 min-w-0"}>
                  <runtime.NumericInput
                    prefix={
                      <runtime.PropertyOptionIcon
                        icon={runtime.PropertiesTooltipNameViewBoxPathsConfig}
                      />
                    }
                    aria-label={"Border weight"}
                    unit={"px"}
                    title={"Border weight"}
                    value={value2 ? undefined : width}
                    min={1}
                    max={supports.widthMax}
                    step={1}
                    clearable={!value2}
                    placeholder={value2 ? "Mixed" : "0"}
                    disabled={value5}
                    onValue={(input?: Dynamic): Dynamic => {
                      (input !== undefined || !value2) &&
                        onChange({
                          width: input,
                        });
                    }}
                    onScrub={
                      onLive
                        ? (input?: Dynamic): Dynamic =>
                            onLive({
                              width: input,
                            })
                        : undefined
                    }
                    onScrubEnd={onLiveEnd}
                  />
                </div>
                {callback2()}
              </jsx_os.Fragment>
            )}
          </div>
          {value7 && widths === undefined && (
            <div
              className={
                "grid grid-cols-4 gap-0.5 rounded-md bg-fill-field p-0.5"
              }
              role={"group"}
              aria-label={"Sides"}
            >
              {borderSides.map((input?: Dynamic): Dynamic => {
                let value8: Dynamic = value6.includes(input),
                  value9: Dynamic = value8 && value6.length === 1;
                return (
                  <runtime.SessionStripButton
                    key={input}
                    aria-label={borderSideLabels[input] + " border"}
                    aria-pressed={value8}
                    className={"justify-center"}
                    disabled={value5 || value9}
                    title={
                      value9
                        ? "Set the style to None to remove the border"
                        : borderSideLabels[input] + " border"
                    }
                    onClick={(): Dynamic => callback(input)}
                  >
                    {borderSideInitials[input]}
                  </runtime.SessionStripButton>
                );
              })}
            </div>
          )}
        </fieldset>
      </div>
    );
  }
  function RadiusCornerInput(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    return (
      <runtime.NumericInput
        prefix={options.toUpperCase()}
        aria-label={radiusCornerLabels[options] + " radius"}
        title={radiusCornerLabels[options] + " radius"}
        value={input.value[options]}
        min={0}
        max={context}
        step={1}
        clearable={true}
        placeholder={String(value ?? 0)}
        onValue={(input2?: Dynamic): Dynamic =>
          input.onChange({
            [options]: input2,
          })
        }
        onScrub={
          input.onLive
            ? (input2?: Dynamic): Dynamic =>
                input.onLive?.({
                  [options]: input2,
                })
            : undefined
        }
        onScrubEnd={input.onLiveEnd}
      />
    );
  }
  function RadiusQuickPanel({
    radius: radius,
    max: max,
    onChange: onChange,
    onLive: onLive,
    onLiveEnd: onLiveEnd,
    individualReason: individualReason,
    corners: corners,
  }: Dynamic): Dynamic {
    let value: Dynamic =
        corners !== undefined &&
        new Set(
          radiusCorners.map((input?: Dynamic): Dynamic => corners.value[input]),
        ).size > 1,
      [value2, value3]: Dynamic = (0, react_mB.useState)(value),
      value4: Dynamic = corners !== undefined && value2,
      value5: Dynamic = (
        <QuickPanelIconButton
          icon={runtime.PropertiesTooltipNameViewBoxPathsConfig_4}
          label={"Individual corners"}
          pressed={value4}
          hint={"Set each corner"}
          disabledReason={
            corners === undefined
              ? (individualReason ?? "One radius for every corner")
              : undefined
          }
          onClick={(): Dynamic => {
            value4 &&
              value &&
              corners !== undefined &&
              onChange(
                Math.max(
                  ...radiusCorners.map(
                    (input?: Dynamic): Dynamic => corners.value[input] ?? 0,
                  ),
                ),
              );
            value3(!value4);
          }}
        />
      );
    return (
      <div
        className={quickPanelBodyClass}
        onMouseDown={preserveQuickPanelInputFocus}
        data-quick-panel={"corner"}
      >
        {value4 && corners !== undefined ? (
          <div className={"grid grid-cols-[1fr_1fr_auto] items-center gap-1.5"}>
            {RadiusCornerInput(corners, "tl", max, radius)}
            {RadiusCornerInput(corners, "tr", max, radius)}
            {value5}
            {RadiusCornerInput(corners, "bl", max, radius)}
            {RadiusCornerInput(corners, "br", max, radius)}
            <span />
          </div>
        ) : (
          <div className={"flex items-center gap-1.5"}>
            <div className={"min-w-0 flex-1"}>
              <runtime.NumericInput
                aria-label={"Corner radius"}
                unit={"px"}
                title={"Corner radius"}
                value={value ? undefined : radius}
                min={0}
                max={max}
                step={1}
                clearable={!value}
                placeholder={value ? "Mixed" : "0"}
                onValue={onChange}
                onScrub={onLive}
                onScrubEnd={onLiveEnd}
              />
            </div>
            {value5}
          </div>
        )}
      </div>
    );
  }
  function SpacingQuickPanel({
    padding: padding,
    max: max,
    onChange: onChange,
    onLive: onLive,
    onLiveEnd: onLiveEnd,
    margin: margin,
  }: Dynamic): Dynamic {
    return (
      <div
        className={quickPanelBodyClass}
        onMouseDown={preserveQuickPanelInputFocus}
        data-quick-panel={"spacing"}
      >
        <SpacingSidesEditor
          title={"Padding"}
          max={max}
          binding={{
            value: padding,
            onChange: onChange,
            onLive: onLive,
            onLiveEnd: onLiveEnd,
          }}
        />
        {margin !== undefined && (
          <SpacingSidesEditor
            title={"Margin"}
            max={margin.max ?? max}
            binding={margin}
          />
        )}
      </div>
    );
  }
  function SpacingSidesEditor({
    title: title,
    max: max,
    binding: binding,
  }: Dynamic): Dynamic {
    let {
        value: value,
        onChange: value2,
        onLive: value3,
        onLiveEnd: value4,
      }: Dynamic = binding,
      [value5, value6]: Dynamic = (0, react_mB.useState)(
        value.left !== value.right || value.top !== value.bottom,
      ),
      callback: Dynamic = (
        input?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
      ): Dynamic => {
        let value8: Dynamic = context.map(
            (input2?: Dynamic): Dynamic => value[input2],
          ),
          value9: Dynamic = value8.every(
            (input2?: Dynamic): Dynamic => input2 === value8[0],
          ),
          callback2: Dynamic = (input2?: Dynamic): Dynamic =>
            Object.fromEntries(
              context.map((input3?: Dynamic): Dynamic => [input3, input2]),
            );
        return (
          <runtime.NumericInput
            key={input}
            prefix={input}
            aria-label={title + " " + options}
            title={title + " " + options}
            value={value9 ? value8[0] : undefined}
            placeholder={value9 ? "0" : "Mixed"}
            min={0}
            max={max}
            step={1}
            clearable={value9}
            onValue={(input2?: Dynamic): Dynamic => {
              (input2 !== undefined || value9) && value2(callback2(input2));
            }}
            onScrub={
              value3
                ? (input2?: Dynamic): Dynamic => value3(callback2(input2))
                : undefined
            }
            onScrubEnd={value4}
          />
        );
      },
      value7: Dynamic = (
        <QuickPanelIconButton
          icon={runtime.PropertiesTooltipNameViewBoxPathsConfig_2}
          label={"Individual " + title.toLowerCase()}
          pressed={value5}
          hint={"Set each side"}
          onClick={(): Dynamic => value6(!value5)}
        />
      );
    return (
      <div
        className={"flex flex-col gap-1.5"}
        role={"group"}
        aria-label={title}
      >
        <div className={quickPanelHintClass}>{title}</div>
        <div className={"grid grid-cols-[1fr_1fr_auto] items-center gap-1.5"}>
          {value5 ? (
            <jsx_os.Fragment>
              {callback("T", "top", ["top"])}
              {callback("R", "right", ["right"])}
              {value7}
              {callback("B", "bottom", ["bottom"])}
              {callback("L", "left", ["left"])}
              <span />
            </jsx_os.Fragment>
          ) : (
            <jsx_os.Fragment>
              {callback("H", "left and right", ["left", "right"])}
              {callback("V", "top and bottom", ["top", "bottom"])}
              {value7}
            </jsx_os.Fragment>
          )}
        </div>
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "react_mB",
    () => react_mB,
    (value) => {
      react_mB = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsx_os",
    () => jsx_os,
    (value) => {
      jsx_os = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "borderSideMenuOrder",
    () => borderSideMenuOrder,
    (value) => {
      borderSideMenuOrder = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "borderSides",
    () => borderSides,
    (value) => {
      borderSides = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "borderSideLabels",
    () => borderSideLabels,
    (value) => {
      borderSideLabels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "borderSideInitials",
    () => borderSideInitials,
    (value) => {
      borderSideInitials = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "borderStyleOptions",
    () => borderStyleOptions,
    (value) => {
      borderStyleOptions = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "borderStyleLabels",
    () => borderStyleLabels,
    (value) => {
      borderStyleLabels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "borderStyleGlyphs",
    () => borderStyleGlyphs,
    (value) => {
      borderStyleGlyphs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "preserveQuickPanelInputFocus",
    () => preserveQuickPanelInputFocus,
  );
  bindRuntimeValue(
    runtime,
    "quickPanelBodyClass",
    () => quickPanelBodyClass,
    (value) => {
      quickPanelBodyClass = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "quickPanelPopoverOptions",
    () => quickPanelPopoverOptions,
    (value) => {
      quickPanelPopoverOptions = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "quickPanelHintClass",
    () => quickPanelHintClass,
    (value) => {
      quickPanelHintClass = value;
    },
  );
  bindRuntimeValue(runtime, "QuickPanelIconButton", () => QuickPanelIconButton);
  bindRuntimeValue(runtime, "BorderQuickPanel", () => BorderQuickPanel);
  bindRuntimeValue(
    runtime,
    "radiusCorners",
    () => radiusCorners,
    (value) => {
      radiusCorners = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "radiusCornerLabels",
    () => radiusCornerLabels,
    (value) => {
      radiusCornerLabels = value;
    },
  );
  bindRuntimeValue(runtime, "RadiusCornerInput", () => RadiusCornerInput);
  bindRuntimeValue(runtime, "RadiusQuickPanel", () => RadiusQuickPanel);
  bindRuntimeValue(runtime, "SpacingQuickPanel", () => SpacingQuickPanel);
  bindRuntimeValue(runtime, "SpacingSidesEditor", () => SpacingSidesEditor);
  return () => {
    react_mB = (0, runtime.toModuleNamespace)((0, runtime.load_react)(), 1);
    (0, runtime.initializeCdsIndex)();
    jsx_os = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    borderSideMenuOrder = ["top", "right", null, "bottom", "left", null];
    borderSides = ["top", "right", "bottom", "left"];
    borderSideLabels = {
      top: "Top",
      right: "Right",
      bottom: "Bottom",
      left: "Left",
    };
    borderSideInitials = {
      top: "T",
      right: "R",
      bottom: "B",
      left: "L",
    };
    borderStyleOptions = ["none", "solid", "dashed", "dotted"];
    borderStyleLabels = {
      none: "None",
      solid: "Solid",
      dashed: "Dashed",
      dotted: "Dotted",
    };
    borderStyleGlyphs = {
      solid: runtime.PropertiesTooltipNameViewBoxPathsConfig_6,
      dashed: runtime.PropertiesTooltipNameViewBoxPathsConfig_7,
      dotted: runtime.PropertiesTooltipNameViewBoxPathsConfig_8,
    };
    quickPanelBodyClass = "flex w-[184px] flex-col gap-1.5";
    quickPanelPopoverOptions = {
      side: "right",
      anchor: (input?: Dynamic): Dynamic => input.closest("[data-quick-panel]"),
    };
    quickPanelHintClass = "px-0.5 pt-0.5 text-footnote text-muted select-none";
    radiusCorners = ["tl", "tr", "bl", "br"];
    radiusCornerLabels = {
      tl: "Top left",
      tr: "Top right",
      bl: "Bottom left",
      br: "Bottom right",
    };
  };
}
