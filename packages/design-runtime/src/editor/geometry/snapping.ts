/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorGeometrySnapping(
  runtime: RuntimeBindings,
): () => void {
  function createElementEditId(input?: Dynamic): Dynamic {
    return (
      "d" +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 8) +
      "-" +
      String(input)
    );
  }
  function snapTranslation(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let state: Dynamic = {
      dx: 0,
      dy: 0,
      guides: [],
    };
    for (let value2 of ["x", "y"] as Dynamic) {
      if (value && !value[value2]) continue;
      let value3: Dynamic = value2 === "x" ? input.x : input.y,
        value4: Dynamic = value2 === "x" ? input.w : input.h,
        items: Dynamic = [
          {
            kind: "edge",
            at: value3,
          },
          {
            kind: "center",
            at: value3 + value4 / 2,
          },
          {
            kind: "edge",
            at: value3 + value4,
          },
        ],
        value5: Dynamic = null;
      for (let value6 of options as Dynamic)
        if (
          !(
            value6.axis !== value2 ||
            !(typeof value6.pos == "number" && isFinite(value6.pos))
          )
        )
          for (let value7 of items as Dynamic) {
            if (value7.kind !== value6.kind) continue;
            let value8: Dynamic = value6.pos - value7.at,
              value9: Dynamic = Math.abs(value8);
            value9 <= context &&
              (!value5 ||
                value9 < value5.dist ||
                (value9 === value5.dist &&
                  value6.kind === "center" &&
                  value5.line.kind !== "center")) &&
              (value5 = {
                adjust: value8,
                dist: value9,
                line: value6,
              });
          }
      value5 &&
        (value2 === "x"
          ? (state.dx = value5.adjust)
          : (state.dy = value5.adjust),
        state.guides.push(value5.line));
    }
    return state;
  }
  function snapResize(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
    detail?: Dynamic,
  ): Dynamic {
    let state: Dynamic = {
      dx: context,
      dy: value,
      guides: [],
    };
    for (let value2 of ["x", "y"] as Dynamic) {
      let value3: Dynamic = value2 === "x" ? options.x : options.y;
      if (value3 === null) continue;
      let value4: Dynamic = value2 === "x" ? context : value,
        value5: Dynamic =
          (value2 === "x"
            ? value3 === "left"
              ? input.x
              : input.x + input.w
            : value3 === "top"
              ? input.y
              : input.y + input.h) + value4,
        value6: Dynamic = null;
      for (let value7 of extra as Dynamic) {
        if (
          value7.axis !== value2 ||
          value7.kind !== "edge" ||
          !(typeof value7.pos == "number" && isFinite(value7.pos))
        )
          continue;
        let value8: Dynamic = value7.pos - value5,
          value9: Dynamic = Math.abs(value8);
        value9 <= detail &&
          (!value6 || value9 < value6.dist) &&
          (value6 = {
            adjust: value8,
            dist: value9,
            line: value7,
          });
      }
      value6 &&
        (value2 === "x"
          ? (state.dx = value4 + value6.adjust)
          : (state.dy = value4 + value6.adjust),
        state.guides.push(value6.line));
    }
    return state;
  }
  function activeResizeGuides(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return context.filter((input2?: Dynamic): Dynamic => {
      let value: Dynamic = input2.axis === "x" ? options.x : options.y;
      if (value === null) return false;
      let value2: Dynamic =
        input2.axis === "x"
          ? value === "left"
            ? input.x
            : input.x + input.w
          : value === "top"
            ? input.y
            : input.y + input.h;
      return Math.abs(value2 - input2.pos) <= 0.5;
    });
  }
  function rectangleSnapGuides(input?: Dynamic): Dynamic {
    let items: Dynamic = [];
    for (let value of input as Dynamic)
      items.push(
        {
          axis: "x",
          pos: value.x,
          kind: "edge",
        },
        {
          axis: "x",
          pos: value.x + value.w / 2,
          kind: "center",
        },
        {
          axis: "x",
          pos: value.x + value.w,
          kind: "edge",
        },
        {
          axis: "y",
          pos: value.y,
          kind: "edge",
        },
        {
          axis: "y",
          pos: value.y + value.h / 2,
          kind: "center",
        },
        {
          axis: "y",
          pos: value.y + value.h,
          kind: "edge",
        },
      );
    return items;
  }
  bindRuntimeValue(runtime, "createElementEditId", () => createElementEditId);
  bindRuntimeValue(runtime, "snapTranslation", () => snapTranslation);
  bindRuntimeValue(runtime, "snapResize", () => snapResize);
  bindRuntimeValue(runtime, "activeResizeGuides", () => activeResizeGuides);
  bindRuntimeValue(runtime, "rectangleSnapGuides", () => rectangleSnapGuides);
  return () => {};
}
