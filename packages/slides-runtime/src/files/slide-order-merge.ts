/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
} from "../bindings";

/** A slide file whose edits could not be saved, with the reason it was refused. */
export interface LostSlideEdit {
  path: string;
  why: string;
}

/** Options of the lost-edits message: whether the edits sit in the crash stash, and whether everything else was saved. */
export interface LostSlideEditsMessageOptions {
  stashed?: boolean;
  restSaved?: boolean;
}

/** Result of merging a slide order: `replayed` moves were re-applied on top, `lost` ones could not be. */
export interface SlideOrderMergeResult {
  order: string[];
  replayed: string[];
  lost: string[];
}

declare module "../bindings" {
  interface RuntimeBindings {
    /** Human-readable explanation of slide files whose edits could not be saved. */
    formatLostSlideEditsMessage: (
      paths: readonly LostSlideEdit[],
      options?: LostSlideEditsMessageOptions,
    ) => string;
    /** Drops repeated ids from a slide order, keeping first occurrences. */
    uniqueSlideOrder: (input?: Iterable<string> | null) => string[];
    /** Merges the slide orders of base, mine and theirs and replays the local moves that survive. */
    mergeSlideOrderWithReplay: (
      base: readonly string[],
      mine: readonly string[],
      theirs: readonly string[],
    ) => SlideOrderMergeResult;
  }
}

export function installFilesSlideOrderMerge(
  runtime: RuntimeBindings,
): () => void {
  var uniqueSlideOrder: RuntimeBindings["uniqueSlideOrder"];
  function formatLostSlideEditsMessage(
    paths: readonly LostSlideEdit[],
    options: LostSlideEditsMessageOptions = {},
  ): string {
    let basename = (input: string) => input.slice(input.lastIndexOf("/") + 1),
      firstPath = paths[0]!,
      single = paths.length === 1,
      retention =
        options.stashed === true
          ? "kept in this browser for up to " +
            runtime.CRASH_STASH_RETENTION_LABEL
          : "kept only while this tab stays open",
      message =
        " Until then " +
        (single ? "it is" : "they are") +
        " not saved, and " +
        retention +
        ".";
    if (options.restSaved === false) {
      return (
        (single
          ? 'Also, "' +
            basename(firstPath.path) +
            '" cannot be saved as it is: '
          : "Also, " +
            String(paths.length) +
            ' files cannot be saved as they are. The first, "' +
            basename(firstPath.path) +
            '": ') +
        firstPath.why +
        "." +
        message
      );
    }
    return (
      (single
        ? 'Everything else is saved, but "' +
          basename(firstPath.path) +
          '" is not: '
        : "Everything else is saved, but " +
          String(paths.length) +
          ' files are not. The first, "' +
          basename(firstPath.path) +
          '": ') +
      firstPath.why +
      "." +
      message
    );
  }
  function mergeSlideOrderWithReplay(
    base: readonly string[],
    mine: readonly string[],
    theirs: readonly string[],
  ): SlideOrderMergeResult {
    let order = (0, runtime.mergeOrderedStringList)(base, mine, theirs),
      baseOrder = uniqueSlideOrder(base),
      mineOrder = uniqueSlideOrder(mine),
      theirOrder = uniqueSlideOrder(theirs);
    if (
      (0, runtime.stringArraysEqual)(mineOrder, baseOrder) ||
      (0, runtime.stringArraysEqual)(theirOrder, baseOrder)
    ) {
      return {
        order: order,
        replayed: [],
        lost: [],
      };
    }
    let values = new Set(order),
      values2 = new Set(baseOrder),
      values3 = new Set(theirOrder),
      value = (0, runtime.longestCommonSubsequence)(
        baseOrder,
        mineOrder,
      ).filter((input) => values.has(input)),
      values4 = new Set(
        (0, runtime.longestCommonSubsequence)(baseOrder, theirOrder),
      ),
      value2 = value.filter((input) => values4.has(input)),
      value3 = value.filter((input) => !values4.has(input));
    if (value3.length === 0) {
      return {
        order: order,
        replayed: [],
        lost: value2,
      };
    }
    let values5 = new Set(value3),
      values6 = new Set(
        order.filter(
          (input) =>
            (values2.has(input) &&
              !values4.has(input) &&
              !values5.has(input)) ||
            (!values2.has(input) && !values3.has(input)),
        ),
      ),
      callback = (input: string) =>
        values4.has(input) || (!values2.has(input) && values3.has(input)),
      value4 = order.filter((input) => !values5.has(input));
    for (let value5 of mineOrder) {
      if (!values5.has(value5)) {
        continue;
      }
      let index = 0;
      for (let value6 = mineOrder.indexOf(value5) - 1; value6 >= 0; value6--) {
        let value7 = mineOrder[value6]!;
        if (!values6.has(value7)) {
          continue;
        }
        let value8 = value4.indexOf(value7);
        if (value8 >= 0) {
          index = value8 + 1;
          break;
        }
      }
      while (
        index < value4.length &&
        callback(value4[index]!) &&
        (!values4.has(value4[index]!) || value4[index]! < value5)
      )
        index += 1;
      value4.splice(index, 0, value5);
      values6.add(value5);
    }
    return {
      order: value4,
      replayed: value3,
      lost: value2,
    };
  }
  bindRuntimeValue(
    runtime,
    "formatLostSlideEditsMessage",
    () => formatLostSlideEditsMessage,
  );
  bindRuntimeValue(
    runtime,
    "uniqueSlideOrder",
    () => uniqueSlideOrder,
    (value) => {
      uniqueSlideOrder = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "mergeSlideOrderWithReplay",
    () => mergeSlideOrderWithReplay,
  );
  return () => {
    uniqueSlideOrder = (input) => [...new Set(input)];
  };
}
