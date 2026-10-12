/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorSelectionStacking(
  runtime: RuntimeBindings,
): () => void {
  var SelectionStackingFilter: Dynamic;
  var SelectionStackingIndexOf: Dynamic;
  var SelectionStackingEvery: Dynamic;
  function canReorderSelection(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return options.some((input2?: Dynamic): Dynamic => {
      let value: Dynamic = SelectionStackingIndexOf(input, input2);
      return (
        value >= 0 &&
        value + context >= 0 &&
        value + context < SelectionStackingFilter(input, input2).length
      );
    });
  }
  function selectionAtStackBoundary(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = SelectionStackingFilter(input, context),
      length: Dynamic = value2.filter(
        (input2?: Dynamic): Dynamic => options.includes(input2),
      ).length;
    return (
      value < 0 ? value2.slice(0, length) : value2.slice(value2.length - length)
    ).every((input2?: Dynamic): Dynamic => options.includes(input2));
  }
  function reorderModelSelection(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value: Dynamic = false,
  ): Dynamic {
    let value2: Dynamic = options
        .map((input2?: Dynamic): Dynamic => input.element(input2))
        .filter((input2?: Dynamic): Dynamic => input2 != null),
      value3: Dynamic = [...options].sort(
        (input2?: Dynamic, options2?: Dynamic): Dynamic =>
          SelectionStackingIndexOf(input, input2) -
          SelectionStackingIndexOf(input, options2),
      ),
      value4: Dynamic = context > 0 !== value ? value3.reverse() : value3,
      values: Dynamic = new Set();
    if (value)
      for (let value5 of value4 as Dynamic)
        selectionAtStackBoundary(input, options, value5, context) &&
          values.add(input.parentTid(value5));
    let flag: Dynamic = false;
    for (let value5 of value4 as Dynamic) {
      if (value && values.has(input.parentTid(value5))) continue;
      let value6: Dynamic = SelectionStackingFilter(input, value5),
        value7: Dynamic = value6.indexOf(value5);
      if (value7 < 0) continue;
      let value8: Dynamic = value
        ? context < 0
          ? 0
          : value6.length - 1
        : value7 + context;
      value8 < 0 ||
        value8 >= value6.length ||
        value8 === value7 ||
        (flag =
          input.moveRelative(
            value5,
            value6[value8],
            context < 0 ? "before" : "after",
          ) || flag);
    }
    return flag ? value2 : null;
  }
  function modelIdsFromElements(input?: Dynamic): Dynamic {
    return input
      .map(
        (element?: Dynamic): Dynamic =>
          parseInt(element.getAttribute("data-dc-tpl") ?? "-1", 10),
      )
      .filter((input2?: Dynamic): Dynamic => input2 >= 0);
  }
  bindRuntimeValue(
    runtime,
    "SelectionStackingFilter",
    () => SelectionStackingFilter,
    (value) => {
      SelectionStackingFilter = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SelectionStackingIndexOf",
    () => SelectionStackingIndexOf,
    (value) => {
      SelectionStackingIndexOf = value;
    },
  );
  bindRuntimeValue(runtime, "canReorderSelection", () => canReorderSelection);
  bindRuntimeValue(
    runtime,
    "selectionAtStackBoundary",
    () => selectionAtStackBoundary,
  );
  bindRuntimeValue(
    runtime,
    "SelectionStackingEvery",
    () => SelectionStackingEvery,
    (value) => {
      SelectionStackingEvery = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reorderModelSelection",
    () => reorderModelSelection,
  );
  bindRuntimeValue(runtime, "modelIdsFromElements", () => modelIdsFromElements);
  return () => {
    SelectionStackingFilter = (input?: Dynamic, options?: Dynamic): Dynamic =>
      input
        .childTids(input.parentTid(options))
        .filter((input2?: Dynamic): Dynamic => input.isOutlineRow(input2));
    SelectionStackingIndexOf = (input?: Dynamic, options?: Dynamic): Dynamic =>
      SelectionStackingFilter(input, options).indexOf(options);
    SelectionStackingEvery = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
    ): Dynamic =>
      options.every(
        (input2?: Dynamic): Dynamic =>
          selectionAtStackBoundary(input, options, input2, context),
      );
  };
}
