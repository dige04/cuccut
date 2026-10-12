/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installGeometryCanvasSnapping(
  runtime: RuntimeBindings,
): () => void {
  function snapCanvasDrag(
    dx?: Dynamic,
    dy2?: Dynamic,
    snapState?: Dynamic,
    tolerance?: Dynamic,
    disabled2?: Dynamic,
  ): Dynamic {
    if (!snapState || disabled2)
      return {
        dx: dx,
        dy: dy2,
        guides: [],
        gaps: [],
      };
    let box: Dynamic = snapState.box,
      state: Dynamic = {
        x: box.x + dx,
        y: box.y + dy2,
        w: box.w,
        h: box.h,
      },
      value: Dynamic = (0, runtime.snapTranslation)(
        state,
        snapState.lines,
        tolerance,
      ),
      value2: Dynamic = snapState.boxes
        ? snapEqualObjectGaps(state, snapState.boxes, tolerance, {
            x: value.dx,
            y: value.dy,
          })
        : {
            dx: 0,
            dy: 0,
            gaps: [],
          },
      state2: Dynamic = {
        dx: dx,
        dy: dy2,
        guides: [],
        gaps: [],
      };
    for (let value3 of ["x", "y"] as Dynamic) {
      let value4: Dynamic = value.guides.find(
          (input?: Dynamic): Dynamic => input.axis === value3,
        ),
        value5: Dynamic = value2.gaps.filter(
          (input?: Dynamic): Dynamic => input.axis === value3,
        ),
        [value6, value7]: Dynamic =
          value3 === "x" ? [value.dx, value2.dx] : [value.dy, value2.dy];
      if (!value4 && value5.length === 0) continue;
      let value8: Dynamic =
          value4 &&
          (value5.length === 0 || Math.abs(value6) <= Math.abs(value7) + 0.5),
        value9: Dynamic = value8 ? value6 : value7;
      value3 === "x" ? (state2.dx += value9) : (state2.dy += value9);
      value4 &&
        (value8 || Math.abs(value6 - value9) <= 0.5) &&
        state2.guides.push(value4);
      value5.length > 0 &&
        (!value8 || Math.abs(value7 - value9) <= 0.5) &&
        state2.gaps.push(...value5);
    }
    return state2;
  }
  function preserveUnroundedDragPosition(
    original?: Dynamic,
    point?: Dynamic,
  ): Dynamic {
    return {
      x: point.x === Math.round(original.x) ? original.x : point.x,
      y: point.y === Math.round(original.y) ? original.y : point.y,
    };
  }
  function canvasSnapReferenceObjects(
    artboards?: Dynamic,
    annotations?: Dynamic,
    selection?: Dynamic,
    includeSelected?: Dynamic,
  ): Dynamic {
    return [
      ...artboards.filter(
        (input?: Dynamic): Dynamic =>
          includeSelected || !selection.files.has(input.file),
      ),
      ...annotations.filter(
        (input?: Dynamic): Dynamic =>
          includeSelected || !selection.notes.has(input.id),
      ),
    ];
  }
  function canvasSnapReferenceLines(
    artboards?: Dynamic,
    annotations?: Dynamic,
    selection?: Dynamic,
    includeSelected?: Dynamic,
  ): Dynamic {
    return (0, runtime.rectangleSnapGuides)(
      canvasSnapReferenceObjects(
        artboards,
        annotations,
        selection,
        includeSelected,
      ),
    );
  }
  function snapEqualObjectGaps(
    box?: Dynamic,
    neighbors?: Dynamic,
    tolerance?: Dynamic,
    shift: Dynamic = {
      x: 0,
      y: 0,
    },
  ): Dynamic {
    let state: Dynamic = {
      dx: 0,
      dy: 0,
      gaps: [],
    };
    for (let value of ["x", "y"] as Dynamic) {
      let [value2, value3, value4, value5]: Dynamic =
          value === "x" ? ["x", "w", "y", "h"] : ["y", "h", "x", "w"],
        callback: Dynamic = (input?: Dynamic): Dynamic => input[value2],
        callback2: Dynamic = (input?: Dynamic): Dynamic =>
          input[value2] + input[value3],
        callback3: Dynamic = (input?: Dynamic): Dynamic => input[value4],
        callback4: Dynamic = (input?: Dynamic): Dynamic =>
          input[value4] + input[value5],
        value6: Dynamic = box[value3],
        [items, items2]: Dynamic = [
          callback3(box) + shift[value4],
          callback4(box) + shift[value4],
        ],
        value7: Dynamic = neighbors.filter(
          (input?: Dynamic): Dynamic =>
            callback3(input) < items2 && callback4(input) > items,
        ),
        callback5: Dynamic = (input?: Dynamic): Dynamic =>
          callback(input) <= callback(box) &&
          callback2(input) >= callback2(box),
        value8: Dynamic = value7
          .filter(callback5)
          .reduce(
            (input?: Dynamic, options?: Dynamic): Dynamic =>
              input === null || options[value3] < input[value3]
                ? options
                : input,
            null,
          ),
        value9: Dynamic = value7.filter(
          (input?: Dynamic): Dynamic =>
            !callback5(input) &&
            (!value8 ||
              (callback(input) >= callback(value8) &&
                callback2(input) <= callback2(value8))),
        ),
        value10: Dynamic = (callback(box) + callback2(box)) / 2,
        value11: Dynamic = value9.filter(
          (input?: Dynamic): Dynamic =>
            (callback(input) + callback2(input)) / 2 < value10,
        ),
        value12: Dynamic = value9.filter(
          (input?: Dynamic): Dynamic =>
            (callback(input) + callback2(input)) / 2 >= value10,
        ),
        callback6: Dynamic = (input?: Dynamic): Dynamic =>
          input.reduce(
            (input2?: Dynamic, options?: Dynamic): Dynamic =>
              input2 === null || callback2(options) > callback2(input2)
                ? options
                : input2,
            null,
          ),
        callback7: Dynamic = (input?: Dynamic): Dynamic =>
          input.reduce(
            (input2?: Dynamic, options?: Dynamic): Dynamic =>
              input2 === null || callback(options) < callback(input2)
                ? options
                : input2,
            null,
          ),
        value13: Dynamic = callback6(value11),
        value14: Dynamic =
          value13 &&
          callback6(
            value11.filter(
              (input?: Dynamic): Dynamic =>
                input !== value13 && callback2(input) <= callback(value13),
            ),
          ),
        value15: Dynamic = callback7(value12),
        value16: Dynamic =
          value15 &&
          callback7(
            value12.filter(
              (input?: Dynamic): Dynamic =>
                input !== value15 && callback(input) >= callback2(value15),
            ),
          ),
        callback8: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic => {
          let [items4, items5]: Dynamic = [
            Math.max(
              input ? callback3(input) : items,
              options ? callback3(options) : items,
            ),
            Math.min(
              input ? callback4(input) : items2,
              options ? callback4(options) : items2,
            ),
          ];
          return items4 <= items5
            ? (items4 + items5) / 2
            : (items + items2) / 2;
        },
        callback9: Dynamic = (
          input?: Dynamic,
          options?: Dynamic,
          context?: Dynamic,
          value18: Dynamic = String(Math.round(options - input)),
        ): Dynamic => ({
          axis: value,
          from: input,
          to: options,
          at: context,
          label: value18,
        }),
        items3: Dynamic = [];
      if (value13 && value15) {
        let value18: Dynamic =
            (callback(value15) - callback2(value13) - value6) / 2,
          value19: Dynamic = Math.round(callback2(value13) + value18);
        Math.round(value19 - callback2(value13)) >= 1 &&
          Math.round(callback(value15) - value19 - value6) >= 1 &&
          items3.push({
            adjust: value19 - callback(box),
            between: true,
            gaps: [
              callback9(callback2(value13), value19, callback8(value13, null)),
              callback9(
                value19 + value6,
                callback(value15),
                callback8(null, value15),
              ),
            ],
          });
      }
      let callback10: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic =>
        !value9.some(
          (input2?: Dynamic): Dynamic =>
            callback(input2) < options &&
            callback2(input2) > input &&
            !(callback(input2) <= input && callback2(input2) >= options),
        );
      if (
        value13 &&
        value14 &&
        callback10(callback2(value14), callback(value13))
      ) {
        let value18: Dynamic = callback(value13) - callback2(value14),
          value19: Dynamic = Math.round(callback2(value13) + value18);
        if (
          Math.round(value18) >= 1 &&
          Math.round(value19 - callback2(value13)) >= 1
        ) {
          let value20: Dynamic = callback9(
            callback2(value14),
            callback(value13),
            callback8(value14, value13),
          );
          items3.push({
            adjust: value19 - callback(box),
            between: false,
            gaps: [
              value20,
              callback9(
                callback2(value13),
                value19,
                callback8(value13, null),
                value20.label,
              ),
            ],
          });
        }
      }
      if (
        value15 &&
        value16 &&
        callback10(callback2(value15), callback(value16))
      ) {
        let value18: Dynamic = callback(value16) - callback2(value15),
          value19: Dynamic = Math.round(callback(value15) - value18 - value6);
        if (
          Math.round(value18) >= 1 &&
          Math.round(callback(value15) - value19 - value6) >= 1
        ) {
          let value20: Dynamic = callback9(
            callback2(value15),
            callback(value16),
            callback8(value15, value16),
          );
          items3.push({
            adjust: value19 - callback(box),
            between: false,
            gaps: [
              callback9(
                value19 + value6,
                callback(value15),
                callback8(null, value15),
                value20.label,
              ),
              value20,
            ],
          });
        }
      }
      let value17: Dynamic = null;
      for (let value18 of items3 as Dynamic)
        Math.abs(value18.adjust) <= tolerance &&
          (!value17 ||
            Math.abs(value18.adjust) < Math.abs(value17.adjust) - 0.5 ||
            (Math.abs(Math.abs(value18.adjust) - Math.abs(value17.adjust)) <=
              0.5 &&
              value18.between &&
              !value17.between)) &&
          (value17 = value18);
      value17 &&
        (value === "x"
          ? (state.dx = value17.adjust)
          : (state.dy = value17.adjust),
        state.gaps.push(...value17.gaps));
    }
    return state;
  }
  bindRuntimeValue(runtime, "snapCanvasDrag", () => snapCanvasDrag);
  bindRuntimeValue(
    runtime,
    "preserveUnroundedDragPosition",
    () => preserveUnroundedDragPosition,
  );
  bindRuntimeValue(
    runtime,
    "canvasSnapReferenceObjects",
    () => canvasSnapReferenceObjects,
  );
  bindRuntimeValue(
    runtime,
    "canvasSnapReferenceLines",
    () => canvasSnapReferenceLines,
  );
  bindRuntimeValue(runtime, "snapEqualObjectGaps", () => snapEqualObjectGaps);
  return () => {};
}
