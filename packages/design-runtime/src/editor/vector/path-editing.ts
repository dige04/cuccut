/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorVectorPathEditing(
  runtime: RuntimeBindings,
): () => void {
  var VectorPathEditingConstant: Dynamic;
  var VectorPathEditingConstant_2: Dynamic;
  var VectorPathEditingLimit: Dynamic;
  function constrainVectorPointAngle(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = options.x - input.x,
      value2: Dynamic = options.y - input.y,
      value3: Dynamic = Math.hypot(value, value2);
    if (value3 === 0)
      return {
        x: input.x,
        y: input.y,
      };
    let value4: Dynamic = Math.PI / 4,
      value5: Dynamic = Math.round(Math.atan2(value2, value) / value4) * value4;
    return {
      x: input.x + value3 * Math.cos(value5),
      y: input.y + value3 * Math.sin(value5),
    };
  }
  function previousContourAnchor(input?: Dynamic, options?: Dynamic): Dynamic {
    if (options > 0) return input.anchors[options - 1];
    if (input.closed) return input.anchors[input.anchors.length - 1];
  }
  function moveVectorPart(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = input.contours[options.contour];
    if (!value) return input;
    let value2: Dynamic = value.anchors[options.anchor];
    if (!value2) return input;
    let value3: Dynamic = value.anchors.slice(),
      length: Dynamic = value3.length;
    if (options.part === "anchor") {
      let value5: Dynamic = context.x - value2.x,
        value6: Dynamic = context.y - value2.y,
        value7: Dynamic =
          value2.seg.kind === "quad"
            ? {
                kind: "quad",
                c: {
                  x: value2.seg.c.x + value5,
                  y: value2.seg.c.y + value6,
                },
              }
            : value2.seg.kind === "cubic"
              ? {
                  kind: "cubic",
                  c1: value2.seg.c1,
                  c2: {
                    x: value2.seg.c2.x + value5,
                    y: value2.seg.c2.y + value6,
                  },
                }
              : value2.seg;
      value3[options.anchor] = {
        ...value2,
        x: context.x,
        y: context.y,
        seg: value7,
      };
      let value8: Dynamic =
        options.anchor + 1 < length
          ? options.anchor + 1
          : value.closed
            ? 0
            : -1;
      if (value8 >= 0) {
        let value9: Dynamic = value3[value8];
        (value9 && value9.seg.kind === "quad") ||
          (value9 &&
            value9.seg.kind === "cubic" &&
            (value3[value8] = {
              ...value9,
              seg: {
                kind: "cubic",
                c1: {
                  x: value9.seg.c1.x + value5,
                  y: value9.seg.c1.y + value6,
                },
                c2: value9.seg.c2,
              },
            }));
      }
    } else {
      let seg: Dynamic = value2.seg;
      if (options.part === "c" && seg.kind === "quad")
        value3[options.anchor] = {
          ...value2,
          seg: {
            kind: "quad",
            c: context,
          },
        };
      else if (options.part === "c" && seg.kind === "cubic")
        value3[options.anchor] = {
          ...value2,
          seg: {
            kind: "cubic",
            c1: context,
            c2: seg.c2,
          },
        };
      else if (options.part === "c2" && seg.kind === "cubic")
        value3[options.anchor] = {
          ...value2,
          seg: {
            kind: "cubic",
            c1: seg.c1,
            c2: context,
          },
        };
      else return input;
    }
    let value4: Dynamic = input.contours.slice();
    value4[options.contour] = {
      ...value,
      anchors: value3,
    };
    let state: Dynamic = {
      contours: value4,
    };
    if (options.part !== "anchor") state = insertVectorAnchor(state, options);
    else {
      let value5: Dynamic = state.contours[options.contour];
      if (value5 && value5.anchors.length > 1) {
        let length2: Dynamic = value5.anchors.length,
          value6: Dynamic =
            options.anchor + 1 < length2 ? options.anchor + 1 : 0,
          value7: Dynamic = value5.anchors[value6]?.seg.kind;
        state = setVectorTangentKind(
          state,
          options.contour,
          options.anchor,
          "arriving",
          value7 === "quad"
            ? {
                x: value2.x,
                y: value2.y,
              }
            : undefined,
        );
        let value8: Dynamic =
            options.anchor > 0
              ? options.anchor - 1
              : value5.closed
                ? length2 - 1
                : -1,
          value9: Dynamic =
            options.anchor + 1 < length2 ? options.anchor + 1 : 0;
        value8 >= 0 &&
          value8 !== value9 &&
          (state = setVectorTangentKind(
            state,
            options.contour,
            value8,
            "departing",
          ));
      }
    }
    return state;
  }
  function insertVectorAnchor(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = input.contours[options.contour];
    if (!value) return input;
    let value2: Dynamic = value.anchors[options.anchor];
    if (!value2) return input;
    let length: Dynamic = value.anchors.length,
      value3: Dynamic =
        options.anchor > 0
          ? options.anchor - 1
          : value.closed
            ? length - 1
            : -1;
    if (length === 1) return input;
    let value4: Dynamic = input,
      seg: Dynamic = value2.seg;
    if (options.part === "c" && seg.kind === "quad") {
      value4 = setVectorTangentKind(
        value4,
        options.contour,
        options.anchor,
        "arriving",
      );
      let value5: Dynamic =
        options.anchor + 1 < length ? options.anchor + 1 : 0;
      value3 >= 0 &&
        value3 !== value5 &&
        (value4 = setVectorTangentKind(
          value4,
          options.contour,
          value3,
          "departing",
        ));
    } else
      options.part === "c" && seg.kind === "cubic"
        ? value3 >= 0 &&
          (value4 = setVectorTangentKind(
            value4,
            options.contour,
            value3,
            "departing",
          ))
        : options.part === "c2" &&
          seg.kind === "cubic" &&
          (value4 = setVectorTangentKind(
            value4,
            options.contour,
            options.anchor,
            "arriving",
          ));
    return value4;
  }
  function contourTangentDirections(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let length: Dynamic = input.anchors.length,
      value: Dynamic =
        options + 1 < length ? options + 1 : input.closed ? 0 : -1,
      value2: Dynamic = input.anchors[options]?.seg,
      value3: Dynamic = value >= 0 ? input.anchors[value]?.seg : undefined,
      value4: Dynamic =
        (options > 0 || input.closed) && value2 && value2.kind !== "line"
          ? value2.kind === "quad"
            ? value2.c
            : value2.c2
          : undefined,
      value5: Dynamic =
        value3 && value3.kind !== "line"
          ? value3.kind === "quad"
            ? value3.c
            : value3.c1
          : undefined;
    return {
      arriving: value4,
      departing: value5,
      nextI: value,
    };
  }
  function setVectorTangentKind(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = input.contours[options];
    if (!value2) return input;
    let value3: Dynamic = value2.anchors[context];
    if (!value3) return input;
    let value4: Dynamic = value3.tangent ?? "corner";
    if (value4 === "corner") return input;
    let {
      arriving: value5,
      departing: value6,
      nextI: value7,
    }: Dynamic = contourTangentDirections(value2, context);
    if (!value5 || !value6) return input;
    let value8: Dynamic = value === "arriving" ? value5 : value6,
      value9: Dynamic = value === "arriving" ? value6 : value5,
      value10: Dynamic = value3.x - value8.x,
      value11: Dynamic = value3.y - value8.y,
      value12: Dynamic = Math.hypot(value10, value11);
    if (value12 === 0) return input;
    let value13: Dynamic = extra ?? value3,
      value14: Dynamic =
        value4 === "symmetric"
          ? value12
          : Math.hypot(value9.x - value13.x, value9.y - value13.y),
      value15: Dynamic = value10 / value12,
      value16: Dynamic = value11 / value12,
      state: Dynamic = {
        x: value3.x + value15 * value14,
        y: value3.y + value16 * value14,
      },
      value17: Dynamic = value2.anchors.slice();
    if (value === "arriving") {
      let value19: Dynamic = value17[value7];
      if (!value19) return input;
      let seg: Dynamic = value19.seg;
      value17[value7] = {
        ...value19,
        seg:
          seg.kind === "quad"
            ? {
                kind: "quad",
                c: state,
              }
            : seg.kind === "cubic"
              ? {
                  kind: "cubic",
                  c1: state,
                  c2: seg.c2,
                }
              : seg,
      };
    } else {
      let seg: Dynamic = value3.seg;
      value17[context] = {
        ...value3,
        seg:
          seg.kind === "quad"
            ? {
                kind: "quad",
                c: state,
              }
            : seg.kind === "cubic"
              ? {
                  kind: "cubic",
                  c1: seg.c1,
                  c2: state,
                }
              : seg,
      };
    }
    let value18: Dynamic = input.contours.slice();
    value18[options] = {
      ...value2,
      anchors: value17,
    };
    return {
      contours: value18,
    };
  }
  function resetVectorControl(input?: Dynamic, options?: Dynamic): Dynamic {
    if (options.part === "anchor") return input;
    let value: Dynamic = input.contours[options.contour];
    if (!value) return input;
    let value2: Dynamic = value.anchors[options.anchor];
    if (!value2 || value2.seg.kind === "line") return input;
    let value3: Dynamic = value.anchors.slice();
    value3[options.anchor] = {
      ...value2,
      seg: {
        kind: "line",
      },
    };
    let value4: Dynamic = input.contours.slice();
    value4[options.contour] = {
      ...value,
      anchors: value3,
    };
    return {
      contours: value4,
    };
  }
  function deleteVectorAnchor(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = input.contours[options.contour];
    if (!value || !value.anchors[options.anchor]) return input;
    let value2: Dynamic = value.closed ? 3 : 2,
      value3: Dynamic = input.contours.slice();
    if (value.anchors.length <= value2) {
      value3.splice(options.contour, 1);
      return {
        contours: value3,
      };
    }
    let value4: Dynamic = value.anchors.slice();
    value4.splice(options.anchor, 1);
    if (value.closed || options.anchor < value4.length) {
      let value5: Dynamic = options.anchor % value4.length,
        value6: Dynamic = value4[value5];
      value6 &&
        (value4[value5] = {
          ...value6,
          seg: {
            kind: "line",
          },
        });
    }
    value3[options.contour] = {
      ...value,
      anchors: value4,
    };
    return {
      contours: value3,
    };
  }
  function vectorHitRadius(input?: Dynamic): Dynamic {
    return input.pointerType === "touch"
      ? VectorPathEditingConstant_2
      : VectorPathEditingConstant;
  }
  function captureVectorPointer(input?: Dynamic, options?: Dynamic): Dynamic {
    try {
      input.setPointerCapture(options);
    } catch {}
  }
  function blurVectorInput(): Dynamic {
    let activeElement: Dynamic = (document as Dynamic).activeElement;
    activeElement &&
      (activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA") &&
      activeElement.blur?.();
  }
  function vectorUsesCoarsePointer(): Dynamic {
    return (
      typeof matchMedia !== "undefined" &&
      matchMedia("(pointer: coarse)").matches
    );
  }
  function showVectorControls(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
    detail?: Dynamic,
  ): Dynamic {
    if (input !== "selected") return true;
    if (!detail || detail.contour !== context) return false;
    let length: Dynamic = options.anchors.length,
      callback: Dynamic = (input2?: Dynamic): Dynamic =>
        input2 > 0 ? input2 - 1 : options.closed ? length - 1 : -1,
      callback2: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic => {
        let value3: Dynamic = options.anchors[input2]?.seg;
        return options2 === "anchor" || options2 === "c2"
          ? [input2]
          : value3?.kind === "quad"
            ? [input2, callback(input2)]
            : [callback(input2)];
      },
      value2: Dynamic = callback2(detail.anchor, detail.part)[0];
    return (
      value2 !== undefined &&
      value2 >= 0 &&
      callback2(value, extra).includes(value2)
    );
  }
  function sameVectorPath(input?: Dynamic, options?: Dynamic): Dynamic {
    if (input.contours.length !== options.contours.length) return false;
    for (let index: Dynamic = 0; index < input.contours.length; index += 1) {
      let value: Dynamic = input.contours[index],
        value2: Dynamic = options.contours[index];
      if (
        !value ||
        !value2 ||
        value.closed !== value2.closed ||
        value.anchors.length !== value2.anchors.length
      )
        return false;
      for (
        let index2: Dynamic = 0;
        index2 < value.anchors.length;
        index2 += 1
      ) {
        let value3: Dynamic = value.anchors[index2],
          value4: Dynamic = value2.anchors[index2];
        if (
          !value3 ||
          !value4 ||
          value3.x !== value4.x ||
          value3.y !== value4.y ||
          (value3.tangent ?? "corner") !== (value4.tangent ?? "corner")
        )
          return false;
        let seg: Dynamic = value3.seg,
          seg2: Dynamic = value4.seg;
        if (seg.kind !== seg2.kind) return false;
        if (seg.kind === "quad" && seg2.kind === "quad") {
          if (seg.c.x !== seg2.c.x || seg.c.y !== seg2.c.y) return false;
        } else if (
          seg.kind === "cubic" &&
          seg2.kind === "cubic" &&
          (seg.c1.x !== seg2.c1.x ||
            seg.c1.y !== seg2.c1.y ||
            seg.c2.x !== seg2.c2.x ||
            seg.c2.y !== seg2.c2.y)
        )
          return false;
      }
    }
    return true;
  }
  function vectorPartPoint(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic =
      input.contours[options.contour]?.anchors[options.anchor];
    if (!value) return;
    if (options.part === "anchor")
      return {
        x: value.x,
        y: value.y,
      };
    let seg: Dynamic = value.seg;
    if (seg.kind === "quad" && options.part === "c") return seg.c;
    if (seg.kind === "cubic" && options.part === "c") return seg.c1;
    if (seg.kind === "cubic" && options.part === "c2") return seg.c2;
  }
  bindRuntimeValue(
    runtime,
    "constrainVectorPointAngle",
    () => constrainVectorPointAngle,
  );
  bindRuntimeValue(
    runtime,
    "previousContourAnchor",
    () => previousContourAnchor,
  );
  bindRuntimeValue(runtime, "moveVectorPart", () => moveVectorPart);
  bindRuntimeValue(runtime, "insertVectorAnchor", () => insertVectorAnchor);
  bindRuntimeValue(
    runtime,
    "contourTangentDirections",
    () => contourTangentDirections,
  );
  bindRuntimeValue(runtime, "setVectorTangentKind", () => setVectorTangentKind);
  bindRuntimeValue(runtime, "resetVectorControl", () => resetVectorControl);
  bindRuntimeValue(runtime, "deleteVectorAnchor", () => deleteVectorAnchor);
  bindRuntimeValue(
    runtime,
    "VectorPathEditingConstant",
    () => VectorPathEditingConstant,
    (value) => {
      VectorPathEditingConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "VectorPathEditingConstant_2",
    () => VectorPathEditingConstant_2,
    (value) => {
      VectorPathEditingConstant_2 = value;
    },
  );
  bindRuntimeValue(runtime, "vectorHitRadius", () => vectorHitRadius);
  bindRuntimeValue(runtime, "captureVectorPointer", () => captureVectorPointer);
  bindRuntimeValue(runtime, "blurVectorInput", () => blurVectorInput);
  bindRuntimeValue(
    runtime,
    "vectorUsesCoarsePointer",
    () => vectorUsesCoarsePointer,
  );
  bindRuntimeValue(runtime, "showVectorControls", () => showVectorControls);
  bindRuntimeValue(
    runtime,
    "VectorPathEditingLimit",
    () => VectorPathEditingLimit,
    (value) => {
      VectorPathEditingLimit = value;
    },
  );
  bindRuntimeValue(runtime, "sameVectorPath", () => sameVectorPath);
  bindRuntimeValue(runtime, "vectorPartPoint", () => vectorPartPoint);
  return () => {
    VectorPathEditingConstant = 10;
    VectorPathEditingConstant_2 = 20;
    VectorPathEditingLimit = 4;
  };
}
