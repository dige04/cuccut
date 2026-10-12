/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorLayoutGrouping(
  runtime: RuntimeBindings,
): () => void {
  var LayoutGroupingAbs: Dynamic;
  var LayoutGroupingHandler: Dynamic;
  var LayoutGroupingMarginTopMarginRightMarginBottomValues: Dynamic;
  var LayoutGroupingInsetInlineInsetBlockInsetInlineStartValues: Dynamic;
  function normalizeGroupedLayoutConstraints(input?: Dynamic): Dynamic {
    if (input === null || typeof input != "object") return null;
    let value: Dynamic = input,
      items: Dynamic = [
        "widthAuto",
        "heightAuto",
        "widthPercent",
        "heightPercent",
        "left",
        "right",
        "top",
        "bottom",
        "marginAuto",
      ];
    return items.every(
      (input2?: Dynamic): Dynamic => typeof value[input2] == "boolean",
    )
      ? Object.fromEntries(
          items.map(
            (input2?: Dynamic): Dynamic => [input2, value[input2] === true],
          ),
        )
      : null;
  }
  function normalizeGroupLayoutCapture(
    items?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    return !Array.isArray(items) || items.length !== options
      ? null
      : items.map((input?: Dynamic): Dynamic => {
          if (input === null || typeof input != "object") return null;
          let value: Dynamic = input,
            [items2, items3, items4, items5]: Dynamic = [
              LayoutGroupingAbs(value.left),
              LayoutGroupingAbs(value.top),
              LayoutGroupingAbs(value.width),
              LayoutGroupingAbs(value.height),
            ];
          if (
            items2 === null ||
            items3 === null ||
            items4 === null ||
            items5 === null ||
            items4 < 0 ||
            items5 < 0
          )
            return null;
          let value2: Dynamic =
              value.position === "absolute" || value.position === "fixed"
                ? value.position
                : "flow",
            value3: Dynamic =
              value.freeze !== null &&
              typeof value.freeze == "object" &&
              !Array.isArray(value.freeze)
                ? value.freeze
                : null,
            value4: Dynamic = Array.isArray(value.changed)
              ? value.changed.filter(
                  (input2?: Dynamic): Dynamic =>
                    typeof input2 == "string" &&
                    runtime.CssEditValidationFontSizeFontFamilyFontWeightValues.includes(
                      input2,
                    ),
                )
              : [],
            state: Dynamic = {};
          if (
            value.carry !== null &&
            typeof value.carry == "object" &&
            !Array.isArray(value.carry)
          )
            for (let value6 of runtime.LayoutGroupCaptureBackgroundColorBorderStyleBorderColorValues as Dynamic) {
              let value7: Dynamic = value.carry[value6];
              typeof value7 == "string" && (state[value6] = value7);
            }
          let value5: Dynamic =
            typeof value.zIndex == "number" &&
            Number.isInteger(value.zIndex) &&
            value.zIndex > 0 &&
            value.zIndex <= 2147483647
              ? value.zIndex
              : 0;
          return {
            left: items2,
            top: items3,
            width: items4,
            height: items5,
            marginLeft: LayoutGroupingAbs(value.marginLeft) ?? 0,
            marginTop: LayoutGroupingAbs(value.marginTop) ?? 0,
            marginRight: LayoutGroupingAbs(value.marginRight) ?? 0,
            marginBottom: LayoutGroupingAbs(value.marginBottom) ?? 0,
            cssWidth: Math.max(0, LayoutGroupingAbs(value.cssWidth) ?? 0),
            cssHeight: Math.max(0, LayoutGroupingAbs(value.cssHeight) ?? 0),
            position: value2,
            pinWidth: Math.max(0, LayoutGroupingAbs(value.pinWidth) ?? 0),
            pinHeight: Math.max(0, LayoutGroupingAbs(value.pinHeight) ?? 0),
            freeze: value3,
            changed: value4,
            carry: state,
            lostPosition: value.lostPosition === true,
            lostWidth: value.lostWidth === true,
            lostHeight: value.lostHeight === true,
            lostBoxSizing:
              value.lostBoxSizing === "border-box" ||
              value.lostBoxSizing === "content-box"
                ? value.lostBoxSizing
                : "",
            rendered: normalizeGroupedLayoutConstraints(value.rendered),
            transformed: value.transformed === true,
            sameSpace: value.sameSpace === true,
            zIndex: value5,
            localZ: value.localZ === true,
            liftable: value.liftable !== false,
            positioned: value.positioned === true || value2 !== "flow",
            wraps: value.wraps === true,
            opaque: value.opaque === true,
          };
        });
  }
  async function inspectGroupLayout(
    input?: Dynamic,
    options?: Dynamic,
    items?: Dynamic,
    value?: Dynamic,
    extra: Dynamic = true,
  ): Promise<Dynamic> {
    let value2: Dynamic =
      "(" +
      runtime.captureGroupLayout.toString() +
      ")(" +
      [
        options,
        items,
        value,
        extra
          ? runtime.CssEditValidationFontSizeFontFamilyFontWeightValues
          : null,
        runtime.LayoutGroupCaptureBackgroundColorBorderStyleBorderColorValues,
      ]
        .map((input2?: Dynamic): Dynamic => JSON.stringify(input2))
        .join(",") +
      ",{capture:" +
      runtime.computedTextMetrics.toString() +
      ",width:" +
      runtime.computedWidth.toString() +
      ",height:" +
      runtime.emptyElementHeight.toString() +
      "})";
    try {
      return normalizeGroupLayoutCapture(
        await input.executeJavaScript(value2, 4e3),
        items.length,
      );
    } catch {
      return;
    }
  }
  function commonSelectedAncestor(input?: Dynamic, items?: Dynamic): Dynamic {
    let value: Dynamic = items.length > 0 ? input.parentTid(items[0]) : null;
    for (
      ;
      value !== null &&
      !items.every(
        (input2?: Dynamic): Dynamic => input.isWithin(value, input2),
      );

    )
      value = input.parentTid(value);
    let items2: Dynamic = [];
    for (
      let value2: Dynamic = value;
      value2 !== null;
      value2 = input.parentTid(value2)
    )
      items2.push(value2);
    return items2;
  }
  function freezeTextStyleForLayout(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (!(!context.freeze || context.changed.length === 0))
      for (let [value, value2] of (0, runtime.normalizeTextStyleSnapshot)(
        context.freeze,
      ) as Dynamic)
        context.changed.includes(value) &&
          !input.hasAuthoredStyle(options, value) &&
          input.setStyleProperty(options, value, value2);
  }
  function resetPositioningProperty(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    let value2: Dynamic =
      extra || input.inlineStyleValue(options, context) !== "";
    input.setStyleProperty(options, context, null);
    (input.hasAuthoredStyle(options, context) || (value === true && !value2)) &&
      input.setStyleProperty(options, context, "auto");
  }
  function layoutCarryStyle(input?: Dynamic): Dynamic {
    let entries: Dynamic = new Map(
      (0, runtime.normalizeStyleEdits)(Object.entries(input.carry)).flatMap(
        ([input2, input3]: Dynamic): Dynamic =>
          input3 === null ? [] : [[input2, input3]],
      ),
    );
    for (let value of ["border-", "radius"] as Dynamic) {
      let value2: Dynamic = Object.keys(input.carry).filter(
        (input2?: Dynamic): Dynamic =>
          value === "radius"
            ? input2.endsWith("-radius")
            : input2.startsWith(value) && !input2.endsWith("-radius"),
      );
      if (value2.some((input2?: Dynamic): Dynamic => !entries.has(input2)))
        for (let value3 of value2 as Dynamic) entries.delete(value3);
    }
    return [...entries];
  }
  function ungroupedElementRect(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (context.position === "flow")
      return {
        left: context.left,
        top: context.top,
        zeroMargins: true,
        width: context.pinWidth > 0 ? context.pinWidth : null,
        height: context.pinHeight > 0 ? context.pinHeight : null,
        autoWidth: false,
      };
    let rendered: Dynamic = context.rendered,
      callback: Dynamic = (input2?: Dynamic): Dynamic =>
        input.effectiveStyleValue(options, input2),
      callback2: Dynamic = (input2?: Dynamic): Dynamic =>
        input.hasAuthoredStyle(options, input2),
      callback3: Dynamic = (input2?: Dynamic): Dynamic =>
        callback("inset-" + input2) !== "" ||
        (callback("inset-" + input2 + "-start") !== "" &&
          callback("inset-" + input2 + "-end") !== ""),
      value: Dynamic = rendered ? rendered.widthAuto : !callback2("width"),
      value2: Dynamic = rendered ? rendered.heightAuto : !callback2("height"),
      value3: Dynamic = rendered
        ? rendered.left && rendered.right
        : (callback2("left") && callback2("right")) || callback3("inline"),
      value4: Dynamic = rendered
        ? rendered.top && rendered.bottom
        : (callback2("top") && callback2("bottom")) || callback3("block"),
      value5: Dynamic =
        context.lostWidth ||
        (value
          ? value3 || context.wraps
          : rendered
            ? rendered.widthPercent
            : callback("width").includes("%")),
      value6: Dynamic =
        context.lostHeight ||
        (value2
          ? value4
          : rendered
            ? rendered.heightPercent
            : callback("height").includes("%")),
      value7: Dynamic = rendered
        ? rendered.marginAuto
        : [
            "margin",
            ...LayoutGroupingMarginTopMarginRightMarginBottomValues,
          ].some(
            (input2?: Dynamic): Dynamic => callback(input2).includes("auto"),
          );
    return {
      left: value7 ? context.left : context.left - context.marginLeft,
      top: value7 ? context.top : context.top - context.marginTop,
      zeroMargins: value7,
      width: value5 && context.cssWidth > 0 ? context.cssWidth : null,
      height: value6 && context.cssHeight > 0 ? context.cssHeight : null,
      autoWidth: value && !value5,
    };
  }
  function restoreUngroupedLayout(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
    detail?: Dynamic,
  ): Dynamic {
    context.position === "flow"
      ? input.setStyleProperty(options, "position", "absolute")
      : (context.lostPosition ||
          !input.hasAuthoredStyle(options, "position")) &&
        input.setStyleProperty(options, "position", context.position);
    context.opaque &&
      !input.hasAuthoredStyle(options, "width") &&
      !input.hasAuthoredStyle(options, "height") &&
      (value.width === null &&
        context.cssWidth > 0 &&
        input.setStyleProperty(
          options,
          "width",
          String(context.cssWidth) + "px",
        ),
      value.height === null &&
        context.cssHeight > 0 &&
        input.setStyleProperty(
          options,
          "height",
          String(context.cssHeight) + "px",
        ));
    context.lostBoxSizing !== "" &&
      input.setStyleProperty(options, "box-sizing", context.lostBoxSizing);
    for (let [value2, value3] of layoutCarryStyle(context) as Dynamic)
      input.inlineStyleValue(options, value2) === "" &&
        input.setStyleProperty(options, value2, value3);
    if (value.zeroMargins) {
      for (let value2 of LayoutGroupingMarginTopMarginRightMarginBottomValues as Dynamic)
        input.setStyleProperty(options, value2, null);
      input.setStyleProperty(options, "margin", "0px");
    }
    value.width !== null &&
      input.setStyleProperty(options, "width", String(value.width) + "px");
    value.height !== null &&
      input.setStyleProperty(options, "height", String(value.height) + "px");
    let flag: Dynamic = false;
    for (let value2 of LayoutGroupingInsetInlineInsetBlockInsetInlineStartValues as Dynamic)
      input.inlineStyleValue(options, value2) &&
        (input.setStyleProperty(options, value2, null), (flag = true));
    input.setStyleProperty(
      options,
      "left",
      LayoutGroupingHandler(value.left - extra),
    );
    input.setStyleProperty(
      options,
      "top",
      LayoutGroupingHandler(value.top - detail),
    );
    resetPositioningProperty(
      input,
      options,
      "right",
      context.rendered ? context.rendered.right : null,
      flag,
    );
    resetPositioningProperty(
      input,
      options,
      "bottom",
      context.rendered ? context.rendered.bottom : null,
      flag,
    );
  }
  function groupModelElements(
    input?: Dynamic,
    options?: Dynamic,
    items?: Dynamic,
  ): Dynamic {
    let value: Dynamic = options
      .map((input2?: Dynamic): Dynamic => input.element(input2))
      .filter((input2?: Dynamic): Dynamic => input2 !== null);
    if (
      value.length === 0 ||
      value.length !== items.length ||
      items.some((input2?: Dynamic): Dynamic => input2.position === "fixed")
    )
      return null;
    let parentNode: Dynamic = value[0].parentNode;
    for (
      ;
      parentNode &&
      !value.every((input2?: Dynamic): Dynamic => parentNode.contains(input2));

    )
      parentNode = parentNode.parentNode;
    let value2: Dynamic = value[value.length - 1];
    for (
      ;
      parentNode && value2.parentNode && value2.parentNode !== parentNode;

    )
      value2 = value2.parentNode;
    let nextSibling: Dynamic = value2.nextSibling,
      value3: Dynamic = items.map(
        (input2?: Dynamic, options2?: Dynamic): Dynamic => ({
          b: input2,
          p: ungroupedElementRect(input, options[options2], input2),
        }),
      ),
      value4: Dynamic = Math.floor(
        Math.min(...value3.map((input2?: Dynamic): Dynamic => input2.b.left)),
      ),
      value5: Dynamic = Math.floor(
        Math.min(...value3.map((input2?: Dynamic): Dynamic => input2.b.top)),
      ),
      callback: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic =>
        options2 === "x"
          ? Math.round(input2.p.left - value4) +
            input2.b.width +
            (input2.p.zeroMargins
              ? 0
              : input2.b.marginLeft +
                (input2.p.autoWidth ? Math.max(0, input2.b.marginRight) : 0))
          : Math.round(input2.p.top - value5) +
            input2.b.height +
            (input2.p.zeroMargins ? 0 : input2.b.marginTop),
      value6: Dynamic = Math.ceil(
        Math.max(
          ...value3.map((input2?: Dynamic): Dynamic => callback(input2, "x")),
        ),
      ),
      value7: Dynamic = Math.ceil(
        Math.max(
          ...value3.map((input2?: Dynamic): Dynamic => callback(input2, "y")),
        ),
      ),
      value8: Dynamic = Math.max(
        0,
        ...items.map((input2?: Dynamic): Dynamic => input2.zIndex),
      ),
      value9: Dynamic =
        value8 > 0
          ? "; z-index: " + String(value8)
          : items.some((input2?: Dynamic): Dynamic => input2.localZ)
            ? "; z-index: 0"
            : "",
      value10: Dynamic = input.wrapElements(
        [...options],
        '<div data-dc-group style="box-sizing: border-box; position: absolute; margin: 0px; left: ' +
          LayoutGroupingHandler(value4) +
          "; top: " +
          LayoutGroupingHandler(value5) +
          "; width: " +
          LayoutGroupingHandler(value6) +
          "; height: " +
          LayoutGroupingHandler(value7) +
          value9 +
          '"></div>',
      );
    return value10
      ? (parentNode &&
          value10.parentNode === parentNode &&
          nextSibling !== value10 &&
          parentNode.insertBefore(value10, nextSibling),
        options.forEach((input2?: Dynamic, options2?: Dynamic): Dynamic => {
          restoreUngroupedLayout(
            input,
            input2,
            value3[options2].b,
            value3[options2].p,
            value4,
            value5,
          );
          freezeTextStyleForLayout(input, input2, value3[options2].b);
        }),
        value10)
      : null;
  }
  bindRuntimeValue(
    runtime,
    "LayoutGroupingAbs",
    () => LayoutGroupingAbs,
    (value) => {
      LayoutGroupingAbs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeGroupedLayoutConstraints",
    () => normalizeGroupedLayoutConstraints,
  );
  bindRuntimeValue(
    runtime,
    "normalizeGroupLayoutCapture",
    () => normalizeGroupLayoutCapture,
  );
  bindRuntimeValue(runtime, "inspectGroupLayout", () => inspectGroupLayout);
  bindRuntimeValue(
    runtime,
    "commonSelectedAncestor",
    () => commonSelectedAncestor,
  );
  bindRuntimeValue(
    runtime,
    "LayoutGroupingHandler",
    () => LayoutGroupingHandler,
    (value) => {
      LayoutGroupingHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LayoutGroupingMarginTopMarginRightMarginBottomValues",
    () => LayoutGroupingMarginTopMarginRightMarginBottomValues,
    (value) => {
      LayoutGroupingMarginTopMarginRightMarginBottomValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LayoutGroupingInsetInlineInsetBlockInsetInlineStartValues",
    () => LayoutGroupingInsetInlineInsetBlockInsetInlineStartValues,
    (value) => {
      LayoutGroupingInsetInlineInsetBlockInsetInlineStartValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "freezeTextStyleForLayout",
    () => freezeTextStyleForLayout,
  );
  bindRuntimeValue(
    runtime,
    "resetPositioningProperty",
    () => resetPositioningProperty,
  );
  bindRuntimeValue(runtime, "layoutCarryStyle", () => layoutCarryStyle);
  bindRuntimeValue(runtime, "ungroupedElementRect", () => ungroupedElementRect);
  bindRuntimeValue(
    runtime,
    "restoreUngroupedLayout",
    () => restoreUngroupedLayout,
  );
  bindRuntimeValue(runtime, "groupModelElements", () => groupModelElements);
  return () => {
    LayoutGroupingAbs = (input?: Dynamic): Dynamic =>
      typeof input == "number" &&
      Number.isFinite(input) &&
      Math.abs(input) < 1e6
        ? input
        : null;
    LayoutGroupingHandler = (input?: Dynamic): Dynamic =>
      String(Math.round(input)) + "px";
    LayoutGroupingMarginTopMarginRightMarginBottomValues = [
      "margin-top",
      "margin-right",
      "margin-bottom",
      "margin-left",
      "margin-inline",
      "margin-block",
      "margin-inline-start",
      "margin-inline-end",
      "margin-block-start",
      "margin-block-end",
    ];
    LayoutGroupingInsetInlineInsetBlockInsetInlineStartValues = [
      "inset-inline",
      "inset-block",
      "inset-inline-start",
      "inset-inline-end",
      "inset-block-start",
      "inset-block-end",
    ];
  };
}
