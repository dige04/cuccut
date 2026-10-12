/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installFastEditApplication(
  runtime: RuntimeBindings,
): () => void {
  function resolveCommentPinPosition(
    pin2?: Dynamic,
    boards?: Dynamic,
    file?: Dynamic,
  ): Dynamic {
    let rectangles: Dynamic = boards.map(runtime.artboardRectangle),
      target: Dynamic =
        rectangles[
          boards.findIndex((input?: Dynamic): Dynamic => input.file === file)
        ],
      placement: Dynamic = (0, runtime.findAvailableArtboardPosition)(
        {
          x: Math.round(pin2.x),
          y: Math.round(pin2.y),
          w: target.w,
          h: target.h,
        },
        rectangles,
        target,
      );
    return {
      x: placement.x,
      y: placement.y,
      atPin: placement.moved === "",
    };
  }
  function prepareFastEditArtboardChanges(
    operations?: Dynamic,
    boards?: Dynamic,
    targetFile?: Dynamic,
    boardByFile?: Dynamic,
    allowDistant: Dynamic = false,
    pin2?: Dynamic,
  ): Dynamic {
    let placements: Dynamic = new Map();
    for (let value of boards as Dynamic) {
      if (operations.deletes.includes(value.file)) continue;
      let entry: Dynamic = operations.places.get(value.file);
      placements.set(value.file, {
        x: entry?.x ?? value.x,
        y: entry?.y ?? value.y,
        w: entry?.w ?? value.w,
        h: entry?.h ?? value.h,
      });
    }
    let reference: Dynamic =
        placements.get(targetFile) ??
        (boardByFile.has(targetFile)
          ? (0, runtime.artboardRectangle)(boardByFile.get(targetFile))
          : pin2),
      movedFiles: Dynamic = [...operations.places]
        .filter(
          ([input, input2]: Dynamic): Dynamic =>
            input !== targetFile &&
            (input2.x !== undefined || input2.y !== undefined) &&
            placements.has(input),
        )
        .map(([input]: Dynamic): Dynamic => input),
      occupied: Dynamic = [...placements]
        .filter(([input]: Dynamic): Dynamic => !movedFiles.includes(input))
        .map(([, input]: Dynamic): Dynamic => input),
      moveOffset: Dynamic = null;
    for (let value of movedFiles as Dynamic) {
      let entry: Dynamic = placements.get(value),
        callback: Dynamic = (input?: Dynamic): Dynamic =>
          !occupied.some(
            (input2?: Dynamic): Dynamic =>
              (0, runtime.artboardRectanglesOverlap)(input, input2),
          ),
        state: Dynamic = {
          x: entry.x,
          y: entry.y,
        };
      if (!callback(entry)) {
        let value2: Dynamic =
          moveOffset !== null
            ? {
                ...entry,
                x: entry.x + moveOffset.dx,
                y: entry.y + moveOffset.dy,
              }
            : null;
        if (value2 !== null && callback(value2))
          state = {
            x: value2.x,
            y: value2.y,
          };
        else {
          let value3: Dynamic = (0, runtime.findAvailableArtboardPosition)(
            entry,
            occupied,
            reference,
          );
          state = {
            x: value3.x,
            y: value3.y,
          };
          moveOffset === null &&
            value3.moved !== "" &&
            (moveOffset = {
              dx: value3.x - entry.x,
              dy: value3.y - entry.y,
            });
        }
        operations.places.set(value, {
          ...operations.places.get(value),
          x: state.x,
          y: state.y,
        });
      }
      let state2: Dynamic = {
        ...entry,
        x: state.x,
        y: state.y,
      };
      placements.set(value, state2);
      occupied.push(state2);
    }
    for (let [value, value2] of [...operations.places] as Dynamic) {
      let entry: Dynamic = boardByFile.get(value);
      entry !== undefined &&
        (value2.x ?? entry.x) === entry.x &&
        (value2.y ?? entry.y) === entry.y &&
        (value2.w ?? entry.w) === entry.w &&
        (value2.h ?? entry.h) === entry.h &&
        operations.places.delete(value);
    }
    let allRectangles: Dynamic = [...placements.values()],
      addOffset: Dynamic = null;
    for (let value of operations.adds as Dynamic) {
      let value2: Dynamic =
          !allowDistant &&
          value.x !== undefined &&
          value.y !== undefined &&
          allRectangles.length > 0 &&
          Math.min(
            ...allRectangles.map(
              (input?: Dynamic): Dynamic =>
                (0, runtime.distanceBetweenArtboards)(
                  {
                    x: value.x,
                    y: value.y,
                    w: value.w,
                    h: value.h,
                  },
                  input,
                ),
            ),
          ) > 480,
        value3: Dynamic =
          addOffset !== null && value.x !== undefined && value.y !== undefined
            ? {
                x: value.x + addOffset.dx,
                y: value.y + addOffset.dy,
                w: value.w,
                h: value.h,
              }
            : null,
        value4: Dynamic =
          value3 !== null &&
          !allRectangles.some(
            (input?: Dynamic): Dynamic =>
              (0, runtime.artboardRectanglesOverlap)(value3, input),
          )
            ? {
                x: value3.x,
                y: value3.y,
                moved: "below",
              }
            : (0, runtime.findAvailableArtboardPosition)(
                {
                  ...(value.x !== undefined && value.y !== undefined && !value2
                    ? {
                        x: value.x,
                        y: value.y,
                      }
                    : {}),
                  w: value.w,
                  h: value.h,
                },
                allRectangles,
                reference,
              );
      addOffset === null &&
        value.x !== undefined &&
        value.y !== undefined &&
        (value2 || value4.moved !== "") &&
        (addOffset = {
          dx: value4.x - value.x,
          dy: value4.y - value.y,
        });
      value.x = value4.x;
      value.y = value4.y;
      allRectangles.push({
        x: value4.x,
        y: value4.y,
        w: value.w,
        h: value.h,
      });
    }
    let duplicatePositions: Dynamic = [];
    for (let value of operations.duplicates as Dynamic) {
      let value2: Dynamic =
        placements.get(value.file) ?? boardByFile.get(value.file);
      if (value2 === undefined) {
        duplicatePositions.push({
          x: Number.NaN,
          y: Number.NaN,
        });
        continue;
      }
      let value3: Dynamic = (0, runtime.findAvailableArtboardPosition)(
        {
          ...(value.x !== undefined && value.y !== undefined
            ? {
                x: value.x,
                y: value.y,
              }
            : {}),
          w: value2.w,
          h: value2.h,
        },
        allRectangles,
        reference,
      );
      duplicatePositions.push({
        x: value3.x,
        y: value3.y,
      });
      allRectangles.push({
        x: value3.x,
        y: value3.y,
        w: value2.w,
        h: value2.h,
      });
    }
    return duplicatePositions;
  }
  async function commitFastEditArtboardChanges(
    operations?: Dynamic,
    canvas?: Dynamic,
    targetFile?: Dynamic,
    boardByFile?: Dynamic,
    options?: Dynamic,
    result?: Dynamic,
    pin2?: Dynamic,
  ): Promise<Dynamic> {
    let renames: Dynamic = [...operations.renames].filter(
        ([input, input2]: Dynamic): Dynamic =>
          (0, runtime.sanitizeArtboardTitle)(input2) !== "" &&
          boardByFile.get(input) !== undefined,
      ),
      operationKinds: Dynamic = [
        operations.places.size > 0 ? "place" : "",
        ...renames.map(
          (input?: Dynamic, options2?: Dynamic): Dynamic =>
            "rename" + String(options2),
        ),
        operations.adds.length > 0 ? "add" : "",
        operations.duplicates.length > 0 ? "duplicate" : "",
      ].filter((input?: Dynamic): Dynamic => input !== ""),
      combinedOperationKind: Dynamic =
        operations.templates.size > 0 && operationKinds.length > 0
          ? operationKinds[operationKinds.length - 1]
          : "",
      token: Dynamic =
        combinedOperationKind === "" ? undefined : canvas.token(),
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        input === combinedOperationKind ? token : undefined,
      flag: Dynamic = false,
      callback2: Dynamic = (input?: Dynamic, options2?: Dynamic): Dynamic => {
        options2 && input === combinedOperationKind && (flag = true);
      },
      value: Dynamic =
        operations.places.size > 0
          ? canvas.place(
              [...operations.places].map(
                ([input, input2]: Dynamic): Dynamic => ({
                  file: input,
                  ...input2,
                }),
              ),
              callback("place"),
            )
          : [];
    callback2("place", value.length > 0);
    let items: Dynamic = [];
    renames.forEach(([input, input2]: Dynamic, options2?: Dynamic): Dynamic => {
      let value7: Dynamic = canvas.rename(
        input,
        input2,
        callback("rename" + String(options2)),
      );
      value7 && items.push(input);
      callback2("rename" + String(options2), value7);
    });
    let value2: Dynamic =
      operations.adds.length > 0
        ? await canvas.add(
            operations.adds.map(
              ({ id: id, ...props }: Dynamic): Dynamic => props,
            ),
            callback("add"),
          )
        : [];
    callback2("add", value2.length > 0);
    let value3: Dynamic =
      operations.duplicates.length > 0
        ? await canvas.duplicate(
            operations.duplicates.map(
              ({ file: file, title: title }: Dynamic): Dynamic => ({
                file: file,
                ...(title !== undefined
                  ? {
                      title: title,
                    }
                  : {}),
              }),
            ),
            callback("duplicate"),
            options,
          )
        : [];
    callback2("duplicate", value3.length > 0);
    let items2: Dynamic = [],
      items3: Dynamic = [];
    if (operations.templates.size > 0 && !result.aborted) {
      let value7: Dynamic = canvas.group(
        operations.templates.keys(),
        flag ? token : undefined,
      );
      try {
        for (let [value8, value9] of operations.templates as Dynamic) {
          let value10: Dynamic = await (targetFile
            .get(value8)
            ?.askCommit(value9, pin2?.get(value8))
            .catch((): Dynamic => "failed") ?? "stale");
          value7?.settled(value8);
          value10 === "applied"
            ? items2.push(value8)
            : value10 === "stale" && items3.push(value8);
        }
      } finally {
        value7?.end();
      }
    }
    let items4: Dynamic = [];
    if (operations.deletes.length > 0 && !result.aborted) {
      let value7: Dynamic = operations.deletes.filter(
          (input?: Dynamic): Dynamic => boardByFile.has(input),
        ),
        value8: Dynamic = canvas
          .boards()
          .map((input?: Dynamic): Dynamic => input.file),
        value9: Dynamic = value7.length === 0 ? 0 : await canvas.remove(value7);
      if (value9 > 0) {
        let values: Dynamic = new Set(
          canvas.boards().map((input?: Dynamic): Dynamic => input.file),
        );
        items4 = value7.filter(
          (input?: Dynamic): Dynamic => !values.has(input),
        );
      }
      let value10: Dynamic = value8.filter(
        (input?: Dynamic): Dynamic => !value7.includes(input),
      );
      if (
        value9 > 0 &&
        value7.includes(operations.asked) &&
        value10.length > 0
      ) {
        let value11: Dynamic = value8.indexOf(operations.asked);
        canvas.focus(
          value10.find(
            (input?: Dynamic): Dynamic => value8.indexOf(input) > value11,
          ) ?? value10[value10.length - 1],
        );
      }
    }
    let value4: Dynamic =
        value.length +
        items.length +
        value2.length +
        value3.length +
        items4.length,
      value5: Dynamic =
        (value.length > 0 ? 1 : 0) +
        items.length +
        (value2.length > 0 ? 1 : 0) +
        (value3.length > 0 ? 1 : 0) +
        (items2.length > 0 && !flag ? 1 : 0) +
        (items4.length > 0 ? 1 : 0),
      value6: Dynamic =
        value5 - (items2.length > 0 && !flag ? 1 : 0) + items2.length;
    return {
      nothingLanded: items2.length === 0 && value4 === 0,
      canvasOps: value4,
      records: value5,
      pushes: value6,
      moved: value,
      renamed: items,
      added: value2,
      copied: value3,
      removed: items4,
      landed: items2,
      stale: items3,
    };
  }
  bindRuntimeValue(
    runtime,
    "resolveCommentPinPosition",
    () => resolveCommentPinPosition,
  );
  bindRuntimeValue(
    runtime,
    "prepareFastEditArtboardChanges",
    () => prepareFastEditArtboardChanges,
  );
  bindRuntimeValue(
    runtime,
    "commitFastEditArtboardChanges",
    () => commitFastEditArtboardChanges,
  );
  return () => {};
}
