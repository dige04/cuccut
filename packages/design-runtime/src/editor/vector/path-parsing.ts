/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorVectorPathParsing(
  runtime: RuntimeBindings,
): () => void {
  var VectorPathParsingCosValue: Dynamic;
  var quadraticToCubic: Dynamic;
  function parseVectorPath(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let callback: Dynamic = (
        input2?: Dynamic,
        options2?: Dynamic,
      ): Dynamic => ({
        x: options.ox + input2 * options.sx,
        y: options.oy + options2 * options.sy,
      }),
      items: Dynamic = [],
      items2: Dynamic = [],
      items3: Dynamic = [],
      callback2: Dynamic = (): Dynamic => {
        if (items3.length < 2) return void (items3 = []);
        let value: Dynamic =
          items3.length >= 3
            ? (0, runtime.fitPenCurve)(
                items3.map((input2?: Dynamic): Dynamic => [input2.x, input2.y]),
                context,
              )
            : null;
        if (value && value.length > 4)
          for (let count: Dynamic = 2; count + 5 < value.length; count += 6)
            items2.push({
              x: value[count + 4],
              y: value[count + 5],
              seg: {
                kind: "cubic",
                c1: {
                  x: value[count],
                  y: value[count + 1],
                },
                c2: {
                  x: value[count + 2],
                  y: value[count + 3],
                },
              },
            });
        else
          for (let value2 of items3.slice(1) as Dynamic)
            items2.push({
              x: value2.x,
              y: value2.y,
              seg: {
                kind: "line",
              },
            });
        items3 = [];
      };
    for (let value of (input.match(/[MLC][^MLC]*/g) ?? []) as Dynamic) {
      let value2: Dynamic = (
        value.slice(1).match(/-?\d+(?:\.\d+)?/g) ?? []
      ).map(Number);
      if (value[0] === "M" && value2.length >= 2) {
        callback2();
        items2.length > 0 &&
          items.push({
            anchors: items2,
            closed: false,
          });
        let value3: Dynamic = callback(value2[0], value2[1]);
        items2 = [
          {
            x: value3.x,
            y: value3.y,
            seg: {
              kind: "line",
            },
          },
        ];
        items3 = [value3];
      } else {
        if (items2.length === 0) continue;
        if (value[0] === "L" && value2.length >= 2) {
          items3.length === 0 &&
            (items3 = [
              {
                x: items2[items2.length - 1].x,
                y: items2[items2.length - 1].y,
              },
            ]);
          items3.push(callback(value2[0], value2[1]));
        } else if (value[0] === "C" && value2.length >= 6) {
          callback2();
          let value3: Dynamic = callback(value2[4], value2[5]),
            value4: Dynamic = items2[items2.length - 1],
            [items4, items5]: Dynamic = [
              callback(value2[0], value2[1]),
              callback(value2[2], value2[3]),
            ],
            callback3: Dynamic = (input2?: Dynamic): Dynamic =>
              (input2.x - value4.x) ** 2 + (input2.y - value4.y) ** 2 < 0.25;
          if (
            items2.length > 1 &&
            callback3(value3) &&
            callback3(items4) &&
            callback3(items5)
          )
            continue;
          items2.push({
            x: value3.x,
            y: value3.y,
            seg: {
              kind: "cubic",
              c1: items4,
              c2: items5,
            },
          });
        }
      }
    }
    callback2();
    items2.length > 0 &&
      items.push({
        anchors: items2,
        closed: false,
      });
    for (let value of items as Dynamic)
      value.anchors.forEach(
        (input2?: Dynamic, options2?: Dynamic): Dynamic =>
          (input2.tangent = inferVectorTangentKind(value.anchors, options2)),
      );
    return {
      contours: items,
    };
  }
  function inferVectorTangentKind(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = input[options],
      value2: Dynamic = input[options + 1];
    if (value.seg.kind !== "cubic" || !value2 || value2.seg.kind !== "cubic")
      return "corner";
    let [items, items2, items3, items4]: Dynamic = [
        value.x - value.seg.c2.x,
        value.y - value.seg.c2.y,
        value2.seg.c1.x - value.x,
        value2.seg.c1.y - value.y,
      ],
      value3: Dynamic = Math.hypot(items, items2) * Math.hypot(items3, items4);
    return value3 > 0 &&
      (items * items3 + items2 * items4) / value3 >= VectorPathParsingCosValue
      ? "smooth"
      : "corner";
  }
  function vectorControlBounds(input?: Dynamic): Dynamic {
    let [items, items2, items3, items4]: Dynamic = [
        1 / 0,
        1 / 0,
        -1 / 0,
        -1 / 0,
      ],
      callback: Dynamic = (input2?: Dynamic): Dynamic => {
        [items, items2, items3, items4] = [
          Math.min(items, input2.x),
          Math.min(items2, input2.y),
          Math.max(items3, input2.x),
          Math.max(items4, input2.y),
        ];
      };
    for (let value of input.contours as Dynamic)
      value.anchors.forEach((input2?: Dynamic, options?: Dynamic): Dynamic => {
        callback(input2);
        options > 0 &&
          input2.seg.kind === "cubic" &&
          (callback(input2.seg.c1), callback(input2.seg.c2));
        options > 0 && input2.seg.kind === "quad" && callback(input2.seg.c);
      });
    return items === 1 / 0
      ? null
      : {
          x0: items,
          y0: items2,
          x1: items3,
          y1: items4,
        };
  }
  function serializeVectorPathBounds(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = true,
  ): Dynamic {
    let value: Dynamic = context ? vectorAnchorBounds(input) : null,
      callback: Dynamic = (input2?: Dynamic): Dynamic =>
        !context ||
        (value !== null &&
          input2.x >= value.x0 - 0.5 &&
          input2.x <= value.x1 + 0.5 &&
          input2.y >= value.y0 - 0.5 &&
          input2.y <= value.y1 + 0.5),
      state: Dynamic = {
        contours: input.contours.map((input2?: Dynamic): Dynamic => {
          let items: Dynamic = [];
          for (let value4 of input2.anchors as Dynamic) {
            let value5: Dynamic = items[items.length - 1];
            if (
              value4.seg.kind !== "cubic" ||
              !value5 ||
              (callback(value4.seg.c1) && callback(value4.seg.c2))
            ) {
              items.push(
                value4.seg.kind === "quad" && value5
                  ? {
                      ...value4,
                      seg: {
                        kind: "cubic",
                        ...quadraticToCubic(value5, value4.seg.c, value4),
                      },
                    }
                  : value4,
              );
              continue;
            }
            let value6: Dynamic = (0, runtime.flattenCubicPath)([
              value5.x,
              value5.y,
              value4.seg.c1.x,
              value4.seg.c1.y,
              value4.seg.c2.x,
              value4.seg.c2.y,
              value4.x,
              value4.y,
            ]);
            for (let count: Dynamic = 2; count + 5 < value6.length; count += 6)
              items.push({
                x: value6[count + 4],
                y: value6[count + 5],
                seg: {
                  kind: "cubic",
                  c1: {
                    x: value6[count],
                    y: value6[count + 1],
                  },
                  c2: {
                    x: value6[count + 2],
                    y: value6[count + 3],
                  },
                },
              });
          }
          return {
            anchors: items,
            closed: false,
          };
        }),
      },
      value2: Dynamic = vectorControlBounds(state);
    if (value2 === null) return null;
    let value3: Dynamic = 10 ** options,
      callback2: Dynamic = (input2?: Dynamic): Dynamic =>
        Math.round(input2 * value3) / value3,
      callback3: Dynamic = (input2?: Dynamic): Dynamic => {
        let value4: Dynamic = callback2(input2).toFixed(options);
        value4.indexOf(".") >= 0 && (value4 = value4.replace(/\.?0+$/, ""));
        return value4 === "-0" ? "0" : value4;
      },
      callback4: Dynamic = (input2?: Dynamic): Dynamic =>
        callback3(input2.x - value2.x0) + " " + callback3(input2.y - value2.y0),
      text: Dynamic = "";
    for (let value4 of state.contours as Dynamic)
      value4.anchors.forEach(
        (input2?: Dynamic, options2?: Dynamic): Dynamic => {
          text +=
            options2 === 0
              ? (text === "" ? "M" : " M") + callback4(input2)
              : input2.seg.kind === "cubic"
                ? " C" +
                  callback4(input2.seg.c1) +
                  " " +
                  callback4(input2.seg.c2) +
                  " " +
                  callback4(input2)
                : " L" + callback4(input2);
        },
      );
    return {
      x: value2.x0,
      y: value2.y0,
      w: callback2(value2.x1 - value2.x0),
      h: callback2(value2.y1 - value2.y0),
      d: text,
    };
  }
  function vectorAnchorBounds(input?: Dynamic): Dynamic {
    let [items, items2, items3, items4]: Dynamic = [
        1 / 0,
        1 / 0,
        -1 / 0,
        -1 / 0,
      ],
      callback: Dynamic = (input2?: Dynamic, options?: Dynamic): Dynamic => {
        [items, items2, items3, items4] = [
          Math.min(items, input2),
          Math.min(items2, options),
          Math.max(items3, input2),
          Math.max(items4, options),
        ];
      };
    for (let value of input.contours as Dynamic)
      value.anchors.forEach((input2?: Dynamic, options?: Dynamic): Dynamic => {
        callback(input2.x, input2.y);
        let value2: Dynamic = value.anchors[options - 1];
        if (!value2 || input2.seg.kind === "line") return;
        let { c1: value3, c2: value4 }: Dynamic =
          input2.seg.kind === "cubic"
            ? input2.seg
            : quadraticToCubic(value2, input2.seg.c, input2);
        for (let count: Dynamic = 1; count < 16; count++) {
          let value5: Dynamic = count / 16,
            value6: Dynamic = 1 - value5;
          callback(
            value6 * value6 * value6 * value2.x +
              3 * value6 * value6 * value5 * value3.x +
              3 * value6 * value5 * value5 * value4.x +
              value5 * value5 * value5 * input2.x,
            value6 * value6 * value6 * value2.y +
              3 * value6 * value6 * value5 * value3.y +
              3 * value6 * value5 * value5 * value4.y +
              value5 * value5 * value5 * input2.y,
          );
        }
      });
    return items === 1 / 0
      ? null
      : {
          x0: items,
          y0: items2,
          x1: items3,
          y1: items4,
        };
  }
  function deleteVectorAnchorKeepingCurve(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = input.contours[options.contour];
    if (!value || !value.anchors[options.anchor]) return input;
    let value2: Dynamic = value.anchors.slice(),
      anchor: Dynamic = options.anchor,
      value3: Dynamic = value2[anchor],
      value4: Dynamic = value2[anchor + 1];
    value2.splice(anchor, 1);
    if (value2.length < 2) {
      let value6: Dynamic = input.contours.filter(
        (input2?: Dynamic, options2?: Dynamic): Dynamic =>
          options2 !== options.contour,
      );
      return value6.length === 0
        ? null
        : {
            contours: value6,
          };
    }
    if (anchor === 0)
      value2[0] = {
        ...value2[0],
        seg: {
          kind: "line",
        },
      };
    else if (value4) {
      let value6: Dynamic =
          value3.seg.kind === "cubic"
            ? value3.seg.c1
            : {
                x: value2[anchor - 1].x,
                y: value2[anchor - 1].y,
              },
        value7: Dynamic =
          value4.seg.kind === "cubic"
            ? value4.seg.c2
            : {
                x: value4.x,
                y: value4.y,
              };
      value2[anchor] = {
        ...value4,
        seg:
          value3.seg.kind === "line" && value4.seg.kind === "line"
            ? {
                kind: "line",
              }
            : {
                kind: "cubic",
                c1: value6,
                c2: value7,
              },
      };
    }
    let value5: Dynamic = input.contours.slice();
    value5[options.contour] = {
      ...value,
      anchors: value2,
    };
    return {
      contours: value5,
    };
  }
  function mapVectorPath(input?: Dynamic, options?: Dynamic): Dynamic {
    return {
      contours: input.contours.map(
        (input2?: Dynamic): Dynamic => ({
          closed: input2.closed,
          anchors: input2.anchors.map((input3?: Dynamic): Dynamic => {
            let value: Dynamic = options(input3),
              value2: Dynamic =
                input3.seg.kind === "cubic"
                  ? {
                      kind: "cubic",
                      c1: options(input3.seg.c1),
                      c2: options(input3.seg.c2),
                    }
                  : input3.seg.kind === "quad"
                    ? {
                        kind: "quad",
                        c: options(input3.seg.c),
                      }
                    : input3.seg;
            return {
              ...input3,
              x: value.x,
              y: value.y,
              seg: value2,
            };
          }),
        }),
      ),
    };
  }
  function serializeVectorPath(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = 10 ** options,
      callback: Dynamic = (input2?: Dynamic): Dynamic => {
        let value2: Dynamic = (Math.round(input2 * value) / value).toFixed(
          options,
        );
        value2.indexOf(".") >= 0 && (value2 = value2.replace(/\.?0+$/, ""));
        return value2 === "-0" ? "0" : value2;
      },
      callback2: Dynamic = (input2?: Dynamic): Dynamic =>
        callback(input2.x) + " " + callback(input2.y),
      text: Dynamic = "";
    for (let value2 of input.contours as Dynamic)
      value2.anchors.forEach(
        (input2?: Dynamic, options2?: Dynamic): Dynamic => {
          text +=
            options2 === 0
              ? (text === "" ? "M" : " M") + callback2(input2)
              : input2.seg.kind === "cubic"
                ? " C" +
                  callback2(input2.seg.c1) +
                  " " +
                  callback2(input2.seg.c2) +
                  " " +
                  callback2(input2)
                : input2.seg.kind === "quad"
                  ? " Q" + callback2(input2.seg.c) + " " + callback2(input2)
                  : " L" + callback2(input2);
        },
      );
    return text;
  }
  bindRuntimeValue(
    runtime,
    "VectorPathParsingCosValue",
    () => VectorPathParsingCosValue,
    (value) => {
      VectorPathParsingCosValue = value;
    },
  );
  bindRuntimeValue(runtime, "parseVectorPath", () => parseVectorPath);
  bindRuntimeValue(
    runtime,
    "inferVectorTangentKind",
    () => inferVectorTangentKind,
  );
  bindRuntimeValue(runtime, "vectorControlBounds", () => vectorControlBounds);
  bindRuntimeValue(
    runtime,
    "serializeVectorPathBounds",
    () => serializeVectorPathBounds,
  );
  bindRuntimeValue(runtime, "vectorAnchorBounds", () => vectorAnchorBounds);
  bindRuntimeValue(
    runtime,
    "quadraticToCubic",
    () => quadraticToCubic,
    (value) => {
      quadraticToCubic = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "deleteVectorAnchorKeepingCurve",
    () => deleteVectorAnchorKeepingCurve,
  );
  bindRuntimeValue(runtime, "mapVectorPath", () => mapVectorPath);
  bindRuntimeValue(runtime, "serializeVectorPath", () => serializeVectorPath);
  return () => {
    VectorPathParsingCosValue = Math.cos((6 * Math.PI) / 180);
    quadraticToCubic = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
    ): Dynamic => ({
      c1: {
        x: input.x + (2 / 3) * (options.x - input.x),
        y: input.y + (2 / 3) * (options.y - input.y),
      },
      c2: {
        x: context.x + (2 / 3) * (options.x - context.x),
        y: context.y + (2 / 3) * (options.y - context.y),
      },
    });
  };
}
