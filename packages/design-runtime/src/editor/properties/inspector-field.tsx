/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorPropertiesInspectorField(
  runtime: RuntimeBindings,
): () => void {
  var jsxPropertiesInspectorField: Dynamic;
  var PropertiesInspectorFieldPattern: Dynamic;
  var PropertiesInspectorFieldPattern_2: Dynamic;
  var PropertiesInspectorFieldPattern_3: Dynamic;
  var PropertiesInspectorFieldReplace: Dynamic;
  var PropertiesInspectorFieldTest: Dynamic;
  var PropertiesInspectorFieldNameComponentFromSet: Dynamic;
  function PropertyInspectorField(input?: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0,
      runtime.reactPropertiesDropShadowEditor_2.useState)(null),
      { textContrast: value3 = null }: Dynamic = (0,
      runtime.useInspectorContext)(),
      [value4, value5]: Dynamic = (0,
      runtime.reactPropertiesDropShadowEditor_2.useState)(false),
      value6: Dynamic = (0, runtime.isInheritedInspectorField)(input.state),
      value7: Dynamic =
        value6 &&
        !input.state.stale &&
        (value4 ||
          !runtime.PropertiesColorRowSizeFillShadowSet.has(
            input.state.spec?.editor ?? "string",
          ))
          ? {
              ...input,
              state: (0, runtime.inheritedFieldForEdit)(input.state),
            }
          : input,
      { state: value8 }: Dynamic = value7,
      value9: Dynamic = (0, runtime.reactPropertiesDropShadowEditor_2.useRef)(
        false,
      );
    (0, runtime.reactPropertiesDropShadowEditor_2.useEffect)((): Dynamic => {
      if (!value4 && !value9.current) return;
      let current: Dynamic = value9.current;
      value9.current = false;
      let callback2: Dynamic = (): Dynamic => {
        let element: Dynamic = (document as Dynamic).querySelector(
            `[data-testid="dc-prop-${value8.prop.replace(/["\\]/g, "\\$&")}"]`,
          ),
          activeElement: Dynamic = (document as Dynamic).activeElement;
        if (
          current &&
          activeElement &&
          activeElement !== (document as Dynamic).body &&
          !element?.contains(activeElement)
        )
          return;
        let value27: Dynamic = element?.querySelector(
          'input:not([aria-hidden="true"])',
        );
        value27?.focus();
        value27?.select();
      };
      if (!current) return callback2();
      let value26: Dynamic = setTimeout(callback2, 0);
      return (): Dynamic => clearTimeout(value26);
    }, [value4, value8.prop]);
    let { alsoCommit: value10, alsoCommitOnClear: value11 }: Dynamic = value8,
      { onCommit: value12, onCommitMany: value13 }: Dynamic = value7,
      value14: Dynamic = (0,
      runtime.reactPropertiesDropShadowEditor_2.useCallback)(
        (input2?: Dynamic, options?: Dynamic): Dynamic => {
          let value26: Dynamic =
              input2 === value8.prop &&
              Object.hasOwn(
                runtime.InspectorPropertySchemaBackdropFilterConfig,
                input2,
              )
                ? runtime.InspectorPropertySchemaBackdropFilterConfig[input2]
                : undefined,
            items: Dynamic = [
              ...(value26
                ? [
                    {
                      prop: value26,
                      value: options,
                    },
                  ]
                : []),
              ...((options != null ? value10 : value11) ?? []),
            ];
          if (items.length > 0) {
            if (value13)
              value13([
                {
                  prop: input2,
                  value: options,
                },
                ...items,
              ]);
            else
              for (let value27 of [
                {
                  prop: input2,
                  value: options,
                },
                ...items,
              ] as Dynamic)
                value12(value27.prop, value27.value);
          } else value12(input2, options);
        },
        [value10, value11, value12, value13, value8.prop],
      ),
      value15: Dynamic = (0,
      runtime.reactPropertiesDropShadowEditor_2.useCallback)((): Dynamic => {
        let value26: Dynamic = value8.mixed
          ? ""
          : (value8.varSource ?? value8.value ?? value8.fallback ?? "");
        navigator.clipboard
          ?.writeText(`${value8.prop}: ${value26};`)
          .catch((): Dynamic => {});
      }, [value8]),
      value16: Dynamic = Object.hasOwn(
        runtime.InspectorPropertySchemaBackgroundFontWeightFontStyleConfig,
        value8.prop,
      )
        ? runtime.InspectorPropertySchemaBackgroundFontWeightFontStyleConfig[
            value8.prop
          ]
        : null,
      callback: Dynamic = (): Dynamic => {
        value5(false);
        value16
          ? value20([
              {
                prop: value8.prop,
                value: null,
              },
              {
                prop: value16,
                value: null,
              },
            ])
          : value14(value8.prop, null);
      },
      value17: Dynamic =
        (((value8.value != null && value8.value !== "") ||
          (value16 != null &&
            value8.companionValue != null &&
            value8.companionValue !== "")) &&
          !value6) ||
        (!!value8.mixed && !value8.inheritedFrom) ||
        !!value8.companionMixed,
      value18: Dynamic =
        value8.prop === "__headStart" || value8.prop === "__headEnd",
      value19: Dynamic = value18
        ? []
        : [
            {
              label: "Unset property",
              onSelect: callback,
              disabled: !value17 || !!value8.disabled,
            },
            {
              label: "Edit as text",
              onSelect: (): Dynamic => value5(true),
              disabled: !!value8.disabled,
            },
            {
              label: "Copy declaration",
              onSelect: value15,
            },
            ...((value7.onRemoveRow && !value6 && !value8.disabled) ||
            value7.extraMenuItems?.length
              ? ["separator"]
              : []),
            ...(value7.onRemoveRow && !value6 && !value8.disabled
              ? [
                  {
                    label: "Remove row",
                    variant: "danger",
                    onSelect: (): Dynamic => {
                      value17 && callback();
                      value7.onRemoveRow?.();
                    },
                  },
                ]
              : []),
            ...(value7.extraMenuItems ?? []),
          ],
      value20: Dynamic = (0,
      runtime.reactPropertiesDropShadowEditor_2.useCallback)(
        (input2?: Dynamic): Dynamic => {
          let value26: Dynamic = (
              input2.some((input3?: Dynamic): Dynamic => input3.value != null)
                ? (value10 ?? [])
                : []
            ).filter(
              (input3?: Dynamic): Dynamic =>
                !input2.some(
                  (input4?: Dynamic): Dynamic => input4.prop === input3.prop,
                ),
            ),
            items: Dynamic = [...input2, ...value26];
          if (value13) value13(items);
          else
            for (let value27 of items as Dynamic)
              value12(value27.prop, value27.value);
        },
        [value10, value13, value12],
      ),
      value21: Dynamic =
        (value17 && !value8.disabled && value8.prop !== "__text" && !value18) ||
        (value7.onRemoveRow && !value8.disabled && !value6)
          ? (): Dynamic => {
              value17 && callback();
              value7.onRemoveRow?.();
            }
          : undefined,
      state: Dynamic = {
        label: value8.label || undefined,
        "data-testid": `dc-prop-${value8.prop}`,
        title:
          value8.whyDisabled ??
          (0, runtime.inheritedFieldTooltip)(input.state) ??
          (value8.varSource
            ? `Authored as ${value8.varSource} \u2014 editing writes the resolved value`
            : undefined),
        description: (0, runtime.inheritedFieldDescription)(input.state),
        onReset: value21,
        trailing: value7.trailing,
        resetLabel: value7.onRemoveRow
          ? value17
            ? `Unset ${value8.label} and remove row`
            : `Remove ${value8.label} row`
          : `Unset ${value8.label} (use inherited)`,
        onContextMenu: value18
          ? undefined
          : (event?: Dynamic): Dynamic => {
              event.preventDefault();
              value2({
                x: event.clientX,
                y: event.clientY,
              });
            },
      },
      state2: Dynamic = {
        ...value7,
        onCommit:
          value4 && value8.spec?.editor === "number"
            ? (input2?: Dynamic, options?: Dynamic): Dynamic => {
                value14(input2, options);
                input2 === value8.prop &&
                  (options == null ||
                    (0, runtime.parseCssNumber)(options) != null) &&
                  setTimeout((): Dynamic => {
                    value9.current = true;
                    value5(false);
                  }, 0);
              }
            : value14,
        onCommitMany: value20,
        shell: state,
      },
      { isLiteral: value22 }: Dynamic = (0, runtime.inspectorFieldDisplay)(
        input.state,
      ),
      value23: Dynamic = input.state.value,
      value24: Dynamic = value4 ? "string" : (value8.spec?.editor ?? "string"),
      value25: Dynamic;
    if (value8.stale && !value4) {
      let value26: Dynamic =
          value8.varSource ?? (value8.value || value8.companionValue || ""),
        value27: Dynamic =
          !!value8.spec?.options?.includes(value26) ||
          (value8.spec?.optionLabels != null &&
            Object.hasOwn(value8.spec.optionLabels, value26)),
        value28: Dynamic = value8.mixed
          ? "Mixed"
          : value27
            ? (0, runtime.propertyOptionLabel)(value8.spec, value26)
            : value26;
      return (
        <runtime.jsxPropertiesSizingRow.Fragment>
          <runtime.PropertyRow
            {...state}
            title={
              value6
                ? `From ${value8.inheritedFrom} \u2014 it has no row in the current layout; right-click to edit`
                : (state.title ??
                  "Set on this element; it has no row in the current layout \u2014 reset, or right-click to edit")
            }
          >
            <span
              data-testid={`dc-stale-${value8.prop}`}
              className={(0, runtime.cn)(
                "min-w-0 truncate px-1 text-footnote",
                value8.mixed && "text-muted",
              )}
            >
              {value28}
            </span>
          </runtime.PropertyRow>
          <runtime.EditorMenu
            at={value}
            onClose={(): Dynamic => value2(null)}
            items={value19}
            minWidth={170}
            label={(value8.label || value8.prop) + " actions"}
          />
        </runtime.jsxPropertiesSizingRow.Fragment>
      );
    }
    switch (value24) {
      case "bool": {
        let value26: Dynamic = value8.mixed ? "" : (value8.value ?? "").trim(),
          value27: Dynamic = value8.spec?.boolOnValue;
        if (value27) {
          let value28: Dynamic =
            value26 || (value8.mixed ? "" : (value8.fallback ?? "").trim());
          value25 = (
            <runtime.PropertyToggleRow
              shell={state}
              label={value8.label}
              on={value28.toLowerCase() === value27.toLowerCase()}
              disabled={value8.disabled}
              onToggle={(input2?: Dynamic): Dynamic =>
                value14(value8.prop, input2 ? value27 : null)
              }
            />
          );
        } else {
          let value28: Dynamic = value8.spec?.options?.[0] ?? "none";
          value25 = (
            <runtime.PropertyToggleRow
              shell={state}
              label={value8.label}
              on={value26 !== value28}
              disabled={value8.disabled}
              onToggle={(input2?: Dynamic): Dynamic =>
                value14(value8.prop, input2 ? null : value28)
              }
            />
          );
        }
        break;
      }
      case "number":
        value25 =
          value6 &&
          value23 &&
          value22 &&
          (0, runtime.parseCssNumber)(value23) == null ? (
            <runtime.PropertyCssTextRow {...state2} />
          ) : (
            <runtime.useFieldNumericArrowStep {...state2} />
          );
        break;
      case "color": {
        if (value8.textFill === undefined) {
          value25 = <runtime.PropertyCssColorRow {...state2} />;
          break;
        }
        let value26: Dynamic =
            value3 &&
            !value8.mixed &&
            !value8.disabled &&
            !value8.textFill.clipped &&
            value8.textFill.transparentInk === undefined
              ? {
                  against: value3.against,
                  role: value3.role,
                }
              : undefined,
          value27: Dynamic =
            value3 && value26 !== undefined
              ? (0, runtime.evaluateColorContrast)(value3.ink, value26)
              : undefined,
          value28: Dynamic =
            value27 === undefined
              ? undefined
              : (0, runtime.summarizeContrastResults)(value27).sentence,
          value29: Dynamic = (
            <runtime.PropertyRow
              {...state}
              description={
                value28 === undefined
                  ? state.description
                  : state.description
                    ? state.description.replace(/\.?\s*$/, ". ") + value28
                    : value28
              }
            >
              <runtime.PropertyBackgroundRow
                label={value8.label}
                value={value8.value}
                varSource={value8.varSource}
                varPartial={value8.varPartial}
                fallback={value8.fallback}
                disabled={value8.disabled}
                mixed={value8.mixed}
                inherited={!!value8.inheritedFrom}
                textFill={value8.textFill}
                contrast={value26}
                testId={`dc-color-${value8.prop}`}
                onCommitMany={value20}
              />
            </runtime.PropertyRow>
          );
        value25 = (
          <div data-dc={"contrast-row"}>
            {value29}
            {value27 !== undefined && value3 ? (
              <runtime.PropertyRow
                label={""}
                className={"-mt-0.5 pb-1 [--prop-row-h:0px]"}
              >
                <runtime.ContrastLockup fg={value3.ink} results={value27} />
              </runtime.PropertyRow>
            ) : null}
          </div>
        );
        break;
      }
      case "select":
        value25 = <runtime.PropertyCssEnumRow {...state2} />;
        break;
      case "flexSeg":
        value25 = <runtime.PropertyCssSegmentsRow {...state2} />;
        break;
      case "typeStyle":
        value25 = <runtime.PropertyAlignmentRow {...state2} />;
        break;
      case "fontFace":
        value25 = <runtime.PropertyFontWeightRow {...state2} />;
        break;
      case "gridTracks":
        value25 =
          value23 &&
          (!value22 || (0, runtime.parseEqualGridColumns)(value23) == null) ? (
            <runtime.PropertyCssTextRow {...state2} />
          ) : (
            <runtime.PropertyGridColumnsRow {...state2} />
          );
        break;
      case "gridSpan":
        value25 =
          value23 &&
          (!value22 || (0, runtime.parseGridSpan)(value23) == null) ? (
            <runtime.PropertyCssTextRow {...state2} />
          ) : (
            <runtime.PropertyGridSpanRow {...state2} />
          );
        break;
      case "transform":
        value25 = <runtime.PropertyTransformRow {...state2} />;
        break;
      case "font":
        value25 = <runtime.PropertyFontFamilyRow {...state2} />;
        break;
      case "fill":
        value25 =
          !value22 && value23 ? (
            <runtime.PropertyCssTextRow {...state2} />
          ) : (
            <runtime.PropertyRow {...state}>
              <runtime.PropertyBackgroundRow
                label={value8.label}
                value={value8.value}
                companionValue={value8.companionValue}
                companionAuthored={value8.companionVarSource}
                valueAuthored={value8.varSource}
                varPartial={value8.varPartial}
                companionVarPartial={value8.companionVarPartial}
                fallback={value8.fallback}
                disabled={value8.disabled}
                mixed={value8.mixed || value8.companionMixed}
                inherited={!!value8.inheritedFrom}
                noImageReason={value8.fillNoImageReason}
                onCommitMany={value20}
              />
            </runtime.PropertyRow>
          );
        break;
      case "shadow":
        value25 =
          !value22 && value23 ? (
            <runtime.PropertyCssTextRow {...state2} />
          ) : (
            <runtime.PropertyRow {...state}>
              <runtime.PropertyShadowRow
                label={value8.label}
                prop={value8.prop}
                value={value8.value}
                fallback={value8.fallback}
                disabled={value8.disabled}
                mixed={value8.mixed}
                inherited={!!value8.inheritedFrom}
                onCommitMany={value20}
              />
            </runtime.PropertyRow>
          );
        break;
      case "image":
        value25 = (
          <runtime.PropertyRow {...state}>
            <runtime.PropertyImageRow
              label={value8.label}
              value={value8.mixed ? null : value8.value}
              mixed={value8.mixed}
              disabled={value8.disabled}
              onCommit={(input2?: Dynamic): Dynamic =>
                value14(value8.prop, input2)
              }
              onPickFile={value7.onPickImageFile}
              uploadOnlyReason={value8.imageUploadOnlyReason}
            />
          </runtime.PropertyRow>
        );
        break;
      case "size":
        value25 = (
          <runtime.PropertySizingRow
            shell={state}
            label={value8.label}
            prop={value8.prop}
            value={value8.value}
            fallback={value8.fallback}
            disabled={value8.disabled}
            mixed={value8.mixed}
            noHug={value8.noHug}
            fixedOnlyReason={value8.fixedSizeReason}
            onCommitMany={
              value8.inheritedFrom
                ? (input2?: Dynamic): Dynamic =>
                    value20(
                      input2.map(
                        (input3?: Dynamic): Dynamic =>
                          input3.prop === value8.prop && input3.value == null
                            ? {
                                ...input3,
                                value: "auto",
                              }
                            : input3,
                      ),
                    )
                : value20
            }
          />
        );
        break;
      default:
        value25 = <runtime.PropertyCssTextRow {...state2} />;
        break;
    }
    return (
      <runtime.jsxPropertiesSizingRow.Fragment>
        {value25}
        <runtime.EditorMenu
          at={value}
          onClose={(): Dynamic => value2(null)}
          items={value19}
          minWidth={170}
          label={(value8.label || value8.prop) + " actions"}
        />
      </runtime.jsxPropertiesSizingRow.Fragment>
    );
  }
  bindRuntimeValue(
    runtime,
    "PropertyInspectorField",
    () => PropertyInspectorField,
  );
  bindRuntimeValue(
    runtime,
    "jsxPropertiesInspectorField",
    () => jsxPropertiesInspectorField,
    (value) => {
      jsxPropertiesInspectorField = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesInspectorFieldPattern",
    () => PropertiesInspectorFieldPattern,
    (value) => {
      PropertiesInspectorFieldPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesInspectorFieldPattern_2",
    () => PropertiesInspectorFieldPattern_2,
    (value) => {
      PropertiesInspectorFieldPattern_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesInspectorFieldPattern_3",
    () => PropertiesInspectorFieldPattern_3,
    (value) => {
      PropertiesInspectorFieldPattern_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesInspectorFieldReplace",
    () => PropertiesInspectorFieldReplace,
    (value) => {
      PropertiesInspectorFieldReplace = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesInspectorFieldTest",
    () => PropertiesInspectorFieldTest,
    (value) => {
      PropertiesInspectorFieldTest = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesInspectorFieldNameComponentFromSet",
    () => PropertiesInspectorFieldNameComponentFromSet,
    (value) => {
      PropertiesInspectorFieldNameComponentFromSet = value;
    },
  );
  return () => {
    jsxPropertiesInspectorField = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    PropertiesInspectorFieldPattern = /^\s*\{\{([\s\S]+?)\}\}\s*$/;
    PropertiesInspectorFieldPattern_2 = /^-?\d+(\.\d+)?$/;
    PropertiesInspectorFieldPattern_3 = /^on(-|[A-Z])/;
    PropertiesInspectorFieldReplace = (input?: Dynamic): Dynamic =>
      input.replace(
        /-([a-z])/g,
        (input2?: Dynamic, options?: Dynamic): Dynamic => options.toUpperCase(),
      );
    PropertiesInspectorFieldTest = (input?: Dynamic): Dynamic =>
      /^(aria|data)-/.test(input)
        ? input
        : PropertiesInspectorFieldReplace(input);
    PropertiesInspectorFieldNameComponentFromSet = new Set([
      "name",
      "component",
      "from",
    ]);
  };
}
