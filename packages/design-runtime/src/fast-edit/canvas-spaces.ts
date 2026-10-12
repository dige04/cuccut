/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installFastEditCanvasSpaces(
  runtime: RuntimeBindings,
): () => void {
  var MAX_SUGGESTED_CANVAS_SPOTS: Dynamic;
  var MAX_CANVAS_SPOT_SEARCH_ATTEMPTS: Dynamic;
  function groupArtboardsIntoRows(boards?: Dynamic): Dynamic {
    let rows: Dynamic = [];
    for (let value of [...boards].sort(
      (input?: Dynamic, options?: Dynamic): Dynamic =>
        input.y - options.y || input.x - options.x,
    ) as Dynamic) {
      let value2: Dynamic = rows.find(
        (input?: Dynamic): Dynamic => value.y < input[0].y + input[0].h,
      );
      value2 !== undefined ? value2.push(value) : rows.push([value]);
    }
    return rows.map(
      (input?: Dynamic): Dynamic =>
        [...input].sort(
          (input2?: Dynamic, options?: Dynamic): Dynamic =>
            input2.x - options.x,
        ),
    );
  }
  function findFreeSpotAfterRow(row?: Dynamic, occupied?: Dynamic): Dynamic {
    let lastBoard: Dynamic = row[row.length - 1],
      nextX: Dynamic =
        Math.max(...row.map((input?: Dynamic): Dynamic => input.x + input.w)) +
        runtime.ARTBOARD_PLACEMENT_GAP;
    for (
      let index: Dynamic = 0;
      index <= MAX_CANVAS_SPOT_SEARCH_ATTEMPTS;
      index++
    ) {
      let value: Dynamic = occupied.filter(
        (input?: Dynamic): Dynamic =>
          (0, runtime.artboardRectanglesOverlap)(
            {
              ...lastBoard,
              x: nextX,
            },
            input,
          ),
      );
      if (value.length === 0)
        return {
          x: nextX,
          y: lastBoard.y,
        };
      nextX =
        Math.max(
          ...value.map((input?: Dynamic): Dynamic => input.x + input.w),
        ) + runtime.ARTBOARD_PLACEMENT_GAP;
    }
    return null;
  }
  function describeFreeCanvasSpots(
    boards?: Dynamic,
    click?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let round: Dynamic = (input?: Dynamic): Dynamic =>
      String(Math.round(input));
    return (
      "free spots on the canvas: " +
      [
        ...groupArtboardsIntoRows(
          boards.filter(
            (input?: Dynamic): Dynamic =>
              runtime.FAST_EDIT_ARTBOARD_ID_PATTERN.test(input.id),
          ),
        )
          .filter(
            (input?: Dynamic): Dynamic =>
              input.some(
                (input2?: Dynamic): Dynamic => options.includes(input2.id),
              ),
          )
          .slice(0, MAX_SUGGESTED_CANVAS_SPOTS)
          .flatMap((items?: Dynamic): Dynamic => {
            let value: Dynamic = findFreeSpotAfterRow(items, click);
            return value === null
              ? []
              : [
                  "right of #" +
                    items[items.length - 1].id +
                    ": left " +
                    round(value.x) +
                    ", top " +
                    round(value.y),
                ];
          }),
        "below everything: left " +
          round(Math.min(...click.map((input?: Dynamic): Dynamic => input.x))) +
          ", top " +
          round(
            Math.max(
              ...click.map((input?: Dynamic): Dynamic => input.y + input.h),
            ) + runtime.ARTBOARD_PLACEMENT_GAP,
          ),
      ].join("; ") +
      ". A new artboard goes beside the ones it is like, tops aligned."
    );
  }
  bindRuntimeValue(
    runtime,
    "MAX_SUGGESTED_CANVAS_SPOTS",
    () => MAX_SUGGESTED_CANVAS_SPOTS,
    (value) => {
      MAX_SUGGESTED_CANVAS_SPOTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_CANVAS_SPOT_SEARCH_ATTEMPTS",
    () => MAX_CANVAS_SPOT_SEARCH_ATTEMPTS,
    (value) => {
      MAX_CANVAS_SPOT_SEARCH_ATTEMPTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "groupArtboardsIntoRows",
    () => groupArtboardsIntoRows,
  );
  bindRuntimeValue(runtime, "findFreeSpotAfterRow", () => findFreeSpotAfterRow);
  bindRuntimeValue(
    runtime,
    "describeFreeCanvasSpots",
    () => describeFreeCanvasSpots,
  );
  return () => {
    MAX_SUGGESTED_CANVAS_SPOTS = 6;
    MAX_CANVAS_SPOT_SEARCH_ATTEMPTS = 64;
  };
}
