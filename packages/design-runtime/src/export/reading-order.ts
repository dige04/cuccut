/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installExportReadingOrder(
  runtime: RuntimeBindings,
): () => void {
  function artboardsInReadingOrder<
    Board extends {
      x?: number;
      y?: number;
      h: number;
    },
  >(boards: readonly Board[]): Board[] {
    let callback: (board: Board) => number = (input2) => input2.x ?? 0,
      callback2: (board: Board) => number = (input2) => input2.y ?? 0,
      items: {
        bottom: number;
        mid: number;
        items: Board[];
      }[] = [];
    for (let value of [...boards].sort(
      (input2, options) =>
        callback2(input2) - callback2(options) ||
        callback(input2) - callback(options),
    )) {
      let value2 = items[items.length - 1];
      value2 &&
      (callback2(value) + value.h / 2 < value2.bottom ||
        callback2(value) < value2.mid)
        ? (value2.items.push(value),
          (value2.bottom = Math.max(value2.bottom, callback2(value) + value.h)))
        : items.push({
            bottom: callback2(value) + value.h,
            mid: callback2(value) + value.h / 2,
            items: [value],
          });
    }
    return items.flatMap((input2) =>
      input2.items.sort(
        (input3, options) =>
          callback(input3) - callback(options) ||
          callback2(input3) - callback2(options),
      ),
    );
  }
  bindRuntimeValue(
    runtime,
    "artboardsInReadingOrder",
    () => artboardsInReadingOrder,
  );
  return () => {};
}
