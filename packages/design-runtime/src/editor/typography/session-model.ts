/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorTypographySessionModel(
  runtime: RuntimeBindings,
): () => void {
  function typographySessionModel(input?: Dynamic): Dynamic {
    let {
        metrics: value,
        sizeMixed: value2,
        ownFamily: value3,
        family: value4,
        sizes: value5,
        sizeNames: value6,
        sizeFamilies: value7,
        systemRows: value8,
        hasSystem: value9,
        single: value10,
      }: Dynamic = input,
      size: Dynamic = value.size,
      value11: Dynamic = value2
        ? undefined
        : (0, runtime.matchedDesignSystemTextStyle)(value8, value),
      value12: Dynamic = value9 ? [] : value5,
      value13: Dynamic =
        size !== undefined && !value2 && value12.includes(size),
      value14: Dynamic = size !== undefined ? value7.get(size) : undefined,
      value15: Dynamic =
        value13 &&
        (value3 === undefined ||
          (value14 !== undefined &&
            (0, runtime.displayFontFamily)(value3).toLowerCase() ===
              (0, runtime.displayFontFamily)(value14).toLowerCase()))
          ? (value6.get(size) ?? null)
          : null,
      value16: Dynamic = value11?.id ?? (value13 ? String(size) : null),
      value17: Dynamic = value11?.style.name ?? value15 ?? null,
      value18: Dynamic =
        value11?.style.name ??
        value15 ??
        [
          (0, runtime.displayFontFamily)(value4),
          value2 ? "Mixed" : size === undefined ? "" : String(Math.round(size)),
        ]
          .filter(Boolean)
          .join(" \xB7 "),
      items: Dynamic = [
        ...value12.map((input2?: Dynamic): Dynamic => {
          let value19: Dynamic =
            value6.get(input2) ??
            ((0, runtime.displayFontFamily)(value7.get(input2) ?? value4) ||
              String(input2));
          return {
            value: String(input2),
            text: value19,
            hint: String(input2) + "px",
            labelStyle: {
              fontFamily: value7.get(input2) ?? (value4 || undefined),
              fontSize: Math.min(20, Math.max(13, input2 / 2.4)),
            },
          };
        }),
        ...value8.map(
          ({
            id: id,
            style: style,
            group: group,
            subgroup: subgroup,
            subtitle: subtitle,
          }: Dynamic): Dynamic => ({
            value: id,
            text: style.name,
            hint: String((0, runtime.TypographyMetricsFontSize)(style)) + "px",
            labelStyle: {
              fontFamily: style.family?.stack,
              fontWeight: (0, runtime.TypographyMetricsHandler)(
                style.fontWeight,
              ),
              fontStyle: style.italic ? "italic" : undefined,
              fontSize: Math.min(20, Math.max(13, style.fontSize / 2.4)),
            },
            title: style.name + " \xB7 " + subtitle,
            ...(group !== undefined
              ? {
                  group: group,
                }
              : {}),
            ...(subgroup !== undefined
              ? {
                  subgroup: subgroup,
                }
              : {}),
          }),
        ),
      ];
    return {
      value: value16,
      chipText: value18,
      matchedName: value17,
      mixed: value2,
      options: items,
      editsFor: (input2?: Dynamic): Dynamic => {
        let value19: Dynamic = value8.find(
          (input3?: Dynamic): Dynamic => input3.id === input2,
        );
        if (value19 !== undefined)
          return (0, runtime.typographyStyleEdits)(value19.style);
        let value20: Dynamic =
          value11 !== undefined && value10
            ? [
                "line-height",
                "letter-spacing",
                "font-weight",
                "font-style",
                ...(value11.style.family !== undefined ? ["font-family"] : []),
              ].map((input3?: Dynamic): Dynamic => [input3, undefined])
            : [];
        return [["font-size", input2 + "px"], ...value20];
      },
    };
  }
  function typographyCensusOptions(input?: Dynamic): Dynamic {
    let callback: Dynamic = (input2?: Dynamic): Dynamic => {
        let value3: Dynamic = parseFloat(input2);
        return Number.isFinite(value3) ? value3 : undefined;
      },
      callback2: Dynamic = (input2?: Dynamic): Dynamic =>
        /px$/.test(input2)
          ? callback(input2)
          : /pt$/.test(input2)
            ? Math.round(((callback(input2) ?? 0) * 4) / 3)
            : undefined,
      value: Dynamic = [
        ...new Set(
          [...input.sizes]
            .map(callback2)
            .filter(
              (input2?: Dynamic): Dynamic => input2 !== undefined && input2 > 0,
            ),
        ),
      ].sort(
        (input2?: Dynamic, options?: Dynamic): Dynamic => options - input2,
      ),
      entries: Dynamic = new Map();
    for (let [value3, value4] of Object.entries(
      input.sizeRoles ?? {},
    ) as Dynamic) {
      let value5: Dynamic = callback2(value3);
      if (value5 === undefined) continue;
      let value6: Dynamic = entries.get(value5) ?? new Map();
      for (let [value7, value8] of Object.entries(value4) as Dynamic)
        value6.set(value7, (value6.get(value7) ?? 0) + value8);
      entries.set(value5, value6);
    }
    let value2: Dynamic = (0, runtime.summarizeFontSizeUsage)(value, entries),
      entries2: Dynamic = new Map();
    for (let [value3, value4] of Object.entries(
      input.sizeFamilies ?? {},
    ) as Dynamic) {
      let value5: Dynamic = callback2(value3);
      value5 !== undefined &&
        !entries2.has(value5) &&
        runtime.InspectorComputedDataPattern.test(value4) &&
        entries2.set(value5, value4);
    }
    return {
      sizes: value,
      sizeNames: value2,
      sizeFamilies: entries2,
    };
  }
  function typographySelectionModel(input?: Dynamic): Dynamic {
    let {
      items: value,
      census: value2,
      systemRows: value3,
      hasSystem: value4,
    }: Dynamic = input;
    if (value.length === 0) return null;
    let {
      sizes: value5,
      sizeNames: value6,
      sizeFamilies: value7,
    }: Dynamic = typographyCensusOptions(value2);
    if (value5.length === 0 && value3.length === 0) return null;
    let value8: Dynamic = value.map(
        (input2?: Dynamic): Dynamic =>
          (0, runtime.authoredTypographyMetrics)(
            input2.tag,
            input2.inlineStyle ?? "",
            input2.computed,
          ),
      )[0],
      value9: Dynamic =
        value.length > 1 &&
        new Set(
          value.map((input2?: Dynamic): Dynamic => input2.inlineSize ?? null),
        ).size > 1,
      entries: Dynamic = new Map(
        (0, runtime.parseStyleDeclarations)(value[0].authoredStyle).map(
          (input2?: Dynamic): Dynamic => [input2.prop, input2.value],
        ),
      ),
      value10: Dynamic = (0, runtime.normalizeInspectorComputedData)("text", {
        tag: value[0].tag,
        computed: value[0].computed,
      }),
      value11: Dynamic = entries.get("font-family") ?? value10.fontFamily ?? "";
    return typographySessionModel({
      metrics: value8,
      sizeMixed: value9,
      ownFamily: value[0].inlineFamily ?? undefined,
      family: runtime.InspectorComputedDataPattern.test(value11) ? value11 : "",
      sizes: value5,
      sizeNames: value6,
      sizeFamilies: value7,
      systemRows: value3,
      hasSystem: value4,
      single: value.length <= 1,
    });
  }
  bindRuntimeValue(
    runtime,
    "typographySessionModel",
    () => typographySessionModel,
  );
  bindRuntimeValue(
    runtime,
    "typographyCensusOptions",
    () => typographyCensusOptions,
  );
  bindRuntimeValue(
    runtime,
    "typographySelectionModel",
    () => typographySelectionModel,
  );
  return () => {};
}
