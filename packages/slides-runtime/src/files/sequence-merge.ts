/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
} from "../bindings";

declare module "../bindings" {
  interface RuntimeBindings {
    /** True when both arrays have the same length and identical members in the same order. */
    stringArraysEqual: (
      left: readonly string[],
      right: readonly string[],
    ) => boolean;
    /** Members of `right` (that also occur in `left`) which are not part of the longest common subsequence. */
    longestCommonSubsequence: (
      left: readonly string[],
      right: readonly string[],
    ) => string[];
  }
}

export function installFilesSequenceMerge(
  runtime: RuntimeBindings,
): () => void {
  var stringArraysEqual: RuntimeBindings["stringArraysEqual"];
  function longestCommonSubsequence(
    left: readonly string[],
    right: readonly string[],
  ): string[] {
    let rightMembers = new Set(right),
      leftMembers = new Set(left),
      leftCommon = left.filter((input) => rightMembers.has(input)),
      rightCommon = right.filter((input) => leftMembers.has(input)),
      leftLength = leftCommon.length,
      rightLength = rightCommon.length,
      lengthTable = Array.from<unknown, number[]>(
        {
          length: leftLength + 1,
        },
        () => Array(rightLength + 1).fill(0),
      );
    for (let value = leftLength - 1; value >= 0; value--)
      for (let value2 = rightLength - 1; value2 >= 0; value2--)
        lengthTable[value]![value2] =
          leftCommon[value] === rightCommon[value2]
            ? lengthTable[value + 1]![value2 + 1]! + 1
            : Math.max(
                lengthTable[value + 1]![value2]!,
                lengthTable[value]![value2 + 1]!,
              );
    let values = new Set<string>(),
      index = 0,
      index2 = 0;
    while (index < leftLength && index2 < rightLength)
      if (leftCommon[index] === rightCommon[index2]) {
        values.add(leftCommon[index]!);
        index++;
        index2++;
      } else if (
        lengthTable[index + 1]![index2]! >= lengthTable[index]![index2 + 1]!
      ) {
        index++;
      } else {
        index2++;
      }
    return rightCommon.filter((input) => !values.has(input));
  }
  bindRuntimeValue(
    runtime,
    "stringArraysEqual",
    () => stringArraysEqual,
    (value) => {
      stringArraysEqual = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "longestCommonSubsequence",
    () => longestCommonSubsequence,
  );
  return () => {
    stringArraysEqual = (items, items2) =>
      items.length === items2.length &&
      items.every((input, options) => input === items2[options]);
  };
}
