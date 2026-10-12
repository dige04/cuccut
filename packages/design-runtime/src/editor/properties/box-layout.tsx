/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorPropertiesBoxLayout(
  runtime: RuntimeBindings,
): () => void {
  var PropertiesBoxLayoutStaticRelativeAbsoluteConfig: Dynamic;
  function unifiedBoxSideValues(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = ["top", "right", "bottom", "left"].map(
      (input2?: Dynamic): Dynamic =>
        input.find(
          (input3?: Dynamic): Dynamic => input3.prop === `${options}-${input2}`,
        ),
    );
    if (value.some((input2?: Dynamic): Dynamic => !input2)) return null;
    let value2: Dynamic = value,
      value3: Dynamic = null,
      items: Dynamic = [undefined, undefined, undefined, undefined];
    for (let index: Dynamic = 0; index < 4; index++) {
      let value4: Dynamic = (value2[index].value ?? "").trim();
      if (!value4 || value2[index].mixed) continue;
      let value5: Dynamic = (0, runtime.parseCssNumber)(value4);
      if (!value5) return null;
      let value6: Dynamic = value5.unit || "px";
      if (value3 != null && value3 !== value6) return null;
      value3 = value6;
      items[index] = value5.value;
    }
    let callback: Dynamic = (input2?: Dynamic): Dynamic => {
        let value4: Dynamic = (0, runtime.parseCssNumber)(
          input2.fallback ?? "",
        );
        if (!value4) return input2.fallback ?? "";
        let value5: Dynamic = value4.unit || "px";
        return (0, runtime.formatCssNumber)(
          (0, runtime.roundCssNumber)(value4.value, value4.unit),
          value5 === (context ?? value3 ?? "px") ? "" : value5,
        );
      },
      items2: Dynamic = [
        callback(value2[0]),
        callback(value2[1]),
        callback(value2[2]),
        callback(value2[3]),
      ];
    return {
      rows: value2,
      values: items,
      placeholders: items2,
      unit: value3 ?? "px",
      mixed: value2.some((input2?: Dynamic): Dynamic => input2.mixed),
      disabled: value2.some((input2?: Dynamic): Dynamic => input2.disabled),
    };
  }
  function PropertyBoxSides({
    label: label,
    base: base,
    rows: rows,
    renderRows: renderRows,
    onCommitMany: onCommitMany,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.inheritedFieldsDisabledReason)(
        ...["top", "right", "bottom", "left"].map(
          (input?: Dynamic): Dynamic =>
            rows.find(
              (input2?: Dynamic): Dynamic => input2.prop === `${base}-${input}`,
            ),
        ),
      ),
      value2: Dynamic = (0, runtime.inheritedFieldsDescription)(
        ...["top", "right", "bottom", "left"].map(
          (input?: Dynamic): Dynamic =>
            rows.find(
              (input2?: Dynamic): Dynamic => input2.prop === `${base}-${input}`,
            ),
        ),
      ),
      value3: Dynamic = (0, runtime.useStyleCommitScrub)(
        (input?: Dynamic): Dynamic => onCommitMany(input),
      ),
      value4: Dynamic = unifiedBoxSideValues(rows, base),
      value5: Dynamic =
        value4 &&
        unifiedBoxSideValues(
          rows.map(
            (input?: Dynamic): Dynamic =>
              (0, runtime.inheritedFieldForEdit)(input),
          ),
          base,
          value4.unit,
        ),
      value6: Dynamic = value4 &&
        value5 && {
          ...value5,
          unit: value4.unit,
        };
    if (!value6)
      return (
        <runtime.jsxMediaPlaybackControls.Fragment>
          {renderRows(
            ["top", "right", "bottom", "left"]
              .map(
                (input?: Dynamic): Dynamic =>
                  rows.find(
                    (input2?: Dynamic): Dynamic =>
                      input2.prop === `${base}-${input}`,
                  ),
              )
              .filter((input?: Dynamic): Dynamic => !!input)
              .map(
                (input?: Dynamic): Dynamic => ({
                  ...input,
                  label: `${label} ${input.prop.slice(base.length + 1)}`,
                }),
              ),
          )}
        </runtime.jsxMediaPlaybackControls.Fragment>
      );
    let callback: Dynamic = (input?: Dynamic): Dynamic =>
        `${base}-${["top", "right", "bottom", "left"][input]}`,
      value7: Dynamic = value6.rows.some(
        runtime.PropertiesInheritedFieldMixedAlias,
      ),
      callback2: Dynamic = (input?: Dynamic): Dynamic =>
        input.map(
          (input2?: Dynamic): Dynamic => ({
            prop: callback(input2.side),
            value:
              input2.value === undefined
                ? null
                : (0, runtime.formatCssNumber)(input2.value, value6.unit),
          }),
        ),
      value8: Dynamic =
        (0, runtime.getFineUnitStep)(value6.unit, undefined) != null;
    return (
      <runtime.PropertySidesRow
        label={label}
        data-testid={`dc-${base}`}
        title={value}
        description={value2}
        values={value6.values}
        placeholders={value6.placeholders}
        unit={value6.unit}
        min={base === "padding" ? 0 : undefined}
        step={value8 ? 0.1 : undefined}
        smallStep={value8 ? 0.01 : undefined}
        mixed={value6.mixed}
        disabled={value6.disabled}
        onSides={(input?: Dynamic): Dynamic => onCommitMany(callback2(input))}
        onScrubSides={(input?: Dynamic): Dynamic =>
          value3.onScrub(callback2(input))
        }
        onScrubEnd={(): Dynamic => value3.onScrubEnd()}
        onReset={
          value7
            ? (): Dynamic =>
                onCommitMany([
                  {
                    prop: base,
                    value: null,
                  },
                  ...[0, 1, 2, 3].map(
                    (input?: Dynamic): Dynamic => ({
                      prop: callback(input),
                      value: null,
                    }),
                  ),
                ])
            : undefined
        }
      />
    );
  }
  function PropertyPositionXY({
    left: left,
    top: top,
    renderRows: renderRows,
    onCommitMany: onCommitMany,
  }: Dynamic): Dynamic {
    let callback: Dynamic = (input?: Dynamic): Dynamic => {
      let value4: Dynamic = (input.value ?? "").trim();
      return (
        input.mixed || !value4 || (0, runtime.parseCssNumber)(value4) != null
      );
    };
    if (!callback(left) || !callback(top))
      return (
        <runtime.jsxMediaPlaybackControls.Fragment>
          {renderRows([
            {
              ...left,
              label: "Offset X",
            },
            {
              ...top,
              label: "Offset Y",
            },
          ])}
        </runtime.jsxMediaPlaybackControls.Fragment>
      );
    let value: Dynamic = (0, runtime.inheritedFieldsDisabledReason)(left, top),
      value2: Dynamic = (0, runtime.inheritedFieldsDescription)(left, top);
    left = (0, runtime.inheritedFieldForEdit)(left);
    top = (0, runtime.inheritedFieldForEdit)(top);
    let callback2: Dynamic = (
        input?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
      ): Dynamic => {
        let value4: Dynamic = input.mixed
            ? null
            : (0, runtime.parseCssNumber)((input.value ?? "").trim()),
          value5: Dynamic = (0, runtime.parseCssNumber)(input.fallback ?? ""),
          value6: Dynamic = value4?.unit || value5?.unit || "px";
        return (
          <runtime.NumericInput
            aria-label={context}
            prefix={options}
            value={value4 ? value4.value : undefined}
            placeholder={
              input.mixed
                ? undefined
                : value5
                  ? (0, runtime.formatCssNumber)(
                      (0, runtime.roundCssNumber)(value5.value, value5.unit),
                      "",
                    )
                  : input.fallback || "auto"
            }
            mixed={input.mixed}
            clearable={true}
            refuseLetters={true}
            ownUnit={value6}
            steppers={false}
            disabled={input.disabled}
            onValue={(input2?: Dynamic): Dynamic =>
              onCommitMany([
                {
                  prop: input.prop,
                  value:
                    input2 === undefined
                      ? null
                      : (0, runtime.formatCssNumber)(input2, value6),
                },
                ...((input2 !== undefined && input.alsoCommit) || []),
              ])
            }
          />
        );
      },
      value3: Dynamic =
        (0, runtime.PropertiesInheritedFieldMixedAlias)(left) ||
        (0, runtime.PropertiesInheritedFieldMixedAlias)(top);
    return (
      <runtime.PropertyRow
        label={"Offset"}
        data-testid={"dc-offset"}
        title={value}
        description={value2}
        onReset={
          value3 && !left.disabled
            ? (): Dynamic =>
                onCommitMany([
                  {
                    prop: "left",
                    value: null,
                  },
                  {
                    prop: "top",
                    value: null,
                  },
                ])
            : undefined
        }
        onPress={(element?: Dynamic): Dynamic =>
          element.querySelector("input")?.focus()
        }
      >
        <div className={"grid min-w-0 flex-1 grid-cols-2 gap-2"}>
          {callback2(left, "X", "Offset X")}
          {callback2(top, "Y", "Offset Y")}
        </div>
      </runtime.PropertyRow>
    );
  }
  function PropertyFlexAlignment({
    justify: justify,
    align: align,
    stack: stack,
    vertical: vertical,
    onCommitMany: onCommitMany,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.inheritedFieldsDisabledReason)(
        justify,
        align,
      ),
      value2: Dynamic = (0, runtime.inheritedFieldsDescription)(justify, align);
    justify = (0, runtime.inheritedFieldForEdit)(justify);
    align = (0, runtime.inheritedFieldForEdit)(align);
    let value3: Dynamic = (justify.mixed ? "" : (justify.value ?? ""))
        .trim()
        .toLowerCase(),
      value4: Dynamic = (align.mixed ? "" : (align.value ?? ""))
        .trim()
        .toLowerCase(),
      value5: Dynamic = value3.startsWith("space-"),
      value6: Dynamic =
        value5 ||
        (!value3 &&
          !justify.mixed &&
          (justify.fallback ?? "").trim().toLowerCase().startsWith("space-")),
      value7: Dynamic =
        justify.prop === "justify-items"
          ? ["start", "center", "end"]
          : ["flex-start", "center", "flex-end"],
      items: Dynamic = ["flex-start", "center", "flex-end"],
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        justify.prop === "justify-items" &&
        (input === "normal" || input === "legacy")
          ? "stretch"
          : input === "start" || input === "left" || input === "normal"
            ? value7[0]
            : input === "end" || input === "right"
              ? value7[2]
              : input,
      callback2: Dynamic = (input?: Dynamic): Dynamic =>
        input === "start" || input === "self-start"
          ? "flex-start"
          : input === "end" || input === "self-end"
            ? "flex-end"
            : input,
      callback3: Dynamic = (input?: Dynamic): Dynamic =>
        input === "stretch" || input === "normal" || input === ""
          ? "flex-start"
          : callback2(input),
      value8: Dynamic = callback(
        value3 || (justify.fallback ?? "").trim().toLowerCase(),
      ),
      value9: Dynamic = callback3(
        value4 || (align.fallback ?? "").trim().toLowerCase(),
      ),
      value10: Dynamic = !!justify.disabled || !!align.disabled,
      value11: Dynamic =
        (0, runtime.PropertiesInheritedFieldMixedAlias)(justify) ||
        (0, runtime.PropertiesInheritedFieldMixedAlias)(align),
      callback4: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic =>
        input[options];
    return (
      <runtime.PropertyRow
        label={"Align"}
        data-testid={"dc-alignment"}
        title={
          justify.mixed || align.mixed ? "Mixed across the selection" : value
        }
        description={justify.mixed || align.mixed ? undefined : value2}
        onReset={
          value11 && !value10
            ? (): Dynamic =>
                onCommitMany([
                  {
                    prop: justify.prop,
                    value: null,
                  },
                  {
                    prop: align.prop,
                    value: null,
                  },
                ])
            : undefined
        }
        trailing={
          stack ? (
            <runtime.Button
              variant={"ghost"}
              iconOnly={true}
              icon={
                <runtime.PropertyOptionIcon
                  icon={
                    runtime.PropertiesSizingRowFlexStartStartCenterConfig[
                      "space-between"
                    ]
                  }
                />
              }
              aria-label={"Distribute"}
              tooltip={
                value6
                  ? "Distribute: space between \u2014 click to pack" +
                    (value5 ? "" : " (inherited)")
                  : "Distribute (space between)"
              }
              pressed={value6}
              disabled={value10}
              data-testid={"dc-distribute"}
              data-inherited={value6 && !value5 ? "" : undefined}
              className={(0, runtime.cn)("shrink-0", vertical && "rotate-90")}
              onClick={(): Dynamic =>
                onCommitMany([
                  {
                    prop: justify.prop,
                    value: value6
                      ? value5
                        ? null
                        : value7[0]
                      : "space-between",
                  },
                ])
              }
            />
          ) : undefined
        }
      >
        <span className={"flex min-w-0 flex-1 flex-wrap items-center gap-2"}>
          <span
            className={"min-w-[calc(var(--cds-h-control)*3)] flex-1"}
            title={
              value6
                ? "Computed \u2014 Distribute decides this axis"
                : undefined
            }
            data-testid={"dc-justify-group"}
          >
            <runtime.PropertySegments
              label={"Justify"}
              compact={true}
              value={
                value6 || justify.mixed
                  ? undefined
                  : (0, runtime.PropertiesInheritedFieldValueAlias)(justify) &&
                      value7.includes(callback(value3))
                    ? callback(value3)
                    : undefined
              }
              inherited={
                value6 ||
                justify.mixed ||
                (0, runtime.PropertiesInheritedFieldValueAlias)(justify)
                  ? undefined
                  : value7.includes(value8)
                    ? value8
                    : undefined
              }
              mixed={!!justify.mixed}
              disabled={value10 || value6}
              vertical={vertical}
              onChange={(input?: Dynamic): Dynamic =>
                onCommitMany([
                  {
                    prop: justify.prop,
                    value: input,
                  },
                ])
              }
              options={value7.map(
                (input?: Dynamic, options?: Dynamic): Dynamic => ({
                  value: input,
                  label: "Justify " + ["start", "center", "end"][options],
                  glyph: callback4(
                    runtime.PropertiesSizingRowFlexStartStartCenterConfig,
                    input,
                  ),
                }),
              )}
            />
          </span>
          <span
            className={"min-w-[calc(var(--cds-h-control)*3)] flex-1"}
            data-testid={"dc-align-group"}
          >
            <runtime.PropertySegments
              label={"Align"}
              compact={true}
              value={
                align.mixed
                  ? undefined
                  : (0, runtime.PropertiesInheritedFieldValueAlias)(align) &&
                      items.includes(callback2(value4))
                    ? callback2(value4)
                    : undefined
              }
              inherited={
                align.mixed ||
                (0, runtime.PropertiesInheritedFieldValueAlias)(align)
                  ? undefined
                  : items.includes(value9)
                    ? value9
                    : undefined
              }
              mixed={!!align.mixed}
              disabled={value10}
              vertical={vertical}
              onChange={(input?: Dynamic): Dynamic =>
                onCommitMany([
                  {
                    prop: align.prop,
                    value: input,
                  },
                ])
              }
              options={items.map(
                (input?: Dynamic, options?: Dynamic): Dynamic => ({
                  value: input,
                  label: "Align " + ["start", "center", "end"][options],
                  glyph: callback4(
                    runtime.PropertiesSizingRowFlexStartStartCenterConfig_2,
                    input,
                  ),
                }),
              )}
            />
          </span>
        </span>
      </runtime.PropertyRow>
    );
  }
  bindRuntimeValue(runtime, "unifiedBoxSideValues", () => unifiedBoxSideValues);
  bindRuntimeValue(runtime, "PropertyBoxSides", () => PropertyBoxSides);
  bindRuntimeValue(runtime, "PropertyPositionXY", () => PropertyPositionXY);
  bindRuntimeValue(
    runtime,
    "PropertiesBoxLayoutStaticRelativeAbsoluteConfig",
    () => PropertiesBoxLayoutStaticRelativeAbsoluteConfig,
    (value) => {
      PropertiesBoxLayoutStaticRelativeAbsoluteConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertyFlexAlignment",
    () => PropertyFlexAlignment,
  );
  return () => {
    PropertiesBoxLayoutStaticRelativeAbsoluteConfig = {
      static: "Inline",
      relative: "Relative",
      absolute: "Absolute",
      fixed: "Fixed",
      sticky: "Sticky",
    };
  };
}
