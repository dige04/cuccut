/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorSvgLayout(runtime: RuntimeBindings): () => void {
  var SvgLayoutStrokeStrokeWidthStrokeLinecapValues: Dynamic;
  var SvgLayoutStrokeWidthStrokeDasharrayStrokeDashoffsetSet: Dynamic;
  var SvgLayoutDX1Y1Set: Dynamic;
  var SvgLayoutReplace: Dynamic;
  var SvgLayoutAttributes: Dynamic;
  var svgHasDefs: Dynamic;
  var SvgLayoutStrokeStrokeWidthStrokeLinecapConfig: Dynamic;
  function setCaseSensitiveModelAttribute(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = input.element(options);
    value2?.removeAttribute(context);
    value2?.removeAttribute(context.toLowerCase());
    input.setAttribute(options, context, value);
  }
  function setModelElementRect(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    input.setStyleProperty(options, "left", `${context.left}px`);
    input.setStyleProperty(options, "top", `${context.top}px`);
    input.setStyleProperty(options, "width", `${context.width}px`);
    input.setStyleProperty(options, "height", `${context.height}px`);
    input.setAttribute(options, "width", String(context.width));
    input.setAttribute(options, "height", String(context.height));
    setCaseSensitiveModelAttribute(
      input,
      options,
      "viewBox",
      `0 0 ${context.width} ${context.height}`,
    );
  }
  function normalizeSvgElementSizing(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    SvgLayoutAttributes(input, options, "preserveAspectRatio") !== "none" &&
      setCaseSensitiveModelAttribute(
        input,
        options,
        "preserveAspectRatio",
        "none",
      );
    !svgHasDefs(input, options) &&
      input.inlineStyleValue(options, "fill") !== "none" &&
      input.setStyleProperty(options, "fill", "none");
    input.inlineStyleValue(options, "overflow") === "" &&
      input.setStyleProperty(options, "overflow", "visible");
  }
  function scaleSvgLengthList(input?: Dynamic, options?: Dynamic): Dynamic {
    return /^[\d.\s,px]+$/.test(input)
      ? input.replace(
          /\d*\.?\d+/g,
          (input2?: Dynamic): Dynamic =>
            String(Math.round(parseFloat(input2) * options * 100) / 100),
        )
      : input;
  }
  function copySvgStrokeProperties(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value: Dynamic = 1,
    extra: Dynamic = {},
    detail: Dynamic = {},
    argument: Dynamic = false,
  ): Dynamic {
    let value2: Dynamic = svgHasDefs(input, context),
      value3: Dynamic = value2 ? options : context,
      value4: Dynamic =
        input.attribute(options, "vector-effect") === "non-scaling-stroke" ||
        extra["vector-effect"] === "non-scaling-stroke"
          ? 1
          : value,
      value5: Dynamic =
        input.attribute(options, "class") == null &&
        input.attribute(options, "id") == null,
      value6: Dynamic = !value2 || value5;
    if (value4 !== 1 && !value2)
      for (let value7 of SvgLayoutStrokeWidthStrokeDasharrayStrokeDashoffsetSet as Dynamic) {
        let value8: Dynamic = input.inlineStyleValue(context, value7);
        value8 &&
          input.setStyleProperty(
            context,
            value7,
            scaleSvgLengthList(value8, value4),
          );
        let value9: Dynamic = input.attribute(context, value7);
        value9 != null &&
          input.setAttribute(
            context,
            value7,
            scaleSvgLengthList(value9, value4),
          );
      }
    for (let value7 of SvgLayoutStrokeStrokeWidthStrokeLinecapValues as Dynamic) {
      let value8: Dynamic = input.inlineStyleValue(options, value7),
        value9: Dynamic = input.attribute(options, value7),
        value10: Dynamic = value8 || value9 || "",
        value11: Dynamic =
          SvgLayoutStrokeWidthStrokeDasharrayStrokeDashoffsetSet.has(value7) &&
          value4 !== 1,
        value12: Dynamic = value10,
        value13: Dynamic = value3,
        value14: Dynamic =
          input.inlineStyleValue(context, value7) ||
          input.attribute(context, value7) ||
          "";
      if (
        SvgLayoutStrokeWidthStrokeDasharrayStrokeDashoffsetSet.has(value7) &&
        value8 &&
        !value9 &&
        !argument
      ) {
        value11 &&
          input.setStyleProperty(
            options,
            value7,
            scaleSvgLengthList(value8, value4),
          );
        continue;
      }
      let value15: Dynamic = extra[value7] === detail[value7],
        value16: Dynamic = !value2 && (argument ? value5 : value5 && value15);
      if (
        !value10 &&
        value11 &&
        extra[value7] &&
        (value7 === "stroke-width" ||
          extra[value7] !==
            SvgLayoutStrokeStrokeWidthStrokeLinecapConfig[value7])
      ) {
        if (value16 && value14 && value15) continue;
        value12 = extra[value7];
        value13 = value16 ? context : options;
      } else
        !value10 && value11 && value2 && value14
          ? ((value12 = value14), (value13 = options))
          : !value10 &&
            argument &&
            value6 &&
            extra[value7] &&
            extra[value7] !== detail[value7] &&
            extra[value7] !==
              SvgLayoutStrokeStrokeWidthStrokeLinecapConfig[value7] &&
            (value12 = extra[value7]);
      if (
        !value12 ||
        /[;{}<>]/.test(value12) ||
        (value2 && value10 && !value11)
      )
        continue;
      let value17: Dynamic = value11
        ? scaleSvgLengthList(value12, value4)
        : value12;
      input.setStyleProperty(value13, value7, value17);
      value13 !== options
        ? (value8 && input.setStyleProperty(options, value7, null),
          value9 != null && input.setAttribute(options, value7, null))
        : value9 != null &&
          !value8 &&
          input.setAttribute(options, value7, null);
    }
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
      !!input.inlineStyleValue(input2, "stroke-width") ||
      input.attribute(input2, "stroke-width") != null;
    value4 !== 1 &&
      !extra["stroke-width"] &&
      !callback(options) &&
      !callback(context) &&
      input.setStyleProperty(
        value3,
        "stroke-width",
        String(Math.round(value4 * 100) / 100),
      );
  }
  function setSvgLineEndpoints(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
    detail?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = input.tagName(options);
    value2 === "line"
      ? (input.setAttribute(options, "x1", String(context)),
        input.setAttribute(options, "y1", String(value)),
        input.setAttribute(options, "x2", String(extra)),
        input.setAttribute(options, "y2", String(detail)))
      : value2 === "polyline"
        ? input.setAttribute(
            options,
            "points",
            `${context},${value} ${extra},${detail}`,
          )
        : input.setAttribute(
            options,
            "d",
            `M ${context} ${value} L ${extra} ${detail}`,
          );
  }
  function resizeSvgArrow(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value: Dynamic = 1,
    extra: Dynamic = {},
    detail: Dynamic = {},
    argument: Dynamic = {},
  ): Dynamic {
    let value2: Dynamic = input.element(options),
      value3: Dynamic = value2 ? (0, runtime.inspectSvgArrow)(value2) : null;
    if (!value3) return null;
    let value4: Dynamic = parseInt(
        value3.shaft.getAttribute(runtime.DcTplAttribute) ?? "-1",
        10,
      ),
      value5: Dynamic =
        [
          value4 >= 0
            ? input.inlineStyleValue(value4, "stroke") ||
              input.attribute(value4, "stroke")
            : "",
          input.inlineStyleValue(options, "stroke") ||
            input.attribute(options, "stroke"),
          extra.stroke,
        ].find(
          (input2?: Dynamic): Dynamic =>
            (0, runtime.normalizeSvgPaint)(input2) != null,
        ) ?? "";
    normalizeSvgElementSizing(input, options);
    let value6: Dynamic = value3.tag === "path" && !value3.legacy;
    value4 >= 0 &&
      copySvgStrokeProperties(
        input,
        value4,
        options,
        value,
        extra,
        detail,
        !value6,
      );
    if (value4 >= 0 && value6) {
      input.setAttribute(value4, "d", context);
      return {
        restamped: false,
      };
    }
    let value7: Dynamic = [...value3.shaft.attributes]
        .filter(
          (input2?: Dynamic): Dynamic =>
            input2.name !== runtime.DcTplAttribute &&
            input2.name !== "style" &&
            !SvgLayoutDX1Y1Set.has(input2.name),
        )
        .map(
          (input2?: Dynamic): Dynamic =>
            ` ${input2.name}="${SvgLayoutReplace(input2.value)}"`,
        )
        .join(""),
      value8: Dynamic = value3.shaft.getAttribute("style") ?? "",
      value9: Dynamic =
        value4 >= 0
          ? input
              .childTids(value4)
              .map(
                (input2?: Dynamic): Dynamic => input.subtreeHtml(input2) ?? "",
              )
              .join("")
          : "",
      value10: Dynamic = input
        .childTids(options)
        .filter((input2?: Dynamic): Dynamic => input2 !== value4)
        .map((input2?: Dynamic): Dynamic => input.subtreeHtml(input2) ?? "")
        .join(""),
      value11: Dynamic = value3.legacy
        ? (argument.heads ?? {
            start: "none",
            end: runtime.OpenValue,
          })
        : {
            start: "none",
            end: "none",
          },
      value12: Dynamic = ["start", "end"]
        .filter((input2?: Dynamic): Dynamic => value11[input2] !== "none")
        .map(
          (input2?: Dynamic): Dynamic => ({
            end: input2,
            kind: value11[input2],
            id: (0, runtime.createArrowHeadId)(value11[input2]),
          }),
        );
    input.setInnerHtml(
      options,
      (value12.length > 0
        ? `<defs>${value12.map((source?: Dynamic): Dynamic => (0, runtime.arrowHeadMarkerHtml)(source.id, source.kind, source.end, value5)).join("")}</defs>`
        : "") +
        value10 +
        `<path d="${context}"${value12.map((input2?: Dynamic): Dynamic => ` marker-${input2.end}="url(#${input2.id})"`).join("")}${value7}${value8 ? ` style="${SvgLayoutReplace(value8)}"` : ""}>${value9}</path>`,
    );
    argument.restamp !== false && input.restamp();
    return {
      restamped: argument.restamp !== false,
    };
  }
  bindRuntimeValue(
    runtime,
    "SvgLayoutStrokeStrokeWidthStrokeLinecapValues",
    () => SvgLayoutStrokeStrokeWidthStrokeLinecapValues,
    (value) => {
      SvgLayoutStrokeStrokeWidthStrokeLinecapValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SvgLayoutStrokeWidthStrokeDasharrayStrokeDashoffsetSet",
    () => SvgLayoutStrokeWidthStrokeDasharrayStrokeDashoffsetSet,
    (value) => {
      SvgLayoutStrokeWidthStrokeDasharrayStrokeDashoffsetSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SvgLayoutDX1Y1Set",
    () => SvgLayoutDX1Y1Set,
    (value) => {
      SvgLayoutDX1Y1Set = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SvgLayoutReplace",
    () => SvgLayoutReplace,
    (value) => {
      SvgLayoutReplace = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SvgLayoutAttributes",
    () => SvgLayoutAttributes,
    (value) => {
      SvgLayoutAttributes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setCaseSensitiveModelAttribute",
    () => setCaseSensitiveModelAttribute,
  );
  bindRuntimeValue(runtime, "setModelElementRect", () => setModelElementRect);
  bindRuntimeValue(
    runtime,
    "normalizeSvgElementSizing",
    () => normalizeSvgElementSizing,
  );
  bindRuntimeValue(
    runtime,
    "svgHasDefs",
    () => svgHasDefs,
    (value) => {
      svgHasDefs = value;
    },
  );
  bindRuntimeValue(runtime, "scaleSvgLengthList", () => scaleSvgLengthList);
  bindRuntimeValue(
    runtime,
    "SvgLayoutStrokeStrokeWidthStrokeLinecapConfig",
    () => SvgLayoutStrokeStrokeWidthStrokeLinecapConfig,
    (value) => {
      SvgLayoutStrokeStrokeWidthStrokeLinecapConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "copySvgStrokeProperties",
    () => copySvgStrokeProperties,
  );
  bindRuntimeValue(runtime, "setSvgLineEndpoints", () => setSvgLineEndpoints);
  bindRuntimeValue(runtime, "resizeSvgArrow", () => resizeSvgArrow);
  return () => {
    SvgLayoutStrokeStrokeWidthStrokeLinecapValues = [
      "stroke",
      "stroke-width",
      "stroke-linecap",
      "stroke-linejoin",
      "stroke-dasharray",
      "stroke-dashoffset",
      "stroke-opacity",
      "stroke-miterlimit",
    ];
    SvgLayoutStrokeWidthStrokeDasharrayStrokeDashoffsetSet = new Set([
      "stroke-width",
      "stroke-dasharray",
      "stroke-dashoffset",
    ]);
    SvgLayoutDX1Y1Set = new Set(["d", "x1", "y1", "x2", "y2", "points"]);
    SvgLayoutReplace = (input?: Dynamic): Dynamic =>
      input
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;");
    SvgLayoutAttributes = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
    ): Dynamic => input.attributes(options)[context] ?? null;
    svgHasDefs = (input?: Dynamic, options?: Dynamic): Dynamic =>
      input
        .childTids(options)
        .some((input2?: Dynamic): Dynamic => input.tagName(input2) === "defs");
    SvgLayoutStrokeStrokeWidthStrokeLinecapConfig = {
      stroke: "none",
      "stroke-width": "1px",
      "stroke-linecap": "butt",
      "stroke-linejoin": "miter",
      "stroke-dasharray": "none",
      "stroke-dashoffset": "0px",
      "stroke-opacity": "1",
      "stroke-miterlimit": "4",
    };
  };
}
