/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorSvgArrowEditing(
  runtime: RuntimeBindings,
): () => void {
  var SvgArrowEditingElement: Dynamic;
  function getModelSvgArrow(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = input.element(options),
      value2: Dynamic =
        value?.tagName.toLowerCase() === "svg"
          ? value
          : value?.parentElement?.tagName.toLowerCase() === "svg"
            ? value.parentElement
            : null,
      value3: Dynamic = value2
        ? (0, runtime.inspectSvgArrowHeads)(value2)
        : null;
    if (!value2 || !value3 || (value !== value2 && value !== value3.shaft))
      return null;
    let value4: Dynamic = (0, runtime.HooksAlternateCursorHandler)(value2),
      value5: Dynamic = (0, runtime.HooksAlternateCursorHandler)(value3.shaft);
    return value4 >= 0 && value5 >= 0
      ? {
          svgTid: value4,
          svg: value2,
          shaft: value3.shaft,
          shaftTid: value5,
          ends: value3,
        }
      : null;
  }
  function getModelArrowShaft(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = getModelSvgArrow(input, options);
    if (!value) return null;
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
        input.inlineStyleValue(value.shaftTid, input2) ||
        input.attribute(value.shaftTid, input2) ||
        input.inlineStyleValue(value.svgTid, input2) ||
        input.attribute(value.svgTid, input2) ||
        "",
      value2: Dynamic = callback("stroke-width").trim(),
      value3: Dynamic = [value.shaftTid, value.svgTid].some(
        (input2?: Dynamic): Dynamic =>
          input.attribute(input2, "class") != null ||
          input.attribute(input2, "id") != null,
      );
    return {
      svgTid: value.svgTid,
      width:
        value2 === ""
          ? value3
            ? null
            : 1
          : (0, runtime.HooksAlternateCursorTest)(value2),
      stroke: callback("stroke").trim(),
      ruled: value3,
    };
  }
  function extendedArrowEndpoints(
    element?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = Math.hypot(
      options.ex - options.sx,
      options.ey - options.sy,
    );
    if (!(value2 > 0))
      return {
        p: {
          x: options.sx,
          y: options.sy,
        },
        q: {
          x: options.ex,
          y: options.ey,
        },
      };
    let value3: Dynamic = (options.ex - options.sx) / value2,
      value4: Dynamic = (options.ey - options.sy) / value2,
      state: Dynamic = {
        p: {
          x: options.sx - value3 * context,
          y: options.sy - value4 * context,
        },
        q: {
          x: options.ex + value3 * value,
          y: options.ey + value4 * value,
        },
      },
      value5: Dynamic = (
        element.getAttribute("viewBox") ??
        element.getAttribute("sc-camel-view-box") ??
        ""
      )
        .trim()
        .split(/[\s,]+/)
        .map(Number);
    if (
      !(
        value5.length === 4 &&
        value5[0] === 0 &&
        value5[1] === 0 &&
        value5[2] > 0 &&
        value5[3] > 0 &&
        parseFloat(element.getAttribute("width") ?? "") === value5[2] &&
        parseFloat(element.getAttribute("height") ?? "") === value5[3] &&
        (element.getAttribute("preserveAspectRatio") ??
          element.getAttribute("sc-camel-preserve-aspect-ratio")) === "none"
      ) ||
      context + value === 0
    )
      return state;
    let value6: Dynamic = value5[2],
      value7: Dynamic = value5[3],
      value8: Dynamic = value2 <= 0.5 + 4 * 0.005,
      callback: Dynamic = (input?: Dynamic, options2?: Dynamic): Dynamic =>
        (input - options.sx) * value3 + (options2 - options.sy) * value4;
    if (
      ((input?: Dynamic, options2?: Dynamic): Dynamic =>
        Math.abs(
          (input - options.sx) * value4 - (options2 - options.sy) * value3,
        ))(value6 / 2, value7 / 2) >= 0.75
    )
      return state;
    if (context === 0 || value === 0) {
      let [value10, value11]: Dynamic =
          context === 0
            ? [value6 - options.sx, value7 - options.sy]
            : [value6 - options.ex, value7 - options.ey],
        value12: Dynamic =
          context === 0
            ? callback(value10, value11) - value2
            : -callback(value10, value11);
      return value12 < 0 ||
        !(value8 || Math.abs(value12 - context - value) < 0.75)
        ? state
        : context === 0
          ? {
              p: state.p,
              q: {
                x: value10,
                y: value11,
              },
            }
          : {
              p: {
                x: value10,
                y: value11,
              },
              q: state.q,
            };
    }
    if (!value8) return state;
    let value9: Dynamic =
      Math.abs(value3) >= Math.abs(value4)
        ? value6 / Math.abs(value3)
        : value7 / Math.abs(value4);
    return value9 >= value2
      ? {
          p: {
            x: value6 / 2 - (value3 * value9) / 2,
            y: value7 / 2 - (value4 * value9) / 2,
          },
          q: {
            x: value6 / 2 + (value3 * value9) / 2,
            y: value7 / 2 + (value4 * value9) / 2,
          },
        }
      : state;
  }
  function updateArrowShaftMarkers(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = getModelSvgArrow(input, options.svgTid),
      value2: Dynamic = value
        ? getModelArrowShaft(input, options.svgTid)
        : null;
    if (!value || !value2) return false;
    let flag: Dynamic = false,
      value3: Dynamic = (0, runtime.inspectSvgArrow)(value.svg),
      state: Dynamic = {
        start: (0, runtime.arrowMarkerLength)(value.svg, value.shaft, "start"),
        end: (0, runtime.arrowMarkerLength)(value.svg, value.shaft, "end"),
      };
    if (
      state.start + state.end > 0 &&
      options.width != null &&
      value2.width != null &&
      options.width !== value2.width &&
      Math.hypot(value3.ex - value3.sx, value3.ey - value3.sy) > 0
    ) {
      let { p: value5, q: value6 }: Dynamic = extendedArrowEndpoints(
          value.svg,
          value3,
          state.start * options.width,
          state.end * options.width,
        ),
        value7: Dynamic = (0, runtime.shortenLineEnds)(
          value5.x,
          value5.y,
          value6.x,
          value6.y,
          state.start * value2.width,
          state.end * value2.width,
        );
      (0, runtime.setSvgLineEndpoints)(
        input,
        value.shaftTid,
        value7.sx,
        value7.sy,
        value7.ex,
        value7.ey,
      );
      flag = true;
    }
    let value4: Dynamic =
        value2.stroke === "" && value2.ruled
          ? null
          : (0, runtime.normalizeSvgPaint)(
              value2.stroke === "" ? "none" : value2.stroke,
            ),
      values: Dynamic = new Set(
        ["start", "end"].map(
          (input2?: Dynamic): Dynamic =>
            (0, runtime.SvgArrowsExec)(
              value.shaft.getAttribute("marker-" + input2),
            ),
        ),
      );
    for (let value5 of value.svg.getElementsByTagName("marker") as Dynamic) {
      let value6: Dynamic = value5.getAttribute("id") ?? "",
        value7: Dynamic = value5.getElementsByTagName("path")[0];
      if (
        !(
          !(
            values.has(value6) &&
            (0, runtime.arrowHeadKindFromId)(value6) != null &&
            value7 &&
            (0, runtime.recognizeArrowHeadPath)(
              value7.getAttribute("d") ?? "",
            ) != null &&
            (/(^|;)\s*fill\s*:\s*context-stroke/.test(
              value7.getAttribute("style") ?? "",
            ) ||
              value7.hasAttribute("fill"))
          ) || !value7
        )
      ) {
        if (value2.stroke !== options.stroke && value4 != null) {
          let value8: Dynamic = (0, runtime.HooksAlternateCursorHandler)(
            value7,
          );
          flag =
            input.setInlineStyleAttr(
              value8,
              (0, runtime.arrowHeadFillStyle)(
                value4,
                value7.getAttribute("style") ?? "",
              ),
            ) || flag;
          flag =
            input.setAttribute(
              value8,
              "fill",
              / fill="([^"]*)"/.exec(
                (0, runtime.arrowHeadFillAttribute)(value4),
              )?.[1] ?? null,
            ) || flag;
        }
        flag =
          (0, runtime.regenerateArrowHeadIds)(value.svg.getRootNode(), [
            value5,
          ]) || flag;
      }
    }
    return flag;
  }
  function arrowSnapshotsForPropertyChange(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (
      ![...context].some(
        (input2?: Dynamic): Dynamic =>
          runtime.HooksAlternateCursorSubscribers.has(input2),
      )
    )
      return [];
    let entries: Dynamic = new Map();
    for (let value of options as Dynamic) {
      let value2: Dynamic = getModelSvgArrow(input, value)?.ends,
        value3: Dynamic =
          value2 &&
          !value2.legacy &&
          (value2.start !== "none" || value2.end !== "none")
            ? getModelArrowShaft(input, value)
            : null;
      value3 &&
        !entries.has(value3.svgTid) &&
        entries.set(value3.svgTid, value3);
    }
    return [...entries.values()];
  }
  function restoreArrowSnapshots(input?: Dynamic, options?: Dynamic): Dynamic {
    let flag: Dynamic = false;
    for (let value of options as Dynamic)
      flag = updateArrowShaftMarkers(input, value) || flag;
    return flag;
  }
  function getArrowHeadState(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = {},
  ): Dynamic {
    let value: Dynamic = getModelSvgArrow(input, options);
    if (!value) return null;
    let value2: Dynamic =
      getModelArrowShaft(input, options)?.width ??
      (0, runtime.HooksAlternateCursorTest)(
        SvgArrowEditingElement(input, value, options, context).strokeWidth,
      );
    return {
      start: value.ends.start,
      end: value.ends.end,
      width: value2,
    };
  }
  function removeUnusedSvgMarker(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = [...options.getElementsByTagName("marker")].find(
        (element?: Dynamic): Dynamic => element.getAttribute("id") === context,
      ),
      value2: Dynamic = options.getRootNode(),
      value3: Dynamic = new RegExp(
        "#" + context.replace(/[^\w-]/g, "\\$&") + "(?![\\w-])",
      ),
      value4: Dynamic = [
        ...value2.querySelectorAll(
          '[marker-start], [marker-mid], [marker-end], [style*="marker"], style',
        ),
      ].some(
        (element?: Dynamic): Dynamic =>
          element.tagName.toLowerCase() === "style"
            ? value3.test(element.textContent ?? "")
            : ["marker-start", "marker-mid", "marker-end", "style"].some(
                (input2?: Dynamic): Dynamic =>
                  value3.test(element.getAttribute(input2) ?? ""),
              ),
      );
    if (!value || value4) return;
    let parentElement: Dynamic = value.parentElement;
    input.removeElement((0, runtime.HooksAlternateCursorHandler)(value));
    parentElement &&
      parentElement !== options &&
      parentElement.tagName.toLowerCase() === "defs" &&
      parentElement.children.length === 0 &&
      input.removeElement(
        (0, runtime.HooksAlternateCursorHandler)(parentElement),
      );
  }
  function setArrowHead(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = getModelArrowShaft(input, options.svgTid),
      value3: Dynamic = (0, runtime.inspectSvgArrow)(options.svg),
      value4: Dynamic =
        value2?.width ??
        (0, runtime.HooksAlternateCursorTest)(extra.strokeWidth);
    if (options.ends[context] === value || !value2 || value4 == null || !value3)
      return null;
    if (options.ends.legacy) {
      let state3: Dynamic = {
          start: "none",
          end: runtime.OpenValue,
          [context]: value,
        },
        value9: Dynamic = (0, runtime.shortenLineEnds)(
          value3.sx,
          value3.sy,
          value3.ex,
          value3.ey,
          (0, runtime.SvgArrowsRefX)(state3.start) * value4,
          (0, runtime.SvgArrowsRefX)(state3.end) * value4,
        ),
        value10: Dynamic = extra.stroke
          ? {
              stroke: extra.stroke,
            }
          : {};
      (0, runtime.resizeSvgArrow)(
        input,
        options.svgTid,
        `M ${value9.sx} ${value9.sy} L ${value9.ex} ${value9.ey}`,
        1,
        value10,
        value10,
        {
          heads: state3,
          restamp: false,
        },
      );
      return (
        [...options.svg.children]
          .filter(
            (input2?: Dynamic): Dynamic =>
              input2.tagName.toLowerCase() === "path",
          )
          .pop() ?? null
      );
    }
    let state: Dynamic = {
        start:
          (0, runtime.arrowMarkerLength)(options.svg, options.shaft, "start") *
          value4,
        end:
          (0, runtime.arrowMarkerLength)(options.svg, options.shaft, "end") *
          value4,
      },
      { p: value5, q: value6 }: Dynamic = extendedArrowEndpoints(
        options.svg,
        value3,
        state.start,
        state.end,
      ),
      value7: Dynamic = (0, runtime.SvgArrowsExec)(
        options.shaft.getAttribute("marker-" + context),
      );
    for (let value9 of [options.shaftTid, options.svgTid] as Dynamic) {
      let value10: Dynamic = input.inlineStyleValue(value9, "marker"),
        value11: Dynamic = context === "start" ? "marker-end" : "marker-start";
      value10 &&
        !input.inlineStyleValue(options.shaftTid, value11) &&
        !input.inlineStyleValue(options.svgTid, value11) &&
        input.setStyleProperty(options.shaftTid, value11, value10);
      for (let value12 of ["marker", "marker-" + context] as Dynamic)
        input.inlineStyleValue(value9, value12) &&
          input.setStyleProperty(value9, value12, null);
    }
    input.setAttribute(options.shaftTid, "marker-" + context, null);
    value7 != null && removeUnusedSvgMarker(input, options.svg, value7);
    if (value !== "none") {
      let value9: Dynamic = (0, runtime.createArrowHeadId)(value),
        value10: Dynamic =
          [value2.stroke, extra.stroke].find(
            (input2?: Dynamic): Dynamic =>
              (0, runtime.normalizeSvgPaint)(input2) != null,
          ) ?? "",
        value11: Dynamic = [...options.svg.children].find(
          (input2?: Dynamic): Dynamic =>
            input2.tagName.toLowerCase() === "defs",
        );
      value11
        ? input.insertHtml(
            (0, runtime.arrowHeadMarkerHtml)(value9, value, context, value10),
            (0, runtime.HooksAlternateCursorHandler)(value11),
            "into",
          )
        : input.insertHtml(
            `<defs>${(0, runtime.arrowHeadMarkerHtml)(value9, value, context, value10)}</defs>`,
            options.shaftTid,
            "before",
          );
      input.setAttribute(
        options.shaftTid,
        "marker-" + context,
        `url(#${value9})`,
      );
    }
    let state2: Dynamic = {
        ...state,
        [context]: (0, runtime.SvgArrowsRefX)(value) * value4,
      },
      value8: Dynamic = (0, runtime.shortenLineEnds)(
        value5.x,
        value5.y,
        value6.x,
        value6.y,
        state2.start,
        state2.end,
      );
    (0, runtime.setSvgLineEndpoints)(
      input,
      options.shaftTid,
      value8.sx,
      value8.sy,
      value8.ex,
      value8.ey,
    );
    return options.shaft;
  }
  function changeSelectedArrowHeads(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra: Dynamic = {},
  ): Dynamic {
    let entries: Dynamic = new Map();
    for (let value2 of options as Dynamic) {
      let value3: Dynamic = getModelSvgArrow(input, value2);
      value3 &&
        !entries.has(value3.svg) &&
        entries.set(value3.svg, {
          a: value3,
          tid: value2,
        });
    }
    let entries2: Dynamic = new Map(),
      index: Dynamic = 0;
    for (let { a: value2, tid: value3 } of entries.values() as Dynamic) {
      let value4: Dynamic = setArrowHead(
        input,
        value2,
        context,
        value,
        SvgArrowEditingElement(input, value2, value3, extra),
      );
      value4 && value4 !== value2.shaft && entries2.set(value2.shaft, value4);
      value4 && index++;
    }
    index > 0 && input.restamp();
    return index > 0
      ? {
          replaced: entries2,
          changed: index,
        }
      : null;
  }
  bindRuntimeValue(runtime, "getModelSvgArrow", () => getModelSvgArrow);
  bindRuntimeValue(runtime, "getModelArrowShaft", () => getModelArrowShaft);
  bindRuntimeValue(
    runtime,
    "extendedArrowEndpoints",
    () => extendedArrowEndpoints,
  );
  bindRuntimeValue(
    runtime,
    "updateArrowShaftMarkers",
    () => updateArrowShaftMarkers,
  );
  bindRuntimeValue(
    runtime,
    "arrowSnapshotsForPropertyChange",
    () => arrowSnapshotsForPropertyChange,
  );
  bindRuntimeValue(
    runtime,
    "restoreArrowSnapshots",
    () => restoreArrowSnapshots,
  );
  bindRuntimeValue(
    runtime,
    "SvgArrowEditingElement",
    () => SvgArrowEditingElement,
    (value) => {
      SvgArrowEditingElement = value;
    },
  );
  bindRuntimeValue(runtime, "getArrowHeadState", () => getArrowHeadState);
  bindRuntimeValue(
    runtime,
    "removeUnusedSvgMarker",
    () => removeUnusedSvgMarker,
  );
  bindRuntimeValue(runtime, "setArrowHead", () => setArrowHead);
  bindRuntimeValue(
    runtime,
    "changeSelectedArrowHeads",
    () => changeSelectedArrowHeads,
  );
  return () => {
    SvgArrowEditingElement = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
      value?: Dynamic,
    ): Dynamic =>
      input.element(context) === options.shaft
        ? value
        : {
            stroke: value.stroke,
          };
  };
}
