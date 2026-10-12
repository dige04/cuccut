/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorPropertiesEffectsSection(
  runtime: RuntimeBindings,
): () => void {
  var PropertiesEffectsSectionBoxShadowFilterBackdropFilterValues: Dynamic;
  function propertyEffectAddItems(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value: Dynamic = "box",
    extra?: Dynamic,
    detail: Dynamic = false,
    argument: Dynamic = runtime.NotOnDiamondOrArrowShapesMessage,
  ): Dynamic {
    let items: Dynamic = [],
      value2: Dynamic = getShadowProperty(input, value);
    if ((0, runtime.propertyAppliesToNode)(value2, input)) {
      let value3: Dynamic = (0, runtime.styleRecordList)(
          (0, runtime.ownStyleBagValue)(options, value2),
        ),
        value4: Dynamic =
          value3.length >= runtime.StyleSchemaValuesLimit
            ? {
                disabledReason: `At most ${runtime.StyleSchemaValuesLimit} per element`,
              }
            : {},
        callback: Dynamic =
          (input2?: Dynamic): Dynamic =>
          (): Dynamic =>
            context(value2, [
              ...value3,
              (0, runtime.defaultShadowValue)(value2, input2),
            ]),
        value5: Dynamic =
          extra ??
          (value3.length >= runtime.StyleSchemaValuesLimit
            ? `At most ${runtime.StyleSchemaValuesLimit} per element`
            : undefined);
      items.push(
        value5 !== undefined
          ? {
              label: "Drop shadow",
              onSelect: (): Dynamic => {},
              disabledReason: value5,
            }
          : {
              label: "Drop shadow",
              onSelect: callback(false),
            },
      );
      items.push(
        value2 === "textShadow"
          ? {
              label: "Inner shadow",
              onSelect: (): Dynamic => {},
              disabledReason: detail
                ? argument
                : runtime.InnerShadowNeedsAFillOrMessage,
            }
          : {
              label: "Inner shadow",
              onSelect: callback(true),
              ...value4,
              ...(detail
                ? {
                    disabledReason: argument,
                  }
                : {}),
            },
      );
    }
    for (let value3 of ["filter", "backdropFilter"] as Dynamic) {
      let value4: Dynamic = (0, runtime.asStyleRecord)(
        (0, runtime.ownStyleBagValue)(options, value3),
      );
      !(0, runtime.propertyAppliesToNode)(value3, input) ||
        value4?.blur !== undefined ||
        items.push({
          label:
            runtime.PropertiesStyleBagFilterBackdropFilterConfig[value3] ??
            (0, runtime.propertyEffectLabel)(value3),
          onSelect: (): Dynamic =>
            context(
              value3,
              (0, runtime.setOptionalEffectField)(
                value4,
                "blur",
                runtime.PropertiesStyleBagConstant,
              ),
            ),
          ...(detail && value3 === "backdropFilter"
            ? {
                disabledReason: argument,
              }
            : {}),
        });
    }
    return items;
  }
  function getShadowProperty(input?: Dynamic, options?: Dynamic): Dynamic {
    return options === "text" &&
      (0, runtime.propertyAppliesToNode)("textShadow", input)
      ? "textShadow"
      : "boxShadow";
  }
  function EffectsSection(input?: Dynamic): Dynamic {
    let {
        kind: value,
        bag: value2,
        subsection: value3,
        blurRows: value6 = true,
        children: value4,
        shadowTarget: value7 = "box",
        dropShadowDisabledReason: value5,
      }: Dynamic = input,
      value8: Dynamic = (0, runtime.reactPropertiesStyleBag.useState)(
        undefined,
      ),
      [value9, value10]: Dynamic =
        input.setOpenEditor !== undefined
          ? [input.openEditor, input.setOpenEditor]
          : value8,
      state: Dynamic = {
        ...(0, runtime.createStyleBagEditor)(input),
        openEditor: value9,
        setOpenEditor: value10,
      },
      items: Dynamic = [
        ...propertyEffectAddItems(
          value,
          value2,
          (input2?: Dynamic, items2?: Dynamic): Dynamic => {
            Array.isArray(items2) &&
              value10({
                key: input2,
                index: items2.length - 1,
              });
            state.commit(input2, items2);
          },
          value7,
          value5,
          input.silhouette,
          input.silhouetteReason,
        ),
        ...(input.addItems ?? []),
      ];
    if (
      items.length === 0 &&
      value2 === undefined &&
      value4 === undefined &&
      !PropertiesEffectsSectionBoxShadowFilterBackdropFilterValues.some(
        (input2?: Dynamic): Dynamic =>
          (0, runtime.propertyAppliesToNode)(input2, value),
      )
    )
      return null;
    let value11: Dynamic =
        getShadowProperty(value, value7) === "textShadow"
          ? ["boxShadow", "textShadow"]
          : ["boxShadow"],
      callback: Dynamic = (input2?: Dynamic, options?: Dynamic): Dynamic =>
        value7 !== "text"
          ? (0, runtime.shadowEffectLabel)(input2, options)
          : input2 === "textShadow"
            ? "Drop shadow"
            : input2 === "boxShadow"
              ? (0, runtime.asStyleRecord)(options)?.inset === true
                ? "Inner shadow"
                : "Box shadow"
              : (0, runtime.shadowEffectLabel)(input2, options);
    return (
      <runtime.PropertySection
        title={"Effects"}
        subsection={value3}
        iconColumn={true}
        actions={
          <runtime.PropertyActions
            section={"Effects"}
            items={items}
            disabled={state.disabled}
          />
        }
      >
        {value11.flatMap((input2?: Dynamic): Dynamic => {
          let value12: Dynamic = (0, runtime.styleRecordList)(
            (0, runtime.ownStyleBagValue)(value2, input2),
          );
          return value12.map(
            (input3?: Dynamic, options?: Dynamic): Dynamic =>
              (() => {
                const _Component = runtime.ShadowEffectRow;
                const _props = {
                  propKey: input2,
                  list: value12,
                  index: options,
                  rec: input3,
                  ed: state,
                  label: callback(input2, input3),
                } as const;
                const _key = input2 + String(options);
                return <_Component key={_key} {..._props} />;
              })(),
          );
        })}
        {value6 &&
          ["filter", "backdropFilter"].map((input2?: Dynamic): Dynamic => {
            let value12: Dynamic = (0, runtime.asStyleRecord)(
              (0, runtime.ownStyleBagValue)(value2, input2),
            );
            return value12?.blur !== undefined &&
              (0, runtime.propertyAppliesToNode)(input2, value) ? (
              <runtime.BlurEffectRow
                key={input2}
                label={
                  runtime.PropertiesStyleBagFilterBackdropFilterConfig[
                    input2
                  ] ?? (0, runtime.propertyEffectLabel)(input2)
                }
                propKey={input2}
                rec={value12}
                ed={state}
              />
            ) : null;
          })}
        {value4}
      </runtime.PropertySection>
    );
  }
  bindRuntimeValue(
    runtime,
    "propertyEffectAddItems",
    () => propertyEffectAddItems,
  );
  bindRuntimeValue(runtime, "getShadowProperty", () => getShadowProperty);
  bindRuntimeValue(
    runtime,
    "PropertiesEffectsSectionBoxShadowFilterBackdropFilterValues",
    () => PropertiesEffectsSectionBoxShadowFilterBackdropFilterValues,
    (value) => {
      PropertiesEffectsSectionBoxShadowFilterBackdropFilterValues = value;
    },
  );
  bindRuntimeValue(runtime, "EffectsSection", () => EffectsSection);
  return () => {
    PropertiesEffectsSectionBoxShadowFilterBackdropFilterValues = [
      "boxShadow",
      "filter",
      "backdropFilter",
    ];
  };
}
