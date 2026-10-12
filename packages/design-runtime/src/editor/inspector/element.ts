/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorInspectorElement(
  runtime: RuntimeBindings,
): () => void {
  function getElementInspector(
    input?: Dynamic,
    options: Dynamic = {},
  ): Dynamic {
    let value: Dynamic = (0, runtime.expandCssDeclarations)(
        (0, runtime.parseStyleDeclarations)(input.authoredStyle),
      ),
      entries: Dynamic = new Map();
    for (let value26 of value as Dynamic)
      entries.set(value26.prop, value26.value);
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
        input.computed[(0, runtime.cssPropertyToComputedKey)(input2)] ?? "",
      callback2: Dynamic = (input2?: Dynamic): Dynamic => {
        if (!input2 || !input2.includes("var("))
          return {
            value: input2,
          };
        let value26: Dynamic = (0, runtime.replaceCssVariables)(
          input2,
          input.varValues ?? {},
        );
        return value26 != null && value26 !== input2
          ? {
              value: value26,
              varSource: input2,
            }
          : {
              value: input2,
            };
      },
      callback3: Dynamic = (input2?: Dynamic): Dynamic => {
        let value26: Dynamic = (0, runtime.getPropertySpecification)(input2);
        return {
          prop: input2,
          label: value26?.label ?? input2,
          spec: value26,
          ...callback2(entries.get(input2) ?? null),
          fallback: callback(input2) || value26?.defaultValue || "",
          disabled: input.disabled,
        };
      },
      items: Dynamic = [],
      state: Dynamic = {
        prop: "object-fit",
        label: "Fit",
        spec: {
          prop: "object-fit",
          label: "Fit",
          editor: "select",
          section: "advanced",
          options: ["fill", "contain", "cover", "none", "scale-down"],
        },
        value: entries.get("object-fit") ?? null,
        fallback: callback("object-fit"),
        disabled: input.disabled,
      };
    input.tag === "img" &&
      items.push({
        id: "image",
        title: "Image",
        rows: [
          {
            prop: "@src",
            label: "Source",
            spec: {
              prop: "@src",
              label: "Source",
              editor: "image",
              section: "advanced",
            },
            value: input.attrs.src ?? null,
            disabled: input.disabled,
          },
          state,
        ],
      });
    let callback4: Dynamic = (
        input2?: Dynamic,
        options2?: Dynamic,
        context?: Dynamic,
        value26?: Dynamic,
      ): Dynamic => ({
        prop: `@${input2}`,
        label: options2,
        spec: {
          prop: `@${input2}`,
          label: options2,
          editor: context,
          section: "advanced",
          ...(value26?.options
            ? {
                options: value26.options,
              }
            : {}),
        },
        value: input.attrs[input2] ?? null,
        hint: value26?.placeholder,
        disabled: input.disabled,
      }),
      flag: Dynamic = false;
    if (input.tag === "a") {
      let callback10: Dynamic = (input2?: Dynamic): Dynamic => {
          let kind: Dynamic = (0, runtime.classifyStyleValue)(input2).kind;
          return kind === "template" || kind === "var";
        },
        target: Dynamic = input.attrs.target,
        value26: Dynamic = !callback10(target),
        rel: Dynamic = input.attrs.rel,
        value27: Dynamic = !callback10(rel),
        items5: Dynamic = ["noopener", "noreferrer"],
        value28: Dynamic = (rel ?? "").trim().split(/\s+/).filter(Boolean),
        value29: Dynamic = value28.map(
          (input2?: Dynamic): Dynamic => input2.toLowerCase(),
        ),
        value30: Dynamic = [
          ...value28,
          ...items5.filter(
            (input2?: Dynamic): Dynamic => !value29.includes(input2),
          ),
        ].join(" "),
        value31: Dynamic = value28.filter(
          (input2?: Dynamic): Dynamic => !items5.includes(input2.toLowerCase()),
        ),
        items6: Dynamic = [
          callback4("href", "Destination", "string", {
            placeholder: "https://\u2026",
          }),
        ];
      value26 &&
        ((flag = target == null || target.trim().toLowerCase() === "_blank"),
        items6.push({
          prop: "@target",
          label: "Open in new tab",
          spec: {
            prop: "@target",
            label: "Open in new tab",
            editor: "bool",
            section: "advanced",
            boolOnValue: "_blank",
          },
          value: target ?? null,
          disabled: input.disabled,
          ...(value27
            ? {
                alsoCommit: [
                  {
                    prop: "@rel",
                    value: value30,
                  },
                ],
                alsoCommitOnClear: [
                  {
                    prop: "@rel",
                    value: value31.length ? value31.join(" ") : null,
                  },
                ],
              }
            : {}),
        }));
      items.push({
        id: "link",
        title: "Link",
        rows: items6,
      });
    }
    (input.tag === "video" || input.tag === "iframe") &&
      items.push({
        id: "media",
        title: input.tag === "video" ? "Video" : "Embed",
        rows: [
          callback4("src", "Source", "string", {
            placeholder: "https://\u2026",
          }),
          ...(input.tag === "video" ? [state] : []),
        ],
      });
    if (input.tag === "ul" || input.tag === "ol") {
      let value26: Dynamic = input.tag === "ol";
      items.push({
        id: "list",
        title: "List",
        rows: [
          {
            prop: "list-style-type",
            label: "Style",
            spec: {
              prop: "list-style-type",
              label: "Style",
              editor: "select",
              section: "advanced",
              options: value26
                ? [
                    "decimal",
                    "lower-alpha",
                    "lower-roman",
                    "upper-alpha",
                    "none",
                  ]
                : ["disc", "circle", "square", "none"],
              optionLabels: value26
                ? {
                    decimal: "1",
                    "lower-alpha": "a",
                    "lower-roman": "i",
                    "upper-alpha": "A",
                    none: "\u2013",
                  }
                : {
                    disc: "\u2022",
                    circle: "\u25CB",
                    square: "\u25AA",
                    none: "\u2013",
                  },
            },
            ...callback2(entries.get("list-style-type") ?? null),
            fallback: callback("list-style-type"),
            disabled: input.disabled,
          },
        ],
      });
    }
    if (input.tag === "hr") {
      let callback10: Dynamic = (
        input2?: Dynamic,
        options2?: Dynamic,
        context?: Dynamic,
        value26: Dynamic = {},
      ): Dynamic => ({
        prop: input2,
        label: options2,
        spec: {
          prop: input2,
          label: options2,
          editor: context,
          section: "border",
          ...value26,
        },
        ...callback2(entries.get(input2) ?? null),
        fallback: callback(input2),
        disabled: input.disabled,
      });
      items.push({
        id: "divider",
        title: "Divider",
        rows: [
          callback10("border-top-width", "Thickness", "number", {
            unit: "px",
            min: 0,
          }),
          callback10("border-top-color", "Color", "color"),
          callback10("border-top-style", "Style", "select", {
            options: ["solid", "dashed", "dotted", "double"],
          }),
        ],
      });
    }
    let values: Dynamic = new Set([
        "ul",
        "ol",
        "dl",
        "table",
        "thead",
        "tbody",
        "tfoot",
        "tr",
      ]),
      value2: Dynamic =
        input.text != null &&
        !values.has(input.tag) &&
        input.tag !== "textarea",
      value3: Dynamic =
        value2 && input.canvasEditable === false
          ? {
              prop: "__text",
              label: "Content",
              value: input.text,
              disabled: input.disabled,
            }
          : null,
      value4: Dynamic = runtime.svgShapeTags.has(input.tag),
      value5: Dynamic =
        (input.tag === "svg" &&
          (entries.get("fill") ?? callback("fill")) === "none") ||
        (value4 &&
          (input.attrs.fill ?? input.computed.fill ?? "").toLowerCase() ===
            "none"),
      value6: Dynamic = runtime.InspectorStyleMetadataTextTspanTextpathSet.has(
        input.tag,
      ),
      value7: Dynamic = value5 || value4 || value6,
      callback5: Dynamic = (input2?: Dynamic): Dynamic =>
        options.cssPaint?.has(input2)
          ? input2
          : (0, runtime.formatPropertyKey)(
              input2,
              (input3?: Dynamic): Dynamic => entries.get(input3),
            );
    if (input.tag === "svg") {
      let callback10: Dynamic = (
        input2?: Dynamic,
        options2?: Dynamic,
        context?: Dynamic,
      ): Dynamic => ({
        prop: input2,
        label: options2,
        spec: {
          prop: input2,
          label: options2,
          editor: context,
          section: "stroke",
          ...(context === "number"
            ? {
                unit: "px",
                min: 0,
              }
            : {}),
        },
        ...callback2(entries.get(input2) ?? null),
        fallback: callback(input2),
        disabled: input.disabled,
      });
      items.push({
        id: "svgPaint",
        title: value5 ? "Stroke" : "Fill & stroke",
        rows: [
          ...(value5 ? [] : [callback10("fill", "Fill", "color")]),
          callback10("stroke", value5 ? "Color" : "Stroke", "color"),
          callback10("stroke-width", "Thickness", "number"),
          ...(0, runtime.arrowHeadPropertyRows)(input),
        ],
      });
    }
    let value8: Dynamic =
        runtime.InspectorStyleMetadataInputTextareaButtonSet.has(input.tag),
      value9: Dynamic = (input.attrs.type ?? "text").toLowerCase(),
      value10: Dynamic =
        input.tag === "input" && (value9 === "checkbox" || value9 === "radio"),
      value11: Dynamic =
        input.tag === "input" &&
        [
          "text",
          "search",
          "email",
          "password",
          "number",
          "tel",
          "url",
          "date",
          "time",
          "datetime-local",
          "month",
          "week",
        ].includes(value9),
      values2: Dynamic = new Set();
    if (value8) {
      let callback10: Dynamic = (
          input2?: Dynamic,
          options2?: Dynamic,
          context?: Dynamic,
          value26?: Dynamic,
        ): Dynamic => (
          values2.add(input2),
          {
            prop: `@${input2}`,
            label: options2,
            spec: {
              prop: `@${input2}`,
              label: options2,
              editor: context,
              section: "advanced",
              ...(value26
                ? {
                    options: value26,
                  }
                : {}),
            },
            value: input.attrs[input2] ?? null,
            disabled: input.disabled,
          }
        ),
        items5: Dynamic = [];
      ((input.tag === "input" && !value10) || input.tag === "textarea") &&
        items5.push(callback10("placeholder", "Placeholder", "string"));
      input.tag === "input" &&
        (0, runtime.classifyStyleValue)(input.attrs.type ?? "").kind ===
          "literal" &&
        values2.add("type");
      if (value10) {
        let checked: Dynamic = input.attrs.checked,
          value26: Dynamic =
            checked == null ||
            checked === "" ||
            (0, runtime.classifyStyleValue)(checked).kind === "literal";
        value26 && values2.add("checked");
        value26 &&
          items5.push({
            prop: "@checked",
            label: "Checked",
            spec: {
              prop: "@checked",
              label: "Checked",
              editor: "bool",
              section: "advanced",
              boolOnValue: "checked",
            },
            value: "checked" in input.attrs ? "checked" : null,
            disabled: input.disabled,
          });
      } else
        input.tag === "input" &&
          items5.push(callback10("value", "Prefilled text", "string"));
      input.tag === "textarea" &&
        items5.push({
          prop: "__text",
          label: "Prefilled text",
          value: input.text,
          disabled: input.disabled,
        });
      input.tag === "button" &&
        items5.push(
          callback10("type", "Type", "select", ["button", "submit", "reset"]),
        );
      items5.length &&
        items.push({
          id: "control",
          title: "Control",
          rows: items5,
        });
    }
    let items2: Dynamic = [];
    if (runtime.svgShapeTags.has(input.tag)) {
      let callback10: Dynamic = (
          input2?: Dynamic,
          options2?: Dynamic,
          context?: Dynamic,
          value29?: Dynamic,
        ): Dynamic => {
          let value30: Dynamic = callback5(input2);
          return {
            prop: value30,
            label: options2,
            spec: {
              prop: value30,
              label: options2,
              editor: context,
              section: "stroke",
              ...(context === "number"
                ? {
                    unit: "",
                    min: 0,
                    step: 0.5,
                    scrub: 0.5,
                  }
                : {}),
              ...(value29
                ? {
                    options: value29,
                  }
                : {}),
            },
            ...(value30 === input2
              ? callback2(entries.get(input2) ?? input.attrs[input2] ?? null)
              : {
                  value: input.attrs[input2] ?? null,
                }),
            ...(options.cssPaint?.has(input2)
              ? {
                  alsoCommitOnClear: [
                    {
                      prop: `@${input2}`,
                      value: null,
                    },
                  ],
                }
              : {}),
            fallback: callback(input2),
            disabled: input.disabled,
          };
        },
        value26: Dynamic = callback2(entries.get("fill") ?? null).value,
        value27: Dynamic = value26?.includes("var(")
          ? input.computed.fill
          : (value26 ?? input.attrs.fill ?? input.computed.fill),
        value28: Dynamic = !/^none\b/i.test((value27 ?? "").trim());
      items2 = [
        callback10("stroke", value28 ? "Stroke" : "Color", "color"),
        callback10("stroke-width", "Thickness", "number"),
        ...(0, runtime.arrowHeadPropertyRows)(input),
        ...(value28 ? [callback10("fill", "Fill", "color")] : []),
        callback10("stroke-linecap", "Cap", "select", [
          "butt",
          "round",
          "square",
        ]),
      ];
      items.push({
        id: "stroke",
        title: value28 ? "Fill & stroke" : "Stroke",
        rows: items2,
      });
    }
    let value12: Dynamic = (
        entries.get("position") ||
        input.computed.position ||
        "static"
      ).toLowerCase(),
      value13: Dynamic = (
        entries.get("display") ||
        input.computed.display ||
        ""
      ).toLowerCase(),
      value14: Dynamic = value13.includes("flex"),
      value15: Dynamic = value13.includes("grid"),
      values3: Dynamic = new Set([
        "background",
        "border-radius",
        "border-top-left-radius",
        "border-top-right-radius",
        "border-bottom-right-radius",
        "border-bottom-left-radius",
        "overflow",
        "text-shadow",
        "flex-grow",
        "align-self",
        "position",
        "min-width",
        "max-width",
        "min-height",
        "max-height",
      ]),
      value16: Dynamic = (0, runtime.hasTextBackgroundClip)(
        (input2?: Dynamic): Dynamic => entries.get(input2),
      ),
      value17: Dynamic =
        !value6 &&
        (value16 ||
          (0, runtime.hasTextBackgroundClip)(
            (input2?: Dynamic): Dynamic =>
              input2 === "background-clip"
                ? input.computed.backgroundClip
                : input.computed.webkitBackgroundClip,
          )),
      value18: Dynamic = (entries.get("color") ?? "").trim().toLowerCase(),
      value19: Dynamic = value17
        ? (0, runtime.sanitizeCssBackground)(
            input.computed.backgroundImage ?? "",
          )
        : "transparent",
      value20: Dynamic =
        /^(?:repeating-)?(?:linear|radial|conic)-gradient\(/i.test(value19)
          ? value19
          : undefined,
      state2: Dynamic = {
        clipped: value17,
        inlineClip: value16,
        layer: callback2(
          entries.get("background-image") ?? entries.get("background") ?? null,
        ).value,
        ...(value20 !== undefined
          ? {
              computedLayer: value20,
            }
          : {}),
        size: entries.get("background-size") ?? null,
        ...((0, runtime.isTransparentColor)(value18)
          ? {
              transparentInk: "inline",
            }
          : (0, runtime.isTransparentColor)(
                (input.computed.color ?? "").trim().toLowerCase(),
              )
            ? {
                transparentInk: "computed",
              }
            : {}),
      },
      callback6: Dynamic = (input2?: Dynamic): Dynamic => {
        let value26: Dynamic = callback3(input2.prop);
        input2.prop === "color" &&
          (value17 ||
            (input.textual ??
              runtime.InspectorStyleMetadataSubscribers.has(input.tag))) &&
          (value26.textFill = state2);
        input2.prop === "text-shadow" &&
          value17 &&
          !value26.value &&
          ((value26.disabled = true),
          (value26.whyDisabled = runtime.InspectorStyleMetadataLabel));
        input2.prop === "width" && value11 && (value26.noHug = true);
        if (input2.prop === "backdrop-filter" && !value26.value) {
          let value27: Dynamic = callback2(
            entries.get("-webkit-backdrop-filter") ?? null,
          );
          value27.value && Object.assign(value26, value27);
        }
        if (input2.prop === "background") {
          let value27: Dynamic = callback2(
            entries.get("background-color") ?? null,
          );
          value26.companionValue = value27.value;
          value27.varSource !== undefined &&
            (value26.companionVarSource = value27.varSource);
          value26.fallback = input.computed.backgroundColor ?? "";
          value17 &&
            ((value26.disabled = true),
            (value26.whyDisabled =
              "This background fills the text \u2014 change it under Text \u203A Color"));
        }
        input2.prop === "font-style" &&
          ((value26.companionValue = callback2(
            entries.get("text-decoration-line") ?? null,
          ).value),
          (value26.companionFallback =
            input.computed.textDecorationLine ?? ""));
        if (input2.prop === "font-weight") {
          value26.companionValue = callback2(
            entries.get("font-style") ?? null,
          ).value;
          value26.companionFallback = input.computed.fontStyle ?? "";
          let value27: Dynamic =
              callback2(entries.get("font-family") ?? null).value ?? "",
            value28: Dynamic =
              (0, runtime.classifyStyleValue)(value27).kind === "literal" &&
              !/^(?:inherit|initial|unset|revert|revert-layer)\b/i.test(
                value27.trim(),
              )
                ? value27
                : "",
            value29: Dynamic = (0, runtime.firstFontFamily)(
              value28 || input.computed.fontFamily || "",
            );
          value26.faces = (0, runtime.resolveFontVariants)(
            value29,
            (0, runtime.getAvailableFontVariants)(
              input.fontFaces ?? [],
              value29,
            ),
          );
        }
        (input2.prop === "justify-content" || input2.prop === "align-items") &&
          (value26.flexDirection =
            entries.get("flex-direction") ||
            input.computed.flexDirection ||
            "row");
        value12 === "static" &&
          ["top", "left", "bottom", "right"].includes(input2.prop) &&
          (value26.alsoCommit = [
            {
              prop: "position",
              value: "relative",
            },
          ]);
        input.tag === "select" &&
          (entries.get("appearance") ?? "").trim() === "" &&
          (entries.get("-webkit-appearance") ?? "").trim() === "" &&
          (input2.prop === "background" ||
            input2.section === "border" ||
            input2.section === "borderSides") &&
          (value26.alsoCommit = [
            {
              prop: "appearance",
              value: "base-select",
            },
          ]);
        return value26;
      },
      callback7: Dynamic = (input2?: Dynamic): Dynamic =>
        runtime.InspectorPropertySchemaItems_2.filter(
          (input3?: Dynamic): Dynamic => input3.section === input2,
        ).map(callback6),
      callback8: Dynamic = (input2?: Dynamic): Dynamic =>
        !!input2 && input2.value != null && input2.value !== "",
      items3: Dynamic = [],
      callback9: Dynamic = (input2?: Dynamic): Dynamic => {
        let value26: Dynamic = Object.hasOwn(
            runtime.InspectorPropertySchemaBackgroundFontWeightFontStyleConfig,
            input2.prop,
          )
            ? runtime
                .InspectorPropertySchemaBackgroundFontWeightFontStyleConfig[
                input2.prop
              ]
            : undefined,
          value27: Dynamic =
            input2.companionValue != null &&
            input2.companionValue !== "" &&
            !(value26 && (0, runtime.getPropertySpecification)(value26));
        (callback8(input2) || value27) &&
          items3.push({
            ...input2,
            stale: true,
          });
      },
      value21: Dynamic =
        !(items.length > 0) &&
        runtime.InspectorStyleMetadataSubscribers.has(input.tag),
      value22: Dynamic = (entries.get("display") ?? "").trim().toLowerCase(),
      value23: Dynamic =
        !runtime.InspectorStyleMetadataSubscribers_2.has(input.tag) &&
        (!value21 ||
          value14 ||
          value15 ||
          value22 === "block" ||
          value22 === "flex" ||
          value22 === "grid"),
      value24: Dynamic =
        input.textual ??
        runtime.InspectorStyleMetadataSubscribers.has(input.tag),
      value25: Dynamic = value6
        ? ((input2?: Dynamic): Dynamic =>
            input2.flatMap((input3?: Dynamic): Dynamic => {
              if (
                input3.prop !== "color" &&
                !runtime.InspectorStyleMetadataLineHeightTextAlignSet.has(
                  input3.prop,
                )
              )
                return [input3];
              let state3: Dynamic = {
                ...input3,
              };
              delete state3.textFill;
              callback9(state3);
              return input3.prop !== "color"
                ? []
                : [
                    {
                      prop: "fill",
                      label: "Color",
                      spec: {
                        prop: "fill",
                        label: "Color",
                        editor: "color",
                        section: "typography",
                      },
                      ...callback2(entries.get("fill") ?? null),
                      fallback: callback("fill"),
                      disabled: input.disabled,
                    },
                  ];
            }))(callback7("typography"))
        : value7 || value10
          ? []
          : callback7("typography");
    if (
      (!value7 || value6) &&
      !value10 &&
      (value21 ||
        value6 ||
        value24 ||
        value2 ||
        (value8 && input.tag !== "button") ||
        (input.tag === "hr" ? false : value25.some(callback8)))
    ) {
      let state3: Dynamic = {
        id: "text",
        title: "Text",
        rows: [...(value3 ? [value3] : []), ...value25],
      };
      value21 ? items.unshift(state3) : items.push(state3);
    } else
      for (let value26 of callback7("typography") as Dynamic)
        callback9(value26);
    {
      let value26: Dynamic = callback7("sizing"),
        value27: Dynamic =
          value7 ||
          (input.tag === "hr" && !callback7("padding").some(callback8))
            ? value7
              ? []
              : callback7("margin")
            : [...callback7("padding"), ...callback7("margin")];
      if (value7)
        for (let value38 of [
          ...callback7("padding"),
          ...callback7("margin"),
        ] as Dynamic)
          callback9(value38);
      let value28: Dynamic = callback7("position"),
        entries2: Dynamic = new Map(
          [...value26, ...value28].map(
            (input2?: Dynamic): Dynamic => [input2.prop, input2],
          ),
        ),
        value29: Dynamic = value26.filter(
          (input2?: Dynamic): Dynamic =>
            input2.prop === "width" || input2.prop === "height",
        ),
        value30: Dynamic = value26.filter(
          (input2?: Dynamic): Dynamic => /^(min|max)-/.test(input2.prop),
        ),
        value31: Dynamic = callback7("layout"),
        items5: Dynamic = [],
        value32: Dynamic;
      if (value23) {
        let entries3: Dynamic = new Map(
          value31.map((input2?: Dynamic): Dynamic => [input2.prop, input2]),
        );
        value32 = value15 ? "grid" : value14 ? "flex" : "block";
        let entry: Dynamic = entries3.get("display");
        callback8(entry) &&
          !(entry.spec?.options ?? []).includes(
            entry.value.trim().toLowerCase(),
          ) &&
          (callback9({
            ...entry,
            label: "Display",
          }),
          (entry = {
            ...entry,
            value: null,
            fallback: entry.value,
            varSource: undefined,
          }));
        let value38: Dynamic =
            value32 === "flex"
              ? [entries3.get("flex-direction"), entries3.get("flex-wrap")]
              : value32 === "grid"
                ? [
                    entries3.get("grid-template-columns"),
                    entries3.get("grid-template-rows"),
                  ]
                : [],
          callback10: Dynamic = (input2?: Dynamic): Dynamic => ({
            ...input2,
            spec: {
              ...input2.spec,
              longTail: true,
            },
          }),
          value39: Dynamic =
            value32 === "block"
              ? []
              : value32 === "grid"
                ? [
                    entries3.get("gap"),
                    callback10(entries3.get("justify-items")),
                    callback10(entries3.get("align-items")),
                  ]
                : [
                    entries3.get("justify-content"),
                    entries3.get("align-items"),
                    entries3.get("gap"),
                  ];
        items5.push(entry, ...value38, ...value39);
        for (let value40 of value31 as Dynamic)
          value40.prop !== "display" &&
            !items5.some(
              (input2?: Dynamic): Dynamic => input2.prop === value40.prop,
            ) &&
            callback9(value40);
      } else
        for (let value38 of value31 as Dynamic)
          callback9(
            value38.prop === "display"
              ? {
                  ...value38,
                  label: "Display",
                }
              : value38,
          );
      let value33: Dynamic = (input.parentDisplay ?? "").toLowerCase(),
        value34: Dynamic =
          input.parentDisplay === undefined || value33.includes("flex"),
        value35: Dynamic = value33.includes("grid")
          ? ["grid-column", "grid-row"]
          : value34
            ? ["flex-grow"]
            : [];
      for (let value38 of [
        "align-self",
        "flex-grow",
        "grid-column",
        "grid-row",
        "justify-self",
      ] as Dynamic)
        value35.includes(value38) || callback9(entries2.get(value38));
      let value36: Dynamic = value27.filter(
          (input2?: Dynamic): Dynamic => input2.prop.startsWith("padding-"),
        ),
        value37: Dynamic = value27.filter(
          (input2?: Dynamic): Dynamic => input2.prop.startsWith("margin-"),
        ),
        items6: Dynamic = [
          ...value29,
          ...value30,
          entries2.get("position"),
          entries2.get("top"),
          entries2.get("left"),
          entries2.get("bottom"),
          entries2.get("right"),
          ...value35.map((input2?: Dynamic): Dynamic => entries2.get(input2)),
        ],
        items7: Dynamic = [...items5, ...value36, ...value37];
      if (
        value7 &&
        ((items7 = items7.filter(
          (input2?: Dynamic): Dynamic =>
            callback8(input2) || !values3.has(input2.prop),
        )),
        (items6 = items6
          .map(
            (input2?: Dynamic): Dynamic =>
              input2.prop === "width" || input2.prop === "height"
                ? {
                    ...input2,
                    spec: {
                      ...input2.spec,
                      editor: "number",
                      unit: "px",
                    },
                  }
                : input2,
          )
          .filter(
            (input2?: Dynamic): Dynamic =>
              input2.prop === input.hiddenSizingAxis
                ? false
                : callback8(input2)
                  ? true
                  : !values3.has(input2.prop),
          )),
        value4 || value6)
      ) {
        let callback10: Dynamic = (input2?: Dynamic): Dynamic =>
          !callback8(input2);
        if (options.forMulti) items6.every(callback10) && (items6 = []);
        else
          for (let value38 of ["sizing", "position"] as Dynamic) {
            let callback11: Dynamic = (input2?: Dynamic): Dynamic =>
              (input2.spec?.section === "position" ? "position" : "sizing") ===
              value38;
            items6.filter(callback11).every(callback10) &&
              (items6 = items6.filter(
                (input2?: Dynamic): Dynamic => !callback11(input2),
              ));
          }
      }
      items6.length > 0 &&
        items.push({
          id: "size",
          title: "Size",
          rows: items6,
        });
      items7.length > 0 &&
        items.push({
          id: "sizing",
          title: "Layout",
          rows: items7,
          ...(value32 !== undefined
            ? {
                mode: value32,
              }
            : {}),
        });
    }
    {
      let value26: Dynamic =
        input.tag === "hr"
          ? []
          : [...callback7("border"), ...callback7("borderSides")];
      if (input.tag === "hr")
        for (let value27 of [
          ...callback7("border"),
          ...callback7("borderSides"),
        ] as Dynamic)
          value27.prop !== "border-top-width" && callback9(value27);
      let items5: Dynamic = [
        ...callback7("appearance"),
        ...callback7("radius"),
        ...value26,
      ];
      value7 &&
        (items5 = items5.filter((input2?: Dynamic): Dynamic => {
          if (callback8(input2)) return true;
          let value27: Dynamic =
            input2.spec?.section !== "border" &&
            input2.spec?.section !== "borderSides" &&
            !values3.has(input2.prop);
          value27 ||
            callback9({
              ...input2,
              label: input2.prop,
            });
          return value27;
        }));
      (items5.length > 0 || !value7) &&
        items.push({
          id: "appearance",
          title: "Appearance",
          rows: items5,
        });
    }
    {
      let value26: Dynamic = callback7("effects");
      value7 &&
        !value6 &&
        (value26 = value26.filter(
          (input2?: Dynamic): Dynamic =>
            callback8(input2) || !values3.has(input2.prop),
        ));
      let computed: Dynamic = input.computed,
        value27: Dynamic =
          [
            ...(value17
              ? []
              : [computed.backgroundColor, computed.backgroundImage]),
            computed.borderTopWidth,
            computed.borderRightWidth,
            computed.borderBottomWidth,
            computed.borderLeftWidth,
          ].some(runtime.hasVisiblePaint) ||
          [...entries].some(
            ([input2, input3]: Dynamic): Dynamic =>
              runtime.InspectorStyleMetadataBackgroundColorPattern.test(
                input2,
              ) &&
              !(value17 && /^background(?:-color|-image)?$/.test(input2)) &&
              (0, runtime.hasVisiblePaint)(callback2(input3).value),
          ),
        value28: Dynamic = input.textLeaf ?? input.text != null,
        value29: Dynamic =
          value6 ||
          (value24 &&
            value28 &&
            !value7 &&
            !value27 &&
            (input.rendered ?? true)),
        value30: Dynamic =
          value29 && value17 ? runtime.InspectorStyleMetadataLabel : undefined,
        callback10: Dynamic = (input2?: Dynamic): Dynamic =>
          value4 &&
          !options.forMulti &&
          (input2.prop === "box-shadow" || input2.prop === "backdrop-filter");
      value26.filter(callback10).forEach(callback9);
      items.push({
        id: "effects",
        title: "Effects",
        rows: value26.filter(
          (input2?: Dynamic): Dynamic => !callback10(input2),
        ),
        ...(value29
          ? {
              shadowTarget: "text",
              ...(value30
                ? {
                    dropShadowReason: value30,
                  }
                : {}),
            }
          : {}),
        ...(value4
          ? {
              shadowTarget: "shape",
            }
          : {}),
      });
    }
    let values4: Dynamic = new Set(
      runtime.InspectorPropertySchemaItems_2.map(
        (input2?: Dynamic): Dynamic => input2.prop,
      ),
    );
    for (let value26 of Object.values(
      runtime.InspectorPropertySchemaBackgroundFontWeightFontStyleConfig,
    ) as Dynamic)
      values4.add(value26);
    if (value17)
      for (let value26 of runtime.InspectorPropertySchemaItems as Dynamic)
        values4.add(value26);
    (input.tag === "img" || input.tag === "video") && values4.add("object-fit");
    value8 && values4.add("appearance");
    input.tag === "svg" &&
      (values4.add("fill"), values4.add("stroke"), values4.add("stroke-width"));
    for (let value26 of items2 as Dynamic)
      value26.prop.startsWith("@") || values4.add(value26.prop);
    value6 && values4.add("fill");
    (input.tag === "ul" || input.tag === "ol") &&
      values4.add("list-style-type");
    if (input.tag === "hr")
      for (let value26 of [
        "border-top-width",
        "border-top-color",
        "border-top-style",
      ] as Dynamic)
        values4.add(value26);
    let values5: Dynamic = new Set(
        runtime.InspectorPropertySchemaCursorPointerEventsObjectFitValues,
      ),
      items4: Dynamic = [
        ...items3,
        ...callback7("advanced").filter(
          (input2?: Dynamic): Dynamic =>
            !(value7 && !value6 && input2.prop === "overflow"),
        ),
      ];
    for (let value26 of value as Dynamic)
      values4.has(value26.prop) ||
        values5.has(value26.prop) ||
        items4.push({
          prop: value26.prop,
          label: value26.prop,
          ...callback2(value26.value),
          fallback: callback(value26.prop),
          disabled: input.disabled,
        });
    for (let value26 of runtime.InspectorPropertySchemaCursorPointerEventsObjectFitValues as Dynamic)
      values4.has(value26) ||
        items4.push({
          prop: value26,
          label: value26,
          ...callback2(entries.get(value26) ?? null),
          fallback: callback(value26),
          disabled: input.disabled,
        });
    let values6: Dynamic = new Set(
      runtime.svgShapeTags.has(input.tag)
        ? runtime.InspectorStyleMetadataStrokeStrokeWidthFillValues.filter(
            (input2?: Dynamic): Dynamic => !entries.has(input2),
          )
        : input.tag === "svg"
          ? ["preserveAspectRatio"]
          : input.tag === "a"
            ? ["href", ...(flag ? ["target"] : [])]
            : input.tag === "video" || input.tag === "iframe"
              ? ["src"]
              : [],
    );
    for (let [value26, value27] of Object.entries(input.attrs) as Dynamic)
      runtime.InspectorStyleMetadataDataDcTplStyleSet.has(value26) ||
        (input.tag === "img" && value26 === "src") ||
        values2.has(value26) ||
        values6.has(value26) ||
        items4.push({
          prop: `@${value26}`,
          label:
            (value4 || value6) && entries.has(value26)
              ? `@${value26}`
              : value26,
          value: value27,
          disabled: input.disabled,
        });
    (0, runtime.orderInspectorSections)(items);
    (0, runtime.resolveInspectorInheritedValues)(
      items,
      items4,
      input.classSources,
      entries,
    );
    return {
      sections: items,
      advanced: items4,
    };
  }
  bindRuntimeValue(runtime, "getElementInspector", () => getElementInspector);
  return () => {};
}
