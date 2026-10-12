/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorPropertiesLayoutSection(
  runtime: RuntimeBindings,
): () => void {
  var reactPropertiesLayoutSection: Dynamic;
  function LayoutSection({
    rows: rows,
    parentDisplay: parentDisplay,
    display: display,
    multi: multi,
    standaloneTranslate: standaloneTranslate,
    disabledAll: disabledAll,
    disabledWhy: disabledWhy,
    noMargins: noMargins,
    onCommitMany: onCommitMany,
  }: Dynamic): Dynamic {
    let entries: Dynamic = new Map(
        rows.map((input?: Dynamic): Dynamic => [input.prop, input]),
      ),
      callback: Dynamic = (input?: Dynamic, options: Dynamic = ""): Dynamic => {
        let entry2: Dynamic = entries.get(input);
        return (
          (entry2 && !entry2.mixed ? (entry2.value ?? "") : "") ||
          entry2?.fallback ||
          options
        )
          .trim()
          .toLowerCase();
      },
      entry: Dynamic = entries.get("position"),
      value: Dynamic =
        (multi
          ? (entry && !entry.mixed ? (entry.value ?? "") : "")
              .trim()
              .toLowerCase()
          : callback("position")) || "static",
      value2: Dynamic = value === "absolute" || value === "fixed",
      value3: Dynamic = (parentDisplay ?? "").toLowerCase(),
      value4: Dynamic =
        parentDisplay === undefined ||
        value3.includes("flex") ||
        value3.includes("grid"),
      callback2: Dynamic = (input?: Dynamic): Dynamic => {
        if (!input || !(0, runtime.PropertiesInheritedFieldValueAlias)(input))
          return false;
        let value22: Dynamic = (0, runtime.parseCssNumber)(
          (input.value ?? "").trim(),
        );
        return (
          value22 != null && !(value22.unit === "%" && value22.value >= 100)
        );
      },
      value5: Dynamic = callback2(entries.get("width")),
      value6: Dynamic = callback2(entries.get("height")),
      value7: Dynamic = !!entries.get("position")?.mixed,
      value8: Dynamic = !!entries.get("transform")?.mixed,
      value9: Dynamic = (
        callback("display", "") ||
        (display ?? "")
      ).toLowerCase(),
      value10: Dynamic =
        /^(block|flex|grid|flow-root|table|list-item)(\s|$)/.test(value9),
      value11: Dynamic = !multi && !value4 && value5 && value10,
      value12: Dynamic =
        disabledAll || value7 || value8 || !!standaloneTranslate,
      value13: Dynamic = !value12 && (value2 || (value11 && !noMargins)),
      value14: Dynamic = !value12 && value2,
      value15: Dynamic = value13 && value5 && !noMargins,
      value16: Dynamic = value14 && value6 && !noMargins,
      value17: Dynamic = disabledAll
        ? (disabledWhy ?? "Read-only selection")
        : noMargins && !value2
          ? noMargins
          : value7
            ? "The selection mixes positioned and in-flow elements \u2014 align them one at a time"
            : value8
              ? "The selected elements carry different transforms \u2014 align them one at a time"
              : standaloneTranslate
                ? "This element is shifted with the translate property \u2014 remove it (Advanced) or align it by hand"
                : value4 && !value2
                  ? "Placed by its parent \u2014 select the parent and use its Align"
                  : multi && !value2
                    ? "In-flow elements align one at a time \u2014 select one"
                    : !value2 && !value10
                      ? "An inline element ignores auto margins \u2014 make it a Block first, or position it"
                      : !value2 && !value5
                        ? "Give it a Fixed width first (an auto width spans the parent)"
                        : undefined,
      callback3: Dynamic = (
        input?: Dynamic,
        options: Dynamic = false,
      ): Dynamic => {
        if (!value2 && !options) return [];
        let entry2: Dynamic = entries.get("transform");
        if (
          !(0, runtime.PropertiesInheritedFieldValueAlias)(entry2) ||
          entry2.mixed
        )
          return [];
        let value22: Dynamic = (0, runtime.parseCssTransform)(entry2.value);
        if (!value22 || value22[input].value === 0) return [];
        let value23: Dynamic = (0, runtime.serializeCssTransform)({
          ...value22,
          [input]: {
            value: 0,
            unit: "px",
          },
        });
        return [
          {
            prop: "transform",
            value: value23 === "none" || value23 === "" ? "none" : value23,
          },
        ];
      },
      value18: Dynamic = callback3("x"),
      value19: Dynamic = callback3("y"),
      value20: Dynamic = value === "relative",
      callback4: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic =>
        noMargins && input.startsWith("margin-")
          ? []
          : value2 ||
              value20 ||
              (0, runtime.PropertiesInheritedFieldValueAlias)(
                entries.get(input),
              )
            ? [
                {
                  prop: input,
                  value: options,
                },
              ]
            : [],
      items: Dynamic = [
        ...(value20
          ? [...callback4("left", "0px"), ...callback4("right", "auto")]
          : []),
        ...callback3("x", true),
      ],
      value21: Dynamic = value2
        ? {
            left: [
              {
                prop: "left",
                value: "0px",
              },
              ...callback4("right", "auto"),
              ...callback4("margin-left", "0px"),
              ...callback4("margin-right", "0px"),
              ...value18,
            ],
            hcenter: [
              {
                prop: "left",
                value: "0px",
              },
              {
                prop: "right",
                value: "0px",
              },
              {
                prop: "margin-left",
                value: "auto",
              },
              {
                prop: "margin-right",
                value: "auto",
              },
              ...value18,
            ],
            right: [
              {
                prop: "right",
                value: "0px",
              },
              ...callback4("left", "auto"),
              ...callback4("margin-left", "0px"),
              ...callback4("margin-right", "0px"),
              ...value18,
            ],
          }
        : {
            left: [
              {
                prop: "margin-left",
                value: "0px",
              },
              {
                prop: "margin-right",
                value: "auto",
              },
              ...items,
            ],
            hcenter: [
              {
                prop: "margin-left",
                value: "auto",
              },
              {
                prop: "margin-right",
                value: "auto",
              },
              ...items,
            ],
            right: [
              {
                prop: "margin-left",
                value: "auto",
              },
              {
                prop: "margin-right",
                value: "0px",
              },
              ...items,
            ],
          },
      state: Dynamic = {
        top: [
          {
            prop: "top",
            value: "0px",
          },
          ...callback4("bottom", "auto"),
          ...callback4("margin-top", "0px"),
          ...callback4("margin-bottom", "0px"),
          ...value19,
        ],
        vcenter: [
          {
            prop: "top",
            value: "0px",
          },
          {
            prop: "bottom",
            value: "0px",
          },
          {
            prop: "margin-top",
            value: "auto",
          },
          {
            prop: "margin-bottom",
            value: "auto",
          },
          ...value19,
        ],
        bottom: [
          {
            prop: "bottom",
            value: "0px",
          },
          ...callback4("top", "auto"),
          ...callback4("margin-top", "0px"),
          ...callback4("margin-bottom", "0px"),
          ...value19,
        ],
      },
      callback5: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic => {
        if (input === options) return true;
        let value22: Dynamic = (0, runtime.parseCssNumber)(input),
          value23: Dynamic = (0, runtime.parseCssNumber)(options);
        return (
          !!value22 &&
          !!value23 &&
          value22.value === value23.value &&
          (value22.value === 0 ||
            (value22.unit || "px") === (value23.unit || "px"))
        );
      },
      callback6: Dynamic = (input?: Dynamic): Dynamic =>
        input.filter((input2?: Dynamic): Dynamic => {
          let entry2: Dynamic = entries.get(input2.prop);
          if (entry2?.mixed) return true;
          let value22: Dynamic = (entry2?.value ?? "").trim();
          if (input2.value == null) return value22 !== "";
          let value23: Dynamic =
            value22 ||
            (!multi && !value2 && !value20
              ? (entry2?.fallback ?? "").trim()
              : "");
          return !callback5(value23, input2.value);
        }),
      callback7: Dynamic = (input?: Dynamic): Dynamic =>
        value17 ??
        ((input === "hcenter" || input === "vcenter") && noMargins
          ? noMargins
          : input === "hcenter" && value13 && !value5
            ? entries.get("width")?.mixed
              ? "the selected elements need one shared Fixed width"
              : "give it a Fixed width first (an auto width would stretch edge to edge)"
            : input === "vcenter" && value14 && !value6
              ? entries.get("height")?.mixed
                ? "the selected elements need one shared Fixed height"
                : "give it a Fixed height first (an auto height would stretch edge to edge)"
              : (input === "top" ||
                    input === "vcenter" ||
                    input === "bottom") &&
                  !value2
                ? "position it first (Absolute or Fixed) to align it vertically"
                : ""),
      items2: Dynamic = [
        {
          key: "left",
          label: "Align left",
          glyph: runtime.PropertiesSizingRowLeftHcenterRightConfig.left,
          on: value13,
          edits: value21.left,
        },
        {
          key: "hcenter",
          label: "Align horizontal centers",
          glyph: runtime.PropertiesSizingRowLeftHcenterRightConfig.hcenter,
          on: value15,
          edits: value21.hcenter,
        },
        {
          key: "right",
          label: "Align right",
          glyph: runtime.PropertiesSizingRowLeftHcenterRightConfig.right,
          on: value13,
          edits: value21.right,
        },
        {
          key: "top",
          label: "Align top",
          glyph: runtime.PropertiesSizingRowLeftHcenterRightConfig.top,
          on: value14,
          edits: state.top,
        },
        {
          key: "vcenter",
          label: "Align vertical centers",
          glyph: runtime.PropertiesSizingRowLeftHcenterRightConfig.vcenter,
          on: value16,
          edits: state.vcenter,
        },
        {
          key: "bottom",
          label: "Align bottom",
          glyph: runtime.PropertiesSizingRowLeftHcenterRightConfig.bottom,
          on: value14,
          edits: state.bottom,
        },
      ];
    return (
      <runtime.PropertyRow
        data-testid={"dc-align-actions"}
        title={value17}
        className={"[--prop-row-h:28px] pointer-coarse:[--prop-row-h:40px]"}
      >
        <div
          className={(0, runtime.cn)(
            "flex min-w-0 flex-1 items-center justify-between",
            runtime.PropertiesPrimitivesClassNames_4,
          )}
        >
          {items2.map(
            (input?: Dynamic): Dynamic =>
              (() => {
                const _Component = runtime.Button;
                const _props = {
                  variant: "ghost",
                  iconOnly: true,
                  icon: <runtime.PropertyOptionIcon icon={input.glyph} />,
                  "aria-label": input.label,
                  tooltip: input.label,
                  disabledReason:
                    input.label + " \u2014 " + callback7(input.key),
                  disabled: !input.on,
                  "data-testid": `dc-align-${input.key}`,
                  onClick: (): Dynamic => {
                    let value22: Dynamic = callback6(input.edits);
                    value22.length > 0 && onCommitMany(value22);
                  },
                } as const;
                const _key = input.key;
                return <_Component key={_key} {..._props} />;
              })(),
          )}
        </div>
      </runtime.PropertyRow>
    );
  }
  function PropertyFlexWrap({
    wrap: wrap,
    onCommitMany: onCommitMany,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.inheritedFieldForEdit)(wrap),
      value2: Dynamic = (
        (value.mixed ? "" : (value.value ?? "")) ||
        value.fallback ||
        "nowrap"
      )
        .trim()
        .toLowerCase()
        .startsWith("wrap"),
      value3: Dynamic = (0, runtime.PropertiesInheritedFieldValueAlias)(value);
    return (
      <runtime.Button
        variant={"ghost"}
        iconOnly={true}
        icon={"ArrowReturn"}
        aria-label={"Wrap"}
        tooltip={
          (value2 ? "Wraps onto new lines" : "No wrap") +
          (value3
            ? ""
            : wrap.inheritedFrom && !wrap.mixed
              ? ` (from ${wrap.inheritedFrom})`
              : " (inherited)")
        }
        pressed={value2}
        data-inherited={value2 && !value3 ? "" : undefined}
        className={"shrink-0"}
        disabled={value.disabled}
        data-testid={"dc-wrap-toggle"}
        onClick={(): Dynamic =>
          onCommitMany([
            {
              prop: "flex-wrap",
              value: value2 ? (value3 ? null : "nowrap") : "wrap",
            },
          ])
        }
      />
    );
  }
  function PropertyGridTracks({
    cols: cols,
    rows: rows,
    renderRows: renderRows,
    onCommitMany: onCommitMany,
  }: Dynamic): Dynamic {
    let callback: Dynamic = (input?: Dynamic): Dynamic =>
      !input.mixed &&
      (!(input.value ?? "").trim() ||
        (0, runtime.parseEqualGridColumns)(input.value) != null);
    if (!callback(cols) || !callback(rows))
      return (
        <runtime.jsxMediaPlaybackControls.Fragment>
          {renderRows([cols, rows])}
        </runtime.jsxMediaPlaybackControls.Fragment>
      );
    let value: Dynamic = (0, runtime.inheritedFieldsDisabledReason)(cols, rows),
      value2: Dynamic = (0, runtime.inheritedFieldsDescription)(cols, rows);
    cols = (0, runtime.inheritedFieldForEdit)(cols);
    rows = (0, runtime.inheritedFieldForEdit)(rows);
    let callback2: Dynamic = (
        input?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
        value4?: Dynamic,
      ): Dynamic => (
        <runtime.NumericInput
          aria-label={context}
          prefix={<runtime.PropertyOptionIcon icon={options} />}
          value={(0, runtime.parseEqualGridColumns)(input.value) ?? undefined}
          placeholder={
            input.mixed
              ? undefined
              : (0, runtime.parseEqualGridColumns)(input.fallback ?? "") != null
                ? String(
                    (0, runtime.parseEqualGridColumns)(input.fallback ?? ""),
                  )
                : value4
          }
          mixed={input.mixed}
          min={1}
          max={12}
          step={1}
          smallStep={1}
          clearable={true}
          steppers={false}
          disabled={input.disabled}
          onValue={(input2?: Dynamic): Dynamic =>
            onCommitMany([
              {
                prop: input.prop,
                value:
                  input2 === undefined
                    ? null
                    : (0, runtime.serializeEqualGridColumns)(
                        Math.round(input2),
                      ),
              },
            ])
          }
        />
      ),
      value3: Dynamic =
        (0, runtime.PropertiesInheritedFieldMixedAlias)(cols) ||
        (0, runtime.PropertiesInheritedFieldMixedAlias)(rows);
    return (
      <runtime.PropertyRow
        label={"Grid"}
        data-testid={"dc-grid-row"}
        title={
          (value ? value + ". " : "") +
          "Columns \xD7 rows, as counts of equal tracks (a custom track list keeps its own text rows)"
        }
        description={value2}
        onReset={
          value3
            ? (): Dynamic =>
                onCommitMany([
                  {
                    prop: cols.prop,
                    value: null,
                  },
                  {
                    prop: rows.prop,
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
          {callback2(
            cols,
            runtime.PropertiesTooltipNameViewBoxPathsConfig_10,
            "Columns",
            "auto",
          )}
          {callback2(
            rows,
            runtime.PropertiesTooltipNameViewBoxPathsConfig_9,
            "Rows",
            "auto",
          )}
        </div>
      </runtime.PropertyRow>
    );
  }
  function InspectorLayoutSection({
    sec: sec,
    selKey: selKey,
    isNested: isNested,
    readOnly = false,
    renderRows: renderRows,
    renderRow: renderRow,
    addItemsFor: addItemsFor,
    onCommitMany: onCommitMany,
  }: Dynamic): Dynamic {
    let entries: Dynamic = new Map(
        sec.rows.map((input?: Dynamic): Dynamic => [input.prop, input]),
      ),
      value: Dynamic = sec.rows.filter(
        (input?: Dynamic): Dynamic =>
          input.prop === "width" || input.prop === "height",
      ),
      value2: Dynamic = sec.rows.filter(
        (input?: Dynamic): Dynamic => /^(min|max)-/.test(input.prop),
      ),
      entry: Dynamic = entries.get("position"),
      entry2: Dynamic = entries.get("top"),
      entry3: Dynamic = entries.get("left"),
      value3: Dynamic = ["bottom", "right"]
        .map((input?: Dynamic): Dynamic => entries.get(input))
        .filter((input?: Dynamic): Dynamic => !!input),
      items: Dynamic = ["grid-column", "grid-row", "flex-grow"],
      value4: Dynamic = sec.rows.filter(
        (input?: Dynamic): Dynamic => items.includes(input.prop),
      ),
      value5: Dynamic = sec.rows.some(
        (input?: Dynamic): Dynamic => input.prop === "padding-top",
      ),
      value6: Dynamic = sec.rows.some(
        (input?: Dynamic): Dynamic => input.prop === "margin-top",
      ),
      entry4: Dynamic = entries.get("display"),
      entry5: Dynamic = entries.get("flex-direction"),
      entry6: Dynamic = entries.get("flex-wrap"),
      value7: Dynamic = (entry6 && !entry6.mixed ? (entry6.value ?? "") : "")
        .trim()
        .toLowerCase(),
      value8: Dynamic =
        value7 === "" || value7 === "wrap" || value7 === "nowrap",
      entry7: Dynamic = entries.get("grid-template-columns"),
      entry8: Dynamic = entries.get("grid-template-rows"),
      value9: Dynamic =
        entries.get("justify-content") ?? entries.get("justify-items"),
      entry9: Dynamic = entries.get("align-items"),
      entry10: Dynamic = entries.get("gap"),
      value10: Dynamic = (
        (entry5?.mixed ? "" : (entry5?.value ?? "")) ||
        entry5?.fallback ||
        "row"
      ).startsWith("column"),
      value11: Dynamic = sec.rows.some(
        (input?: Dynamic): Dynamic =>
          input.prop.startsWith("margin-") &&
          (0, runtime.PropertiesInheritedFieldValueAlias)(input),
      ),
      [value12, value13]: Dynamic =
        runtime.reactMediaPlaybackControls_2.default.useState(""),
      value14: Dynamic = value6 && (value11 || value12 === selKey),
      callback: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic =>
        (0, runtime.PropertiesInheritedFieldValueAlias)(input) &&
        !input.mixed &&
        !options.includes((input.value ?? "").trim().toLowerCase()),
      value15: Dynamic = (
        (entry?.mixed ? "" : (entry?.value ?? "")) ||
        entry?.fallback ||
        "static"
      )
        .trim()
        .toLowerCase(),
      value16: Dynamic = !!entry && !entry.mixed && value15 !== "static",
      value17: Dynamic = entry && {
        ...entry,
        label: "Position",
        spec: {
          ...entry.spec,
          label: "Position",
          editor: "select",
          optionLabels: runtime.PropertiesBoxLayoutStaticRelativeAbsoluteConfig,
        },
      },
      callback2: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic => {
        if (options === "static") {
          let items2: Dynamic = [
            ...(value15 !== "static" ||
            (0, runtime.PropertiesInheritedFieldValueAlias)(entry)
              ? [
                  {
                    prop: "position",
                    value: "static",
                  },
                ]
              : []),
            ...["top", "left", "bottom", "right"]
              .filter(
                (input2?: Dynamic): Dynamic =>
                  (0, runtime.PropertiesInheritedFieldValueAlias)(
                    entries.get(input2),
                  ),
              )
              .map(
                (input2?: Dynamic): Dynamic => ({
                  prop: input2,
                  value: null,
                }),
              ),
          ];
          items2.length > 0 && onCommitMany(items2);
        } else
          onCommitMany([
            {
              prop: input,
              value: options,
            },
          ]);
      },
      value18: Dynamic =
        sec.mode === "grid"
          ? [value9, entry9].filter((input?: Dynamic): Dynamic => !!input)
          : [],
      value19: Dynamic = isNested
        ? []
        : [
            ...addItemsFor(value2),
            ...(value16 ? addItemsFor(value3) : []),
            ...addItemsFor(value18),
            ...(value6 && !value14
              ? [
                  {
                    label: "Margin",
                    onSelect: (): Dynamic => value13(selKey),
                  },
                ]
              : []),
          ];
    return (
      <runtime.PropertySection
        title={sec.title}
        iconColumn={sec.id === "sizing"}
        actions={
          isNested ? undefined : (
            <runtime.PropertyActions
              section={sec.title}
              data-testid={`dc-add-${sec.id}`}
              items={value19}
              disabled={readOnly}
            />
          )
        }
      >
        {renderRows(value)}
        {renderRows(value2)}
        {value17 &&
          renderRow(value17, {
            onCommit: callback2,
          })}
        {entry &&
          entry2 &&
          entry3 &&
          (value16 ||
            (0, runtime.PropertiesInheritedFieldValueAlias)(entry2) ||
            (0, runtime.PropertiesInheritedFieldValueAlias)(entry3)) && (
            <runtime.PropertyPositionXY
              key={`${selKey}|offset`}
              left={entry3}
              top={entry2}
              renderRows={renderRows}
              onCommitMany={onCommitMany}
            />
          )}
        {!entry &&
          renderRows(
            [entry2, entry3].filter(
              (input?: Dynamic): Dynamic =>
                !!input &&
                (0, runtime.PropertiesInheritedFieldValueAlias)(input),
            ),
          )}
        {renderRows(
          value16
            ? value3
            : value3.filter(runtime.PropertiesInheritedFieldValueAlias),
        )}
        {renderRows(value4)}
        {entry4 && renderRow(entry4)}
        {entry5 &&
          renderRow(entry5, {
            trailing:
              entry6 && value8 ? (
                <PropertyFlexWrap wrap={entry6} onCommitMany={onCommitMany} />
              ) : undefined,
          })}
        {entry6 &&
          !value8 &&
          renderRows([
            {
              ...entry6,
              spec: {
                ...entry6.spec,
                editor: "string",
              },
            },
          ])}
        {entry7 && entry8 ? (
          <PropertyGridTracks
            key={`${selKey}|grid`}
            cols={entry7}
            rows={entry8}
            renderRows={renderRows}
            onCommitMany={onCommitMany}
          />
        ) : (
          renderRows(
            [entry7, entry8].filter((input?: Dynamic): Dynamic => !!input),
          )
        )}
        {sec.mode === "flex" && value9 && entry9 && (
          <runtime.PropertyFlexAlignment
            key={`${selKey}|align`}
            justify={value9}
            align={entry9}
            stack={true}
            vertical={value10}
            onCommitMany={onCommitMany}
          />
        )}
        {sec.mode === "flex" &&
          value9 &&
          callback(value9, [
            "flex-start",
            "center",
            "flex-end",
            "start",
            "end",
            "left",
            "right",
            "normal",
            "space-between",
            "legacy",
          ]) &&
          renderRows([
            {
              ...value9,
              label: "Justify",
              spec: {
                ...value9.spec,
                editor: "string",
              },
            },
          ])}
        {sec.mode === "flex" &&
          entry9 &&
          callback(entry9, [
            "flex-start",
            "center",
            "flex-end",
            "start",
            "end",
            "self-start",
            "self-end",
          ]) &&
          renderRows([
            {
              ...entry9,
              label: "Align",
              spec: {
                ...entry9.spec,
                editor: "string",
              },
            },
          ])}
        {sec.mode === undefined &&
          !value9 &&
          entry9 &&
          renderRows([
            {
              ...entry9,
              spec: {
                ...entry9.spec,
                longTail: false,
              },
            },
          ])}
        {entry10 && renderRows([entry10])}
        {renderRows(value18)}
        {value5 && (
          <runtime.PropertyBoxSides
            key={`${selKey}|padding`}
            label={"Padding"}
            base={"padding"}
            rows={sec.rows}
            renderRows={renderRows}
            onCommitMany={onCommitMany}
          />
        )}
        {value14 && (
          <runtime.PropertyBoxSides
            key={`${selKey}|margin`}
            label={"Margin"}
            base={"margin"}
            rows={sec.rows}
            renderRows={renderRows}
            onCommitMany={onCommitMany}
          />
        )}
      </runtime.PropertySection>
    );
  }
  bindRuntimeValue(runtime, "LayoutSection", () => LayoutSection);
  bindRuntimeValue(runtime, "PropertyFlexWrap", () => PropertyFlexWrap);
  bindRuntimeValue(runtime, "PropertyGridTracks", () => PropertyGridTracks);
  bindRuntimeValue(
    runtime,
    "InspectorLayoutSection",
    () => InspectorLayoutSection,
  );
  bindRuntimeValue(
    runtime,
    "reactPropertiesLayoutSection",
    () => reactPropertiesLayoutSection,
    (value) => {
      reactPropertiesLayoutSection = value;
    },
  );
  return () => {
    reactPropertiesLayoutSection = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
  };
}
