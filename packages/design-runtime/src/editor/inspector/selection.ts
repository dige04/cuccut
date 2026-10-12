/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorInspectorSelection(
  runtime: RuntimeBindings,
): () => void {
  var InspectorSelectionSubscribers: Dynamic;
  function orderInspectorSections(input?: Dynamic): Dynamic {
    let state: Dynamic = {
        size: 0,
        sizing: 1,
        text: !input.some(
          (input2?: Dynamic): Dynamic =>
            ![
              "size",
              "sizing",
              "appearance",
              "text",
              "effects",
              "link",
            ].includes(input2.id),
        )
          ? 2
          : 4,
        appearance: 3,
        effects: 5,
      },
      callback: Dynamic = (input2?: Dynamic): Dynamic => state[input2] ?? 2;
    input.sort(
      (input2?: Dynamic, options?: Dynamic): Dynamic =>
        callback(input2.id) - callback(options.id),
    );
  }
  function resolveInspectorInheritedValues(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    if (!context) return;
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
        input2 != null && input2 !== "",
      callback2: Dynamic = (input2?: Dynamic): Dynamic =>
        Object.hasOwn(context, input2) ? context[input2] : undefined,
      callback3: Dynamic = (input2?: Dynamic): Dynamic => {
        let value2: Dynamic = callback(input2.value)
          ? callback2(input2.prop)
          : undefined;
        if (callback(input2.value) && !value2) return;
        let value3: Dynamic = Object.hasOwn(
            runtime.InspectorPropertySchemaBackgroundFontWeightFontStyleConfig,
            input2.prop,
          )
            ? runtime
                .InspectorPropertySchemaBackgroundFontWeightFontStyleConfig[
                input2.prop
              ]
            : undefined,
          value4: Dynamic =
            !!value3 &&
            (callback(input2.companionValue) || callback(value.get(value3))),
          value5: Dynamic = value3 && value4 ? callback2(value3) : undefined;
        if (value4 && !value5) return;
        let value6: Dynamic = value2 ?? value5;
        value6 && (input2.inheritedFrom = value6);
      };
    for (let value2 of input as Dynamic) value2.rows.forEach(callback3);
    options.forEach(callback3);
  }
  function inspectSingleElement(input?: Dynamic): Dynamic {
    return (0, runtime.getElementInspector)(input);
  }
  function filterLayoutInspectorRows(input?: Dynamic): Dynamic {
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
      (input2.value != null && input2.value !== "") || !!input2.mixed;
    return {
      sections: input.sections.flatMap((input2?: Dynamic): Dynamic => {
        let value: Dynamic = input2.rows.filter(
          (input3?: Dynamic): Dynamic =>
            InspectorSelectionSubscribers.has(input3.prop) &&
            (input2.id === "size" || input2.id === "text" || callback(input3)),
        );
        return value.length > 0
          ? [
              {
                ...input2,
                rows: value,
              },
            ]
          : [];
      }),
      advanced: input.advanced.filter(
        (input2?: Dynamic): Dynamic =>
          InspectorSelectionSubscribers.has(input2.prop) && callback(input2),
      ),
    };
  }
  function inspectElementSelection(items?: Dynamic): Dynamic {
    if (items.length === 0)
      return {
        sections: [],
        advanced: [],
      };
    if (items.length === 1) return inspectSingleElement(items[0]);
    let callback: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic =>
        runtime.svgShapeTags.has(input.tag) &&
        (0, runtime.parseStyleDeclarations)(input.authoredStyle).some(
          (input2?: Dynamic): Dynamic => input2.prop === options,
        ),
      values: Dynamic = new Set(
        runtime.InspectorStyleMetadataStrokeStrokeWidthFillValues.filter(
          (input?: Dynamic): Dynamic =>
            items.some((input2?: Dynamic): Dynamic => callback(input2, input)),
        ),
      ),
      value: Dynamic = items.map(
        (input?: Dynamic): Dynamic =>
          (0, runtime.getElementInspector)(input, {
            forMulti: true,
            cssPaint: values,
          }),
      ),
      callback2: Dynamic = (input?: Dynamic): Dynamic =>
        input[0]
          .map((input2?: Dynamic): Dynamic => {
            let value4: Dynamic = input.map(
              (input3?: Dynamic): Dynamic =>
                input3.find(
                  (input4?: Dynamic): Dynamic => input4.prop === input2.prop,
                ),
            );
            if (value4.some((input3?: Dynamic): Dynamic => input3 == null))
              return null;
            let value5: Dynamic = value4.map(
                (input3?: Dynamic): Dynamic => input3.value ?? "",
              ),
              value6: Dynamic = value4.map(
                (input3?: Dynamic): Dynamic => input3.companionValue ?? "",
              ),
              value7: Dynamic = value5.every(
                (input3?: Dynamic): Dynamic => input3 === value5[0],
              ),
              value8: Dynamic = value6.every(
                (input3?: Dynamic): Dynamic => input3 === value6[0],
              ),
              value9: Dynamic = value4.every(
                (input3?: Dynamic): Dynamic =>
                  JSON.stringify(input3.alsoCommit ?? null) ===
                    JSON.stringify(value4[0].alsoCommit ?? null) &&
                  JSON.stringify(input3.alsoCommitOnClear ?? null) ===
                    JSON.stringify(value4[0].alsoCommitOnClear ?? null),
              ),
              state: Dynamic = {
                ...input2,
                value: (value7 && value5[0]) || null,
                companionValue: (value8 && value6[0]) || null,
                mixed: !value7,
                companionMixed: !value8,
              };
            if (
              !value9 &&
              (delete state.alsoCommit,
              delete state.alsoCommitOnClear,
              state.prop === "@target")
            )
              return null;
            value4.some((input3?: Dynamic): Dynamic => input3?.noHug) &&
              (state.noHug = true);
            if (state.textFill !== undefined) {
              let value14: Dynamic = value4.map(
                (input3?: Dynamic): Dynamic => input3.textFill,
              );
              if (
                value14.some(
                  (input3?: Dynamic): Dynamic =>
                    input3 === undefined ||
                    input3.clipped !== value14[0].clipped ||
                    input3.inlineClip !== value14[0].inlineClip ||
                    input3.transparentInk !== value14[0].transparentInk,
                )
              )
                delete state.textFill;
              else if (
                value14.some(
                  (input3?: Dynamic): Dynamic =>
                    (input3.layer ?? "") !== (value14[0].layer ?? ""),
                )
              ) {
                let { computedLayer: value15, ...value16 }: Dynamic =
                  value14[0];
                state.textFill = {
                  ...value16,
                  layer: null,
                };
              }
            }
            value4.some(
              (input3?: Dynamic): Dynamic =>
                input3.whyDisabled !== state.whyDisabled,
            ) &&
              (state.whyDisabled !== undefined &&
                (state.disabled = value4.some(
                  (input3?: Dynamic): Dynamic =>
                    input3.disabled === true &&
                    input3.whyDisabled === undefined,
                )),
              delete state.whyDisabled);
            value4.some(
              (input3?: Dynamic): Dynamic =>
                input3.whyDisabled === runtime.SvgArrowPropertiesLabel,
            ) &&
              Object.assign(state, {
                disabled: true,
                whyDisabled: value4.every(
                  (input3?: Dynamic): Dynamic =>
                    input3.whyDisabled === runtime.SvgArrowPropertiesLabel,
                )
                  ? runtime.SvgArrowPropertiesLabel
                  : runtime.SvgArrowPropertiesLabel_2,
              });
            state.spec?.longTail &&
              value4.some(
                (input3?: Dynamic): Dynamic => !input3.spec?.longTail,
              ) &&
              (state.spec = {
                ...state.spec,
                longTail: false,
              });
            let value10: Dynamic = value4.map(
              (input3?: Dynamic): Dynamic => input3.fallback ?? "",
            );
            value10.every(
              (input3?: Dynamic): Dynamic => input3 === value10[0],
            ) || delete state.fallback;
            delete state.companionFallback;
            let value11: Dynamic = value4
              .map((input3?: Dynamic): Dynamic => input3.varSource)
              .filter((input3?: Dynamic): Dynamic => !!input3);
            value7 && value11.length > 0
              ? ((state.varSource = value11[0]),
                value11.length < value4.length ||
                value11.some(
                  (input3?: Dynamic): Dynamic => input3 !== value11[0],
                )
                  ? (state.varPartial = true)
                  : delete state.varPartial)
              : (delete state.varSource, delete state.varPartial);
            let value12: Dynamic = value4
              .map((input3?: Dynamic): Dynamic => input3.companionVarSource)
              .filter((input3?: Dynamic): Dynamic => !!input3);
            value8 && value12.length > 0
              ? ((state.companionVarSource = value12[0]),
                value12.length < value4.length ||
                value12.some(
                  (input3?: Dynamic): Dynamic => input3 !== value12[0],
                )
                  ? (state.companionVarPartial = true)
                  : delete state.companionVarPartial)
              : (delete state.companionVarSource,
                delete state.companionVarPartial);
            let value13: Dynamic = value4.map(
              (input3?: Dynamic): Dynamic => input3.inheritedFrom,
            );
            value8 && value13.every((input3?: Dynamic): Dynamic => !!input3)
              ? (state.inheritedFrom = [...new Set(value13)].join(", "))
              : delete state.inheritedFrom;
            return state;
          })
          .filter((input2?: Dynamic): Dynamic => input2 != null),
      items2: Dynamic = [];
    for (let value4 of value[0].sections as Dynamic) {
      let value5: Dynamic = value.map(
        (input?: Dynamic): Dynamic =>
          input.sections.find(
            (input2?: Dynamic): Dynamic => input2.id === value4.id,
          ),
      );
      if (value5.some((input?: Dynamic): Dynamic => input == null)) continue;
      let values4: Dynamic = new Set(
          value5.map((input?: Dynamic): Dynamic => input.mode),
        ),
        value6: Dynamic = callback2(
          value5.map((input?: Dynamic): Dynamic => input.rows),
        ),
        state: Dynamic = {
          ...value4,
          rows: value6,
          ...(values4.size > 1
            ? {
                mode: undefined,
              }
            : {}),
        };
      value5.every(
        (input?: Dynamic): Dynamic => input.shadowTarget === "shape",
      ) || delete state.shadowTarget;
      delete state.dropShadowReason;
      items2.push(state);
    }
    let callback3: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic =>
      input.sections.find(
        (input2?: Dynamic): Dynamic =>
          !["size", "sizing", "appearance", "text", "effects"].includes(
            input2.id,
          ),
      )?.id ??
      (runtime.InspectorStyleMetadataSubscribers.has(options.tag) ||
      runtime.InspectorStyleMetadataTextTspanTextpathSet.has(options.tag)
        ? "text"
        : "container");
    if (
      value
        .map(
          (input?: Dynamic, options?: Dynamic): Dynamic =>
            callback3(input, items[options]),
        )
        .every((input?: Dynamic): Dynamic => input === "text")
    ) {
      let value4: Dynamic = items2.findIndex(
        (input?: Dynamic): Dynamic => input.id === "text",
      );
      value4 >= 0 &&
        (items2[value4] = {
          ...items2[value4],
          title: `${items.length} Text`,
        });
    }
    orderInspectorSections(items2);
    if (
      !(
        items2
          .find((input?: Dynamic): Dynamic => input.id === "link")
          ?.rows.some((input?: Dynamic): Dynamic => input.prop === "@target") ??
        false
      )
    )
      for (let value4 of value as Dynamic) {
        let value5: Dynamic = value4.sections
          .find((input?: Dynamic): Dynamic => input.id === "link")
          ?.rows.find((input?: Dynamic): Dynamic => input.prop === "@target");
        value5 &&
          value5.value != null &&
          value5.value !== "" &&
          !value4.advanced.some(
            (input?: Dynamic): Dynamic => input.prop === "@target",
          ) &&
          value4.advanced.push({
            prop: "@target",
            label: "target",
            value: value5.value,
            disabled: value5.disabled,
          });
      }
    let values2: Dynamic = new Set(
        items2.flatMap(
          (input?: Dynamic): Dynamic =>
            input.rows.map((input2?: Dynamic): Dynamic => input2.prop),
        ),
      ),
      value2: Dynamic = items.some(
        (input?: Dynamic): Dynamic =>
          runtime.InspectorStyleMetadataTextTspanTextpathSet.has(input.tag),
      );
    value.forEach((input?: Dynamic, options?: Dynamic): Dynamic => {
      for (let value4 of input.sections.flatMap(
        (input2?: Dynamic): Dynamic => input2.rows,
      ) as Dynamic) {
        if (
          !(
            runtime.InspectorStyleMetadataStrokeStrokeWidthFillValues.includes(
              value4.prop,
            ) ||
            (value2 && value4.prop === "color")
          ) ||
          values2.has(value4.prop) ||
          value4.value == null ||
          value4.value === ""
        )
          continue;
        let value5: Dynamic = (0, runtime.parseStyleDeclarations)(
            items[options].authoredStyle,
          ).some((input2?: Dynamic): Dynamic => input2.prop === value4.prop),
          value6: Dynamic = value5 ? value4.prop : `@${value4.prop}`;
        input.advanced.some(
          (input2?: Dynamic): Dynamic => input2.prop === value6,
        ) ||
          input.advanced.push({
            prop: value6,
            label: value6,
            value: value4.value,
            ...(value4.varSource
              ? {
                  varSource: value4.varSource,
                }
              : {}),
            ...(value5 && value4.inheritedFrom
              ? {
                  inheritedFrom: value4.inheritedFrom,
                }
              : {}),
            disabled: value4.disabled,
          });
      }
    });
    let entries: Dynamic = new Map(),
      values3: Dynamic = new Set(
        value.flatMap(
          (input?: Dynamic): Dynamic =>
            input.sections.flatMap(
              (input2?: Dynamic): Dynamic =>
                input2.rows.map((input3?: Dynamic): Dynamic => input3.prop),
            ),
        ),
      );
    for (let value4 of value as Dynamic)
      for (let value5 of value4.advanced as Dynamic) {
        if (value5.stale && values3.has(value5.prop)) continue;
        let value6: Dynamic = entries.get(value5.prop) ?? [];
        value6.push(value5);
        entries.set(value5.prop, value6);
      }
    let entries2: Dynamic = new Map(
        runtime.InspectorPropertySchemaCursorPointerEventsObjectFitValues.map(
          (input?: Dynamic, options?: Dynamic): Dynamic => [input, options],
        ),
      ),
      callback4: Dynamic = (input?: Dynamic): Dynamic =>
        input.startsWith("@") ? 2 : entries2.has(input) ? 1 : 0,
      value3: Dynamic = [...entries.keys()]
        .sort(
          (input?: Dynamic, options?: Dynamic): Dynamic =>
            callback4(input) - callback4(options) ||
            (entries2.get(input) ?? 0) - (entries2.get(options) ?? 0),
        )
        .map((input?: Dynamic): Dynamic => {
          let entry: Dynamic = entries.get(input),
            value4: Dynamic = entry[0],
            value5: Dynamic = entry.map(
              (input2?: Dynamic): Dynamic => input2.value ?? "",
            ),
            value6: Dynamic =
              entry.length === value.length &&
              value5.every((input2?: Dynamic): Dynamic => input2 === value5[0])
                ? {
                    ...value4,
                  }
                : {
                    ...value4,
                    prop: input,
                    value: null,
                    mixed: true,
                  },
            value7: Dynamic = entry.map(
              (input2?: Dynamic): Dynamic => input2.inheritedFrom,
            );
          entry.length === value.length &&
          value7.every((input2?: Dynamic): Dynamic => !!input2)
            ? (value6.inheritedFrom = [...new Set(value7)].join(", "))
            : delete value6.inheritedFrom;
          return value6;
        });
    return {
      sections: items2,
      advanced: value3,
    };
  }
  bindRuntimeValue(
    runtime,
    "orderInspectorSections",
    () => orderInspectorSections,
  );
  bindRuntimeValue(
    runtime,
    "resolveInspectorInheritedValues",
    () => resolveInspectorInheritedValues,
  );
  bindRuntimeValue(runtime, "inspectSingleElement", () => inspectSingleElement);
  bindRuntimeValue(
    runtime,
    "InspectorSelectionSubscribers",
    () => InspectorSelectionSubscribers,
    (value) => {
      InspectorSelectionSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "filterLayoutInspectorRows",
    () => filterLayoutInspectorRows,
  );
  bindRuntimeValue(
    runtime,
    "inspectElementSelection",
    () => inspectElementSelection,
  );
  return () => {
    InspectorSelectionSubscribers = new Set([
      "width",
      "height",
      "position",
      "top",
      "left",
      "bottom",
      "right",
      "inset",
      "z-index",
      "transform",
      "__text",
    ]);
  };
}
