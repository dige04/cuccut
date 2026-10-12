import type { VerticalInterval } from "../contracts/geometry";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installExportCapturePagination(
  runtime: RuntimeBindings,
): () => void {
  function computePaginationCuts(
    intervals: readonly VerticalInterval[],
    contentHeight: number,
    pageHeight: number,
    maxPages: number,
    overlap: number = 0,
  ): number[] {
    let items2 = [0],
      value2 = overlap > 0 && pageHeight - 2 * overlap > 40 ? overlap : 0;
    if (!(pageHeight > 0)) return items2;
    let index = 0;
    for (; items2.length < maxPages; ) {
      let value3 = pageHeight - (items2.length > 1 ? value2 : 0);
      if (!(index + value3 < contentHeight - 4)) break;
      let value4 = index + value3 - value2,
        value5 = value4;
      for (let index2 = 0; index2 < 64; index2++) {
        let value6 = value5;
        for (let index3 = 0; index3 < intervals.length; index3++) {
          let value7 = intervals[index3]!;
          value7[1] - value7[0] > pageHeight - 2 * value2 ||
            (value7[0] < value5 &&
              value5 < value7[1] &&
              value7[0] < value6 &&
              (value6 = value7[0]));
        }
        if (value6 === value5) break;
        if (value6 <= index + 40) {
          value5 = value4;
          break;
        }
        value5 = value6;
      }
      items2.push(value5);
      index = value5;
    }
    return items2;
  }
  bindRuntimeValue(
    runtime,
    "computePaginationCuts",
    () => computePaginationCuts,
  );
  return () => {};
}
