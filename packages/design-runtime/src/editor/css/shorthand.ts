/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorCssShorthand(
  runtime: RuntimeBindings,
): () => void {
  var CssShorthandTopRightBottomValues: Dynamic;
  var CssShorthandTopLeftTopRightBottomRightValues: Dynamic;
  var CssShorthandNoneHiddenDottedSet: Dynamic;
  var CssShorthandBorderBorderWidthBorderStyleSet: Dynamic;
  var CssShorthandTextDecorationLineTextDecorationStyleTextDecorationColorConfig: Dynamic;
  function expandCssSides(items?: Dynamic): Dynamic {
    if (items.length === 0 || items.length > 4) return null;
    let [value, value2 = value, value3 = value, value4 = value2]: Dynamic =
      items;
    return [value, value2, value3, value4];
  }
  function expandCssShorthand(input?: Dynamic): Dynamic {
    let { prop: value, value: value2 }: Dynamic = input;
    if ((0, runtime.classifyStyleValue)(value2).kind !== "literal") return null;
    let value3: Dynamic = (0, runtime.splitCssTokens)(value2, " ")
      .map((input2?: Dynamic): Dynamic => input2.trim())
      .filter(Boolean);
    switch (value) {
      case "margin":
      case "padding":
      case "inset": {
        let value4: Dynamic = expandCssSides(value3);
        if (!value4) return null;
        let value5: Dynamic = value === "inset" ? "" : `${value}-`;
        return CssShorthandTopRightBottomValues.map(
          (input2?: Dynamic, options?: Dynamic): Dynamic => ({
            prop: value === "inset" ? input2 : `${value5}${input2}`,
            value: value4[options],
          }),
        );
      }
      case "border-width": {
        if (value3.length < 2) return null;
        let value4: Dynamic = expandCssSides(value3);
        return value4
          ? CssShorthandTopRightBottomValues.map(
              (input2?: Dynamic, options?: Dynamic): Dynamic => ({
                prop: `border-${input2}-width`,
                value: value4[options],
              }),
            )
          : null;
      }
      case "border-radius": {
        if (value2.includes("/") || value3.length < 2) return null;
        let value4: Dynamic = expandCssSides(value3);
        return value4
          ? CssShorthandTopLeftTopRightBottomRightValues.map(
              (input2?: Dynamic, options?: Dynamic): Dynamic => ({
                prop: `border-${input2}-radius`,
                value: value4[options],
              }),
            )
          : null;
      }
      case "border": {
        let items: Dynamic = [];
        for (let value4 of value3 as Dynamic)
          CssShorthandNoneHiddenDottedSet.has(value4.toLowerCase())
            ? items.push({
                prop: "border-style",
                value: value4,
              })
            : (0, runtime.parseCssNumber)(value4) ||
                ["thin", "medium", "thick"].includes(value4.toLowerCase())
              ? items.push({
                  prop: "border-width",
                  value: value4,
                })
              : items.push({
                  prop: "border-color",
                  value: value4,
                });
        return items.length ? items : null;
      }
      case "border-top":
      case "border-right":
      case "border-bottom":
      case "border-left": {
        let items: Dynamic = [];
        for (let value4 of value3 as Dynamic)
          CssShorthandNoneHiddenDottedSet.has(value4.toLowerCase())
            ? items.push({
                prop: `${value}-style`,
                value: value4,
              })
            : (0, runtime.parseCssNumber)(value4) ||
                ["thin", "medium", "thick"].includes(value4.toLowerCase())
              ? items.push({
                  prop: `${value}-width`,
                  value: value4,
                })
              : items.push({
                  prop: `${value}-color`,
                  value: value4,
                });
        return items.length ? items : null;
      }
      case "list-style": {
        let items: Dynamic = [];
        for (let value4 of value3 as Dynamic) {
          let value5: Dynamic = value4.toLowerCase();
          value5 === "inside" || value5 === "outside"
            ? items.push({
                prop: "list-style-position",
                value: value4,
              })
            : /^url\(/i.test(value4)
              ? items.push({
                  prop: "list-style-image",
                  value: value4,
                })
              : items.push({
                  prop: "list-style-type",
                  value: value4,
                });
        }
        return items.length ? items : null;
      }
      case "text-decoration": {
        let values: Dynamic = new Set([
            "none",
            "underline",
            "overline",
            "line-through",
          ]),
          values2: Dynamic = new Set([
            "solid",
            "double",
            "dotted",
            "dashed",
            "wavy",
          ]),
          items: Dynamic = [],
          items2: Dynamic = [];
        for (let value4 of value3 as Dynamic) {
          let value5: Dynamic = value4.toLowerCase();
          values.has(value5)
            ? items.push(value5)
            : values2.has(value5)
              ? items2.push({
                  prop: "text-decoration-style",
                  value: value4,
                })
              : (0, runtime.parseCssNumber)(value4) ||
                  value5 === "auto" ||
                  value5 === "from-font"
                ? items2.push({
                    prop: "text-decoration-thickness",
                    value: value4,
                  })
                : items2.push({
                    prop: "text-decoration-color",
                    value: value4,
                  });
        }
        items.length &&
          items2.unshift({
            prop: "text-decoration-line",
            value: items.join(" "),
          });
        return items2.length ? items2 : null;
      }
      default:
        return null;
    }
  }
  function expandShorthandForProperty(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = false,
  ): Dynamic {
    options = (0, runtime.normalizeCssProperty)(options);
    let value: Dynamic = (
      CssShorthandTextDecorationLineTextDecorationStyleTextDecorationColorConfig[
        options
      ] ?? []
    ).filter(
      (input2?: Dynamic): Dynamic =>
        context || !CssShorthandBorderBorderWidthBorderStyleSet.has(input2),
    );
    if (value.length === 0 || !input) return input ?? "";
    let value2: Dynamic = (0, runtime.parseStyleDeclarations)(input),
      flag: Dynamic = false;
    for (let value3 of value as Dynamic)
      value2.some((input2?: Dynamic): Dynamic => input2.prop === value3) &&
        (value2 = value2.flatMap((input2?: Dynamic): Dynamic => {
          if (input2.prop !== value3) return [input2];
          let value4: Dynamic = expandCssShorthand(input2);
          value4 && (flag = true);
          return value4 ?? [input2];
        }));
    return flag &&
      context &&
      !value2.some((input2?: Dynamic): Dynamic => input2.prop === options)
      ? input
      : flag
        ? (0, runtime.serializeStyleDeclarations)(value2)
        : input;
  }
  function expandCssDeclarations(input?: Dynamic): Dynamic {
    let items: Dynamic = [];
    for (let value of input as Dynamic) {
      let value2: Dynamic = expandCssShorthand(value);
      value2 ? items.push(...value2) : items.push(value);
    }
    return items;
  }
  bindRuntimeValue(
    runtime,
    "CssShorthandTopRightBottomValues",
    () => CssShorthandTopRightBottomValues,
    (value) => {
      CssShorthandTopRightBottomValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CssShorthandTopLeftTopRightBottomRightValues",
    () => CssShorthandTopLeftTopRightBottomRightValues,
    (value) => {
      CssShorthandTopLeftTopRightBottomRightValues = value;
    },
  );
  bindRuntimeValue(runtime, "expandCssSides", () => expandCssSides);
  bindRuntimeValue(
    runtime,
    "CssShorthandNoneHiddenDottedSet",
    () => CssShorthandNoneHiddenDottedSet,
    (value) => {
      CssShorthandNoneHiddenDottedSet = value;
    },
  );
  bindRuntimeValue(runtime, "expandCssShorthand", () => expandCssShorthand);
  bindRuntimeValue(
    runtime,
    "CssShorthandBorderBorderWidthBorderStyleSet",
    () => CssShorthandBorderBorderWidthBorderStyleSet,
    (value) => {
      CssShorthandBorderBorderWidthBorderStyleSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CssShorthandTextDecorationLineTextDecorationStyleTextDecorationColorConfig",
    () =>
      CssShorthandTextDecorationLineTextDecorationStyleTextDecorationColorConfig,
    (value) => {
      CssShorthandTextDecorationLineTextDecorationStyleTextDecorationColorConfig =
        value;
    },
  );
  bindRuntimeValue(
    runtime,
    "expandShorthandForProperty",
    () => expandShorthandForProperty,
  );
  bindRuntimeValue(
    runtime,
    "expandCssDeclarations",
    () => expandCssDeclarations,
  );
  return () => {
    CssShorthandTopRightBottomValues = ["top", "right", "bottom", "left"];
    CssShorthandTopLeftTopRightBottomRightValues = [
      "top-left",
      "top-right",
      "bottom-right",
      "bottom-left",
    ];
    CssShorthandNoneHiddenDottedSet = new Set([
      "none",
      "hidden",
      "dotted",
      "dashed",
      "solid",
      "double",
      "groove",
      "ridge",
      "inset",
      "outset",
    ]);
    CssShorthandBorderBorderWidthBorderStyleSet = new Set([
      "border",
      "border-width",
      "border-style",
      "border-color",
      "border-radius",
    ]);
    CssShorthandTextDecorationLineTextDecorationStyleTextDecorationColorConfig =
      {
        "text-decoration-line": ["text-decoration"],
        "text-decoration-style": ["text-decoration"],
        "text-decoration-color": ["text-decoration"],
        "text-decoration-thickness": ["text-decoration"],
        "border-width": ["border"],
        "border-style": ["border"],
        "border-color": ["border"],
        ...Object.fromEntries(
          ["top", "right", "bottom", "left"].flatMap(
            (input?: Dynamic): Dynamic =>
              ["width", "style", "color"].map(
                (input2?: Dynamic): Dynamic => [
                  `border-${input}-${input2}`,
                  ["border", `border-${input2}`, `border-${input}`],
                ],
              ),
          ),
        ),
        ...Object.fromEntries(
          CssShorthandTopLeftTopRightBottomRightValues.map(
            (input?: Dynamic): Dynamic => [
              `border-${input}-radius`,
              ["border-radius"],
            ],
          ),
        ),
        "list-style-type": ["list-style"],
        "list-style-position": ["list-style"],
        "list-style-image": ["list-style"],
      };
  };
}
